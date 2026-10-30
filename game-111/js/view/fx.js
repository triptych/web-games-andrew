// Effects in the board's space: glowing particles, shards of shattered glyphs, beams along cleared
// lines, shock rings and floating words. Pools, so nothing is allocated during play.

import * as THREE from 'three';
import { SERIF } from './cardart.js';

const PART_VS = /* glsl */`
    attribute float aSize, aAlpha;
    attribute vec3 aColor;
    uniform float uPixel;
    varying vec3 vC;
    varying float vA;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vC = aColor; vA = aAlpha;
        gl_PointSize = aSize * uPixel * 300.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
    }`;
const PART_FS = /* glsl */`
    varying vec3 vC;
    varying float vA;
    void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a * vA;
        gl_FragColor = vec4(vC * a, a);
    }`;
const BEAM_FS = /* glsl */`
    uniform vec3 uColor;
    uniform float uT;
    varying vec2 vUv;
    void main() {
        float y = abs(vUv.y - 0.5) * 2.0;
        float core = exp(-y * y * 40.0) * 1.5 + exp(-y * y * 7.0) * 0.18;
        // a sweep that runs from the middle outwards
        float sweep = smoothstep(0.0, 0.1, uT * 1.4 - abs(vUv.x - 0.5) * 2.0);
        float fade = 1.0 - smoothstep(0.35, 1.0, uT);
        float ends = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(uColor * core * sweep * fade * ends, 1.0);
    }`;
const RING_FS = /* glsl */`
    uniform vec3 uColor;
    uniform float uT;
    varying vec2 vUv;
    void main() {
        float r = length(vUv - 0.5) * 2.0;
        float w = 0.025 + 0.05 * (1.0 - uT);
        float a = smoothstep(w, 0.0, abs(r - 0.92)) * (1.0 - uT) * (1.0 - uT);
        gl_FragColor = vec4(uColor * a * 1.1, 1.0);
    }`;
const UV_VS = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

export class Fx {
    constructor(group) {
        this.group = group;
        this.rand = mulberry(1234);

        // particles
        this.P = 2400;
        const g = new THREE.BufferGeometry();
        this.pPos = new Float32Array(this.P * 3);
        this.pCol = new Float32Array(this.P * 3);
        this.pSize = new Float32Array(this.P);
        this.pAlpha = new Float32Array(this.P);
        this.pVel = new Float32Array(this.P * 3);
        this.pLife = new Float32Array(this.P);
        this.pMax = new Float32Array(this.P);
        this.pBase = new Float32Array(this.P);
        this.pGrav = new Float32Array(this.P);
        g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
        this.partU = { uPixel: { value: 1 } };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.partU, vertexShader: PART_VS, fragmentShader: PART_FS, ...add }));
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        group.add(this.points);
        this.pNext = 0;

        // shards: little spinning slivers of glass
        this.S = 360;
        const sg = new THREE.TetrahedronGeometry(0.16);
        this.shards = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ ...add, opacity: 1 }), this.S);
        this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < this.S; i++) this.shards.setColorAt(i, new THREE.Color(1, 1, 1));
        this.shards.frustumCulled = false;
        this.shards.count = 0;
        group.add(this.shards);
        this.sh = [];
        for (let i = 0; i < this.S; i++) this.sh.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), c: new THREE.Color(), s: 1 });
        this.shNext = 0;

        // beams and rings
        this.beams = [];
        for (let i = 0; i < 16; i++) {
            const u = { uColor: { value: new THREE.Color() }, uT: { value: 1 } };
            const m = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 1.6), new THREE.ShaderMaterial({ uniforms: u, vertexShader: UV_VS, fragmentShader: BEAM_FS, ...add }));
            m.visible = false; m.position.z = 0.4; m.renderOrder = 6;
            m.userData = { u, t: 1, dur: 0.7 };
            group.add(m);
            this.beams.push(m);
        }
        this.rings = [];
        for (let i = 0; i < 12; i++) {
            const u = { uColor: { value: new THREE.Color() }, uT: { value: 1 } };
            const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: UV_VS, fragmentShader: RING_FS, ...add }));
            m.visible = false; m.position.z = 0.3; m.renderOrder = 6;
            m.userData = { u, t: 1, dur: 0.6, r0: 0.5, r1: 4 };
            group.add(m);
            this.rings.push(m);
        }

        // floating words
        this.words = [];
        for (let i = 0; i < 10; i++) {
            const cv = document.createElement('canvas');
            cv.width = 1024; cv.height = 256;
            const tex = new THREE.CanvasTexture(cv);
            tex.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
            m.visible = false; m.position.z = 1.6; m.renderOrder = 8;
            m.userData = { cv, tex, t: 1, dur: 1.2, vy: 1, base: 1 };
            group.add(m);
            this.words.push(m);
        }
        this.wNext = 0;
        this.calm = false;
    }

    /** A burst of n particles at (x, y, z) in a colour. */
    burst(x, y, z, color, n = 20, { speed = 4, size = 0.22, life = 0.8, up = 0, grav = -3, spread = 1 } = {}) {
        if (this.calm) n = Math.ceil(n * 0.5);
        const r = this.rand;
        for (let k = 0; k < n; k++) {
            const i = this.pNext; this.pNext = (this.pNext + 1) % this.P;
            const a = r() * Math.PI * 2, e = (r() - 0.3) * Math.PI * spread;
            const s = speed * (0.3 + r() * 0.9);
            this.pPos[i * 3] = x + (r() - 0.5) * 0.4; this.pPos[i * 3 + 1] = y + (r() - 0.5) * 0.4; this.pPos[i * 3 + 2] = z;
            this.pVel[i * 3] = Math.cos(a) * Math.cos(e) * s;
            this.pVel[i * 3 + 1] = Math.sin(a) * Math.cos(e) * s + up;
            this.pVel[i * 3 + 2] = Math.abs(Math.sin(e)) * s * 0.8 + 1;
            const tint = 0.75 + r() * 0.6;
            this.pCol[i * 3] = Math.min(2, color.r * tint * 1.4 + 0.1); this.pCol[i * 3 + 1] = Math.min(2, color.g * tint * 1.4 + 0.1); this.pCol[i * 3 + 2] = Math.min(2, color.b * tint * 1.4 + 0.1);
            this.pBase[i] = size * (0.5 + r());
            this.pLife[i] = this.pMax[i] = life * (0.6 + r() * 0.8);
            this.pGrav[i] = grav;
        }
    }

    /** A spiral of particles drawn in towards (x, y): light being gathered. */
    gather(x, y, z, color, n = 40, radius = 3) {
        const r = this.rand;
        for (let k = 0; k < n; k++) {
            const i = this.pNext; this.pNext = (this.pNext + 1) % this.P;
            const a = r() * Math.PI * 2, d = radius * (0.6 + r() * 0.6);
            this.pPos[i * 3] = x + Math.cos(a) * d; this.pPos[i * 3 + 1] = y + Math.sin(a) * d; this.pPos[i * 3 + 2] = z;
            const life = 0.6 + r() * 0.4;
            // tangential + inward so it spirals
            this.pVel[i * 3] = (-Math.cos(a) * d - Math.sin(a) * d * 0.8) / life;
            this.pVel[i * 3 + 1] = (-Math.sin(a) * d + Math.cos(a) * d * 0.8) / life;
            this.pVel[i * 3 + 2] = 0;
            this.pCol[i * 3] = color.r * 1.6; this.pCol[i * 3 + 1] = color.g * 1.6; this.pCol[i * 3 + 2] = color.b * 1.6;
            this.pBase[i] = 0.18 + r() * 0.2;
            this.pLife[i] = this.pMax[i] = life;
            this.pGrav[i] = 0;
        }
    }

    /** A glyph block shattering into slivers. */
    shatter(x, y, color, n = 5, power = 1) {
        if (this.calm) n = Math.ceil(n * 0.5);
        const r = this.rand;
        for (let k = 0; k < n; k++) {
            const s = this.sh[this.shNext]; this.shNext = (this.shNext + 1) % this.S;
            s.p.set(x + (r() - 0.5) * 0.6, y + (r() - 0.5) * 0.6, 0.2);
            const a = r() * Math.PI * 2, sp = (1.5 + r() * 3.5) * power;
            s.v.set(Math.cos(a) * sp, Math.sin(a) * sp, 2 + r() * 5 * power);
            s.r.set(r() * 6, r() * 6, r() * 6);
            s.w.set((r() - 0.5) * 18, (r() - 0.5) * 18, (r() - 0.5) * 18);
            s.c.copy(color).multiplyScalar(1.6 + r());
            s.s = 0.6 + r() * 1.1;
            s.life = s.max = 0.7 + r() * 0.6;
        }
    }

    /** A beam along a cleared row (rot 0) or column (rot π/2). */
    beam(x, y, rot, color, delay = 0) {
        const m = this.beams.find((b) => !b.visible) || this.beams[0];
        m.visible = true;
        m.position.x = x; m.position.y = y;
        m.rotation.z = rot;
        m.userData.t = -delay;
        m.userData.u.uColor.value.copy(color).multiplyScalar(1.15);
        m.scale.y = 1;
    }

    ring(x, y, color, r0 = 0.4, r1 = 4, dur = 0.6) {
        const m = this.rings.find((b) => !b.visible) || this.rings[0];
        m.visible = true;
        m.position.x = x; m.position.y = y;
        Object.assign(m.userData, { t: 0, dur, r0, r1 });
        m.userData.u.uColor.value.copy(color);
    }

    /** A floating word: "+300", "RESONANCE ×2". size is its height in cells. */
    word(text, x, y, color, { size = 0.9, dur = 1.25, rise = 1.2, font = 'num' } = {}) {
        const m = this.words[this.wNext]; this.wNext = (this.wNext + 1) % this.words.length;
        const { cv, tex } = m.userData;
        const g = cv.getContext('2d');
        g.clearRect(0, 0, cv.width, cv.height);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        let px = 150;
        const face = font === 'num' ? "'Orbitron', 'Segoe UI', system-ui, sans-serif" : SERIF;
        g.font = `900 ${px}px ${face}`;
        while (g.measureText(text).width > cv.width - 60 && px > 40) { px -= 8; g.font = `900 ${px}px ${face}`; }
        const css = `rgb(${Math.min(255, color.r * 255 + 60) | 0}, ${Math.min(255, color.g * 255 + 60) | 0}, ${Math.min(255, color.b * 255 + 60) | 0})`;
        g.lineJoin = 'round';
        g.shadowColor = css; g.shadowBlur = 28;
        g.lineWidth = 16; g.strokeStyle = 'rgba(8, 0, 24, 0.85)';
        g.strokeText(text, 512, 128);
        g.shadowBlur = 0;
        g.fillStyle = css; g.fillText(text, 512, 128);
        tex.needsUpdate = true;
        m.visible = true;
        m.position.set(x, y, 1.6);
        m.scale.set(size * 4, size * 4, 1);
        Object.assign(m.userData, { t: 0, dur, vy: rise, base: size * 4 });
    }

    update(dt) {
        this.partU.uPixel.value = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 0; i < this.P; i++) {
            if (this.pLife[i] <= 0) { if (this.pAlpha[i]) { this.pAlpha[i] = 0; this.pSize[i] = 0; } continue; }
            this.pLife[i] -= dt;
            const k = Math.max(0, this.pLife[i] / this.pMax[i]);
            const drag = Math.exp(-dt * 2.2);
            this.pVel[i * 3] *= drag; this.pVel[i * 3 + 1] *= drag; this.pVel[i * 3 + 2] *= drag;
            this.pVel[i * 3 + 1] += this.pGrav[i] * dt;
            this.pPos[i * 3] += this.pVel[i * 3] * dt;
            this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
            this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
            this.pAlpha[i] = k < 1 ? Math.min(1, k * 1.6) : 1;
            this.pSize[i] = this.pBase[i] * (0.4 + 0.6 * k);
        }
        const ga = this.points.geometry.attributes;
        ga.position.needsUpdate = ga.aColor.needsUpdate = ga.aSize.needsUpdate = ga.aAlpha.needsUpdate = true;

        const t = new THREE.Object3D();
        let n = 0;
        for (const s of this.sh) {
            if (s.life <= 0) continue;
            s.life -= dt;
            s.v.z -= 9 * dt;
            s.v.multiplyScalar(Math.exp(-dt * 1.2));
            s.p.addScaledVector(s.v, dt);
            s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
            const k = Math.max(0, s.life / s.max);
            t.position.copy(s.p);
            t.rotation.copy(s.r);
            t.scale.setScalar(s.s * (0.3 + 0.7 * k));
            t.updateMatrix();
            this.shards.setMatrixAt(n, t.matrix);
            this.shards.setColorAt(n, s.c.clone().multiplyScalar(k));
            n++;
        }
        this.shards.count = n;
        this.shards.instanceMatrix.needsUpdate = true;
        if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;

        for (const m of this.beams) {
            if (!m.visible) continue;
            m.userData.t += dt / m.userData.dur;
            const tt = Math.max(0, m.userData.t);
            m.userData.u.uT.value = tt;
            m.scale.y = 1 + tt * 0.6;
            if (tt >= 1) m.visible = false;
        }
        for (const m of this.rings) {
            if (!m.visible) continue;
            const d = m.userData;
            d.t += dt / d.dur;
            const e = 1 - Math.pow(1 - Math.min(1, d.t), 3);
            m.scale.setScalar(d.r0 + (d.r1 - d.r0) * e);
            d.u.uT.value = Math.min(1, d.t);
            if (d.t >= 1) m.visible = false;
        }
        for (const m of this.words) {
            if (!m.visible) continue;
            const d = m.userData;
            d.t += dt / d.dur;
            const pop = d.t < 0.12 ? 0.6 + (d.t / 0.12) * 0.55 : 1.15 - Math.min(0.15, (d.t - 0.12) * 0.6);
            m.scale.set(d.base * pop, d.base * pop, 1);
            m.position.y += d.vy * dt * (1 - d.t);
            m.material.opacity = d.t > 0.7 ? Math.max(0, 1 - (d.t - 0.7) / 0.3) : 1;
            if (d.t >= 1) m.visible = false;
        }
    }
}

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
