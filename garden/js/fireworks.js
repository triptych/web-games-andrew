// Midnight fireworks: a short show in the sky ahead of the player when the
// garden's clock rolls past 00:00. Stars are a ring buffer of points flown
// entirely on the GPU (ballistic, with air drag); rockets are stepped on the
// CPU so they can drop a trail of embers. Every launch, boom and crackle
// reaches the ear late, by the distance over the speed of sound.

import * as THREE from 'three';
import { TAU, clamp } from './util.js';
import { glowSprite } from './textures.js';

const SOUND = 343;        // metres a second
const GRAVITY = 9.8;
const SHOW_DIST = 210;    // how far ahead of the player the show is set
const COLORS = ['#ff4a5a', '#ffb02e', '#ffe46b', '#7dff8a', '#4ad8ff', '#5a7bff', '#c46bff', '#ff7ad9'];
const GOLD = '#ffc46b', SILVER = '#e8f0ff';
const TYPES = ['peony', 'peony', 'double', 'ring', 'willow', 'crackle', 'glitter'];

const vert = /* glsl */ `
uniform float uTime, uScale;
attribute vec3 aColor;
attribute vec3 aVel;
attribute vec4 aParams; // size, birth, life, drag
attribute float aKind;  // 0 star, 1 ember, 2 strobe
varying vec3 vColor;
varying float vAlpha;
void main(){
  float age = uTime - aParams.y;
  float k = age / aParams.z;
  vec3 p = position;
  float a = 0.0, size = aParams.x;
  vColor = aColor;
  if (k > 0.0 && k < 1.0) {
    // linear drag: the burst slows to a drift and gravity takes over
    float d = aParams.w;
    float e = (1.0 - exp(-d * age)) / d;
    p += aVel * e - vec3(0.0, ${GRAVITY.toFixed(1)}, 0.0) * (age - e) / d;
    if (aKind < 0.5) {
      a = (1.0 - k * k) * (1.0 + 2.5 * exp(-age * 6.0));   // a hot flash, then a slow fade
      vColor = mix(aColor, vec3(1.0, 0.42, 0.12), smoothstep(0.6, 1.0, k));
    } else if (aKind < 1.5) {
      a = (1.0 - k) * 0.9;
    } else {
      a = step(0.5, fract(age * 13.0 + aParams.y * 37.0)) * (1.0 - k) * 3.0;
    }
    size *= 1.0 - 0.45 * k;
  }
  vAlpha = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = a > 0.0 ? size * uScale / -mv.z : 0.0;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 c = texture2D(uMap, gl_PointCoord);
  if (vAlpha * c.a < 0.01) discard;
  gl_FragColor = vec4(vColor * c.rgb * vAlpha * c.a, 1.0);
  #include <colorspace_fragment>
}`;

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const range = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3();

function randomDir(out) {
    const z = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - z * z);
    return out.set(Math.cos(a) * r, z, Math.sin(a) * r);
}

/** Where a point launched from `p` at `v` is after `age` seconds (the shader's flight, on the CPU). */
function fly(out, p, v, drag, age) {
    const e = (1 - Math.exp(-drag * age)) / drag;
    out.copy(p).addScaledVector(v, e);
    out.y -= GRAVITY * (age - e) / drag;
    return out;
}

export class Fireworks {
    constructor(world, camera, audio, size = 4096) {
        this.camera = camera;
        this.audio = audio;
        this.size = size;
        this.density = clamp(size / 4096, 0.4, 1);
        this.cursor = 0;
        this.time = 0;
        this.dirty = false;
        this.queue = [];
        this.rockets = [];
        this.center = new THREE.Vector3();
        this.fwd = new THREE.Vector3();
        this.side = new THREE.Vector3();
        this.glow = 0;
        this.glowColor = new THREE.Color();
        this._c = new THREE.Color();

        this.uniforms = { uTime: { value: 0 }, uScale: { value: 400 }, uMap: { value: glowSprite() } };
        const g = new THREE.BufferGeometry();
        const params = new Float32Array(size * 4);
        for (let i = 0; i < size; i++) params[i * 4 + 1] = -1e4; // long dead
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        g.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        g.setAttribute('aParams', new THREE.BufferAttribute(params, 4));
        g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(size), 1));
        this.geo = g;
        const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 6;
        world.root.add(this.points);
    }

    get active() {
        return this.queue.length > 0 || this.rockets.length > 0;
    }

    /** Plans a show of about twenty-five seconds, set out ahead of the camera. */
    start() {
        const cam = this.camera.position;
        this.camera.getWorldDirection(this.fwd).setY(0);
        if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
        this.fwd.normalize();
        this.side.set(-this.fwd.z, 0, this.fwd.x);
        this.center.set(cam.x + this.fwd.x * SHOW_DIST, 0, cam.z + this.fwd.z * SHOW_DIST);
        const q = [];
        let at = 0.5;
        for (let i = 0; i < 8; i++) {                 // the opening: one shell at a time
            q.push({ at, finale: false });
            at += range(1.0, 1.6);
        }
        for (let i = 0; i < 6; i++) {                 // then in pairs
            q.push({ at, finale: false }, { at: at + range(0.15, 0.45), finale: false });
            at += range(1.3, 1.8);
        }
        at += 0.8;
        for (let i = 0; i < 12; i++) {                // and a finale volley
            q.push({ at, finale: true });
            at += range(0.1, 0.28);
        }
        this.queue = q.map((s) => ({ ...s, at: this.time + s.at }));
    }

    stop() {
        this.queue.length = 0;
        this.rockets.length = 0;
    }

    emit(x, y, z, { vx = 0, vy = 0, vz = 0, color = '#ffffff', size = 1, delay = 0, life = 2, drag = 1.4, kind = 0 } = {}) {
        const i = this.cursor;
        this.cursor = (i + 1) % this.size;
        const a = this.geo.attributes;
        a.position.setXYZ(i, x, y, z);
        a.aVel.setXYZ(i, vx, vy, vz);
        const c = this._c.set(color);
        a.aColor.setXYZ(i, c.r, c.g, c.b);
        a.aParams.setXYZW(i, size, this.time + delay, life, drag);
        a.aKind.setX(i, kind);
        this.dirty = true;
    }

    /** Distance, stereo pan and loudness of a point as heard from the camera. */
    _ear(p) {
        const cam = this.camera.position;
        _d.subVectors(p, cam);
        const dist = _d.length();
        _r.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
        return { delay: dist / SOUND, pan: clamp(_r.dot(_d) / Math.max(dist, 1), -1, 1) * 0.8, near: clamp(140 / dist, 0.25, 1) };
    }

    _launch(finale) {
        const lat = range(-1, 1) * (finale ? 70 : 55), dep = range(-25, 25);
        const from = new THREE.Vector3(
            this.center.x + this.side.x * lat + this.fwd.x * dep, 1,
            this.center.z + this.side.z * lat + this.fwd.z * dep);
        const to = new THREE.Vector3(from.x + range(-8, 8), range(50, 80), from.z + range(-8, 8));
        const rise = range(1.6, 2.3);
        const type = finale ? pick(['peony', 'peony', 'crackle', 'glitter', 'double']) : pick(TYPES);
        this.rockets.push({ from, to, rise, age: 0, trail: 0, type, finale, pos: from.clone() });
        const ear = this._ear(from);
        this.audio.fireworkLaunch({ ...ear, rise, whistle: !finale && Math.random() < 0.35 });
    }

    _burst(r) {
        const p = r.to, n = Math.round((r.finale ? 90 : 120) * this.density);
        const color = pick(COLORS);
        let color2 = pick(COLORS);
        if (color2 === color) color2 = SILVER;
        const star = (dir, speed, opts) => this.emit(p.x, p.y, p.z, { vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed, ...opts });
        let crackle = null;
        if (r.type === 'ring') {
            // a flat hoop on a tilted plane, with a small heart of the second colour
            const nrm = randomDir(new THREE.Vector3());
            const a = new THREE.Vector3().crossVectors(nrm, Math.abs(nrm.y) < 0.9 ? _v.set(0, 1, 0) : _v.set(1, 0, 0)).normalize();
            const b = new THREE.Vector3().crossVectors(nrm, a);
            for (let i = 0; i < n; i++) {
                const t = (i / n) * TAU;
                star(_d.copy(a).multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t)), 38, { color, size: 1.7, life: range(1.6, 2.0), drag: 1.5 });
            }
            for (let i = 0; i < n / 4; i++) star(randomDir(_d), range(6, 10), { color: color2, size: 1.5, life: range(1.2, 1.6), drag: 1.5 });
        } else if (r.type === 'willow') {
            // long-burning gold that weeps down the sky
            for (let i = 0; i < n * 0.8; i++) star(randomDir(_d), range(21, 26), { color: GOLD, size: 1.4, life: range(3.2, 4.2), drag: 0.9, kind: 1 });
        } else if (r.type === 'glitter') {
            for (let i = 0; i < n; i++) star(randomDir(_d), range(28, 34), { color: SILVER, size: 1.5, life: range(1.8, 2.4), drag: 1.3, kind: 2 });
        } else {
            const crackles = r.type === 'crackle';
            const c1 = crackles ? GOLD : color;
            for (let i = 0; i < n; i++) {
                randomDir(_d);
                star(_d, range(32, 37), { color: r.type === 'peony' && i % 2 ? color2 : c1, size: 1.7, life: crackles ? range(1.1, 1.3) : range(1.6, 2.2), drag: 1.4 });
            }
            if (r.type === 'double') for (let i = 0; i < n / 2; i++) star(randomDir(_d), range(14, 17), { color: color2, size: 1.5, life: range(1.4, 1.8), drag: 1.4 });
            if (crackles) {
                // each star splits into a scatter of white pops as it burns out
                crackle = { at: 1.0, dur: 0.7 };
                const v = new THREE.Vector3();
                for (let i = 0; i < n * 0.9; i++) {
                    const age = crackle.at + Math.random() * crackle.dur;
                    fly(_v, p, v.copy(randomDir(_d)).multiplyScalar(range(32, 37)), 1.4, age);
                    this.emit(_v.x, _v.y, _v.z, { color: '#fffbe8', size: 1.3, delay: age, life: range(0.12, 0.25), drag: 3, kind: 2 });
                }
            }
        }
        this.glow = Math.min(1.6, this.glow + (r.finale ? 0.5 : 0.8));
        this.glowColor.set(r.type === 'willow' || r.type === 'crackle' ? GOLD : color);
        this.audio.fireworkBoom({ ...this._ear(p), size: r.finale ? 1.2 : 1, crackle });
    }

    /** Launches what is due, flies the rockets and bursts them at the top of their climb. */
    update(dt, viewportH) {
        this.time += dt;
        while (this.queue.length && this.queue[0].at <= this.time) this._launch(this.queue.shift().finale);
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.age += dt;
            const u = Math.min(1, r.age / r.rise);
            r.pos.lerpVectors(r.from, r.to, 1 - (1 - u) * (1 - u));
            // the climbing shell and the sparks it sheds
            this.emit(r.pos.x, r.pos.y, r.pos.z, { color: '#ffe2a8', size: 1.1, life: 0.1, kind: 1 });
            r.trail += dt * 70;
            for (; r.trail >= 1; r.trail--) {
                this.emit(r.pos.x + range(-0.3, 0.3), r.pos.y, r.pos.z + range(-0.3, 0.3), { vx: range(-1.5, 1.5), vy: range(-3, 0), vz: range(-1.5, 1.5), color: '#ffb35a', size: 0.55, life: range(0.4, 0.8), drag: 2.5, kind: 1 });
            }
            if (u >= 1) {
                this._burst(r);
                this.rockets.splice(i, 1);
            }
        }
        if (this.dirty) {
            for (const k of ['position', 'aVel', 'aColor', 'aParams', 'aKind']) this.geo.attributes[k].needsUpdate = true;
            this.dirty = false;
        }
        this.uniforms.uTime.value = this.time;
        this.uniforms.uScale.value = viewportH * 0.9;
        this.glow *= Math.exp(-dt * 3.5);
    }

    /** Washes the island in the colour of the last burst. */
    light(hemi) {
        if (this.glow < 0.01) return;
        hemi.color.lerp(this.glowColor, Math.min(1, this.glow) * 0.45);
        hemi.intensity += this.glow * 0.9;
    }
}
