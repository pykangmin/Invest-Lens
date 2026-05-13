// StatusChip — 상태 표기 칩.
// 시안 등장 처: 핵심 요약 (비용 영향: 부정적 / 공급 안정성: 양호 / 향후 전망: 중립),
// 시장 이슈 카드 (Overweight / Neutral / Underweight) 등.

import type { CSSProperties } from "react";
import { responsiveStyles } from "../shared/responsiveStyle";

export type StatusTone = "positive" | "negative" | "neutral" | "caution";

export interface StatusChipProps {
  label: string;
  value: string;
  tone: StatusTone;
}

function toneColors(tone: StatusTone): { fg: string; bg: string } {
  switch (tone) {
    case "positive":
      return { fg: "var(--color-up-strong)", bg: "var(--color-up-bg)" };
    case "negative":
      return { fg: "var(--color-down)", bg: "var(--color-down-bg)" };
    case "caution":
      return { fg: "var(--color-warn)", bg: "#fff1dc" };
    case "neutral":
    default:
      return { fg: "var(--color-text-muted)", bg: "var(--color-header-bg)" };
  }
}

export function StatusChip({ label, value, tone }: StatusChipProps) {
  const c = toneColors(tone);
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={{ ...S.value, color: c.fg, background: c.bg }}>{value}</span>
    </div>
  );
}

const S = responsiveStyles({
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-start",
  },
  label: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
  },
  value: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: 600,
    padding: "2px 12px",
    borderRadius: "var(--radius-tag)",
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.2,
  },
});
