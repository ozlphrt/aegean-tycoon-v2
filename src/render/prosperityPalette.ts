/**
 * prosperityPalette.ts — Continuous Prosperity Color Palette for Aegean Tycoon
 *
 * Implements a continuous, smoothly interpolated red-to-green gradient for
 * archipelago island prosperity:
 *  - 0%   — Deep Red    #D32F2F
 *  - 15%  — Red-Orange  #F05A28
 *  - 30%  — Orange      #F7941D
 *  - 50%  — Yellow      #FFD23F
 *  - 70%  — Yellow-Green#B5D334
 *  - 85%  — Light Green #70BC45
 *  - 100% — Green       #249B56
 */

import * as THREE from 'three';

export interface ProsperityColorStop {
  stop: number;
  hex: string;
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
}

export const PROSPERITY_COLOR_STOPS: readonly ProsperityColorStop[] = [
  { stop: 0.00, hex: '#D32F2F', r: 0xd3 / 255, g: 0x2f / 255, b: 0x2f / 255 }, // 211, 47, 47
  { stop: 0.15, hex: '#F05A28', r: 0xf0 / 255, g: 0x5a / 255, b: 0x28 / 255 }, // 240, 90, 40
  { stop: 0.30, hex: '#F7941D', r: 0xf7 / 255, g: 0x94 / 255, b: 0x1d / 255 }, // 247, 148, 29
  { stop: 0.50, hex: '#FFD23F', r: 0xff / 255, g: 0xd2 / 255, b: 0x3f / 255 }, // 255, 210, 63
  { stop: 0.70, hex: '#B5D334', r: 0xb5 / 255, g: 0xd3 / 255, b: 0x34 / 255 }, // 181, 211, 52
  { stop: 0.85, hex: '#70BC45', r: 0x70 / 255, g: 0xbc / 255, b: 0x45 / 255 }, // 112, 188, 69
  { stop: 1.00, hex: '#249B56', r: 0x24 / 255, g: 0x9b / 255, b: 0x56 / 255 }, // 36, 155, 86
] as const;

export const PROSPERITY_GRADIENT_CSS =
  'linear-gradient(to right, #D32F2F 0%, #F05A28 15%, #F7941D 30%, #FFD23F 50%, #B5D334 70%, #70BC45 85%, #249B56 100%)';

/**
 * Smoothly interpolates RGB values (in 0..1 range) across the prosperity spectrum.
 */
export function getProsperityRgb(prosperity: number): { r: number; g: number; b: number } {
  const p = Math.max(0, Math.min(1, isNaN(prosperity) ? 0.5 : prosperity));
  const stops = PROSPERITY_COLOR_STOPS;

  if (p <= stops[0].stop) {
    return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
  }
  const last = stops[stops.length - 1];
  if (p >= last.stop) {
    return { r: last.r, g: last.g, b: last.b };
  }

  // Find surrounding stops
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (p >= s0.stop && p <= s1.stop) {
      const range = s1.stop - s0.stop;
      const t = range === 0 ? 0 : (p - s0.stop) / range;
      return {
        r: s0.r + (s1.r - s0.r) * t,
        g: s0.g + (s1.g - s0.g) * t,
        b: s0.b + (s1.b - s0.b) * t,
      };
    }
  }

  return { r: last.r, g: last.g, b: last.b };
}

/**
 * Smoothly interpolates RGB values in 0..255 integer range.
 */
export function getProsperityRgb255(prosperity: number): { r: number; g: number; b: number } {
  const rgb = getProsperityRgb(prosperity);
  return {
    r: Math.round(rgb.r * 255),
    g: Math.round(rgb.g * 255),
    b: Math.round(rgb.b * 255),
  };
}

/**
 * Returns the hex string (#RRGGBB) for any prosperity value (0.0 to 1.0).
 */
export function getProsperityHex(prosperity: number): string {
  const rgb = getProsperityRgb255(prosperity);
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Returns a Three.js Color instance reflecting the interpolated prosperity color.
 */
export function getProsperityThreeColor(prosperity: number): THREE.Color {
  const rgb = getProsperityRgb(prosperity);
  return new THREE.Color(rgb.r, rgb.g, rgb.b);
}

/**
 * Formats exact prosperity percentage with 1 decimal place.
 * e.g. 0.742 -> "74.2%"
 */
export function formatProsperityExact(prosperity: number): string {
  const p = Math.max(0, Math.min(1, isNaN(prosperity) ? 0 : prosperity));
  return `${(p * 100).toFixed(1)}%`;
}
