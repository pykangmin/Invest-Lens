import type { CommodityPrice, CompanyMaster } from "../types/investment";
import type { GaugeScore, Severity } from "../types/scoring";
import { commodityImpactScore } from "./commodityNarrative";

// G2 — 원자재 영향 게이지.
// 디테일 화면(`CommodityDetail`)과 동일한 점수 산출을 사용하기 위해
// `commodityImpactScore`(`commodityNarrative.ts`) 를 그대로 호출한다.
// → sector 무관, 모든 종목이 동일한 시장 거시 원자재 점수를 받는다.
// 본 게이지는 그 위에 라벨/severity/tagline 만 덧입힌다.
export function commodityImpactGauge(
  company: CompanyMaster,
  history: CommodityPrice[],
): GaugeScore {
  void company; // sector 미사용 — 디테일과 동일 점수 유지

  const impact = commodityImpactScore(history);
  const hasAnyCategory =
    impact.energyYoy !== null ||
    impact.metalYoy !== null ||
    impact.preciousYoy !== null ||
    impact.agriYoy !== null;

  if (!hasAnyCategory) {
    return {
      id: "commodity",
      label: "DATA",
      tagline: "원자재 데이터 없음",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }

  const score = impact.score;
  // 디테일 verdict 임계와 동일: 60+ POSITIVE / 40+ NEUTRAL / <40 NEGATIVE
  const label = score >= 60 ? "POSITIVE" : score >= 40 ? "NEUTRAL" : "NEGATIVE";
  // severity 는 메인 게이지 색 매핑용 — 라벨 임계와 일치시킴
  const severity: Severity = score >= 60 ? "INFO" : score >= 40 ? "CAUTION" : "WARNING";
  const tagline =
    label === "POSITIVE"
      ? "원자재 우호적"
      : label === "NEUTRAL"
        ? "중립적"
        : "비용 압력";
  return {
    id: "commodity",
    label,
    tagline,
    score: Math.round(score),
    severity,
    available: true,
  };
}
