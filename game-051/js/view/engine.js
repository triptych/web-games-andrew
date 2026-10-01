/**
 * engine.js — one WebGL renderer shared by every scene, resize handling,
 * adaptive quality for phones, screen projection and picking helpers.
 *
 * A "stage" is { scene, camera, update(dt, t), resize?(w, h), pick?(x, y) }.
 */

import * as THREE from 'three';

export let renderer = null;
let canvas = null;
let current = null;
let quality = 0; // 0 high, 1 medium, 2 low
let forcedQuality = null;
const frameTimes = [];
let lastDrop = 0;
export const size = { w: 1, h: 1, dpr: 1 };

const DPR_CAP = [2, 1.5, 1];

export function initEngine(host) {
    canvas = document.createElement('canvas');
    canvas.id = 'gl';
    host.appendChild(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor('#0c0a18');
    const saved = localStorage.getItem('sigilborn.quality');
    if (saved !== null && saved !== 'auto') forcedQuality = +saved;
    quality = forcedQuality ?? (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 500 ? 1 : 0);
    resize();
    addEventListener('resize', resize);
    return renderer;
}

export function resize() {
    if (!renderer) return;
    const w = innerWidth, h = innerHeight;
    size.w = w; size.h = h;
    size.dpr = Math.min(devicePixelRatio || 1, DPR_CAP[quality]);
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (current) fitCamera(current);
}

function fitCamera(stage) {
    if (stage.camera.isPerspectiveCamera) {
        stage.camera.aspect = size.w / size.h;
        stage.camera.updateProjectionMatrix();
    }
    if (stage.resize) stage.resize(size.w, size.h);
}

export function setStage(stage) {
    if (current && current.exit) current.exit();
    current = stage;
    if (stage) fitCamera(stage);
}
export function getStage() { return current; }

export function setQuality(q) {
    forcedQuality = q;
    try { localStorage.setItem('sigilborn.quality', q === null ? 'auto' : String(q)); } catch { /* ignore */ }
    quality = q ?? 0;
    resize();
}
export function getQuality() { return quality; }
export function isAutoQuality() { return forcedQuality === null; }

/** Renders the current stage; also watches frame time and steps quality down if a phone struggles. */
export function renderFrame(dt, t) {
    if (!current || !renderer) return;
    current.update(dt, t);
    renderer.render(current.scene, current.camera);
    if (forcedQuality === null && dt > 0) {
        frameTimes.push(dt);
        if (frameTimes.length > 90) frameTimes.shift();
        if (frameTimes.length >= 90 && quality < 2 && t - lastDrop > 6) {
            const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            if (avg > 1 / 32) { quality++; lastDrop = t; frameTimes.length = 0; resize(); }
        }
    }
}

const _v = new THREE.Vector3();
/** World point → CSS pixel position; returns null when behind the camera. */
export function toScreen(pos, camera = current && current.camera, out = {}) {
    _v.copy(pos).project(camera);
    if (_v.z > 1) return null;
    out.x = (_v.x * 0.5 + 0.5) * size.w;
    out.y = (-_v.y * 0.5 + 0.5) * size.h;
    out.z = _v.z;
    return out;
}

/** Mean brightness (0–1) of the current stage rendered small — used by tests to catch black screens. */
export function brightness() {
    if (!current || !renderer) return 0;
    const rt = new THREE.WebGLRenderTarget(64, 64);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    renderer.setRenderTarget(rt);
    renderer.render(current.scene, current.camera);
    const px = new Uint8Array(64 * 64 * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, 64, 64, px);
    renderer.setRenderTarget(null);
    rt.dispose();
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
    return sum / (64 * 64) / 255;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export function raycast(x, y, objects, camera = current && current.camera) {
    ndc.set((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objects, true);
}

// ---------------------------------------------------------------- shared environment helpers

/** A big sky dome with a vertical gradient (and optional horizon glow). */
export function skyDome(top, bottom, horizon = null, radius = 120) {
    const geo = new THREE.SphereGeometry(radius, 32, 16);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) }, uHorizon: { value: new THREE.Color(horizon || bottom) }, uH: { value: horizon ? 1 : 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uHorizon; uniform float uH; varying vec3 vP;
            void main(){ float t = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0); vec3 c = mix(uBottom, uTop, smoothstep(0.35, 1.0, t));
            c = mix(c, uHorizon, uH * exp(-abs(vP.y) * 9.0) * 0.6); gl_FragColor = vec4(c, 1.0); }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -10;
    m.frustumCulled = false;
    return m;
}

export function setSky(dome, top, bottom, horizon) {
    dome.material.uniforms.uTop.value.set(top);
    dome.material.uniforms.uBottom.value.set(bottom);
    if (horizon) { dome.material.uniforms.uHorizon.value.set(horizon); dome.material.uniforms.uH.value = 1; }
}

/** Soft round blob shadow (cheap, mobile friendly). */
let blobTex = null;
export function blobShadow(r = 0.5, opacity = 0.35) {
    if (!blobTex) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        blobTex = new THREE.CanvasTexture(c);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.renderOrder = 1;
    return m;
}

export function standardLights(scene, opts = {}) {
    const hemi = new THREE.HemisphereLight(opts.sky || '#dfefff', opts.ground || '#5a5a7a', opts.hemi ?? 1.15);
    const sun = new THREE.DirectionalLight(opts.sun || '#fff4e0', opts.sunI ?? 2.1);
    sun.position.set(...(opts.sunPos || [4, 8, 6]));
    const fill = new THREE.DirectionalLight(opts.fill || '#9fb8ff', opts.fillI ?? 0.5);
    fill.position.set(-5, 3, -4);
    scene.add(hemi, sun, fill);
    return { hemi, sun, fill };
}

export { THREE };
