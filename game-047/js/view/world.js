/**
 * world.js — the ten realms as 3D backdrops, built entirely in code.
 *
 * Each realm is a group: a sky dome shader (gradient, sun and glow, FBM
 * clouds, stars, aurora, nebula, twin suns), three parallax ridge layers,
 * a painted ground with a normal map (and glowing cracks where there is
 * fire), realm props, GPU-animated weather particles, god rays, fog and a
 * light rig. A PMREM environment is baked from the sky so gold, armour and
 * card foil reflect the realm.
 */

import * as THREE from 'three';
import { worldScene, renderer, view } from './scene.js';
import { WORLD_DEFS } from '../sim/worlds.js';
import { makeRng, hashSeed } from '../sim/rng.js';
import { canvas, colorTex, dataTex, normalFromHeight, makeNoise, mixHex, radialTex } from './textures.js';

export const worldState = { current: null, index: -1, env: null, sunDir: new THREE.Vector3(), lights: null };

const GLSL_NOISE = /* glsl */`
    float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float noise3(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise3(p); p *= 2.02; a *= 0.5; } return s; }
`;
export { GLSL_NOISE };

// ------------------------------------------------------------------ sky

function makeSky(wd) {
    const [sx, sy] = wd.sunPos;
    const sunDir = new THREE.Vector3(sx, sy, -1).normalize();
    worldState.sunDir.copy(sunDir);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: {
            uTop: { value: new THREE.Color(wd.sky[0]) }, uMid: { value: new THREE.Color(wd.sky[1]) }, uHor: { value: new THREE.Color(wd.sky[2]) },
            uSun: { value: new THREE.Color(wd.sun) }, uSunDir: { value: sunDir }, uTime: { value: 0 },
            uStars: { value: wd.stars }, uClouds: { value: wd.clouds }, uAurora: { value: wd.aurora }, uNebula: { value: wd.nebula ? 1 : 0 }, uTwin: { value: wd.twinSun ? 1 : 0 },
            uAccent: { value: new THREE.Color(wd.accent) },
        },
        vertexShader: /* glsl */`
            varying vec3 vDir;
            void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uTop, uMid, uHor, uSun, uSunDir, uAccent;
            uniform float uTime, uStars, uClouds, uAurora, uNebula, uTwin;
            varying vec3 vDir;
            ${GLSL_NOISE}
            void main() {
                vec3 d = normalize(vDir);
                float h = d.y;
                vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.28, h));
                col = mix(col, uTop, smoothstep(0.22, 0.85, h));
                col = mix(col, uHor * 0.55, smoothstep(0.0, -0.25, h));
                // nebula
                if (uNebula > 0.0) {
                    float n = fbm3(d * 2.6 + vec3(0.0, 0.0, uTime * 0.004));
                    float n2 = fbm3(d * 5.0 - vec3(uTime * 0.003));
                    col += mix(vec3(0.45, 0.08, 0.7), vec3(0.08, 0.35, 0.85), n2) * smoothstep(0.42, 0.78, n) * 0.9 * uNebula;
                }
                // stars
                if (uStars > 0.0) {
                    vec3 p = d * 260.0;
                    float s = hash3(floor(p));
                    float tw = 0.55 + 0.45 * sin(uTime * (1.5 + s * 3.0) + s * 60.0);
                    float star = smoothstep(0.9965, 1.0, s) * tw;
                    col += vec3(star) * uStars * smoothstep(0.02, 0.25, h) * 2.2;
                }
                // aurora
                if (uAurora > 0.0) {
                    float w = fbm3(vec3(d.x * 3.0, d.z * 3.0, uTime * 0.04));
                    float a = sin(d.x * 7.0 + d.z * 3.0 + uTime * 0.25 + w * 5.0) * 0.5 + 0.5;
                    float band = smoothstep(0.12, 0.3, h) * smoothstep(0.75, 0.38, h);
                    col += (vec3(0.1, 1.0, 0.6) * pow(a, 5.0) + vec3(0.55, 0.25, 1.0) * pow(1.0 - a, 7.0) * 0.6) * band * uAurora * 0.9;
                }
                // sun(s)
                float sd = max(dot(d, uSunDir), 0.0);
                col += uSun * (smoothstep(0.9985, 0.9993, sd) * 4.0 + pow(sd, 60.0) * 0.8 + pow(sd, 6.0) * 0.28);
                if (uTwin > 0.0) {
                    vec3 s2 = normalize(uSunDir + vec3(0.32, -0.06, 0.0));
                    float sd2 = max(dot(d, s2), 0.0);
                    col += uAccent * (smoothstep(0.9993, 0.9996, sd2) * 3.0 + pow(sd2, 90.0) * 0.6);
                }
                // clouds
                if (uClouds > 0.0) {
                    vec2 uv = d.xz / (max(h, 0.0) + 0.12);
                    float c = fbm3(vec3(uv * 0.9 + vec2(uTime * 0.012, 0.0), uTime * 0.015));
                    float cm = smoothstep(0.48, 0.78, c) * uClouds * smoothstep(-0.02, 0.18, h);
                    vec3 lit = mix(uHor * 1.25, uSun, pow(sd, 3.0) * 0.6);
                    vec3 cc = mix(uMid * 0.7, lit, smoothstep(0.5, 0.9, c));
                    col = mix(col, cc, cm * 0.8);
                }
                gl_FragColor = vec4(col, 1.0);
            }
        `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    return sky;
}

// ------------------------------------------------------------------ ridges

function makeRidges(wd, rng, N) {
    const g = new THREE.Group();
    const layers = [[-70, 7, 0.018], [-130, 16, 0.012], [-210, 32, 0.008]];
    layers.forEach(([z, amp, freq], i) => {
        const geo = new THREE.PlaneGeometry(900, 120, 240, 1);
        const pos = geo.attributes.position;
        const seed = rng.range(0, 100);
        const colors = [];
        const top = new THREE.Color(wd.hills[i]), bot = new THREE.Color(mixHex(wd.hills[i], wd.fog, 0.5));
        for (let k = 0; k < pos.count; k++) {
            const x = pos.getX(k);
            const isTop = pos.getY(k) > 0;
            let y;
            if (isTop) {
                let n = N.fbm(x * freq + seed, seed, 5);
                if (wd.key === 'throne' || wd.key === 'frost') n = Math.pow(n, 1.6) * 1.4;
                if (wd.key === 'dunes') n = 0.5 + 0.5 * Math.sin(x * freq * 2 + seed) * 0.6 + n * 0.3;
                y = n * amp * 2 + amp * 0.2;
            } else y = -40;
            pos.setY(k, y);
            const c = isTop ? top : bot;
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
        m.position.set(0, 0, z);
        g.add(m);
    });
    return g;
}

// ------------------------------------------------------------------ ground

function groundTextures(wd, seed) {
    const S = 512;
    const N = makeNoise(seed);
    const col = canvas(S, S), hgt = canvas(S, S), emi = canvas(S, S);
    const c = col.getContext('2d'), h = hgt.getContext('2d'), e = emi.getContext('2d');
    const ci = c.createImageData(S, S), hi = h.createImageData(S, S), ei = e.createImageData(S, S);
    const a = new THREE.Color(wd.ground[0]), b = new THREE.Color(wd.ground[1]);
    const glowCol = new THREE.Color(wd.accent);
    const glow = wd.key === 'emberfall' || wd.key === 'deep' || wd.key === 'starless';
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = N.tfbm(x / 64, y / 64, 8, 5);
        const d = N.tfbm(x / 16, y / 16, 32, 3);
        const cr = N.tfbm(x / 40 + 7, y / 40 + 3, 12.8, 4);
        const crack = Math.pow(1 - Math.abs(cr - 0.5) * 2, 22);
        const t = Math.min(1, Math.max(0, n * 1.3 - 0.15 + (d - 0.5) * 0.3));
        const i = (y * S + x) * 4;
        const shade = 0.75 + d * 0.5 - crack * 0.5;
        ci.data[i] = Math.min(255, (a.r + (b.r - a.r) * t) * 255 * shade);
        ci.data[i + 1] = Math.min(255, (a.g + (b.g - a.g) * t) * 255 * shade);
        ci.data[i + 2] = Math.min(255, (a.b + (b.b - a.b) * t) * 255 * shade);
        ci.data[i + 3] = 255;
        const hv = (n * 0.6 + d * 0.4 - crack * 0.4) * 255;
        hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv; hi.data[i + 3] = 255;
        const em = glow ? crack * (wd.key === 'deep' ? 1 : 0.7) : 0;
        ei.data[i] = glowCol.r * 255 * em; ei.data[i + 1] = glowCol.g * 255 * em; ei.data[i + 2] = glowCol.b * 255 * em; ei.data[i + 3] = 255;
    }
    c.putImageData(ci, 0, 0); h.putImageData(hi, 0, 0); e.putImageData(ei, 0, 0);
    return { map: colorTex(col, { repeat: 26 }), normalMap: dataTex(normalFromHeight(hgt, 3), { repeat: 26 }), emissiveMap: glow ? colorTex(emi, { repeat: 26 }) : null };
}

function makeGround(wd, seed) {
    const t = groundTextures(wd, seed);
    const water = wd.key === 'cathedral';
    const mat = new THREE.MeshStandardMaterial({
        map: t.map, normalMap: t.normalMap, roughness: water ? 0.15 : 0.92, metalness: water ? 0.35 : 0.0,
        emissiveMap: t.emissiveMap, emissive: t.emissiveMap ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0), emissiveIntensity: t.emissiveMap ? 1.4 : 0,
        color: water ? new THREE.Color(0x3a8a90) : new THREE.Color(1, 1, 1),
    });
    const geo = new THREE.PlaneGeometry(700, 700, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
}

// ------------------------------------------------------------------ props

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.8, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.o ?? 1, flatShading: !!o.flat });

function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

const PROPS = {
    wheat(rng, wd) {
        const n = 90;
        const geo = new THREE.ConeGeometry(0.05, 1.2, 4);
        geo.translate(0, 0.6, 0);
        const im = new THREE.InstancedMesh(geo, M(0xd8a040, { e: 0x802000, ei: 0.4 }), n);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < n; i++) {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)));
            m4.compose(new THREE.Vector3(rng.range(-3, 3), 0, rng.range(-3, 3)), q, new THREE.Vector3(1, rng.range(0.6, 1.4), 1));
            im.setMatrixAt(i, m4);
        }
        return im;
    },
    post(rng) {
        const g = new THREE.Group();
        const wood = M(0x3a2410);
        g.add(mesh(new THREE.BoxGeometry(0.25, 4, 0.25), wood, 0, 2, 0));
        g.add(mesh(new THREE.BoxGeometry(2.4, 0.2, 0.2), wood, 0, 3.2, 0));
        g.add(mesh(new THREE.SphereGeometry(0.45, 12, 8), M(0xc89a50), 0, 4.2, 0));
        g.add(mesh(new THREE.ConeGeometry(0.7, 0.8, 10), M(0x2a1a10), 0, 4.8, 0));
        g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M(0xff8a30, { e: 0xff6a10, ei: 3 }), 0.15, 4.25, 0.4));
        g.rotation.y = rng.range(-0.5, 0.5);
        return g;
    },
    deadTree(rng) {
        const g = new THREE.Group();
        const bark = M(0x1a100a, { r: 1 });
        const trunkH = rng.range(4, 7);
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.45, trunkH, 7), bark, 0, trunkH / 2, 0));
        for (let i = 0; i < 5; i++) {
            const len = rng.range(1.5, 3);
            const b = mesh(new THREE.CylinderGeometry(0.05, 0.14, len, 5), bark, 0, trunkH * rng.range(0.5, 0.95), 0);
            b.rotation.z = rng.range(0.6, 1.2) * (rng.chance(0.5) ? 1 : -1);
            b.rotation.y = rng.range(0, Math.PI * 2);
            b.translateY(len / 2);
            g.add(b);
        }
        return g;
    },
    cottage(rng) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.BoxGeometry(3, 2.2, 2.4), M(0x3a2a20), 0, 1.1, 0));
        const roof = mesh(new THREE.ConeGeometry(2.4, 1.8, 4), M(0x2a1208), 0, 3.1, 0);
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        g.add(mesh(new THREE.PlaneGeometry(0.5, 0.6), M(0xffa040, { e: 0xff8020, ei: 2.5 }), 0.6, 1.2, 1.21));
        g.add(mesh(new THREE.PlaneGeometry(0.5, 0.6), M(0xffa040, { e: 0xff8020, ei: 2.5 }), -0.7, 1.2, 1.21));
        g.rotation.y = rng.range(-0.6, 0.6);
        return g;
    },
    pillar(rng, wd) {
        const g = new THREE.Group();
        const stone = M(0x506a70, { r: 0.6 });
        const h = rng.range(8, 14);
        g.add(mesh(new THREE.CylinderGeometry(0.6, 0.7, h, 12), stone, 0, h / 2, 0));
        g.add(mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), stone, 0, h, 0));
        g.add(mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), stone, 0, 0.25, 0));
        const kelp = M(wd.accent, { e: wd.accent, ei: 0.8 });
        for (let i = 0; i < 3; i++) {
            const k = mesh(new THREE.CylinderGeometry(0.04, 0.08, h * 0.7, 5), kelp, rng.range(-0.7, 0.7), h * 0.35, rng.range(-0.7, 0.7));
            k.rotation.z = rng.range(-0.15, 0.15);
            g.add(k);
        }
        return g;
    },
    arch(rng) {
        const g = new THREE.Group();
        const stone = M(0x405a60, { r: 0.6 });
        g.add(mesh(new THREE.TorusGeometry(4, 0.45, 8, 24, Math.PI), stone, 0, 6, 0));
        g.add(mesh(new THREE.BoxGeometry(0.9, 6, 0.9), stone, -4, 3, 0));
        g.add(mesh(new THREE.BoxGeometry(0.9, 6, 0.9), stone, 4, 3, 0));
        g.rotation.y = rng.range(-0.4, 0.4);
        return g;
    },
    kelp(rng, wd) {
        const g = new THREE.Group();
        const mat = M(0x1a6a50, { e: wd.accent, ei: 0.35 });
        for (let i = 0; i < 5; i++) {
            const h = rng.range(3, 7);
            const k = mesh(new THREE.CylinderGeometry(0.05, 0.12, h, 5, 6), mat, rng.range(-1, 1), h / 2, rng.range(-1, 1));
            k.userData.sway = rng.range(0, 6);
            g.add(k);
        }
        g.userData.animate = (t) => g.children.forEach((k) => { k.rotation.z = Math.sin(t * 0.8 + k.userData.sway) * 0.12; });
        return g;
    },
    candle(rng) {
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const h = rng.range(0.4, 1.3);
            const x = rng.range(-0.6, 0.6), z = rng.range(-0.6, 0.6);
            g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, h, 8), M(0xe8e0c8), x, h / 2, z));
            g.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), M(0xffc060, { e: 0xffa030, ei: 5 }), x, h + 0.1, z));
        }
        return g;
    },
    tree(rng, wd) {
        const g = new THREE.Group();
        const h = rng.range(4, 8);
        g.add(mesh(new THREE.CylinderGeometry(0.25, 0.55, h, 8), M(0x2a1e14), 0, h / 2, 0));
        const leaf = M(mixHex(wd.hills[2], 0x40a040, 0.5), { r: 0.9, flat: true });
        for (let i = 0; i < 4; i++) {
            const s = rng.range(1.4, 2.4);
            g.add(mesh(new THREE.IcosahedronGeometry(s, 1), leaf, rng.range(-1, 1), h + rng.range(-0.5, 1.5), rng.range(-1, 1)));
        }
        const glowM = M(wd.accent, { e: wd.accent, ei: 2 });
        for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.12, 6, 6), glowM, rng.range(-2, 2), h + rng.range(-1, 2), rng.range(-2, 2)));
        return g;
    },
    mushroom(rng, wd) {
        const g = new THREE.Group();
        const h = rng.range(1, 3);
        g.add(mesh(new THREE.CylinderGeometry(0.15, 0.25, h, 8), M(0xe8dcc0), 0, h / 2, 0));
        const cap = mesh(new THREE.SphereGeometry(rng.range(0.8, 1.4), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xa02060, { e: wd.accent, ei: 0.25 }), 0, h, 0);
        g.add(cap);
        for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.1, 6, 6), M(0xffffff, { e: wd.accent, ei: 2 }), rng.range(-0.6, 0.6), h + rng.range(0.3, 0.7), rng.range(-0.6, 0.6)));
        return g;
    },
    thorn(rng) {
        const g = new THREE.Group();
        const mat = M(0x1a2a10, { r: 0.7 });
        for (let i = 0; i < 6; i++) {
            const c = mesh(new THREE.ConeGeometry(0.25, rng.range(2, 5), 6), mat, rng.range(-1.5, 1.5), 1.5, rng.range(-1.5, 1.5));
            c.rotation.set(rng.range(-0.6, 0.6), 0, rng.range(-0.6, 0.6));
            g.add(c);
        }
        return g;
    },
    stone(rng) {
        const s = rng.range(0.6, 2);
        const m = mesh(new THREE.DodecahedronGeometry(s, 0), M(0x5a5a50, { flat: true }), 0, s * 0.5, 0);
        m.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
        return m;
    },
    crystal(rng, wd) {
        const g = new THREE.Group();
        const mat = new THREE.MeshPhysicalMaterial({ color: wd.accent, emissive: wd.accent, emissiveIntensity: 0.4, roughness: 0.05, metalness: 0, transmission: 0.3, transparent: true, opacity: 0.85, flatShading: true });
        for (let i = 0; i < 5; i++) {
            const h = rng.range(1.2, 4);
            const c = mesh(new THREE.OctahedronGeometry(0.5, 0), mat, rng.range(-1, 1), h / 2, rng.range(-1, 1));
            c.scale.set(1, h, 1);
            c.rotation.set(rng.range(-0.4, 0.4), rng.range(0, 3), rng.range(-0.4, 0.4));
            g.add(c);
        }
        return g;
    },
    dune(rng, wd) {
        const m = mesh(new THREE.SphereGeometry(1, 20, 10), M(wd.ground[1], { r: 1 }), 0, -rng.range(1, 2), 0);
        m.scale.set(rng.range(8, 16), rng.range(2, 4), rng.range(5, 9));
        return m;
    },
    obelisk(rng, wd) {
        const g = new THREE.Group();
        const h = rng.range(6, 12);
        const o = mesh(new THREE.CylinderGeometry(0.4, 0.9, h, 4), M(0x3a2a2a, { r: 0.5, flat: true }), 0, h / 2, 0);
        g.add(o);
        g.add(mesh(new THREE.OctahedronGeometry(0.5, 0), M(wd.accent, { e: wd.accent, ei: 3 }), 0, h + 0.6, 0));
        return g;
    },
    bones(rng) {
        const g = new THREE.Group();
        const mat = M(0xe8dcc0, { r: 0.6 });
        for (let i = 0; i < 6; i++) {
            const r = mesh(new THREE.TorusGeometry(1.4, 0.12, 6, 12, Math.PI * 0.9), mat, i * 0.6 - 1.5, 0, 0);
            r.rotation.y = Math.PI / 2;
            g.add(r);
        }
        { const mm = mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), mat, 0, 0.1, 0); mm.rotation.z = Math.PI / 2; g.add(mm); }
        g.rotation.y = rng.range(0, 3);
        return g;
    },
    iceSpike(rng, wd) {
        const g = new THREE.Group();
        const mat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.1, transmission: 0.4, transparent: true, opacity: 0.9, emissive: wd.accent, emissiveIntensity: 0.15, flatShading: true });
        for (let i = 0; i < 4; i++) {
            const h = rng.range(2, 7);
            const c = mesh(new THREE.ConeGeometry(rng.range(0.4, 1), h, 5), mat, rng.range(-1.5, 1.5), h / 2, rng.range(-1.5, 1.5));
            c.rotation.set(rng.range(-0.2, 0.2), rng.range(0, 3), rng.range(-0.2, 0.2));
            g.add(c);
        }
        return g;
    },
    pine(rng) {
        const g = new THREE.Group();
        const h = rng.range(5, 9);
        g.add(mesh(new THREE.CylinderGeometry(0.15, 0.3, h * 0.4, 6), M(0x2a1a10), 0, h * 0.2, 0));
        const mat = M(0x1a3a3a, { flat: true });
        const snow = M(0xf0f8ff);
        for (let i = 0; i < 4; i++) {
            const r = (1 - i / 4) * 2 + 0.4;
            g.add(mesh(new THREE.ConeGeometry(r, h * 0.35, 8), mat, 0, h * (0.35 + i * 0.17), 0));
            g.add(mesh(new THREE.ConeGeometry(r * 0.55, h * 0.12, 8), snow, 0, h * (0.35 + i * 0.17) + h * 0.13, 0));
        }
        return g;
    },
    rock(rng, wd) {
        const s = rng.range(1, 3);
        const m = mesh(new THREE.DodecahedronGeometry(s, 1), M(mixHex(wd.hills[1], 0x808080, 0.3), { flat: true }), 0, s * 0.4, 0);
        m.scale.y = rng.range(0.5, 1);
        return m;
    },
    cairn(rng) {
        const g = new THREE.Group();
        let y = 0;
        for (let i = 0; i < 5; i++) { const r = 0.7 - i * 0.1; g.add(mesh(new THREE.DodecahedronGeometry(r, 0), M(0x7a8090, { flat: true }), rng.range(-0.1, 0.1), y + r * 0.7, 0)); y += r * 1.2; }
        return g;
    },
    stalagmite(rng, wd) {
        const h = rng.range(3, 9);
        return mesh(new THREE.ConeGeometry(rng.range(0.6, 1.4), h, 7), M(0x3a2618, { flat: true, e: wd.accent, ei: 0.05 }), 0, h / 2, 0);
    },
    goldPile(rng) {
        const n = 60;
        const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12);
        const im = new THREE.InstancedMesh(geo, M(0xffc040, { r: 0.25, m: 1, e: 0x402000, ei: 0.3 }), n);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < n; i++) {
            const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 1.6;
            const y = Math.max(0, (1.6 - r) * 0.6) + rng.range(0, 0.1);
            m4.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.5, 0.5), 0, rng.range(-0.5, 0.5))), new THREE.Vector3(1, 1, 1));
            im.setMatrixAt(i, m4);
        }
        im.castShadow = true;
        return im;
    },
    forge(rng, wd) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.BoxGeometry(2.5, 2, 2), M(0x2a2020), 0, 1, 0));
        g.add(mesh(new THREE.PlaneGeometry(1.4, 0.9), M(0xff8020, { e: wd.accent, ei: 4 }), 0, 1, 1.01));
        g.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 8), M(0x2a2020), 0.6, 4, -0.4));
        return g;
    },
    column(rng) {
        const h = rng.range(6, 12);
        const g = new THREE.Group();
        g.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, h, 10), M(0x5a4a30, { r: 0.4, m: 0.3 }), 0, h / 2, 0));
        { const mm = mesh(new THREE.TorusGeometry(0.85, 0.12, 6, 16), M(0xffc040, { m: 1, r: 0.3 }), 0, h * 0.7, 0); mm.rotation.x = Math.PI / 2; g.add(mm); }
        return g;
    },
    isle(rng) {
        const g = new THREE.Group();
        const r = rng.range(2, 4);
        { const mm = mesh(new THREE.ConeGeometry(r, r * 2, 7), M(0x6a5a4a, { flat: true }), 0, -r, 0); mm.rotation.x = Math.PI; g.add(mm); }
        g.add(mesh(new THREE.CylinderGeometry(r, r, 0.4, 7), M(0x5a9a4a, { flat: true }), 0, 0.2, 0));
        g.position.y = rng.range(6, 18);
        g.userData.animate = (t) => { g.position.y += Math.sin(t * 0.5 + r) * 0.003; };
        return g;
    },
    cloud(rng) {
        const g = new THREE.Group();
        const mat = M(0xffffff, { r: 1, e: 0x405070, ei: 0.3 });
        for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(rng.range(1, 2.2), 12, 8), mat, rng.range(-3, 3), rng.range(-0.5, 0.8), rng.range(-1, 1)));
        g.position.y = rng.range(3, 14);
        return g;
    },
    windmill(rng) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.CylinderGeometry(0.8, 1.4, 6, 8), M(0xe8e0d0), 0, 3, 0));
        g.add(mesh(new THREE.ConeGeometry(1.1, 1.4, 8), M(0x8a3a2a), 0, 6.7, 0));
        const blades = new THREE.Group();
        blades.position.set(0, 5.5, 1.1);
        for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(0.35, 4, 0.05), M(0xd8c8a8), 0, 2, 0); const p = new THREE.Group(); p.rotation.z = (i * Math.PI) / 2; p.add(b); blades.add(p); }
        g.add(blades);
        g.userData.animate = (t) => { blades.rotation.z = t * 0.6; };
        return g;
    },
    banner(rng, wd) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), M(0x3a2a1a), 0, 3.5, 0));
        const geo = new THREE.PlaneGeometry(1.4, 3, 8, 8);
        const cloth = mesh(geo, new THREE.MeshStandardMaterial({ color: wd.accent, side: THREE.DoubleSide, roughness: 0.9, emissive: wd.accent, emissiveIntensity: 0.15 }), 0.75, 5.2, 0);
        const base = geo.attributes.position.array.slice();
        g.add(cloth);
        g.userData.animate = (t) => {
            const p = geo.attributes.position;
            for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(t * 3 + x * 3) * 0.15 * (x + 0.7)); }
            p.needsUpdate = true;
        };
        return g;
    },
    tent(rng, wd) {
        const g = new THREE.Group();
        const c = canvas(256, 64);
        const cx = c.getContext('2d');
        for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#f0e0f0' : '#' + wd.accent.toString(16).padStart(6, '0'); cx.fillRect(i * 32, 0, 32, 64); }
        const tex = colorTex(c);
        const r = rng.range(2.5, 4);
        g.add(mesh(new THREE.ConeGeometry(r, r * 1.3, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }), 0, r * 0.65 + r * 0.6, 0));
        g.add(mesh(new THREE.CylinderGeometry(r, r, r * 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }), 0, r * 0.3, 0));
        g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), M(0xffe060, { e: 0xffc020, ei: 3 }), 0, r * 1.95, 0));
        return g;
    },
    lantern(rng, wd) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), M(0x1a1a1a), 0, 2, 0));
        const col = [0xff4060, 0x40ffe0, 0xffe040, 0xc060ff][rng.int(0, 3)];
        g.add(mesh(new THREE.SphereGeometry(0.4, 12, 8), M(col, { e: col, ei: 2.5 }), 0, 4.2, 0));
        return g;
    },
    carousel(rng, wd) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.CylinderGeometry(4, 4, 0.4, 24), M(0x3a1a4a), 0, 0.2, 0));
        g.add(mesh(new THREE.ConeGeometry(4.4, 2.2, 24), M(wd.accent, { e: wd.accent, ei: 0.3 }), 0, 5.4, 0));
        const ring = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ring.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), M(0xffd060, { m: 1, r: 0.3 }), Math.cos(a) * 3.2, 2.4, Math.sin(a) * 3.2));
            ring.add(mesh(new THREE.BoxGeometry(0.4, 0.6, 1), M(0xf0f0f0), Math.cos(a) * 3.2, 1.6, Math.sin(a) * 3.2));
        }
        g.add(ring);
        g.userData.animate = (t) => { ring.rotation.y = t * 0.3; };
        return g;
    },
    balloon(rng) {
        const g = new THREE.Group();
        const col = [0xff4060, 0x40a0ff, 0xffe040, 0x60ff90][rng.int(0, 3)];
        g.add(mesh(new THREE.SphereGeometry(0.6, 12, 10), M(col, { r: 0.3, e: col, ei: 0.2 }), 0, 0, 0));
        g.position.y = rng.range(4, 12);
        const ph = rng.range(0, 6);
        g.userData.animate = (t) => { g.position.y += Math.sin(t + ph) * 0.004; };
        return g;
    },
    monolith(rng, wd) {
        const g = new THREE.Group();
        const h = rng.range(6, 14);
        g.add(mesh(new THREE.BoxGeometry(1.5, h, 0.7), M(0x0a0814, { r: 0.3, m: 0.4 }), 0, h / 2, 0));
        for (let i = 0; i < 5; i++) g.add(mesh(new THREE.PlaneGeometry(0.8, 0.12), M(wd.accent, { e: wd.accent, ei: 3 }), 0, h * (0.2 + i * 0.15), 0.36));
        g.rotation.y = rng.range(-0.5, 0.5);
        return g;
    },
    shell(rng, wd) {
        const m = mesh(new THREE.SphereGeometry(1, 16, 12, 0, Math.PI), M(0xe0d0f0, { r: 0.3, e: wd.accent, ei: 0.1 }), 0, 0.2, 0);
        m.scale.set(rng.range(1, 2), rng.range(0.6, 1.2), rng.range(1, 2));
        m.rotation.set(-Math.PI / 2, 0, rng.range(0, 3));
        return m;
    },
    wreck(rng) {
        const g = new THREE.Group();
        const hull = mesh(new THREE.CylinderGeometry(2, 2, 7, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a1a10, side: THREE.DoubleSide, roughness: 0.9 }), 0, 1.4, 0);
        hull.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI / 2);
        g.add(hull);
        { const mm = mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), M(0x2a1a10), 1, 3, 0); mm.rotation.z = 0.5; g.add(mm); }
        g.rotation.y = rng.range(0, 3);
        return g;
    },
    cardDrift(rng) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, emissive: 0x6040a0, emissiveIntensity: 0.4, side: THREE.DoubleSide, roughness: 0.6 });
        for (let i = 0; i < 6; i++) {
            const c = mesh(new THREE.PlaneGeometry(0.7, 1), mat, rng.range(-3, 3), rng.range(1, 8), rng.range(-3, 3));
            c.userData.spin = rng.range(0.2, 0.8);
            c.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
            g.add(c);
        }
        g.userData.animate = (t) => g.children.forEach((c) => { c.rotation.x += 0.004 * c.userData.spin; c.rotation.y += 0.006 * c.userData.spin; });
        return g;
    },
    throneSpire(rng, wd) {
        const g = new THREE.Group();
        const stone = M(0x2a2420, { r: 0.7, flat: true });
        const h = rng.range(12, 24);
        g.add(mesh(new THREE.CylinderGeometry(1.2, 1.8, h, 8), stone, 0, h / 2, 0));
        g.add(mesh(new THREE.ConeGeometry(1.8, 5, 8), stone, 0, h + 2.5, 0));
        for (let i = 0; i < 4; i++) g.add(mesh(new THREE.PlaneGeometry(0.4, 0.8), M(0xffc060, { e: wd.accent, ei: 2.5 }), 0, h * (0.3 + i * 0.18), 1.3 + i * 0.01));
        return g;
    },
    statue(rng) {
        const g = new THREE.Group();
        const mat = M(0x4a4440, { r: 0.8 });
        g.add(mesh(new THREE.BoxGeometry(1.6, 1, 1.6), mat, 0, 0.5, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), mat, 0, 2.5, 0));
        g.add(mesh(new THREE.SphereGeometry(0.45, 10, 8), mat, 0, 4.4, 0));
        g.add(mesh(new THREE.BoxGeometry(0.15, 3.5, 0.15), mat, 0.8, 2.8, 0.2));
        return g;
    },
    brazier(rng, wd) {
        const g = new THREE.Group();
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 8), M(0x3a2a1a, { m: 0.6 }), 0, 1, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.9, 0.4, 0.6, 12), M(0x4a3a2a, { m: 0.7, r: 0.4 }), 0, 2.2, 0));
        const fire = mesh(new THREE.ConeGeometry(0.6, 1.4, 8), M(0xffa040, { e: 0xff6010, ei: 4, t: true, o: 0.85 }), 0, 3, 0);
        g.add(fire);
        g.userData.animate = (t) => { fire.scale.set(1 + Math.sin(t * 9) * 0.1, 1 + Math.sin(t * 13) * 0.2, 1); };
        return g;
    },
};

// ------------------------------------------------------------------ weather

const WEATHER = {
    embers: { n: 700, color: [0xffa040, 0xff6020], size: 7, vel: [0, 0.9, 0], sway: 0.6, box: [60, 20, 40] },
    bubbles: { n: 500, color: [0x80fff0, 0x40c0ff], size: 9, vel: [0, 0.6, 0], sway: 0.3, box: [60, 22, 40], ring: 1 },
    spores: { n: 600, color: [0xd0ff80, 0x80ffb0], size: 6, vel: [0.1, 0.25, 0], sway: 1.2, box: [60, 18, 40] },
    sand: { n: 900, color: [0xffe0b0, 0xe0b080], size: 4, vel: [3.5, 0.1, 0], sway: 0.4, box: [70, 12, 40] },
    snow: { n: 1100, color: [0xffffff, 0xd0e8ff], size: 6, vel: [0.3, -1.1, 0], sway: 0.8, box: [60, 24, 40] },
    gold: { n: 600, color: [0xffd060, 0xffa020], size: 5, vel: [0, 0.5, 0], sway: 0.5, box: [60, 18, 40] },
    feathers: { n: 300, color: [0xffffff, 0xf0e0c0], size: 9, vel: [0.8, -0.6, 0], sway: 1.5, box: [60, 24, 40] },
    confetti: { n: 700, color: [0xff4080, 0x40e0ff, 0xffe040, 0x80ff80], size: 6, vel: [0, -0.9, 0], sway: 1.2, box: [60, 24, 40] },
    stardust: { n: 900, color: [0xc0a0ff, 0x80c0ff, 0xffffff], size: 5, vel: [0, 0.15, 0], sway: 0.3, box: [70, 22, 40] },
    ash: { n: 900, color: [0xa09890, 0x6a625a, 0xffb070], size: 6, vel: [0.2, -0.5, 0], sway: 0.9, box: [60, 24, 40] },
};

function makeWeather(wd, rng, quality) {
    const W = WEATHER[wd.weather];
    const n = Math.round(W.n * [1, 0.7, 0.4][quality]);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
        pos[i * 3] = rng.range(-W.box[0] / 2, W.box[0] / 2);
        pos[i * 3 + 1] = rng.range(0, W.box[1]);
        pos[i * 3 + 2] = rng.range(-W.box[2] + 8, 8);
        c.set(W.color[rng.int(0, W.color.length - 1)]);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        seed[i] = rng.next();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: wd.weather === 'snow' || wd.weather === 'feathers' || wd.weather === 'confetti' || wd.weather === 'ash' ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uVel: { value: new THREE.Vector3(...W.vel) }, uBox: { value: new THREE.Vector3(...W.box) }, uSway: { value: W.sway }, uSize: { value: W.size }, uPix: { value: 1 }, uRing: { value: W.ring ?? 0 }, uFlat: { value: wd.weather === 'confetti' || wd.weather === 'feathers' ? 1 : 0 } },
        vertexShader: /* glsl */`
            attribute float seed;
            attribute vec3 color;
            uniform float uTime, uSway, uSize, uPix;
            uniform vec3 uVel, uBox;
            varying vec3 vCol; varying float vSeed; varying float vFade;
            void main() {
                vec3 p = position + uVel * (uTime * (0.6 + seed * 0.8));
                p.x += sin(uTime * (0.7 + seed) + seed * 40.0) * uSway;
                p.z += cos(uTime * (0.5 + seed) + seed * 20.0) * uSway * 0.5;
                p.x = mod(p.x + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
                p.y = mod(p.y, uBox.y);
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = uSize * uPix * (0.6 + seed * 0.8) * (30.0 / -mv.z);
                vCol = color; vSeed = seed;
                vFade = smoothstep(0.0, 2.0, p.y) * smoothstep(uBox.y, uBox.y - 3.0, p.y) * (0.5 + 0.5 * sin(uTime * 2.0 + seed * 30.0));
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uRing, uFlat, uTime;
            varying vec3 vCol; varying float vSeed; varying float vFade;
            void main() {
                vec2 q = gl_PointCoord - 0.5;
                float a;
                if (uFlat > 0.5) {
                    float ang = uTime * (1.0 + vSeed * 3.0) + vSeed * 10.0;
                    vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
                    a = step(abs(r.x), 0.22) * step(abs(r.y), 0.12 + 0.3 * abs(sin(ang)));
                } else {
                    float d = length(q);
                    a = smoothstep(0.5, 0.0, d);
                    if (uRing > 0.5) a = smoothstep(0.5, 0.4, d) * smoothstep(0.25, 0.42, d) + smoothstep(0.2, 0.0, length(q + vec2(0.15))) * 0.8;
                    else a = a * a;
                }
                gl_FragColor = vec4(vCol * 1.6, a * (0.35 + 0.65 * vFade));
            }
        `,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
}

// ------------------------------------------------------------------ god rays

function makeRays(wd, rng) {
    const g = new THREE.Group();
    const tex = (() => {
        const c = canvas(64, 256);
        const x = c.getContext('2d');
        const gr = x.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 64, 256);
        const hg = x.createLinearGradient(0, 0, 64, 0);
        hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
        x.globalCompositeOperation = 'destination-out';
        x.fillStyle = hg; x.fillRect(0, 0, 64, 256);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const sun = worldState.sunDir;
    for (let i = 0; i < 6; i++) {
        const mat = new THREE.MeshBasicMaterial({ map: tex, color: wd.sun, transparent: true, opacity: rng.range(0.04, 0.1), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(3, 9), 90), mat);
        m.position.set(sun.x * 60 + rng.range(-20, 20), 20 + sun.y * 30, -40 + rng.range(-10, 10));
        m.rotation.z = -Math.atan2(sun.x, 1) * 0.8 + rng.range(-0.25, 0.25);
        m.userData.base = mat.opacity;
        m.userData.ph = rng.range(0, 6);
        g.add(m);
    }
    g.userData.animate = (t) => g.children.forEach((m) => { m.material.opacity = m.userData.base * (0.6 + 0.4 * Math.sin(t * 0.4 + m.userData.ph)); });
    return g;
}

// ------------------------------------------------------------------ build

function disposeTree(obj) {
    obj.traverse((o) => {
        if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
            for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap']) if (m[k] && !m[k].userData?.shared) m[k].dispose();
            m.dispose();
        }
    });
}

export function buildWorld(w, seed = 1) {
    if (worldState.current) {
        worldScene.remove(worldState.current);
        disposeTree(worldState.current);
    }
    const wd = WORLD_DEFS[w];
    const rng = makeRng(hashSeed(seed, w, 4));
    const N = makeNoise(hashSeed(seed, w, 5));
    const g = new THREE.Group();
    g.name = 'world';
    worldState.index = w;
    worldState.wd = wd;

    const sky = makeSky(wd);
    g.add(sky);
    g.add(makeRidges(wd, rng, N));
    g.add(makeGround(wd, hashSeed(seed, w)));

    // props: far ring + side clusters; keep the stage (|x| < 11, z > -9) clear
    const animated = [];
    const place = (type, x, z, s = 1) => {
        const p = PROPS[type](rng, wd);
        p.position.x += x; p.position.z += z;
        p.scale.multiplyScalar(s);
        g.add(p);
        if (p.userData.animate) animated.push(p);
    };
    for (let i = 0; i < 46; i++) {
        const type = wd.props[i % wd.props.length];
        let x, z;
        for (let k = 0; k < 10; k++) {
            x = rng.range(-55, 55); z = rng.range(-55, -6);
            if (!(Math.abs(x) < 13 && z > -12)) break;
        }
        place(type, x, z, rng.range(0.8, 1.3));
    }
    for (let i = 0; i < 10; i++) place(wd.props[i % 2], rng.chance(0.5) ? rng.range(-26, -15) : rng.range(15, 26), rng.range(-8, 3), rng.range(0.6, 1));

    const weather = makeWeather(wd, rng, view.quality);
    g.add(weather);
    const rays = makeRays(wd, rng);
    g.add(rays);
    animated.push(rays);

    // lights
    const hemi = new THREE.HemisphereLight(wd.sky[1], wd.ground[0], 1.1);
    g.add(hemi);
    const sun = new THREE.DirectionalLight(wd.sun, 2.4);
    sun.position.set(worldState.sunDir.x * 40, Math.max(12, worldState.sunDir.y * 60), 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    g.add(sun);
    g.add(sun.target);
    const rim = new THREE.DirectionalLight(wd.rim, 2.2);
    rim.position.set(-6, 8, -20);
    g.add(rim);
    const front = new THREE.DirectionalLight(0xffffff, 0.55);
    front.position.set(0, 4, 20);
    g.add(front);
    worldState.lights = { hemi, sun, rim, front };

    worldScene.fog = new THREE.FogExp2(wd.fog, wd.fogDensity * 0.42);
    worldScene.background = new THREE.Color(wd.sky[2]);
    worldScene.add(g);
    worldState.current = g;
    worldState.sky = sky;
    worldState.weather = weather;
    worldState.animated = animated;

    // environment for reflections: bake the sky alone
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyClone = new THREE.Mesh(sky.geometry, sky.material);
    envScene.add(skyClone);
    if (worldState.env) worldState.env.dispose();
    const rt = pm.fromScene(envScene, 0.02, 1, 600);
    worldState.env = rt;
    worldScene.environment = rt.texture;
    pm.dispose();
    return { env: rt.texture, wd };
}

export function updateWorld(dt, t) {
    if (!worldState.current) return;
    worldState.sky.material.uniforms.uTime.value = t;
    const wu = worldState.weather.material.uniforms;
    wu.uTime.value = t;
    wu.uPix.value = view.dpr * (view.h / 900);
    for (const a of worldState.animated) a.userData.animate(t, dt);
}

export { radialTex };
