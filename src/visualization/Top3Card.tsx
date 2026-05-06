export interface Top3Item {
  ticker: string;
  korName?: string;
  primary: string;       // 우측 표기 ("8.31%" 또는 "92")
}

export type Top3Tone = "up" | "down" | "info" | "neutral";

export interface Top3CardProps {
  title: string;
  items: Top3Item[];
  tone?: Top3Tone;
  pending?: boolean;
}

function toneColor(tone: Top3Tone): string {
  switch (tone) {
    case "up":
      return "var(--color-up)";
    case "down":
      return "var(--color-down)";
    case "info":
      return "var(--color-info-alt)";
    case "neutral":
    default:
      return "var(--color-text)";
  }
}

export function Top3Card({ title, items, tone = "up", pending = false }: Top3CardProps) {
  const numColor = toneColor(tone);
  return (
    <div style={{ ...S.card, ...(pending ? S.cardPending : null) }}>
      <div style={S.title}>{title}</div>
      {pending ? (
        <div style={S.pendingNote}>데이터 준비 중</div>
      ) : (
        <ol style={S.list}>
          {items.length === 0 && <li style={S.empty}>데이터 없음</li>}
          {items.map((it, i) => (
            <li key={`${it.ticker}-${i}`} style={S.row}>
              <span style={S.rank}>{i + 1}</span>
              <span style={S.tickerCol}>
                <span style={S.ticker}>{it.ticker}</span>
                {it.korName && <span style={S.korName}>{it.korName}</span>}
              </span>
              <span style={{ ...S.primary, color: numColor }}>{it.primary}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "14px 16px",
  },
  cardPending: { background: "var(--color-header-bg)", borderStyle: "dashed" },
  title: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text)",
    fontWeight: 600,
    marginBottom: 10,
  },
  list: { listStyle: "none", display: "grid", gap: 8, margin: 0, padding: 0 },
  row: {
    display: "grid",
    gridTemplateColumns: "20px 1fr auto",
    alignItems: "center",
    gap: 10,
  },
  rank: {
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-text-muted)",
    fontWeight: 700,
    fontSize: "var(--font-size-sm)",
  },
  tickerCol: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  ticker: {
    fontWeight: 700,
    fontSize: "var(--font-size-base)",
    color: "var(--color-text)",
  },
  korName: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-muted)",
  },
  primary: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    fontSize: "var(--font-size-sm)",
    fontFamily: "var(--font-numeric)",
  },
  empty: { color: "var(--color-text-muted)", fontSize: "var(--font-size-xxs)" },
  pendingNote: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-muted)",
    fontStyle: "italic",
    padding: "16px 0",
    textAlign: "center",
  },
};
