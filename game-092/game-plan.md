# NEONFALL

**Genre:** Jungle platformer / run-and-explore, flip-screen
**Engine:** Vanilla JS: Canvas 2D at 320×180 through game-075's WebGL CRT, no asset files
**Status:** v1.0.0

---

## Concept

*Pitfall!* (Activision, 1982, Atari 2600) as an 80s synthwave coin-op. The original's rules are all here: a flip-screen jungle that is a ring of screens, a surface to run along and a tunnel under it that skips ahead, rolling logs, snakes, fire, tar, quicksand, crocodiles and vines to swing on, scorpions below, brick walls that make you go back up, treasure to find, three lives and twenty minutes. NEONFALL keeps those mechanics and re-dresses and tunes them: a striped sun over wireframe mountains and a neon grid, a pixel-puppet Harry with a scarf, afterimages, shake and hit-stop, a generated synthwave score, and a few modern kindnesses (coyote time, jump buffering, fairer hitboxes, extra lives).

Compared with game-075 CHROME CHALICE (the Atari *Adventure* remake): same sim/view layout, same WebGL CRT, same synth engine and song generator (copied, with this game's songs and sounds), and the same idea of a bot that plays the title screen's demo. Different: Adventure is a puzzle of locks, so 075 proves it solvable with a planner; Pitfall is a platformer of timing, so NEONFALL proves it passable by having the bot cross every screen both ways, and plays whole games to prove the loop closes.

## Introduction

Start Expedition does not start the game: it unrolls a scroll that gives the goal (24 treasures, 96 screens, 20 minutes, 3 lives), the controls (keys, and touch) and the four rules that matter (logs, vines, crocodiles, ladders). Begin has the focus, so Space or Enter starts it, and Esc goes back to the title. Continue and Play Again skip it.

## Core loop

Run along the jungle floor, clear what is in the way on each screen, find a treasure (a screen has at most one), and head for the next. Underground is faster (3 screens per tunnel screen) and safer from logs but has scorpions and walls. All 24 treasures before the clock ends wins; the score is the treasure, the streak and the time left.

## Mechanics

### The world
A ring of `N_SCREENS = 96`. Running off the right edge goes to screen i+1, the left edge to i−1, modulo 96. In a tunnel the same edges go to i±3 (96 = 3 × 32, so the tunnel lanes are rings of 32). The first and last 40 px of every surface screen (30 px of a tunnel) are free of hazards, and Harry is harmless for 0.35 s after a screen change. More than that, nothing rolling may meet him as he arrives: on every screen change (and respawn) the log clock is shifted (`G.logShift`) to a phase where no log comes within 46 px of him for the next 1.5 s whether he runs on or stands still (for 1.1 s if he stands), or of where he will be after the respawn's invulnerable time. If no phase is that clear on a crowded screen, the clearest is used.

### Harry
`RUN` 78 px/s. A jump rises 24 px and takes 0.6 s (so a running jump covers about 50 px). Air control only speeds him up to a run: a faster flight (off a vine) keeps its momentum. Coyote time 0.07 s and a 0.12 s jump buffer. Ladders: **Down** within 14 px of a hole climbs on, **Up** under the ladder in a tunnel; walking into a hole just drops him to the tunnel unhurt.

### Hazards (surface)
| Hazard | Rule |
|---|---|
| Rolling log | Rolls left at 46–60 px/s in groups of 1–3, 115–135 px apart. Hit: −50 points, a 0.55 s stumble, no life. Clear it with a jump (12 px tall). |
| Cobra, fire | Touching one costs a life. Cobras are 12 px tall, fire 12. |
| Small pit (34 px) | Tar or quicksand; jumpable. Falling in costs a life (`sink`). |
| Wide pit (100 px) | Tar or quicksand with a vine over its middle. Jump into the rope to grab it, jump again to let go; the release keeps the swing's speed. Falling in costs a life. |
| Water with 3 crocodiles | A 126 px pit; each crocodile's head is a floor while its jaws are shut. Jaws shut for 1.75 s (the last 0.3 s shows a warning) then open for 0.85 s, staggered 0.45–0.65 s along the row. Standing on or landing on an open mouth is fatal (`chomp`); the gaps are water (`drown`). |
| Ladder hole | 22 px wide in the middle of the screen. Cobras and fire keep 56 px away from it and pits 44, so a jump that clears one lands with room for the next. |

Pits are 2 px narrower than they look and hitboxes 1.5 px smaller than the sprites.

### Underground
Under every screen runs a tunnel 48 px high. Scorpions patrol it (touch = a life), jumped like anything else. A brick wall (x = 236) blocks the tunnel and only stands on a screen that has a ladder, to the left of the wall, so a wall never traps Harry: from either side there is a way up. In every lane there is a ladder at least every 8 screens.

### Treasure and score
24 treasures on distinct screens, one about every 4, a third of them in tunnels (always on a ladder screen, 60 px from the left). Kinds cycle money bag 2000, silver bar 3000, gold bar 4000, diamond ring 5000. The game starts at 2000 points (as the original did). Each treasure in a row without losing a life adds +25% to the next, to +100% (the streak). Every 6th treasure is an extra life (max 5). The last treasure wins and adds 5 points per second left.

### Lives, the clock, ending
3 lives; losing one respawns Harry at x = 24 on the same screen and layer with 1.6 s of invulnerability to everything but pits. Out of lives, or the 20 minute clock reaching zero, ends the game; the last treasure wins. At 2 minutes the music changes and a HURRY warning shows; the last minute pulses the screen red; the last 10 seconds tick.

## Content

| Screen kind | Share | Notes |
|---|---|---|
| clear, log1, log2, log3 | 29 / 89 | breathers and log runs |
| cobra (1 or 2), fire | 12 / 89 | a jump with a 0.2 s window |
| pit | 6 / 89 | one 34 px pit, or two |
| tarvine, sandvine | 16 / 89 | 100 px pit with a vine |
| croc | 8 / 89 | three crocodiles |
| ladder, ladderpits, ladderlog | 18 / 89 | a ladder hole alone, between two pits, or beside a log |
| plus a ladder added to 40% of clear, log, cobra, fire and pit screens | | |

No kind repeats on consecutive screens. Screen 0 is always clear.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Run | ← → / A D | Stick / d-pad | Drag on the left |
| Jump, let go of a vine | Space / Z / X / J / K | A / X | JUMP |
| Climb | ↑ ↓ / W S | Stick / d-pad up, down | Drag up, down |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

Palette: midnight indigo to a hot orange horizon, hot pink, cyan, sun yellow, acid green for leaf edges. A 320×180 canvas is drawn with `fillRect`, scanline discs and Bresenham lines (so pixels stay square), then shown through the WebGL CRT (phosphor persistence 0.5, bloom, barrel curvature 0.55, chromatic aberration that spikes on a hit, scanlines for 180 rows). The overmap is drawn in the picture at the upper right: a dial of the 96 screens (visited lit, treasures gold or pink, the player a pulsing block, the screen number and loot count in the middle, and the tunnel's lane lit orange underground). The overmap is drawn in the picture at the upper right: a dial of the 96 screens (visited lit, treasures gold or pink, the player a pulsing block, the screen number and loot count in the middle, and the tunnel's lane lit orange underground). Layers: sky, stars, striped sun, two mountain ranges (tiles, periodic in x), a neon grid floor, palm silhouettes, near trunks, canopy fringe, vine, the surface and its pits, the tunnel, hazards, treasure with a glow, Harry with a 1 px dark outline, particles, popups in game-075's pixel font. The layer Harry isn't in is dimmed. Parallax follows an unwrapped camera so the ring seam never jumps.

Juice, by event: jump (dust, stretch), land (dust, squash, ring), vine grab (ring, sparks, shake, cyan afterimages), log hit (wood chips, shake, aberration, hit-stop), death by kind (tar bubbles, water spray, a red bite ring, lightning for cobra/fire/scorpion), respawn (ring and sparks), treasure (34 sparks, two rings, a gold flash, a punch zoom, hit-stop, "+3000" and the streak), 1UP, HURRY. The **Calm visuals** setting (default on with `prefers-reduced-motion`) cuts shake to 30%, flashes to 35%, removes aberration and phosphor trails.

Sound is game-075's engine: a look-ahead sequencer, a sidechain "pump", a gated snare reverb and a dotted-eighth delay. `music.js` generates the bass, arpeggio, drums and lead of each of six songs from a key, tempo, chords and seed: *NEON CANOPY* (title), *DUSK SAFARI*, *VINE SWING* and *TEMPLE GRID* (jungle by thirds of the ring), *LAST LIGHT* (under 2 minutes), *GOLDEN HOUR* (win). A low-pass takes the mix to 650 Hz when Harry goes underground. Crickets and birds on the surface, drips below.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, hit-stop, input routing, music, debug hooks |
| `js/config.js` | Every number the sim, view and tests share |
| `js/sim/world.js` | `buildWorld(seed)`: the ring of screens, ladders, walls, scorpions, treasures; cached per seed |
| `js/sim/game.js` | `newGame`, `step`, `serialize`/`deserialize`, `cloneGame`; time-driven helpers (`logX`, `scorpPos`, `vineTheta`, `crocOpen`) |
| `js/sim/bot.js` | The look-ahead bot: `botInput`, `driveEdge` |
| `js/view/view.js` | Backdrop, screen, Harry, juice, the CRT or 2D present |
| `js/view/draw.js`, `fx.js`, `font.js`, `crt.js` | Pixel drawing, particles, pixel font (075), the CRT (075) |
| `js/ui.js`, `input.js`, `save.js` | DOM screens and HUD, keyboard/pad/touch, guarded storage |
| `js/audio.js`, `music.js` | The synth engine (075's) with NEONFALL sounds; the song generator (075's) and songs |

## The bot

`botInput(G, bot)` is called every step like the player's input. It picks the nearest treasure by ring distance (tunnel ones cost a little more) and drives toward it. To cross something it clones the game and plays candidate plans forward with the real `step()`: *run on*, or *run / stand, then jump at step j* for 28 values of j up to 3 s; after a jump it plays 14 steps past the landing so a landing on a hazard counts. It takes the plan that survives and loses the least time, and commits to it. On a vine it lets go when a ballistic estimate lands on solid ground beyond the pivot. A worse bot (skill < 1) jitters when it jumps.

Two things it found: with a 30-step tail after landing it rejected every jump over a cobra 30 px from a ladder hole (the run-on after landing fell down the hole), so the generator now keeps hazards 56 px from the ladder and the tail is 14; and logs rolling across the arrival edge hit it at step 0, which is why a screen change grants 0.35 s of grace.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule on a lab world, 60 generated worlds, determinism and save round trips, that the bot crosses all 96 screens both ways on 3 seeds without a hit (and the tunnels), and plays whole games at three skills. `browsertest.mjs` drives the real game on desktop, on touch-only phones in both orientations, and with storage blocked.

## Balance notes

6 seeds: the perfect bot wins all of them in about 7.3 minutes with a few log hits and 0.2 deaths; at skill 0.85 (±0.075 s of jump jitter) it collects 7 treasures before the three lives run out, at 0.7 about 3. That is the original's cruelty: windows of 0.2–0.3 s. The extra life every sixth treasure, the narrower hitboxes and coyote time are what make it a game a human can improve at. Humans haven't been measured.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Portrait phones get a 390 px wide picture; a landscape hint or a cropped, camera-following mode would be bigger.
- The crocodile cycle and the vine amplitude are the numbers most worth tuning with real players.

## Changelog

### v1.0.0 (2026-10-22)
- First release: the ring of 96 screens, every Pitfall hazard, tunnels and walls, 24 treasures, streaks, extra lives, a 20 minute clock; a look-ahead bot and title demo; pixel-puppet art, the WebGL CRT, juice, a generated synthwave score; keyboard, gamepad and touch; tests and harnesses.
