import { query, queryOne } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, sendData, sendError } from "./_lib/http.js";
import {
  mapTechnicalMarketAverage,
  type TechnicalMarketAverageRow,
} from "./_lib/mappers.js";
import type { TechnicalMarketAverageResponse } from "../src/types/investment.js";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const limit = getQueryInt(req, "limit", 30, 1, 500);
    const [latest, history] = await Promise.all([
      queryOne<TechnicalMarketAverageRow>(
        `
          SELECT date, sample_size, avg_score, p10_score, p90_score, source, updated_at
          FROM public.technical_score_market_avg
          ORDER BY date DESC
          LIMIT 1
        `,
      ),
      query<TechnicalMarketAverageRow>(
        `
          SELECT date, sample_size, avg_score, p10_score, p90_score, source, updated_at
          FROM public.technical_score_market_avg
          ORDER BY date DESC
          LIMIT $1
        `,
        [limit],
      ),
    ]);

    const payload: TechnicalMarketAverageResponse = {
      latest: latest ? mapTechnicalMarketAverage(latest) : null,
      history: history.map(mapTechnicalMarketAverage),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
