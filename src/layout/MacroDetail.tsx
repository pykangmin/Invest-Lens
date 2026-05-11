// MacroDetail — 거시경제 국면 모니터 detail 화면.
// spec: docs/figma/screens/main-macro.json (Figma node 385:1470, 1440×2160)
//
// 시안 구조 (y기준, 콘텐츠 영역 x=237~1338, w=1101):
//   §1 (231-460, h=229) — 현재 국면 요약: 4-col grid
//        현재 국면(142w): "Hard Landing" 28pt + Confidence (12pt + 20pt)
//        성장(G)/인플레(I)/리스크(R) (각 186w): title + 큰 score 30pt + 부연 14pt + -1/0/+1 gauge bar
//   §2 (472-661, h=189) — 현재 국면 확률: 4 카드 (각 255w, 색상별 bg)
//        Hard(#fffbfb)/No(#f8faff)/Recovery(#fffbf4)/Soft(#f9fff7)
//        각 안: title 14pt + 큰 % 28pt 색상별 + horizontal progress bar
//   §3 (673-956, h=283) — 국면 확률 추이 (12개월) → graph placeholder
//   §4 (968-1242, h=274) — G·I·R 점수 추이 (12개월) → graph placeholder
//   §5 (1254-1556, h=302) — 거시지표 세부 수치 → graph placeholder
//   §6 (1568-1830, h=262) — 점수 기여도 분석: 3 카드 (각 342×186)
//        header 영역 #fafbfc bg: title + 우측 "합계 ±N.NN"
//        content rows: 변수명 + bar + 값
//   §7 (1842-2043, h=201) — 선행 경고 체크리스트: 6 카드 (각 162×132)
//        icon 47×47 좌상단(원형 #ffcaca + warning vector) + title + body

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  buildGScore,
  buildIScore,
  buildRScore,
  buildWarningCards,
  confidenceToPct,
  girTrendSeries,
  macroIndicatorsTable,
  regimeFromDominant,
  regimeProbCards,
  regimeTrendSeries,
  type GirScore,
  type GirTrendPoint,
  type MacroIndicatorRow,
  type RegimeProbCard,
  type RegimeTrendPoint,
  type WarningCardSpec,
} from "../analysis/macroNarrative";
import {
  loadGlobalEnvironment,
  loadMacroRegime,
} from "../data-loader/investmentData";
import type {
  GlobalEnvironmentResponse,
  MacroRegimeResponse,
} from "../types/investment";
import { DetailShell, type DetailSection } from "./DetailShell";
import { EmptyState } from "./detail";

interface DetailState {
  regime: MacroRegimeResponse;
  vix: GlobalEnvironmentResponse;
  dxy: GlobalEnvironmentResponse;
  treasury10y: GlobalEnvironmentResponse;
  treasury2y: GlobalEnvironmentResponse;
  hyspread: GlobalEnvironmentResponse;
  ismMan: GlobalEnvironmentResponse;
  ismSvc: GlobalEnvironmentResponse;
  unrate: GlobalEnvironmentResponse;
  cpi: GlobalEnvironmentResponse;
  fedfunds: GlobalEnvironmentResponse;
  m2: GlobalEnvironmentResponse;
}

export interface MacroDetailProps {
  ticker: string;
  onBackToHome: () => void;
  onBackToOverview: () => void;
  onNavigateSection: (section: DetailSection) => void;
  onSelectTicker: (ticker: string) => void;
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
      loadGlobalEnvironment({ symbol: "DGS10", historyLimit: 60 }),
      loadGlobalEnvironment({ symbol: "DGS2", historyLimit: 60 }),
      loadGlobalEnvironment({ symbol: "BAMLH0A0HYM2", historyLimit: 60 }),
      loadGlobalEnvironment({ symbol: "ISM_MAN", historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "ISM_SVC", historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "UNRATE", historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "CPIAUCSL", historyLimit: 36 }),
      loadGlobalEnvironment({ symbol: "FEDFUNDS", historyLimit: 24 }),
      loadGlobalEnvironment({ symbol: "M2SL", historyLimit: 36 }),
    ])
      .then(
        ([
          regime,
          vix,
          dxy,
          treasury10y,
          treasury2y,
          hyspread,
          ismMan,
          ismSvc,
          unrate,
          cpi,
          fedfunds,
          m2,
        ]) => {
          if (alive)
            setData({
              regime,
              vix,
              dxy,
              treasury10y,
              treasury2y,
              hyspread,
              ismMan,
              ismSvc,
              unrate,
              cpi,
              fedfunds,
              m2,
            });
        },
      )
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const analysis = useMemo(() => {
    if (!data) return null;
    const dominant = regimeFromDominant(data.regime.latest?.dominantRegime ?? null);
    const confidencePct = confidenceToPct(data.regime.latest?.confidence ?? null);
    const regimes = regimeProbCards(data.regime.latest);
    const gScore = buildGScore(data.ismMan.history, data.unrate.history, null);
    const iScore = buildIScore(
      data.cpi.history,
      data.fedfunds.history,
      data.treasury10y.history,
    );
    const rScore = buildRScore(
      data.hyspread.history,
      data.treasury10y.history,
      data.treasury2y.history,
      data.m2.history,
    );
    const warnings = buildWarningCards(
      data.hyspread.history,
      data.ismMan.history,
      data.unrate.history,
      data.treasury10y.history,
      data.treasury2y.history,
      data.ismSvc.history,
      data.m2.history,
    );
    const regimeTrend = regimeTrendSeries(data.regime.history);
    const girTrend = girTrendSeries(data.regime.history);
    const indicatorsTable = macroIndicatorsTable(
      data.ismMan.history,
      data.ismSvc.history,
      data.cpi.history,
      data.unrate.history,
      data.fedfunds.history,
      data.hyspread.history,
      data.m2.history,
    );
    return {
      dominant,
      confidencePct,
      regimes,
      gScore,
      iScore,
      rScore,
      warnings,
      regimeTrend,
      girTrend,
      indicatorsTable,
    };
  }, [data]);

  const updatedAt = useMemo(() => data?.regime.latest?.date ?? undefined, [data]);

  return (
    <DetailShell
      ticker={ticker}
      active="macro"
      pageTitle="거시경제 국면 모니터"
      pageSubtitle="금리, 물가, 유동성, 경기 사이클 등 주요 거시 지표를 기반으로 현재 시장 국면과 자산 흐름 방향을 분석합니다."
      updatedAt={updatedAt}
      onBackToHome={onBackToHome}
      onBackToOverview={onBackToOverview}
      onNavigateSection={onNavigateSection}
      onSelectTicker={onSelectTicker}
    >
      {error && <EmptyState variant="error" message={`로드 실패: ${error}`} />}
      {!error && (!data || !analysis) && <EmptyState variant="loading" />}
      {data && analysis && (
        <>
          {/* §1 현재 국면 요약 (1101×229) */}
          <section style={S.row1}>
            <div style={S.row1Header}>현재 국면 요약</div>
            <div style={S.row1Body}>
              {/* 현재 국면 + Confidence */}
              <div style={S.statusCol}>
                <div style={S.colLabel}>현재 국면</div>
                <div
                  style={{
                    ...S.statusValue,
                    color: analysis.dominant.color,
                  }}
                >
                  {analysis.dominant.label}
                </div>
                <div style={S.confidenceBlock}>
                  <div style={S.confidenceLabel}>Confidence</div>
                  <div style={S.confidenceValue}>{analysis.confidencePct}</div>
                </div>
              </div>
              {/* G/I/R 점수 카드 3개 */}
              <ScoreCardView title="성장 (G) 스코어" score={analysis.gScore} />
              <ScoreCardView title="인플레 (I) 스코어" score={analysis.iScore} />
              <ScoreCardView title="리스크 (R) 스코어" score={analysis.rScore} />
            </div>
          </section>

          {/* §2 현재 국면 확률 (1101×189, 4 카드) */}
          <section style={S.row2}>
            <div style={S.row2Header}>현재 국면 확률</div>
            <div style={S.regimeGrid}>
              {analysis.regimes.map((r) => (
                <RegimeCard key={r.key} regime={r} />
              ))}
            </div>
          </section>

          {/* §3 국면 확률 추이 (12개월) */}
          <SectionBoxFull title="국면 확률 추이 (12개월)" height={260}>
            <RegimeTrendChart points={analysis.regimeTrend} />
          </SectionBoxFull>

          {/* §4 G·I·R 점수 추이 */}
          <SectionBoxFull title=" G · I · R 점수 추이 (24개월)" height={230}>
            <GirTrendChartFull points={analysis.girTrend} />
          </SectionBoxFull>

          {/* §5 거시지표 세부 수치 */}
          <SectionBoxFull title="거시지표 세부 수치" height={280}>
            <MacroIndicatorsTable rows={analysis.indicatorsTable} />
          </SectionBoxFull>

          {/* §6 점수 기여도 분석 (1101×262, 3 카드) */}
          <section style={S.row6}>
            <div style={S.row6Header}>점수 기여도 분석</div>
            <div style={S.contribGrid}>
              <ContribCard score={analysis.gScore} />
              <ContribCard score={analysis.iScore} />
              <ContribCard score={analysis.rScore} />
            </div>
          </section>

          {/* §7 선행 경고 체크리스트 (1101×201, 6 카드) */}
          <section style={S.row7}>
            <div style={S.row7Header}>선행 경고 체크리스트</div>
            <div style={S.warningGrid}>
              {analysis.warnings.map((w, i) => (
                <WarningCard key={i} card={w} />
              ))}
            </div>
          </section>
        </>
      )}
    </DetailShell>
  );
}

// ── helpers ────────────────────────────────────────────────────

function ScoreCardView({ title, score }: { title: string; score: GirScore }) {
  // total (-1..+1) — 중앙 50% 기준, |value|*50% 만큼 색상 fill
  const v = Math.max(-1, Math.min(1, score.total));
  const fillPct = Math.abs(v) * 50;
  const isNeg = v < 0;
  const fillColor = isNeg ? "#c1121f" : "#60c846";
  return (
    <div style={S.scoreCol}>
      <div style={S.scoreColLabel}>{title}</div>
      <div style={{ ...S.scoreValue, color: score.bigColor }}>
        {score.bigDisplay}
      </div>
      <div style={S.scoreDetail}>{score.detailLabel}</div>
      <div style={S.scoreGauge}>
        <div style={S.scoreGaugeBar}>
          <div style={S.scoreGaugeBase} />
          <div style={S.scoreGaugeCenterMark} />
          <div
            style={{
              ...S.scoreGaugeFill,
              left: isNeg ? `${50 - fillPct}%` : "50%",
              width: `${fillPct}%`,
              background: fillColor,
            }}
          />
        </div>
        <div style={S.scoreGaugeTicks}>
          <span>-1</span>
          <span>0</span>
          <span>1</span>
        </div>
      </div>
    </div>
  );
}

function RegimeCard({ regime }: { regime: RegimeProbCard }) {
  return (
    <div style={{ ...S.regimeCard, background: regime.cardBg }}>
      <div style={S.regimeTitle}>{regime.label}</div>
      <div style={{ ...S.regimePct, color: regime.color }}>
        {regime.pct}%
      </div>
      <div style={S.regimeBarTrack}>
        <div
          style={{
            ...S.regimeBarFill,
            background: regime.color,
            width: `${regime.pct}%`,
          }}
        />
      </div>
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

function ContribCard({ score }: { score: GirScore }) {
  return (
    <div style={S.contribCard}>
      <div style={S.contribCardHeader}>
        <span style={S.contribCardTitle}>{score.title}</span>
        <div style={S.contribCardTotal}>
          <span style={S.contribTotalLabel}>합계</span>
          <span style={{ ...S.contribTotalValue, color: score.totalColor }}>
            {score.totalDisplay}
          </span>
        </div>
      </div>
      <div style={S.contribCardBody}>
        {score.contribs.map((r) => {
          const v = Math.max(-1, Math.min(1, r.value));
          const fillPct = Math.abs(v) * 50;
          const isNeg = v < 0;
          const fillColor = isNeg ? "#c1121f" : "#60c846";
          return (
            <div key={r.variable} style={S.contribRow}>
              <span style={S.contribRowName}>{r.variable}</span>
              <div style={S.contribRowBar}>
                <div style={S.contribRowBarBase} />
                <div style={S.contribRowCenterMark} />
                <div
                  style={{
                    ...S.contribRowBarFill,
                    left: isNeg ? `${50 - fillPct}%` : "50%",
                    width: `${fillPct}%`,
                    background: fillColor,
                  }}
                />
              </div>
              <span
                style={{
                  ...S.contribRowValue,
                  color: isNeg ? "#c1121f" : v > 0.001 ? "#60c846" : MUTED,
                }}
              >
                {r.display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// §3 4-series regime trend line chart
function RegimeTrendChart({ points }: { points: RegimeTrendPoint[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 1040;
  const H = 220;
  const padL = 40;
  const padR = 60;
  const padT = 16;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const yMax = 100;
  const yTicks = [0, 20, 40, 60, 80, 100];
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - (v / yMax) * innerH;
  const series: Array<{ key: "hard" | "no" | "recovery" | "soft"; color: string; label: string }> = [
    { key: "hard", color: "#c1121f", label: "Hard Landing" },
    { key: "no", color: "#4a7aff", label: "No Landing" },
    { key: "recovery", color: "#fdb43a", label: "Recovery" },
    { key: "soft", color: "#60c846", label: "Soft Landing" },
  ];
  // hover 된 series 를 마지막에 그려 위로 올림
  const chipOrder = hovered
    ? [...series.filter((s) => s.key !== hovered), ...series.filter((s) => s.key === hovered)]
    : series;
  const buildPath = (key: "hard" | "no" | "recovery" | "soft") => {
    const segs: string[] = [];
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) return;
      segs.push(`${segs.length === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`);
    });
    return segs.join(" ");
  };
  return (
    <div style={CFM.wrap}>
      <div style={CFM.legendRow}>
        {series.map((s) => (
          <span key={s.key} style={CFM.legendItem}>
            <span style={{ ...CFM.legendDot, background: s.color }} />
            <span style={{ ...CFM.legendText, color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {yTicks.map((t) => {
          const y = yOf(t);
          return (
            <g key={t}>
              {t > 0 && <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#ececec" strokeWidth={1} />}
              <text x={padL - 6} y={y} fontSize={10} fill="#737474" textAnchor="end" dominantBaseline="middle">
                {t}%
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        {series.map((s) => (
          <path key={s.key} d={buildPath(s.key)} stroke={s.color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* dot 각 데이터 포인트 */}
        {series.map((s) =>
          points.map((p, i) => {
            const v = p[s.key];
            if (v == null) return null;
            return (
              <circle
                key={`${s.key}-d-${i}`}
                cx={xOf(i)}
                cy={yOf(v)}
                r={2.5}
                fill={s.color}
              />
            );
          }),
        )}
        {chipOrder.map((s) => {
          const last = points[points.length - 1];
          if (!last) return null;
          const v = last[s.key];
          if (v == null) return null;
          const x = xOf(points.length - 1) + 6;
          const y = yOf(v);
          const isHover = hovered === s.key;
          return (
            <g
              key={`chip-${s.key}`}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={y - 9}
                width={42}
                height={18}
                rx={4}
                fill={s.color}
                stroke={isHover ? "#003049" : "none"}
                strokeWidth={isHover ? 1.5 : 0}
              />
              <text x={x + 21} y={y} fontSize={11} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={700}>
                {Math.round(v)}%
              </text>
            </g>
          );
        })}
        {points.map((p, i) =>
          i % 2 === 0 ? (
            <text key={`xl-${i}`} x={xOf(i)} y={H - 8} fontSize={10} fill="#737474" textAnchor="middle" fontFamily="var(--font-numeric)">
              {p.date.slice(0, 7)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

// §4 G·I·R 3-series line chart
function GirTrendChartFull({ points }: { points: GirTrendPoint[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 1040;
  const H = 200;
  const padL = 40;
  const padR = 60;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const yMin = -1;
  const yMax = 1;
  const yTicks = [-1, -0.5, 0, 0.5, 1];
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const series: Array<{ key: "G" | "I" | "R"; color: string; label: string }> = [
    { key: "G", color: "#4a7aff", label: "성장 (G)" },
    { key: "I", color: "#fdb43a", label: "인플레 (I)" },
    { key: "R", color: "#c1121f", label: "리스크 (R)" },
  ];
  const chipOrder = hovered
    ? [...series.filter((s) => s.key !== hovered), ...series.filter((s) => s.key === hovered)]
    : series;
  const buildPath = (key: "G" | "I" | "R") => {
    const segs: string[] = [];
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) return;
      segs.push(`${segs.length === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`);
    });
    return segs.join(" ");
  };
  return (
    <div style={CFM.wrap}>
      <div style={CFM.legendRow}>
        {series.map((s) => (
          <span key={s.key} style={CFM.legendItem}>
            <span style={{ ...CFM.legendDot, background: s.color }} />
            <span style={{ ...CFM.legendText, color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {yTicks.map((t) => {
          const y = yOf(t);
          const isZero = t === 0;
          const isHalf = Math.abs(t) === 0.5;
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke={isZero ? "#9a9a9a" : "#ececec"} strokeWidth={isZero ? 1.2 : 1} strokeDasharray={isHalf ? "4 3" : undefined} />
              <text x={padL - 6} y={y} fontSize={10} fill="#737474" textAnchor="end" dominantBaseline="middle">
                {t.toFixed(1)}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#b8b8b8" strokeWidth={1} />
        {series.map((s) => (
          <path key={s.key} d={buildPath(s.key)} stroke={s.color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) =>
          points.map((p, i) => {
            const v = p[s.key];
            if (v == null) return null;
            return (
              <circle
                key={`${s.key}-d-${i}`}
                cx={xOf(i)}
                cy={yOf(v)}
                r={2.5}
                fill={s.color}
              />
            );
          }),
        )}
        {chipOrder.map((s) => {
          const last = points[points.length - 1];
          if (!last) return null;
          const v = last[s.key];
          if (v == null) return null;
          const x = xOf(points.length - 1) + 6;
          const y = yOf(v);
          const isHover = hovered === s.key;
          return (
            <g
              key={`chip-${s.key}`}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={y - 9}
                width={42}
                height={18}
                rx={4}
                fill={s.color}
                stroke={isHover ? "#003049" : "none"}
                strokeWidth={isHover ? 1.5 : 0}
              />
              <text x={x + 21} y={y} fontSize={11} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={700}>
                {(v >= 0 ? "+" : "") + v.toFixed(2)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) =>
          i % 3 === 0 ? (
            <text key={`xl-${i}`} x={xOf(i)} y={H - 8} fontSize={10} fill="#737474" textAnchor="middle" fontFamily="var(--font-numeric)">
              {p.date.slice(0, 7)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

// §5 거시지표 세부 수치 표
function MacroIndicatorsTable({ rows }: { rows: MacroIndicatorRow[] }) {
  return (
    <div style={MIT.wrap}>
      <div style={{ ...MIT.row, ...MIT.head }}>
        <span style={{ ...MIT.cell, ...MIT.colLabel }}>지표</span>
        <span style={MIT.cell}>현재 수치</span>
        <span style={MIT.cell}>전월 수치</span>
        <span style={MIT.cell}>변동</span>
        <span style={MIT.cell}>추이</span>
        <span style={MIT.cell}>기준선</span>
        <span style={MIT.cell}>장기 평균</span>
        <span style={MIT.cell}>영향</span>
        <span style={MIT.cell}>메세지</span>
        <span style={MIT.cell}>시그널</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} style={MIT.row}>
          <span style={{ ...MIT.cell, ...MIT.colLabel }}>{r.label}</span>
          <span style={MIT.cell}>{r.current}</span>
          <span style={MIT.cell}>{r.previous}</span>
          <span style={{ ...MIT.cell, color: r.deltaColor, fontWeight: 700 }}>{r.delta}</span>
          <span style={MIT.cell}>
            <TrendSpark values={r.trend} color={r.deltaColor} />
          </span>
          <span style={MIT.cell}>{r.baseline}</span>
          <span style={MIT.cell}>{r.longAvg}</span>
          <span style={{ ...MIT.cell, color: r.influenceColor, fontWeight: 700 }}>{r.influence}</span>
          <span style={MIT.cell}>{r.message}</span>
          <span style={MIT.cell}>
            <span style={{ ...MIT.signalChip, color: r.signalColor, background: r.signalColor === "#43bb2e" ? "#e4ffdf" : "#ffe4e4" }}>
              {r.signal}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function TrendSpark({ values, color }: { values: number[]; color: string }) {
  const W = 60;
  const H = 20;
  if (values.length < 2) return <span style={{ color: "#9a9a9a" }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = W / (values.length - 1);
  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: H - 2 - ((v - min) / span) * (H - 4),
  }));
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={d} stroke={color} strokeWidth={1.2} fill="none" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.4} fill={color} />
      ))}
    </svg>
  );
}

function WarningCard({ card }: { card: WarningCardSpec }) {
  return (
    <div style={S.warningCard}>
      <div style={S.warningIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3 L22 21 L2 21 Z"
            stroke="#bc3b3b"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M12 10 L12 15"
            stroke="#bc3b3b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="18" r="1.2" fill="#bc3b3b" />
        </svg>
      </div>
      <div style={S.warningTitle}>{card.title}</div>
      <div style={S.warningBody}>{card.body}</div>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────

const NAVY = "#003049";
const MUTED = "#747474";
const TICK_GRAY = "#b8b8b8";

const S: Record<string, CSSProperties> = {
  // §1
  row1: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  row1Header: {
    fontSize: 16,
    fontWeight: 600,
    color: NAVY,
  },
  row1Body: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 200px) repeat(3, 1fr)",
    gap: 28,
    alignItems: "stretch",
  },
  statusCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  colLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  statusValue: {
    fontSize: 28,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  },
  confidenceBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginTop: 12,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: NAVY,
  },
  confidenceValue: {
    fontSize: 20,
    fontWeight: 600,
    color: "#000",
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  scoreCol: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    textAlign: "center",
    alignItems: "stretch",
  },
  scoreColLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
    textAlign: "center",
  },
  scoreValue: {
    fontSize: 30,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
    textAlign: "center",
  },
  scoreDetail: {
    fontSize: 14,
    fontWeight: 600,
    color: "#6b6b6b",
    marginBottom: 4,
    textAlign: "center",
  },
  scoreGauge: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 4,
  },
  scoreGaugeBar: {
    position: "relative",
    height: 8,
  },
  scoreGaugeBase: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    background: "#ececec",
    borderRadius: 4,
  },
  scoreGaugeCenterMark: {
    position: "absolute",
    top: -2,
    left: "50%",
    width: 1,
    height: "calc(100% + 4px)",
    background: "#9a9a9a",
    transform: "translateX(-50%)",
    zIndex: 1,
  },
  scoreGaugeFill: {
    position: "absolute",
    top: 0,
    height: "100%",
    borderRadius: 4,
    zIndex: 2,
  },
  scoreGaugeTicks: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 600,
    color: TICK_GRAY,
    fontFamily: "var(--font-numeric)",
  },

  // §2
  row2: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  row2Header: {
    fontSize: 16,
    fontWeight: 600,
    color: NAVY,
  },
  regimeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  regimeCard: {
    borderRadius: 10,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    height: 115,
    boxSizing: "border-box",
  },
  regimeTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  regimePct: {
    fontSize: 28,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    lineHeight: 1,
  },
  regimeBarTrack: {
    position: "relative",
    height: 6,
    borderRadius: 3,
    background: "#d9d9d9",
    overflow: "hidden",
    marginTop: "auto",
  },
  regimeBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 3,
  },

  // §3 §4 §5 full-width section (graph placeholder)
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
    color: MUTED,
    fontStyle: "italic",
  },

  // §6
  row6: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  row6Header: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  contribGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 17,
  },
  contribCard: {
    background: "#ffffff",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  contribCardHeader: {
    background: "#fafbfc",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    height: 42,
    boxSizing: "border-box",
  },
  contribCardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
  },
  contribCardTotal: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  contribTotalLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
  },
  contribTotalValue: {
    fontSize: 17,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
  },
  contribCardBody: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 15,
    flex: 1,
  },
  contribRow: {
    display: "grid",
    gridTemplateColumns: "121px 1fr 38px",
    alignItems: "center",
    gap: 12,
  },
  contribRowName: {
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  contribRowBar: {
    position: "relative",
    height: 5,
  },
  contribRowBarBase: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    background: "#ececec",
    borderRadius: 3,
  },
  contribRowCenterMark: {
    position: "absolute",
    top: -2,
    left: "50%",
    width: 1,
    height: "calc(100% + 4px)",
    background: "#9a9a9a",
    transform: "translateX(-50%)",
    zIndex: 1,
  },
  contribRowBarFill: {
    position: "absolute",
    top: 0,
    height: "100%",
    borderRadius: 3,
    zIndex: 2,
  },
  contribRowValue: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    textAlign: "right",
  },

  // §7
  row7: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  row7Header: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
  },
  warningGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 14,
  },
  warningCard: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },
  warningIcon: {
    width: 47,
    height: 47,
    borderRadius: "50%",
    background: "#ffcaca",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: NAVY,
    lineHeight: 1.25,
  },
  warningBody: {
    fontSize: 13,
    fontWeight: 600,
    color: MUTED,
    lineHeight: 1.45,
  },
};

// §3·§4 chart frame
const CFM: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
  },
  legendRow: {
    display: "flex",
    gap: 16,
    alignItems: "center",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendText: {
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--font-numeric)",
  },
};

// §5 거시지표 표
const MIT: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    fontSize: 12,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1.4fr) repeat(3, 1fr) 70px 0.6fr 0.8fr 0.7fr 0.9fr 0.7fr",
    alignItems: "center",
    padding: "8px 6px",
    borderBottom: "1px solid #ececec",
    gap: 6,
  },
  head: {
    fontWeight: 700,
    color: NAVY,
    background: "#fafbfc",
    borderTop: "1px solid #ececec",
  },
  cell: {
    fontSize: 12,
    color: NAVY,
    fontFamily: "var(--font-numeric)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  colLabel: {
    fontFamily: "inherit",
    fontWeight: 600,
  },
  signalChip: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 4,
    fontFamily: "var(--font-numeric)",
  },
};
