# Visual Design

## Look
Photoreal-ish satellite night. The whole Aegean starts in deep night: dark navy sea, land barely visible in moonlit blue-grey, a few faint scattered city lights. Think NASA Black Marble, but close up and tilted in 3D.

## Night -> Day Reveal (signature moment)
1. Island becomes `connecting`: a gentle pulse at its port and the first lights flicker on.
2. On the first successful delivery: a radial wave of light spreads from the port across the island, and the island's satellite texture fades from night to **full daylight** (vivid green/ochre land, whitewashed towns, turquoise shallows).
3. The surrounding sea near the island gets a lit tint, so lit regions merge into a daylight archipelago while unconnected areas remain dark.
4. A soft sound cue plays (chime plus light swell). The camera can optionally nudge toward the island.

Dark islands remain visible but muted. Lit state is persisted.

## Scene Elements
- **Terrain**: displaced heightmap, exaggerated relief, bathymetry shown as sea depth color.
- **Sea**: animated waves, moon specular, foam at the coast; deep midnight blue (#050b1a to #0a1f3d); the lit zone shifts to teal (#1fb5b0-ish).
- **City lights**: warm amber (#ffb347) emissive points/sprites sized by population, with bloom; a subtle twinkle.
- **Ships**: instanced low-poly-but-detailed models per tier; navigation lights (port red, starboard green, mast white); foam wake; gentle bob.
- **Atmosphere**: faint haze, light stars/moon glow at the horizon, subtle vignette, film grain very low.
- **Labels**: island names appear when zoomed in; only lit islands show full labels. Dark islands show a faint "?" marker with the unlock cost.
- **Flow overlay (toggle)**: glowing arcs showing goods flow per route, colored per good.

## UI Style
- Dark glassmorphism panels (backdrop blur, 1px translucent borders), accent gold (#f2c14e) and aegean teal (#2ec4b6).
- Fonts: **Outfit** (headings) and **Inter** (body).
- HUD: top bar (treasury, TP, date, speed controls), left island/route panel on selection, right event feed, bottom mini-map with lit/dark islands.
- Micro-animations on hover, counters ticking up, panel slide-ins.
- Island panel: produces/consumes bars, prices, stock, distress/prosperity, connect/unlock button.
- Tooltips, keyboard shortcuts (space = pause, 1/2/3 = speed, F = flow overlay).

## Camera
Orbit/pan/zoom with damping, tilted ~50° by default, min/max zoom limits, double-click an island to focus. Cinematic intro: slow fly-in to the starting pair.

## Audio
Ambient sea and wind (louder zoomed in), a soft evolving music bed, ship horns by tier, and an island-lights-on chime.
