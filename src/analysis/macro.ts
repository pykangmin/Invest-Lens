import type { MacroRegimeScore } from "../types/investment";
import type { GaugeScore } from "../types/scoring";

// G3 — 거시 경제. 시안에서는 두 줄 라벨 (`SOFT\nLANDING`) 만 표기.
// 점수도 같이 산출하지만 카드에서는 표기 안 됨.
const REGIME_BASE: Record<
  string,
  { score: number; label: string; tagline: string }
> = {
  SoftLanding: { score: 78, label: "POSITIVE", tagline: "SOFT\nLANDING" },
  Recovery: { score: 70, label: "POSITIVE", tagline: "RECOVERY" },
  NoLanding: { score: 50, label: "MIXED", tagline: "NO\nLANDING" },
  HardLanding: { score: 22, label: "NEGATIVE", tagline: "HARD\nLANDING" },
};

export function macroGauge(latest: MacroRegimeScore | null): GaugeScore {
  if (!latest || !latest.dominantRegime) {
    return {
      id: "macro",
      label: "DATA",
      tagline: "거시 데이터 없음",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }
  const meta =
    REGIME_BASE[latest.dominantRegime] ?? {
      score: 50,
      label: "MIXED",
      tagline: latest.dominantRegime.toUpperCase(),
    };
  const adj =
    latest.confidence === "High" ? 0 : latest.confidence === "Low" ? -15 : -5;
  const score = Math.max(0, Math.min(100, meta.score + adj));
  const severity = score >= 60 ? "INFO" : score >= 30 ? "CAUTION" : "WARNING";
  return {
    id: "macro",
    label: meta.label,
    tagline: meta.tagline,
    score: Math.round(score),
    severity,
    available: true,
  };
}
