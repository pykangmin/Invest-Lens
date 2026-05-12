// fundamentalNarrative — 펀더멘털 detail 페이지의 verdict / 섹션별 점수 /
// 5-card sub 정성 라벨 산출. fundamentalGauge 의 INFO/CAUTION/WARNING 만으론
// 부족한 detail 페이지 한정 텍스트 매핑을 모은다.

import type { PeerCompany, SectorAvgMetric, StockFundamentals } from "../types/investment";
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
  // 시안 max: 현금흐름 40 / 수익성 25 / 가치평가 25 / 성장성 10 = 총 100
  if (!f) {
    return [
      { key: "cashflow", label: "현금흐름 & 안정성", score: null, max: 40, display: "— / 40점" },
      { key: "profitability", label: "수익성", score: null, max: 25, display: "— / 25점" },
      { key: "valuation", label: "가치평가", score: null, max: 25, display: "— / 25점" },
      { key: "growth", label: "성장성", score: null, max: 10, display: "— / 10점" },
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
  const growth = toScore(growthNorm, 10);
  const valuation = toScore(valuationNorm, 25);
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
      key: "valuation",
      label: "가치평가",
      score: valuation,
      max: 25,
      display: valuation == null ? "— / 25점" : `${valuation} / 25점`,
    },
    {
      key: "growth",
      label: "성장성",
      score: growth,
      max: 10,
      display: growth == null ? "— / 10점" : `${growth} / 10점`,
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

// ──────────────────────────────────────────────────────────────
// §2 현금흐름 & 안정성 — grouped bar chart 데이터 + 하단 3행 지표
// ──────────────────────────────────────────────────────────────

export interface CashflowChartData {
  bars: Array<{
    label: string; // "FY22" 등
    revenue: number | null; // $B
    fcf: number | null; // $B
  }>;
}

// fundamentalsHistory(분기, DESC 가정) 의 최근 4 분기를 4 bar 로 표시.
// FCF = market_cap × fcf_yield, Revenue = FCF / fcf_margin 으로 역산.
// 모두 $B 단위.
export function cashflowChartData(history: StockFundamentals[]): CashflowChartData {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last4 = asc.slice(-4);
  const bars = last4.map((f) => {
    const fcfAbs =
      f.marketCap != null && f.fcfYield != null
        ? (f.marketCap * f.fcfYield) / 1e9
        : null;
    const revenueAbs =
      fcfAbs != null && f.fcfMargin != null && f.fcfMargin !== 0
        ? fcfAbs / f.fcfMargin
        : null;
    return {
      label: quarterLabel(f.date),
      revenue: revenueAbs,
      fcf: fcfAbs,
    };
  });
  return { bars };
}

// §2 하단 3행 지표 (FCF Yield / FCF Margin / CCC) + 직전 분기 대비 Δ
export interface CashflowIndicator {
  letter: string; // "A" / "B" / "C"
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
}

function fmtDelta(diff: number, unit: string): string {
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(0)}${unit}`;
}

export function cashflowIndicators(history: StockFundamentals[]): CashflowIndicator[] {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = asc[asc.length - 1];
  const prev = asc[asc.length - 2];

  // display 가 "0" 으로 반올림되는 범위면 gray (보합)
  const isZeroDisplay = (d: number) => Math.abs(d) < 0.5;

  // A. FCF Yield (% 단위, 상승=개선)
  const yieldCur = latest?.fcfYield ?? null;
  const yieldPrv = prev?.fcfYield ?? null;
  const yieldVal = yieldCur != null ? `${(yieldCur * 100).toFixed(1)}%` : "—";
  let yieldDelta = "—";
  let yieldColor = "#737474";
  if (yieldCur != null && yieldPrv != null) {
    const d = (yieldCur - yieldPrv) * 100;
    yieldDelta = fmtDelta(d, "pt");
    yieldColor = isZeroDisplay(d) ? "#737474" : d > 0 ? "#43bb2e" : "#c1121f";
  }

  // B. FCF Margin (% 단위, 상승=개선)
  const marginCur = latest?.fcfMargin ?? null;
  const marginPrv = prev?.fcfMargin ?? null;
  const marginVal = marginCur != null ? `~${(marginCur * 100).toFixed(0)}%` : "—";
  let marginDelta = "—";
  let marginColor = "#737474";
  if (marginCur != null && marginPrv != null) {
    const d = (marginCur - marginPrv) * 100;
    marginDelta = fmtDelta(d, "pt");
    marginColor = isZeroDisplay(d) ? "#737474" : d > 0 ? "#43bb2e" : "#c1121f";
  }

  // C. CCC (현금창출주기, 일 단위, 감소=개선)
  const cccCur = latest?.ccc ?? null;
  const cccPrv = prev?.ccc ?? null;
  const cccVal = cccCur != null ? `${cccCur.toFixed(0)}일` : "—";
  let cccDelta = "—";
  let cccColor = "#737474";
  if (cccCur != null && cccPrv != null) {
    const d = cccCur - cccPrv;
    cccDelta = fmtDelta(d, "일");
    // CCC 작을수록 개선
    cccColor = isZeroDisplay(d) ? "#737474" : d < 0 ? "#43bb2e" : "#c1121f";
  }

  return [
    { letter: "A", label: "FCF Yield", value: yieldVal, delta: yieldDelta, deltaColor: yieldColor },
    { letter: "B", label: "FCF Margin", value: marginVal, delta: marginDelta, deltaColor: marginColor },
    { letter: "C", label: "CCC (현금창출주기)", value: cccVal, delta: cccDelta, deltaColor: cccColor },
  ];
}

// ──────────────────────────────────────────────────────────────
// §2-B 수익성 — line chart (Net Margin / ROE, %) + 하단 2행 indicator
// Gross Margin 절대값은 DB 결측 → netProfitMargin 으로 대체.
// ──────────────────────────────────────────────────────────────

export interface ProfitabilityChartData {
  points: Array<{
    label: string;
    netMargin: number | null; // %
    roe: number | null; // %
  }>;
}

export function profitabilityChartData(
  history: StockFundamentals[],
): ProfitabilityChartData {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last4 = asc.slice(-4);
  const points = last4.map((f) => ({
    label: quarterLabel(f.date),
    netMargin: f.netProfitMargin != null ? f.netProfitMargin * 100 : null,
    roe: f.roe != null ? f.roe * 100 : null,
  }));
  return { points };
}

export function profitabilityIndicators(
  history: StockFundamentals[],
): CashflowIndicator[] {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = asc[asc.length - 1];
  const prev = asc[asc.length - 2];

  const isZeroDisplay = (d: number) => Math.abs(d) < 0.5;

  // A. Gross Margin YoY (이미 변화량 — × 100 그대로 표시)
  const gmYoyCur = latest?.grossMarginYoy ?? null;
  const gmYoyPrv = prev?.grossMarginYoy ?? null;
  let gmYoyVal = "—";
  if (gmYoyCur != null) {
    const pct = gmYoyCur * 100;
    const sign = pct > 0 ? "+" : "";
    const arrow = pct > 0.5 ? " ↑" : pct < -0.5 ? " ↓" : "";
    gmYoyVal = `${sign}${pct.toFixed(0)}%p${arrow}`;
  }
  let gmDelta = "—";
  let gmColor = "#737474";
  if (gmYoyCur != null && gmYoyPrv != null) {
    const d = (gmYoyCur - gmYoyPrv) * 100;
    gmDelta = fmtDelta(d, "pt");
    gmColor = isZeroDisplay(d) ? "#737474" : d > 0 ? "#43bb2e" : "#c1121f";
  }

  // B. ROE (% 단위)
  const roeCur = latest?.roe ?? null;
  const roePrv = prev?.roe ?? null;
  const roeVal = roeCur != null ? `${(roeCur * 100).toFixed(1)}%` : "—";
  let roeDelta = "—";
  let roeColor = "#737474";
  if (roeCur != null && roePrv != null) {
    const d = (roeCur - roePrv) * 100;
    roeDelta = fmtDelta(d, "pt");
    roeColor = isZeroDisplay(d) ? "#737474" : d > 0 ? "#43bb2e" : "#c1121f";
  }

  return [
    { letter: "A", label: "Gross Margin YoY", value: gmYoyVal, delta: gmDelta, deltaColor: gmColor },
    { letter: "B", label: "ROE", value: roeVal, delta: roeDelta, deltaColor: roeColor },
  ];
}

// ──────────────────────────────────────────────────────────────
// §2-C 성장성 — single-series bar chart (Revenue Growth YoY, %)
// 음수도 포함될 수 있어 0% baseline 기준.
// 하단 2행 indicator: Revenue Growth YoY / EPS Growth YoY
// ──────────────────────────────────────────────────────────────

export interface GrowthChartData {
  bars: Array<{
    label: string;
    revenue: number | null; // % (YoY)
  }>;
}

export function growthChartData(history: StockFundamentals[]): GrowthChartData {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last4 = asc.slice(-4);
  const bars = last4.map((f) => ({
    label: quarterLabel(f.date),
    revenue: f.revenueGrowth != null ? f.revenueGrowth * 100 : null,
  }));
  return { bars };
}

function quarterOf(date: string): number {
  // date "YYYY-MM-DD" → 분기 1-4
  const m = parseInt(date.slice(5, 7), 10);
  if (!Number.isFinite(m)) return 1;
  return Math.min(4, Math.max(1, Math.ceil(m / 3)));
}

function quarterLabel(date: string): string {
  // 분기 라벨 — '25Q2 형식. 세 차트 X축 라벨 통일.
  return `'${date.slice(2, 4)}Q${quarterOf(date)}`;
}

export function growthIndicators(history: StockFundamentals[]): CashflowIndicator[] {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = asc[asc.length - 1];
  const prev = asc[asc.length - 2];

  const isZeroDisplay = (d: number) => Math.abs(d) < 0.5;
  const fmtPctSigned = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;

  // Revenue Growth YoY
  const revCur = latest?.revenueGrowth ?? null;
  const revPrv = prev?.revenueGrowth ?? null;
  const revVal = revCur != null ? fmtPctSigned(revCur) : "—";
  let revDelta = "—";
  let revColor = "#737474";
  if (revCur != null && revPrv != null) {
    const d = (revCur - revPrv) * 100;
    revDelta = fmtDelta(d, "pt");
    revColor = isZeroDisplay(d) ? "#737474" : d > 0 ? "#43bb2e" : "#c1121f";
  }

  // EPS Growth YoY
  const epsCur = latest?.epsGrowth ?? null;
  const epsPrv = prev?.epsGrowth ?? null;
  const epsVal = epsCur != null ? fmtPctSigned(epsCur) : "—";
  let epsDelta = "—";
  let epsColor = "#737474";
  if (epsCur != null && epsPrv != null) {
    const d = (epsCur - epsPrv) * 100;
    epsDelta = fmtDelta(d, "pt");
    epsColor = isZeroDisplay(d) ? "#737474" : d > 0 ? "#43bb2e" : "#c1121f";
  }

  return [
    { letter: "", label: "Revenue Growth YoY", value: revVal, delta: revDelta, deltaColor: revColor },
    { letter: "", label: "EPS Growth YoY", value: epsVal, delta: epsDelta, deltaColor: epsColor },
  ];
}

// ──────────────────────────────────────────────────────────────
// §3-A 가치평가 — 3행 indicator (EV/EBITDA / PBR Z / Forward PER Z)
//   + 7축 레이더 차트 데이터
// ──────────────────────────────────────────────────────────────

export interface ValuationIndicator {
  letter: string;
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
  /** bar 채움 비율 0~1 */
  fillRatio: number;
  /** bar 색 */
  barColor: string;
  /** 부연 한 줄 */
  note: string;
}

// 값의 임계 구간 → 색 매핑 (양호=green / 적정=yellow / 경계=orange / 위험=red)
function tierColorEv(v: number | null): string {
  if (v == null) return "#9a9a9a";
  if (v < 15) return "#43bb2e";   // 저평가/양호
  if (v < 25) return "#e5af43";   // 적정
  if (v < 35) return "#fdb43a";   // 경계
  return "#c1121f";                // 위험
}
function tierColorZ(z: number | null): string {
  // z-score 범용 (양수일수록 고평가/위험)
  if (z == null) return "#9a9a9a";
  if (z < -0.5) return "#43bb2e";
  if (z < 0.5) return "#e5af43";
  if (z < 1.0) return "#fdb43a";
  return "#c1121f";
}

export function valuationIndicators(
  history: StockFundamentals[],
): ValuationIndicator[] {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = asc[asc.length - 1];
  const prev = asc[asc.length - 2];

  // chip Δ = 양호도 점수 (0~100) 의 변화. 단순 부호: 양수=개선 green, 음수=악화 red.
  const isZeroDisplay = (d: number) => Math.abs(d) < 0.5;
  function scoreDeltaPt(curScore: number | null, prvScore: number | null) {
    if (curScore == null || prvScore == null) {
      return { delta: "—", color: "#737474" };
    }
    const d = curScore - prvScore;
    const display = fmtDelta(d, "pt");
    const color = isZeroDisplay(d)
      ? "#737474"
      : d > 0
        ? "#43bb2e"
        : "#c1121f";
    return { delta: display, color };
  }

  // A. EV/EBITDA — 절댓값 (낮을수록 양호)
  const evCur = latest?.evEbitda ?? null;
  const evPrv = prev?.evEbitda ?? null;
  const evVal = evCur != null ? `${evCur.toFixed(1)}x` : "—";
  const evScore = normalize(evCur, 15, 30); // 낮을수록 ↑점수
  const evScorePrv = normalize(evPrv, 15, 30);
  const evD = scoreDeltaPt(evScore, evScorePrv);
  const evFill = evCur != null ? Math.min(1, Math.max(0, evCur / 50)) : 0;
  const evColorTier = tierColorEv(evCur);
  const evNote =
    evCur == null
      ? "—"
      : evCur >= 35
        ? "프리미엄 부담 — 고평가 구간"
        : evCur >= 25
          ? "경계 — 멀티플 프리미엄"
          : evCur >= 15
            ? "적정 멀티플 구간"
            : "디스카운트 구간";

  // B. PBR Z-score
  const pbrZCur = latest?.pbrZScore ?? null;
  const pbrZPrv = prev?.pbrZScore ?? null;
  const pbrVal = latest?.pbr != null ? `${latest.pbr.toFixed(1)}x` : "—";
  // z-score 양수일수록 고평가 → 점수: 음수가 양호 → 0~100 매핑 (낮을수록 좋음 normalize 처럼)
  const zToScore = (z: number | null) =>
    z == null ? null : Math.min(100, Math.max(0, 50 - z * 25));
  const pbrD = scoreDeltaPt(zToScore(pbrZCur), zToScore(pbrZPrv));
  const pbrFill =
    pbrZCur != null ? Math.min(1, Math.max(0, (pbrZCur + 3) / 6)) : 0;
  const pbrColorTier = tierColorZ(pbrZCur);
  const pbrNote =
    pbrZCur == null
      ? "—"
      : pbrZCur >= 1.0
        ? "Z-score +1.0 이상 위험 구간"
        : pbrZCur >= 0.5
          ? "경계 구간"
          : pbrZCur >= -0.5
            ? "정상 구간"
            : "디스카운트 구간";

  // C. Forward PER Z-score
  const fpZCur = latest?.forwardPerZScore ?? null;
  const fpZPrv = prev?.forwardPerZScore ?? null;
  const fpVal = latest?.per != null ? `~${latest.per.toFixed(0)}x` : "—";
  const fpD = scoreDeltaPt(zToScore(fpZCur), zToScore(fpZPrv));
  const fpFill =
    fpZCur != null ? Math.min(1, Math.max(0, (fpZCur + 3) / 6)) : 0;
  const fpColorTier = tierColorZ(fpZCur);
  const fpNote =
    fpZCur == null
      ? "—"
      : fpZCur >= 0.5
        ? "Z-score +0.5 경계 구간"
        : fpZCur >= -0.5
          ? "합리적 구간"
          : "저평가 구간";

  return [
    {
      letter: "A",
      label: "EV/EBITDA (섹터 배수 비교)",
      value: evVal,
      delta: evD.delta,
      deltaColor: evD.color,
      fillRatio: evFill,
      barColor: evColorTier,
      note: evNote,
    },
    {
      letter: "B",
      label: "PBR Z-score",
      value: pbrVal,
      delta: pbrD.delta,
      deltaColor: pbrD.color,
      fillRatio: pbrFill,
      barColor: pbrColorTier,
      note: pbrNote,
    },
    {
      letter: "C",
      label: "Forward PER Z-score",
      value: fpVal,
      delta: fpD.delta,
      deltaColor: fpD.color,
      fillRatio: fpFill,
      barColor: fpColorTier,
      note: fpNote,
    },
  ];
}

// 7축 레이더 — 각 축은 0-100 정규화 점수
export interface RadarData {
  axes: string[];
  values: number[]; // length = axes.length, 0~100 (NVDA 등 본종목)
  sectorAvg: number[]; // 동종업계 평균 (peers 기반)
}

// 0~maxRatio 사이 linear 매핑 → 0~100 (cap 없이 max=100). NVDA 같은 outlier 도 변화 보이게.
function linearPct(value: number | null, maxRatio: number): number {
  if (value == null || maxRatio <= 0) return 0;
  return Math.min(100, Math.max(0, (value / maxRatio) * 100));
}

// 7-axis 정규화 — 모든 종목 (저성장 ~ AI top-tier) 가 cap 없이 비교 가능하도록
// 임계는 industry top 1% 수준에 맞춰 wider 설정. 일반 기업은 중간 영역에 분포.
function radarValues(
  fcfYield: number | null,
  fcfMargin: number | null,
  grossMarginYoy: number | null,
  roe: number | null,
  evEbitda: number | null,
  pbr: number | null,
  revenueGrowth: number | null,
): number[] {
  return [
    // FCF Yield: 0~5% (large cap tech 0.5~1%, value 종목 5%+)
    linearPct(fcfYield, 0.05),
    // FCF Margin: 0~80% (industry top 60-70%, NVDA 51%)
    linearPct(fcfMargin, 0.80),
    // GM 방어: ±5%p 변화 범위
    grossMarginYoy != null
      ? Math.min(100, Math.max(0, ((grossMarginYoy + 0.05) / 0.10) * 100))
      : 0,
    // ROE: 0~200% (AI top-tier 100%+, NVDA 109%)
    linearPct(roe, 2.0),
    // EV/EBITDA: 5 양호, 80 위험 (AI 종목 30~40 포함)
    normalize(evEbitda, 5, 80) ?? 0,
    // PBR: 2 양호, 60 위험 (AI 종목 30~40 포함)
    normalize(pbr, 2, 60) ?? 0,
    // 성장성: 0~200% (AI 종목 100%+, NVDA 73%)
    linearPct(revenueGrowth, 2.0),
  ];
}

// 2026-05 — sectorStats 우선 사용 (stock_fundamental_sector_stats DB 사전 계산).
// peers 는 fallback 으로 유지 (sectorStats 부재 또는 일부 metric 결측 시 보완).
export function valuationRadarData(
  f: StockFundamentals | null,
  peers: PeerCompany[] | null,
  sectorStats?: SectorAvgMetric[] | null,
): RadarData {
  const axes = [
    "FCF 수익률",
    "FCF 마진",
    "GM 방어",
    "ROE",
    "EV/EBITDA (역수)",
    "PBR (역수)",
    "성장성",
  ];
  const empty = axes.map(() => 0);
  const values = f
    ? radarValues(
        f.fcfYield,
        f.fcfMargin,
        f.grossMarginYoy,
        f.roe,
        f.evEbitda,
        f.pbr,
        f.revenueGrowth,
      )
    : empty;

  // 우선순위: sectorStats (DB 사전 계산) → peers 평균 → 0
  let avgFcfYield: number | null = null;
  let avgFcfMargin: number | null = null;
  let avgGmYoy: number | null = null;
  let avgRoe: number | null = null;
  let avgEvEbitda: number | null = null;
  let avgPbr: number | null = null;
  let avgRevG: number | null = null;

  if (sectorStats && sectorStats.length > 0) {
    const byMetric = new Map<string, SectorAvgMetric>();
    for (const m of sectorStats) byMetric.set(m.metric, m);
    // 이상치 영향 줄이기 위해 winsorizedAvg 우선, 없으면 median, 없으면 avg
    const pick = (metric: string): number | null => {
      const m = byMetric.get(metric);
      if (!m) return null;
      return m.winsorizedAvg ?? m.median ?? m.avg;
    };
    avgFcfYield = pick("fcf_yield");
    avgFcfMargin = pick("fcf_margin");
    avgGmYoy = pick("gross_margin_yoy") ?? pick("gross_margin");
    avgRoe = pick("roe");
    avgEvEbitda = pick("ev_ebitda");
    avgPbr = pick("pbr");
    avgRevG = pick("revenue_growth");
  }

  // peers fallback (sectorStats 부재 시)
  if (peers && peers.length > 0) {
    const peerOnly = peers.filter((p) => !p.isSelf);
    if (peerOnly.length > 0) {
      const avgOf = (key: keyof PeerCompany): number | null => {
        const xs = peerOnly
          .map((p) => p[key])
          .filter((v): v is number => typeof v === "number");
        if (xs.length === 0) return null;
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      };
      avgRoe = avgRoe ?? avgOf("roe");
      avgFcfMargin = avgFcfMargin ?? avgOf("netProfitMargin"); // 대용
      avgEvEbitda = avgEvEbitda ?? avgOf("per"); // 대용
      avgPbr = avgPbr ?? avgOf("pbr");
      avgFcfYield = avgFcfYield ?? avgOf("fcfYield");
      avgRevG = avgRevG ?? avgOf("revenueGrowth");
    }
  }

  const sectorAvg = radarValues(
    avgFcfYield,
    avgFcfMargin,
    avgGmYoy,
    avgRoe,
    avgEvEbitda,
    avgPbr,
    avgRevG,
  );
  return { axes, values, sectorAvg };
}
