# Synthwave Breakout

**Genre:** Arcade / Brick Breaker
**Engine:** Phaser 4.0.0
**Target Resolution:** 1280 × 720
**Status:** Planning — Phase 1

---

## Concept

A retro synthwave-themed breakout game with vivid neon colors, explosive particles, and non-stop action. The player controls a hot-pink paddle at the bottom of the screen, bouncing a glowing ball to smash through layered brick formations while collecting falling powerups. The aesthetic draws heavily from 80s synthwave: perspective grids, scanlines, neon pinks, cyans, and violets.

Every session escalates in intensity — bricks get tougher, the ball accelerates on each hit, and the combo multiplier rewards sustained rallies. Powerups drop chaos onto the field: multiball explosions, laser cannons, paddle-widening, and ball slow-downs.

---

## Core Mechanics

### 1. Ball Physics
The ball bounces off walls, the paddle, and bricks. Angle on the paddle is controlled by hit position (center = straight up, edges = sharp angles). Ball speed increases by a fixed amount per brick hit, capped at BALL_SPEED_MAX.

### 2. Brick Grid
8 rows × 14 columns of bricks with HP tiers based on row. Top rows are fragile (1 HP), bottom rows are armored (3 HP). Visual damage states show cracks as HP drops. Each row uses a distinct neon color from the synthwave palette.

### 3. Combo Multiplier
Consecutive brick hits without losing a ball build a combo counter (max ×8). The multiplier resets when the ball is lost. Combo milestones trigger audio fanfares.

### 4. Powerup Drops
Bricks have an 18% chance to drop a powerup capsule on destruction. Capsules fall slowly; the player must catch them with the paddle:
- **WIDE** — expands paddle width ×1.7 for 10 seconds
- **SLOW** — reduces ball speed to 65% for 8 seconds
- **MULTIBALL** — splits each live ball into three (adds 2 angled copies)
- **LASER** — grants a laser cannon on the paddle for 12 seconds (Z key / right-click fires)

### 5. Particle Explosions
Bricks, paddle hits, and ball-loss events spawn bursts of colored square particles with gravity and fade-out. Brick color is inherited by its particle burst.

### 6. Level Progression
When all bricks are destroyed the level completes, score and lives carry over, and the grid is rebuilt for the next level.

---

## Game Loop

1. **Splash screen** — animated perspective grid + title. Any key/click starts the game.
2. **Level start** — ball rests on paddle. Click/Space to launch.
3. **Rally** — bounce ball through bricks, combo, collect powerups.
4. **Ball lost** — life deducted, combo reset, ball respawns after 0.8 s.
5. **Level complete** — fanfare, brief pause, next level loads.
6. **Game over** — all lives gone; overlay shows final score and level.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move paddle | Mouse / Left-Right Arrows / A-D |
| Launch ball | Left Click / Space |
| Fire laser | Z / Right Click (laser powerup active) |
| Pause | P |
| Restart | R |
| Menu | Escape |
| Mute | M |

---

## Progression / Difficulty

- Ball speed increases by 12 px/s per brick hit (capped at 800 px/s).
- On each new level, bricks are rebuilt identically but the ball launches at BALL_SPEED_INIT again (speed resets to allow continued play, difficulty comes from fewer lives).
- Future: introduce special bricks (indestructible, explosive, moving) in higher levels.

---

## UI / HUD

- **Score** — top-left, updates live with combo multiplier
- **Level** — top-center
- **Lives** — top-right (heart icons)
- **Combo counter** — center screen, fades after 1.5 s
- **Powerup status strip** — bottom center (shows active powerup names)
- **Pause / restart hints** — bottom-right

---

## Sound Design

All sounds use Web Audio API — no file assets required.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Splash → game | Sine blip |
| Paddle Hit | Ball hits paddle | Square sweep 180→280 Hz |
| Brick Hit | Ball hits armored brick | Sawtooth crack |
| Brick Destroy | Brick reaches 0 HP | Square pop + noise burst |
| Wall Bounce | Ball hits wall | Square ping 240 Hz |
| Ball Lost | Ball exits bottom | Sawtooth downward sweep |
| Powerup Collect | Capsule caught | Ascending sine arpeggio |
| Combo Jingle | Every 4 combo hits | Sine sweep 880→1320 Hz |
| Level Complete | All bricks cleared | 5-note ascending fanfare |
| Game Over | All lives gone | Long sawtooth fall + noise |
| Laser | Laser fires | Sawtooth sweep 1200→200 Hz |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, main
- [x] SplashScene with perspective grid and animated deco bricks
- [x] GameScene: paddle, ball, brick grid, collision, particles
- [x] Powerup system: wide, slow, multiball, laser
- [x] Combo multiplier scoring
- [x] UIScene: HUD, game-over overlay, level-complete banner
- [ ] Verify in browser — check ball collision edge cases

### Phase 2 — Polish
- [ ] Smooth brick flash on hit (tween alpha/scale)
- [ ] Animated synthwave background (scrolling grid lines)
- [ ] Ball spin effect (rotation based on vx)
- [ ] Moving bricks on higher levels
- [ ] High score persistence (localStorage)

### Phase 3 — Content
- [ ] Special brick types: indestructible (metal), explosive (chain), mystery (?)
- [ ] Boss level every 5 levels (giant brick formation with HP bar)
- [ ] Level editor / seed-based layouts

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | UIScene |
| `livesChanged` | newLives | state | UIScene |
| `gameOver` | — | state | GameScene, UIScene |
| `levelComplete` | — | GameScene | GameScene, UIScene |
| `brickDestroyed` | x, y, color | GameScene | UIScene (combo) |
| `ballLost` | — | state | (future: events) |
| `powerupCollected` | type | GameScene | UIScene |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Phaser.Game init, scene boot |
| `config.js` | Constants and definitions |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (score, lives, combo, powerups) |
| `sounds.js` | Web Audio API sound effects |
| `SplashScene.js` | Title screen with perspective grid |
| `GameScene.js` | Ball, paddle, bricks, particles, powerups |
| `UIScene.js` | HUD overlay scene (runs in parallel) |

---

## Open Questions

- [ ] Should ball speed reset between levels or continue escalating?
- [ ] Add a "lives" bonus brick (rare drop: +1 life)?
- [ ] High score saved to localStorage or server?
- [ ] Touch / mobile support (touch drag for paddle)?

---

## Changelog

### Phase 1 — Scaffold (2026-04-14)
- Initial scaffold: all 8 files created
- Full gameplay loop implemented: bricks, ball, paddle, particles, powerups, combo
