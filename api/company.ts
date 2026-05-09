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
import type { CompanySnapshot, StockFundamentals } from "../src/types/investment.js";

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
      latestFundamentals,
      fundamentalsHistory,
      latestTechnical,
      technicalHistory,
    ] = await Promise.all([
      queryOne<StockFundamentalsRow>(
        `
          SELECT *
          FROM public.stock_fundamentals
          WHERE ticker = $1
            AND (per IS NOT NULL OR roe IS NOT NULL OR market_cap IS NOT NULL)
          ORDER BY date DESC
          LIMIT 1
        `,
        [ticker],
      ),
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
    ]);

    const payload: CompanySnapshot = {
      company: mapCompany(company),
      latestFundamentals: latestFundamentals ? mapFundamentals(latestFundamentals) : null,
      fundamentalsHistory: interpolateFundamentalsHistory(
        fundamentalsHistory.map(mapFundamentals),
      ),
      latestTechnical: latestTechnical ? mapTechnical(latestTechnical) : null,
      technicalHistory: technicalHistory.map(mapTechnical),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
