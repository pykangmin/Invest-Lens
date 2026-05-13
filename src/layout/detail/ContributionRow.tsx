// ContributionRow — 지표 1행: 라벨 + 큰 score / max + 보조 sparkline.
// 시안 등장 처: technical §3 (6-metric 큰 숫자: Super Trend 17/20),
//              총합 합계 행 (67/100).
//
// 단일 행. 여러 행을 쌓을 때는 <div style={{display:flex; flexDir:column}}> 로 감싸 사용.

import type { CSSProperties, ReactNode } from "react";
import { responsiveStyles } from "../../shared/responsiveStyle";

export interface ContributionRowProps {
  label: ReactNode;
  /** 점수 — null 이면 dash 표시 */
  score: number | null;
  max: number;
  /** 점수 색 결정 — 미지정 시 score / max 비율 기반 자동 */
  tone?: "up" | "down" | "neutral";
  /** 우측 보조 영역 (sparkline / chip 등) */
  trailing?: ReactNode;
  /** 합계 행 강조 (총합 67/100) */
  total?: boolean;
}

function autoTone(score: number | null, max: number): "up" | "down" | "neutral" {
  if (score == null) return "neutral";
  const ratio = score / max;
  if (ratio >= 0.6) return "up";
  if (ratio < 0.3) return "down";
  return "neutral";
}

function toneColor(t: "up" | "down" | "neutral"): string {
  if (t === "up") return "var(--color-up-strong)";
  if (t === "down") return "var(--color-down)";
  return "var(--color-text)";
}

export function ContributionRow({
  label,
  score,
  max,
  tone,
  trailing,
  total,
}: ContributionRowProps) {
  const t = tone ?? autoTone(score, max);
  return (
    <div
      style={{
        ...S.row,
        ...(total ? S.total : null),
      }}
    >
      <span style={total ? S.totalLabel : S.label}>{label}</span>
      <div style={S.numbers}>
        <span style={{ ...S.score, color: toneColor(t) }}>
          {score != null ? score : "—"}
        </span>
        <span style={S.divider}>/</span>
        <span style={S.max}>{max}</span>
      </div>
      {trailing && <div style={S.trailing}>{trailing}</div>}
    </div>
  );
}

const S = responsiveStyles({
  row: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-tag)",
  },
  total: {
    background: "var(--color-card)",
    border: "1px solid var(--color-text)",
  },
  label: {
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  totalLabel: {
    fontSize: "var(--font-size-base)",
    fontWeight: 700,
    color: "var(--color-text)",
  },
  numbers: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 4,
    fontFamily: "var(--font-numeric)",
  },
  score: {
    fontSize: "var(--font-size-3xl)",
    fontWeight: 700,
    lineHeight: 1,
  },
  divider: {
    fontSize: "var(--font-size-md)",
    color: "var(--color-text-muted)",
    fontWeight: 600,
  },
  max: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
  },
  trailing: { display: "inline-flex", alignItems: "center", justifyContent: "flex-end" },
});
