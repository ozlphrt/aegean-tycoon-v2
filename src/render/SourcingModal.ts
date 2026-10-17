import type { SimulationCore } from '../sim/simulation';
import {
  analyzeCommoditySourcing,
  inspectVesselClassAvailability,
} from '../sim/sourcing';
import { icons, getIconSvg, getGoodIconSvg, getShipTierIconSvg } from './Icons';
import { audio } from '../audio/AudioManager';
import { formatCompactNumber } from '../ui/i18n';

export interface SourcingModalCallbacks {
  onFocusIsland: (islandId: string) => void;
  onNotification?: (badge: string, text: string) => void;
}

export class SourcingModal {
  private modalEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private subtitleEl: HTMLElement | null = null;
  private titleIconEl: HTMLElement | null = null;

  private currentIslandId: string | null = null;
  private currentGoodId: string | null = null;
  private selectedSupplierPortId: string | null = null;
  private selectedShipTierId: string | null = null;
  private isVisible = false;

  constructor(
    private sim: SimulationCore,
    private callbacks: SourcingModalCallbacks
  ) {
    this.initDOM();
  }

  private initDOM() {
    this.modalEl = document.getElementById('sourcing-modal');
    this.contentEl = document.getElementById('sourcing-modal-content');
    this.titleEl = document.getElementById('sourcing-modal-title');
    this.subtitleEl = document.getElementById('sourcing-modal-subtitle');
    this.titleIconEl = document.getElementById('sourcing-modal-icon');

    // Close button
    document.getElementById('btn-close-sourcing')?.addEventListener('click', () => {
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

      // 1. Focus / Inspect Port on map
      const focusBtn = target.closest('.btn-source-focus') as HTMLElement | null;
      if (focusBtn) {
        e.stopPropagation();
        const islandId = focusBtn.getAttribute('data-island-id');
        if (islandId) {
          audio.playClickSound();
          this.callbacks.onFocusIsland(islandId);
        }
        return;
      }

      // 2. Select Supplier Port Card
      const portCard = target.closest('.sourcing-port-card') as HTMLElement | null;
      if (portCard) {
        const islandId = portCard.getAttribute('data-island-id');
        if (islandId && islandId !== this.selectedSupplierPortId) {
          this.selectedSupplierPortId = islandId;
          audio.playClickSound();
          this.render();
          return;
        }
      }

      // 3. Select Vessel Class Card
      const vesselCard = target.closest('.sourcing-vessel-card') as HTMLElement | null;
      if (vesselCard) {
        const tierId = vesselCard.getAttribute('data-tier-id');
        if (tierId && tierId !== this.selectedShipTierId) {
          this.selectedShipTierId = tierId;
          audio.playClickSound();
          this.render();
          return;
        }
      }

      // 4. Redirect Vessel to prioritize this good / dispatch to supplier port
      const redirectBtn = (target.closest('.btn-vessel-redirect') ||
        target.closest('.btn-vessel-prioritize')) as HTMLElement | null;
      if (redirectBtn) {
        const shipId = redirectBtn.getAttribute('data-ship-id');
        const goodId = redirectBtn.getAttribute('data-good-id');
        const targetPortId = redirectBtn.getAttribute('data-target-port-id');
        if (shipId && goodId) {
          if (targetPortId) {
            this.sim.redirectShip(shipId, targetPortId, goodId);
          } else {
            this.sim.setShipCargoPriority(shipId, goodId);
          }
          audio.playCoinSound();
          const ship = this.sim.shipManager?.ships.get(shipId);
          const goodName = goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const targetPortName = targetPortId
            ? this.sim.islandsData.get(targetPortId)?.name || targetPortId
            : null;
          this.callbacks.onNotification?.(
            'VESSEL DISPATCHED',
            targetPortName
              ? `${ship?.name || 'Vessel'} redirected to ${targetPortName} for ${goodName} lifelines!`
              : `${ship?.name || 'Vessel'} prioritized for ${goodName} transport!`
          );
          this.render(); // Re-render to reflect updated vessel priority and location
        }
        return;
      }

      // 5. Reset Vessel to Auto
      const autoBtn = target.closest('.btn-vessel-auto') as HTMLElement | null;
      if (autoBtn) {
        const shipId = autoBtn.getAttribute('data-ship-id');
        if (shipId) {
          this.sim.setShipCargoPriority(shipId, 'auto');
          audio.playClickSound();
          this.callbacks.onNotification?.(
            'PRIORITY RESET',
            'Vessel returned to automatic profit arbitrage.'
          );
          this.render();
        }
        return;
      }

      // 6. Commission Dedicated Vessel at Harbor
      const commissionBtn = (target.closest('.btn-commission-spot') ||
        target.closest('.btn-source-commission')) as HTMLElement | null;
      if (commissionBtn) {
        const typeId = commissionBtn.getAttribute('data-tier-id');
        const islandId = commissionBtn.getAttribute('data-island-id');
        const goodId = commissionBtn.getAttribute('data-good-id');
        const targetSupplierId = commissionBtn.getAttribute('data-target-supplier-id');
        if (typeId && islandId && goodId) {
          const res = this.sim.buyShip(typeId, islandId);
          if (res.success && res.ship) {
            // Automatically assign cargo priority to the requested good
            this.sim.setShipCargoPriority(res.ship.id, goodId);
            if (targetSupplierId) {
              this.sim.redirectShip(res.ship.id, targetSupplierId, goodId);
            }
            audio.playCoinSound();
            const def = this.sim.shipDefs.get(typeId);
            const goodName = goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const destName = this.sim.islandsData.get(islandId)?.name || 'Harbor';
            this.callbacks.onNotification?.(
              'FLEET EXPANSION',
              `Commissioned ${res.ship.name} (${def?.name || 'Vessel'}) at ${destName} dedicated to ${goodName} relief!`
            );
            this.render();
          } else {
            audio.playClickSound();
            this.callbacks.onNotification?.(
              'COMMISSION FAILED',
              res.reason || 'Could not commission vessel.'
            );
          }
        }
        return;
      }
    });

    // Close on Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  public show(islandId: string, goodId: string): void {
    if (!this.modalEl) return;
    this.currentIslandId = islandId;
    this.currentGoodId = goodId;
    this.selectedSupplierPortId = null;
    this.selectedShipTierId = null;
    this.isVisible = true;
    this.modalEl.classList.remove('closed');
    this.render();
  }

  public hide(): void {
    if (!this.modalEl) return;
    this.isVisible = false;
    this.modalEl.classList.add('closed');
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public render(): void {
    if (!this.isVisible || !this.currentIslandId || !this.currentGoodId || !this.contentEl) return;

    const analysis = analyzeCommoditySourcing(this.sim, this.currentIslandId, this.currentGoodId);
    if (!analysis) return;

    // Resolve or default selectedSupplierPortId
    if (
      !this.selectedSupplierPortId ||
      !analysis.closestProducers.some((p) => p.islandId === this.selectedSupplierPortId)
    ) {
      this.selectedSupplierPortId =
        analysis.closestAwakeProducer?.islandId || analysis.closestProducers[0]?.islandId || null;
    }

    // Resolve or default selectedShipTierId
    if (
      !this.selectedShipTierId ||
      !analysis.vesselSuitabilities.some((v) => v.typeId === this.selectedShipTierId)
    ) {
      this.selectedShipTierId =
        analysis.recommendedShipTier ||
        analysis.vesselSuitabilities.find((v) => v.recommended)?.typeId ||
        'coaster';
    }

    const selectedProducer =
      analysis.closestProducers.find((p) => p.islandId === this.selectedSupplierPortId) ||
      analysis.closestProducers[0] ||
      null;
    const selectedSupplierName = selectedProducer ? selectedProducer.name : 'Supplier';

    const inspection = inspectVesselClassAvailability(
      this.sim,
      this.currentIslandId,
      this.selectedSupplierPortId,
      this.selectedShipTierId,
      this.currentGoodId
    );

    const iconStyle = icons.getStyle();
    const goodSvg = getGoodIconSvg(analysis.goodId, iconStyle, 24);
    const coinSvg = getIconSvg('coin', iconStyle, 14);

    // Update Header
    if (this.titleEl) {
      this.titleEl.textContent = `${analysis.goodName} Supply & Sourcing Analysis`;
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = `Port: ${analysis.islandName} • Supply Chain, Exporters & Fleet Logistics`;
    }
    if (this.titleIconEl) {
      this.titleIconEl.innerHTML = goodSvg;
    }

    // 1. Top Inventory & Shortage Status Banner
    let statusClass = 'neutral';
    let statusBadgeText = 'Stable Market';
    let statusIcon = '📦';

    if (analysis.isDeficit) {
      if (analysis.currentStock <= 0) {
        statusClass = 'critical';
        statusBadgeText = 'Critical Stockout (0 stock)';
        statusIcon = '🚨';
      } else {
        statusClass = 'warning';
        statusBadgeText = 'Deficit Shortage';
        statusIcon = '⚠️';
      }
    } else if (analysis.produceRate > 0) {
      statusClass = 'surplus';
      statusBadgeText = `Local Producer (+${analysis.produceRate}/d)`;
      statusIcon = '✨';
    }

    const daysLeft =
      analysis.consumeRate > 0 ? (analysis.currentStock / analysis.consumeRate).toFixed(1) : '∞';

    const summaryHtml = `
      <div class="sourcing-hero-banner ${statusClass}">
        <div class="sourcing-hero-left">
          <span class="sourcing-badge ${statusClass}">${statusIcon} ${statusBadgeText}</span>
          <span class="sourcing-metric-chip">Stock: <strong>${analysis.currentStock} / ${analysis.targetStock || analysis.maxCapacity}t</strong></span>
          ${analysis.consumeRate > 0 ? `<span class="sourcing-metric-chip">Drain: <strong>-${analysis.consumeRate}t/d</strong></span>` : ''}
          ${analysis.consumeRate > 0 ? `<span class="sourcing-metric-chip">Runway: <strong>~${daysLeft}d</strong></span>` : ''}
        </div>
        <div class="sourcing-diagnosis-text" title="${analysis.recommendedActionDetails}">
          ${analysis.recommendedActionDetails}
        </div>
      </div>
    `;

    // 2. Section: Closest Exporting Ports
    let producersHtml = '';
    if (analysis.closestProducers.length === 0) {
      producersHtml = `
        <div class="sourcing-empty-box">
          <p>No known production sources found for ${analysis.goodName} in the Aegean archipelago.</p>
        </div>
      `;
    } else {
      producersHtml = `
        <div class="sourcing-producers-grid">
          ${analysis.closestProducers
            .slice(0, 3)
            .map((p) => {
              const awakeTag = p.isAwake
                ? `<span class="port-status-badge awake">☀️ Awakened Port</span>`
                : `<span class="port-status-badge dark">🌙 Sleeping Port</span>`;

              let connTag = '';
              if (!p.hasNavPath) {
                connTag = `<span class="route-conn-badge none">🔒 No Route</span>`;
              } else if (p.isDirectConnection) {
                connTag = `<span class="route-conn-badge direct">🟢 Direct Lane</span>`;
              } else {
                connTag = `<span class="route-conn-badge hops">🔵 Connected</span>`;
              }

              const isSelected = p.islandId === this.selectedSupplierPortId;

              return `
                <div class="sourcing-port-card ${p.isAwake ? 'awake' : 'dark'} ${isSelected ? 'selected' : ''}" data-island-id="${p.islandId}">
                  <div class="port-card-header">
                    <div>
                      <strong class="port-card-name">${p.name}</strong>
                      <span class="port-card-region">${p.region.toUpperCase()}</span>
                    </div>
                    <div class="port-header-badges">
                      ${isSelected ? `<span class="port-selected-badge">✓ Selected</span>` : ''}
                      ${awakeTag}
                    </div>
                  </div>
                  <div class="port-card-meta">
                    <div class="port-meta-item">
                      <span class="meta-label">Distance</span>
                      <span class="meta-val">${p.pathDistanceKm} km (~${Math.round(p.pathDistanceKm / 1.852)} nmi)</span>
                    </div>
                    <div class="port-meta-item">
                      <span class="meta-label">Sea Lane</span>
                      ${connTag}
                    </div>
                    <div class="port-meta-item">
                      <span class="meta-label">Output</span>
                      <span class="meta-val highlight">+${p.produceRate}/day</span>
                    </div>
                    <div class="port-meta-item">
                      <span class="meta-label">Warehouse</span>
                      <span class="meta-val">${p.isAwake ? `${p.stock}t @ ${coinSvg}${p.buyPrice}` : 'Unknown'}</span>
                    </div>
                  </div>
                  <div class="port-card-footer">
                    <span class="port-card-select-prompt">${isSelected ? 'Active Target Port' : 'Click to Select'}</span>
                    <button class="btn-source-focus btn-secondary" data-island-id="${p.islandId}">
                      🧭 View on Map
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }

    // 3. Section: Vessel Class Suitability Matrix
    const vesselMatrixHtml = `
      <div class="sourcing-vessel-matrix">
        ${analysis.vesselSuitabilities
          .map((v) => {
            const tierIcon = getShipTierIconSvg(v.tier, iconStyle, 18);
            let badgeClass = 'suitable';
            let badgeText = '✅ Suitable';

            if (!v.canCarry) {
              badgeClass = 'ineligible';
              badgeText = '❌ Passenger Only';
            } else if (!v.isUnlocked) {
              badgeClass = 'locked';
              badgeText = `🔒 Req ${v.unlockedCountReq} Isl`;
            } else if (!v.isRangeAdequate) {
              badgeClass = 'short-range';
              badgeText = `⚠️ Short Range (${v.range}km)`;
            } else if (v.recommended) {
              badgeClass = 'recommended';
              badgeText = '🌟 Ideal Choice';
            }

            const isSelected = v.typeId === this.selectedShipTierId;

            return `
              <div class="sourcing-vessel-card ${v.recommended ? 'recommended-glow' : ''} ${isSelected ? 'selected' : ''}" data-tier-id="${v.typeId}">
                <div class="vessel-card-top">
                  <div class="vessel-card-info">
                    <span class="vessel-tier-icon">${tierIcon}</span>
                    <div>
                      <strong class="vessel-card-name">${v.name}</strong>
                      <span class="vessel-card-tier">Tier ${v.tier}</span>
                    </div>
                  </div>
                  <div class="vessel-badge-stack">
                    ${isSelected ? `<span class="vessel-selected-badge">✓ Selected</span>` : ''}
                    <span class="vessel-suit-badge ${badgeClass}">${badgeText}</span>
                  </div>
                </div>
                <div class="vessel-card-specs">
                  <div class="vessel-spec-row">
                    <span>Cap: <strong>${v.capacity}t</strong></span>
                    <span>Range: <strong>${v.range}km</strong></span>
                  </div>
                  <div class="vessel-spec-row">
                    <span>Speed: <strong>${v.speed}kt</strong></span>
                    ${v.canCarry && analysis.consumeRate > 0 ? `<span>Supply: <strong>${v.daysSupplyPerTrip}d</strong></span>` : '<span>-</span>'}
                  </div>
                </div>
                <div class="vessel-card-footer-hint">
                  ${isSelected ? 'Active Class Selection' : 'Click to Select Class'}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    // 4. Section: On-The-Spot Inspection & Route Dispatcher
    let inspectionHtml = '';
    if (inspection) {
      const isRangeAdequate = inspection.isRangeAdequate;
      const canCarry = inspection.canCarry;
      const matchingShips = inspection.availableVessels;

      let fleetCardsHtml = '';
      if (matchingShips.length === 0) {
        fleetCardsHtml = `
          <div class="sourcing-inspection-empty">
            <div class="inspection-empty-icon">⚓</div>
            <div class="inspection-empty-text">
              <strong>You currently have 0 ${inspection.typeName}s in your fleet.</strong>
              <p>Commission a new ${inspection.typeName} below to establish an immediate dedicated lifeline from ${selectedSupplierName} to ${analysis.islandName} on the spot.</p>
            </div>
          </div>
        `;
      } else {
        fleetCardsHtml = `
          <div class="inspection-fleet-grid">
            ${matchingShips
              .map((v) => {
                const tierIcon = getShipTierIconSvg(v.tier, iconStyle, 18);
                const isPrioritizing = v.isPrioritizingTargetGood;

                let locBadge = '';
                if (v.isAtDestination) {
                  locBadge = `<span class="loc-chip local">⚓ Docked at ${analysis.islandName}</span>`;
                } else if (v.isAtSelectedSupplier) {
                  locBadge = `<span class="loc-chip supplier">☀️ In Port at ${selectedSupplierName}</span>`;
                } else if (v.isEnRouteToDestination) {
                  locBadge = `<span class="loc-chip sailing">🌊 Sailing to ${analysis.islandName}</span>`;
                } else if (v.isEnRouteToSupplier) {
                  locBadge = `<span class="loc-chip sailing">🌊 Sailing to ${selectedSupplierName}</span>`;
                } else if (v.state === 'sailing') {
                  locBadge = `<span class="loc-chip other">🌊 En Route (${v.targetLocationName || 'At Sea'})</span>`;
                } else {
                  locBadge = `<span class="loc-chip other">⚓ Docked at ${v.currentLocationName}</span>`;
                }

                let cargoBadge = '<span class="cargo-chip empty">Empty</span>';
                if (v.cargoGoodId) {
                  const gSvg = getGoodIconSvg(v.cargoGoodId, iconStyle, 14);
                  const isTarget = v.cargoGoodId === analysis.goodId;
                  cargoBadge = `
                    <span class="cargo-chip ${isTarget ? 'target-good' : 'other-good'}">
                      ${gSvg} ${v.cargoQuantity} ${v.cargoGoodId.replace('_', ' ')}
                    </span>
                  `;
                }

                return `
                  <div class="inspection-ship-row ${isPrioritizing ? 'prioritized' : ''}">
                    <div class="ship-row-left">
                      <span class="vessel-icon-pill">${tierIcon}</span>
                      <div class="ship-row-meta">
                        <strong class="ship-name">${v.name}</strong>
                        <span class="ship-sub">${v.typeName} (Cap ${v.capacity}t • ${v.range}km)</span>
                      </div>
                    </div>
                    <div class="ship-row-loc">
                      ${locBadge}
                    </div>
                    <div class="ship-row-cargo">
                      ${cargoBadge}
                    </div>
                    <div class="ship-row-action">
                      ${
                        isPrioritizing
                          ? `<button class="btn-secondary btn-vessel-auto" data-ship-id="${v.shipId}" title="Reset to automatic profit arbitrage">✓ Prioritizing ${analysis.goodName} (Reset to Auto)</button>`
                          : `<button class="btn-primary btn-vessel-redirect" data-ship-id="${v.shipId}" data-target-port-id="${this.selectedSupplierPortId}" data-good-id="${analysis.goodId}" title="Redirect ${v.name} to ${selectedSupplierName} and prioritize ${analysis.goodName}">🧭 Redirect to ${selectedSupplierName}</button>`
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        `;
      }

      // Commission card
      const commCardHtml = `
        <div class="inspection-commission-card">
          <div class="comm-card-main">
            <strong class="comm-card-title">🔨 Commission Dedicated ${inspection.typeName} at ${analysis.islandName}</strong>
            <div class="comm-card-specs">
              <span class="comm-chip">Cost: <strong>${coinSvg} ${inspection.cost}</strong></span>
              <span class="comm-chip">Harbor: <strong>${inspection.berthsUsed} / ${inspection.berthsMax} berths</strong></span>
              <span class="comm-chip">Treasury: <strong>${coinSvg} ${formatCompactNumber(this.sim.treasury)}</strong></span>
            </div>
          </div>
          <div class="comm-card-btn-box">
            ${
              inspection.canCommission
                ? `<button class="btn-primary btn-commission-spot" data-tier-id="${inspection.typeId}" data-island-id="${analysis.islandId}" data-good-id="${analysis.goodId}" data-target-supplier-id="${this.selectedSupplierPortId}">
                    🔨 Commission & Deploy (${coinSvg} ${inspection.cost})
                   </button>`
                : `<button class="btn-secondary" disabled title="${inspection.commissionBlockedReason || 'Unavailable'}">
                    🔒 ${inspection.commissionBlockedReason || 'Cannot Commission'}
                   </button>`
            }
          </div>
        </div>
      `;

      inspectionHtml = `
        <div class="sourcing-inspection-box">
          <div class="inspection-route-banner">
            <div class="inspection-route-title">
              <span class="route-point start">${selectedSupplierName}</span>
              <span class="route-arrow">➔</span>
              <span class="route-point end">${analysis.islandName}</span>
              <span class="route-dist-chip">${inspection.routeDistanceKm} km (~${Math.round(inspection.routeDistanceKm / 1.852)} nmi)</span>
            </div>
            <div class="inspection-suitability-pills">
              ${!canCarry ? '<span class="vessel-suit-badge ineligible">❌ Passenger Only</span>' : ''}
              ${!inspection.isUnlocked ? `<span class="vessel-suit-badge locked">🔒 Requires ${inspection.unlockedCountReq} Isl</span>` : ''}
              ${!isRangeAdequate ? `<span class="vessel-suit-badge short-range">⚠️ Out of Range (${inspection.range}km)</span>` : '<span class="vessel-suit-badge suitable">✅ In Range</span>'}
              <span class="vessel-metric-pill">Cap: <strong>${inspection.capacity}t</strong></span>
              <span class="vessel-metric-pill">Speed: <strong>${inspection.speed} kt</strong></span>
            </div>
          </div>

          <div class="inspection-fleet-section">
            <div class="inspection-fleet-header">
              <span class="inspection-fleet-title">Available Fleet: <strong>${matchingShips.length} ${inspection.typeName}(s)</strong> in Service</span>
            </div>
            ${fleetCardsHtml}
          </div>

          ${commCardHtml}
        </div>
      `;
    }

    // 5. Other local vessels at this island (only displayed if player owns 0 matching vessels of selected class)
    const otherLocalVessels = analysis.portVessels.filter(
      (v) => v.tier !== (inspection?.tier ?? -1)
    );
    let otherVesselsHtml = '';
    if (otherLocalVessels.length > 0 && (inspection?.availableVessels.length ?? 0) === 0) {
      otherVesselsHtml = `
        <div class="sourcing-section other-vessels-section">
          <h4 class="sourcing-section-title">
            <span>⚓ Other Local Harbor Vessels at ${analysis.islandName}</span>
            <span class="section-badge">${otherLocalVessels.length} Other Vessels</span>
          </h4>
          <div class="sourcing-vessels-grid">
            ${otherLocalVessels
              .map((v) => {
                const tierIcon = getShipTierIconSvg(v.tier, iconStyle, 16);
                const hasPriority = v.cargoPriority === analysis.goodId;
                let cargoBadge = '<span class="cargo-chip empty">Empty</span>';
                if (v.cargoGoodId) {
                  const gSvg = getGoodIconSvg(v.cargoGoodId, iconStyle, 13);
                  const isTarget = v.cargoGoodId === analysis.goodId;
                  cargoBadge = `
                    <span class="cargo-chip ${isTarget ? 'target-good' : 'other-good'}">
                      ${gSvg} ${v.cargoQuantity} ${v.cargoGoodId.replace('_', ' ')}
                    </span>
                  `;
                }
                return `
                  <div class="sourcing-vessel-row ${hasPriority ? 'prioritized' : ''}">
                    <div class="vessel-row-left">
                      <span class="vessel-icon-pill">${tierIcon}</span>
                      <div class="vessel-row-meta">
                        <strong class="vessel-name">${v.name}</strong>
                        <span class="vessel-sub">${v.typeName} (Cap ${v.capacity}t • ${v.range}km) • ${v.state.toUpperCase()}</span>
                      </div>
                    </div>
                    <div class="vessel-row-center">
                      ${cargoBadge}
                    </div>
                    <div class="vessel-row-right">
                      ${
                        hasPriority
                          ? `<button class="btn-secondary btn-vessel-auto" data-ship-id="${v.shipId}" title="Reset to automatic arbitrage">✓ Prioritizing ${analysis.goodName} (Reset)</button>`
                          : `<button class="btn-primary btn-vessel-prioritize" data-ship-id="${v.shipId}" data-good-id="${analysis.goodId}" title="Direct vessel to prioritize hauling ${analysis.goodName}">🔄 Prioritize ${analysis.goodName}</button>`
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    this.contentEl.innerHTML = `
      ${summaryHtml}

      <div class="sourcing-section">
        <h4 class="sourcing-section-title">
          <span>⚓ Closest Exporting Ports</span>
          <span class="section-badge">${analysis.closestProducers.filter((p) => p.isAwake).length} Awakened Producers</span>
        </h4>
        ${producersHtml}
      </div>

      <div class="sourcing-section">
        <h4 class="sourcing-section-title">
          <span>🚢 Vessel Class Range & Capacity Suitability</span>
        </h4>
        ${vesselMatrixHtml}
      </div>

      <div class="sourcing-section">
        <h4 class="sourcing-section-title">
          <span>🛡️ Fleet Assessment at ${analysis.islandName}</span>
          <span class="section-badge ${inspection?.isBerthFull ? 'badge-alert' : ''}">⚓ Berths: ${inspection?.berthsUsed ?? analysis.berthsUsed} / ${inspection?.berthsMax ?? analysis.berthsMax}</span>
        </h4>
        ${inspectionHtml}
      </div>

      ${otherVesselsHtml}
    `;
  }
}
