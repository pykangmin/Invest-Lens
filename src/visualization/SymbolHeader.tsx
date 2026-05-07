export interface SymbolHeaderProps {
  name: string;
  ticker: string;
  current: number | null;
  delta: number | null;
  pct: number | null;
}

// Frame 4 카드 안 좌측 — 회사명(25px) + 가격·변동(40px) 한 블록.
export function SymbolHeader({ name, ticker, current, delta, pct }: SymbolHeaderProps) {
  const positive = delta === null ? null : delta >= 0;
  const deltaColor =
    positive === null
      ? "var(--color-text-muted)"
      : positive
        ? "var(--color-up-strong)"
        : "var(--color-down)";
  return (
    <div style={S.block}>
      <div style={S.name}>{name}</div>
      <div style={S.row}>
        {current !== null ? (
          <>
            <span style={S.price}>
              {current.toFixed(2)}
              <span style={S.unit}>$</span>
            </span>
            {delta !== null && pct !== null && (
              <span style={{ ...S.delta, color: deltaColor }}>
                {positive ? "+" : ""}
                {delta.toFixed(2)}$ ({positive ? "+" : ""}
                {pct.toFixed(2)}%)
              </span>
            )}
          </>
        ) : (
          <span style={S.priceMissing}>가격 데이터 없음 · {ticker}</span>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  block: { display: "flex", flexDirection: "column", gap: 4 },
  name: {
    fontSize: "var(--font-size-2xl)",
    fontWeight: 700,
    color: "var(--color-text)",
    letterSpacing: "-0.01em",
  },
  row: { display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" },
  price: {
    fontSize: "var(--font-size-3xl)",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-text)",
    lineHeight: 1.1,
  },
  unit: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 700,
    color: "var(--color-text-muted)",
    marginLeft: 2,
  },
  delta: {
    fontSize: "var(--font-size-md)",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
  priceMissing: {
    fontSize: "var(--font-size-md)",
    color: "var(--color-text-muted)",
  },
};
