// Animation plumbing for the view: a timeline that async code can await (driven by frame dt, so
// `&fast=N` and slow SwiftShader frames both behave), particle bursts, and floating numbers.

import * as THREE from 'three';

export const ease = {
    lin: (k) => k,
    out: (k) => 1 - Math.pow(1 - k, 3),
    inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
};

export class Timeline {
    constructor() { this.t = 0; this.items = []; }

    update(dt) {
        this.t += dt;
        for (const it of this.items.slice()) {
            const k = it.dur > 0 ? Math.min(1, (this.t - it.start) / it.dur) : 1;
            if (it.fn) it.fn(it.ease(k));
            if (k >= 1) { this.items.splice(this.items.indexOf(it), 1); it.done(); }
        }
    }

    /** Wait `sec` of animation time. */
    sleep(sec) { return this.tween(sec, null); }

    /** Call fn(eased 0→1) every frame for `dur` seconds. Resolves after the last call, which is always at 1. */
    tween(dur, fn, e = ease.out) {
        return new Promise((done) => this.items.push({ start: this.t, dur, fn, ease: e, done }));
    }

    get busy() { return this.items.length > 0; }

    /** Finish everything now: every tween gets its final value. For tests and "skip". */
    finishAll() {
        for (const it of this.items.splice(0)) { it.fn?.(1); it.done(); }
    }
}

/** Short-lived sparks. Each burst is one Points object, removed when it fades. */
export class Bursts {
    constructor(scene) { this.scene = scene; this.list = []; this.calm = false; }

    burst(pos, color, { n = 28, speed = 2.2, life = 0.8, gravity = -2, size = 0.12, up = 0.6 } = {}) {
        if (this.calm) n = Math.ceil(n / 3);
        const g = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3), v = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
            const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.3, s = speed * (0.4 + Math.random() * 0.8);
            v[i * 3] = Math.cos(a) * s; v[i * 3 + 1] = (Math.sin(e) + up) * s; v[i * 3 + 2] = Math.sin(a) * s;
        }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
        const pts = new THREE.Points(g, m);
        pts.frustumCulled = false;
        this.scene.add(pts);
        this.list.push({ pts, v, age: 0, life, gravity });
    }

    update(dt) {
        for (const b of this.list.slice()) {
            b.age += dt;
            const pos = b.pts.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                b.v[i * 3 + 1] += b.gravity * dt;
                pos.setXYZ(i, pos.getX(i) + b.v[i * 3] * dt, pos.getY(i) + b.v[i * 3 + 1] * dt, pos.getZ(i) + b.v[i * 3 + 2] * dt);
            }
            pos.needsUpdate = true;
            b.pts.material.opacity = Math.max(0, 1 - b.age / b.life);
            if (b.age >= b.life) this.remove(b);
        }
    }

    remove(b) {
        this.scene.remove(b.pts);
        b.pts.geometry.dispose(); b.pts.material.dispose();
        this.list.splice(this.list.indexOf(b), 1);
    }

    clear() { for (const b of this.list.slice()) this.remove(b); }
}

/** Numbers that float up from a point on screen: damage, heals, MISS. Styled in style.css. */
export class Floats {
    constructor(el) { this.el = el; }
    add(text, px, py, cls = '') {
        const d = document.createElement('div');
        d.className = 'float ' + cls;
        d.textContent = text;
        d.style.left = px + 'px';
        d.style.top = py + 'px';
        this.el.appendChild(d);
        setTimeout(() => d.remove(), 1300);
    }
    clear() { this.el.textContent = ''; }
}
