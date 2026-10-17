import { describe, it, expect } from 'vitest';
import { SimulationCore } from './simulation';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from './nav';

import islandsRaw from '../../public/data/islands.json';
import goodsRaw from '../../public/data/goods.json';
import balanceRaw from '../../public/data/balance.json';
import seaLanesRaw from '../../public/data/sea_lanes.json';
import shipsRaw from '../../public/data/ships.json';

describe('Milestone 8 Scale Pass: 60+ Nodes & 200+ Ships', () => {
  const islands = islandsRaw as unknown as IslandData[];
  const goods = goodsRaw as unknown as GoodDefinition[];
  const balance = balanceRaw as unknown as BalanceConfig;
  const seaLanes = seaLanesRaw as unknown as SeaLanesData;
  const ships = shipsRaw as unknown as ShipDefinition[];

  it('contains full roster data exceeding 60 island and mainland nodes', () => {
    expect(islands.length).toBeGreaterThanOrEqual(60);
    expect(seaLanes.nodes.length).toBeGreaterThanOrEqual(160);

    // Verify all 63 nodes have valid coordinates and ports
    for (const isl of islands) {
      expect(isl.id).toBeDefined();
      expect(isl.port.lat).toBeGreaterThan(34);
      expect(isl.port.lat).toBeLessThan(42);
      expect(isl.port.lon).toBeGreaterThan(22);
      expect(isl.port.lon).toBeLessThan(30);
    }
  });

  it('scales headless simulation to 200+ autonomous ships across 50+ unlocked islands with high throughput', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);

    // Unlock 50+ islands
    for (const isl of islands.slice(0, 52)) {
      sim.unlockedIslands.add(isl.id);
      const eco = sim.islands.get(isl.id);
      if (eco) eco.unlocked = true;
    }
    expect(sim.unlockedIslands.size).toBeGreaterThanOrEqual(50);

    // Spawn 200+ ships across the unlocked islands
    const unlockedList = Array.from(sim.unlockedIslands);
    const shipTiers = ['fishing_boat', 'caique', 'ferry', 'cargo_ship', 'charter_yacht'];

    for (let i = 0; i < 205; i++) {
      const homeIslandId = unlockedList[i % unlockedList.length];
      const typeId = shipTiers[i % shipTiers.length];
      const spawned = sim.shipManager!.spawnShip(typeId, homeIslandId, sim, `Fleet Vessel #${i + 1}`);
      expect(spawned).toBeDefined();
    }

    // Verify total fleet count exceeds 200
    expect(sim.shipManager!.ships.size).toBeGreaterThanOrEqual(205);

    let deliveryCount = 0;
    sim.onShipDelivery(() => {
      deliveryCount++;
    });

    // Step simulation across 10 game days
    const startTime = performance.now();
    const daysToSimulate = 10.0;
    const stepSize = 0.05;
    const steps = Math.ceil(daysToSimulate / stepSize);

    for (let s = 0; s < steps; s++) {
      sim.step(stepSize);
    }
    const elapsedMs = performance.now() - startTime;

    // Simulation of 200 steps with 205 ships must complete well within performance budget (< 8000ms headless soak)
    expect(elapsedMs).toBeLessThan(8000);

    // Verify deliveries happened actively
    expect(deliveryCount).toBeGreaterThan(20);

    // Verify no NaN or corrupt values across all 205 ships
    for (const ship of sim.shipManager!.ships.values()) {
      expect(Number.isFinite(ship.position.lon)).toBe(true);
      expect(Number.isFinite(ship.position.lat)).toBe(true);
      expect(Number.isFinite(ship.heading)).toBe(true);
      expect(Number.isFinite(ship.distanceTraveledKm)).toBe(true);
    }

    // Verify no NaN values in island economic markets
    for (const eco of sim.islands.values()) {
      expect(Number.isFinite(eco.prosperity)).toBe(true);
      expect(Number.isFinite(eco.distress)).toBe(true);
      for (const m of Object.values(eco.markets)) {
        expect(Number.isFinite(m.stock)).toBe(true);
        expect(Number.isFinite(m.buyPrice)).toBe(true);
        expect(Number.isFinite(m.sellPrice)).toBe(true);
      }
    }
  });
});
