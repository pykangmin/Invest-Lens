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
  ma50: number | null;
  ma200: number | null;
  // 2026-05 보강: MA20·MACD signal·Super Trend 직값. close 와 다른 일자 row 에 채워질 수 있음.
  ma20: number | null;
  macdSignal: number | null;
  supertrendSignal: "Buy" | "Sell" | null;
  supertrendValue: number | null;
  supertrendDays: number | null;
}

// 신호 컬럼만 채워진 latest row (close 부재). technicalHistory 와 별도 트랙.
export interface TechnicalSignalSnapshot {
  date: string;
  ma20: number | null;
  macdSignal: number | null;
  supertrendSignal: "Buy" | "Sell" | null;
  supertrendValue: number | null;
  supertrendDays: number | null;
}

export interface GlobalEnvironmentPoint {
  id: number;
  date: string;
  symbol: string;
  category: string;
  value: number;
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

export interface CompanySnapshot {
  company: CompanyMaster;
  latestFundamentals: StockFundamentals | null;
  fundamentalsHistory: StockFundamentals[];
  latestTechnical: StockPriceTech | null;
  technicalHistory: StockPriceTech[];
  // 2026-05 보강. supertrend_signal IS NOT NULL 최신 row — close 와 다른 날짜.
  latestSignals: TechnicalSignalSnapshot | null;
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

// 2026-05 — /api/peers 동종업계 비교 응답.
export interface PeerCompany {
  ticker: string;
  name: string;
  subIndustry: string | null;
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  netProfitMargin: number | null;
  fcfYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  roeSeries: Array<number | null>;
  isSelf: boolean;
}

export interface PeersResponse {
  ticker: string;
  sector: string | null;
  peers: PeerCompany[];
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
