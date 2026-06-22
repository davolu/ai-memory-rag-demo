import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { query, toVectorLiteral } from "@/lib/db";
import { embedQuery, getOpenAI, CHAT_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOP_K = 6;
const MIN_SCORE = 0.18; // cosine similarity floor — below this we treat as "not relevant"
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
    //    `<=>` is cosine distance; similarity = 1 - distance.
    const { rows: matches } = await query<{
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a precise knowledge-retrieval assistant. Answer the user's question using ONLY the provided sources. " +
            "If the sources do not contain the answer, say you couldn't find it in the documents — do NOT use outside knowledge or guess. " +
            "Cite the sources you used inline like [Source 1], [Source 2]. Be concise and factual.",
        },
        {
          role: "user",
          content: `Sources:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() || NO_ANSWER;

    const sources: Source[] = relevant.map((m) => ({
      documentId: m.document_id,
      filename: m.filename,
      snippet: m.content.length > 400 ? m.content.slice(0, 400) + "…" : m.content,
      score: Math.round(Number(m.score) * 1000) / 1000,
    }));

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
