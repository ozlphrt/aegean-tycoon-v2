import type { SimulationCore } from '../sim/simulation';
import { toSingleWordShipName, evaluateShipUtilization, type ShipInstance } from '../sim/shipSim';
import { icons, getIconSvg, getGoodIconSvg, getShipTierIconSvg } from './Icons';
import { audio } from '../audio/AudioManager';
import { confirmModal } from './ConfirmModal';

export interface FleetPanelCallbacks {
  onSelectShip: (shipId: string) => void;
  onFollowShip: (shipId: string) => void;
  onNotification?: (badge: string, text: string) => void;
  onDecommissionShip?: (shipId: string) => void;
}

export class FleetPanel {
  private modalEl: HTMLElement | null = null;
  private tableBodyEl: HTMLElement | null = null;
  private subtitleEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private tierFilter: HTMLSelectElement | null = null;
  private portFilter: HTMLSelectElement | null = null;
  private stateFilter: HTMLSelectElement | null = null;
  private sortSelect: HTMLSelectElement | null = null;
  private tabRosterBtn: HTMLElement | null = null;
  private tabGuideBtn: HTMLElement | null = null;
  private rosterViewEl: HTMLElement | null = null;
  private guideViewEl: HTMLElement | null = null;
  private activeTab: 'roster' | 'guide' = 'roster';

  private isVisible = false;
  private lastRenderTime = 0;
  private renderThrottleMs = 600; // Refresh table data without stealing focus

  constructor(
    private sim: SimulationCore,
    private callbacks: FleetPanelCallbacks
  ) {
    this.initDOM();
  }

  private initDOM() {
    this.modalEl = document.getElementById('fleet-modal');
    this.tableBodyEl = document.getElementById('fleet-table-body');
    this.subtitleEl = document.getElementById('fleet-modal-subtitle');
    this.emptyStateEl = document.getElementById('fleet-empty-state');
    this.searchInput = document.getElementById('fleet-search-input') as HTMLInputElement | null;
    this.tierFilter = document.getElementById('fleet-filter-tier') as HTMLSelectElement | null;
    this.portFilter = document.getElementById('fleet-filter-port') as HTMLSelectElement | null;
    this.stateFilter = document.getElementById('fleet-filter-state') as HTMLSelectElement | null;
    this.sortSelect = document.getElementById('fleet-sort-by') as HTMLSelectElement | null;
    this.tabRosterBtn = document.getElementById('tab-fleet-roster');
    this.tabGuideBtn = document.getElementById('tab-fleet-guide');
    this.rosterViewEl = document.getElementById('fleet-roster-view');
    this.guideViewEl = document.getElementById('fleet-guide-view');

    this.tabRosterBtn?.addEventListener('click', () => {
      this.switchTab('roster');
    });
    this.tabGuideBtn?.addEventListener('click', () => {
      this.switchTab('guide');
    });

    // Close button
    document.getElementById('btn-close-fleet')?.addEventListener('click', () => {
      this.hide();
    });

    // Close on overlay backdrop click
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.hide();
      }
    });

    // Filter and search listeners
    const handleFilterChange = () => {
      this.renderTable();
    };

    this.searchInput?.addEventListener('input', handleFilterChange);
    this.tierFilter?.addEventListener('change', handleFilterChange);
    this.portFilter?.addEventListener('change', handleFilterChange);
    this.stateFilter?.addEventListener('change', handleFilterChange);
    this.sortSelect?.addEventListener('change', handleFilterChange);

    // Event delegation on table body
    this.tableBodyEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Track / Follow button
      const followBtn = target.closest('.btn-fleet-track') as HTMLElement | null;
      if (followBtn) {
        const shipId = followBtn.getAttribute('data-ship-id');
        if (shipId) {
          audio.playClickSound();
          this.hide();
          this.callbacks.onSelectShip(shipId);
          this.callbacks.onFollowShip(shipId);
        }
        return;
      }

      // Decommission / Scrap button
      const decommBtn = target.closest('.btn-fleet-decommission') as HTMLElement | null;
      if (decommBtn) {
        const shipId = decommBtn.getAttribute('data-ship-id');
        if (shipId && this.sim.shipManager) {
          const ship = this.sim.shipManager.ships.get(shipId);
          if (ship) {
            const refund = this.sim.getShipDecommissionRefund(shipId);
            const homeName = this.sim.islandsData.get(ship.homeIslandId)?.name || 'Harbor';
            confirmModal.confirmDecommissionShip(ship.name, homeName, refund).then((confirmed) => {
              if (confirmed) {
                const res = this.sim.decommissionShip(shipId);
                if (res.success) {
                  audio.playCoinSound();
                  this.callbacks.onNotification?.(
                    'VESSEL SCRAPPED',
                    `<strong>${res.shipName}</strong> decommissioned at ${homeName}. Reclaimed 1 harbor berth (+🪙 ${res.refund.toLocaleString()} drachmas salvage).`
                  );
                  this.callbacks.onDecommissionShip?.(shipId);
                  this.render();
                }
              }
            });
          }
        }
        return;
      }

      // Locate row click (open inspector directly)
      const row = target.closest('tr');
      if (row && !target.closest('select') && !target.closest('button')) {
        const shipId = row.getAttribute('data-ship-id');
        if (shipId) {
          audio.playClickSound();
          this.callbacks.onSelectShip(shipId);
        }
      }
    });

    // Change home port or cargo priority delegation
    this.tableBodyEl?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;

      // Reassign home port
      if (target.classList.contains('fleet-home-select')) {
        const shipId = target.getAttribute('data-ship-id');
        const newHomeId = target.value;
        if (shipId && this.sim.shipManager) {
          const ship = this.sim.shipManager.ships.get(shipId);
          if (ship && newHomeId) {
            ship.homeIslandId = newHomeId;
            audio.playDockSound();
            const homeName = this.sim.islandsData.get(newHomeId)?.name || 'Port';
            this.callbacks.onNotification?.('HOME PORT', `Reassigned ${ship.name} home port to ${homeName}.`);
            this.renderHeaderSummary();
          }
        }
        return;
      }

      // Reassign cargo priority
      if (target.classList.contains('fleet-priority-select')) {
        const shipId = target.getAttribute('data-ship-id');
        const newPriority = target.value;
        if (shipId && this.sim.shipManager) {
          const ship = this.sim.shipManager.ships.get(shipId);
          if (ship) {
            ship.cargoPriority = newPriority;
            audio.playClickSound();
          }
        }
      }
    });
  }

  public switchTab(tab: 'roster' | 'guide') {
    this.activeTab = tab;
    audio.playClickSound();

    if (tab === 'roster') {
      this.tabRosterBtn?.classList.add('active');
      this.tabRosterBtn?.setAttribute('aria-selected', 'true');
      this.tabGuideBtn?.classList.remove('active');
      this.tabGuideBtn?.setAttribute('aria-selected', 'false');

      if (this.rosterViewEl) this.rosterViewEl.style.display = 'flex';
      if (this.guideViewEl) this.guideViewEl.style.display = 'none';
      this.renderTable();
    } else {
      this.tabGuideBtn?.classList.add('active');
      this.tabGuideBtn?.setAttribute('aria-selected', 'true');
      this.tabRosterBtn?.classList.remove('active');
      this.tabRosterBtn?.setAttribute('aria-selected', 'false');

      if (this.rosterViewEl) this.rosterViewEl.style.display = 'none';
      if (this.guideViewEl) this.guideViewEl.style.display = 'block';
    }
  }

  public show(tab: 'roster' | 'guide' = 'roster') {
    if (!this.modalEl) return;
    this.isVisible = true;
    this.modalEl.classList.remove('closed');
    this.populatePortFilter();
    this.renderHeaderSummary();
    this.switchTab(tab);
  }

  public showForPort(portId: string) {
    this.show('roster');
    if (this.portFilter) {
      this.portFilter.value = portId;
      this.render();
    }
  }

  public hide() {
    if (!this.modalEl) return;
    this.isVisible = false;
    this.modalEl.classList.add('closed');
  }

  public toggle(tab: 'roster' | 'guide' = 'roster') {
    if (this.isVisible) {
      if (this.activeTab !== tab) {
        this.switchTab(tab);
      } else {
        this.hide();
      }
    } else {
      this.show(tab);
    }
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public render() {
    this.renderHeaderSummary();
    this.renderTable();
  }

  public update(now: number) {
    if (!this.isVisible) return;
    if (now - this.lastRenderTime >= this.renderThrottleMs) {
      this.lastRenderTime = now;
      this.renderHeaderSummary();
      this.refreshRowDynamicData();
    }
  }

  private populatePortFilter() {
    if (!this.portFilter) return;
    const currentVal = this.portFilter.value;

    const unlocked = Array.from(this.sim.unlockedIslands)
      .map((id) => this.sim.islandsData.get(id))
      .filter((isl): isl is NonNullable<typeof isl> => !!isl)
      .sort((a, b) => a.name.localeCompare(b.name));

    let html = `<option value="all">All Home Ports</option>`;
    for (const isl of unlocked) {
      html += `<option value="${isl.id}">${isl.name}</option>`;
    }
    this.portFilter.innerHTML = html;
    if (currentVal && Array.from(this.portFilter.options).some((o) => o.value === currentVal)) {
      this.portFilter.value = currentVal;
    }
  }

  private renderHeaderSummary() {
    if (!this.subtitleEl || !this.sim.shipManager) return;
    const ships = Array.from(this.sim.shipManager.ships.values());
    const totalShips = ships.length;
    const totalUpkeep = ships.reduce((sum, s) => sum + s.upkeepPerDay, 0);
    const totalProfit = ships.reduce((sum, s) => sum + s.totalProfit, 0);
    const underutilizedCount = this.sim.getUnderutilizedShips().length;
    const underutilizedTag =
      underutilizedCount > 0
        ? ` • <span style="color:#f87171;font-weight:700;">⚠️ ${underutilizedCount} Underutilized</span>`
        : '';

    this.subtitleEl.innerHTML = `${totalShips} Active Vessels${underutilizedTag} • Upkeep: 🪙 ${totalUpkeep}/day • Lifetime Profit: +🪙 ${Math.floor(totalProfit).toLocaleString()}`;
  }

  private getFilteredAndSortedShips(): ShipInstance[] {
    if (!this.sim.shipManager) return [];
    let ships = Array.from(this.sim.shipManager.ships.values());

    const searchQuery = this.searchInput?.value.trim().toLowerCase() || '';
    const tierFilter = this.tierFilter?.value || 'all';
    const portFilter = this.portFilter?.value || 'all';
    const stateFilter = this.stateFilter?.value || 'all';
    const sortBy = this.sortSelect?.value || 'profit-desc';

    // Filter by search query
    if (searchQuery) {
      ships = ships.filter((ship) => {
        const homeName = this.sim.islandsData.get(ship.homeIslandId)?.name?.toLowerCase() || '';
        const targetName = ship.targetIslandId ? (this.sim.islandsData.get(ship.targetIslandId)?.name?.toLowerCase() || '') : '';
        return (
          ship.name.toLowerCase().includes(searchQuery) ||
          homeName.includes(searchQuery) ||
          targetName.includes(searchQuery)
        );
      });
    }

    // Filter by tier
    if (tierFilter !== 'all') {
      const tierNum = parseInt(tierFilter, 10);
      ships = ships.filter((s) => s.tier === tierNum);
    }

    // Filter by home port
    if (portFilter !== 'all') {
      ships = ships.filter((s) => s.homeIslandId === portFilter);
    }

    // Filter by status state
    if (stateFilter !== 'all') {
      if (stateFilter === 'underutilized') {
        ships = ships.filter((s) => evaluateShipUtilization(s, this.sim) !== null);
      } else {
        ships = ships.filter((s) => s.state === stateFilter);
      }
    }

    // Sort
    ships.sort((a, b) => {
      switch (sortBy) {
        case 'profit-desc':
          return b.totalProfit - a.totalProfit;
        case 'profit-asc':
          return a.totalProfit - b.totalProfit;
        case 'trips-desc':
          return b.tripsCompleted - a.tripsCompleted;
        case 'speed-desc':
          return b.speedKmPerDay - a.speedKmPerDay;
        case 'tier-desc':
          return b.tier - a.tier;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        default:
          return b.totalProfit - a.totalProfit;
      }
    });

    return ships;
  }

  private renderTable() {
    if (!this.tableBodyEl) return;
    const ships = this.getFilteredAndSortedShips();

    if (ships.length === 0) {
      this.tableBodyEl.innerHTML = '';
      if (this.emptyStateEl) this.emptyStateEl.style.display = 'block';
      return;
    }

    if (this.emptyStateEl) this.emptyStateEl.style.display = 'none';

    const unlockedIslands = Array.from(this.sim.unlockedIslands)
      .map((id) => this.sim.islandsData.get(id))
      .filter((isl): isl is NonNullable<typeof isl> => !!isl)
      .sort((a, b) => a.name.localeCompare(b.name));

    const iconStyle = icons.getStyle();
    const coinSvg = getIconSvg('coin', iconStyle, 14);

    let rowsHtml = '';
    for (const ship of ships) {
      ship.name = toSingleWordShipName(ship.name);
      const tierIcon = this.getTierIcon(ship.tier);
      const def = this.sim.shipDefs.get(ship.typeId);
      const typeName = def?.name || `Tier ${ship.tier}`;
      const curSpeedKm = ship.effectiveSpeedKmPerDay || ship.speedKmPerDay;
      const knots = (curSpeedKm / 44.45).toFixed(1);
      const windMod = ship.windSpeedModifier || 1.0;
      const cargoMod = ship.cargoSpeedModifier || 1.0;
      let windTag = '';
      let cargoTag = '';
      if (ship.state === 'sailing') {
        if (windMod >= 1.05) {
          windTag = `<span style="color:#34d399; font-weight:700; margin-left:3px;" title="Tailwind +${Math.round((windMod - 1) * 100)}%">▲</span>`;
        } else if (windMod <= 0.95) {
          windTag = `<span style="color:#f87171; font-weight:700; margin-left:3px;" title="Headwind -${Math.round((1 - windMod) * 100)}%">▼</span>`;
        }
        if (cargoMod >= 1.06) {
          cargoTag = `<span style="color:#38bdf8; font-weight:700; margin-left:2px;" title="Light Hold (Ballast Sprint) +${Math.round((cargoMod - 1) * 100)}%">🪶</span>`;
        } else if (cargoMod <= 0.90) {
          cargoTag = `<span style="color:#fbbf24; font-weight:700; margin-left:2px;" title="Laden Hold (Draft Drag) -${Math.round((1 - cargoMod) * 100)}%">📦</span>`;
        }
      }

      // Status text & class
      const targetName = ship.targetIslandId ? (this.sim.islandsData.get(ship.targetIslandId)?.name || ship.targetIslandId) : 'Port';
      let statusLabel = 'Docked';
      let statusClass = 'docked';
      if (ship.state === 'sailing') {
        statusLabel = `➔ ${targetName}`;
        statusClass = 'sailing';
      } else if (ship.state === 'loading') {
        statusLabel = 'Loading';
        statusClass = 'loading';
      } else if (ship.state === 'unloading') {
        statusLabel = 'Unloading';
        statusClass = 'unloading';
      }

      // Cargo detail
      let cargoHtml = '<span class="fleet-cargo-empty">Empty</span>';
      if (ship.cargo) {
        const goodSvg = getGoodIconSvg(ship.cargo.goodId, iconStyle, 16);
        const goodName = ship.cargo.goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        cargoHtml = `
          <div class="fleet-cargo-cell">
            <span class="fleet-good-icon">${goodSvg}</span>
            <span>${ship.cargo.quantity} ${goodName}</span>
          </div>
        `;
      }

      // Home Port select options
      let homeOptions = '';
      for (const isl of unlockedIslands) {
        homeOptions += `<option value="${isl.id}" ${isl.id === ship.homeIslandId ? 'selected' : ''}>${isl.name}</option>`;
      }

      // Cargo Priority options
      const priorities = [
        { id: 'auto', label: 'Auto (Best Profit)' },
        { id: 'wine', label: '🍷 Wine' },
        { id: 'olive_oil', label: '🫒 Olive Oil' },
        { id: 'fish', label: '🐟 Fish' },
        { id: 'marble', label: '🏛️ Marble' },
        { id: 'grain', label: '🌾 Grain' },
        { id: 'fuel', label: '⛽ Fuel' },
        { id: 'crafts', label: '🏺 Crafts' },
        { id: 'mastic', label: '🌿 Mastic' },
        { id: 'cheese', label: '🧀 Cheese' },
      ];
      let priorityOptions = '';
      for (const p of priorities) {
        priorityOptions += `<option value="${p.id}" ${(ship.cargoPriority || 'auto') === p.id ? 'selected' : ''}>${p.label}</option>`;
      }

      const underutilizedInfo = evaluateShipUtilization(ship, this.sim);

      rowsHtml += `
        <tr data-ship-id="${ship.id}" class="fleet-row ${underutilizedInfo ? 'row-underutilized' : ''}">
          <td class="fleet-cell-vessel">
            <span class="fleet-vessel-icon">${tierIcon}</span>
            <div class="fleet-vessel-meta">
              <strong class="fleet-vessel-name">${ship.name}</strong>
              <span class="fleet-vessel-trips">(${ship.tripsCompleted} voyages)</span>
            </div>
          </td>
          <td class="fleet-cell-class">
            <span class="badge-tier tier-${ship.tier}">${typeName}</span>
          </td>
          <td class="fleet-cell-home">
            <select class="fleet-select-compact fleet-home-select" data-ship-id="${ship.id}" title="Reassign Home Port">
              ${homeOptions}
            </select>
          </td>
          <td class="fleet-cell-status">
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
              <span class="voyage-status-badge ${statusClass}">${statusLabel}</span>
              ${underutilizedInfo ? `<span class="fleet-underutilized-pill ${underutilizedInfo.severity}" data-ship-id="${ship.id}" data-tooltip-type="vessel-alert" data-tooltip-title="Logistics Alert • ${ship.name}" data-tooltip-body="${underutilizedInfo.details}" data-tooltip-rec="${underutilizedInfo.recommendation}" data-tooltip-badge="${underutilizedInfo.label}" data-tooltip-severity="${underutilizedInfo.severity}" data-tooltip-hint="Click to inspect in Vessel Logistics Modal">⚠️ ${underutilizedInfo.label}</span>` : ''}
            </div>
          </td>
          <td class="fleet-cell-cargo">
            ${cargoHtml}
          </td>
          <td class="fleet-cell-speed">
            <span>${knots} kt ${windTag}${cargoTag}</span>
          </td>
          <td class="fleet-cell-profit">
            <span class="fleet-profit-num">+${coinSvg} ${Math.floor(ship.totalProfit).toLocaleString()}</span>
          </td>
          <td class="fleet-cell-actions">
            <div class="fleet-actions-group">
              <select class="fleet-select-compact fleet-priority-select" data-ship-id="${ship.id}" title="Cargo Priority">
                ${priorityOptions}
              </select>
              <button class="btn-fleet-track" data-ship-id="${ship.id}" title="Track & Follow Camera (3D View)">
                🎥 Track
              </button>
              <button class="btn-fleet-decommission" data-ship-id="${ship.id}" title="Decommission ${ship.name} (Frees 1 berth at ${this.sim.islandsData.get(ship.homeIslandId)?.name || 'port'}, recovers +🪙 ${this.sim.getShipDecommissionRefund(ship.id).toLocaleString()} salvage)">
                🔨 Scrap
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    this.tableBodyEl.innerHTML = rowsHtml;
  }

  /**
   * Refreshes dynamic fields (status, cargo, profit, voyages) in place without rebuilding DOM rows,
   * avoiding focus loss if player is interacting with select dropdowns.
   */
  private refreshRowDynamicData() {
    if (!this.tableBodyEl || !this.sim.shipManager) return;
    const rows = this.tableBodyEl.querySelectorAll('tr[data-ship-id]');
    const iconStyle = icons.getStyle();
    const coinSvg = getIconSvg('coin', iconStyle, 14);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLTableRowElement;
      const shipId = row.getAttribute('data-ship-id');
      if (!shipId) continue;
      const ship = this.sim.shipManager.ships.get(shipId);
      if (!ship) continue;

      // Status
      const statusBadge = row.querySelector('.fleet-cell-status .voyage-status-badge');
      if (statusBadge) {
        const targetName = ship.targetIslandId ? (this.sim.islandsData.get(ship.targetIslandId)?.name || ship.targetIslandId) : 'Port';
        let statusLabel = 'Docked';
        let statusClass = 'docked';
        if (ship.state === 'sailing') {
          statusLabel = `➔ ${targetName}`;
          statusClass = 'sailing';
        } else if (ship.state === 'loading') {
          statusLabel = 'Loading';
          statusClass = 'loading';
        } else if (ship.state === 'unloading') {
          statusLabel = 'Unloading';
          statusClass = 'unloading';
        }
        statusBadge.className = `voyage-status-badge ${statusClass}`;
        statusBadge.textContent = statusLabel;
      }

      // Cargo
      const cargoCell = row.querySelector('.fleet-cell-cargo');
      if (cargoCell) {
        if (ship.cargo) {
          const goodSvg = getGoodIconSvg(ship.cargo.goodId, iconStyle, 16);
          const goodName = ship.cargo.goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          cargoCell.innerHTML = `
            <div class="fleet-cargo-cell">
              <span class="fleet-good-icon">${goodSvg}</span>
              <span>${ship.cargo.quantity} ${goodName}</span>
            </div>
          `;
        } else {
          cargoCell.innerHTML = '<span class="fleet-cargo-empty">Empty</span>';
        }
      }

      // Vessel Name & Voyages
      const nameEl = row.querySelector('.fleet-vessel-name');
      if (nameEl) nameEl.textContent = toSingleWordShipName(ship.name);

      const tripsEl = row.querySelector('.fleet-vessel-trips');
      if (tripsEl) tripsEl.textContent = `(${ship.tripsCompleted} voyages)`;

      // Profit
      const profitEl = row.querySelector('.fleet-cell-profit .fleet-profit-num');
      if (profitEl) {
        profitEl.innerHTML = `+${coinSvg} ${Math.floor(ship.totalProfit).toLocaleString()}`;
      }

      // Speed
      const speedCell = row.querySelector('.fleet-cell-speed');
      if (speedCell) {
        const curSpeedKm = ship.effectiveSpeedKmPerDay || ship.speedKmPerDay;
        const knots = (curSpeedKm / 44.45).toFixed(1);
        const windMod = ship.windSpeedModifier || 1.0;
        const cargoMod = ship.cargoSpeedModifier || 1.0;
        let windTag = '';
        let cargoTag = '';
        if (ship.state === 'sailing') {
          if (windMod >= 1.05) {
            windTag = `<span style="color:#34d399; font-weight:700; margin-left:3px;" title="Tailwind +${Math.round((windMod - 1) * 100)}%">▲</span>`;
          } else if (windMod <= 0.95) {
            windTag = `<span style="color:#f87171; font-weight:700; margin-left:3px;" title="Headwind -${Math.round((1 - windMod) * 100)}%">▼</span>`;
          }
          if (cargoMod >= 1.06) {
            cargoTag = `<span style="color:#38bdf8; font-weight:700; margin-left:2px;" title="Light Hold (Ballast Sprint) +${Math.round((cargoMod - 1) * 100)}%">🪶</span>`;
          } else if (cargoMod <= 0.90) {
            cargoTag = `<span style="color:#fbbf24; font-weight:700; margin-left:2px;" title="Laden Hold (Draft Drag) -${Math.round((1 - cargoMod) * 100)}%">📦</span>`;
          }
        }
        speedCell.innerHTML = `<span>${knots} kt ${windTag}${cargoTag}</span>`;
      }
    }
  }

  private getTierIcon(tier: number): string {
    const style = icons.getStyle();
    if (style === 'emoji') {
      switch (tier) {
        case 1: return '⛵';
        case 2: return '🚢';
        case 3: return '⛴️';
        case 4: return '🚢';
        case 5: return '🛥️';
        default: return '⛵';
      }
    }
    return getShipTierIconSvg(tier, style, 18);
  }
}
