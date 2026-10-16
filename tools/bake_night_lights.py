import urllib.request
from PIL import Image
import io
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from config import MIN_LON, MAX_LON, MIN_LAT, MAX_LAT, WIDTH, HEIGHT, PUBLIC_DATA_DIR, CACHE_DIR

def fetch_nasa_black_marble(min_lat: float, min_lon: float, max_lat: float, max_lon: float, w: int, h: int) -> Image.Image:
    url = (
        f"https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
        f"?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
        f"&LAYERS=VIIRS_Black_Marble&STYLES=&FORMAT=image/png"
        f"&CRS=EPSG:4326&BBOX={min_lat:.5f},{min_lon:.5f},{max_lat:.5f},{max_lon:.5f}&WIDTH={w}&HEIGHT={h}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return Image.open(io.BytesIO(data))

def bake_night_and_lights():
    lights_path = PUBLIC_DATA_DIR / "lights.png"
    night_path = PUBLIC_DATA_DIR / "night.jpg"
    print("--- Baking 4K Night Lights & Scene (NASA VIIRS 4096x4096) ---")

    cols = 4
    rows = 4
    tile_w = WIDTH // cols
    tile_h = HEIGHT // rows

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

    raw_lights = Image.new("RGB", (WIDTH, HEIGHT))

    def process_task(task):
        r, c, min_lat, min_lon, max_lat, max_lon = task
        cache_file = CACHE_DIR / f"nasa_{r}_{c}.png"
        if cache_file.exists():
            try:
                return r, c, Image.open(cache_file).convert("RGB")
            except Exception:
                pass
        print(f"Fetching NASA tile ({r},{c}) lat=[{min_lat:.2f}..{max_lat:.2f}], lon=[{min_lon:.2f}..{max_lon:.2f}]...")
        img = fetch_nasa_black_marble(min_lat, min_lon, max_lat, max_lon, tile_w, tile_h)
        img.save(cache_file, "PNG")
        return r, c, img

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(process_task, tasks))

    for r, c, img in results:
        raw_lights.paste(img, (c * tile_w, r * tile_h))

    # Process into delicate warm amber emissive lights RGBA
    arr = np.array(raw_lights).astype(np.float32)
    luminance = (arr[:, :, 0] * 0.299 + arr[:, :, 1] * 0.587 + arr[:, :, 2] * 0.114) / 255.0
    # Higher threshold to eliminate widespread noise and light pollution halos
    luminance = np.clip((luminance - 0.14) / 0.86, 0.0, 1.0)
    # Power curve to concentrate light on dense urban cores & harbor quays
    luminance = np.power(luminance, 1.8)

    r_light = np.clip(luminance * 240, 0, 255).astype(np.uint8)
    g_light = np.clip(luminance * 180, 0, 255).astype(np.uint8)
    b_light = np.clip(luminance * 90, 0, 255).astype(np.uint8)
    a_light = np.clip(luminance * 255, 0, 255).astype(np.uint8)

    lights_rgba = np.stack([r_light, g_light, b_light, a_light], axis=-1)
    lights_img = Image.fromarray(lights_rgba, mode="RGBA")
    lights_img.save(lights_path, "PNG", optimize=True)
    print(f"Saved 4K lights texture -> {lights_path} ({lights_path.stat().st_size // 1024} KB)")

    # Prepare clean 4K moonlit night backdrop from day satellite texture
    # IMPORTANT: Do NOT bake blinding lights into night.jpg; lights are controlled dynamically via lights.png
    day_path = PUBLIC_DATA_DIR / "day.jpg"
    if day_path.exists():
        day_img = Image.open(day_path).convert("RGB")
        if day_img.size != (WIDTH, HEIGHT):
            day_img = day_img.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)
        day_arr = np.array(day_img).astype(np.float32) / 255.0

        night_r = np.clip(day_arr[:, :, 0] * 0.22, 0.0, 1.0)
        night_g = np.clip(day_arr[:, :, 1] * 0.28, 0.0, 1.0)
        night_b = np.clip(day_arr[:, :, 2] * 0.44, 0.0, 1.0)

        night_rgb = (np.stack([night_r, night_g, night_b], axis=-1) * 255).astype(np.uint8)
        night_img = Image.fromarray(night_rgb, mode="RGB")
    else:
        night_img = raw_lights

    night_img.save(night_path, "JPEG", quality=90, optimize=True)
    print(f"Saved clean 4K moonlit night texture -> {night_path} ({night_path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    bake_night_and_lights()
