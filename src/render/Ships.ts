import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShipInstance } from '../sim/shipSim';
import type { AegeanTerrain } from './Terrain';
import { BoatWakeRenderer } from './BoatWake';

interface ShipVisualState {
  yaw: number;
  turnRate: number;
  avoidOffset: number;
  steerAngle: number;
  prevX?: number;
  prevZ?: number;
}

export interface ShipVisualProfile {
  bowOffset: number;    // Distance from center to stem along -Z
  sternOffset: number;  // Distance from center to stern along +Z
  beam: number;         // Width in world units
  baseScale: number;    // Visual scaling multiplier
}

export interface ShipTierDefinition {
  typeId: string;
  name: string;
  tier: number;
  profile: ShipVisualProfile;
  mesh: THREE.InstancedMesh;
  meshes: THREE.InstancedMesh[];
  shipIdList: string[];
}

/**
 * Utility: Merges multiple BufferGeometries with vertex colors into a single BufferGeometry.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  for (const g of geometries) totalVerts += g.attributes.position.count;

  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNorm = new Float32Array(totalVerts * 3);
  const mergedCol = new Float32Array(totalVerts * 3);

  let offset = 0;
  for (const g of geometries) {
    const p = g.attributes.position;
    const n = g.attributes.normal || p;
    const c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      mergedPos[(offset + i) * 3 + 0] = p.getX(i);
      mergedPos[(offset + i) * 3 + 1] = p.getY(i);
      mergedPos[(offset + i) * 3 + 2] = p.getZ(i);

      if (n) {
        mergedNorm[(offset + i) * 3 + 0] = n.getX(i);
        mergedNorm[(offset + i) * 3 + 1] = n.getY(i);
        mergedNorm[(offset + i) * 3 + 2] = n.getZ(i);
      } else {
        mergedNorm[(offset + i) * 3 + 1] = 1.0;
      }

      if (c) {
        mergedCol[(offset + i) * 3 + 0] = c.getX(i);
        mergedCol[(offset + i) * 3 + 1] = c.getY(i);
        mergedCol[(offset + i) * 3 + 2] = c.getZ(i);
      } else {
        mergedCol[(offset + i) * 3 + 0] = 1.0;
        mergedCol[(offset + i) * 3 + 1] = 1.0;
        mergedCol[(offset + i) * 3 + 2] = 1.0;
      }
    }
    offset += p.count;
    g.dispose();
  }

  const mergedGeo = new THREE.BufferGeometry();
  mergedGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  mergedGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  mergedGeo.setAttribute('color', new THREE.BufferAttribute(mergedCol, 3));
  return mergedGeo;
}

/**
 * Utility: Fills geometry vertex color attribute with solid RGB.
 */
function applyColor(geo: THREE.BufferGeometry, r: number, g: number, b: number): void {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3 + 0] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Tier 1: Traditional Kaiki (Fishing Boat)
 * Classic flared wooden hull, white wheelhouse, Cycladic blue roof, mast, cargo crates, bowsprit.
 */
function createKaikiGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Wooden Hull
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -0.32);
  hullShape.bezierCurveTo(0.13, -0.22, 0.14, 0.10, 0.11, 0.28);
  hullShape.lineTo(-0.11, 0.28);
  hullShape.bezierCurveTo(-0.14, 0.10, -0.13, -0.22, 0, -0.32);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.06, 0);

  const hullPos = hullGeo.attributes.position;
  const hullColors = new Float32Array(hullPos.count * 3);
  for (let i = 0; i < hullPos.count; i++) {
    const y = hullPos.getY(i);
    const dark = y < 0.04 ? 0.75 : 1.0;
    hullColors[i * 3 + 0] = 0.62 * dark;
    hullColors[i * 3 + 1] = 0.44 * dark;
    hullColors[i * 3 + 2] = 0.28 * dark;
  }
  hullGeo.setAttribute('color', new THREE.BufferAttribute(hullColors, 3));
  geometries.push(hullGeo);

  // 2. White Wooden Wheelhouse (Cabin)
  const cabinGeo = new THREE.BoxGeometry(0.14, 0.11, 0.18);
  cabinGeo.translate(0, 0.12, 0.08);
  applyColor(cabinGeo, 0.94, 0.95, 0.97);
  geometries.push(cabinGeo);

  // 3. Cabin Roof (Cycladic blue)
  const roofGeo = new THREE.BoxGeometry(0.15, 0.02, 0.19);
  roofGeo.translate(0, 0.18, 0.08);
  applyColor(roofGeo, 0.12, 0.38, 0.72);
  geometries.push(roofGeo);

  // 4. Mast
  const mastGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.36, 6);
  mastGeo.translate(0, 0.22, -0.06);
  applyColor(mastGeo, 0.78, 0.65, 0.45);
  geometries.push(mastGeo);

  // 5. Cargo Crates on Forward Deck
  const crateGeo = new THREE.BoxGeometry(0.11, 0.07, 0.10);
  crateGeo.translate(0, 0.09, -0.15);
  applyColor(crateGeo, 0.72, 0.55, 0.35);
  geometries.push(crateGeo);

  // 6. Traditional Bowsprit (Bastoúni)
  const bowspritGeo = new THREE.CylinderGeometry(0.007, 0.012, 0.16, 5);
  bowspritGeo.rotateX(Math.PI / 2);
  bowspritGeo.translate(0, 0.11, -0.38);
  applyColor(bowspritGeo, 0.78, 0.65, 0.45);
  geometries.push(bowspritGeo);

  // 7. Stern Flagpole & Greek Maritime Pennant
  const flagPoleGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.14, 4);
  flagPoleGeo.translate(0, 0.20, 0.26);
  applyColor(flagPoleGeo, 0.70, 0.60, 0.40);
  geometries.push(flagPoleGeo);

  const pennantGeo = new THREE.BoxGeometry(0.01, 0.04, 0.07);
  pennantGeo.translate(0, 0.24, 0.29);
  applyColor(pennantGeo, 0.15, 0.45, 0.85);
  geometries.push(pennantGeo);

  // 8. Navigation Lights
  const stbGeo = new THREE.SphereGeometry(0.018, 5, 4);
  stbGeo.translate(0.09, 0.11, -0.04);
  applyColor(stbGeo, 0.1, 1.0, 0.3);
  geometries.push(stbGeo);

  const portGeo = new THREE.SphereGeometry(0.018, 5, 4);
  portGeo.translate(-0.09, 0.11, -0.04);
  applyColor(portGeo, 1.0, 0.15, 0.15);
  geometries.push(portGeo);

  const mastLightGeo = new THREE.SphereGeometry(0.022, 5, 4);
  mastLightGeo.translate(0, 0.40, -0.06);
  applyColor(mastLightGeo, 1.0, 0.95, 0.75);
  geometries.push(mastLightGeo);

  return mergeGeometries(geometries);
}

/**
 * Tier 2: Aegean Caique (Motorized Cargo Schooner / Trechandiri)
 * Larger timber cargo schooner with white topstrake, canvas cargo tarp, barrels, and twin masts.
 */
function createCaiqueGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Sturdy Wooden Hull with flared sheer
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -0.44); // Sharper pointed stem (-Z)
  hullShape.bezierCurveTo(0.18, -0.32, 0.20, 0.12, 0.15, 0.38); // Starboard curve
  hullShape.lineTo(-0.15, 0.38); // Rounded counter stern (+Z)
  hullShape.bezierCurveTo(-0.20, 0.12, -0.18, -0.32, 0, -0.44); // Port curve

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.07, 0);

  // Amber varnished timber with Aegean blue waterline
  const hullPos = hullGeo.attributes.position;
  const hullColors = new Float32Array(hullPos.count * 3);
  for (let i = 0; i < hullPos.count; i++) {
    const y = hullPos.getY(i);
    if (y < 0.04) {
      // Blue boot-topping waterline
      hullColors[i * 3 + 0] = 0.10;
      hullColors[i * 3 + 1] = 0.22;
      hullColors[i * 3 + 2] = 0.52;
    } else {
      // Rich amber varnished wood
      hullColors[i * 3 + 0] = 0.55;
      hullColors[i * 3 + 1] = 0.34;
      hullColors[i * 3 + 2] = 0.18;
    }
  }
  hullGeo.setAttribute('color', new THREE.BufferAttribute(hullColors, 3));
  geometries.push(hullGeo);

  // 2. White sheer strake bulwark line
  const bulwarkGeo = new THREE.BoxGeometry(0.35, 0.025, 0.65);
  bulwarkGeo.translate(0, 0.145, -0.02);
  applyColor(bulwarkGeo, 0.95, 0.96, 0.98);
  geometries.push(bulwarkGeo);

  // 3. Central Canvas Cargo Hold (Olive Tarp over sacks and crates)
  const cargoTarpGeo = new THREE.BoxGeometry(0.22, 0.08, 0.26);
  cargoTarpGeo.translate(0, 0.12, -0.04);
  applyColor(cargoTarpGeo, 0.28, 0.42, 0.22); // Olive drab canvas
  geometries.push(cargoTarpGeo);

  // 4. Wooden Cargo Barrels on Foredeck
  const barrel1 = new THREE.CylinderGeometry(0.028, 0.032, 0.07, 6);
  barrel1.translate(0.06, 0.11, -0.22);
  applyColor(barrel1, 0.48, 0.32, 0.16);
  geometries.push(barrel1);

  const barrel2 = new THREE.CylinderGeometry(0.028, 0.032, 0.07, 6);
  barrel2.translate(-0.06, 0.11, -0.22);
  applyColor(barrel2, 0.48, 0.32, 0.16);
  geometries.push(barrel2);

  // 5. Aft Wheelhouse with Brass Portlights
  const cabinGeo = new THREE.BoxGeometry(0.18, 0.12, 0.18);
  cabinGeo.translate(0, 0.14, 0.18);
  applyColor(cabinGeo, 0.92, 0.93, 0.95);
  geometries.push(cabinGeo);

  const roofGeo = new THREE.BoxGeometry(0.20, 0.02, 0.20);
  roofGeo.translate(0, 0.205, 0.18);
  applyColor(roofGeo, 0.14, 0.32, 0.62);
  geometries.push(roofGeo);

  // 6. Twin Wooden Masts: Foremast & Mainmast
  const foremast = new THREE.CylinderGeometry(0.012, 0.016, 0.38, 6);
  foremast.translate(0, 0.26, -0.16);
  applyColor(foremast, 0.72, 0.58, 0.38);
  geometries.push(foremast);

  const mainmast = new THREE.CylinderGeometry(0.014, 0.018, 0.48, 6);
  mainmast.translate(0, 0.31, 0.06);
  applyColor(mainmast, 0.72, 0.58, 0.38);
  geometries.push(mainmast);

  // Horizontal boom spar
  const sparGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 5);
  sparGeo.rotateX(Math.PI / 2);
  sparGeo.translate(0, 0.24, 0.16);
  applyColor(sparGeo, 0.68, 0.52, 0.32);
  geometries.push(sparGeo);

  // 7. Bowsprit & Aft Flag
  const bowspritGeo = new THREE.CylinderGeometry(0.008, 0.014, 0.20, 5);
  bowspritGeo.rotateX(Math.PI / 2);
  bowspritGeo.translate(0, 0.13, -0.52);
  applyColor(bowspritGeo, 0.72, 0.58, 0.38);
  geometries.push(bowspritGeo);

  const flagPole = new THREE.CylinderGeometry(0.006, 0.008, 0.15, 4);
  flagPole.translate(0, 0.23, 0.36);
  applyColor(flagPole, 0.65, 0.55, 0.35);
  geometries.push(flagPole);

  const pennant = new THREE.BoxGeometry(0.01, 0.045, 0.08);
  pennant.translate(0, 0.27, 0.39);
  applyColor(pennant, 0.15, 0.45, 0.85);
  geometries.push(pennant);

  // Navigation lights
  const stbGeo = new THREE.SphereGeometry(0.02, 5, 4);
  stbGeo.translate(0.13, 0.14, -0.10);
  applyColor(stbGeo, 0.1, 1.0, 0.3);
  geometries.push(stbGeo);

  const portGeo = new THREE.SphereGeometry(0.02, 5, 4);
  portGeo.translate(-0.13, 0.14, -0.10);
  applyColor(portGeo, 1.0, 0.15, 0.15);
  geometries.push(portGeo);

  return mergeGeometries(geometries);
}

/**
 * Tier 3: Island Passenger Ferry (High-Speed Ro-Ro Catamaran)
 * Sleek twin-hull catamaran, two-tier passenger observation deck, solar tinted windows, twin funnels.
 */
function createFerryGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Starboard Demi-Hull (Navy Blue)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -0.65); // Piercing wave bow
  hullShape.bezierCurveTo(0.08, -0.45, 0.09, 0.20, 0.07, 0.52);
  hullShape.lineTo(-0.07, 0.52);
  hullShape.bezierCurveTo(-0.09, 0.20, -0.08, -0.45, 0, -0.65);

  const stbHull = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  stbHull.rotateX(Math.PI / 2);
  stbHull.translate(0.16, 0.07, 0);
  applyColor(stbHull, 0.05, 0.18, 0.38); // Deep Aegean Navy
  geometries.push(stbHull);

  // 2. Port Demi-Hull (Navy Blue)
  const portHull = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  portHull.rotateX(Math.PI / 2);
  portHull.translate(-0.16, 0.07, 0);
  applyColor(portHull, 0.05, 0.18, 0.38);
  geometries.push(portHull);

  // 3. Central Tunnel Bridging Deck (Crisp White)
  const bridgeDeck = new THREE.BoxGeometry(0.38, 0.05, 0.95);
  bridgeDeck.translate(0, 0.14, -0.02);
  applyColor(bridgeDeck, 0.95, 0.96, 0.98);
  geometries.push(bridgeDeck);

  // 4. Main Passenger Saloon with Tinted Window Strips
  const salonGeo = new THREE.BoxGeometry(0.34, 0.10, 0.72);
  salonGeo.translate(0, 0.19, -0.02);
  applyColor(salonGeo, 0.94, 0.95, 0.97);
  geometries.push(salonGeo);

  // Tinted passenger windows band
  const windowsGeo = new THREE.BoxGeometry(0.355, 0.045, 0.62);
  windowsGeo.translate(0, 0.20, -0.02);
  applyColor(windowsGeo, 0.08, 0.14, 0.24); // Dark tinted solar glass
  geometries.push(windowsGeo);

  // 5. Upper Deck / Navigation Bridge with Forward Rake
  const upperDeck = new THREE.BoxGeometry(0.28, 0.07, 0.44);
  upperDeck.translate(0, 0.265, -0.10);
  applyColor(upperDeck, 0.96, 0.97, 0.99);
  geometries.push(upperDeck);

  const bridgeWindows = new THREE.BoxGeometry(0.29, 0.035, 0.18);
  bridgeWindows.translate(0, 0.27, -0.22);
  applyColor(bridgeWindows, 0.15, 0.35, 0.55); // Aegean sky reflection
  geometries.push(bridgeWindows);

  // 6. Twin Hellenic Blue Exhaust Funnels with White Band
  const funnelL = new THREE.BoxGeometry(0.04, 0.09, 0.09);
  funnelL.translate(-0.10, 0.31, 0.16);
  applyColor(funnelL, 0.10, 0.35, 0.75); // Greek blue
  geometries.push(funnelL);

  const funnelR = new THREE.BoxGeometry(0.04, 0.09, 0.09);
  funnelR.translate(0.10, 0.31, 0.16);
  applyColor(funnelR, 0.10, 0.35, 0.75);
  geometries.push(funnelR);

  // 7. Radar Mast & Dual Radomes
  const mastGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.16, 5);
  mastGeo.translate(0, 0.37, -0.10);
  applyColor(mastGeo, 0.85, 0.88, 0.92);
  geometries.push(mastGeo);

  const radomeL = new THREE.SphereGeometry(0.024, 6, 5);
  radomeL.translate(-0.07, 0.33, -0.06);
  applyColor(radomeL, 0.98, 0.98, 1.0);
  geometries.push(radomeL);

  const radomeR = new THREE.SphereGeometry(0.024, 6, 5);
  radomeR.translate(0.07, 0.33, -0.06);
  applyColor(radomeR, 0.98, 0.98, 1.0);
  geometries.push(radomeR);

  // 8. Navigation Lights
  const stbGeo = new THREE.SphereGeometry(0.024, 5, 4);
  stbGeo.translate(0.18, 0.18, -0.25);
  applyColor(stbGeo, 0.1, 1.0, 0.3);
  geometries.push(stbGeo);

  const portGeo = new THREE.SphereGeometry(0.024, 5, 4);
  portGeo.translate(-0.18, 0.18, -0.25);
  applyColor(portGeo, 1.0, 0.15, 0.15);
  geometries.push(portGeo);

  return mergeGeometries(geometries);
}

/**
 * Tier 4: Merchant Cargo Freighter (Coastal Container / Bulk Carrier)
 * Heavy steel displacement hull, red anti-fouling bottom, stacked shipping containers, deck crane, aft bridge castle.
 */
function createFreighterGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Heavy Displacement Hull (Anti-fouling red bottom + Charcoal topsides)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -0.88); // Bulbous cargo bow
  hullShape.bezierCurveTo(0.24, -0.68, 0.26, 0.35, 0.22, 0.75); // Starboard flank
  hullShape.lineTo(-0.22, 0.75); // Transom stern
  hullShape.bezierCurveTo(-0.26, 0.35, -0.24, -0.68, 0, -0.88); // Port flank

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.10, 0);

  const hullPos = hullGeo.attributes.position;
  const hullColors = new Float32Array(hullPos.count * 3);
  for (let i = 0; i < hullPos.count; i++) {
    const y = hullPos.getY(i);
    if (y < 0.07) {
      // Red oxide anti-fouling underwater paint
      hullColors[i * 3 + 0] = 0.52;
      hullColors[i * 3 + 1] = 0.12;
      hullColors[i * 3 + 2] = 0.10;
    } else {
      // Industrial slate charcoal topsides
      hullColors[i * 3 + 0] = 0.16;
      hullColors[i * 3 + 1] = 0.20;
      hullColors[i * 3 + 2] = 0.26;
    }
  }
  hullGeo.setAttribute('color', new THREE.BufferAttribute(hullColors, 3));
  geometries.push(hullGeo);

  // 2. Raised Forecastle Bow Deck
  const forecastle = new THREE.BoxGeometry(0.32, 0.06, 0.24);
  forecastle.translate(0, 0.22, -0.72);
  applyColor(forecastle, 0.22, 0.27, 0.34);
  geometries.push(forecastle);

  // 3. Stacked Intermodal Shipping Containers (Authentic Mediterranean liveries)
  interface ContainerSpec {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    l: number;
    r: number;
    g: number;
    b: number;
  }
  const containers: ContainerSpec[] = [
    // Bay 1 (Forward)
    { x: -0.10, y: 0.22, z: -0.42, w: 0.14, h: 0.09, l: 0.28, r: 0.76, g: 0.26, b: 0.10 }, // Terracotta
    { x:  0.10, y: 0.22, z: -0.42, w: 0.14, h: 0.09, l: 0.28, r: 0.05, g: 0.48, b: 0.78 }, // Aegean Cyan
    { x:  0.00, y: 0.30, z: -0.42, w: 0.18, h: 0.08, l: 0.26, r: 0.88, g: 0.68, b: 0.12 }, // Greek Yellow
    // Bay 2 (Midships)
    { x: -0.10, y: 0.22, z: -0.10, w: 0.14, h: 0.09, l: 0.30, r: 0.08, g: 0.52, b: 0.32 }, // Emerald
    { x:  0.10, y: 0.22, z: -0.10, w: 0.14, h: 0.09, l: 0.30, r: 0.76, g: 0.26, b: 0.10 }, // Terracotta
    { x: -0.06, y: 0.30, z: -0.10, w: 0.13, h: 0.08, l: 0.28, r: 0.12, g: 0.30, b: 0.62 }, // Navy
    { x:  0.06, y: 0.30, z: -0.10, w: 0.13, h: 0.08, l: 0.28, r: 0.88, g: 0.68, b: 0.12 }, // Yellow
    // Bay 3 (Aft hold)
    { x: -0.10, y: 0.22, z:  0.22, w: 0.14, h: 0.09, l: 0.28, r: 0.05, g: 0.48, b: 0.78 }, // Cyan
    { x:  0.10, y: 0.22, z:  0.22, w: 0.14, h: 0.09, l: 0.28, r: 0.08, g: 0.52, b: 0.32 }, // Emerald
    { x:  0.00, y: 0.30, z:  0.22, w: 0.18, h: 0.08, l: 0.26, r: 0.76, g: 0.26, b: 0.10 }, // Terracotta
  ];

  for (const c of containers) {
    const box = new THREE.BoxGeometry(c.w, c.h, c.l);
    box.translate(c.x, c.y, c.z);
    applyColor(box, c.r, c.g, c.b);
    geometries.push(box);
  }

  // 4. Deck Cargo Crane Pedestal & Boom
  const craneBase = new THREE.CylinderGeometry(0.024, 0.028, 0.12, 6);
  craneBase.translate(0, 0.26, 0.05);
  applyColor(craneBase, 0.85, 0.65, 0.15); // Industrial yellow
  geometries.push(craneBase);

  const craneBoom = new THREE.BoxGeometry(0.015, 0.015, 0.28);
  craneBoom.rotateX(-0.35);
  craneBoom.translate(0, 0.35, -0.06);
  applyColor(craneBoom, 0.85, 0.65, 0.15);
  geometries.push(craneBoom);

  // 5. Aft Bridge Castle & Navigation Bridge Wings
  const castleGeo = new THREE.BoxGeometry(0.38, 0.16, 0.26);
  castleGeo.translate(0, 0.28, 0.50);
  applyColor(castleGeo, 0.94, 0.95, 0.97); // White deckhouse
  geometries.push(castleGeo);

  // Bridge navigation windows
  const bridgeWindows = new THREE.BoxGeometry(0.40, 0.04, 0.12);
  bridgeWindows.translate(0, 0.33, 0.44);
  applyColor(bridgeWindows, 0.10, 0.18, 0.28);
  geometries.push(bridgeWindows);

  // Bridge wings extending out to port and starboard
  const wingL = new THREE.BoxGeometry(0.08, 0.02, 0.08);
  wingL.translate(-0.22, 0.33, 0.44);
  applyColor(wingL, 0.94, 0.95, 0.97);
  geometries.push(wingL);

  const wingR = new THREE.BoxGeometry(0.08, 0.02, 0.08);
  wingR.translate(0.22, 0.33, 0.44);
  applyColor(wingR, 0.94, 0.95, 0.97);
  geometries.push(wingR);

  // 6. Industrial Smokestack Funnel (Navy with Orange Band)
  const funnelGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.16, 8);
  funnelGeo.translate(0, 0.42, 0.58);
  applyColor(funnelGeo, 0.12, 0.18, 0.28);
  geometries.push(funnelGeo);

  const funnelBand = new THREE.CylinderGeometry(0.038, 0.040, 0.04, 8);
  funnelBand.translate(0, 0.44, 0.58);
  applyColor(funnelBand, 0.92, 0.38, 0.12); // Orange band
  geometries.push(funnelBand);

  // 7. Radar Mast
  const mastGeo = new THREE.CylinderGeometry(0.008, 0.014, 0.22, 5);
  mastGeo.translate(0, 0.46, 0.46);
  applyColor(mastGeo, 0.82, 0.85, 0.88);
  geometries.push(mastGeo);

  // Navigation lights
  const stbGeo = new THREE.SphereGeometry(0.026, 5, 4);
  stbGeo.translate(0.26, 0.34, 0.44);
  applyColor(stbGeo, 0.1, 1.0, 0.3);
  geometries.push(stbGeo);

  const portGeo = new THREE.SphereGeometry(0.026, 5, 4);
  portGeo.translate(-0.26, 0.34, 0.44);
  applyColor(portGeo, 1.0, 0.15, 0.15);
  geometries.push(portGeo);

  return mergeGeometries(geometries);
}

/**
 * Tier 5: Luxury Motor Yacht (VIP Charter Superyacht)
 * Streamlined aerodynamic pearl-white composite hull, golden teak decks, wrap-around privacy glass, flybridge arch.
 */
function createYachtGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Aerodynamic Pearl-White Composite Hull (Plumb Bow)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -0.62); // Vertical axe plumb bow
  hullShape.bezierCurveTo(0.16, -0.42, 0.19, 0.12, 0.15, 0.48); // Starboard curve
  hullShape.lineTo(-0.15, 0.48); // Stepped transom
  hullShape.bezierCurveTo(-0.19, 0.12, -0.16, -0.42, 0, -0.62); // Port curve

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.07, 0);
  applyColor(hullGeo, 0.97, 0.98, 0.99); // Pearl white composite
  geometries.push(hullGeo);

  // 2. Stainless Steel Waterline Stripe
  const stripeGeo = new THREE.BoxGeometry(0.36, 0.015, 0.92);
  stripeGeo.translate(0, 0.035, -0.04);
  applyColor(stripeGeo, 0.25, 0.45, 0.65); // Subtle ocean sapphire accent
  geometries.push(stripeGeo);

  // 3. Burmese Golden Teak Foredeck Lounge
  const teakForedeck = new THREE.BoxGeometry(0.24, 0.015, 0.30);
  teakForedeck.translate(0, 0.145, -0.32);
  applyColor(teakForedeck, 0.78, 0.52, 0.24); // Golden honey teak
  geometries.push(teakForedeck);

  // Sunbed cushions (Navy Blue)
  const sunbed = new THREE.BoxGeometry(0.14, 0.03, 0.16);
  sunbed.translate(0, 0.165, -0.32);
  applyColor(sunbed, 0.12, 0.24, 0.55);
  geometries.push(sunbed);

  // 4. Main Deck Salon (Wrap-around tinted privacy glass)
  const salonGeo = new THREE.BoxGeometry(0.26, 0.10, 0.54);
  salonGeo.translate(0, 0.19, 0.04);
  applyColor(salonGeo, 0.08, 0.10, 0.15); // Dark obsidian privacy glass
  geometries.push(salonGeo);

  // 5. Upper Flybridge Hardtop & Lounge
  const flybridge = new THREE.BoxGeometry(0.22, 0.08, 0.32);
  flybridge.translate(0, 0.27, 0.08);
  applyColor(flybridge, 0.96, 0.97, 0.99); // Pearl white
  geometries.push(flybridge);

  // Flybridge windscreen
  const flyWindscreen = new THREE.BoxGeometry(0.23, 0.03, 0.10);
  flyWindscreen.translate(0, 0.30, -0.05);
  applyColor(flyWindscreen, 0.15, 0.35, 0.60);
  geometries.push(flyWindscreen);

  // 6. Swept-Back Radar Arch & Satellite Domes
  const archGeo = new THREE.BoxGeometry(0.24, 0.04, 0.06);
  archGeo.translate(0, 0.34, 0.18);
  applyColor(archGeo, 0.95, 0.96, 0.98);
  geometries.push(archGeo);

  const domeL = new THREE.SphereGeometry(0.022, 6, 5);
  domeL.translate(-0.08, 0.37, 0.18);
  applyColor(domeL, 0.98, 0.98, 1.0);
  geometries.push(domeL);

  const domeR = new THREE.SphereGeometry(0.022, 6, 5);
  domeR.translate(0.08, 0.37, 0.18);
  applyColor(domeR, 0.98, 0.98, 1.0);
  geometries.push(domeR);

  // 7. Aft Stepped Teak Beach Club / Swim Platform
  const beachClub = new THREE.BoxGeometry(0.26, 0.02, 0.14);
  beachClub.translate(0, 0.08, 0.46);
  applyColor(beachClub, 0.78, 0.52, 0.24); // Teak
  geometries.push(beachClub);

  // 8. Navigation Lights
  const stbGeo = new THREE.SphereGeometry(0.02, 5, 4);
  stbGeo.translate(0.14, 0.16, -0.15);
  applyColor(stbGeo, 0.1, 1.0, 0.3);
  geometries.push(stbGeo);

  const portGeo = new THREE.SphereGeometry(0.02, 5, 4);
  portGeo.translate(-0.14, 0.16, -0.15);
  applyColor(portGeo, 1.0, 0.15, 0.15);
  geometries.push(portGeo);

  return mergeGeometries(geometries);
}

/**
 * ShipsRenderer manages instanced rendering and physical animation for all 5 tiers of Aegean vessels:
 * Tier 1: Traditional Kaiki (Fishing Boat)
 * Tier 2: Aegean Caique (Motorized Cargo Schooner)
 * Tier 3: Island Passenger Ferry (High-Speed Ro-Ro Catamaran)
 * Tier 4: Merchant Cargo Freighter (Coastal Container Ship)
 * Tier 5: Luxury Motor Yacht (VIP Charter Superyacht)
 */
export class ShipsRenderer {
  public maxShipsPerTier = 120;
  private tierModels: Map<string, ShipTierDefinition> = new Map();
  private boatMaterial: THREE.MeshStandardMaterial;

  private dummy = new THREE.Object3D();
  private shipVisualState: Map<string, ShipVisualState> = new Map();
  private lastTimeSec = 0;
  public selectedShipId: string | null = null;
  public wakeRenderer: BoatWakeRenderer;

  constructor(private scene: THREE.Scene) {
    this.boatMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.18,
    });

    // Register all 5 Ship Tiers with dedicated geometries and hydrodynamic visual profiles
    const tierConfigs = [
      {
        typeId: 'fishing_boat',
        name: 'Boat',
        tier: 1,
        geo: createKaikiGeometry(),
        profile: { bowOffset: -0.30, sternOffset: 0.28, beam: 0.26, baseScale: 1.0 },
      },
      {
        typeId: 'caique',
        name: 'Coaster',
        tier: 2,
        geo: createCaiqueGeometry(),
        profile: { bowOffset: -0.44, sternOffset: 0.38, beam: 0.34, baseScale: 1.15 },
      },
      {
        typeId: 'ferry',
        name: 'Ferry',
        tier: 3,
        geo: createFerryGeometry(),
        profile: { bowOffset: -0.65, sternOffset: 0.55, beam: 0.48, baseScale: 1.10 },
      },
      {
        typeId: 'cargo_ship',
        name: 'Freighter',
        tier: 4,
        geo: createFreighterGeometry(),
        profile: { bowOffset: -0.88, sternOffset: 0.75, beam: 0.52, baseScale: 1.15 },
      },
      {
        typeId: 'charter_yacht',
        name: 'Yacht',
        tier: 5,
        geo: createYachtGeometry(),
        profile: { bowOffset: -0.60, sternOffset: 0.50, beam: 0.36, baseScale: 1.05 },
      },
    ];

    for (const cfg of tierConfigs) {
      const mesh = new THREE.InstancedMesh(cfg.geo, this.boatMaterial, this.maxShipsPerTier);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);

      this.tierModels.set(cfg.typeId, {
        typeId: cfg.typeId,
        name: cfg.name,
        tier: cfg.tier,
        profile: cfg.profile,
        mesh,
        meshes: [mesh],
        shipIdList: [],
      });
    }

    this.wakeRenderer = new BoatWakeRenderer(this.scene);
    this.loadExternalModels();
  }

  public update(
    ships: Map<string, ShipInstance>,
    terrain: AegeanTerrain,
    timeSec: number,
    camera: THREE.Camera
  ): void {
    const dt = this.lastTimeSec > 0 ? THREE.MathUtils.clamp(timeSec - this.lastTimeSec, 0.001, 0.08) : 0.016;
    this.lastTimeSec = timeSec;

    // Reset instance tracking lists for all tier models
    for (const tm of this.tierModels.values()) {
      tm.shipIdList = [];
    }

    // 1. Clean up visual state for despawned vessels
    for (const id of this.shipVisualState.keys()) {
      if (!ships.has(id)) {
        this.shipVisualState.delete(id);
      }
    }

    // 2. Pre-calculate navigation and spatial contexts
    interface ShipNavContext {
      ship: ShipInstance;
      tierModel: ShipTierDefinition;
      worldPos: THREE.Vector3;
      seaLevelY: number;
      scaleFactor: number;
      isSailing: boolean;
      forward: { x: number; z: number };
      starboard: { x: number; z: number };
    }

    const shipContexts: ShipNavContext[] = [];

    for (const ship of ships.values()) {
      const tierModel = this.tierModels.get(ship.typeId) || this.tierModels.get('fishing_boat')!;
      if (tierModel.shipIdList.length >= this.maxShipsPerTier) continue;

      const worldPos = terrain.lonLatToWorld(ship.position.lon, ship.position.lat);
      const elev = terrain.getElevationAt(ship.position.lon, ship.position.lat);
      const seaLevelY = Math.max(0.02, elev);

      const camDist = camera.position.distanceTo(worldPos);
      const scaleFactor = THREE.MathUtils.clamp(camDist * 0.024, 0.85, 2.2);

      const isSailing = ship.state === 'sailing';

      // Forward vector in Three.js coordinates (-Z is North, +X is East)
      const fwdX = Math.sin(ship.heading);
      const fwdZ = -Math.cos(ship.heading);

      // Starboard vector (90 degrees to the right of forward: (+cos, +sin))
      const stbX = Math.cos(ship.heading);
      const stbZ = Math.sin(ship.heading);

      shipContexts.push({
        ship,
        tierModel,
        worldPos,
        seaLevelY,
        scaleFactor,
        isSailing,
        forward: { x: fwdX, z: fwdZ },
        starboard: { x: stbX, z: stbZ },
      });
    }

    // 3. Process each ship: Calculate collision avoidance, heading, pitch/roll, and bow wake
    for (let i = 0; i < shipContexts.length; i++) {
      const ctx = shipContexts[i];
      const ship = ctx.ship;
      const tier = ctx.tierModel;

      let vis = this.shipVisualState.get(ship.id);
      if (!vis) {
        vis = { yaw: -ship.heading, turnRate: 0, avoidOffset: 0, steerAngle: 0 };
        this.shipVisualState.set(ship.id, vis);
      }

      // Early & Proactive COLREGs maritime collision avoidance between vessels
      let targetAvoidOffset = 0;
      let targetSteerAngle = 0;

      if (ctx.isSailing) {
        for (let j = 0; j < shipContexts.length; j++) {
          if (i === j) continue;
          const other = shipContexts[j];

          const dx = other.worldPos.x - ctx.worldPos.x;
          const dz = other.worldPos.z - ctx.worldPos.z;
          const distSq = dx * dx + dz * dz;

          // Extended radar lookahead horizon: up to 5.0 world units (~15-18 boat lengths)
          if (distSq < 26.0 && distSq > 0.0001) {
            // Decompose relative vector into vessel's forward and starboard axes
            const alongFwd = dx * ctx.forward.x + dz * ctx.forward.z;
            const alongStb = dx * ctx.starboard.x + dz * ctx.starboard.z;

            // Only react to vessels ahead or immediately abreast (passing beam)
            if (alongFwd > -0.5) {
              const headOnDot = ctx.forward.x * other.forward.x + ctx.forward.z * other.forward.z;
              const isHeadOn = headOnDot < -0.25;
              const maxLookahead = isHeadOn ? 4.8 : 3.4;

              if (alongFwd < maxLookahead && Math.abs(alongStb) < 1.15) {
                // Lateral hazard weighting: higher when directly on collision track
                const lateralWeight = 1.0 - Math.min(1.0, Math.abs(alongStb) / 1.15);

                // Forward distance progress: smooth sinusoidal rise from 0 at lookahead limit to 1 at abreast
                const fwdRatio = alongFwd <= 0
                  ? 1.0 + alongFwd / 0.5 // Quick linear taper behind beam
                  : 1.0 - (alongFwd / maxLookahead);
                const progressCurve = Math.sin(Math.max(0, Math.min(1, fwdRatio)) * Math.PI * 0.5);
                const influence = progressCurve * (0.4 + 0.6 * lateralWeight);

                if (isHeadOn) {
                  // COLREGs Rule 14: Head-on meeting vessels alter course to Starboard (Right) well in advance
                  targetAvoidOffset += 0.72 * influence;
                  targetSteerAngle += 0.28 * influence;
                } else if (Math.abs(alongStb) < 0.65) {
                  // Overtaking or crossing: Clear into open flank
                  const steerDir = Math.abs(alongStb) < 0.18
                    ? (ship.id < other.ship.id ? 1.0 : -1.0)
                    : (alongStb >= 0 ? -1.0 : 1.0);
                  targetAvoidOffset += steerDir * 0.58 * influence;
                  targetSteerAngle += steerDir * 0.22 * influence;
                }
              }
            }
          }
        }
      }

      // Clamp cumulative avoidance offset to keep vessel within navigable lane boundaries
      targetAvoidOffset = THREE.MathUtils.clamp(targetAvoidOffset, -0.90, 0.90);
      targetSteerAngle = THREE.MathUtils.clamp(targetSteerAngle, -0.38, 0.38);

      // Low-pass filter for smooth, organic helm response without snapping or twitching
      const filterAlpha = 1.0 - Math.exp(-dt * 3.4);
      vis.avoidOffset = THREE.MathUtils.lerp(vis.avoidOffset, targetAvoidOffset, filterAlpha);
      vis.steerAngle = THREE.MathUtils.lerp(vis.steerAngle, targetSteerAngle, filterAlpha);

      // Smooth and responsive tracking of route heading with realistic vessel hull inertia
      const targetYaw = -ship.heading;
      let diff = targetYaw - vis.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (!ctx.isSailing || Math.abs(diff) > 1.5) {
        vis.yaw = targetYaw;
        vis.turnRate = 0;
        diff = 0;
      } else {
        // Natural ship turning rate: max ~3.2 rad/sec to simulate nautical hull inertia and prevent rapid snapping
        const turnSpeed = 5.0;
        const maxDelta = 3.2 * dt;
        const step = THREE.MathUtils.clamp(diff * (1.0 - Math.exp(-dt * turnSpeed)), -maxDelta, maxDelta);
        vis.turnRate = step / Math.max(0.001, dt);
        vis.yaw += step;
      }

      // World coordinates with smoothed lateral clearing offset
      const finalX = ctx.worldPos.x + ctx.starboard.x * vis.avoidOffset;
      const finalZ = ctx.worldPos.z + ctx.starboard.z * vis.avoidOffset;

      // Track physical world speed across water surface
      let actualSpeed = 0;
      if (vis.prevX !== undefined && vis.prevZ !== undefined && dt > 0.0001) {
        const dx = finalX - vis.prevX;
        const dz = finalZ - vis.prevZ;
        actualSpeed = Math.hypot(dx, dz) / dt;
      }
      vis.prevX = finalX;
      vis.prevZ = finalZ;

      // Final visual yaw: base heading - steering deflection
      const finalYaw = vis.yaw - vis.steerAngle;

      // Hydrodynamic Wake: Originates directly at the stern transom of each specific vessel tier
      const effScale = ctx.scaleFactor * tier.profile.baseScale;
      // Stern is along local +Z; emit directly behind the trailing stern transom
      const sternDist = (tier.profile.sternOffset ?? 0.3) * effScale * 0.85;
      const emitX = finalX + Math.sin(finalYaw) * sternDist;
      const emitZ = finalZ + Math.cos(finalYaw) * sternDist;
      const vesselBeam = tier.profile.beam * effScale;

      this.wakeRenderer.recordVessel(
        ship.id,
        emitX,
        ctx.seaLevelY,
        emitZ,
        finalYaw,
        ctx.isSailing ? actualSpeed : 0.0,
        vesselBeam,
        ctx.isSailing,
        timeSec
      );

      // Bobbing pitch and roll on Mediterranean sea waves
      const bobSeed = i * 1.73;
      const pitchSpeed = ctx.isSailing ? 4.5 : 2.0;
      const rollSpeed = ctx.isSailing ? 3.2 : 1.6;

      const pitch = Math.sin(timeSec * pitchSpeed + bobSeed) * (ctx.isSailing ? 0.04 : 0.02);
      const waveRoll = Math.cos(timeSec * rollSpeed + bobSeed) * (ctx.isSailing ? 0.05 : 0.025);
      const heave = Math.sin(timeSec * 2.8 + bobSeed) * 0.012;

      // Realistic boat banking into turns (heeling)
      const turnBanking = THREE.MathUtils.clamp(-vis.turnRate * 0.22 + vis.steerAngle * 0.15, -0.09, 0.09);
      const totalRoll = waveRoll + turnBanking;

      // Update 3D instance matrix for this specific tier model
      const instanceIndex = tier.shipIdList.length;
      tier.shipIdList.push(ship.id);

      this.dummy.rotation.order = 'YXZ';
      this.dummy.position.set(finalX, ctx.seaLevelY + heave, finalZ);
      this.dummy.rotation.set(pitch, finalYaw, totalRoll);
      this.dummy.scale.set(effScale, effScale, effScale);
      this.dummy.updateMatrix();

      for (const m of tier.meshes) {
        m.setMatrixAt(instanceIndex, this.dummy.matrix);
      }
    }

    // Update draw counts and matrices for all 5 tiers
    for (const tm of this.tierModels.values()) {
      for (const m of tm.meshes) {
        m.count = tm.shipIdList.length;
        m.instanceMatrix.needsUpdate = true;
      }
    }

    // Update dynamic world-space wake mesh
    this.wakeRenderer.update(timeSec);
  }

  /**
   * Asynchronously streams and mounts the 5 external GLTF 3D models into InstancedMeshes.
   */
  private loadExternalModels(): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

    const loader = new GLTFLoader();
    const modelConfigs = [
      {
        typeId: 'fishing_boat',
        url: '/models/kaiki/scene.gltf',
        targetLength: 0.58,
        yawAdjustmentRad: Math.PI / 2, // Kaiki stem is at +X (rotate +90° to face -Z forward)
        waterlineSinkFactor: 0.18,
      },
      {
        typeId: 'caique',
        url: '/models/caique/scene.gltf',
        targetLength: 0.86,
        yawAdjustmentRad: Math.PI, // Caique stem is at +Z
        waterlineSinkFactor: 0.22,
      },
      {
        typeId: 'ferry',
        url: '/models/ferry/scene.gltf',
        targetLength: 1.28,
        yawAdjustmentRad: Math.PI / 2, // Ferry stem is at +X
        waterlineSinkFactor: 0.20,
      },
      {
        typeId: 'cargo_ship',
        url: '/models/freighter/scene.gltf',
        targetLength: 1.72,
        yawAdjustmentRad: Math.PI / 2, // Container freighter stem is at +X
        waterlineSinkFactor: 0.20,
      },
      {
        typeId: 'charter_yacht',
        url: '/models/yacht/scene.gltf',
        targetLength: 1.18,
        yawAdjustmentRad: Math.PI, // Superyacht stem is at +Z (rotate 180° to face -Z forward)
        waterlineSinkFactor: 0.16,
      },
    ];

    for (const cfg of modelConfigs) {
      loader.load(
        cfg.url,
        (gltf) => {
          const tier = this.tierModels.get(cfg.typeId);
          if (!tier) return;

          const res = this.convertGLTFToInstancedMeshes(
            gltf.scene,
            cfg.targetLength,
            cfg.yawAdjustmentRad,
            cfg.waterlineSinkFactor
          );

          if (!res || res.meshes.length === 0) return;

          // Remove and dispose old procedural meshes for this tier
          for (const oldMesh of tier.meshes) {
            this.scene.remove(oldMesh);
            oldMesh.geometry.dispose();
          }

          // Add newly created instanced GLTF meshes to the scene
          for (const newMesh of res.meshes) {
            this.scene.add(newMesh);
          }

          // Update tier definition
          tier.meshes = res.meshes;
          tier.mesh = res.meshes[0];
          tier.profile = res.profile;

          console.log(
            `[Aegean Fleet] Mounted external 3D model for ${tier.name} (T${tier.tier}) — ${res.meshes.length} instanced mesh part(s).`
          );
        },
        undefined,
        (err) => {
          console.warn(`[Aegean Fleet] Retaining procedural model for ${cfg.typeId}:`, err);
        }
      );
    }
  }

  /**
   * Normalizes, centers, and batches a loaded GLTF scene hierarchy into high-performance InstancedMeshes.
   */
  private convertGLTFToInstancedMeshes(
    gltfScene: THREE.Group,
    targetLength: number,
    yawAdjustmentRad: number,
    waterlineSinkFactor: number
  ): { meshes: THREE.InstancedMesh[]; profile: ShipVisualProfile } | null {
    gltfScene.updateMatrixWorld(true);

    const rawBox = new THREE.Box3().setFromObject(gltfScene);
    if (rawBox.isEmpty()) return null;

    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());
    const rawLength = Math.max(rawSize.x, rawSize.z);
    if (rawLength <= 0) return null;

    const scale = targetLength / rawLength;
    const waterlineY = rawBox.min.y + rawSize.y * waterlineSinkFactor;

    // Normalization transformation:
    // 1. Translate center to (0, 0, 0) with waterline at Y=0
    // 2. Rotate around Y so bow points to -Z
    // 3. Scale uniformly
    const t1 = new THREE.Matrix4().makeTranslation(-rawCenter.x, -waterlineY, -rawCenter.z);
    const rot = new THREE.Matrix4().makeRotationY(yawAdjustmentRad);
    const sc = new THREE.Matrix4().makeScale(scale, scale, scale);
    const normMatrix = new THREE.Matrix4().multiply(sc).multiply(rot).multiply(t1);

    const texturedGroups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const cadGeos: THREE.BufferGeometry[] = [];

    gltfScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.geometry) return;

        const fullMatrix = new THREE.Matrix4().multiplyMatrices(normMatrix, mesh.matrixWorld);
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(fullMatrix);

        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const hasTexture = mat && ('map' in mat && (mat as any).map);

        if (hasTexture) {
          if (!texturedGroups.has(mat)) {
            texturedGroups.set(mat, []);
          }
          texturedGroups.get(mat)!.push(geo);
        } else {
          let col = new THREE.Color(0xd0d8e2);
          if (mat && 'color' in mat && (mat as any).color) {
            col = (mat as any).color;
          }
          const count = geo.attributes.position.count;
          const colors = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            colors[i * 3 + 0] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          if (!geo.attributes.normal) {
            geo.computeVertexNormals();
          }
          cadGeos.push(geo);
        }
      }
    });

    const instancedMeshes: THREE.InstancedMesh[] = [];

    // Helper: Harmonize non-textured CAD geometries so mergeGeometries succeeds without attribute mismatch warnings
    const harmonizeCadGeos = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry[] => {
      return geos.map((g) => {
        const nonIndexed = g.index ? g.toNonIndexed() : g.clone();
        // Remove extraneous attributes not shared across all meshes (e.g. uv, uv2, tangents)
        for (const attrName of Object.keys(nonIndexed.attributes)) {
          if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'color') {
            nonIndexed.deleteAttribute(attrName);
          }
        }
        if (!nonIndexed.attributes.normal) {
          nonIndexed.computeVertexNormals();
        }
        return nonIndexed;
      });
    };

    // Helper: Harmonize textured geometries ensuring position, normal, and uv are uniformly present
    const harmonizeTexGeos = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry[] => {
      return geos.map((g) => {
        const nonIndexed = g.index ? g.toNonIndexed() : g.clone();
        for (const attrName of Object.keys(nonIndexed.attributes)) {
          if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
            nonIndexed.deleteAttribute(attrName);
          }
        }
        if (!nonIndexed.attributes.normal) {
          nonIndexed.computeVertexNormals();
        }
        if (!nonIndexed.attributes.uv) {
          const vCount = nonIndexed.attributes.position.count;
          nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vCount * 2), 2));
        }
        return nonIndexed;
      });
    };

    // Merge non-textured CAD geometries into a single vertex-colored InstancedMesh
    if (cadGeos.length > 0) {
      let mergedCad: THREE.BufferGeometry | null = null;
      try {
        const harmonized = harmonizeCadGeos(cadGeos);
        mergedCad = BufferGeometryUtils.mergeGeometries(harmonized, false);
      } catch (err) {
        console.warn('CAD merge fallback:', err);
      }

      if (mergedCad) {
        mergedCad.computeVertexNormals();
        const cadMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.65,
          metalness: 0.15,
        });
        const im = new THREE.InstancedMesh(mergedCad, cadMat, this.maxShipsPerTier);
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.count = 0;
        instancedMeshes.push(im);
      } else {
        for (const g of cadGeos) {
          const im = new THREE.InstancedMesh(g, this.boatMaterial, this.maxShipsPerTier);
          im.castShadow = true;
          im.receiveShadow = true;
          im.frustumCulled = false;
          im.count = 0;
          instancedMeshes.push(im);
        }
      }
    }

    // Merge/create InstancedMeshes for textured submeshes per material
    for (const [mat, geos] of texturedGroups.entries()) {
      let mergedTex: THREE.BufferGeometry | null = null;
      if (geos.length > 1) {
        try {
          const harmonized = harmonizeTexGeos(geos);
          mergedTex = BufferGeometryUtils.mergeGeometries(harmonized, false);
        } catch {
          // ignore
        }
      }
      const finalGeo = mergedTex || geos[0];
      if (!finalGeo.attributes.normal) finalGeo.computeVertexNormals();

      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;

      const im = new THREE.InstancedMesh(finalGeo, mat, this.maxShipsPerTier);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      instancedMeshes.push(im);
    }

    if (instancedMeshes.length === 0) return null;

    // Calculate overall bounding box for hydrodynamic profile
    const finalBox = new THREE.Box3();
    for (const im of instancedMeshes) {
      im.geometry.computeBoundingBox();
      if (im.geometry.boundingBox) {
        finalBox.union(im.geometry.boundingBox);
      }
    }

    const minZ = finalBox.min.z;
    const maxZ = finalBox.max.z;
    const width = finalBox.max.x - finalBox.min.x;

    const profile: ShipVisualProfile = {
      bowOffset: minZ, // negative along -Z
      sternOffset: maxZ, // positive along +Z
      beam: Math.max(0.18, width),
      baseScale: 1.0,
    };

    return { meshes: instancedMeshes, profile };
  }

  public dispose(): void {
    this.wakeRenderer.dispose();
    this.boatMaterial.dispose();
    for (const tm of this.tierModels.values()) {
      for (const m of tm.meshes) {
        m.geometry.dispose();
        this.scene.remove(m);
      }
    }
    this.tierModels.clear();
  }

  /**
   * Raycasting: Detects which vessel (across any tier) was clicked in 3D.
   */
  public getShipAtRay(raycaster: THREE.Raycaster, ships: Map<string, ShipInstance>): ShipInstance | null {
    const meshes = Array.from(this.tierModels.values()).flatMap((tm) => tm.meshes);
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const hitMesh = intersects[0].object as THREE.InstancedMesh;
      for (const tm of this.tierModels.values()) {
        if (tm.meshes.includes(hitMesh)) {
          const shipId = tm.shipIdList[intersects[0].instanceId];
          if (shipId && ships.has(shipId)) {
            return ships.get(shipId)!;
          }
        }
      }
    }
    return null;
  }
}
