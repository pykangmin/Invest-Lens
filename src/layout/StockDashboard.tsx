import { useEffect, useMemo, useState } from "react";
import { analyze } from "../analysis";
import {
  loadCompanySnapshot,
  loadDashboardEnvironment,
  type DashboardEnvironment,
} from "../data-loader/investmentData";
import type {
  CompanySnapshot,
  GlobalEnvironmentPoint,
} from "../types/investment";
import { CompositeTrio } from "../visualization/CompositeTrio";
import { EventList } from "../visualization/EventList";
import { FxCard } from "../visualization/FxCard";
import { GaugeCard } from "../visualization/GaugeCard";
import { IndexStripe } from "../visualization/IndexStripe";
import { Sparkline } from "../visualization/Sparkline";
import { SymbolHeader } from "../visualization/SymbolHeader";
import { Top3Card } from "../visualization/Top3Card";

export interface StockDashboardProps {
  ticker: string;
  onBack: () => void;
}

interface DashState {
  snapshot: CompanySnapshot;
  env: DashboardEnvironment;
}

export function StockDashboard({ ticker, onBack }: StockDashboardProps) {
  const [data, setData] = useState<DashState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    Promise.all([loadCompanySnapshot(ticker), loadDashboardEnvironment()])
      .then(([snapshot, env]) => {
        if (alive) setData({ snapshot, env });
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
      <GlobalHeader onBack={onBack} />
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
              />
              <GaugeCard
                title="기술적 지표"
                gauge={analysis.gauges.technical}
                mode="progress"
              />
            </section>

            {/* Row 3 — 차트 (좌) + 주요 이벤트 (중) + 환율 (우) — Figma union box */}
            <section style={S.midRow}>
              <ChartCard priceMeta={priceMeta} />
              <EventList events={analysis.events} />
              <div style={S.fxStack}>
                {pickFxCommodityCards(data.env).map((card) => (
                  <FxCard key={card.label} {...card} />
                ))}
              </div>
            </section>

            {/* Row 5 — composite-trio (시점 비교 3) */}
            <CompositeTrio
              items={[
                {
                  label: "오늘 종합 점수",
                  score: analysis.composite.fundamental,
                  delta: deriveDelta(analysis.composite.fundamental),
                },
                {
                  label: "이번 달 종합 점수",
                  score: analysis.composite.macroEnvironment,
                  delta: deriveDelta(analysis.composite.macroEnvironment),
                },
                {
                  label: "오늘 종합 점수",
                  score: analysis.composite.technical,
                  delta: deriveDelta(analysis.composite.technical),
                },
              ]}
            />

            {/* Row 6 — TOP 3 ×4 (placeholder, /api/screen 미구현) */}
            <section style={S.topRow}>
              <Top3Card title="어제 가장 많이 오른 주식 TOP 3" items={[]} tone="up" pending />
              <Top3Card title="어제 가장 많이 거래된 주식 TOP 3" items={[]} tone="info" pending />
              <Top3Card title="어제 가장 많이 떨어진 주식 TOP 3" items={[]} tone="down" pending />
              <Top3Card title="어제 점수가 좋았던 주식 TOP 3" items={[]} tone="neutral" pending />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function GlobalHeader({ onBack }: { onBack: () => void }) {
  return (
    <header style={S.headerBar}>
      <button style={S.logo} onClick={onBack} aria-label="진입 화면으로">
        <span style={S.logoMark}>〉</span>
        <span style={S.logoWord}>Invest Lens</span>
      </button>
      <div style={S.headerSearchStub}>
        <span style={S.headerSearchIcon} aria-hidden>⌕</span>
        <span>오늘은 어떤 종목을 분석 해볼까요?</span>
      </div>
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
        <Sparkline
          values={priceMeta.lineFull}
          width={1100}
          height={320}
          fillOpacity={0.10}
        />
      ) : (
        <div style={S.chartEmpty}>가격 데이터 부족</div>
      )}
    </section>
  );
}

function deriveDelta(score: number | null) {
  // 임시: 전일 대비 0.31% mock — 점수 history 가 없는 동안 시안 충실도 위해 표기.
  // 본 마감 전 점수 일별 추이 적재 후 실제 delta.
  if (score === null) return undefined;
  return { text: "4.20 (+0.31%)", positive: true };
}

function marketContext(env: DashboardEnvironment) {
  const vix = env.vix.latest[0]?.value ?? null;
  const dxy = env.dollarIndex.latest[0]?.value ?? null;
  const t10 = env.treasury10y.latest[0]?.value ?? null;
  const hys = env.highYieldSpread.latest[0]?.value ?? null;
  return [
    {
      label: "변동성",
      value: vix !== null ? vix.toFixed(1) : "—",
      delta: undefined,
    },
    {
      label: "통화",
      value: dxy !== null ? dxy.toFixed(2) : "—",
      delta: undefined,
    },
    {
      label: "채권",
      value: t10 !== null ? `${t10.toFixed(2)}%` : "—",
      delta: undefined,
    },
    {
      label: "신용",
      value: hys !== null ? `${hys.toFixed(2)}%` : "—",
      delta: undefined,
    },
  ];
}

function pickFxCommodityCards(env: DashboardEnvironment) {
  const wantedCommodity = ["CL=F", "GC=F", "HG=F"] as const;
  const labels: Record<string, { label: string; sub: string }> = {
    "CL=F": { label: "WTI 원유", sub: "Crude Oil" },
    "GC=F": { label: "금", sub: "Gold" },
    "HG=F": { label: "구리", sub: "Copper" },
  };
  const cards = wantedCommodity.map((sym) => {
    const series = env.commodities.history.filter((c) => c.symbol === sym);
    const latest = series[0];
    const prev = series[1];
    const delta =
      latest && prev && prev.close !== 0
        ? ((latest.close - prev.close) / prev.close) * 100
        : null;
    const meta = labels[sym] ?? { label: sym, sub: "" };
    return {
      label: meta.label,
      sublabel: meta.sub,
      value: latest ? latest.close.toFixed(2) : "—",
      sparkline: series.slice(0, 60).map((r) => r.close),
      delta:
        delta === null
          ? undefined
          : {
              text: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`,
              positive: delta >= 0,
            },
    };
  });
  cards.push(buildEnvCard(env.dollarIndex.history));
  return cards;
}

function buildEnvCard(history: GlobalEnvironmentPoint[]) {
  const latest = history[0];
  const prev = history[1];
  const delta =
    latest && prev && prev.value !== 0
      ? ((latest.value - prev.value) / prev.value) * 100
      : null;
  return {
    label: "USD Index",
    sublabel: "달러 인덱스",
    value: latest ? latest.value.toFixed(2) : "—",
    sparkline: history.slice(0, 60).map((r) => r.value),
    delta:
      delta === null
        ? undefined
        : {
            text: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`,
            positive: delta >= 0,
          },
  };
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
  headerSearchStub: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: 761,
    maxWidth: "100%",
    height: 40,
    padding: "0 18px",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-pill)",
    color: "var(--color-text-faint)",
    fontSize: "var(--font-size-base)",
    justifySelf: "center",
  },
  headerSearchIcon: { fontSize: 16 },

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

  midRow: {
    display: "grid",
    gridTemplateColumns: "550px minmax(0, 1fr) minmax(280px, 360px)",
    gap: 16,
    alignItems: "stretch",
    minHeight: 386,
  },
  fxStack: { display: "flex", flexDirection: "column", gap: 8 },

  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    minHeight: 151,
  },
};
