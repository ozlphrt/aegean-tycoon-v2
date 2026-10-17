import cv2
import json
import math
import heapq
from pathlib import Path
from PIL import Image
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"

MIN_LON = 22.5
MAX_LON = 29.5
MIN_LAT = 34.8
MAX_LAT = 41.0
W_4K = 4096
H_4K = 4096

def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def to_4k(lon: float, lat: float):
    nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
    ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
    px = int(np.clip(nx * (W_4K - 1), 0, W_4K - 1))
    py = int(np.clip((1.0 - ny) * (H_4K - 1), 0, H_4K - 1))
    return px, py

def from_4k(px: int, py: int):
    lon = MIN_LON + (px / (W_4K - 1)) * (MAX_LON - MIN_LON)
    lat = MIN_LAT + (1.0 - py / (H_4K - 1)) * (MAX_LAT - MIN_LAT)
    return round(lon, 4), round(lat, 4)

print("Loading masks...")
mask = np.array(Image.open(PUBLIC_DATA_DIR / "island_mask.png").convert("RGB"))[:, :, 0]
hmap = np.array(Image.open(PUBLIC_DATA_DIR / "heightmap.png").convert("RGB"))[:, :, 0]
is_water = ((mask == 0) & (hmap <= 2)).astype(np.uint8)
dist_4k = cv2.distanceTransform(is_water, cv2.DIST_L2, 5)

def check_line(p1, p2):
    x1, y1 = to_4k(p1[0], p1[1])
    x2, y2 = to_4k(p2[0], p2[1])
    steps = max(5, int(math.hypot(x2 - x1, y2 - y1)))
    for s in range(steps + 1):
        t = s / steps
        px = int(x1 + t * (x2 - x1))
        py = int(y1 + t * (y2 - y1))
        if dist_4k[py, px] < 1.0:
            return False
    return True

with open(PUBLIC_DATA_DIR / "islands.json", "r", encoding="utf-8") as f:
    islands = json.load(f)

# Collect points
pts = []
node_meta = {}

# 1. Ports
for isl in islands:
    orig_lon = isl.get("port", {}).get("lon", isl["lon"])
    orig_lat = isl.get("port", {}).get("lat", isl["lat"])
    px, py = to_4k(orig_lon, orig_lat)
    if dist_4k[py, px] >= 2.0:
        w_lon, w_lat = orig_lon, orig_lat
    else:
        best = None
        for r in range(1, 60):
            for dy in range(-r, r+1):
                for dx in range(-r, r+1):
                    if 0 <= py+dy < H_4K and 0 <= px+dx < W_4K:
                        if dist_4k[py+dy, px+dx] >= 2.0:
                            d_sq = dx*dx + dy*dy
                            if best is None or d_sq < best[0]:
                                best = (d_sq, px+dx, py+dy)
            if best: break
        if best:
            w_lon, w_lat = from_4k(best[1], best[2])
        else:
            w_lon, w_lat = orig_lon, orig_lat

    pid = f"port_{isl['id']}"
    node_meta[pid] = {
        "id": pid,
        "name": f"{isl['name']} Port",
        "lon": w_lon,
        "lat": w_lat,
        "isPort": True,
        "islandId": isl["id"]
    }
    pts.append((w_lon, w_lat, pid))

# Precise port water corrections
node_meta["port_santorini"]["lon"] = 25.385
node_meta["port_santorini"]["lat"] = 36.386
node_meta["port_naxos"]["lon"] = 25.358
node_meta["port_naxos"]["lat"] = 37.106
node_meta["port_paros"]["lon"] = 25.138
node_meta["port_paros"]["lat"] = 37.088

# 2. Strategic waterway points and fairways
fairways = [
    ("wp_santorini_caldera_west", 25.350, 36.397),
    ("wp_santorini_open_west", 25.280, 36.420),
    ("wp_santorini_open_north", 25.320, 36.560),
    ("wp_santorini_open_south", 25.350, 36.300),
    ("wp_santorini_open_east", 25.560, 36.380),
    ("wp_ios_west_channel", 25.200, 36.720),
    ("wp_ios_north_fairway", 25.240, 36.850),
    ("wp_paros_naxos_strait_south", 25.310, 36.980),
    ("wp_paros_naxos_strait_mid", 25.325, 37.080),
    ("wp_paros_naxos_strait_north", 25.330, 37.160),
    ("wp_naxos_harbor_approach", 25.350, 37.106),
    ("wp_paros_north_open", 25.220, 37.190),
    ("wp_paros_west_channel", 25.080, 37.120),
    ("wp_parikia_bay_approach", 25.120, 37.095),
    ("wp_antiparos_channel", 25.070, 37.045),
    ("wp_milos_bay_entrance", 24.380, 36.765),
    ("wp_milos_bay_mid", 24.410, 36.740),
    ("wp_izmir_outer_gulf", 26.550, 38.600),
    ("wp_izmir_mid_gulf", 26.850, 38.450),
    ("wp_izmir_approach", 27.050, 38.440),
    ("wp_kalymnos_approach", 26.980, 36.945),
    ("wp_symi_approach", 27.840, 36.625),
    ("wp_thasos_approach", 24.710, 40.785),
    ("wp_aegina_approach", 23.420, 37.755),
]
for wid, lon, lat in fairways:
    node_meta[wid] = {"id": wid, "name": wid, "lon": lon, "lat": lat, "isPort": False}
    pts.append((lon, lat, wid))

# 3. Dense open-water grid sampling (every ~18 km, lon step 0.20, lat step 0.16)
wp_counter = 1
for lon in np.arange(MIN_LON + 0.15, MAX_LON - 0.15, 0.16):
    for lat in np.arange(MIN_LAT + 0.15, MAX_LAT - 0.15, 0.14):
        px, py = to_4k(lon, lat)
        if dist_4k[py, px] >= 6.0: # Deep open water (> 500m from any coast)
            wid = f"wp_grid_{wp_counter:04d}"
            wp_counter += 1
            node_meta[wid] = {"id": wid, "name": wid, "lon": round(float(lon), 4), "lat": round(float(lat), 4), "isPort": False}
            pts.append((round(float(lon), 4), round(float(lat), 4), wid))

print(f"Total nodes: {len(pts)} ({len(islands)} ports, {len(pts)-len(islands)} water waypoints)")

# Delaunay triangulation with cv2.Subdiv2D
subdiv = cv2.Subdiv2D((0, 0, W_4K, H_4K))
pt_to_id = {}
for lon, lat, nid in pts:
    px, py = to_4k(lon, lat)
    pt_to_id[(px, py)] = nid
    subdiv.insert((px, py))

edges = []
added = set()

# Process Delaunay edges
edge_list = subdiv.getEdgeList()
print(f"Delaunay generated {len(edge_list)} candidate edges.")

for e in edge_list:
    p1_x, p1_y, p2_x, p2_y = int(e[0]), int(e[1]), int(e[2]), int(e[3])
    if not (0 <= p1_x < W_4K and 0 <= p1_y < H_4K and 0 <= p2_x < W_4K and 0 <= p2_y < H_4K):
        continue
    # Find closest node id
    id1 = pt_to_id.get((p1_x, p1_y))
    id2 = pt_to_id.get((p2_x, p2_y))
    if not id1 or not id2 or id1 == id2:
        continue
    ek = tuple(sorted([id1, id2]))
    if ek in added:
        continue

    coord1 = (node_meta[id1]["lon"], node_meta[id1]["lat"])
    coord2 = (node_meta[id2]["lon"], node_meta[id2]["lat"])
    if check_line(coord1, coord2):
        added.add(ek)
        dist = haversine_km(coord1[0], coord1[1], coord2[0], coord2[1])
        edges.append({
            "from": id1,
            "to": id2,
            "distanceKm": round(dist, 2)
        })

# Connect every port to up to 5 nearest visible water nodes
port_pids = [p[2] for p in pts if node_meta[p[2]].get("isPort")]
water_pids = [p[2] for p in pts if not node_meta[p[2]].get("isPort")]

for pid in port_pids:
    pcoord = (node_meta[pid]["lon"], node_meta[pid]["lat"])
    cands = []
    for wid in water_pids:
        wcoord = (node_meta[wid]["lon"], node_meta[wid]["lat"])
        dist = haversine_km(pcoord[0], pcoord[1], wcoord[0], wcoord[1])
        if dist < 65.0:
            cands.append((dist, wid, wcoord))
    cands.sort()
    connected_count = 0
    for dist, wid, wcoord in cands:
        ek = tuple(sorted([pid, wid]))
        if ek not in added and check_line(pcoord, wcoord):
            added.add(ek)
            edges.append({"from": pid, "to": wid, "distanceKm": round(dist, 2)})
            connected_count += 1
            if connected_count >= 5:
                break
    if connected_count == 0:
        print(f"  WARNING: Port {pid} has 0 visible water connections within 65km!")

print(f"Verified {len(edges)} collision-free edges (ALL 100% in water).")

# Check connectivity via A*
adj = {}
for e in edges:
    adj.setdefault(e["from"], []).append((e["to"], e["distanceKm"]))
    adj.setdefault(e["to"], []).append((e["from"], e["distanceKm"]))

def a_star(s, g):
    frontier = [(0, s, [s])]
    cost = {s: 0}
    while frontier:
        c, curr, path = heapq.heappop(frontier)
        if curr == g:
            return path, c
        for nxt, d in adj.get(curr, []):
            nc = cost[curr] + d
            if nxt not in cost or nc < cost[nxt]:
                cost[nxt] = nc
                h = haversine_km(node_meta[nxt]["lon"], node_meta[nxt]["lat"], node_meta[g]["lon"], node_meta[g]["lat"])
                heapq.heappush(frontier, (nc + h, nxt, path + [nxt]))
    return None, 999999

p_s_n, cost_s_n = a_star("port_santorini", "port_naxos")
if p_s_n:
    print(f"\nSANTORINI -> NAXOS ROUTE FOUND! ({cost_s_n:.1f} km, {len(p_s_n)} waypoints):")
    for wp in p_s_n:
        print(f"  {wp} ({node_meta[wp]['lon']}, {node_meta[wp]['lat']})")
else:
    print("\nFAIL: Santorini -> Naxos path not found!")

unreachable = 0
for isl in islands:
    pid = f"port_{isl['id']}"
    if pid == "port_santorini":
        continue
    p, _ = a_star("port_santorini", pid)
    if not p:
        unreachable += 1

print(f"\nPorts connected to Santorini: {len(islands) - 1 - unreachable} / {len(islands) - 1}")
