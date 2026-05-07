import type { GaugeScore } from "../types/scoring";
import { severityTrack, severityVar } from "./severityColor";

export interface DonutProps {
  gauge: GaugeScore;
  size?: number;
  thickness?: number;
}

export function Donut({ gauge, size = 72, thickness = 8 }: DonutProps) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const score = gauge.score ?? 0;
  const dash = (score / 100) * circ;
  const color = severityVar(gauge.severity);
  const track = severityTrack(gauge.severity);

  return (
    <svg width={size} height={size} role="img" aria-label={`${gauge.label} ${score}`}>
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke={track}
        strokeWidth={thickness}
        fill="none"
      />
      {gauge.available && (
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          transform={`rotate(-90 ${c} ${c})`}
          style={{
            transition: "stroke-dasharray var(--duration-normal) var(--ease-out)",
          }}
        />
      )}
      <text
        x={c}
        y={c}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.32}
        fontWeight={700}
        fill="var(--color-text)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {gauge.available && gauge.score !== null ? gauge.score : "—"}
      </text>
    </svg>
  );
}
