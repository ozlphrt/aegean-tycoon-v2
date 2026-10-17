/**
 * Aegean Tycoon - First-Time User 5-Minute Preview & Transition System.
 * Adheres to AGENTS.md Rule 6: Headless simulation logic only, no render imports, unit-tested.
 */

import type { SimulationCore } from './simulation';
import { hasSaveInStorage, saveToStorage, DEFAULT_SAVE_KEY } from './saveLoad';

export const PREVIEW_DURATION_SEC = 300; // 5 minutes in seconds
export const PREVIEW_COMPLETED_KEY = 'aegean_preview_completed';
export const PREVIEW_START_TIME_KEY = 'aegean_preview_start_time';

/**
 * Checks whether the user has already concluded or dismissed the 5-minute preview period.
 */
export function isPreviewCompleted(storageKey = DEFAULT_SAVE_KEY): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(PREVIEW_COMPLETED_KEY) === 'true' || hasSaveInStorage(storageKey);
  } catch {
    return false;
  }
}

/**
 * Returns true if this is a brand new user who has never saved progress
 * and has not yet completed the 5-minute preview experience.
 */
export function isFirstTimeUser(storageKey = DEFAULT_SAVE_KEY): boolean {
  return !hasSaveInStorage(storageKey) && !isPreviewCompleted();
}

/**
 * Returns remaining seconds of the 5-minute preview, or 0 if expired.
 */
export function getPreviewRemainingSeconds(): number {
  try {
    if (typeof localStorage === 'undefined') return PREVIEW_DURATION_SEC;
    const stored = localStorage.getItem(PREVIEW_START_TIME_KEY);
    if (!stored) return PREVIEW_DURATION_SEC;
    const startMs = parseInt(stored, 10);
    if (isNaN(startMs) || startMs <= 0) return PREVIEW_DURATION_SEC;

    const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
    return Math.max(0, PREVIEW_DURATION_SEC - elapsedSec);
  } catch {
    return PREVIEW_DURATION_SEC;
  }
}

/**
 * Records the timestamp when the 5-minute preview session started.
 */
export function startPreviewSession(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!localStorage.getItem(PREVIEW_START_TIME_KEY)) {
      localStorage.setItem(PREVIEW_START_TIME_KEY, Date.now().toString());
    }
  } catch (err) {
    console.warn('Failed to record preview start time:', err);
  }
}

/**
 * Marks the 5-minute preview session as completed so the user is never prompted again.
 */
export function completePreviewSession(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PREVIEW_COMPLETED_KEY, 'true');
    localStorage.removeItem(PREVIEW_START_TIME_KEY);
  } catch (err) {
    console.warn('Failed to mark preview completed:', err);
  }
}

/**
 * Resets the active simulation back to Day 1 "zero" (clean slate virgin start).
 * Restores starting treasury (120 drachmas), starting trade points (0 TP),
 * starting islands (Santorini & Naxos), and starting 2 kaiki fishing boats.
 * Automatically saves this virgin state so all subsequent user progress is stored.
 */
export function resetSimulationToCleanSlate(sim: SimulationCore): boolean {
  if (!sim) return false;

  try {
    sim.gameDay = 1.0;
    sim.totalTicks = 0;
    sim.treasury = sim.balance.startingTreasury || 120;
    sim.tradePoints = sim.balance.startingTradePoints || 0;

    // Reset unlocked islands to default starting ports
    sim.unlockedIslands.clear();
    for (const [id, isl] of sim.islandsData.entries()) {
      const isStart = isl.unlock.isStart ?? (id === 'santorini' || id === 'naxos');
      if (isStart) {
        sim.unlockedIslands.add(id);
      }

      // Reset island economy
      const econ = sim.islands.get(id);
      if (econ) {
        econ.unlocked = isStart;
        econ.prosperity = 0.5;
        econ.distress = 0;
        for (const [goodId, market] of Object.entries(econ.markets)) {
          const goodDef = sim.goodsData.get(goodId);
          market.buyPrice = goodDef?.basePrice || 20;
          market.sellPrice = Math.max(1, (goodDef?.basePrice || 20) * 0.95);
          if (market.produceRatePerDay && market.produceRatePerDay > 0) {
            market.stock = Math.floor(market.produceRatePerDay * 3);
          } else {
            market.stock = 5;
          }
        }
      }
    }

    // Reset fleet to 2 starting fishing boats
    if (sim.shipManager) {
      sim.shipManager.clearAllShips();
      sim.shipManager.islandDeliveryCounts.clear();

      sim.shipManager.spawnShip('fishing_boat', 'santorini', sim, 'Nikolaos');
      sim.shipManager.spawnShip('fishing_boat', 'naxos', sim, 'Delphis');
    }

    // Mark preview completed and save initial player progress
    completePreviewSession();
    saveToStorage(sim);

    return true;
  } catch (err) {
    console.error('Failed to reset simulation to clean slate:', err);
    return false;
  }
}
