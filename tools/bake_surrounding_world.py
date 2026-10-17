import math
import urllib.request
import io
import time
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
from concurrent.futures import ThreadPoolExecutor

# Geographic bounds for the surrounding Mediterranean world context
# Centered at Lon 26.0, Lat 37.9 (same as Aegean core)
WORLD_MIN_LON = 18.0
WORLD_MAX_LON = 34.0
WORLD_MIN_LAT = 30.814
WORLD_MAX_LAT = 44.986

WIDTH = 2048
HEIGHT = 2304

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
CACHE_DIR = ROOT_DIR / "tools" / "cache"

PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def fetch_eox_tile(min_lat: float, min_lon: float, max_lat: float, max_lon: float, w: int, h: int) -> Image.Image:
    url = (
        f"https://tiles.maps.eox.at/wms?service=wms&request=getmap&version=1.3.0"
        f"&layers=s2cloudless-2020&styles=&format=image/jpeg&crs=EPSG:4326"
        f"&bbox={min_lat:.5f},{min_lon:.5f},{max_lat:.5f},{max_lon:.5f}&width={w}&height={h}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return Image.open(io.BytesIO(resp.read()))

def fetch_nasa_tile(min_lat: float, min_lon: float, max_lat: float, max_lon: float, w: int, h: int) -> Image.Image:
    url = (
        f"https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
        f"?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
        f"&LAYERS=VIIRS_Black_Marble&STYLES=&FORMAT=image/png"
        f"&CRS=EPSG:4326&BBOX={min_lat:.5f},{min_lon:.5f},{max_lat:.5f},{max_lon:.5f}&WIDTH={w}&HEIGHT={h}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return Image.open(io.BytesIO(resp.read()))

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
            return Image.open(cache_file)
        except Exception:
            pass
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    with open(cache_file, "wb") as f:
        f.write(data)
    return Image.open(io.BytesIO(data))

def bake_day_world():
    day_path = PUBLIC_DATA_DIR / "world_day.jpg"
    print("--- 1/3 Baking Surrounding World Daylight Satellite Texture ---")
    cols = 4
    rows = 4
    tile_w = WIDTH // cols
    tile_h = HEIGHT // rows

    lon_steps = np.linspace(WORLD_MIN_LON, WORLD_MAX_LON, cols + 1)
    lat_steps = np.linspace(WORLD_MIN_LAT, WORLD_MAX_LAT, rows + 1)

    tasks = []
    for r in range(rows):
        max_lat = lat_steps[rows - r]
        min_lat = lat_steps[rows - r - 1]
        for c in range(cols):
            min_lon = lon_steps[c]
            max_lon = lon_steps[c + 1]
            tasks.append((r, c, min_lat, min_lon, max_lat, max_lon))

    canvas = Image.new("RGB", (WIDTH, HEIGHT))

    def fetch_task(task):
        r, c, min_lat, min_lon, max_lat, max_lon = task
        cache_f = CACHE_DIR / f"world_day_{r}_{c}.jpg"
        if cache_f.exists():
            try:
                return r, c, Image.open(cache_f)
            except Exception:
                pass
        print(f"  Fetching EOX tile ({r},{c})...")
        img = fetch_eox_tile(min_lat, min_lon, max_lat, max_lon, tile_w, tile_h)
        img.save(cache_f, "JPEG", quality=92)
        return r, c, img

    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(fetch_task, tasks))

    for r, c, img in results:
        canvas.paste(img, (c * tile_w, r * tile_h))

    # Daylight enhancements to match Aegean core grading
    canvas = ImageEnhance.Brightness(canvas).enhance(1.18)
    canvas = ImageEnhance.Contrast(canvas).enhance(1.12)
    canvas = ImageEnhance.Color(canvas).enhance(1.08)
    canvas.save(day_path, "JPEG", quality=88)
    print(f"Saved {day_path} ({WIDTH}x{HEIGHT})")
    return canvas

def bake_night_world(day_img: Image.Image):
    night_path = PUBLIC_DATA_DIR / "world_night.jpg"
    print("--- 2/3 Baking Surrounding World Night Texture with NASA VIIRS Lights ---")
    cols = 4
    rows = 4
    tile_w = WIDTH // cols
    tile_h = HEIGHT // rows

    lon_steps = np.linspace(WORLD_MIN_LON, WORLD_MAX_LON, cols + 1)
    lat_steps = np.linspace(WORLD_MIN_LAT, WORLD_MAX_LAT, rows + 1)

    tasks = []
    for r in range(rows):
        max_lat = lat_steps[rows - r]
        min_lat = lat_steps[rows - r - 1]
        for c in range(cols):
            min_lon = lon_steps[c]
            max_lon = lon_steps[c + 1]
            tasks.append((r, c, min_lat, min_lon, max_lat, max_lon))

    lights_canvas = Image.new("RGB", (WIDTH, HEIGHT))

    def fetch_task(task):
        r, c, min_lat, min_lon, max_lat, max_lon = task
        cache_f = CACHE_DIR / f"world_nasa_{r}_{c}.png"
        if cache_f.exists():
            try:
                return r, c, Image.open(cache_f)
            except Exception:
                pass
        print(f"  Fetching NASA tile ({r},{c})...")
        img = fetch_nasa_tile(min_lat, min_lon, max_lat, max_lon, tile_w, tile_h)
        img.save(cache_f, "PNG")
        return r, c, img

    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(fetch_task, tasks))

    for r, c, img in results:
        lights_canvas.paste(img, (c * tile_w, r * tile_h))

    # Composite moonlit satellite base + warm amber city lights
    day_np = np.array(day_img).astype(np.float32) / 255.0
    lights_np = np.array(lights_canvas).astype(np.float32) / 255.0

    # Moonlit Mediterranean base: deep sapphire navy
    moonlit_base = day_np * np.array([0.05, 0.08, 0.16], dtype=np.float32)

    # City lights: isolate bright spots and tint with warm Mediterranean amber
    lights_luma = lights_np.mean(axis=2, keepdims=True)
    lights_thresh = np.clip((lights_luma - 0.08) * 1.5, 0.0, 1.0)
    amber_tint = np.array([1.35, 1.05, 0.65], dtype=np.float32)
    city_glow = lights_thresh * amber_tint * 0.75

    night_np = np.clip(moonlit_base + city_glow, 0.0, 1.0)
    night_img = Image.fromarray((night_np * 255).astype(np.uint8))
    night_img.save(night_path, "JPEG", quality=88)
    print(f"Saved {night_path} ({WIDTH}x{HEIGHT})")

def bake_heightmap_world():
    hmap_path = PUBLIC_DATA_DIR / "world_heightmap.png"
    print("--- 3/3 Baking Surrounding World Elevation & Water Mask ---")
    zoom = 6
    min_x, min_y = deg2num(WORLD_MAX_LAT, WORLD_MIN_LON, zoom)
    max_x, max_y = deg2num(WORLD_MIN_LAT, WORLD_MAX_LON, zoom)

    x_range = range(min_x, max_x + 1)
    y_range = range(min_y, max_y + 1)
    tile_size = 256
    grid_w = len(x_range) * tile_size
    grid_h = len(y_range) * tile_size

    stitched = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)

    for iy, y in enumerate(y_range):
        for ix, x in enumerate(x_range):
            try:
                tile = fetch_terrarium_tile(zoom, x, y).convert("RGB")
                stitched[iy*tile_size:(iy+1)*tile_size, ix*tile_size:(ix+1)*tile_size] = np.array(tile)
            except Exception as e:
                print(f"Warning: Failed tile {x},{y}: {e}")

    grid_max_lat, grid_min_lon = num2deg(min_x, min_y, zoom)
    grid_min_lat, grid_max_lon = num2deg(max_x + 1, max_y + 1, zoom)

    # Terrarium decode: meters = (R * 256 + G + B / 256) - 32768
    r = stitched[:, :, 0].astype(np.float32)
    g = stitched[:, :, 1].astype(np.float32)
    b = stitched[:, :, 2].astype(np.float32)
    elevation_m = (r * 256.0 + g + b / 256.0) - 32768.0

    # Crop/sample to exact WORLD bounds
    out_w, out_h = 1024, 1152
    h_canvas = Image.new("RGB", (out_w, out_h))

    # Land mask: elevation > 0.5m
    is_land = (elevation_m > 0.5).astype(np.float32)
    # Normalize land elevation (0..2917m Mount Olympus)
    land_norm = np.clip(elevation_m / 3000.0, 0.0, 1.0) * is_land
    # Bathymetry depth for sea
    sea_depth = np.clip(-elevation_m / 4500.0, 0.0, 1.0) * (1.0 - is_land)

    res_arr = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)
    res_arr[:, :, 0] = (land_norm * 255).astype(np.uint8)
    res_arr[:, :, 1] = (is_land * 255).astype(np.uint8)
    res_arr[:, :, 2] = (sea_depth * 255).astype(np.uint8)

    # Crop to exact WORLD lat/lon
    x0 = int((WORLD_MIN_LON - grid_min_lon) / (grid_max_lon - grid_min_lon) * grid_w)
    x1 = int((WORLD_MAX_LON - grid_min_lon) / (grid_max_lon - grid_min_lon) * grid_w)
    y0 = int((grid_max_lat - WORLD_MAX_LAT) / (grid_max_lat - grid_min_lat) * grid_h)
    y1 = int((grid_max_lat - WORLD_MIN_LAT) / (grid_max_lat - grid_min_lat) * grid_h)

    cropped = Image.fromarray(res_arr[y0:y1, x0:x1]).resize((out_w, out_h), Image.Resampling.BILINEAR)
    cropped.save(hmap_path, "PNG")
    print(f"Saved {hmap_path} ({out_w}x{out_h})")

if __name__ == "__main__":
    print(f"Baking surrounding Mediterranean world [{WORLD_MIN_LON}..{WORLD_MAX_LON}, {WORLD_MIN_LAT}..{WORLD_MAX_LAT}]...")
    day_img = bake_day_world()
    bake_night_world(day_img)
    bake_heightmap_world()
    print("All surrounding world assets baked successfully!")
