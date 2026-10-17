import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFirstTimeUser,
  isPreviewCompleted,
  startPreviewSession,
  getPreviewRemainingSeconds,
  completePreviewSession,
  resetSimulationToCleanSlate,
  PREVIEW_COMPLETED_KEY,
  PREVIEW_START_TIME_KEY,
} from './previewManager';
import { SimulationCore } from './simulation';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from './nav';

describe('Preview Manager (previewManager.ts)', () => {
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

  const mockIslands = [
    {
      id: 'santorini',
      name: 'Santorini',
      lon: 25.43,
      lat: 36.39,
      produces: { wine: 2.0 },
      consumes: {},
      unlock: { isStart: true },
    },
    {
      id: 'naxos',
      name: 'Naxos',
      lon: 25.37,
      lat: 37.1,
      produces: {},
      consumes: { wine: 1.5 },
      unlock: { isStart: true },
    },
    {
      id: 'samos',
      name: 'Samos',
      lon: 26.97,
      lat: 37.75,
      produces: {},
      consumes: {},
      unlock: { cost: 1200 },
    },
  ] as unknown as IslandData[];

  const mockGoods = [{ id: 'wine', name: 'Wine', basePrice: 40 }] as unknown as GoodDefinition[];
  const mockBalance = {
    startingTreasury: 120,
    startingTradePoints: 0,
    secondsPerGameDay: 12,
  } as unknown as BalanceConfig;
  const mockShips = [
    { id: 'fishing_boat', name: 'Boat', tier: 1, capacity: 25, speed: 6.8 },
  ] as unknown as ShipDefinition[];
  const mockSeaLanes: SeaLanesData = { nodes: [], edges: [] };

  it('detects a first-time user when no save exists and preview is incomplete', () => {
    expect(isFirstTimeUser()).toBe(true);
    expect(isPreviewCompleted()).toBe(false);
  });

  it('tracks remaining time from preview start', () => {
    expect(getPreviewRemainingSeconds()).toBe(300);
    startPreviewSession();
    expect(storageMock.getItem(PREVIEW_START_TIME_KEY)).toBeDefined();

    // Fast-forward 10 seconds
    const now = Date.now();
    storageMock.setItem(PREVIEW_START_TIME_KEY, (now - 10000).toString());
    const remaining = getPreviewRemainingSeconds();
    expect(remaining).toBeLessThanOrEqual(290);
    expect(remaining).toBeGreaterThanOrEqual(289);
  });

  it('marks preview completed and removes start time', () => {
    startPreviewSession();
    completePreviewSession();
    expect(isPreviewCompleted()).toBe(true);
    expect(isFirstTimeUser()).toBe(false);
    expect(storageMock.getItem(PREVIEW_START_TIME_KEY)).toBeNull();
  });

  it('resets a simulation with active fleet and mid-game economy back to day 1 clean slate', () => {
    const sim = new SimulationCore(mockIslands, mockGoods, mockBalance, mockSeaLanes, mockShips);

    // Simulate mid-game flourishing state
    sim.treasury = 45000;
    sim.tradePoints = 1200;
    sim.gameDay = 55.4;
    sim.unlockedIslands.add('samos');

    expect(sim.unlockedIslands.has('samos')).toBe(true);
    expect(sim.treasury).toBe(45000);

    const ok = resetSimulationToCleanSlate(sim);
    expect(ok).toBe(true);

    // Verify day 1 zero state
    expect(sim.gameDay).toBe(1.0);
    expect(sim.treasury).toBe(120);
    expect(sim.tradePoints).toBe(0);
    expect(sim.unlockedIslands.has('samos')).toBe(false);
    expect(sim.unlockedIslands.has('santorini')).toBe(true);
    expect(sim.unlockedIslands.has('naxos')).toBe(true);

    // Verify fleet reset to 2 starter boats
    expect(sim.shipManager?.ships.size).toBe(2);
    const shipNames = Array.from(sim.shipManager?.ships.values() || []).map((s) => s.name);
    expect(shipNames).toContain('Nikolaos');
    expect(shipNames).toContain('Delphis');

    // Verify preview completed in localStorage
    expect(storageMock.getItem(PREVIEW_COMPLETED_KEY)).toBe('true');
  });
});
