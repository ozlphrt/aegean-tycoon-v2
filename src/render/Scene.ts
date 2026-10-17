import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AegeanTerrain } from './Terrain';
import { AegeanAtmosphere } from './Sky';
import { CameraManager } from './CameraManager';
import { IslandMarkers } from './IslandMarkers';
import { SettingsPanel } from './SettingsPanel';
import { SurroundingWorld } from './SurroundingWorld';
import { ShipsRenderer } from './Ships';
import { ShipPopups, type ShipPopupOptions } from './ShipPopups';
import { GoodsCatapult } from './GoodsCatapult';
import type { IslandData, IslandEconomyState } from '../data/types';
import type { ShipInstance, ShipSimulationManager } from '../sim/shipSim';
import { assetUrl } from '../utils/assets';

export class AegeanScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;
  public ambientLight: THREE.AmbientLight;
  public moonLight: THREE.DirectionalLight;

  public terrain?: AegeanTerrain;
  public surroundingWorld?: SurroundingWorld;
  public atmosphere: AegeanAtmosphere;
  public cameraManager: CameraManager;
  public islandMarkers?: IslandMarkers;
  public settingsPanel?: SettingsPanel;
  public shipsRenderer?: ShipsRenderer;
  public shipPopups: ShipPopups = new ShipPopups();
  public goodsCatapult: GoodsCatapult;
  public shipManager?: ShipSimulationManager;

  public onTick?: (deltaSec: number) => void;
  public onShipSelect?: (ship: ShipInstance) => void;
  public onDeselect?: () => void;
  public onIslandSelectCallback?: (island: IslandData) => void;
  private startTime = performance.now();
  private lastFrameTime = performance.now();
  private isDestroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    onIslandSelect?: (island: IslandData) => void
  ) {
    this.onIslandSelectCallback = onIslandSelect;
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060f22); // Moonlit Mediterranean midnight
    this.scene.fog = new THREE.FogExp2(0x060f22, 0.0016); // Gentle atmospheric distance haze

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
    this.controls.minDistance = 6;
    this.controls.maxDistance = 120;

    // Swapped mouse drags: Left = PAN, Right = ROTATE (orbit)
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Prevent browser context menu on canvas so right-drag rotation works cleanly
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

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

    // 8. Goods Catapult Animation System
    this.goodsCatapult = new GoodsCatapult(this.scene);

    // 8. Load Textures & Initialize 3D Terrain + Ocean
    this.loadWorld(onIslandSelect);

    // Resize listener
    window.addEventListener('resize', this.onWindowResize);

    // Unified pointer click selection (Ship / Island / Outside Deselect)
    let downX = 0;
    let downY = 0;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      // Only left clicks trigger raycasting selection
      if (e.button !== 0) return;

      // 1. Drag / pan threshold: do not treat camera navigation as a click
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return;

      // 2. Ignore clicks on HUD panels, top bar, bottom bar, modals, island labels, or buttons/inputs
      const target = e.target as HTMLElement | null;
      if (target?.closest('.glass-panel, #top-bar, #bottom-bar, .settings-modal, .fleet-modal, .modal, .island-label, button, input, select, a')) {
        return;
      }

      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);

      // 3. Check if a ship / vessel was clicked
      if (this.shipsRenderer && this.shipManager && this.onShipSelect) {
        const hitShip = this.shipsRenderer.getShipAtRay(raycaster, this.shipManager.ships);
        if (hitShip) {
          this.onShipSelect(hitShip);
          return;
        }
      }

      // 4. Check if an island pin was clicked
      if (this.islandMarkers) {
        const hitIsland = this.islandMarkers.getIslandAtRay(raycaster);
        if (hitIsland) {
          this.setSelectedIsland(hitIsland.id);
          if (this.onIslandSelectCallback) {
            this.onIslandSelectCallback(hitIsland);
          }
          const pLon = hitIsland.peak?.lon ?? hitIsland.lon;
          const pLat = hitIsland.peak?.lat ?? hitIsland.lat;
          const worldPos = this.terrain?.getPeakWorld(pLon, pLat);
          if (worldPos) {
            this.cameraManager.focusOn(worldPos, 18);
          }
          return;
        }
      }

      // 5. Tapped outside on empty sea / water / space: trigger onDeselect
      this.setSelectedIsland(null);
      if (this.onDeselect) {
        this.onDeselect();
      }
    });

    // Start render loop
    this.animate();
  }

  private loadWorld(onIslandSelect?: (island: IslandData) => void) {
    const texLoader = new THREE.TextureLoader();
    const urls = {
      night: assetUrl('data/night.jpg?v=11'),
      day: assetUrl('data/day.jpg?v=11'),
      lights: assetUrl('data/lights.png?v=11'),
      heightmap: assetUrl('data/heightmap.png?v=11'),
      normals: assetUrl('data/normals.png?v=11'),
      mask: assetUrl('data/island_mask.png?v=12'),
      worldDay: assetUrl('data/world_day.jpg?v=1'),
      worldNight: assetUrl('data/world_night.jpg?v=1'),
      worldHeightmap: assetUrl('data/world_heightmap.png?v=1'),
    };

    let loaded = 0;
    const textures: Record<string, THREE.Texture> = {};
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    Object.entries(urls).forEach(([key, url]) => {
      texLoader.load(url, (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        if (key === 'mask') {
          tex.colorSpace = THREE.NoColorSpace;
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
        } else if (key === 'heightmap' || key === 'worldHeightmap') {
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
          // Initialize Surrounding World Context (Greece, Peloponnese, Turkey, wider Mediterranean)
          this.surroundingWorld = new SurroundingWorld(
            this.scene,
            {
              worldDay: textures.worldDay,
              worldNight: textures.worldNight,
              worldHeightmap: textures.worldHeightmap,
            },
            this.moonLight
          );

          // Initialize 3D Displaced Terrain (unified land and animated ocean)
          this.terrain = new AegeanTerrain(
            this.scene,
            textures as any,
            this.moonLight
          );

          // Initialize 3D Maritime Shipping Fleet
          this.shipsRenderer = new ShipsRenderer(this.scene);

          // Initialize 3D Island Port Markers & Screen Labels
          this.islandMarkers = new IslandMarkers(
            this.scene,
            this.camera,
            (lon, lat) => this.terrain!.lonLatToWorld(lon, lat),
            (island) => {
              this.setSelectedIsland(island.id);
              if (onIslandSelect) onIslandSelect(island);
              const pLon = island.peak?.lon ?? island.lon;
              const pLat = island.peak?.lat ?? island.lat;
              const worldPos = this.terrain!.getPeakWorld(pLon, pLat);
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
            },
            this.surroundingWorld,
            this.shipsRenderer.wakeRenderer
          );

          // Activate authoritative DEM topographic view mode by default
          this.setViewMode(2, true);

          console.log('Aegean 3D DEM World fully instantiated.');
        }
      });
    });
  }

  public zoomToActiveIslands(islands: IslandData[], durationMs = 2200) {
    if (!this.terrain || islands.length === 0) return;
    const positions = islands.map((isl) => {
      const pLon = isl.peak?.lon ?? isl.lon;
      const pLat = isl.peak?.lat ?? isl.lat;
      return this.terrain!.getPeakWorld(pLon, pLat);
    });
    this.cameraManager.fitToPositions(positions, 26, 1.30, true, durationMs);
  }

  public followShip(shipId: string, onCancel?: () => void) {
    if (!this.shipManager || !this.terrain) return;
    this.cameraManager.follow(() => {
      const ship = this.shipManager?.ships.get(shipId);
      if (!ship || !this.terrain) return null;
      return this.terrain.lonLatToWorld(ship.position.lon, ship.position.lat);
    }, 7.5, onCancel);
  }

  public unfollowShip() {
    this.cameraManager.unfollow();
  }

  public isFollowingShip(): boolean {
    return this.cameraManager.isFollowing();
  }

  public getShipWorldPos(shipId: string): THREE.Vector3 | null {
    const ship = this.shipManager?.ships.get(shipId);
    if (!ship || !this.terrain) return null;
    return this.terrain.lonLatToWorld(ship.position.lon, ship.position.lat);
  }

  public setViewMode(mode: number, syncSettings = true) {
    if (this.terrain) {
      this.terrain.setViewMode(mode);
      this.surroundingWorld?.setViewMode(mode);
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

  public awakenIsland(island: IslandData, onComplete?: () => void) {
    if (!this.terrain) return;
    const pLon = island.port?.lon ?? island.lon;
    const pLat = island.port?.lat ?? island.lat;
    this.terrain.awakenIsland(island.maskId, pLon, pLat, 2800, () => {
      this.islandMarkers?.setIslandLit(island.id, true);
      onComplete?.();
    });
    this.islandMarkers?.setIslandLit(island.id, true);
  }

  public sleepIsland(island: IslandData, onComplete?: () => void) {
    if (!this.terrain) return;
    this.terrain.sleepIsland(island.maskId, 1400, () => {
      this.islandMarkers?.setIslandLit(island.id, false);
      onComplete?.();
    });
    this.islandMarkers?.setIslandLit(island.id, false);
  }

  public toggleIslandLit(island: IslandData, onComplete?: (isLit: boolean) => void) {
    if (!this.terrain) return;
    const isCurrentlyLit = this.terrain.getIslandLit(island.maskId) > 0.5;
    if (isCurrentlyLit) {
      this.sleepIsland(island, () => onComplete?.(false));
    } else {
      this.awakenIsland(island, () => onComplete?.(true));
    }
  }

  public isIslandLit(island: IslandData): boolean {
    if (!this.terrain) return false;
    return this.terrain.getIslandLit(island.maskId) > 0.5;
  }

  public setIslandLitImmediate(island: IslandData, isLit: boolean): void {
    if (this.terrain) {
      this.terrain.setIslandLit(island.maskId, isLit ? 1.0 : 0.0);
    }
    this.islandMarkers?.setIslandLit(island.id, isLit);
  }

  public updateIslandEconomies(
    economies: Record<string, IslandEconomyState> | Map<string, IslandEconomyState>
  ): void {
    this.islandMarkers?.updateEconomies(economies);
    this.terrain?.updateIslandEconomies(
      economies,
      this.islandMarkers?.islands,
      this.islandMarkers?.selectedIslandId
    );
  }

  public showShipPopup(shipId: string, options: ShipPopupOptions): void {
    this.shipPopups.show(shipId, options);
  }

  public catapultGoods(
    startLon: number,
    startLat: number,
    endLon: number,
    endLat: number,
    payload: {
      goodIcon: string;
      goodColor: string;
      count?: number;
      label?: string;
      isDelivery?: boolean;
    }
  ): void {
    if (!this.terrain) return;
    const startWorld = this.terrain.lonLatToWorld(startLon, startLat);
    const endWorld = this.terrain.lonLatToWorld(endLon, endLat);
    this.goodsCatapult.launch(startWorld, endWorld, payload);
  }

  public setSelectedIsland(islandId: string | null) {
    this.islandMarkers?.setSelectedIsland(islandId);
    this.terrain?.setSelectedIsland(islandId);
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

    const now = performance.now();
    const elapsedTime = (now - this.startTime) * 0.001;
    const deltaSec = Math.min(0.2, (now - this.lastFrameTime) * 0.001);
    this.lastFrameTime = now;

    if (this.onTick) {
      this.onTick(deltaSec);
    }

    // Update camera intro or transitions
    this.cameraManager.update();
    this.controls.update();

    // Update terrain water ripples & camera pos
    if (this.terrain) {
      this.terrain.update(elapsedTime, this.camera);
    }

    // Update surrounding world ocean shimmer
    if (this.surroundingWorld) {
      this.surroundingWorld.update(elapsedTime);
    }

    // Update island beacons and label coordinates
    if (this.islandMarkers) {
      this.islandMarkers.update(elapsedTime);
    }

    // Update active shipping fleet
    if (this.shipsRenderer && this.terrain && this.shipManager) {
      this.shipsRenderer.update(this.shipManager.ships, this.terrain, elapsedTime, this.camera);
    }

    // Update floating ship dispatch messages (compact micro-pills)
    if (this.terrain && this.shipManager) {
      this.shipPopups.update(this.shipManager.ships, this.terrain, this.camera);
    }

    // Update 3D goods catapult parabolic flights & impact rings
    this.goodsCatapult.update(this.camera);

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onWindowResize);
    this.controls.dispose();
    this.goodsCatapult.clear();
    this.shipsRenderer?.dispose();
    this.renderer.dispose();
  }
}
