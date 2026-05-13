// HeroSummaryBlock — 4 detail 화면 §1 공통 패턴.
// 좌: 제목 + 본문 + chip 행 / 우: 도넛 + 라벨 (vertical separator).
// 시안 등장 처: commodity §1, fundamental §1, macro §1, technical §1.

import type { CSSProperties, ReactNode } from "react";
import { ExampleBadge } from "../../visualization/ExampleBadge";
import { responsiveStyles } from "../../shared/responsiveStyle";

export interface HeroSummaryBlockProps {
  /** 좌측 제목 (예: "핵심 요약") */
  title: ReactNode;
  /** 좌측 제목 옆 ExampleBadge — 본문이 mock 일 때 */
  bodyExampleNote?: string;
  /** 좌측 본문 — 보통 <p> 텍스트 */
  body?: ReactNode;
  /** 좌측 chip 행 — 보통 <StatusChip> 들 */
  chips?: ReactNode;
  /** 우측 제목 (예: "원자재가 종합 영향 점수") */
  rightTitle?: ReactNode;
  /** 우측 콘텐츠 — 보통 <Donut> + 라벨 */
  right: ReactNode;
}

export function HeroSummaryBlock({
  title,
  bodyExampleNote,
  body,
  chips,
  rightTitle,
  right,
}: HeroSummaryBlockProps) {
  return (
    <section style={S.section}>
      <div style={S.left}>
        <div style={S.headerRow}>
          <span style={S.title}>{title}</span>
          {bodyExampleNote && <ExampleBadge title={bodyExampleNote} />}
        </div>
        {body && <div style={S.body}>{body}</div>}
        {chips && <div style={S.chipsRow}>{chips}</div>}
      </div>
      <div style={S.right}>
        {rightTitle && <div style={S.title}>{rightTitle}</div>}
        <div style={S.rightContent}>{right}</div>
      </div>
    </section>
  );
}

const S = responsiveStyles({
  section: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
    gap: 16,
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "20px 24px",
  },
  left: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  right: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "flex-start",
    borderLeft: "1px solid var(--color-border)",
    paddingLeft: 24,
    minWidth: 0,
  },
  rightContent: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  body: {
    fontSize: "var(--font-size-base)",
    color: "var(--color-text-body)",
    lineHeight: 1.5,
    fontWeight: 500,
  },
  chipsRow: { display: "flex", gap: 24, flexWrap: "wrap" },
});
