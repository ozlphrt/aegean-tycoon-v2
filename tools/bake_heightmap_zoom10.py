import math
import urllib.request
from PIL import Image
import io
import os
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np

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

def bake_zoom10_elevation():
    zoom = 10
    target_hm_path = PUBLIC_DATA_DIR / "heightmap.png"
    target_norm_path = PUBLIC_DATA_DIR / "normals.png"
    print(f"=== Baking Ultra-High-Res Elevation & Normal Map (Terrarium Zoom {zoom}) ===")

    min_x, min_y = deg2num(MAX_LAT, MIN_LON, zoom)
    max_x, max_y = deg2num(MIN_LAT, MAX_LON, zoom)

    x_range = list(range(min_x, max_x + 1))
    y_range = list(range(min_y, max_y + 1))
    total_tiles = len(x_range) * len(y_range)
    print(f"Grid: {len(x_range)} cols x {len(y_range)} rows = {total_tiles} tiles.")

    tile_size = 256
    grid_w = len(x_range) * tile_size
    grid_h = len(y_range) * tile_size

    tiles_dict = {}
    coords = [
        (ix, iy, x, y)
        for iy, y in enumerate(y_range)
        for ix, x in enumerate(x_range)
    ]

    def load_tile(coord):
        ix, iy, x, y = coord
        try:
            tile = fetch_terrarium_tile(zoom, x, y)
            return (ix, iy, tile)
        except Exception as e:
            return (ix, iy, Image.new("RGB", (tile_size, tile_size), (0, 0, 0)))

    print("Fetching Zoom 10 tiles in parallel (max 28 workers)...")
    with ThreadPoolExecutor(max_workers=28) as executor:
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
    elev_m = (r * 256.0 + g + b / 256.0) - 32768.0

    print(f"Bilinear resampling to {WIDTH}x{HEIGHT} Aegean bounding box...")
    target_lons = np.linspace(MIN_LON, MAX_LON, WIDTH, dtype=np.float32)
    target_lats = np.linspace(MAX_LAT, MIN_LAT, HEIGHT, dtype=np.float32)

    norm_x = (target_lons - grid_min_lon) / (grid_max_lon - grid_min_lon)
    px_x = np.clip(norm_x * grid_w, 0, grid_w - 1.0001).astype(np.float32)

    lat_rad = np.radians(target_lats)
    n = 2.0 ** zoom
    merc_y = (1.0 - np.arcsinh(np.tan(lat_rad)) / np.pi) / 2.0 * n
    norm_y = (merc_y - min_y) / (max_y + 1 - min_y)
    px_y = np.clip(norm_y * grid_h, 0, grid_h - 1.0001).astype(np.float32)

    x0 = np.floor(px_x).astype(int)
    x1 = np.clip(x0 + 1, 0, grid_w - 1)
    wx = (px_x - x0)[None, :].astype(np.float32)

    y0 = np.floor(px_y).astype(int)
    y1 = np.clip(y0 + 1, 0, grid_h - 1)
    wy = (px_y - y0)[:, None].astype(np.float32)

    top = elev_m[y0[:, None], x0[None, :]] * (1.0 - wx) + elev_m[y0[:, None], x1[None, :]] * wx
    bottom = elev_m[y1[:, None], x0[None, :]] * (1.0 - wx) + elev_m[y1[:, None], x1[None, :]] * wx
    elev_resampled = top * (1.0 - wy) + bottom * wy

    is_land = elev_resampled > 0.0
    is_sea = ~is_land

    print(f"Land pixels: {np.count_nonzero(is_land)} / {WIDTH * HEIGHT} ({np.count_nonzero(is_land)/(WIDTH*HEIGHT)*100:.1f}%)")
    print(f"Elevation on land: min {np.min(elev_resampled[is_land]):.1f}m, max {np.max(elev_resampled[is_land]):.1f}m")

    # 1. Channel R: Land elevation (0 at water, smoothly starting at 0 at coast)
    r_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    land_height = np.clip(np.power(np.maximum(0.0, elev_resampled[is_land]) / 2400.0, 0.85) * 255.0, 0.0, 255.0)
    r_chan[is_land] = land_height.astype(np.uint8)

    # 2. Channel G: Bathymetry depth
    g_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    sea_depth = np.clip((-elev_resampled[is_sea] / 2000.0) * 255.0, 0.0, 255.0)
    g_chan[is_sea] = sea_depth.astype(np.uint8)

    # 3. Channel B: Anti-aliased smooth land coverage mask
    land_alpha = np.clip(elev_resampled / 3.0, 0.0, 1.0)
    b_chan = (land_alpha * 255.0).astype(np.uint8)

    rgb_heightmap = np.stack([r_chan, g_chan, b_chan], axis=-1)
    hm_img = Image.fromarray(rgb_heightmap, mode="RGB")
    hm_img.save(target_hm_path, "PNG", optimize=True)
    print(f"Saved 4K Zoom 10 heightmap -> {target_hm_path} ({target_hm_path.stat().st_size // 1024} KB)")

    # 4. Generate Pre-Baked High-Frequency Topographic Normal Map
    print("Computing topographic normal map (Sobel gradients)...")
    # Smooth land elevation field to prevent 1-pixel spikes
    land_elev_field = np.maximum(0.0, elev_resampled)
    # Compute gradients in meters: cell size is roughly 150m
    dy, dx = np.gradient(land_elev_field * 1.35) # exaggeration factor

    # World space: X is East, Y is UP (0,1,0), Z is South (down)
    # nx = -dx, ny = 150.0 (vertical scale), nz = dy
    cell_spacing = 140.0
    len_norm = np.sqrt(dx * dx + cell_spacing * cell_spacing + dy * dy)
    nx = -dx / len_norm
    ny = cell_spacing / len_norm
    nz = dy / len_norm

    # Blend smoothly to flat (0, 1, 0) on ocean and coasts
    coast_blend = np.clip(elev_resampled / 8.0, 0.0, 1.0)
    nx *= coast_blend
    nz *= coast_blend
    ny = np.sqrt(np.maximum(0.01, 1.0 - nx * nx - nz * nz))

    # Pack into standard normal map: R = nx, G = ny, B = nz
    norm_r = np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    norm_g = np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    norm_b = np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)

    normal_rgb = np.stack([norm_r, norm_g, norm_b], axis=-1)
    norm_img = Image.fromarray(normal_rgb, mode="RGB")
    norm_img.save(target_norm_path, "PNG", optimize=True)
    print(f"Saved 4K high-definition normal map -> {target_norm_path} ({target_norm_path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    bake_zoom10_elevation()
