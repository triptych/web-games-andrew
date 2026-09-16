# Island Walker

**Genre:** First-person exploration / walking simulator
**Engine:** None — custom software 3D rasterizer on Canvas2D (vanilla HTML/CSS/JS, ES modules)
**Target Resolution:** Responsive full-window canvas (renders at up to 1.5× DPR)
**Status:** Playable — full collection loop implemented and verified

---

## Concept

A procedurally generated island rendered entirely by a from-scratch 3D engine. No
three.js, no WebGL — every triangle is transformed, lit, sorted and filled by
JavaScript into a 2D canvas.

There are no enemies and no fail state. You walk, you look, you pick things up.
The island holds ten lost books and eight artifacts scattered across its regions;
carrying them home fills the Library's shelves and the Museum's pedestals with
geometry that persists in the world. The reward for exploring is watching two
empty buildings slowly become full ones.

Every reload generates a new island. `?seed=<anything>` reproduces a specific one.

---

## The renderer

This is the part of the project with real engineering in it, so it's worth stating
what it does and doesn't do.

**Pipeline, per frame:**
1. Instances (`{mesh, pos, rotY, scale, flags}`) are submitted by the world.
2. Vertices transform local → world → view space (one pass per instance).
3. Triangles crossing the near plane are rejected.
4. Perspective projection to screen space.
5. Backface cull via screen-space signed area.
6. Flat shading: half-Lambert key light + hemisphere sky fill + ambient.
7. Distance fog toward the haze colour.
8. Sort all triangles back-to-front and fill each as a `Path2D`.

**Deliberate omissions and their consequences:**

| Not implemented | Why | Consequence handled by |
|---|---|---|
| Z-buffer | Per-pixel depth in JS is far too slow | Painter's algorithm; interiors rendered exclusively (see cave) |
| Frustum clipping | Only near-plane rejection is needed at this poly budget | Off-screen triangles are cheap to reject after projection |
| Texturing | Perspective-correct UVs are costly and hard to get right | Flat per-face colour; the low-poly look is the art direction |
| Per-pixel lighting | Same cost problem | One shade value per triangle |

**Lighting note:** the key light is half-Lambert (`dot*0.5+0.5`) rather than
`max(dot,0)`. In a first-person walker the faces you look at are usually turned
away from the sun; with a clamped Lambert term they collapse to ambient and every
pale material reads as brown mud. Wrapping the light keeps hue at the cost of
physical accuracy — the right trade for this look.

**Seam fix:** each triangle is both filled *and* stroked in its own colour.
Canvas2D antialiases fill edges to partial coverage, so triangles sharing an edge
blend with the background instead of meeting exactly, producing a hairline
wireframe across the terrain. Stroking closes it.

---

## Procedural generation

Everything derives from one integer seed via `world/noise.js` (mulberry32 PRNG +
value-noise fBm). Nothing is authored by hand; nothing is loaded from disk.

| System | Module | Approach |
|---|---|---|
| Elevation | `heightmap.js` | Radial falloff (noise-displaced coastline) × fBm hills + central massif. ~80 units peak over a 260-unit radius |
| Regions | `regions.js` | Voronoi over seed points placed on a hand-biased angle/distance plan, then pulled inland to a target elevation on buildable ground |
| Terrain mesh | `chunk.js` | 24-unit chunks, built lazily, props baked into one mesh per chunk, two LOD levels |
| Trees / bushes / rocks / graves / hedges / flowers | `vegetation.js` | Parametric primitives with per-instance jitter; canopy detail is the main LOD lever |
| Lighthouse, ruins, gates, fountain, pier, library, museum, shelves, pedestals | `structures.js` | Composed from boxes, cylinders, cones |
| Ocean + streams | `water.js` | Banded sea-level disc; streams traced by steepest descent to the sea |
| Cave | `cave.js` | Circular cross-section extruded along a wandering, descending spline, with crystal clusters |
| Sky + clouds | `sky.js` | Screen-space gradient; clouds as world-space puff geometry |
| Birds + critters | `fauna.js` | Circling flight paths and a wander-and-pause steering behaviour |
| Books + artifacts | `game/items.js` | Region-weighted placement, rejecting water and steep slopes |

---

## Regions

`shore` · `forest` · `cave` · `lighthouse` · `cemetery` · `garden` · `ruins` ·
`library` · `museum` · `meadow`

Each region drives ground tint, prop density and type, its landmark structure,
and item-placement weighting. Landmark anchors are validated against the
heightmap at generation time — verified across 60 seeds that no anchor lands
below sea level.

---

## Game loop

1. Spawn on gentle inland ground, facing the island's interior.
2. Explore. Walking within ~2 units of a book or artifact picks it up.
3. Carried items show in the HUD; the prompt names the building they belong to.
4. Entering the Library shelves all carried books; entering the Museum displays
   all carried artifacts. Both become permanent world geometry.
5. Completion fires only when **both** collections are fully deposited.

---

## Player controls

| Action | Input |
|---|---|
| Move | WASD / Arrow keys |
| Sprint | Shift |
| Jump | Space |
| Look | Mouse (Pointer Lock) |
| Release cursor | Escape |

---

## Notable problems solved

Recorded because each was a real bug found by testing, not a hypothetical:

- **Inverted terrain winding.** Ground triangles were wound clockwise, giving
  downward normals; the entire island was rendering as backfaces. Invisible while
  the terrain was nearly flat, catastrophic once it had real slopes.
- **Drowned landmarks.** Region seeds sat at fixed radius fractions, so on many
  seeds the lighthouse, cemetery and garden generated below sea level.
- **Flat island.** Peak elevation was ~17 units across a 260-unit radius — from
  eye level the terrain read as a sheet. Now ~80.
- **Ocean backface culling.** The sea disc was wound the wrong way and vanished
  from every above-water viewpoint.
- **Shallow-water disc too wide.** Standing on the island put the camera inside
  the shallow band, so every sea view was pale teal with no deep water visible.
- **Player could walk underwater.** The camera dropped below the surface, and
  since water is only a surface, the view became empty background.
- **Cave was see-through.** Painter's-algorithm sorting let distant terrain paint
  over the near tunnel wall. Fixed by rendering the interior exclusively.
- **Cave was unenterable.** Ground collision used the heightmap, which pushed the
  player up through the tunnel roof.
- **Canvas2D seams.** Hairline wireframe across all terrain from fill antialiasing.
- **Fog misconfigured.** Fog started past the chunk draw distance, so terrain was
  culled at full colour (hard pop-in) while the ocean washed out to near-white.

---

## Performance

Measured in headless Chromium, 1280×720:

| | Triangles/frame | Idle | Walking |
|---|---|---|---|
| Before LOD | 47,750 | 44.7 fps | 38.1 fps |
| After LOD | 19,268 | 60 fps | 60 fps |

Distance LOD rebuilds far chunks with low-detail canopies (8-triangle blobs
instead of 32), with a hysteresis band around the threshold so a player standing
at the boundary doesn't rebuild every frame. Chunk cache is evicted past 160
units, staying bounded (~83 chunks) over long traversals.

---

## Module overview

| File | Responsibility |
|---|---|
| `js/main.js` | Boot, seed resolution, Pointer Lock flow, frame loop |
| `js/config.js` | All tunable constants |
| `js/events.js` | EventBus singleton |
| `js/state.js` | Collection progress (carried vs deposited) |
| `js/ui.js` | DOM HUD bindings |
| `js/sounds.js` | Web Audio ambience + effects |
| `js/engine/math.js` | Vec3 / Mat4 |
| `js/engine/mesh.js` | Mesh format + primitive builders |
| `js/engine/renderer.js` | Software rasterizer |
| `js/engine/camera.js` | First-person camera + mouse-look |
| `js/world/noise.js` | Seeded PRNG + value noise |
| `js/world/heightmap.js` | Island elevation |
| `js/world/regions.js` | Region assignment and landmark anchoring |
| `js/world/chunk.js` | Chunked terrain + prop baking + LOD |
| `js/world/vegetation.js` | Plants, rocks, markers |
| `js/world/structures.js` | Buildings and man-made features |
| `js/world/water.js` | Ocean and streams |
| `js/world/cave.js` | Tunnel generation |
| `js/world/sky.js` | Sky gradient and clouds |
| `js/world/fauna.js` | Birds and critters |
| `js/world/world.js` | World orchestration, visibility, cave queries |
| `js/game/player.js` | Movement and collision |
| `js/game/items.js` | Item placement and pickup |
| `js/game/collections.js` | Library/Museum deposit mechanic |
| `js/game/interaction.js` | Prompts and region labels |
| `js/game/mapstate.js` | Overmap data: explored grid, region/item discovery |
| `js/game/mapview.js` | Overmap drawing (Canvas2D, full map + minimap) |
| `js/game/mapui.js` | Overmap canvases, M toggle, pointer-lock handling |

---

## Event catalog

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `progressChanged` | counts object | `state` | `ui` |
| `itemCollected` | `{id, kind, name}` | `items` | `ui` |
| `regionEntered` | region name | `state` | `ui` |
| `mapExplored` | `{fraction, seen, total}` | `mapstate` | `mapui` |
| `mapAnnotation` | `{kind, name, label}` | `mapstate` | `mapui` |
| `gameComplete` | — | `state` | `ui`, `main` |

---

## Possible extensions

- Day/night cycle — the lighting model already takes a light direction per frame
- A z-buffer or per-instance depth bias, to allow true building interiors
- Interior floors for the lighthouse (climbable) and more cave branches
- Making the overmap a found item rather than something you start with
- Persisting the explored grid per seed, so revisiting a shared `?seed=` resumes

---

## Changelog

### Playable build (2026-09-10)
- Custom software rasterizer: transform, cull, half-Lambert shading, fog, depth sort
- Procedural island: heightmap, Voronoi regions, chunked terrain with LOD
- Procedural content: trees, rocks, water, streams, cave, structures, fauna, clouds
- Collection loop: region-weighted item placement, carry-and-deposit, completion
- Distance LOD + chunk eviction (60 fps, triangles halved)
- Verified: 5 seeds fully completable, 60 seeds with valid landmark anchors, 0 errors

### Overmap (2026-09-11)
- Grid-based fog-of-war overmap that fills in as you walk (`M`), plus a
  persistent corner minimap
- Annotations discovered rather than given: region names appear once enough
  ground around their anchor is charted; book/artifact pins appear once spotted
  from a distance and stay on as hollow marks after collection
- Map terrain samples the same region tints as the 3D ground, blended across
  region borders (hard Voronoi edges read as a political map from above) with
  a north-west hillshade so relief is legible
- Explored cells composited via a 1px-per-cell offscreen canvas rather than
  per-cell `fillRect`; worst-case reveal frame 0.19ms, standing still 1us
- Verified in-browser: all 10 regions and 18 items resolve at 100% charted,
  map survives the cave/interior scene swaps, movement frozen while open,
  HiDPI backing store tracks resize, no console errors

### Save/load, inventory & quests (2026-09-11)
- **Save/load** (`js/game/save.js`): autosaves to `localStorage` on every
  milestone (pickup, deposit, quest step, completion) plus a 20s throttle while
  walking, and on `visibilitychange`/`pagehide`. Reloading resumes automatically
  and the title screen says so ("Continue Walking"). Because the world is a pure
  function of its seed, the save stores only player-authored state — position,
  pack, collected ids, deposited counts, quest flags, fog-of-war grid — and
  re-derives terrain, placement and map colours on load. **0.8 KB** after a short
  walk; **1.5 KB** at 12% charted; **0.4 KB** fully charted (the fog grid is
  run-length encoded, and a fully-revealed grid is one long run). A save whose
  seed does not match the current island is refused rather than half-applied.
- **Inventory** (`js/game/inventory.js`): real item records rather than counters
  — each find keeps its name, the region it came from, a hand-written lore line,
  and pickup order. No carry limit (the round trip home is already the decision;
  a cap would just mean walking the same ground twice). The pack is the single
  source of truth for what is carried, so `state`'s counts are derived from it on
  load and the two can never disagree.
- **Quests** (`js/game/quests.js`): a 6-step curated main chain (find something →
  find the library → shelve a book → display an artifact → fill both collections)
  plus 7 side quests keyed to landmark discovery and map coverage. Fully
  event-driven — each quest declares the events that could advance it and a
  predicate over live state, so adding one never touches the frame loop. Written
  against regions the generator always seeds rather than templated from the seed,
  so no island can produce an impossible or already-done objective.
- **Journal panel** (`Tab`/`I`): two columns — the pack with lore and provenance,
  and the objective list with the main chain revealed progressively and side
  quests visible from the start. **Pause menu** (`Esc`): resume, save now, load
  saved walk, new island. Both follow the overmap's pointer-lock/pause
  convention, and only one overlay is ever open at a time.
- HUD gains a one-line "NEXT" objective under the collection counters.
- Fixed: deposited shelf/pedestal geometry was placed from a shared RNG stream,
  so its arrangement depended on deposit order and could not be reproduced from a
  count — now a pure function of the slot index, verified identical across a
  save/load round trip.
- Fixed: the main quest chain could deadlock. A step gated on being "active" was
  never re-tested if its condition was satisfied by an event it did not subscribe
  to, so shelving a book left the HUD stuck on "Find the Library" with the books
  already on the shelf. The active step is now folded into every evaluation pass.
- Verified: 32 headless assertions against the real world generator (save
  round-trip field-by-field, RLE edge cases incl. first/last-cell-only and
  all-revealed, seed-mismatch refusal, no spurious deposit after loading indoors,
  full completion drives the chain and `gameComplete`), plus in-browser runs of
  both panels, the one-overlay-at-a-time rule, reload-resume, and the
  reload-driven Load/New-Island paths. 60 fps with panels open, no console errors.
