/**
 * Pure simulation economy functions.
 * No rendering dependencies permitted.
 */

export interface PriceCalculationParams {
  basePrice: number;
  stock: number;
  targetStock: number;
  elasticity?: number;
}

/**
 * Calculates current market price based on supply vs desired buffer.
 * Formula from DATA_AND_ECONOMY.md:
 * price = basePrice * clamp((target / (stock + 1)) ^ k, 0.3, 3.0)
 */
export function calculatePrice({
  basePrice,
  stock,
  targetStock,
  elasticity = 0.7,
}: PriceCalculationParams): number {
  if (basePrice <= 0) return 0;
  const ratio = Math.max(0.01, targetStock / (Math.max(0, stock) + 1));
  const factor = Math.pow(ratio, elasticity);
  const clampedFactor = Math.min(3.0, Math.max(0.3, factor));
  return Math.round(basePrice * clampedFactor * 100) / 100;
}

export function updateStock(
  currentStock: number,
  productionRate: number,
  consumptionRate: number,
  deltaDays: number,
  maxCapacity: number
): { stock: number; isStarving: boolean } {
  const netChange = (productionRate - consumptionRate) * deltaDays;
  const nextStock = Math.min(maxCapacity, Math.max(0, currentStock + netChange));
  const isStarving = nextStock <= 0.05 && consumptionRate > 0;
  return { stock: nextStock, isStarving };
}
