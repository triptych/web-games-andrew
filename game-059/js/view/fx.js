/**
 * fx.js — particles and screen-space juice: hit sparks, dust, debris,
 * explosions, shockwave rings, electric arcs, afterimage trails, rain with
 * splashes, and floating warning glyphs. All sprites come from the object
 * atlas and are pooled.
 */

import * as THREE from 'three';
import { YS, ZS } from './scene.js';

const SPARK = { light: 'sparkL', heavy: 'sparkH', knock: 'sparkH', launch: 'sparkH', slash: 'sparkS', elec: 'sparkE', fire: 'boom', grab: 'sparkL' };
const NF = { sparkL: 4, sparkH: 5, sparkS: 4, sparkE: 4, sparkB: 4, dust: 4, smoke: 4, boom: 6 };

export class FX {
    constructor(scene, actors) {
        this.scene = scene; this.actors = actors;
        this.group = new THREE.Group(); scene.add(this.group);
        this.pool = []; this.live = [];
        for (let i = 0; i < 180; i++) {
            const m = actors.makeObj('sparkL0', { glow: 1, transparent: true });
            m.visible = false; this.group.add(m); this.pool.push(m);
        }
        this.rings = []; this.ghosts = [];
        this.rain = null; this.rainOn = false;
    }

    spawn(base, x, y, z, o = {}) {
        const m = this.pool.pop();
        if (!m) return null;
        m.visible = true;
        const p = { m, base, n: NF[base] || 1, fps: o.fps || 18, t: 0, x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, grav: o.grav || 0, life: o.life || ((NF[base] || 1) / (o.fps || 18)), scale: o.scale || 1, single: o.single, flip: o.flip || 0, rot: o.rot || 0, spin: o.spin || 0, fade: o.fade };
        m.material.uniforms.flip.value = p.flip;
        m.material.uniforms.alpha.value = 1;
        m.material.uniforms.glow.value = o.glow ?? 1;
        m.rotation.z = p.rot;
        this.live.push(p);
        this.place(p);
        return p;
    }

    place(p) {
        const name = p.single ? p.base : p.base + Math.min(p.n - 1, Math.floor(p.t * p.fps));
        if (p.m.userData.name !== name) { this.actors.setObjFrame(p.m, name); p.m.userData.name = name; }
        const f = p.m.userData.f;
        p.m.scale.set(f.w * p.scale, f.h * p.scale, 1);
        p.m.position.set(Math.round(p.x), p.y * YS, -p.z * ZS + 3);
    }

    // ---------------------------------------------------------------- emitters
    hit(e) {
        const base = SPARK[e.kind] || 'sparkL';
        this.spawn(base, e.x, e.y, e.z, { fps: base === 'boom' ? 20 : 22, scale: e.dmg > 14 ? 1.3 : 1, rot: Math.random() * 0.5 });
        if (e.kind === 'heavy' || e.kind === 'knock' || e.kind === 'launch') for (let k = 0; k < 4; k++) this.spawn('star', e.x, e.y, e.z, { single: true, vx: (Math.random() - 0.5) * 220, vy: 60 + Math.random() * 140, grav: 500, life: 0.35 });
        if (e.kind === 'elec') for (let k = 0; k < 2; k++) this.spawn('sparkE', e.x + (Math.random() - 0.5) * 20, e.y + (Math.random() - 0.5) * 20, e.z, { fps: 26 });
    }
    block(e) { this.spawn('sparkB', e.x, e.y, e.z, { fps: 22 }); }
    dust(x, z, big) {
        const n = big ? 5 : 3;
        for (let k = 0; k < n; k++) this.spawn('dust', x + (k - (n - 1) / 2) * 8, 2, z, { fps: 10, vx: (k - (n - 1) / 2) * 30, glow: 0 });
    }
    explode(x, y, z, r) {
        const s = Math.max(0.8, r / 22);
        this.spawn('boom', x, y + 10, z, { fps: 16, scale: s, glow: 1 });
        for (let k = 0; k < 6; k++) this.spawn('deb' + (k % 8), x, y + 10, z, { single: true, vx: (Math.random() - 0.5) * 300, vy: 120 + Math.random() * 220, grav: 700, life: 0.9, spin: (Math.random() - 0.5) * 20, glow: 0 });
        for (let k = 0; k < 3; k++) this.spawn('smoke', x + (Math.random() - 0.5) * r, y + 16, z, { fps: 6, vy: 30, glow: 0 });
    }
    debris(x, z, type) {
        const cols = { crate: [0, 0, 0], can: [7, 1, 7], barrel: [2, 3, 2], vend: [3, 4, 4], cart: [6, 0, 0], jar: [5, 4, 5], terminal: [3, 4, 3], lantern: [6, 2, 0] }[type] || [1, 1, 1];
        for (let k = 0; k < 8; k++) this.spawn('deb' + cols[k % 3], x, 14 + Math.random() * 20, z, { single: true, vx: (Math.random() - 0.5) * 260, vy: 100 + Math.random() * 200, grav: 700, life: 0.8, spin: (Math.random() - 0.5) * 18, glow: 0 });
        this.dust(x, z, true);
    }
    shock(x, z, r, color) {
        const c = { cyan: 0x5ff6ff, red: 0xff2d55, gold: 0xffd23a, od: 0xc89aff, dust: 0xe8dcc8 }[color] || 0xffffff;
        const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 1, -z * ZS);
        this.group.add(m);
        this.rings.push({ m, t: 0, life: 0.45, r });
        if (color === 'dust') this.dust(x, z, true);
    }
    arc(x, y, z, od) {
        this.shock(x, z, 60, od ? 'od' : 'cyan');
        for (let k = 0; k < 8; k++) {
            const a = k / 8 * Math.PI * 2;
            this.spawn('sparkE', x + Math.cos(a) * 34, y + Math.sin(a) * 26, z, { fps: 20 });
        }
    }
    slash(x, z) { this.spawn('sparkS', x, 44, z, { fps: 18, scale: 1.6 }); }
    glint(x, y, z) { this.spawn('glint', x, y, z, { single: true, life: 0.4, scale: 1.2 }); }
    bang(x, y, z) { this.spawn('bang', x, y, z, { single: true, life: 0.35, vy: 40 }); }
    pickup(x, z) { for (let k = 0; k < 5; k++) this.spawn('star', x, 10, z, { single: true, vx: (Math.random() - 0.5) * 80, vy: 80 + Math.random() * 80, grav: 300, life: 0.5 }); }
    splash(x, z) { this.spawn('splash', x, 0, z, { single: true, life: 0.18, glow: 0.3 }); }
    smokeAt(x, y, z) { this.spawn('smoke', x, y, z, { fps: 5, vy: 40, glow: 0 }); }

    /** Afterimage trail for a fighter for `dur` seconds. */
    trail(f, dur, tint) { this.ghosts.push({ f, t: dur, every: 0.035, acc: 0, tint, list: [] }); }

    // ---------------------------------------------------------------- rain
    setRain(on, color = 0x8aa0d8) {
        this.rainOn = on;
        if (!on) { if (this.rain) this.rain.visible = false; return; }
        if (!this.rain) {
            const N = 260;
            const pos = new Float32Array(N * 6);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
            this.rain.frustumCulled = false;
            this.rainDrops = Array.from({ length: N }, () => ({ x: Math.random() * 700 - 350, y: Math.random() * 300, z: Math.random() * 320 - 220 }));
            this.group.add(this.rain);
        }
        this.rain.visible = true;
        this.rain.material.color.set(color);
    }

    update(dt, camX) {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const p = this.live[i];
            p.t += dt;
            if (p.t >= p.life) { p.m.visible = false; this.pool.push(p.m); this.live.splice(i, 1); continue; }
            p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.grav && p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; }
            if (p.spin) p.m.rotation.z += p.spin * dt;
            if (p.single) p.m.material.uniforms.alpha.value = Math.min(1, (p.life - p.t) / (p.life * 0.5));
            this.place(p);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.t += dt;
            const k = r.t / r.life;
            if (k >= 1) { this.group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
            const s = r.r * (0.3 + k * 0.9);
            r.m.scale.set(s, s * 0.55, 1);
            r.m.material.opacity = 0.9 * (1 - k);
        }
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const g = this.ghosts[i];
            g.t -= dt; g.acc += dt;
            if (g.t > 0 && g.acc >= g.every) {
                g.acc = 0;
                const m = this.actors.ghostOf(g.f, g.tint);
                if (m) { this.group.add(m); g.list.push({ m, t: 0.25 }); }
            }
            for (let j = g.list.length - 1; j >= 0; j--) {
                const e = g.list[j];
                e.t -= dt;
                e.m.material.uniforms.alpha.value = Math.max(0, e.t / 0.25) * 0.6;
                if (e.t <= 0) { this.group.remove(e.m); e.m.material.dispose(); g.list.splice(j, 1); }
            }
            if (g.t <= 0 && g.list.length === 0) this.ghosts.splice(i, 1);
        }
        if (this.rainOn && this.rain) {
            const pos = this.rain.geometry.attributes.position.array;
            const drops = this.rainDrops;
            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];
                d.y -= dt * 520; d.x -= dt * 60;
                if (d.y < 0) {
                    if (d.z > -150 && d.z < 60 && Math.random() < 0.25) this.splash(camX + d.x, -d.z / ZS);
                    d.y = 260 + Math.random() * 60; d.x = Math.random() * 700 - 350; d.z = Math.random() * 320 - 220;
                }
                const X = camX + d.x;
                pos[i * 6] = X; pos[i * 6 + 1] = d.y; pos[i * 6 + 2] = d.z;
                pos[i * 6 + 3] = X + 2; pos[i * 6 + 4] = d.y + 10; pos[i * 6 + 5] = d.z;
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
        }
    }

    clear() {
        for (const p of this.live) { p.m.visible = false; this.pool.push(p.m); }
        this.live = [];
        for (const r of this.rings) this.group.remove(r.m);
        this.rings = [];
        for (const g of this.ghosts) for (const e of g.list) this.group.remove(e.m);
        this.ghosts = [];
    }
}
