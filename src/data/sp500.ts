// S&P 500 종목별 핵심 요약 데이터.
// 원본 sp500.json 은 한글 키 (키워드 태그, 동종 업계 등) 사용 — 로드 시 영문 키로 정규화.

import sp500Raw from "./sp500.json";

interface RawEntry {
  ticker: string;
  name: string;
  description: string;
  "키워드 태그": {
    "섹터": string;
    "테마 및 키워드": string[];
    "기업 규모 및 시장 지위": string[];
  };
  "동종 업계": string[];
  "공식 홈페이지 링크": string;
  "다음 실적 발표일": string;
}

export interface Sp500Keywords {
  sector: string;             // "정보 기술 (Information Technology)"
  themes: string[];           // ["#AI", "#클라우드", ...]
  marketStatus: string[];     // ["#메가캡", "#대형주", ...]
}

export interface Sp500Entry {
  ticker: string;
  name: string;
  description: string;
  keywords: Sp500Keywords;
  peers: string[];            // 한글 회사명 5개
  homepageUrl: string;        // "https://www.microsoft.com"
  nextEarningsDate: string;   // "2026-07-28 (예상)"
}

function normalize(raw: RawEntry): Sp500Entry {
  return {
    ticker: raw.ticker,
    name: raw.name,
    description: raw.description,
    keywords: {
      sector: raw["키워드 태그"].섹터,
      themes: raw["키워드 태그"]["테마 및 키워드"] ?? [],
      marketStatus: raw["키워드 태그"]["기업 규모 및 시장 지위"] ?? [],
    },
    peers: raw["동종 업계"] ?? [],
    homepageUrl: raw["공식 홈페이지 링크"] ?? "",
    nextEarningsDate: raw["다음 실적 발표일"] ?? "",
  };
}

const SP500_LIST: Sp500Entry[] = (sp500Raw as RawEntry[]).map(normalize);

const SP500_MAP: Map<string, Sp500Entry> = new Map(
  SP500_LIST.map((e) => [e.ticker.toUpperCase(), e]),
);

export function findSp500Entry(ticker: string): Sp500Entry | null {
  return SP500_MAP.get(ticker.toUpperCase()) ?? null;
}

export function getSp500Description(ticker: string): string | null {
  return findSp500Entry(ticker)?.description ?? null;
}

// "정보 기술 (Information Technology)" → "정보 기술" (괄호 영문명 제거)
export function shortSector(sector: string): string {
  const m = sector.match(/^([^(]+)/);
  return (m ? m[1] : sector).trim();
}

// "2026-07-28 (예상)" → { date: "2026-07-28", display: "2026년 7월 28일", dDay: number | null }
export function parseEarningsDate(raw: string, today: Date = new Date()): {
  date: string;
  display: string;
  dDay: number | null;
} {
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { date: "", display: raw, dDay: null };
  const [, y, mo, d] = m;
  const display = `${y}년 ${parseInt(mo, 10)}월 ${parseInt(d, 10)}일`;
  const target = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  const ms = target.getTime() - today.getTime();
  const dDay = Math.round(ms / (1000 * 60 * 60 * 24));
  return { date: `${y}-${mo}-${d}`, display, dDay };
}
