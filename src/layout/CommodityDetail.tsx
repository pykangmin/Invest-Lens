// CommodityDetail — 원자재 영향 분석 detail 화면.
// spec: docs/figma/dashboard-slots-v4.md §4 (Figma node 271:561)
// data-coverage: docs/figma/data-coverage-v4.md §3
//
// 9 섹션 (위→아래):
//   1) 핵심 요약 (좌 본문 + 3 chip / 우 NEGATIVE 도넛)
//   2) 4 mini cards (리튬/금/WTI/금 상승)
//   3) 8 가격 카드 그리드 + 가격 변동률 비교 bar
//   4) 시장 지표 요약 (8행 표) + 변동성-수익률 매트릭스 scatter
//   5) 카테고리별 가격 추이 3 multi-line
//   6) 시장 이슈 3 카드 (EXAMPLE — 본문 mock)
//   7) 자산군 정규화 사이클 + WTI vs 천연가스 괴리율 line

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { commodityImpactGauge } from "../analysis/commodityImpact";
import {
  allSymbolStats,
  categoryNormalized,
  ratioSeries,
  symbolStat,
  type CommodityStat,
} from "../analysis/commodity-extras";
import {
  loadCompanySnapshot,
  loadCommodities,
} from "../data-loader/investmentData";
import type { CommoditiesResponse, CompanySnapshot } from "../types/investment";
import { BarChart } from "../visualization/BarChart";
import { DataTable, type DataTableColumn } from "../visualization/DataTable";
import { Donut } from "../visualization/Donut";
import { ExampleBadge } from "../visualization/ExampleBadge";
import { MiniCard } from "../visualization/MiniCard";
import { MultiLineChart, type LineSeries } from "../visualization/MultiLineChart";
import { ScatterPlot } from "../visualization/ScatterPlot";
import { Sparkline } from "../visualization/Sparkline";
import { StatusChip } from "../visualization/StatusChip";
import { DetailShell, type DetailSection } from "./DetailShell";

interface DetailState {
  snapshot: CompanySnapshot;
  commodities: CommoditiesResponse;
}

export interface CommodityDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

// 4 mini card용 symbol — 시안 의도 따라 (리튬/금/WTI/구리)
const MINI_SYMBOLS: Array<{ symbol: string; name: string; unit?: string }> = [
  { symbol: "LIT", name: "리튬 ETF" },
  { symbol: "GC=F", name: "금 시세", unit: "$/oz" },
  { symbol: "CL=F", name: "WTI 원유", unit: "$/bbl" },
  { symbol: "HG=F", name: "구리", unit: "$/lb" },
];

// 8 가격 그리드용 symbol
const PRICE_GRID_SYMBOLS = [
  "CL=F",
  "NG=F",
  "GC=F",
  "SI=F",
  "HG=F",
  "ZC=F",
  "ZS=F",
  "ZW=F",
];

// symbol → 한글 이름
const SYMBOL_KOR: Record<string, string> = {
  "CL=F": "WTI 원유",
  "NG=F": "천연가스",
  "GC=F": "금",
  "SI=F": "은",
  "HG=F": "구리",
  "ZC=F": "옥수수",
  "ZS=F": "콩",
  "ZW=F": "밀",
  LIT: "리튬",
  REMX: "희토류",
};

// §5 카테고리별 가격 추이 — 시안 그대로 3 sub-chart (각 2 symbol)
const SUB_CHART_GROUPS: Array<{ label: string; symbols: string[]; colors: string[] }> = [
  { label: "에너지 섹터 흐름 (WTI · 천연가스)", symbols: ["CL=F", "NG=F"], colors: ["#c1121f", "#4073ff"] },
  { label: "산업금속 섹터 흐름 (구리 · 리튬)", symbols: ["HG=F", "LIT"], colors: ["#fdb43a", "#60c846"] },
  { label: "귀금속 섹터 흐름 (금 · 은)", symbols: ["GC=F", "SI=F"], colors: ["#fdb43a", "#003049"] },
];

export function CommodityDetail({
  ticker,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
}: CommodityDetailProps) {
  const [data, setData] = useState<DetailState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    Promise.all([loadCompanySnapshot(ticker), loadCommodities(undefined, 252)])
      .then(([snapshot, commodities]) => {
        if (alive) setData({ snapshot, commodities });
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
    // 종목별 차별화: stockHistory 전달 (가격 상관계수 기반)
    const gauge = commodityImpactGauge(
      data.snapshot.company,
      data.commodities.history,
      data.snapshot.technicalHistory,
    );
    const stats = allSymbolStats(data.commodities.history);
    const normalized = categoryNormalized(data.commodities.history);
    const wtiNgRatio = ratioSeries(data.commodities.history, "CL=F", "NG=F");
    return { gauge, stats, normalized, wtiNgRatio };
  }, [data]);

  const updatedAt =
    data?.commodities.history[0]?.date ??
    data?.commodities.latest[0]?.date ??
    undefined;

  return (
    <DetailShell
      ticker={ticker}
      active="commodity"
      pageTitle="원자재 영향 분석"
      pageSubtitle={`${data?.snapshot.company.name ?? ticker}의 주요 원자재 관련 비용 및 매출 영향과 시장 동향을 분석합니다.`}
      updatedAt={updatedAt ? `${updatedAt} (ET)` : undefined}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <div style={S.error}>로드 실패: {error}</div>}
      {!error && (!data || !analysis) && <div style={S.loading}>분석 중…</div>}
      {data && analysis && (
        <>
          {/* 1) 핵심 요약 */}
          <section style={S.summarySection}>
            <div style={S.summaryLeft}>
              <div style={S.cardHeaderRow}>
                <span style={S.cardTitle}>핵심 요약</span>
                <ExampleBadge title="요약 본문 텍스트는 시안 mock — LLM 합성 또는 정적 텍스트" />
              </div>
              <p style={S.summaryBody}>
                {data.snapshot.company.name ?? ticker}의 주요 원자재 가격 변동에 따른
                비용·공급·전망을 단순 요약합니다. 섹터(
                {data.snapshot.company.sector ?? "—"}) 기반 가중치로 산출됩니다.
              </p>
              <div style={S.chipsRow}>
                {/* 비용 영향 = gauge.score 에서 산출 (REAL) */}
                <StatusChip
                  label="비용 영향"
                  value={analysis.gauge.score && analysis.gauge.score < 35 ? "부정적" : analysis.gauge.score && analysis.gauge.score < 60 ? "중립" : "긍정적"}
                  tone={
                    analysis.gauge.score && analysis.gauge.score < 35
                      ? "negative"
                      : analysis.gauge.score && analysis.gauge.score >= 60
                        ? "positive"
                        : "caution"
                  }
                />
                {/* 공급 안정성·향후 전망 = 시안 mock (해당 신호 산출 미구현) */}
                <div style={S.chipWithBadge}>
                  <StatusChip label="공급 안정성" value="양호" tone="positive" />
                  <ExampleBadge style={S.chipBadge} />
                </div>
                <div style={S.chipWithBadge}>
                  <StatusChip label="향후 전망" value="중립" tone="neutral" />
                  <ExampleBadge style={S.chipBadge} />
                </div>
              </div>
            </div>
            <div style={S.summaryRight}>
              <div style={S.cardTitle}>원자재가 종합 영향 점수</div>
              <div style={S.gaugeBlock}>
                <Donut gauge={analysis.gauge} size={140} thickness={14} />
                <div style={{ ...S.gaugeLabel, color: severityColor(analysis.gauge.severity) }}>
                  {analysis.gauge.label}
                </div>
              </div>
            </div>
          </section>

          {/* 2) 4 mini cards */}
          <section style={S.miniRow}>
            {MINI_SYMBOLS.map((m) => {
              const stat = symbolStat(data.commodities.history, m.symbol);
              const pct = stat?.pctYoY ?? null;
              const tone: "up" | "down" | "neutral" =
                pct == null ? "neutral" : pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
              const valueStr =
                stat?.latest != null
                  ? formatPrice(stat.latest)
                  : "—";
              return (
                <MiniCard
                  key={m.symbol}
                  label={m.name}
                  value={valueStr}
                  unit={m.unit}
                  tone={tone}
                  delta={
                    pct != null
                      ? {
                          text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% (1y)`,
                          tone,
                        }
                      : undefined
                  }
                />
              );
            })}
          </section>

          {/* 3) 가격 그리드 + 변동률 비교 */}
          <section style={S.gridChartRow}>
            <div style={{ ...S.cardWithHeader }}>
              <div style={S.cardTitle}>주요 원자재 가격 현황</div>
              <div style={S.priceGrid}>
                {PRICE_GRID_SYMBOLS.map((s) => {
                  const stat = symbolStat(data.commodities.history, s);
                  const pct = stat?.pctYoY ?? null;
                  const tone: "up" | "down" | "neutral" =
                    pct == null ? "neutral" : pct > 0 ? "up" : "down";
                  return (
                    <MiniCard
                      key={s}
                      label={SYMBOL_KOR[s] ?? s}
                      value={stat?.latest != null ? formatPrice(stat.latest) : "—"}
                      tone={tone}
                      delta={
                        pct != null
                          ? { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% (1y)`, tone }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
            <div style={S.cardWithHeader}>
              <div style={S.cardTitle}>원자재별 연간 가격 변동률 비교</div>
              <BarChart
                data={PRICE_GRID_SYMBOLS.map((s) => {
                  const stat = symbolStat(data.commodities.history, s);
                  return {
                    label: SYMBOL_KOR[s] ?? s,
                    value: stat?.pctYoY ?? 0,
                  };
                })}
                height={240}
              />
            </div>
          </section>

          {/* 4) 시장 지표 표 + 변동성 매트릭스 */}
          <section style={S.tableScatterRow}>
            <div style={S.cardWithHeader}>
              <div style={S.cardTitle}>원자재 시장 지표 요약</div>
              <DataTable
                columns={STAT_COLUMNS}
                rows={analysis.stats.filter((s) => PRICE_GRID_SYMBOLS.includes(s.symbol))}
                rowKey={(r) => r.symbol}
              />
            </div>
            <div style={S.cardWithHeader}>
              <div style={S.cardTitle}>변동성-수익률 매트릭스</div>
              <ScatterPlot
                points={analysis.stats
                  .filter(
                    (s) =>
                      PRICE_GRID_SYMBOLS.includes(s.symbol) &&
                      s.volatility != null &&
                      s.pctYoY != null,
                  )
                  .map((s) => ({
                    label: SYMBOL_KOR[s.symbol] ?? s.symbol,
                    x: s.volatility!,
                    y: s.pctYoY!,
                  }))}
                xLabel="일간 변동성 (%)"
                yLabel="연간 수익률 (%)"
              />
            </div>
          </section>

          {/* 5) 카테고리별 가격 추이 — 3 sub-chart (각 카테고리 2 symbol) */}
          <section style={S.cardWithHeader}>
            <div style={S.cardTitle}>카테고리별 가격 추이</div>
            <div style={S.subChartRow}>
              {SUB_CHART_GROUPS.map((g) => {
                const series: LineSeries[] = g.symbols.map((s, i) => {
                  const stat = symbolStat(data.commodities.history, s);
                  return {
                    label: SYMBOL_KOR[s] ?? s,
                    values: stat?.series ?? [],
                    color: g.colors[i],
                  };
                });
                // x labels — 가장 길이 긴 시리즈의 날짜 (asc)
                const longest = series.reduce((acc, s) => (s.values.length > acc.values.length ? s : acc), series[0]);
                const dates = data.commodities.history
                  .filter((h) => h.symbol === g.symbols[0])
                  .map((h) => h.date)
                  .reverse();
                return (
                  <div key={g.label} style={S.subChartCell}>
                    <div style={S.subChartTitle}>{g.label}</div>
                    <MultiLineChart
                      series={series}
                      xLabels={dates.length === longest.values.length ? dates.map((d) => d.slice(2, 7)) : undefined}
                      yAxisFormatter={(v) => formatPrice(v)}
                      showXLabels={4}
                      viewBoxWidth={500}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* 6) 시장 이슈 3 카드 — EXAMPLE */}
          <section style={S.cardWithHeader}>
            <div style={S.cardHeaderRow}>
              <span style={S.cardTitle}>주요 섹터별 시장 이슈 분석</span>
              <ExampleBadge title="본문 텍스트는 시안 mock — LLM 합성 또는 정적 텍스트 영역" />
            </div>
            <div style={S.issueRow}>
              <IssueCard
                category="귀금속 (금·은)"
                weight="Overweight"
                weightTone="positive"
                body="달러 강세에도 신고가 경신. 탈달러화·중앙은행 실수요 + 인플레 헷지 수요 동시 작용. 은도 산업 수요 결합으로 강세 전환 시그널."
              />
              <IssueCard
                category="산업금속 & 에너지"
                weight="Neutral"
                weightTone="neutral"
                body="구리 우상향이 제조업 바닥 통과 시사. 리튬 숏커버링 기회 상존. 단 천연가스 공급 과잉이 탄력 제한. 섹터 ETF보다 종목별 접근."
              />
              <IssueCard
                category="농산물 (곡물)"
                weight="Underweight"
                weightTone="negative"
                body="섹터 전반 장기 하락 트렌드. 남미 풍작 사이클 지속. 단, 밀(RSI 68)만 흑해 지정학 리스크로 기술적 강세 전환 시그널."
              />
            </div>
          </section>

          {/* 7) 자산군 정규화 + WTI vs 천연가스 */}
          <section style={S.normRatioRow}>
            <div style={S.cardWithHeader}>
              <div style={S.cardTitle}>자산군 정규화 사이클 (Base = 100)</div>
              <MultiLineChart
                series={analysis.normalized.slice(0, 4).map((n, i): LineSeries => ({
                  label: n.category,
                  values: n.values,
                  color: ["#003049", "#c1121f", "#60c846", "#fdb43a"][i],
                }))}
                xLabels={analysis.normalized[0]?.dates.map((d) => d.slice(2, 7)) ?? []}
                yAxisFormatter={(v) => v.toFixed(0)}
                height={240}
              />
            </div>
            <div style={S.cardWithHeader}>
              <div style={S.cardTitle}>에너지 · WTI vs 천연가스 괴리율</div>
              <Sparkline
                values={analysis.wtiNgRatio.values}
                width="100%"
                height={240}
                color="var(--color-down)"
                fillOpacity={0.08}
                strokeWidth={2}
              />
              <div style={S.ratioMeta}>
                <span style={S.ratioMetaItem}>
                  최신 비율: {(() => {
                    const v = analysis.wtiNgRatio.values.filter(
                      (x): x is number => x != null,
                    );
                    return v.length > 0 ? v[v.length - 1].toFixed(2) : "—";
                  })()}
                </span>
                <span style={S.ratioMetaItem}>(WTI / NG)</span>
              </div>
            </div>
          </section>
        </>
      )}
    </DetailShell>
  );
}

function IssueCard({
  category,
  weight,
  weightTone,
  body,
}: {
  category: string;
  weight: string;
  weightTone: "positive" | "negative" | "neutral";
  body: string;
}) {
  const color =
    weightTone === "positive"
      ? "var(--color-up-strong)"
      : weightTone === "negative"
        ? "var(--color-down)"
        : "var(--color-text-muted)";
  const bg =
    weightTone === "positive"
      ? "var(--color-up-bg)"
      : weightTone === "negative"
        ? "var(--color-down-bg)"
        : "var(--color-header-bg)";
  return (
    <div style={S.issueCard}>
      <div style={S.issueHead}>
        <span style={S.issueCategory}>{category}</span>
        <span style={{ ...S.issueWeight, color, background: bg }}>{weight}</span>
      </div>
      <p style={S.issueBody}>{body}</p>
    </div>
  );
}

function severityColor(s: "WARNING" | "CAUTION" | "INFO"): string {
  if (s === "WARNING") return "var(--color-down)";
  if (s === "CAUTION") return "var(--color-warn)";
  return "var(--color-up-strong)";
}

function formatPrice(v: number): string {
  if (v >= 100) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

const STAT_COLUMNS: DataTableColumn<CommodityStat>[] = [
  {
    key: "symbol",
    header: "원자재",
    align: "left",
    render: (r) => SYMBOL_KOR[r.symbol] ?? r.symbol,
  },
  {
    key: "category",
    header: "카테고리",
    align: "left",
    render: (r) => r.category ?? "—",
  },
  {
    key: "latest",
    header: "최신 가격",
    align: "right",
    render: (r) => (r.latest != null ? formatPrice(r.latest) : "—"),
  },
  {
    key: "pctYoY",
    header: "1y 변동",
    align: "right",
    render: (r) => {
      if (r.pctYoY == null) return "—";
      const color = r.pctYoY >= 0 ? "var(--color-up)" : "var(--color-down)";
      return (
        <span style={{ color, fontWeight: 600 }}>
          {r.pctYoY >= 0 ? "+" : ""}
          {r.pctYoY.toFixed(1)}%
        </span>
      );
    },
  },
  {
    key: "volatility",
    header: "일간 변동성",
    align: "right",
    render: (r) => (r.volatility != null ? `${r.volatility.toFixed(2)}%` : "—"),
  },
  {
    key: "trend",
    header: "추이",
    align: "left",
    render: (r) => (
      <Sparkline
        values={r.series.slice(-60)}
        width={80}
        height={24}
        strokeWidth={1.5}
        color={r.pctYoY != null && r.pctYoY >= 0 ? "var(--color-up)" : "var(--color-down)"}
        fillOpacity={0.1}
      />
    ),
  },
];

const S: Record<string, CSSProperties> = {
  loading: { color: "var(--color-text-muted)", padding: 64, textAlign: "center" },
  error: {
    color: "var(--color-down)",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 16,
  },

  cardWithHeader: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
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

  /* 1) 핵심 요약 */
  summarySection: {
    display: "grid",
    gridTemplateColumns: "1fr minmax(280px, 360px)",
    gap: 16,
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "20px 24px",
  },
  summaryLeft: { display: "flex", flexDirection: "column", gap: 12 },
  summaryRight: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "flex-start",
    borderLeft: "1px solid var(--color-border)",
    paddingLeft: 24,
  },
  summaryBody: {
    fontSize: "var(--font-size-base)",
    color: "var(--color-text-body)",
    lineHeight: 1.5,
    fontWeight: 500,
  },
  chipsRow: { display: "flex", gap: 24, flexWrap: "wrap" },
  gaugeBlock: { display: "flex", alignItems: "center", gap: 16 },
  gaugeLabel: {
    fontSize: "var(--font-size-3xl)",
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
  },

  /* 2) mini row */
  miniRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },

  /* 3) 가격 그리드 + bar */
  gridChartRow: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 1fr) 1fr",
    gap: 16,
    alignItems: "stretch",
  },
  priceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },

  /* 4) 표 + scatter */
  tableScatterRow: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 1.2fr) 1fr",
    gap: 16,
    alignItems: "stretch",
  },

  /* 5) sub chart row */
  subChartRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  subChartCell: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  subChartTitle: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
  },

  /* status chip with badge overlay */
  chipWithBadge: { position: "relative" },
  chipBadge: { position: "absolute", top: -2, right: -8 },

  /* 6) 이슈 row */
  issueRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  issueCard: {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  issueHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  issueCategory: {
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  issueWeight: {
    fontSize: "var(--font-size-xxs)",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "var(--radius-tag)",
    letterSpacing: "0.04em",
  },
  issueBody: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-body)",
    lineHeight: 1.55,
    fontWeight: 500,
  },

  /* 7) 정규화 + 비율 */
  normRatioRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "stretch",
  },
  ratioMeta: {
    display: "flex",
    gap: 12,
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    fontFamily: "var(--font-numeric)",
  },
  ratioMetaItem: { fontWeight: 600 },
};
