import { Pool } from "pg";
import type { QueryResultRow } from "pg";

// Simple singleton pool for route handlers.
// DATABASE_URL is provided via docker-compose (postgres://...)
const globalForPg = globalThis as unknown as { __epltPgPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.__epltPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForPg.__epltPgPool = new Pool({ connectionString });
  }
  return globalForPg.__epltPgPool;
}


export async function sql<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(text, params);
  return result.rows;
}

