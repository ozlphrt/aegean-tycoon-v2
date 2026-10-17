export interface IslandData {
  id: string;
  name: string;
  tier?: number;
  peak?: {
    lat: number;
    lon: number;
    name?: string;
    elevation?: number;
  };
  maskId: number;
  type: 'island' | 'mainland_port';
  country: string;
  region: string;
  lat: number;
  lon: number;
  population: number;
  port: { lat: number; lon: number };
  produces: Record<string, number>;
  consumes: Record<string, number>;
  unlock: {
    cost?: number;
    tp?: number;
    isStart?: boolean;
    requiresConnectedTo?: string[];
  };
  tourismBase?: number;
}

export interface GoodDefinition {
  id: string;
  name: string;
  basePrice: number;
  volume: number;
  perishable: boolean;
  icon: string;
  color: string;
  description: string;
}

export interface BalanceConfig {
  tickRateHz: number;
  secondsPerGameDay: number;
  priceElasticity: number;
  minPriceMultiplier: number;
  maxPriceMultiplier: number;
  targetBufferDays: number;
  storageCapacityFactor: number;
  minStorageCapacity: number;
  perishableDecayPerDay: number;
  distressThreshold: number;
  distressGrowthRate: number;
  prosperitySurplusRatio: number;
  prosperityGrowthRate: number;
  startingTreasury: number;
  startingTradePoints: number;
  startingGameDate: string;
}

export interface ShipDefinition {
  id: string;
  name: string;
  tier: number;
  capacity: number;
  speed: number;
  cost: number;
  range: number;
  upkeepPerDay: number;
  description: string;
  unlock: {
    islandsConnected: number;
  };
}

export interface CommodityMarketState {
  goodId: string;
  stock: number;
  targetStock: number;
  maxCapacity: number;
  produceRatePerDay: number;
  consumeRatePerDay: number;
  buyPrice: number;  // Price player/merchant pays to buy FROM island
  sellPrice: number; // Price island pays to buy FROM player/merchant
  isStarving: boolean;
  isSurplus: boolean;
}

export interface IslandEconomyState {
  islandId: string;
  unlocked: boolean;
  prosperity: number; // 0.0 (distressed) to 1.0 (booming)
  distress: number;   // 0.0 to 1.0
  markets: Record<string, CommodityMarketState>;
}

export interface ShipDataSnapshot {
  id: string;
  name: string;
  typeId: string;
  tier: number;
  capacity: number;
  state: 'idle' | 'loading' | 'sailing' | 'unloading';
  homeIslandId: string;
  currentIslandId: string | null;
  targetIslandId: string | null;
  cargo: { goodId: string; quantity: number; buyPrice: number } | null;
  position: { lon: number; lat: number };
  heading: number;
  tripsCompleted: number;
  totalProfit: number;
  cargoPriority?: string;
}

export interface SimulationSnapshot {
  gameDay: number;
  gameDate: string;
  totalTicks: number;
  treasury: number;
  tradePoints: number;
  unlockedIslandsCount: number;
  islands: Record<string, IslandEconomyState>;
  ships: ShipDataSnapshot[];
  recentTransactionsCount: number;
}

