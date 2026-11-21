# VACANCY

**Genre:** First-person walking simulator: exploration, decay and liminal space, with a light lock-and-key mystery
**Engine:** three.js r165 (WebGL2), sim/view layout. Surfaces, portraits and key art by fal; the vehicles by Meshy; every other model, prop, light and sound is code
**Status:** v1.1.0

---

## Concept

You wake on a rotting mattress in a house in the middle of Ashmere. Nothing makes a sound. The town is empty: cars where they stopped, doors open, kettles on hobs, a VACANCY sign still lit over the Starlite Hotel. On the nightstand are a flashlight and a brass compass whose needle points not north but at *the next thing you need to find*.

On the fourteenth of October, at 3:33 a.m., the Threshold Resonance Laboratory opened a fold into the space next to ours: the Between, endless yellow rooms. Everyone in Ashmere who was awake walked into it. You were asleep. The citizens left diaries; read in order they tell the weeks of the hum, the corridors that got longer at night, the guest book filling with names, the night itself. The tools you need (a crowbar, bolt cutters, a staff badge) lie where their owners dropped them, and each diary keeps one piece of the code that reverses the fold: three resonance dials and the order of four coloured conduits. Dr. Marrow's diary, always the last, has his keycard.

No enemies, no timer, no death. The point is to walk: to stand in a three-storey mall with a tree through its floor and a skylight full of cloud, to climb a hospital stairwell by flashlight, to get lost on a yellow office floor that never quite makes rooms, to fall through a rotten floor into the flat below and laugh about it. The compass makes the story finishable in an evening; the city (about 450 buildings and 0.22 km² of floor) takes many hours to see.

It riffs on the backrooms, *Gone Home*, *Dear Esther* and the abandoned-mall photography genre.

## Core loop

Read the compass → walk across town → find the building → find the stairs → find the diary (it glows faintly) → read it → take the tool beside it if there is one → the compass turns to the next. Along the way: notes, newspapers, payphones and radios with fragments of what happened; vending machines that still drop cans; locked doors that will open later.

## Mechanics

### The walker
- Walk 3.1 m/s, run 5.6 m/s; mouse or right-thumb look, arrow keys turn; collision against walls, doorframes (1.15 m gaps), furniture, cars, trees and fences.
- Stairs: switchback stairwells. Walking off the top of a run puts you on the next level; stepping off a landing onto the top of the run below takes you down. The top of a run is a wall from the level below.
- Holes: stand over a rotten-floor hole and you fall one storey and land on the rubble. Nothing hurts you.

### Using things (E / Space / USE)
The best-scored thing within 1.9 m and 60° of your view: diaries, tools, notes, newspaper boxes, payphones, radios, vending machines, locked doors, the breaker, the dials, the conduit levers, the master switch.

### Locks
| Lock | Opened by | Where |
|---|---|---|
| Boarded door | Crowbar | houses, shops, some offices, the substation |
| Chain | Bolt cutters | warehouses, factories, the mall, **the lab gate** |
| Card reader | Staff badge | offices, the hospital, the school, the library |
| Threshold security | Director's keycard | Hall C |

A building's lock covers all its outside doors; some tall buildings also lock their stairwell on the ground floor.

### The portal
In Hall C: the breaker needs the fuse (diary 9). With power, each dial turns 1→9; the four conduit levers (each a colour, positions seeded) must be thrown in the seeded order, and a wrong lever resets them all. The master switch opens the ring only with all three dials right and all four conduits live.

## Content

### The city ([js/sim/city.js](js/sim/city.js))
11×11 blocks of 25×25 two-metre tiles, five-tile streets (sidewalk, three lanes, sidewalk), a street around the edge that runs off into the fog. Districts by distance from the centre: downtown (office towers, the mall, the Starlite Hotel, WKVR and the police, the car park), a mixed ring (apartments, shopping streets, parks, the hospital, the school, the library), residential outskirts (house lots with yards and picket fences), an industrial side (factories, warehouses, yards) and the 2×2-block Threshold compound (Hall C, the lab building, the substation, cooling towers, a chained gate).

### Interiors ([js/sim/interior.js](js/sim/interior.js))
| Type | Floors | Layout |
|---|---|---|
| house | 1–2 | BSP rooms (living, kitchen, bedrooms, bath) |
| apartment | 3–5 | corridor, flats either side |
| office | 3–7 | lobby, then open plan with cubicles **or backrooms** (yellow wall runs, pillars, damp carpet) |
| hotel | 4–6 | lobby, then corridors of rooms |
| mall | 3 | shop units with glass fronts round a ring walkway; a railed atrium with fountain and a tree; skylight |
| hospital | 4–5 | double corridor with a cross corridor; wards |
| school, library, lab | 2–3 | classrooms; stacks with a mezzanine; labs |
| factory, warehouse | 1–2 | hall with machines or racks, office strip, mezzanine |
| garage | 3–4 | pillars and parked cars; open roof |
| hall | 1 (10 m) | Hall C: the ring, the console, the breaker room |

Decay per building: mould, puddles, rubble, debris, sagging floors, missing ceiling tiles, broken interior walls, broken windows with leaves blown in, holes through floors (only where the hole can't cut its floor in two), and the odd tree grown up through a house.

### The cast ([js/sim/data/citizens.js](js/sim/data/citizens.js))
Fifteen citizens (a seamstress, a watchmaker, a lab technician, the lab's night janitor, a radio host, a nurse, a mall guard, a factory foreman, a hotel clerk, a boy of eleven, a bus driver, a librarian, a police officer, a waitress, a skateboarder, a car-park attendant) plus Dr. Elias Marrow. Each seed picks nine, in story (`chrono`) order, then Marrow.

## Story chain ([js/sim/story.js](js/sim/story.js))
- Home: a two-storey house near the centre; you wake beside the bed.
- Tools: a seeded order of crowbar, bolt cutters, staff badge, lying with diaries 3, 5 and 7. Diaries 1–3 are in unlocked buildings; any later diary's building is locked (70%) only with a tool already found.
- Diary 9 has the fuse; diary 10 (Marrow) the keycard. Then the gate (bolt cutters), Hall C (keycard), the breaker (fuse), the console.
- Seven clue pieces (3 dials, 4 conduit positions) go to seven of the nine citizens' diaries, worded from templates.

## State, input, events

- **G**: `seed`, `t`, `p` (x, z, y, level, yaw, falling), `got` (ids), `items`, `open` (lock ids), `visited`, `read` (diary indices in the order read), `dials`, `levers`, `power`, `portal`, `won`, `cans`, `falls`. The city and story are rebuilt from the seed (`attach`), so a save is ~600 bytes.
- **Input**: `{ x, y, turn, dyaw, run, a }`.
- **Events**: `wake`, `step` (surface), `level`, `enter`, `fall`, `land`, `diary`, `item`, `fragment`, `radio`, `vend`, `unlock`, `locked`, `msg`, `power`, `dial`, `lever`, `leverReset`, `fail`, `portal`, `won`.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Walk | WASD / ↑↓ | left stick | drag on the left |
| Look | mouse (click to capture), ← → | right stick | drag on the right |
| Run | Shift | RB / RT | RUN |
| Use | E / Space | A | USE |
| Flashlight | F | X | 🔦 |
| Journal / Map | J / M | Y / Select | 📖 / 🗺️ |
| Pause | Esc / P | Start | ❚❚ |

## Look and sound

- **Light**: a low blue-hour moon with shadows through every window, a hemisphere that nearly dies indoors, the flashlight (with its own shadow), and a pool of 4–8 point lights lent to the nearest lit fluorescent panels (yellow in the backrooms), street lamps, the neon and diaries (a faint warm glow so they can be found). Tubes flicker; some fittings hang by a chain.
- **Post**: sanitize → bloom → ACES → grade (grain, vignette, radial chromatic aberration, teal shadows, sick-yellow highlights, a slow warp near the open ring, white-out at the end).
- **Streaming**: the city a block at a time within ~230 m, interiors a building level at a time (all levels of the one you are in, the ground floor of everything within 46 m). Window panes carry their building and level; a shader shows dark dirty glass until that level exists, then clear glass (or nothing, if broken).
- **fal art**: see [dev/art/README.md](dev/art/README.md).
- **Meshy vehicles**: see [dev/meshy/README.md](dev/meshy/README.md). Loaded at boot (`js/view/vehicles.js`); the first city waits up to 8 s for them.
- **Sound**: Web Audio only: wind and room tone, the low hum, fluorescent buzz, footsteps for carpet, wood, tile, concrete, grass, road and puddles, a sparse detuned pad with the odd bell, effects for every event.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, loading, intro, play, over), fixed-step loop, input routing, pointer lock, debug hooks |
| `js/sim/city.js` | The city layout, districts, unique buildings, the lab compound, streets and props |
| `js/sim/interior.js` | Interiors per building: layouts, stairwells, furniture, decay, connectivity repair, holes, things |
| `js/sim/world.js` | One walkable grid: lookups, `moves()`, collision, stairs, holes, A* |
| `js/sim/story.js` | Cast, locks, diary placement, tools, the start, the portal code and clues |
| `js/sim/game.js` | `newGame`, `step`, `interact`, `objective` (the compass), save |
| `js/sim/bot.js` | The auto-player |
| `js/view/` | `stage` (renderer, lights, post), `citymesh`, `interiormesh`, `props`, `kit` (geometry), `tex` (fal textures), `fx`, `view` (streaming, lights, things) |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/save.js` | DOM, input merge, sound, guarded storage |

## Testing

See [dev/README.md](dev/README.md). The bot finishes every seed tried in 14–17 minutes of game time walking 3.5–4.3 km (it beelines on the compass and never looks around).

## Open questions / next steps

- A human pass on real hardware: everything has run only under SwiftShader. Phone performance is unknown; Automatic quality picks Low on touch devices.
- WebGL2, not WebGPU: three r165's WebGPU renderer can't run the custom post chain or the pane shader, and the test harness's headless Chromium has no WebGPU. The look is built to move over when the repo moves to a newer three.
- More of the Between: a playable yellow-rooms level behind the mall's service door.

## Changelog

### v1.1.0 (2026-11-21)
- The vehicles are Meshy models: seven text-to-3D vehicles (sedan, hatchback, wagon, pickup, van, box truck, city bus), abandoned and weathered, drawn instanced per block with faded tints and flat-tyre sags; the code-built ones stay as the fallback ([dev/meshy/README.md](dev/meshy/README.md)).

### v1.0.0 (2026-11-21)
- First release: the seeded city and every interior, decay, the story chain of ten diaries, tools and locks, the portal console, the compass, journal and map, fal surfaces and portraits, Web Audio sound, the bot, the sim and browser tests.
