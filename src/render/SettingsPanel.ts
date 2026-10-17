import type { AegeanTerrain } from './Terrain';
import type { SurroundingWorld } from './SurroundingWorld';
import type { BoatWakeRenderer, WakeParams } from './BoatWake';
import { DEFAULT_WAKE_PARAMS } from './BoatWake';
import { icons, ICON_THEMES, type IconStyle } from './Icons';
import { audio } from '../audio/AudioManager';
import { getLanguage, setLanguage, onLanguageChange, type SupportedLanguage } from '../ui/i18n';
import { confirmModal } from './ConfirmModal';
import type * as THREE from 'three';

export type SettingsTabId = 'dem' | 'night' | 'day' | 'wake' | 'audio' | 'game' | 'credits';

export interface GameSaveCallbacks {
  onSave?: () => boolean;
  onLoad?: () => boolean;
  onReset?: () => void;
  getSaveTimestamp?: () => number | null;
}

export interface DEMColors {
  coast: string;
  valley: string;
  foothill: string;
  slope: string;
  ridge: string;
  summit: string;
}

export const DEFAULT_DEM_COLORS: DEMColors = {
  coast: '#1e433d',
  valley: '#35512f',
  foothill: '#535a30',
  slope: '#8a7d6a',
  ridge: '#b7874e',
  summit: '#efeff5',
};

export interface DEMParams {
  greenLimit: number;
  brownStart: number;
  brownPeak: number;
  whiteStart: number;
  displacementScale: number;
  sunRadiance: number;
  ambientFill: number;
  sunWarmth: number;
  reliefStrength: number;
  colors: DEMColors;
}

export interface NightLightingParams {
  moonlight: number;
  ambient: number;
  cityGlow: number;
  moonGlint: number;
  islandLightRadius?: number;
}

export interface DayLightParams {
  sunIntensity: number;
  ambient: number;
  warmth: number;
  saturation: number;
  seaBrilliance: number;
}

const STORAGE_KEY_DEM = 'aegean_dem_params_v4';
const STORAGE_KEY_NIGHT = 'aegean_night_params_v3';
const STORAGE_KEY_DAY = 'aegean_day_params_v3';
const STORAGE_KEY_WAKE = 'aegean_wake_params_v2';

// User-defined authoritative defaults
const DEFAULT_DEM_PARAMS: DEMParams = {
  greenLimit: 0.015,
  brownStart: 0.075,
  brownPeak: 0.500,
  whiteStart: 0.700,
  displacementScale: 0.85,
  sunRadiance: 2.05,
  ambientFill: 0.60,
  sunWarmth: 0.00,
  reliefStrength: 1.50,
  colors: { ...DEFAULT_DEM_COLORS },
};

const DEFAULT_NIGHT_PARAMS: NightLightingParams = {
  moonlight: 0.55,
  ambient: 0.40,
  cityGlow: 0.20,
  moonGlint: 0.40,
  islandLightRadius: 0.45,
};

const DEFAULT_DAY_PARAMS: DayLightParams = {
  sunIntensity: 0.20,
  ambient: 1.80,
  warmth: 0.36,
  saturation: 0.50,
  seaBrilliance: 0.60,
};

const DEM_COLOR_DEFS: Array<{
  key: keyof DEMColors;
  emoji: string;
  name: string;
  desc: string;
}> = [
  { key: 'coast', emoji: '🌱', name: 'Coast Shoreline', desc: 'Shoreline fringe & beach border' },
  { key: 'valley', emoji: '🌿', name: 'Lowland Valley', desc: 'Fertile lowlands & valley floor' },
  { key: 'foothill', emoji: '🌾', name: 'Foothill Olive', desc: 'Terraces & dry olive foothills' },
  { key: 'slope', emoji: '🏜️', name: 'Mountain Slope', desc: 'Warm Mediterranean terracotta clay' },
  { key: 'ridge', emoji: '🏛️', name: 'High Ridge', desc: 'Rocky cliffs & pale limestone buff' },
  { key: 'summit', emoji: '❄️', name: 'Alpine Summit', desc: 'Highest peaks & alpine snow' },
];

// Color space conversion utilities
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n * 255)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }

  return {
    h: (h + 360) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  if (s === 0) {
    return rgbToHex(l, l, l);
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = hue2rgb(p, q, h + 1/3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1/3);

  return rgbToHex(r, g, b);
}

export class SettingsPanel {
  private panel: HTMLElement;
  private activeTab: SettingsTabId = 'dem';
  private demParams: DEMParams;
  private nightParams: NightLightingParams;
  private dayParams: DayLightParams;
  private wakeParams: WakeParams;
  private colorSyncCallbacks: Array<() => void> = [];

  constructor(
    private terrain: AegeanTerrain,
    private sceneLights?: {
      moonLight?: THREE.DirectionalLight;
      ambientLight?: THREE.AmbientLight;
    },
    private onTabChange?: (tab: SettingsTabId) => void,
    private surroundingWorld?: SurroundingWorld,
    private wakeRenderer?: BoatWakeRenderer,
    private gameSaveCallbacks?: GameSaveCallbacks
  ) {
    this.demParams = this.loadDEMParams();
    this.nightParams = this.loadNightParams();
    this.dayParams = this.loadDayParams();
    this.wakeParams = this.loadWakeParams();

    this.applyDEMParams();
    this.applyNightParams();
    this.applyDayParams();
    this.applyWakeParams();

    this.panel = this.createUI();
    document.body.appendChild(this.panel);
    this.updatePreviewGradient();

    // Initialize active tab to match initial terrain view mode
    const initialMode = this.terrain.material.uniforms.uViewMode.value;
    if (initialMode === 1) this.switchTab('day', false);
    else if (initialMode === 2) this.switchTab('dem', false);
    else this.switchTab('night', false);
  }

  public setGameSaveCallbacks(callbacks: GameSaveCallbacks): void {
    this.gameSaveCallbacks = callbacks;
    this.updateSaveStatusDisplay();
  }

  private loadDEMParams(): DEMParams {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DEM);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DEM_PARAMS,
          ...parsed,
          colors: { ...DEFAULT_DEM_COLORS, ...(parsed.colors || {}) },
        };
      }
    } catch {
      // Fallback
    }
    return {
      ...DEFAULT_DEM_PARAMS,
      colors: { ...DEFAULT_DEM_COLORS },
    };
  }

  private loadNightParams(): NightLightingParams {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NIGHT);
      if (saved) {
        return { ...DEFAULT_NIGHT_PARAMS, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_NIGHT_PARAMS };
  }

  private loadDayParams(): DayLightParams {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DAY);
      if (saved) {
        return { ...DEFAULT_DAY_PARAMS, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_DAY_PARAMS };
  }

  private saveDEMParams() {
    try {
      localStorage.setItem(STORAGE_KEY_DEM, JSON.stringify(this.demParams));
    } catch {
      // Ignore
    }
  }

  private saveNightParams() {
    try {
      localStorage.setItem(STORAGE_KEY_NIGHT, JSON.stringify(this.nightParams));
    } catch {
      // Ignore
    }
  }

  private saveDayParams() {
    try {
      localStorage.setItem(STORAGE_KEY_DAY, JSON.stringify(this.dayParams));
    } catch {
      // Ignore
    }
  }

  private loadWakeParams(): WakeParams {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WAKE);
      if (saved) {
        return { ...DEFAULT_WAKE_PARAMS, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_WAKE_PARAMS };
  }

  private saveWakeParams() {
    try {
      localStorage.setItem(STORAGE_KEY_WAKE, JSON.stringify(this.wakeParams));
    } catch {
      // Ignore
    }
  }

  public setWakeRenderer(wakeRenderer: BoatWakeRenderer) {
    this.wakeRenderer = wakeRenderer;
    this.applyWakeParams();
  }

  public applyWakeParams() {
    if (this.wakeRenderer) {
      this.wakeRenderer.setParams(this.wakeParams);
    }
  }

  public setSurroundingWorld(sw: SurroundingWorld) {
    this.surroundingWorld = sw;
    this.applyDEMParams();
    this.applyNightParams();
    this.applyDayParams();
  }

  public applyDEMParams() {
    this.terrain.setDEMParams(
      this.demParams.greenLimit,
      this.demParams.brownStart,
      this.demParams.brownPeak,
      this.demParams.whiteStart
    );
    this.terrain.setDisplacementScale(this.demParams.displacementScale);
    this.terrain.setDEMColors(this.demParams.colors);
    this.terrain.setDEMLightParams(
      this.demParams.sunRadiance,
      this.demParams.ambientFill,
      this.demParams.sunWarmth,
      this.demParams.reliefStrength
    );

    if (this.surroundingWorld) {
      this.surroundingWorld.setDEMParams(
        this.demParams.greenLimit,
        this.demParams.brownStart,
        this.demParams.brownPeak,
        this.demParams.whiteStart
      );
      this.surroundingWorld.setDisplacementScale(this.demParams.displacementScale);
      this.surroundingWorld.setDEMColors(this.demParams.colors);
      this.surroundingWorld.setDEMLightParams(
        this.demParams.sunRadiance,
        this.demParams.ambientFill,
        this.demParams.sunWarmth,
        this.demParams.reliefStrength
      );
    }
  }

  public applyNightParams() {
    this.terrain.setNightLightingParams(
      this.nightParams.moonlight,
      this.nightParams.ambient,
      this.nightParams.cityGlow,
      this.nightParams.moonGlint
    );

    if (this.sceneLights?.moonLight) {
      this.sceneLights.moonLight.intensity = 5.2 * this.nightParams.moonlight;
    }
    if (this.sceneLights?.ambientLight) {
      this.sceneLights.ambientLight.intensity = 3.8 * this.nightParams.ambient;
    }
    if (this.nightParams.islandLightRadius !== undefined) {
      this.terrain.setIslandLightRadius(this.nightParams.islandLightRadius);
    }

    if (this.surroundingWorld) {
      this.surroundingWorld.setNightLightingParams(
        this.nightParams.moonlight,
        this.nightParams.ambient
      );
    }
  }

  public applyDayParams() {
    this.terrain.setDayLightParams(
      this.dayParams.sunIntensity,
      this.dayParams.ambient,
      this.dayParams.warmth,
      this.dayParams.saturation,
      this.dayParams.seaBrilliance
    );

    if (this.surroundingWorld) {
      this.surroundingWorld.setDayLightParams(
        this.dayParams.sunIntensity,
        this.dayParams.ambient,
        this.dayParams.warmth,
        this.dayParams.saturation
      );
    }
  }

  public show(tab?: SettingsTabId) {
    if (tab) {
      this.switchTab(tab, false);
    } else {
      const currentMode = this.terrain.material.uniforms.uViewMode.value;
      if (currentMode === 1) this.switchTab('day', false);
      else if (currentMode === 2) this.switchTab('dem', false);
      else this.switchTab('night', false);
    }
    this.panel.style.display = 'block';
  }

  public hide() {
    this.panel.style.display = 'none';
  }

  public toggle(tab?: SettingsTabId) {
    if (this.panel.style.display === 'none') {
      this.show(tab);
    } else if (tab && this.activeTab !== tab) {
      this.switchTab(tab, true);
    } else {
      this.hide();
    }
  }

  public switchTab(tab: SettingsTabId, notify = false) {
    this.activeTab = tab;

    const tabs: SettingsTabId[] = ['dem', 'night', 'day', 'wake', 'audio', 'game', 'credits'];
    for (const t of tabs) {
      const btn = this.panel.querySelector(`#tab-btn-${t}`) as HTMLElement | null;
      const content = this.panel.querySelector(`#tab-content-${t}`) as HTMLElement | null;
      btn?.classList.toggle('active', tab === t);
      if (content) {
        content.style.display = tab === t ? 'block' : 'none';
      }
    }

    if (tab === 'dem') {
      this.updatePreviewGradient();
    } else if (tab === 'game') {
      this.updateSaveStatusDisplay();
    }

    if (notify && this.onTabChange) {
      this.onTabChange(tab);
    }
  }

  private createUI(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'settings-modal-panel';
    el.className = 'glass-panel settings-panel';
    el.style.display = 'none';

    // Build color card markups dynamically
    const colorCardsHtml = DEM_COLOR_DEFS.map((def) => {
      const hex = this.demParams.colors[def.key];
      const { h, s, l } = hexToHsl(hex);
      return `
        <div class="dem-color-card" id="dem-color-card-${def.key}">
          <div class="dem-color-header" id="dem-color-header-${def.key}">
            <div class="dem-color-left">
              <input type="color" id="picker-dem-${def.key}" value="${hex}" class="dem-color-picker" title="Pick ${def.name} Color" />
              <span class="dem-color-name">${def.emoji} ${def.name}</span>
            </div>
            <div class="dem-color-right">
              <span id="badge-dem-${def.key}" class="dem-color-hex">${hex.toUpperCase()}</span>
              <span class="dem-color-chevron">▼</span>
            </div>
          </div>
          <div class="dem-color-details" id="details-dem-${def.key}">
            <div class="color-hsl-row">
              <div class="color-hsl-label">
                <span>🌈 Hue</span>
                <span id="val-hue-${def.key}" class="color-hsl-val">${h}°</span>
              </div>
              <input type="range" id="slider-hue-${def.key}" min="0" max="360" step="1" value="${h}" class="color-slider slider-hue" />
            </div>
            <div class="color-hsl-row">
              <div class="color-hsl-label">
                <span>🎨 Saturation</span>
                <span id="val-sat-${def.key}" class="color-hsl-val">${s}%</span>
              </div>
              <input type="range" id="slider-sat-${def.key}" min="0" max="100" step="1" value="${s}" class="color-slider slider-sat" />
            </div>
            <div class="color-hsl-row">
              <div class="color-hsl-label">
                <span>💡 Luminosity</span>
                <span id="val-lum-${def.key}" class="color-hsl-val">${l}%</span>
              </div>
              <input type="range" id="slider-lum-${def.key}" min="0" max="100" step="1" value="${l}" class="color-slider slider-lum" />
            </div>
          </div>
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="settings-panel-header">
        <div class="settings-title">
          <span class="icon">⚙️</span>
          <span>Graphics & Visual Settings</span>
        </div>
        <button id="settings-btn-close" class="btn-icon" title="Close Settings (Esc)">✕</button>
      </div>

      <!-- Icon Theme & Aesthetic Style Selector -->
      <div class="settings-icon-style-box">
        <div class="settings-label-row">
          <span class="settings-label">🏛️ Icon Theme & Aesthetic Style</span>
          <span id="val-icon-style" class="settings-val">Classical Antiquity</span>
        </div>
        <div class="settings-preset-buttons icon-style-selector-row">
          <button class="settings-preset-btn icon-theme-btn active" id="btn-theme-antiquity" title="Engraved Athenian tetradrachm, Olympic laurel, Antikythera gear">🏛️ Classical Antiquity</button>
          <button class="settings-preset-btn icon-theme-btn" id="btn-theme-minimalist" title="Crisp Aegean azure line vectors with Cycladic white accents">✨ Minimalist Hellenic</button>
          <button class="settings-preset-btn icon-theme-btn" id="btn-theme-imperial" title="High-contrast polished Athenian gold on obsidian">👑 Imperial Gold</button>
          <button class="settings-preset-btn icon-theme-btn" id="btn-theme-emoji" title="Standard OS system emojis">😀 Standard Emojis</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="settings-tabs" role="tablist">
        <button id="tab-btn-dem" class="settings-tab-btn active" role="tab" title="DEM Topography & Colors">🏔️ DEM</button>
        <button id="tab-btn-night" class="settings-tab-btn" role="tab" title="Night Lights & Moonlight">🌙 Night</button>
        <button id="tab-btn-day" class="settings-tab-btn" role="tab" title="Daylight Sun & Colors">☀️ Day</button>
        <button id="tab-btn-wake" class="settings-tab-btn" role="tab" title="Boat Wake & Water Dynamics">🌊 Wake</button>
        <button id="tab-btn-audio" class="settings-tab-btn" role="tab" title="Procedural Audio & Ambience">🔊 Audio</button>
        <button id="tab-btn-game" class="settings-tab-btn" role="tab" title="Game Save, Load & Reset">💾 Game</button>
        <button id="tab-btn-credits" class="settings-tab-btn" role="tab" title="Credits & Maritime Heritage">🏛️ Credits</button>
      </div>

      <!-- TAB 1: DEM Elevation & Colors -->
      <div id="tab-content-dem" class="settings-tab-content">
        <p class="settings-desc">Fine-tune where coastal green turns to warm mountain brown and alpine white:</p>

        <!-- Live Gradient Bar -->
        <div class="dem-gradient-container" title="Real-time Elevation Gradient Preview">
          <div id="settings-gradient-bar" class="dem-gradient-bar"></div>
        </div>

        <!-- Slider 1: Green Coast Limit -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌱 Green Coastal Limit</span>
            <span id="val-dem-green" class="settings-val">${this.demParams.greenLimit.toFixed(3)}</span>
          </div>
          <input type="range" id="slider-dem-green" min="0.005" max="0.150" step="0.005" value="${this.demParams.greenLimit}" class="settings-slider" />
          <span class="settings-hint">Coastal lowlands & fertile valleys before foothills</span>
        </div>

        <!-- Slider 2: Brown Slope Start -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌾 Brown Slope Start</span>
            <span id="val-dem-brown" class="settings-val">${this.demParams.brownStart.toFixed(3)}</span>
          </div>
          <input type="range" id="slider-dem-brown" min="0.020" max="0.250" step="0.005" value="${this.demParams.brownStart}" class="settings-slider" />
          <span class="settings-hint">Where warm Mediterranean brown takes over island hills</span>
        </div>

        <!-- Slider 3: Brown Peak -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">⛰️ Brown Peak Limit</span>
            <span id="val-dem-peak" class="settings-val">${this.demParams.brownPeak.toFixed(3)}</span>
          </div>
          <input type="range" id="slider-dem-peak" min="0.150" max="0.600" step="0.010" value="${this.demParams.brownPeak}" class="settings-slider" />
          <span class="settings-hint">Upper range of sienna clay before pale mountain limestone</span>
        </div>

        <!-- Slider 4: Alpine White Start -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">❄️ Alpine White Start</span>
            <span id="val-dem-white" class="settings-val">${this.demParams.whiteStart.toFixed(3)}</span>
          </div>
          <input type="range" id="slider-dem-white" min="0.450" max="0.950" step="0.010" value="${this.demParams.whiteStart}" class="settings-slider" />
          <span class="settings-hint">Highest mountain peaks transitioning into alpine snow</span>
        </div>

        <!-- Slider 5: 3D Relief Vertical Scale -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">📐 3D Relief Exaggeration</span>
            <span id="val-dem-relief" class="settings-val">${this.demParams.displacementScale.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-dem-relief" min="0.30" max="2.20" step="0.05" value="${this.demParams.displacementScale}" class="settings-slider" />
          <span class="settings-hint">Vertical mountain displacement scale</span>
        </div>

        <!-- DEM Topographic Lighting & Shading Controls -->
        <div class="dem-lighting-section">
          <div class="dem-colors-header-row">
            <span class="settings-section-title">☀️ Topographic Sun & Ambient Lighting</span>
            <span class="settings-hint">Radiance, ambient fill & warmth</span>
          </div>

          <!-- Slider: Direct Sun Radiance -->
          <div class="settings-control-group">
            <div class="settings-label-row">
              <span class="settings-label">☀️ Direct Sun Radiance</span>
              <span id="val-dem-sun" class="settings-val">${this.demParams.sunRadiance.toFixed(2)}×</span>
            </div>
            <input type="range" id="slider-dem-sun" min="0.10" max="2.50" step="0.05" value="${this.demParams.sunRadiance}" class="settings-slider" />
            <span class="settings-hint">Directional beam radiance illuminating sunward ridges and peaks</span>
          </div>

          <!-- Slider: Sky Ambient Fill -->
          <div class="settings-control-group">
            <div class="settings-label-row">
              <span class="settings-label">🌌 Sky Ambient Fill</span>
              <span id="val-dem-ambient" class="settings-val">${this.demParams.ambientFill.toFixed(2)}×</span>
            </div>
            <input type="range" id="slider-dem-ambient" min="0.05" max="1.50" step="0.05" value="${this.demParams.ambientFill}" class="settings-slider" />
            <span class="settings-hint">Atmospheric diffuse light filling shadows and mountain ravines</span>
          </div>

          <!-- Slider: Sunlight Warmth -->
          <div class="settings-control-group">
            <div class="settings-label-row">
              <span class="settings-label">🔥 Sunlight Warmth</span>
              <span id="val-dem-warmth" class="settings-val">${Math.round(this.demParams.sunWarmth * 100)}%</span>
            </div>
            <input type="range" id="slider-dem-warmth" min="0.00" max="1.00" step="0.02" value="${this.demParams.sunWarmth}" class="settings-slider" />
            <span class="settings-hint">Color temperature: cool alpine crispness (0%) to warm Mediterranean gold (100%)</span>
          </div>

          <!-- Slider: Relief Contrast -->
          <div class="settings-control-group">
            <div class="settings-label-row">
              <span class="settings-label">⛰️ Hillshade Relief Contrast</span>
              <span id="val-dem-contrast" class="settings-val">${this.demParams.reliefStrength.toFixed(2)}×</span>
            </div>
            <input type="range" id="slider-dem-contrast" min="0.10" max="1.50" step="0.05" value="${this.demParams.reliefStrength}" class="settings-slider" />
            <span class="settings-hint">Sharpness and prominence of ridges and mountain ravines</span>
          </div>
        </div>

        <!-- DEM Elevation Color Stops & Real-time HSL Sliders -->
        <div class="dem-colors-section">
          <div class="dem-colors-header-row">
            <span class="settings-section-title">🎨 Elevation Colors & HSL Tuner</span>
            <span class="settings-hint">Pick color or expand for Hue/Sat/Lum</span>
          </div>
          <div class="dem-colors-list">
            ${colorCardsHtml}
          </div>
        </div>

        <!-- Presets -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Color Balance Presets</span>
          <div class="settings-preset-buttons">
            <button class="settings-preset-btn" id="preset-dem-default">🏝️ Authoritative</button>
            <button class="settings-preset-btn" id="preset-dem-warm">🌾 Warm Clay</button>
            <button class="settings-preset-btn" id="preset-dem-green">🌿 More Green</button>
            <button class="settings-preset-btn" id="preset-dem-snow">❄️ Alpine Peaks</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-actions-row">
          <button id="btn-copy-dem" class="btn-secondary btn-sm">📋 Copy Code</button>
          <button id="btn-reset-dem" class="btn-text btn-sm">🔄 Reset</button>
        </div>
      </div>

      <!-- TAB 2: Night & Moon Lighting -->
      <div id="tab-content-night" class="settings-tab-content" style="display: none;">
        <p class="settings-desc">Calibrate nocturnal moonlight, ambient darkness, harbor embers, and sea reflection:</p>

        <!-- Slider 1: Moonlight Intensity -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌕 Moonlight Radiance</span>
            <span id="val-night-moon" class="settings-val">${this.nightParams.moonlight.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-night-moon" min="0.10" max="2.50" step="0.05" value="${this.nightParams.moonlight}" class="settings-slider" />
          <span class="settings-hint">Direct lunar light illuminating island slopes and sea</span>
        </div>

        <!-- Slider 2: Night Ambient Fill -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌌 Ambient Night Fill</span>
            <span id="val-night-ambient" class="settings-val">${this.nightParams.ambient.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-night-ambient" min="0.10" max="2.50" step="0.05" value="${this.nightParams.ambient}" class="settings-slider" />
          <span class="settings-hint">Deep sapphire nocturnal ambient shadow brightness</span>
        </div>

        <!-- Slider 3: City & Harbor Lights Glow -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🏙️ Harbor & City Lights</span>
            <span id="val-night-cities" class="settings-val">${this.nightParams.cityGlow.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-night-cities" min="0.00" max="3.00" step="0.05" value="${this.nightParams.cityGlow}" class="settings-slider" />
          <span class="settings-hint">Soft amber glow of harbor quays and coastal settlements</span>
        </div>

        <!-- Slider 4: Ocean Moon Specular (Yakamoz) -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌊 Ocean Moon Track (Yakamoz)</span>
            <span id="val-night-glint" class="settings-val">${this.nightParams.moonGlint.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-night-glint" min="0.00" max="3.00" step="0.05" value="${this.nightParams.moonGlint}" class="settings-slider" />
          <span class="settings-hint">Shimmering silver reflection track across Aegean waves</span>
        </div>

        <!-- Slider 5: Island Daylight Halo Radius -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🏝️ Island Light Fade Reach</span>
            <span id="val-night-radius" class="settings-val">${Math.round((this.nightParams.islandLightRadius ?? 0.45) * 14)} km</span>
          </div>
          <input type="range" id="slider-night-radius" min="0.10" max="1.00" step="0.05" value="${this.nightParams.islandLightRadius ?? 0.45}" class="settings-slider" />
          <span class="settings-hint">Distance over which awakened island daylight softly fades into surrounding sea</span>
        </div>

        <!-- Presets -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Atmospheric Night Presets</span>
          <div class="settings-preset-buttons">
            <button class="settings-preset-btn" id="preset-night-default">🌙 Balanced Night</button>
            <button class="settings-preset-btn" id="preset-night-fullmoon">🌕 Radiant Moon</button>
            <button class="settings-preset-btn" id="preset-night-harbor">🏮 Harbor Glow</button>
            <button class="settings-preset-btn" id="preset-night-ocean">🌊 Silver Sea</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-actions-row">
          <button id="btn-copy-night" class="btn-secondary btn-sm">📋 Copy Code</button>
          <button id="btn-reset-night" class="btn-text btn-sm">🔄 Reset</button>
        </div>
      </div>

      <!-- TAB 3: Day & Sun Lighting -->
      <div id="tab-content-day" class="settings-tab-content" style="display: none;">
        <p class="settings-desc">Fine-tune Mediterranean sun radiance, atmospheric sky fill, warmth, and azure sea brilliance:</p>

        <!-- Slider 1: Direct Sun Radiance -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">☀️ Direct Sun Radiance</span>
            <span id="val-day-sun" class="settings-val">${this.dayParams.sunIntensity.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-day-sun" min="0.10" max="2.50" step="0.05" value="${this.dayParams.sunIntensity}" class="settings-slider" />
          <span class="settings-hint">Angled directional sunlight on island slopes (smooth hillshading)</span>
        </div>

        <!-- Slider 2: Sky Ambient Fill -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌤️ Sky Ambient Fill</span>
            <span id="val-day-ambient" class="settings-val">${this.dayParams.ambient.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-day-ambient" min="0.20" max="2.60" step="0.05" value="${this.dayParams.ambient}" class="settings-slider" />
          <span class="settings-hint">Diffuse atmospheric sky light illuminating valleys and shaded slopes</span>
        </div>

        <!-- Slider 3: Sunlight Warmth / Tint -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌅 Sunlight Warmth</span>
            <span id="val-day-warmth" class="settings-val">${this.dayParams.warmth.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-day-warmth" min="0.00" max="1.00" step="0.02" value="${this.dayParams.warmth}" class="settings-slider" />
          <span class="settings-hint">0 = Crisp Aegean cool white, 1 = Golden afternoon Mediterranean glow</span>
        </div>

        <!-- Slider 4: Landscape Saturation -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌿 Landscape Saturation</span>
            <span id="val-day-saturation" class="settings-val">${this.dayParams.saturation.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-day-saturation" min="0.00" max="1.50" step="0.05" value="${this.dayParams.saturation}" class="settings-slider" />
          <span class="settings-hint">Natural earth, dry brush, olive grove, and limestone saturation</span>
        </div>

        <!-- Slider 5: Sea Azure Brilliance -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌊 Sea Azure Brilliance</span>
            <span id="val-day-sea" class="settings-val">${this.dayParams.seaBrilliance.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-day-sea" min="0.30" max="2.20" step="0.05" value="${this.dayParams.seaBrilliance}" class="settings-slider" />
          <span class="settings-hint">Coastal shelf turquoise brilliance and sun glint shimmer</span>
        </div>

        <!-- Presets -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Daylight Mood Presets</span>
          <div class="settings-preset-buttons">
            <button class="settings-preset-btn" id="preset-day-default">☀️ Aegean Midday</button>
            <button class="settings-preset-btn" id="preset-day-golden">🌅 Golden Hour</button>
            <button class="settings-preset-btn" id="preset-day-turquoise">🏝️ Vivid Turquoise</button>
            <button class="settings-preset-btn" id="preset-day-arid">🏛️ Arid Limestone</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-actions-row">
          <button id="btn-copy-day" class="btn-secondary btn-sm">📋 Copy Code</button>
          <button id="btn-reset-day" class="btn-text btn-sm">🔄 Reset</button>
        </div>
      </div>

      <!-- TAB 4: Boat Wake & Water Disturbance -->
      <div id="tab-content-wake" class="settings-tab-content" style="display: none;">
        <p class="settings-desc">Fine-tune vessel hydrodynamic wakes, turbulent propeller wash, and expanding Kelvin wave shoulders:</p>

        <!-- Slider 1: Wake Lifetime -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">⏱️ Wake Lifetime</span>
            <span id="val-wake-lifetime" class="settings-val">${this.wakeParams.lifetime.toFixed(1)}s</span>
          </div>
          <input type="range" id="slider-wake-lifetime" min="0.4" max="5.0" step="0.1" value="${this.wakeParams.lifetime}" class="settings-slider" />
          <span class="settings-hint">Duration before disturbed water and foam trail fully dissipate</span>
        </div>

        <!-- Slider 2: Wave Spread -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">📐 Diverging Wave Spread</span>
            <span id="val-wake-spread" class="settings-val">${this.wakeParams.spread.toFixed(1)}×</span>
          </div>
          <input type="range" id="slider-wake-spread" min="1.0" max="6.0" step="0.2" value="${this.wakeParams.spread}" class="settings-slider" />
          <span class="settings-hint">Lateral expansion rate of the V-shaped Kelvin wave shoulders</span>
        </div>

        <!-- Slider 3: Propeller Wash Width -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌊 Propeller Wash Width</span>
            <span id="val-wake-width" class="settings-val">${this.wakeParams.washWidth.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-wake-width" min="0.50" max="3.00" step="0.05" value="${this.wakeParams.washWidth}" class="settings-slider" />
          <span class="settings-hint">Width of turbulent center froth relative to vessel beam</span>
        </div>

        <!-- Slider 4: Foam Opacity -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🫧 Foam Max Opacity</span>
            <span id="val-wake-opacity" class="settings-val">${Math.round(this.wakeParams.foamOpacity * 100)}%</span>
          </div>
          <input type="range" id="slider-wake-opacity" min="0.20" max="1.00" step="0.05" value="${this.wakeParams.foamOpacity}" class="settings-slider" />
          <span class="settings-hint">Maximum opacity of dense stern foam (water remains translucent underneath)</span>
        </div>

        <!-- Slider 5: Speed Response -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">⚡ Speed Response</span>
            <span id="val-wake-speed" class="settings-val">${this.wakeParams.speedResponse.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-wake-speed" min="0.50" max="2.50" step="0.10" value="${this.wakeParams.speedResponse}" class="settings-slider" />
          <span class="settings-hint">Sensitivity of wake length and turbulence to vessel cruising speed</span>
        </div>

        <!-- Presets -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Hydrodynamic Wake Presets</span>
          <div class="settings-preset-buttons">
            <button class="settings-preset-btn" id="preset-wake-default">🌊 Balanced Kaiki</button>
            <button class="settings-preset-btn" id="preset-wake-express">⚡ High Speed Ferry</button>
            <button class="settings-preset-btn" id="preset-wake-subtle">⛵ Subtle Coastal</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-actions-row">
          <button id="btn-copy-wake" class="btn-secondary btn-sm">📋 Copy Code</button>
          <button id="btn-reset-wake" class="btn-text btn-sm">🔄 Reset</button>
        </div>
      </div>

      <!-- TAB 5: Procedural Audio & Mediterranean Ambience -->
      <div id="tab-content-audio" class="settings-tab-content" style="display: none;">
        <p class="settings-desc">Procedural Web Audio API sound engine synthesizing ocean waves, coastal breezes, and harbor chimes in real-time:</p>

        <!-- Slider 1: Master Volume -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🔊 Master Volume</span>
            <span id="val-audio-master" class="settings-val">65%</span>
          </div>
          <input type="range" id="slider-audio-master" min="0" max="100" step="1" value="65" class="settings-slider" />
          <span class="settings-hint">Overall sound volume across ambience and special effects</span>
        </div>

        <!-- Slider 2: Ambience Volume -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌊 Ocean Surf & Wind</span>
            <span id="val-audio-ambience" class="settings-val">40%</span>
          </div>
          <input type="range" id="slider-audio-ambience" min="0" max="100" step="1" value="40" class="settings-slider" />
          <span class="settings-hint">Continuous procedural pink-noise Mediterranean ocean waves and sea breeze</span>
        </div>

        <!-- Slider 3: SFX Volume -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🔔 Maritime Sound Effects</span>
            <span id="val-audio-sfx" class="settings-val">70%</span>
          </div>
          <input type="range" id="slider-audio-sfx" min="0" max="100" step="1" value="70" class="settings-slider" />
          <span class="settings-hint">Cargo loading, coin clinks, ferry ticket chimes, and dawn fanfares</span>
        </div>

        <!-- Sound Preview Matrix -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Sound Preview Palette</span>
          <div class="settings-preset-buttons" style="grid-template-columns: repeat(3, 1fr);">
            <button class="settings-preset-btn" id="btn-sound-coin" title="Test coin delivery profit chime">🪙 Coin Clink</button>
            <button class="settings-preset-btn" id="btn-sound-ticket" title="Test ferry ticket fare chime">🎟️ Ferry Ticket</button>
            <button class="settings-preset-btn" id="btn-sound-yacht" title="Test VIP yacht shimmer chime">👑 VIP Yacht</button>
            <button class="settings-preset-btn" id="btn-sound-dock" title="Test cargo loading dock thud">⚓ Cargo Dock</button>
            <button class="settings-preset-btn" id="btn-sound-fanfare" title="Test dawn island illumination fanfare">🌟 Dawn Fanfare</button>
            <button class="settings-preset-btn" id="btn-audio-mute-toggle" title="Toggle audio mute state">🔇 Mute Audio</button>
          </div>
        </div>
      </div>

      <!-- TAB 6: Game Save, Load & Empire Progress -->
      <div id="tab-content-game" class="settings-tab-content" style="display: none;">
        <!-- Language Selection Section -->
        <div class="settings-presets-section" style="margin-top: 0; margin-bottom: 16px;">
          <span class="settings-section-title">🌐 Language / Γλώσσα / Dil</span>
          <p class="settings-hint" style="margin-bottom: 8px;">Select active game language (English, Greek, or Turkish):</p>
          <div class="settings-preset-buttons" id="settings-lang-buttons" style="grid-template-columns: repeat(3, 1fr);">
            <button class="settings-preset-btn ${getLanguage() === 'en' ? 'active' : ''}" data-lang-opt="en">🇬🇧 English</button>
            <button class="settings-preset-btn ${getLanguage() === 'el' ? 'active' : ''}" data-lang-opt="el">🇬🇷 Ελληνικά</button>
            <button class="settings-preset-btn ${getLanguage() === 'tr' ? 'active' : ''}" data-lang-opt="tr">🇹🇷 Türkçe</button>
          </div>
        </div>

        <p class="settings-desc">Persistent browser-saved state for your maritime shipping empire:</p>

        <div class="game-save-info-card">
          <div class="save-status-header">
            <span class="save-badge auto">⚡ Auto-Save Enabled</span>
            <span id="val-save-status" class="save-time">Last save: Never</span>
          </div>
          <p class="save-description">
            Your treasury, fleet positions, unlocked ports, and island market prices are automatically saved each in-game day and when closing the tab.
          </p>
        </div>

        <div class="game-actions-grid">
          <button id="btn-game-save" class="btn-primary" style="padding: 12px 16px; font-size: 0.82rem;">
            💾 Save Game Now
          </button>
          <button id="btn-game-load" class="btn-secondary" style="padding: 12px 16px; font-size: 0.82rem;">
            📂 Reload Saved Game
          </button>
        </div>

        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
          <div class="settings-label-row">
            <span class="settings-label" style="color: #ef4444;">⚠️ Danger Zone</span>
          </div>
          <p class="settings-hint" style="margin-bottom: 8px;">Reset all game progress and begin anew at Santorini and Naxos harbor:</p>
          <button id="btn-game-reset" class="btn-danger-mini">
            🔄 Reset Entire Archipelago (New Game)
          </button>
        </div>
      </div>

      <!-- TAB 7: Aegean Tycoon Credits & Heritage -->
      <div id="tab-content-credits" class="settings-tab-content" style="display: none;">
        <div class="credits-container">
          <div class="credits-header">
            <h3 style="font-family: var(--font-heading); color: var(--accent-gold); font-size: 1.1rem; margin-bottom: 4px;">Aegean Tycoon — Rebirth of the Archipelago</h3>
            <span class="subtle-tag" style="display: inline-block; margin-bottom: 12px;">Version 2.0 • Classical Mediterranean Edition</span>
          </div>
          <p style="font-size: 0.78rem; line-height: 1.5; color: #cbd5e1; margin-bottom: 12px;">
            A high-performance 3D maritime trade simulation celebrating Greek and Aegean shipping heritage, ancient maritime commerce, and the gradual illumination of the archipelago from night into radiant daylight.
          </p>
          <div class="credits-grid">
            <div class="credit-item">
              <span class="credit-role">Engine & 3D Shaders</span>
              <span class="credit-val">Three.js • TypeScript • Vite</span>
            </div>
            <div class="credit-item">
              <span class="credit-role">Audio Engine</span>
              <span class="credit-val">Procedural Web Audio API Synthesis</span>
            </div>
            <div class="credit-item">
              <span class="credit-role">Bathymetry Geodata</span>
              <span class="credit-val">GEBCO 2024 Global Ocean Terrain Grid</span>
            </div>
            <div class="credit-item">
              <span class="credit-role">Digital Elevation Model</span>
              <span class="credit-val">Copernicus EU-DEM 30m Resampled</span>
            </div>
            <div class="credit-item">
              <span class="credit-role">Typography</span>
              <span class="credit-val">Outfit & Inter (Google Fonts)</span>
            </div>
            <div class="credit-item">
              <span class="credit-role">Historical Tribute</span>
              <span class="credit-val">Dedicated to Aegean Kaiki Skippers & Seafarers</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast Notification -->
      <div id="settings-toast" class="dem-toast"></div>
    `;

    // Tab buttons
    el.querySelector('#tab-btn-dem')?.addEventListener('click', () => this.switchTab('dem', true));
    el.querySelector('#tab-btn-night')?.addEventListener('click', () => this.switchTab('night', true));
    el.querySelector('#tab-btn-day')?.addEventListener('click', () => this.switchTab('day', true));
    el.querySelector('#tab-btn-wake')?.addEventListener('click', () => this.switchTab('wake', true));
    el.querySelector('#tab-btn-audio')?.addEventListener('click', () => this.switchTab('audio', true));
    el.querySelector('#tab-btn-game')?.addEventListener('click', () => this.switchTab('game', true));
    el.querySelector('#tab-btn-credits')?.addEventListener('click', () => this.switchTab('credits', true));

    // Close button
    el.querySelector('#settings-btn-close')?.addEventListener('click', () => this.hide());

    // --- TAB 1: DEM Controls ---
    const sDemGreen = el.querySelector('#slider-dem-green') as HTMLInputElement;
    const sDemBrown = el.querySelector('#slider-dem-brown') as HTMLInputElement;
    const sDemPeak = el.querySelector('#slider-dem-peak') as HTMLInputElement;
    const sDemWhite = el.querySelector('#slider-dem-white') as HTMLInputElement;
    const sDemRelief = el.querySelector('#slider-dem-relief') as HTMLInputElement;
    const sDemSun = el.querySelector('#slider-dem-sun') as HTMLInputElement;
    const sDemAmbient = el.querySelector('#slider-dem-ambient') as HTMLInputElement;
    const sDemWarmth = el.querySelector('#slider-dem-warmth') as HTMLInputElement;
    const sDemContrast = el.querySelector('#slider-dem-contrast') as HTMLInputElement;

    const valDemGreen = el.querySelector('#val-dem-green') as HTMLElement;
    const valDemBrown = el.querySelector('#val-dem-brown') as HTMLElement;
    const valDemPeak = el.querySelector('#val-dem-peak') as HTMLElement;
    const valDemWhite = el.querySelector('#val-dem-white') as HTMLElement;
    const valDemRelief = el.querySelector('#val-dem-relief') as HTMLElement;
    const valDemSun = el.querySelector('#val-dem-sun') as HTMLElement;
    const valDemAmbient = el.querySelector('#val-dem-ambient') as HTMLElement;
    const valDemWarmth = el.querySelector('#val-dem-warmth') as HTMLElement;
    const valDemContrast = el.querySelector('#val-dem-contrast') as HTMLElement;

    const updateDEMFromSliders = () => {
      this.demParams.greenLimit = parseFloat(sDemGreen.value);
      this.demParams.brownStart = parseFloat(sDemBrown.value);
      this.demParams.brownPeak = parseFloat(sDemPeak.value);
      this.demParams.whiteStart = parseFloat(sDemWhite.value);
      this.demParams.displacementScale = parseFloat(sDemRelief.value);
      this.demParams.sunRadiance = parseFloat(sDemSun.value);
      this.demParams.ambientFill = parseFloat(sDemAmbient.value);
      this.demParams.sunWarmth = parseFloat(sDemWarmth.value);
      this.demParams.reliefStrength = parseFloat(sDemContrast.value);

      valDemGreen.textContent = this.demParams.greenLimit.toFixed(3);
      valDemBrown.textContent = this.demParams.brownStart.toFixed(3);
      valDemPeak.textContent = this.demParams.brownPeak.toFixed(3);
      valDemWhite.textContent = this.demParams.whiteStart.toFixed(3);
      valDemRelief.textContent = `${this.demParams.displacementScale.toFixed(2)}×`;
      valDemSun.textContent = `${this.demParams.sunRadiance.toFixed(2)}×`;
      valDemAmbient.textContent = `${this.demParams.ambientFill.toFixed(2)}×`;
      valDemWarmth.textContent = `${Math.round(this.demParams.sunWarmth * 100)}%`;
      valDemContrast.textContent = `${this.demParams.reliefStrength.toFixed(2)}×`;

      this.updatePreviewGradient();
      this.applyDEMParams();
      this.saveDEMParams();
    };

    sDemGreen.addEventListener('input', updateDEMFromSliders);
    sDemBrown.addEventListener('input', updateDEMFromSliders);
    sDemPeak.addEventListener('input', updateDEMFromSliders);
    sDemWhite.addEventListener('input', updateDEMFromSliders);
    sDemRelief.addEventListener('input', updateDEMFromSliders);
    sDemSun.addEventListener('input', updateDEMFromSliders);
    sDemAmbient.addEventListener('input', updateDEMFromSliders);
    sDemWarmth.addEventListener('input', updateDEMFromSliders);
    sDemContrast.addEventListener('input', updateDEMFromSliders);

    // Wire Color Card Controls (Picker + Hue + Saturation + Luminosity)
    this.colorSyncCallbacks = [];

    DEM_COLOR_DEFS.forEach((def) => {
      const card = el.querySelector(`#dem-color-card-${def.key}`) as HTMLElement;
      const header = el.querySelector(`#dem-color-header-${def.key}`) as HTMLElement;
      const picker = el.querySelector(`#picker-dem-${def.key}`) as HTMLInputElement;
      const badge = el.querySelector(`#badge-dem-${def.key}`) as HTMLElement;
      const sHue = el.querySelector(`#slider-hue-${def.key}`) as HTMLInputElement;
      const sSat = el.querySelector(`#slider-sat-${def.key}`) as HTMLInputElement;
      const sLum = el.querySelector(`#slider-lum-${def.key}`) as HTMLInputElement;
      const valHue = el.querySelector(`#val-hue-${def.key}`) as HTMLElement;
      const valSat = el.querySelector(`#val-sat-${def.key}`) as HTMLElement;
      const valLum = el.querySelector(`#val-lum-${def.key}`) as HTMLElement;

      const updateTrackGradients = (h: number, s: number, l: number) => {
        if (sSat) {
          sSat.style.background = `linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`;
        }
        if (sLum) {
          sLum.style.background = `linear-gradient(to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%))`;
        }
      };

      const syncUIFromHex = (hex: string) => {
        const { h, s, l } = hexToHsl(hex);
        picker.value = hex;
        badge.textContent = hex.toUpperCase();
        sHue.value = h.toString();
        sSat.value = s.toString();
        sLum.value = l.toString();
        valHue.textContent = `${h}°`;
        valSat.textContent = `${s}%`;
        valLum.textContent = `${l}%`;
        updateTrackGradients(h, s, l);
      };

      this.colorSyncCallbacks.push(() => {
        syncUIFromHex(this.demParams.colors[def.key]);
      });

      // Initialize tracks
      const initialHsl = hexToHsl(this.demParams.colors[def.key]);
      updateTrackGradients(initialHsl.h, initialHsl.s, initialHsl.l);

      // Header click toggles expand/collapse (unless clicking color picker itself)
      header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
        card.classList.toggle('expanded');
      });

      // Color picker input event
      picker.addEventListener('input', () => {
        const hex = picker.value;
        this.demParams.colors[def.key] = hex;
        const { h, s, l } = hexToHsl(hex);
        badge.textContent = hex.toUpperCase();
        sHue.value = h.toString();
        sSat.value = s.toString();
        sLum.value = l.toString();
        valHue.textContent = `${h}°`;
        valSat.textContent = `${s}%`;
        valLum.textContent = `${l}%`;
        updateTrackGradients(h, s, l);

        this.applyDEMParams();
        this.saveDEMParams();
        this.updatePreviewGradient();
      });

      // HSL slider handlers
      const handleHslChange = () => {
        const h = parseInt(sHue.value, 10);
        const s = parseInt(sSat.value, 10);
        const l = parseInt(sLum.value, 10);
        const hex = hslToHex(h, s, l);

        this.demParams.colors[def.key] = hex;
        picker.value = hex;
        badge.textContent = hex.toUpperCase();
        valHue.textContent = `${h}°`;
        valSat.textContent = `${s}%`;
        valLum.textContent = `${l}%`;
        updateTrackGradients(h, s, l);

        this.applyDEMParams();
        this.saveDEMParams();
        this.updatePreviewGradient();
      };

      sHue.addEventListener('input', handleHslChange);
      sSat.addEventListener('input', handleHslChange);
      sLum.addEventListener('input', handleHslChange);
    });

    // DEM Presets
    const setDEMPreset = (p: Partial<DEMParams>) => {
      Object.assign(this.demParams, p);
      if (p.colors) {
        this.demParams.colors = { ...this.demParams.colors, ...p.colors };
        this.colorSyncCallbacks.forEach((cb) => cb());
      }
      sDemGreen.value = this.demParams.greenLimit.toString();
      sDemBrown.value = this.demParams.brownStart.toString();
      sDemPeak.value = this.demParams.brownPeak.toString();
      sDemWhite.value = this.demParams.whiteStart.toString();
      if (p.displacementScale !== undefined) {
        sDemRelief.value = this.demParams.displacementScale.toString();
      }
      if (p.sunRadiance !== undefined) {
        sDemSun.value = this.demParams.sunRadiance.toString();
      }
      if (p.ambientFill !== undefined) {
        sDemAmbient.value = this.demParams.ambientFill.toString();
      }
      if (p.sunWarmth !== undefined) {
        sDemWarmth.value = this.demParams.sunWarmth.toString();
      }
      if (p.reliefStrength !== undefined) {
        sDemContrast.value = this.demParams.reliefStrength.toString();
      }
      updateDEMFromSliders();
    };

    el.querySelector('#preset-dem-default')?.addEventListener('click', () => {
      setDEMPreset(DEFAULT_DEM_PARAMS);
    });
    el.querySelector('#preset-dem-warm')?.addEventListener('click', () => {
      setDEMPreset({
        greenLimit: 0.015,
        brownStart: 0.045,
        brownPeak: 0.420,
        whiteStart: 0.820,
        sunRadiance: 1.05,
        ambientFill: 0.45,
        sunWarmth: 0.70,
        reliefStrength: 0.65,
        colors: {
          coast: '#0a361e',
          valley: '#284e1b',
          foothill: '#6b6326',
          slope: '#b46d3e',
          ridge: '#c8a67c',
          summit: '#eae5e0',
        },
      });
    });
    el.querySelector('#preset-dem-green')?.addEventListener('click', () => {
      setDEMPreset({
        greenLimit: 0.060,
        brownStart: 0.120,
        brownPeak: 0.450,
        whiteStart: 0.800,
        sunRadiance: 0.90,
        ambientFill: 0.60,
        sunWarmth: 0.25,
        reliefStrength: 0.55,
        colors: {
          coast: '#044218',
          valley: '#175e18',
          foothill: '#4e6d24',
          slope: '#9c7b44',
          ridge: '#bda485',
          summit: '#e9eef2',
        },
      });
    });
    el.querySelector('#preset-dem-snow')?.addEventListener('click', () => {
      setDEMPreset({
        greenLimit: 0.020,
        brownStart: 0.065,
        brownPeak: 0.300,
        whiteStart: 0.580,
        sunRadiance: 1.15,
        ambientFill: 0.40,
        sunWarmth: 0.15,
        reliefStrength: 0.85,
        colors: {
          coast: '#06341f',
          valley: '#1f4e18',
          foothill: '#545f2a',
          slope: '#8f7756',
          ridge: '#b5bcc8',
          summit: '#ffffff',
        },
      });
    });

    el.querySelector('#btn-reset-dem')?.addEventListener('click', () => {
      setDEMPreset(DEFAULT_DEM_PARAMS);
    });

    // --- TAB 2: Night Controls ---
    const sNightMoon = el.querySelector('#slider-night-moon') as HTMLInputElement;
    const sNightAmbient = el.querySelector('#slider-night-ambient') as HTMLInputElement;
    const sNightCities = el.querySelector('#slider-night-cities') as HTMLInputElement;
    const sNightGlint = el.querySelector('#slider-night-glint') as HTMLInputElement;
    const sNightRadius = el.querySelector('#slider-night-radius') as HTMLInputElement;

    const valNightMoon = el.querySelector('#val-night-moon') as HTMLElement;
    const valNightAmbient = el.querySelector('#val-night-ambient') as HTMLElement;
    const valNightCities = el.querySelector('#val-night-cities') as HTMLElement;
    const valNightGlint = el.querySelector('#val-night-glint') as HTMLElement;
    const valNightRadius = el.querySelector('#val-night-radius') as HTMLElement;

    const updateNightFromSliders = () => {
      this.nightParams.moonlight = parseFloat(sNightMoon.value);
      this.nightParams.ambient = parseFloat(sNightAmbient.value);
      this.nightParams.cityGlow = parseFloat(sNightCities.value);
      this.nightParams.moonGlint = parseFloat(sNightGlint.value);
      if (sNightRadius) {
        this.nightParams.islandLightRadius = parseFloat(sNightRadius.value);
      }

      valNightMoon.textContent = `${this.nightParams.moonlight.toFixed(2)}×`;
      valNightAmbient.textContent = `${this.nightParams.ambient.toFixed(2)}×`;
      valNightCities.textContent = `${this.nightParams.cityGlow.toFixed(2)}×`;
      valNightGlint.textContent = `${this.nightParams.moonGlint.toFixed(2)}×`;
      if (valNightRadius && this.nightParams.islandLightRadius !== undefined) {
        valNightRadius.textContent = `${Math.round(this.nightParams.islandLightRadius * 14)} km`;
      }

      this.applyNightParams();
      this.saveNightParams();
    };

    sNightMoon.addEventListener('input', updateNightFromSliders);
    sNightAmbient.addEventListener('input', updateNightFromSliders);
    sNightCities.addEventListener('input', updateNightFromSliders);
    sNightGlint.addEventListener('input', updateNightFromSliders);
    sNightRadius?.addEventListener('input', updateNightFromSliders);

    // Night Presets
    const setNightPreset = (p: Partial<NightLightingParams>) => {
      Object.assign(this.nightParams, p);
      sNightMoon.value = this.nightParams.moonlight.toString();
      sNightAmbient.value = this.nightParams.ambient.toString();
      sNightCities.value = this.nightParams.cityGlow.toString();
      sNightGlint.value = this.nightParams.moonGlint.toString();
      if (this.nightParams.islandLightRadius !== undefined && sNightRadius) {
        sNightRadius.value = this.nightParams.islandLightRadius.toString();
      }
      updateNightFromSliders();
    };

    el.querySelector('#preset-night-default')?.addEventListener('click', () => {
      setNightPreset(DEFAULT_NIGHT_PARAMS);
    });
    el.querySelector('#preset-night-fullmoon')?.addEventListener('click', () => {
      setNightPreset({ moonlight: 1.00, ambient: 1.00, cityGlow: 1.00, moonGlint: 1.00 });
    });
    el.querySelector('#preset-night-harbor')?.addEventListener('click', () => {
      setNightPreset({ moonlight: 0.40, ambient: 0.40, cityGlow: 1.50, moonGlint: 0.30 });
    });
    el.querySelector('#preset-night-ocean')?.addEventListener('click', () => {
      setNightPreset({ moonlight: 0.80, ambient: 0.50, cityGlow: 0.30, moonGlint: 1.80 });
    });

    el.querySelector('#btn-reset-night')?.addEventListener('click', () => {
      setNightPreset(DEFAULT_NIGHT_PARAMS);
    });

    // --- TAB 3: Day Controls ---
    const sDaySun = el.querySelector('#slider-day-sun') as HTMLInputElement;
    const sDayAmbient = el.querySelector('#slider-day-ambient') as HTMLInputElement;
    const sDayWarmth = el.querySelector('#slider-day-warmth') as HTMLInputElement;
    const sDaySat = el.querySelector('#slider-day-saturation') as HTMLInputElement;
    const sDaySea = el.querySelector('#slider-day-sea') as HTMLInputElement;

    const valDaySun = el.querySelector('#val-day-sun') as HTMLElement;
    const valDayAmbient = el.querySelector('#val-day-ambient') as HTMLElement;
    const valDayWarmth = el.querySelector('#val-day-warmth') as HTMLElement;
    const valDaySat = el.querySelector('#val-day-saturation') as HTMLElement;
    const valDaySea = el.querySelector('#val-day-sea') as HTMLElement;

    const updateDayFromSliders = () => {
      this.dayParams.sunIntensity = parseFloat(sDaySun.value);
      this.dayParams.ambient = parseFloat(sDayAmbient.value);
      this.dayParams.warmth = parseFloat(sDayWarmth.value);
      this.dayParams.saturation = parseFloat(sDaySat.value);
      this.dayParams.seaBrilliance = parseFloat(sDaySea.value);

      valDaySun.textContent = `${this.dayParams.sunIntensity.toFixed(2)}×`;
      valDayAmbient.textContent = `${this.dayParams.ambient.toFixed(2)}×`;
      valDayWarmth.textContent = this.dayParams.warmth.toFixed(2);
      valDaySat.textContent = this.dayParams.saturation.toFixed(2);
      valDaySea.textContent = `${this.dayParams.seaBrilliance.toFixed(2)}×`;

      this.applyDayParams();
      this.saveDayParams();
    };

    sDaySun.addEventListener('input', updateDayFromSliders);
    sDayAmbient.addEventListener('input', updateDayFromSliders);
    sDayWarmth.addEventListener('input', updateDayFromSliders);
    sDaySat.addEventListener('input', updateDayFromSliders);
    sDaySea.addEventListener('input', updateDayFromSliders);

    // Day Presets
    const setDayPreset = (p: Partial<DayLightParams>) => {
      Object.assign(this.dayParams, p);
      sDaySun.value = this.dayParams.sunIntensity.toString();
      sDayAmbient.value = this.dayParams.ambient.toString();
      sDayWarmth.value = this.dayParams.warmth.toString();
      sDaySat.value = this.dayParams.saturation.toString();
      sDaySea.value = this.dayParams.seaBrilliance.toString();
      updateDayFromSliders();
    };

    el.querySelector('#preset-day-default')?.addEventListener('click', () => {
      setDayPreset(DEFAULT_DAY_PARAMS);
    });
    el.querySelector('#preset-day-golden')?.addEventListener('click', () => {
      setDayPreset({ sunIntensity: 1.25, ambient: 0.90, warmth: 0.85, saturation: 0.75, seaBrilliance: 1.10 });
    });
    el.querySelector('#preset-day-turquoise')?.addEventListener('click', () => {
      setDayPreset({ sunIntensity: 1.15, ambient: 1.05, warmth: 0.38, saturation: 0.82, seaBrilliance: 1.45 });
    });
    el.querySelector('#preset-day-arid')?.addEventListener('click', () => {
      setDayPreset({ sunIntensity: 0.95, ambient: 0.90, warmth: 0.45, saturation: 0.35, seaBrilliance: 0.85 });
    });

    el.querySelector('#btn-reset-day')?.addEventListener('click', () => {
      setDayPreset(DEFAULT_DAY_PARAMS);
    });

    // --- TAB 4: Wake Controls & Handlers ---
    const sWakeLife = el.querySelector('#slider-wake-lifetime') as HTMLInputElement;
    const sWakeSpread = el.querySelector('#slider-wake-spread') as HTMLInputElement;
    const sWakeWidth = el.querySelector('#slider-wake-width') as HTMLInputElement;
    const sWakeOpacity = el.querySelector('#slider-wake-opacity') as HTMLInputElement;
    const sWakeSpeed = el.querySelector('#slider-wake-speed') as HTMLInputElement;

    const valWakeLife = el.querySelector('#val-wake-lifetime') as HTMLElement;
    const valWakeSpread = el.querySelector('#val-wake-spread') as HTMLElement;
    const valWakeWidth = el.querySelector('#val-wake-width') as HTMLElement;
    const valWakeOpacity = el.querySelector('#val-wake-opacity') as HTMLElement;
    const valWakeSpeed = el.querySelector('#val-wake-speed') as HTMLElement;

    const onWakeChange = () => {
      this.wakeParams.lifetime = parseFloat(sWakeLife.value);
      this.wakeParams.spread = parseFloat(sWakeSpread.value);
      this.wakeParams.washWidth = parseFloat(sWakeWidth.value);
      this.wakeParams.foamOpacity = parseFloat(sWakeOpacity.value);
      this.wakeParams.speedResponse = parseFloat(sWakeSpeed.value);

      if (valWakeLife) valWakeLife.textContent = `${this.wakeParams.lifetime.toFixed(1)}s`;
      if (valWakeSpread) valWakeSpread.textContent = `${this.wakeParams.spread.toFixed(1)}×`;
      if (valWakeWidth) valWakeWidth.textContent = `${this.wakeParams.washWidth.toFixed(2)}×`;
      if (valWakeOpacity) valWakeOpacity.textContent = `${Math.round(this.wakeParams.foamOpacity * 100)}%`;
      if (valWakeSpeed) valWakeSpeed.textContent = `${this.wakeParams.speedResponse.toFixed(2)}×`;

      this.applyWakeParams();
      this.saveWakeParams();
    };

    [sWakeLife, sWakeSpread, sWakeWidth, sWakeOpacity, sWakeSpeed].forEach((s) => {
      s?.addEventListener('input', onWakeChange);
    });

    const setWakePreset = (params: Partial<WakeParams>) => {
      Object.assign(this.wakeParams, params);
      if (sWakeLife) sWakeLife.value = this.wakeParams.lifetime.toString();
      if (sWakeSpread) sWakeSpread.value = this.wakeParams.spread.toString();
      if (sWakeWidth) sWakeWidth.value = this.wakeParams.washWidth.toString();
      if (sWakeOpacity) sWakeOpacity.value = this.wakeParams.foamOpacity.toString();
      if (sWakeSpeed) sWakeSpeed.value = this.wakeParams.speedResponse.toString();

      if (valWakeLife) valWakeLife.textContent = `${this.wakeParams.lifetime.toFixed(1)}s`;
      if (valWakeSpread) valWakeSpread.textContent = `${this.wakeParams.spread.toFixed(1)}×`;
      if (valWakeWidth) valWakeWidth.textContent = `${this.wakeParams.washWidth.toFixed(2)}×`;
      if (valWakeOpacity) valWakeOpacity.textContent = `${Math.round(this.wakeParams.foamOpacity * 100)}%`;
      if (valWakeSpeed) valWakeSpeed.textContent = `${this.wakeParams.speedResponse.toFixed(2)}×`;

      this.applyWakeParams();
      this.saveWakeParams();
    };

    el.querySelector('#preset-wake-default')?.addEventListener('click', () => {
      setWakePreset(DEFAULT_WAKE_PARAMS);
    });
    el.querySelector('#preset-wake-express')?.addEventListener('click', () => {
      setWakePreset({ lifetime: 2.0, spread: 4.0, washWidth: 1.30, foamOpacity: 0.50, speedResponse: 1.20 });
    });
    el.querySelector('#preset-wake-subtle')?.addEventListener('click', () => {
      setWakePreset({ lifetime: 0.8, spread: 2.2, washWidth: 0.90, foamOpacity: 0.30, speedResponse: 0.80 });
    });

    el.querySelector('#btn-reset-wake')?.addEventListener('click', () => {
      setWakePreset(DEFAULT_WAKE_PARAMS);
    });

    // --- Toast & Copy Handlers ---
    const toast = el.querySelector('#settings-toast') as HTMLElement;
    const showToast = (msg: string) => {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2400);
    };

    el.querySelector('#btn-copy-dem')?.addEventListener('click', () => {
      const colorsJson = JSON.stringify(this.demParams.colors, null, 2);
      const code = `// DEM Elevation & Light Parameters\nterrain.setDEMParams(${this.demParams.greenLimit.toFixed(3)}, ${this.demParams.brownStart.toFixed(3)}, ${this.demParams.brownPeak.toFixed(3)}, ${this.demParams.whiteStart.toFixed(3)});\nterrain.setDisplacementScale(${this.demParams.displacementScale.toFixed(2)});\nterrain.setDEMLightParams(${this.demParams.sunRadiance.toFixed(2)}, ${this.demParams.ambientFill.toFixed(2)}, ${this.demParams.sunWarmth.toFixed(2)}, ${this.demParams.reliefStrength.toFixed(2)});\nterrain.setDEMColors(${colorsJson});`;
      navigator.clipboard.writeText(code).then(() => showToast('DEM Config copied to clipboard!'));
    });

    el.querySelector('#btn-copy-night')?.addEventListener('click', () => {
      const code = `// Night Lighting Parameters\nterrain.setNightLightingParams(${this.nightParams.moonlight.toFixed(2)}, ${this.nightParams.ambient.toFixed(2)}, ${this.nightParams.cityGlow.toFixed(2)}, ${this.nightParams.moonGlint.toFixed(2)});\nterrain.setIslandLightRadius(${(this.nightParams.islandLightRadius ?? 0.45).toFixed(2)});`;
      navigator.clipboard.writeText(code).then(() => showToast('Night Lighting Config copied to clipboard!'));
    });

    el.querySelector('#btn-copy-day')?.addEventListener('click', () => {
      const code = `// Day Light Color Parameters\nterrain.setDayLightParams(${this.dayParams.sunIntensity.toFixed(2)}, ${this.dayParams.ambient.toFixed(2)}, ${this.dayParams.warmth.toFixed(2)}, ${this.dayParams.saturation.toFixed(2)}, ${this.dayParams.seaBrilliance.toFixed(2)});`;
      navigator.clipboard.writeText(code).then(() => showToast('Day Light Config copied to clipboard!'));
    });

    el.querySelector('#btn-copy-wake')?.addEventListener('click', () => {
      const code = `// Boat Wake Hydrodynamic Parameters\nwakeRenderer.setParams({\n  lifetime: ${this.wakeParams.lifetime.toFixed(1)},\n  spread: ${this.wakeParams.spread.toFixed(1)},\n  washWidth: ${this.wakeParams.washWidth.toFixed(2)},\n  foamOpacity: ${this.wakeParams.foamOpacity.toFixed(2)},\n  speedResponse: ${this.wakeParams.speedResponse.toFixed(2)},\n});`;
      navigator.clipboard.writeText(code).then(() => showToast('Wake Config copied to clipboard!'));
    });

    // --- Icon Theme Selector Handlers ---
    const updateIconThemeButtons = (activeStyle: IconStyle) => {
      const currentTheme = ICON_THEMES.find((t) => t.id === activeStyle);
      const valEl = el.querySelector('#val-icon-style');
      if (valEl && currentTheme) {
        valEl.textContent = currentTheme.name;
      }
      el.querySelector('#btn-theme-antiquity')?.classList.toggle('active', activeStyle === 'antiquity');
      el.querySelector('#btn-theme-minimalist')?.classList.toggle('active', activeStyle === 'minimalist');
      el.querySelector('#btn-theme-imperial')?.classList.toggle('active', activeStyle === 'imperial');
      el.querySelector('#btn-theme-emoji')?.classList.toggle('active', activeStyle === 'emoji');
    };

    updateIconThemeButtons(icons.getStyle());

    icons.onStyleChange((style) => {
      updateIconThemeButtons(style);
    });

    el.querySelector('#btn-theme-antiquity')?.addEventListener('click', () => {
      icons.setStyle('antiquity');
      updateIconThemeButtons('antiquity');
      showToast('🏛️ Switched to Classical Antiquity Icons!');
    });

    el.querySelector('#btn-theme-minimalist')?.addEventListener('click', () => {
      icons.setStyle('minimalist');
      updateIconThemeButtons('minimalist');
      showToast('✨ Switched to Minimalist Hellenic Icons!');
    });

    el.querySelector('#btn-theme-imperial')?.addEventListener('click', () => {
      icons.setStyle('imperial');
      updateIconThemeButtons('imperial');
      showToast('👑 Switched to Imperial Gold Icons!');
    });

    el.querySelector('#btn-theme-emoji')?.addEventListener('click', () => {
      icons.setStyle('emoji');
      updateIconThemeButtons('emoji');
      showToast('😀 Switched to Standard System Emojis!');
    });

    // --- TAB 5: Procedural Audio Controls & Previews ---
    const audioSettings = audio.getSettings();
    const sAudioMaster = el.querySelector('#slider-audio-master') as HTMLInputElement;
    const sAudioAmbience = el.querySelector('#slider-audio-ambience') as HTMLInputElement;
    const sAudioSfx = el.querySelector('#slider-audio-sfx') as HTMLInputElement;
    const valAudioMaster = el.querySelector('#val-audio-master') as HTMLElement;
    const valAudioAmbience = el.querySelector('#val-audio-ambience') as HTMLElement;
    const valAudioSfx = el.querySelector('#val-audio-sfx') as HTMLElement;
    const btnMuteToggle = el.querySelector('#btn-audio-mute-toggle') as HTMLElement;

    if (sAudioMaster) {
      sAudioMaster.value = Math.round(audioSettings.masterVolume * 100).toString();
      if (valAudioMaster) valAudioMaster.textContent = `${sAudioMaster.value}%`;
      sAudioMaster.addEventListener('input', () => {
        const vol = parseInt(sAudioMaster.value, 10) / 100;
        audio.setMasterVolume(vol);
        if (valAudioMaster) valAudioMaster.textContent = `${sAudioMaster.value}%`;
      });
    }

    if (sAudioAmbience) {
      sAudioAmbience.value = Math.round(audioSettings.ambienceVolume * 100).toString();
      if (valAudioAmbience) valAudioAmbience.textContent = `${sAudioAmbience.value}%`;
      sAudioAmbience.addEventListener('input', () => {
        const vol = parseInt(sAudioAmbience.value, 10) / 100;
        audio.setAmbienceVolume(vol);
        if (valAudioAmbience) valAudioAmbience.textContent = `${sAudioAmbience.value}%`;
      });
    }

    if (sAudioSfx) {
      sAudioSfx.value = Math.round(audioSettings.sfxVolume * 100).toString();
      if (valAudioSfx) valAudioSfx.textContent = `${sAudioSfx.value}%`;
      sAudioSfx.addEventListener('input', () => {
        const vol = parseInt(sAudioSfx.value, 10) / 100;
        audio.setSfxVolume(vol);
        if (valAudioSfx) valAudioSfx.textContent = `${sAudioSfx.value}%`;
      });
    }

    const updateMuteButtonState = () => {
      if (!btnMuteToggle) return;
      const isMuted = audio.isMuted();
      btnMuteToggle.textContent = isMuted ? '🔊 Unmute Audio' : '🔇 Mute Audio';
      btnMuteToggle.classList.toggle('active', isMuted);
    };
    updateMuteButtonState();

    btnMuteToggle?.addEventListener('click', () => {
      audio.toggleMute();
      updateMuteButtonState();
      showToast(audio.isMuted() ? '🔇 Audio muted' : '🔊 Audio unmuted');
    });

    // Sound previews
    el.querySelector('#btn-sound-coin')?.addEventListener('click', () => audio.playCoinSound());
    el.querySelector('#btn-sound-ticket')?.addEventListener('click', () => audio.playTicketSound());
    el.querySelector('#btn-sound-yacht')?.addEventListener('click', () => audio.playVipShimmerSound());
    el.querySelector('#btn-sound-dock')?.addEventListener('click', () => audio.playDockSound());
    el.querySelector('#btn-sound-fanfare')?.addEventListener('click', () => audio.playAwakeningFanfare());

    // --- TAB 6: Language Selection Handlers ---
    const updateLangButtons = (activeLang: SupportedLanguage) => {
      el.querySelectorAll('#settings-lang-buttons [data-lang-opt]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-lang-opt') === activeLang);
      });
    };

    onLanguageChange((lang) => {
      updateLangButtons(lang);
    });

    el.querySelectorAll('#settings-lang-buttons [data-lang-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang-opt') as SupportedLanguage | null;
        if (lang) {
          audio.playClickSound();
          setLanguage(lang);
          updateLangButtons(lang);
          const langNames: Record<SupportedLanguage, string> = {
            en: '🇬🇧 English',
            el: '🇬🇷 Ελληνικά',
            tr: '🇹🇷 Türkçe',
          };
          showToast(`🌐 Language switched to ${langNames[lang]}!`);
        }
      });
    });

    // --- TAB 6: Game Save / Load / Reset ---
    el.querySelector('#btn-game-save')?.addEventListener('click', () => {
      const ok = this.gameSaveCallbacks?.onSave?.();
      if (ok) {
        this.updateSaveStatusDisplay();
        showToast('💾 Game Saved Successfully!');
        audio.playCoinSound();
      } else {
        showToast('❌ Failed to save game.');
      }
    });

    el.querySelector('#btn-game-load')?.addEventListener('click', () => {
      const ok = this.gameSaveCallbacks?.onLoad?.();
      if (ok) {
        this.updateSaveStatusDisplay();
        showToast('📂 Game Loaded Successfully!');
        audio.playDockSound();
      } else {
        showToast('❌ No valid save file found to load.');
      }
    });

    el.querySelector('#btn-game-reset')?.addEventListener('click', async () => {
      const confirmed = await confirmModal.confirmGameReset();
      if (confirmed) {
        this.gameSaveCallbacks?.onReset?.();
        this.updateSaveStatusDisplay();
        showToast('🔄 Archipelago reset to initial dawn state.');
      }
    });

    return el;
  }

  public updateSaveStatusDisplay() {
    const statusEl = this.panel.querySelector('#val-save-status');
    if (!statusEl) return;

    const ts = this.gameSaveCallbacks?.getSaveTimestamp?.();
    if (ts && ts > 0) {
      const d = new Date(ts);
      statusEl.textContent = `Last save: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } else {
      statusEl.textContent = 'Last save: Never';
    }
  }

  private updatePreviewGradient() {
    const bar = document.getElementById('settings-gradient-bar');
    if (!bar) return;

    const gLim = Math.max(1, Math.round(this.demParams.greenLimit * 100));
    const bStart = Math.max(gLim + 1, Math.round(this.demParams.brownStart * 100));
    const bPeak = Math.max(bStart + 2, Math.round(this.demParams.brownPeak * 100));
    const wStart = Math.max(bPeak + 2, Math.round(this.demParams.whiteStart * 100));

    const cols = this.demParams.colors;

    bar.style.background = `linear-gradient(to right,
      ${cols.coast} 0%,
      ${cols.valley} ${gLim}%,
      ${cols.foothill} ${Math.round((gLim + bStart) / 2)}%,
      ${cols.slope} ${bStart}%,
      ${cols.ridge} ${bPeak}%,
      ${cols.summit} ${wStart}%,
      ${cols.summit} 100%
    )`;
  }
}
