// Particles. Ambient ones (dust, fireflies, embers, wisps, spores) move entirely in the vertex
// shader from a seed per point, so they cost nothing on the CPU. Bursts (sparkles when a patient
// is healed, a chest opens or motes are treated) are pooled points with simple physics.

import * as THREE from 'three';
import { timeUniform } from './shaders.js';

const KINDS = {
    dust: { color: [1.0, 0.85, 0.6], size: 0.035, rise: 0.02, drift: 0.15, twinkle: 0.4, alpha: 0.35 },
    fireflies: { color: [0.8, 1.6, 0.6], size: 0.07, rise: 0.0, drift: 0.6, twinkle: 1.0, alpha: 0.9 },
    embers: { color: [2.2, 0.7, 0.15], size: 0.05, rise: 0.6, drift: 0.3, twinkle: 0.6, alpha: 0.9 },
    wisps: { color: [0.5, 1.3, 1.2], size: 0.06, rise: 0.08, drift: 0.4, twinkle: 0.8, alpha: 0.6 },
    spores: { color: [1.1, 0.5, 1.6], size: 0.05, rise: 0.05, drift: 0.3, twinkle: 0.7, alpha: 0.6 },
    motes: { color: [0.5, 0.9, 1.5], size: 0.04, rise: 0.05, drift: 0.2, twinkle: 0.8, alpha: 0.5 },
};

export class Particles {
    constructor(kind, bounds, n = 200) {
        const K = KINDS[kind] ?? KINDS.dust;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3), seed = new Float32Array(n);
        const size = bounds.getSize(new THREE.Vector3());
        for (let i = 0; i < n; i++) {
            pos[i * 3] = bounds.min.x + Math.random() * size.x;
            pos[i * 3 + 1] = bounds.min.y + Math.random() * size.y;
            pos[i * 3 + 2] = bounds.min.z + Math.random() * size.z;
            seed[i] = Math.random() * 100;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: {
                uTime: timeUniform, uColor: { value: new THREE.Vector3(...K.color) }, uSize: { value: K.size },
                uRise: { value: K.rise }, uDrift: { value: K.drift }, uTw: { value: K.twinkle }, uAlpha: { value: K.alpha }, uH: { value: size.y },
            },
            vertexShader: /* glsl */`
uniform float uTime, uSize, uRise, uDrift, uH;
attribute float seed;
varying float vSeed;
void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.3 + seed) * uDrift + sin(uTime * 0.71 + seed * 2.0) * uDrift * 0.5;
    p.z += cos(uTime * 0.27 + seed * 1.3) * uDrift;
    p.y = mod(p.y + uTime * uRise + sin(uTime * 0.5 + seed) * 0.2, uH);
    vSeed = seed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * 600.0 / max(0.5, -mv.z);
    gl_Position = projectionMatrix * mv;
}`,
            fragmentShader: /* glsl */`
uniform float uTime, uTw, uAlpha; uniform vec3 uColor; varying float vSeed;
void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float tw = 1.0 - uTw * 0.5 + uTw * 0.5 * sin(uTime * 3.0 + vSeed * 7.0);
    gl_FragColor = vec4(uColor * tw, smoothstep(0.5, 0.0, d) * uAlpha * tw);
}`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        this.points.frustumCulled = false;
    }
    update() { /* all in the shader */ }
}

/** Pooled burst particles: sparkles, juice, ash. */
export class Bursts {
    constructor(n = 600) {
        this.n = n;
        this.pos = new Float32Array(n * 3);
        this.vel = new Float32Array(n * 3);
        this.col = new Float32Array(n * 3);
        this.life = new Float32Array(n);
        this.max = new Float32Array(n);
        this.sz = new Float32Array(n);
        this.next = 0;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        this.alpha = new Float32Array(n);
        geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
        geo.setAttribute('size', new THREE.BufferAttribute(this.sz, 1));
        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            vertexShader: /* glsl */`
attribute vec3 color; attribute float alpha, size; varying vec3 vC; varying float vA;
void main() { vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * 500.0 / max(0.3, -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: /* glsl */`
varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float s = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * (0.6 + s), s * vA); }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        this.points.frustumCulled = false;
    }

    /** n sparks at p, colour c (THREE.Color), speed, spread, gravity, life. */
    emit(p, c, { n = 20, speed = 2, up = 1, life = 0.9, size = 0.06, gravity = -2 } = {}) {
        for (let k = 0; k < n; k++) {
            const i = this.next; this.next = (this.next + 1) % this.n;
            const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1;
            const s = speed * (0.4 + Math.random() * 0.6);
            this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
            this.vel[i * 3] = Math.cos(a) * Math.sqrt(1 - e * e) * s;
            this.vel[i * 3 + 1] = e * s * 0.6 + up * (0.5 + Math.random());
            this.vel[i * 3 + 2] = Math.sin(a) * Math.sqrt(1 - e * e) * s;
            this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
            this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
            this.sz[i] = size * (0.6 + Math.random() * 0.8);
            this.g = gravity;
        }
    }

    update(dt) {
        const g = this.g ?? -2;
        for (let i = 0; i < this.n; i++) {
            if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
            this.life[i] -= dt;
            this.vel[i * 3 + 1] += g * dt;
            this.vel[i * 3] *= 0.98; this.vel[i * 3 + 2] *= 0.98;
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            this.alpha[i] = Math.max(0, this.life[i] / this.max[i]);
        }
        const a = this.points.geometry.attributes;
        a.position.needsUpdate = true; a.alpha.needsUpdate = true; a.color.needsUpdate = true; a.size.needsUpdate = true;
    }
}
