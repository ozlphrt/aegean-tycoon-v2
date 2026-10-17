import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from './simulation';
import {
  serializeSimulation,
  deserializeSimulation,
  saveToStorage,
  loadFromStorage,
  hasSaveInStorage,
  clearSaveFromStorage,
  type GameSaveV1,
} from './saveLoad';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from './nav';

describe('Save and Load System (saveLoad.ts)', () => {
  const mockIslands = [
    {
      id: 'santorini',
      name: 'Santorini',
      lon: 25.43,
      lat: 36.39,
      elevationM: 567,
      basePopulation: 15500,
      port: { lon: 25.43, lat: 36.38 },
      specialties: ['wine'],
      produces: { wine: 1.5 },
      consumes: { grain: 1.2 },
      unlock: { cost: 0, tp: 0, isStart: true },
    },
    {
      id: 'naxos',
      name: 'Naxos',
      lon: 25.37,
      lat: 37.10,
      elevationM: 1001,
      basePopulation: 18000,
      port: { lon: 25.37, lat: 37.11 },
      specialties: ['grain'],
      produces: { grain: 2.0 },
      consumes: { wine: 0.8 },
      unlock: { cost: 0, tp: 0, isStart: true },
    },
    {
      id: 'paros',
      name: 'Paros',
      lon: 25.15,
      lat: 37.08,
      elevationM: 724,
      basePopulation: 13700,
      port: { lon: 25.15, lat: 37.09 },
      specialties: ['marble'],
      produces: { marble: 1.0 },
      consumes: { grain: 1.0 },
      unlock: { cost: 1200, tp: 50, requiresConnectedTo: ['naxos'] },
    },
  ] as unknown as IslandData[];

  const mockGoods = [
    { id: 'grain', name: 'Grain', basePrice: 20, icon: '🌾' },
    { id: 'wine', name: 'Wine', basePrice: 45, icon: '🍷' },
    { id: 'marble', name: 'Marble', basePrice: 90, icon: '🏛️' },
  ] as unknown as GoodDefinition[];

  const mockBalance = {
    startingTreasury: 5000,
    startingTradePoints: 100,
    secondsPerGameDay: 10,
  } as unknown as BalanceConfig;

  const mockSeaLanes = {
    nodes: [
      { id: 'san_port', name: 'San Port', lon: 25.43, lat: 36.38, islandId: 'santorini' },
      { id: 'nax_port', name: 'Nax Port', lon: 25.37, lat: 37.11, islandId: 'naxos' },
      { id: 'midpoint', name: 'Midpoint', lon: 25.40, lat: 36.75 },
    ],
    edges: [
      { from: 'san_port', to: 'midpoint', distanceKm: 42 },
      { from: 'midpoint', to: 'nax_port', distanceKm: 39 },
    ],
  } as unknown as SeaLanesData;

  const mockShips = [
    {
      id: 'fishing_boat',
      name: 'Kaiki',
      tier: 1,
      cost: 500,
      capacity: 10,
      speed: 8,
      upkeepPerDay: 5,
      unlock: { islandsConnected: 1 },
    },
  ] as unknown as ShipDefinition[];

  // In-memory localStorage mock for node test runner
  const storageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      writable: true,
    });
    storageMock.clear();
  });

  it('serializes simulation state accurately', () => {
    const sim = new SimulationCore(mockIslands, mockGoods, mockBalance, mockSeaLanes, mockShips);
    sim.treasury = 8540;
    sim.tradePoints = 230;
    sim.gameDay = 14.5;
    sim.totalTicks = 145;

    const save = serializeSimulation(sim);

    expect(save.version).toBe(1);
    expect(save.treasury).toBe(8540);
    expect(save.tradePoints).toBe(230);
    expect(save.gameDay).toBe(14.5);
    expect(save.unlockedIslands).toContain('santorini');
    expect(save.unlockedIslands).toContain('naxos');
    expect(save.unlockedIslands).not.toContain('paros');
    expect(save.ships.length).toBe(2); // Starting initial fleet
    expect(save.islands['santorini'].markets['wine']).toBeDefined();
  });

  it('deserializes and fully restores simulation state', () => {
    const sim1 = new SimulationCore(mockIslands, mockGoods, mockBalance, mockSeaLanes, mockShips);
    sim1.treasury = 12400;
    sim1.tradePoints = 450;
    sim1.gameDay = 35.2;
    sim1.unlockedIslands.add('paros');
    const parosEconomy = sim1.islands.get('paros')!;
    parosEconomy.unlocked = true;
    parosEconomy.prosperity = 0.88;

    const save = serializeSimulation(sim1);

    // Create a fresh clean simulation instance
    const sim2 = new SimulationCore(mockIslands, mockGoods, mockBalance, mockSeaLanes, mockShips);
    expect(sim2.unlockedIslands.has('paros')).toBe(false);
    expect(sim2.treasury).toBe(5000);

    const success = deserializeSimulation(sim2, save);
    expect(success).toBe(true);

    expect(sim2.treasury).toBe(12400);
    expect(sim2.tradePoints).toBe(450);
    expect(sim2.gameDay).toBe(35.2);
    expect(sim2.unlockedIslands.has('paros')).toBe(true);
    expect(sim2.islands.get('paros')!.prosperity).toBe(0.88);
    expect(sim2.shipManager?.ships.size).toBe(2);
  });

  it('handles localStorage save, load, and clear lifecycle', () => {
    const sim = new SimulationCore(mockIslands, mockGoods, mockBalance, mockSeaLanes, mockShips);
    sim.treasury = 9999;

    expect(hasSaveInStorage('test_save')).toBe(false);

    const saved = saveToStorage(sim, 'test_save');
    expect(saved).toBe(true);
    expect(hasSaveInStorage('test_save')).toBe(true);

    // Modify sim
    sim.treasury = 100;
    expect(sim.treasury).toBe(100);

    // Restore from storage
    const loaded = loadFromStorage(sim, 'test_save');
    expect(loaded).toBe(true);
    expect(sim.treasury).toBe(9999);

    clearSaveFromStorage('test_save');
    expect(hasSaveInStorage('test_save')).toBe(false);
  });

  it('rejects incompatible save versions gracefully', () => {
    const sim = new SimulationCore(mockIslands, mockGoods, mockBalance, mockSeaLanes, mockShips);
    const corruptedSave = { version: 99 } as unknown as GameSaveV1;

    const ok = deserializeSimulation(sim, corruptedSave);
    expect(ok).toBe(false);
  });
});
