// 시계열 점수 산출 — 5단 composite-trio 의 추이 그래프와 delta 의 입력.
// 각 게이지(펀더·기술·거시)의 일별 점수를 carry forward 로 보간한 후 종합.

import type {
  CommodityPrice,
  CompanyMaster,
  CompanySnapshot,
  GlobalEnvironmentPoint,
  MacroRegimeScore,
  StockFundamentals,
  StockPriceTech,
} from "../types/investment";
import { commodityImpactGauge } from "./commodityImpact";
import { fundamentalGauge } from "./fundamental";
import { macroGauge } from "./macro";
import { technicalGauge } from "./technical";

export interface DailyComposite {
  date: string;          // YYYY-MM-DD
  fundamental: number | null;
  commodity: number | null;
  macro: number | null;
  technical: number | null;
}

// 입력 history 들이 모두 desc(최신 [0]) 라고 가정.
// 결과도 desc 정렬로 반환.
export function buildDailyComposite(input: {
  snapshot: CompanySnapshot;
  vixHistory: GlobalEnvironmentPoint[];
  macroHistory: MacroRegimeScore[];
  commodityHistory: CommodityPrice[];
  days?: number;             // 기본 30
}): DailyComposite[] {
  const days = input.days ?? 30;
  const tech = input.snapshot.technicalHistory;
  if (tech.length === 0) return [];

  // 영업일 기준점은 stock_price_tech 의 일자.
  const dates = tech.slice(0, days).map((t) => t.date);
  const result: DailyComposite[] = [];

  // 분기별 fundamentals — date 가 그 시점 이전인 가장 가까운 행.
  const findFundsAt = (d: string): StockFundamentals | null => {
    for (const f of input.snapshot.fundamentalsHistory) {
      if (f.date <= d) return f;
    }
    return null;
  };

  // 월별 macro — date 가 그 시점 이전인 가장 가까운 행.
  const findMacroAt = (d: string): MacroRegimeScore | null => {
    for (const m of input.macroHistory) {
      if (m.date <= d) return m;
    }
    return null;
  };

  // 일별 vix
  const findVixAt = (d: string): GlobalEnvironmentPoint | null => {
    for (const v of input.vixHistory) {
      if (v.date <= d) return v;
    }
    return null;
  };

  // commodity 시점별 슬라이스 — 시점 d 이전 60일치.
  const sliceCommodityAt = (d: string): CommodityPrice[] => {
    return input.commodityHistory.filter((c) => c.date <= d).slice(0, 60);
  };

  for (const date of dates) {
    const t = tech.find((x) => x.date === date) ?? null;
    const f = findFundsAt(date);
    const m = findMacroAt(date);
    const v = findVixAt(date);
    const cs = sliceCommodityAt(date);

    const fG = fundamentalGauge(f);
    const tG = technicalGauge(t, v);
    const mG = macroGauge(m);
    const cG = commodityImpactGauge(input.snapshot.company, cs);

    result.push({
      date,
      fundamental: fG.score,
      commodity: cG.score,
      macro: mG.score,
      technical: tG.score,
    });
  }
  return result; // desc — 최신이 [0]
}

export interface CompositePoint {
  date: string;
  score: number | null;
}

// 시점별 종합 series — 모두 같은 정의 (4 게이지 평균),
// 다른 점은 series 의 길이(시간 창):
//   today: 직전 7 영업일 (단기 추이)
//   month: 직전 30 영업일
//   year:  YTD (올해 영업일) 또는 252 영업일
export function overallSeries(daily: DailyComposite[]): CompositePoint[] {
  return daily.map((d) => {
    const parts = [d.fundamental, d.commodity, d.macro, d.technical].filter(
      (x): x is number => x !== null,
    );
    return {
      date: d.date,
      score: parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0) / parts.length,
    };
  });
}

// series 의 평균 점수 (단일 값).
export function averageScore(series: CompositePoint[]): number | null {
  const nums = series
    .map((p) => p.score)
    .filter((x): x is number => x !== null && Number.isFinite(x));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export interface SeriesDelta {
  text: string;
  positive: boolean | null;
  comparison?: string;
}

function formatDelta(diff: number, pct: number, comparison: string): SeriesDelta {
  return {
    text: `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`,
    positive: diff >= 0,
    comparison,
  };
}

// 어제→오늘 (시리즈 [0] vs [1]).
export function deltaFromSeries(series: CompositePoint[]): SeriesDelta | undefined {
  if (series.length < 2) return undefined;
  const cur = series[0]?.score ?? null;
  const prev = series[1]?.score ?? null;
  if (cur === null || prev === null) return undefined;
  const diff = cur - prev;
  const pct = prev === 0 ? 0 : (diff / prev) * 100;
  return formatDelta(diff, pct, "전일 대비");
}

// 시간 창의 시작점 (가장 오래된) vs 끝점 (가장 최신) 차이.
// 사용처: "이번 달 종합" — 30일 시작 vs 오늘 / "올해 종합" — YTD 시작 vs 오늘.
export function windowDelta(
  series: CompositePoint[],
  comparison: string,
): SeriesDelta | undefined {
  if (series.length < 2) return undefined;
  // series 는 desc — 최신 [0], 오래된 [last].
  const cur = series[0]?.score ?? null;
  const start = series[series.length - 1]?.score ?? null;
  if (cur === null || start === null) return undefined;
  const diff = cur - start;
  const pct = start === 0 ? 0 : (diff / start) * 100;
  return formatDelta(diff, pct, comparison);
}

// 종합 history 를 sparkline 입력 형식 (number | null []) 으로 — 이전 값으로 carry forward.
export function toSparkline(series: CompositePoint[]): Array<number | null> {
  return series.map((p) => p.score);
}

void (null as unknown as CompanyMaster);
void (null as unknown as StockPriceTech);
