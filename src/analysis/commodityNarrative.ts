// commodityNarrative — 원자재 영향 분석 페이지의 영향 점수·정성 라벨·YoY 산출.
// commodity_prices (DB) 의 symbol별 close 시계열에서 YoY/변동성/모멘텀을 계산.

import type { CommodityPrice } from "../types/investment";

// ──────────────────────────────────────────────────────────────
// 공용 유틸
// ──────────────────────────────────────────────────────────────

function ascByDate(rows: CommodityPrice[]): CommodityPrice[] {
  return [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function bySymbol(rows: CommodityPrice[]): Map<string, CommodityPrice[]> {
  const m = new Map<string, CommodityPrice[]>();
  for (const r of rows) {
    const arr = m.get(r.symbol) ?? [];
    arr.push(r);
    m.set(r.symbol, arr);
  }
  return m;
}

function latestClose(rows: CommodityPrice[]): number | null {
  const asc = ascByDate(rows);
  for (let i = asc.length - 1; i >= 0; i--) {
    if (asc[i]?.close != null) return asc[i]!.close;
  }
  return null;
}

function closeBefore(rows: CommodityPrice[], offsetFromEnd: number): number | null {
  const asc = ascByDate(rows);
  const idx = asc.length - 1 - offsetFromEnd;
  if (idx < 0) return null;
  return asc[idx]?.close ?? null;
}

// ──────────────────────────────────────────────────────────────
// 2.x / 3A.5 — symbol별 1년 YoY (252영업일 ≈ 1년)
// ──────────────────────────────────────────────────────────────

export function commodityYoy(rows: CommodityPrice[]): number | null {
  if (rows.length < 252) return null;
  const last = latestClose(rows);
  const yearAgo = closeBefore(rows, 252);
  if (last == null || yearAgo == null || yearAgo === 0) return null;
  return (last - yearAgo) / yearAgo;
}

// ──────────────────────────────────────────────────────────────
// 1B.2 — 종합 영향 점수 (0~100)
// 카테고리별 YoY 평균 → 가격 상승은 비용 부담 → 점수 ↓
// Energy 가중 0.4 (비용 영향 큼), Metal 0.3, Precious 0.2, Agri 0.1
// ──────────────────────────────────────────────────────────────

const ENERGY_SYMS = ["CL=F", "NG=F"];
const METAL_SYMS = ["HG=F", "LIT"];
const PRECIOUS_SYMS = ["GC=F", "SI=F"];
const AGRI_SYMS = ["ZW=F", "ZS=F", "ZC=F"];

function avgYoyBySymbols(byMap: Map<string, CommodityPrice[]>, symbols: string[]): number | null {
  const xs: number[] = [];
  for (const s of symbols) {
    const rows = byMap.get(s);
    if (!rows) continue;
    const y = commodityYoy(rows);
    if (y != null) xs.push(y);
  }
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export interface ImpactScore {
  score: number; // 0~100
  energyYoy: number | null;
  metalYoy: number | null;
  preciousYoy: number | null;
  agriYoy: number | null;
}

export function commodityImpactScore(rows: CommodityPrice[]): ImpactScore {
  const m = bySymbol(rows);
  const energy = avgYoyBySymbols(m, ENERGY_SYMS);
  const metal = avgYoyBySymbols(m, METAL_SYMS);
  const precious = avgYoyBySymbols(m, PRECIOUS_SYMS);
  const agri = avgYoyBySymbols(m, AGRI_SYMS);
  // 가중 합산 (가격 상승은 점수 ↓, 즉 부담)
  const parts: Array<{ yoy: number | null; weight: number }> = [
    { yoy: energy, weight: 0.4 },
    { yoy: metal, weight: 0.3 },
    { yoy: precious, weight: 0.2 },
    { yoy: agri, weight: 0.1 },
  ];
  let sumYoy = 0;
  let sumWeight = 0;
  for (const p of parts) {
    if (p.yoy == null) continue;
    sumYoy += p.yoy * p.weight;
    sumWeight += p.weight;
  }
  // YoY +50% 면 점수 0, YoY -50% 면 점수 100 으로 매핑 (선형)
  // baseline YoY 0% → 50점
  let score = 50;
  if (sumWeight > 0) {
    const wYoy = sumYoy / sumWeight;
    score = Math.round(Math.max(0, Math.min(100, 50 - wYoy * 100)));
  }
  return { score, energyYoy: energy, metalYoy: metal, preciousYoy: precious, agriYoy: agri };
}

// ──────────────────────────────────────────────────────────────
// 1B.4 / 1B.5 — verdict
// ──────────────────────────────────────────────────────────────

export interface Verdict {
  label: string;
  color: string;
}

export function verdictFromImpactScore(score: number): Verdict {
  if (score >= 60) return { label: "POSITIVE", color: "#60c846" };
  if (score >= 40) return { label: "NEUTRAL", color: "#f8eb37" };
  return { label: "NEGATIVE", color: "#c1121f" };
}

// ──────────────────────────────────────────────────────────────
// 1B.6 — 전날 대비 Δ
// ──────────────────────────────────────────────────────────────

export function scoreDayDelta(rows: CommodityPrice[]): {
  display: string;
  direction: "up" | "down" | "flat";
} {
  // 직전일 close 로 점수 재계산 → 차이
  const m = bySymbol(rows);
  // 가장 최근 두 날짜에서 각 symbol close 추출
  const today = commodityImpactScore(rows).score;
  // 전일 점수: 각 symbol asc 에서 끝-1 만 사용한 가상 rows
  const ytdRows: CommodityPrice[] = [];
  for (const [, arr] of m) {
    const asc = ascByDate(arr);
    if (asc.length < 2) continue;
    // 마지막을 제외한 시계열로 가상 새 데이터 만들기
    ytdRows.push(...asc.slice(0, -1));
  }
  const yesterday = commodityImpactScore(ytdRows).score;
  const diff = today - yesterday;
  if (diff > 0) return { display: `전날 대비 +${diff} (상승)`, direction: "up" };
  if (diff < 0) return { display: `전날 대비 ${diff} (하락)`, direction: "down" };
  return { display: `전날 대비 0 (보합)`, direction: "flat" };
}

// ──────────────────────────────────────────────────────────────
// 1A.4 — 비용 영향 ("부정적/중립/긍정적")
// ──────────────────────────────────────────────────────────────

export function costImpactLabel(energyYoy: number | null): {
  label: string;
  color: string;
} {
  if (energyYoy == null) return { label: "—", color: "#737474" };
  if (energyYoy >= 0.15) return { label: "부정적", color: "#c1121f" };
  if (energyYoy <= -0.05) return { label: "긍정적", color: "#60c846" };
  return { label: "중립", color: "#f8eb37" };
}

// ──────────────────────────────────────────────────────────────
// 1A.6 — 공급 안정성 ("양호/보통/불안") — 30일 변동성 (close stddev / mean)
// ──────────────────────────────────────────────────────────────

function volatility(rows: CommodityPrice[], windowN = 30): number | null {
  const asc = ascByDate(rows).slice(-windowN);
  const xs = asc.map((r) => r.close).filter((v): v is number => v != null);
  if (xs.length < 5) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return null;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const stddev = Math.sqrt(variance);
  return stddev / mean;
}

export function supplyStabilityLabel(rows: CommodityPrice[]): {
  label: string;
  color: string;
} {
  // 에너지 symbol 평균 변동성
  const m = bySymbol(rows);
  const vols: number[] = [];
  for (const s of ENERGY_SYMS) {
    const arr = m.get(s);
    if (!arr) continue;
    const v = volatility(arr);
    if (v != null) vols.push(v);
  }
  if (vols.length === 0) return { label: "—", color: "#737474" };
  const avgVol = vols.reduce((a, b) => a + b, 0) / vols.length;
  if (avgVol <= 0.03) return { label: "양호", color: "#60c846" };
  if (avgVol <= 0.06) return { label: "보통", color: "#f8eb37" };
  return { label: "불안", color: "#c1121f" };
}

// ──────────────────────────────────────────────────────────────
// 1A.8 — 향후 전망 (30일 모멘텀)
// ──────────────────────────────────────────────────────────────

function momentum30(rows: CommodityPrice[]): number | null {
  const asc = ascByDate(rows);
  const last = latestClose(asc);
  const before30 = closeBefore(asc, 30);
  if (last == null || before30 == null || before30 === 0) return null;
  return (last - before30) / before30;
}

export function outlookLabel(rows: CommodityPrice[]): {
  label: string;
  color: string;
} {
  const m = bySymbol(rows);
  // 모든 카테고리 평균 모멘텀
  const allSyms = [...ENERGY_SYMS, ...METAL_SYMS, ...PRECIOUS_SYMS, ...AGRI_SYMS];
  const xs: number[] = [];
  for (const s of allSyms) {
    const arr = m.get(s);
    if (!arr) continue;
    const v = momentum30(arr);
    if (v != null) xs.push(v);
  }
  if (xs.length === 0) return { label: "—", color: "#737474" };
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  // 비용 관점: 가격 ↑ → 부정적
  if (avg >= 0.05) return { label: "부정적", color: "#c1121f" };
  if (avg <= -0.03) return { label: "긍정적", color: "#60c846" };
  return { label: "중립", color: "#f8eb37" };
}

// ──────────────────────────────────────────────────────────────
// 6.4 — 카테고리별 stance (Overweight/Neutral/Underweight)
// ──────────────────────────────────────────────────────────────

export function categoryStanceLabel(catYoy: number | null): {
  label: string;
  color: string;
  bg: string;
} {
  if (catYoy == null) return { label: "—", color: "#737474", bg: "#f0f0f0" };
  if (catYoy >= 0.20) return { label: "Overweight", color: "#569379", bg: "#e6f3ec" };
  if (catYoy >= -0.05) return { label: "Neutral", color: "#f6bc65", bg: "#fff5e1" };
  return { label: "Underweight", color: "#ed6a67", bg: "#fde5e4" };
}

// ──────────────────────────────────────────────────────────────
// §2 main-four / §3-A 8 카드 — symbol 별 latest + YoY
// ──────────────────────────────────────────────────────────────

export interface SymbolStat {
  symbol: string;
  latest: number | null;
  yoy: number | null;
  unit: string | null;
}

export function symbolStat(rows: CommodityPrice[], symbol: string): SymbolStat {
  const arr = bySymbol(rows).get(symbol) ?? [];
  return {
    symbol,
    latest: latestClose(arr),
    yoy: commodityYoy(arr),
    unit: arr[0]?.unit ?? null,
  };
}

export function maxDate(rows: CommodityPrice[]): string | null {
  let max: string | null = null;
  for (const r of rows) {
    if (max == null || r.date > max) max = r.date;
  }
  return max;
}
