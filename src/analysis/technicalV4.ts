// technicalV4 — slots-v4 §5.3 의 6-metric 가중 합산.
// 만점: Super Trend 20 / 이동평균선 20 / MACD 15 / RSI 15 / VIX 15 / 거래량 15 = 100.
//
// DB 컬럼: close / volume / rsi_14 / macd / ma_50 / ma_200.
// 2026-05 보강: ma_20, macd_signal, supertrend_signal/value/days — 단, technicalHistory
// 와 다른 row (close=NULL) 라서 `latestSignals` 별도 인자로 전달받음.
//
// history 는 DESC (latest first) 가정 — `/api/company` 응답 그대로.

import type {
  GlobalEnvironmentPoint,
  StockPriceTech,
  TechnicalSignalSnapshot,
} from "../types/investment";
import { clamp } from "./severity";

export type TechnicalMetricKey =
  | "superTrend"
  | "movingAverage"
  | "macd"
  | "rsi"
  | "vix"
  | "volume";

export interface TechnicalMetricScore {
  key: TechnicalMetricKey;
  label: string;
  score: number;
  max: number;
  /** 60일 정규화 시계열 (0~max 범위, ASC) — sparkline 용 */
  series: Array<number | null>;
  note: string;
  available: boolean;
}

export type TechnicalSignal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export interface ScoreHistoryPoint {
  date: string;
  score: number;
}

export interface TechnicalAnalysisV4 {
  metrics: TechnicalMetricScore[];
  totalScore: number;
  totalMax: 100;
  signal: TechnicalSignal;
  /** 직전 60일 종합 점수 재계산 — 재계산값(과거 저장값 아님) */
  scoreHistory: ScoreHistoryPoint[];
}

const METRIC_LABELS: Record<TechnicalMetricKey, string> = {
  superTrend: "Super Trend",
  movingAverage: "이동평균선",
  macd: "MACD",
  rsi: "RSI",
  vix: "VIX 지수",
  volume: "거래량",
};

const METRIC_MAX: Record<TechnicalMetricKey, number> = {
  superTrend: 20,
  movingAverage: 20,
  macd: 15,
  rsi: 15,
  vix: 15,
  volume: 15,
};

// ASC 시계열에서 인덱스 i 의 N일 trailing SMA — 충분치 않으면 null.
function trailingSMA(asc: number[], i: number, n: number): number | null {
  if (i < n - 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += asc[k];
  return s / n;
}

function emptyMetric(key: TechnicalMetricKey, note: string): TechnicalMetricScore {
  return {
    key,
    label: METRIC_LABELS[key],
    score: 0,
    max: METRIC_MAX[key],
    series: [],
    note,
    available: false,
  };
}

// DB 직값 사용: supertrend_signal/days. 보강 데이터가 있으면 proxy 대신 직접 점수화.
// 점수 분포:
//   Buy  + days≥10 → 18~20
//   Buy  + days<10 → 14~18 (days 비례)
//   Sell + days≥10 → 0~3
//   Sell + days<10 → 3~6
function superTrendFromDb(signal: "Buy" | "Sell", days: number): number {
  const conf = Math.min(Math.max(days, 0) / 10, 1); // 0..1
  if (signal === "Buy") return 14 + conf * 6; // 14..20
  return 6 - conf * 6; // 0..6
}

// ── 1) Super Trend (proxy fallback) ────────────────────────────
// close > MA200 + MA200 rising → bullish. close < MA200 + falling → bearish.
// 정식 ATR-based super trend 아님 — DB 보강 신호 없을 때만 사용.
function superTrendScore(
  closeAsc: number[],
  ma200Asc: Array<number | null>,
): { score: number; note: string; series: number[] } {
  if (closeAsc.length < 50) {
    return { score: 0, note: "데이터 부족", series: [] };
  }
  const i = closeAsc.length - 1;
  const close = closeAsc[i];
  const ma = ma200Asc[i] ?? null;
  if (ma == null) {
    return { score: 5, note: "MA200 결측 — proxy 보수적", series: [] };
  }
  // 거리 (close vs MA) 정규화: ±20% → ±1
  const dist = (close - ma) / ma;
  const distScore = clamp(dist / 0.20, -1, 1); // -1..+1
  // 기울기: MA200 5일 변화율
  const ma5BackVal = ma200Asc[Math.max(0, i - 5)];
  const slope = ma5BackVal != null ? (ma - ma5BackVal) / ma5BackVal : 0;
  const slopeScore = clamp(slope / 0.02, -1, 1); // ±2% → ±1
  // 합산: 0.6 * dist + 0.4 * slope, -1..+1 → 0..20
  const norm = (distScore * 0.6 + slopeScore * 0.4 + 1) / 2;
  const score = norm * 20;

  // 60일 series — 각 시점에서 distScore + slopeScore 정규화 0..20
  const series: number[] = [];
  for (let k = Math.max(0, closeAsc.length - 60); k < closeAsc.length; k++) {
    const ck = closeAsc[k];
    const mk = ma200Asc[k];
    if (mk == null) {
      series.push(0);
      continue;
    }
    const d = clamp((ck - mk) / mk / 0.20, -1, 1);
    const prev = ma200Asc[Math.max(0, k - 5)];
    const sl = prev != null ? clamp(((mk - prev) / prev) / 0.02, -1, 1) : 0;
    series.push(((d * 0.6 + sl * 0.4 + 1) / 2) * 20);
  }

  let note: string;
  if (close > ma && slope > 0) note = "MA200 상향 + 가격 우위 — 강세";
  else if (close > ma) note = "MA200 위 유지 — 중립~약강세";
  else if (close < ma && slope < 0) note = "MA200 하향 + 가격 열위 — 약세";
  else note = "MA200 아래 — 약세 시그널";

  return { score, note, series };
}

// ── 2) 이동평균선 ──────────────────────────────────────────────
// close > MA50 > MA200 → 정렬 양호. golden/death cross 보너스.
function movingAverageScore(
  closeAsc: number[],
  ma50Asc: Array<number | null>,
  ma200Asc: Array<number | null>,
): { score: number; note: string; series: number[] } {
  if (closeAsc.length < 50) return { score: 0, note: "데이터 부족", series: [] };
  const i = closeAsc.length - 1;
  const close = closeAsc[i];
  const ma50 = ma50Asc[i] ?? null;
  const ma200 = ma200Asc[i] ?? null;
  if (ma50 == null && ma200 == null) {
    return { score: 5, note: "MA 결측", series: [] };
  }

  const computeAt = (k: number): number => {
    const c = closeAsc[k];
    const m50 = ma50Asc[k];
    const m200 = ma200Asc[k];
    let parts = 0;
    let n = 0;
    if (m50 != null) {
      parts += clamp(((c - m50) / m50) / 0.10, -1, 1);
      n++;
    }
    if (m200 != null) {
      parts += clamp(((c - m200) / m200) / 0.20, -1, 1);
      n++;
    }
    if (m50 != null && m200 != null) {
      parts += clamp(((m50 - m200) / m200) / 0.10, -1, 1);
      n++;
    }
    if (n === 0) return 10;
    const norm = (parts / n + 1) / 2;
    return norm * 20;
  };

  const score = computeAt(i);
  const series: number[] = [];
  for (let k = Math.max(0, closeAsc.length - 60); k < closeAsc.length; k++) {
    series.push(computeAt(k));
  }

  let note: string;
  if (ma50 != null && ma200 != null && close > ma50 && ma50 > ma200) {
    note = "정배열 (close > MA50 > MA200) — 강세";
  } else if (ma50 != null && ma200 != null && close < ma50 && ma50 < ma200) {
    note = "역배열 (close < MA50 < MA200) — 약세";
  } else {
    note = "혼조 (배열 일부 어긋남)";
  }
  return { score, note, series };
}

// ── 3) MACD ────────────────────────────────────────────────────
// MACD 양수 + 추세 우상향 → 강세. signal line (DB macd_signal) 이 있으면 cross 가산.
function macdScore(
  macdAsc: Array<number | null>,
  closeAsc: number[],
  latestMacdSignal: number | null = null,
): { score: number; note: string; series: number[] } {
  const validIdx = macdAsc.findIndex((v) => v != null);
  if (validIdx === -1) return { score: 0, note: "MACD 결측", series: [] };

  const i = closeAsc.length - 1;
  const cur = macdAsc[i] ?? null;
  if (cur == null) return { score: 5, note: "MACD 최신 결측", series: [] };

  // 정규화 기준: |MACD| 평균(지난 60일) 의 2배까지를 ±1.
  const recent = macdAsc.slice(Math.max(0, i - 59), i + 1).filter((v): v is number => v != null);
  const meanAbs = recent.length > 0
    ? recent.reduce((a, b) => a + Math.abs(b), 0) / recent.length
    : 1;
  const denom = Math.max(meanAbs * 2, 0.01);

  const computeAt = (k: number): number | null => {
    const v = macdAsc[k];
    if (v == null) return null;
    const norm = clamp(v / denom, -1, 1);
    return ((norm + 1) / 2) * 15;
  };

  const score = computeAt(i) ?? 7.5;
  const series: number[] = [];
  for (let k = Math.max(0, closeAsc.length - 60); k < closeAsc.length; k++) {
    series.push(computeAt(k) ?? 0);
  }

  // signal line 보정: macd > signal → +2 (cross up bonus, cap 15) / macd < signal → -1.5
  let adjustedScore = score;
  let signalNote = "";
  if (latestMacdSignal != null) {
    const diff = cur - latestMacdSignal;
    if (diff > 0) {
      adjustedScore = Math.min(15, score + 2);
      signalNote = " · signal선 위 (강세 cross)";
    } else {
      adjustedScore = Math.max(0, score - 1.5);
      signalNote = " · signal선 아래";
    }
  }

  let note: string;
  if (cur > meanAbs * 0.5) note = "MACD 양수·강세 영역";
  else if (cur > 0) note = "MACD 양수 — 약강세";
  else if (cur > -meanAbs * 0.5) note = "MACD 음수 — 약약세";
  else note = "MACD 음수·약세 영역";

  return { score: adjustedScore, note: note + signalNote, series };
}

// ── 4) RSI ─────────────────────────────────────────────────────
// 50 부근 균형. 30 미만 과매도 / 70 초과 과매수 — 단기 신호.
// 점수: 50 부근 = 만점 / 양극단 = 낮음.
function rsiScoreFn(rsiAsc: Array<number | null>): { score: number; note: string; series: number[] } {
  const i = rsiAsc.length - 1;
  const cur = rsiAsc[i];
  if (cur == null) return { score: 0, note: "RSI 결측", series: [] };

  const computeAt = (v: number | null): number => {
    if (v == null) return 0;
    const dist = Math.abs(v - 50) / 50; // 0..1
    return (1 - dist) * 15;
  };

  const score = computeAt(cur);
  const series: number[] = [];
  for (let k = Math.max(0, rsiAsc.length - 60); k < rsiAsc.length; k++) {
    series.push(computeAt(rsiAsc[k] ?? null));
  }

  let note: string;
  if (cur > 70) note = `과매수 (${cur.toFixed(0)})`;
  else if (cur < 30) note = `과매도 (${cur.toFixed(0)})`;
  else if (cur >= 45 && cur <= 55) note = `중립권 (${cur.toFixed(0)})`;
  else note = `완만 (${cur.toFixed(0)})`;
  return { score, note, series };
}

// ── 5) VIX ─────────────────────────────────────────────────────
// VIX 낮으면 GREED → 높은 점수. 30+ FEAR → 낮은 점수.
function vixScoreFn(
  vixLatest: number | null,
  vixHistoryAsc: number[],
): { score: number; note: string; series: number[] } {
  if (vixLatest == null) return { score: 0, note: "VIX 결측", series: [] };
  const computeAt = (v: number): number => {
    // 12 → 15점, 20 → 10점, 30 → 5점, 45+ → 0점
    if (v < 12) return 15;
    if (v < 20) return 10 + (20 - v) * (5 / 8);
    if (v < 30) return 5 + (30 - v) * (5 / 10);
    if (v < 45) return Math.max(0, 5 - (v - 30) * (5 / 15));
    return 0;
  };

  const score = computeAt(vixLatest);
  const series = vixHistoryAsc.slice(-60).map(computeAt);

  let note: string;
  if (vixLatest < 12) note = `GREED (${vixLatest.toFixed(1)})`;
  else if (vixLatest < 20) note = `NEUTRAL (${vixLatest.toFixed(1)})`;
  else if (vixLatest < 30) note = `FEAR (${vixLatest.toFixed(1)})`;
  else if (vixLatest < 45) note = `EXTREME FEAR (${vixLatest.toFixed(1)})`;
  else note = `PANIC (${vixLatest.toFixed(1)})`;
  return { score, note, series };
}

// ── 6) 거래량 ──────────────────────────────────────────────────
// 최근 거래량 vs 20일 평균. 1.5x 이상 + 가격 상승 → 강세.
function volumeScore(
  volumeAsc: Array<number | null>,
  closeAsc: number[],
): { score: number; note: string; series: number[] } {
  if (volumeAsc.length < 20) return { score: 0, note: "데이터 부족", series: [] };

  const computeAt = (k: number): number | null => {
    const v = volumeAsc[k];
    if (v == null) return null;
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, k - 19); j < k; j++) {
      const x = volumeAsc[j];
      if (x != null) {
        sum += x;
        n++;
      }
    }
    if (n === 0) return null;
    const avg = sum / n;
    if (avg <= 0) return 7.5;
    const ratio = v / avg;
    // 가격 추세 부호 — 5일 close 변화
    const c0 = closeAsc[Math.max(0, k - 5)];
    const c1 = closeAsc[k];
    const priceUp = c1 > c0;
    // ratio 1 = 7.5점, ratio 1.5 = 12점, 2.0 = 15점, 0.5 = 3점
    const base = clamp((ratio - 0.5) / 1.5, 0, 1) * 15;
    // 가격이 하락 중이면 거래량이 많아도 약세 신호 → 감산
    const adj = priceUp ? base : Math.max(0, base * 0.6);
    return adj;
  };

  const i = closeAsc.length - 1;
  const score = computeAt(i) ?? 7.5;
  const series: number[] = [];
  for (let k = Math.max(0, closeAsc.length - 60); k < closeAsc.length; k++) {
    series.push(computeAt(k) ?? 0);
  }

  const v = volumeAsc[i];
  let avg = 0;
  let nv = 0;
  for (let j = Math.max(0, i - 19); j < i; j++) {
    const x = volumeAsc[j];
    if (x != null) {
      avg += x;
      nv++;
    }
  }
  avg = nv > 0 ? avg / nv : 0;
  const ratio = v != null && avg > 0 ? v / avg : 1;
  const note = ratio >= 1.5 ? `거래량 급증 (${ratio.toFixed(1)}x)` : ratio >= 1.0 ? `평균 이상 (${ratio.toFixed(1)}x)` : `평균 이하 (${ratio.toFixed(1)}x)`;

  return { score, note, series };
}

// ── 신호 등급 매핑 ─────────────────────────────────────────────
function totalToSignal(total: number): TechnicalSignal {
  if (total >= 80) return "STRONG_BUY";
  if (total >= 60) return "BUY";
  if (total >= 40) return "HOLD";
  if (total >= 20) return "SELL";
  return "STRONG_SELL";
}

// ── 외부 진입점 ────────────────────────────────────────────────
export function technicalAnalysisV4(
  historyDesc: StockPriceTech[],
  vixLatest: GlobalEnvironmentPoint | null,
  vixHistoryDesc: GlobalEnvironmentPoint[] = [],
  latestSignals: TechnicalSignalSnapshot | null = null,
): TechnicalAnalysisV4 {
  const asc = [...historyDesc].reverse();
  const closeAsc = asc.map((t) => t.close ?? 0);
  const validClose = asc.map((t) => t.close).filter((v): v is number => v != null);
  const hasClose = validClose.length >= 20;
  const ma50Asc = asc.map((t) => t.ma50);
  const ma200Asc = asc.map((t) => t.ma200);
  const macdAsc = asc.map((t) => t.macd);
  const rsiAsc = asc.map((t) => t.rsi14);
  const volAsc = asc.map((t) => t.volume);

  const vixHistoryAsc = [...vixHistoryDesc].reverse().map((p) => p.value);

  const metrics: TechnicalMetricScore[] = [];

  if (!hasClose) {
    return {
      metrics: (Object.keys(METRIC_MAX) as TechnicalMetricKey[]).map((k) =>
        emptyMetric(k, "데이터 부족"),
      ),
      totalScore: 0,
      totalMax: 100,
      signal: "HOLD",
      scoreHistory: [],
    };
  }

  const st = superTrendScore(closeAsc, ma200Asc);
  // DB 직값 우선: supertrend_signal 이 있으면 점수만 override (series 는 proxy 유지).
  let stScore = st.score;
  let stNote = st.note;
  let stAvailable = st.score > 0;
  if (latestSignals?.supertrendSignal) {
    const days = latestSignals.supertrendDays ?? 0;
    stScore = superTrendFromDb(latestSignals.supertrendSignal, days);
    stNote = `${latestSignals.supertrendSignal === "Buy" ? "상승 추세" : "하락 추세"} ${days}일째`;
    stAvailable = true;
  }
  metrics.push({
    key: "superTrend",
    label: METRIC_LABELS.superTrend,
    score: stScore,
    max: METRIC_MAX.superTrend,
    series: st.series,
    note: stNote,
    available: stAvailable,
  });

  const ma = movingAverageScore(closeAsc, ma50Asc, ma200Asc);
  metrics.push({
    key: "movingAverage",
    label: METRIC_LABELS.movingAverage,
    score: ma.score,
    max: METRIC_MAX.movingAverage,
    series: ma.series,
    note: ma.note,
    available: ma.score > 0,
  });

  const macd = macdScore(macdAsc, closeAsc, latestSignals?.macdSignal ?? null);
  metrics.push({
    key: "macd",
    label: METRIC_LABELS.macd,
    score: macd.score,
    max: METRIC_MAX.macd,
    series: macd.series,
    note: macd.note,
    available: macd.score > 0,
  });

  const rsi = rsiScoreFn(rsiAsc);
  metrics.push({
    key: "rsi",
    label: METRIC_LABELS.rsi,
    score: rsi.score,
    max: METRIC_MAX.rsi,
    series: rsi.series,
    note: rsi.note,
    available: rsi.score > 0,
  });

  const vix = vixScoreFn(vixLatest?.value ?? null, vixHistoryAsc);
  metrics.push({
    key: "vix",
    label: METRIC_LABELS.vix,
    score: vix.score,
    max: METRIC_MAX.vix,
    series: vix.series,
    note: vix.note,
    available: vixLatest != null,
  });

  const vol = volumeScore(volAsc, closeAsc);
  metrics.push({
    key: "volume",
    label: METRIC_LABELS.volume,
    score: vol.score,
    max: METRIC_MAX.volume,
    series: vol.series,
    note: vol.note,
    available: vol.score > 0,
  });

  const totalScore = Math.round(metrics.reduce((s, m) => s + m.score, 0));
  const signal = totalToSignal(totalScore);

  // 종합 점수 추이 (60일) — 각 metric series 합산. 길이가 안 맞으면 짧은 쪽 기준.
  const seriesLen = Math.min(...metrics.map((m) => m.series.length).filter((n) => n > 0));
  const scoreHistory: ScoreHistoryPoint[] = [];
  if (seriesLen > 0) {
    const tailDates = asc.slice(-seriesLen).map((t) => t.date);
    for (let k = 0; k < seriesLen; k++) {
      let sum = 0;
      for (const m of metrics) {
        const offset = m.series.length - seriesLen;
        const v = m.series[offset + k];
        sum += typeof v === "number" ? v : 0;
      }
      scoreHistory.push({ date: tailDates[k], score: Math.round(sum) });
    }
  }

  return { metrics, totalScore, totalMax: 100, signal, scoreHistory };
}

// 신호 등급 → 한글 라벨
export function signalLabel(s: TechnicalSignal): string {
  switch (s) {
    case "STRONG_BUY":
      return "Strong Buy";
    case "BUY":
      return "Buy";
    case "HOLD":
      return "Hold";
    case "SELL":
      return "Sell";
    case "STRONG_SELL":
      return "Strong Sell";
  }
}

// 신호 → 색조 ("up" | "down" | "neutral")
export function signalTone(s: TechnicalSignal): "up" | "down" | "neutral" {
  if (s === "STRONG_BUY" || s === "BUY") return "up";
  if (s === "SELL" || s === "STRONG_SELL") return "down";
  return "neutral";
}

// 20일 단순 SMA — close history (DESC) 받아 ASC 결과 반환.
// MA20 컬럼 부재 → 페이지에서 직접 계산 필요할 때 쓰는 헬퍼.
export function sma20FromCloseDesc(historyDesc: StockPriceTech[]): Array<{ date: string; value: number | null }> {
  const asc = [...historyDesc].reverse();
  const out: Array<{ date: string; value: number | null }> = [];
  for (let i = 0; i < asc.length; i++) {
    const c = asc[i].close;
    if (c == null) {
      out.push({ date: asc[i].date, value: null });
      continue;
    }
    if (i < 19) {
      out.push({ date: asc[i].date, value: null });
      continue;
    }
    let sum = 0;
    let n = 0;
    for (let k = i - 19; k <= i; k++) {
      const v = asc[k].close;
      if (v != null) {
        sum += v;
        n++;
      }
    }
    out.push({ date: asc[i].date, value: n > 0 ? sum / n : null });
  }
  return out;
}

void trailingSMA;
