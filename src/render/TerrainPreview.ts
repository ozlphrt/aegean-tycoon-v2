import * as THREE from 'three';
import { assetUrl } from '../utils/assets';

export interface IslandData {
  id: string;
  name: string;
  maskId: number;
  type: string;
  country: string;
  lat: number;
  lon: number;
  port: { lat: number; lon: number };
  population: number;
  unlock: { isStart?: boolean };
}

export class TerrainPreview {
  public mesh: THREE.Mesh;
  public material: THREE.MeshStandardMaterial;
  private textureLoader = new THREE.TextureLoader();
  private textures: Record<string, THREE.Texture> = {};
  public planeWidth = 70;
  public planeHeight = 78.65; // Corrected for Aegean cos(38deg) latitude compression

  private minLon = 22.5;
  private maxLon = 29.5;
  private minLat = 34.8;
  private maxLat = 41.0;

  private portGroup = new THREE.Group();

  constructor(private scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(this.planeWidth, this.planeHeight, 64, 64);
    geometry.rotateX(-Math.PI / 2); // Lay horizontal on XZ plane

    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    this.scene.add(this.portGroup);

    this.loadTextures();
    this.loadIslands();
  }

  private loadTextures() {
    const texConfigs = [
      { key: 'night', url: assetUrl('data/night.jpg') },
      { key: 'day', url: assetUrl('data/day.jpg') },
      { key: 'lights', url: assetUrl('data/lights.png') },
      { key: 'heightmap', url: assetUrl('data/heightmap.png') },
      { key: 'mask', url: assetUrl('data/island_mask.png') },
    ];

    texConfigs.forEach(({ key, url }) => {
      this.textureLoader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        if (key === 'mask') {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
        }
        this.textures[key] = tex;

        // Default to night view
        if (key === 'night') {
          this.material.map = tex;
          this.material.needsUpdate = true;
        }
      });
    });
  }

  public setDisplayMode(mode: 'night' | 'day' | 'lights' | 'heightmap' | 'mask') {
    const tex = this.textures[mode];
    if (tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
      console.log(`Display mode switched to: ${mode}`);
    }
  }

  public lonLatToWorld(lon: float, lat: float): THREE.Vector3 {
    const normX = (lon - this.minLon) / (this.maxLon - this.minLon);
    const normY = (lat - this.minLat) / (this.maxLat - this.minLat);
    const worldX = (normX - 0.5) * this.planeWidth;
    const worldZ = -(normY - 0.5) * this.planeHeight;
    return new THREE.Vector3(worldX, 0.4, worldZ);
  }

  private async loadIslands() {
    try {
      const resp = await fetch(assetUrl('data/islands.json'));
      const islands: IslandData[] = await resp.json();

      const pinGeo = new THREE.CylinderGeometry(0.35, 0.1, 1.2, 12);
      pinGeo.translate(0, 0.6, 0);

      const starterMat = new THREE.MeshBasicMaterial({ color: 0x1fb5b0 }); // Teal for starter islands
      const lockedMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e });  // Gold for other islands

      islands.forEach((isl) => {
        const pos = this.lonLatToWorld(isl.port.lon, isl.port.lat);
        const pin = new THREE.Mesh(pinGeo, isl.unlock.isStart ? starterMat : lockedMat);
        pin.position.copy(pos);
        pin.name = `port-pin-${isl.id}`;
        this.portGroup.add(pin);

        // Add a gentle base beacon ring
        const ringGeo = new THREE.RingGeometry(0.5, 0.9, 16);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isl.unlock.isStart ? 0x1fb5b0 : 0xf2c14e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.position.y = 0.05;
        this.portGroup.add(ring);
      });
      console.log(`Spawned ${islands.length} port markers on Aegean plane.`);
    } catch (err) {
      console.error('Failed to load islands.json in preview:', err);
    }
  }
}
type float = number;
