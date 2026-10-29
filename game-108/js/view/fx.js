// Effects: sparks, gem shards, magic bolts that fly to the enemy, light pillars, ripples and
// floating numbers. Pools allocated once; nothing here knows the rules.

import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Soft additive sparks. CPU-simulated, one draw call. */
export class Sparks {
    constructor(scene, cap = 1600) {
        this.cap = cap;
        this.n = 0;
        this.p = new Float32Array(cap * 3);
        this.v = new Float32Array(cap * 3);
        this.c = new Float32Array(cap * 3);
        this.life = new Float32Array(cap);
        this.max = new Float32Array(cap);
        this.size = new Float32Array(cap);
        this.drag = new Float32Array(cap);
        this.grav = new Float32Array(cap);
        const g = new THREE.BufferGeometry();
        this.gp = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
        this.gc = new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
        this.ga = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
        this.gs = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.gp);
        g.setAttribute('aCol', this.gc);
        g.setAttribute('aA', this.ga);
        g.setAttribute('aSize', this.gs);
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uScale: { value: 400 } },
            vertexShader: `attribute vec3 aCol; attribute float aA, aSize; uniform float uScale; varying vec3 vC; varying float vA;
              void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
                gl_PointSize = aSize * uScale / max(0.1, -mv.z); vC = aCol; vA = aA; }`,
            fragmentShader: `varying vec3 vC; varying float vA;
              void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA;
                float core = smoothstep(0.18, 0.0, d) * vA; gl_FragColor = vec4(vC * a * 2.4 + core * 1.2, a); }`,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
        this.col = new THREE.Color();
    }

    emit(pos, color, { n = 12, speed = 3, up = 2, life = 0.7, size = 0.12, grav = 6, drag = 2, spread = 1 } = {}) {
        this.col.set(color);
        for (let k = 0; k < n; k++) {
            if (this.n >= this.cap) return;
            const i = this.n++;
            const a = Math.random() * TAU, e = Math.random() * spread;
            const s = speed * (0.4 + Math.random() * 0.6);
            this.p.set([pos.x, pos.y, pos.z], i * 3);
            this.v.set([Math.cos(a) * s * e, up * (0.5 + Math.random()), Math.sin(a) * s * e], i * 3);
            const tint = 0.75 + Math.random() * 0.5;
            this.c.set([this.col.r * tint, this.col.g * tint, this.col.b * tint], i * 3);
            this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
            this.size[i] = size * (0.6 + Math.random() * 0.8);
            this.grav[i] = grav;
            this.drag[i] = drag;
        }
    }

    update(dt) {
        const a = this.ga.array;
        for (let i = 0; i < this.n; i++) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                const j = --this.n;
                this.p.copyWithin(i * 3, j * 3, j * 3 + 3);
                this.v.copyWithin(i * 3, j * 3, j * 3 + 3);
                this.c.copyWithin(i * 3, j * 3, j * 3 + 3);
                this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j];
                this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
                i--;
                continue;
            }
            const d = Math.exp(-this.drag[i] * dt);
            this.v[i * 3] *= d; this.v[i * 3 + 2] *= d;
            this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt;
            this.p[i * 3] += this.v[i * 3] * dt;
            this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
            this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
            if (this.p[i * 3 + 1] < 0.02) { this.p[i * 3 + 1] = 0.02; this.v[i * 3 + 1] *= -0.4; }
            a[i] = Math.min(1, this.life[i] / this.max[i] * 1.6);
        }
        this.points.geometry.setDrawRange(0, this.n);
        this.gp.needsUpdate = this.gc.needsUpdate = this.ga.needsUpdate = this.gs.needsUpdate = true;
    }
}

/** Little crystal shards that tumble off a shattered gem. */
export class Shards {
    constructor(scene, envMap, cap = 400) {
        const geo = new THREE.TetrahedronGeometry(0.07, 0);
        const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.15, metalness: 0, clearcoat: 1, envMap, envMapIntensity: 1.4, flatShading: true });
        this.mesh = new THREE.InstancedMesh(geo, mat, cap);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.setColorAt(0, new THREE.Color());
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.cap = cap;
        this.list = [];
        this.o = new THREE.Object3D();
        this.c = new THREE.Color();
    }
    burst(pos, color, n = 7) {
        for (let k = 0; k < n && this.list.length < this.cap; k++) {
            const a = Math.random() * TAU, s = 1.5 + Math.random() * 2.5;
            this.list.push({
                p: pos.clone().add(new THREE.Vector3(0, 0.2, 0)), v: new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s),
                r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, 0),
                life: 0.7 + Math.random() * 0.5, col: new THREE.Color(color).multiplyScalar(0.8 + Math.random() * 0.6), s: 0.7 + Math.random() * 0.9,
            });
        }
    }
    update(dt) {
        let n = 0;
        for (let i = this.list.length - 1; i >= 0; i--) {
            const q = this.list[i];
            q.life -= dt;
            if (q.life <= 0) { this.list.splice(i, 1); continue; }
            q.v.y -= 12 * dt;
            q.p.addScaledVector(q.v, dt);
            if (q.p.y < 0.04) { q.p.y = 0.04; q.v.y *= -0.35; q.v.x *= 0.6; q.v.z *= 0.6; }
            q.r.x += q.w.x * dt; q.r.y += q.w.y * dt;
            this.o.position.copy(q.p);
            this.o.rotation.copy(q.r);
            this.o.scale.setScalar(q.s * Math.min(1, q.life * 3));
            this.o.updateMatrix();
            this.mesh.setMatrixAt(n, this.o.matrix);
            this.mesh.setColorAt(n, q.col);
            n++;
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}

/** Glowing bolts that arc from the board to the enemy and call back on arrival. */
export class Bolts {
    constructor(scene, sparks) {
        this.sparks = sparks;
        this.list = [];
        this.geo = new THREE.SphereGeometry(0.12, 12, 8);
        this.scene = scene;
    }
    fire(from, to, color, delay, onHit, size = 1) {
        const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), toneMapped: false }));
        m.scale.setScalar(size);
        m.visible = false;
        this.scene.add(m);
        const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 3, 2.5 + Math.random() * 1.5, 0));
        this.list.push({ m, from: from.clone(), mid, to: to.clone(), t: -delay, dur: 0.42 + Math.random() * 0.12, color, onHit });
    }
    get active() { return this.list.length > 0; }
    update(dt) {
        const p = new THREE.Vector3();
        for (let i = this.list.length - 1; i >= 0; i--) {
            const b = this.list[i];
            b.t += dt;
            if (b.t < 0) continue;
            const k = Math.min(1, b.t / b.dur), e = k * k;
            const a = b.from.clone().lerp(b.mid, e), c = b.mid.clone().lerp(b.to, e);
            p.copy(a).lerp(c, e);
            b.m.visible = true;
            b.m.position.copy(p);
            if (Math.random() < 0.8) this.sparks.emit(p, b.color, { n: 1, speed: 0.3, up: 0.2, life: 0.35, size: 0.1, grav: 0, drag: 4 });
            if (k >= 1) {
                this.scene.remove(b.m);
                b.m.material.dispose();
                this.list.splice(i, 1);
                this.sparks.emit(b.to, b.color, { n: 10, speed: 3, up: 2, life: 0.5, size: 0.14 });
                b.onHit?.();
            }
        }
    }
}

const BEAM_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FS = `uniform vec3 uCol; uniform float uA, uTime; varying vec2 vUv;
  void main(){ float edge = sin(vUv.x * 3.14159 * 2.0) * 0.5 + 0.5;
    float streak = 0.6 + 0.4 * sin(vUv.y * 24.0 - uTime * 9.0 + vUv.x * 18.0);
    float a = clamp(uA, 0.0, 1.0) * smoothstep(1.0, 0.2, vUv.y) * smoothstep(0.0, 0.08, vUv.y) * (0.35 + 0.65 * streak);
    gl_FragColor = vec4(uCol * a * 2.5, a); }`;

/** Light pillars (a hero arriving, a hero bound) and ground ripples (an oath taking hold). */
export class Glows {
    constructor(scene) {
        this.scene = scene;
        this.list = [];
        this.beamGeo = new THREE.CylinderGeometry(0.42, 0.5, 6, 24, 1, true);
        this.beamGeo.translate(0, 3, 0);
        this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
        this.ringGeo.rotateX(-Math.PI / 2);
    }
    beam(pos, color, dur = 1.1, width = 1) {
        const m = new THREE.Mesh(this.beamGeo, new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { uCol: { value: new THREE.Color(color) }, uA: { value: 0 }, uTime: { value: 0 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
        }));
        m.position.copy(pos);
        m.scale.set(width, 1, width);
        m.renderOrder = 6;
        this.scene.add(m);
        this.list.push({ m, t: 0, dur, kind: 'beam' });
    }
    ripple(pos, color, dur = 0.7, size = 2.5) {
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        m.position.copy(pos).setY(0.03);
        m.renderOrder = 4;
        this.scene.add(m);
        this.list.push({ m, t: 0, dur, kind: 'ripple', size });
    }
    update(dt, time) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const g = this.list[i];
            g.t += dt;
            const k = g.t / g.dur;
            if (k >= 1) { this.scene.remove(g.m); g.m.material.dispose(); this.list.splice(i, 1); continue; }
            if (g.kind === 'beam') {
                g.m.material.uniforms.uA.value = Math.sin(Math.PI * Math.min(1, k * 1.2)) * 1.2;
                g.m.material.uniforms.uTime.value = time;
            } else {
                g.m.scale.setScalar(0.2 + k * g.size);
                g.m.material.opacity = (1 - k) * 0.9;
            }
        }
    }
}

/** Damage numbers and words that float up over the canvas (DOM, so they stay crisp). */
export class Floats {
    constructor(layer) { this.layer = layer; }
    pop(x, y, text, cls = '') {
        if (!this.layer) return;
        const el = document.createElement('div');
        el.className = 'float ' + cls;
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        this.layer.appendChild(el);
        setTimeout(() => el.remove(), 1300);
    }
}
