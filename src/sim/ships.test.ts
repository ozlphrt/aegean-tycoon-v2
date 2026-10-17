import { describe, it, expect } from 'vitest';
import { SimulationCore } from './simulation';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from '../data/types';
import type { SeaLanesData } from './nav';
import { toSingleWordShipName, evaluateShipUtilization, type ShipDeliveryEvent } from './shipSim';

import islandsRaw from '../../public/data/islands.json';
import goodsRaw from '../../public/data/goods.json';
import balanceRaw from '../../public/data/balance.json';
import seaLanesRaw from '../../public/data/sea_lanes.json';
import shipsRaw from '../../public/data/ships.json';

describe('Ship Operations & Autonomous Trading', () => {
  const islands = islandsRaw as unknown as IslandData[];
  const goods = goodsRaw as unknown as GoodDefinition[];
  const balance = balanceRaw as unknown as BalanceConfig;
  const seaLanes = seaLanesRaw as unknown as SeaLanesData;
  const ships = shipsRaw as unknown as ShipDefinition[];

  it('spawns initial fishing boats at starting trade hubs', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    expect(sim.shipManager).toBeDefined();
    expect(sim.shipManager!.ships.size).toBe(2);

    const snapshot = sim.getSnapshot();
    expect(snapshot.ships.length).toBe(2);
    expect(snapshot.ships[0].typeId).toBe('fishing_boat');
  });

  it('autonomous boats find trade opportunities, sail along sea lanes, and deliver goods', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);

    const deliveries: ShipDeliveryEvent[] = [];
    sim.onShipDelivery((event) => {
      deliveries.push(event);
    });

    // Run simulation for 2 game days in small steps (~20 steps)
    const totalDays = 2.0;
    const stepSize = 0.05;
    const steps = Math.ceil(totalDays / stepSize);

    for (let i = 0; i < steps; i++) {
      sim.step(stepSize);
    }

    // Verify deliveries were executed between Santorini and Naxos
    expect(deliveries.length).toBeGreaterThan(0);
    const firstDelivery = deliveries[0];
    expect(firstDelivery.quantity).toBeGreaterThan(0);
    expect(firstDelivery.revenue).toBeGreaterThan(0);
    expect(firstDelivery.toIslandId).toBeDefined();

    // Verify first delivery flag works
    expect(deliveries.some((d) => d.isFirstDeliveryToIsland)).toBe(true);

    // Verify treasury and transactions increased
    expect(sim.recentTransactionsCount).toBeGreaterThan(0);
    expect(sim.tradePoints).toBeGreaterThan(balance.startingTradePoints);
  });

  it('allows player to purchase new ships if funds and unlock requirements are met', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    sim.treasury = 500; // give enough drachmas

    const buyRes = sim.buyShip('fishing_boat', 'santorini');
    expect(buyRes.success).toBe(true);
    expect(buyRes.ship).toBeDefined();
    expect(sim.shipManager!.ships.size).toBe(3);

    // Test rejection when poor
    sim.treasury = 10;
    const failRes = sim.buyShip('fishing_boat', 'santorini');
    expect(failRes.success).toBe(false);
  });

  it('strictly adheres to bilateral supply & demand (never ships a good to an island that produces it)', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);

    const deliveries: ShipDeliveryEvent[] = [];
    sim.onShipDelivery((event) => {
      deliveries.push(event);
    });

    // Run simulation for 5 game days
    for (let i = 0; i < 100; i++) {
      sim.step(0.05);
    }

    expect(deliveries.length).toBeGreaterThan(0);
    for (const d of deliveries) {
      const destIsland = sim.islands.get(d.toIslandId);
      const srcIsland = sim.islands.get(d.fromIslandId);
      expect(destIsland).toBeDefined();
      expect(srcIsland).toBeDefined();

      // Destination must have active consumption/demand for the delivered commodity
      expect(destIsland!.markets[d.goodId].consumeRatePerDay).toBeGreaterThan(0);

      // Destination must NOT produce this commodity
      expect(destIsland!.markets[d.goodId].produceRatePerDay).toBe(0);

      // Origin must produce this commodity
      expect(srcIsland!.markets[d.goodId].produceRatePerDay).toBeGreaterThan(0);

      // Specifically verify water is never delivered to Naxos (water exporter)
      if (d.toIslandId === 'naxos') {
        expect(d.goodId).not.toBe('water');
      }
    }
  });

  it('allows assigning cargo priority and prioritizes specified commodities', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const shipList = Array.from(sim.shipManager!.ships.values());
    const boat = shipList[0];

    expect(boat.cargoPriority).toBe('auto');

    // Set priority to wine
    const ok = sim.setShipCargoPriority(boat.id, 'wine');
    expect(ok).toBe(true);
    expect(boat.cargoPriority).toBe('wine');

    const snap = sim.getSnapshot();
    const snapBoat = snap.ships.find((s) => s.id === boat.id);
    expect(snapBoat?.cargoPriority).toBe('wine');
  });

  it('demonstrates playable loop progression from 2 to 10 islands with multi-tier commissioning', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    expect(sim.unlockedIslands.size).toBe(2);

    // Initial cash + initial trading to cover all 8 island unlocks (5,390 drachmas total)
    sim.treasury = 8000;
    sim.tradePoints = 3000;

    // Sequential unlock chain of 8 additional islands
    const unlockChain = [
      'paros',           // 3
      'ios',             // 4
      'syros',           // 5
      'mykonos',         // 6
      'amorgos',         // 7
      'milos',           // 8
      'tinos',           // 9
      'crete_heraklion', // 10
    ];

    for (const islandId of unlockChain) {
      const res = sim.unlockIsland(islandId);
      expect(res.success, `Failed to unlock ${islandId}: ${res.reason}`).toBe(true);
      expect(sim.unlockedIslands.has(islandId)).toBe(true);
    }

    expect(sim.unlockedIslands.size).toBe(10);

    // Commission Aegean Caique at Paros (requires 4+ islands)
    const caiqueRes = sim.buyShip('caique', 'paros');
    expect(caiqueRes.success).toBe(true);
    expect(caiqueRes.ship?.typeId).toBe('caique');

    // Commission Passenger Ferry at Crete (requires 8+ islands)
    const ferryRes = sim.buyShip('ferry', 'crete_heraklion');
    expect(ferryRes.success).toBe(true);
    expect(ferryRes.ship?.typeId).toBe('ferry');

    // Run active trade across the 10 islands for 10 game days
    for (let i = 0; i < 200; i++) {
      sim.step(0.05);
    }

    // Verify all 10 islands remain healthy and active
    for (const islandId of sim.unlockedIslands) {
      const eco = sim.islands.get(islandId)!;
      expect(eco.prosperity).toBeGreaterThan(0.2);
      expect(eco.distress).toBeLessThan(0.8);
    }

    expect(sim.shipManager!.ships.size).toBe(4);
    expect(sim.recentTransactionsCount).toBeGreaterThan(5);
  });

  it('validates progression and stats across all 5 ship tiers', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    sim.treasury = 50000;
    sim.tradePoints = 5000;

    // Verify all 5 tiers exist in shipDefs
    const tierIds = ['fishing_boat', 'caique', 'ferry', 'cargo_ship', 'charter_yacht'];
    for (const tid of tierIds) {
      expect(sim.shipDefs.has(tid), `Missing ship definition for ${tid}`).toBe(true);
    }

    // Starting with 2 islands: Tier 4 (needs 16) and Tier 5 (needs 25) must fail
    const freighterFail = sim.buyShip('cargo_ship', 'santorini');
    expect(freighterFail.success).toBe(false);
    expect(freighterFail.reason).toContain('connected islands');

    const yachtFail = sim.buyShip('charter_yacht', 'santorini');
    expect(yachtFail.success).toBe(false);
    expect(yachtFail.reason).toContain('connected islands');

    // Manually add enough islands to test all tiers
    for (const isl of islands.slice(0, 30)) {
      sim.unlockedIslands.add(isl.id);
    }
    expect(sim.unlockedIslands.size).toBeGreaterThanOrEqual(25);

    // Now buy all 5 tiers and verify their properties
    const tierChecks = [
      { id: 'fishing_boat', tier: 1, minCap: 20, minSpeed: 6 },
      { id: 'caique', tier: 2, minCap: 50, minSpeed: 8 },
      { id: 'ferry', tier: 3, minCap: 150, minSpeed: 12 },
      { id: 'cargo_ship', tier: 4, minCap: 500, minSpeed: 10 },
      { id: 'charter_yacht', tier: 5, minCap: 60, minSpeed: 16 },
    ];

    sim.unlockedIslands.add('piraeus');
    for (const tc of tierChecks) {
      const res = sim.buyShip(tc.id, 'piraeus');
      expect(res.success, `Failed to commission ${tc.id}: ${res.reason}`).toBe(true);
      expect(res.ship).toBeDefined();
      expect(res.ship!.tier).toBe(tc.tier);
      expect(res.ship!.capacity).toBeGreaterThanOrEqual(tc.minCap);
      const knots = res.ship!.speedKmPerDay / 44.45;
      expect(knots).toBeGreaterThanOrEqual(tc.minSpeed);
    }

    expect(sim.shipManager!.ships.size).toBe(2 + 5);
  });

  it('unlocks major gateway ports (Piraeus, Heraklion, Rhodes, Izmir) and generates passenger & tourism revenues', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    sim.treasury = 50000;
    sim.tradePoints = 5000;

    // Connect core stepping stones: Santorini, Naxos, Syros, Mykonos, Amorgos
    const core = ['santorini', 'naxos', 'syros', 'mykonos', 'amorgos'];
    core.forEach((id) => sim.unlockedIslands.add(id));

    // Unlock Piraeus (Athens gateway) via Syros
    const piraeusRes = sim.unlockIsland('piraeus');
    expect(piraeusRes.success, `Failed to unlock Piraeus: ${piraeusRes.reason}`).toBe(true);
    expect(sim.unlockedIslands.has('piraeus')).toBe(true);

    // Unlock Crete (Heraklion) via Santorini
    const creteRes = sim.unlockIsland('crete_heraklion');
    expect(creteRes.success, `Failed to unlock Heraklion: ${creteRes.reason}`).toBe(true);
    expect(sim.unlockedIslands.has('crete_heraklion')).toBe(true);

    // Unlock Samos via Mykonos
    const samosRes = sim.unlockIsland('samos');
    expect(samosRes.success, `Failed to unlock Samos: ${samosRes.reason}`).toBe(true);

    // Unlock Chios via Samos
    const chiosRes = sim.unlockIsland('chios');
    expect(chiosRes.success, `Failed to unlock Chios: ${chiosRes.reason}`).toBe(true);

    // Unlock Izmir (Anatolian gateway) via Chios/Samos
    const izmirRes = sim.unlockIsland('izmir');
    expect(izmirRes.success, `Failed to unlock Izmir: ${izmirRes.reason}`).toBe(true);

    // Unlock Kos via Amorgos
    const kosRes = sim.unlockIsland('kos');
    expect(kosRes.success, `Failed to unlock Kos: ${kosRes.reason}`).toBe(true);

    // Unlock Rhodes (Dodecanese gateway) via Kos
    const rhodesRes = sim.unlockIsland('rhodes');
    expect(rhodesRes.success, `Failed to unlock Rhodes: ${rhodesRes.reason}`).toBe(true);

    // Commission a Passenger Ferry (Tier 3) and a Luxury Yacht (Tier 5)
    const ferry = sim.shipManager!.spawnShip('ferry', 'piraeus', sim, 'Aegean FlyingCat');
    expect(ferry).toBeDefined();

    const yacht = sim.shipManager!.spawnShip('charter_yacht', 'mykonos', sim, 'Delos Royalty');
    expect(yacht).toBeDefined();

    const deliveries: ShipDeliveryEvent[] = [];
    sim.onShipDelivery((e) => deliveries.push(e));

    // Step simulation across 15 game days to allow long-distance voyages
    for (let i = 0; i < 300; i++) {
      sim.step(0.05);
    }

    // Verify deliveries occurred
    expect(deliveries.length).toBeGreaterThan(0);

    // Verify passenger fares were generated on ferry deliveries
    const ferryDeliveries = deliveries.filter((d) => d.shipTier === 3);
    if (ferryDeliveries.length > 0) {
      expect(ferryDeliveries.some((d) => d.passengerFares !== undefined && d.passengerFares > 0)).toBe(true);
    }

    // Verify luxury charter fees were generated on yacht deliveries
    const yachtDeliveries = deliveries.filter((d) => d.shipTier === 5);
    if (yachtDeliveries.length > 0) {
      expect(yachtDeliveries.some((d) => d.passengerFares !== undefined && d.passengerFares > 0)).toBe(true);
    }
  });

  it('applies random +/- 10% speed variance to newly spawned boats', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const def = sim.shipDefs.get('ferry')!;
    const baseSpeedKm = def.speed * 44.45;

    const speeds: number[] = [];
    for (let i = 0; i < 20; i++) {
      const ship = sim.shipManager!.spawnShip('ferry', 'santorini', sim, `Ferry ${i}`)!;
      expect(ship).toBeDefined();
      expect(ship.speedKmPerDay).toBeGreaterThanOrEqual(baseSpeedKm * 0.899);
      expect(ship.speedKmPerDay).toBeLessThanOrEqual(baseSpeedKm * 1.101);
      speeds.push(ship.speedKmPerDay);
    }

    // Verify speeds are not all identical (variance exists)
    const uniqueSpeeds = new Set(speeds.map((s) => s.toFixed(1)));
    expect(uniqueSpeeds.size).toBeGreaterThan(1);
  });

  it('enforces single-word vessel names across legacy and procedural names', () => {
    expect(toSingleWordShipName('Dolphin of Naxos')).toBe('Delphis');
    expect(toSingleWordShipName('Poseidon Pride')).toBe('Poseidon');
    expect(toSingleWordShipName('Santorini Sun')).toBe('Helios');
    expect(toSingleWordShipName('Agios Nikolaos (Santorini)')).toBe('Nikolaos');
    expect(toSingleWordShipName('Aegean Runner')).toBe('Meltemi');
    expect(toSingleWordShipName('Panagia Soumela')).toBe('Sirena');
    expect(toSingleWordShipName('Zephyr')).toBe('Zephyr');
    expect(toSingleWordShipName('Thalassa')).toBe('Thalassa');
    expect(toSingleWordShipName('Hermes')).toBe('Hermes');

    const multiWords = [
      'Dolphin of Naxos',
      'Poseidon Pride',
      'Santorini Sun',
      'Agios Nikolaos (Santorini)',
      'Aegean Runner',
      'Panagia Soumela',
      'Fleet Vessel #1',
      'Aegean FlyingCat',
      'Delos Royalty',
    ];
    for (const raw of multiWords) {
      const single = toSingleWordShipName(raw);
      expect(single.split(/\s+/).length).toBe(1);
    }
  });
  it('calculates harbor fleet berth capacity based on population, economic potential, and mainland status', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);

    // Santorini: pop 15,500 (+3), produces 15 + consumes 19 = 34 throughput (+3), base 6, prosperity 0.5 (+1) => 13 berths
    const santorini = sim.islands.get('santorini')!;
    santorini.prosperity = 0.5; // neutral prosperity
    expect(sim.getPortFleetCapacity('santorini')).toBe(13);

    // Booming prosperity bonus (+2) => 14 berths
    santorini.prosperity = 0.85;
    expect(sim.getPortFleetCapacity('santorini')).toBe(14);

    // Piraeus: mainland_port (+6), pop 160,000 (+32), throughput > 50 (+4), base 6, prosperity (+1) => 49 berths
    expect(sim.getPortFleetCapacity('piraeus')).toBeGreaterThanOrEqual(16);

    // Anafi: small island (pop 450, throughput 8 (+1), base 6, initial prosperity 0.40) => 7 berths
    expect(sim.getPortFleetCapacity('anafi')).toBe(7);
  });

  it('rejects vessel commission when port harbor berths are full', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    sim.treasury = 50000; // plenty of funds
    sim.unlockedIslands.add('anafi'); // unlock island so port can commission

    const maxBerths = sim.getPortFleetCapacity('anafi');
    expect(maxBerths).toBe(7);
    expect(sim.getHomePortedShipsCount('anafi')).toBe(0);

    // Commission vessels up to full berth capacity
    for (let i = 0; i < maxBerths; i++) {
      const res = sim.buyShip('fishing_boat', 'anafi');
      expect(res.success).toBe(true);
    }
    expect(sim.getHomePortedShipsCount('anafi')).toBe(maxBerths);

    // Attempt (maxBerths + 1)th vessel -> berths are full (8/8)
    const initialFunds = sim.treasury;
    const overflow = sim.buyShip('fishing_boat', 'anafi');
    expect(overflow.success).toBe(false);
    expect(overflow.reason).toContain(`harbor berths full (${maxBerths}/${maxBerths} vessels)`);
    expect(sim.getHomePortedShipsCount('anafi')).toBe(maxBerths);
    expect(sim.treasury).toBe(initialFunds); // No drachmas deducted
  });

  it('evaluates and diagnoses underutilized vessels across different operational states', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);

    // 1. Idle vessel without priority
    const ship1 = sim.shipManager!.spawnShip('fishing_boat', 'santorini', sim, 'IdleBoat')!;
    ship1.state = 'idle';
    ship1.cargoPriority = 'auto';
    const eval1 = evaluateShipUtilization(ship1, sim);
    expect(eval1).not.toBeNull();
    expect(eval1?.reason).toBe('idle_in_port');
    expect(eval1?.label).toBe('Idle');

    // 2. Idle vessel with unproducible priority
    ship1.cargoPriority = 'fuel';
    const eval2 = evaluateShipUtilization(ship1, sim);
    expect(eval2).not.toBeNull();
    expect(eval2?.reason).toBe('priority_starvation');
    expect(eval2?.label).toBe('Starved');

    // 3. Sailing empty hold (ballast voyage)
    ship1.state = 'sailing';
    ship1.cargo = null;
    ship1.targetIslandId = 'naxos';
    const eval3 = evaluateShipUtilization(ship1, sim);
    expect(eval3).not.toBeNull();
    expect(eval3?.reason).toBe('empty_hold');
    expect(eval3?.label).toBe('Ballast');

    // 4. Low cargo hold utilization (< 35% on capacity >= 40)
    const ship2 = sim.shipManager!.spawnShip('caique', 'santorini', sim, 'HalfEmptyCaique')!;
    ship2.state = 'sailing';
    ship2.capacity = 50;
    ship2.cargo = { goodId: 'wine', quantity: 10, buyPrice: 15, fromIslandId: 'santorini' }; // 10 / 50 = 20%
    const eval4 = evaluateShipUtilization(ship2, sim);
    expect(eval4).not.toBeNull();
    expect(eval4?.reason).toBe('low_cargo_fill');
    expect(eval4?.fillPct).toBe(20);

    // 5. Fully utilized vessel (e.g. 45 / 50 = 90%)
    ship2.cargo.quantity = 45;
    const eval5 = evaluateShipUtilization(ship2, sim);
    expect(eval5).toBeNull();

    // 6. Test SimulationCore underutilized queries
    const allUnder = sim.getUnderutilizedShips();
    expect(allUnder.some((u) => u.shipId === ship1.id)).toBe(true);

    const santoriniUnder = sim.getUnderutilizedShipsForIsland('santorini');
    expect(santoriniUnder.some((u) => u.shipId === ship1.id)).toBe(true);
  });

  it('differentiates vessel speed dynamically by tier, individual hull variance, and cargo load factor', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const sm = sim.shipManager!;

    // 1. Differentiate by tier
    const boat = sm.spawnShip('fishing_boat', 'santorini', sim, 'T1Runner')!;
    const ferry = sm.spawnShip('ferry', 'santorini', sim, 'T3FlyingCat')!;
    const yacht = sm.spawnShip('charter_yacht', 'santorini', sim, 'T5Royalty')!;

    expect(ferry.speedKmPerDay).toBeGreaterThan(boat.speedKmPerDay * 1.5);
    expect(yacht.speedKmPerDay).toBeGreaterThan(ferry.speedKmPerDay * 1.1);

    // 2. Dynamic cargo load displacement factor (empty ballast sprint vs fully laden draft drag)
    const emptyBoat = sm.spawnShip('fishing_boat', 'santorini', sim, 'EmptyBallast')!;
    const ladenBoat = sm.spawnShip('fishing_boat', 'santorini', sim, 'LadenCargo')!;

    // Setup routes
    const path = sm.graph.findPathBetweenIslands('santorini', 'naxos')!;
    expect(path).toBeDefined();

    emptyBoat.state = 'sailing';
    emptyBoat.path = path;
    emptyBoat.cargo = null;

    ladenBoat.state = 'sailing';
    ladenBoat.path = path;
    ladenBoat.cargo = { goodId: 'wine', quantity: ladenBoat.capacity, buyPrice: 10, fromIslandId: 'santorini' };

    emptyBoat.speedKmPerDay = 300;
    ladenBoat.speedKmPerDay = 300;

    // Advance 1 tick
    sim.step(0.01);

    expect(emptyBoat.cargoSpeedModifier).toBeGreaterThanOrEqual(1.10);
    expect(ladenBoat.cargoSpeedModifier).toBeLessThanOrEqual(0.80);
    expect(emptyBoat.effectiveSpeedKmPerDay!).toBeGreaterThan(ladenBoat.effectiveSpeedKmPerDay! * 1.35);
  });

  it('decommissions vessels, recovers salvage drachmas, and frees harbor berths', () => {
    const sim = new SimulationCore(islands, goods, balance, seaLanes, ships);
    const sm = sim.shipManager!;
    expect(sm).toBeDefined();

    const initialShipsCount = sm.ships.size;
    const initialBerths = sim.getHomePortedShipsCount('santorini');

    // Spawn 2 fishing boats at Santorini
    const boat1 = sm.spawnShip('fishing_boat', 'santorini', sim, 'Zephyr')!;
    const boat2 = sm.spawnShip('fishing_boat', 'santorini', sim, 'Aura')!;
    expect(sm.ships.size).toBe(initialShipsCount + 2);
    expect(sim.getHomePortedShipsCount('santorini')).toBe(initialBerths + 2);

    // Give boat1 some cargo
    boat1.cargo = { goodId: 'wine', quantity: 20, buyPrice: 15, fromIslandId: 'santorini' };

    const initialTreasury = sim.treasury;
    const def = sim.shipDefs.get('fishing_boat')!;
    const wineDef = sim.goodsData.get('wine')!;
    const expectedRefund = Math.floor(def.cost * 0.5) + Math.floor(wineDef.basePrice * 20 * 0.5);

    expect(sim.getShipDecommissionRefund(boat1.id)).toBe(expectedRefund);

    // Decommission boat1
    const res1 = sim.decommissionShip(boat1.id);
    expect(res1.success).toBe(true);
    expect(res1.refund).toBe(expectedRefund);
    expect(res1.shipName).toBe('Zephyr');
    expect(res1.homePortId).toBe('santorini');

    // Verify fleet and berth counts
    expect(sm.ships.has(boat1.id)).toBe(false);
    expect(sm.ships.size).toBe(initialShipsCount + 1);
    expect(sim.getHomePortedShipsCount('santorini')).toBe(initialBerths + 1);
    expect(sim.treasury).toBe(initialTreasury + expectedRefund);

    // Attempt decommissioning already removed ship
    const resDuplicate = sim.decommissionShip(boat1.id);
    expect(resDuplicate.success).toBe(false);

    // Fill harbor berths to capacity and verify decommissioning reopens berths
    const maxBerths = sim.getPortFleetCapacity('santorini');
    while (sim.getHomePortedShipsCount('santorini') < maxBerths) {
      sm.spawnShip('fishing_boat', 'santorini', sim);
    }
    expect(sim.getHomePortedShipsCount('santorini')).toBe(maxBerths);

    // Purchasing another ship fails because berths are full
    sim.treasury = 50000;
    const buyFullRes = sim.buyShip('fishing_boat', 'santorini');
    expect(buyFullRes.success).toBe(false);
    expect(buyFullRes.reason).toContain('harbor berths full');

    // Decommission boat2 to free 1 berth
    const res2 = sim.decommissionShip(boat2.id);
    expect(res2.success).toBe(true);
    expect(sim.getHomePortedShipsCount('santorini')).toBe(maxBerths - 1);

    // Now buying a new ship succeeds!
    const buyAfterDecomm = sim.buyShip('fishing_boat', 'santorini');
    expect(buyAfterDecomm.success).toBe(true);
    expect(sim.getHomePortedShipsCount('santorini')).toBe(maxBerths);
  });
});




