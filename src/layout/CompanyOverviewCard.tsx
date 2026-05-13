// CompanyOverviewCard — 개별 주식 화면 핵심 요약.
// Figma 시안 (docs/figma/dashboard-slots-v4.md) 의 핵심 요약 카드 spec + 대시보드 light 톤.
//
// 데이터: src/data/sp500.json (정규화는 sp500.ts 의 findSp500Entry).
// 구현 보류 (데이터 부재 → 표시 생략, 추후 점검) :
//   - 로고 자산
//   - 거래소 (NASDAQ / NYSE)
//   - IR 링크
//   - 회계분기 (Q4 FY2025)

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  findSp500Entry,
  parseEarningsDate,
  shortSector,
  type Sp500Entry,
} from "../data/sp500";
import { loadPeers } from "../data-loader/investmentData";
import type { PeerCompany } from "../types/investment";
import { TruncatedText } from "../shared/TruncatedText";

const C = {
  navy: "#003049",
  textBody: "#4e4e4e",
  textMuted: "#7f7f7f",
  textFaint: "#a3a3a3",
  cardBg: "#ffffff",
  innerBg: "#fafbfc",
  border: "#e9e9e9",
  info: "#4073ff",
  warn: "#e5af43",
} as const;

const FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const overviewPeersCache = new Map<string, PeerCompany[]>();

export interface CompanyOverviewCardProps {
  ticker: string;
  companyName?: string;
  onSelectTicker?: (ticker: string) => void;
}

export function CompanyOverviewCard({ ticker, companyName, onSelectTicker }: CompanyOverviewCardProps) {
  const entry = findSp500Entry(ticker);
  if (!entry) {
    return (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        color: C.textMuted,
        fontSize: 13,
      }}>
        {companyName ?? ticker} — 핵심 요약 데이터가 등록되지 않은 종목입니다.
      </div>
    );
  }
  return <CompanyOverviewContent entry={entry} ticker={ticker} onSelectTicker={onSelectTicker} />;
}

function CompanyOverviewContent({
  entry,
  ticker,
  onSelectTicker,
}: {
  entry: Sp500Entry;
  ticker: string;
  onSelectTicker?: (ticker: string) => void;
}) {
  // 동종 업계 — /api/peers (B-2: sub_industry 우선, sector fallback, 자기 제외). 비동기 로드.
  const cacheKey = ticker.toUpperCase();
  const [peers, setPeers] = useState<PeerCompany[] | null>(() => overviewPeersCache.get(cacheKey) ?? null);
  useEffect(() => {
    let alive = true;
    const cachedPeers = overviewPeersCache.get(cacheKey) ?? null;
    setPeers(cachedPeers);
    if (cachedPeers) return () => { alive = false; };

    loadPeers(ticker, 5)
      .then((r) => {
        overviewPeersCache.set(cacheKey, r.peers);
        if (alive) setPeers(r.peers);
      })
      .catch(() => { if (alive) setPeers([]); });
    return () => { alive = false; };
  }, [cacheKey, ticker]);

  // 키워드 = 테마 + 시장 지위 모두 합쳐 # 제거. 앞 2개 강조.
  const chipLabels: string[] = [
    ...entry.keywords.themes.map(stripHash),
    ...entry.keywords.marketStatus.map(stripHash),
  ];
  const chips = chipLabels.map((label, i) => ({ label, emphasis: i < 2 }));

  const earnings = parseEarningsDate(entry.nextEarningsDate);

  const root: CSSProperties = {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    fontFamily: FONT,
    color: C.navy,
    padding: "20px 28px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",  // 세로 중앙 정렬
    gap: 14,
  };
  return (
    <div style={root}>
      {/* 헤더 — 회사명 + 메타. 로고/거래소 생략. */}
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{entry.name}</div>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          {entry.ticker} · {shortSector(entry.keywords.sector)}
        </div>
      </header>

      <Section title="핵심 요약">
        <div style={{
          background: C.innerBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: 13,
          lineHeight: 1.6,
          color: C.textBody,
        }}>
          {entry.description}
        </div>
      </Section>

      <Section title="키워드 태그">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chips.map((c) => <Chip key={c.label} label={c.label} emphasis={c.emphasis} />)}
        </div>
      </Section>

      <Divider />

      <Section title="동종 업계">
        {/* /api/peers — sub_industry top (sector fallback), 자기 제외 5종목.
            keyword 태그처럼 flex-wrap — 폭이 좁아지면 자연스럽게 줄바꿈. */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}>
          {peers == null && Array.from({ length: 5 }).map((_, i) => <PeerSkeleton key={i} />)}
          {peers != null && peers.length === 0 && (
            <div style={{
              width: "100%",
              textAlign: "center",
              color: C.textFaint,
              fontSize: 12,
              padding: "10px 0",
            }}>
              동종 업계 데이터를 불러오지 못했습니다.
            </div>
          )}
          {peers != null && peers.slice(0, 5).map((p) => (
            <PeerCard
              key={p.ticker}
              ticker={p.ticker}
              name={p.name}
              onClick={onSelectTicker ? () => onSelectTicker(p.ticker) : undefined}
            />
          ))}
        </div>
      </Section>

      <Divider />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InfoBox icon="🌐" title="공식 홈페이지">
          {entry.homepageUrl ? (
            <a href={entry.homepageUrl} target="_blank" rel="noreferrer noopener"
               style={{
                 color: C.info,
                 fontSize: 14,
                 fontWeight: 600,
                 display: "inline-flex",
                 alignItems: "center",
                 gap: 4,
               }}>
              {homepageDisplay(entry.homepageUrl)}
              <span style={{ fontSize: 11 }}>↗</span>
            </a>
          ) : <span style={{ color: C.textFaint, fontSize: 13 }}>—</span>}
        </InfoBox>
        <InfoBox icon="📅" title="다음 실적 발표일">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{earnings.display}</div>
          {earnings.dDay != null && (
            <div style={{ marginTop: 6 }}>
              <span style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 10,
                background: "#fff4dc",
                color: C.warn,
                fontSize: 11,
                fontWeight: 700,
              }}>
                D{earnings.dDay >= 0 ? `-${earnings.dDay}` : `+${-earnings.dDay}`}
              </span>
            </div>
          )}
        </InfoBox>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Atoms
// ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.navy }}>{title}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border }} />;
}

function Chip({ label, emphasis }: { label: string; emphasis?: boolean }) {
  const base: CSSProperties = {
    padding: "5px 12px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    border: `1px solid ${C.border}`,
  };
  return (
    <span style={emphasis
      ? { ...base, background: C.navy, color: "#fff", borderColor: C.navy }
      : { ...base, background: C.innerBg, color: C.navy }}>
      {label}
    </span>
  );
}

function PeerCard({
  ticker,
  name,
  onClick,
}: {
  ticker: string;
  name: string;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      style={{
        // 키워드 태그와 동일하게 wrap — basis 20% 로 5장이 1행, 좁아지면 minWidth 에서 줄바꿈.
        flex: "1 1 calc((100% - 40px) / 5)",
        minWidth: 80,
        background: C.innerBg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 8px",
        textAlign: "center",
        fontFamily: FONT,
        cursor: interactive ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={interactive ? (e) => {
        e.currentTarget.style.borderColor = C.navy;
        e.currentTarget.style.transform = "translateY(-1px)";
      } : undefined}
      onMouseLeave={interactive ? (e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = "translateY(0)";
      } : undefined}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{ticker}</div>
      <TruncatedText style={{
        fontSize: 11,
        color: C.textMuted,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        display: "block",
      }}>{name}</TruncatedText>
    </button>
  );
}

function PeerSkeleton() {
  return (
    <div style={{
      flex: "1 1 calc((100% - 40px) / 5)",
      minWidth: 80,
      background: C.innerBg,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "10px 8px",
      height: 52,
    }} />
  );
}

function InfoBox({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div style={{
      background: C.innerBg,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{
        fontSize: 12,
        color: C.textMuted,
        marginBottom: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function stripHash(s: string): string {
  return s.startsWith("#") ? s.slice(1) : s;
}

function homepageDisplay(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
