/**
 * scene.js — renderer, camera, lights, sky dome, fog, post-processing and
 * the camera fit.
 *
 * The camera is solved, not placed: every resize we search for the distance
 * and target at which the play area (keep + battlefield) fills the space
 * between the HUD bars. Landscape looks at the lanes from the front with the
 * castle on the left; portrait swings behind the castle so the lanes run up
 * the screen and every cell is big enough for a thumb.
 *
 * Shadows are static (the castle and scenery don't move): the shadow map is
 * re-rendered only when something asks for it.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { REGIONS } from '../config.js';

export let renderer, scene, camera;
let composer = null, bloom = null;
export let hemi, sun, sky;
const S = {
    quality: 2, portrait: false, w: 1, h: 1,
    target: new THREE.Vector3(2.5, 0, 0), dir: new THREE.Vector3(0, 0.8, 0.6), dist: 14,
    trauma: 0, punch: 0, t: 0, fov: 38,
};

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w;
}`;
const SKY_FS = /* glsl */`
uniform vec3 uTop, uBottom, uSunCol;
uniform vec3 uSunDir;
uniform float uNight, uTime, uBlackSun, uClouds;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
    vec3 d = normalize(vDir);
    float e = clamp(d.y, -0.2, 1.0);
    vec3 col = mix(uBottom, uTop, pow(max(e, 0.0), 0.55));
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    if (uBlackSun > 0.5) {
        float disc = smoothstep(0.9975, 0.998, sd);
        float corona = pow(sd, 120.0) * 2.5 + pow(sd, 12.0) * 0.4;
        col += vec3(1.0, 0.35, 0.1) * corona;
        col = mix(col, vec3(0.0), disc);
    } else {
        col += uSunCol * (pow(sd, 400.0) * 3.0 + pow(sd, 24.0) * 0.25 + pow(sd, 4.0) * 0.12);
    }
    // stars
    if (uNight > 0.01 && d.y > 0.0) {
        vec2 sp = d.xz / (d.y + 0.25) * 140.0;
        float st = step(0.996, h21(floor(sp))) * (0.6 + 0.4 * sin(uTime * 2.0 + h21(floor(sp) + 3.1) * 30.0));
        col += vec3(st) * uNight * smoothstep(0.0, 0.25, d.y);
    }
    // clouds
    if (d.y > 0.0) {
        vec2 cp = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime * 0.012, 0.0);
        float c = smoothstep(0.5, 0.85, fbm(cp)) * uClouds * smoothstep(0.0, 0.3, d.y);
        vec3 cc = mix(vec3(1.0), uSunCol, 0.35) * mix(1.0, 0.35, uNight);
        col = mix(col, cc, c * 0.7);
    }
    gl_FragColor = vec4(col, 1.0);
}`;

export function initScene(canvas, quality) {
    S.quality = quality;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: quality >= 1, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality >= 2 ? 2 : quality === 1 ? 1.5 : 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xb9d8e0, 28, 70);
    camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 220);

    hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.1);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1d4, 2.4);
    sun.castShadow = true;
    const sz = quality >= 2 ? 2048 : 1024;
    sun.shadow.mapSize.set(sz, sz);
    const c = sun.shadow.camera;
    c.left = -12; c.right = 12; c.top = 12; c.bottom = -12; c.near = 1; c.far = 60;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    sun.target.position.set(2, 0, 0);
    scene.add(sun, sun.target);

    sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
        vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
            uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
            uSunDir: { value: new THREE.Vector3(0.3, 0.5, -0.8) }, uNight: { value: 0 }, uTime: { value: 0 }, uBlackSun: { value: 0 }, uClouds: { value: 0.6 },
        },
    }));
    sky.renderOrder = -10;
    scene.add(sky);

    if (quality >= 1) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 0.9);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
    }
    return renderer;
}

export const getQuality = () => S.quality;
export function setPixelQuality(q) {
    S.quality = q;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q === 1 ? 1.5 : 1));
    resize(S.w, S.h, S.safe);
}

// ------------------------------------------------------------------ Look (region + time of day)

const _a = new THREE.Color(), _b = new THREE.Color();
/**
 * tod: 0 morning → 0.55 afternoon → 0.8 dusk → 1 night. dark: Long Night grading.
 */
export function setLook(regionIdx, tod, dark = false) {
    const R = REGIONS[regionIdx];
    const night = THREE.MathUtils.smoothstep(tod, 0.72, 1.0) * (R.id === 'gloamhold' ? 0.6 : 1) + (R.id === 'gloamhold' ? 0.4 : 0) + (dark ? 0.3 : 0);
    const n = Math.min(1, night);
    const dusk = Math.max(0, 1 - Math.abs(tod - 0.8) / 0.18) * (R.id === 'dragonspire' || R.id === 'gloamhold' ? 0.3 : 1);
    const u = sky.material.uniforms;
    u.uTop.value.set(R.sky.top).lerp(_a.set('#0a0e22'), n * 0.85);
    u.uBottom.value.set(R.sky.bottom).lerp(_a.set('#ff9a5a'), dusk * 0.5).lerp(_b.set('#1a1830'), n * 0.8);
    u.uSunCol.value.set(R.sky.sun).lerp(_a.set('#ff8a4a'), dusk * 0.6);
    u.uNight.value = n;
    u.uBlackSun.value = R.id === 'dragonspire' ? 1 : 0;
    u.uClouds.value = R.id === 'frostfell' ? 0.8 : R.id === 'dragonspire' ? 0.4 : 0.6;
    // Sun arcs over the battlefield; at night the "sun" is the moon.
    const ang = THREE.MathUtils.lerp(0.35, 2.7, Math.min(tod, 0.85) / 0.85);
    const sd = new THREE.Vector3(Math.cos(ang) * 0.7, Math.sin(ang) * 0.8 + 0.25, -0.65).normalize();
    if (n > 0.6) sd.set(-0.4, 0.75, -0.55).normalize();
    u.uSunDir.value.copy(sd);
    sun.position.copy(sd).multiplyScalar(30).add(new THREE.Vector3(2, 0, 0));
    sun.color.set(R.sky.sun).lerp(_a.set('#ff9a5a'), dusk * 0.6).lerp(_b.set('#8aa0ff'), n);
    if (R.id === 'dragonspire') sun.color.set('#ff7a4a').lerp(_b.set('#ff4a2a'), n);
    sun.intensity = THREE.MathUtils.lerp(2.5, 0.75, n) * (R.id === 'dragonspire' ? 0.8 : 1);
    hemi.color.set(R.sky.top).lerp(_a.set('#ffffff'), 0.4).lerp(_b.set('#4a5a9a'), n * 0.7);
    hemi.groundColor.set(R.ground[0]).multiplyScalar(0.6);
    hemi.intensity = THREE.MathUtils.lerp(1.15, 0.55, n);
    scene.fog.color.set(R.fog).lerp(_a.set('#14142a'), n * 0.75);
    scene.fog.near = R.id === 'mirefen' ? 16 : 26;
    scene.fog.far = R.id === 'mirefen' ? 55 : 75;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 1.25, n);
    if (bloom) bloom.strength = THREE.MathUtils.lerp(0.45, 0.75, n);
    renderer.shadowMap.needsUpdate = true;
    return n;
}

export function requestShadows() { renderer.shadowMap.needsUpdate = true; }

// ------------------------------------------------------------------ Camera fit

const BOX_LAND = [new THREE.Vector3(-5.6, 0, -3.3), new THREE.Vector3(10.7, 2.0, 3.3)];
const BOX_COMPACT = [new THREE.Vector3(-2.3, 0, -3.15), new THREE.Vector3(10.6, 1.2, 3.15)];
const BOX_PORT = [new THREE.Vector3(-1.7, 0, -3.05), new THREE.Vector3(10.4, 1.0, 3.05)];
const _v = new THREE.Vector3();

function boxNdc(box, out) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? box[1].x : box[0].x, i & 2 ? box[1].y : box[0].y, i & 4 ? box[1].z : box[0].z).project(camera);
        x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
    }
    out.x0 = x0; out.x1 = x1; out.y0 = y0; out.y1 = y1;
    return out;
}

function placeCamera() {
    camera.position.copy(S.target).addScaledVector(S.dir, S.dist);
    camera.lookAt(S.target);
    camera.updateMatrixWorld();
}

/**
 * safe: px insets {top, bottom, left, right} the play area must avoid (HUD).
 */
export function resize(w, h, safe = { top: 0, bottom: 0, left: 0, right: 0 }, compact = S.compact ?? false) {
    S.w = w; S.h = h; S.safe = safe; S.compact = compact;
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    S.portrait = h > w * 1.05;
    camera.fov = S.portrait ? 40 : 36;
    camera.updateProjectionMatrix();
    const el = THREE.MathUtils.degToRad(S.portrait ? 67 : compact ? 56 : 50);
    if (S.portrait) S.dir.set(-Math.cos(el), Math.sin(el), 0);
    else S.dir.set(0, Math.sin(el), Math.cos(el));
    const box = S.portrait ? BOX_PORT : compact ? BOX_COMPACT : BOX_LAND;
    S.target.set((box[0].x + box[1].x) / 2, 0, 0);
    // Safe rectangle in NDC.
    const sl = -1 + 2 * safe.left / w, sr = 1 - 2 * safe.right / w;
    const st = 1 - 2 * safe.top / h, sb = -1 + 2 * safe.bottom / h;
    const r = {};
    for (let iter = 0; iter < 4; iter++) {
        let lo = 3, hi = 80;
        for (let k = 0; k < 28; k++) {
            S.dist = (lo + hi) / 2;
            placeCamera();
            boxNdc(box, r);
            const fits = (r.x1 - r.x0) <= (sr - sl) && (r.y1 - r.y0) <= (st - sb);
            if (fits) hi = S.dist; else lo = S.dist;
        }
        S.dist = hi;
        placeCamera();
        boxNdc(box, r);
        // Re-centre the box inside the safe rect by sliding the target.
        const dx = ((sl + sr) / 2 - (r.x0 + r.x1) / 2);
        const dy = ((sb + st) / 2 - (r.y0 + r.y1) / 2);
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * S.dist;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        S.target.addScaledVector(right, -dx * halfH * camera.aspect);
        // Moving along screen-up on the ground plane: project up onto the ground.
        const upG = up.clone().setY(0);
        if (upG.lengthSq() > 1e-6) { upG.normalize(); S.target.addScaledVector(upG, -dy * halfH / Math.max(0.3, Math.sin(Math.asin(S.dir.y)))); }
    }
    placeCamera();
    S.base = camera.position.clone();
    S.baseQ = camera.quaternion.clone();
}

export const isPortrait = () => S.portrait;

// ------------------------------------------------------------------ Juice

export function shake(amount) { S.trauma = Math.min(1, S.trauma + amount); }
export function punch(amount) { S.punch = Math.min(0.6, S.punch + amount); }

export function render(dt, time) {
    S.t += dt;
    sky.material.uniforms.uTime.value = time;
    sky.position.copy(camera.position);
    if (S.base) {
        S.trauma = Math.max(0, S.trauma - dt * 1.6);
        S.punch = Math.max(0, S.punch - dt * 3);
        const k = S.trauma * S.trauma * 0.18;
        camera.position.copy(S.base);
        camera.quaternion.copy(S.baseQ);
        if (k > 0) {
            camera.position.x += (Math.sin(S.t * 41) + Math.sin(S.t * 23.3)) * k;
            camera.position.y += (Math.sin(S.t * 37) + Math.sin(S.t * 19.1)) * k * 0.6;
            camera.rotateZ(Math.sin(S.t * 29) * k * 0.05);
        }
        if (S.punch > 0) camera.position.addScaledVector(S.dir, -S.punch * 0.8);
    }
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
}

// ------------------------------------------------------------------ Picking

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

/** Screen px → point on the ground (y = h). */
export function screenToGround(px, py, h = 0) {
    const rect = renderer.domElement.getBoundingClientRect();
    _ndc.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc, camera);
    _plane.constant = -h;
    return _ray.ray.intersectPlane(_plane, _hit) ? _hit.clone() : null;
}

/** World → screen px (relative to the canvas' page position). */
export function worldToScreen(v, out = { x: 0, y: 0, behind: false }) {
    _v.copy(v).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    out.x = rect.left + (_v.x * 0.5 + 0.5) * rect.width;
    out.y = rect.top + (-_v.y * 0.5 + 0.5) * rect.height;
    out.behind = _v.z > 1;
    return out;
}
