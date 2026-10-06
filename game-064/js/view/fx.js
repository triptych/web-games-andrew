// fx.js — pooled sprite particles: splashes, cannon smoke, wakes, bubbles,
// sparkles, music notes, mist and rain.

import * as THREE from 'three';
import { TEX, NO_OUTLINE, toon } from './toon.js';
import { tween, ease } from './anim.js';

const POOL = 320;

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.free = [];
        this.live = [];
        for (let i = 0; i < POOL; i++) {
            const m = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
            m.userData.outlineParameters = NO_OUTLINE;
            const s = new THREE.Sprite(m);
            s.visible = false;
            s.renderOrder = 10;
            scene.add(s);
            this.free.push({ s, vel: new THREE.Vector3() });
        }
        // Rain: one LineSegments object, recycled drops.
        const n = 900;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3));
        this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.6 }));
        this.rain.material.userData.outlineParameters = NO_OUTLINE;
        this.rain.frustumCulled = false;
        this.rain.visible = false;
        this.rainWind = new THREE.Vector3();
        this.rainDrops = Array.from({ length: n }, () => new THREE.Vector3(Math.random() * 16 - 8, Math.random() * 9, Math.random() * 16 - 8));
        scene.add(this.rain);
        this.ballGeo = new THREE.SphereGeometry(0.05, 10, 8);
    }

    spawn(kind, pos, o = {}) {
        const p = this.free.pop();
        if (!p) return null;
        const s = p.s;
        s.material.map = TEX.sprite(kind);
        s.material.color.set(o.color ?? 0xffffff);
        s.material.opacity = o.opacity ?? 1;
        s.material.rotation = o.rot ?? Math.random() * Math.PI * 2;
        s.material.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        s.material.needsUpdate = true;
        s.position.copy(pos);
        s.visible = true;
        p.vel.copy(o.vel || new THREE.Vector3());
        p.life = 0;
        p.max = o.life ?? 0.8;
        p.size0 = o.size ?? 0.2;
        p.size1 = o.grow ?? p.size0;
        p.grav = o.gravity ?? 0;
        p.drag = o.drag ?? 0;
        p.spin = o.spin ?? 0;
        p.fade = o.fade ?? 0.6;
        p.op = o.opacity ?? 1;
        p.floor = o.floor ?? -Infinity;
        p.stretch = o.stretch ?? 1;
        s.scale.set(p.size0 * p.stretch, p.size0, 1);
        this.live.push(p);
        return p;
    }

    update(dt) {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const p = this.live[i];
            p.life += dt;
            const k = p.life / p.max;
            if (k >= 1 || p.s.position.y < p.floor) {
                p.s.visible = false;
                this.live.splice(i, 1);
                this.free.push(p);
                continue;
            }
            p.vel.y -= p.grav * dt;
            if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
            p.s.position.addScaledVector(p.vel, dt);
            const size = p.size0 + (p.size1 - p.size0) * k;
            p.s.scale.set(size * p.stretch, size, 1);
            p.s.material.rotation += p.spin * dt;
            p.s.material.opacity = p.op * (k < p.fade ? 1 : 1 - (k - p.fade) / (1 - p.fade));
        }
        if (this.rain.visible) {
            const a = this.rain.geometry.attributes.position.array;
            const w = this.rainWind;
            for (let i = 0; i < this.rainDrops.length; i++) {
                const d = this.rainDrops[i];
                d.y -= dt * 11;
                d.x += w.x * dt; d.z += w.z * dt;
                if (d.y < 0) { d.y = 8 + Math.random() * 2; d.x = Math.random() * 16 - 8 - w.x * 0.4; d.z = Math.random() * 16 - 8 - w.z * 0.4; }
                a.set([d.x, d.y, d.z, d.x - w.x * 0.03, d.y + 0.35, d.z - w.z * 0.03], i * 6);
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
        }
    }

    // ------------------------------------------------------------- recipes
    splash(pos, scale = 1) {
        const n = Math.round(16 * scale);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 1.4) * scale;
            this.spawn('drop', new THREE.Vector3(pos.x, 0.05, pos.z), {
                vel: new THREE.Vector3(Math.cos(a) * sp, 1.6 + Math.random() * 2.2 * scale, Math.sin(a) * sp),
                gravity: 9, life: 0.9, size: 0.09 + Math.random() * 0.07, floor: -0.05,
            });
        }
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            this.spawn('foam', new THREE.Vector3(pos.x + Math.cos(a) * 0.15, 0.04, pos.z + Math.sin(a) * 0.15), {
                vel: new THREE.Vector3(Math.cos(a) * 0.6 * scale, 0, Math.sin(a) * 0.6 * scale), life: 0.9, size: 0.25, grow: 0.6 * scale, drag: 2, opacity: 0.85,
            });
        }
    }

    wake(pos, yaw) {
        const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const side = new THREE.Vector3(back.z, 0, -back.x);
        for (const s of [1, -1]) {
            this.spawn('foam', pos.clone().addScaledVector(back, 0.3).setY(0.03), {
                vel: side.clone().multiplyScalar(0.35 * s).addScaledVector(back, 0.2), life: 0.9, size: 0.12, grow: 0.32, drag: 1.5, opacity: 0.8,
            });
        }
    }

    smoke(pos, n = 8, dir = new THREE.Vector3()) {
        for (let i = 0; i < n; i++) {
            this.spawn('smoke', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.05, (Math.random() - 0.5) * 0.1)), {
                vel: dir.clone().multiplyScalar(0.6 + Math.random() * 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3)),
                life: 1.1 + Math.random() * 0.5, size: 0.12, grow: 0.42, drag: 1.2, spin: (Math.random() - 0.5) * 2, fade: 0.4,
            });
        }
    }

    flash(pos, size = 0.6) {
        this.spawn('flash', pos, { life: 0.22, size: size * 0.4, grow: size, additive: true, fade: 0.2 });
    }

    /** Muzzle flash and smoke at `from`, a cannonball arcing to `to`. */
    cannon(from, to) {
        const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
        this.flash(from, 0.5);
        this.smoke(from, 9, dir);
        const ball = new THREE.Mesh(this.ballGeo, toon(0x2a2630));
        this.scene.add(ball);
        const a = from.clone(), b = new THREE.Vector3(to.x, 0.12, to.z);
        const h = 0.35 + a.distanceTo(b) * 0.12;
        tween(0.32, (k) => {
            ball.position.lerpVectors(a, b, k);
            ball.position.y += Math.sin(Math.PI * k) * h;
        }, ease.linear).then(() => this.scene.remove(ball));
    }

    bubbles(pos, n = 12, dur = 1.2) {
        for (let i = 0; i < n; i++) {
            setTimeout(() => {
                this.spawn('bubble', new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.5, 0.02, pos.z + (Math.random() - 0.5) * 0.5), {
                    vel: new THREE.Vector3(0, 0.25 + Math.random() * 0.35, 0), life: 0.7 + Math.random() * 0.4, size: 0.05 + Math.random() * 0.08, grow: 0.12,
                });
            }, (i / n) * dur * 1000);
        }
    }

    sparkle(pos, n = 18) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.2;
            this.spawn('spark', pos.clone().add(new THREE.Vector3(0, 0.3 + Math.random() * 0.4, 0)), {
                vel: new THREE.Vector3(Math.cos(a) * sp, 0.6 + Math.random() * 1.2, Math.sin(a) * sp),
                gravity: 1.2, life: 1.0 + Math.random() * 0.5, size: 0.14, grow: 0.02, spin: 4, drag: 1,
            });
        }
    }

    notes(pos, n = 1) {
        for (let i = 0; i < n; i++) {
            this.spawn('note', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), {
                vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.55, (Math.random() - 0.5) * 0.3), life: 1.6, size: 0.22, grow: 0.3, spin: (Math.random() - 0.5) * 1.5, fade: 0.5, rot: 0,
            });
        }
    }

    mist(pos, n = 3) {
        for (let i = 0; i < n; i++) {
            this.spawn('mist', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6)), {
                vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.15, (Math.random() - 0.5) * 0.2), life: 1.4, size: 0.4, grow: 1.0, opacity: 0.55, fade: 0.3,
            });
        }
    }

    streak(pos, dir) {
        const s = this.spawn('streak', pos, { vel: dir.clone().multiplyScalar(7), life: 0.7, size: 0.14, stretch: 6, opacity: 0.8, rot: Math.atan2(-dir.z, dir.x) });
        return s;
    }

    setRain(on, wind = new THREE.Vector3()) {
        this.rain.visible = on;
        this.rainWind.copy(wind);
    }
}
