import type { CommodityMarketState } from '../data/types';

/**
 * Pure simulation economy functions.
 * Strictly decoupled from rendering and browser APIs.
 */

export interface PriceCalculationParams {
  basePrice: number;
  stock: number;
  targetStock: number;
  elasticity?: number;
  minMultiplier?: number;
  maxMultiplier?: number;
}

/**
 * Calculates current market price based on supply vs desired buffer.
 * Formula from DATA_AND_ECONOMY.md:
 * price = basePrice * clamp((target / (stock + 1)) ^ k, minMult, maxMult)
 */
export function calculatePrice({
  basePrice,
  stock,
  targetStock,
  elasticity = 0.7,
  minMultiplier = 0.35,
  maxMultiplier = 2.85,
}: PriceCalculationParams): number {
  if (basePrice <= 0) return 0;
  const safeStock = Math.max(0, stock);
  const safeTarget = Math.max(1, targetStock);
  const ratio = safeTarget / (safeStock + 1.0);
  const factor = Math.pow(ratio, elasticity);
  const clampedFactor = Math.min(maxMultiplier, Math.max(minMultiplier, factor));
  return Math.round(basePrice * clampedFactor * 100) / 100;
}

/**
 * Calculates the target stock buffer for an island market.
 */
export function calculateTargetStock(
  produceRatePerDay: number,
  consumeRatePerDay: number,
  targetBufferDays: number
): number {
  const dailyFlow = Math.max(produceRatePerDay, consumeRatePerDay);
  if (dailyFlow <= 0) return 20; // Nominal reserve for neutral goods
  return Math.max(15, Math.round(dailyFlow * targetBufferDays));
}

/**
 * Calculates storage capacity based on target buffer.
 */
export function calculateStorageCapacity(
  targetStock: number,
  storageFactor: number,
  minCapacity: number
): number {
  return Math.max(minCapacity, Math.round(targetStock * storageFactor));
}

/**
 * Updates stock considering production, consumption, capacity, and perishable decay.
 */
export function updateStock(
  currentStock: number,
  productionRate: number,
  consumptionRate: number,
  deltaDays: number,
  maxCapacity: number,
  isPerishable = false,
  perishableDecayPerDay = 0.04
): { stock: number; isStarving: boolean; isSurplus: boolean } {
  let netDelta = (productionRate - consumptionRate) * deltaDays;

  // Natural decay for perishable fresh goods (fish, produce, dairy)
  if (isPerishable && currentStock > 0) {
    const decay = currentStock * perishableDecayPerDay * deltaDays;
    netDelta -= decay;
  }

  const nextStock = Math.min(maxCapacity, Math.max(0, currentStock + netDelta));
  const isStarving = nextStock <= 0.5 && consumptionRate > 0;
  const isSurplus = nextStock >= maxCapacity * 0.90 && productionRate > 0;

  return {
    stock: Math.round(nextStock * 100) / 100,
    isStarving,
    isSurplus,
  };
}

/**
 * Calculates dynamic prosperity and distress index from market satisfaction.
 */
export function updateDistressAndProsperity(
  currentDistress: number,
  currentProsperity: number,
  markets: Record<string, CommodityMarketState>,
  distressRate: number,
  prosperityRate: number,
  deltaDays: number
): { distress: number; prosperity: number } {
  let starvingCount = 0;
  let surplusCount = 0;
  let totalActiveMarkets = 0;

  for (const m of Object.values(markets)) {
    if (m.consumeRatePerDay > 0 || m.produceRatePerDay > 0) {
      totalActiveMarkets++;
      if (m.isStarving) starvingCount++;
      if (m.isSurplus || m.stock >= m.targetStock) surplusCount++;
    }
  }

  if (totalActiveMarkets === 0) {
    return { distress: currentDistress, prosperity: currentProsperity };
  }

  // Distress climbs if vital imported goods are exhausted
  const starvationRatio = starvingCount / totalActiveMarkets;
  let nextDistress = currentDistress;
  if (starvationRatio > 0) {
    nextDistress = Math.min(1.0, currentDistress + starvationRatio * distressRate * deltaDays * 3.0);
  } else {
    // Naturally recovers when supplied
    nextDistress = Math.max(0.0, currentDistress - distressRate * deltaDays * 2.0);
  }

  // Prosperity climbs with good reserves and low distress
  const fulfillmentRatio = surplusCount / totalActiveMarkets;
  let nextProsperity = currentProsperity;
  if (fulfillmentRatio >= 0.70 && nextDistress < 0.15) {
    nextProsperity = Math.min(1.0, currentProsperity + prosperityRate * deltaDays);
  } else if (nextDistress > 0.40) {
    nextProsperity = Math.max(0.1, currentProsperity - prosperityRate * deltaDays * 1.5);
  }

  return {
    distress: Math.round(nextDistress * 1000) / 1000,
    prosperity: Math.round(nextProsperity * 1000) / 1000,
  };
}
