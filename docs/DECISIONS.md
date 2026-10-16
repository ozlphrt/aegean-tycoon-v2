# Decisions Log

## Locked (from user Q&A, 2026-10-16)
| # | Topic | Decision |
|---|---|---|
| 1 | Genre | Hybrid: living simulation with light player guidance (unlock islands, routes, buy ships) |
| 2 | Tech | User wanted 3D plus good maps. **Chosen: Vite + TypeScript + Three.js with pre-baked real geodata** (see ADR-001) |
| 3 | Map | Real geographic data rendered as a dark map; islands that join trade are **lit and shown in daylight** |
| 4 | Visual style | Photoreal-ish satellite night look |
| 5 | Scope | 50+ islands, full Aegean detail, plus mainland ports in Greece and Turkey |
| 6 | Economy | Medium: ~12 goods, per-island production/consumption, dynamic prices, ship capacity, simple profit |
| 7 | Ships | Tiered: fishing boat -> caique/sailboat -> ferry -> cargo ship -> charter/yacht; unlocked by trade volume and island count |
| 8 | Setting | Modern-day Aegean, compressed "rebirth of trade" story |
| 9 | Platform | Desktop browser first, responsive; ambient audio; localStorage save/load |
| 10 | Start | Santorini and Naxos by default (player may choose other pairs, e.g. Syros and Paros) |
| 11 | License/Intent | 2026-10-16: Completely personal project (non-commercial). Unlocks high-res CC BY-NC datasets like EOX Sentinel-2 cloudless. |

## ADR-001: Three.js + baked geodata instead of MapLibre/Cesium
- **Why**: the per-island night -> day reveal, custom ship rendering (instancing), and bloom need full shader control. MapLibre/Cesium make this hard and add heavy dependencies and tile/licensing complexity.
- **How**: an offline script bakes (a) a satellite color texture (day), (b) a night-lights texture, (c) a heightmap with bathymetry, (d) an island-ID mask texture, all for the Aegean bounding box. The runtime blends day/night per island using the mask and a `litAmount[islandId]` uniform array/texture.
- **Trade-off**: fixed extent and resolution (we bake at 8k and 16k tiers). Acceptable, since the game is Aegean-only.
- **Fallback**: if imagery licensing blocks a source, generate a stylized day texture from elevation and land cover.

## Open Items (decide during build, log here)
- Camera style: tilted free-orbit (default) vs top-down toggle.
- Audio assets: generate or license.
- 2026-10-16: Locked DEM parameters: `setDEMParams(0.020, 0.065, 0.380, 0.780)` and `setDisplacementScale(1.00)`.
- 2026-10-16: Locked Night Lighting defaults: `setNightLightingParams(0.55, 0.40, 0.20, 0.40)` integrated into consolidated Settings Panel.
- 2026-10-16: Locked Day Light Color defaults: `setDayLightParams(0.20, 1.80, 0.36, 0.50, 0.60)` integrated into consolidated Settings Panel.
