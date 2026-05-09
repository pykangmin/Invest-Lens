import type { FxRatePoint, MarketIndexPoint } from "../../src/types/investment.js";

export interface YahooDailyPoint {
  date: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface MarketIndexRow {
  symbol: string;
  name: string;
  date: string | Date;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  source: string | null;
  is_filled: boolean | null;
  source_date: string | Date | null;
}

export interface FxRateRow {
  pair: string;
  base_currency: string;
  quote_currency: string;
  date: string | Date;
  rate: number;
  open: number | null;
  high: number | null;
  low: number | null;
  source: string | null;
  is_filled: boolean | null;
  source_date: string | Date | null;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }> | null;
    error?: { description?: string } | null;
  };
}

function dateString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function nullableDateString(value: string | Date | null): string | null {
  if (value === null) return null;
  return dateString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isBusinessDay(value: Date): boolean {
  const day = value.getUTCDay();
  return day !== 0 && day !== 6;
}

export async function fetchYahooDaily(
  yahooSymbol: string,
  range = "2y",
): Promise<YahooDailyPoint[]> {
  const encoded = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${encodeURIComponent(range)}&interval=1d`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart fetch failed for ${yahooSymbol}: ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close ?? [];

  if (!result || timestamps.length === 0 || closes.length === 0) {
    const reason = payload.chart?.error?.description ?? "empty chart response";
    throw new Error(`Yahoo chart fetch failed for ${yahooSymbol}: ${reason}`);
  }

  const rows: YahooDailyPoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (!isFiniteNumber(close)) continue;
    rows.push({
      date: new Date(timestamps[i]! * 1000).toISOString().slice(0, 10),
      close,
      open: isFiniteNumber(quote?.open?.[i]) ? quote!.open![i]! : null,
      high: isFiniteNumber(quote?.high?.[i]) ? quote!.high![i]! : null,
      low: isFiniteNumber(quote?.low?.[i]) ? quote!.low![i]! : null,
      volume: isFiniteNumber(quote?.volume?.[i]) ? quote!.volume![i]! : null,
    });
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function fillBusinessDayGaps<T extends { date: string }>(
  rowsDesc: T[],
  makeFilled: (previous: T, date: string) => T,
  maxGapBusinessDays = 3,
): T[] {
  const rowsAsc = [...rowsDesc].sort((a, b) => (a.date > b.date ? 1 : -1));
  const output: T[] = [];

  for (const row of rowsAsc) {
    const previous = output[output.length - 1];
    if (previous) {
      const missingDates: string[] = [];
      let cursor = addDays(toUtcDate(previous.date), 1);
      const end = toUtcDate(row.date);

      while (cursor < end) {
        if (isBusinessDay(cursor)) missingDates.push(toDateString(cursor));
        cursor = addDays(cursor, 1);
      }

      if (missingDates.length > 0 && missingDates.length <= maxGapBusinessDays) {
        for (const missingDate of missingDates) {
          output.push(makeFilled(previous, missingDate));
        }
      }
    }

    output.push(row);
  }

  return output.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function marketIndexFromYahoo(
  symbol: string,
  name: string,
  rows: YahooDailyPoint[],
  limit: number,
): MarketIndexPoint[] {
  const mapped: MarketIndexPoint[] = rows.map((row) => ({
    symbol,
    name,
    date: row.date,
    close: row.close,
    open: row.open,
    high: row.high,
    low: row.low,
    volume: row.volume,
    source: "yahoo",
    isFilled: false,
    sourceDate: null,
  }));

  return fillBusinessDayGaps(mapped, (previous, date) => ({
    ...previous,
    date,
    open: previous.close,
    high: previous.close,
    low: previous.close,
    volume: null,
    isFilled: true,
    sourceDate: previous.date,
  })).slice(0, limit);
}

export function fxRateFromYahoo(
  pair: string,
  baseCurrency: string,
  quoteCurrency: string,
  rows: YahooDailyPoint[],
  limit: number,
): FxRatePoint[] {
  const mapped: FxRatePoint[] = rows.map((row) => ({
    pair,
    baseCurrency,
    quoteCurrency,
    date: row.date,
    rate: row.close,
    open: row.open,
    high: row.high,
    low: row.low,
    source: "yahoo",
    isFilled: false,
    sourceDate: null,
  }));

  return fillBusinessDayGaps(mapped, (previous, date) => ({
    ...previous,
    date,
    open: previous.rate,
    high: previous.rate,
    low: previous.rate,
    isFilled: true,
    sourceDate: previous.date,
  })).slice(0, limit);
}

export function mapMarketIndexRow(row: MarketIndexRow): MarketIndexPoint {
  return {
    symbol: row.symbol,
    name: row.name,
    date: dateString(row.date),
    close: row.close,
    open: row.open,
    high: row.high,
    low: row.low,
    volume: row.volume,
    source: row.source ?? "db",
    isFilled: row.is_filled ?? false,
    sourceDate: nullableDateString(row.source_date),
  };
}

export function mapFxRateRow(row: FxRateRow): FxRatePoint {
  return {
    pair: row.pair,
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    date: dateString(row.date),
    rate: row.rate,
    open: row.open,
    high: row.high,
    low: row.low,
    source: row.source ?? "db",
    isFilled: row.is_filled ?? false,
    sourceDate: nullableDateString(row.source_date),
  };
}
