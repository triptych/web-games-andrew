# TRACKRUNNER — Game Plan

## Current State (Phase 0 — Complete)
- Three-lane endless runner with Three.js 3D rendering
- Neon/cyberpunk aesthetic (teal + blue palette)
- Obstacles spawn in 1–2 lanes; speed accelerates over time
- Crash particles, screen flash, game-over overlay
- Keyboard (←→ / A D) and touch/swipe input
- HUD: distance score, speed bar, best score, lane indicator
- Scanline + vignette post-processing overlays

---

## Phase 1 — Juice & Feel
**Goal:** Make the core loop feel great before adding complexity.

- [ ] **Screen shake on crash** — brief camera shake instead of just a flash
- [ ] **Lane-switch sound** — subtle whoosh SFX (Web Audio API)
- [ ] **Crash sound** — explosion SFX
- [ ] **Speed-up audio cue** — rising tone as speed increases
- [ ] **Thruster trail** — additive particle ribbon behind the ship using `THREE.Points`
- [ ] **Obstacle hit flash** — obstacles briefly brighten on near-miss
- [ ] **Speed lines** — radial streaks that intensify at high speed (canvas overlay or geometry)
- [ ] **Player hover bob** — subtle sinusoidal y-offset for the ship
- [ ] **Score milestone pop** — HUD "distance" number scales up momentarily at round numbers (500, 1000…)

---

## Phase 2 — Obstacle Variety
**Goal:** More interesting dodge patterns and visual diversity.

- [ ] **Moving obstacles** — lateral drift left/right before arriving
- [ ] **Low barrier** — player must stay in lane but obstacle only blocks bottom half (future: jump mechanic hook)
- [ ] **Wide sweep** — obstacle travels across all 3 lanes but leaves a gap that shifts
- [ ] **Projectile** — fast-moving hazard fired from off-screen
- [ ] **Obstacle telegraphing** — warning chevron or floor highlight that appears ~1s before obstacle arrives
- [ ] **Obstacle shadows** — shadow on floor shows where obstacle will land
- [ ] **Color-coded difficulty** — teal = easy, orange = medium, red = hard; harder obstacles have tighter hit windows

---

## Phase 3 — Progression & Scoring
**Goal:** Give the player something to chase beyond raw distance.

- [ ] **Multiplier chain** — collect pickups to increase score multiplier; crash resets it
- [ ] **Pickup coins/gems** — collectible objects spawned between obstacles
- [ ] **Combo display** — floating "+x" text when collecting pickups in sequence
- [ ] **Difficulty tiers** — explicit "zones" every N meters with distinct visual theming (e.g., ice, lava, void)
- [ ] **Daily best / leaderboard** — `localStorage` high-score table with top 5 runs
- [ ] **Run summary** — game-over screen shows max speed, pickups collected, near-misses, time alive

---

## Phase 4 — Visual Polish
**Goal:** Make the environment feel alive and cinematic.

- [ ] **Track theming** — swap floor/wall color palette per difficulty zone
- [ ] **Dynamic fog density** — denser fog at higher speeds for tunnel-vision effect
- [ ] **Animated wall panels** — scrolling texture or pulsing emissive on side walls
- [ ] **Background cityscape** — low-poly buildings on the horizon (billboards or LOD meshes)
- [ ] **Track curve** — slight left/right banking on the camera to hint at curvature
- [ ] **Bloom post-processing** — `THREE.UnrealBloomPass` via EffectComposer for neon glow
- [ ] **Lens flare** — subtle flare from the thruster light
- [ ] **Reflective floor** — `MeshPhysicalMaterial` with low roughness/high metalness for wet-track look

---

## Phase 5 — Game Modes & Meta
**Goal:** Replayability and session variety.

- [ ] **Endless (current)** — keep as default
- [ ] **Sprint mode** — fixed distance target; race the clock
- [ ] **Gauntlet mode** — obstacle density ramps much faster; no speed acceleration
- [ ] **Ship skins** — 3–4 visual variants unlocked by distance milestones (stored in `localStorage`)
- [ ] **Pause menu** — Esc to pause, resume/restart/quit
- [ ] **Settings panel** — toggle sound, reduce motion (disable shake/particles)

---

## Technical Debt / Architecture Notes
- Consider splitting into `js/` modules: `game.js`, `track.js`, `obstacles.js`, `player.js`, `hud.js`, `input.js`
- Abstract obstacle spawn into a data-driven config (type, speed-scale, lane-pattern, telegraph)
- Add `THREE.EffectComposer` + `UnrealBloomPass` early — retrofitting bloom later is painful
- Replace `setTimeout` in `triggerCrash` with the animation loop's own timer for frame-accurate delay
- Obstacle `w/d` hitbox could be tighter (currently `+0.4` padding is generous — reduce to `+0.2` for fairer play)
- Dispose geometry/material on obstacle removal to avoid GPU memory leaks on long runs

---

## Stretch Ideas
- Multiplayer ghost — record run as JSON keyframe log, replay as a ghost ship
- Procedural music — BPM synced to speed using Web Audio OscillatorNode
- Turbo boost — limited-use dash that makes player briefly invincible and pushes obstacles aside
- Weather effects — rain streaks, lightning flash synced to near-misses
