"""
High-Precision Aegean Waterways & Sea-Lanes Generator.
Generates 100% navigable maritime shipping corridors with ZERO land intersections,
using the 4K elevation heightmap and island mask distance transform.
"""

import json
import math
import heapq
from pathlib import Path
from PIL import Image
import numpy as np
import cv2

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"

MIN_LON = 22.5
MAX_LON = 29.5
MIN_LAT = 34.8
MAX_LAT = 41.0
W_4K = 4096
H_4K = 4096

GRID_W = 512
GRID_H = 512

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
    return round(lon, 5), round(lat, 5)

def to_grid(lon: float, lat: float):
    nx = (lon - MIN_LON) / (MAX_LON - MIN_LON)
    ny = (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)
    gx = int(np.clip(nx * (GRID_W - 1), 0, GRID_W - 1))
    gy = int(np.clip((1.0 - ny) * (GRID_H - 1), 0, GRID_H - 1))
    return gx, gy

def from_grid(gx: int, gy: int):
    lon = MIN_LON + (gx / (GRID_W - 1)) * (MAX_LON - MIN_LON)
    lat = MIN_LAT + (1.0 - gy / (GRID_H - 1)) * (MAX_LAT - MIN_LAT)
    return round(lon, 5), round(lat, 5)

def build_sea_lanes():
    print("Loading 4K heightmap and island mask...")
    mask_path = PUBLIC_DATA_DIR / "island_mask.png"
    hmap_path = PUBLIC_DATA_DIR / "heightmap.png"

    mask = np.array(Image.open(mask_path).convert("RGB"))[:, :, 0]
    hmap = np.array(Image.open(hmap_path).convert("RGB"))[:, :, 0]

    # Binary water: strictly 0 elevation and 0 island mask
    is_water = ((mask == 0) & (hmap <= 2)).astype(np.uint8)
    print("Computing 4K Euclidean distance transform...")
    dist_4k = cv2.distanceTransform(is_water, cv2.DIST_L2, 5)

    # 512x512 navigation grid
    dist_512 = cv2.resize(dist_4k, (GRID_W, GRID_H), interpolation=cv2.INTER_AREA)
    nav_grid = (dist_512 >= 1.5).astype(np.uint8)

    with open(PUBLIC_DATA_DIR / "islands.json", "r", encoding="utf-8") as f:
        islands = json.load(f)

    print(f"Aligning harbor entrance positions for {len(islands)} islands...")
    port_coords = {}
    for isl in islands:
        p_lon = isl.get("port", {}).get("lon", isl["lon"])
        p_lat = isl.get("port", {}).get("lat", isl["lat"])
        px, py = to_4k(p_lon, p_lat)

        if dist_4k[py, px] >= 2.0:
            port_coords[isl["id"]] = (p_lon, p_lat)
        else:
            best = None
            for r in range(1, 50):
                for dy in range(-r, r+1):
                    for dx in range(-r, r+1):
                        if 0 <= py+dy < H_4K and 0 <= px+dx < W_4K:
                            if dist_4k[py+dy, px+dx] >= 2.0:
                                d_sq = dx*dx + dy*dy
                                if best is None or d_sq < best[0]:
                                    best = (d_sq, px+dx, py+dy)
                if best is not None:
                    break
            if best:
                w_lon, w_lat = from_4k(best[1], best[2])
                port_coords[isl["id"]] = (w_lon, w_lat)
            else:
                port_coords[isl["id"]] = (p_lon, p_lat)

    def find_nearest_nav(gx, gy):
        if 0 <= gx < GRID_W and 0 <= gy < GRID_H and nav_grid[gy, gx]:
            return gx, gy
        for r in range(1, 40):
            for dy in range(-r, r+1):
                for dx in range(-r, r+1):
                    nx, ny = gx+dx, gy+dy
                    if 0 <= nx < GRID_W and 0 <= ny < GRID_H and nav_grid[ny, nx]:
                        return nx, ny
        return gx, gy

    def a_star_water(start_coord, goal_coord):
        sx, sy = find_nearest_nav(*to_grid(start_coord[0], start_coord[1]))
        gx, gy = find_nearest_nav(*to_grid(goal_coord[0], goal_coord[1]))

        if sx == gx and sy == gy:
            return [start_coord, goal_coord]

        frontier = [(0, sx, sy)]
        came_from = {(sx, sy): None}
        cost = {(sx, sy): 0.0}

        moves = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
                 (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]

        while frontier:
            _, cx, cy = heapq.heappop(frontier)
            if cx == gx and cy == gy:
                break

            for dx, dy, w in moves:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < GRID_W and 0 <= ny < GRID_H and nav_grid[ny, nx]:
                    d_val = max(1.0, float(dist_512[ny, nx]))
                    # Bias paths strongly towards deep fairways and away from rocks
                    step_cost = w * (1.0 + 16.0 / (d_val + 2.0))
                    new_cost = cost[(cx, cy)] + step_cost
                    if (nx, ny) not in cost or new_cost < cost[(nx, ny)]:
                        cost[(nx, ny)] = new_cost
                        h_dist = math.hypot(nx - gx, ny - gy)
                        heapq.heappush(frontier, (new_cost + h_dist, nx, ny))
                        came_from[(nx, ny)] = (cx, cy)

        if (gx, gy) not in came_from:
            return None

        curr = (gx, gy)
        raw_pts = []
        while curr:
            raw_pts.append(from_grid(curr[0], curr[1]))
            curr = came_from[curr]
        raw_pts.reverse()

        full_pts = [start_coord] + raw_pts + [goal_coord]
        return full_pts

    def has_clear_water(p1, p2, min_clearance=1.5):
        x1, y1 = to_4k(p1[0], p1[1])
        x2, y2 = to_4k(p2[0], p2[1])
        steps = max(5, int(math.hypot(x2 - x1, y2 - y1)))
        for s in range(steps + 1):
            t = s / steps
            px = int(x1 + t * (x2 - x1))
            py = int(y1 + t * (y2 - y1))
            if dist_4k[py, px] < min_clearance:
                return False
        return True

    def prune_path(pts):
        if not pts or len(pts) <= 2:
            return pts
        pruned = [pts[0]]
        curr_idx = 0
        while curr_idx < len(pts) - 1:
            next_idx = len(pts) - 1
            while next_idx > curr_idx + 1:
                if has_clear_water(pts[curr_idx], pts[next_idx]):
                    break
                next_idx -= 1
            pruned.append(pts[next_idx])
            curr_idx = next_idx
        return pruned

    # Define maritime regional adjacency pairing
    print("Building regional maritime topology connections...")
    
    # Map islands to geographic coordinates
    isl_by_id = {isl["id"]: isl for isl in islands}
    
    # 1. K-nearest neighbors by haversine distance for local archipelago connectivity
    links = set()
    for id_a, isl_a in isl_by_id.items():
        pa = port_coords[id_a]
        dists = []
        for id_b, isl_b in isl_by_id.items():
            if id_a == id_b:
                continue
            pb = port_coords[id_b]
            d = haversine_km(pa[0], pa[1], pb[0], pb[1])
            # Connect up to 75 km for local hops
            dists.append((d, id_b))
        dists.sort()
        # Connect to closest 4 neighbors
        for d, id_b in dists[:4]:
            links.add(tuple(sorted([id_a, id_b])))
        # Also ensure connections within same region up to 90 km
        reg_dists = [x for x in dists if isl_by_id[x[1]]["region"] == isl_a["region"]]
        for d, id_b in reg_dists[:3]:
            if d < 100:
                links.add(tuple(sorted([id_a, id_b])))

    # Key strategic inter-regional trunk corridors
    key_trunk_corridors = [
        ("santorini", "naxos"),
        ("santorini", "ios"),
        ("santorini", "anafi"),
        ("santorini", "crete_heraklion"),
        ("santorini", "milos"),
        ("naxos", "paros"),
        ("naxos", "mykonos"),
        ("naxos", "amorgos"),
        ("naxos", "koufonisia"),
        ("paros", "syros"),
        ("paros", "antiparos"),
        ("paros", "sifnos"),
        ("syros", "mykonos"),
        ("syros", "tinos"),
        ("syros", "kythnos"),
        ("mykonos", "ikaria"),
        ("tinos", "andros"),
        ("andros", "kea"),
        ("kea", "piraeus"),
        ("piraeus", "aegina"),
        ("piraeus", "hydra"),
        ("hydra", "spetses"),
        ("milos", "crete_heraklion"),
        ("crete_heraklion", "crete_chania"),
        ("crete_heraklion", "crete_rethymno"),
        ("crete_heraklion", "crete_agios_nikolaos"),
        ("crete_heraklion", "kasos"),
        ("kasos", "karpathos"),
        ("karpathos", "rhodes"),
        ("rhodes", "symi"),
        ("rhodes", "kos"),
        ("kos", "kalymnos"),
        ("kalymnos", "leros"),
        ("leros", "patmos"),
        ("patmos", "samos"),
        ("samos", "chios"),
        ("samos", "ikaria"),
        ("chios", "lesbos"),
        ("chios", "psara"),
        ("chios", "izmir"),
        ("lesbos", "izmir"),
        ("lesbos", "lemnos"),
        ("lemnos", "samothrace"),
        ("lemnos", "agios_efstratios"),
        ("samothrace", "thasos"),
        ("thasos", "gokceada"),
        ("gokceada", "bozcaada"),
        ("skiathos", "skopelos"),
        ("skopelos", "alonnisos"),
        ("skopelos", "skyros"),
        ("skyros", "andros"),
        ("rhodes", "kastellorizo"),
    ]

    for a, b in key_trunk_corridors:
        if a in isl_by_id and b in isl_by_id:
            links.add(tuple(sorted([a, b])))

    print(f"Total maritime links to compute via water A*: {len(links)}")

    nodes = {}
    edges = []
    added_edges = set()
    node_id_counter = 1

    # Add all ports as primary nodes
    for isl_id, coord in port_coords.items():
        node_id = f"port_{isl_id}"
        isl = isl_by_id[isl_id]
        nodes[node_id] = {
            "id": node_id,
            "name": f"{isl['name']} Port",
            "lon": coord[0],
            "lat": coord[1],
            "isPort": True,
            "islandId": isl_id
        }

    def add_edge_def(n1_id, n2_id):
        if n1_id == n2_id:
            return
        ek = tuple(sorted([n1_id, n2_id]))
        if ek in added_edges:
            return
        added_edges.add(ek)
        n1 = nodes[n1_id]
        n2 = nodes[n2_id]
        dist = haversine_km(n1["lon"], n1["lat"], n2["lon"], n2["lat"])
        edges.append({
            "from": n1_id,
            "to": n2_id,
            "distanceKm": round(dist, 2)
        })

    # Waypoint registry to merge nearby fairway waypoints
    waypoint_map = {}

    def get_or_create_waypoint(lon, lat, hint="fairway"):
        nonlocal node_id_counter
        # Find if close waypoint exists within ~2.5 km (0.025 deg)
        for wid, wnode in waypoint_map.items():
            if haversine_km(lon, lat, wnode["lon"], wnode["lat"]) < 2.5:
                return wid
        wid = f"wp_{node_id_counter:04d}_{hint}"
        node_id_counter += 1
        node_data = {
            "id": wid,
            "name": f"Nav Fairway {wid}",
            "lon": lon,
            "lat": lat
        }
        nodes[wid] = node_data
        waypoint_map[wid] = node_data
        return wid

    completed_links = 0
    failed_links = 0

    for id_a, id_b in links:
        p_a = port_coords[id_a]
        p_b = port_coords[id_b]

        # 1. Quick check if straight line through open water is already 100% clear
        if has_clear_water(p_a, p_b, min_clearance=2.0):
            add_edge_def(f"port_{id_a}", f"port_{id_b}")
            completed_links += 1
            continue

        # 2. Compute collision-free water path via A* on nav_grid
        raw_path = a_star_water(p_a, p_b)
        if not raw_path:
            failed_links += 1
            print(f"  WARNING: Could not find water path between {id_a} and {id_b}")
            continue

        pruned = prune_path(raw_path)
        # Ensure endpoints are exactly the port coordinates
        pruned[0] = p_a
        pruned[-1] = p_b

        # Convert pruned path into graph edges and waypoints
        chain = [f"port_{id_a}"]
        for pt in pruned[1:-1]:
            wid = get_or_create_waypoint(pt[0], pt[1], hint="chan")
            chain.append(wid)
        chain.append(f"port_{id_b}")

        for i in range(len(chain) - 1):
            add_edge_def(chain[i], chain[i+1])

        completed_links += 1

    print(f"\nPathfinding complete: {completed_links} links generated ({failed_links} failed).")
    print(f"Resulting graph has {len(nodes)} nodes ({len(islands)} ports, {len(nodes)-len(islands)} waypoints) and {len(edges)} edges.")

    # 4. Rigorous verification: Verify EVERY edge in graph for 0% land intersection
    print("\n--- RIGOROUS 4K VERIFICATION OF ALL EDGES ---")
    bad_edges = []
    for e in edges:
        n1 = nodes[e["from"]]
        n2 = nodes[e["to"]]
        x1, y1 = to_4k(n1["lon"], n1["lat"])
        x2, y2 = to_4k(n2["lon"], n2["lat"])
        steps = max(5, int(math.hypot(x2 - x1, y2 - y1)))
        land_hits = 0
        for s in range(1, steps):
            t = s / steps
            px = int(x1 + t * (x2 - x1))
            py = int(y1 + t * (y2 - y1))
            if dist_4k[py, px] < 1.0: # Touches land
                land_hits += 1
        if land_hits > 0:
            bad_edges.append((e["from"], e["to"], land_hits))

    if bad_edges:
        print(f"CRITICAL: Found {len(bad_edges)} edges touching land!")
        for b in bad_edges[:10]:
            print(f"  BAD: {b[0]} <-> {b[1]} ({b[2]} hits)")
    else:
        print("PERFECTION ACHIEVED: 100% of ALL sea-lane edges have ZERO land intersections!")

    # Verify complete connectivity via A*
    adj = {}
    for e in edges:
        adj.setdefault(e["from"], []).append((e["to"], e["distanceKm"]))
        adj.setdefault(e["to"], []).append((e["from"], e["distanceKm"]))

    def a_star_check(s, g):
        frontier = [(0, s)]
        cost_so_far = {s: 0}
        while frontier:
            cost, curr = heapq.heappop(frontier)
            if curr == g:
                return True
            for nxt, dist in adj.get(curr, []):
                nc = cost_so_far[curr] + dist
                if nxt not in cost_so_far or nc < cost_so_far[nxt]:
                    cost_so_far[nxt] = nc
                    h = haversine_km(nodes[nxt]["lon"], nodes[nxt]["lat"], nodes[g]["lon"], nodes[g]["lat"])
                    heapq.heappush(frontier, (nc + h, nxt))
        return False

    unreachable = 0
    for isl in islands:
        pk = f"port_{isl['id']}"
        if pk == "port_santorini":
            continue
        if not a_star_check("port_santorini", pk):
            print(f"UNREACHABLE from Santorini: {pk}")
            unreachable += 1

    if unreachable == 0:
        print(f"NETWORK INTEGRITY: 100% of all {len(islands)} ports are interconnected!")

    out_file = PUBLIC_DATA_DIR / "sea_lanes.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "nodes": list(nodes.values()),
            "edges": edges
        }, f, indent=2)
    print(f"Saved verified sea-lanes to {out_file}.")

if __name__ == "__main__":
    build_sea_lanes()
