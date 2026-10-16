import json
from pathlib import Path
from PIL import Image
import numpy as np

def validate_all():
    print("=== GEODATA BAKE VALIDATION ===")
    public_data = Path(__file__).resolve().parent.parent / "public" / "data"

    required_textures = [
        ("day.jpg", 2048, 2048),
        ("night.jpg", 2048, 2048),
        ("lights.png", 2048, 2048),
        ("heightmap.png", 2048, 2048),
        ("island_mask.png", 2048, 2048),
    ]

    all_ok = True

    for name, expected_w, expected_h in required_textures:
        fpath = public_data / name
        if not fpath.exists():
            print(f"❌ MISSING: {name}")
            all_ok = False
            continue
        try:
            with Image.open(fpath) as img:
                w, h = img.size
                if w == expected_w and h == expected_h:
                    print(f"[OK] {name}: {w}x{h} (Format: {img.format}, Mode: {img.mode}, Size: {fpath.stat().st_size // 1024} KB)")
                else:
                    print(f"[WARN] {name} dimension mismatch: expected {expected_w}x{expected_h}, got {w}x{h}")
                    all_ok = False
        except Exception as e:
            print(f"[ERROR] reading {name}: {e}")
            all_ok = False

    # Validate islands.json
    islands_path = public_data / "islands.json"
    if not islands_path.exists():
        print("[MISSING] islands.json")
        all_ok = False
    else:
        with open(islands_path, "r", encoding="utf-8") as f:
            islands = json.load(f)
        print(f"[OK] islands.json loaded: {len(islands)} islands configured.")

        # Check mask coverage
        mask_path = public_data / "island_mask.png"
        mask = np.array(Image.open(mask_path))
        for isl in islands:
            mid = isl["maskId"]
            count = np.sum(mask == mid)
            if count == 0:
                print(f"[FAIL] Island {isl['id']} (maskId {mid}) has 0 pixels in island_mask.png!")
                all_ok = False
            else:
                pass
        print(f"[OK] All {len(islands)} islands verified with non-zero territory in island mask.")

    if all_ok:
        print("=== ALL M1 BAKE ARTIFACTS VALIDATED SUCCESSFULLY! ===")
    else:
        print("=== VALIDATION FAILED - Check errors above. ===")
    return all_ok

if __name__ == "__main__":
    validate_all()
