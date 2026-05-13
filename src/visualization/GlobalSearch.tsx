import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { searchCompanies } from "../data-loader/investmentData";
import type { CompanyMaster } from "../types/investment";
import { responsiveStyles } from "../shared/responsiveStyle";
import { TruncatedText } from "../shared/TruncatedText";

const DEBOUNCE_MS = 220;
const RESULT_LIMIT = 8;

export type GlobalSearchVariant = "hero" | "header";

export interface GlobalSearchProps {
  onSelectTicker: (ticker: string) => void;
  variant?: GlobalSearchVariant;
  placeholder?: string;
  autoFocus?: boolean;
}

export function GlobalSearch({
  onSelectTicker,
  variant = "header",
  placeholder = "오늘은 어떤 종목을 분석 해볼까요?",
  autoFocus = false,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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
    const t = raw.trim().toUpperCase();
    if (t) {
      onSelectTicker(t);
      setQuery("");
      setOpen(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (open && results[highlight]) {
      onSelectTicker(results[highlight].ticker);
      setQuery("");
      setOpen(false);
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
  const wrapStyle = variant === "hero" ? S.heroWrap : S.headerWrap;
  const formStyle = variant === "hero" ? S.heroForm : S.headerForm;
  const inputStyle = variant === "hero" ? S.heroInput : S.headerInput;
  const submitStyle = variant === "hero" ? S.heroSubmit : S.headerSubmit;

  return (
    <div ref={wrapRef} style={wrapStyle}>
      <form style={formStyle} onSubmit={handleSubmit} role="search">
        <span style={S.icon} aria-hidden>⌕</span>
        <input
          style={inputStyle}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          aria-label="종목 검색"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          autoFocus={autoFocus}
        />
        {variant === "hero" && (
          <button style={submitStyle} type="submit" aria-label="검색">
            →
          </button>
        )}
      </form>

      {showDropdown && (
        <ul style={S.dropdown} role="listbox">
          {loading && results.length === 0 && (
            <li style={S.note}>검색 중…</li>
          )}
          {error && <li style={S.errorLine}>오류: {error}</li>}
          {!loading && !error && results.length === 0 && query.trim() && (
            <li style={S.note}>일치하는 종목이 없습니다.</li>
          )}
          {results.map((row, i) => (
            <li
              key={row.ticker}
              role="option"
              aria-selected={i === highlight}
              style={{
                ...S.item,
                ...(i === highlight ? S.itemActive : null),
              }}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectTicker(row.ticker);
                setQuery("");
                setOpen(false);
              }}
            >
              <span style={S.tickerCol}>{row.ticker}</span>
              <TruncatedText style={S.nameCol}>{row.name}</TruncatedText>
              {row.sector && <span style={S.sectorCol}>{row.sector}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const S = responsiveStyles({
  heroWrap: { position: "relative", width: "min(560px, 92vw)" },
  headerWrap: { position: "relative", width: 761, maxWidth: "100%" },

  heroForm: {
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
  headerForm: {
    width: "100%",
    height: 40,
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-pill)",
    padding: "0 18px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  icon: { color: "var(--color-text-muted)", fontSize: 16 },

  heroInput: {
    flex: 1,
    border: 0,
    outline: 0,
    background: "transparent",
    fontSize: 15,
    padding: "10px 0",
    color: "var(--color-text)",
  },
  headerInput: {
    flex: 1,
    border: 0,
    outline: 0,
    background: "transparent",
    fontSize: "var(--font-size-base)",
    color: "var(--color-text)",
  },

  heroSubmit: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "var(--color-hero-submit-bg)",
    color: "#ffffff",
    fontSize: 18,
    transition: "transform var(--duration-fast) var(--ease-out)",
  },
  headerSubmit: {},

  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    background: "var(--color-card)",
    color: "var(--color-text)",
    borderRadius: 14,
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.18)",
    listStyle: "none",
    padding: 6,
    maxHeight: 320,
    overflowY: "auto",
    textAlign: "left",
    zIndex: 100,
  },
  note: {
    padding: "12px 14px",
    color: "var(--color-text-muted)",
    fontSize: "var(--font-size-base)",
  },
  errorLine: {
    padding: "12px 14px",
    color: "var(--color-down)",
    fontSize: "var(--font-size-base)",
  },
  item: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "baseline",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    transition: "background var(--duration-fast) var(--ease-out)",
  },
  itemActive: { background: "var(--color-header-bg)" },
  tickerCol: {
    fontWeight: 700,
    fontSize: "var(--font-size-base)",
    fontVariantNumeric: "tabular-nums",
  },
  nameCol: {
    fontSize: "var(--font-size-base)",
    color: "var(--color-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sectorCol: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-muted)",
  },
});
