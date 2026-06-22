import { Pool, PoolClient } from "pg";

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

// Run a cosine similarity search with a raised ivfflat.probes for good recall.
// The default probes=1 only scans a single list of the ivfflat index, which on
// small corpora frequently misses the true nearest neighbours. SET LOCAL inside
// a transaction scopes the setting to this query only.
export async function vectorSearch<T = any>(
  sql: string,
  params: any[],
  probes = 10
): Promise<T[]> {
  const pool = getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ivfflat.probes = ${Math.max(1, Math.floor(probes))}`);
    const res = await client.query(sql, params);
    await client.query("COMMIT");
    return res.rows as T[];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
