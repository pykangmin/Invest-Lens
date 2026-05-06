import { assertTicker, normalizeSearchQuery } from "../schema/api";
import type {
  CommoditiesResponse,
  CompanyMaster,
  CompanySnapshot,
  DbHealthResponse,
  GlobalEnvironmentResponse,
  MacroRegimeResponse,
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
