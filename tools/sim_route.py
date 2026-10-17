import json, math, heapq

with open('public/data/sea_lanes.json', encoding='utf-8') as f: lanes = json.load(f)
with open('public/data/islands.json', encoding='utf-8') as f: islands = json.load(f)
with open('public/data/goods.json', encoding='utf-8') as f: goods = json.load(f)
with open('public/data/balance.json', encoding='utf-8') as f: balance = json.load(f)
with open('public/data/ships.json', encoding='utf-8') as f: ships_defs = json.load(f)

nodes = {n['id']: n for n in lanes['nodes']}
island_port_map = {n['islandId']: n['id'] for n in lanes['nodes'] if n.get('isPort') and n.get('islandId')}

adj = {nid: [] for nid in nodes}
for e in lanes['edges']:
    u, v = e['from'], e['to']
    if u in nodes and v in nodes:
        w = e.get('distanceKm', 1.0)
        adj[u].append((v, w))
        adj[v].append((u, w))

def haversine(lon1, lat1, lon2, lat2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def find_path(start, goal):
    q = [(0, start, [start])]
    g_score = {start: 0}
    visited = set()
    while q:
        f, cur, path = heapq.heappop(q)
        if cur == goal: return path
        if cur in visited: continue
        visited.add(cur)
        cur_g = g_score[cur]
        for nxt, dist in adj[cur]:
            t_g = cur_g + dist
            if t_g < g_score.get(nxt, float('inf')):
                g_score[nxt] = t_g
                h = haversine(nodes[nxt]['lon'], nodes[nxt]['lat'], nodes[goal]['lon'], nodes[goal]['lat'])
                heapq.heappush(q, (t_g + h, nxt, path + [nxt]))
    return None

def interpolate(path, dist_km):
    wps = [nodes[nid] for nid in path]
    accum = 0
    for i in range(len(wps) - 1):
        d = haversine(wps[i]['lon'], wps[i]['lat'], wps[i+1]['lon'], wps[i+1]['lat'])
        if accum + d >= dist_km:
            t = (dist_km - accum) / max(0.001, d)
            lon = wps[i]['lon'] + t * (wps[i+1]['lon'] - wps[i]['lon'])
            lat = wps[i]['lat'] + t * (wps[i+1]['lat'] - wps[i]['lat'])
            return lon, lat, i
        accum += d
    return wps[-1]['lon'], wps[-1]['lat'], len(wps) - 1

# Check route between santorini and naxos
p_s_n = find_path('port_santorini', 'port_naxos')
p_n_s = find_path('port_naxos', 'port_santorini')

print("Santorini -> Naxos:", p_s_n)
print("Naxos -> Santorini:", p_n_s)

# Sample positions along Naxos -> Santorini at 10km intervals:
wps = [nodes[nid] for nid in p_n_s]
total_d = sum(haversine(wps[i]['lon'], wps[i]['lat'], wps[i+1]['lon'], wps[i+1]['lat']) for i in range(len(wps)-1))
print(f"Total distance Naxos -> Santorini: {total_d:.1f} km")

from PIL import Image
import numpy as np

hm = np.array(Image.open('public/data/heightmap.png'))
H, W = hm.shape[:2]
MIN_LON, MAX_LON = 22.5, 29.5
MIN_LAT, MAX_LAT = 34.8, 41.0

for d in np.linspace(0, total_d, 20):
    lon, lat, leg = interpolate(p_n_s, d)
    px = int((lon - MIN_LON)/(MAX_LON - MIN_LON) * W)
    py = int((1.0 - (lat - MIN_LAT)/(MAX_LAT - MIN_LAT)) * H)
    val = hm[py, px]
    status = "LAND!" if (val[2] > 50 or val[0] > 0) else "sea"
    print(f"  d={d:5.1f}km: ({lon:.4f}, {lat:.4f}) | leg {leg} ({p_n_s[leg]}->{p_n_s[leg+1] if leg+1<len(p_n_s) else 'end'}) | hm={val[:3]} | {status}")
