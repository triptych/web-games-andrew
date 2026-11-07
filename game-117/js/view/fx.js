// Bolts, sparks, debris, shock rings and flash lights. Everything here is pooled and instanced:
// one draw call per kind no matter how much is going on.

import * as THREE from 'three';

const MAXB = 400, MAXP = 900, MAXD = 160, RINGS = 8;
const _o = new THREE.Object3D(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Color();

export class Fx {
    constructor(scene) {
        this.scene = scene;
        // player bolts: long, white-blue; enemy bolts: round, hot orange
        const pb = new THREE.CapsuleGeometry(0.07, 0.7, 2, 8);
        pb.rotateX(Math.PI / 2);
        this.pBolts = new THREE.InstancedMesh(pb, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 3.2, 4.5) }), MAXB);
        this.eBolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 1.3, 0.35) }), MAXB);
        const halo = new THREE.SphereGeometry(0.42, 12, 8);
        this.eHalo = new THREE.InstancedMesh(halo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.18, 0.05), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), MAXB);
        for (const m of [this.pBolts, this.eBolts, this.eHalo]) { m.count = 0; m.frustumCulled = false; scene.add(m); }

        // sparks: camera-facing quads, additive, coloured per instance
        const pg = new THREE.PlaneGeometry(1, 1);
        const pm = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: `varying vec2 vUv; varying vec3 vC;
void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec2 vUv; varying vec3 vC;
void main(){ float d = length(vUv - 0.5) * 2.0; float a = clamp(1.0 - d, 0.0, 1.0); gl_FragColor = vec4(vC * a * a, 1.0); }`,
        });
        this.parts = new THREE.InstancedMesh(pg, pm, MAXP);
        this.parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
        this.parts.count = 0; this.parts.frustumCulled = false;
        scene.add(this.parts);
        this.p = [];

        // debris: tumbling chunks that fall back to the rock
        this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xcfcac2, roughness: 0.5 }), MAXD);
        this.debris.count = 0; this.debris.frustumCulled = false; this.debris.castShadow = true;
        scene.add(this.debris);
        this.d = [];

        this.rings = [];
        for (let i = 0; i < RINGS; i++) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            m.visible = false;
            scene.add(m);
            this.rings.push({ m, t: 1, life: 1, size: 1, col: new THREE.Color() });
        }
        this.ri = 0;
    }

    clear() { this.p.length = 0; this.d.length = 0; for (const r of this.rings) r.m.visible = false; }

    /** Burst of sparks at world point pos (Vector3), pushed out along normal up (unit Vector3). */
    sparks(pos, up, n, col, speed = 6, size = 0.25, life = 0.5) {
        for (let i = 0; i < n && this.p.length < MAXP; i++) {
            const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
            v.addScaledVector(up, speed * 0.4 * Math.random());
            this.p.push({ pos: pos.clone(), v, life: life * (0.6 + Math.random() * 0.6), t: 0, size: size * (0.6 + Math.random() * 0.8), col: new THREE.Color(col), drag: 2.5 });
        }
    }
    glow(pos, col, size, life) {
        if (this.p.length >= MAXP) return;
        this.p.push({ pos: pos.clone(), v: new THREE.Vector3(), life, t: 0, size, col: new THREE.Color(col), drag: 0, grow: 1 });
    }
    chunks(pos, up, n, scale = 0.18) {
        for (let i = 0; i < n && this.d.length < MAXD; i++) {
            const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(3 + Math.random() * 4);
            v.addScaledVector(up, 4 + Math.random() * 3);
            this.d.push({ pos: pos.clone(), v, rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), s: scale * (0.5 + Math.random()), life: 2.5 + Math.random(), t: 0 });
        }
    }
    ring(pos, up, size, col, life = 0.6) {
        const r = this.rings[this.ri++ % RINGS];
        r.m.position.copy(pos).addScaledVector(up, 0.08);
        r.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
        r.t = 0; r.life = life; r.size = size; r.col.set(col);
        r.m.visible = true;
    }
    /** A flash of light: a big soft additive glow (real point lights cost too much per pixel). */
    flashLight(pos, col, power, life = 0.35) {
        this.glow(pos, col, Math.min(16, 2 + power * 0.04), life);
    }

    /** Draw the sim's bullets. R = asteroid radius. */
    bolts(G, R) {
        let np = 0, ne = 0;
        for (const b of G.bullets) {
            const h = b.own ? 0.95 : 0.9;
            _o.position.set(b.p[0] * (R + h), b.p[1] * (R + h), b.p[2] * (R + h));
            _v.set(b.d[0], b.d[1], b.d[2]);
            _o.up.set(b.p[0], b.p[1], b.p[2]);
            _o.lookAt(_o.position.x + _v.x, _o.position.y + _v.y, _o.position.z + _v.z);
            _o.scale.setScalar(1);
            _o.updateMatrix();
            if (b.own) { if (np < MAXB) this.pBolts.setMatrixAt(np++, _o.matrix); }
            else if (ne < MAXB) { this.eBolts.setMatrixAt(ne, _o.matrix); this.eHalo.setMatrixAt(ne, _o.matrix); ne++; }
        }
        this.pBolts.count = np; this.eBolts.count = ne; this.eHalo.count = ne;
        this.pBolts.instanceMatrix.needsUpdate = true;
        this.eBolts.instanceMatrix.needsUpdate = true;
        this.eHalo.instanceMatrix.needsUpdate = true;
    }

    update(dt, camera, R) {
        // sparks
        camera.getWorldQuaternion(_q);
        let n = 0;
        for (let i = this.p.length - 1; i >= 0; i--) {
            const p = this.p[i];
            p.t += dt;
            if (p.t >= p.life) { this.p.splice(i, 1); continue; }
            p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
            p.pos.addScaledVector(p.v, dt);
        }
        for (const p of this.p) {
            const k = 1 - p.t / p.life;
            _o.position.copy(p.pos);
            _o.quaternion.copy(_q);
            _o.scale.setScalar(p.size * (p.grow ? 0.4 + (p.t / p.life) * 1.2 : 0.4 + k * 0.6));
            _o.updateMatrix();
            this.parts.setMatrixAt(n, _o.matrix);
            _c.copy(p.col).multiplyScalar(k);
            this.parts.setColorAt(n, _c);
            n++;
        }
        this.parts.count = n;
        this.parts.instanceMatrix.needsUpdate = true;
        if (this.parts.instanceColor) this.parts.instanceColor.needsUpdate = true;
        // debris: fall toward the centre, bounce off the surface
        let m = 0;
        for (let i = this.d.length - 1; i >= 0; i--) {
            const d = this.d[i];
            d.t += dt;
            if (d.t >= d.life) { this.d.splice(i, 1); continue; }
            _v.copy(d.pos).normalize();
            d.v.addScaledVector(_v, -9 * dt);
            d.pos.addScaledVector(d.v, dt);
            const r = d.pos.length();
            if (r < R + d.s * 0.5) {
                d.pos.setLength(R + d.s * 0.5);
                const vn = d.v.dot(_v);
                if (vn < 0) d.v.addScaledVector(_v, -vn * 1.5).multiplyScalar(0.6);
                d.spin.multiplyScalar(0.7);
            }
            d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt;
        }
        for (const d of this.d) {
            const k = Math.min(1, (d.life - d.t) * 2);
            _o.position.copy(d.pos);
            _o.rotation.copy(d.rot);
            _o.scale.setScalar(d.s * k);
            _o.updateMatrix();
            this.debris.setMatrixAt(m++, _o.matrix);
        }
        this.debris.count = m;
        this.debris.instanceMatrix.needsUpdate = true;
        for (const r of this.rings) {
            if (!r.m.visible) continue;
            r.t += dt;
            const k = r.t / r.life;
            if (k >= 1) { r.m.visible = false; continue; }
            r.m.scale.setScalar(0.2 + r.size * (1 - (1 - k) * (1 - k)));
            r.m.material.color.copy(r.col).multiplyScalar((1 - k) * 1.5);
        }
    }
}
