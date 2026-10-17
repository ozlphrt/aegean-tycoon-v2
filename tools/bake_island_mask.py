import json
import numpy as np
from PIL import Image
import cv2
from config import MIN_LON, MAX_LON, MIN_LAT, MAX_LAT, WIDTH, HEIGHT, PUBLIC_DATA_DIR, lonlat_to_pixel

def bake_island_mask():
    islands_file = PUBLIC_DATA_DIR / "islands.json"
    heightmap_file = PUBLIC_DATA_DIR / "heightmap.png"
    target_path = PUBLIC_DATA_DIR / "island_mask.png"
    print("--- Baking Island ID Mask ---")

    with open(islands_file, "r", encoding="utf-8") as f:
        islands = json.load(f)

    # Load heightmap to distinguish land from water (Channel B = 255 on land, Channel R = elevation > 0)
    if heightmap_file.exists():
        hm = np.array(Image.open(heightmap_file))
        if hm.ndim == 3:
            is_land = (hm[:, :, 2] > 128) | (hm[:, :, 0] > 0)
        else:
            is_land = hm > 50
    else:
        is_land = np.ones((HEIGHT, WIDTH), dtype=bool)

    mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)

    # Calculate pixel centers for each island
    island_centers = []
    for isl in islands:
        px, py = lonlat_to_pixel(isl["lon"], isl["lat"], WIDTH, HEIGHT)
        mask_id = isl["maskId"]
        isl_type = isl.get("type", "island")
        island_centers.append({
            "id": isl["id"],
            "maskId": mask_id,
            "px": px,
            "py": py,
            "type": isl_type
        })

    # For islands, we assign connected land components or Voronoi proximity on land
    coords = np.array([[c["px"], c["py"]] for c in island_centers], dtype=np.float32)
    mask_ids = np.array([c["maskId"] for c in island_centers], dtype=np.uint8)
    types = [c["type"] for c in island_centers]

    # Connected component labeling ensures separate islands (e.g. Naxos vs Paros) are never merged
    num_labels, labels_im = cv2.connectedComponents(is_land.astype(np.uint8))

    scale_factor = WIDTH / 2048.0
    mainland_max_dist = (45.0 * scale_factor) ** 2
    island_max_dist = (140.0 * scale_factor) ** 2

    # Map each island center to its connected land component
    comp_to_islands = {}
    for c in island_centers:
        px = max(0, min(WIDTH - 1, c["px"]))
        py = max(0, min(HEIGHT - 1, c["py"]))
        if is_land[py, px] == 0:
            win = is_land[max(0, py-12):min(HEIGHT, py+13), max(0, px-12):min(WIDTH, px+13)]
            wys, wxs = np.where(win)
            if len(wys) > 0:
                d = (wys - 12)**2 + (wxs - 12)**2
                best = np.argmin(d)
                py = max(0, py-12) + wys[best]
                px = max(0, px-12) + wxs[best]
        comp = labels_im[py, px]
        c["comp"] = comp
        c["px_land"] = px
        c["py_land"] = py
        if comp > 0:
            comp_to_islands.setdefault(comp, []).append(c)

    # 1. Assign isolated island components directly
    for comp, isls in comp_to_islands.items():
        if len(isls) == 1:
            c = isls[0]
            if c["type"] != "mainland_port":
                mask[labels_im == comp] = c["maskId"]

    # 2. For multi-island components (e.g. mainland, Mykonos/Delos) and unassigned islets, assign by proximity
    unassigned_ys, unassigned_xs = np.where((is_land > 0) & (mask == 0))
    print(f"Assigning remaining {len(unassigned_xs)} land pixels via constrained Voronoi...")

    chunk_size = 100000
    for i in range(0, len(unassigned_xs), chunk_size):
        chunk_x = unassigned_xs[i:i+chunk_size]
        chunk_y = unassigned_ys[i:i+chunk_size]

        dx = (chunk_x[:, None] - coords[None, :, 0]) * 0.788
        dy = chunk_y[:, None] - coords[None, :, 1]
        dist_sq = dx * dx + dy * dy

        for idx, t in enumerate(types):
            if t == "mainland_port":
                dist_sq[:, idx] = np.where(dist_sq[:, idx] > mainland_max_dist, 1e9, dist_sq[:, idx])

        closest_idx = np.argmin(dist_sq, axis=1)
        min_dists = dist_sq[np.arange(len(chunk_x)), closest_idx]

        assigned_mask_ids = mask_ids[closest_idx]
        assigned_mask_ids[min_dists > island_max_dist] = 0

        mask[chunk_y, chunk_x] = assigned_mask_ids

    # Ensure at least the central port pixel for every island is marked
    for c in island_centers:
        cx, cy = c["px"], c["py"]
        r = int(6 * scale_factor)
        y1, y2 = max(0, cy - r), min(HEIGHT, cy + r + 1)
        x1, x2 = max(0, cx - r), min(WIDTH, cx + r + 1)
        mask[y1:y2, x1:x2] = c["maskId"]

    # --- Compute Smooth Distance Field & Nearest Island Propagation ---
    print("Computing Euclidean distance transform into sea...")
    sea = (mask == 0).astype(np.uint8) * 255
    dist, labels = cv2.distanceTransformWithLabels(sea, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_CCOMP)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask_dil = cv2.dilate(mask, kernel)

    lut = np.zeros(labels.max() + 1, dtype=np.uint8)
    touching = (sea > 0) & (mask_dil > 0)
    for l, m in zip(labels[touching], mask_dil[touching]):
        if lut[l] == 0:
            lut[l] = m

    nearest_id = lut[labels]
    nearest_id[mask > 0] = mask[mask > 0]

    # Normalized distance from coast into sea (0..255 over ~14 km)
    sea_dist_norm = np.clip(dist / 90.0, 0.0, 1.0) * 255.0

    # Interior distance on land
    land_dist = cv2.distanceTransform((mask > 0).astype(np.uint8) * 255, cv2.DIST_L2, 5)
    land_dist_norm = np.clip(land_dist / 40.0, 0.0, 1.0) * 255.0

    # Channel R = land territory maskId, Channel G = nearest island ID, Channel B = sea distance to coast, Channel A = interior distance
    rgba = np.stack([mask, nearest_id, sea_dist_norm.astype(np.uint8), land_dist_norm.astype(np.uint8)], axis=2)
    mask_img = Image.fromarray(rgba, mode="RGBA")
    mask_img.save(target_path, "PNG")
    print(f"Saved 4-channel island mask texture -> {target_path} ({target_path.stat().st_size // 1024} KB)")

    # Print verification of assigned pixels
    for c in island_centers:
        count = np.sum(mask == c["maskId"])
        print(f"  Island '{c['id']}' (maskId {c['maskId']}): {count} pixels")

if __name__ == "__main__":
    bake_island_mask()
