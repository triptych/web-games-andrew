# Hard Hat Harbor

**Genre:** cozy construction driving game for children (no fail state)
**Engine:** three.js r165, sim/view layout. Models by Meshy, pictures by fal, music, effects and voices by ElevenLabs; code-built stand-ins and a Web Audio synth as fallbacks
**Status:** v1.0.0

---

## Concept

A toy box of eight construction vehicles and a small seaside town that needs fixing. The mayor and five townsfolk hand out ten jobs from a job board: patch the potholes, clear a rockslide, put a roof on the school, bridge the river, build a farm lane, knock down the old cannery, turn its lot into a park, build three houses, a playground, and finally a statue in the square. Every job is a few steps, each needing a particular vehicle, and every job changes the town for good.

It is made in the spirit of the construction-toy CD-ROM games of the 1990s: bright primary colours, chunky bevelled panels with hazard stripes, cartoon townsfolk who talk to you (voiced), a sticker of stars at the end of each job, and a certificate at the end. Nothing can go wrong. A slow job earns one star instead of three; that is the only penalty in the game.

## Core loop

1. Open the **job board** (J / 📋) and pick an open job. Its giver explains it, out loud, with the steps listed.
2. The clipboard at the top shows the step in hand and a progress bar; a yellow arrow floats over the truck and a beam of light marks where to go; the hint line says what to press. The vehicle the step needs pulses in the **toy box**.
3. Swap vehicle (1–8, Q/E, or a tap): the truck you are in turns into the other one on the spot, with a puff. Toy-box logic.
4. Do the work. Each finished step leaves something in the town.
5. The last step ends the job: fanfare, stars, a thank-you, and the jobs it unlocks appear on the board.
6. After the tenth job the mayor awards the Golden Hard Hat; the finished town can be driven around for as long as you like.

## State, input, events

**State `G`** (plain data, saved as JSON): `seed`, `rng` state, `t`, `rev` (bumps when the town changes), `veh`, `p {x, y, a, v}`, `cargo {dump, loader}` and `cargoJob`, `jobs {id: {st: locked|open|done, step, time, stars, prog}}`, `active`, `debris [{id, job, kind, x, y, r}]`, timers (`load`, `hookT`, `missCd`, `swing`, `tick`, `switchCd`, `honkCd`), `stars`, `finished`, `odo`.

**Input record** `{ x, y, a, h, veh, job }`: steer, throttle, action pressed (an edge), action held, a vehicle to climb into, a job to take. Everything the player can do is one of these, so the bot and the tests do it the same way.

**Events:** `switch`, `honk`, `bump`, `jobStart`, `loaded`, `dumped`, `rolled`, `cleared`, `scoop`, `drop`, `digTick`, `dug`, `pourTick`, `poured`, `placed`, `miss`, `swing`, `smash`, `collapse`, `stepDone`, `jobDone`, `unlock`, `allDone`.

## Mechanics

### Driving
Heading and speed. Throttle accelerates toward the vehicle's top speed (half of it in reverse); steering turns at the vehicle's rate. Tracked vehicles (bulldozer, excavator, wrecking crane) turn on the spot at full rate; wheeled ones keep 40% of their turn rate at a standstill, so nobody ever gets stuck needing a three-point turn. Every vehicle is the same 1.7 m circle to the world, so swapping never lands you in a wall. Buildings, trees, the river and debris are solid. The river can only be crossed on the bridge, once the bridge job is done.

### The eight kinds of work

| Kind | Vehicle | Rule |
|---|---|---|
| haul | Dump Truck | Park in the load zone (the quarry hopper) for 1.2 s to fill up; press at the site to tip. `n` loads. |
| roll | Road Roller | Drive over every 2 m cell of the patch. |
| push | Bulldozer | Debris appears around a point. The blade carries whatever is in front of it and centres it; a piece inside the striped zone is cleared. Any other vehicle is blocked by debris. |
| scoop | Loader Tractor | Driving the bucket into rubble or rocks picks up to three; press at the zone to tip them. Elsewhere the button tips one back out, so a bucket is never stuck full. A bucket never mixes two jobs' loads. Pieces shoved into the zone count too. |
| dig | Excavator | Park within 3.6 m of a spot and hold the button for 2.6 s. |
| pour | Cement Mixer | The same, 3 s. |
| lift | Crane Truck | Park at the site. The hook swings; press while it is over the mark (`|sin| < 0.3`, drawn as the green part of a meter) to place a piece. A miss costs half a second; a placed piece needs 1.3 s before the next. The hook speeds up a little with each piece. |
| wreck | Wrecking Crane | Park within 5.5 m of the wall and press: the ball lands 0.8 s later. `hp` hits bring the building down. |

Pressing the action button with nothing to do honks the horn.

**Nothing can be wedged.** Debris drifts until it is a metre clear of any wall, so a boulder shoved into a corner can always be got behind.

### Jobs and stars
A job is open once the jobs it needs are done. One job is in hand at a time; picking another keeps the first one's progress. Each job has a par time (only time with the job in hand counts, and the game stands still while anyone is talking): at or under par is three stars, under par × 1.6 two, otherwise one.

## Content

Ten jobs (`js/sim/data/jobs.js`), 26 steps, 30 stars:

| Job | Giver | Needs | Steps |
|---|---|---|---|
| Pothole Patrol | Mayor Maple | — | haul 1, roll |
| Rockslide! | Officer Dot | potholes | push 6 boulders |
| A Roof for the School | Ms. Finch | potholes | haul 1, lift 4 |
| Bridge the River | Mayor Maple | rocks, school | dig 2, pour 2, lift 4 |
| Farmer Gus Needs a Road | Farmer Gus | bridge | haul 2, roll, scoop 6 rocks |
| Knock Down the Old Cannery | Foreman Rosa | bridge | wreck 8, push 3 chunks, scoop 9 rubble |
| Sunny Park | Pip | cannery | dig 2, pour 1, lift 2 |
| New Homes on the East Bank | Foreman Rosa | bridge | dig 3, pour 3, lift 3 |
| The School Playground | Ms. Finch | school | dig 2, haul 1, lift 2 |
| The Golden Hard Hat | Mayor Maple | farm, park, homes, playground | haul 2, roll, pour 1, lift 3 |

The town (`js/sim/data/city.js`): 128 × 96 m, six roads, a river with one bridge site, 25 buildings (six kinds are Meshy models), 46 trees placed by hash, the quarry and the yard.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Drive / reverse | ↑ ↓ or W S | Stick, or RT / LT | Stick (left half) |
| Steer | ← → or A D | Stick / d-pad | Stick |
| Work / honk | Space (Z, X) | A | The red button |
| Swap vehicle | 1–8, Q / E | LB / RB | Tap the toy box |
| Job board | J | Y | 📋 |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Models (Meshy):** the eight vehicles and six buildings (town hall, school, cannery, barn, house, shop), each from a reference render in one "chunky die-cast toy" style. The moving parts are built in code so they can move: the load in the dump truck, the rocks in the bucket, the crane's cable, hook and beam, the wrecking ball and chain. See [dev/assets/README.md](dev/assets/README.md).
- **Pictures (fal):** six portraits, the title scene and the badge, in a 1990s CD-ROM cartoon style; the toy-box buttons are Meshy's own thumbnails of the models. See [dev/art/README.md](dev/art/README.md).
- **Sound (ElevenLabs):** a title theme and two work tunes that take turns, 18 effects, and 30 voice clips: every job's brief and thank-you, the welcome, the finale, and Foreman Rosa calling out each vehicle as you climb in. See [dev/audio/README.md](dev/audio/README.md).
- **In code:** the ground is one painted canvas texture (roads, kerbs, lots, the ploughed field); trees are two instanced meshes; effects are one pooled instanced mesh of little cubes.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, who talks when, debug hooks |
| `js/sim/game.js` | Pure rules: driving, collisions, the eight kinds of work, jobs and stars, `target()` (the hint and the bot's plan), save format |
| `js/sim/world.js` | What is solid right now; geometry helpers |
| `js/sim/nav.js` | A 2 m grid, A*, flood fill (the bot plans with it, the tests prove reachability with it) |
| `js/sim/bot.js` | An auto-player with a skill dial |
| `js/sim/data/` | The town and the jobs |
| `js/view/` | `view.js` (renderer, camera, events → effects), `town.js`, `vehicles.js`, `models.js`, `fx.js` |
| `js/ui.js` | DOM screens, HUD, toy box, job board, dialogue, `prompt()` |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (365 checks with 12 seeds) checks purity, the data, every rule, determinism and save round trips in the middle of each kind of work, proves the debris placement over 60 seeds and that every work point can be driven to (the east bank only with the bridge), and has the bot finish the whole game at three skills. `browsertest.mjs` drives the real page on desktop, two touch-only phones and with storage blocked.

## Balance notes

Par is about 1.8× the perfect bot's median time. Medians over 12 seeds:

| Job (par) | skill 1 | skill 0.6 | skill 0.2 |
|---|---|---|---|
| potholes (25) | 13 s | 18 s | 24 s |
| rocks (110) | 50 s | 68 s | 92 s |
| school (30) | 16 s | 21 s | 34 s |
| bridge (45) | 24 s | 29 s | 48 s |
| farm (95) | 53 s | 71 s | 106 s |
| cannery (90) | 51 s | 63 s | 85 s |
| park (35) | 19 s | 23 s | 31 s |
| homes (120) | 67 s | 86 s | 123 s |
| playground (60) | 33 s | 44 s | 59 s |
| square (70) | 42 s | 49 s | 74 s |
| whole game | 6.2 min | 7.9 min | 11.3 min |
| stars (of 30) | 30 | 30 | 24 |
| crane misses | 0 | 4 | 25 |

What the bot found:
- **The crane placed every beam in the same instant.** The first run finished "lift 4" in one step, because a press with the hook in the window was accepted every step. A placed piece now needs 1.3 s before the next (`placeCd`), and a test presses twice in a row to prove it.
- **Pushing is the hardest work, for the bot too.** The rockslide took the perfect bot 28 to 88 s across seeds while every other job varied by a few seconds, so its par is the most generous (110 s).
- **A statue appeared around the crane.** Finishing the last job put a building where the truck stood; the invariant check ("never inside a wall") caught it. The town now pushes the truck out whenever it changes.
- These times are a path-planning bot's. A child will be slower: the pars are a guess at "quick", not measured on people.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, SwiftShader is not a GPU, and nobody has listened to the audio or judged the voices' casting by ear.
- The Meshy models are static: wheels don't turn, the excavator's arm doesn't move (it bobs, with flying dirt).
- Ideas: a free-build sandbox after the finale, a second town, a co-driver mode where the bot drives and the child only presses the button.

## Changelog

### v1.0.0 (2026-11-13)
- First release: eight vehicles, ten jobs of eight kinds of work, the job board and voiced townsfolk, stars and the Golden Hard Hat, 14 Meshy models, fal portraits and title, ElevenLabs music, effects and voices, keyboard, gamepad and touch, saves.
