// Particles and flying notes. One pooled THREE.Points cloud (additive glow dots) and a pool of note sprites that fly along
// arcs from a princess to the enemy. Everything here is decoration: it never touches the sim.

import * as THREE from 'three';
import { radialTexture, noteTexture } from './sprites.js';

const N = 1600;

export class Particles {
    constructor(scene) {
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.size = new Float32Array(N);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        this.mat = new THREE.ShaderMaterial({
            uniforms: { map: { value: radialTexture() }, scale: { value: 300 } },
            vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
                void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.a, t.a); }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.p = [];
        this.free = [];
        for (let i = N - 1; i >= 0; i--) this.free.push(i);
        this.tmpC = new THREE.Color();
    }
    setScale(h) { this.mat.uniforms.scale.value = h * 0.42; }
    /** o: { n, color, speed, life, size, gravity, spread, up, drag, vel } */
    emit(x, y, z, o = {}) {
        const n = o.n ?? 12;
        this.tmpC.set(o.color ?? 0xffffff);
        for (let k = 0; k < n && this.free.length; k++) {
            const i = this.free.pop();
            const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
            const sp = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
            const v = o.vel ? [o.vel[0] + (Math.random() - 0.5) * (o.spread ?? 0.5), o.vel[1] + (Math.random() - 0.5) * (o.spread ?? 0.5), o.vel[2] + (Math.random() - 0.5) * (o.spread ?? 0.5)]
                : [Math.cos(a) * Math.cos(b) * sp, Math.abs(Math.sin(b)) * sp * (o.up ?? 1) + (o.lift ?? 0), Math.sin(a) * Math.cos(b) * sp];
            const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.6);
            const c = this.tmpC;
            const jit = o.jitter ?? 0.15;
            this.p.push({ i, x: x + (Math.random() - 0.5) * (o.box ?? 0), y: y + (Math.random() - 0.5) * (o.boxY ?? o.box ?? 0), z: z + (Math.random() - 0.5) * (o.box ?? 0), vx: v[0], vy: v[1], vz: v[2], life, max: life, s: (o.size ?? 0.18) * (0.7 + Math.random() * 0.6), g: o.gravity ?? 2, drag: o.drag ?? 1.5, r: c.r * (1 - jit + Math.random() * jit), gg: c.g * (1 - jit + Math.random() * jit), b: c.b * (1 - jit + Math.random() * jit) });
        }
    }
    update(dt) {
        const P = this.pos, C = this.col, S = this.size;
        for (let k = this.p.length - 1; k >= 0; k--) {
            const q = this.p[k];
            q.life -= dt;
            if (q.life <= 0) { S[q.i] = 0; this.free.push(q.i); this.p.splice(k, 1); continue; }
            const d = Math.exp(-q.drag * dt);
            q.vx *= d; q.vz *= d; q.vy = q.vy * d - q.g * dt;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            const f = Math.min(1, q.life / q.max * 2.2);
            P[q.i * 3] = q.x; P[q.i * 3 + 1] = q.y; P[q.i * 3 + 2] = q.z;
            C[q.i * 3] = q.r * f; C[q.i * 3 + 1] = q.gg * f; C[q.i * 3 + 2] = q.b * f;
            S[q.i] = q.s;
        }
        const g = this.points.geometry;
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
    }
    clear() { for (const q of this.p) { this.size[q.i] = 0; this.free.push(q.i); } this.p.length = 0; }
}

/** Glowing music notes flying from a to b along an arc, then bursting. */
export class Notes {
    constructor(scene, particles) {
        this.scene = scene; this.particles = particles;
        this.tex = [noteTexture('♪'), noteTexture('♫'), noteTexture('★')];
        this.pool = []; this.live = [];
    }
    fly(from, to, color, o = {}) {
        let s = this.pool.pop();
        if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); this.scene.add(s); }
        s.visible = true;
        s.material.map = this.tex[o.glyph ?? (Math.random() < 0.5 ? 0 : 1)];
        s.material.color.set(color);
        s.material.needsUpdate = true;
        const sc = o.size ?? 0.55; s.scale.set(sc, sc, sc);
        this.live.push({ s, from: from.clone(), to: to.clone(), t: 0, dur: o.dur ?? 0.38, arc: o.arc ?? 1.2, color, onHit: o.onHit, sc });
    }
    update(dt) {
        for (let k = this.live.length - 1; k >= 0; k--) {
            const n = this.live[k];
            n.t += dt / n.dur;
            const t = Math.min(1, n.t);
            n.s.position.lerpVectors(n.from, n.to, t);
            n.s.position.y += Math.sin(t * Math.PI) * n.arc;
            n.s.material.rotation = Math.sin(t * 9) * 0.3;
            const sc = n.sc * (1 + Math.sin(t * Math.PI) * 0.4);
            n.s.scale.set(sc, sc, sc);
            if (this.particles && Math.random() < 0.6) this.particles.emit(n.s.position.x, n.s.position.y, n.s.position.z, { n: 1, color: n.color, speed: 0.3, life: 0.35, size: 0.1, gravity: 0 });
            if (t >= 1) { n.s.visible = false; this.pool.push(n.s); this.live.splice(k, 1); n.onHit?.(); }
        }
    }
    clear() { for (const n of this.live) { n.s.visible = false; this.pool.push(n.s); } this.live.length = 0; }
}
