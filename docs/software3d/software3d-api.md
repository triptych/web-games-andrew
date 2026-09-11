# Software 3D rendering on Canvas2D

Patterns confirmed by **[game-036 Island Walker](../../game-036/)** — a first-person
walking simulator with a 3D engine written from scratch: no three.js, no WebGL.
JavaScript transforms, culls, lights and depth-sorts triangles, then fills them
into a 2D canvas with `Path2D`.

Read this before building another engine-less 3D game. Most of the entries below
are bugs that cost real debugging time, and every one of them is easy to
reproduce if you start over from a blank file.

---

## Two different engine-less 3D approaches in this repo

Pick deliberately — they share almost no code or gotchas:

| | **Triangle rasterizer** (game-036) | **Palette framebuffer** (game-031) |
|---|---|---|
| Primitive | Arbitrary 3D triangles via `Path2D` fills | Per-pixel writes into an indexed buffer |
| Geometry | Any mesh: organic terrain, trees, tubes | Grid walls, flat floors, billboard sprites |
| Look | Flat-shaded low-poly, smooth camera | Retro DOS, hard pixel grid, palette effects |
| Strength | Freeform 3D shape and open landscape | Free palette tricks (flash/fade are LUT swaps), crisp pixel art |
| Cost | Depth sorting has no per-pixel correctness | Geometry limited to what column-casting supports |

This document covers the **triangle rasterizer**. For the framebuffer approach
see `game-031/js/engine/` (`framebuffer.js`, `palette.js`).

### When the triangle rasterizer is worth it

Reasonable: low-poly stylised scenes, ~20k triangles/frame at 60 fps, flat
shading, fixed or slow-moving lights, no need for real-time shadows.

Not reasonable: texturing, per-pixel lighting, transparency-heavy scenes,
correct intersecting geometry, or high poly counts. Reach for WebGL instead.

---

## The pipeline

Per frame, per instance (`{mesh, pos, rotY, scale, ...flags}`):

1. Transform vertices local → world → view space. Do it **once per instance**,
   not once per triangle — vertices are shared between triangles.
2. **Clip** triangles against the near plane (do not reject them — see gotcha 2).
3. Project to screen space.
4. Backface cull via screen-space signed area.
5. Shade: one colour per triangle from its world-space normal.
6. Apply distance fog.
7. Push to a buffer; after all instances, sort back-to-front and fill.

```js
// Project with the projection matrix's scale terms directly — a full mat4
// multiply per vertex is wasted work when only two terms matter.
const f = proj[5];               // 1/tan(fov/2)
const sx = halfW + (vx / -vz) * f * halfH;
const sy = halfH - (vy / -vz) * f * halfH;
```

> **Aspect gotcha:** `proj[0]` is `f/aspect`. If you then multiply by `halfW`
> (which is `halfH * aspect`), the aspect cancels and you've applied it twice —
> the scene comes out horizontally squashed. Use `f * halfH` for **both** axes.

---

## Gotchas that will bite you

### 1. Triangle winding — get it right before adding any geometry ⚠️

The single most expensive bug in game-036. Terrain was wound clockwise viewed
from above, producing **downward** normals, so the whole island rendered as
backfaces. It went unnoticed while the terrain was nearly flat and only became
obviously broken once real slopes existed.

**Assert your winding as soon as you write a mesh builder:**

```js
// Ground/water grids: counter-clockwise viewed from above => normal points up.
const a = grid[z][x], b = grid[z][x+1], c = grid[z+1][x+1], d = grid[z+1][x];
addTri(mesh, a, c, b, color);
addTri(mesh, a, d, c, color);
```

```js
// Verify rather than eyeball it — normalY must be positive for ground.
const e1 = sub(verts[ib], verts[ia]), e2 = sub(verts[ic], verts[ia]);
console.log(normalize(cross(e1, e2))[1]); // > 0 for up-facing
```

Every surface type needs checking separately: terrain, water discs, stream
ribbons, cave interiors. They do not all follow the same convention.

### 2. Near-plane clipping — reject-the-whole-triangle punches a hole ⚠️

Rejecting a triangle when **any** vertex is closer than the near plane looks
like a reasonable shortcut, and it is invisible until the camera gets close to
big geometry. Then it deletes precisely the geometry nearest the player:

```js
// WRONG — drops the ground you are standing on.
if (a.z > -near || b.z > -near || c.z > -near) continue;
```

With 6-unit ground quads and a 1.7-unit eye height, the quad under the player
*always* has a vertex behind the camera, so the near-field terrain vanishes and
you see straight through to whatever opts out of the far cull (in game-036: the
ocean and sky backdrop). It reads as "the ground near me is transparent."

Clip instead. Sutherland-Hodgman against the single near plane is ~20 lines and
turns one triangle into a 3- or 4-vertex polygon you fan into 1–2 triangles:

```js
const da = -a.z - near, db = -b.z - near, dc = -c.z - near; // >0 = inside
if (da >= 0 && db >= 0 && dc >= 0) return [a, b, c];         // fast path
if (da < 0 && db < 0 && dc < 0) return [];                   // fully behind
const verts = [a,b,c], dists = [da,db,dc], out = [];
for (let i = 0; i < 3; i++) {
  const j = (i+1) % 3, dCur = dists[i], dNxt = dists[j];
  if (dCur >= 0) out.push(verts[i]);
  if ((dCur >= 0) !== (dNxt >= 0)) {           // edge crosses the plane
    const t = dCur / (dCur - dNxt);
    out.push(lerpVert(verts[i], verts[j], t));
  }
}
```

Two things to get right when fanning the result:

- **Shade from the original, unclipped world-space verts.** A clipped face is
  still flat, so its normal is unchanged; deriving the normal from clipped
  vertices makes the fan's pieces shade slightly differently and shows the cut.
- **Sutherland-Hodgman preserves winding**, so backface culling still works on
  the output triangles unchanged. Worth asserting once with a signed-area test.

Only the near plane needs this. Side planes can be left to Canvas2D, which
clips offscreen paths for you.

### 3. Double-sided geometry for procedurally traced surfaces

A ribbon traced along a generated path (a stream, a road) can head any
direction, so its winding isn't predictable. Give the renderer a per-instance
`doubleSided` flag rather than trying to derive the winding:

```js
if (area === 0) continue;
if (!inst.doubleSided && area > 0) continue;
// On a back-facing double-sided triangle the geometric normal points away,
// which would shade it as unlit — flip it toward the viewer.
let n = normalize(cross(e1, e2));
if (inst.doubleSided && area > 0) n = [-n[0], -n[1], -n[2]];
```

### 4. Canvas2D fill seams — stroke every triangle

`fill()` antialiases edges to *partial* coverage, so adjacent triangles blend
with the background instead of meeting exactly. The result is a hairline
wireframe across the entire scene. Stroke the same path in the same colour:

```js
ctx.fillStyle = ctx.strokeStyle = `rgb(${r},${g},${b})`;
ctx.beginPath();
ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy);
ctx.closePath();
ctx.fill();
ctx.stroke();   // widens coverage ~0.5px and closes the seam
```

Cheaper and simpler than rendering to a supersampled offscreen buffer.

**But stroking costs ~30% of rasterizer time** (measured: 39 fps -> 55 fps with
it removed), so spend it only where it buys something. A seam's visibility
scales with edge *length*, while the stroke's cost is *per triangle* — and tiny
triangles (distant terrain, foliage, grass) are the bulk of the buffer with
sub-pixel seams. Skip them:

```js
const ex = Math.max(x0,x1,x2) - Math.min(x0,x1,x2);
const ey = Math.max(y0,y1,y2) - Math.min(y0,y1,y2);
if (ex > 12 || ey > 12) ctx.stroke();   // device px
```

Track `fillStyle` and `strokeStyle` separately once you do this — they fall out
of step, and re-assigning them per triangle is itself a measurable cost. Cache
the colour string and only assign on change.

### 5. Flat shading needs half-Lambert, not clamped Lambert

With `max(dot(n, L), 0)`, the faces a first-person camera looks at are usually
the ones turned away from the sun, so they collapse to the ambient floor and
every pale material reads as brown mud. Wrap the light instead:

```js
const wrap    = dot(n, lightDir) * 0.5 + 0.5;   // [-1,1] -> [0,1], never 0
const skyFill = (n[1] * 0.5 + 0.5) * fillLight; // hemisphere bounce
const shade   = clamp(ambient + skyFill + wrap * keyLight, 0, 1.15);
```

Confirmed values: `ambient 0.38`, `fillLight 0.14`, `keyLight 0.55`. Because
`shade` can exceed 1, clamp channels to 255 before packing to bytes.

### 6. Painter's algorithm cannot render interiors (caves *or* buildings)

Sorting by average triangle depth means a large distant triangle can paint over
a small near one. A thin tunnel is the worst case: outside terrain draws over
the near wall and the player appears to stand in open air inside solid rock.

**Fix: render interiors exclusively.** When the camera is inside, submit only
interior geometry and swap the background to a solid dark colour so no daylight
leaks through gaps:

```js
if (world.isInsideCave(camPos)) {
    return [caveMesh, ...crystals];   // nothing else, at all
}
```

Containment has to be an explicit spatial query (distance to the tunnel
centreline) — depth sorting will never work it out for you.

**This applies to every enclosed space, not just caves.** A building the player
can walk into hits the same wall, and it bites even from *outside*: a 6-unit
ground quad straddling a wall plane averages nearer than the wall's own
triangles, so the terrain paints over the building and it looks like it
disappeared as you approached. Concretely, from 14 units out:

```
front wall  avg depth: 11.41   (nearest vertex 11.36)
ground quad avg depth: 11.09   (nearest vertex  7.99)  <- sorts last, paints over
```

So an enterable building needs the full treatment, same as the tunnel:

- Build it **hollow** — wall panels with a doorway gap, not a solid box. A solid
  box has no inside to stand in, and from within it every face is backfacing.
- Return exterior and interior as **separate meshes**. Bake only the exterior
  into the chunk; keep the interior out so it can be submitted alone.
- Swap to the interior scene via an explicit **AABB containment query**, and
  extend that box through the doorway's full wall thickness — otherwise there's
  a 3–5 frame window mid-stride where the player is past the room but still in
  the wall band, and the outdoor scene flashes through the opening.
- Gate the loose-item and deposited-item lists on the same query, or
  collectibles float in the void indoors and shelved ones hide behind walls.
- Add **wall collision**. Without it the player walks into geometry that isn't
  being drawn as an interior yet, which is what makes the building "vanish".
- Register interiors **lazily but independently of chunk residency**. If the
  interior is only created when its chunk generates, a query that runs before
  the player has been nearby reads "not inside" and the swap never fires.

Interiors drawn this way show the flat interior backdrop through the doorway
rather than a view of the outdoors. That's inherent to the technique — pick a
backdrop colour that reads as the room's gloom, not as a void.

### 6b. Painter's sort fails on big planes — bias them, and don't build hidden geometry ⚠️

Three separate bugs in game-036 all trace to the same root: **the sort key is a
triangle's *average* depth**, which is meaningless for a large or oblique face.
All three showed up only after the draw distance grew — they are latent in any
scene with a ground-plane backdrop.

**Symptom: teal spikes stabbing up through the coastline.** The ocean was a disc
of huge wedges running from the origin out past the island. A wedge's average
depth could place it *in front of* a hillside it was actually buried inside, so
water painted over land.

Three fixes, all needed:

1. **Tessellate backdrop planes.** Split the disc into many concentric rings so
   each triangle's average depth is close to its real extent. Space the rings
   geometrically — fine near the viewer where sorting errors show, coarse at
   the horizon where they don't.
2. **Don't generate surface that's inside solid ground.** Tessellation alone
   isn't enough: with no depth buffer, water inside a hill isn't *hidden* by the
   hill, merely sorted against it. Sample each quad's corners against the
   heightmap and skip it when all of them are well inland. (Removed 61% of the
   ocean's triangles as a bonus.)
3. **Add a `depthBias` instance flag** and push the backdrop to the back of the
   order outright. Nothing is ever behind the sea or the sky, so this is always
   correct:
   ```js
   this._tdepth[i] = inst.depthBias ? depth + inst.depthBias : depth;
   // ocean: depthBias 10000, clouds: 20000
   ```

**Also: skip chunks that are entirely under the waterline.** 148 of 376 loaded
chunks were pure seabed — invisible beneath the ocean, but still built, sorted
and drawn. Flag them at build time (`maxY < SEA_LEVEL`) and drop them from the
instance list.

**And extend the backdrop past the far plane.** If the ocean disc's outer edge
falls *inside* the view distance you see sky through the gap and its polygon
edge reads as a ring of spikes on the skyline. `OCEAN_OUTER_RADIUS` must exceed
`RENDER_FAR`, not just the island radius.

### 6b-ii. Ground-hugging decals need the *opposite* bias — and per-vertex draping

The mirror image of the ocean bug. A stream ribbon in game-036 appeared bitten
into a jagged zig-zag of teal wedges wherever it crossed a slope, as if the
landscape were clipping it.

Two independent causes, both from the same average-depth sort:

1. **Segments spanned several ground quads.** The traced centreline stepped 4
   units while terrain quads are 2, so one stream triangle covered multiple
   quads and got a single averaged depth — sorting wholly in front of or wholly
   behind ground it actually interpenetrated. **Resample the path so no segment
   exceeds about one terrain quad** before ribboning it. Same lesson as
   tessellating the ocean, but for a strip rather than a plane.
2. **Both banks inherited the centreline's height.** A ribbon of any width
   crossing a slope has banks at different ground heights; using the centre
   height buries the uphill edge and floats the downhill one. Measured on a real
   seed: **129 of 948 stream vertices (14%) sat below the terrain**, up to 0.43
   units deep — those buried vertices are the bites. **Sample the heightmap at
   each bank vertex's own x/z**, not the centreline's. Drops to zero buried.

Then, because a decal sits only ~0.12 above the ground and is therefore nearly
coplanar with it, the two average depths are nearly equal and the sort between
them is a coin flip that flickers as the camera moves:

```js
// ocean/sky backdrop: large POSITIVE bias -> forced to the back
{ mesh: oceanMesh, depthBias: 10000 }
// ground decal (stream): small NEGATIVE bias -> wins the coplanar near-tie
{ mesh: streamMesh, depthBias: -0.35 }
```

Keep the negative bias **well under the terrain quad size**. Too large and the
stream shows through hills genuinely in front of it — you trade a near-tie
artifact for a real occlusion bug. The same pattern applies to any decal:
paths, roads, shadow blobs, scorch marks.

### 6c. Build the faces the player will actually look at

Clouds were built with a top face and two sides — no bottom. They float
overhead, so the player only ever sees the *underside*: they rendered as dark
grey shards (unlit back faces) against the sky. Closed blobs cost a few more
triangles and light correctly from every angle.

The general rule: work out which face of a prop is actually presented to the
camera before economising on geometry. Also keep `noFogFade` backdrop props
bright and low-contrast — exempt from distance haze, a strongly shaded cloud
keeps its dark side at any range and reads as a storm.

### 7. Player collision must know about overhead geometry

Ground collision against a heightmap pushes the player back up through a
tunnel roof, making the cave impossible to enter. Any geometry the player can
get *under* needs its own floor query that overrides the terrain:

```js
_groundHeight(x, z, currentY) {
    const caveFloor = this.world.caveFloorAt(x, z, currentY);
    return caveFloor ?? this.heightmap.heightAt(x, z);
}
```

### 8. Fog must finish before the draw distance

If `fogFar > drawDistance`, chunks are culled at full saturation and pop in as
hard-edged blocks, while anything exempt from culling (ocean, sky) washes out.
Order them: `fogNear < fogFar <= drawDistance < renderFar`.

Scale fog *proportionally* when you change draw distance. At 105u the haze had
to start around 55u to hide the edge, which greyed out the mid-ground; pushing
the horizon to 260u let it start at 150u, so the island reads sharp out to a
real distance instead of dissolving a few steps away.

Give backdrop geometry `noFarCull` so the horizon still reads as water and sky
rather than showing the edge of the loaded world.

### 9. Vertical scale — terrain looks flat until you overdo it

A 260-unit-radius island peaking at 17 units read as a flat sheet from a 1.7-unit
eye height. Raising the peak to ~80 units (roughly **1:4 height-to-radius**) is
what made ridgelines occlude each other and regions feel separated.

Raise the radial falloff to a power > 1 to keep coastal shelves gentle while
letting the interior climb steeply:

```js
const dome = Math.pow(falloff, 1.35);
let h = dome * 62 - 7;
h += (hills - 0.5) * 30 * falloff;
```

---

## Performance

Measured in game-036, headless Chromium at 1280×720, 72 samples across 3 seeds
and 6 positions x 4 view angles:

| | min fps | p10 | median |
|---|---|---|---|
| Original (105u draw distance) | 35 | 60 | 61 |
| 260u draw distance, ~2.5x the props, 12x12 ground grid | 40 | 50 | 61 |

The second row draws **2.5x the draw distance and far more geometry at the same
median framerate** — and a better worst case. What paid for it:

**1. Frustum culling, by far the biggest win.** Reject whole instances by
bounding sphere before transforming a single vertex. At a 70° FOV you can see
roughly a quarter of the world around you, and measurements confirm it:
**69-86% of instances are rejected every frame.** Without this, nothing else on
this list matters.

The trick that keeps it cheap: in *view* space the six frustum planes depend
only on FOV, aspect and near/far — never on camera position or heading. Compute
them once on resize, then transform each instance's bounding-sphere centre into
view space (one point) and test. No per-frame plane maths.

```js
// on resize only
const tanH = Math.tan(fov/2) * aspect, invH = 1/Math.sqrt(1+tanH*tanH);
planes = [ 0,0,-1,-near,  0,0,1,far,            // near, far
           invH*1,0,-tanH*invH,0, -invH,0,-tanH*invH,0,   // left, right
           0,cos(fov/2),-sin(fov/2),0, 0,-cos(fov/2),-sin(fov/2),0 ]; // top, bottom
// per instance: inside iff dot(n, c) + d >= -radius for all six
```

Cache the bounding sphere on the mesh object (`mesh._bounds`) — recomputing it
per frame gives most of the cost straight back.

**2. Profile before optimising — the intuitive answer was wrong twice.**
Bucketing triangles by distance showed the far 120-280u ring was only **10%** of
the scene while the *nearest 12 chunks were 40%*. Draw distance was nearly free;
near-field density was the whole problem. Likewise "distant grass is the waste"
was wrong — cutting it saved almost nothing, while one overweight tree LOD
(538 triangles, from subdividing canopy blobs to 128 tris each) was the real
cost. **LOD_NEAR is the main framerate control**, not draw distance.

**3. Keep the most numerous prop cheap.** Trees dominate. Several small jittered
blobs at subdivision 1 read as foliage far better than one smooth subdivision-2
ball, and cost a third as much — spend the budget on blob *count*, not
tessellation.

**4. Struct-of-arrays for the triangle buffer.** One object per triangle means
tens of thousands of short-lived allocations per frame. Use parallel typed
arrays (`Float32Array` verts, `Uint32Array` packed RGB) and sort an index
`Uint32Array` so each swap moves 4 bytes, not a pointer into scattered heap.

**5. Batch Canvas2D state changes.** Adjacent triangles usually share a colour;
`fillStyle` is an expensive setter. Track the previous packed colour and skip
both the assignment and the `rgb()` string build when unchanged.

**6. Chunk baking.** Merge each chunk's props into a single mesh so it's one
instance with one vertex-transform pass, not hundreds.

**7. Budget chunk rebuilds per frame.** Crossing an LOD boundary at a run can
otherwise request a dozen mesh rebuilds in one frame and drop it. Cap it
(3/frame worked) and render the stale LOD until the budget comes round.

**LOD hysteresis is required.** Switching on a single distance threshold makes a
player standing at the boundary rebuild the chunk every frame:

```js
// Three bands. Both ground grid and props get cheaper with distance.
if (d < LOD_NEAR * 0.85)     detail = 2;
else if (d < LOD_FAR * 0.85) detail = (cached?.detail === 2 && d < LOD_NEAR*1.15) ? 2 : 1;
else if (d > LOD_FAR * 1.15) detail = 0;
else detail = cached ? Math.min(cached.detail, 1) : 0;
```

Make each band's ground resolution a divisor of the next (`[3, 6, 12]`) so a
coarse chunk's verts are a strict subset of its detailed neighbour's grid. Since
every vert samples `heightAt()` directly, the shared edge then agrees exactly
and no cracks show between LOD levels.

**Keep LOD rebuilds deterministic.** Seed the chunk RNG from its coordinates and
draw from it in the *same order* regardless of detail level, or props shuffle
when a chunk crosses the threshold:

```js
// Always consume these, even if the branch below doesn't use them.
const wx = x0 + rng() * SIZE, wz = z0 + rng() * SIZE;
const pick = rng(), rot = rng();
```

---

## Procedural placement

**Validate generated anchor points against the terrain.** Placing regions at
fixed radius fractions put the lighthouse, cemetery and garden below sea level on
many seeds. Scan inland along the ray and score candidates against a per-region
target elevation:

```js
const TARGET = { shore: 1.5, lighthouse: 6, cemetery: 16, ruins: 20 };
let best = null, bestCost = Infinity;
for (let frac = start; frac > 0.05; frac -= 0.015) {
    const p = toXZ(frac), h = heightAt(p.x, p.z);
    if (h < 1.0) continue;                                  // underwater
    const cost = Math.abs(h - target) + (slopeAt(p) > 0.45 ? 40 : 0);
    if (cost < bestCost) { bestCost = cost; best = p; }
}
```

**Then test it across many seeds, not one.** A single-seed check proves nothing
about a generator:

```js
// 60 seeds x ~10 named regions; assert none below 0.5 units
for (let s = 1; s <= 60; s++) { /* ... */ }
```

game-036 validated 600 anchors this way, plus five full playthroughs confirming
every item was reachable and every island completable.

---

## Architecture that worked

Same module + EventBus + state-singleton layout as the Kaplay/three.js games
(see [generic/learnings.md](../generic/learnings.md)), with the engine kept
strictly separate from the game:

```
js/engine/   math, mesh, renderer, camera     — knows nothing about the game
js/world/    noise, heightmap, regions, chunk, vegetation,
             structures, water, cave, sky, fauna, world
js/game/     player, items, collections, interaction
js/          main, config, state, events, ui, sounds
```

`engine/` has no imports from `world/` or `game/`, so it's liftable into the next
project as-is.

**Gate debug hooks behind a flag.** Exposing mutable engine internals is very
useful for QA (teleporting to a landmark, forcing completion) and shouldn't ship
on by default:

```js
if (new URLSearchParams(location.search).has('debug')) {
    window.__debugTeleport = (x, z) => { /* ... */ };
    window.__debugWorld = world;
}
```

---

## Testing a 3D game headlessly

Screenshots plus in-page evaluation caught every bug listed above. Worth copying:

```js
// Inspect generator output directly, without rendering
await page.evaluate(async () => {
    const { Heightmap } = await import('./js/world/heightmap.js');
    const hm = new Heightmap(12345, 260);
    return hm.heightAt(0, 0);
});
```

- **Measure fps in-page** with a `requestAnimationFrame` counter over 3–4s,
  both idle and while holding a movement key.
- **Count submitted triangles** by summing `mesh.tris.length` over the instance
  list — the fastest way to see whether LOD is actually engaging.
- **Drive the real input path** (`page.keyboard.down('KeyW')`) rather than
  setting positions, or you bypass the player controller and miss collision bugs.
  A teleport hook that skips physics hid the cave-entry bug at first.

> **Headless screenshot artifact:** stray garbled text may appear in a fixed
> screen region across screenshots, unrelated to page content and rendering
> *behind* DOM overlays. Confirm with a DOM text-node dump before chasing it —
> in game-036 it was a headless compositor artifact, not a real bug.

> **Serving gotcha:** the `serve` CLI rewrites `/game-036/index.html` →
> `/game-036/index` → `/game-036`, and the fallback loads the **root** launcher,
> whose scripts then throw confusing errors. Use `python -m http.server` for
> headless testing.
