// ExampleBadge — DB 부재로 mock 데이터를 채운 슬롯에 부착하는 작은 칩.
// 채점자가 실 데이터와 mock 을 화면 위에서 즉시 구분할 수 있게 함.
//
// tone:
//   "example" — DB 시계열 부재 (예: USD/KRW · S&P 500 가격) — 시안 mock 그대로
//   "stub"    — 흐름상 안 맞거나 기술 미구현 — 형태만 흉내낸 placeholder
//
// 디자인: 옅은 회색 칩, radius 4, 폰트 10/600, 시안 톤 깨지 않게 작고 약함.

import type { CSSProperties } from "react";
import { responsiveStyles } from "../shared/responsiveStyle";

export type ExampleTone = "example" | "stub";

export interface ExampleBadgeProps {
  tone?: ExampleTone;
  text?: string;
  title?: string;
  style?: CSSProperties;
}

export function ExampleBadge({
  tone = "example",
  text,
  title,
  style,
}: ExampleBadgeProps) {
  const label = text ?? (tone === "stub" ? "미구현" : "예시");
  const defaultTitle =
    tone === "stub"
      ? "데이터 흐름 또는 기술적 제약으로 미구현 — 시안 형태만 표시"
      : "DB 데이터 부재 — 시안 mock 표시";
  return (
    <span
      style={{ ...S.base, ...(tone === "stub" ? S.stub : S.example), ...style }}
      title={title ?? defaultTitle}
      aria-label={label}
    >
      {label}
    </span>
  );
}

const S = responsiveStyles({
  base: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
    padding: "3px 6px",
    borderRadius: 4,
    letterSpacing: "0.04em",
    fontFamily: "var(--font-ui)",
    whiteSpace: "nowrap",
  },
  example: {
    color: "var(--color-text-faint)",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
  },
  stub: {
    color: "var(--color-text-faint)",
    background: "var(--color-bg)",
    border: "1px dashed var(--color-border)",
  },
});
