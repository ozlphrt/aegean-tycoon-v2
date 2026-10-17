import type { ShipDefinition } from '../data/types';
import { SeaLaneGraph, type NavPath } from './nav';
import type { SimulationCore } from './simulation';

export type ShipState = 'idle' | 'loading' | 'sailing' | 'unloading';

export interface ShipCargo {
  goodId: string;
  quantity: number;
  buyPrice: number;
  fromIslandId: string;
}


export interface ShipInstance {
  id: string;
  name: string;
  typeId: string;
  tier: number;
  capacity: number;
  speedKmPerDay: number;
  effectiveSpeedKmPerDay?: number;
  windSpeedModifier?: number;
  cargoSpeedModifier?: number;
  upkeepPerDay: number;

  state: ShipState;
  homeIslandId: string;
  currentIslandId: string | null;
  targetIslandId: string | null;

  cargo: ShipCargo | null;
  path: NavPath | null;
  distanceTraveledKm: number;

  position: { lon: number; lat: number };
  heading: number; // radians

  stateTimeRemaining: number;
  tripsCompleted: number;
  totalDeliveredValue: number;
  totalProfit: number;
  cargoPriority?: string; // specific goodId or 'auto'
}

export interface ShipDeliveryEvent {
  shipId: string;
  shipName: string;
  shipTier: number;
  fromIslandId: string;
  toIslandId: string;
  goodId: string;
  quantity: number;
  revenue: number;
  profit: number;
  passengerFares?: number;
  tourismPrestigeBonus?: number;
  isFirstDeliveryToIsland: boolean;
}

export interface ShipStatusEvent {
  shipId: string;
  shipName: string;
  type: 'loading' | 'unloading' | 'departing';
  islandId: string;
  targetIslandId?: string;
  goodId?: string;
  quantity?: number;
}

export type UnderutilizationReason =
  | 'idle_in_port'
  | 'low_cargo_fill'
  | 'empty_hold'
  | 'priority_starvation';

export interface UnderutilizedShipInfo {
  shipId: string;
  shipName: string;
  tier: number;
  typeId: string;
  homeIslandId: string;
  currentIslandId: string | null;
  targetIslandId: string | null;
  state: ShipState;
  reason: UnderutilizationReason;
  severity: 'high' | 'medium';
  fillPct: number;
  label: string;
  details: string;
  recommendation: string;
}

const AEGEAN_SHIP_NAMES = [
  'Nikolaos',
  'Meltemi',
  'Triton',
  'Nereus',
  'Pelagos',
  'Delphis',
  'Poseidon',
  'Argo',
  'Hermes',
  'Zephyr',
  'Thalassa',
  'Aiolos',
  'Sirena',
  'Glafkos',
  'Odysseus',
  'Boreas',
  'Calypso',
  'Nautilos',
  'Proteus',
  'Alkyon',
  'Aura',
  'Helios',
  'Selene',
  'Orion',
  'Thetis',
  'Doris',
  'Phaethon',
  'Aegaeon',
  'Asteria',
  'Levante',
  'Maistros',
  'Ostria',
  'Garbis',
  'Akritas',
  'Symi',
  'Hydra',
  'Skiron',
  'Apeliotes',
  'Kallisti',
  'Zeus',
];

/**
 * Sanitizes any ship name into a concise, authentic single word.
 * Automatically maps legacy compound names (e.g. "Dolphin of Naxos", "Poseidon Pride")
 * to single-word Aegean nautical, wind, and mythological names.
 */
export function toSingleWordShipName(name: string): string {
  if (!name) return 'Vessel';
  // Remove parenthetical details: e.g. "Agios Nikolaos (Santorini)" -> "Agios Nikolaos"
  const clean = name.replace(/\(.*?\)/g, '').trim();

  // Known multi-word to single-word canonical mappings
  const knownMappings: Record<string, string> = {
    'dolphin of naxos': 'Delphis',
    'agios nikolaos': 'Nikolaos',
    'poseidon pride': 'Poseidon',
    'santorini sun': 'Helios',
    'aegean runner': 'Meltemi',
    'panagia soumela': 'Sirena',
    'aegean flyingcat': 'Triton',
    'delos royalty': 'Calypso',
  };

  const lower = clean.toLowerCase();
  if (knownMappings[lower]) return knownMappings[lower];
  for (const [k, v] of Object.entries(knownMappings)) {
    if (lower.startsWith(k)) return v;
  }

  // Split into words
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return clean;
  }

  // Filter out common honorific/regional prefixes
  const ignoredPrefixes = new Set(['agios', 'agia', 'panagia', 'aegean', 'island', 'cape', 'mount', 'fleet', 'hms', 'ss']);
  const filtered = words.filter((w) => !ignoredPrefixes.has(w.toLowerCase()));
  if (filtered.length > 0) {
    return filtered[0];
  }

  return words[0] || 'Vessel';
}

export class ShipSimulationManager {
  public ships: Map<string, ShipInstance> = new Map();
  public deliveryListeners: Set<(event: ShipDeliveryEvent) => void> = new Set();
  public statusListeners: Set<(event: ShipStatusEvent) => void> = new Set();
  public islandDeliveryCounts: Map<string, number> = new Map();

  constructor(
    public graph: SeaLaneGraph,
    public shipDefs: Map<string, ShipDefinition>
  ) {}

  public onDelivery(listener: (event: ShipDeliveryEvent) => void): () => void {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  public onStatus(listener: (event: ShipStatusEvent) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public clearAllShips(): void {
    this.ships.clear();
  }

  public registerShip(ship: ShipInstance): void {
    ship.name = toSingleWordShipName(ship.name);
    this.ships.set(ship.id, ship);
  }

  /**
   * Removes a decommissioned vessel from the active simulation fleet.
   */
  public removeShip(shipId: string): ShipInstance | null {
    const ship = this.ships.get(shipId);
    if (!ship) return null;
    this.ships.delete(shipId);
    return ship;
  }

  /**
   * Spawns a new ship at an island's harbor.
   */
  public spawnShip(
    typeId: string,
    homeIslandId: string,
    sim: SimulationCore,
    customName?: string
  ): ShipInstance | null {
    const def = this.shipDefs.get(typeId);
    if (!def) return null;

    const island = sim.islandsData.get(homeIslandId);
    if (!island) return null;

    const shipIndex = this.ships.size + 1;
    const rawName = customName || AEGEAN_SHIP_NAMES[(shipIndex - 1) % AEGEAN_SHIP_NAMES.length];
    const name = toSingleWordShipName(rawName);
    const id = `ship_${shipIndex}_${Math.random().toString(36).substring(2, 6)}`;

    // Speed: def.speed in knots -> nautical miles / hour -> km / game day
    // 1 knot = 1.852 km/h * 24 h/day = 44.448 km / game day
    // Add random +/- 10% speed variance (0.90 to 1.10) per vessel
    const speedVariance = 0.90 + Math.random() * 0.20;
    const speedKmPerDay = Math.max(10, def.speed * 44.45 * speedVariance);

    const portLon = island.port?.lon ?? island.lon;
    const portLat = island.port?.lat ?? island.lat;

    const ship: ShipInstance = {
      id,
      name,
      typeId: def.id,
      tier: def.tier,
      capacity: def.capacity,
      speedKmPerDay,
      effectiveSpeedKmPerDay: speedKmPerDay,
      windSpeedModifier: 1.0,
      cargoSpeedModifier: 1.0,
      upkeepPerDay: def.upkeepPerDay,

      state: 'idle',
      homeIslandId,
      currentIslandId: homeIslandId,
      targetIslandId: null,

      cargo: null,
      path: null,
      distanceTraveledKm: 0,

      position: { lon: portLon, lat: portLat },
      heading: 0,

      stateTimeRemaining: 0.02,
      tripsCompleted: 0,
      totalDeliveredValue: 0,
      totalProfit: 0,
      cargoPriority: 'auto',
    };

    this.ships.set(id, ship);
    return ship;
  }

  /**
   * Redirects a vessel to a destination port and optionally sets its cargo priority.
   * If the ship is idle or empty, it immediately begins sailing along the sea lane network to the destination.
   */
  public redirectShip(
    shipId: string,
    targetIslandId: string,
    priorityGoodId?: string
  ): boolean {
    const ship = this.ships.get(shipId);
    if (!ship) return false;

    if (priorityGoodId) {
      ship.cargoPriority = priorityGoodId;
    }

    // If the ship is idle or empty (no cargo carried):
    // Immediately calculate route and set sail towards targetIslandId
    if (ship.state === 'idle' || (!ship.cargo || ship.cargo.quantity === 0)) {
      const fromIslandId = ship.currentIslandId || ship.homeIslandId;
      if (fromIslandId && fromIslandId !== targetIslandId) {
        const path = this.graph.findPathBetweenIslands(fromIslandId, targetIslandId);
        if (path && path.waypoints.length >= 2) {
          ship.currentIslandId = null;
          ship.targetIslandId = targetIslandId;
          ship.path = path;
          ship.distanceTraveledKm = 0;
          ship.heading = this.graph.interpolate(path.waypoints, 0).heading;
          ship.state = 'sailing';
          ship.stateTimeRemaining = 0;
          return true;
        }
      }
    }
    return true;
  }

  /**
   * Ticks all active ships across game days.
   */
  public tick(sim: SimulationCore, deltaDays: number): void {
    if (deltaDays <= 0) return;

    for (const ship of this.ships.values()) {
      switch (ship.state) {
        case 'idle':
          this.tickIdle(ship, sim, deltaDays);
          break;
        case 'loading':
          this.tickLoading(ship, sim, deltaDays);
          break;
        case 'sailing':
          this.tickSailing(ship, sim, deltaDays);
          break;
        case 'unloading':
          this.tickUnloading(ship, sim, deltaDays);
          break;
      }
    }
  }

  private tickIdle(ship: ShipInstance, sim: SimulationCore, _deltaDays: number): void {
    if (!ship.currentIslandId) {
      ship.currentIslandId = ship.homeIslandId;
    }

    const currentIsland = sim.islands.get(ship.currentIslandId);
    if (!currentIsland) return;

    // Find best trade opportunity from currentIsland to any other unlocked or valid island
    interface Opportunity {
      targetIslandId: string;
      goodId: string;
      quantity: number;
      expectedProfit: number;
      path: NavPath;
    }

    let bestOpp: Opportunity | null = null;
    let highestProfit = 0;

    // Pre-filter goods that current island actually exports and has in stock
    const exportableGoods = [];
    for (const [goodId, market] of Object.entries(currentIsland.markets)) {
      if (market.produceRatePerDay > 0 && market.stock >= 1) {
        exportableGoods.push({ goodId, market });
      }
    }
    if (exportableGoods.length === 0) return;

    // Look across all unlocked islands (and also include islands player is trading with)
    const targetCandidates = Array.from(sim.unlockedIslands);

    for (const targetId of targetCandidates) {
      if (targetId === ship.currentIslandId) continue;

      const targetIsland = sim.islands.get(targetId);
      if (!targetIsland) continue;

      // Quick viability check: does targetIsland consume any exportable good with a spread?
      let hasViableGood = false;
      for (const { goodId, market } of exportableGoods) {
        const tm = targetIsland.markets[goodId];
        if (tm && tm.consumeRatePerDay > 0 && (tm.sellPrice - market.buyPrice) > 0.1 && tm.stock < tm.maxCapacity) {
          hasViableGood = true;
          break;
        }
      }
      if (!hasViableGood) continue;

      const path = this.graph.findPathBetweenIslands(ship.currentIslandId, targetId);
      if (!path || path.totalDistanceKm <= 0) continue;

      const travelDays = path.totalDistanceKm / ship.speedKmPerDay;
      const roundTripUpkeep = ship.upkeepPerDay * travelDays;

      // Evaluate goods that currentIsland exports (produces) and targetIsland imports (consumes)
      for (const { goodId, market: currentMarket } of exportableGoods) {
        const targetMarket = targetIsland.markets[goodId];
        if (!targetMarket || targetMarket.consumeRatePerDay <= 0) continue;

        const priceDiff = targetMarket.sellPrice - currentMarket.buyPrice;
        if (priceDiff <= 0.1) continue;

        const availableQty = Math.floor(currentMarket.stock);
        const capacityRoom = Math.floor(targetMarket.maxCapacity - targetMarket.stock);
        const maxTradeQty = Math.min(ship.capacity, availableQty, Math.max(1, capacityRoom));

        if (maxTradeQty <= 0) continue;

        const revenue = maxTradeQty * targetMarket.sellPrice;
        const cost = maxTradeQty * currentMarket.buyPrice;

        // Calculate expected passenger fares and luxury tourism multipliers
        let expectedPassengerFares = 0;
        const curData = sim.islandsData.get(ship.currentIslandId);
        const tgtData = sim.islandsData.get(targetId);
        const originTourism = curData?.tourismBase ?? 0.5;
        const destTourism = tgtData?.tourismBase ?? 0.5;

        // Tier 3 Ferry: Passenger transit tickets
        if (ship.typeId === 'ferry' || ship.tier === 3) {
          expectedPassengerFares = Math.floor((originTourism + destTourism) * 0.5 * (path.totalDistanceKm * 0.8) * 1.5);
        } else if (ship.typeId === 'charter_yacht' || ship.tier === 5) {
          // Tier 5 Yacht: VIP luxury charter fees + prestige luxury goods bonus
          expectedPassengerFares = Math.floor((originTourism * destTourism) * (path.totalDistanceKm * 2.2) * 2.0);
          if (['wine', 'crafts', 'mastic', 'marble'].includes(goodId)) {
            expectedPassengerFares += Math.floor(revenue * (destTourism * 0.45));
          }
        }

        const expectedProfit = revenue - cost - roundTripUpkeep + expectedPassengerFares;

        // Apply cargo prioritization if the ship has a specific commodity mandate
        const isPriority = !!(ship.cargoPriority && ship.cargoPriority !== 'auto' && ship.cargoPriority === goodId);
        const priorityScore = expectedProfit * (isPriority ? 3.0 : 1.0);

        if (priorityScore > highestProfit) {
          highestProfit = priorityScore;
          bestOpp = {
            targetIslandId: targetId,
            goodId,
            quantity: maxTradeQty,
            expectedProfit,
            path,
          };
        }
      }
    }

    if (bestOpp) {
      // Execute buy at current island
      const buyRes = sim.buyFromIsland(ship.currentIslandId, bestOpp.goodId, bestOpp.quantity);
      if (buyRes.success && buyRes.actualQty > 0) {
        ship.cargo = {
          goodId: bestOpp.goodId,
          quantity: buyRes.actualQty,
          buyPrice: buyRes.unitPrice,
          fromIslandId: ship.currentIslandId,
        };

        ship.targetIslandId = bestOpp.targetIslandId;
        ship.path = bestOpp.path;
        ship.distanceTraveledKm = 0;
        if (bestOpp.path.waypoints.length >= 2) {
          ship.heading = this.graph.interpolate(bestOpp.path.waypoints, 0).heading;
        }
        const fromIsland = ship.currentIslandId;
        ship.state = 'loading';
        ship.stateTimeRemaining = 0.04; // brief loading delay (~1 hour)

        for (const l of this.statusListeners) {
          l({
            shipId: ship.id,
            shipName: ship.name,
            type: 'loading',
            islandId: fromIsland,
            targetIslandId: bestOpp.targetIslandId,
            goodId: ship.cargo.goodId,
            quantity: ship.cargo.quantity,
          });
        }
        return;
      }
    }

    // If no cargo opportunity, but ship is not at home port, navigate back to home port
    if (ship.currentIslandId !== ship.homeIslandId && sim.unlockedIslands.has(ship.homeIslandId)) {
      const returnPath = this.graph.findPathBetweenIslands(ship.currentIslandId, ship.homeIslandId);
      if (returnPath) {
        ship.targetIslandId = ship.homeIslandId;
        ship.path = returnPath;
        ship.distanceTraveledKm = 0;
        if (returnPath.waypoints.length >= 2) {
          ship.heading = this.graph.interpolate(returnPath.waypoints, 0).heading;
        }
        ship.state = 'sailing';
        return;
      }
    }
  }

  private tickLoading(ship: ShipInstance, _sim: SimulationCore, deltaDays: number): void {
    ship.stateTimeRemaining -= deltaDays;
    if (ship.stateTimeRemaining <= 0) {
      ship.state = 'sailing';
      ship.distanceTraveledKm = 0;
      const departedFrom = ship.currentIslandId || ship.homeIslandId;
      ship.currentIslandId = null;

      for (const l of this.statusListeners) {
        l({
          shipId: ship.id,
          shipName: ship.name,
          type: 'departing',
          islandId: departedFrom,
          targetIslandId: ship.targetIslandId || undefined,
          goodId: ship.cargo?.goodId,
          quantity: ship.cargo?.quantity,
        });
      }
    }
  }

  private tickSailing(ship: ShipInstance, sim: SimulationCore, deltaDays: number): void {
    if (!ship.path || ship.path.waypoints.length === 0) {
      ship.state = 'idle';
      return;
    }

    // Position and heading interpolation along route
    const interp = this.graph.interpolate(ship.path.waypoints, ship.distanceTraveledKm);
    ship.position = interp.position;
    ship.heading = interp.heading;

    // 1. Calculate seasonal Meltemi wind modifier based on vessel heading & aerodynamic sensitivity
    const windMod = sim.weather ? sim.weather.calculateSpeedModifier(ship.heading, ship.tier) : 1.0;
    ship.windSpeedModifier = windMod;

    // 2. Dynamic Cargo Displacement Load Factor:
    // Empty vessel in ballast: +12% sprint speed
    // Fully laden vessel: down to -22% hydrodynamic draft displacement drag
    const loadRatio = (ship.cargo && ship.cargo.quantity > 0)
      ? Math.min(1.0, ship.cargo.quantity / Math.max(1, ship.capacity))
      : 0.0;
    const cargoMod = 1.12 - loadRatio * 0.34;
    ship.cargoSpeedModifier = cargoMod;

    // Live effective speed in km/day (reported in knots in UI: effectiveSpeed / 44.45)
    const effectiveSpeed = ship.speedKmPerDay * windMod * cargoMod;
    ship.effectiveSpeedKmPerDay = effectiveSpeed;

    // 3. Calibrated Nautical Voyage Pacing:
    // Paces travel across real-world geographic distances gracefully (~1.5x calmer),
    // eliminating rocket-speed voyages and allowing majestic visual cruising between islands.
    const VOYAGE_PACE_FACTOR = 0.65;
    const advanceKm = effectiveSpeed * VOYAGE_PACE_FACTOR * deltaDays;
    ship.distanceTraveledKm += advanceKm;

    // Upkeep deduction
    sim.treasury -= ship.upkeepPerDay * deltaDays;

    // Check arrival
    if (ship.distanceTraveledKm >= ship.path.totalDistanceKm || interp.isComplete) {
      ship.currentIslandId = ship.targetIslandId;
      ship.state = 'unloading';
      ship.stateTimeRemaining = 0.04; // brief unloading delay

      if (ship.currentIslandId && ship.cargo) {
        for (const l of this.statusListeners) {
          l({
            shipId: ship.id,
            shipName: ship.name,
            type: 'unloading',
            islandId: ship.currentIslandId,
            targetIslandId: ship.currentIslandId,
            goodId: ship.cargo.goodId,
            quantity: ship.cargo.quantity,
          });
        }
      }
    }
  }

  private tickUnloading(ship: ShipInstance, sim: SimulationCore, deltaDays: number): void {
    ship.stateTimeRemaining -= deltaDays;
    if (ship.stateTimeRemaining <= 0) {
      const destIslandId = ship.currentIslandId;
      if (destIslandId && ship.cargo) {
        const sellRes = sim.sellToIsland(destIslandId, ship.cargo.goodId, ship.cargo.quantity);
        if (sellRes.success) {
          const baseRevenue = sellRes.totalRevenue;
          const cost = ship.cargo.buyPrice * sellRes.actualQty;
          let profit = Math.max(0, baseRevenue - cost);

          const fromIsland = sim.islandsData.get(ship.cargo.fromIslandId || ship.homeIslandId);
          const toIsland = sim.islandsData.get(destIslandId);
          const originTourism = fromIsland?.tourismBase ?? 0.5;
          const destTourism = toIsland?.tourismBase ?? 0.5;
          const routeDistKm = ship.path?.totalDistanceKm || 50;

          let passengerFares = 0;
          let tourismPrestigeBonus = 0;

          // Tier 3 Island Ferry: Passenger Fares
          if (ship.typeId === 'ferry' || ship.tier === 3) {
            passengerFares = Math.floor((originTourism + destTourism) * 0.5 * (routeDistKm * 0.8) * 1.5);
            profit += passengerFares;
          }

          // Tier 5 Luxury Yacht: VIP Charter & Prestige Luxury Multipliers
          if (ship.typeId === 'charter_yacht' || ship.tier === 5) {
            passengerFares = Math.floor((originTourism * destTourism) * (routeDistKm * 2.2) * 2.0);
            if (['wine', 'crafts', 'mastic', 'marble'].includes(ship.cargo.goodId)) {
              tourismPrestigeBonus = Math.floor(baseRevenue * (destTourism * 0.45));
            }
            profit += passengerFares + tourismPrestigeBonus;
          }

          const finalRevenue = baseRevenue + passengerFares + tourismPrestigeBonus;

          // Boost destination island prosperity from active tourism/passenger transit
          const destEco = sim.islands.get(destIslandId);
          if (destEco && (passengerFares > 0 || tourismPrestigeBonus > 0)) {
            destEco.prosperity = Math.min(1.0, destEco.prosperity + 0.025);
          }

          sim.treasury += profit;
          ship.totalDeliveredValue += finalRevenue;
          ship.totalProfit += profit;
          ship.tripsCompleted++;

          // Track island deliveries
          const prevDeliveries = this.islandDeliveryCounts.get(destIslandId) || 0;
          this.islandDeliveryCounts.set(destIslandId, prevDeliveries + 1);
          const isFirst = prevDeliveries === 0;

          // Notify delivery listeners
          const event: ShipDeliveryEvent = {
            shipId: ship.id,
            shipName: ship.name,
            shipTier: ship.tier,
            fromIslandId: ship.cargo.fromIslandId || ship.homeIslandId,
            toIslandId: destIslandId,
            goodId: ship.cargo.goodId,
            quantity: sellRes.actualQty,
            revenue: finalRevenue,
            profit,
            passengerFares: passengerFares > 0 ? passengerFares : undefined,
            tourismPrestigeBonus: tourismPrestigeBonus > 0 ? tourismPrestigeBonus : undefined,
            isFirstDeliveryToIsland: isFirst,
          };

          for (const l of this.deliveryListeners) {
            l(event);
          }
        }
      }

      ship.cargo = null;
      ship.path = null;
      ship.targetIslandId = null;
      ship.state = 'idle';
    }
  }

  public getUnderutilizedShips(sim: SimulationCore): UnderutilizedShipInfo[] {
    const list: UnderutilizedShipInfo[] = [];
    for (const ship of this.ships.values()) {
      const info = evaluateShipUtilization(ship, sim);
      if (info) list.push(info);
    }
    return list;
  }

  public getUnderutilizedShipsForIsland(sim: SimulationCore, islandId: string): UnderutilizedShipInfo[] {
    const list: UnderutilizedShipInfo[] = [];
    for (const ship of this.ships.values()) {
      if (
        ship.homeIslandId === islandId ||
        ship.currentIslandId === islandId ||
        ship.targetIslandId === islandId
      ) {
        const info = evaluateShipUtilization(ship, sim);
        if (info) list.push(info);
      }
    }
    return list;
  }
}

/**
 * Analyzes whether an active vessel is operating sub-optimally:
 * - Idle in port waiting without viable export runs
 * - Starving for an unproducible priority commodity
 * - Sailing with empty hold (ballast run)
 * - Sailing with low cargo hold capacity (< 35% utilization)
 */
export function evaluateShipUtilization(
  ship: ShipInstance,
  sim: SimulationCore
): UnderutilizedShipInfo | null {
  // 1. Idle in port: unable to find any profitable trade route or waiting indefinitely
  if (ship.state === 'idle') {
    const portName = ship.currentIslandId
      ? (sim.islandsData.get(ship.currentIslandId)?.name || ship.currentIslandId)
      : 'Port';
    const isPrioritySet = ship.cargoPriority && ship.cargoPriority !== 'auto';
    if (isPrioritySet) {
      const goodName = ship.cargoPriority!.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        shipId: ship.id,
        shipName: ship.name,
        tier: ship.tier,
        typeId: ship.typeId,
        homeIslandId: ship.homeIslandId,
        currentIslandId: ship.currentIslandId,
        targetIslandId: null,
        state: 'idle',
        reason: 'priority_starvation',
        severity: 'high',
        fillPct: 0,
        label: 'Starved',
        details: `Docked idle at ${portName}. Waiting for prioritized ${goodName}, but local stock or export is unavailable.`,
        recommendation: `Reset priority to Auto or reassign to a port producing ${goodName}.`,
      };
    }
    return {
      shipId: ship.id,
      shipName: ship.name,
      tier: ship.tier,
      typeId: ship.typeId,
      homeIslandId: ship.homeIslandId,
      currentIslandId: ship.currentIslandId,
      targetIslandId: null,
      state: 'idle',
      reason: 'idle_in_port',
      severity: 'high',
      fillPct: 0,
      label: 'Idle',
      details: `Docked idle at ${portName}. No profitable export trade routes or insufficient stock at harbor.`,
      recommendation: `Awaken neighboring consumer ports or assign cargo priority to a needed commodity.`,
    };
  }

  // 2. Sailing with completely empty cargo hold
  if (ship.state === 'sailing' && (!ship.cargo || ship.cargo.quantity <= 0)) {
    const destName = ship.targetIslandId
      ? (sim.islandsData.get(ship.targetIslandId)?.name || ship.targetIslandId)
      : 'destination';
    return {
      shipId: ship.id,
      shipName: ship.name,
      tier: ship.tier,
      typeId: ship.typeId,
      homeIslandId: ship.homeIslandId,
      currentIslandId: ship.currentIslandId,
      targetIslandId: ship.targetIslandId,
      state: 'sailing',
      reason: 'empty_hold',
      severity: 'high',
      fillPct: 0,
      label: 'Ballast',
      details: `Sailing empty hold towards ${destName}. Incurring daily upkeep (🪙 ${ship.upkeepPerDay}/d) without carrying freight.`,
      recommendation: `Ensure departure port has ample export inventory or re-route.`,
    };
  }

  // 3. Low cargo hold utilization (< 35% of capacity for ships with capacity >= 40 tons)
  if (ship.cargo && ship.cargo.quantity > 0) {
    const fillPct = Math.round((ship.cargo.quantity / ship.capacity) * 100);
    if (ship.capacity >= 40 && fillPct < 35) {
      const goodName = ship.cargo.goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        shipId: ship.id,
        shipName: ship.name,
        tier: ship.tier,
        typeId: ship.typeId,
        homeIslandId: ship.homeIslandId,
        currentIslandId: ship.currentIslandId,
        targetIslandId: ship.targetIslandId,
        state: ship.state,
        reason: 'low_cargo_fill',
        severity: fillPct < 20 ? 'high' : 'medium',
        fillPct,
        label: `Low (${fillPct}%)`,
        details: `Carrying only ${ship.cargo.quantity}t of ${goodName} in a ${ship.capacity}t hold (${fillPct}% utilization).`,
        recommendation: `Wait for larger production batches or swap with smaller vessel class.`,
      };
    }
  }

  return null;
}
