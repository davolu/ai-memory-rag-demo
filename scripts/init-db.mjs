// Runs the SQL migrations against the configured Postgres database.
// Usage: npm run db:init   (reads DATABASE_URL / POSTGRES_URL from .env.local)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

// Load env from .env.local first, then .env (does not override real env vars).
dotenv.config({ path: ".env.local" });
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("✖ Missing DATABASE_URL (or POSTGRES_URL). Set it in .env.local.");
  process.exit(1);
}

const needsSsl = /sslmode=require/.test(connectionString) || /neon\.tech|vercel/.test(connectionString);

const client = new pg.Client({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await client.connect();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`→ applying ${file} ... `);
    await client.query(sql);
    console.log("done");
  }
  console.log("✓ Database initialised.");
}

main()
  .catch((err) => {
    console.error("✖ Migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
