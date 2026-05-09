// Landing — 진입화면.
// spec: docs/figma/dashboard-slots-v4.md §2 (Figma node 219:2558)
// 모든 슬롯 REAL — ExampleBadge 부착 없음. 검색 자동완성은 /api/companies.
//
// 와이어프레임 핵심:
//   - 배경: #003049 솔리드 + landing-bg.png opacity 0.15 오버레이
//   - 헤드라인 "투자의 시각, / 데이터로 (투명) 하게" — "투명" 은 stroke-only ghost text (워드플레이)
//   - 부제: 사용자 지정 신규 문구
//   - 검색 pill (radius 60) + 좌측 돋보기 + 우측 go-icon
//   - 인기 검색어 7개 (AAPL · MSFT · GOOGL · AMZN · NVDA · TSLA · META)

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { searchCompanies } from "../data-loader/investmentData";
import type { CompanyMaster } from "../types/investment";

const POPULAR_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"];

const SUBTITLE =
  "기업의 펀더멘탈과 기술적 지표는 물론, 시장 국면과 원자재의 흐름까지 결합한 입체적 리스크 시그널로 투자 전략을 완성하세요.";

const DEBOUNCE_MS = 220;
const RESULT_LIMIT = 8;

export interface LandingProps {
  onSelectTicker: (ticker: string) => void;
}

export function Landing({ onSelectTicker }: LandingProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 디바운스 + 검색
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      let alive = true;
      searchCompanies(trimmed, RESULT_LIMIT)
        .then((rows) => {
          if (!alive) return;
          setResults(rows);
          setHighlight(0);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submit = (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (trimmed) onSelectTicker(trimmed);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (open && results[highlight]) {
      onSelectTicker(results[highlight].ticker);
      return;
    }
    submit(query);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && (loading || error !== null || results.length > 0);

  return (
    <div style={S.page}>
      <div style={S.bgImage} aria-hidden />
      <main style={S.center}>
        <div style={S.logo} aria-label="Invest Lens">
          <img src="/invest-lens-logo.svg" alt="" style={S.logoMark} aria-hidden />
          <span style={S.logoWord}>Invest Lens</span>
        </div>

        {/* 헤드라인 — 두 줄. 첫 줄 "투자의 시각,", 둘째 줄 "데이터로 (투명) 하게"
            "투명" 은 fill 투명 + stroke 1px white 로 윤곽선만 (워드플레이) */}
        <h1 style={S.headline}>
          <span style={S.headlineLine}>투자의 시각,</span>
          <span style={S.headlineLine}>
            데이터로 <span style={S.headlineGhost} aria-label="투명">투명</span> 하게
          </span>
        </h1>

        <p style={S.subhead}>{SUBTITLE}</p>

        <div ref={wrapRef} style={S.searchBlock}>
          <form style={S.searchPill} onSubmit={handleSubmit} role="search">
            <span style={S.searchIcon} aria-hidden>⌕</span>
            <input
              style={S.searchInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKey}
              placeholder="주식 종목을 입력하세요."
              aria-label="종목 검색"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              autoFocus
            />
            <button style={S.searchSubmit} type="submit" aria-label="검색 실행">
              →
            </button>
          </form>

          {showDropdown && (
            <ul style={S.dropdown} role="listbox">
              {loading && results.length === 0 && (
                <li style={S.dropdownNote}>검색 중…</li>
              )}
              {error && <li style={S.dropdownError}>오류: {error}</li>}
              {!loading && !error && results.length === 0 && query.trim() && (
                <li style={S.dropdownNote}>일치하는 종목이 없습니다.</li>
              )}
              {results.map((row, i) => (
                <li
                  key={row.ticker}
                  role="option"
                  aria-selected={i === highlight}
                  style={{
                    ...S.dropdownItem,
                    ...(i === highlight ? S.dropdownItemActive : null),
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectTicker(row.ticker);
                  }}
                >
                  <span style={S.dropdownTicker}>{row.ticker}</span>
                  <span style={S.dropdownName}>{row.name}</span>
                  {row.sector && <span style={S.dropdownSector}>{row.sector}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={S.chipsRow}>
          <span style={S.chipLabel}>
            <span aria-hidden style={S.chipFire}>🔥</span>
            <span>인기 검색어</span>
          </span>
          {POPULAR_TICKERS.map((t) => (
            <button
              key={t}
              style={S.chip}
              onClick={() => onSelectTicker(t)}
              title={`${t} 분석 보기`}
            >
              {t}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100%",
    background: "var(--color-hero-bg)",
    color: "var(--color-hero-text)",
    overflow: "hidden",
  },
  // 배경 이미지 — landing-bg.png @ opacity 0.15 (사용자 지정)
  bgImage: {
    position: "absolute",
    inset: 0,
    backgroundImage: "url(/landing-bg.png)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.15,
    pointerEvents: "none",
  },
  center: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    padding: "48px 24px",
    textAlign: "center",
  },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoMark: { width: 22, height: 22, display: "block" },
  logoWord: {
    fontFamily: "var(--font-brand)",
    fontWeight: 400,
    fontSize: 16,
    letterSpacing: "0.02em",
  },
  headline: {
    display: "flex",
    flexDirection: "column",
    fontSize: "clamp(40px, 5vw, 60px)",
    lineHeight: 1.18,
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  headlineLine: { display: "block" },
  // 워드플레이 — "투명" 은 fill 투명 + 흰 stroke 윤곽선만
  headlineGhost: {
    color: "transparent",
    WebkitTextStroke: "1px var(--color-hero-text)",
    paddingInline: "0.05em",
  },
  subhead: {
    color: "var(--color-hero-muted)",
    fontSize: 18,
    fontWeight: 500,
    maxWidth: 720,
    lineHeight: 1.55,
  },
  searchBlock: { position: "relative", width: "min(714px, 92vw)" },
  searchPill: {
    width: "100%",
    background: "var(--color-hero-input-bg)",
    color: "var(--color-hero-input-text)",
    borderRadius: "var(--radius-pill)",
    padding: "8px 8px 8px 24px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.18)",
  },
  searchIcon: { color: "var(--color-brand-navy)", fontSize: 20 },
  searchInput: {
    flex: 1,
    border: 0,
    outline: 0,
    background: "transparent",
    fontSize: 18,
    fontWeight: 500,
    padding: "10px 0",
    color: "var(--color-hero-input-text)",
  },
  searchSubmit: {
    width: 33,
    height: 33,
    borderRadius: "50%",
    background: "var(--color-hero-submit-bg)",
    color: "#ffffff",
    fontSize: 18,
    transition: "transform var(--duration-fast) var(--ease-out)",
    flexShrink: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    background: "#ffffff",
    color: "var(--color-text)",
    borderRadius: 14,
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.32)",
    listStyle: "none",
    padding: 6,
    maxHeight: 320,
    overflowY: "auto",
    textAlign: "left",
    zIndex: 10,
  },
  dropdownNote: {
    padding: "12px 14px",
    color: "var(--color-text-muted)",
    fontSize: 14,
  },
  dropdownError: {
    padding: "12px 14px",
    color: "var(--color-down)",
    fontSize: 14,
  },
  dropdownItem: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "baseline",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    transition: "background var(--duration-fast) var(--ease-out)",
  },
  dropdownItemActive: { background: "#eef2f8" },
  dropdownTicker: { fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" },
  dropdownName: {
    fontSize: 14,
    color: "var(--color-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dropdownSector: { fontSize: 12, color: "var(--color-text-muted)" },
  chipsRow: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: 920,
  },
  chipLabel: {
    color: "var(--color-hero-text)",
    fontSize: 16,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },
  chipFire: { fontSize: 18, lineHeight: 1 },
  chip: {
    color: "var(--color-hero-text)",
    border: "1px solid var(--color-hero-chip-stroke)",
    background: "var(--color-hero-chip-bg)",
    borderRadius: "var(--radius-chip)",
    padding: "5px 18px",
    fontSize: 16,
    fontWeight: 600,
    transition: "background var(--duration-fast) var(--ease-out)",
  },
};
