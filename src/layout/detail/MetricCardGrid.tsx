// MetricCardGrid — N-column grid layout for MiniCard / 카드 정렬.
// 시안 등장 처: §2 4 mini cards (commodity), §3 8-grid (commodity),
//              펀더 9 지표 그리드, technical 6-metric 카드 등.
//
// 단일 책임: CSS grid 의 columns/gap 만 표준화. 자식 카드는 외부에서 결정.

import type { CSSProperties, ReactNode } from "react";

export interface MetricCardGridProps {
  /** 컬럼 수 (디폴트 4) — 반응형 단순화: 모바일 미고려 (시안이 1440 desktop) */
  columns?: number;
  gap?: number;
  children: ReactNode;
  style?: CSSProperties;
}

export function MetricCardGrid({
  columns = 4,
  gap = 12,
  children,
  style,
}: MetricCardGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
