# Recall — AI Memory & Knowledge Retrieval (RAG)

A genuinely working **Retrieval-Augmented Generation** web app. Sign up, upload your
PDFs / notes, and ask questions in plain language — answers are grounded **only** in your
own documents and always come with citations (source document + the exact snippet +
similarity score). If nothing relevant is found, it tells you instead of hallucinating.

Everything is per-user and persists across sessions — that's the "memory".

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + shadcn/ui-style components + **lucide-react**
- **Postgres + [pgvector](https://github.com/pgvector/pgvector)** as the single datastore
  (users, documents, chunks+embeddings, chat history) via `pg` with raw SQL
- **NextAuth (Auth.js) Credentials provider** — real email/password, hashed with `bcryptjs`,
  JWT cookie sessions
- **OpenAI** — `text-embedding-3-small` for embeddings, `gpt-4o-mini` for answers

## How it works

1. **Upload** (`/api/documents`): extract text (`pdf-parse` for PDFs), chunk it
   (~600 tokens with overlap), embed each chunk with OpenAI, and store
   `chunks(content, embedding vector(1536))` scoped to the user.
2. **Ask** (`/api/chat`): embed the question, run a cosine-similarity search
   (`embedding <=> query`) over **that user's** chunks, take the top-k above a relevance
   floor, and ask `gpt-4o-mini` to answer using only those passages — with inline citations.
3. Chat history and documents are stored in Postgres per user.

---

## 1. Create a Postgres database with pgvector

Either provider works — both give you a connection string and support `pgvector`.

### Option A — Vercel Postgres
1. In your Vercel project → **Storage** → **Create Database** → **Postgres**.
2. Once created, open the **`.env.local`** tab and copy the `POSTGRES_URL` value.
   (This project reads `DATABASE_URL` or `POSTGRES_URL`.)
3. pgvector is available; the migration enables it with `CREATE EXTENSION vector`.

### Option B — Neon (free tier)
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (looks like
   `postgres://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. pgvector is supported; the migration enables it automatically.

## 2. Set the environment variables

Copy `.env.example` → `.env.local` and fill in **all four**:

```bash
cp .env.example .env.local
```

| Variable          | What it is                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| `OPENAI_API_KEY`  | Your OpenAI API key (embeddings + chat).                                   |
| `DATABASE_URL`    | Postgres connection string (or use `POSTGRES_URL`). Needs `?sslmode=require` for Neon/Vercel. |
| `NEXTAUTH_SECRET` | Random secret for session encryption. Generate: `openssl rand -base64 32`. |
| `NEXTAUTH_URL`    | `http://localhost:3000` locally; your deployed URL in production.          |

> **Secrets go in env vars, never in the repo.** `.env*` files are git-ignored (except
> `.env.example`). Never commit real keys.

## 3. Install & initialise the database

```bash
npm install
npm run db:init     # creates the vector extension + all tables
```

`npm run db:init` runs the SQL in `migrations/` against your `DATABASE_URL`.

## 4. Run locally

```bash
npm run dev
# open http://localhost:3000
```

Sign up, upload a PDF/TXT/MD, then head to **Chat** and ask about it.

## 5. Build

```bash
npm run build
```

The build does **not** call OpenAI or the database — only the running app does at request
time.

---

## Deploy to Vercel

1. Push this repo to GitHub (already done if you cloned it from there).
2. In Vercel, **New Project** → import the repo.
3. Add the **Storage → Postgres** database (Option A above) or paste your Neon string.
4. In **Project → Settings → Environment Variables**, add all four for **Production**
   (and Preview if you like):
   - `OPENAI_API_KEY`
   - `DATABASE_URL` (or `POSTGRES_URL` — Vercel Postgres injects `POSTGRES_URL` automatically)
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` → your production URL, e.g. `https://your-app.vercel.app`
5. **Deploy.**
6. Run migrations against the production DB **once**. Easiest: locally set `DATABASE_URL`
   to the production connection string in `.env.local` and run `npm run db:init`
   (then revert your local `.env.local`). Vercel Postgres also lets you run SQL from its
   dashboard — paste `migrations/001_init.sql` there.

That's it — sign up on the deployed URL and start uploading.

## Project structure

```
migrations/001_init.sql        # vector extension + tables
scripts/init-db.mjs            # `npm run db:init`
src/lib/                       # db (pg pool), openai, chunking, extract, auth, session
src/app/api/                   # auth, signup, documents (upload/list/delete), chat (ask/history)
src/app/dashboard/             # protected app: Documents + Chat
src/app/{login,signup}/        # real auth pages
src/components/                # sidebar + shadcn-style UI
```

## Notes / limits

- Supported uploads: **PDF, TXT, MD**, up to 10 MB. Multiple files can be uploaded at
  once; duplicates (same extracted text) are de-duplicated per user via a sha256
  `content_hash`.
- If upgrading an existing database, re-run `npm run db:init` to apply
  `migrations/002_dedupe.sql` (adds the `content_hash` column + unique index). All
  migrations are idempotent.
- Embedding dimension is fixed to **1536** (`text-embedding-3-small`). Changing the model
  means changing the `vector(1536)` column.
- This is a focused demo; for production you'd add background processing for large files,
  rate limiting, and per-document re-indexing.
