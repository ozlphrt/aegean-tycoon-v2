import { describe, it, expect } from 'vitest';
import { parseTooltipContent, formatTooltipSegment } from './GameTooltip';

describe('GameTooltip System — Content Parser & Formatting', () => {
  it('parses keyboard shortcuts in parentheses like (Space), (1), (Esc)', () => {
    const res = parseTooltipContent('Pause Simulation (Space)');
    expect(res.title).toBeUndefined();
    expect(res.body).toBe('Pause Simulation');
    expect(res.shortcut).toBe('Space');
  });

  it('parses warning icons and sets warning badgeType', () => {
    const res = parseTooltipContent('⚠️ Idle in Port');
    expect(res.icon).toBe('⚠️');
    expect(res.badgeType).toBe('warning');
    expect(res.body).toBe('Idle in Port');
  });

  it('parses bullet separated strings into title and body', () => {
    const res = parseTooltipContent('Thassos Trader • Docked at Thassos • Profit: 🪙 12.5k');
    expect(res.title).toBe('Thassos Trader');
    expect(res.body).toBe('Docked at Thassos • Profit: 🪙 12.5k');
  });

  it('parses recommendations with lightbulb emoji 💡', () => {
    const res = parseTooltipContent('Docked idle. 💡 Awaken neighboring consumer ports or assign cargo priority.');
    expect(res.body).toBe('Docked idle.');
    expect(res.recommendation).toBe('Awaken neighboring consumer ports or assign cargo priority.');
  });

  it('adds modal click hint for interactive elements', () => {
    const res = parseTooltipContent('⚠️ Low Load (15%)', true);
    expect(res.actionHint).toBe('Click to inspect in modal');
  });

  it('contextually extracts distress alerts, icons, and badges from bullet strings', () => {
    const res = parseTooltipContent('Santorini • ⚠️ Distress Alert: Supplies Depleted (74% distress)');
    expect(res.title).toBe('Santorini');
    expect(res.badgeType).toBe('warning');
    expect(res.icon).toBe('⚠️');
    expect(res.badge).toBe('⚠️ 74% DISTRESS');
    expect(res.body).toBe('⚠️ Distress Alert: Supplies Depleted (74% distress)');
  });

  it('contextually extracts booming prosperity status and gold badge', () => {
    const res = parseTooltipContent('Naxos • ✨ Booming Prosperity (92%) • Low on Wine');
    expect(res.title).toBe('Naxos');
    expect(res.badgeType).toBe('gold');
    expect(res.icon).toBe('✨');
    expect(res.badge).toBe('✨ 92% PROSPERITY');
  });

  it('formats distress alert strings into illuminated alert banners', () => {
    const html = formatTooltipSegment('⚠️ Distress Alert: Supplies Depleted (74% distress)');
    expect(html).toContain('tooltip-alert-banner alert-distress');
    expect(html).toContain('⚠️ Supplies Depleted');
    expect(html).toContain('74% DISTRESS');
  });

  it('formats numbers, currencies, and velocity rates into glowing chips', () => {
    const html = formatTooltipSegment('Cargo: 120/500 tons • Revenue: 🪙 12.5k • Rate: +5.2/d • Rate: -1.5/d');
    expect(html).toContain('class="tooltip-chip chip-stock"');
    expect(html).toContain('class="tooltip-chip chip-coin"');
    expect(html).toContain('class="tooltip-chip chip-rate-pos"');
    expect(html).toContain('class="tooltip-chip chip-rate-neg"');
  });
});

