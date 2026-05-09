// commodity-extras.ts — 원자재 detail 화면 전용 분석 보강.
// commodityImpactGauge 와 별개로 detail 화면에 필요한 통계량 산출.

import type { CommodityPrice } from "../types/investment";

export interface CommodityStat {
  symbol: string;
  category: string | null;
  name?: string;
  latest: number | null;
  pctYoY: number | null;        // 60~252일 변동률 (%)
  volatility: number | null;    // 일간 수익률 std × 100 (%)
  series: Array<number | null>; // sanitize 된 close 시계열 (오래된 → 최신)
}

// 한 symbol 의 통계량 산출.
export function symbolStat(history: CommodityPrice[], symbol: string): CommodityStat | null {
  const filtered = history.filter((h) => h.symbol === symbol);
  if (filtered.length === 0) return null;
  // history 는 desc — reverse 하여 ASC.
  const asc = [...filtered].reverse();
  const closes = asc.map((p) => p.close);
  const latest = closes[closes.length - 1] ?? null;
  const first = closes[0] ?? null;
  const pctYoY = latest != null && first != null && first !== 0
    ? ((latest - first) / first) * 100
    : null;

  // 일간 log return → std
  let volatility: number | null = null;
  if (closes.length >= 5) {
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const a = closes[i - 1];
      const b = closes[i];
      if (a > 0 && b > 0) rets.push(Math.log(b / a));
    }
    if (rets.length > 0) {
      const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
      const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length;
      volatility = Math.sqrt(variance) * 100;
    }
  }

  return {
    symbol,
    category: filtered[0]?.category ?? null,
    latest,
    pctYoY,
    volatility,
    series: closes,
  };
}

// 모든 symbol 의 통계량 일괄.
export function allSymbolStats(history: CommodityPrice[]): CommodityStat[] {
  const symbols = Array.from(new Set(history.map((h) => h.symbol)));
  const out: CommodityStat[] = [];
  for (const s of symbols) {
    const stat = symbolStat(history, s);
    if (stat) out.push(stat);
  }
  return out;
}

// 카테고리별 정규화 (base = 100, 첫 날짜).
// 같은 카테고리 symbol 의 평균 시계열을 base=100 으로 정규화.
export interface NormalizedSeries {
  category: string;
  values: Array<number | null>;
  dates: string[];
}

export function categoryNormalized(
  history: CommodityPrice[],
  baseValue = 100,
): NormalizedSeries[] {
  const byCategory = new Map<string, CommodityPrice[]>();
  for (const h of history) {
    if (!h.category) continue;
    const arr = byCategory.get(h.category) ?? [];
    arr.push(h);
    byCategory.set(h.category, arr);
  }

  const result: NormalizedSeries[] = [];
  for (const [category, rows] of byCategory) {
    // 날짜별 평균 close
    const byDate = new Map<string, number[]>();
    for (const r of rows) {
      const arr = byDate.get(r.date) ?? [];
      arr.push(r.close);
      byDate.set(r.date, arr);
    }
    const sortedDates = [...byDate.keys()].sort(); // ASC
    const avgs = sortedDates.map((d) => {
      const arr = byDate.get(d)!;
      return arr.reduce((s, v) => s + v, 0) / arr.length;
    });
    const first = avgs[0];
    if (!first || first === 0) continue;
    const values = avgs.map((v) => (v / first) * baseValue);
    result.push({ category, values, dates: sortedDates });
  }
  return result;
}

// 종목 ↔ 원자재 가격 상관계수 (Pearson r).
// 일간 log return 기준. 같은 날짜끼리 페어링 후 r 계산.
// 결과: Map<symbol, r> — r 의 절대값이 클수록 영향 강함, 부호는 방향.
//
// 사용처: commodityImpactGauge 의 종목별 차별화 (sector 만으로는 IT 전체가
// 동일 점수가 되는 문제 해결).
export function stockCommodityCorrelations(
  stockHistory: Array<{ date: string; close: number | null }>,
  commodityHistory: CommodityPrice[],
  symbols: string[],
  minPairs = 10,
): Map<string, number> {
  // 1) 종목 일간 return
  const stockClose = new Map<string, number>();
  for (const s of stockHistory) {
    if (s.close != null && s.close > 0) stockClose.set(s.date, s.close);
  }
  const stockDates = [...stockClose.keys()].sort(); // ASC
  const stockReturns = new Map<string, number>();
  for (let i = 1; i < stockDates.length; i++) {
    const a = stockClose.get(stockDates[i - 1])!;
    const b = stockClose.get(stockDates[i])!;
    if (a > 0 && b > 0) stockReturns.set(stockDates[i], Math.log(b / a));
  }

  const result = new Map<string, number>();
  for (const sym of symbols) {
    const cmd = commodityHistory.filter((c) => c.symbol === sym);
    if (cmd.length < 5) continue;
    const cmdClose = new Map<string, number>();
    for (const c of cmd) if (c.close > 0) cmdClose.set(c.date, c.close);
    const cmdDates = [...cmdClose.keys()].sort();
    const cmdReturns = new Map<string, number>();
    for (let i = 1; i < cmdDates.length; i++) {
      const a = cmdClose.get(cmdDates[i - 1])!;
      const b = cmdClose.get(cmdDates[i])!;
      if (a > 0 && b > 0) cmdReturns.set(cmdDates[i], Math.log(b / a));
    }

    // 같은 날짜끼리 페어
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [date, sr] of stockReturns) {
      const cr = cmdReturns.get(date);
      if (cr !== undefined) {
        xs.push(sr);
        ys.push(cr);
      }
    }
    if (xs.length < minPairs) continue;

    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0;
    let sx2 = 0;
    let sy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      sxy += dx * dy;
      sx2 += dx * dx;
      sy2 += dy * dy;
    }
    const denom = Math.sqrt(sx2 * sy2);
    if (denom > 0) {
      const r = sxy / denom;
      // -1..1 범위 보정 (수치 오차 클램프)
      result.set(sym, Math.max(-1, Math.min(1, r)));
    }
  }
  return result;
}

// 두 symbol 의 가격 비율 시계열 (예: WTI / NG).
// 동일 날짜에만 계산 가능 — 한 쪽 결측 시 null.
export function ratioSeries(
  history: CommodityPrice[],
  numeratorSymbol: string,
  denominatorSymbol: string,
): { dates: string[]; values: Array<number | null> } {
  const num = new Map<string, number>();
  const den = new Map<string, number>();
  for (const h of history) {
    if (h.symbol === numeratorSymbol) num.set(h.date, h.close);
    else if (h.symbol === denominatorSymbol) den.set(h.date, h.close);
  }
  const dates = [...new Set([...num.keys(), ...den.keys()])].sort();
  const values = dates.map((d) => {
    const a = num.get(d);
    const b = den.get(d);
    if (a == null || b == null || b === 0) return null;
    return a / b;
  });
  return { dates, values };
}
