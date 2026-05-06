export type Severity = "WARNING" | "CAUTION" | "INFO";

export type GaugeId =
  | "fundamental"
  | "technical"
  | "macro"
  | "commodity"
  | "sentiment";

export interface GaugeScore {
  id: GaugeId;
  label: string;
  tagline: string;
  score: number | null;
  severity: Severity;
  available: boolean;
}

export interface CompositeScores {
  fundamental: number | null;
  technical: number | null;
  macroEnvironment: number | null;
}

export type EventKind =
  | "earnings"
  | "supertrend_flip"
  | "macd_cross"
  | "regime_shift";

export interface AnalysisEvent {
  date: string;
  kind: EventKind;
  title: string;
  detail: string;
  severity: Severity;
  category?: string; // 한글 카테고리 라벨 (예: "거시지표", "기술 신호", "실적")
  time?: string;     // 시각 표기 (예: "금 08:30 ET")
}

export interface AnalysisInsight {
  id: string;
  title: string;
  body: string;
  severity: Severity;
}

export interface AnalysisResult {
  gauges: Record<GaugeId, GaugeScore>;
  composite: CompositeScores;
  events: AnalysisEvent[];
  insights: AnalysisInsight[];
}
