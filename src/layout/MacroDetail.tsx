// MacroDetail — 거시경제 국면 모니터 detail 화면.
// spec: docs/figma/dashboard-slots-v4.md §6.1 (Figma node 385:1470)
// data-coverage: docs/figma/data-coverage-v4.md §4b
//
// 섹션:
//   1) Hero — dominantRegime 라벨 + 도넛 + confidence
//   2) 4 regime 확률 카드 (Soft / No / Hard / Recovery)
//   3) Regime 확률 추이 multi-line (history)
//   4) 거시 시계열 4 (VIX / DXY / 10Y / HY Spread)
//   5) Regime breakdown 표 — EXAMPLE
//   6) 거시 신호 카드 — EXAMPLE

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { macroGauge } from "../analysis/macro";
import {
  macroIndicatorSeries,
  regimeContributionTable,
  regimeProbs,
  regimeQuarterlySeries,
  type MacroIndicatorSeries,
  type RegimeContribCell,
  type RegimeProb,
} from "../analysis/macroDetail";
import {
  loadGlobalEnvironment,
  loadMacroRegime,
} from "../data-loader/investmentData";
import type {
  GlobalEnvironmentResponse,
  MacroRegimeResponse,
} from "../types/investment";
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

interface DetailState {
  regime: MacroRegimeResponse;
  vix: GlobalEnvironmentResponse;
  dxy: GlobalEnvironmentResponse;
  treasury10y: GlobalEnvironmentResponse;
  hyspread: GlobalEnvironmentResponse;
}

export interface MacroDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
}

// 통계 기반 변수↔regime 기여도 행 — 기존 4 컬럼 (변수/기여도/관련 regime/사유) 구조 유지.
// 각 변수마다 |r| 가 최대인 regime 1개를 자동 선택 → contribution = r, regime = label, rationale = 자동 생성.
interface BreakdownRow {
  variable: string;
  contribution: number;
  regime: string;
  rationale: string;
}

const REGIME_KO: Record<RegimeContribCell["regime"], string> = {
  softLanding: "Soft Landing",
  noLanding: "No Landing",
  hardLanding: "Hard Landing",
  recovery: "Recovery",
};

// regime r 의 sign 과 강도에 따른 자연어 설명. variable name 은 그대로 노출.
function rationaleOf(variable: string, cell: RegimeContribCell): string {
  if (cell.r == null) return "표본 부족 — 통계 산출 불가";
  const dir = cell.r > 0 ? "동조" : "역행";
  const strength =
    cell.strengthLabel === "강"
      ? "강한"
      : cell.strengthLabel === "중"
        ? "중간"
        : cell.strengthLabel === "약"
          ? "약한"
          : "미미한";
  return `${variable} ↔ ${REGIME_KO[cell.regime]} ${dir} (Pearson ${cell.r.toFixed(2)}, ${strength} 상관)`;
}

export function MacroDetail({
  ticker,
  onBackToHome,
  onBackToOverview,
  onNavigateSection,
  onSelectTicker,
}: MacroDetailProps) {
  const [data, setData] = useState<DetailState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    Promise.all([
      loadMacroRegime(36),
      loadGlobalEnvironment({ symbol: "^VIX", historyLimit: 240 }),
      loadGlobalEnvironment({ symbol: "DX-Y.NYB", historyLimit: 240 }),
      loadGlobalEnvironment({ symbol: "DGS10", historyLimit: 240 }),
      loadGlobalEnvironment({ symbol: "BAMLH0A0HYM2", historyLimit: 240 }),
    ])
      .then(([regime, vix, dxy, treasury10y, hyspread]) => {
        if (alive) setData({ regime, vix, dxy, treasury10y, hyspread });
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
    const gauge = macroGauge(data.regime.latest);
    const probs = regimeProbs(data.regime.latest);
    const series = regimeQuarterlySeries(data.regime.history);
    const indicators = macroIndicatorSeries([
      { symbol: "^VIX", history: data.vix.history },
      { symbol: "DX-Y.NYB", history: data.dxy.history },
      { symbol: "DGS10", history: data.treasury10y.history },
      { symbol: "BAMLH0A0HYM2", history: data.hyspread.history },
    ]);
    const contribution = regimeContributionTable(data.regime.history, {
      vix: data.vix.history,
      dxy: data.dxy.history,
      dgs10: data.treasury10y.history,
      hy: data.hyspread.history,
    });
    return { gauge, probs, series, indicators, contribution };
  }, [data]);

  const breakdownRows = useMemo<BreakdownRow[]>(() => {
    if (!analysis) return [];
    const byVar = new Map<string, RegimeContribCell[]>();
    for (const cell of analysis.contribution.cells) {
      const arr = byVar.get(cell.variable) ?? [];
      arr.push(cell);
      byVar.set(cell.variable, arr);
    }
    // 변수별 |r| max regime 1개 선택 → 기존 4 컬럼 행으로 매핑.
    return analysis.contribution.variables.map((v) => {
      const cells = byVar.get(v) ?? [];
      let top: RegimeContribCell | null = null;
      for (const c of cells) {
        if (c.r == null) continue;
        if (top == null || Math.abs(c.r) > Math.abs(top.r ?? 0)) top = c;
      }
      if (!top) {
        return {
          variable: v,
          contribution: 0,
          regime: "—",
          rationale: "표본 부족 — 통계 산출 불가",
        };
      }
      return {
        variable: v,
        contribution: top.r ?? 0,
        regime: REGIME_KO[top.regime],
        rationale: rationaleOf(v, top),
      };
    });
  }, [analysis]);

  const updatedAt = data?.regime.latest?.date ?? undefined;

  return (
    <DetailShell
      ticker={ticker}
      active="macro"
      pageTitle="거시경제 국면 모니터"
      pageSubtitle="현재 거시경제 국면 (Soft / No / Hard / Recovery) 확률 분포와 주요 거시 시계열을 점검합니다."
      updatedAt={updatedAt ? `${updatedAt}` : undefined}
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
            title="거시 종합 평가"
            body={
              <p>
                현재 우세 regime: <strong>{analysis.gauge.tagline.replace("\n", " ")}</strong>
                {data.regime.latest?.confidence && (
                  <>
                    {" "}— 신뢰도{" "}
                    <strong>{data.regime.latest.confidence}</strong>
                  </>
                )}
                . 4 regime 확률 분포로 합산 점수 산출.
              </p>
            }
            chips={
              <div style={S.chipChunkRow}>
                {analysis.probs.map((p) => (
                  <RegimeChip key={p.key} prob={p} />
                ))}
              </div>
            }
            rightTitle="거시 점수"
            right={
              <>
                <Donut gauge={analysis.gauge} size={140} thickness={14} />
                <div style={{ ...S.gaugeLabel, color: gaugeColor(analysis.gauge.severity) }}>
                  {analysis.gauge.label}
                </div>
              </>
            }
          />

          {/* 2) 4 regime 확률 카드 */}
          <DetailSectionBox title="4 regime 확률">
            <MetricCardGrid columns={4} gap={10}>
              {analysis.probs.map((p) => (
                <RegimeCard key={p.key} prob={p} />
              ))}
            </MetricCardGrid>
          </DetailSectionBox>

          {/* 3) regime 추이 multi-line */}
          <DetailSectionBox title="Regime 확률 추이">
            <MultiLineChart
              series={analysis.series.series.map((s, i): LineSeries => ({
                label: s.label,
                values: s.values.map((v) => (v != null ? v * 100 : null)),
                color: ["#60c846", "#fdb43a", "#c1121f", "#4073ff"][i],
              }))}
              xLabels={analysis.series.dates.map((d) => d.slice(2, 7))}
              yAxisFormatter={(v) => `${v.toFixed(0)}%`}
              showXLabels={6}
              height={260}
            />
          </DetailSectionBox>

          {/* 4) 거시 시계열 4 */}
          <DetailSectionBox title="주요 거시 지표 시계열">
            <MetricCardGrid columns={4} gap={10}>
              {analysis.indicators.map((ind) => (
                <IndicatorCard key={ind.symbol} indicator={ind} />
              ))}
            </MetricCardGrid>
            <div style={S.indicatorChartRow}>
              {analysis.indicators.map((ind, i) => (
                <div key={ind.symbol} style={S.indicatorChart}>
                  <div style={S.indicatorChartTitle}>{ind.label}</div>
                  <Sparkline
                    values={ind.values.slice(-120)}
                    width="100%"
                    height={80}
                    strokeWidth={1.8}
                    color={["#c1121f", "#003049", "#4073ff", "#fdb43a"][i]}
                    fillOpacity={0.12}
                  />
                </div>
              ))}
            </div>
          </DetailSectionBox>

          {/* 5) Regime breakdown 표 — 변수별 |r| max regime (Pearson) */}
          <DetailSectionBox
            title="변수별 regime 기여도"
            rightSlot={
              <span style={S.sectionMeta}>
                Pearson 상관 · 표본 {analysis.contribution.sampleSize} 월말
              </span>
            }
          >
            <DataTable
              columns={BREAKDOWN_COLUMNS}
              rows={breakdownRows}
              rowKey={(r) => r.variable}
            />
          </DetailSectionBox>

          {/* 6) 종합 기여도 + 신호 카드 — EXAMPLE */}
          <div style={S.twoCol}>
            <DetailSectionBox title="국면별 평가 기여도">
              <div style={S.contribRows}>
                {analysis.probs.map((p) => (
                  <ContributionRow
                    key={p.key}
                    label={p.label}
                    score={p.pct != null ? Math.round(p.pct) : null}
                    max={100}
                    tone={
                      p.key === "softLanding" || p.key === "recovery"
                        ? "up"
                        : p.key === "hardLanding"
                          ? "down"
                          : "neutral"
                    }
                  />
                ))}
              </div>
            </DetailSectionBox>
            <DetailSectionBox
              title="거시 신호 / 경고"
              exampleNote="본문 mock — LLM 합성 또는 정적 텍스트"
            >
              <ul style={S.bullets}>
                <li>VIX 안정세 — 시장 변동성 위험은 평균 수준</li>
                <li>HY 스프레드 확장 시 Hard Landing 확률 급등 주의</li>
                <li>10Y 금리 안정 → 자산 가격 valuation 우호적</li>
                <li>DXY 약세 전환 시 신흥국·원자재 자산 우호</li>
              </ul>
            </DetailSectionBox>
          </div>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function RegimeChip({ prob }: { prob: RegimeProb }) {
  const tone = regimeTone(prob.key);
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
    <span style={{ ...S.chip, color, background: bg, ...(prob.isDominant ? S.chipDominant : null) }}>
      <span style={S.chipLabel}>{prob.label}</span>
      <span style={S.chipValue}>
        {prob.pct != null ? `${prob.pct.toFixed(0)}%` : "—"}
      </span>
      {prob.pct == null && <ExampleBadge text="결측" tone="stub" style={S.chipBadge} />}
    </span>
  );
}

function RegimeCard({ prob }: { prob: RegimeProb }) {
  const tone = regimeTone(prob.key);
  const color =
    tone === "up"
      ? "var(--color-up-strong)"
      : tone === "down"
        ? "var(--color-down)"
        : "var(--color-text)";
  return (
    <div style={{ ...S.metricCard, ...(prob.isDominant ? S.metricCardDominant : null) }}>
      <div style={S.metricCardHead}>
        <span style={S.metricLabel}>{prob.label}</span>
        {prob.isDominant && <span style={S.dominantTag}>DOMINANT</span>}
      </div>
      <div style={{ ...S.metricValue, color }}>
        {prob.pct != null ? `${prob.pct.toFixed(0)}%` : "—"}
      </div>
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: MacroIndicatorSeries }) {
  const tone =
    indicator.pctYoy == null
      ? "neutral"
      : indicator.pctYoy > 0
        ? "up"
        : "down";
  const color =
    tone === "up"
      ? "var(--color-up)"
      : tone === "down"
        ? "var(--color-down)"
        : "var(--color-text)";
  return (
    <div style={S.metricCard}>
      <div style={S.metricLabel}>{indicator.label}</div>
      <div style={{ ...S.metricValue, color: "var(--color-text)" }}>
        {indicator.latest != null ? indicator.latest.toFixed(2) : "—"}
      </div>
      <div style={{ ...S.metricNote, color }}>
        {indicator.pctYoy != null
          ? `${indicator.pctYoy >= 0 ? "+" : ""}${indicator.pctYoy.toFixed(1)}% YoY`
          : "—"}
      </div>
    </div>
  );
}

function regimeTone(k: RegimeProb["key"]): "up" | "down" | "neutral" {
  if (k === "softLanding" || k === "recovery") return "up";
  if (k === "hardLanding") return "down";
  return "neutral";
}

function gaugeColor(s: "WARNING" | "CAUTION" | "INFO"): string {
  if (s === "WARNING") return "var(--color-down)";
  if (s === "CAUTION") return "var(--color-warn)";
  return "var(--color-up-strong)";
}

const BREAKDOWN_COLUMNS: DataTableColumn<BreakdownRow>[] = [
  {
    key: "variable",
    header: "변수",
    align: "left",
    render: (r) => <strong>{r.variable}</strong>,
  },
  {
    key: "contribution",
    header: "기여도",
    align: "right",
    render: (r) => {
      const color = r.contribution >= 0 ? "var(--color-up-strong)" : "var(--color-down)";
      return (
        <span style={{ color, fontWeight: 700 }}>
          {r.contribution >= 0 ? "+" : ""}
          {r.contribution.toFixed(2)}
        </span>
      );
    },
  },
  { key: "regime", header: "관련 regime", align: "left", render: (r) => r.regime },
  { key: "rationale", header: "사유", align: "left", render: (r) => r.rationale },
];

const S: Record<string, CSSProperties> = {
  gaugeLabel: {
    fontSize: "var(--font-size-3xl)",
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
    whiteSpace: "pre-line",
  },
  chipChunkRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
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
  chipDominant: {
    border: "2px solid currentColor",
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
  metricCardDominant: {
    border: "2px solid var(--color-up-strong)",
    background: "var(--color-up-bg)",
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
    fontWeight: 600,
  },
  dominantTag: {
    fontSize: "var(--font-size-xxs)",
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "var(--radius-tag)",
    background: "var(--color-up-strong)",
    color: "var(--color-card)",
    letterSpacing: "0.04em",
  },

  indicatorChartRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  indicatorChart: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "10px 12px",
  },
  indicatorChartTitle: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
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
  sectionMeta: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
  },
};
