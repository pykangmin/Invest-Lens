// /api/aggregates?kind=marketScore&days=60
// /api/aggregates?kind=sector&sector=Information%20Technology
//
// Hobby plan 의 12 함수 제한을 피하기 위해 두 개의 집계 endpoint 를 단일 함수로 통합.
//  - kind=marketScore : 전 종목 일별 기술 점수 평균 (technical_score_market_avg).
//                       사용처: TechnicalDetail §2 종합 점수 추이 — "시장 평균" dashed 라인.
//  - kind=sector      : 같은 sector 의 펀더멘털 metric 평균/분위 (stock_fundamental_sector_stats).
//                       사용처: FundamentalDetail §3 가치평가 레이더 — 동종업계 평균 비교.

import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { ApiError, assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http.js";

export interface MarketScoreAvgPoint {
  date: string;
  sampleSize: number;
  avgScore: number;
  p10Score: number | null;
  p90Score: number | null;
}

export interface MarketScoreAvgResponse {
  history: MarketScoreAvgPoint[];
}

export interface SectorAvgMetric {
  metric: string;
  sampleSize: number;
  avg: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  winsorizedAvg: number | null;
}

export interface SectorAvgResponse {
  sector: string;
  date: string;
  metrics: SectorAvgMetric[];
}

interface MarketRow {
  date: string | Date;
  sample_size: number;
  avg_score: number | string;
  p10_score: number | string | null;
  p90_score: number | string | null;
}

interface SectorRow {
  metric: string;
  sample_size: number;
  avg_value: number | string | null;
  median_value: number | string | null;
  p10_value: number | string | null;
  p90_value: number | string | null;
  winsorized_avg: number | string | null;
}

interface LatestRow {
  date: string | Date;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string | Date): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : v.slice(0, 10);
}

async function handleMarketScore(req: ApiRequest, res: ApiResponse): Promise<void> {
  const days = getQueryInt(req, "days", 60, 1, 500);
  const rows = await query<MarketRow>(
    `
      SELECT date, sample_size, avg_score, p10_score, p90_score
      FROM public.technical_score_market_avg
      ORDER BY date DESC
      LIMIT $1
    `,
    [days],
  );

  if (res.setHeader) {
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  }

  sendData(res, {
    history: rows.map((r) => ({
      date: toDate(r.date),
      sampleSize: r.sample_size,
      avgScore: toNum(r.avg_score) ?? 0,
      p10Score: toNum(r.p10_score),
      p90Score: toNum(r.p90_score),
    })),
  } satisfies MarketScoreAvgResponse);
}

async function handleSector(req: ApiRequest, res: ApiResponse): Promise<void> {
  const sector = getQueryString(req, "sector").trim();
  if (!sector) throw new ApiError("Query param 'sector' is required.", 400);

  const latest = await query<LatestRow>(
    `
      SELECT MAX(date) AS date
      FROM public.stock_fundamental_sector_stats
      WHERE sector = $1
    `,
    [sector],
  );
  const latestDate = latest[0]?.date ?? null;
  if (!latestDate) {
    sendData(res, { sector, date: "", metrics: [] } satisfies SectorAvgResponse);
    return;
  }

  const rows = await query<SectorRow>(
    `
      SELECT metric, sample_size, avg_value, median_value, p10_value, p90_value, winsorized_avg
      FROM public.stock_fundamental_sector_stats
      WHERE sector = $1 AND date = $2
      ORDER BY metric
    `,
    [sector, latestDate],
  );

  if (res.setHeader) {
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  }

  sendData(res, {
    sector,
    date: toDate(latestDate),
    metrics: rows.map((r) => ({
      metric: r.metric,
      sampleSize: r.sample_size,
      avg: toNum(r.avg_value),
      median: toNum(r.median_value),
      p10: toNum(r.p10_value),
      p90: toNum(r.p90_value),
      winsorizedAvg: toNum(r.winsorized_avg),
    })),
  } satisfies SectorAvgResponse);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const kind = getQueryString(req, "kind").trim();
    if (kind === "marketScore") {
      await handleMarketScore(req, res);
      return;
    }
    if (kind === "sector") {
      await handleSector(req, res);
      return;
    }
    throw new ApiError("Query param 'kind' must be 'marketScore' or 'sector'.", 400);
  } catch (e) {
    sendError(res, e);
  }
}
