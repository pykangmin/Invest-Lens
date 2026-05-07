import pg from "pg";
import type { QueryResultRow } from "pg";

const { Pool, types } = pg;

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => Number(value));

let pool: pg.Pool | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return databaseUrl;
}

function getPoolConnectionString(): string {
  const databaseUrl = new URL(getDatabaseUrl());
  databaseUrl.searchParams.delete("sslmode");
  return databaseUrl.toString();
}

export function getPool(): pg.Pool {
  if (!pool) {
    // Vercel serverless: lambda 별 1 connection (pool_size=15 한도 안에서 안전)
    // 로컬 dev: max=3 (단일 process 의 동시 query 처리)
    const isVercel = !!process.env.VERCEL;
    pool = new Pool({
      connectionString: getPoolConnectionString(),
      idleTimeoutMillis: isVercel ? 1_000 : 10_000,
      connectionTimeoutMillis: 10_000,
      max: isVercel ? 1 : 3,
      ssl: { rejectUnauthorized: false },
    });
    pool.on("error", (err) => {
      console.error("[pg.Pool error]", err);
      pool = null;
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  try {
    const result = await getPool().query<T>(text, [...values]);
    return result.rows;
  } catch (e) {
    console.error("[db.query]", text.slice(0, 100), "values:", values, "err:", e);
    throw e;
  }
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}
