// S&P 500 종목별 1~2 줄 회사 설명. 사용자가 후속 보완 예정.
// 메인 차트 placeholder 영역(StockDashboard ChartPanel 기본 상태) 에서
// ticker → description 룩업 용도로 사용.

import sp500Raw from "./sp500.json";

export interface Sp500Entry {
  ticker: string;
  name: string;
  description: string;
}

const SP500_LIST = sp500Raw as Sp500Entry[];

const SP500_MAP: Map<string, Sp500Entry> = new Map(
  SP500_LIST.map((e) => [e.ticker.toUpperCase(), e]),
);

export function findSp500Entry(ticker: string): Sp500Entry | null {
  return SP500_MAP.get(ticker.toUpperCase()) ?? null;
}

export function getSp500Description(ticker: string): string | null {
  return findSp500Entry(ticker)?.description ?? null;
}
