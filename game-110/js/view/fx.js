// Effects: one particle system for hearts, sparkles, crumbs, coins, notes and smoke (pixel-square shapes drawn in the
// shader), expanding rings for cackles and purchases, and the sprite billboards everything stands on.

import * as THREE from 'three';
import { SPRITE_SCALE } from './art.js';

const MAX = 1400;
export const SHAPE = { square: 0, heart: 1, star: 2, circle: 3, note: 4 };

const PVS = `attribute float aSize; attribute float aAlpha; attribute float aShape; attribute vec3 aColor;
varying float vAlpha; varying float vShape; varying vec3 vColor;
uniform float uScale;
void main(){
  vAlpha = aAlpha; vShape = aShape; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PFS = `varying float vAlpha; varying float vShape; varying vec3 vColor;
void main(){
  if (vAlpha <= 0.0) discard;
  vec2 q = (floor(gl_PointCoord * 9.0) + 0.5) / 9.0;      // pixelated, like everything else
  vec2 p = q * 2.0 - 1.0; p.y = -p.y;
  if (vShape > 0.5 && vShape < 1.5) {
    vec2 h = p * 1.18; h.y += 0.28;
    float a = h.x * h.x + h.y * h.y - 1.0;
    if (a * a * a - h.x * h.x * h.y * h.y * h.y > 0.0) discard;
  } else if (vShape > 1.5 && vShape < 2.5) {
    if (abs(p.x) * abs(p.y) > 0.04 || length(p) > 1.0) discard;
  } else if (vShape > 2.5 && vShape < 3.5) {
    if (length(p) > 0.95) discard;
  } else if (vShape > 3.5) {
    bool head = length(p - vec2(-0.25, -0.45)) < 0.38;
    bool stem = p.x > 0.0 && p.x < 0.22 && p.y > -0.5 && p.y < 0.8;
    bool flag = p.y > 0.5 && p.y < 0.8 && p.x > 0.0 && p.x < 0.7;
    if (!(head || stem || flag)) discard;
  }
  gl_FragColor = vec4(vColor, vAlpha);
}`;

export class Particles {
    constructor(scene) {
        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(MAX * 3);
        this.col = new Float32Array(MAX * 3);
        this.size = new Float32Array(MAX);
        this.alpha = new Float32Array(MAX);
        this.shape = new Float32Array(MAX);
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
        geo.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1));
        this.uniforms = { uScale: { value: 400 } };
        this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, toneMapped: false });
        this.points = new THREE.Points(geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
        this.geo = geo;
        this.p = [];
        this.tmp = new THREE.Color();
    }

    /** o: { x, y, z, vx, vy, vz, life, size, color (hex), glow (colour multiplier), shape, grav, drag, spin } */
    add(o) {
        if (this.p.length >= MAX) this.p.shift();
        this.tmp.set(o.color ?? 0xffffff).multiplyScalar(o.glow ?? 1);
        this.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 1, t: 0, size: o.size || 10, r: this.tmp.r, g: this.tmp.g, b: this.tmp.b, shape: o.shape || 0, grav: o.grav ?? -6, drag: o.drag ?? 1.2, wob: o.wob || 0, ph: Math.random() * 6 });
    }

    burst(x, y, z, n, o = {}) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, up = o.up ?? 4, sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
            const color = Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color;
            this.add({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp * 0.6, life: (o.life ?? 1) * (0.7 + Math.random() * 0.6), size: (o.size ?? 10) * (0.7 + Math.random() * 0.6), color, glow: o.glow, shape: o.shape, grav: o.grav, drag: o.drag, wob: o.wob });
        }
    }

    update(dt, scaleY) {
        this.uniforms.uScale.value = scaleY;
        const P = this.p;
        for (let i = P.length - 1; i >= 0; i--) {
            const q = P[i];
            q.t += dt;
            if (q.t >= q.life) { P.splice(i, 1); continue; }
            const d = Math.exp(-q.drag * dt);
            q.vx *= d; q.vz *= d; q.vy = q.vy * d + q.grav * dt;
            q.x += (q.vx + (q.wob ? Math.sin(q.t * 6 + q.ph) * q.wob : 0)) * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        }
        const n = Math.min(P.length, MAX);
        for (let i = 0; i < MAX; i++) {
            if (i >= n) { this.alpha[i] = 0; continue; }
            const q = P[i], k = q.t / q.life;
            this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
            this.col[i * 3] = q.r; this.col[i * 3 + 1] = q.g; this.col[i * 3 + 2] = q.b;
            this.size[i] = q.size * (k < 0.15 ? k / 0.15 : 1);
            this.alpha[i] = k > 0.7 ? (1 - k) / 0.3 : 1;
            this.shape[i] = q.shape;
        }
        for (const a of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape']) this.geo.attributes[a].needsUpdate = true;
        this.geo.setDrawRange(0, Math.max(1, n));
    }
}

/** Expanding rings on the floor or in the air: cackle shockwaves, purchase pops. */
export class Rings {
    constructor(scene) {
        this.scene = scene;
        this.list = [];
        this.geo = new THREE.RingGeometry(0.86, 1, 40);
    }
    add(x, y, z, { color = 0xb48cff, size = 6, life = 0.7, flat = true, glow = 2.2 } = {}) {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending });
        m.color.multiplyScalar(glow);
        const mesh = new THREE.Mesh(this.geo, m);
        mesh.position.set(x, y, z);
        if (flat) mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this.list.push({ mesh, t: 0, life, size });
    }
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const r = this.list[i];
            r.t += dt;
            const k = r.t / r.life;
            if (k >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.list.splice(i, 1); continue; }
            const s = 0.2 + (1 - (1 - k) ** 3) * r.size;
            r.mesh.scale.set(s, s, s);
            r.mesh.material.opacity = 1 - k;
        }
    }
}

// ---------------------------------------------------------------------------------------------------- billboards
const quad = new THREE.PlaneGeometry(1, 1);
quad.translate(0, 0.5, 0);
let blobTex = null;
function blobTexture() {
    if (blobTex) return blobTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.7, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    blobTex = new THREE.CanvasTexture(c);
    return blobTex;
}
const blobGeo = new THREE.PlaneGeometry(1, 1);
blobGeo.rotateX(-Math.PI / 2);

/** A pixel sprite standing upright in the world, lit by the room, with a soft shadow at its feet. */
export class Billboard {
    constructor(entry, { emissive = 0.42, shadow = true, scale = 1 } = {}) {
        this.group = new THREE.Group();
        this.mat = new THREE.MeshLambertMaterial({ map: entry.tex, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: entry.tex, emissiveIntensity: emissive });
        this.mesh = new THREE.Mesh(quad, this.mat);
        this.inner = new THREE.Group();
        this.inner.add(this.mesh);
        this.group.add(this.inner);
        this.scale = scale;
        this.setEntry(entry);
        if (shadow) {
            this.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
            this.blob.position.y = 0.02;
            this.blob.scale.set(this.w * 0.9, 1, this.w * 0.5);
            this.group.add(this.blob);
        }
    }
    setEntry(entry) {
        this.entry = entry;
        this.mat.map = entry.tex;
        this.mat.emissiveMap = entry.tex;
        this.mat.needsUpdate = true;
        this.w = entry.w * SPRITE_SCALE * this.scale;
        this.h = entry.h * SPRITE_SCALE * this.scale;
        this.mesh.scale.set(this.w, this.h, 1);
        this.mesh.position.y = -entry.pad * this.h;
        if (this.blob) this.blob.scale.set(this.w * 0.9, 1, this.w * 0.5);
    }
    dispose() { this.mat.dispose(); this.blob?.material.dispose(); }
}
