import type {
  CommodityPrice,
  CompanyMaster,
  GlobalEnvironmentPoint,
  FundamentalSectorStat,
  MacroRegimeScore,
  StockFundamentals,
  StockPriceTech,
  TechnicalMarketAveragePoint,
} from "../../src/types/investment.js";

export interface CompanyMasterRow {
  ticker: string;
  name: string;
  sector: string | null;
  sub_industry: string | null;
  updated_at: string | Date | null;
}

export interface StockFundamentalsRow {
  id: number;
  ticker: string;
  date: string | Date;
  market_cap: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  net_profit_margin: number | null;
  gross_margin: number | null;
  debt_to_equity: number | null;
  revenue_growth: number | null;
  eps_growth: number | null;
  ev_ebitda: number | null;
  fcf_yield: number | null;
  fcf_margin: number | null;
  ccc: number | null;
  gross_margin_yoy: number | null;
  pbr_z_score: number | null;
  forward_per_z_score: number | null;
}

export interface StockPriceTechRow {
  id: number;
  ticker: string;
  date: string | Date;
  close: number | null;
  volume: number | null;
  rsi_14: number | null;
  macd: number | null;
  ma_20: number | null;
  ma_50: number | null;
  ma_200: number | null;
}

export interface CommodityPriceRow {
  id: number;
  symbol: string;
  date: string | Date;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  category: string | null;
  unit: string | null;
}

export interface GlobalEnvironmentPointRow {
  id: number;
  date: string | Date;
  symbol: string;
  category: string;
  value: number;
}

export interface MacroRegimeScoreRow {
  id: number;
  date: string | Date;
  soft_landing_prob: number | null;
  hard_landing_prob: number | null;
  no_landing_prob: number | null;
  recovery_prob: number | null;
  dominant_regime: string | null;
  confidence: string | null;
  created_at: string | Date | null;
}

export interface FundamentalSectorStatRow {
  date: string | Date;
  sector: string;
  metric: string;
  sample_size: number;
  avg_value: number | null;
  median_value: number | null;
  p10_value: number | null;
  p90_value: number | null;
  winsorized_avg: number | null;
  updated_at: string | Date | null;
}

export interface TechnicalMarketAverageRow {
  date: string | Date;
  sample_size: number;
  avg_score: number;
  p10_score: number | null;
  p90_score: number | null;
  source: string | null;
  updated_at: string | Date | null;
}

function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function toIsoString(value: string | Date | null): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export function mapCompany(row: CompanyMasterRow): CompanyMaster {
  return {
    ticker: row.ticker,
    name: row.name,
    sector: row.sector,
    subIndustry: row.sub_industry,
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapFundamentals(row: StockFundamentalsRow): StockFundamentals {
  return {
    id: row.id,
    ticker: row.ticker,
    date: toDateString(row.date),
    marketCap: row.market_cap,
    per: row.per,
    pbr: row.pbr,
    roe: row.roe,
    netProfitMargin: row.net_profit_margin,
    grossMargin: row.gross_margin,
    debtToEquity: row.debt_to_equity,
    revenueGrowth: row.revenue_growth,
    epsGrowth: row.eps_growth,
    evEbitda: row.ev_ebitda,
    fcfYield: row.fcf_yield,
    fcfMargin: row.fcf_margin,
    ccc: row.ccc,
    grossMarginYoy: row.gross_margin_yoy,
    pbrZScore: row.pbr_z_score,
    forwardPerZScore: row.forward_per_z_score,
  };
}

export function mapTechnical(row: StockPriceTechRow): StockPriceTech {
  return {
    id: row.id,
    ticker: row.ticker,
    date: toDateString(row.date),
    close: row.close,
    volume: row.volume,
    rsi14: row.rsi_14,
    macd: row.macd,
    ma20: row.ma_20,
    ma50: row.ma_50,
    ma200: row.ma_200,
  };
}

export function mapCommodity(row: CommodityPriceRow): CommodityPrice {
  return {
    id: row.id,
    symbol: row.symbol,
    date: toDateString(row.date),
    close: row.close,
    open: row.open,
    high: row.high,
    low: row.low,
    volume: row.volume,
    category: row.category,
    unit: row.unit,
  };
}

export function mapGlobalEnvironment(
  row: GlobalEnvironmentPointRow,
): GlobalEnvironmentPoint {
  return {
    id: row.id,
    date: toDateString(row.date),
    symbol: row.symbol,
    category: row.category,
    value: row.value,
  };
}

export function mapMacroRegime(row: MacroRegimeScoreRow): MacroRegimeScore {
  return {
    id: row.id,
    date: toDateString(row.date),
    softLandingProb: row.soft_landing_prob,
    hardLandingProb: row.hard_landing_prob,
    noLandingProb: row.no_landing_prob,
    recoveryProb: row.recovery_prob,
    dominantRegime: row.dominant_regime,
    confidence: row.confidence,
    createdAt: toIsoString(row.created_at),
  };
}

export function mapFundamentalSectorStat(
  row: FundamentalSectorStatRow,
): FundamentalSectorStat {
  return {
    date: toDateString(row.date),
    sector: row.sector,
    metric: row.metric,
    sampleSize: row.sample_size,
    avgValue: row.avg_value,
    medianValue: row.median_value,
    p10Value: row.p10_value,
    p90Value: row.p90_value,
    winsorizedAvg: row.winsorized_avg,
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapTechnicalMarketAverage(
  row: TechnicalMarketAverageRow,
): TechnicalMarketAveragePoint {
  return {
    date: toDateString(row.date),
    sampleSize: row.sample_size,
    avgScore: row.avg_score,
    p10Score: row.p10_score,
    p90Score: row.p90_score,
    source: row.source ?? "stock_price_tech+market_index_prices",
    updatedAt: toIsoString(row.updated_at),
  };
}
