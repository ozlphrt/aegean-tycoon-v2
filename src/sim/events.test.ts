import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from './simulation';
import { IslandEventManager } from './events';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from './nav';

import islandsRaw from '../../public/data/islands.json';
import goodsRaw from '../../public/data/goods.json';
import balanceRaw from '../../public/data/balance.json';
import seaLanesRaw from '../../public/data/sea_lanes.json';
import shipsRaw from '../../public/data/ships.json';

describe('Island Festivals & Market Booms (events.ts)', () => {
  const islands = islandsRaw as unknown as IslandData[];
  const goods = goodsRaw as unknown as GoodDefinition[];
  const balance = balanceRaw as unknown as BalanceConfig;
  const seaLanes = seaLanesRaw as unknown as SeaLanesData;
  const ships = shipsRaw as unknown as ShipDefinition[];

  let sim: SimulationCore;
  let eventMgr: IslandEventManager;

  beforeEach(() => {
    sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    eventMgr = sim.eventManager;
    eventMgr.autoSpawn = false;
  });

  it('triggers Panigiri festival on an island with demand and price surges', () => {
    const evt = eventMgr.triggerEvent('panigiri', 'naxos', sim, 5.0);
    expect(evt).not.toBeNull();
    expect(evt?.islandId).toBe('naxos');
    expect(evt?.type).toBe('panigiri');
    expect(evt?.priceMultiplier).toBeGreaterThan(1.5);
    expect(evt?.demandMultiplier).toBeGreaterThan(1.5);
    expect(evt?.affectedGoods).toContain('wine');
    expect(evt?.affectedGoods).toContain('cheese');

    // Check multipliers for wine
    const wineMultipliers = eventMgr.getMultipliers('naxos', 'wine');
    expect(wineMultipliers.priceMultiplier).toBe(evt?.priceMultiplier);
    expect(wineMultipliers.demandMultiplier).toBe(evt?.demandMultiplier);
    expect(wineMultipliers.activeEvent).toBeDefined();

    // Check unaffected good (e.g. marble) returns neutral 1.0
    const marbleMultipliers = eventMgr.getMultipliers('naxos', 'marble');
    expect(marbleMultipliers.priceMultiplier).toBe(1.0);
    expect(marbleMultipliers.demandMultiplier).toBe(1.0);
  });

  it('triggers olive harvest boom with surplus supply and discounted prices', () => {
    const evt = eventMgr.triggerEvent('olive_harvest', 'crete_heraklion', sim, 6.0);
    expect(evt).not.toBeNull();
    expect(evt?.priceMultiplier).toBeLessThan(0.70); // Deep purchase discount
    expect(evt?.supplyMultiplier).toBeGreaterThan(2.0); // Bumper harvest output

    const oliveMultipliers = eventMgr.getMultipliers('crete_heraklion', 'olive_oil');
    expect(oliveMultipliers.priceMultiplier).toBe(evt?.priceMultiplier);
    expect(oliveMultipliers.supplyMultiplier).toBe(evt?.supplyMultiplier);
  });

  it('cleans up and expires active events when duration elapses', () => {
    let completedEventId: string | null = null;
    eventMgr.onEventEnd((e) => {
      completedEventId = e.id;
    });

    const evt = eventMgr.triggerEvent('panigiri', 'santorini', sim, 3.0);
    expect(eventMgr.activeEvents.has('santorini')).toBe(true);

    // Advance 2 days - event still active
    sim.step(2.0);
    expect(eventMgr.activeEvents.has('santorini')).toBe(true);
    expect(completedEventId).toBeNull();

    // Advance 2 more days - total 4 days > 3 days duration -> expires
    sim.step(2.0);
    expect(eventMgr.activeEvents.has('santorini')).toBe(false);
    expect(completedEventId).toBe(evt?.id);
  });
});
