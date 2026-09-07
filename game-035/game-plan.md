# N2 Overdrive

**Genre:** Tube shooter (tribute to N2O: Nitrous Oxide, PS1, 1998, Gremlin Interactive)
**Engine:** Phaser 4.0.0 (ES6 modules)
**Target Resolution:** Responsive (Phaser `Scale.RESIZE`) — no fixed aspect ratio
**Status:** Playable — v1.0

---

## Concept

A functional tribute to *N2O: Nitrous Oxide*, the 1998 PS1 tunnel shooter by Gremlin
Interactive (Crystal Method soundtrack, psychedelic neon tube visuals). The player's
ship is confined to the rim of a tunnel that rushes toward the camera; movement is
angle-only (left/right around the ring), matching the original's Tempest-style
constraint. Enemies, mushrooms, and coins spawn at the vanishing point and approach;
the ship shoots to clear them, ripens mushrooms into shields, and races to keep its
multiplier and score climbing as the tunnel gets faster and more hectic the longer
the player survives.

## Core Mechanics

### 1. Ring movement
The ship never leaves a fixed-radius ring at the mouth of the tunnel. Steering only
changes its angle around that ring — there is no forward/back or radial movement.

### 2. Depth-based world (angle, z)
Every entity lives in polar-depth space: `angle` (0..2π around the ring) and `z`
(0 = at the ship's plane, 1 = the vanishing point). `tunnel.js` projects this to
screen space with a perspective falloff tuned so entities stay clearly visible/aimable
for most of their approach, not just in the last instant before they reach the camera.

### 3. Mushrooms: shoot to ripen, fly through to collect
A direct N2O mechanic. Mushrooms need `MUSHROOM_HITS_TO_RIPEN` (2) hits to turn red.
Flying the ship through a ripe mushroom grants a shield; flying through an unripened
one grants a bonus star instead (5 stars → a bonus banner/round trigger).

### 4. Kill-driven speed ramp
Every enemy kill nudges `state.forwardSpeed` up (capped at `MAX_FORWARD_SPEED`), and
it decays slowly back toward base when the player isn't scoring kills. This is N2O's
signature "the game gets faster/more hectic the better you're doing" feel. The tunnel
visuals (hue rotation speed, ring wobble) are driven by the same speed value.

### 5. Score multiplier
Killing an enemy bumps the multiplier; getting hit resets it to x1. Coins can be
shot before collection to raise their value (`Coin.boost()`), mirroring the original's
"shoot the coin to raise its worth" trick.

### 6. Lane-based collision (not literal distance)
Both the ship and entities live at a continuous `angle`, but hit-testing treats
"close enough" as being in roughly the same 1-of-16 lane (`RING_SEGMENTS`), not
literal pixel distance — this is what makes dodging enemies by steering to a
different lane actually work, and what stops enemies several lanes away from
"grazing" the ship.

## Game Loop

Splash (title + animated tunnel preview) → tap/click/key to start → GameScene runs
until all 3 shields are lost → UIScene shows the "SHIELDS DOWN" overlay with final
score → restart (R key or tap) or ESC back to splash.

## Player Controls

| Action | Input |
|--------|-------|
| Steer  | Arrow Left/Right or A/D (desktop) — on-screen ◀ / ▶ buttons (touch) |
| Fire   | Space (desktop, hold) — auto-fires while steering on touch, or tap the ● button |
| Restart | R (from game-over) / tap the game-over screen on touch |
| Menu   | Escape |

Touch buttons are DOM overlays (not Phaser game objects) so they sit above the
canvas regardless of scaling — see `input.js`.

## Progression / Difficulty

- `Spawner.js` shrinks the enemy spawn interval over survival time
  (`DIFFICULTY_RAMP_PER_SEC`), independent of the kill-driven speed ramp.
- Tougher enemy types (`zigzag`, `tank`) unlock as the difficulty ramp climbs.
- Occasional small enemy packs spawn once difficulty is past a threshold.

## UI / HUD

- Score + multiplier (top-left)
- Shields as ◆/◇ pips + bonus-star meter as ★/☆ (top-right)
- Speed meter bar (bottom-center)
- Bonus banners (star-meter full / bonus round end) as tweened toast text
- Game-over overlay with final score and restart prompt

All HUD elements read live `viewport.js` values and reposition on resize.

## Responsive / Mobile

The canvas uses Phaser `Scale.RESIZE` (not a fixed-aspect letterboxed canvas) so a
portrait phone gets a tall tunnel and a wide desktop gets a wide one — no wasted
black bars. `viewport.js` holds the live width/height/center/radius and every module
that needs screen-space math reads from it instead of a static config constant.

**Gotcha (see `docs/phaser/phaser4-api.md`):** don't flex-center the `<body>` in CSS
*and* use Phaser's `Scale.CENTER_BOTH` — both try to center the canvas via different
mechanisms (CSS flex vs. inline margin) and stack, pushing the canvas off-screen.
Pick one. This game uses `Scale.RESIZE` + `Scale.NO_CENTER` (canvas fills the parent,
nothing to center) and no flex centering in CSS.

## Sound Design

Procedural Web Audio API (`sounds.js`) — no file assets. Shot, enemy hit/die, coin
pickup (pitch scales with coin value), mushroom ripen, shield gain/loss, star get,
bonus round fanfare, speed-up sweep, game over.

## Phases

### Phase 1 — Foundation
- [x] Scaffold: index.html, config, events, state, sounds, input, main
- [x] Tunnel renderer (Graphics-based, not shader — see Open Questions)
- [x] Ship, ring movement, firing

### Phase 2 — Core gameplay
- [x] Enemies (drone/zigzag/tank), bullets, collision system
- [x] Mushrooms (ripen/shield/star), coins (shoot-to-boost)
- [x] Score, multiplier, shields, speed ramp, difficulty ramp
- [x] Bonus star meter + bonus round trigger (banner only — no distinct bonus minigame yet)

### Phase 3 — Polish & mobile
- [x] Responsive canvas (Scale.RESIZE) + touch controls
- [x] HUD, splash screen, game-over flow, restart

### Phase 4 — Future ideas (not built)
- [ ] A distinct bonus-round minigame (currently just a banner + score bonus)
- [ ] Weapon power-ups (spread shot, bouncing bombs) — config stubs existed, removed as unused; re-add if pursued
- [ ] Multiple named tunnel "levels" with distinct palettes/enemy sets instead of one endless procedurally-varied tunnel

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | UIScene |
| `multiplierChanged` | newMult | state | UIScene |
| `shieldsChanged` | newShields | state | UIScene |
| `speedChanged` | newSpeed | state | UIScene |
| `starsChanged` | newStars | state | UIScene |
| `gameOver` | — | state | UIScene, GameScene (sound) |
| `bonusRoundStart` | — | state | UIScene, GameScene (sound) |
| `bonusRoundEnd` | bonusScore | state | UIScene |
| `shipFire` | angle | Ship | GameScene (spawns Bullet) |

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Phaser.Game init, Scale.RESIZE wiring, scene boot |
| `config.js` | Tunable constants (speeds, intervals, colors) |
| `viewport.js` | Live width/height/center/radius, updated on resize |
| `tunnel.js` | (angle, z) → screen-space projection math, shared by all entities |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (score, shields, speed ramp, etc.) |
| `sounds.js` | Web Audio API sound effects |
| `TunnelRenderer.js` | Graphics-drawn psychedelic tunnel backdrop |
| `Ship.js` | Player ship: ring movement, firing, hit/invuln |
| `entities.js` | Bullet, Enemy, Mushroom, Coin classes + `isNear` collision helper |
| `Spawner.js` | Enemy/mushroom/coin spawn timing and difficulty ramp |
| `input.js` | Keyboard + DOM touch-overlay input, unified into one controller |
| `SplashScene.js` | Title screen with animated tunnel preview |
| `GameScene.js` | Main gameplay loop, collision handling |
| `UIScene.js` | HUD overlay, game-over screen, resize-aware layout |

## Open Questions / Known Deviations from the Original

- The original N2O renders a true 3D tunnel; this tribute uses a Graphics-drawn
  2D polar projection (concentric warped rings) instead of a raymarched/WebGL
  shader tunnel. Phaser 4's `Shader` game object uses a fragile `#pragma
  phaserTemplate(...)` GLSL preprocessing system that couldn't be verified without
  live browser testing, so the lower-risk Graphics approach was chosen deliberately.
- No distinct bonus-round minigame yet — collecting 5 stars currently triggers a
  banner and a score bonus rather than a separate playable bonus stage.

## Changelog

### v1.0 — Playable (2026-09-07)
- Full core loop: ring movement, shooting, mushroom ripening/shields, coins,
  enemies (3 types), score/multiplier, kill-driven speed ramp, difficulty ramp,
  bonus star meter, responsive canvas, touch controls, splash/game-over flow.
- Fixed during build: perspective falloff was too steep (everything clustered at
  the vanishing point); `COLORS.text` was a CSS string being passed through a
  hex-int formatter (invisible HUD text); ship-vs-enemy collision tolerance was
  too wide (took damage from enemies a lane away) and duplicated across two code
  paths; mobile canvas was double-centered by CSS flex + Phaser `CENTER_BOTH`
  stacking (pushed off-screen) — switched to `Scale.RESIZE` for a fully
  responsive canvas instead of a fixed letterboxed one.
