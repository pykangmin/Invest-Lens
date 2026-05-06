import type { StockFundamentals } from "../types/investment";
import type { GaugeScore } from "../types/scoring";
import { normalize, severityFromScore } from "./severity";

// 02-data-analysis 의 펀더멘탈 영역에서 사용하는 9 지표 중,
// DB 가 채우는 빈도가 높은 컬럼만 우선 사용. 정확한 가중치는
// 02-data-analysis 본문이 단일 진실의 원천이며, 본 파일은 가용 컬럼의
// first cut 평균이라는 한계를 명시.
function fundamentalSubScores(f: StockFundamentals): Array<number> {
  const parts: number[] = [];
  // ROE: 0.05 미만 부진, 0.20 이상 양호.
  const roe = normalize(f.roe, 0.20, 0.05);
  if (roe !== null) parts.push(roe);
  // 순이익률: 0.05 미만 부진, 0.20 이상 양호.
  const npm = normalize(f.netProfitMargin, 0.20, 0.05);
  if (npm !== null) parts.push(npm);
  // FCF Yield: 0.01 미만 부진, 0.06 이상 양호.
  const fcf = normalize(f.fcfYield, 0.06, 0.01);
  if (fcf !== null) parts.push(fcf);
  // 부채비율(작을수록 좋음): 1.5 이하 양호, 4.0 이상 위험.
  const dte = normalize(f.debtToEquity, 1.5, 4.0);
  if (dte !== null) parts.push(dte);
  // PER (작을수록 좋음): 15 이하 양호, 60 이상 부담.
  const per = normalize(f.per, 15, 60);
  if (per !== null) parts.push(per);
  return parts;
}

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
  const parts = fundamentalSubScores(f);
  if (parts.length === 0) {
    return {
      id: "fundamental",
      label: "DATA",
      tagline: "지표 컬럼 부족",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  const severity = severityFromScore(score);
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
    score: Math.round(score),
    severity,
    available: true,
  };
}
