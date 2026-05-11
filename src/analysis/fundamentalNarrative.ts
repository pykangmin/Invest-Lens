// fundamentalNarrative — 펀더멘털 detail 페이지의 verdict / 섹션별 점수 /
// 5-card sub 정성 라벨 산출. fundamentalGauge 의 INFO/CAUTION/WARNING 만으론
// 부족한 detail 페이지 한정 텍스트 매핑을 모은다.

import type { StockFundamentals, PeerCompany } from "../types/investment";
import { normalize } from "./severity";

// ──────────────────────────────────────────────────────────────
// 1.4 / 3.6 — severity → 매수/매도 어휘
// ──────────────────────────────────────────────────────────────

export type VerdictKey = "buy" | "hold" | "sell";
export interface Verdict {
  key: VerdictKey;
  label: string;
  color: string;
}

export function verdictFromScore(score: number | null): Verdict {
  if (score == null) return { key: "hold", label: "데이터 없음", color: "#737373" };
  if (score >= 70) return { key: "buy", label: "매수 추천", color: "#60c846" };
  if (score >= 40) return { key: "hold", label: "유지", color: "#e5af43" };
  return { key: "sell", label: "매도 추천", color: "#c1121f" };
}

// ──────────────────────────────────────────────────────────────
// 2.4 / 2.5 / 2.6 / 3.2 — 4 카테고리 섹션별 점수
// ──────────────────────────────────────────────────────────────

export interface SectionScore {
  key: "cashflow" | "profitability" | "growth" | "valuation";
  label: string;
  score: number | null; // 0..max
  max: number;
  display: string; // "36 / 40점" 형식
}

function avgNorm(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => v != null);
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sectionScores(f: StockFundamentals | null): SectionScore[] {
  if (!f) {
    return [
      { key: "cashflow", label: "현금흐름 & 안정성", score: null, max: 40, display: "— / 40점" },
      { key: "profitability", label: "수익성", score: null, max: 25, display: "— / 25점" },
      { key: "growth", label: "성장성", score: null, max: 40, display: "— / 40점" },
      { key: "valuation", label: "가치평가", score: null, max: 40, display: "— / 40점" },
    ];
  }
  const cashflowNorm = avgNorm([
    normalize(f.fcfYield, 0.06, 0.01),
    normalize(f.fcfMargin, 0.20, 0.05),
    normalize(f.debtToEquity, 1.5, 4.0),
  ]);
  const profitabilityNorm = avgNorm([
    normalize(f.roe, 0.20, 0.05),
    normalize(f.netProfitMargin, 0.20, 0.05),
  ]);
  const growthNorm = avgNorm([
    normalize(f.revenueGrowth, 0.20, 0),
    normalize(f.epsGrowth, 0.20, 0),
  ]);
  const valuationNorm = avgNorm([
    normalize(f.per, 15, 60),
    normalize(f.pbr, 1.5, 6.0),
    normalize(f.evEbitda, 15, 30),
  ]);
  const toScore = (n: number | null, max: number) =>
    n == null ? null : Math.round((n / 100) * max);
  const cashflow = toScore(cashflowNorm, 40);
  const profitability = toScore(profitabilityNorm, 25);
  const growth = toScore(growthNorm, 40);
  const valuation = toScore(valuationNorm, 40);
  return [
    {
      key: "cashflow",
      label: "현금흐름 & 안정성",
      score: cashflow,
      max: 40,
      display: cashflow == null ? "— / 40점" : `${cashflow} / 40점`,
    },
    {
      key: "profitability",
      label: "수익성",
      score: profitability,
      max: 25,
      display: profitability == null ? "— / 25점" : `${profitability} / 25점`,
    },
    {
      key: "growth",
      label: "성장성",
      score: growth,
      max: 40,
      display: growth == null ? "— / 40점" : `${growth} / 40점`,
    },
    {
      key: "valuation",
      label: "가치평가",
      score: valuation,
      max: 40,
      display: valuation == null ? "— / 40점" : `${valuation} / 40점`,
    },
  ];
}

// 종합 점수 산출 (4 섹션 합 / max 합 × 100)
export function totalFromSections(sections: SectionScore[]): number | null {
  let sum = 0;
  let maxSum = 0;
  for (const s of sections) {
    if (s.score == null) continue;
    sum += s.score;
    maxSum += s.max;
  }
  if (maxSum === 0) return null;
  return Math.round((sum / maxSum) * 100);
}

// ──────────────────────────────────────────────────────────────
// 1.14 — peers ROE 순위 → "업종 최상위/상위/평균/하위"
// ──────────────────────────────────────────────────────────────

export function peerRankLabel(
  selfTicker: string,
  peers: PeerCompany[],
  key: "roe" | "per" | "pbr" | "netProfitMargin",
  higherIsBetter = true,
): string {
  const valued = peers
    .map((p) => ({ ticker: p.ticker, v: p[key] }))
    .filter((p): p is { ticker: string; v: number } => p.v != null);
  if (valued.length < 2) return "—";
  const self = valued.find((p) => p.ticker === selfTicker);
  if (!self) return "—";
  // 정렬 방향
  valued.sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v));
  const rank = valued.findIndex((p) => p.ticker === selfTicker) + 1;
  const pctile = rank / valued.length;
  if (rank === 1) return "업종 최상위";
  if (pctile <= 0.25) return "업종 상위";
  if (pctile <= 0.6) return "업종 평균";
  return "업종 하위";
}

// ──────────────────────────────────────────────────────────────
// 1.15 — revenueGrowth vs CPI YoY → "인플레 초과 달성/하회"
// ──────────────────────────────────────────────────────────────

export function growthVsInflationLabel(
  revenueGrowth: number | null,
  cpiYoy: number | null,
): string {
  if (revenueGrowth == null || cpiYoy == null) return "—";
  const diff = revenueGrowth - cpiYoy;
  if (diff >= 0.10) return "인플레 초과 달성";
  if (diff >= 0) return "인플레 상회";
  if (diff >= -0.05) return "인플레 근접";
  return "인플레 하회";
}

// CPI YoY 계산 — points 는 ASC 또는 DESC 무관, date 로 정렬해 최신/12개월 전 비교.
export function cpiYoyFrom(
  points: Array<{ date: string; value: number | null }>,
): number | null {
  if (points.length < 13) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  // 월별 데이터 가정 — 끝에서 12개 이전.
  const latest = sorted[sorted.length - 1]?.value;
  const yearAgo = sorted[sorted.length - 13]?.value;
  if (latest == null || yearAgo == null || yearAgo === 0) return null;
  return (latest - yearAgo) / yearAgo;
}

// ──────────────────────────────────────────────────────────────
// 1.16 — gross_margin_yoy → "+N%p↑ 완벽 방어/방어/훼손"
// ──────────────────────────────────────────────────────────────

export function marginDefenseLabel(grossMarginYoy: number | null): string {
  if (grossMarginYoy == null) return "—";
  const pp = grossMarginYoy * 100;
  const sign = pp > 0 ? "+" : "";
  const arrow = pp > 0 ? "↑" : pp < 0 ? "↓" : "·";
  const tone =
    pp >= 1 ? "완벽 방어" : pp >= 0 ? "방어" : pp >= -1 ? "소폭 훼손" : "마진 훼손";
  return `${sign}${pp.toFixed(0)}%p${arrow} ${tone}`;
}

// ──────────────────────────────────────────────────────────────
// 1.17 — ev_ebitda → "고평가/적정/저평가 구간"
// ──────────────────────────────────────────────────────────────

export function valuationZoneLabel(evEbitda: number | null): string {
  if (evEbitda == null) return "—";
  if (evEbitda >= 30) return "고평가 구간";
  if (evEbitda >= 15) return "적정 구간";
  return "저평가 구간";
}

// ──────────────────────────────────────────────────────────────
// 3.3 — pbr_z / forward_per_z → "멀티플 프리미엄/적정/디스카운트"
// ──────────────────────────────────────────────────────────────

export function multipleLabel(
  pbrZ: number | null,
  forwardPerZ: number | null,
): string {
  // 둘 다 결측이면 dash
  const zs = [pbrZ, forwardPerZ].filter((v): v is number => v != null);
  if (zs.length === 0) return "—";
  const avg = zs.reduce((a, b) => a + b, 0) / zs.length;
  if (avg >= 1.0) return "멀티플 프리미엄 반영";
  if (avg <= -1.0) return "디스카운트 반영";
  return "적정 멀티플";
}
