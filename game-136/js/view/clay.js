// The clay look. One patched MeshStandardMaterial and a geometry "lumpifier":
//
// - geometry: rounded shapes (rounded boxes, lathed pucks, spheres) whose vertices are pushed about
//   by a smooth 3D noise, so every edge wobbles like a hand-pressed lump; normals are recomputed
//   on merged vertices so the wobble shades softly with no seams.
// - material: object-space value noise drives a bump (lumps and smudges), a few thumbprints made of
//   concentric ridges, a mottled tint, rougher dents, and a soft rim of light that reads as the
//   waxy glow of real plasticine. Every pow() base is clamped (a NaN pixel smears under post).

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash3 } from '../rng.js';

// ------------------------------------------------------------------ material

const CLAY_PARS = /* glsl */`
varying vec3 vClayPos;
uniform float uClaySeed;
uniform float uClayBump;
uniform float uClayRim;
float clayH3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float clayNoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(clayH3(i), clayH3(i + vec3(1, 0, 0)), f.x), mix(clayH3(i + vec3(0, 1, 0)), clayH3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(clayH3(i + vec3(0, 0, 1)), clayH3(i + vec3(1, 0, 1)), f.x), mix(clayH3(i + vec3(0, 1, 1)), clayH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float clayHeight(vec3 p) {
    vec3 q = p * 6.0 + uClaySeed;
    float h = clayNoise(q) * 0.5 + clayNoise(q * 2.7) * 0.32 + clayNoise(q * 7.3) * 0.18;
    // thumbprints: a few cells hold a whorl of fine ridges
    vec3 cell = floor(p * 3.0 + uClaySeed * 0.37);
    float pick = clayH3(cell + 11.0);
    if (pick > 0.62) {
        vec3 c = (cell + vec3(clayH3(cell), clayH3(cell + 3.0), clayH3(cell + 7.0)) - uClaySeed * 0.37) / 3.0;
        float d = distance(p, c);
        float mask = 1.0 - smoothstep(0.05, 0.13, d);
        h += sin(d * 150.0 + pick * 6.0) * 0.16 * mask;
    }
    return h;
}
float gClayH;
`;

const sharedUniforms = { uClayBump: { value: 1 }, uClayRim: { value: 1 } };

/** Turn clay detail up or down for every material at once (the photo mode does). */
export function setClayDetail(bump, rim) {
    sharedUniforms.uClayBump.value = bump;
    sharedUniforms.uClayRim.value = rim;
}

function patch(mat, seed, bump, rim) {
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uClaySeed = { value: seed };
        sh.uniforms.uClayBumpLocal = { value: bump };
        sh.uniforms.uClayRimLocal = { value: rim };
        sh.uniforms.uClayBump = sharedUniforms.uClayBump;
        sh.uniforms.uClayRim = sharedUniforms.uClayRim;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vClayPos;\nuniform float uClaySeed;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vClayPos = transformed;
                #ifdef USE_INSTANCING
                    vClayPos += instanceMatrix[3].xyz * 1.37;
                #endif`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\n' + CLAY_PARS + 'uniform float uClayBumpLocal;\nuniform float uClayRimLocal;\n')
            .replace('#include <color_fragment>', `#include <color_fragment>
                gClayH = clayHeight(vClayPos);
                diffuseColor.rgb *= 0.9 + 0.16 * clayNoise(vClayPos * 2.2 + uClaySeed * 1.7);`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = clamp(roughnessFactor + (gClayH - 0.5) * 0.18, 0.25, 1.0);`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                {
                    vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
                    float dhx = dFdx(gClayH), dhy = dFdy(gClayH);
                    vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
                    float det = dot(dpdx, r1);
                    vec3 grad = sign(det) * (dhx * r1 + dhy * r2) * 0.035 * uClayBump * uClayBumpLocal;
                    vec3 nn = abs(det) * normal - grad;
                    if (dot(nn, nn) > 1e-12) normal = normalize(nn);
                }`)
            .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
                {
                    vec3 vdir = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
                    float rim = 1.0 - clamp(dot(normal, vdir), 0.0, 1.0);
                    rim = rim * rim * rim;
                    // waxy plasticine: a little light comes back out of the edges
                    reflectedLight.indirectDiffuse += diffuseColor.rgb * rim * 0.55 * uClayRim * uClayRimLocal;
                }`);
    };
    mat.customProgramCacheKey = () => 'clay1';
}

const cache = new Map();

/**
 * A clay material. Shared per colour and options, so a room is a handful of programs and
 * materials. opts: emissive (hex), glow (0..), ghost (bool), rough, bump, rim, seed.
 */
export function clay(hex, opts = {}) {
    const k = `${hex}|${opts.emissive || 0}|${opts.ghost ? 1 : 0}|${opts.rough ?? 0.78}|${opts.bump ?? 1}|${opts.rim ?? 1}|${opts.seed ?? 0}|${opts.unique ? Math.random() : ''}`;
    let m = cache.get(k);
    if (m) return m;
    m = new THREE.MeshStandardMaterial({
        color: hex, roughness: opts.rough ?? 0.78, metalness: 0,
        emissive: opts.emissive || 0x000000, emissiveIntensity: opts.glow ?? 1,
    });
    if (opts.ghost) { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; }
    patch(m, opts.seed ?? (hex % 97) * 0.13, opts.bump ?? 1, opts.rim ?? 1);
    if (!opts.unique) cache.set(k, m);
    return m;
}

// ------------------------------------------------------------------ geometry

function vnoise(x, y, z, s) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const h = (a, b, c) => hash3(ix + a + s * 131, iy + b, iz + c);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), ux), l(h(0, 1, 0), h(1, 1, 0), ux), uy),
        l(l(h(0, 0, 1), h(1, 0, 1), ux), l(h(0, 1, 1), h(1, 1, 1), ux), uy), uz) * 2 - 1;
}

/** Push every vertex about by a smooth noise; merge so the result has no cracks and soft normals. */
export function lumpify(geo, amount = 0.02, seed = 0, freq = 3.2) {
    let g = geo.index ? geo : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g = mergeVertices(g, 1e-4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        p.setXYZ(i,
            x + vnoise(x * freq, y * freq, z * freq, seed) * amount,
            y + vnoise(x * freq + 17, y * freq, z * freq, seed) * amount,
            z + vnoise(x * freq, y * freq + 31, z * freq, seed) * amount);
    }
    g.computeVertexNormals();
    return g;
}

const geoCache = new Map();
function cached(key, make) {
    let g = geoCache.get(key);
    if (!g) { g = make(); geoCache.set(key, g); }
    return g;
}
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A rounded box, lumpy. */
export function rbox(w, h, d, r = 0.06, lump = 1, seed = 0) {
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    return cached(`b${r3(w)},${r3(h)},${r3(d)},${r3(rr)},${lump},${seed % 4}`, () =>
        lumpify(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.005, rr)), 0.014 * lump * Math.min(1, Math.max(w, h, d) * 1.5), seed % 4));
}

/** A puck/cylinder with rounded rims, made on a lathe: rTop, rBot, height, rim radius. */
export function puck(rTop, rBot, h, round = 0.04, lump = 1, seed = 0, segs = 22) {
    return cached(`p${r3(rTop)},${r3(rBot)},${r3(h)},${r3(round)},${lump},${seed % 4},${segs}`, () => {
        const rr = Math.min(round, h / 2 - 0.001, rTop - 0.001, rBot - 0.001);
        const pts = [new THREE.Vector2(0, 0)];
        const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4; pts.push(new THREE.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)); } };
        arc(rBot - rr, rr, -Math.PI / 2, 0);
        arc(rTop - rr, h - rr, 0, Math.PI / 2);
        pts.push(new THREE.Vector2(0, h));
        const g = new THREE.LatheGeometry(pts, segs);
        g.translate(0, -h / 2, 0);
        return lumpify(g, 0.012 * lump * Math.min(1, Math.max(rTop, rBot, h) * 2), seed % 4);
    });
}

/** A squashed sphere (blob). */
export function blob(r = 0.2, lump = 1, seed = 0, ws = 18, hs = 12) {
    return cached(`s${r3(r)},${lump},${seed % 4},${ws}`, () => lumpify(new THREE.SphereGeometry(r, ws, hs), 0.016 * lump * Math.min(1, r * 3), seed % 4));
}

export function capsule(r, len, lump = 1, seed = 0) {
    return cached(`c${r3(r)},${r3(len)},${lump},${seed % 4}`, () => lumpify(new THREE.CapsuleGeometry(r, len, 4, 12), 0.01 * lump, seed % 4));
}

export function torus(R, r, arc = Math.PI * 2, lump = 1, seed = 0) {
    return cached(`t${r3(R)},${r3(r)},${r3(arc)},${lump},${seed % 4}`, () => lumpify(new THREE.TorusGeometry(R, r, 10, 28, arc), 0.008 * lump, seed % 4));
}

/** A flat 2D shape pushed into a soft slab (hearts, flags, sails). */
export function slab(shape, depth = 0.04, key = '') {
    return cached(`x${key}${r3(depth)}`, () => {
        const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 12 });
        g.translate(0, 0, -depth / 2);
        return lumpify(g, 0.004, 1);
    });
}

/** A mesh of clay that casts and takes shadows. */
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}
