// stage.js — renderer, camera, orbit controls, ink outlines, lights, sky and ocean.
// `weather` (0 clear .. 1 storm) darkens the sky, sea and lights together.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { PALETTE, setMaxAnisotropy, NO_OUTLINE } from './toon.js';
import { tween, ease } from './anim.js';

export let renderer, scene, camera, controls, outline;
export const clock = new THREE.Clock();
export const uniforms = {
    uTime: { value: 0 },
    uStorm: { value: 0 },
};

let hemi, sun, sky, ocean, fitDistance = 14;
const ISLANDS = [];   // vec4(x, z, radius, 0) for shallows and foam around islands

export function initStage(container) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.skyHorizon);
    scene.fog = new THREE.Fog(PALETTE.skyHorizon, 45, 190);

    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 900);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.22;
    controls.target.set(0, 0, 0.15);

    outline = new OutlineEffect(renderer, { defaultThickness: 0.004, defaultColor: [0.12, 0.1, 0.14], defaultAlpha: 1 });

    hemi = new THREE.HemisphereLight(0xe6f6ff, 0x6fb3c8, 1.55);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.position.set(-7, 14, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfe6ff, 0.55);
    fill.position.set(6, 5, -8);
    scene.add(fill);

    buildSky();
    buildOcean();
    fitCamera(1, true);
    window.addEventListener('resize', onResize);
}

export function addIsland(x, z, r) { if (ISLANDS.length < 8) ISLANDS.push(new THREE.Vector4(x, z, r, 0)); }

function buildSky() {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
            uTop: { value: new THREE.Color(PALETTE.skyTop) },
            uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
            uSun: { value: new THREE.Vector3(-7, 9, 6).normalize() },
            uStorm: uniforms.uStorm,
            uTime: uniforms.uTime,
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
            uniform vec3 uTop, uHorizon, uSun; uniform float uStorm, uTime; varying vec3 vDir;
            void main(){
                float h = clamp(vDir.y, 0.0, 1.0);
                vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
                // banded toon glow around the sun
                float s = dot(normalize(vDir), uSun);
                if (s > 0.9985) col = vec3(1.0, 0.99, 0.9);
                else if (s > 0.995) col = mix(col, vec3(1.0, 0.97, 0.82), 0.7);
                else if (s > 0.975) col = mix(col, vec3(1.0, 0.98, 0.9), 0.25);
                vec3 storm = mix(vec3(0.42, 0.47, 0.55), vec3(0.25, 0.28, 0.34), h);
                col = mix(col, storm, uStorm);
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
    });
    mat.userData.outlineParameters = NO_OUTLINE;
    sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
    sky.renderOrder = -10;
    scene.add(sky);
}

function buildOcean() {
    const geo = new THREE.PlaneGeometry(560, 560, 200, 200);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: uniforms.uTime, uStorm: uniforms.uStorm,
            uDeep: { value: new THREE.Color(PALETTE.oceanDeep) },
            uMid: { value: new THREE.Color(PALETTE.oceanMid) },
            uShallow: { value: new THREE.Color(PALETTE.oceanShallow) },
            uFoam: { value: new THREE.Color(0xffffff) },
            uFog: { value: new THREE.Color(PALETTE.skyHorizon) },
            uIslands: { value: ISLANDS },
            uIslandCount: { value: 0 },
        },
        vertexShader: `
            uniform float uTime, uStorm; varying vec3 vWorld; varying float vH;
            void main(){
                vec4 w = modelMatrix * vec4(position, 1.0);
                float d = max(abs(w.x), abs(w.z));
                float amp = (smoothstep(5.2, 16.0, d) * 0.22 + 0.02) * (1.0 + uStorm * 1.8);
                float h = sin(w.x * 0.33 + uTime * 0.9) * 0.6 + sin(w.z * 0.41 - uTime * 1.05 + w.x * 0.15) * 0.5 + sin((w.x + w.z) * 0.8 + uTime * 1.7) * 0.25;
                w.y += h * amp;
                vH = h; vWorld = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }`,
        fragmentShader: `
            uniform float uTime, uStorm; uniform vec3 uDeep, uMid, uShallow, uFoam, uFog;
            uniform vec4 uIslands[8]; uniform int uIslandCount;
            varying vec3 vWorld; varying float vH;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            void main(){
                vec2 p = vWorld.xz;
                vec3 col = uMid;
                float band = vH + sin(p.x * 0.21 + p.y * 0.17) * 0.4;
                if (band > 1.15) col = mix(uMid, uShallow, 0.35);
                else if (band < -1.0) col = mix(uMid, uDeep, 0.7);
                // shallows + surf around islands
                float shore = 1e3;
                for (int i = 0; i < 8; i++) {
                    if (i >= uIslandCount) break;
                    float dd = length(p - uIslands[i].xy) - uIslands[i].z;
                    shore = min(shore, dd);
                }
                if (shore < 3.0) col = mix(col, uShallow, 0.75);
                float wob = sin(atan(p.y, p.x) * 23.0 + uTime * 1.6) * 0.12;
                if (shore < 0.35 + wob && shore > -0.6) col = uFoam;
                // foam around the dock
                float dock = max(abs(p.x), abs(p.y));
                float edge = dock - 4.8 + sin((p.x + p.y) * 3.0 + uTime * 2.2) * 0.05;
                if (edge < 0.12) col = mix(col, uFoam, 0.95);
                else if (edge < 1.4 && fract(edge * 1.1 - uTime * 0.3) < 0.07) col = mix(col, uFoam, 0.55 * (1.0 - edge / 1.4));
                // wind-blown foam streaks
                float f = sin(p.x * 0.9 + sin(p.y * 0.7 + uTime * 0.8) * 1.6 + uTime * 0.5) * sin(p.y * 0.8 - uTime * 0.45 + sin(p.x * 0.55) * 1.4);
                if (f > 0.93 - uStorm * 0.25) col = mix(col, uFoam, 0.7);
                // glints
                vec2 g = floor(p * 1.6);
                if (hash(g + floor(uTime * 0.9)) > 0.992) {
                    vec2 q = fract(p * 1.6) - 0.5;
                    float s = 1.0 - smoothstep(0.0, 0.09, abs(q.x) * abs(q.y) * 30.0 + length(q) * 0.5);
                    col = mix(col, vec3(1.0), s);
                }
                col = mix(col, col * vec3(0.42, 0.5, 0.58), uStorm);
                float fogF = smoothstep(40.0, 230.0, length(vWorld - cameraPosition));
                vec3 fogC = mix(uFog, vec3(0.38, 0.42, 0.5), uStorm);
                col = mix(col, fogC, fogF);
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
    });
    mat.userData.outlineParameters = NO_OUTLINE;
    ocean = new THREE.Mesh(geo, mat);
    ocean.position.y = -0.14;
    scene.add(ocean);
}

export function finalizeIslands() { ocean.material.uniforms.uIslandCount.value = ISLANDS.length; }

// Screen space the HUD covers (px). The board is framed in what's left, and the
// projection is shifted with setViewOffset so it sits centred in that space.
const insets = { left: 0, right: 0, top: 0, bottom: 0 };
export function setInsets(v) {
    Object.assign(insets, v);
    applyViewOffset();
}
function applyViewOffset() {
    const W = window.innerWidth, H = window.innerHeight;
    const dx = (insets.right - insets.left) / 2, dy = (insets.bottom - insets.top) / 2;
    if (dx || dy) camera.setViewOffset(W, H, dx, dy, W, H);
    else camera.clearViewOffset();
}

/** Camera distance that fits the dock (about 11 units square) in the free area. */
function computeFit() {
    const aw = Math.max(200, window.innerWidth - insets.left - insets.right);
    const ah = Math.max(200, window.innerHeight - insets.top - insets.bottom);
    // Frame against the free area: shrink the effective FOV by the fraction left free.
    const aspect = aw / ah;
    const tall = aspect < 0.8;
    const vfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (ah / window.innerHeight));
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    // On tall screens look further down and crop to the planks, so the board fills the width.
    const need = tall ? 5.0 : 5.7;
    const dW = need / Math.tan(hfov / 2);
    const dH = (need * 0.8) / Math.tan(vfov / 2);
    return Math.max(dW, dH) * 0.98;
}

const POLAR_WIDE = 0.86, POLAR_TALL = 0.6;
const polarNow = () => {
    const aw = window.innerWidth - insets.left - insets.right, ah = window.innerHeight - insets.top - insets.bottom;
    return aw / ah < 0.8 ? POLAR_TALL : POLAR_WIDE;
};
let side = 1;   // 1 = Navy at the bottom of the screen, -1 = Pirates
export function fitCamera(viewSide = side, snap = false) {
    side = viewSide;
    fitDistance = computeFit();
    controls.minDistance = fitDistance * 0.55;
    controls.maxDistance = Math.max(fitDistance * 1.35, 24);
    const polar = polarNow();
    const theta = side > 0 ? 0 : Math.PI;
    const p = new THREE.Vector3().setFromSphericalCoords(fitDistance, polar, theta).add(controls.target);
    if (snap) { camera.position.copy(p); controls.update(); }
    return p;
}

/** Swing the camera round to a side's view. */
export function turnCamera(viewSide, dur = 1.1) {
    side = viewSide;
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    fitDistance = computeFit();
    const toTheta = viewSide > 0 ? 0 : Math.PI;
    let d = (toTheta - from.theta) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    const r0 = from.radius, p0 = from.phi, t0 = from.theta;
    return tween(dur, (k) => {
        const s = new THREE.Spherical(r0 + (fitDistance - r0) * k, p0 + (polarNow() - p0) * k, t0 + d * k);
        camera.position.setFromSpherical(s).add(controls.target);
    }, ease.inOut);
}
export const viewSide = () => side;

export function setWeather(target, dur = 0.8) {
    const a = uniforms.uStorm.value;
    return tween(dur, (k) => {
        const w = a + (target - a) * k;
        uniforms.uStorm.value = w;
        hemi.intensity = 1.55 - w * 0.75;
        sun.intensity = 2.1 - w * 1.5;
        scene.background.setHex(PALETTE.skyHorizon).lerp(new THREE.Color(0x5d6673), w);
        scene.fog.color.copy(scene.background);
    }, ease.inOut);
}

export function lightningFlash(strength = 1) {
    const base = hemi.intensity;
    return tween(0.35, (k) => { hemi.intensity = base + (1 - k) * 3.5 * strength; }, ease.out).then(() => { hemi.intensity = base; });
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (onResizeHook) onResizeHook();
    applyViewOffset();
    const old = fitDistance;
    fitDistance = computeFit();
    controls.minDistance = fitDistance * 0.55;
    controls.maxDistance = Math.max(fitDistance * 1.35, 24);
    // Keep the same zoom relative to the fit.
    const off = camera.position.clone().sub(controls.target);
    off.multiplyScalar(fitDistance / old);
    camera.position.copy(controls.target).add(off);
}

let onResizeHook = null;
export function onResizeCall(fn) { onResizeHook = fn; }

export function render() {
    outline.render(scene, camera);
}
