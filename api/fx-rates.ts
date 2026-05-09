// /api/fx-rates?pair=USDKRW&range=1mo
//
// 환율 시계열 — DB 부재 회피 위해 Yahoo Finance chart API 프록시.
// pair 형식: USDKRW / USDJPY / EURUSD ... — Yahoo 의 "<pair>=X" symbol 로 변환.

import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { ApiError, assertGet, getQueryString, sendData, sendError } from "./_lib/http.js";

const ALLOWED_PAIRS: Record<string, { yahoo: string; label: string }> = {
  USDKRW: { yahoo: "KRW=X", label: "미국 달러 → 원화" },
  USDJPY: { yahoo: "JPY=X", label: "미국 달러 → 엔화" },
  USDEUR: { yahoo: "EUR=X", label: "미국 달러 → 유로" },
  USDCNY: { yahoo: "CNY=X", label: "미국 달러 → 위안화" },
  EURUSD: { yahoo: "EURUSD=X", label: "유로 → 미국 달러" },
};

const ALLOWED_RANGES = new Set(["5d", "1mo", "3mo", "6mo", "1y"]);

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
}

interface YahooChartResult {
  meta?: { regularMarketPrice?: number };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
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

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.yahoo)}?range=${range}&interval=1d`;
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
    };

    if (res.setHeader) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    }
    sendData(res, payload);
  } catch (e) {
    sendError(res, e);
  }
}
