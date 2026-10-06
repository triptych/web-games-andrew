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
        const stem = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6).translate(0, 0.11, 0);
        const cap = new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.2, 0);
        const merged = mergeGeos([stem, cap], [0, 1]);
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
                varying float vPart; varying vec3 vN; varying float vPulse; varying vec3 vCol; varying float vFogDepth; varying float vY;
                void main() {
                    float g = clamp((uTime - iDat.x) / 0.9, 0.0, 1.0);
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
                varying float vPart; varying vec3 vN; varying float vPulse; varying vec3 vCol; varying float vFogDepth; varying float vY;
                void main() {
                    vec3 col;
                    if (vPart < 0.5) col = vec3(0.75, 0.8, 0.7) * (0.25 + 0.25 * max(dot(normalize(vN), uMoonDir), 0.0)) + vCol * 0.15;
                    else {
                        float spots = step(0.75, fract(sin(dot(floor(vN.xz * 6.0), vec2(12.9, 78.2))) * 43758.5));
                        col = vCol * vPulse * 1.6 + vec3(1.0) * spots * 0.4;
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

/** Merge geometries into one, tagging each part with aPart. */
function mergeGeos(geos, parts) {
    const pos = [], nor = [], part = [], idx = [];
    let base = 0;
    geos.forEach((g, gi) => {
        const p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); part.push(parts[gi]); }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
        else for (let i = 0; i < p.count; i++) idx.push(i + base);
        base += p.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    out.setIndex(idx);
    return out;
}

// ------------------------------------------------------------------ simple lit materials
function glowMat(color, emissive, intensity = 1) {
    return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.7, flatShading: true });
}

// ------------------------------------------------------------------ fox spirit
function makeFox(textures) {
    const g = new THREE.Group();
    const fur = glowMat(0xf2a86a, 0x8a3a10, 0.35);
    const white = glowMat(0xfff4e8, 0x6a5040, 0.3);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6).scale(1.5, 0.85, 0.85), fur);
    body.position.y = 0.32;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 6).rotateZ(-Math.PI / 2), fur);
    head.position.set(0.38, 0.45, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), fur);
    skull.position.set(0.3, 0.46, 0);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), fur);
        ear.position.set(0.27, 0.62, s * 0.08);
        g.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9ff8ff }));
        eye.position.set(0.39, 0.5, s * 0.07);
        g.add(eye);
    }
    const legs = [];
    for (const [x, z] of [[0.18, 0.1], [0.18, -0.1], [-0.18, 0.1], [-0.18, -0.1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.24, 5).translate(0, -0.12, 0), white);
        leg.position.set(x, 0.26, z);
        legs.push(leg); g.add(leg);
    }
    const tail = new THREE.Group();
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 7).rotateZ(Math.PI / 2 + 0.4).translate(-0.25, 0.1, 0), fur);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0xbff8ff }));
    tip.position.set(-0.5, 0.22, 0);
    tail.add(tailMesh, tip);
    tail.position.set(-0.3, 0.38, 0);
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0x7fdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.scale.setScalar(0.6);
    fire.position.set(-0.5, 0.25, 0);
    tail.add(fire);
    g.add(body, head, skull, tail);
    g.userData = { legs, tail, fire };
    return g;
}

// ------------------------------------------------------------------ treant
function makeTreant(color) {
    const g = new THREE.Group();
    const bark = glowMat(0x5a4636, 0x1a120c, 0.4);
    const leaf = glowMat(color, 0x1f5a2a, 0.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.0, 7), bark);
    trunk.position.y = 1.9;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), leaf);
    crown.position.y = 3.3; crown.scale.set(1, 0.85, 1);
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.0, 5).translate(0, -0.5, 0), bark);
        leg.position.set(0, 1.0, s * 0.25);
        legs.push(leg); g.add(leg);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.3, 5).translate(0, -0.65, 0), bark);
        arm.position.set(0, 2.5, s * 0.42);
        arm.rotation.x = s * 0.5;
        arms.push(arm); g.add(arm);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe28a }));
        eye.position.set(0.33, 2.35, s * 0.13);
        g.add(eye);
    }
    g.add(trunk, crown);
    g.userData = { legs, arms };
    return g;
}

// ------------------------------------------------------------------ white stag
function makeStag() {
    const g = new THREE.Group();
    const coat = glowMat(0xf0f4ff, 0x7088b0, 0.55);
    const silver = new THREE.MeshBasicMaterial({ color: 0xd8f0ff });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 7).scale(1.6, 0.8, 0.75), coat);
    body.position.y = 1.15;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.7, 6), coat);
    neck.position.set(0.55, 1.5, 0); neck.rotation.z = -0.6;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6).rotateZ(-Math.PI / 2), coat);
    head.position.set(0.88, 1.78, 0);
    const legs = [];
    for (const [x, z] of [[0.45, 0.18], [0.45, -0.18], [-0.45, 0.18], [-0.45, -0.18]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.85, 5).translate(0, -0.42, 0), coat);
        leg.position.set(x, 0.92, z);
        legs.push(leg); g.add(leg);
    }
    // antlers: a few branching tines
    const antler = new THREE.Group();
    const tine = (len, rx, rz, x, y) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, len, 4).translate(0, len / 2, 0), silver);
        m.position.set(x, y, 0); m.rotation.set(rx, 0, rz); return m;
    };
    for (const s of [-1, 1]) {
        const side = new THREE.Group();
        side.add(tine(0.6, s * 0.5, 0.25, 0, 0));
        side.add(tine(0.3, s * 0.9, -0.3, 0.05, 0.25));
        side.add(tine(0.32, s * 0.2, 0.8, 0.08, 0.38));
        side.add(tine(0.25, s * 1.1, 0.1, 0.1, 0.5));
        side.position.set(0, 0, s * 0.06);
        antler.add(side);
    }
    antler.position.set(0.82, 1.9, 0);
    g.add(body, neck, head, antler);
    g.userData = { legs, head };
    return g;
}

// ------------------------------------------------------------------ dryad
function makeDryad(textures, hue) {
    const g = new THREE.Group();
    const c = new THREE.Color().setHSL(hue, 0.6, 0.7);
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.4 });
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 8, 1, true), mat);
    dress.position.y = 0.6;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 7), mat);
    torso.position.y = 1.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat);
    head.position.y = 1.75;
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 7), mat);
    hair.position.set(-0.08, 1.55, 0); hair.rotation.z = 0.25;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    halo.scale.setScalar(2.6); halo.position.y = 1.1;
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.6, 5).translate(0, -0.3, 0), mat);
        arm.position.set(0, 1.55, s * 0.16);
        arms.push(arm); g.add(arm);
    }
    g.add(dress, torso, head, hair, halo);
    g.userData = { arms };
    return g;
}

// ------------------------------------------------------------------ moonwell
function makeWell(textures) {
    const g = new THREE.Group();
    const stoneMat = glowMat(0x8a9890, 0x16202a, 0.5);
    const rock = new THREE.DodecahedronGeometry(0.28, 0);
    for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2;
        const m = new THREE.Mesh(rock, stoneMat);
        m.position.set(Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15);
        m.rotation.set(i, i * 2, i * 3);
        m.scale.set(1, 0.7 + (i % 3) * 0.15, 1);
        g.add(m);
    }
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){ vec2 p = vUv - 0.5; float r = length(p);
              float rip = 0.5 + 0.5 * sin(r * 40.0 - uTime * 2.0);
              vec3 col = mix(vec3(0.15, 0.4, 0.75), vec3(0.75, 0.95, 1.0), rip * 0.35 + smoothstep(0.25, 0.0, length(p - vec2(0.08, -0.05))) * 0.8);
              gl_FragColor = vec4(col * 1.3, 1.0); }`,
    }));
    water.position.y = 0.08;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 9, 20, 1, true).translate(0, 4.5, 0), new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){ float a = (1.0 - vUv.y) * (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.x * 40.0 + uTime * 1.5));
              gl_FragColor = vec4(vec3(0.45, 0.7, 1.0) * a * 0.35, 1.0); }`,
    }));
    g.add(water, beam);
    return g;
}

// ------------------------------------------------------------------ standing stone
function makeStone(textures, h) {
    const geo = new THREE.BoxGeometry(0.7, h, 0.35, 1, 4, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / h + 0.5;
        p.setX(i, p.getX(i) * (1 - y * 0.25));
        p.setZ(i, p.getZ(i) * (1 - y * 0.2));
    }
    geo.translate(0, h / 2, 0);
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uRune: { value: textures.rune }, uMoonDir: U.uMoonDir, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uH: { value: h } },
        vertexShader: `varying vec3 vN; varying vec2 vUv; varying float vFogDepth;
            void main(){ vN = normal; vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uTime; uniform sampler2D uRune; uniform vec3 uMoonDir; uniform vec3 uFogColor; uniform float uFogDensity;
            varying vec3 vN; varying vec2 vUv; varying float vFogDepth;
            void main(){ vec3 n = normalize(vN);
              vec3 col = vec3(0.42, 0.45, 0.44) * (0.25 + 0.4 * max(dot(n, uMoonDir), 0.0));
              float rune = texture2D(uRune, vUv * vec2(0.5, 0.35)).r;
              col += vec3(0.4, 0.95, 1.0) * smoothstep(0.5, 1.0, rune) * (0.6 + 0.4 * sin(uTime * 1.2 + vUv.y * 4.0)) * 1.4;
              ${FOG}
              gl_FragColor = vec4(col, 1.0); }`,
    });
    return new THREE.Mesh(geo, mat);
}

// ------------------------------------------------------------------ star crystal
function makeCrystalMesh(max) {
    const geo = new THREE.OctahedronGeometry(0.5, 0).scale(0.6, 1, 0.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0xffc850, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true });
    const m = new THREE.InstancedMesh(geo, mat, max);
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
            f.userData.r = 2.6 + i * 1.15; f.userData.speed = 0.35 + (i % 3) * 0.08; f.userData.phase = i * 1.9;
            return f;
        }, fresh, now);
        this.grow(this.wells, want(n(5), 6, [1, 5, 15, 35, 70, 120]), (i) => {
            const w = makeWell(this.textures);
            const a = i * 2.1 + 0.5, r = 7.5 + (i % 3) * 3.2;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            w.position.set(x, groundY(x, z), z);
            return w;
        }, fresh, now);
        this.grow(this.stones, want(n(6), 14, [1, 2, 4, 6, 9, 12, 16, 20, 25, 30, 40, 50, 65, 80]), (i) => {
            const s = makeStone(this.textures, 2.2 + (i % 3) * 0.5);
            const a = i / 14 * Math.PI * 2 + 0.2, r = 19;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            s.position.set(x, groundY(x, z) - 0.1, z);
            s.rotation.y = -a + Math.PI / 2;
            return s;
        }, fresh, now);
        this.grow(this.treants, want(n(7), 6, [1, 5, 15, 35, 70, 120]), (i) => {
            const t = makeTreant([0x5fae5a, 0x6fbf6a, 0x4f9e6a][i % 3]);
            t.userData.r = 14 + i * 2.2; t.userData.speed = 0.035 + (i % 2) * 0.01; t.userData.phase = i * 1.3;
            return t;
        }, fresh, now);
        this.grow(this.stags, want(n(8), 5, [1, 6, 20, 50, 100]), (i) => {
            const s = makeStag();
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

        this.foxes.forEach((f, i) => {
            const u = f.userData, r = u.r + trunkR * 1.5;
            const a = u.phase + t * u.speed;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            f.position.set(x, groundY(x, z) + Math.abs(Math.sin(t * 8 + i)) * 0.04, z);
            f.rotation.y = -a - Math.PI;      // face along the circle
            u.legs.forEach((l, k) => { l.rotation.z = Math.sin(t * 9 + k * Math.PI * (k % 2 ? 1 : 0.5)) * 0.6; });
            u.tail.rotation.y = Math.sin(t * 3 + i) * 0.4;
            u.fire.material.opacity = 0.7 + Math.sin(t * 6 + i) * 0.3;
            this.popScale(f, t, 1);
        });
        this.wells.forEach((w) => this.popScale(w, t, 1));
        this.stones.forEach((s) => this.popScale(s, t, 1));
        this.treants.forEach((tr, i) => {
            const u = tr.userData, r = u.r + trunkR;
            const a = u.phase + t * u.speed;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            tr.position.set(x, groundY(x, z), z);
            tr.rotation.y = -a - Math.PI;
            const step = Math.sin(t * 2.2 + i);
            u.legs[0].rotation.z = step * 0.4; u.legs[1].rotation.z = -step * 0.4;
            u.arms[0].rotation.z = -step * 0.3; u.arms[1].rotation.z = step * 0.3;
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
            s.rotation.y = -a - Math.PI;
            u.legs.forEach((l, k) => { l.rotation.z = moving ? Math.sin(t * 6 + k * 1.6) * 0.45 : 0; });
            s.rotation.z = moving ? 0 : -0.15 * Math.min(1, cycle - 2) * 2;
            this.popScale(s, t, 1.25);
        });
        this.dryads.forEach((d, i) => {
            const u = d.userData;
            const a = u.phase + t * 0.18;
            const r = trunkR * 2.2 + 1.6;
            d.position.set(Math.cos(a) * r, 0.05 + Math.sin(t * 2 + i) * 0.08, Math.sin(a) * r);
            d.rotation.y = -a + Math.sin(t * 1.3 + i) * 0.6;
            u.arms[0].rotation.x = 2.4 + Math.sin(t * 2 + i) * 0.4;
            u.arms[1].rotation.x = -2.4 - Math.sin(t * 2 + i) * 0.4;
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
