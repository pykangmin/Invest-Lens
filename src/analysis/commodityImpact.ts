import type { CommodityPrice, CompanyMaster } from "../types/investment";
import type { GaugeScore } from "../types/scoring";

// G2 — 원자재 영향.
// 종목의 sector 에 따라 원자재 가격 추세가 종목에 미치는 영향을 점수화.
// first cut: 60일 추세 (close 첫 vs 마지막).
// sector 별 weight 표 (positive = 가격 상승이 종목에 호재):
const SECTOR_WEIGHTS: Record<string, Record<string, number>> = {
  Energy: { "CL=F": +1.0, "NG=F": +0.5, "GC=F": 0.0, "HG=F": 0.0 },
  Materials: { "HG=F": +1.0, "GC=F": +0.3, "CL=F": +0.2, "NG=F": 0.0 },
  Utilities: { "NG=F": -0.5, "CL=F": -0.5, "GC=F": 0.0, "HG=F": 0.0 },
  "Information Technology": { "GC=F": +0.2, "CL=F": -0.2, "HG=F": +0.2, "NG=F": 0.0 },
  "Consumer Discretionary": { "CL=F": -0.5, "GC=F": 0.0, "HG=F": 0.0, "NG=F": 0.0 },
  "Consumer Staples": { "CL=F": -0.3, "GC=F": +0.2, "HG=F": 0.0, "NG=F": 0.0 },
  Industrials: { "HG=F": +0.5, "CL=F": -0.3, "GC=F": 0.0, "NG=F": 0.0 },
  Financials: { "GC=F": -0.3, "CL=F": 0.0, "HG=F": +0.2, "NG=F": 0.0 },
  "Health Care": { "GC=F": +0.1, "CL=F": -0.2, "HG=F": 0.0, "NG=F": 0.0 },
  "Communication Services": { "CL=F": -0.2, "GC=F": 0.0, "HG=F": 0.0, "NG=F": 0.0 },
  "Real Estate": { "GC=F": +0.3, "CL=F": -0.2, "HG=F": 0.0, "NG=F": 0.0 },
};

function trendPct(history: CommodityPrice[]): number | null {
  if (history.length < 2) return null;
  const last = history[0]?.close;
  const first = history[history.length - 1]?.close;
  if (!last || !first || first === 0) return null;
  return ((last - first) / first) * 100;
}

export function commodityImpactGauge(
  company: CompanyMaster,
  history: CommodityPrice[],
): GaugeScore {
  const sector = company.sector ?? "Information Technology";
  const weights = SECTOR_WEIGHTS[sector] ?? SECTOR_WEIGHTS["Information Technology"]!;
  let weighted = 0;
  let n = 0;
  for (const [symbol, w] of Object.entries(weights)) {
    if (w === 0) continue;
    const series = history.filter((c) => c.symbol === symbol);
    const pct = trendPct(series);
    if (pct === null) continue;
    weighted += w * pct;
    n++;
  }
  if (n === 0) {
    return {
      id: "commodity",
      label: "DATA",
      tagline: "원자재 데이터 없음",
      score: null,
      severity: "CAUTION",
      available: false,
    };
  }
  const score = Math.max(0, Math.min(100, 50 + weighted * 2));
  const severity = score >= 60 ? "INFO" : score >= 30 ? "CAUTION" : "WARNING";
  const label = score >= 60 ? "POSITIVE" : score >= 30 ? "MIXED" : "NEGATIVE";
  return {
    id: "commodity",
    label,
    tagline: `${sector} sector`,
    score: Math.round(score),
    severity,
    available: true,
  };
}
