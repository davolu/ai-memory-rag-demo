import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // chunks cascade-delete via the FK on documents.
  const res = await query(
    "DELETE FROM documents WHERE id = $1 AND user_id = $2",
    [params.id, userId]
  );
  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
