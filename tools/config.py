import os
from pathlib import Path

# Bounding box for the Aegean Archipelago
# Lon: 22.5 (Athens/Piraeus) to 29.5 (Turkish Aegean coast)
# Lat: 34.8 (South of Crete) to 41.0 (North Aegean, Thessaloniki, Thasos)
MIN_LON = 22.5
MAX_LON = 29.5
MIN_LAT = 34.8
MAX_LAT = 41.0

# Standard texture resolution for high-definition 4K WebGL2 pipeline
WIDTH = 4096
HEIGHT = 4096

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
CACHE_DIR = ROOT_DIR / "tools" / "cache"

PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def lonlat_to_pixel(lon: float, lat: float, width: int = WIDTH, height: int = HEIGHT):
    """Converts geographic longitude and latitude to image pixel coordinates (Equirectangular)."""
    x = (lon - MIN_LON) / (MAX_LON - MIN_LON) * width
    y = (MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * height
    return int(round(x)), int(round(y))

def pixel_to_lonlat(x: float, y: float, width: int = WIDTH, height: int = HEIGHT):
    """Converts image pixel coordinates back to geographic longitude and latitude."""
    lon = MIN_LON + (x / width) * (MAX_LON - MIN_LON)
    lat = MAX_LAT - (y / height) * (MAX_LAT - MIN_LAT)
    return lon, lat
