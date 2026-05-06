export interface SparklineProps {
  values: Array<number | null>;
  width?: number | "100%";
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

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
  width,
  height = 36,
  color,
  fillOpacity = 0.18,
  strokeWidth = 1.6,
}: SparklineProps) {
  const data = sanitize(values).slice().reverse();
  // viewBox 좌표계는 항상 같은 폭 사용 — 컨테이너 폭에 100% 맞춤.
  const VB_W = 1000;
  const responsive = width === "100%" || width === undefined;
  const widthAttr = responsive ? "100%" : width;

  if (data.length < 2) {
    return (
      <svg
        width={widthAttr}
        height={height}
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <line x1={0} y1={height / 2} x2={VB_W} y2={height / 2} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = VB_W / (data.length - 1);
  const points = data
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`,
    )
    .join(" ");
  const areaPath = `M0,${height} L ${points} L${VB_W},${height} Z`;
  const trend = data[data.length - 1] - data[0];
  const stroke = color ?? (trend >= 0 ? "var(--color-up)" : "var(--color-down)");

  return (
    <svg
      width={widthAttr}
      height={height}
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={areaPath} fill={stroke} opacity={fillOpacity} />
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
