/**
 * VesselAdvisoryModal.ts — In-Game Vessel Logistics & Fleet Utilization Modal
 * 
 * Provides an operational audit and actionable controls for underutilized or idle vessels.
 * Aligned with the Aegean Tycoon glassmorphic modal theme.
 */

import { SimulationCore } from '../sim/simulation';
import { evaluateShipUtilization } from '../sim/shipSim';
import type { UnderutilizedShipInfo } from '../sim/shipSim';
import type { GoodDefinition } from '../data/types';
import { confirmModal } from './ConfirmModal';

export interface VesselAdvisoryModalCallbacks {
  onFollowShip: (shipId: string) => void;
  onOpenSourcing?: (islandId: string, goodId: string) => void;
  onOpenFleet?: () => void;
  onPriorityChanged?: (shipId: string, goodId: string | null) => void;
  onHomeChanged?: (shipId: string, islandId: string) => void;
  onDecommissionShip?: (shipId: string) => void;
}

export class VesselAdvisoryModal {
  private overlayEl: HTMLElement | null = null;
  private sim: SimulationCore;
  private callbacks: VesselAdvisoryModalCallbacks;
  private activeShipId: string | null = null;

  constructor(sim: SimulationCore, callbacks: VesselAdvisoryModalCallbacks) {
    this.sim = sim;
    this.callbacks = callbacks;
    this.createDom();
    this.bindEvents();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('vessel-advisory-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vessel-advisory-modal';
      overlay.className = 'modal-overlay vessel-modal-overlay closed';
      overlay.innerHTML = `
        <div class="glass-panel vessel-modal-container">
          <div class="modal-header">
            <div class="modal-title-group">
              <div class="vessel-modal-header-title-row">
                <span class="modal-title-icon" id="vessel-modal-icon">⚠️</span>
                <h3 id="vessel-modal-title" class="vessel-modal-title">Vessel Logistics & Fleet Utilization</h3>
              </div>
              <p class="modal-subtitle" id="vessel-modal-subtitle">Operational Audit & Harbor Action Checklist</p>
            </div>
            <button id="btn-close-vessel-modal" class="btn-close" title="Close (Esc)">✕</button>
          </div>
          <div class="vessel-modal-body" id="vessel-modal-content">
            <!-- Dynamically populated -->
          </div>
        </div>
      `;
      document.getElementById('hud-overlay')?.appendChild(overlay) || document.body.appendChild(overlay);
    }

    this.overlayEl = overlay;
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.hide();
      }
    });

    const closeBtn = document.getElementById('btn-close-vessel-modal');
    closeBtn?.addEventListener('click', () => this.hide());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlayEl?.classList.contains('closed')) {
        this.hide();
      }
    });

    // Content event delegation
    const content = document.getElementById('vessel-modal-content');
    content?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Track Camera
      if (target.closest('.btn-vessel-modal-track')) {
        if (this.activeShipId) {
          this.callbacks.onFollowShip(this.activeShipId);
          this.hide();
        }
      }

      // Reset Priority
      if (target.closest('.btn-vessel-modal-reset-priority')) {
        if (this.activeShipId) {
          const ship = this.sim.shipManager?.ships.get(this.activeShipId);
          if (ship) {
            ship.cargoPriority = undefined;
            this.callbacks.onPriorityChanged?.(this.activeShipId, null);
            this.render();
          }
        }
      }

      // Open Sourcing
      const btnSourcing = target.closest('.btn-vessel-modal-sourcing') as HTMLElement | null;
      if (btnSourcing) {
        const islandId = btnSourcing.getAttribute('data-island-id');
        const goodId = btnSourcing.getAttribute('data-good-id');
        if (islandId && goodId) {
          this.hide();
          this.callbacks.onOpenSourcing?.(islandId, goodId);
        }
      }

      // Open Fleet Roster
      if (target.closest('.btn-vessel-modal-fleet')) {
        this.hide();
        this.callbacks.onOpenFleet?.();
      }

      // Decommission / Scrap Vessel
      if (target.closest('.btn-vessel-modal-decommission')) {
        if (this.activeShipId) {
          const ship = this.sim.shipManager?.ships.get(this.activeShipId);
          if (ship) {
            const refund = this.sim.getShipDecommissionRefund(this.activeShipId);
            const homeName = this.sim.islandsData.get(ship.homeIslandId)?.name || 'Harbor';
            confirmModal.confirmDecommissionShip(ship.name, homeName, refund).then((confirmed) => {
              if (confirmed) {
                const res = this.sim.decommissionShip(this.activeShipId!);
                if (res.success) {
                  const sId = this.activeShipId!;
                  this.hide();
                  this.callbacks.onDecommissionShip?.(sId);
                }
              }
            });
          }
        }
      }
    });

    content?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.classList.contains('vessel-modal-home-select')) {
        if (this.activeShipId) {
          const ship = this.sim.shipManager?.ships.get(this.activeShipId);
          if (ship) {
            ship.homeIslandId = target.value;
            this.callbacks.onHomeChanged?.(this.activeShipId, target.value);
            this.render();
          }
        }
      }
      if (target.classList.contains('vessel-modal-priority-select')) {
        if (this.activeShipId) {
          const ship = this.sim.shipManager?.ships.get(this.activeShipId);
          if (ship) {
            ship.cargoPriority = target.value === 'auto' ? undefined : target.value;
            this.callbacks.onPriorityChanged?.(this.activeShipId, ship.cargoPriority || null);
            this.render();
          }
        }
      }
    });
  }

  public show(shipId: string): void {
    this.activeShipId = shipId;
    this.render();
    if (this.overlayEl) {
      this.overlayEl.classList.remove('closed');
    }
  }

  public hide(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.add('closed');
    }
  }

  public render(): void {
    if (!this.activeShipId || !this.overlayEl) return;
    const ship = this.sim.shipManager?.ships.get(this.activeShipId);
    if (!ship) return;

    const uAlert: UnderutilizedShipInfo | null = evaluateShipUtilization(ship, this.sim);
    const content = document.getElementById('vessel-modal-content');
    const titleEl = document.getElementById('vessel-modal-title');
    const subtitleEl = document.getElementById('vessel-modal-subtitle');
    if (!content) return;

    const homeData = this.sim.islandsData.get(ship.homeIslandId);
    const currentData = ship.currentIslandId ? this.sim.islandsData.get(ship.currentIslandId) : null;
    const targetData = ship.targetIslandId ? this.sim.islandsData.get(ship.targetIslandId) : null;

    if (titleEl) {
      titleEl.textContent = `${ship.name} • Logistics Audit`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = `Tier ${ship.tier} ${ship.typeId.toUpperCase()} • Home: ${homeData?.name || ship.homeIslandId} • Status: ${uAlert ? uAlert.label : 'Optimal'}`;
    }

    const stateLabel = ship.state.toUpperCase();
    const cargoName = ship.cargo ? ship.cargo.goodId.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Empty';
    const cargoQty = ship.cargo ? `${ship.cargo.quantity} / ${ship.capacity} tons (${Math.round((ship.cargo.quantity / ship.capacity) * 100)}%)` : `0 / ${ship.capacity} tons`;

    // Available goods for priority
    const allGoods = Array.from(this.sim.goodsData.values()) as GoodDefinition[];
    const unlockedIslands = Array.from(this.sim.unlockedIslands)
      .map(id => this.sim.islandsData.get(id))
      .filter(Boolean);

    const shipDef = this.sim.shipDefs.get(ship.typeId);
    const speedKnots = shipDef ? shipDef.speed.toFixed(1) : (ship.speedKmPerDay / 44.448).toFixed(1);
    const maxRange = shipDef?.range || 120;

    content.innerHTML = `
      <div class="vessel-modal-layout">
        <!-- Status Card -->
        <div class="vessel-modal-hero ${uAlert ? 'alert-' + uAlert.severity : 'optimal'}">
          <div class="hero-left">
            <span class="hero-vessel-badge tier-${ship.tier}">T${ship.tier}</span>
            <div class="hero-vessel-info">
              <h4 class="hero-vessel-name">${ship.name}</h4>
              <span class="hero-vessel-type">${ship.typeId.toUpperCase()} • Daily Upkeep: 🪙 ${ship.upkeepPerDay}/d</span>
            </div>
          </div>
          <div class="hero-right">
            ${uAlert ? `
              <span class="hero-alert-pill ${uAlert.severity}">
                ⚠️ ${uAlert.label}
              </span>
            ` : `
              <span class="hero-alert-pill optimal">
                ✓ Operating Efficiently
              </span>
            `}
          </div>
        </div>

        <!-- Telemetry Grid -->
        <div class="vessel-telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">Current State</span>
            <span class="telemetry-val">${stateLabel}</span>
            <span class="telemetry-sub">${ship.state === 'sailing' ? `Heading to ${targetData?.name || 'Destination'}` : `Docked at ${currentData?.name || homeData?.name || 'Harbor'}`}</span>
          </div>

          <div class="telemetry-card">
            <span class="telemetry-label">Cargo Hold</span>
            <span class="telemetry-val">${cargoQty}</span>
            <span class="telemetry-sub">${cargoName}</span>
          </div>

          <div class="telemetry-card">
            <span class="telemetry-label">Max Speed / Range</span>
            <span class="telemetry-val">${speedKnots} kt</span>
            <span class="telemetry-sub">Range: ${maxRange} km</span>
          </div>

          <div class="telemetry-card">
            <span class="telemetry-label">Total Commercial Profit</span>
            <span class="telemetry-val highlight">🪙 ${Math.floor(ship.totalProfit).toLocaleString()}</span>
            <span class="telemetry-sub">Lifetime Drachmas</span>
          </div>
        </div>

        <!-- Logistics Diagnosis -->
        <div class="vessel-diagnosis-card">
          <div class="diagnosis-header">
            <span class="diagnosis-icon">📋</span>
            <h5 class="diagnosis-title">Logistics Diagnostic & Root Cause</h5>
          </div>
          <p class="diagnosis-text">
            ${uAlert ? uAlert.details : `${ship.name} is currently running profitable commercial cargo voyages with active trade arbitrage.`}
          </p>
          ${uAlert?.recommendation ? `
            <div class="diagnosis-recommendation">
              <span class="rec-icon">💡</span>
              <div class="rec-content">
                <strong>Recommended Action:</strong>
                <p>${uAlert.recommendation}</p>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Operational Adjustments & Actions -->
        <div class="vessel-actions-grid">
          <!-- Home Port Selection -->
          <div class="vessel-action-card">
            <label class="action-card-label">Reassign Station Port</label>
            <p class="action-card-desc">Transfer this vessel's home harbor to an island with higher commodity surplus.</p>
            <select class="vessel-modal-select vessel-modal-home-select">
              ${unlockedIslands.map(isl => `
                <option value="${isl!.id}" ${isl!.id === ship.homeIslandId ? 'selected' : ''}>
                  ${isl!.name} (${isl!.region})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Cargo Priority Selection -->
          <div class="vessel-action-card">
            <label class="action-card-label">Cargo Hauling Priority</label>
            <p class="action-card-desc">Lock this vessel to a specific commodity or let autonomous navigation seek maximum arbitrage.</p>
            <select class="vessel-modal-select vessel-modal-priority-select">
              <option value="auto" ${!ship.cargoPriority ? 'selected' : ''}>⚡ Automatic Arbitrage (Highest Profit)</option>
              ${allGoods.map(g => `
                <option value="${g.id}" ${ship.cargoPriority === g.id ? 'selected' : ''}>
                  ${g.name} (Wholesale: 🪙 ${g.basePrice})
                </option>
              `).join('')}
            </select>
            ${ship.cargoPriority ? `
              <button class="btn-secondary btn-vessel-modal-reset-priority" style="margin-top:6px; font-size:0.75rem;">
                ✕ Reset to Automatic Arbitrage
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Modal Bottom Button Bar -->
        <div class="vessel-modal-btn-bar">
          <button class="btn-danger-decommission btn-vessel-modal-decommission" title="Decommission and scrap this vessel to free 1 harbor berth at ${homeData?.name || 'port'} and recover salvage drachmas">
            🔨 Decommission (+🪙 ${this.sim.getShipDecommissionRefund(ship.id).toLocaleString()})
          </button>
          <button class="btn-secondary btn-vessel-modal-track">
            🎥 Track with 3D Camera
          </button>
          ${ship.cargoPriority ? `
            <button class="btn-primary btn-vessel-modal-sourcing" data-island-id="${ship.homeIslandId}" data-good-id="${ship.cargoPriority}">
              🔍 Commodity Sourcing Analysis
            </button>
          ` : ''}
          <button class="btn-secondary btn-vessel-modal-fleet">
            🚢 Open Fleet Management Panel
          </button>
        </div>
      </div>
    `;
  }
}
