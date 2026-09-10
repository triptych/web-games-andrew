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

### 6. Painter's algorithm cannot render interiors

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

Measured in game-036, headless Chromium at 1280×720:

| | Triangles/frame | Idle | Walking |
|---|---|---|---|
| No LOD | 47,750 | 44.7 fps | 38.1 fps |
| Distance LOD | 19,268 | 60 fps | 60 fps |

**What mattered:**
- **LOD on the most numerous prop.** Trees dominated the count; dropping distant
  canopies from 32-triangle blobs to 8 halved the scene. Nothing else came close.
- **Chunk baking.** Merge each chunk's props into a single mesh so it's one
  instance with one vertex-transform pass, not hundreds.
- **Reuse the triangle buffer** across frames (`buf.length = 0`) instead of
  allocating — this runs every frame over tens of thousands of items.

**LOD hysteresis is required.** Switching on a single distance threshold makes a
player standing at the boundary rebuild the chunk every frame:

```js
if (d < LOD_DISTANCE * 0.85)      detail = 1;
else if (d > LOD_DISTANCE * 1.15) detail = 0;
else detail = cached ? cached.detail : (d > LOD_DISTANCE ? 0 : 1);
```

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
