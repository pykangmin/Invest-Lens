import type {
  CommodityPrice,
  CompanySnapshot,
  GlobalEnvironmentPoint,
  MacroRegimeScore,
} from "../types/investment";
import type { AnalysisResult, GaugeScore } from "../types/scoring";
import { commodityImpactGauge } from "./commodityImpact";
import { buildEvents } from "./events";
import { fundamentalGauge } from "./fundamental";
import { macroGauge } from "./macro";
import { technicalGauge } from "./technical";

export interface AnalyzeInput {
  snapshot: CompanySnapshot;
  macroRegime: MacroRegimeScore | null;
  vix: GlobalEnvironmentPoint | null;
  commodities: CommodityPrice[];
}

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function macroEnvComposite(
  macro: GaugeScore,
  commodity: GaugeScore,
  technical: GaugeScore,
): number | null {
  return avg([macro.score, commodity.score, technical.score]);
}

// v3 매핑: G1 펀더 / G2 원자재 영향 / G3 거시 / G4 기술 (4종)
// composite-trio 는 시점 비교: 오늘 펀더 / 이번 달 종합 / 오늘 거시·기술 종합
export function analyze(input: AnalyzeInput): AnalysisResult {
  const fundamental = fundamentalGauge(input.snapshot.latestFundamentals);
  // commodity — sector 가중치 표 기반 (같은 sector 종목은 동일 점수).
  const commodity = commodityImpactGauge(
    input.snapshot.company,
    input.commodities,
  );
  const macro = macroGauge(input.macroRegime);
  const technical = technicalGauge(input.snapshot.latestTechnical, input.vix);

  return {
    gauges: {
      fundamental,
      commodity,
      macro,
      technical,
      sentiment: technical, // legacy 호환 — 본 v3 화면은 sentiment 별도 카드 없음
    },
    composite: {
      fundamental: fundamental.score,
      technical: technical.score,
      macroEnvironment: macroEnvComposite(macro, commodity, technical),
    },
    events: buildEvents(input.snapshot),
    insights: [],
  };
}

export type { AnalysisResult, GaugeScore } from "../types/scoring";
