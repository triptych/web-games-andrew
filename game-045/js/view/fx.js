/**
 * fx.js — pooled visual effects, all in table space (see scene.js `table`).
 *
 *   sparks(x, y, color, n, speed, opts)   — additive point particles
 *   shards(x, y, color, n, speed)         — tumbling instanced debris cubes
 *   ring(x, y, color, r0, r1, life)       — expanding shockwave on the surface
 *   flare(x, y, color, size, life)        — camera-facing glow burst
 *   popup(text, x, y, color, scale)       — floating score text
 *   updateFx(dt)
 *
 * Nothing allocates per effect except popups (which cache their textures),
 * so a 40-brick explosive chain costs no garbage.
 */

import * as THREE from 'three';
import { table, renderer, camera } from './scene.js';

// ------------------------------------------------------------------ Sparks

const MAXP = 5000;
const pPos = new Float32Array(MAXP * 3);
const pCol = new Float32Array(MAXP * 3);
const pSize = new Float32Array(MAXP);
const pAlpha = new Float32Array(MAXP);
const pVel = new Float32Array(MAXP * 3);
const pLife = new Float32Array(MAXP);
const pMax = new Float32Array(MAXP);
const pSize0 = new Float32Array(MAXP);
const pDrag = new Float32Array(MAXP);
const pGrav = new Float32Array(MAXP);
const pBase = new Float32Array(MAXP * 3);
let pNext = 0;
let points, pointMat;

// ------------------------------------------------------------------ Shards

const MAXS = 600;
let shardMesh;
const sh = Array.from({ length: MAXS }, () => ({
    life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 1, color: new THREE.Color(),
}));
let sNext = 0;

// ------------------------------------------------------------------ Rings / flares / popups

const rings = [];
const flares = [];
const popups = [];
let glowTex;
const popTex = new Map();

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export function initFx() {
    // --- Sparks ---
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    pointMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uScale: { value: 400 } },
        vertexShader: /* glsl */`
            attribute float size;
            attribute float alpha;
            attribute vec3 color;
            uniform float uScale;
            varying vec3 vC;
            varying float vA;
            void main() {
                vC = color;
                vA = alpha;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = alpha > 0.0 ? max(1.0, size * uScale / -mv.z) : 0.0;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */`
            varying vec3 vC;
            varying float vA;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.0, d);
                float core = smoothstep(0.18, 0.0, d);
                gl_FragColor = vec4((vC * a + vec3(core) * 0.6) * vA, 1.0);
            }
        `,
    });
    points = new THREE.Points(g, pointMat);
    points.frustumCulled = false;
    points.renderOrder = 6;
    table.add(points);

    // --- Shards ---
    const sg = new THREE.BoxGeometry(0.26, 0.14, 0.14);
    shardMesh = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXS);
    shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shardMesh.frustumCulled = false;
    shardMesh.count = 0;
    shardMesh.setColorAt(0, _c.set(0));
    table.add(shardMesh);

    // --- Shared radial glow texture ---
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);

    // --- Ring pool ---
    const rg = new THREE.RingGeometry(0.86, 1, 64);
    for (let i = 0; i < 28; i++) {
        const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        }));
        m.visible = false;
        m.renderOrder = 5;
        table.add(m);
        rings.push({ m, life: 0, max: 1, r0: 0, r1: 1 });
    }
    // --- Flare pool ---
    for (let i = 0; i < 20; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        s.visible = false;
        s.renderOrder = 7;
        table.add(s);
        flares.push({ s, life: 0, max: 1, size: 1 });
    }

    updateFxScale();
    window.addEventListener('resize', updateFxScale);
}

export function updateFxScale() {
    if (!pointMat) return;
    const h = renderer.domElement.height;
    pointMat.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

// ------------------------------------------------------------------ Spawners

/**
 * @param opts { z, up, life, size, drag, grav, spread (radians of fan), dir (radians) }
 */
export function sparks(x, y, color, n, speed, opts = {}) {
    // Per-frame budget: a fireball ploughing through 30 bricks should read as
    // a storm of sparks, not a white screen.
    n = Math.min(n, SPARK_BUDGET - sparksThisFrame);
    if (n <= 0) return;
    sparksThisFrame += n;
    _c.set(color);
    const life = opts.life ?? 0.7;
    const size = opts.size ?? 0.22;
    for (let i = 0; i < n; i++) {
        const k = pNext;
        pNext = (pNext + 1) % MAXP;
        const a = opts.dir !== undefined
            ? opts.dir + (Math.random() - 0.5) * (opts.spread ?? 1)
            : Math.random() * Math.PI * 2;
        const sp = speed * (0.25 + Math.random() * 0.75);
        pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = opts.z ?? 0.4;
        pVel[k * 3] = Math.cos(a) * sp;
        pVel[k * 3 + 1] = Math.sin(a) * sp;
        pVel[k * 3 + 2] = (opts.up ?? 0.5) * sp * Math.random();
        const hot = Math.random() < 0.3 ? 1 : 0;           // a few white-hot sparks
        pBase[k * 3] = hot ? 1 : _c.r;
        pBase[k * 3 + 1] = hot ? 1 : _c.g;
        pBase[k * 3 + 2] = hot ? 1 : _c.b;
        pMax[k] = pLife[k] = life * (0.5 + Math.random() * 0.7);
        pSize0[k] = size * (0.6 + Math.random() * 0.8);
        pDrag[k] = opts.drag ?? 2.2;
        pGrav[k] = opts.grav ?? 1;
    }
}

export function shards(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
        const s = sh[sNext];
        sNext = (sNext + 1) % MAXS;
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.3 + Math.random() * 0.7);
        s.x = x + (Math.random() - 0.5) * 0.7;
        s.y = y + (Math.random() - 0.5) * 0.35;
        s.z = 0.25 + Math.random() * 0.3;
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp + 2;
        s.vz = 3 + Math.random() * 7;
        s.rx = Math.random() * 6; s.ry = Math.random() * 6; s.rz = Math.random() * 6;
        s.wx = (Math.random() - 0.5) * 30; s.wy = (Math.random() - 0.5) * 30; s.wz = (Math.random() - 0.5) * 30;
        s.max = s.life = 0.9 + Math.random() * 0.8;
        s.s = 0.6 + Math.random() * 0.9;
        s.color.set(color).multiplyScalar(1.0 + Math.random() * 0.6);
    }
}

export function ring(x, y, color, r0 = 0.3, r1 = 3, life = 0.45) {
    if (++ringsThisFrame > 4) return;
    const r = rings.find((q) => q.life <= 0) ?? rings[0];
    r.life = r.max = life;
    r.r0 = r0; r.r1 = r1;
    r.m.position.set(x, y, 0.06);
    r.m.material.color.set(color).multiplyScalar(1.3);
    r.m.visible = true;
}

let flaresThisFrame = 0;
let sparksThisFrame = 0;
let ringsThisFrame = 0;
const SPARK_BUDGET = 260;

export function flare(x, y, color, size = 3, life = 0.3, z = 0.6) {
    // A 30-brick chain in one frame would otherwise stack into a white-out.
    if (++flaresThisFrame > 3) return;
    const f = flares.find((q) => q.life <= 0) ?? flares[0];
    f.life = f.max = life;
    f.size = size;
    f.s.position.set(x, y, z);
    f.s.material.color.set(color).multiplyScalar(0.9);
    f.s.visible = true;
}

function popTexture(text, color) {
    const key = text + '|' + color;
    if (popTex.has(key)) return popTex.get(key);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 192;
    const ctx = c.getContext('2d');
    ctx.font = 'italic 900 104px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    for (const b of [30, 14]) { ctx.shadowBlur = b; ctx.fillText(text, 256, 100); }
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(text, 256, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (popTex.size > 120) popTex.clear();
    popTex.set(key, tex);
    return tex;
}

export function popup(text, x, y, color = '#ffd23d', scale = 1) {
    const mat = new THREE.SpriteMaterial({ map: popTexture(text, color), transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, 1.2);
    s.renderOrder = 9;
    table.add(s);
    popups.push({ s, life: 0.9, max: 0.9, scale: scale * 1.9 });
    if (popups.length > 40) killPopup(0);
}

function killPopup(i) {
    const p = popups[i];
    table.remove(p.s);
    p.s.material.dispose();
    popups.splice(i, 1);
}

// ------------------------------------------------------------------ Update

export function updateFx(dt) {
    flaresThisFrame = 0;
    sparksThisFrame = 0;
    ringsThisFrame = 0;
    // Sparks
    for (let k = 0; k < MAXP; k++) {
        if (pLife[k] <= 0) {
            if (pAlpha[k] !== 0) pAlpha[k] = 0;
            continue;
        }
        pLife[k] -= dt;
        const i3 = k * 3;
        const drag = Math.exp(-pDrag[k] * dt);
        pVel[i3] *= drag; pVel[i3 + 1] *= drag; pVel[i3 + 2] *= drag;
        pVel[i3 + 1] -= 6 * pGrav[k] * dt;
        pVel[i3 + 2] -= 14 * pGrav[k] * dt;
        pPos[i3] += pVel[i3] * dt;
        pPos[i3 + 1] += pVel[i3 + 1] * dt;
        pPos[i3 + 2] += pVel[i3 + 2] * dt;
        if (pPos[i3 + 2] < 0.05) { pPos[i3 + 2] = 0.05; pVel[i3 + 2] *= -0.45; }
        const t = Math.max(0, pLife[k] / pMax[k]);
        pAlpha[k] = t;
        pSize[k] = pSize0[k] * (0.4 + 0.6 * t);
        // Cool from white toward the base colour as the spark ages.
        const heat = t * t;
        pCol[i3] = pBase[i3] + (1 - pBase[i3]) * heat * 0.6;
        pCol[i3 + 1] = pBase[i3 + 1] + (1 - pBase[i3 + 1]) * heat * 0.6;
        pCol[i3 + 2] = pBase[i3 + 2] + (1 - pBase[i3 + 2]) * heat * 0.6;
        pCol[i3] *= 1.3; pCol[i3 + 1] *= 1.3; pCol[i3 + 2] *= 1.3;
    }
    const ga = points.geometry.attributes;
    ga.position.needsUpdate = ga.color.needsUpdate = ga.size.needsUpdate = ga.alpha.needsUpdate = true;

    // Shards
    let n = 0;
    for (const s of sh) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vy -= 9 * dt;
        s.vz -= 26 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
        if (s.z < 0.08) {
            s.z = 0.08;
            s.vz *= -0.35;
            s.vx *= 0.7; s.vy *= 0.7;
            s.wx *= 0.6; s.wy *= 0.6; s.wz *= 0.6;
        }
        s.rx += s.wx * dt; s.ry += s.wy * dt; s.rz += s.wz * dt;
        const t = s.life / s.max;
        const sc = s.s * Math.min(1, t * 3);
        _p.set(s.x, s.y, s.z);
        _q.setFromEuler(_e.set(s.rx, s.ry, s.rz));
        _s.set(sc, sc, sc);
        _m.compose(_p, _q, _s);
        shardMesh.setMatrixAt(n, _m);
        shardMesh.setColorAt(n, _c.copy(s.color).multiplyScalar(0.4 + t));
        n++;
    }
    shardMesh.count = n;
    shardMesh.instanceMatrix.needsUpdate = true;
    if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;

    // Rings
    for (const r of rings) {
        if (r.life <= 0) continue;
        r.life -= dt;
        if (r.life <= 0) { r.m.visible = false; continue; }
        const t = 1 - r.life / r.max;
        const e = 1 - Math.pow(1 - t, 3);
        const rad = r.r0 + (r.r1 - r.r0) * e;
        r.m.scale.set(rad, rad, 1);
        r.m.material.opacity = 1 - t;
    }

    // Flares
    for (const f of flares) {
        if (f.life <= 0) continue;
        f.life -= dt;
        if (f.life <= 0) { f.s.visible = false; continue; }
        const t = 1 - f.life / f.max;
        const sz = f.size * (0.6 + 0.8 * Math.sin(Math.min(1, t * 2.2) * Math.PI / 2));
        f.s.scale.set(sz, sz, 1);
        f.s.material.opacity = 1 - t * t;
    }

    // Popups: overshoot in, drift up the table, fade.
    for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.life -= dt;
        if (p.life <= 0) { killPopup(i); continue; }
        const t = 1 - p.life / p.max;
        const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.9 : 1.3 - Math.min(0.3, (t - 0.15) * 1.5);
        p.s.scale.set(p.scale * pop, p.scale * pop * 0.375, 1);
        p.s.position.y += dt * 2.2;
        p.s.position.z += dt * 0.8;
        p.s.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    }
}

export function resetFx() {
    pLife.fill(0);
    pAlpha.fill(0);
    for (const s of sh) s.life = 0;
    for (const r of rings) { r.life = 0; r.m.visible = false; }
    for (const f of flares) { f.life = 0; f.s.visible = false; }
    while (popups.length) killPopup(0);
}
