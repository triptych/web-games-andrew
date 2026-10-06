/**
 * particles.js — light in the air.
 *
 *   AmbientMotes  motes rising from the roots and spiralling up the tree; how
 *                 many depends on motes/s (shader-animated, no CPU per mote)
 *   Bursts        a CPU pool for clicks, purchases, wisps and stage-ups
 *   SeasonFall    petals (spring), pollen (summer), leaves (autumn), snow (winter)
 *   Wisp          the golden wisp: an orb with a trail on a looping path
 *   Realms        floating islands bound to the World Tree's crown
 */

import * as THREE from 'three';
import { U } from './stage.js';

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ------------------------------------------------------------------ ambient motes
export class AmbientMotes {
    constructor(scene, textures, max) {
        this.max = max;
        const r = mulberry(4);
        const g = new THREE.BufferGeometry();
        const a = new Float32Array(max * 4);
        for (let i = 0; i < max; i++) a.set([r(), r(), r(), r()], i * 4);
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
        g.setAttribute('aA', new THREE.BufferAttribute(a, 4));
        this.u = {
            uTime: U.uTime, uMap: { value: textures.glow }, uH: { value: 1 }, uR: { value: 1 }, uPx: { value: 1 },
            uColorA: { value: new THREE.Color(0xfff0a8) }, uColorB: { value: new THREE.Color(0x8affd8) }, uBoost: { value: 0 }, uScale: { value: 1 },
        };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */`
                attribute vec4 aA; uniform float uTime; uniform float uH; uniform float uR; uniform float uPx; uniform float uBoost; uniform float uScale;
                varying float vA; varying float vMix;
                void main() {
                    float life = 9.0 + aA.z * 8.0;
                    float k = fract(uTime / life * (1.0 + uBoost * 1.5) + aA.x);
                    // rise from the roots in a widening spiral, fading in and out
                    float ang = aA.y * 6.2831 + k * (3.0 + aA.w * 4.0);
                    float rad = uR * (0.15 + k * (0.6 + aA.w * 0.9)) + 0.2;
                    vec3 p = vec3(cos(ang) * rad, k * uH * (1.05 + aA.z * 0.3), sin(ang) * rad);
                    p.x += sin(uTime * 0.9 + aA.w * 30.0) * 0.3;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vA = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.75, 1.0, k)) * (0.6 + 0.4 * sin(uTime * 3.0 + aA.x * 50.0));
                    vMix = aA.w;
                    gl_PointSize = min(uPx * 16.0, uPx * (0.08 + aA.z * 0.07) * (1.0 + uBoost * 0.5) * uScale * 520.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap; uniform vec3 uColorA; uniform vec3 uColorB; varying float vA; varying float vMix;
                void main() { float t = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(mix(uColorA, uColorB, vMix) * t * vA * 1.5, 1.0); }`,
        }));
        this.points.frustumCulled = false;
        g.setDrawRange(0, 30);
        scene.add(this.points);
    }
    /** density 0..1 (from motes/s) */
    set(density, height, crown, px, boost) {
        this.points.geometry.setDrawRange(0, Math.round(20 + density * (this.max - 20)));
        this.u.uH.value = Math.max(0.6, height);
        this.u.uR.value = Math.max(0.5, crown);
        this.u.uPx.value = px;
        this.u.uBoost.value += (boost - this.u.uBoost.value) * 0.05;
        this.u.uScale.value = Math.min(1, Math.max(0.25, height * 0.12));
    }
}

// ------------------------------------------------------------------ bursts
export class Bursts {
    constructor(scene, textures, max = 900) {
        this.max = max;
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.size = new Float32Array(max);
        this.vel = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.age = new Float32Array(max);
        this.head = 0;
        const g = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
        this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
        this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.aPos);
        g.setAttribute('aCol', this.aCol);
        g.setAttribute('aSize', this.aSize);
        this.u = { uMap: { value: textures.glow }, uPx: { value: 1 } };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */`
                attribute vec3 aCol; attribute float aSize; uniform float uPx; varying vec3 vC;
                void main() { vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = min(uPx * 34.0, uPx * aSize * 520.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap; varying vec3 vC;
                void main() { float t = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(vC * t, 1.0); }`,
        }));
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.tmp = new THREE.Color();
    }

    /** Emit n sparks at p. opts: color, speed, size, life, up (upward drift), spread */
    emit(p, n, opts = {}) {
        const c = this.tmp.set(opts.color ?? 0xfff0a0);
        const speed = opts.speed ?? 1.5, size = opts.size ?? 0.12, life = opts.life ?? 1.2, up = opts.up ?? 1;
        for (let k = 0; k < n; k++) {
            const i = this.head; this.head = (this.head + 1) % this.max;
            const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
            const s = speed * (0.3 + Math.random() * 0.7);
            this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
            this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
            this.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s * 0.6 + up;
            this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
            this.life[i] = life * (0.6 + Math.random() * 0.6);
            this.age[i] = 0;
            this.size[i] = size * (0.6 + Math.random() * 0.8);
            const v = 0.75 + Math.random() * 0.25;
            this.col[i * 3] = c.r * v; this.col[i * 3 + 1] = c.g * v; this.col[i * 3 + 2] = c.b * v;
        }
    }

    update(dt, px) {
        this.u.uPx.value = px;
        const drag = Math.exp(-dt * 1.6);
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) continue;
            this.age[i] += dt;
            const k = this.age[i] / this.life[i];
            if (k >= 1) { this.life[i] = 0; this.size[i] = 0; continue; }
            this.vel[i * 3] *= drag; this.vel[i * 3 + 1] *= drag; this.vel[i * 3 + 2] *= drag;
            this.vel[i * 3 + 1] += dt * 0.4;
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            const fade = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
            this.col[i * 3] *= 0.995; this.col[i * 3 + 1] *= 0.995; this.col[i * 3 + 2] *= 0.995;
            this.size[i] *= k > 0.6 ? 0.985 : 1;
            if (fade <= 0) this.size[i] = 0;
        }
        this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
    }
}

// ------------------------------------------------------------------ seasonal fall
export class SeasonFall {
    constructor(scene, textures, max) {
        this.max = max;
        const r = mulberry(8);
        const g = new THREE.BufferGeometry();
        const a = new Float32Array(max * 4);
        for (let i = 0; i < max; i++) a.set([r(), r(), r(), r()], i * 4);
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
        g.setAttribute('aA', new THREE.BufferAttribute(a, 4));
        this.u = {
            uTime: U.uTime, uMap: { value: textures.critters }, uGlow: { value: textures.glow }, uH: { value: 2 }, uR: { value: 2 }, uPx: { value: 1 },
            uKind: { value: 0 }, uColor: { value: new THREE.Color(0xffb8e0) }, uAmt: { value: 1 }, uScale: { value: 1 },
            uFogColor: U.uFogColor, uFogDensity: U.uFogDensity,
        };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.u, transparent: true, depthWrite: false,
            vertexShader: /* glsl */`
                attribute vec4 aA; uniform float uTime; uniform float uH; uniform float uR; uniform float uPx; uniform float uKind; uniform float uScale;
                varying float vA; varying float vRot; varying float vFogDepth;
                void main() {
                    float fall = uKind > 2.5 ? 0.7 : 0.45;
                    float life = (uH * 1.1 + 2.0) / fall;
                    float k = fract(uTime / life + aA.x);
                    float rad = uR * (0.2 + aA.y * 1.4);
                    float ang = aA.z * 6.2831 + uTime * 0.05;
                    vec3 p = vec3(cos(ang) * rad, (1.0 - k) * (uH * 1.1 + 1.0), sin(ang) * rad);
                    p.x += sin(uTime * 0.8 + aA.w * 20.0 + k * 9.0) * 0.8;
                    p.z += cos(uTime * 0.6 + aA.w * 20.0 + k * 7.0) * 0.8;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vFogDepth = -mv.z;
                    vA = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.92, 1.0, k));
                    vRot = uTime * (1.0 + aA.w * 2.0) + aA.x * 20.0;
                    gl_PointSize = min(uPx * 22.0, uPx * (uKind > 2.5 ? 0.09 : 0.16) * (0.7 + aA.w * 0.6) * uScale * 520.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap; uniform sampler2D uGlow; uniform float uKind; uniform vec3 uColor; uniform float uAmt;
                uniform vec3 uFogColor; uniform float uFogDensity;
                varying float vA; varying float vRot; varying float vFogDepth;
                void main() {
                    vec2 pc = gl_PointCoord - 0.5;
                    float c = cos(vRot), s = sin(vRot);
                    pc = vec2(pc.x * c - pc.y * s, pc.x * s + pc.y * c);
                    pc.x /= max(0.25, abs(cos(vRot * 0.7)));    // tumbling
                    if (abs(pc.x) > 0.5) discard;
                    vec4 t;
                    if (uKind < 0.5 || (uKind > 1.5 && uKind < 2.5)) t = texture2D(uMap, vec2(0.5, 0.0) + (vec2(pc.x, -pc.y) + 0.5) * 0.5);
                    else { float g = texture2D(uGlow, pc + 0.5).r; t = vec4(vec3(1.0), g); }
                    if (t.a < 0.3) discard;
                    vec3 col = uColor * t.rgb * (uKind > 2.5 ? 1.2 : 0.8);
                    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
                    col = mix(col, uFogColor, fogF);
                    gl_FragColor = vec4(col, t.a * vA * uAmt);
                }`,
        }));
        this.points.frustumCulled = false;
        scene.add(this.points);
    }
    set(seasonIndex, height, crown, px, density) {
        const kinds = [[0, 0xffb8e0], [1, 0xfff4a0], [2, 0xff9a40], [3, 0xeaf6ff]];
        const [k, c] = kinds[seasonIndex];
        this.u.uKind.value = k;
        this.u.uColor.value.setHex(c);
        this.u.uH.value = Math.max(1, height);
        this.u.uR.value = Math.max(1, crown);
        this.u.uPx.value = px;
        this.u.uScale.value = Math.min(1, Math.max(0.2, height * 0.08));
        const n = height < 1.2 ? 0 : Math.round(this.max * density * (seasonIndex === 1 ? 0.35 : 1));
        this.points.geometry.setDrawRange(0, n);
    }
}

// ------------------------------------------------------------------ the golden wisp
export class Wisp {
    constructor(scene, textures) {
        this.group = new THREE.Group();
        this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0xffcc55, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.core = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.star, color: 0xffe8a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.group.add(this.halo, this.star, this.core);
        this.group.visible = false;
        scene.add(this.group);
        // trail
        this.trailN = 40;
        this.trail = new Float32Array(this.trailN * 3);
        const g = new THREE.BufferGeometry();
        this.aTrail = new THREE.BufferAttribute(this.trail, 3).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.aTrail);
        const fade = new Float32Array(this.trailN);
        for (let i = 0; i < this.trailN; i++) fade[i] = 1 - i / this.trailN;
        g.setAttribute('aF', new THREE.BufferAttribute(fade, 1));
        this.tu = { uMap: { value: textures.glow }, uPx: { value: 1 }, uSize: { value: 0.3 }, uA: { value: 1 } };
        this.trailPts = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.tu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: `attribute float aF; uniform float uPx; uniform float uSize; varying float vF;
                void main(){ vF = aF; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(uPx * 60.0, uPx * uSize * aF * 520.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform sampler2D uMap; uniform float uA; varying float vF;
                void main(){ float t = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(vec3(1.0, 0.8, 0.35) * t * vF * uA, 1.0); }`,
        }));
        this.trailPts.frustumCulled = false;
        this.trailPts.visible = false;
        scene.add(this.trailPts);
        this.active = null;
        this.pos = new THREE.Vector3();
    }

    spawn(seed, life, now) {
        const r = mulberry(seed);
        this.active = { born: now, life, a: r() * 6.28, b: r() * 6.28, sx: 0.6 + r() * 0.5, sy: 0.7 + r() * 0.8, dir: r() < 0.5 ? -1 : 1, enter: r() * 6.28 };
        this.group.visible = true;
        this.trailPts.visible = true;
        this.trailInit = false;
    }
    hide() { this.active = null; this.group.visible = false; this.trailPts.visible = false; }

    update(dt, t, size, px) {
        if (!this.active) return;
        const w = this.active;
        const age = t - w.born;
        const R = Math.max(1.2, size.crown * 1.05) + 0.8, H = Math.max(0.6, size.height);
        const s = age * 0.45 * w.dir;
        const target = new THREE.Vector3(
            Math.cos(w.a + s) * R * w.sx + Math.sin(s * 1.7) * R * 0.25,
            H * (0.35 + 0.25 * Math.sin(w.b + s * 1.3)) * w.sy + 0.3,
            Math.sin(w.a + s) * R + Math.cos(s * 1.3) * R * 0.2,
        );
        // fly in from the forest edge
        const k = Math.min(1, age / 1.6);
        const e = k * k * (3 - 2 * k);
        const from = new THREE.Vector3(Math.cos(w.enter) * R * 4, H * 1.2, Math.sin(w.enter) * R * 4);
        this.pos.copy(from).lerp(target, e);
        this.group.position.copy(this.pos);
        const sc = Math.max(0.5, Math.min(4, size.height * 0.06 + 0.5));
        const left = w.life - age;
        const blink = left < 3 ? 0.55 + 0.45 * Math.sin(t * 14) : 1;
        this.halo.scale.setScalar(sc * 3.2 * (1 + Math.sin(t * 5) * 0.12));
        this.core.scale.setScalar(sc * 0.8);
        this.star.scale.setScalar(sc * 2.6 * (1 + Math.sin(t * 3) * 0.15));
        this.star.material.rotation = t * 0.8;
        this.halo.material.opacity = blink;
        this.core.material.opacity = blink;
        this.star.material.opacity = blink;
        // trail
        if (!this.trailInit) { for (let i = 0; i < this.trailN; i++) this.trail.set([this.pos.x, this.pos.y, this.pos.z], i * 3); this.trailInit = true; }
        this.trail.copyWithin(3, 0, (this.trailN - 1) * 3);
        this.trail.set([this.pos.x, this.pos.y, this.pos.z], 0);
        this.aTrail.needsUpdate = true;
        this.tu.uPx.value = px;
        this.tu.uSize.value = sc * 0.55;
        this.tu.uA.value = blink;
    }
}

// ------------------------------------------------------------------ realms
export class Realms {
    constructor(scene, textures) {
        this.scene = scene;
        this.textures = textures;
        this.islands = [];
    }
    sync(realmList, colors, now) {
        const fresh = [];
        while (this.islands.length < realmList.length) {
            const i = this.islands.length;
            const isl = this.makeIsland(colors[realmList[i]] ?? 0xffffff, i);
            isl.userData.born = now;
            this.scene.add(isl);
            this.islands.push(isl);
            fresh.push(i);
        }
        while (this.islands.length > realmList.length) this.scene.remove(this.islands.pop());
        return fresh;
    }
    makeIsland(color, i) {
        const r = mulberry(100 + i);
        const g = new THREE.Group();
        const rock = new THREE.DodecahedronGeometry(1, 1);
        const p = rock.attributes.position;
        for (let k = 0; k < p.count; k++) {
            const v = new THREE.Vector3().fromBufferAttribute(p, k);
            if (v.y > 0.2) v.y = 0.2 + (v.y - 0.2) * 0.15; else v.y *= 1.6;
            v.multiplyScalar(0.85 + r() * 0.3);
            p.setXYZ(k, v.x, v.y, v.z);
        }
        rock.computeVertexNormals();
        const rm = new THREE.Mesh(rock, new THREE.MeshStandardMaterial({ color: 0x6a6258, emissive: 0x15100c, flatShading: true }));
        const grass = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.12, 9), new THREE.MeshStandardMaterial({ color: 0x4f9a4a, emissive: 0x153a18, flatShading: true }));
        grass.position.y = 0.26;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0).scale(0.6, 1.4, 0.6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, flatShading: true }));
        crystal.position.y = 0.95;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(2.4); halo.position.y = 0.95;
        for (let k = 0; k < 3; k++) {
            const tr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x2f6a3a, flatShading: true }));
            const a = k * 2.1 + r();
            tr.position.set(Math.cos(a) * 0.55, 0.52, Math.sin(a) * 0.55);
            g.add(tr);
        }
        // little waterfall of light
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.6).translate(0, -0.8, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        fall.position.set(0.8, 0.1, 0);
        g.add(rm, grass, crystal, halo, fall);
        g.userData = { crystal, i };
        return g;
    }
    update(t, size) {
        const n = this.islands.length;
        this.islands.forEach((isl, i) => {
            const a = (i / Math.max(1, n)) * Math.PI * 2 + t * 0.03;
            const R = size.crown * 1.25 + 4;
            const h = size.height * (0.62 + (i % 3) * 0.09) + Math.sin(t * 0.5 + i) * 0.8;
            isl.position.set(Math.cos(a) * R, h, Math.sin(a) * R);
            const g = Math.min(1, (t - isl.userData.born) / 2);
            const sc = Math.max(1.5, size.crown * 0.16) * (g < 1 ? g * (1 + Math.sin(g * Math.PI) * 0.3) : 1);
            isl.scale.setScalar(sc);
            isl.userData.crystal.rotation.y = t * 0.8;
            isl.rotation.y = t * 0.05 + i;
        });
    }
}
