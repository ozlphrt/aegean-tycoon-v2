# Project Brief

## Vision
Watch, and gently steer, the Aegean awaken. The player sees a dark satellite night view of the real Aegean. Two small islands begin to trade. Each connected island lights up with city lights and then transitions into full **daylight**, so the lit and sunlit area becomes a visual measure of the trade network. By the end, the sea is busy with ferries, cargo ships and charter boats.

## Player Role (Hybrid)
Mostly a living simulation, with light guidance:
- Unlock/connect new islands (spend "Trade Points" / coin).
- Establish and adjust routes.
- Buy and upgrade vessels.
- Watch stats, prices and island needs.
Autonomy rises over time: once routes exist, ships and merchants keep operating on their own.

## Story Arc (compressed, modern-day setting)
1. **Spark** – two islands (default Santorini and Naxos), fishing boats, 2–3 goods.
2. **Neighbors** – nearby islands join, caiques/sailboats appear.
3. **Archipelago** – clusters (Cyclades, Dodecanese, North Aegean, Sporades) link up. Ferries appear.
4. **Mainland** – Piraeus, Thessaloniki, Kavala, Volos and Turkish ports (Izmir, Bodrum, Ayvalik, Cesme, Marmaris) join. Cargo ships appear.
5. **Ecosystem** – tourism, charters, yachts, seasonal flows. The whole map is in daylight.

## Core Loop
Island produces surplus -> price falls at source, rises where it is scarce -> ships carry goods -> island needs are met, wealth grows -> more goods/tier unlocks -> new islands/ships become affordable.

## Scope
- 50+ islands plus ~10 mainland ports (Greece and Turkey), real coordinates.
- ~12 goods; per-island production and consumption; supply/demand pricing.
- 5 ship tiers: fishing boat, caique/sailboat, ferry, cargo ship, charter/yacht.
- Night-to-day per-island reveal; city lights; ship lights and wakes.
- Save/load in localStorage; ambient audio.

## Non-Goals (v1)
Multiplayer, mobile-first controls, real historical eras, combat, weather simulation beyond cosmetic wind/waves, user accounts.

## Success Criteria
- First 60 seconds: a stunning night view and the first boat trade visibly succeeding.
- Island "lights on" moment feels rewarding (animation + sound).
- Smooth at 60 FPS on a mid-range laptop with 100+ ships.
- Economy self-balances: no island starves permanently once connected.
