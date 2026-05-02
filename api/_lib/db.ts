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
    pool = new Pool({
      connectionString: getPoolConnectionString(),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, [...values]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
