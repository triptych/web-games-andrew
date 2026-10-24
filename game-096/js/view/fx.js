// Particles, shock rings and screen shake. The view only; the sim never sees any of it.

import { THREE } from './kit.js';

const MAXP = 1400;

class Particles {
    constructor(scene, additive) {
        this.n = 0;
        this.pos = new Float32Array(MAXP * 3);
        this.col = new Float32Array(MAXP * 3);
        this.siz = new Float32Array(MAXP);
        this.alp = new Float32Array(MAXP);
        this.vel = new Float32Array(MAXP * 3);
        this.life = new Float32Array(MAXP);
        this.age = new Float32Array(MAXP);
        this.grav = new Float32Array(MAXP);
        this.drag = new Float32Array(MAXP);
        this.grow = new Float32Array(MAXP);
        this.s0 = new Float32Array(MAXP);
        this.a0 = new Float32Array(MAXP);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('alpha', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
        g.setDrawRange(0, 0);
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: { uScale: { value: 400 } },
            vertexShader: `
                attribute float size; attribute float alpha; attribute vec3 color;
                varying float vA; varying vec3 vC; uniform float uScale;
                void main() {
                    vA = alpha; vC = color;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = max(1.0, size * uScale / max(0.1, -mv.z));
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                varying float vA; varying vec3 vC;
                void main() {
                    float d = length(gl_PointCoord - 0.5) * 2.0;
                    float a = smoothstep(1.0, 0.55, d) * vA;
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(vC, a);
                }`,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
    }

    emit(x, y, z, vx, vy, vz, life, size, color, o = {}) {
        let i = this.n;
        if (i >= MAXP) i = Math.floor(Math.random() * MAXP);
        else this.n++;
        const c = _c.set(color);
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
        this.life[i] = life; this.age[i] = 0;
        this.s0[i] = size; this.siz[i] = size;
        this.a0[i] = o.alpha ?? 1; this.alp[i] = this.a0[i];
        this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0; this.grow[i] = o.grow ?? 0;
    }

    update(dt) {
        let n = this.n;
        for (let i = 0; i < n; i++) {
            this.age[i] += dt;
            if (this.age[i] >= this.life[i]) {
                // swap-remove
                n--;
                if (i < n) this._copy(n, i);
                i--;
                continue;
            }
            const k = this.age[i] / this.life[i];
            const d = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
            this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            this.siz[i] = this.s0[i] * (1 + this.grow[i] * k) * (k > 0.7 ? 1 - (k - 0.7) * 1.2 : 1);
            this.alp[i] = this.a0[i] * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 * 0.9);
        }
        this.n = n;
        const g = this.points.geometry;
        g.setDrawRange(0, n);
        for (const a of ['position', 'color', 'size', 'alpha']) g.attributes[a].needsUpdate = true;
    }

    _copy(from, to) {
        for (const a of [this.pos, this.col, this.vel]) for (let j = 0; j < 3; j++) a[to * 3 + j] = a[from * 3 + j];
        for (const a of [this.siz, this.alp, this.life, this.age, this.grav, this.drag, this.grow, this.s0, this.a0]) a[to] = a[from];
    }
}
const _c = new THREE.Color();
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.soft = new Particles(scene, false);
        this.glow = new Particles(scene, true);
        this.rings = [];
        this.shakeAmt = 0;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.reduced = false;
    }

    setScale(px) { this.soft.mat.uniforms.uScale.value = px; this.glow.mat.uniforms.uScale.value = px; }
    shake(a) { if (!this.reduced) this.shakeAmt = Math.max(this.shakeAmt, a); }

    update(dt) {
        this.soft.update(dt); this.glow.update(dt);
        this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.4);
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.t += dt;
            const k = r.t / r.dur;
            if (k >= 1) { this.group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
            const s = 0.2 + (r.max - 0.2) * (1 - (1 - k) * (1 - k));
            r.m.scale.set(s, s, 1);
            r.m.material.opacity = (1 - k) * r.alpha;
        }
    }

    // ---- emitters
    ring(x, y, z, max = 4, color = 0xffffff, dur = 0.5, alpha = 0.8, thick = 0.14) {
        const m = new THREE.Mesh(new THREE.RingGeometry(1 - thick, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.06, z);
        m.renderOrder = 4;
        this.group.add(m);
        this.rings.push({ m, t: 0, dur, max, alpha });
    }
    dust(x, y, z, n = 6, color = 0xf4e3bc, spread = 1.6, size = 0.5) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283, s = rnd(0.5, 1) * spread;
            this.soft.emit(x + Math.cos(a) * 0.2, y + 0.1, z + Math.sin(a) * 0.2, Math.cos(a) * s, rnd(0.4, 1.6), Math.sin(a) * s, rnd(0.35, 0.65), size * rnd(0.7, 1.2), color, { drag: 3, grow: 1.4, alpha: 0.75 });
        }
    }
    splash(x, y, z, n = 18) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283, s = rnd(1, 3.4);
            this.soft.emit(x, y, z, Math.cos(a) * s, rnd(4, 9), Math.sin(a) * s, rnd(0.7, 1.1), rnd(0.3, 0.55), i % 3 ? 0xdff8ff : 0xffffff, { grav: 18, alpha: 0.9 });
        }
        this.ring(x, y, z, 3.2, 0xffffff, 0.7, 0.8);
    }
    sparkle(x, y, z, color = 0xfff4a0, n = 8, speed = 2.2) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283, b = Math.random() * 3.14 - 1.57, s = rnd(0.4, 1) * speed;
            this.glow.emit(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 0.8, Math.sin(a) * Math.cos(b) * s, rnd(0.35, 0.7), rnd(0.2, 0.4), color, { drag: 2.2, grav: 2, alpha: 0.95 });
        }
    }
    confetti(x, y, z, n = 40) {
        const cols = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff9ff3, 0xffffff];
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283, s = rnd(1.5, 5);
            this.soft.emit(x, y, z, Math.cos(a) * s, rnd(5, 10), Math.sin(a) * s, rnd(1.2, 2.2), rnd(0.18, 0.3), cols[i % cols.length], { grav: 7, drag: 0.8, alpha: 1 });
        }
    }
    debris(x, y, z, color, n = 10) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283, s = rnd(1, 4);
            this.soft.emit(x, y, z, Math.cos(a) * s, rnd(3, 7), Math.sin(a) * s, rnd(0.5, 0.9), rnd(0.2, 0.38), color, { grav: 16, alpha: 1 });
        }
        this.dust(x, y - 0.3, z, 4, 0xe8dcc0, 1.3, 0.55);
    }
    stars(x, y, z, n = 8) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.283;
            this.glow.emit(x, y, z, Math.cos(a) * 3, rnd(1, 3), Math.sin(a) * 3, 0.6, 0.4, 0xffe36b, { drag: 2, grav: 2 });
        }
    }
    bubbles(x, y, z, n = 1, spread = 0.5) {
        for (let i = 0; i < n; i++) this.soft.emit(x + rnd(-spread, spread), y, z + rnd(-spread, spread), rnd(-0.2, 0.2), rnd(2, 3.4), rnd(-0.2, 0.2), rnd(0.9, 1.5), rnd(0.12, 0.26), 0xe6fbff, { alpha: 0.7 });
    }
    poof(x, y, z, color = 0xffffff) {
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * 6.283, s = rnd(1, 3);
            this.soft.emit(x, y + 0.5, z, Math.cos(a) * s, rnd(0, 2.5), Math.sin(a) * s, rnd(0.4, 0.7), rnd(0.4, 0.7), color, { drag: 3, grow: 1.5, alpha: 0.85 });
        }
        this.sparkle(x, y + 0.7, z, 0xfff4a0, 8, 3);
    }
    smoke(x, y, z, n = 3, color = 0xdddddd) {
        for (let i = 0; i < n; i++) this.soft.emit(x + rnd(-0.1, 0.1), y, z + rnd(-0.1, 0.1), rnd(-0.4, 0.4), rnd(0.8, 1.6), rnd(-0.4, 0.4), rnd(0.5, 0.9), rnd(0.3, 0.5), color, { grow: 1.5, alpha: 0.6 });
    }
    leaf(x, y, z, color = 0x6fd05a) {
        this.soft.emit(x, y, z, rnd(-0.3, 0.3), rnd(-0.2, 0.1), rnd(-0.3, 0.3), rnd(4, 7), 0.16, color, { grav: -0.1, alpha: 0.9 });
    }
    streak(x, y, z, color = 0xffffff) {
        this.glow.emit(x, y, z, 0, 0, 0, 0.35, 0.3, color, { alpha: 0.6, grow: -0.3 });
    }
}
