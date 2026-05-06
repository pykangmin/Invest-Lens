import { query, queryOne } from "./_lib/db";
import type { ApiRequest, ApiResponse } from "./_lib/http";
import { assertGet, getQueryInt, sendData, sendError } from "./_lib/http";
import {
  mapMacroRegime,
  type MacroRegimeScoreRow,
} from "./_lib/mappers";
import type { MacroRegimeResponse } from "../src/types/investment";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const limit = getQueryInt(req, "limit", 36, 1, 240);
    const [latest, history] = await Promise.all([
      queryOne<MacroRegimeScoreRow>(
        `
          SELECT *
          FROM public.macro_regime_scores
          ORDER BY date DESC
          LIMIT 1
        `,
      ),
      query<MacroRegimeScoreRow>(
        `
          SELECT *
          FROM public.macro_regime_scores
          ORDER BY date DESC
          LIMIT $1
        `,
        [limit],
      ),
    ]);

    const payload: MacroRegimeResponse = {
      latest: latest ? mapMacroRegime(latest) : null,
      history: history.map(mapMacroRegime),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
