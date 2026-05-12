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
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.technical_score_market_avg (
      date date PRIMARY KEY,
      sample_size integer NOT NULL,
      avg_score numeric NOT NULL,
      p10_score numeric,
      p90_score numeric,
      source text NOT NULL DEFAULT 'stock_price_tech+market_index_prices',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const result = await client.query(`
    WITH scored AS (
      SELECT
        spt.date,
        (
          CASE
            WHEN vix.close IS NULL THEN NULL
            WHEN vix.close < 12 THEN 85
            WHEN vix.close < 20 THEN 60 + (20 - vix.close) * 2.5
            WHEN vix.close < 30 THEN 35 + (30 - vix.close) * 2.5
            WHEN vix.close < 45 THEN GREATEST(15, 35 - (vix.close - 30) * (20.0 / 15.0))
            ELSE GREATEST(0, 15 - (vix.close - 45))
          END
          +
          CASE
            WHEN spt.rsi_14 IS NULL THEN NULL
            ELSE (1 - ABS(spt.rsi_14 - 50) / 50) * 100
          END
        ) / 2 AS score
      FROM public.stock_price_tech spt
      LEFT JOIN public.market_index_prices vix
        ON vix.symbol = '^VIX'
       AND vix.date = spt.date
      WHERE spt.close IS NOT NULL
        AND spt.rsi_14 IS NOT NULL
        AND vix.close IS NOT NULL
    ),
    daily AS (
      SELECT
        date,
        COUNT(*)::int AS sample_size,
        AVG(score) AS avg_score,
        percentile_cont(0.1) WITHIN GROUP (ORDER BY score) AS p10_score,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY score) AS p90_score
      FROM scored
      WHERE score IS NOT NULL
      GROUP BY date
    )
    INSERT INTO public.technical_score_market_avg (
      date, sample_size, avg_score, p10_score, p90_score, source, updated_at
    )
    SELECT
      date,
      sample_size,
      avg_score,
      p10_score,
      p90_score,
      'stock_price_tech+market_index_prices',
      now()
    FROM daily
    ON CONFLICT (date)
    DO UPDATE SET
      sample_size = EXCLUDED.sample_size,
      avg_score = EXCLUDED.avg_score,
      p10_score = EXCLUDED.p10_score,
      p90_score = EXCLUDED.p90_score,
      source = EXCLUDED.source,
      updated_at = now()
  `);

  await client.query("COMMIT");

  const latest = await client.query(`
    SELECT date, sample_size, avg_score, p10_score, p90_score
    FROM public.technical_score_market_avg
    ORDER BY date DESC
    LIMIT 5
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        rowsUpserted: result.rowCount ?? 0,
        latest: latest.rows,
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
