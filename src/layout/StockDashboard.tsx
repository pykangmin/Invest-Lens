// StockDashboard — 개별 주식 화면 (v4).
// spec: docs/figma/dashboard-slots-v4.md §3 (Figma node 251:3523)
// 분류: docs/figma/data-coverage-v4.md §2
//
// 와이어프레임 구조 (위→아래):
//   1) 헤더    — 로고 + 글로벌 검색 (시장지수 4슬롯 부재 — v3 IndexStripe 폐기)
//   2) 종목 행 — 종목명·가격·변동 (좌) + 시장 컨텍스트 4슬롯 EXAMPLE (우)
//   3) 사이드바 4 게이지 (세로 stack) + 차트 (사이드바 옆 가로 결합)
//   4) 주요 이벤트 (좌) + 환율 EXAMPLE (우) — 2-col
//   5) 종합 점수 3중 (오늘/이번 달/올해)
//   6) TOP 3 ×4 (오른/거래된/떨어진/점수 좋았던)

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { analyze } from "../analysis";
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
  loadScreen,
  type DashboardEnvironment,
  type ScreenItem,
} from "../data-loader/investmentData";
import type { CompanySnapshot } from "../types/investment";
import { CompositeTrio } from "../visualization/CompositeTrio";
import { EventList } from "../visualization/EventList";
import { ExampleBadge } from "../visualization/ExampleBadge";
import { FxCard } from "../visualization/FxCard";
import { GaugeCard } from "../visualization/GaugeCard";
import { GlobalSearch } from "../visualization/GlobalSearch";
import { Sparkline } from "../visualization/Sparkline";
import { SymbolHeader } from "../visualization/SymbolHeader";
import { Top3Card } from "../visualization/Top3Card";

export interface StockDashboardProps {
  ticker: string;
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
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
}

export function StockDashboard({ ticker, onBack, onSelectTicker }: StockDashboardProps) {
  const [data, setData] = useState<DashState | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    ])
      .then(([snapshot, env, sUp, sDown, sVol, sScore]) => {
        if (alive)
          setData({
            snapshot,
            env,
            screens: {
              priceUp: sUp.items,
              priceDown: sDown.items,
              volume: sVol.items,
              scoreTop: sScore.items,
            },
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
    return {
      current: cur,
      delta,
      pct,
      dateLatest: tech[0]?.date ?? null,
      lineFull: tech.slice(0, 180).map((r) => r.close),
    };
  }, [data]);

  return (
    <div style={S.page}>
      <Header onBack={onBack} onSelectTicker={onSelectTicker} />
      <div style={S.canvas}>
        {error && <div style={S.error}>로드 실패: {error}</div>}
        {!error && (!data || !analysis) && (
          <div style={S.loading}>분석 중…</div>
        )}
        {data && analysis && (
          <>
            {/* 1) 종목 행 + 시장 컨텍스트 4슬롯 */}
            <section style={S.tickerRow}>
              <SymbolHeader
                name={data.snapshot.company.name ?? ticker}
                ticker={ticker}
                current={priceMeta?.current ?? null}
                delta={priceMeta?.delta ?? null}
                pct={priceMeta?.pct ?? null}
              />
              <MarketContextStripe />
            </section>

            {/* 2) 사이드바 4게이지 (좌) + 차트 (우) — sidebar/main 그리드 */}
            <section style={S.mainGrid}>
              <aside style={S.gaugeSidebar}>
                <GaugeCard
                  title="기업 펀더멘털"
                  gauge={analysis.gauges.fundamental}
                  mode="donut"
                />
                <GaugeCard
                  title="거시 경제"
                  gauge={analysis.gauges.macro}
                  mode="regime"
                  sparkline={macroTrend(data.env)}
                />
                <GaugeCard
                  title="원자재 영향"
                  gauge={analysis.gauges.commodity}
                  mode="donut"
                />
                <GaugeCard
                  title="기술적 지표"
                  gauge={analysis.gauges.technical}
                  mode="progress"
                />
              </aside>
              <ChartCard priceMeta={priceMeta} />
            </section>

            {/* 3) 주요 이벤트 (좌) + 환율 EXAMPLE (우) — 2-col */}
            <section style={S.eventsFxRow}>
              <EventBlock events={analysis.events} />
              <FxBlock />
            </section>

            {/* 4) 종합 점수 3중 */}
            <CompositeTrio items={buildTrioItems(data)} />

            {/* 5) TOP 3 ×4 — 종목 클릭 시 해당 종목 화면으로 이동 */}
            <section style={S.topRow}>
              <Top3Card
                title="어제 가장 많이 오른 주식 TOP 3"
                tone="up"
                onSelectTicker={onSelectTicker}
                items={data.screens.priceUp.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: formatPct(it.metric),
                }))}
              />
              <Top3Card
                title="어제 가장 많이 거래된 주식 TOP 3"
                tone="info"
                onSelectTicker={onSelectTicker}
                items={data.screens.volume.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: formatVolume(it.metric),
                }))}
              />
              <Top3Card
                title="어제 가장 많이 떨어진 주식 TOP 3"
                tone="down"
                onSelectTicker={onSelectTicker}
                items={data.screens.priceDown.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: formatPct(it.metric),
                }))}
              />
              <Top3Card
                title="어제 점수가 좋았던 주식 TOP 3"
                tone="neutral"
                onSelectTicker={onSelectTicker}
                items={data.screens.scoreTop.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: it.metric === null ? "—" : `${Math.round(it.metric)}`,
                }))}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  onBack,
  onSelectTicker,
}: {
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
}) {
  return (
    <header style={S.header}>
      <button style={S.headerLogo} onClick={onBack} aria-label="진입 화면으로">
        <img src="/invest-lens-logo.svg" alt="" style={S.logoMark} aria-hidden />
        <span style={S.logoWord}>Invest Lens</span>
      </button>
      <GlobalSearch onSelectTicker={onSelectTicker} variant="header" />
      <div />
    </header>
  );
}

// 시장 컨텍스트 — 시안 mock (S&P 500 ×4). DB 시장지수 시계열 부재.
// 각 카드에 ExampleBadge 부착. data-coverage-v4 §2.2.
function MarketContextStripe() {
  const cards = [
    { label: "S&P 500", value: "35,301$", delta: "+38.1%", positive: true },
    { label: "S&P 500", value: "35,301$", delta: "-1.6%", positive: false },
    { label: "S&P 500", value: "35,301$", delta: "+38.1%", positive: true },
    { label: "S&P 500", value: "35,301$", delta: "0.0%", positive: null },
  ];
  return (
    <div style={S.marketStripe}>
      {cards.map((c, i) => (
        <div key={i} style={S.marketCell}>
          <div style={S.marketLabelRow}>
            <span style={S.marketLabel}>{c.label}</span>
            <ExampleBadge />
          </div>
          <div style={S.marketValue}>{c.value}</div>
          <div
            style={{
              ...S.marketDelta,
              color:
                c.positive === null
                  ? "var(--color-text-muted)"
                  : c.positive
                    ? "var(--color-up)"
                    : "var(--color-down)",
            }}
          >
            {c.delta}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  priceMeta,
}: {
  priceMeta:
    | {
        current: number;
        delta: number | null;
        pct: number | null;
        dateLatest: string | null;
        lineFull: Array<number | null>;
      }
    | null;
}) {
  return (
    <section style={S.chartCard}>
      <div style={S.chartHead}>
        <span style={S.chartLabel}>차트</span>
        {priceMeta?.dateLatest && (
          <span style={S.chartDate}>최신: {priceMeta.dateLatest}</span>
        )}
      </div>
      {priceMeta && priceMeta.lineFull.length > 1 ? (
        <div style={S.chartWrap}>
          <Sparkline
            values={priceMeta.lineFull}
            width="100%"
            height={420}
            fillOpacity={0.10}
            strokeWidth={2}
          />
        </div>
      ) : (
        <div style={S.chartEmpty}>가격 데이터 부족</div>
      )}
    </section>
  );
}

function EventBlock({ events }: { events: import("../types/scoring").AnalysisEvent[] }) {
  // RSI 임계 + 분기 보고일 합성만 구현. supertrend·MACD·regime 변경 합성 미구현.
  // 행 부족 시 STUB 배지 + 안내. 분류표 §2.5.
  const partial = events.length < 5;
  return (
    <EventList
      events={events}
      maxRows={5}
      style={{ height: "100%" }}
      headerBadge={
        partial ? (
          <ExampleBadge
            tone="stub"
            text="합성 일부 미구현"
            title="supertrend·MACD·regime 변경 합성 미구현 — RSI 임계 + 분기 보고일 합성만 표시"
          />
        ) : undefined
      }
    />
  );
}

// 환율 — DB 시계열 부재. 시안 mock (USD/KRW × 5) 그대로 + EXAMPLE 배지.
function FxBlock() {
  const mockSeries = Array.from({ length: 60 }, (_, i) =>
    1525 + Math.sin(i / 7) * 4 + (i / 60) * 5,
  );
  const card = {
    label: "USD/KRW",
    sublabel: "미국 달러 → 원화",
    value: "1,530.50",
    sparkline: mockSeries,
    delta: { text: "4.20 (+0.31%)", positive: true as const },
  };
  return (
    <div style={{ ...S.cardWithHeader, height: "100%" }}>
      <div style={S.cardHeaderRow}>
        <span style={S.cardTitle}>환율</span>
        <ExampleBadge title="DB USD/KRW 시계열 부재 — 시안 mock 표시" />
      </div>
      <div style={S.fxStack}>
        {Array.from({ length: 5 }).map((_, i) => (
          <FxCard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}

function buildTrioItems(data: DashState) {
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
  const yearSeries = fullYearSeries.filter(
    (p) => Number(p.date.slice(0, 4)) === currentYear,
  );
  const yearOrFallback = yearSeries.length > 0 ? yearSeries : monthSeries;

  return [
    {
      label: "오늘 종합 점수",
      score: todaySeries[0]?.score ?? null,
      delta: deltaFromSeries(todaySeries),  // "전일 대비"
      history: toSparkline(todaySeries),
    },
    {
      label: "이번 달 종합 점수",
      score: averageScore(monthSeries),
      delta: windowDelta(monthSeries, "전월 대비"),
      history: toSparkline(monthSeries),
    },
    {
      label: "올해 종합 점수",
      score: averageScore(yearOrFallback),
      delta: windowDelta(yearOrFallback, "전년 대비"),
      history: toSparkline(yearOrFallback),
    },
  ];
}

function formatPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function formatVolume(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function macroTrend(env: DashboardEnvironment): Array<number | null> {
  const hist = env.macroRegime.history;
  if (hist.length === 0) return [];
  const dom = env.macroRegime.latest?.dominantRegime;
  const pick = (m: typeof hist[number]): number | null => {
    if (dom === "SoftLanding") return m.softLandingProb;
    if (dom === "HardLanding") return m.hardLandingProb;
    if (dom === "NoLanding") return m.noLandingProb;
    if (dom === "Recovery") return m.recoveryProb;
    return m.softLandingProb;
  };
  return hist.map(pick);
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--color-bg)" },

  /* ───── 헤더 ───── */
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

  /* ───── 캔버스 ───── */
  canvas: {
    maxWidth: "var(--canvas-max)",
    margin: "0 auto",
    padding: "24px var(--content-pad-x) 64px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  loading: { color: "var(--color-text-muted)", padding: 64, textAlign: "center" },
  error: {
    color: "var(--color-down)",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 16,
  },

  /* ───── 종목 + 시장 컨텍스트 ───── */
  tickerRow: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) auto",
    alignItems: "center",
    gap: 24,
  },
  marketStripe: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 92px)",
    gap: 10,
  },
  marketCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "4px 6px",
  },
  marketLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifyContent: "space-between",
  },
  marketLabel: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  marketValue: {
    fontSize: "var(--font-size-xl-num)",
    fontWeight: 600,
    color: "var(--color-text)",
    fontVariantNumeric: "tabular-nums",
  },
  marketDelta: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },

  /* ───── 메인 그리드 (사이드바 + 차트) ───── */
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 22%) 1fr",
    gap: 16,
    alignItems: "stretch",
  },
  gaugeSidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  /* ───── 차트 ───── */
  chartCard: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
  },
  chartHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  chartDate: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  chartWrap: { width: "100%", flex: 1, display: "flex", alignItems: "center" },
  chartEmpty: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    padding: "64px 0",
    textAlign: "center",
    flex: 1,
  },

  /* ───── 이벤트 + 환율 ───── */
  eventsFxRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "stretch",  // 두 카드 동일 높이
  },
  cardWithHeader: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  fxStack: { display: "flex", flexDirection: "column", gap: 8, flex: 1 },

  /* ───── TOP 3 ×4 ───── */
  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    minHeight: 151,
  },
};
