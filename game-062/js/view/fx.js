// Effects: lit juice droplets (instanced), additive glows (points), juice-splat decals that stay
// on the floor, projectile visuals, slash arcs, telegraph rings, novas, lightning, meteors,
// raisin rain, stink clouds, level-up beams and a pool of short-lived flash lights.

import * as THREE from 'three';
import { splatTex, glowTex, ringTex } from './textures.js';
import { patchFow } from './fow.js';
import { mesh, bodyGeo, bodyMaterial, disposeModel } from './fruitkit.js';

export const JUICE = {
    grape: 0x8a2ab8, fly: 0x6a8a2a, peelton: 0xf6e07a, archer: 0xf6e07a, thief: 0xf6e07a, worm: 0xff8aa8, eggplant: 0x9a3ad8,
    tomato: 0xe8202a, lemon: 0xfff04a, cactus: 0x8ae04a, crab: 0xfaf6e8, pumpkin: 0xff8a1a, chili: 0xff2a10, durian: 0xd8e04a,
    mimic: 0xb0103a, juicer: 0xff8a1a, mango: 0xffa01a, durianlord: 0xc8e03a, hero: 0xff3a5a,
};
const ELEM_COL = { phys: 0xffffff, fire: 0xff7a2a, cold: 0x8ae8ff, light: 0xe8ff6a, pois: 0x8ae04a };

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();

export class Fx {
    constructor(scene) {
        this.scene = scene;
        this.budget = 1;
        this.root = new THREE.Group();
        scene.add(this.root);
        // Droplets.
        this.DN = 700;
        this.drops = [];
        const dm = new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1, color: 0xffffff });
        this.dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), dm, this.DN);
        this.dropMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.DN * 3), 3);
        this.dropMesh.count = 0; this.dropMesh.frustumCulled = false; this.dropMesh.castShadow = false;
        this.root.add(this.dropMesh);
        // Additive glow points.
        this.GN = 1600;
        this.glows = [];
        const gg = new THREE.BufferGeometry();
        this.gPos = new Float32Array(this.GN * 3); this.gCol = new Float32Array(this.GN * 3); this.gSize = new Float32Array(this.GN);
        gg.setAttribute('position', new THREE.BufferAttribute(this.gPos, 3));
        gg.setAttribute('color', new THREE.BufferAttribute(this.gCol, 3));
        gg.setAttribute('size', new THREE.BufferAttribute(this.gSize, 1));
        this.gGeo = gg;
        const gm = new THREE.ShaderMaterial({
            uniforms: { uTex: { value: glowTex() }, uScale: { value: 400 } },
            vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale;
                void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * t.a, t.a); }`,
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        });
        this.gMat = gm;
        this.points = new THREE.Points(gg, gm);
        this.points.frustumCulled = false;
        this.root.add(this.points);
        // Smoke / soft puffs (normal blending).
        this.puffs = [];
        // Decals.
        this.decalN = 320;
        const decMat = patchFow(new THREE.MeshStandardMaterial({ alphaMap: splatTex(), transparent: true, depthWrite: false, roughness: 0.15, metalness: 0, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 }), { key: 'decal' });
        this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), decMat, this.decalN);
        this.decals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.decalN * 3), 3);
        this.decals.count = 0; this.decals.frustumCulled = false; this.decals.receiveShadow = true; this.decals.renderOrder = 2;
        this.root.add(this.decals);
        this.decalIdx = 0; this.decalData = [];
        // Temporary meshes (rings, arcs, bolts, meteors…).
        this.temps = [];
        this.projs = new Map();
        this.flashes = [];   // { x, y, z, color, k, t, dur } consumed by the light pool
    }

    setBudget(k) { this.budget = k; }
    setPointScale(h) { this.gMat.uniforms.uScale.value = h * 0.9; }

    clear() {
        this.drops.length = 0; this.glows.length = 0; this.puffs.forEach((p) => this.root.remove(p.m)); this.puffs.length = 0;
        this.decalIdx = 0; this.decalData.length = 0; this.decals.count = 0;
        for (const t of this.temps) this.killTemp(t);
        this.temps.length = 0;
        for (const p of this.projs.values()) { this.root.remove(p.g); disposeModel(p.g); }
        this.projs.clear();
        this.flashes.length = 0;
    }

    // ------------------------------------------------------------------ primitives
    drop(x, y, z, color, { vx = 0, vy = 0, vz = 0, size = 0.05, life = 1.2, stick = 0.35 } = {}) {
        if (this.drops.length >= this.DN * this.budget) this.drops.shift();
        this.drops.push({ x, y, z, vx, vy, vz, size, life, max: life, color: new THREE.Color(color), stick, landed: false });
    }
    glow(x, y, z, color, { vx = 0, vy = 0, vz = 0, size = 0.4, life = 0.5, grav = 0, drag = 1 } = {}) {
        if (this.glows.length >= this.GN * this.budget) this.glows.shift();
        this.glows.push({ x, y, z, vx, vy, vz, size, life, max: life, r: ((color >> 16) & 255) / 255, g: ((color >> 8) & 255) / 255, b: (color & 255) / 255, grav, drag });
    }
    puff(x, y, z, color, { size = 0.5, life = 1.5, vy = 0.4, opacity = 0.5 } = {}) {
        if (this.puffs.length > 80 * this.budget) return;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false }));
        s.position.set(x, y, z); s.scale.setScalar(size);
        this.root.add(s);
        this.puffs.push({ m: s, life, max: life, vy, size, opacity, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3 });
    }
    decal(x, z, color, size = 1) {
        const i = this.decalIdx++ % this.decalN;
        this.decalData[i] = { x, z, size, rot: Math.random() * Math.PI * 2, t: 0 };
        _c.set(color).multiplyScalar(0.75);
        this.decals.setColorAt(i, _c);
        this.decals.instanceColor.needsUpdate = true;
        this.decals.count = Math.min(this.decalN, Math.max(this.decals.count, i + 1));
    }
    burst(x, y, z, color, n = 12, speed = 3, size = 0.05, opts = {}) {
        n = Math.max(1, Math.round(n * this.budget));
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random() * 0.9, sp = speed * (0.3 + Math.random() * 0.8);
            this.drop(x, y, z, color, { vx: Math.cos(a) * sp, vy: up * speed * 0.9, vz: Math.sin(a) * sp, size: size * (0.6 + Math.random() * 0.9), life: 0.9 + Math.random() * 0.6, ...opts });
        }
    }
    sparks(x, y, z, color, n = 10, speed = 3, size = 0.35, life = 0.4) {
        n = Math.max(1, Math.round(n * this.budget));
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, el = (Math.random() - 0.3) * 1.4, sp = speed * (0.4 + Math.random() * 0.8);
            this.glow(x, y, z, color, { vx: Math.cos(a) * sp * Math.cos(el), vy: Math.sin(el) * sp + 0.5, vz: Math.sin(a) * sp * Math.cos(el), size: size * (0.6 + Math.random() * 0.7), life: life * (0.6 + Math.random() * 0.8), drag: 3 });
        }
    }
    flashLight(x, y, z, color, k = 2, dur = 0.25) { this.flashes.push({ x, y, z, color, k, t: 0, dur }); }

    temp(obj, dur, update = null) { this.root.add(obj); const t = { obj, t: 0, dur, update }; this.temps.push(t); return t; }
    killTemp(t) { this.root.remove(t.obj); disposeModel(t.obj); }

    ring(x, z, r, color, dur = 0.4, { y = 0.06, grow = 1.6, opacity = 0.9, fill = false } = {}) {
        const m = new THREE.MeshBasicMaterial({ map: ringTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        m.userData.temp = true;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), m);
        p.position.set(x, y, z); p.scale.setScalar(r * 0.3);
        return this.temp(p, dur, (t, k) => { p.scale.setScalar(r * (0.3 + (grow - 0.3) * Math.pow(k, 0.5))); m.opacity = opacity * (1 - k); });
    }

    // ------------------------------------------------------------------ per-frame
    update(dt, camera) {
        // Droplets: gravity, bounce once, stick and shrink.
        const dm = this.dropMesh;
        let n = 0;
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.life -= dt;
            if (d.life <= 0) { this.drops.splice(i, 1); continue; }
            if (!d.landed) {
                d.vy -= 14 * dt;
                d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
                if (d.y < d.size * 0.5) {
                    d.y = d.size * 0.5;
                    if (Math.abs(d.vy) > 2) { d.vy *= -0.25; d.vx *= 0.5; d.vz *= 0.5; } else { d.landed = true; if (Math.random() < d.stick * 0.25) this.decal(d.x, d.z, d.color.getHex(), 0.25 + Math.random() * 0.2); }
                }
            }
        }
        for (const d of this.drops) {
            const k = Math.min(1, d.life / d.max * 2.5);
            const sz = d.size * k;
            _s.set(sz, d.landed ? sz * 0.45 : sz * (1 + Math.min(1.5, Math.abs(d.vy) * 0.08)), sz);
            _m4.compose(_p.set(d.x, d.y, d.z), _q.identity(), _s);
            dm.setMatrixAt(n, _m4); dm.setColorAt(n, d.color); n++;
        }
        dm.count = n; dm.instanceMatrix.needsUpdate = true; if (dm.instanceColor) dm.instanceColor.needsUpdate = true;
        // Glows.
        let g = 0;
        for (let i = this.glows.length - 1; i >= 0; i--) { const p = this.glows[i]; p.life -= dt; if (p.life <= 0) this.glows.splice(i, 1); }
        for (const p of this.glows) {
            const dr = Math.exp(-p.drag * dt);
            p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            const k = p.life / p.max;
            this.gPos[g * 3] = p.x; this.gPos[g * 3 + 1] = p.y; this.gPos[g * 3 + 2] = p.z;
            this.gCol[g * 3] = p.r * k; this.gCol[g * 3 + 1] = p.g * k; this.gCol[g * 3 + 2] = p.b * k;
            this.gSize[g] = p.size * (0.4 + 0.6 * k);
            g++;
        }
        this.gGeo.setDrawRange(0, g);
        this.gGeo.attributes.position.needsUpdate = true; this.gGeo.attributes.color.needsUpdate = true; this.gGeo.attributes.size.needsUpdate = true;
        // Puffs.
        for (let i = this.puffs.length - 1; i >= 0; i--) {
            const p = this.puffs[i];
            p.life -= dt;
            if (p.life <= 0) { this.root.remove(p.m); p.m.material.dispose(); this.puffs.splice(i, 1); continue; }   // sprite geometry is three's shared one
            const k = 1 - p.life / p.max;
            p.m.position.y += p.vy * dt; p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt;
            p.m.scale.setScalar(p.size * (0.6 + k * 0.9));
            p.m.material.opacity = p.opacity * Math.sin(Math.min(1, k * 1.2) * Math.PI);
        }
        // Decals grow in.
        for (let i = 0; i < this.decalData.length; i++) {
            const d = this.decalData[i];
            if (!d) continue;
            if (d.t < 1) d.t = Math.min(1, d.t + dt * 6);
            const s = d.size * (0.3 + 0.7 * d.t);
            _m4.compose(_p.set(d.x, 0.02 + (i % 7) * 0.0015, d.z), _q.setFromEuler(_e.set(0, d.rot, 0)), _s.set(s, 1, s));
            this.decals.setMatrixAt(i, _m4);
        }
        this.decals.instanceMatrix.needsUpdate = true;
        // Temps.
        for (let i = this.temps.length - 1; i >= 0; i--) {
            const t = this.temps[i];
            t.t += dt;
            const k = Math.min(1, t.t / t.dur);
            if (t.update) t.update(t.t, k, dt);
            if (t.t >= t.dur) { this.killTemp(t); this.temps.splice(i, 1); }
        }
        for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.t += dt; if (f.t >= f.dur) this.flashes.splice(i, 1); }
    }

    // ------------------------------------------------------------------ projectiles
    syncProjs(world, dt, time) {
        const live = new Set();
        for (const p of world.projs) {
            live.add(p.id);
            let v = this.projs.get(p.id);
            if (!v) { v = { g: projModel(p.proj), kind: p.proj, trail: 0 }; this.projs.set(p.id, v); this.root.add(v.g); }
            const y = p.owner === 'hero' ? 0.6 : 0.7;
            v.g.position.set(p.x, y, p.y);
            v.g.rotation.y = Math.atan2(p.vx, p.vy);
            if (v.kind === 'peel' || v.kind === 'spike' || v.kind === 'needle') v.g.children[0].rotation.y += dt * (v.kind === 'peel' ? 18 : 0);
            v.trail -= dt;
            if (v.trail <= 0) {
                v.trail = 0.03;
                const col = PROJ_TRAIL[v.kind];
                if (col) this.glow(p.x, y, p.y, col, { size: v.kind === 'fire' || v.kind === 'chutney' ? 0.7 : 0.4, life: 0.3, vy: 0.3 });
                if (v.kind === 'fire' || v.kind === 'ember') this.glow(p.x, y, p.y, 0xff4a10, { size: 0.5, life: 0.5, vy: 0.8, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
            }
        }
        for (const [id, v] of this.projs) if (!live.has(id)) { this.root.remove(v.g); disposeModel(v.g); this.projs.delete(id); }
    }

    // ------------------------------------------------------------------ composite effects
    hitSpray(x, z, color, crit, elem) {
        this.burst(x, 0.5, z, color, crit ? 14 : 7, crit ? 3.5 : 2.4, 0.045);
        this.sparks(x, 0.55, z, ELEM_COL[elem] || 0xffffff, crit ? 8 : 4, 2.5, crit ? 0.5 : 0.35, 0.25);
        if (elem === 'fire') for (let i = 0; i < 4; i++) this.glow(x, 0.5, z, 0xff6a1a, { vy: 1.5, size: 0.5, life: 0.45, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
        if (elem === 'cold') this.sparks(x, 0.5, z, 0xbff4ff, 6, 2, 0.3, 0.4);
    }

    splatDeath(x, z, color, size = 1, big = false) {
        this.burst(x, 0.45 * size, z, color, 34 * size, 4 * Math.sqrt(size), 0.06 * Math.sqrt(size), { stick: 0.9 });
        this.decal(x, z, color, 1.1 * size + Math.random() * 0.4);
        for (let i = 0; i < 3; i++) this.decal(x + (Math.random() - 0.5) * size * 1.5, z + (Math.random() - 0.5) * size * 1.5, color, 0.4 * size);
        // Seeds.
        for (let i = 0; i < 6 * size; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 2; this.drop(x, 0.4, z, 0x3a2a1a, { vx: Math.cos(a) * sp, vy: 3 + Math.random() * 2, vz: Math.sin(a) * sp, size: 0.035, life: 2.2, stick: 0 }); }
        this.sparks(x, 0.5, z, 0xffffff, 6 * size, 3, 0.5, 0.3);
        this.ring(x, z, 1.2 * size, color, 0.35, { opacity: 0.6 });
        if (big) { this.flashLight(x, 1, z, color, 4, 0.4); this.ring(x, z, 4, 0xffffff, 0.8, { opacity: 0.8 }); }
    }

    slash(x, z, face, arc, range, color = 0xffffff) {
        const len = (arc * Math.PI) / 180;
        const geo = new THREE.RingGeometry(range * 0.45, range, 24, 1, -len / 2, len);
        geo.rotateX(-Math.PI / 2);
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        m.userData.temp = true;
        const p = new THREE.Mesh(geo, m);
        p.position.set(x, 0.55, z);
        p.rotation.y = -face;
        this.temp(p, 0.18, (t, k) => { m.opacity = 0.6 * (1 - k); p.rotation.y = -face + (k - 0.5) * 0.4; });
    }

    telegraph(x, z, r, dur, elem = 'phys') {
        const color = elem === 'fire' ? 0xff5a1a : elem === 'pois' ? 0x9ae03a : 0xff2a3a;
        const g = new THREE.Group(); g.position.set(x, 0.05, z);
        const edge = new THREE.Mesh(new THREE.RingGeometry(r * 0.93, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
        edge.material.userData.temp = fill.material.userData.temp = true;
        g.add(edge); g.add(fill);
        this.temp(g, dur, (t, k) => { fill.scale.setScalar(Math.max(0.01, k)); edge.material.opacity = 0.5 + Math.sin(t * 20) * 0.3; });
    }

    telegraphLine(x, z, ang, len, w, dur) {
        const geo = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(0, 0, len / 2);
        const m = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
        m.userData.temp = true;
        const p = new THREE.Mesh(geo, m);
        p.position.set(x, 0.05, z); p.rotation.y = Math.PI / 2 - ang;
        this.temp(p, dur, (t) => { m.opacity = 0.25 + Math.sin(t * 25) * 0.15; });
    }

    lightning(pts) {
        const g = new THREE.Group();
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.6, 0.9), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
        m.userData.temp = true;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const path = [];
            const n = 8;
            for (let k = 0; k <= n; k++) {
                const t = k / n;
                const j = k === 0 || k === n ? 0 : 0.35;
                path.push(new THREE.Vector3(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * j, 0.7 + (Math.random() - 0.5) * j, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * j));
            }
            const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 24, 0.035, 4, false), m);
            g.add(tube);
            this.sparks(b.x, 0.7, b.y, 0xeaff7a, 8, 3, 0.45, 0.3);
            this.flashLight(b.x, 1, b.y, 0xbaff5a, 2, 0.15);
        }
        this.temp(g, 0.22, (t, k) => { m.opacity = 1 - k; });
    }

    nova(x, z, r, elem) {
        const col = elem === 'cold' ? 0x9aeaff : 0xffffff;
        this.ring(x, z, r, col, 0.45, { grow: 1.05, opacity: 1 });
        this.ring(x, z, r * 0.7, 0xffffff, 0.35, { grow: 1.05, opacity: 0.7 });
        for (let i = 0; i < 30 * this.budget; i++) {
            const a = (i / 30) * Math.PI * 2;
            this.glow(x, 0.4, z, col, { vx: Math.cos(a) * r * 2.2, vz: Math.sin(a) * r * 2.2, size: 0.55, life: 0.45, drag: 2.5 });
        }
        // Ice shards.
        const shardM = new THREE.MeshPhysicalMaterial({ color: 0xcff6ff, roughness: 0.05, transparent: true, opacity: 0.8, emissive: 0x4ab0ff, emissiveIntensity: 0.5 });
        shardM.userData.temp = true;
        const g = new THREE.Group();
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 5), shardM); s.position.set(x + Math.cos(a) * r * 0.75, 0.2, z + Math.sin(a) * r * 0.75); s.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(s); }
        this.temp(g, 0.7, (t, k) => { g.children.forEach((s) => s.scale.setScalar(Math.sin(Math.min(1, k * 1.5) * Math.PI) + 0.01)); shardM.opacity = 0.8 * (1 - k); });
        this.flashLight(x, 1, z, 0x8ad8ff, 3, 0.3);
    }

    explosion(x, z, r, elem, { big = false, splat = false } = {}) {
        const col = elem === 'fire' ? 0xff7a2a : elem === 'pois' ? 0x9ae03a : elem === 'cold' ? 0x9ae8ff : 0xffe0a0;
        this.ring(x, z, r, col, 0.4, { grow: 1.1, opacity: 1 });
        this.sparks(x, 0.4, z, col, big ? 40 : 22, r * 3, 0.7, 0.5);
        for (let i = 0; i < (big ? 10 : 5); i++) this.puff(x + (Math.random() - 0.5) * r, 0.4, z + (Math.random() - 0.5) * r, elem === 'pois' ? 0x6a8a2a : 0x4a3a34, { size: r * 0.9, life: 1.2, vy: 0.6, opacity: 0.45 });
        this.flashLight(x, 1, z, col, big ? 5 : 3, 0.3);
        if (splat) { this.burst(x, 0.4, z, 0x9ae03a, 26, 4, 0.06, { stick: 1 }); this.decal(x, z, 0x6a9a20, r * 1.6); }
        else if (elem === 'fire') this.decal(x, z, 0x2a1a14, r * 1.3);
    }

    meteor(x, z, r, delay) {
        const g = new THREE.Group();
        const melon = mesh(bodyGeo('watermelon'), bodyMaterial('watermelon'));
        melon.scale.setScalar(1.4); melon.position.y = -0.6;
        g.add(melon);
        g.position.set(x - 3, 13, z - 2);
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
        shadow.material.userData.temp = true;
        shadow.position.set(x, 0.04, z);
        this.temp(shadow, delay, (t, k) => { shadow.material.opacity = 0.5 * k; shadow.scale.setScalar(0.3 + 0.7 * k); });
        this.telegraph(x, z, r, delay, 'fire');
        this.temp(g, delay, (t, k) => {
            const e = k * k;
            g.position.set(x - 3 * (1 - e), 13 * (1 - e) + 0.6, z - 2 * (1 - e));
            g.rotation.x += 0.2; g.rotation.z += 0.13;
            this.glow(g.position.x, g.position.y, g.position.z, 0xff6a1a, { size: 1.6, life: 0.4, vy: 1 });
            this.glow(g.position.x, g.position.y, g.position.z, 0xffd06a, { size: 0.9, life: 0.25 });
        });
    }
    melonChunks(x, z, r) {
        this.burst(x, 0.5, z, 0xff3a4a, 50, 6, 0.09, { stick: 1 });
        this.burst(x, 0.5, z, 0x2a8a2a, 22, 5, 0.12, { stick: 0 });
        for (let i = 0; i < 4; i++) this.decal(x + (Math.random() - 0.5) * r, z + (Math.random() - 0.5) * r, 0xff2a3a, r * 0.7);
    }

    raisins(x, z, r, dur) {
        const n = Math.round(60 * dur * this.budget);
        const m = new THREE.MeshStandardMaterial({ color: 0x3a1a2a, roughness: 0.7 }); m.userData.temp = true;
        const g = new THREE.Group();
        const geo = new THREE.SphereGeometry(0.07, 6, 4);
        const list = [];
        for (let i = 0; i < n; i++) { const s = new THREE.Mesh(geo, m); s.scale.set(1, 0.7, 1.3); const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r; list.push({ s, x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, t0: Math.random() * dur }); s.visible = false; g.add(s); }
        this.ring(x, z, r, 0xff9ae8, dur, { grow: 1.0, opacity: 0.35 });
        this.temp(g, dur + 0.6, (t) => {
            for (const p of list) {
                const lt = t - p.t0;
                p.s.visible = lt > 0 && lt < 0.55;
                if (p.s.visible) p.s.position.set(p.x, Math.max(0.05, 6 - lt * 12), p.z);
                if (lt > 0.5 && !p.done) { p.done = true; if (Math.random() < 0.3) this.drop(p.x, 0.1, p.z, 0x3a1a2a, { vy: 1.5, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, size: 0.05, life: 0.8 }); }
            }
        });
    }

    groundArea(x, z, r, dur, kind) {
        if (kind === 'stink') {
            const t = this.temp(new THREE.Group(), dur, (tt, k, dt) => { if (Math.random() < dt * 10 * this.budget) { const a = Math.random() * 6.28, d = Math.random() * r; this.puff(x + Math.cos(a) * d, 0.3, z + Math.sin(a) * d, 0x8aa83a, { size: 1.0, life: 1.4, vy: 0.3, opacity: 0.35 }); } });
            return t;
        }
        if (kind === 'fire') return this.temp(new THREE.Group(), dur, (tt, k, dt) => { if (Math.random() < dt * 30 * this.budget) { const a = Math.random() * 6.28, d = Math.random() * r; this.glow(x + Math.cos(a) * d, 0.2, z + Math.sin(a) * d, Math.random() < 0.5 ? 0xff5a10 : 0xffb030, { vy: 1.6, size: 0.6, life: 0.5 }); } });
        if (kind === 'puddle' || kind === 'jamtrail') {
            const col = kind === 'puddle' ? 0x9aff3a : 0xb0103a;
            const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.1, transparent: true, opacity: 0.0, emissive: kind === 'puddle' ? 0x3a6a0a : 0x200008, depthWrite: false, alphaMap: splatTex() });
            m.userData.temp = true;
            const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.2, r * 2.2).rotateX(-Math.PI / 2), m);
            p.position.set(x, 0.03, z); p.rotation.y = Math.random() * 6;
            return this.temp(p, dur, (tt, k) => { m.opacity = Math.min(0.8, tt * 4) * (1 - Math.max(0, (k - 0.8) / 0.2)); });
        }
        return null;
    }

    trap(x, z) {
        const g = new THREE.Group();
        const peelM = new THREE.MeshStandardMaterial({ color: 0xf6d23c, roughness: 0.5 }); peelM.userData.temp = true;
        for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 0.5, 0, Math.PI * 0.5), peelM); f.rotation.set(0, (i / 3) * Math.PI * 2, Math.PI / 2 - 0.3); f.scale.set(1, 1.6, 1); g.add(f); }
        g.position.set(x, 0.05, z);
        const t = this.temp(g, 999, (tt) => { g.rotation.y = Math.sin(tt * 2) * 0.1; });
        return t;
    }

    levelUp(x, z) {
        const geo = new THREE.CylinderGeometry(0.7, 0.9, 8, 24, 1, true).translate(0, 4, 0);
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        m.userData.temp = true;
        const p = new THREE.Mesh(geo, m); p.position.set(x, 0, z);
        this.temp(p, 1.4, (t, k) => { m.opacity = 0.6 * (1 - k); p.scale.set(1 + k * 0.5, 1, 1 + k * 0.5); });
        for (let i = 0; i < 50 * this.budget; i++) { const a = Math.random() * 6.28; this.glow(x + Math.cos(a) * 0.6, Math.random() * 2, z + Math.sin(a) * 0.6, i % 2 ? 0xffd04a : 0xffffff, { vy: 2 + Math.random() * 3, size: 0.45, life: 1.1 }); }
        this.ring(x, z, 3, 0xffd04a, 0.8, { opacity: 1 });
        this.flashLight(x, 1.5, z, 0xffd04a, 4, 0.8);
    }

    swirl(x, z, color, n = 24, h = 1.4) {
        for (let i = 0; i < n * this.budget; i++) { const a = (i / n) * 6.28; this.glow(x + Math.cos(a) * 0.5, 0.1 + (i / n) * h, z + Math.sin(a) * 0.5, color, { vx: -Math.sin(a) * 2, vz: Math.cos(a) * 2, vy: 0.8, size: 0.4, life: 0.6, drag: 1 }); }
    }
}

const PROJ_TRAIL = { zest: 0xd8ff5a, fire: 0xffa040, ember: 0xff7a2a, acid: 0x8aff3a, spore: 0xb06aff, chutney: 0xff8a2a, juice: 0xffa020, pome: 0xff3a4a };

let projModels = null;
function projModel(kind) {
    if (!projModels) {
        const M = (o) => new THREE.MeshStandardMaterial(o);
        projModels = {
            seed: () => { const m = mesh(new THREE.SphereGeometry(0.07, 8, 6), M({ color: 0x4a2e1a, roughness: 0.4 })); m.scale.set(0.8, 0.8, 1.8); return m; },
            pome: () => { const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), M({ color: 0xc8102a, roughness: 0.3 }))); g.add(mesh(new THREE.ConeGeometry(0.06, 0.08, 6), M({ color: 0x8a1a1a }), 0, 0.15, 0)); return g; },
            zest: () => glowSpr(0xd8ff5a, 0.7),
            fire: () => { const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.3, 0.4) }))); g.add(glowSpr(0xff7a2a, 1.2)); return g; },
            peel: () => { const g = new THREE.Group(); const m = mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12, Math.PI * 0.8), M({ color: 0xf6d23c, roughness: 0.5 })); m.rotation.x = Math.PI / 2; const h = new THREE.Group(); h.add(m); g.add(h); return g; },
            acid: () => { const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 2.0, 0.4) }))); g.add(glowSpr(0x9aff3a, 0.6)); return g; },
            needle: () => { const g = new THREE.Group(); const c = mesh(new THREE.ConeGeometry(0.03, 0.3, 4), M({ color: 0xfff3c0 })); c.rotation.x = Math.PI / 2; g.add(c); return g; },
            ember: () => { const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.3) }))); g.add(glowSpr(0xff6a1a, 0.9)); return g; },
            spore: () => glowSpr(0xb06aff, 0.7),
            juice: () => { const m = mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xff9a1a, roughness: 0.1, clearcoat: 1, emissive: 0x401000 })); m.scale.set(1, 1, 1.5); return m; },
            chutney: () => { const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.2) }))); g.add(glowSpr(0xff7a1a, 1.3)); return g; },
            spike: () => { const g = new THREE.Group(); const c = mesh(new THREE.ConeGeometry(0.07, 0.36, 5), M({ color: 0x9a9a3a, roughness: 0.6 })); c.rotation.x = Math.PI / 2; g.add(c); return g; },
        };
    }
    const f = projModels[kind] || projModels.seed;
    const o = f();
    if (!o.isGroup) { const g = new THREE.Group(); g.add(o); return g; }
    return o;
}
function glowSpr(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.scale.setScalar(size);
    const g = new THREE.Group(); g.add(s);
    return g;
}
export { ELEM_COL };
