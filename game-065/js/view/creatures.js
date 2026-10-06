/**
 * creatures.js — the spirits you buy, living in the clearing.
 *
 * Every generator has a presence that grows with how many you own:
 *   Fireflies     points swarming the tree                 (1 per firefly, up to 700)
 *   Glowcaps      instanced glowing mushrooms in rings      (up to 160)
 *   Dew Sprites   winged orbs skimming the grass            (up to 160)
 *   Lantern Moths warm wings fluttering round the crown     (up to 160)
 *   Fox Spirits   foxes with foxfire tails trotting round   (up to 9)
 *   Moonwells     stone rings of moonlit water, light beams (up to 6)
 *   Standing Stones a rune henge                            (up to 14 stones)
 *   Treants       walking trees                             (up to 6)
 *   White Stags   silver-antlered deer                      (up to 5)
 *   Aurora Looms  the aurora in the sky                     (brightness)
 *   Dryad Court   glowing dryads dancing round the trunk   (up to 8)
 *   Star Seeds    golden crystals orbiting the crown        (up to 24)
 * New ones pop in with a little growth animation and a burst.
 */

import * as THREE from 'three';
import { U } from './stage.js';
import { groundY } from './ground.js';
import { makeFox, animateFox } from './fox.js';
import { makeTreant, animateTreant, makeStag, animateStag, makeDryad, animateDryad, makeWell, animateWell, makeStone, glowcapGeometry, crystalGeometry } from './models.js';

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FOG = /* glsl */`
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    col = mix(col, uFogColor, fogF);`;

// ------------------------------------------------------------------ flying points (fireflies, sprites, moths)
class Flock {
    /**
     * kind: 0 firefly (glow), 1 sprite (atlas 0), 2 moth (atlas 1)
     */
    constructor(scene, textures, kind, max, color, seed) {
        this.max = max;
        const r = mulberry(seed);
        const g = new THREE.BufferGeometry();
        const a = new Float32Array(max * 4), b = new Float32Array(max * 4);
        for (let i = 0; i < max; i++) {
            a.set([r(), r(), r(), r()], i * 4);
            b.set([r(), r(), 1e6, 0], i * 4);         // z = born time
        }
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
        g.setAttribute('aA', new THREE.BufferAttribute(a, 4));
        this.born = new THREE.BufferAttribute(b, 4);
        g.setAttribute('aB', this.born);
        g.setDrawRange(0, 0);
        this.u = {
            uTime: U.uTime, uMap: { value: kind === 0 ? textures.glow : textures.critters }, uKind: { value: kind },
            uColor: { value: new THREE.Color(color) }, uSpread: { value: 2 }, uHeight: { value: 1 }, uPx: { value: 1 },
            uSize: { value: [0.1, 0.32, 0.5][kind] }, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity,
        };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */`
                attribute vec4 aA; attribute vec4 aB;
                uniform float uTime; uniform float uKind; uniform float uSpread; uniform float uHeight; uniform float uPx; uniform float uSize;
                varying float vA; varying float vFlap; varying float vFogDepth;
                void main() {
                    float t = uTime;
                    float grow = clamp((t - aB.z) / 1.2, 0.0, 1.0);
                    vec3 p;
                    if (uKind < 0.5) {
                        // fireflies: drifting orbits around the tree, low to the crown
                        float rad = uSpread * (0.25 + aA.x * 1.1);
                        float ang = aA.y * 6.2831 + t * (0.05 + aA.z * 0.12) * (aA.w > 0.5 ? 1.0 : -1.0);
                        float h = uHeight * (0.05 + aA.z * 0.95) + sin(t * (0.6 + aA.w) + aA.x * 20.0) * 0.4 * (0.3 + uHeight * 0.05);
                        p = vec3(cos(ang) * rad + sin(t * 0.7 + aA.w * 9.0) * 0.6, h, sin(ang) * rad + cos(t * 0.5 + aA.x * 9.0) * 0.6);
                        vA = pow(0.5 + 0.5 * sin(t * (1.5 + aA.w * 2.5) + aA.y * 40.0), 3.0);
                    } else if (uKind < 1.5) {
                        // dew sprites: skimming over the grass in loops
                        float rad = 0.8 + aA.x * (uSpread * 0.9 + 3.0);
                        float ang = aA.y * 6.2831 + t * (0.25 + aA.z * 0.3);
                        p = vec3(cos(ang) * rad, 0.25 + aA.z * 0.8 + sin(t * 2.0 + aA.w * 10.0) * 0.15, sin(ang) * rad);
                        p.xz += vec2(sin(t * 1.7 + aA.w * 30.0), cos(t * 1.3 + aA.x * 30.0)) * 0.4;
                        vA = 0.8 + 0.2 * sin(t * 4.0 + aA.y * 20.0);
                    } else {
                        // moths: lazy spirals around the crown
                        float rad = uSpread * (0.55 + aA.x * 0.7);
                        float ang = aA.y * 6.2831 + t * (0.08 + aA.z * 0.1);
                        float h = uHeight * (0.35 + aA.z * 0.6) + sin(t * 0.8 + aA.w * 12.0) * uHeight * 0.05;
                        p = vec3(cos(ang) * rad, h, sin(ang) * rad);
                        p += vec3(sin(t * 1.1 + aA.w * 7.0), sin(t * 1.9 + aA.x * 5.0) * 0.5, cos(t * 0.9 + aA.z * 7.0)) * 0.8;
                        vA = 0.85;
                    }
                    vFlap = abs(sin(t * (uKind < 1.5 ? 22.0 : 9.0) + aA.w * 30.0));
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vFogDepth = -mv.z;
                    float pop = grow < 1.0 ? grow * (1.0 + sin(grow * 3.1416) * 0.8) : 1.0;
                    vA *= grow;
                    gl_PointSize = min(uPx * 64.0, uPx * uSize * pop * 520.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap; uniform vec3 uColor; uniform float uKind; uniform vec3 uFogColor; uniform float uFogDensity;
                varying float vA; varying float vFlap; varying float vFogDepth;
                void main() {
                    vec2 pc = gl_PointCoord;
                    vec4 t;
                    if (uKind < 0.5) t = texture2D(uMap, pc);
                    else {
                        // flap: squash the wings horizontally
                        float sx = mix(0.25, 1.0, vFlap);
                        pc.x = (pc.x - 0.5) / sx + 0.5;
                        if (pc.x < 0.0 || pc.x > 1.0) discard;
                        vec2 cell = uKind < 1.5 ? vec2(0.0, 0.0) : vec2(0.5, 0.0);
                        t = texture2D(uMap, cell + vec2(pc.x, 1.0 - pc.y) * 0.5);
                        t.rgb *= t.a;
                    }
                    vec3 col = uColor * t.rgb * vA * 1.6;
                    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
                    col *= 1.0 - fogF;
                    gl_FragColor = vec4(col, 1.0);
                }`,
        }));
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.count = 0;
    }
    setCount(n, now) {
        n = Math.min(this.max, n);
        if (n > this.count) {
            for (let i = this.count; i < n; i++) this.born.array[i * 4 + 2] = now - (this.count === 0 && n > 3 ? 2 : 0) + (i - this.count) * 0.02;
            this.born.needsUpdate = true;
        }
        this.count = n;
        this.points.geometry.setDrawRange(0, n);
    }
    frame(spread, height, px) { this.u.uSpread.value = spread; this.u.uHeight.value = height; this.u.uPx.value = px; }
}

// ------------------------------------------------------------------ glowcap mushrooms
class Glowcaps {
    constructor(scene, max) {
        this.max = max;
        const merged = glowcapGeometry();
        const r = mulberry(55);
        const ig = new THREE.InstancedBufferGeometry().copy(merged);
        const off = new Float32Array(max * 4), dat = new Float32Array(max * 4);
        for (let i = 0; i < max; i++) {
            // fairy rings: groups of ~8 around a centre, centres spiral outward
            const ring = Math.floor(i / 8), k = i % 8;
            const ca = ring * 2.4 + 0.7, cr = 1.1 + Math.sqrt(ring) * 3.2;
            const cx = Math.cos(ca) * cr, cz = Math.sin(ca) * cr;
            const rr = 0.35 + ring * 0.03;
            const x = cx + Math.cos(k / 8 * 6.283 + r()) * rr, z = cz + Math.sin(k / 8 * 6.283 + r()) * rr;
            off.set([x, groundY(x, z), z, 0.7 + r() * 0.9], i * 4);
            dat.set([1e6, r(), Math.floor(r() * 4), 0], i * 4);
        }
        ig.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 4));
        this.dat = new THREE.InstancedBufferAttribute(dat, 4);
        ig.setAttribute('iDat', this.dat);
        ig.instanceCount = 0;
        this.geo = ig;
        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: U.uTime, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uMoonDir: U.uMoonDir },
            vertexShader: /* glsl */`
                attribute vec4 iOff; attribute vec4 iDat; attribute float aPart;
                uniform float uTime;
                varying float vPart; varying vec3 vN; varying float vPulse; varying vec3 vCol; varying float vFogDepth; varying float vY; varying vec3 vP;
                void main() {
                    float g = clamp((uTime - iDat.x) / 0.9, 0.0, 1.0);
                    vP = position;
                    float pop = g * (1.0 + sin(g * 3.1416) * 0.5);
                    vec3 p = position * iOff.w * pop;
                    p.x += sin(uTime * 0.8 + iDat.y * 20.0) * 0.01 * position.y;
                    vec4 mv = viewMatrix * vec4(p + iOff.xyz, 1.0);
                    vFogDepth = -mv.z;
                    gl_Position = projectionMatrix * mv;
                    vPart = aPart; vN = normal; vY = position.y;
                    vPulse = 0.65 + 0.35 * sin(uTime * (0.8 + iDat.y) + iDat.y * 30.0);
                    int c = int(iDat.z);
                    vCol = c == 0 ? vec3(0.3, 0.9, 1.0) : c == 1 ? vec3(0.55, 1.0, 0.5) : c == 2 ? vec3(0.95, 0.5, 1.0) : vec3(1.0, 0.75, 0.35);
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uMoonDir;
                varying float vPart; varying vec3 vN; varying float vPulse; varying vec3 vCol; varying float vFogDepth; varying float vY; varying vec3 vP;
                void main() {
                    vec3 col;
                    vec3 n = normalize(vN);
                    if (vPart < 0.5) {
                        // pale stem, faintly lit from the cap above
                        col = vec3(0.8, 0.82, 0.74) * (0.28 + 0.25 * max(dot(n, uMoonDir), 0.0)) + vCol * 0.22 * smoothstep(0.08, 0.2, vY);
                    } else if (vPart < 1.5) {
                        // glowing cap, brighter at the crown, with pale spots
                        vec2 q = vP.xz / max(0.02, vP.y) * 4.0;
                        float spots = smoothstep(0.22, 0.12, length(fract(q * 1.6 + 0.3) - 0.5)) * step(0.22, vY);
                        col = vCol * vPulse * (1.1 + smoothstep(0.2, 0.29, vY) * 0.7) + vec3(1.0, 0.98, 0.9) * spots * 0.55;
                    } else {
                        // gills: softer, lit from inside
                        col = mix(vCol, vec3(1.0), 0.35) * vPulse * 0.75;
                    }
                    ${FOG}
                    gl_FragColor = vec4(col, 1.0);
                }`,
        });
        this.mesh = new THREE.Mesh(ig, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.count = 0;
    }
    setCount(n, now) {
        n = Math.min(this.max, n);
        for (let i = this.count; i < n; i++) this.dat.array[i * 4] = now + (i - this.count) * 0.04 - (this.count === 0 && n > 3 ? 2 : 0);
        if (n > this.count) this.dat.needsUpdate = true;
        this.count = n;
        this.geo.instanceCount = n;
    }
    positionOf(i) { const a = this.geo.attributes.iOff.array; return new THREE.Vector3(a[i * 4], a[i * 4 + 1] + 0.2, a[i * 4 + 2]); }
}

// ------------------------------------------------------------------ star crystals (instanced)
function makeCrystalMesh(max) {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xfff2c0, emissive: 0xffb83a, emissiveIntensity: 0.5, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, flatShading: true });
    const m = new THREE.InstancedMesh(crystalGeometry(), mat, max);
    m.count = 0;
    m.frustumCulled = false;
    return m;
}

// ------------------------------------------------------------------ the whole menagerie
export class Creatures {
    constructor(scene, textures, quality) {
        this.scene = scene;
        this.textures = textures;
        this.t = 0;
        const q = [1, 0.75, 0.45][quality];
        this.fireflies = new Flock(scene, textures, 0, Math.round(700 * q), 0xd8ff7a, 1);
        this.sprites = new Flock(scene, textures, 1, Math.round(160 * q), 0xb8f4ff, 2);
        this.moths = new Flock(scene, textures, 2, Math.round(160 * q), 0xffd8a0, 3);
        this.caps = new Glowcaps(scene, Math.round(160 * q));
        this.foxes = []; this.wells = []; this.stones = []; this.treants = []; this.stags = []; this.dryads = [];
        this.crystals = makeCrystalMesh(24);
        scene.add(this.crystals);
        this.counts = new Array(12).fill(0);
        this.size = { height: 1, crown: 1 };
        this.aurora = 0;
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    }

    /** gens: owned counts from the sim. Returns positions of anything newly shown (for bursts). */
    sync(gens, now) {
        const fresh = [];
        const n = (i) => gens[i];
        this.fireflies.setCount(n(0), now);
        this.caps.setCount(n(1), now);
        this.sprites.setCount(n(2), now);
        this.moths.setCount(n(3), now);
        const want = (owned, max, steps) => Math.min(max, steps.filter((s) => owned >= s).length);
        this.grow(this.foxes, want(n(4), 9, [1, 3, 8, 15, 25, 40, 60, 90, 130]), (i) => {
            const f = makeFox(this.textures);
            Object.assign(f.userData, { r: 2.6 + i * 1.15, speed: 0.3 + (i % 3) * 0.06, phase: i * 1.9 });
            return f;
        }, fresh, now);
        this.grow(this.wells, want(n(5), 6, [1, 5, 15, 35, 70, 120]), (i) => {
            const w = makeWell(this.textures, i);
            const a = i * 2.1 + 0.5, r = 7.5 + (i % 3) * 3.2;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            w.position.set(x, groundY(x, z), z);
            return w;
        }, fresh, now);
        this.grow(this.stones, want(n(6), 14, [1, 2, 4, 6, 9, 12, 16, 20, 25, 30, 40, 50, 65, 80]), (i) => {
            const s = makeStone(this.textures, 2.2 + (i % 3) * 0.5, i);
            const a = i / 14 * Math.PI * 2 + 0.2, r = 19;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            s.position.set(x, groundY(x, z) - 0.1, z);
            s.rotation.y = -a + Math.PI / 2;
            return s;
        }, fresh, now);
        this.grow(this.treants, want(n(7), 6, [1, 5, 15, 35, 70, 120]), (i) => {
            const t = makeTreant(i);
            t.userData.r = 14 + i * 2.2; t.userData.speed = 0.035 + (i % 2) * 0.01; t.userData.phase = i * 1.3;
            return t;
        }, fresh, now);
        this.grow(this.stags, want(n(8), 5, [1, 6, 20, 50, 100]), (i) => {
            const s = makeStag(this.textures);
            s.userData.r = 22 + i * 2.5; s.userData.speed = 0.03; s.userData.phase = i * 2.2 + 1;
            return s;
        }, fresh, now);
        this.aurora = n(9) > 0 ? Math.min(1, 0.3 + Math.log10(n(9) + 1) * 0.3) : 0;
        this.grow(this.dryads, want(n(10), 8, [1, 3, 8, 16, 30, 50, 80, 120]), (i) => {
            const d = makeDryad(this.textures, 0.25 + i * 0.07);
            d.userData.phase = i / 8 * Math.PI * 2;
            return d;
        }, fresh, now);
        const nc = Math.min(24, n(11) > 0 ? Math.ceil(Math.sqrt(n(11)) * 2.5) : 0);
        if (nc > this.crystals.count) fresh.push(new THREE.Vector3(0, this.size.height * 0.8, 0));
        this.crystals.count = nc;
        this.counts = gens.slice();
        return fresh;
    }

    grow(list, want, make, fresh, now) {
        while (list.length < want) {
            const obj = make(list.length);
            obj.userData.born = now;
            obj.scale.setScalar(0.001);
            this.scene.add(obj);
            list.push(obj);
            fresh.push(obj.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
        }
        while (list.length > want) { const o = list.pop(); this.scene.remove(o); }
    }

    popScale(obj, t, base = 1) {
        const g = Math.min(1, (t - obj.userData.born) / 1.0);
        obj.scale.setScalar(base * (g < 1 ? g * (1 + Math.sin(g * Math.PI) * 0.4) : 1));
    }

    update(dt, t, size, px) {
        this.t = t;
        this.size = size;
        const spread = Math.max(1.2, size.crown * 1.15), height = Math.max(0.6, size.height);
        this.fireflies.frame(spread, height, px);
        this.sprites.frame(Math.max(1, size.crown * 0.6), height, px);
        this.moths.frame(spread, height, px);
        const trunkR = Math.max(0.3, size.crown * 0.12);

        // Models face +x. Travelling anticlockwise round the tree at angle a, the
        // heading is the tangent: rotation.y = -a - π/2 (local +z then points at the tree).
        this.foxes.forEach((f, i) => {
            const u = f.userData, r = u.r + trunkR * 1.5;
            const moving = ((t * 0.06 + u.phase * 0.37) % 1) < 0.8;      // trot, then stop for ~3 s
            u.walk += moving ? dt * u.speed : 0;
            const a = u.phase + u.walk;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            f.position.set(x, groundY(x, z), z);
            f.rotation.y = -a - Math.PI / 2;
            animateFox(f, t, dt, moving, -0.9, i);          // when paused, look round at the tree
            this.popScale(f, t, 1.3);
        });
        this.wells.forEach((w, i) => { animateWell(w, t, i); this.popScale(w, t, 1); });
        this.stones.forEach((s) => this.popScale(s, t, 1));
        this.treants.forEach((tr, i) => {
            const u = tr.userData, r = u.r + trunkR;
            const a = u.phase + t * u.speed;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            tr.position.set(x, groundY(x, z), z);
            tr.rotation.y = -a - Math.PI / 2;
            animateTreant(tr, t, dt, i);
            this.popScale(tr, t, 1);
        });
        this.stags.forEach((s, i) => {
            const u = s.userData, r = u.r + trunkR;
            // walk, then stop to graze
            const cycle = (t * 0.1 + u.phase) % 3;
            const moving = cycle < 2;
            u.walk = (u.walk || 0) + (moving ? dt * u.speed : 0);
            const a = u.phase + u.walk;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            s.position.set(x, groundY(x, z), z);
            s.rotation.y = -a - Math.PI / 2;
            animateStag(s, t, dt, moving, i);
            this.popScale(s, t, 1.25);
        });
        this.dryads.forEach((d, i) => {
            const u = d.userData;
            const a = u.phase + t * 0.18;
            const r = trunkR * 2.2 + 1.6;
            d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
            d.rotation.y = -a - Math.PI / 2;
            animateDryad(d, t, i);
            this.popScale(d, t, 1);
        });
        // star crystals orbiting the crown
        for (let i = 0; i < this.crystals.count; i++) {
            const a = i * 2.39996 + t * (0.12 + (i % 4) * 0.02);
            const r = size.crown * (0.75 + (i % 5) * 0.12) + 1;
            const h = size.height * (0.55 + (i % 7) * 0.06) + Math.sin(t + i) * 0.5;
            this._v.set(Math.cos(a) * r, h, Math.sin(a) * r);
            this._q.setFromEuler(new THREE.Euler(0, t * 1.5 + i, 0.3));
            const sc = Math.max(0.6, size.crown * 0.05);
            this._s.set(sc, sc, sc);
            this._m.compose(this._v, this._q, this._s);
            this.crystals.setMatrixAt(i, this._m);
        }
        this.crystals.instanceMatrix.needsUpdate = true;
    }
}
