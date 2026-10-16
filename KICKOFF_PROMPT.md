# Kickoff Prompt

Copy everything inside the block below into a new coding session.

```
You are building "Aegean Tycoon v2", a 3D browser simulation of Aegean maritime trade, in the current workspace.

FIRST, read these files fully and follow them as the source of truth:
- README.md, AGENTS.md
- docs/PROJECT_BRIEF.md, docs/DECISIONS.md
- docs/TECH_ARCHITECTURE.md, docs/DATA_AND_ECONOMY.md
- docs/VISUAL_DESIGN.md, docs/ASSETS_AND_DATA_SOURCES.md
- docs/ROADMAP.md, docs/IMPLEMENTATION_GUIDE.md, PROGRESS.md

Stack (locked): Vite + TypeScript (strict) + Three.js + Vanilla CSS UI, Vitest. The sim in src/sim must not import rendering code. Real geodata is baked offline into textures and JSON (see ASSETS doc).

Your task now: complete milestones M0 and M1, then stop and report.
- M0: scaffold the project (run `npx -y create-vite@latest --help` first, then initialize in ./ non-interactively), set up the folder layout, ESLint/Prettier/Vitest, a blank Three.js canvas, and a premium dark glassmorphism HUD shell (Outfit/Inter fonts).
- M1: build the /tools geodata bake pipeline. Produce the day, night, lights, heightmap and island-ID-mask textures for the Aegean bounding box, plus islands.json for the first 15 islands (Santorini and Naxos included) and a flat-plane preview that proves the geography is correct. Confirm imagery licenses and tell me what you choose.

Rules: no placeholder art, update PROGRESS.md and CREDITS.md as you go, verify acceptance criteria from ROADMAP.md, and ask me before changing any locked decision. When done, summarize results and propose the plan for M2.
```
