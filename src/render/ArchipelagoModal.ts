import type { SimulationCore } from '../sim/simulation';
import {
  getArchipelagoDirectory,
  type ArchipelagoIslandEntry,
} from '../sim/archipelago';
import { icons, getIconSvg, getGoodIconSvg } from './Icons';
import { audio } from '../audio/AudioManager';

function formatGoodName(id: string): string {
  return id.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ArchipelagoModalCallbacks {
  onFocusIsland: (islandId: string) => void;
  onAwakenIsland: (islandId: string) => void;
  onOpenReport?: (islandId: string) => void;
  onOpenSourcing?: (islandId: string, goodId: string) => void;
  onOpenFleet?: () => void;
}

export type ArchipelagoSortKey =
  | 'population_desc'
  | 'opportunity_desc'
  | 'prosperity_desc'
  | 'cost_asc'
  | 'name_asc'
  | 'region_asc';

export type ArchipelagoFilterKey = 'all' | 'awake' | 'sleeping' | 'ready';

export type ArchipelagoKpiKey = 'coverage' | 'population' | 'ready' | 'prospect';

export class ArchipelagoModal {
  private modalEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private sortSelect: HTMLSelectElement | null = null;

  private currentSort: ArchipelagoSortKey = 'population_desc';
  private currentFilter: ArchipelagoFilterKey = 'all';
  private activeKpiDetail: ArchipelagoKpiKey | null = null;
  private searchQuery = '';
  private isVisible = false;

  constructor(
    private sim: SimulationCore,
    private callbacks: ArchipelagoModalCallbacks
  ) {
    this.initDOM();
  }

  private initDOM() {
    this.modalEl = document.getElementById('archipelago-modal');
    this.contentEl = document.getElementById('archipelago-modal-content');

    // Close button
    document.getElementById('btn-close-archipelago')?.addEventListener('click', () => {
      this.hide();
    });

    // Close on backdrop click
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.hide();
      }
    });

    // Delegated actions inside modal content
    this.contentEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // 0. KPI Card Click (toggle details drawer)
      const kpiCard = target.closest('.arch-kpi-card') as HTMLElement | null;
      if (kpiCard && !target.closest('button')) {
        const kpi = kpiCard.getAttribute('data-kpi') as ArchipelagoKpiKey | null;
        if (kpi) {
          audio.playClickSound();
          this.activeKpiDetail = this.activeKpiDetail === kpi ? null : kpi;
          this.render();
          return;
        }
      }

      // Close KPI drawer button
      const closeDrawerBtn = target.closest('.btn-close-kpi-drawer') as HTMLElement | null;
      if (closeDrawerBtn) {
        audio.playClickSound();
        this.activeKpiDetail = null;
        this.render();
        return;
      }

      // KPI Drawer Action Buttons
      const kpiActionBtn = target.closest('[data-kpi-action]') as HTMLElement | null;
      if (kpiActionBtn) {
        const action = kpiActionBtn.getAttribute('data-kpi-action');
        audio.playClickSound();
        if (action === 'filter-awake') {
          this.currentFilter = 'awake';
          this.render();
        } else if (action === 'filter-sleeping') {
          this.currentFilter = 'sleeping';
          this.render();
        } else if (action === 'filter-ready') {
          this.currentFilter = 'ready';
          this.render();
        } else if (action === 'filter-all') {
          this.currentFilter = 'all';
          this.render();
        } else if (action === 'sort-population') {
          this.currentSort = 'population_desc';
          this.render();
        } else if (action === 'sort-opportunity') {
          this.currentSort = 'opportunity_desc';
          this.render();
        } else if (action === 'filter-region') {
          const region = kpiActionBtn.getAttribute('data-region') || '';
          this.searchQuery = region;
          this.render();
        } else if (action === 'open-fleet') {
          this.hide();
          this.callbacks.onOpenFleet?.();
        }
        return;
      }

      // 1. Focus on map
      const focusBtn = target.closest('.btn-arch-focus') as HTMLElement | null;
      if (focusBtn) {
        const islandId = focusBtn.getAttribute('data-island-id');
        if (islandId) {
          audio.playClickSound();
          this.hide();
          this.callbacks.onFocusIsland(islandId);
        }
        return;
      }

      // 2. Awaken Island
      const awakenBtn = target.closest('.btn-arch-awaken') as HTMLElement | null;
      if (awakenBtn) {
        const islandId = awakenBtn.getAttribute('data-island-id');
        if (islandId) {
          audio.playClickSound();
          this.callbacks.onAwakenIsland(islandId);
          this.render(); // Re-render after state change
        }
        return;
      }

      // 3. Open Economic Report
      const reportBtn = target.closest('.btn-arch-report') as HTMLElement | null;
      if (reportBtn) {
        const islandId = reportBtn.getAttribute('data-island-id');
        if (islandId && this.callbacks.onOpenReport) {
          audio.playClickSound();
          this.hide();
          this.callbacks.onOpenReport(islandId);
        }
        return;
      }

      // 4. Open Commodity Sourcing Modal
      const sourcingBtn = target.closest('.btn-arch-sourcing') as HTMLElement | null;
      if (sourcingBtn) {
        const islandId = sourcingBtn.getAttribute('data-island-id');
        const goodId = sourcingBtn.getAttribute('data-good-id');
        if (islandId && goodId && this.callbacks.onOpenSourcing) {
          audio.playClickSound();
          this.hide();
          this.callbacks.onOpenSourcing(islandId, goodId);
        }
        return;
      }

      // 5. Filter tab click
      const tabBtn = target.closest('.arch-filter-tab') as HTMLElement | null;
      if (tabBtn) {
        const filterVal = tabBtn.getAttribute('data-filter') as ArchipelagoFilterKey | null;
        if (filterVal) {
          audio.playClickSound();
          this.currentFilter = filterVal;
          this.render();
        }
        return;
      }
    });
  }

  public show(filter?: ArchipelagoFilterKey) {
    if (filter) this.currentFilter = filter;
    this.isVisible = true;
    this.modalEl?.classList.remove('closed');
    audio.playClickSound();
    this.render();
  }

  public hide() {
    this.isVisible = false;
    this.modalEl?.classList.add('closed');
    audio.playClickSound();
  }

  public toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public render() {
    if (!this.contentEl) return;

    const summary = getArchipelagoDirectory(this.sim);
    const iconStyle = icons.getStyle();
    const coinIcon = getIconSvg('coin', iconStyle, 13);
    const laurelIcon = getIconSvg('laurel', iconStyle, 13);

    // Max island population for relative population meter bars
    const maxPop = summary.highestPopIsland?.population || 175000;

    // Filter islands
    let filtered = summary.islands.filter((item) => {
      // 1. Status Filter
      if (this.currentFilter === 'awake' && !item.isAwake) return false;
      if (this.currentFilter === 'sleeping' && item.isAwake) return false;
      if (this.currentFilter === 'ready' && !item.canAwakenNow) return false;

      // 2. Search Query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesRegion = item.region.toLowerCase().includes(q);
        const matchesExports = item.topExports.some(
          (e) => e.name.toLowerCase().includes(q) || e.goodId.toLowerCase().includes(q)
        );
        const matchesDemands = item.topDemands.some(
          (d) => d.name.toLowerCase().includes(q) || d.goodId.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesRegion && !matchesExports && !matchesDemands) {
          return false;
        }
      }

      return true;
    });

    // Sort islands
    filtered = this.sortIslands(filtered);

    // Filter pill count badges
    const totalCount = summary.islands.length;
    const awakeCount = summary.awakeCount;
    const sleepingCount = summary.sleepingCount;
    const readyCount = summary.readyToAwakenCount;

    this.contentEl.innerHTML = `
      <!-- KPI Intelligence Ribbon -->
      <div class="arch-kpi-ribbon">
        <div class="arch-kpi-card interactive ${this.activeKpiDetail === 'coverage' ? 'active' : ''}" data-kpi="coverage" title="Click to reveal regional coverage breakdown">
          <div class="arch-kpi-top-row">
            <span class="arch-kpi-label">Archipelago Coverage</span>
            <span class="arch-kpi-expand-indicator">${this.activeKpiDetail === 'coverage' ? '▴ Close' : '▾ Details'}</span>
          </div>
          <div class="arch-kpi-val-row">
            <span class="arch-kpi-val gold">${awakeCount} / ${totalCount}</span>
            <span class="arch-kpi-tag">${Math.round((awakeCount / totalCount) * 100)}% Awakened</span>
          </div>
          <div class="arch-mini-progress">
            <div class="arch-mini-bar" style="width: ${(awakeCount / totalCount) * 100}%;"></div>
          </div>
        </div>

        <div class="arch-kpi-card interactive ${this.activeKpiDetail === 'population' ? 'active' : ''}" data-kpi="population" title="Click to reveal demographic distribution & hubs">
          <div class="arch-kpi-top-row">
            <span class="arch-kpi-label">Population in Daylight</span>
            <span class="arch-kpi-expand-indicator">${this.activeKpiDetail === 'population' ? '▴ Close' : '▾ Details'}</span>
          </div>
          <div class="arch-kpi-val-row">
            <span class="arch-kpi-val cyan">${summary.awakePopulation.toLocaleString()}</span>
            <span class="arch-kpi-tag">${summary.awakePopulationPct}% of Aegean</span>
          </div>
          <div class="arch-mini-progress">
            <div class="arch-mini-bar cyan-bar" style="width: ${summary.awakePopulationPct}%;"></div>
          </div>
        </div>

        <div class="arch-kpi-card interactive ${this.activeKpiDetail === 'ready' ? 'active' : ''}" data-kpi="ready" title="Click to reveal ready ports & fleet utilization audit">
          <div class="arch-kpi-top-row">
            <span class="arch-kpi-label">Ready to Awaken</span>
            <span class="arch-kpi-expand-indicator">${this.activeKpiDetail === 'ready' ? '▴ Close' : '▾ Details'}</span>
          </div>
          <div class="arch-kpi-val-row">
            <span class="arch-kpi-val green">${readyCount} Ports</span>
            <span class="arch-kpi-tag">Connected & Funded</span>
          </div>
          <p class="arch-kpi-sub">${summary.totalUnderutilizedShips > 0 ? `<span style="color:#f87171; font-weight:600;">⚠️ ${summary.totalUnderutilizedShips} underutilized fleet vessel(s)</span>` : '⚓ Fleet operating at peak efficiency'}</p>
        </div>

        <div class="arch-kpi-card highlight interactive ${this.activeKpiDetail === 'prospect' ? 'active' : ''}" data-kpi="prospect" title="Click to reveal top strategic expansion prospects">
          <div class="arch-kpi-top-row">
            <span class="arch-kpi-label">Top Expansion Prospect</span>
            <span class="arch-kpi-expand-indicator">${this.activeKpiDetail === 'prospect' ? '▴ Close' : '▾ Details'}</span>
          </div>
          <div class="arch-kpi-val-row">
            <span class="arch-kpi-val gold">${summary.highestOpportunityIsland?.name || 'N/A'}</span>
            <button class="btn-arch-focus btn-arch-pill-action" data-island-id="${summary.highestOpportunityIsland?.id || ''}" title="Focus on map">📍 Focus</button>
          </div>
          <p class="arch-kpi-sub">${summary.highestOpportunityIsland?.population.toLocaleString()} pop • Score ${summary.highestOpportunityIsland?.economicOpportunityScore}</p>
        </div>
      </div>

      <!-- KPI Detail Drawer -->
      ${this.renderKpiDetailDrawer(summary)}

      <!-- Controls Toolbar: Search, Filters, and Sorting -->
      <div class="arch-toolbar">
        <div class="arch-search-wrapper">
          <span class="arch-search-icon">🔍</span>
          <input
            type="text"
            id="arch-search-input"
            class="arch-search-input"
            placeholder="Search islands, regions, or goods (e.g. Fuel, Wine, Crete, Rhodes)..."
            value="${this.searchQuery}"
          />
          ${this.searchQuery ? `<button id="btn-arch-clear-search" class="arch-clear-btn" title="Clear search">✕</button>` : ''}
        </div>

        <div class="arch-filters-row">
          <div class="arch-filter-tabs">
            <button class="arch-filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
              All (${totalCount})
            </button>
            <button class="arch-filter-tab ${this.currentFilter === 'awake' ? 'active' : ''}" data-filter="awake">
              ☀️ Daylight (${awakeCount})
            </button>
            <button class="arch-filter-tab ${this.currentFilter === 'sleeping' ? 'active' : ''}" data-filter="sleeping">
              🔒 Sleeping (${sleepingCount})
            </button>
            <button class="arch-filter-tab ${this.currentFilter === 'ready' ? 'active' : ''}" data-filter="ready">
              ✨ Ready (${readyCount})
            </button>
          </div>

          <div class="arch-sort-wrapper">
            <label for="arch-sort-select" class="arch-sort-label">Sort:</label>
            <select id="arch-sort-select" class="arch-sort-select">
              <option value="population_desc" ${this.currentSort === 'population_desc' ? 'selected' : ''}>👥 Population (Largest First)</option>
              <option value="opportunity_desc" ${this.currentSort === 'opportunity_desc' ? 'selected' : ''}>💰 Economic Opportunity</option>
              <option value="prosperity_desc" ${this.currentSort === 'prosperity_desc' ? 'selected' : ''}>📈 Prosperity %</option>
              <option value="cost_asc" ${this.currentSort === 'cost_asc' ? 'selected' : ''}>🪙 Awakening Cost (Lowest First)</option>
              <option value="name_asc" ${this.currentSort === 'name_asc' ? 'selected' : ''}>🔤 Name (A - Z)</option>
              <option value="region_asc" ${this.currentSort === 'region_asc' ? 'selected' : ''}>🗺️ Region</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Island Directory List -->
      <div class="arch-list-container">
        ${
          filtered.length === 0
            ? `<div class="arch-empty-state">No archipelago ports match the selected filter or search query.</div>`
            : filtered
                .map((island, idx) => {
                  // 1. Perceptually-scaled population percentage
                  const popPercent = Math.max(
                    6,
                    Math.min(100, Math.round(Math.pow(island.population / maxPop, 0.42) * 100))
                  );

                  // Population tier classification
                  let popTierClass = 'outpost';
                  let popTierLabel = '🏝️ Town Settlement';
                  if (island.population >= 75000) {
                    popTierClass = 'metropolis';
                    popTierLabel = '🏛️ Capital Metropolis';
                  } else if (island.population >= 25000) {
                    popTierClass = 'major';
                    popTierLabel = '⚓ Major Trade Hub';
                  } else if (island.population >= 5000) {
                    popTierClass = 'regional';
                    popTierLabel = '⛵ Regional Port';
                  }

                  // 2. Opportunity score tier classification
                  const oppScore = island.economicOpportunityScore;
                  let oppTierClass = 'frontier';
                  let oppTierLabel = '⚓ Frontier';
                  let oppRatingTag = 'Secondary Trade Link';
                  if (oppScore >= 110) {
                    oppTierClass = 'prime';
                    oppTierLabel = '🔥 Prime Hub';
                    oppRatingTag = 'High-Value Strategic Target';
                  } else if (oppScore >= 85) {
                    oppTierClass = 'high';
                    oppTierLabel = '⚡ Strategic Nexus';
                    oppRatingTag = 'Strong Commercial Potential';
                  } else if (oppScore >= 60) {
                    oppTierClass = 'developing';
                    oppTierLabel = '📈 Emerging Market';
                    oppRatingTag = 'Growing Market Capacity';
                  } else {
                    oppTierClass = 'frontier';
                    oppTierLabel = '⚓ Frontier Outpost';
                    oppRatingTag = 'Niche / Specialized Node';
                  }
                  const oppPercent = Math.max(10, Math.min(100, Math.round((oppScore / 140) * 100)));

                  // 3. Trade totals
                  const totalExportRate = island.topExports.reduce((sum, e) => sum + e.rate, 0);
                  const totalDemandRate = island.topDemands.reduce((sum, d) => sum + d.rate, 0);

                  // Status badge markup
                  let statusBadge = '';
                  if (island.isAwake) {
                    const statusClass = island.status;
                    const label =
                      island.status === 'booming'
                        ? '☀️ Booming'
                        : island.status === 'distressed'
                        ? '⚠️ Distressed'
                        : island.status === 'stable'
                        ? '☀️ Connected'
                        : '⚠️ Struggling';
                    statusBadge = `<span class="arch-status-badge ${statusClass}">${label} • ${island.prosperityPct}%</span>`;
                  } else if (island.canAwakenNow) {
                    statusBadge = `<span class="arch-status-badge ready">✨ Ready to Awaken</span>`;
                  } else if (island.hasMaritimeConnection) {
                    statusBadge = `<span class="arch-status-badge sleeping">🔒 Needs 🪙 ${island.unlockCost}</span>`;
                  } else {
                    const missing = island.missingConnections
                      .map((c) => this.sim.islandsData.get(c)?.name || c)
                      .join('/');
                    statusBadge = `<span class="arch-status-badge blocked">⚠️ Needs ${missing}</span>`;
                  }

                  // Top exports stream items
                  const exportsItemsHtml =
                    island.topExports.length > 0
                      ? island.topExports
                          .slice(0, 3)
                          .map((exp) => {
                            const goodIcon = getGoodIconSvg(exp.goodId, iconStyle, 16);
                            const fillPct = Math.min(100, Math.max(15, Math.round((exp.rate / 20) * 100)));
                            return `
                              <div class="stream-good-row export-good" title="Produces ${exp.name} (+${exp.rate}/d) • Wholesale: 🪙 ${exp.buyPrice}">
                                <span class="stream-icon-cell">${goodIcon}</span>
                                <div class="stream-info-cell">
                                  <div class="stream-name-val">
                                    <span class="good-title">${exp.name}</span>
                                    <strong class="good-val export">+${exp.rate}/d</strong>
                                  </div>
                                  <div class="stream-bar-bg">
                                    <div class="stream-bar-fill export" style="width: ${fillPct}%;"></div>
                                  </div>
                                </div>
                                <span class="stream-price-tag">🪙 ${exp.buyPrice}</span>
                              </div>
                            `;
                          })
                          .join('')
                      : `<div class="stream-empty-note">No local production</div>`;

                  // Top demands stream items
                  const demandsItemsHtml =
                    island.topDemands.length > 0
                      ? island.topDemands
                          .slice(0, 3)
                          .map((imp) => {
                            const goodIcon = getGoodIconSvg(imp.goodId, iconStyle, 16);
                            const fillPct = Math.min(100, Math.max(15, Math.round((imp.rate / 15) * 100)));
                            return `
                              <div class="stream-good-row demand-good ${imp.isStarving ? 'starving-good' : ''}" title="Consumes ${imp.name} (-${imp.rate}/d)${imp.isStarving ? ' - Starving!' : ''}">
                                <span class="stream-icon-cell">${goodIcon}</span>
                                <div class="stream-info-cell">
                                  <div class="stream-name-val">
                                    <span class="good-title">${imp.name}</span>
                                    <strong class="good-val demand">-${imp.rate}/d</strong>
                                  </div>
                                  <div class="stream-bar-bg">
                                    <div class="stream-bar-fill demand ${imp.isStarving ? 'starving' : ''}" style="width: ${fillPct}%;"></div>
                                  </div>
                                </div>
                                ${imp.isStarving ? '<span class="starving-tag">🚨 Deficit</span>' : '<span class="demand-tag">Demand</span>'}
                              </div>
                            `;
                          })
                          .join('')
                      : `<div class="stream-empty-note">Self-sufficient</div>`;

                  // Awakening cost chip
                  const costChip = !island.isAwake
                    ? `
                      <span class="arch-cost-chip ${island.canAwakenNow ? 'affordable' : ''}">
                        <span class="coin-icon">${coinIcon}</span> ${island.unlockCost} • <span class="chip-icon">${laurelIcon}</span> ${island.unlockTp} TP
                      </span>`
                    : '';

                  // Harbor fleet berth status
                  const isBerthFull = island.berthsUsed >= island.berthsMax;

                  // Underutilized vessels chip
                  const underutilizedChip = island.underutilizedShipsCount > 0
                    ? `<span class="arch-underutilized-chip" data-island-id="${island.id}" data-tooltip-type="vessel-alert" data-tooltip-title="Harbor Logistics • ${island.name}" data-tooltip-body="${island.underutilizedShipsCount} vessel(s) stationed or docked at this harbor are currently underutilized (idle in port, empty ballast, or low cargo fill)." data-tooltip-rec="Open Fleet Management or awaken trade routes to optimize vessel revenue." data-tooltip-badge="${island.underutilizedShipsCount} Alerts" data-tooltip-severity="medium" data-tooltip-hint="Click to open Fleet Management Roster">⚠️ ${island.underutilizedShipsCount} Underutilized</span>`
                    : '';

                  // Action buttons
                  const canAwaken = island.canAwakenNow;
                  const awakenBtn = canAwaken
                    ? `<button class="btn-arch-awaken btn-primary" data-island-id="${island.id}" title="Awaken this island now!">Awaken Port</button>`
                    : '';

                  const reportBtn = island.isAwake
                    ? `<button class="btn-arch-report btn-secondary" data-island-id="${island.id}" title="View Economic Advisory Report">📊 Report</button>`
                    : '';

                  const primaryGood = island.topDemands[0]?.goodId || island.topExports[0]?.goodId || 'fuel';
                  const sourcingBtn = `
                    <button class="btn-arch-sourcing btn-secondary" data-island-id="${island.id}" data-good-id="${primaryGood}" title="Analyze sourcing for ${formatGoodName(primaryGood)}">
                      🔍 Logistics
                    </button>
                  `;

                  return `
                    <div class="arch-island-card ${island.isAwake ? 'awake' : 'sleeping'} ${island.canAwakenNow ? 'ready-card' : ''}">
                      <!-- Top Bar: Rank, Identity, Badges & Actions -->
                      <div class="arch-card-topbar">
                        <div class="arch-topbar-left">
                          <span class="arch-rank-badge ${island.isAwake ? 'awake' : ''}">#${idx + 1}</span>
                          <div class="arch-identity-block">
                            <div class="arch-name-line">
                              <h4 class="arch-island-title">${island.name} Port</h4>
                              ${statusBadge}
                              ${costChip}
                            </div>
                            <span class="arch-island-region">📍 ${island.region.toUpperCase()} • ${island.type === 'mainland_port' ? 'Mainland Port' : 'Island'}</span>
                          </div>
                        </div>

                        <div class="arch-topbar-right">
                          <div class="arch-topbar-actions">
                            <button class="btn-arch-focus btn-primary-glass" data-island-id="${island.id}" title="Focus 3D camera on ${island.name}">
                              📍 View on Map
                            </button>
                            ${awakenBtn}
                            ${reportBtn}
                            ${sourcingBtn}
                          </div>
                        </div>
                      </div>

                      <!-- Graphical Dashboard: 3 Insight Widgets -->
                      <div class="arch-card-dashboard">
                        <!-- Widget 1: Demographics & Harbor Scale -->
                        <div class="arch-widget widget-demographics">
                          <div class="widget-header">
                            <span class="widget-title">👥 Demographics & Harbor</span>
                            <span class="pop-tier-badge ${popTierClass}">${popTierLabel}</span>
                          </div>
                          <div class="widget-stat-main">
                            <span class="stat-number">${island.population.toLocaleString()}</span>
                            <span class="stat-unit">citizens</span>
                          </div>
                          <div class="widget-meter-group">
                            <div class="widget-meter-labels">
                              <span class="meter-lbl">Comparative Scale</span>
                              <span class="meter-pct">${popPercent}%</span>
                            </div>
                            <div class="widget-meter-track">
                              <div class="widget-meter-fill pop-gradient" style="width: ${popPercent}%;"></div>
                            </div>
                          </div>
                          <div class="widget-harbor-footer">
                            <div class="harbor-sub-row">
                              <span>⚓ Fleet Berths</span>
                              ${
                                island.isAwake
                                  ? `<strong class="${isBerthFull ? 'text-red' : 'text-cyan'}">${island.berthsUsed} / ${island.berthsMax} Occupied</strong>`
                                  : `<span class="text-muted">${island.berthsMax} Berths (Upon Awakening)</span>`
                              }
                            </div>
                            ${
                              island.isAwake
                                ? `<div class="widget-meter-track mini">
                                     <div class="widget-meter-fill berth-gradient ${isBerthFull ? 'full' : ''}" style="width: ${Math.round((island.berthsUsed / Math.max(1, island.berthsMax)) * 100)}%;"></div>
                                   </div>`
                                : ''
                            }
                            ${underutilizedChip ? `<div class="underutilized-warning-row">${underutilizedChip}</div>` : ''}
                          </div>
                        </div>

                        <!-- Widget 2: Strategic Potential & Score Gauge -->
                        <div class="arch-widget widget-opportunity">
                          <div class="widget-header">
                            <span class="widget-title">⚡ Strategic Potential</span>
                            <span class="opp-tier-badge ${oppTierClass}">${oppTierLabel}</span>
                          </div>
                          <div class="opp-score-display">
                            <div class="opp-score-badge ${oppTierClass}">
                              <span class="score-digit">${oppScore}</span>
                              <span class="score-denominator">SCORE</span>
                            </div>
                            <div class="opp-meter-column">
                              <div class="widget-meter-labels">
                                <span class="meter-lbl">${oppRatingTag}</span>
                                <span class="meter-pct">${oppPercent}%</span>
                              </div>
                              <div class="widget-meter-track opp">
                                <div class="widget-meter-fill opp-gradient ${oppTierClass}" style="width: ${oppPercent}%;"></div>
                              </div>
                            </div>
                          </div>
                          <p class="opp-summary-desc">${island.opportunitySummary}</p>
                        </div>

                        <!-- Widget 3: Dual-Stream Trade Matrix -->
                        <div class="arch-widget widget-trade">
                          <div class="widget-header">
                            <span class="widget-title">📊 Trade Profile & Lifelines</span>
                            <span class="trade-stream-summary">${island.topExports.length} Produces • ${island.topDemands.length} Demands</span>
                          </div>
                          <div class="trade-streams-grid">
                            <!-- Stream 1: Exports (Production) -->
                            <div class="trade-stream-box export-stream">
                              <div class="stream-title-row export">
                                <span class="stream-dot export"></span>
                                <span class="stream-header-text">PRODUCES (+${totalExportRate}/d)</span>
                              </div>
                              <div class="stream-items-list">
                                ${exportsItemsHtml}
                              </div>
                            </div>

                            <!-- Stream 2: Demands (Consumption) -->
                            <div class="trade-stream-box demand-stream">
                              <div class="stream-title-row demand">
                                <span class="stream-dot demand"></span>
                                <span class="stream-header-text">CONSUMES (-${totalDemandRate}/d)</span>
                              </div>
                              <div class="stream-items-list">
                                ${demandsItemsHtml}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    `;

    // Rebind controls
    this.searchInput = document.getElementById('arch-search-input') as HTMLInputElement | null;
    this.sortSelect = document.getElementById('arch-sort-select') as HTMLSelectElement | null;

    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
      // Keep search focused
      const newInput = document.getElementById('arch-search-input') as HTMLInputElement | null;
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
      }
    });

    document.getElementById('btn-arch-clear-search')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
    });

    this.sortSelect?.addEventListener('change', (e) => {
      this.currentSort = (e.target as HTMLSelectElement).value as ArchipelagoSortKey;
      audio.playClickSound();
      this.render();
    });
  }

  private sortIslands(islands: ArchipelagoIslandEntry[]): ArchipelagoIslandEntry[] {
    const list = [...islands];
    switch (this.currentSort) {
      case 'population_desc':
        return list.sort((a, b) => b.population - a.population);
      case 'opportunity_desc':
        return list.sort((a, b) => b.economicOpportunityScore - a.economicOpportunityScore);
      case 'prosperity_desc':
        return list.sort((a, b) => b.prosperityPct - a.prosperityPct);
      case 'cost_asc':
        return list.sort((a, b) => a.unlockCost - b.unlockCost);
      case 'name_asc':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'region_asc':
        return list.sort((a, b) => a.region.localeCompare(b.region) || b.population - a.population);
      default:
        return list;
    }
  }

  private renderKpiDetailDrawer(summary: any): string {
    if (!this.activeKpiDetail) return '';

    if (this.activeKpiDetail === 'coverage') {
      const regionMap = new Map<string, { total: number; awake: number; population: number }>();
      for (const isl of summary.islands) {
        const reg = isl.region || 'Aegean';
        const cur = regionMap.get(reg) || { total: 0, awake: 0, population: 0 };
        cur.total++;
        if (isl.isAwake) cur.awake++;
        cur.population += isl.population;
        regionMap.set(reg, cur);
      }
      const regions = Array.from(regionMap.entries())
        .map(([name, data]) => ({
          name,
          total: data.total,
          awake: data.awake,
          population: data.population,
          pct: Math.round((data.awake / data.total) * 100),
        }))
        .sort((a, b) => b.total - a.total);

      return `
        <div class="arch-kpi-drawer kpi-drawer-coverage">
          <div class="arch-kpi-drawer-header">
            <div class="arch-kpi-drawer-title-group">
              <h4 class="arch-kpi-drawer-title">🗺️ Archipelago Regional Coverage & Discovery Audit</h4>
              <p class="arch-kpi-drawer-subtitle">
                ${summary.awakeCount} of ${summary.totalIslands} islands awakened (${Math.round((summary.awakeCount / summary.totalIslands) * 100)}%). Click any region below to filter the directory.
              </p>
            </div>
            <div class="arch-kpi-drawer-actions">
              <button class="btn-arch-drawer-action" data-kpi-action="filter-awake">☀️ View ${summary.awakeCount} Awakened</button>
              <button class="btn-arch-drawer-action" data-kpi-action="filter-sleeping">🔒 View ${summary.sleepingCount} Sleeping</button>
              <button class="btn-arch-drawer-action" data-kpi-action="filter-all">🗺️ View All (${summary.totalIslands})</button>
              <button class="btn-close-kpi-drawer" title="Close details">✕</button>
            </div>
          </div>

          <div class="arch-regions-grid">
            ${regions.map(r => `
              <div class="arch-region-card ${r.awake === r.total ? 'complete' : ''}" data-kpi-action="filter-region" data-region="${r.name}" title="Click to filter by ${r.name}">
                <div class="arch-region-header">
                  <span class="arch-region-name">${r.name}</span>
                  <span class="arch-region-badge ${r.awake === r.total ? 'gold' : ''}">${r.awake} / ${r.total}</span>
                </div>
                <div class="arch-mini-progress">
                  <div class="arch-mini-bar ${r.awake === r.total ? 'cyan-bar' : ''}" style="width: ${r.pct}%;"></div>
                </div>
                <div class="arch-region-footer">
                  <span>👥 ${r.population.toLocaleString()} pop</span>
                  <span>${r.pct}% Awakened</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.activeKpiDetail === 'population') {
      const topAwakePop = summary.islands
        .filter((i: any) => i.isAwake)
        .sort((a: any, b: any) => b.population - a.population)
        .slice(0, 5);

      const topSleepingPop = summary.islands
        .filter((i: any) => !i.isAwake)
        .sort((a: any, b: any) => b.population - a.population)
        .slice(0, 5);

      return `
        <div class="arch-kpi-drawer kpi-drawer-population">
          <div class="arch-kpi-drawer-header">
            <div class="arch-kpi-drawer-title-group">
              <h4 class="arch-kpi-drawer-title">👥 Aegean Demographic Reach & Consumer Capacity</h4>
              <p class="arch-kpi-drawer-subtitle">
                ${summary.awakePopulation.toLocaleString()} citizens active in your trade network (${summary.awakePopulationPct}% of the Aegean population).
              </p>
            </div>
            <div class="arch-kpi-drawer-actions">
              <button class="btn-arch-drawer-action primary" data-kpi-action="sort-population">👥 Sort by Population (Highest First)</button>
              <button class="btn-arch-drawer-action" data-kpi-action="filter-awake">☀️ Daylight Hubs Only</button>
              <button class="btn-close-kpi-drawer" title="Close details">✕</button>
            </div>
          </div>

          <div class="arch-demographics-grid">
            <div class="arch-demo-stat-card">
              <span class="arch-demo-stat-label">Total Aegean Population</span>
              <span class="arch-demo-stat-val">${summary.totalPopulation.toLocaleString()}</span>
              <span class="arch-demo-stat-hint">Across all 63 maritime nodes</span>
            </div>
            <div class="arch-demo-stat-card">
              <span class="arch-demo-stat-label">Daylight Consumer Market</span>
              <span class="arch-demo-stat-val cyan">${summary.awakePopulation.toLocaleString()}</span>
              <span class="arch-demo-stat-hint">${summary.awakePopulationPct}% consuming daily imports</span>
            </div>
            <div class="arch-demo-stat-card">
              <span class="arch-demo-stat-label">Untapped Sleeping Population</span>
              <span class="arch-demo-stat-val gold">${(summary.totalPopulation - summary.awakePopulation).toLocaleString()}</span>
              <span class="arch-demo-stat-hint">${(100 - summary.awakePopulationPct).toFixed(1)}% waiting to join network</span>
            </div>
            <div class="arch-demo-stat-card">
              <span class="arch-demo-stat-label">Average Port Population</span>
              <span class="arch-demo-stat-val">${Math.round(summary.totalPopulation / summary.totalIslands).toLocaleString()}</span>
              <span class="arch-demo-stat-hint">Per archipelago settlement</span>
            </div>
          </div>

          <div class="arch-top-pop-columns">
            <div class="arch-pop-column">
              <h5 class="arch-column-title">☀️ Top 5 Populated Daylight Ports</h5>
              <div class="arch-mini-list">
                ${topAwakePop.map((isl: any) => `
                  <div class="arch-mini-row">
                    <div class="arch-mini-info">
                      <span class="arch-mini-name">${isl.name}</span>
                      <span class="arch-mini-sub">${isl.region} • ${isl.prosperityPct}% Prosperity</span>
                    </div>
                    <div class="arch-mini-right">
                      <span class="arch-mini-val">👥 ${isl.population.toLocaleString()}</span>
                      <button class="btn-arch-focus btn-arch-pill-action" data-island-id="${isl.id}">📍 Focus</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="arch-pop-column">
              <h5 class="arch-column-title">🔒 Top 5 Untapped Sleeping Markets</h5>
              <div class="arch-mini-list">
                ${topSleepingPop.map((isl: any) => `
                  <div class="arch-mini-row">
                    <div class="arch-mini-info">
                      <span class="arch-mini-name">${isl.name}</span>
                      <span class="arch-mini-sub">${isl.region} • 🪙 ${isl.unlockCost.toLocaleString()} to awaken</span>
                    </div>
                    <div class="arch-mini-right">
                      <span class="arch-mini-val gold">👥 ${isl.population.toLocaleString()}</span>
                      ${isl.canAwakenNow ? `<button class="btn-arch-awaken btn-arch-pill-action green" data-island-id="${isl.id}">✨ Awaken</button>` : `<button class="btn-arch-focus btn-arch-pill-action" data-island-id="${isl.id}">📍 Focus</button>`}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeKpiDetail === 'ready') {
      const readyIslands = summary.islands
        .filter((i: any) => i.canAwakenNow)
        .sort((a: any, b: any) => b.economicOpportunityScore - a.economicOpportunityScore);

      const totalReadyCost = readyIslands.reduce((sum: number, i: any) => sum + i.unlockCost, 0);

      const underutilizedShips = this.sim.getUnderutilizedShips ? this.sim.getUnderutilizedShips() : [];
      let emptyBallastCount = 0;
      let idleShipsCount = 0;
      let underfilledCount = 0;
      for (const u of underutilizedShips) {
        if (u.reason === 'empty_hold') emptyBallastCount++;
        else if (u.reason === 'idle_in_port') idleShipsCount++;
        else underfilledCount++;
      }
      const activeHaulersCount = Math.max(0, (this.sim.shipManager?.ships.size || 0) - underutilizedShips.length);

      return `
        <div class="arch-kpi-drawer kpi-drawer-ready">
          <div class="arch-kpi-drawer-header">
            <div class="arch-kpi-drawer-title-group">
              <h4 class="arch-kpi-drawer-title">✨ Expansion Readiness & Fleet Logistics Efficiency</h4>
              <p class="arch-kpi-drawer-subtitle">
                ${summary.readyToAwakenCount} connected ports ready for immediate awakening • ${summary.totalUnderutilizedShips} fleet vessels needing route optimization.
              </p>
            </div>
            <div class="arch-kpi-drawer-actions">
              <button class="btn-arch-drawer-action primary" data-kpi-action="filter-ready">✨ Filter Directory to Ready Ports (${summary.readyToAwakenCount})</button>
              <button class="btn-arch-drawer-action" data-kpi-action="open-fleet">🚢 Open Fleet Management Panel</button>
              <button class="btn-close-kpi-drawer" title="Close details">✕</button>
            </div>
          </div>

          <div class="arch-top-pop-columns">
            <div class="arch-pop-column">
              <div class="arch-column-header-row">
                <h5 class="arch-column-title">✨ Ready to Awaken Ports (${readyIslands.length})</h5>
                <span class="arch-cost-badge">Total: 🪙 ${totalReadyCost.toLocaleString()}</span>
              </div>
              <div class="arch-mini-list scrollable">
                ${readyIslands.length === 0 ? `<div class="arch-empty-hint">No connected sleeping ports currently funded. Expand maritime lanes or accumulate treasury!</div>` :
                  readyIslands.map((isl: any) => `
                    <div class="arch-mini-row">
                      <div class="arch-mini-info">
                        <span class="arch-mini-name">${isl.name}</span>
                        <span class="arch-mini-sub">${isl.region} • 👥 ${isl.population.toLocaleString()} pop • Score ${isl.economicOpportunityScore}</span>
                      </div>
                      <div class="arch-mini-right">
                        <span class="arch-mini-val green">🪙 ${isl.unlockCost.toLocaleString()}</span>
                        <button class="btn-arch-awaken btn-arch-pill-action green" data-island-id="${isl.id}">✨ Awaken</button>
                        <button class="btn-arch-focus btn-arch-pill-action" data-island-id="${isl.id}">📍 Focus</button>
                      </div>
                    </div>
                  `).join('')
                }
              </div>
            </div>

            <div class="arch-pop-column">
              <h5 class="arch-column-title">🚢 Fleet Operations & Vessel Utilization</h5>
              <div class="arch-fleet-audit-card">
                ${summary.totalUnderutilizedShips > 0 ? `
                  <div class="arch-fleet-warning-banner">
                    <span class="arch-fleet-warning-icon">⚠️</span>
                    <div class="arch-fleet-warning-text">
                      <strong>${summary.totalUnderutilizedShips} vessel(s) running underutilized</strong>
                      <p>These vessels are sailing empty in ballast (0 cargo) or waiting in harbor berths without profitable trade routes.</p>
                    </div>
                  </div>
                  <div class="arch-fleet-audit-stats">
                    <div class="arch-mini-stat">
                      <span class="arch-mini-stat-label">Empty Ballast / Unladen</span>
                      <span class="arch-mini-stat-val coral">${emptyBallastCount} ships</span>
                    </div>
                    <div class="arch-mini-stat">
                      <span class="arch-mini-stat-label">Berthed / Idle</span>
                      <span class="arch-mini-stat-val amber">${idleShipsCount} ships</span>
                    </div>
                    <div class="arch-mini-stat">
                      <span class="arch-mini-stat-label">Active Cargo Haulers</span>
                      <span class="arch-mini-stat-val green">${activeHaulersCount} ships</span>
                    </div>
                  </div>
                  <button class="btn-arch-cta-fleet" data-kpi-action="open-fleet">
                    🚢 Open Fleet Panel to Re-Route & Optimize Vessels
                  </button>
                ` : `
                  <div class="arch-fleet-ok-banner">
                    <span class="arch-fleet-ok-icon">⚓</span>
                    <div class="arch-fleet-ok-text">
                      <strong>Peak Maritime Efficiency</strong>
                      <p>All fleet vessels are actively hauling commodities across your unlocked trade lanes with balanced cargo payloads.</p>
                    </div>
                  </div>
                  <button class="btn-arch-cta-fleet" data-kpi-action="open-fleet">
                    🚢 View Active Fleet (${this.sim.shipManager?.ships.size || 0} Vessels)
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeKpiDetail === 'prospect') {
      const top5Opportunities = summary.islands
        .filter((i: any) => !i.isAwake)
        .sort((a: any, b: any) => b.economicOpportunityScore - a.economicOpportunityScore)
        .slice(0, 6);

      return `
        <div class="arch-kpi-drawer kpi-drawer-prospect">
          <div class="arch-kpi-drawer-header">
            <div class="arch-kpi-drawer-title-group">
              <h4 class="arch-kpi-drawer-title">💰 Economic Opportunity Radar (Top Strategic Expansions)</h4>
              <p class="arch-kpi-drawer-subtitle">
                Algorithmically ranked by population, export capacity, high-value consumer demand, and trade arbitrage yield.
              </p>
            </div>
            <div class="arch-kpi-drawer-actions">
              <button class="btn-arch-drawer-action primary" data-kpi-action="sort-opportunity">💰 Sort Directory by Opportunity</button>
              <button class="btn-close-kpi-drawer" title="Close details">✕</button>
            </div>
          </div>

          <div class="arch-prospects-grid">
            ${top5Opportunities.map((isl: any, idx: number) => `
              <div class="arch-prospect-card ${idx === 0 ? 'top-rank' : ''}">
                <div class="arch-prospect-header">
                  <div class="arch-prospect-rank">#${idx + 1}</div>
                  <div class="arch-prospect-titles">
                    <span class="arch-prospect-name">${isl.name}</span>
                    <span class="arch-prospect-region">${isl.region} • Tier ${isl.tier} Port</span>
                  </div>
                  <div class="arch-prospect-score-badge">
                    <span class="score-label">Opportunity</span>
                    <span class="score-val">${isl.economicOpportunityScore}</span>
                  </div>
                </div>

                <p class="arch-prospect-summary">${isl.opportunitySummary}</p>

                <div class="arch-prospect-pills">
                  <div class="arch-prospect-pill-group">
                    <span class="pill-group-label">Top Exports:</span>
                    ${isl.topExports.slice(0, 2).map((e: any) => `<span class="arch-tag export">${e.name} (+${e.rate}/d)</span>`).join('') || '<span class="arch-tag muted">None</span>'}
                  </div>
                  <div class="arch-prospect-pill-group">
                    <span class="pill-group-label">Urgent Demands:</span>
                    ${isl.topDemands.slice(0, 2).map((d: any) => `<span class="arch-tag demand">${d.name} (-${d.rate}/d)</span>`).join('') || '<span class="arch-tag muted">None</span>'}
                  </div>
                </div>

                <div class="arch-prospect-footer">
                  <span class="arch-prospect-cost">
                    ${isl.isAwake ? '☀️ Already Awakened' : isl.canAwakenNow ? `<span style="color:#4ade80;">✨ Ready (🪙 ${isl.unlockCost.toLocaleString()})</span>` : isl.hasMaritimeConnection ? `🔒 Needs 🪙 ${isl.unlockCost.toLocaleString()}` : `⚠️ Needs ${isl.missingConnections.join('/')}`}
                  </span>
                  <div class="arch-prospect-actions">
                    ${isl.canAwakenNow ? `<button class="btn-arch-awaken btn-arch-pill-action green" data-island-id="${isl.id}">✨ Awaken</button>` : ''}
                    <button class="btn-arch-focus btn-arch-pill-action" data-island-id="${isl.id}">📍 Focus</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return '';
  }
}
