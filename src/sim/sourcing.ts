import type { SimulationCore } from './simulation';
import { haversineDistanceKm, type NavPath } from './nav';
import { toSingleWordShipName } from './shipSim';

export interface ProducerSourceInfo {
  islandId: string;
  name: string;
  region: string;
  isAwake: boolean;
  produceRate: number;
  stock: number;
  buyPrice: number;
  distanceKm: number;
  isDirectConnection: boolean;
  hasNavPath: boolean;
  pathDistanceKm: number;
}

export interface VesselSuitability {
  typeId: string;
  tier: number;
  name: string;
  capacity: number;
  speed: number;
  range: number;
  cost: number;
  canCarry: boolean;
  isRangeAdequate: boolean;
  daysSupplyPerTrip: number;
  recommended: boolean;
  unlockedCountReq: number;
  isUnlocked: boolean;
}

export interface LocalVesselStatus {
  shipId: string;
  name: string;
  tier: number;
  typeName: string;
  capacity: number;
  range: number;
  cargoGoodId: string | null;
  cargoQuantity: number;
  state: string;
  currentIslandId: string | null;
  targetIslandId: string | null;
  targetIslandName: string | null;
  cargoPriority: string;
  isCarryingTargetGood: boolean;
  isCarryingOtherGoods: boolean;
  isSuitableForRoute: boolean;
}

export interface SourcingAnalysis {
  islandId: string;
  islandName: string;
  goodId: string;
  goodName: string;
  isDeficit: boolean;
  consumeRate: number;
  produceRate: number;
  currentStock: number;
  targetStock: number;
  maxCapacity: number;
  closestProducers: ProducerSourceInfo[];
  closestAwakeProducer: ProducerSourceInfo | null;
  vesselSuitabilities: VesselSuitability[];
  recommendedShipTier: string | null;
  portVessels: LocalVesselStatus[];
  hasSuitableVesselsAtPort: boolean;
  availableVesselsCount: number;
  busyVesselsCount: number;
  berthsUsed: number;
  berthsMax: number;
  recommendedAction: 'redirect_existing' | 'commission_new' | 'awaken_producer' | 'none';
  recommendedActionDetails: string;
}

/**
 * Analyzes the supply chain, closest awakened producers, sea lane connectivity,
 * vessel range suitability, and local fleet status for any commodity at an island.
 */
export function analyzeCommoditySourcing(
  sim: SimulationCore,
  islandId: string,
  goodId: string
): SourcingAnalysis | null {
  const currentIslandData = sim.islandsData.get(islandId);
  const currentEconomy = sim.islands.get(islandId);
  if (!currentIslandData) return null;

  const currentMarket = currentEconomy?.markets[goodId];
  const consumeRate = currentIslandData.consumes?.[goodId] || 0;
  const produceRate = currentIslandData.produces?.[goodId] || 0;
  const currentStock = currentMarket ? Math.floor(currentMarket.stock) : 0;
  const targetStock = currentMarket ? currentMarket.targetStock : 0;
  const maxCapacity = currentMarket ? currentMarket.maxCapacity : 100;
  const isDeficit = consumeRate > 0 && (!currentMarket || currentMarket.isStarving || currentStock < targetStock);

  // Format good name
  const goodDef = sim.goodsData?.get ? sim.goodsData.get(goodId) : null;
  const goodName = goodDef?.name || goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // 1. Locate all producing islands across the archipelago
  const allProducers: ProducerSourceInfo[] = [];

  for (const [prodId, prodData] of sim.islandsData.entries()) {
    if (prodId === islandId) continue;
    const rate = prodData.produces?.[goodId];
    if (rate && rate > 0) {
      const isAwake = sim.unlockedIslands.has(prodId);
      const prodEco = sim.islands.get(prodId);
      const prodMarket = prodEco?.markets[goodId];

      const directDist = haversineDistanceKm(
        currentIslandData.lon,
        currentIslandData.lat,
        prodData.lon,
        prodData.lat
      );

      // Sea lane navigation path
      const navPath: NavPath | null = sim.navGraph?.findPathBetweenIslands(islandId, prodId) || null;
      const hasNavPath = navPath !== null && navPath.totalDistanceKm > 0;
      const pathDistanceKm = hasNavPath ? Math.round(navPath.totalDistanceKm) : Math.round(directDist);
      const isDirectConnection = hasNavPath && navPath.waypoints.length <= 2;

      allProducers.push({
        islandId: prodId,
        name: prodData.name,
        region: prodData.region,
        isAwake,
        produceRate: rate,
        stock: prodMarket ? Math.floor(prodMarket.stock) : 0,
        buyPrice: prodMarket ? Number(prodMarket.buyPrice.toFixed(1)) : 0,
        distanceKm: Math.round(directDist),
        hasNavPath,
        pathDistanceKm,
        isDirectConnection,
      });
    }
  }

  // Sort producers: Awakened first, then by shortest navigable distance
  allProducers.sort((a, b) => {
    if (a.isAwake !== b.isAwake) {
      return a.isAwake ? -1 : 1;
    }
    return a.pathDistanceKm - b.pathDistanceKm;
  });

  const closestAwakeProducer = allProducers.find((p) => p.isAwake) || null;
  const refDistanceKm = closestAwakeProducer ? closestAwakeProducer.pathDistanceKm : (allProducers[0]?.pathDistanceKm || 120);

  // 2. Evaluate Vessel Class Suitability
  const unlockedCount = sim.unlockedIslands.size;
  const vesselSuitabilities: VesselSuitability[] = [];

  for (const def of sim.shipDefs.values()) {
    // Only cargo vessels can carry trade commodities; VIP charter yachts are luxury passenger cruisers
    const canCarry = def.id !== 'charter_yacht' && def.capacity > 0;
    const isRangeAdequate = def.range >= refDistanceKm;
    const daysSupply = consumeRate > 0 ? Number((def.capacity / consumeRate).toFixed(1)) : 0;
    const reqIslands = def.unlock?.islandsConnected || 1;
    const isUnlocked = unlockedCount >= reqIslands;

    vesselSuitabilities.push({
      typeId: def.id,
      tier: def.tier,
      name: def.name,
      capacity: def.capacity,
      speed: def.speed,
      range: def.range,
      cost: def.cost,
      canCarry,
      isRangeAdequate,
      daysSupplyPerTrip: daysSupply,
      recommended: false, // Calculated below
      unlockedCountReq: reqIslands,
      isUnlocked,
    });
  }

  vesselSuitabilities.sort((a, b) => a.tier - b.tier);

  // Determine best recommended ship tier:
  // Must be able to carry cargo, have adequate range for the closest awake producer, and be unlocked.
  let recommendedDef = vesselSuitabilities.find((v) => v.canCarry && v.isRangeAdequate && v.isUnlocked);
  if (!recommendedDef) {
    // Fallback to highest unlocked cargo carrier
    recommendedDef = [...vesselSuitabilities].reverse().find((v) => v.canCarry && v.isUnlocked);
  }
  if (recommendedDef) {
    recommendedDef.recommended = true;
  }

  // 3. Inspect Local Fleet at Current Port (Rhodes)
  const portVessels: LocalVesselStatus[] = [];
  let availableVesselsCount = 0;
  let busyVesselsCount = 0;

  if (sim.shipManager) {
    const allShips = Array.from(sim.shipManager.ships.values());
    const relevantShips = allShips.filter(
      (s) => s.homeIslandId === islandId || s.currentIslandId === islandId
    );

    for (const ship of relevantShips) {
      const def = sim.shipDefs.get(ship.typeId);
      const shipRange = def?.range || 100;
      const isCarryingTargetGood = ship.cargo?.goodId === goodId;
      const isCarryingOtherGoods = ship.cargo !== null && ship.cargo.goodId !== goodId;
      const isSuitableForRoute = (def ? def.id !== 'charter_yacht' : true) && (shipRange >= refDistanceKm);

      const targetData = ship.targetIslandId ? sim.islandsData.get(ship.targetIslandId) : null;
      const cleanName = toSingleWordShipName(ship.name);

      if (isCarryingOtherGoods) {
        busyVesselsCount++;
      } else {
        availableVesselsCount++;
      }

      portVessels.push({
        shipId: ship.id,
        name: cleanName,
        tier: ship.tier,
        typeName: def?.name || `Tier ${ship.tier}`,
        capacity: ship.capacity,
        range: shipRange,
        cargoGoodId: ship.cargo ? ship.cargo.goodId : null,
        cargoQuantity: ship.cargo ? ship.cargo.quantity : 0,
        state: ship.state,
        currentIslandId: ship.currentIslandId,
        targetIslandId: ship.targetIslandId,
        targetIslandName: targetData?.name || ship.targetIslandId,
        cargoPriority: ship.cargoPriority || 'auto',
        isCarryingTargetGood,
        isCarryingOtherGoods,
        isSuitableForRoute,
      });
    }
  }

  const hasSuitableVesselsAtPort = portVessels.some((v) => v.isSuitableForRoute);

  const berthsUsed = sim.getHomePortedShipsCount ? sim.getHomePortedShipsCount(islandId) : portVessels.length;
  const berthsMax = sim.getPortFleetCapacity ? sim.getPortFleetCapacity(islandId) : 5;
  const isBerthFull = berthsUsed >= berthsMax;

  // 4. Strategic Recommendation Logic
  let recommendedAction: 'redirect_existing' | 'commission_new' | 'awaken_producer' | 'none' = 'none';
  let recommendedActionDetails = '';

  if (!closestAwakeProducer) {
    recommendedAction = 'awaken_producer';
    const nearestDark = allProducers[0];
    recommendedActionDetails = nearestDark
      ? `No producer is currently awakened in Mediterranean daylight. Awaken ${nearestDark.name} (${nearestDark.distanceKm} km away) to unlock supply.`
      : `No producer found for ${goodName}.`;
  } else if (!hasSuitableVesselsAtPort) {
    if (isBerthFull) {
      recommendedAction = 'redirect_existing';
      recommendedActionDetails = `${currentIslandData.name} harbor berths are at capacity (${berthsUsed}/${berthsMax} vessels) and has no ships with range (${refDistanceKm} km). Sell or relocate vessels, or expand population/prosperity to add berths.`;
    } else {
      recommendedAction = 'commission_new';
      recommendedActionDetails = `${currentIslandData.name} has no vessels with the range (${refDistanceKm} km) required to reach ${closestAwakeProducer.name}. Commission a ${recommendedDef?.name || 'Coaster'} at the harbor (${berthsUsed}/${berthsMax} berths used).`;
    }
  } else if (availableVesselsCount > 0) {
    recommendedAction = 'redirect_existing';
    recommendedActionDetails = `${currentIslandData.name} has available vessels in port. Assign priority to ${goodName} to establish an immediate relief supply line from ${closestAwakeProducer.name}.`;
  } else {
    // All suitable vessels are currently hauling other goods
    if (isBerthFull) {
      recommendedAction = 'redirect_existing';
      recommendedActionDetails = `Harbor berths are FULL (${berthsUsed}/${berthsMax} vessels). You cannot commission more ships here. Redirect an existing vessel (e.g. ${portVessels[0]?.name}) to drop secondary cargo and source ${goodName}.`;
    } else {
      recommendedAction = 'commission_new';
      recommendedActionDetails = `All ${portVessels.length} vessels at ${currentIslandData.name} are actively transporting other goods. Berths available (${berthsUsed}/${berthsMax}). Commissioning a new dedicated hauler avoids disrupting existing profitable lines.`;
    }
  }

  return {
    islandId,
    islandName: currentIslandData.name,
    goodId,
    goodName,
    isDeficit,
    consumeRate,
    produceRate,
    currentStock,
    targetStock,
    maxCapacity,
    closestProducers: allProducers,
    closestAwakeProducer,
    vesselSuitabilities,
    recommendedShipTier: recommendedDef ? recommendedDef.typeId : null,
    portVessels,
    hasSuitableVesselsAtPort,
    availableVesselsCount,
    busyVesselsCount,
    berthsUsed,
    berthsMax,
    recommendedAction,
    recommendedActionDetails,
  };
}

export interface InspectedVesselInfo {
  shipId: string;
  name: string;
  tier: number;
  typeId: string;
  typeName: string;
  capacity: number;
  range: number;
  state: string; // 'idle' | 'sailing' | 'loading' | 'unloading'
  currentIslandId: string | null;
  currentLocationName: string;
  targetIslandId: string | null;
  targetLocationName: string | null;
  homeIslandId: string;
  homeIslandName: string;
  cargoGoodId: string | null;
  cargoQuantity: number;
  cargoPriority: string;
  isAtSelectedSupplier: boolean;
  isAtDestination: boolean;
  isEnRouteToDestination: boolean;
  isEnRouteToSupplier: boolean;
  isPrioritizingTargetGood: boolean;
}

export interface VesselClassInspection {
  typeId: string;
  typeName: string;
  tier: number;
  cost: number;
  range: number;
  capacity: number;
  speed: number;
  canCarry: boolean;
  isUnlocked: boolean;
  unlockedCountReq: number;
  isRangeAdequate: boolean;
  routeDistanceKm: number;
  // Fleet availability
  totalOwnedCount: number;
  availableVessels: InspectedVesselInfo[];
  // Commission viability at destination port
  destinationPortId: string;
  destinationPortName: string;
  berthsUsed: number;
  berthsMax: number;
  isBerthFull: boolean;
  canAfford: boolean;
  canCommission: boolean;
  commissionBlockedReason?: string;
}

/**
 * Inspects all player vessels of a selected class across the entire fleet for a route.
 * Evaluates whether existing vessels of this class are stationed at destination/supplier
 * or idle elsewhere, and calculates on-the-spot commissioning feasibility.
 */
export function inspectVesselClassAvailability(
  sim: SimulationCore,
  destinationIslandId: string,
  supplierIslandId: string | null,
  shipTypeId: string,
  targetGoodId: string
): VesselClassInspection | null {
  const def = sim.shipDefs.get(shipTypeId);
  if (!def) return null;

  const destData = sim.islandsData.get(destinationIslandId);
  const destName = destData?.name || destinationIslandId;
  const supplierData = supplierIslandId ? sim.islandsData.get(supplierIslandId) : null;

  // Calculate route distance if supplier provided
  let routeDistanceKm = 0;
  if (supplierIslandId) {
    const navPath = sim.navGraph?.findPathBetweenIslands(destinationIslandId, supplierIslandId);
    if (navPath && navPath.totalDistanceKm > 0) {
      routeDistanceKm = Math.round(navPath.totalDistanceKm);
    } else if (destData && supplierData) {
      routeDistanceKm = Math.round(haversineDistanceKm(destData.lon, destData.lat, supplierData.lon, supplierData.lat));
    }
  }

  const isRangeAdequate = routeDistanceKm > 0 ? def.range >= routeDistanceKm : true;
  const canCarry = def.id !== 'charter_yacht' && def.capacity > 0;
  const unlockedCountReq = def.unlock?.islandsConnected || 1;
  const isUnlocked = sim.unlockedIslands.size >= unlockedCountReq;

  // Inspect all owned ships of this class
  const availableVessels: InspectedVesselInfo[] = [];
  if (sim.shipManager) {
    for (const ship of sim.shipManager.ships.values()) {
      if (ship.typeId !== shipTypeId) continue;

      const currData = ship.currentIslandId ? sim.islandsData.get(ship.currentIslandId) : null;
      const targetData = ship.targetIslandId ? sim.islandsData.get(ship.targetIslandId) : null;
      const homeData = sim.islandsData.get(ship.homeIslandId);

      const isAtSelectedSupplier = !!(supplierIslandId && ship.currentIslandId === supplierIslandId);
      const isAtDestination = ship.currentIslandId === destinationIslandId;
      const isEnRouteToDestination = ship.targetIslandId === destinationIslandId;
      const isEnRouteToSupplier = !!(supplierIslandId && ship.targetIslandId === supplierIslandId);
      const isPrioritizingTargetGood = ship.cargoPriority === targetGoodId;

      availableVessels.push({
        shipId: ship.id,
        name: toSingleWordShipName(ship.name),
        tier: ship.tier,
        typeId: ship.typeId,
        typeName: def.name,
        capacity: ship.capacity,
        range: def.range,
        state: ship.state,
        currentIslandId: ship.currentIslandId,
        currentLocationName: currData?.name || (ship.state === 'sailing' ? 'At Sea' : 'Unknown Port'),
        targetIslandId: ship.targetIslandId,
        targetLocationName: targetData?.name || null,
        homeIslandId: ship.homeIslandId,
        homeIslandName: homeData?.name || ship.homeIslandId,
        cargoGoodId: ship.cargo?.goodId || null,
        cargoQuantity: ship.cargo?.quantity || 0,
        cargoPriority: ship.cargoPriority || 'auto',
        isAtSelectedSupplier,
        isAtDestination,
        isEnRouteToDestination,
        isEnRouteToSupplier,
        isPrioritizingTargetGood,
      });
    }
  }

  // Prioritize sorting:
  // 1) Those prioritizing target good first
  // 2) Those at destination or supplier or en route
  // 3) Idle vessels
  // 4) Rest
  availableVessels.sort((a, b) => {
    if (a.isPrioritizingTargetGood !== b.isPrioritizingTargetGood) {
      return a.isPrioritizingTargetGood ? -1 : 1;
    }
    const aNear = a.isAtDestination || a.isAtSelectedSupplier || a.isEnRouteToDestination || a.isEnRouteToSupplier;
    const bNear = b.isAtDestination || b.isAtSelectedSupplier || b.isEnRouteToDestination || b.isEnRouteToSupplier;
    if (aNear !== bNear) {
      return aNear ? -1 : 1;
    }
    if (a.state === 'idle' && b.state !== 'idle') return -1;
    if (b.state === 'idle' && a.state !== 'idle') return 1;
    return a.name.localeCompare(b.name);
  });

  const berthsUsed = sim.getHomePortedShipsCount ? sim.getHomePortedShipsCount(destinationIslandId) : 0;
  const berthsMax = sim.getPortFleetCapacity ? sim.getPortFleetCapacity(destinationIslandId) : 5;
  const isBerthFull = berthsUsed >= berthsMax;
  const canAfford = Math.floor(sim.treasury) >= def.cost;

  let canCommission = true;
  let commissionBlockedReason: string | undefined;

  if (!isUnlocked) {
    canCommission = false;
    commissionBlockedReason = `Requires ${unlockedCountReq} connected islands (currently ${sim.unlockedIslands.size})`;
  } else if (isBerthFull) {
    canCommission = false;
    commissionBlockedReason = `Harbor berths full at ${destName} (${berthsUsed}/${berthsMax})`;
  } else if (!canAfford) {
    canCommission = false;
    commissionBlockedReason = `Insufficient funds: costs 🪙 ${def.cost} (treasury: 🪙 ${Math.floor(sim.treasury)})`;
  }

  return {
    typeId: def.id,
    typeName: def.name,
    tier: def.tier,
    cost: def.cost,
    range: def.range,
    capacity: def.capacity,
    speed: def.speed,
    canCarry,
    isUnlocked,
    unlockedCountReq,
    isRangeAdequate,
    routeDistanceKm,
    totalOwnedCount: availableVessels.length,
    availableVessels,
    destinationPortId: destinationIslandId,
    destinationPortName: destName,
    berthsUsed,
    berthsMax,
    isBerthFull,
    canAfford,
    canCommission,
    commissionBlockedReason,
  };
}

export interface VesselDestinationRecommendation {
  type: 'supplier' | 'buyer' | 'arbitrage' | 'trade_hub';
  portId: string;
  portName: string;
  region: string;
  isAwake: boolean;
  distanceKm: number;
  voyageDays: number;
  goodId?: string;
  goodName?: string;
  ratePerDay?: number;
  stock?: number;
  price?: number;
  estimatedProfit?: number;
  reason: string;
  badgeText: string;
  unlockCost?: number;
}

export interface AvailablePortOption {
  islandId: string;
  name: string;
  region: string;
  distanceKm: number;
  isAwake: boolean;
  tag: string;
}

export interface VesselTravelAnalysis {
  shipId: string;
  shipName: string;
  state: string;
  currentPortId: string;
  currentPortName: string;
  cargoPriority: string;
  isCargoEmpty: boolean;
  hasLocalProductionForPriority: boolean;
  explanation: string;
  topRecommendation: VesselDestinationRecommendation | null;
  alternativeRecommendations: VesselDestinationRecommendation[];
  allAvailablePorts: AvailablePortOption[];
}

/**
 * Analyzes strategic voyage and travel recommendations for a vessel,
 * determining which ports supply or demand its mandated cargo, identifying
 * closest trade hubs when empty, and calculating voyage distances.
 */
export function analyzeVesselVoyageOptions(
  sim: SimulationCore,
  shipId: string
): VesselTravelAnalysis | null {
  const ship = sim.shipManager?.ships.get(shipId);
  if (!ship) return null;

  const currentPortId = ship.currentIslandId || ship.targetIslandId || ship.homeIslandId;
  const currentIslandData = sim.islandsData.get(currentPortId);
  if (!currentIslandData) return null;

  const currentPortName = currentIslandData.name;
  const priority = ship.cargoPriority || 'auto';
  const isCargoEmpty = !ship.cargo || ship.cargo.quantity === 0;
  const effectiveSpeedKm = ship.effectiveSpeedKmPerDay || ship.speedKmPerDay || 45;

  let hasLocalProductionForPriority = false;
  let explanation = '';
  const recommendations: VesselDestinationRecommendation[] = [];

  const getPortDistanceKm = (targetId: string): number => {
    if (targetId === currentPortId) return 0;
    const navPath = sim.navGraph?.findPathBetweenIslands(currentPortId, targetId);
    if (navPath && navPath.totalDistanceKm > 0) {
      return Math.round(navPath.totalDistanceKm);
    }
    const tgt = sim.islandsData.get(targetId);
    if (!tgt) return 999;
    return Math.round(haversineDistanceKm(currentIslandData.lon, currentIslandData.lat, tgt.lon, tgt.lat));
  };

  const goodDef = priority !== 'auto' && sim.goodsData?.get ? sim.goodsData.get(priority) : null;
  const goodName = goodDef?.name || priority.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (priority !== 'auto') {
    const localRate = currentIslandData.produces?.[priority] || 0;
    hasLocalProductionForPriority = localRate > 0;

    if (!hasLocalProductionForPriority) {
      explanation = `${currentPortName} Port does not produce ${goodName}. Sail to an established supplier port below to load cargo.`;

      const supplierCandidates: VesselDestinationRecommendation[] = [];
      for (const [prodId, prodData] of sim.islandsData.entries()) {
        if (prodId === currentPortId) continue;
        const rate = prodData.produces?.[priority];
        if (rate && rate > 0) {
          const isAwake = sim.unlockedIslands.has(prodId);
          const distKm = getPortDistanceKm(prodId);
          const voyageDays = Number((distKm / Math.max(10, effectiveSpeedKm)).toFixed(1));
          const prodEco = sim.islands.get(prodId);
          const prodMarket = prodEco?.markets[priority];
          const stock = prodMarket ? Math.floor(prodMarket.stock) : 0;
          const price = prodMarket ? Number(prodMarket.buyPrice.toFixed(1)) : 0;
          const unlockCost = prodData.unlock?.cost || 0;

          supplierCandidates.push({
            type: 'supplier',
            portId: prodId,
            portName: prodData.name,
            region: prodData.region,
            isAwake,
            distanceKm: distKm,
            voyageDays,
            goodId: priority,
            goodName,
            ratePerDay: rate,
            stock,
            price,
            unlockCost,
            reason: isAwake
              ? `Produces +${rate}/d • Stock: ${stock} • Wholesale: ${price} 🪙`
              : `Port locked • Requires awakening (${unlockCost} 🪙)`,
            badgeText: isAwake ? 'SUPPLIER' : 'LOCKED',
          });
        }
      }

      supplierCandidates.sort((a, b) => {
        if (a.isAwake !== b.isAwake) return a.isAwake ? -1 : 1;
        return a.distanceKm - b.distanceKm;
      });

      recommendations.push(...supplierCandidates);
    } else {
      const currentStock = Math.floor(sim.islands.get(currentPortId)?.markets[priority]?.stock || 0);
      explanation = `${currentPortName} Port produces ${goodName} (Stock: ${currentStock}). Deliver to ports in deficit for maximum revenue.`;

      const buyerCandidates: VesselDestinationRecommendation[] = [];
      for (const [targetId, targetData] of sim.islandsData.entries()) {
        if (targetId === currentPortId) continue;
        const consumeRate = targetData.consumes?.[priority];
        if (consumeRate && consumeRate > 0) {
          const isAwake = sim.unlockedIslands.has(targetId);
          const distKm = getPortDistanceKm(targetId);
          const voyageDays = Number((distKm / Math.max(10, effectiveSpeedKm)).toFixed(1));
          const targetEco = sim.islands.get(targetId);
          const targetMarket = targetEco?.markets[priority];
          const isDeficit = targetMarket ? (targetMarket.isStarving || targetMarket.stock < targetMarket.targetStock) : false;
          const sellPrice = targetMarket ? Number(targetMarket.sellPrice.toFixed(1)) : 0;
          const unlockCost = targetData.unlock?.cost || 0;

          buyerCandidates.push({
            type: 'buyer',
            portId: targetId,
            portName: targetData.name,
            region: targetData.region,
            isAwake,
            distanceKm: distKm,
            voyageDays,
            goodId: priority,
            goodName,
            ratePerDay: consumeRate,
            stock: targetMarket ? Math.floor(targetMarket.stock) : 0,
            price: sellPrice,
            unlockCost,
            reason: isAwake
              ? `Demands -${consumeRate}/d • Price: ${sellPrice} 🪙${isDeficit ? ' • 🚨 Deficit' : ''}`
              : `Port locked • Requires awakening (${unlockCost} 🪙)`,
            badgeText: isDeficit ? 'DEFICIT BUYER' : (isAwake ? 'BUYER' : 'LOCKED'),
          });
        }
      }

      buyerCandidates.sort((a, b) => {
        if (a.isAwake !== b.isAwake) return a.isAwake ? -1 : 1;
        const aDef = a.badgeText.includes('DEFICIT') ? 1 : 0;
        const bDef = b.badgeText.includes('DEFICIT') ? 1 : 0;
        if (aDef !== bDef) return bDef - aDef;
        return a.distanceKm - b.distanceKm;
      });

      recommendations.push(...buyerCandidates);
    }
  } else {
    const currentEco = sim.islands.get(currentPortId);
    let hasExportStock = false;
    if (currentEco) {
      for (const m of Object.values(currentEco.markets)) {
        if (m.produceRatePerDay > 0 && m.stock >= 1) {
          hasExportStock = true;
          break;
        }
      }
    }

    if (hasExportStock) {
      explanation = `${currentPortName} Port has export goods in warehouse. Recommended high-profit trade routes:`;

      const autoOpportunities: VesselDestinationRecommendation[] = [];
      for (const targetId of sim.unlockedIslands) {
        if (targetId === currentPortId) continue;
        const targetData = sim.islandsData.get(targetId);
        const targetEco = sim.islands.get(targetId);
        if (!targetData || !targetEco) continue;

        const distKm = getPortDistanceKm(targetId);
        const voyageDays = Number((distKm / Math.max(10, effectiveSpeedKm)).toFixed(1));

        for (const [goodId, curMarket] of Object.entries(currentEco!.markets)) {
          if (curMarket.produceRatePerDay <= 0 || curMarket.stock < 1) continue;
          const tgtMarket = targetEco.markets[goodId];
          if (!tgtMarket || tgtMarket.consumeRatePerDay <= 0) continue;

          const margin = tgtMarket.sellPrice - curMarket.buyPrice;
          if (margin <= 0.1) continue;

          const tradeQty = Math.min(ship.capacity, Math.floor(curMarket.stock));
          const estProfit = Math.round(tradeQty * margin);

          autoOpportunities.push({
            type: 'arbitrage',
            portId: targetId,
            portName: targetData.name,
            region: targetData.region,
            isAwake: true,
            distanceKm: distKm,
            voyageDays,
            goodId,
            goodName: sim.goodsData?.get(goodId)?.name || goodId,
            ratePerDay: tgtMarket.consumeRatePerDay,
            stock: Math.floor(tgtMarket.stock),
            price: Number(tgtMarket.sellPrice.toFixed(1)),
            estimatedProfit: estProfit,
            reason: `Haul ${tradeQty} ${sim.goodsData?.get(goodId)?.name || goodId} ➔ Est. +${estProfit} 🪙 profit`,
            badgeText: 'TOP ARBITRAGE',
          });
        }
      }

      autoOpportunities.sort((a, b) => (b.estimatedProfit || 0) - (a.estimatedProfit || 0));
      recommendations.push(...autoOpportunities);
    } else {
      explanation = `${currentPortName} Port export stockpiles are low. Travel to a major production hub with abundant goods:`;

      const hubs: VesselDestinationRecommendation[] = [];
      for (const hubId of sim.unlockedIslands) {
        if (hubId === currentPortId) continue;
        const hubData = sim.islandsData.get(hubId);
        const hubEco = sim.islands.get(hubId);
        if (!hubData || !hubEco) continue;

        let totalExportStock = 0;
        const exportedNames: string[] = [];
        for (const [gid, m] of Object.entries(hubEco.markets)) {
          if (m.produceRatePerDay > 0 && m.stock >= 2) {
            totalExportStock += Math.floor(m.stock);
            exportedNames.push(sim.goodsData?.get(gid)?.name || gid);
          }
        }

        if (totalExportStock >= 2) {
          const distKm = getPortDistanceKm(hubId);
          const voyageDays = Number((distKm / Math.max(10, effectiveSpeedKm)).toFixed(1));
          hubs.push({
            type: 'trade_hub',
            portId: hubId,
            portName: hubData.name,
            region: hubData.region,
            isAwake: true,
            distanceKm: distKm,
            voyageDays,
            stock: totalExportStock,
            reason: `Abundant ${exportedNames.slice(0, 2).join(' & ')} (${totalExportStock} in stock)`,
            badgeText: 'SUPPLY HUB',
          });
        }
      }

      hubs.sort((a, b) => a.distanceKm - b.distanceKm);
      recommendations.push(...hubs);
    }
  }

  const allAvailablePorts: AvailablePortOption[] = [];
  for (const [pId, pData] of sim.islandsData.entries()) {
    if (pId === currentPortId) continue;
    const isAwake = sim.unlockedIslands.has(pId);
    const distKm = getPortDistanceKm(pId);
    let tag = '';
    if (priority !== 'auto') {
      if (pData.produces?.[priority]) tag = ` • ⛽ Produces ${goodName}`;
      else if (pData.consumes?.[priority]) tag = ` • Demands ${goodName}`;
    }
    allAvailablePorts.push({
      islandId: pId,
      name: pData.name,
      region: pData.region,
      distanceKm: distKm,
      isAwake,
      tag,
    });
  }

  allAvailablePorts.sort((a, b) => {
    if (a.isAwake !== b.isAwake) return a.isAwake ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });

  const topRecommendation = recommendations.length > 0 ? recommendations[0] : null;
  const alternativeRecommendations = recommendations.slice(1, 4);

  return {
    shipId,
    shipName: ship.name,
    state: ship.state,
    currentPortId,
    currentPortName,
    cargoPriority: priority,
    isCargoEmpty,
    hasLocalProductionForPriority,
    explanation,
    topRecommendation,
    alternativeRecommendations,
    allAvailablePorts,
  };
}


