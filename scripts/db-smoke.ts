import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { query, queryOne } from "../api/_lib/db";
import {
  mapCompany,
  mapMacroRegime,
  mapTechnical,
  type CompanyMasterRow,
  type MacroRegimeScoreRow,
  type StockPriceTechRow,
} from "../api/_lib/mappers";

function loadEnvFile(path: string): void {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    return;
  }

  const lines = readFileSync(resolvedPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trimStart().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");

const companyCount = await queryOne<{ count: number }>(
  "SELECT count(*)::bigint AS count FROM public.company_master",
);
const companies = await query<CompanyMasterRow>(
  `
    SELECT ticker, name, sector, sub_industry, updated_at
    FROM public.company_master
    WHERE ticker IN ('AAPL', 'MSFT', 'NVDA')
    ORDER BY ticker
  `,
);
const aaplTechnical = await queryOne<StockPriceTechRow>(
  `
    SELECT *
    FROM public.stock_price_tech
    WHERE ticker = 'AAPL'
      AND close IS NOT NULL
    ORDER BY date DESC
    LIMIT 1
  `,
);
const latestRegime = await queryOne<MacroRegimeScoreRow>(
  `
    SELECT *
    FROM public.macro_regime_scores
    ORDER BY date DESC
    LIMIT 1
  `,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      companyCount: companyCount?.count ?? 0,
      companies: companies.map(mapCompany),
      aaplLatestTechnical: aaplTechnical ? mapTechnical(aaplTechnical) : null,
      latestMacroRegime: latestRegime ? mapMacroRegime(latestRegime) : null,
    },
    null,
    2,
  ),
);

// db.ts 가 매 호출 client 패턴 — 별도 close 불필요
