// Effects: particles (additive fire and sparks, alpha smoke), debris with physics, shockwave rings,
// fireball volumes, scorch decals, flash lights and screen shake. All view-side; nothing here affects the sim.

import * as THREE from 'three';

const VERT = `
uniform float uK;
attribute float size; attribute vec4 pcolor;
varying vec4 vC;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vC = pcolor;
    gl_Position = projectionMatrix * mv;
    float z = max(0.1, -mv.z);
    gl_PointSize = clamp(size * uK / z, 0.0, 700.0);
}`;
const FRAG = `
varying vec4 vC;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = clamp(length(p) * 2.0, 0.0, 1.0);
    float a = 1.0 - d;
    a = a * a * (3.0 - 2.0 * a);
    gl_FragColor = vec4(vC.rgb, vC.a * a);
}`;

const _c = new THREE.Color();
class Particles {
    constructor(max, additive, uniforms) {
        this.max = max; this.head = 0;
        this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
        this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
        this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
        this.drag = new Float32Array(max); this.grav = new Float32Array(max);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false });
        this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.geo = g;
    }
    emit(x, y, z, vx, vy, vz, life, s0, s1, ca, cb, a0, a1, drag = 0, grav = 0) {
        const i = this.head; this.head = (this.head + 1) % this.max;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag; this.grav[i] = grav;
        _c.set(ca); this.c0[i * 4] = _c.r; this.c0[i * 4 + 1] = _c.g; this.c0[i * 4 + 2] = _c.b; this.c0[i * 4 + 3] = a0;
        _c.set(cb); this.c1[i * 4] = _c.r; this.c1[i * 4 + 1] = _c.g; this.c1[i * 4 + 2] = _c.b; this.c1[i * 4 + 3] = a1;
    }
    update(dt) {
        const n = this.max;
        for (let i = 0; i < n; i++) {
            if (this.life[i] <= 0) { this.size[i] = 0; continue; }
            this.life[i] -= dt;
            const u = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
            const k = Math.exp(-this.drag[i] * dt);
            this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * u;
            for (let c = 0; c < 4; c++) this.col[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * u;
        }
        this.geo.attributes.position.needsUpdate = true; this.geo.attributes.pcolor.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
    }
}

export class FX {
    constructor(scene, quality, getH) {
        this.scene = scene; this.q = quality; this.h = getH;
        this.uniforms = { uK: { value: 600 } };
        const scale = quality === 'low' ? 0.5 : quality === 'med' ? 0.75 : 1;
        this.scale = scale;
        this.glow = new Particles(Math.round(5000 * scale), true, this.uniforms);
        this.smoke = new Particles(Math.round(3000 * scale), false, this.uniforms);
        scene.add(this.smoke.points, this.glow.points);
        this.shake = 0;

        // debris chunks
        const N = Math.round(500 * scale);
        this.dN = N; this.dHead = 0;
        this.dMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.6, 0.8), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.7 }), N);
        this.dMesh.castShadow = quality !== 'low'; this.dMesh.frustumCulled = false;
        this.d = { p: new Float32Array(N * 3), v: new Float32Array(N * 3), r: new Float32Array(N * 3), w: new Float32Array(N * 3), life: new Float32Array(N), size: new Float32Array(N), glowT: new Float32Array(N) };
        const z = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < N; i++) { this.dMesh.setMatrixAt(i, z); this.dMesh.setColorAt(i, _c.set(0x444444)); }
        scene.add(this.dMesh);
        this.tmp = new THREE.Object3D();

        // rings, fireballs, decals, lights
        this.rings = []; this.fireballs = [];
        const ringGeo = new THREE.RingGeometry(0.88, 1, 48); ringGeo.rotateX(-Math.PI / 2);
        for (let i = 0; i < 14; i++) {
            const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
            m.visible = false; m.userData = { t: 0, life: 1, r: 10 }; scene.add(m); this.rings.push(m);
        }
        const ball = new THREE.SphereGeometry(1, 20, 14);
        for (let i = 0; i < 8; i++) {
            const m = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
            m.visible = false; m.userData = { t: 0, life: 1, r: 4 }; scene.add(m); this.fireballs.push(m);
        }
        const dc = document.createElement('canvas'); dc.width = dc.height = 64;
        const g = dc.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        const dt = new THREE.CanvasTexture(dc);
        this.decN = quality === 'low' ? 40 : 90; this.decHead = 0;
        this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0xffffff }), this.decN);
        this.decals.frustumCulled = false;
        for (let i = 0; i < this.decN; i++) this.decals.setMatrixAt(i, z);
        scene.add(this.decals);
        this.lights = [];
        const nl = quality === 'low' ? 0 : 3;
        for (let i = 0; i < nl; i++) { const l = new THREE.PointLight(0xff9040, 0, 55, 2); l.userData = { t: 0, life: 0.4, peak: 0 }; scene.add(l); this.lights.push(l); }
    }

    setSize(heightPx, fov) { this.uniforms.uK.value = (heightPx / 2) / Math.tan((fov * Math.PI) / 360); }
    r(a, b) { return a + Math.random() * (b - a); }       // view-only randomness

    // ------------------------------------------------------------------ primitives
    light(x, y, z, color, peak, life) {
        let l = null;
        for (const q of this.lights) if (q.userData.t <= 0) { l = q; break; }
        if (!l) l = this.lights.reduce((a, b) => (a.userData.t < b.userData.t ? a : b), this.lights[0]);
        if (!l) return;
        l.color.set(color); l.position.set(x, y, z); l.userData.t = life; l.userData.life = life; l.userData.peak = peak;
    }
    ring(x, z, maxR, life, color, y = null, thick = 1) {
        let m = this.rings.find((q) => !q.visible) || this.rings[0];
        m.visible = true; m.userData.t = 0; m.userData.life = life; m.userData.r = maxR; m.userData.th = thick;
        m.material.color.set(color); m.position.set(x, (y ?? this.h(x, z)) + 0.5, z); m.scale.setScalar(0.5);
    }
    fireball(x, y, z, r, life, color = 0xff8a30) {
        const m = this.fireballs.find((q) => !q.visible) || this.fireballs[0];
        m.visible = true; m.userData.t = 0; m.userData.life = life; m.userData.r = r; m.material.color.set(color); m.position.set(x, y, z); m.scale.setScalar(0.3);
    }
    scorch(x, z, r) {
        const h = this.h, n = new THREE.Vector3((h(x - 1, z) - h(x + 1, z)) / 2, 1, (h(x, z - 1) - h(x, z + 1)) / 2).normalize();
        const o = this.tmp; o.position.set(x, h(x, z) + 0.07, z);
        o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); o.rotateZ(Math.random() * 6.28);
        o.scale.setScalar(r * 0.8 + 0.5); o.updateMatrix();
        this.decals.setMatrixAt(this.decHead, o.matrix); this.decHead = (this.decHead + 1) % this.decN; this.decals.instanceMatrix.needsUpdate = true;
    }
    debris(x, y, z, n, color, speed = 10, glowing = false) {
        n = Math.round(n * this.scale);
        for (let k = 0; k < n; k++) {
            const i = this.dHead, d = this.d; this.dHead = (this.dHead + 1) % this.dN;
            const a = Math.random() * 6.28, up = 0.4 + Math.random() * 0.9, s = speed * (0.4 + Math.random() * 0.8);
            d.p[i * 3] = x + this.r(-0.5, 0.5); d.p[i * 3 + 1] = y; d.p[i * 3 + 2] = z + this.r(-0.5, 0.5);
            d.v[i * 3] = Math.cos(a) * s; d.v[i * 3 + 1] = up * s; d.v[i * 3 + 2] = Math.sin(a) * s;
            d.r[i * 3] = Math.random() * 6; d.r[i * 3 + 1] = Math.random() * 6; d.r[i * 3 + 2] = Math.random() * 6;
            d.w[i * 3] = this.r(-9, 9); d.w[i * 3 + 1] = this.r(-9, 9); d.w[i * 3 + 2] = this.r(-9, 9);
            d.life[i] = this.r(2.5, 4.5); d.size[i] = this.r(0.15, 0.5) * (speed > 14 ? 1.6 : 1); d.glowT[i] = glowing ? 1 : 0;
            _c.set(color).multiplyScalar(0.6 + Math.random() * 0.6); this.dMesh.setColorAt(i, _c);
        }
        if (this.dMesh.instanceColor) this.dMesh.instanceColor.needsUpdate = true;
    }

    // ------------------------------------------------------------------ composed effects
    sparks(x, y, z, n, color = 0xffd080, speed = 9) {
        n = Math.round(n * this.scale);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, e = Math.random() * 1.2, s = speed * (0.3 + Math.random());
            this.glow.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, this.r(0.25, 0.7), 0.22, 0.04, color, 0xff4000, 3, 0, 0.8, 18);
        }
    }
    puff(x, y, z, n, color, size = 1.5, rise = 2, life = 1.6) {
        n = Math.round(n * this.scale);
        for (let i = 0; i < n; i++) this.smoke.emit(x + this.r(-0.5, 0.5), y, z + this.r(-0.5, 0.5), this.r(-1.2, 1.2), this.r(0.5, rise), this.r(-1.2, 1.2), this.r(life * 0.6, life * 1.3), size * 0.6, size * 2.4, color, color, 0.55, 0, 1.2, -0.4);
    }
    dust(x, z, color = 0xb89a78, n = 3) { const y = this.h(x, z) + 0.2; for (let i = 0; i < n; i++) this.smoke.emit(x + this.r(-0.8, 0.8), y, z + this.r(-0.8, 0.8), this.r(-1, 1), this.r(0.4, 1.4), this.r(-1, 1), this.r(0.6, 1.2), 0.5, 1.6, color, color, 0.35, 0, 1.5, -0.3); }

    /** size 1..5. kind tints: 'plasma' green, 'ice', 'inf' alien ichor, 'mech' cyan sparks. */
    explosion(x, y, z, size = 2, kind = '', R = 4) {
        const S = size, col = kind === 'plasma' ? [0xbfffd0, 0x40ff80] : kind === 'phase' ? [0xdfe8ff, 0x80a0ff] : kind === 'erupt' || kind === 'ice' ? [0xe8f8ff, 0x80c8ff] : [0xfff2c0, 0xff8a20];
        const n = [0, 8, 16, 26, 40, 70][Math.min(5, S)] * this.scale;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, e = this.r(-0.2, 1.1), sp = this.r(1, 4 + S * 3.2);
            this.glow.emit(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1, Math.sin(a) * Math.cos(e) * sp, this.r(0.35, 0.7 + S * 0.22), this.r(1.0, 2.0) * (0.5 + S * 0.5), 0.3, col[0], col[1], 0.7, 0, 1.5, 2);
        }
        this.puff(x, y + 0.5, z, [0, 5, 10, 18, 28, 44][Math.min(5, S)], 0x2a2420, 1.4 + S * 0.7, 3 + S, 1.8 + S * 0.4);
        this.sparks(x, y, z, 6 + S * 7, kind === 'plasma' ? 0x80ffa0 : 0xffd080, 6 + S * 3);
        if (S >= 2) { this.debris(x, y, z, 3 + S * 3, 0x5a5048, 6 + S * 3, false); this.debris(x, y, z, S * 2, 0xff7a20, 5 + S * 2, true); this.scorch(x, z, R * 0.6 + S * 0.5); }
        if (S >= 2) this.ring(x, z, R * 1.4 + S * 2, 0.55 + S * 0.08, col[1], y - 0.2);
        if (S >= 3) { this.fireball(x, y + 0.5, z, 1.5 + S * 1.1, 0.5, col[1]); this.light(x, y + 3, z, col[1], 90 * S, 0.45); this.shake = Math.max(this.shake, 0.18 * S); }
        if (S >= 4) { this.ring(x, z, R * 3, 1.1, col[0], y); this.shake = Math.max(this.shake, 0.18 * S); for (let k = 0; k < 4; k++) this.debris(x + this.r(-2, 2), y + 1, z + this.r(-2, 2), 6, 0x403830, 14, false); }
    }
    ichor(x, y, z, n = 10) { for (let i = 0; i < n; i++) this.glow.emit(x, y, z, this.r(-6, 6), this.r(1, 7), this.r(-6, 6), this.r(0.3, 0.7), 0.3, 0.1, 0x9cff5a, 0x3a7a20, 1, 0, 0.6, 16); }
    muzzle(x, y, z, dx, dy, dz, color = 0xffd070, big = 1) {
        for (let i = 0; i < 5; i++) this.glow.emit(x + dx * 0.3, y + dy * 0.3, z + dz * 0.3, dx * this.r(4, 14) + this.r(-1.5, 1.5), dy * this.r(4, 14) + this.r(-1, 1), dz * this.r(4, 14) + this.r(-1.5, 1.5), this.r(0.05, 0.14), 0.7 * big, 0.1, color, 0xff6a00, 3, 0, 4);
    }
    impact(x, y, z, color = 0xffd080, ground = false) { this.sparks(x, y, z, 6, color, 6); if (ground) this.dust(x, z, 0x8a7a60, 1); }

    update(dt, camera) {
        this.glow.update(dt); this.smoke.update(dt);
        // debris physics
        const d = this.d, N = this.dN, o = this.tmp, h = this.h;
        for (let i = 0; i < N; i++) {
            if (d.life[i] <= 0) { if (d.size[i] > 0) { d.size[i] = 0; o.scale.set(0, 0, 0); o.updateMatrix(); this.dMesh.setMatrixAt(i, o.matrix); } continue; }
            d.life[i] -= dt;
            d.v[i * 3 + 1] -= 24 * dt;
            for (let c = 0; c < 3; c++) { d.p[i * 3 + c] += d.v[i * 3 + c] * dt; d.r[i * 3 + c] += d.w[i * 3 + c] * dt; }
            const gy = h(d.p[i * 3], d.p[i * 3 + 2]) + d.size[i] * 0.3;
            if (d.p[i * 3 + 1] < gy) { d.p[i * 3 + 1] = gy; d.v[i * 3 + 1] = Math.abs(d.v[i * 3 + 1]) * 0.35; d.v[i * 3] *= 0.7; d.v[i * 3 + 2] *= 0.7; for (let c = 0; c < 3; c++) d.w[i * 3 + c] *= 0.6; }
            if (d.glowT[i] && Math.random() < 0.3) this.glow.emit(d.p[i * 3], d.p[i * 3 + 1], d.p[i * 3 + 2], 0, 0.5, 0, 0.3, 0.5, 0.1, 0xff8a30, 0xff2000, 1.5, 0, 1, 0);
            else if (!d.glowT[i] && d.life[i] > 2.4 && Math.random() < 0.12) this.smoke.emit(d.p[i * 3], d.p[i * 3 + 1], d.p[i * 3 + 2], 0, 0.8, 0, 0.8, 0.3, 1.1, 0x2a2622, 0x2a2622, 0.4, 0, 1, -0.3);
            const s = d.size[i] * Math.min(1, d.life[i] * 2);
            o.position.set(d.p[i * 3], d.p[i * 3 + 1], d.p[i * 3 + 2]); o.rotation.set(d.r[i * 3], d.r[i * 3 + 1], d.r[i * 3 + 2]); o.scale.set(s, s, s); o.updateMatrix();
            this.dMesh.setMatrixAt(i, o.matrix);
        }
        this.dMesh.instanceMatrix.needsUpdate = true;
        for (const m of this.rings) if (m.visible) {
            const u = m.userData; u.t += dt; const k = u.t / u.life;
            if (k >= 1) { m.visible = false; continue; }
            m.scale.set(u.r * (0.2 + k * 0.8), 1, u.r * (0.2 + k * 0.8)); m.material.opacity = (1 - k) * 0.9;
        }
        for (const m of this.fireballs) if (m.visible) {
            const u = m.userData; u.t += dt; const k = u.t / u.life;
            if (k >= 1) { m.visible = false; continue; }
            m.scale.setScalar(u.r * (0.3 + Math.sqrt(k) * 0.9)); m.material.opacity = (1 - k) * (1 - k) * 0.55;
        }
        for (const l of this.lights) { const u = l.userData; if (u.t > 0) { u.t -= dt; l.intensity = Math.max(0, u.t / u.life) * u.peak; } else l.intensity = 0; }
        this.shake = Math.max(0, this.shake - dt * 1.6);
        void camera;
    }
    shakeOffset(t, out) {
        const s = this.shake * this.shake * 1.6;
        out.set(Math.sin(t * 61) * s, Math.sin(t * 73 + 1) * s, Math.sin(t * 53 + 2) * s * 0.3);
        return out;
    }
}
