// BarChart — 단순 수직 막대 차트.
// 시안 등장 처: 원자재별 가격 변동률 비교 (1y).
//
// 입력: series = [{ label, value, color? }, ...]
// 시각: 각 막대는 y=0 기준 위/아래로 그림 (음/양 모두 처리).

import type { CSSProperties } from "react";

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  width?: number | string;
  height?: number;
  yAxisFormatter?: (v: number) => string;
  showValueLabels?: boolean;
}

// viewBox 비율 + 텍스트 사이즈는 컨테이너 폭에 따라 동일 비율로 스케일.
// 출력 폭 ~543px 에서도 텍스트가 읽히도록 viewBox font-size 14~18 사용.
const VIEW_W = 600;
const VIEW_H = 320;
const PAD_L = 56;
const PAD_R = 20;
const PAD_T = 24;
const PAD_B = 48;

export function BarChart({
  data,
  width = "100%",
  height = 260,
  yAxisFormatter = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`,
  showValueLabels = true,
}: BarChartProps) {
  if (data.length === 0) {
    return <div style={S.empty}>데이터 없음</div>;
  }

  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;

  const values = data.map((d) => d.value);
  const dataMin = Math.min(...values, 0);
  const dataMax = Math.max(...values, 0);
  // 5단위로 round (가독성)
  const yMin = Math.floor(dataMin / 5) * 5;
  const yMax = Math.ceil(dataMax / 5) * 5;
  const yRange = yMax - yMin || 1;

  const barWidth = innerW / data.length;
  const barInnerWidth = barWidth * 0.55;

  const yToPx = (v: number): number =>
    PAD_T + (1 - (v - yMin) / yRange) * innerH;

  const zeroY = yToPx(0);

  // y 축 tick (5등분)
  const ticks: number[] = [];
  const step = yRange / 4;
  for (let i = 0; i <= 4; i++) ticks.push(yMin + step * i);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      preserveAspectRatio="xMidYMid meet"
      style={{ ...S.svg, aspectRatio: `${VIEW_W} / ${VIEW_H}`, height: "auto" }}
    >
      {/* y 축 grid + tick label */}
      {ticks.map((t, i) => {
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
              strokeDasharray={t === 0 ? undefined : "2 4"}
            />
            <text
              x={PAD_L - 8}
              y={y + 5}
              textAnchor="end"
              fontSize={14}
              fill="var(--color-text-muted)"
              fontFamily="var(--font-numeric)"
            >
              {yAxisFormatter(t)}
            </text>
          </g>
        );
      })}
      {/* 막대 */}
      {data.map((d, i) => {
        const cx = PAD_L + barWidth * i + barWidth / 2;
        const x = cx - barInnerWidth / 2;
        const top = yToPx(Math.max(d.value, 0));
        const bot = yToPx(Math.min(d.value, 0));
        const h = bot - top;
        const color =
          d.color ?? (d.value >= 0 ? "var(--color-up)" : "var(--color-down)");
        return (
          <g key={i}>
            <rect x={x} y={top} width={barInnerWidth} height={h} fill={color} rx={3} />
            {showValueLabels && (
              <text
                x={cx}
                y={d.value >= 0 ? top - 6 : bot + 16}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill={color}
                fontFamily="var(--font-numeric)"
              >
                {yAxisFormatter(d.value)}
              </text>
            )}
            <text
              x={cx}
              y={VIEW_H - 14}
              textAnchor="middle"
              fontSize={13}
              fontWeight={500}
              fill="var(--color-text)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
      {/* x 축 (zero line 위에 별도 — gridline 의 zero 와 중복돼 생략) */}
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
