# Technical Architecture

## Stack
- **Build**: Vite + TypeScript (strict)
- **3D**: Three.js (WebGL2), postprocessing (bloom, vignette, color grade)
- **UI**: HTML + Vanilla CSS overlay (glassmorphism), small custom store; no framework
- **Sim**: pure TypeScript, deterministic, seeded RNG, fixed timestep
- **Tests**: Vitest for sim and economy
- **Audio**: Web Audio API (ambient sea, music bed, UI/ship cues)
- **Persistence**: localStorage (versioned JSON save)
- **Tooling scripts**: Node/Python in `/tools` for the geodata bake

## Folder Layout
```
/public/data        baked textures + JSON (islands, goods, ships, routes graph)
/tools              bake scripts (imagery, heightmap, masks, island JSON)
/src
  /sim              economy, ships, pathfinding, progression (NO rendering imports)
  /render           three.js scene, terrain, sea, lights, ships, post-fx
  /ui               HUD, panels, tooltips, menus
  /audio            sound manager
  /state            store, save/load
  /data             typed loaders for JSON
  main.ts
/docs
```

## Layers and Data Flow
`sim` (tick at 10 Hz fixed) -> emits state snapshot/events -> `render` (60 FPS interpolates ship positions, updates `litAmount` per island) and `ui` (subscribes to store).
UI actions -> commands into `sim` (unlock island, buy ship, set route).

## Key Systems
1. **Terrain**: one plane mesh with displacement from the heightmap (land exaggerated ~2–4x, bathymetry shaded into sea color). Tiled LOD if needed.
2. **Day/Night Reveal Shader**: samples `dayTex`, `nightTex`, `islandMaskTex` (R = island id / 255, or an id lookup). Uniform `litAmount` texture (1 x N float) gives 0..1 per island. Output = mix(night, day, smoothstep) with a radial "wave of light" spreading from the port. City lights emissive intensity ramps up at the same time.
3. **Sea**: custom shader, dark animated normal-map waves, specular moon glint, shore foam from the heightmap, day tint blended near lit islands.
4. **Ships**: InstancedMesh per tier, with wake as a trail ribbon or particle sprite; navigation lights (red/green/white) as emissive sprites; ships route along a **sea-lane graph** (waypoints) that avoids land.
5. **Pathfinding**: precomputed sea-lane graph (nodes = ports and open-water waypoints), A* on it, with smoothing (Catmull-Rom).
6. **Picking**: raycast against island proxy shapes, or read from the id-mask.
7. **Time**: 1 real second ~ 1 game hour at 1x; speeds 0/1x/4x/16x. Day/night cycle is cosmetic only, since the map "night" is narrative state, not clock.

## Performance Budget
- 60 FPS on integrated GPU laptops at 1080p; 100–300 ships, 60+ islands/ports.
- Textures: 8k max (KTX2/WebP fallback), progressive load (2k preview -> 8k).
- Draw calls < 200. Instancing for ships/labels. Labels via CSS2D or SDF sprites with culling.
- Sim tick < 2 ms.

## Testing
- Unit tests: price curve, route profit, ship loading, progression thresholds, save migration.
- Headless sim soak test: 10k ticks, assert no NaN, no permanent starvation of connected islands.
- Visual check checklist in ROADMAP.
