import json
from PIL import Image
import numpy as np

hmap = np.array(Image.open('public/data/heightmap.png').convert('RGB'))[:, :, 0]
mask = np.array(Image.open('public/data/island_mask.png').convert('RGB'))[:, :, 0]
h, w = hmap.shape

MIN_LON, MAX_LON = 22.5, 29.5
MIN_LAT, MAX_LAT = 34.8, 41.0

def to_px(lon, lat):
    nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
    ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
    return int(np.clip(nx * (w - 1), 0, w - 1)), int(np.clip((1.0 - ny) * (h - 1), 0, h - 1))

def is_land(lon, lat):
    px, py = to_px(lon, lat)
    return hmap[py, px] > 2 or mask[py, px] > 0

with open('public/data/sea_lanes.json', encoding='utf-8') as f:
    d = json.load(f)

nodes = {n['id']: n for n in d['nodes']}

print(f"Total nodes: {len(nodes)}, Total edges: {len(d['edges'])}")

bad_nodes = []
for nid, n in nodes.items():
    if not n.get('isPort'):
        if is_land(n['lon'], n['lat']):
            bad_nodes.append((nid, n['lon'], n['lat']))

print(f"Waypoints on land: {len(bad_nodes)}")
for bn in bad_nodes:
    print(f"  LAND WP: {bn[0]} at lon={bn[1]}, lat={bn[2]}")

bad_edges = []
for e in d['edges']:
    n1 = nodes[e['from']]
    n2 = nodes[e['to']]
    land_count = 0
    # Test 50 points along edge (excluding immediate endpoints)
    for step in range(5, 96):
        t = step / 100.0
        lon = n1['lon'] + t * (n2['lon'] - n1['lon'])
        lat = n1['lat'] + t * (n2['lat'] - n1['lat'])
        if is_land(lon, lat):
            land_count += 1
    if land_count > 0:
        bad_edges.append((e['from'], e['to'], land_count))

print(f"\nEdges intersecting land: {len(bad_edges)} of {len(d['edges'])}")
for be in bad_edges:
    print(f"  LAND EDGE: {be[0]} <-> {be[1]} ({be[2]} samples hit land)")
