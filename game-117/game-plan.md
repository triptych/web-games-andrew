# PERIHELION

**Genre:** Twin-stick shooter / maze crawler on spherical worlds
**Engine:** three.js r165, no asset files
**Status:** v1.0.0

---

## Concept

A twin-stick shooter where your player stays centred on the screen while the tiny asteroid you are standing on rotates beneath you. Each asteroid is wrapped in a maze; you navigate it, take out the turrets (beacons) and the machines they launch, and step through a black monolith gate to the next one.

The tone is the grand, quiet space films of the late 1960s: clean white station architecture, red lenses that watch you, black slabs that hold stars, harsh sunlight with pitch-black shadows, a ringed gas giant hanging in the sky, a calm mission computer, a waltz on the title and unresolved choral clusters while you work. It riffs on twin-stick arena shooters (Robotron, Geometry Wars) and the "tiny planet" levels of 3D platformers, but the maze wraps all the way round: walk in a straight line and you come back to where you started.

## Core loop

One asteroid:

1. **Intro** (2.5 s): an intertitle card (ASTEROID IV · METIS · *The Watchers*), letterbox bars, a line from MERIDIAN. You can already walk and shoot; nothing else moves.
2. **Hunt**: follow the red edge arrows (the shortest great-circle direction to each live beacon) through the maze. A beacon that sees you sounds its alarm and launches its hangar; machines keep coming out of live beacons' hangars on a timer, up to the asteroid's cap.
3. **Silence** every beacon. The gate (a black monolith sunk into the rock at the cell farthest from the landing pad) rises on a column of pale light and the arrows turn blue.
4. **Gate**: walk into it. Bonus for time under par and remaining suit, then the slit-scan star gate, and the next asteroid.

Eight asteroids, each bigger (radius 11 → 18) with a finer maze (4 → 8 cells a cube face). The eighth hides the Monolith, shielded by four pylons; bring the pylons down, then the Monolith, and the last gate opens onto the sun. Three lives (five on Cadet); dying puts you back on the landing pad with the asteroid as you left it.

## Mechanics

### The sphere
- Every position is a unit vector; world distances are the arc times the asteroid's radius R. Movement walks along a great circle (`walk(p, d, angle)`).
- The player carries a **frame**: a unit tangent `f` that is "screen up". Every step parallel-transports `f` (and the aim and the dash heading) along the walk, so pushing up always walks up the screen, and walking straight round the rock comes home with the same heading (tested).
- Input is in screen terms: move `{x, y}`, aim `{ax, ay}` (y down), `fire` held, `dash` edge. The sim turns them into tangents with `right = f × p` and `f`.

### The maze (`js/sim/world.js`)
- An **equiangular cube-sphere** grid: 6 faces × N × N cells, all close to the same size. Neighbours are found by stepping one cell past each edge and looking the point up again, which works across face seams and at the cube's corners (each cell still has four distinct, symmetric neighbours; tested on 320 asteroids).
- A perfect maze by depth-first carving from the cell at the north pole, then **braiding** (each remaining wall knocked out with the row's `braid` chance) for loops to circle and flank through, then **clearings** (every edge opened within grid distance 1) round the start, each beacon and the gate (distance 2 for the boss).
- The gate is the cell farthest from the start through the maze; beacons are placed by farthest-point sampling at least 3 cells of maze and 3 cells of grid from the start. A layout that fails the checks after its clearings is rejected and the next sub-seed tried, so one seed is always one asteroid.
- Every closed edge is a **wall**: a great-circle arc between two grid corners, half-thickness 0.32. Collision is the chord distance from a point to the arc (its projection onto the arc's great circle, or the nearer end), pushing out along the tangent. Each cell keeps the walls of itself and its neighbours, which is every wall an entity inside it could touch.
- Line of sight samples the great circle every 0.4 units against those lists.

### The commander
| | |
|---|---|
| Speed | 6.4 /s |
| Suit | 100; bolts 14, pods 16, darts 10, shards 18, the Monolith 15 by contact |
| Hit grace | 0.7 s after a hit, 2.5 s after a respawn |
| Dash | 0.2 s at 3× speed, untouchable, 0.85 s cooldown |
| Gun | 9 shots/s, 30 /s, 0.72 s range; power 2 fires a pair, power 3 a spread of three |

### Beacons
Fixed in their clearing; they see you within 14 units with line of sight (checked every 0.15 s), turn to you at 2.6 rad/s and fire when within 0.3 rad. **Gun**: single bolts; **burst**: three; **ring**: ten bolts round the compass, turning a little each time. From asteroid III they lead their shots at where you are walking. First sight sounds the alarm: two machines out of the hangar at once. HP 40 + 6 per asteroid. A beacon's death always drops a repair, power or crystal.

### Machines
| Kind | HP | Speed | Behaviour |
|---|---|---|---|
| Pod (drone) | 3 | 4.0 | Sees you: straight at you. Otherwise follows the BFS flow field from your cell through the maze (doorway, then the next cell's middle) when within 10 cells. Rams. |
| Dart (seeker) | 2 | 5.8 | As the pod, weaving; launched in pairs. |
| Slab-shard | 10 | 2.4 | Keeps 5–8 units off and circles; fires a three-bolt spread every 2 s. |

They push apart, collide with walls and beacons, and come only from live beacons' hangars (spawn timer per asteroid, capped). 16% drop something: repair (+25 suit), power (+1 gun, or score at max), crystal (+500).

### The Monolith (asteroid VIII)
At the gate cell in a large clearing, radius 1.7. While any pylon stands its shield turns every bullet (`deflect`). It cycles: a ring of 12–16 bolts, an aimed five-bolt fan, a ring again, two darts. 260 HP. When it falls the gate opens where it stood.

### Score
Pod 100, dart 60, shard 250, beacon 1000, pylon 1500, Monolith 10 000, crystal 500, gate 2000 + 10 a second under a 150 s par + 10 a point of suit left.

## Story

MERIDIAN, the ship's computer, talks you down onto each rock. The signal you were sent to find comes from a lattice of machines on the irregular moons of a ringed gas giant; every gate points further in, toward the sun. Each asteroid has a name (Jovian moons: Himalia, Thebe, Adrastea, Metis, Leda, Elara, Carme, Sinope) and a title card. The end: "The last gate opens onto the sun itself, and the signal falls silent." The game ends there; play again for score.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Walk | WASD | Left stick / d-pad | Drag on the left half |
| Aim + fire | Mouse + hold button, or arrows / IJKL | Right stick (fires past half-way), RT/RB | Drag on the right half |
| Dash | Space / Shift / right click | A / LB / LT | DASH |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Camera**: in the commander's transported frame, 12–26 units out at a 0.55 rad tilt, backing off for narrow (portrait) screens; eased a little. The title pulls right back and circles the rock with the gas giant behind it while the bot plays a silent demo.
- **Ground**: a 96-segment sphere whose standard material reads a **regolith baked per asteroid into a cube map** (1024² per face on High): three scales of analytic craters (bowl, sharp raised rim, height and gradient from a 2×2×2 cell search) and fbm albedo; the bumped object-space normal in rgb and the albedo in alpha. Live on top: fine grit, the landing pad's survey rings and spokes, the commander's lamp, the gate's glow.
- **Walls**: one merged mesh per asteroid of curved, sphere-hugging slabs (all faces wound counter-clockwise from outside; checked numerically) with panel seams, a dark plinth and a lit strip; posts at every corner with a red marker lamp.
- **Sky**: one shader on a dome centred on the camera: three star layers with colour temperature, a dusty galactic band with lanes, the sun's disc and corona, and the gas giant ray-traced as a sphere (bands from turbulent latitude, a great storm, terminator, limb glow) with a ring that passes in front and takes the planet's shadow.
- **Lights**: hard sun with a shadow map that follows the commander, a warm fill from the gas giant, almost no ambient. Explosion flashes are additive glows, not point lights.
- **Post**: bloom (threshold 1.35: only emitters glow), then a film pass: cool shadows and warm highlights, grain, vignette, edge fringing, impact flashes, a red edge when hurt, letterbox bars for the cards, and the **slit-scan star gate**: two perspective planes of streaming colour, then a second pair turned 90°, faded over the scene during the warp.
- **Sound**: an original waltz in D on the title (strings, harp, pizzicato bass) and the win; a drifting cluster of gliding sine voices with a sub drone on the asteroids, darker on the last; a rising cluster through the gate; the commander's breathing, quicker when hurt; every effect synthesised; a hall reverb from a noise impulse.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title demo, play, over), the fixed-step loop, input routing, debug hooks |
| `js/sim/vec.js` | Sphere maths: walk, turn, transport, toward |
| `js/sim/world.js` | Cube-sphere grid, maze, walls, collision, line of sight, BFS |
| `js/sim/game.js` | Rules: player, bolts, beacons, machines, boss, pickups, phases, saves |
| `js/sim/data.js` | The eight asteroids and MERIDIAN's briefings |
| `js/sim/bot.js` | The auto-player |
| `js/view/view.js` | Camera, sync of models to the sim, event effects, pointer aim |
| `js/view/stage.js` | Renderer, bloom, film and star-gate pass |
| `js/view/asteroid.js` | Regolith bake, ground, walls and posts |
| `js/view/sky.js`, `models.js`, `fx.js`, `glsl.js` | Sky, models, bolts and particles, shared GLSL |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | DOM, twin-stick input, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the grid on 320 asteroids, 28 rules, determinism and save round trips, and has the bot play whole campaigns at two skills. `browsertest.mjs` drives the real game on desktop (real keys and mouse), touch-only phones in both orientations and with storage blocked.

## Balance notes

- First pass: the perfect bot won every campaign untouched and a 0.4-skill bot never died. The beacons barely fired: the bot killed them in a couple of seconds. Beacon HP went 16 → 40 (+6 per asteroid), fire rates up, bolts faster (8.5 → 10.5) and harder (10 → 14), the first-sight alarm launch was added, beacons lead their shots from asteroid III, repairs got smaller and rarer.
- Now (6 seeds): the perfect bot wins all 6 campaigns with about 1.5 deaths, in about 7 minutes; the 0.6 bot never wins and gets to asteroid V or VI (5.8 on average). Humans don't path-find perfectly, so Cadet exists (60% damage, five lives).

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. The High setting has only been judged from screenshots.
- A map view of the whole rock (an orbital overview) would help on the bigger asteroids.
- More beacon kinds (a mortar arcing over walls; a shield projector).

## Changelog

### v1.0.0 (2026-11-05)
- First release: eight asteroids with cube-sphere mazes, parallel-transported twin-stick controls, three beacon kinds and three machines, the Monolith boss, pickups, dash, lives and Cadet difficulty; baked regolith, shader sky and gas giant, film grade and slit-scan star gate; waltz, cluster score and breathing; Node and browser harnesses.
