/**
 * TopSearch.ts — Top Navigation Bar Omnisearch for Islands & Vessels
 * 
 * Provides instantaneous fuzzy search, real-time keyboard navigation (Arrow keys, Enter, Esc, /),
 * and direct 3D camera framing / inspection for all islands and fleet vessels across the Aegean.
 */

import type { SimulationCore } from '../sim/simulation';
import type { IslandData } from '../data/types';
import type { ShipInstance } from '../sim/shipSim';
import { evaluateShipUtilization } from '../sim/shipSim';
import { audio } from '../audio/AudioManager';
import { icons, getShipTierIconSvg } from './Icons';
import { getIslandName, getGoodName, getRegionName, ISLAND_NAMES } from '../ui/i18n';

export interface TopSearchCallbacks {
  onSelectIsland: (islandId: string) => void;
  onSelectShip: (shipId: string) => void;
}

export interface IslandSearchResult {
  type: 'island';
  island: IslandData;
  isLit: boolean;
  score: number;
}

export interface VesselSearchResult {
  type: 'vessel';
  ship: ShipInstance;
  homeName: string;
  targetName: string | null;
  score: number;
}

export type SearchItem = IslandSearchResult | VesselSearchResult;

export interface SearchResultsPayload {
  islands: IslandSearchResult[];
  vessels: VesselSearchResult[];
  items: SearchItem[];
}

/**
 * Pure search function over archipelago islands and fleet vessels with relevance scoring.
 */
export function searchArchipelagoAndFleet(
  sim: SimulationCore,
  rawQuery: string,
  filter: 'all' | 'islands' | 'vessels' = 'all'
): SearchResultsPayload {
  const query = rawQuery.trim().toLowerCase();

  // 1. Search Islands
  const islandResults: IslandSearchResult[] = [];
  const allIslands = Array.from(sim.islandsData.values());

  for (const island of allIslands) {
    const isLit = sim.unlockedIslands.has(island.id);
    const name = island.name.toLowerCase();
    const localizedName = getIslandName(island.id, island.name).toLowerCase();
    const entry = ISLAND_NAMES[island.id.toLowerCase()];
    const elName = (entry?.el || '').toLowerCase();
    const trName = (entry?.tr || '').toLowerCase();
    const region = (island.region || '').toLowerCase();
    const produces = Object.keys(island.produces || {}).map(g => `${g} ${getGoodName(g)}`).join(' ').toLowerCase();
    const consumes = Object.keys(island.consumes || {}).map(g => `${g} ${getGoodName(g)}`).join(' ').toLowerCase();

    let score = -1;
    if (!query) {
      // Default ranking: lit islands first, then by population
      score = isLit ? 10_000_000 + island.population : island.population;
    } else if (name === query || localizedName === query || elName === query || trName === query) {
      score = 2000;
    } else if (name.startsWith(query) || localizedName.startsWith(query) || elName.startsWith(query) || trName.startsWith(query)) {
      score = 1500;
    } else if (name.includes(query) || localizedName.includes(query) || elName.includes(query) || trName.includes(query)) {
      score = 1000;
    } else if (region.includes(query)) {
      score = 600;
    } else if (produces.includes(query) || consumes.includes(query)) {
      score = 400;
    }

    if (score > 0) {
      islandResults.push({
        type: 'island',
        island,
        isLit,
        score,
      });
    }
  }

  islandResults.sort((a, b) => b.score - a.score);

  // 2. Search Vessels
  const vesselResults: VesselSearchResult[] = [];
  const ships = sim.shipManager ? Array.from(sim.shipManager.ships.values()) : [];

  for (const ship of ships) {
    const sName = ship.name.toLowerCase();
    const sType = ship.typeId.toLowerCase().replace('_', ' ');
    const homeName = sim.islandsData.get(ship.homeIslandId)?.name || 'Port';
    const targetName = ship.targetIslandId ? (sim.islandsData.get(ship.targetIslandId)?.name || ship.targetIslandId) : null;
    const cargoGood = ship.cargo ? ship.cargo.goodId.toLowerCase().replace('_', ' ') : '';
    const state = ship.state.toLowerCase();

    let score = -1;
    if (!query) {
      // Default ranking: total profit
      score = ship.totalProfit + 10;
    } else if (sName === query) {
      score = 2000;
    } else if (sName.startsWith(query)) {
      score = 1500;
    } else if (sName.includes(query)) {
      score = 1000;
    } else if (homeName.toLowerCase().includes(query) || (targetName && targetName.toLowerCase().includes(query))) {
      score = 600;
    } else if (sType.includes(query) || cargoGood.includes(query) || state.includes(query)) {
      score = 400;
    }

    if (score > 0) {
      vesselResults.push({
        type: 'vessel',
        ship,
        homeName,
        targetName,
        score,
      });
    }
  }

  vesselResults.sort((a, b) => b.score - a.score);

  let items: SearchItem[] = [];
  if (filter === 'all') {
    const topIslands = query ? islandResults.slice(0, 7) : islandResults.slice(0, 5);
    const topVessels = query ? vesselResults.slice(0, 7) : vesselResults.slice(0, 5);
    items = [...topIslands, ...topVessels];
  } else if (filter === 'islands') {
    items = islandResults.slice(0, 15);
  } else if (filter === 'vessels') {
    items = vesselResults.slice(0, 15);
  }

  return {
    islands: islandResults,
    vessels: vesselResults,
    items,
  };
}

export class TopSearch {
  private containerEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private clearBtn: HTMLElement | null = null;
  private kbdHint: HTMLElement | null = null;
  private dropdownEl: HTMLElement | null = null;
  private filterPillsEl: HTMLElement | null = null;
  private resultsListEl: HTMLElement | null = null;
  private countIslandsEl: HTMLElement | null = null;
  private countVesselsEl: HTMLElement | null = null;

  private activeFilter: 'all' | 'islands' | 'vessels' = 'all';
  private currentResults: SearchItem[] = [];
  private selectedIndex = -1;
  private isOpen = false;

  constructor(
    private sim: SimulationCore,
    private callbacks: TopSearchCallbacks
  ) {
    this.initDOM();
  }

  private initDOM(): void {
    this.containerEl = document.getElementById('top-search-container');
    this.inputEl = document.getElementById('top-search-input') as HTMLInputElement | null;
    this.clearBtn = document.getElementById('btn-top-search-clear');
    this.kbdHint = document.getElementById('top-search-kbd-hint');
    this.dropdownEl = document.getElementById('top-search-dropdown');
    this.filterPillsEl = document.getElementById('top-search-filter-pills');
    this.resultsListEl = document.getElementById('top-search-results-list');
    this.countIslandsEl = document.getElementById('search-count-islands');
    this.countVesselsEl = document.getElementById('search-count-vessels');

    if (!this.inputEl || !this.dropdownEl) return;

    // Input typing & search execution
    this.inputEl.addEventListener('input', () => {
      this.handleInput();
    });

    this.inputEl.addEventListener('focus', () => {
      if (this.kbdHint) this.kbdHint.style.display = 'none';
      this.openDropdown();
      this.performSearch();
    });

    // Clear search button
    this.clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.inputEl) {
        this.inputEl.value = '';
        this.inputEl.focus();
        this.handleInput();
      }
    });

    // Filter pill tabs
    this.filterPillsEl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.top-search-filter-pill') as HTMLElement | null;
      if (!btn) return;
      const filter = btn.getAttribute('data-filter') as 'all' | 'islands' | 'vessels';
      if (filter) {
        this.setFilter(filter);
      }
    });

    // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < this.currentResults.length) {
          this.activateItem(this.currentResults[this.selectedIndex]);
        } else if (this.currentResults.length > 0) {
          this.activateItem(this.currentResults[0]);
        }
      } else if (e.key === 'Escape') {
        this.closeDropdown();
        this.inputEl?.blur();
      }
    });

    // Result list click delegation
    this.resultsListEl?.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest('.search-result-row') as HTMLElement | null;
      if (!row) return;
      const index = parseInt(row.getAttribute('data-index') || '-1', 10);
      if (index >= 0 && index < this.currentResults.length) {
        this.activateItem(this.currentResults[index]);
      }
    });

    // Click outside to dismiss dropdown
    document.addEventListener('click', (e) => {
      if (!this.containerEl?.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    // Global keyboard shortcut '/' to focus search from anywhere
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.inputEl?.focus();
        this.inputEl?.select();
      }
    });
  }

  private handleInput(): void {
    const val = this.inputEl?.value.trim() || '';
    if (this.clearBtn) {
      this.clearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
    }
    if (this.kbdHint) {
      this.kbdHint.style.display = val.length > 0 ? 'none' : 'inline-block';
    }
    this.openDropdown();
    this.performSearch();
  }

  public setFilter(filter: 'all' | 'islands' | 'vessels'): void {
    this.activeFilter = filter;
    const pills = this.filterPillsEl?.querySelectorAll('.top-search-filter-pill');
    pills?.forEach((p) => {
      p.classList.toggle('active', p.getAttribute('data-filter') === filter);
    });
    audio.playClickSound();
    this.renderResults();
  }

  public openDropdown(): void {
    if (!this.isOpen && this.dropdownEl) {
      this.isOpen = true;
      this.dropdownEl.classList.remove('closed');
    }
  }

  public closeDropdown(): void {
    if (this.isOpen && this.dropdownEl) {
      this.isOpen = false;
      this.dropdownEl.classList.add('closed');
      this.selectedIndex = -1;
      if (this.kbdHint && (!this.inputEl || !this.inputEl.value)) {
        this.kbdHint.style.display = 'inline-block';
      }
    }
  }

  /**
   * Queries islands and active fleet vessels with relevance scoring.
   */
  public performSearch(): void {
    const rawQuery = this.inputEl?.value || '';
    const results = searchArchipelagoAndFleet(this.sim, rawQuery, this.activeFilter);

    // Update counter pills
    if (this.countIslandsEl) this.countIslandsEl.textContent = results.islands.length.toString();
    if (this.countVesselsEl) this.countVesselsEl.textContent = results.vessels.length.toString();

    this.currentResults = results.items;
    this.selectedIndex = this.currentResults.length > 0 ? 0 : -1;
    this.renderResults();
  }

  private renderResults(): void {
    if (!this.resultsListEl) return;
    const query = this.inputEl?.value.trim() || '';

    if (this.currentResults.length === 0) {
      this.resultsListEl.innerHTML = `
        <div class="search-empty-state">
          <span class="search-empty-icon">🧭</span>
          <p class="search-empty-title">No matching islands or vessels</p>
          <span class="search-empty-sub">Search by island name (Naxos, Crete), ship (Delphis), region (Cyclades), or commodity (Wine).</span>
        </div>
      `;
      return;
    }

    const iconStyle = icons.getStyle();
    let html = '';
    let currentCategory: string | null = null;

    this.currentResults.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;

      if (this.activeFilter === 'all') {
        const catName = item.type === 'island' ? '🏝️ Islands & Ports' : '⛵ Maritime Fleet';
        if (currentCategory !== catName) {
          currentCategory = catName;
          html += `<div class="search-group-header">${catName}</div>`;
        }
      }

      if (item.type === 'island') {
        const { island, isLit } = item;
        const popStr = island.population >= 1000 ? `${(island.population / 1000).toFixed(0)}k` : island.population.toString();
        const litBadge = isLit
          ? `<span class="search-badge-status lit">☀️ Daylight</span>`
          : `<span class="search-badge-status asleep">🔒 Sleeping</span>`;

        const producesKeys = Object.keys(island.produces || {}).slice(0, 2).map(g => g.replace('_', ' ')).join(', ');
        const consumesKeys = Object.keys(island.consumes || {}).slice(0, 2).map(g => g.replace('_', ' ')).join(', ');
        const subDetails = [
          `Pop: ${popStr}`,
          producesKeys ? `Produces: ${producesKeys}` : null,
          consumesKeys ? `Consumes: ${consumesKeys}` : null,
        ].filter(Boolean).join(' • ');

        const displayName = getIslandName(island.id, island.name);
        const localizedRegion = island.region ? getRegionName(island.region).toUpperCase() : 'AEGEAN';

        html += `
          <div class="search-result-row island-row ${isSelected ? 'active' : ''}" data-index="${index}" title="Click to view & focus on ${displayName}">
            <div class="search-row-left">
              <span class="search-item-icon">${isLit ? '☀️' : '🏝️'}</span>
              <div class="search-item-info">
                <div class="search-item-header">
                  <strong class="search-item-name">${this.highlightMatch(displayName, query)}</strong>
                  <span class="search-badge-region">${localizedRegion}</span>
                </div>
                <div class="search-item-sub">${subDetails}</div>
              </div>
            </div>
            <div class="search-row-right">
              ${litBadge}
            </div>
          </div>
        `;
      } else {
        const { ship, homeName, targetName } = item;
        const uAlert = evaluateShipUtilization(ship, this.sim);
        const tierIcon = getShipTierIconSvg(ship.tier, iconStyle, 16);
        const profitStr = Math.floor(ship.totalProfit) >= 1000
          ? `${(ship.totalProfit / 1000).toFixed(1)}k`
          : Math.floor(ship.totalProfit).toString();

        let stateBadge = '';
        if (uAlert) {
          stateBadge = `<span class="vessel-underutilized-chip ${uAlert.severity}">⚠️ ${uAlert.label}</span>`;
        } else if (ship.state === 'sailing' && targetName) {
          stateBadge = `<span class="vessel-dest-chip sailing">➔ ${targetName}</span>`;
        } else {
          stateBadge = `<span class="vessel-dest-chip docked">⚓ Docked</span>`;
        }

        const cargoDesc = ship.cargo ? `${ship.cargo.quantity}t ${ship.cargo.goodId.replace('_', ' ')}` : 'Empty';
        const subDetails = `T${ship.tier} ${ship.typeId.replace('_', ' ')} • Home: ${homeName} • Cargo: ${cargoDesc}`;

        html += `
          <div class="search-result-row vessel-row ${isSelected ? 'active' : ''}" data-index="${index}" title="Click to inspect & track ${ship.name}">
            <div class="search-row-left">
              <span class="search-tier-badge tier-${ship.tier}">${tierIcon} T${ship.tier}</span>
              <div class="search-item-info">
                <div class="search-item-header">
                  <strong class="search-item-name">${this.highlightMatch(ship.name, query)}</strong>
                  <span class="vessel-profit-chip">+🪙 ${profitStr}</span>
                </div>
                <div class="search-item-sub">${subDetails}</div>
              </div>
            </div>
            <div class="search-row-right">
              ${stateBadge}
            </div>
          </div>
        `;
      }
    });

    this.resultsListEl.innerHTML = html;
  }

  private moveSelection(delta: number): void {
    if (this.currentResults.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.currentResults.length) % this.currentResults.length;
    this.renderResults();

    // Scroll active item into view
    const activeRow = this.resultsListEl?.querySelector(`.search-result-row[data-index="${this.selectedIndex}"]`) as HTMLElement | null;
    activeRow?.scrollIntoView({ block: 'nearest' });
  }

  private activateItem(item: SearchItem): void {
    this.closeDropdown();
    audio.playClickSound();

    if (item.type === 'island') {
      this.callbacks.onSelectIsland(item.island.id);
    } else {
      this.callbacks.onSelectShip(item.ship.id);
    }
  }

  private highlightMatch(text: string, query: string): string {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const matched = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return `${before}<mark class="search-highlight">${matched}</mark>${after}`;
  }
}
