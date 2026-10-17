# Credits and Data Attributions

Aegean Tycoon v2 is built with open web standards, real satellite Earth observation datasets, and algorithmic procedural synthesis:

## 1. Daylight Satellite Imagery
- **Source**: [EOX IT Services GmbH](https://maps.eox.at/) — Sentinel-2 cloudless (2020)
- **Data provider**: Contains modified Copernicus Sentinel data (2020)
- **License**: [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **Attribution**: Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)

## 2. Nighttime Satellite Lights
- **Source**: [NASA GIBS / Earth Science Data Systems](https://earthdata.nasa.gov/)
- **Product**: Suomi NPP / VIIRS Black Marble (Day/Night Band)
- **License**: Public Domain / NASA Open Data Policy

## 3. Elevation & Bathymetry DEM
- **Source**: [Mapzen / AWS Elevation Tiles (Terrarium format)](https://registry.opendata.aws/terrain-tiles/)
- **Data contributors**: ArcticDEM, ASTER GDEM, SRTM, EUDEM, GEBCO
- **License**: Open Data / CC-BY / ODbL

## 4. Geographic Boundaries & Island Coordinates
- **Source**: Natural Earth & OpenStreetMap contributors
- **License**: Public Domain (Natural Earth) / ODbL (OpenStreetMap)

## 5. Procedural Sound & Sampled Audio Engine
- **Engine**: Pure Web Audio API hybrid sound engine (`src/audio/AudioManager.ts`)
- **Coin Sound**: Sampled and master-trimmed "Crisp Coin Taps" (`/audio/coin.wav`, 0.23s, 48kHz, zero initial latency) with dynamic ±3% micro-pitch humanization on rapid transactions.
- **Ferry Ticket Sound**: Sampled and master-trimmed "Ferry Ticket" (`/audio/ferry_ticket.wav`, 0.61s, 48kHz, zero initial latency) capturing the mechanical ticket punch strike with dynamic ±2% micro-pitch humanization on passenger embarkations.
- **Synthesized SFX**: Algorithmic Mediterranean pink-noise surf & breeze filters, dual-tone golden coin harmonics fallback, procedural ticket chimes fallback, luxury yacht arpeggios, dock resonance, Hellenic pentatonic awakening fanfares, and multi-octave victory fanfares.
- **Author**: Aegean Tycoon v2 Team / zlphrt

## 6. Core Technologies & Open Source Libraries
- **Three.js**: 3D WebGL renderer and math engine — [MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE) (Ricardo Cabello / mrdoob & Three.js authors)
- **Vite**: Frontend development and production bundler — [MIT License](https://github.com/vitejs/vite/blob/main/LICENSE) (Evan You & Vite contributors)
- **TypeScript**: Typed JavaScript language — [Apache 2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) (Microsoft Corp.)
- **Vitest**: Unit testing framework — [MIT License](https://github.com/vitest-dev/vitest/blob/main/LICENSE)

## 7. Web Fonts & Typography
- **Outfit**: Google Fonts / [SIL Open Font License](https://scripts.sil.org/OFL)
- **Inter**: Google Fonts / [SIL Open Font License](https://scripts.sil.org/OFL)

## 8. 3D Vessel Models (GLTF)
- **Tier 1 Traditional Kaiki**: Based on ["FishingBoat"](https://sketchfab.com/3d-models/fishingboat-cc4200e4018843f28ddca72adc61e887) by **Godot2000**, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- **Tier 2 Aegean Caique**: Based on ["Fishing Boat"](https://sketchfab.com/3d-models/fishing-boat-a3f138089e164200b34bfb1bebb978c2) by **CharlieCatling**, licensed under [Sketchfab Standard License](https://sketchfab.com/licenses).
- **Tier 3 Island Passenger Ferry**: Based on ["Ferry Concept"](https://sketchfab.com/3d-models/ferry-concept-73b9556133704e73af6637a428bcb8f4) by **Gman The Cruise Dude**, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- **Tier 4 Merchant Freighter**: Based on ["A Full Container Ship"](https://sketchfab.com/3d-models/a-full-container-ship-5b69bf89f02b4cd89de6e49656f3499f) by **Mixmamo.studio**, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- **Tier 5 Luxury Motor Yacht**: Based on ["Yacht"](https://sketchfab.com/3d-models/yacht-0dd451f295d049cea20c17d3ffa87ee3) by **Sergei**, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
