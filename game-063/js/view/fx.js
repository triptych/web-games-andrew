// Effects: pooled point particles (one additive, one alpha-blended layer), expanding rings, a ribbon
// trail behind the ball, spinning coins, and ambient weather (pollen, snow, embers, sparkles).
// Every burst is capped per frame so a big moment reads as a storm, not a white-out.

import * as THREE from 'three';

const ptVS = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aShape;
varying float vAlpha; varying vec3 vColor; varying float vShape;
void main() {
    vAlpha = aAlpha; vColor = aColor; vShape = aShape;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
}`;
const ptFS = `
varying float vAlpha; varying vec3 vColor; varying float vShape;
void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float a;
    if (vShape > 1.5) { // star
        float r = length(p), ang = atan(p.y, p.x);
        float s = 0.45 + 0.35 * abs(cos(ang * 2.0));
        a = smoothstep(s, s * 0.6, r);
    } else if (vShape > 0.5) { // square confetti
        a = step(abs(p.x), 0.7) * step(abs(p.y), 0.45);
    } else { // soft round
        a = smoothstep(1.0, 0.3, length(p));
    }
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
}`;

class PointLayer {
    constructor(scene, max, additive) {
        this.max = max;
        this.n = 0;
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
        this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.shape = new Float32Array(max);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
        this.geo = g;
        this.pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: ptVS, fragmentShader: ptFS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
        this.pts.frustumCulled = false;
        this.pts.renderOrder = 5;
        scene.add(this.pts);
        this.p = [];
    }
    add(o) {
        if (this.p.length >= this.max) this.p.shift();
        this.p.push(o);
    }
    update(dt) {
        const P = this.p;
        let w = 0;
        for (let i = 0; i < P.length; i++) {
            const o = P[i];
            o.age += dt;
            if (o.age >= o.life) continue;
            o.vy -= (o.g ?? 0) * dt;
            const dr = Math.exp(-(o.drag ?? 0) * dt);
            o.vx *= dr; o.vy *= dr; o.vz *= dr;
            o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
            if (o.floor !== undefined && o.y < o.floor) { o.y = o.floor; o.vy *= -0.3; o.vx *= 0.6; o.vz *= 0.6; }
            P[w++] = o;
        }
        P.length = w;
        for (let i = 0; i < w; i++) {
            const o = P[i];
            const t = o.age / o.life;
            this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
            this.col[i * 3] = o.r; this.col[i * 3 + 1] = o.gg; this.col[i * 3 + 2] = o.b;
            this.size[i] = o.size * (o.grow ? 1 + t * o.grow : 1 - t * 0.5);
            this.alpha[i] = (o.a ?? 1) * (t < 0.1 ? t / 0.1 : 1 - Math.pow((t - 0.1) / 0.9, 1.5));
            this.shape[i] = o.shape ?? 0;
        }
        this.geo.setDrawRange(0, w);
        for (const k of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape']) this.geo.attributes[k].needsUpdate = true;
    }
    clear() { this.p.length = 0; this.geo.setDrawRange(0, 0); }
}

const _c = new THREE.Color();

export class Fx {
    constructor(scene) {
        this.scene = scene;
        this.add = new PointLayer(scene, 2400, true);
        this.blend = new PointLayer(scene, 2400, false);
        this.rings = [];
        this.coins = [];
        this.budget = 0;
        this.ambient = null;
        this.ambT = 0;
        // ring pool
        for (let i = 0; i < 14; i++) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            m.visible = false; m.renderOrder = 4;
            scene.add(m);
            this.rings.push({ m, t: 1, life: 1 });
        }
        // coin pool
        const cg = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14).rotateX(Math.PI / 2);
        const cm = new THREE.MeshToonMaterial({ color: '#ffd040', emissive: '#a07000', emissiveIntensity: 0.5 });
        for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(cg, cm); m.visible = false; scene.add(m); this.coins.push({ m, t: 9, life: 1 }); }
        // trail
        this.trail = new Trail(scene);
    }

    burst(kind, x, y, z, n = 12, opt = {}) {
        n = Math.min(n, Math.max(0, 260 - this.budget));
        this.budget += n;
        const col = opt.color ? _c.set(opt.color) : null;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, u = Math.random();
            const sp = (opt.speed ?? 4) * (0.4 + Math.random() * 0.8);
            const up = opt.up ?? 0.6;
            const o = { x, y, z, vx: Math.cos(a) * sp * (1 - up * 0.5), vy: sp * up * (0.5 + u), vz: Math.sin(a) * sp * (1 - up * 0.5), age: 0, life: (opt.life ?? 0.8) * (0.6 + Math.random() * 0.7), size: (opt.size ?? 0.5) * (0.6 + Math.random() * 0.8), g: opt.g ?? 9, drag: opt.drag ?? 1.5, shape: opt.shape ?? 0, grow: opt.grow ?? 0, a: opt.alpha ?? 1, floor: opt.floor };
            const cc = opt.colors ? _c.set(opt.colors[i % opt.colors.length]) : col ?? _c.set('#ffffff');
            o.r = cc.r; o.gg = cc.g; o.b = cc.b;
            (opt.additive ? this.add : this.blend).add(o);
        }
    }

    // Presets keyed by what happened.
    preset(name, x, y, z, k = 1, color = null) {
        switch (name) {
            case 'dust': return this.burst('dust', x, y, z, 10 * k, { color: '#d8c8a8', speed: 3, up: 0.3, life: 0.7, size: 0.9, grow: 1.5, g: 1, drag: 3, alpha: 0.6 });
            case 'grass': return this.burst('grass', x, y, z, 8 * k, { colors: ['#5ab04a', '#8ad860'], speed: 3, up: 0.8, life: 0.6, size: 0.35, g: 12, shape: 1 });
            case 'sand': return this.burst('sand', x, y, z, 26 * k, { colors: ['#f4dca0', '#e8c888'], speed: 5, up: 0.9, life: 0.9, size: 0.45, g: 16, drag: 1 });
            case 'snow': return this.burst('snow', x, y, z, 22 * k, { colors: ['#ffffff', '#e8f4ff'], speed: 4, up: 0.9, life: 1.0, size: 0.5, g: 10, drag: 1.5 });
            case 'ice': return this.burst('ice', x, y, z, 8 * k, { colors: ['#e0f8ff', '#ffffff'], speed: 4, up: 0.5, life: 0.5, size: 0.4, shape: 2, additive: true, g: 6 });
            case 'splash':
                this.ring(x, y + 0.05, z, '#ffffff', 3.5, 0.8);
                this.ring(x, y + 0.05, z, '#bfe8ff', 2.0, 0.6);
                return this.burst('splash', x, y, z, 40 * k, { colors: ['#ffffff', '#bfe8ff', '#8ad0ff'], speed: 6, up: 1.4, life: 1.0, size: 0.45, g: 18, drag: 0.6 });
            case 'lava':
                this.ring(x, y + 0.05, z, '#ffb040', 3.0, 0.7);
                this.burst('lava', x, y, z, 30 * k, { colors: ['#ffe070', '#ff8a2a', '#ff4a1a'], speed: 6, up: 1.3, life: 1.0, size: 0.5, g: 14, additive: true });
                return this.burst('smoke', x, y + 0.5, z, 12, { color: '#4a3a3a', speed: 1.2, up: 1.5, life: 1.8, size: 1.6, grow: 2, g: -1.5, drag: 1, alpha: 0.5 });
            case 'void': return this.burst('void', x, y, z, 20, { colors: ['#c8a0ff', '#ffffff'], speed: 3, up: 0.5, life: 1.2, size: 0.5, additive: true, g: 0, shape: 2 });
            case 'sparkle': return this.burst('sparkle', x, y, z, 18 * k, { colors: ['#fff6a0', '#ffffff', '#ffd040'], speed: 4, up: 0.6, life: 0.7, size: 0.6, additive: true, shape: 2, g: 2 });
            case 'perfect':
                this.ring(x, y + 0.1, z, '#ffe070', 4, 0.5);
                return this.burst('perfect', x, y + 0.3, z, 28, { colors: ['#fff6a0', '#ffd040', '#ffffff'], speed: 7, up: 0.5, life: 0.8, size: 0.7, additive: true, shape: 2, g: 1, drag: 2.5 });
            case 'leaves': return this.burst('leaves', x, y, z, 10 * k, { colors: ['#5ab04a', '#3a8a3a', '#8ad860'], speed: 3, up: 0.4, life: 1.6, size: 0.4, g: 3, drag: 2.2, shape: 1 });
            case 'poof':
                this.ring(x, y, z, '#ffffff', 2.4, 0.5);
                this.burst('poof', x, y, z, 18, { color: '#ffffff', speed: 4, up: 0.6, life: 0.6, size: 1.1, grow: 1.4, g: 0, drag: 4, alpha: 0.85 });
                return this.burst('star', x, y + 0.5, z, 10, { colors: ['#ffe070', '#ff8ad8', '#8ad8ff'], speed: 5, up: 0.8, life: 0.8, size: 0.6, additive: true, shape: 2, g: 6 });
            case 'confetti': return this.burst('confetti', x, y, z, 70 * k, { colors: ['#ff4a6a', '#ffd040', '#4ad0ff', '#8aff6a', '#c86aff', '#ffffff'], speed: 9, up: 1.6, life: 2.4, size: 0.4, g: 9, drag: 1.4, shape: 1 });
            case 'firework': {
                const cols = [['#ff4a6a', '#ffd0e0'], ['#ffd040', '#fff6c0'], ['#4ad0ff', '#d0f4ff'], ['#8aff6a', '#e0ffd0']][Math.floor(Math.random() * 4)];
                this.ring(x, y, z, cols[0], 0.1, 0.01);
                return this.burst('fw', x, y, z, 60, { colors: cols, speed: 11, up: 0.1, life: 1.6, size: 0.55, additive: true, shape: 2, g: 3, drag: 1.6 });
            }
            case 'magic': return this.burst('magic', x, y, z, 24 * k, { color: color ?? '#c88aff', speed: 3, up: 0.7, life: 1.0, size: 0.6, additive: true, shape: 2, g: -1, drag: 2 });
            case 'fire': return this.burst('fire', x, y, z, 6, { colors: ['#ffe070', '#ff8a2a', '#ff4a1a'], speed: 1.2, up: 1.4, life: 0.5, size: 0.7, additive: true, g: -3, drag: 2 });
            case 'frost': return this.burst('frost', x, y, z, 4, { colors: ['#e0f8ff', '#9ad8ff'], speed: 1, up: 0.8, life: 0.6, size: 0.5, additive: true, shape: 2, g: -1 });
            case 'seek': return this.burst('seek', x, y, z, 3, { colors: ['#d58aff', '#ffffff'], speed: 0.6, up: 0.5, life: 0.5, size: 0.4, additive: true, shape: 2, g: 0 });
            case 'steam': return this.burst('steam', x, y, z, 20, { color: '#f4f0f0', speed: 2.5, up: 3, life: 1.6, size: 1.6, grow: 2.2, g: -6, drag: 1.2, alpha: 0.55 });
            case 'shock':
                this.ring(x, y + 0.2, z, '#ffb070', 14, 0.7);
                return this.burst('dust', x, y, z, 30, { color: '#a89878', speed: 9, up: 0.3, life: 0.9, size: 1.2, grow: 1.5, g: 1, drag: 3, alpha: 0.6 });
            case 'hit':
                this.ring(x, y, z, '#ffffff', 2.2, 0.35);
                return this.burst('hit', x, y, z, 22, { colors: ['#ffffff', '#ffe070', '#ff8a6a'], speed: 8, up: 0.5, life: 0.5, size: 0.6, additive: true, shape: 2, g: 3, drag: 3 });
            case 'levelup':
                for (let i = 0; i < 3; i++) this.ring(x, y + i * 0.8, z, '#ffe070', 3 + i, 0.8 + i * 0.2);
                return this.burst('lv', x, y, z, 50, { colors: ['#fff6a0', '#ffd040', '#ffffff'], speed: 2, up: 3, life: 1.6, size: 0.6, additive: true, shape: 2, g: -4, drag: 1 });
        }
    }

    ring(x, y, z, color, size, life) {
        const r = this.rings.find((q) => q.t >= q.life) ?? this.rings[0];
        r.m.position.set(x, y, z);
        r.m.material.color.set(color);
        r.t = 0; r.life = life; r.size = size;
        r.m.visible = true;
    }

    coinBurst(x, y, z, n = 5) {
        for (let i = 0; i < n; i++) {
            const c = this.coins.find((q) => q.t >= q.life);
            if (!c) return;
            const a = Math.random() * Math.PI * 2;
            c.m.position.set(x, y, z);
            c.v = new THREE.Vector3(Math.cos(a) * 2.5, 6 + Math.random() * 3, Math.sin(a) * 2.5);
            c.t = 0; c.life = 0.9 + Math.random() * 0.4;
            c.m.visible = true;
        }
    }

    setAmbient(kind) { this.ambient = kind; }

    update(dt, camPos, focus) {
        this.budget = Math.max(0, this.budget - 900 * dt);
        this.add.update(dt); this.blend.update(dt);
        for (const r of this.rings) {
            if (r.t >= r.life) { r.m.visible = false; continue; }
            r.t += dt;
            const k = r.t / r.life;
            const s = 0.2 + r.size * (1 - Math.pow(1 - k, 2.5));
            r.m.scale.set(s, s, s);
            r.m.material.opacity = (1 - k) * 0.9;
        }
        for (const c of this.coins) {
            if (c.t >= c.life) { c.m.visible = false; continue; }
            c.t += dt;
            c.v.y -= 18 * dt;
            c.m.position.addScaledVector(c.v, dt);
            c.m.rotation.y += dt * 14;
            if (c.t >= c.life) this.preset('sparkle', c.m.position.x, c.m.position.y, c.m.position.z, 0.3);
        }
        // ambient weather around the focus
        if (this.ambient && focus) {
            this.ambT += dt;
            const rate = { pollen: 0.06, snow: 0.012, embers: 0.03, sparkles: 0.05 }[this.ambient] ?? 1;
            while (this.ambT > rate) {
                this.ambT -= rate;
                const x = focus.x + (Math.random() - 0.5) * 70, z = focus.z + (Math.random() - 0.5) * 70;
                if (this.ambient === 'snow') this.blend.add({ x, y: focus.y + 18 + Math.random() * 6, z, vx: 0.6, vy: -2.2, vz: 0.3, age: 0, life: 9, size: 0.32, g: 0, drag: 0, r: 1, gg: 1, b: 1, a: 0.9 });
                else if (this.ambient === 'embers') this.add.add({ x, y: focus.y + Math.random() * 3, z, vx: (Math.random() - 0.5), vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5), age: 0, life: 4, size: 0.25, g: 0, drag: 0.2, r: 1, gg: 0.5 + Math.random() * 0.3, b: 0.15, a: 1 });
                else if (this.ambient === 'pollen') this.add.add({ x, y: focus.y + 0.5 + Math.random() * 4, z, vx: 0.4, vy: 0.1, vz: 0.2, age: 0, life: 5, size: 0.18, g: 0, drag: 0, r: 1, gg: 1, b: 0.7, a: 0.7 });
                else if (this.ambient === 'sparkles') this.add.add({ x, y: focus.y + Math.random() * 12 - 4, z, vx: 0, vy: 0.3, vz: 0, age: 0, life: 3, size: 0.3, g: 0, drag: 0, r: 1, gg: 0.85, b: 1, a: 1, shape: 2 });
            }
        }
        this.trail.update(dt);
    }

    clear() { this.add.clear(); this.blend.clear(); this.trail.reset(); for (const r of this.rings) r.t = r.life; for (const c of this.coins) c.t = c.life; }
}

// A ribbon behind the ball, facing the camera, fading along its length.
class Trail {
    constructor(scene) {
        this.N = 48;
        this.pts = [];
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.N * 2 * 3);
        this.al = new Float32Array(this.N * 2);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aA', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
        const idx = [];
        for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        g.setIndex(idx);
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { uColor: { value: new THREE.Color('#ffffff') } },
            vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA, vA); }',
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 6;
        scene.add(this.mesh);
        this.cam = null;
        this.width = 0.16;
    }
    setColor(c, w = 0.16) { this.mat.uniforms.uColor.value.set(c); this.width = w; }
    push(x, y, z) { this.pts.unshift([x, y, z]); if (this.pts.length > this.N) this.pts.pop(); }
    reset() { this.pts.length = 0; this.geo.setDrawRange(0, 0); }
    fade() { if (this.pts.length) this.pts.pop(); }
    update() {
        const P = this.pts, n = P.length;
        if (n < 2 || !this.cam) { this.geo.setDrawRange(0, 0); return; }
        const cp = this.cam.position;
        for (let i = 0; i < n; i++) {
            const p = P[i], q = P[Math.min(n - 1, i + 1)], r = P[Math.max(0, i - 1)];
            const tx = q[0] - r[0], ty = q[1] - r[1], tz = q[2] - r[2];
            const vx = cp.x - p[0], vy = cp.y - p[1], vz = cp.z - p[2];
            let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
            const l = Math.hypot(sx, sy, sz) || 1;
            const w = this.width * (1 - i / n);
            sx = (sx / l) * w; sy = (sy / l) * w; sz = (sz / l) * w;
            this.pos.set([p[0] + sx, p[1] + sy, p[2] + sz, p[0] - sx, p[1] - sy, p[2] - sz], i * 6);
            const a = Math.pow(1 - i / n, 1.4) * 0.85;
            this.al[i * 2] = a; this.al[i * 2 + 1] = a;
        }
        this.geo.setDrawRange(0, (n - 1) * 6);
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aA.needsUpdate = true;
    }
}
