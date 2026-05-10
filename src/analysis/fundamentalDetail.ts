// fundamentalDetail — 펀더멘털 detail 페이지용 9 지표 분해 + 분기 시계열.
// fundamentalGauge 가 노출하지 않는 metric별 score / 분기별 추이를 분리해서 제공.

import type { StockFundamentals } from "../types/investment";
import { normalize } from "./severity";

export type FundamentalMetricKey =
  | "roe"
  | "netProfitMargin"
  | "fcfYield"
  | "fcfMargin"
  | "debtToEquity"
  | "per"
  | "pbr"
  | "revenueGrowth"
  | "epsGrowth";

export interface FundamentalMetric {
  key: FundamentalMetricKey;
  label: string;
  /** 원시 값 (% 또는 배수 그대로) */
  value: number | null;
  /** 표기용 문자열 (예: "12.4%", "32x") */
  display: string;
  /** 0~100 정규화 점수 (분석 score) — null 이면 결측 */
  score: number | null;
  /** 색조 — score 기반 자동 */
  tone: "up" | "down" | "neutral";
  /** 보조 설명 — 기준 임계 */
  note: string;
}

const METRIC_CONFIG: Array<{
  key: FundamentalMetricKey;
  label: string;
  good: number;
  bad: number;
  format: (v: number) => string;
  note: string;
}> = [
  {
    key: "roe",
    label: "ROE",
    good: 0.20,
    bad: 0.05,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    note: "20%↑ 양호 / 5%↓ 부진",
  },
  {
    key: "netProfitMargin",
    label: "순이익률",
    good: 0.20,
    bad: 0.05,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    note: "20%↑ 양호 / 5%↓ 부진",
  },
  {
    key: "fcfMargin",
    label: "FCF Margin",
    good: 0.20,
    bad: 0.05,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    note: "20%↑ 양호",
  },
  {
    key: "fcfYield",
    label: "FCF Yield",
    good: 0.06,
    bad: 0.01,
    format: (v) => `${(v * 100).toFixed(2)}%`,
    note: "6%↑ 양호",
  },
  {
    key: "revenueGrowth",
    label: "매출 성장",
    good: 0.20,
    bad: 0,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    note: "20%↑ 강세",
  },
  {
    key: "epsGrowth",
    label: "EPS 성장",
    good: 0.20,
    bad: 0,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    note: "20%↑ 강세",
  },
  {
    key: "debtToEquity",
    label: "부채비율",
    good: 1.5,
    bad: 4.0,
    format: (v) => v.toFixed(2),
    note: "1.5↓ 안전 / 4.0↑ 위험",
  },
  {
    key: "per",
    label: "PER",
    good: 15,
    bad: 60,
    format: (v) => `${v.toFixed(1)}x`,
    note: "15↓ 양호 / 60↑ 부담",
  },
  {
    key: "pbr",
    label: "PBR",
    good: 1.5,
    bad: 6.0,
    format: (v) => `${v.toFixed(2)}x`,
    note: "1.5↓ 양호 / 6.0↑ 부담",
  },
];

function rawValueFor(key: FundamentalMetricKey, f: StockFundamentals): number | null {
  switch (key) {
    case "roe":
      return f.roe;
    case "netProfitMargin":
      return f.netProfitMargin;
    case "fcfYield":
      return f.fcfYield;
    case "fcfMargin":
      return f.fcfMargin;
    case "debtToEquity":
      return f.debtToEquity;
    case "per":
      return f.per;
    case "pbr":
      return f.pbr;
    case "revenueGrowth":
      return f.revenueGrowth;
    case "epsGrowth":
      return f.epsGrowth;
  }
}

function toneOf(score: number | null): "up" | "down" | "neutral" {
  if (score == null) return "neutral";
  if (score >= 60) return "up";
  if (score < 30) return "down";
  return "neutral";
}

export function fundamentalMetrics(f: StockFundamentals | null): FundamentalMetric[] {
  if (!f) {
    return METRIC_CONFIG.map((c) => ({
      key: c.key,
      label: c.label,
      value: null,
      display: "—",
      score: null,
      tone: "neutral",
      note: c.note,
    }));
  }
  return METRIC_CONFIG.map((c) => {
    const raw = rawValueFor(c.key, f);
    const score = normalize(raw, c.good, c.bad);
    return {
      key: c.key,
      label: c.label,
      value: raw,
      display: raw != null && Number.isFinite(raw) ? c.format(raw) : "—",
      score,
      tone: toneOf(score),
      note: c.note,
    };
  });
}

// 분기 추이 시계열 — 각 metric 별로 history 의 시간순 값.
export interface FundamentalSeries {
  key: FundamentalMetricKey;
  label: string;
  /** ASC (오래된 → 최신) */
  values: Array<number | null>;
  dates: string[];
}

export function fundamentalQuarterlySeries(
  history: StockFundamentals[],
  keys: FundamentalMetricKey[],
): FundamentalSeries[] {
  const asc = [...history].reverse();
  const dates = asc.map((h) => h.date);
  return keys.map((key) => {
    const cfg = METRIC_CONFIG.find((c) => c.key === key)!;
    return {
      key,
      label: cfg.label,
      values: asc.map((h) => rawValueFor(key, h)),
      dates,
    };
  });
}

// fundamentalGauge 의 분해 ─ 어떤 metric 이 종합 점수에 얼마나 기여했나.
export interface FundamentalContribution {
  metrics: FundamentalMetric[];
  /** 결측 제외 평균 — fundamentalGauge 와 같은 방식 */
  totalScore: number | null;
}

export function fundamentalContribution(
  f: StockFundamentals | null,
): FundamentalContribution {
  const metrics = fundamentalMetrics(f);
  // gauge 가 사용하는 5개 (roe, npm, fcfYield, debtToEquity, per) 만 합산
  const used = metrics.filter((m) =>
    ["roe", "netProfitMargin", "fcfYield", "debtToEquity", "per"].includes(m.key),
  );
  const valid = used.filter((m) => m.score != null);
  const total = valid.length > 0
    ? valid.reduce((s, m) => s + (m.score ?? 0), 0) / valid.length
    : null;
  return { metrics, totalScore: total != null ? Math.round(total) : null };
}
