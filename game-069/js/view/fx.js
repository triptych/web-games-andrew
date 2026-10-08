/**
 * fx.js — particles, tyre marks and weather.
 *
 *   Particles  two pooled point systems: "soft" (dust, mud, spray, smoke; normal blending) and
 *              "glow" (sparks, nitro, coin sparkles, fireworks; additive). Sprites are sized from
 *              the drawing buffer and the camera's field of view and capped at 30% of the screen,
 *              and fade out near the lens, so nothing ever fills the view (game-066's lesson).
 *   Skids      a ring buffer of dark quads laid behind sliding rear wheels.
 *   Weather    snow, dust motes, pollen, fireflies or confetti in a box that travels with the
 *              camera; motion is computed in the vertex shader.
 */

import * as THREE from 'three';
import { softDot } from './textures.js';

const VS = `
    attribute float aSize; attribute float aAlpha; attribute vec3 aCol;
    uniform float uScale; uniform float uMax;
    varying float vA; varying vec3 vC;
    void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(0.1, -mv.z);
        gl_PointSize = min(uMax, aSize * uScale / d);
        vA = aAlpha * smoothstep(0.6, 3.0, d);
        vC = aCol;
        gl_Position = projectionMatrix * mv;
    }`;
const FS = `
    uniform sampler2D uTex; varying float vA; varying vec3 vC;
    void main(){
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vC, t.a * vA);
        if (gl_FragColor.a < 0.004) discard;
    }`;

class Pool {
    constructor(scene, n, additive) {
        this.n = n;
        this.pos = new Float32Array(n * 3);
        this.col = new Float32Array(n * 3);
        this.size = new Float32Array(n);
        this.alpha = new Float32Array(n);
        this.vel = new Float32Array(n * 3);
        this.life = new Float32Array(n);
        this.max = new Float32Array(n);
        this.grow = new Float32Array(n);
        this.grav = new Float32Array(n);
        this.drag = new Float32Array(n);
        this.a0 = new Float32Array(n);
        this.next = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        this.uniforms = { uTex: { value: softDot() }, uScale: { value: 400 }, uMax: { value: 200 } };
        this.mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 6 : 5;
        this.geo = g;
        scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, col, size, life, { grow = 1.5, grav = 0, drag = 1.5, alpha = 0.8 } = {}) {
        const i = this.next;
        this.next = (this.next + 1) % this.n;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.col[i * 3] = col.r; this.col[i * 3 + 1] = col.g; this.col[i * 3 + 2] = col.b;
        this.size[i] = size; this.life[i] = life; this.max[i] = life;
        this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = alpha;
        this.alpha[i] = alpha;
    }
    update(dt) {
        const { pos, vel, life, max, size, alpha, grow, grav, drag, a0 } = this;
        for (let i = 0; i < this.n; i++) {
            if (life[i] <= 0) { if (alpha[i] !== 0) alpha[i] = 0; continue; }
            life[i] -= dt;
            const k = Math.exp(-drag[i] * dt);
            vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt; vel[i * 3 + 2] *= k;
            pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            size[i] += grow[i] * dt;
            const f = life[i] / max[i];
            alpha[i] = a0[i] * Math.min(1, f * 2.2) * Math.min(1, (1 - f) * 8 + 0.2);
        }
        for (const k of ['position', 'aCol', 'aSize', 'aAlpha']) this.geo.attributes[k].needsUpdate = true;
    }
    dispose(scene) { scene.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

// Dust colours by surface (multiplied by the environment's tint where it makes sense).
const SURF_COL = {
    dirt: 0xc9a476, clay: 0xb07a52, loam: 0x7a6248, redclay: 0xd4865a, swamp: 0x6a5a3a, pack: 0xf4f8ff,
    mud: 0x4a3420, water: 0xdfeef0, gravel: 0xb8b0a0, sand: 0xe8cc96, ice: 0xe8f6ff, grass: 0x8a9a5a,
    snow: 0xffffff, rock: 0xa09080, bog: 0x4a4a2a, plank: 0x9a7a5a, asphalt: 0x8a8a8a, oil: 0x2a2a30,
};

export class FX {
    constructor(scene, quality = 0) {
        this.scene = scene;
        this.q = quality;
        const n = quality >= 2 ? 900 : quality === 1 ? 1600 : 2600;
        this.soft = new Pool(scene, n, false);
        this.glow = new Pool(scene, Math.round(n * 0.6), true);
        this.c = new THREE.Color();
        this.buildSkids();
        this.weather = null;
    }

    /** Keep sprite sizes in screen terms: call on resize and when the FOV changes. */
    setView(renderer, camera) {
        const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
        const scale = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
        for (const p of [this.soft, this.glow]) { p.uniforms.uScale.value = scale; p.uniforms.uMax.value = h * 0.3; }
        if (this.weather) { this.weather.material.uniforms.uScale.value = scale; this.weather.material.uniforms.uMax.value = h * 0.05; }
    }

    // ------------------------------------------------------------ emitters
    /** Dust or spray from a wheel. amount 0..1 scales size and opacity. */
    wheel(x, y, z, vx, vz, surface, amount, envDust) {
        const base = SURF_COL[surface] ?? envDust ?? 0xc9a476;
        this.c.setHex(base);
        const r = Math.random;
        const wet = surface === 'water' || surface === 'mud' || surface === 'bog';
        if (wet) {
            this.soft.spawn(x, y + 0.2, z, vx * 0.2 + (r() - 0.5) * 3, 2 + r() * 4 * amount, vz * 0.2 + (r() - 0.5) * 3, this.c, 0.25 + r() * 0.3, 0.6 + r() * 0.3, { grow: 0.4, grav: 14, drag: 0.6, alpha: 0.9 });
        } else {
            // Particles are unlit, so darken them to sit with the lit ground around them.
            this.c.multiplyScalar(0.72);
            this.soft.spawn(x + (r() - 0.5) * 0.4, y + 0.2, z + (r() - 0.5) * 0.4, vx * 0.15 + (r() - 0.5) * 1.5, 0.4 + r() * 1.0, vz * 0.15 + (r() - 0.5) * 1.5, this.c, 0.4 + amount * 0.6, 0.7 + r() * 0.9 * amount, { grow: 1.0 + amount * 1.4, grav: -0.1, drag: 1.6, alpha: 0.16 + amount * 0.2 });
        }
    }
    burst(x, y, z, hex, n = 20, speed = 5, size = 0.9, life = 1.2) {
        this.c.setHex(hex).multiplyScalar(0.75);
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
            this.soft.spawn(x, y + 0.3, z, Math.cos(a) * s, 0.8 + Math.random() * speed * 0.4, Math.sin(a) * s, this.c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), { grow: 2.4, grav: 1, drag: 2.2, alpha: 0.5 });
        }
    }
    splash(x, y, z, hex, vx = 0, vz = 0) {
        this.c.setHex(hex);
        for (let k = 0; k < 26; k++) {
            const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
            this.soft.spawn(x, y + 0.2, z, Math.cos(a) * s + vx * 0.4, 3 + Math.random() * 6, Math.sin(a) * s + vz * 0.4, this.c, 0.3 + Math.random() * 0.4, 0.7 + Math.random() * 0.5, { grow: 0.6, grav: 16, drag: 0.4, alpha: 0.9 });
        }
    }
    sparks(x, y, z, n = 14) {
        for (let k = 0; k < n; k++) {
            this.c.setHSL(0.08 + Math.random() * 0.06, 1, 0.6);
            this.glow.spawn(x, y, z, (Math.random() - 0.5) * 9, 1 + Math.random() * 5, (Math.random() - 0.5) * 9, this.c, 0.12 + Math.random() * 0.12, 0.3 + Math.random() * 0.4, { grow: -0.1, grav: 14, drag: 1, alpha: 1 });
        }
    }
    nitro(x, y, z, vx, vz) {
        this.c.setHex(Math.random() < 0.5 ? 0x5ac8ff : 0xb8f0ff);
        this.glow.spawn(x, y, z, vx * 0.6 + (Math.random() - 0.5), Math.random() * 0.5, vz * 0.6 + (Math.random() - 0.5), this.c, 0.4 + Math.random() * 0.3, 0.18 + Math.random() * 0.12, { grow: -0.8, drag: 4, alpha: 0.9 });
    }
    sparkle(x, y, z, hex = 0xffd84a, n = 12) {
        this.c.setHex(hex);
        for (let k = 0; k < n; k++) this.glow.spawn(x, y, z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, this.c, 0.25 + Math.random() * 0.2, 0.4 + Math.random() * 0.4, { grow: -0.2, grav: 4, drag: 2, alpha: 1 });
    }
    confetti(x, y, z, n = 80) {
        for (let k = 0; k < n; k++) {
            this.c.setHSL(Math.random(), 0.9, 0.6);
            this.glow.spawn(x + (Math.random() - 0.5) * 6, y + Math.random() * 2, z + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8, 6 + Math.random() * 8, (Math.random() - 0.5) * 8, this.c, 0.18 + Math.random() * 0.15, 2 + Math.random() * 2, { grow: 0, grav: 5, drag: 1.2, alpha: 1 });
        }
    }
    firework(x, y, z) {
        const hue = Math.random();
        for (let k = 0; k < 70; k++) {
            this.c.setHSL((hue + Math.random() * 0.12) % 1, 1, 0.6);
            const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = 9 + Math.random() * 6;
            this.glow.spawn(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, this.c, 0.9, 1.4 + Math.random() * 0.8, { grow: -0.3, grav: 4, drag: 1.4, alpha: 1 });
        }
    }

    // ------------------------------------------------------------ skid marks
    buildSkids() {
        const n = this.q >= 2 ? 1200 : 3000;
        this.skN = n;
        this.skPos = new Float32Array(n * 4 * 3);
        this.skA = new Float32Array(n * 4);
        const idx = new Uint32Array(n * 6);
        for (let k = 0; k < n; k++) { const a = k * 4; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k * 6); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.skPos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aA', new THREE.BufferAttribute(this.skA, 1).setUsage(THREE.DynamicDrawUsage));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        this.skMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: true,
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: new THREE.Color(0x1a120a) } }]),
            vertexShader: `attribute float aA; varying float vA;
                #include <fog_pars_vertex>
                void main(){ vA = aA; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
                }`,
            fragmentShader: `uniform vec3 uCol; varying float vA;
                #include <fog_pars_fragment>
                void main(){ gl_FragColor = vec4(uCol, vA);
                #include <fog_fragment>
                }`,
        });
        this.skids = new THREE.Mesh(g, this.skMat);
        this.skids.frustumCulled = false;
        this.skids.renderOrder = 2;
        this.scene.add(this.skids);
        this.skNext = 0;
        this.skLast = new Map();
    }
    setSkidColor(hex) { this.skMat.uniforms.uCol.value.setHex(hex); }

    /** Lay (or lift) a tyre mark for wheel `key` at (x, y, z), heading h. */
    skid(key, x, y, z, h, on, strength = 0.5) {
        const last = this.skLast.get(key);
        if (!on) { if (last) this.skLast.delete(key); return; }
        const w = 0.16, rx = -Math.cos(h) * w, rz = Math.sin(h) * w;
        const cur = { lx: x - rx, lz: z - rz, rxp: x + rx, rzp: z + rz, y: y + 0.07 };
        if (last) {
            const d = Math.hypot(x - last.x, z - last.z);
            if (d < 0.5) return;
            if (d < 4) {
                const k = this.skNext;
                this.skNext = (this.skNext + 1) % this.skN;
                const P = this.skPos, o = k * 12;
                P[o] = last.c.lx; P[o + 1] = last.c.y; P[o + 2] = last.c.lz;
                P[o + 3] = last.c.rxp; P[o + 4] = last.c.y; P[o + 5] = last.c.rzp;
                P[o + 6] = cur.lx; P[o + 7] = cur.y; P[o + 8] = cur.lz;
                P[o + 9] = cur.rxp; P[o + 10] = cur.y; P[o + 11] = cur.rzp;
                const a = Math.min(0.55, 0.15 + strength * 0.5);
                this.skA.fill(a, k * 4, k * 4 + 4);
                this.skids.geometry.attributes.position.needsUpdate = true;
                this.skids.geometry.attributes.aA.needsUpdate = true;
            }
        }
        this.skLast.set(key, { x, z, c: cur });
    }
    clearSkids() { this.skA.fill(0); this.skids.geometry.attributes.aA.needsUpdate = true; this.skLast.clear(); }

    // ------------------------------------------------------------ weather
    setWeather(kind) {
        if (this.weather) { this.scene.remove(this.weather); this.weather.geometry.dispose(); this.weather.material.dispose(); this.weather = null; }
        if (!kind) return;
        const n = this.q >= 2 ? 300 : this.q === 1 ? 600 : 1100;
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        for (let i = 0; i < n; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); seed[i] = Math.random(); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        const cfg = {
            snow: { col: 0xffffff, size: 0.12, fall: 2.2, sway: 0.8, box: 70, add: false, alpha: 0.9 },
            dust: { col: 0xffe0b0, size: 0.07, fall: -0.1, sway: 0.6, box: 50, add: false, alpha: 0.45 },
            pollen: { col: 0xfff6c8, size: 0.06, fall: 0.2, sway: 0.5, box: 45, add: true, alpha: 0.5 },
            fireflies: { col: 0xd8ff6a, size: 0.16, fall: 0, sway: 1.2, box: 70, add: true, alpha: 1, blink: 1 },
            confetti: { col: 0xffffff, size: 0.1, fall: 1.2, sway: 1, box: 80, add: true, alpha: 0.7, rainbow: 1 },
        }[kind];
        if (!cfg) return;
        const m = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: cfg.add ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: {
                uTex: { value: softDot() }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: cfg.box },
                uFall: { value: cfg.fall }, uSway: { value: cfg.sway }, uSize: { value: cfg.size }, uScale: { value: 400 }, uMax: { value: 40 },
                uCol: { value: new THREE.Color(cfg.col) }, uAlpha: { value: cfg.alpha }, uBlink: { value: cfg.blink || 0 }, uRainbow: { value: cfg.rainbow || 0 },
            },
            vertexShader: `attribute float aSeed; uniform float uTime, uBox, uFall, uSway, uSize, uScale, uMax, uBlink; uniform vec3 uCam;
                varying float vA; varying float vS;
                void main(){
                    vec3 p = position * uBox;
                    p.y -= uTime * uFall * (0.6 + aSeed * 0.8);
                    p.x += sin(uTime * 0.7 + aSeed * 40.0) * uSway;
                    p.z += cos(uTime * 0.5 + aSeed * 30.0) * uSway;
                    vec3 o = uCam - vec3(uBox * 0.5);
                    p = mod(p - o, uBox) + o;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    float d = max(0.1, -mv.z);
                    gl_PointSize = min(uMax, uSize * uScale / d);
                    vA = smoothstep(uBox * 0.5, uBox * 0.3, d) * smoothstep(0.5, 2.0, d);
                    if (uBlink > 0.5) vA *= 0.3 + 0.7 * pow(abs(sin(uTime * (1.0 + aSeed) + aSeed * 20.0)), 6.0);
                    vS = aSeed;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `uniform sampler2D uTex; uniform vec3 uCol; uniform float uAlpha, uRainbow; varying float vA; varying float vS;
                void main(){
                    vec4 t = texture2D(uTex, gl_PointCoord);
                    vec3 c = uCol;
                    if (uRainbow > 0.5) c = 0.5 + 0.5 * cos(6.2831 * (vS + vec3(0.0, 0.33, 0.67)));
                    gl_FragColor = vec4(c, t.a * vA * uAlpha);
                }`,
        });
        this.weather = new THREE.Points(g, m);
        this.weather.frustumCulled = false;
        this.weather.renderOrder = 7;
        this.scene.add(this.weather);
    }

    update(dt, t, camera) {
        this.soft.update(dt);
        this.glow.update(dt);
        if (this.weather) {
            this.weather.material.uniforms.uTime.value = t;
            this.weather.material.uniforms.uCam.value.copy(camera.position);
        }
    }

    dispose() {
        this.soft.dispose(this.scene);
        this.glow.dispose(this.scene);
        this.scene.remove(this.skids);
        this.skids.geometry.dispose();
        this.skMat.dispose();
        this.setWeather(null);
    }
}
