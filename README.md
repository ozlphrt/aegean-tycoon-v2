# Aegean Tycoon v2 (v0.3.0)

> **The Rebirth of Maritime Trade Across the Aegean Sea**
> 
> 🌐 **Live Web Application**: [https://ozlphrt.github.io/aegean-tycoon-v2/](https://ozlphrt.github.io/aegean-tycoon-v2/)

A 3D browser simulation of maritime trade rebirth across the Greek archipelago. The map starts as a photoreal nighttime satellite landscape. You begin at Santorini with a modest wooden fishing boat. As ships deliver cargo between islands, each connected port awakens into vivid **daylight**. Expand your merchant fleet, establish profitable trade routes, unlock mainland gateways, and bring the entire Aegean Sea to life.

---

## Key Features

- **The Aegean Awakening**: Dynamic shader blending transforms islands from dark NASA VIIRS satellite night lights into sunlit Copernicus Sentinel-2 daylight upon establishing active trade.
- **63 Real Aegean Ports & Islands**: Spans the Cyclades, Dodecanese, North Aegean, Saronic Gulf, Crete, Greek mainland hubs (Piraeus, Thessaloniki, Volos, Kavala), and Turkish coastal gateways (Bodrum, Marmaris, Kusadasi, Cesme).
- **Dynamic Living Economy**: Real-time supply and demand pricing across 12 authentic Mediterranean commodities (wine, olive oil, fish, marble, volcanic stone, grain, mastic, figs, honey, cheese, fuel, crafts).
- **5-Tier Merchant Fleet**:
  - **Traditional Kaiki (Tier 1)**: Small wooden workhorse for island-hopping.
  - **Aegean Caique (Tier 2)**: Sturdy rigged trading vessel with larger cargo capacity.
  - **Passenger Ferry (Tier 3)**: High-speed passenger carrier generating bonus ticket fares.
  - **Merchant Freighter (Tier 4)**: Heavy steel cargo ship designed for bulk inter-island haulage.
  - **Luxury Charter Yacht (Tier 5)**: High-prestige yacht catering to wealthy tourists, generating luxury dividends.
- **Organic Fleet Movement**: All vessels feature individual +/- 10% cruising speed variance, preventing rigid synchronized convoys and creating realistic fairway staggering.
- **Deep-Water Navigation**: 169 fairway waypoints with A* routing that avoids landmasses and navigates natural maritime channels.
- **GPU Instanced Wakes & Fleet**: Renders up to 600 simultaneous ships and procedural foam wakes at a rock-solid 60 FPS.
- **Procedural Web Audio Engine**: Zero external audio downloads. Algorithmic Mediterranean surf & breeze filters, golden coin harmonics, ferry ticket chimes, dock thuds, and Hellenic pentatonic awakening fanfares synthesized directly in Web Audio API.
- **Auto-Save & State Persistence**: Versioned JSON serialization saves fleet positions, markets, treasury, and unlocked islands daily and on window close.

---

## Controls & Hotkeys

| Action | Control / Hotkey |
|---|---|
| **Rotate / Orbit Camera** | Left Mouse Button Drag |
| **Pan Map** | Right Mouse Button Drag or Middle Click Drag |
| **Zoom In / Out** | Mouse Scroll Wheel / Trackpad Pinch |
| **Select Island / Harbor** | Left Click on Island or Harbor Label |
| **Select Ship** | Left Click on Ship Model |
| **Close Panel / Deselect** | `Escape` key |
| **Pause / Resume Sim** | `Spacebar` |
| **Simulation Speed** | `1` (1x Normal), `2` (2x Fast), `3` (5x Ultra) |
| **Navigator's Guide** | `H` key |
| **Fleet Management** | `V` key or Top-bar ⛵ button |
| **Audio Mute / Unmute** | `M` key |

---

## How to Play

1. **Observe Your Starting Port**: You begin at **Santorini (Thira)** with an initial treasury of 🪙 500 Drachmas and a commissioned wooden Kaiki.
2. **First Delivery & Awakening**: Your Kaiki sails to neighboring **Ios** carrying volcanic stone or wine. Upon docking and delivering goods, Ios awakens into glorious daylight!
3. **Earn Drachmas & Trade Points (TP)**: Profitable deliveries earn drachmas for your treasury and Trade Points (TP) representing your commercial prestige.
4. **Commission More Ships**: Open the **Harbor Shipyard** in the left inspector panel to purchase additional vessels for your active home ports.
5. **Unlock New Islands**: Click on dark neighboring islands and pay the required Drachmas and TP to unlock them into your maritime network.
6. **Deploy Advanced Tiers**: Build passenger ferries between high-population islands (Piraeus, Heraklion, Rhodes) and luxury yachts to scenic destinations (Mykonos, Santorini).
7. **Achieve the Endgame Victory**: Connect and awaken all **63 islands** across the Aegean to trigger the grand "Whole Aegean Awake" celebration and orbital victory sweep!

---

## Technology Stack

- **3D Engine**: [Three.js](https://threejs.org/) (WebGL with custom GLSL terrain blending, sea shaders, and instanced geometry)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict mode, zero runtime framework overhead)
- **Bundler & Tooling**: [Vite](https://vitejs.dev/)
- **Simulation**: Headless deterministic simulation loop completely decoupled from rendering (`src/sim`)
- **Testing**: [Vitest](https://vitest.dev/) (44 automated unit tests covering navigation, trade math, ship states, scaling, and save/load)
- **Audio**: Web Audio API procedural synthesis (`src/audio/AudioManager.ts`)
- **Styling**: Vanilla CSS with glassmorphism design tokens and Google Outfit / Inter typography

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
# Install dependencies
npm install

# Run automated test suite
npm test

# Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to launch the Aegean archipelago.

### Production Build
```bash
npm run build
```
Generates production-optimized static bundles in `dist/`.

---

## Project Documentation Index

- [docs/ROADMAP.md](docs/ROADMAP.md) — Milestone breakdown from M0 through M10
- [docs/DECISIONS.md](docs/DECISIONS.md) — Architecture Q&A and decision log
- [docs/TECH_ARCHITECTURE.md](docs/TECH_ARCHITECTURE.md) — Engine design and performance budgets
- [docs/DATA_AND_ECONOMY.md](docs/DATA_AND_ECONOMY.md) — Mathematical economic balance and fleet specifications
- [docs/VISUAL_DESIGN.md](docs/VISUAL_DESIGN.md) — Shaders, day/night blending, and UI tokens
- [docs/ASSETS_AND_DATA_SOURCES.md](docs/ASSETS_AND_DATA_SOURCES.md) — Satellite sources, bathymetry, and licenses
- [CREDITS.md](CREDITS.md) — Full data source, software, and font attributions
- [PROGRESS.md](PROGRESS.md) — Chronological implementation log

---

## License & Attribution

- Game code is open-source under the MIT License.
- Satellite imagery © EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020) under CC BY-NC-SA 4.0.
- Night lights courtesy of NASA Earth Science Data Systems (VIIRS Black Marble).
