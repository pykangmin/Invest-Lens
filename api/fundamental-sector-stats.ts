import { query } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import {
  ApiError,
  assertGet,
  getQueryInt,
  getQueryString,
  sendData,
  sendError,
} from "./_lib/http.js";
import {
  mapFundamentalSectorStat,
  type FundamentalSectorStatRow,
} from "./_lib/mappers.js";
import type { FundamentalSectorStatsResponse } from "../src/types/investment.js";

function normalizeMetric(value: string): string {
  const metric = value.trim().toLowerCase();
  if (metric && !/^[a-z0-9_]{1,64}$/.test(metric)) {
    throw new ApiError("Invalid metric.", 400);
  }
  return metric;
}

function normalizeDate(value: string): string {
  const date = value.trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("Invalid date.", 400);
  }
  return date;
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const sector = getQueryString(req, "sector").trim();
    const metric = normalizeMetric(getQueryString(req, "metric"));
    const date = normalizeDate(getQueryString(req, "date"));
    const limit = getQueryInt(req, "limit", 200, 1, 1_000);

    const rows = await query<FundamentalSectorStatRow>(
      `
        WITH filtered AS (
          SELECT
            date,
            sector,
            metric,
            sample_size,
            avg_value,
            median_value,
            p10_value,
            p90_value,
            winsorized_avg,
            updated_at
          FROM public.stock_fundamental_sector_stats
          WHERE ($1 = '' OR sector = $1)
            AND ($2 = '' OR metric = $2)
            AND (NULLIF($3, '')::date IS NULL OR date = NULLIF($3, '')::date)
        ),
        latest AS (
          SELECT COALESCE(NULLIF($3, '')::date, max(date)) AS date
          FROM filtered
        )
        SELECT filtered.*
        FROM filtered
        JOIN latest ON latest.date = filtered.date
        ORDER BY filtered.sector, filtered.metric
        LIMIT $4
      `,
      [sector, metric, date, limit],
    );

    const payload: FundamentalSectorStatsResponse = {
      latestDate: rows[0] ? mapFundamentalSectorStat(rows[0]).date : date || null,
      sector: sector || null,
      metric: metric || null,
      items: rows.map(mapFundamentalSectorStat),
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
