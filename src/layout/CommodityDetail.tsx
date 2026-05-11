// CommodityDetail — 원자재 영향 분석 detail 화면.
// spec: docs/figma/screens/main-commodity.json (Figma node 271:561, 1440×2190)
//
// 시안 구조 (y기준, 콘텐츠 영역 x=237~1338, w=1101):
//   §1 (231-435, h=204) — 2-col:
//        핵심 요약(640w): title + 본문 + bottom row (비용 영향 / 공급 안정성 / 향후 전망 3 stat with vertical dividers)
//        원자재가 종합 영향 점수(451w): title + 큰 점수 도넛(145×145, "23" 45pt) + "NEGATIVE" 35pt + "전날 대비 -2 (하락)"
//   §2 (447-553, h=106) — main-four: 4 INSTANCE Card/원자재/main-four (각 ~267w)
//   §3 (565-826, h=261) — 2-col:
//        주요 원자재 가격 현황(571w): 2x4 카드 grid (8 원자재) with vertical/horizontal separators
//        원자재별 원간 가격 변동률 비교(518w): graph placeholder
//   §4 (838-1181, h=343) — 2-col: 시장 지표 요약(683w) + 변동성-수익률 매트릭스(404w) — graph placeholder
//   §5 (1193-1526, h=333) — 카테고리별 가격 추이: 3 차트 (에너지/산업금속/귀금속) graph placeholder
//   §6 (1538-1734, h=196) — 주요 섹터별 시장 이슈 분석: 3 INSTANCE Card/원자재/주요 이슈 (각 345w)
//   §7 (1746-2096, h=350) — 2-col: 자산군 정규화 사이클(494w) + 에너지 괴리율(597w) + 우측 사이드 지표

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import {
  categoryStanceLabel,
  commodityImpactScore,
  costImpactLabel,
  maxDate,
  outlookLabel,
  scoreDayDelta,
  supplyStabilityLabel,
  symbolStat,
  verdictFromImpactScore,
} from "../analysis/commodityNarrative";
import {
  loadCommodities,
  loadCompanySnapshot,
} from "../data-loader/investmentData";
import type { CommoditiesResponse, CompanySnapshot } from "../types/investment";
import { DetailShell, type DetailSection } from "./DetailShell";
import { EmptyState } from "./detail";

export interface CommodityDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

// ── 정적 메타 ─────────────────────────────────────────────────

interface StatSpec {
  label: string;
  value: string;
  color: string;
}

interface MainFourSpec {
  key: string;
  label: string;
  value: string;
  color: string;
  iconName: string;
  iconBg: string;
}

interface PriceCardSpec {
  key: string;
  label: string;
  price: string;
  unit: string;
  change: string;
  changeColor: string;
}

interface IssueCardSpec {
  key: string;
  iconBg: string;
  iconName: string;
  title: string;
  tagLabel: string;
  tagColor: string;
  tagBg: string;
  body: string;
}

// §2 main-four 정적 메타 (라벨/아이콘/배경색) — 값/색만 실데이터로 동적
const MAIN_FOUR_META: Array<
  Omit<MainFourSpec, "value" | "color"> & { symbol: string; kind: "yoy" | "price" }
> = [
  { key: "lithium", symbol: "LIT", kind: "yoy", label: "리튬 연간 변동률", iconName: "octicon:graph-16", iconBg: "#ececec" },
  { key: "gold-price", symbol: "GC=F", kind: "price", label: "금 시세 ($/oz)", iconName: "streamline:gold-remix", iconBg: "#fdf9d4" },
  { key: "wti", symbol: "CL=F", kind: "price", label: "WTI 원유($/bbl)", iconName: "game-icons:oil-rig", iconBg: "#fde5e4" },
  { key: "gold-yoy", symbol: "GC=F", kind: "yoy", label: "금 연간 상승률", iconName: "hugeicons:chart-increase", iconBg: "#e8f8e1" },
];

// §3-A 8 가격 카드 정적 메타
const PRICE_CARD_META: Array<{ key: string; symbol: string; label: string; unitOverride?: string }> = [
  { key: "wti", symbol: "CL=F", label: "WTI 원유" },
  { key: "ng", symbol: "NG=F", label: "천연가스" },
  { key: "cu", symbol: "HG=F", label: "구리 (LME)" },
  { key: "li", symbol: "LIT", label: "리튬 ETF (LIT)" },
  { key: "au", symbol: "GC=F", label: "금 (Gold)" },
  { key: "ag", symbol: "SI=F", label: "은 (Silver)" },
  { key: "wheat", symbol: "ZW=F", label: "소맥 (Wheat)" },
  { key: "soy", symbol: "ZS=F", label: "대두 (Soybean)" },
];

// §6 issue 3 카드 정적 메타 (tag/body 는 동적)
const ISSUE_META: Array<{
  key: string;
  iconBg: string;
  iconName: string;
  title: string;
  symbols: string[];
}> = [
  {
    key: "metal",
    iconBg: "#fafadf",
    iconName: "streamline:gold-remix",
    title: "귀금속 (금·은)",
    symbols: ["GC=F", "SI=F"],
  },
  {
    key: "cu",
    iconBg: "#fdf0d5",
    iconName: "iconoir:spiral",
    title: "산업금속 & 에너지",
    symbols: ["HG=F", "LIT", "CL=F", "NG=F"],
  },
  {
    key: "agri",
    iconBg: "#f5e8ff",
    iconName: "carbon:crop-growth",
    title: "농산물 (곡물)",
    symbols: ["ZW=F", "ZS=F", "ZC=F"],
  },
];

// 포맷 유틸
function fmtPctSigned(v: number | null, digits = 1): string {
  if (v == null) return "—";
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

// symbol 별 표시 단위 + 값 변환 multiplier (생략 시 1). DB unit 컬럼 길이가 긴 케이스 단축.
const DISPLAY_UNIT: Record<string, { unit: string; multiplier?: number }> = {
  "CL=F": { unit: "bbl" }, // barrel
  "NG=F": { unit: "MMBtu" }, // 유지
  "HG=F": { unit: "T", multiplier: 2204.62 }, // lb → metric ton
  LIT: { unit: "주" }, // ETF share
  "GC=F": { unit: "oz" },
  "SI=F": { unit: "oz" },
  "ZW=F": { unit: "bu" }, // bushel
  "ZS=F": { unit: "bu" },
  "ZC=F": { unit: "bu" },
};

function priceParts(
  symbol: string,
  value: number | null,
): { value: string; unit: string } {
  if (value == null) return { value: "—", unit: "" };
  const disp = DISPLAY_UNIT[symbol];
  const converted = disp?.multiplier ? value * disp.multiplier : value;
  const formatted =
    converted >= 1000
      ? converted.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : converted.toFixed(2);
  const unit = disp?.unit ? `/${disp.unit}` : "";
  return { value: `$${formatted}`, unit };
}
function priceCardChangeColor(yoy: number | null): string {
  if (yoy == null) return "#767676";
  if (yoy > 0) return "#60c846";
  if (yoy < 0) return "#c1121f";
  return "#767676";
}
function valueColorByKind(value: number | null, kind: "yoy" | "price"): string {
  if (value == null) return "#737474";
  if (kind === "yoy") {
    if (value > 0.3) return "#60c846";
    if (value > 0) return "#f8eb37";
    return "#c1121f";
  }
  return "#003049";
}

// ──────────────────────────────────────────────────────────────

export function CommodityDetail({
  ticker,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
}: CommodityDetailProps) {
  const [data, setData] = useState<CompanySnapshot | null>(null);
  const [commodities, setCommodities] = useState<CommoditiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    Promise.all([
      loadCompanySnapshot(ticker, 24),
      loadCommodities(undefined, 300),
    ])
      .then(([s, c]) => {
        if (alive) {
          setData(s);
          setCommodities(c);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const analysis = useMemo(() => {
    if (!commodities) return null;
    const rows = commodities.history;
    const impact = commodityImpactScore(rows);
    const verdict = verdictFromImpactScore(impact.score);
    const delta = scoreDayDelta(rows);
    const cost = costImpactLabel(impact.energyYoy);
    const supply = supplyStabilityLabel(rows);
    const outlook = outlookLabel(rows);
    const stats: StatSpec[] = [
      { label: "비용 영향", value: cost.label, color: cost.color },
      { label: "공급 안정성", value: supply.label, color: supply.color },
      { label: "향후 전망", value: outlook.label, color: outlook.color },
    ];

    const mainFour: MainFourSpec[] = MAIN_FOUR_META.map((meta) => {
      const stat = symbolStat(rows, meta.symbol);
      let value = "—";
      let color = "#737474";
      if (meta.kind === "yoy") {
        value = fmtPctSigned(stat.yoy, 0);
        color = valueColorByKind(stat.yoy, "yoy");
      } else {
        value = stat.latest != null
          ? `$${stat.latest.toLocaleString(undefined, { maximumFractionDigits: stat.latest >= 100 ? 1 : 2 })}`
          : "—";
        color = valueColorByKind(stat.latest, "price");
      }
      return {
        key: meta.key,
        label: meta.label,
        value,
        color,
        iconName: meta.iconName,
        iconBg: meta.iconBg,
      };
    });

    const priceCards: PriceCardSpec[] = PRICE_CARD_META.map((meta) => {
      const stat = symbolStat(rows, meta.symbol);
      const parts = priceParts(meta.symbol, stat.latest);
      return {
        key: meta.key,
        label: meta.label,
        price: parts.value,
        unit: parts.unit,
        change: stat.yoy != null ? `${fmtPctSigned(stat.yoy, 1)} (1년)` : "—",
        changeColor: priceCardChangeColor(stat.yoy),
      };
    });

    const issueCards: IssueCardSpec[] = ISSUE_META.map((meta) => {
      // 카테고리 평균 YoY
      const ys: number[] = [];
      for (const s of meta.symbols) {
        const stat = symbolStat(rows, s);
        if (stat.yoy != null) ys.push(stat.yoy);
      }
      const avgYoy = ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
      const stance = categoryStanceLabel(avgYoy);
      return {
        key: meta.key,
        iconBg: meta.iconBg,
        iconName: meta.iconName,
        title: meta.title,
        tagLabel: stance.label,
        tagColor: stance.color,
        tagBg: stance.bg,
        body: "", // MOCK — 비움
      };
    });

    const wti = symbolStat(rows, "CL=F");
    const ng = symbolStat(rows, "NG=F");
    const sideIndicators = [
      { label: "WTI 원유", value: wti.latest != null ? `$${wti.latest.toFixed(2)}/bbl` : "—" },
      { label: "천연가스", value: ng.latest != null ? `$${ng.latest.toFixed(2)}/MMBtu` : "—" },
    ];

    const date = maxDate(rows);

    return { impact, verdict, delta, stats, mainFour, priceCards, issueCards, sideIndicators, date };
  }, [commodities]);

  const updatedAt = useMemo(
    () => data?.latestFundamentals?.date ?? undefined,
    [data],
  );

  return (
    <DetailShell
      ticker={ticker}
      active="commodity"
      pageTitle="원자재 영향 분석"
      pageSubtitle="Google의 주요 원자재 관련 비용 및 매출 영향과 시장 동향을 분석합니다."
      updatedAt={updatedAt}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <EmptyState variant="error" message={`로드 실패: ${error}`} />}
      {!error && (!data || !analysis) && <EmptyState variant="loading" />}
      {data && analysis && (
        <>
          {/* §1 — 2-col */}
          <div style={S.row1}>
            <section style={S.summaryBox}>
              <div style={S.boxHeader}>핵심 요약</div>
              <div style={S.summaryBody}>
                <span style={{ color: "#9a9a9a", fontStyle: "italic", fontWeight: 500 }}>—</span>
              </div>
              <div style={S.statRow}>
                {analysis.stats.map((s, i) => (
                  <Frag key={s.label}>
                    {i > 0 && <div style={S.statDivider} />}
                    <StatItem stat={s} />
                  </Frag>
                ))}
              </div>
            </section>

            <section style={S.scoreBox}>
              <div style={S.boxHeader}>원자재가 종합 영향 점수</div>
              <div style={S.scoreBody}>
                <div style={S.scoreText}>
                  <div style={{ ...S.scoreVerdict, color: analysis.verdict.color }}>
                    {analysis.verdict.label}
                  </div>
                  <div style={S.scoreDelta}>{analysis.delta.display}</div>
                </div>
                <ScoreCircle value={analysis.impact.score} color={analysis.verdict.color} />
              </div>
            </section>
          </div>

          {/* §2 main-four */}
          <div style={S.mainFourRow}>
            {analysis.mainFour.map((m) => (
              <MainFourCard key={m.key} card={m} />
            ))}
          </div>

          {/* §3 — 2-col */}
          <div style={S.row3}>
            <section style={S.row3Left}>
              <div style={S.boxHeader}>
                주요 원자재 가격 현황{analysis.date ? ` (${analysis.date} 기준)` : ""}
              </div>
              <div style={S.priceGrid}>
                {analysis.priceCards.map((c, i) => (
                  <PriceCard key={c.key} card={c} idx={i} />
                ))}
              </div>
            </section>

            <section style={S.row3Right}>
              <div style={S.boxHeader}>원자재별 연간 가격 변동률 비교</div>
              <div style={S.subHeader}>1년 전 대비 현재 가격 변동폭 (%)</div>
              <GraphPlaceholder hint="원자재별 변동률 가로 막대 차트" minHeight={170} />
            </section>
          </div>

          {/* §4 — 2-col */}
          <div style={S.row4}>
            <SectionBoxFull
              title="원자재 시장 지표 요약"
              flex={683}
              height={260}
            >
              <GraphPlaceholder hint="원자재 지표 표 / 차트" />
            </SectionBoxFull>
            <SectionBoxFull
              title="변동성-수익률 매트릭스"
              sub="시장 변동성 대비 가격 상승 모멘텀 포지셔닝"
              flex={404}
              height={260}
            >
              <GraphPlaceholder hint="scatter plot (volatility × return)" />
            </SectionBoxFull>
          </div>

          {/* §5 카테고리별 가격 추이 */}
          <section style={S.row5}>
            <div style={S.row5Header}>
              <span style={S.boxHeader}>카테고리별 가격 추이</span>
              <span style={S.boxHeaderSuffix}>(2025.04→2026.04)</span>
            </div>
            <div style={S.subHeader}>12개월간 월별 시세 흐름 추적</div>
            <div style={S.row5Grid}>
              <SectorChart
                title="에너지 섹터 흐름"
                sub="WTI 원유 및 천연가스 가격 월별 변등 추이"
              />
              <SectorChart
                title="산업금속 섹터 흐름"
                sub="구리 및 리튬 가격 월별 변동 추이"
              />
              <SectorChart
                title="귀금속 섹터 흐름 (금 & 은)"
                sub="금과 은의 원별 시세 변동 추이"
              />
            </div>
          </section>

          {/* §6 주요 섹터별 시장 이슈 분석 */}
          <section style={S.row6}>
            <div style={S.boxHeader}>주요 섹터별 시장 이슈 분석</div>
            <div style={S.subHeader}>현재 원자재 시장의 흐름을 핵심 이슈 및 전망</div>
            <div style={S.row6Grid}>
              {analysis.issueCards.map((c) => (
                <IssueCard key={c.key} card={c} />
              ))}
            </div>
          </section>

          {/* §7 — 2-col */}
          <div style={S.row7}>
            <SectionBoxFull
              title="자산군 정규화 사이클 (Base=100, 2021 Q2)"
              flex={494}
              height={270}
            >
              <GraphPlaceholder hint="자산군 정규화 line chart" />
            </SectionBoxFull>
            <SectionBoxFull
              title="에너지 · WTI vs 천연가스 괴리율"
              flex={597}
              height={270}
              rightSide={<SideIndicators items={analysis.sideIndicators} />}
            >
              <GraphPlaceholder hint="WTI vs 천연가스 괴리율 line" />
            </SectionBoxFull>
          </div>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function Frag({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function StatItem({ stat }: { stat: StatSpec }) {
  return (
    <div style={S.statItem}>
      <div style={S.statIcon} aria-hidden>
        <StatIcon />
      </div>
      <div style={S.statText}>
        <span style={S.statLabel}>{stat.label}</span>
        <span style={{ ...S.statValue, color: stat.color }}>{stat.value}</span>
      </div>
    </div>
  );
}

function StatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="13" width="4" height="8" stroke="#003049" strokeWidth="1.6" fill="none" />
      <rect x="10" y="8" width="4" height="13" stroke="#003049" strokeWidth="1.6" fill="none" />
      <rect x="17" y="3" width="4" height="18" stroke="#003049" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function ScoreCircle({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 62;
  const cx = 72.5;
  const cy = 72.5;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;
  return (
    <div style={S.scoreCircleWrap}>
      <svg width={145} height={145} viewBox="0 0 145 145">
        <circle cx={cx} cy={cy} r={r} stroke="#d9d9d9" strokeWidth={14} fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={14}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div style={{ ...S.scoreCircleText, color }}>{value}</div>
    </div>
  );
}

function MainFourCard({ card }: { card: MainFourSpec }) {
  return (
    <div style={S.mainFourCard}>
      <div style={{ ...S.mainFourIconWrap, background: card.iconBg }} aria-hidden>
        <Icon icon={card.iconName} width={28} height={28} color={card.color} />
      </div>
      <div style={S.mainFourText}>
        <span style={S.mainFourLabel} title={card.label}>
          {card.label}
        </span>
        <span style={{ ...S.mainFourValue, color: card.color }}>{card.value}</span>
      </div>
    </div>
  );
}

function PriceCard({ card, idx }: { card: PriceCardSpec; idx: number }) {
  // 4×2 격자: 내부 선만 (마지막 열 우측 X, 마지막 행 하단 X)
  const isLastCol = idx % 4 === 3;
  const isLastRow = idx >= 4;
  const border = "1px solid var(--color-border)";
  return (
    <div
      style={{
        ...S.priceCard,
        borderRight: isLastCol ? "none" : border,
        borderBottom: isLastRow ? "none" : border,
      }}
    >
      <div style={S.priceCardHead}>
        <span style={S.priceCardLabel} title={card.label}>
          {card.label}
        </span>
        <span style={S.priceCardTooltip}>i</span>
      </div>
      <div style={S.priceCardValue}>
        <span>{card.price}</span>
        {card.unit && <span style={S.priceCardUnit}>{card.unit}</span>}
      </div>
      <div style={{ ...S.priceCardChange, color: card.changeColor }}>
        {card.change}
      </div>
    </div>
  );
}

function SectorChart({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={S.sectorChart}>
      <div style={S.sectorChartTitle}>{title}</div>
      <div style={S.sectorChartSub}>{sub}</div>
      <GraphPlaceholder hint="line chart" minHeight={150} />
    </div>
  );
}

function IssueCard({ card }: { card: IssueCardSpec }) {
  return (
    <div style={S.issueCard}>
      <div style={{ ...S.issueIcon, background: card.iconBg }} aria-hidden>
        <Icon icon={card.iconName} width={24} height={24} color={card.tagColor} />
      </div>
      <div style={S.issueText}>
        <div style={S.issueHead}>
          <span style={S.issueTitle} title={card.title}>
            {card.title}
          </span>
          <span
            style={{
              ...S.issueTag,
              color: card.tagColor,
              borderColor: card.tagColor,
              background: card.tagBg,
            }}
          >
            {card.tagLabel}
          </span>
        </div>
        <div style={S.issueBody}>
          {card.body || <span style={{ color: "#9a9a9a", fontStyle: "italic", fontWeight: 500 }}>—</span>}
        </div>
      </div>
    </div>
  );
}

function SideIndicators({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div style={S.sideIndicators}>
      {items.map((s, i) => (
        <Frag key={s.label}>
          {i > 0 && <div style={S.sideIndicatorDivider} />}
          <div style={S.sideIndicatorRow}>
            <span style={S.sideIndicatorLabel}>{s.label}</span>
            <span style={S.sideIndicatorValue}>{s.value}</span>
          </div>
        </Frag>
      ))}
    </div>
  );
}

function SectionBoxFull({
  title,
  sub,
  flex,
  height,
  rightSide,
  children,
}: {
  title: string;
  sub?: string;
  flex: number;
  height: number;
  rightSide?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={{ ...S.sectionBoxFull, flexGrow: flex }}>
      <div style={S.sectionBoxFullHead}>
        <div style={{ flex: 1 }}>
          <div style={S.boxHeader}>{title}</div>
          {sub && <div style={S.subHeader}>{sub}</div>}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, gap: 12, minHeight: height }}>
        <div style={{ flex: 1, display: "flex" }}>{children}</div>
        {rightSide}
      </div>
    </section>
  );
}

function GraphPlaceholder({ hint, minHeight = 200 }: { hint: string; minHeight?: number }) {
  return (
    <div style={{ ...S.graphPlaceholder, minHeight }}>
      <span style={S.graphPlaceholderHint}>그래프 자리 — {hint}</span>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────

const NAVY = "#003049";
const MUTED = "#747474";
const FAINT = "#737171";

const S: Record<string, CSSProperties> = {
  row1: {
    display: "grid",
    gridTemplateColumns: "640fr 451fr",
    gap: 16,
  },
  summaryBox: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  scoreBox: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  boxHeader: {
    fontSize: 16,
    fontWeight: 600,
    color: NAVY,
  },
  subHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
  },
  boxHeaderSuffix: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
    marginLeft: 4,
  },
  summaryBody: {
    fontSize: 14,
    fontWeight: 500,
    color: "#000",
    lineHeight: 1.55,
  },
  statRow: {
    display: "flex",
    alignItems: "stretch",
    gap: 16,
    marginTop: "auto",
  },
  statDivider: {
    width: 1,
    background: "var(--color-border)",
    alignSelf: "stretch",
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#f7f9ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  statValue: {
    fontSize: 25,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },

  scoreBody: {
    display: "flex",
    alignItems: "flex-end",
    gap: 16,
    justifyContent: "space-between",
    flex: 1,
    minHeight: 145,
  },
  scoreText: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingBottom: 4,
  },
  scoreVerdict: {
    fontSize: 35,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  scoreDelta: {
    fontSize: 14,
    fontWeight: 600,
    color: "#000",
  },
  scoreCircleWrap: {
    position: "relative",
    width: 145,
    height: 145,
    flexShrink: 0,
  },
  scoreCircleText: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 45,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },

  mainFourRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  mainFourCard: {
    background: "#ffffff",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  mainFourIconWrap: {
    width: 55,
    height: 55,
    borderRadius: "50%",
    background: "#f7f9ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mainFourText: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  mainFourLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mainFourValue: {
    fontSize: 30,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },

  row3: {
    display: "grid",
    gridTemplateColumns: "571fr 518fr",
    gap: 16,
  },
  row3Left: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  row3Right: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  priceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 0,
  },
  priceCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "12px 14px",
    minWidth: 0,
  },
  priceCardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  priceCardLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  priceCardTooltip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: `1px solid ${FAINT}`,
    color: FAINT,
    fontSize: 10.5,
    fontWeight: 600,
    flexShrink: 0,
  },
  priceCardValue: {
    fontSize: 16,
    fontWeight: 600,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
    display: "flex",
    alignItems: "baseline",
    gap: 1,
  },
  priceCardUnit: {
    fontSize: 11,
    fontWeight: 600,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
  },
  priceCardChange: {
    fontSize: 10,
    fontWeight: 600,
  },

  row4: {
    display: "flex",
    gap: 16,
    alignItems: "stretch",
  },
  row7: {
    display: "flex",
    gap: 16,
    alignItems: "stretch",
  },
  sectionBoxFull: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    flexBasis: 0,
    minWidth: 0,
  },
  sectionBoxFullHead: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },

  row5: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  row5Header: {
    display: "flex",
    alignItems: "baseline",
  },
  row5Grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  sectorChart: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  sectorChartTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  sectorChartSub: {
    fontSize: 12,
    fontWeight: 600,
    color: MUTED,
  },

  row6: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  row6Grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  issueCard: {
    background: "#fafbfc",
    borderRadius: 10,
    padding: "14px 18px",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  },
  issueIcon: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  issueText: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  issueHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  issueTag: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
    border: "1px solid",
    background: "#ffffff",
    whiteSpace: "nowrap",
  },
  issueBody: {
    fontSize: 12,
    fontWeight: 500,
    color: MUTED,
    lineHeight: 1.5,
  },

  sideIndicators: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 0,
    flexShrink: 0,
    width: 140,
    paddingLeft: 16,
    borderLeft: "1px solid var(--color-border)",
  },
  sideIndicatorRow: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "16px 0",
  },
  sideIndicatorDivider: {
    height: 1,
    background: "var(--color-border)",
  },
  sideIndicatorLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
  },
  sideIndicatorValue: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
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
    color: FAINT,
    fontStyle: "italic",
  },
};
