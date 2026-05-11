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

import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import {
  cashflowChartData,
  cashflowIndicators,
  cpiYoyFrom,
  growthChartData,
  growthIndicators,
  growthVsInflationLabel,
  marginDefenseLabel,
  multipleLabel,
  peerRankLabel,
  profitabilityChartData,
  profitabilityIndicators,
  sectionScores,
  totalFromSections,
  valuationIndicators,
  valuationRadarData,
  valuationZoneLabel,
  verdictFromScore,
  type CashflowChartData,
  type CashflowIndicator,
  type GrowthChartData,
  type ProfitabilityChartData,
  type RadarData,
  type SectionScore,
  type ValuationIndicator,
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
import { InfoTooltip } from "../visualization/InfoTooltip";
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
  iconName: string;
  iconBg: string;
  iconColor: string;
}

// 시안 ellipse 36 bg + vector color (각 카드별)
const HERO_ICON_META: Record<
  HeroCard["key"],
  { iconName: string; iconBg: string; iconColor: string }
> = {
  fcf: { iconName: "streamline:gold-remix", iconBg: "#faf9d2", iconColor: "#dad023" },
  roe: { iconName: "tabler:trending-up", iconBg: "#dadfff", iconColor: "#4340e9" },
  revenue: { iconName: "carbon:growth", iconBg: "#ddffdb", iconColor: "#3da12c" },
  gross: { iconName: "foundation:graph-pie", iconBg: "#f5e8ff", iconColor: "#d978d7" },
  ev: { iconName: "lucide:scale", iconBg: "#faeac7", iconColor: "#e5af43" },
};

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
  const card = (
    key: HeroCard["key"],
    label: string,
    bigValue: string,
    sub: string,
  ): HeroCard => ({
    key,
    label,
    bigValue,
    sub,
    ...HERO_ICON_META[key],
  });
  return [
    card(
      "fcf",
      "FCF (연간)",
      fcfAbsolute != null ? `$${fmtCompactUSD(fcfAbsolute)}` : "—",
      f?.fcfMargin != null ? `FCF Margin ${(f.fcfMargin * 100).toFixed(0)}%` : "—",
    ),
    card(
      "roe",
      "ROE",
      f?.roe != null ? fmtPct(f.roe) : "—",
      peers && peers.length > 0 ? peerRankLabel(ticker, peers, "roe", true) : "—",
    ),
    card(
      "revenue",
      "매출 성장 YoY",
      f?.revenueGrowth != null ? fmtPct(f.revenueGrowth, 0, true) : "—",
      growthVsInflationLabel(f?.revenueGrowth ?? null, cpiYoy),
    ),
    // Gross Margin 절대값은 DB 없음 → 큰 숫자 비움 (MOCK).
    card("gross", "Gross Margin", "—", marginDefenseLabel(f?.grossMarginYoy ?? null)),
    card(
      "ev",
      "EV/EBITDA",
      f?.evEbitda != null ? `${f.evEbitda.toFixed(1)}x` : "—",
      valuationZoneLabel(f?.evEbitda ?? null),
    ),
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
    const cashflowChart = cashflowChartData(data.fundamentalsHistory);
    const cashflowInds = cashflowIndicators(data.fundamentalsHistory);
    const profitabilityChart = profitabilityChartData(data.fundamentalsHistory);
    const profitabilityInds = profitabilityIndicators(data.fundamentalsHistory);
    const growthChart = growthChartData(data.fundamentalsHistory);
    const growthInds = growthIndicators(data.fundamentalsHistory);
    const valuationInds = valuationIndicators(data.fundamentalsHistory);
    const radar = valuationRadarData(data.latestFundamentals, peerList);
    return {
      sections,
      totalScore,
      verdict,
      heroCards,
      valuationTag,
      cashflowChart,
      cashflowInds,
      profitabilityChart,
      profitabilityInds,
      growthChart,
      growthInds,
      valuationInds,
      radar,
    };
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
              <CashflowSection
                chart={analysis.cashflowChart}
                indicators={analysis.cashflowInds}
              />
            </SectionBox>
            <SectionBox
              title="수익성"
              scoreTag={analysis.sections[1].display}
              flex={380}
            >
              <ProfitabilitySection
                chart={analysis.profitabilityChart}
                indicators={analysis.profitabilityInds}
              />
            </SectionBox>
            <SectionBox
              title="성장성"
              scoreTag={analysis.sections[3].display}
              flex={328}
            >
              <GrowthSection
                chart={analysis.growthChart}
                indicators={analysis.growthInds}
              />
            </SectionBox>
          </div>

          {/* §3 2 컬럼 — 가치평가 / 섹션별 스코어 분포 */}
          <div style={S.row3}>
            <SectionBox
              title="가치평가 (Valuation)"
              scoreTag={analysis.sections[2].display}
              extraTag={analysis.valuationTag}
              flex={561}
            >
              <ValuationSection
                indicators={analysis.valuationInds}
                radar={analysis.radar}
              />
            </SectionBox>
            <SectionBox title="섹션별 스코어 분포" flex={520}>
              <ScoreDistributionSection
                totalScore={analysis.totalScore}
                sections={analysis.sections}
              />
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

// 시안 card/기업/tooltip variant 본문 (5개)
const TOOLTIP_TEXT: Record<HeroCard["key"], string> = {
  fcf: "영업활동으로 번 돈에서 필수 비용을 제외하고 남은 실제 여유 현금입니다. 배당, 투자, 재무 안정성을 판단할 때 사용합니다.",
  roe: "주주 자본으로 얼마나 효율적으로 이익을 냈는지 보여주는 지표입니다. 높을수록 자본 활용 효율이 좋다고 해석합니다.",
  revenue:
    "전년 대비 매출 증가율입니다. 기업의 외형 성장과 시장 영향력 확대 여부를 확인할 때 사용합니다.",
  gross:
    "매출에서 원가를 제외한 이익 비율입니다. 제품 경쟁력과 생산 효율성을 보여주며 높을수록 본업 수익성이 좋습니다.",
  ev: "기업가치를 영업 현금창출력으로 나눈 지표입니다. 낮을수록 투자금 회수 기간이 짧은 저평가 기업으로 해석합니다.",
};

function HeroCardView({ card }: { card: HeroCard }) {
  return (
    <div style={S.heroCard}>
      <div style={S.heroCardHead}>
        <div
          style={{ ...S.heroCardIcon, background: card.iconBg }}
          aria-hidden
        >
          <Icon
            icon={card.iconName}
            width={16}
            height={16}
            color={card.iconColor}
          />
        </div>
        <span style={S.heroCardLabel}>{card.label}</span>
        <InfoTooltip text={TOOLTIP_TEXT[card.key]} mode="card" size={16} />
      </div>
      <div style={S.heroCardBig}>{card.bigValue}</div>
      <div style={S.heroCardSub}>{card.sub}</div>
    </div>
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

// chip 텍스트 색에 대응하는 연한 배경색
function chipBgFromColor(textColor: string): string {
  if (textColor === "#43bb2e" || textColor === "#60c846") return "#e4ffdf";
  if (textColor === "#c1121f") return "#ffe4e4";
  return "#ececec";
}

// §2-A 현금흐름 & 안정성 — 그래프 + 하단 3행 indicator
function CashflowSection({
  chart,
  indicators,
}: {
  chart: CashflowChartData;
  indicators: CashflowIndicator[];
}) {
  return (
    <div style={CF.wrap}>
      <div style={CF.chartHead}>
        <span style={CF.chartTitle}>
          매출 및 FCF 추이 <span style={CF.chartTitleUnit}>($B)</span>
        </span>
        <div style={CF.legendRow}>
          <span style={CF.legendItem}>
            <span style={{ ...CF.legendDot, background: "#c5d4f8" }} />
            <span style={CF.legendText}>매출 (Revenue)</span>
          </span>
          <span style={CF.legendItem}>
            <span style={{ ...CF.legendDot, background: "#43bb2e" }} />
            <span style={CF.legendText}>FCF</span>
          </span>
        </div>
      </div>
      <GroupedBarChart bars={chart.bars} />
      <div style={CF.indicators}>
        {indicators.map((ind, i) => (
          <Fragment key={ind.letter}>
            {i > 0 && <div style={CF.indicatorDivider} />}
            <div style={CF.indicatorRow}>
              <span style={CF.indicatorLabel}>
                {ind.letter}. {ind.label}
              </span>
              <span style={CF.indicatorValue}>{ind.value}</span>
              <span
                style={{
                  ...CF.indicatorChip,
                  color: ind.deltaColor,
                  background: chipBgFromColor(ind.deltaColor),
                }}
              >
                {ind.delta}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function GroupedBarChart({ bars }: { bars: CashflowChartData["bars"] }) {
  const W = 320;
  const H = 140;
  const padL = 36;
  const padR = 8;
  const padT = 6;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // 모든 값에서 max 산출
  const allValues: number[] = [];
  for (const b of bars) {
    if (b.revenue != null) allValues.push(b.revenue);
    if (b.fcf != null) allValues.push(b.fcf);
  }
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  // Y축 round up: 가장 가까운 40 단위
  const yMax = Math.max(40, Math.ceil(dataMax / 40) * 40);
  const yTicks = [0, yMax / 3, (yMax * 2) / 3, yMax].map((v) => Math.round(v));

  const groupW = innerW / bars.length;
  const barW = Math.max(6, (groupW - 12) / 2);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* Y grid line + tick label (0 제외하고 3개 line) */}
      {yTicks.map((t) => {
        const y = padT + innerH - (t / yMax) * innerH;
        return (
          <g key={t}>
            {t > 0 && (
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="#ececec"
                strokeWidth={1}
              />
            )}
            <text
              x={padL - 6}
              y={y}
              fontSize={9}
              fill="#737474"
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily="var(--font-numeric)"
            >
              ${t}B
            </text>
          </g>
        );
      })}

      {/* Axis lines (ㄴ 모양: 좌측 세로 + 하단 가로) */}
      <line
        x1={padL}
        y1={padT}
        x2={padL}
        y2={padT + innerH}
        stroke="#b8b8b8"
        strokeWidth={1}
      />
      <line
        x1={padL}
        y1={padT + innerH}
        x2={W - padR}
        y2={padT + innerH}
        stroke="#b8b8b8"
        strokeWidth={1}
      />

      {/* Bars */}
      {bars.map((b, i) => {
        const groupX = padL + i * groupW;
        const revH = b.revenue != null ? (b.revenue / yMax) * innerH : 0;
        const fcfH = b.fcf != null ? (b.fcf / yMax) * innerH : 0;
        const revX = groupX + groupW / 2 - barW - 1;
        const fcfX = groupX + groupW / 2 + 1;
        const revY = padT + innerH - revH;
        const fcfY = padT + innerH - fcfH;
        return (
          <g key={i}>
            {b.revenue != null && (
              <rect
                x={revX}
                y={revY}
                width={barW}
                height={revH}
                rx={2}
                fill="#c5d4f8"
              />
            )}
            {b.fcf != null && (
              <rect
                x={fcfX}
                y={fcfY}
                width={barW}
                height={fcfH}
                rx={2}
                fill="#43bb2e"
              />
            )}
            {/* X label */}
            <text
              x={groupX + groupW / 2}
              y={H - 6}
              fontSize={10}
              fill="#737474"
              textAnchor="middle"
              fontFamily="var(--font-numeric)"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// §2-B 수익성 — line chart (Net Margin / ROE) + 하단 2행 indicator
function ProfitabilitySection({
  chart,
  indicators,
}: {
  chart: ProfitabilityChartData;
  indicators: CashflowIndicator[];
}) {
  return (
    <div style={CF.wrap}>
      <div style={CF.chartHead}>
        <span style={CF.chartTitle}>
          Net Margin & ROE 추이 <span style={CF.chartTitleUnit}>(%)</span>
        </span>
        <div style={CF.legendRow}>
          <span style={CF.legendItem}>
            <span style={{ ...CF.legendLine, background: "#5b8bd9" }} />
            <span style={CF.legendText}>Net Margin %</span>
          </span>
          <span style={CF.legendItem}>
            <span style={{ ...CF.legendLine, background: "#e5af43" }} />
            <span style={CF.legendText}>ROE %</span>
          </span>
        </div>
      </div>
      <DualLineChart points={chart.points} />
      <div style={CF.indicators}>
        {indicators.map((ind, i) => (
          <Fragment key={ind.letter}>
            {i > 0 && <div style={CF.indicatorDivider} />}
            <div style={CF.indicatorRow}>
              <span style={CF.indicatorLabel}>
                {ind.letter}. {ind.label}
              </span>
              <span style={CF.indicatorValue}>{ind.value}</span>
              <span
                style={{
                  ...CF.indicatorChip,
                  color: ind.deltaColor,
                  background: chipBgFromColor(ind.deltaColor),
                }}
              >
                {ind.delta}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DualLineChart({ points }: { points: ProfitabilityChartData["points"] }) {
  const W = 320;
  const H = 160;
  const padL = 36;
  const padR = 8;
  const padT = 6;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // 0 ~ 데이터 max round-up to nearest 20, min 100
  const allValues: number[] = [];
  for (const p of points) {
    if (p.netMargin != null) allValues.push(p.netMargin);
    if (p.roe != null) allValues.push(p.roe);
  }
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  const yMax = Math.max(100, Math.ceil(dataMax / 20) * 20);
  const yTicks = [0, yMax * 0.2, yMax * 0.4, yMax * 0.6, yMax * 0.8, yMax].map((v) =>
    Math.round(v),
  );

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - (v / yMax) * innerH;

  const buildPath = (key: "netMargin" | "roe"): string => {
    const segs: string[] = [];
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) return;
      segs.push(`${segs.length === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`);
    });
    return segs.join(" ");
  };

  const lineColors = { netMargin: "#5b8bd9", roe: "#e5af43" };

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* Y grid line + tick label */}
      {yTicks.map((t) => {
        const y = padT + innerH - (t / yMax) * innerH;
        return (
          <g key={t}>
            {t > 0 && (
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="#ececec"
                strokeWidth={1}
              />
            )}
            <text
              x={padL - 6}
              y={y}
              fontSize={9}
              fill="#737474"
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily="var(--font-numeric)"
            >
              {t}%
            </text>
          </g>
        );
      })}

      {/* Axis ㄴ */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      <line
        x1={padL}
        y1={padT + innerH}
        x2={W - padR}
        y2={padT + innerH}
        stroke="#b8b8b8"
        strokeWidth={1}
      />

      {/* Lines */}
      {(["netMargin", "roe"] as const).map((key) => {
        const d = buildPath(key);
        if (!d) return null;
        return (
          <path
            key={key}
            d={d}
            stroke={lineColors[key]}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}

      {/* Dots */}
      {points.map((p, i) =>
        (["netMargin", "roe"] as const).map((key) => {
          const v = p[key];
          if (v == null) return null;
          return (
            <circle
              key={`${i}-${key}`}
              cx={xOf(i)}
              cy={yOf(v)}
              r={3}
              fill={lineColors[key]}
            />
          );
        }),
      )}

      {/* X label */}
      {points.map((p, i) => (
        <text
          key={`xlab-${i}`}
          x={xOf(i)}
          y={H - 6}
          fontSize={10}
          fill="#737474"
          textAnchor="middle"
          fontFamily="var(--font-numeric)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// §2-C 성장성 — single-series bar chart (Revenue Growth YoY, %) + 하단 2행 indicator
function GrowthSection({
  chart,
  indicators,
}: {
  chart: GrowthChartData;
  indicators: CashflowIndicator[];
}) {
  return (
    <div style={CF.wrap}>
      <div style={CF.chartHead}>
        <span style={CF.chartTitle}>
          성장성 지표 <span style={CF.chartTitleUnit}>(%)</span>
        </span>
      </div>
      <GrowthBarChart bars={chart.bars} />
      <div style={CF.indicators}>
        {indicators.map((ind, i) => (
          <Fragment key={ind.label}>
            {i > 0 && <div style={CF.indicatorDivider} />}
            <div style={CF.indicatorRow}>
              <span style={CF.indicatorLabel}>{ind.label}</span>
              <span style={CF.indicatorValue}>{ind.value}</span>
              <span
                style={{
                  ...CF.indicatorChip,
                  color: ind.deltaColor,
                  background: chipBgFromColor(ind.deltaColor),
                }}
              >
                {ind.delta}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function GrowthBarChart({ bars }: { bars: GrowthChartData["bars"] }) {
  const W = 320;
  const H = 160;
  const padL = 40;
  const padR = 8;
  const padT = 6;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = bars.map((b) => b.revenue).filter((v): v is number => v != null);
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  const dataMin = values.length > 0 ? Math.min(...values) : 0;
  // Round Y range to nearest 20
  const yMax = Math.max(20, Math.ceil(dataMax / 20) * 20);
  const yMin = Math.min(0, Math.floor(dataMin / 20) * 20);
  const yRange = yMax - yMin || 1;

  // tick 4개 (yMin / 0 / yMax/2 / yMax 등 균일)
  const tickStep = yRange / 3;
  const yTicks = [yMin, yMin + tickStep, yMin + 2 * tickStep, yMax].map((v) =>
    Math.round(v),
  );

  const yOf = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;
  const yZero = yOf(0);

  const groupW = innerW / bars.length;
  const barW = Math.max(10, groupW * 0.45);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* Y grid line */}
      {yTicks.map((t) => {
        const y = yOf(t);
        // 0 위치는 더 진한 stroke (baseline 강조)
        const isZero = t === 0;
        return (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke={isZero ? "#b8b8b8" : "#ececec"}
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y}
              fontSize={9}
              fill="#737474"
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily="var(--font-numeric)"
            >
              {t}%
            </text>
          </g>
        );
      })}

      {/* Y axis 좌측 라인 */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />

      {/* Bars (0 baseline 기준 위/아래) */}
      {bars.map((b, i) => {
        if (b.revenue == null) return null;
        const groupCenter = padL + (i + 0.5) * groupW;
        const barX = groupCenter - barW / 2;
        const valueY = yOf(b.revenue);
        const top = b.revenue >= 0 ? valueY : yZero;
        const height = Math.max(1, Math.abs(valueY - yZero));
        return (
          <rect
            key={i}
            x={barX}
            y={top}
            width={barW}
            height={height}
            rx={2}
            fill="#c5d4f8"
          />
        );
      })}

      {/* X label */}
      {bars.map((b, i) => (
        <text
          key={`xlab-${i}`}
          x={padL + (i + 0.5) * groupW}
          y={H - 6}
          fontSize={10}
          fill="#737474"
          textAnchor="middle"
          fontFamily="var(--font-numeric)"
        >
          {b.label}
        </text>
      ))}
    </svg>
  );
}

// §3-A 가치평가 — 좌 3행 indicator + 우 7축 레이더 차트
function ValuationSection({
  indicators,
  radar,
}: {
  indicators: ValuationIndicator[];
  radar: RadarData;
}) {
  return (
    <div style={VAL.wrap}>
      <div style={VAL.indicatorsCol}>
        {indicators.map((ind, i) => (
          <Fragment key={ind.letter}>
            {i > 0 && <div style={CF.indicatorDivider} />}
            <ValuationRow ind={ind} />
          </Fragment>
        ))}
      </div>
      <div style={VAL.radarCol}>
        <RadarChart data={radar} />
        <div style={VAL.radarLegend}>
          <span style={VAL.radarLegendItem}>
            <span style={{ ...VAL.radarLegendLine, background: "#43bb2e" }} />
            <span style={VAL.radarLegendText}>NVIDIA</span>
          </span>
          <span style={VAL.radarLegendItem}>
            <svg width="16" height="4" style={{ display: "block" }}>
              <line
                x1="0"
                y1="2"
                x2="16"
                y2="2"
                stroke="#9a9a9a"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            </svg>
            <span style={VAL.radarLegendText}>섹터 평균</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ValuationRow({ ind }: { ind: ValuationIndicator }) {
  return (
    <div style={VAL.row}>
      <div style={VAL.rowHead}>
        <span style={VAL.rowLabel}>
          {ind.letter}. {ind.label}
        </span>
        <span style={{ ...VAL.rowValue, color: ind.barColor }}>{ind.value}</span>
        <span
          style={{
            ...CF.indicatorChip,
            color: ind.deltaColor,
            background: chipBgFromColor(ind.deltaColor),
          }}
        >
          {ind.delta}
        </span>
      </div>
      <div style={VAL.rowBar}>
        <div style={VAL.rowBarBase} />
        <div
          style={{
            ...VAL.rowBarFill,
            width: `${ind.fillRatio * 100}%`,
            background: ind.barColor,
          }}
        />
      </div>
      <div style={VAL.rowNote}>{ind.note}</div>
    </div>
  );
}

function RadarChart({ data }: { data: RadarData }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 75;
  const n = data.axes.length;
  const angleOf = (i: number) => -Math.PI / 2 + (i / n) * 2 * Math.PI;
  const pointAt = (i: number, r: number) => ({
    x: cx + Math.cos(angleOf(i)) * r,
    y: cy + Math.sin(angleOf(i)) * r,
  });

  // 4 levels grid (25/50/75/100)
  const levels = [0.25, 0.5, 0.75, 1];

  // NVDA values polygon
  const polyPoints = data.values
    .map((v, i) => {
      const p = pointAt(i, (v / 100) * radius);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  // 섹터 평균 (peers 기반, 일부 axis 는 null → 0 처리)
  const sectorPoints = data.sectorAvg
    .map((v, i) => {
      const p = pointAt(i, (v / 100) * radius);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width="100%"
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {/* Grid polygons */}
      {levels.map((lv) => (
        <polygon
          key={lv}
          points={data.values
            .map((_, i) => {
              const p = pointAt(i, lv * radius);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ")}
          fill="none"
          stroke="#ececec"
          strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {data.axes.map((_, i) => {
        const p = pointAt(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#ececec"
            strokeWidth={1}
          />
        );
      })}
      {/* 섹터 평균 (dashed) */}
      <polygon
        points={sectorPoints}
        fill="none"
        stroke="#9a9a9a"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {/* NVDA value polygon */}
      <polygon
        points={polyPoints}
        fill="#43bb2e22"
        stroke="#43bb2e"
        strokeWidth={1.8}
      />
      {/* Vertex dots */}
      {data.values.map((v, i) => {
        const p = pointAt(i, (v / 100) * radius);
        return <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#43bb2e" />;
      })}
      {/* Axis labels */}
      {data.axes.map((label, i) => {
        const p = pointAt(i, radius + 12);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            fontSize={9}
            fill="#003049"
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight={600}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// §3-B 섹션별 스코어 — 4 색상 통일 dict (도넛 segment, 아이콘, bar 모두 동일)
const SD_COLOR: Record<string, string> = {
  cashflow: "#43bb2e",       // green
  profitability: "#5b8bd9",  // blue
  valuation: "#e5af43",      // yellow/orange
  growth: "#c1121f",         // red
};

// §3-B 섹션별 스코어 분포 — 좌 도넛 + 우 4행 progress bar
function ScoreDistributionSection({
  totalScore,
  sections,
}: {
  totalScore: number | null;
  sections: SectionScore[];
}) {
  return (
    <div style={SD.wrap}>
      <ScoreDonut value={totalScore} sections={sections} />
      <div style={SD.colDivider} />
      <div style={SD.rows}>
        {sections.map((s, i) => {
          const color = SD_COLOR[s.key] ?? "#737474";
          const ratio = s.score != null ? s.score / s.max : 0;
          return (
            <Fragment key={s.key}>
              {i > 0 && <div style={SD.rowDivider} />}
              <div style={SD.row}>
                <span
                  style={{
                    ...SD.rowIconBg,
                    background: `${color}22`,
                  }}
                >
                  <ValuationCategoryIcon kind={s.key} color={color} />
                </span>
                <span style={SD.rowLabel}>{s.label}</span>
                <div style={SD.rowBar}>
                  <div style={SD.rowBarBase} />
                  <div
                    style={{
                      ...SD.rowBarFill,
                      width: `${ratio * 100}%`,
                      background: color,
                    }}
                  />
                </div>
                <span style={SD.rowScore}>
                  {s.score != null ? `${s.score} / ${s.max}` : `— / ${s.max}`}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ScoreDonut({
  value,
  sections,
}: {
  value: number | null;
  sections: SectionScore[];
}) {
  const size = 150;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const thickness = 18;
  const circ = 2 * Math.PI * r;
  // 각 섹션 비율로 도넛 채우기 (segment) — 색상은 SD_COLOR 와 동일
  const totalMax = sections.reduce((a, b) => a + b.max, 0);
  let cum = 0;
  return (
    <div style={SD.donutWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} stroke="#ececec" strokeWidth={thickness} fill="none" />
        {sections.map((s) => {
          const ratio = (s.score ?? 0) / totalMax;
          const dashArr = `${ratio * circ} ${circ}`;
          const dashOff = -cum * circ;
          cum += ratio;
          return (
            <circle
              key={s.key}
              cx={cx}
              cy={cy}
              r={r}
              stroke={SD_COLOR[s.key] ?? "#737474"}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={dashArr}
              strokeDashoffset={dashOff}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div style={SD.donutCenter}>
        <span style={SD.donutValue}>{value != null ? value : "—"}</span>
        <span style={SD.donutLabel}>총점</span>
      </div>
    </div>
  );
}

function ValuationCategoryIcon({ kind, color }: { kind: string; color: string }) {
  if (kind === "cashflow") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" />
        <text x="12" y="16" fontSize="11" fontWeight="700" fill={color} textAnchor="middle">$</text>
      </svg>
    );
  }
  if (kind === "profitability") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M3 17 L9 11 L13 14 L21 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 6 L21 6 L21 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "valuation") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill={color}>
        <path d="M1.5 1.5 V13.5 H14.5 V14.5 H0.5 V1.5 Z" />
        <rect x="3" y="9.5" width="2" height="3" rx="0.4" />
        <rect x="6.5" y="6.5" width="2" height="6" rx="0.4" />
        <rect x="10" y="3.5" width="2" height="9" rx="0.4" />
      </svg>
    );
  }
  // growth (rocket)
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 L16 7 L16 15 L8 15 L8 7 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 15 L9 19 M15 15 L15 19" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="9" r="1.5" fill={color} />
    </svg>
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
  tooltipToggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#f8faff",
    border: "1px solid #d9e3f3",
    borderRadius: 6,
    fontSize: 12,
  },
  tooltipToggleLabel: {
    fontWeight: 600,
    color: "#003049",
  },
  tooltipToggleBtn: {
    border: "1px solid #c4c4c4",
    background: "#ffffff",
    color: "#737171",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
  },
  tooltipToggleBtnActive: {
    background: "#003049",
    color: "#ffffff",
    borderColor: "#003049",
  },
  tooltipToggleHint: {
    marginLeft: "auto",
    color: "#747474",
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

const CF: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
  },
  chartHead: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: NAVY,
  },
  chartTitleUnit: {
    fontWeight: 500,
    color: NAVY,
  },
  legendRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
  },
  legendLine: {
    width: 14,
    height: 3,
    borderRadius: 2,
    flexShrink: 0,
  },
  legendText: {
    fontSize: 11,
    fontWeight: 600,
    color: NAVY,
  },
  indicators: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    justifyContent: "space-around",
    marginTop: 4,
  },
  indicatorRow: {
    display: "grid",
    gridTemplateColumns: "1fr 60px 48px",
    alignItems: "baseline",
    gap: 8,
    paddingTop: 6,
    paddingBottom: 6,
  },
  indicatorLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: NAVY,
  },
  indicatorValue: {
    fontSize: 13,
    fontWeight: 700,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    textAlign: "right",
  },
  indicatorChip: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    padding: "2px 0",
    borderRadius: 4,
    width: 48,
    textAlign: "center",
    boxSizing: "border-box",
  },
  indicatorDivider: {
    height: 1,
    background: "#ececec",
  },
};

// §3-A 가치평가 스타일
const VAL: Record<string, CSSProperties> = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    flex: 1,
  },
  indicatorsCol: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    justifyContent: "space-around",
  },
  radarCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  rowHead: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "baseline",
    gap: 8,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: NAVY,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    color: NAVY,
  },
  rowBar: {
    position: "relative",
    height: 4,
    borderRadius: 2,
  },
  rowBarBase: {
    position: "absolute",
    inset: 0,
    background: "#ececec",
    borderRadius: 2,
  },
  rowBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 2,
  },
  rowNote: {
    fontSize: 10,
    fontWeight: 500,
    color: MUTED,
    lineHeight: 1.4,
  },
  radarLegend: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  radarLegendItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  radarLegendLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  radarLegendText: {
    fontSize: 10,
    fontWeight: 600,
    color: NAVY,
  },
};

// §3-B 섹션별 스코어 분포 스타일
const SD: Record<string, CSSProperties> = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "150px 1px 1fr",
    columnGap: 20,
    alignItems: "center",
    flex: 1,
    paddingBottom: 8,
  },
  donutWrap: {
    position: "relative",
    width: 150,
    height: 150,
    flexShrink: 0,
  },
  colDivider: {
    width: 1,
    height: "80%",
    background: "#ececec",
    alignSelf: "center",
  },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 150,
    height: 150,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  donutValue: {
    fontSize: 36,
    fontWeight: 700,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  donutLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: MUTED,
    marginTop: 2,
  },
  rows: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "22px 1fr 90px auto",
    alignItems: "center",
    gap: 10,
    paddingTop: 6,
    paddingBottom: 6,
  },
  rowDivider: {
    height: 1,
    background: "#ececec",
  },
  rowIconBg: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#ececec",
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
  },
  rowBar: {
    position: "relative",
    height: 5,
    borderRadius: 3,
  },
  rowBarBase: {
    position: "absolute",
    inset: 0,
    background: "#ececec",
    borderRadius: 3,
  },
  rowBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 3,
  },
  rowScore: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    color: NAVY,
    minWidth: 50,
    textAlign: "right",
  },
};
