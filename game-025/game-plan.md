# Crypt Crawler

**Genre:** Top-down dungeon crawler / arcade (Gauntlet-like)
**Engine:** three.js r165 (ES6 modules, loaded via CDN import map)
**Target Resolution:** Full-window (responsive); HUD via DOM overlay
**Status:** Complete — Phases 1–5 done (full game loop + polish: bloom, popups, minimap, high scores)

---

## Concept

A top-down Gauntlet-style dungeon crawler. Pick one of four classes, navigate
retro 3D mazes, and blast endless monsters streaming out of nests. Grab food to
stay alive, snatch treasure for score, and hunt down keys to open doors that
gate the path to the level exit. Descend through progressively nastier levels
until you escape the crypt — or die trying.

The tone is grim arcade: chunky blocky geometry, neon-on-dark palette, torchlit
fog, and crunchy 8-bit sound effects. Death is constant, the screen is busy, and
"shoot the food, you fool" energy is encouraged.

---

## Core Mechanics

### 1. Class selection
Four classes (Warrior, Valkyrie, Wizard, Elf), each with distinct speed, attack
power, health, and attack range (melee vs ranged). Chosen on the splash screen
by pressing 1–4. Defined in `config.js → CLASSES`.

### 2. Maze navigation
Each level is a grid maze of walls and floors (`TILE_SIZE` world units per cell).
The player moves in 8 directions with collision against walls. The camera is an
overhead, slightly-tilted follow-cam with a torch point-light tracking the player.

### 3. Monster nests (spawners)
Nests periodically emit enemies (up to `NEST_MAX_ALIVE` alive per nest). Destroying
a nest stops its spawns and awards bonus score — the primary way to thin the horde.

### 4. Combat
Melee classes deal damage in a short arc; ranged classes fire projectiles
(`SHOT_SPEED`, `SHOT_LIFETIME`). Attack on Space / click, gated by `ATTACK_COOLDOWN`.
Enemies deal contact damage to the player.

### 5. Pickups
- **Food** — restores health.
- **Treasure** — pure score.
- **Key** — opens one door.
- **Potion** — reserved for a future screen-clear / power-up.

### 6. Doors & level exit
Locked doors consume a key to open (`playDoor` SFX). The level exit becomes
reachable once the gating doors are open; stepping on it descends to the next
level. Clearing the final level triggers `gameWon`.

---

## Game Loop

Choose class → spawn into the maze → fight through monsters and nests while
collecting food (survival) and treasure (score) → find keys → open doors →
reach the exit → descend to a harder level. Repeat until the final level is
cleared (victory) or health hits zero (game over).

---

## Player Controls

| Action        | Key(s)              |
|---------------|---------------------|
| Choose class  | 1 / 2 / 3 / 4 (splash) |
| Move          | WASD / Arrow keys   |
| Attack        | Space / Left Click  |
| Pause         | P                   |
| Restart       | R                   |

---

## Progression / Difficulty

Each level increases: number of nests, enemy spawn rate, enemy mix (more demons
and ghosts later), and maze size/complexity. Health does **not** auto-refill
between levels — food management is the core survival pressure. A fixed number
of levels (e.g. 5) leads to the exit / victory.

---

## UI / HUD

DOM overlay (`index.html` + `ui.js`), updated via EventBus:
- **Score**, **Level**, **Class**, **Keys**, **Health** across the top bar.
- Centered message panel for splash/class-select, pause, level transitions,
  game over, and victory.

---

## Sound Design

Web Audio API, fully procedural — no file assets. Chunky square/sawtooth +
noise for an 8-bit arcade feel.

| Sound            | Trigger                  | Style                          |
|------------------|--------------------------|--------------------------------|
| UI Click         | Menu / pause             | Short square blip              |
| Class Select     | Choosing a class         | Square arpeggio                |
| Attack / Shot    | Player attacks           | Downward square / sawtooth sweep |
| Hit              | Enemy takes damage       | Square thud + noise            |
| Enemy Death      | Enemy killed             | Low square pop + noise         |
| Nest Destroy     | Nest destroyed           | Big sawtooth boom              |
| Pickup           | Food / treasure          | Two-tone square chime          |
| Key              | Key pickup               | Sparkly triangle two-tone      |
| Door             | Door opens               | Heavy sawtooth slide + noise   |
| Player Hurt      | Player takes damage      | Sawtooth down-sweep            |
| Level Complete   | Descend a level          | Rising square fanfare          |
| Game Over        | Health hits 0            | Long sawtooth drop + noise     |
| Victory          | Final level cleared      | Triumphant square melody       |

---

## Phases

### Phase 1 — Foundation
- [x] Scaffold: index.html, config, events, state, sounds, scene, ui, main
- [x] Class-select splash + HUD wired to state
- [x] Retro SFX library
- [x] First playable: maze + player movement

### Phase 2 — Maze & Player (complete)
- [x] `maze.js` — grid maze layout, wall meshes, floor, level loader, circle-vs-wall collision, cell-lookup helpers
- [x] `player.js` — class-driven movement, axis-separated wall collision (slides along walls), spawn placement
- [x] Camera follow + torch light tracking the player + fog tuned for enclosed torchlit corridors

### Phase 3 — Enemies, Nests & Combat (complete)
- [x] `enemies.js` — enemy types, chase AI (axis-separated wall slide), contact damage
- [x] `nests.js` — spawners with per-nest caps, destroyable, bonus score, level-scaled rate + mix
- [x] `combat.js` — melee cone + projectiles, cooldown, damage resolution vs enemies & nests

### Phase 4 — Pickups, Doors & Levels (complete)
- [x] `pickups.js` — food/treasure/key spawns (proximity collection, idle bob/spin)
- [x] Doors (key-gated, auto-open near a held key, slide-down anim) + level exit + descend logic
- [x] Multi-level progression (3 levels) + difficulty scaling + victory

### Phase 5 — Polish (complete)
- [x] Floating damage/score popups (`effects.js` canvas-texture sprites) + enemy/
      nest death bursts (additive shard spray)
- [x] Hit flashes — enemies flash white when struck; player avatar glows red +
      a red screen vignette pulses on taking damage (`playerHurt` event)
- [x] Bloom (`EffectComposer` + `UnrealBloomPass`, threshold 0.82) + dimmer,
      cooler lighting so torchlight/emissive carry the mood
- [x] Minimap (`minimap.js` corner DOM canvas) + high-score persistence
      (`highscore.js` localStorage; shown on splash + end screens)

---

## Event Catalog

| Event           | Payload        | Emitted by | Consumed by |
|-----------------|----------------|------------|-------------|
| `scoreChanged`  | newScore       | state      | ui          |
| `healthChanged` | newHealth      | state      | ui          |
| `keysChanged`   | newKeyCount    | state      | ui          |
| `levelChanged`  | newLevel       | state      | ui          |
| `classChosen`   | classKey       | state      | ui          |
| `pickup`        | type, value    | pickups    | state, sfx  |
| `playerHurt`    | amount         | state      | ui, player  |
| `doorOpened`    | doorId         | doors      | sfx         |
| `nestDestroyed` | nestId         | nests      | state, sfx  |
| `gameOver`      | —              | state      | ui, main    |
| `gameWon`       | —              | state      | ui, main    |

---

## Module Overview

| File         | Responsibility |
|--------------|----------------|
| `main.js`    | Game state machine, animate() loop, input, module orchestration |
| `scene.js`   | Renderer, scene, camera, clock, fog, lights, bloom composer — exports live bindings |
| `config.js`  | Constants: classes, enemies, nests, pickups, colors, combat tuning |
| `events.js`  | EventBus singleton |
| `state.js`   | GameState singleton (score/health/keys/level/class) |
| `sounds.js`  | Web Audio API retro sound effects |
| `ui.js`      | DOM HUD bindings + centered message overlay |
| `maze.js`    | *(Phase 2)* maze layout, walls, floor, level loader |
| `player.js`  | *(Phase 2)* player movement, collision, camera follow |
| `enemies.js` | *(Phase 3)* enemy types + AI |
| `nests.js`   | *(Phase 3)* spawners |
| `combat.js`  | *(Phase 3)* attacks, projectiles, damage |
| `pickups.js` | *(Phase 4)* food/treasure/keys + doors |
| `effects.js`   | *(Phase 5)* floating popups + death bursts |
| `minimap.js`   | *(Phase 5)* corner DOM-canvas overview map |
| `highscore.js` | *(Phase 5)* localStorage best-score persistence |

---

## Open Questions

- [x] Maze generation: **hand-authored** layouts (generated via a width-asserting,
      flood-fill-verified script so every level is rectangular and the exit is
      provably gated behind its doors).
- [x] How many levels total before victory? **3** (`maze.LEVELS.length`, exported
      as `FINAL_LEVEL`). Each adds a nest, a key/door, and grid size.
- [ ] Should treasure/keys also be destructible by stray shots (Gauntlet-style)?
- [ ] Multiplayer / co-op, or single-player only?
- [x] Movement: **continuous 8-direction** (Phase 2).

---

## Changelog

### Phase 1 — Scaffold (2026-06-07)
- Initial scaffold: index.html, config, events, state, sounds, scene, ui, main
- Class-select splash (1–4), 5-cell HUD, retro SFX library, follow-torch light stub

### Phase 2 — Maze & Player (2026-06-07)
- `maze.js`: hand-authored 20×19 starter level, wall/floor mesh builder (shared
  geometry/material, dispose-safe level swapping), circle-vs-wall collision,
  cell-lookup helpers (`findCell`/`findCells`/`getSpawn`) for later entity placement
- `player.js`: class-driven 8-direction movement, axis-separated collision (slide
  along walls), facing vector for future aiming, spawn-at-'S'
- main.js: `loadLevel()` + `initPlayer()` on class select; per-frame `updatePlayer()`,
  camera + torch follow; player input detaches on game over
- scene.js: fog tuned to 28→62 for enclosed torchlit corridors

### Phase 3 — Enemies, Nests & Combat (2026-06-09)
- `enemies.js`: shared box geometry + per-type material cache; chase AI reuses the
  player's axis-separated `collidesCircle` slide so enemies don't tunnel; per-enemy
  contact-damage cooldown; `spawnEnemy`/`damageEnemy`/`getEnemies` API for nests & combat;
  death awards score + plays SFX (mesh removed, shared geo/mat never disposed)
- `nests.js`: one spawner per 'N' cell; per-nest material clone (hit-flash mutates
  emissive independently — shared mat would flash all), disposed on destroy/teardown;
  spawn interval + enemy mix scale with `state.level`; per-nest `NEST_MAX_ALIVE` cap
  tracked via `mesh.parent` pruning; destroy awards `NEST_SCORE`, emits `nestDestroyed`
- `combat.js`: class `range` selects melee cone (instant arc damage, `MELEE_ARC`
  half-angle) vs ranged projectile (`SHOT_SPEED`/`SHOT_LIFETIME`, consumed on
  enemy/nest/wall); `ATTACK_COOLDOWN`-gated on Space / left-click; own input listeners
  detached on game over alongside player input
- main.js: Phase 3 modules init on class select, update order nests→enemies→combat;
  combat input detaches on `gameOver`/`gameWon`

### Phase 4 — Pickups, Doors & Levels (2026-06-11)
- `pickups.js`: scans the maze for `F`/`T`/`K`/`D`/`X` and builds floor items,
  doors and the exit. Items use one shared geometry per shape + one shared
  material per type (THREE.JS GOTCHA #4); they idle-bob/spin and are collected by
  proximity (`PICKUP_DIST`). Keys add to `state.keys`; food heals; treasure scores.
  Doors register as closed collision in `maze.js` and auto-open when the player
  nears one holding a key (spends the key, clears collision, slides the mesh down).
  The exit fires a one-shot `levelExit` event when stepped on.
- `maze.js`: doors participate in collision via a `_closedDoors` Set —
  `isWall()` treats a closed door cell as solid; `closeDoorCell`/`openDoorCell`
  toggle it (cleared on each `loadLevel`). Added two more hand-authored levels
  (22- and 24-wide) plus `FINAL_LEVEL`; every level was generated through a
  width-asserting + flood-fill script that guarantees rectangular grids, an
  exit sealed in a door-gated chamber, and no key locked behind the door it opens.
- `state.js`: added `isGameWon` flag (mirrors `isGameOver`).
- main.js: `loadCurrentLevel()` rebuilds player/enemies/nests/combat/pickups for
  the current `state.level`; `onLevelExit()` plays the fanfare, bumps the level
  with a 1.4s transition banner, and descends — or fires `gameWon` after
  `FINAL_LEVEL`. Health does NOT refill between levels. `updatePickups(dt)` added
  to the loop; victory/game-over SFX now play from the event handlers.

### Phase 5 — Polish (2026-06-11)
- Hit flashes: enemies swap to a shared white material for ~0.12s when struck
  (can't tint the shared per-type material), restored in `updateEnemies`; the
  player avatar glows red via `emissive` and a red DOM vignette pulses on the new
  `playerHurt` event (emitted from `state.damage`, only on actual damage).
- `effects.js`: floating popups (canvas-texture `THREE.Sprite`s, cached by
  text|color, per-sprite material clone for independent opacity fade) + death
  bursts (shared box geo + per-color additive material, shards shrink rather than
  fade since the material is shared). Wired into enemy hit/death, nest death, and
  pickups. Updates every frame outside `splash` so bursts settle during the
  transition/end screens; frozen while paused.
- `scene.js`: real bloom via `EffectComposer` + `RenderPass` + `UnrealBloomPass`
  (strength 0.7, radius 0.5, threshold 0.82 so only bright emissive bits glow);
  exported `composer`, `composer.setSize` added to the resize handler; ambient
  dimmed (`0x303048`) and directional cooled (`0xaab4ff`) so torchlight carries
  the mood. main.js renders via `composer.render()`.
- `minimap.js`: corner DOM `<canvas>` redrawn each frame — maze cells, exit
  (green), open/closed doors, nests (red squares), enemies (dots), player
  (bright dot); cell size auto-fits the level. Reads grid via new
  `maze.getGrid`/`getGridDims`/`isDoorClosed` getters.
- `highscore.js`: localStorage best-score persistence (try/catch so blocked
  storage degrades gracefully). `ui.js` submits the score on game-over/victory,
  shows "★ NEW HIGH SCORE! ★" or the best, and shows the best on the splash.

### Character & maze pass (2026-06-11)
- `player.js`: avatar rebuilt as a `THREE.Group` (body + face + swing arm) so it
  reads which way you face — white eyes + pupils + a dark brow on the +Z side
  (the direction `rotation.y = atan2(dx,dz)` points), bright so they catch bloom.
  Added an attack swing: `triggerAttackAnim()` (called by combat.js for melee AND
  ranged) sweeps the arm forward/back over 0.25s via `sin(pi*k)`. All movement /
  flash code now drives `_group`/`_body` instead of the old single mesh.
- `enemies.js`: contact hits now trigger a 0.3s squash-stretch "bite" lunge
  (`mesh.scale` only, so collision/chase are unaffected) — clear tell that an
  enemy just damaged you.
- `maze.js`: replaced the open pillar-grid levels with real **recursive-
  backtracker mazes** (winding corridors + dead-ends), lightly **braided** (a few
  dead-ends opened into loops so you can circle the horde). Generated +
  flood-fill-verified by the new committed `_genmaze.mjs` (seeded RNG →
  reproducible). Exit still sealed in a door-gated chamber; all three levels
  verified rectangular, gated, every feature reachable, keys never behind their
  own door.
