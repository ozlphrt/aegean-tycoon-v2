import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AegeanTerrain } from './Terrain';
import { AegeanAtmosphere } from './Sky';
import { CameraManager } from './CameraManager';
import { IslandMarkers } from './IslandMarkers';
import { SettingsPanel } from './SettingsPanel';
import type { IslandData } from '../data/types';

export class AegeanScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;
  public ambientLight: THREE.AmbientLight;
  public moonLight: THREE.DirectionalLight;

  public terrain?: AegeanTerrain;
  public atmosphere: AegeanAtmosphere;
  public cameraManager: CameraManager;
  public islandMarkers?: IslandMarkers;
  public settingsPanel?: SettingsPanel;

  private startTime = performance.now();
  private isDestroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    onIslandSelect?: (island: IslandData) => void
  ) {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060f22); // Moonlit Mediterranean midnight
    this.scene.fog = new THREE.FogExp2(0x060f22, 0.0022); // Gentle atmospheric distance haze

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000);

    // 3. WebGL2 Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.12; // Prevent going underneath water
    this.controls.minDistance = 8;
    this.controls.maxDistance = 180;

    // 5. Cinematic Camera Manager
    this.cameraManager = new CameraManager(this.camera, this.controls);

    // 6. Lighting: Radiant Mediterranean Full Moon Night
    this.ambientLight = new THREE.AmbientLight(0x2d4872, 3.8);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0xd4e8ff, 5.2);
    this.moonLight.position.set(-60, 95, 45);
    this.scene.add(this.moonLight);

    // 7. Atmosphere & Stars
    this.atmosphere = new AegeanAtmosphere(this.scene);

    // 8. Load Textures & Initialize 3D Terrain + Ocean
    this.loadWorld(onIslandSelect);

    // Resize listener
    window.addEventListener('resize', this.onWindowResize);

    // Start render loop
    this.animate();
  }

  private loadWorld(onIslandSelect?: (island: IslandData) => void) {
    const texLoader = new THREE.TextureLoader();
    const urls = {
      night: '/data/night.jpg?v=11',
      day: '/data/day.jpg?v=11',
      lights: '/data/lights.png?v=11',
      heightmap: '/data/heightmap.png?v=11',
      normals: '/data/normals.png?v=11',
      mask: '/data/island_mask.png?v=11',
    };

    let loaded = 0;
    const textures: Record<string, THREE.Texture> = {};
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    Object.entries(urls).forEach(([key, url]) => {
      texLoader.load(url, (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        if (key === 'mask') {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.generateMipmaps = false;
        } else if (key === 'heightmap') {
          tex.colorSpace = THREE.NoColorSpace;
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
        } else if (key === 'normals') {
          tex.colorSpace = THREE.NoColorSpace;
          tex.anisotropy = maxAnisotropy;
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
        } else {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAnisotropy;
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
        }
        textures[key] = tex;
        loaded++;

        if (loaded === Object.keys(urls).length) {
          // Initialize 3D Displaced Terrain (unified land and animated ocean)
          this.terrain = new AegeanTerrain(
            this.scene,
            textures as any,
            this.moonLight
          );

          // Initialize 3D Island Port Markers & Screen Labels
          this.islandMarkers = new IslandMarkers(
            this.scene,
            this.camera,
            (lon, lat) => this.terrain!.lonLatToWorld(lon, lat),
            (island) => {
              if (onIslandSelect) onIslandSelect(island);
              const worldPos = this.terrain!.lonLatToWorld(island.port.lon, island.port.lat);
              this.cameraManager.focusOn(worldPos, 18);
            },
            (lon, lat) => this.terrain!.getPeakWorld(lon, lat)
          );

          // Initialize Unified Graphics & Visual Settings Panel
          this.settingsPanel = new SettingsPanel(
            this.terrain,
            {
              moonLight: this.moonLight,
              ambientLight: this.ambientLight,
            },
            (tab) => {
              // Two-way sync: when user selects a tuner tab, main screen follows
              if (tab === 'night') {
                this.setViewMode(0, false);
                window.dispatchEvent(new CustomEvent('aegean:layer-change', { detail: { mode: 0 } }));
              } else if (tab === 'day') {
                this.setViewMode(1, false);
                window.dispatchEvent(new CustomEvent('aegean:layer-change', { detail: { mode: 1 } }));
              } else if (tab === 'dem') {
                this.setViewMode(2, false);
                window.dispatchEvent(new CustomEvent('aegean:layer-change', { detail: { mode: 2 } }));
              }
            }
          );

          console.log('Aegean 3D Night World fully instantiated.');
        }
      });
    });
  }

  public setViewMode(mode: number, syncSettings = true) {
    if (this.terrain) {
      this.terrain.setViewMode(mode);
      // Color tuner selection follows main screen selections
      if (syncSettings && this.settingsPanel) {
        if (mode === 0) {
          this.settingsPanel.switchTab('night', false);
        } else if (mode === 1) {
          this.settingsPanel.switchTab('day', false);
        } else if (mode === 2) {
          this.settingsPanel.switchTab('dem', false);
        }
      }
    }
  }

  private onWindowResize = () => {
    if (this.isDestroyed) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    if (this.isDestroyed) return;
    requestAnimationFrame(this.animate);

    const elapsedTime = (performance.now() - this.startTime) * 0.001;

    // Update camera intro or transitions
    this.cameraManager.update();
    this.controls.update();

    // Update terrain water ripples & camera pos
    if (this.terrain) {
      this.terrain.update(elapsedTime, this.camera);
    }

    // Update island beacons and label coordinates
    if (this.islandMarkers) {
      this.islandMarkers.update(elapsedTime);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onWindowResize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
