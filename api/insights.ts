import { query, queryOne } from "./_lib/db.js";
import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import {
  ApiError,
  assertGet,
  getQueryString,
  normalizeTicker,
  sendData,
  sendError,
} from "./_lib/http.js";
import type {
  CompanyMasterRow,
  CommodityPriceRow,
  MacroRegimeScoreRow,
  StockFundamentalsRow,
  StockPriceTechRow,
  TechnicalMarketAverageRow,
} from "./_lib/mappers.js";
import type {
  InsightCard,
  InsightCardsResponse,
  InsightSection,
  InsightSeverity,
} from "../src/types/investment.js";

type SectionFilter = InsightSection | "all";

const SECTIONS: InsightSection[] = [
  "fundamental",
  "technical",
  "macro",
  "commodity",
];

function normalizeSection(value: string): SectionFilter {
  const section = value.trim().toLowerCase();
  if (!section) return "all";
  if (section === "all" || SECTIONS.includes(section as InsightSection)) {
    return section as SectionFilter;
  }
  throw new ApiError("Invalid insight section.", 400);
}

function includesSection(filter: SectionFilter, section: InsightSection): boolean {
  return filter === "all" || filter === section;
}

function percent(value: number | null, fraction = true): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const scaled = fraction ? value * 100 : value;
  return `${scaled.toFixed(1)}%`;
}

function numberLabel(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

function severityFromMargin(value: number | null): InsightSeverity {
  if (value === null) return "neutral";
  if (value >= 0.4) return "positive";
  if (value < 0.2) return "warning";
  return "neutral";
}

function severityFromGrowth(value: number | null): InsightSeverity {
  if (value === null) return "neutral";
  if (value >= 0.1) return "positive";
  if (value < 0) return "warning";
  return "neutral";
}

function severityFromRsi(value: number | null): InsightSeverity {
  if (value === null) return "neutral";
  if (value >= 75 || value <= 25) return "risk";
  if (value >= 70 || value <= 30) return "warning";
  return "neutral";
}

function makeCard(
  id: string,
  section: InsightSection,
  title: string,
  body: string,
  severity: InsightSeverity,
  drivers: string[],
  asOfDate: string | Date | null,
): InsightCard {
  const date =
    asOfDate instanceof Date
      ? asOfDate.toISOString().slice(0, 10)
      : asOfDate;
  return { id, section, title, body, severity, drivers, asOfDate: date };
}

function fundamentalCards(row: StockFundamentalsRow | null): InsightCard[] {
  if (!row) {
    return [
      makeCard(
        "fundamental-missing",
        "fundamental",
        "Fundamental data unavailable",
        "No recent fundamental row is available for this ticker.",
        "neutral",
        [],
        null,
      ),
    ];
  }

  const cards: InsightCard[] = [
    makeCard(
      "fundamental-margin",
      "fundamental",
      "Gross margin",
      `Latest gross margin is ${percent(row.gross_margin)}. Gross margin is reported separately from gross margin YoY.`,
      severityFromMargin(row.gross_margin),
      ["gross_margin"],
      row.date,
    ),
  ];

  if (row.revenue_growth !== null || row.eps_growth !== null) {
    const growthSeverity =
      row.eps_growth !== null
        ? severityFromGrowth(row.eps_growth)
        : severityFromGrowth(row.revenue_growth);
    cards.push(
      makeCard(
        "fundamental-growth",
        "fundamental",
        "Growth mix",
        `Revenue growth is ${percent(row.revenue_growth)} and EPS growth is ${percent(row.eps_growth)}.`,
        growthSeverity,
        ["revenue_growth", "eps_growth"],
        row.date,
      ),
    );
  }

  if (row.per !== null || row.pbr !== null || row.roe !== null) {
    cards.push(
      makeCard(
        "fundamental-valuation",
        "fundamental",
        "Valuation inputs",
        `PER ${numberLabel(row.per)}, PBR ${numberLabel(row.pbr)}, ROE ${percent(row.roe)} are available for valuation scoring.`,
        "neutral",
        ["per", "pbr", "roe"],
        row.date,
      ),
    );
  }

  return cards;
}

function technicalCards(
  row: StockPriceTechRow | null,
  marketAverage: TechnicalMarketAverageRow | null,
): InsightCard[] {
  if (!row) {
    return [
      makeCard(
        "technical-missing",
        "technical",
        "Technical data unavailable",
        "No recent technical row is available for this ticker.",
        "neutral",
        [],
        null,
      ),
    ];
  }

  const cards: InsightCard[] = [
    makeCard(
      "technical-rsi",
      "technical",
      "RSI condition",
      `RSI(14) is ${numberLabel(row.rsi_14)}. Values near the edges can indicate stretched momentum.`,
      severityFromRsi(row.rsi_14),
      ["rsi_14"],
      row.date,
    ),
  ];

  if (row.close !== null && row.ma_20 !== null && row.ma_50 !== null) {
    const aboveMa20 = row.close >= row.ma_20;
    const aboveMa50 = row.close >= row.ma_50;
    cards.push(
      makeCard(
        "technical-moving-average",
        "technical",
        "Moving average position",
        `Close is ${aboveMa20 ? "above" : "below"} MA20 and ${aboveMa50 ? "above" : "below"} MA50.`,
        aboveMa20 && aboveMa50 ? "positive" : "warning",
        ["close", "ma_20", "ma_50"],
        row.date,
      ),
    );
  }

  if (marketAverage) {
    cards.push(
      makeCard(
        "technical-market-average",
        "technical",
        "Market average score",
        `The latest S&P 500 technical average score is ${numberLabel(marketAverage.avg_score)} from ${marketAverage.sample_size} stocks.`,
        "neutral",
        ["technical_score_market_avg.avg_score"],
        marketAverage.date,
      ),
    );
  }

  return cards;
}

function macroCards(row: MacroRegimeScoreRow | null): InsightCard[] {
  if (!row) return [];
  return [
    makeCard(
      "macro-regime",
      "macro",
      "Macro regime",
      `Dominant regime is ${row.dominant_regime ?? "n/a"} with ${row.confidence ?? "n/a"} confidence.`,
      row.dominant_regime === "HardLanding" ? "warning" : "neutral",
      [
        "soft_landing_prob",
        "hard_landing_prob",
        "no_landing_prob",
        "recovery_prob",
      ],
      row.date,
    ),
  ];
}

function commodityCards(rows: CommodityPriceRow[]): InsightCard[] {
  if (rows.length === 0) return [];
  const labels = rows
    .slice(0, 4)
    .map((row) => `${row.symbol} ${numberLabel(row.close, 2)}`)
    .join(", ");
  const latestDate = rows[0]?.date ?? null;
  return [
    makeCard(
      "commodity-latest",
      "commodity",
      "Commodity coverage",
      `Latest commodity levels are available for ${rows.length} symbols. Examples: ${labels}.`,
      "neutral",
      ["commodity_prices.close"],
      latestDate,
    ),
  ];
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (!assertGet(req, res)) {
    return;
  }

  try {
    const ticker = normalizeTicker(getQueryString(req, "ticker"));
    const section = normalizeSection(getQueryString(req, "section", "all"));

    const company = await queryOne<CompanyMasterRow>(
      `
        SELECT ticker, name, sector, sub_industry, updated_at
        FROM public.company_master
        WHERE ticker = $1
      `,
      [ticker],
    );

    if (!company) {
      throw new ApiError(`Company ${ticker} not found.`, 404);
    }

    const [
      fundamentals,
      technical,
      marketAverage,
      macroRegime,
      commodities,
    ] = await Promise.all([
      includesSection(section, "fundamental")
        ? queryOne<StockFundamentalsRow>(
            `
              SELECT *
              FROM public.stock_fundamentals
              WHERE ticker = $1
              ORDER BY date DESC
              LIMIT 1
            `,
            [ticker],
          )
        : Promise.resolve(null),
      includesSection(section, "technical")
        ? queryOne<StockPriceTechRow>(
            `
              SELECT *
              FROM public.stock_price_tech
              WHERE ticker = $1
                AND close IS NOT NULL
              ORDER BY date DESC
              LIMIT 1
            `,
            [ticker],
          )
        : Promise.resolve(null),
      includesSection(section, "technical")
        ? queryOne<TechnicalMarketAverageRow>(
            `
              SELECT date, sample_size, avg_score, p10_score, p90_score, source, updated_at
              FROM public.technical_score_market_avg
              ORDER BY date DESC
              LIMIT 1
            `,
          )
        : Promise.resolve(null),
      includesSection(section, "macro")
        ? queryOne<MacroRegimeScoreRow>(
            `
              SELECT *
              FROM public.macro_regime_scores
              ORDER BY date DESC
              LIMIT 1
            `,
          )
        : Promise.resolve(null),
      includesSection(section, "commodity")
        ? query<CommodityPriceRow>(
            `
              SELECT DISTINCT ON (symbol) *
              FROM public.commodity_prices
              WHERE symbol = ANY($1::text[])
              ORDER BY symbol, date DESC
            `,
            [["CL=F", "NG=F", "GC=F", "SI=F", "HG=F", "LIT", "REMX"]],
          )
        : Promise.resolve([]),
    ]);

    const cards: InsightCard[] = [
      ...(includesSection(section, "fundamental")
        ? fundamentalCards(fundamentals)
        : []),
      ...(includesSection(section, "technical")
        ? technicalCards(technical, marketAverage)
        : []),
      ...(includesSection(section, "macro") ? macroCards(macroRegime) : []),
      ...(includesSection(section, "commodity") ? commodityCards(commodities) : []),
    ];

    const payload: InsightCardsResponse = {
      ticker: company.ticker,
      generatedAt: new Date().toISOString(),
      cards,
    };

    sendData(res, payload);
  } catch (error) {
    sendError(res, error);
  }
}
