import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore } from './simulation';
import {
  analyzeCommoditySourcing,
  inspectVesselClassAvailability,
  analyzeVesselVoyageOptions,
} from './sourcing';
import type { IslandData, ShipDefinition } from '../data/types';

describe('Commodity Sourcing Engine (sourcing.ts)', () => {
  let sim: SimulationCore;

  beforeEach(() => {
    const mockBalance = {
      tickRateHz: 10,
      secondsPerGameDay: 2.0,
      startingTreasury: 5000,
      startingTradePoints: 0,
      priceElasticity: 0.8,
      minPriceMultiplier: 0.5,
      maxPriceMultiplier: 2.5,
      targetBufferDays: 4,
      storageCapacityFactor: 1.5,
      minStorageCapacity: 20,
      perishableDecayPerDay: 0.05,
      distressThreshold: 0.1,
      distressGrowthRate: 0.05,
      prosperitySurplusRatio: 1.5,
      prosperityGrowthRate: 0.02,
      startingGameDate: '2026-04-01',
    };

    const mockIslands: IslandData[] = [
      {
        id: 'rhodes',
        name: 'Rhodes',
        type: 'island',
        region: 'dodecanese',
        lat: 36.44,
        lon: 28.22,
        population: 115000,
        port: { lat: 36.44, lon: 28.22 },
        produces: { wine: 14, crafts: 12 },
        consumes: { fuel: 14, grain: 12 },
        unlock: { isStart: true },
        maskId: 8,
        country: 'Greece',
      },
      {
        id: 'kos',
        name: 'Kos',
        type: 'island',
        region: 'dodecanese',
        lat: 36.89,
        lon: 27.28,
        population: 33000,
        port: { lat: 36.89, lon: 27.28 },
        produces: { fish: 8 },
        consumes: { wine: 6 },
        unlock: {},
        maskId: 9,
        country: 'Greece',
      },
      {
        id: 'izmir',
        name: 'Izmir',
        type: 'mainland_port',
        region: 'anatolia',
        lat: 38.42,
        lon: 27.14,
        population: 400000,
        port: { lat: 38.42, lon: 27.14 },
        produces: { fuel: 26, grain: 20 },
        consumes: { wine: 10 },
        unlock: {},
        maskId: 16,
        country: 'Greece',
      },
      {
        id: 'syros',
        name: 'Syros',
        type: 'island',
        region: 'cyclades',
        lat: 37.43,
        lon: 24.94,
        population: 21000,
        port: { lat: 37.43, lon: 24.94 },
        produces: { fuel: 6, crafts: 10 },
        consumes: { fish: 5 },
        unlock: {},
        maskId: 5,
        country: 'Greece',
      },
    ];

    const mockShips: ShipDefinition[] = [
      {
        id: 'fishing_boat',
        name: 'Boat',
        tier: 1,
        capacity: 25,
        speed: 7.0,
        cost: 120,
        range: 90,
        upkeepPerDay: 2,
        description: 'Small starter boat',
        unlock: { islandsConnected: 1 },
      },
      {
        id: 'caique',
        name: 'Coaster',
        tier: 2,
        capacity: 75,
        speed: 9.5,
        cost: 380,
        range: 160,
        upkeepPerDay: 6,
        description: 'Coastal cargo schooner',
        unlock: { islandsConnected: 2 },
      },
      {
        id: 'cargo_ship',
        name: 'Freighter',
        tier: 4,
        capacity: 650,
        speed: 11.5,
        cost: 3200,
        range: 500,
        upkeepPerDay: 45,
        description: 'Heavy cargo bulk carrier',
        unlock: { islandsConnected: 2 },
      },
      {
        id: 'charter_yacht',
        name: 'Yacht',
        tier: 5,
        capacity: 80,
        speed: 18.0,
        cost: 5500,
        range: 450,
        upkeepPerDay: 60,
        description: 'Luxury VIP yacht',
        unlock: { islandsConnected: 2 },
      },
    ];

    const mockSeaLanes = {
      nodes: [
        { id: 'port_rhodes', name: 'Rhodes Port', lon: 28.22, lat: 36.44, isPort: true, islandId: 'rhodes' },
        { id: 'port_kos', name: 'Kos Port', lon: 27.28, lat: 36.89, isPort: true, islandId: 'kos' },
        { id: 'port_izmir', name: 'Izmir Port', lon: 27.14, lat: 38.42, isPort: true, islandId: 'izmir' },
        { id: 'port_syros', name: 'Syros Port', lon: 24.94, lat: 37.43, isPort: true, islandId: 'syros' },
      ],
      edges: [
        { from: 'port_rhodes', to: 'port_kos', distanceKm: 98 },
        { from: 'port_kos', to: 'port_izmir', distanceKm: 175 },
        { from: 'port_kos', to: 'port_syros', distanceKm: 220 },
      ],
    };

    sim = new SimulationCore(mockIslands, [], mockBalance, mockSeaLanes, mockShips);
  });

  it('correctly identifies closest fuel producers for Rhodes', () => {
    // Both Izmir and Syros produce fuel
    const analysis = analyzeCommoditySourcing(sim, 'rhodes', 'fuel');
    expect(analysis).not.toBeNull();
    expect(analysis?.islandName).toBe('Rhodes');
    expect(analysis?.goodId).toBe('fuel');
    expect(analysis?.isDeficit).toBe(true);
    expect(analysis?.consumeRate).toBe(14);

    expect(analysis?.closestProducers.length).toBe(2);
    // Neither Izmir nor Syros is unlocked initially (only Rhodes is unlocked)
    expect(analysis?.closestAwakeProducer).toBeNull();
    expect(analysis?.recommendedAction).toBe('awaken_producer');
  });

  it('evaluates awakened producer and checks vessel range suitability', () => {
    // Unlock Izmir
    sim.unlockedIslands.add('izmir');
    const analysis = analyzeCommoditySourcing(sim, 'rhodes', 'fuel');

    expect(analysis?.closestAwakeProducer).not.toBeNull();
    expect(analysis?.closestAwakeProducer?.islandId).toBe('izmir');
    expect(analysis?.closestAwakeProducer?.isAwake).toBe(true);

    // Vessel range suitability:
    // Route distance Rhodes -> Kos (98km) + Kos -> Izmir (175km) = 273km
    const boat = analysis?.vesselSuitabilities.find((v) => v.typeId === 'fishing_boat');
    const coaster = analysis?.vesselSuitabilities.find((v) => v.typeId === 'caique');
    const freighter = analysis?.vesselSuitabilities.find((v) => v.typeId === 'cargo_ship');
    const yacht = analysis?.vesselSuitabilities.find((v) => v.typeId === 'charter_yacht');

    expect(boat?.canCarry).toBe(true);
    expect(boat?.isRangeAdequate).toBe(false); // 90 km < 273 km
    expect(coaster?.isRangeAdequate).toBe(false); // 160 km < 273 km
    expect(freighter?.isRangeAdequate).toBe(true); // 500 km >= 273 km
    expect(yacht?.canCarry).toBe(false); // VIP passenger only
  });

  it('inspects local fleet when vessels are already carrying other goods', () => {
    sim.unlockedIslands.add('izmir');
    // Spawn a boat and a freighter at Rhodes
    const buy1 = sim.buyShip('fishing_boat', 'rhodes');
    const buy2 = sim.buyShip('cargo_ship', 'rhodes');
    expect(buy1.success).toBe(true);
    expect(buy2.success).toBe(true);

    // Make the freighter carry Wine to Kos
    const freighter = buy2.ship!;
    freighter.cargo = {
      goodId: 'wine',
      quantity: 50,
      buyPrice: 10,
      fromIslandId: 'rhodes',
    };
    freighter.targetIslandId = 'kos';
    freighter.state = 'sailing';

    const analysis = analyzeCommoditySourcing(sim, 'rhodes', 'fuel');
    expect(analysis?.portVessels.length).toBe(2);

    const shipStatus = analysis?.portVessels.find((v) => v.shipId === freighter.id);
    expect(shipStatus?.isCarryingOtherGoods).toBe(true);
    expect(shipStatus?.cargoGoodId).toBe('wine');
    expect(shipStatus?.isSuitableForRoute).toBe(true);

    // Action recommendation should explain that ships are busy with other goods
    expect(analysis?.busyVesselsCount).toBe(1);
    expect(analysis?.availableVesselsCount).toBe(1);
  });

  it('inspects on-the-spot vessel class availability and redirection', () => {
    sim.unlockedIslands.add('izmir');
    // Spawn a boat at Rhodes
    const buyRes = sim.buyShip('fishing_boat', 'rhodes');
    expect(buyRes.success).toBe(true);
    const boat = buyRes.ship!;

    // Inspect 'fishing_boat' class for the Izmir -> Rhodes route
    const inspectionBoat = inspectVesselClassAvailability(sim, 'rhodes', 'izmir', 'fishing_boat', 'fuel');
    expect(inspectionBoat).not.toBeNull();
    expect(inspectionBoat?.totalOwnedCount).toBe(1);
    expect(inspectionBoat?.availableVessels[0].shipId).toBe(boat.id);
    expect(inspectionBoat?.availableVessels[0].isAtDestination).toBe(true);
    expect(inspectionBoat?.availableVessels[0].isPrioritizingTargetGood).toBe(false);

    // Redirect the boat towards Izmir for fuel priority
    const redirectOk = sim.redirectShip(boat.id, 'izmir', 'fuel');
    expect(redirectOk).toBe(true);
    expect(boat.cargoPriority).toBe('fuel');
    // Because the boat was idle and empty, it immediately begins sailing towards Izmir
    expect(boat.state).toBe('sailing');
    expect(boat.targetIslandId).toBe('izmir');

    // Re-inspect to confirm on-the-spot reflection
    const reinspection = inspectVesselClassAvailability(sim, 'rhodes', 'izmir', 'fishing_boat', 'fuel');
    expect(reinspection?.availableVessels[0].isPrioritizingTargetGood).toBe(true);
    expect(reinspection?.availableVessels[0].isEnRouteToSupplier).toBe(true);

    // Inspect 'cargo_ship' class where player owns 0 ships
    const inspectionCargo = inspectVesselClassAvailability(sim, 'rhodes', 'izmir', 'cargo_ship', 'fuel');
    expect(inspectionCargo?.totalOwnedCount).toBe(0);
    expect(inspectionCargo?.canCommission).toBe(true);
    expect(inspectionCargo?.cost).toBe(3200);
  });

  it('accurately advises which port to travel to for an idle vessel with commodity priority', () => {
    sim.unlockedIslands.add('izmir');
    // Commission vessel at Rhodes (which does NOT produce fuel)
    const buyRes = sim.buyShip('fishing_boat', 'rhodes');
    expect(buyRes.success).toBe(true);
    const boat = buyRes.ship!;
    boat.currentIslandId = 'rhodes';
    boat.state = 'idle';
    boat.cargo = null;
    boat.cargoPriority = 'fuel';

    const voyageAnalysis = analyzeVesselVoyageOptions(sim, boat.id);
    expect(voyageAnalysis).not.toBeNull();
    expect(voyageAnalysis?.currentPortId).toBe('rhodes');
    expect(voyageAnalysis?.hasLocalProductionForPriority).toBe(false);
    expect(voyageAnalysis?.explanation).toContain('Rhodes Port does not produce');
    expect(voyageAnalysis?.explanation).toContain('Fuel');

    // Closest awakened fuel supplier for Rhodes is Izmir or Syros
    expect(voyageAnalysis?.topRecommendation).not.toBeNull();
    expect(voyageAnalysis?.topRecommendation?.badgeText).toBe('SUPPLIER');
    expect(voyageAnalysis?.topRecommendation?.goodId).toBe('fuel');
    expect(['izmir', 'syros']).toContain(voyageAnalysis?.topRecommendation?.portId);

    // List of all ports should include distance and production tags
    expect(voyageAnalysis?.allAvailablePorts.length).toBeGreaterThan(0);
    const izmirOption = voyageAnalysis?.allAvailablePorts.find(p => p.islandId === 'izmir');
    expect(izmirOption?.tag).toContain('Produces');
    expect(izmirOption?.tag).toContain('Fuel');

    // Executing redirect immediately orders vessel to set sail
    const travelOk = sim.redirectShip(boat.id, voyageAnalysis!.topRecommendation!.portId, 'fuel');
    expect(travelOk).toBe(true);
    expect(boat.state).toBe('sailing');
    expect(boat.targetIslandId).toBe(voyageAnalysis!.topRecommendation!.portId);
  });
});

