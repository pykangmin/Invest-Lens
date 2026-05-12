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
  "gross_margin",
  "gross_margin_yoy",
  "pbr_z_score",
  "forward_per_z_score",
] as const;

const NO_CARRY_FILL_FIELDS = new Set<FundamentalField>([
  "revenue_growth",
  "eps_growth",
  "gross_margin_yoy",
  "pbr_z_score",
  "forward_per_z_score",
]);

const OVERWRITE_WHEN_RECOMPUTED_FIELDS = new Set<FundamentalField>([
  "revenue_growth",
  "eps_growth",
  "gross_margin",
  "gross_margin_yoy",
]);

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

const SEC_REVENUE_TAGS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const;

const SEC_GROSS_PROFIT_TAGS = ["GrossProfit"] as const;

const SEC_COST_OF_REVENUE_TAGS = [
  "CostOfRevenue",
  "CostOfGoodsAndServicesSold",
  "CostOfGoodsSold",
  "CostOfRevenueExcludingDepreciationDepletionAndAmortization",
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

interface RawQuarterRow {
  ticker: string;
  date: string;
  total_revenue: number | null;
  net_income: number | null;
  operating_cash_flow: number | null;
  capital_expenditure: number | null;
  total_assets: number | null;
  stockholders_equity: number | null;
  total_debt: number | null;
  diluted_eps: number | null;
  gross_profit: number | null;
  cost_of_revenue: number | null;
  ebitda: number | null;
  accounts_receivable: number | null;
  inventory: number | null;
  accounts_payable: number | null;
  market_cap: number | null;
  enterprise_value: number | null;
  forward_pe: number | null;
}

interface SecTickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecFactPoint {
  end?: string;
  start?: string;
  form?: string;
  frame?: string;
  val?: number;
}

interface SecFactMetric {
  units?: Record<string, SecFactPoint[]>;
}

interface SecCompanyFacts {
  facts?: {
    "us-gaap"?: Record<string, SecFactMetric>;
  };
}

interface SecSupplementTarget {
  ticker: string;
  date: string;
  sector: string;
}

interface SecQuarterRow {
  ticker: string;
  date: string;
  total_revenue: number;
  gross_profit: number | null;
  cost_of_revenue: number | null;
  revenue_tag: string;
  gross_profit_tag: string | null;
  cost_of_revenue_tag: string | null;
}

interface Summary {
  tickers: number;
  yahooOk: number;
  yahooFailed: number;
  secTargets: number;
  secOk: number;
  secFailed: number;
  secRowsUpserted: number;
  rowsTouched: number;
  rawRowsUpserted: number;
  sectorStatsUpserted: number;
  growthRowsRefreshed: {
    revenue_growth: number;
    eps_growth: number;
    stale_revenue_growth: number;
    stale_eps_growth: number;
  };
  grossMarginRowsRefreshed: number;
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

function cashConversionCycle(
  dso: number | null,
  dio: number | null,
  dpo: number | null,
): number | null {
  const value =
    dso !== null && dio !== null && dpo !== null
      ? dso + dio - dpo
      : dso !== null && (dio !== null || dpo !== null)
        ? dso + (dio ?? 0) - (dpo ?? 0)
        : null;
  if (value === null) return null;
  if (value < -365 || value > 365) return null;
  return value;
}

function grossMarginRatio(
  grossProfit: number | null | undefined,
  revenue: number | null | undefined,
): number | null {
  const value = positiveRatio(grossProfit, revenue);
  if (value === null) return null;
  if (value < -1 || value > 1) return null;
  return value;
}

function grossProfitValue(
  grossProfit: number | null | undefined,
  revenue: number | null | undefined,
  costOfRevenue: number | null | undefined,
): number | null {
  const direct = finiteOrNull(grossProfit);
  if (direct !== null) return direct;
  const revenueValue = finiteOrNull(revenue);
  const costValue = finiteOrNull(costOfRevenue);
  if (revenueValue === null || costValue === null) return null;
  return revenueValue - costValue;
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

async function ensureFundamentalSchema(client: pg.Client): Promise<void> {
  await client.query("ALTER TABLE public.stock_fundamentals ADD COLUMN IF NOT EXISTS gross_margin numeric");
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.stock_fundamental_raw_quarterly (
      ticker text NOT NULL REFERENCES public.company_master(ticker) ON DELETE CASCADE,
      date date NOT NULL,
      total_revenue numeric,
      net_income numeric,
      operating_cash_flow numeric,
      capital_expenditure numeric,
      total_assets numeric,
      stockholders_equity numeric,
      total_debt numeric,
      diluted_eps numeric,
      gross_profit numeric,
      cost_of_revenue numeric,
      ebitda numeric,
      accounts_receivable numeric,
      inventory numeric,
      accounts_payable numeric,
      market_cap numeric,
      enterprise_value numeric,
      forward_pe numeric,
      source text NOT NULL DEFAULT 'yahoo',
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (ticker, date)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.stock_fundamental_sector_stats (
      date date NOT NULL,
      sector text NOT NULL,
      metric text NOT NULL,
      sample_size integer NOT NULL,
      avg_value numeric,
      median_value numeric,
      p10_value numeric,
      p90_value numeric,
      winsorized_avg numeric,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (date, sector, metric)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.stock_fundamental_sec_quarterly (
      ticker text NOT NULL REFERENCES public.company_master(ticker) ON DELETE CASCADE,
      date date NOT NULL,
      total_revenue numeric NOT NULL,
      gross_profit numeric,
      cost_of_revenue numeric,
      revenue_tag text NOT NULL,
      gross_profit_tag text,
      cost_of_revenue_tag text,
      source text NOT NULL DEFAULT 'sec-companyfacts',
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (ticker, date)
    )
  `);
}

async function cleanFundamentalOutliers(client: pg.Client): Promise<void> {
  await client.query(`
    UPDATE public.stock_fundamentals
    SET ccc = NULL
    WHERE ccc IS NOT NULL
      AND (ccc < -365 OR ccc > 365)
  `);
  await client.query(`
    UPDATE public.stock_fundamentals
    SET gross_margin = NULL
    WHERE gross_margin IS NOT NULL
      AND (gross_margin < -1 OR gross_margin > 1)
  `);
}

async function refreshGrossMarginFromRaw(client: pg.Client): Promise<number> {
  const grossMarginResult = await client.query(`
    WITH raw_source AS (
      SELECT ticker, date, total_revenue, gross_profit, cost_of_revenue, 1 AS priority
      FROM public.stock_fundamental_raw_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
      UNION ALL
      SELECT ticker, date, total_revenue, gross_profit, cost_of_revenue, 2 AS priority
      FROM public.stock_fundamental_sec_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
    ),
    source AS (
      SELECT DISTINCT ON (ticker, date)
        ticker,
        date,
        COALESCE(gross_profit, total_revenue - cost_of_revenue)
          / NULLIF(total_revenue, 0) AS expected
      FROM raw_source
      ORDER BY ticker, date, priority
    )
    UPDATE public.stock_fundamentals sf
    SET gross_margin = source.expected
    FROM source
    WHERE sf.ticker = source.ticker
      AND sf.date = source.date
      AND source.expected BETWEEN -1 AND 1
      AND sf.gross_margin IS DISTINCT FROM source.expected
  `);

  const grossMarginYoyResult = await client.query(`
    WITH raw_source AS (
      SELECT ticker, date, total_revenue, gross_profit, cost_of_revenue, 1 AS priority
      FROM public.stock_fundamental_raw_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
      UNION ALL
      SELECT ticker, date, total_revenue, gross_profit, cost_of_revenue, 2 AS priority
      FROM public.stock_fundamental_sec_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
    ),
    picked_source AS (
      SELECT DISTINCT ON (ticker, date)
        ticker,
        date,
        total_revenue,
        gross_profit,
        cost_of_revenue
      FROM raw_source
      ORDER BY ticker, date, priority
    ),
    source AS (
      SELECT
        current_row.ticker,
        current_row.date,
        (
          COALESCE(current_row.gross_profit, current_row.total_revenue - current_row.cost_of_revenue)
            / NULLIF(current_row.total_revenue, 0)
        ) - (
          COALESCE(previous_row.gross_profit, previous_row.total_revenue - previous_row.cost_of_revenue)
            / NULLIF(previous_row.total_revenue, 0)
        ) AS expected
      FROM picked_source current_row
      JOIN picked_source previous_row
        ON previous_row.ticker = current_row.ticker
       AND previous_row.date = (current_row.date - INTERVAL '1 year')::date
    )
    UPDATE public.stock_fundamentals sf
    SET gross_margin_yoy = source.expected
    FROM source
    WHERE sf.ticker = source.ticker
      AND sf.date = source.date
      AND source.expected BETWEEN -2 AND 2
      AND sf.gross_margin_yoy IS DISTINCT FROM source.expected
  `);

  const staleGrossMarginYoyResult = await client.query(`
    WITH raw_source AS (
      SELECT ticker, date, total_revenue, gross_profit, cost_of_revenue, 1 AS priority
      FROM public.stock_fundamental_raw_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
      UNION ALL
      SELECT ticker, date, total_revenue, gross_profit, cost_of_revenue, 2 AS priority
      FROM public.stock_fundamental_sec_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
    ),
    picked_source AS (
      SELECT DISTINCT ON (ticker, date)
        ticker,
        date,
        total_revenue,
        gross_profit,
        cost_of_revenue
      FROM raw_source
      ORDER BY ticker, date, priority
    ),
    computable AS (
      SELECT
        current_row.ticker,
        current_row.date
      FROM picked_source current_row
      JOIN picked_source previous_row
        ON previous_row.ticker = current_row.ticker
       AND previous_row.date = (current_row.date - INTERVAL '1 year')::date
    )
    UPDATE public.stock_fundamentals sf
    SET gross_margin_yoy = NULL
    WHERE sf.gross_margin_yoy IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM computable
        WHERE computable.ticker = sf.ticker
          AND computable.date = sf.date
      )
  `);

  return (
    grossMarginResult.rowCount ??
    0
  ) + (grossMarginYoyResult.rowCount ?? 0) + (staleGrossMarginYoyResult.rowCount ?? 0);
}

async function refreshGrowthFromRaw(client: pg.Client): Promise<Summary["growthRowsRefreshed"]> {
  const revenueResult = await client.query(`
    WITH raw_source AS (
      SELECT ticker, date, total_revenue, 1 AS priority
      FROM public.stock_fundamental_raw_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue <> 0
      UNION ALL
      SELECT ticker, date, total_revenue, 2 AS priority
      FROM public.stock_fundamental_sec_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue <> 0
    ),
    picked_source AS (
      SELECT DISTINCT ON (ticker, date)
        ticker,
        date,
        total_revenue
      FROM raw_source
      ORDER BY ticker, date, priority
    ),
    source AS (
      SELECT
        ticker,
        date,
        (total_revenue - LAG(total_revenue, 4) OVER w)
          / ABS(NULLIF(LAG(total_revenue, 4) OVER w, 0)) AS expected
      FROM picked_source
      WINDOW w AS (PARTITION BY ticker ORDER BY date)
    )
    UPDATE public.stock_fundamentals sf
    SET revenue_growth = source.expected
    FROM source
    WHERE sf.ticker = source.ticker
      AND sf.date = source.date
      AND source.expected IS NOT NULL
      AND sf.revenue_growth IS DISTINCT FROM source.expected
  `);

  const staleRevenueResult = await client.query(`
    WITH raw_source AS (
      SELECT ticker, date, total_revenue, 1 AS priority
      FROM public.stock_fundamental_raw_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue <> 0
      UNION ALL
      SELECT ticker, date, total_revenue, 2 AS priority
      FROM public.stock_fundamental_sec_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue <> 0
    ),
    picked_source AS (
      SELECT DISTINCT ON (ticker, date)
        ticker,
        date,
        total_revenue
      FROM raw_source
      ORDER BY ticker, date, priority
    ),
    source AS (
      SELECT
        ticker,
        date,
        (total_revenue - LAG(total_revenue, 4) OVER w)
          / ABS(NULLIF(LAG(total_revenue, 4) OVER w, 0)) AS expected
      FROM picked_source
      WINDOW w AS (PARTITION BY ticker ORDER BY date)
    )
    UPDATE public.stock_fundamentals sf
    SET revenue_growth = NULL
    WHERE sf.revenue_growth IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM source
        WHERE source.ticker = sf.ticker
          AND source.date = sf.date
          AND source.expected IS NOT NULL
      )
  `);

  const epsResult = await client.query(`
    WITH source AS (
      SELECT
        ticker,
        date,
        (diluted_eps - LAG(diluted_eps, 4) OVER w)
          / ABS(NULLIF(LAG(diluted_eps, 4) OVER w, 0)) AS expected
      FROM public.stock_fundamental_raw_quarterly
      WHERE diluted_eps IS NOT NULL
      WINDOW w AS (PARTITION BY ticker ORDER BY date)
    )
    UPDATE public.stock_fundamentals sf
    SET eps_growth = source.expected
    FROM source
    WHERE sf.ticker = source.ticker
      AND sf.date = source.date
      AND source.expected IS NOT NULL
      AND sf.eps_growth IS DISTINCT FROM source.expected
  `);

  const staleEpsResult = await client.query(`
    WITH source AS (
      SELECT
        ticker,
        date,
        (diluted_eps - LAG(diluted_eps, 4) OVER w)
          / ABS(NULLIF(LAG(diluted_eps, 4) OVER w, 0)) AS expected
      FROM public.stock_fundamental_raw_quarterly
      WHERE diluted_eps IS NOT NULL
      WINDOW w AS (PARTITION BY ticker ORDER BY date)
    )
    UPDATE public.stock_fundamentals sf
    SET eps_growth = NULL
    WHERE sf.eps_growth IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM source
        WHERE source.ticker = sf.ticker
          AND source.date = sf.date
          AND source.expected IS NOT NULL
      )
  `);

  return {
    revenue_growth: revenueResult.rowCount ?? 0,
    eps_growth: epsResult.rowCount ?? 0,
    stale_revenue_growth: staleRevenueResult.rowCount ?? 0,
    stale_eps_growth: staleEpsResult.rowCount ?? 0,
  };
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
    const costOfRevenue = finiteOrNull(values.quarterlyCostOfRevenue);
    const eps = finiteOrNull(values.quarterlyDilutedEPS);
    const grossProfit = grossProfitValue(values.quarterlyGrossProfit, revenue, costOfRevenue);
    const prevRevenue = previousYearQuarter(quarters, index, "quarterlyTotalRevenue");
    const prevEps = previousYearQuarter(quarters, index, "quarterlyDilutedEPS");
    const prevGrossProfit = grossProfitValue(
      previousYearQuarter(quarters, index, "quarterlyGrossProfit"),
      prevRevenue,
      previousYearQuarter(quarters, index, "quarterlyCostOfRevenue"),
    );
    const prevGrossRevenue = previousYearQuarter(quarters, index, "quarterlyTotalRevenue");
    const grossMargin = grossMarginRatio(grossProfit, revenue);
    const prevGrossMargin = grossMarginRatio(prevGrossProfit, prevGrossRevenue);
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
      ccc: cashConversionCycle(dso, dio, dpo),
      gross_margin: grossMargin,
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

function rawQuarterRow(ticker: string, quarter: RawQuarter): RawQuarterRow {
  const values = quarter.values;
  return {
    ticker,
    date: quarter.date,
    total_revenue: finiteOrNull(values.quarterlyTotalRevenue),
    net_income: finiteOrNull(values.quarterlyNetIncome),
    operating_cash_flow: finiteOrNull(values.quarterlyOperatingCashFlow),
    capital_expenditure: finiteOrNull(values.quarterlyCapitalExpenditure),
    total_assets: finiteOrNull(values.quarterlyTotalAssets),
    stockholders_equity: finiteOrNull(values.quarterlyStockholdersEquity),
    total_debt: finiteOrNull(values.quarterlyTotalDebt),
    diluted_eps: finiteOrNull(values.quarterlyDilutedEPS),
    gross_profit: finiteOrNull(values.quarterlyGrossProfit),
    cost_of_revenue: finiteOrNull(values.quarterlyCostOfRevenue),
    ebitda: finiteOrNull(values.quarterlyEBITDA),
    accounts_receivable: finiteOrNull(values.quarterlyAccountsReceivable),
    inventory: finiteOrNull(values.quarterlyInventory),
    accounts_payable: finiteOrNull(values.quarterlyAccountsPayable),
    market_cap: finiteOrNull(values.quarterlyMarketCap),
    enterprise_value: finiteOrNull(values.quarterlyEnterpriseValue),
    forward_pe: finiteOrNull(values.quarterlyForwardPeRatio),
  };
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

async function upsertRawQuarters(
  client: pg.Client,
  ticker: string,
  quarters: RawQuarter[],
): Promise<number> {
  let count = 0;
  for (const quarter of quarters) {
    const row = rawQuarterRow(ticker, quarter);
    await client.query(
      `
        INSERT INTO public.stock_fundamental_raw_quarterly (
          ticker, date, total_revenue, net_income, operating_cash_flow,
          capital_expenditure, total_assets, stockholders_equity, total_debt,
          diluted_eps, gross_profit, cost_of_revenue, ebitda,
          accounts_receivable, inventory, accounts_payable, market_cap,
          enterprise_value, forward_pe, source, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, 'yahoo', now()
        )
        ON CONFLICT (ticker, date)
        DO UPDATE SET
          total_revenue = EXCLUDED.total_revenue,
          net_income = EXCLUDED.net_income,
          operating_cash_flow = EXCLUDED.operating_cash_flow,
          capital_expenditure = EXCLUDED.capital_expenditure,
          total_assets = EXCLUDED.total_assets,
          stockholders_equity = EXCLUDED.stockholders_equity,
          total_debt = EXCLUDED.total_debt,
          diluted_eps = EXCLUDED.diluted_eps,
          gross_profit = EXCLUDED.gross_profit,
          cost_of_revenue = EXCLUDED.cost_of_revenue,
          ebitda = EXCLUDED.ebitda,
          accounts_receivable = EXCLUDED.accounts_receivable,
          inventory = EXCLUDED.inventory,
          accounts_payable = EXCLUDED.accounts_payable,
          market_cap = EXCLUDED.market_cap,
          enterprise_value = EXCLUDED.enterprise_value,
          forward_pe = EXCLUDED.forward_pe,
          source = EXCLUDED.source,
          updated_at = now()
      `,
      [
        row.ticker,
        row.date,
        row.total_revenue,
        row.net_income,
        row.operating_cash_flow,
        row.capital_expenditure,
        row.total_assets,
        row.stockholders_equity,
        row.total_debt,
        row.diluted_eps,
        row.gross_profit,
        row.cost_of_revenue,
        row.ebitda,
        row.accounts_receivable,
        row.inventory,
        row.accounts_payable,
        row.market_cap,
        row.enterprise_value,
        row.forward_pe,
      ],
    );
    count += 1;
  }
  return count;
}

function secUserAgent(): string {
  return process.env.SEC_USER_AGENT ?? "Invest-Lens hackathon data loader contact@example.com";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": secUserAgent(),
    },
  });
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function secTickerKeys(ticker: string): string[] {
  const upper = ticker.toUpperCase();
  return [upper, upper.replace("-", "."), upper.replace(".", "-")];
}

async function fetchSecTickerMap(): Promise<Map<string, SecTickerRow>> {
  const payload = await fetchJson<Record<string, SecTickerRow>>(
    "https://www.sec.gov/files/company_tickers.json",
  );
  return new Map(Object.values(payload).map((row) => [row.ticker.toUpperCase(), row]));
}

function secFrameForDate(date: string): string {
  const month = Number(date.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `CY${date.slice(0, 4)}Q${quarter}`;
}

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endTime - startTime) / (24 * 60 * 60 * 1000));
}

function secDerivedCalendarQ4Point(
  metric: SecFactMetric | undefined,
  tag: string,
  date: string,
): { value: number; tag: string } | null {
  if (!date.endsWith("-12-31")) return null;
  const points = metric?.units?.USD ?? [];
  const year = date.slice(0, 4);
  const annual = points.find(
    (point) =>
      point.end === date &&
      point.frame === `CY${year}` &&
      (point.form === "10-K" || point.form === "10-Q") &&
      typeof point.val === "number" &&
      Number.isFinite(point.val),
  );
  if (!annual?.val) return null;

  const quarters = [1, 2, 3].map((quarter) =>
    points.find(
      (point) =>
        point.frame === `CY${year}Q${quarter}` &&
        (point.form === "10-Q" || point.form === "10-K") &&
        typeof point.val === "number" &&
        Number.isFinite(point.val),
    ),
  );
  if (quarters.some((point) => point?.val === undefined)) return null;

  const priorQuarterSum = quarters.reduce((acc, point) => acc + (point?.val ?? 0), 0);
  const value = annual.val - priorQuarterSum;
  if (!Number.isFinite(value)) return null;
  return { value, tag: `${tag}:derived-q4` };
}

function secFactPoint(
  facts: SecCompanyFacts,
  tags: readonly string[],
  date: string,
): { value: number; tag: string } | null {
  const usGaap = facts.facts?.["us-gaap"] ?? {};
  const expectedFrame = secFrameForDate(date);

  for (const tag of tags) {
    const points = usGaap[tag]?.units?.USD ?? [];
    const candidates = points.filter(
      (point) =>
        point.end === date &&
        (point.form === "10-Q" || point.form === "10-K") &&
        typeof point.val === "number" &&
        Number.isFinite(point.val),
    );
    const framed = candidates.find((point) => point.frame === expectedFrame);
    if (framed?.val !== undefined) return { value: framed.val, tag };

    const quarterLike = candidates
      .filter((point) => point.start)
      .map((point) => ({ point, duration: daysBetween(point.start ?? "", date) }))
      .filter(({ duration }) => duration >= 60 && duration <= 120)
      .sort((a, b) => a.duration - b.duration);
    const selected = quarterLike[0]?.point;
    if (selected?.val !== undefined) return { value: selected.val, tag };

    const derivedQ4 = secDerivedCalendarQ4Point(usGaap[tag], tag, date);
    if (derivedQ4) return derivedQ4;
  }

  return null;
}

function secQuarterRow(
  ticker: string,
  date: string,
  facts: SecCompanyFacts,
): SecQuarterRow | null {
  const revenue = secFactPoint(facts, SEC_REVENUE_TAGS, date);
  if (!revenue || revenue.value <= 0) return null;

  const grossProfit = secFactPoint(facts, SEC_GROSS_PROFIT_TAGS, date);
  const costOfRevenue = secFactPoint(facts, SEC_COST_OF_REVENUE_TAGS, date);
  const grossProfitValue = grossProfit?.value ?? (costOfRevenue ? revenue.value - costOfRevenue.value : null);
  const grossMargin = grossMarginRatio(grossProfitValue, revenue.value);
  if (grossMargin === null) return null;

  return {
    ticker,
    date,
    total_revenue: revenue.value,
    gross_profit: grossProfit?.value ?? null,
    cost_of_revenue: costOfRevenue?.value ?? null,
    revenue_tag: revenue.tag,
    gross_profit_tag: grossProfit?.tag ?? null,
    cost_of_revenue_tag: costOfRevenue?.tag ?? null,
  };
}

async function secSupplementTargets(
  client: pg.Client,
  scope: "latest" | "all",
): Promise<SecSupplementTarget[]> {
  const scopeFilter =
    scope === "latest"
      ? `
        WITH scoped_fundamentals AS (
          SELECT DISTINCT ON (sf.ticker) sf.*
          FROM public.stock_fundamentals sf
          ORDER BY sf.ticker, sf.date DESC
        )
      `
      : `
        WITH scoped_fundamentals AS (
          SELECT *
          FROM public.stock_fundamentals
        )
      `;

  const result = await client.query<SecSupplementTarget>(`
    ${scopeFilter},
    raw_gm AS (
      SELECT ticker, date, COALESCE(gross_profit, total_revenue - cost_of_revenue) / NULLIF(total_revenue, 0) AS gm
      FROM public.stock_fundamental_raw_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
      UNION ALL
      SELECT ticker, date, COALESCE(gross_profit, total_revenue - cost_of_revenue) / NULLIF(total_revenue, 0) AS gm
      FROM public.stock_fundamental_sec_quarterly
      WHERE total_revenue IS NOT NULL
        AND total_revenue > 0
        AND (gross_profit IS NOT NULL OR cost_of_revenue IS NOT NULL)
    ),
    target_dates AS (
      SELECT sf.ticker, sf.date, cm.sector
      FROM scoped_fundamentals sf
      JOIN public.company_master cm ON cm.ticker = sf.ticker
      LEFT JOIN raw_gm current_row ON current_row.ticker = sf.ticker AND current_row.date = sf.date
      WHERE cm.sector <> 'Financials'
        AND sf.gross_margin IS NULL
        AND current_row.gm IS NULL
      UNION
      SELECT sf.ticker, (sf.date - INTERVAL '1 year')::date AS date, cm.sector
      FROM scoped_fundamentals sf
      JOIN public.company_master cm ON cm.ticker = sf.ticker
      LEFT JOIN raw_gm current_row ON current_row.ticker = sf.ticker AND current_row.date = sf.date
      LEFT JOIN raw_gm previous_row
        ON previous_row.ticker = sf.ticker
       AND previous_row.date = (sf.date - INTERVAL '1 year')::date
      WHERE cm.sector <> 'Financials'
        AND sf.gross_margin_yoy IS NULL
        AND current_row.gm IS NOT NULL
        AND previous_row.gm IS NULL
    )
    SELECT DISTINCT ticker, date, sector
    FROM target_dates
    WHERE date >= DATE '2020-01-01'
    ORDER BY ticker, date
  `);
  return result.rows;
}

async function upsertSecQuarter(client: pg.Client, row: SecQuarterRow): Promise<void> {
  await client.query(
    `
      INSERT INTO public.stock_fundamental_sec_quarterly (
        ticker, date, total_revenue, gross_profit, cost_of_revenue,
        revenue_tag, gross_profit_tag, cost_of_revenue_tag, source, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sec-companyfacts', now())
      ON CONFLICT (ticker, date)
      DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        gross_profit = EXCLUDED.gross_profit,
        cost_of_revenue = EXCLUDED.cost_of_revenue,
        revenue_tag = EXCLUDED.revenue_tag,
        gross_profit_tag = EXCLUDED.gross_profit_tag,
        cost_of_revenue_tag = EXCLUDED.cost_of_revenue_tag,
        source = EXCLUDED.source,
        updated_at = now()
    `,
    [
      row.ticker,
      row.date,
      row.total_revenue,
      row.gross_profit,
      row.cost_of_revenue,
      row.revenue_tag,
      row.gross_profit_tag,
      row.cost_of_revenue_tag,
    ],
  );
}

async function supplementSecGrossMargins(
  client: pg.Client,
  scope: "latest" | "all",
): Promise<{ targets: number; ok: number; failed: number; upserted: number }> {
  const targets = await secSupplementTargets(client, scope);
  if (targets.length === 0) return { targets: 0, ok: 0, failed: 0, upserted: 0 };

  const tickerMap = await fetchSecTickerMap();
  const targetsByTicker = new Map<string, SecSupplementTarget[]>();
  for (const target of targets) {
    const rows = targetsByTicker.get(target.ticker) ?? [];
    rows.push(target);
    targetsByTicker.set(target.ticker, rows);
  }

  let ok = 0;
  let failed = 0;
  let upserted = 0;
  for (const [ticker, tickerTargets] of targetsByTicker) {
    const secTicker = secTickerKeys(ticker).map((key) => tickerMap.get(key)).find(Boolean);
    if (!secTicker) {
      failed += tickerTargets.length;
      continue;
    }

    try {
      const cik = String(secTicker.cik_str).padStart(10, "0");
      const facts = await fetchJson<SecCompanyFacts>(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      );
      for (const target of tickerTargets) {
        const row = secQuarterRow(ticker, target.date, facts);
        if (!row) {
          failed += 1;
          continue;
        }
        await upsertSecQuarter(client, row);
        ok += 1;
        upserted += 1;
      }
    } catch (error) {
      failed += tickerTargets.length;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[sec-fundamentals] ${ticker}: ${message}`);
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
  }

  return { targets: targets.length, ok, failed, upserted };
}

async function updateRow(
  client: pg.Client,
  row: FundamentalRow,
  metrics: NumericRecord,
): Promise<FundamentalField[]> {
  const fieldsToFill = fillableFields(row, metrics);
  if (fieldsToFill.length === 0) return [];

  const assignments = fieldsToFill.map((field, index) =>
    OVERWRITE_WHEN_RECOMPUTED_FIELDS.has(field)
      ? `${field} = $${index + 1}`
      : `${field} = COALESCE(${field}, $${index + 1})`,
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
  return FUNDAMENTAL_FIELDS.filter((field) => {
    const metric = metrics[field];
    if (metric === null || metric === undefined) return false;
    const current = row[field];
    if (current === null || current === undefined) return true;
    if (!OVERWRITE_WHEN_RECOMPUTED_FIELDS.has(field)) return false;
    return Math.abs(current - metric) > 1e-12;
  });
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
        if (NO_CARRY_FILL_FIELDS.has(field)) continue;
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
        if (NO_CARRY_FILL_FIELDS.has(field)) continue;
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

function percentile(sortedValues: number[], percentileValue: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower] ?? null;
  const lowerValue = sortedValues[lower];
  const upperValue = sortedValues[upper];
  if (lowerValue === undefined || upperValue === undefined) return null;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function refreshSectorStats(client: pg.Client): Promise<number> {
  const metrics = [
    "per",
    "pbr",
    "ev_ebitda",
    "pbr_z_score",
    "forward_per_z_score",
    "gross_margin",
    "revenue_growth",
    "eps_growth",
    "ccc",
  ] as const;
  const result = await client.query<{
    date: string;
    sector: string;
    per: number | null;
    pbr: number | null;
    ev_ebitda: number | null;
    pbr_z_score: number | null;
    forward_per_z_score: number | null;
    gross_margin: number | null;
    revenue_growth: number | null;
    eps_growth: number | null;
    ccc: number | null;
  }>(`
    SELECT
      sf.date,
      cm.sector,
      sf.per,
      sf.pbr,
      sf.ev_ebitda,
      sf.pbr_z_score,
      sf.forward_per_z_score,
      sf.gross_margin,
      sf.revenue_growth,
      sf.eps_growth,
      sf.ccc
    FROM public.stock_fundamentals sf
    JOIN public.company_master cm ON cm.ticker = sf.ticker
    WHERE cm.sector IS NOT NULL
  `);

  const grouped = new Map<string, number[]>();
  for (const row of result.rows) {
    for (const metric of metrics) {
      const value = row[metric];
      if (value === null || !Number.isFinite(value)) continue;
      const key = `${row.date}|${row.sector}|${metric}`;
      const values = grouped.get(key) ?? [];
      values.push(value);
      grouped.set(key, values);
    }
  }

  let count = 0;
  for (const [key, values] of grouped) {
    const [date, sector, metric] = key.split("|") as [string, string, string];
    const sorted = [...values].sort((a, b) => a - b);
    const p10 = percentile(sorted, 0.1);
    const median = percentile(sorted, 0.5);
    const p90 = percentile(sorted, 0.9);
    const avgValue = average(sorted);
    const winsorized =
      p10 === null || p90 === null
        ? null
        : average(sorted.map((value) => clampNumber(value, p10, p90)));

    await client.query(
      `
        INSERT INTO public.stock_fundamental_sector_stats (
          date, sector, metric, sample_size, avg_value, median_value,
          p10_value, p90_value, winsorized_avg, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        ON CONFLICT (date, sector, metric)
        DO UPDATE SET
          sample_size = EXCLUDED.sample_size,
          avg_value = EXCLUDED.avg_value,
          median_value = EXCLUDED.median_value,
          p10_value = EXCLUDED.p10_value,
          p90_value = EXCLUDED.p90_value,
          winsorized_avg = EXCLUDED.winsorized_avg,
          updated_at = now()
      `,
      [date, sector, metric, sorted.length, avgValue, median, p10, p90, winsorized],
    );
    count += 1;
  }

  return count;
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
  const secSupplement = flag("--sec-supplement");
  const secScopeOption = option("--sec-scope", "latest");
  const secScope = secScopeOption === "all" ? "all" : "latest";
  const dryRun = flag("--dry-run");

  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();

  try {
    if (!dryRun) {
      await ensureFundamentalSchema(client);
      await cleanFundamentalOutliers(client);
    }

    const tickersToLoad = await tickers(client, requestedTickers, limit);
    const rows = await existingRows(client, tickersToLoad);
    const rowsByTickerDate = new Map(rows.map((row) => [`${row.ticker}:${row.date}`, row]));
    const metricsByTickerDate = new Map<string, NumericRecord>();
    const rawQuartersByTicker = new Map<string, RawQuarter[]>();
    const externalFilled = blankCounts();
    const summary: Summary = {
      tickers: tickersToLoad.length,
      yahooOk: 0,
      yahooFailed: 0,
      secTargets: 0,
      secOk: 0,
      secFailed: 0,
      secRowsUpserted: 0,
      rowsTouched: 0,
      rawRowsUpserted: 0,
      sectorStatsUpserted: 0,
      growthRowsRefreshed: {
        revenue_growth: 0,
        eps_growth: 0,
        stale_revenue_growth: 0,
        stale_eps_growth: 0,
      },
      grossMarginRowsRefreshed: 0,
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
          rawQuartersByTicker.set(ticker, raw);
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

    if (!dryRun) {
      for (const [ticker, raw] of rawQuartersByTicker) {
        summary.rawRowsUpserted += await upsertRawQuarters(client, ticker, raw);
      }
      if (secSupplement) {
        const secResult = await supplementSecGrossMargins(client, secScope);
        summary.secTargets = secResult.targets;
        summary.secOk = secResult.ok;
        summary.secFailed = secResult.failed;
        summary.secRowsUpserted = secResult.upserted;
      }
    }

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

    if (!dryRun) {
      summary.growthRowsRefreshed = await refreshGrowthFromRaw(client);
      summary.grossMarginRowsRefreshed = await refreshGrossMarginFromRaw(client);
    }

    const refreshedRows = await existingRows(client, tickersToLoad);
    if (!dryRun) {
      summary.carryFilled = await carryFillRows(client, refreshedRows);
      summary.remainingNulls = await remainingNulls(client, tickersToLoad);
      summary.latestCoverage = await latestCoverage(client, tickersToLoad);
      summary.sectorStatsUpserted = await refreshSectorStats(client);
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
