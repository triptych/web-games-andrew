// Gearfall's land: a dead city laid out on a grid of 40 m blocks round a
// glowing crater, made in 80 m chunks as you walk (like the sea and the
// Springwood) and seeded by where they are, so a street looks the same when
// you come back to it. The nearer the crater, the bigger the buildings:
// tumbledown houses and sheds out on the edge, then shops, flats and
// warehouses, then towers, and nearest the crater, towers broken off short.
// Past the edge of the city the wasteland goes on for ever, and a dirt road
// runs in across it from the vault door. The ground is one big plane drawn by
// a shader (the broken roads, kerbs, potholes, faded lines, weeds, dirt and the
// scorched, glowing ground round the crater), plus a bowl for the crater.

import * as THREE from 'three';
import { rng, fbm2, clamp, lerp, smoothstep, TAU } from './util.js';
import { GLSL_HASH, WIN } from './gearfall-kit.js';

export const BLOCK = 40;            // the street grid
export const ROAD = 5;              // half a street, kerb to kerb plus pavement
export const ASPH = 3.6;            // half the carriageway
export const CHUNK = 80;            // two blocks a side
export const CRATER_R = 104;        // the bowl mesh
export const CLEAR_R = 118;         // nothing is built nearer the middle than this
export const DOWNTOWN = 330, MIDTOWN = 700, EDGE = 1150;
// the vault door, and the long hall behind it, south of the city at the end of the dirt road
export const DOOR_Z = 1290;
export const HALL_D = 16, HALL_W = 14, HALL_H = 10;
export const CORR_W = 5, CORR_H = 5, CORR_L = 92;
export const SPAWN_Z = DOOR_Z + HALL_D + CORR_L - 3.5;

/** Which part of the city (x, z) is in. */
export function zoneAt(x, z) {
    const d = Math.hypot(x, z);
    if (d < CLEAR_R) return 'crater';
    if (d < DOWNTOWN) return 'downtown';
    if (d < MIDTOWN) return 'midtown';
    if (d < EDGE) return 'outskirts';
    if (Math.abs(x) < 30 && z > EDGE && z < DOOR_Z + 6) return 'road';
    return 'waste';
}

/** The ground: flat but for the crater's bowl and the berm thrown up round it. */
export function groundY(x, z) {
    const d = Math.hypot(x, z);
    if (d >= CRATER_R) return 0;
    const bowl = -15.5 * (1 - smoothstep(30, 76, d));
    const rim = 3.4 * Math.exp(-(((d - 82) / 9.5) ** 2));
    const rough = fbm2(x * 0.05 + 3.1, z * 0.05 - 7.7, 3) * (1.6 * (1 - smoothstep(60, 100, d)) + 0.5);
    // fade to exactly 0 at the mesh's edge
    return (bowl + rim + rough) * (1 - smoothstep(92, CRATER_R, d));
}

/** True near the vault door's bunker, where nothing else is built. */
export function nearBunker(x, z, pad = 0) {
    return Math.abs(x) < 26 + pad && z > DOOR_Z - 26 - pad && z < DOOR_Z + HALL_D + CORR_L + 18 + pad;
}

// ------------------------------------------------------------------ what stands on each block

const PAL = {
    tower: ['#6e6a62', '#5a5f63', '#7a6e5c', '#4e5458', '#807a70', '#5c5048', '#6a6458'],
    flat: ['#8a5a44', '#7a6250', '#6e5a4a', '#8a7a62', '#5e6a6a', '#9a8068', '#704a3a', '#6a6a5a'],
    house: ['#8a8a78', '#7a8a86', '#9a8a6a', '#8a6a5a', '#6a7a6a', '#a09078', '#7e7262'],
    shack: ['#6a5a48', '#5a5048', '#7a6a50'],
    warehouse: ['#6a6e6a', '#7a6a58', '#5e6662'],
};

const plans = new Map();

/**
 * Everything on block (bi, bj): its lot is [bi*40+5, bi*40+35] x [bj*40+5, bj*40+35].
 * Returns { zone, d, items: [...] } where each item is a building
 * ({ type: 'bld', kind, x, z, w, d, yaw, gH, H, ... }) or a yard of something else.
 */
export function lotPlan(bi, bj) {
    const key = bi * 100003 + bj;
    let p = plans.get(key);
    if (p) return p;
    const r = rng(`gearfall:${bi}:${bj}`);
    const x0 = bi * BLOCK + ROAD, z0 = bj * BLOCK + ROAD, L = BLOCK - ROAD * 2;
    const cx = x0 + L / 2, cz = z0 + L / 2;
    const d = Math.hypot(cx, cz);
    const zone = zoneAt(cx, cz);
    p = { zone, d, x0, z0, L, items: [] };
    const near = (pad) => nearBunker(cx, cz, pad) || d < CLEAR_R + 14;
    if (zone === 'crater' || near(14)) {
        plans.set(key, p);
        return p;
    }
    // parcels: the lot cut into a grid, each parcel facing a street it touches
    const parcels = (nx, nz) => {
        const out = [];
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            const w = L / nx, dd = L / nz;
            const sides = [];
            if (i === 0) sides.push(-Math.PI / 2);
            if (i === nx - 1) sides.push(Math.PI / 2);
            if (j === 0) sides.push(Math.PI);
            if (j === nz - 1) sides.push(0);
            out.push({ x: x0 + w * (i + 0.5), z: z0 + dd * (j + 0.5), w, d: dd, yaw: r.pick(sides) });
        }
        return out;
    };
    // a building in a parcel: local w across its front, d deep; the parcel's extents depend on which way it faces
    const place = (pc, kind, o) => {
        const side = Math.abs(Math.sin(pc.yaw)) > 0.5;
        const pw = side ? pc.d : pc.w, pd = side ? pc.w : pc.d;
        const w = Math.min(o.w, pw - (o.gap ?? 1.6)), dd = Math.min(o.d, pd - (o.gap ?? 1.6));
        // pushed toward the street it faces, with a setback
        const back = (pd - dd) / 2 - (o.setback ?? 0.4);
        const fx = Math.sin(pc.yaw), fz = Math.cos(pc.yaw);
        const b = {
            type: 'bld', kind, x: pc.x + fx * back, z: pc.z + fz * back, w, d: dd, yaw: pc.yaw,
            gH: o.gH, H: o.H, color: r.pick(PAL[o.pal || kind] || PAL.flat), seed: r(), win: o.win, roof: o.roof || 'flat',
            damaged: !!o.damaged, sign: o.sign ?? false,
        };
        p.items.push(b);
        return b;
    };

    if (zone === 'downtown') {
        const t = smoothstep(CLEAR_R, DOWNTOWN, d);
        const tall = lerp(150, 42, t);
        const ring = d < CLEAR_R + 60;
        const k = r();
        if (k < 0.62) {
            const pc = parcels(1, 1)[0];
            let H = tall * r.range(0.55, 1.15);
            const dmg = ring || r() < 0.22;
            if (ring) H *= r.range(0.28, 0.55);
            place(pc, 'tower', { w: r.range(20, 27), d: r.range(20, 27), gH: 4.6, H: Math.max(16, H), win: WIN.office, damaged: dmg, pal: 'tower', gap: 2.4, setback: 0.6 });
        } else if (k < 0.9) {
            for (const pc of parcels(2, 1)) {
                let H = tall * r.range(0.35, 0.85);
                if (ring) H *= r.range(0.3, 0.6);
                place(pc, r() < 0.5 ? 'tower' : 'office', { w: r.range(11, 13), d: r.range(18, 27), gH: 4.4, H: Math.max(14, H), win: r() < 0.6 ? WIN.office : WIN.flat, damaged: ring || r() < 0.25, pal: 'tower', gap: 1.8 });
            }
        } else p.items.push({ type: 'plaza', x: cx, z: cz, seed: r() });
    } else if (zone === 'midtown') {
        const k = r();
        const floorsMax = Math.round(lerp(9, 3, smoothstep(DOWNTOWN, MIDTOWN, d)));
        const flat = (pc, o = {}) => {
            const fl = r.int(2, floorsMax);
            const shop = r() < 0.55;
            place(pc, shop ? 'shop' : 'flat', { w: o.w ?? r.range(10, 14), d: o.d ?? r.range(10, 14), gH: shop ? 4 : 3.2, H: (shop ? 4 : 3.2) + fl * 3.1, win: WIN.flat, damaged: r() < 0.15, sign: shop && r() < 0.6, pal: 'flat', gap: r.range(1.2, 3) });
        };
        if (k < 0.3) for (const pc of parcels(2, 2)) flat(pc);
        else if (k < 0.62) for (const pc of parcels(2, 1)) flat(pc, { w: r.range(10, 13), d: r.range(14, 26) });
        else if (k < 0.78) {
            const pc = parcels(1, 1)[0];
            if (r() < 0.55) place(pc, 'warehouse', { w: r.range(20, 27), d: r.range(16, 24), gH: r.range(6, 8), H: 0, win: 0, roof: 'shed', pal: 'warehouse', gap: 3 });
            else place(pc, 'office', { w: r.range(18, 25), d: r.range(16, 24), gH: 4.4, H: 4.4 + r.int(4, floorsMax + 3) * 3.5, win: WIN.office, damaged: r() < 0.2, pal: 'tower', gap: 2.5 });
        } else if (k < 0.9) p.items.push({ type: 'parking', x: cx, z: cz, seed: r() });
        else p.items.push({ type: 'rubble', x: cx, z: cz, seed: r() });
    } else if (zone === 'outskirts') {
        const k = r();
        const house = (pc) => place(pc, 'house', {
            w: r.range(7, 9.5), d: r.range(7.5, 10), gH: 2.9, H: r() < 0.35 ? 2.9 + 2.9 : 0, win: WIN.house,
            roof: r() < 0.2 ? 'collapsed' : 'gable', pal: 'house', gap: 4, setback: r.range(2.5, 4.5),
        });
        if (k < 0.62) {
            for (const pc of parcels(2, 2)) {
                if (r() < 0.88) house(pc);
                else p.items.push({ type: 'yard', x: pc.x, z: pc.z, seed: r() });
            }
        } else if (k < 0.75) for (const pc of parcels(2, 1)) house(pc);
        else if (k < 0.8) {
            const pc = parcels(1, 1)[0];
            const b = place(pc, 'shop', { w: 10, d: 8, gH: 3.6, H: 0, win: 0, roof: 'flat', pal: 'flat', gap: 3, setback: 12, sign: true });
            b.garage = true;
            p.items.push({ type: 'pumps', x: pc.x, z: pc.z, yaw: pc.yaw, seed: r() });
        } else if (k < 0.86) {
            const pc = parcels(1, 1)[0];
            place(pc, 'warehouse', { w: r.range(16, 22), d: r.range(12, 18), gH: r.range(5, 6.5), H: 0, win: 0, roof: 'shed', pal: 'warehouse', gap: 4 });
        } else p.items.push({ type: 'yard', x: cx, z: cz, seed: r(), big: true });
    } else {
        // the wasteland, and the land either side of the dirt road
        const k = r();
        if (k < 0.12) {
            const pc = parcels(2, 2)[Math.floor(r() * 4)];
            place(pc, 'shack', { w: r.range(4, 5.5), d: r.range(4.5, 6), gH: 2.5, H: 0, win: 0, roof: 'tin', pal: 'shack', gap: 4 });
        } else if (k < 0.2) p.items.push({ type: 'wreck', x: cx + r.range(-10, 10), z: cz + r.range(-10, 10), seed: r() });
        else if (k < 0.24) p.items.push({ type: 'billboard', x: cx + r.range(-8, 8), z: cz + r.range(-8, 8), yaw: r() * TAU, seed: r() });
        p.items.push({ type: 'scrub', x: cx, z: cz, seed: r() });
    }
    if (plans.size > 20000) plans.clear();
    plans.set(key, p);
    return p;
}

/** Whether street (bi*40, ...) has asphalt at all: the grid fades out past the edge, but for the dirt road. */
export function streetKind(x, z) {
    const d = Math.hypot(x, z);
    if (d < CLEAR_R - 6) return 'none';
    if (d < EDGE) return d < MIDTOWN ? 'city' : 'edge';
    return 'none';
}

// ------------------------------------------------------------------ the ground

const GROUND_FN = /* glsl */ `
uniform float uTime; uniform float uNight; uniform vec3 uSky;
varying vec3 vGP;
${GLSL_HASH}
vec3 gGlow; float gRough;
vec3 groundCol(vec2 p) {
    float d = length(p);
    float n1 = fbm(p * 0.045), n2 = fbm(p * 0.33 + 3.1), n3 = vn(p * 2.1);
    gGlow = vec3(0.0);
    gRough = 0.95;
    // the lots: dirt, dead grass and old concrete
    vec3 dirt = mix(vec3(0.25, 0.2, 0.15), vec3(0.34, 0.28, 0.2), n2);
    vec3 grass = mix(vec3(0.3, 0.28, 0.16), vec3(0.21, 0.22, 0.12), n3);
    vec3 conc = vec3(0.34, 0.33, 0.31) * (0.78 + 0.28 * n2);
    float urban = 1.0 - smoothstep(600.0, 1100.0, d);
    vec3 lot = mix(dirt, grass, smoothstep(0.42, 0.62, n1) * (0.4 + 0.6 * (1.0 - urban * 0.6)));
    lot = mix(lot, conc, urban * smoothstep(0.38, 0.6, fbm(p * 0.02 + 7.0)));
    // the wasteland: cracked, dried-out earth
    float waste = smoothstep(1050.0, 1250.0, d);
    vec2 cc = p * 0.7;
    vec2 ci = floor(cc), cf = fract(cc);
    float md = 9.0, md2 = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 pt = o + vec2(h21(ci + o), h21(ci + o + 17.0)) - cf;
        float dd = dot(pt, pt);
        if (dd < md) { md2 = md; md = dd; } else if (dd < md2) md2 = dd;
    }
    float mud = smoothstep(0.0, 0.08, sqrt(md2) - sqrt(md));
    vec3 earth = mix(vec3(0.16, 0.12, 0.09), mix(vec3(0.42, 0.34, 0.24), vec3(0.36, 0.3, 0.2), n2), mud);
    lot = mix(lot, mix(earth, grass, smoothstep(0.55, 0.75, n1) * 0.7), waste);

    vec3 c = lot;
    // the streets
    vec2 g = abs(p - 40.0 * floor(p / 40.0 + 0.5));
    float rd = min(g.x, g.y);
    float grid = 1.0 - smoothstep(1080.0, 1160.0, d + n1 * 60.0);
    float eaten = smoothstep(650.0, 1100.0, d) * smoothstep(0.35, 0.65, fbm(p * 0.03 + 2.0));
    if (grid > 0.0 && rd < 5.0) {
        if (rd < 3.6) {
            vec3 asph = vec3(0.12, 0.12, 0.125) * (0.75 + 0.35 * n2) + vec3(0.03) * smoothstep(0.55, 0.75, fbm(p * 0.08 + 5.0));
            // tar patches, and the old lines
            float alongX = step(g.x, g.y);   // on a north-south street
            float along = alongX > 0.5 ? p.y : p.x;
            float across = alongX > 0.5 ? g.x : g.y;
            float other = alongX > 0.5 ? g.y : g.x;
            float fade = smoothstep(0.25, 0.7, vn(p * 0.4 + 9.0));
            if (other > 5.2) {
                if (across < 0.1) asph = mix(asph, vec3(0.55, 0.44, 0.18), step(fract(along / 7.0), 0.55) * fade * 0.8);
                if (abs(across - 3.2) < 0.07) asph = mix(asph, vec3(0.5), fade * 0.5);
                if (other < 8.6 && other > 5.6) asph = mix(asph, vec3(0.52), step(fract((alongX > 0.5 ? p.x : p.y) * 0.9), 0.5) * fade * 0.7);
            }
            // cracks, with weeds in them
            float cr = smoothstep(0.03, 0.0, abs(fbm(p * 0.11) - 0.5)) + smoothstep(0.02, 0.0, abs(fbm(p * 0.37 + 4.0) - 0.5)) * 0.8;
            asph = mix(asph, mix(vec3(0.03), vec3(0.2, 0.22, 0.1), step(0.6, n3)), clamp(cr, 0.0, 1.0));
            // potholes full of rainwater
            float ph = smoothstep(0.66, 0.7, fbm(p * 0.16 + 11.0));
            asph = mix(asph, mix(vec3(0.03, 0.035, 0.04), uSky * 0.35, 0.4), ph);
            gRough = mix(0.88, 0.12, ph);
            c = mix(asph, lot, eaten);
        } else {
            // the pavement: cracked slabs and a kerb
            vec2 sl = fract(p / 1.6);
            float joint = step(min(min(sl.x, 1.0 - sl.x), min(sl.y, 1.0 - sl.y)), 0.03);
            vec3 pave = vec3(0.4, 0.39, 0.36) * (0.75 + 0.3 * n2) * (1.0 - joint * 0.4);
            pave = mix(pave, grass * 0.9, smoothstep(0.55, 0.8, n3) * 0.6);
            if (rd < 3.85) pave = vec3(0.47, 0.46, 0.43) * (0.8 + 0.2 * n2);
            c = mix(pave, lot, eaten * 0.8);
        }
        c = mix(lot, c, grid);
    }
    // the dirt road in from the vault door
    float dr = abs(p.x);
    if (dr < 4.4 && p.y > 0.0 && p.y < ${(DOOR_Z + 2).toFixed(1)}) {
        float on = smoothstep(1060.0, 1200.0, d) * (1.0 - smoothstep(3.6, 4.4, dr + n3 * 0.6));
        vec3 track = mix(vec3(0.33, 0.27, 0.19), vec3(0.4, 0.33, 0.23), n2);
        track *= 1.0 - 0.28 * smoothstep(0.55, 0.0, abs(dr - 1.25)) * (0.6 + 0.4 * n3);
        track = mix(track, grass, smoothstep(0.6, 0.8, n1) * step(dr, 0.6) * 0.8);
        c = mix(c, track, on);
    }
    // round the crater: scorched black, fused to glass, and veined with light
    if (d < 175.0) {
        float burn = 1.0 - smoothstep(95.0, 175.0, d + n1 * 30.0);
        vec3 scorch = mix(vec3(0.05, 0.045, 0.04), vec3(0.12, 0.11, 0.1), n2);
        scorch = mix(scorch, vec3(0.08, 0.13, 0.13), smoothstep(0.6, 0.8, n3) * (1.0 - smoothstep(60.0, 100.0, d)));
        c = mix(c, scorch, burn);
        float glassy = (1.0 - smoothstep(50.0, 100.0, d)) * smoothstep(0.55, 0.75, n2);
        gRough = mix(gRough, 0.25, glassy);
        float vein = smoothstep(0.035, 0.0, abs(fbm(p * 0.07 + 1.3) - 0.5)) + smoothstep(0.025, 0.0, abs(fbm(p * 0.19 - 4.0) - 0.5)) * 0.6;
        float pulse = 0.6 + 0.4 * sin(uTime * 1.2 - d * 0.12);
        float reach = 1.0 - smoothstep(25.0, 130.0, d);
        vec3 cy = vec3(0.35, 1.0, 0.82);
        gGlow += cy * vein * reach * reach * pulse * 1.4;
        float pool = 1.0 - smoothstep(14.0, 42.0, d + n1 * 10.0);
        float rip = 0.75 + 0.25 * sin(d * 0.9 - uTime * 2.0 + n2 * 4.0);
        gGlow += cy * pool * rip * 1.1;
        c = mix(c, vec3(0.2, 0.5, 0.45), pool * 0.5);
    }
    return c;
}`;

/** The ground's material: everything is painted from where the fragment is. */
export function groundMaterial(u, discardR = 0) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uTime: u.uTime, uNight: u.uNight, uSky: u.uSky });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vGP;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>\n${GROUND_FN}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
${discardR > 0 ? `if (length(vGP.xz) < ${discardR.toFixed(1)}) discard;` : ''}
diffuseColor.rgb = groundCol(vGP.xz);`)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gGlow;');
    };
    m.customProgramCacheKey = () => 'gearfall-ground' + discardR;
    return m;
}

/** The crater's bowl: rings out to CRATER_R, shaped by groundY. */
export function craterGeometry() {
    const rings = 56, segs = 96;
    const pos = [], idx = [];
    for (let i = 0; i <= rings; i++) {
        const rr = CRATER_R * (i / rings) ** 1.15;
        for (let j = 0; j < segs; j++) {
            const a = (j / segs) * TAU;
            const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
            pos.push(x, groundY(x, z), z);
        }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
        const a = i * segs + j, b = i * segs + ((j + 1) % segs), c = a + segs, d = b + segs;
        idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}
