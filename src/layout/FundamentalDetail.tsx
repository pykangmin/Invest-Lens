// FundamentalDetail — 기업 펀더멘털 detail 화면.
// spec: docs/figma/dashboard-slots-v4.md §6.1 (Figma node 376:483)
// data-coverage: docs/figma/data-coverage-v4.md §4a
//
// 섹션:
//   1) Hero — 종합 점수 도넛 + 본문·요약 (gauge.score)
//   2) 9 mini metric grid (FCF Margin / ROE / 순이익률 / 매출성장 / EPS 성장 / FCF Yield / Debt/Equity / PER / PBR)
//   3) 분기 추이 multi-line — ROE / netProfitMargin / fcfMargin (forward-filled)
//   4) 지표 기여도 표 — 종합 점수에 들어간 5 metric × 가중치 1/5
//   5) 동종업계 비교 표 — EXAMPLE
//   6) 핵심 강점 / 리스크 카드 — EXAMPLE

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fundamentalGauge } from "../analysis/fundamental";
import {
  fundamentalContribution,
  fundamentalQuarterlySeries,
  type FundamentalMetric,
} from "../analysis/fundamentalDetail";
import { loadCompanySnapshot } from "../data-loader/investmentData";
import type { CompanySnapshot } from "../types/investment";
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
  MetricCardGrid,
} from "./detail";

export interface FundamentalDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

// gauge 합산에 들어가는 5 metric (각 1/5 가중치)
const GAUGE_METRIC_KEYS = ["roe", "netProfitMargin", "fcfYield", "debtToEquity", "per"] as const;

interface PeerRow {
  ticker: string;
  name: string;
  per: string;
  pbr: string;
  roe: string;
  margin: string;
}

const EXAMPLE_PEERS: PeerRow[] = [
  { ticker: "AAPL", name: "Apple Inc.", per: "32.4x", pbr: "57.9x", roe: "152.0%", margin: "26.0%" },
  { ticker: "MSFT", name: "Microsoft", per: "37.1x", pbr: "12.4x", roe: "39.4%", margin: "36.0%" },
  { ticker: "GOOGL", name: "Alphabet", per: "26.0x", pbr: "7.5x", roe: "30.6%", margin: "29.0%" },
  { ticker: "META", name: "Meta", per: "27.5x", pbr: "9.1x", roe: "32.1%", margin: "33.4%" },
  { ticker: "AMZN", name: "Amazon", per: "45.7x", pbr: "8.4x", roe: "20.1%", margin: "8.0%" },
];

export function FundamentalDetail({
  ticker,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
}: FundamentalDetailProps) {
  const [data, setData] = useState<CompanySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    loadCompanySnapshot(ticker, 24)
      .then((s) => {
        if (alive) setData(s);
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
    const gauge = fundamentalGauge(data.latestFundamentals);
    const contribution = fundamentalContribution(data.latestFundamentals);
    const quarterly = fundamentalQuarterlySeries(data.fundamentalsHistory, [
      "roe",
      "netProfitMargin",
      "fcfMargin",
    ]);
    const growthQuarterly = fundamentalQuarterlySeries(data.fundamentalsHistory, [
      "revenueGrowth",
      "epsGrowth",
    ]);
    return { gauge, contribution, quarterly, growthQuarterly };
  }, [data]);

  const updatedAt = data?.latestFundamentals?.date ?? undefined;

  return (
    <DetailShell
      ticker={ticker}
      active="fundamental"
      pageTitle="기업 펀더멘털"
      pageSubtitle={`${data?.company.name ?? ticker}의 수익성·성장성·재무안정성·밸류에이션 9 지표를 점검합니다.`}
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
          {/* 1) Hero */}
          <HeroSummaryBlock
            title="펀더멘털 종합 평가"
            body={
              <p>
                ROE·순이익률·FCF Yield·부채비율·PER 5개 지표 평균 합산.{" "}
                <strong>
                  {analysis.gauge.score != null ? `${analysis.gauge.score}/100` : "—"}
                </strong>
                {" "}— {analysis.gauge.tagline}.
              </p>
            }
            chips={
              <div style={S.chipChunkRow}>
                {analysis.contribution.metrics
                  .filter((m) => GAUGE_METRIC_KEYS.includes(m.key as (typeof GAUGE_METRIC_KEYS)[number]))
                  .map((m) => (
                    <MetricChip key={m.key} metric={m} />
                  ))}
              </div>
            }
            rightTitle="종합 스코어"
            right={
              <>
                <Donut gauge={analysis.gauge} size={140} thickness={14} />
                <div style={{ ...S.gaugeLabel, color: gaugeColor(analysis.gauge.severity) }}>
                  {analysis.gauge.label}
                </div>
              </>
            }
          />

          {/* 2) 9 metric grid */}
          <DetailSectionBox title="주요 펀더멘털 지표 (9종)">
            <MetricCardGrid columns={3} gap={10}>
              {analysis.contribution.metrics.map((m) => (
                <MetricCard key={m.key} metric={m} />
              ))}
            </MetricCardGrid>
          </DetailSectionBox>

          {/* 3) 분기 추이 (수익성·재무) */}
          <div style={S.twoCol}>
            <DetailSectionBox title="수익성 분기 추이 (forward-filled)">
              <MultiLineChart
                series={analysis.quarterly.map((q, i): LineSeries => ({
                  label: q.label,
                  values: q.values.map((v) => (v != null ? v * 100 : null)),
                  color: ["#003049", "#60c846", "#fdb43a"][i],
                }))}
                xLabels={analysis.quarterly[0]?.dates.map((d) => d.slice(2, 7)) ?? []}
                yAxisFormatter={(v) => `${v.toFixed(0)}%`}
                showXLabels={6}
                height={260}
              />
            </DetailSectionBox>
            <DetailSectionBox title="성장 분기 추이">
              <MultiLineChart
                series={analysis.growthQuarterly.map((q, i): LineSeries => ({
                  label: q.label,
                  values: q.values.map((v) => (v != null ? v * 100 : null)),
                  color: ["#c1121f", "#4073ff"][i],
                }))}
                xLabels={analysis.growthQuarterly[0]?.dates.map((d) => d.slice(2, 7)) ?? []}
                yAxisFormatter={(v) => `${v.toFixed(0)}%`}
                showXLabels={6}
                height={260}
              />
            </DetailSectionBox>
          </div>

          {/* 4) 종합 점수 기여도 */}
          <DetailSectionBox title="종합 점수 기여도 (5 metric × 1/5)">
            <div style={S.contribRows}>
              {analysis.contribution.metrics
                .filter((m) => GAUGE_METRIC_KEYS.includes(m.key as (typeof GAUGE_METRIC_KEYS)[number]))
                .map((m) => (
                  <ContributionRow
                    key={m.key}
                    label={`${m.label} (${m.display})`}
                    score={m.score != null ? Math.round(m.score / 5) : null}
                    max={20}
                    tone={m.tone}
                  />
                ))}
              <ContributionRow
                label="총합"
                score={analysis.gauge.score}
                max={100}
                tone={
                  analysis.gauge.severity === "INFO"
                    ? "up"
                    : analysis.gauge.severity === "WARNING"
                      ? "down"
                      : "neutral"
                }
                total
              />
            </div>
          </DetailSectionBox>

          {/* 5) 동종업계 비교 — EXAMPLE */}
          <DetailSectionBox
            title="동종업계 비교 (예시)"
            exampleNote="peers 데이터 부재 — 시안 mock"
          >
            <DataTable
              columns={PEER_COLUMNS}
              rows={EXAMPLE_PEERS}
              rowKey={(r) => r.ticker}
            />
          </DetailSectionBox>

          {/* 6) 강점 / 리스크 — EXAMPLE */}
          <div style={S.twoCol}>
            <DetailSectionBox
              title="핵심 강점"
              exampleNote="본문 mock — LLM 합성 또는 정적 텍스트"
            >
              <ul style={S.bullets}>
                <li>꾸준한 마진 개선과 자본 효율성 (ROE 우상향)</li>
                <li>현금 창출력 우수 — FCF Margin 과 Yield 동시 강세</li>
                <li>동종업계 대비 부채 비율 하단 위치, 재무 안정성 양호</li>
              </ul>
            </DetailSectionBox>
            <DetailSectionBox
              title="잠재 리스크"
              exampleNote="본문 mock — LLM 합성 또는 정적 텍스트"
            >
              <ul style={S.bullets}>
                <li>매출 성장률이 직전 분기 대비 둔화 — 시장 기대 대비 모멘텀 약화</li>
                <li>밸류에이션이 동종 중위값 대비 다소 부담</li>
                <li>특정 사업부 의존도가 높아 다각화 리스크 상존</li>
              </ul>
            </DetailSectionBox>
          </div>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function MetricChip({ metric }: { metric: FundamentalMetric }) {
  const color =
    metric.tone === "up"
      ? "var(--color-up-strong)"
      : metric.tone === "down"
        ? "var(--color-down)"
        : "var(--color-text-muted)";
  const bg =
    metric.tone === "up"
      ? "var(--color-up-bg)"
      : metric.tone === "down"
        ? "var(--color-down-bg)"
        : "var(--color-header-bg)";
  return (
    <span style={{ ...S.chip, color, background: bg }}>
      <span style={S.chipLabel}>{metric.label}</span>
      <span style={S.chipValue}>{metric.display}</span>
      {metric.value == null && <ExampleBadge text="결측" tone="stub" style={S.chipBadge} />}
    </span>
  );
}

function MetricCard({ metric }: { metric: FundamentalMetric }) {
  const color =
    metric.tone === "up"
      ? "var(--color-up-strong)"
      : metric.tone === "down"
        ? "var(--color-down)"
        : "var(--color-text)";
  return (
    <div style={S.metricCard}>
      <div style={S.metricCardHead}>
        <span style={S.metricLabel}>{metric.label}</span>
        {metric.value == null && <ExampleBadge text="결측" tone="stub" />}
      </div>
      <div style={{ ...S.metricValue, color }}>{metric.display}</div>
      <div style={S.metricNote}>{metric.note}</div>
    </div>
  );
}

function gaugeColor(s: "WARNING" | "CAUTION" | "INFO"): string {
  if (s === "WARNING") return "var(--color-down)";
  if (s === "CAUTION") return "var(--color-warn)";
  return "var(--color-up-strong)";
}

const PEER_COLUMNS: DataTableColumn<PeerRow>[] = [
  { key: "ticker", header: "티커", align: "left", render: (r) => <strong>{r.ticker}</strong> },
  { key: "name", header: "기업명", align: "left", render: (r) => r.name },
  { key: "per", header: "PER", align: "right", render: (r) => r.per },
  { key: "pbr", header: "PBR", align: "right", render: (r) => r.pbr },
  { key: "roe", header: "ROE", align: "right", render: (r) => r.roe },
  { key: "margin", header: "순이익률", align: "right", render: (r) => r.margin },
  {
    key: "trend",
    header: "추이",
    align: "left",
    render: () => (
      <Sparkline
        values={[80, 82, 78, 85, 88, 91, 89, 93, 95, 92, 96, 100]}
        width={80}
        height={24}
        strokeWidth={1.5}
        color="var(--color-up)"
        fillOpacity={0.1}
      />
    ),
  },
];

const S: Record<string, CSSProperties> = {
  gaugeLabel: {
    fontSize: "var(--font-size-3xl)",
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
  },
  chipChunkRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
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

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "stretch",
  },

  contribRows: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  metricCard: {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  metricCardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  metricLabel: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
  },
  metricValue: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
  },
  metricNote: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-faint)",
    fontWeight: 500,
  },

  bullets: {
    margin: 0,
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: "var(--font-size-base)",
    color: "var(--color-text-body)",
    lineHeight: 1.55,
  },
};
