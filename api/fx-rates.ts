// /api/fx-rates?pair=USDKRW&range=1mo
//
// 환율 시계열 — 2026-05 DB 보강(public.fx_rates) 으로 DB 우선 조회.
// DB miss 시 Yahoo Finance chart API fallback.
//
// pair 형식 (FE → BE):
//   USDKRW, USDJPY, USDEUR, USDCNY, EURUSD
// DB pair 형식 (slash 포함): USD/KRW, USD/JPY, USD/CNY, EUR/USD
//   USDEUR 는 DB 부재 → EUR/USD invert.

import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { ApiError, assertGet, getQueryString, sendData, sendError } from "./_lib/http.js";

interface PairConfig {
  yahoo: string;
  label: string;
  /** DB.fx_rates.pair 값 */
  db: string;
  /** DB rate 가 inverse pair 라서 1/x 로 뒤집어야 하면 true */
  invert?: boolean;
}

const ALLOWED_PAIRS: Record<string, PairConfig> = {
  USDKRW: { yahoo: "KRW=X", label: "미국 달러 → 원화", db: "USD/KRW" },
  USDJPY: { yahoo: "JPY=X", label: "미국 달러 → 엔화", db: "USD/JPY" },
  USDEUR: { yahoo: "EUR=X", label: "미국 달러 → 유로", db: "EUR/USD", invert: true },
  USDCNY: { yahoo: "CNY=X", label: "미국 달러 → 위안화", db: "USD/CNY" },
  EURUSD: { yahoo: "EURUSD=X", label: "유로 → 미국 달러", db: "EUR/USD" },
};

const ALLOWED_RANGES = new Set(["5d", "1mo", "3mo", "6mo", "1y"]);

const RANGE_DAYS: Record<string, number> = {
  "5d": 7,
  "1mo": 35,
  "3mo": 100,
  "6mo": 190,
  "1y": 370,
};

interface FxPoint {
  date: string;
  close: number;
}

interface FxResponse {
  pair: string;
  yahooSymbol: string;
  label: string;
  latest: FxPoint | null;
  previous: FxPoint | null;
  delta: number | null;
  pct: number | null;
  history: FxPoint[];
  source: "db" | "yahoo";
}

interface YahooChartResult {
  meta?: { regularMarketPrice?: number };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}

interface FxRow {
  date: string | Date;
  rate: string | number | null;
}

async function tryDb(
  config: PairConfig,
  rangeDays: number,
): Promise<FxPoint[]> {
  const rows = await query<FxRow>(
    `
      SELECT date, rate
      FROM public.fx_rates
      WHERE pair = $1
        AND rate IS NOT NULL
        AND date >= CURRENT_DATE - $2::int
      ORDER BY date DESC
    `,
    [config.db, rangeDays],
  );
  const points: FxPoint[] = [];
  for (const r of rows) {
    const v = typeof r.rate === "string" ? Number(r.rate) : r.rate;
    if (v == null || !Number.isFinite(v) || v === 0) continue;
    const date = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date;
    points.push({ date, close: config.invert ? 1 / v : v });
  }
  return points;
}

async function fetchYahoo(yahooSymbol: string, range: string): Promise<FxPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=1d`;
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
  const points: FxPoint[] = [];
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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const pair = getQueryString(req, "pair", "USDKRW").trim().toUpperCase();
    const range = getQueryString(req, "range", "1mo").trim();

    const config = ALLOWED_PAIRS[pair];
    if (!config) {
      throw new ApiError(`unsupported pair: ${pair}`, 400);
    }
    if (!ALLOWED_RANGES.has(range)) {
      throw new ApiError(`unsupported range: ${range}`, 400);
    }

    let points: FxPoint[] = [];
    let source: "db" | "yahoo" = "db";
    try {
      points = await tryDb(config, RANGE_DAYS[range] ?? 35);
    } catch (e) {
      console.warn("[fx-rates] DB miss, fallback Yahoo:", e);
    }

    if (points.length === 0) {
      points = await fetchYahoo(config.yahoo, range);
      source = "yahoo";
    }

    const latest = points[0] ?? null;
    const previous = points[1] ?? null;
    const delta = latest && previous ? latest.close - previous.close : null;
    const pct =
      latest && previous && previous.close !== 0
        ? (delta! / previous.close) * 100
        : null;

    const payload: FxResponse = {
      pair,
      yahooSymbol: config.yahoo,
      label: config.label,
      latest,
      previous,
      delta,
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
