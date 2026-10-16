import * as THREE from 'three';
import type { IslandData } from '../data/types';

interface PinItem {
  pin: THREE.Mesh;
  innerRing: THREE.Mesh;
  outerRing: THREE.Mesh;
  group: THREE.Group;
  isStart: boolean;
  tier: number;
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

      // Active / connected ports: sleek vivid crimson lacquer
      const activePinMat = new THREE.MeshStandardMaterial({
        color: 0xdf2236,
        roughness: 0.22,
        metalness: 0.55,
        emissive: 0x5a000d,
        emissiveIntensity: 0.25,
      });

      const activeInnerRingMat = new THREE.MeshBasicMaterial({
        color: 0xff3b4e,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });

      const activeOuterRingMat = new THREE.MeshBasicMaterial({
        color: 0xff4f60,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });

      // Locked / awaiting connection ports: sleek graphite / slate
      const lockedPinMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.45,
        metalness: 0.65,
      });

      const lockedInnerRingMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.50,
        side: THREE.DoubleSide,
      });

      const lockedOuterRingMat = new THREE.MeshBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });

      this.islands.forEach((isl) => {
        const tier = isl.tier ?? 2;

        // 1. Calculate & cache highest mountain peak 3D coordinate for label placement
        const pLon = isl.peak?.lon ?? isl.lon;
        const pLat = isl.peak?.lat ?? isl.lat;
        const peakWorld = this.getPeakWorld
          ? this.getPeakWorld(pLon, pLat)
          : this.lonLatToWorld(pLon, pLat);
        this.islandPeaks.set(isl.id, peakWorld);

        // 2. Trading Port Drop-Pins (for ports on Tier 1 & 2 islands, or start hubs)
        const isStart = !!isl.unlock?.isStart;
        const hasPort = !!isl.port && (tier <= 2 || isStart);

        if (hasPort) {
          const portPos = this.lonLatToWorld(isl.port.lon, isl.port.lat);
          const markerGroup = new THREE.Group();
          markerGroup.position.set(portPos.x, portPos.y, portPos.z);

          const pin = new THREE.Mesh(pinGeo, isStart ? activePinMat : lockedPinMat);

          const innerRing = new THREE.Mesh(innerRingGeo, isStart ? activeInnerRingMat : lockedInnerRingMat);
          innerRing.position.y = 0.003;

          const outerRing = new THREE.Mesh(outerRingGeo, isStart ? activeOuterRingMat : lockedOuterRingMat);
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
            isStart,
            tier,
          });
        }

        // 3. Screen-Space Island Name Label (positioned at highest mountain peak)
        const label = document.createElement('div');
        label.className = `island-label tier-${tier} ${isStart ? 'active-island' : 'locked-island'}`;
        label.id = `label-${isl.id}`;
        label.innerHTML = `<span class="label-text">${isl.name}</span>`;
        label.style.position = 'absolute';
        label.style.transform = 'translate(-50%, -100%)';
        label.style.pointerEvents = 'auto';
        label.style.cursor = 'pointer';

        label.addEventListener('click', (e) => {
          e.stopPropagation();
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

  public update(time: number) {
    const cam = this.camera.position;
    const camY = cam.y;
    const camRotY = this.camera.rotation.y;

    // 1. Billboard port pins to face camera smoothly around Y axis
    this.pinItems.forEach(({ pin, outerRing, group, isStart, tier }) => {
      pin.rotation.y = camRotY;

      // Pulse for active ports
      if (isStart) {
        const pulse = 1.0 + Math.sin(time * 2.8) * 0.07;
        outerRing.scale.set(pulse, pulse, pulse);
      }

      // Hide or show pins based on zoom tier
      if (tier >= 3) {
        group.visible = camY < 42;
      } else if (tier === 2) {
        group.visible = isStart || camY < 78;
      } else {
        group.visible = true;
      }
    });

    // 2. Project highest peak 3D coordinates to 2D screen positions with Zoom LOD
    const tempVec = new THREE.Vector3();
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    this.islands.forEach((isl) => {
      const el = this.labelElements.get(isl.id);
      if (!el) return;

      const peakPos = this.islandPeaks.get(isl.id);
      if (!peakPos) return;

      const tier = isl.tier ?? 2;
      const distToCam = cam.distanceTo(peakPos);

      // Zoom-dependent Level of Detail (LOD)
      // Tier 1 (major hubs): always visible
      // Tier 2 (medium islands): fades in as zoom gets closer (camY < 74 or dist < 65)
      // Tier 3 (tiny islands/islets): fades in as zoom gets close (camY < 44 or dist < 34)
      let alpha = 1.0;
      if (tier === 2) {
        const alphaHeight = THREE.MathUtils.clamp((74 - camY) / 14, 0, 1);
        const alphaDist = THREE.MathUtils.clamp((65 - distToCam) / 16, 0, 1);
        alpha = Math.max(alphaHeight, alphaDist);
      } else if (tier >= 3) {
        const alphaHeight = THREE.MathUtils.clamp((44 - camY) / 12, 0, 1);
        const alphaDist = THREE.MathUtils.clamp((34 - distToCam) / 12, 0, 1);
        alpha = Math.max(alphaHeight, alphaDist);
      }

      if (alpha <= 0.01) {
        el.style.display = 'none';
        return;
      }

      // Position label directly above the summit peak (+0.16 world units above peak)
      tempVec.set(peakPos.x, peakPos.y + 0.16, peakPos.z);
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
        el.style.display = 'flex';
        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
        el.style.opacity = alpha.toFixed(2);
      } else {
        el.style.display = 'none';
      }
    });
  }

  public setLabelsVisible(visible: boolean) {
    this.container.style.display = visible ? 'block' : 'none';
  }
}
