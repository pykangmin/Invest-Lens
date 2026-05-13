// 그래프 호버 시 수치 표시 — 공용 hook + tooltip.
//
// 일반 차트:
//   const { hoverIdx, onPointerMove, onPointerLeave } = useChartHoverIdx(data.length, xOfIdx, VB_W);
//   return (
//     <div style={{ position: "relative" }} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
//       <svg viewBox={`0 0 ${W} ${H}`} ...>...</svg>
//       {hoverIdx !== null && <ChartTooltip leftPercent={(xOfIdx(hoverIdx) / W) * 100}>...</ChartTooltip>}
//     </div>
//   );
//
// 테이블 셀처럼 overflow 가 잘리는 컨테이너 안: portal 변형 사용.
//   const { hoverIdx, pointer, onPointerMove, onPointerLeave } = useChartHoverIdxPortal(...);
//   return (
//     <div ... onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
//       <svg>...</svg>
//       {hoverIdx !== null && pointer && (
//         <ChartPortalTooltip clientX={pointer.x} clientY={pointer.y}>...</ChartPortalTooltip>
//       )}
//     </div>
//   );

import {
  useCallback,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function useChartHoverIdx(
  dataLength: number,
  xOfIdx: (idx: number) => number,
  viewBoxWidth: number,
) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || dataLength === 0) return;
      const vbX = ((e.clientX - rect.left) / rect.width) * viewBoxWidth;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < dataLength; i++) {
        const d = Math.abs(xOfIdx(i) - vbX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      setHoverIdx(bestIdx);
    },
    [dataLength, xOfIdx, viewBoxWidth],
  );
  const onPointerLeave = useCallback(() => setHoverIdx(null), []);
  return { hoverIdx, onPointerMove, onPointerLeave };
}

/** overflow 가 잘리는 부모(예: 테이블 셀) 안에서 사용. 포인터의 client 좌표도 함께 추적. */
export function useChartHoverIdxPortal(
  dataLength: number,
  xOfIdx: (idx: number) => number,
  viewBoxWidth: number,
) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; topY: number } | null>(null);
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || dataLength === 0) return;
      const vbX = ((e.clientX - rect.left) / rect.width) * viewBoxWidth;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < dataLength; i++) {
        const d = Math.abs(xOfIdx(i) - vbX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      setHoverIdx(bestIdx);
      // tooltip 위치: pointer x 그대로, top 은 컨테이너 상단 (차트 위쪽).
      setPointer({ x: e.clientX, y: e.clientY, topY: rect.top });
    },
    [dataLength, xOfIdx, viewBoxWidth],
  );
  const onPointerLeave = useCallback(() => {
    setHoverIdx(null);
    setPointer(null);
  }, []);
  return { hoverIdx, pointer, onPointerMove, onPointerLeave };
}

export interface ChartTooltipProps {
  /** 0~100 (viewBox 의 hover x 가 컨테이너 폭에서 차지하는 비율). */
  leftPercent: number;
  /** 컨테이너 상단 기준 offset (px). 기본 -32 (차트 위쪽). */
  top?: number;
  children: ReactNode;
  style?: CSSProperties;
}

const TOOLTIP_BASE_STYLE: CSSProperties = {
  background: "#003049",
  color: "#fff",
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: 4,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  zIndex: 9999,
  boxShadow: "0 2px 6px rgba(0, 48, 73, 0.15)",
  lineHeight: 1.4,
};

export function ChartTooltip({ leftPercent, top = -32, children, style }: ChartTooltipProps) {
  // 좌/우 끝에서 잘리지 않도록 clamp.
  const clamped = Math.max(0, Math.min(100, leftPercent));
  return (
    <div
      style={{
        position: "absolute",
        left: `${clamped}%`,
        transform: "translateX(-50%)",
        top,
        ...TOOLTIP_BASE_STYLE,
        zIndex: 5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface ChartPortalTooltipProps {
  /** 포인터의 client x 좌표 (px). */
  clientX: number;
  /** tooltip 을 띄울 client y 좌표 (px). 보통 컨테이너의 rect.top — tooltip 은 그 위로 띄움. */
  clientY: number;
  /** clientY 기준 추가 offset (px). 기본 -10 (위로). */
  offsetY?: number;
  children: ReactNode;
  style?: CSSProperties;
}

/** 표 셀 등 overflow 환경용. document.body 로 portal 렌더링, fixed position. */
export function ChartPortalTooltip({
  clientX,
  clientY,
  offsetY = -10,
  children,
  style,
}: ChartPortalTooltipProps) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: clientX,
        top: clientY + offsetY,
        transform: "translate(-50%, -100%)",
        ...TOOLTIP_BASE_STYLE,
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** dashed crosshair vertical line — SVG 내부에서 사용. */
export function ChartCrosshair({
  x,
  y1 = 0,
  y2,
  color = "#003049",
}: {
  x: number;
  y1?: number;
  y2: number;
  color?: string;
}) {
  return (
    <line
      x1={x}
      x2={x}
      y1={y1}
      y2={y2}
      stroke={color}
      strokeWidth={1}
      strokeDasharray="3,3"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}
