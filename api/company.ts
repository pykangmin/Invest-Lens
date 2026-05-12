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
import type { CompanySnapshot } from "../src/types/investment.js";

const FUNDAMENTAL_AVAILABLE_FIELDS = [
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

const FUNDAMENTAL_CARRY_FILL_FIELDS = [
  "market_cap",
  "per",
  "pbr",
  "roe",
  "net_profit_margin",
  "debt_to_equity",
  "ev_ebitda",
  "fcf_yield",
  "fcf_margin",
  "ccc",
] as const;

type FundamentalCarryFillField = (typeof FUNDAMENTAL_CARRY_FILL_FIELDS)[number];

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(`${value}T00:00:00.000Z`).getTime();
}

function hasAnyFundamentalMetric(row: StockFundamentalsRow): boolean {
  return FUNDAMENTAL_AVAILABLE_FIELDS.some((field) => row[field] !== null);
}

function fillFundamentalsHistory(rows: StockFundamentalsRow[]): StockFundamentalsRow[] {
  const carry: Partial<Record<FundamentalCarryFillField, number>> = {};
  const filledAsc = [...rows]
    .sort((a, b) => toTime(a.date) - toTime(b.date))
    .map((row) => {
      const filled: StockFundamentalsRow = { ...row };
      for (const field of FUNDAMENTAL_CARRY_FILL_FIELDS) {
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

    const filledFundamentalsHistory = fillFundamentalsHistory(fundamentalsHistory);
    const filledLatestFundamentals =
      filledFundamentalsHistory.find(hasAnyFundamentalMetric) ?? latestFundamentals;

    const payload: CompanySnapshot = {
      company: mapCompany(company),
      latestFundamentals: filledLatestFundamentals
        ? mapFundamentals(filledLatestFundamentals)
        : null,
      fundamentalsHistory: filledFundamentalsHistory.map(mapFundamentals),
      latestTechnical: latestTechnical ? mapTechnical(latestTechnical) : null,
      technicalHistory: technicalHistory.map(mapTechnical),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
