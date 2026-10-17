import json, math
from PIL import Image
import numpy as np

data = json.load(open('public/data/sea_lanes.json'))
nodes = {n['id']: n for n in data['nodes']}

path_ids = ['port_santorini', 'wp_santorini_caldera_west', 'wp_santorini_open_west', 'wp_santorini_open_north', 'wp_ios_west_channel', 'wp_ios_north_fairway', 'wp_paros_naxos_strait_south', 'wp_paros_naxos_strait_mid', 'wp_grid_0612', 'port_naxos']

hm = np.array(Image.open('public/data/heightmap.png'))
H, W = hm.shape[:2]
MIN_LON, MAX_LON = 22.5, 29.5
MIN_LAT, MAX_LAT = 34.8, 41.0
planeWidth = 70.0
planeHeight = 78.65

def to_world(lon, lat):
    nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
    ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
    wx = (nx - 0.5) * planeWidth
    wz = -(ny - 0.5) * planeHeight
    return wx, wz

def to_px(lon, lat):
    nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
    ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
    px = int(np.clip(nx * (W - 1), 0, W - 1))
    py = int(np.clip((1.0 - ny) * (H - 1), 0, H - 1))
    return px, py

print("Path waypoints & coordinates:")
for nid in path_ids:
    n = nodes[nid]
    wx, wz = to_world(n['lon'], n['lat'])
    px, py = to_px(n['lon'], n['lat'])
    val = hm[py, px]
    print(f"  {nid:30s} lon={n['lon']:.4f}, lat={n['lat']:.4f} | world=({wx:6.2f}, {wz:6.2f}) | hm={val}")

print("\nSampling 50 points on each leg:")
for i in range(len(path_ids) - 1):
    u, v = path_ids[i], path_ids[i+1]
    n1, n2 = nodes[u], nodes[v]
    land_count = 0
    max_elev = 0
    worst = None
    for s in range(51):
        t = s / 50.0
        lon = n1['lon'] + t * (n2['lon'] - n1['lon'])
        lat = n1['lat'] + t * (n2['lat'] - n1['lat'])
        px, py = to_px(lon, lat)
        val = hm[py, px]
        r, g, b = val[:3]
        if b > 50 or r > 0:
            land_count += 1
            if r > max_elev:
                max_elev = r
                worst = (lon, lat, r, b)
    if land_count > 0:
        print(f"  [LAND HIT!] LEG {u} -> {v} HITS LAND: {land_count}/51 samples! Worst: lon={worst[0]:.4f}, lat={worst[1]:.4f}, elev={worst[2]}, mask={worst[3]}")
    else:
        print(f"  [OK] LEG {u} -> {v} Clean water")
