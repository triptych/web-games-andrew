# PINBREAK '86

**Genre:** Arcade — pinball × breakout synthesis
**Engine:** three.js r165 (ES modules via import map) + a pure-JS physics simulation
**Target Resolution:** any — the camera fits the table to landscape monitors and portrait phones
**Status:** Playable — v1.0

---

## Concept

A flashy synthwave pinball table whose upper half is a breakout brick wall. You
play it like pinball — plunger, flippers, pop bumpers, slingshots, nudging and
TILT — but the goal is breakout's: smash every brick to clear the wave.

The two genres meet in the middle. Bricks drop power-ups that fall down the
table, and you **catch them with the flippers**, which are the breakout paddle
in this synthesis. Explosive bricks set off chain reactions, a fireball
ploughs straight through the wall, and lasers fire from the flipper tips. The
table sits in a neon grid world under a striped retro sun, and nearly
everything that happens is dressed in sparks, shards, shockwaves, screen shake,
chromatic aberration, hit-stop and slow-motion.

---

## Core Mechanics

### 1. Pinball physics
A fixed **1/480 s** sub-stepped simulation (`js/sim/world.js`). Walls are
capsule segments; the outer boundary, funnels and slingshot faces are
**one-sided**, so a ball squeezed by a flipper is always pushed back into the
field and never out through the back of a wall. Flippers are tapered capsules
whose surface velocity at the contact point (ω × r) goes into the bounce, so
where the ball meets the flipper decides the shot. Pop bumpers and slingshots
kick to a minimum outgoing speed.

### 2. Breakout wall
Five layouts (Sunset Strip, Grid Runner, Space Invader, Neon Pyramid,
Heartbreaker), 40–59 bricks each, with 1–3 hit points (colour shows the
remaining HP; cracks spread as they weaken). After wave 5 the layouts repeat
one HP tougher. Bricks that would block the channel under the top arc are
dropped automatically, so the ball can always "break out" behind the wall.
Bricks that spawn on top of a ball in flight stay ghosts until it moves clear.

### 3. Special bricks
- **X — explosive.** Blows up after 90 ms, dealing 2 damage to every brick
  within 1.75 units and shoving nearby balls. Chains cascade.
- **P — power-up.** Always drops a pickup (plain bricks drop one 9% of the time).

### 4. Power-ups (catch them with a flipper, or scoop them with a ball)
| Pickup | Effect |
|---|---|
| MULTIBALL | Two more balls pour in from the channel under the top arc |
| FIREBALL | 10 s: balls pass straight through bricks, destroying them |
| LASERS | 12 s: each flip fires bolts from the flipper tips |
| SHIELD | 20 s: a bar across the drain bounces balls back up |
| WIDE FLIP | 15 s: longer flippers (breakout's paddle extend) |
| DOUBLE | 20 s: all scoring ×2 |

### 5. Combos
Each brick destroyed within 2.6 s of the last extends the chain; every four
bricks adds ×1 to the multiplier (max ×8). Brick sounds climb a pentatonic
scale with the chain, so you hear the combo building.

### 6. Pinball rules
Three balls, ball save for 8 s after each fresh launch, extra balls at 30k /
75k / 150k and every 100k after. Nudging kicks every ball, but three nudges in
quick succession **TILT** the table: the flippers die until the ball drains.

---

## Game Loop

Plunge → the ball rides the arc over the brick wall → keep it alive with the
flippers, bumpers and slings while chipping at the wall → catch power-ups →
clear every brick (WAVE CLEAR: bonus 2,500 × wave, fireworks, slow-motion) →
the next wall materialises while the ball is still in play. The game ends when
the last ball drains with no balls left.

The title screen runs an **attract-mode demo**: the same bot that the headless
test uses plays the table behind the logo.

---

## Player Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Left flipper | Z / ← / A / Left Shift | Hold the left half |
| Right flipper | / / → / D / Right Shift | Hold the right half |
| Plunger | Hold Space / ↓ / Enter, release to launch | Hold anywhere while a ball waits, lift to launch |
| Nudge | ↑ / N / W | — |
| Pause | P / Esc | ❚❚ button |
| Mute | M | ♪ button |

---

## Progression / Difficulty

Layouts cycle with +1 HP per loop (capped at 4). Tougher bricks need more hits,
which stretches each wave and puts more weight on combos and power-ups. Balance
was checked by bot: the bot averages ~4 minutes per game and clears 1–4 waves.

---

## UI / HUD

DOM over the WebGL canvas: score (counts up, bumps on big hits), wave number and
name with a bricks-remaining bar, ball icons, a combo meter with a chain timer,
power-up timers (blinking in their last 3 s), a BALL SAVE lamp, and a plunger
power meter. Big centre banners (WAVE CLEAR, MULTIBALL!, TILT, EXTRA BALL…)
glitch in with chromatic text shadows. Score popups float up in the 3D scene.

---

## Juice inventory

| Event | Reaction |
|---|---|
| Brick break | sparks, tumbling instanced shards in the brick's colour, shockwave ring, flare, surface light, pitched note, shake, aberration, FOV punch, score popup |
| Explosive | big orange burst, two rings, orange screen flash, hit-stop 70 ms, sub-bass boom |
| Bumper | cap flashes white, scale punch, ring, cyan sparks, the table grid lights up underneath |
| Every 10th chained brick | 60 ms hit-stop |
| Multiball / ball lost / wave clear | slow-motion (0.3–0.35×) |
| Fireball | orange ball, embers streaming off it, orange ribbon trail |
| Always | ribbon trails, ball under-glow on the grid, bloom, beat-synced sun / grid / sky pulses, scanlines, vignette |

A per-frame budget (260 sparks, 3 flares, 4 rings, 4 surface lights) keeps a
30-brick fireball run from turning into a white screen.

---

## Sound Design

All procedural Web Audio — see `js/sounds.js`.

| Sound | Trigger | Style |
|-------|---------|-------|
| Flip | flipper up | noise thud + square drop |
| Bumper | pop bumper | square blip rising a fifth, pitch per bumper |
| Brick break | brick destroyed | square + triangle note on a pentatonic scale indexed by the combo |
| Blast | explosive brick | filtered noise + 110→32 Hz sine |
| Launch | plunger | band-passed noise whoosh + saw sweep |
| Pickup | power-up caught | fast major arpeggio |
| Wave clear | wall cleared | seven-note chord run + noise swell |
| Tilt | TILT | two detuned saws buzzing |

**Music:** a look-ahead step sequencer at 112 BPM (Am–F–C–G). Layers follow
the action: pad + octave bass on the title, drums in play, an arpeggio at combo
×3 or multiball, lead stabs at ×5 or three balls. The bass and pad are ducked
on every kick (the synthwave "pump"), and the visuals pulse from the same clock.

---

## Phases

### Phase 1 — Simulation (done)
- [x] Table geometry, capsule walls, one-sided boundaries, flippers with surface velocity
- [x] Bricks, layouts, explosive chains, pickups, lasers, shield, multiball
- [x] Combos, ball save, extra balls, nudge/tilt, waves
- [x] Bot + headless test (`dev/simtest.mjs`)

### Phase 2 — Presentation (done)
- [x] Tilted table in a synthwave world (sky, stars, sun, mountains, grid floor)
- [x] Bloom + CRT post pass; aspect-fitting camera
- [x] Chrome balls with a neon env map, ribbon trails, shader bricks
- [x] Particle, shard, ring, flare and popup systems; the juice director

### Phase 3 — Game shell (done)
- [x] Title with attract mode, pause, game over, high score
- [x] Procedural SFX and adaptive music
- [x] Touch controls, adaptive quality, browser test (`dev/browsertest.mjs`)

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Boot, mode state machine, fixed-timestep loop, hit-stop / slow-mo |
| `config.js` | All tunables: table, physics, flippers, rules, colours, camera |
| `sim/world.js` | The whole simulation (pure JS, seeded, no DOM / three.js) |
| `sim/table.js` | Static table geometry shared by sim and view |
| `sim/levels.js` | Brick layouts |
| `sim/bot.js` | Autopilot for attract mode and tests |
| `sim/rng.js` | Seeded PRNG |
| `juice.js` | Maps every sim event to sound, particles, camera and HUD reactions |
| `view/scene.js` | Renderer, tilted table rig, camera fit, bloom + CRT pass, shake |
| `view/backdrop.js` | Sky, stars, sun, mountains, grid floor |
| `view/tableView.js` | Surface shader, rails, bumpers, slings, flippers, bricks, pickups, lasers |
| `view/balls.js` | Chrome balls, env map, trails, glow |
| `view/fx.js` | Pooled sparks, shards, rings, flares, popups |
| `view/lights.js` | Fake lights painted onto the table surface |
| `input.js` | Keyboard + multi-touch → input snapshot |
| `ui.js` | DOM HUD, banners, screens |
| `sounds.js` | SFX + sequenced music |
| `state.js` | High score and mute, persisted |

## Event Catalog (sim → juice)

`flip`, `flipHit`, `bumper`, `sling`, `wall`, `ballClack`, `brickHit`,
`brickBreak`, `blast`, `score`, `pickupSpawn`, `pickup`, `pickupLost`,
`ballSpawn`, `laser`, `laserHit`, `shieldHit`, `plungerPull`, `launch`,
`enterField`, `ballReady`, `ballSaved`, `drain`, `gameOver`, `waveClear`,
`waveStart`, `comboUp`, `comboEnd`, `extraBall`, `nudge`, `tilt`, `unstick`,
`powerEnd`.

---

## Testing

- `node game-045/dev/simtest.mjs` — the bot plays 12 seeded games (≈45 min of
  table time) and checks every sub-step: no NaN, no ball outside the table,
  no ball inside a live brick or bumper. Also enforces that `js/sim/` stays pure.
- `node game-045/dev/browsertest.mjs` — real Chromium + WebGL: title, plunge,
  play, explosive chain, every power-up, wave clear, pause, game over, and
  touch play at 390×844 and 844×390.

Bugs these caught before the game was ever opened by hand: a raised flipper
squeezing the ball through the funnel wall; the shield kicking a drained ball
up *under* a flipper and out of the table; multiball spawning balls inside
bricks; a new wave materialising bricks around a ball in flight; the bot
cradling two balls forever.

---

## Changelog

### v1.0 (2026-09-29)
- Initial release: simulation, presentation, game shell, tests.
