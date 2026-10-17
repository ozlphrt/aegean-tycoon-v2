import * as THREE from 'three';
import type { ShipInstance } from '../sim/shipSim';
import type { AegeanTerrain } from './Terrain';

export interface ShipPopupOptions {
  icon?: string;
  badge?: string;
  text: string;
  type?: 'delivery' | 'inaugural' | 'vessel' | 'cargo';
  durationMs?: number;
}

interface ActivePopup {
  id: string;
  shipId: string;
  element: HTMLElement;
  startTime: number;
  durationMs: number;
  lastWorldPos: THREE.Vector3;
}

export class ShipPopups {
  private container: HTMLElement;
  private popups: Map<string, ActivePopup> = new Map();
  private shipToPopupId: Map<string, string> = new Map(); // Guarantees strictly 1 active popup per ship
  private tempVec = new THREE.Vector3();
  private nextId = 1;

  constructor() {
    let div = document.getElementById('ship-popups-container');
    if (!div) {
      div = document.createElement('div');
      div.id = 'ship-popups-container';
      div.className = 'ship-popups-layer';
      document.body.appendChild(div);
    }
    this.container = div;
  }

  /**
   * Spawns a sleek, non-overlapping floating micro-pill over the specified ship.
   * If the ship already has an active message, it replaces it instantly with zero overlap.
   */
  public show(shipId: string, options: ShipPopupOptions): void {
    // Dismiss any existing popup for this ship so they never overlap
    const existingId = this.shipToPopupId.get(shipId);
    if (existingId) {
      const existing = this.popups.get(existingId);
      if (existing) {
        existing.element.remove();
        this.popups.delete(existingId);
      }
      this.shipToPopupId.delete(shipId);
    }

    const id = `popup_${this.nextId++}`;
    const el = document.createElement('div');
    el.className = `ship-popup-pill popup-${options.type || 'vessel'}`;
    el.id = id;

    // Pick icon from options or badge
    let icon = options.icon || '';
    let label = options.text;

    if (!icon && options.badge) {
      if (options.badge.includes('⛵')) {
        icon = '⛵';
      } else if (options.badge.includes('🪙')) {
        icon = '🪙';
      } else if (options.badge.includes('📦')) {
        icon = '📦';
      } else if (options.badge.includes('🌟')) {
        icon = '🌟';
      }
    }

    el.innerHTML = `
      ${icon ? `<span class="ship-pill-icon">${icon}</span>` : ''}
      <span class="ship-pill-text">${label}</span>
    `;

    this.container.appendChild(el);

    const popup: ActivePopup = {
      id,
      shipId,
      element: el,
      startTime: performance.now(),
      durationMs: options.durationMs || 2400,
      lastWorldPos: new THREE.Vector3(),
    };

    this.popups.set(id, popup);
    this.shipToPopupId.set(shipId, id);
  }

  /**
   * Updates screen positions and floating animations of all active popups.
   */
  public update(
    ships: Map<string, ShipInstance>,
    terrain: AegeanTerrain,
    camera: THREE.Camera
  ): void {
    // Suppress popups entirely when any modal dialog is active
    const isModalOpen = typeof document !== 'undefined' && !!document.querySelector('.modal-overlay:not(.closed)');
    if (isModalOpen) {
      if (this.container.style.display !== 'none') {
        this.container.style.display = 'none';
      }
      return;
    } else if (this.container.style.display === 'none') {
      this.container.style.display = '';
    }

    const now = performance.now();
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    for (const [id, popup] of this.popups.entries()) {
      const elapsed = now - popup.startTime;
      const progress = elapsed / popup.durationMs;

      if (progress >= 1.0) {
        popup.element.remove();
        this.popups.delete(id);
        if (this.shipToPopupId.get(popup.shipId) === id) {
          this.shipToPopupId.delete(popup.shipId);
        }
        continue;
      }

      // Find current ship position
      const ship = ships.get(popup.shipId);
      if (ship) {
        const wp = terrain.lonLatToWorld(ship.position.lon, ship.position.lat);
        popup.lastWorldPos.copy(wp);
      }

      // Position anchor directly above the boat's mast
      this.tempVec.copy(popup.lastWorldPos);
      this.tempVec.y += 0.32;

      // Project 3D world position to 2D screen coordinate
      this.tempVec.project(camera);

      // Frustum culling (if behind camera or outside visible frustum)
      if (this.tempVec.z > 1.0 || this.tempVec.z < -1.0) {
        popup.element.style.display = 'none';
        continue;
      }

      popup.element.style.display = 'inline-flex';

      const screenX = this.tempVec.x * halfW + halfW;
      const screenY = -this.tempVec.y * halfH + halfH;

      // Gentle upward drift (~24px)
      const floatOffsetY = 20.0 + progress * 24.0;
      const curY = screenY - floatOffsetY;

      // Smooth scale-in and fade-out
      let scale = 1.0;
      if (progress < 0.12) {
        scale = 0.6 + (progress / 0.12) * 0.4;
      }

      let opacity = 1.0;
      if (progress > 0.65) {
        opacity = Math.max(0, (1.0 - progress) / 0.35);
      }

      popup.element.style.transform = `translate3d(${screenX}px, ${curY}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      popup.element.style.opacity = opacity.toFixed(3);
    }
  }

  public clear(): void {
    for (const popup of this.popups.values()) {
      popup.element.remove();
    }
    this.popups.clear();
    this.shipToPopupId.clear();
  }
}
