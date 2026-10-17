import { describe, it, expect } from 'vitest';
import { SimulationCore } from './simulation';
import { generateIslandEconomicReport } from './advisory';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from './nav';

import islandsRaw from '../../public/data/islands.json';
import goodsRaw from '../../public/data/goods.json';
import balanceRaw from '../../public/data/balance.json';
import seaLanesRaw from '../../public/data/sea_lanes.json';
import shipsRaw from '../../public/data/ships.json';

const islands = islandsRaw as unknown as IslandData[];
const goods = goodsRaw as unknown as GoodDefinition[];
const balance = balanceRaw as unknown as BalanceConfig;
const seaLanes = seaLanesRaw as unknown as SeaLanesData;
const ships = shipsRaw as unknown as ShipDefinition[];

describe('Economic Advisory Engine (advisory.ts)', () => {
  it('generates comprehensive economic report for an unlocked starting island', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const report = generateIslandEconomicReport('santorini', sim);

    expect(report).not.toBeNull();
    expect(report?.islandId).toBe('santorini');
    expect(report?.islandName).toBe('Santorini');
    expect(report?.isUnlocked).toBe(true);
    expect(report?.prosperityPct).toBeGreaterThan(0);
    expect(report?.importAdvice.length).toBeGreaterThan(0);
    expect(report?.exportAdvice.length).toBeGreaterThan(0);
    expect(report?.actionItems.length).toBeGreaterThan(0);
  });

  it('diagnoses critical supply shortage and identifies best supplier port', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const santoriniEco = sim.islands.get('santorini');
    expect(santoriniEco).toBeDefined();

    // Artificially starve grain on Santorini (which consumes grain)
    if (santoriniEco?.markets['grain']) {
      santoriniEco.markets['grain'].stock = 0;
      santoriniEco.markets['grain'].isStarving = true;
    }

    const report = generateIslandEconomicReport('santorini', sim);
    expect(report).not.toBeNull();
    expect(report?.status).toBe('distressed');

    const grainAdvice = report?.importAdvice.find((a) => a.goodId === 'grain');
    expect(grainAdvice).toBeDefined();
    expect(grainAdvice?.urgency).toBe('critical');
    expect(grainAdvice?.isStarving).toBe(true);
    expect(grainAdvice?.bestSupplier?.islandId).toBe('naxos');
  });

  it('detects capped warehouse surpluses and recommends profitable export destinations', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const santoriniEco = sim.islands.get('santorini');
    expect(santoriniEco).toBeDefined();

    // Cap wine production on Santorini
    if (santoriniEco?.markets['wine']) {
      santoriniEco.markets['wine'].stock = santoriniEco.markets['wine'].maxCapacity;
    }

    const report = generateIslandEconomicReport('santorini', sim);
    expect(report).not.toBeNull();

    const wineAdvice = report?.exportAdvice.find((e) => e.goodId === 'wine');
    expect(wineAdvice).toBeDefined();
    expect(wineAdvice?.isCapped).toBe(true);
    expect(report?.actionItems.some((item) => item.includes('Monetize Surplus') || item.includes('Wine'))).toBe(true);
  });

  it('diagnoses underutilized vessels and recommends operational re-tasking', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);

    // Spawn a boat on Santorini and set it to idle with an impossible priority
    const ship = sim.shipManager!.spawnShip('fishing_boat', 'santorini', sim, 'UnderutilizedTest');
    expect(ship).toBeDefined();
    ship!.state = 'idle';
    ship!.cargoPriority = 'fuel'; // Santorini doesn't produce fuel

    const report = generateIslandEconomicReport('santorini', sim);
    expect(report).not.toBeNull();
    expect(report?.fleetAdvice.underutilizedShips.length).toBeGreaterThan(0);

    const uShip = report?.fleetAdvice.underutilizedShips.find((u) => u.shipId === ship!.id);
    expect(uShip).toBeDefined();
    expect(uShip?.reason).toBe('priority_starvation');
    expect(report?.fleetAdvice.recommendation).toContain('underutilized');
    expect(report?.actionItems.some((item) => item.includes('Fleet Optimization') || item.includes('underutilized'))).toBe(true);
  });

  it('correctly diagnoses economic recovery when imports are abundant and recognizes depleted export produce', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const santoriniEco = sim.islands.get('santorini');
    expect(santoriniEco).toBeDefined();

    // Set Santorini to recovering state: all imports abundant, distress low, prosperity low (15%), Crafts depleted (7 units)
    santoriniEco!.distress = 0.0;
    santoriniEco!.prosperity = 0.15;

    // Buffer all consumed goods (water, grain, olive_oil)
    const santoriniData = sim.islandsData.get('santorini')!;
    for (const cGood of Object.keys(santoriniData.consumes)) {
      if (santoriniEco?.markets[cGood]) {
        santoriniEco.markets[cGood].stock = 90;
        santoriniEco.markets[cGood].isStarving = false;
      }
    }
    // Deplete crafts export
    if (santoriniEco?.markets['crafts']) {
      santoriniEco.markets['crafts'].stock = 7;
    }

    const report = generateIslandEconomicReport('santorini', sim);
    expect(report).not.toBeNull();
    expect(report?.isRecovering).toBe(true);
    expect(report?.statusSummary).toContain('Economic Recovery Active');

    // Verify water advice matches inspector buffer target
    const waterAdvice = report?.importAdvice.find((a) => a.goodId === 'water');
    expect(waterAdvice).toBeDefined();
    expect(waterAdvice?.urgency).toBe('stable');
    expect(waterAdvice?.statusLabel).toBe('Abundant');
    expect(waterAdvice?.bufferTarget).toBe(36);
    expect(waterAdvice?.bufferPct).toBe(250);

    // Verify crafts export is marked as depleted
    const craftsAdvice = report?.exportAdvice.find((e) => e.goodId === 'crafts');
    expect(craftsAdvice).toBeDefined();
    expect(craftsAdvice?.isLow).toBe(true);
    expect(report?.actionItems.some((item) => item.includes('Crafts') && item.includes('Depleted'))).toBe(true);
  });
});
