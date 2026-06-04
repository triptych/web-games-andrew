# Neon Vanguard

**Genre:** Top-down arcade shoot-'em-up (shmup)
**Engine:** three.js r165 (ES6 modules, via CDN import map)
**Target Resolution:** Fullscreen (responsive); gameplay framed by an overhead camera
**Status:** Phases 1–4 complete — enemy variety, power-ups, wave splash & pause added; balance tuning remains

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

### Phase 1 — Foundation ✅
- [x] Scaffold: index.html, config, events, state, sounds, scene, ui, main
- [x] Animated neon grid backdrop (custom ShaderMaterial)
- [x] Player module: movement, bounds, firing, emissive ship mesh

### Phase 2 — Combat ✅
- [x] Bullets: shared geometry/material, additive-blend glow, off-field culling (`bullets.js`)
- [x] Enemy module with all four pluggable movement patterns: dive/sine/orbit/swoop (`enemies.js`)
- [x] Circle (distance-squared) collision system + scoring, with post-hit invulnerability (`collisions.js`)
- [x] Explosion particle bursts via `THREE.Points` + additive blending (`explosions.js`)
- [x] Screen-flash juice on player hit (DOM `#flash` overlay, wired in `main.js`)
- [x] Placeholder spawner in `main.js` cycling all patterns on a timer (stand-in until Phase 3 `waves.js`)
- ~~Bullet shader/trail~~ — deferred; bullets currently use a plain additive `MeshBasicMaterial` sphere, no trail yet

### Phase 3 — Waves & Juice ✅
- [x] `waves.js` — real wave spawner: growing counts (`WAVE_BASE_COUNT + (wave-1) * WAVE_COUNT_GROWTH`),
      `WAVE_BREAK` pause + `playWaveStart()` fanfare, `nextWave()` progression. PREP→SPAWNING→ACTIVE→BREAK
      state machine; speed and spawn-interval ramp per wave; replaced the `main.js` placeholder spawner
- [x] Floating score popups on kill (`popups.js`) — glowing "+N" sprite that rises and fades
- [x] Bullet trail — additive vertex-faded comet tail behind each player shot, oriented along travel (`bullets.js`)
- [x] Screen shake on hit — camera jolt on `playerHit`, quadratic decay, layered over the red flash (`main.js`)
- [x] Bloom glow — `EffectComposer` + `UnrealBloomPass` in `scene.js`; `main.js` renders via `renderScene()`.
      Resolves the open question: real bloom on top of emissive materials, thresholded so only bright bits glow
- [x] Enemy fire — armed enemies (a wave-scaled fraction, from `ENEMY_FIRE_WAVE` on) shoot aimed
      shots at the player via `enemyBullets.js`; collisions damage the player
- [x] Mini-boss — every `BOSS_EVERY` waves: a large magenta icosahedron with scaling HP, heavy fire,
      a `playBossWarn()` cue, and a multi-burst death (`waves.js` / `enemies.js`)
- [x] Audio polish — wired `playGameOver()` to the `gameOver` event; added `playEnemyShoot` and
      `playBossWarn`; staggered enemy fire timers so waves don't volley in unison

### Phase 4 — Variety & Polish ✅
- [x] **Enemy variety** — four archetypes in `config.ENEMY_TYPES` (GRUNT diamond,
      DARTER fast tetrahedron, BRUTE 3-HP box, WEAVER cyan dodecahedron). Each is a
      distinct shape/color/stat profile; `enemies.js` caches one geometry+material
      per type and `waves.js` draws from a wave-scaled type pool (grunts only early,
      full bestiary by wave 6). Weavers prefer sine/orbit lanes
- [x] **Between-wave splash** (`waveBanner.js`) — a big "WAVE N" neon sprite sweeps
      in, holds, and fades at the top of every wave; boss waves add a red WARNING
      subtitle. Reuses the popups canvas-texture sprite pattern
- [x] **Power-ups** (`powerups.js`) — kills can drop SPREAD (triple-shot, timed),
      SHIELD (timed invulnerability), or LIFE (+1) pickups that drift toward the
      player; bosses shower guaranteed loot. Spread routed to `player.js`, shield to
      `collisions.js`, life straight to state. A `powerup` event drives a HUD toast
- [x] **Pause overlay** — P now shows a dim "PAUSED" wash (`#pause` in index.html)
      instead of silently freezing
- [ ] Balance pass on wave counts, fire fractions, boss HP, bloom strength (future)

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
| `player.js`  | Player ship: movement, bounds, firing                     |
| `bullets.js` | Player bullets: spawn on `playerFired`, comet trail, update + cull |
| `enemyBullets.js` | Enemy projectiles: aimed shots that damage the player |
| `enemies.js` | Enemy + mini-boss meshes, movement patterns, and firing   |
| `collisions.js` | Circle collisions: bullet→enemy (score) & enemy→player (life) |
| `explosions.js` | `THREE.Points` particle bursts on kills / hits         |
| `popups.js`  | Floating "+N" score sprites that rise and fade            |
| `waves.js`   | Wave spawner / progression state machine + type pools     |
| `waveBanner.js` | Between-wave "WAVE N" neon splash (boss = WARNING)      |
| `powerups.js`| Spread / shield / extra-life drops: spawn, drift, collect |

---

## Open Questions

- [x] Lives-based or health-bar-based survival? → **Lives** (3 lives, `STARTING_LIVES`), with a
      1.2s post-hit invulnerability window so a swarm can't drain all lives in one frame.
- [x] Should bullets be a fixed pool or spawn/destroy per shot? → **Spawn/destroy per shot**, but
      sharing one cached geometry + material across all bullets (only the `Mesh` wrappers churn).
      Same approach for enemies. Revisit pooling only if GC churn shows up in profiling.
- [x] Add post-processing bloom (UnrealBloomPass) or fake glow with emissive + additive? → **Real bloom.**
      `scene.js` runs an `EffectComposer` with `RenderPass` + `UnrealBloomPass` (strength/radius/threshold
      tunable at the top of the file), on top of the existing emissive materials.
- [ ] Power-ups (spread shot, shield, etc.) — Phase 3 or later?

---

## Changelog

### Phase 4 — Enemy variety, power-ups, wave splash, pause (2026-06-04)
- **Enemy variety** (`config.ENEMY_TYPES` + `enemies.js` + `waves.js`): added four
  archetypes — GRUNT (red octahedron), DARTER (fast amber tetrahedron, 1 HP),
  BRUTE (slow magenta box, 3 HP, big score), WEAVER (cyan dodecahedron, 2 HP).
  `spawnEnemy` now takes a `type` that supplies the mesh shape/color and multiplies
  hp/speed/radius/value; one geometry+material is cached per type. `waves.js` draws
  from a wave-scaled type pool (grunts only through wave 2; full set by wave 6) and
  steers weavers onto sine/orbit lanes. Kill explosions tint to the enemy's color
- **Between-wave splash** (`waveBanner.js`): a large "WAVE N" neon sprite fades in,
  holds (`WAVE_BANNER_TIME`), and fades out at the start of each wave; boss waves
  add a red "WARNING — BOSS" subtitle. Built on the popups canvas-sprite pattern;
  updates every frame so it animates over the brief spawn ramp
- **Power-ups** (`powerups.js`): some kills drop a glowing pickup (SPREAD / SHIELD /
  LIFE) that drifts down toward the player; a boss death showers `POWERUP_BOSS_DROPS`
  guaranteed drops. Collection emits a `powerup` event: SPREAD grants timed triple-shot
  in `player.js` (`grantSpread`), SHIELD grants timed invulnerability in `collisions.js`
  (tracked separately from hit i-frames), LIFE adds a life. HUD shows a brief toast
- **Pause overlay** (`index.html` + `ui.js`): P now shows a dim "PAUSED" wash with
  `showPause`/`hidePause`, instead of silently freezing the field
- **Phase 4 complete.** Remaining work is a numeric balance pass.

### Phase 3 — Enemy fire, mini-boss, bloom, trails, audio (2026-06-04)
- **Bullet trails** (`bullets.js`): each player shot now drags an additive comet
  tail — an elongated plane with a vertex-color gradient (bright at the head,
  fading to nothing at the tail), laid flat and yawed to point along travel.
  Trail is a child of the bullet mesh, so existing movement/cull/collision code
  is untouched
- **Enemy fire** (`enemyBullets.js` + `enemies.js`): a new danger-colored
  projectile module mirroring player bullets. Enemies carry `canFire`/`fireCd`
  state; `waves.js` arms a wave-scaled fraction (from `ENEMY_FIRE_WAVE` on) that
  loose aimed shots at the player's live position, with staggered initial timers.
  `collisions.js` tests enemy bullets vs. the player and shares one `_damagePlayer()`
  helper with body-contact damage
- **Mini-boss** (`enemies.js` + `waves.js`): every `BOSS_EVERY` waves a large
  magenta icosahedron spawns with scaling HP, heavy fire, a slow weaving descent,
  a `playBossWarn()` cue, and a multi-burst death. Bosses ignore body-contact
  death (only bullets whittle their HP)
- **Bloom** (`scene.js`): added an `EffectComposer` → `RenderPass` +
  `UnrealBloomPass` pipeline; `main.js` now renders through `renderScene()` and
  the composer is resized alongside the renderer. Resolves the bloom open question
- **Audio**: wired the long-dormant `playGameOver()` to the `gameOver` event;
  added `playEnemyShoot` (low harsh saw) and `playBossWarn` (ominous low notes)
- **Phase 3 complete.** Game is feature-complete; remaining work is tuning/optional polish

### Phase 3 — Camera shake (2026-06-03)
- Added a camera-shake juice effect in `main.js`: a `playerHit` kicks `_shake` to 1,
  which decays over ~0.25s; each frame the overhead camera is offset on the XZ plane
  by a random amount scaled by `shake²` (quadratic falloff for a smooth settle), then
  restored to `CAM_POS`. Layered on top of the existing red screen-flash. Reset on
  (re)start so the camera always begins centered

### Phase 3 — Wave system & score popups (2026-06-03)
- Added `waves.js`: a PREP→SPAWNING→ACTIVE→BREAK state machine. Each wave spawns
  `WAVE_BASE_COUNT + (wave-1)*WAVE_COUNT_GROWTH` enemies on a tightening interval,
  ramps descent speed per wave, and draws from a growing pattern pool (early waves
  use dive/sine; wave 3+ adds orbit/swoop). When the field clears it pauses
  `WAVE_BREAK`, calls `state.nextWave()`, and plays the `playWaveStart()` fanfare
- Removed the Phase 2 placeholder spawner from `main.js`; wired init/reset/update
  for waves into the same lifecycle hooks
- Added `popups.js`: floating gold "+N" score sprite at each kill that rises and
  fades over ~1s (canvas-texture sprite; glow padded so it isn't clipped). Wired
  into the `collisions.js` kill path so the number matches the score awarded

### Phase 2 — Combat (2026-06-03)
- Added `bullets.js`: bullets spawn on the `playerFired` event, share one cached
  sphere geometry + additive `MeshBasicMaterial`, travel by velocity, and cull off-field
- Added `enemies.js`: octahedron enemies with all four pattern functions
  (dive/sine/orbit/swoop), per-pattern spawn defaults, cosmetic spin, HP, and off-field culling
- Added `collisions.js`: distance-squared circle checks — bullet→enemy consumes the bullet
  and (on HP 0) explodes + scores `value * wave`; enemy→player loses a life, emits `playerHit`,
  and starts a 1.2s invulnerability window
- Added `explosions.js`: short-lived `THREE.Points` bursts (18 sparks, additive, fade-out, drag),
  geometry/material disposed per burst
- Wired all four into `main.js` init/reset/update; added a screen-flash overlay on `playerHit`
  and a placeholder timer-based spawner cycling every pattern (Phase 3 `waves.js` will replace it)
- **Phase 2 complete.** Bullet trail/shader and bloom tuning deferred to Phase 3.

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
