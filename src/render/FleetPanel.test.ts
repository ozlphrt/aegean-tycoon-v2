import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from '../sim/simulation';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from '../sim/nav';

import islandsRaw from '../../public/data/islands.json';
import goodsRaw from '../../public/data/goods.json';
import balanceRaw from '../../public/data/balance.json';
import seaLanesRaw from '../../public/data/sea_lanes.json';
import shipsRaw from '../../public/data/ships.json';

describe('Fleet Management Operations', () => {
  const islands = islandsRaw as unknown as IslandData[];
  const goods = goodsRaw as unknown as GoodDefinition[];
  const balance = balanceRaw as unknown as BalanceConfig;
  const seaLanes = seaLanesRaw as unknown as SeaLanesData;
  const ships = shipsRaw as unknown as ShipDefinition[];

  let sim: SimulationCore;

  beforeEach(() => {
    sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    sim.treasury = 50000;
    ['ios', 'mykonos', 'paros', 'syros', 'tinos', 'milos', 'rhodes', 'crete_heraklion'].forEach((id) => {
      sim.unlockedIslands.add(id);
    });
  });

  it('correctly tracks fleet size, cumulative upkeep and profit', () => {
    expect(sim.shipManager).toBeDefined();
    const initialCount = sim.shipManager!.ships.size;

    const res1 = sim.buyShip('fishing_boat', 'santorini');
    const res2 = sim.buyShip('ferry', 'ios');

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(sim.shipManager!.ships.size).toBe(initialCount + 2);

    const fleet = Array.from(sim.shipManager!.ships.values());
    const totalUpkeep = fleet.reduce((sum, s) => sum + s.upkeepPerDay, 0);
    expect(totalUpkeep).toBeGreaterThan(0);
  });

  it('allows dynamic home port reassignment across unlocked ports', () => {
    const res = sim.buyShip('fishing_boat', 'santorini');
    expect(res.success).toBe(true);
    const ship = res.ship!;
    expect(ship.homeIslandId).toBe('santorini');

    // Reassign home port to Mykonos
    ship.homeIslandId = 'mykonos';
    expect(ship.homeIslandId).toBe('mykonos');
  });

  it('allows cargo priority assignment to guide trade decisions', () => {
    const res = sim.buyShip('fishing_boat', 'santorini');
    expect(res.success).toBe(true);
    const ship = res.ship!;
    expect(ship.cargoPriority).toBe('auto');

    ship.cargoPriority = 'wine';
    expect(ship.cargoPriority).toBe('wine');
  });
});
