import type { CompanySnapshot } from "../types/investment";
import type { AnalysisEvent } from "../types/scoring";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

function fmtTime(date: string): string {
  const d = new Date(date);
  const wd = WEEKDAYS_KR[d.getUTCDay()];
  return `${wd} 09:30 ET`;
}

export function buildEvents(snapshot: CompanySnapshot, limit = 6): AnalysisEvent[] {
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

  // (c) Super Trend 추세 전환 — 2026-05 DB 보강. supertrendDays 가 작으면 "최근 전환".
  const sig = snapshot.latestSignals;
  if (sig?.supertrendSignal && sig.supertrendDays != null) {
    const days = sig.supertrendDays;
    if (days >= 0 && days <= 5) {
      const isBuy = sig.supertrendSignal === "Buy";
      events.push({
        date: sig.date,
        kind: "supertrend_flip",
        title: `${ticker} Super Trend → ${sig.supertrendSignal}`,
        detail: isBuy
          ? `상승 추세 전환 ${days}일째${sig.supertrendValue != null ? ` · 기준 ${sig.supertrendValue.toFixed(2)}` : ""}`
          : `하락 추세 전환 ${days}일째${sig.supertrendValue != null ? ` · 기준 ${sig.supertrendValue.toFixed(2)}` : ""}`,
        severity: isBuy ? "INFO" : "WARNING",
        category: "기술 신호",
        time: fmtTime(sig.date),
      });
    }
  }

  // (d) MACD cross — macd 와 signal line 비교. 직값만 있으므로 부호만 안내.
  if (sig?.macdSignal != null) {
    const latestMacd = snapshot.latestTechnical?.macd ?? null;
    if (latestMacd != null) {
      const diff = latestMacd - sig.macdSignal;
      const isAbove = diff > 0;
      // 차이가 작으면 cross 임박 / 큰 양수면 강세 / 큰 음수면 약세
      if (Math.abs(diff) < 0.5) {
        events.push({
          date: sig.date,
          kind: "macd_cross",
          title: `${ticker} MACD signal선 근접`,
          detail: `MACD ${latestMacd.toFixed(2)} vs signal ${sig.macdSignal.toFixed(2)} (${isAbove ? "위" : "아래"})`,
          severity: "CAUTION",
          category: "기술 신호",
          time: fmtTime(sig.date),
        });
      }
    }
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  void MONTHS; // 향후 EventList 가 사용
  return events.slice(0, limit);
}
