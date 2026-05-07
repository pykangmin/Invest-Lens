import type { CompanySnapshot } from "../types/investment";
import type { AnalysisEvent } from "../types/scoring";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

function fmtTime(date: string): string {
  const d = new Date(date);
  const wd = WEEKDAYS_KR[d.getUTCDay()];
  return `${wd} 09:30 ET`;
}

export function buildEvents(snapshot: CompanySnapshot): AnalysisEvent[] {
  const events: AnalysisEvent[] = [];
  const ticker = snapshot.company.ticker;

  // (a) 분기 보고일 — 펀더 갱신
  for (const f of snapshot.fundamentalsHistory.slice(0, 4)) {
    events.push({
      date: f.date,
      kind: "earnings",
      title: `${ticker} 분기 펀더멘탈 갱신`,
      detail:
        f.per !== null && f.roe !== null
          ? `PER ${f.per.toFixed(1)} · ROE ${(f.roe * 100).toFixed(1)}%`
          : "지표 일부 결측",
      severity: "INFO",
      category: "실적",
      time: fmtTime(f.date),
    });
  }

  // (b) RSI 임계 돌파
  const tech = snapshot.technicalHistory;
  for (let i = 0; i < tech.length - 1; i++) {
    const cur = tech[i];
    const prev = tech[i + 1];
    if (cur.rsi14 === null || prev.rsi14 === null) continue;
    if (cur.rsi14 >= 70 && prev.rsi14 < 70) {
      events.push({
        date: cur.date,
        kind: "macd_cross",
        title: `${ticker} RSI 70 돌파`,
        detail: `RSI ${cur.rsi14.toFixed(1)} · 과매수 경계`,
        severity: "WARNING",
        category: "기술 신호",
        time: fmtTime(cur.date),
      });
    } else if (cur.rsi14 <= 30 && prev.rsi14 > 30) {
      events.push({
        date: cur.date,
        kind: "macd_cross",
        title: `${ticker} RSI 30 이탈`,
        detail: `RSI ${cur.rsi14.toFixed(1)} · 과매도`,
        severity: "CAUTION",
        category: "기술 신호",
        time: fmtTime(cur.date),
      });
    }
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  void MONTHS; // 향후 EventList 가 사용
  return events.slice(0, 6);
}
