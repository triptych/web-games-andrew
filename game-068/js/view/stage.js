/**
 * stage.js — renderer, scene, the camera that fits the whole map, the light of each act, and a
 * soft post chain (sanitize → bloom → grade).
 *
 * The camera looks down at the valley. It solves for the distance that fits the map inside the
 * space the HUD leaves (top bar, bottom tray) at any aspect, and on a portrait screen it turns 90°
 * so the road runs up the screen toward the Haven. Players can zoom in and pan from there.
 *
 * The canvas is sized in px by renderer.setSize (never 100vh: the game-058/067 bug), and every
 * screen ↔ world mapping goes through the canvas's bounding box.
 *
 * Quality tiers: 0 = full (pixel ratio ≤ 2, 2048 shadows, bloom), 1 = phone (≤ 1.5, 1024, bloom),
 * 2 = low (1, no shadows, no post).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H, THEMES, DUSK } from '../config.js';
import { night } from './materials.js';

export let renderer, scene, camera, composer;
let bloom, grade, quality = 1;
let sun, hemi, sky, stars, beaconLight;
let lastW = 0, lastH = 0, lastDpr = 0;
export const frame = { n: 0 };

export const rig = {
    yaw: 0, pitch: 0.98, fitDist: 30, zoom: 1, panX: 0, panZ: 0,
    insetTop: 64, insetBottom: 110, portrait: false, shake: 0,
    tx: 0, tz: 0, dist: 30, ty: 0, // current (eased)
    auto: 0,                       // slow orbit (title)
};

// A NaN or infinite pixel turns into a flashing box after bloom (the game-065 lesson): black it out first.
const SANITIZE = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = min(c, vec4(60000.0));
        }`,
};

const GRADE = {
    uniforms: { tDiffuse: { value: null }, uWarm: { value: 1 }, uVig: { value: 0.35 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.95, 0.8) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uWarm, uVig, uFlash; uniform vec3 uFlashCol; varying vec2 vUv;
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            c.rgb = mix(vec3(l), c.rgb, 1.08);
            c.rgb *= mix(vec3(1.0), vec3(1.04, 1.0, 0.95), uWarm);
            vec2 q = vUv - 0.5;
            c.rgb *= 1.0 - clamp(dot(q, q) * uVig * 2.0, 0.0, 0.6);
            c.rgb = mix(c.rgb, uFlashCol, clamp(uFlash, 0.0, 1.0));
            c.rgb = max(c.rgb, vec3(0.0));
            gl_FragColor = c;
        }`,
};

export function initStage(canvas, q) {
    quality = q;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q < 2, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.shadowMap.enabled = q < 2;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe9d7b8, 30, 90);
    camera = new THREE.PerspectiveCamera(38, 1, 0.3, 400);

    hemi = new THREE.HemisphereLight(0xfff0d8, 0x6a5a3a, 1.0);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
    sun.castShadow = q < 2;
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 90;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    sky = new THREE.Mesh(
        new THREE.SphereGeometry(300, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform vec3 uTop, uHor; varying vec3 vDir;
                void main(){ float h = clamp(vDir.y, 0.0, 1.0); gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.5)), 1.0); }`,
        }),
    );
    sky.renderOrder = -10;
    scene.add(sky);

    const sg = new THREE.BufferGeometry();
    const sp = [];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 600; i++) {
        const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.9);
        sp.push(Math.sin(ph) * Math.cos(th) * 280, Math.cos(ph) * 280, Math.sin(ph) * Math.sin(th) * 280);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(stars);

    beaconLight = new THREE.PointLight(0xffd27a, 0, 14, 1.6);
    scene.add(beaconLight);

    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(SANITIZE));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.82);
    composer.addPass(bloom);
    grade = new ShaderPass(GRADE);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    resize();
    return { renderer, scene, camera };
}

export const getQuality = () => quality;
export function setQuality(q) {
    quality = Math.max(0, Math.min(2, q | 0));
    renderer.shadowMap.enabled = quality < 2;
    sun.castShadow = quality < 2;
    const size = quality === 0 ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    lastDpr = 0;
    resize();
}

export function resize() {
    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv ? Math.min(vv.width, window.innerWidth) : window.innerWidth));
    const h = Math.max(1, Math.round(vv ? Math.min(vv.height, window.innerHeight) : window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 0 ? 2 : quality === 1 ? 1.5 : 1);
    if (w === lastW && h === lastH && dpr === lastDpr) return false;
    lastW = w; lastH = h; lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);           // sets the canvas's CSS size in px too
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rig.portrait = w / h < 0.85;
    fitCamera();
    return true;
}
export const viewSize = () => ({ w: lastW, h: lastH });

// ------------------------------------------------------------------ the light of an act
export function applyTheme(themeKey, dusk = false) {
    const T = { ...THEMES[themeKey], ...(dusk ? DUSK : {}) };
    sky.material.uniforms.uTop.value.setHex(T.skyTop);
    sky.material.uniforms.uHor.value.setHex(T.skyHor);
    scene.fog.color.setHex(T.fog);
    renderer.setClearColor(T.fog);
    sun.color.setHex(T.sun);
    sun.intensity = T.sunI;
    hemi.color.setHex(T.hemiSky);
    hemi.groundColor.setHex(T.hemiGround);
    hemi.intensity = T.hemiI;
    night.value = T.night;
    sun.position.set(-14, 26, 16);
    sun.target.position.set(0, 0, 0);
    stars.material.opacity = Math.max(0, (T.night - 0.4) / 0.6);
    bloom.strength = 0.22 + T.night * 0.5;
    bloom.threshold = 0.85 - T.night * 0.25;
    grade.uniforms.uWarm.value = themeKey === 'city' ? 0.2 : 1;
    grade.uniforms.uVig.value = 0.3 + T.night * 0.3;
    renderer.toneMappingExposure = 1.0 + T.night * 0.15;
    beaconLight.position.set(W / 2 - 1.6, 2.6, 0);
    return T;
}

export function setBeacon(x, z, power) {
    beaconLight.position.set(x, 2.8, z);
    beaconLight.intensity = power;
}

export function flash(v, col) {
    grade.uniforms.uFlash.value = v;
    if (col) grade.uniforms.uFlashCol.value.setHex(col);
}
export const getFlash = () => grade.uniforms.uFlash.value;

// ------------------------------------------------------------------ camera
const _v = new THREE.Vector3();
function placeCamera(tx, tz, dist, yaw, pitch) {
    const cp = Math.cos(pitch);
    camera.position.set(tx + Math.sin(yaw) * cp * dist, Math.sin(pitch) * dist, tz + Math.cos(yaw) * cp * dist);
    camera.lookAt(tx, 0, tz);
    camera.updateMatrixWorld();
}

function applyViewOffset() {
    const off = (rig.insetBottom - rig.insetTop) / 2;
    if (Math.abs(off) > 0.5 && lastH > 0) camera.setViewOffset(lastW, lastH, 0, off, lastW, lastH);
    else camera.clearViewOffset();
}

/** Solve for the distance that fits the whole map between the HUD's insets. */
export function fitCamera() {
    rig.yaw = rig.portrait ? -Math.PI / 2 : 0;
    rig.pitch = rig.portrait ? 0.98 : 0.88;
    applyViewOffset();
    const m = 0.2;
    const corners = [[-W / 2 - m, -H / 2 - m], [W / 2 + m, -H / 2 - m], [-W / 2 - m, H / 2 + m], [W / 2 + m, H / 2 + m]];
    const yTop = 1 - (2 * rig.insetTop) / lastH, yBot = 1 - (2 * (lastH - rig.insetBottom)) / lastH;
    const fits = (d) => {
        placeCamera(0, 0, d, rig.yaw, rig.pitch);
        for (const [x, z] of corners) {
            _v.set(x, 0, z).project(camera);
            if (_v.x < -0.98 || _v.x > 0.98 || _v.y > yTop || _v.y < yBot) return false;
        }
        return true;
    };
    let lo = 4, hi = 160;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    rig.fitDist = hi;
    placeCamera(rig.tx, rig.tz, rig.dist, rig.yaw, rig.pitch);
}

export function setInsets(top, bottom) {
    if (Math.abs(top - rig.insetTop) < 1 && Math.abs(bottom - rig.insetBottom) < 1) return;
    rig.insetTop = top; rig.insetBottom = bottom;
    fitCamera();
}

export function resetView() { rig.zoom = 1; rig.panX = 0; rig.panZ = 0; }
export function zoomBy(f) { rig.zoom = Math.max(0.32, Math.min(1.25, rig.zoom * f)); }
/** Pan by a distance on the ground (map units), e.g. the difference of two groundAt() points. */
export function panBy(dx, dz) { rig.panX += dx; rig.panZ += dz; clampPan(); }
function clampPan() {
    const lim = (1 - rig.zoom) * 0.75 + 0.15;
    rig.panX = Math.max(-W * lim, Math.min(W * lim, rig.panX));
    rig.panZ = Math.max(-H * lim, Math.min(H * lim, rig.panZ));
}

export function updateCamera(dt, t) {
    if (rig.auto) { rig.yaw = Math.sin(t * rig.auto) * 0.25 + (rig.portrait ? -Math.PI / 2 : 0); }
    clampPan();
    const k = 1 - Math.exp(-dt * 8);
    const goalDist = rig.fitDist * rig.zoom;
    rig.dist += (goalDist - rig.dist) * k;
    rig.tx += (rig.panX - rig.tx) * k;
    rig.tz += (rig.panZ - rig.tz) * k;
    let sx = 0, sz = 0;
    if (rig.shake > 0) {
        rig.shake = Math.max(0, rig.shake - dt * 1.8);
        sx = Math.sin(t * 61) * rig.shake * 0.25; sz = Math.cos(t * 47) * rig.shake * 0.25;
    }
    placeCamera(rig.tx + sx, rig.tz + sz, rig.dist, rig.yaw, rig.pitch);
    scene.fog.near = rig.dist * 1.1 + 6;
    scene.fog.far = rig.dist * 2.6 + 40;
}
export function snapCamera() { rig.dist = rig.fitDist * rig.zoom; rig.tx = rig.panX; rig.tz = rig.panZ; placeCamera(rig.tx, rig.tz, rig.dist, rig.yaw, rig.pitch); }

export function render() {
    frame.n++;
    if (quality >= 2) renderer.render(scene, camera);
    else composer.render();
}

// ------------------------------------------------------------------ picking
const _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
/** Map point (tile units, 0..W × 0..H) under a screen position, or null. */
export function groundAt(clientX, clientY, h = 0) {
    const r = renderer.domElement.getBoundingClientRect();
    _v2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_v2, camera);
    _plane.constant = -h;
    if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
    return { x: _hit.x + W / 2, z: _hit.z + H / 2 };
}
const _p = new THREE.Vector3();
/** Screen position (CSS px) of a map point (tile units) at height y, or null if behind the camera. */
export function toScreen(x, y, z) {
    _p.set(x - W / 2, y, z - H / 2).project(camera);
    if (_p.z > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (_p.x * 0.5 + 0.5) * r.width, y: r.top + (-_p.y * 0.5 + 0.5) * r.height };
}
