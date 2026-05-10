// DetailSectionBox — 4 detail 화면 공통 섹션 wrapper.
// 카드 스타일 + 제목 + 우상단 ExampleBadge slot + body.
// commodity / fundamental / macro / technical 모든 페이지의 일반 섹션은
// 이 컴포넌트로 감쌈.

import type { CSSProperties, ReactNode } from "react";
import { ExampleBadge } from "../../visualization/ExampleBadge";

export interface DetailSectionBoxProps {
  title?: ReactNode;
  /** 제목 우측 ExampleBadge — 섹션 전체가 mock 일 때 */
  exampleNote?: string;
  /** 우상단에 임의 노드 (badge 아닌 우상단 메타 텍스트 등) */
  rightSlot?: ReactNode;
  /** card 패딩 제거 — 표(DataTable) 처럼 자체 border 가진 child 용 */
  bare?: boolean;
  /** body padding 끄기 — 카드 외곽만 유지하고 내부 padding 0 */
  flush?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

export function DetailSectionBox({
  title,
  exampleNote,
  rightSlot,
  bare,
  flush,
  style,
  children,
}: DetailSectionBoxProps) {
  const cardStyle: CSSProperties = bare
    ? { display: "flex", flexDirection: "column", gap: 12, minWidth: 0, ...style }
    : {
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: flush ? 0 : "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        ...style,
      };
  return (
    <section style={cardStyle}>
      {(title || exampleNote || rightSlot) && (
        <div style={S.headerRow}>
          {title && <span style={S.title}>{title}</span>}
          <div style={S.headerRight}>
            {rightSlot}
            {exampleNote && <ExampleBadge title={exampleNote} />}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

const S: Record<string, CSSProperties> = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerRight: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
};
