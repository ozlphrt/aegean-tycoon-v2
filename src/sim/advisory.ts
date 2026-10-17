import { SimulationCore } from './simulation';
import { haversineDistanceKm } from './nav';
import type { UnderutilizedShipInfo } from './shipSim';

export interface ImportAdvice {
  goodId: string;
  goodName: string;
  stock: number;
  bufferTarget: number;
  bufferPct: number;
  consumeRate: number;
  daysRemaining: number;
  isStarving: boolean;
  urgency: 'critical' | 'warning' | 'stable';
  statusLabel: 'Critical' | 'Low Buffer' | 'Supplied' | 'Abundant';
  bestSupplier?: {
    islandId: string;
    islandName: string;
    distanceKm: number;
    buyPrice: number;
    sellPriceHere: number;
    profitPerUnit: number;
    availableStock: number;
  };
}

export interface ExportAdvice {
  goodId: string;
  goodName: string;
  stock: number;
  capacity: number;
  produceRate: number;
  fillPct: number;
  isCapped: boolean;
  isLow: boolean;
  localCost: number;
  bestCustomer?: {
    islandId: string;
    islandName: string;
    distanceKm: number;
    sellPriceThere: number;
    profitPerUnit: number;
    demandDeficit: number;
  };
}

export interface FleetAdvice {
  activeShipCount: number;
  visitingShipNames: string[];
  recommendation: string;
  underutilizedShips: UnderutilizedShipInfo[];
}

export interface UnlockAdvice {
  canAfford: boolean;
  cost: number;
  tp: number;
  haveCost: number;
  haveTp: number;
  requiresConnectedTo?: string[];
  hasPrerequisiteConnection: boolean;
}

export interface IslandEconomicReport {
  islandId: string;
  islandName: string;
  isUnlocked: boolean;
  prosperityPct: number;
  distressPct: number;
  status: 'distressed' | 'struggling' | 'stable' | 'booming';
  isRecovering: boolean;
  statusSummary: string;
  importAdvice: ImportAdvice[];
  exportAdvice: ExportAdvice[];
  fleetAdvice: FleetAdvice;
  unlockAdvice?: UnlockAdvice;
  actionItems: string[];
}

function formatName(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generates an in-depth, dynamic economic advisory report for a specific island.
 * Diagnoses shortages, idle surpluses, fleet deployment, and actionable trade routes.
 */
export function generateIslandEconomicReport(
  islandId: string,
  sim: SimulationCore
): IslandEconomicReport | null {
  const islandData = sim.islandsData.get(islandId);
  if (!islandData) return null;

  const islandEco = sim.islands.get(islandId);
  const isUnlocked = sim.unlockedIslands.has(islandId);

  const prosperity = islandEco?.prosperity ?? 0.5;
  const distress = islandEco?.distress ?? 0.0;
  const prosperityPct = Math.round(prosperity * 100);
  const distressPct = Math.round(distress * 100);

  // 1. Evaluate Overall Economic Health Status
  let status: 'distressed' | 'struggling' | 'stable' | 'booming' = 'stable';
  let statusSummary = '';

  const starvingGoods: string[] = [];
  let surplusCount = 0;
  let totalActiveMarkets = 0;
  if (islandEco?.markets) {
    for (const [goodId, market] of Object.entries(islandEco.markets)) {
      if (market.consumeRatePerDay > 0 || market.produceRatePerDay > 0) {
        totalActiveMarkets++;
        if (market.consumeRatePerDay > 0) {
          if (market.isStarving || market.stock <= 0.05 || market.stock < market.consumeRatePerDay * 0.75) {
            starvingGoods.push(formatName(goodId));
          }
        }
        if (market.isSurplus || market.stock >= market.targetStock) {
          surplusCount++;
        }
      }
    }
  }

  const fulfillmentRatio = totalActiveMarkets > 0 ? surplusCount / totalActiveMarkets : 1.0;
  const isRecovering = fulfillmentRatio >= 0.70 && distress < 0.15 && prosperity < 0.70;

  if (distress > 0.15 || starvingGoods.length > 0) {
    status = 'distressed';
    statusSummary = starvingGoods.length > 0
      ? `Critical Shortage: Running out of ${starvingGoods.join(', ')}. Local commerce is paralyzed.`
      : `Acute Distress (${distressPct}%): Market deficits causing population unrest and economic stagnation.`;
  } else if (prosperity >= 0.7) {
    status = 'booming';
    statusSummary = `Booming Economy (${prosperityPct}%): Vibrant market circulation and robust trade velocity across the Aegean.`;
  } else if (prosperity >= 0.4) {
    status = 'stable';
    statusSummary = `Stable Daylight Port (${prosperityPct}%): Regular commercial flows with balanced baseline inventories.`;
  } else if (isRecovering) {
    status = 'struggling';
    statusSummary = `Economic Recovery Active (${prosperityPct}% ↗): All vital import lifelines are fully secured and buffered! Island distress has cleared, and prosperity is climbing steadily (+5.0%/day) towards 75%+.`;
  } else {
    status = 'struggling';
    statusSummary = `Struggling Reserves (${prosperityPct}%): Low supply buffers threaten gradual economic contraction.`;
  }

  // 2. Compute Import Recommendations & Best Suppliers
  const importAdvice: ImportAdvice[] = [];
  if (islandEco?.markets) {
    for (const [goodId, market] of Object.entries(islandEco.markets)) {
      if (market.consumeRatePerDay > 0) {
        const consumeRate = market.consumeRatePerDay;
        const stock = market.stock;
        // Use true target buffer (targetStock: 4.5 days reserve), matching the inspector exactly
        const bufferTarget = market.targetStock > 0 ? Math.round(market.targetStock) : Math.max(10, Math.round(consumeRate * 4.5));
        const bufferPct = Math.round((stock / bufferTarget) * 100);
        const daysRemaining = consumeRate > 0 ? Math.max(0, Math.round((stock / consumeRate) * 10) / 10) : 99;
        const isStarving = market.isStarving || stock <= 0.05;

        let urgency: 'critical' | 'warning' | 'stable' = 'stable';
        let statusLabel: 'Critical' | 'Low Buffer' | 'Supplied' | 'Abundant' = 'Supplied';

        if (isStarving || daysRemaining < 1.0) {
          urgency = 'critical';
          statusLabel = 'Critical';
        } else if (daysRemaining < 2.5 || bufferPct < 40) {
          urgency = 'warning';
          statusLabel = 'Low Buffer';
        } else if (bufferPct >= 200) {
          urgency = 'stable';
          statusLabel = 'Abundant';
        } else {
          urgency = 'stable';
          statusLabel = 'Supplied';
        }

        // Find best supplier among unlocked or connected network islands
        let bestSupplier: ImportAdvice['bestSupplier'] = undefined;
        let highestProfit = 0;

        for (const candidateId of sim.unlockedIslands) {
          if (candidateId === islandId) continue;
          const candEco = sim.islands.get(candidateId);
          const candData = sim.islandsData.get(candidateId);
          if (!candEco || !candData) continue;

          const candMarket = candEco.markets[goodId];
          if (!candMarket || candMarket.produceRatePerDay <= 0 || candMarket.stock < 1) continue;

          const buyPrice = candMarket.buyPrice;
          const sellPriceHere = market.sellPrice;
          const profit = sellPriceHere - buyPrice;

          if (profit > highestProfit && candMarket.stock >= 2) {
            highestProfit = profit;
            const dist = Math.round(
              haversineDistanceKm(islandData.lon, islandData.lat, candData.lon, candData.lat)
            );
            bestSupplier = {
              islandId: candidateId,
              islandName: candData.name,
              distanceKm: dist,
              buyPrice: Math.round(buyPrice * 10) / 10,
              sellPriceHere: Math.round(sellPriceHere * 10) / 10,
              profitPerUnit: Math.round(profit * 10) / 10,
              availableStock: Math.floor(candMarket.stock),
            };
          }
        }

        importAdvice.push({
          goodId,
          goodName: formatName(goodId),
          stock: Math.round(stock),
          bufferTarget,
          bufferPct,
          consumeRate: Math.round(consumeRate * 10) / 10,
          daysRemaining,
          isStarving,
          urgency,
          statusLabel,
          bestSupplier,
        });
      }
    }
  }

  // Sort import advice by urgency (critical first, then warning, then stable)
  importAdvice.sort((a, b) => {
    const order = { critical: 0, warning: 1, stable: 2 };
    return order[a.urgency] - order[b.urgency] || a.daysRemaining - b.daysRemaining;
  });

  // 3. Compute Export Opportunities & Best Customers
  const exportAdvice: ExportAdvice[] = [];
  if (islandEco?.markets) {
    for (const [goodId, market] of Object.entries(islandEco.markets)) {
      if (market.produceRatePerDay > 0) {
        const produceRate = market.produceRatePerDay;
        const stock = market.stock;
        const capacity = market.maxCapacity;
        const fillPct = Math.round((stock / Math.max(1, capacity)) * 100);
        const isCapped = stock >= capacity * 0.92;
        const isLow = fillPct <= 10 || stock < Math.max(10, (market.targetStock || 15) * 0.5);
        const localCost = market.buyPrice;

        // Find customer island paying the highest price for this export
        let bestCustomer: ExportAdvice['bestCustomer'] = undefined;
        let highestProfit = 0;

        for (const candidateId of sim.unlockedIslands) {
          if (candidateId === islandId) continue;
          const candEco = sim.islands.get(candidateId);
          const candData = sim.islandsData.get(candidateId);
          if (!candEco || !candData) continue;

          const candMarket = candEco.markets[goodId];
          if (!candMarket || candMarket.consumeRatePerDay <= 0) continue;

          const sellPriceThere = candMarket.sellPrice;
          const profit = sellPriceThere - localCost;
          const demandDeficit = Math.max(0, Math.floor(candMarket.maxCapacity - candMarket.stock));

          if (profit > highestProfit && demandDeficit > 0) {
            highestProfit = profit;
            const dist = Math.round(
              haversineDistanceKm(islandData.lon, islandData.lat, candData.lon, candData.lat)
            );
            bestCustomer = {
              islandId: candidateId,
              islandName: candData.name,
              distanceKm: dist,
              sellPriceThere: Math.round(sellPriceThere * 10) / 10,
              profitPerUnit: Math.round(profit * 10) / 10,
              demandDeficit,
            };
          }
        }

        exportAdvice.push({
          goodId,
          goodName: formatName(goodId),
          stock: Math.round(stock),
          capacity: Math.round(capacity),
          produceRate: Math.round(produceRate * 10) / 10,
          fillPct,
          isCapped,
          isLow,
          localCost: Math.round(localCost * 10) / 10,
          bestCustomer,
        });
      }
    }
  }

  // Sort export advice (depleted reserves first, then capped warehouses, then highest produce rate)
  exportAdvice.sort((a, b) => {
    if (a.isLow !== b.isLow) return a.isLow ? -1 : 1;
    if (a.isCapped !== b.isCapped) return a.isCapped ? -1 : 1;
    return b.produceRate - a.produceRate;
  });

  // 4. Fleet & Route Logistics Advice
  const visitingShipNames: string[] = [];
  if (sim.shipManager) {
    for (const ship of sim.shipManager.ships.values()) {
      if (
        ship.currentIslandId === islandId ||
        ship.targetIslandId === islandId ||
        ship.homeIslandId === islandId
      ) {
        visitingShipNames.push(ship.name);
      }
    }
  }

  const underutilizedShips = sim.getUnderutilizedShipsForIsland(islandId);

  let fleetRec = '';
  if (visitingShipNames.length === 0) {
    fleetRec = isUnlocked
      ? 'No merchant vessels are currently assigned to this port. Commission a Boat or Coaster at the harbor shipyard to automate local lifelines.'
      : 'Port is awaiting awakening. Once connected, allocate at least one dedicated cargo vessel to capitalize on its markets.';
  } else if (underutilizedShips.length > 0) {
    const uShip = underutilizedShips[0];
    fleetRec = `⚠️ ${underutilizedShips.length} vessel(s) servicing this port are underutilized (${uShip.shipName}: ${uShip.label.toLowerCase()}). ${uShip.recommendation}`;
  } else if (importAdvice.some((a) => a.urgency === 'critical')) {
    const criticalName = importAdvice.find((a) => a.urgency === 'critical')?.goodName || 'supplies';
    fleetRec = `${visitingShipNames.length} vessel(s) servicing this port (${visitingShipNames.slice(0, 3).join(', ')}). Set cargo priority to ${criticalName} in Fleet Management to break the shortage.`;
  } else if (exportAdvice.some((e) => e.isCapped)) {
    const cappedName = exportAdvice.find((e) => e.isCapped)?.goodName || 'goods';
    fleetRec = `${visitingShipNames.length} vessel(s) active. Warehouses have surplus ${cappedName}; assign higher-capacity vessels to expand export throughput.`;
  } else {
    fleetRec = `${visitingShipNames.length} vessel(s) in active rotation. Trade logistics are operating stably.`;
  }

  const fleetAdvice: FleetAdvice = {
    activeShipCount: visitingShipNames.length,
    visitingShipNames,
    recommendation: fleetRec,
    underutilizedShips,
  };

  // 5. Unlock Strategy Advice (if locked)
  let unlockAdvice: UnlockAdvice | undefined = undefined;
  if (!isUnlocked && islandData.unlock) {
    const cost = islandData.unlock.cost || 0;
    const tp = islandData.unlock.tp || 0;
    const haveCost = Math.floor(sim.treasury);
    const haveTp = sim.tradePoints;
    const reqs = islandData.unlock.requiresConnectedTo || [];
    const hasPrerequisiteConnection =
      reqs.length === 0 || reqs.some((reqId) => sim.unlockedIslands.has(reqId));

    unlockAdvice = {
      canAfford: haveCost >= cost && haveTp >= tp && hasPrerequisiteConnection,
      cost,
      tp,
      haveCost,
      haveTp,
      requiresConnectedTo: reqs,
      hasPrerequisiteConnection,
    };
  }

  // 6. Actionable Executive Steps Summary
  const actionItems: string[] = [];

  if (!isUnlocked) {
    if (unlockAdvice?.canAfford) {
      actionItems.push(
        `Awaken ${islandData.name} port (🪙 ${unlockAdvice.cost} d + ⚓ ${unlockAdvice.tp} TP available). This will immediately unlock regional commerce.`
      );
    } else {
      actionItems.push(
        `Accumulate 🪙 ${unlockAdvice?.cost || 0} Drachmas & ⚓ ${unlockAdvice?.tp || 0} TP to connect this harbor to the daylight network.`
      );
    }
  }

  if (isRecovering) {
    actionItems.push(
      `📈 Economic Rebound in Progress: All essential import lifelines (Water, Produce, Grain) are fully buffered! Maintain incoming shipments while prosperity climbs steadily to 75%+.`
    );
  }

  for (const imp of importAdvice.filter((a) => a.urgency === 'critical')) {
    if (imp.bestSupplier) {
      actionItems.push(
        `🚨 Lifeline: Deliver ${imp.goodName} immediately from ${imp.bestSupplier.islandName} (+🪙 ${imp.bestSupplier.profitPerUnit} profit/unit) to cure shortage.`
      );
    } else {
      actionItems.push(
        `🚨 Shortage: Local reserves of ${imp.goodName} are empty. Connect a supplier port or dispatch incoming cargo.`
      );
    }
  }

  for (const exp of exportAdvice.filter((e) => e.isLow)) {
    actionItems.push(
      `⚠️ Export Reserve Depleted: ${exp.goodName} warehouse is critically low (${exp.stock}/${exp.capacity} units, ${exp.fillPct}%). Trade vessels cannot load until local production (+${exp.produceRate}/d) rebuilds inventory.`
    );
  }

  for (const exp of exportAdvice.filter((e) => e.isCapped)) {
    if (exp.bestCustomer) {
      actionItems.push(
        `📦 Monetize Surplus: ${exp.goodName} is capped (${exp.stock}/${exp.capacity}). Ship to ${exp.bestCustomer.islandName} for +🪙 ${exp.bestCustomer.profitPerUnit} profit/unit.`
      );
    }
  }

  if (visitingShipNames.length === 0 && isUnlocked) {
    actionItems.push(
      `⛵ Fleet Expansion: Commission a vessel at ${islandData.name} Harbor to autonomously run export/import loops.`
    );
  }

  if (underutilizedShips.length > 0) {
    const uList = underutilizedShips.map((u) => `${u.shipName} (${u.label})`).join(', ');
    actionItems.push(
      `⚠️ Fleet Optimization: ${underutilizedShips.length} underutilized vessel(s) at this port (${uList}). Re-assign priority to resolve deficits.`
    );
  }

  if (actionItems.length === 0) {
    actionItems.push(
      `🌟 Optimum Prosperity: Port is well-balanced. Maintain existing shipping frequency to sustain high prosperity.`
    );
  }

  return {
    islandId,
    islandName: islandData.name,
    isUnlocked,
    prosperityPct,
    distressPct,
    status,
    isRecovering,
    statusSummary,
    importAdvice,
    exportAdvice,
    fleetAdvice,
    unlockAdvice,
    actionItems,
  };
}
