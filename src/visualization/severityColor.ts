import type { Severity } from "../types/scoring";

// 03-insight 의 severity 등급 → 21-aesthetics 의 의미 색 변수.
// 색 결정값은 styles.css 의 CSS 변수가 단일 진실의 원천.
export function severityVar(s: Severity): string {
  switch (s) {
    case "WARNING":
      return "var(--color-down)";
    case "CAUTION":
      return "var(--color-accent)";
    case "INFO":
    default:
      return "var(--color-up)";
  }
}

export function severityTrack(s: Severity): string {
  // 진행바 비채움 부분 — 옅은 무채색 기반.
  return "rgba(11, 30, 63, 0.10)";
  void s;
}
