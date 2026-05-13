import type { Severity } from "../types/scoring";
import { severityVar } from "./severityColor";
import { responsiveStyles } from "../shared/responsiveStyle";

export interface RegimeBadgeProps {
  // 두 줄 라벨 — `SOFT\nLANDING` 같이.
  label: string;
  severity: Severity;
}

// G3 (거시 경제) 의 regime 라벨 카드 — 도넛/숫자 없이 두 줄 텍스트만.
export function RegimeBadge({ label, severity }: RegimeBadgeProps) {
  const lines = label.split(/\n|\s+/).slice(0, 2);
  return (
    <div style={S.wrap}>
      {lines.map((line, i) => (
        <div
          key={`${line}-${i}`}
          style={{
            ...S.line,
            color: severityVar(severity),
          }}
        >
          {line.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

const S = responsiveStyles({
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
  },
  line: {
    fontFamily: "var(--font-numeric)",
    fontSize: "var(--font-size-xl)",
    fontWeight: 800,
    letterSpacing: "0.02em",
    lineHeight: 1.05,
  },
});
