import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http.js";
import { mapCommodity, type CommodityPriceRow } from "./_lib/mappers.js";
import type { CommoditiesResponse } from "../src/types/investment.js";

const DEFAULT_COMMODITY_SYMBOLS = [
  "CL=F",
  "NG=F",
  "GC=F",
  "SI=F",
  "HG=F",
  "ZW=F",
  "ZC=F",
  "ZS=F",
  "LIT",
  "REMX",
] as const;

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const symbol = getQueryString(req, "symbol").trim();
    const historyLimit = getQueryInt(req, "historyLimit", 180, 1, 2_000);

    const [latest, history] = await Promise.all([
      query<CommodityPriceRow>(
        `
          SELECT DISTINCT ON (symbol) *
          FROM public.commodity_prices
          WHERE ($1 <> '' AND symbol = $1)
             OR ($1 = '' AND symbol = ANY($2::text[]))
          ORDER BY symbol, date DESC
        `,
        [symbol, DEFAULT_COMMODITY_SYMBOLS],
      ),
      symbol
        ? query<CommodityPriceRow>(
            `
              SELECT *
              FROM public.commodity_prices
              WHERE symbol = $1
              ORDER BY date DESC
              LIMIT $2
            `,
            [symbol, historyLimit],
          )
        : query<CommodityPriceRow>(
            `
              SELECT *
              FROM (
              SELECT
                *,
                ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
                FROM public.commodity_prices
                WHERE symbol = ANY($2::text[])
              ) ranked
              WHERE rn <= $1
              ORDER BY symbol, date DESC
            `,
            [historyLimit, DEFAULT_COMMODITY_SYMBOLS],
          ),
    ]);

    const payload: CommoditiesResponse = {
      latest: latest.map(mapCommodity),
      history: history.map(mapCommodity),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
