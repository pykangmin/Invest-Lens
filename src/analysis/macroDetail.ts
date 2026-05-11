// macroDetail — Macro detail 페이지용 4 regime 확률 분해 + 시계열.
// macroGauge 가 노출하지 않는 regime 확률 / 추이를 제공.

import type {
  GlobalEnvironmentPoint,
  MacroRegimeScore,
} from "../types/investment";

export type RegimeKey = "softLanding" | "noLanding" | "hardLanding" | "recovery";

export interface RegimeProb {
  key: RegimeKey;
  label: string;
  /** 0~1 */
  prob: number | null;
  /** 0~100 표기용 */
  pct: number | null;
  isDominant: boolean;
}

const REGIME_LABEL: Record<RegimeKey, string> = {
  softLanding: "Soft Landing",
  noLanding: "No Landing",
  hardLanding: "Hard Landing",
  recovery: "Recovery",
};

// dominantRegime 문자열은 "SoftLanding"|"NoLanding"|"HardLanding"|"Recovery"
function regimeKeyFromDominant(s: string | null): RegimeKey | null {
  if (!s) return null;
  const map: Record<string, RegimeKey> = {
    SoftLanding: "softLanding",
    NoLanding: "noLanding",
    HardLanding: "hardLanding",
    Recovery: "recovery",
  };
  return map[s] ?? null;
}

export function regimeProbs(score: MacroRegimeScore | null): RegimeProb[] {
  const dominant = score ? regimeKeyFromDominant(score.dominantRegime) : null;
  const make = (key: RegimeKey, prob: number | null): RegimeProb => ({
    key,
    label: REGIME_LABEL[key],
    prob,
    pct: prob != null ? prob * 100 : null,
    isDominant: key === dominant,
  });
  return [
    make("softLanding", score?.softLandingProb ?? null),
    make("noLanding", score?.noLandingProb ?? null),
    make("hardLanding", score?.hardLandingProb ?? null),
    make("recovery", score?.recoveryProb ?? null),
  ];
}

// 4 regime 확률 시계열 — history 시간순 ASC.
export interface RegimeSeries {
  key: RegimeKey;
  label: string;
  values: Array<number | null>; // 0~1
}

export function regimeQuarterlySeries(
  history: MacroRegimeScore[],
): { dates: string[]; series: RegimeSeries[] } {
  const asc = [...history].reverse();
  const dates = asc.map((h) => h.date);
  const series: RegimeSeries[] = [
    { key: "softLanding", label: REGIME_LABEL.softLanding, values: asc.map((h) => h.softLandingProb) },
    { key: "noLanding", label: REGIME_LABEL.noLanding, values: asc.map((h) => h.noLandingProb) },
    { key: "hardLanding", label: REGIME_LABEL.hardLanding, values: asc.map((h) => h.hardLandingProb) },
    { key: "recovery", label: REGIME_LABEL.recovery, values: asc.map((h) => h.recoveryProb) },
  ];
  return { dates, series };
}

// ─── 변수 ↔ regime Pearson correlation (통계 기반 "기여도" 근사) ──
// 모델 내부 가중치 부재 → 시계열 상관관계로 변수별 영향 추정.
// macro_regime_scores (월별 prob) ↔ global_environment 변수 month-end 값.
// 결과: 4 변수 × 4 regime = 16 cell. 음/양 부호 + 강도.

export interface RegimeContribCell {
  variable: string;
  regime: RegimeKey;
  /** Pearson r — -1..1 */
  r: number | null;
  /** 표시용 강도 라벨: "강" / "중" / "약" / "—" (|r| ≥ 0.5 / 0.3 / 0.15 / else) */
  strengthLabel: string;
  direction: "positive" | "negative" | "neutral";
}

export interface RegimeContribTable {
  variables: string[];
  cells: RegimeContribCell[];
  /** 분석에 쓰인 월말 row 개수 */
  sampleSize: number;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx2 += a * a;
    dy2 += b * b;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return num / denom;
}

function strengthOf(r: number | null): { label: string; direction: "positive" | "negative" | "neutral" } {
  if (r == null) return { label: "—", direction: "neutral" };
  const a = Math.abs(r);
  const direction = r > 0.05 ? "positive" : r < -0.05 ? "negative" : "neutral";
  if (a >= 0.5) return { label: "강", direction };
  if (a >= 0.3) return { label: "중", direction };
  if (a >= 0.15) return { label: "약", direction };
  return { label: "—", direction: "neutral" };
}

const VAR_LABEL: Record<string, string> = {
  vix: "VIX (변동성)",
  dxy: "DXY (달러)",
  dgs10: "10Y 금리",
  hy: "HY 스프레드",
};

const REGIMES: RegimeKey[] = ["softLanding", "noLanding", "hardLanding", "recovery"];

/**
 * macro regime ↔ 4 변수 Pearson 상관 행렬 산출.
 * @param regimeHistory macro_regime_scores DESC (latest first), 최소 5개 권장
 * @param indicators GlobalEnvironmentResponse 응답 — symbol 별 history(DESC) 전달
 *   주의: regimeHistory 의 month-end 일자에 가장 가까운 직전 변수값을 forward-look으로 매칭
 */
export function regimeContributionTable(
  regimeHistory: MacroRegimeScore[],
  indicators: Record<"vix" | "dxy" | "dgs10" | "hy", GlobalEnvironmentPoint[]>,
): RegimeContribTable {
  // regime → ASC 정렬
  const asc = [...regimeHistory].reverse();

  // 각 변수의 ASC date→value map
  const buildIndex = (points: GlobalEnvironmentPoint[]) => {
    const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
    return sorted; // ASC
  };
  const varIdx = {
    vix: buildIndex(indicators.vix),
    dxy: buildIndex(indicators.dxy),
    dgs10: buildIndex(indicators.dgs10),
    hy: buildIndex(indicators.hy),
  };

  // regime date 별 변수 매칭 (가장 가까운 직전 ASC 값)
  function nearestBefore(pts: GlobalEnvironmentPoint[], targetDate: string): number | null {
    let last: number | null = null;
    for (const p of pts) {
      if (p.date > targetDate) break;
      last = p.value;
    }
    return last;
  }

  const seriesVar: Record<string, number[]> = { vix: [], dxy: [], dgs10: [], hy: [] };
  const seriesRegime: Record<RegimeKey, number[]> = {
    softLanding: [],
    noLanding: [],
    hardLanding: [],
    recovery: [],
  };

  for (const r of asc) {
    const vix = nearestBefore(varIdx.vix, r.date);
    const dxy = nearestBefore(varIdx.dxy, r.date);
    const dgs10 = nearestBefore(varIdx.dgs10, r.date);
    const hy = nearestBefore(varIdx.hy, r.date);
    if (
      vix == null || dxy == null || dgs10 == null || hy == null ||
      r.softLandingProb == null || r.noLandingProb == null ||
      r.hardLandingProb == null || r.recoveryProb == null
    ) {
      continue;
    }
    seriesVar.vix.push(vix);
    seriesVar.dxy.push(dxy);
    seriesVar.dgs10.push(dgs10);
    seriesVar.hy.push(hy);
    seriesRegime.softLanding.push(r.softLandingProb);
    seriesRegime.noLanding.push(r.noLandingProb);
    seriesRegime.hardLanding.push(r.hardLandingProb);
    seriesRegime.recovery.push(r.recoveryProb);
  }

  const sampleSize = seriesVar.vix.length;
  const cells: RegimeContribCell[] = [];
  for (const v of ["vix", "dxy", "dgs10", "hy"] as const) {
    for (const reg of REGIMES) {
      const r = pearson(seriesVar[v], seriesRegime[reg]);
      const s = strengthOf(r);
      cells.push({
        variable: VAR_LABEL[v],
        regime: reg,
        r,
        strengthLabel: s.label,
        direction: s.direction,
      });
    }
  }
  return {
    variables: Object.values(VAR_LABEL),
    cells,
    sampleSize,
  };
}

// 거시 지표 4종 시계열 묶음.
export interface MacroIndicatorSeries {
  symbol: string;
  label: string;
  /** ASC */
  values: Array<number | null>;
  dates: string[];
  latest: number | null;
  pctYoy: number | null;
}

const MACRO_LABELS: Record<string, string> = {
  "^VIX": "VIX",
  "DX-Y.NYB": "DXY (달러 인덱스)",
  DGS10: "10Y Treasury Yield",
  BAMLH0A0HYM2: "HY 회사채 스프레드",
};

export function macroIndicatorSeries(
  responses: Array<{ symbol: string; history: GlobalEnvironmentPoint[] }>,
): MacroIndicatorSeries[] {
  return responses.map(({ symbol, history }) => {
    const asc = [...history].reverse();
    const values = asc.map((p) => p.value);
    const latest = values.length > 0 ? values[values.length - 1] : null;
    const yearAgo = values.length >= 240 ? values[values.length - 240] : values[0];
    const pctYoy =
      latest != null && yearAgo != null && yearAgo !== 0
        ? ((latest - yearAgo) / yearAgo) * 100
        : null;
    return {
      symbol,
      label: MACRO_LABELS[symbol] ?? symbol,
      values,
      dates: asc.map((p) => p.date),
      latest,
      pctYoy,
    };
  });
}
