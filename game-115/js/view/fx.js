// Little effects: chips and sparkles and smoke as two instanced quad batches, rain and snow around
// the camera, fireflies at dusk, and the floating "+3 wood" text (DOM, pooled).

import * as THREE from 'three';
import { LEAN } from './stage.js';

const MAXP = 700;

const VERT = /* glsl */`
    attribute vec4 aColor; attribute float aHard;
    varying vec4 vColor; varying vec2 vUv; varying float vHard;
    void main(){ vColor = aColor; vUv = uv; vHard = aHard; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
    uniform vec3 uLight; uniform float uLit;
    varying vec4 vColor; varying vec2 vUv; varying float vHard;
    void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(mix(0.2, 0.9, vHard), 1.0, d);
        if (a <= 0.01) discard;
        vec3 col = vColor.rgb * mix(vec3(1.0), uLight, uLit);
        gl_FragColor = vec4(col, a * vColor.a);
        #include <colorspace_fragment>
    }`;

function batch(shared, additive, lit) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uLight: shared.uLight, uLit: { value: lit } },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, MAXP);
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4));
    geo.setAttribute('aHard', new THREE.InstancedBufferAttribute(new Float32Array(MAXP), 1));
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = 10;
    return mesh;
}

export class Fx {
    constructor(stage, floaterEl) {
        this.stage = stage;
        this.soft = batch(stage.shared, false, 1);
        this.glow = batch(stage.shared, true, 0);
        this.group = new THREE.Group();
        this.group.add(this.soft, this.glow);
        this.parts = [];
        this.dummy = new THREE.Object3D();
        this.col = new THREE.Color();
        this.floaterEl = floaterEl;
        this.floaters = [];
        this.pool = [];
        this.weather = null;
        this.rain = this.makeStreaks();
        this.group.add(this.rain.mesh);
        this.fly = [];
        this.tmp = {};
    }

    // ---------------------------------------------------------------- particles
    spawn(p) {
        if (this.parts.length >= MAXP) this.parts.shift();
        this.parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, age: 0, s0: 0.2, s1: 0.2, c0: [1, 1, 1], c1: null, a0: 1, a1: 0, g: 0, drag: 0, layer: 0, hard: 0.2, ...p });
    }

    burst(x, y, z, o = {}) {
        const n = o.n ?? 8;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
            this.spawn({
                x: x + (Math.random() - 0.5) * (o.spread ?? 0.1), y, z: z + (Math.random() - 0.5) * (o.spread ?? 0.1),
                vx: Math.cos(a) * sp, vy: (o.up ?? 2.4) * (0.5 + Math.random()), vz: Math.sin(a) * sp * 0.6,
                life: (o.life ?? 0.7) * (0.7 + Math.random() * 0.6), s0: o.size ?? 0.1, s1: (o.size ?? 0.1) * (o.shrink ?? 0.3), c0: o.color ?? [1, 0.9, 0.4], a0: 1, a1: 0, g: o.gravity ?? 7, drag: 1.2, layer: o.layer ?? 0, hard: o.hard ?? 0.6,
            });
        }
    }
    chips(x, z, kind) {
        const col = kind === 'tree' ? [[0.45, 0.32, 0.18], [0.3, 0.6, 0.25]] : kind === 'rock' ? [[0.62, 0.6, 0.56], [0.45, 0.43, 0.4]] : [[0.4, 0.7, 0.3], [0.8, 0.3, 0.4]];
        for (let i = 0; i < 7; i++) this.burst(x, 0.5, z, { n: 1, color: col[i % 2], size: 0.07, speed: 1.6, up: 2.2, life: 0.55, hard: 0.9 });
    }
    puff(x, y, z, o = {}) {
        this.spawn({ x, y, z, vx: 0.12 + Math.random() * 0.1, vy: 0.5 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.1, life: o.life ?? 2.6, s0: o.s0 ?? 0.16, s1: o.s1 ?? 0.55, c0: o.color ?? [0.9, 0.9, 0.92], a0: o.a ?? 0.45, a1: 0, drag: 0.4, hard: 0.0 });
    }
    sparkle(x, y, z, n = 10, color = [1, 0.9, 0.5]) {
        this.burst(x, y, z, { n, color, size: 0.09, speed: 1.6, up: 2.4, life: 0.9, gravity: 2, layer: 1, spread: 0.6, hard: 0.2 });
    }
    dust(x, z, n = 8) {
        this.burst(x, 0.1, z, { n, color: [0.78, 0.68, 0.52], size: 0.28, shrink: 2, speed: 1.1, up: 0.5, life: 0.8, gravity: -0.2, spread: 1.2, hard: 0.0 });
    }
    confetti(x, z, n = 40) {
        const cols = [[1, 0.4, 0.5], [1, 0.9, 0.3], [0.4, 0.8, 1], [0.5, 1, 0.5], [0.8, 0.5, 1]];
        for (let i = 0; i < n; i++) this.burst(x, 1.4, z, { n: 1, color: cols[i % 5], size: 0.1, speed: 2.4, up: 4.2, life: 1.8, gravity: 4, spread: 1.4, hard: 1 });
    }

    // ---------------------------------------------------------------- floating text
    floater(text, x, y, z, cls = '') {
        let el = this.pool.pop();
        if (!el) { el = document.createElement('div'); el.className = 'floater'; this.floaterEl.appendChild(el); }
        el.className = 'floater ' + cls;
        el.textContent = text;
        el.style.display = 'block';
        this.floaters.push({ el, x, y, z, age: 0, life: 1.6 });
        if (this.floaters.length > 40) this.recycle(this.floaters.shift());
    }
    recycle(f) { f.el.style.display = 'none'; this.pool.push(f.el); }

    // ---------------------------------------------------------------- weather
    makeStreaks() {
        const N = 260;
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.ShaderMaterial({
            uniforms: { uLight: this.stage.shared.uLight, uA: { value: 0.5 } },
            vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                uniform vec3 uLight; uniform float uA; varying vec2 vUv;
                void main(){
                    float a = (1.0 - abs(vUv.x - 0.5) * 2.0) * smoothstep(0.0, 0.3, vUv.y) * uA;
                    gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * uLight, a);
                    #include <colorspace_fragment>
                }`,
            transparent: true, depthWrite: false,
        });
        const mesh = new THREE.InstancedMesh(geo, mat, N);
        mesh.frustumCulled = false;
        mesh.renderOrder = 12;
        mesh.visible = false;
        const seeds = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random()]);
        return { mesh, seeds, N };
    }

    updateWeather(weather, cx, cz, dt, time) {
        const R = this.rain;
        const on = weather === 'rain' || weather === 'snow';
        R.mesh.visible = on;
        if (!on) return;
        const snow = weather === 'snow';
        R.mesh.material.uniforms.uA.value = snow ? 0.9 : 0.5;
        const d = this.dummy;
        const speed = snow ? 1.4 : 11;
        const span = 14;
        for (let i = 0; i < R.N; i++) {
            const [a, b, c] = R.seeds[i];
            const fall = ((time * speed * (0.8 + c * 0.4) + a * 20) % 12);
            const x = cx + (a - 0.5) * span * 2 + (snow ? Math.sin(time + b * 9) * 0.6 : fall * 0.12);
            const y = 12 - fall;
            const z = cz + (b - 0.5) * span;
            d.position.set(x, y, z);
            d.rotation.set(0, 0, snow ? 0 : 0.15);
            d.scale.set(snow ? 0.09 : 0.025, snow ? 0.09 : 0.5, 1);
            d.updateMatrix();
            R.mesh.setMatrixAt(i, d.matrix);
        }
        R.mesh.instanceMatrix.needsUpdate = true;
    }

    /** A few fireflies wandering over the grass at night. */
    updateFireflies(night, cx, cz, dt, time) {
        const want = night > 0.5 ? 14 : 0;
        while (this.fly.length < want) this.fly.push({ x: cx + (Math.random() - 0.5) * 16, z: cz + (Math.random() - 0.5) * 10, y: 0.4 + Math.random() * 0.8, p: Math.random() * 6 });
        if (this.fly.length > want) this.fly.length = want;
        for (const f of this.fly) {
            f.p += dt;
            f.x += Math.sin(f.p * 0.9 + f.z) * dt * 0.4; f.z += Math.cos(f.p * 0.7 + f.x) * dt * 0.3;
            if (Math.abs(f.x - cx) > 10) f.x = cx + (Math.random() - 0.5) * 10;
            if (Math.abs(f.z - cz) > 7) f.z = cz + (Math.random() - 0.5) * 8;
            const a = 0.4 + 0.6 * Math.max(0, Math.sin(f.p * 2.2));
            this.spawn({ x: f.x, y: f.y + Math.sin(f.p * 1.3) * 0.15, z: f.z, life: 0.12, s0: 0.12, s1: 0.1, c0: [1, 0.95, 0.5], a0: a, a1: a, layer: 1, hard: 0.1 });
        }
    }

    // ---------------------------------------------------------------- per frame
    update(dt) {
        const keep = [];
        for (const p of this.parts) {
            p.age += dt;
            if (p.age >= p.life) continue;
            p.vy -= p.g * dt;
            const k = Math.max(0, 1 - p.drag * dt);
            p.vx *= k; p.vz *= k;
            if (p.drag > 1) p.vy *= k;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < 0.02 && p.g > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
            keep.push(p);
        }
        this.parts = keep;
        const d = this.dummy;
        let ns = 0, ng = 0;
        for (const p of this.parts) {
            const t = p.age / p.life;
            const m = p.layer ? this.glow : this.soft;
            const i = p.layer ? ng++ : ns++;
            const s = p.s0 + (p.s1 - p.s0) * t;
            d.position.set(p.x, p.y, p.z);
            d.rotation.set(-LEAN, 0, 0);
            d.scale.set(s, s, 1);
            d.updateMatrix();
            m.setMatrixAt(i, d.matrix);
            const c1 = p.c1 || p.c0;
            const ca = m.geometry.attributes.aColor;
            ca.setXYZW(i, p.c0[0] + (c1[0] - p.c0[0]) * t, p.c0[1] + (c1[1] - p.c0[1]) * t, p.c0[2] + (c1[2] - p.c0[2]) * t, p.a0 + (p.a1 - p.a0) * t);
            m.geometry.attributes.aHard.setX(i, p.hard);
        }
        for (const [m, n] of [[this.soft, ns], [this.glow, ng]]) {
            m.count = n;
            m.instanceMatrix.needsUpdate = true;
            m.geometry.attributes.aColor.needsUpdate = true;
            m.geometry.attributes.aHard.needsUpdate = true;
        }
        // floaters
        const stage = this.stage;
        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.age += dt;
            if (f.age >= f.life) { this.recycle(f); this.floaters.splice(i, 1); continue; }
            const s = stage.project(f.x, f.y + f.age * 0.9, f.z, this.tmp);
            const a = f.age < 0.15 ? f.age / 0.15 : f.age > f.life - 0.5 ? (f.life - f.age) / 0.5 : 1;
            f.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
            f.el.style.opacity = s.vis ? a.toFixed(2) : '0';
        }
    }
}
