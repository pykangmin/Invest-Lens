import type { Severity } from "../types/scoring";
import { scaledPx } from "../shared/responsiveStyle";
import { severityVar } from "./severityColor";

export interface ProgressBarProps {
  value: number | null;     // 0~100
  severity: Severity;
  width?: number;
  height?: number;
}

// G4 (기술적 지표) 의 progress bar — Figma 의 progress group (113×59, radius 15).
// 진행률 색은 severity, value 텍스트는 검정 (Figma 스펙).
export function ProgressBar({
  value,
  severity,
  width = 113,
  height = 59,
}: ProgressBarProps) {
  const v = value === null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
  const fillW = (v / 100) * width;
  const color = severityVar(severity);
  const scaledWidth = scaledPx(width);
  const scaledHeight = scaledPx(height);
  return (
    <div
      style={{
        position: "relative",
        width: scaledWidth,
        height: scaledHeight,
        background: "var(--color-card)",
        borderRadius: "var(--radius-pill)",
        boxShadow: "inset 0 0 0 1px var(--color-border)",
        overflow: "hidden",
      }}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: scaledPx(fillW),
          background: color,
          opacity: 0.18,
          transition: "width var(--duration-normal) var(--ease-out)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--font-size-2xl)",
          fontWeight: 800,
          color: "var(--color-text-black)",
          fontFamily: "var(--font-numeric)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value === null ? "—" : Math.round(v)}
      </div>
    </div>
  );
}
