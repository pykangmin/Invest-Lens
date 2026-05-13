// InfoTooltip — i 아이콘 + 본문 노출 wrapper.
// mode:
//   "native" — browser native title= 속성 (느림 ~500ms, 스타일 불가)
//   "card"   — hover 즉시 floating card 표시 (시안 tooltip=on variant 외형)

import { useState, type CSSProperties } from "react";
import { responsiveStyles, scaledPx } from "../shared/responsiveStyle";

export interface InfoTooltipProps {
  text: string;
  mode: "native" | "card";
  size?: number; // i 아이콘 크기
  placement?: "top" | "bottom";
}

export function InfoTooltip({
  text,
  mode,
  size = 16,
  placement = "top",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const scaledSize = scaledPx(size);
  const scaledFontSize = scaledPx(size * 0.65);

  if (mode === "native") {
    return (
      <span
        style={{ ...S.icon, width: scaledSize, height: scaledSize, fontSize: scaledFontSize }}
        title={text}
      >
        i
      </span>
    );
  }

  // card mode
  return (
    <span
      style={S.wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span style={{ ...S.icon, width: scaledSize, height: scaledSize, fontSize: scaledFontSize }}>
        i
      </span>
      {open && (
        <span
          style={{
            ...S.card,
            ...(placement === "top" ? S.cardTop : S.cardBottom),
          }}
          role="tooltip"
        >
          {text}
          <span
            style={{
              ...S.arrow,
              ...(placement === "top" ? S.arrowTop : S.arrowBottom),
            }}
          />
        </span>
      )}
    </span>
  );
}

const S = responsiveStyles({
  wrap: {
    position: "relative",
    display: "inline-flex",
    outline: "none",
  },
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    border: "1px solid #737171",
    color: "#737171",
    fontWeight: 600,
    fontFamily: "var(--font-numeric)",
    cursor: "help",
    background: "#ffffff",
    lineHeight: 1,
    userSelect: "none",
  },
  card: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: 260,
    padding: "10px 14px",
    background: "#ffffff",
    border: "1px solid #d9d9d9",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.55,
    color: "#003049",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    zIndex: 100,
    whiteSpace: "normal",
    pointerEvents: "none",
  },
  cardTop: {
    bottom: "calc(100% + 8px)",
  },
  cardBottom: {
    top: "calc(100% + 8px)",
  },
  arrow: {
    position: "absolute",
    left: "50%",
    width: 10,
    height: 10,
    background: "#ffffff",
    border: "1px solid #d9d9d9",
    transform: "translateX(-50%) rotate(45deg)",
  },
  arrowTop: {
    bottom: -6,
    borderTop: "none",
    borderLeft: "none",
  },
  arrowBottom: {
    top: -6,
    borderBottom: "none",
    borderRight: "none",
  },
});
