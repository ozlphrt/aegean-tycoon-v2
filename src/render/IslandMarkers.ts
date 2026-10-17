import * as THREE from 'three';
import type { IslandData, IslandEconomyState } from '../data/types';
import {
  getProsperityThreeColor,
  getProsperityHex,
  formatProsperityExact,
} from './prosperityPalette';
import { getIslandName } from '../ui/i18n';

interface PinItem {
  pin: THREE.Mesh;
  innerRing: THREE.Mesh;
  outerRing: THREE.Mesh;
  group: THREE.Group;
  isLit: boolean;
  tier: number;
  islandId: string;
  maskId: number;
  status?: 'distressed' | 'booming' | 'stable' | 'struggling';
  customMat?: THREE.MeshStandardMaterial;
  innerMat?: THREE.MeshBasicMaterial;
  outerMat?: THREE.MeshBasicMaterial;
}

/**
 * Creates the classic teardrop 3D map drop-pin geometry:
 * - Sharp bottom tip sitting at (0, 0, 0)
 * - Tapered conical body widening into a circular top bulb
 * - Circular cutout hole in the center (donut ring)
 * - Beveled rounded edges for realistic specular highlights
 */
function createDropPinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const Cy = 0.28; // Center of top circular bulb
  const R = 0.11;  // Radius of top bulb
  const alpha = Math.asin(R / Cy); // Tangent angle
  const tx = R * Math.cos(alpha);
  const ty = Cy - R * Math.sin(alpha);

  // Sharp tip touching ground at (0, 0)
  shape.moveTo(0, 0);
  shape.lineTo(tx, ty);
  // Arc around top bulb
  shape.absarc(0, Cy, R, -alpha, Math.PI + alpha, false);
  shape.lineTo(0, 0);

  // Inner circular hole cutout (donut ring)
  const holePath = new THREE.Path();
  holePath.absarc(0, Cy, 0.052, 0, Math.PI * 2, true);
  shape.holes.push(holePath);

  const extrudeSettings = {
    depth: 0.024,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along Z axis so the tip remains exactly at (0, 0, 0)
  geo.translate(0, 0, -extrudeSettings.depth / 2);
  geo.computeVertexNormals();
  return geo;
}

export class IslandMarkers {
  public group = new THREE.Group();
  public islands: IslandData[] = [];
  private labelElements: Map<string, HTMLElement> = new Map();
  private islandPeaks: Map<string, THREE.Vector3> = new Map();
  private pinItems: PinItem[] = [];
  private container: HTMLElement;
  private litIslandIds: Set<string> = new Set(['santorini']);
  public selectedIslandId: string | null = null;
  private islandEconomies: Map<string, IslandEconomyState> = new Map();

  private activePinMat!: THREE.MeshStandardMaterial;
  private activeInnerRingMat!: THREE.MeshBasicMaterial;
  private activeOuterRingMat!: THREE.MeshBasicMaterial;
  private lockedPinMat!: THREE.MeshStandardMaterial;
  private lockedInnerRingMat!: THREE.MeshBasicMaterial;
  private lockedOuterRingMat!: THREE.MeshBasicMaterial;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private lonLatToWorld: (lon: number, lat: number) => THREE.Vector3,
    private onIslandSelect?: (island: IslandData) => void,
    private getPeakWorld?: (lon: number, lat: number) => THREE.Vector3
  ) {
    this.scene.add(this.group);

    // Create a container for screen-space labels
    let labelsDiv = document.getElementById('island-labels-container');
    if (!labelsDiv) {
      labelsDiv = document.createElement('div');
      labelsDiv.id = 'island-labels-container';
      labelsDiv.style.position = 'absolute';
      labelsDiv.style.top = '0';
      labelsDiv.style.left = '0';
      labelsDiv.style.width = '100%';
      labelsDiv.style.height = '100%';
      labelsDiv.style.pointerEvents = 'none';
      labelsDiv.style.zIndex = '5';
      document.body.appendChild(labelsDiv);
    }
    this.container = labelsDiv;

    this.init();
  }

  private async init() {
    try {
      const resp = await fetch('/data/islands.json');
      this.islands = await resp.json();

      // Shared map pin geometry
      const pinGeo = createDropPinGeometry();

      // Concentric ground ripples lying flat on terrain at tip
      const innerRingGeo = new THREE.RingGeometry(0.065, 0.088, 32);
      innerRingGeo.rotateX(-Math.PI / 2);

      const outerRingGeo = new THREE.RingGeometry(0.115, 0.142, 32);
      outerRingGeo.rotateX(-Math.PI / 2);

      // Active / connected ports: sleek vivid crimson lacquer (fallback/default)
      this.activePinMat = new THREE.MeshStandardMaterial({
        color: 0xdf2236,
        roughness: 0.22,
        metalness: 0.55,
        emissive: 0x5a000d,
        emissiveIntensity: 0.25,
      });

      this.activeInnerRingMat = new THREE.MeshBasicMaterial({
        color: 0xff3b4e,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });

      this.activeOuterRingMat = new THREE.MeshBasicMaterial({
        color: 0xff4f60,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });

      // Locked / awaiting connection ports: sleek graphite / slate
      this.lockedPinMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.45,
        metalness: 0.65,
      });

      this.lockedInnerRingMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });

      this.lockedOuterRingMat = new THREE.MeshBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });

      this.islands.forEach((isl) => {
        const tier = isl.tier ?? 2;
        // Santorini starts illuminated; other islands await inaugural deliveries
        const isStart = isl.id === 'santorini';
        if (isStart) {
          this.litIslandIds.add(isl.id);
        }

        // 1. Calculate & cache highest mountain peak 3D coordinate for label placement
        const pLon = isl.peak?.lon ?? isl.lon;
        const pLat = isl.peak?.lat ?? isl.lat;
        const peakWorld = this.getPeakWorld
          ? this.getPeakWorld(pLon, pLat)
          : this.lonLatToWorld(pLon, pLat);
        this.islandPeaks.set(isl.id, peakWorld);

        // 2. Summit Drop-Pins (positioned directly at the highest peak of the island)
        const markerGroup = new THREE.Group();
        markerGroup.position.set(peakWorld.x, peakWorld.y, peakWorld.z);

        const pin = new THREE.Mesh(pinGeo, isStart ? this.activePinMat : this.lockedPinMat);

        const innerRing = new THREE.Mesh(innerRingGeo, isStart ? this.activeInnerRingMat : this.lockedInnerRingMat);
        innerRing.position.y = 0.003;

        const outerRing = new THREE.Mesh(outerRingGeo, isStart ? this.activeOuterRingMat : this.lockedOuterRingMat);
        outerRing.position.y = 0.002;

        markerGroup.add(innerRing);
        markerGroup.add(outerRing);
        markerGroup.add(pin);

        markerGroup.userData = { islandId: isl.id, islandData: isl };
        this.group.add(markerGroup);

        this.pinItems.push({
          pin,
          innerRing,
          outerRing,
          group: markerGroup,
          isLit: isStart,
          tier,
          islandId: isl.id,
          maskId: isl.maskId,
        });

        // 3. Screen-Space Island Name Label with Live Status Pip
        const label = document.createElement('div');
        label.className = `island-label tier-${tier} ${isStart ? 'active-island status-stable' : 'locked-island'}`;
        label.id = `label-${isl.id}`;
        label.innerHTML = `<span class="island-status-dot"></span><span class="label-text">${getIslandName(isl.id, isl.name)}</span>`;
        label.style.position = 'absolute';
        label.style.transform = 'translate(-50%, -100%)';
        label.style.pointerEvents = 'auto';
        label.style.cursor = 'pointer';

        label.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setSelectedIsland(isl.id);
          if (this.onIslandSelect) {
            this.onIslandSelect(isl);
          }
        });

        this.container.appendChild(label);
        this.labelElements.set(isl.id, label);
      });

    } catch (err) {
      console.error('Failed loading islands in IslandMarkers:', err);
    }
  }

  /**
   * Raycasts against 3D island summit pins and rings.
   */
  public getIslandAtRay(raycaster: THREE.Raycaster): IslandData | null {
    const visibleObjects: THREE.Object3D[] = [];
    for (const item of this.pinItems) {
      if (item.group.visible) {
        visibleObjects.push(item.pin, item.innerRing, item.outerRing);
      }
    }
    const hits = raycaster.intersectObjects(visibleObjects, false);
    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const item = this.pinItems.find(
        (p) => p.pin === hitObj || p.innerRing === hitObj || p.outerRing === hitObj
      );
      if (item) {
        return this.islands.find((i) => i.id === item.islandId) || null;
      }
    }

    // Fallback when zoomed out / at a distance where 3D summit pins are culled:
    // Check distance from click ray to island peak locations and ground plane intersection
    let closestIsland: IslandData | null = null;
    let closestDist = Infinity;
    const maxClickDistance = 3.6; // World units around island center

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundHit = new THREE.Vector3();
    const hasGroundHit = raycaster.ray.intersectPlane(groundPlane, groundHit) !== null;

    for (const isl of this.islands) {
      const peakPos = this.islandPeaks.get(isl.id);
      if (!peakPos) continue;

      // 1. Perpendicular distance from ray to summit peak
      const rayDist = raycaster.ray.distanceToPoint(peakPos);

      // 2. 2D Euclidean distance on map plane between ground click point and island peak
      let groundDist = Infinity;
      if (hasGroundHit) {
        groundDist = Math.hypot(groundHit.x - peakPos.x, groundHit.z - peakPos.z);
      }

      const minDist = Math.min(rayDist, groundDist);
      if (minDist < maxClickDistance && minDist < closestDist) {
        closestDist = minDist;
        closestIsland = isl;
      }
    }

    return closestIsland;
  }

  public setIslandLit(islandId: string | number, isLit: boolean) {
    const idStr =
      typeof islandId === 'string'
        ? islandId
        : this.islands.find((i) => i.maskId === islandId)?.id;

    if (idStr) {
      if (isLit) {
        this.litIslandIds.add(idStr);
      } else {
        this.litIslandIds.delete(idStr);
      }
      this.refreshIslandAppearance(idStr);
    }
  }

  public setSelectedIsland(islandId: string | null) {
    const prev = this.selectedIslandId;
    this.selectedIslandId = islandId;
    if (prev) this.refreshIslandAppearance(prev);
    if (islandId) this.refreshIslandAppearance(islandId);
  }

  /**
   * Updates dynamic economic data for islands (prosperity, supply shortages, distress).
   * Refreshes label border/glow/dot colors and 3D summit pin materials accordingly.
   */
  public updateEconomies(
    economies: Record<string, IslandEconomyState> | Map<string, IslandEconomyState>
  ): void {
    const entries =
      economies instanceof Map ? economies.entries() : Object.entries(economies);
    for (const [id, eco] of entries) {
      this.islandEconomies.set(id, eco);
      this.refreshIslandAppearance(id);
    }
  }

  public refreshLabels(): void {
    for (const isl of this.islands) {
      this.refreshIslandAppearance(isl.id);
    }
  }

  private refreshIslandAppearance(islandId: string) {
    const isLit = this.litIslandIds.has(islandId);
    const label = this.labelElements.get(islandId);
    const pinItem = this.pinItems.find((p) => p.islandId === islandId);
    const eco = this.islandEconomies.get(islandId);
    const isl = this.islands.find((i) => i.id === islandId);

    if (!label) return;

    const tier = isl?.tier ?? 2;
    const isSelected = this.selectedIslandId === islandId;

    if (!isLit) {
      label.className = `island-label tier-${tier} locked-island ${isSelected ? 'selected-island' : ''}`;
      const islandName = getIslandName(islandId, isl?.name || islandId);
      label.setAttribute('data-tooltip-title', islandName);
      label.setAttribute('data-tooltip-body', 'Awaiting Awakening in Daylight • Send ships to explore or establish trade routes');
      label.setAttribute('data-tooltip-severity', 'info');
      label.setAttribute('data-tooltip-badge', 'UNEXPLORED');
      label.setAttribute('data-tooltip-icon', '🌫️');
      label.removeAttribute('title');
      label.innerHTML = `<span class="island-status-dot"></span><span class="label-text">${islandName}</span>`;
      if (pinItem) {
        pinItem.isLit = false;
        pinItem.status = undefined;
        pinItem.pin.material = this.lockedPinMat;
        pinItem.innerRing.material = this.lockedInnerRingMat;
        pinItem.outerRing.material = this.lockedOuterRingMat;
      }
      return;
    }

    // Lit / Connected Island: evaluate prosperity and supply health
    let status: 'distressed' | 'booming' | 'stable' | 'struggling' = 'stable';
    let statusDesc = 'Stable Aegean Port';

    if (eco) {
      // Collect any depleted goods for informative tooltips without overriding macro prosperity status
      const starvingGoods: string[] = [];
      for (const [goodId, market] of Object.entries(eco.markets || {})) {
        if (market.consumeRatePerDay > 0) {
          if (market.isStarving || market.stock < market.consumeRatePerDay * 0.75) {
            const goodName = goodId.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            starvingGoods.push(goodName);
          }
        }
      }

      // True systemic distress: distress > 25% or distress > 15% with collapsing prosperity (< 50%)
      const isSevereDistress = eco.distress > 0.25 || (eco.distress > 0.15 && eco.prosperity < 0.50);

      if (isSevereDistress) {
        status = 'distressed';
        statusDesc =
          starvingGoods.length > 0
            ? `⚠️ Critical Shortage: Depleted ${starvingGoods.join(', ')}!`
            : `⚠️ Distress Alert: Supplies Depleted (${Math.round(eco.distress * 100)}% distress)`;
      } else if (eco.prosperity >= 0.7) {
        status = 'booming';
        const shortageNote = starvingGoods.length > 0 ? ` • Low on ${starvingGoods.slice(0, 2).join(', ')}` : '';
        statusDesc = `✨ Booming Prosperity (${Math.round(eco.prosperity * 100)}%)${shortageNote}`;
      } else if (eco.prosperity >= 0.4) {
        status = 'stable';
        const shortageNote = starvingGoods.length > 0 ? ` • Low on ${starvingGoods.slice(0, 2).join(', ')}` : '';
        statusDesc = `⚓ Stable Daylight Port (${Math.round(eco.prosperity * 100)}%)${shortageNote}`;
      } else {
        status = 'struggling';
        const shortageNote = starvingGoods.length > 0 ? ` • Low on ${starvingGoods.slice(0, 2).join(', ')}` : '';
        statusDesc = `📉 Low Supplies (${Math.round(eco.prosperity * 100)}% prosperity)${shortageNote}`;
      }
    }

    const prosperity = Math.max(0, Math.min(1, eco?.prosperity ?? 0.5));
    const prospExactPct = formatProsperityExact(prosperity);
    const pHex = getProsperityHex(prosperity);
    const pColor = getProsperityThreeColor(prosperity);
    const islandName = getIslandName(islandId, isl?.name || islandId);

    label.className = `island-label tier-${tier} active-island status-${status} ${isSelected ? 'selected-island' : ''}`;
    label.style.borderColor = pHex;
    label.setAttribute('data-tooltip-title', islandName);
    label.setAttribute('data-tooltip-body', statusDesc);
    label.setAttribute('data-tooltip-hint', 'Click island to inspect trade & harbor berth');

    if (status === 'distressed') {
      const distPct = Math.round((eco?.distress ?? 0.75) * 100);
      label.setAttribute('data-tooltip-severity', 'warning');
      label.setAttribute('data-tooltip-badge', `⚠️ ${distPct}% DISTRESS`);
      label.setAttribute('data-tooltip-icon', '🚨');
    } else if (status === 'booming') {
      label.setAttribute('data-tooltip-severity', 'gold');
      label.setAttribute('data-tooltip-badge', `✨ ${prospExactPct} PROSPERITY`);
      label.setAttribute('data-tooltip-icon', '🏛️');
    } else if (status === 'struggling') {
      label.setAttribute('data-tooltip-severity', 'medium');
      label.setAttribute('data-tooltip-badge', `📉 ${prospExactPct} PROSPERITY`);
      label.setAttribute('data-tooltip-icon', '⚓');
    } else {
      label.setAttribute('data-tooltip-severity', 'info');
      label.setAttribute('data-tooltip-badge', `⚓ ${prospExactPct} PROSPERITY`);
      label.setAttribute('data-tooltip-icon', '🏝️');
    }
    label.removeAttribute('title');

    label.innerHTML = `
      <span class="island-status-dot" style="background-color: ${pHex}; box-shadow: 0 0 8px ${pHex};"></span>
      <span class="label-text">${islandName}</span>
    `;

    if (pinItem) {
      pinItem.isLit = true;
      pinItem.status = status;
      this.updatePinProsperityColor(pinItem, pColor);
    }
  }

  private updatePinProsperityColor(pinItem: PinItem, color: THREE.Color) {
    if (!pinItem.customMat || !pinItem.innerMat || !pinItem.outerMat) {
      pinItem.customMat = new THREE.MeshStandardMaterial({
        color: color.clone(),
        roughness: 0.22,
        metalness: 0.50,
        emissive: color.clone().multiplyScalar(0.35),
        emissiveIntensity: 0.45,
      });
      pinItem.innerMat = new THREE.MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      pinItem.outerMat = new THREE.MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      pinItem.pin.material = pinItem.customMat;
      pinItem.innerRing.material = pinItem.innerMat;
      pinItem.outerRing.material = pinItem.outerMat;
    } else {
      pinItem.customMat.color.copy(color);
      pinItem.customMat.emissive.copy(color).multiplyScalar(0.35);
      pinItem.innerMat.color.copy(color);
      pinItem.outerMat.color.copy(color);
      pinItem.pin.material = pinItem.customMat;
      pinItem.innerRing.material = pinItem.innerMat;
      pinItem.outerRing.material = pinItem.outerMat;
    }
  }

  public update(time: number) {
    const isModalOpen = typeof document !== 'undefined' && !!document.querySelector('.modal-overlay:not(.closed)');
    if (this.container) {
      if (isModalOpen) {
        if (this.container.style.display !== 'none') {
          this.container.style.display = 'none';
        }
      } else if (this.container.style.display === 'none') {
        this.container.style.display = '';
      }
    }

    const cam = this.camera.position;
    const camY = cam.y;
    const camRotY = this.camera.rotation.y;

    const fovFactor = 2.0 * Math.tan((this.camera.fov * Math.PI) / 360);

    // 1. Billboard summit pins to face camera smoothly around Y axis with auto-scaling to match label
    for (let i = 0; i < this.pinItems.length; i++) {
      const item = this.pinItems[i];
      const isSelected = this.selectedIslandId === item.islandId;

      if (!item.isLit && !isSelected) {
        if (item.group.visible) item.group.visible = false;
        continue;
      }

      const distToCam = cam.distanceTo(item.group.position);

      // Distance-based culling for pins:
      // When viewing from afar (macro/regional overview), hide pins!
      // Only show pins when zooming in close to the island, or for the currently selected island.
      const altitudeFactor = THREE.MathUtils.clamp((14.5 - camY) / 4.5, 0, 1);
      const distanceFactor = THREE.MathUtils.clamp((17.5 - distToCam) / 5.5, 0, 1);
      const closeFactor = isSelected ? 1.0 : Math.min(altitudeFactor, distanceFactor);

      if (closeFactor <= 0.05) {
        if (item.group.visible) item.group.visible = false;
        continue;
      }

      if (!item.group.visible) item.group.visible = true;
      item.pin.rotation.y = camRotY;

      // Pulse for active ports / peaks (special gold radiant pulse for selected island)
      if (isSelected) {
        const pulse = 1.0 + Math.sin(time * 3.6) * 0.18;
        item.outerRing.scale.set(pulse * 1.35, pulse * 1.35, pulse * 1.35);
        item.innerRing.scale.set(pulse * 1.18, pulse * 1.18, pulse * 1.18);
      } else {
        const isDistressed = item.status === 'distressed';
        const freq = isDistressed ? 5.2 : 2.5;
        const amp = isDistressed ? 0.14 : 0.07;
        const pulse = 1.0 + Math.sin(time * freq) * amp;
        item.outerRing.scale.set(pulse, pulse, pulse);
        item.innerRing.scale.set(1.0, 1.0, 1.0);
      }

      // Auto-scale 3D marker so it maintains consistent screen size matching the label, scaling in smoothly
      const pixelToWorld = (distToCam * fovFactor) / window.innerHeight;
      const targetPinPixelHeight = isSelected ? 36.0 : 30.0; // 36px visual height when selected
      const basePinWorldHeight = 0.39;
      const autoScale = ((targetPinPixelHeight * pixelToWorld) / basePinWorldHeight) * Math.min(1.0, closeFactor * 1.25);
      item.group.scale.set(autoScale, autoScale, autoScale);
    }

    // 2. Project highest peak 3D coordinates to 2D screen positions with strict Zoom LOD
    const tempVec = new THREE.Vector3();
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    interface CandidateLabel {
      isl: IslandData;
      el: HTMLElement;
      screenX: number;
      screenY: number;
      width: number;
      height: number;
      alpha: number;
      priority: number;
    }

    const candidates: CandidateLabel[] = [];

    for (const isl of this.islands) {
      const el = this.labelElements.get(isl.id);
      if (!el) continue;

      const peakPos = this.islandPeaks.get(isl.id);
      if (!peakPos) continue;

      const tier = isl.tier ?? 2;
      const isLit = this.litIslandIds.has(isl.id);
      const isSelected = this.selectedIslandId === isl.id;
      const distToCam = cam.distanceTo(peakPos);

      // Level of Detail (LOD) visibility and opacity computation:
      // - Selected island: always visible (priority 10000, alpha 1.0)
      // - Lit active network islands: only visible when zooming closer to the island (camY <= 15.5, distToCam <= 19.0)
      // - Locked Tier 1 hubs: visible only when zoomed close (camY <= 14.0, dist <= 17.0)
      // - Locked Tier 2 & 3: visible only on immediate close inspection (camY <= 12.5 / 10.5)
      let alpha = 0.0;
      let priority = 0;

      if (isSelected) {
        alpha = 1.0;
        priority = 10000;
      } else if (isLit) {
        // Lit active islands: only show marker label when zoomed in closer to the island
        const aH = THREE.MathUtils.clamp((15.5 - camY) / 4.5, 0, 1);
        const aD = THREE.MathUtils.clamp((19.0 - distToCam) / 6.0, 0, 1);
        alpha = Math.min(aH, aD);
        priority = 5000 + (100 - distToCam);
      } else if (tier === 1) {
        const aH = THREE.MathUtils.clamp((14.0 - camY) / 4.0, 0, 1);
        const aD = THREE.MathUtils.clamp((17.0 - distToCam) / 5.0, 0, 1);
        alpha = Math.min(aH, aD);
        priority = 1000 - distToCam;
      } else if (tier === 2) {
        const aH = THREE.MathUtils.clamp((12.5 - camY) / 3.5, 0, 1);
        const aD = THREE.MathUtils.clamp((15.0 - distToCam) / 4.5, 0, 1);
        alpha = Math.min(aH, aD);
        priority = 500 - distToCam;
      } else {
        const aH = THREE.MathUtils.clamp((10.5 - camY) / 3.0, 0, 1);
        const aD = THREE.MathUtils.clamp((12.5 - distToCam) / 3.5, 0, 1);
        alpha = Math.min(aH, aD);
        priority = 100 - distToCam;
      }

      if (alpha <= 0.02) {
        el.style.display = 'none';
        continue;
      }

      // Position label directly above the summit peak pin if active/visible, or directly above peak if inactive
      const pixelToWorld = (distToCam * fovFactor) / window.innerHeight;
      const labelWorldOffset = (isSelected ? 36.0 : (isLit ? 30.0 : 14.0)) * pixelToWorld;
      tempVec.set(peakPos.x, peakPos.y + labelWorldOffset, peakPos.z);
      tempVec.project(this.camera);

      // Frustum culling check (in front of camera and within viewport bounds)
      if (
        tempVec.z < 1.0 &&
        tempVec.x >= -1.06 &&
        tempVec.x <= 1.06 &&
        tempVec.y >= -1.06 &&
        tempVec.y <= 1.06
      ) {
        const screenX = tempVec.x * halfW + halfW;
        const screenY = -tempVec.y * halfH + halfH;

        // Compact bounding box with only glowing status dot, island name, and tight padding
        const boxWidth = Math.max(46, isl.name.length * 7.5 + 20) + 8;
        const boxHeight = 22 + 4;

        candidates.push({
          isl,
          el,
          screenX,
          screenY,
          width: boxWidth,
          height: boxHeight,
          alpha,
          priority,
        });
      } else {
        el.style.display = 'none';
      }
    }

    // 3. Screen-Space Collision Detection & De-cluttering
    // Sort candidates by priority descending so high-priority labels claim screen space first
    candidates.sort((a, b) => b.priority - a.priority);

    interface BoundingBox {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }

    const acceptedBoxes: BoundingBox[] = [];

    for (const cand of candidates) {
      const halfBoxW = cand.width / 2;
      const candBox: BoundingBox = {
        left: cand.screenX - halfBoxW,
        right: cand.screenX + halfBoxW,
        top: cand.screenY - cand.height,
        bottom: cand.screenY,
      };

      // Check collision with already accepted higher-priority labels
      let collides = false;
      for (const box of acceptedBoxes) {
        if (
          candBox.left < box.right &&
          candBox.right > box.left &&
          candBox.top < box.bottom &&
          candBox.bottom > box.top
        ) {
          collides = true;
          break;
        }
      }

      // Always show selected island; for other islands, cull if colliding with a higher-priority label
      const isSelected = this.selectedIslandId === cand.isl.id;
      if (!collides || isSelected) {
        acceptedBoxes.push(candBox);
        cand.el.style.display = 'flex';
        cand.el.style.left = `${cand.screenX}px`;
        cand.el.style.top = `${cand.screenY}px`;
        cand.el.style.opacity = isSelected ? '1' : cand.alpha.toFixed(2);
      } else {
        cand.el.style.display = 'none';
      }
    }
  }

  public setLabelsVisible(visible: boolean) {
    this.container.style.display = visible ? 'block' : 'none';
  }
}
