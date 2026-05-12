// /api/market-index?symbol=^GSPC&range=1mo          (index close-only)
// /api/market-index?kind=stockOhlc&ticker=AAPL&range=3mo  (stock OHLC + volume)
//
// 시장지수 시계열 — 2026-05 DB 보강(public.market_index_prices) 으로 DB 우선 조회.
// DB miss 시 Yahoo Finance 비공식 chart API fallback.
//
// 2026-05 Hobby plan 12 함수 제한 회피 — stockOhlc 분기는 stock_price_tech 에
// open/high/low 컬럼 부재로 Yahoo 직통. ticker 화이트리스트 없이 형태만 검증.

import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { ApiError, assertGet, getQueryString, sendData, sendError } from "./_lib/http.js";

const ALLOWED_SYMBOLS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "Nasdaq Composite",
  "^RUT": "Russell 2000",
};

const ALLOWED_RANGES = new Set(["5d", "1mo", "3mo", "6mo", "1y", "5y"]);

const RANGE_DAYS: Record<string, number> = {
  "5d": 7,
  "1mo": 35,
  "3mo": 100,
  "6mo": 190,
  "1y": 370,
  "5y": 1850,
};

interface IndexPoint {
  date: string;
  close: number;
}

interface IndexResponse {
  symbol: string;
  name: string;
  latest: IndexPoint | null;
  previous: IndexPoint | null;
  pct: number | null;
  history: IndexPoint[];
  source: "db" | "yahoo";
}

interface YahooChartResult {
  meta?: { longName?: string; regularMarketPrice?: number };
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
}

// stockOhlc 응답 — DESC (최신 [0])
interface StockOhlcPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

interface StockOhlcResponse {
  ticker: string;
  range: string;
  history: StockOhlcPoint[];
  source: "yahoo";
}

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

interface MarketIndexRow {
  date: string | Date;
  close: string | number | null;
}

async function tryDb(symbol: string, rangeDays: number): Promise<IndexPoint[]> {
  const rows = await query<MarketIndexRow>(
    `
      SELECT date, close
      FROM public.market_index_prices
      WHERE symbol = $1
        AND close IS NOT NULL
        AND date >= CURRENT_DATE - $2::int
      ORDER BY date DESC
    `,
    [symbol, rangeDays],
  );
  const points: IndexPoint[] = [];
  for (const r of rows) {
    const v = typeof r.close === "string" ? Number(r.close) : r.close;
    if (v == null || !Number.isFinite(v)) continue;
    const date = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date;
    points.push({ date, close: v });
  }
  return points;
}

async function fetchYahoo(symbol: string, range: string): Promise<IndexPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; InvestLens/1.0)",
      Accept: "application/json",
    },
  });
  if (!upstream.ok) {
    throw new ApiError(`yahoo upstream ${upstream.status}`, 502);
  }
  const json = (await upstream.json()) as { chart?: { result?: YahooChartResult[] } };
  const result = json.chart?.result?.[0];
  if (!result) {
    throw new ApiError("invalid yahoo response", 502);
  }
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: IndexPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    points.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close: c,
    });
  }
  points.reverse();
  return points;
}

const ALLOWED_INTERVALS = new Set(["1d", "1h"]);

async function fetchStockOhlc(ticker: string, range: string, interval: string): Promise<StockOhlcPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; InvestLens/1.0)",
      Accept: "application/json",
    },
  });
  if (!upstream.ok) {
    throw new ApiError(`yahoo upstream ${upstream.status}`, 502);
  }
  const json = (await upstream.json()) as { chart?: { result?: YahooChartResult[] } };
  const result = json.chart?.result?.[0];
  if (!result) {
    throw new ApiError("invalid yahoo response", 502);
  }
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  const closes = q?.close ?? [];
  const opens = q?.open ?? [];
  const highs = q?.high ?? [];
  const lows = q?.low ?? [];
  const vols = q?.volume ?? [];
  // 1d: 날짜 (yyyy-mm-dd). 1h: 전체 ISO datetime (intraday 정렬·집계용).
  const isIntraday = interval !== "1d";
  const points: StockOhlcPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    const d = new Date(ts[i]! * 1000);
    const dateStr = isIntraday ? d.toISOString() : d.toISOString().slice(0, 10);
    points.push({
      date: dateStr,
      open: typeof opens[i] === "number" && Number.isFinite(opens[i]) ? (opens[i] as number) : null,
      high: typeof highs[i] === "number" && Number.isFinite(highs[i]) ? (highs[i] as number) : null,
      low: typeof lows[i] === "number" && Number.isFinite(lows[i]) ? (lows[i] as number) : null,
      close: c as number,
      volume: typeof vols[i] === "number" && Number.isFinite(vols[i]) ? (vols[i] as number) : null,
    });
  }
  points.reverse(); // DESC
  return points;
}

async function handleStockOhlc(req: ApiRequest, res: ApiResponse): Promise<void> {
  const ticker = getQueryString(req, "ticker").trim().toUpperCase();
  const range = getQueryString(req, "range", "3mo").trim();
  const interval = getQueryString(req, "interval", "1d").trim();
  if (!TICKER_RE.test(ticker)) {
    throw new ApiError(`invalid ticker: ${ticker}`, 400);
  }
  if (!ALLOWED_RANGES.has(range)) {
    throw new ApiError(`unsupported range: ${range}`, 400);
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    throw new ApiError(`unsupported interval: ${interval}`, 400);
  }
  const history = await fetchStockOhlc(ticker, range, interval);
  if (res.setHeader) {
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
  }
  sendData(res, {
    ticker,
    range,
    history,
    source: "yahoo",
  } satisfies StockOhlcResponse);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const kind = getQueryString(req, "kind", "").trim();
    if (kind === "stockOhlc") {
      await handleStockOhlc(req, res);
      return;
    }

    const symbol = getQueryString(req, "symbol", "^GSPC").trim();
    const range = getQueryString(req, "range", "1mo").trim();

    if (!ALLOWED_SYMBOLS[symbol]) {
      throw new ApiError(`unsupported symbol: ${symbol}`, 400);
    }
    if (!ALLOWED_RANGES.has(range)) {
      throw new ApiError(`unsupported range: ${range}`, 400);
    }

    let points: IndexPoint[] = [];
    let source: "db" | "yahoo" = "db";
    try {
      points = await tryDb(symbol, RANGE_DAYS[range] ?? 35);
    } catch (e) {
      console.warn("[market-index] DB miss, fallback Yahoo:", e);
    }
    if (points.length === 0) {
      points = await fetchYahoo(symbol, range);
      source = "yahoo";
    }

    const latest = points[0] ?? null;
    const previous = points[1] ?? null;
    const pct =
      latest && previous && previous.close !== 0
        ? ((latest.close - previous.close) / previous.close) * 100
        : null;

    const payload: IndexResponse = {
      symbol,
      name: ALLOWED_SYMBOLS[symbol],
      latest,
      previous,
      pct,
      history: points,
      source,
    };

    if (res.setHeader) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    }
    sendData(res, payload);
  } catch (e) {
    sendError(res, e);
  }
}
