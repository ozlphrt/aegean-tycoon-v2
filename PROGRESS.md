# Progress Log

## Current Milestone: M2 Completed ➔ Ready for M3 (Day/Night Reveal)

## Done
- [x] 2026-10-16 – Q&A completed, decisions locked (`docs/DECISIONS.md`). Personal non-commercial status confirmed.
- [x] 2026-10-16 – Planning docs, implementation guide, and kickoff prompt written.
- [x] 2026-10-16 – **M0: Project Scaffold**:
  - Vite + TypeScript (strict mode) + Vitest configured.
  - Three.js WebGL2 renderer initialized with ACESFilmic tone mapping and orbit camera.
  - Premium dark glassmorphism HUD with Google fonts (Outfit & Inter), time controls, metrics, left inspector panel, right notification feed, and bottom bar.
  - Pure simulation decoupling established (`src/sim/economy.ts` with unit tests passing).
- [x] 2026-10-16 – **M1: Geodata Bake Pipeline**:
  - Configured Aegean bbox: Lon [22.5, 29.5], Lat [34.8, 41.0] with latitude compression correction.
  - `tools/bake_satellite.py`: downloaded and stitched 2048x2048 EOX Sentinel-2 cloudless daylight texture (`day.jpg`).
  - `tools/bake_night_lights.py`: fetched NASA Black Marble VIIRS imagery, extracted warm Mediterranean amber city lights (`lights.png`), and produced deep navy night texture (`night.jpg`).
  - `tools/bake_heightmap.py`: downloaded and stitched AWS Terrarium DEM tiles, normalized sea bathymetry and land topography (`heightmap.png`).
  - `tools/bake_island_mask.py`: generated lossless 8-bit island ID mask (`island_mask.png`) for territory mapping.
  - Configured `public/data/islands.json` for 16 initial islands and mainland ports.
  - Built `tools/validate_bake.py` verifying all 5 textures (2048x2048) and mask coverage for 100% of islands.
  - Documented attribution and licenses in `CREDITS.md`.
- [x] 2026-10-16 – **M2: 3D Night Map**:
  - Created `src/render/Terrain.ts`: 384x384 vertex-displaced mesh reading `heightmap.png` with non-linear relief scaling (islands and calderas exaggerated ~3.8x).
  - Built `src/render/Sea.ts`: custom GLSL shader with procedural wave swell, dual scrolling ripples, deep navy abyssal coloring blending into shallow shelf teal, coastal foam, and moon specular glints.
  - Built `src/render/Sky.ts`: starry dome with 1,200 multi-spectral celestial stars.
  - Built `src/render/CameraManager.ts`: smooth cinematic glide from high Mediterranean orbit down to the starting pair (Santorini & Naxos) with user interaction override and focus-on target transitions.
  - Built `src/render/IslandMarkers.ts`: 3D port beacons with pulsating harbor rings, screen-space interactive label pills, and automatic Left Inspector data binding.
  - Added real-time Day/Night blend toggling via HUD and hotkeys (`N` / `D`).

- [x] 2026-10-16 – **8K Ultra-High-Definition Imagery & Zoom 10 DEM Topography Upgrade**:
  - Upgraded daylight and night satellite textures to full **8192 × 8192 (8K)** (`day.jpg`, `night.jpg`) via 8×8 grid of 1024×1024 tiles from Sentinel-2 cloudless mosaic, doubling pixel sharpness across all islands and ports.
  - Upgraded elevation model to **AWS Terrarium Zoom 10** (480 tiles downloaded and stitched, ~5120×6144 native DEM resolution) with vectorized bilinear interpolation.
  - Pre-computed 4K high-frequency topographic normal map (`normals.png`) using Sobel gradients and smooth coastline blending.
  - Upgraded `AegeanTerrain` mesh to **640 × 640 vertices (~410k vertices)** and wired `normals.png` into the fragment shader, giving every mountain ridge, crater, valley, and cliff realistic micro-relief illumination.
  - Scaled ocean wave frequencies by **~100× to 300×** (`uv * 5200.0`, `uv * 11000.0`, `uv * 22000.0`), replacing macro-scale 11-kilometer swells with fine capillary Mediterranean surface ripples and delicate glints.
  - Redesigned island markers: replaced giant 0.6-unit neon spheres and pulsating 1.5-unit rings with subtle miniature brass harbor pins (radius 0.065) and clean, non-intrusive minimalist nautical label pills.
  - Implemented dedicated debug layer visualization modes in shader (`uViewMode`):
    - `🌙 Night` (0): Moonlit night scene with city lights & water ripples
    - `☀️ Day` (1): 8K Sentinel-2 daylight satellite imagery
    - `🏔️ DEM` (2): Hypsometric topographic elevation model with bathymetry depth
    - `🗺️ Mask` (3): Island territory ID mask with distinct color coding
  - Enhanced Mediterranean night lighting: boosted direct moonlight to `vec3(1.30, 1.55, 1.95)` and ambient moonlight to `vec3(0.85, 1.02, 1.30)` (with Scene lights boosted to 3.4 / 2.8).
  - Radiant Daylight with Topographic Hillshading: angled the Mediterranean morning sun to ~45° from the Southeast (`vec3(0.65, 0.58, -0.48)`), exaggerated topographic gradient slopes (2.8×) from `normals.png`, implemented dynamic hillshading (`NdotL` mapped through smooth gradient `mix(0.25, 1.35, dayShade)`), and raised total daylight irradiance (`dayAmbient` 0.88, `dayDirect` 1.05, toneMappingExposure 1.35) so sunlit slopes are brilliantly bright while mountain back-slopes cast distinct relief shades.
  - Desaturated DEM elevation ramp: replaced bright/saturated neon green/yellow ramp with Swiss Federal Cartography-style muted earth tones (dry olive sage, warm khaki, dry Aegean clay, weathered limestone, pale granite, and deep slate navy bathymetry) with smooth anti-aliased shoreline blending.
  - Dimmed night city lights significantly & removed "Lights" view:
    - Re-baked `night.jpg` to remove permanently burned-in yellow light squares, keeping clean moonlit satellite imagery.
    - Re-baked `lights.png` with noise threshold (`-0.14`) and steep power curve (`pow(1.8)`) concentrating illumination on dense urban cores and harbor quays.
    - Dimmed shader emissive city light intensity to soft, delicate nocturnal embers (`glowLevel = (cityAlpha * 0.45 + pow(cityAlpha, 2.2) * 0.25)`), eliminating harsh glare and providing realistic, subtle harbor lighting.
    - Completely removed the redundant "Lights" button and view mode from HUD, hotkeys, and shader.
    - Bumped texture cache buster to `v11`.
  - Applied User Reference DEM Gradient (Dark Green Lowest to Alpine White Highest):
    - Extracted exact 8-stop hypsometric color ramp from user reference image: deep dark forest green at sea level (`vec3(0.020, 0.220, 0.114)`), rich valley green (`vec3(0.114, 0.337, 0.071)`), olive khaki foothills (`vec3(0.341, 0.424, 0.125)`), warm ochre tan (`vec3(0.514, 0.459, 0.212)`), terracotta sienna (`vec3(0.663, 0.510, 0.318)`), light limestone buff (`vec3(0.761, 0.659, 0.525)`), pale stone (`vec3(0.835, 0.796, 0.749)`), and alpine white peaks (`vec3(0.920, 0.920, 0.950)`).
  - Redesigned Island Markers to Classic 3D Map Drop-Pins:
    - Added heightmap elevation sampling in `AegeanTerrain.getElevationAt(lon, lat)` so markers sit 100% flush on the terrain/water surface with zero floating.
    - Replaced the cylinder+sphere with the classic beveled 3D teardrop map pin featuring a circular donut cutout and pointy ground-contact tip.
    - Added concentric harbor ripple rings beneath the pin tip lying flat on the surface with gentle pulse animation.
    - Applied rich crimson red lacquer finish (`#df2236`) with glossy specular highlights.
    - Cleaned up floating label badges by removing the indicator dot for a sleek, centered typographic pill badge.
  - Organic Mediterranean Sea Surface Upgrade:
    - Completely replaced high-frequency perpendicular sine grids with multi-directional organic wave simulation (`uv * 380.0` with non-orthogonal golden angles and domain warping), eliminating all carbon-fiber / geometric diamond artifacts.
    - Implemented physical Fresnel reflection mirroring atmospheric sky tones at grazing angles.
    - Added authentic Mediterranean liquid palette: nocturnal sapphire abyss, sunlit azure shelf waters, and smooth fluid specular sun/moonlight paths.

  - **Aegean Island Expansion, Summit Peak Anchoring & Zoom LOD**:
    - Expanded the island database from 16 to **63 comprehensive Aegean islands, islets, and rocks** across the Cyclades, Dodecanese, North Aegean, Sporades, and Saronic archipelagos (including tiny islands like Delos, Rinia, Thirassia, Antiparos, Koufonisia, Schinoussa, Iraklia, Donousa, Lipsi, Leros, Tilos, Nisyros, Chalki, Symi, Fourni, Psara, Kastellorizo, Elafonisos, Kasos, etc.).
    - Positioned all island labels directly atop each island's **highest mountain peak** (e.g., Mount Zas on Naxos, Tsiknias on Tinos, Profitis Ilias on Santorini/Paros/Mykonos, Mount Ida/Psiloritis on Crete, Attavyros on Rhodes, Mount Kynthos on Delos, Mount Kymasi on Rinia, etc.) via `AegeanTerrain.getPeakWorld(lon, lat)`, which dynamically samples the local maximum 3D elevation from the heightmap.
    - Implemented a 3-tier **Zoom Level of Detail (LOD)** system:
      - **Tier 1 (Major Hubs & Regional Centers)**: Always visible across the Aegean map.
      - **Tier 2 (Medium Islands)**: Smoothly fades in as the camera descends (`camY < 74` or distance `< 65`).
      - **Tier 3 (Tiny Islands & Islets)**: Reveals their names when the camera zooms closer (`camY < 44` or distance `< 34`), ensuring crystal-clear readability when inspecting any island group.
    - Clean typography tiers in `style.css` (`tier-1`, `tier-2`, `tier-3`) with glassmorphic pill badges and frustum culling.
    - Preserved 3D lacquer drop-pins at harbors/ports for trade operations, keeping uninhabited rocks and tiny peaks clean and uncluttered.

  - **Interactive DEM Color Calibration Tuner Helper**:
    - Parameterized the DEM hypsometric shader gradient in [`src/render/Terrain.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Terrain.ts) with real-time uniforms: `uDEMGreenLimit`, `uDEMBrownStart`, `uDEMBrownPeak`, and `uDEMWhiteStart`.
    - Created interactive helper component [`src/render/DEMTuner.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/DEMTuner.ts) with real-time sliders, numeric indicators, and a live gradient preview bar:
      - 🌱 **Green Coastal Limit**: defines where coastal green gives way to foothill olive.
      - 🌾 **Brown Slope Start**: defines where warm Mediterranean ochre and sienna brown take over the island slopes.
      - ⛰️ **Brown Summit Limit**: sets the upper boundary before mountain rock/buff.
      - ❄️ **Alpine White Start**: controls where high snowy peaks appear.
      - 📐 **3D Relief Exaggeration**: real-time vertical scale slider.
    - Added quick-preset buttons (`🏝️ More Brown`, `🌾 Balanced`, `🌿 More Green`, `❄️ Alpine Snow`), clipboard export (`📋 Copy Code`), and automatic `localStorage` persistence.
    - Added a `🎨 Tune` button in the bottom bar layer switcher (and hotkey `T`), with automatic opening when entering `🏔️ DEM` mode.

  - **Radiant Full Moon Mediterranean Lighting**:
    - Boosted directional moonlight in [`src/render/Scene.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Scene.ts) from `3.4` to `5.2` (`0xd4e8ff`) and ambient moonlight from `2.8` to `3.8` (`0x2d4872`).
    - Added dynamic lunar topographic hillshading (`nightShade` via `NdotL`) in [`src/render/Terrain.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Terrain.ts), allowing mountain ridges facing the full moon to catch sharp silver highlights while backslopes cast soft nocturnal shadows.
    - Elevated night island terrain exposure (`nightEnhanced = nightColor.rgb * vec3(2.6, 2.9, 3.4)`) so coastlines, cliffs, beaches, and island topography are clearly visible.
    - Upgraded ocean moonlight specular reflection with a brilliant full moon track ("yakamoz" / water glint `direct * spec * 1.45`) across Mediterranean waves.

  - **Natural Mellow Elevation Relief Tuning**:
    - Reduced 3D vertical displacement scale from `1.25` down to **`0.72`** across [`src/render/Terrain.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Terrain.ts) and [`src/render/DEMTuner.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/DEMTuner.ts) (~42% reduction), delivering natural, organic island slopes instead of spiked vertical peaks.
    - Softened normal gradient slope multipliers: reduced `highReliefNorm` slope multiplier from `2.8` to `1.6` and vertex normal displacement factor from `40.0` to `25.0`, eliminating harsh cliff edges and creating smooth, elegant mountain contours.
    - Bound `getElevationAt(lon, lat)` dynamically to `this.displacementScale` so 3D port pins and peak labels track the exact surface height of the mesh at all scale levels.

  - **HUD Panel Clean View & Default Closed State**:
    - Closed both the left Inspector Panel and right Maritime Dispatch Feed by default (`.closed`), providing a clean, distraction-free view of the 3D Aegean map.
    - Added animated slide/fade transitions (`transform` and `opacity`) and close `✕` buttons to both panel headers.
    - Left Inspector smoothly opens whenever any island or port is selected/clicked.
    - Added bottom-bar **Dispatch** toggle button to reopen notifications at will, and `Esc` key shortcut to instantly dismiss any open overlay panel.



  - **Authoritative DEM Defaults & Consolidated Settings Panel**:
    - Locked new authoritative DEM parameters and natural 3D displacement defaults in [`src/render/Terrain.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Terrain.ts):
      ```js
      terrain.setDEMParams(0.020, 0.065, 0.380, 0.780);
      terrain.setDisplacementScale(1.00);
      ```
    - Consolidated the standalone `🎨 Tune` button into a unified `⚙️ Settings` interface:
      - Added `⚙️ Settings` buttons to both the Top Bar and Bottom Bar Quick-Toggles.
      - Integrated shortcut keys: `S` toggles settings modal, `T` opens directly to DEM tab, and `Esc` dismisses the modal.
    - Built comprehensive [`src/render/SettingsPanel.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/SettingsPanel.ts) featuring two tabs:
      - **Tab 1: 🏔️ DEM Colors**: sliders for Green Limit (`0.020`), Brown Start (`0.065`), Brown Peak (`0.380`), Alpine White (`0.780`), and 3D Relief (`1.00×`), live gradient preview bar, presets, and clipboard export.
      - **Tab 2: 🌙 Night & Moon (Light Intensity Helper)**: real-time sliders for night lighting, with new authoritative defaults locked:
        ```js
        terrain.setNightLightingParams(0.55, 0.40, 0.20, 0.40);
        ```
        - 🌕 **Moonlight Radiance** (`0.55×`): direct lunar illumination on terrain & sea.
        - 🌌 **Ambient Night Fill** (`0.40×`): nocturnal visibility across shadowed terrain.
        - 🏮 **Harbor & City Lights** (`0.20×`): gentle nocturnal embers on coastal ports.
        - 🌊 **Ocean Moon Track / Yakamoz** (`0.40×`): wave glint & moonlight water reflection.
        - Quick mood presets (Default Night, Radiant Full Moon, Harbor Glow, Silver Sea) and code export.

  - **Inland Water Body & Terrain Highlight Dimming (Night & Day Views)**:
    - Identified that inland water bodies (mountain lakes, river valleys, reservoirs, and dams in Turkey and Greece) had high raw satellite reflectance in green/blue channels that became glowing neon cyan/electric blue at night and glaringly bright in daytime.
    - Implemented real-time inland water spectral signature detection in [`src/render/Terrain.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Terrain.ts):
      - Replaced glaring turquoise/cyan reflections with authentic deep Mediterranean lake palettes: deep dark midnight water mirror (`vec3(0.010, 0.020, 0.040)`) at night and natural sapphire/slate lake water (`vec3(0.032, 0.070, 0.130)`) in daylight.
    - Implemented photographic soft-knee dynamic range compression:
      - Day view highlight compression on `dayColor` for `dayLuma > 0.26` to tame stark limestone, salt flats, and specular glare.
      - Night view highlight compression on `nightColor` for `nightLuma > 0.08` to eliminate glaring hotspots on dark midnight terrain.
      - Balanced the night texture color multiplier (`vec3(1.85, 2.05, 2.25)`) to eliminate artificial blue over-boosting.
      - Added lit terrain highlight ceiling limiter to prevent any sunlit or moonlit slope from exceeding comfortable viewing luminance.

  - **Day Light Color Tuner & Locked Defaults (Settings Panel)**:
    - Added dedicated **☀️ Day Light** tab in [`src/render/SettingsPanel.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/SettingsPanel.ts) and wired shader uniforms in [`src/render/Terrain.ts`](file:///c:/Users/ozalp/Code/AntiGravity/Argean%20Tycoon%20v2/src/render/Terrain.ts).
    - Locked new authoritative day view defaults:
      ```js
      terrain.setDayLightParams(0.20, 1.80, 0.36, 0.50, 0.60);
      ```
      - ☀️ **Direct Sun Radiance** (`0.20×`): gentle directional sunlight preventing harsh terrain burnout.
      - 🌤️ **Sky Ambient Fill** (`1.80×`): rich atmospheric diffuse fill providing clear visibility in shadows and valleys.
      - 🌅 **Sunlight Warmth / Tint** (`0.36`): natural Mediterranean morning sunlight tone.
      - 🌿 **Landscape Saturation** (`0.50`): balanced natural earth, vegetation, and coastal sand.
      - 🌊 **Sea Azure Brilliance** (`0.60×`): elegant, authentic deep Mediterranean sea turquoise.
    - Added daylight mood presets (*☀️ Aegean Midday*, *🌅 Golden Hour*, *🏝️ Vivid Turquoise*, *🏛️ Arid Limestone*), `localStorage` persistence, and *📋 Copy Code* export (`terrain.setDayLightParams(...)`).
    - **Synchronized Color Tuner Selection with Main Screen**:
      - Color tuner active tab dynamically follows layer selections made on the main screen (`🌙 Night` -> Night tab, `☀️ Day` -> Day tab, `🏔️ DEM` -> DEM tab).
      - Opening Settings via `⚙️ Settings` button or `S` key automatically opens the tab corresponding to the currently active view mode.
      - Two-way interaction: clicking tabs inside the tuner also switches the main screen and bottom bar buttons seamlessly.

## In Progress
_None._

## Next Step
**M3 – Day/Night Reveal**:
- Shader implementation of dynamic per-island lighting: `litAmount[islandId]` data texture lookup in terrain shader.
- Radial "wave of light" spreading across an island from its port upon connection.
- Connecting glow state and prosperity-driven illumination.
- Connecting the visual reveal to the simulation event triggers.

## Blockers / Open Questions
_None._

## Session Notes
- Dev server running at http://localhost:5174/
- All test suites passing (`npm test` green, `npm run build` green).

