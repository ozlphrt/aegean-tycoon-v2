import type {
  IslandData,
  GoodDefinition,
  BalanceConfig,
  ShipDefinition,
  IslandEconomyState,
  SimulationSnapshot,
  ShipDataSnapshot,
} from '../data/types';
import { initIslandEconomy, tickIslandEconomy } from './islandSim';
import { SeaLaneGraph, type SeaLanesData } from './nav';
import {
  ShipSimulationManager,
  type ShipInstance,
  type ShipDeliveryEvent,
  type ShipStatusEvent,
  type UnderutilizedShipInfo,
} from './shipSim';
import { WeatherSystem } from './weather';
import { IslandEventManager, type IslandEvent } from './events';

export type SimulationListener = (snapshot: SimulationSnapshot) => void;

/**
 * Deterministic, headless simulation engine for Aegean Tycoon.
 * Fully decoupled from Three.js and DOM. Unit-testable in Node/Vitest.
 */
export class SimulationCore {
  public islandsData: Map<string, IslandData> = new Map();
  public goodsData: Map<string, GoodDefinition> = new Map();
  public shipDefs: Map<string, ShipDefinition> = new Map();
  public balance: BalanceConfig;

  public islands: Map<string, IslandEconomyState> = new Map();
  public unlockedIslands: Set<string> = new Set();

  public navGraph: SeaLaneGraph | null = null;
  public shipManager: ShipSimulationManager | null = null;

  public treasury: number;
  public tradePoints: number;

  public totalTicks = 0;
  public gameDay = 0.0;
  public gameSpeed = 1; // 0: paused, 1: normal, 4: fast, 16: ultra
  public recentTransactionsCount = 0;
  public weather = new WeatherSystem();
  public eventManager = new IslandEventManager();

  private startDate: Date;
  private listeners: Set<SimulationListener> = new Set();
  private deliveryListeners: Set<(event: ShipDeliveryEvent) => void> = new Set();
  private statusListeners: Set<(event: ShipStatusEvent) => void> = new Set();

  constructor(
    islands: IslandData[],
    goods: GoodDefinition[],
    balance: BalanceConfig,
    seaLanes?: SeaLanesData,
    shipsConfig?: ShipDefinition[]
  ) {
    this.balance = balance;
    this.treasury = balance.startingTreasury;
    this.tradePoints = balance.startingTradePoints;
    this.startDate = new Date(balance.startingGameDate || '2026-05-01T00:00:00Z');

    for (const g of goods) {
      this.goodsData.set(g.id, g);
    }

    if (shipsConfig) {
      for (const s of shipsConfig) {
        this.shipDefs.set(s.id, s);
      }
    }

    for (const isl of islands) {
      this.islandsData.set(isl.id, isl);
      // Santorini and Naxos start unlocked by default
      const isStart = isl.unlock.isStart ?? (isl.id === 'santorini' || isl.id === 'naxos');
      if (isStart) {
        this.unlockedIslands.add(isl.id);
      }
      const economy = initIslandEconomy(isl, goods, balance, isStart);
      this.islands.set(isl.id, economy);
    }

    if (seaLanes && shipsConfig) {
      this.navGraph = new SeaLaneGraph(seaLanes);
      this.shipManager = new ShipSimulationManager(this.navGraph, this.shipDefs);
      this.shipManager.onDelivery((evt) => {
        for (const l of this.deliveryListeners) {
          l(evt);
        }
      });
      this.shipManager.onStatus((evt) => {
        for (const l of this.statusListeners) {
          l(evt);
        }
      });
      // Spawn starting fishing boats at Santorini and Naxos
      this.spawnInitialFleet();
    }
  }

  private spawnInitialFleet(): void {
    if (!this.shipManager) return;
    this.shipManager.spawnShip('fishing_boat', 'santorini', this, 'Nikolaos');
    this.shipManager.spawnShip('fishing_boat', 'naxos', this, 'Delphis');
  }

  public onShipDelivery(listener: (event: ShipDeliveryEvent) => void): () => void {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  public onShipStatus(listener: (event: ShipStatusEvent) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public onEventStart(listener: (event: IslandEvent) => void): () => void {
    return this.eventManager.onEventStart(listener);
  }

  public onEventEnd(listener: (event: IslandEvent) => void): () => void {
    return this.eventManager.onEventEnd(listener);
  }

  /**
   * Computes the maximum number of home-ported vessels allowed at an island harbor,
   * dynamically bounded by island population, trade throughput volume (economic potential),
   * prosperity state, and mainland vs island infrastructure.
   */
  public getPortFleetCapacity(islandId: string): number {
    const data = this.islandsData.get(islandId);
    if (!data) return 6;

    const economy = this.islands.get(islandId);
    const pop = data.population || 0;

    // 1. Generous base berths for any active Aegean harbor (increased from 2)
    let berths = 6;

    // 2. Population scaling: +1 berth per 5,000 population (increased from 15,000)
    berths += Math.floor(pop / 5000);

    // 3. Economic Potential: Total Trade Throughput (Production + Consumption)
    let totalThroughput = 0;
    if (data.produces) {
      for (const rate of Object.values(data.produces)) {
        totalThroughput += rate;
      }
    }
    if (data.consumes) {
      for (const rate of Object.values(data.consumes)) {
        totalThroughput += rate;
      }
    }
    if (totalThroughput >= 50) {
      berths += 4;
    } else if (totalThroughput >= 30) {
      berths += 3;
    } else if (totalThroughput >= 15) {
      berths += 2;
    } else if (totalThroughput >= 5) {
      berths += 1;
    }

    // 4. Mainland deepwater terminal infrastructure bonus (major commercial hub)
    if (data.type === 'mainland_port') {
      berths += 6;
    }

    // 5. Island Prosperity & Harbor Modernization
    const prosperity = economy?.prosperity ?? 0.5;
    if (prosperity >= 0.75) {
      berths += 2; // Booming commercial expansion bonus
    } else if (prosperity >= 0.5) {
      berths += 1; // Active commercial trade tier
    } else if (economy && economy.distress > 0.25) {
      berths = Math.max(4, berths - 2); // Logistics breakdown / port distress penalty
    }

    return Math.max(6, berths);
  }

  /**
   * Returns the count of active vessels currently home-ported at an island.
   */
  public getHomePortedShipsCount(islandId: string): number {
    if (!this.shipManager) return 0;
    let count = 0;
    for (const ship of this.shipManager.ships.values()) {
      if (ship.homeIslandId === islandId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns all currently underutilized ships across the active fleet (idle in port, low hold fill, empty ballast voyage).
   */
  public getUnderutilizedShips(): UnderutilizedShipInfo[] {
    return this.shipManager ? this.shipManager.getUnderutilizedShips(this) : [];
  }

  /**
   * Returns underutilized ships stationed, home-ported, or currently en route to a specific island.
   */
  public getUnderutilizedShipsForIsland(islandId: string): UnderutilizedShipInfo[] {
    return this.shipManager ? this.shipManager.getUnderutilizedShipsForIsland(this, islandId) : [];
  }

  public buyShip(
    typeId: string,
    homeIslandId: string
  ): { success: boolean; ship?: ShipInstance; reason?: string } {
    if (!this.shipManager) return { success: false, reason: 'Ship manager not active' };
    const def = this.shipDefs.get(typeId);
    if (!def) return { success: false, reason: 'Ship type not found' };

    if (!this.unlockedIslands.has(homeIslandId)) {
      return { success: false, reason: 'Harbor port is not yet unlocked' };
    }

    const currentBerths = this.getHomePortedShipsCount(homeIslandId);
    const maxBerths = this.getPortFleetCapacity(homeIslandId);
    if (currentBerths >= maxBerths) {
      const islName = this.islandsData.get(homeIslandId)?.name || 'Port';
      return {
        success: false,
        reason: `${islName} harbor berths full (${currentBerths}/${maxBerths} vessels). Reroute existing fleet or expand island population & prosperity.`,
      };
    }

    if (this.treasury < def.cost) {
      return { success: false, reason: `Need 🪙 ${def.cost} drachmas (have ${Math.floor(this.treasury)})` };
    }

    if (this.unlockedIslands.size < (def.unlock.islandsConnected || 1)) {
      return {
        success: false,
        reason: `Requires at least ${def.unlock.islandsConnected} connected islands`,
      };
    }

    const ship = this.shipManager.spawnShip(typeId, homeIslandId, this);
    if (!ship) return { success: false, reason: 'Failed to spawn ship at harbor' };

    this.treasury -= def.cost;
    return { success: true, ship };
  }

  /**
   * Calculates the scrap / salvage drachma refund for decommissioning a vessel.
   * Standard salvage value is 50% of the ship's base construction cost,
   * plus 50% of the wholesale value of any cargo currently carried.
   */
  public getShipDecommissionRefund(shipId: string): number {
    if (!this.shipManager) return 0;
    const ship = this.shipManager.ships.get(shipId);
    if (!ship) return 0;
    const def = this.shipDefs.get(ship.typeId);
    const baseRefund = Math.floor((def?.cost || 100) * 0.5);
    let cargoRefund = 0;
    if (ship.cargo && ship.cargo.quantity > 0) {
      const goodDef = this.goodsData.get(ship.cargo.goodId);
      cargoRefund = Math.floor((goodDef?.basePrice || 10) * ship.cargo.quantity * 0.5);
    }
    return baseRefund + cargoRefund;
  }

  /**
   * Decommissions and scraps an active vessel from the fleet.
   * Immediately frees 1 harbor berth at its home port and credits salvage drachmas to treasury.
   */
  public decommissionShip(
    shipId: string
  ): { success: boolean; refund: number; shipName?: string; homePortId?: string; reason?: string } {
    if (!this.shipManager) return { success: false, refund: 0, reason: 'Ship manager not active' };
    const ship = this.shipManager.ships.get(shipId);
    if (!ship) return { success: false, refund: 0, reason: 'Ship not found in active fleet' };

    const refund = this.getShipDecommissionRefund(shipId);
    const shipName = ship.name;
    const homePortId = ship.homeIslandId;

    // Despawn from active fleet simulation
    this.shipManager.removeShip(shipId);

    // Credit salvage drachmas
    this.treasury += refund;

    return {
      success: true,
      refund,
      shipName,
      homePortId,
    };
  }

  public setShipCargoPriority(shipId: string, priority: string): boolean {
    if (!this.shipManager) return false;
    const ship = this.shipManager.ships.get(shipId);
    if (!ship) return false;
    ship.cargoPriority = priority;
    return true;
  }

  public redirectShip(shipId: string, targetIslandId: string, priorityGoodId?: string): boolean {
    if (!this.shipManager) return false;
    return this.shipManager.redirectShip(shipId, targetIslandId, priorityGoodId);
  }

  public subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setSpeed(speed: number): void {
    if (speed === 0 || speed === 1 || speed === 4 || speed === 16) {
      this.gameSpeed = speed;
    }
  }

  /**
   * Advances the simulation by real-world delta seconds.
   */
  public update(realDeltaSec: number): void {
    if (this.gameSpeed === 0 || realDeltaSec <= 0) return;

    // Cap deltaSec to avoid spiral of death on window background tab
    const clampedDeltaSec = Math.min(0.5, realDeltaSec);
    const effectiveSec = clampedDeltaSec * this.gameSpeed;
    const deltaDays = effectiveSec / this.balance.secondsPerGameDay;

    this.step(deltaDays);
  }

  /**
   * Directly advances the simulation by game days (fixed timestep).
   */
  public step(deltaDays: number): void {
    if (deltaDays <= 0) return;

    this.totalTicks++;
    this.gameDay += deltaDays;
    this.weather.updateForGameDay(this.gameDay);
    this.eventManager.tick(this, deltaDays);

    // Advance economy for each island
    for (const economy of this.islands.values()) {
      tickIslandEconomy(economy, this.goodsData, this.balance, deltaDays, (goodId) =>
        this.eventManager.getMultipliers(economy.islandId, goodId)
      );
    }

    // Advance autonomous shipping operations
    this.shipManager?.tick(this, deltaDays);

    // Notify listeners
    if (this.listeners.size > 0 && this.totalTicks % 2 === 0) {
      const snap = this.getSnapshot();
      for (const listener of this.listeners) {
        listener(snap);
      }
    }
  }

  /**
   * Formats the current in-game calendar date (e.g., "15 May 2026").
   */
  public getFormattedDate(): string {
    const msOffset = this.gameDay * 86400 * 1000;
    const curDate = new Date(this.startDate.getTime() + msOffset);
    return curDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Unlocks an island into the trade network if prerequisites and costs are met.
   */
  public unlockIsland(islandId: string): { success: boolean; reason?: string; requiredIslands?: string[] } {
    const island = this.islandsData.get(islandId);
    if (!island) return { success: false, reason: 'Island not found' };

    const state = this.islands.get(islandId);
    if (!state) return { success: false, reason: 'State not found' };
    if (state.unlocked) return { success: false, reason: 'Already unlocked' };

    const cost = island.unlock.cost || 0;
    const tp = island.unlock.tp || 0;

    if (this.treasury < cost) {
      return { success: false, reason: `Need 🪙 ${cost} drachmas (have ${Math.floor(this.treasury)})` };
    }
    if (this.tradePoints < tp) {
      return { success: false, reason: `Need ⚓ ${tp} TP (have ${this.tradePoints})` };
    }

    // Check connectivity requirements if any
    const required = island.unlock.requiresConnectedTo;
    if (required && required.length > 0) {
      const hasConnection = required.some((reqId) => this.unlockedIslands.has(reqId));
      if (!hasConnection) {
        const names = required.map((id) => this.islandsData.get(id)?.name || id);
        return {
          success: false,
          reason: `Must connect to ${names.join(' or ')} first`,
          requiredIslands: required,
        };
      }
    }

    this.treasury -= cost;
    this.tradePoints -= tp;
    state.unlocked = true;
    state.prosperity = Math.max(state.prosperity, 0.65);
    this.unlockedIslands.add(islandId);

    return { success: true };
  }

  /**
   * Player or ship buys goods from an island market.
   */
  public buyFromIsland(
    islandId: string,
    goodId: string,
    quantity: number
  ): { success: boolean; actualQty: number; totalCost: number; unitPrice: number } {
    const state = this.islands.get(islandId);
    if (!state) return { success: false, actualQty: 0, totalCost: 0, unitPrice: 0 };

    const market = state.markets[goodId];
    if (!market || market.stock <= 0) {
      return { success: false, actualQty: 0, totalCost: 0, unitPrice: 0 };
    }

    const actualQty = Math.min(quantity, Math.floor(market.stock));
    if (actualQty <= 0) {
      return { success: false, actualQty: 0, totalCost: 0, unitPrice: 0 };
    }

    const unitPrice = market.buyPrice;
    const totalCost = Math.round(unitPrice * actualQty * 100) / 100;

    market.stock -= actualQty;
    this.recentTransactionsCount++;

    return { success: true, actualQty, totalCost, unitPrice };
  }

  /**
   * Player or ship sells goods to an island market.
   */
  public sellToIsland(
    islandId: string,
    goodId: string,
    quantity: number
  ): { success: boolean; actualQty: number; totalRevenue: number; unitPrice: number } {
    const state = this.islands.get(islandId);
    if (!state) return { success: false, actualQty: 0, totalRevenue: 0, unitPrice: 0 };

    const market = state.markets[goodId];
    if (!market) return { success: false, actualQty: 0, totalRevenue: 0, unitPrice: 0 };

    const room = Math.max(0, market.maxCapacity - market.stock);
    const actualQty = Math.min(quantity, Math.floor(room));
    if (actualQty <= 0) {
      return { success: false, actualQty: 0, totalRevenue: 0, unitPrice: 0 };
    }

    const unitPrice = market.sellPrice;
    const totalRevenue = Math.round(unitPrice * actualQty * 100) / 100;

    market.stock += actualQty;
    // Deliveries generate Trade Points
    const tpGain = Math.max(1, Math.round(totalRevenue / 50));
    this.tradePoints += tpGain;
    this.recentTransactionsCount++;

    return { success: true, actualQty, totalRevenue, unitPrice };
  }

  /**
   * Generates a snapshot of the current simulation state.
   */
  public getSnapshot(): SimulationSnapshot {
    const islandsRecord: Record<string, IslandEconomyState> = {};
    for (const [id, st] of this.islands.entries()) {
      islandsRecord[id] = {
        islandId: st.islandId,
        unlocked: st.unlocked,
        prosperity: st.prosperity,
        distress: st.distress,
        markets: { ...st.markets },
      };
    }

    const shipsList: ShipDataSnapshot[] = [];
    if (this.shipManager) {
      for (const s of this.shipManager.ships.values()) {
        shipsList.push({
          id: s.id,
          name: s.name,
          typeId: s.typeId,
          tier: s.tier,
          capacity: s.capacity,
          state: s.state,
          homeIslandId: s.homeIslandId,
          currentIslandId: s.currentIslandId,
          targetIslandId: s.targetIslandId,
          cargo: s.cargo ? { ...s.cargo } : null,
          position: { ...s.position },
          heading: s.heading,
          tripsCompleted: s.tripsCompleted,
          totalProfit: Math.round(s.totalProfit * 100) / 100,
          cargoPriority: s.cargoPriority || 'auto',
        });
      }
    }

    return {
      gameDay: Math.round(this.gameDay * 100) / 100,
      gameDate: this.getFormattedDate(),
      totalTicks: this.totalTicks,
      treasury: Math.round(this.treasury * 100) / 100,
      tradePoints: this.tradePoints,
      unlockedIslandsCount: this.unlockedIslands.size,
      islands: islandsRecord,
      ships: shipsList,
      recentTransactionsCount: this.recentTransactionsCount,
    };
  }

  /**
   * Runs an intensive headless soak test to assert numerical stability over hundreds of game days.
   */
  public soakTest(ticks: number, stepDays = 0.1): { ok: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let t = 0; t < ticks; t++) {
      this.step(stepDays);

      if (isNaN(this.treasury) || !isFinite(this.treasury)) {
        errors.push(`Tick ${t}: NaN treasury detected`);
        break;
      }

      // Check a sample of island markets for NaN or out of bounds
      for (const [id, isl] of this.islands.entries()) {
        if (isNaN(isl.distress) || isNaN(isl.prosperity)) {
          errors.push(`Tick ${t}, Island ${id}: NaN distress/prosperity`);
          break;
        }

        for (const [gid, m] of Object.entries(isl.markets)) {
          if (isNaN(m.stock) || isNaN(m.buyPrice) || isNaN(m.sellPrice)) {
            errors.push(`Tick ${t}, Island ${id}, Good ${gid}: NaN in stock/price`);
            break;
          }
          if (m.stock < -0.01) {
            errors.push(`Tick ${t}, Island ${id}, Good ${gid}: Negative stock ${m.stock}`);
            break;
          }
        }
      }

      if (errors.length > 0) break;
    }

    return { ok: errors.length === 0, errors };
  }
}
