import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUserId } from "@/lib/session";
import { query, toVectorLiteral } from "@/lib/db";
import { extractText, isSupported } from "@/lib/extract";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Look up an existing document for this user with the same content hash.
// Returns null if no duplicate (or if the content_hash column isn't present yet).
async function findDuplicate(userId: string, hash: string) {
  try {
    const { rows } = await query<{
      id: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
      status: string;
      error: string | null;
      chunk_count: number;
      created_at: string;
    }>(
      `SELECT id, filename, mime_type, size_bytes, status, error, chunk_count, created_at
         FROM documents
        WHERE user_id = $1 AND content_hash = $2
        LIMIT 1`,
      [userId, hash]
    );
    return rows[0] ?? null;
  } catch {
    // content_hash column missing (migration 002 not applied yet) — skip dedupe.
    return null;
  }
}

// List the current user's documents
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, filename, mime_type, size_bytes, status, error, chunk_count, created_at
       FROM documents
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return NextResponse.json({ documents: rows });
}

// Upload + ingest a document
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let docId: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!isSupported(file.name, file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF, TXT, or MD file." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is larger than 10 MB." }, { status: 400 });
    }

    // Extract text first so we can compute a content hash and dedupe BEFORE
    // creating a row or spending tokens on embeddings.
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.name, file.type);

    if (!text || text.length < 1) {
      return NextResponse.json(
        { error: "Could not extract any text from that file." },
        { status: 422 }
      );
    }

    const contentHash = createHash("sha256").update(text).digest("hex");

    // Dedupe: if this user already has a document with the same content, skip.
    const existing = await findDuplicate(userId, contentHash);
    if (existing) {
      return NextResponse.json(
        {
          duplicate: true,
          message: `"${existing.filename}" is already in your library — skipped.`,
          document: existing,
        },
        { status: 200 }
      );
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "Document produced no chunks." }, { status: 422 });
    }

    // Create the document row in "processing" state, recording the content hash.
    // The partial unique index on (user_id, content_hash) guards against races.
    try {
      const inserted = await query<{ id: string }>(
        `INSERT INTO documents (user_id, filename, mime_type, size_bytes, status, content_hash)
         VALUES ($1, $2, $3, $4, 'processing', $5) RETURNING id`,
        [
          userId,
          file.name,
          file.type || "application/octet-stream",
          file.size,
          contentHash,
        ]
      );
      docId = inserted.rows[0].id;
    } catch (e: any) {
      // Unique violation => a concurrent identical upload won the race; treat as dup.
      if (e?.code === "23505") {
        const dup = await findDuplicate(userId, contentHash);
        return NextResponse.json(
          {
            duplicate: true,
            message: `"${dup?.filename ?? file.name}" is already in your library — skipped.`,
            document: dup,
          },
          { status: 200 }
        );
      }
      // content_hash column missing (migration not applied) — insert without it.
      if (e?.code === "42703") {
        const inserted = await query<{ id: string }>(
          `INSERT INTO documents (user_id, filename, mime_type, size_bytes, status)
           VALUES ($1, $2, $3, $4, 'processing') RETURNING id`,
          [userId, file.name, file.type || "application/octet-stream", file.size]
        );
        docId = inserted.rows[0].id;
      } else {
        throw e;
      }
    }

    // Embed in batches to stay within request limits.
    const BATCH = 64;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embedTexts(batch);

      // Build a multi-row insert.
      const values: string[] = [];
      const params: any[] = [];
      batch.forEach((content, j) => {
        const base = j * 5;
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector)`
        );
        params.push(docId, userId, i + j, content, toVectorLiteral(embeddings[j]));
      });

      await query(
        `INSERT INTO chunks (document_id, user_id, chunk_index, content, embedding)
         VALUES ${values.join(", ")}`,
        params
      );
    }

    await query(
      `UPDATE documents SET status = 'ready', chunk_count = $2, error = NULL WHERE id = $1`,
      [docId, chunks.length]
    );

    const { rows } = await query(
      `SELECT id, filename, mime_type, size_bytes, status, error, chunk_count, created_at
         FROM documents WHERE id = $1`,
      [docId]
    );
    return NextResponse.json({ document: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error("upload error", err);
    if (docId) {
      await query(`UPDATE documents SET status = 'error', error = $2 WHERE id = $1`, [
        docId,
        String(err?.message || err).slice(0, 500),
      ]).catch(() => {});
    }
    return NextResponse.json(
      { error: "Failed to process the document. " + (err?.message || "") },
      { status: 500 }
    );
  }
}
