import { useState, type PointerEvent } from "react";
import { scaledPx } from "../shared/responsiveStyle";

export interface SparklineProps {
  values: Array<number | null>;
  /** values 와 같은 인덱스 정렬의 날짜 — 제공 시 hover tooltip 활성. */
  dates?: string[];
  width?: number | "100%";
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  /** true 면 hover 시 crosshair + 값 tooltip 표시 (dates 도 함께 제공 권장). */
  showHoverValue?: boolean;
  /** tooltip 의 값 포맷. 기본 toFixed(2). */
  formatValue?: (v: number) => string;
  /** tooltip 의 날짜 포맷. 기본 원문 그대로. */
  formatDate?: (d: string) => string;
}

interface DataPoint {
  value: number;
  date?: string;
}

function sanitize(values: Array<number | null>, dates?: string[]): DataPoint[] {
  const out: DataPoint[] = [];
  let last = 0;
  let seen = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      last = v;
      seen = true;
    }
    if (seen) out.push({ value: last, date: dates?.[i] });
  }
  return out;
}

export function Sparkline({
  values,
  dates,
  width,
  height = 36,
  color,
  fillOpacity = 0,
  strokeWidth = 1.6,
  showHoverValue = false,
  formatValue = (v) => v.toFixed(2),
  formatDate = (d) => d,
}: SparklineProps) {
  const data = sanitize(values, dates).slice().reverse();
  // viewBox 좌표계는 항상 같은 폭 사용 — 컨테이너 폭에 100% 맞춤.
  const VB_W = 1000;
  const responsive = width === "100%" || width === undefined;
  const widthAttr = responsive ? "100%" : width;
  const heightAttr = height;
  const widthStyle = responsive ? "100%" : scaledPx(width);
  const heightStyle = scaledPx(height);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <svg
        width={widthAttr}
        height={heightAttr}
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        style={{ width: widthStyle, height: heightStyle }}
        aria-hidden
      >
        <line x1={0} y1={height / 2} x2={VB_W} y2={height / 2} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
    );
  }

  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));
  const span = max - min || 1;
  const stepX = VB_W / (data.length - 1);
  const yOf = (v: number) => height - ((v - min) / span) * height;
  const points = data
    .map((d, i) => `${(i * stepX).toFixed(2)},${yOf(d.value).toFixed(2)}`)
    .join(" ");
  const areaPath = `M0,${height} L ${points} L${VB_W},${height} Z`;
  const trend = data[data.length - 1].value - data[0].value;
  const stroke = color ?? (trend >= 0 ? "var(--color-up)" : "var(--color-down)");

  const interactive = showHoverValue;
  const hoverPoint = hoverIdx !== null ? data[hoverIdx] : null;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverIdx(Math.round(ratio * (data.length - 1)));
  };

  // Non-interactive 인 경우 div wrapping 없이 원본 SVG 그대로 — 기존 레이아웃 영향 0.
  if (!interactive) {
    return (
      <svg
        width={widthAttr}
        height={heightAttr}
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        style={{ width: widthStyle, height: heightStyle }}
        aria-hidden
      >
        {fillOpacity > 0 && <path d={areaPath} fill={stroke} opacity={fillOpacity} />}
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  return (
    <div
      style={{ position: "relative", width: widthStyle, height: heightStyle }}
      onPointerMove={onMove}
      onPointerLeave={() => setHoverIdx(null)}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        {fillOpacity > 0 && <path d={areaPath} fill={stroke} opacity={fillOpacity} />}
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
        {hoverIdx !== null && (
          <>
            <line
              x1={hoverIdx * stepX}
              x2={hoverIdx * stepX}
              y1={0}
              y2={height}
              stroke="#003049"
              strokeWidth={1}
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoverIdx * stepX}
              cy={yOf(data[hoverIdx].value)}
              r={3}
              fill={stroke}
              stroke="#fff"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {hoverPoint && hoverIdx !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(hoverIdx / Math.max(1, data.length - 1)) * 100}%`,
            transform: "translateX(-50%)",
            top: -28,
            background: "#003049",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 5,
            boxShadow: "0 2px 6px rgba(0, 48, 73, 0.15)",
            lineHeight: 1.3,
          }}
        >
          {hoverPoint.date && (
            <span style={{ opacity: 0.85, marginRight: 6 }}>{formatDate(hoverPoint.date)}</span>
          )}
          <span>{formatValue(hoverPoint.value)}</span>
        </div>
      )}
    </div>
  );
}
