import { describe, it, expect, beforeEach } from 'vitest';
import { WeatherSystem } from './weather';

describe('Seasonal Meltemi Weather System (weather.ts)', () => {
  let weather: WeatherSystem;

  beforeEach(() => {
    weather = new WeatherSystem();
  });

  it('initializes with spring weather at day 0', () => {
    const wind = weather.updateForGameDay(0);
    expect(wind.season).toBe('spring');
    expect(wind.speedKnots).toBeGreaterThanOrEqual(6);
    expect(wind.name).toBe('Aegean Zephyr');
    expect(['N', 'NNE', 'NE']).toContain(wind.cardinal);
  });

  it('transitions to peak Summer Meltemi winds in summer months (day 45+)', () => {
    const wind = weather.updateForGameDay(45);
    expect(wind.season).toBe('meltemi');
    expect(wind.name).toBe('Summer Meltemi');
    expect(wind.speedKnots).toBeGreaterThanOrEqual(18);
    // Meltemi originates from the North / NNE
    expect(wind.headingFromDeg).toBeGreaterThanOrEqual(340); // 340° to 360° or 0° to 30°
  });

  it('transitions to Autumn Sirocco in late season (day 150+)', () => {
    const wind = weather.updateForGameDay(150);
    expect(wind.season).toBe('autumn');
    expect(wind.name).toBe('Autumn Sirocco');
    // Sirocco originates from the South (around 180°-210°)
    expect(wind.headingFromDeg).toBeGreaterThanOrEqual(160);
    expect(wind.headingFromDeg).toBeLessThanOrEqual(230);
  });

  it('boosts ship speed under favorable tailwind', () => {
    const wind = weather.updateForGameDay(45); // Meltemi
    // Sailing in the same direction as wind (tailwind)
    const tailwindHeading = wind.directionRad;
    const modifier = weather.calculateSpeedModifier(tailwindHeading, 1);

    expect(modifier).toBeGreaterThan(1.05); // Noticeable tailwind boost
    expect(modifier).toBeLessThanOrEqual(1.35);
  });

  it('penalizes ship speed when beating against a headwind', () => {
    const wind = weather.updateForGameDay(45); // Meltemi
    // Sailing directly into the wind (headwind)
    const headwindHeading = (wind.directionRad + Math.PI) % (2 * Math.PI);
    const modifier = weather.calculateSpeedModifier(headwindHeading, 1);

    expect(modifier).toBeLessThan(0.95); // Noticeable headwind drag
    expect(modifier).toBeGreaterThanOrEqual(0.70);
  });

  it('applies greater wind sensitivity to Tier 1 Kaikis than Tier 5 Luxury Yachts', () => {
    const wind = weather.updateForGameDay(60);
    const tailwindHeading = wind.directionRad;

    const kaikiBoost = weather.calculateSpeedModifier(tailwindHeading, 1); // Tier 1
    const yachtBoost = weather.calculateSpeedModifier(tailwindHeading, 5); // Tier 5

    // Kaiki gains significantly more relative tailwind assistance than heavy motor yacht
    expect(kaikiBoost).toBeGreaterThan(yachtBoost);
  });
});
