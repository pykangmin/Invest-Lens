// EmptyState — detail 페이지 공통 비어있음/로딩/에러 표시.
// CommodityDetail에서 inline 으로 분기되던 패턴을 통일.

import { useEffect, useState, type CSSProperties } from "react";
import { responsiveStyles } from "../../shared/responsiveStyle";

export type EmptyStateVariant = "loading" | "error" | "noData";

export interface EmptyStateProps {
  variant: EmptyStateVariant;
  /** 사용자에게 보여줄 메세지. 미지정 시 variant 별 기본 문구. */
  message?: string;
  progress?: number;
}

export function EmptyState({ variant, message, progress }: EmptyStateProps) {
  const [autoProgress, setAutoProgress] = useState(12);

  useEffect(() => {
    if (variant !== "loading" || progress != null) return;

    setAutoProgress(12);
    const id = window.setInterval(() => {
      setAutoProgress((current) => {
        if (current >= 92) return 92;
        if (current < 48) return current + 9;
        if (current < 78) return current + 5;
        return current + 2;
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [progress, variant]);

  if (variant === "loading") {
    const value = Math.max(8, Math.min(100, progress ?? autoProgress));
    return (
      <div style={S.loading}>
        <div
          style={S.loadingTrack}
          role="progressbar"
          aria-label={message ?? "Loading"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value)}
        >
          <div style={{ ...S.loadingFill, width: `${value}%` }} />
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
    width: 320,
    height: 10,
    borderRadius: 999,
    background: "#e7edf3",
    overflow: "hidden",
  },
  loadingFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    background: "var(--color-text)",
    transition: "width 180ms var(--ease-out)",
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
