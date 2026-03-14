import type { CSSProperties } from "react";

export function normalizeHexColor(color: string) {
  const value = color.trim();

  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return null;
  }

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return value;
}

export function hexToRgb(color: string) {
  const normalized = normalizeHexColor(color);

  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function mixChannel(base: number, target: number, ratio: number) {
  return Math.round(base * (1 - ratio) + target * ratio);
}

export function getProjectBadgeStyle(color: string): CSSProperties | undefined {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return undefined;
  }

  const textColor = `rgb(${mixChannel(rgb.r, 255, 0.74)} ${mixChannel(rgb.g, 255, 0.74)} ${mixChannel(rgb.b, 255, 0.74)})`;

  return {
    backgroundColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.12)`,
    borderColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.3)`,
    color: textColor
  };
}
