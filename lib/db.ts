import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __EPLT_PG_POOL__: Pool | undefined;
}

function getPool(): Pool {
  if (global.__EPLT_PG_POOL__ === undefined) {
    global.__EPLT_PG_POOL__ = new Pool({
      host: process.env.PGHOST || process.env.POSTGRES_HOST || "db",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || process.env.POSTGRES_DB || "eplt",
      user: process.env.PGUSER || process.env.POSTGRES_USER || "eplt",
      password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "epltpass",
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    });
  }
  // non-null by construction above
  return global.__EPLT_PG_POOL__ as Pool;
}

export type SqlResult<T = any> = {
  rows: T[];
  rowCount: number;
};

export async function sql<T = any>(text: string, params: any[] = []): Promise<SqlResult<T>> {
  const pool = getPool();
  const res: any = await pool.query(text, params);
  return { rows: res.rows as T[], rowCount: Number(res.rowCount ?? res.rows?.length ?? 0) };
}
