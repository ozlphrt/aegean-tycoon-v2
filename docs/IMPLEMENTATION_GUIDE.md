# Implementation Guide

Follow with `ROADMAP.md`. Each step lists what to build and how to verify.

## 0. Setup
1. Scaffold in the repo root: `npx -y create-vite@latest ./ --template vanilla-ts` (run `--help` first, non-interactive).
2. Install: `three`, `@types/three`, `postprocessing`, `vitest`, `eslint`, `prettier`.
3. Create the folder layout from `TECH_ARCHITECTURE.md`. Add `CREDITS.md` and `.gitignore` (include `tools/cache`).

## 1. Geodata Bake
1. Write `tools/` scripts (Python recommended for GIS). Start with a bbox config file.
2. Download Natural Earth land, GEBCO or DEM, and an imagery source (confirm the license; see ASSETS).
3. Rasterize the island ID mask. IDs come from `islands.json` (index + 1). Use nearest-neighbor sampling only.
4. Build the heightmap: land from DEM, sea from bathymetry, with a sea level normalized value. Save with metadata JSON (min/max meters, bbox).
5. Produce the day and night textures and the lights texture. Verify visually.
6. Generate `seaLanes.json`; review it in a debug view (draw the graph over the map).

## 2. Renderer Foundation
1. `render/Scene.ts`: renderer, camera, controls (OrbitControls with limits), resize handling, EffectComposer.
2. `render/Terrain.ts`: PlaneGeometry (e.g. 512x512 segments) with vertex displacement from the heightmap; a ShaderMaterial with day/night/mask/lit uniforms.
3. `render/Sea.ts`: separate water plane at sea level with the wave shader and a depth tint from the heightmap.
4. Night color grade first. Get the beauty shot right before adding systems.

## 3. Lit Reveal
1. A `litTexture` (Nx1 float, DataTexture) updated each frame from the sim state. The shader reads `litAmount = texture(litTex, maskId)`.
2. Add a per-island `revealRadius` and `revealStartTime` to produce the radial wave using distance from the port in UV space.
3. Lights: Points/instanced sprites from the lights texture or settlement data; intensity is tied to `litAmount` and prosperity.

## 4. Simulation (src/sim)
1. Types: `Good`, `Island`, `Ship`, `Route`, `World`.
2. `World.tick(dt)`: production, consumption, prices, ship agents, progression checks, events.
3. Seeded RNG (mulberry32). All tunables from `balance.json`.
4. Unit tests alongside each module. Keep sim free of Three.js.

## 5. Ships
1. Lane-graph A* in `sim/nav`. The ship stores `path` and `progress`.
2. `render/Ships.ts`: one InstancedMesh per tier; update matrices from interpolated sim positions; simple procedural hull geometry first, models later.
3. Wake: trail via a pooled ribbon or a particle sprite; fade out over a few seconds.

## 6. UI
1. A store (observer pattern) bridging sim snapshots and the DOM.
2. Build the HUD, island panel, shop, event feed, minimap. Vanilla CSS with design tokens in `ui/tokens.css`.
3. Commands: `unlockIsland(id)`, `buyShip(tier, homePort)`, `setRoute(...)`, `setSpeed(n)`.

## 7. Progression, Scale, Audio, Save
- Implement tier gates, tourism, and mainland ports from the balance data.
- Perf pass: profile, instancing, label culling, texture streaming.
- Web Audio manager with a gain bus (master, ambient, music, sfx).
- Save: `{version, seed, time, treasury, islands[], ships[], unlocked[]}`; migrations by version.

## Definition of Done (each milestone)
Build passes, tests pass, acceptance criteria met, `PROGRESS.md` updated, screenshots taken for visual milestones, and no console errors.

## Common Pitfalls
- Mask filtering: disable mipmaps/linear filtering on the ID mask or islands will bleed.
- Aspect: correct for longitude compression at ~38°N (scale X by cos(38°) ≈ 0.788).
- Sea lanes crossing land: validate with the land mask, not by eye.
- Keep the sim deterministic and decoupled from the frame rate.
