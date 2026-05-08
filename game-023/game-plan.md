# Synthwave Invaders

**Genre:** Arcade Shooter
**Engine:** Three.js (ES module via importmap CDN)
**Target Resolution:** 1280 × 720 (responsive)
**Status:** Phase 1 — Complete

---

## Concept

2D pixel-art Space Invaders played on a flat 3D plane with a full synthwave retro aesthetic. The invader formation advances toward you in 3D space — classic pixel sprites rendered as textured planes flying across a neon grid, retrowave sunset, and star field.

The camera looks slightly downward at a perspective grid that recedes to a hot-pink horizon sun. Invaders march side-to-side AND advance toward the player, creating mounting tension as they close the gap. Each cleared wave sends a faster, more aggressive formation.

---

## Core Mechanics

### 1. Formation Advance
The 5×11 invader grid advances forward along the Z axis every frame, getting faster each wave. If it reaches the player's Z plane, game over.

### 2. Player Movement + Shooting
Move left/right (arrow keys or WASD). Hold or tap Space to fire. Single-bullet cooldown prevents spam.

### 3. Enemy Shooting
Random bottom-most invader in a random column fires downward on a randomized timer. Intervals shrink as wave count rises.

### 4. Hit Detection
AABB collision: player bullets vs invader planes, enemy bullets vs player plane.

### 5. Synthwave Aesthetic
Three.js scene with: convergent neon grid, layered star field, retro retrowave sun with horizontal stripe cutouts, pixel-art canvas-texture sprites with glow, CSS HUD with magenta/cyan neon text.

---

## Game Loop

1. Splash screen → any key → start Wave 1
2. Invaders advance; player shoots them down
3. Clear all invaders → "Wave Cleared" → next wave (faster)
4. Take a hit → lose a life → 2 seconds invincibility
5. Lives reach 0 OR formation reaches player → Game Over
6. Game Over → any key → restart from Wave 1

---

## Player Controls

| Action       | Key(s)                  |
|--------------|-------------------------|
| Move Left    | Arrow Left / A          |
| Move Right   | Arrow Right / D         |
| Fire         | Space                   |
| Start / Retry | Any key (title screen) |

---

## Progression / Difficulty

- Each wave increases formation advance speed by +0.4 units/sec
- Formation starting Z moves 1.5 units further back per wave (player gets slightly less time)
- Invader wobble amplitude increases subtly each wave

---

## UI / HUD

- Top-left: SCORE (6-digit, magenta neon)
- Top-center: WAVE (cyan neon)
- Top-right: LIVES (heart icons, magenta)
- Center overlay: Title / Wave Cleared / Game Over messages

---

## Sound Design (Web Audio API)

| Sound        | Trigger              | Style                         |
|--------------|----------------------|-------------------------------|
| playShoot    | Player fires         | Square wave sweep 800→200Hz   |
| playInvaderHit | Invader destroyed  | Sawtooth sweep + noise burst  |
| playPlayerHit | Player takes damage | Low sawtooth sweep + noise    |
| playExplosion | Game over explosion | White noise + low sweep       |
| playGameOver  | Lives = 0           | Descending sawtooth chord     |
| playWaveClear | All invaders killed | Ascending sine arpeggio       |

---

## Phases

### Phase 1 — Full Implementation (2026-05-06)
- [x] Three.js scene: perspective grid, stars, retrowave sun
- [x] Pixel-art canvas-texture sprites (octopus, crab, squid types)
- [x] Formation advance + side wobble
- [x] Player movement, shoot, invincibility blink
- [x] Enemy random shooting (bottom-row logic)
- [x] AABB hit detection for both bullet types
- [x] Wave progression with speed scaling
- [x] Particle explosions
- [x] Web Audio sound effects
- [x] CSS neon HUD + overlay messages

### Phase 2 — Polish (Future)
- [ ] Shields / bunkers (destructible cover)
- [ ] Mystery UFO across the top for bonus points
- [ ] High score persistence (localStorage)
- [ ] Mobile touch controls
- [ ] More invader types / boss wave

---

## Module Overview

| File          | Responsibility                                 |
|---------------|------------------------------------------------|
| `main.js`     | Game loop, state machine, collision, DOM wiring |
| `scene.js`    | Three.js renderer, camera, grid, stars, sun    |
| `invaders.js` | Formation logic, sprites, enemy bullets        |
| `player.js`   | Player mesh, input, player bullets             |
| `effects.js`  | Particle explosions                            |
| `sounds.js`   | Web Audio API procedural SFX                   |
| `config.js`   | All tunable constants                          |

---

## Changelog

### Phase 1 — Full Implementation (2026-05-06)
- Complete working Space Invaders with synthwave Three.js scene
