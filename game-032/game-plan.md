# Ironhollow Depths

**Genre:** Top-down 8-bit action dungeon crawler
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Playable, v1.1 — Phases 1 and 2 done; Phase 3 (art and juice) open

---

## Concept

An 80's-style top-down 8-bit dungeon crawler in the visual style of classic CRT-era action-RPGs. Guide a pixel-art knight through torch-lit brick dungeons, hack down green slimes and other monsters with your sword, grab treasure, and descend through stages, all under a chunky retro status-bar HUD.

The look is deliberately CRT-era: chunky checkerboard stone floors, thick mortar-lined brick walls, flickering torches, blocky sprites with hard outlines, and a monospace status readout in the style of "S30T86 - 11" scrolling across the top of the screen. No smoothing, no gradients — pure 8-bit dungeon-crawl nostalgia.

---

## Core Mechanics

### 1. Top-down movement
WASD / arrow key movement around a single-screen room, with simple AABB collision against wall tiles and interior pillar blocks.

### 2. Melee combat
Space bar swings a sword in the direction the player is currently facing, damaging any enemy within a short arc/range in front of the player. Brief cooldown between swings; a visual swing flash marks the hit zone.

### 3. Enemies
Three types, mixed by weight from the floor they first appear on (`ENEMY_DEFS` in `config.js`). Contact damages the player (with brief invulnerability, a flicker and a small screen shake). A sword hit flashes the enemy white and knocks it back. Enemies do not respawn: a floor has `min(4 + floor, 13)` of them, and killing the last one opens the stairs.

| Enemy | From floor | Behaviour |
|---|---|---|
| Slime | 1 | Wobbles towards you, sliding along walls |
| Bat | 2 | Fast and erratic; zig-zags towards you and flies over pillars |
| Skeleton | 3 | Holds four to six tiles off and circles; throws a bone whenever it can see you. Bones stop at walls and can be swatted with the sword |

### 4. Treasure pickups
Gold gems scattered around the room bob gently; walking over one grants score and a pickup chime.

### 5. Health & lives
Player has an HP bar (visible under the status readout). Taking damage drains HP; hitting 0 costs a life and resets HP. Running out of lives ends the run.

### 6. Floors and the win
Ten floors. Each is one room with procedurally placed pillars; a layout is rejected unless a flood fill from the spawn reaches every floor tile. The stairs sit in the farthest fifth of the room and open once every foe is dead; walking onto them builds the next floor. Floors get darker and redder with depth. A health potion (+40 HP) waits on floors 3, 5, 7 and 9. On floor 10 the stairs are replaced by the Hollow Crown: clear the floor and claim it to win. The best floor, best score and whether the crown was ever claimed are saved (if the browser allows storage) and shown on the title and end screens.

---

## Game Loop

1. Splash screen — press any key / click or tap to start.
2. Each floor: kill every foe, grab the gold, take the stairs.
3. Floor 10: kill every foe and claim the Hollow Crown → win screen.
4. Lives run out → Game Over screen with final score, floor reached and the best run.
5. R, a click or a tap restarts; Escape returns to splash.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move   | WASD / Arrow keys |
| Attack | Space |
| Pause  | P (also automatic when the tab is hidden) |
| Sound on/off | M |
| Restart | R |
| Menu   | Escape |

**Touch** (shown only on touch devices, during play): put a thumb down anywhere on the left half and drag (a floating stick), hold the sword button in the bottom-right corner to keep swinging, and use the pause button in the top-right. On a portrait phone a hint suggests turning the phone sideways.

---

## Progression / Difficulty

- Enemy count is `min(4 + floor, 13)`; enemy HP grows per floor by each type's `hpPerFloor`.
- Bats join from floor 2 and skeletons from floor 3. Pillar count grows with depth (`5 + min(floor, 7)` attempts).
- Gold is worth `25 + 5 × floor`, and there is one more gem every three floors.

---

## UI / HUD

- Top-left: retro monospace status readout `S<score>L<level> - <health>` (styled after the reference screenshot's "S30T86 - 11" CRT text) plus a chunky HP bar underneath, starting right of the Games link.
- Top-centre: `FLOOR n/10   FOES n`, which turns into `STAIRS OPEN` or `CLAIM THE CROWN`.
- Top-right: LIVES counter.
- Banners: the floor number on entry, "THE STAIRS ARE OPEN", potion heals.
- HUD objects use `k.fixed()` so the screen shake moves the dungeon, not the HUD.
- Game Over / win: dim overlay, the result, final score, the best run, and a restart hint that matches the device.

---

## Sound Design

All Web Audio API procedural — no file assets.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Splash → game transition | Short sine blip |
| Sword Swing | Space press | Fast square-wave downsweep |
| Hit | Sword connects with enemy | Short square downsweep |
| Enemy Death | Enemy HP reaches 0 | Sawtooth downsweep + noise burst |
| Pickup | Treasure collected | Two-note sine chime |
| Player Hurt | Enemy contact damage | Sawtooth downsweep |
| Game Over | Lives reach 0 | Long sawtooth downsweep + noise |
| Descend | Stepping onto open stairs | Triangle upsweep |
| Stairs open | Last foe on a floor dies | Rising square arpeggio |
| Bone throw | A skeleton throws | Short triangle downsweep |
| Victory | Claiming the Hollow Crown | Square fanfare + held high note |

---

## Phases

### Phase 1 — Foundation
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Single-room dungeon with wall/pillar collision
- [x] Player movement + melee attack
- [x] Slime enemies with chase AI, contact damage, and death/respawn
- [x] Treasure pickups
- [x] Retro CRT-style HUD (status readout + HP bar + lives)
- [x] Game over flow

### Phase 2 — Floor Descent (done, v1.1)
- [x] Stairs tile that advances `state.level` and regenerates a harder room
- [x] Multiple room layouts / simple procedural layout variation (flood-fill validated)
- [x] More enemy types (skeleton, bat) with distinct movement patterns
- [x] A win: the Hollow Crown on floor 10
- [x] Touch controls, pause on hidden tab, saved best run
- [x] `dev/browsertest.mjs`

### Phase 3 — Juice & Polish
- [ ] Sprite art pass (replace primitive shapes with pixel-art sprites)
- [x] Screen shake on player damage (hit-pause still open)
- [ ] Score multiplier / combo system
- [ ] Title screen art matching the reference CRT aesthetic

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `livesChanged` | newLives | state | ui |
| `healthChanged` | newHealth, maxHealth | state | ui |
| `levelChanged` | newLevel | state | ui |
| `gameOver`     | —        | state | ui, main (hides touch controls) |
| `gameWon`      | —        | state | ui, main (hides touch controls) |
| `foesChanged`  | foes left | state | ui |
| `floorEntered` | floor | dungeon | ui (banner) |
| `stairsOpened` | isFinalFloor | dungeon | ui (banner) |
| `potionDrunk`  | heal amount | dungeon | ui (banner) |
| `enemyKilled`  | enemy entity | dungeon | (future: quest/combo tracking) |
| `treasureCollected` | value | dungeon | (future: combo/score popup) |
| `playerHit`    | damage amount | dungeon | (future: hit-pause) |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`    | Kaplay init, scene definitions |
| `config.js`  | Constants, enemy defs, color palette |
| `events.js`  | EventBus singleton |
| `state.js`   | GameState singleton (score, lives, health, level) |
| `sounds.js`  | Web Audio API sound effects |
| `ui.js`      | Retro HUD, banners, pause overlay, game-over and win screens |
| `dungeon.js` | Floor generation and validation, tiles, player movement + combat, enemy AI, bones, stairs/crown, pickups, debug hooks |
| `touch.js`   | On-screen stick, sword and pause buttons for touch devices |
| `dev/browsertest.mjs` | Playwright test: 60 generated floors, desktop flow, touch-only phones |

---

## Open Questions

- [x] Should floor descent be a literal stairs tile the player walks onto, or a "clear all enemies" trigger? **Both:** clearing the floor opens the stairs, and you walk onto them.
- [x] Should enemy variety (skeletons, bats, etc.) be added before or after visual sprite polish? **Before:** they are primitive shapes for now (bats have flapping wings, skeletons eye sockets).
- [ ] Keep single-room-per-floor, or move to small multi-room mazes per floor?

---

## Changelog

### v1.1 — Phase 2: floor descent (2026-10-04)
- Ten procedurally generated floors (flood-fill validated), stairs that open when a floor is clear, the Hollow Crown on floor 10 as the win
- Bats (floor 2+) and skeletons that throw bones (floor 3+); enemies no longer respawn
- Health potions on floors 3, 5, 7, 9; gold value scales with depth
- Touch controls (floating stick, sword button, pause button); pause on P or when the tab is hidden; M toggles sound
- Best floor, best score and crown claimed saved and shown on title and end screens
- Fixed: the enemy hit flash assigned a `color()` component instead of an `rgb()` value, so it never showed; the slime wobble set `scale` on objects without a `scale()` component
- Screen shake on player damage, with the HUD pinned via `k.fixed()`
- `dev/browsertest.mjs` and `dev/README.md`

### Phase 1 — Scaffold (2026-08-27)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Single-room dungeon with collision, player melee combat, slime enemies, treasure pickups, retro CRT-style HUD
