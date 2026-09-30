/**
 * fx.js — particles, homing motes, line beams and shockwaves.
 *
 * Two particle pools: one in the card layer (units are pixels, used for card
 * bursts and the motes that fly from a fired line to its target) and one in
 * the world (hit sparks, death bursts, heal/ward shimmer). Both are a single
 * THREE.Points each, CPU-integrated, with a per-frame spawn budget so a huge
 * chain can never white out the screen (the game-045 lesson).
 */

import * as THREE from 'three';
import { cardScene, worldScene, view } from './scene.js';
import { radialTex, canvas } from './textures.js';

class Pool {
    constructor(scene, cap, { pixel }) {
        this.cap = cap;
        this.pixel = pixel;
        this.n = 0;
        this.p = [];
        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(cap * 3);
        this.col = new Float32Array(cap * 4);
        this.size = new Float32Array(cap);
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uMap: { value: radialTex(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', 0.05) }, uPix: { value: 1 }, uPixel: { value: pixel ? 1 : 0 } },
            vertexShader: /* glsl */`
                attribute vec4 color; attribute float size;
                uniform float uPix, uPixel;
                varying vec4 vC;
                void main() {
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = uPixel > 0.5 ? size * uPix : size * uPix * (40.0 / -mv.z);
                    vC = color;
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap;
                varying vec4 vC;
                void main() {
                    float a = texture2D(uMap, gl_PointCoord).a;
                    vec2 q = gl_PointCoord - 0.5;
                    float core = smoothstep(0.18, 0.0, length(q));
                    gl_FragColor = vec4(vC.rgb * (1.0 + core * 1.5), a * vC.a);
                }
            `,
        });
        this.mat = mat;
        this.points = new THREE.Points(geo, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 50;
        scene.add(this.points);
        this.geo = geo;
    }
    emit(o) {
        if (this.p.length >= this.cap) this.p.shift();
        const c = new THREE.Color(o.color ?? 0xffffff);
        this.p.push({
            x: o.x, y: o.y, z: o.z ?? 0, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
            life: o.life ?? 1, max: o.life ?? 1, size: o.size ?? 8, r: c.r, g: c.g, b: c.b,
            grav: o.grav ?? 0, drag: o.drag ?? 0, target: o.target ?? null, home: o.home ?? 0, onArrive: o.onArrive ?? null, delay: o.delay ?? 0, shrink: o.shrink ?? 1,
        });
    }
    update(dt) {
        const P = this.p;
        let j = 0;
        for (let i = 0; i < P.length; i++) {
            const q = P[i];
            if (q.delay > 0) { q.delay -= dt; P[j++] = q; continue; }
            q.life -= dt;
            if (q.target) {
                const dx = q.target.x - q.x, dy = q.target.y - q.y, dz = (q.target.z ?? 0) - q.z;
                const d = Math.hypot(dx, dy, dz) || 1;
                const acc = q.home;
                q.vx += (dx / d) * acc * dt; q.vy += (dy / d) * acc * dt; q.vz += (dz / d) * acc * dt;
                const k = Math.exp(-dt * 3.5);
                q.vx *= k; q.vy *= k; q.vz *= k;
                if (d < (this.pixel ? 18 : 0.35)) {
                    if (q.onArrive) { const f = q.onArrive; q.onArrive = null; f(); }
                    q.life = Math.min(q.life, 0.05);
                }
            }
            q.vy -= q.grav * dt;
            if (q.drag) { const k = Math.exp(-dt * q.drag); q.vx *= k; q.vy *= k; q.vz *= k; }
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            if (q.life > 0) P[j++] = q;
            else if (q.onArrive) { const f = q.onArrive; q.onArrive = null; f(); }
        }
        P.length = j;
        const n = Math.min(P.length, this.cap);
        for (let i = 0; i < n; i++) {
            const q = P[i];
            const k = Math.max(0, q.life / q.max);
            this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
            const a = q.delay > 0 ? 0 : Math.min(1, k * 2.5);
            this.col[i * 4] = q.r; this.col[i * 4 + 1] = q.g; this.col[i * 4 + 2] = q.b; this.col[i * 4 + 3] = a;
            this.size[i] = q.size * (q.shrink ? 0.35 + 0.65 * k : 1);
        }
        this.geo.setDrawRange(0, n);
        for (const k of ['position', 'color', 'size']) this.geo.attributes[k].needsUpdate = true;
        this.mat.uniforms.uPix.value = this.pixel ? view.dpr : view.dpr * (view.h / 900);
    }
}

let cardPool, worldPool;
const beams = [];
const rings = [];
let beamTex, ringTex;
let budget = 0;

export function initFx() {
    cardPool = new Pool(cardScene, 2600, { pixel: true });
    worldPool = new Pool(worldScene, 1800, { pixel: false });
    beamTex = (() => {
        const c = canvas(256, 64);
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    ringTex = radialTex(128, 'rgba(255,255,255,0)', 'rgba(255,255,255,0)');
    ringTex = (() => {
        const c = canvas(128, 128);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 30, 64, 64, 62);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
}

/** Called once per frame before effects fire: resets the spawn budget. */
export function fxFrame() { budget = 320; }
function take(n) { const k = Math.max(0, Math.min(n, budget)); budget -= k; return k; }

// ------------------------------------------------------------------ card-layer effects (pixel units, y up)

export function burst(x, y, color, n = 24, { speed = 260, size = 10, life = 0.7, z = 60, grav = 0 } = {}) {
    n = take(n);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
        cardPool.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: Math.random() * 100, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color, drag: 2.5, grav });
    }
}

/** Motes that fly from (x,y) to target {x,y} in the card layer, calling onArrive once. */
export function motes(x, y, target, color, n = 14, onArrive = null, { size = 12, delay = 0 } = {}) {
    n = Math.max(1, take(n));
    let fired = false;
    const once = () => { if (!fired) { fired = true; onArrive?.(); } };
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 180 + Math.random() * 260;
        cardPool.emit({
            x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 40, z: 80,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s + 120, vz: 0,
            life: 2.2, size: size * (0.7 + Math.random() * 0.6), color,
            target, home: 2600 + Math.random() * 900, onArrive: i === 0 ? once : null, delay: delay + i * 0.012, shrink: 0,
        });
    }
    if (onArrive) setTimeout(once, (delay + 1.1) * 1000);
}

export function beam(x0, y0, x1, y1, color, { width = 34, life = 0.55 } = {}) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: beamTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 150);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    m.scale.set(len + width * 2, width, 1);
    m.renderOrder = 60;
    cardScene.add(m);
    beams.push({ m, life, max: life, w: width });
}

export function worldRing(pos, color, { size = 3, life = 0.5, y = 0.1 } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, y, pos.z);
    worldScene.add(m);
    rings.push({ m, life, max: life, size });
}

// ------------------------------------------------------------------ world effects

export function worldBurst(pos, color, n = 30, { speed = 4, size = 5, life = 0.9, up = 2, grav = 4 } = {}) {
    n = take(n);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.3 + Math.random() * 0.7);
        worldPool.emit({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + up, vz: Math.sin(a) * Math.cos(e) * s, life: life * (0.5 + Math.random() * 0.8), size: size * (0.5 + Math.random()), color, grav, drag: 1.5 });
    }
}

export function worldRise(pos, color, n = 20, { spread = 0.8, speed = 1.6, size = 5, life = 1.2 } = {}) {
    n = take(n);
    for (let i = 0; i < n; i++) {
        worldPool.emit({ x: pos.x + (Math.random() - 0.5) * spread * 2, y: pos.y + Math.random() * 0.5, z: pos.z + (Math.random() - 0.5) * spread, vx: 0, vy: speed * (0.5 + Math.random()), vz: 0, life: life * (0.5 + Math.random() * 0.7), size: size * (0.6 + Math.random() * 0.8), color, drag: 0.5, delay: Math.random() * 0.3 });
    }
}

export function updateFx(dt) {
    cardPool.update(dt);
    worldPool.update(dt);
    for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.life -= dt;
        const k = Math.max(0, b.life / b.max);
        b.m.material.opacity = k;
        b.m.scale.y = b.w * (0.4 + k);
        if (b.life <= 0) { cardScene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); beams.splice(i, 1); }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life -= dt;
        const k = 1 - Math.max(0, r.life / r.max);
        r.m.scale.setScalar(r.size * (0.2 + k));
        r.m.material.opacity = 1 - k;
        if (r.life <= 0) { worldScene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); }
    }
}
