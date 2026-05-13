// HoverCards — 메인 대시보드 ChartPanel 에서 사용하는 4 카드 hover 시각화.
//
// 실 데이터 (FundamentalVizData / TechnicalAnalysisV4 / MacroVizData / CommodityVizData)
// 를 props 로 받아 detail §1 hero 의 축소 변형으로 표현.
// /temp 의 mock 기반 TempHoverCards 와 시각 형태 1:1 동일.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { TechnicalAnalysisV4 } from "../analysis/technicalV4";
import type { RegimeProb } from "../analysis/macroDetail";
import { scaledPx } from "../shared/responsiveStyle";

// 미디어 쿼리 매칭 — viewport breakpoint 분기.
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// ──────────────────────────────────────────────────────────────
// 디자인 토큰 (TempHoverCards 와 동일)
// ──────────────────────────────────────────────────────────────

const C = {
  cardBg: "#ffffff",
  innerBg: "#fafbfc",
  border: "#e9e9e9",
  textPrimary: "#003049",
  textBody: "#4e4e4e",
  textMuted: "#7f7f7f",
  textFaint: "#a3a3a3",
  up: "#60c846",
  upStrong: "#43bb2e",
  down: "#c1121f",
  warn: "#e5af43",
  verdictBuy: "#60c846",
  verdictHold: "#e5af43",
  verdictSell: "#c1121f",
  segSell: "#c1121f",
  segHold: "#e5af43",
  segBuy: "#33a316",
  segStrong: "#157f0a",
  regHard: "#c1121f",
  regNo: "#4a7aff",
  regRec: "#fdb43a",
  regSoft: "#60c846",
  positive: "#60c846",
  neutralComm: "#f8eb37",
  negative: "#c1121f",
} as const;

const FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ──────────────────────────────────────────────────────────────
// 애니메이션 keyframes — 한번만 inject
// ──────────────────────────────────────────────────────────────

const HC_ANIM_CSS = `
@keyframes hcCardIn {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
@keyframes hcFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes hcSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes hcPop {
  0%   { opacity: 0; transform: scale(0); }
  70%  { opacity: 1; transform: scale(1.12); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes hcScaleIn {
  from { opacity: 0; transform: scale(0.4); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes hcGrowBar {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes hcGrowBarX {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes hcDrawStroke {
  from { stroke-dashoffset: var(--len, 1000); }
  to   { stroke-dashoffset: 0; }
}
@keyframes hcCountUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const anim = (name: string, dur = 600, delay = 0, easing = "cubic-bezier(0.22, 1, 0.36, 1)"): CSSProperties => ({
  animation: `${name} ${dur}ms ${easing} ${delay}ms both`,
});

let cssInjected = false;
function ensureCss(): void {
  if (cssInjected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-hover-cards", "");
  style.appendChild(document.createTextNode(HC_ANIM_CSS));
  document.head.appendChild(style);
  cssInjected = true;
}

// ──────────────────────────────────────────────────────────────
// 공통 Shell (제목 없음 — 외부 ChartPanel 이 컨테이너 역할)
// ──────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  ensureCss();
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: C.cardBg,
      padding: "20px 28px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      fontFamily: FONT,
      ...anim("hcCardIn", 420),
    }}>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 1) Fundamental — 4축 다이아몬드 + 섹션별 metric 묶음
// ──────────────────────────────────────────────────────────────

export interface HCFundamentalSection {
  key: string;
  label: string;
  ratio: number;       // 0~1
  indicators: Array<{ label: string; value: string }>;
}

export interface HCFundamentalData {
  totalScore: number | null;
  verdictLabel: string;
  verdictColor: string;
  sections: HCFundamentalSection[];  // 4개, 순서: cashflow / profit / valuation / growth
}

export function FundamentalHover({ data }: { data: HCFundamentalData }) {
  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16, alignItems: "stretch" }}>
        {/* 상단: 레이더 차트 가로 중앙 */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", ...anim("hcFadeIn", 500, 150) }}>
          <FundDiamond data={data} />
        </div>
        {/* 하단: 4 섹션 카드 1행 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {data.sections.map((s, i) => (
            <div key={s.key} style={{
              background: C.innerBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "12px 14px",
              ...anim("hcSlideUp", 420, 250 + i * 80),
            }}>
              <div style={{
                color: C.textMuted,
                fontSize: 12,
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}>
                <span>{s.label}</span>
                <span style={{ color: C.textBody, fontSize: 11, fontWeight: 600 }}>
                  {Math.round(s.ratio * 100)}%
                </span>
              </div>
              {s.indicators.map((m) => (
                <div key={m.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: C.textBody }}>{m.label}</span>
                  <span style={{ color: C.textPrimary, fontWeight: 700 }}>{m.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function FundDiamond({ data }: { data: HCFundamentalData }) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = 130;
  const axes = [{ angle: -90 }, { angle: 0 }, { angle: 90 }, { angle: 180 }];
  const rad = (a: number) => (a * Math.PI) / 180;
  const pt = (angle: number, ratio: number) => ({
    x: cx + Math.cos(rad(angle)) * r * ratio,
    y: cy + Math.sin(rad(angle)) * r * ratio,
  });
  const polyStr = data.sections.map((s, i) => {
    const p = pt(axes[i % 4].angle, s.ratio);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((g, i) => (
        <polygon
          key={g}
          points={axes.map((a) => {
            const p = pt(a.angle, g);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke={C.border}
          strokeWidth={1}
          style={anim("hcFadeIn", 400, 80 + i * 50)}
        />
      ))}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, ...anim("hcScaleIn", 700, 350) }}>
        <polygon
          points={polyStr}
          fill={data.verdictColor}
          fillOpacity={0.18}
          stroke={data.verdictColor}
          strokeWidth={2.5}
        />
      </g>
      {data.sections.map((s, i) => {
        const p = pt(axes[i % 4].angle, s.ratio);
        return (
          <g key={s.key} style={{ transformOrigin: `${p.x}px ${p.y}px`, ...anim("hcPop", 380, 700 + i * 80) }}>
            <circle cx={p.x} cy={p.y} r={5} fill={data.verdictColor} />
          </g>
        );
      })}
      <g style={anim("hcCountUp", 500, 900)}>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={42} fontWeight={700} fill={C.textPrimary} fontFamily={FONT}>
          {data.totalScore ?? "—"}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={13} fill={data.verdictColor} fontWeight={700} fontFamily={FONT}>
          {data.verdictLabel}
        </text>
      </g>
      {data.sections.map((s, i) => {
        const p = pt(axes[i % 4].angle, 1.18);
        return (
          <text
            key={s.key}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontSize={13}
            fill={C.textBody}
            fontWeight={600}
            fontFamily={FONT}
            style={anim("hcFadeIn", 400, 150 + i * 80)}
          >
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────
// 2) Technical — 반원 게이지 + 좌우 6 metric
// ──────────────────────────────────────────────────────────────

const SIGNAL_SEGMENTS = [
  { label: "Sell",       start: 0,   end: 50,  color: C.segSell },
  { label: "Hold",       start: 50,  end: 65,  color: C.segHold },
  { label: "Buy",        start: 65,  end: 80,  color: C.segBuy },
  { label: "Strong buy", start: 80,  end: 100, color: C.segStrong },
];

function activeSegment(score: number) {
  for (const s of SIGNAL_SEGMENTS) {
    if (score >= s.start && score < s.end) return s;
  }
  return SIGNAL_SEGMENTS[SIGNAL_SEGMENTS.length - 1];
}

const TECH_COL_H = 210;

export function TechnicalHover({ data }: { data: TechnicalAnalysisV4 }) {
  const seg = activeSegment(data.totalScore);
  const metricsL = data.metrics.slice(0, 3);
  const metricsR = data.metrics.slice(3, 6);
  const isNarrow = useMediaQuery("(max-width: 1200px)");

  if (isNarrow) {
    // ≤ 1200px: 세로 레이아웃 — gauge 상단 + Buy 그 아래 in-flow + 2×3 chip grid 하단.
    return (
      <Shell>
        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 14,
          alignItems: "stretch",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <SemiGauge score={data.totalScore} />
            <div style={{
              color: seg.color,
              fontSize: 22,
              fontWeight: 700,
              padding: "6px 22px",
              border: `2px solid ${seg.color}`,
              borderRadius: 8,
              background: C.cardBg,
              lineHeight: 1,
              ...anim("hcPop", 500, 1300),
              transformOrigin: "center bottom",
            }}>
              {seg.label}
            </div>
          </div>
          {/* 2×3 grid: 왼쪽 3 chip = 첫 줄, 오른쪽 3 chip = 둘째 줄 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}>
            {metricsL.map((m, i) => (
              <div key={m.key} style={anim("hcSlideUp", 420, 600 + i * 80)}>
                <TechMetric label={m.label} score={m.score} max={m.max} available={m.available} />
              </div>
            ))}
            {metricsR.map((m, i) => (
              <div key={m.key} style={anim("hcSlideUp", 420, 800 + i * 80)}>
                <TechMetric label={m.label} score={m.score} max={m.max} available={m.available} />
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", height: "100%", alignItems: "center", gap: 20, padding: "0 4px" }}>
        <div style={{
          width: 170,
          height: TECH_COL_H,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          justifyContent: "flex-end",
        }}>
          {metricsL.map((m, i) => (
            <div key={m.key} style={anim("hcSlideUp", 420, 600 + i * 80)}>
              <TechMetric label={m.label} score={m.score} max={m.max} available={m.available} />
            </div>
          ))}
        </div>

        <div style={{
          flex: 1,
          height: TECH_COL_H,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <div style={{ marginBottom: -20 }}>
            <SemiGauge score={data.totalScore} />
          </div>
          <div style={{
            position: "absolute",
            top: "100%",
            marginTop: 14,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}>
            <div style={{
              color: seg.color,
              fontSize: 26,
              fontWeight: 700,
              padding: "8px 28px",
              border: `2px solid ${seg.color}`,
              borderRadius: 8,
              background: C.cardBg,
              lineHeight: 1,
              ...anim("hcPop", 500, 1300),
              transformOrigin: "center bottom",
            }}>
              {seg.label}
            </div>
          </div>
        </div>

        <div style={{
          width: 170,
          height: TECH_COL_H,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          justifyContent: "flex-end",
        }}>
          {metricsR.map((m, i) => (
            <div key={m.key} style={anim("hcSlideUp", 420, 800 + i * 80)}>
              <TechMetric label={m.label} score={m.score} max={m.max} available={m.available} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function TechMetric({ label, score, max, available }: { label: string; score: number; max: number; available?: boolean }) {
  const ratio = max > 0 && available !== false ? score / max : 0;
  return (
    <div style={{
      background: C.innerBg,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "10px 14px",
    }}>
      <div style={{ color: C.textMuted, fontSize: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 2 }}>
        <span style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700 }}>
          {available === false ? "—" : Math.round(score)}
        </span>
        <span style={{ color: C.textFaint, fontSize: 11 }}>/{max}</span>
      </div>
      <div style={{ height: 4, background: "#eef0f3", marginTop: 6, borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          width: `${ratio * 100}%`,
          height: "100%",
          background: C.textPrimary,
          transformOrigin: "left center",
          ...anim("hcGrowBarX", 600, 1100),
        }} />
      </div>
    </div>
  );
}

function SemiGauge({ score }: { score: number }) {
  const w = 380;
  const h = 230;
  const cx = w / 2;
  const cy = h - 20;
  const r = 150;
  const arcAt = (frac: number) => {
    const a = Math.PI + Math.PI * frac;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };
  const arcLen = Math.PI * r;
  const seg = (from: number, to: number, color: string, delay: number) => {
    const a = arcAt(from);
    const b = arcAt(to);
    const large = to - from > 0.5 ? 1 : 0;
    const len = arcLen * (to - from);
    return (
      <path
        d={`M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`}
        stroke={color}
        strokeWidth={22}
        fill="none"
        strokeLinecap="butt"
        strokeDasharray={`${len} ${len}`}
        style={{
          strokeDashoffset: 0,
          animation: `hcDrawStroke 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both`,
          ["--len" as never]: `${len}`,
        }}
      />
    );
  };
  const needleEndDeg = (score / 100) * 180 - 180;
  const animKey = Math.round((needleEndDeg + 720) % 360);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {seg(0,    0.50, C.segSell,   200)}
      {seg(0.50, 0.65, C.segHold,   350)}
      {seg(0.65, 0.80, C.segBuy,    500)}
      {seg(0.80, 1.00, C.segStrong, 650)}
      {/* needle + 중심 dot — 점수 텍스트 뒤로 (회색, 가독성). */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `rotate(${needleEndDeg}deg)`,
        animation: `hcNeedleSweep_${animKey} 900ms cubic-bezier(0.22, 1, 0.36, 1) 950ms both`,
      }}>
        <line x1={cx} y1={cy} x2={cx + r - 6} y2={cy} stroke={C.textFaint} strokeWidth={3} strokeLinecap="round" />
      </g>
      <style>{`
        @keyframes hcNeedleSweep_${animKey} {
          from { transform: rotate(-180deg); }
          to   { transform: rotate(${needleEndDeg}deg); }
        }
      `}</style>
      <circle cx={cx} cy={cy} r={6} fill={C.textFaint} style={anim("hcPop", 350, 950)} />
      {/* 점수 텍스트 — 마지막에 그려져 needle 위에 오버레이 */}
      <text
        x={cx}
        y={cy - 44}
        textAnchor="middle"
        fontSize={44}
        fontWeight={700}
        fill={C.textPrimary}
        fontFamily={FONT}
        style={anim("hcCountUp", 500, 850)}
      >
        {score}
        <tspan fontSize={16} fill={C.textMuted} fontWeight={400}> / 100</tspan>
      </text>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────
// 3) Macro — 2×2 regime 매트릭스 + G/I/R 세로 게이지
// ──────────────────────────────────────────────────────────────

export interface HCMacroData {
  probs: RegimeProb[];      // 4 regime probabilities (RegimeKey)
  confidence: string | null;
  // G/I/R 스코어 (-1 ~ +1). 데이터 없으면 null.
  gScore: number | null;
  iScore: number | null;
  rScore: number | null;
}

const MACRO_REGIME_COLOR: Record<string, string> = {
  hardLanding: C.regHard,
  noLanding:   C.regNo,
  recovery:    C.regRec,
  softLanding: C.regSoft,
};
const MACRO_REGIME_LABEL: Record<string, string> = {
  hardLanding: "Hard Landing",
  noLanding:   "No Landing",
  recovery:    "Recovery",
  softLanding: "Soft Landing",
};
// 2×2 위치 — Hard 좌상, No 우상, Recovery 좌하, Soft 우하
const MACRO_REGIME_LAYOUT: Record<string, { row: 0 | 1; col: 0 | 1 }> = {
  hardLanding: { row: 0, col: 0 },
  noLanding:   { row: 0, col: 1 },
  recovery:    { row: 1, col: 0 },
  softLanding: { row: 1, col: 1 },
};

export function MacroHover({ data }: { data: HCMacroData }) {
  const dominantKey = data.probs.find((p) => p.isDominant)?.key ?? null;
  const cells = (["hardLanding", "noLanding", "recovery", "softLanding"] as const).map((k) => {
    const p = data.probs.find((x) => x.key === k);
    return {
      key: k,
      label: MACRO_REGIME_LABEL[k],
      color: MACRO_REGIME_COLOR[k],
      pct: p?.pct ?? 0,
      row: MACRO_REGIME_LAYOUT[k].row,
      col: MACRO_REGIME_LAYOUT[k].col,
    };
  });
  const gir: Array<{ label: string; full: string; score: number | null }> = [
    { label: "G", full: "성장 (G)",   score: data.gScore },
    { label: "I", full: "인플레 (I)", score: data.iScore },
    { label: "R", full: "리스크 (R)", score: data.rScore },
  ];
  return (
    <Shell>
      <div style={{ display: "flex", height: "100%", gap: 32 }}>
        <div style={{ width: 420, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 10,
            height: 320,
          }}>
            {cells.map((c, i) => {
              const isCurrent = c.key === dominantKey;
              return (
                <div key={c.key} style={{
                  background: isCurrent ? c.color : C.innerBg,
                  border: `1px solid ${isCurrent ? c.color : C.border}`,
                  borderRadius: 8,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: isCurrent ? "#fff" : C.textPrimary,
                  boxShadow: isCurrent ? `0 0 0 3px ${c.color}33` : "none",
                  ...anim(isCurrent ? "hcPop" : "hcSlideUp", 500, 250 + i * 100),
                  transformOrigin: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: isCurrent ? 700 : 600 }}>{c.label}</div>
                    {isCurrent && (
                      <div style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        background: "rgba(255,255,255,0.25)",
                        padding: "3px 10px",
                        borderRadius: 10,
                        letterSpacing: 0.3,
                        ...anim("hcFadeIn", 400, 800),
                      }}>현재 국면</div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: isCurrent ? "#fff" : c.color,
                  }}>
                    {Math.round((c.pct ?? 0))}%
                  </div>
                </div>
              );
            })}
          </div>
          {data.confidence && (
            <div style={{ marginTop: 16, fontSize: 16, color: C.textMuted, textAlign: "center", ...anim("hcFadeIn", 400, 900) }}>
              Confidence <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: 24, marginLeft: 4 }}>{data.confidence}</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", gap: 20, alignItems: "center", justifyContent: "center" }}>
          {gir.map((g, i) => (
            <div key={g.label} style={anim("hcSlideUp", 420, 600 + i * 120)}>
              <GirVertical full={g.full} label={g.label} score={g.score} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function GirVertical({ label, full, score }: { label: string; full: string; score: number | null }) {
  const barH = 280;
  const halfH = barH / 2;
  if (score == null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ color: C.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>{full}</div>
        <div style={{
          width: 22,
          height: barH,
          background: C.innerBg,
          border: `1px solid ${C.border}`,
          borderRadius: 11,
        }} />
        <div style={{ color: C.textFaint, fontSize: 18, fontWeight: 700 }}>—</div>
        <div style={{ color: C.textFaint, fontSize: 11 }}>{label}</div>
      </div>
    );
  }
  const clamped = Math.max(-1, Math.min(1, score));
  const absScore = Math.abs(clamped);
  const fillH = halfH * absScore;
  const isPos = clamped >= 0;
  const tone = isPos ? C.up : C.down;
  const scoreText = clamped > 0 ? `+${clamped.toFixed(2)}` : clamped.toFixed(2);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ color: C.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>{full}</div>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 22,
          height: barH,
          background: C.innerBg,
          border: `1px solid ${C.border}`,
          borderRadius: 11,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute",
            ...(isPos ? { bottom: halfH } : { top: halfH }),
            left: 0,
            width: "100%",
            height: fillH,
            background: tone,
            opacity: 0.9,
            borderRadius: isPos ? "11px 11px 0 0" : "0 0 11px 11px",
            transformOrigin: isPos ? "bottom" : "top",
            ...anim("hcGrowBar", 800, 750),
          }} />
        </div>
        <div style={{ position: "absolute", top: -2, left: -20, fontSize: 9, color: C.textFaint }}>+1</div>
        <div style={{ position: "absolute", top: halfH - 6, left: -14, fontSize: 9, color: C.textFaint }}>0</div>
        <div style={{ position: "absolute", bottom: -2, left: -20, fontSize: 9, color: C.textFaint }}>-1</div>
      </div>
      <div style={{ color: tone, fontSize: 20, fontWeight: 700, ...anim("hcCountUp", 400, 1200) }}>{scoreText}</div>
      <div style={{ color: C.textFaint, fontSize: 11 }}>{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 4) Commodity — verdict 박스 + 4 카테고리 노드맵 + 3 stats
// ──────────────────────────────────────────────────────────────

export interface HCCommodityCategory {
  key: "energy" | "metal" | "precious" | "agri";
  label: string;
  yoy: number;        // -1 ~ +∞ (실제 YoY 비율, 예: 0.18 = +18%)
}

export interface HCCommodityData {
  ticker: string;
  impactScore: number;
  verdictLabel: string;
  verdictColor: string;
  dayDelta: number | null;
  stats: Array<{ label: string; value: string; tone: string }>;  // 3개: 비용 영향 / 공급 안정성 / 향후 전망
  categories: HCCommodityCategory[];                              // 4개
}

const CATEGORY_LABEL: Record<string, string> = {
  energy: "에너지",
  metal: "산업금속",
  precious: "귀금속",
  agri: "농산물",
};

export function CommodityHover({ data }: { data: HCCommodityData }) {
  return (
    <Shell>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 16 }}>
        {/* 상단: 버블 차트 — 가로 가운데 정렬 (점수 박스 제거됨) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...anim("hcFadeIn", 500, 150) }}>
          <CategoryNodeMap data={data} />
        </div>
        {/* 하단: verdict (좌, 세로만 살짝 큼) + 3 stat (기존 사이즈).
           alignItems: flex-end → 모든 카드 하단 baseline 정렬, 각 카드는 자체 padding 만큼만. */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "flex-end" }}>
          {/* Verdict — 세로 padding ↑ → 자체적으로 키 큼 */}
          <div style={{
            background: C.innerBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "20px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            ...anim("hcSlideUp", 420, 1000),
          }}>
            <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8, whiteSpace: "nowrap" }}>종합 영향</div>
            <div style={{ color: data.verdictColor, fontSize: 22, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap", letterSpacing: -0.3 }}>
              {data.verdictLabel}
            </div>
          </div>
          {data.stats.map((s, i) => (
            <div key={s.label} style={{
              background: C.innerBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "12px 22px",
              textAlign: "center",
              ...anim("hcSlideUp", 420, 1100 + i * 100),
            }}>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4, whiteSpace: "nowrap" }}>{s.label}</div>
              <div style={{ color: s.tone, fontSize: 18, fontWeight: 700, whiteSpace: "nowrap" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function CategoryNodeMap({ data }: { data: HCCommodityData }) {
  const w = 460;
  const h = 360;
  // organic 비대칭 배치
  const positions: Record<string, { x: number; y: number }> = {
    energy:   { x: 0.28, y: 0.22 },
    precious: { x: 0.80, y: 0.30 },
    metal:    { x: 0.20, y: 0.68 },
    agri:     { x: 0.72, y: 0.78 },
  };
  // YoY 절대값 비례 — % 단위. min/max 사이즈 클램프.
  const maxAbs = Math.max(...data.categories.map((c) => Math.abs(c.yoy)), 0.01);
  const sizeOf = (yoy: number) => 32 + (Math.abs(yoy) / maxAbs) * 28; // r 32~60
  // 가격 ↑ = 원가 부담 ↑ = stock 에 negative. threshold 는 TempHoverCards mock 과 일치.
  //   yoy >= +10% → red (부담)
  //   yoy <= -5% → green (완화)
  //   그 사이 → yellow (중립)
  const colorOf = (yoy: number) =>
    yoy >= 0.10 ? C.negative : yoy <= -0.05 ? C.positive : C.warn;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <circle cx={w / 2} cy={h / 2} r={50} fill={C.cardBg} stroke={C.border} strokeDasharray="3 4" style={anim("hcFadeIn", 400, 300)} />
      <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fontSize={13} fill={C.textMuted} fontFamily={FONT} style={anim("hcFadeIn", 400, 400)}>
        {data.ticker}
      </text>
      <text x={w / 2} y={h / 2 + 14} textAnchor="middle" fontSize={11} fill={C.textFaint} fontFamily={FONT} style={anim("hcFadeIn", 400, 400)}>
        원자재 영향
      </text>
      {data.categories.map((c, i) => {
        const pos = positions[c.key];
        if (!pos) return null;
        const cx = pos.x * w;
        const cy = pos.y * h;
        return (
          <line
            key={`l-${c.key}`}
            x1={w / 2}
            y1={h / 2}
            x2={cx}
            y2={cy}
            stroke={C.border}
            strokeWidth={1.5}
            style={anim("hcFadeIn", 400, 500 + i * 100)}
          />
        );
      })}
      {data.categories.map((c, i) => {
        const pos = positions[c.key];
        if (!pos) return null;
        const cx = pos.x * w;
        const cy = pos.y * h;
        const r = sizeOf(c.yoy);
        const color = colorOf(c.yoy);
        const pctText = `${c.yoy > 0 ? "+" : ""}${(c.yoy * 100).toFixed(0)}%`;
        return (
          <g key={c.key} style={{ transformOrigin: `${cx}px ${cy}px`, ...anim("hcPop", 500, 600 + i * 130) }}>
            <circle cx={cx} cy={cy} r={r} fill={C.cardBg} />
            <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill={C.textPrimary} fontFamily={FONT}>
              {CATEGORY_LABEL[c.key] ?? c.label}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize={13} fontWeight={700} fill={color} fontFamily={FONT}>
              {pctText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
