/**
 * Aegean Tycoon - Game State Serialization & Versioned Save/Load System.
 * Adheres to AGENTS.md Rule 6: Headless simulation logic only, no render imports, unit-tested.
 */

import type { SimulationCore } from './simulation';
import { toSingleWordShipName, type ShipCargo, type ShipInstance, type ShipState } from './shipSim';

export const CURRENT_SAVE_VERSION = 1;
export const DEFAULT_SAVE_KEY = 'aegean_game_save_v1';

export interface SavedMarketV1 {
  stock: number;
  buyPrice: number;
  sellPrice: number;
  produceRatePerDay?: number;
  consumeRatePerDay?: number;
}

export interface SavedIslandEconomyV1 {
  id: string;
  unlocked: boolean;
  prosperity: number;
  distress: number;
  markets: Record<string, SavedMarketV1>;
}

export interface SavedShipV1 {
  id: string;
  name: string;
  typeId: string;
  tier: number;
  capacity: number;
  speedKmPerDay: number;
  upkeepPerDay: number;
  state: ShipState;
  homeIslandId: string;
  currentIslandId: string | null;
  targetIslandId: string | null;
  cargo: ShipCargo | null;
  distanceTraveledKm: number;
  position: { lon: number; lat: number };
  heading: number;
  stateTimeRemaining: number;
  tripsCompleted: number;
  totalDeliveredValue: number;
  totalProfit: number;
  cargoPriority?: string;
}

export interface GameSaveV1 {
  version: 1;
  timestamp: number;
  gameDay: number;
  totalTicks: number;
  treasury: number;
  tradePoints: number;
  unlockedIslands: string[];
  islandDeliveries: Record<string, number>;
  islands: Record<string, SavedIslandEconomyV1>;
  ships: SavedShipV1[];
}

/**
 * Serializes the current active simulation state into a JSON-compatible GameSaveV1 object.
 */
export function serializeSimulation(sim: SimulationCore): GameSaveV1 {
  const islands: Record<string, SavedIslandEconomyV1> = {};
  for (const [id, economy] of sim.islands.entries()) {
    const markets: Record<string, SavedMarketV1> = {};
    for (const [goodId, market] of Object.entries(economy.markets)) {
      markets[goodId] = {
        stock: market.stock,
        buyPrice: market.buyPrice,
        sellPrice: market.sellPrice,
        produceRatePerDay: market.produceRatePerDay,
        consumeRatePerDay: market.consumeRatePerDay,
      };
    }
    islands[id] = {
      id,
      unlocked: economy.unlocked,
      prosperity: economy.prosperity,
      distress: economy.distress,
      markets,
    };
  }

  const ships: SavedShipV1[] = [];
  if (sim.shipManager) {
    for (const ship of sim.shipManager.ships.values()) {
      ships.push({
        id: ship.id,
        name: ship.name,
        typeId: ship.typeId,
        tier: ship.tier,
        capacity: ship.capacity,
        speedKmPerDay: ship.speedKmPerDay,
        upkeepPerDay: ship.upkeepPerDay,
        state: ship.state,
        homeIslandId: ship.homeIslandId,
        currentIslandId: ship.currentIslandId,
        targetIslandId: ship.targetIslandId,
        cargo: ship.cargo ? { ...ship.cargo } : null,
        distanceTraveledKm: ship.distanceTraveledKm,
        position: { lon: ship.position.lon, lat: ship.position.lat },
        heading: ship.heading,
        stateTimeRemaining: ship.stateTimeRemaining,
        tripsCompleted: ship.tripsCompleted,
        totalDeliveredValue: ship.totalDeliveredValue,
        totalProfit: ship.totalProfit,
        cargoPriority: ship.cargoPriority || 'auto',
      });
    }
  }

  const islandDeliveries: Record<string, number> = {};
  if (sim.shipManager) {
    for (const [islandId, count] of sim.shipManager.islandDeliveryCounts.entries()) {
      islandDeliveries[islandId] = count;
    }
  }

  return {
    version: 1,
    timestamp: Date.now(),
    gameDay: Math.round(sim.gameDay * 1000) / 1000,
    totalTicks: sim.totalTicks,
    treasury: Math.round(sim.treasury * 100) / 100,
    tradePoints: sim.tradePoints,
    unlockedIslands: Array.from(sim.unlockedIslands),
    islandDeliveries,
    islands,
    ships,
  };
}

/**
 * Deserializes a GameSaveV1 snapshot into a live SimulationCore instance.
 * Restores unlocked islands, treasury, trade points, market dynamics, and ships.
 */
export function deserializeSimulation(sim: SimulationCore, save: GameSaveV1): boolean {
  if (!save || save.version !== 1) {
    console.warn('Incompatible or invalid save file version:', save?.version);
    return false;
  }

  try {
    sim.gameDay = save.gameDay || 0;
    sim.totalTicks = save.totalTicks || 0;
    sim.treasury = save.treasury ?? sim.balance.startingTreasury;
    sim.tradePoints = save.tradePoints ?? sim.balance.startingTradePoints;

    // Restore unlocked islands
    sim.unlockedIslands.clear();
    for (const id of save.unlockedIslands) {
      if (sim.islandsData.has(id)) {
        sim.unlockedIslands.add(id);
      }
    }

    // Restore island economies
    for (const [id, savedEconomy] of Object.entries(save.islands)) {
      const liveEconomy = sim.islands.get(id);
      if (!liveEconomy) continue;

      liveEconomy.unlocked = savedEconomy.unlocked;
      liveEconomy.prosperity = savedEconomy.prosperity;
      liveEconomy.distress = savedEconomy.distress;

      for (const [goodId, savedMarket] of Object.entries(savedEconomy.markets)) {
        const liveMarket = liveEconomy.markets[goodId];
        if (liveMarket) {
          liveMarket.stock = savedMarket.stock;
          liveMarket.buyPrice = savedMarket.buyPrice;
          liveMarket.sellPrice = savedMarket.sellPrice;
          if (typeof savedMarket.produceRatePerDay === 'number') liveMarket.produceRatePerDay = savedMarket.produceRatePerDay;
          if (typeof savedMarket.consumeRatePerDay === 'number') liveMarket.consumeRatePerDay = savedMarket.consumeRatePerDay;
        }
      }
    }

    // Restore shipping operations
    if (sim.shipManager) {
      sim.shipManager.clearAllShips();
      sim.shipManager.islandDeliveryCounts.clear();

      for (const [islandId, count] of Object.entries(save.islandDeliveries || {})) {
        sim.shipManager.islandDeliveryCounts.set(islandId, count);
      }

      for (const savedShip of save.ships) {
        // Validate existence of homeIsland
        const island = sim.islandsData.get(savedShip.homeIslandId);
        if (!island) continue;

        const ship: ShipInstance = {
          id: savedShip.id,
          name: toSingleWordShipName(savedShip.name),
          typeId: savedShip.typeId,
          tier: savedShip.tier,
          capacity: savedShip.capacity,
          speedKmPerDay: savedShip.speedKmPerDay,
          upkeepPerDay: savedShip.upkeepPerDay,
          state: savedShip.state,
          homeIslandId: savedShip.homeIslandId,
          currentIslandId: savedShip.currentIslandId,
          targetIslandId: savedShip.targetIslandId,
          cargo: savedShip.cargo ? { ...savedShip.cargo } : null,
          path: null, // Will recompute or transition cleanly upon next sailing tick
          distanceTraveledKm: savedShip.distanceTraveledKm || 0,
          position: { lon: savedShip.position.lon, lat: savedShip.position.lat },
          heading: savedShip.heading || 0,
          stateTimeRemaining: savedShip.stateTimeRemaining || 0.05,
          tripsCompleted: savedShip.tripsCompleted || 0,
          totalDeliveredValue: savedShip.totalDeliveredValue || 0,
          totalProfit: savedShip.totalProfit || 0,
          cargoPriority: savedShip.cargoPriority || 'auto',
        };

        // If ship was actively sailing, recreate its navigation path if possible
        if (ship.state === 'sailing' && ship.targetIslandId && sim.navGraph) {
          const fromIsland = sim.islandsData.get(ship.currentIslandId || ship.homeIslandId);
          const toIsland = sim.islandsData.get(ship.targetIslandId);
          if (fromIsland && toIsland) {
            ship.path = sim.navGraph.findPathBetweenIslands(fromIsland.id, toIsland.id);
          }
        }

        sim.shipManager.registerShip(ship);
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to deserialize simulation save data:', err);
    return false;
  }
}

/**
 * Saves the current simulation state to browser localStorage.
 */
export function saveToStorage(sim: SimulationCore, storageKey = DEFAULT_SAVE_KEY): boolean {
  try {
    const save = serializeSimulation(sim);
    const json = JSON.stringify(save);
    localStorage.setItem(storageKey, json);
    return true;
  } catch (err) {
    console.warn('Failed to save simulation to localStorage:', err);
    return false;
  }
}

/**
 * Loads and applies saved simulation state from browser localStorage.
 */
export function loadFromStorage(sim: SimulationCore, storageKey = DEFAULT_SAVE_KEY): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const save = JSON.parse(raw) as GameSaveV1;
    return deserializeSimulation(sim, save);
  } catch (err) {
    console.warn('Failed to load simulation from localStorage:', err);
    return false;
  }
}

/**
 * Checks whether a valid save exists in localStorage.
 */
export function hasSaveInStorage(storageKey = DEFAULT_SAVE_KEY): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const save = JSON.parse(raw);
    return save && save.version === 1 && typeof save.treasury === 'number';
  } catch {
    return false;
  }
}

/**
 * Clears saved game data from browser localStorage (e.g. for New Game reset).
 */
export function clearSaveFromStorage(storageKey = DEFAULT_SAVE_KEY): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (err) {
    console.warn('Failed to clear save from localStorage:', err);
  }
}
