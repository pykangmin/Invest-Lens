// DataTable — 단순 표.
// 시안 등장 처: 카테고리별 세부 수익 표 (8 row × 11 col), 거시지표 세부 표.
// 각 셀은 수치 또는 작은 sparkline 가능.

import type { CSSProperties, ReactNode } from "react";

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
  width?: string | number;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
}

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div style={S.wrap}>
      <table style={S.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={{
                  ...S.th,
                  textAlign: c.align ?? "left",
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} style={S.tr}>
              {columns.map((c) => {
                const content = c.render
                  ? c.render(row)
                  : ((row as unknown as Record<string, unknown>)[String(c.key)] as ReactNode);
                return (
                  <td
                    key={String(c.key)}
                    style={{ ...S.td, textAlign: c.align ?? "left" }}
                  >
                    {content as ReactNode}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    width: "100%",
    overflowX: "auto",
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--color-border)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "var(--font-size-sm)",
    fontFamily: "var(--font-numeric)",
  },
  th: {
    padding: "10px 12px",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    background: "var(--color-header-bg)",
    borderBottom: "1px solid var(--color-border)",
    fontSize: "var(--font-size-xs)",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid var(--color-border)",
  },
  td: {
    padding: "10px 12px",
    color: "var(--color-text)",
    fontWeight: 500,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
};
