import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http.js";
import { mapCommodity, type CommodityPriceRow } from "./_lib/mappers.js";
import type { CommoditiesResponse } from "../src/types/investment.js";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const symbol = getQueryString(req, "symbol").trim();
    const historyLimit = getQueryInt(req, "historyLimit", 180, 1, 2000);

    const [latest, history] = await Promise.all([
      query<CommodityPriceRow>(
        `
          SELECT DISTINCT ON (symbol) *
          FROM public.commodity_prices
          WHERE $1 = '' OR symbol = $1
          ORDER BY symbol, date DESC
        `,
        [symbol],
      ),
      // symbol 없으면 모든 commodity 의 N일치 history (commodityImpactGauge 가
      // sector × 원자재 가중을 계산하려면 여러 symbol 의 시계열이 동시에 필요)
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
              SELECT id, symbol, date, close, open, high, low, volume, category, unit
              FROM (
                SELECT *,
                  ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
                FROM public.commodity_prices
              ) ranked
              WHERE rn <= $1
              ORDER BY symbol, date DESC
            `,
            [historyLimit],
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
