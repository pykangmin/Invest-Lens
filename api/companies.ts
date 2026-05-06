import { query } from "./_lib/db";
import type { ApiRequest, ApiResponse } from "./_lib/http";
import { assertGet, getQueryInt, getQueryString, sendData, sendError } from "./_lib/http";
import { mapCompany, type CompanyMasterRow } from "./_lib/mappers";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const search = getQueryString(req, "q").trim();
    const limit = getQueryInt(req, "limit", 25, 1, 100);
    const likeSearch = `%${search}%`;
    const prefixSearch = `${search}%`;

    const rows = await query<CompanyMasterRow>(
      `
        SELECT ticker, name, sector, sub_industry, updated_at
        FROM public.company_master
        WHERE $1 = ''
           OR ticker ILIKE $2
           OR name ILIKE $3
        ORDER BY
          CASE
            WHEN $1 <> '' AND ticker = upper($1) THEN 0
            WHEN $1 <> '' AND ticker ILIKE $2 THEN 1
            WHEN $1 <> '' AND name ILIKE $2 THEN 2
            ELSE 3
          END,
          ticker
        LIMIT $4
      `,
      [search, prefixSearch, likeSearch, limit],
    );

    sendData(res, rows.map(mapCompany));
  } catch (error) {
    sendError(res, error);
  }
}
