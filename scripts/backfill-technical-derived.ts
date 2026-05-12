import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client, types } = pg;

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => Number(value));

function loadEnvFile(path: string): void {
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) return;

  const lines = readFileSync(resolvedPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function databaseUrl(): string {
  const url = process.env.TECHNICAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or TECHNICAL_DATABASE_URL is required.");
  }
  const normalized = url.replace("postgresql+psycopg2://", "postgresql://");
  const parsed = new URL(normalized);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

loadEnvFile(".env.local");

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

await client.connect();

try {
  await client.query("BEGIN");

  const ma20Result = await client.query(`
    WITH source AS (
      SELECT
        id,
        CASE
          WHEN COUNT(close) OVER w = 20 THEN AVG(close) OVER w
          ELSE NULL
        END AS expected_ma_20
      FROM public.stock_price_tech
      WHERE close IS NOT NULL
      WINDOW w AS (
        PARTITION BY ticker
        ORDER BY date
        ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
      )
    )
    UPDATE public.stock_price_tech spt
    SET ma_20 = source.expected_ma_20
    FROM source
    WHERE spt.id = source.id
      AND spt.ma_20 IS DISTINCT FROM source.expected_ma_20
  `);

  const nullCloseResult = await client.query(`
    UPDATE public.stock_price_tech
    SET ma_20 = NULL
    WHERE close IS NULL
      AND ma_20 IS NOT NULL
  `);

  await client.query("COMMIT");

  console.log(
    JSON.stringify(
      {
        ok: true,
        ma20RowsUpdated: ma20Result.rowCount ?? 0,
        nullCloseRowsCleared: nullCloseResult.rowCount ?? 0,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
