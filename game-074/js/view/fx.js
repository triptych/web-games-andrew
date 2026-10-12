// Particles, explosions, debris and flash lights. View-only: none of this
// touches the sim. Explosions are layered — a white flash, a fireball of
// flame sprites, streak sparks, a shock ring, smoke that lingers, and real 3D
// debris chunks that tumble and fall — plus a point light that lights the
// models and terrain around the blast for a moment.

import * as THREE from 'three';
import { Sprites, SHAPE } from './sprites.js';
import { Builder, litMat, ico } from './lib.js';

const PAL = {
    fire: [[1, 0.55, 0.15], [1, 0.85, 0.4], [0.35, 0.08, 0.04]],
    bone: [[0.95, 0.9, 0.75], [0.6, 1, 0.45], [0.3, 0.27, 0.22]],
    ice: [[0.6, 0.9, 1], [1, 1, 1], [0.35, 0.45, 0.6]],
    flesh: [[1, 0.25, 0.3], [1, 0.75, 0.5], [0.3, 0.04, 0.06]],
    soul: [[0.3, 1, 0.85], [0.85, 1, 1], [0.05, 0.2, 0.2]],
    holy: [[1, 0.85, 0.45], [1, 1, 0.9], [0.4, 0.3, 0.2]],
    iron: [[1, 0.6, 0.2], [1, 0.95, 0.7], [0.2, 0.18, 0.16]],
    void: [[0.8, 0.2, 1], [1, 0.6, 1], [0.1, 0.02, 0.12]],
};
export const KIND_PAL = {
    imp: 'fire', fly: 'fire', skull: 'bone', eye: 'flesh', turret: 'bone', hound: 'fire', worm: 'bone', wraith: 'soul',
    carrier: 'void', mine: 'iron', bull: 'fire', lancer: 'fire', pod: 'flesh', lantern: 'soul', crystal: 'ice',
    tentacle: 'flesh', gargoyle: 'bone', seraphling: 'void', hand: 'soul', wheel: 'iron', boss: 'fire', player: 'holy',
};

export class FX {
    constructor(scene) {
        this.sprites = new Sprites(6000, 8);
        scene.add(this.sprites.mesh);
        this.ps = [];
        this.free = [];
        // debris
        const db = new Builder();
        db.add(ico(0), { color: 0xffffff, glow: 0.0 });
        this.debrisMat = litMat({ rough: 0.8, glowMul: 1.5, flat: true });
        this.debris = new THREE.InstancedMesh(db.build(), this.debrisMat, 220);
        this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.debris.frustumCulled = false;
        this.debris.count = 0;
        this.db = [];
        scene.add(this.debris);
        // flash lights
        this.lights = [];
        for (let i = 0; i < 4; i++) {
            const l = new THREE.PointLight(0xff8040, 0, 14, 1.6);
            l.position.set(-100, 0, 2);
            scene.add(l);
            this.lights.push({ l, t: 0, life: 1, i0: 0 });
        }
        this.li = 0;
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
        this.quality = 1;
    }

    clear() { this.ps.length = 0; this.db.length = 0; for (const L of this.lights) L.l.intensity = 0; }

    p(o) {
        if (this.ps.length > 2600 * this.quality) return;
        const q = this.free.pop() || {};
        q.x = o.x; q.y = o.y; q.z = o.z ?? 0.4;
        q.vx = o.vx ?? 0; q.vy = o.vy ?? 0; q.vz = o.vz ?? 0;
        q.t = 0; q.life = o.life ?? 0.6;
        q.s0 = o.s0 ?? 0.4; q.s1 = o.s1 ?? q.s0;
        q.c = o.c ?? [1, 1, 1]; q.c2 = o.c2 ?? q.c;
        q.a0 = o.a0 ?? 1; q.a1 = o.a1 ?? 0;
        q.shape = o.shape ?? SHAPE.orb;
        q.rot = o.rot ?? 0; q.vr = o.vr ?? 0;
        q.drag = o.drag ?? 0; q.grav = o.grav ?? 0;
        q.stretch = o.stretch ?? 0;
        q.aspect = o.aspect ?? 1;
        this.ps.push(q);
        return q;
    }

    light(x, y, color, intensity, life) {
        const L = this.lights[this.li++ % this.lights.length];
        L.l.position.set(x, y, 2.5);
        L.l.color.setRGB(...color);
        L.i0 = intensity; L.t = 0; L.life = life;
        L.l.intensity = intensity;
    }

    /** An explosion of world size `size` (≈ radius) in palette `pal`. */
    explode(x, y, size = 1, palName = 'fire', opts = {}) {
        const pal = PAL[palName] || PAL.fire;
        const q = this.quality;
        const R = (a, b) => a + Math.random() * (b - a);
        this.p({ x, y, z: 0.8, s0: size * 2.2, s1: size * 4.5, c: [1, 1, 1], a0: 1.6, life: 0.16, shape: SHAPE.orb });
        this.p({ x, y, z: 0.6, s0: size * 1.2, s1: size * 6, c: pal[1], a0: 1.2, life: 0.4, shape: SHAPE.ring });
        const nf = Math.round((8 + size * 10) * q);
        for (let i = 0; i < nf; i++) {
            const a = R(0, Math.PI * 2), sp = R(0.5, 3.2) * size;
            this.p({ x: x + R(-0.2, 0.2) * size, y: y + R(-0.2, 0.2) * size, z: R(0, 1), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.6, s0: R(0.5, 1.1) * size, s1: R(1.1, 2.0) * size, c: pal[1], c2: pal[0], a0: 1.3, life: R(0.35, 0.7), shape: SHAPE.flame, rot: R(-0.4, 0.4), drag: 2.5 });
        }
        const ns = Math.round((10 + size * 12) * q);
        for (let i = 0; i < ns; i++) {
            const a = R(0, Math.PI * 2), sp = R(4, 14) * Math.sqrt(size);
            this.p({ x, y, z: R(0, 1.5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s0: R(0.08, 0.14), s1: 0.03, c: pal[1], a0: 1.8, life: R(0.25, 0.6), shape: SHAPE.streak, stretch: 0.025, drag: 2.5, grav: -6 });
        }
        const nm = Math.round((3 + size * 5) * q);
        for (let i = 0; i < nm; i++) {
            const a = R(0, Math.PI * 2), sp = R(0.3, 1.4) * size;
            this.p({ x: x + R(-0.4, 0.4) * size, y: y + R(-0.4, 0.4) * size, z: R(-0.3, 0.3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.8, s0: size * R(0.8, 1.4), s1: size * R(2.2, 3.4), c: pal[2], a0: 0.85, a1: 0, life: R(1.0, 1.9), shape: SHAPE.smoke, drag: 1.2 });
        }
        const nd = Math.round((opts.debris ?? (2 + size * 4)) * q);
        for (let i = 0; i < nd && this.db.length < 220; i++) {
            const a = R(0, Math.PI * 2), sp = R(3, 9) * Math.sqrt(size);
            this.db.push({ x, y, z: R(-0.5, 1), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, vz: R(-3, 3), rx: R(0, 6), ry: R(0, 6), vrx: R(-9, 9), vry: R(-9, 9), s: R(0.08, 0.22) * Math.sqrt(size), t: 0, life: R(1.0, 1.8), c: pal[2], hot: Math.random() < 0.5 });
        }
        this.light(x, y, pal[0], 6 + size * 8, 0.35 + size * 0.1);
    }

    sparks(x, y, n, col, speed = 8, life = 0.25) {
        for (let i = 0; i < n * this.quality; i++) {
            const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
            this.p({ x, y, z: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s0: 0.1, s1: 0.03, c: col, a0: 2, life: life * (0.6 + Math.random() * 0.8), shape: SHAPE.streak, stretch: 0.05, drag: 3 });
        }
    }

    update(dt, time) {
        const S = this.sprites;
        S.begin();
        const keep = [];
        for (const q of this.ps) {
            if (q.t >= q.life) { this.free.push(q); continue; }   // drawn at least once, even one-frame sprites
            q.t += dt;
            const k = Math.min(1, q.t / q.life);
            if (q.drag) { const f = Math.max(0, 1 - q.drag * dt); q.vx *= f; q.vy *= f; q.vz *= f; }
            q.vy += q.grav * dt;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            q.rot += q.vr * dt;
            const s = q.s0 + (q.s1 - q.s0) * k;
            const a = q.a0 + (q.a1 - q.a0) * k;
            const r = q.c[0] + (q.c2[0] - q.c[0]) * k, g = q.c[1] + (q.c2[1] - q.c[1]) * k, b = q.c[2] + (q.c2[2] - q.c[2]) * k;
            if (q.stretch) {
                const sp = Math.hypot(q.vx, q.vy);
                S.add(q.x, q.y, q.z, Math.max(s * 2, sp * q.stretch * 4), s, Math.atan2(q.vy, q.vx), r, g, b, a, q.shape);
            } else S.add(q.x, q.y, q.z, s * q.aspect, s, q.rot, r, g, b, a, q.shape);
            keep.push(q);
        }
        this.ps = keep;
        S.end(time);

        // debris
        const dk = [];
        let n = 0;
        const col = new THREE.Color();
        for (const d of this.db) {
            d.t += dt;
            if (d.t > d.life) continue;
            d.vy -= 16 * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            d.rx += d.vrx * dt; d.ry += d.vry * dt;
            const s = d.s * Math.min(1, (d.life - d.t) * 3);
            this._e.set(d.rx, d.ry, 0);
            this._q.setFromEuler(this._e);
            this._m.compose(this._p.set(d.x, d.y, d.z), this._q, this._s.set(s, s, s));
            this.debris.setMatrixAt(n, this._m);
            const hot = d.hot ? Math.max(0, 1 - d.t * 1.5) : 0;
            col.setRGB(d.c[0] + hot * 3, d.c[1] + hot * 1.2, d.c[2] + hot * 0.2);
            this.debris.setColorAt(n, col);
            n++;
            dk.push(d);
        }
        this.db = dk;
        this.debris.count = n;
        this.debris.instanceMatrix.needsUpdate = true;
        if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;

        for (const L of this.lights) {
            if (L.l.intensity <= 0) continue;
            L.t += dt;
            L.l.intensity = Math.max(0, L.i0 * (1 - L.t / L.life));
        }
    }
}
