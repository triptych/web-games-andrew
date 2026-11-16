# Lanternhollow

**Genre:** Cozy builder / toy (a procedural dungeon diorama you shape, share and walk)
**Engine:** three.js r165, sim/view layout. 17 models by [Meshy](https://www.meshy.ai) (each with a code-built stand-in); every texture, shader, room behind a window and sound is code
**Status:** v1.0.0

---

## Concept

A cozy fantasy dungeon builder. Roll a seed and watch **wave function collapse** grow a level out of little 3×3 tiles: tunnels, chamber walls, doorways, pools, streams, waterfalls and wells, placed only where their edges agree. Several levels stack under one another, joined by stairs. Fill them with **friendly residents** (sleepy slimes, mushfolk, a moss golem, a goblin cook and a drowsy dragon on her hoard), **hoards**, braziers and candles, campfire camps, bookshelves, tea tables and glowcaps; give every level its own **theme** (woodland burrow, stone keep, brick cellar, cavern rock, mossy ruins, crystal grotto, frost hollow); then **share it as a link** that rebuilds exactly that dungeon, and **walk it in first person** by lantern light.

Two shader techniques give the dungeon its depth:
- **Parallax occlusion mapping** on every wall, floor, cap and step: the mortar sinks, the planks stand proud, the pebbles hide one another as you move.
- **Interior mapping** behind barred **peek windows** (a tiny library, a wine cellar, a sleeping den, a crystal grotto, a mushroom pantry) and down every **well** (a deep stone shaft): one flat quad each, showing a whole room in true perspective.

Touchstones: Townscaper (the joy of a generator you poke), Oskar Stålberg's WFC demos, Dungeon Keeper's diorama, and the warm UI of Animal Crossing.

## Core loop

1. **Shape**: seed (or 🎲), size, number of levels, and the mix the collapse grows (tunnels, chambers, water, wells).
2. **Elements**: how much of each kind of thing (monsters, hoards, lights, cozy things, flora, peek windows).
3. **Themes**: each level's material.
4. **Tools**: paint squares (pin a cell to chamber, tunnel, water, well or rock and let the rest regrow around it), place any element by hand, tidy anything away; undo.
5. **Depth**: the slider on the right moves between levels; the old level slides away and the new one rises into the diorama.
6. **Share**: one link holds all of it.
7. **Walk it**: meet every friend and find every hoard, level by level, down the stairs. Or press **T** for a tour (the explorer bot walks it for you).

## State, input and events

### Params (everything a share link holds; `js/sim/share.js`)
`{ seed, size: s|m|l, levels: 1–5, mix: { tunnels, chambers, water, pits } (0–9), el: { monsters, hoards, lights, cozy, flora, windows } (0–9), themes: [id per level], pins: [{ l, x, y, b }], stamps: [{ l, x, y, k }], erased: [{ l, x, y }] }`

Link: `#s=mossy-badger-27&z=m&n=3&m=5543&e=556544&t=wsm&p=0.4.5.c_1.3.3.t&k=0.12.7.slime&x=0.20.9`. `normalize()` clamps everything; hostile links are cleaned, never trusted.

### G (`js/sim/game.js`)
`{ v, params, d (the dungeon, rebuilt by generate(params), never saved), lv, x, z, yaw, pitch, found: { id: 1 }, gold, friends, visited, dist, t, events }`

### Walk input
`step(G, { fx, sx, yaw, pitch, run }, dt)`: forward and strafe in [-1, 1]; yaw and pitch are deltas, so mouse movement waits for the next sim step and is never lost.

### Events
`step` (footsteps, `water`), `splash`, `befriend` (`id`, `kind`, `x`, `z`), `loot` (`id`, `kind`, `value`), `stairs` (`from`, `to`, `name`), `exit`, `rebuilt`.

## Mechanics (each has a line in `dev/simtest.mjs`)

### The tile set (`js/sim/tiles.js`)
Each tile is a 3×3 pattern of micro cells: `#` rock, `.` floor, `~` shallow water, `o` a well, `v`/`^` stairs. Two tiles may touch when the three cells along their shared edge are identical. Base patterns are rotated into every distinct orientation (63 variants).

| Family | Pattern | Mix |
|---|---|---|
| rock | `### ### ###` | — |
| tunnel, bend, tee, cross, dead end | `#.# #.# #.#` … | tunnels |
| floor, wall, corner, inner corner, doorway | `... ... ...`, `### ... ...` … | chambers |
| pool, pool edge, pool corner, pool inner corner | `~~~ ~~~ ~~~`, `... ~~~ ~~~` … | water |
| stream, stream bend, inlet (stream into a pool), spout (a **waterfall** out of a wall) | `.~. .~. .~.`, `### .~. .~.` … | water |
| well | `... .o. ...` | pits |
| stairs down / up | `... .v. ...` | only ever pinned |

A slider at *v* multiplies its families' weights by (v/5)^1.7; 0 removes them.

### Wave function collapse (`js/sim/wfc.js`)
Least weighted-entropy cell first (rng noise breaks ties), weighted pick, AC-3 propagation; the border's outer edges must be rock. A contradiction returns null and the caller tries again with the rng's next numbers.

### A level (`js/sim/dungeon.js`)
1. Stairs are placed first for the whole dungeon: the stairs down on level *k* and the stairs up on level *k*+1 share a cell, at least 45 % of the diagonal from the stairs up.
2. **Spacers**: a jittered lattice of cells (every 4–6 cells, by the chambers slider) that may only be rock or tunnel; without them the open floor tile spreads and every chamber merges into one cavern. Spacers keep clear of the stairs and of painted squares.
3. Painted squares are pins (a cell's domain is its brush's families).
4. Collapse; then **prove**: flood from the stairs up through open edges; the stairs down must be in it and the kept part must cover 22–80 % of the cells; everything unreached becomes rock (safe: a cell is unreached only if all its edges facing the kept part are rock). Up to 60 tries; then the pins are dropped and the level says it was *loosened*; then the default mix (never needed over 105 test levels).
5. Chambers (room-family cells joined by open edges), waterfalls (spout tiles) and a name ("The Honeyed Hollow") from the theme's words.

### Features (`js/sim/features.js`)
Per 100 walkable micro cells at slider 5: monsters 0.9, hoards 0.7, lights 0.7, cozy 1.0, flora 1.0, torches 1.7, windows 0.8. Kinds within a category are weighted ×3 for what the level's theme favours. Each kind stands where it belongs: `room` (open chamber floor), `wall` (backed by a wall, facing out), `nook` (dead ends and chamber corners: hoards), `water` (beside water: glowcaps). Never on or beside the stairs, never in a doorway, never next to another. **Every blocking feature is checked as it is placed**: a flood fill with it in place must still join the stairs and leave every blocker a reachable side. The deepest level's biggest chamber gets the **drowsy dragon** on her hoard. Torches hang on any rock face, at least 4 cells apart; **peek windows** need two cells of solid rock behind them. Then the player's erasures and stamps (a stamp that would block the way is refused, with a reason).

### Walking (`js/sim/walker.js`)
A circle of 0.32 m, 3.6 m/s (6 hurrying, 60 % in water), sliding along walls axis by axis; wells and blocking features are solid. Within 1.7 m of a monster: befriended (once); of a hoard: found (+120 gold or +60 for a chest). Stepping into a stairwell takes you to the next level, beside the stairs you came by, facing the open way; a cooldown stops a bounce back. The way in at the top turns you round.

### The bot (`js/sim/bot.js`)
BFS over walkable, unblocked micro cells to the nearest cell beside an unfound friend or hoard, committed until it is found; then the stairs down; done at the bottom. It drives the real walker, so it proves every placement can be reached at walking speed with the real collision. Also the **Tour** (key T).

## Controls

| Action | Keyboard / mouse | Touch | Gamepad |
|---|---|---|---|
| Turn the diorama | drag | drag | — |
| Slide / zoom | right-drag or Shift-drag / wheel | two fingers / pinch | — |
| Level | 1–5, PgUp/PgDn, [ ] | the depth rail | — |
| Reseed / undo | R / Ctrl+Z | 🎲 / ↶ | — |
| Walk / tour | W or Enter / T | 🕯️ Walk it | — |
| Walk around | WASD, arrows or Q/E to turn, Shift to hurry, mouse look (pointer lock) | left stick, drag on the right, 🏃 | sticks, LB/LT to hurry |
| Back to the workbench | Esc (twice if the mouse is locked) | 🛠️ Workbench | B |

## Look and sound

- **Builder**: an orbiting diorama on a warm dusk gradient. The shown level is a slab: dungeon cut into the top, earthy strata down the sides, turf/slate/soil/snow on the solid rock. Fireflies drift above it, lantern signs bob over the stairs, a glowing column marks the pointed cell. The projection is shifted so the dungeon centres in the part of the screen the workbench doesn't cover.
- **Walking**: a ceiling, fog in the theme's colour, a warm lantern with the explorer, a pool of 10 point lights lent to the nearest torches, braziers, glowing elements, windows and stairs (fixed count: changing it recompiles every material, game-136), flickering flame sprites, hearts and coin sparkles, a minimap.
- **Materials** (`js/view/textures.js`): 23 procedural, tileable recipes (blocks, flags, planks, boards, bricks, terracotta, rock, pebbles, moss-overgrown stone, crystal, glass, ice, snow, turf, strata…), each an albedo and a height map; normals from the height. **POM** is patched into `MeshStandardMaterial` (`js/view/materials.js`): up to 32 layers, a tangent frame from screen-space derivatives (no tangent attribute needed on merged geometry), `textureGrad` inside the loop, crevice darkening from the height. A setting turns it off.
- **Interior mapping** (`js/view/interior.js`): ray–box intersection in the quad's own space; five faces and a cut-out middle layer from a painted 3×2 atlas.
- **Sound** (`js/audio.js`): a music-box lullaby over a soft pad (pentatonic, I–vi–IV–V), a stone-room reverb, drips while walking, footsteps that splash in water, chimes, coins and little sounds for every tool. All Web Audio.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot (link → last save → new seed), the builder (undo, taps, keys), the walk loop, events, debug hooks |
| `js/sim/` | Pure: `tiles.js` (tile set), `wfc.js`, `dungeon.js` (levels, proofs), `features.js`, `walker.js`, `bot.js`, `share.js`, `game.js`, `data/` (elements, themes) |
| `js/view/` | `view.js` (scene, cameras, transitions, lights, effects, picking), `levelmesh.js` (geometry), `materials.js` (POM, water, waterfalls), `textures.js`, `interior.js`, `models.js` (Meshy GLBs and stand-ins) |
| `js/ui.js`, `js/controls.js`, `js/input.js`, `js/audio.js`, `js/save.js` | Workbench and HUD, builder pointer controls, walking input, sound, guarded storage |
| `assets/models/`, `assets/thumbs/` | Meshy GLBs (3 MB) and their thumbnails (the Place palette) |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (≈ 270 checks): purity; the tile set; every adjacency of every collapse; 105 levels over 3 sizes proved joined, sized and never the fallback; the sliders change what grows; pins; features never block the way; the share link round-trips and survives hostile input; the walker; determinism and a mid-walk save round trip; and the explorer bot walking whole dungeons. `browsertest.mjs` drives the real page on desktop (real clicks to paint and place on the canvas, a share link opened in a second tab), two touch-only phones, blocked storage and a shared link.

## Balance notes

- The first collapse grew one giant cavern per level (the open floor tile is the most compatible tile there is). Spacers fixed it: now 1.6–2.5 chambers per level with tunnels between them, 40–50 % of the cells dungeon.
- The first feature rates put 80 things on a level; they are now about a third of that. Torch spacing (4 cells) keeps tunnels lit without a torch on every wall.
- A painted chamber beside a spacer could never fit (a chamber needs open neighbours): the simtest caught it; spacers now keep clear of painted squares.
- The bot tours a Roomy 3-level dungeon in about 2–6 minutes of walking.

## Open questions / next steps

- Only run under SwiftShader; POM's cost and look on a real GPU and a real phone are unjudged.
- Nobody has listened to the lullaby for long.
- The dragon is a Meshy model of a curled dragon; from straight above she reads less clearly than from the side.
- Ideas: a waterfall that pours through a well to the level below; furniture that can be turned; exporting a level as a printable map.

## Changelog

### v1.0.0 (2026-11-16)
- First release: a WFC dungeon builder with 5 levels, 7 themes, 17 Meshy elements, torches and peek windows, paint/place/tidy tools with undo, share links, first-person walking with friends and hoards, a tour, parallax occlusion mapping and interior mapping, a Web Audio lullaby; sim and browser harnesses.
