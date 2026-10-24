// Small effects: drifting dust motes, sparkle bursts when something is found, and the glints
// that point at a hotspot. Particles are plain sprites, recycled from a pool, so nothing is
// allocated while the game runs.

import * as THREE from 'three';
import { starTex, glowTex } from './kit.js';

export class Sparkles {
    constructor(scene, n = 80) {
        this.items = [];
        for (let i = 0; i < n; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
            s.visible = false;
            scene.add(s);
            this.items.push({ s, life: 0, max: 1, v: new THREE.Vector3(), size: 0.3 });
        }
    }
    burst(pos, { n = 14, color = 0xffe9a0, speed = 2.2, size = 0.32, life = 1.0, up = 1.2 } = {}) {
        let made = 0;
        for (const it of this.items) {
            if (it.life > 0) continue;
            it.life = it.max = life * (0.6 + Math.random() * 0.6);
            it.s.position.copy(pos);
            it.v.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.8 + up, (Math.random() - 0.5) * speed * 0.6);
            it.size = size * (0.6 + Math.random() * 0.7);
            it.s.material.color.setHex(color);
            it.s.visible = true;
            if (++made >= n) break;
        }
    }
    update(dt) {
        for (const it of this.items) {
            if (it.life <= 0) continue;
            it.life -= dt;
            if (it.life <= 0) { it.s.visible = false; continue; }
            const k = it.life / it.max;
            it.v.y -= dt * 1.4;
            it.s.position.addScaledVector(it.v, dt);
            it.s.material.opacity = Math.min(1, k * 2);
            it.s.scale.setScalar(it.size * (0.5 + k));
            it.s.material.rotation += dt * 2;
        }
    }
}

/** Slow motes of dust in the lamplight, wrapped inside the room's box. */
export class Dust {
    constructor(scene, n = 70) {
        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(n * 3);
        this.seed = [];
        for (let i = 0; i < n; i++) {
            this.pos[i * 3] = (Math.random() - 0.5) * 11; this.pos[i * 3 + 1] = Math.random() * 5.5; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 7;
            this.seed.push(Math.random() * 6.28);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.points = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex('#ffe9b8'), size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.n = n;
    }
    update(t, dt, calm) {
        const sp = calm ? 0.4 : 1;
        for (let i = 0; i < this.n; i++) {
            const s = this.seed[i];
            this.pos[i * 3] += Math.sin(t * 0.3 + s) * dt * 0.15 * sp;
            this.pos[i * 3 + 1] += (Math.sin(t * 0.5 + s * 2) * 0.1 + 0.03) * dt * sp;
            if (this.pos[i * 3 + 1] > 5.8) this.pos[i * 3 + 1] = 0.2;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}

/** A pulsing star that points at a hotspot. */
export class Glint {
    constructor(scene) {
        this.s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        this.s.renderOrder = 10;
        scene.add(this.s);
        this.level = 0; this.want = 0; this.size = 0.9;
    }
    show(pos, level = 1) { this.s.position.copy(pos); this.want = level; }
    hide() { this.want = 0; }
    update(t, dt) {
        this.level += (this.want - this.level) * Math.min(1, dt * 6);
        this.s.material.opacity = Math.min(1, this.level) * (0.55 + Math.sin(t * 5) * 0.25);
        const k = this.size * (1 + Math.sin(t * 5) * 0.15);
        this.s.scale.set(k, k, 1);
        this.s.material.rotation = t * 0.8;
        this.s.visible = this.level > 0.02;
    }
}
