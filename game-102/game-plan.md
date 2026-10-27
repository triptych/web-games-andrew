# STARSLING

**Genre:** physics slingshot puzzle-arcade (Angry Birds in space)
**Engine:** three.js r165, no asset files
**Status:** v1.0.0, six sectors

---

## Concept

Fling asteroids at floating space stations and scrap every robot aboard. A retro-futurist
sunset: a striped sun on a neon grid, dark metal station parts with glowing edges, wireframe rock,
synthwave bass. It riffs on Angry Birds (a sling, a few shots per level, fragile structures with
fragile occupants, specials you trigger mid-flight) and on 80s sci-fi poster art.

You pull the sling back and let go; physics does the rest. Hull is tough, glass is fragile, fuel cells
blow up, black holes bend your shots. The skill is in picking what to hit: a robot behind two
pillars is easier to topple than to shoot.

## Core loop

A **sector** is one station and 4–5 asteroids. Aim, fire, optionally use the asteroid's special, wait
for the wreckage to settle, repeat. The sector is won the moment the last robot is scrapped (after a
short beat, so the collapse can finish), lost when the asteroids run out with robots left. Stars and
score are kept per sector; clearing a sector opens the next.

## Mechanics

### Aiming and firing
- State machine in `G.state`: `ready → flight → settle → ready | lost`, with `clear → won` once no
  robot is left. Only `ready` takes aim and a fire; only `flight` takes a special.
- `G.aim = { angle, power }`. angle is radians above +x, limited to `[-0.25, 1.5]`; power is 0..1 of
  `SLING.vmax` (27 u/s). A pointer pull sets both absolutely (angle from the sling to the finger,
  power = pull distance / `maxPull`); the keys nudge them.
- A fire with power below `minPower` (0.18) is ignored, so a stray tap never wastes an asteroid.
- Launch is from the sling anchor, with velocity `(cos, sin) · power · vmax`.

### Asteroids
| Type | Look | Mass | Punch | Tap in flight |
|---|---|---|---|---|
| Rock | amber | medium | ×1.0 | **Burn**: +9 u/s along its heading |
| Iron | steel blue | very heavy, small | ×1.5 | **Dive**: kills sideways speed, drops at 26 u/s |
| Ice | cyan | light, large | ×0.8 | **Split** into three that fan out |
| Nova | red, pulses | medium | ×1.0 | **Detonate** (radius 3.4); or goes off by itself 1 s after it lands |

A special works once per asteroid. A flight ends when every asteroid out has landed and been slow for
a second, left the world, or 9 s have passed.

### Physics (`js/sim/physics.js`)
2D rigid bodies, boxes and circles. Box-box contacts by separating axis and edge clipping
(Box2D-lite's scheme), circle-box and circle-circle contacts directly. Sequential impulses, 10
iterations, warm-started from the previous step's impulses (kept in `G.cache`, so a save restores the
solver exactly), friction, a little restitution, `GRAVITY = 14`.

**Sleeping.** Every piece starts asleep, which is why a freshly built sector never sags. A body
sleeps after 0.6 s below 0.15 u/s; it wakes when something moving touches it, when a neighbour is
destroyed within 3 u, or when an explosion reaches it. A sleeping body counts as static for that
step. The sim test also forces everything awake and checks the stacks still hold, because the real
game wakes them in the middle of a collapse.

**Black holes** (`G.wells`) pull only asteroids, with a softened inverse-square force.
`predict()` includes them, so the dotted path bends too.

### Damage
A contact counts as an impact when the bodies approach faster than 2 u/s. For each body the damage is

```
(speed · ½(m_reduced + m_other) · punch_other − thr) · k
```

with `thr` and `k` from `MATS`. The mean of the reduced mass and the other body's mass is deliberate: a
heavy rock should shatter a light pane even though the pane barely slows it, which the reduced mass
alone gets wrong. A static partner counts as the body's own mass. `hp ≤ 0` destroys the piece: it
scores its value, wakes its neighbours, and a fuel cell explodes.

Pieces that leave the world (the void below the islands, far left or right) are destroyed and counted
as `fall` events. Robots that fall into the void count as scrapped.

### Scoring and stars
Each piece and robot has a value in `MATS`. When the last robot falls, every unused asteroid is worth
`SCORE.spare` (500). Stars: 1 for a win, a second at 70% of the sector's total value, a third at
100%. The best score and stars per sector are saved; a sector opens once the one before it is cleared.

## Content

### Materials (`js/config.js`)
| Material | Role | hp | Notes |
|---|---|---|---|
| Hull | pillars, beams | 120 | takes a pounding; toppled rather than broken |
| Glass | upper floors, panes | 16 | shatters on a rock hit |
| Crate | cargo | 32 | |
| Fuel | reactors | 14 | explodes: radius 2.8, power 11 |
| Robot | the targets | 14 | 0.9 × 1.1; dies to a heavy hit or a fall of about 5+ units |

### Sectors (`js/sim/levels.js`)
Built by a small generator (`station()`): floors of pillars and beams, every block snapped to its
support, robots in bays or on roofs.

| # | Name | Ammo | Idea |
|---|---|---|---|
| 1 | First Contact | 4 rock | A hut and a crate tower. Teaches aim and the burn. |
| 2 | Glass House | rock, ice, rock, rock | Two floors; glass upper levels. Ice splits over the roof. |
| 3 | Fuel Depot | iron, nova, rock, rock | A crate pyramid with fuel cells in the middle. |
| 4 | Event Horizon | iron, ice, rock, nova | A black hole bends every shot; tall thin towers. |
| 5 | Orbital Ring | iron, rock, nova, ice, rock | A long bridge on two towers; robots on it and under it. |
| 6 | Mothership | iron, nova, ice, rock, rock | Three floors, eight robots, a side tower, a black hole. |

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Aim | ↑ ↓ angle, ← → power | stick | Drag back from anywhere |
| Fire | Space / Z | A | Let go of the drag, or the FIRE button |
| Special | Space / Z in flight | A | Tap anywhere in flight, or the deck button |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

Palette: night `#12062e`, magenta `#ff2bd6`, cyan `#37e7ff`, amber `#ffb02e`. The backdrop is a
fragment shader (sky gradient, striped sun; the one `pow()` has a clamped base), 420 stars, a
wireframe ringed planet and a `GridHelper` that scrolls toward the camera. The islands are neon-edged
slabs over inverted faceted cones. Station parts are dark standard-material boxes with
`EdgesGeometry` outlines and a few front-face lines per material; robots are little boxy characters
with a pulsing visor that turns red as they take damage. Asteroids are jittered icosahedra with a
wireframe skin and an additive glow sprite. One `Points` object carries 700 additive particles.
Scanlines and a vignette are CSS. There is no bloom pass.

On a landscape screen the camera fits the whole field. On a narrow one it shows a 34-unit window and
pans: home on the sling while aiming, after the asteroid in flight, then on the robots.
`prefers-reduced-motion` switches off screen shake and the scrolling floor.

Sound is all Web Audio: a synthwave loop (saw bass and a triangle arpeggio, scheduled slightly ahead
of the clock), noise bursts for crunches and booms, blips for robots and menus.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, progress, debug hooks |
| `js/sim/physics.js` | Rigid bodies, contacts, solver, sleeping. Pure |
| `js/sim/game.js` | Rules: aiming, specials, damage, flow, win/lose, `predict()`, save |
| `js/sim/levels.js` | The six sectors and the station generator |
| `js/sim/bot.js` | The auto-player (ballistic search + rollouts on a copy of the game) |
| `js/view/view.js` | three.js: scene, sync from `G`, particles, camera pan |
| `js/ui.js` | DOM screens, HUD, floating score text, sector list |
| `js/input.js` | Keyboard, pad, mouse and touch → `{ adjA, adjP, aim, fire, act }` |
| `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound and music, guarded storage and progress, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the physics, the rules,
determinism and save round trips, and has bots play every sector. `browsertest.mjs` drives the real
game on desktop with a real mouse and keys, on touch-only phones in both orientations, and with
storage blocked.

## Balance notes

- The perfect bot (it tries about 27 candidate shots per turn on a copy of the game, with and without
  a tap) clears all six sectors in 1–2 shots with 3 stars. That is perfect play, not a target for
  people; it proves every sector is solvable and that the stars are reachable.
- A mortal bot (one of the eight closest-passing shots, a wobble in the aim, no specials) wins 80–90%
  of rounds. Sectors 1, 3 and 5 are easy for it, sectors 2 and 6 are not.
- First pass was far too easy: a one-shot win on sectors 2 and 3, because fuel chains killed the whole
  pyramid. The fix was sturdier hull (34 → 120 hp), a smaller fuel explosion, and robots that die to
  heavy hits, not to settling.
- Settling jitter in a three-floor stack reaches about 1.5 u/s of approach speed, which the damage
  formula read as hits until the impact floor was raised to 2.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. Whether the
  sling feels right on a phone (pull length, the dotted path's length) is unknown.
- Sector 3 (Fuel Depot) is too easy: its fuel cells sit in the middle. Move them or add armour.
- More specials and ammo (a magnet, a bouncer), moving platforms, and a bonus sector with asteroids
  already in orbit.
- The stars only look at score. A par-shots star would reward the clean wins the bot finds.
- Camera pan on a narrow screen follows the lead asteroid but does not look ahead at the target.

## Changelog

### v1.0.0 (2026-10-27)
- First release: six sectors, four asteroid types with specials, rigid-body physics with sleeping and
  warm starting, black holes, destructible stations with fuel chain reactions, stars and progress
  saving, a retro-futurist look, synthwave music, mouse, touch, keyboard and gamepad controls.
