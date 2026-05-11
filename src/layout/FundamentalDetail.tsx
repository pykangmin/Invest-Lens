// FundamentalDetail — 기업 펀더멘털 detail 화면.
// spec: docs/figma/screens/main-fundamental.json (Figma node 376:483, 1440×1497)
//
// 시안 구조 (y기준, 콘텐츠 영역 x=237~1338, w=1101):
//   §1 (231-446, h=215) — 현재 기업 펀더멘털 요약
//        좌(98w) 종합 스코어: 라벨 + N/100(28pt) + tagline(18pt)
//        우(949w) 5-card row (182w each): icon + 라벨(11pt) + 큰 숫자(35pt) + sub(10.5pt) + i툴팁
//   §2 (458-799, h=341) — 3 컬럼: 현금흐름 & 안정성(369w) / 수익성(380w) / 성장성(328w)
//        각각: title + score tag(#f4f9ff) + graph placeholder
//   §3 (811-1094, h=283) — 2 컬럼:
//        좌(561w) 가치평가 (Valuation): title + score tag + 부연 tag + graph placeholder
//        우(520w) 섹션별 스코어 분포: title + graph placeholder + bottom 종합 판정 row
//   §4 (1106-1380, h=274) — 핵심 투자 논거 & 리스크: 강점 3 / 약점 3 row (dot+title+body)

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  cpiYoyFrom,
  growthVsInflationLabel,
  marginDefenseLabel,
  multipleLabel,
  peerRankLabel,
  sectionScores,
  totalFromSections,
  valuationZoneLabel,
  verdictFromScore,
} from "../analysis/fundamentalNarrative";
import {
  loadCompanySnapshot,
  loadGlobalEnvironment,
  loadPeers,
} from "../data-loader/investmentData";
import type {
  CompanySnapshot,
  GlobalEnvironmentResponse,
  PeerCompany,
  PeersResponse,
  StockFundamentals,
} from "../types/investment";
import { DetailShell, type DetailSection } from "./DetailShell";
import { EmptyState } from "./detail";

export interface FundamentalDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

// 5-card row mock — sub-text 와 mock 라벨은 시안 그대로 유지, 큰 숫자만 실데이터에서 매핑 (없으면 mock 유지).
interface HeroCard {
  key: "fcf" | "roe" | "revenue" | "gross" | "ev";
  label: string;
  bigValue: string;
  sub: string;
  iconHint: "fcf" | "roe" | "revenue" | "gross" | "ev";
}

function fmtPct(v: number | null, digits = 1, withSign = false): string {
  if (v == null) return "—";
  const pct = v * 100;
  const sign = withSign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

function fmtCompactUSD(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toFixed(0);
}

function buildHeroCards(
  f: StockFundamentals | null,
  ticker: string,
  peers: PeerCompany[] | null,
  cpiYoy: number | null,
): HeroCard[] {
  // FCF 절대값 = market_cap × fcf_yield (DERIVED)
  const fcfAbsolute =
    f?.marketCap != null && f.fcfYield != null
      ? f.marketCap * f.fcfYield
      : null;
  return [
    {
      key: "fcf",
      label: "FCF (연간)",
      bigValue: fcfAbsolute != null ? `$${fmtCompactUSD(fcfAbsolute)}` : "—",
      sub: f?.fcfMargin != null ? `FCF Margin ${(f.fcfMargin * 100).toFixed(0)}%` : "—",
      iconHint: "fcf",
    },
    {
      key: "roe",
      label: "ROE",
      bigValue: f?.roe != null ? fmtPct(f.roe) : "—",
      sub: peers && peers.length > 0 ? peerRankLabel(ticker, peers, "roe", true) : "—",
      iconHint: "roe",
    },
    {
      key: "revenue",
      label: "매출 성장 YoY",
      bigValue: f?.revenueGrowth != null ? fmtPct(f.revenueGrowth, 0, true) : "—",
      sub: growthVsInflationLabel(f?.revenueGrowth ?? null, cpiYoy),
      iconHint: "revenue",
    },
    {
      key: "gross",
      // 1.11 Gross Margin 절대값은 DB 없음 → 큰 숫자 비움 (MOCK).
      label: "Gross Margin",
      bigValue: "—",
      sub: marginDefenseLabel(f?.grossMarginYoy ?? null),
      iconHint: "gross",
    },
    {
      key: "ev",
      label: "EV/EBITDA",
      bigValue: f?.evEbitda != null ? `${f.evEbitda.toFixed(1)}x` : "—",
      sub: valuationZoneLabel(f?.evEbitda ?? null),
      iconHint: "ev",
    },
  ];
}

// §4 강점/약점 — DB·분석 없음 (MOCK) → title/body 비움. 행 구조(dot 3+3)는 유지.
const STRENGTHS: Array<{ dotColor: string; title: string; body: string }> = [
  { dotColor: "#60c846", title: "", body: "" },
  { dotColor: "#60c846", title: "", body: "" },
  { dotColor: "#60c846", title: "", body: "" },
];

const RISKS: Array<{ dotColor: string; title: string; body: string }> = [
  { dotColor: "#c1121f", title: "", body: "" },
  { dotColor: "#c1121f", title: "", body: "" },
  { dotColor: "#c1121f", title: "", body: "" },
];

export function FundamentalDetail({
  ticker,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
}: FundamentalDetailProps) {
  const [data, setData] = useState<CompanySnapshot | null>(null);
  const [peers, setPeers] = useState<PeersResponse | null>(null);
  const [cpi, setCpi] = useState<GlobalEnvironmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setPeers(null);
    setError(null);
    loadCompanySnapshot(ticker, 24)
      .then((s) => {
        if (alive) setData(s);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    loadPeers(ticker, 6)
      .then((p) => {
        if (alive) setPeers(p);
      })
      .catch(() => {
        /* peer 실패는 비치명 */
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  // CPI 는 ticker 무관 — 마운트 1회만.
  useEffect(() => {
    let alive = true;
    loadGlobalEnvironment({ symbol: "CPIAUCSL", historyLimit: 14 })
      .then((r) => {
        if (alive) setCpi(r);
      })
      .catch(() => {
        /* CPI 실패는 비치명 — sub 라벨만 "—" */
      });
    return () => {
      alive = false;
    };
  }, []);

  const analysis = useMemo(() => {
    if (!data) return null;
    const sections = sectionScores(data.latestFundamentals);
    const totalScore = totalFromSections(sections);
    const verdict = verdictFromScore(totalScore);
    const cpiYoy = cpi ? cpiYoyFrom(cpi.history) : null;
    const peerList: PeerCompany[] | null = peers?.peers ?? null;
    const heroCards = buildHeroCards(
      data.latestFundamentals,
      ticker,
      peerList,
      cpiYoy,
    );
    const valuationTag = multipleLabel(
      data.latestFundamentals?.pbrZScore ?? null,
      data.latestFundamentals?.forwardPerZScore ?? null,
    );
    return { sections, totalScore, verdict, heroCards, valuationTag };
  }, [data, peers, cpi, ticker]);

  const updatedAt = data?.latestFundamentals?.date ?? undefined;

  return (
    <DetailShell
      ticker={ticker}
      active="fundamental"
      pageTitle="기업 펀더멘털"
      pageSubtitle="기업의 수익성, 성장성, 현금흐름, 밸류에이션 지표를 기반으로 장기 투자 매력도와 재무 건전성을 분석합니다."
      updatedAt={updatedAt ? `${updatedAt} (분기 보고)` : undefined}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <EmptyState variant="error" message={`로드 실패: ${error}`} />}
      {!error && (!data || !analysis) && <EmptyState variant="loading" />}
      {data && analysis && (
        <>
          {/* §1 현재 기업 펀더멘털 요약 */}
          <section style={S.row1}>
            <div style={S.row1Header}>현재 기업 펀더멘털 요약</div>
            <div style={S.row1Body}>
              {/* 좌: 종합 스코어 (98w block) */}
              <div style={S.scoreBlock}>
                <div style={S.scoreLabel}>종합 스코어</div>
                <div
                  style={{
                    ...S.scoreValue,
                    color: analysis.verdict.color,
                  }}
                >
                  {analysis.totalScore != null ? `${analysis.totalScore}/100` : "—"}
                </div>
                <div style={S.scoreTag}>{analysis.verdict.label}</div>
              </div>
              {/* 우: 5-card row */}
              <div style={S.heroCardRow}>
                {analysis.heroCards.map((c) => (
                  <HeroCardView key={c.key} card={c} />
                ))}
              </div>
            </div>
          </section>

          {/* §2 3 컬럼 — 현금흐름 / 수익성 / 성장성 */}
          <div style={S.row2}>
            <SectionBox
              title="현금흐름 & 안정성"
              scoreTag={analysis.sections[0].display}
              flex={369}
            >
              <GraphPlaceholder hint="현금흐름 추이 차트" />
            </SectionBox>
            <SectionBox
              title="수익성"
              scoreTag={analysis.sections[1].display}
              flex={380}
            >
              <GraphPlaceholder hint="수익성 차트 (ROE/순이익률 등)" />
            </SectionBox>
            <SectionBox
              title="성장성"
              scoreTag={analysis.sections[2].display}
              flex={328}
            >
              <GraphPlaceholder hint="성장 막대 차트 (revenue/EPS YoY)" />
            </SectionBox>
          </div>

          {/* §3 2 컬럼 — 가치평가 / 섹션별 스코어 분포 */}
          <div style={S.row3}>
            <SectionBox
              title="가치평가 (Valuation)"
              scoreTag={analysis.sections[3].display}
              extraTag={analysis.valuationTag}
              flex={561}
            >
              <GraphPlaceholder hint="PER·PBR·EV/EBITDA 분포" />
            </SectionBox>
            <SectionBox title="섹션별 스코어 분포" flex={520}>
              <GraphPlaceholder hint="레이더/막대 분포 차트" small />
              <div style={S.verdictBox}>
                <div style={S.verdictCell}>
                  <span style={S.verdictCellLabel}>종합 판정</span>
                  <span
                    style={{
                      ...S.verdictCellValue,
                      color: analysis.verdict.color,
                    }}
                  >
                    {analysis.verdict.label}
                  </span>
                </div>
                <div style={S.verdictDivider} />
                <div style={S.verdictCell}>
                  <span style={S.verdictCellLabel}>종합 스코어</span>
                  <span style={{ ...S.verdictCellValue, color: "#003049" }}>
                    {analysis.totalScore != null ? `${analysis.totalScore}/100` : "—"}
                  </span>
                </div>
              </div>
            </SectionBox>
          </div>

          {/* §4 핵심 투자 논거 & 리스크 */}
          <section style={S.row4}>
            <div style={S.row4Title}>핵심 투자 논거 & 리스크</div>
            <div style={S.thesisBody}>
              <ThesisColumn title="강점 Strength" rows={STRENGTHS} />
              <ThesisColumn title="약점 Risks" rows={RISKS} />
            </div>
          </section>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function HeroCardView({ card }: { card: HeroCard }) {
  return (
    <div style={S.heroCard}>
      <div style={S.heroCardHead}>
        <div style={S.heroCardIcon} aria-hidden>
          <HeroCardIcon kind={card.iconHint} />
        </div>
        <span style={S.heroCardLabel}>{card.label}</span>
        <span style={S.heroCardTooltip} title="자세히">
          i
        </span>
      </div>
      <div style={S.heroCardBig}>{card.bigValue}</div>
      <div style={S.heroCardSub}>{card.sub}</div>
    </div>
  );
}

// 간단한 SVG 아이콘 (시안 Group 135 placeholder 위치)
function HeroCardIcon({ kind }: { kind: HeroCard["iconHint"] }) {
  const stroke = "#003049";
  const common = { fill: "none", stroke, strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "fcf") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5.5" {...common} />
        <path d="M5 7l1.7 1.7L9.3 5.6" {...common} />
      </svg>
    );
  }
  if (kind === "roe") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M2 11l3-3 2.5 2.5L12 4" {...common} />
        <path d="M9 4h3v3" {...common} />
      </svg>
    );
  }
  if (kind === "revenue") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M2 10l4-5 3 3 3-5" {...common} />
        <path d="M9 3h3v3" {...common} />
      </svg>
    );
  }
  if (kind === "gross") {
    // pie chart 아이콘 (foundation:graph-pie)
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5.5" {...common} />
        <path d="M7 1.5 V7 L11.5 9.5" {...common} />
      </svg>
    );
  }
  // ev
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="2.5" y="2.5" width="9" height="9" rx="1.2" {...common} />
      <path d="M5 7h4M7 5v4" {...common} />
    </svg>
  );
}

function SectionBox({
  title,
  scoreTag,
  extraTag,
  flex,
  children,
}: {
  title: string;
  scoreTag?: string;
  extraTag?: string;
  flex: number;
  children: ReactNode;
}) {
  return (
    <section style={{ ...S.sectionBox, flexGrow: flex, flexBasis: 0 }}>
      <div style={S.sectionBoxHeader}>
        <span style={S.sectionBoxTitle}>{title}</span>
        <div style={S.sectionBoxTags}>
          {scoreTag && <span style={S.sectionScoreTag}>{scoreTag}</span>}
          {extraTag && (
            <span style={{ ...S.sectionScoreTag, minWidth: 140 }}>{extraTag}</span>
          )}
        </div>
      </div>
      <div style={S.sectionBoxBody}>{children}</div>
    </section>
  );
}

function GraphPlaceholder({
  hint,
  small,
}: {
  hint: string;
  small?: boolean;
}) {
  return (
    <div style={{ ...S.graphPlaceholder, minHeight: small ? 137 : 218 }}>
      <span style={S.graphPlaceholderHint}>그래프 자리 — {hint}</span>
    </div>
  );
}

function ThesisColumn({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ dotColor: string; title: string; body: string }>;
}) {
  return (
    <div style={S.thesisCol}>
      <div style={S.thesisColTitle}>{title}</div>
      <div style={S.thesisRows}>
        {rows.map((r, i) => (
          <div key={i}>
            <div style={S.thesisRow}>
              <div style={S.thesisRowHead}>
                <span style={{ ...S.thesisDot, background: r.dotColor }} />
                <span style={S.thesisRowTitle}>
                  {r.title || <span style={S.thesisEmpty}>—</span>}
                </span>
              </div>
              <div style={S.thesisRowBody}>
                {r.body || <span style={S.thesisEmpty}>—</span>}
              </div>
            </div>
            {i < rows.length - 1 && <div style={S.thesisRowDivider} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────

const NAVY = "#003049";
const MUTED = "#737373";
const SCORE_TAG_BG = "#f4f9ff";
const DOWN = "#c1121f";

const S: Record<string, CSSProperties> = {
  // §1
  row1: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  row1Header: {
    fontSize: 16,
    fontWeight: 600,
    color: NAVY,
  },
  row1Body: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, 160px) 1fr",
    gap: 32,
    alignItems: "flex-start",
  },
  scoreBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingTop: 4,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 600,
    color: DOWN,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  scoreTag: {
    fontSize: 18,
    fontWeight: 600,
    color: NAVY,
    lineHeight: 1.1,
  },
  heroCardRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 12,
  },
  heroCard: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },
  heroCardHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  heroCardIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 27,
    height: 27,
    borderRadius: "50%",
    background: "#f4f9ff",
    flexShrink: 0,
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
  },
  heroCardTooltip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: "50%",
    fontSize: 10.5,
    fontWeight: 600,
    color: MUTED,
    border: `1px solid ${MUTED}`,
    cursor: "help",
    flexShrink: 0,
  },
  heroCardBig: {
    fontSize: 35,
    fontWeight: 600,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  heroCardSub: {
    fontSize: 10.5,
    fontWeight: 500,
    color: MUTED,
    lineHeight: 1.3,
  },

  // §2 §3 — 3 컬럼 / 2 컬럼 공통 row
  row2: { display: "flex", gap: 16, alignItems: "stretch" },
  row3: { display: "flex", gap: 16, alignItems: "stretch" },

  sectionBox: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
  },
  sectionBoxHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionBoxTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  sectionBoxTags: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  sectionScoreTag: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 81,
    height: 27,
    padding: "0 10px",
    background: SCORE_TAG_BG,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
  },
  sectionBoxBody: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },

  graphPlaceholder: {
    flex: 1,
    background: "#fafbfc",
    border: "1px dashed var(--color-border)",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  graphPlaceholderHint: {
    fontSize: 12,
    color: MUTED,
    fontStyle: "italic",
  },

  // §3-B verdict bottom box (471×75)
  verdictBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1px 1fr",
    gap: 16,
    background: SCORE_TAG_BG,
    borderRadius: 8,
    padding: "12px 18px",
    alignItems: "center",
    height: 75,
    boxSizing: "border-box",
  },
  verdictCell: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  verdictCellLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
  },
  verdictCellValue: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  verdictDivider: {
    width: 1,
    height: 51,
    background: "var(--color-border)",
    alignSelf: "center",
  },

  // §4
  row4: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  row4Title: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  thesisBody: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 32,
  },
  thesisCol: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  thesisColTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  thesisRows: {
    display: "flex",
    flexDirection: "column",
  },
  thesisRow: {
    display: "grid",
    gridTemplateColumns: "142px 1fr",
    gap: 18,
    alignItems: "flex-start",
    padding: "10px 0",
  },
  thesisRowHead: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  thesisDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flexShrink: 0,
  },
  thesisRowTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
    lineHeight: 1.2,
  },
  thesisRowBody: {
    fontSize: 12,
    fontWeight: 600,
    color: MUTED,
    lineHeight: 1.55,
  },
  thesisRowDivider: {
    height: 1,
    background: "var(--color-border)",
  },
  thesisEmpty: {
    color: MUTED,
    fontStyle: "italic",
    fontWeight: 500,
  },
};
