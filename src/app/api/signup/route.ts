import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    const cleanEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
    if (existing.rowCount > 0) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    await query(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)",
      [cleanEmail, typeof name === "string" && name.trim() ? name.trim() : null, hash]
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    console.error("signup error", err);
    return NextResponse.json(
      { error: "Something went wrong creating your account." },
      { status: 500 }
    );
  }
}
