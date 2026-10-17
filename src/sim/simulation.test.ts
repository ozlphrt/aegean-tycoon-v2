import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from './simulation';
import type { IslandData, GoodDefinition, BalanceConfig } from '../data/types';

const MOCK_GOODS: GoodDefinition[] = [
  {
    id: 'wine',
    name: 'Volcanic Wine',
    basePrice: 40,
    volume: 1,
    perishable: false,
    icon: '🍷',
    color: '#f43f5e',
    description: 'Wine',
  },
  {
    id: 'grain',
    name: 'Grain',
    basePrice: 15,
    volume: 2,
    perishable: false,
    icon: '🌾',
    color: '#fde047',
    description: 'Grain',
  },
  {
    id: 'fish',
    name: 'Fresh Fish',
    basePrice: 12,
    volume: 1,
    perishable: true,
    icon: '🐟',
    color: '#38bdf8',
    description: 'Fish',
  },
];

const MOCK_ISLANDS: IslandData[] = [
  {
    id: 'santorini',
    name: 'Santorini',
    maskId: 1,
    type: 'island',
    country: 'Greece',
    region: 'cyclades',
    lat: 36.39,
    lon: 25.46,
    population: 15500,
    port: { lat: 36.386, lon: 25.431 },
    produces: { wine: 9 },
    consumes: { grain: 5, fish: 3 },
    unlock: { isStart: true, cost: 0, tp: 0 },
  },
  {
    id: 'naxos',
    name: 'Naxos',
    maskId: 2,
    type: 'island',
    country: 'Greece',
    region: 'cyclades',
    lat: 37.10,
    lon: 25.38,
    population: 19000,
    port: { lat: 37.105, lon: 25.373 },
    produces: { grain: 10, fish: 5 },
    consumes: { wine: 4 },
    unlock: { isStart: true, cost: 0, tp: 0 },
  },
  {
    id: 'paros',
    name: 'Paros',
    maskId: 3,
    type: 'island',
    country: 'Greece',
    region: 'cyclades',
    lat: 37.08,
    lon: 25.15,
    population: 14000,
    port: { lat: 37.085, lon: 25.148 },
    produces: { fish: 4 },
    consumes: { wine: 3, grain: 4 },
    unlock: { isStart: false, cost: 150, tp: 10, requiresConnectedTo: ['naxos'] },
  },
];

const MOCK_BALANCE: BalanceConfig = {
  tickRateHz: 10,
  secondsPerGameDay: 24,
  priceElasticity: 0.7,
  minPriceMultiplier: 0.35,
  maxPriceMultiplier: 2.85,
  targetBufferDays: 5.0,
  storageCapacityFactor: 10.0,
  minStorageCapacity: 100,
  perishableDecayPerDay: 0.05,
  distressThreshold: 0.15,
  distressGrowthRate: 0.10,
  prosperitySurplusRatio: 1.25,
  prosperityGrowthRate: 0.05,
  startingTreasury: 500,
  startingTradePoints: 0,
  startingGameDate: '2026-05-01',
};

describe('SimulationCore (M4 Sim Core)', () => {
  let sim: SimulationCore;

  beforeEach(() => {
    sim = new SimulationCore(MOCK_ISLANDS, MOCK_GOODS, MOCK_BALANCE);
  });

  it('initializes islands and marks starting islands unlocked', () => {
    expect(sim.unlockedIslands.has('santorini')).toBe(true);
    expect(sim.unlockedIslands.has('naxos')).toBe(true);
    expect(sim.unlockedIslands.has('paros')).toBe(false);
    expect(sim.treasury).toBe(500);
    expect(sim.tradePoints).toBe(0);
  });

  it('adjusts prices based on supply and demand: producers have cheaper goods, consumers pay premium', () => {
    const santorini = sim.islands.get('santorini')!;
    const naxos = sim.islands.get('naxos')!;

    // Santorini produces wine -> wine is abundant -> lower price
    // Naxos consumes wine -> wine is scarce -> higher price
    const santoriniWinePrice = santorini.markets.wine.buyPrice;
    const naxosWinePrice = naxos.markets.wine.buyPrice;

    expect(santoriniWinePrice).toBeLessThan(naxosWinePrice);

    // Conversely, Naxos produces grain -> grain is cheaper in Naxos
    const naxosGrainPrice = naxos.markets.grain.buyPrice;
    const santoriniGrainPrice = santorini.markets.grain.buyPrice;

    expect(naxosGrainPrice).toBeLessThan(santoriniGrainPrice);
  });

  it('tracks inventory production and consumption over game days', () => {
    const santorini = sim.islands.get('santorini')!;
    const initialWine = santorini.markets.wine.stock;
    const initialGrain = santorini.markets.grain.stock;

    // Simulate 2 game days
    sim.step(2.0);

    // Wine should have grown (produces 9/day)
    expect(santorini.markets.wine.stock).toBeGreaterThan(initialWine);
    // Grain should have decreased (consumes 5/day)
    expect(santorini.markets.grain.stock).toBeLessThan(initialGrain);
  });

  it('price responds dynamically to scarcity: draining stock drives price up to max ceiling', () => {
    const naxos = sim.islands.get('naxos')!;
    const baseGrainPrice = sim.goodsData.get('grain')!.basePrice; // 15
    const initialPrice = naxos.markets.grain.buyPrice;

    // Manually buy out stock to induce artificial famine
    sim.buyFromIsland('naxos', 'grain', 500);
    sim.step(0.5);

    const scarcePrice = naxos.markets.grain.buyPrice;
    expect(scarcePrice).toBeGreaterThan(initialPrice);
    // Must respect max multiplier
    expect(scarcePrice).toBeLessThanOrEqual(baseGrainPrice * MOCK_BALANCE.maxPriceMultiplier);
  });

  it('allows buying and selling goods with treasury and TP rewards', () => {
    const naxos = sim.islands.get('naxos')!;
    const initialStock = naxos.markets.wine.stock;

    // Sell 20 units of wine to Naxos
    const sellRes = sim.sellToIsland('naxos', 'wine', 20);
    expect(sellRes.success).toBe(true);
    expect(sellRes.actualQty).toBe(20);
    expect(sellRes.totalRevenue).toBeGreaterThan(0);
    expect(naxos.markets.wine.stock).toBe(initialStock + 20);
    // Deliveries award Trade Points (TP)
    expect(sim.tradePoints).toBeGreaterThan(0);
  });

  it('enforces island unlock prerequisites, cost, and TP checks', () => {
    // Paros requires 150 gold and 10 TP, plus connection to Naxos
    // Initial TP is 0 -> should fail
    const failRes = sim.unlockIsland('paros');
    expect(failRes.success).toBe(false);
    expect(failRes.reason).toContain('TP');

    // Grant player needed TP
    sim.tradePoints = 25;
    const successRes = sim.unlockIsland('paros');
    expect(successRes.success).toBe(true);
    expect(sim.unlockedIslands.has('paros')).toBe(true);
    expect(sim.treasury).toBe(500 - 150);
    expect(sim.tradePoints).toBe(25 - 10);
  });

  it('runs headless soak test of 10,000 ticks without NaN or negative stocks', () => {
    // 10,000 ticks at 0.1 days/tick = 1,000 game days (~2.7 years)
    const soak = sim.soakTest(10000, 0.1);
    expect(soak.ok).toBe(true);
    expect(soak.errors).toHaveLength(0);
    expect(sim.gameDay).toBeCloseTo(1000, 0);

    // Verify all islands have valid numeric metrics
    for (const isl of sim.islands.values()) {
      expect(isl.prosperity).toBeGreaterThanOrEqual(0);
      expect(isl.prosperity).toBeLessThanOrEqual(1);
      expect(isl.distress).toBeGreaterThanOrEqual(0);
      expect(isl.distress).toBeLessThanOrEqual(1);

      for (const m of Object.values(isl.markets)) {
        expect(m.stock).toBeGreaterThanOrEqual(0);
        expect(m.stock).toBeLessThanOrEqual(m.maxCapacity);
        expect(m.buyPrice).toBeGreaterThan(0);
        expect(m.sellPrice).toBeGreaterThan(0);
        expect(Number.isNaN(m.buyPrice)).toBe(false);
      }
    }
  });
});
