# Dungeon Blobber

**Genre:** 3D First-Person Dungeon Crawler / Turn-Based RPG
**Engine:** Phaser 4.0.0
**Target Resolution:** 1280 × 720 (800 px 3D view + 480 px minimap panel)
**Status:** Phase 1 — Foundation Complete

---

## Concept

A 3D first-person dungeon crawler with raycasting visuals, procedurally generated floors and walls, turn-based combat, and stepwise grid movement in the classic "blobber" style.

Inspired by classics like Dungeon Master, Eye of the Beholder, and Wizardry, the player navigates a dark dungeon one tile-step at a time, facing and turning in 90° increments. Every encounter with an enemy triggers a round of turn-based combat: the player attacks, then the enemy counters. Item drops, XP gain, and level-ups keep the run feeling progressive across all 5 floors.

---

## Core Mechanics

### 1. Stepwise Grid Movement (Blobber)
The player occupies one grid cell and faces one of four cardinal directions (N/E/S/W). Each keypress moves exactly one tile forward/backward or turns 90° left/right — no analogue or free movement. This is the defining feel of the genre.

### 2. Raycasting 3D View
The left 800 px panel renders a first-person view using a DDA raycasting algorithm. Walls are distance-shaded; floor and ceiling are solid half-planes. Doors appear as a distinct wall colour and open on contact.

### 3. Procedural Dungeon Generation
Each floor is a new BSP-partitioned dungeon: rooms carved from a wall grid, connected by L-shaped corridors. Enemies and items are scattered across rooms. The final room contains the down staircase.

### 4. Turn-Based Combat
Bumping into an enemy (or pressing Space when facing one) initiates a combat round: player attacks → enemy counter-attacks. Damage is stat-based with a small random factor. Combat resolves within the same scene — no mode switch. Enemy HP and player HP are updated each round.

### 5. Character Progression
Defeating enemies grants XP. Levelling up raises max HP, ATK, and DEF. Collecting weapon/armour items provides permanent bonuses. Gold accumulates and will be used in a shop (Phase 3).

### 6. Fog of War (Minimap)
The right 480 px panel shows a minimap. Tiles are revealed as the player explores (radius-based visibility). Enemies and items on revealed tiles are shown as coloured dots.

---

## Game Loop

1. **Splash Screen** — title, controls, any key to start
2. **Floor Start** — procedural dungeon generated; player placed at start room
3. **Exploration** — step through corridors, reveal map, find enemies and items
4. **Combat** — each encounter is a synchronous turn exchange; survivor continues
5. **Level Up** — XP milestones grant stat bonuses between steps
6. **Stairs Down** — descend to next floor (5 floors total)
7. **Victory / Death** — final floor exit = win; HP reaching 0 = death
8. **Score** — XP gained × 10 + 5000 bonus for victory

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move Forward | W / Up Arrow |
| Move Backward | S / Down Arrow |
| Turn Left | A / Left Arrow |
| Turn Right | D / Right Arrow |
| Attack (facing) | Space |
| Toggle Minimap | M |
| Inventory (Phase 3) | I |
| Restart | R |
| Menu | Escape |

---

## Progression / Difficulty

| Floor | Enemy Pool | Scaling |
|-------|-----------|---------|
| 1 | Slime | Base stats |
| 2 | Slime, Goblin | +3 HP, +1 ATK per floor |
| 3 | Goblin, Skeleton | +3 HP, +1 ATK per floor |
| 4 | Skeleton, Orc | +3 HP, +1 ATK per floor |
| 5 | Orc, Lich | +3 HP, +1 ATK per floor |

Level-up thresholds scale ×1.6 per level (20 → 32 → 51 → 82...). Each level grants +5 max HP, +2 ATK, +1 DEF.

---

## UI / HUD

**Left panel (3D view, 800 × 720)**
- Top bar: HP label + colour-coded HP bar (green → yellow → red) · ATK/DEF/Level/XP stats · Floor number · Gold count
- Bottom strip: 5-line message log (most recent at top, fades older lines)
- Combat panel (when active): enemy name, enemy HP bar, enemy stats, hint

**Right panel (minimap, 480 × 720)**
- Dark background
- Per-tile coloured minimap (fog of war, player-centred)
- Player = cyan square; enemies = red; items = gold; stairs = green/purple

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Any key on splash | Short sine blip |
| Footstep | Step forward/backward | Dull thud + short noise |
| Bump | Walk into wall | Low square buzz |
| Door Open | Step onto door tile | Rising sweep |
| Attack | Player swings | Sawtooth sweep + noise |
| Enemy Attack | Enemy counter | Square sweep + noise |
| Player Hit | Damage taken | Sawtooth drop + noise |
| Enemy Die | Enemy HP reaches 0 | Long sawtooth fall + noise |
| Pickup | Item collected | Double sine blip |
| Stairs | Step on staircase | 4-note ascending arpeggio |
| Victory | All floors cleared | 4-note ascending arpeggio |
| Game Over | Player HP reaches 0 | Sawtooth descent + noise |

---

## Phases

### Phase 1 — Foundation (2026-04-16) ✅
- [x] Scaffold: index.html, config, events, state, sounds, main
- [x] Procedural BSP dungeon generator (dungeon.js)
- [x] DDA raycaster rendering 3D view (raycaster.js)
- [x] Stepwise grid movement (blobber controls)
- [x] Turn-based combat (bump-to-fight)
- [x] Fog-of-war minimap (right panel)
- [x] Item pickup system
- [x] XP / level-up system
- [x] Floor transitions (5 floors)
- [x] UIScene HUD (HP bar, stats, message log, combat panel)
- [x] Game-over and victory screens
- [x] All procedural sound effects

### Phase 2 — Polish (2026-04-16) ✅
- [x] Enemy sprites / icons on minimap — per-type color coding + alerted indicator
- [x] Wall textures — procedural brick pattern with mortar (raycaster.js, Phase 1)
- [x] Door animation — raycaster renders door color until opened (instant, no multi-frame needed)
- [x] Animated damage numbers in the 3D view — floating text projected from enemy world pos
- [x] Enemy pathfinding — BFS chase when alerted, random roam when not
- [x] Ranged enemies — Skeleton/Lich attack from range 4–5 tiles with LoS check
- [x] Status effects — poison (Orc/Lich) and stun (melee enemies); Antidote item added

### Phase 3 — Content & Depth
- [ ] Shop room on each floor (spend gold for potions, weapons)
- [ ] Inventory screen (I key) — equip weapons and armour
- [ ] More item types: keys, scrolls, wands
- [ ] Locked doors (require key)
- [ ] Boss enemy on floor 5
- [ ] Save/load (localStorage)
- [ ] High-score table

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | UIScene |
| `livesChanged` | newLives | state | UIScene |
| `gameOver` | — | state | UIScene, GameScene |
| `gameWon` | — | GameScene | UIScene |
| `playerMoved` | { x, y, facing } | GameScene | UIScene |
| `floorChanged` | floorNumber | state | UIScene |
| `combatStart` | { enemy } | state | UIScene |
| `combatEnd` | — | state | UIScene |
| `playerAttacked` | { target, damage } | GameScene | UIScene |
| `enemyAttacked` | { enemy, damage } | GameScene | UIScene |
| `enemyDied` | { enemy } | GameScene | UIScene |
| `logMessage` | text | state | UIScene |
| `itemPickedUp` | item | GameScene | UIScene |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Phaser.Game init, scene boot |
| `config.js` | Constants — canvas, dungeon, raycaster, combat |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (HP, XP, level, position, log) |
| `sounds.js` | Web Audio API procedural sound effects |
| `dungeon.js` | BSP procedural map generator |
| `raycaster.js` | DDA raycaster → RenderTexture in Phaser |
| `SplashScene.js` | Title screen |
| `GameScene.js` | Movement, combat, floor logic, minimap rendering |
| `UIScene.js` | HUD overlay (HP, stats, log, combat panel, overlays) |

---

## Open Questions

- [ ] Should the minimap be a separate Phaser camera / scene, or stay as Graphics in GameScene?
- [ ] What's the combat feel target — pure stat-based, or add a rhythm/timing mechanic?
- [ ] Should doors show as a 3D sprite or just a different wall colour?
- [ ] Victory condition: escape on floor 5, or collect a specific item first?

---

## Changelog

### Phase 1 — Scaffold + Core Systems (2026-04-16)
- Initial scaffold: all module files created
- BSP dungeon generator with rooms, corridors, stairs, enemy/item spawns
- DDA raycaster: distance-shaded walls, fog ceiling/floor, fisheye correction
- Blobber stepwise movement: W/S = forward/back, A/D = turn 90°
- Bump-to-fight turn-based combat with XP/gold rewards
- Radius-based fog-of-war minimap in right panel
- Item pickup: heal, ATK, DEF, gold effects
- 5-floor progression with procedural difficulty scaling
- Full UIScene HUD: HP bar, stats, message log, combat panel, game-over/victory overlays
- Procedural Web Audio sound effects for all gameplay events
