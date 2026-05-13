// StockDashboard — 개별 주식 화면 (v5).
// spec: docs/figma/dashboard-slots-v4.md §3 (Figma node 251:3523, 1440×1630)
//
// 본 파일은 v4 시안의 픽셀 매핑 + 실 데이터 매핑(메인 차트 제외).
// 메인 차트(§3 우측)는 의도적 placeholder. 데이터 매핑은 추후 별도 작업.
//
// 와이어프레임 (위→아래):
//   1) 헤더              — 로고 + 글로벌 검색 pill
//   2) 종목 행            — 종목명·가격·변동 (좌) + 시장 컨텍스트 4슬롯 (우)
//   3) 4 게이지 + 차트    — 사이드바 4 게이지(좌) + 가격 차트 placeholder(우)
//   4) 이벤트 + 환율      — 2-col
//   5) 종합 점수 3중      — 오늘 / 이번 달 / 올해
//   6) TOP 3 × 4          — 오른 / 거래된 / 떨어진 / 점수 좋았던
//   7) 풋터 면책

import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { analyze } from "../analysis";
import {
  commodityImpactScore,
  costImpactLabel,
  outlookLabel,
  scoreDayDelta,
  supplyStabilityLabel,
  verdictFromImpactScore,
} from "../analysis/commodityNarrative";
import { buildEvents } from "../analysis/events";
import {
  sectionScores,
  totalFromSections,
  verdictFromScore,
} from "../analysis/fundamentalNarrative";
import { regimeProbs, type RegimeKey } from "../analysis/macroDetail";
import {
  technicalAnalysisV4,
  type TechnicalAnalysisV4,
  type TechnicalMetricScore,
} from "../analysis/technicalV4";
import {
  CommodityHover,
  FundamentalHover,
  MacroHover,
  TechnicalHover,
  type HCCommodityData,
  type HCFundamentalData,
  type HCMacroData,
} from "./HoverCards";
import {
  averageScore,
  buildDailyComposite,
  deltaFromSeries,
  overallSeries,
  toSparkline,
  windowDelta,
} from "../analysis/series";
import {
  loadCompanySnapshot,
  loadDashboardEnvironment,
  loadFxRate,
  loadGlobalEnvironment,
  loadMarketIndex,
  loadScreen,
  type DashboardEnvironment,
  type FxRateResponse,
  type MarketIndexResponse,
  type ScreenItem,
} from "../data-loader/investmentData";
import { buildGScore, buildIScore, buildRScore, confidenceToPct } from "../analysis/macroNarrative";
import type { GlobalEnvironmentPoint } from "../types/investment";
import { findSp500Entry } from "../data/sp500";
import type { CompanySnapshot } from "../types/investment";
import type { AnalysisEvent, GaugeScore, Severity } from "../types/scoring";
import { GlobalSearch } from "../visualization/GlobalSearch";
import { Sparkline } from "../visualization/Sparkline";

import type { DetailSection } from "./DetailShell";

export interface StockDashboardProps {
  ticker: string;
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
  onNavigateSection?: (section: DetailSection) => void;
}

interface DashState {
  snapshot: CompanySnapshot;
  env: DashboardEnvironment;
  screens: {
    priceUp: ScreenItem[];
    priceDown: ScreenItem[];
    volume: ScreenItem[];
    scoreTop: ScreenItem[];
  };
  marketIndices: Array<MarketIndexResponse | null>;
  fxRates: Array<FxRateResponse | null>;
}

const MARKET_INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC", "^RUT"];
const MARKET_INDEX_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "Nasdaq",
  "^RUT": "Russell 2K",
};

const FX_PAIRS = ["USDKRW", "USDJPY", "EURUSD", "USDCNY", "USDEUR"];
const FX_LABELS: Record<string, { code: string; sub: string }> = {
  USDKRW: { code: "USD/KRW", sub: "미국 달러 → 원화" },
  USDJPY: { code: "USD/JPY", sub: "미국 달러 → 엔화" },
  EURUSD: { code: "EUR/USD", sub: "유로 → 미국 달러" },
  USDCNY: { code: "USD/CNY", sub: "미국 달러 → 위안화" },
  USDEUR: { code: "USD/EUR", sub: "미국 달러 → 유로" },
};

async function safeLoad<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════════════ */

interface MacroExtras {
  ism: GlobalEnvironmentPoint[];
  unrate: GlobalEnvironmentPoint[];
  cpi: GlobalEnvironmentPoint[];
  fedfunds: GlobalEnvironmentPoint[];
  dgs2: GlobalEnvironmentPoint[];
  m2: GlobalEnvironmentPoint[];
}

export function StockDashboard({ ticker, onBack, onSelectTicker, onNavigateSection }: StockDashboardProps) {
  const [data, setData] = useState<DashState | null>(null);
  const [macroExtras, setMacroExtras] = useState<MacroExtras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);

  // Macro 호버의 G/I/R 계산용 추가 env 데이터 — 별도 비동기 로드 (실패 시 GIR 만 placeholder).
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadGlobalEnvironment({ symbol: "ISM_MAN",  historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "UNRATE",   historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "CPIAUCSL", historyLimit: 36 }),
      loadGlobalEnvironment({ symbol: "FEDFUNDS", historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "DGS2",     historyLimit: 60 }),
      loadGlobalEnvironment({ symbol: "M2SL",     historyLimit: 36 }),
    ])
      .then(([ism, unrate, cpi, fedfunds, dgs2, m2]) => {
        if (!alive) return;
        setMacroExtras({
          ism: ism.history,
          unrate: unrate.history,
          cpi: cpi.history,
          fedfunds: fedfunds.history,
          dgs2: dgs2.history,
          m2: m2.history,
        });
      })
      .catch(() => { /* fail silent — GIR 만 placeholder */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    Promise.all([
      loadCompanySnapshot(ticker),
      loadDashboardEnvironment(),
      loadScreen("priceUp", 3),
      loadScreen("priceDown", 3),
      loadScreen("volume", 3),
      loadScreen("scoreTop", 3),
      Promise.all(MARKET_INDEX_SYMBOLS.map((s) => safeLoad(() => loadMarketIndex(s)))),
      Promise.all(FX_PAIRS.map((p) => safeLoad(() => loadFxRate(p)))),
    ])
      .then(([snapshot, env, sUp, sDown, sVol, sScore, marketIndices, fxRates]) => {
        if (!alive) return;
        setData({
          snapshot,
          env,
          screens: {
            priceUp: sUp.items,
            priceDown: sDown.items,
            volume: sVol.items,
            scoreTop: sScore.items,
          },
          marketIndices,
          fxRates,
        });
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const analysis = useMemo(() => {
    if (!data) return null;
    return analyze({
      snapshot: data.snapshot,
      macroRegime: data.env.macroRegime.latest,
      vix: data.env.vix.latest[0] ?? null,
      commodities: data.env.commodities.history,
    });
  }, [data]);

  const priceMeta = useMemo(() => {
    if (!data) return null;
    const tech = data.snapshot.technicalHistory;
    const cur = tech[0]?.close ?? null;
    const prev = tech[1]?.close ?? null;
    if (cur === null) return null;
    const delta = prev !== null ? cur - prev : null;
    const pct = prev !== null && prev !== 0 ? ((cur - prev) / prev) * 100 : null;
    return { current: cur, delta, pct };
  }, [data]);

  const compositeTrio = useMemo(() => {
    if (!data) return null;
    return buildTrioItems(data);
  }, [data]);

  // 모달용 — 메인 카드 5건보다 많은 30건 합성
  const allEvents = useMemo(() => {
    if (!data) return [];
    return buildEvents(data.snapshot, 30);
  }, [data]);

  // 펀더멘털 호버 시 차트 영역에 표시할 데이터
  const fundamentalViz = useMemo<FundamentalVizData | null>(() => {
    if (!data?.snapshot.latestFundamentals) return null;
    return buildFundamentalVizData(data.snapshot.latestFundamentals);
  }, [data]);

  // 거시 호버 — 4 regime 확률 + 도미넌트 강조.
  // confidence 는 detail 페이지(MacroDetail) 와 동일 산출 — confidenceToPct 로 변환 (Medium → "70%" 등).
  const macroViz = useMemo<MacroVizData | null>(() => {
    const latest = data?.env.macroRegime.latest;
    if (!latest) return null;
    const probs = regimeProbs(latest);
    return {
      probs,
      confidence: confidenceToPct(latest.confidence ?? null),
    };
  }, [data]);

  // 기술 호버 — total + 6 metric + signal
  const technicalViz = useMemo<TechnicalAnalysisV4 | null>(() => {
    if (!data) return null;
    return technicalAnalysisV4(
      data.snapshot.technicalHistory,
      data.env.vix.latest[0] ?? null,
      data.env.vix.history,
      data.snapshot.latestSignals,
    );
  }, [data]);

  // 원자재 호버 시 차트 영역에 표시할 데이터 (verdict + 비용/공급/전망)
  const commodityViz = useMemo<CommodityVizData | null>(() => {
    if (!data) return null;
    const rows = data.env.commodities.history;
    if (rows.length === 0) return null;
    const impact = commodityImpactScore(rows);
    const verdict = verdictFromImpactScore(impact.score);
    const cost = costImpactLabel(impact.energyYoy);
    const supply = supplyStabilityLabel(rows);
    const outlook = outlookLabel(rows);
    return {
      verdictLabel: verdict.label,
      verdictColor: verdict.color,
      cost: { label: cost.label, color: cost.color },
      supply: { label: supply.label, color: supply.color },
      outlook: { label: outlook.label, color: outlook.color },
    };
  }, [data]);

  // ── 새 hover 카드용 데이터 (HoverCards.tsx) ──────────────────────────
  const hcFundamental = useMemo<HCFundamentalData | null>(() => {
    if (!fundamentalViz) return null;
    const verdict = verdictFromScore(fundamentalViz.score);
    return {
      totalScore: fundamentalViz.score,
      verdictLabel: verdict.label,
      verdictColor: verdict.color,
      sections: fundamentalViz.sections.map((s) => ({
        key: s.key,
        label: s.label.split(" ")[0] ?? s.label, // "현금흐름 & 안정성" → "현금흐름"
        ratio: s.ratio,
        indicators: s.indicators,
      })),
    };
  }, [fundamentalViz]);

  const hcMacro = useMemo<HCMacroData | null>(() => {
    if (!macroViz) return null;
    if (!macroExtras || !data) {
      return {
        probs: macroViz.probs,
        confidence: macroViz.confidence,
        gScore: null, iScore: null, rScore: null,
      };
    }
    const g = buildGScore(macroExtras.ism, macroExtras.unrate, null);
    const i = buildIScore(macroExtras.cpi, macroExtras.fedfunds, data.env.treasury10y.history);
    const r = buildRScore(
      data.env.highYieldSpread.history,
      data.env.treasury10y.history,
      macroExtras.dgs2,
      macroExtras.m2,
    );
    return {
      probs: macroViz.probs,
      confidence: macroViz.confidence,
      gScore: g.total,
      iScore: i.total,
      rScore: r.total,
    };
  }, [macroViz, macroExtras, data]);

  const hcCommodity = useMemo<HCCommodityData | null>(() => {
    if (!data) return null;
    const rows = data.env.commodities.history;
    if (rows.length === 0) return null;
    const impact = commodityImpactScore(rows);
    const verdict = verdictFromImpactScore(impact.score);
    const cost = costImpactLabel(impact.energyYoy);
    const supply = supplyStabilityLabel(rows);
    const outlook = outlookLabel(rows);
    const dayDelta = scoreDayDelta(rows);
    // dayDelta.display "전날 대비 +N (상승)" 에서 부호 있는 정수 추출
    const dayDeltaNum = (() => {
      const m = dayDelta.display.match(/[-+]?\d+/);
      return m ? parseInt(m[0], 10) : null;
    })();
    return {
      ticker,
      impactScore: impact.score,
      verdictLabel: verdict.label,
      verdictColor: verdict.color,
      dayDelta: dayDeltaNum,
      stats: [
        { label: "비용 영향", value: cost.label, tone: cost.color },
        { label: "공급 안정성", value: supply.label, tone: supply.color },
        { label: "향후 전망", value: outlook.label, tone: outlook.color },
      ],
      categories: [
        { key: "energy",   label: "에너지",   yoy: impact.energyYoy ?? 0 },
        { key: "metal",    label: "산업금속", yoy: impact.metalYoy ?? 0 },
        { key: "precious", label: "귀금속",   yoy: impact.preciousYoy ?? 0 },
        { key: "agri",     label: "농산물",   yoy: impact.agriYoy ?? 0 },
      ],
    };
  }, [data, ticker]);

  // 좌측 기술적 게이지 카드 — V4 totalScore 로 통일 (detail / hover 와 동일 산식).
  // 기존 RSI+VIX 단순 점수는 detail 페이지 산식과 달라 디스플레이 불일치 발생.
  const technicalGaugeAdjusted = useMemo(() => {
    if (!analysis) return null;
    if (!technicalViz) return analysis.gauges.technical;
    const score = technicalViz.totalScore;
    const severity: "INFO" | "CAUTION" | "WARNING" =
      score >= 60 ? "INFO" : score >= 30 ? "CAUTION" : "WARNING";
    return {
      ...analysis.gauges.technical,
      score,
      severity,
    };
  }, [analysis, technicalViz]);

  // 4 게이지 카드 label 셋 통일: POSITIVE / NEUTRAL / NEGATIVE.
  // 산식 (analysis/*.ts) 은 그대로 두고 본 화면 렌더링 단계에서만 severity → label 재매핑.
  //   INFO    → POSITIVE
  //   CAUTION → NEUTRAL
  //   WARNING → NEGATIVE
  // 데이터 부재 (available=false / score=null) 카드는 기존 라벨 ("DATA") 유지.
  const unifyGaugeLabel = (g: GaugeScore): GaugeScore => {
    if (!g.available || g.score == null) return g;
    const label =
      g.severity === "INFO" ? "POSITIVE" : g.severity === "WARNING" ? "NEGATIVE" : "NEUTRAL";
    return { ...g, label };
  };

  return (
    <div style={S.page}>
      <Header onBack={onBack} onSelectTicker={onSelectTicker} />
      <main style={S.canvas}>
        {error && <div style={S.error}>로드 실패: {error}</div>}
        {!error && (!data || !analysis || !compositeTrio) && (
          <div style={S.loading}>분석 중…</div>
        )}
        {data && analysis && compositeTrio && (
          <>
            <StockRow
              name={data.snapshot.company.name ?? ticker}
              ticker={ticker}
              priceMeta={priceMeta}
              marketIndices={data.marketIndices}
            />
            <GaugeChartRow
              ticker={ticker}
              companyName={data.snapshot.company.name ?? ticker}
              fundamental={unifyGaugeLabel(analysis.gauges.fundamental)}
              macro={unifyGaugeLabel(analysis.gauges.macro)}
              commodity={unifyGaugeLabel(analysis.gauges.commodity)}
              technical={unifyGaugeLabel(technicalGaugeAdjusted ?? analysis.gauges.technical)}
              macroDominantPct={dominantRegimePct(data.env.macroRegime.latest)}
              fundamentalViz={fundamentalViz}
              macroViz={macroViz}
              commodityViz={commodityViz}
              technicalViz={technicalViz}
              hcFundamental={hcFundamental}
              hcMacro={hcMacro}
              hcCommodity={hcCommodity}
              onNavigateSection={onNavigateSection}
            />
            <EventsFxRow
              events={analysis.events}
              fxRates={data.fxRates}
              onOpenAllEvents={() => setEventsOpen(true)}
            />
            <CompositeRow items={compositeTrio} />
            <Top3Row screens={data.screens} onSelectTicker={onSelectTicker} />
            <Footer />
          </>
        )}
      </main>
      {eventsOpen && (
        <EventsModal events={allEvents} onClose={() => setEventsOpen(false)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   §1 헤더
   ═══════════════════════════════════════════════════════════════════ */

function Header({ onBack, onSelectTicker }: { onBack: () => void; onSelectTicker: (t: string) => void }) {
  return (
    <header style={S.header}>
      <button type="button" style={S.headerLogo} onClick={onBack} aria-label="진입 화면으로">
        <img src="/invest-lens-logo.svg" alt="" style={S.logoMark} aria-hidden />
        <span style={S.logoWord}>Invest Lens</span>
      </button>
      <GlobalSearch onSelectTicker={onSelectTicker} variant="header" />
      <div />
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   §2 종목 행 + 시장 컨텍스트
   ═══════════════════════════════════════════════════════════════════ */

function StockRow({
  name,
  ticker,
  priceMeta,
  marketIndices,
}: {
  name: string;
  ticker: string;
  priceMeta: { current: number; delta: number | null; pct: number | null } | null;
  marketIndices: Array<MarketIndexResponse | null>;
}) {
  const positive = priceMeta?.delta != null ? priceMeta.delta > 0 : null;
  const priceColor = positive === null ? "#7f7f7f" : positive ? "#4c956c" : "#c1121f";
  return (
    <section style={S.stockRow}>
      <div style={S.stockLeft}>
        <div style={S.stockName}>{name}</div>
        <div style={S.stockPriceLine}>
          {priceMeta ? (
            <>
              <span style={S.stockPriceMain}>{priceMeta.current.toFixed(2)}</span>
              <span style={S.stockPriceUnit}>$</span>
              {priceMeta.delta != null && priceMeta.pct != null && (
                <span style={{ ...S.stockDelta, color: priceColor }}>
                  {" "}{priceMeta.delta >= 0 ? "+" : ""}{priceMeta.delta.toFixed(2)}$ ({priceMeta.pct >= 0 ? "+" : ""}{priceMeta.pct.toFixed(2)}%)
                </span>
              )}
            </>
          ) : (
            <span style={S.stockPriceMain}>{ticker}</span>
          )}
        </div>
      </div>
      <div style={S.marketStripe}>
        {MARKET_INDEX_SYMBOLS.map((sym, i) => {
          const mi = marketIndices[i];
          const label = MARKET_INDEX_LABELS[sym] ?? mi?.name ?? sym;
          const value = mi?.latest?.close != null
            ? `${mi.latest.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : "—";
          const pct = mi?.pct ?? null;
          const color = pct == null ? "#b1b1b1" : pct > 0 ? "#4c956c" : pct < 0 ? "#c1121f" : "#b1b1b1";
          const sign = pct != null && pct > 0 ? "+" : "";
          return (
            <div key={sym} style={S.marketCell}>
              <div style={S.marketLabel}>{label}</div>
              <div style={S.marketValue}>{value}</div>
              <div style={{ ...S.marketDelta, color }}>
                {pct != null ? `${sign}${pct.toFixed(1)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   §3 4 게이지 사이드바 + 차트 (placeholder)
   ═══════════════════════════════════════════════════════════════════ */

type GaugeKey = "fundamental" | "macro" | "commodity" | "technical";

function GaugeChartRow({
  ticker,
  companyName,
  fundamental,
  macro,
  commodity,
  technical,
  macroDominantPct,
  fundamentalViz,
  macroViz,
  commodityViz,
  technicalViz,
  hcFundamental,
  hcMacro,
  hcCommodity,
  onNavigateSection,
}: {
  ticker: string;
  companyName: string;
  fundamental: GaugeScore;
  macro: GaugeScore;
  commodity: GaugeScore;
  technical: GaugeScore;
  macroDominantPct: number | null;
  fundamentalViz: FundamentalVizData | null;
  macroViz: MacroVizData | null;
  commodityViz: CommodityVizData | null;
  technicalViz: TechnicalAnalysisV4 | null;
  hcFundamental: HCFundamentalData | null;
  hcMacro: HCMacroData | null;
  hcCommodity: HCCommodityData | null;
  onNavigateSection?: (s: DetailSection) => void;
}) {
  const [hovered, setHovered] = useState<GaugeKey | null>(null);
  const enter = (k: GaugeKey) => () => setHovered(k);
  const leave = () => setHovered(null);
  return (
    <section style={S.gaugeChartRow}>
      <aside style={S.gaugeStack}>
        <GaugeCard
          title="기업 펀더멘털"
          gauge={fundamental}
          mode="donut"
          onClick={() => onNavigateSection?.("fundamental")}
          onHoverEnter={enter("fundamental")}
          onHoverLeave={leave}
        />
        <GaugeCard
          title="거시 경제"
          gauge={macro}
          mode="regime"
          regimePct={macroDominantPct}
          onClick={() => onNavigateSection?.("macro")}
          onHoverEnter={enter("macro")}
          onHoverLeave={leave}
        />
        <GaugeCard
          title="원자재 영향"
          gauge={commodity}
          // 사용자 요청 — 스코어/도넛 대신 카드 내부에 3 행 신호등 미니 그래프 (비용/공급/전망)
          mode="trafficLight"
          commodityMini={commodityViz}
          onClick={() => onNavigateSection?.("commodity")}
          onHoverEnter={enter("commodity")}
          onHoverLeave={leave}
        />
        <GaugeCard
          title="기술적 지표"
          gauge={technical}
          mode="halfGauge"
          onClick={() => onNavigateSection?.("technical")}
          onHoverEnter={enter("technical")}
          onHoverLeave={leave}
        />
      </aside>
      <ChartPanel
        hovered={hovered}
        ticker={ticker}
        companyName={companyName}
        fundamentalViz={fundamentalViz}
        macroViz={macroViz}
        commodityViz={commodityViz}
        technicalViz={technicalViz}
        hcFundamental={hcFundamental}
        hcMacro={hcMacro}
        hcCommodity={hcCommodity}
      />
    </section>
  );
}

type GaugeMode = "donut" | "regime" | "halfGauge" | "none" | "trafficLight";

// 디테일 §1-B 신호 등급과 동일한 4 segment 정의
const SIGNAL_SEGMENTS: Array<{ label: string; start: number; end: number; color: string }> = [
  { label: "Sell", start: 0, end: 50, color: "#c1121f" },
  { label: "Hold", start: 50, end: 65, color: "#e5af43" },
  { label: "Buy", start: 65, end: 80, color: "#33a316" },
  { label: "Strong buy", start: 80, end: 100, color: "#157f0a" },
];

// score 0~100 → 반원 위 angle (라디안). 0=왼쪽 끝(π), 100=오른쪽 끝(0).
function scoreToAngleRad(score: number): number {
  return Math.PI * (1 - Math.max(0, Math.min(100, score)) / 100);
}

function arcPath(
  scoreStart: number,
  scoreEnd: number,
  r: number,
  cx: number,
  cy: number,
): string {
  const a1 = scoreToAngleRad(scoreStart);
  const a2 = scoreToAngleRad(scoreEnd);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy - r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy - r * Math.sin(a2);
  // sweep-flag 1 (시계 방향, 왼쪽 → 오른쪽 위쪽 호)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

function GaugeCard({
  title,
  gauge,
  mode,
  regimePct,
  commodityMini,
  onClick,
  onHoverEnter,
  onHoverLeave,
}: {
  title: string;
  gauge: GaugeScore;
  mode: GaugeMode;
  regimePct?: number | null;
  commodityMini?: CommodityVizData | null;
  onClick?: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
}) {
  const color = gaugeColor(gauge);
  const taglineText = (gauge.tagline || gauge.label).replace(/\n/g, " ");

  return (
    <button
      type="button"
      style={S.gaugeCard}
      onClick={onClick}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onFocus={onHoverEnter}
      onBlur={onHoverLeave}
    >
      <div style={S.gaugeHead}>
        <span style={S.gaugeTitle}>{title}</span>
        <ChevronRight />
      </div>
      <div style={S.gaugeBody}>
        <div style={S.gaugeLeft}>
          <div style={{ ...S.gaugeLabel, color }}>{gauge.label}</div>
          {mode !== "none" && mode !== "trafficLight" && (
            <div style={S.gaugeScore}>
              {mode === "regime"
                ? taglineText
                : gauge.score != null
                  ? `Score ${gauge.score}/100`
                  : "데이터 없음"}
            </div>
          )}
        </div>
        <div style={S.gaugeRight}>
          {mode === "donut" && <Donut score={gauge.score ?? 0} color={color} size={86} />}
          {mode === "regime" && <StackBar value={regimePct ?? null} color={color} />}
          {mode === "halfGauge" && <HalfGauge score={gauge.score} />}
          {mode === "trafficLight" && <CommodityMiniTraffic data={commodityMini ?? null} />}
        </div>
      </div>
    </button>
  );
}

// 반원 계기판 — 4 segment 호 + 니들 + 호 아래 신호 라벨 (중앙 점수 없음)
// viewBox 폭은 호의 실제 가로 크기(2r + stroke) 에 맞춰 잡아서
// 우측 정렬 시 SVG 내부 여백이 생기지 않게 한다.
function HalfGauge({ score }: { score: number | null }) {
  const r = 50;           // 호 반지름
  const stroke = 16;      // 호 두께 (디테일 1.8배)
  const W = 2 * r + stroke + 2;   // = 111 (좌우 1px 여유)
  const cy = 62;          // 호 중심 (= 반원 아래 라인)
  // SVG 하단 = 반원 아래 라인 + 스트로크 절반 → 가로 baseline 과 정확히 일치
  const H = cy + stroke / 2 + 1;
  const cx = W / 2;

  const safeScore = score == null ? 50 : score;
  const angleDeg = -180 + (Math.max(0, Math.min(100, safeScore)) / 100) * 180;

  const needleLen = r - stroke / 2 - 3;
  const needleHubR = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ display: "block" }}>
      {/* 4 segment 호 */}
      {SIGNAL_SEGMENTS.map((s) => (
        <path
          key={s.label}
          d={arcPath(s.start, s.end, r, cx, cy)}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeLinecap="butt"
        />
      ))}

      {/* 니들 */}
      {score != null && (
        <g transform={`rotate(${angleDeg}, ${cx}, ${cy})`}>
          <line
            x1={cx}
            y1={cy}
            x2={cx + needleLen - 5}
            y2={cy}
            stroke="#003049"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <polygon
            points={`${cx + needleLen},${cy} ${cx + needleLen - 6},${cy - 4} ${cx + needleLen - 6},${cy + 4}`}
            fill="#003049"
          />
          <circle cx={cx} cy={cy} r={needleHubR} fill="#003049" />
          <circle cx={cx} cy={cy} r={needleHubR - 1.5} fill="#ffffff" />
        </g>
      )}
    </svg>
  );
}

// 단일 도미넌트 regime 확률 stack bar — % 라벨 + 채움 바
// % 행은 gaugeLabel(예: NEGATIVE) 과, bar 행은 gaugeScore(예: HARD LANDING) 와
// 동일한 line-height/높이로 맞춰서 좌측 텍스트와 가로 줄을 맞춘다.
function StackBar({
  value,
  color,
  width = 96,
}: {
  value: number | null;
  color: string;
  width?: number;
}) {
  const pct = value == null ? null : Math.max(0, Math.min(100, value));
  // gaugeLabel: fontSize 19, lineHeight 1.05 → 약 20px
  // gaugeScore: fontSize 15, default lineHeight ≈ 18px
  const labelRowH = 20;
  const barRowH = 18;
  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
      {/* 라벨 행 — gaugeLabel 과 동일 라인 박스 */}
      <div style={{ width: "100%", display: "flex", height: labelRowH, alignItems: "center" }}>
        <div
          style={{
            width: pct == null ? "100%" : `${pct}%`,
            textAlign: pct == null ? "right" : "center",
            whiteSpace: "nowrap",
            overflow: "visible",
            fontSize: 16,
            fontWeight: 700,
            color,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.05,
          }}
        >
          {pct == null ? "—" : `${Math.round(pct)}%`}
        </div>
      </div>
      {/* bar 행 — gaugeScore 와 동일 라인 박스 안에 bar 를 수직 가운데 정렬 */}
      <div style={{ width: "100%", height: barRowH, display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: "100%",
            height: 10,
            borderRadius: 5,
            background: "#ececec",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: pct == null ? "0%" : `${pct}%`,
              height: "100%",
              background: color,
              borderRadius: 5,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// 카드 내부 미니 신호등 — 비용 / 공급 / 전망 3 행, dot 색은 각 label color
function CommodityMiniTraffic({ data }: { data: CommodityVizData | null }) {
  const rows: Array<{ label: string; color: string }> = data
    ? [
        { label: "비용", color: data.cost.color },
        { label: "공급", color: data.supply.color },
        { label: "전망", color: data.outlook.color },
      ]
    : [
        { label: "비용", color: "#ececec" },
        { label: "공급", color: "#ececec" },
        { label: "전망", color: "#ececec" },
      ];
  return (
    <div style={S.miniTrafficWrap}>
      {rows.map((r) => (
        <div key={r.label} style={S.miniTrafficRow}>
          <span style={S.miniTrafficLabel}>{r.label}</span>
          <span style={{ ...S.miniTrafficDot, background: r.color }} aria-hidden />
        </div>
      ))}
    </div>
  );
}

// 게이지 호버 시 표시할 시각화 메타 — 실제 차트는 추후 매핑.
const GAUGE_VIZ_META: Record<GaugeKey, { title: string; placeholder: string }> = {
  fundamental: { title: "기업 펀더멘털 시각화", placeholder: "펀더멘털 시각화 (예정)" },
  macro: { title: "거시 경제 시각화", placeholder: "거시 경제 시각화 (예정)" },
  commodity: { title: "원자재 영향 시각화", placeholder: "원자재 영향 시각화 (예정)" },
  technical: { title: "기술적 지표 시각화", placeholder: "기술적 지표 시각화 (예정)" },
};

function ChartPanel({
  hovered,
  ticker,
  companyName,
  fundamentalViz,
  macroViz,
  commodityViz,
  technicalViz,
  hcFundamental,
  hcMacro,
  hcCommodity,
}: {
  hovered: GaugeKey | null;
  ticker: string;
  companyName: string;
  fundamentalViz: FundamentalVizData | null;
  macroViz: MacroVizData | null;
  commodityViz: CommodityVizData | null;
  technicalViz: TechnicalAnalysisV4 | null;
  hcFundamental: HCFundamentalData | null;
  hcMacro: HCMacroData | null;
  hcCommodity: HCCommodityData | null;
}) {
  // 새 hover 카드 시각 (HoverCards.tsx). 4 카드 모두 호버 시 ChartPanel 채움.
  // key prop 으로 호버 전환마다 컴포넌트 재마운트 → 진입 애니메이션 재생.
  if (hovered === "fundamental" && hcFundamental) {
    return (
      <div style={S.chartPanel} key="hover-fundamental">
        <FundamentalHover data={hcFundamental} />
      </div>
    );
  }
  if (hovered === "commodity" && hcCommodity) {
    return (
      <div style={S.chartPanel} key="hover-commodity">
        <CommodityHover data={hcCommodity} />
      </div>
    );
  }
  if (hovered === "macro" && hcMacro) {
    return (
      <div style={S.chartPanel} key="hover-macro">
        <MacroHover data={hcMacro} />
      </div>
    );
  }
  if (hovered === "technical" && technicalViz) {
    return (
      <div style={S.chartPanel} key="hover-technical">
        <TechnicalHover data={technicalViz} />
      </div>
    );
  }
  // unused — 기존 panel 들도 컴파일 보존을 위해 참조 유지
  void fundamentalViz; void macroViz; void commodityViz;
  // 기본 — 회사 요약
  return (
    <div style={S.chartPanel}>
      <CompanySummaryPanel ticker={ticker} companyName={companyName} />
    </div>
  );
}

/* ─── 거시 호버 패널 ─── */

interface MacroVizData {
  probs: ReturnType<typeof regimeProbs>;
  confidence: string | null;
}

const REGIME_META: Record<RegimeKey, { label: string; color: string; bg: string }> = {
  softLanding: { label: "Soft Landing", color: "#60c846", bg: "#e4ffdf" },
  noLanding: { label: "No Landing", color: "#4073ff", bg: "#e8eeff" },
  recovery: { label: "Recovery", color: "#fdb43a", bg: "#fff5e1" },
  hardLanding: { label: "Hard Landing", color: "#c1121f", bg: "#ffe4e4" },
};

function MacroVizPanel({ data }: { data: MacroVizData }) {
  // 호버 진입 시 0 → 목표 pct 트랜지션
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);
  const dominant = data.probs.find((p) => p.isDominant) ?? null;
  // 확률 순(내림차순) 정렬 — 도미넌트가 최상단
  const sorted = [...data.probs].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  return (
    <div style={S.mvPanel}>
      <div style={S.mvHead}>
        <span style={S.mvHeadTitle}>거시 경제</span>
        <span style={S.mvHeadDivider}>·</span>
        <span style={S.mvHeadSub}>현재 국면 확률</span>
      </div>
      {dominant && (
        <div style={S.mvDominant}>
          <span style={S.mvDominantLabel}>도미넌트</span>
          <span
            style={{
              ...S.mvDominantValue,
              color: REGIME_META[dominant.key].color,
            }}
          >
            {REGIME_META[dominant.key].label}
          </span>
          {data.confidence && (
            <span style={S.mvDominantConfidence}>신뢰도 {data.confidence}</span>
          )}
        </div>
      )}
      <ul style={S.mvList}>
        {sorted.map((p, i) => {
          const meta = REGIME_META[p.key];
          const pct = p.pct == null ? 0 : Math.max(0, Math.min(100, p.pct));
          const target = animated ? pct : 0;
          return (
            <li key={p.key} style={S.mvRow}>
              <span style={{ ...S.mvLabel, color: meta.color }}>{meta.label}</span>
              <div style={S.mvBarTrack}>
                <div
                  style={{
                    ...S.mvBarFill,
                    width: `${target}%`,
                    background: meta.color,
                    transition: `width 0.7s ease-out ${i * 0.05}s`,
                  }}
                />
              </div>
              <span style={S.mvPct}>{p.pct == null ? "—" : `${Math.round(pct)}%`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── 기술 호버 패널 ─── */

const TECH_SIGNAL_LABEL: Record<string, { label: string; color: string }> = {
  STRONG_BUY: { label: "Strong Buy", color: "#157f0a" },
  BUY: { label: "Buy", color: "#33a316" },
  HOLD: { label: "Hold", color: "#e5af43" },
  SELL: { label: "Sell", color: "#c1121f" },
  STRONG_SELL: { label: "Strong Sell", color: "#7e0a14" },
};

// 신호 등급 segment 정의 (디테일 페이지와 동일)
const TV_SIGNAL_SEGMENTS: Array<{ label: string; start: number; end: number; color: string }> = [
  { label: "Sell", start: 0, end: 50, color: "#c1121f" },
  { label: "Hold", start: 50, end: 65, color: "#e5af43" },
  { label: "Buy", start: 65, end: 80, color: "#33a316" },
  { label: "Strong Buy", start: 80, end: 100, color: "#157f0a" },
];

function activeTvSegment(score: number): typeof TV_SIGNAL_SEGMENTS[number] {
  const v = Math.max(0, Math.min(100, score));
  for (const seg of TV_SIGNAL_SEGMENTS) {
    if (v >= seg.start && v < seg.end) return seg;
  }
  return TV_SIGNAL_SEGMENTS[TV_SIGNAL_SEGMENTS.length - 1]!;
}

function TechnicalVizPanel({ data }: { data: TechnicalAnalysisV4 }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);
  const sig = TECH_SIGNAL_LABEL[data.signal] ?? TECH_SIGNAL_LABEL.HOLD!;
  const scoreColorVal =
    data.totalScore >= 65 ? "#60c846" : data.totalScore >= 50 ? "#e5af43" : "#c1121f";
  return (
    <div style={S.tvPanel}>
      <div style={S.tvHead}>
        <span style={S.tvHeadTitle}>기술적 지표</span>
        <span style={S.tvHeadDivider}>·</span>
        <span style={S.tvHeadSub}>종합 점수 / 신호 등급</span>
      </div>
      <div style={S.tvScoreRow}>
        <div style={S.tvScoreBlock}>
          <span style={S.tvScoreLabel}>종합 점수</span>
          <span style={{ ...S.tvScoreValue, color: scoreColorVal }}>
            {data.totalScore}
            <span style={S.tvScoreMax}>/100</span>
          </span>
        </div>
        <div style={S.tvSignalBlock}>
          <span style={S.tvScoreLabel}>신호 등급</span>
          <span style={{ ...S.tvSignalValue, color: sig.color }}>{sig.label}</span>
        </div>
      </div>
      {/* 신호 등급 바 — 4 segment + marker + tick */}
      <SignalGaugeBarMini score={data.totalScore} animated={animated} />
      <div style={S.tvMetricsGrid}>
        {data.metrics.map((m, i) => (
          <TechnicalMetricTile key={m.key} metric={m} animated={animated} delay={i * 0.05} />
        ))}
      </div>
    </div>
  );
}

function SignalGaugeBarMini({ score, animated }: { score: number; animated: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const seg = activeTvSegment(score);
  const target = animated ? pct : 0;
  return (
    <div style={S.tvSignalGaugeWrap}>
      {/* badge — marker 위에 segment 라벨 (디테일 페이지와 동일 레이아웃) */}
      <div
        style={{
          ...S.tvSignalBadge,
          left: `${target}%`,
          color: seg.color,
          borderColor: seg.color,
          transition: "left 0.7s ease-out",
        }}
      >
        {seg.label}
      </div>
      {/* marker — 스택 바 위, 아래(바)를 가리키는 ▼ */}
      <div
        style={{
          ...S.tvSignalMarker,
          left: `${target}%`,
          transition: "left 0.7s ease-out",
        }}
      >
        <svg width="10" height="9" viewBox="0 0 10 9" style={{ display: "block" }}>
          <polygon points="5,9 0,0 10,0" fill="#003049" />
        </svg>
      </div>
      {/* stack bar */}
      <div style={S.tvSignalBar}>
        {TV_SIGNAL_SEGMENTS.map((s) => {
          const width = s.end - s.start;
          return (
            <div
              key={s.label}
              style={{
                ...S.tvSignalSeg,
                width: `${width}%`,
                background: s.color,
              }}
            />
          );
        })}
      </div>
      {/* ticks */}
      <div style={S.tvSignalTicks}>
        {[0, 50, 65, 80, 100].map((t) => (
          <span key={t} style={{ ...S.tvSignalTick, left: `${t}%` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function TechnicalMetricTile({
  metric,
  animated,
  delay,
}: {
  metric: TechnicalMetricScore;
  animated: boolean;
  delay: number;
}) {
  const ratio = metric.available ? metric.score / metric.max : 0;
  const color =
    !metric.available
      ? "#a3a3a3"
      : ratio >= 0.66
        ? "#60c846"
        : ratio >= 0.4
          ? "#e5af43"
          : "#c1121f";
  const target = animated ? Math.max(0, Math.min(100, ratio * 100)) : 0;
  return (
    <div style={S.tvTile}>
      <div style={S.tvTileHead}>
        <span style={S.tvTileLabel}>{metric.label}</span>
        <span style={S.tvTileScore}>
          {metric.available ? `${Math.round(metric.score)}/${metric.max}` : "—"}
        </span>
      </div>
      <div style={S.tvTileBarTrack}>
        <div
          style={{
            ...S.tvTileBarFill,
            width: `${target}%`,
            background: color,
            transition: `width 0.7s ease-out ${delay}s`,
          }}
        />
      </div>
    </div>
  );
}

/* ─── 기본 상태 — 회사 요약 + 가격 sparkline ─── */

function CompanySummaryPanel({
  ticker,
  companyName,
}: {
  ticker: string;
  companyName: string;
}) {
  const entry = findSp500Entry(ticker);
  const description = entry?.description ?? "회사 설명 데이터가 등록되지 않은 종목입니다.";
  return (
    <div style={S.csPanel}>
      <div style={S.csInner}>
        <div style={S.csTitleBlock}>
          <span style={S.csCompany}>{entry?.name ?? companyName}</span>
          <span style={S.csTicker}>{ticker}</span>
        </div>
        <p style={S.csDescription}>{description}</p>
        <span style={S.csHint}>좌측 게이지에 마우스를 올리면 상세 시각화가 표시됩니다.</span>
      </div>
    </div>
  );
}

/* ─── 원자재 호버 시각화 ─── */

interface CommodityVizData {
  verdictLabel: string;       // POSITIVE / NEUTRAL / NEGATIVE
  verdictColor: string;
  cost: { label: string; color: string };
  supply: { label: string; color: string };
  outlook: { label: string; color: string };
}

function CommodityVizPanel({ data }: { data: CommodityVizData }) {
  return (
    <div style={S.cvPanel}>
      <div style={S.cvHead}>
        <span style={S.cvHeadTitle}>원자재 영향</span>
        <span style={S.cvHeadDivider}>·</span>
        <span style={S.cvHeadSub}>핵심 요약</span>
      </div>
      <div style={S.cvTrafficRow}>
        <TrafficLightCol title="비용 영향" item={data.cost} />
        <TrafficLightCol title="공급 안정성" item={data.supply} />
        <TrafficLightCol title="향후 전망" item={data.outlook} />
      </div>
    </div>
  );
}

// 신호등 색 매핑 — costImpactLabel/supplyStabilityLabel/outlookLabel 의 color 와 일치
const TRAFFIC_COLORS = {
  red: "#c1121f",
  yellow: "#f8eb37",
  green: "#60c846",
};

// active = "red" | "yellow" | "green" | null (데이터 없음)
function trafficActiveFromColor(color: string): "red" | "yellow" | "green" | null {
  if (color === TRAFFIC_COLORS.red) return "red";
  if (color === TRAFFIC_COLORS.yellow) return "yellow";
  if (color === TRAFFIC_COLORS.green) return "green";
  return null;
}

function TrafficLightCol({
  title,
  item,
}: {
  title: string;
  item: { label: string; color: string };
}) {
  const active = trafficActiveFromColor(item.color);
  return (
    <div style={S.cvTrafficCol}>
      <div style={S.cvTrafficTitle}>{title}</div>
      <div style={S.cvTrafficBox}>
        <TrafficCircle color={TRAFFIC_COLORS.red} on={active === "red"} />
        <TrafficCircle color={TRAFFIC_COLORS.yellow} on={active === "yellow"} />
        <TrafficCircle color={TRAFFIC_COLORS.green} on={active === "green"} />
      </div>
      <div style={{ ...S.cvTrafficValue, color: item.color }}>
        {item.label}
      </div>
    </div>
  );
}

function TrafficCircle({ color, on }: { color: string; on: boolean }) {
  return (
    <span
      style={{
        ...S.cvTrafficDot,
        background: on ? color : "#ececec",
        boxShadow: on ? `0 0 12px ${color}66` : "none",
        opacity: on ? 1 : 0.5,
      }}
      aria-hidden
    />
  );
}

/* ─── Fundamental 호버 시각화 ─── */

interface FundamentalVizSection {
  key: "cashflow" | "profitability" | "valuation" | "growth";
  label: string;
  score: number | null;
  max: number;
  ratio: number;          // 0~1, 레이더 거리
  sectionColor: string;   // 섹션별 충족도 색
  indicators: Array<{ label: string; value: string }>;
}

interface FundamentalVizData {
  score: number | null;   // totalFromSections
  color: string;          // 종합 색
  sections: FundamentalVizSection[];
}

function buildFundamentalVizData(
  f: NonNullable<CompanySnapshot["latestFundamentals"]>,
): FundamentalVizData {
  const sections = sectionScores(f);
  const total = totalFromSections(sections);
  const overallColor =
    total == null
      ? "#7f7f7f"
      : total >= 60
        ? "#43bb2e"
        : total >= 30
          ? "#e5af43"
          : "#c1121f";

  const inds: Record<FundamentalVizSection["key"], Array<{ label: string; value: string }>> = {
    cashflow: [
      { label: "FCF Margin", value: fmtPct(f.fcfMargin) },
      { label: "FCF Yield", value: fmtPct(f.fcfYield, 2) },
    ],
    profitability: [
      { label: "ROE", value: fmtPct(f.roe) },
      { label: "Net Margin", value: fmtPct(f.netProfitMargin) },
    ],
    valuation: [
      { label: "PER", value: fmtMultiple(f.per) },
      { label: "PBR", value: fmtMultiple(f.pbr) },
    ],
    growth: [
      { label: "Rev Growth", value: fmtPctSigned(f.revenueGrowth) },
      { label: "EPS Growth", value: fmtPctSigned(f.epsGrowth) },
    ],
  };

  return {
    score: total,
    color: overallColor,
    sections: sections.map((s) => {
      const ratio = s.score == null ? 0 : s.score / s.max;
      const sectionColor =
        s.score == null
          ? "#7f7f7f"
          : ratio >= 0.6
            ? "#43bb2e"
            : ratio >= 0.3
              ? "#e5af43"
              : "#c1121f";
      return {
        key: s.key,
        label: s.label,
        score: s.score,
        max: s.max,
        ratio,
        sectionColor,
        indicators: inds[s.key],
      };
    }),
  };
}

// 디테일 ScoreDistributionSection 의 SD_COLOR 와 동일 매핑
const SECTION_COLOR: Record<FundamentalVizSection["key"], string> = {
  cashflow: "#43bb2e",
  profitability: "#5b8bd9",
  valuation: "#e5af43",
  growth: "#c1121f",
};

function FundamentalVizPanel({ data }: { data: FundamentalVizData }) {
  // 호버 진입 시 0 → 목표 ratio 까지 트랜지션
  const [animated, setAnimated] = useState(false);
  // cross-highlight (도넛 ↔ row 양방향)
  const [hoveredKey, setHoveredKey] = useState<FundamentalVizSection["key"] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={S.fvPanel}>
      <div style={S.fvDonutCol}>
        <ScoreDistDonut
          sections={data.sections}
          animated={animated}
          hoveredKey={hoveredKey}
          onHoverKey={setHoveredKey}
          centerScore={data.score}
          centerColor={data.color}
        />
      </div>
      <div style={S.fvRowsCol}>
        <ScoreDistRows
          sections={data.sections}
          animated={animated}
          hoveredKey={hoveredKey}
          onHoverKey={setHoveredKey}
        />
      </div>
    </div>
  );
}

function ScoreDistDonut({
  sections,
  animated,
  hoveredKey,
  onHoverKey,
  centerScore,
  centerColor,
}: {
  sections: FundamentalVizSection[];
  animated: boolean;
  hoveredKey: FundamentalVizSection["key"] | null;
  onHoverKey: (k: FundamentalVizSection["key"] | null) => void;
  centerScore: number | null;
  centerColor: string;
}) {
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const r = 76;
  const thickness = 22;
  const circ = 2 * Math.PI * r;
  const totalMax = sections.reduce((a, b) => a + b.max, 0);
  let cum = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <circle cx={cx} cy={cy} r={r} stroke="#ececec" strokeWidth={thickness} fill="none" />
        {sections.map((s) => {
          const ratio = (s.score ?? 0) / totalMax;
          const targetDash = animated ? ratio * circ : 0;
          const dashOff = -cum * circ;
          cum += ratio;
          const color = SECTION_COLOR[s.key];
          const isHovered = hoveredKey === s.key;
          const isOther = hoveredKey != null && !isHovered;
          return (
            <circle
              key={s.key}
              cx={cx}
              cy={cy}
              r={r}
              stroke={color}
              strokeWidth={isHovered ? thickness + 4 : thickness}
              fill="none"
              strokeDasharray={`${targetDash} ${circ}`}
              strokeDashoffset={dashOff}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
              style={{
                transition:
                  "stroke-dasharray 0.75s ease-out, stroke-width 0.18s ease, opacity 0.18s ease",
                opacity: isOther ? 0.32 : 1,
                cursor: "pointer",
              }}
              onMouseEnter={() => onHoverKey(s.key)}
              onMouseLeave={() => onHoverKey(null)}
            />
          );
        })}
      </svg>
      <div style={S.fvDonutCenter}>
        <span style={{ ...S.fvDonutScore, color: centerColor }}>
          {centerScore == null ? "—" : centerScore}
        </span>
        <span style={S.fvDonutLabel}>총점</span>
      </div>
    </div>
  );
}

function ScoreDistRows({
  sections,
  animated,
  hoveredKey,
  onHoverKey,
}: {
  sections: FundamentalVizSection[];
  animated: boolean;
  hoveredKey: FundamentalVizSection["key"] | null;
  onHoverKey: (k: FundamentalVizSection["key"] | null) => void;
}) {
  return (
    <div style={S.fvRowsList}>
      {sections.map((s, i) => {
        const ratio = s.score == null ? 0 : s.score / s.max;
        const color = SECTION_COLOR[s.key];
        const isHovered = hoveredKey === s.key;
        const isOther = hoveredKey != null && !isHovered;
        const targetW = animated ? ratio * 100 : 0;
        return (
          <Fragment key={s.key}>
            {i > 0 && <div style={S.fvRowDivider} />}
            <div
              style={{
                ...S.fvRow,
                background: isHovered ? `${color}10` : "transparent",
                opacity: isOther ? 0.55 : 1,
                transition: "background 0.18s ease, opacity 0.18s ease",
              }}
              onMouseEnter={() => onHoverKey(s.key)}
              onMouseLeave={() => onHoverKey(null)}
            >
              <span
                style={{
                  ...S.fvRowIconBg,
                  background: `${color}1f`,
                }}
              >
                <SectionIcon kind={s.key} color={color} />
              </span>
              <span style={S.fvRowLabel}>{s.label}</span>
              <div style={S.fvRowBarTrack}>
                <div
                  style={{
                    ...S.fvRowBarFill,
                    width: `${targetW}%`,
                    background: color,
                    transition: `width 0.8s ease-out ${i * 0.08}s`,
                  }}
                />
              </div>
              <span style={S.fvRowScore}>
                {s.score == null ? `— / ${s.max}` : `${s.score} / ${s.max}`}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

// 4 섹션 아이콘 — 디테일 ValuationCategoryIcon 의 인라인 버전
function SectionIcon({ kind, color }: { kind: FundamentalVizSection["key"]; color: string }) {
  if (kind === "cashflow") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <text x="12" y="16" fontSize="11" fontWeight="700" fill={color} textAnchor="middle">$</text>
      </svg>
    );
  }
  if (kind === "profitability") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="14" width="3" height="6" fill={color} />
        <rect x="10" y="10" width="3" height="10" fill={color} />
        <rect x="16" y="6" width="3" height="14" fill={color} />
      </svg>
    );
  }
  if (kind === "valuation") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12 12 3 21 12 12 21 Z"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  // growth
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 18 10 12 14 16 20 8"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 8 H20 V14" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtPctSigned(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const x = (v * 100).toFixed(digits);
  return v >= 0 ? `+${x}%` : `${x}%`;
}
function fmtMultiple(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}×`;
}

/* ═══════════════════════════════════════════════════════════════════
   §4 주요 이벤트 + 환율 (2-col)
   ═══════════════════════════════════════════════════════════════════ */

function EventsFxRow({
  events,
  fxRates,
  onOpenAllEvents,
}: {
  events: AnalysisEvent[];
  fxRates: Array<FxRateResponse | null>;
  onOpenAllEvents: () => void;
}) {
  return (
    <section style={S.twoCol}>
      <Card>
        <CardHeader
          title="주요 이벤트"
          right={
            <button type="button" style={S.moreBtn} onClick={onOpenAllEvents}>
              더보기 ›
            </button>
          }
        />
        <ul style={S.eventList}>
          {events.length === 0 && <li style={S.empty}>표시할 이벤트가 없습니다.</li>}
          {(() => {
            const shown = events.slice(0, 5);
            return shown.map((e, i) => {
              const { year, day, mon } = parseEventDate(e.date);
              const prevYear = i > 0 ? parseEventDate(shown[i - 1]!.date).year : null;
              const showYearHeader = year !== prevYear;
              const showDivider = i > 0 && !showYearHeader;
              return (
                <Fragment key={i}>
                  {showYearHeader && (
                    <li style={{ ...S.yearHeader, ...(i > 0 ? S.yearHeaderMid : null) }}>
                      {year}
                    </li>
                  )}
                  <li
                    style={{
                      ...S.eventRow,
                      ...(showDivider ? S.rowDivider : null),
                    }}
                  >
                    <div style={S.eventDateBlock}>
                      <span style={S.eventDay}>{day}</span>
                      <span style={S.eventMon}>{mon}</span>
                    </div>
                    <div style={S.eventBody}>
                      <div style={S.eventTopLine}>
                        <span style={S.eventTitle}>{e.title}</span>
                        {e.category && <span style={S.eventTag}>{e.category}</span>}
                        {e.time && <span style={S.eventTime}>{e.time}</span>}
                      </div>
                      {e.detail && <div style={S.eventSub}>{e.detail}</div>}
                    </div>
                  </li>
                </Fragment>
              );
            });
          })()}
        </ul>
      </Card>
      <Card>
        <CardHeader title="환율" />
        <ul style={S.fxList}>
          {FX_PAIRS.map((pair, i) => {
            const fr = fxRates[i];
            const meta = FX_LABELS[pair] ?? { code: pair, sub: "" };
            const value = fr?.latest?.close != null
              ? fr.latest.close.toLocaleString(undefined, { maximumFractionDigits: 4 })
              : "—";
            const positive = fr?.pct != null ? fr.pct > 0 : null;
            const deltaColor = positive == null ? "#7f7f7f" : positive ? "#60c846" : "#c1121f";
            const deltaText =
              fr?.delta != null && fr.pct != null
                ? `${fr.delta >= 0 ? "+" : ""}${fr.delta.toFixed(2)} (${fr.pct >= 0 ? "+" : ""}${fr.pct.toFixed(2)}%)`
                : "—";
            const sparkValues = (fr?.history ?? []).map((h) => h.close);
            return (
              <li
                key={pair}
                style={{
                  ...S.fxRow,
                  ...(i > 0 ? S.rowDivider : null),
                }}
              >
                <div style={S.fxLabelCol}>
                  <span style={S.fxCode}>{meta.code}</span>
                  <span style={S.fxSub}>{meta.sub}</span>
                </div>
                <div style={S.fxSparkCol}>
                  {sparkValues.length > 1 ? (
                    <Sparkline values={sparkValues} width="100%" height={32} color={deltaColor} strokeWidth={1.6} />
                  ) : (
                    <span style={S.fxSparkEmpty}>—</span>
                  )}
                </div>
                <div style={S.fxValueCol}>
                  <span style={S.fxValue}>{value}</span>
                  <span style={{ ...S.fxDelta, color: deltaColor }}>{deltaText}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   §5 종합 점수 3중
   ═══════════════════════════════════════════════════════════════════ */

interface TrioItem {
  label: string;
  score: number | null;
  comparison: string;
  deltaText: string;
  positive: boolean | null;
  history: Array<number | null>;
}

function CompositeRow({ items }: { items: TrioItem[] }) {
  // 사용자 요청 — 종합 점수 카드의 점수 / 그래프 색을 검정으로 통일.
  // 점수가 null 일 때만 회색 placeholder.
  const BLACK = "#000000";
  return (
    <section style={S.compositeRow}>
      {items.map((c, i) => {
        const color = c.score == null ? "#7f7f7f" : BLACK;
        const deltaColor = c.positive === null ? "#7f7f7f" : c.positive ? "#60c846" : "#c1121f";
        const arrow = c.positive === null ? "" : c.positive ? "▲" : "▼";
        return (
          <Card key={i} pad="lg">
            <div style={S.compHead}>{c.label}</div>
            <div style={S.compBody}>
              <div style={{ ...S.compScore, color }}>
                {c.score == null ? "—" : c.score.toFixed(1)}
              </div>
              <div style={S.compSpark}>
                <Sparkline values={c.history} width="100%" height={56} color={color} strokeWidth={2} />
              </div>
            </div>
            <div style={{ ...S.compDelta, color: deltaColor }}>
              {c.comparison} {arrow} {c.deltaText}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   §6 TOP 3 × 4
   ═══════════════════════════════════════════════════════════════════ */

function Top3Row({
  screens,
  onSelectTicker,
}: {
  screens: DashState["screens"];
  onSelectTicker: (t: string) => void;
}) {
  const cards = [
    { title: "어제 가장 많이 오른 주식 TOP 3", tone: "up" as const, bg: "#f6fff4", items: screens.priceUp, fmt: formatPct },
    { title: "어제 가장 많이 거래된 주식 TOP 3", tone: "info" as const, bg: "#fafdff", items: screens.volume, fmt: formatVolume },
    { title: "어제 가장 많이 떨어진 주식 TOP 3", tone: "down" as const, bg: "#fff4f5", items: screens.priceDown, fmt: formatPct },
    { title: "어제 점수가 좋았던 주식 TOP 3", tone: "score" as const, bg: "#fffdf9", items: screens.scoreTop, fmt: formatScore },
  ];
  return (
    <section style={S.top3Row}>
      {cards.map((card, idx) => {
        const numColor =
          card.tone === "up"
            ? "#60c846"
            : card.tone === "info"
              ? "#267bea"
              : card.tone === "down"
                ? "#c1121f"
                : "#003049";
        return (
          <div key={idx} style={{ ...S.top3Card, background: card.bg }}>
            <div style={S.top3Title}>{card.title}</div>
            <ol style={S.top3List}>
              {card.items.length === 0 && <li style={S.empty}>데이터 없음</li>}
              {card.items.slice(0, 3).map((it, i) => (
                <li key={`${it.ticker}-${i}`}>
                  <button
                    type="button"
                    style={S.top3RowBtn}
                    onClick={() => onSelectTicker(it.ticker)}
                    title={`${it.ticker} 개별 주식 화면`}
                  >
                    <span style={S.top3Rank}>{i + 1}</span>
                    <span style={S.top3Ticker}>
                      <span style={S.top3TickerCode}>{it.ticker}</span>
                      {it.name && <span style={S.top3TickerKor}>{it.name}</span>}
                    </span>
                    <span style={{ ...S.top3Primary, color: numColor }}>{card.fmt(it.metric)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   §7 풋터
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   §7-Modal 주요 이벤트 더보기
   ═══════════════════════════════════════════════════════════════════ */

function EventsModal({
  events,
  onClose,
}: {
  events: AnalysisEvent[];
  onClose: () => void;
}) {
  // ESC 닫기 + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      style={S.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="events-modal-title"
    >
      <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span id="events-modal-title" style={S.modalTitle}>
            주요 이벤트 ({events.length}건)
          </span>
          <button type="button" style={S.modalClose} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <ul style={S.modalBody}>
          {events.length === 0 && <li style={S.empty}>표시할 이벤트가 없습니다.</li>}
          {events.map((e, i) => {
            const { year, day, mon } = parseEventDate(e.date);
            const prevYear = i > 0 ? parseEventDate(events[i - 1]!.date).year : null;
            const showYearHeader = year !== prevYear;
            const showDivider = i > 0 && !showYearHeader;
            return (
              <Fragment key={i}>
                {showYearHeader && (
                  <li style={{ ...S.yearHeader, ...(i > 0 ? S.yearHeaderMid : null) }}>
                    {year}
                  </li>
                )}
                <li
                  style={{
                    ...S.modalEventRow,
                    ...(showDivider ? S.rowDivider : null),
                  }}
                >
                  <div style={S.eventDateBlock}>
                    <span style={S.eventDay}>{day}</span>
                    <span style={S.eventMon}>{mon}</span>
                  </div>
                  <div style={S.eventBody}>
                    <div style={S.eventTopLine}>
                      <span style={S.eventTitle}>{e.title}</span>
                      {e.category && <span style={S.eventTag}>{e.category}</span>}
                      {e.time && <span style={S.eventTime}>{e.time}</span>}
                    </div>
                    {e.detail && <div style={S.eventSub}>{e.detail}</div>}
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={S.footer}>
      <span>본 정보는 투자 참고용이며 투자 결정의 책임은 투자자 본인에게 있습니다.</span>
      <span>데이터 제공: yfinance, FRED, 자체 분석 엔진</span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   재사용 컴포넌트 / SVG
   ═══════════════════════════════════════════════════════════════════ */

function Card({ children, pad = "md" }: { children: ReactNode; pad?: "md" | "lg" }) {
  return (
    <div style={{ ...S.card, padding: pad === "lg" ? "20px 22px" : "16px 18px" }}>
      {children}
    </div>
  );
}

function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={S.cardHead}>
      <span style={S.cardTitle}>{title}</span>
      {right}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="#7f7f7f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ score, color, size = 86 }: { score: number; color: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} stroke="#ececec" strokeWidth={stroke} fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 25,
          fontWeight: 700,
          color,
          fontFamily: "var(--font-numeric, sans-serif)",
        }}
      >
        {score}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

// 시안 매핑: 점수 ≥60 → 그린 / 30~59 → 레드 / <30 → 블랙(EXTREME FEAR 톤)
function scoreColor(score: number | null): string {
  if (score == null) return "#7f7f7f";
  if (score >= 60) return "#60c846";
  if (score >= 30) return "#c1121f";
  return "#000000";
}

// regime 모드 게이지(거시 경제)는 score 가 null/낮음이어도 라벨 기반으로 색 결정.
function gaugeColor(g: GaugeScore): string {
  const label = (g.label || "").trim().toUpperCase();
  if (label.includes("GOOD") || label.includes("POSITIVE") || label.includes("GREED")) return "#60c846";
  if (label.includes("NEUTRAL")) return "#60c846";
  if (label.includes("EXTREME") || label === "FEAR") return "#000000";
  if (label.includes("NEGATIVE") || label.includes("WARNING")) return "#c1121f";
  if (g.score != null) return scoreColor(g.score);
  return severityHex(g.severity);
}

function severityHex(s: Severity): string {
  if (s === "INFO") return "#60c846";
  if (s === "CAUTION") return "#ff9737";
  if (s === "WARNING") return "#c1121f";
  return "#7f7f7f";
}

// 도미넌트 regime 확률(%) — 메인 게이지의 stack bar 값.
function dominantRegimePct(latest: DashboardEnvironment["macroRegime"]["latest"]): number | null {
  const probs = regimeProbs(latest);
  const dom = probs.find((p) => p.isDominant);
  return dom?.pct ?? null;
}

function buildTrioItems(data: DashState): TrioItem[] {
  const dailyYear = buildDailyComposite({
    snapshot: data.snapshot,
    vixHistory: data.env.vix.history,
    macroHistory: data.env.macroRegime.history,
    commodityHistory: data.env.commodities.history,
    days: 252,
  });
  const fullYearSeries = overallSeries(dailyYear);
  const todaySeries = fullYearSeries.slice(0, 7);
  const monthSeries = fullYearSeries.slice(0, 30);
  const currentYear = new Date().getUTCFullYear();
  const yearSeries = fullYearSeries.filter((p) => Number(p.date.slice(0, 4)) === currentYear);
  const yearOrFallback = yearSeries.length > 0 ? yearSeries : monthSeries;

  const todayDelta = deltaFromSeries(todaySeries);
  const monthDelta = windowDelta(monthSeries, "전월 대비");
  const yearDelta = windowDelta(yearOrFallback, "전년 대비");

  return [
    {
      label: "오늘 종합 점수",
      score: todaySeries[0]?.score ?? null,
      comparison: todayDelta?.comparison ?? "전일 대비",
      deltaText: todayDelta?.text ?? "—",
      positive: todayDelta?.positive ?? null,
      history: toSparkline(todaySeries),
    },
    {
      label: "이번 달 종합 점수",
      score: averageScore(monthSeries),
      comparison: monthDelta?.comparison ?? "전월 대비",
      deltaText: monthDelta?.text ?? "—",
      positive: monthDelta?.positive ?? null,
      history: toSparkline(monthSeries),
    },
    {
      label: "올해 종합 점수",
      score: averageScore(yearOrFallback),
      comparison: yearDelta?.comparison ?? "전년 대비",
      deltaText: yearDelta?.text ?? "—",
      positive: yearDelta?.positive ?? null,
      history: toSparkline(yearOrFallback),
    },
  ];
}

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function parseEventDate(iso: string): { year: string; day: string; mon: string } {
  // ISO "2026-04-25" or "2026-04-25T08:30..."
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { year: "", day: "—", mon: "" };
  const mon = MONTH_ABBR[Number(m[2]) - 1] ?? "";
  return { year: m[1]!, day: String(Number(m[3])), mon };
}

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function formatVolume(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function formatScore(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════ */

const PAGE_W = 1110;          // 시안 콘텐츠 폭 (1275 - 165)
const SIDE_PAD = 165;         // 시안 좌측 마진
const GAUGE_W = 281;          // Card/main-analysis 폭
const GAP = 16;

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    fontFamily: "var(--font-body, 'Pretendard Variable', sans-serif)",
    color: "#003049",
  },

  /* ───── §1 헤더 (DetailShell 과 동일 규격) ───── */
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
    background: "transparent",
    border: 0,
    padding: 0,
    cursor: "pointer",
    color: "var(--color-text)",
    justifySelf: "start",
  },
  logoMark: { width: 24, height: 24, display: "block" },
  logoWord: {
    fontFamily: "var(--font-brand, 'Fugaz One', serif)",
    fontWeight: 400,
    fontSize: 20,
    letterSpacing: "0.02em",
  },

  /* ───── 캔버스 / 로딩 ───── */
  canvas: {
    maxWidth: PAGE_W + SIDE_PAD * 2,
    margin: "0 auto",
    padding: `26px ${SIDE_PAD}px 60px`,
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  loading: {
    padding: "60px 20px",
    color: "#7f7f7f",
    textAlign: "center",
    fontSize: 14,
  },
  error: {
    padding: "20px 24px",
    background: "#fff4f5",
    border: "1px solid #c1121f",
    borderRadius: 10,
    color: "#c1121f",
    fontSize: 13,
  },
  empty: {
    color: "#a3a3a3",
    fontSize: 12,
    padding: "12px 0",
    listStyle: "none",
  },

  /* ───── §2 종목 행 ───── */
  stockRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "flex-end",
    gap: 32,
  },
  stockLeft: { display: "flex", flexDirection: "column", gap: 4 },
  stockName: {
    fontSize: 25,
    fontWeight: 600,
    color: "#003049",
    letterSpacing: "-0.01em",
  },
  stockPriceLine: {
    fontSize: 33,
    fontWeight: 700,
    color: "#000000",
    letterSpacing: "-0.01em",
    lineHeight: 1.15,
  },
  stockPriceMain: { color: "#000000", fontWeight: 700, fontSize: 33 },
  stockPriceUnit: { color: "#000000", fontWeight: 700, fontSize: 33, marginLeft: 2 },
  stockDelta: { fontWeight: 700, fontSize: 20, marginLeft: 10 },

  marketStripe: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "end",
  },
  marketCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
    padding: "10px 14px",
    border: "1px solid #ececec",
    borderRadius: 10,
    background: "transparent",
  },
  marketLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  marketValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "#373737",
    fontVariantNumeric: "tabular-nums",
  },
  marketDelta: {
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },

  /* ───── §3 게이지 + 차트 ───── */
  gaugeChartRow: {
    display: "grid",
    gridTemplateColumns: `${GAUGE_W}px 1fr`,
    gap: GAP,
  },
  gaugeStack: {
    display: "flex",
    flexDirection: "column",
    gap: GAP,
  },
  gaugeCard: {
    background: "#ffffff",
    border: "1px solid #e9e9e9",
    borderRadius: 10,
    padding: "16px 18px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition: "border-color 0.18s ease, transform 0.18s ease",
  },
  gaugeHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gaugeTitle: { fontSize: 18, fontWeight: 700, color: "#003049" },
  gaugeBody: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "stretch",
    gap: 14,
    minHeight: 92,
  },
  gaugeRight: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    height: "100%",
  },
  gaugeLeft: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    gap: 6,
    minWidth: 0,
    height: "100%",
    textAlign: "left",
  },
  gaugeLabel: {
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: "0.02em",
    lineHeight: 1.05,
    textAlign: "left",
  },
  gaugeScore: {
    fontSize: 15,
    fontWeight: 600,
    color: "#003049",
    textAlign: "left",
  },

  /* ───── 원자재 카드 미니 신호등 (3 열) ───── */
  miniTrafficWrap: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    padding: "4px 0",
    alignItems: "center",
  },
  miniTrafficRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  miniTrafficLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#4e4e4e",
    letterSpacing: "0.02em",
  },
  miniTrafficDot: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "block",
    border: "1px solid rgba(0,0,0,0.06)",
  },

  chartPanel: {
    background: "#ffffff",
    border: "1px solid #e9e9e9",
    borderRadius: 10,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  chartFillBody: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fafbfc",
  },
  chartPlaceholderText: {
    fontSize: 13,
    color: "#a3a3a3",
    fontWeight: 500,
  },

  /* ───── Fundamental 호버 — 섹션별 스코어 분포 (세로) ───── */
  fvPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 18,
    padding: "24px 32px",
    background: "#ffffff",
    minHeight: 0,
  },
  fvDonutCol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  fvDonutCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    pointerEvents: "none",
  },
  fvDonutScore: {
    fontSize: 42,
    fontWeight: 700,
    fontFamily: "var(--font-numeric, sans-serif)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  fvDonutLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  fvRowsCol: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  fvRowsList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  fvRow: {
    display: "grid",
    gridTemplateColumns: "32px 80px 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 8,
  },
  fvRowDivider: {
    height: 1,
    background: "#ececec",
    margin: "2px 12px",
  },
  fvRowIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fvRowLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#003049",
  },
  fvRowBarTrack: {
    height: 8,
    borderRadius: 4,
    background: "#ececec",
    overflow: "hidden",
    width: "100%",
  },
  fvRowBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  fvRowScore: {
    fontSize: 14,
    fontWeight: 700,
    color: "#003049",
    fontVariantNumeric: "tabular-nums",
    minWidth: 70,
    textAlign: "right",
  },

  /* ───── 기본 상태 — 회사 요약 패널 (세로 가운데 정렬) ───── */
  csPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 32px",
    background: "#ffffff",
    minHeight: 0,
  },
  csInner: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    width: "100%",
    maxWidth: 640,
  },
  csTitleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  csCompany: {
    fontSize: 22,
    fontWeight: 700,
    color: "#003049",
    lineHeight: 1.2,
  },
  csTicker: {
    fontSize: 13,
    fontWeight: 600,
    color: "#7f7f7f",
    fontFamily: "var(--font-numeric)",
    letterSpacing: "0.04em",
  },
  csDescription: {
    fontSize: 15,
    fontWeight: 500,
    color: "#373737",
    lineHeight: 1.6,
    margin: 0,
  },
  csHint: {
    fontSize: 11,
    fontWeight: 500,
    color: "#a3a3a3",
    marginTop: 4,
  },

  /* ───── 거시 호버 — 4 regime 확률 ───── */
  mvPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "20px 32px",
    background: "#ffffff",
    minHeight: 0,
    justifyContent: "center",
  },
  mvHead: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  mvHeadTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#003049",
  },
  mvHeadDivider: {
    fontSize: 16,
    fontWeight: 600,
    color: "#a3a3a3",
  },
  mvHeadSub: {
    fontSize: 14,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  mvDominant: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    padding: "10px 14px",
    background: "#f4f9ff",
    borderRadius: 8,
    border: "1px solid #e2ecff",
  },
  mvDominantLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  mvDominantValue: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "var(--font-numeric, sans-serif)",
    lineHeight: 1,
  },
  mvDominantConfidence: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7f7f7f",
    marginLeft: "auto",
  },
  mvList: {
    display: "flex",
    flexDirection: "column",
    listStyle: "none",
    padding: 0,
    margin: 0,
    gap: 10,
  },
  mvRow: {
    display: "grid",
    gridTemplateColumns: "110px 1fr 48px",
    alignItems: "center",
    gap: 12,
  },
  mvLabel: {
    fontSize: 13,
    fontWeight: 700,
  },
  mvBarTrack: {
    height: 10,
    borderRadius: 5,
    background: "#ececec",
    overflow: "hidden",
  },
  mvBarFill: {
    height: "100%",
    borderRadius: 5,
    transition: "width 0.5s ease",
  },
  mvPct: {
    fontSize: 13,
    fontWeight: 700,
    color: "#003049",
    fontFamily: "var(--font-numeric, sans-serif)",
    textAlign: "right",
  },

  /* ───── 기술 호버 — total + 6 metric ───── */
  tvPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "20px 32px",
    background: "#ffffff",
    minHeight: 0,
    justifyContent: "center",
  },
  tvHead: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  tvHeadTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#003049",
  },
  tvHeadDivider: {
    fontSize: 16,
    fontWeight: 600,
    color: "#a3a3a3",
  },
  tvHeadSub: {
    fontSize: 14,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  tvScoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "12px 16px",
    background: "#f4f9ff",
    borderRadius: 8,
    border: "1px solid #e2ecff",
  },
  tvScoreBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  tvScoreLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  tvScoreValue: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: "var(--font-numeric, sans-serif)",
    lineHeight: 1,
  },
  tvScoreMax: {
    fontSize: 14,
    fontWeight: 600,
    color: "#a3a3a3",
    marginLeft: 2,
  },
  tvSignalBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginLeft: "auto",
    alignItems: "flex-end",
  },
  tvSignalValue: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "var(--font-numeric, sans-serif)",
    lineHeight: 1,
    letterSpacing: "0.02em",
  },
  /* 기술 신호 등급 바 — 디테일 페이지 SignalGaugeBar 와 동일 레이아웃 (mini) */
  tvSignalGaugeWrap: {
    position: "relative",
    marginTop: 50,
    marginBottom: 8,
  },
  tvSignalBadge: {
    position: "absolute",
    // marker(top:-11, height 9 = -2 까지) 위에 충분히 띄움
    bottom: "calc(100% + 13px)",
    transform: "translateX(-50%)",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 4,
    background: "#ffffff",
    border: "1.5px solid",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  tvSignalMarker: {
    position: "absolute",
    top: -11,
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  tvSignalBar: {
    display: "flex",
    width: "100%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  tvSignalTicks: {
    position: "relative",
    width: "100%",
    height: 14,
    marginTop: 4,
  },
  tvSignalTick: {
    position: "absolute",
    top: 0,
    transform: "translateX(-50%)",
    fontSize: 10,
    fontWeight: 600,
    color: "#7f7f7f",
    fontFamily: "var(--font-numeric, sans-serif)",
  },

  tvMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
  },
  tvTile: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "8px 10px",
    background: "#fafbfc",
    border: "1px solid #ececec",
    borderRadius: 6,
  },
  tvTileHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  tvTileLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#003049",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tvTileScore: {
    fontSize: 12,
    fontWeight: 700,
    color: "#003049",
    fontFamily: "var(--font-numeric, sans-serif)",
    flexShrink: 0,
  },
  tvTileBarTrack: {
    height: 6,
    borderRadius: 3,
    background: "#ececec",
    overflow: "hidden",
  },
  tvTileBarFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.5s ease",
  },

  /* ───── 원자재 호버 — 핵심 요약 + 3 신호등 ───── */
  cvPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 24,
    padding: "20px 32px",
    background: "#ffffff",
    minHeight: 0,
  },
  cvHead: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  cvHeadTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#003049",
  },
  cvHeadDivider: {
    fontSize: 16,
    fontWeight: 600,
    color: "#a3a3a3",
  },
  cvHeadSub: {
    fontSize: 14,
    fontWeight: 600,
    color: "#7f7f7f",
  },
  cvTrafficRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    alignItems: "stretch",
    justifyItems: "center",
  },
  cvTrafficCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  cvTrafficTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#003049",
    textAlign: "center",
  },
  cvTrafficBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px",
    background: "#1a1a1a",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
  },
  cvTrafficDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    display: "block",
    transition: "all 0.2s ease",
  },
  cvTrafficValue: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "var(--font-numeric, sans-serif)",
    lineHeight: 1,
    textAlign: "center",
  },

  /* ───── §4 이벤트 + FX ───── */
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: GAP },
  card: {
    background: "#ffffff",
    border: "1px solid #e9e9e9",
    borderRadius: 10,
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#003049" },
  more: { fontSize: 13, color: "#7f7f7f", fontWeight: 600, cursor: "pointer" },
  moreBtn: {
    fontSize: 13,
    color: "#7f7f7f",
    fontWeight: 600,
    cursor: "pointer",
    background: "transparent",
    border: 0,
    padding: 0,
  },

  eventList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 },
  eventRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr",
    gap: 14,
    alignItems: "center",
    padding: "12px 0",
  },
  rowDivider: {
    borderTop: "1px solid #ececec",
  },
  yearHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "#a3a3a3",
    letterSpacing: "0.08em",
    padding: "2px 0 4px",
  },
  yearHeaderMid: {
    borderTop: "1px solid #ececec",
    paddingTop: 14,
    marginTop: 4,
  },
  eventDateBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    textAlign: "center",
  },
  eventDay: { fontSize: 20, fontWeight: 700, color: "#003049" },
  eventMon: { fontSize: 13, fontWeight: 600, color: "#003049", marginTop: 2 },
  eventBody: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  eventTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  eventTitle: { fontSize: 14, fontWeight: 500, color: "#003049" },
  eventTag: {
    fontSize: 10,
    fontWeight: 600,
    color: "#4073ff",
    background: "#eaf0ff",
    padding: "2px 6px",
    borderRadius: 4,
  },
  eventTime: { fontSize: 13, fontWeight: 600, color: "#7f7f7f", marginLeft: "auto" },
  eventSub: { fontSize: 13, fontWeight: 600, color: "#7f7f7f" },

  fxList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 },
  fxRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 110px",
    gap: 16,
    alignItems: "center",
    padding: "12px 0",
  },
  fxLabelCol: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  fxCode: { fontSize: 16, fontWeight: 600, color: "#003049" },
  fxSub: { fontSize: 13, fontWeight: 600, color: "#7f7f7f" },
  fxSparkCol: { width: "100%" },
  fxSparkEmpty: { fontSize: 12, color: "#a3a3a3" },
  fxValueCol: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 },
  fxValue: { fontSize: 16, fontWeight: 600, color: "#003049", fontVariantNumeric: "tabular-nums" },
  fxDelta: { fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" },

  /* ───── §5 종합 점수 3중 ───── */
  compositeRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: GAP,
  },
  compHead: { fontSize: 15, fontWeight: 600, color: "#003049", marginBottom: 10 },
  compBody: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: 20,
  },
  compScore: {
    fontSize: 40,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  compSpark: { width: "100%" },
  compDelta: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },

  /* ───── §6 TOP 3 × 4 ───── */
  top3Row: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: GAP },
  top3Card: {
    border: "1px solid #e9e9e9",
    borderRadius: 10,
    padding: "16px 18px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minHeight: 220,
  },
  top3Title: { fontSize: 13, fontWeight: 600, color: "#003049" },
  top3List: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  top3RowBtn: {
    width: "100%",
    background: "transparent",
    border: 0,
    padding: "8px 6px",
    margin: 0,
    borderRadius: 8,
    cursor: "pointer",
    color: "inherit",
    display: "grid",
    gridTemplateColumns: "18px 1fr auto",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    transition: "background 0.15s ease",
  },
  top3Rank: { fontSize: 18, fontWeight: 700, color: "#003049" },
  top3Ticker: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  top3TickerCode: { fontSize: 16, fontWeight: 600, color: "#003049" },
  top3TickerKor: { fontSize: 13, fontWeight: 600, color: "#7f7f7f" },
  top3Primary: { fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" },

  /* ───── 더보기 모달 ───── */
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 24,
    animation: "investLensFadeIn 0.16s ease",
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "70vh",
    background: "#ffffff",
    borderRadius: 14,
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.20)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "investLensModalIn 0.18s ease",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 22px",
    borderBottom: "1px solid #e9e9e9",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#003049",
  },
  modalClose: {
    background: "transparent",
    border: 0,
    fontSize: 22,
    color: "#7f7f7f",
    cursor: "pointer",
    padding: 0,
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    lineHeight: 1,
  },
  modalBody: {
    listStyle: "none",
    margin: 0,
    padding: "4px 22px 16px",
    overflowY: "auto",
    flex: 1,
  },
  modalEventRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr",
    gap: 14,
    alignItems: "center",
    padding: "14px 0",
  },

  /* ───── §7 풋터 ───── */
  footer: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    fontSize: 10,
    fontWeight: 600,
    color: "#828282",
  },
};
