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
  StockPriceTech,
} from "../types/investment";
import { InfoTooltip } from "../visualization/InfoTooltip";
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

          {/* §2 종합 점수 추이 */}
          <SectionBoxFull title="종합 점수 추이" height={255}>
            <ScoreTrendChart history={analysis.scoreHistory} />
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
                  metricKey={m.key}
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

          {/* §4 평균이동선 차트 */}
          <SectionBoxFull
            title="평균이동선 차트 (주가 · MA20 · MA50 · MA200)"
            height={320}
          >
            <PriceMaChart history={data.snapshot.technicalHistory} />
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

// 시안 card/기술/기여도 tooltip variant 본문 (6 metric, 총합 제외)
const METRIC_TOOLTIP: Record<string, string> = {
  superTrend:
    "변동성과 가격 흐름을 기반으로 현재 추세 방향을 보여주는 지표입니다. 상승·하락 추세 전환 시점을 파악할 때 사용합니다.",
  movingAverage:
    "일정 기간 주가 평균 흐름을 나타내는 지표입니다. 골든크로스는 상승 신호, 데드크로스는 하락 신호로 해석합니다.",
  macd:
    "단기와 장기 이동평균선의 차이를 활용한 추세 지표입니다. 선 교차와 0선 돌파를 주요 매매 신호로 봅니다.",
  rsi: "주가의 과매수, 과매도 상태를 보여주는 지표입니다.",
  vix:
    "시장 변동성과 투자 심리를 나타내는 공포지수입니다. 일반적으로 높을수록 시장 불안이 크다고 해석합니다.",
  volume:
    "일정 기간 동안 거래된 주식 수량입니다. 일반적으로 거래량이 함께 증가할수록 현재 추세의 신뢰도가 높다고 해석합니다.",
};

function ContribTile({
  label,
  score,
  max,
  isTotal,
  metricKey,
}: {
  label: string;
  score: number | null;
  max: number;
  isTotal?: boolean;
  metricKey?: string;
}) {
  const tooltipText = metricKey ? METRIC_TOOLTIP[metricKey] : undefined;
  return (
    <div
      style={{
        ...S.contribTile,
        ...(isTotal ? S.contribTileTotal : null),
      }}
    >
      <div style={S.contribTileHead}>
        <span style={S.contribTileLabel}>{label}</span>
        {!isTotal && tooltipText && (
          <InfoTooltip text={tooltipText} mode="card" size={14} />
        )}
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

// §2 종합 점수 추이 — 단일 시리즈 line + dot + 점 값 라벨 + 평균선
function ScoreTrendChart({ history }: { history: Array<{ date: string; score: number }> }) {
  const W = 1040;
  const H = 240;
  const padL = 40;
  const padR = 80; // 평균 라벨 자리
  const padT = 20;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const pts = history.slice(-20);
  const yMax = 100;
  const yTicks = [0, 20, 40, 60, 80, 100];
  // 양쪽 한 칸 여백: (pts.length + 1) 단위 + 시작점은 padL + stepX
  const stepX = pts.length > 0 ? innerW / (pts.length + 1) : 0;
  const xOf = (i: number) => padL + (i + 1) * stepX;
  const yOf = (v: number) => padT + innerH - (v / yMax) * innerH;
  const lineColor = "#43bb2e";
  if (pts.length < 2) {
    return <div style={{ color: "#9a9a9a", padding: 20 }}>표본 부족</div>;
  }
  // 시장 평균 — 보이는 기간 × 전체 ticker 평균 (현재 DB 사전계산 없음, mock)
  // TODO: /api/market-score-avg?days=20 신규 endpoint 또는 사전 계산 컬럼 필요
  const avg = 50;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.score).toFixed(1)}`).join(" ");
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {yTicks.map((t) => {
        const y = yOf(t);
        return (
          <g key={t}>
            {t > 0 && <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />}
            <text x={padL - 6} y={y} fontSize={10} fill="#737474" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
      {/* 평균선 (빨간 dashed) + 우측 라벨 */}
      <line
        x1={padL}
        x2={W - padR}
        y1={yOf(avg)}
        y2={yOf(avg)}
        stroke="#e06069"
        strokeWidth={1.2}
        strokeDasharray="6 4"
      />
      <text
        x={W - padR + 6}
        y={yOf(avg)}
        fontSize={11}
        fill="#e06069"
        dominantBaseline="middle"
        fontWeight={700}
      >
        시장 평균 {avg.toFixed(1)}
      </text>
      <path d={d} stroke={lineColor} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(p.score)} r={3.5} fill={lineColor} />
          <text
            x={xOf(i)}
            y={yOf(p.score) - 10}
            fontSize={12}
            fill="#003049"
            textAnchor="middle"
            fontWeight={700}
          >
            {Math.round(p.score)}
          </text>
        </g>
      ))}
      {pts.map((p, i) =>
        i % 2 === 0 ? (
          <text key={`xl-${i}`} x={xOf(i)} y={H - 8} fontSize={9} fill="#737474" textAnchor="middle">
            {p.date.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// §4 평균이동선 차트 — MA20/MA50/MA200 3 series + 거래량 막대 하단
function PriceMaChart({ history }: { history: StockPriceTech[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 1040;
  const H = 360;
  const padL = 8;
  const padR = 60; // 우측 chip 자리
  const padT = 36; // 범례
  const chartH = 180;
  const xLabelH = 50; // X 라벨 자리 + 상하 간격
  const volH = 60;
  const innerW = W - padL - padR;
  // 최근 60일 (close 기준 ASC)
  const asc = [...history].reverse().slice(-60);
  // ma20 클라이언트 SMA20 계산 (DB ma_20 컬럼이 close=null row 에만 채워져 있음)
  const closes = asc.map((t) => t.close);
  const sma20: Array<number | null> = closes.map((_, i) => {
    if (i < 19) return null;
    const window = closes.slice(i - 19, i + 1).filter((v): v is number => v != null);
    if (window.length < 15) return null;
    return window.reduce((a, b) => a + b, 0) / window.length;
  });
  // line 데이터
  type LineKey = "ma20" | "ma50" | "ma200";
  const lines: Array<{ key: LineKey; label: string; color: string; getVal: (t: StockPriceTech, i: number) => number | null }> = [
    { key: "ma20", label: "MA20", color: "#c1121f", getVal: (_t, i) => sma20[i] ?? null },
    { key: "ma50", label: "MA50", color: "#fdb43a", getVal: (t) => t.ma50 ?? null },
    { key: "ma200", label: "MA200", color: "#43bb2e", getVal: (t) => t.ma200 ?? null },
  ];
  // Y 범위
  const allVals: number[] = [];
  asc.forEach((t, i) => {
    for (const s of lines) {
      const v = s.getVal(t, i);
      if (v != null) allVals.push(v);
    }
  });
  const dataMin = allVals.length > 0 ? Math.min(...allVals) : 0;
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 100;
  const range = dataMax - dataMin || 1;
  const yMin = dataMin - range * 0.05;
  const yMax = dataMax + range * 0.05;
  const stepX = asc.length > 1 ? innerW / (asc.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  // Y tick — 5 단위 기본, 범위 크면 10/20 으로
  const yRangeSpan = yMax - yMin;
  const tickStep = yRangeSpan > 200 ? 25 : yRangeSpan > 100 ? 10 : 5;
  const yTicks: number[] = [];
  const firstTick = Math.ceil(yMin / tickStep) * tickStep;
  for (let t = firstTick; t <= yMax; t += tickStep) yTicks.push(Number(t.toFixed(2)));
  // 거래량 영역 Y 시작
  const volStartY = padT + chartH + xLabelH;
  const volMax = Math.max(0, ...asc.map((t) => t.volume ?? 0));
  const yVol = (v: number) => volStartY + (volMax > 0 ? (1 - v / volMax) * volH : volH);
  // 우측 chip 데이터 (각 series 최신값)
  const chips = lines
    .map((s) => {
      const lastIdx = asc.length - 1;
      // 최신부터 역방향 valid 값 찾기
      for (let i = lastIdx; i >= 0; i--) {
        const v = s.getVal(asc[i]!, i);
        if (v != null) return { ...s, value: v, valueY: yOf(v) };
      }
      return null;
    })
    .filter((c): c is { key: LineKey; label: string; color: string; getVal: typeof lines[0]["getVal"]; value: number; valueY: number } => c != null);
  const chipOrder = hovered
    ? [...chips.filter((c) => c.key !== hovered), ...chips.filter((c) => c.key === hovered)]
    : chips;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* 범례 상단 좌측 */}
      {lines.map((s, i) => (
        <g key={s.key} transform={`translate(${padL + 30 + i * 80}, 12)`}>
          <line x1={0} y1={4} x2={14} y2={4} stroke={s.color} strokeWidth={2} />
          <text x={18} y={4} fontSize={11} fill={s.color} dominantBaseline="middle" fontWeight={700}>
            {s.label}
          </text>
        </g>
      ))}
      {/* Y tick (우측 라벨) */}
      {yTicks.map((t) => {
        const y = yOf(t);
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />
            <text x={W - padR + 4} y={y} fontSize={10} fill="#737474" textAnchor="start" dominantBaseline="middle">
              {t.toFixed(2)}
            </text>
          </g>
        );
      })}
      {/* 가격 차트 X axis line */}
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#b8b8b8" strokeWidth={1} />
      {/* MA lines */}
      {lines.map((s) => {
        const pts: Array<{ x: number; y: number }> = [];
        asc.forEach((t, i) => {
          const v = s.getVal(t, i);
          if (v == null) return;
          pts.push({ x: xOf(i), y: yOf(v) });
        });
        if (pts.length < 2) return null;
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        return (
          <path
            key={s.key}
            d={d}
            stroke={s.color}
            strokeWidth={1.6}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={hovered && hovered !== s.key ? 0.3 : 1}
          />
        );
      })}
      {/* X 라벨 — 두 그래프 사이 */}
      {asc.map((t, i) => {
        const step = Math.max(1, Math.floor(asc.length / 5));
        if (i % step !== 0) return null;
        return (
          <text
            key={`xl-${i}`}
            x={xOf(i)}
            y={padT + chartH + 14}
            fontSize={10}
            fill="#737474"
            textAnchor="middle"
          >
            {t.date.slice(5)}
          </text>
        );
      })}
      {/* 거래량 영역 axis */}
      <line x1={padL} y1={volStartY + volH} x2={W - padR} y2={volStartY + volH} stroke="#b8b8b8" strokeWidth={1} />
      {/* 거래량 막대 */}
      {asc.map((t, i) => {
        const vol = t.volume ?? 0;
        if (vol <= 0) return null;
        const y = yVol(vol);
        const barH = volStartY + volH - y;
        return (
          <rect
            key={`v-${i}`}
            x={xOf(i) - stepX * 0.35}
            y={y}
            width={Math.max(1, stepX * 0.7)}
            height={Math.max(0.5, barH)}
            fill="#c9c9c9"
          />
        );
      })}
      {/* 거래량 라벨 — 히스토그램 위 */}
      <text x={padL + 4} y={volStartY - 8} fontSize={13} fill="#737474" fontWeight={700}>
        거래량
      </text>
      {(() => {
        const latestVol = asc[asc.length - 1]?.volume;
        if (latestVol == null) return null;
        const fmt =
          latestVol >= 1e12
            ? `${(latestVol / 1e12).toFixed(2)}조`
            : latestVol >= 1e8
              ? `${(latestVol / 1e8).toFixed(2)}억`
              : latestVol >= 1e4
                ? `${Math.round(latestVol / 1e4).toLocaleString()}만`
                : latestVol.toLocaleString();
        return (
          <text x={padL + 60} y={volStartY - 8} fontSize={13} fill="#43bb2e" fontWeight={700}>
            {fmt}
          </text>
        );
      })()}
      {/* 우측 chip 박스 — 각 series 최신값, hover 시 z-order 위 */}
      {chipOrder.map((c) => {
        const isHover = hovered === c.key;
        return (
          <g
            key={`chip-${c.key}`}
            onMouseEnter={() => setHovered(c.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={W - padR + 4}
              y={c.valueY - 10}
              width={50}
              height={20}
              rx={3}
              fill={c.color}
              stroke={isHover ? "#003049" : "none"}
              strokeWidth={isHover ? 1.5 : 0}
            />
            <text
              x={W - padR + 29}
              y={c.valueY}
              fontSize={11}
              fill="#fff"
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight={700}
            >
              {c.value.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// 깔끔한 round step
function roundNice(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
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
