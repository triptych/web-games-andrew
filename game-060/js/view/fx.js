// Explosions: tumbling debris cubes that fly at the glass, sparks, shockwave rings
// and glow flashes. Debris and sparks are drawn through one DebrisBatch; rings and
// flashes are a small pool of additive meshes.

import * as THREE from 'three';
import { DebrisBatch } from './voxels.js';

const MAX_PARTS = 2600;

export class Fx {
    constructor(scene) {
        this.scene = scene;
        this.parts = [];
        this.batch = new DebrisBatch(scene, MAX_PARTS);
        this.rings = [];
        const ringGeo = new THREE.RingGeometry(0.78, 1, 40);
        const discGeo = new THREE.CircleGeometry(1, 28);
        for (let i = 0; i < 28; i++) {
            const m = new THREE.Mesh(i < 18 ? ringGeo : discGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
            m.visible = false; m.renderOrder = 6; m.frustumCulled = false;
            scene.add(m);
            this.rings.push({ mesh: m, disc: i >= 18, t: 0, life: 0, r0: 0, r1: 0, a: 0 });
        }
    }

    clear() {
        this.parts.length = 0;
        for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    }

    add(p) {
        if (this.parts.length >= MAX_PARTS) this.parts.shift();
        this.parts.push(p);
        return p;
    }

    /** One pixel breaking off: flies out from (ox, oy) and toward the camera. */
    debris(x, y, rgb, ox, oy, power = 1, size = 1) {
        const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy) || 1;
        const sp = (30 + Math.random() * 90) * power;
        this.add({
            x, y, z: 1, vx: (dx / d) * sp + (Math.random() - 0.5) * 40 * power, vy: (dy / d) * sp + (20 + Math.random() * 70) * power,
            vz: (80 + Math.random() * 520) * power, rx: 0, ry: 0, rz: 0,
            ax: (Math.random() - 0.5) * 18, ay: (Math.random() - 0.5) * 18, az: (Math.random() - 0.5) * 12,
            s: size, life: 0.9 + Math.random() * 0.9, max: 1.8, r: rgb[0], g: rgb[1], b: rgb[2], grav: 230, spark: false,
        });
    }

    sparks(x, y, rgb, n = 10, speed = 110, life = 0.45) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.9);
            this.add({
                x, y, z: 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.random() * 120, rx: 0, ry: 0, rz: 0, ax: 0, ay: 0, az: 0,
                s: 1, life: life * (0.5 + Math.random()), max: life, r: rgb[0] * 2.2, g: rgb[1] * 2.2, b: rgb[2] * 2.2, grav: 60, spark: true,
            });
        }
    }

    ring(x, y, rgb, r1 = 24, life = 0.35, a = 0.9, disc = false) {
        let best = null;
        for (const r of this.rings) if (r.disc === disc && r.life <= 0) { best = r; break; }
        if (!best) best = this.rings.filter((r) => r.disc === disc).sort((p, q) => (p.life - p.t) - (q.life - q.t))[0];
        best.t = 0; best.life = life; best.r0 = disc ? r1 : 1; best.r1 = disc ? r1 * 0.2 : r1; best.a = a;
        best.mesh.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
        best.mesh.position.set(x, y, 6);
        best.mesh.visible = true;
    }

    flash(x, y, rgb, r = 14, life = 0.18) { this.ring(x, y, rgb, r, life, 1, true); }

    explode(x, y, rgb, size = 1) {
        this.flash(x, y, [rgb[0] * 0.8 + 0.4, rgb[1] * 0.8 + 0.4, rgb[2] * 0.8 + 0.4], 8 + 10 * size, 0.16 + 0.08 * size);
        this.ring(x, y, rgb, 14 + 22 * size, 0.3 + 0.15 * size, 0.85);
        this.sparks(x, y, rgb, Math.round(8 + 14 * size), 90 + 60 * size);
    }

    update(dt) {
        const ps = this.parts;
        let w = 0;
        for (let i = 0; i < ps.length; i++) {
            const p = ps[i];
            p.life -= dt;
            if (p.life <= 0 || p.z > 1400 || p.y < -60) continue;
            p.vy -= p.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            p.rx += p.ax * dt; p.ry += p.ay * dt; p.rz += p.az * dt;
            if (p.spark) { p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt; }
            ps[w++] = p;
        }
        ps.length = w;
        for (const r of this.rings) {
            if (r.life <= 0) continue;
            r.t += dt;
            const k = r.t / r.life;
            if (k >= 1) { r.life = 0; r.mesh.visible = false; continue; }
            const e = 1 - Math.pow(1 - k, 2.2);
            const rad = r.r0 + (r.r1 - r.r0) * e;
            r.mesh.scale.set(rad, rad, 1);
            r.mesh.material.opacity = r.a * (1 - k);
        }
    }

    render() {
        const b = this.batch;
        b.begin();
        for (const p of this.parts) {
            const fade = Math.min(1, p.life / (p.max * 0.35));
            const s = p.s * (p.spark ? 1 : (0.4 + 0.6 * fade));
            b.cube(p.x, p.y, p.z, s, p.rx, p.ry, p.rz, p.r * (0.5 + 0.5 * fade), p.g * (0.5 + 0.5 * fade), p.b * (0.5 + 0.5 * fade));
        }
        b.end();
    }
}
