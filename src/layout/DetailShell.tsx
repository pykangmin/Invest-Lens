// DetailShell — 4 detail 화면 (펀더멘털/거시/원자재/기술) 의 공통 껍데기.
// spec: docs/figma/dashboard-slots-v4.md §4.1
//
// 구조:
//   - 상단 헤더 (로고 + 글로벌 검색)
//   - breadcrumb (이전으로 + TICKER > 페이지명 + 데이터 업데이트 시각)
//   - 좌측 nav (개요 / 펀더멘털 / 거시 경제 / 원자재 영향 / 기술적 지표)
//   - 우측 콘텐츠 슬롯 (children)

import type { CSSProperties, ReactNode } from "react";
import { GlobalSearch } from "../visualization/GlobalSearch";
import { responsiveStyles } from "../shared/responsiveStyle";

export type DetailSection = "fundamental" | "macro" | "commodity" | "technical";

export interface DetailShellProps {
  ticker: string;
  active: DetailSection;
  pageTitle: string;
  pageSubtitle?: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
  children: ReactNode;
}

interface NavItem {
  key: DetailSection | "overview";
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "개요" },
  { key: "fundamental", label: "펀더멘털" },
  { key: "macro", label: "거시 경제" },
  { key: "commodity", label: "원자재 영향" },
  { key: "technical", label: "기술적 지표" },
];

const SECTION_BREADCRUMB: Record<DetailSection, string> = {
  fundamental: "기업 펀더멘털",
  macro: "거시경제 국면 모니터",
  commodity: "원자재 영향 분석",
  technical: "기술적 지표 스코어카드",
};

export function DetailShell({
  ticker,
  active,
  pageTitle,
  pageSubtitle,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
  children,
}: DetailShellProps) {
  return (
    <div style={S.page}>
      {/* 헤더 — 풀폭 */}
      <header className="il-header" style={S.header}>
        <button style={S.headerLogo} onClick={onBackToHome} aria-label="진입 화면으로">
          <img src="/invest-lens-logo.svg" alt="" style={S.logoMark} aria-hidden />
          <span style={S.logoWord}>Invest Lens</span>
        </button>
        <GlobalSearch onSelectTicker={onSelectTicker} variant="header" />
        <div />
      </header>

      {/* 사이드바 (좌측 viewport 고정) + 메인 영역 (헤더 아래 풀폭, 내부 콘텐츠 1110 centered) */}
      <div className="il-detail-body-grid" style={S.bodyGrid}>
        <aside className="il-detail-nav" style={S.nav}>
          {/* 사이드바 최상단: 〈 이전으로 */}
          <button type="button" style={S.crumbBack} onClick={onBackToOverview}>
            〈 이전으로
          </button>
          <div style={S.navList}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === active;
              const handle = () => {
                if (item.key === "overview") onBackToOverview();
                else onNavigateSection(item.key as DetailSection);
              };
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`il-detail-nav-item${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    ...S.navItem,
                    ...(isActive ? S.navItemActive : null),
                  }}
                  onClick={handle}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="il-detail-main" style={S.mainArea}>
          <div style={S.contentInner}>
            {/* 메인 콘텐츠 좌상단: GOOGLE > 원자재 영향 */}
            <div style={S.crumbRow}>
              <span style={S.crumbPath}>
                {ticker} &gt; {SECTION_BREADCRUMB[active]}
              </span>
            </div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>{pageTitle}</h1>
              {pageSubtitle && <p style={S.subtitle}>{pageSubtitle}</p>}
            </div>
            <div style={S.contentSections}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

const S = responsiveStyles({
  page: { minHeight: "100vh", minWidth: "64rem", background: "var(--color-bg)" },
  header: {
    height: 66,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    background: "var(--color-header-bg)",
    borderBottom: "1px solid var(--color-border)",
    // 헤더는 main 뷰와 동일한 패딩 (1440 viewport 기준 좌우 100px)
    padding: "0 100px",
  },
  headerLogo: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    color: "var(--color-text)",
    justifySelf: "start",
  },
  logoMark: { width: 24, height: 24, display: "block" },
  logoWord: {
    fontFamily: "var(--font-brand)",
    fontWeight: 400,
    fontSize: 20,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },

  // 헤더 아래 — viewport 풀폭 grid: [사이드바 | 메인 영역]
  // 사이드바는 좌측에 고정 위치로 보이고, 메인 영역은 나머지를 채움
  bodyGrid: {
    display: "grid",
    gridTemplateColumns: "11rem 1fr",
    alignItems: "start",
    minHeight: "calc(100vh - 66px)",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    position: "sticky",
    top: 16,
    padding: "16px 10px 24px 24px",
    alignSelf: "start",
    minHeight: "calc(100vh - 66px)",
    borderRight: "1px solid var(--color-border)",
    boxSizing: "border-box",
  },
  navList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  // 메인 영역 — 풀폭. 내부 콘텐츠는 max 1110 centered (overview 메인 뷰와 너비 일치).
  mainArea: {
    display: "flex",
    flexDirection: "column",
    minWidth: "48.75rem",
    padding: "16px 24px 64px",
  },
  contentInner: {
    width: "100%",
    maxWidth: 1110,
    minWidth: "48.75rem",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  contentSections: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  crumbRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    padding: "0 0 4px 0",
  },
  crumbBack: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
    padding: 0,
    textAlign: "left",
  },
  crumbPath: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    fontWeight: 600,
  },

  navItem: {
    textAlign: "left",
    padding: "10px 10px",
    fontSize: "var(--font-size-md)",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    borderRadius: "var(--radius-tag)",
    transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)",
  },
  navItemActive: {
    color: "var(--color-text)",
    background: "#eef6ff",
    fontWeight: 600,
    boxShadow: "inset 3px 0 0 var(--color-text)",
    transform: "translateX(2px)",
  },

  titleBlock: { display: "flex", flexDirection: "column", gap: 6 },
  title: {
    fontSize: "var(--font-size-xl-num)",
    fontWeight: 700,
    color: "var(--color-text)",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: "var(--font-size-base)",
    color: "var(--color-text-muted)",
    lineHeight: 1.4,
    fontWeight: 500,
  },
});
