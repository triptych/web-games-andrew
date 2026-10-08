# PHOSPHOR PATROL

**Genre:** Arcade: side-scrolling planet-defence shooter (Defender), with Asteroids meteor storms and Galaga dart squadrons
**Engine:** three.js r165 (ES modules, import map), Web Audio
**Render:** a vector monitor. Every object is a list of glowing beam segments drawn by one instanced shader, with phosphor persistence, bloom and a curved-glass pass
**Target:** a 4:3 monitor (400 × 300 logical units) fitted into any window; keyboard, gamepad or a touch control deck
**Status:** v1.0.0: fifteen attack waves per loop, three bosses, endless loops

---

## Concept

It is 1982 and the colony world **LUMEN** is being harvested. The **Reapers**, a machine swarm, drop out of the sky to snatch the planet's colonists and carry them off, and every colonist they reach the top of the sky with becomes another of them. You fly the **SENTRY**, a lone patrol fighter, around and around a planet eight screens wide that wraps at its ends. Shoot the snatchers, catch the colonists as they fall, and set them down safely. Lose every colonist and the planet explodes, and you fight on in the empty dark until it can be rebuilt.

It should feel like a vector cabinet in a dark arcade: sharp lines of light with hot white cores, trails smearing behind fast objects, explosions that fling the very lines a thing was drawn with at the glass, a long-range scanner across the top of the screen, a thump-thump heartbeat that speeds up as the wave goes on, and three-letter initials on the high-score table.

No image or audio files. Every shape, letter, explosion, star and sound is generated in code.

---

## The look

- **Everything is a beam.** The renderer draws one thing: a line segment of light with a width, colour and brightness. One `InstancedBufferGeometry` with a segment per instance (both endpoints in 3D, colour, width) is expanded to a quad in the vertex shader and shaded in the fragment shader with a gaussian beam profile: a white-hot core fading through the colour into a soft halo. A segment of zero length is a round dot. Additive blending, so crossing lines get brighter, the way a vector CRT does.
- **Phosphor persistence.** Each frame is blended over a decayed copy of the last one, so moving lines leave short trails and explosions smear. Bloom (bright pass, two blur sizes) makes the screen glow. The final pass bends the image onto curved glass, darkens the corners, adds a faint reflection, beam flicker and colour flashes on big events. No scanlines: vector monitors don't have them. CRT FX can be switched off.
- **Real 3D where it counts.** The camera is a narrow-FOV perspective camera far back, so the z = 0 plane maps 1:1 onto the 400 × 300 grid, but anything with depth is really 3D: hives and meteors are tumbling wireframe polyhedra, the bosses are rotating wireframe machines, and explosion fragments fly toward the glass and grow.
- **The planet.** A ground line with a jagged mountain range drawn over it in two parallax layers; stars at three depths. When the planet dies, the mountains break apart into drifting lines.
- **Vector font and HUD.** All text is a stroke font (each letter a few line segments on a 4 × 6 grid), drawn with the same beams, so the HUD and menus glow and trail like everything else. The only DOM is the cabinet around the monitor: side panels on wide desktops, a control deck on phones, and the back link.
- **Readable at a glance.** The SENTRY is white and cyan. Enemy shots are small flickering plus-shaped sparks in hot colours; mines are magenta stars. Colonists are little green stick figures. Each enemy type has its own colour.

---

## Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Thrust left / right (turns the ship) | ← → / A D | stick left / right | left stick / d-pad |
| Climb / dive | ↑ ↓ / W S | stick up / down | left stick / d-pad |
| Fire laser (hold to auto-fire) | Space / Z / J | FIRE | A |
| Smart bomb | X / B / K | BOMB | B |
| Hyperspace | H / C / Shift / L | HYPER | X / Y |
| Pause | P / Esc | ❚❚ | Start |
| Mute | M | in the pause menu | |
| Start / confirm | Enter / Space | tap | A / Start |

Pressing the opposite direction turns the ship around instantly and brakes, as in the original; holding a direction thrusts. Tapping fire is faster than holding it.

On a portrait phone the monitor sits at the top and the control deck fills the space underneath: a stick on the left, FIRE, BOMB and HYPER on the right. On a landscape phone the stick and buttons sit either side of the monitor.

---

## Core mechanics

### The world
- 3 200 units around (eight screens). Everything wraps horizontally: the camera, enemies, shots and the scanner all see the world as a cylinder.
- The playfield runs from the ground (y 22) to the top of the sky (y 246). Above it is the HUD band: score, ships, smart bombs and the **scanner**.
- **The scanner** shows the whole planet at 1/16 scale: terrain, colonists, every enemy as a coloured dot, your ship, and brackets marking what's on screen. An abduction in progress flashes its dot.

### The SENTRY
- Horizontal flight has inertia: thrust accelerates to a top speed, and drag slows you when you let go. Vertical movement is direct.
- The camera leads the way you are facing, so you see more of what's ahead.
- **Laser:** a long horizontal streak that grows out of the nose at high speed. It kills the first thing it touches. Up to four on screen.
- **Smart bomb:** destroys every enemy, shot and mine on screen. Start with three; hold up to nine.
- **Hyperspace:** jump to a random spot on the planet. Brief invulnerability on arrival; a short cooldown.
- Extra ship and smart bomb every 10 000 points.
- You die by touching an enemy, a shot, a mine or a meteor. After a death the area around you is cleared and you get a moment of invulnerability.

### Colonists
- Ten colonists walk the ground at the start. They carry over from wave to wave.
- A **snatcher** that reaches a colonist grabs them and slowly lifts them up, with an alarm. If it reaches the top of the sky the colonist is lost and the snatcher becomes a **ravager**.
- Shoot a snatcher that is carrying someone and the colonist falls. **Catch** them in the air (500) and fly them down to the ground (500 more). A colonist who falls from low enough lands safely (250); from higher up, they don't survive.
- Lose every colonist and **the planet explodes**: every snatcher becomes a ravager and the waves continue in open space. The planet is rebuilt, with ten new colonists, after each boss.
- Wave bonus: 100 × the wave number (up to ×5) for each colonist alive.

### Enemies
| Enemy | Points | Behaviour |
|---|---|---|
| SNATCHER | 150 | warps in high, drifts down to the colonists, grabs one and climbs. Shoots aimed shots |
| RAVAGER | 150 | what a snatcher becomes. Fast, erratic, hunts you and shoots often |
| MINELAYER | 250 | cruises across the sky on a wave, sowing mines that hang in the air for a few seconds |
| MINE | 25 | a magenta star; touching it kills you |
| HIVE | 1 000 | a slow tumbling wireframe pod. Shoot it and it bursts into a swarm of stingers |
| STINGER | 150 | small, fast, flock at you, overshoot and swing back, shoot forward |
| HUNTER | 200 | appears when a wave drags on: matches your speed, closes in and fires constantly |
| DART | 100 (200 diving) | Galaga-style squadrons that loop in from the top of the sky, hold formation above you and peel off to dive. Destroy the whole squadron for 1 000 |
| METEOR | 20 / 50 / 100 | Asteroids-style: big tumbling rocks split into two medium, then two small. A meteor that hits the ground kills any colonists nearby |

Enemies warp in over a short shimmer (harmless until solid), in batches through the wave. A wave is cleared when every enemy in it has been destroyed (hunters leave when the wave ends).

### Bosses
Every fifth wave is a boss. Bosses follow you around the planet so the fight stays on screen, and show a health bar.

| Wave | Boss | Fight |
|---|---|---|
| 5 | **THE HARVESTER** | A great saucer of rings, rotating in 3D. Eight armour pods ride its rim; shoot them off to expose the core underneath. It drops a tractor beam onto the colonists, launches snatchers, and fires rings of shots. Phase 2 (half health): it spins and moves faster, fires denser rings and adds aimed triple shots. Shooting it four times while it lifts a colonist breaks the beam and drops them |
| 10 | **THE LEVIATHAN** | A segmented serpent that coils through the sky after you. Each segment takes several hits and shoots back; the head can only be hurt once the body is short. Phase 2: it speeds up and sprays from its tail |
| 15 | **THE OVERSEER** | A giant wireframe eye inside a turning cage of shield plates that block your lasers. The eye opens to fire a telegraphed sweeping beam and spirals of shots; it can only be hurt while open. It calls hunters. Phase 2: two beams |

### Waves (one loop)
| Wave | Name | Contents |
|---|---|---|
| 1 | FIRST CONTACT | snatchers |
| 2 | MINEFIELD | snatchers, minelayers |
| 3 | THE HIVE | snatchers, minelayers, a hive, a dart squadron |
| 4 | METEOR STORM | meteors, snatchers, a hive |
| 5 | **THE HARVESTER** | boss |
| 6 | DEEP RAID | more of everything |
| 7 | DARTS | four dart squadrons, snatchers |
| 8 | STONE RAIN | a heavy meteor storm, snatchers, minelayers |
| 9 | SIEGE | snatchers, hives, minelayers, squadrons |
| 10 | **THE LEVIATHAN** | boss |
| 11 | ONSLAUGHT | more of everything |
| 12 | FIRESTORM | meteors and squadrons |
| 13 | THE SWARM | six hives |
| 14 | LAST STAND | everything at once |
| 15 | **THE OVERSEER** | boss |

After the Overseer: an ending, then **LOOP 2** with faster, more aggressive enemies and more of them. The loop shows on the HUD.

### Difficulty
- **CADET**: 5 ships, slower enemies and shots, fewer shots, hunters arrive later.
- **ARCADE**: 3 ships, the real thing.
- Continues are unlimited: CONTINUE? counts down from 9; the score keeps going and continues used show on the high-score table.

---

## Juice
- Explosions throw the destroyed shape's own line segments outward, spinning, toward the glass, plus sparks and an expanding ring. Big kills get screen shake, hit-stop and a colour flash.
- Lasers cycle colour along their length and fade at the tail. The ship's exhaust flickers when thrusting.
- Vector score popups, banners (ATTACK WAVE 3, PLANET LOST!, WARNING!!, EXTRA SHIP!), and an end-of-wave tally that counts the colonists one by one.

---

## Attract mode and screens
Title (the logo draws itself stroke by stroke over the scrolling planet) → THE REAPERS (each enemy with its name and points, animated) → HOW TO PLAY → HIGH SCORES → DEMO PLAY (the bot plays an early wave) → title… Press start: a coin drop, then a vector menu (START, MODE, START WAVE once reached, SOUND, MUSIC, CRT FX). Pause has RESUME / SOUND / MUSIC / CRT FX / QUIT. Game over → CONTINUE? 9…0 → initials if you made the table → high scores.

---

## Sound (Web Audio, all generated)
- **Heartbeat:** two alternating low thumps, like a certain asteroid game, that speed up the longer the wave goes on and the fewer enemies are left. Bosses have a driving sawtooth track; the title and the ending have their own tunes.
- **Effects:** laser zap (descending saw with a noise click), enemy shot, explosions (filtered noise with a pitch drop, sized), smart bomb (sub boom + white flash noise), hyperspace (rising sweep), thrust (a looped noise rumble that follows the stick), abduction alarm, colonist scream as they fall, catch and set-down chimes, extra ship jingle, warp-in shimmer, mine drop, hive burst, boss hits, boss death, planet explosion, dart dive whistles, the boss siren, coin, menu blips, high-score fanfare.
- A compressor and per-sound rate limits keep a smart bomb from clipping.

---

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | boot, fixed 120 Hz sim loop, the mode machine (attract, menu, play, pause, continue, initials, ending), debug hooks |
| `js/config.js` | world size, tunables, scores, difficulty tables |
| `js/rng.js` | seeded PRNG (mulberry32) |
| `js/sim/world.js` | the game: ship, lasers, enemies, colonists, shots, mines, meteors, bosses, scoring, waves. Pure: no three.js, no DOM. Emits events for the view and audio |
| `js/sim/enemies.js` | per-type enemy behaviour |
| `js/sim/bosses.js` | the three bosses |
| `js/sim/waves.js` | the wave table and loop scaling |
| `js/sim/terrain.js` | the planet's mountain profile (deterministic) |
| `js/sim/util.js` | wrap-around maths for the cylindrical world |
| `js/sim/bot.js` | the AI pilot for demo mode and tests |
| `js/art/shapes.js` | every vector shape: ship, enemies, colonists, 3D wireframes |
| `js/art/font.js` | the stroke font |
| `js/view/beams.js` | the beam shader and the per-frame segment buffer |
| `js/view/renderer.js` | three.js renderer, persistence, bloom, glass pass, shake, flashes |
| `js/view/view.js` | sim → beams: camera, stars, terrain, entities, lasers |
| `js/view/fx.js` | explosion fragments, sparks, rings |
| `js/view/hud.js` | scores, scanner, banners, popups, every menu screen |
| `js/audio.js` | synthesis, effects, heartbeat and music |
| `js/input.js` | keyboard, touch deck, gamepad merged into one input frame |
| `js/ui.js` | DOM layout: fitting the monitor, side panels, touch deck |
| `js/save.js` | high scores and settings in localStorage (guarded) |

## Testing
See [dev/README.md](dev/README.md). `simtest.mjs` has the bot play every wave of two loops headlessly in Node, then a full loop in one session, and checks invariants and the core rules (planet death and rebuild, rescue scoring, meteor splits, smart bombs). `browsertest.mjs` drives the real game in Chromium on desktop (the whole flow, all 15 waves, the ending and loop 2) and on touch-only phones in both orientations. The repo-wide `dev/smoketest.mjs` passes with and without localStorage.

## Balance notes
Tuned against the bot, which fires about eleven shots a second and dodges well: it clears an arcade loop with a few continues, mostly spent on the bosses. Boss health was doubled after the first pass, when the bot took the Harvester down in five seconds on CADET. The Overseer's beam sweeps at 0.45 rad/s, slower than the ship can climb out of it at boss range.

## Open questions / next steps
- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- A two-player alternating mode (1UP / 2UP) would complete the cabinet.

## Art direction note
An homage to the genre, not a copy: the SENTRY, the Reapers, the bosses and the planet are original designs, and the rules borrow ideas (abduction and rescue, a wrapping planet, a scanner, splitting rocks, diving squadrons), not assets.

## Changelog

### v1.0.0 (2026-10-08)
- First release.
