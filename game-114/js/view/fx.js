// Effects: two batches of camera-facing quads (one additive for light — bullets, sparks, glows,
// shock rings, beams; one alpha-blended for smoke and debris), a small particle simulation, and
// short-lived flash lights for the light pool. Colours above 1 feed the bloom.

import * as THREE from 'three';

const VERT = /* glsl */`
    attribute vec4 aCol;
    attribute float aShape;
    varying vec4 vCol; varying vec2 vUv; varying float vShape;
    void main() { vCol = aCol; vUv = uv; vShape = aShape; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
    varying vec4 vCol; varying vec2 vUv; varying float vShape;
    uniform float uAdd;
    void main() {
        vec2 q = vUv * 2.0 - 1.0;
        float d = length(q);
        float a;
        if (vShape < 0.5) a = exp(-d * d * 4.5);                         // soft glow
        else if (vShape < 1.5) a = exp(-pow((d - 0.78) * 7.0, 2.0));     // ring
        else if (vShape < 2.5) a = smoothstep(1.0, 0.55, d);             // solid dot
        else a = exp(-q.y * q.y * 6.0) * smoothstep(1.0, 0.7, abs(q.x)); // beam / streak
        a *= step(d, 1.42);
        if (uAdd > 0.5) gl_FragColor = vec4(vCol.rgb * a * vCol.a, 1.0);
        else gl_FragColor = vec4(vCol.rgb, a * vCol.a);
    }`;

class QuadBatch {
    constructor(scene, max, additive) {
        this.max = max;
        this.n = 0;
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(max * 12);
        this.col = new Float32Array(max * 16);
        this.shp = new Float32Array(max * 4);
        const uv = new Float32Array(max * 8), idx = new Uint32Array(max * 6);
        for (let i = 0; i < max; i++) {
            uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
            idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
        }
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aShape', new THREE.BufferAttribute(this.shp, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            vertexShader: VERT, fragmentShader: FRAG, uniforms: { uAdd: { value: additive ? 1 : 0 } },
            transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = additive ? 20 : 10;
        scene.add(this.mesh);
    }
    begin() { this.n = 0; }
    /** A quad centred at (x, y, z), long axis along (dx, dy), half-length hl, half-width hw. */
    quad(x, y, z, dx, dy, hl, hw, r, g, b, a, shape = 0) {
        if (this.n >= this.max) return;
        const i = this.n++;
        const px = -dy * hw, py = dx * hw, lx = dx * hl, ly = dy * hl;
        const p = this.pos, o = i * 12;
        p[o] = x - lx - px; p[o + 1] = y - ly - py; p[o + 2] = z;
        p[o + 3] = x + lx - px; p[o + 4] = y + ly - py; p[o + 5] = z;
        p[o + 6] = x + lx + px; p[o + 7] = y + ly + py; p[o + 8] = z;
        p[o + 9] = x - lx + px; p[o + 10] = y - ly + py; p[o + 11] = z;
        const c = this.col, k = i * 16;
        for (let j = 0; j < 4; j++) { c[k + j * 4] = r; c[k + j * 4 + 1] = g; c[k + j * 4 + 2] = b; c[k + j * 4 + 3] = a; }
        this.shp[i * 4] = this.shp[i * 4 + 1] = this.shp[i * 4 + 2] = this.shp[i * 4 + 3] = shape;
    }
    /** A round blob of radius s. */
    blob(x, y, z, s, r, g, b, a = 1, shape = 0) { this.quad(x, y, z, 1, 0, s, s, r, g, b, a, shape); }
    end() {
        this.geo.setDrawRange(0, this.n * 6);
        for (const k of ['position', 'aCol', 'aShape']) this.geo.attributes[k].needsUpdate = true;
    }
}

const C = (hex, k = 1) => [((hex >> 16) & 255) / 255 * k, ((hex >> 8) & 255) / 255 * k, (hex & 255) / 255 * k];
export const COLORS = {
    blaster: 0x62e8ff, spread: 0xffc04a, laser: 0xd28cff, rocket: 0xff7a3a, flare: 0xff5a2a,
    acid: 0xa6ff3a, bolt: 0xff4a4a, ring: 0xff8a3a, spit: 0xff5ac8, egg: 0xff9ad8,
    skitter: 0xa6ff3a, hiveling: 0xff5cc0, wisp: 0x7af0ff, spitter: 0xb8ff3c, turret: 0xff6a3a, brute: 0xffa040, nest: 0xff5cc0, missile: 0xffd25a,
    rescue: 0x8adfff, med: 0xff6a6a, gold: 0xffd25a,
};
export const colorOf = (k) => COLORS[k] ?? 0xffffff;

export class FX {
    constructor(scene) {
        this.add = new QuadBatch(scene, 4000, true);
        this.alpha = new QuadBatch(scene, 1500, false);
        this.parts = [];
        this.flashes = [];       // light pool candidates that fade
        this.rings = [];
        this.reduced = false;
        this.amount = 1;         // particle multiplier by quality
    }

    p(o) { if (this.parts.length < 2600) this.parts.push(o); }

    /** Emit n particles: o = { x, y, speed, spread, dir, life, size, color, g, drag, shape, add, stretch, z } */
    emit(n, o) {
        n = Math.max(1, Math.round(n * this.amount));
        const col = Array.isArray(o.color) ? o.color : C(o.color ?? 0xffffff, o.k ?? 1);
        for (let i = 0; i < n; i++) {
            const a = (o.dir ?? Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
            const s = (o.speed ?? 4) * (0.35 + Math.random() * 0.65);
            const life = (o.life ?? 0.5) * (0.6 + Math.random() * 0.6);
            this.p({
                x: o.x + (Math.random() - 0.5) * (o.jx ?? 0), y: o.y + (Math.random() - 0.5) * (o.jy ?? 0), z: o.z ?? 0.4 + Math.random() * 0.3,
                vx: Math.cos(a) * s + (o.vx ?? 0), vy: Math.sin(a) * s + (o.vy ?? 0),
                t: life, max: life, size: (o.size ?? 0.15) * (0.6 + Math.random() * 0.7), grow: o.grow ?? 0,
                col, g: o.g ?? 0, drag: o.drag ?? 1.5, shape: o.shape ?? 0, addv: o.add !== false, stretch: o.stretch ?? 0, alpha: o.alpha ?? 1,
            });
        }
    }

    flash(x, y, color, intensity, t = 0.15, dist = 9) { this.flashes.push({ x, y, z: 1.4, color, intensity, t, max: t, dist, pri: 3 }); }
    ring(x, y, r, color, t = 0.35, w = 0.12) { this.rings.push({ x, y, r, color: C(color, 2.5), t, max: t, w }); }

    // ------------------------------------------------------------ recipes
    muzzle(x, y, ax, ay, kind) {
        const c = colorOf(kind);
        this.emit(4, { x, y, dir: Math.atan2(ay, ax), spread: 0.7, speed: 9, life: 0.09, size: 0.09, color: c, k: 3, stretch: 0.05 });
        this.flashes.push({ x: x + ax * 0.6, y: y + ay * 0.6, z: 2.2, color: c, intensity: kind === 'rocket' ? 10 : 5, t: 0.06, max: 0.06, dist: 7, pri: 3 });
        this.muzzleFlash = { x, y, ax, ay, t: 0.06, c };
    }
    spark(x, y, kind = 'blaster') {
        const c = colorOf(kind);
        this.emit(7, { x, y, speed: 7, life: 0.25, size: 0.07, color: c, k: 3, g: 14, stretch: 0.05 });
        this.emit(1, { x, y, speed: 0, life: 0.12, size: 0.5, color: c, k: 1.5 });
    }
    hit(x, y, kind) {
        const c = colorOf(kind);
        this.emit(6, { x, y, speed: 6, life: 0.3, size: 0.08, color: c, k: 2.5, g: 10, stretch: 0.04 });
        this.emit(3, { x, y, speed: 2.5, life: 0.4, size: 0.12, color: 0x2a1030, add: false, g: 12, shape: 2 });
    }
    gore(x, y, kind, big = 1) {
        const c = colorOf(kind);
        this.emit(16 * big, { x, y, speed: 8 * Math.sqrt(big), life: 0.6, size: 0.1, color: c, k: 2.5, g: 16, stretch: 0.05 });
        this.emit(10 * big, { x, y, speed: 6, life: 0.9, size: 0.13, color: 0x1e0c26, add: false, g: 20, shape: 2, drag: 0.5 });
        this.emit(3 * big, { x, y, speed: 1.5, life: 0.6, size: 0.4 * big, grow: 0.8, color: 0x332838, add: false, alpha: 0.35, drag: 2 });
        this.emit(1, { x, y, speed: 0, life: 0.18, size: 1.2 * big, color: c, k: 1.4 });
        this.flash(x, y, c, 20 * big, 0.25, 7);
    }
    explosion(x, y, r = 1.5, kind = 'rocket') {
        const c = kind === 'flare' ? 0xffa040 : kind === 'boss' ? 0xff8a3a : 0xff7a2a;
        this.emit(Math.round(26 * r), { x, y, speed: 9 * r, life: 0.55, size: 0.12, color: c, k: 3, g: 8, stretch: 0.04, drag: 2.2 });
        this.emit(Math.round(10 * r), { x, y, speed: 3 * r, life: 0.5, size: 0.45 * r, grow: 1.5, color: 0xffd080, k: 2.2, drag: 3 });
        this.emit(Math.round(6 * r), { x, y, speed: 2.2 * r, life: 1.0, size: 0.35 * r, grow: 1.0, color: 0x2a2228, add: false, alpha: 0.45, vy: 1.2, drag: 1.4 });
        this.emit(1, { x, y, speed: 0, life: 0.2, size: 1.6 * r, color: 0xffe0a0, k: 2.5 });
        this.ring(x, y, r * 1.3, c, 0.4, 0.15);
        this.flash(x, y, c, 70 * r, 0.4, 12);
    }
    dust(x, y, n = 6, s = 1) {
        this.emit(n, { x, y: y + 0.05, dir: Math.PI / 2, spread: 2.6, speed: 2.5 * s, life: 0.5, size: 0.22, grow: 0.8, color: 0x8a8090, add: false, alpha: 0.4, g: -1, drag: 3 });
    }
    rescue(x, y) {
        this.beams.push({ x, y, t: 1.4, max: 1.4 });
        this.emit(40, { x, y: y + 1, jx: 0.8, jy: 2, dir: Math.PI / 2, spread: 0.4, speed: 4, life: 1.1, size: 0.08, color: 0x9adfff, k: 3, drag: 0.5 });
        this.ring(x, y + 1, 1.6, 0x8adfff, 0.6, 0.12);
        this.flash(x, y + 1.5, 0x8adfff, 50, 1.0, 10);
    }
    acid(x, y, n = 10) {
        this.emit(n, { x, y, dir: Math.PI / 2, spread: 1.8, speed: 5, life: 0.5, size: 0.08, color: 0xb8ff3c, k: 2.5, g: 22 });
    }
    steam(x, y) {
        this.emit(3, { x, y: y + 0.2, jx: 0.5, dir: Math.PI / 2, spread: 0.4, speed: 6, life: 0.6, size: 0.35, grow: 2, color: 0xd8e0f0, add: false, alpha: 0.35, drag: 1 });
    }
    get beams() { return this._beams || (this._beams = []); }

    // ------------------------------------------------------------ per frame
    update(dt) {
        const P = this.parts;
        for (let i = P.length - 1; i >= 0; i--) {
            const q = P[i];
            q.t -= dt;
            if (q.t <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
            const k = Math.exp(-q.drag * dt);
            q.vx *= k; q.vy = q.vy * k - q.g * dt;
            q.x += q.vx * dt; q.y += q.vy * dt;
            q.size += q.grow * dt;
        }
        for (const f of this.flashes) f.t -= dt;
        this.flashes = this.flashes.filter((f) => f.t > 0);
        for (const r of this.rings) r.t -= dt;
        this.rings = this.rings.filter((r) => r.t > 0);
        for (const b of this.beams) b.t -= dt;
        this._beams = this.beams.filter((b) => b.t > 0);
        if (this.muzzleFlash) { this.muzzleFlash.t -= dt; if (this.muzzleFlash.t <= 0) this.muzzleFlash = null; }
    }

    /** Write the particles into the batches (call between begin and end). */
    draw() {
        const A = this.add, B = this.alpha;
        for (const q of this.parts) {
            const f = q.t / q.max;
            const [r, g, b] = q.col;
            if (q.addv) {
                if (q.stretch) {
                    const sp = Math.hypot(q.vx, q.vy) || 1;
                    A.quad(q.x, q.y, q.z, q.vx / sp, q.vy / sp, q.size + sp * q.stretch, q.size * 0.6, r, g, b, f * q.alpha, 0);
                } else A.blob(q.x, q.y, q.z, q.size, r, g, b, f * q.alpha, q.shape);
            } else B.blob(q.x, q.y, q.z - 0.1, q.size, r, g, b, Math.min(1, f * 1.5) * q.alpha, q.shape);
        }
        for (const ring of this.rings) {
            const f = 1 - ring.t / ring.max;
            const s = ring.r * (0.3 + f * 1.2);
            A.blob(ring.x, ring.y, 0.5, s, ring.color[0], ring.color[1], ring.color[2], 1 - f, 1);
        }
        for (const bm of this.beams) {
            const f = bm.t / bm.max;
            const w = 0.7 * Math.sin(Math.min(1, (1 - f) * 4) * Math.PI / 2) * f;
            A.quad(bm.x, bm.y + 6, 0.3, 0, 1, 7, w + 0.05, 0.6 * 2, 0.9 * 2, 1.0 * 2.4, f, 3);
            A.quad(bm.x, bm.y + 6, 0.32, 0, 1, 7, w * 0.35, 2.5, 2.5, 2.5, f, 3);
        }
        const m = this.muzzleFlash;
        if (m) {
            const [r, g, b] = C(m.c, 3);
            A.quad(m.x + m.ax * 0.25, m.y + m.ay * 0.25, 0.45, m.ax, m.ay, 0.34, 0.16, r * 0.7, g * 0.7, b * 0.7, 1, 0);
            A.blob(m.x + m.ax * 0.1, m.y + m.ay * 0.1, 0.45, 0.16, 2, 2, 2, 0.8, 0);
        }
    }
}

export { C as hexToRgb };
