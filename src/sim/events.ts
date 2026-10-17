import type { SimulationCore } from './simulation';

export type FestivalType =
  | 'panigiri'
  | 'olive_harvest'
  | 'wine_vintage'
  | 'building_boom'
  | 'sponge_regatta';

export interface IslandEvent {
  id: string;
  type: FestivalType;
  title: string;
  description: string;
  islandId: string;
  islandName: string;
  startDay: number;
  durationDays: number;
  affectedGoods: string[];
  priceMultiplier: number;
  demandMultiplier: number;
  supplyMultiplier: number;
  badge: string;
  color: string;
}

export type EventCallback = (event: IslandEvent) => void;

interface EventTemplate {
  type: FestivalType;
  titleSuffix: string;
  description: string;
  badge: string;
  color: string;
  affectedGoods: string[];
  priceMultiplier: number;
  demandMultiplier: number;
  supplyMultiplier: number;
  durationMinDays: number;
  durationMaxDays: number;
  preferredIslands?: string[];
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    type: 'panigiri',
    titleSuffix: 'Panigiri Festival',
    description: 'Festive Saint day feast! Wine, cheese, and produce demand surges with soaring merchant payout prices.',
    badge: '🎪 Panigiri',
    color: '#f59e0b',
    affectedGoods: ['wine', 'cheese', 'produce'],
    priceMultiplier: 1.85,
    demandMultiplier: 2.4,
    supplyMultiplier: 1.0,
    durationMinDays: 4,
    durationMaxDays: 7,
    preferredIslands: ['naxos', 'ikaria', 'amorgos', 'tinos', 'paros', 'santorini'],
  },
  {
    type: 'olive_harvest',
    titleSuffix: 'Bumper Olive Harvest',
    description: 'Ancient groves yield a record harvest! Olive oil fills the press houses, slashing buy prices for trading ships.',
    badge: '🫒 Olive Boom',
    color: '#84cc16',
    affectedGoods: ['olive_oil'],
    priceMultiplier: 0.55,
    demandMultiplier: 1.0,
    supplyMultiplier: 2.5,
    durationMinDays: 5,
    durationMaxDays: 8,
    preferredIslands: ['crete_heraklion', 'crete_chania', 'lesbos', 'chios', 'milos'],
  },
  {
    type: 'wine_vintage',
    titleSuffix: 'Grand Vintage Harvest',
    description: 'Volcanic vineyards produce an extraordinary vintage. Island wine sells at high luxury prices.',
    badge: '🍷 Grand Vintage',
    color: '#f43f5e',
    affectedGoods: ['wine'],
    priceMultiplier: 1.70,
    demandMultiplier: 1.3,
    supplyMultiplier: 1.8,
    durationMinDays: 4,
    durationMaxDays: 6,
    preferredIslands: ['santorini', 'samos', 'naxos', 'paros', 'limnos'],
  },
  {
    type: 'building_boom',
    titleSuffix: 'Sanctuary Construction Boom',
    description: 'Harbor engineers and temple builders demand bulk marble and artisan crafts at premium rates.',
    badge: '🏛️ Building Boom',
    color: '#a78bfa',
    affectedGoods: ['marble', 'crafts'],
    priceMultiplier: 1.95,
    demandMultiplier: 2.6,
    supplyMultiplier: 1.0,
    durationMinDays: 5,
    durationMaxDays: 9,
    preferredIslands: ['delos', 'syros', 'rhodes', 'piraeus', 'naxos'],
  },
  {
    type: 'sponge_regatta',
    titleSuffix: 'Sponge Regatta & Fish Fair',
    description: 'Flotillas of divers return with bountiful marine hauls. High commercial demand for sponges and seafood.',
    badge: '🧽 Sponge Fair',
    color: '#fb923c',
    affectedGoods: ['sponges', 'fish'],
    priceMultiplier: 1.75,
    demandMultiplier: 2.2,
    supplyMultiplier: 1.5,
    durationMinDays: 4,
    durationMaxDays: 7,
    preferredIslands: ['kalymnos', 'symi', 'rhodes', 'chalki', 'astypalaia'],
  },
];

export class IslandEventManager {
  public activeEvents: Map<string, IslandEvent> = new Map(); // Keyed by islandId
  public autoSpawn = true;
  private nextEventCheckDay = 2.5; // First event triggers early (~2.5 days)
  private eventCheckIntervalDays = 8.0; // New events check every 6-10 days
  private maxConcurrentEvents = 3;

  private onEventStartListeners: Set<EventCallback> = new Set();
  private onEventEndListeners: Set<EventCallback> = new Set();

  public onEventStart(cb: EventCallback): () => void {
    this.onEventStartListeners.add(cb);
    return () => this.onEventStartListeners.delete(cb);
  }

  public onEventEnd(cb: EventCallback): () => void {
    this.onEventEndListeners.add(cb);
    return () => this.onEventEndListeners.delete(cb);
  }

  public tick(sim: SimulationCore, _deltaDays: number): void {
    const curDay = sim.gameDay;

    // 1. Check expiration of active events
    for (const [islandId, evt] of Array.from(this.activeEvents.entries())) {
      if (curDay >= evt.startDay + evt.durationDays) {
        this.activeEvents.delete(islandId);
        for (const cb of this.onEventEndListeners) {
          cb(evt);
        }
      }
    }

    // 2. Periodically spawn new dynamic events
    if (this.autoSpawn && curDay >= this.nextEventCheckDay) {
      this.nextEventCheckDay = curDay + (this.eventCheckIntervalDays * (0.8 + Math.random() * 0.4));
      this.tryTriggerRandomEvent(sim);
    }
  }

  /**
   * Manually triggers an event on an island (useful for tests and scripted moments).
   */
  public triggerEvent(
    type: FestivalType,
    islandId: string,
    sim: SimulationCore,
    customDuration?: number
  ): IslandEvent | null {
    const template = EVENT_TEMPLATES.find((t) => t.type === type);
    if (!template) return null;

    const island = sim.islandsData.get(islandId);
    if (!island) return null;

    // End existing event on this island if any
    const existing = this.activeEvents.get(islandId);
    if (existing) {
      this.activeEvents.delete(islandId);
      for (const cb of this.onEventEndListeners) {
        cb(existing);
      }
    }

    const durationDays = customDuration ?? (
      template.durationMinDays + Math.random() * (template.durationMaxDays - template.durationMinDays)
    );

    const event: IslandEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: template.type,
      title: `${island.name} ${template.titleSuffix}`,
      description: template.description,
      islandId,
      islandName: island.name,
      startDay: sim.gameDay,
      durationDays: Math.round(durationDays * 10) / 10,
      affectedGoods: [...template.affectedGoods],
      priceMultiplier: template.priceMultiplier,
      demandMultiplier: template.demandMultiplier,
      supplyMultiplier: template.supplyMultiplier,
      badge: template.badge,
      color: template.color,
    };

    this.activeEvents.set(islandId, event);

    for (const cb of this.onEventStartListeners) {
      cb(event);
    }

    return event;
  }

  /**
   * Returns active event modifiers for a specific island and commodity.
   */
  public getMultipliers(islandId: string, goodId: string): {
    priceMultiplier: number;
    demandMultiplier: number;
    supplyMultiplier: number;
    activeEvent: IslandEvent | null;
  } {
    const evt = this.activeEvents.get(islandId);
    if (!evt || !evt.affectedGoods.includes(goodId)) {
      return { priceMultiplier: 1.0, demandMultiplier: 1.0, supplyMultiplier: 1.0, activeEvent: null };
    }

    return {
      priceMultiplier: evt.priceMultiplier,
      demandMultiplier: evt.demandMultiplier,
      supplyMultiplier: evt.supplyMultiplier,
      activeEvent: evt,
    };
  }

  public getActiveEventForIsland(islandId: string): IslandEvent | null {
    return this.activeEvents.get(islandId) || null;
  }

  public getActiveEvents(): IslandEvent[] {
    return Array.from(this.activeEvents.values());
  }

  private tryTriggerRandomEvent(sim: SimulationCore): void {
    if (this.activeEvents.size >= this.maxConcurrentEvents) return;

    // Pick from unlocked islands so the player can trade with the active event
    const unlockedIds = Array.from(sim.unlockedIslands);
    if (unlockedIds.length === 0) return;

    // Filter out islands that already have an active event
    const eligibleIslands = unlockedIds.filter((id) => !this.activeEvents.has(id));
    if (eligibleIslands.length === 0) return;

    // Pick a random template
    const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];

    // Check if any eligible island matches the preferred list
    let chosenIslandId: string | null = null;
    if (template.preferredIslands) {
      const preferredEligible = eligibleIslands.filter((id) => template.preferredIslands!.includes(id));
      if (preferredEligible.length > 0) {
        chosenIslandId = preferredEligible[Math.floor(Math.random() * preferredEligible.length)];
      }
    }

    if (!chosenIslandId) {
      chosenIslandId = eligibleIslands[Math.floor(Math.random() * eligibleIslands.length)];
    }

    this.triggerEvent(template.type, chosenIslandId, sim);
  }
}
