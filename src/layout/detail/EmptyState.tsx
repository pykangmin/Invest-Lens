// EmptyState — detail 페이지 공통 비어있음/로딩/에러 표시.
// CommodityDetail에서 inline 으로 분기되던 패턴을 통일.

import type { CSSProperties } from "react";
import { responsiveStyles } from "../../shared/responsiveStyle";

export type EmptyStateVariant = "loading" | "error" | "noData";

export interface EmptyStateProps {
  variant: EmptyStateVariant;
  /** 사용자에게 보여줄 메세지. 미지정 시 variant 별 기본 문구. */
  message?: string;
}

export function EmptyState({ variant, message }: EmptyStateProps) {
  const cls =
    variant === "error" ? S.error : variant === "noData" ? S.noData : S.loading;
  const fallback =
    variant === "error"
      ? "데이터 로드 실패"
      : variant === "noData"
        ? "표시할 데이터가 없습니다"
        : "분석 중…";
  return <div style={cls}>{message ?? fallback}</div>;
}

const S = responsiveStyles({
  loading: {
    color: "var(--color-text-muted)",
    padding: 64,
    textAlign: "center",
    fontSize: "var(--font-size-base)",
  },
  noData: {
    color: "var(--color-text-muted)",
    background: "var(--color-card)",
    border: "1px dashed var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 32,
    textAlign: "center",
    fontSize: "var(--font-size-sm)",
  },
  error: {
    color: "var(--color-down)",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 16,
    fontSize: "var(--font-size-sm)",
  },
});
