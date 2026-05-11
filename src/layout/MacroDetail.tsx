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
  regimeFromDominant,
  regimeProbCards,
  type GirScore,
  type RegimeProbCard,
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
    return {
      dominant,
      confidencePct,
      regimes,
      gScore,
      iScore,
      rScore,
      warnings,
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

          {/* §3 국면 확률 추이 (12개월) — graph placeholder */}
          <SectionBoxFull title="국면 확률 추이 (12개월)" height={240}>
            <GraphPlaceholder hint="regime 확률 4-series line chart" />
          </SectionBoxFull>

          {/* §4 G·I·R 점수 추이 (12개월) — graph placeholder */}
          <SectionBoxFull title=" G · I · R 점수 추이 (12개월)" height={230}>
            <GraphPlaceholder hint="G/I/R 3-series line chart" />
          </SectionBoxFull>

          {/* §5 거시지표 세부 수치 — graph placeholder */}
          <SectionBoxFull title="거시지표 세부 수치" height={260}>
            <GraphPlaceholder hint="VIX·DXY·10Y·HY 등 세부 수치 표 / 차트" />
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
