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
});
```

`updateProjectionMatrix()` is easy to forget and causes silent breakage — the aspect changes but the rendered image does not.

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

## Common gotchas

- **`updateProjectionMatrix()` missing** — see resize section above. Symptom: window resizes but render is squashed.
- **Forgetting to cap `clock.getDelta()`** — first frame after tab unhides can be huge, sending physics through walls.
- **`new THREE.Color(255, 0, 255)` is white** — `Color` constructor takes 0..1 floats. Use `rgb(...)` helper or hex.
- **Disposing geometries/materials** — three.js does not garbage-collect GPU resources. When you remove a mesh you're done with, call `mesh.geometry.dispose()` and `mesh.material.dispose()` to free GPU memory. Not noticeable for a few hundred meshes; matters for procedurally generated worlds (see game-018 dungeon system).
- **`renderOrder` vs `depthTest`** — for synthwave-style flat overlays (game-023 sun with stripe cutouts) you can set `material.depthTest = false` and `mesh.renderOrder = N` to force draw order independent of Z.
- **No built-in `lookAt` for sprite billboarding** — for sprites that always face the camera, use `THREE.Sprite` (always faces camera) or call `mesh.lookAt(camera.position)` each frame for planes.
- **Pixel ratio** — `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` is the safe default. Devices with `devicePixelRatio = 3` or `4` will tank performance otherwise.

---

## Useful addons (from `three/addons/`)

Not used by any current game in this repo, but available with the import map setup:

- `controls/OrbitControls.js` — mouse-drag camera (for debug scenes)
- `controls/PointerLockControls.js` — FPS-style mouse look (game-018 implements its own equivalent)
- `loaders/GLTFLoader.js` — load `.glb` / `.gltf` model files
- `postprocessing/EffectComposer.js` — bloom, FXAA, etc. (alternative to game-019's DOM-canvas CRT overlay)

To use: `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`

---

## References

- [three.js docs (r165)](https://threejs.org/docs/)
- [three.js examples](https://threejs.org/examples/)
- [game-023 — Synthwave Invaders](../../game-023/) — reference implementation for new three.js games
- [game-018 — Village of Wandering Blade](../../game-018/) — large-scale three.js example
- [game-014 — TRACKRUNNER](../../game-014/) — legacy r128 pattern (do not copy for new games)
