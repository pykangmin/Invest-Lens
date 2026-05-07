import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { assertGet, sendData, sendError } from "./_lib/http.js";
import type { DbHealthResponse, DbTableHealth } from "../src/types/investment.js";

interface HealthRow {
  table_name: string;
  rows: number;
  min_date: string | Date | null;
  max_date: string | Date | null;
}

function dateOrNull(value: string | Date | null): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function mapHealth(row: HealthRow): DbTableHealth {
  return {
    tableName: row.table_name,
    rows: row.rows,
    minDate: dateOrNull(row.min_date),
    maxDate: dateOrNull(row.max_date),
  };
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const rows = await query<HealthRow>(`
      SELECT 'company_master' AS table_name, count(*)::bigint AS rows, NULL::date AS min_date, NULL::date AS max_date
      FROM public.company_master
      UNION ALL
      SELECT 'stock_fundamentals', count(*)::bigint, min(date), max(date)
      FROM public.stock_fundamentals
      UNION ALL
      SELECT 'stock_price_tech', count(*)::bigint, min(date), max(date)
      FROM public.stock_price_tech
      UNION ALL
      SELECT 'global_environment', count(*)::bigint, min(date), max(date)
      FROM public.global_environment
      UNION ALL
      SELECT 'commodity_prices', count(*)::bigint, min(date), max(date)
      FROM public.commodity_prices
      UNION ALL
      SELECT 'macro_regime_scores', count(*)::bigint, min(date), max(date)
      FROM public.macro_regime_scores
      ORDER BY table_name
    `);

    const payload: DbHealthResponse = {
      ok: true,
      checkedAt: new Date().toISOString(),
      tables: rows.map(mapHealth),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
