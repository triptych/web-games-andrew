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

## Common gotchas

- **`updateProjectionMatrix()` missing** — see resize section above. Symptom: window resizes but render is squashed.
- **Forgetting to cap `clock.getDelta()`** — first frame after tab unhides can be huge, sending physics through walls.
- **`new THREE.Color(255, 0, 255)` is white** — `Color` constructor takes 0..1 floats. Use `rgb(...)` helper or hex.
- **Disposing geometries/materials** — three.js does not garbage-collect GPU resources. When you remove a mesh you're done with, call `mesh.geometry.dispose()` and `mesh.material.dispose()` to free GPU memory. Not noticeable for a few hundred meshes; matters for procedurally generated worlds (see game-018 dungeon system).
- **`renderOrder` vs `depthTest`** — for synthwave-style flat overlays (game-023 sun with stripe cutouts) you can set `material.depthTest = false` and `mesh.renderOrder = N` to force draw order independent of Z.
- **No built-in `lookAt` for sprite billboarding** — for sprites that always face the camera, use `THREE.Sprite` (always faces camera) or call `mesh.lookAt(camera.position)` each frame for planes.
- **Pixel ratio** — `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` is the safe default. Devices with `devicePixelRatio = 3` or `4` will tank performance otherwise.
- **CanvasTexture looks washed-out / wrong color** — set `tex.colorSpace = THREE.SRGBColorSpace` on textures built from a 2D canvas (game-024 popups/banner), or the sRGB→linear conversion is skipped and colors render dark/dull.
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
- [game-023 — Synthwave Invaders](../../game-023/) — reference implementation for new three.js games
- [game-018 — Village of Wandering Blade](../../game-018/) — large-scale three.js example
- [game-014 — TRACKRUNNER](../../game-014/) — legacy r128 pattern (do not copy for new games)
