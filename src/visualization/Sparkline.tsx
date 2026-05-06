export interface SparklineProps {
  values: Array<number | null>;
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}

// 결측을 그대로 통과시키지 않고 마지막 유효값으로 캐리.
function sanitize(values: Array<number | null>): number[] {
  const out: number[] = [];
  let last = 0;
  let seen = false;
  for (const v of values) {
    if (v !== null && Number.isFinite(v)) {
      last = v;
      seen = true;
    }
    if (seen) out.push(last);
  }
  return out;
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  color,
  fillOpacity = 0.18,
}: SparklineProps) {
  const data = sanitize(values).slice().reverse(); // history 는 desc 정렬이라 가시적 반전.
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`)
    .join(" ");
  const areaPath = `M0,${height} L ${points} L${width},${height} Z`;
  const trend = data[data.length - 1] - data[0];
  const stroke =
    color ?? (trend >= 0 ? "var(--color-up)" : "var(--color-down)");

  return (
    <svg width={width} height={height} aria-hidden>
      <path d={areaPath} fill={stroke} opacity={fillOpacity} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.6} />
    </svg>
  );
}
