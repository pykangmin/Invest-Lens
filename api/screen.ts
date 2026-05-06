import { query } from "./_lib/db";
import type { ApiRequest, ApiResponse } from "./_lib/http";
import {
  assertGet,
  getQueryInt,
  getQueryString,
  ApiError,
  sendData,
  sendError,
} from "./_lib/http";

interface ScreenRow {
  ticker: string;
  name: string | null;
  metric: number | null;
}

const CATEGORIES = ["priceUp", "priceDown", "volume", "scoreTop"] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(v: string): v is Category {
  return (CATEGORIES as readonly string[]).includes(v);
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) return;

  try {
    const cat = getQueryString(req, "category");
    if (!isCategory(cat)) {
      throw new ApiError(`Unknown category: ${cat}`, 400);
    }
    const limit = getQueryInt(req, "limit", 3, 1, 20);

    const rows = await runCategory(cat, limit);
    sendData(res, { category: cat, items: rows });
  } catch (error) {
    sendError(res, error);
  }
}

async function runCategory(cat: Category, limit: number): Promise<ScreenRow[]> {
  if (cat === "priceUp" || cat === "priceDown") {
    const dir = cat === "priceUp" ? "DESC" : "ASC";
    // 종목별 최근 두 영업일 close 의 변동률.
    const sql = `
      WITH ranked AS (
        SELECT
          ticker,
          close,
          date,
          ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
        FROM public.stock_price_tech
        WHERE close IS NOT NULL
      ),
      pairs AS (
        SELECT
          a.ticker,
          a.close AS cur,
          b.close AS prev
        FROM ranked a
        JOIN ranked b ON a.ticker = b.ticker AND a.rn = 1 AND b.rn = 2
        WHERE a.close IS NOT NULL AND b.close IS NOT NULL AND b.close > 0
      )
      SELECT
        p.ticker,
        cm.name,
        ((p.cur - p.prev) / p.prev * 100)::numeric(8, 4) AS metric
      FROM pairs p
      LEFT JOIN public.company_master cm ON cm.ticker = p.ticker
      ORDER BY ((p.cur - p.prev) / p.prev) ${dir}
      LIMIT $1
    `;
    return query<ScreenRow>(sql, [limit]);
  }

  if (cat === "volume") {
    const sql = `
      WITH latest AS (
        SELECT
          ticker,
          volume,
          ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
        FROM public.stock_price_tech
        WHERE volume IS NOT NULL
      )
      SELECT
        l.ticker,
        cm.name,
        l.volume::numeric AS metric
      FROM latest l
      LEFT JOIN public.company_master cm ON cm.ticker = l.ticker
      WHERE l.rn = 1
      ORDER BY l.volume DESC
      LIMIT $1
    `;
    return query<ScreenRow>(sql, [limit]);
  }

  // scoreTop — fundamentals 의 단순 5개 지표 만족도 (각 1점, 합 0~5 → ×20 = 0~100).
  // NULL 보장을 위해 IS NOT NULL 명시.
  const sql = `
    WITH latest_fund AS (
      SELECT DISTINCT ON (ticker)
        ticker, roe, net_profit_margin, fcf_yield, debt_to_equity, per
      FROM public.stock_fundamentals
      ORDER BY ticker, date DESC
    )
    SELECT
      lf.ticker,
      cm.name,
      ((
        (CASE WHEN lf.roe                IS NOT NULL AND lf.roe                > 0.05 THEN 1 ELSE 0 END) +
        (CASE WHEN lf.net_profit_margin  IS NOT NULL AND lf.net_profit_margin  > 0.05 THEN 1 ELSE 0 END) +
        (CASE WHEN lf.fcf_yield          IS NOT NULL AND lf.fcf_yield          > 0.01 THEN 1 ELSE 0 END) +
        (CASE WHEN lf.debt_to_equity     IS NOT NULL AND lf.debt_to_equity     < 4    THEN 1 ELSE 0 END) +
        (CASE WHEN lf.per                IS NOT NULL AND lf.per                < 60   THEN 1 ELSE 0 END)
      ) * 20)::numeric AS metric
    FROM latest_fund lf
    LEFT JOIN public.company_master cm ON cm.ticker = lf.ticker
    ORDER BY metric DESC, lf.ticker
    LIMIT $1
  `;
  return query<ScreenRow>(sql, [limit]);
}
