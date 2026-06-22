import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { query, toVectorLiteral, vectorSearch } from "@/lib/db";
import { embedQuery, getOpenAI, CHAT_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOP_K = 8;
// Cosine-similarity floor. text-embedding-3-small puts genuinely relevant
// (often paraphrased) passages around 0.1–0.45, so 0.18 was dropping good
// chunks. 0.1 keeps real matches while still excluding unrelated noise.
const MIN_SCORE = 0.1;
const NO_ANSWER =
  "I couldn't find anything about that in your documents. Try uploading a relevant file, or rephrasing your question.";

type Source = {
  documentId: string;
  filename: string;
  snippet: string;
  score: number;
};

// Return the persisted chat history for the current user.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, role, content, sources, created_at
       FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at ASC`,
    [userId]
  );
  return NextResponse.json({ messages: rows });
}

// Clear the current user's chat history.
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { message } = await req.json();
    const question = typeof message === "string" ? message.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    // Persist the user's message first.
    await query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'user', $2)`,
      [userId, question]
    );

    // 1) Embed the query.
    const queryEmbedding = await embedQuery(question);

    // 2) Cosine-similarity search over THIS user's chunks.
    //    `<=>` is cosine DISTANCE (0 = identical, 2 = opposite), so cosine
    //    SIMILARITY = 1 - distance. We ORDER BY distance ascending (closest
    //    first) and convert to similarity for the score. Uses vectorSearch so
    //    ivfflat.probes is raised for reliable recall on small corpora.
    const matches = await vectorSearch<{
      document_id: string;
      filename: string;
      content: string;
      score: number;
    }>(
      `SELECT c.document_id,
              d.filename,
              c.content,
              1 - (c.embedding <=> $1::vector) AS score
         FROM chunks c
         JOIN documents d ON d.id = c.document_id
        WHERE c.user_id = $2
        ORDER BY c.embedding <=> $1::vector
        LIMIT $3`,
      [toVectorLiteral(queryEmbedding), userId, TOP_K]
    );

    // Sanity log so we can confirm retrieval is actually working.
    console.log(
      `[chat] q="${question.slice(0, 80)}" retrieved=${matches.length} scores=` +
        JSON.stringify(
          matches.map((m) => ({
            file: m.filename,
            score: Math.round(Number(m.score) * 1000) / 1000,
          }))
        )
    );

    const relevant = matches.filter((m) => Number(m.score) >= MIN_SCORE);

    // 3) If nothing relevant, refuse to hallucinate.
    if (relevant.length === 0) {
      const saved = await query(
        `INSERT INTO chat_messages (user_id, role, content, sources)
         VALUES ($1, 'assistant', $2, $3::jsonb)
         RETURNING id, role, content, sources, created_at`,
        [userId, NO_ANSWER, JSON.stringify([])]
      );
      return NextResponse.json({ message: saved.rows[0] });
    }

    // 4) Build grounded context and ask the model.
    const context = relevant
      .map(
        (m, i) =>
          `[Source ${i + 1}] (document: "${m.filename}")\n${m.content}`
      )
      .join("\n\n---\n\n");

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: [
            "You are a knowledgeable research assistant answering questions about the user's own documents.",
            "Use the provided sources as your ground truth. Answer thoroughly and specifically:",
            "- Synthesize information ACROSS the different sources into one coherent answer; don't just quote one.",
            "- Pull out concrete details, names, numbers, and steps that appear in the sources.",
            "- Where useful, add brief insight or structure (short paragraphs or bullet points) that helps the user understand the material.",
            "- Cite the documents you draw from by name and their [Source N] tag, e.g. (\"report.pdf\" [Source 2]).",
            "Only say you can't find the answer if the sources are genuinely unrelated to the question. If they are even partially relevant, give the best grounded answer you can and note any gaps. Do not invent facts that aren't supported by the sources.",
          ].join("\n"),
        },
        {
          role: "user",
          content:
            `Here are the most relevant passages retrieved from my documents.\n\n` +
            `${context}\n\n---\n\nQuestion: ${question}\n\n` +
            `Answer using the sources above, citing them by name and [Source N].`,
        },
      ],
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() || NO_ANSWER;

    // Decide which retrieved chunks to DISPLAY as sources. The LLM still saw
    // every retrieved chunk above ([Source 1..N], where N maps to relevant[N-1]);
    // this only affects the dropdown.
    //
    // Primary: parse the [Source N] markers the model actually cited and show
    // only those — guaranteeing displayed sources = what the answer relied on.
    // Fallback (model emitted no markers): show top sources by score, keeping
    // only those within 70% of the top score, capped at 3, to drop weak tail.
    const dedupeByDoc = (rows: typeof relevant): Source[] => {
      const bestByDoc = new Map<string, Source>();
      for (const m of rows) {
        const score = Math.round(Number(m.score) * 1000) / 1000;
        const existing = bestByDoc.get(m.document_id);
        if (!existing || score > existing.score) {
          bestByDoc.set(m.document_id, {
            documentId: m.document_id,
            filename: m.filename,
            snippet:
              m.content.length > 400 ? m.content.slice(0, 400) + "…" : m.content,
            score,
          });
        }
      }
      return Array.from(bestByDoc.values()).sort((a, b) => b.score - a.score);
    };

    const citedIndices = new Set<number>();
    const markers = answer.match(/\[\s*source\s+\d+\s*\]/gi) || [];
    for (const marker of markers) {
      const digits = marker.match(/\d+/);
      if (!digits) continue;
      const n = parseInt(digits[0], 10);
      if (n >= 1 && n <= relevant.length) citedIndices.add(n);
    }

    let sources: Source[];
    if (citedIndices.size > 0) {
      const citedChunks = Array.from(citedIndices)
        .sort((a, b) => a - b)
        .map((n) => relevant[n - 1]);
      sources = dedupeByDoc(citedChunks);
    } else {
      const all = dedupeByDoc(relevant);
      const topScore = all.length > 0 ? all[0].score : 0;
      sources = all
        .filter((s) => s.score >= topScore * 0.7)
        .slice(0, 3);
    }

    const saved = await query(
      `INSERT INTO chat_messages (user_id, role, content, sources)
       VALUES ($1, 'assistant', $2, $3::jsonb)
       RETURNING id, role, content, sources, created_at`,
      [userId, answer, JSON.stringify(sources)]
    );

    return NextResponse.json({ message: saved.rows[0] });
  } catch (err: any) {
    console.error("chat error", err);
    return NextResponse.json(
      { error: "Failed to answer. " + (err?.message || "") },
      { status: 500 }
    );
  }
}
