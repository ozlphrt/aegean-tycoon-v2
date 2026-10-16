import type { AegeanTerrain } from './Terrain';
import type * as THREE from 'three';

export interface DEMParams {
  greenLimit: number;
  brownStart: number;
  brownPeak: number;
  whiteStart: number;
  displacementScale: number;
}

export interface NightLightingParams {
  moonlight: number;
  ambient: number;
  cityGlow: number;
  moonGlint: number;
}

export interface DayLightParams {
  sunIntensity: number;
  ambient: number;
  warmth: number;
  saturation: number;
  seaBrilliance: number;
}

const STORAGE_KEY_DEM = 'aegean_dem_params_v2';
const STORAGE_KEY_NIGHT = 'aegean_night_params_v2';
const STORAGE_KEY_DAY = 'aegean_day_params_v2';

// New user-defined authoritative defaults
const DEFAULT_DEM_PARAMS: DEMParams = {
  greenLimit: 0.020,
  brownStart: 0.065,
  brownPeak: 0.380,
  whiteStart: 0.780,
  displacementScale: 1.00,
};

const DEFAULT_NIGHT_PARAMS: NightLightingParams = {
  moonlight: 0.55,
  ambient: 0.40,
  cityGlow: 0.20,
  moonGlint: 0.40,
};

const DEFAULT_DAY_PARAMS: DayLightParams = {
  sunIntensity: 0.20,
  ambient: 1.80,
  warmth: 0.36,
  saturation: 0.50,
  seaBrilliance: 0.60,
};

export class SettingsPanel {
  private panel: HTMLElement;
  private activeTab: 'dem' | 'night' | 'day' = 'dem';
  private demParams: DEMParams;
  private nightParams: NightLightingParams;
  private dayParams: DayLightParams;

  constructor(
    private terrain: AegeanTerrain,
    private sceneLights?: {
      moonLight?: THREE.DirectionalLight;
      ambientLight?: THREE.AmbientLight;
    },
    private onTabChange?: (tab: 'dem' | 'night' | 'day') => void
  ) {
    this.demParams = this.loadDEMParams();
    this.nightParams = this.loadNightParams();
    this.dayParams = this.loadDayParams();

    this.applyDEMParams();
    this.applyNightParams();
    this.applyDayParams();

    this.panel = this.createUI();
    document.body.appendChild(this.panel);
    this.updatePreviewGradient();

    // Initialize active tab to match initial terrain view mode
    const initialMode = this.terrain.material.uniforms.uViewMode.value;
    if (initialMode === 1) this.switchTab('day', false);
    else if (initialMode === 2) this.switchTab('dem', false);
    else this.switchTab('night', false);
  }

  private loadDEMParams(): DEMParams {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DEM);
      if (saved) {
        return { ...DEFAULT_DEM_PARAMS, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_DEM_PARAMS };
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

  public applyDEMParams() {
    this.terrain.setDEMParams(
      this.demParams.greenLimit,
      this.demParams.brownStart,
      this.demParams.brownPeak,
      this.demParams.whiteStart
    );
    this.terrain.setDisplacementScale(this.demParams.displacementScale);
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
  }

  public applyDayParams() {
    this.terrain.setDayLightParams(
      this.dayParams.sunIntensity,
      this.dayParams.ambient,
      this.dayParams.warmth,
      this.dayParams.saturation,
      this.dayParams.seaBrilliance
    );
  }

  public show(tab?: 'dem' | 'night' | 'day') {
    if (tab) {
      this.switchTab(tab, false);
    } else {
      // Automatically follow current terrain view mode on main screen
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

  public toggle(tab?: 'dem' | 'night' | 'day') {
    if (this.panel.style.display === 'none') {
      this.show(tab);
    } else if (tab && this.activeTab !== tab) {
      this.switchTab(tab, true);
    } else {
      this.hide();
    }
  }

  public switchTab(tab: 'dem' | 'night' | 'day', notify = false) {
    this.activeTab = tab;

    const tabDemBtn = this.panel.querySelector('#tab-btn-dem') as HTMLElement;
    const tabNightBtn = this.panel.querySelector('#tab-btn-night') as HTMLElement;
    const tabDayBtn = this.panel.querySelector('#tab-btn-day') as HTMLElement;

    const tabDemContent = this.panel.querySelector('#tab-content-dem') as HTMLElement;
    const tabNightContent = this.panel.querySelector('#tab-content-night') as HTMLElement;
    const tabDayContent = this.panel.querySelector('#tab-content-day') as HTMLElement;

    tabDemBtn?.classList.toggle('active', tab === 'dem');
    tabNightBtn?.classList.toggle('active', tab === 'night');
    tabDayBtn?.classList.toggle('active', tab === 'day');

    if (tabDemContent) tabDemContent.style.display = tab === 'dem' ? 'block' : 'none';
    if (tabNightContent) tabNightContent.style.display = tab === 'night' ? 'block' : 'none';
    if (tabDayContent) tabDayContent.style.display = tab === 'day' ? 'block' : 'none';

    if (tab === 'dem') {
      this.updatePreviewGradient();
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

    el.innerHTML = `
      <div class="settings-panel-header">
        <div class="settings-title">
          <span class="icon">⚙️</span>
          <span>Graphics & Visual Settings</span>
        </div>
        <button id="settings-btn-close" class="btn-icon" title="Close Settings (Esc)">✕</button>
      </div>

      <!-- Navigation Tabs -->
      <div class="settings-tabs" role="tablist">
        <button id="tab-btn-dem" class="settings-tab-btn active" role="tab" title="DEM Topography & Colors">🏔️ DEM</button>
        <button id="tab-btn-night" class="settings-tab-btn" role="tab" title="Night Lights & Moonlight">🌙 Night</button>
        <button id="tab-btn-day" class="settings-tab-btn" role="tab" title="Daylight Sun & Colors">☀️ Day</button>
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

        <!-- Presets -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Lighting Moods</span>
          <div class="settings-preset-buttons">
            <button class="settings-preset-btn" id="preset-night-default">🌙 Default Night</button>
            <button class="settings-preset-btn" id="preset-night-fullmoon">🌕 Radiant Full Moon</button>
            <button class="settings-preset-btn" id="preset-night-harbor">💡 Harbor Glow</button>
            <button class="settings-preset-btn" id="preset-night-ocean">🌊 Silver Sea</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-actions-row">
          <button id="btn-copy-night" class="btn-secondary btn-sm">📋 Copy Code</button>
          <button id="btn-reset-night" class="btn-text btn-sm">🔄 Reset</button>
        </div>
      </div>

      <!-- TAB 3: Day Light & Color Tuner -->
      <div id="tab-content-day" class="settings-tab-content" style="display: none;">
        <p class="settings-desc">Calibrate daylight sun intensity, atmospheric sky fill, warmth, and vibrancy:</p>

        <!-- Slider 1: Direct Sun Radiance -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">☀️ Direct Sun Radiance</span>
            <span id="val-day-sun" class="settings-val">${this.dayParams.sunIntensity.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-day-sun" min="0.20" max="2.50" step="0.05" value="${this.dayParams.sunIntensity}" class="settings-slider" />
          <span class="settings-hint">Brilliance of directional morning Mediterranean sun</span>
        </div>

        <!-- Slider 2: Sky Ambient Fill -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌤️ Sky Ambient Fill</span>
            <span id="val-day-ambient" class="settings-val">${this.dayParams.ambient.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-day-ambient" min="0.20" max="2.50" step="0.05" value="${this.dayParams.ambient}" class="settings-slider" />
          <span class="settings-hint">Diffuse daylight scattering in shadowy valleys and cliffs</span>
        </div>

        <!-- Slider 3: Sunlight Warmth / Tint -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌅 Sunlight Warmth (Tint)</span>
            <span id="val-day-warmth" class="settings-val">${this.dayParams.warmth.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-day-warmth" min="0.00" max="1.00" step="0.02" value="${this.dayParams.warmth}" class="settings-slider" />
          <span class="settings-hint">0.0 = Crisp Cool Aegean • 0.5 = Balanced • 1.0 = Golden Hour</span>
        </div>

        <!-- Slider 4: Landscape Saturation -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌿 Landscape Saturation</span>
            <span id="val-day-saturation" class="settings-val">${this.dayParams.saturation.toFixed(2)}</span>
          </div>
          <input type="range" id="slider-day-saturation" min="0.00" max="1.50" step="0.05" value="${this.dayParams.saturation}" class="settings-slider" />
          <span class="settings-hint">0.0 = Sun-bleached Stone • 0.58 = Natural • 1.2+ = Lush Vivid</span>
        </div>

        <!-- Slider 5: Sea Azure Brilliance -->
        <div class="settings-control-group">
          <div class="settings-label-row">
            <span class="settings-label">🌊 Sea Azure Brilliance</span>
            <span id="val-day-sea" class="settings-val">${this.dayParams.seaBrilliance.toFixed(2)}×</span>
          </div>
          <input type="range" id="slider-day-sea" min="0.20" max="2.50" step="0.05" value="${this.dayParams.seaBrilliance}" class="settings-slider" />
          <span class="settings-hint">Vibrancy of coastal shelf turquoise and daylight sun glint</span>
        </div>

        <!-- Presets -->
        <div class="settings-presets-section">
          <span class="settings-section-title">Daylight Moods</span>
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

      <div id="settings-toast" class="dem-toast">Config copied to clipboard!</div>
    `;

    // Hook tab buttons
    el.querySelector('#tab-btn-dem')?.addEventListener('click', () => this.switchTab('dem', true));
    el.querySelector('#tab-btn-night')?.addEventListener('click', () => this.switchTab('night', true));
    el.querySelector('#tab-btn-day')?.addEventListener('click', () => this.switchTab('day', true));

    // Close button
    el.querySelector('#settings-btn-close')?.addEventListener('click', () => this.hide());

    // --- TAB 1: DEM Controls ---
    const sDemGreen = el.querySelector('#slider-dem-green') as HTMLInputElement;
    const sDemBrown = el.querySelector('#slider-dem-brown') as HTMLInputElement;
    const sDemPeak = el.querySelector('#slider-dem-peak') as HTMLInputElement;
    const sDemWhite = el.querySelector('#slider-dem-white') as HTMLInputElement;
    const sDemRelief = el.querySelector('#slider-dem-relief') as HTMLInputElement;

    const valDemGreen = el.querySelector('#val-dem-green') as HTMLElement;
    const valDemBrown = el.querySelector('#val-dem-brown') as HTMLElement;
    const valDemPeak = el.querySelector('#val-dem-peak') as HTMLElement;
    const valDemWhite = el.querySelector('#val-dem-white') as HTMLElement;
    const valDemRelief = el.querySelector('#val-dem-relief') as HTMLElement;

    const updateDEMFromSliders = () => {
      this.demParams.greenLimit = parseFloat(sDemGreen.value);
      this.demParams.brownStart = parseFloat(sDemBrown.value);
      this.demParams.brownPeak = parseFloat(sDemPeak.value);
      this.demParams.whiteStart = parseFloat(sDemWhite.value);
      this.demParams.displacementScale = parseFloat(sDemRelief.value);

      valDemGreen.textContent = this.demParams.greenLimit.toFixed(3);
      valDemBrown.textContent = this.demParams.brownStart.toFixed(3);
      valDemPeak.textContent = this.demParams.brownPeak.toFixed(3);
      valDemWhite.textContent = this.demParams.whiteStart.toFixed(3);
      valDemRelief.textContent = `${this.demParams.displacementScale.toFixed(2)}×`;

      this.updatePreviewGradient();
      this.applyDEMParams();
      this.saveDEMParams();
    };

    sDemGreen.addEventListener('input', updateDEMFromSliders);
    sDemBrown.addEventListener('input', updateDEMFromSliders);
    sDemPeak.addEventListener('input', updateDEMFromSliders);
    sDemWhite.addEventListener('input', updateDEMFromSliders);
    sDemRelief.addEventListener('input', updateDEMFromSliders);

    // DEM Presets
    const setDEMPreset = (p: Partial<DEMParams>) => {
      Object.assign(this.demParams, p);
      sDemGreen.value = this.demParams.greenLimit.toString();
      sDemBrown.value = this.demParams.brownStart.toString();
      sDemPeak.value = this.demParams.brownPeak.toString();
      sDemWhite.value = this.demParams.whiteStart.toString();
      if (p.displacementScale !== undefined) {
        sDemRelief.value = this.demParams.displacementScale.toString();
      }
      updateDEMFromSliders();
    };

    el.querySelector('#preset-dem-default')?.addEventListener('click', () => {
      setDEMPreset(DEFAULT_DEM_PARAMS);
    });
    el.querySelector('#preset-dem-warm')?.addEventListener('click', () => {
      setDEMPreset({ greenLimit: 0.015, brownStart: 0.045, brownPeak: 0.420, whiteStart: 0.820 });
    });
    el.querySelector('#preset-dem-green')?.addEventListener('click', () => {
      setDEMPreset({ greenLimit: 0.060, brownStart: 0.120, brownPeak: 0.450, whiteStart: 0.800 });
    });
    el.querySelector('#preset-dem-snow')?.addEventListener('click', () => {
      setDEMPreset({ greenLimit: 0.020, brownStart: 0.065, brownPeak: 0.300, whiteStart: 0.580 });
    });

    el.querySelector('#btn-reset-dem')?.addEventListener('click', () => {
      setDEMPreset(DEFAULT_DEM_PARAMS);
    });

    // --- TAB 2: Night Controls ---
    const sNightMoon = el.querySelector('#slider-night-moon') as HTMLInputElement;
    const sNightAmbient = el.querySelector('#slider-night-ambient') as HTMLInputElement;
    const sNightCities = el.querySelector('#slider-night-cities') as HTMLInputElement;
    const sNightGlint = el.querySelector('#slider-night-glint') as HTMLInputElement;

    const valNightMoon = el.querySelector('#val-night-moon') as HTMLElement;
    const valNightAmbient = el.querySelector('#val-night-ambient') as HTMLElement;
    const valNightCities = el.querySelector('#val-night-cities') as HTMLElement;
    const valNightGlint = el.querySelector('#val-night-glint') as HTMLElement;

    const updateNightFromSliders = () => {
      this.nightParams.moonlight = parseFloat(sNightMoon.value);
      this.nightParams.ambient = parseFloat(sNightAmbient.value);
      this.nightParams.cityGlow = parseFloat(sNightCities.value);
      this.nightParams.moonGlint = parseFloat(sNightGlint.value);

      valNightMoon.textContent = `${this.nightParams.moonlight.toFixed(2)}×`;
      valNightAmbient.textContent = `${this.nightParams.ambient.toFixed(2)}×`;
      valNightCities.textContent = `${this.nightParams.cityGlow.toFixed(2)}×`;
      valNightGlint.textContent = `${this.nightParams.moonGlint.toFixed(2)}×`;

      this.applyNightParams();
      this.saveNightParams();
    };

    sNightMoon.addEventListener('input', updateNightFromSliders);
    sNightAmbient.addEventListener('input', updateNightFromSliders);
    sNightCities.addEventListener('input', updateNightFromSliders);
    sNightGlint.addEventListener('input', updateNightFromSliders);

    // Night Presets
    const setNightPreset = (p: Partial<NightLightingParams>) => {
      Object.assign(this.nightParams, p);
      sNightMoon.value = this.nightParams.moonlight.toString();
      sNightAmbient.value = this.nightParams.ambient.toString();
      sNightCities.value = this.nightParams.cityGlow.toString();
      sNightGlint.value = this.nightParams.moonGlint.toString();
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

    // --- Toast & Copy Handlers ---
    const toast = el.querySelector('#settings-toast') as HTMLElement;
    const showToast = (msg: string) => {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2400);
    };

    el.querySelector('#btn-copy-dem')?.addEventListener('click', () => {
      const code = `// DEM Elevation Color Parameters\nterrain.setDEMParams(${this.demParams.greenLimit.toFixed(3)}, ${this.demParams.brownStart.toFixed(3)}, ${this.demParams.brownPeak.toFixed(3)}, ${this.demParams.whiteStart.toFixed(3)});\nterrain.setDisplacementScale(${this.demParams.displacementScale.toFixed(2)});`;
      navigator.clipboard.writeText(code).then(() => showToast('DEM Config copied to clipboard!'));
    });

    el.querySelector('#btn-copy-night')?.addEventListener('click', () => {
      const code = `// Night Lighting Parameters\nterrain.setNightLightingParams(${this.nightParams.moonlight.toFixed(2)}, ${this.nightParams.ambient.toFixed(2)}, ${this.nightParams.cityGlow.toFixed(2)}, ${this.nightParams.moonGlint.toFixed(2)});`;
      navigator.clipboard.writeText(code).then(() => showToast('Night Lighting Config copied to clipboard!'));
    });

    el.querySelector('#btn-copy-day')?.addEventListener('click', () => {
      const code = `// Day Light Color Parameters\nterrain.setDayLightParams(${this.dayParams.sunIntensity.toFixed(2)}, ${this.dayParams.ambient.toFixed(2)}, ${this.dayParams.warmth.toFixed(2)}, ${this.dayParams.saturation.toFixed(2)}, ${this.dayParams.seaBrilliance.toFixed(2)});`;
      navigator.clipboard.writeText(code).then(() => showToast('Day Light Config copied to clipboard!'));
    });

    return el;
  }

  private updatePreviewGradient() {
    const bar = document.getElementById('settings-gradient-bar');
    if (!bar) return;

    const gLim = Math.max(1, Math.round(this.demParams.greenLimit * 100));
    const bStart = Math.max(gLim + 1, Math.round(this.demParams.brownStart * 100));
    const bPeak = Math.max(bStart + 2, Math.round(this.demParams.brownPeak * 100));
    const wStart = Math.max(bPeak + 2, Math.round(this.demParams.whiteStart * 100));

    bar.style.background = `linear-gradient(to right,
      #05381d 0%,
      #205615 ${gLim}%,
      #576722 ${Math.round((gLim + bStart) / 2)}%,
      #887334 ${bStart}%,
      #aa7d48 ${Math.round((bStart + bPeak) / 2)}%,
      #936138 ${bPeak}%,
      #c2a784 ${Math.round((bPeak + wStart) / 2)}%,
      #d7ccc0 ${wStart}%,
      #edeef3 100%
    )`;
  }
}
