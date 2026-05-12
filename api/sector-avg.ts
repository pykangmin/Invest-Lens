// /api/sector-avg?sector=Information%20Technology
//
// 같은 sector 의 펀더멘털 metric 별 평균/분위 (최신 일자).
// 데이터 출처: public.stock_fundamental_sector_stats (origin/DB 의 backfill 스크립트로 적재).
// 사용처: FundamentalDetail §3 가치평가 레이더 — 동종업계 평균 비교.

import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { ApiError, assertGet, getQueryString, sendData, sendError } from "./_lib/http.js";

export interface SectorAvgMetric {
  metric: string;          // 컬럼명 (예: roe, per, pbr, ev_ebitda, fcf_yield, fcf_margin, gross_margin_yoy, revenue_growth, eps_growth, ccc, debt_to_equity, net_profit_margin, pbr_z_score, forward_per_z_score)
  sampleSize: number;
  avg: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  winsorizedAvg: number | null;
}

export interface SectorAvgResponse {
  sector: string;
  date: string;            // 적용 기준 일자 (latest)
  metrics: SectorAvgMetric[];
}

interface Row {
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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const sector = getQueryString(req, "sector").trim();
    if (!sector) throw new ApiError("Query param 'sector' is required.", 400);

    // 최신 일자 한 번 조회 (sector 별로 일자가 다를 수 있음)
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

    const rows = await query<Row>(
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
  } catch (e) {
    sendError(res, e);
  }
}
