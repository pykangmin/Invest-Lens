// macroNarrative — 거시경제 페이지 G/I/R 점수 산출 + 기여 변수 + 부연/경고 라벨.
// macro_regime_scores (DB) 의 4 regime prob/dominant/confidence 와
// global_environment 의 거시 지표를 결합해 시안의 §1·§6·§7 데이터를 생성.

import type {
  GlobalEnvironmentPoint,
  MacroRegimeScore,
} from "../types/investment";

const REG_HARD_COLOR = "#c1121f";
const REG_NO_COLOR = "#4a7aff";
const REG_REC_COLOR = "#fdb43a";
const REG_SOFT_COLOR = "#60c846";

// ──────────────────────────────────────────────────────────────
// 공용 유틸
// ──────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function latestAsc(points: GlobalEnvironmentPoint[]): GlobalEnvironmentPoint[] {
  return [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function latestValue(points: GlobalEnvironmentPoint[]): number | null {
  const asc = latestAsc(points);
  const last = asc[asc.length - 1]?.value;
  return last == null ? null : last;
}

function valueBefore(
  points: GlobalEnvironmentPoint[],
  offsetFromEnd: number,
): number | null {
  const asc = latestAsc(points);
  const idx = asc.length - 1 - offsetFromEnd;
  if (idx < 0) return null;
  return asc[idx]?.value ?? null;
}

// 월별 index → YoY % (12개월 전 대비).
function yoyFromIndex(points: GlobalEnvironmentPoint[]): number | null {
  const asc = latestAsc(points);
  if (asc.length < 13) return null;
  const latest = asc[asc.length - 1]?.value;
  const yearAgo = asc[asc.length - 13]?.value;
  if (latest == null || yearAgo == null || yearAgo === 0) return null;
  return (latest - yearAgo) / yearAgo;
}

// 직전 N 개월 평균 → 모멘텀 (현재 - 평균).
function momentum(
  points: GlobalEnvironmentPoint[],
  windowN: number,
): number | null {
  const asc = latestAsc(points);
  if (asc.length < windowN + 1) return null;
  const latest = asc[asc.length - 1]?.value;
  if (latest == null) return null;
  let sum = 0;
  let n = 0;
  for (let i = asc.length - 1 - windowN; i < asc.length - 1; i++) {
    const v = asc[i]?.value;
    if (v == null) continue;
    sum += v;
    n++;
  }
  if (n === 0) return null;
  return latest - sum / n;
}

// ──────────────────────────────────────────────────────────────
// 1.3 dominant — DB CamelCase → 띄어쓰기 라벨 + 색상
// ──────────────────────────────────────────────────────────────

export type RegimeKey = "hard" | "no" | "recovery" | "soft";

export function regimeFromDominant(s: string | null): {
  key: RegimeKey | null;
  label: string;
  color: string;
} {
  if (!s) return { key: null, label: "—", color: "#737474" };
  if (s === "HardLanding") return { key: "hard", label: "Hard Landing", color: REG_HARD_COLOR };
  if (s === "NoLanding") return { key: "no", label: "No Landing", color: REG_NO_COLOR };
  if (s === "Recovery") return { key: "recovery", label: "Recovery", color: REG_REC_COLOR };
  if (s === "SoftLanding") return { key: "soft", label: "Soft Landing", color: REG_SOFT_COLOR };
  return { key: null, label: s, color: "#737474" };
}

// ──────────────────────────────────────────────────────────────
// 1.5 Confidence label → %
// ──────────────────────────────────────────────────────────────

export function confidenceToPct(label: string | null): string {
  if (!label) return "—";
  const norm = label.trim().toLowerCase();
  if (norm.endsWith("%")) return label;
  if (norm === "high") return "90%";
  if (norm === "medium") return "70%";
  if (norm === "low") return "50%";
  return label;
}

// ──────────────────────────────────────────────────────────────
// §2 4 regime card 데이터
// ──────────────────────────────────────────────────────────────

export interface RegimeProbCard {
  key: RegimeKey;
  label: string;
  pct: number; // 0..100
  color: string;
  cardBg: string;
}

export function regimeProbCards(latest: MacroRegimeScore | null): RegimeProbCard[] {
  const pct = (v: number | null | undefined) =>
    v == null ? 0 : Math.round(v * 100);
  return [
    {
      key: "hard",
      label: "Hard Landing",
      pct: pct(latest?.hardLandingProb),
      color: REG_HARD_COLOR,
      cardBg: "#fffbfb",
    },
    {
      key: "no",
      label: "No Landing",
      pct: pct(latest?.noLandingProb),
      color: REG_NO_COLOR,
      cardBg: "#f8faff",
    },
    {
      key: "recovery",
      label: "Recovery",
      pct: pct(latest?.recoveryProb),
      color: REG_REC_COLOR,
      cardBg: "#fffbf4",
    },
    {
      key: "soft",
      label: "Soft Landing",
      pct: pct(latest?.softLandingProb),
      color: REG_SOFT_COLOR,
      cardBg: "#f9fff7",
    },
  ];
}

// ──────────────────────────────────────────────────────────────
// §1·§6 G/I/R 점수 산출 + 기여 변수
// ──────────────────────────────────────────────────────────────

export interface GirContrib {
  variable: string;
  weightPct: number; // 시안 표기 (양수=양의 영향, 음수=음의 영향)
  value: number; // 기여값 -1~+1
  display: string; // "+0.21" / "-0.10" 등
}

export interface GirScore {
  key: "G" | "I" | "R";
  title: string;
  contribs: GirContrib[];
  total: number; // -1~+1 합산
  totalDisplay: string;
  totalColor: string;
  bigDisplay: string; // §1 용 (예: "-0.42")
  bigColor: string;
  detailLabel: string; // §1 부연
}

function fmtSigned(v: number, digits = 2): string {
  if (v >= 0) return `+${v.toFixed(digits)}`;
  return `-${Math.abs(v).toFixed(digits)}`;
}

function fmtSignedMinus(v: number, digits = 2): string {
  // 합계용 (U+2212 minus 부호로 시안 일치)
  if (v >= 0) return `+${v.toFixed(digits)}`;
  return `−${Math.abs(v).toFixed(digits)}`;
}

function colorFromValue(v: number): string {
  if (v > 0.05) return "#60c846";
  if (v < -0.05) return "#c1121f";
  return "#747474";
}

// 단일 contrib 행 계산 — 정규화된 값(-1~+1) × weight 부호 적용한 결과.
// 시안의 weightPct 는 가중치 부호 자체 (예: 실업 −20% 는 -0.20 weight).
function buildContrib(
  variable: string,
  weightPct: number,
  normalized: number | null,
): GirContrib {
  if (normalized == null) {
    return {
      variable,
      weightPct,
      value: 0,
      display: "—",
    };
  }
  const v = clamp(normalized, -1, 1) * (weightPct / 100);
  return {
    variable,
    weightPct,
    value: v,
    display: fmtSigned(v, 2),
  };
}

// G score — 성장 (PMI 수준·모멘텀·실업·주식 모멘텀)
export function buildGScore(
  ismMan: GlobalEnvironmentPoint[],
  unrate: GlobalEnvironmentPoint[],
  marketIndexMomentum: number | null,
): GirScore {
  // PMI 수준: (ISM_MAN - 50) / 10 → -1~+1 (50 기준)
  const ismLatest = latestValue(ismMan);
  const pmiLevel = ismLatest != null ? (ismLatest - 50) / 10 : null;
  // PMI 모멘텀: 3개월 평균 대비 변화 / 3
  const pmiMomRaw = momentum(ismMan, 3);
  const pmiMom = pmiMomRaw != null ? pmiMomRaw / 3 : null;
  // 실업 지표 (음수 가중): UNRATE 모멘텀 → 양수면 실업↑ (G악화)
  const unrMomRaw = momentum(unrate, 3);
  // normalize: 0.3pp 상승을 +1 로 매핑
  const unrSeverity = unrMomRaw != null ? unrMomRaw / 0.3 : null;
  // 주식 모멘텀: 외부 입력 (-1~+1 가정)
  const mkt = marketIndexMomentum;

  const c1 = buildContrib("PMI 수준 (35%)", 35, pmiLevel);
  const c2 = buildContrib("PMI 모멘텀 (30%)", 30, pmiMom);
  const c3 = buildContrib("실업 지표 (−20%)", -20, unrSeverity);
  const c4 = buildContrib("주식 모멘텀 (15%)", 15, mkt);

  const contribs = [c1, c2, c3, c4];
  const total = contribs.reduce((a, b) => a + b.value, 0);

  // 부연 라벨 (PMI 임계)
  const detail =
    ismLatest == null
      ? "—"
      : ismLatest < 48
        ? "PMI 수축권 진입"
        : ismLatest < 50
          ? "PMI 경계권"
          : ismLatest < 53
            ? "PMI 확장 초입"
            : "PMI 확장 안착";

  return {
    key: "G",
    title: "G Score 기여 요인",
    contribs,
    total,
    totalDisplay: fmtSignedMinus(total),
    totalColor: colorFromValue(total),
    bigDisplay: fmtSigned(total),
    bigColor: colorFromValue(total),
    detailLabel: detail,
  };
}

// I score — 인플레 (물가 모멘텀·긴축·실질 금리)
export function buildIScore(
  cpi: GlobalEnvironmentPoint[],
  fedfunds: GlobalEnvironmentPoint[],
  dgs10: GlobalEnvironmentPoint[],
): GirScore {
  // 물가 모멘텀: CPI YoY 변화 (가속 → I 점수 부정적, 즉 -)
  const cpiYoy = yoyFromIndex(cpi);
  const cpiYoyPrev = (() => {
    const asc = latestAsc(cpi);
    if (asc.length < 25) return null;
    const lat = asc[asc.length - 13]?.value;
    const year2 = asc[asc.length - 25]?.value;
    if (lat == null || year2 == null || year2 === 0) return null;
    return (lat - year2) / year2;
  })();
  const inflChange =
    cpiYoy != null && cpiYoyPrev != null ? cpiYoy - cpiYoyPrev : null;
  // 가속 → 음수 contrib (I 점수 부정), 둔화 → 양수
  // normalize: 1%p 변화를 ±1
  const inflNorm = inflChange != null ? -inflChange / 0.01 : null;

  // 긴축 강도: FEDFUNDS 모멘텀 / 0.5pp 단위
  const fedMomRaw = momentum(fedfunds, 3);
  const fedNorm = fedMomRaw != null ? fedMomRaw / 0.5 : null;

  // 실질 금리: (DGS10 - CPI YoY) → normalize / 2pp
  const dgs10Latest = latestValue(dgs10);
  const realRate =
    dgs10Latest != null && cpiYoy != null ? dgs10Latest / 100 - cpiYoy : null;
  // realRate 단위: decimal (예: 0.02 = 2%). 2% 를 +1 로
  const realRateNorm = realRate != null ? realRate / 0.02 : null;

  const c1 = buildContrib("물가 모멘텀 (40%)", 40, inflNorm);
  const c2 = buildContrib("긴축 강도 (35%)", 35, fedNorm);
  const c3 = buildContrib("실질 금리 (25%)", 25, realRateNorm);

  const contribs = [c1, c2, c3];
  const total = contribs.reduce((a, b) => a + b.value, 0);

  // 부연: CPI YoY 추세
  const detail =
    inflChange == null
      ? "—"
      : inflChange < -0.005
        ? "디스인플레이션 진행"
        : inflChange < 0.005
          ? "인플레 안정"
          : inflChange < 0.015
            ? "인플레 둔화"
            : "인플레 가속";

  return {
    key: "I",
    title: "I Score 기여 요인",
    contribs,
    total,
    totalDisplay: fmtSignedMinus(total),
    totalColor: colorFromValue(total),
    bigDisplay: fmtSigned(total),
    bigColor: colorFromValue(total),
    detailLabel: detail,
  };
}

// R score — 리스크 (신용 리스크·역수익률곡선·유동성)
export function buildRScore(
  hySpread: GlobalEnvironmentPoint[],
  dgs10: GlobalEnvironmentPoint[],
  dgs2: GlobalEnvironmentPoint[],
  m2: GlobalEnvironmentPoint[],
): GirScore {
  // 신용 리스크: HY 스프레드 (>4%=리스크 ↑). DB는 % 단위로 추정 (2.87 = 2.87%).
  // 4% 기준 +1, 2% 기준 -1.
  const hyLatest = latestValue(hySpread);
  const hyNorm = hyLatest != null ? (hyLatest - 3) / 1 : null;
  // 역수익률곡선: DGS2 - DGS10 (양수면 역전 = 리스크)
  const dgs10L = latestValue(dgs10);
  const dgs2L = latestValue(dgs2);
  const curveInversion =
    dgs10L != null && dgs2L != null ? dgs2L - dgs10L : null;
  // 0.5%p 역전 시 +1
  const curveNorm = curveInversion != null ? curveInversion / 0.5 : null;
  // 유동성 (음수 가중): M2 YoY (높을수록 R 점수에 -)
  const m2Yoy = yoyFromIndex(m2);
  // 5% YoY 를 +1 로
  const m2Norm = m2Yoy != null ? m2Yoy / 0.05 : null;

  const c1 = buildContrib("신용 리스크 (45%)", 45, hyNorm);
  const c2 = buildContrib("역수익률곡선 (30%)", 30, curveNorm);
  const c3 = buildContrib("유동성 (−25%)", -25, m2Norm);

  const contribs = [c1, c2, c3];
  const total = contribs.reduce((a, b) => a + b.value, 0);

  // 부연: R score 임계
  const detail =
    total >= 0.5
      ? `임계치 초과 (${fmtSigned(total)})`
      : total >= 0.3
        ? "임계 근접"
        : total >= 0
          ? "리스크 관망"
          : "리스크 안정";

  return {
    key: "R",
    title: "R Score 기여 요인",
    contribs,
    total,
    totalDisplay: fmtSignedMinus(total),
    totalColor: colorFromValue(total),
    bigDisplay: fmtSigned(total),
    bigColor: colorFromValue(total),
    detailLabel: detail,
  };
}

// ──────────────────────────────────────────────────────────────
// §7 선행 경고 체크리스트 (6 카드)
// ──────────────────────────────────────────────────────────────

export interface WarningCardSpec {
  title: string;
  body: string;
}

export function buildWarningCards(
  hySpread: GlobalEnvironmentPoint[],
  ismMan: GlobalEnvironmentPoint[],
  unrate: GlobalEnvironmentPoint[],
  dgs10: GlobalEnvironmentPoint[],
  dgs2: GlobalEnvironmentPoint[],
  ismSvc: GlobalEnvironmentPoint[],
  m2: GlobalEnvironmentPoint[],
): WarningCardSpec[] {
  const fmt2 = (v: number | null, suffix = "") =>
    v == null ? "—" : `${v.toFixed(2)}${suffix}`;
  const fmt1 = (v: number | null, suffix = "") =>
    v == null ? "—" : `${v.toFixed(1)}${suffix}`;

  // 1) HY 스프레드
  const hyLatest = latestValue(hySpread);
  const hyBp = hyLatest != null ? hyLatest * 100 : null;
  const hyTitle =
    hyBp != null && hyBp >= 450
      ? "HY 스프레드 임계 초과"
      : hyBp != null && hyBp >= 350
        ? "HY 스프레드 경계 진입"
        : "HY 스프레드 안정";
  const hyBody =
    hyBp != null
      ? `${hyBp.toFixed(0)}bp — 경고선(450bp) ${hyBp >= 450 ? "돌파" : "미만"}, R Score 주 지표`
      : "—";

  // 2) ISM 제조업
  const ismLatest = latestValue(ismMan);
  const ismMom = momentum(ismMan, 3);
  const ismTitle =
    ismLatest == null
      ? "ISM 제조업 PMI —"
      : ismLatest < 48
        ? "ISM 제조업 PMI 수축 지속"
        : ismLatest < 50
          ? "ISM 제조업 PMI 경계권"
          : ismLatest < 52
            ? "ISM 제조업 PMI 확장 초입"
            : "ISM 제조업 PMI 확장 안착";
  const ismBody =
    ismLatest != null
      ? `${fmt1(ismLatest)} — 3개월 모멘텀 ${ismMom != null && ismMom >= 0 ? "+" : ""}${fmt1(ismMom)}, G Score 핵심 지표`
      : "—";

  // 3) 실업률
  const urLatest = latestValue(unrate);
  const urMom = momentum(unrate, 3);
  const urTitle =
    urMom != null && urMom >= 0.3
      ? "실업률 상승 추세"
      : urMom != null && urMom >= 0.1
        ? "실업률 완만한 상승"
        : urMom != null && urMom <= -0.1
          ? "실업률 안정·하락"
          : "실업률 보합";
  const urBody =
    urLatest != null
      ? `${fmt1(urLatest, "%")} — 3개월 ${urMom != null && urMom >= 0 ? "+" : ""}${fmt1(urMom, "pp")}, Sahm Rule 경계 ${urMom != null && urMom >= 0.5 ? "초과" : "미만"}`
      : "—";

  // 4) 수익률 곡선
  const d10 = latestValue(dgs10);
  const d2 = latestValue(dgs2);
  const spread10y2y = d10 != null && d2 != null ? d10 - d2 : null;
  const curveTitle =
    spread10y2y != null && spread10y2y < 0
      ? "수익률 곡선 역전 (Inversion)"
      : spread10y2y != null && spread10y2y < 0.5
        ? "수익률 곡선 플래트닝"
        : "수익률 곡선 정상화";
  const curveBody =
    spread10y2y != null
      ? `10Y–2Y ${spread10y2y >= 0 ? "+" : ""}${fmt2(spread10y2y, "%")} — ${spread10y2y >= 0 ? "정상 스티프닝" : "역전 구간"}`
      : "—";

  // 5) 서비스 PMI
  const svcLatest = latestValue(ismSvc);
  const svcTitle =
    svcLatest == null
      ? "서비스 PMI —"
      : svcLatest < 50
        ? "서비스 PMI 수축"
        : svcLatest < 52
          ? "서비스 PMI 경계"
          : "서비스 PMI 확장";
  const svcBody =
    svcLatest != null
      ? `${fmt1(svcLatest)} — ${svcLatest >= 50 ? "확장권" : "수축권"}, ${svcLatest >= 52 ? "안정" : "전환 가능"}`
      : "—";

  // 6) M2 유동성
  const m2Yoy = yoyFromIndex(m2);
  const m2YoyPct = m2Yoy != null ? m2Yoy * 100 : null;
  const m2Title =
    m2YoyPct == null
      ? "M2 유동성 —"
      : m2YoyPct < 0
        ? "M2 유동성 위축"
        : m2YoyPct < 3
          ? "M2 유동성 완만한 회복"
          : m2YoyPct < 6
            ? "M2 유동성 정상 회복"
            : "M2 유동성 급증";
  const m2Body =
    m2YoyPct != null
      ? `YoY ${m2YoyPct >= 0 ? "+" : ""}${fmt1(m2YoyPct, "%")} — R Score ${m2YoyPct >= 0 ? "하방 지지" : "상방 압력"}`
      : "—";

  return [
    { title: hyTitle, body: hyBody },
    { title: ismTitle, body: ismBody },
    { title: urTitle, body: urBody },
    { title: curveTitle, body: curveBody },
    { title: svcTitle, body: svcBody },
    { title: m2Title, body: m2Body },
  ];
}
