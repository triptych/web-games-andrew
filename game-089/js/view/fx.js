// Effects shared by the board and the battle: particles (glowing sparks and soft puffs), expanding
// rings, slash arcs, beams, and floating text (damage numbers) drawn in the DOM over the canvas.

import * as THREE from 'three';
import { glowMat } from './toon.js';

const MAX = 1600;

/** One pool of camera-facing particles. additive: glows; otherwise soft opaque-ish puffs. */
class Pool {
    constructor(scene, additive) {
        this.n = 0;
        this.pos = new Float32Array(MAX * 3);
        this.col = new Float32Array(MAX * 3);
        this.size = new Float32Array(MAX);
        this.alpha = new Float32Array(MAX);
        this.p = [];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        g.setDrawRange(0, 0);
        this.geo = g;
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: { uScale: { value: 400 }, uSoft: { value: additive ? 1 : 0 } },
            vertexShader: /* glsl */`
                attribute float size; attribute float alpha; attribute vec3 color;
                uniform float uScale;
                varying vec3 vC; varying float vA;
                void main() {
                    vC = color; vA = alpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * uScale / max(0.1, -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform float uSoft;
                varying vec3 vC; varying float vA;
                void main() {
                    vec2 d = gl_PointCoord - 0.5;
                    float r = length(d) * 2.0;
                    if (r > 1.0) discard;
                    float a = uSoft > 0.5 ? (1.0 - r) * (1.0 - r) : smoothstep(1.0, 0.75, r);
                    vec3 c = vC;
                    if (uSoft < 0.5) c *= 0.85 + 0.15 * (1.0 - d.y * 2.0);
                    gl_FragColor = vec4(c * (uSoft > 0.5 ? 1.6 : 1.0), a * vA);
                }`,
        });
        this.mat = mat;
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
    }

    emit(o) {
        if (this.p.length >= MAX) this.p.shift();
        this.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, g: o.g ?? 0, drag: o.drag ?? 0, life: o.life ?? 1, t: 0, s0: o.size ?? 0.4, s1: o.size1 ?? (o.size ?? 0.4) * 0.2, c: o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color ?? '#ffffff'), a: o.alpha ?? 1 });
    }

    update(dt) {
        const P = this.p;
        let w = 0;
        for (let i = 0; i < P.length; i++) {
            const q = P[i];
            q.t += dt;
            if (q.t >= q.life) continue;
            q.vy -= q.g * dt;
            const dr = Math.exp(-q.drag * dt);
            q.vx *= dr; q.vy *= dr; q.vz *= dr;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            P[w++] = q;
        }
        P.length = w;
        for (let i = 0; i < w; i++) {
            const q = P[i], u = q.t / q.life;
            this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
            this.col[i * 3] = q.c.r; this.col[i * 3 + 1] = q.c.g; this.col[i * 3 + 2] = q.c.b;
            this.size[i] = q.s0 + (q.s1 - q.s0) * u;
            this.alpha[i] = q.a * (u < 0.1 ? u / 0.1 : 1 - Math.pow((u - 0.1) / 0.9, 2));
        }
        this.geo.setDrawRange(0, w);
        for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
    }
}

export class FX {
    constructor(scene, overlay) {
        this.scene = scene;
        this.glow = new Pool(scene, true);
        this.puff = new Pool(scene, false);
        this.items = [];          // rings, arcs, beams: { obj, t, life, update }
        this.overlay = overlay;   // a DOM element for floating text
        this.texts = [];
        this.calm = false;        // fewer, gentler effects
    }

    setScale(h) { this.glow.mat.uniforms.uScale.value = h * 0.6; this.puff.mat.uniforms.uScale.value = h * 0.6; }

    /** A burst of glowing sparks. */
    sparks(p, color = '#ffd27a', n = 18, speed = 4, opts = {}) {
        n = this.calm ? Math.ceil(n * 0.5) : n;
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.8;
            const v = speed * (0.4 + Math.random() * 0.8);
            this.glow.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + (opts.up ?? 1.5), vz: Math.sin(a) * Math.cos(e) * v, g: opts.g ?? 6, drag: 1.5, life: (opts.life ?? 0.7) * (0.6 + Math.random() * 0.6), size: opts.size ?? 0.35, color: c });
        }
    }

    /** Soft puffs: dust, smoke, steam. */
    puffs(p, color = '#ffffff', n = 8, opts = {}) {
        n = this.calm ? Math.ceil(n * 0.5) : n;
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * (opts.spread ?? 0.5);
            this.puff.emit({ x: p.x + Math.cos(a) * r, y: p.y + Math.random() * 0.2, z: p.z + Math.sin(a) * r, vx: Math.cos(a) * (opts.out ?? 1), vy: opts.up ?? 1.2, vz: Math.sin(a) * (opts.out ?? 1), g: opts.g ?? -0.2, drag: 1.2, life: (opts.life ?? 1.2) * (0.7 + Math.random() * 0.5), size: opts.size ?? 0.7, size1: opts.size1 ?? (opts.size ?? 0.7) * 1.8, color: c, alpha: opts.alpha ?? 0.8 });
        }
    }

    /** A rising column of motes (heals, level ups). */
    motes(p, color = '#9affc0', n = 24, h = 2) {
        n = this.calm ? Math.ceil(n * 0.5) : n;
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.6;
            this.glow.emit({ x: p.x + Math.cos(a) * r, y: p.y + Math.random() * 0.4, z: p.z + Math.sin(a) * r, vy: h * (0.6 + Math.random() * 0.8), g: 0, drag: 0.6, life: 0.9 + Math.random() * 0.6, size: 0.25 + Math.random() * 0.15, color: c });
        }
    }

    /** Coloured confetti that tumbles down. */
    confetti(p, n = 60) {
        const cols = ['#ff5a5a', '#ffd84a', '#5ab0ff', '#7ae06a', '#ff8ad8', '#ffffff'];
        n = this.calm ? Math.ceil(n * 0.5) : n;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4;
            this.puff.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v * 0.6, vy: 4 + Math.random() * 5, vz: Math.sin(a) * v * 0.6, g: 7, drag: 1.8, life: 1.6 + Math.random(), size: 0.18, size1: 0.16, color: cols[i % cols.length], alpha: 1 });
        }
    }

    /** An expanding ring on the ground or facing the camera. */
    ring(p, color = '#ffffff', r1 = 3, life = 0.5, opts = {}) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), glowMat(color, opts.k ?? 1.4, { transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, additive: true }).clone());
        m.position.copy(p);
        if (opts.vertical) m.lookAt(opts.lookAt ?? new THREE.Vector3(p.x, p.y, p.z + 1)); else m.rotation.x = -Math.PI / 2;
        this.scene.add(m);
        this.items.push({ obj: m, t: 0, life, update: (it, u) => { const s = 0.2 + u * r1; m.scale.setScalar(s); m.material.opacity = 1 - u; } });
    }

    /** A swept slash arc in front of `p`, facing `dir` (a world-space yaw). */
    slash(p, yaw = 0, color = '#ffffff', size = 1.2, tilt = 0.6) {
        const g = new THREE.TorusGeometry(size, 0.06 * size, 4, 24, Math.PI * 0.9);
        const m = new THREE.Mesh(g, glowMat(color, 1.8, { transparent: true, opacity: 1, depthWrite: false, additive: true }).clone());
        const grp = new THREE.Group();
        grp.position.copy(p);
        grp.rotation.set(0, yaw, 0);
        m.rotation.set(tilt, Math.PI / 2, 0);
        grp.add(m);
        this.scene.add(grp);
        this.items.push({ obj: grp, t: 0, life: 0.28, update: (it, u) => { m.rotation.z = -1.2 + u * 2.2; m.material.opacity = 1 - u * u; m.scale.setScalar(1 + u * 0.3); } });
    }

    /** A projectile from a to b; calls onHit when it lands. kind: orb | arrow | rock */
    shoot(a, b, color = '#ff8a3a', dur = 0.35, onHit = null, kind = 'orb', size = 0.3) {
        let obj;
        if (kind === 'arrow') {
            obj = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), new THREE.MeshBasicMaterial({ color: '#8a5a2a' }));
            shaft.rotation.x = Math.PI / 2;
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), glowMat(color, 1.4));
            tip.rotation.x = Math.PI / 2; tip.position.z = 0.5;
            obj.add(shaft, tip);
        } else obj = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), glowMat(color, 2.0));
        obj.position.copy(a);
        this.scene.add(obj);
        const from = a.clone(), to = b.clone();
        const arc = kind === 'rock' ? 2.5 : kind === 'arrow' ? 0.6 : 0.4;
        let last = from.clone();
        this.items.push({ obj, t: 0, life: dur, update: (it, u) => {
            const p = from.clone().lerp(to, u);
            p.y += Math.sin(u * Math.PI) * arc;
            obj.position.copy(p);
            if (kind === 'arrow') obj.lookAt(p.clone().add(p.clone().sub(last)));
            if (kind !== 'arrow' && Math.random() < 0.8) this.glow.emit({ x: p.x, y: p.y, z: p.z, vy: 0.3, life: 0.35, size: size * 1.4, color });
            last = p;
        }, done: onHit });
    }

    /** A vertical beam (holy light, lightning) at p. */
    beam(p, color = '#fff6c0', h = 7, life = 0.5, w = 0.6) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 0.6, h, 16, 1, true), glowMat(color, 1.6, { transparent: true, opacity: 0.9, depthWrite: false, additive: true, side: THREE.DoubleSide }).clone());
        m.position.set(p.x, p.y + h / 2, p.z);
        this.scene.add(m);
        this.items.push({ obj: m, t: 0, life, update: (it, u) => { m.material.opacity = (1 - u) * 0.9; m.scale.set(1 - u * 0.6, 1, 1 - u * 0.6); } });
    }

    /** A jagged lightning bolt from the sky to p. */
    bolt(p, color = '#bfe8ff') {
        const pts = [];
        let x = p.x, z = p.z;
        for (let i = 0; i <= 8; i++) {
            pts.push(new THREE.Vector3(x, p.y + 9 - i * 1.15, z));
            x += (Math.random() - 0.5) * 0.8; z += (Math.random() - 0.5) * 0.8;
        }
        pts[pts.length - 1].set(p.x, p.y, p.z);
        const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, 0.08, 4, false);
        const m = new THREE.Mesh(g, glowMat(color, 2.4, { transparent: true, opacity: 1, depthWrite: false, additive: true }).clone());
        this.scene.add(m);
        this.items.push({ obj: m, t: 0, life: 0.3, update: (it, u) => { m.material.opacity = u < 0.5 ? 1 : (1 - u) * 2; m.visible = u < 0.15 || u > 0.22; } });
    }

    /** A cluster of ice shards bursting up at p. */
    iceBurst(p, n = 7) {
        const grp = new THREE.Group();
        grp.position.copy(p);
        const mat = glowMat('#bfefff', 1.25, { transparent: true, opacity: 0.95 }).clone();
        for (let i = 0; i < n; i++) {
            const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0 + Math.random() * 0.8, 5), mat);
            const a = (i / n) * Math.PI * 2;
            s.position.set(Math.cos(a) * 0.45, 0.4, Math.sin(a) * 0.45);
            s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
            grp.add(s);
        }
        this.scene.add(grp);
        this.items.push({ obj: grp, t: 0, life: 0.7, update: (it, u) => { grp.scale.set(1, Math.min(1, u * 6), 1); mat.opacity = u < 0.6 ? 0.95 : (1 - u) * 2.4; } });
    }

    /** Words that float up from a world point: damage, heals, MISS, Level Up! */
    text(world, str, cls = '', camera, opts = {}) {
        if (!this.overlay) return;
        const el = document.createElement('div');
        el.className = 'ftext ' + cls;
        el.textContent = str;
        this.overlay.appendChild(el);
        this.texts.push({ el, p: world.clone(), t: 0, life: opts.life ?? 1.1, rise: opts.rise ?? 1.2, camera, dx: opts.dx ?? 0 });
    }

    update(dt, camera, w, h) {
        this.glow.update(dt);
        this.puff.update(dt);
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.t += dt;
            const u = Math.min(1, it.t / it.life);
            it.update?.(it, u);
            if (u >= 1) {
                this.scene.remove(it.obj);
                it.obj.traverse?.((o) => { o.geometry?.dispose?.(); });
                this.items.splice(i, 1);
                it.done?.();
            }
        }
        const v = new THREE.Vector3();
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const T = this.texts[i];
            T.t += dt;
            const u = T.t / T.life;
            if (u >= 1) { T.el.remove(); this.texts.splice(i, 1); continue; }
            v.copy(T.p); v.y += T.rise * (1 - Math.pow(1 - Math.min(1, u * 1.6), 3));
            v.project(T.camera || camera);
            T.el.style.transform = `translate(${((v.x + 1) / 2) * w + T.dx}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%) scale(${u < 0.12 ? 0.6 + u * 4 : 1})`;
            T.el.style.opacity = u > 0.75 ? String((1 - u) * 4) : '1';
        }
    }

    clear() {
        for (const it of this.items) this.scene.remove(it.obj);
        this.items.length = 0;
        for (const T of this.texts) T.el.remove();
        this.texts.length = 0;
        this.glow.p.length = 0;
        this.puff.p.length = 0;
    }
}
