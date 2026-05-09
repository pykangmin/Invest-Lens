import type { CSSProperties, ReactNode } from "react";
import type { AnalysisEvent, Severity } from "../types/scoring";
import { severityVar } from "./severityColor";

export interface EventListProps {
  events: AnalysisEvent[];
  title?: string;
  maxRows?: number;
  headerBadge?: ReactNode;
  style?: CSSProperties;
}

function severityChip(s: Severity): string {
  switch (s) {
    case "WARNING":
      return "rgba(193, 18, 31, 0.10)";
    case "CAUTION":
      return "rgba(224, 181, 86, 0.14)";
    case "INFO":
    default:
      return "rgba(64, 115, 255, 0.10)";
  }
}

function formatDay(date: string): { day: string; month: string } {
  const d = new Date(date);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][
    d.getUTCMonth()
  ];
  return { day, month };
}

export function EventList({ events, title = "주요 이벤트", maxRows = 5, headerBadge, style }: EventListProps) {
  const rows = events.slice(0, maxRows);
  return (
    <div style={{ ...S.card, ...style }}>
      <header style={S.head}>
        <div style={S.titleRow}>
          <span style={S.title}>{title}</span>
          {headerBadge}
        </div>
      </header>
      {rows.length === 0 ? (
        <div style={S.empty}>표시할 이벤트가 없습니다.</div>
      ) : (
        <ul style={S.list}>
          {rows.map((ev, i) => {
            const { day, month } = formatDay(ev.date);
            return (
              <li key={`${ev.date}-${i}`} style={S.row}>
                <div style={S.dateBox}>
                  <div style={S.day}>{day}</div>
                  <div style={S.month}>{month}</div>
                </div>
                <div style={S.body}>
                  <div style={S.titleRow}>
                    <span style={S.rowTitle}>{ev.title}</span>
                    <span
                      style={{
                        ...S.tag,
                        color: severityVar(ev.severity),
                        background: severityChip(ev.severity),
                      }}
                    >
                      {ev.category ?? ev.severity}
                    </span>
                    {ev.time && <span style={S.rowTime}>{ev.time}</span>}
                  </div>
                  <div style={S.rowDetail}>{ev.detail}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: "18px 20px",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: "var(--font-size-md)",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  more: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
  },
  empty: { color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", padding: "12px 0" },
  list: { listStyle: "none", display: "grid", gap: 12 },
  row: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 14,
    alignItems: "center",
  },
  dateBox: {
    width: 48,
    textAlign: "center",
    padding: "8px 0",
    background: "var(--color-header-bg)",
    borderRadius: 8,
  },
  day: {
    fontSize: "var(--font-size-xl-num)",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-text)",
  },
  month: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-muted)",
    letterSpacing: "0.06em",
  },
  body: { minWidth: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 8 },
  rowTitle: {
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowDetail: {
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
    marginTop: 2,
  },
  rowTime: {
    fontSize: "var(--font-size-xxs)",
    color: "var(--color-text-faint)",
    marginLeft: "auto",
    fontVariantNumeric: "tabular-nums",
  },
  tag: {
    fontSize: "var(--font-size-xxs)",
    padding: "3px 8px",
    border: 0,
    borderRadius: "var(--radius-tag)",
    fontWeight: 600,
    letterSpacing: "0.04em",
  },
};
