/**
 * fx.js — pooled effects: additive glow particles, solid debris chunks,
 * expanding shockwave rings, lightning arcs, big flares, and floating DOM
 * damage numbers projected from the 3D scene.
 *
 * All pools are fixed-size and recycle the oldest entry when full, and the
 * number of new particles per frame is budgeted, so a 20-enemy chain
 * reaction never tanks the frame rate on a phone.
 */

import * as THREE from 'three';
import { scene, camera, toScreen } from './scene.js';
import { glowTexture } from './textures.js';

const MAX_P = 1400, MAX_CHUNK = 260, MAX_RING = 24, MAX_BOLT = 10, MAX_FLARE = 12, MAX_NUM = 48;
let pMesh, cMesh;
const parts = [], chunks = [], rings = [], bolts = [], flares = [];
let pHead = 0, cHead = 0;
let budget = 0;
let numLayer;
const nums = [];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

export function initFx() {
    pMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_P);
    pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3);
    pMesh.frustumCulled = false;
    scene.add(pMesh);
    for (let i = 0; i < MAX_P; i++) parts.push({ life: 0 });

    cMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAX_CHUNK);
    cMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CHUNK * 3), 3);
    cMesh.frustumCulled = false;
    cMesh.castShadow = true;
    scene.add(cMesh);
    for (let i = 0; i < MAX_CHUNK; i++) chunks.push({ life: 0 });

    for (let i = 0; i < MAX_RING; i++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        scene.add(m);
        rings.push({ m, life: 0 });
    }
    for (let i = 0; i < MAX_BOLT; i++) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
        const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff6a0, transparent: true, blending: THREE.AdditiveBlending }));
        l.visible = false;
        l.frustumCulled = false;
        scene.add(l);
        bolts.push({ l, life: 0 });
    }
    for (let i = 0; i < MAX_FLARE; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.visible = false;
        scene.add(s);
        flares.push({ s, life: 0 });
    }
    numLayer = document.getElementById('numbers');
    for (let i = 0; i < MAX_NUM; i++) {
        const d = document.createElement('div');
        d.className = 'num';
        d.style.display = 'none';
        numLayer.appendChild(d);
        nums.push({ d, life: 0 });
    }
}

export function resetFx() {
    for (const p of parts) p.life = 0;
    for (const c of chunks) c.life = 0;
    for (const r of rings) { r.life = 0; r.m.visible = false; }
    for (const b of bolts) { b.life = 0; b.l.visible = false; }
    for (const f of flares) { f.life = 0; f.s.visible = false; }
    for (const n of nums) { n.life = 0; n.d.style.display = 'none'; }
}

// ------------------------------------------------------------------ Emitters (sim coords)

/**
 * Glow particles. o: { n, color, speed, size, life, gravity, up, h, spread, drag, colors }
 */
export function burst(x, y, o = {}) {
    const n = Math.min(o.n ?? 12, Math.max(2, budget));
    budget -= n;
    const col = new THREE.Color(o.color ?? 0xffffff);
    for (let i = 0; i < n; i++) {
        const p = parts[pHead];
        pHead = (pHead + 1) % MAX_P;
        const a = Math.random() * Math.PI * 2;
        const sp = (o.speed ?? 3) * (0.3 + Math.random() * 0.9);
        const up = (o.up ?? 1.5) * (0.4 + Math.random());
        p.x = x + (Math.random() - 0.5) * (o.spread ?? 0.2);
        p.y = (o.h ?? 0.5) + (Math.random() - 0.5) * 0.2;
        p.z = -y + (Math.random() - 0.5) * (o.spread ?? 0.2);
        p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = up;
        p.max = p.life = (o.life ?? 0.5) * (0.6 + Math.random() * 0.6);
        p.size = (o.size ?? 0.3) * (0.6 + Math.random() * 0.8);
        p.g = o.gravity ?? 4;
        p.drag = o.drag ?? 2.5;
        if (o.colors) col.set(o.colors[i % o.colors.length]);
        p.r = col.r; p.gg = col.g; p.b = col.b;
    }
}

/** Solid debris that bounces on the floor. */
export function debris(x, y, o = {}) {
    const n = o.n ?? 8;
    const col = new THREE.Color(o.color ?? 0x888888);
    for (let i = 0; i < n; i++) {
        const c = chunks[cHead];
        cHead = (cHead + 1) % MAX_CHUNK;
        const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 3) * (0.4 + Math.random());
        c.x = x; c.y = (o.h ?? 0.5); c.z = -y;
        c.vx = Math.cos(a) * sp; c.vz = Math.sin(a) * sp; c.vy = 2 + Math.random() * 4;
        c.rx = Math.random() * 6; c.ry = Math.random() * 6; c.spin = (Math.random() - 0.5) * 20;
        c.max = c.life = 0.9 + Math.random() * 0.6;
        c.size = (o.size ?? 0.12) * (0.6 + Math.random() * 0.8);
        c.col = col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
    }
}

export function ring(x, y, o = {}) {
    let best = rings[0];
    for (const r of rings) if (r.life <= 0) { best = r; break; }
    best.x = x; best.z = -y;
    best.from = o.from ?? 0.2; best.to = o.to ?? 2;
    best.max = best.life = o.life ?? 0.4;
    best.m.material.color.set(o.color ?? 0xffffff);
    best.m.visible = true;
    best.m.position.set(x, o.h ?? 0.05, -y);
}

export function bolt(pts, color = 0xfff6a0) {
    let best = bolts[0];
    for (const b of bolts) if (b.life <= 0) { best = b; break; }
    const arr = best.l.geometry.attributes.position.array;
    let k = 0;
    for (let i = 0; i < pts.length - 1 && k < 60; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const seg = 6;
        for (let s = 0; s <= seg && k < 63; s++) {
            const t = s / seg;
            const j = s === 0 || s === seg ? 0 : 0.25;
            arr[k * 3] = x0 + (x1 - x0) * t + (Math.random() - 0.5) * j;
            arr[k * 3 + 1] = 0.6 + (Math.random() - 0.5) * j;
            arr[k * 3 + 2] = -(y0 + (y1 - y0) * t) + (Math.random() - 0.5) * j;
            k++;
        }
    }
    best.l.geometry.setDrawRange(0, k);
    best.l.geometry.attributes.position.needsUpdate = true;
    best.l.material.color.set(color);
    best.max = best.life = 0.18;
    best.l.visible = true;
}

export function flare(x, y, o = {}) {
    let best = flares[0];
    for (const f of flares) if (f.life <= 0) { best = f; break; }
    best.s.position.set(x, o.h ?? 0.6, -y);
    best.s.material.color.set(o.color ?? 0xffffff);
    best.size = o.size ?? 2;
    best.max = best.life = o.life ?? 0.25;
    best.s.visible = true;
}

/** Floating text at a sim position. cls: 'crit' | 'heal' | 'hurt' | 'dot' | 'big' | 'xp' | … */
export function number(x, y, h, text, cls = '') {
    let best = nums[0];
    for (const n of nums) { if (n.life <= 0) { best = n; break; } if (n.life < best.life) best = n; }
    best.x = x + (Math.random() - 0.5) * 0.4; best.y = y; best.h = h;
    best.max = best.life = cls === 'big' || cls === 'banner' ? 1.2 : 0.75;
    best.d.textContent = text;
    best.d.className = 'num ' + cls;
    best.d.style.display = 'block';
}

// ------------------------------------------------------------------ Update

export function updateFx(dt) {
    budget = 160;
    let n = 0;
    for (const p of parts) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) continue;
        const k = p.life / p.max;
        const drag = Math.pow(1 / (1 + p.drag), dt);
        p.vx *= drag; p.vz *= drag;
        p.vy -= p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
        _p.set(p.x, p.y, p.z);
        _s.setScalar(p.size * (0.4 + 0.6 * k));
        _m.compose(_p, camera.quaternion, _s);
        pMesh.setMatrixAt(n, _m);
        _c.setRGB(p.r * k, p.gg * k, p.b * k);
        pMesh.setColorAt(n, _c);
        n++;
    }
    pMesh.count = n;
    pMesh.instanceMatrix.needsUpdate = true;
    if (n) pMesh.instanceColor.needsUpdate = true;

    n = 0;
    for (const c of chunks) {
        if (c.life <= 0) continue;
        c.life -= dt;
        if (c.life <= 0) continue;
        c.vy -= 16 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        if (c.y < c.size / 2) { c.y = c.size / 2; c.vy = Math.abs(c.vy) * 0.35; c.vx *= 0.6; c.vz *= 0.6; c.spin *= 0.6; }
        c.rx += c.spin * dt; c.ry += c.spin * 0.7 * dt;
        const k = Math.min(1, c.life / 0.3);
        _p.set(c.x, c.y, c.z);
        _q.setFromEuler(new THREE.Euler(c.rx, c.ry, 0));
        _s.setScalar(c.size * k);
        _m.compose(_p, _q, _s);
        cMesh.setMatrixAt(n, _m);
        cMesh.setColorAt(n, c.col);
        n++;
    }
    cMesh.count = n;
    cMesh.instanceMatrix.needsUpdate = true;
    if (n) cMesh.instanceColor.needsUpdate = true;

    for (const r of rings) {
        if (r.life <= 0) continue;
        r.life -= dt;
        if (r.life <= 0) { r.m.visible = false; continue; }
        const k = 1 - r.life / r.max;
        const e = 1 - Math.pow(1 - k, 3);
        r.m.scale.setScalar(r.from + (r.to - r.from) * e);
        r.m.material.opacity = (1 - k) * 0.9;
    }
    for (const b of bolts) {
        if (b.life <= 0) continue;
        b.life -= dt;
        if (b.life <= 0) b.l.visible = false;
        else b.l.material.opacity = b.life / b.max;
    }
    for (const f of flares) {
        if (f.life <= 0) continue;
        f.life -= dt;
        if (f.life <= 0) { f.s.visible = false; continue; }
        const k = f.life / f.max;
        f.s.scale.setScalar(f.size * (0.6 + 0.4 * k));
        f.s.material.opacity = k;
    }
    for (const nm of nums) {
        if (nm.life <= 0) continue;
        nm.life -= dt;
        if (nm.life <= 0) { nm.d.style.display = 'none'; continue; }
        const k = 1 - nm.life / nm.max;
        const sp = toScreen(nm.x, nm.y, nm.h + k * 0.9);
        const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.7 : 1.3 - Math.min(0.3, (k - 0.12) * 1.2);
        nm.d.style.transform = `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
        nm.d.style.opacity = k > 0.7 ? ((1 - k) / 0.3).toFixed(2) : '1';
    }
}
