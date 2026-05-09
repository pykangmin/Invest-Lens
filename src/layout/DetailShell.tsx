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

export type DetailSection = "fundamental" | "macro" | "commodity" | "technical";

export interface DetailShellProps {
  ticker: string;
  active: DetailSection;
  pageTitle: string;
  pageSubtitle?: string;
  updatedAt?: string;
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
  updatedAt,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
  children,
}: DetailShellProps) {
  return (
    <div style={S.page}>
      {/* 헤더 — 로고 + 글로벌 검색 */}
      <header style={S.header}>
        <button style={S.headerLogo} onClick={onBackToHome} aria-label="진입 화면으로">
          <img src="/invest-lens-logo.svg" alt="" style={S.logoMark} aria-hidden />
          <span style={S.logoWord}>Invest Lens</span>
        </button>
        <GlobalSearch onSelectTicker={onSelectTicker} variant="header" />
        <div />
      </header>

      <div style={S.canvas}>
        {/* breadcrumb */}
        <div style={S.breadcrumb}>
          <button type="button" style={S.crumbBack} onClick={onBackToOverview}>
            〈 이전으로
          </button>
          <span style={S.crumbPath}>
            {ticker} &gt; {SECTION_BREADCRUMB[active]}
          </span>
          {updatedAt && (
            <span style={S.crumbUpdate}>데이터 업데이트: {updatedAt}</span>
          )}
        </div>

        {/* 좌 nav + 콘텐츠 grid */}
        <div style={S.body}>
          <aside style={S.nav}>
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
          </aside>

          <main style={S.content}>
            <div style={S.titleBlock}>
              <h1 style={S.title}>{pageTitle}</h1>
              {pageSubtitle && <p style={S.subtitle}>{pageSubtitle}</p>}
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--color-bg)" },
  header: {
    height: 66,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    background: "var(--color-header-bg)",
    borderBottom: "1px solid var(--color-border)",
    padding: "0 100px",
  },
  headerLogo: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "var(--color-text)",
    justifySelf: "start",
  },
  logoMark: { width: 24, height: 24, display: "block" },
  logoWord: {
    fontFamily: "var(--font-brand)",
    fontWeight: 400,
    fontSize: 20,
    letterSpacing: "0.02em",
  },

  canvas: {
    maxWidth: "var(--canvas-max)",
    margin: "0 auto",
    padding: "16px var(--content-pad-x) 64px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    padding: "8px 0",
  },
  crumbBack: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
    padding: 0,
  },
  crumbPath: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
  },
  crumbUpdate: {
    marginLeft: "auto",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-faint)",
  },

  body: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 160px) 1fr",
    gap: 24,
    alignItems: "start",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    position: "sticky",
    top: 16,
  },
  navItem: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "var(--font-size-md)",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    borderRadius: "var(--radius-tag)",
    transition: "background var(--duration-fast) var(--ease-out)",
  },
  navItemActive: {
    color: "var(--color-text)",
    background: "var(--color-header-bg)",
    fontWeight: 600,
  },

  content: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    minWidth: 0,
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
};
