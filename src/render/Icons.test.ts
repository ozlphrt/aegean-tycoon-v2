import { describe, it, expect } from 'vitest';
import { icons, getIconSvg, getGoodIconSvg, getShipTierIconSvg, ICON_THEMES, type IconStyle } from './Icons';

describe('Aegean Classical Vector Icon System', () => {
  it('defines 4 distinct icon themes including Classical Antiquity, Minimalist Hellenic, Imperial Gold, and Emojis', () => {
    expect(ICON_THEMES.length).toBe(4);
    const ids = ICON_THEMES.map((t) => t.id);
    expect(ids).toContain('antiquity');
    expect(ids).toContain('minimalist');
    expect(ids).toContain('imperial');
    expect(ids).toContain('emoji');
  });

  it('generates rich Classical Antiquity SVGs with Athenian tetradrachm, laurel wreath, and Antikythera cogwheel', () => {
    const drachmaSvg = getIconSvg('drachma', 'antiquity', 24);
    expect(drachmaSvg).toContain('<svg');
    expect(drachmaSvg).toContain('icon-drachma');
    expect(drachmaSvg).toContain('ΑΘΕ'); // Athenian inscription

    const laurelSvg = getIconSvg('laurel', 'antiquity', 24);
    expect(laurelSvg).toContain('<svg');
    expect(laurelSvg).toContain('icon-laurel');

    const gearSvg = getIconSvg('gear', 'antiquity', 24);
    expect(gearSvg).toContain('<svg');
    expect(gearSvg).toContain('antikythera-grad');

    const pauseSvg = getIconSvg('pause', 'antiquity', 24);
    expect(pauseSvg).toContain('<svg');
    expect(pauseSvg).toContain('icon-pause');
  });

  it('generates rich Classical Greek commodity SVGs for market goods', () => {
    const goods = ['wine', 'water', 'crafts', 'produce', 'fish', 'grain', 'cheese', 'olive_oil', 'olive', 'honey', 'marble', 'sponges', 'fuel', 'mastic', 'anchor'];
    for (const good of goods) {
      const svg = getGoodIconSvg(good, 'antiquity', 26);
      expect(svg).toContain('<svg');
      expect(svg).toContain('antiquity');
      expect(svg).toContain(`width="26"`);

      const minSvg = getGoodIconSvg(good, 'minimalist', 24);
      expect(minSvg).toContain('<svg');
      expect(minSvg).toContain('minimalist');

      const impSvg = getGoodIconSvg(good, 'imperial', 28);
      expect(impSvg).toContain('<svg');
      expect(impSvg).toContain('imperial');

      const emojiHtml = getGoodIconSvg(good, 'emoji', 26);
      expect(emojiHtml).toContain('good-emoji-fallback');
    }
  });

  it('generates distinct Minimalist and Imperial vector variants for all styles', () => {
    const minDrachma = getIconSvg('drachma', 'minimalist', 20);
    expect(minDrachma).toContain('minimalist');
    expect(minDrachma).toContain('#38bdf8'); // Aegean cyan

    const impDrachma = getIconSvg('drachma', 'imperial', 20);
    expect(impDrachma).toContain('imperial');
    expect(impDrachma).toContain('#f59e0b'); // Imperial gold
  });

  it('falls back to emojis when emoji theme is active', () => {
    const emojiDrachma = getIconSvg('drachma', 'emoji');
    expect(emojiDrachma).toBe('🪙');

    const emojiLaurel = getIconSvg('laurel', 'emoji');
    expect(emojiLaurel).toBe('⭐');

    const emojiArch = getIconSvg('archipelago', 'emoji');
    expect(emojiArch).toBe('🏝️');

    expect(getIconSvg('wine', 'emoji')).toBe('🍷');
    expect(getIconSvg('fish', 'emoji')).toBe('🐟');
    expect(getIconSvg('grain', 'emoji')).toBe('🌾');
    expect(getIconSvg('anchor', 'emoji')).toBe('⚓');
  });

  it('supports runtime style switching and listener notification', () => {
    let notifiedStyle: IconStyle | null = null;
    const unsubscribe = icons.onStyleChange((style) => {
      notifiedStyle = style;
    });

    icons.setStyle('minimalist');
    expect(icons.getStyle()).toBe('minimalist');
    expect(notifiedStyle).toBe('minimalist');

    icons.setStyle('antiquity');
    expect(icons.getStyle()).toBe('antiquity');
    expect(notifiedStyle).toBe('antiquity');

    unsubscribe();
  });

  it('generates rich Aegean vessel vector SVGs across all 5 tiers and themes', () => {
    // Tier 1: Traditional Kaiki, Tier 2: Caique, Tier 3: Ferry, Tier 4: Freighter, Tier 5: Yacht
    for (let tier = 1; tier <= 5; tier++) {
      const antiSvg = getShipTierIconSvg(tier, 'antiquity', 22);
      expect(antiSvg).toContain('<svg');
      expect(antiSvg).toContain('icon-vessel');
      expect(antiSvg).toContain('antiquity');

      const minSvg = getShipTierIconSvg(tier, 'minimalist', 20);
      expect(minSvg).toContain('<svg');
      expect(minSvg).toContain('icon-vessel');
      expect(minSvg).toContain('minimalist');

      const impSvg = getShipTierIconSvg(tier, 'imperial', 24);
      expect(impSvg).toContain('<svg');
      expect(impSvg).toContain('icon-vessel');
      expect(impSvg).toContain('imperial');

      const emojiHtml = getShipTierIconSvg(tier, 'emoji', 20);
      expect(emojiHtml).toContain('ship-emoji-fallback');
    }

    // Explicit check for Tier 1 Kaiki SVG details
    const kaiki = getShipTierIconSvg(1, 'antiquity', 22);
    expect(kaiki).toContain('icon-kaiki');
    expect(kaiki).toContain('kaiki-sail-main-22');
  });
});
