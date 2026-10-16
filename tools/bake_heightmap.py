import math
import urllib.request
from PIL import Image
import io
import numpy as np
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
        return Image.open(cache_file)

    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    with open(cache_file, "wb") as f:
        f.write(data)
    return Image.open(io.BytesIO(data))

def bake_heightmap():
    target_path = PUBLIC_DATA_DIR / "heightmap.png"
    print("--- Baking Clean RGB Elevation & Bathymetry Heightmap ---")

    zoom = 7
    min_x, min_y = deg2num(MAX_LAT, MIN_LON, zoom)
    max_x, max_y = deg2num(MIN_LAT, MAX_LON, zoom)

    x_range = range(min_x, max_x + 1)
    y_range = range(min_y, max_y + 1)

    tile_size = 256
    grid_w = len(x_range) * tile_size
    grid_h = len(y_range) * tile_size

    stitched_arr = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)

    for iy, y in enumerate(y_range):
        for ix, x in enumerate(x_range):
            try:
                tile = fetch_terrarium_tile(zoom, x, y).convert("RGB")
                stitched_arr[iy*tile_size:(iy+1)*tile_size, ix*tile_size:(ix+1)*tile_size] = np.array(tile)
            except Exception as e:
                print(f"Warning: Failed tile {x},{y}: {e}")

    grid_max_lat, grid_min_lon = num2deg(min_x, min_y, zoom)
    grid_min_lat, grid_max_lon = num2deg(max_x + 1, max_y + 1, zoom)

    r = stitched_arr[:, :, 0].astype(np.float32)
    g = stitched_arr[:, :, 1].astype(np.float32)
    b = stitched_arr[:, :, 2].astype(np.float32)
    elev_m = (r * 256.0 + g + b / 256.0) - 32768.0

    target_lons = np.linspace(MIN_LON, MAX_LON, WIDTH, dtype=np.float32)
    target_lats = np.linspace(MAX_LAT, MIN_LAT, HEIGHT, dtype=np.float32)

    norm_x = (target_lons - grid_min_lon) / (grid_max_lon - grid_min_lon)
    px_x = np.clip(norm_x * grid_w, 0, grid_w - 1).astype(int)

    lat_rad = np.radians(target_lats)
    n = 2.0 ** zoom
    merc_y = (1.0 - np.arcsinh(np.tan(lat_rad)) / np.pi) / 2.0 * n
    norm_y = (merc_y - min_y) / (max_y + 1 - min_y)
    px_y = np.clip(norm_y * grid_h, 0, grid_h - 1).astype(int)

    elev_resampled = elev_m[np.ix_(px_y, px_x)]

    # 1. Clean Land vs Sea Mask (elevation > 0m is land)
    is_land = elev_resampled > 0.0
    is_sea = ~is_land

    # 2. Channel R: Land Elevation (0 for water, 1..255 for land)
    r_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    land_height = np.clip(np.power(elev_resampled[is_land] / 2200.0, 0.85) * 253.0 + 2.0, 2.0, 255.0)
    r_chan[is_land] = land_height.astype(np.uint8)

    # 3. Channel G: Bathymetry Depth (0 for land, 1..255 for sea depth)
    g_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    sea_depth = np.clip((-elev_resampled[is_sea] / 2000.0) * 255.0, 0.0, 255.0)
    g_chan[is_sea] = sea_depth.astype(np.uint8)

    # 4. Channel B: Land Mask (255 for land, 0 for sea)
    b_chan = np.zeros_like(elev_resampled, dtype=np.uint8)
    b_chan[is_land] = 255

    rgb_heightmap = np.stack([r_chan, g_chan, b_chan], axis=-1)
    hm_img = Image.fromarray(rgb_heightmap, mode="RGB")
    hm_img.save(target_path, "PNG", optimize=True)
    print(f"Saved clean RGB heightmap -> {target_path} (Land: {np.sum(is_land)} px, Sea: {np.sum(is_sea)} px)")

if __name__ == "__main__":
    bake_heightmap()
