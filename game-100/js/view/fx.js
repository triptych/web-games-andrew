// Effects that answer sim events: sparkle bursts, shockwave rings, lasers, lightning, confetti.
// Everything is pooled and drawn additively, and the colours go past 1 so bloom picks them up.
// Nothing here ever reads or writes the sim.

import * as THREE from 'three';

const MAX_P = 1800;

const PointsVS = /* glsl */`
    attribute float aSize; attribute float aLife; attribute vec3 aColor; attribute float aKind;
    uniform float uScale;
    varying float vLife; varying vec3 vColor; varying float vKind;
    void main() {
        vLife = aLife; vColor = aColor; vKind = aKind;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, aSize * uScale / max(-mv.z, 0.1) * (0.35 + 0.65 * aLife));
        gl_Position = projectionMatrix * mv;
    }`;
const PointsFS = /* glsl */`
    varying float vLife; varying vec3 vColor; varying float vKind;
    void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = length(p);
        float a;
        if (vKind < 0.5) a = smoothstep(1.0, 0.15, d);
        else {
            float s = exp(-abs(p.x) * 13.0) * exp(-abs(p.y) * 2.4) + exp(-abs(p.y) * 13.0) * exp(-abs(p.x) * 2.4);
            a = clamp(s + smoothstep(0.45, 0.0, d), 0.0, 1.0);
        }
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * 1.5, a * clamp(vLife * 1.6, 0.0, 1.0));
    }`;

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.t = 0;
        // ---- particles
        this.p = { n: 0, x: new Float32Array(MAX_P), y: new Float32Array(MAX_P), z: new Float32Array(MAX_P),
            vx: new Float32Array(MAX_P), vy: new Float32Array(MAX_P), vz: new Float32Array(MAX_P),
            life: new Float32Array(MAX_P), max: new Float32Array(MAX_P), size: new Float32Array(MAX_P),
            r: new Float32Array(MAX_P), g: new Float32Array(MAX_P), b: new Float32Array(MAX_P),
            kind: new Float32Array(MAX_P), grav: new Float32Array(MAX_P), drag: new Float32Array(MAX_P) };
        const geo = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage);
        this.aSize = new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage);
        this.aLife = new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage);
        this.aColor = new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage);
        this.aKind = new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', this.aPos);
        geo.setAttribute('aSize', this.aSize); geo.setAttribute('aLife', this.aLife);
        geo.setAttribute('aColor', this.aColor); geo.setAttribute('aKind', this.aKind);
        this.pointMat = new THREE.ShaderMaterial({
            vertexShader: PointsVS, fragmentShader: PointsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uScale: { value: 600 } },
        });
        this.points = new THREE.Points(geo, this.pointMat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 20;
        scene.add(this.points);

        // ---- rings
        this.rings = [];
        const ringGeo = new THREE.RingGeometry(0.955, 1, 64);
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
            m.visible = false; m.renderOrder = 18;
            scene.add(m);
            this.rings.push({ mesh: m, t: 0, dur: 1, size: 1, delay: 0, on: false });
        }
        // ---- lasers
        this.lasers = [];
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 8; i++) {
            const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
            m.visible = false; m.renderOrder = 19;
            scene.add(m);
            this.lasers.push({ mesh: m, t: 0, dur: 1, delay: 0, len: 1, w: 0.2, on: false, color: new THREE.Color() });
        }
        // ---- lightning bolts (one thin box each)
        this.bolts = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 64);
        this.bolts.frustumCulled = false; this.bolts.renderOrder = 19;
        this.bolts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
        this.bolts.count = 0;
        scene.add(this.bolts);
        this.boltList = [];
        // ---- confetti
        this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.22), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), 260);
        this.confetti.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(260 * 3), 3);
        this.confetti.frustumCulled = false; this.confetti.count = 0;
        scene.add(this.confetti);
        this.conf = [];
        this.tmp = new THREE.Object3D();
        this.q = new THREE.Quaternion();
        this.v = new THREE.Vector3();
        this.up = new THREE.Vector3(1, 0, 0);
        this.c = new THREE.Color();
    }

    setScale(h, fov) { this.pointMat.uniforms.uScale.value = h / (2 * Math.tan((fov * Math.PI) / 360)); }

    // ------------------------------------------------------------------ particles
    spawn(x, y, z, vx, vy, vz, life, size, color, kind = 0, grav = 0, drag = 1.2) {
        const p = this.p;
        if (p.n >= MAX_P) return;
        const i = p.n++;
        p.x[i] = x; p.y[i] = y; p.z[i] = z; p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
        p.life[i] = p.max[i] = life; p.size[i] = size;
        this.c.set(color); p.r[i] = this.c.r; p.g[i] = this.c.g; p.b[i] = this.c.b;
        p.kind[i] = kind; p.grav[i] = grav; p.drag[i] = drag;
    }

    /** A burst of sparks and glints from a point. */
    burst(pos, color, n = 14, speed = 3.2, size = 0.3) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.6;
            const s = speed * (0.35 + Math.random() * 0.9);
            this.spawn(pos.x, pos.y, pos.z + 0.2, Math.cos(a) * s, Math.sin(a) * s + 0.8, Math.sin(e) * s * 0.6, 0.45 + Math.random() * 0.45, size * (0.6 + Math.random() * 0.8), color, Math.random() < 0.45 ? 1 : 0, 4.5, 1.6);
        }
    }
    /** A shower of glints around a point that drift up (for specials, Fever). */
    glitter(pos, color, n = 4, spread = 0.5) {
        for (let i = 0; i < n; i++) {
            this.spawn(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread, pos.z + 0.3 + Math.random() * 0.3,
                (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.8, 0, 0.6 + Math.random() * 0.6, 0.22 + Math.random() * 0.25, color, 1, -0.2, 0.8);
        }
    }

    // ------------------------------------------------------------------ rings
    ring(pos, color, size = 3, dur = 0.55, delay = 0) {
        const r = this.rings.find((x) => !x.on) || this.rings[0];
        r.on = true; r.t = 0; r.dur = dur; r.size = size; r.delay = delay;
        r.mesh.position.copy(pos); r.mesh.position.z += 0.25;
        r.mesh.material.color.set(color).multiplyScalar(0.95);
        r.mesh.visible = false;
    }

    // ------------------------------------------------------------------ lasers and bolts
    laser(from, to, color, dur = 0.4, width = 0.26, delay = 0) {
        const l = this.lasers.find((x) => !x.on) || this.lasers[0];
        l.on = true; l.t = 0; l.dur = dur; l.delay = delay; l.w = width;
        l.mesh.position.copy(from).lerp(to, 0.5);
        l.mesh.position.z += 0.3;
        const d = this.v.copy(to).sub(from);
        l.len = d.length();
        l.mesh.quaternion.setFromUnitVectors(this.up, d.normalize());
        l.color.set(color).multiplyScalar(1.6);
        l.mesh.material.color.copy(l.color);
        l.mesh.visible = false;
    }
    bolt(from, to, color, dur = 0.4, delay = 0) {
        if (this.boltList.length >= 64) return;
        this.boltList.push({ from: from.clone(), to: to.clone(), t: -delay, dur, color: new THREE.Color(color).multiplyScalar(2.2) });
    }

    // ------------------------------------------------------------------ confetti
    shower(n = 80, spread = 9, y = 7) {
        const pal = [0xff2fa8, 0x2de2ff, 0xffd21f, 0xff7a1a, 0x9dff3a, 0x9b5cff, 0xffffff];
        for (let i = 0; i < n && this.conf.length < 260; i++) {
            this.conf.push({
                x: (Math.random() - 0.5) * spread, y: y + Math.random() * 3, z: 1.5 + Math.random() * 2.5,
                vx: (Math.random() - 0.5) * 1.2, vy: -(1.5 + Math.random() * 2), rx: Math.random() * 6, ry: Math.random() * 6,
                sx: 2 + Math.random() * 5, sy: 2 + Math.random() * 5, life: 3 + Math.random() * 2.2, color: pal[(Math.random() * pal.length) | 0],
            });
        }
    }

    // ------------------------------------------------------------------ frame
    update(dt) {
        this.t += dt;
        const p = this.p;
        let w = 0;
        for (let i = 0; i < p.n; i++) {
            const life = p.life[i] - dt;
            if (life <= 0) continue;
            const k = Math.exp(-p.drag[i] * dt);
            const vx = p.vx[i] * k, vy = (p.vy[i] - p.grav[i] * dt) * k, vz = p.vz[i] * k;
            const x = p.x[i] + vx * dt, y = p.y[i] + vy * dt, z = p.z[i] + vz * dt;
            // compact in place
            p.x[w] = x; p.y[w] = y; p.z[w] = z; p.vx[w] = vx; p.vy[w] = vy; p.vz[w] = vz; p.life[w] = life; p.max[w] = p.max[i];
            p.size[w] = p.size[i]; p.r[w] = p.r[i]; p.g[w] = p.g[i]; p.b[w] = p.b[i]; p.kind[w] = p.kind[i]; p.grav[w] = p.grav[i]; p.drag[w] = p.drag[i];
            w++;
        }
        p.n = w;
        for (let i = 0; i < w; i++) {
            this.aPos.setXYZ(i, p.x[i], p.y[i], p.z[i]);
            this.aSize.setX(i, p.size[i]);
            this.aLife.setX(i, p.life[i] / p.max[i]);
            this.aColor.setXYZ(i, p.r[i], p.g[i], p.b[i]);
            this.aKind.setX(i, p.kind[i]);
        }
        this.points.geometry.setDrawRange(0, w);
        for (const a of [this.aPos, this.aSize, this.aLife, this.aColor, this.aKind]) a.needsUpdate = true;

        for (const r of this.rings) {
            if (!r.on) continue;
            if (r.delay > 0) { r.delay -= dt; continue; }
            r.t += dt;
            const k = r.t / r.dur;
            if (k >= 1) { r.on = false; r.mesh.visible = false; continue; }
            r.mesh.visible = true;
            const e = 1 - Math.pow(1 - k, 3);
            r.mesh.scale.setScalar(0.2 + e * r.size);
            r.mesh.material.opacity = (1 - k) * (1 - k) * 0.8;
        }
        for (const l of this.lasers) {
            if (!l.on) continue;
            if (l.delay > 0) { l.delay -= dt; continue; }
            l.t += dt;
            const k = l.t / l.dur;
            if (k >= 1) { l.on = false; l.mesh.visible = false; continue; }
            l.mesh.visible = true;
            const th = l.w * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
            l.mesh.scale.set(l.len, th, th);
            l.mesh.material.opacity = Math.min(1, (1 - k) * 1.6);
        }
        let n = 0;
        for (let i = this.boltList.length - 1; i >= 0; i--) {
            const b = this.boltList[i];
            b.t += dt;
            if (b.t >= b.dur) { this.boltList.splice(i, 1); continue; }
        }
        for (const b of this.boltList) {
            if (b.t < 0 || n >= 64) continue;
            const d = this.v.copy(b.to).sub(b.from);
            const len = d.length();
            this.tmp.position.copy(b.from).lerp(b.to, 0.5);
            this.tmp.position.x += (Math.random() - 0.5) * 0.08;
            this.q.setFromUnitVectors(this.up, d.normalize());
            this.tmp.quaternion.copy(this.q);
            const flick = 0.5 + Math.random() * 0.5, th = 0.05 * (1 - b.t / b.dur) * flick + 0.012;
            this.tmp.scale.set(len, th, th);
            this.tmp.updateMatrix();
            this.bolts.setMatrixAt(n, this.tmp.matrix);
            this.bolts.setColorAt(n, b.color);
            n++;
        }
        this.bolts.count = n;
        this.bolts.instanceMatrix.needsUpdate = true;
        if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;

        let m = 0;
        for (let i = this.conf.length - 1; i >= 0; i--) {
            const c = this.conf[i];
            c.life -= dt;
            if (c.life <= 0 || c.y < -9) { this.conf.splice(i, 1); continue; }
        }
        for (const c of this.conf) {
            c.x += c.vx * dt; c.y += c.vy * dt; c.vx += Math.sin(this.t * 2 + c.rx) * dt * 0.8;
            c.rx += c.sx * dt; c.ry += c.sy * dt;
            this.tmp.position.set(c.x, c.y, c.z);
            this.tmp.rotation.set(c.rx, c.ry, 0);
            this.tmp.scale.setScalar(Math.min(1, c.life * 2));
            this.tmp.updateMatrix();
            this.confetti.setMatrixAt(m, this.tmp.matrix);
            this.c.set(c.color);
            this.confetti.setColorAt(m, this.c);
            m++;
        }
        this.confetti.count = m;
        this.confetti.instanceMatrix.needsUpdate = true;
        if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true;
    }
}
