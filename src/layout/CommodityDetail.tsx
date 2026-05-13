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

import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import {
  barChangeData,
  categoryStanceLabel,
  commodityImpactScore,
  costImpactLabel,
  marketIndicatorsTable,
  maxDate,
  normalizedCycleSeries,
  outlookLabel,
  scatterData,
  scoreDayDelta,
  sectorTrends,
  supplyStabilityLabel,
  symbolStat,
  verdictFromImpactScore,
  wtiNgSeries,
  type BarChangeItem,
  type DualAxisPoint,
  type MarketIndicatorRow,
  type NormalizedCycleSeries,
  type ScatterPoint,
  type SectorChart,
} from "../analysis/commodityNarrative";
import {
  loadCommodities,
  loadCompanySnapshot,
} from "../data-loader/investmentData";
import type { CommoditiesResponse, CompanySnapshot } from "../types/investment";
import { InfoTooltip } from "../visualization/InfoTooltip";
import { DetailShell, type DetailSection } from "./DetailShell";
import { EmptyState } from "./detail";
import { responsiveStyles, scaledPx } from "../shared/responsiveStyle";
import { TruncatedText } from "../shared/TruncatedText";
import { ChartCrosshair, ChartTooltip, useChartHoverIdx } from "../visualization/chartHover";

export interface CommodityDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

// ── 정적 메타 ─────────────────────────────────────────────────

interface CommodityDetailCache {
  data: CompanySnapshot;
  commodities: CommoditiesResponse;
}

const commodityDetailCache = new Map<string, CommodityDetailCache>();

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
  // 정적 콘텐츠
  summary: string;
  stocks: Array<{ ticker: string; name: string }>;
  events: Array<{ date: string; text: string; future?: boolean }>;
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

// §6 issue 4 카드 정적 메타. tag 는 동적(stance), summary/stocks/events 는 정적.
const ISSUE_META: Array<{
  key: string;
  iconBg: string;
  iconName: string;
  title: string;
  symbols: string[];
  summary: string;
  stocks: Array<{ ticker: string; name: string }>;
  events: Array<{ date: string; text: string; future?: boolean }>;
}> = [
  {
    key: "precious",
    iconBg: "#fafadf",
    iconName: "streamline:gold-remix",
    title: "귀금속",
    symbols: ["GC=F", "SI=F"],
    summary: "안전자산 선호↑, 가격 부담·차익실현 변동성 주의",
    stocks: [
      { ticker: "NEM", name: "뉴몬트" },
      { ticker: "FCX", name: "프리포트-맥모란" },
      { ticker: "CME", name: "CME 그룹" },
      { ticker: "STT", name: "스테이트 스트리트" },
      { ticker: "EL", name: "에스티 로더" },
    ],
    events: [
      { date: "1/21", text: "연준 의장 교체 우려, 금 $5,000/oz 세대적 고점" },
      { date: "2/27", text: "미 금 ETF 보유 9,880만 oz 연초 최고" },
      { date: "3/26", text: "고금리 전망, 금·은 단기 저점" },
      { date: "4/17", text: "호르무즈 재개방, 금 +2.1% / 은 +4%" },
      { date: "5/11", text: "은 산업수요↑, 하루 +7.2% ($85.99 돌파)" },
      { date: "5/12", text: "은·백금 차익실현 −5% 급락" },
    ],
  },
  {
    key: "energy",
    iconBg: "#fde5e4",
    iconName: "game-icons:oil-rig",
    title: "에너지",
    symbols: ["CL=F", "NG=F"],
    summary: "섹터 수익성↑ / 항공·소비재 비용 부담",
    stocks: [
      { ticker: "XOM", name: "엑슨모빌" },
      { ticker: "COP", name: "코노코필립스" },
      { ticker: "SLB", name: "슐럼버저" },
      { ticker: "DAL", name: "델타 항공" },
      { ticker: "CCL", name: "카니발" },
    ],
    events: [
      { date: "1/21", text: "폴라 보텍스, 천연가스 옵션 거래 사상 최고" },
      { date: "2/28", text: "미·이스라엘 이란 공습, 브렌트 $120/bbl 육박" },
      { date: "3/2", text: "이란 호르무즈 차단, 공급 −1,010만 bbl/day" },
      { date: "3/11", text: "IEA 4억 bbl 비축유 방출, $92/bbl 조정" },
      { date: "4/7", text: "미·이란 휴전 합의, WTI −16% 폭락" },
      { date: "4/15~17", text: "해협 개방, 유가 안정" },
      { date: "5/11", text: "트럼프 휴전 거부, WTI $98.07 반등" },
      { date: "5/12", text: "MSC·Maersk 걸프 운항 중단" },
    ],
  },
  {
    key: "metals",
    iconBg: "#fdf0d5",
    iconName: "iconoir:spiral",
    title: "산업금속",
    symbols: ["HG=F", "LIT"],
    summary: "소재 유망 / EV·IT 원가 부담 가중",
    stocks: [
      { ticker: "ALB", name: "앨베말" },
      { ticker: "NUE", name: "뉴코" },
      { ticker: "F", name: "포드" },
      { ticker: "ETN", name: "이튼" },
      { ticker: "TSLA", name: "테슬라" },
    ],
    events: [
      { date: "1/15", text: "핵심 광물 국가안보 자산 행정명령" },
      { date: "2/28", text: "COMEX 구리 재고 사상 최고" },
      { date: "3/9", text: "에너지저장 투자↑, 리튬 반등" },
      { date: "3/13", text: "상하이 구리 재고 정점 후 감소" },
      { date: "4/7", text: "EnergyX, 텍사스 DLE 리튬 공장 가동" },
      { date: "5/1", text: "중국 황산 수출 중단, 침출 공법 타격" },
      { date: "5/11", text: "COMEX 구리 $6.51/lb, Standard Lithium-Trafigura 계약" },
      { date: "6/9~10", text: "Giga US 2026 리튬 로드맵", future: true },
    ],
  },
  {
    key: "agri",
    iconBg: "#f5e8ff",
    iconName: "carbon:crop-growth",
    title: "농산물",
    symbols: ["ZW=F", "ZS=F", "ZC=F"],
    summary: "농기계·비료 호재 / 필수소비재 마진 압박",
    stocks: [
      { ticker: "DE", name: "디어 앤 컴퍼니" },
      { ticker: "ADM", name: "아처 대니얼스 미들랜드" },
      { ticker: "CTVA", name: "코르테바" },
      { ticker: "CF", name: "CF 인더스트리스" },
      { ticker: "KHC", name: "크래프트 하인즈" },
    ],
    events: [
      { date: "3/31", text: "USDA, 옥수수↓ / 대두↑ / 소맥 역대 최저" },
      { date: "5/11", text: "주간 작황, 겨울 소맥 우수등급 4년 최악" },
      { date: "5/12", text: "WASDE, 소맥 생산 1972년 이후 최저" },
      { date: "5/14~15", text: "미·중 정상회담, 옥수수·대두 대규모 구매" },
    ],
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
  const cacheKey = ticker.toUpperCase();
  const cached = commodityDetailCache.get(cacheKey) ?? null;
  const [data, setData] = useState<CompanySnapshot | null>(() => cached?.data ?? null);
  const [commodities, setCommodities] = useState<CommoditiesResponse | null>(() => cached?.commodities ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const cachedState = commodityDetailCache.get(cacheKey) ?? null;
    setData(cachedState?.data ?? null);
    setCommodities(cachedState?.commodities ?? null);
    setError(null);
    if (cachedState) return () => {
      alive = false;
    };

    Promise.all([
      loadCompanySnapshot(ticker, 24),
      // 자산군 정규화 사이클(2021 Q2 baseline) + WTI vs NG 5년치 시계열 커버용
      loadCommodities(undefined, 1300),
    ])
      .then(([s, c]) => {
        commodityDetailCache.set(cacheKey, { data: s, commodities: c });
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
  }, [cacheKey, ticker]);

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
        summary: meta.summary,
        stocks: meta.stocks,
        events: meta.events,
      };
    });

    const wti = symbolStat(rows, "CL=F");
    const ng = symbolStat(rows, "NG=F");
    const sideIndicators = [
      {
        label: "WTI 원유",
        value: wti.latest != null ? `$${wti.latest.toFixed(2)}/bbl` : "—",
        borderColor: "#fdb43a",
        bgColor: "#fff8e6",
      },
      {
        label: "천연가스",
        value: ng.latest != null ? `$${ng.latest.toFixed(2)}/MMBtu` : "—",
        borderColor: "#4a7aff",
        bgColor: "#eaf0ff",
      },
    ];

    const date = maxDate(rows);
    const barChange = barChangeData(rows);
    const marketTable = marketIndicatorsTable(rows);
    const scatter = scatterData(rows);
    const sectors = sectorTrends(rows);
    const normCycle = normalizedCycleSeries(rows);
    const wtiNg = wtiNgSeries(rows);

    return {
      impact,
      verdict,
      delta,
      stats,
      mainFour,
      priceCards,
      issueCards,
      sideIndicators,
      date,
      barChange,
      marketTable,
      scatter,
      sectors,
      normCycle,
      wtiNg,
    };
  }, [commodities]);

  const companyName = data?.company?.name ?? ticker;

  return (
    <DetailShell
      ticker={ticker}
      active="commodity"
      pageTitle="원자재 영향 분석"
      pageSubtitle={`${companyName}의 주요 원자재 관련 비용 및 매출 영향과 시장 동향을 분석합니다.`}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <EmptyState variant="error" message={`로드 실패: ${error}`} />}
      {!error && (!data || !analysis) && <EmptyState variant="loading" />}
      {data && analysis && (
        <>
          {/* §1 — 2-col (1:1): 핵심 요약 + main-four 2x2 */}
          <div style={S.row1}>
            <section style={S.summaryBox}>
              <div style={S.boxHeader}>핵심 요약</div>
              <ul style={S.summaryList}>
                {analysis.issueCards.map((c) => (
                  <li key={`sum-${c.key}`} style={S.summaryListItem}>
                    <span style={{ ...S.summaryListLabel, color: c.tagColor }}>{c.title}</span>
                    <span style={S.summaryListBody}>{c.summary}</span>
                  </li>
                ))}
              </ul>
              <div style={S.statRow}>
                {analysis.stats.map((s, i) => (
                  <Frag key={s.label}>
                    {i > 0 && <div style={S.statDivider} />}
                    <StatItem stat={s} />
                  </Frag>
                ))}
              </div>
            </section>

            <div style={S.mainFourGrid}>
              {analysis.mainFour.map((m) => (
                <MainFourCard key={m.key} card={m} />
              ))}
            </div>
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
              <BarChangeChart items={analysis.barChange} />
            </section>
          </div>

          {/* §4 — 2-col */}
          <div style={S.row4}>
            <SectionBoxFull
              title="원자재 시장 지표 요약"
              flex={683}
              height={280}
            >
              <MarketIndicatorsTableView rows={analysis.marketTable} />
            </SectionBoxFull>
            <SectionBoxFull
              title="변동성-수익률 매트릭스"
              sub="시장 변동성 대비 가격 상승 모멘텀 포지셔닝"
              flex={404}
              height={280}
            >
              <VolatilityScatter points={analysis.scatter} />
            </SectionBoxFull>
          </div>

          {/* §5 카테고리별 가격 추이 */}
          <section style={S.row5}>
            <div style={S.row5Header}>
              <span style={S.boxHeader}>카테고리별 가격 추이</span>
              <span style={S.boxHeaderSuffix}>(12개월)</span>
            </div>
            <div style={{ ...S.subHeader, marginTop: -8 }}>12개월간 월별 시세 흐름 추적</div>
            <div style={S.row5Grid}>
              {analysis.sectors.map((sec, i) => (
                <Fragment key={sec.title}>
                  {i > 0 && <div style={S.row5Divider} />}
                  <SectorChartCard chart={sec} />
                </Fragment>
              ))}
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
              title={`자산군 정규화 사이클 (Base=100, ${analysis.normCycle[0]?.points[0]?.date ?? "—"})`}
              flex={494}
              height={290}
            >
              <NormalizedCycleChart series={analysis.normCycle} />
            </SectionBoxFull>
            <SectionBoxFull
              title="에너지 · WTI vs 천연가스 괴리율"
              flex={597}
              height={290}
              rightSide={<SideIndicators items={analysis.sideIndicators} />}
            >
              <WtiNgDualChart points={analysis.wtiNg} />
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
        <TruncatedText style={S.statLabel}>{stat.label}</TruncatedText>
        <TruncatedText style={{ ...S.statValue, color: stat.color }}>{stat.value}</TruncatedText>
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



function MainFourCard({ card }: { card: MainFourSpec }) {
  return (
    <div style={S.mainFourCard}>
      <div style={{ ...S.mainFourIconWrap, background: card.iconBg }} aria-hidden>
        <Icon icon={card.iconName} width={scaledPx(28)} height={scaledPx(28)} color={card.color} />
      </div>
      <div style={S.mainFourText}>
        <TruncatedText style={S.mainFourLabel}>{card.label}</TruncatedText>
        <TruncatedText style={{ ...S.mainFourValue, color: card.color }}>{card.value}</TruncatedText>
      </div>
    </div>
  );
}

// 시안 Card/원자재/주요 가격 8 variant 본문
const PRICE_CARD_TOOLTIP: Record<string, string> = {
  wti: "에너지 비용과 글로벌 물가에 영향을 주는 핵심 지표입니다. 일반적으로 유가 상승은 인플레이션 압력 확대 신호로 해석합니다.",
  ng: "전력·난방의 주요 원료로 산업 원가 부담을 보여주는 지표입니다. 가격 급등 시 에너지 집약 산업의 수익성이 악화될 수 있습니다.",
  cu: "실물 경기 흐름을 반영하는 대표 경기 선행 지표입니다. 일반적으로 가격 상승은 제조업·건설 경기 회복 신호로 해석합니다.",
  li: "전기차와 반도체 산업의 핵심 소재입니다. 가격 상승은 하이테크 산업의 원가 부담 확대 가능성을 의미합니다.",
  au: "대표적인 안전자산 지표입니다. 시장 불안이나 인플레이션 우려가 커질수록 강세를 보이는 경향이 있습니다.",
  ag: "대표적인 안전자산 지표입니다. 시장 불안이나 인플레이션 우려가 커질수록 강세를 보이는 경향이 있습니다.",
  wheat: "식품 물가와 소비 부담에 영향을 주는 농산물 지표입니다. 가격 상승은 전반적인 물가 상승 압력으로 이어질 수 있습니다.",
  soy: "식품 물가와 소비 부담에 영향을 주는 농산물 지표입니다. 가격 상승은 전반적인 물가 상승 압력으로 이어질 수 있습니다.",
};

function PriceCard({ card, idx }: { card: PriceCardSpec; idx: number }) {
  // 4×2 격자: 내부 선만 (마지막 열 우측 X, 마지막 행 하단 X)
  void idx;
  const tooltipText = PRICE_CARD_TOOLTIP[card.key];
  return (
    <div
      style={{
        ...S.priceCard,
      }}
    >
      <div style={S.priceCardHead}>
        <TruncatedText style={S.priceCardLabel}>{card.label}</TruncatedText>
        {tooltipText && <InfoTooltip text={tooltipText} mode="card" size={14} />}
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

// §3-B 가로 막대 차트 (음수 지원, 0 baseline)
function BarChangeChart({ items }: { items: BarChangeItem[] }) {
  const W = 460;
  const H = 200;
  const padL = 40;
  const padR = 20;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  // y 범위: 데이터에 음수 포함 가능
  const vals = items.map((i) => i.yoyPct);
  const dataMax = Math.max(0, ...vals);
  const dataMin = Math.min(0, ...vals);
  const niceStep = niceTickStep(Math.max(Math.abs(dataMax), Math.abs(dataMin)));
  const yMax = Math.ceil(dataMax / niceStep) * niceStep;
  const yMin = Math.floor(dataMin / niceStep) * niceStep;
  const yRange = yMax - yMin || 1;
  const yTicks: number[] = [];
  for (let t = yMin; t <= yMax; t += niceStep) yTicks.push(Number(t.toFixed(2)));
  const yOf = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;
  const yZero = yOf(0);
  const xStep = innerW / items.length;
  const barW = Math.max(14, xStep * 0.55);
  return (
    // flex-grow wrapper — 부모 row3Right 박스의 남은 세로 공간을 모두 차지.
    // SVG 는 viewBox 기반으로 100%×100% 채우며 meet 비율 유지.
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "100%" }}>
      {yTicks.map((t) => {
        const y = yOf(t);
        const isZero = t === 0;
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke={isZero ? "#b8b8b8" : "#ececec"} strokeWidth={isZero ? 1.2 : 1} />
            <text x={padL - 6} y={y} fontSize={9} fill="#737474" textAnchor="end" dominantBaseline="middle">
              {t}%
            </text>
          </g>
        );
      })}
      {items.map((it, i) => {
        const cx = padL + (i + 0.5) * xStep;
        const isNeg = it.yoyPct < 0;
        const valueY = yOf(it.yoyPct);
        const top = isNeg ? yZero : valueY;
        const h = Math.max(1, Math.abs(valueY - yZero));
        const labelY = isNeg ? valueY + 12 : valueY - 4;
        return (
          <g key={it.symbol}>
            <rect x={cx - barW / 2} y={top} width={barW} height={h} rx={3} fill={it.color} />
            <text x={cx} y={labelY} fontSize={10} fill={it.color} textAnchor="middle" fontWeight={700}>
              {it.yoyPct.toFixed(1)}%
            </text>
            <text x={cx} y={H - 10} fontSize={10} fill="#737474" textAnchor="middle">
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

// 깔끔한 tick step 계산 (1, 2, 5, 10, 20, 50, 100, ...)
function niceTickStep(max: number): number {
  if (max <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / mag;
  if (norm <= 1) return 0.2 * mag;
  if (norm <= 2) return 0.5 * mag;
  if (norm <= 5) return 1 * mag;
  return 2 * mag;
}

// §4-A 시장 지표 요약 표
function MarketIndicatorsTableView({ rows }: { rows: MarketIndicatorRow[] }) {
  return (
    <div style={CMT.wrap}>
      <div style={{ ...CMT.row, ...CMT.head }}>
        <span style={{ ...CMT.cell, ...CMT.colLabel }}>원자재</span>
        <span style={CMT.cell}>현재 시세</span>
        <span style={CMT.cell}>연간 변동률</span>
        <span style={CMT.cell}>변동성</span>
        <span style={CMT.cell}>시장 흐름</span>
      </div>
      {rows.map((r) => (
        <div key={r.symbol} style={CMT.row}>
          <span style={{ ...CMT.cell, ...CMT.colLabel }} title={r.label}>{r.label}</span>
          <span style={CMT.cell}>{r.currentPrice}</span>
          <span style={{ ...CMT.cell, color: r.yoyColor, fontWeight: 700 }}>{r.yoyDisplay}</span>
          <span style={{ ...CMT.cell, color: r.volatilityColor, fontWeight: 700 }}>{r.volatility}</span>
          <span style={{ ...CMT.cell, color: r.flowColor, fontWeight: 700 }}>{r.flow}</span>
        </div>
      ))}
    </div>
  );
}

// §4-B 변동성-수익률 scatter
function VolatilityScatter({ points }: { points: ScatterPoint[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 380;
  const H = 240;
  const padL = 48;
  const padR = 14;
  const padT = 14;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xValues = points.map((p) => p.x);
  const yValues = points.map((p) => p.y);
  const xMax = Math.max(20, ...xValues) * 1.1;
  const yMax = Math.max(50, ...yValues) * 1.1;
  const yMin = Math.min(0, ...yValues);
  const xOf = (v: number) => padL + (v / xMax) * innerW;
  const yOf = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const xMid = padL + innerW / 2;
  const yStep = niceTickStep(yMax);
  const yTicks: number[] = [];
  for (let t = 0; t <= yMax; t += yStep) yTicks.push(Math.round(t));
  // hover 된 점 마지막에 그림
  const pointOrder = hovered
    ? [...points.filter((p) => p.symbol !== hovered), ...points.filter((p) => p.symbol === hovered)]
    : points;
  const hoveredPoint = hovered ? points.find((p) => p.symbol === hovered) : null;
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHovered(null)}>
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {/* Y 축 grid + tick */}
      {yTicks.map((t) => {
        const y = yOf(t);
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />
            <text x={padL - 4} y={y} fontSize={10} fill="#737474" textAnchor="end" dominantBaseline="middle">
              {t}%
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      {/* Y axis title (rotated) */}
      <text
        x={-(padT + innerH / 2)}
        y={14}
        fontSize={11}
        fill="#003049"
        textAnchor="middle"
        fontWeight={600}
        transform="rotate(-90)"
      >
        연간 변동률 (%)
      </text>
      {/* X axis title — 중앙 */}
      <text
        x={padL + innerW / 2}
        y={H - 6}
        fontSize={11}
        fill="#003049"
        textAnchor="middle"
        fontWeight={600}
      >
        시장 변동성
      </text>
      {/* 낮음/높음 — X 축 양 끝 */}
      <text x={padL + 4} y={padT + innerH + 14} fontSize={10} fill="#737474" textAnchor="start">
        낮음
      </text>
      <text x={W - padR - 4} y={padT + innerH + 14} fontSize={10} fill="#737474" textAnchor="end">
        높음
      </text>
      {/* points + labels (자동 배치, hover 시 z-order 위) */}
      {pointOrder.map((p) => {
        const cx = xOf(p.x);
        const cy = yOf(p.y);
        const r = 10;
        const labelRight = cx <= xMid;
        const tx = labelRight ? cx + r + 4 : cx - r - 4;
        const anchor = labelRight ? "start" : "end";
        const isHover = hovered === p.symbol;
        return (
          <g
            key={p.symbol}
            onMouseEnter={() => setHovered(p.symbol)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={p.color}
              stroke={isHover ? "#003049" : "none"}
              strokeWidth={isHover ? 1.8 : 0}
            />
            <text
              x={tx}
              y={cy}
              fontSize={isHover ? 11 : 10}
              fill="#003049"
              dominantBaseline="middle"
              textAnchor={anchor}
              fontWeight={700}
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
    {hoveredPoint && (
      <ChartTooltip
        leftPercent={(xOf(hoveredPoint.x) / W) * 100}
        style={{
          top: `${(yOf(hoveredPoint.y) / H) * 100}%`,
          transform: "translate(-50%, calc(-100% - 14px))",
        }}
      >
        <div style={{ fontWeight: 700 }}>{hoveredPoint.label}</div>
        <div>변동성 {hoveredPoint.x.toFixed(1)} · 수익률 {hoveredPoint.y >= 0 ? "+" : ""}{hoveredPoint.y.toFixed(1)}%</div>
      </ChartTooltip>
    )}
    </div>
  );
}

// §5 sector card (1 of 3)
function SectorChartCard({ chart }: { chart: SectorChart }) {
  return (
    <div style={S.sectorChart}>
      <div style={S.sectorChartTitle}>{chart.title}</div>
      <div style={S.sectorChartSub}>{chart.sub}</div>
      <div style={S.sectorLegend}>
        {chart.series.map((s) => (
          <span key={s.symbol} style={S.sectorLegendItem}>
            <span style={{ ...S.sectorLegendDot, background: s.color }} />
            <span style={{ ...S.sectorLegendText, color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
      <SectorLineSvg chart={chart} />
    </div>
  );
}

function SectorLineSvg({ chart }: { chart: SectorChart }) {
  const W = 320;
  const H = 150;
  const padL = 44;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  // 모든 데이터 값
  const allVals: number[] = [];
  for (const p of chart.points) {
    for (const s of chart.series) {
      const v = p.values[s.symbol];
      if (v != null) allVals.push(v);
    }
  }
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 1;
  // Y 0 부터 시작, round step
  const step = niceTickStep(dataMax);
  const yMax = Math.ceil(dataMax / step) * step;
  const yTicks: number[] = [];
  for (let t = 0; t <= yMax + 1e-9; t += step) yTicks.push(Number(t.toFixed(4)));
  const fmtTick = (v: number) =>
    v >= 1000 ? Math.round(v).toLocaleString() : v >= 100 ? v.toFixed(0) : v.toFixed(1);
  const stepX = chart.points.length > 1 ? innerW / (chart.points.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - (v / yMax) * innerH;
  const xOfIdx = useCallback((i: number) => xOf(i), [stepX]);
  const { hoverIdx, onPointerMove, onPointerLeave } = useChartHoverIdx(chart.points.length, xOfIdx, W);
  const fmtVal = (v: number) =>
    v >= 1000 ? Math.round(v).toLocaleString() : v >= 100 ? v.toFixed(0) : v.toFixed(2);
  return (
    <div style={{ position: "relative" }} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", height: scaledPx(H) }}>
      {/* Y grid + tick label */}
      {yTicks.map((t, i) => {
        const y = yOf(t);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />
            <text x={padL - 4} y={y} fontSize={8} fill="#737474" textAnchor="end" dominantBaseline="middle">
              {fmtTick(t)}
            </text>
          </g>
        );
      })}
      {/* ㄴ axis */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      {chart.series.map((s) => {
        const pts: Array<{ x: number; y: number }> = [];
        chart.points.forEach((p, i) => {
          const v = p.values[s.symbol];
          if (v == null) return;
          pts.push({ x: xOf(i), y: yOf(v) });
        });
        if (pts.length < 2) return null;
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        return (
          <g key={s.symbol}>
            <path d={d} stroke={s.color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2} fill={s.color} />
            ))}
          </g>
        );
      })}
      {chart.points.map((p, i) =>
        i % 3 === 0 ? (
          <text key={`xl-${i}`} x={xOf(i)} y={H - 6} fontSize={9} fill="#737474" textAnchor="middle">
            {p.date}
          </text>
        ) : null,
      )}
      {hoverIdx !== null && (
        <ChartCrosshair x={xOf(hoverIdx)} y1={padT} y2={padT + innerH} />
      )}
    </svg>
    {hoverIdx !== null && chart.points[hoverIdx] && (
      <ChartTooltip leftPercent={(xOf(hoverIdx) / W) * 100}>
        <div style={{ fontWeight: 700 }}>{chart.points[hoverIdx].date}</div>
        {chart.series.map((s) => {
          const v = chart.points[hoverIdx].values[s.symbol];
          if (v == null) return null;
          return (
            <div key={s.symbol} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: s.color }}>{s.label}</span>
              <span>{fmtVal(v)}</span>
            </div>
          );
        })}
      </ChartTooltip>
    )}
    </div>
  );
}

// §7-A 정규화 사이클 line chart
function NormalizedCycleChart({ series }: { series: NormalizedCycleSeries[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 460;
  const H = 260;
  const padL = 40;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allVals: number[] = [];
  for (const s of series) {
    for (const p of s.points) {
      if (p.index != null) allVals.push(p.index);
    }
  }
  // Y max 동적: 데이터 max 위에 1단계 더
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 100;
  const step = dataMax >= 300 ? 100 : dataMax >= 150 ? 50 : 25;
  const yMax = Math.ceil(dataMax / step) * step + step;
  const yTicks: number[] = [];
  for (let t = 0; t <= yMax; t += step) yTicks.push(t);
  const allDates = series[0]?.points.map((p) => p.date) ?? [];
  const stepX = allDates.length > 1 ? innerW / (allDates.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - (v / yMax) * innerH;
  const xOfIdx = useCallback((i: number) => xOf(i), [stepX]);
  const { hoverIdx, onPointerMove, onPointerLeave } = useChartHoverIdx(allDates.length, xOfIdx, W);
  return (
    <div style={CFM.wrap}>
      {/* 범례 — svg 위 */}
      <div style={CFM.legendRow}>
        {series.map((s) => (
          <span
            key={s.symbol}
            style={{ ...CFM.legendItem, cursor: "pointer" }}
            onMouseEnter={() => setHovered(s.symbol)}
            onMouseLeave={() => setHovered(null)}
          >
            <span style={{ ...CFM.legendDot, background: s.color }} />
            <span style={{ ...CFM.legendText, color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
      <div style={{ position: "relative" }} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", height: scaledPx(H) }}>
        {yTicks.map((t) => {
          const y = yOf(t);
          return (
            <g key={t}>
              {t > 0 && <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />}
              <text x={padL - 4} y={y} fontSize={9} fill="#737474" textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        <text x={padL} y={padT - 2} fontSize={9} fill="#737474">지수 (BASE=100)</text>
        {series.map((s) => {
          const pts: Array<{ x: number; y: number }> = [];
          s.points.forEach((p, i) => {
            if (p.index == null) return;
            pts.push({ x: xOf(i), y: yOf(p.index) });
          });
          if (pts.length < 2) return null;
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          return (
            <g key={s.symbol}>
              <path
                d={d}
                stroke={s.color}
                strokeWidth={1.8}
                fill="none"
                strokeDasharray={s.dashed ? "4 3" : undefined}
                strokeLinejoin="round"
                opacity={hovered && hovered !== s.symbol ? 0.3 : 1}
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2} fill={s.color} opacity={hovered && hovered !== s.symbol ? 0.3 : 1} />
              ))}
            </g>
          );
        })}
        {allDates.map((d, i) =>
          i % 4 === 0 ? (
            <text key={`xl-${i}`} x={xOf(i)} y={H - 8} fontSize={9} fill="#737474" textAnchor="middle">
              {d}
            </text>
          ) : null,
        )}
        {hoverIdx !== null && (
          <ChartCrosshair x={xOf(hoverIdx)} y1={padT} y2={padT + innerH} />
        )}
      </svg>
      {hoverIdx !== null && allDates[hoverIdx] && (
        <ChartTooltip leftPercent={(xOf(hoverIdx) / W) * 100}>
          <div style={{ fontWeight: 700 }}>{allDates[hoverIdx]}</div>
          {series.map((s) => {
            const v = s.points[hoverIdx]?.index;
            if (v == null) return null;
            return (
              <div key={s.symbol} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: s.color }}>{s.label}</span>
                <span>{v.toFixed(1)}</span>
              </div>
            );
          })}
        </ChartTooltip>
      )}
      </div>
    </div>
  );
}

// §7-B WTI vs NG dual-axis line chart
function WtiNgDualChart({ points }: { points: DualAxisPoint[] }) {
  const W = 460;
  const H = 260;
  const padL = 40;
  const padR = 44;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const wtiVals = points.map((p) => p.wti).filter((v): v is number => v != null);
  const ngVals = points.map((p) => p.ng).filter((v): v is number => v != null);
  // Y 범위 동적
  const wtiDataMax = wtiVals.length > 0 ? Math.max(...wtiVals) : 100;
  const wtiMax = Math.ceil(wtiDataMax / 20) * 20 + 20;
  const wtiStep = wtiMax / 4;
  const wtiTicks: number[] = [];
  for (let t = 0; t <= wtiMax; t += wtiStep) wtiTicks.push(Math.round(t));
  const ngDataMax = ngVals.length > 0 ? Math.max(...ngVals) : 8;
  const ngMax = Math.ceil(ngDataMax / 2) * 2 + 2;
  const ngStep = ngMax / 4;
  const ngTicks: number[] = [];
  for (let t = 0; t <= ngMax; t += ngStep) ngTicks.push(Number(t.toFixed(1)));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yWti = (v: number) => padT + innerH - (v / wtiMax) * innerH;
  const yNg = (v: number) => padT + innerH - (v / ngMax) * innerH;
  const xOfIdx = useCallback((i: number) => xOf(i), [stepX]);
  const { hoverIdx, onPointerMove, onPointerLeave } = useChartHoverIdx(points.length, xOfIdx, W);
  return (
    <div style={CFM.wrap}>
      {/* 범례 — svg 위 */}
      <div style={CFM.legendRow}>
        <span style={CFM.legendItem}>
          <span style={{ ...CFM.legendDot, background: "#fdb43a" }} />
          <span style={{ ...CFM.legendText, color: "#fdb43a" }}>WTI 원유 ($/bbl)</span>
        </span>
        <span style={CFM.legendItem}>
          <span style={{ ...CFM.legendDot, background: "#4a7aff" }} />
          <span style={{ ...CFM.legendText, color: "#4a7aff" }}>천연가스 ($/MMBtu)</span>
        </span>
      </div>
      <div style={{ position: "relative" }} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", height: scaledPx(H) }}>
        {wtiTicks.map((t) => {
          const y = yWti(t);
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />
              <text x={padL - 4} y={y} fontSize={10} fill="#fdb43a" textAnchor="end" dominantBaseline="middle">
                ${t}
              </text>
            </g>
          );
        })}
        {ngTicks.map((t) => {
          const y = yNg(t);
          return (
            <text key={`ng-${t}`} x={W - padR + 4} y={y} fontSize={10} fill="#4a7aff" textAnchor="start" dominantBaseline="middle">
              ${t}
            </text>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        <line x1={W - padR} y1={padT} x2={W - padR} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        {/* WTI line */}
        {(() => {
          const pts: Array<{ x: number; y: number }> = [];
          points.forEach((p, i) => {
            if (p.wti == null) return;
            pts.push({ x: xOf(i), y: yWti(p.wti) });
          });
          if (pts.length < 2) return null;
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          return (
            <>
              <path d={d} stroke="#fdb43a" strokeWidth={1.8} fill="none" strokeLinejoin="round" />
              {pts.map((p, i) => <circle key={`w-${i}`} cx={p.x} cy={p.y} r={2} fill="#fdb43a" />)}
            </>
          );
        })()}
        {/* NG line */}
        {(() => {
          const pts: Array<{ x: number; y: number }> = [];
          points.forEach((p, i) => {
            if (p.ng == null) return;
            pts.push({ x: xOf(i), y: yNg(p.ng) });
          });
          if (pts.length < 2) return null;
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          return (
            <>
              <path d={d} stroke="#4a7aff" strokeWidth={1.8} fill="none" strokeLinejoin="round" />
              {pts.map((p, i) => <circle key={`n-${i}`} cx={p.x} cy={p.y} r={2} fill="#4a7aff" />)}
            </>
          );
        })()}
        {points.map((p, i) =>
          i % 4 === 0 ? (
            <text key={`xl-${i}`} x={xOf(i)} y={H - 8} fontSize={9} fill="#737474" textAnchor="middle">
              {p.date}
            </text>
          ) : null,
        )}
        {hoverIdx !== null && (
          <ChartCrosshair x={xOf(hoverIdx)} y1={padT} y2={padT + innerH} />
        )}
      </svg>
      {hoverIdx !== null && points[hoverIdx] && (
        <ChartTooltip leftPercent={(xOf(hoverIdx) / W) * 100}>
          <div style={{ fontWeight: 700 }}>{points[hoverIdx].date}</div>
          {points[hoverIdx].wti != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#fdb43a" }}>WTI</span>
              <span>${points[hoverIdx].wti!.toFixed(1)}</span>
            </div>
          )}
          {points[hoverIdx].ng != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#4a7aff" }}>천연가스</span>
              <span>${points[hoverIdx].ng!.toFixed(2)}</span>
            </div>
          )}
        </ChartTooltip>
      )}
      </div>
    </div>
  );
}

function IssueCard({ card }: { card: IssueCardSpec }) {
  return (
    <div style={S.issueCard}>
      <div style={S.issueHead}>
        <div style={{ ...S.issueIcon, background: card.iconBg }} aria-hidden>
          <Icon icon={card.iconName} width={scaledPx(20)} height={scaledPx(20)} color={card.tagColor} />
        </div>
        <TruncatedText style={S.issueTitle}>{card.title}</TruncatedText>
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
      <div style={S.issueSummary}>{card.summary}</div>
      <div style={S.issueStocks}>
        <span style={S.issueStocksLabel}>관련 주식 :</span>
        {card.stocks.map((s) => (
          <span key={s.ticker} style={S.issueStockChip} title={s.name}>
            {s.ticker}
          </span>
        ))}
      </div>
      <ul style={S.issueEventList}>
        {card.events.map((e, i) => (
          <li key={i} style={S.issueEventRow}>
            <span style={{ ...S.issueEventDate, ...(e.future ? S.issueEventFuture : null) }}>
              {e.date}
              {e.future && <span style={S.issueEventFutureTag}>예정</span>}
            </span>
            <span style={S.issueEventText}>{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SideIndicators({
  items,
}: {
  items: Array<{ label: string; value: string; borderColor?: string; bgColor?: string }>;
}) {
  return (
    <div style={S.sideIndicators}>
      {items.map((s) => (
        <div
          key={s.label}
          style={{
            ...S.sideIndicatorRow,
            border: `1px solid ${s.borderColor ?? "#ececec"}`,
            background: s.bgColor ?? "transparent",
            borderRadius: 8,
            padding: "clamp(0.5rem, 1vw, 0.75rem) clamp(0.5rem, 1.1vw, 0.875rem)",
          }}
        >
          <TruncatedText style={S.sideIndicatorLabel}>{s.label}</TruncatedText>
          <TruncatedText style={S.sideIndicatorValue}>{s.value}</TruncatedText>
        </div>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={S.boxHeader}>{title}</div>
          {sub && <div style={S.subHeader}>{sub}</div>}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: scaledPx(12),
          minHeight: scaledPx(height),
          minWidth: 0,
        }}
      >
        <div style={{ flex: 1, display: "flex", minWidth: 0 }}>{children}</div>
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

const S = responsiveStyles({
  row1: {
    display: "grid",

    gridTemplateColumns: "1fr 1fr",

    gap: 16,
    alignItems: "stretch",
  },
  mainFourGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: 12,
    alignItems: "stretch",
  },
  summaryBox: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "clamp(1rem, 1.55vw, 1.25rem) clamp(1rem, 1.85vw, 1.5rem)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
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
  summaryList: {
    display: "flex",
    flexDirection: "column",
    listStyle: "none",
    padding: 0,
    margin: 0,
    gap: 6,
  },
  summaryListItem: {
    display: "grid",
    gridTemplateColumns: "60px 1fr",
    alignItems: "baseline",
    gap: 10,
    padding: "2px 0",
  },
  summaryListLabel: {
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  summaryListBody: {
    fontSize: 12.5,
    fontWeight: 500,
    color: "#373737",
    lineHeight: 1.45,
  },
  statRow: {
    display: "flex",
    alignItems: "stretch",
    gap: "clamp(0.5rem, 1.1vw, 1rem)",
    marginTop: "auto",
    minWidth: 0,
  },
  statDivider: {
    width: 1,
    background: "var(--color-border)",
    alignSelf: "stretch",
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(0.375rem, 0.75vw, 0.625rem)",
    flex: 1,
    minWidth: 0,
  },
  statIcon: {
    width: "clamp(1.75rem, 3.2vw, 2.625rem)",
    height: "clamp(1.75rem, 3.2vw, 2.625rem)",
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
    fontSize: "clamp(0.6875rem, 1.15vw, 0.9375rem)",
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statValue: {
    fontSize: "clamp(1rem, 1.9vw, 1.5625rem)",
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },



  mainFourCard: {
    background: "#ffffff",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "clamp(0.875rem, 1.55vw, 1.25rem) clamp(0.875rem, 1.85vw, 1.5rem)",
    display: "flex",
    alignItems: "center",
    gap: "clamp(0.5rem, 1.1vw, 1rem)",
    minWidth: 0,
    overflow: "hidden",
  },
  mainFourIconWrap: {
    width: "clamp(2.25rem, 4vw, 3.4375rem)",
    height: "clamp(2.25rem, 4vw, 3.4375rem)",
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
    fontSize: "clamp(1.25rem, 2.25vw, 1.875rem)",
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 1,
    background: "var(--color-border)",
  },
  priceCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "12px 14px",
    minWidth: 0,
    background: "var(--color-card)",
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
    gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
    gap: 12,
    alignItems: "stretch",
  },
  row5Divider: {
    width: 1,
    background: "#ececec",
    alignSelf: "stretch",
  },
  sectorChart: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    alignItems: "stretch",
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
    // 2×2 고정.
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignItems: "stretch",
  },
  issueCard: {
    background: "#fafbfc",
    border: "1px solid #ececec",
    borderRadius: 10,
    padding: "14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },
  issueIcon: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  issueHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
  },
  issueTag: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
    border: "1px solid",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  issueSummary: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
    lineHeight: 1.45,
  },
  issueStocks: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  issueStocksLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7f7f7f",
    marginRight: 2,
  },
  issueStockChip: {
    fontSize: 11,
    fontWeight: 700,
    color: NAVY,
    background: "#eef2f7",
    padding: "2px 7px",
    borderRadius: 4,
    fontFamily: "var(--font-numeric)",
    letterSpacing: "0.02em",
  },
  issueEventList: {
    display: "flex",
    flexDirection: "column",
    listStyle: "none",
    padding: 0,
    margin: 0,
    gap: 0,
    marginTop: 4,
    borderTop: "1px solid #ececec",
  },
  issueEventRow: {
    display: "grid",
    gridTemplateColumns: "70px 1fr",
    alignItems: "baseline",
    gap: 10,
    padding: "6px 0",
    borderBottom: "1px solid #f3f3f3",
    fontSize: 12,
  },
  issueEventDate: {
    fontSize: 11,
    fontWeight: 700,
    color: "#003049",
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  issueEventFuture: {
    color: "#7f7f7f",
  },
  issueEventFutureTag: {
    fontSize: 9,
    fontWeight: 700,
    padding: "1px 4px",
    borderRadius: 3,
    background: "#fff8e6",
    color: "#a37200",
    border: "1px solid #f0d27b",
    letterSpacing: "0.04em",
  },
  issueEventText: {
    fontSize: 12,
    fontWeight: 500,
    color: "#373737",
    lineHeight: 1.45,
  },

  sideIndicators: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "clamp(0.5rem, 1vw, 0.75rem)",
    flexShrink: 0,
    width: "clamp(5.5rem, 11vw, 10rem)",
    paddingLeft: "clamp(0.35rem, 0.9vw, 0.875rem)",
    minWidth: 0,
  },
  sideIndicatorRow: {
    display: "flex",
    flexDirection: "column",
    gap: "clamp(0.625rem, 1.4vw, 1.125rem)",
    padding: "20px 0",
    minWidth: 0,
    overflow: "hidden",
  },
  sideIndicatorDivider: {
    height: 1,
    background: "var(--color-border)",
  },
  sideIndicatorLabel: {
    fontSize: "clamp(0.6875rem, 1vw, 0.875rem)",
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sideIndicatorValue: {
    fontSize: "clamp(0.875rem, 1.2vw, 1rem)",
    fontWeight: 700,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
});

// 차트 frame 공통 스타일 (legend + svg wrap)
const CFM = responsiveStyles({
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
  },
  legendRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    flexWrap: "nowrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendText: {
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

// §4-A 시장 지표 표 스타일
const CMT = responsiveStyles({
  wrap: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    fontSize: 12,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 0.9fr 0.9fr",
    alignItems: "center",
    padding: "8px 6px",
    borderBottom: "1px solid #ececec",
    gap: 6,
  },
  head: {
    fontWeight: 700,
    color: NAVY,
    background: "#fafbfc",
    borderTop: "1px solid #ececec",
  },
  cell: {
    fontSize: 12,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  colLabel: {
    fontFamily: "inherit",
    fontWeight: 600,
  },

});


// §5 sector legend 스타일 추가
S.sectorLegend = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  marginTop: 4,
  flexWrap: "nowrap",
};
S.sectorLegendItem = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  minWidth: 0,
};
S.sectorLegendDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};
S.sectorLegendText = {
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "var(--font-numeric)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
