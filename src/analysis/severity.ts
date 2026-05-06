import type { Severity } from "../types/scoring";

// 03-insight 의 3-등급 매핑.
// score: 0~100. 높을수록 양호.
// 30 미만 → WARNING (붉은 톤), 60 미만 → CAUTION (주의), 그 이상 → INFO (양호).
export function severityFromScore(score: number | null): Severity {
  if (score === null || Number.isNaN(score)) return "CAUTION";
  if (score < 30) return "WARNING";
  if (score < 60) return "CAUTION";
  return "INFO";
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// 0~100 정규화 헬퍼. 작을수록 좋은 지표(부담)는 invert=true.
export function normalize(
  raw: number | null | undefined,
  good: number,
  bad: number,
): number | null {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) return null;
  const span = good - bad;
  if (span === 0) return 50;
  const ratio = (raw - bad) / span;
  return clamp(ratio, 0, 1) * 100;
}
