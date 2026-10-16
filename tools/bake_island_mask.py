import json
import numpy as np
from PIL import Image
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

    # Process in blocks or vectorized for land pixels
    land_ys, land_xs = np.where(is_land)
    print(f"Assigning {len(land_xs)} land pixels to {len(island_centers)} island territories...")

    scale_factor = WIDTH / 2048.0
    mainland_max_dist = (45.0 * scale_factor) ** 2
    island_max_dist = (140.0 * scale_factor) ** 2

    # Chunk processing to avoid memory spike
    chunk_size = 100000
    for i in range(0, len(land_xs), chunk_size):
        chunk_x = land_xs[i:i+chunk_size]
        chunk_y = land_ys[i:i+chunk_size]

        # Distances to all island centers: (chunk_size, N)
        # Apply aspect correction for longitude: cos(38 deg) ~ 0.788
        dx = (chunk_x[:, None] - coords[None, :, 0]) * 0.788
        dy = chunk_y[:, None] - coords[None, :, 1]
        dist_sq = dx * dx + dy * dy

        # For mainland ports, limit influence radius
        for idx, t in enumerate(types):
            if t == "mainland_port":
                dist_sq[:, idx] = np.where(dist_sq[:, idx] > mainland_max_dist, 1e9, dist_sq[:, idx])

        # Find closest island
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

    mask_img = Image.fromarray(mask, mode="L")
    mask_img.save(target_path, "PNG", optimize=True)
    print(f"Saved island mask texture -> {target_path} ({target_path.stat().st_size // 1024} KB)")

    # Print verification of assigned pixels
    for c in island_centers:
        count = np.sum(mask == c["maskId"])
        print(f"  Island '{c['id']}' (maskId {c['maskId']}): {count} pixels")

if __name__ == "__main__":
    bake_island_mask()
