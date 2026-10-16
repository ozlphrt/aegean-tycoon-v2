# Assets and Data Sources

**Bounding box (Aegean)**: lon 22.5 to 29.5, lat 34.8 to 41.0 (adjust to include Thessaloniki, Crete, and the Turkish coast to Marmaris).
Projection: equirectangular for the baked textures (simple, adequate at this latitude), with a cos(lat) aspect correction in the scene.

## Sources (verify license before shipping)
| Need | Candidate source | License notes |
|---|---|---|
| Coastlines/land polygons | Natural Earth 10m, OpenStreetMap land polygons | Public domain / ODbL (attribute OSM) |
| Island list and coordinates | OSM/Wikidata, Natural Earth populated places | ODbL / CC0 |
| Elevation | Copernicus GLO-30 DEM, SRTM, or Mapzen/AWS Terrain Tiles | Copernicus: free with attribution |
| Bathymetry | GEBCO 2023 grid, EMODnet Bathymetry | GEBCO: free with attribution |
| Day satellite color | EOX Sentinel-2 cloudless / NASA Blue Marble NG | EOX 2016-2020 is CC BY-NC 4.0 (selected: project is personal/non-commercial) |
| Night lights | NASA Black Marble / VIIRS nighttime lights, or synthesize from OSM population and settlement points | NASA: public domain |
| Ship models | Generate procedurally in Three.js, or CC0 models (Kenney, Quaternius, Poly Pizza) | check each |
| Audio | CC0 (freesound CC0, Pixabay), or Web Audio synthesis | check each |

## Bake Pipeline (`/tools`)
1. `fetch-data` – download sources into `/tools/cache` (git-ignored).
2. `bake-islands` – extract land polygons in the bbox -> assign island IDs by matching to `islands.json` -> rasterize an **ID mask** (R channel = id), saved lossless (PNG).
3. `bake-heightmap` – merge DEM + bathymetry -> 16-bit PNG (or a normalized 8-bit pair), 4096 and 8192 widths.
4. `bake-day` – color texture from satellite imagery with a color grade (richer greens, whitewashed towns), sea desaturated to be replaced by the shader.
5. `bake-night` – darkened and cool-graded version of the day texture plus a separate **lights** texture from VIIRS/OSM settlements.
6. `bake-lanes` – sea mask -> visibility graph or grid skeleton -> `seaLanes.json`; manual overrides file.
7. `validate` – check every island has a mask region, port points are on the coast, every port is reachable on the lane graph.

If Python is used, put deps in `tools/requirements.txt` (rasterio, geopandas, numpy, pillow, shapely).

## Island Roster (target 50+ islands plus ports; refine in `islands.json`)
- **Cyclades**: Syros, Mykonos, Delos, Tinos, Andros, Paros, Antiparos, Naxos, Santorini, Ios, Milos, Sifnos, Serifos, Kythnos, Kea, Amorgos, Folegandros, Sikinos, Anafi, Koufonisia, Donoussa, Iraklia
- **Dodecanese**: Rhodes, Kos, Kalymnos, Leros, Patmos, Lipsi, Astypalaia, Symi, Tilos, Nisyros, Karpathos, Kasos, Halki, Kastellorizo
- **North/East Aegean**: Lesbos, Chios, Samos, Ikaria, Fournoi, Lemnos, Agios Efstratios, Thasos, Samothrace, Psara
- **Sporades/Evia/Saronic**: Skiathos, Skopelos, Alonissos, Skyros, Evia, Aegina, Salamis, Poros, Hydra, Spetses
- **Crete and nearby**: Crete (multiple ports: Heraklion, Chania, Agios Nikolaos), Gavdos
- **Mainland ports**: Piraeus, Lavrio, Rafina, Volos, Thessaloniki, Kavala, Alexandroupoli; Turkey: Izmir, Cesme, Kusadasi, Bodrum, Marmaris, Ayvalik, Canakkale
- Each entry needs real lat/lon, population, a port location and plausible produce/consume data. Document data guesses as "gameplay-approximate".

## Attribution
Keep `CREDITS.md` updated with every data/asset source and license.
