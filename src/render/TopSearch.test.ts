import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from '../sim/simulation';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from '../sim/nav';
import { searchArchipelagoAndFleet } from './TopSearch';

import islandsRaw from '../../public/data/islands.json';
import goodsRaw from '../../public/data/goods.json';
import balanceRaw from '../../public/data/balance.json';
import seaLanesRaw from '../../public/data/sea_lanes.json';
import shipsRaw from '../../public/data/ships.json';

describe('Top Search Island & Vessel System (searchArchipelagoAndFleet)', () => {
  const islands = islandsRaw as unknown as IslandData[];
  const goods = goodsRaw as unknown as GoodDefinition[];
  const balance = balanceRaw as unknown as BalanceConfig;
  const seaLanes = seaLanesRaw as unknown as SeaLanesData;
  const ships = shipsRaw as unknown as ShipDefinition[];

  let sim: SimulationCore;

  beforeEach(() => {
    sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
  });

  it('searches islands by exact and substring name matches', () => {
    const results = searchArchipelagoAndFleet(sim, 'Santorini');
    expect(results.islands.length).toBeGreaterThan(0);
    expect(results.islands[0].island.name).toBe('Santorini');
    expect(results.islands[0].island.region).toBe('cyclades');

    // Partial search
    const naxosRes = searchArchipelagoAndFleet(sim, 'nax');
    expect(naxosRes.islands.some(i => i.island.name.toLowerCase().includes('naxos'))).toBe(true);
  });

  it('searches islands by region or produced commodity', () => {
    const dmc = searchArchipelagoAndFleet(sim, 'cyclades');
    expect(dmc.islands.length).toBeGreaterThan(5);

    // Commodity query (e.g. wine, olives, marble)
    const wineRes = searchArchipelagoAndFleet(sim, 'wine');
    expect(wineRes.islands.length).toBeGreaterThan(0);
  });

  it('searches active fleet vessels by custom name, ship type, and home port', () => {
    // Spawn custom named ship
    sim.shipManager?.spawnShip('ferry', 'santorini', sim, 'Sirena');

    const byName = searchArchipelagoAndFleet(sim, 'Sirena');
    expect(byName.vessels.length).toBe(1);
    expect(byName.vessels[0].ship.name).toBe('Sirena');
    expect(byName.vessels[0].homeName).toBe('Santorini');

    // By ship type
    const byType = searchArchipelagoAndFleet(sim, 'ferry');
    expect(byType.vessels.some(v => v.ship.typeId === 'ferry')).toBe(true);

    // By home port
    const byPort = searchArchipelagoAndFleet(sim, 'santorini');
    expect(byPort.vessels.some(v => v.homeName === 'Santorini')).toBe(true);
  });

  it('respects filter tabs for all, islands only, and vessels only', () => {
    sim.shipManager?.spawnShip('fishing_boat', 'naxos', sim, 'Aegean Arrow');

    const all = searchArchipelagoAndFleet(sim, 'naxos', 'all');
    expect(all.items.some(i => i.type === 'island')).toBe(true);
    expect(all.items.some(i => i.type === 'vessel')).toBe(true);

    const islandsOnly = searchArchipelagoAndFleet(sim, 'naxos', 'islands');
    expect(islandsOnly.items.every(i => i.type === 'island')).toBe(true);

    const vesselsOnly = searchArchipelagoAndFleet(sim, 'naxos', 'vessels');
    expect(vesselsOnly.items.every(i => i.type === 'vessel')).toBe(true);
  });

  it('returns default ranked items when query is empty', () => {
    const emptyQuery = searchArchipelagoAndFleet(sim, '');
    expect(emptyQuery.islands.length).toBe(islands.length);
    // Lit islands first
    expect(emptyQuery.islands[0].isLit).toBe(true);
  });
});
