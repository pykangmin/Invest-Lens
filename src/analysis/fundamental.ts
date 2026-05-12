import type { StockFundamentals } from "../types/investment";
import type { GaugeScore } from "../types/scoring";
import { sectionScores, totalFromSections } from "./fundamentalNarrative";
import { severityFromScore } from "./severity";

// 펀더멘털 게이지 — 디테일 화면(`FundamentalDetail`)과 동일한 점수 산출을
// 사용하기 위해 `sectionScores + totalFromSections` 를 그대로 호출한다.
// 시안 가중치(현금흐름 40 / 수익성 25 / 가치평가 25 / 성장성 10)가 단일 진실의 원천.
// 본 게이지는 그 위에 라벨/severity 만 덧입힌다.
export function fundamentalGauge(f: StockFundamentals | null): GaugeScore {
  if (!f) {
    return {
      id: "fundamental",
      label: "DATA",
      tagline: "데이터 없음",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }
  const sections = sectionScores(f);
  const total = totalFromSections(sections);
  if (total === null) {
    return {
      id: "fundamental",
      label: "DATA",
      tagline: "지표 컬럼 부족",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }
  const severity = severityFromScore(total);
  const label =
    severity === "INFO" ? "GOOD" : severity === "CAUTION" ? "MIXED" : "WEAK";
  const tagline =
    severity === "INFO"
      ? "수익성·재무 안정"
      : severity === "CAUTION"
        ? "혼조"
        : "부담 신호";
  return {
    id: "fundamental",
    label,
    tagline,
    score: total,
    severity,
    available: true,
  };
}
