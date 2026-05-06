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
      fundamentalsHistory: fundamentalsHistory.map(mapFundamentals),
      latestTechnical: latestTechnical ? mapTechnical(latestTechnical) : null,
      technicalHistory: technicalHistory.map(mapTechnical),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
