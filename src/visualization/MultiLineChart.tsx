// MultiLineChart — 다중 시계열 라인 차트.
// 시안 등장 처: 카테고리별 가격 추이 (3 line) / 동·X 부문 추이 / 자산군 정규화 사이클.
//
// 입력: series = [{ label, values: number[], color? }, ...] — 모든 시리즈 동일 길이 가정
//       xLabels = string[] — x 축 tick 텍스트 (날짜 등)

import type { CSSProperties } from "react";
import { responsiveStyles } from "../shared/responsiveStyle";

export interface LineSeries {
  label: string;
  values: Array<number | null>;
  color?: string;
}

export interface MultiLineChartProps {
  series: LineSeries[];
  xLabels?: string[];
  yAxisFormatter?: (v: number) => string;
  width?: number | string;
  height?: number;
  legendPosition?: "top" | "none";
  showXLabels?: number; // 보여줄 라벨 개수 (균등 샘플)
  /** viewBox 너비 (기본 800) — 좁은 컨테이너에 맞게 줄이면 더 사각형 비율로 보임 */
  viewBoxWidth?: number;
}

const DEFAULT_VIEW_W = 600;
const VIEW_H = 320;
const PAD_L = 60;
const PAD_R = 20;
const PAD_T = 24;
const PAD_B = 44;

const DEFAULT_COLORS = [
  "#003049",
  "#c1121f",
  "#60c846",
  "#4073ff",
  "#ff9737",
];

export function MultiLineChart({
  series,
  xLabels,
  yAxisFormatter = (v) => `${v.toFixed(0)}`,
  width = "100%",
  height: _height = 280,
  legendPosition = "top",
  showXLabels = 6,
  viewBoxWidth,
}: MultiLineChartProps) {
  const VIEW_W = viewBoxWidth ?? DEFAULT_VIEW_W;
  const validSeries = series.filter((s) => s.values.length > 0);
  if (validSeries.length === 0) {
    return <div style={S.empty}>데이터 없음</div>;
  }
  void _height;

  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const N = Math.max(...validSeries.map((s) => s.values.length));
  if (N < 2) {
    return <div style={S.empty}>데이터 부족</div>;
  }

  const allValues = validSeries
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yPad = (yMax - yMin) * 0.05 || 1;
  const y0 = yMin - yPad;
  const y1 = yMax + yPad;

  const xToPx = (i: number) => PAD_L + (i / (N - 1)) * innerW;
  const yToPx = (v: number) => PAD_T + (1 - (v - y0) / (y1 - y0)) * innerH;

  // y tick 5등분
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) yTicks.push(y0 + ((y1 - y0) / 4) * i);

  // x label 균등 샘플
  const labelIndices: number[] = [];
  if (xLabels && xLabels.length > 0) {
    const sampleCount = Math.min(showXLabels, xLabels.length);
    for (let i = 0; i < sampleCount; i++) {
      labelIndices.push(Math.round((i / (sampleCount - 1 || 1)) * (xLabels.length - 1)));
    }
  }

  return (
    <div style={S.wrap}>
      {legendPosition === "top" && (
        <div style={S.legend}>
          {validSeries.map((s, i) => {
            const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return (
              <div key={s.label} style={S.legendItem}>
                <span style={{ ...S.legendDot, background: color }} />
                <span style={S.legendLabel}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={width}
        preserveAspectRatio="xMidYMid meet"
        style={{ ...S.svg, aspectRatio: `${VIEW_W} / ${VIEW_H}`, height: "auto" }}
      >
        {/* y grid + tick */}
        {yTicks.map((t, i) => {
          const y = yToPx(t);
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={VIEW_W - PAD_R}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
              <text
                x={PAD_L - 8}
                y={y + 5}
                textAnchor="end"
                fontSize={13}
                fill="var(--color-text-muted)"
                fontFamily="var(--font-numeric)"
              >
                {yAxisFormatter(t)}
              </text>
            </g>
          );
        })}
        {/* x label */}
        {xLabels &&
          labelIndices.map((idx) => (
            <text
              key={idx}
              x={xToPx(idx)}
              y={VIEW_H - PAD_B + 18}
              textAnchor="middle"
              fontSize={13}
              fill="var(--color-text-muted)"
            >
              {xLabels[idx]}
            </text>
          ))}
        {/* lines */}
        {validSeries.map((s, si) => {
          const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
          const points: string[] = [];
          for (let i = 0; i < s.values.length; i++) {
            const v = s.values[i];
            if (v === null || !Number.isFinite(v)) continue;
            const x = xToPx(i);
            const y = yToPx(v);
            points.push(`${points.length === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
          }
          return (
            <path
              key={si}
              d={points.join(" ")}
              stroke={color}
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

const S = responsiveStyles({
  wrap: { width: "100%", display: "flex", flexDirection: "column", gap: 8 },
  svg: { display: "block" },
  legend: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    fontSize: "var(--font-size-sm)",
    paddingLeft: 8,
  },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  legendLabel: { color: "var(--color-text)", fontWeight: 600 },
  empty: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    padding: 32,
    textAlign: "center",
  },
});
