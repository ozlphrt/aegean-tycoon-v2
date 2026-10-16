import urllib.request
from PIL import Image, ImageEnhance
import io
import sys
from pathlib import Path
import numpy as np
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import MIN_LON, MAX_LON, MIN_LAT, MAX_LAT, PUBLIC_DATA_DIR, CACHE_DIR

# 8K resolution: 8192 x 8192 for ultra-crisp island details
WIDTH_8K = 8192
HEIGHT_8K = 8192

def fetch_eox_tile(min_lat: float, min_lon: float, max_lat: float, max_lon: float, w: int, h: int) -> Image.Image:
    url = (
        f"https://tiles.maps.eox.at/wms?service=wms&request=getmap&version=1.3.0"
        f"&layers=s2cloudless-2020&styles=&format=image/jpeg&crs=EPSG:4326"
        f"&bbox={min_lat:.5f},{min_lon:.5f},{max_lat:.5f},{max_lon:.5f}&width={w}&height={h}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return Image.open(io.BytesIO(data)).convert("RGB")

def bake_8k_satellite():
    target_path = PUBLIC_DATA_DIR / "day.jpg"
    print("=== Baking 8K Master Daylight Satellite Texture (8192x8192, 8x8 grid of 1024x1024) ===")

    cols = 8
    rows = 8
    tile_w = WIDTH_8K // cols # 1024
    tile_h = HEIGHT_8K // rows # 1024

    lon_steps = np.linspace(MIN_LON, MAX_LON, cols + 1)
    lat_steps = np.linspace(MIN_LAT, MAX_LAT, rows + 1)

    tasks = []
    for r in range(rows):
        max_lat = lat_steps[rows - r]
        min_lat = lat_steps[rows - r - 1]
        for c in range(cols):
            min_lon = lon_steps[c]
            max_lon = lon_steps[c + 1]
            tasks.append((r, c, min_lat, min_lon, max_lat, max_lon))

    canvas = Image.new("RGB", (WIDTH_8K, HEIGHT_8K))

    def process_task(task):
        r, c, min_lat, min_lon, max_lat, max_lon = task
        cache_file = CACHE_DIR / f"eox_8k_{r}_{c}.jpg"
        if cache_file.exists():
            try:
                return r, c, Image.open(cache_file).convert("RGB")
            except Exception:
                pass
        img = fetch_eox_tile(min_lat, min_lon, max_lat, max_lon, tile_w, tile_h)
        img.save(cache_file, "JPEG", quality=95)
        return r, c, img

    print(f"Downloading and assembling {len(tasks)} tiles in parallel...")
    with ThreadPoolExecutor(max_workers=16) as executor:
        for r, c, img in executor.map(process_task, tasks):
            canvas.paste(img, (c * tile_w, r * tile_h))

    print("Post-processing natural Mediterranean color grading...")
    # Very gentle color & contrast adjustment - realistic, not oversaturated
    brightener = ImageEnhance.Brightness(canvas)
    canvas_proc = brightener.enhance(1.06)
    contraster = ImageEnhance.Contrast(canvas_proc)
    canvas_proc = contraster.enhance(1.08)

    print(f"Saving 8K texture to {target_path}...")
    canvas_proc.save(target_path, "JPEG", quality=88, optimize=True)
    print(f"Saved 8K daylight satellite texture -> {target_path} ({target_path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    bake_8k_satellite()
