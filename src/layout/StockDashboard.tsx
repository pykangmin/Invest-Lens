import { useEffect, useMemo, useState } from "react";
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
import { FxCard } from "../visualization/FxCard";
import { GaugeCard } from "../visualization/GaugeCard";
import { GlobalSearch } from "../visualization/GlobalSearch";
import { IndexStripe } from "../visualization/IndexStripe";
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
      sparkline: tech.slice(0, 60).map((r) => r.close),
      lineFull: tech.slice(0, 180).map((r) => r.close),
    };
  }, [data]);

  return (
    <div style={S.page}>
      <GlobalHeader onBack={onBack} onSelectTicker={onSelectTicker} />
      <div style={S.canvas}>
        {error && <div style={S.error}>로드 실패: {error}</div>}
        {!error && (!data || !analysis) && (
          <div style={S.loading}>분석 중…</div>
        )}
        {data && analysis && (
          <>
            {/* Row 1 — Frame 4 (cornerRadius 30) — 종목 + 시장 컨텍스트 4슬롯 한 카드 */}
            <section style={S.frame4}>
              <SymbolHeader
                name={data.snapshot.company.name ?? ticker}
                ticker={ticker}
                current={priceMeta?.current ?? null}
                delta={priceMeta?.delta ?? null}
                pct={priceMeta?.pct ?? null}
              />
              <IndexStripe items={marketContext(data.env)} />
            </section>

            {/* Row 2 — Frame 18 — 게이지 4종 */}
            <section style={S.gaugesRow}>
              <GaugeCard
                title="기업 펀더멘털"
                gauge={analysis.gauges.fundamental}
                mode="donut"
              />
              <GaugeCard
                title="원자재 영향"
                gauge={analysis.gauges.commodity}
                mode="donut"
              />
              <GaugeCard
                title="거시 경제"
                gauge={analysis.gauges.macro}
                mode="regime"
                sparkline={macroTrend(data.env)}
              />
              <GaugeCard
                title="기술적 지표"
                gauge={analysis.gauges.technical}
                mode="progress"
              />
            </section>

            {/* Row 3 — 차트 단독 가로 풀폭 */}
            <ChartCard priceMeta={priceMeta} />

            {/* Row 4 — 주요 이벤트 (좌) + 환율 (우) — 1:1 */}
            <section style={S.row4}>
              <EventList events={analysis.events} />
              <FxBlock />
            </section>

            {/* Row 5 — composite-trio (값·추이·delta 모두 실 데이터) */}
            <CompositeTrio items={buildTrioItems(data)} />

            {/* Row 6 — TOP 3 ×4 — /api/screen 실 데이터 */}
            <section style={S.topRow}>
              <Top3Card
                title="어제 가장 많이 오른 주식 TOP 3"
                tone="up"
                items={data.screens.priceUp.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: formatPct(it.metric),
                }))}
              />
              <Top3Card
                title="어제 가장 많이 거래된 주식 TOP 3"
                tone="info"
                items={data.screens.volume.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: formatVolume(it.metric),
                }))}
              />
              <Top3Card
                title="어제 가장 많이 떨어진 주식 TOP 3"
                tone="down"
                items={data.screens.priceDown.map((it) => ({
                  ticker: it.ticker,
                  korName: it.name ?? undefined,
                  primary: formatPct(it.metric),
                }))}
              />
              <Top3Card
                title="어제 점수가 좋았던 주식 TOP 3"
                tone="neutral"
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

function GlobalHeader({
  onBack,
  onSelectTicker,
}: {
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
}) {
  return (
    <header style={S.headerBar}>
      <button style={S.logo} onClick={onBack} aria-label="진입 화면으로">
        <span style={S.logoMark}>〉</span>
        <span style={S.logoWord}>Invest Lens</span>
      </button>
      <GlobalSearch onSelectTicker={onSelectTicker} variant="header" />
      <div />
    </header>
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
        sparkline: Array<number | null>;
        lineFull: Array<number | null>;
      }
    | null;
}) {
  return (
    <section style={S.chartCard}>
      <div style={S.chartHead}>
        <div style={S.chartLabel}>차트</div>
        {priceMeta?.dateLatest && (
          <div style={S.chartDate}>최신: {priceMeta.dateLatest}</div>
        )}
      </div>
      {priceMeta && priceMeta.lineFull.length > 1 ? (
        <div style={{ width: "100%" }}>
          <Sparkline
            values={priceMeta.lineFull}
            width="100%"
            height={320}
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

function buildTrioItems(data: DashState) {
  // 1년치 일별 종합 series 한 번만 계산 후, 시간 창별로 슬라이스.
  const dailyYear = buildDailyComposite({
    snapshot: data.snapshot,
    vixHistory: data.env.vix.history,
    macroHistory: data.env.macroRegime.history,
    commodityHistory: data.env.commodities.history,
    days: 252,
  });
  const fullYearSeries = overallSeries(dailyYear);

  // 오늘: 최근 7 영업일 (단기 추이)
  const todaySeries = fullYearSeries.slice(0, 7);
  // 이번 달: 30 영업일
  const monthSeries = fullYearSeries.slice(0, 30);
  // 올해: YTD — 현재 연도 1월 1일 이후 영업일
  const currentYear = new Date().getUTCFullYear();
  const yearSeries = fullYearSeries.filter(
    (p) => Number(p.date.slice(0, 4)) === currentYear,
  );

  const yearOrFallback = yearSeries.length > 0 ? yearSeries : monthSeries;

  return [
    {
      label: "오늘 종합 점수",
      score: todaySeries[0]?.score ?? null,
      delta: deltaFromSeries(todaySeries), // 어제→오늘 — "전일 대비"
      history: toSparkline(todaySeries),
    },
    {
      label: "이번 달 종합 점수",
      score: averageScore(monthSeries),
      delta: windowDelta(monthSeries, "30일 전 대비"), // 30일 시작 → 오늘
      history: toSparkline(monthSeries),
    },
    {
      label: "올해 종합 점수",
      score: averageScore(yearOrFallback),
      delta: windowDelta(
        yearOrFallback,
        yearSeries.length > 0 ? "연초 대비" : "30일 전 대비",
      ),
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

// G3 거시 경제 sparkline — macro_regime_scores.history 의 softLandingProb 시계열.
// dominant_regime 에 따라 의미 추이로 표기:
//   SoftLanding 우세면 softLandingProb, HardLanding 우세면 hardLandingProb 등.
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
  // history 는 desc 정렬 (최신이 [0]) — sanitize 가 reverse 처리.
  return hist.map(pick);
}

function marketContext(_env: DashboardEnvironment) {
  // 시안 충실도 — S&P 500 슬롯 1개 mock. 실 인덱스 시계열은 DB 부재.
  // (전 4슬롯 위험지표 매핑은 deprecated — 사용자 지시로 시안 단일 mock 으로 회귀.)
  return [
    {
      label: "S&P 500",
      value: "35,301$",
      delta: { text: "+38.1%", positive: true as const },
      badge: "예시",
    },
  ];
}

// 환율 — Figma 시안 그대로 (USD/KRW × 4 mock). DB 에 USD/KRW 시계열 부재이므로
// "예시" 배지 + 시안 mock 값 (1,530.50 / 4.20 +0.31%) 그대로.
function FxBlock() {
  // 시안 충실도 — sparkline 은 1530 부근의 가벼운 변동 mock.
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
    <div style={S.fxBlock}>
      <div style={S.fxHeader}>
        <span style={S.fxTitle}>환율</span>
        <span style={S.exampleBadge}>예시</span>
      </div>
      <div style={S.fxStack}>
        {Array.from({ length: 4 }).map((_, i) => (
          <FxCard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--color-bg)" },
  headerBar: {
    height: 66,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    background: "var(--color-header-bg)",
    borderBottom: "1px solid var(--color-border)",
    padding: "0 165px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "var(--color-text)",
    justifySelf: "start",
  },
  logoMark: { color: "var(--color-up)", fontSize: 20, lineHeight: 1 },
  logoWord: {
    fontFamily: "var(--font-brand)",
    fontWeight: 400,
    fontSize: 16,
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
  loading: { color: "var(--color-text-muted)", padding: 64, textAlign: "center" },
  error: {
    color: "var(--color-down)",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 16,
  },

  frame4: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 24,
    padding: "20px 32px",
    background: "var(--color-card)",
    borderRadius: "var(--radius-card-lg)",
    border: "1px solid var(--color-stroke)",
    minHeight: 112,
  },

  gaugesRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    minHeight: 148,
  },

  chartCard: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "18px 20px",
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
  chartEmpty: {
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-sm)",
    padding: "64px 0",
    textAlign: "center",
  },

  row4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start",
  },
  fxStack: { display: "flex", flexDirection: "column", gap: 8 },
  fxBlock: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  fxHeader: { display: "flex", alignItems: "center", gap: 8 },
  fxTitle: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  exampleBadge: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-faint)",
    background: "var(--color-header-bg)",
    border: "1px solid var(--color-border)",
    padding: "2px 8px",
    borderRadius: "var(--radius-tag)",
    fontWeight: 600,
    letterSpacing: "0.04em",
  },

  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    minHeight: 151,
  },
};
