import { assertTicker, normalizeSearchQuery } from "../schema/api";
import type {
  CommoditiesResponse,
  CommodityMetricsResponse,
  CompanyMaster,
  CompanySnapshot,
  DbHealthResponse,
  FundamentalSectorStatsResponse,
  FxRateResponse,
  GlobalEnvironmentResponse,
  InsightCardsResponse,
  InsightSection,
  MacroRegimeResponse,
  MarketIndexResponse,
  TechnicalMarketAverageResponse,
} from "../types/investment";
import { fetchApiData } from "./apiClient";

export async function loadDbHealth(): Promise<DbHealthResponse> {
  return fetchApiData<DbHealthResponse>("/api/db-health");
}

export async function searchCompanies(query = "", limit = 25): Promise<CompanyMaster[]> {
  const params = new URLSearchParams({
    q: normalizeSearchQuery(query),
    limit: String(limit),
  });

  return fetchApiData<CompanyMaster[]>(`/api/companies?${params}`);
}

export async function loadCompanySnapshot(
  ticker: string,
  historyLimit = 252,
): Promise<CompanySnapshot> {
  const params = new URLSearchParams({
    ticker: assertTicker(ticker),
    historyLimit: String(historyLimit),
  });

  return fetchApiData<CompanySnapshot>(`/api/company?${params}`);
}

export async function loadMacroRegime(limit = 36): Promise<MacroRegimeResponse> {
  const params = new URLSearchParams({ limit: String(limit) });

  return fetchApiData<MacroRegimeResponse>(`/api/macro-regime?${params}`);
}

export async function loadGlobalEnvironment(
  options: { symbol?: string; category?: string; historyLimit?: number } = {},
): Promise<GlobalEnvironmentResponse> {
  const params = new URLSearchParams({
    historyLimit: String(options.historyLimit ?? 240),
  });

  if (options.symbol) {
    params.set("symbol", options.symbol);
  }

  if (options.category) {
    params.set("category", options.category);
  }

  return fetchApiData<GlobalEnvironmentResponse>(`/api/global-environment?${params}`);
}

export async function loadMarketIndex(
  symbol = "^GSPC",
  historyLimit = 252,
): Promise<MarketIndexResponse> {
  const params = new URLSearchParams({
    symbol,
    historyLimit: String(historyLimit),
  });

  return fetchApiData<MarketIndexResponse>(`/api/market-index?${params}`);
}

export async function loadFxRate(
  pair = "USD/KRW",
  historyLimit = 252,
): Promise<FxRateResponse> {
  const params = new URLSearchParams({
    pair,
    historyLimit: String(historyLimit),
  });

  return fetchApiData<FxRateResponse>(`/api/fx-rates?${params}`);
}

export async function loadCommodities(
  symbol?: string,
  historyLimit = 180,
): Promise<CommoditiesResponse> {
  const params = new URLSearchParams({ historyLimit: String(historyLimit) });

  if (symbol) {
    params.set("symbol", symbol);
  }

  return fetchApiData<CommoditiesResponse>(`/api/commodities?${params}`);
}

export async function loadCommodityMetrics(
  options: { symbol?: string; lookbackDays?: number } = {},
): Promise<CommodityMetricsResponse> {
  const params = new URLSearchParams({
    lookbackDays: String(options.lookbackDays ?? 252),
  });

  if (options.symbol) {
    params.set("symbol", options.symbol);
  }

  return fetchApiData<CommodityMetricsResponse>(`/api/commodity-metrics?${params}`);
}

export async function loadTechnicalMarketAverage(
  limit = 30,
): Promise<TechnicalMarketAverageResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  return fetchApiData<TechnicalMarketAverageResponse>(
    `/api/technical-market-average?${params}`,
  );
}

export async function loadFundamentalSectorStats(
  options: {
    sector?: string;
    metric?: string;
    date?: string;
    limit?: number;
  } = {},
): Promise<FundamentalSectorStatsResponse> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 200) });

  if (options.sector) {
    params.set("sector", options.sector);
  }

  if (options.metric) {
    params.set("metric", options.metric);
  }

  if (options.date) {
    params.set("date", options.date);
  }

  return fetchApiData<FundamentalSectorStatsResponse>(
    `/api/fundamental-sector-stats?${params}`,
  );
}

export async function loadInsightCards(
  ticker: string,
  section: InsightSection | "all" = "all",
): Promise<InsightCardsResponse> {
  const params = new URLSearchParams({
    ticker: assertTicker(ticker),
    section,
  });

  return fetchApiData<InsightCardsResponse>(`/api/insights?${params}`);
}

export interface DashboardEnvironment {
  macroRegime: MacroRegimeResponse;
  dollarIndex: GlobalEnvironmentResponse;
  vix: GlobalEnvironmentResponse;
  treasury10y: GlobalEnvironmentResponse;
  highYieldSpread: GlobalEnvironmentResponse;
  commodities: CommoditiesResponse;
}

export type ScreenCategory = "priceUp" | "priceDown" | "volume" | "scoreTop";

export interface ScreenItem {
  ticker: string;
  name: string | null;
  metric: number | null;
}

export interface ScreenResponse {
  category: ScreenCategory;
  items: ScreenItem[];
}

export async function loadScreen(
  category: ScreenCategory,
  limit = 3,
): Promise<ScreenResponse> {
  const params = new URLSearchParams({ category, limit: String(limit) });
  return fetchApiData<ScreenResponse>(`/api/screen?${params}`);
}

// 대시보드 한 번에 필요한 환경 데이터를 묶어 받음.
// 시장 지수(SP500/Dow/Nasdaq) 가격은 DB 부재 — docs/figma/dashboard-slots.md 의
// H3 결정에 따라 위험·시장 지표 4종(VIX/DXY/10Y/HY Spread) 으로 대체.
export async function loadDashboardEnvironment(): Promise<DashboardEnvironment> {
  const [macroRegime, dollarIndex, vix, treasury10y, highYieldSpread, commodities] =
    await Promise.all([
      loadMacroRegime(36),
      loadGlobalEnvironment({ symbol: "DX-Y.NYB", historyLimit: 120 }),
      loadGlobalEnvironment({ symbol: "^VIX", historyLimit: 120 }),
      loadGlobalEnvironment({ symbol: "DGS10", historyLimit: 120 }),
      loadGlobalEnvironment({ symbol: "BAMLH0A0HYM2", historyLimit: 120 }),
      loadCommodities(undefined, 120),
    ]);
  return {
    macroRegime,
    dollarIndex,
    vix,
    treasury10y,
    highYieldSpread,
    commodities,
  };
}
