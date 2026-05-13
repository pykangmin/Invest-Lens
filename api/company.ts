import { query, queryOne } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import {
  assertGet,
  getQueryInt,
  getQueryString,
  normalizeTicker,
  ApiError,
  sendData,
  sendError,
} from "./_lib/http.js";
import {
  mapCompany,
  mapFundamentals,
  mapTechnical,
  type CompanyMasterRow,
  type StockFundamentalsRow,
  type StockPriceTechRow,
} from "./_lib/mappers.js";
import type {
  CompanySnapshot,
  StockFundamentals,
  TechnicalSignalSnapshot,
} from "../src/types/investment.js";

// 펀더멘털 history 의 null 보간.
// stock_fundamentals 는 분기 종료일에 row 가 생성되지만 실 실적 발표는 그 후 (4~5월).
// 결과: 최근 분기 row 의 per/roe/market_cap 등이 모두 null. 화면에 "결측" 다수 노출.
//
// 정책: history 를 ASC (오래된→최신) 로 순회하며 직전 유효 분기값으로 forward-fill.
// 화면에서 채점자가 "예시 텍스트" 가 아닌 의미있는 값을 보게 함.
// 단, **개별 row 의 date 는 유지**되므로 시간축은 정확하고, 보간된 값은 "직전 분기와
// 동일하게 carry" 라는 명확한 의미. interpolation flag 가 필요하면 추후 추가.
const FILL_FIELDS: Array<keyof StockFundamentals> = [
  "marketCap",
  "per",
  "pbr",
  "roe",
  "netProfitMargin",
  "debtToEquity",
  "revenueGrowth",
  "epsGrowth",
  "evEbitda",
  "fcfYield",
  "fcfMargin",
  "ccc",
  "grossMarginYoy",
  "pbrZScore",
  "forwardPerZScore",
];

function interpolateFundamentalsHistory(history: StockFundamentals[]): StockFundamentals[] {
  if (history.length === 0) return history;
  // history 는 DESC (최신 [0] → 오래된). ASC 순회를 위해 끝에서 시작.
  const lastValid: Record<string, number> = {};
  for (let i = history.length - 1; i >= 0; i--) {
    const row = { ...history[i] } as Record<string, number | string | null>;
    for (const k of FILL_FIELDS) {
      const v = row[k as string] as number | null;
      if (v !== null && v !== undefined) {
        lastValid[k as string] = v;
      } else if (lastValid[k as string] !== undefined) {
        // forward-fill: 이전 (older) 분기 유효값을 현재 (newer) 분기 null 자리에 채움
        row[k as string] = lastValid[k as string];
      }
    }
    history[i] = row as unknown as StockFundamentals;
  }
  return history;
}

const FUNDAMENTAL_FILL_FIELDS = [
  "market_cap",
  "per",
  "pbr",
  "roe",
  "net_profit_margin",
  "debt_to_equity",
  "revenue_growth",
  "eps_growth",
  "ev_ebitda",
  "fcf_yield",
  "fcf_margin",
  "ccc",
  "gross_margin_yoy",
  "pbr_z_score",
  "forward_per_z_score",
] as const;

type FundamentalFillField = (typeof FUNDAMENTAL_FILL_FIELDS)[number];

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(`${value}T00:00:00.000Z`).getTime();
}

function hasAnyFundamentalMetric(row: StockFundamentalsRow): boolean {
  return FUNDAMENTAL_FILL_FIELDS.some((field) => row[field] !== null);
}

function fillFundamentalsHistory(rows: StockFundamentalsRow[]): StockFundamentalsRow[] {
  const carry: Partial<Record<FundamentalFillField, number>> = {};
  const filledAsc = [...rows]
    .sort((a, b) => toTime(a.date) - toTime(b.date))
    .map((row) => {
      const filled: StockFundamentalsRow = { ...row };
      for (const field of FUNDAMENTAL_FILL_FIELDS) {
        if (filled[field] === null && carry[field] !== undefined) {
          filled[field] = carry[field]!;
        }
        if (filled[field] !== null) {
          carry[field] = filled[field]!;
        }
      }
      return filled;
    });

  return filledAsc.sort((a, b) => toTime(b.date) - toTime(a.date));
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const ticker = normalizeTicker(getQueryString(req, "ticker"));
    const historyLimit = getQueryInt(req, "historyLimit", 252, 1, 500);

    const company = await queryOne<CompanyMasterRow>(
      `
        SELECT ticker, name, sector, sub_industry, updated_at
        FROM public.company_master
        WHERE ticker = $1
      `,
      [ticker],
    );

    if (!company) {
      throw new ApiError(`Company ${ticker} not found.`, 404);
    }

    const [
      fundamentalsHistory,
      latestTechnical,
      technicalHistory,
      latestSignalsRow,
    ] = await Promise.all([
      // latestFundamentals 는 별도 쿼리 폐기 — forward-fill 된 history[0] 사용.
      // 분기별 sparse row (예: 최신 row 가 roe=null, 직전 row 가 roe=valid) 인 경우
      // 별도 SQL 의 단발 row 선택은 forward-fill 효과를 못 받아 ROE 등이 누락됨.
      query<StockFundamentalsRow>(
        `
          SELECT *
          FROM public.stock_fundamentals
          WHERE ticker = $1
          ORDER BY date DESC
          LIMIT 12
        `,
        [ticker],
      ),
      queryOne<StockPriceTechRow>(
        `
          SELECT *
          FROM public.stock_price_tech
          WHERE ticker = $1
            AND close IS NOT NULL
          ORDER BY date DESC
          LIMIT 1
        `,
        [ticker],
      ),
      query<StockPriceTechRow>(
        `
          SELECT *
          FROM public.stock_price_tech
          WHERE ticker = $1
            AND close IS NOT NULL
          ORDER BY date DESC
          LIMIT $2
        `,
        [ticker, historyLimit],
      ),
      // 2026-05 보강 컬럼은 close 가 null 인 별도 row 에 들어옴. 별도 쿼리로 최신 row 확보.
      queryOne<StockPriceTechRow>(
        `
          SELECT *
          FROM public.stock_price_tech
          WHERE ticker = $1
            AND supertrend_signal IS NOT NULL
          ORDER BY date DESC
          LIMIT 1
        `,
        [ticker],
      ),
    ]);

    const latestSignals: TechnicalSignalSnapshot | null = latestSignalsRow
      ? {
          date:
            latestSignalsRow.date instanceof Date
              ? latestSignalsRow.date.toISOString().slice(0, 10)
              : latestSignalsRow.date,
          ma20: latestSignalsRow.ma_20,
          macdSignal: latestSignalsRow.macd_signal,
          supertrendSignal:
            latestSignalsRow.supertrend_signal === "Buy" ||
            latestSignalsRow.supertrend_signal === "Sell"
              ? latestSignalsRow.supertrend_signal
              : null,
          supertrendValue: latestSignalsRow.supertrend_value,
          supertrendDays: latestSignalsRow.supertrend_days,
        }
      : null;

    const filledHistory = interpolateFundamentalsHistory(
      fundamentalsHistory.map(mapFundamentals),
    );

    const payload: CompanySnapshot = {
      company: mapCompany(company),
      // history[0] = 최신, 이미 forward-fill 적용됨 → 분기별 sparse null 보강
      latestFundamentals: filledHistory.length > 0 ? filledHistory[0] : null,
      fundamentalsHistory: filledHistory,
      latestTechnical: latestTechnical ? mapTechnical(latestTechnical) : null,
      technicalHistory: technicalHistory.map(mapTechnical),
      latestSignals,
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
