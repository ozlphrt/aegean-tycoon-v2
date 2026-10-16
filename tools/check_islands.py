import json
from pathlib import Path

islands_file = Path("public/data/islands.json")
with open(islands_file, "r", encoding="utf-8") as f:
    islands = json.load(f)

print(f"Loaded {len(islands)} existing islands.")
for isl in islands:
    print(f"- {isl['id']}: {isl['name']}")
