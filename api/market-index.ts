// /api/market-index?symbol=^GSPC&range=1mo
//
// 시장지수 시계열 조회 — DB 부재 회피 위해 Yahoo Finance 비공식 chart API 프록시.
// 현재 DB 의 global_environment 에는 ^GSPC 등 시장지수 시계열이 없으므로 외부 fetch.
// 추후 ingest-market-data 가 DB 에 적재하면 이 핸들러를 DB-우선으로 전환 가능.
//
// 응답 형식:
//   { data: { symbol, name, latest: {date, close}, previous: {date, close}, history: [...] } }

import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { ApiError, assertGet, getQueryString, sendData, sendError } from "./_lib/http.js";

const ALLOWED_SYMBOLS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "Nasdaq Composite",
  "^RUT": "Russell 2000",
};

const ALLOWED_RANGES = new Set(["5d", "1mo", "3mo", "6mo", "1y", "5y"]);

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
}

interface YahooChartResult {
  meta?: { longName?: string; regularMarketPrice?: number };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const symbol = getQueryString(req, "symbol", "^GSPC").trim();
    const range = getQueryString(req, "range", "1mo").trim();

    if (!ALLOWED_SYMBOLS[symbol]) {
      throw new ApiError(`unsupported symbol: ${symbol}`, 400);
    }
    if (!ALLOWED_RANGES.has(range)) {
      throw new ApiError(`unsupported range: ${range}`, 400);
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const upstream = await fetch(url, {
      headers: {
        // Yahoo 비공식 API 는 Mozilla User-Agent 없으면 종종 403
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
    points.reverse(); // 최신이 [0]

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
    };

    if (res.setHeader) {
      // Vercel CDN 5분 캐시 + stale-while-revalidate 30분
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    }
    sendData(res, payload);
  } catch (e) {
    sendError(res, e);
  }
}
