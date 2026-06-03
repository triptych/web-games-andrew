# Neon Vanguard

**Genre:** Top-down arcade shoot-'em-up (shmup)
**Engine:** three.js r165 (ES6 modules, via CDN import map)
**Target Resolution:** Fullscreen (responsive); gameplay framed by an overhead camera
**Status:** Phase 1 complete → Phase 2 (Combat)

---

## Concept

A top-down arcade shoot-'em-up rendered in Three.js with custom shaders. Blast through
endless waves of enemies that swarm in choreographed movement patterns, all wrapped in a
colorful neon-retro aesthetic.

The look leans hard into 80s neon: an animated scrolling grid floor, glowing emissive
ships, chromatic bullet trails, and particle bursts on every kill. It's rendered in real
3D — the camera sits high overhead so it *plays* like a flat-plane shmup, but shaders,
emissive glow, and depth-based fog give it a richness 2D sprites can't. The target
experience is fast, juicy, and escalating: easy to read, hard to survive.

---

## Core Mechanics

### 1. Player Movement & Firing
Free 8-directional movement on the XZ plane (WASD / arrows). Auto-fire while holding
Space or the mouse button, with a short cooldown. The ship stays inside the field bounds.

### 2. Enemy Movement Patterns
Enemies don't just fall — they execute named choreographies defined in `config.PATTERNS`:
- **Dive** — descend straight toward the player rows.
- **Sine** — weave horizontally while descending.
- **Orbit** — circle a point before breaking off.
- **Swoop** — arc in from a side edge.
Each wave mixes patterns; later waves layer them and speed them up.

### 3. Waves & Escalation
Discrete waves spawn a growing count of enemies (`WAVE_BASE_COUNT + wave * WAVE_COUNT_GROWTH`).
A short break between waves (`WAVE_BREAK`) plays a fanfare. There is no hard cap — "many
waves" means it runs until the player dies.

### 4. Shader-Driven Neon Visuals
A custom `ShaderMaterial` draws the animated grid floor (see `main.js`). Bullets, enemies,
and explosions use emissive materials and additive blending for the glow. This is the
game's signature and the scaffold ships with a working grid shader to build on.

### 5. Collisions & Scoring
Circle-vs-circle checks (cheap, top-down). Bullet → enemy = explosion + score. Enemy →
player = life lost + screen flash. Score scales with wave and enemy type.

---

## Game Loop

1. Splash screen with animated neon grid → any key / click starts.
2. Wave begins: enemies spawn off-screen and run their movement patterns.
3. Player dodges and fires; destroyed enemies award score and spawn particles.
4. Wave cleared → brief break + fanfare → next, larger wave.
5. Player loses a life on contact; at 0 lives → Game Over (wave + score shown).
6. R restarts, Escape returns to menu.

---

## Player Controls

| Action  | Key(s)              |
|---------|---------------------|
| Move    | WASD / Arrow keys   |
| Fire    | Space / Left Click  |
| Pause   | P                   |
| Restart | R (on game over)    |
| Menu    | Escape (on game over) |

---

## Progression / Difficulty

Difficulty rises per wave: more enemies, faster movement, more aggressive pattern mixes,
and (later phases) enemies that fire back. Score multipliers reward clearing waves
quickly. Possible future: mini-boss every Nth wave.

---

## UI / HUD

DOM overlay (`index.html` + `ui.js`) drawn over the WebGL canvas:
- **SCORE** — top-left
- **WAVE** — top-center (neon magenta)
- **LIVES** — top-right
- Center message panel for splash / game-over.

---

## Sound Design

Web Audio API — no file assets. All procedural (`sounds.js`).

| Sound       | Trigger            | Style                         |
|-------------|--------------------|-------------------------------|
| Shoot       | Player fires       | Short square down-sweep       |
| Explosion   | Enemy destroyed    | Saw sweep + noise burst       |
| Player Hit  | Player takes damage| Low saw sweep + noise         |
| Wave Start  | New wave begins    | 4-note triangle arpeggio      |
| UI Click    | Start / menu       | Short sine blip               |
| Game Over   | Lives reach 0      | Long descending saw + noise   |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, scene, ui, main
- [x] Animated neon grid backdrop (custom ShaderMaterial)
- [x] Player module: movement, bounds, firing, emissive ship mesh

### Phase 2 — Combat
- [ ] Bullet pool + bullet shader/trail
- [ ] Enemy module with pluggable movement patterns (dive/sine/orbit/swoop)
- [ ] Circle collision system + scoring
- [ ] Explosion particle bursts

### Phase 3 — Waves & Juice
- [ ] Wave spawner with growing counts and pattern mixes
- [ ] Screen flash / shake on hit, additive bloom-like glow tuning
- [ ] Enemy-fire and a mini-boss
- [ ] Audio polish and balance pass

---

## Event Catalog

| Event          | Payload   | Emitted by | Consumed by |
|----------------|-----------|------------|-------------|
| `scoreChanged` | newScore  | state      | ui          |
| `livesChanged` | newLives  | state      | ui          |
| `waveChanged`  | newWave   | state      | ui          |
| `gameOver`     | —         | state      | ui, main    |
| `playerFired`  | {x, z, dirX, dirZ} | player | bullets (Phase 2) |

---

## Module Overview

| File         | Responsibility                                            |
|--------------|-----------------------------------------------------------|
| `main.js`    | Game state machine, animate() loop, neon backdrop shader  |
| `scene.js`   | Renderer, scene, overhead camera, clock, fog, lights      |
| `config.js`  | Constants, palette, field bounds, pattern keys            |
| `events.js`  | EventBus singleton                                        |
| `state.js`   | GameState singleton (score / lives / wave)                |
| `sounds.js`  | Web Audio API sound effects                               |
| `ui.js`      | DOM HUD bindings and game-over overlay                    |
| `player.js`  | Player ship: movement, bounds, firing             |
| *(planned)* `bullets.js` | Bullet pool + update + collisions             |
| *(planned)* `enemies.js` | Enemy meshes + movement patterns              |
| *(planned)* `waves.js`   | Wave spawner / progression                    |

---

## Open Questions

- [ ] Lives-based or health-bar-based survival? (scaffold uses lives)
- [ ] Should bullets be a fixed pool or spawn/destroy per shot?
- [ ] Add post-processing bloom (UnrealBloomPass) or fake glow with emissive + additive?
- [ ] Power-ups (spread shot, shield, etc.) — Phase 3 or later?

---

## Changelog

### Phase 1 — Player (2026-06-03)
- Added `player.js`: emissive triangular ship, 8-directional WASD/arrow movement
  with normalized diagonals and field-bounds clamping
- Auto-fire on Space / left-click gated by `FIRE_COOLDOWN`; emits `playerFired`
  {x, z, dirX, dirZ} for the Phase 2 bullet system to consume
- Riding `PointLight` for neon glow; input cleared on window blur
- Wired into `main.js` (initPlayer / resetPlayer / updatePlayer)
- **Phase 1 complete.**

### Phase 1 — Scaffold (2026-06-03)
- Initial scaffold: index.html, config, events, state, sounds, scene, ui, main
- Added animated neon grid backdrop via custom ShaderMaterial
- Added `wave` to game state + `waveChanged` event + WAVE HUD slot
