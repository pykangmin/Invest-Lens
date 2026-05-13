import { Sparkline } from "./Sparkline";
import { responsiveStyles } from "../shared/responsiveStyle";

export interface CompositeTrioItem {
  label: string;          // 시점 라벨 (예: "오늘 종합 점수", "이번 달 종합 점수")
  score: number | null;
  delta?: { text: string; positive: boolean | null; comparison?: string };
  history?: Array<number | null>;
  badge?: string;         // 카드 우상단 배지 (예: "추이 예시" — score 는 실, history/delta 가 예시일 때)
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
            <div style={S.head}>
              <span style={S.label}>{it.label}</span>
              {it.badge && <span style={S.badge}>{it.badge}</span>}
            </div>
            <div style={S.body}>
              <div style={{ ...S.score, color }}>
                {it.score === null ? "—" : it.score.toFixed(1)}
              </div>
              <div style={S.spark}>
                <Sparkline
                  values={it.history ?? [it.score, it.score]}
                  width="100%"
                  height={64}
                  color={color}
                  strokeWidth={2}
                />
              </div>
            </div>
            {it.delta && (
              <div style={{ ...S.delta, color: deltaColor }}>
                {it.delta.comparison ?? "전일 대비"} {it.delta.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const S = responsiveStyles({
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
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
  head: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  label: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
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
  body: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
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
});
