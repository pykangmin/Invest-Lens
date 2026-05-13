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

interface RoeSeriesRow {
  ticker: string;
  date: string | Date;
  roe: number | null;
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
  /** 추이 sparkline 용 — ROE 12분기 ASC (오래된→최신). 결측 시 직전값 forward-fill */
  roeSeries: Array<number | null>;
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

    interface SectorSubRow { sector: string | null; sub_industry: string | null; }
    const meRow = await queryOne<SectorSubRow>(
      `SELECT sector, sub_industry FROM public.company_master WHERE ticker = $1`,
      [ticker],
    );
    if (!meRow) throw new ApiError(`Company ${ticker} not found.`, 404);
    if (!meRow.sector) {
      sendData(res, {
        ticker,
        sector: null,
        peers: [],
      } satisfies PeersResponse);
      return;
    }

    // 동종 업계 산식 (B-2):
    //   1) sub_industry 일치하는 종목 시총 상위 N (자신 제외).
    //   2) 1)이 N 미만이면 같은 sector top 으로 부족분 채움 (자신·중복 제외).
    // LATERAL JOIN 으로 종목별 최신 유효 펀더 한 행만 가져옴.
    const peerSql = (filterCol: "sub_industry" | "sector") => `
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
      WHERE cm.${filterCol} = $1
        AND cm.ticker <> $2
      ORDER BY sf.market_cap DESC NULLS LAST
      LIMIT $3
    `;

    let rows: PeerRow[] = [];
    if (meRow.sub_industry) {
      rows = await query<PeerRow>(peerSql("sub_industry"), [meRow.sub_industry, ticker, limit]);
    }
    if (rows.length < limit) {
      const haveTickers = new Set(rows.map((r) => r.ticker));
      const sectorFill = await query<PeerRow>(peerSql("sector"), [meRow.sector, ticker, limit + rows.length]);
      for (const r of sectorFill) {
        if (rows.length >= limit) break;
        if (haveTickers.has(r.ticker)) continue;
        rows.push(r);
        haveTickers.add(r.ticker);
      }
    }

    const tickers = rows.map((r) => r.ticker);
    // sparkline 용 ROE 12분기 시계열 (peer 종목별).
    const seriesRows = tickers.length > 0
      ? await query<RoeSeriesRow>(
          `
            SELECT ticker, date, roe
            FROM public.stock_fundamentals
            WHERE ticker = ANY($1::text[])
            ORDER BY ticker, date DESC
          `,
          [tickers],
        )
      : [];
    const seriesByTicker = new Map<string, Array<number | null>>();
    for (const t of tickers) seriesByTicker.set(t, []);
    // ticker 별 12행 (이미 DESC) → ASC 12 값으로 forward-fill
    const groupedDesc = new Map<string, Array<number | null>>();
    for (const r of seriesRows) {
      const arr = groupedDesc.get(r.ticker) ?? [];
      if (arr.length < 12) {
        arr.push(toNum(r.roe));
        groupedDesc.set(r.ticker, arr);
      }
    }
    for (const [t, desc] of groupedDesc) {
      const asc = desc.slice().reverse();
      let last: number | null = null;
      const filled = asc.map((v) => {
        if (v != null) last = v;
        return last;
      });
      seriesByTicker.set(t, filled);
    }

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
      roeSeries: seriesByTicker.get(r.ticker) ?? [],
      isSelf: r.ticker === ticker,
    }));

    if (res.setHeader) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    }
    sendData(res, {
      ticker,
      sector: meRow.sector,
      peers,
    } satisfies PeersResponse);
  } catch (e) {
    sendError(res, e);
  }
}
