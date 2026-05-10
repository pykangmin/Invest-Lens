import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client, types } = pg;

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => Number(value));

const FUNDAMENTAL_FIELDS = [
  "market_cap",
  "per",
  "pbr",
  "roe",
  "net_profit_margin",
  "debt_to_equity",
  "revenue_growth",
  "eps_growth",
  "ev_ebitda",
  "fcf_yield",
  "fcf_margin",
  "ccc",
  "gross_margin_yoy",
  "pbr_z_score",
  "forward_per_z_score",
] as const;

const YAHOO_TYPES = [
  "quarterlyTotalRevenue",
  "quarterlyNetIncome",
  "quarterlyOperatingCashFlow",
  "quarterlyCapitalExpenditure",
  "quarterlyTotalAssets",
  "quarterlyStockholdersEquity",
  "quarterlyTotalDebt",
  "quarterlyDilutedEPS",
  "quarterlyGrossProfit",
  "quarterlyCostOfRevenue",
  "quarterlyEBITDA",
  "quarterlyAccountsReceivable",
  "quarterlyInventory",
  "quarterlyAccountsPayable",
  "quarterlyMarketCap",
  "quarterlyEnterpriseValue",
  "quarterlyForwardPeRatio",
] as const;

type FundamentalField = (typeof FUNDAMENTAL_FIELDS)[number];
type YahooType = (typeof YAHOO_TYPES)[number];

type NumericRecord = Partial<Record<FundamentalField, number | null>>;

interface FundamentalRow extends NumericRecord {
  id: number;
  ticker: string;
  date: string;
}

interface YahooPoint {
  asOfDate?: string;
  reportedValue?: {
    raw?: number;
  };
}

interface YahooSeries {
  meta?: unknown;
  timestamp?: unknown;
  [key: string]: YahooPoint[] | unknown;
}

interface YahooResponse {
  timeseries?: {
    result?: YahooSeries[];
    error?: unknown;
  };
}

interface RawQuarter {
  date: string;
  values: Partial<Record<YahooType, number>>;
}

interface Summary {
  tickers: number;
  yahooOk: number;
  yahooFailed: number;
  rowsTouched: number;
  externalFilled: Record<FundamentalField, number>;
  carryFilled: Record<FundamentalField, number>;
  remainingNulls: Record<FundamentalField, number>;
  latestCoverage: Record<FundamentalField, number>;
}

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
  const url = process.env.FUNDAMENTALS_DATABASE_URL
    ?? process.env.MARKET_DATA_DATABASE_URL
    ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL, MARKET_DATA_DATABASE_URL, or FUNDAMENTALS_DATABASE_URL is required.");
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

function blankCounts(): Record<FundamentalField, number> {
  return Object.fromEntries(FUNDAMENTAL_FIELDS.map((field) => [field, 0])) as Record<
    FundamentalField,
    number
  >;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function ratio(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }
  return numerator / denominator;
}

function positiveRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (denominator === null || denominator === undefined || denominator <= 0) return null;
  return ratio(numerator, denominator);
}

function sum(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter((value): value is number => value !== null && value !== undefined);
  if (values.length === 0 || finiteValues.length !== values.length) {
    return null;
  }
  return finiteValues.reduce((acc, value) => acc + value, 0);
}

function trailingSum(quarters: RawQuarter[], index: number, key: YahooType): number | null {
  const slice = quarters.slice(Math.max(0, index - 3), index + 1);
  if (slice.length < 4) return null;
  return sum(slice.map((quarter) => quarter.values[key] ?? null));
}

function previousYearQuarter(quarters: RawQuarter[], index: number, key: YahooType): number | null {
  const current = quarters[index];
  const targetYear = Number(current.date.slice(0, 4)) - 1;
  const targetMonthDay = current.date.slice(4);
  const direct = quarters.find((quarter) => quarter.date === `${targetYear}${targetMonthDay}`);
  return direct?.values[key] ?? quarters[index - 4]?.values[key] ?? null;
}

function zScores(values: Array<{ date: string; value: number | null }>): Map<string, number> {
  const finite = values
    .map((item) => item.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length < 2) return new Map();

  const mean = finite.reduce((acc, value) => acc + value, 0) / finite.length;
  const variance =
    finite.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (finite.length - 1);
  const deviation = Math.sqrt(variance);
  if (deviation === 0) return new Map();

  return new Map(
    values
      .filter((item): item is { date: string; value: number } => item.value !== null)
      .map((item) => [item.date, (item.value - mean) / deviation]),
  );
}

function yahooSymbol(ticker: string): string {
  return ticker.replace(/\./g, "-");
}

function asNumericDate(value: string): string {
  return value.slice(0, 10);
}

function yahooValue(point: YahooPoint): number | null {
  return finiteOrNull(point.reportedValue?.raw);
}

async function fetchYahooFundamentals(ticker: string, years: number): Promise<RawQuarter[]> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - years * 366 * 24 * 60 * 60;
  const symbol = yahooSymbol(ticker);
  const url = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("type", YAHOO_TYPES.join(","));
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Invest-Lens data loader",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo fundamentals ${ticker} failed: ${response.status}`);
  }

  const payload = (await response.json()) as YahooResponse;
  const result = payload.timeseries?.result ?? [];
  const quarters = new Map<string, RawQuarter>();

  for (const item of result) {
    for (const key of YAHOO_TYPES) {
      const points = item[key];
      if (!Array.isArray(points)) continue;

      for (const point of points) {
        if (!point.asOfDate) continue;
        const value = yahooValue(point);
        if (value === null) continue;

        const date = asNumericDate(point.asOfDate);
        const quarter = quarters.get(date) ?? { date, values: {} };
        quarter.values[key] = value;
        quarters.set(date, quarter);
      }
    }
  }

  return [...quarters.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function computeMetrics(quarters: RawQuarter[]): Map<string, NumericRecord> {
  const base = new Map<string, NumericRecord>();

  for (let index = 0; index < quarters.length; index += 1) {
    const quarter = quarters[index];
    const values = quarter.values;
    const ttmRevenue = trailingSum(quarters, index, "quarterlyTotalRevenue");
    const ttmNetIncome = trailingSum(quarters, index, "quarterlyNetIncome");
    const ttmOperatingCashFlow = trailingSum(quarters, index, "quarterlyOperatingCashFlow");
    const ttmCapex = trailingSum(quarters, index, "quarterlyCapitalExpenditure");
    const ttmEbitda = trailingSum(quarters, index, "quarterlyEBITDA");
    const ttmCogs = trailingSum(quarters, index, "quarterlyCostOfRevenue");
    const ttmFcf =
      ttmOperatingCashFlow === null || ttmCapex === null ? null : ttmOperatingCashFlow + ttmCapex;
    const marketCap = finiteOrNull(values.quarterlyMarketCap);
    const equity = finiteOrNull(values.quarterlyStockholdersEquity);
    const debt = finiteOrNull(values.quarterlyTotalDebt);
    const revenue = finiteOrNull(values.quarterlyTotalRevenue);
    const eps = finiteOrNull(values.quarterlyDilutedEPS);
    const grossProfit = finiteOrNull(values.quarterlyGrossProfit);
    const prevRevenue = previousYearQuarter(quarters, index, "quarterlyTotalRevenue");
    const prevEps = previousYearQuarter(quarters, index, "quarterlyDilutedEPS");
    const prevGrossProfit = previousYearQuarter(quarters, index, "quarterlyGrossProfit");
    const prevGrossRevenue = previousYearQuarter(quarters, index, "quarterlyTotalRevenue");
    const grossMargin = positiveRatio(grossProfit, revenue);
    const prevGrossMargin = positiveRatio(prevGrossProfit, prevGrossRevenue);
    const accountsReceivable = finiteOrNull(values.quarterlyAccountsReceivable);
    const inventory = finiteOrNull(values.quarterlyInventory);
    const accountsPayable = finiteOrNull(values.quarterlyAccountsPayable);
    const dailyRevenue = ttmRevenue === null ? null : ttmRevenue / 365;
    const dailyCogs = ttmCogs === null ? null : ttmCogs / 365;
    const dso = positiveRatio(accountsReceivable, dailyRevenue);
    const dio = positiveRatio(inventory, dailyCogs);
    const dpo = positiveRatio(accountsPayable, dailyCogs);

    const metrics: NumericRecord = {
      market_cap: marketCap,
      per: positiveRatio(marketCap, ttmNetIncome),
      pbr: positiveRatio(marketCap, equity),
      roe: positiveRatio(ttmNetIncome, equity),
      net_profit_margin: positiveRatio(ttmNetIncome, ttmRevenue),
      debt_to_equity: positiveRatio(debt, equity),
      revenue_growth:
        revenue === null || prevRevenue === null || prevRevenue === 0
          ? null
          : (revenue - prevRevenue) / Math.abs(prevRevenue),
      eps_growth:
        eps === null || prevEps === null || prevEps === 0
          ? null
          : (eps - prevEps) / Math.abs(prevEps),
      ev_ebitda: positiveRatio(values.quarterlyEnterpriseValue, ttmEbitda),
      fcf_yield: positiveRatio(ttmFcf, marketCap),
      fcf_margin: positiveRatio(ttmFcf, ttmRevenue),
      ccc:
        dso === null || dio === null || dpo === null
          ? null
          : dso + dio - dpo,
      gross_margin_yoy:
        grossMargin === null || prevGrossMargin === null ? null : grossMargin - prevGrossMargin,
      forward_per_z_score: finiteOrNull(values.quarterlyForwardPeRatio),
    };

    base.set(quarter.date, metrics);
  }

  const pbrScores = zScores(
    [...base.entries()].map(([date, metrics]) => ({ date, value: metrics.pbr ?? null })),
  );
  const forwardPeScores = zScores(
    [...base.entries()].map(([date, metrics]) => ({
      date,
      value: metrics.forward_per_z_score ?? null,
    })),
  );

  for (const [date, metrics] of base) {
    metrics.pbr_z_score = pbrScores.get(date) ?? null;
    metrics.forward_per_z_score = forwardPeScores.get(date) ?? null;
  }

  return base;
}

async function tickers(client: pg.Client, requested: string[], limit: number): Promise<string[]> {
  if (requested.length > 0) {
    return requested.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);
  }

  const result = await client.query<{ ticker: string }>(
    `
      SELECT ticker
      FROM public.company_master
      ORDER BY ticker
      LIMIT $1
    `,
    [limit],
  );
  return result.rows.map((row) => row.ticker);
}

async function existingRows(client: pg.Client, tickersToLoad: string[]): Promise<FundamentalRow[]> {
  const result = await client.query<FundamentalRow>(
    `
      SELECT id, ticker, date, ${FUNDAMENTAL_FIELDS.join(", ")}
      FROM public.stock_fundamentals
      WHERE ticker = ANY($1::text[])
      ORDER BY ticker, date
    `,
    [tickersToLoad],
  );
  return result.rows;
}

async function updateRow(
  client: pg.Client,
  row: FundamentalRow,
  metrics: NumericRecord,
): Promise<FundamentalField[]> {
  const fieldsToFill = fillableFields(row, metrics);
  if (fieldsToFill.length === 0) return [];

  const assignments = fieldsToFill.map(
    (field, index) => `${field} = COALESCE(${field}, $${index + 1})`,
  );
  const values = fieldsToFill.map((field) => metrics[field]);
  await client.query(
    `
      UPDATE public.stock_fundamentals
      SET ${assignments.join(", ")}
      WHERE id = $${values.length + 1}
    `,
    [...values, row.id],
  );

  for (const field of fieldsToFill) {
    row[field] = metrics[field] ?? null;
  }
  return fieldsToFill;
}

function fillableFields(row: FundamentalRow, metrics: NumericRecord): FundamentalField[] {
  return FUNDAMENTAL_FIELDS.filter(
    (field) => row[field] === null && metrics[field] !== null && metrics[field] !== undefined,
  );
}

async function carryFillRows(
  client: pg.Client,
  rows: FundamentalRow[],
): Promise<Record<FundamentalField, number>> {
  const counts = blankCounts();
  const byTicker = new Map<string, FundamentalRow[]>();

  for (const row of rows) {
    const tickerRows = byTicker.get(row.ticker) ?? [];
    tickerRows.push(row);
    byTicker.set(row.ticker, tickerRows);
  }

  for (const tickerRows of byTicker.values()) {
    tickerRows.sort((a, b) => a.date.localeCompare(b.date));
    const carry: NumericRecord = {};

    for (const row of tickerRows) {
      const metrics: NumericRecord = {};
      for (const field of FUNDAMENTAL_FIELDS) {
        if (row[field] === null && carry[field] !== null && carry[field] !== undefined) {
          metrics[field] = carry[field] ?? null;
        }
        if (row[field] !== null && row[field] !== undefined) {
          carry[field] = row[field] ?? null;
        }
      }

      const filled = await updateRow(client, row, metrics);
      for (const field of filled) {
        counts[field] += 1;
      }
    }

    const reverseCarry: NumericRecord = {};
    for (const row of [...tickerRows].reverse()) {
      const metrics: NumericRecord = {};
      for (const field of FUNDAMENTAL_FIELDS) {
        if (row[field] === null && reverseCarry[field] !== null && reverseCarry[field] !== undefined) {
          metrics[field] = reverseCarry[field] ?? null;
        }
        if (row[field] !== null && row[field] !== undefined) {
          reverseCarry[field] = row[field] ?? null;
        }
      }

      const filled = await updateRow(client, row, metrics);
      for (const field of filled) {
        counts[field] += 1;
      }
    }
  }

  return counts;
}

async function remainingNulls(
  client: pg.Client,
  tickersToLoad: string[],
): Promise<Record<FundamentalField, number>> {
  const expressions = FUNDAMENTAL_FIELDS.map(
    (field) => `COUNT(*) FILTER (WHERE ${field} IS NULL)::int AS ${field}`,
  );
  const result = await client.query<Record<FundamentalField, number>>(
    `
      SELECT ${expressions.join(", ")}
      FROM public.stock_fundamentals
      WHERE ticker = ANY($1::text[])
    `,
    [tickersToLoad],
  );
  return result.rows[0] ?? blankCounts();
}

async function latestCoverage(
  client: pg.Client,
  tickersToLoad: string[],
): Promise<Record<FundamentalField, number>> {
  const expressions = FUNDAMENTAL_FIELDS.map(
    (field) => `COUNT(*) FILTER (WHERE ${field} IS NOT NULL)::int AS ${field}`,
  );
  const result = await client.query<Record<FundamentalField, number>>(
    `
      WITH latest AS (
        SELECT DISTINCT ON (ticker) *
        FROM public.stock_fundamentals
        WHERE ticker = ANY($1::text[])
        ORDER BY ticker, date DESC
      )
      SELECT ${expressions.join(", ")}
      FROM latest
    `,
    [tickersToLoad],
  );
  return result.rows[0] ?? blankCounts();
}

async function run(): Promise<void> {
  loadEnvFile(".env.local");

  const requestedTickers = option("--tickers", "")
    .split(",")
    .map((ticker) => ticker.trim())
    .filter(Boolean);
  const limit = Number.parseInt(option("--limit", "600"), 10);
  const years = Number.parseInt(option("--years", "4"), 10);
  const concurrency = Math.max(1, Number.parseInt(option("--concurrency", "4"), 10));
  const dryRun = flag("--dry-run");

  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();

  try {
    const tickersToLoad = await tickers(client, requestedTickers, limit);
    const rows = await existingRows(client, tickersToLoad);
    const rowsByTickerDate = new Map(rows.map((row) => [`${row.ticker}:${row.date}`, row]));
    const metricsByTickerDate = new Map<string, NumericRecord>();
    const externalFilled = blankCounts();
    const summary: Summary = {
      tickers: tickersToLoad.length,
      yahooOk: 0,
      yahooFailed: 0,
      rowsTouched: 0,
      externalFilled,
      carryFilled: blankCounts(),
      remainingNulls: blankCounts(),
      latestCoverage: blankCounts(),
    };

    let nextIndex = 0;
    async function worker(): Promise<void> {
      while (nextIndex < tickersToLoad.length) {
        const ticker = tickersToLoad[nextIndex];
        nextIndex += 1;

        try {
          const raw = await fetchYahooFundamentals(ticker, years);
          const metricsByDate = computeMetrics(raw);
          summary.yahooOk += 1;

          for (const [date, metrics] of metricsByDate) {
            metricsByTickerDate.set(`${ticker}:${date}`, metrics);
          }
        } catch (error) {
          summary.yahooFailed += 1;
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[fundamentals] ${ticker}: ${message}`);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    for (const [key, metrics] of metricsByTickerDate) {
      const row = rowsByTickerDate.get(key);
      if (!row) continue;
      const filled = dryRun ? fillableFields(row, metrics) : await updateRow(client, row, metrics);
      if (filled.length > 0) {
        summary.rowsTouched += 1;
        for (const field of filled) {
          externalFilled[field] += 1;
        }
      }
    }

    const refreshedRows = await existingRows(client, tickersToLoad);
    if (!dryRun) {
      summary.carryFilled = await carryFillRows(client, refreshedRows);
      summary.remainingNulls = await remainingNulls(client, tickersToLoad);
      summary.latestCoverage = await latestCoverage(client, tickersToLoad);
    }

    console.log(JSON.stringify({ ok: true, dryRun, ...summary }, null, 2));
  } finally {
    await client.end().catch(() => {});
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
