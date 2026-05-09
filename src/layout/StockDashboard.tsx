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
  loadFxRate,
  loadMarketIndex,
  loadScreen,
  type DashboardEnvironment,
  type FxRateResponse,
  type MarketIndexResponse,
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
  marketIndices: Array<MarketIndexResponse | null>;  // 실패 시 null
  fxRates: Array<FxRateResponse | null>;
}

const MARKET_INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC", "^RUT"];
const FX_PAIRS = ["USDKRW", "USDJPY", "USDEUR", "USDCNY", "EURUSD"];

// 외부 API 실패 (Yahoo rate limit 등) 시 null 반환 — 호출자가 EXAMPLE fallback 처리
async function safeLoad<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch {
    return null;
  }
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
      // Yahoo Finance — 실패 시 null 로 fallback
      Promise.all(MARKET_INDEX_SYMBOLS.map((s) => safeLoad(() => loadMarketIndex(s)))),
      Promise.all(FX_PAIRS.map((p) => safeLoad(() => loadFxRate(p)))),
    ])
      .then(([snapshot, env, sUp, sDown, sVol, sScore, marketIndices, fxRates]) => {
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
              <MarketContextStripe items={data.marketIndices} />
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
              <FxBlock rates={data.fxRates} />
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

// 시장 컨텍스트 — Yahoo Finance 실 데이터. 4 indices 중 fetch 실패한 것만 EXAMPLE.
// data-coverage-v4 §2.2 — DB 부재 슬롯이지만 외부 API 로 REAL 전환.
function MarketContextStripe({ items }: { items: Array<MarketIndexResponse | null> }) {
  // fallback mock — Yahoo 실패 시
  const fallbackByIndex: Array<{ name: string; value: string; delta: string }> = [
    { name: "S&P 500", value: "—", delta: "—" },
    { name: "Dow Jones", value: "—", delta: "—" },
    { name: "Nasdaq", value: "—", delta: "—" },
    { name: "Russell 2K", value: "—", delta: "—" },
  ];
  return (
    <div style={S.marketStripe}>
      {fallbackByIndex.map((fb, i) => {
        const real = items[i];
        const isReal = real?.latest != null;
        const name = real?.name ?? fb.name;
        const value = isReal ? `${real!.latest!.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : fb.value;
        const pct = real?.pct ?? null;
        const positive = pct == null ? null : pct > 0 ? true : pct < 0 ? false : null;
        const deltaText =
          pct == null ? fb.delta : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        return (
          <div key={i} style={S.marketCell}>
            <div style={S.marketLabelRow}>
              <span style={S.marketLabel}>{name}</span>
              {!isReal && <ExampleBadge />}
            </div>
            <div style={S.marketValue}>{value}</div>
            <div
              style={{
                ...S.marketDelta,
                color:
                  positive === null
                    ? "var(--color-text-muted)"
                    : positive
                      ? "var(--color-up)"
                      : "var(--color-down)",
              }}
            >
              {deltaText}
            </div>
          </div>
        );
      })}
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

// 환율 — Yahoo Finance 실 데이터 (USD/KRW, USD/JPY, USD/EUR, USD/CNY, EUR/USD 5종).
// fetch 실패한 통화쌍만 EXAMPLE. 모두 실패 시 헤더에 EXAMPLE 배지.
const FX_PAIR_LABELS: Record<string, string> = {
  USDKRW: "USD/KRW",
  USDJPY: "USD/JPY",
  USDEUR: "USD/EUR",
  USDCNY: "USD/CNY",
  EURUSD: "EUR/USD",
};

function FxBlock({ rates }: { rates: Array<FxRateResponse | null> }) {
  const allFailed = rates.every((r) => !r?.latest);
  return (
    <div style={{ ...S.cardWithHeader, height: "100%" }}>
      <div style={S.cardHeaderRow}>
        <span style={S.cardTitle}>환율</span>
        {allFailed && <ExampleBadge title="Yahoo Finance fetch 실패 — fallback 표시" />}
      </div>
      <div style={S.fxStack}>
        {FX_PAIRS.map((pair, i) => {
          const r = rates[i];
          const code = FX_PAIR_LABELS[pair] ?? pair;
          if (r?.latest && r.history.length > 1) {
            const positive = r.pct == null ? null : r.pct > 0 ? true : r.pct < 0 ? false : null;
            return (
              <FxCard
                key={pair}
                label={code}
                sublabel={r.label}
                value={r.latest.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                sparkline={r.history.map((h) => h.close)}
                delta={{
                  text:
                    r.delta != null && r.pct != null
                      ? `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} (${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)}%)`
                      : "—",
                  positive: positive,
                }}
              />
            );
          }
          // fallback (Yahoo 실패한 단일 카드)
          return (
            <FxCard
              key={pair}
              label={code}
              sublabel="데이터 미수신"
              value="—"
              delta={{ text: "—", positive: null }}
            />
          );
        })}
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
    gridTemplateColumns: "minmax(280px, auto) 1fr",
    alignItems: "center",
    gap: 24,
  },
  // 시안 그대로 — 4 카드가 가로 정렬되고 카드 내부는 세로 stack (라벨/지수/변동률).
  // 카드 폭은 컨텐츠에 맞춰 가변 + 카드 사이 gap 으로 가시성 확보.
  marketStripe: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    gap: 28,
    flexWrap: "wrap",
  },
  // 카드 내부 — 세로 stack (라벨 위, 지수 중간, 변동률 아래).
  marketCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  marketLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  marketLabel: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    color: "var(--color-text)",
    lineHeight: 1.2,
  },
  marketValue: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 600,
    color: "var(--color-text)",
    fontVariantNumeric: "tabular-nums",
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.2,
  },
  marketDelta: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.2,
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
