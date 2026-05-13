import type { CSSProperties } from "react";

const UNITLESS_PROPERTIES = new Set([
  "animationIterationCount",
  "aspectRatio",
  "columnCount",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "scale",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
]);

const PX_PATTERN = /(-?\d*\.?\d+)px/g;
const DESKTOP_MIN_SCALE = 0.88;
const DESKTOP_REFERENCE_WIDTH = 1280;

export function scaledPx(value: number): string {
  const scaled = Number((value * DESKTOP_MIN_SCALE).toFixed(3));
  const preferred = Number(((value / DESKTOP_REFERENCE_WIDTH) * 100).toFixed(4));
  if (value < 0) {
    return `clamp(${value}px, ${preferred}vw, ${scaled}px)`;
  }
  return `clamp(${scaled}px, ${preferred}vw, ${value}px)`;
}

function responsiveNumber(property: string, value: number): string | number {
  if (!Number.isFinite(value) || value === 0 || UNITLESS_PROPERTIES.has(property)) {
    return value;
  }

  return scaledPx(value);
}

function responsiveString(value: string): string {
  return value.replace(PX_PATTERN, (_, n) => scaledPx(Number(n)));
}

export function responsiveStyle<T extends CSSProperties>(style: T): T {
  const output: CSSProperties = {};

  for (const [property, rawValue] of Object.entries(style)) {
    if (typeof rawValue === "number") {
      output[property as keyof CSSProperties] = responsiveNumber(property, rawValue) as never;
      continue;
    }

    if (typeof rawValue === "string") {
      output[property as keyof CSSProperties] = responsiveString(rawValue) as never;
      continue;
    }

    output[property as keyof CSSProperties] = rawValue as never;
  }

  return output as T;
}

export function responsiveStyles(
  styles: Record<string, CSSProperties>,
): Record<string, CSSProperties> {
  const output: Record<string, CSSProperties> = {};

  for (const [key, style] of Object.entries(styles)) {
    output[key] = responsiveStyle(style);
  }

  return output;
}
