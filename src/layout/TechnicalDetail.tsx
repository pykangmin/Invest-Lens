// TechnicalDetail — 기술적 지표 스코어카드 detail 화면.
// spec: docs/figma/screens/main-technical.json (Figma node 327:456, 1440×1876)
//
// 시안 구조 (y기준, 콘텐츠 영역 x=236~1338, w=1102):
//   §1 (231-457, h=226) — 2-col:
//        종합 점수 요약(467w): 좌 큰 점수 도넛(139×139) + 우 "전일 대비" + "상승 기여" 6 chip(2x3)
//        신호 등급(622w): bg #f8f8f8 카드 안 4-segment gauge + status badge + tick + ▲ marker
//   §2 (469-788, h=319) — 종합 점수 추이: 차트 placeholder
//   §3 (800-1353, h=553) — 지표별 가이드:
//        기여도 요약(326,865,922×84): 7-tile (6 metric + 총합)
//        지표 detail table(347,1006,880×318): head row + 6 행 (지표/sparkline/요약/점수)
//   §4 (1365-1742, h=377) — 평균이동선 차트: 차트 placeholder

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
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
} from "../types/investment";
import { DetailShell, type DetailSection } from "./DetailShell";
import { EmptyState } from "./detail";

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

// 신호 등급 4-segment + 5개 눈금 (0/50/65/80/100). STRONG_SELL은 Sell 흡수, STRONG_BUY는 Strong buy.
interface SignalSegment {
  label: string;
  start: number;
  end: number;
  color: string;
  matches: TechnicalSignal[];
}
const SIGNAL_SEGMENTS: SignalSegment[] = [
  { label: "Sell", start: 0, end: 50, color: "#c1121f", matches: ["STRONG_SELL", "SELL"] },
  { label: "Hold", start: 50, end: 65, color: "#e5af43", matches: ["HOLD"] },
  { label: "Buy", start: 65, end: 80, color: "#33a316", matches: ["BUY"] },
  { label: "Strong buy", start: 80, end: 100, color: "#157f0a", matches: ["STRONG_BUY"] },
];
const SIGNAL_TICKS = [0, 50, 65, 80, 100];

// ──────────────────────────────────────────────────────────────
// 신규 분석 헬퍼
// ──────────────────────────────────────────────────────────────

// 1A.6 전일 대비 Δscore (scoreHistory 마지막 2개 차이)
function prevDayDelta(analysis: TechnicalAnalysisV4): {
  display: string;
  color: string;
} {
  const h = analysis.scoreHistory;
  if (h.length < 2) return { display: "—", color: "#737474" };
  const last = h[h.length - 1]?.score;
  const prev = h[h.length - 2]?.score;
  if (last == null || prev == null) return { display: "—", color: "#737474" };
  const diff = Math.round(last - prev);
  if (diff === 0) return { display: "±0pt", color: "#737474" };
  const sign = diff > 0 ? "+" : "";
  const color = diff > 0 ? "#60c846" : "#c1121f";
  return { display: `${sign}${diff}pt`, color };
}

// 1A.8 chip — 각 metric 의 직전 대비 Δ (series 끝에서 windowDays 전과 비교)
function metricDelta(
  metric: TechnicalMetricScore,
  windowDays = 7,
): string {
  if (!metric.available || metric.series.length < windowDays + 1) return "—";
  const last = metric.series[metric.series.length - 1];
  const prev = metric.series[metric.series.length - 1 - windowDays];
  if (last == null || prev == null) return "—";
  const diff = Math.round(last - prev);
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return "±0";
}

// 1A.2~1A.4 도넛 색상
function scoreColor(score: number): string {
  if (score >= 65) return "#60c846";
  if (score >= 50) return "#e5af43";
  return "#c1121f";
}

// 1B.2 active segment — marker 가 가리키는 segment (badge 텍스트/색상에 사용)
function activeSegment(score: number): SignalSegment {
  const v = Math.max(0, Math.min(100, score));
  for (const seg of SIGNAL_SEGMENTS) {
    if (v >= seg.start && v < seg.end) return seg;
  }
  return SIGNAL_SEGMENTS[SIGNAL_SEGMENTS.length - 1]!;
}

// 3B.3 metric trend — 최근 7일 동안 상승/하락 (series 첫 vs 마지막 비교)
function metricTrendColor(metric: TechnicalMetricScore): string {
  if (!metric.available) return "#9a9a9a";
  const last7 = metric.series.slice(-7).filter((v): v is number => v != null);
  if (last7.length < 2) return "#9a9a9a";
  const first = last7[0]!;
  const last = last7[last7.length - 1]!;
  const diff = last - first;
  if (diff > 0) return "#60c846"; // 상승 → 초록
  if (diff < 0) return "#c1121f"; // 하락 → 빨강
  return "#9a9a9a"; // 보합 → 회색
}

// ──────────────────────────────────────────────────────────────

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
      data.snapshot.latestSignals,
    );
  }, [data]);

  const updatedAt = useMemo(
    () => data?.snapshot.technicalHistory[0]?.date ?? undefined,
    [data],
  );

  return (
    <DetailShell
      ticker={ticker}
      active="technical"
      pageTitle="기술적 지표 스코어카드"
      pageSubtitle="다양한 기술적 지표와 차트 패턴을 종합 분석하여 투자 인사이트를 제공합니다."
      updatedAt={updatedAt ? `${updatedAt} (ET)` : undefined}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <EmptyState variant="error" message={`로드 실패: ${error}`} />}
      {!error && (!data || !analysis) && <EmptyState variant="loading" />}
      {data && analysis && (
        <>
          {/* §1 — 2-col: 종합 점수 요약 + 신호 등급 */}
          <div style={S.row1}>
            {/* §1-A 종합 점수 요약 */}
            <section style={S.scoreBox}>
              <div style={S.scoreBoxHeader}>종합 점수 요약</div>
              <div style={S.scoreBoxBody}>
                <ScoreCircle value={analysis.totalScore} />
                <div style={S.scoreBoxRight}>
                  <PrevDayDelta analysis={analysis} />
                  <div style={S.contribBlock}>
                    <div style={S.contribTitle}>상승 기여</div>
                    <div style={S.contribChipGrid}>
                      {analysis.metrics.map((m) => (
                        <ContribChip key={m.key} metric={m} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* §1-B 신호 등급 */}
            <section style={S.signalBox}>
              <div style={S.signalBoxHeader}>신호 등급</div>
              <SignalCard analysis={analysis} />
            </section>
          </div>

          {/* §2 종합 점수 추이 — graph placeholder */}
          <SectionBoxFull title="종합 점수 추이" height={255}>
            <GraphPlaceholder hint="60일 종합 점수 line chart" />
          </SectionBoxFull>

          {/* §3 지표별 가이드 */}
          <section style={S.row3}>
            <div style={S.row3Header}>지표별 기여도 (최근 1주일)</div>

            {/* 기여도 요약 7-tile */}
            <div style={S.contribTileRow}>
              {analysis.metrics.map((m) => (
                <ContribTile
                  key={m.key}
                  label={m.label}
                  score={m.available ? Math.round(m.score) : null}
                  max={m.max}
                />
              ))}
              <ContribTile
                label="총합"
                score={analysis.totalScore}
                max={100}
                isTotal
              />
            </div>

            {/* 표 (head + 6 row) */}
            <div style={S.tableBox}>
              <div style={S.tableHead}>
                <span style={{ ...S.tableHeadCell, flex: "0 0 174px" }}>지표</span>
                <span style={{ ...S.tableHeadCell, flex: "0 0 332px" }}>
                  최근 1주일 추이
                </span>
                <span style={{ ...S.tableHeadCell, flex: 1 }}>요약</span>
                <span style={{ ...S.tableHeadCell, flex: "0 0 60px", textAlign: "right" as const }}>
                  점수
                </span>
              </div>
              {analysis.metrics.map((m) => (
                <TableRow key={m.key} metric={m} />
              ))}
            </div>
          </section>

          {/* §4 평균이동선 차트 — graph placeholder */}
          <SectionBoxFull
            title="평균이동선 차트 (주가 · MA20 · MA50 · MA200)"
            height={313}
          >
            <GraphPlaceholder hint="Close + MA20 + MA50 + MA200 multi-line chart" />
          </SectionBoxFull>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function ScoreCircle({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = scoreColor(value);
  const r = 60;
  const cx = 69.5;
  const cy = 69.5;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;
  return (
    <div style={S.scoreCircleWrap}>
      <svg width={139} height={139} viewBox="0 0 139 139">
        <circle cx={cx} cy={cy} r={r} stroke="#d9d9d9" strokeWidth={14} fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={14}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div style={{ ...S.scoreCircleText, color }}>{value}</div>
    </div>
  );
}

function PrevDayDelta({ analysis }: { analysis: TechnicalAnalysisV4 }) {
  const d = prevDayDelta(analysis);
  return (
    <div style={S.deltaBlock}>
      <span style={S.deltaLabel}>전일 대비</span>
      <span style={{ ...S.deltaValue, color: d.color }}>{d.display}</span>
    </div>
  );
}

function ContribChip({ metric }: { metric: TechnicalMetricScore }) {
  const delta = metricDelta(metric, 7);
  return <span style={S.contribChip}>{metric.label}{delta}</span>;
}

function SignalCard({ analysis }: { analysis: TechnicalAnalysisV4 }) {
  return (
    <div style={S.signalCard}>
      <SignalGaugeBar score={analysis.totalScore} />
    </div>
  );
}

function SignalGaugeBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const seg = activeSegment(score);
  return (
    <div style={S.signalGaugeWrap}>
      {/* badge — marker 가 가리키는 segment 텍스트, marker 바로 위 */}
      <div
        style={{
          ...S.signalGaugeBadge,
          left: `${pct}%`,
          color: seg.color,
          background: "#ffffff",
          borderColor: seg.color,
        }}
      >
        {seg.label}
      </div>
      <div style={S.signalGaugeBar}>
        {SIGNAL_SEGMENTS.map((s) => {
          const width = s.end - s.start;
          return (
            <div
              key={s.label}
              style={{
                ...S.signalGaugeSeg,
                width: `${width}%`,
                background: s.color,
              }}
            >
              <span style={S.signalGaugeSegLabel}>{s.label}</span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          ...S.signalGaugeMarker,
          left: `${pct}%`,
        }}
      >
        <svg width="12" height="11" viewBox="0 0 12 11" style={{ display: "block" }}>
          <polygon points="6,11 0,0 12,0" fill="#003049" />
        </svg>
      </div>
      <div style={S.signalGaugeTicks}>
        {SIGNAL_TICKS.map((t) => (
          <span
            key={t}
            style={{
              ...S.signalGaugeTick,
              left: `${t}%`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// §3-B 표 추이 컬럼 — 최근 7일 점 + 직선 연결 미니 차트
function MiniLineChart({
  values,
  color,
  width = 300,
  height = 28,
}: {
  values: Array<number | null>;
  color: string;
  width?: number;
  height?: number;
}) {
  // 최근 7개 (null 제외)
  const last7 = values.slice(-7).filter((v): v is number => v != null);
  if (last7.length < 2) {
    return <span style={{ color: "#9a9a9a" }}>—</span>;
  }
  const min = Math.min(...last7);
  const max = Math.max(...last7);
  const span = max - min || 1;
  const padX = 6;
  const padY = 5;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;
  const xs = last7.map((_, i) => padX + (i / (last7.length - 1)) * innerW);
  const ys = last7.map((v) => padY + (1 - (v - min) / span) * innerH);
  const pathD = xs
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i]!.toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={pathD} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]!} r={2.5} fill={color} />
      ))}
    </svg>
  );
}

function ContribTile({
  label,
  score,
  max,
  isTotal,
}: {
  label: string;
  score: number | null;
  max: number;
  isTotal?: boolean;
}) {
  return (
    <div
      style={{
        ...S.contribTile,
        ...(isTotal ? S.contribTileTotal : null),
      }}
    >
      <div style={S.contribTileHead}>
        <span style={S.contribTileLabel}>{label}</span>
        {!isTotal && <span style={S.contribTileTooltip}>i</span>}
      </div>
      <div style={S.contribTileScore}>
        {score == null ? "—" : `${score}/${max}`}
      </div>
    </div>
  );
}

function TableRow({ metric }: { metric: TechnicalMetricScore }) {
  const toneColor = metricTrendColor(metric);
  return (
    <div style={S.tableRow}>
      <span style={{ ...S.tableCell, flex: "0 0 174px", fontWeight: 600 }}>
        {metric.label}
      </span>
      <div style={{ ...S.tableCell, flex: "0 0 332px" }}>
        <MiniLineChart values={metric.series} color={toneColor} />
      </div>
      <span style={{ ...S.tableCell, flex: 1 }}>
        {metric.available ? metric.note : <span style={{ color: "#9a9a9a" }}>{metric.note}</span>}
      </span>
      <span
        style={{
          ...S.tableCell,
          flex: "0 0 60px",
          textAlign: "right" as const,
          fontWeight: 700,
        }}
      >
        {metric.available ? (
          <>
            <span style={{ color: toneColor, fontSize: 15 }}>
              {Math.round(metric.score)}
            </span>
            <span>/{metric.max}</span>
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}

function SectionBoxFull({
  title,
  height,
  children,
}: {
  title: string;
  height: number;
  children: ReactNode;
}) {
  return (
    <section style={S.sectionBoxFull}>
      <div style={S.sectionBoxFullHeader}>{title}</div>
      <div style={{ ...S.sectionBoxFullBody, minHeight: height }}>{children}</div>
    </section>
  );
}

function GraphPlaceholder({ hint }: { hint: string }) {
  return (
    <div style={S.graphPlaceholder}>
      <span style={S.graphPlaceholderHint}>그래프 자리 — {hint}</span>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────

const NAVY = "#003049";
const MUTED = "#4e4e4e";
const FAINT = "#737171";
const UP_DARK = "#43bb2e";
const UP_BG = "#e4ffdf";
const TICK_GRAY = "#b8b8b8";
const SIGNAL_BG = "#f8f8f8";
const TILE_BG = "#fafbfc";

const S: Record<string, CSSProperties> = {
  // §1 — 시안은 467fr / 622fr 이지만 신호 등급 bar 가독성을 위해 좌측 2/3 압축, 우측 확대
  row1: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 2fr) minmax(520px, 3fr)",
    gap: 16,
  },
  scoreBox: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  scoreBoxHeader: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  scoreBoxBody: {
    display: "flex",
    gap: 24,
    alignItems: "flex-start",
  },
  scoreCircleWrap: {
    position: "relative",
    width: 139,
    height: 139,
    flexShrink: 0,
  },
  scoreCircleText: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 45,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  scoreBoxRight: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    flex: 1,
  },
  deltaBlock: {
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  deltaLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  deltaValue: {
    fontSize: 22,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  contribBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  contribTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  contribChipGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, auto)",
    gap: 6,
    justifyContent: "start",
  },
  contribChip: {
    background: UP_BG,
    color: UP_DARK,
    fontSize: 13,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 4,
    whiteSpace: "nowrap",
  },

  signalBox: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  signalBoxHeader: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  signalCard: {
    background: SIGNAL_BG,
    borderRadius: 8,
    padding: "16px 22px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  signalGaugeWrap: {
    position: "relative",
    marginTop: 56,
  },
  signalGaugeBadge: {
    position: "absolute",
    top: -41,
    transform: "translateX(-50%)",
    fontSize: 14,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 4,
    border: "1.5px solid",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    pointerEvents: "none",
  },
  signalGaugeBar: {
    display: "flex",
    width: "100%",
    height: 31,
    borderRadius: 4,
    overflow: "hidden",
  },
  signalGaugeSeg: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    flexShrink: 0,
    overflow: "hidden",
  },
  signalGaugeSegLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    padding: "0 4px",
  },
  signalGaugeMarker: {
    position: "absolute",
    top: -13,
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  signalGaugeTicks: {
    position: "relative",
    height: 18,
    marginTop: 4,
  },
  signalGaugeTick: {
    position: "absolute",
    top: 0,
    fontSize: 13,
    fontWeight: 600,
    color: TICK_GRAY,
    fontFamily: "var(--font-numeric)",
    transform: "translateX(-50%)",
  },

  // §2 §4 full section
  sectionBoxFull: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  sectionBoxFullHeader: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  sectionBoxFullBody: {
    display: "flex",
    flexDirection: "column",
  },
  graphPlaceholder: {
    flex: 1,
    minHeight: 200,
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

  // §3
  row3: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  row3Header: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },

  contribTileRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 12,
  },
  contribTile: {
    background: TILE_BG,
    borderRadius: 8,
    padding: "14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
    height: 84,
    boxSizing: "border-box",
  },
  contribTileTotal: {
    background: "#f3f9ff",
  },
  contribTileHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  contribTileLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  contribTileTooltip: {
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
    cursor: "help",
    flexShrink: 0,
  },
  contribTileScore: {
    fontSize: 22,
    fontWeight: 700,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },

  tableBox: {
    display: "flex",
    flexDirection: "column",
  },
  tableHead: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 8px",
    borderTop: "1px solid var(--color-border)",
    borderBottom: "1px solid var(--color-border)",
  },
  tableHeadCell: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 8px",
    borderBottom: "1px solid var(--color-border)",
  },
  tableCell: {
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
  },
};
