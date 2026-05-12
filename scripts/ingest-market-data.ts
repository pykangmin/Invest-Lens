import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import {
  fetchYahooDaily,
  type YahooDailyPoint,
  fxRateFromYahoo,
  marketIndexFromYahoo,
} from "../api/_lib/marketData";
import type { CommodityPrice, FxRatePoint, MarketIndexPoint } from "../src/types/investment";

const { Client, types } = pg;

const MARKET_SERIES = [
  { yahooSymbol: "^GSPC", symbol: "^GSPC", name: "S&P 500" },
  { yahooSymbol: "^IXIC", symbol: "^IXIC", name: "Nasdaq Composite" },
  { yahooSymbol: "^DJI", symbol: "^DJI", name: "Dow Jones Industrial Average" },
  { yahooSymbol: "^RUT", symbol: "^RUT", name: "Russell 2000" },
  { yahooSymbol: "^VIX", symbol: "^VIX", name: "CBOE Volatility Index" },
  { yahooSymbol: "XLK", symbol: "XLK", name: "Technology Select Sector SPDR" },
  { yahooSymbol: "XLF", symbol: "XLF", name: "Financial Select Sector SPDR" },
  { yahooSymbol: "XLV", symbol: "XLV", name: "Health Care Select Sector SPDR" },
  { yahooSymbol: "XLY", symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR" },
  { yahooSymbol: "XLP", symbol: "XLP", name: "Consumer Staples Select Sector SPDR" },
  { yahooSymbol: "XLC", symbol: "XLC", name: "Communication Services Select Sector SPDR" },
  { yahooSymbol: "XLI", symbol: "XLI", name: "Industrial Select Sector SPDR" },
  { yahooSymbol: "XLE", symbol: "XLE", name: "Energy Select Sector SPDR" },
  { yahooSymbol: "XLU", symbol: "XLU", name: "Utilities Select Sector SPDR" },
  { yahooSymbol: "XLB", symbol: "XLB", name: "Materials Select Sector SPDR" },
  { yahooSymbol: "XLRE", symbol: "XLRE", name: "Real Estate Select Sector SPDR" },
] as const;

const FX_SERIES = [
  { yahooSymbol: "KRW=X", pair: "USD/KRW", baseCurrency: "USD", quoteCurrency: "KRW" },
  { yahooSymbol: "JPY=X", pair: "USD/JPY", baseCurrency: "USD", quoteCurrency: "JPY" },
  { yahooSymbol: "CNY=X", pair: "USD/CNY", baseCurrency: "USD", quoteCurrency: "CNY" },
  { yahooSymbol: "EURUSD=X", pair: "EUR/USD", baseCurrency: "EUR", quoteCurrency: "USD" },
  { yahooSymbol: "GBPUSD=X", pair: "GBP/USD", baseCurrency: "GBP", quoteCurrency: "USD" },
  { yahooSymbol: "EURKRW=X", pair: "EUR/KRW", baseCurrency: "EUR", quoteCurrency: "KRW" },
  { yahooSymbol: "JPYKRW=X", pair: "JPY/KRW", baseCurrency: "JPY", quoteCurrency: "KRW" },
] as const;

const COMMODITY_SERIES = [
  { yahooSymbol: "CL=F", symbol: "CL=F", category: "에너지", unit: "USD/bbl" },
  { yahooSymbol: "NG=F", symbol: "NG=F", category: "에너지", unit: "USD/MMBtu" },
  { yahooSymbol: "GC=F", symbol: "GC=F", category: "귀금속", unit: "USD/oz" },
  { yahooSymbol: "SI=F", symbol: "SI=F", category: "귀금속", unit: "USD/oz" },
  { yahooSymbol: "HG=F", symbol: "HG=F", category: "금속", unit: "USD/lb" },
  { yahooSymbol: "ZW=F", symbol: "ZW=F", category: "농산물", unit: "USd/bu" },
  { yahooSymbol: "ZC=F", symbol: "ZC=F", category: "농산물", unit: "USd/bu" },
  { yahooSymbol: "ZS=F", symbol: "ZS=F", category: "농산물", unit: "USd/bu" },
  { yahooSymbol: "LIT", symbol: "LIT", category: "금속", unit: "ETF price" },
  { yahooSymbol: "REMX", symbol: "REMX", category: "금속", unit: "ETF price" },
] as const;

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
  const url = process.env.MARKET_DATA_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or MARKET_DATA_DATABASE_URL is required.");
  }
  const normalized = url.replace("postgresql+psycopg2://", "postgresql://");
  const parsed = new URL(normalized);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function option(name: string, fallback: string): string {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

async function ensureTables(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.market_index_prices (
      symbol text NOT NULL,
      name text NOT NULL,
      date date NOT NULL,
      close numeric NOT NULL,
      open numeric,
      high numeric,
      low numeric,
      volume bigint,
      source text NOT NULL DEFAULT 'yahoo',
      is_filled boolean NOT NULL DEFAULT false,
      source_date date,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (symbol, date)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.fx_rates (
      pair text NOT NULL,
      base_currency text NOT NULL,
      quote_currency text NOT NULL,
      date date NOT NULL,
      rate numeric NOT NULL,
      open numeric,
      high numeric,
      low numeric,
      source text NOT NULL DEFAULT 'yahoo',
      is_filled boolean NOT NULL DEFAULT false,
      source_date date,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (pair, date)
    )
  `);
  await client.query(
    "CREATE INDEX IF NOT EXISTS market_index_prices_date_idx ON public.market_index_prices (date DESC)",
  );
  await client.query(
    "CREATE INDEX IF NOT EXISTS fx_rates_date_idx ON public.fx_rates (date DESC)",
  );
}

function commodityFromYahoo(
  symbol: string,
  category: string,
  unit: string,
  rows: YahooDailyPoint[],
  limit: number,
): CommodityPrice[] {
  return rows.slice(0, limit).map((row) => ({
    id: 0,
    symbol,
    date: row.date,
    close: row.close,
    open: row.open,
    high: row.high,
    low: row.low,
    volume: row.volume,
    category,
    unit,
  }));
}

async function upsertMarketIndex(
  client: pg.Client,
  rows: MarketIndexPoint[],
): Promise<void> {
  for (const row of rows) {
    await client.query(
      `
        INSERT INTO public.market_index_prices
          (symbol, name, date, close, open, high, low, volume, source, is_filled, source_date, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        ON CONFLICT (symbol, date)
        DO UPDATE SET
          name = EXCLUDED.name,
          close = EXCLUDED.close,
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          volume = EXCLUDED.volume,
          source = EXCLUDED.source,
          is_filled = EXCLUDED.is_filled,
          source_date = EXCLUDED.source_date,
          updated_at = now()
      `,
      [
        row.symbol,
        row.name,
        row.date,
        row.close,
        row.open,
        row.high,
        row.low,
        row.volume,
        row.source,
        row.isFilled,
        row.sourceDate,
      ],
    );
  }
}

async function upsertFxRates(client: pg.Client, rows: FxRatePoint[]): Promise<void> {
  for (const row of rows) {
    await client.query(
      `
        INSERT INTO public.fx_rates
          (pair, base_currency, quote_currency, date, rate, open, high, low, source, is_filled, source_date, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        ON CONFLICT (pair, date)
        DO UPDATE SET
          base_currency = EXCLUDED.base_currency,
          quote_currency = EXCLUDED.quote_currency,
          rate = EXCLUDED.rate,
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          source = EXCLUDED.source,
          is_filled = EXCLUDED.is_filled,
          source_date = EXCLUDED.source_date,
          updated_at = now()
      `,
      [
        row.pair,
        row.baseCurrency,
        row.quoteCurrency,
        row.date,
        row.rate,
        row.open,
        row.high,
        row.low,
        row.source,
        row.isFilled,
        row.sourceDate,
      ],
    );
  }
}

async function upsertCommodities(client: pg.Client, rows: CommodityPrice[]): Promise<void> {
  for (const row of rows) {
    await client.query(
      `
        INSERT INTO public.commodity_prices
          (symbol, date, close, open, high, low, volume, category, unit)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (symbol, date)
        DO UPDATE SET
          close = EXCLUDED.close,
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          volume = EXCLUDED.volume,
          category = EXCLUDED.category,
          unit = EXCLUDED.unit
      `,
      [
        row.symbol,
        row.date,
        row.close,
        row.open,
        row.high,
        row.low,
        row.volume,
        row.category,
        row.unit,
      ],
    );
  }
}

loadEnvFile(".env.local");

const range = option("--range", "5y");
const limit = Number.parseInt(option("--limit", "1500"), 10);
const dryRun = flag("--dry-run");

const marketResults = await Promise.all(
  MARKET_SERIES.map(async (series) => ({
    series,
    rows: marketIndexFromYahoo(
      series.symbol,
      series.name,
      await fetchYahooDaily(series.yahooSymbol, range),
      limit,
    ),
  })),
);
const fxResults = await Promise.all(
  FX_SERIES.map(async (series) => ({
    series,
    rows: fxRateFromYahoo(
      series.pair,
      series.baseCurrency,
      series.quoteCurrency,
      await fetchYahooDaily(series.yahooSymbol, range),
      limit,
    ),
  })),
);
const commodityResults = await Promise.all(
  COMMODITY_SERIES.map(async (series) => ({
    series,
    rows: commodityFromYahoo(
      series.symbol,
      series.category,
      series.unit,
      await fetchYahooDaily(series.yahooSymbol, range),
      limit,
    ),
  })),
);

const marketRows = marketResults.flatMap((result) => result.rows);
const fxRows = fxResults.flatMap((result) => result.rows);
const commodityRows = commodityResults.flatMap((result) => result.rows);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        market: marketResults.map((result) => ({
          symbol: result.series.symbol,
          rows: result.rows.length,
          latest: result.rows[0] ?? null,
        })),
        fx: fxResults.map((result) => ({
          pair: result.series.pair,
          rows: result.rows.length,
          latest: result.rows[0] ?? null,
        })),
        commodities: commodityResults.map((result) => ({
          symbol: result.series.symbol,
          rows: result.rows.length,
          latest: result.rows[0] ?? null,
        })),
      },
      null,
      2,
    ),
  );
} else {
  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    await client.query("BEGIN");
    await ensureTables(client);
    await upsertMarketIndex(client, marketRows);
    await upsertFxRates(client, fxRows);
    await upsertCommodities(client, commodityRows);
    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: false,
          market: marketResults.map((result) => ({
            symbol: result.series.symbol,
            rows: result.rows.length,
            latest: result.rows[0] ?? null,
          })),
          fx: fxResults.map((result) => ({
          pair: result.series.pair,
          rows: result.rows.length,
          latest: result.rows[0] ?? null,
        })),
        commodities: commodityResults.map((result) => ({
          symbol: result.series.symbol,
          rows: result.rows.length,
          latest: result.rows[0] ?? null,
        })),
      },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ((error as { code?: string }).code === "42501" ||
        (error as { code?: string }).code === "25006")
    ) {
      console.error(
        "DB write permission denied. Set MARKET_DATA_DATABASE_URL to a write-capable Postgres URL and rerun.",
      );
    }
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}
