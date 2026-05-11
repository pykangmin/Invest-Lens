// /api/peers?ticker=AAPL&limit=5
//
// 동종업계 (same sector) 시가총액 상위 N 종목 펀더멘털 비교용.
// 2026-05 — data-coverage-v4 §4a "동종업계 비교" EXAMPLE → REAL 전환.

import { query, queryOne } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import {
  ApiError,
  assertGet,
  getQueryInt,
  getQueryString,
  normalizeTicker,
  sendData,
  sendError,
} from "./_lib/http.js";

interface SectorRow {
  sector: string | null;
}

interface PeerRow {
  ticker: string;
  name: string;
  sub_industry: string | null;
  market_cap: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  net_profit_margin: number | null;
  fcf_yield: number | null;
  debt_to_equity: number | null;
  revenue_growth: number | null;
}

export interface PeerCompany {
  ticker: string;
  name: string;
  subIndustry: string | null;
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  netProfitMargin: number | null;
  fcfYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  isSelf: boolean;
}

export interface PeersResponse {
  ticker: string;
  sector: string | null;
  peers: PeerCompany[];
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!assertGet(req, res)) return;
  try {
    const ticker = normalizeTicker(getQueryString(req, "ticker"));
    const limit = getQueryInt(req, "limit", 5, 2, 12);

    const sectorRow = await queryOne<SectorRow>(
      `SELECT sector FROM public.company_master WHERE ticker = $1`,
      [ticker],
    );
    if (!sectorRow) throw new ApiError(`Company ${ticker} not found.`, 404);
    if (!sectorRow.sector) {
      sendData(res, {
        ticker,
        sector: null,
        peers: [],
      } satisfies PeersResponse);
      return;
    }

    // 같은 sector 의 시총 상위 N+1 (자신 포함). UI 측에서 isSelf 로 강조.
    // LATERAL JOIN 으로 종목별 최신 유효 펀더 한 행만 가져옴.
    const rows = await query<PeerRow>(
      `
        SELECT cm.ticker, cm.name, cm.sub_industry,
               sf.market_cap, sf.per, sf.pbr, sf.roe,
               sf.net_profit_margin, sf.fcf_yield,
               sf.debt_to_equity, sf.revenue_growth
        FROM public.company_master cm
        JOIN LATERAL (
          SELECT *
          FROM public.stock_fundamentals
          WHERE ticker = cm.ticker AND market_cap IS NOT NULL
          ORDER BY date DESC
          LIMIT 1
        ) sf ON true
        WHERE cm.sector = $1
        ORDER BY sf.market_cap DESC NULLS LAST
        LIMIT $2
      `,
      [sectorRow.sector, limit + 1],
    );

    const peers: PeerCompany[] = rows.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      subIndustry: r.sub_industry,
      marketCap: toNum(r.market_cap),
      per: toNum(r.per),
      pbr: toNum(r.pbr),
      roe: toNum(r.roe),
      netProfitMargin: toNum(r.net_profit_margin),
      fcfYield: toNum(r.fcf_yield),
      debtToEquity: toNum(r.debt_to_equity),
      revenueGrowth: toNum(r.revenue_growth),
      isSelf: r.ticker === ticker,
    }));

    if (res.setHeader) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    }
    sendData(res, {
      ticker,
      sector: sectorRow.sector,
      peers,
    } satisfies PeersResponse);
  } catch (e) {
    sendError(res, e);
  }
}
