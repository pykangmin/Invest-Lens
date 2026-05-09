// MiniCard — 단일 수치 미니 카드.
// 시안 등장 처: 4 mini cards (리튬 +134% / 금 $4,763 / WTI $93.3 / 금 +40%),
// 8-card 가격 그리드.

import type { CSSProperties, ReactNode } from "react";

export type MiniCardTone = "up" | "down" | "neutral";

export interface MiniCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: { text: string; tone: MiniCardTone };
  icon?: ReactNode;
  tone?: MiniCardTone; // value 색에 영향 (delta 가 없을 때 기준)
}

function toneColor(tone: MiniCardTone): string {
  switch (tone) {
    case "up":
      return "var(--color-up)";
    case "down":
      return "var(--color-down)";
    case "neutral":
    default:
      return "var(--color-text)";
  }
}

export function MiniCard({ label, value, unit, delta, icon, tone = "neutral" }: MiniCardProps) {
  return (
    <div style={S.card}>
      <div style={S.head}>
        {icon}
        <span style={S.label}>{label}</span>
      </div>
      <div style={S.valueRow}>
        <span style={{ ...S.value, color: toneColor(tone) }}>{value}</span>
        {unit && <span style={S.unit}>{unit}</span>}
      </div>
      {delta && (
        <div style={{ ...S.delta, color: toneColor(delta.tone) }}>{delta.text}</div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  card: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
  },
  valueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  value: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
  },
  unit: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 600,
  },
  delta: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
};
