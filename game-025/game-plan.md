# Crypt Crawler

**Genre:** Top-down dungeon crawler / arcade (Gauntlet-like)
**Engine:** three.js r165 (ES6 modules, loaded via CDN import map)
**Target Resolution:** Full-window (responsive); HUD via DOM overlay
**Status:** In progress — Phases 1–3 complete (enemies, nests & combat playable)

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

### Phase 4 — Pickups, Doors & Levels
- [ ] `pickups.js` — food/treasure/key spawns
- [ ] Doors (key-gated) + level exit + descend logic
- [ ] Multi-level progression + difficulty scaling + victory

### Phase 5 — Polish
- [ ] Floating damage/score popups, hit flashes, death effects
- [ ] Bloom / lighting polish, minimap, high-score persistence

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
| `doorOpened`    | doorId         | doors      | sfx         |
| `nestDestroyed` | nestId         | nests      | state, sfx  |
| `gameOver`      | —              | state      | ui, main    |
| `gameWon`       | —              | state      | ui, main    |

---

## Module Overview

| File         | Responsibility |
|--------------|----------------|
| `main.js`    | Game state machine, animate() loop, input, module orchestration |
| `scene.js`   | Renderer, scene, camera, clock, fog, lights — exports live bindings |
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

---

## Open Questions

- [ ] Maze generation: hand-authored level layouts vs procedural?
- [ ] How many levels total before victory? (plan assumes ~5)
- [ ] Should treasure/keys also be destructible by stray shots (Gauntlet-style)?
- [ ] Multiplayer / co-op, or single-player only?
- [ ] Movement: continuous 8-direction, or grid-snapped?

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
