# Roadmap and Acceptance Criteria

Work milestones in order. Mark done in `PROGRESS.md`.

## M0 – Project Scaffold
- Vite + TS strict + Vitest + ESLint/Prettier; folder layout; blank Three.js canvas; HUD shell.
- **Accept**: `npm run dev` shows a dark canvas with a styled HUD; `npm test` runs.

## M1 – Geodata Bake (core of realism)
- Tools produce day, night, lights, heightmap, ID mask for the bbox; `islands.json` with the first 15 islands.
- **Accept**: textures load; the validator passes; a flat-plane preview shows the correct Aegean shape.

## M2 – 3D Night Map
- Displaced terrain, sea shader, night grade, bloom, orbit camera, cinematic intro.
- **Accept**: a stunning photoreal night view at 60 FPS; the Aegean recognizable (Crete, Cyclades, Turkish coast).

## M3 – Day/Night Reveal
- `litAmount` per island, mask-driven shader, radial light wave, sea tint, city lights.
- **Accept**: a debug key toggles an island lit with a smooth animation; unlit islands stay dark.

## M4 – Sim Core
- Goods, stocks, prices, island production/consumption, tick loop, headless tests.
- **Accept**: soak test passes; prices respond to scarcity and surplus.

## M5 – Ships and Sea Lanes
- Lane graph, A*, instanced fishing boats, wakes, lights, load/sail/unload state machine.
- **Accept**: two islands exchange goods with visible boats; the first delivery lights up the second island.

## M6 – Player Interaction and UI
- Selection, island panel, unlock flow, buy ships, routes, treasury and TP, speed controls, event feed, flow overlay.
- **Accept**: a full playable loop from 2 islands to ~10.

## M7 – Progression and Ship Tiers
- Caique, ferry, cargo, charter; unlock gates; mainland and Turkish ports; tourism multiplier.
- **Accept**: reach the whole map without balance dead-ends.

## M8 – Scale to 50+ Islands
- Full roster data, labels culling, performance pass, LOD.
- **Accept**: 60+ nodes, 200+ ships, 60 FPS target on a laptop.

## M9 – Audio, Save/Load, Polish
- Ambient audio, chimes, saves with versioning, settings, tutorial hints, endgame "whole Aegean awake" moment, credits.
- **Accept**: reload restores the state; a 10-minute playthrough feels polished.

## M10 – Release Prep
- Production build, asset compression (KTX2/WebP), README play instructions, CREDITS.md complete.
