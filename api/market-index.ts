import { query, queryOne } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http.js";
import {
  fetchYahooDaily,
  marketIndexFromYahoo,
  mapMarketIndexRow,
  type MarketIndexRow,
} from "./_lib/marketData.js";
import type { MarketIndexResponse } from "../src/types/investment.js";

const DEFAULT_SYMBOL = "^GSPC";
const DEFAULT_NAME = "S&P 500";

function normalizeIndexSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z^][A-Z0-9.^-]{0,14}$/.test(symbol)) {
    return DEFAULT_SYMBOL;
  }
  return symbol || DEFAULT_SYMBOL;
}

function displayName(symbol: string): string {
  if (symbol === "^GSPC") return DEFAULT_NAME;
  return symbol;
}

async function hasMarketIndexTable(): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    "SELECT to_regclass('public.market_index_prices') IS NOT NULL AS exists",
  );
  return row?.exists ?? false;
}

async function loadFromDb(symbol: string, limit: number) {
  if (!(await hasMarketIndexTable())) return [];

  const rows = await query<MarketIndexRow>(
    `
      SELECT symbol, name, date, close, open, high, low, volume, source, is_filled, source_date
      FROM public.market_index_prices
      WHERE symbol = $1
      ORDER BY date DESC
      LIMIT $2
    `,
    [symbol, limit],
  );
  return rows.map(mapMarketIndexRow);
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) return;

  try {
    const symbol = normalizeIndexSymbol(getQueryString(req, "symbol", DEFAULT_SYMBOL));
    const historyLimit = getQueryInt(req, "historyLimit", 252, 1, 2_000);
    const dbHistory = await loadFromDb(symbol, historyLimit);

    let payload: MarketIndexResponse;
    if (dbHistory.length > 0) {
      payload = {
        symbol,
        latest: dbHistory[0] ?? null,
        history: dbHistory,
        source: "db",
      };
    } else {
      const raw = await fetchYahooDaily(symbol, "5y");
      const history = marketIndexFromYahoo(symbol, displayName(symbol), raw, historyLimit);
      payload = {
        symbol,
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
