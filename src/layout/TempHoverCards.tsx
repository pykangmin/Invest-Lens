// TempHoverCards — /temp 라우트.
//
// 크기: 813×660 — 실제 ChartPanel.
// UX: 탭 selector + 큰 카드 1개 + Replay 버튼.
// 톤: 대시보드 변수 1:1.
// 데이터: detail §1 hero 1:1 (mock).
// 표현: detail 과 시각 도구 달리함 — radar / 4-segment 가로 게이지 / 2×2 매트릭스 / 노드맵.
// 변경사항:
//   - 각 카드 상단 제목 제거.
//   - Technical: 반원 게이지 / 매도/강매수 라벨 삭제. detail §1-B 와 동일한 4-segment 가로 게이지로 교체.
//     marker 가 실제 score% 위치에 정확히 위치. 배지는 영어 라벨 (Sell/Hold/Buy/Strong buy).
//   - 각 지표 기여도 수치 색을 중립 톤(네이비)으로 변경 — 색의 의미 없음.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// ──────────────────────────────────────────────────────────────
// 디자인 토큰
// ──────────────────────────────────────────────────────────────

const C = {
  pageBg: "#fafbfc",
  cardBg: "#ffffff",
  innerBg: "#fafbfc",
  border: "#e9e9e9",
  shadow: "0 8px 24px rgba(0, 48, 73, 0.10)",
  textPrimary: "#003049",
  textStrong: "#373737",
  textBody: "#4e4e4e",
  textMuted: "#7f7f7f",
  textFaint: "#a3a3a3",
  up: "#60c846",
  upStrong: "#43bb2e",
  down: "#c1121f",
  info: "#4073ff",
  warn: "#ff9737",
  verdictBuy: "#60c846",
  verdictHold: "#e5af43",
  verdictSell: "#c1121f",
  // Signal segments — TechnicalDetail.SIGNAL_SEGMENTS 와 동일
  segSell: "#c1121f",
  segHold: "#e5af43",
  segBuy: "#33a316",
  segStrong: "#157f0a",
  // Macro regime
  regHard: "#c1121f",
  regNo: "#4a7aff",
  regRec: "#fdb43a",
  regSoft: "#60c846",
  // Commodity verdict
  positive: "#60c846",
  neutral: "#f8eb37",
  negative: "#c1121f",
} as const;

const FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const CARD_W = 813;
const CARD_H = 660;

// ──────────────────────────────────────────────────────────────
// 전역 keyframes
// ──────────────────────────────────────────────────────────────

const ANIM_CSS = `
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
@keyframes hcCountUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const anim = (name: string, dur = 600, delay = 0, easing = "cubic-bezier(0.22, 1, 0.36, 1)"): CSSProperties => ({
  animation: `${name} ${dur}ms ${easing} ${delay}ms both`,
});

// ──────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────

type TabKey = "fundamental" | "technical" | "macro" | "commodity";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "fundamental", label: "기업 펀더멘털" },
  { key: "technical",   label: "기술적 지표" },
  { key: "macro",       label: "거시 경제" },
  { key: "commodity",   label: "원자재 영향" },
];

export function TempHoverCards() {
  const [active, setActive] = useState<TabKey>("fundamental");
  const [replayKey, setReplayKey] = useState(0);

  const triggerReplay = () => setReplayKey((k) => k + 1);
  const switchTab = (k: TabKey) => {
    if (k === active) {
      triggerReplay();
    } else {
      setActive(k);
      setReplayKey((v) => v + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") switchTab("fundamental");
      else if (e.key === "2") switchTab("technical");
      else if (e.key === "3") switchTab("macro");
      else if (e.key === "4") switchTab("commodity");
      else if (e.key.toLowerCase() === "r") triggerReplay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const page: CSSProperties = {
    background: C.pageBg,
    minHeight: "100vh",
    padding: "32px 24px",
    fontFamily: FONT,
    color: C.textPrimary,
  };

  const toolbar: CSSProperties = {
    maxWidth: CARD_W,
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div style={page}>
      <style>{ANIM_CSS}</style>

      <div style={{ maxWidth: CARD_W, margin: "0 auto 12px", color: C.textMuted, fontSize: 12 }}>
        Hover Cards · /temp
        <div style={{ color: C.textFaint, fontSize: 11, marginTop: 2 }}>
          크기 813×660 (실 ChartPanel) · 단축키 1–4 카드 전환, R 리플레이
        </div>
      </div>

      <div style={toolbar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: `1px solid ${active === t.key ? C.textPrimary : C.border}`,
              background: active === t.key ? C.textPrimary : C.cardBg,
              color: active === t.key ? "#fff" : C.textBody,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={triggerReplay}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: `1px solid ${C.info}`,
            background: C.info,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ display: "inline-block", transform: "translateY(-1px)" }}>▶</span>
          애니메이션 다시 재생
        </button>
      </div>

      <div style={{ maxWidth: CARD_W, margin: "0 auto" }}>
        <div key={`${active}-${replayKey}`}>
          {active === "fundamental" && <FundamentalHover />}
          {active === "technical"   && <TechnicalHover />}
          {active === "macro"       && <MacroHover />}
          {active === "commodity"   && <CommodityHover />}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 공통 Shell — 제목 헤더 제거. 카드 컨테이너만 제공.
// ──────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: CARD_W,
      height: CARD_H,
      background: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      boxShadow: C.shadow,
      padding: "32px 36px",
      boxSizing: "border-box",
      ...anim("hcCardIn", 420),
    }}>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 1) Fundamental — 4축 다이아몬드 + 섹션별 metric 묶음
//    섹션 % 수치는 중립 톤 (verdict 색 제거).
// ──────────────────────────────────────────────────────────────

const FUND_MOCK = {
  totalScore: 77,
  verdict: { label: "매수 추천", color: C.verdictBuy },
  sections: [
    { key: "cashflow", label: "현금흐름", ratio: 0.95, metrics: [
      { label: "FCF (연간)",   value: "$96B" },
      { label: "Gross Margin", value: "46.2%" },
    ] },
    { key: "profit", label: "수익성", ratio: 1.0, metrics: [
      { label: "ROE",        value: "190.9%" },
      { label: "Net Margin", value: "26.4%" },
    ] },
    { key: "valuation", label: "가치평가", ratio: 0.65, metrics: [
      { label: "EV/EBITDA", value: "23.9x" },
      { label: "PER",       value: "23.9×" },
    ] },
    { key: "growth", label: "성장성", ratio: 0.78, metrics: [
      { label: "매출 성장 YoY", value: "+6.1%" },
      { label: "EPS Growth",   value: "+13.4%" },
    ] },
  ],
};

function FundamentalHover() {
  const d = FUND_MOCK;
  return (
    <Shell>
      <div style={{ display: "flex", height: "100%", gap: 32, alignItems: "center" }}>
        <div style={{ width: 380, display: "flex", justifyContent: "center", ...anim("hcFadeIn", 500, 150) }}>
          <FundDiamond data={d} />
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateRows: "1fr 1fr", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {d.sections.map((s, i) => (
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
                {/* 섹션 % — 중립 톤 */}
                <span style={{ color: C.textBody, fontSize: 11, fontWeight: 600 }}>
                  {Math.round(s.ratio * 100)}%
                </span>
              </div>
              {s.metrics.map((m) => (
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

function FundDiamond({ data }: { data: typeof FUND_MOCK }) {
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
  const polyPts = data.sections.map((s, i) => pt(axes[i].angle, s.ratio));
  const polyStr = polyPts.map((p) => `${p.x},${p.y}`).join(" ");

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
          fill={data.verdict.color}
          fillOpacity={0.18}
          stroke={data.verdict.color}
          strokeWidth={2.5}
        />
      </g>
      {data.sections.map((s, i) => {
        const p = pt(axes[i].angle, s.ratio);
        return (
          <g key={s.key} style={{ transformOrigin: `${p.x}px ${p.y}px`, ...anim("hcPop", 380, 700 + i * 80) }}>
            <circle cx={p.x} cy={p.y} r={5} fill={data.verdict.color} />
          </g>
        );
      })}
      <g style={anim("hcCountUp", 500, 900)}>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={42} fontWeight={700} fill={C.textPrimary} fontFamily={FONT}>
          {data.totalScore}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={13} fill={data.verdict.color} fontWeight={700} fontFamily={FONT}>
          {data.verdict.label}
        </text>
      </g>
      {data.sections.map((s, i) => {
        const p = pt(axes[i].angle, 1.18);
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
// 2) Technical — TechnicalDetail.SignalGaugeBar 와 동일 4-segment 가로 게이지
//    반원 게이지 제거 / 매도·강매수 라벨 제거 / marker 가 정확한 score% 위치 / 배지 영어 (Sell/Hold/Buy/Strong buy).
//    metric 칩 막대는 중립 톤 (색 의미 제거).
// ──────────────────────────────────────────────────────────────

const SIGNAL_SEGMENTS = [
  { label: "Sell",       start: 0,   end: 50,  color: C.segSell },
  { label: "Hold",       start: 50,  end: 65,  color: C.segHold },
  { label: "Buy",        start: 65,  end: 80,  color: C.segBuy },
  { label: "Strong buy", start: 80,  end: 100, color: C.segStrong },
];
const SIGNAL_TICKS = [0, 50, 65, 80, 100];
function activeSegment(score: number) {
  for (const s of SIGNAL_SEGMENTS) {
    if (score >= s.start && score < s.end) return s;
  }
  return SIGNAL_SEGMENTS[SIGNAL_SEGMENTS.length - 1];
}

const TECH_MOCK = {
  totalScore: 74,
  metricsL: [
    { key: "superTrend", label: "Super Trend", score: 16, max: 20 },
    { key: "ma",         label: "이동평균",     score: 14, max: 20 },
    { key: "macd",       label: "MACD",        score: 12, max: 15 },
  ],
  metricsR: [
    { key: "rsi",    label: "RSI",     score: 10, max: 15 },
    { key: "vix",    label: "VIX",     score: 11, max: 15 },
    { key: "volume", label: "거래량",   score: 11, max: 15 },
  ],
};

// Gauge wrapper effective flex height (SVG h 230 - marginBottom 20 = 210).
// chip column 도 동일 height 으로 맞춰 alignItems: center 시 양 col bottom 이 정렬됨.
const TECH_COL_H = 210;

function TechnicalHover() {
  const d = TECH_MOCK;
  const seg = activeSegment(d.totalScore);
  return (
    <Shell>
      {/* alignItems: center → 양 col 의 세로 중앙이 카드 중앙과 정렬.
         양 col height 을 210 으로 통일 → 중앙 정렬 시 양 col 의 하단도 동일 y 에서 정렬.
         chip col 은 justifyContent: flex-end 로 chip 을 col 하단에 붙임 → chip 마지막 line 이 arc baseline 과 일치. */}
      <div style={{ display: "flex", height: "100%", alignItems: "center", gap: 20, padding: "0 4px" }}>
        <div style={{
          width: 170,
          height: TECH_COL_H,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          justifyContent: "flex-end",
        }}>
          {d.metricsL.map((m, i) => (
            <div key={m.key} style={anim("hcSlideUp", 420, 600 + i * 80)}>
              <TechMetric label={m.label} score={m.score} max={m.max} />
            </div>
          ))}
        </div>

        {/* 중앙: 반원 게이지 + Buy 배지(baseline 아래) */}
        <div style={{
          flex: 1,
          height: TECH_COL_H,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <div style={{ marginBottom: -20 }}>
            <SemiGauge score={d.totalScore} />
          </div>
          {/* 배지: outer translateX(-50%) 가로 중앙, inner hcPop 애니메이션 — transform 충돌 방지 */}
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
          {d.metricsR.map((m, i) => (
            <div key={m.key} style={anim("hcSlideUp", 420, 800 + i * 80)}>
              <TechMetric label={m.label} score={m.score} max={m.max} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
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

  // needle 회전 — 0%(왼쪽) 일 때 -180°, 100%(오른쪽) 일 때 0°.
  // line 은 (cx,cy) → (cx+r, cy) 우측 수평. CSS rotate 는 시계방향 이므로
  // 반시계 방향으로 (180 - score*1.8)° 회전 = rotate(score*1.8 - 180)°.
  const needleEndDeg = (score / 100) * 180 - 180;  // 음수 (시작 -180, 끝 0)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {seg(0,    0.50, C.segSell,   200)}
      {seg(0.50, 0.65, C.segHold,   350)}
      {seg(0.65, 0.80, C.segBuy,    500)}
      {seg(0.80, 1.00, C.segStrong, 650)}
      {/* 중앙 점수 — 원래 위치 */}
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
      {/* 바늘 — (cx,cy)→(cx+r,cy) 수평선 회전 */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `rotate(${needleEndDeg}deg)`,
        animation: `hcNeedleSweep_${Math.round((needleEndDeg + 720) % 360)} 900ms cubic-bezier(0.22, 1, 0.36, 1) 950ms both`,
      }}>
        <line x1={cx} y1={cy} x2={cx + r - 6} y2={cy} stroke={C.textPrimary} strokeWidth={3} strokeLinecap="round" />
      </g>
      <style>{`
        @keyframes hcNeedleSweep_${Math.round((needleEndDeg + 720) % 360)} {
          from { transform: rotate(-180deg); }
          to   { transform: rotate(${needleEndDeg}deg); }
        }
      `}</style>
      <circle cx={cx} cy={cy} r={6} fill={C.textPrimary} style={anim("hcPop", 350, 950)} />
    </svg>
  );
}

function TechMetric({ label, score, max }: { label: string; score: number; max: number }) {
  const ratio = max > 0 ? score / max : 0;
  // 중립 톤 — 색 의미 제거
  return (
    <div style={{
      background: C.innerBg,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "10px 14px",
    }}>
      <div style={{ color: C.textMuted, fontSize: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 2 }}>
        <span style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700 }}>{score}</span>
        <span style={{ color: C.textFaint, fontSize: 11 }}>/{max}</span>
      </div>
      <div style={{ height: 4, background: "#eef0f3", marginTop: 6, borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          width: `${ratio * 100}%`,
          height: "100%",
          background: C.textPrimary,  // 중립 네이비
          transformOrigin: "left center",
          ...anim("hcGrowBarX", 600, 1100),
        }} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 3) Macro — 2×2 regime 매트릭스 + G/I/R 세로 게이지
// ──────────────────────────────────────────────────────────────

const MACRO_MOCK = {
  dominantKey: "hard" as "hard" | "no" | "recovery" | "soft",
  confidencePct: "63%",
  regimeProbs: {
    hard:     { label: "Hard Landing", pct: 0.53, color: C.regHard },
    no:       { label: "No Landing",   pct: 0.18, color: C.regNo },
    recovery: { label: "Recovery",     pct: 0.12, color: C.regRec },
    soft:     { label: "Soft Landing", pct: 0.17, color: C.regSoft },
  },
  // G/I/R 스코어 — analysis/macroNarrative 의 실제 range 는 -1~+1 (0 내외 분포).
  gir: [
    { label: "G", full: "성장 (G)",   score: -0.60 },
    { label: "I", full: "인플레 (I)", score: +0.31 },
    { label: "R", full: "리스크 (R)", score: -0.11 },
  ],
};

function MacroHover() {
  const d = MACRO_MOCK;
  const cells: Array<{ key: "hard" | "no" | "recovery" | "soft"; row: 0 | 1; col: 0 | 1 }> = [
    { key: "hard",     row: 0, col: 0 },
    { key: "no",       row: 0, col: 1 },
    { key: "recovery", row: 1, col: 0 },
    { key: "soft",     row: 1, col: 1 },
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
            height: 360,
          }}>
            {cells.map((c, i) => {
              const reg = d.regimeProbs[c.key];
              const isCurrent = c.key === d.dominantKey;
              return (
                <div key={c.key} style={{
                  background: isCurrent ? reg.color : C.innerBg,
                  border: `1px solid ${isCurrent ? reg.color : C.border}`,
                  borderRadius: 8,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: isCurrent ? "#fff" : C.textPrimary,
                  boxShadow: isCurrent ? `0 0 0 3px ${reg.color}33` : "none",
                  ...anim(isCurrent ? "hcPop" : "hcSlideUp", 500, 250 + i * 100),
                  transformOrigin: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: isCurrent ? 700 : 600 }}>
                      {reg.label}
                    </div>
                    {/* 현재 국면 — 제목 아래, 작은 박스 배지 */}
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
                    fontSize: 32,
                    fontWeight: 700,
                    color: isCurrent ? "#fff" : reg.color,
                  }}>
                    {Math.round(reg.pct * 100)}%
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 18, fontSize: 16, color: C.textMuted, textAlign: "center", ...anim("hcFadeIn", 400, 900) }}>
            Confidence <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: 26, marginLeft: 4 }}>{d.confidencePct}</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 20, alignItems: "center", justifyContent: "center" }}>
          {d.gir.map((g, i) => (
            <div key={g.label} style={anim("hcSlideUp", 420, 600 + i * 120)}>
              <GirVertical {...g} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// G/I/R 세로 게이지 — score -1~+1.
// 색상은 현재 국면 요약 카드와 통일: 양수=초록(C.up), 음수=빨강(C.down).
function GirVertical({ label, full, score }: { label: string; full: string; score: number }) {
  const barH = 300;
  const halfH = barH / 2;
  const clamped = Math.max(-1, Math.min(1, score));
  const absScore = Math.abs(clamped);
  const fillH = halfH * absScore;
  const isPos = clamped >= 0;
  const tone = isPos ? C.up : C.down;
  const scoreText = clamped > 0 ? `+${clamped.toFixed(2)}` : clamped.toFixed(2);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ color: C.textMuted, fontSize: 12 }}>{full}</div>
      {/* Bar wrapper — 라벨을 bar 옆에 두기 위한 relative 컨테이너 (overflow visible). */}
      <div style={{ position: "relative" }}>
        {/* 실제 bar (overflow hidden 으로 fill 클리핑) */}
        <div style={{
          width: 22,
          height: barH,
          background: C.innerBg,
          border: `1px solid ${C.border}`,
          borderRadius: 11,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* fill — 0 쪽 끝이 halfH(중앙)에 정확히 닿음. 양 끝(±1)만 반원. 내부 0-line 제거 → 이격 없음. */}
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
        {/* 외부 라벨 — bar 좌측에 ±1, 0 */}
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
// 4) Commodity — verdict 중심 + 4 카테고리 노드맵
// ──────────────────────────────────────────────────────────────

const COMM_MOCK = {
  impactScore: 23,
  verdict: { label: "NEGATIVE", color: C.negative },
  dayDelta: -2,
  stats: [
    { label: "비용 영향",   value: "상승 압력",   tone: C.negative },
    { label: "공급 안정성", value: "다소 불안정", tone: C.warn },
    { label: "향후 전망",   value: "부정적",      tone: C.negative },
  ],
  categories: [
    { key: "energy",   label: "에너지",   yoy: +18, color: C.negative },
    { key: "metal",    label: "산업금속", yoy: +12, color: C.negative },
    { key: "precious", label: "귀금속",   yoy: +5,  color: C.warn },
    { key: "agri",     label: "농산물",   yoy: -3,  color: C.positive },
  ],
};

function CommodityHover() {
  const d = COMM_MOCK;
  return (
    <Shell>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 18 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 460, flexShrink: 0, ...anim("hcFadeIn", 500, 150) }}>
            <CategoryNodeMap data={d} />
          </div>
          <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 6,
            background: C.innerBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "16px 18px",
          }}>
            <div style={{ color: C.textMuted, fontSize: 14, ...anim("hcFadeIn", 350, 300) }}>종합 영향</div>
            <div style={{ color: d.verdict.color, fontSize: 38, fontWeight: 700, lineHeight: 1, letterSpacing: -0.5, ...anim("hcSlideUp", 600, 400) }}>
              {d.verdict.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6, ...anim("hcCountUp", 400, 800) }}>
              <span style={{ color: C.textPrimary, fontSize: 28, fontWeight: 700 }}>{d.impactScore}</span>
              <span style={{ color: C.textMuted, fontSize: 13 }}>/100</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 12, ...anim("hcFadeIn", 350, 1000) }}>
              전날 대비 {d.dayDelta > 0 ? `+${d.dayDelta}` : d.dayDelta} ({d.dayDelta >= 0 ? "상승" : "하락"})
            </div>
          </div>
        </div>
        {/* 하단 stats — 텍스트 길이에 비례한 폭 (auto sizing) */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {d.stats.map((s, i) => (
            <div key={s.label} style={{
              background: C.innerBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "12px 24px",
              textAlign: "center",
              ...anim("hcSlideUp", 420, 1100 + i * 100),
            }}>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.tone, fontSize: 18, fontWeight: 700, whiteSpace: "nowrap" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function CategoryNodeMap({ data }: { data: typeof COMM_MOCK }) {
  const w = 460;
  const h = 360;
  // organic 비대칭 배치 — 십자형 X. 각 카테고리 별 서로 다른 각도/거리로 중심에서 흩뿌림.
  const positions: Record<string, { x: number; y: number }> = {
    energy:   { x: 0.28, y: 0.22 },  // 상-좌
    precious: { x: 0.80, y: 0.30 },  // 상-우
    metal:    { x: 0.20, y: 0.68 },  // 하-좌
    agri:     { x: 0.72, y: 0.78 },  // 하-우
  };
  const maxAbs = Math.max(...data.categories.map((c) => Math.abs(c.yoy)), 1);
  const sizeOf = (yoy: number) => 32 + (Math.abs(yoy) / maxAbs) * 28; // max r 60

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* 중앙 가이드 + AAPL 라벨 */}
      <circle cx={w / 2} cy={h / 2} r={50} fill={C.cardBg} stroke={C.border} strokeDasharray="3 4" style={anim("hcFadeIn", 400, 300)} />
      <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fontSize={13} fill={C.textMuted} fontFamily={FONT} style={anim("hcFadeIn", 400, 400)}>
        AAPL
      </text>
      <text x={w / 2} y={h / 2 + 14} textAnchor="middle" fontSize={11} fill={C.textFaint} fontFamily={FONT} style={anim("hcFadeIn", 400, 400)}>
        원자재 영향
      </text>
      {/* 연결선 — 모두 먼저 그려서 원이 그 위에 올라옴 */}
      {data.categories.map((c, i) => {
        const pos = positions[c.key];
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
      {/* 노드 — 불투명 (배경의 line 이 비치지 않도록 cardBg 베이스 + 색 tint 위에 덮기) */}
      {data.categories.map((c, i) => {
        const pos = positions[c.key];
        const cx = pos.x * w;
        const cy = pos.y * h;
        const r = sizeOf(c.yoy);
        return (
          <g key={c.key} style={{ transformOrigin: `${cx}px ${cy}px`, ...anim("hcPop", 500, 600 + i * 130) }}>
            {/* 베이스 흰 원 — 라인 차단 */}
            <circle cx={cx} cy={cy} r={r} fill={C.cardBg} />
            {/* 색 tint */}
            <circle cx={cx} cy={cy} r={r} fill={c.color} fillOpacity={0.18} stroke={c.color} strokeWidth={2.5} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill={C.textPrimary} fontFamily={FONT}>
              {c.label}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize={13} fontWeight={700} fill={c.color} fontFamily={FONT}>
              {c.yoy > 0 ? `+${c.yoy}%` : `${c.yoy}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
