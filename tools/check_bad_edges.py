from PIL import Image
import json
import numpy as np

hm = np.array(Image.open('public/data/heightmap.png'))
H, W = hm.shape[:2]
MIN_LON, MAX_LON = 22.5, 29.5
MIN_LAT, MAX_LAT = 34.8, 41.0

with open('public/data/sea_lanes.json') as f:
    data = json.load(f)

nodes = {n['id']: n for n in data['nodes']}

print("\n=== Edges near Ios (lon: 25.0 - 25.6, lat: 36.5 - 37.0) ===")
ios_edges = []
for e in data['edges']:
    u, v = e['from'], e['to']
    if u not in nodes or v not in nodes: continue
    n1, n2 = nodes[u], nodes[v]
    if (25.0 <= n1['lon'] <= 25.6 and 36.5 <= n1['lat'] <= 37.0) or (25.0 <= n2['lon'] <= 25.6 and 36.5 <= n2['lat'] <= 37.0):
        ios_edges.append((u, v, n1, n2))

print(f"Found {len(ios_edges)} edges near Ios")
for u, v, n1, n2 in ios_edges:
    # Check 100 samples
    hit = False
    for s in range(1, 100):
        t = s / 100.0
        lon = n1['lon'] + t * (n2['lon'] - n1['lon'])
        lat = n1['lat'] + t * (n2['lat'] - n1['lat'])
        nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
        ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
        px = int(np.clip(nx * (W - 1), 0, W - 1))
        py = int(np.clip((1.0 - ny) * (H - 1), 0, H - 1))
        r, g, b = hm[py, px][:3]
        if b > 50 or r > 0:
            print(f"  COLLISION: {u} ({n1['lon']},{n1['lat']}) -> {v} ({n2['lon']},{n2['lat']}) hits at ({lon:.4f}, {lat:.4f}) r={r}, b={b}")
            hit = True
            break
    if not hit:
        print(f"  Clean: {u} -> {v}")

