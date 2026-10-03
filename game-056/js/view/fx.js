/**
 * fx.js — particles, weather, projectile meshes, beams, rings, flash lights
 * and floating numbers.
 *
 * Particles live in two pooled Points systems (additive for fire, sparks and
 * magic; normal blending for smoke, dust and debris) updated on the CPU.
 * The light pool has a fixed size so the shader programs never recompile;
 * idle lights just sit at zero intensity.
 */

import * as THREE from 'three';
import { Parts, GLOW_MAT } from './models.js';
import { camera, worldToScreen } from './scene.js';

// ------------------------------------------------------------------ Particles

const PVS = /* glsl */`
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
    vColor = aColor;
}`;
const PFS = /* glsl */`
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = smoothstep(1.0, uSoft, r) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
}`;

class ParticleSystem {
    constructor(n, additive) {
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
        this.size0 = new Float32Array(n);
        this.a0 = new Float32Array(n);
        this.next = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200);
        this.mat = new THREE.ShaderMaterial({
            vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: { uScale: { value: 300 }, uSoft: { value: additive ? 0.0 : 0.5 } },
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 5 : 4;
        this.geo = g;
    }
    spawn(x, y, z, vx, vy, vz, life, size, color, alpha = 1, o = {}) {
        if (this.dim) alpha *= this.dim;
        const i = this.next;
        this.next = (this.next + 1) % this.n;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
        this.life[i] = life; this.max[i] = life;
        this.size[i] = size; this.size0[i] = size; this.a0[i] = alpha; this.alpha[i] = alpha;
        this.grow[i] = o.grow ?? 0; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 1.5;
    }
    update(dt) {
        for (let i = 0; i < this.n; i++) {
            if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
            this.life[i] -= dt;
            const k = Math.max(0, this.life[i] / this.max[i]);
            const dr = Math.exp(-this.drag[i] * dt);
            this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
            this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - k));
            this.alpha[i] = this.a0[i] * Math.min(1, k * 2.5) * (k < 1 ? 1 : 0);
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aColor.needsUpdate = true;
        this.geo.attributes.aSize.needsUpdate = true;
        this.geo.attributes.aAlpha.needsUpdate = true;
    }
}

let add, norm, weather = null, root;
const _c = new THREE.Color(), _c2 = new THREE.Color();
const rnd = (a, b) => a + Math.random() * (b - a);

export function initFx(scene, quality) {
    root = new THREE.Group();
    scene.add(root);
    add = new ParticleSystem(quality >= 1 ? 2400 : 1200, true);
    add.dim = 0.6;
    norm = new ParticleSystem(quality >= 1 ? 1600 : 800, false);
    root.add(add.points, norm.points);
    initLights(scene);
    initRings();
    initBeams();
    return root;
}

export function setParticleScale(h) {
    const s = h * 0.75;
    add.mat.uniforms.uScale.value = s;
    norm.mat.uniforms.uScale.value = s;
    if (weather) weather.mat.uniforms.uScale.value = s;
}

/** Named particle bursts. */
export function burst(kind, x, y, z, n = 10, o = {}) {
    const col = o.color ? _c.set(o.color) : null;
    for (let i = 0; i < n; i++) {
        switch (kind) {
            case 'fire': add.spawn(x + rnd(-0.1, 0.1), y + rnd(-0.05, 0.1), z + rnd(-0.1, 0.1), rnd(-0.6, 0.6), rnd(0.4, 1.6), rnd(-0.6, 0.6), rnd(0.3, 0.7), rnd(0.18, 0.4) * (o.scale ?? 1), _c2.setHSL(rnd(0.02, 0.1), 1, rnd(0.5, 0.65)), 0.9, { grow: -0.5, drag: 2 }); break;
            case 'spark': add.spawn(x, y, z, rnd(-3, 3), rnd(0.5, 3.5), rnd(-3, 3), rnd(0.25, 0.5), rnd(0.04, 0.08), col ?? _c2.set('#e8b060'), 1, { grav: 6, drag: 1 }); break;
            case 'smoke': norm.spawn(x + rnd(-0.15, 0.15), y, z + rnd(-0.15, 0.15), rnd(-0.2, 0.2), rnd(0.3, 0.8), rnd(-0.2, 0.2), rnd(0.8, 1.6), rnd(0.25, 0.45) * (o.scale ?? 1), col ?? _c2.setHSL(0, 0, rnd(0.18, 0.32)), 0.5, { grow: 1.8, drag: 0.8 }); break;
            case 'dust': norm.spawn(x + rnd(-0.2, 0.2), y + 0.05, z + rnd(-0.2, 0.2), rnd(-1.2, 1.2), rnd(0.2, 0.8), rnd(-1.2, 1.2), rnd(0.5, 1.0), rnd(0.2, 0.35) * (o.scale ?? 1), col ?? _c2.set('#b8a07a'), 0.55, { grow: 1.5, drag: 2.5 }); break;
            case 'debris': norm.spawn(x, y, z, rnd(-2, 2), rnd(1, 3.5), rnd(-2, 2), rnd(0.5, 0.9), rnd(0.06, 0.12), col ?? _c2.set('#6a5a4a'), 1, { grav: 9, drag: 0.5 }); break;
            case 'goo': norm.spawn(x, y, z, rnd(-1.6, 1.6), rnd(0.8, 2.6), rnd(-1.6, 1.6), rnd(0.4, 0.8), rnd(0.07, 0.14) * (o.scale ?? 1), col ?? _c2.set('#6a9a3a'), 1, { grav: 8, drag: 0.6 }); break;
            case 'magic': add.spawn(x + rnd(-0.15, 0.15), y + rnd(-0.1, 0.2), z + rnd(-0.15, 0.15), rnd(-0.5, 0.5), rnd(0.2, 1.2), rnd(-0.5, 0.5), rnd(0.4, 0.9), rnd(0.08, 0.16) * (o.scale ?? 1), col ?? _c2.set('#c9a8ff'), 0.9, { drag: 1.5 }); break;
            case 'frost': add.spawn(x, y, z, rnd(-1.5, 1.5), rnd(-0.2, 1.4), rnd(-1.5, 1.5), rnd(0.3, 0.7), rnd(0.06, 0.13), _c2.set(i % 2 ? '#7ad0f0' : '#3a98e0'), 0.9, { drag: 2.5, grav: 1 }); break;
            case 'heal': add.spawn(x + rnd(-0.25, 0.25), y + rnd(0, 0.4), z + rnd(-0.25, 0.25), 0, rnd(0.6, 1.2), 0, rnd(0.5, 0.9), rnd(0.07, 0.12), col ?? _c2.set('#8aff6a'), 0.9, { drag: 1 }); break;
            case 'gold': add.spawn(x + rnd(-0.15, 0.15), y + rnd(0, 0.2), z + rnd(-0.15, 0.15), rnd(-0.8, 0.8), rnd(1, 2.4), rnd(-0.8, 0.8), rnd(0.4, 0.8), rnd(0.06, 0.1), _c2.set('#ffd24a'), 1, { grav: 4, drag: 1 }); break;
            case 'ember': add.spawn(x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(0.5, 1.5), rnd(-0.3, 0.3), rnd(0.8, 1.6), rnd(0.04, 0.08), _c2.setHSL(rnd(0.03, 0.09), 1, 0.6), 1, { drag: 0.6 }); break;
            case 'leaf': norm.spawn(x, y, z, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), rnd(0.6, 1.2), rnd(0.05, 0.09), _c2.set(i % 2 ? '#7aa83a' : '#5a8a2a'), 1, { grav: 3, drag: 1.5 }); break;
            case 'ring': {
                const a = (i / n) * Math.PI * 2;
                add.spawn(x, y, z, Math.cos(a) * (o.speed ?? 3), 0.2, Math.sin(a) * (o.speed ?? 3), rnd(0.3, 0.5), rnd(0.08, 0.14), col ?? _c2.set('#ffd88a'), 0.9, { drag: 3 });
                break;
            }
        }
    }
}

// ------------------------------------------------------------------ Weather

const WEATHER = {
    pollen: { n: 220, color: '#fff6c8', size: 0.05, vy: -0.05, sway: 0.4, add: true, alpha: 0.7 },
    fireflies: { n: 160, color: '#c8ff6a', size: 0.07, vy: 0.02, sway: 0.5, add: true, alpha: 0.9, blink: true },
    ash: { n: 500, color: '#5a5450', size: 0.05, vy: -0.4, sway: 0.3, add: false, alpha: 0.75 },
    snow: { n: 700, color: '#ffffff', size: 0.06, vy: -0.7, sway: 0.5, add: false, alpha: 0.9 },
    mist: { n: 140, color: '#6aff8a', size: 0.06, vy: 0.05, sway: 0.2, add: true, alpha: 0.6, blink: true },
    embers: { n: 420, color: '#ff7a2a', size: 0.06, vy: 0.5, sway: 0.4, add: true, alpha: 0.9 },
};

export function setWeather(kind, quality) {
    if (weather) { root.remove(weather.points); weather.geo.dispose(); weather.mat.dispose(); weather = null; }
    const W = WEATHER[kind];
    if (!W) return;
    const n = Math.round(W.n * (quality >= 1 ? 1 : 0.5));
    const sys = new ParticleSystem(n, W.add);
    const c = new THREE.Color(W.color);
    for (let i = 0; i < n; i++) {
        sys.pos[i * 3] = rnd(-6, 13); sys.pos[i * 3 + 1] = rnd(0.1, 6); sys.pos[i * 3 + 2] = rnd(-5, 5);
        sys.col[i * 3] = c.r; sys.col[i * 3 + 1] = c.g; sys.col[i * 3 + 2] = c.b;
        sys.size[i] = W.size * rnd(0.7, 1.3); sys.alpha[i] = W.alpha; sys.life[i] = rnd(0, 6.28);
    }
    sys.update = function (dt, t) {
        for (let i = 0; i < this.n; i++) {
            const ph = this.life[i];
            this.pos[i * 3] += Math.sin(t * 0.7 + ph) * W.sway * dt + (kind === 'ash' || kind === 'snow' ? 0.15 * dt : 0);
            this.pos[i * 3 + 1] += W.vy * dt * (0.6 + 0.4 * Math.sin(ph));
            this.pos[i * 3 + 2] += Math.cos(t * 0.5 + ph) * W.sway * dt * 0.5;
            if (this.pos[i * 3 + 1] < 0) this.pos[i * 3 + 1] = 6;
            if (this.pos[i * 3 + 1] > 6) this.pos[i * 3 + 1] = 0.1;
            if (this.pos[i * 3] > 13) this.pos[i * 3] = -6;
            if (W.blink) this.alpha[i] = W.alpha * (0.5 + 0.5 * Math.sin(t * 2 + ph * 3));
        }
        this.geo.attributes.position.needsUpdate = true;
        if (W.blink) this.geo.attributes.aAlpha.needsUpdate = true;
    };
    sys.mat.uniforms.uScale.value = add.mat.uniforms.uScale.value;
    weather = sys;
    root.add(sys.points);
}

// ------------------------------------------------------------------ Lights

const lights = [];
function initLights(scene) {
    for (let i = 0; i < 4; i++) {
        const l = new THREE.PointLight(0xffaa55, 0, 4, 1.6);
        l.userData = { life: 0, max: 1, peak: 0 };
        scene.add(l);
        lights.push(l);
    }
}
export function flash(x, y, z, color = '#ffaa55', peak = 6, life = 0.35, dist = 4) {
    let l = lights.find((v) => v.userData.life <= 0) ?? lights.reduce((a, b) => (a.userData.life < b.userData.life ? a : b));
    l.position.set(x, y, z);
    l.color.set(color);
    l.distance = dist;
    l.userData.life = life; l.userData.max = life; l.userData.peak = peak;
    l.intensity = peak;
}

// ------------------------------------------------------------------ Rings

const rings = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
function initRings() {
    for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        m.userData = { life: 0, max: 1, r: 1 };
        root.add(m);
        rings.push(m);
    }
}
export function ring(x, y, z, r, color = '#ffd88a', life = 0.45) {
    const m = rings.find((v) => v.userData.life <= 0) ?? rings[0];
    m.position.set(x, y + 0.05, z);
    m.material.color.set(color);
    m.userData.life = life; m.userData.max = life; m.userData.r = r;
    m.visible = true;
}

// ------------------------------------------------------------------ Beams (lightning, drain, breath telegraph)

const beams = [];
function initBeams() {
    for (let i = 0; i < 10; i++) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3), 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xc9a8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        l.frustumCulled = false;
        l.userData = { life: 0, max: 1 };
        root.add(l);
        beams.push(l);
    }
}
/** pts: [{x,y,z}...]; jitter: lightning look. */
export function beam(pts, color = '#c9a8ff', life = 0.22, jitter = 0.12) {
    const l = beams.find((v) => v.userData.life <= 0) ?? beams[0];
    const arr = l.geometry.attributes.position.array;
    let k = 0;
    for (let i = 0; i < pts.length - 1 && k < 95; i++) {
        const a = pts[i], b = pts[i + 1];
        const seg = Math.max(2, Math.min(12, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * 5)));
        for (let s = 0; s < seg && k < 95; s++) {
            const t = s / seg;
            const j = s === 0 ? 0 : jitter;
            arr[k * 3] = a.x + (b.x - a.x) * t + rnd(-j, j);
            arr[k * 3 + 1] = a.y + (b.y - a.y) * t + rnd(-j, j);
            arr[k * 3 + 2] = a.z + (b.z - a.z) * t + rnd(-j, j);
            k++;
        }
    }
    const last = pts[pts.length - 1];
    arr[k * 3] = last.x; arr[k * 3 + 1] = last.y; arr[k * 3 + 2] = last.z; k++;
    l.geometry.setDrawRange(0, k);
    l.geometry.attributes.position.needsUpdate = true;
    l.material.color.set(color);
    l.userData.life = life; l.userData.max = life;
    return l;
}

// ------------------------------------------------------------------ Projectile meshes

const PGEO = {};
function buildProjectiles() {
    const mk = (fn) => { const P = new Parts(3); fn(P); return P.build(); };
    PGEO.arrow = mk((P) => { P.box('#8a6a3a', [0, 0, 0], [0.42, 0.018, 0.018]); P.cone('#c8ccd4', [0.24, 0, 0], [0.025, 0.07, 0.025], [0, 0, -Math.PI / 2]); P.box('#e8e0c8', [-0.19, 0, 0], [0.08, 0.05, 0.005]); P.box('#e8e0c8', [-0.19, 0, 0], [0.08, 0.005, 0.05]); });
    PGEO.earrow = mk((P) => { P.box('#3a2a1a', [0, 0, 0], [0.36, 0.016, 0.016]); P.cone('#5a5a5a', [-0.2, 0, 0], [0.022, 0.06, 0.022], [0, 0, Math.PI / 2]); P.box('#8a1a1a', [0.16, 0, 0], [0.07, 0.04, 0.005]); });
    PGEO.fireball = mk((P) => { P.sph('#ff7a2a', [0, 0, 0], [0.14, 0.14, 0.14], [0, 0, 0], { glow: true }); P.sph('#fff0a0', [0.03, 0, 0], [0.08, 0.08, 0.08], [0, 0, 0], { glow: true }); });
    PGEO.ice = mk((P) => { P.add('oct', '#bff0ff', [0, 0, 0], [0.18, 0.05, 0.05], [0, 0, 0], { glow: true }); });
    PGEO.holy = mk((P) => { P.sph('#fff0a0', [0, 0, 0], [0.09, 0.09, 0.09], [0, 0, 0], { glow: true }); P.add('ring', '#ffd24a', [0, 0, 0], [0.13, 0.13, 0.13], [0, Math.PI / 2, 0], { glow: true }); });
    PGEO.bolt = mk((P) => { P.box('#6a4a2a', [0, 0, 0], [0.8, 0.035, 0.035]); P.cone('#a8acb4', [0.46, 0, 0], [0.05, 0.14, 0.05], [0, 0, -Math.PI / 2]); P.box('#c8c0a8', [-0.36, 0, 0], [0.1, 0.09, 0.01]); });
    PGEO.barrel = mk((P) => { P.cyl('#8a5a2a', [0, 0, 0], [0.12, 0.2, 0.12]); P.cyl('#3a3a3a', [0, 0.06, 0], [0.125, 0.02, 0.125]); P.cyl('#3a3a3a', [0, -0.06, 0], [0.125, 0.02, 0.125]); P.sph('#ffd24a', [0, 0.13, 0], [0.03, 0.03, 0.03], [0, 0, 0], { glow: true }); });
    PGEO.hex = mk((P) => { P.sph('#ff4a1a', [0, 0, 0], [0.1, 0.1, 0.1], [0, 0, 0], { glow: true }); });
    PGEO.boulder = mk((P) => { P.add('dod', '#7a7470', [0, 0, 0], [0.16, 0.15, 0.16]); });
    PGEO.acid = mk((P) => { P.sph('#8aff3a', [0, 0, 0], [0.13, 0.11, 0.13], [0, 0, 0], { glow: true }); });
    PGEO.axe = mk((P) => { P.box('#5a3a1a', [0, 0, 0], [0.04, 0.4, 0.03]); P.box('#c8ccd4', [0.08, 0.14, 0], [0.16, 0.14, 0.02]); });
}

const projMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 });
export function makeProjectile(kind, from) {
    if (!PGEO.arrow) buildProjectiles();
    let k = kind;
    if (from === 'enemy' && kind === 'arrow') k = 'earrow';
    const b = PGEO[k] ?? PGEO.arrow;
    const g = new THREE.Group();
    if (b.solid) g.add(new THREE.Mesh(b.solid, projMat));
    if (b.glow) g.add(new THREE.Mesh(b.glow, GLOW_MAT));
    g.userData.kind = k;
    root.add(g);
    return g;
}
export function removeObj(o) { root.remove(o); }
export function addObj(o) { root.add(o); }

// ------------------------------------------------------------------ Floating numbers (DOM)

let numLayer = null;
const nums = [];
export function initNumbers(el) { numLayer = el; }
const _p = new THREE.Vector3();
const _s = { x: 0, y: 0, behind: false };
let liveNums = 0;
export function floatText(x, y, z, text, cls = '', life = 0.9) {
    if (!numLayer) return;
    // A global cap keeps big fights readable; crits, gold and level-ups get extra headroom.
    const important = /crit|level|info/.test(cls);
    if (liveNums >= (important ? 22 : cls.includes('gold') ? 16 : 12)) return;
    let n = nums.find((v) => v.life <= 0);
    if (!n) {
        if (nums.length >= 48) n = nums.reduce((a, b) => (a.life < b.life ? a : b));
        else { const el = document.createElement('div'); el.className = 'num'; numLayer.appendChild(el); n = { el, life: 0 }; nums.push(n); }
    }
    n.el.textContent = text;
    n.el.className = 'num ' + cls;
    n.x = x + rnd(-0.3, 0.3); n.y = y + rnd(-0.1, 0.2); n.z = z + rnd(-0.15, 0.15); n.life = life; n.max = life;
    n.el.style.display = 'block';
}
export function clearNumbers() { for (const n of nums) { n.life = 0; n.el.style.display = 'none'; } }
function updateNumbers(dt) {
    liveNums = 0;
    for (const n of nums) if (n.life > 0) liveNums++;
    for (const n of nums) {
        if (n.life <= 0) continue;
        n.life -= dt;
        if (n.life <= 0) { n.el.style.display = 'none'; continue; }
        const k = 1 - n.life / n.max;
        _p.set(n.x, n.y + k * 0.7, n.z);
        worldToScreen(_p, _s);
        n.el.style.transform = `translate(${_s.x.toFixed(1)}px, ${_s.y.toFixed(1)}px) translate(-50%, -50%) scale(${(k < 0.15 ? 0.6 + k * 3 : 1).toFixed(2)})`;
        n.el.style.opacity = String(Math.min(1, n.life / n.max * 2.5));
    }
}

// ------------------------------------------------------------------ Update

export function updateFx(dt, t) {
    add.update(dt);
    norm.update(dt);
    if (weather) weather.update(dt, t);
    for (const l of lights) {
        const u = l.userData;
        if (u.life <= 0) { if (l.intensity !== 0) l.intensity = 0; continue; }
        u.life -= dt;
        l.intensity = u.peak * Math.max(0, u.life / u.max);
    }
    for (const m of rings) {
        const u = m.userData;
        if (u.life <= 0) continue;
        u.life -= dt;
        const k = 1 - Math.max(0, u.life / u.max);
        m.scale.setScalar(0.1 + u.r * k);
        m.material.opacity = (1 - k) * 0.85;
        if (u.life <= 0) m.visible = false;
    }
    for (const b of beams) {
        const u = b.userData;
        if (u.life <= 0) { b.material.opacity = 0; continue; }
        u.life -= dt;
        b.material.opacity = Math.max(0, u.life / u.max);
    }
    updateNumbers(dt);
}
