/**
 * fx.js — pooled particles, flying mana orbs, shock rings and beams. One Fx instance per
 * scene (battle, town). Everything is additive and toneMapped:false so it blooms.
 */

import * as THREE from 'three';

let dotTex = null, starTex = null;
function makeTex(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (kind === 'star') {
        g.translate(32, 32);
        g.fillStyle = '#fff';
        g.beginPath();
        for (let i = 0; i < 8; i++) {
            const r = i % 2 ? 9 : 30, a = (i / 8) * Math.PI * 2;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        const rg = g.createRadialGradient(0, 0, 0, 0, 0, 18);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(-32, -32, 64, 64);
    } else {
        const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, 'rgba(255,255,255,1)');
        rg.addColorStop(0.35, 'rgba(255,255,255,0.75)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Fx {
    constructor(scene, size = 400) {
        if (!dotTex) { dotTex = makeTex('dot'); starTex = makeTex('star'); }
        this.scene = scene;
        this.parts = [];
        this.free = [];
        this.rings = [];
        this.beams = [];
        this.group = new THREE.Group();
        this.group.renderOrder = 10;
        scene.add(this.group);
        for (let i = 0; i < size; i++) {
            const m = new THREE.SpriteMaterial({ map: dotTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
            const s = new THREE.Sprite(m);
            s.visible = false;
            this.group.add(s);
            this.free.push({ s, m });
        }
        this.ringGeo = new THREE.RingGeometry(0.8, 1, 48);
        this.beamGeo = new THREE.PlaneGeometry(1, 1);
    }

    _spawn() {
        const p = this.free.pop() || this.parts.shift();
        if (!p) return null;
        p.s.visible = true;
        this.parts.push(p);
        return p;
    }

    /** Burst of particles at a point. */
    burst(pos, color, n = 12, o = {}) {
        const speed = o.speed ?? 6, size = o.size ?? 0.35, life = o.life ?? 0.6, grav = o.gravity ?? -6;
        for (let i = 0; i < n; i++) {
            const p = this._spawn();
            if (!p) return;
            const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
            const up = o.up ?? 0;
            p.s.position.copy(pos);
            p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp + up; p.vz = (Math.random() - 0.3) * sp * (o.flat ? 0.1 : 0.6);
            p.life = p.max = life * (0.6 + Math.random() * 0.6);
            p.size = size * (0.6 + Math.random() * 0.8);
            p.grav = grav;
            p.drag = o.drag ?? 2.2;
            p.m.map = o.star || Math.random() < 0.25 ? starTex : dotTex;
            p.m.color.set(color);
            if (o.hueJitter) p.m.color.offsetHSL((Math.random() - 0.5) * o.hueJitter, 0, 0);
            p.m.rotation = Math.random() * 6;
            p.target = null;
        }
    }

    /** Orbs that fly from `from` to `to` (mana collection, coins to the purse). */
    orbs(from, to, color, n = 4, o = {}) {
        for (let i = 0; i < n; i++) {
            const p = this._spawn();
            if (!p) return;
            p.s.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.5));
            p.start = p.s.position.clone();
            p.target = to.clone();
            p.ctrl = p.start.clone().lerp(p.target, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.2) * 5, 1));
            p.life = p.max = (o.time ?? 0.55) + i * 0.04 + Math.random() * 0.1;
            p.size = o.size ?? 0.42;
            p.m.map = starTex;
            p.m.color.set(color);
            p.onArrive = i === n - 1 ? o.onArrive : null;
        }
    }

    ring(pos, color, radius = 3, o = {}) {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(this.ringGeo, m);
        mesh.position.copy(pos);
        if (o.flat) mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 11;
        this.group.add(mesh);
        this.rings.push({ mesh, t: 0, dur: o.dur ?? 0.45, r: radius });
    }

    beam(pos, angle, length, width, color, dur = 0.35) {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
        const mesh = new THREE.Mesh(this.beamGeo, m);
        mesh.position.copy(pos);
        mesh.rotation.z = angle;
        mesh.scale.set(length, width, 1);
        mesh.renderOrder = 11;
        this.group.add(mesh);
        this.beams.push({ mesh, t: 0, dur, w: width });
    }

    update(dt) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life -= dt;
            if (p.life <= 0) {
                if (p.onArrive) { const f = p.onArrive; p.onArrive = null; f(); }
                p.s.visible = false;
                this.parts.splice(i, 1);
                this.free.push(p);
                continue;
            }
            const k = 1 - p.life / p.max;
            if (p.target) {
                const u = k * k * (3 - 2 * k);
                const a = p.start, b = p.ctrl, c = p.target;
                p.s.position.set(
                    (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * b.x + u * u * c.x,
                    (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * b.y + u * u * c.y,
                    (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * b.z + u * u * c.z);
                const sc = p.size * (0.7 + Math.sin(k * Math.PI) * 0.6);
                p.s.scale.set(sc, sc, 1);
                p.m.opacity = 1;
            } else {
                p.vy += p.grav * dt;
                const d = Math.exp(-p.drag * dt);
                p.vx *= d; p.vy *= d; p.vz *= d;
                p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
                const sc = p.size * (1 - k * 0.7);
                p.s.scale.set(sc, sc, 1);
                p.m.opacity = Math.min(1, (1 - k) * 1.6);
            }
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.t += dt;
            const k = r.t / r.dur;
            if (k >= 1) { this.group.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); continue; }
            const s = r.r * (0.15 + 0.85 * (1 - (1 - k) * (1 - k)));
            r.mesh.scale.set(s, s, s);
            r.mesh.material.opacity = 1 - k;
        }
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const b = this.beams[i];
            b.t += dt;
            const k = b.t / b.dur;
            if (k >= 1) { this.group.remove(b.mesh); b.mesh.material.dispose(); this.beams.splice(i, 1); continue; }
            b.mesh.scale.y = b.w * (1 - k) * (1 + Math.sin(k * 30) * 0.15);
            b.mesh.material.opacity = 1 - k * k;
        }
    }

    clear() {
        for (const p of this.parts) { p.s.visible = false; p.onArrive = null; this.free.push(p); }
        this.parts.length = 0;
        for (const r of this.rings) { this.group.remove(r.mesh); r.mesh.material.dispose(); }
        for (const b of this.beams) { this.group.remove(b.mesh); b.mesh.material.dispose(); }
        this.rings.length = 0; this.beams.length = 0;
    }
}
