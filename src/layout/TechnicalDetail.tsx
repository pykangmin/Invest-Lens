// TechnicalDetail — 기술적 지표 스코어카드 detail 화면.
// spec: docs/figma/dashboard-slots-v4.md §5 (Figma node 327:456)
// data-coverage: docs/figma/data-coverage-v4.md §4
//
// 섹션 (위→아래):
//   1) Hero — 종합 점수 도넛 + 6 chip + 본문 / 신호 등급 bar
//   2) 종합 점수 추이 (60일 재계산)
//   3) 6 metric ContributionRow + 총합
//   4) 지표 detail table — 지표 / sparkline / 요약 / 점수
//   5) 주가 + MA20·MA50·MA200 multi-line

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  signalLabel,
  signalTone,
  sma20FromCloseDesc,
  technicalAnalysisV4,
  type TechnicalAnalysisV4,
  type TechnicalMetricScore,
  type TechnicalSignal,
} from "../analysis/technicalV4";
import {
  loadCompanySnapshot,
  loadGlobalEnvironment,
} from "../data-loader/investmentData";
import type {
  CompanySnapshot,
  GlobalEnvironmentResponse,
  StockPriceTech,
} from "../types/investment";
import type { GaugeScore } from "../types/scoring";
import { DataTable, type DataTableColumn } from "../visualization/DataTable";
import { Donut } from "../visualization/Donut";
import { ExampleBadge } from "../visualization/ExampleBadge";
import { MultiLineChart, type LineSeries } from "../visualization/MultiLineChart";
import { Sparkline } from "../visualization/Sparkline";
import { DetailShell, type DetailSection } from "./DetailShell";
import {
  ContributionRow,
  DetailSectionBox,
  EmptyState,
  HeroSummaryBlock,
} from "./detail";

interface DetailState {
  snapshot: CompanySnapshot;
  vix: GlobalEnvironmentResponse;
}

export interface TechnicalDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

const SIGNALS: TechnicalSignal[] = ["STRONG_SELL", "SELL", "HOLD", "BUY", "STRONG_BUY"];

export function TechnicalDetail({
  ticker,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
}: TechnicalDetailProps) {
  const [data, setData] = useState<DetailState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    Promise.all([
      loadCompanySnapshot(ticker, 252),
      loadGlobalEnvironment({ symbol: "^VIX", historyLimit: 120 }),
    ])
      .then(([snapshot, vix]) => {
        if (alive) setData({ snapshot, vix });
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const analysis = useMemo<TechnicalAnalysisV4 | null>(() => {
    if (!data) return null;
    return technicalAnalysisV4(
      data.snapshot.technicalHistory,
      data.vix.latest[0] ?? null,
      data.vix.history,
    );
  }, [data]);

  const ma20 = useMemo(() => {
    if (!data) return [];
    return sma20FromCloseDesc(data.snapshot.technicalHistory);
  }, [data]);

  const updatedAt =
    data?.snapshot.technicalHistory[0]?.date ?? undefined;

  const totalGauge: GaugeScore | null = analysis
    ? toGauge(analysis.totalScore, analysis.signal)
    : null;

  return (
    <DetailShell
      ticker={ticker}
      active="technical"
      pageTitle="기술적 지표 스코어카드"
      pageSubtitle={`${data?.snapshot.company.name ?? ticker}의 가격·추세·모멘텀·심리·거래량 6개 지표를 100점 만점으로 합산합니다.`}
      updatedAt={updatedAt ? `${updatedAt} (ET)` : undefined}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <EmptyState variant="error" message={`로드 실패: ${error}`} />}
      {!error && (!data || !analysis || !totalGauge) && <EmptyState variant="loading" />}
      {data && analysis && totalGauge && (
        <>
          {/* 1) Hero */}
          <HeroSummaryBlock
            title="기술적 종합 점수"
            body={
              <p>
                Super Trend·이동평균선·MACD·RSI·VIX·거래량 6개 지표 가중 합산. 현재
                점수는 <strong>{analysis.totalScore}/100</strong>으로
                {" "}<strong>{signalLabel(analysis.signal)}</strong> 구간입니다.
              </p>
            }
            chips={
              <div style={S.chipChunkRow}>
                {analysis.metrics.map((m) => (
                  <MetricChip key={m.key} metric={m} />
                ))}
              </div>
            }
            rightTitle="종합 스코어"
            right={
              <>
                <Donut gauge={totalGauge} size={140} thickness={14} />
                <div style={{ ...S.signalLabel, color: signalToColor(analysis.signal) }}>
                  {signalLabel(analysis.signal).toUpperCase()}
                </div>
              </>
            }
          />

          {/* 1.b) 신호 등급 bar */}
          <DetailSectionBox title="신호 등급">
            <div style={S.signalBar}>
              {SIGNALS.map((s) => {
                const active = s === analysis.signal;
                return (
                  <div
                    key={s}
                    style={{
                      ...S.signalCell,
                      ...(active ? S.signalCellActive : null),
                      color: active ? signalToColor(s) : "var(--color-text-muted)",
                    }}
                  >
                    {signalLabel(s)}
                  </div>
                );
              })}
            </div>
          </DetailSectionBox>

          {/* 2) 종합 점수 추이 */}
          <DetailSectionBox
            title="종합 점수 추이 (60일)"
            exampleNote="과거 산출 점수 저장 기록 없음 — 직전 60일 close 기반 6-metric 재계산값"
          >
            <MultiLineChart
              series={[
                {
                  label: "종합",
                  values: analysis.scoreHistory.map((p) => p.score),
                  color: "#003049",
                },
              ]}
              xLabels={analysis.scoreHistory.map((p) => p.date.slice(2, 7))}
              yAxisFormatter={(v) => v.toFixed(0)}
              showXLabels={6}
              legendPosition="none"
              height={240}
            />
          </DetailSectionBox>

          {/* 3) 6-metric ContributionRow + 총합 */}
          <DetailSectionBox title="지표별 기여도 (6 metric × 가중치)">
            <div style={S.contribRows}>
              {analysis.metrics.map((m) => (
                <ContributionRow
                  key={m.key}
                  label={m.label}
                  score={m.available ? Math.round(m.score) : null}
                  max={m.max}
                  trailing={
                    m.series.length >= 2 ? (
                      <Sparkline
                        values={m.series.slice(-30)}
                        width={120}
                        height={30}
                        strokeWidth={1.5}
                        fillOpacity={0.12}
                      />
                    ) : null
                  }
                />
              ))}
              <ContributionRow
                label="총합"
                score={analysis.totalScore}
                max={100}
                tone={signalTone(analysis.signal)}
                total
              />
            </div>
          </DetailSectionBox>

          {/* 4) 지표 detail table */}
          <DetailSectionBox title="지표 상세 (요약 + 추이)">
            <DataTable
              columns={METRIC_TABLE_COLUMNS}
              rows={analysis.metrics}
              rowKey={(r) => r.key}
            />
          </DetailSectionBox>

          {/* 5) 평균이동선 차트 */}
          <DetailSectionBox title={`주가 + 이동평균선 (${ticker})`}>
            <MultiLineChart
              series={buildMASeries(data.snapshot.technicalHistory, ma20)}
              xLabels={[...data.snapshot.technicalHistory]
                .reverse()
                .map((t) => t.date.slice(2, 7))}
              yAxisFormatter={(v) => v.toFixed(0)}
              showXLabels={8}
              height={260}
            />
          </DetailSectionBox>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function MetricChip({ metric }: { metric: TechnicalMetricScore }) {
  const t = metric.score / metric.max;
  const tone = !metric.available ? "neutral" : t >= 0.6 ? "up" : t < 0.3 ? "down" : "neutral";
  const color =
    tone === "up"
      ? "var(--color-up-strong)"
      : tone === "down"
        ? "var(--color-down)"
        : "var(--color-text-muted)";
  const bg =
    tone === "up"
      ? "var(--color-up-bg)"
      : tone === "down"
        ? "var(--color-down-bg)"
        : "var(--color-header-bg)";
  return (
    <span style={{ ...S.chip, color, background: bg }}>
      <span style={S.chipLabel}>{metric.label}</span>
      <span style={S.chipValue}>
        {metric.available ? `${Math.round(metric.score)}/${metric.max}` : "—"}
      </span>
      {!metric.available && <ExampleBadge text="결측" tone="stub" style={S.chipBadge} />}
    </span>
  );
}

function toGauge(totalScore: number, signal: TechnicalSignal): GaugeScore {
  const severity = totalScore >= 60 ? "INFO" : totalScore >= 30 ? "CAUTION" : "WARNING";
  return {
    id: "technical",
    label: signalLabel(signal).toUpperCase(),
    tagline: signalLabel(signal),
    score: totalScore,
    severity,
    available: true,
  };
}

function signalToColor(s: TechnicalSignal): string {
  if (s === "STRONG_BUY" || s === "BUY") return "var(--color-up-strong)";
  if (s === "SELL" || s === "STRONG_SELL") return "var(--color-down)";
  return "var(--color-warn)";
}

function buildMASeries(
  historyDesc: StockPriceTech[],
  ma20Asc: Array<{ date: string; value: number | null }>,
): LineSeries[] {
  const asc = [...historyDesc].reverse();
  const closes = asc.map((t) => t.close);
  const ma50 = asc.map((t) => t.ma50);
  const ma200 = asc.map((t) => t.ma200);
  return [
    { label: "Close", values: closes, color: "#003049" },
    { label: "MA20", values: ma20Asc.map((p) => p.value), color: "#fdb43a" },
    { label: "MA50", values: ma50, color: "#60c846" },
    { label: "MA200", values: ma200, color: "#c1121f" },
  ];
}

const METRIC_TABLE_COLUMNS: DataTableColumn<TechnicalMetricScore>[] = [
  {
    key: "label",
    header: "지표",
    align: "left",
    render: (r) => <span style={{ fontWeight: 600 }}>{r.label}</span>,
  },
  {
    key: "trend",
    header: "최근 추이",
    align: "left",
    render: (r) =>
      r.series.length >= 2 ? (
        <Sparkline
          values={r.series.slice(-30)}
          width={100}
          height={28}
          strokeWidth={1.5}
          fillOpacity={0.12}
        />
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>—</span>
      ),
  },
  {
    key: "note",
    header: "요약",
    align: "left",
    render: (r) => (
      <span style={{ color: r.available ? "var(--color-text)" : "var(--color-text-muted)" }}>
        {r.note}
      </span>
    ),
  },
  {
    key: "score",
    header: "점수",
    align: "right",
    render: (r) => {
      if (!r.available) return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
      const t = r.score / r.max;
      const color = t >= 0.6 ? "var(--color-up-strong)" : t < 0.3 ? "var(--color-down)" : "var(--color-text)";
      return (
        <span style={{ color, fontWeight: 700 }}>
          {Math.round(r.score)}/{r.max}
        </span>
      );
    },
  },
];

const S: Record<string, CSSProperties> = {
  signalLabel: {
    fontSize: "var(--font-size-3xl)",
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
  },
  chipChunkRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  chip: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "8px 12px",
    borderRadius: "var(--radius-tag)",
    border: "1px solid var(--color-border)",
  },
  chipLabel: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 600,
    opacity: 0.8,
  },
  chipValue: {
    fontSize: "var(--font-size-md)",
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
  },
  chipBadge: { position: "absolute", top: -4, right: -6 },

  signalBar: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 4,
  },
  signalCell: {
    padding: "12px 8px",
    textAlign: "center",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-tag)",
  },
  signalCellActive: {
    background: "var(--color-card)",
    border: "2px solid currentColor",
    fontWeight: 800,
    fontSize: "var(--font-size-base)",
  },

  contribRows: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
};
