import math
import urllib.request
from PIL import Image
import io
import os
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np

# Add tools directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import MIN_LON, MAX_LON, MIN_LAT, MAX_LAT, WIDTH, HEIGHT, PUBLIC_DATA_DIR, CACHE_DIR

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile

def num2deg(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return lat_deg, lon_deg

def fetch_terrarium_tile(z: int, x: int, y: int) -> Image.Image:
    cache_file = CACHE_DIR / f"terrarium_{z}_{x}_{y}.png"
    if cache_file.exists():
        try:
            return Image.open(cache_file).convert("RGB")
        except Exception:
            pass

    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    with open(cache_file, "wb") as f:
        f.write(data)
    return Image.open(io.BytesIO(data)).convert("RGB")

def bake_hires_heightmap(zoom=9):
    target_path = PUBLIC_DATA_DIR / "heightmap.png"
    print(f"--- Baking High-Res 4K Heightmap (Terrarium Zoom {zoom}, target: {WIDTH}x{HEIGHT}) ---")

    min_x, min_y = deg2num(MAX_LAT, MIN_LON, zoom)
    max_x, max_y = deg2num(MIN_LAT, MAX_LON, zoom)

    x_range = list(range(min_x, max_x + 1))
    y_range = list(range(min_y, max_y + 1))

    total_tiles = len(x_range) * len(y_range)
    print(f"Tiles needed: {len(x_range)} cols x {len(y_range)} rows = {total_tiles} tiles.")

    tile_size = 256
    grid_w = len(x_range) * tile_size
    grid_h = len(y_range) * tile_size

    tiles_dict = {}

    def load_tile(coord):
        ix, iy, x, y = coord
        try:
            tile = fetch_terrarium_tile(zoom, x, y)
            return (ix, iy, tile)
        except Exception as e:
            print(f"Error tile ({x},{y}): {e}")
            return (ix, iy, Image.new("RGB", (tile_size, tile_size), (0, 0, 0)))

    coords = [
        (ix, iy, x, y)
        for iy, y in enumerate(y_range)
        for ix, x in enumerate(x_range)
    ]

    print("Fetching elevation tiles in parallel...")
    with ThreadPoolExecutor(max_workers=16) as executor:
        for ix, iy, tile in executor.map(load_tile, coords):
            tiles_dict[(ix, iy)] = tile

    stitched_arr = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)
    for (ix, iy), tile in tiles_dict.items():
        stitched_arr[iy*tile_size:(iy+1)*tile_size, ix*tile_size:(ix+1)*tile_size] = np.array(tile)

    grid_max_lat, grid_min_lon = num2deg(min_x, min_y, zoom)
    grid_min_lat, grid_max_lon = num2deg(max_x + 1, max_y + 1, zoom)

    print("Decoding terrarium RGB to elevation meters...")
    r = stitched_arr[:, :, 0].astype(np.float32)
    g = stitched_arr[:, :, 1].astype(np.float32)
    b = stitched_arr[:, :, 2].astype(np.float32)
    # Terrarium formula: (R * 256 + G + B / 256) - 32768 = meters
    elev_m = (r * 256.0 + g + b / 256.0) - 32768.0

    print(f"Resampling to {WIDTH}x{HEIGHT} target Aegean bbox via Bilinear Interpolation...")
    target_lons = np.linspace(MIN_LON, MAX_LON, WIDTH, dtype=np.float32)
    target_lats = np.linspace(MAX_LAT, MIN_LAT, HEIGHT, dtype=np.float32)

    norm_x = (target_lons - grid_min_lon) / (grid_max_lon - grid_min_lon)
    px_x = np.clip(norm_x * grid_w, 0, grid_w - 1.0001).astype(np.float32)

    lat_rad = np.radians(target_lats)
    n = 2.0 ** zoom
    merc_y = (1.0 - np.arcsinh(np.tan(lat_rad)) / np.pi) / 2.0 * n
    norm_y = (merc_y - min_y) / (max_y + 1 - min_y)
    px_y = np.clip(norm_y * grid_h, 0, grid_h - 1.0001).astype(np.float32)

    # Vectorized bilinear resampling: eliminates blocky staircase pixel clusters
    x0 = np.floor(px_x).astype(int)
    x1 = np.clip(x0 + 1, 0, grid_w - 1)
    wx = (px_x - x0)[None, :].astype(np.float32)

    y0 = np.floor(px_y).astype(int)
    y1 = np.clip(y0 + 1, 0, grid_h - 1)
    wy = (px_y - y0)[:, None].astype(np.float32)

    top = elev_m[y0[:, None], x0[None, :]] * (1.0 - wx) + elev_m[y0[:, None], x1[None, :]] * wx
    bottom = elev_m[y1[:, None], x0[None, :]] * (1.0 - wx) + elev_m[y1[:, None], x1[None, :]] * wx
    elev_resampled = top * (1.0 - wy) + bottom * wy

    # 1. Continuous Land vs Sea distinction
    is_land = elev_resampled > 0.0
    is_sea = ~is_land

    print(f"Land pixels: {np.count_nonzero(is_land)} / {WIDTH * HEIGHT} ({np.count_nonzero(is_land)/(WIDTH*HEIGHT)*100:.1f}%)")
    print(f"Elevation range on land: min {np.min(elev_resampled[is_land]):.1f}m, max {np.max(elev_resampled[is_land]):.1f}m")

    # 2. Channel R: Land Elevation (0.0 for sea, smoothly starting at 0.0 on shorelines)
    # Continuous curve avoiding sudden vertical cliff edges at the beach
    r_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    land_height = np.clip(np.power(np.maximum(0.0, elev_resampled[is_land]) / 2400.0, 0.85) * 255.0, 0.0, 255.0)
    r_chan[is_land] = land_height.astype(np.uint8)

    # 3. Channel G: Bathymetry Depth (0 for land, 1..255 for sea depth)
    g_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    sea_depth = np.clip((-elev_resampled[is_sea] / 2000.0) * 255.0, 0.0, 255.0)
    g_chan[is_sea] = sea_depth.astype(np.uint8)

    # 4. Channel B: Anti-aliased smooth land coverage mask (0 = full ocean, 255 = full land)
    # Transition smoothly between 0m and 3m elevation to avoid 1-pixel jagged staircases
    land_alpha = np.clip(elev_resampled / 3.0, 0.0, 1.0)
    b_chan = (land_alpha * 255.0).astype(np.uint8)

    rgb_heightmap = np.stack([r_chan, g_chan, b_chan], axis=-1)
    out_img = Image.fromarray(rgb_heightmap, mode="RGB")
    out_img.save(target_path, "PNG", optimize=True)
    print(f"Saved 4K high-res discrete RGB heightmap -> {target_path} ({target_path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    bake_hires_heightmap(zoom=9)
