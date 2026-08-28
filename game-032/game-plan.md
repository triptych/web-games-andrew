# Ironhollow Depths

**Genre:** Top-down 8-bit action dungeon crawler
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Planning — Phase 1

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

### 3. Enemies (slimes to start)
Green slime enemies wobble/squish and chase the player at a steady pace. Contact damages the player (with brief invulnerability + flicker after a hit). Killing an enemy grants score and respawns a replacement after a delay so the floor stays populated.

### 4. Treasure pickups
Gold gems scattered around the room bob gently; walking over one grants score and a pickup chime.

### 5. Health & lives
Player has an HP bar (visible under the status readout). Taking damage drains HP; hitting 0 costs a life and resets HP. Running out of lives ends the run.

### 6. Floor progression (future)
`state.level` tracks the current floor/depth. Increasing level scales enemy count and health. Phase 2+ will add a way to actually descend (e.g. a stairs tile) rather than just an internal counter.

---

## Game Loop

1. Splash screen — press any key / click to start.
2. Player spawns in a single dungeon room populated with slimes and treasure.
3. Player fights, loots, and survives.
4. On taking lethal damage repeatedly, lives run out → Game Over screen with final score and floor reached.
5. R restarts, Escape returns to splash.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move   | WASD / Arrow keys |
| Attack | Space |
| Pause  | P |
| Restart | R |
| Menu   | Escape |

---

## Progression / Difficulty

- `state.level` scales enemy count (`3 + min(level, 6)`) and enemy HP (`+8 per level`) on room entry.
- Phase 2 goal: add a stairs/exit tile that increments `state.level`, clears the room, and rebuilds a harder one — turning "level" into real floor descent.

---

## UI / HUD

- Top-left: retro monospace status readout `S<score>L<level> - <health>` (styled after the reference screenshot's "S30T86 - 11" CRT text) plus a chunky HP bar underneath.
- Top-right: LIVES counter.
- Game Over: dim overlay, "YOU HAVE FALLEN", final score + floor reached, restart hint.

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

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Single-room dungeon with wall/pillar collision
- [x] Player movement + melee attack
- [x] Slime enemies with chase AI, contact damage, and death/respawn
- [x] Treasure pickups
- [x] Retro CRT-style HUD (status readout + HP bar + lives)
- [x] Game over flow

### Phase 2 — Floor Descent
- [ ] Stairs tile that advances `state.level` and regenerates a harder room
- [ ] Multiple room layouts / simple procedural layout variation
- [ ] More enemy types (skeleton, bat) with distinct movement patterns

### Phase 3 — Juice & Polish
- [ ] Sprite art pass (replace primitive shapes with pixel-art sprites)
- [ ] Screen shake / hit-pause on player damage
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
| `gameOver`     | —        | state | ui |
| `enemyKilled`  | enemy entity | dungeon | (future: quest/combo tracking) |
| `treasureCollected` | value | dungeon | (future: combo/score popup) |
| `playerHit`    | damage amount | dungeon | (future: screen shake) |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`    | Kaplay init, scene definitions |
| `config.js`  | Constants, enemy defs, color palette |
| `events.js`  | EventBus singleton |
| `state.js`   | GameState singleton (score, lives, health, level) |
| `sounds.js`  | Web Audio API sound effects |
| `ui.js`      | Retro HUD rendering and game-over screen |
| `dungeon.js` | Room/tile rendering, player movement + combat, enemy AI, treasure |

---

## Open Questions

- [ ] Should floor descent be a literal stairs tile the player walks onto, or a "clear all enemies" trigger?
- [ ] Should enemy variety (skeletons, bats, etc.) be added before or after visual sprite polish?
- [ ] Keep single-room-per-floor, or move to small multi-room mazes per floor?

---

## Changelog

### Phase 1 — Scaffold (2026-08-27)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Single-room dungeon with collision, player melee combat, slime enemies, treasure pickups, retro CRT-style HUD
