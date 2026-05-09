import type { GaugeScore } from "../types/scoring";
import { Donut } from "./Donut";
import { ProgressBar } from "./ProgressBar";
import { RegimeBadge } from "./RegimeBadge";
import { Sparkline } from "./Sparkline";
import { severityVar } from "./severityColor";

export type GaugeMode = "donut" | "progress" | "regime";

export interface GaugeCardProps {
  title: string;
  gauge: GaugeScore;
  mode?: GaugeMode;
  badge?: string;
  sparkline?: Array<number | null>;
  onDetailClick?: () => void;
}

// G1~G4 모두 흡수. mode 에 따라 본문이 달라짐.
//  - donut: G1 펀더멘털, G2 원자재 영향
//  - regime: G3 거시 경제 (두 줄 라벨만)
//  - progress: G4 기술적 지표 (label + progress bar value)
export function GaugeCard({ title, gauge, mode = "donut", badge, sparkline, onDetailClick }: GaugeCardProps) {
  const autoBadge = badge ?? (gauge.tagline?.startsWith("예시") ? "예시" : undefined);
  const sparkColor = severityVar(gauge.severity);
  return (
    <div style={S.card}>
      <div style={S.head}>
        <span>{title}</span>
        {autoBadge && <span style={S.badge}>{autoBadge}</span>}
      </div>
      <div style={mode === "regime" ? S.bodyRegime : S.body}>
        {mode === "regime" ? (
          <>
            <RegimeBadge label={gauge.tagline || gauge.label} severity={gauge.severity} />
            {sparkline && sparkline.length > 1 && (
              <div style={S.regimeSpark}>
                <Sparkline
                  values={sparkline}
                  width="100%"
                  height={40}
                  color={sparkColor}
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ ...S.label, color: severityVar(gauge.severity) }}>
              {gauge.label}
            </div>
            <div style={S.visual}>
              {mode === "donut" && <Donut gauge={gauge} size={86} thickness={8} />}
              {mode === "progress" && (
                <ProgressBar value={gauge.score} severity={gauge.severity} />
              )}
            </div>
          </>
        )}
      </div>
      <button
        style={S.detail}
        type="button"
        aria-label={`${title} 세부 지표 보기`}
        onClick={onDetailClick}
        disabled={!onDetailClick}
      >
        세부 지표 보기 〉
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    height: "100%",
  },
  head: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
    display: "flex",
    alignItems: "center",
    gap: 6,
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
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "center",
    flex: 1,
  },
  bodyRegime: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    flex: 1,
  },
  regimeSpark: { width: "100%" },
  label: {
    fontSize: "var(--font-size-xl)",
    fontWeight: 800,
    fontFamily: "var(--font-numeric)",
    letterSpacing: "0.02em",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  visual: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  visualWide: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  detail: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    textAlign: "left",
    padding: 0,
    fontWeight: 500,
  },
};
