# three.js API Reference (for this project)

Three.js is the third engine used in this repo (alongside Kaplay and Phaser 4). It is loaded **from a CDN**, not from `lib/`, because:

- It is large and we only need the standard `three.module.js` plus optional `examples/jsm/` addons.
- Pinning by version in the URL is enough — we do not need a local copy for reliability.
- All three.js games in this repo run as ES modules.

The reference version for new games is **three r165**, loaded via an **import map** in `index.html`.

---

## Loading three.js — three patterns in use

### Pattern A (recommended for new games): import map + ES modules

Used by [game-023](../../game-023/index.html). Cleanest because module code can write `import * as THREE from 'three'` like a real package.

```html
<script type="importmap">
{
    "imports": {
        "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
    }
}
</script>
<script type="module" src="js/main.js"></script>
```

In every module file:
```js
import * as THREE from 'three';
// for addons:
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

### Pattern B (works but verbose): inline CDN URL in every import

Used by [game-018](../../game-018/js/main.js). Each module that touches three.js has to repeat the full URL — refactoring the version means a project-wide find/replace.

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
```

### Pattern C (legacy, do not use for new games): global script tag

Used by [game-014](../../game-014/index.html) (three r128). Loads `three.min.js` as a classic script and uses the global `THREE.*`. Works, but locks you out of ES modules and addons, and r128 is years out of date.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="js/main.js"></script>
```

---

## Standard render loop pattern

Same shape in every three.js game in this repo. Cap `dt` so a hidden tab can't deliver a 30-second frame and clip everything through walls.

```js
import * as THREE from 'three';

const clock    = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 3, 12);

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);   // cap to 50ms — important
    update(dt);
    renderer.render(scene, camera);
}
animate();
```

`renderer.setAnimationLoop(fn)` (used by game-014) is an alternative to `requestAnimationFrame` — it is required for WebXR but otherwise behaves identically. Either is fine.

---

## Window resize — always wire this up

A three.js canvas with no resize handler stretches and gets pixellated on any window change. The canonical handler:

```js
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();        // required, or aspect change has no effect
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);   // if using post-processing (see Bloom)
});
```

`updateProjectionMatrix()` is easy to forget and causes silent breakage — the aspect changes but the rendered image does not. If you added an `EffectComposer` (bloom etc.), you **must** resize it alongside the renderer in the same handler — game-024 (`scene.js`) does both.

---

## Module organization (game-023 layout)

| File | Responsibility |
|------|----------------|
| `main.js`    | Module imports, game state machine, animate() loop, collision orchestration |
| `scene.js`   | Renderer, camera, scene; exports `{ renderer, scene, camera, clock }`; resize listener |
| `config.js`  | Numeric constants, colors, gameplay tunables |
| `player.js`  | Player mesh, input handling, bullet array, update fn |
| `<entity>.js` | One file per major entity type (invaders, boss, ufo, shields, effects) |
| `sounds.js`  | Web Audio API procedural sounds (same shape as Kaplay/Phaser games) |

The `scene.js` module exports the live `renderer/scene/camera/clock` so every other module can do `scene.add(mesh)` directly without a singleton class. Works because all module imports share the same module instance.

---

## Color handling

three.js does not take `[r, g, b]` 0–255 tuples like Kaplay does. Three options, all common:

- **Hex integer**: `0xff00ff` — what `Material({ color: ... })` accepts.
- **CSS string**: `'#ff00ff'` or `'magenta'` — also accepted directly.
- **`new THREE.Color(r, g, b)`** with floats 0.0–1.0 (NOT 0–255).

To bridge from this project's `COLORS = { bg: [10,10,20] }` convention to three.js:

```js
function rgb(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

renderer.setClearColor(rgb(COLORS.bg));
new THREE.MeshBasicMaterial({ color: rgb(COLORS.accent) });
```

---

## Post-processing bloom (game-024)

The neon glow in game-024 is **real bloom**, not just emissive materials. Render through an `EffectComposer` instead of `renderer.render()`:

```js
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6,    // strength
    0.4,    // radius
    0.85,   // threshold
));

// In the render loop, call composer.render() INSTEAD of renderer.render():
function animate() {
    requestAnimationFrame(animate);
    composer.render();
}
```

- **`threshold` is the key dial.** Only pixels brighter than it bloom. Keep it **high (~0.85)** so the dark grid, fog, and ambient-lit surfaces stay crisp and only genuinely bright emissive bits (ships, bullets, explosions) glow. A low threshold lifts the blacks and washes the whole scene toward white.
- Bloom stacks on top of emissive materials — you still set `emissive`/additive blending on the meshes; bloom just spreads the bright pixels.
- Remember to `composer.setSize(...)` in the resize handler (see above).

---

## In-world HUD text via canvas-texture sprites (game-024)

For floating score popups and the "WAVE N" banner, game-024 draws text to a 2D canvas, wraps it in a `THREE.CanvasTexture`, and renders it as a `THREE.Sprite`. The sprite lives in the world at a 3D position but always faces the camera — **no DOM-to-screen projection math needed**, and it reads correctly under the overhead camera.

```js
function makeTextTexture(text, cssColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;   // wider than tall + margin so glow blur isn't clipped
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 96px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = cssColor; ctx.shadowColor = cssColor;
    for (const blur of [28, 16, 8]) { ctx.shadowBlur = blur; ctx.fillText(text, 256, 128); }  // neon glow
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillText(text, 256, 128);                  // crisp core
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;     // set this or the color looks washed/dark
    return tex;
}

const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const sprite = new THREE.Sprite(mat);
sprite.position.set(x, y, z);
sprite.scale.set(5, 2.5, 1);                   // match the 2:1 canvas aspect or the glyph stretches
scene.add(sprite);
```

- **Cache textures by string** — most kills award the same handful of values, so reuse one GPU texture per distinct string. Clone the `SpriteMaterial` per sprite (cheap) so opacity can fade independently; dispose the *material* on removal but keep the shared texture.
- Pad the canvas generously around the text so the `shadowBlur` glow never reaches an edge and gets clipped.

---

## Custom ShaderMaterial backdrop (game-024)

The signature animated neon grid floor is a `ShaderMaterial` on a flat `PlaneGeometry`. The pattern that matters for any time-based shader:

```js
const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uColorA: { value: new THREE.Color(0x64c8ff) } },
    vertexShader:   `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; /* ... use fwidth() for crisp grid lines ... */`,
});
const grid = new THREE.Mesh(geo, mat);
grid.rotation.x = -Math.PI / 2;   // lay the plane flat on the XZ plane for a top-down floor

// CRITICAL: bump the time uniform EVERY frame or the shader is frozen.
function animate(){ requestAnimationFrame(animate); mat.uniforms.uTime.value += dt; composer.render(); }
```

- `mat.uniforms.uTime.value += dt` must run every frame — shader uniforms don't auto-update.
- Animate the backdrop in *every* game mode (splash/playing/gameover) so menus look alive.
- `fwidth()` in the fragment shader gives screen-space-consistent line thickness for the grid.

---

---

## Instanced bullets: hundreds of sprites, one draw call (game-040)

A bullet-hell boss puts 200+ live bullets on screen. One `Mesh` each is 200 draw calls. Use one
`InstancedMesh` per *visual kind* and write a matrix + colour per live bullet each frame:

```js
const mesh = new THREE.InstancedMesh(geometryFor(kind), mat, 2200);  // max instances
mesh.frustumCulled = false;      // the bounds are wrong once you move instances by matrix
mesh.count = 0;                  // draw nothing until the first frame fills it

// per frame, per live bullet i:
_q.setFromAxisAngle(_axis, b.ang - Math.PI / 2);   // cone/dart geometry points +y
_p.set(b.x, b.y, 0.25);
_s.set(r, r, r);
_m.compose(_p, _q, _s);
mesh.setMatrixAt(i, _m);
mesh.setColorAt(i, _color.set(b.color));
// after the loop:
mesh.count = liveCount;
mesh.instanceMatrix.needsUpdate = true;
if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
```

- **`mesh.count` is the cheap culling knob** — set it to the live count each frame rather than
  parking dead instances off-screen.
- **`instanceColor` is null until the first `setColorAt`**, so guard the `needsUpdate` write.
- `frustumCulled = false` matters: the instanced mesh's bounding sphere is computed from the base
  geometry at the origin, so three.js will happily cull the whole swarm.
- game-040 renders a 200-bullet Chorus Heart fight in **under 70 draw calls total**, HUD sprites and
  ship meshes included.

## Symptom: killing one enemy makes every other enemy of that type vanish (game-040)

Caching geometry per shape and cloning meshes is the right call — but the usual
`disposeObject()` helper walks a mesh tree calling `geometry.dispose()`, and a *shared* geometry
disposed once is gone for every mesh still using it. In a browser this shows up as ships turning
invisible or drawing garbage, with no console error.

```js
// models.js — flag anything owned by the cache
function cached(key, make) {
    if (!geoCache.has(key)) {
        const geo = make();
        geo.userData = { ...(geo.userData ?? {}), shared: true };
        geoCache.set(key, geo);
    }
    return geoCache.get(key);
}

// scene.js — dispose the per-mesh materials, never the shared geometry
export function disposeObject(obj) {
    obj.traverse?.((o) => {
        if (!o.geometry?.userData?.shared) o.geometry?.dispose?.();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.());
    });
}
```

## Fitting a fixed playfield at any aspect ratio, including portrait phones (game-040)

A shmup has a fixed arena (game-040: 20 × 28 world units) that must be fully visible on a 21:9
monitor *and* a 390×844 phone. Solve for the camera distance that satisfies **both** dimensions and
take the larger — portrait simply sits further back:

```js
const halfFov = (CAM.fov * Math.PI) / 360;
const needH = (ARENA.h * 1.06) / (2 * Math.tan(halfFov));
const needW = (ARENA.w * 1.10) / (2 * Math.tan(halfFov) * aspect);
camState.dist = Math.max(needH, needW);
camera.aspect = aspect;
camera.updateProjectionMatrix();
```

Re-run it from the resize handler. game-040's `dev/rendertest.mjs` asserts all four arena edges stay
pointer-reachable at 1920×1080, 1280×720, 390×844, 844×390 and 768×1024.

## Screen pixels → world coordinates without `unproject()` (game-040)

For a camera looking at a single plane, explicit ray maths is fewer moving parts than
`Vector3.unproject()` (which needs the matrices to be current) and stays testable headlessly:

```js
const ndcX = (px / w) * 2 - 1, ndcY = -((py / h) * 2 - 1), t = Math.tan(halfFov);
// forward = normalize(target - camera); right = normalize(cross(forward, up)); up' = cross(right, forward)
const dx = fx + rx * ndcX * t * (w / h) + ux * ndcY * t;   // and dy, dz the same way
const k = -cam.z / dz;                                      // intersect the z = 0 plane
return { x: cam.x + dx * k, y: cam.y + dy * k };
```

Mind the cross product: `cross(forward, (0,1,0))` is `(-fz, 0, fx)`. Getting that sign wrong mirrors
the pointer horizontally, which reads as "the controls are inverted" rather than as a maths bug.

## Testing three.js code in Node with a fake module (game-040)

three.js is CDN-loaded, so headless CI (or a sandbox with no network) cannot import it — but the
*view layer* is the part most likely to break silently. game-040 registers a Node
module-resolution hook that points `import 'three'` at a hand-written stand-in:

```js
// dev/hooks.mjs
export async function resolve(specifier, context, next) {
    if (specifier === 'three') return { url: new URL('./fake-three.mjs', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('three/addons/')) return { url: new URL('./fake-three-addons.mjs', import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
}

// in the harness, BEFORE importing any view module:
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
const { initScene } = await import('../js/view/scene.js');
```

Make the fake **hostile**, not permissive: throw on a non-finite `position`/`scale`, an undefined
material colour, a disposed material or geometry still reached during `render()`, and an
out-of-range `setMatrixAt`. That converts "the screen is black" into a stack trace naming the
object. See [game-040/dev/](../../game-040/dev/README.md) — it caught a shared-geometry disposal
bug, effects leaking across level changes, and several NaN transforms before the game was ever
opened in a browser.


## Tilted play surface in its own coordinate space (game-045)

A pinball table leans back from the camera. Rather than converting between simulation and world
coordinates everywhere, nest two groups: the root is tilted, and a child is offset so that
**its local space *is* the simulation's** (x across, y up the table, z = height above the glass):

```js
tableRoot = new THREE.Group();
tableRoot.rotation.x = -tilt;                    // lean back from vertical
table = new THREE.Group();
table.position.set(-centerX, -centerY, 0);       // table centre at the world origin
tableRoot.add(table);
// every view module: mesh.position.set(sim.x, sim.y, height); table.add(mesh)
```

Particles, shards, popups and trails all live in `table` too, so "fly up off the table" is just +z.

## Showing the horizon *and* a readable table (game-045)

Two angles decide it: the table's lean from vertical and the camera's elevation. The table reads
well when the angle between the view ray and the table plane is 60° or more, but the horizon is only
on screen if the camera looks down by less than half the vertical FOV. A 45° FOV, a table leaning
**30° from vertical** and a camera **7° above horizontal** satisfy both. The first attempt (55° lean,
25° camera) put the synthwave sun above the top of the screen.

Then fit the distance per aspect ratio (as in game-040): project the table's corners and
binary-search the camera distance until every corner lands inside the NDC box below the HUD, then
shift the look target so the leftover space is split evenly.

## Glass that fades toward the backdrop (game-045)

With the table surface fully opaque, the sun behind it was invisible in portrait. The surface shader
now fades its own alpha with height (`mix(0.94, 0.5, smoothstep(10.0, 27.0, vP.y))`), so the striped
sun glows *through* the glass behind the bricks while the flipper area stays dark and readable.

## Fake lights painted onto a surface shader (game-045)

Explosions light up the neon grid under them without a single `PointLight`. A small registry holds
short-lived `{x, y, radius, intensity, color}` lights, and the table surface shader takes the eight
brightest as `uniform vec4 uL[8]; uniform vec3 uLC[8];`, adding
`color * min(k, 1.5) * (0.1 + line * 0.8)` where `line` is the grid-line mask. The lights mostly
brighten the grid *lines*, which reads as neon rather than as a blob. Clamp the intensity. Uncapped,
three overlapping blasts blow the whole table out to white under bloom.

## Neon env map for chrome from a tiny generated scene (game-045)

`RoomEnvironment` makes chrome look like a grey photo studio. Instead, render a 10-unit sphere with a
banded shader (pink horizon line, cyan sky, dark grid floor, one warm hot-spot) through
`PMREMGenerator.fromScene(envScene, 0.02)` once at boot. Pass the result as `envMap` on a
`metalness: 1, roughness: 0.1` material, and the pinballs reflect the synthwave palette.

## Post chain with a custom pass: end with `OutputPass` (game-045)

`RenderPass → UnrealBloomPass → ShaderPass(CRT) → OutputPass`. The custom CRT pass (chromatic
aberration scaled by an impact uniform, scanlines, vignette, colour flash) works in linear space, and
`OutputPass` does the sRGB conversion last. Keep bloom at half resolution
(`bloom.resolution.set(w*pr/2, h*pr/2)`), which looks the same and costs a quarter of the fill.
Drive the post uniforms from the gameplay events (`aberrate()`, `flash()`), not from time.

## Two scenes, one composer: a pixel-exact UI layer over a 3D world (game-047)

A card game needs the table legible at any aspect ratio while the world behind it is a free 3D
scene. game-047 renders two scenes through one `EffectComposer`; the second `RenderPass` must not
clear colour but must clear depth, and both share the bloom/grade/output passes:

```js
composer.addPass(new RenderPass(worldScene, worldCam));
const cardPass = new RenderPass(cardScene, cardCam);
cardPass.clear = false;       // keep the world
cardPass.clearDepth = true;   // but never let world depth hide a card
composer.addPass(cardPass);
```

Place the card camera so that **one unit is one CSS pixel at z = 0** and lay everything out in
pixels, while cards still tilt, flip and lift in real perspective:

```js
cardCam.fov = 20;
const dist = h / (2 * Math.tan(cardCam.fov * Math.PI / 360));
cardCam.position.set(0, 0, dist);          // (0,0) = screen centre, +y up
// px → layer: x - w/2, h/2 - y
```

Hit-testing then needs no raycaster at all: cells and hand slots are rectangles in pixels.

## Framing a group into a screen region with `setViewOffset` (game-047)

To put the enemy line in the right 45% of a landscape screen (or the top quarter of a phone),
solve the distance from the group's size and the region's share of the screen, then move the
principal point onto the region's centre:

```js
const tan = Math.tan(cam.fov * Math.PI / 360);
const d = Math.max(W / (2 * tan * (w / h) * rw), H / (2 * tan * rh));   // rw, rh = region fractions
cam.position.set(0, lookY + d * 0.13, d);
cam.lookAt(0, lookY, 0);
cam.setViewOffset(w, h, w / 2 - regionCx, h / 2 - regionCy, w, h);    // centre → (regionCx, regionCy)
cam.updateProjectionMatrix();
```

Anything that must stand on the same ground line elsewhere on screen (the hero) is found by
casting a ray through its screen spot onto `y = 0`.

## Patching MeshStandardMaterial instead of writing a shader (game-047)

Monsters keep full PBR lighting and shadows but gain veins, rim light, a hit flash and a dissolve
by injecting into `onBeforeCompile`. Share uniform *objects* across a creature's materials so one
`uHit.value = 1` flashes the whole body, and set `customProgramCacheKey` when the injected code
differs between materials, or three.js reuses the first compiled program:

```js
m.onBeforeCompile = (sh) => {
    sh.uniforms.uHit = U.uHit;   // same object on every part
    sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    sh.fragmentShader = '...' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (noise3(vObjPos * 3.5) < uDissolve) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(uHit) + uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);');
};
m.customProgramCacheKey = () => `creature${glow ? 1 : 0}`;
```

`normal` and `vViewPosition` are already in scope at `emissivemap_fragment`.

## Smooth normals on a displaced icosahedron (game-047)

`IcosahedronGeometry` is non-indexed, so `computeVertexNormals()` after displacing it gives flat
facets. Delete `normal` and `uv`, `mergeVertices()` (from `three/addons/utils/BufferGeometryUtils.js`),
displace, then compute normals — shared vertices get one displacement and one smooth normal.

## Gotcha: `Object3D.add()` returns the parent (game-047)

`group.add(mesh).rotation.x = ...` rotates the **group**. Build the mesh, set its transform, then add it.

## Common gotchas

- **`updateProjectionMatrix()` missing** — see resize section above. Symptom: window resizes but render is squashed.
- **Forgetting to cap `clock.getDelta()`** — first frame after tab unhides can be huge, sending physics through walls.
- **`new THREE.Color(255, 0, 255)` is white** — `Color` constructor takes 0..1 floats. Use `rgb(...)` helper or hex.
- **Disposing geometries/materials** — three.js does not garbage-collect GPU resources. When you remove a mesh you're done with, call `mesh.geometry.dispose()` and `mesh.material.dispose()` to free GPU memory. Not noticeable for a few hundred meshes; matters for procedurally generated worlds (see game-018 dungeon system).
- **`renderOrder` vs `depthTest`** — for synthwave-style flat overlays (game-023 sun with stripe cutouts) you can set `material.depthTest = false` and `mesh.renderOrder = N` to force draw order independent of Z.
- **No built-in `lookAt` for sprite billboarding** — for sprites that always face the camera, use `THREE.Sprite` (always faces camera) or call `mesh.lookAt(camera.position)` each frame for planes.
- **Pixel ratio** — `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` is the safe default. Devices with `devicePixelRatio = 3` or `4` will tank performance otherwise.
- **CanvasTexture looks washed-out / wrong color** — set `tex.colorSpace = THREE.SRGBColorSpace` on textures built from a 2D canvas (game-024 popups/banner), or the sRGB→linear conversion is skipped and colors render dark/dull.
- **Lit material on a geometry with no `normal` attribute** — a hand-built `BufferGeometry` with only `position` works with `MeshBasicMaterial`/custom shaders, but a `MeshStandardMaterial` on it normalizes a zero vector. SwiftShader shrugs it off; real D3D/ANGLE GPUs produce Inf specular, and bloom smears it into a full-screen white-out (game-046 pit gloss sheet). Always `computeVertexNormals()` or set normals when a lit material touches the geometry. Test post-processing on a real GPU, not just the headless harness.
- **EffectComposer not resized** — if you use bloom, the composer must be resized in the window-resize handler alongside the renderer, or the glow buffer mismatches the canvas after a resize.

---

## Useful addons (from `three/addons/`)

Available with the import map setup:

- `postprocessing/EffectComposer.js` + `RenderPass.js` + `UnrealBloomPass.js` — bloom glow. **In use by game-024** (see Post-processing bloom above).
- `controls/OrbitControls.js` — mouse-drag camera (for debug scenes)
- `controls/PointerLockControls.js` — FPS-style mouse look (game-018 implements its own equivalent)
- `loaders/GLTFLoader.js` — load `.glb` / `.gltf` model files

To use: `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`

---

## References

- [three.js docs (r165)](https://threejs.org/docs/)
- [three.js examples](https://threejs.org/examples/)
- [game-024 — Neon Vanguard](../../game-024/) — top-down shmup; bloom, custom grid shader, canvas-sprite HUD text
- [game-040 — Starcadet](../../game-040/) — vertical bullet-hell shmup; instanced bullets, six shader backdrops, aspect-fitting camera, and a fake-three.js Node harness
- [game-045 — PINBREAK '86](../../game-045/) — pinball × breakout; tilted table rig, horizon-aware camera, fake surface lights, neon env map, CRT post pass, per-frame fx budgets
- [game-047 — Ashes & Aces](../../game-047/) — card roguelite; two-scene composer with a pixel-exact card layer, region-framed camera, patched PBR creatures, canvas-painted card faces with normal/foil maps
- [game-023 — Synthwave Invaders](../../game-023/) — reference implementation for new three.js games
- [game-018 — Village of Wandering Blade](../../game-018/) — large-scale three.js example
- [game-014 — TRACKRUNNER](../../game-014/) — legacy r128 pattern (do not copy for new games)
