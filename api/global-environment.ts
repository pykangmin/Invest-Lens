import { query } from "./_lib/db";
import type { ApiRequest, ApiResponse } from "./_lib/http";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http";
import {
  mapGlobalEnvironment,
  type GlobalEnvironmentPointRow,
} from "./_lib/mappers";
import type { GlobalEnvironmentResponse } from "../src/types/investment";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const symbol = getQueryString(req, "symbol").trim();
    const category = getQueryString(req, "category").trim();
    const historyLimit = getQueryInt(req, "historyLimit", 240, 1, 1_000);

    const [latest, history] = await Promise.all([
      query<GlobalEnvironmentPointRow>(
        `
          SELECT DISTINCT ON (symbol) *
          FROM public.global_environment
          WHERE ($1 = '' OR symbol = $1)
            AND ($2 = '' OR category = $2)
          ORDER BY symbol, date DESC
        `,
        [symbol, category],
      ),
      symbol
        ? query<GlobalEnvironmentPointRow>(
            `
              SELECT *
              FROM public.global_environment
              WHERE symbol = $1
                AND ($2 = '' OR category = $2)
              ORDER BY date DESC
              LIMIT $3
            `,
            [symbol, category, historyLimit],
          )
        : Promise.resolve([]),
    ]);

    const payload: GlobalEnvironmentResponse = {
      latest: latest.map(mapGlobalEnvironment),
      history: history.map(mapGlobalEnvironment),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
