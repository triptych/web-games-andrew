// Particles and spell effects. Two pools of points (glowing and soft), bolts in flight, and the
// visuals for every seal on the ground. Nothing here touches the sim.

import * as THREE from 'three';
import { glow, sigilRing } from './tex.js';
import { jitterGeo } from './nature.js';

const PVS = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vA; varying vec3 vC;
uniform float uScale;
void main() {
    vA = aAlpha; vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
}`;
const PFS = `
uniform sampler2D uMap; varying float vA; varying vec3 vC;
void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.004) discard; }`;

class Pool {
    constructor(n, additive) {
        this.n = n; this.i = 0;
        this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
        this.size = new Float32Array(n); this.alpha = new Float32Array(n);
        this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
        this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.grow = new Float32Array(n); this.a0 = new Float32Array(n);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uMap: { value: glow() }, uScale: { value: 300 } }, vertexShader: PVS, fragmentShader: PFS,
            transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        this.geo = g;
    }
    spawn(x, y, z, vx, vy, vz, c, size, life, { grav = 0, drag = 0, grow = 0, alpha = 1 } = {}) {
        const i = this.i; this.i = (this.i + 1) % this.n;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
        this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow; this.a0[i] = alpha;
    }
    update(dt) {
        for (let i = 0; i < this.n; i++) {
            if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
            this.life[i] -= dt;
            const k = 1 - this.drag[i] * dt;
            this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            this.size[i] += this.grow[i] * dt;
            const f = this.life[i] / this.max[i];
            this.alpha[i] = this.a0[i] * Math.min(1, f * 3) * Math.min(1, (1 - f) * 8 + 0.2);
        }
        for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[a].needsUpdate = true;
    }
}

const col = new THREE.Color();
const rnd = () => Math.random() - 0.5;    // the view may use Math.random: it only decorates

export class FX {
    constructor(scene, quality) {
        this.scene = scene;
        const n = quality === 'low' ? 2500 : 6000;
        this.add = new Pool(n, true);
        this.soft = new Pool(Math.floor(n * 0.6), false);
        scene.add(this.add.points, this.soft.points);
        this.bolts = [];
        this.seals = new Map();
        this.lights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return { l, busy: null }; });
        this.flashes = [];
        this.boltGeo = new THREE.SphereGeometry(0.16, 10, 8);
    }
    setScale(h, fov) { const k = h / (2 * Math.tan((fov * Math.PI) / 360)); this.add.mat.uniforms.uScale.value = k * 0.6; this.soft.mat.uniforms.uScale.value = k * 0.6; }

    burst(p, color, { n = 24, speed = 3, life = 0.9, size = 0.35, grav = 0, up = 0, soft = false, drag = 1.5, spread = 1 } = {}) {
        col.set(color);
        const pool = soft ? this.soft : this.add;
        for (let i = 0; i < n; i++) {
            const v = new THREE.Vector3(rnd(), rnd() * spread + up, rnd()).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
            pool.spawn(p.x, p.y, p.z, v.x, v.y + up, v.z, col, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), { grav, drag });
        }
    }
    puff(p, color, opts = {}) { this.burst(p, color, { soft: true, n: 10, speed: 0.6, life: 2.2, size: 0.9, up: 0.6, drag: 0.4, ...opts }); }

    light(p, color, intensity, dur, range = 10) {
        const slot = this.lights.reduce((a, b) => (a.l.intensity <= b.l.intensity ? a : b));
        slot.l.position.copy(p); slot.l.color.set(color); slot.l.distance = range;
        slot.l.intensity = intensity; slot.decay = intensity / dur; slot.busy = null;
    }

    bolt(from, to, color, power) {
        const m = new THREE.Mesh(this.boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), toneMapped: false }));
        m.position.copy(from);
        m.scale.setScalar(0.8 + power * 0.25);
        this.scene.add(m);
        const dist = from.distanceTo(to);
        this.bolts.push({ m, from: from.clone(), to: to.clone(), t: 0, dur: Math.max(0.12, dist / 34), color, power });
    }

    update(dt, time) {
        for (const b of this.bolts) {
            b.t += dt;
            const k = Math.min(1, b.t / b.dur);
            b.m.position.lerpVectors(b.from, b.to, k);
            col.set(b.color);
            for (let i = 0; i < 3; i++) this.add.spawn(b.m.position.x + rnd() * 0.15, b.m.position.y + rnd() * 0.15, b.m.position.z + rnd() * 0.15, rnd() * 0.6, rnd() * 0.6, rnd() * 0.6, col, 0.4 + b.power * 0.08, 0.45, { drag: 2 });
            if (k >= 1) {
                this.scene.remove(b.m);
                this.burst(b.to, b.color, { n: 30 + b.power * 15, speed: 4 + b.power, size: 0.4 });
                this.light(b.to, b.color, 6, 0.5);
                b.done = true;
            }
        }
        this.bolts = this.bolts.filter((b) => !b.done);
        for (const s of this.lights) if (s.l.intensity > 0) s.l.intensity = Math.max(0, s.l.intensity - (s.decay || 10) * dt);
        this.add.update(dt); this.soft.update(dt);
    }

    // ------------------------------------------------------------------ seals on the ground
    syncSeals(G, colorOf, time, dt) {
        const seen = new Set();
        for (const s of G.seals) {
            seen.add(s.id);
            let v = this.seals.get(s.id);
            if (!v) { v = this.makeSeal(s, colorOf(s.essence)); this.seals.set(s.id, v); }
            this.tickSeal(v, s, time, dt);
        }
        for (const [id, v] of this.seals) if (!seen.has(id)) { this.scene.remove(v.g); if (v.light) v.light.intensity = 0; this.seals.delete(id); }
    }
    makeSeal(s, color) {
        const g = new THREE.Group(); g.position.set(s.x, s.y + 0.04, s.z);
        const c = new THREE.Color(color);
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: sigilRing(), color: c.clone().multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2;
        g.add(ring);
        const v = { g, ring, c, kind: s.kind, born: 0 };
        if (s.kind === 'floe') {
            const ice = new THREE.Mesh(jitterGeo(new THREE.CylinderGeometry(s.r, s.r * 0.9, 0.3, 14, 1), 0.15, 3), new THREE.MeshStandardMaterial({ color: 0xd8f0ff, roughness: 0.2, emissive: c, emissiveIntensity: 0.15, transparent: true, opacity: 0.92 }));
            ice.position.y = -0.1; g.add(ice); v.ice = ice;
            ring.position.y = 0.12;
        }
        if (s.kind === 'icicle') {
            for (let i = 0; i < 5; i++) { const cr = new THREE.Mesh(new THREE.ConeGeometry(0.25 + i * 0.03, 1.4 + (i % 3) * 0.7, 5), new THREE.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.15, emissive: c, emissiveIntensity: 0.25 })); cr.position.set(Math.cos(i * 1.3) * 0.4, 0.6, Math.sin(i * 1.3) * 0.4); cr.rotation.set(rnd() * 0.4, 0, rnd() * 0.4); g.add(cr); }
        }
        if (s.kind === 'growth') {
            v.sprouts = [];
            for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x5aa04a })); sp.position.set(Math.cos(i * 2.4) * (0.3 + i * 0.1), 0, Math.sin(i * 2.4) * (0.3 + i * 0.1)); sp.scale.setScalar(0.01); g.add(sp); v.sprouts.push(sp); }
        }
        if (s.kind === 'beacon') {
            const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 9, 12, 1, true), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.4), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
            pil.position.y = 4.5; g.add(pil); v.pil = pil;
        }
        if (s.kind === 'fire' || s.kind === 'beacon') {
            v.light = new THREE.PointLight(s.kind === 'fire' ? 0xff9a4a : c, s.kind === 'fire' ? 3 : 4, s.kind === 'fire' ? 11 : 16, 1.5);
            v.light.position.y = 1.0; g.add(v.light);
            if (s.kind === 'fire') {
                for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); l.rotation.set(Math.PI / 2, i * 0.5, 0.3); l.position.y = 0.1; g.add(l); }
            }
        }
        this.scene.add(g);
        this.burst(new THREE.Vector3(s.x, s.y + 0.3, s.z), color, { n: 40, speed: 3, size: 0.4, up: 0.8 });
        return v;
    }
    tickSeal(v, s, time, dt) {
        v.born += dt;
        const fade = Math.min(1, s.t / 3) * Math.min(1, v.born * 3);
        v.ring.material.opacity = 0.9 * fade;
        v.ring.rotation.z = time * 0.4;
        const p = v.g.position;
        const c = v.c;
        if (s.kind === 'fire') {
            col.setHSL(0.07 + Math.random() * 0.05, 1, 0.55);
            for (let i = 0; i < 3; i++) this.add.spawn(p.x + rnd() * 0.5, p.y + 0.2, p.z + rnd() * 0.5, rnd() * 0.3, 1.6 + Math.random(), rnd() * 0.3, col, 0.55, 0.7, { drag: 0.5, grow: -0.4 });
            this.add.spawn(p.x + rnd() * 0.3, p.y + 0.3, p.z + rnd() * 0.3, rnd() * 0.4, 1.2, rnd() * 0.4, c, 0.4, 0.8, { drag: 0.5 });
            if (Math.random() < 0.25) this.soft.spawn(p.x, p.y + 1.6, p.z, rnd() * 0.3, 0.9, rnd() * 0.3, col.set(0x605858), 0.8, 2.5, { grow: 0.6, drag: 0.2, alpha: 0.35 });
            v.light.intensity = (2.6 + Math.sin(time * 17) * 0.4 + Math.sin(time * 7.3) * 0.3) * fade;
        } else if (s.kind === 'updraft') {
            for (let i = 0; i < 4; i++) { const a = time * 4 + i * 1.57, h = Math.random() * 3; this.add.spawn(p.x + Math.cos(a) * 1.3, p.y + h, p.z + Math.sin(a) * 1.3, -Math.sin(a) * 2, 7 + Math.random() * 3, Math.cos(a) * 2, c, 0.3, 1.6, { drag: 0.2 }); }
            if (Math.random() < 0.3) this.soft.spawn(p.x + rnd(), p.y, p.z + rnd(), 0, 5, 0, col.set(0xdde8f0), 0.6, 2.4, { grow: 0.5, alpha: 0.25 });
        } else if (s.kind === 'beacon') {
            v.light.intensity = 4 * fade;
            v.pil.material.opacity = 0.22 * fade + Math.sin(time * 3) * 0.04;
            if (Math.random() < 0.5) this.add.spawn(p.x + rnd() * 2, p.y + Math.random() * 4, p.z + rnd() * 2, 0, 0.5, 0, c, 0.25, 2, {});
        } else if (s.kind === 'stillness') {
            if (Math.random() < 0.5) { const a = Math.random() * 6.28, r = Math.random() * s.r; this.add.spawn(p.x + Math.cos(a) * r, p.y + 0.3 + Math.random() * 2.5, p.z + Math.sin(a) * r, 0, 0, 0, c, 0.18, 3.0, {}); }
            v.ring.scale.setScalar(1 + Math.sin(time * 0.7) * 0.05 + 1.0);
        } else if (s.kind === 'growth') {
            v.sprouts.forEach((sp, i) => { const k = Math.min(1, Math.max(0.01, v.born * 1.5 - i * 0.1)); sp.scale.set(k, k * (1.2 + (i % 3) * 0.4), k); sp.position.y = 0.4 * k; });
        } else if (s.kind === 'floe') {
            v.ice.material.opacity = 0.92 * Math.min(1, s.t / 4);
            if (Math.random() < 0.15) this.add.spawn(p.x + rnd() * s.r, p.y + 0.2, p.z + rnd() * s.r, 0, 0.3, 0, c, 0.2, 1.5, {});
        } else if (s.kind === 'rend') {
            for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; this.add.spawn(p.x, p.y + 1, p.z, Math.cos(a) * 4, rnd() * 3, Math.sin(a) * 4, col.set(Math.random() < 0.5 ? 0xffffff : 0x9a6aff), 0.3, 0.6, { drag: 2 }); }
        } else if (s.kind === 'icicle') {
            if (Math.random() < 0.1) this.soft.spawn(p.x + rnd(), p.y + 0.3, p.z + rnd(), 0, 0.2, 0, col.set(0xe8f6ff), 0.6, 2, { alpha: 0.3, grow: 0.3 });
        }
    }
}
