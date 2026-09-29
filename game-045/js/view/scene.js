/**
 * scene.js — renderer, camera, post-processing chain and camera juice.
 *
 * Exports live bindings — every other view module imports and uses these.
 *
 *   tableRoot  — tilted group; the table leans back ~55° from vertical
 *   table      — child of tableRoot in *simulation* coordinates, so a view
 *                module can place a mesh at (sim.x, sim.y, height) directly
 *
 * Post chain: RenderPass → UnrealBloom → CRT (chromatic aberration, scanlines,
 * vignette, colour flash) → OutputPass (sRGB). The CRT uniforms are driven by
 * the juice director through shake() / flash() / aberrate() / punch().
 */

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { CAM, COLORS, TABLE } from '../config.js';

export let renderer, scene, camera, composer, tableRoot, table;
export const clock = new THREE.Clock();

let bloom, crt;
const TABLE_CENTER = new THREE.Vector3(TABLE.arcCx, 14, 0);

// Camera rig state
const rig = {
    dist: 40,
    target: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    follow: new THREE.Vector3(),       // smoothed look-offset toward the action
    trauma: 0,                          // screen shake, 0..1 (offset = trauma²)
    punch: 0,                           // FOV kick
    flash: 0,
    flashColor: new THREE.Color(1, 1, 1),
    aberr: 0,
    sway: 0,                            // attract-mode drift amount
    t: 0,
};

let quality = 0;                        // 0 = full, 1 = reduced, 2 = low

const CRTShader = {
    uniforms: {
        tDiffuse:   { value: null },
        uTime:      { value: 0 },
        uAberr:     { value: 0 },
        uFlash:     { value: 0 },
        uFlashColor:{ value: new THREE.Color(1, 1, 1) },
        uScan:      { value: 0.12 },
        uVignette:  { value: 1.25 },
        uRes:       { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uAberr, uFlash, uScan, uVignette;
        uniform vec3 uFlashColor;
        uniform vec2 uRes;
        varying vec2 vUv;
        void main() {
            vec2 c = vUv - 0.5;
            float d = dot(c, c);
            // Chromatic aberration grows toward the edges and spikes on impacts.
            vec2 off = c * (0.001 + uAberr * 0.011) * (0.5 + d * 2.0);
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + off).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - off).b;
            // Rolling scanlines.
            float s = 0.5 + 0.5 * sin(vUv.y * uRes.y * 1.3 + uTime * 6.0);
            col *= 1.0 - uScan * (1.0 - s);
            // Vignette.
            col *= clamp(1.0 - d * uVignette, 0.0, 1.0);
            col += uFlashColor * uFlash;
            gl_FragColor = vec4(col, 1.0);
        }
    `,
};

export function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(COLORS.bg);
    document.body.prepend(renderer.domElement);
    renderer.domElement.id = 'game-canvas';

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 2500);

    // Table rig: tilt the root, then offset so the table centre sits at the origin.
    tableRoot = new THREE.Group();
    tableRoot.rotation.x = -CAM.tableTilt;
    scene.add(tableRoot);
    table = new THREE.Group();
    table.position.copy(TABLE_CENTER).multiplyScalar(-1);
    tableRoot.add(table);

    scene.add(new THREE.AmbientLight(0x8866ff, 0.55));
    const key = new THREE.DirectionalLight(0xffc0f0, 1.4);
    key.position.set(-6, 20, 14);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x35f2ff, 1.0);
    rim.position.set(8, 5, -6);
    scene.add(rim);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 0.78);
    composer.addPass(bloom);
    crt = new ShaderPass(CRTShader);
    composer.addPass(crt);
    composer.addPass(new OutputPass());

    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    setQuality(coarse ? 1 : 0);

    window.addEventListener('resize', onResize);
    onResize();
}

export function setQuality(q) {
    quality = Math.max(0, Math.min(2, q));
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, [2, 1.5, 1][quality]));
    bloom.strength = [0.7, 0.62, 0.5][quality];
    crt.uniforms.uScan.value = quality === 0 ? 0.12 : 0;
    onResize();
}
export function getQuality() { return quality; }

function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    // Bloom at reduced resolution is visually identical and far cheaper.
    const pr = renderer.getPixelRatio();
    bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
    crt.uniforms.uRes.value.set(w * pr, h * pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera(w, h);
}

/**
 * Pick the camera distance that keeps the whole table on screen at the
 * current aspect ratio (landscape monitor or portrait phone), leaving room
 * for the HUD row at the top.
 */
function fitCamera(w, h) {
    const e = CAM.elevation;
    rig.dir.set(0, Math.sin(e), Math.cos(e));
    rig.target.set(0, 0, 0);

    const pts = [
        [TABLE.left, 0, 0], [TABLE.laneOuter, 0, 0],
        [TABLE.left, TABLE.arcCy, 0], [TABLE.laneOuter, TABLE.arcCy, 0],
        [TABLE.arcCx, TABLE.arcCy + TABLE.arcR, 0],
        [TABLE.left, 0, 0.8], [TABLE.laneOuter, 0, 0.8],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    tableRoot.updateMatrixWorld(true);
    const world = pts.map((p) => table.localToWorld(p.clone()));

    const hudPx = w < 640 ? 118 : 78;
    const topLimit = 1 - (2 * hudPx) / h;
    const bottomLimit = -0.97;
    const side = 0.97;
    const v = new THREE.Vector3();

    const fits = (d, shift) => {
        camera.position.copy(rig.dir).multiplyScalar(d);
        camera.position.y += shift;
        camera.lookAt(0, shift, 0);
        camera.updateMatrixWorld(true);
        let minY = 9, maxY = -9, maxX = 0;
        for (const p of world) {
            v.copy(p).project(camera);
            minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
            maxX = Math.max(maxX, Math.abs(v.x));
        }
        return { ok: maxX <= side && maxY <= topLimit && minY >= bottomLimit, minY, maxY };
    };

    // Binary-search the distance, then nudge the camera vertically so the
    // table is centred in the space below the HUD.
    let lo = 5, hi = 400, shift = 0;
    for (let pass = 0; pass < 2; pass++) {
        lo = 5; hi = 400;
        for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid, shift).ok) hi = mid; else lo = mid;
        }
        const r = fits(hi, shift);
        const excess = ((topLimit - r.maxY) - (r.minY - bottomLimit)) / 2;
        // Convert an NDC offset to a world shift at the target distance.
        const worldPerNdc = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * hi;
        shift -= excess * worldPerNdc;
    }
    rig.dist = hi;
    rig.target.set(0, shift, 0);
}

// ------------------------------------------------------------------ Juice API

export function shake(amount) { rig.trauma = Math.min(1, rig.trauma + amount); }
export function punch(amount) { rig.punch = Math.min(6, rig.punch + amount); }
export function aberrate(amount) { rig.aberr = Math.min(1, rig.aberr + amount); }
export function flash(amount, color = 0xffffff) {
    rig.flash = Math.min(0.35, Math.max(rig.flash, amount));
    rig.flashColor.set(color);
}
export function setSway(v) { rig.sway = v; }

/** Smoothly lean the camera toward a point on the table (sim coords). */
export function setFollow(x, y) {
    rig.follow.set((x - TABLE_CENTER.x) * 0.05, (y - TABLE_CENTER.y) * 0.05, 0);
}

const _off = new THREE.Vector3();
const _look = new THREE.Vector3();
let _followNow = new THREE.Vector3();

export function renderFrame(dt, time) {
    rig.t += dt;
    rig.trauma = Math.max(0, rig.trauma - dt * 1.7);
    rig.punch *= Math.pow(0.02, dt);
    rig.aberr *= Math.pow(0.05, dt);
    rig.flash *= Math.pow(0.004, dt);

    _followNow.lerp(rig.follow, Math.min(1, dt * 2.5));

    // Base position, plus attract-mode sway.
    camera.position.copy(rig.dir).multiplyScalar(rig.dist).add(rig.target);
    camera.position.x += Math.sin(rig.t * 0.23) * rig.sway * rig.dist * 0.12;
    camera.position.y += Math.sin(rig.t * 0.17) * rig.sway * rig.dist * 0.04;
    _look.copy(rig.target).add(_followNow);

    // Screen shake: perlin-ish via summed sines, scaled by trauma².
    const s = rig.trauma * rig.trauma;
    if (s > 0.0001) {
        const k = s * 0.9;
        _off.set(
            (Math.sin(rig.t * 71.3) + Math.sin(rig.t * 43.1)) * k,
            (Math.sin(rig.t * 63.7) + Math.sin(rig.t * 37.9)) * k,
            0,
        );
        camera.position.add(_off);
        _look.addScaledVector(_off, 0.6);
    }
    camera.lookAt(_look);
    camera.rotateZ((Math.sin(rig.t * 29.1)) * s * 0.03);

    const fov = CAM.fov - rig.punch;
    if (Math.abs(camera.fov - fov) > 0.001) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }

    crt.uniforms.uTime.value = time;
    crt.uniforms.uAberr.value = rig.aberr;
    crt.uniforms.uFlash.value = rig.flash;
    crt.uniforms.uFlashColor.value.copy(rig.flashColor);

    composer.render();
}
