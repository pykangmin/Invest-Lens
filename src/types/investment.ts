export interface CompanyMaster {
  ticker: string;
  name: string;
  sector: string | null;
  subIndustry: string | null;
  updatedAt: string | null;
}

export interface StockFundamentals {
  id: number;
  ticker: string;
  date: string;
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  netProfitMargin: number | null;
  grossMargin: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  evEbitda: number | null;
  fcfYield: number | null;
  fcfMargin: number | null;
  ccc: number | null;
  grossMarginYoy: number | null;
  pbrZScore: number | null;
  forwardPerZScore: number | null;
}

export interface StockPriceTech {
  id: number;
  ticker: string;
  date: string;
  close: number | null;
  volume: number | null;
  rsi14: number | null;
  macd: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
}

export interface GlobalEnvironmentPoint {
  id: number;
  date: string;
  symbol: string;
  category: string;
  value: number;
}

export interface MarketIndexPoint {
  symbol: string;
  name: string;
  date: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  source: string;
  isFilled: boolean;
  sourceDate: string | null;
}

export interface FxRatePoint {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  date: string;
  rate: number;
  open: number | null;
  high: number | null;
  low: number | null;
  source: string;
  isFilled: boolean;
  sourceDate: string | null;
}

export interface CommodityPrice {
  id: number;
  symbol: string;
  date: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  category: string | null;
  unit: string | null;
}

export interface MacroRegimeScore {
  id: number;
  date: string;
  softLandingProb: number | null;
  hardLandingProb: number | null;
  noLandingProb: number | null;
  recoveryProb: number | null;
  dominantRegime: string | null;
  confidence: string | null;
  createdAt: string | null;
}

export interface FundamentalSectorStat {
  date: string;
  sector: string;
  metric: string;
  sampleSize: number;
  avgValue: number | null;
  medianValue: number | null;
  p10Value: number | null;
  p90Value: number | null;
  winsorizedAvg: number | null;
  updatedAt: string | null;
}

export interface FundamentalSectorStatsResponse {
  latestDate: string | null;
  sector: string | null;
  metric: string | null;
  items: FundamentalSectorStat[];
}

export interface TechnicalMarketAveragePoint {
  date: string;
  sampleSize: number;
  avgScore: number;
  p10Score: number | null;
  p90Score: number | null;
  source: string;
  updatedAt: string | null;
}

export interface TechnicalMarketAverageResponse {
  latest: TechnicalMarketAveragePoint | null;
  history: TechnicalMarketAveragePoint[];
}

export interface CommodityMetricPoint {
  symbol: string;
  category: string | null;
  unit: string | null;
  latestDate: string;
  latestClose: number;
  startDate: string;
  startClose: number;
  returnPct: number | null;
  annualizedVolatilityPct: number | null;
  averageVolume: number | null;
  sampleSize: number;
  bubbleSize: number;
}

export interface CommodityMetricsResponse {
  lookbackDays: number;
  items: CommodityMetricPoint[];
}

export type InsightSection =
  | "fundamental"
  | "technical"
  | "macro"
  | "commodity";

export type InsightSeverity = "positive" | "neutral" | "warning" | "risk";

export interface InsightCard {
  id: string;
  section: InsightSection;
  title: string;
  body: string;
  severity: InsightSeverity;
  drivers: string[];
  asOfDate: string | null;
}

export interface InsightCardsResponse {
  ticker: string;
  generatedAt: string;
  cards: InsightCard[];
}

export interface CompanySnapshot {
  company: CompanyMaster;
  latestFundamentals: StockFundamentals | null;
  fundamentalsHistory: StockFundamentals[];
  latestTechnical: StockPriceTech | null;
  technicalHistory: StockPriceTech[];
}

export interface MacroRegimeResponse {
  latest: MacroRegimeScore | null;
  history: MacroRegimeScore[];
}

export interface CommoditiesResponse {
  latest: CommodityPrice[];
  history: CommodityPrice[];
}

export interface GlobalEnvironmentResponse {
  latest: GlobalEnvironmentPoint[];
  history: GlobalEnvironmentPoint[];
}

export interface MarketIndexResponse {
  symbol: string;
  latest: MarketIndexPoint | null;
  history: MarketIndexPoint[];
  source: "db" | "external";
}

export interface FxRateResponse {
  pair: string;
  latest: FxRatePoint | null;
  history: FxRatePoint[];
  source: "db" | "external";
}

export interface DbTableHealth {
  tableName: string;
  rows: number;
  minDate: string | null;
  maxDate: string | null;
}

export interface DbHealthResponse {
  ok: boolean;
  checkedAt: string;
  tables: DbTableHealth[];
}
