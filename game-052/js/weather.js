// Rain, lightning and steam.
//
// Rain is a few thousand line segments whose positions are computed entirely
// in the vertex shader, wrapped into a box that follows the camera, and
// stretched along their velocity relative to the camera — so at speed the
// streaks rake toward you. Intensity drifts between drizzle and downpour.

import * as THREE from 'three';
import { U } from './materials.js';
import { LAYER_NO_REFLECT } from './city.js';
import { mulberry32, clamp } from './rng.js';

const DROPS = 4500;
const BOX = new THREE.Vector3(50, 36, 50);

export class Weather {
    constructor(scene, M, tex, seed) {
        this.rand = mulberry32(seed ^ 0x4a17);
        this.rain = 0.7;
        this.target = 0.7;
        this.nextChange = 50;
        this.flash = 0;
        this.flashQueue = [];
        this.events = [];
        this.lock = null;           // force a rain level (settings)

        const pos = new Float32Array(DROPS * 2 * 3);
        const end = new Float32Array(DROPS * 2);
        const rnd = new Float32Array(DROPS * 2);
        const r = this.rand;
        for (let i = 0; i < DROPS; i++) {
            const x = r() * BOX.x, y = r() * BOX.y, z = r() * BOX.z, q = r();
            for (let k = 0; k < 2; k++) {
                const j = i * 2 + k;
                pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z;
                end[j] = k;
                rnd[j] = q;
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
        g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
        this.uniforms = {
            uRainTime: { value: 0 },
            uCam: { value: new THREE.Vector3() },
            uBox: { value: BOX },
            uFall: { value: new THREE.Vector3(2, -18, 0) },
            uStreak: { value: new THREE.Vector3() },
            uAmount: { value: 0.7 },
            uColor: { value: new THREE.Color(0.55, 0.62, 0.8) },
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: /* glsl */`
                attribute float aEnd;
                attribute float aRand;
                uniform float uRainTime, uAmount;
                uniform vec3 uCam, uBox, uFall, uStreak;
                varying float vA;
                void main() {
                    vec3 p = position + uFall * uRainTime;
                    p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
                    p += uStreak * aEnd;
                    vec4 mv = viewMatrix * vec4(p, 1.0);
                    float d = length(mv.xyz);
                    vA = (1.0 - aEnd * 0.85) * (1.0 - smoothstep(8.0, 24.0, d)) * smoothstep(0.8, 2.5, d);
                    gl_Position = projectionMatrix * mv;
                    if (aRand > uAmount) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uColor;
                varying float vA;
                void main() { gl_FragColor = vec4(uColor * vA * 0.55, 1.0); }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.lines = new THREE.LineSegments(g, mat);
        this.lines.frustumCulled = false;
        this.lines.layers.set(LAYER_NO_REFLECT);
        this.lines.renderOrder = 5;
        scene.add(this.lines);

        // steam puffs
        this.puffs = [];
        for (let i = 0; i < 48; i++) {
            const m = new THREE.SpriteMaterial({ map: tex.steam, transparent: true, depthWrite: false, opacity: 0, color: 0xb8b0c8 });
            const sp = new THREE.Sprite(m);
            sp.visible = false;
            sp.layers.set(LAYER_NO_REFLECT);
            scene.add(sp);
            this.puffs.push({ sp, life: 0, max: 1, vx: 0, vz: 0 });
        }
        this._emit = 0;
        this._prevCam = new THREE.Vector3();
    }

    setLock(v) { this.lock = v; }

    update(dt, time, cam, vents) {
        const r = this.rand;
        // --- intensity drift ---
        this.nextChange -= dt;
        if (this.nextChange <= 0) {
            const opts = [0, 0.2, 0.45, 0.7, 0.85, 1.0];
            this.target = opts[Math.floor(r() * opts.length)];
            this.nextChange = 45 + r() * 70;
        }
        const goal = this.lock !== null ? this.lock : this.target;
        this.rain += clamp(goal - this.rain, -dt * 0.05, dt * 0.05);
        U.uWet.value += (Math.max(0.55, this.rain) - U.uWet.value) * Math.min(1, dt * 0.05);

        // --- lightning: a double flicker, thunder a few seconds later ---
        if (this.rain > 0.6 && r() < dt / 28) {
            const t0 = time;
            this.flashQueue.push([t0, 0.9], [t0 + 0.09, 0.2], [t0 + 0.16, 1.0]);
            this.events.push({ type: 'thunder', delay: 1 + r() * 3.5, power: 0.6 + r() * 0.4 });
        }
        let f = this.flash * Math.exp(-dt * 9);
        while (this.flashQueue.length && this.flashQueue[0][0] <= time) f = Math.max(f, this.flashQueue.shift()[1]);
        this.flash = f;
        U.uFlash.value = f;

        // --- rain ---
        const u = this.uniforms;
        u.uRainTime.value = time % 1000;
        u.uCam.value.copy(cam);
        u.uAmount.value = this.rain;
        const vel = cam.clone().sub(this._prevCam).divideScalar(Math.max(dt, 1e-3));
        if (vel.lengthSq() > 80 * 80) vel.set(0, 0, 0);       // camera cut
        this._prevCam.copy(cam);
        u.uStreak.value.copy(u.uFall.value).sub(vel).multiplyScalar(-0.035);
        this.lines.visible = this.rain > 0.02;

        // --- steam ---
        this._emit += dt;
        if (this._emit > 0.12) {
            this._emit = 0;
            for (const v of vents) {
                if (r() > v.rate * 0.25) continue;
                const p = this.puffs.find((q) => q.life <= 0);
                if (!p) break;
                p.life = p.max = 3 + r() * 2.5;
                p.sp.position.set(v.x + (r() - 0.5), v.y + 0.2, v.z + (r() - 0.5));
                p.vx = (r() - 0.5) * 0.4 + 0.3; p.vz = (r() - 0.5) * 0.4;
                p.sp.visible = true;
            }
        }
        for (const p of this.puffs) {
            if (p.life <= 0) continue;
            p.life -= dt;
            const t = 1 - p.life / p.max;
            p.sp.position.x += p.vx * dt;
            p.sp.position.z += p.vz * dt;
            p.sp.position.y += (1.4 - t * 0.6) * dt;
            const s = 1.2 + t * 5;
            p.sp.scale.set(s, s, 1);
            p.sp.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.3)) * 0.5;
            p.sp.material.rotation = t * 0.6;
            if (p.life <= 0) p.sp.visible = false;
        }
    }

    takeEvents() { const e = this.events; this.events = []; return e; }
}
