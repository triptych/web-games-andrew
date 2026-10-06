# TOOTLE ISLES — design notes

**Genre:** Cozy sandbox / toy train set
**Engine:** three.js r165 (ES modules, import map), no asset files
**Status:** v1.0.0, complete

A cozy toy-train sandbox in the spirit of LEGO Loco, for kids and anyone who likes model railways. Pick an island, lay track across it, build a little town, design your own trains and watch them run. Nothing is locked, nothing can go wrong and there is no score: trains never crash, people never get hurt, and every tap does something friendly.

The look is a toy on a table: a studded baseplate, chunky plastic bricks with studs on the roofs, minifig-style people with smiley faces, puffs of steam like cotton wool, and a tilt-shift blur so the island reads as a diorama.

## The loop

1. **Choose an island.** Eight presets (Sunny Cove, Pine Peaks, Twin Isles, Coral Ring, Blossom Bay, Maple Hollow, Snowdrop Isle, Big Baseplate), each reshaped by a seed you can reroll, with a live map preview. Optionally start with a little town: a loop of track round the biggest clear rectangle near the middle, a two-tile station, homes and shops on a path, and a train already running.
2. **Lay track** by dragging. Straights, curves, crossings and switches come from the shape you draw. Track over water is a bridge; track through a hill is a tunnel.
3. **Put a train on** from the Train Shed, or make a new one in the **Workshop**.
4. **Build** homes, shops, a fun fair, farms, nature, decorations and boats. Every home brings residents who walk around, wait at stations and ride the trains.
5. **Play**: tap trains (toot, speed, stop, turn round, ride along), people (they wave and say hello), animals (baa, moo, quack), windmills (they whirl), switches (the points change).

Everything saves by itself. Islands live in **My Islands** (as many as you like, with thumbnails, copy, rename, delete and share codes); train sets live in the **Train Shed**, shared by every island.

## Architecture

```
js/config.js        grid size, terrain types, speeds, the toy-brick palette
js/rng.js           seeded RNG and value noise (no Math.random anywhere in the sim)
js/sim/             pure simulation — no three.js, no DOM
  grid.js           edges, the six track segments, traversal geometry (points + tangents)
  catalog.js        80 placeable items with footprints, placement rules and residents
  trainsets.js      5 engines, 11 car types, default sets, name generators
  world.js          one island: terrain, track, switches, stations, objects, strokes, undo snapshots, save
  trains.js         trains on the track: routing, look-ahead braking, stations, blocking, reversing, poses
  people.js         residents: spawning from homes, BFS walks, waiting, boarding, alighting
  islands.js        the eight presets, the seeded generator and the starter town
  stickers.js       20 stickers (celebrations, not locks)
js/view/            three.js
  stage.js          renderer, camera rig, sky dome, time of day, tilt-shift post, quality tiers
  materials.js      the shared toy material (vertex colours + per-vertex night glow), stud normal map
  builder.js        a tiny modelling kit: primitives merged into one geometry with colour and glow
  models.js         every catalog item, plus the moving parts (sails, wheel, carousel, balloon)
  trainmodels.js    engines and cars in the player's colours
  ground.js         baseplate land with skirts, the sea shader with shore foam, hills with pines
  trackview.js      instanced track pieces, bridges, tunnel portals, platforms, buffers, switch arrows
  objects.js        instanced items, bobbing boats, boops, lighthouse beams, lamp glows, ghosts
  trainview.js      vehicles posed from the sim, smoke, the selection ring
  peopleview.js     instanced minifig parts with walk, hop and wave
  ambient.js        clouds, gulls, sailboats, fireflies, snow / petals / leaves
  fx.js             puffs and brick confetti
  mini.js           a second renderer for the workshop turntable and every thumbnail
js/ui.js            DOM: title, toolbar and trays, train card, toasts, bubbles, all the panels
js/input.js         mouse and touch gestures (one finger tools, two fingers camera)
js/audio.js         synthesised music, ambience and effects
js/save.js          worlds, the shed, the profile and settings in localStorage
js/main.js          boot, tools, the frame loop, events, stickers, undo, saving, debug hooks
```

`main.js` runs the simulation on a fixed 1/30 s step and drains `world.events` (arrivals, boarding, switches, buffers) for sounds, bubbles and stickers. The view only reads the world; it rebuilds meshes when the world's version counters (`terrainV`, `trackV`, `objV`) change.

## Track

A tile's track is a 6-bit mask: two straights (N–S, E–W) and four quarter curves of radius ½. Two straights make a crossing; a straight and a curve sharing an edge make a switch. A train entering a tile through an edge looks up the exits from that edge (straight ahead first) and takes `exits[switch % exits.length]`, so one counter per tile is all a switch needs, and tapping a switch steps it.

Drawing is a **stroke**: every pointer move rewinds the world to the start of the stroke and lays the whole path again. The middle of a path gets the piece joining its neighbours; each end joins on to what is already there:

- an end that reaches a single piece with a loose end turns that piece to meet it (a straight end becomes a curve), so lines join up without fiddling;
- a path that comes back to where it started closes a loop: its first and last tiles are treated as middles;
- starting or ending beside a straight that runs across makes a **branch** (a switch) curving toward the end of the straight the finger is nearer; dragging right across it makes a crossing.

Stepping back along your own path un-draws it. Track can't go through buildings (the stroke stops there) but clears little things like trees.

## Trains

A train is a list of traversals (one per tile it covers, head first) and how far the head is into the first. Moving adds traversals at the front and drops them at the back; reversing flips the list, so a train can shunt out of a dead end. Vehicles are placed by distance behind the head with two bogie points each, so they bend through curves; a reversed train keeps its engine where it is and pushes.

Trains never crash. Each tick a train looks up to seven tiles ahead and brakes (`v ≤ √(2·a·d)`) for:

- **the end of the line**: stop at the buffers, wait, reverse;
- **another train**: tiles under a train, plus one tile each train reserves just before it would need to brake for it, so two trains can't step into the same free tile in the same tick. A train that waits nine seconds reverses; two trains nose to nose take turns (the lower id backs off);
- **stations**: stop with the head near the far end of the platform, dwell, let people off and on, then set off (and ignore that platform until it has left it).

## People

Every home has residents (1–4). They spawn on a doorstep, pick a nearby tile (breadth-first over walkable land) and stroll there, idle, and sometimes walk to a station and wait on the platform beside the track. When a train dwells at their platform they board if there are seats (coaches, cabooses and trams carry passengers); riders get off at the next stations. People never step onto a tile a train is on.

## Look

- Land is a quad per tile with a skirt into the sea, coloured per terrain and season, with a stud normal map (paths are smooth tiles).
- The sea is one shader: a chamfer distance-to-land texture gives shallow-to-deep colour and rings of foam rolling into the beach.
- Hills are a flat-shaded height field from the distance to non-hill ground (so they meet the ground exactly at the tile edge and never cover neighbouring track), with snow caps, little pines, and a steep rise behind each tunnel arch.
- Everything else is built from primitives in `builder.js` and merged per model; all items of a type are one InstancedMesh. Windows, lamps and headlights carry a per-vertex glow that lights up at night.
- Time of day (morning, midday, sunset, night, or a full cycle) drives the sky dome, sun, moon, fog, water, stars, lamp glows, lighthouse beams and fireflies.
- Tilt-shift: two separable blur passes weighted by distance from a focus band, plus a warm grade and vignette.

## Controls

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Use a tool | Left drag / click | One finger |
| Move the camera | Left drag in Play, WASD / arrows | One finger in Play, two-finger slide |
| Turn | Right or middle drag, Q / E | Two-finger twist, ⟲ ⟳ buttons |
| Zoom | Wheel, + / − | Pinch |
| Tools | 1–6 | Toolbar |
| Turn a building | R | ⟳ Turn |
| Toot the selected train | Space | Toot! |
| Time of day | T | ☀️ |
| Undo / redo | Ctrl+Z / Ctrl+Y | ↶ ↷ |

## Phases

### Phase 1 — Simulation
- [x] Grid, track segments, traversal geometry
- [x] Strokes, loop closing, branching, crossings, switches, stations
- [x] Trains: routing, braking, stations, blocking, reversing, poses
- [x] People: residents, walking, waiting, boarding
- [x] Eight island presets, the generator and the starter town
- [x] Save / load / undo snapshots; `dev/simtest.mjs`

### Phase 2 — The island in 3D
- [x] Baseplate land, sea shader, hills and tunnels, bridges, platforms
- [x] 80 item models, 5 engines, 11 cars, minifigs
- [x] Time of day, weather, clouds, gulls, boats, fireflies, tilt-shift

### Phase 3 — Play
- [x] Tools: Play, Track (lay, station, take up), Build, Land, Trains, Clear
- [x] Train card, ride along, workshop, Train Shed
- [x] My Islands (many saves, thumbnails, copy, rename, share codes), stickers, settings, help
- [x] Synthesised music and sound
- [x] Touch-first layout; `dev/browsertest.mjs` for desktop and phones

## Open questions

- Should there be signals the player can set, or is the automatic blocking enough? (So far it is enough: nothing ever crashes.)
- Level crossings and roads with little cars would suit the theme.
