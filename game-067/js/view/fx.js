/**
 * fx.js — little particle effects, all in two instanced meshes:
 *   puffs  soft round puffs (engine steam, diesel smoke, bulldozer dust, whistle blasts)
 *   bits   tiny tumbling bricks (the confetti when you place something, stickers, track clicks)
 *
 * Live particles are packed at the front of each instance buffer and `count` is set to the number
 * alive, so dead ones are never drawn (no zero-scale matrices, which would give NaN normals).
 */

import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

class Pool {
    constructor(scene, geo, mat, max) {
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;
        scene.add(this.mesh);
        this.max = max;
        this.list = [];
    }
    add(p) {
        if (this.list.length >= this.max) this.list.shift();
        this.list.push(p);
    }
    update(dt) {
        const out = [];
        for (const p of this.list) {
            p.age += dt;
            if (p.age >= p.life) continue;
            p.vy -= (p.g || 0) * dt;
            const drag = Math.exp(-(p.drag || 0) * dt);
            p.vx *= drag; p.vz *= drag; if (p.drag) p.vy *= drag;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
            p.rx = (p.rx || 0) + (p.sr || 0) * dt;
            out.push(p);
        }
        this.list = out;
        let k = 0;
        for (const p of out) {
            const f = p.age / p.life;
            const size = p.grow ? p.size * (0.4 + Math.min(1, f * 3) * 0.6 + f * p.grow) * (1 - Math.pow(f, 3)) : p.size * (f > 0.8 ? (1 - f) / 0.2 : 1);
            _e.set(p.rx, p.rx * 0.7, 0);
            _q.setFromEuler(_e);
            _p.set(p.x, p.y, p.z);
            _s.setScalar(Math.max(0.001, size));
            this.mesh.setMatrixAt(k, _m.compose(_p, _q, _s));
            _c.setHex(p.color);
            this.mesh.setColorAt(k, _c);
            k++;
        }
        this.mesh.count = k;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}

export class FX {
    constructor(scene) {
        const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, emissive: 0x333333 });
        this.puffs = new Pool(scene, new THREE.IcosahedronGeometry(1, 1), puffMat, 260);
        const bitMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        this.bits = new Pool(scene, new THREE.BoxGeometry(1, 0.6, 1), bitMat, 240);
    }

    /** Engine steam/smoke: one puff rising from a chimney. */
    smoke(x, y, z, kind, speed) {
        const diesel = kind === 'diesel';
        this.puffs.add({
            x, y, z, vx: (Math.random() - 0.5) * 0.15, vy: diesel ? 0.6 : 1.1 + speed * 0.1, vz: (Math.random() - 0.5) * 0.15,
            drag: 0.9, age: 0, life: diesel ? 1.1 : 1.5 + Math.random() * 0.5, size: diesel ? 0.05 : 0.07, grow: diesel ? 1.2 : 1.7,
            color: diesel ? 0x8a8a90 : 0xf7f7f7,
        });
    }

    whistle(x, y, z) {
        for (let i = 0; i < 6; i++) this.puffs.add({ x, y, z, vx: (Math.random() - 0.5) * 0.4, vy: 0.9 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.4, drag: 1.2, age: 0, life: 1.2, size: 0.06, grow: 2.2, color: 0xffffff });
    }

    dust(x, y, z, n = 10) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.4 + Math.random() * 0.8;
            this.puffs.add({ x, y: y + 0.05, z, vx: Math.cos(a) * s, vy: 0.3 + Math.random() * 0.5, vz: Math.sin(a) * s, drag: 3, age: 0, life: 0.8 + Math.random() * 0.4, size: 0.08, grow: 1.5, color: Math.random() < 0.5 ? 0xd8cdb8 : 0xbfb3a0 });
        }
    }

    confetti(x, y, z, n = 14, colors = [0xd8352a, 0xf6c21c, 0x1f6fd1, 0x35a548, 0xf27bb2, 0xffffff]) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.0;
            this.bits.add({ x, y: y + 0.1, z, vx: Math.cos(a) * s, vy: 1.4 + Math.random() * 1.2, vz: Math.sin(a) * s, g: 6, age: 0, life: 1.1 + Math.random() * 0.4, size: 0.05 + Math.random() * 0.025, sr: (Math.random() - 0.5) * 14, color: colors[i % colors.length], floor: y });
        }
    }

    sparkle(x, y, z, color = 0xffe680, n = 6) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            this.bits.add({ x, y, z, vx: Math.cos(a) * 0.5, vy: 0.8 + Math.random() * 0.6, vz: Math.sin(a) * 0.5, g: 2.5, age: 0, life: 0.7, size: 0.035, sr: 10, color });
        }
    }

    update(dt) { this.puffs.update(dt); this.bits.update(dt); }
}
