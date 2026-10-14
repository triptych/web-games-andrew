// Effects: particles (additive and alpha), gibs and ice shards that bounce, blood and scorch
// decals, fireballs and shockwave rings, beams and tracers, projectile visuals, and the dynamic
// lights that every lit shader reads (SU.uDL).

import * as THREE from 'three';
import { SU, MAX_DL, NOISE } from './shaderlib.js';
import { ELEMENT_COLOR } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const C = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

export const BLOOD = {
    trooper: [0.5, 0.08, 0.6], chomper: [0.35, 0.65, 0.05], drone: [0.7, 0.7, 0.75], brute: [0.55, 0.03, 0.02],
    psy: [0.9, 0.3, 0.6], tank: [0.25, 0.05, 0.3], chompra: [0.4, 0.7, 0.05], vrask: [0.2, 0.5, 0.1], rourke: [0.8, 0.2, 0.5], pylon: [0.6, 0.3, 1],
};
export const ELEM_RGB = Object.fromEntries(Object.entries(ELEMENT_COLOR).map(([k, v]) => [k, new THREE.Color(v)]));

// ==================================================================== particles

class Particles {
    constructor(max, additive) {
        this.max = max;
        this.n = 0;
        this.p = new Float32Array(max * 3);
        this.v = new Float32Array(max * 3);
        this.c = new Float32Array(max * 3);
        this.s = new Float32Array(max);
        this.a = new Float32Array(max);
        this.life = new Float32Array(max);
        this.age = new Float32Array(max);
        this.grav = new Float32Array(max);
        this.drag = new Float32Array(max);
        this.grow = new Float32Array(max);
        const g = new THREE.BufferGeometry();
        this.pos = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
        this.col = new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
        this.size = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage);
        this.alpha = new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.pos); g.setAttribute('aColor', this.col); g.setAttribute('aSize', this.size); g.setAttribute('aAlpha', this.alpha);
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uScale: { value: 600 }, uFogColor: SU.uFogColor, uFogDensity: SU.uFogDensity },
            transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale;
                varying vec3 vC; varying float vA; varying float vD;
                void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z;
                gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `varying vec3 vC; varying float vA; varying float vD; uniform vec3 uFogColor; uniform float uFogDensity;
                void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard;
                float k = ${additive ? '(1.0 - r) * (1.0 - r)' : '1.0 - smoothstep(0.55, 1.0, r)'};
                float f = 1.0 - exp(-uFogDensity * uFogDensity * vD * vD);
                ${additive ? 'gl_FragColor = vec4(vC * k * vA * (1.0 - f), 1.0);' : 'gl_FragColor = vec4(mix(vC, uFogColor, f), k * vA);'} }`,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        g.setDrawRange(0, 0);
    }
    spawn(x, y, z, vx, vy, vz, r, gC, b, size, life, grav = 0, drag = 0, grow = 0) {
        let i = this.n;
        if (i >= this.max) i = Math.floor(Math.random() * this.max);   // full: overwrite one
        else this.n++;
        this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
        this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
        this.c[i * 3] = r; this.c[i * 3 + 1] = gC; this.c[i * 3 + 2] = b;
        this.s[i] = size; this.life[i] = life; this.age[i] = 0; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow; this.a[i] = 1;
    }
    update(dt, floorAt) {
        let i = 0;
        while (i < this.n) {
            this.age[i] += dt;
            if (this.age[i] >= this.life[i]) {
                const j = --this.n;
                if (i !== j) {
                    for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; this.c[i * 3 + k] = this.c[j * 3 + k]; }
                    this.s[i] = this.s[j]; this.life[i] = this.life[j]; this.age[i] = this.age[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j]; this.a[i] = this.a[j];
                }
                continue;
            }
            const d = Math.max(0, 1 - this.drag[i] * dt);
            this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
            this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
            if (this.grav[i] > 0 && floorAt) {
                const f = floorAt(this.p[i * 3], this.p[i * 3 + 2]);
                if (this.p[i * 3 + 1] < f + 0.02) { this.p[i * 3 + 1] = f + 0.02; this.v[i * 3 + 1] *= -0.2; this.v[i * 3] *= 0.5; this.v[i * 3 + 2] *= 0.5; }
            }
            this.s[i] += this.grow[i] * dt;
            const k = this.age[i] / this.life[i];
            this.a[i] = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
            i++;
        }
        this.points.geometry.setDrawRange(0, this.n);
        for (const at of [this.pos, this.col, this.size, this.alpha]) { at.needsUpdate = true; at.clearUpdateRanges?.(); }
    }
}

// ==================================================================== decals

function splatTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    for (let k = 0; k < 26; k++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * Math.random() * 46;
        const r = 6 + Math.random() * 20 * (1 - d / 60);
        x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); x.fill();
    }
    for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 20;
        x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + Math.random() * 4, 0, 7); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    return t;
}

// ==================================================================== the fireball shader

const FIRE_FRAG = /* glsl */`
uniform float uT;
uniform vec3 uCol;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
${NOISE}
void main() {
    float n = fbm3(vP * 2.2 + vec3(0.0, -uT * 3.0, uT));
    float rim = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float heat = clamp(n * 1.4 * (1.0 - uT) + rim * 0.6 - uT * 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(0.6, 0.05, 0.02), uCol, smoothstep(0.2, 0.7, heat));
    col = mix(col, vec3(2.2, 1.7, 1.0), smoothstep(0.75, 1.0, heat));
    float a = smoothstep(0.08, 0.35, heat) * (1.0 - uT * uT);
    gl_FragColor = vec4(col * a * 1.15, a);
}`;

export class FX {
    constructor(scene, floorAt) {
        this.scene = scene;
        this.floorAt = floorAt;
        this.add = new Particles(3500, true);
        this.alpha = new Particles(2500, false);
        scene.add(this.add.points, this.alpha.points);
        // gibs and shards
        this.maxGibs = 260;
        this.gibs = [];
        this.gibMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.1, emissive: 0x220006 }), this.maxGibs);
        this.gibMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.gibMesh.setColorAt(0, new THREE.Color());
        this.gibMesh.count = 0;
        this.gibMesh.frustumCulled = false;
        this.shardMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, roughness: 0.05, metalness: 0.3, emissive: new THREE.Color(0.15, 0.35, 0.5), transparent: true, opacity: 0.9 }), 120);
        this.shardMesh.count = 0;
        this.shardMesh.frustumCulled = false;
        this.shards = [];
        scene.add(this.gibMesh, this.shardMesh);
        // decals
        this.maxDecals = 220;
        this.decalI = 0;
        this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: splatTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, alphaTest: 0.05 }), this.maxDecals);
        this.decals.setColorAt(0, new THREE.Color());
        this.decals.count = 0;
        this.decals.frustumCulled = false;
        scene.add(this.decals);
        // pools
        this.fires = [];
        this.rings = [];
        this.lines = [];
        this.lights = [];
        this.proj = new Map();
        this.waveMeshes = [];
        this.fireGeo = new THREE.IcosahedronGeometry(1, 4);
        this.lineGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
        this.ringGeo = new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2);
        this.tmp = new THREE.Object3D();
        this.shake = 0;
    }

    setScale(s) { this.add.mat.uniforms.uScale.value = s; this.alpha.mat.uniforms.uScale.value = s; }

    clear() {
        this.add.n = 0; this.alpha.n = 0;
        this.gibs.length = 0; this.shards.length = 0;
        this.gibMesh.count = 0; this.shardMesh.count = 0; this.decals.count = 0; this.decalI = 0;
        for (const f of this.fires) this.scene.remove(f.mesh);
        for (const r of this.rings) this.scene.remove(r.mesh);
        for (const l of this.lines) this.scene.remove(l.mesh);
        this.fires.length = this.rings.length = this.lines.length = this.lights.length = 0;
        for (const p of this.proj.values()) this.scene.remove(p.obj);
        this.proj.clear();
    }

    // ---------------------------------------------------------------- particle presets
    burst(kind, x, y, z, n = 12, o = {}) {
        const A = this.add, B = this.alpha;
        const [r, g, b] = o.rgb || [1, 1, 1];
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u);
            const dx = Math.cos(a) * s, dy = u, dz = Math.sin(a) * s;
            const sp = (o.speed ?? 4) * rand(0.4, 1.2);
            const nx = (o.nx || 0) * 0.8, ny = (o.ny || 0) * 0.8, nz = (o.nz || 0) * 0.8;
            switch (kind) {
                case 'blood': B.spawn(x, y, z, (dx + nx) * sp, (dy + ny) * sp + 2, (dz + nz) * sp, r * rand(0.6, 1), g * rand(0.6, 1), b * rand(0.6, 1), rand(0.08, 0.22), rand(0.5, 1.1), 14, 0.5); break;
                case 'mist': B.spawn(x, y, z, dx * sp * 0.4, dy * sp * 0.3 + 0.5, dz * sp * 0.4, r, g, b, rand(0.4, 0.9), rand(0.5, 0.9), 0, 2, 1.4); break;
                case 'sparks': A.spawn(x, y, z, (dx + nx) * sp * 2, (dy + ny) * sp * 2 + 1, (dz + nz) * sp * 2, 3 * r, 1.8 * g, 0.6 * b, rand(0.03, 0.07), rand(0.15, 0.45), 16, 1); break;
                case 'fire': A.spawn(x + dx * 0.3, y + dy * 0.3, z + dz * 0.3, dx * sp * 0.4, Math.abs(dy) * sp * 0.4 + 1.5, dz * sp * 0.4, 2.6, rand(0.6, 1.2), 0.15, rand(0.3, 0.7), rand(0.25, 0.6), -2, 2, -0.4); break;
                case 'smoke': B.spawn(x + dx * 0.4, y + dy * 0.2, z + dz * 0.4, dx * sp * 0.25, Math.abs(dy) * sp * 0.2 + 1, dz * sp * 0.25, 0.08, 0.07, 0.09, rand(0.6, 1.3), rand(1.2, 2.5), -0.5, 1.2, 1.2); break;
                case 'glow': A.spawn(x, y, z, dx * sp, dy * sp, dz * sp, r * 2, g * 2, b * 2, rand(0.06, 0.18), rand(0.2, 0.5), o.grav ?? 0, 3); break;
                case 'frost': A.spawn(x, y, z, dx * sp, dy * sp + 1, dz * sp, 1.2, 1.8, 2.4, rand(0.05, 0.14), rand(0.4, 0.9), 4, 2); break;
                case 'spawn': A.spawn(x + dx * 1.5, y + Math.random() * 2.5, z + dz * 1.5, -dx * 3, 1, -dz * 3, 0.6, 1.4, 2.6, rand(0.1, 0.25), rand(0.4, 0.8), 0, 1); break;
            }
        }
    }

    decal(x, y, z, size, rgb) {
        const i = this.decalI++ % this.maxDecals;
        this.tmp.position.set(x, y + 0.025 + (i % 7) * 0.001, z);
        this.tmp.rotation.set(0, Math.random() * 6.28, 0);
        this.tmp.scale.set(size, 1, size);
        this.tmp.updateMatrix();
        this.decals.setMatrixAt(i, this.tmp.matrix);
        this.decals.setColorAt(i, new THREE.Color(rgb[0], rgb[1], rgb[2]));
        this.decals.count = Math.min(this.maxDecals, Math.max(this.decals.count, i + 1));
        this.decals.instanceMatrix.needsUpdate = true;
        this.decals.instanceColor.needsUpdate = true;
    }

    gib(x, y, z, vx, vz, rgb, n) {
        for (let k = 0; k < n; k++) {
            if (this.gibs.length >= this.maxGibs) this.gibs.shift();
            const s = rand(0.06, 0.2);
            this.gibs.push({
                x: x + rand(-0.3, 0.3), y: y + rand(0, 1), z: z + rand(-0.3, 0.3),
                vx: vx * rand(0.3, 1) + rand(-5, 5), vy: rand(3, 10), vz: vz * rand(0.3, 1) + rand(-5, 5),
                rx: rand(0, 6), ry: rand(0, 6), wx: rand(-12, 12), wy: rand(-12, 12),
                s: [s * rand(0.7, 1.4), s * rand(0.6, 1.1), s * rand(0.7, 1.3)],
                c: new THREE.Color(rgb[0] * rand(0.7, 1.1), rgb[1] * rand(0.7, 1.1), rgb[2] * rand(0.7, 1.1)),
                age: 0, life: rand(5, 8), rest: false, trail: 0,
            });
        }
    }

    shatter(x, y, z, n = 18) {
        for (let k = 0; k < n; k++) {
            if (this.shards.length >= 120) this.shards.shift();
            this.shards.push({ x: x + rand(-0.4, 0.4), y: y + rand(0.2, 1.6), z: z + rand(-0.4, 0.4), vx: rand(-6, 6), vy: rand(2, 8), vz: rand(-6, 6), rx: rand(0, 6), ry: rand(0, 6), wx: rand(-15, 15), wy: rand(-15, 15), s: rand(0.05, 0.18), age: 0, life: rand(2, 3.5), rest: false });
        }
        this.burst('frost', x, y + 1, z, 30, { speed: 4 });
    }

    light(x, y, z, rgb, radius, life, k = 1) { this.lights.push({ x, y, z, r: rgb[0] * k, g: rgb[1] * k, b: rgb[2] * k, radius, life, max: life }); }

    explosion(x, y, z, r, element, big) {
        const col = element ? ELEM_RGB[element].clone().multiplyScalar(1.8) : new THREE.Color(2.2, 0.95, 0.25);
        const m = new THREE.Mesh(this.fireGeo, new THREE.ShaderMaterial({
            uniforms: { uT: { value: 0 }, uCol: { value: col } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
            fragmentShader: FIRE_FRAG,
        }));
        m.position.set(x, y, z);
        m.scale.setScalar(0.2);
        this.scene.add(m);
        this.fires.push({ mesh: m, age: 0, life: big ? 0.75 : 0.45, r: r * 0.55 });
        const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
        ring.position.set(x, this.floorAt(x, z) + 0.08, z);
        this.scene.add(ring);
        this.rings.push({ mesh: ring, age: 0, life: 0.5, r: r * 1.3 });
        this.burst('sparks', x, y, z, big ? 50 : 22, { speed: big ? 7 : 4 });
        this.burst('fire', x, y, z, big ? 36 : 16, { speed: 4 });
        this.burst('smoke', x, y, z, big ? 26 : 10, { speed: 2 });
        if (element === 'cryo') this.burst('frost', x, y, z, 30, { speed: 5 });
        this.light(x, y + 0.5, z, [col.r, col.g, col.b], r * 2.6, big ? 0.55 : 0.35, big ? 1.1 : 0.8);
        this.decal(x, this.floorAt(x, z), z, r * 0.9, [0.02, 0.018, 0.02]);
        this.shake = Math.max(this.shake, big ? 0.5 : 0.25);
    }

    /** A beam or tracer through points: straight, or jagged like lightning. */
    line(pts, rgb, width, life, jitter = 0) {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        const group = new THREE.Group();
        const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
        const segs = [];
        for (let k = 0; k + 1 < pts.length; k++) {
            const a = pts[k], b = pts[k + 1];
            const n = jitter ? Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.8)) : 1;
            let prev = a;
            for (let s = 1; s <= n; s++) {
                const t = s / n;
                const cur = s === n ? b : [a[0] + (b[0] - a[0]) * t + rand(-jitter, jitter), a[1] + (b[1] - a[1]) * t + rand(-jitter, jitter), a[2] + (b[2] - a[2]) * t + rand(-jitter, jitter)];
                segs.push([prev, cur]);
                prev = cur;
            }
        }
        for (const [a, b] of segs) {
            const m = new THREE.Mesh(this.lineGeo, mat);
            v0.set(...a); v1.set(...b);
            m.position.copy(v0);
            m.lookAt(v1);
            m.scale.set(width, width, v0.distanceTo(v1));
            group.add(m);
        }
        this.scene.add(group);
        this.lines.push({ mesh: group, mat, age: 0, life });
    }

    // ---------------------------------------------------------------- projectiles
    projObject(pr) {
        const g = new THREE.Group();
        const glowM = (c, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
        const el = pr.element ? ELEMENT_COLOR[pr.element] : null;
        let light = null;
        switch (pr.kind) {
            case 'rocket': case 'erocket': case 'emissile': {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: pr.kind === 'rocket' ? 0x8a8a90 : 0x5a1a40, metalness: 0.7, roughness: 0.3 }));
                const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: pr.kind === 'rocket' ? 0xd02020 : 0xff40c0 }));
                tip.position.z = -0.26;
                const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8).rotateX(Math.PI / 2), glowM(0xffa040, 3));
                flame.position.z = 0.4;
                g.add(body, tip, flame);
                light = [3, 1.6, 0.5, 6];
                break;
            }
            case 'photon': case 'bolt': case 'laser': case 'spit': {
                const c = pr.kind === 'photon' ? (el || '#60f0ff') : pr.kind === 'bolt' ? '#40ffb0' : pr.kind === 'laser' ? '#ff2020' : '#a0ff20';
                const len = pr.kind === 'laser' ? 1.2 : pr.kind === 'photon' ? 0.7 : 0.4;
                const w = pr.kind === 'laser' ? 0.04 : pr.kind === 'spit' ? 0.2 : 0.09;
                const core = new THREE.Mesh(new THREE.CapsuleGeometry(w, len, 4, 8).rotateX(Math.PI / 2), glowM(c, 3.5));
                g.add(core);
                const cc = new THREE.Color(c);
                light = [cc.r * 2, cc.g * 2, cc.b * 2, 5];
                break;
            }
            case 'psi': case 'orb': {
                const c = pr.kind === 'psi' ? '#c050ff' : '#ff40d0';
                g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), glowM(c, 3)));
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 20), glowM(c, 2));
                g.add(ring);
                g.userData.spin = ring;
                const cc = new THREE.Color(c);
                light = [cc.r * 2.5, cc.g * 2.5, cc.b * 2.5, 6];
                break;
            }
            case 'disc': {
                const d = new THREE.Group();
                d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 28), new THREE.MeshStandardMaterial({ color: 0xd8dce8, metalness: 1, roughness: 0.2 })));
                for (let k = 0; k < 12; k++) {
                    const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 }));
                    const a = (k / 12) * Math.PI * 2;
                    t.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32); t.rotation.y = -a;
                    d.add(t);
                }
                d.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 24).rotateX(Math.PI / 2), glowM(el || '#ff40c0', 3)));
                g.add(d);
                g.userData.spinY = d;
                const cc = new THREE.Color(el || '#ff40c0');
                light = [cc.r * 1.5, cc.g * 1.5, cc.b * 1.5, 4];
                break;
            }
            case 'bomb': {
                const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0x6a6a70, metalness: 0.8, roughness: 0.4 }));
                const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8 }));
                cap1.position.y = 0.15;
                const cap2 = cap1.clone(); cap2.position.y = -0.15;
                const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glowM('#ff2020', 4));
                led.position.set(0.065, 0, 0);
                g.add(pipe, cap1, cap2, led);
                g.userData.led = led;
                g.userData.tumble = true;
                break;
            }
            default: g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowM('#ffffff', 2)));
        }
        this.scene.add(g);
        return { obj: g, light, trail: 0 };
    }

    syncProjectiles(G, dt, t) {
        const seen = new Set();
        for (const pr of G.proj) {
            seen.add(pr.id);
            let o = this.proj.get(pr.id);
            if (!o) { o = this.projObject(pr); this.proj.set(pr.id, o); }
            o.obj.position.set(pr.x, pr.y, pr.z);
            const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
            if (sp > 0.1 && !o.obj.userData.tumble) o.obj.lookAt(pr.x - pr.vx, pr.y - pr.vy, pr.z - pr.vz);
            if (o.obj.userData.spin) o.obj.userData.spin.rotation.x += dt * 10;
            if (o.obj.userData.spinY) o.obj.userData.spinY.rotation.y += dt * 30;
            if (o.obj.userData.tumble) { o.obj.rotation.x += dt * 9; o.obj.rotation.z += dt * 6; o.obj.userData.led.visible = Math.sin(t * (pr.fuse < 0.6 ? 40 : 12)) > 0; }
            o.trail += dt;
            if (o.trail > 0.02) {
                o.trail = 0;
                if (pr.kind === 'rocket' || pr.kind === 'erocket' || pr.kind === 'emissile') {
                    this.alpha.spawn(pr.x, pr.y, pr.z, rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3), 0.12, 0.11, 0.13, rand(0.25, 0.4), rand(0.6, 1.1), -0.3, 1, 0.9);
                    this.add.spawn(pr.x, pr.y, pr.z, 0, 0, 0, 3, 1.4, 0.3, 0.18, 0.12);
                } else if (pr.kind === 'psi' || pr.kind === 'orb' || pr.kind === 'photon') {
                    const c = o.light || [1, 1, 1];
                    this.add.spawn(pr.x, pr.y, pr.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.14, 0.25);
                }
            }
        }
        for (const [id, o] of this.proj) if (!seen.has(id)) { this.scene.remove(o.obj); o.obj.traverse((q) => { q.geometry?.dispose(); q.material?.dispose?.(); }); this.proj.delete(id); }
    }

    syncWaves(G) {
        while (this.waveMeshes.length < G.waves.length) {
            const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.0, 0.2), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
            this.scene.add(m);
            this.waveMeshes.push(m);
        }
        this.waveMeshes.forEach((m, k) => {
            const w = G.waves[k];
            m.visible = !!w;
            if (!w) return;
            m.position.set(w.x, w.y + 0.25, w.z);
            m.scale.set(w.r, 1, w.r);
            m.material.opacity = 1 - w.r / w.max;
        });
    }

    // ---------------------------------------------------------------- per frame
    update(dt, camPos, extraLights) {
        this.add.update(dt, this.floorAt);
        this.alpha.update(dt, this.floorAt);
        // gibs
        let n = 0;
        for (let k = this.gibs.length - 1; k >= 0; k--) {
            const q = this.gibs[k];
            q.age += dt;
            if (q.age > q.life) { this.gibs.splice(k, 1); continue; }
            if (!q.rest) {
                q.vy -= 20 * dt;
                q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
                q.rx += q.wx * dt; q.ry += q.wy * dt;
                const f = this.floorAt(q.x, q.z);
                if (q.y < f + q.s[1]) {
                    q.y = f + q.s[1];
                    if (Math.abs(q.vy) > 2) { q.vy *= -0.35; q.vx *= 0.6; q.vz *= 0.6; this.decal(q.x, f, q.z, rand(0.4, 0.9), [q.c.r * 0.5, q.c.g * 0.5, q.c.b * 0.5]); }
                    else { q.rest = true; }
                }
                q.trail += dt;
                if (q.trail > 0.05) { q.trail = 0; this.alpha.spawn(q.x, q.y, q.z, 0, 0, 0, q.c.r, q.c.g, q.c.b, 0.07, 0.4, 6); }
            }
            const shrink = q.age > q.life - 1 ? (q.life - q.age) : 1;
            this.tmp.position.set(q.x, q.y, q.z);
            this.tmp.rotation.set(q.rx, q.ry, 0);
            this.tmp.scale.set(q.s[0] * shrink, q.s[1] * shrink, q.s[2] * shrink);
            this.tmp.updateMatrix();
            this.gibMesh.setMatrixAt(n, this.tmp.matrix);
            this.gibMesh.setColorAt(n, q.c);
            n++;
        }
        this.gibMesh.count = n;
        this.gibMesh.instanceMatrix.needsUpdate = true;
        if (this.gibMesh.instanceColor) this.gibMesh.instanceColor.needsUpdate = true;
        // ice shards
        n = 0;
        for (let k = this.shards.length - 1; k >= 0; k--) {
            const q = this.shards[k];
            q.age += dt;
            if (q.age > q.life) { this.shards.splice(k, 1); continue; }
            if (!q.rest) {
                q.vy -= 20 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rx += q.wx * dt; q.ry += q.wy * dt;
                const f = this.floorAt(q.x, q.z);
                if (q.y < f + q.s * 0.5) { q.y = f + q.s * 0.5; if (Math.abs(q.vy) > 2) { q.vy *= -0.4; q.vx *= 0.6; q.vz *= 0.6; } else q.rest = true; }
            }
            const s = q.s * Math.min(1, (q.life - q.age) * 2);
            this.tmp.position.set(q.x, q.y, q.z); this.tmp.rotation.set(q.rx, q.ry, 0); this.tmp.scale.set(s * 0.6, s * 1.4, s * 0.6);
            this.tmp.updateMatrix();
            this.shardMesh.setMatrixAt(n++, this.tmp.matrix);
        }
        this.shardMesh.count = n;
        this.shardMesh.instanceMatrix.needsUpdate = true;
        // fireballs, rings, lines
        for (let k = this.fires.length - 1; k >= 0; k--) {
            const f = this.fires[k];
            f.age += dt;
            const u = f.age / f.life;
            if (u >= 1) { this.scene.remove(f.mesh); f.mesh.material.dispose(); this.fires.splice(k, 1); continue; }
            f.mesh.scale.setScalar(f.r * (0.35 + 0.65 * Math.sqrt(u)) + 0.1);
            f.mesh.material.uniforms.uT.value = u;
            f.mesh.position.y += dt * 1.2;
        }
        for (let k = this.rings.length - 1; k >= 0; k--) {
            const r = this.rings[k];
            r.age += dt;
            const u = r.age / r.life;
            if (u >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(k, 1); continue; }
            r.mesh.scale.set(r.r * u + 0.2, 1, r.r * u + 0.2);
            r.mesh.material.opacity = 1 - u;
        }
        for (let k = this.lines.length - 1; k >= 0; k--) {
            const l = this.lines[k];
            l.age += dt;
            if (l.age >= l.life) { this.scene.remove(l.mesh); l.mat.dispose(); this.lines.splice(k, 1); continue; }
            l.mat.opacity = 1 - l.age / l.life;
        }
        // dynamic lights: transient ones, then projectile glows; the strongest near the camera win
        const cand = [];
        for (let k = this.lights.length - 1; k >= 0; k--) {
            const L = this.lights[k];
            L.life -= dt;
            if (L.life <= 0) { this.lights.splice(k, 1); continue; }
            const f = L.life / L.max;
            cand.push([L.x, L.y, L.z, L.r * f, L.g * f, L.b * f, L.radius]);
        }
        for (const o of this.proj.values()) if (o.light) cand.push([o.obj.position.x, o.obj.position.y, o.obj.position.z, o.light[0], o.light[1], o.light[2], o.light[3]]);
        for (const e of extraLights) cand.push(e);
        for (const c of cand) {
            const d = Math.hypot(c[0] - camPos.x, c[1] - camPos.y, c[2] - camPos.z);
            c[7] = (c[3] + c[4] + c[5]) * c[6] / (1 + d * d * 0.01);
        }
        cand.sort((a, b) => b[7] - a[7]);
        for (let k = 0; k < MAX_DL; k++) {
            const c = cand[k];
            if (c) { SU.uDL.value[k].set(c[0], c[1], c[2], c[6]); SU.uDLC.value[k].set(c[3], c[4], c[5]); }
            else SU.uDL.value[k].w = 0;
        }
        this.shake = Math.max(0, this.shake - dt * 1.8);
    }
}

export { C };
