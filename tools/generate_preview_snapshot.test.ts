import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SimulationCore } from '../src/sim/simulation';
import { serializeSimulation, type GameSaveV1 } from '../src/sim/saveLoad';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../src/data/types';
import type { SeaLanesData } from '../src/sim/nav';

describe('Generate Preview Snapshot', () => {
  it('generates a rich, active Aegean Tycoon preview snapshot', () => {
    const islandsData: IslandData[] = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/data/islands.json'), 'utf-8')
    );
    const goodsData: GoodDefinition[] = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/data/goods.json'), 'utf-8')
    );
    const balanceConfig: BalanceConfig = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/data/balance.json'), 'utf-8')
    );
    const seaLanesData: SeaLanesData = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/data/sea_lanes.json'), 'utf-8')
    );
    const shipsData: ShipDefinition[] = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/data/ships.json'), 'utf-8')
    );

    const sim = new SimulationCore(islandsData, goodsData, balanceConfig, seaLanesData, shipsData);

    // 1. Set rich mid-game timeline & treasury
    sim.gameDay = 42.5;
    sim.totalTicks = 2550;
    sim.treasury = 25420;
    sim.tradePoints = 850;

    // 2. Unlock thriving network of Aegean island ports
    const awakenedIslandIds = [
      'santorini',
      'naxos',
      'paros',
      'syros',
      'mykonos',
      'andros',
      'samos',
      'chios',
      'izmir',
      'samothrace',
      'rhodes',
      'kos',
      'delos',
      'tinos',
      'milos',
    ];

    for (const id of awakenedIslandIds) {
      sim.unlockedIslands.add(id);
      const economy = sim.islands.get(id);
      if (economy) {
        economy.unlocked = true;
        economy.prosperity = 75 + Math.floor(Math.random() * 20);
        economy.distress = 0;
        // Seed healthy stockpiles
        for (const [goodId, market] of Object.entries(economy.markets)) {
          if (market.produceRatePerDay && market.produceRatePerDay > 0) {
            market.stock = Math.floor(market.produceRatePerDay * 12);
          } else if (market.consumeRatePerDay && market.consumeRatePerDay > 0) {
            market.stock = Math.floor(market.consumeRatePerDay * 6);
          }
        }
      }
    }

    // Specific tweaks to match user's Samos & exporting ports screenshot:
    // Samos needs water
    const samosEcon = sim.islands.get('samos');
    if (samosEcon && samosEcon.markets['water']) {
      samosEcon.markets['water'].stock = 14;
    }
    // Andros water output
    const androsEcon = sim.islands.get('andros');
    if (androsEcon && androsEcon.markets['water']) {
      androsEcon.markets['water'].stock = 25;
      androsEcon.markets['water'].buyPrice = 6.9;
    }

    // 3. Clear initial boats and spawn dedicated active fleet
    if (sim.shipManager) {
      sim.shipManager.clearAllShips();

      // Boreas (Ferry) - sailing from Samos to Izmir with 73 fish, prioritizing fresh water
      const boreas = sim.shipManager.spawnShip('ferry', 'samos', sim, 'Boreas');
      if (boreas) {
        boreas.cargoPriority = 'water';
        boreas.cargo = { goodId: 'fish', quantity: 73, buyPrice: 18 };
        sim.redirectShip(boreas.id, 'izmir', 'water');
      }

      // Calypso (Ferry) - at Samos harbor, idle / ready, prioritizing fresh water
      const calypso = sim.shipManager.spawnShip('ferry', 'samos', sim, 'Calypso');
      if (calypso) {
        calypso.cargoPriority = 'water';
        calypso.state = 'idle';
        calypso.currentIslandId = 'samos';
      }

      // Nikolaos (Fishing Boat) - trading between Santorini & Naxos
      const nikolaos = sim.shipManager.spawnShip('fishing_boat', 'santorini', sim, 'Nikolaos');
      if (nikolaos) {
        nikolaos.cargo = { goodId: 'wine', quantity: 20, buyPrice: 42 };
        sim.redirectShip(nikolaos.id, 'naxos', 'auto');
      }

      // Delphis (Fishing Boat) - trading between Naxos & Paros
      const delphis = sim.shipManager.spawnShip('fishing_boat', 'naxos', sim, 'Delphis');
      if (delphis) {
        delphis.cargo = { goodId: 'cheese', quantity: 24, buyPrice: 35 };
        sim.redirectShip(delphis.id, 'paros', 'auto');
      }

      // Aeolos (Aegean Coaster) - sailing between Syros & Mykonos
      const aeolos = sim.shipManager.spawnShip('caique', 'syros', sim, 'Aeolos');
      if (aeolos) {
        aeolos.cargo = { goodId: 'crafts', quantity: 65, buyPrice: 28 };
        sim.redirectShip(aeolos.id, 'mykonos', 'auto');
      }

      // Hermes (Aegean Coaster) - sailing between Chios & Samos
      const hermes = sim.shipManager.spawnShip('caique', 'chios', sim, 'Hermes');
      if (hermes) {
        hermes.cargo = { goodId: 'mastic', quantity: 50, buyPrice: 48 };
        sim.redirectShip(hermes.id, 'samos', 'auto');
      }

      // Poseidon (Merchant Freighter) - cruising between Rhodes & Izmir
      const poseidon = sim.shipManager.spawnShip('cargo_ship', 'rhodes', sim, 'Poseidon');
      if (poseidon) {
        poseidon.cargo = { goodId: 'fuel', quantity: 380, buyPrice: 24 };
        sim.redirectShip(poseidon.id, 'izmir', 'auto');
      }

      // Nereus (Luxury Motor Yacht) - VIP tour near Mykonos / Delos
      const nereus = sim.shipManager.spawnShip('charter_yacht', 'mykonos', sim, 'Nereus');
      if (nereus) {
        sim.redirectShip(nereus.id, 'delos', 'auto');
      }

      // Register delivery history so metrics look bustling
      sim.shipManager.islandDeliveryCounts.set('samos', 18);
      sim.shipManager.islandDeliveryCounts.set('izmir', 32);
      sim.shipManager.islandDeliveryCounts.set('santorini', 24);
      sim.shipManager.islandDeliveryCounts.set('naxos', 29);
      sim.shipManager.islandDeliveryCounts.set('syros', 21);
      sim.shipManager.islandDeliveryCounts.set('rhodes', 15);
    }

    // Step simulation forward slightly to position ships along paths
    for (let i = 0; i < 20; i++) {
      sim.update(0.1);
    }

    const snapshot: GameSaveV1 = serializeSimulation(sim);
    const outPath = path.resolve(__dirname, '../public/data/preview_snapshot.json');
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    console.log(`Saved preview snapshot to ${outPath} (${snapshot.ships.length} ships, ${snapshot.unlockedIslands.length} islands, 🪙 ${snapshot.treasury})`);

    expect(snapshot.version).toBe(1);
    expect(snapshot.ships.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.unlockedIslands).toContain('samos');
    expect(snapshot.unlockedIslands).toContain('izmir');
    expect(snapshot.unlockedIslands).toContain('andros');
  });
});
