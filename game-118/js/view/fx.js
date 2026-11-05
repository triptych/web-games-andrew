// Particles: confetti leaves, gold sparkles, shock rings and the drifting leaves in the air.
// One InstancedMesh per kind, so every effect on screen is three draw calls however busy a merge gets.

import * as THREE from 'three';
import { leafGeo } from './models.js';
import { hash3 } from '../rng.js';

const CONFETTI = [0xe9772b, 0xc92f3c, 0xf2c230, 0xb8541d, 0x6d9c2e, 0xf08a24, 0xffe08a];
const dummy = new THREE.Object3D();
const col = new THREE.Color();

export class Fx {
    constructor(scene) {
        this.calm = false;
        this.max = 420;
        this.n = 0;
        this.next = 0;
        const d = () => new Float32Array(this.max);
        this.p = { x: d(), y: d(), z: d(), vx: d(), vy: d(), vz: d(), rx: d(), ry: d(), rz: d(), vr: d(), life: d(), max: d(), size: d(), grav: d(), kind: new Uint8Array(this.max), color: new Uint32Array(this.max) };

        this.leaves = new THREE.InstancedMesh(leafGeo(0.2, 0.1, 0.012), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.max);
        this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xffe9a0, toneMapped: false }), this.max);
        for (const m of [this.leaves, this.sparks]) {
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.frustumCulled = false;
            m.count = 0;
            scene.add(m);
        }
        this.leaves.setColorAt(0, col.set(0xffffff));
        this.leaves.instanceColor.setUsage(THREE.DynamicDrawUsage);

        // rings
        this.rings = [];
        const rg = new THREE.RingGeometry(0.3, 0.38, 48);
        rg.rotateX(-Math.PI / 2);
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
            m.visible = false;
            m.renderOrder = 5;
            scene.add(m);
            this.rings.push({ m, t: 1, dur: 0.5, size: 1, y: 0 });
        }

        // the leaves that drift down through the light, always, slowly
        this.air = new THREE.InstancedMesh(leafGeo(0.34, 0.17, 0.012), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 16);
        this.air.frustumCulled = false;
        for (let i = 0; i < 16; i++) this.air.setColorAt(i, col.set(CONFETTI[i % 6]).multiplyScalar(0.8));
        scene.add(this.air);
        this.airSeed = Array.from({ length: 16 }, (_, i) => ({ x: (hash3(i, 1) - 0.5) * 14, z: (hash3(i, 2) - 0.5) * 16, s: 0.25 + hash3(i, 3) * 0.3, ph: hash3(i, 4) * 6.28, sp: 0.6 + hash3(i, 5) }));
    }

    spawn(kind, x, y, z, vx, vy, vz, life, size, grav, color) {
        const i = this.next;
        this.next = (this.next + 1) % this.max;
        if (i >= this.n) this.n = i + 1;
        const p = this.p;
        p.x[i] = x; p.y[i] = y; p.z[i] = z; p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
        p.rx[i] = Math.random() * 6; p.ry[i] = Math.random() * 6; p.rz[i] = Math.random() * 6;
        p.vr[i] = (Math.random() - 0.5) * 12;
        p.life[i] = life; p.max[i] = life; p.size[i] = size; p.grav[i] = grav; p.kind[i] = kind; p.color[i] = color;
    }

    /** A burst of confetti leaves and sparkles at a point. */
    burst(x, y, z, { n = 14, power = 2.4, size = 1, colors = CONFETTI, sparks = 5 } = {}) {
        const k = this.calm ? 0.45 : 1;
        for (let i = 0; i < Math.round(n * k); i++) {
            const a = Math.random() * 6.283, s = (0.5 + Math.random()) * power;
            this.spawn(0, x, y, z, Math.cos(a) * s, 1.4 + Math.random() * power * 0.8, Math.sin(a) * s, 0.8 + Math.random() * 0.6, size * (0.7 + Math.random() * 0.6), 7, colors[i % colors.length]);
        }
        for (let i = 0; i < Math.round(sparks * k); i++) {
            const a = Math.random() * 6.283, s = (0.4 + Math.random() * 0.8) * power;
            this.spawn(1, x, y + 0.1, z, Math.cos(a) * s, 0.8 + Math.random() * 2, Math.sin(a) * s, 0.5 + Math.random() * 0.4, 0.7 + Math.random() * 0.8, 3, 0);
        }
    }

    /** A shower from above, for goals and the big dinner. */
    rain(cx, cz, w, n) {
        const k = this.calm ? 0.4 : 1;
        for (let i = 0; i < Math.round(n * k); i++) {
            this.spawn(0, cx + (Math.random() - 0.5) * w, 4.5 + Math.random() * 2, cz + (Math.random() - 0.5) * w, (Math.random() - 0.5) * 1.2, -0.5 - Math.random(), (Math.random() - 0.5) * 1.2, 2.4 + Math.random() * 1.2, 1.2, 1.4, CONFETTI[i % CONFETTI.length]);
        }
    }

    ring(x, y, z, color = 0xffd24a, size = 1.4, dur = 0.5) {
        const r = this.rings.find((q) => q.t >= 1) || this.rings[0];
        r.t = 0; r.dur = dur; r.size = size; r.y = y;
        r.m.position.set(x, y, z);
        r.m.material.color.set(color);
        r.m.visible = true;
    }

    update(dt, time) {
        const p = this.p;
        let l = 0, s = 0;
        for (let r = 0; r < this.n; r++) {
            if (p.life[r] <= 0) continue;
            p.life[r] -= dt;
            if (p.life[r] <= 0) continue;
            p.vy[r] -= p.grav[r] * dt;
            p.vx[r] *= 1 - dt * 0.8; p.vz[r] *= 1 - dt * 0.8;
            p.x[r] += p.vx[r] * dt; p.y[r] += p.vy[r] * dt; p.z[r] += p.vz[r] * dt;
            if (p.y[r] < 0.12 && p.kind[r] === 0) { p.y[r] = 0.12; p.vy[r] = 0; p.vx[r] *= 0.5; p.vz[r] *= 0.5; }
            const f = Math.min(1, p.life[r] / (p.max[r] * 0.35));
            const sc = p.size[r] * f;
            dummy.position.set(p.x[r], p.y[r], p.z[r]);
            if (p.kind[r] === 0) {
                p.rx[r] += p.vr[r] * dt;
                dummy.rotation.set(p.rx[r], p.ry[r], p.rz[r] + p.rx[r] * 0.3);
                dummy.scale.setScalar(sc);
                dummy.updateMatrix();
                this.leaves.setMatrixAt(l, dummy.matrix);
                this.leaves.setColorAt(l, col.set(p.color[r]));
                l++;
            } else {
                dummy.rotation.set(p.rx[r] + time * 3, p.ry[r] + time * 2, 0);
                dummy.scale.setScalar(sc * (0.6 + 0.4 * Math.sin(time * 30 + r)));
                dummy.updateMatrix();
                this.sparks.setMatrixAt(s, dummy.matrix);
                s++;
            }
        }
        this.leaves.count = l; this.sparks.count = s;
        this.leaves.instanceMatrix.needsUpdate = true;
        if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
        this.sparks.instanceMatrix.needsUpdate = true;
        // compact the pool when everything has expired, so new particles start at the front again
        if (l + s === 0) { this.n = 0; this.next = 0; }

        for (const r of this.rings) {
            if (r.t >= 1) { r.m.visible = false; continue; }
            r.t += dt / r.dur;
            const e = 1 - Math.pow(1 - Math.min(1, r.t), 3);
            r.m.scale.setScalar(0.4 + e * r.size);
            r.m.material.opacity = (1 - Math.min(1, r.t)) * 0.9;
        }

        this.air.visible = !this.calm;
        if (!this.calm) {
            this.airSeed.forEach((a, i) => {
                const fall = ((time * a.s + a.ph) % 1);
                dummy.position.set(a.x + Math.sin(time * a.sp + a.ph) * 1.2, 7 - fall * 8, a.z + Math.cos(time * a.sp * 0.7 + a.ph) * 0.8);
                dummy.rotation.set(time * a.sp + a.ph, time * 0.6 * a.sp, Math.sin(time * a.sp + i) * 0.8);
                dummy.scale.setScalar(0.9 + a.s);
                dummy.updateMatrix();
                this.air.setMatrixAt(i, dummy.matrix);
            });
            this.air.instanceMatrix.needsUpdate = true;
        }
    }
}
