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
  if (variant === "loading") {
    return (
      <div style={S.loading}>
        <div style={S.loadingTrack} role="progressbar" aria-label={message ?? "Loading"}>
          <div style={S.loadingFill} />
        </div>
      </div>
    );
  }

  const cls =
    variant === "error" ? S.error : S.noData;
  const fallback =
    variant === "error"
      ? "데이터 로드 실패"
      : variant === "noData"
        ? "표시할 데이터가 없습니다"
        : "";
  return <div style={cls}>{message ?? fallback}</div>;
}

const S = responsiveStyles({
  loading: {
    minHeight: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 64,
  },
  loadingTrack: {
    position: "relative",
    width: 180,
    height: 5,
    borderRadius: 999,
    background: "#e7edf3",
    overflow: "hidden",
  },
  loadingFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "42%",
    borderRadius: 999,
    background: "var(--color-text)",
    animation: "investLensLoadingBar 1.05s ease-in-out infinite",
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
