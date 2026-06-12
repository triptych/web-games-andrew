# Crypt of the Forgotten

**Genre:** First-person grid-based dungeon crawler ("blobber") with turn-based combat
**Engine:** three.js r165 (ES6 modules, loaded via CDN import map)
**Target Resolution:** Fullscreen (responsive); reference 1280 × 720
**Status:** Phase 2 complete — walkable dungeon

---

## Concept

A first-person grid-based dungeon crawler (blobber) with turn-based combat — explore a
forgotten crypt, step tile by tile, fight monsters, and uncover its secrets.

The player advances one tile at a time and turns in 90° increments, in the tradition of
*Eye of the Beholder*, *Dungeon Master*, and *Legend of Grimrock*. Movement and view are
strictly grid-aligned, but the world is rendered in full 3D with fog, a flickering lantern
light, and crumbling crypt architecture. Tension comes from limited sight lines, the dread of
what waits around each corner, and resource-aware turn-based fights where every action counts.

---

## Core Mechanics

### 1. Grid-step movement
The dungeon is a 2D grid of tiles. The player occupies one tile and faces one of four cardinal
directions. Forward/back/strafe move one tile; left/right rotate 90°. Movement is animated as a
short slide/turn tween (`STEP_TIME` / `TURN_TIME` in config) but is logically discrete — you are
either fully on a tile or sliding to the next, never between.

### 2. Turn-based combat
When a monster is adjacent (or enters line of sight), the game enters combat mode. Player and
enemies alternate turns: attack, defend, use item, or flee. Combat pauses free movement.

### 3. Exploration & secrets
Hidden switches, illusory walls, pressure plates, and locked doors reward careful searching.
Mapping the maze (mentally or via an in-game automap) is part of the challenge.

### 4. Loot & inventory
Chests and fallen monsters drop weapons, armor, keys, and consumables that modify the player's
attack/defense and unlock progression.

### 5. Descent / progression
Stairs lead deeper into the crypt. Each level is larger and deadlier; the goal is to reach the
bottom and uncover the crypt's secret.

---

## Game Loop

1. Spawn on the entry tile of the current dungeon level facing into the maze.
2. Explore tile by tile — reveal corridors, rooms, doors, and items.
3. Encounter monsters → enter turn-based combat → win (gain score/loot) or die (lose a life).
4. Solve puzzles / find keys to open the path to the descent stairs.
5. Descend → repeat at greater difficulty.
6. Run ends on death (out of lives → game over) or on reaching the crypt's heart (win).

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Step forward | W / Up arrow |
| Step back | S / Down arrow |
| Turn left | A / Left arrow |
| Turn right | D / Right arrow |
| Strafe left / right | Q / E |
| Attack / confirm | Space / Left Click |
| Search / interact | F |
| Pause | P |
| Restart | R |
| Menu | Escape |

---

## Progression / Difficulty

- **Depth scaling:** each descended level adds larger maps, tougher monsters, and trickier puzzles.
- **Monster variety:** new enemy types introduced by depth, each with distinct stats/behaviors.
- **Resource pressure:** healing items and light are finite, pushing the player to keep moving.
- **Score:** awarded for kills, treasure, and reaching new depths; shown in the HUD.

---

## UI / HUD

DOM overlay drawn over the WebGL canvas (see `index.html` / `ui.js`):
- **Score** — top-left.
- **Lives** — top-right.
- **Splash / message** — centered overlay for title, combat prompts, and game-over.
- *Planned:* health bar, depth indicator, minimap, inventory panel, compass.

---

## Sound Design

Web Audio API — no file assets. Procedural SFX in `sounds.js`.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Start / menu | Short sine blip |
| Footstep | Step onto a tile | Low square thud |
| Wall bump | Move blocked | Dull noise burst |
| Sword swing | Player attack | Square sweep down |
| Monster hit | Enemy struck | Square sweep + noise |
| Treasure | Pickup loot | Rising sine arpeggio |
| Descend | Take the stairs | Low rumble sweep |
| You Died | Game over | Sawtooth fall + noise |

---

## Phases

### Phase 1 — Foundation (complete)
- [x] Scaffold: index.html, config, events, state, sounds, scene, ui, main
- [x] Three.js scene with fog + lantern light, splash → playing → gameover state machine
- [x] First gameplay feature: render the dungeon and explore it (superseded by Phase 2)

### Phase 2 — Movement & dungeon
- [x] `dungeon.js` — tile grid data + mesh generation (walls/floor/ceiling), hand-authored Level 1, `isWalkable()`/`tileAt()`, descent-stairs tile
- [x] `player.js` — grid position/facing, animated step/turn/strafe tweens (smoothstep), wall collision
- [x] Camera driven by the player's grid pose; input wired in `main.js`
- [ ] Wall-bump feedback (sound + head-knock shake)
- [ ] Footstep sound + on-arrival tile checks (stairs/loot/encounter)

### Phase 3 — Combat & content
- [ ] Monsters (billboards or low-poly meshes) with stats
- [ ] Turn-based combat loop and combat HUD
- [ ] Loot, keys, doors, descent stairs, depth progression, win condition

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `livesChanged` | newLives | state | ui |
| `gameOver`     | —        | state | ui, main |
| `gameWon`      | —        | (TODO)| ui, main |
| *planned* `playerMoved` | {x, z, facing} | player | dungeon, monsters |
| *planned* `combatStarted` | monster | combat | ui |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`   | Game state machine, animate() loop, module orchestration |
| `scene.js`  | Renderer, scene, camera, clock — exports live bindings |
| `config.js` | Constants and definitions (grid, camera, colors, dirs) |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | DOM HUD bindings and game-over overlay |
| *planned* `dungeon.js` | Tile grid + level mesh generation |
| *planned* `player.js`  | Grid movement, facing, step/turn tweens |
| *planned* `combat.js`  | Turn-based combat resolution |

---

## Open Questions

- [ ] Hand-authored levels vs. procedural generation?
- [ ] Automap / minimap in v1, or pure dead-reckoning?
- [ ] Single party member or a true multi-character "blob" party?
- [ ] Monster rendering: 2D billboards (retro) vs. low-poly 3D meshes?
- [ ] Real-time-with-pause fallback if turn-based feels too slow to playtest?

---

## Changelog

### Phase 1 — Scaffold (2026-06-12)
- Initial scaffold: index.html, config, events, state, sounds, scene, ui, main
- Three.js scene with fog + camera-mounted lantern light; splash → playing → gameover machine

### Phase 2 — Movement & dungeon (2026-06-12)
- `dungeon.js`: hand-authored 15×11 Level 1, wall/floor/ceiling mesh gen, shared materials, per-build geometry disposal, `isWalkable()` / `tileAt()`
- `player.js`: grid-aligned step/back/strafe + 90° turns with smoothstep tweens, input locked mid-move, wall collision, camera driven by logical pose
- Wired `initDungeon`/`initPlayer`/`updatePlayer`/`handleInput` into `main.js`; game is now walkable
- Visibility pass: ACES tone mapping + sRGB output, brighter warm lantern (intensity 22, decay 2) offset ahead of the eye, added hemisphere fill, pushed fog back to 12–40, lightened wall/floor/ceiling colors so surfaces actually read
