/**
 * stage.js — renderer, scene, the diorama camera, sky, sun and the time of day, and the
 * tilt-shift post-processing that makes the island look like a toy on a table.
 *
 * Camera: an orbit rig round a target point on the ground (yaw, pitch, distance), eased toward goal
 * values so every move is smooth. "Ride along" swaps the goals for a chase view behind a train.
 *
 * Quality tiers move pixels, not features: 0 = full (pixel ratio ≤ 2, 2048 shadows, tilt-shift),
 * 1 = phone (≤ 1.5, 1024, tilt-shift), 2 = low (1, 1024, no post).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { N, LAND_H } from '../config.js';
import { night } from './materials.js';

export let renderer, scene, camera, composer;
let tiltH, tiltV, renderPass;
let quality = 1;
let sun, moon, hemi, sky, stars;
let lastW = 0, lastH = 0, lastDpr = 0;

export const rig = {
    tx: 0, tz: 4, yaw: 0.6, pitch: 0.82, dist: 30,      // current
    gx: 0, gz: 4, gyaw: 0.6, gpitch: 0.82, gdist: 30,   // goal
    follow: null,                                        // { x, z, yaw } fed each frame while riding along
    auto: 0,                                             // slow orbit speed (title screen)
    insetBottom: 0,
};

export const tod = { t: 0.42, cycle: false, speed: 1 / 360 };

const TILT = {
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.55 }, uBand: { value: 0.22 }, uAmount: { value: 2.2 }, uGrade: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes; uniform float uFocus, uBand, uAmount, uGrade;
        varying vec2 vUv;
        void main(){
            float d = abs(vUv.y - uFocus);
            float b = smoothstep(uBand, uBand + 0.32, d) * uAmount;
            vec2 st = uDir / uRes * b;
            vec4 c = texture2D(tDiffuse, vUv) * 0.2270;
            c += (texture2D(tDiffuse, vUv + st * 1.3846) + texture2D(tDiffuse, vUv - st * 1.3846)) * 0.3162;
            c += (texture2D(tDiffuse, vUv + st * 3.2308) + texture2D(tDiffuse, vUv - st * 3.2308)) * 0.0703;
            if (uGrade > 0.5) {
                // warm, slightly saturated grade and a soft vignette
                float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
                c.rgb = mix(vec3(l), c.rgb, 1.12);
                c.rgb *= vec3(1.03, 1.0, 0.96);
                vec2 q = vUv - 0.5;
                c.rgb *= 1.0 - dot(q, q) * 0.45;
            }
            c.rgb = max(c.rgb, vec3(0.0));
            gl_FragColor = c;
        }`,
};

export function initStage(canvas, q) {
    quality = q;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q < 2, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbfe3f2, 60, 170);
    camera = new THREE.PerspectiveCamera(38, 1, 0.3, 600);

    hemi = new THREE.HemisphereLight(0xdff2ff, 0x6d8a4a, 1.0);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    moon = new THREE.DirectionalLight(0x8fb0ff, 0);
    scene.add(moon, moon.target);

    // Sky dome: a vertical gradient, drawn behind everything, ignoring fog.
    sky = new THREE.Mesh(
        new THREE.SphereGeometry(400, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() } },
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform vec3 uTop, uHor, uSunCol; uniform vec3 uSun; varying vec3 vDir;
                void main(){
                    float h = clamp(vDir.y, 0.0, 1.0);
                    vec3 c = mix(uHor, uTop, pow(h, 0.55));
                    float s = clamp(dot(normalize(vDir), uSun), 0.0, 1.0);
                    c += uSunCol * (pow(s, 600.0) * 1.5 + pow(s, 8.0) * 0.25);
                    gl_FragColor = vec4(c, 1.0);
                }`,
        }),
    );
    sky.renderOrder = -10;
    scene.add(sky);

    // Stars for the night sky.
    const sg = new THREE.BufferGeometry();
    const sp = [];
    let s = 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 700; i++) {
        const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.95);
        sp.push(Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(stars);

    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    renderPass = new RenderPass(scene, camera);
    tiltH = new ShaderPass(TILT);
    tiltV = new ShaderPass(TILT);
    tiltV.uniforms.uDir.value.set(0, 1);
    tiltV.uniforms.uGrade.value = 1;
    composer.addPass(renderPass);
    composer.addPass(tiltH);
    composer.addPass(tiltV);
    composer.addPass(new OutputPass());

    setQuality(q);
    resize();
    applyTime(tod.t);
    return { renderer, scene, camera };
}

export function setQuality(q) {
    quality = Math.max(0, Math.min(2, q | 0));
    const size = quality === 0 ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    lastDpr = 0;
    resize();
}
export const getQuality = () => quality;

export function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 0 ? 2 : quality === 1 ? 1.5 : 1);
    if (w === lastW && h === lastH && dpr === lastDpr) return;
    lastW = w; lastH = h; lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    // Size the canvas in px to exactly the visible viewport. A CSS 100vh canvas is taller than
    // innerHeight on phones with a URL bar, which stretches the picture down and makes taps land
    // below the finger (the same bug game-058 had).
    renderer.setSize(w, h);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const p of [tiltH, tiltV]) p.uniforms.uRes.value.set(w * dpr, h * dpr);
}

// ------------------------------------------------------------------ time of day
const KEYS = [
    // t,    sky top,  horizon,  sun colour, sun I, hemi sky, hemi ground, hemi I, fog
    [0.00, 0x0b1636, 0x22325e, 0x9fb4ff, 0.0, 0x6a80c8, 0x2a3048, 0.9, 0x1c2a4c],
    [0.20, 0x1b2a5c, 0x4a4f86, 0xffb08a, 0.0, 0x7280b8, 0x2e3244, 0.85, 0x3a4270],
    [0.27, 0x5d8fd6, 0xffc39a, 0xffc890, 1.4, 0xbcd2ff, 0x6a6a52, 0.85, 0xf2c8a8],
    [0.36, 0x4d9be8, 0xbfe6f6, 0xfff0d6, 2.2, 0xdff2ff, 0x6d8a4a, 1.0, 0xbfe3f2],
    [0.50, 0x3d8fe6, 0xc2e8f8, 0xfff6e6, 2.5, 0xe6f4ff, 0x6d8a4a, 1.05, 0xc4e6f4],
    [0.66, 0x4a90de, 0xd2e6f0, 0xffe8c8, 2.2, 0xe0eeff, 0x6d8a4a, 1.0, 0xcfe4ee],
    [0.74, 0x5470b8, 0xffb58a, 0xff9d5c, 1.5, 0xffd9c0, 0x6a5a4a, 0.85, 0xf3b896],
    [0.80, 0x2b2f6e, 0xd77f86, 0xff7a5a, 0.3, 0x8a7aa8, 0x3a3040, 0.65, 0x8a6a8a],
    [0.86, 0x101c44, 0x2f3a6c, 0x9fb4ff, 0.0, 0x6a80c8, 0x2a3048, 0.9, 0x22305a],
    [1.00, 0x0b1636, 0x22325e, 0x9fb4ff, 0.0, 0x6a80c8, 0x2a3048, 0.9, 0x1c2a4c],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpHex(a, b, f, out) { _c1.setHex(a); _c2.setHex(b); return out.copy(_c1).lerp(_c2, f); }

export function applyTime(t) {
    t = ((t % 1) + 1) % 1;
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1][0] <= t) k++;
    const A = KEYS[k], B = KEYS[k + 1];
    const f = (t - A[0]) / (B[0] - A[0]);
    const ss = f * f * (3 - 2 * f);
    lerpHex(A[1], B[1], ss, sky.material.uniforms.uTop.value);
    lerpHex(A[2], B[2], ss, sky.material.uniforms.uHor.value);
    lerpHex(A[3], B[3], ss, sun.color);
    sun.intensity = A[4] + (B[4] - A[4]) * ss;
    lerpHex(A[5], B[5], ss, hemi.color);
    lerpHex(A[6], B[6], ss, hemi.groundColor);
    hemi.intensity = A[7] + (B[7] - A[7]) * ss;
    lerpHex(A[8], B[8], ss, scene.fog.color);
    renderer.setClearColor(scene.fog.color);
    // Sun path: rises in the east (+x), high in the south.
    const ang = (t - 0.25) * Math.PI * 2;
    const el = Math.sin(ang);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.9, Math.max(0.12, el), 0.45).normalize();
    sun.position.copy(dir).multiplyScalar(70);
    sun.target.position.set(0, 0, 0);
    sky.material.uniforms.uSun.value.set(Math.cos(ang) * 0.9, el, 0.45).normalize();
    sky.material.uniforms.uSunCol.value.copy(sun.color).multiplyScalar(Math.max(0, Math.min(1, el * 4 + 0.3)));
    const nf = Math.max(0, Math.min(1, (0.08 - el) / 0.3));
    night.value = nf;
    moon.intensity = nf * 1.25;
    moon.position.set(-25, 50, -20);
    sun.castShadow = sun.intensity > 0.2;
    moon.castShadow = false;
    stars.material.opacity = nf;
    renderer.toneMappingExposure = 1.05 + nf * 0.25;
    return nf;
}

// ------------------------------------------------------------------ camera
const LIM = N / 2 + 2;
export function updateCamera(dt) {
    if (rig.auto) rig.gyaw += rig.auto * dt;
    if (rig.follow) {
        const f = rig.follow;
        rig.gx = f.x; rig.gz = f.z;
        // A chase view: behind and above the engine, looking along the line.
        let dy = (f.yaw - Math.PI / 2) - rig.gyaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        rig.gyaw += dy * Math.min(1, dt * 2.2);
        rig.gpitch = 0.38; rig.gdist = 5.5;
    }
    rig.gx = Math.max(-LIM, Math.min(LIM, rig.gx));
    rig.gz = Math.max(-LIM, Math.min(LIM, rig.gz));
    rig.gdist = Math.max(4.5, Math.min(62, rig.gdist));
    rig.gpitch = Math.max(0.22, Math.min(1.35, rig.gpitch));
    const k = 1 - Math.exp(-dt * (rig.follow ? 6 : 10));
    rig.tx += (rig.gx - rig.tx) * k;
    rig.tz += (rig.gz - rig.tz) * k;
    rig.dist += (rig.gdist - rig.dist) * k;
    rig.pitch += (rig.gpitch - rig.pitch) * k;
    let dy = rig.gyaw - rig.yaw;
    rig.yaw += dy * k;
    const cp = Math.cos(rig.pitch);
    camera.position.set(
        rig.tx + Math.sin(rig.yaw) * cp * rig.dist,
        LAND_H + Math.sin(rig.pitch) * rig.dist,
        rig.tz + Math.cos(rig.yaw) * cp * rig.dist,
    );
    camera.lookAt(rig.tx, LAND_H + (rig.follow ? 0.5 : 0), rig.tz);
    // Shift the picture up when a tray covers the bottom of the screen.
    const h = window.innerHeight;
    if (rig.insetBottom > 0 && h > 0) camera.setViewOffset(window.innerWidth, h, 0, rig.insetBottom * 0.5, window.innerWidth, h);
    else camera.clearViewOffset();
    scene.fog.near = rig.dist * 1.6 + 20;
    scene.fog.far = rig.dist * 3.2 + 120;
    // Tilt-shift focus follows the target: strong from far away, gentle up close.
    const blur = Math.max(0, Math.min(1, (rig.dist - 8) / 30));
    tiltH.uniforms.uAmount.value = tiltV.uniforms.uAmount.value = 0.6 + blur * 2.4;
    tiltH.uniforms.uBand.value = tiltV.uniforms.uBand.value = 0.18 + (1 - blur) * 0.15;
    tiltH.uniforms.uFocus.value = tiltV.uniforms.uFocus.value = 0.5 + (rig.insetBottom / Math.max(1, h)) * 0.5;
}

export function orbitBy(dyaw, dpitch) { rig.gyaw += dyaw; rig.gpitch += dpitch; }
export function zoomBy(f) { rig.gdist *= f; }
export function panBy(dx, dz) {
    // Screen-aligned pan: dx right, dz down the screen, in world units.
    const s = Math.sin(rig.yaw), c = Math.cos(rig.yaw);
    rig.gx += dx * c + dz * s;
    rig.gz += -dx * s + dz * c;
}
export function snapCamera() {
    rig.tx = rig.gx; rig.tz = rig.gz; rig.yaw = rig.gyaw; rig.pitch = rig.gpitch; rig.dist = rig.gdist;
}

export function render() {
    if (quality >= 2) renderer.render(scene, camera);
    else composer.render();
}

/** Ground point under a screen position, on the plane y = h (or null if looking at the sky). */
const _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
export function groundAt(clientX, clientY, h = LAND_H) {
    // Map through the canvas's on-screen box so a tap always matches the picture.
    const r = renderer.domElement.getBoundingClientRect();
    _v2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_v2, camera);
    _plane.constant = -h;
    return _ray.ray.intersectPlane(_plane, _hit) ? { x: _hit.x, z: _hit.z } : null;
}

const _p = new THREE.Vector3();
/** Screen position (CSS px) of a world point, or null if behind the camera. */
export function toScreen(x, y, z) {
    _p.set(x, y, z).project(camera);
    if (_p.z > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (_p.x * 0.5 + 0.5) * r.width, y: r.top + (-_p.y * 0.5 + 0.5) * r.height };
}
