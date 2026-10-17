import json, math, heapq

with open('public/data/sea_lanes.json') as f:
    data = json.load(f)

nodes = {n['id']: n for n in data['nodes']}
adj = {nid: [] for nid in nodes}
for e in data['edges']:
    u, v = e['from'], e['to']
    if u in nodes and v in nodes:
        d = math.hypot(nodes[u]['lon'] - nodes[v]['lon'], nodes[u]['lat'] - nodes[v]['lat'])
        adj[u].append((v, d))
        adj[v].append((u, d))

def astar(start, goal):
    q = [(0, start, [start])]
    visited = set()
    while q:
        cost, cur, path = heapq.heappop(q)
        if cur == goal: return path
        if cur in visited: continue
        visited.add(cur)
        for nxt, w in adj[cur]:
            if nxt not in visited:
                h = math.hypot(nodes[nxt]['lon'] - nodes[goal]['lon'], nodes[nxt]['lat'] - nodes[goal]['lat'])
                heapq.heappush(q, (cost + w, nxt, path + [nxt]))
    return None

path = astar('port_santorini', 'port_naxos')
print('Path:', path)

from PIL import Image
import numpy as np

hm_img = Image.open('public/data/heightmap.png')
hm = np.array(hm_img)
H, W = hm.shape[:2]
print(f"Heightmap shape: {hm.shape}")

# Coordinate transform matching Terrain.ts
MIN_LON, MAX_LON = 22.5, 29.5
MIN_LAT, MAX_LAT = 34.8, 41.0

def lonlat_to_px(lon, lat):
    nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
    ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
    px = int(np.clip(nx * (W - 1), 0, W - 1))
    py = int(np.clip((1.0 - ny) * (H - 1), 0, H - 1))
    return px, py

for i in range(len(path) - 1):
    u, v = path[i], path[i+1]
    n1, n2 = nodes[u], nodes[v]
    print(f"\nChecking segment: {u} -> {v}")
    
    # Sample 100 points
    max_elev = 0
    land_hits = 0
    for s in range(101):
        t = s / 100.0
        lon = n1['lon'] + t * (n2['lon'] - n1['lon'])
        lat = n1['lat'] + t * (n2['lat'] - n1['lat'])
        px, py = lonlat_to_px(lon, lat)
        val = hm[py, px]
        r = val[0] if hm.ndim == 3 else val
        if r > 0:
            land_hits += 1
            if r > max_elev:
                max_elev = r
                worst_lon, worst_lat = lon, lat
    if land_hits > 0:
        print(f"  [LAND HIT!] {land_hits}% of segment is on land! Max elevation: {max_elev} at ({worst_lon:.4f}, {worst_lat:.4f})")
    else:
        print("  [OK] 100% deep water")

