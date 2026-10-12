// Particles (dust, sparks, smoke, aether, explosions) and flying rock debris.
// Fixed pools, no allocation per frame. Sizes are in world units.

import * as THREE from 'three';
import { glowCanvas } from './textures.js';

const PV = /* glsl */`
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(aSize * uScale / -mv.z, 220.0);
    vAlpha = aAlpha;
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
}`;
const PF = /* glsl */`
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    gl_FragColor = vec4(vColor, t.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
    #include <colorspace_fragment>
}`;

class Pool {
    constructor(scene, n, additive, tex) {
        this.n = n;
        this.pos = new Float32Array(n * 3);
        this.vel = new Float32Array(n * 3);
        this.col = new Float32Array(n * 3);
        this.size = new Float32Array(n);
        this.alpha = new Float32Array(n);
        this.life = new Float32Array(n);
        this.max = new Float32Array(n);
        this.grav = new Float32Array(n);
        this.drag = new Float32Array(n);
        this.grow = new Float32Array(n);
        this.fade = new Float32Array(n);
        this.next = 0;
        const g = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
        this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
        this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
        this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.aPos);
        g.setAttribute('aColor', this.aCol);
        g.setAttribute('aSize', this.aSize);
        g.setAttribute('aAlpha', this.aAlpha);
        this.uniforms = { uTex: { value: tex }, uScale: { value: 500 } };
        const m = new THREE.ShaderMaterial({
            vertexShader: PV, fragmentShader: PF, uniforms: this.uniforms,
            transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, m);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 4 : 3;
        scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, r, g, b, size, life, opts = {}) {
        const i = this.next;
        this.next = (this.next + 1) % this.n;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
        this.size[i] = size;
        this.life[i] = life; this.max[i] = life;
        this.grav[i] = opts.grav ?? 0;
        this.drag[i] = opts.drag ?? 1;
        this.grow[i] = opts.grow ?? 0;
        this.fade[i] = opts.alpha ?? 1;
        this.alpha[i] = this.fade[i];
    }
    update(dt) {
        const { pos, vel, life, max, alpha, size, grav, drag, grow, fade } = this;
        for (let i = 0; i < this.n; i++) {
            if (life[i] <= 0) { if (alpha[i] !== 0) alpha[i] = 0; continue; }
            life[i] -= dt;
            const k = Math.pow(drag[i], dt * 60);
            vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt; vel[i * 3 + 2] *= k;
            pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            size[i] += grow[i] * dt;
            const t = Math.max(0, life[i] / max[i]);
            alpha[i] = fade[i] * Math.min(1, t * 2.5) * (t < 1 ? 1 : 0);
        }
        this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
    }
}

export class FX {
    constructor(scene) {
        const tex = new THREE.CanvasTexture(glowCanvas(64));
        this.glow = new Pool(scene, 900, true, tex);
        this.soft = new Pool(scene, 700, false, tex);
        // debris: little lit cubes
        const N = 240;
        this.debN = N;
        this.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), N);
        this.deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.deb.frustumCulled = false;
        this.debState = Array.from({ length: N }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, rx: 0, ry: 0, spin: 0 }));
        const c = new THREE.Color();
        for (let i = 0; i < N; i++) this.deb.setColorAt(i, c.setRGB(0.5, 0.4, 0.3));
        this.debNext = 0;
        this._m = new THREE.Matrix4();
        this._q = new THREE.Quaternion();
        this._e = new THREE.Euler();
        this._v = new THREE.Vector3();
        this._s = new THREE.Vector3();
        this._c = new THREE.Color();
        scene.add(this.deb);
        this.shake = 0;
    }

    setScale(px) { this.glow.uniforms.uScale.value = px; this.soft.uniforms.uScale.value = px; }

    debris(x, y, rgb, n = 6, speed = 3) {
        for (let k = 0; k < n; k++) {
            const i = this.debNext; this.debNext = (this.debNext + 1) % this.debN;
            const d = this.debState[i];
            Object.assign(d, {
                life: 0.7 + Math.random() * 0.6, x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, z: 0.2 + Math.random() * 0.4,
                vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * 0.9 + 1, vz: Math.random() * 1.5,
                s: 0.06 + Math.random() * 0.1, rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 20,
            });
            const v = 0.75 + Math.random() * 0.5;
            this.deb.setColorAt(i, this._c.setRGB(rgb[0] * v, rgb[1] * v, rgb[2] * v));
        }
        this.deb.instanceColor.needsUpdate = true;
    }

    dust(x, y, rgb, n = 8) {
        for (let i = 0; i < n; i++) {
            this.soft.spawn(x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.8, 0.3,
                (Math.random() - 0.5) * 1.6, Math.random() * 1.2, 0.3,
                rgb[0], rgb[1], rgb[2], 0.35 + Math.random() * 0.35, 0.6 + Math.random() * 0.6, { drag: 0.94, grow: 0.5, alpha: 0.55, grav: -0.3 });
        }
    }

    sparks(x, y, rgb = [1, 0.75, 0.35], n = 6, speed = 4) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
            this.glow.spawn(x, y, 0.4, Math.cos(a) * s, Math.sin(a) * s + 1, 0.5, rgb[0], rgb[1], rgb[2], 0.12 + Math.random() * 0.1, 0.3 + Math.random() * 0.4, { grav: 9, drag: 0.97 });
        }
    }

    burst(x, y, rgb, n = 20, speed = 3, size = 0.25, life = 0.8) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * Math.random();
            this.glow.spawn(x, y, 0.5, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.3), rgb[0], rgb[1], rgb[2], size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), { drag: 0.93 });
        }
    }

    rise(x, y, rgb, n = 14) {
        for (let i = 0; i < n; i++) {
            this.glow.spawn(x + (Math.random() - 0.5) * 0.8, y - 0.3, 0.5, (Math.random() - 0.5) * 0.3, 1.5 + Math.random() * 2, 0, rgb[0], rgb[1], rgb[2], 0.18 + Math.random() * 0.15, 1 + Math.random(), { drag: 0.98 });
        }
    }

    explosion(x, y, size = 1.5) {
        this.burst(x, y, [1, 0.6, 0.2], 40, 5 * size, 0.45 * size, 0.7);
        this.burst(x, y, [1, 0.95, 0.6], 16, 2 * size, 0.7 * size, 0.35);
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 2.5 * size;
            this.soft.spawn(x, y, 0.3, Math.cos(a) * s, Math.sin(a) * s + 0.5, 0.2, 0.18, 0.16, 0.15, 0.6 + Math.random() * 0.6, 1.2 + Math.random(), { drag: 0.92, grow: 1.2, alpha: 0.6 });
        }
        this.shake = Math.max(this.shake, 0.35 * size);
    }

    smoke(p, rgb, rate, dt) {
        if (Math.random() < rate * dt) {
            this.soft.spawn(p.x + (Math.random() - 0.5) * 0.2, p.y, p.z, (Math.random() - 0.3) * 0.3, 0.6 + Math.random() * 0.4, 0, rgb[0], rgb[1], rgb[2], 0.5, 3 + Math.random() * 2, { grow: 0.5, alpha: 0.45 });
        }
    }

    exhaust(p, thrust) {
        if (Math.random() < (thrust ? 0.9 : 0.12)) {
            const r = thrust ? [0.5, 0.95, 1] : [0.4, 0.38, 0.36];
            (thrust ? this.glow : this.soft).spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 0.5, thrust ? -2.5 - Math.random() * 2 : 0.6, 0, r[0], r[1], r[2], thrust ? 0.22 : 0.25, thrust ? 0.35 : 1.2, { grow: thrust ? -0.2 : 0.4, alpha: thrust ? 0.9 : 0.4 });
        }
    }

    update(dt) {
        this.glow.update(dt);
        this.soft.update(dt);
        const m = this._m, q = this._q, e = this._e, v = this._v, s = this._s;
        let any = false;
        for (let i = 0; i < this.debN; i++) {
            const d = this.debState[i];
            if (d.life <= 0) { s.set(0, 0, 0); m.compose(v.set(0, -9999, 0), q.identity(), s); this.deb.setMatrixAt(i, m); continue; }
            any = true;
            d.life -= dt;
            d.vy -= 16 * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            d.rx += d.spin * dt; d.ry += d.spin * 0.7 * dt;
            const sc = d.s * Math.min(1, d.life * 3);
            m.compose(v.set(d.x, d.y, d.z), q.setFromEuler(e.set(d.rx, d.ry, 0)), s.set(sc, sc, sc));
            this.deb.setMatrixAt(i, m);
        }
        this.deb.instanceMatrix.needsUpdate = true;
        this.deb.visible = any;
        this.shake = Math.max(0, this.shake - dt * 1.5);
    }
}
