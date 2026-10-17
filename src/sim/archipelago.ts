import type { SimulationCore } from './simulation';

export interface IslandExportInfo {
  goodId: string;
  name: string;
  rate: number;
  stock: number;
  buyPrice: number;
}

export interface IslandDemandInfo {
  goodId: string;
  name: string;
  rate: number;
  stock: number;
  targetStock: number;
  isStarving: boolean;
  buyPrice: number;
}

export interface ArchipelagoIslandEntry {
  id: string;
  name: string;
  type: 'island' | 'mainland_port';
  region: string;
  country: string;
  population: number;
  isAwake: boolean;
  prosperityPct: number;
  distressPct: number;
  status: 'booming' | 'stable' | 'struggling' | 'distressed' | 'sleeping';
  unlockCost: number;
  unlockTp: number;
  canAwakenNow: boolean;
  hasMaritimeConnection: boolean;
  requiresConnectedTo: string[];
  missingConnections: string[];
  topExports: IslandExportInfo[];
  topDemands: IslandDemandInfo[];
  berthsUsed: number;
  berthsMax: number;
  underutilizedShipsCount: number;
  economicOpportunityScore: number;
  opportunitySummary: string;
}

export interface ArchipelagoSummary {
  totalIslands: number;
  awakeCount: number;
  sleepingCount: number;
  readyToAwakenCount: number;
  totalPopulation: number;
  awakePopulation: number;
  awakePopulationPct: number;
  totalUnderutilizedShips: number;
  highestPopIsland: ArchipelagoIslandEntry | null;
  highestOpportunityIsland: ArchipelagoIslandEntry | null;
  islands: ArchipelagoIslandEntry[];
}

function formatGoodName(id: string): string {
  return id.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Headless simulation logic evaluating all archipelago islands for population,
 * economic opportunity, trade flows, and awakening status.
 */
export function getArchipelagoDirectory(sim: SimulationCore): ArchipelagoSummary {
  const entries: ArchipelagoIslandEntry[] = [];
  let totalPopulation = 0;
  let awakePopulation = 0;
  let readyToAwakenCount = 0;

  const playerTreasury = sim.treasury || 0;
  const playerTp = sim.tradePoints || 0;

  for (const [id, data] of sim.islandsData.entries()) {
    const isAwake = sim.unlockedIslands.has(id);
    const economy = sim.islands.get(id);
    const pop = data.population || 0;
    totalPopulation += pop;
    if (isAwake) {
      awakePopulation += pop;
    }

    const unlockCost = data.unlock?.cost || 0;
    const unlockTp = data.unlock?.tp || 0;
    const required = data.unlock?.requiresConnectedTo || [];
    const hasMaritimeConnection =
      required.length === 0 || required.some((reqId) => sim.unlockedIslands.has(reqId));
    const missingConnections = required.filter((reqId) => !sim.unlockedIslands.has(reqId));

    const canAfford = playerTreasury >= unlockCost && playerTp >= unlockTp;
    const canAwakenNow = !isAwake && hasMaritimeConnection && canAfford;
    if (canAwakenNow) {
      readyToAwakenCount++;
    }

    // Exports
    const topExports: IslandExportInfo[] = [];
    let totalExportRate = 0;
    if (data.produces) {
      for (const [goodId, rate] of Object.entries(data.produces)) {
        if (rate <= 0) continue;
        totalExportRate += rate;
        const market = economy?.markets[goodId];
        const stock = market ? Math.floor(market.stock) : 0;
        const buyPrice = market ? Number(market.buyPrice.toFixed(1)) : 10;
        const goodDef = sim.goodsData?.get(goodId);
        topExports.push({
          goodId,
          name: goodDef?.name || formatGoodName(goodId),
          rate,
          stock,
          buyPrice,
        });
      }
    }
    topExports.sort((a, b) => b.rate - a.rate);

    // Demands
    const topDemands: IslandDemandInfo[] = [];
    let totalDemandRate = 0;
    let starvingCount = 0;
    if (data.consumes) {
      for (const [goodId, rate] of Object.entries(data.consumes)) {
        if (rate <= 0) continue;
        totalDemandRate += rate;
        const market = economy?.markets[goodId];
        const stock = market ? Math.floor(market.stock) : 0;
        const targetStock = market ? market.targetStock : 10;
        const isStarving = !!market?.isStarving;
        if (isStarving) starvingCount++;
        const buyPrice = market ? Number(market.buyPrice.toFixed(1)) : 20;
        const goodDef = sim.goodsData?.get(goodId);
        topDemands.push({
          goodId,
          name: goodDef?.name || formatGoodName(goodId),
          rate,
          stock,
          targetStock,
          isStarving,
          buyPrice,
        });
      }
    }
    topDemands.sort((a, b) => b.rate - a.rate);

    // Prosperity & Status
    const prosperity = economy?.prosperity ?? (isAwake ? 0.5 : 0.2);
    const distress = economy?.distress ?? 0;
    const prosperityPct = Math.round(prosperity * 100);
    const distressPct = Math.round(distress * 100);

    let status: 'booming' | 'stable' | 'struggling' | 'distressed' | 'sleeping' = 'sleeping';
    if (!isAwake) {
      status = 'sleeping';
    } else if (distress > 0.25 || (distress > 0.15 && prosperity < 0.50)) {
      status = 'distressed';
    } else if (prosperity >= 0.70) {
      status = 'booming';
    } else if (prosperity >= 0.40) {
      status = 'stable';
    } else {
      status = 'struggling';
    }

    // Economic Opportunity Score Calculation
    // Evaluates: population weight, export throughput, consumer demand arbitrage, and awakening leverage
    const popWeight = Math.min(pop / 1000, 150); // up to 150 pts
    const exportWeight = totalExportRate * 2.5; // production capacity
    const demandWeight = totalDemandRate * 3.0; // consumption capacity
    const starvingBonus = starvingCount * 15; // urgent deficit bonus
    const awakeningLeverage = !isAwake && hasMaritimeConnection ? 25 : 0;

    const economicOpportunityScore = Math.round(
      popWeight + exportWeight + demandWeight + starvingBonus + awakeningLeverage
    );

    // Contextual Opportunity Summary
    let opportunitySummary = '';
    if (!isAwake) {
      if (canAwakenNow) {
        opportunitySummary = `✨ Ready to Awaken! 🪙 ${unlockCost} unlocks pop ${pop.toLocaleString()} & +${totalExportRate}/d exports.`;
      } else if (!hasMaritimeConnection && missingConnections.length > 0) {
        const linkNames = missingConnections
          .map((cid) => sim.islandsData.get(cid)?.name || cid)
          .join(', ');
        opportunitySummary = `🔒 Frontier port. Connect via ${linkNames} to integrate into trade lanes.`;
      } else {
        opportunitySummary = `🔒 Awaiting 🪙 ${unlockCost} drachmas & ⚓ ${unlockTp} TP to awaken its harbor.`;
      }
    } else {
      if (distress > 0.15) {
        opportunitySummary = `⚠️ Port in Distress! Starving for key commodities (${starvingCount} critical shortages). High import profit!`;
      } else if (prosperity >= 0.75) {
        opportunitySummary = `🔥 Booming Metropolis (${prosperityPct}%). High consumer spending & export throughput.`;
      } else if (totalExportRate > 20) {
        const topExport = topExports[0]?.name || 'cargo';
        opportunitySummary = `📦 Heavy Industrial Exporter (+${totalExportRate}/d total, led by ${topExport}).`;
      } else {
        opportunitySummary = `⚓ Active commercial station with balanced ${totalDemandRate}/d consumption demand.`;
      }
    }

    const berthsUsed = sim.getHomePortedShipsCount(id);
    const berthsMax = sim.getPortFleetCapacity(id);
    const underutilizedShipsCount = sim.getUnderutilizedShipsForIsland(id).length;

    entries.push({
      id,
      name: data.name,
      type: data.type || 'island',
      region: data.region || 'Aegean',
      country: data.country || 'Greece',
      population: pop,
      isAwake,
      prosperityPct,
      distressPct,
      status,
      unlockCost,
      unlockTp,
      canAwakenNow,
      hasMaritimeConnection,
      requiresConnectedTo: required,
      missingConnections,
      topExports,
      topDemands,
      berthsUsed,
      berthsMax,
      underutilizedShipsCount,
      economicOpportunityScore,
      opportunitySummary,
    });
  }

  // Find extremes
  const sortedByPop = [...entries].sort((a, b) => b.population - a.population);
  const sortedByOpp = [...entries].sort(
    (a, b) => b.economicOpportunityScore - a.economicOpportunityScore
  );

  const highestPopIsland = sortedByPop[0] || null;
  const highestOpportunityIsland = sortedByOpp[0] || null;

  const awakeCount = sim.unlockedIslands.size;
  const totalIslands = sim.islandsData.size;
  const sleepingCount = Math.max(0, totalIslands - awakeCount);
  const awakePopulationPct =
    totalPopulation > 0 ? Math.round((awakePopulation / totalPopulation) * 1000) / 10 : 0;
  const totalUnderutilizedShips = sim.getUnderutilizedShips().length;

  return {
    totalIslands,
    awakeCount,
    sleepingCount,
    readyToAwakenCount,
    totalPopulation,
    awakePopulation,
    awakePopulationPct,
    totalUnderutilizedShips,
    highestPopIsland,
    highestOpportunityIsland,
    islands: entries,
  };
}
