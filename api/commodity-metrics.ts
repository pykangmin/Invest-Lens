import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http.js";
import type {
  CommodityMetricPoint,
  CommodityMetricsResponse,
} from "../src/types/investment.js";

const DEFAULT_COMMODITY_SYMBOLS = [
  "CL=F",
  "NG=F",
  "GC=F",
  "SI=F",
  "HG=F",
  "ZW=F",
  "ZC=F",
  "ZS=F",
  "LIT",
  "REMX",
] as const;

interface CommodityMetricRow {
  symbol: string;
  date: string | Date;
  close: number;
  volume: number | null;
  category: string | null;
  unit: string | null;
}

function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mapMetric(symbol: string, rows: CommodityMetricRow[]): CommodityMetricPoint {
  const sorted = [...rows].sort((a, b) =>
    toDateString(a.date) < toDateString(b.date) ? -1 : 1,
  );
  const first = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;
  const logReturns: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (previous.close > 0 && current.close > 0) {
      logReturns.push(Math.log(current.close / previous.close));
    }
  }

  const dailyVolatility = stdev(logReturns);
  const volumes = sorted
    .map((row) => row.volume)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  return {
    symbol,
    category: latest.category,
    unit: latest.unit,
    latestDate: toDateString(latest.date),
    latestClose: latest.close,
    startDate: toDateString(first.date),
    startClose: first.close,
    returnPct:
      first.close === 0 ? null : ((latest.close - first.close) / first.close) * 100,
    annualizedVolatilityPct:
      dailyVolatility === null ? null : dailyVolatility * Math.sqrt(252) * 100,
    averageVolume: average(volumes),
    sampleSize: sorted.length,
    bubbleSize: 24,
  };
}

function addBubbleSizes(items: CommodityMetricPoint[]): CommodityMetricPoint[] {
  const scores = items.map(
    (item) =>
      item.averageVolume ??
      item.annualizedVolatilityPct ??
      item.sampleSize,
  );
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return items.map((item, index) => {
    const score = scores[index]!;
    const bubbleSize = min === max ? 24 : 12 + ((score - min) / (max - min)) * 28;
    return {
      ...item,
      bubbleSize: Math.round(bubbleSize * 10) / 10,
    };
  });
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const symbol = getQueryString(req, "symbol").trim();
    const lookbackDays = getQueryInt(req, "lookbackDays", 252, 20, 2_000);
    const symbols = symbol ? [symbol] : [...DEFAULT_COMMODITY_SYMBOLS];

    const rows = await query<CommodityMetricRow>(
      `
        SELECT symbol, date, close, volume, category, unit
        FROM (
          SELECT
            symbol,
            date,
            close,
            volume,
            category,
            unit,
            ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
          FROM public.commodity_prices
          WHERE symbol = ANY($1::text[])
            AND close IS NOT NULL
            AND close > 0
        ) ranked
        WHERE rn <= $2
        ORDER BY symbol, date ASC
      `,
      [symbols, lookbackDays],
    );

    const bySymbol = new Map<string, CommodityMetricRow[]>();
    for (const row of rows) {
      const current = bySymbol.get(row.symbol) ?? [];
      current.push(row);
      bySymbol.set(row.symbol, current);
    }

    const items = addBubbleSizes(
      symbols
        .map((currentSymbol) => {
          const currentRows = bySymbol.get(currentSymbol) ?? [];
          return currentRows.length > 0
            ? mapMetric(currentSymbol, currentRows)
            : null;
        })
        .filter((item): item is CommodityMetricPoint => item !== null),
    );

    const payload: CommodityMetricsResponse = {
      lookbackDays,
      items,
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
