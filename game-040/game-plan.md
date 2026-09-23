# STARCADET (game-040) — Build Plan

**Status:** Phase 12 complete — playable end to end, verified headlessly.
Design doc: [GDD.md](GDD.md).

## Phase 0 — Design
- [x] GDD written (story, pillars, mechanics, enemy roster, boss specs, level shapes, tech plan)
- [x] Architecture decided: pure `js/sim` (no three.js, no DOM) + thin `js/view` on top

## Phase 1 — Core scaffolding
- [x] `index.html` with three.js r165 import map, DOM HUD, overlays, back-to-launcher link
- [x] `core/config.js` — every tunable in one place, difficulty multipliers
- [x] `core/rng.js` — seeded mulberry32 + helpers (deterministic sim)
- [x] `core/events.js`, `core/state.js`, `core/input.js`, `core/save.js`

## Phase 2 — Simulation: player
- [x] Fixed-timestep world, playfield bounds, direct movement, focus mode
- [x] Hitbox (0.17 u) separate from ship size; invulnerability windows
- [x] Four weapons × five power levels; focus narrowing

## Phase 3 — Simulation: bullets & patterns
- [x] Bullet pool with circle collision, lifetime, off-screen culling
- [x] 12-pattern emitter library (aimed/fan/ring/spiral/whip/wall/rain/homing/laser/nova/flower/cluster)
- [x] Difficulty scaling hooks on speed, density, HP

## Phase 4 — Simulation: enemies
- [x] 14 enemy archetypes with distinct movement scripts and attack cycles
- [x] Shield facing (Shieldbearer), death-spawn (Popper), pod-dropping (Carrier), mines (Minelayer)

## Phase 5 — Rescue loop
- [x] Pods: drift, HP, enemy-destructible, tow-hook pickup radius, burn timers
- [x] Permanent headcount, per-level saved/lost tally, pod-loss feedback

## Phase 6 — Power-ups
- [x] Power items, weapon crystals, flare pickups, 1-ups, score gems, magnet behaviour

## Phase 7 — Bosses
- [x] Data-driven phases: HP thresholds, movement scripts, attack cycles with telegraphed windups
- [x] Destructible parts (Ironmaw turrets remove attacks from the cycle)
- [x] Six bosses incl. the Heart's story-gated final pattern

## Phase 8 — Levels & story
- [x] Six level timelines with midbosses, pod budgets totalling 211
- [x] Wing Abilities from the five named cadets, wired into the sim
- [x] Comms barks, briefings, four endings by headcount

## Phase 9 — View layer (three.js)
- [x] `scene.js` renderer/camera/bloom composer, resize handling
- [x] Procedural ship/boss meshes; instanced bullet renderer; parallax starfields
- [x] Six animated `ShaderMaterial` backdrops; explosions, shockwaves, screen shake, hit-stop
- [x] Canvas-texture sprite text for popups and banners

## Phase 10 — UI & audio
- [x] HUD, boss bars, Overdrive meter, comms portraits (procedurally drawn), briefing/level select
- [x] Pause, options, difficulty select, rebindable keys
- [x] Procedural Web Audio: weapons, impacts, rescues, boss windups, per-level drone beds

## Phase 11 — Input & mobile
- [x] Keyboard, mouse, and touch, with a pointer that yields to the keyboard on the first key press
- [x] **Relative** touch dragging with wall-overshoot absorption (not absolute — the ship never
      teleports to the thumb, and the hand never covers what it is dodging)
- [x] Two-thumb control layout: FOCUS/OD/FLARE bottom-left, pause top-right, drag anywhere
- [x] Auto-fire forced on touch devices (there is no fire button by design)
- [x] Every control ≥44px, including menu buttons and the launcher link
- [x] Adaptive quality tiers (pixel ratio, bloom strength, backdrop FBM octaves), auto-selected on
      touch devices, auto-downgraded on sustained low frame rate, overridable in Options → GRAPHICS
- [x] Responsive layout verified at 390×844 and 844×390, HUD width budgeted so the top row cannot
      overflow and push controls under each other
- [x] Menus scroll by finger (an overlay has to opt back into `touch-action`), and the primary
      action sticks to the bottom of a panel on short screens
- [x] Comms moved out of the play space on touch layouts; arena walls marked with rails and the
      out-of-play area dimmed, so the playable box is visible at any aspect ratio
- [x] Banner text auto-fits its sprite canvas instead of clipping; key rebinding times out so a
      keyboard-less device can never dead-end on "PRESS A KEY…"

## Phase 12 — Verification (all green)
- [x] `dev/check.mjs` — structure: `js/sim/` imports no three.js/DOM and never calls `Math.random`;
      every attack spec names a real pattern/special/bullet kind; every cue names real content;
      cadet budgets total the roll; every DOM id the code looks up exists in `index.html`
- [x] `dev/simtest.mjs` — **30 assertions** on the real sim (hitbox vs ship, graze, death-bomb,
      muzzle counts, the rescue economy, shield facing, boss phases, turret removal, lasers, flares,
      every Wing Ability, determinism, entity bounds, save round-trip)
- [x] `dev/rendertest.mjs` — **17 tests**: the real view layer against a hostile fake three.js,
      six levels plus three boss fights, pointer reach at five aspect ratios, every menu screen
- [x] `dev/boottest.mjs` — **14 tests**: main.js's own state machine, title → level clear
- [x] `dev/browsertest.mjs` — real Chromium + real WebGL + real three.js r165: title, intro,
      briefing, live play, a boss fight, flare, pause and a 390×844 phone viewport, with zero
      console errors, page errors or failed requests
- [x] `dev/mobiletest.mjs` — an emulated phone driven *only* by touch (via CDP, so the browser
      synthesises real clicks): menus, relative drag, no-teleport check, FLARE/OD/FOCUS/PAUSE,
      44px tap targets, and no control overlapping the HUD — portrait and landscape
- [x] `dev/perf.mjs` — simulation cost per frame at boss-level entity counts (~0.1ms p95)
- [x] `dev/balance.mjs` — three scripted bots play all six levels; boss HP set from measured DPS
- [x] `dev/playthrough.mjs` — full six-level campaign in Node, start to an ending

## Open / deferred
- [ ] **Hand-played pass by a human.** The game has been run and screenshotted in real Chromium
      with real three.js (`dev/browsertest.mjs`), and four visual problems found that way were
      fixed — but nobody has actually *played* it, so the feel of the dodging, the difficulty of
      individual patterns and the boss fight pacing are still bot-derived.
- [ ] Optional: replay recording — the sim is deterministic, so an input trace is all it would take
- [ ] Optional: a practice mode that starts at an arbitrary boss
