import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { searchCompanies } from "../data-loader/investmentData";
import type { CompanyMaster } from "../types/investment";

const POPULAR_CHIPS = [
  { label: "삼성 전자", ticker: null },
  { label: "GOOGLE", ticker: "GOOGL" },
  { label: "MSFT", ticker: "MSFT" },
  { label: "NVDA", ticker: "NVDA" },
];

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
      <div style={S.bgPattern} aria-hidden />
      <main style={S.center}>
        <div style={S.logo}>
          <span style={S.logoMark}>〉</span>
          <span style={S.logoWord}>Invest Lens</span>
        </div>

        <h1 style={S.headline}>
          <span>투자의 시각,</span>
          <br />
          <span>
            데이터로 <em style={S.headlineAccent}>투명</em>하게
          </span>
        </h1>

        <p style={S.subhead}>
          종목명을 입력하면 펀더멘탈부터 리스크 시그널까지 한눈에 분석해드립니다.
        </p>

        <div ref={wrapRef} style={S.searchBlock}>
          <form style={S.searchWrap} onSubmit={handleSubmit} role="search">
            <span style={S.searchIcon} aria-hidden>
              ⌕
            </span>
            <input
              style={S.searchInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKey}
              placeholder="주식 종목을 입력하세요"
              aria-label="종목 검색"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              autoFocus
            />
            <button style={S.searchSubmit} type="submit" aria-label="검색">
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
            <span aria-hidden>👍</span> 인기 검색어
          </span>
          {POPULAR_CHIPS.map((chip) => (
            <button
              key={chip.label}
              style={{ ...S.chip, opacity: chip.ticker ? 1 : 0.55 }}
              disabled={!chip.ticker}
              title={chip.ticker ? `${chip.label} 검색` : "데이터셋 미수록"}
              onClick={() => chip.ticker && onSelectTicker(chip.ticker)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100%",
    background: "var(--color-hero-bg)",
    color: "var(--color-hero-text)",
    overflow: "hidden",
  },
  bgPattern: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(11, 30, 63, 0) 0%, rgba(11, 30, 63, 0.55) 70%, rgba(11, 30, 63, 0.85) 100%), repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0 2px, transparent 2px 38px)",
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
  logo: { display: "flex", alignItems: "center", gap: 8, opacity: 0.92 },
  logoMark: { color: "var(--color-accent)", fontSize: 18 },
  logoWord: {
    fontStyle: "italic",
    fontFamily:
      "'Cormorant Garamond', 'Playfair Display', 'Pretendard Variable', serif",
    fontWeight: 500,
    letterSpacing: "0.02em",
  },
  headline: {
    fontSize: "clamp(36px, 5vw, 60px)",
    lineHeight: 1.18,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  headlineAccent: {
    color: "var(--color-accent)",
    fontStyle: "normal",
    padding: "0 0.08em",
  },
  subhead: {
    color: "var(--color-hero-muted)",
    fontSize: 15,
    fontWeight: 400,
    maxWidth: 640,
  },
  searchBlock: {
    position: "relative",
    width: "min(560px, 92vw)",
  },
  searchWrap: {
    width: "100%",
    background: "var(--color-hero-input-bg)",
    color: "var(--color-hero-input-text)",
    borderRadius: "var(--radius-pill)",
    padding: "8px 8px 8px 22px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.18)",
  },
  searchIcon: { color: "#6b7589", fontSize: 18 },
  searchInput: {
    flex: 1,
    border: 0,
    outline: 0,
    background: "transparent",
    fontSize: 15,
    padding: "10px 0",
  },
  searchSubmit: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "var(--color-hero-submit-bg)",
    color: "#ffffff",
    fontSize: 18,
    transition: "transform var(--duration-fast) var(--ease-out)",
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
  dropdownTicker: {
    fontWeight: 700,
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
  },
  dropdownName: {
    fontSize: 14,
    color: "var(--color-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dropdownSector: {
    fontSize: 12,
    color: "var(--color-text-muted)",
  },
  chipsRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chipLabel: {
    color: "var(--color-hero-text)",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    color: "var(--color-hero-text)",
    border: "1px solid rgba(255, 255, 255, 0.28)",
    background: "rgba(255, 255, 255, 0.04)",
    borderRadius: "var(--radius-pill)",
    padding: "6px 14px",
    fontSize: 13,
    transition: "background var(--duration-fast) var(--ease-out)",
  },
};
