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
