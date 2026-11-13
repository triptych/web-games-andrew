// Little cubes: dust, flying bricks, wet concrete, confetti. One InstancedMesh, pooled.

import * as THREE from 'three';

const MAX = 420;

export class Fx {
    constructor(scene) {
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        scene.add(this.mesh);
        this.p = [];
        this.o = new THREE.Object3D();
        this.c = new THREE.Color();
        this.calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }

    /** kind: dust | bits | wet | confetti | puff */
    burst(kind, x, y, z, n = 10, color = null) {
        if (this.calm) n = Math.ceil(n / 3);
        const K = {
            dust: { col: [0xcdbfa6, 0xb8ab94, 0xe0d6c2], up: [0.5, 2.5], out: 2.2, g: -0.6, life: [0.6, 1.3], size: [0.3, 0.8] },
            bits: { col: [0x9b5a45, 0x8a6a55, 0x6f6f72], up: [3, 9], out: 5, g: 16, life: [0.7, 1.4], size: [0.2, 0.55] },
            wet: { col: [0xbcbcb6, 0xa9a9a3], up: [0.5, 2], out: 1.2, g: 9, life: [0.4, 0.8], size: [0.2, 0.4] },
            confetti: { col: [0xff4d6d, 0xffd23f, 0x3ec1d3, 0x7bd957, 0xff8a3c, 0xffffff], up: [6, 13], out: 5, g: 9, life: [1.2, 2.4], size: [0.18, 0.34] },
            puff: { col: [0xffffff, 0xf2f2f2], up: [0.5, 3], out: 3.5, g: -1, life: [0.3, 0.6], size: [0.4, 0.9] },
        }[kind];
        const r = Math.random;
        for (let i = 0; i < n && this.p.length < MAX; i++) {
            const a = r() * Math.PI * 2, sp = r() * K.out, life = K.life[0] + r() * (K.life[1] - K.life[0]);
            this.p.push({
                x, y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: K.up[0] + r() * (K.up[1] - K.up[0]), g: K.g,
                life, t: 0, size: K.size[0] + r() * (K.size[1] - K.size[0]), col: color ?? K.col[(r() * K.col.length) | 0], spin: r() * 6,
            });
        }
    }

    frame(dt) {
        let n = 0;
        for (let i = this.p.length - 1; i >= 0; i--) {
            const q = this.p[i];
            q.t += dt;
            if (q.t >= q.life) { this.p.splice(i, 1); continue; }
            q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            if (q.y < 0.05) { q.y = 0.05; q.vy = Math.abs(q.vy) * 0.3; q.vx *= 0.6; q.vz *= 0.6; }
        }
        for (const q of this.p) {
            const k = 1 - q.t / q.life;
            this.o.position.set(q.x, q.y, q.z); this.o.scale.setScalar(q.size * (0.3 + 0.7 * k)); this.o.rotation.set(q.spin + q.t * 3, q.spin, q.t * 2); this.o.updateMatrix();
            this.mesh.setMatrixAt(n, this.o.matrix); this.mesh.setColorAt(n, this.c.setHex(q.col));
            n++;
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}
