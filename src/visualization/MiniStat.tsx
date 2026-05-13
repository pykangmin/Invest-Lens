import { Sparkline } from "./Sparkline";
import { responsiveStyles } from "../shared/responsiveStyle";

export interface MiniStatProps {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean | null };
  sparkline?: Array<number | null>;
}

export function MiniStat({ label, value, delta, sparkline }: MiniStatProps) {
  const deltaColor =
    delta?.positive === null
      ? "var(--color-text-muted)"
      : delta?.positive
        ? "var(--color-up)"
        : "var(--color-down)";

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={S.label}>{label}</div>
        {delta && <div style={{ ...S.delta, color: deltaColor }}>{delta.text}</div>}
      </div>
      <div style={S.value}>{value}</div>
      {sparkline && (
        <div style={S.spark}>
          <Sparkline values={sparkline} width={140} height={28} />
        </div>
      )}
    </div>
  );
}

const S = responsiveStyles({
  card: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 12, color: "var(--color-text-muted)" },
  delta: { fontSize: 11, fontVariantNumeric: "tabular-nums" },
  value: {
    fontSize: 20,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  spark: { marginTop: 4 },
});
