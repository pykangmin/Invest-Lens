import { Sparkline } from "./Sparkline";
import { responsiveStyles } from "../shared/responsiveStyle";

export interface FxCardProps {
  label: string;
  sublabel?: string;
  value: string;
  delta?: { text: string; positive: boolean | null };
  sparkline?: Array<number | null>;
}

// 환율/원자재 1 카드 — Figma `환율` row 의 카드 단위.
// 좌: 라벨 + 부제 / 우: 값 + delta + sparkline
export function FxCard({ label, sublabel, value, delta, sparkline }: FxCardProps) {
  const deltaColor =
    delta?.positive === null
      ? "var(--color-text-muted)"
      : delta?.positive
        ? "var(--color-up)"
        : "var(--color-down)";
  return (
    <div style={S.row}>
      <div style={S.left}>
        <div style={S.label}>{label}</div>
        {sublabel && <div style={S.sublabel}>{sublabel}</div>}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div style={S.spark}>
          <Sparkline values={sparkline} width={100} height={28} />
        </div>
      )}
      <div style={S.right}>
        <div style={S.value}>{value}</div>
        {delta && <div style={{ ...S.delta, color: deltaColor }}>{delta.text}</div>}
      </div>
    </div>
  );
}

const S = responsiveStyles({
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1fr) auto auto",
    alignItems: "center",
    gap: 14,
    padding: "10px 14px",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
  },
  left: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  label: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  sublabel: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
  },
  spark: {},
  right: {
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  value: {
    fontSize: "var(--font-size-lg)",
    fontWeight: 600,
    color: "var(--color-text)",
    fontVariantNumeric: "tabular-nums",
  },
  delta: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
});
