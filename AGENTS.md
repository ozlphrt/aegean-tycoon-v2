# AGENTS.md — Working Rules

1. At the start of every session, read `README.md`, `docs/DECISIONS.md`, `PROGRESS.md`, and the roadmap milestone you are working on.
2. Work **one milestone at a time** from `docs/ROADMAP.md`. Do not start the next until acceptance criteria pass.
3. Do not change locked decisions in `docs/DECISIONS.md` without asking the user. Log new decisions there with date and reason.
4. After each session, update `PROGRESS.md` (done, in progress, blockers, next step).
5. Stack: Vite + TypeScript + Three.js, Vanilla CSS for UI. No TailwindCSS. No React unless the user approves.
6. Simulation logic must be separate from rendering (`src/sim` never imports from `src/render`). Sim runs headless and is unit-tested.
7. All game content (islands, goods, ship types) lives in JSON under `src/data` or `public/data`, never hard-coded in logic.
8. No placeholder art. Generate or bake real assets. Respect licenses in `docs/ASSETS_AND_DATA_SOURCES.md`.
9. Performance budget: 60 FPS desktop target, 100+ ships on screen, 50+ islands. See `docs/TECH_ARCHITECTURE.md`.
10. Preserve existing comments and docs not related to your change.
11. Keep UI premium: dark, glassmorphism, smooth animation, Google Font (Outfit/Inter). Unique IDs on interactive elements.
