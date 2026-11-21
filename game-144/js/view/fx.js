// Effects: bullets and shots (one instanced draw call each, shaped in the fragment shader), particles (a fixed
// point pool), tumbling debris, shockwave rings, enemy beam lasers and score stars. Reads sim state; never writes it.

import * as THREE from 'three';
import { wx, wy } from './stage.js';

// palette for bullet colour indices (c in the sim): rose, azure, violet, amber, jade, white
export const BULLET_COLS = [0xff3a6a, 0x3ab8ff, 0xb05aff, 0xffb02a, 0x3aff9a, 0xf0f4ff].map((c) => new THREE.Color(c));
const KIND = { orb: 0, rice: 1, needle: 2, big: 3, star: 4, vulcan: 5, lance: 6, needleP: 7, rocket: 8, blade: 9, phantom: 10, refl: 11 };

const QUAD_VS = `
    attribute vec3 iPos; attribute vec2 iDir; attribute vec3 iCol; attribute vec2 iSize; attribute float iKind;
    varying vec2 vUv; varying vec3 vCol; varying float vKind;
    void main(){
        vUv = uv; vCol = iCol; vKind = iKind;
        vec4 c = modelViewMatrix * vec4(iPos, 1.0);
        vec2 d = normalize(iDir + vec2(1e-5, 0.0));
        vec2 p = position.xy * iSize;
        c.xy += vec2(p.x * d.x - p.y * d.y, p.x * d.y + p.y * d.x);
        gl_Position = projectionMatrix * c;
    }`;
const QUAD_FS = `
    varying vec2 vUv; varying vec3 vCol; varying float vKind;
    void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float k = vKind, a = 0.0; vec3 col = vCol;
        if (k < 0.5 || k > 2.5 && k < 3.5) {            // orb / big: a white core inside a coloured ring
            float d = length(p);
            float cr = k > 2.5 ? 0.3 : 0.45;
            float core = smoothstep(cr, cr - 0.18, d);
            float ring = smoothstep(1.0, 0.7, d) * (1.0 - core);
            a = clamp(core + ring, 0.0, 1.0);
            col = mix(vCol * 1.5, vec3(1.4), core);
        } else if (k < 2.5) {                             // rice / needle: an elongated glint
            float d = length(p * vec2(1.0, k < 1.5 ? 2.0 : 3.2));
            float core = smoothstep(0.5, 0.2, d);
            a = clamp(smoothstep(1.0, 0.5, d), 0.0, 1.0);
            col = mix(vCol * 1.6, vec3(1.6), core);
        } else if (k < 4.5) {                             // star (score items)
            float ang = atan(p.y, p.x);
            float r = length(p) / (0.55 + 0.45 * abs(cos(ang * 2.5)));
            a = smoothstep(1.0, 0.6, r);
            col = mix(vCol * 2.0, vec3(2.0), smoothstep(0.5, 0.0, length(p)));
        } else {                                           // player shots: hot streaks
            float d = length(p * vec2(1.0, 2.6));
            a = smoothstep(1.0, 0.3, d);
            col = mix(vCol * 2.2, vec3(2.4), smoothstep(0.55, 0.1, d));
        }
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * a, a);
    }`;

class QuadBatch {
    constructor(scene, max, blending = THREE.AdditiveBlending, order = 5) {
        const base = new THREE.PlaneGeometry(1, 1);
        const g = new THREE.InstancedBufferGeometry();
        g.index = base.index;
        g.setAttribute('position', base.attributes.position);
        g.setAttribute('uv', base.attributes.uv);
        this.pos = new Float32Array(max * 3); this.dir = new Float32Array(max * 2); this.col = new Float32Array(max * 3);
        this.size = new Float32Array(max * 2); this.kind = new Float32Array(max);
        const A = (arr, n) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('iPos', A(this.pos, 3)); g.setAttribute('iDir', A(this.dir, 2)); g.setAttribute('iCol', A(this.col, 3));
        g.setAttribute('iSize', A(this.size, 2)); g.setAttribute('iKind', A(this.kind, 1));
        g.instanceCount = 0;
        this.geo = g; this.max = max; this.n = 0;
        this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: QUAD_FS, transparent: true, depthWrite: false, blending, toneMapped: false }));
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = order;
        scene.add(this.mesh);
    }
    begin() { this.n = 0; }
    push(x, y, z, dx, dy, col, sx, sy, kind) {
        if (this.n >= this.max) return;
        const i = this.n++;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.dir[i * 2] = dx; this.dir[i * 2 + 1] = dy;
        this.col[i * 3] = col.r; this.col[i * 3 + 1] = col.g; this.col[i * 3 + 2] = col.b;
        this.size[i * 2] = sx; this.size[i * 2 + 1] = sy;
        this.kind[i] = kind;
    }
    end() {
        this.geo.instanceCount = this.n;
        for (const k of ['iPos', 'iDir', 'iCol', 'iSize', 'iKind']) this.geo.attributes[k].needsUpdate = true;
    }
}

// ---------------------------------------------------------------------------- particles
const P_VS = `
    attribute vec3 aCol; attribute float aSize; attribute float aAlpha; uniform float uPx; varying vec3 vCol; varying float vA;
    void main(){ vCol = aCol; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPx * (300.0 / max(1.0, -mv.z)), 0.0, 96.0); }`;
const P_FS = `varying vec3 vCol; varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = clamp(1.0 - d, 0.0, 1.0); a = a * a * vA; if (a < 0.005) discard; gl_FragColor = vec4(vCol * a, a); }`;

class Particles {
    constructor(scene, max) {
        this.max = max;
        this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
        this.s = new Float32Array(max); this.a = new Float32Array(max); this.life = new Float32Array(max); this.max0 = new Float32Array(max);
        this.drag = new Float32Array(max); this.grow = new Float32Array(max); this.s0 = new Float32Array(max);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aCol', new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({ vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } }, toneMapped: false });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 6;
        scene.add(this.points);
        this.i = 0;
        this.rnd = 1;
    }
    r() { this.rnd = (this.rnd * 16807) % 2147483647; return this.rnd / 2147483647; }
    emit(x, y, z, vx, vy, vz, col, size, life, drag = 2, grow = 0) {
        const i = this.i; this.i = (this.i + 1) % this.max;
        this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
        this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
        this.c[i * 3] = col.r; this.c[i * 3 + 1] = col.g; this.c[i * 3 + 2] = col.b;
        this.s0[i] = size; this.s[i] = size; this.life[i] = life; this.max0[i] = life; this.drag[i] = drag; this.grow[i] = grow; this.a[i] = 1;
    }
    update(dt, px) {
        this.mat.uniforms.uPx.value = px;
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) { this.a[i] = 0; continue; }
            this.life[i] -= dt;
            const k = Math.max(0, this.life[i] / this.max0[i]);
            const dr = Math.exp(-this.drag[i] * dt);
            this.v[i * 3] *= dr; this.v[i * 3 + 1] *= dr; this.v[i * 3 + 2] *= dr;
            this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
            this.a[i] = k;
            this.s[i] = this.s0[i] * (1 + this.grow[i] * (1 - k));
        }
        for (const n of ['position', 'aCol', 'aSize', 'aAlpha']) this.geo.attributes[n].needsUpdate = true;
    }
}

// ---------------------------------------------------------------------------- shockwave rings, beams
const RING_FS = `uniform float uT; uniform vec3 uCol; varying vec2 vUv;
    void main(){ float d = length(vUv - 0.5) * 2.0; float w = 0.18 * (1.0 - uT) + 0.02; float a = smoothstep(w, 0.0, abs(d - 0.85)) * (1.0 - uT);
        if (a < 0.01) discard; gl_FragColor = vec4(uCol * a * 2.0, a); }`;
const BEAM_FS = `uniform float uT, uWarm, uLife, uTime; uniform vec3 uCol; varying vec2 vUv;
    void main(){
        float y = abs(vUv.y - 0.5) * 2.0;
        float warm = step(uT, uWarm);
        float flick = 0.7 + 0.3 * sin(uTime * 60.0 + vUv.x * 40.0);
        float a; vec3 col;
        if (warm > 0.5) { a = smoothstep(0.12, 0.0, y) * (0.35 + 0.5 * fract(uTime * 8.0)) * (uT / uWarm); col = uCol * 1.5; }
        else { float k = clamp((uWarm + uLife - uT) * 4.0, 0.0, 1.0); float core = smoothstep(0.35, 0.0, y); a = (smoothstep(1.0, 0.2, y) * 0.8 + core) * k * flick; col = mix(uCol * 2.2, vec3(2.6), core); }
        a *= smoothstep(0.0, 0.02, vUv.x);
        if (a < 0.01) discard; gl_FragColor = vec4(col * a, a); }`;
const VS_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

export class FX {
    constructor(stage) {
        this.stage = stage;
        const scene = stage.scene;
        const low = stage.quality === 'low';
        this.bullets = new QuadBatch(scene, 1500, THREE.AdditiveBlending, 7);
        this.shots = new QuadBatch(scene, 700, THREE.AdditiveBlending, 6);
        this.gems = new QuadBatch(scene, 300, THREE.AdditiveBlending, 6);
        this.parts = new Particles(scene, low ? 1800 : 6000);
        // debris: small tumbling shards
        this.debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: 0.4, metalness: 0.8, emissive: 0xff5020, emissiveIntensity: 0.25 }), low ? 60 : 160);
        this.debris.frustumCulled = false;
        this.debris.count = 0;
        this.deb = [];
        scene.add(this.debris);
        this.rings = [];
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: VS_UV, fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uT: { value: 1 }, uCol: { value: new THREE.Color() } } }));
            m.visible = false; m.renderOrder = 8; scene.add(m);
            this.rings.push({ m, t: 1, dur: 0.5, size: 4 });
        }
        this.beamMeshes = [];
        this.tmp = new THREE.Object3D();
        this.tmpC = new THREE.Color();
    }

    // ------------------------------------------------------------------ emitters
    burst(x, y, color, n = 20, speed = 8, life = 0.6, size = 0.6, z = 0.5) {
        const c = this.tmpC.set(color);
        const P = this.parts;
        for (let i = 0; i < n; i++) {
            const a = P.r() * Math.PI * 2, s = speed * (0.3 + P.r() * 0.9), e = (P.r() - 0.5) * speed * 0.5;
            P.emit(wx(x), wy(y), z, Math.cos(a) * s, Math.sin(a) * s, e, c, size * (0.5 + P.r()), life * (0.5 + P.r() * 0.8), 2.2);
        }
    }
    explosion(x, y, r = 1, color = 0xff7a30) {
        const P = this.parts;
        const hot = this.tmpC;
        // a white flash, fireballs, sparks, smoke and shards
        hot.setRGB(2.2, 1.9, 1.6); P.emit(wx(x), wy(y), 1, 0, 0, 0, hot, 2.4 * r, 0.1, 0, 1);
        this.burst(x, y, color, Math.round(14 + r * 18), 5 * r + 4, 0.55, 0.9 * Math.sqrt(r));
        this.burst(x, y, 0xffe0a0, Math.round(10 + r * 14), 10 * r + 6, 0.35, 0.3);
        hot.set(0x40302a);
        for (let i = 0; i < 6 + r * 4; i++) { const a = P.r() * 6.28; P.emit(wx(x), wy(y), 0, Math.cos(a) * r * 2, Math.sin(a) * r * 2, 0, hot, 1.4 * r, 1.1, 1.5, 1.5); }
        this.ring(x, y, 2.5 * r + 1.5, color, 0.45);
        this.shards(x, y, Math.round(1 + r * 2.5), r);
    }
    shards(x, y, n, r = 1) {
        for (let i = 0; i < n && this.deb.length < this.debris.instanceMatrix.count; i++) {
            const a = this.parts.r() * 6.28, s = (2 + this.parts.r() * 6) * Math.sqrt(r);
            this.deb.push({ x: wx(x), y: wy(y), z: (this.parts.r() - 0.5) * 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (this.parts.r() - 0.5) * 4, rx: 0, ry: 0, sx: this.parts.r() * 8, sy: this.parts.r() * 8, t: 0.7 + this.parts.r() * 0.6, s: 0.5 + this.parts.r() * r * 0.8 });
        }
    }
    ring(x, y, size, color, dur = 0.5) {
        let R = this.rings[0];
        for (const r of this.rings) if (r.t > R.t) R = r;
        R.t = 0; R.dur = dur; R.size = size;
        R.m.position.set(wx(x), wy(y), 0.3);
        R.m.material.uniforms.uCol.value.set(color);
        R.m.visible = true;
    }
    trail(x, y, color, n = 1, spread = 0.2, back = 6) {
        const c = this.tmpC.set(color);
        for (let i = 0; i < n; i++) this.parts.emit(wx(x) + (this.parts.r() - 0.5) * spread, wy(y) + (this.parts.r() - 0.5) * spread, 0, -back - this.parts.r() * 3, (this.parts.r() - 0.5) * 1.5, 0, c, 0.35 + this.parts.r() * 0.3, 0.25 + this.parts.r() * 0.2, 3);
    }

    // ------------------------------------------------------------------ per frame
    frame(G, dt, time, pilotCol) {
        const slow = G.player.chronoT > 0;
        // enemy bullets
        const B = this.bullets;
        B.begin();
        for (const b of G.bullets) {
            const col = BULLET_COLS[b.c % 6];
            const k = KIND[b.k] ?? 0;
            const s = b.r * (k === 3 ? 2.8 : 3.3) * (slow ? 1.1 : 1);
            const elong = k === 1 ? 2.2 : k === 2 ? 3.2 : 1;
            B.push(wx(b.x), wy(b.y), 0.4, b.vx, -b.vy, col, s * elong, s, k);
        }
        B.end();
        // player shots
        const S = this.shots;
        S.begin();
        const pc = this.tmpC.set(pilotCol);
        const pcol = new THREE.Color(pc.r, pc.g, pc.b);
        for (const s of G.shots) {
            const k = KIND[s.k === 'needle' ? 'needleP' : s.k] ?? 5;
            const col = s.k === 'rocket' ? ROCKET : s.k === 'blade' ? BLADE : s.k === 'phantom' ? PHANTOM : pcol;
            const len = s.k === 'lance' ? 2.4 : s.k === 'vulcan' ? 1.1 : s.k === 'blade' ? 1.6 : 0.9;
            const wid = s.k === 'lance' ? 0.42 : s.k === 'rocket' ? 0.5 : s.k === 'phantom' ? 0.8 : 0.36;
            S.push(wx(s.x), wy(s.y), 0.2, s.vx, -s.vy, col, len, wid, k);
            if (s.k === 'rocket' && this.parts.r() < 0.5) this.trail(s.x, s.y, 0xffa050, 1, 0.1, 2);
            if (s.k === 'phantom' && this.parts.r() < 0.3) this.trail(s.x, s.y, 0xc77dff, 1, 0.2, 1);
        }
        S.end();
        // stars
        const Gm = this.gems;
        Gm.begin();
        for (const it of G.items) if (it.kind === 'gem') Gm.push(wx(it.x), wy(it.y), 0.3, Math.cos(time * 3 + it.id), Math.sin(time * 3 + it.id), it.auto ? GEM_B : GEM_A, 0.45, 0.45, 4);
        Gm.end();

        // beams
        while (this.beamMeshes.length < G.beams.length) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: VS_UV, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uT: { value: 0 }, uWarm: { value: 1 }, uLife: { value: 1 }, uTime: { value: 0 }, uCol: { value: new THREE.Color() } } }));
            m.renderOrder = 7;
            this.stage.scene.add(m);
            this.beamMeshes.push(m);
        }
        this.beamMeshes.forEach((m, i) => {
            const bm = G.beams[i];
            m.visible = !!bm;
            if (!bm) return;
            const w = bm.t < bm.warm ? bm.w * 0.5 : bm.w * 1.7;
            m.scale.set(bm.len, w, 1);
            m.rotation.z = -bm.ang;
            m.position.set(wx(bm.x) + Math.cos(bm.ang) * bm.len / 2, wy(bm.y) - Math.sin(bm.ang) * bm.len / 2, 0.5);
            const u = m.material.uniforms;
            u.uT.value = bm.t; u.uWarm.value = bm.warm; u.uLife.value = bm.life; u.uTime.value = time;
            u.uCol.value.copy(BULLET_COLS[bm.c % 6]);
            if (bm.t >= bm.warm && this.parts.r() < 0.5) this.burst(bm.x, bm.y, BULLET_COLS[bm.c % 6].getHex(), 1, 4, 0.2, 0.6);
        });

        // rings
        for (const r of this.rings) {
            if (r.t >= 1) { r.m.visible = false; continue; }
            r.t = Math.min(1, r.t + dt / r.dur);
            const s = r.size * (0.25 + Math.pow(r.t, 0.6) * 1.0);
            r.m.scale.set(s, s, 1);
            r.m.material.uniforms.uT.value = r.t;
        }
        // debris
        const tmp = this.tmp;
        let n = 0;
        this.deb = this.deb.filter((d) => (d.t -= dt) > 0);
        for (const d of this.deb) {
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vx *= 0.99; d.vy *= 0.99; d.rx += d.sx * dt; d.ry += d.sy * dt;
            tmp.position.set(d.x, d.y, d.z); tmp.rotation.set(d.rx, d.ry, 0); tmp.scale.setScalar(d.s * Math.min(1, d.t));
            tmp.updateMatrix();
            this.debris.setMatrixAt(n++, tmp.matrix);
        }
        this.debris.count = n;
        this.debris.instanceMatrix.needsUpdate = true;
        this.parts.update(dt, this.stage.renderer.getPixelRatio());
    }
}

const ROCKET = new THREE.Color(1.0, 0.65, 0.3);
const BLADE = new THREE.Color(0.6, 0.95, 1.0);
const PHANTOM = new THREE.Color(0.8, 0.5, 1.0);
const GEM_A = new THREE.Color(1.0, 0.85, 0.3);
const GEM_B = new THREE.Color(0.5, 1.0, 0.9);
