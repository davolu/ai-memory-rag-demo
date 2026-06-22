import { Pool } from "pg";

// A single shared pool across hot reloads / serverless invocations.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL (or POSTGRES_URL) environment variable.");
  }
  const needsSsl =
    /sslmode=require/.test(connectionString) || /neon\.tech|vercel/.test(connectionString);

  return new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

export function getPool(): Pool {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = createPool();
  }
  return globalForPg.pgPool;
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const res = await pool.query(text, params);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

// pgvector expects a literal like '[0.1,0.2,...]'
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
