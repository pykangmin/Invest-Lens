import { query, queryOne } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http.js";
import {
  fetchYahooDaily,
  fxRateFromYahoo,
  mapFxRateRow,
  type FxRateRow,
} from "./_lib/marketData.js";
import type { FxRateResponse } from "../src/types/investment.js";

const DEFAULT_PAIR = "USD/KRW";

function normalizeCurrency(value: string, fallback: string): string {
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

function pairFromQuery(req: ApiRequest): {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  yahooSymbol: string;
} {
  const pair = getQueryString(req, "pair", DEFAULT_PAIR).trim().toUpperCase();
  const [pairBase, pairQuote] = pair.split("/");
  const baseCurrency = normalizeCurrency(
    getQueryString(req, "base", pairBase ?? "USD"),
    "USD",
  );
  const quoteCurrency = normalizeCurrency(
    getQueryString(req, "quote", pairQuote ?? "KRW"),
    "KRW",
  );
  const normalizedPair = `${baseCurrency}/${quoteCurrency}`;
  const yahooSymbol =
    baseCurrency === "USD" ? `${quoteCurrency}=X` : `${baseCurrency}${quoteCurrency}=X`;

  return { pair: normalizedPair, baseCurrency, quoteCurrency, yahooSymbol };
}

async function hasFxRatesTable(): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    "SELECT to_regclass('public.fx_rates') IS NOT NULL AS exists",
  );
  return row?.exists ?? false;
}

async function loadFromDb(pair: string, limit: number) {
  if (!(await hasFxRatesTable())) return [];

  const rows = await query<FxRateRow>(
    `
      SELECT pair, base_currency, quote_currency, date, rate, open, high, low, source, is_filled, source_date
      FROM public.fx_rates
      WHERE pair = $1
      ORDER BY date DESC
      LIMIT $2
    `,
    [pair, limit],
  );
  return rows.map(mapFxRateRow);
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) return;

  try {
    const { pair, baseCurrency, quoteCurrency, yahooSymbol } = pairFromQuery(req);
    const historyLimit = getQueryInt(req, "historyLimit", 252, 1, 1_000);
    const dbHistory = await loadFromDb(pair, historyLimit);

    let payload: FxRateResponse;
    if (dbHistory.length > 0) {
      payload = {
        pair,
        latest: dbHistory[0] ?? null,
        history: dbHistory,
        source: "db",
      };
    } else {
      const raw = await fetchYahooDaily(yahooSymbol, "2y");
      const history = fxRateFromYahoo(
        pair,
        baseCurrency,
        quoteCurrency,
        raw,
        historyLimit,
      );
      payload = {
        pair,
        latest: history[0] ?? null,
        history,
        source: "external",
      };
    }

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
