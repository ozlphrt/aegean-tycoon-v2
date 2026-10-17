import { describe, it, expect } from 'vitest';
import {
  PROSPERITY_COLOR_STOPS,
  getProsperityHex,
  getProsperityRgb,
  getProsperityThreeColor,
  formatProsperityExact,
} from './prosperityPalette';

describe('Prosperity Color Palette & Continuous Interpolation', () => {
  it('matches all 7 required color stops at exact boundaries', () => {
    expect(getProsperityHex(0.00)).toBe('#D32F2F'); // 0% Deep Red
    expect(getProsperityHex(0.15)).toBe('#F05A28'); // 15% Red-Orange
    expect(getProsperityHex(0.30)).toBe('#F7941D'); // 30% Orange
    expect(getProsperityHex(0.50)).toBe('#FFD23F'); // 50% Yellow
    expect(getProsperityHex(0.70)).toBe('#B5D334'); // 70% Yellow-Green
    expect(getProsperityHex(0.85)).toBe('#70BC45'); // 85% Light Green
    expect(getProsperityHex(1.00)).toBe('#249B56'); // 100% Green
  });

  it('smoothly interpolates intermediate values between color stops', () => {
    // Midway between 0% (#D32F2F) and 15% (#F05A28): stop = 0.075
    const midRgb = getProsperityRgb(0.075);
    const stop0 = PROSPERITY_COLOR_STOPS[0];
    const stop1 = PROSPERITY_COLOR_STOPS[1];
    expect(midRgb.r).toBeCloseTo((stop0.r + stop1.r) / 2, 4);
    expect(midRgb.g).toBeCloseTo((stop0.g + stop1.g) / 2, 4);
    expect(midRgb.b).toBeCloseTo((stop0.b + stop1.b) / 2, 4);

    // Verify hex output exists and is a valid uppercase hex string
    const hex = getProsperityHex(0.075);
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('safely clamps out-of-range prosperity values', () => {
    expect(getProsperityHex(-0.5)).toBe('#D32F2F');
    expect(getProsperityHex(1.5)).toBe('#249B56');
  });

  it('constructs Three.js Color instance correctly', () => {
    const threeColor = getProsperityThreeColor(0.5);
    expect(threeColor.r).toBeCloseTo(1.0, 2); // 255/255 = 1.0
    expect(threeColor.g).toBeCloseTo(210 / 255, 2);
    expect(threeColor.b).toBeCloseTo(63 / 255, 2);
  });

  it('formats exact prosperity percentage with 1 decimal place', () => {
    expect(formatProsperityExact(0.742)).toBe('74.2%');
    expect(formatProsperityExact(0.85)).toBe('85.0%');
    expect(formatProsperityExact(0)).toBe('0.0%');
    expect(formatProsperityExact(1)).toBe('100.0%');
  });
});
