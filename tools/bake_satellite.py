import urllib.request
from PIL import Image, ImageEnhance
import io
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from config import MIN_LON, MAX_LON, MIN_LAT, MAX_LAT, WIDTH, HEIGHT, PUBLIC_DATA_DIR

def fetch_eox_tile(min_lat: float, min_lon: float, max_lat: float, max_lon: float, w: int, h: int) -> Image.Image:
    url = (
        f"https://tiles.maps.eox.at/wms?service=wms&request=getmap&version=1.3.0"
        f"&layers=s2cloudless-2020&styles=&format=image/jpeg&crs=EPSG:4326"
        f"&bbox={min_lat:.5f},{min_lon:.5f},{max_lat:.5f},{max_lon:.5f}&width={w}&height={h}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return Image.open(io.BytesIO(data))

def bake_day_satellite():
    target_path = PUBLIC_DATA_DIR / "day.jpg"
    print("--- Baking 4K Daylight Satellite Texture (EOX Sentinel-2 Cloudless 4096x4096) ---")
    
    cols = 4
    rows = 4
    tile_w = WIDTH // cols
    tile_h = HEIGHT // rows

    lon_steps = np.linspace(MIN_LON, MAX_LON, cols + 1)
    lat_steps = np.linspace(MIN_LAT, MAX_LAT, rows + 1)

    tasks = []
    for r in range(rows):
        # Image Y=0 is North (top)
        max_lat = lat_steps[rows - r]
        min_lat = lat_steps[rows - r - 1]
        for c in range(cols):
            min_lon = lon_steps[c]
            max_lon = lon_steps[c + 1]
            tasks.append((r, c, min_lat, min_lon, max_lat, max_lon))

    canvas = Image.new("RGB", (WIDTH, HEIGHT))

    def process_task(task):
        r, c, min_lat, min_lon, max_lat, max_lon = task
        print(f"Fetching EOX tile ({r},{c}) lat=[{min_lat:.2f}..{max_lat:.2f}], lon=[{min_lon:.2f}..{max_lon:.2f}]...")
        img = fetch_eox_tile(min_lat, min_lon, max_lat, max_lon, tile_w, tile_h)
        return r, c, img

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(process_task, tasks))

    for r, c, img in results:
        canvas.paste(img, (c * tile_w, r * tile_h))

    # Apply Mediterranean daylight enhancement (boost brightness +22% and contrast +15%)
    brightener = ImageEnhance.Brightness(canvas)
    canvas_boosted = brightener.enhance(1.22)
    contraster = ImageEnhance.Contrast(canvas_boosted)
    canvas_boosted = contraster.enhance(1.15)
    colorer = ImageEnhance.Color(canvas_boosted)
    canvas_boosted = colorer.enhance(1.15)

    canvas_boosted.save(target_path, "JPEG", quality=92, optimize=True)
    print(f"Saved 4K day satellite texture -> {target_path} ({target_path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    bake_day_satellite()
