// /api/market-score-avg?days=20
//
// 전체 S&P500 종목의 일별 기술 점수 평균 / 분위 시계열.
// 데이터 출처: public.technical_score_market_avg (origin/DB 의 backfill 스크립트로 적재).
// 사용처: TechnicalDetail §2 종합 점수 추이 — "시장 평균" dashed 라인.

import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, sendData, sendError } from "./_lib/http.js";

export interface MarketScoreAvgPoint {
  date: string;             // YYYY-MM-DD
  sampleSize: number;
  avgScore: number;
  p10Score: number | null;
  p90Score: number | null;
}

export interface MarketScoreAvgResponse {
  history: MarketScoreAvgPoint[];   // DESC (최신 [0])
}

interface Row {
  date: string | Date;
  sample_size: number;
  avg_score: number | string;
  p10_score: number | string | null;
  p90_score: number | string | null;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string | Date): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : v.slice(0, 10);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const days = getQueryInt(req, "days", 60, 1, 500);
    const rows = await query<Row>(
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
  } catch (e) {
    sendError(res, e);
  }
}
