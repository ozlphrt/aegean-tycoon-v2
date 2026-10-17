import { describe, it, expect } from 'vitest';
import { assetUrl } from './assets';

describe('Asset URL Resolver (assets.ts)', () => {
  it('strips leading slash from asset path', () => {
    const url = assetUrl('/data/islands.json');
    expect(url).not.toContain('//data');
    expect(url).toContain('data/islands.json');
  });

  it('handles relative path without leading slash', () => {
    const url = assetUrl('audio/coin.wav');
    expect(url).toContain('audio/coin.wav');
  });
});
