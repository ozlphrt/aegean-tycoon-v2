import type { IslandData, GoodDefinition, BalanceConfig, IslandEconomyState, CommodityMarketState } from '../data/types';
import { calculatePrice, calculateTargetStock, calculateStorageCapacity, updateStock, updateDistressAndProsperity } from './economy';

/**
 * Initializes the full economic state of an island from its metadata and goods roster.
 */
export function initIslandEconomy(
  island: IslandData,
  goods: GoodDefinition[],
  balance: BalanceConfig,
  unlocked = false
): IslandEconomyState {
  const markets: Record<string, CommodityMarketState> = {};

  for (const good of goods) {
    const produceRate = island.produces[good.id] || 0;
    const consumeRate = island.consumes[good.id] || 0;

    const targetStock = calculateTargetStock(produceRate, consumeRate, balance.targetBufferDays);
    const maxCapacity = calculateStorageCapacity(
      targetStock,
      balance.storageCapacityFactor,
      balance.minStorageCapacity
    );

    // Initial stock: producers start with healthy buffer; non-producers start with initial reserve
    let initialStock = Math.round(targetStock * 0.75);
    if (produceRate > 0) {
      initialStock = Math.round(targetStock * 1.2);
    }

    const buyPrice = calculatePrice({
      basePrice: good.basePrice,
      stock: initialStock,
      targetStock,
      elasticity: balance.priceElasticity,
      minMultiplier: balance.minPriceMultiplier,
      maxMultiplier: balance.maxPriceMultiplier,
    });

    // Island sell price includes standard merchant spread (e.g. 5% spread)
    const sellPrice = Math.round(buyPrice * 0.95 * 100) / 100;

    markets[good.id] = {
      goodId: good.id,
      stock: initialStock,
      targetStock,
      maxCapacity,
      produceRatePerDay: produceRate,
      consumeRatePerDay: consumeRate,
      buyPrice,
      sellPrice,
      isStarving: false,
      isSurplus: false,
    };
  }

  return {
    islandId: island.id,
    unlocked,
    prosperity: unlocked ? 0.75 : 0.40,
    distress: 0.0,
    markets,
  };
}

/**
 * Advances an island's economy by deltaDays.
 */
export function tickIslandEconomy(
  islandState: IslandEconomyState,
  goodsMap: Map<string, GoodDefinition>,
  balance: BalanceConfig,
  deltaDays: number,
  eventMultipliers?: (goodId: string) => { priceMultiplier: number; demandMultiplier: number; supplyMultiplier: number }
): void {
  for (const market of Object.values(islandState.markets)) {
    const goodDef = goodsMap.get(market.goodId);
    const isPerishable = goodDef?.perishable ?? false;
    const mults = eventMultipliers ? eventMultipliers(market.goodId) : { priceMultiplier: 1.0, demandMultiplier: 1.0, supplyMultiplier: 1.0 };

    const effectiveProduce = market.produceRatePerDay * mults.supplyMultiplier;
    const effectiveConsume = market.consumeRatePerDay * mults.demandMultiplier;

    // 1. Advance physical stocks with event multipliers
    const updated = updateStock(
      market.stock,
      effectiveProduce,
      effectiveConsume,
      deltaDays,
      market.maxCapacity,
      isPerishable,
      balance.perishableDecayPerDay
    );

    market.stock = updated.stock;
    market.isStarving = updated.isStarving;
    market.isSurplus = updated.isSurplus;

    // 2. Recalculate dynamic market prices with event multiplier
    const basePrice = goodDef?.basePrice || 20;
    const rawPrice = calculatePrice({
      basePrice,
      stock: market.stock,
      targetStock: market.targetStock,
      elasticity: balance.priceElasticity,
      minMultiplier: balance.minPriceMultiplier,
      maxMultiplier: balance.maxPriceMultiplier,
    });

    const currentPrice = rawPrice * mults.priceMultiplier;
    market.buyPrice = Math.round(currentPrice * 100) / 100;
    market.sellPrice = Math.round(currentPrice * 0.95 * 100) / 100;
  }

  // 3. Update island prosperity and distress
  const { distress, prosperity } = updateDistressAndProsperity(
    islandState.distress,
    islandState.prosperity,
    islandState.markets,
    balance.distressGrowthRate,
    balance.prosperityGrowthRate,
    deltaDays
  );

  islandState.distress = distress;
  islandState.prosperity = prosperity;
}
