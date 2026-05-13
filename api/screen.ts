import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import {
  assertGet,
  getQueryInt,
  getQueryString,
  ApiError,
  sendData,
  sendError,
} from "./_lib/http.js";

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

  // scoreTop —  (펀더 점수 + 기술 점수) / 2, 기술 결측 시 펀더 단독 fallback.
  //
  //  - 펀더: fundamentalNarrative.totalFromSections 의 SQL 재구현 (연속 0~100).
  //      normalize(raw, good, bad) = clamp((raw - bad) / (good - bad), 0, 1) * 100  → NULL→NULL
  //      sectionNorm = NULL 제외 평균 (avgNorm) — 모두 NULL 이면 NULL
  //      total      = sum(sectionNorm × max) / sum(max), NULL 섹션은 분자/분모 모두 제외
  //      max: 현금흐름 40 / 수익성 25 / 가치평가 25 / 성장성 10 (시안)
  //    임계값은 src/analysis/fundamentalNarrative.ts:54-71 과 1:1 동일.
  //  - 기술: public.technical_score_ticker (DB-side backfill, 협업자 적재).
  //      스펙: docs/exec-plans/technical_score_ticker.md
  //      테이블 부재 시 펀더 단독 ranking — 모듈 캐시로 cold-start 당 한 번만 to_regclass 체크.
  const hasTech = await technicalScoreTableExists();
  return query<ScreenRow>(scoreTopSql(hasTech), [limit]);
}

// ──────────────────────────────────────────────────────────────
// scoreTop 용 SQL 빌더 + 기술 점수 테이블 존재 캐시
// ──────────────────────────────────────────────────────────────

let techTableCache: boolean | null = null;

async function technicalScoreTableExists(): Promise<boolean> {
  if (techTableCache !== null) return techTableCache;
  try {
    const rows = await query<{ exists: boolean | null }>(
      `SELECT to_regclass('public.technical_score_ticker') IS NOT NULL AS exists`,
    );
    techTableCache = rows[0]?.exists === true;
  } catch {
    techTableCache = false;
  }
  return techTableCache;
}

function scoreTopSql(withTech: boolean): string {
  const fundCte = `
    WITH latest_fund AS (
      SELECT DISTINCT ON (ticker)
        ticker,
        fcf_yield, fcf_margin, debt_to_equity,
        roe, net_profit_margin,
        revenue_growth, eps_growth,
        per, pbr, ev_ebitda
      FROM public.stock_fundamentals
      ORDER BY ticker, date DESC
    ),
    norm AS (
      SELECT
        ticker,
        CASE WHEN fcf_yield IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((fcf_yield - 0.01) / (0.06 - 0.01))::numeric)) * 100 END AS n_fcf_yield,
        CASE WHEN fcf_margin IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((fcf_margin - 0.05) / (0.20 - 0.05))::numeric)) * 100 END AS n_fcf_margin,
        CASE WHEN debt_to_equity IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((debt_to_equity - 4.0) / (1.5 - 4.0))::numeric)) * 100 END AS n_de,
        CASE WHEN roe IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((roe - 0.05) / (0.20 - 0.05))::numeric)) * 100 END AS n_roe,
        CASE WHEN net_profit_margin IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((net_profit_margin - 0.05) / (0.20 - 0.05))::numeric)) * 100 END AS n_npm,
        CASE WHEN revenue_growth IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, (revenue_growth / 0.20)::numeric)) * 100 END AS n_rg,
        CASE WHEN eps_growth IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, (eps_growth / 0.20)::numeric)) * 100 END AS n_eg,
        CASE WHEN per IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((per - 60) / (15 - 60))::numeric)) * 100 END AS n_per,
        CASE WHEN pbr IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((pbr - 6.0) / (1.5 - 6.0))::numeric)) * 100 END AS n_pbr,
        CASE WHEN ev_ebitda IS NOT NULL
          THEN GREATEST(0::numeric, LEAST(1::numeric, ((ev_ebitda - 30) / (15 - 30))::numeric)) * 100 END AS n_ev
      FROM latest_fund
    ),
    sections AS (
      SELECT
        ticker,
        (SELECT AVG(v) FROM (VALUES (n_fcf_yield), (n_fcf_margin), (n_de)) AS t(v)) AS cashflow_norm,
        (SELECT AVG(v) FROM (VALUES (n_roe), (n_npm))               AS t(v)) AS profit_norm,
        (SELECT AVG(v) FROM (VALUES (n_rg), (n_eg))                 AS t(v)) AS growth_norm,
        (SELECT AVG(v) FROM (VALUES (n_per), (n_pbr), (n_ev))       AS t(v)) AS valuation_norm
      FROM norm
    ),
    scored AS (
      SELECT
        ticker,
        (SELECT
           CASE WHEN COALESCE(SUM(m), 0) = 0 THEN NULL ELSE SUM(n * m) / SUM(m) END
         FROM (VALUES
           (cashflow_norm,  40::numeric),
           (profit_norm,    25::numeric),
           (growth_norm,    10::numeric),
           (valuation_norm, 25::numeric)
         ) AS t(n, m)
         WHERE n IS NOT NULL
        ) AS total_score
      FROM sections
    )`;

  if (!withTech) {
    return `
      ${fundCte}
      SELECT
        s.ticker,
        cm.name,
        s.total_score::numeric AS metric
      FROM scored s
      LEFT JOIN public.company_master cm ON cm.ticker = s.ticker
      WHERE s.total_score IS NOT NULL
      ORDER BY s.total_score DESC, s.ticker
      LIMIT $1
    `;
  }

  // 기술 점수 테이블 존재 — (펀더 + 기술) / 2 평균. 기술 결측 ticker 는 펀더 단독.
  return `
    ${fundCte},
    latest_tech AS (
      SELECT DISTINCT ON (ticker) ticker, score::numeric AS tech_score
      FROM public.technical_score_ticker
      ORDER BY ticker, date DESC
    )
    SELECT
      s.ticker,
      cm.name,
      (CASE
        WHEN lt.tech_score IS NOT NULL
          THEN (s.total_score + lt.tech_score) / 2
        ELSE s.total_score
      END)::numeric AS metric
    FROM scored s
    LEFT JOIN public.company_master cm ON cm.ticker = s.ticker
    LEFT JOIN latest_tech lt ON lt.ticker = s.ticker
    WHERE s.total_score IS NOT NULL
    ORDER BY metric DESC, s.ticker
    LIMIT $1
  `;
}
