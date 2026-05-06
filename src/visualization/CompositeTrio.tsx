import { Sparkline } from "./Sparkline";

export interface CompositeTrioItem {
  label: string;          // 시점 라벨 (예: "오늘 종합 점수", "이번 달 종합 점수")
  score: number | null;
  delta?: { text: string; positive: boolean | null };
  history?: Array<number | null>;
}

export interface CompositeTrioProps {
  items: CompositeTrioItem[];   // 정확히 3개 권장
}

function colorFor(score: number | null): string {
  if (score === null) return "var(--color-text-muted)";
  if (score >= 60) return "var(--color-up)";
  if (score >= 30) return "var(--color-accent)";
  return "var(--color-down)";
}

// Frame 17 — 시점 비교 trio. 각 카드: 라벨 + 큰 숫자 + 전일 대비 + sparkline.
// v2 의 "3 도메인 평균" 의미가 아니라 시안 그대로 시점 비교.
export function CompositeTrio({ items }: CompositeTrioProps) {
  return (
    <div style={S.row}>
      {items.map((it, i) => {
        const color = colorFor(it.score);
        const deltaColor =
          it.delta?.positive === null
            ? "var(--color-text-muted)"
            : it.delta?.positive
              ? "var(--color-up)"
              : "var(--color-down)";
        return (
          <div key={`${it.label}-${i}`} style={S.card}>
            <div style={S.label}>{it.label}</div>
            <div style={S.body}>
              <div style={{ ...S.score, color }}>
                {it.score === null ? "—" : it.score.toFixed(1)}
              </div>
              <div style={S.spark}>
                <Sparkline
                  values={it.history ?? [it.score, it.score]}
                  width={180}
                  height={48}
                  color={color}
                />
              </div>
            </div>
            {it.delta && (
              <div style={{ ...S.delta, color: deltaColor }}>
                전일 대비 {it.delta.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    minHeight: 147,
  },
  card: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "16px 18px",
    minHeight: 147,
  },
  label: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
    marginBottom: 6,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: 16,
  },
  score: {
    fontSize: "var(--font-size-4xl)",
    fontWeight: 800,
    fontFamily: "var(--font-numeric)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.05,
  },
  spark: {},
  delta: {
    marginTop: 8,
    fontSize: "var(--font-size-sm)",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
};
