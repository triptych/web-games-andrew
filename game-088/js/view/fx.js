// Effects for the dig: particles (sparkles that glow, dust that doesn't), flying shards, shock
// rings on the board, beams for trowels and lightning for the sunstone. Everything is pooled and
// drawn in a handful of draw calls. Positions are in board space (the board lies in XZ, y up).

import * as THREE from 'three';

const MAXP = 1600;

function pointsMaterial(additive) {
    return new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 400 } },
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: !additive,
        vertexShader: /* glsl */`
            attribute float aSize; attribute float aAlpha; attribute float aKind; attribute vec3 aColor;
            uniform float uScale;
            varying float vAlpha; varying float vKind; varying vec3 vColor;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * uScale / max(0.1, -mv.z);
                gl_Position = projectionMatrix * mv;
                vAlpha = aAlpha; vKind = aKind; vColor = aColor;
            }`,
        fragmentShader: /* glsl */`
            varying float vAlpha; varying float vKind; varying vec3 vColor;
            void main() {
                vec2 p = gl_PointCoord * 2.0 - 1.0;
                float d = length(p);
                float a;
                if (vKind > 1.5) {          // four-point sparkle
                    vec2 q = abs(p);
                    a = max(0.0, 1.0 - (q.x * 6.0 + q.y * 0.9)) + max(0.0, 1.0 - (q.y * 6.0 + q.x * 0.9));
                    a = clamp(a, 0.0, 1.0) + max(0.0, 1.0 - d * 2.2) * 0.6;
                } else if (vKind > 0.5) {   // soft round glow
                    a = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
                } else {                    // dust puff
                    a = smoothstep(1.0, 0.3, d) * 0.85;
                }
                if (a <= 0.003) discard;
                gl_FragColor = vec4(vColor, a * vAlpha);
            }`,
    });
}

class PointPool {
    constructor(scene, additive) {
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(MAXP * 3);
        this.col = new Float32Array(MAXP * 3);
        this.size = new Float32Array(MAXP);
        this.alpha = new Float32Array(MAXP);
        this.kind = new Float32Array(MAXP);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
        this.geo = g;
        this.mat = pointsMaterial(additive);
        this.mesh = new THREE.Points(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = additive ? 20 : 10;
        scene.add(this.mesh);
        this.list = [];
    }
    add(p) { if (this.list.length < MAXP) this.list.push(p); }
    update(dt) {
        const L = this.list;
        let w = 0;
        for (let i = 0; i < L.length; i++) {
            const p = L[i];
            p.age += dt;
            if (p.age >= p.life) continue;
            const drag = Math.exp(-p.drag * dt);
            p.vx *= drag; p.vy *= drag; p.vz *= drag;
            p.vy -= p.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < 0.02 && p.vy < 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
            const k = p.age / p.life;
            this.pos[w * 3] = p.x; this.pos[w * 3 + 1] = p.y; this.pos[w * 3 + 2] = p.z;
            this.col[w * 3] = p.r; this.col[w * 3 + 1] = p.g; this.col[w * 3 + 2] = p.b;
            this.size[w] = p.size * (p.grow ? 0.4 + k * 1.2 : 1 - k * 0.5);
            this.alpha[w] = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * p.a;
            this.kind[w] = p.kind;
            L[w++] = p;
        }
        L.length = w;
        this.geo.setDrawRange(0, w);
        for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aKind']) this.geo.attributes[name].needsUpdate = true;
    }
    clear() { this.list.length = 0; this.geo.setDrawRange(0, 0); }
}

const ringMat = (color) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: 0 }, uA: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uK; uniform float uA; varying vec2 vUv;
        void main() {
            float d = length(vUv - 0.5) * 2.0;
            float w = 0.12 + 0.2 * (1.0 - uK);
            float a = smoothstep(uK - w, uK, d) * smoothstep(uK + 0.04, uK, d);
            a += smoothstep(uK, 0.0, d) * 0.12 * (1.0 - uK);
            gl_FragColor = vec4(uColor * 1.6, a * uA);
        }`,
});

const beamMat = (color) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uA; varying vec2 vUv;
        void main() {
            float y = abs(vUv.y - 0.5) * 2.0;
            float x = min(vUv.x, 1.0 - vUv.x) * 2.0;
            float core = smoothstep(0.25, 0.0, y);
            float halo = pow(clamp(1.0 - y, 0.0, 1.0), 2.0) * 0.5;
            float a = (core + halo) * smoothstep(0.0, 0.08, x);
            gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.7) * 1.8, a * uA);
        }`,
});

export class Fx {
    constructor(scene) {
        this.scene = scene;
        this.glow = new PointPool(scene, true);
        this.dust = new PointPool(scene, false);
        // shards
        this.MAXS = 260;
        const sg = new THREE.TetrahedronGeometry(0.09, 0);
        this.shardMesh = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, flatShading: true }), this.MAXS);
        this.shardMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.MAXS * 3), 3);
        this.shardMesh.count = 0;
        this.shardMesh.castShadow = true;
        this.shardMesh.frustumCulled = false;
        scene.add(this.shardMesh);
        this.shards = [];
        this.tmp = new THREE.Object3D();
        // rings, beams, bolts
        this.rings = [];
        this.beams = [];
        this.bolts = [];
        this.ringGeo = new THREE.PlaneGeometry(1, 1);
        this.beamGeo = new THREE.PlaneGeometry(1, 1);
        this.c = new THREE.Color();
        this.light = new THREE.PointLight(0xffd59a, 0, 7, 1.6);
        this.light.position.set(0, 1.5, 0);
        scene.add(this.light);
        this.lightK = 0;
    }

    setScale(h, fov) { const s = h / (2 * Math.tan((fov * Math.PI) / 360)); this.glow.mat.uniforms.uScale.value = s; this.dust.mat.uniforms.uScale.value = s; }

    /** A burst of particles. kind: 'spark' (star, glows), 'glow' (soft, glows), 'dust' (soft, not lit). */
    burst(x, y, z, { n = 14, color = '#ffffff', speed = 3, up = 2, life = 0.7, size = 0.22, kind = 'spark', grav = 6, drag = 2.5, spread = 0.2, grow = false, alpha = 1 } = {}) {
        const pool = kind === 'dust' ? this.dust : this.glow;
        this.c.set(color);
        const k = kind === 'spark' ? 2 : kind === 'glow' ? 1 : 0;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
            pool.add({
                x: x + (Math.random() - 0.5) * spread, y, z: z + (Math.random() - 0.5) * spread,
                vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s,
                age: 0, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8),
                r: this.c.r, g: this.c.g, b: this.c.b, kind: k, grav, drag, grow, a: alpha,
            });
        }
    }

    /** Little flying chips that tumble and bounce. */
    shatter(x, y, z, color, n = 8, speed = 3) {
        this.c.set(color);
        for (let i = 0; i < n && this.shards.length < this.MAXS; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
            this.shards.push({
                x, y, z, vx: Math.cos(a) * s, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * s,
                rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 20, wy: (Math.random() - 0.5) * 20,
                age: 0, life: 0.8 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.9,
                r: this.c.r * (0.8 + Math.random() * 0.3), g: this.c.g * (0.8 + Math.random() * 0.3), b: this.c.b * (0.8 + Math.random() * 0.3),
            });
        }
    }

    ring(x, z, color = '#ffe6a0', radius = 1.6, life = 0.45, y = 0.06) {
        let r = this.rings.find((q) => !q.mesh.visible);
        if (!r) {
            r = { mesh: new THREE.Mesh(this.ringGeo, ringMat(color)) };
            r.mesh.rotation.x = -Math.PI / 2;
            r.mesh.renderOrder = 15;
            this.scene.add(r.mesh);
            this.rings.push(r);
        }
        r.mesh.material.uniforms.uColor.value.set(color);
        r.mesh.position.set(x, y, z);
        r.mesh.visible = true;
        Object.assign(r, { age: 0, life, radius });
    }

    /** A glowing beam from (x1, z1) to (x2, z2) along the board. */
    beam(x1, z1, x2, z2, color = '#fff0b0', width = 0.9, life = 0.42) {
        let b = this.beams.find((q) => !q.mesh.visible);
        if (!b) {
            b = { mesh: new THREE.Mesh(this.beamGeo, beamMat(color)) };
            b.mesh.renderOrder = 16;
            this.scene.add(b.mesh);
            this.beams.push(b);
        }
        b.mesh.material.uniforms.uColor.value.set(color);
        const len = Math.hypot(x2 - x1, z2 - z1);
        b.mesh.position.set((x1 + x2) / 2, 0.55, (z1 + z2) / 2);
        b.mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(z2 - z1, x2 - x1));
        b.mesh.visible = true;
        Object.assign(b, { age: 0, life, len, width });
    }

    /** Jagged lightning from a to b (board space, at tile height). */
    bolt(x1, z1, x2, z2, color = '#fff2b0', life = 0.35, delay = 0) {
        let b = this.bolts.find((q) => !q.mesh.visible);
        if (!b) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 2 * 3), 3));
            const idx = [];
            for (let i = 0; i < 11; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
            geo.setIndex(idx);
            b = { mesh: new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })) };
            b.mesh.frustumCulled = false;
            b.mesh.renderOrder = 17;
            this.scene.add(b.mesh);
            this.bolts.push(b);
        }
        b.mesh.material.color.set(color);
        b.mesh.visible = false;
        Object.assign(b, { age: -delay, life, x1, z1, x2, z2, t: 0 });
    }

    /** A flash of warm light on the board. */
    flashLight(x, z, k = 1) { this.light.position.set(x, 1.6, z); this.lightK = Math.max(this.lightK, k); }

    update(dt) {
        this.glow.update(dt);
        this.dust.update(dt);
        // shards
        let w = 0;
        for (const s of this.shards) {
            s.age += dt;
            if (s.age >= s.life) continue;
            s.vy -= 14 * dt;
            s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
            if (s.y < 0.05) { s.y = 0.05; s.vy = Math.abs(s.vy) * 0.35; s.vx *= 0.6; s.vz *= 0.6; s.wx *= 0.6; }
            s.rx += s.wx * dt; s.ry += s.wy * dt;
            const k = 1 - Math.max(0, (s.age - s.life * 0.6) / (s.life * 0.4));
            this.tmp.position.set(s.x, s.y, s.z);
            this.tmp.rotation.set(s.rx, s.ry, 0);
            this.tmp.scale.setScalar(s.s * k);
            this.tmp.updateMatrix();
            this.shardMesh.setMatrixAt(w, this.tmp.matrix);
            this.shardMesh.instanceColor.setXYZ(w, s.r, s.g, s.b);
            this.shards[w++] = s;
        }
        this.shards.length = w;
        this.shardMesh.count = w;
        this.shardMesh.instanceMatrix.needsUpdate = true;
        this.shardMesh.instanceColor.needsUpdate = true;
        for (const r of this.rings) {
            if (!r.mesh.visible) continue;
            r.age += dt;
            const k = Math.min(1, r.age / r.life);
            if (k >= 1) { r.mesh.visible = false; continue; }
            const e = 1 - (1 - k) ** 3;
            r.mesh.scale.setScalar(r.radius * 2 * (0.2 + e * 0.8));
            r.mesh.material.uniforms.uK.value = 0.55 + e * 0.4;
            r.mesh.material.uniforms.uA.value = 1 - k;
        }
        for (const b of this.beams) {
            if (!b.mesh.visible) continue;
            b.age += dt;
            const k = b.age / b.life;
            if (k >= 1) { b.mesh.visible = false; continue; }
            const grow = Math.min(1, b.age / 0.08);
            b.mesh.scale.set(b.len * grow, b.width * (1 - k * 0.6), 1);
            b.mesh.material.uniforms.uA.value = 1 - k * k;
        }
        for (const b of this.bolts) {
            if (b.age >= b.life) { b.mesh.visible = false; continue; }
            b.age += dt;
            if (b.age < 0) continue;
            b.mesh.visible = true;
            b.t += dt;
            if (b.t > 0.04 || b.age - dt < 0) {
                b.t = 0;
                const p = b.mesh.geometry.attributes.position;
                const dx = b.x2 - b.x1, dz = b.z2 - b.z1, len = Math.hypot(dx, dz) || 1;
                const nx = -dz / len, nz = dx / len;
                for (let i = 0; i < 12; i++) {
                    const t = i / 11;
                    const j = i === 0 || i === 11 ? 0 : (Math.random() - 0.5) * 0.45;
                    const w2 = 0.05 * (1 - Math.abs(t - 0.5));
                    const x = b.x1 + dx * t + nx * j, z = b.z1 + dz * t + nz * j, y = 0.6 + Math.sin(t * Math.PI) * 0.5;
                    p.setXYZ(i * 2, x - nx * w2, y, z - nz * w2);
                    p.setXYZ(i * 2 + 1, x + nx * w2, y, z + nz * w2);
                }
                p.needsUpdate = true;
            }
            b.mesh.material.opacity = 1 - b.age / b.life;
        }
        this.lightK = Math.max(0, this.lightK - dt * 4);
        this.light.intensity = this.lightK * 30;
    }

    clear() {
        this.glow.clear(); this.dust.clear();
        this.shards.length = 0; this.shardMesh.count = 0;
        for (const q of [...this.rings, ...this.beams, ...this.bolts]) q.mesh.visible = false;
        this.lightK = 0;
    }
}
