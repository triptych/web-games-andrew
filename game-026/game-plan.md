# Crypt of the Forgotten

**Genre:** First-person grid-based dungeon crawler ("blobber") with turn-based combat
**Engine:** three.js r165 (ES6 modules, loaded via CDN import map)
**Target Resolution:** Fullscreen (responsive); reference 1280 × 720
**Status:** Phase 4 complete — Visual Polish; Phase 5 (Combat) planned

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

The UI is a **DOM overlay** drawn over the full-bleed WebGL canvas (see `index.html` /
`ui.js`). DOM is chosen over in-world sprites because the HUD is flat, text-heavy, and benefits
from CSS layout, crisp font rendering, and easy responsive scaling. The 3D viewport stays
unobstructed in the center; UI hugs the edges so the dungeon view reads as the "window" the
player looks through — reinforcing the first-person, helmet-visor feel of the genre.

### Visual language

- **Aesthetic:** dark stone & aged parchment. Carved-frame panels with a subtle beveled border,
  semi-transparent dark fill (`rgba(10,10,20,0.72)`) and a thin warm-gold inset line
  (`COLORS.gold`). Lantern-amber accents on active elements; `COLORS.accent` (cyan) reserved for
  interactive/selected states; `COLORS.danger` (red) for damage and low-HP warnings.
- **Type:** monospace (`Courier New`) throughout, matching the repo's retro convention —
  uppercase + wide letter-spacing for labels, normal case for body/flavor text.
- **Motion:** numbers count up/down rather than snapping; panels slide/fade in; damage flashes a
  brief red vignette at the screen edges; the lantern light already flickers in-world.
- **Layout grid (16:9 reference 1280×720):** a 12px safe-area gutter. Top bar for vitals,
  bottom bar for the action/turn context, right rail for the compact minimap, left rail for the
  active-weapon/quick-item chip. Everything `pointer-events: none` except clickable controls.

### Exploration HUD (default mode)

```
┌────────────────────────────────────────────────────────────┐
│  ❤ HP 18/20  ▓▓▓▓▓▓▓░░   |  DEPTH  1   |   ⛀ SCORE 1240  ╔══╗ │  ← top bar
│                                                          ║▓▓║ │  ← minimap
│                     ( 3D dungeon view )                  ║▓ ◣║ │     (right rail)
│                                                          ╚══╝ │
│ ┌──────┐                                          🧭 N        │  ← compass (facing)
│ │ ⚔ SWD│                                                      │  ← weapon chip (left)
│ └──────┘   ◄ A   ▲ W   ► D    ⟲ Q  step  E ⟳        🔍 F SEARCH│  ← bottom action hint
└────────────────────────────────────────────────────────────┘
```

- **Top bar (vitals):**
  - *Health* — left: a heart glyph + numeric `HP cur/max` + a segmented bar that drains/refills
    with a tween; turns `danger` red and pulses below 25%.
  - *Depth* — center: current dungeon level (e.g. `DEPTH 3`); briefly enlarges on descent.
  - *Score* — right: counts up when gained.
- **Compass** — small cardinal indicator (N/E/S/W) tied to `state.facing`; rotates as the player
  turns. Critical for dead-reckoning in a maze.
- **Minimap (right rail)** — a small top-down grid of *explored* tiles only (fog-of-war:
  unexplored tiles hidden). Player shown as an arrow oriented to facing; stairs/doors/known items
  marked with glyphs. Toggleable (`M`) and expandable to a full-screen automap overlay (`Tab`).
- **Weapon / quick-item chip (left rail)** — the equipped weapon and a quick-use consumable slot
  with hotkey labels.
- **Bottom action hint** — context-sensitive control prompts; shows `SEARCH (F)` only when an
  interactable (switch, chest, door, illusory wall) is in the tile/face ahead.
- **Message log** — a 2–3 line transient feed bottom-left ("You found a rusted key.", "A draft
  hints at a hidden passage."), fading after a few seconds. The diegetic narration channel.

### Combat HUD (combat mode)

When combat begins (`combatStarted`), the exploration hints recede and a combat layer fades in.
Combat is turn-based, so the UI's job is to make **whose turn it is** and **what each action does**
unambiguous.

```
┌────────────────────────────────────────────────────────────┐
│  ❤ HP 14/20 ▓▓▓▓▓░░░       ✦ YOUR TURN ✦         DEPTH 2     │
│                                                              │
│                  ┌─ CRYPT GHOUL ──────┐                      │
│                   ❤ ▓▓▓▓▓▓░░  (hurt)                         │
│                     ( enemy in 3D view )                     │
│                                                              │
│   ╔══════════╦══════════╦══════════╦══════════╗   TURN ORDER │
│   ║ ⚔ ATTACK ║ 🛡 DEFEND ║ 🧪 ITEM  ║ 🏃 FLEE  ║   ▶ you      │
│   ║   (1)    ║   (2)    ║   (3)    ║   (4)    ║     ghoul    │
│   ╚══════════╩══════════╩══════════╩══════════╝     ghoul    │
└────────────────────────────────────────────────────────────┘
```

- **Turn banner** — center-top: `✦ YOUR TURN ✦` (gold) vs. `ENEMY TURN` (red); enemy actions
  pause briefly so the player can read them.
- **Enemy nameplate** — floats above the enemy in-view: name + a small HP bar + a status word
  (`hurt`, `enraged`, `poisoned`). Multiple enemies → stacked nameplates.
- **Action bar** — bottom: ATTACK / DEFEND / ITEM / FLEE as labeled buttons, each with a number
  hotkey (1–4) **and** clickable. Selecting ATTACK with multiple foes prompts target selection
  (arrow keys cycle a highlight; click to pick). Disabled actions (e.g. ITEM with empty inventory)
  are dimmed.
- **Turn-order tracker** — right rail: upcoming initiative list so the player can plan.
- **Floating combat text** — damage/heal numbers pop above the struck combatant and rise/fade;
  crits are larger and gold; misses show `MISS`.

### Inventory / character screen (overlay, `I`)

A modal panel that **pauses** the game (turn-based, so safe to open mid-explore). Two columns:
equipment & stats (left), backpack grid (right).

```
┌──── ◈ INVENTORY ◈ ──────────────────────────────┐
│  EQUIPPED              │   PACK                   │
│   ⚔ Weapon: Short Swd  │  ┌──┬──┬──┬──┬──┐         │
│   🛡 Armor : Leather    │  │🧪│🗝│🍞│  │  │         │
│   💍 Trinket: —         │  ├──┼──┼──┼──┼──┤         │
│                        │  │  │  │  │  │  │         │
│  STATS                 │  └──┴──┴──┴──┴──┘         │
│   ATK 6   DEF 3        │   (click/arrow to select; │
│   HP  20  SPD 4        │    Enter = use/equip)     │
└──────────────────────────────────────────────────┘
```

- Items show a tooltip on hover/focus (name, effect, flavor). Equip/use via click or Enter.
- Keys, quest items, and consumables share the grid but are visually grouped/tinted.

### Screen states & overlays

| State | Overlay | Notes |
|-------|---------|-------|
| Splash | Centered title + "press any key", controls hint, version tag | Current scaffold; add an animated lantern-glow vignette |
| Playing | Exploration HUD | Default |
| Combat | Combat HUD layer over the viewport | Exploration hints recede |
| Inventory/Char | Modal panel, dimmed backdrop | Pauses the game |
| Paused (`P`) | "PAUSED" banner + dimmed backdrop | |
| Level transition | Brief fade-to-black + `DESCENDING… DEPTH n` | On taking the stairs |
| Game over | "YOU DIED", final score, restart/menu prompt | Current scaffold |
| Victory | "THE CRYPT IS YOURS", run summary (depth, score, kills) | Win condition |

### Feedback & juice

- **Damage taken** — red edge vignette flash + brief camera shake (small, grid-respecting).
- **Wall bump** — short head-knock dip + the bump SFX (Phase 2 TODO).
- **Low HP** — persistent slow red pulse on the screen border + heartbeat audio.
- **Pickup / level-up** — gold flash on the relevant HUD element + chime.
- **Reduced-motion** — respect `prefers-reduced-motion`: disable shake/vignette pulse, keep
  instant state changes.

### Responsiveness & accessibility

- HUD scales with viewport via a root `--ui-scale` (clamp font/panel sizes between phone and
  desktop); the 3D viewport always fills the screen, HUD reflows to edges.
- Everything is keyboard-operable (the genre is keyboard-first); mouse/touch is additive.
- Minimum 4.5:1 text contrast against panel fills; never encode info by color alone (icons +
  text labels accompany color states like low-HP red).

### Implementation notes

- Keep the HUD as **declarative DOM** updated from `events` (`scoreChanged`, `livesChanged`,
  plus planned `hpChanged`, `depthChanged`, `combatStarted`, `combatEnded`, `playerMoved`,
  `logMessage`). `ui.js` owns all DOM; gameplay modules only emit events.
- Minimap & compass derive from `state.playerTile` / `state.facing` + the dungeon's explored set.
- Combat UI lives in a hidden DOM layer toggled by combat mode, not rebuilt each turn.
- Floating combat text and the message log are pooled DOM nodes recycled to avoid churn.

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
- [x] Wall-bump feedback (sound + head-knock shake)
- [x] Footstep sound + on-arrival tile checks (stairs/loot/encounter)

### Phase 3 — Exploration HUD (complete)
- [x] HUD skeleton & visual language — carved-frame panels, gold-inset borders, monospace type, `--ui-scale` root var, safe-area gutter
- [x] Top bar: health bar (`hpChanged`, animated fill + low-HP red pulse), depth readout (`depthChanged`), score count-up (`scoreChanged`)
- [x] Compass tied to `state.facing` (`playerMoved`)
- [x] Minimap (right rail) with fog-of-war (`tileRevealed`); player arrow, stairs glyph; `M` toggle, `Tab` full-screen automap
- [x] Message log — pooled transient feed (`logMessage`), 3-line pool with auto-fade
- [x] Context-sensitive action hint (shows `SEARCH (F)` when an interactable is ahead)
- [x] Weapon / quick-item chip (left rail)
- [x] Feedback/juice: damage edge-vignette + grid-safe camera shake, pickup gold-flash, `prefers-reduced-motion` support

### Phase 4 — Visual polish: wall shading, textures & level variety (complete)
- [x] **Procedural wall textures** — canvas-generated `CanvasTexture` patterns (stone block grid, subtle crack/grunge noise) baked per-surface type and cached; set `colorSpace = THREE.SRGBColorSpace` to avoid color wash
- [x] **Per-face shading** — directional tint so north/south walls read darker than east/west (side-lit crypt feel); ceiling darker than floor; all driven by a `SHADING` config table so it's easy to tune
- [x] **Wall variety flags in tile data** — `variantMap` keyed by `'x,z:face'`; 10 authored variants on Level 1 (`crack`, `moss`, `arch`, `torch`); variant texture overlay painted into `_makeStoneTexture`
- [x] **Torch sconces** — emissive `PlaneGeometry` flame sprite + bracket mesh + `PointLight` at `torch`-variant faces; dual-sin-wave flicker via `updateTorches(dt)` called each frame from `main.js`
- [x] **Floor & ceiling tile variety** — alternate worn/rubble material on deterministic hash `(x*7+z*13)%5===0` tiles; separate ceiling hash for variation; both shaded via `SHADING` table
- [x] **Level theme config** — `LEVEL_THEMES` in `config.js` keyed by depth 1–3; defines `wallTint/floorTint/ceilTint` (multiplied onto base `COLORS`), `fogColor/fogNear/fogFar`, `ambientIntensity`, `allowedVariants`; applied in `buildLevel()`

### Phase 5 — Combat & combat HUD
- [ ] Monsters (billboards or low-poly meshes) with stats
- [ ] `combat.js` — turn-based combat loop; emits `combatStarted` / `combatEnded` / `hpChanged`
- [ ] Combat HUD layer: turn banner, enemy nameplates (HP + status), ATTACK/DEFEND/ITEM/FLEE action bar (hotkeys 1–4 + clickable), target selection, turn-order tracker, floating combat text

### Phase 6 — Content & progression
- [ ] Loot, keys, doors; inventory / character screen overlay (`I`, pauses game) — equipment, stats, backpack grid, tooltips
- [ ] Descent stairs → level transition overlay (fade + `DESCENDING… DEPTH n`), depth progression; apply `LEVEL_THEMES` on descent
- [ ] Win condition + victory screen (run summary: depth, score, kills); pause overlay (`P`)

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `livesChanged` | newLives | state | ui |
| `gameOver`     | —        | state | ui, main |
| `gameWon`      | —        | (TODO)| ui, main |
| `playerMoved` | {x, z, facing} | player | ui (compass/minimap, Phase 3) |
| `tileEntered` | {x, z, tile} | player | loot/encounter systems (Phases 4–5) |
| `stairsReached` | {x, z} | player | level transition (Phase 5) |
| *planned* `hpChanged`     | {cur, max} | combat/state | ui (health bar) |
| *planned* `depthChanged`  | newDepth | dungeon | ui (depth readout) |
| *planned* `combatStarted` | monster(s) | combat | ui (combat layer) |
| *planned* `combatEnded`   | {result} | combat | ui (restore exploration HUD) |
| *planned* `tileRevealed`  | {x, z} | player/dungeon | ui (minimap fog-of-war) |
| *planned* `logMessage`    | string | any | ui (message log) |

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

### Phase 3 — Exploration HUD (2026-06-21)
- Full DOM HUD with carved-panel visual language: `--ui-scale`, `--panel-bg/border/inset` tokens, gold accents
- Top bar: animated HP fill bar (smoothstep tween) with low-HP red pulse below 25%; depth readout with pop animation on descent; score count-up animation
- Compass: N/E/S/W cardinal indicator with `state.facing` rotation, updates on every `playerMoved`
- Minimap (right rail): fog-of-war canvas, `M` toggle, player gold arrow, stairs `>` glyph; `Tab` full-screen automap overlay
- Message log: 3-node DOM pool, auto-fade after 4s, driven by `logMessage` event
- Context-sensitive "SEARCH (F)" hint: live on `playerMoved`, checks tile ahead for interactable chars
- Weapon chip (left rail): shows equipped weapon name (defaults to "Fists")
- Juice: `damageTaken` → edge-vignette flash + grid-safe camera shake (offset applied/removed each frame); `pickupGold` → score flash; persistent low-HP vignette pulse; all disabled under `prefers-reduced-motion`
- State: added `hp/hpMax/depth` with auto-emit setters; `tileRevealed` fog-of-war tracking in `player.js` via `_visited` Set + `getVisited()` export

### Phase 4 — Visual polish (2026-06-21)
- `dungeon.js` completely rewritten for Phase 4: wall-face planes replace BoxGeometry walls, giving per-face materials and shading
- Procedural stone-block `CanvasTexture` with deterministic LCG grunge noise; variant overlays (crack zigzag, moss corner patches, arch arc) painted in `_makeStoneTexture`; `colorSpace = SRGBColorSpace` set on all textures
- `SHADING` table in `config.js` drives face brightness: N/S walls 0.72×, E/W 0.90×, ceiling 0.55×, alt floor 0.85×
- `LEVEL_1_VARIANTS` map (10 authored entries) tags wall faces with `crack/moss/arch/torch`
- Torch sconces: `PlaneGeometry` flame + bracket `BoxGeometry` + `PointLight`; `updateTorches(dt)` in `main.js` animate loop runs dual-sin flicker per torch with LCG-seeded desync
- Floor/ceiling variety: deterministic hash selects `floorAlt` material on ~20% of tiles; separate hash for ceiling
- `LEVEL_THEMES[1-3]` in `config.js`: warm amber Upper Crypt → cooler blue Cold Depths; `buildLevel()` applies fog color/range and theme tints at build time

### Phase 2 — Feedback & arrival hooks (2026-06-12)
- Wall-bump feedback: blocked moves now play a dull noise-burst thud and run a short 'bump' tween — the camera lurches `BUMP_DIST` into the wall with a `BUMP_DIP` head-knock dip, then returns (input stays locked during it, like any tween)
- Footstep sound (pitch-varied low square thud) on every committed step
- `_onArrive()` tile checks after each step: emits `tileEntered {x, z, tile}` for future loot/encounter systems; stepping onto `>` plays the descend rumble and emits `stairsReached` (level transition lands in Phase 5)
- Player now emits `playerMoved {x, z, facing}` on spawn and after each step/turn — ready for the Phase 3 compass/minimap
- New sounds in `sounds.js`: `playFootstep`, `playWallBump`, `playDescend`; new config: `BUMP_TIME`, `BUMP_DIST`, `BUMP_DIP`
