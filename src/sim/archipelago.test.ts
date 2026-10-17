import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from './simulation';
import { getArchipelagoDirectory } from './archipelago';
import type { IslandData, GoodDefinition, BalanceConfig } from '../data/types';

describe('Archipelago Directory & Island Intelligence (archipelago.ts)', () => {
  const sampleGoods: GoodDefinition[] = [
    {
      id: 'grain',
      name: 'Staple Grain',
      basePrice: 15,
      volume: 1,
      perishable: false,
      icon: 'grain',
      color: '#fde047',
      description: 'Grain',
    },
    {
      id: 'fuel',
      name: 'Maritime Fuel',
      basePrice: 50,
      volume: 1,
      perishable: false,
      icon: 'fuel',
      color: '#f97316',
      description: 'Fuel',
    },
    {
      id: 'wine',
      name: 'Volcanic Wine',
      basePrice: 30,
      volume: 1,
      perishable: false,
      icon: 'wine',
      color: '#f43f5e',
      description: 'Wine',
    },
  ];

  const sampleBalance: BalanceConfig = {
    tickRateHz: 20,
    secondsPerGameDay: 1.0,
    priceElasticity: 0.5,
    minPriceMultiplier: 0.5,
    maxPriceMultiplier: 2.0,
    targetBufferDays: 5,
    storageCapacityFactor: 10,
    minStorageCapacity: 50,
    perishableDecayPerDay: 0.05,
    distressThreshold: 0.2,
    distressGrowthRate: 0.01,
    prosperitySurplusRatio: 1.5,
    prosperityGrowthRate: 0.01,
    startingTreasury: 2500,
    startingTradePoints: 50,
    startingGameDate: '2026-05-01T00:00:00Z',
  };

  const sampleIslands: IslandData[] = [
    {
      id: 'santorini',
      name: 'Santorini',
      type: 'island',
      region: 'cyclades',
      lat: 36.39,
      lon: 25.46,
      port: { lat: 36.386, lon: 25.431 },
      population: 15500,
      produces: { wine: 9 },
      consumes: { grain: 5 },
      unlock: { cost: 0, tp: 0, isStart: true },
      country: 'Greece',
      maskId: 1,
    },
    {
      id: 'naxos',
      name: 'Naxos',
      type: 'island',
      region: 'cyclades',
      lat: 37.1,
      lon: 25.37,
      port: { lat: 37.106, lon: 25.372 },
      population: 19000,
      produces: { grain: 14 },
      consumes: { wine: 4 },
      unlock: { cost: 0, tp: 0, isStart: true },
      country: 'Greece',
      maskId: 2,
    },
    {
      id: 'rhodes',
      name: 'Rhodes',
      type: 'island',
      region: 'dodecanese',
      lat: 36.44,
      lon: 28.22,
      port: { lat: 36.444, lon: 28.228 },
      population: 115000,
      produces: { wine: 14 },
      consumes: { fuel: 14, grain: 12 },
      unlock: { cost: 1200, tp: 25, isStart: false, requiresConnectedTo: ['kos', 'santorini'] },
      country: 'Greece',
      maskId: 3,
    },
    {
      id: 'crete',
      name: 'Crete (Heraklion)',
      type: 'island',
      region: 'crete',
      lat: 35.34,
      lon: 25.14,
      port: { lat: 35.341, lon: 25.142 },
      population: 175000,
      produces: { grain: 28 },
      consumes: { fuel: 20 },
      unlock: { cost: 3500, tp: 80, isStart: false, requiresConnectedTo: ['santorini'] },
      country: 'Greece',
      maskId: 4,
    },
  ];

  let sim: SimulationCore;

  beforeEach(() => {
    sim = new SimulationCore(sampleIslands, sampleGoods, sampleBalance);
  });

  it('aggregates archipelago population and counts correctly', () => {
    const summary = getArchipelagoDirectory(sim);

    expect(summary.totalIslands).toBe(4);
    expect(summary.awakeCount).toBe(2); // Santorini & Naxos are start
    expect(summary.sleepingCount).toBe(2); // Rhodes & Crete
    expect(summary.totalPopulation).toBe(15500 + 19000 + 115000 + 175000);
    expect(summary.awakePopulation).toBe(15500 + 19000);
    expect(summary.awakePopulationPct).toBeCloseTo(10.6, 1);
  });

  it('identifies highest population island and highest economic opportunity', () => {
    const summary = getArchipelagoDirectory(sim);

    expect(summary.highestPopIsland?.id).toBe('crete');
    expect(summary.highestPopIsland?.population).toBe(175000);

    // Both Crete and Rhodes have massive populations and high trade flows
    expect(summary.highestOpportunityIsland).toBeDefined();
    expect(summary.highestOpportunityIsland?.population).toBeGreaterThan(100000);
  });

  it('correctly determines awakening status and prerequisites', () => {
    const summary = getArchipelagoDirectory(sim);
    const rhodes = summary.islands.find((i) => i.id === 'rhodes');
    const crete = summary.islands.find((i) => i.id === 'crete');

    expect(rhodes).toBeDefined();
    expect(rhodes?.isAwake).toBe(false);
    // Rhodes requires kos or santorini. Santorini IS awake!
    expect(rhodes?.hasMaritimeConnection).toBe(true);
    // Player has 2500 treasury and 50 TP; Rhodes costs 1200 & 25 TP -> can awaken!
    expect(rhodes?.canAwakenNow).toBe(true);

    expect(crete).toBeDefined();
    expect(crete?.isAwake).toBe(false);
    expect(crete?.hasMaritimeConnection).toBe(true); // requires santorini (awake)
    // Crete costs 3500 (player has 2500) -> cannot afford
    expect(crete?.canAwakenNow).toBe(false);
  });
});
