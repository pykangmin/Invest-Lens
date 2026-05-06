export interface IndexStripeItem {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean | null };
  badge?: string;
}

export interface IndexStripeProps {
  items: IndexStripeItem[];
}

// Frame 4 카드 안 우측 — 시장 컨텍스트 4슬롯 가로 정렬.
// Figma 시안의 4 슬롯 너비는 약 80px, 좌측에서 921 부터 1275.
export function IndexStripe({ items }: IndexStripeProps) {
  return (
    <div style={S.row}>
      {items.map((it) => {
        const deltaColor =
          it.delta?.positive === null
            ? "var(--color-text-muted)"
            : it.delta?.positive
              ? "var(--color-up)"
              : "var(--color-down)";
        return (
          <div key={it.label} style={S.cell}>
            <div style={S.labelRow}>
              <span style={S.label}>{it.label}</span>
              {it.badge && <span style={S.badge}>{it.badge}</span>}
            </div>
            <div style={S.value}>{it.value}</div>
            {it.delta && <div style={{ ...S.delta, color: deltaColor }}>{it.delta.text}</div>}
          </div>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: { display: "flex", gap: 6 },
  cell: {
    minWidth: 80,
    padding: "0 12px",
    borderLeft: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  labelRow: { display: "flex", alignItems: "center", gap: 6 },
  label: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-strong)",
    fontWeight: 600,
  },
  badge: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-faint)",
    background: "var(--color-header-bg)",
    border: "1px solid var(--color-border)",
    padding: "1px 6px",
    borderRadius: "var(--radius-tag)",
    fontWeight: 600,
  },
  value: {
    fontSize: "var(--font-size-xl-num)",
    fontWeight: 700,
    color: "var(--color-text-strong)",
    fontVariantNumeric: "tabular-nums",
    fontFamily: "var(--font-numeric)",
  },
  delta: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
};
