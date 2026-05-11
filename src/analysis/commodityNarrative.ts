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

// ──────────────────────────────────────────────────────────────
// §3-B 변동률 비교 — 가로 bar chart (YoY 큰 순 정렬)
// ──────────────────────────────────────────────────────────────

export interface BarChangeItem {
  label: string;
  symbol: string;
  yoyPct: number; // %
  color: string;
}

const BAR_META: Array<{ symbol: string; label: string; color: string }> = [
  { symbol: "LIT", label: "리튬", color: "#43bb2e" },
  { symbol: "NG=F", label: "천연가스", color: "#60c846" },
  { symbol: "CL=F", label: "WTI 원유", color: "#c1121f" },
  { symbol: "SI=F", label: "은", color: "#9a9a9a" },
  { symbol: "GC=F", label: "금", color: "#e5af43" },
  { symbol: "HG=F", label: "구리", color: "#fdb43a" },
  { symbol: "ZS=F", label: "대두", color: "#3da12c" },
  { symbol: "ZW=F", label: "소맥", color: "#9c6cc7" },
];

export function barChangeData(rows: CommodityPrice[]): BarChangeItem[] {
  const m = bySymbol(rows);
  return BAR_META.map((meta) => {
    const arr = m.get(meta.symbol) ?? [];
    const yoy = commodityYoy(arr);
    return {
      label: meta.label,
      symbol: meta.symbol,
      yoyPct: yoy != null ? yoy * 100 : 0,
      color: meta.color,
    };
  }).sort((a, b) => b.yoyPct - a.yoyPct);
}

// ──────────────────────────────────────────────────────────────
// §4-A 원자재 시장 지표 요약 — 7행 표
// ──────────────────────────────────────────────────────────────

export interface MarketIndicatorRow {
  symbol: string;
  label: string;
  currentPrice: string;
  yoyDisplay: string;
  yoyColor: string;
  volatility: string;
  volatilityColor: string;
  flow: string;
  flowColor: string;
  factor: string;
}

const TABLE_META: Array<{ symbol: string; label: string; factor: string }> = [
  { symbol: "LIT", label: "리튬 (탄산)", factor: "" },
  { symbol: "NG=F", label: "천연가스", factor: "" },
  { symbol: "CL=F", label: "WTI 원유", factor: "" },
  { symbol: "SI=F", label: "은 (Silver)", factor: "" },
  { symbol: "GC=F", label: "금 (Gold)", factor: "" },
  { symbol: "HG=F", label: "구리 (LME)", factor: "" },
  { symbol: "ZS=F", label: "대두 (Soybean)", factor: "" },
  { symbol: "ZW=F", label: "소맥 (Wheat)", factor: "" },
];

function annualVolatility(arr: CommodityPrice[], windowN = 60): number | null {
  const asc = ascByDate(arr).slice(-windowN);
  const vals = asc.map((r) => r.close).filter((v): v is number => v != null);
  if (vals.length < 5) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean === 0) return null;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return Math.sqrt(variance) / mean;
}

export function marketIndicatorsTable(rows: CommodityPrice[]): MarketIndicatorRow[] {
  const m = bySymbol(rows);
  return TABLE_META.map((meta) => {
    const arr = m.get(meta.symbol) ?? [];
    const stat = symbolStat(rows, meta.symbol);
    const parts = (() => {
      if (stat.latest == null) return { value: "—", unit: "" };
      const disp = unitFor(meta.symbol);
      const conv = disp.multiplier ? stat.latest * disp.multiplier : stat.latest;
      const formatted =
        conv >= 1000
          ? conv.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : conv.toFixed(2);
      return { value: `$${formatted}`, unit: disp.unit };
    })();
    const yoy = stat.yoy;
    const yoyDisplay = yoy != null ? `${yoy > 0 ? "+" : ""}${(yoy * 100).toFixed(1)}%` : "—";
    const yoyColor = yoy != null && yoy > 0 ? "#43bb2e" : yoy != null && yoy < 0 ? "#c1121f" : "#737474";
    const vol = annualVolatility(arr);
    const volLabel =
      vol == null ? "—" : vol >= 0.10 ? "매우 높음" : vol >= 0.05 ? "높음" : vol >= 0.03 ? "중간" : "낮음";
    const volColor =
      vol == null ? "#737474" : vol >= 0.10 ? "#c1121f" : vol >= 0.05 ? "#fdb43a" : "#43bb2e";
    const flow = (() => {
      if (yoy == null) return "보합";
      if (yoy > 0.30) return "급등세";
      if (yoy > 0.10) return "상승";
      if (yoy > -0.05) return "안정";
      return "하락";
    })();
    const flowColor = yoy != null && yoy > 0.10 ? "#43bb2e" : yoy != null && yoy < -0.05 ? "#c1121f" : "#737474";
    return {
      symbol: meta.symbol,
      label: meta.label,
      currentPrice: parts.value + (parts.unit ? "/" + parts.unit : ""),
      yoyDisplay,
      yoyColor,
      volatility: volLabel,
      volatilityColor: volColor,
      flow,
      flowColor,
      factor: meta.factor,
    };
  });
}

function unitFor(symbol: string): { unit: string; multiplier?: number } {
  const dict: Record<string, { unit: string; multiplier?: number }> = {
    "CL=F": { unit: "bbl" },
    "NG=F": { unit: "MMBtu" },
    "HG=F": { unit: "T", multiplier: 2204.62 },
    LIT: { unit: "주" },
    "GC=F": { unit: "oz" },
    "SI=F": { unit: "oz" },
    "ZW=F": { unit: "bu" },
    "ZS=F": { unit: "bu" },
    "ZC=F": { unit: "bu" },
  };
  return dict[symbol] ?? { unit: "" };
}

// ──────────────────────────────────────────────────────────────
// §4-B 변동성-수익률 매트릭스 — scatter plot
// ──────────────────────────────────────────────────────────────

export interface ScatterPoint {
  label: string;
  symbol: string;
  x: number; // 시장 변동성 (%)
  y: number; // 연간 변동률 (%)
  color: string; // BAR_META 와 매칭 (symbol 별)
}

export function scatterData(rows: CommodityPrice[]): ScatterPoint[] {
  const m = bySymbol(rows);
  return BAR_META.map((meta) => {
    const arr = m.get(meta.symbol) ?? [];
    const vol = annualVolatility(arr, 60);
    const yoy = commodityYoy(arr);
    return {
      label: meta.label,
      symbol: meta.symbol,
      x: vol != null ? vol * 100 : 0,
      y: yoy != null ? yoy * 100 : 0,
      color: meta.color,
    };
  });
}

// ──────────────────────────────────────────────────────────────
// §5 카테고리별 가격 추이 — 3 multi-line chart (12개월)
// ──────────────────────────────────────────────────────────────

export interface SectorLinePoint {
  date: string;
  values: Record<string, number | null>; // symbol → close
}

export interface SectorChart {
  title: string;
  sub: string;
  series: Array<{ symbol: string; label: string; color: string; unit: string }>;
  points: SectorLinePoint[];
}

function monthlyHistory(rows: CommodityPrice[], months = 12): CommodityPrice[] {
  // 마지막 13개월에서 월별 1개씩 (월말 기준)
  const asc = ascByDate(rows);
  const byMonth = new Map<string, CommodityPrice>();
  for (const r of asc) {
    const key = r.date.slice(0, 7); // YYYY-MM
    byMonth.set(key, r); // 같은 월의 마지막 row 가 남음
  }
  const sortedKeys = [...byMonth.keys()].sort();
  return sortedKeys.slice(-months - 1).map((k) => byMonth.get(k)!);
}

function buildSectorChart(
  rows: CommodityPrice[],
  meta: SectorChart,
): SectorChart {
  // 각 series 의 월별 close 매핑
  const m = bySymbol(rows);
  const allKeys: string[] = [];
  const data: Record<string, Map<string, number | null>> = {};
  for (const s of meta.series) {
    const arr = m.get(s.symbol) ?? [];
    const monthly = monthlyHistory(arr, 12);
    const map = new Map<string, number | null>();
    for (const p of monthly) {
      map.set(p.date.slice(0, 7), p.close ?? null);
    }
    data[s.symbol] = map;
    for (const k of map.keys()) if (!allKeys.includes(k)) allKeys.push(k);
  }
  allKeys.sort();
  const last13 = allKeys.slice(-13);
  const points = last13.map((k) => ({
    date: k,
    values: Object.fromEntries(meta.series.map((s) => [s.symbol, data[s.symbol]?.get(k) ?? null])),
  }));
  return { ...meta, points };
}

export function sectorTrends(rows: CommodityPrice[]): SectorChart[] {
  return [
    buildSectorChart(rows, {
      title: "에너지 섹터 흐름",
      sub: "WTI 원유 및 천연가스 가격 월별 변동 추이",
      series: [
        { symbol: "CL=F", label: "WTI 원유 ($/bbl)", color: "#c1121f", unit: "/bbl" },
        { symbol: "NG=F", label: "천연가스 ($/MMBtu)", color: "#4a7aff", unit: "/MMBtu" },
      ],
      points: [],
    }),
    buildSectorChart(rows, {
      title: "산업금속 섹터 흐름",
      sub: "구리 및 리튬 가격 월별 변동 추이",
      series: [
        { symbol: "HG=F", label: "구리 (LME, $/T)", color: "#fdb43a", unit: "/T" },
        { symbol: "LIT", label: "리튬 (탄산, ¥/T)", color: "#43bb2e", unit: "/주" },
      ],
      points: [],
    }),
    buildSectorChart(rows, {
      title: "귀금속 섹터 흐름 (금 & 은)",
      sub: "금과 은의 월별 시세 변동 추이",
      series: [
        { symbol: "GC=F", label: "금 ($/oz)", color: "#e5af43", unit: "/oz" },
        { symbol: "SI=F", label: "은 ($/oz)", color: "#9a9a9a", unit: "/oz" },
      ],
      points: [],
    }),
  ];
}

// ──────────────────────────────────────────────────────────────
// §7-A 자산군 정규화 사이클 — Base=100 line chart (분기, 5년)
// ──────────────────────────────────────────────────────────────

export interface NormalizedCycleSeries {
  symbol: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: Array<{ date: string; index: number | null }>;
}

const NORM_META: Array<{ symbol: string; label: string; color: string; dashed?: boolean }> = [
  { symbol: "GC=F", label: "금", color: "#fdb43a" },
  { symbol: "CL=F", label: "WTI", color: "#c1121f" },
  { symbol: "HG=F", label: "구리", color: "#43bb2e" },
  { symbol: "ZW=F", label: "밀", color: "#f5c2e7", dashed: true },
];

function quarterlyHistory(rows: CommodityPrice[], quarters = 20): CommodityPrice[] {
  const asc = ascByDate(rows);
  const byQuarter = new Map<string, CommodityPrice>();
  for (const r of asc) {
    const m = parseInt(r.date.slice(5, 7), 10);
    const q = Math.min(4, Math.max(1, Math.ceil(m / 3)));
    const key = `${r.date.slice(0, 4)}-Q${q}`;
    byQuarter.set(key, r);
  }
  const sortedKeys = [...byQuarter.keys()].sort();
  return sortedKeys.slice(-quarters).map((k) => byQuarter.get(k)!);
}

export function normalizedCycleSeries(
  rows: CommodityPrice[],
): NormalizedCycleSeries[] {
  const m = bySymbol(rows);
  return NORM_META.map((meta) => {
    const arr = m.get(meta.symbol) ?? [];
    const qs = quarterlyHistory(arr, 20);
    if (qs.length === 0) {
      return { ...meta, points: [] };
    }
    const base = qs[0]?.close ?? null;
    const points = qs.map((p) => {
      const m2 = parseInt(p.date.slice(5, 7), 10);
      const q = Math.min(4, Math.max(1, Math.ceil(m2 / 3)));
      return {
        date: `'${p.date.slice(2, 4)}Q${q}`,
        index: base != null && p.close != null && base !== 0 ? (p.close / base) * 100 : null,
      };
    });
    return { ...meta, points };
  });
}

// ──────────────────────────────────────────────────────────────
// §7-B 에너지 WTI vs 천연가스 — dual-axis line
// ──────────────────────────────────────────────────────────────

export interface DualAxisPoint {
  date: string;
  wti: number | null;
  ng: number | null;
}

export function wtiNgSeries(rows: CommodityPrice[]): DualAxisPoint[] {
  const m = bySymbol(rows);
  const wti = m.get("CL=F") ?? [];
  const ng = m.get("NG=F") ?? [];
  const wtiQ = quarterlyHistory(wti, 20);
  const ngQ = quarterlyHistory(ng, 20);
  const wtiMap = new Map<string, number>();
  for (const r of wtiQ) {
    const m2 = parseInt(r.date.slice(5, 7), 10);
    const q = Math.min(4, Math.max(1, Math.ceil(m2 / 3)));
    wtiMap.set(`${r.date.slice(0, 4)}-Q${q}`, r.close);
  }
  const ngMap = new Map<string, number>();
  for (const r of ngQ) {
    const m2 = parseInt(r.date.slice(5, 7), 10);
    const q = Math.min(4, Math.max(1, Math.ceil(m2 / 3)));
    ngMap.set(`${r.date.slice(0, 4)}-Q${q}`, r.close);
  }
  const allKeys: string[] = [];
  for (const k of wtiMap.keys()) if (!allKeys.includes(k)) allKeys.push(k);
  for (const k of ngMap.keys()) if (!allKeys.includes(k)) allKeys.push(k);
  allKeys.sort();
  return allKeys.map((k) => {
    const yr = k.slice(2, 4);
    const q = k.slice(-2);
    return {
      date: `'${yr}${q}`,
      wti: wtiMap.get(k) ?? null,
      ng: ngMap.get(k) ?? null,
    };
  });
}
