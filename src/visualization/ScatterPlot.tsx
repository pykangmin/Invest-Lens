// ScatterPlot — 변동성 vs 수익률 매트릭스.
// 시안 등장 처: commodity detail 의 변동성-수익률 매트릭스.
//
// x = 변동성 (volatility, std dev of daily return), y = 수익률 (total return %).

import type { CSSProperties } from "react";

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  color?: string;
  size?: number; // 반지름. 미지정 시 기본
}

export interface ScatterPlotProps {
  points: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  width?: number | string;
  height?: number;
}

const VIEW_W = 800;
const VIEW_H = 320;
const PAD_L = 50;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 50;

export function ScatterPlot({
  points,
  xLabel = "변동성 (일간 std)",
  yLabel = "수익률 (%)",
  width = "100%",
  height = 320,
}: ScatterPlotProps) {
  if (points.length === 0) {
    return <div style={S.empty}>데이터 없음</div>;
  }
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs, 0);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys);
  const padX = (xMax - xMin) * 0.1 || 1;
  const padY = (yMax - yMin) * 0.1 || 1;
  const x0 = xMin - padX;
  const x1 = xMax + padX;
  const y0 = yMin - padY;
  const y1 = yMax + padY;

  const xToPx = (v: number) => PAD_L + ((v - x0) / (x1 - x0)) * innerW;
  const yToPx = (v: number) => PAD_T + (1 - (v - y0) / (y1 - y0)) * innerH;

  // grid
  const xTicks: number[] = [];
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    xTicks.push(x0 + ((x1 - x0) / 4) * i);
    yTicks.push(y0 + ((y1 - y0) / 4) * i);
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      preserveAspectRatio="xMidYMid meet"
      style={{ ...S.svg, aspectRatio: `${VIEW_W} / ${VIEW_H}`, height: "auto" }}
    >
      {/* x grid */}
      {xTicks.map((t, i) => {
        const x = xToPx(t);
        return (
          <g key={`x${i}`}>
            <line
              x1={x}
              x2={x}
              y1={PAD_T}
              y2={VIEW_H - PAD_B}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={x}
              y={VIEW_H - PAD_B + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-text-muted)"
              fontFamily="var(--font-numeric)"
            >
              {t.toFixed(2)}
            </text>
          </g>
        );
      })}
      {/* y grid */}
      {yTicks.map((t, i) => {
        const y = yToPx(t);
        return (
          <g key={`y${i}`}>
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
              x={PAD_L - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-text-muted)"
              fontFamily="var(--font-numeric)"
            >
              {t >= 0 ? "+" : ""}{t.toFixed(0)}%
            </text>
          </g>
        );
      })}
      {/* 0 reference lines */}
      {x0 < 0 && x1 > 0 && (
        <line
          x1={xToPx(0)}
          x2={xToPx(0)}
          y1={PAD_T}
          y2={VIEW_H - PAD_B}
          stroke="var(--color-text-muted)"
          strokeWidth={1}
        />
      )}
      {y0 < 0 && y1 > 0 && (
        <line
          x1={PAD_L}
          x2={VIEW_W - PAD_R}
          y1={yToPx(0)}
          y2={yToPx(0)}
          stroke="var(--color-text-muted)"
          strokeWidth={1}
        />
      )}
      {/* 점 + 라벨 */}
      {points.map((p, i) => {
        const cx = xToPx(p.x);
        const cy = yToPx(p.y);
        const r = p.size ?? 6;
        const color = p.color ?? (p.y >= 0 ? "var(--color-up)" : "var(--color-down)");
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.85} />
            <text
              x={cx}
              y={cy - r - 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--color-text)"
            >
              {p.label}
            </text>
          </g>
        );
      })}
      {/* axis labels */}
      <text
        x={(VIEW_W - PAD_R + PAD_L) / 2}
        y={VIEW_H - 8}
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        fill="var(--color-text-muted)"
      >
        {xLabel}
      </text>
      <text
        x={14}
        y={(VIEW_H - PAD_B + PAD_T) / 2}
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        fill="var(--color-text-muted)"
        transform={`rotate(-90 14 ${(VIEW_H - PAD_B + PAD_T) / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  );
}

const S: Record<string, CSSProperties> = {
  svg: { display: "block" },
  empty: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    padding: 32,
    textAlign: "center",
  },
};
