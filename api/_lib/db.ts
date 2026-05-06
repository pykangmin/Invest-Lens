import pg from "pg";
import type { QueryResultRow } from "pg";

const { Client, types } = pg;

// 숫자·날짜 타입 파서 — 모듈 로드 1회만.
types.setTypeParser(20, (value) => Number(value));   // bigint
types.setTypeParser(1082, (value) => value);          // date as string
types.setTypeParser(1700, (value) => Number(value));  // numeric

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return databaseUrl;
}

function getConnectionString(): string {
  const databaseUrl = new URL(getDatabaseUrl());
  databaseUrl.searchParams.delete("sslmode");
  return databaseUrl.toString();
}

// Vercel serverless 친화: pool 대신 매 호출 새 Client.
// 이전에 pool singleton 이 lambda 재사용 시 stale connection 으로 flaky 500
// (FUNCTION_INVOCATION_FAILED 와 다름 — handler catch 가 잡은 후 status 500).
async function withClient<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore — connection 이 이미 닫혔을 수 있음
    }
  }
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  return withClient(async (client) => {
    const result = await client.query<T>(text, [...values]);
    return result.rows;
  });
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}
