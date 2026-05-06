import type { GlobalEnvironmentPoint, StockPriceTech } from "../types/investment";
import type { GaugeScore } from "../types/scoring";

// G4 — 기술적 지표 + EXTREME FEAR/FEAR/NEUTRAL/GREED 라벨 + progress bar value (0~100).
// VIX 우선 (시안의 EXTREME FEAR 직접 매핑) + RSI 보조.
// score 는 fear-greed 형태: 낮을수록 공포(=낮은 점수, severity WARNING).
function rsiToScore(rsi: number): number {
  // 50 부근이 기술적 균형. 양 극단(0/100)은 단기 신호로 score 낮음.
  // 50 → 70, 30 또는 70 → 30 안팎.
  const dist = Math.abs(rsi - 50) / 50;
  return (1 - dist) * 100;
}

function vixToFearGreed(vix: number): number {
  // VIX 12 미만: GREED 80+
  // 12~20: NEUTRAL 60~80
  // 20~30: CAUTION/FEAR 35~60
  // 30~45: FEAR 15~35
  // 45+: EXTREME FEAR 0~15
  if (vix < 12) return 85;
  if (vix < 20) return 60 + (20 - vix) * 2.5; // 60~85
  if (vix < 30) return 35 + (30 - vix) * 2.5; // 35~60
  if (vix < 45) return Math.max(15, 35 - (vix - 30) * (20 / 15)); // 15~35
  return Math.max(0, 15 - (vix - 45));
}

function labelFor(score: number): string {
  if (score >= 75) return "GREED";
  if (score >= 55) return "NEUTRAL";
  if (score >= 35) return "FEAR";
  return "EXTREME\nFEAR";
}

export function technicalGauge(
  t: StockPriceTech | null,
  vix: GlobalEnvironmentPoint | null,
): GaugeScore {
  const haveRsi = t && t.rsi14 !== null;
  const haveVix = !!vix;
  if (!haveRsi && !haveVix) {
    return {
      id: "technical",
      label: "DATA",
      tagline: "기술 지표 없음",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }
  const parts: number[] = [];
  if (haveVix) parts.push(vixToFearGreed(vix!.value));
  if (haveRsi) parts.push(rsiToScore(t!.rsi14!));
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  const severity = score >= 60 ? "INFO" : score >= 30 ? "CAUTION" : "WARNING";
  const label = labelFor(score);
  return {
    id: "technical",
    label,
    tagline: label,
    score: Math.round(score),
    severity,
    available: true,
  };
}
