// Plants and rocks: Myst-like pines along the cliffs, broadleaf and blossom
// trees inland, cypresses and curved hedge niches behind the statues,
// topiary, boulders, the great glowing tree, chunked wind-swept grass and
// flower beds. Everything is instanced and sways in a shared wind.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, xf } from './materials.js';
import { lathe } from './architecture.js';
import { PLAZA_R, PATH_HALF, PAVILION_PLAZA } from './layout.js';
import { rng, fbm2, noise2, TAU, clamp, smoothstep, lerp } from './util.js';
import { leaves as leafTex } from './textures.js';

export const windUniforms = { uWindTime: { value: 0 }, uWind: { value: 1 } };

/** Adds a height-weighted sway to any material (instanced or not). */
export function addWind(mat, { amount = 0.15, height = 6, key = 'wind' } = {}) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        Object.assign(sh.uniforms, windUniforms);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uWindTime, uWind;')
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                {
                  vec4 wo = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                  #ifdef USE_INSTANCING
                  wo = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                  #endif
                  float hk = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
                  hk *= hk;
                  float ph = wo.x * 0.21 + wo.z * 0.17;
                  float sway = sin(uWindTime * 1.3 + ph) * 0.6 + sin(uWindTime * 2.7 + ph * 1.7) * 0.25 + sin(uWindTime * 0.5 + ph * 0.3) * 0.5;
                  transformed.x += sway * hk * ${amount.toFixed(3)} * uWind;
                  transformed.z += cos(uWindTime * 1.1 + ph) * hk * ${(amount * 0.6).toFixed(3)} * uWind;
                }`
            );
    };
    mat.customProgramCacheKey = () => key + amount + height;
    return mat;
}

function colorize(geo, fn) {
    const p = geo.attributes.position;
    const c = new Float32Array(p.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
        fn(p.getX(i), p.getY(i), p.getZ(i), col, i);
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
}

function jitter(geo, amt, seed, scaleXZ = 1) {
    const r = rng(seed);
    const p = geo.attributes.position;
    // keep coincident vertices together so the mesh doesn't crack
    const map = new Map();
    for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        if (!map.has(k)) map.set(k, [(r() - 0.5) * amt * scaleXZ, (r() - 0.5) * amt, (r() - 0.5) * amt * scaleXZ]);
        const d = map.get(k);
        p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
    geo.computeVertexNormals();
    return geo;
}

const prep = (g) => {
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g.index ? g.toNonIndexed() : g;
};
const merge = (list) => mergeGeometries(list.map(prep), false);

// ---------------------------------------------------------------- tree kinds

function pineGeo(seed) {
    const r = rng(seed);
    const trunk = new THREE.CylinderGeometry(0.12, 0.28, 3.2, 7).translate(0, 1.6, 0);
    colorize(trunk, (x, y, z, c) => c.set('#6b4f3a'));
    const parts = [trunk];
    const layers = 6 + Math.floor(r() * 3);
    const H = r.range(8.5, 11.5);
    for (let k = 0; k < layers; k++) {
        const t = k / (layers - 1);
        const y = lerp(2.0, H - 1.3, t);
        const rad = lerp(2.4, 0.55, Math.pow(t, 0.9)) * r.range(0.9, 1.1);
        const h = lerp(2.6, 1.6, t);
        const cone = new THREE.ConeGeometry(rad, h, 11, 2, true);
        const p = cone.attributes.position;
        // ragged, drooping hem
        for (let i = 0; i < p.count; i++) {
            const yy = p.getY(i);
            if (yy < -h / 2 + 0.01) {
                const a = Math.atan2(p.getZ(i), p.getX(i));
                const n = Math.sin(a * 5 + k) * 0.18 + Math.sin(a * 11 + k * 3) * 0.1;
                p.setXYZ(i, p.getX(i) * (1 + n), yy - Math.abs(n) * 0.9, p.getZ(i) * (1 + n));
            }
        }
        cone.computeVertexNormals();
        cone.translate(0, y + h / 2 - 0.4, 0);
        cone.rotateY(r() * TAU);
        colorize(cone, (x, yy, z, c) => {
            const inner = clamp((yy - y + 0.4) / h, 0, 1);
            c.setRGB(0.12 + inner * 0.1, 0.26 + inner * 0.16, 0.14 + inner * 0.05);
        });
        parts.push(cone);
    }
    return { geo: merge(parts), height: H };
}

function broadleafGeo(seed, blossom) {
    const r = rng(seed);
    const parts = [];
    const H = r.range(3.2, 4.2);
    const trunk = new THREE.CylinderGeometry(0.2, 0.36, H, 8, 3).translate(0, H / 2, 0);
    parts.push(colorize(jitter(trunk, 0.08, seed), (x, y, z, c) => c.set('#5d4a3a')));
    const blobs = [];
    const nb = 3 + Math.floor(r() * 2);
    for (let b = 0; b < nb; b++) {
        const a = (b / nb) * TAU + r() * 0.6;
        const len = r.range(1.6, 2.4);
        const end = new THREE.Vector3(Math.cos(a) * len, H + r.range(1.0, 2.2), Math.sin(a) * len);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, H - 0.6, 0), new THREE.Vector3(end.x * 0.3, H + 0.4, end.z * 0.3), end);
        parts.push(colorize(new THREE.TubeGeometry(curve, 6, 0.13, 5), (x, y, z, c) => c.set('#5d4a3a')));
        blobs.push(end);
    }
    blobs.push(new THREE.Vector3(0, H + 2.4, 0));
    const leafA = blossom ? new THREE.Color(r.pick(['#ffb7d5', '#f6c6ff', '#ffd1dc', '#fff0f5'])) : new THREE.Color('#3f7a2c');
    const leafB = blossom ? new THREE.Color('#ff7eb6') : new THREE.Color('#6fa040');
    for (const e of blobs) {
        const rad = r.range(1.3, 1.9);
        const s = new THREE.IcosahedronGeometry(rad, 2);
        jitter(s, 0.45, seed + e.x * 10);
        s.scale(1, 0.8, 1);
        s.translate(e.x, e.y, e.z);
        colorize(s, (x, y, z, c) => {
            const n = noise2(x * 1.7 + seed, z * 1.7 + y) * 0.5 + 0.5;
            c.copy(leafA).lerp(leafB, n * 0.7);
            c.multiplyScalar(0.7 + clamp((y - e.y + rad) / (2 * rad), 0, 1) * 0.45);
        });
        parts.push(s);
    }
    return { geo: merge(parts), height: H + 4 };
}

function cypressGeo(seed) {
    const r = rng(seed);
    const g = lathe([[0.0, 0], [0.18, 0], [0.18, 0.4], [0.52, 0.9], [0.62, 2.0], [0.55, 3.2], [0.35, 4.3], [0.12, 5.0], [0, 5.25]], 12);
    jitter(g, 0.12, seed);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const k = 1 + Math.sin(a * 4 + p.getY(i) * 3 + r() * 0.2) * 0.07;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    colorize(g, (x, y, z, c) => (y < 0.45 ? c.set('#5a4636') : c.setRGB(0.1 + y * 0.012, 0.25 + y * 0.03, 0.13)));
    return { geo: merge([g]), height: 5.25 };
}

function rockGeo(seed) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    const r = rng(seed);
    const sx = r.range(0.8, 1.4), sy = r.range(0.5, 0.9), sz = r.range(0.8, 1.3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = fbm2(v.x * 1.4 + seed, v.z * 1.4 + v.y * 1.3, 3) * 0.35;
        v.multiplyScalar(1 + n);
        // flattened facets
        v.y = Math.max(v.y, -0.3);
        p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
    }
    g.computeVertexNormals();
    return g;
}

// ---------------------------------------------------------------- placement

function clearOf(world, x, z, extra = 0) {
    const { layout, island } = world;
    if (Math.hypot(x, z) < PLAZA_R + 5 + extra) return false;
    for (const sp of layout.spokes) if (Math.hypot(x - sp.pavilion.x, z - sp.pavilion.z) < PAVILION_PLAZA + 3.5 + extra) return false;
    for (const f of layout.features) {
        const r = f.type === 'grove' ? 0 : f.type === 'fountain' ? 8.5 : 7.5;
        if (r && Math.hypot(x - f.x, z - f.z) < r + extra) return false;
    }
    if (Math.abs(x) < 6 && z > layout.dock.start - 4 && z < layout.dock.end + 4) return false;
    if (island.pathDistAt(x, z) < PATH_HALF + 5.2 + extra) return false;
    return true;
}

function scatterTrees(world) {
    const { island, layout, quality } = world;
    const r = rng('trees');
    const grid = new Map();
    const cell = 3.2;
    const near = (x, z, d) => {
        const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
        for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
            for (const t of grid.get(i * 9973 + j) || []) if (Math.hypot(t.x - x, t.z - z) < d) return true;
        }
        return false;
    };
    const put = (t) => {
        const k = Math.floor(t.x / cell) * 9973 + Math.floor(t.z / cell);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(t);
    };
    const trees = [];
    const groves = layout.features.filter((f) => f.type === 'grove');
    const H = island.half - 10;
    const tries = quality.treeTries;
    for (let i = 0; i < tries; i++) {
        const x = r.range(-H, H), z = r.range(-H, H);
        const sd = island.shoreAt(x, z);
        if (sd > -1.5) continue;
        const h = island.heightAt(x, z);
        if (h < 1.3) continue;
        if (!clearOf(world, x, z)) continue;
        const inGrove = groves.some((g) => Math.hypot(x - g.x, z - g.z) < 13);
        const density = fbm2(x * 0.03 + 40, z * 0.03, 3) * 0.5 + 0.5 + (sd > -12 ? 0.35 : 0) + (inGrove ? 0.5 : 0);
        if (r() > density * density * 1.2) continue;
        const coastal = sd > -14;
        let kind;
        if (inGrove) kind = r() < 0.6 ? 'blossom' : 'broad';
        else if (coastal) kind = r() < 0.85 ? 'pine' : 'broad';
        else kind = r() < 0.45 ? 'pine' : r() < 0.75 ? 'broad' : 'blossom';
        const minD = kind === 'pine' ? 3.4 : 4.6;
        if (near(x, z, minD)) continue;
        const t = { x, z, kind, s: r.range(0.75, 1.25), rot: r() * TAU, v: Math.floor(r() * 3) };
        trees.push(t);
        put(t);
    }
    // pines on the islet
    const is = layout.islet;
    for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + 0.4;
        trees.push({ x: is.x + Math.sin(a) * 4.4, z: is.z + Math.cos(a) * 4.4, kind: 'pine', s: 0.6 + k * 0.08, rot: a, v: k % 3 });
    }
    return trees;
}

/**
 * Instanced meshes split into square chunks, so the camera and the sun's
 * shadow camera can cull whole patches. Items may carry a colour in `c`.
 */
function instanced(world, geo, mat, list, { cast = true, yOff = 0, chunk = 32 } = {}) {
    const groups = new Map();
    for (const t of list) {
        const k = chunk === Infinity ? 0 : Math.floor(t.x / chunk) * 1000 + Math.floor(t.z / chunk);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();
    const out = [];
    for (const items of groups.values()) {
        const im = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach((t, i) => {
            const y = t.y ?? world.groundAt(t.x, t.z) - 0.15;
            e.set(t.tilt || 0, t.rot || 0, t.tiltZ || 0);
            q.setFromEuler(e);
            s.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
            p.set(t.x, y + yOff, t.z);
            m.compose(p, q, s);
            im.setMatrixAt(i, m);
            if (t.c !== undefined) im.setColorAt(i, col.set(t.c));
        });
        im.castShadow = cast;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        world.root.add(im);
        out.push(im);
    }
    return out;
}

// ---------------------------------------------------------------- hedges

function hedgeArc(h) {
    const segs = Math.max(8, Math.round(((h.a1 - h.a0) * h.r) / 0.25));
    const prof = 10;
    const pos = [], uv = [], idx = [];
    const r = rng(h.seed + 77);
    const ph = r() * 10;
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const a = lerp(h.a0, h.a1, t);
        const endTaper = smoothstep(0, 0.08, t) * smoothstep(1, 0.92, t);
        const hh = h.h * (0.55 + 0.45 * endTaper);
        for (let k = 0; k <= prof; k++) {
            const u = k / prof;
            // rounded-top cross-section: up the outside, over the top, down the inside
            const ang = u * Math.PI;
            const off = Math.cos(ang) * h.w * 0.5;
            const yy = Math.min(Math.sin(ang) * 0.5 + 0.5, 1) * hh;
            const lump = 1 + (noise2(a * 9 + ph, yy * 2.2 + k) * 0.12);
            const rr = h.r + off * lump;
            const y2 = (u === 0 || u === 1 ? 0 : yy * lump);
            pos.push(h.x + Math.sin(a) * rr, y2, h.z + Math.cos(a) * rr);
            uv.push(t * (h.a1 - h.a0) * h.r * 0.6, u * 1.8);
        }
        if (i > 0) {
            const a0 = (i - 1) * (prof + 1), b0 = i * (prof + 1);
            for (let k = 0; k < prof; k++) idx.push(a0 + k, b0 + k, a0 + k + 1, a0 + k + 1, b0 + k, b0 + k + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

function buildHedges(world) {
    const batch = new Batch();
    for (const h of world.hedges) {
        const g = hedgeArc(h);
        // follow the ground under every vertex
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + world.groundAt(p.getX(i), p.getZ(i)) - 0.1);
        g.computeVertexNormals();
        batch.add('hedge', g);
        // blocking: a few circles along the arc
        for (let a = h.a0; a <= h.a1 + 0.01; a += 0.35) world.colliders.push({ x: h.x + Math.sin(a) * h.r, z: h.z + Math.cos(a) * h.r, r: 0.45 });
    }
    for (const t of world.topiary) {
        if (t.kind === 'ball') batch.add('hedge', jitter(new THREE.IcosahedronGeometry(0.72, 2), 0.08, t.x), xf(t.x, t.y + 0.55, t.z));
        else batch.add('hedge', jitter(new THREE.ConeGeometry(0.62, 1.9, 12, 4), 0.06, t.z), xf(t.x, t.y + 0.9, t.z));
    }
    world.root.add(batch.build({ hedge: world.mats.hedge }));
}

// ---------------------------------------------------------------- great tree

function buildGreatTree(world, f) {
    const r = rng('great');
    const y0 = world.groundAt(f.x, f.z) - 0.3;
    const parts = [];
    const tips = [];
    const grow = (from, dir, len, rad, depth) => {
        const to = from.clone().addScaledVector(dir, len);
        const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(r.range(-0.4, 0.4), r.range(0, 0.3), r.range(-0.4, 0.4)).multiplyScalar(len * 0.3));
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        const g = new THREE.TubeGeometry(curve, 8, rad, 8);
        // taper
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const seg = Math.floor(i / 9) / 8;
            const c = curve.getPoint(seg);
            const k = lerp(1, 0.68, seg);
            p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
        }
        g.computeVertexNormals();
        parts.push(g);
        if (depth === 0) {
            tips.push(to);
            return;
        }
        const n = depth > 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
            const d = dir.clone().add(new THREE.Vector3(r.range(-0.9, 0.9), r.range(-0.1, 0.5), r.range(-0.9, 0.9))).normalize();
            grow(to, d, len * r.range(0.62, 0.78), rad * 0.62, depth - 1);
        }
    };
    const base = new THREE.Vector3(f.x, y0, f.z);
    grow(base, new THREE.Vector3(0, 1, 0), 5.5, 0.95, 4);
    // roots
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + r() * 0.4;
        const end = new THREE.Vector3(f.x + Math.sin(a) * 3.4, world.groundAt(f.x + Math.sin(a) * 3.4, f.z + Math.cos(a) * 3.4) - 0.2, f.z + Math.cos(a) * 3.4);
        parts.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(f.x, y0 + 1.4, f.z), new THREE.Vector3(f.x + Math.sin(a) * 1.6, y0 + 0.6, f.z + Math.cos(a) * 1.6), end), 8, 0.35, 6));
    }
    const geo = merge(parts);
    const trunk = new THREE.Mesh(geo, world.mats.bark);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    world.root.add(trunk);

    // glowing blossom clusters at every tip
    const blossoms = [];
    for (const t of tips) {
        for (let k = 0; k < 14; k++) {
            blossoms.push({ x: t.x + r.range(-1.3, 1.3), y: t.y + r.range(-0.9, 0.9), z: t.z + r.range(-1.3, 1.3), s: r.range(0.35, 0.75), rot: r() * TAU, tilt: r() * 2 });
        }
    }
    const bm = addWind(new THREE.MeshStandardMaterial({ color: 0xffc0e8, emissive: 0xff6ec7, emissiveIntensity: 0.25, roughness: 0.7, flatShading: true }), { amount: 0.08, height: 1, key: 'bloss' });
    world.glowMats.push({ mat: bm, day: 0.18, night: 0.9 });
    for (const b of blossoms) b.c = new THREE.Color().setHSL(0.86 + r() * 0.1, 0.8, 0.75 + r() * 0.15);
    instanced(world, new THREE.IcosahedronGeometry(1, 0), bm, blossoms, { cast: true, chunk: Infinity });
    world.colliders.push({ x: f.x, z: f.z, r: 1.3 });
    world.petalSources.push({ x: f.x, y: y0 + 9, z: f.z, r: 6 });
    world.landmarks.push({ name: 'The Great Tree', x: f.x, z: f.z });
}

// ---------------------------------------------------------------- grass

function bladeClump(n, seed) {
    const r = rng(seed);
    const pos = [], col = [], nrm = [], idx = [];
    for (let b = 0; b < n; b++) {
        const a = r() * TAU, d = r() * 0.22;
        const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
        const face = r() * TAU;
        const h = r.range(0.22, 0.48), w = r.range(0.03, 0.05);
        const lean = r.range(0.05, 0.25);
        const fx = Math.cos(face), fz = Math.sin(face);
        const lx = Math.cos(face + Math.PI / 2) * lean, lz = Math.sin(face + Math.PI / 2) * lean;
        const base = pos.length / 3;
        const segs = 3;
        for (let k = 0; k <= segs; k++) {
            const t = k / segs;
            const ww = w * (1 - t * 0.85);
            const cx = bx + lx * t * t, cz = bz + lz * t * t, cy = h * t;
            pos.push(cx - fx * ww, cy, cz - fz * ww, cx + fx * ww, cy, cz + fz * ww);
            const sh = 0.35 + t * 0.65;
            col.push(sh, sh, sh, sh, sh, sh);
            nrm.push(0, 1, 0, 0, 1, 0);
            if (k > 0) {
                const o = base + (k - 1) * 2;
                idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
            }
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
}

function buildGrass(world) {
    const { island, quality } = world;
    if (!quality.grassDensity) return;
    const geo = bladeClump(quality.bladesPerClump, 5);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    const fade = quality.grassFade;
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, windUniforms);
        sh.uniforms.uFade = { value: fade };
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uWindTime, uWind, uFade;')
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vec4 wo = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                float dcam = distance(wo.xz, cameraPosition.xz);
                float shrink = 1.0 - smoothstep(uFade * 0.65, uFade, dcam);
                float hk = position.y * position.y * 3.0;
                float ph = wo.x * 0.35 + wo.z * 0.27;
                float sway = sin(uWindTime * 1.8 + ph) * 0.55 + sin(uWindTime * 3.7 + ph * 2.3) * 0.2 + sin(uWindTime * 0.6 + ph * 0.25) * 0.45;
                transformed.x += sway * hk * 0.18 * uWind;
                transformed.z += cos(uWindTime * 1.4 + ph) * hk * 0.08 * uWind;
                transformed *= shrink;`
            );
        // blades are lit as if they point straight up, from either side
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    };
    mat.customProgramCacheKey = () => 'grass';

    const C = 16;
    const half = island.half;
    const r = rng('grass');
    const col = new THREE.Color();
    const tipA = new THREE.Color('#4f8a2a'), tipB = new THREE.Color('#86a83c'), tipC = new THREE.Color('#3a7030');
    world.grassChunks = [];
    for (let cx = -half; cx < half; cx += C) {
        for (let cz = -half; cz < half; cz += C) {
            if (island.shoreAt(cx + C / 2, cz + C / 2) > C) continue;
            const list = [];
            const n = Math.round(C * C * quality.grassDensity);
            for (let i = 0; i < n; i++) {
                const x = cx + r() * C, z = cz + r() * C;
                const h = island.heightAt(x, z);
                if (h < 1.0 || island.shoreAt(x, z) > -2) continue;
                if (island.pathDistAt(x, z) < PATH_HALF + 0.25) continue;
                if (Math.hypot(x, z) < PLAZA_R + 0.7) continue;
                if (world.inPlaza(x, z)) continue;
                const nrm = island.normalAt(x, z);
                if (nrm.y < 0.82) continue;
                const meadow = fbm2(x * 0.06, z * 0.06, 2);
                if (meadow < -0.35 && r() < 0.7) continue;
                list.push({ x, z, y: h - 0.03, s: r.range(0.7, 1.25) * (1 + Math.max(meadow, 0) * 0.5), rot: r() * TAU, m: meadow });
            }
            if (!list.length) continue;
            for (const t of list) t.c = col.copy(tipA).lerp(tipB, clamp(t.m * 0.8 + 0.4, 0, 1)).lerp(tipC, r() * 0.4).getHex();
            const [im] = instanced(world, geo, mat, list, { cast: false, chunk: Infinity });
            im.receiveShadow = true;
            im.frustumCulled = true;
            world.grassChunks.push({ mesh: im, x: cx + C / 2, z: cz + C / 2 });
        }
    }
    world.grassFade = fade;
}

// ---------------------------------------------------------------- flowers

function flowerGeo() {
    const parts = [];
    const stem = new THREE.CylinderGeometry(0.008, 0.012, 0.3, 3).translate(0, 0.15, 0);
    colorize(stem, (x, y, z, c) => c.set('#3d6b2a'));
    parts.push(stem);
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        const petal = new THREE.CircleGeometry(0.045, 4).scale(1, 0.55, 1).translate(0.045, 0, 0).rotateX(-Math.PI / 2 + 0.35).rotateY(a).translate(0, 0.31, 0);
        colorize(petal, (x, y, z, c) => c.setRGB(1, 1, 1));
        parts.push(petal);
    }
    const centre = new THREE.OctahedronGeometry(0.022, 0).translate(0, 0.32, 0);
    colorize(centre, (x, y, z, c) => c.setRGB(1.0, 0.75, 0.25));
    parts.push(centre);
    return merge(parts);
}

function buildFlowers(world) {
    const { island, quality } = world;
    const r = rng('flowers');
    const list = [];
    for (const bed of world.flowerBeds) {
        const n = Math.round(bed.n * quality.flowerScale);
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, d = Math.sqrt(lerp((bed.r0 / bed.r1) ** 2, 1, r())) * bed.r1;
            const x = bed.x + Math.cos(a) * d, z = bed.z + Math.sin(a) * d;
            if (!bed.y && island.pathDistAt(x, z) < PATH_HALF + 0.2) continue;
            const y = bed.y ? bed.y + (bed.mound ? (1 - d / bed.r1) * 0.12 : 0) - 0.08 : island.heightAt(x, z) - 0.02;
            list.push({ x, z, y, s: r.range(0.8, 1.5), rot: r() * TAU, c: r.pick(bed.colors), tilt: r.range(-0.15, 0.15) });
        }
    }
    // wildflowers across the meadows
    const H = island.half - 10;
    const wild = ['#ffffff', '#ffe066', '#c9a7ff', '#ff9ec4', '#8ec5ff'];
    for (let i = 0; i < quality.wildflowers; i++) {
        const x = r.range(-H, H), z = r.range(-H, H);
        if (island.shoreAt(x, z) > -3 || island.heightAt(x, z) < 1.2) continue;
        if (island.pathDistAt(x, z) < PATH_HALF + 0.4 || Math.hypot(x, z) < PLAZA_R + 1 || world.inPlaza(x, z)) continue;
        if (fbm2(x * 0.08 + 9, z * 0.08, 2) < 0.1) continue;
        list.push({ x, z, y: island.heightAt(x, z) - 0.02, s: r.range(0.7, 1.2), rot: r() * TAU, c: r.pick(wild) });
    }
    const mat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x000000 }), { amount: 0.06, height: 0.35, key: 'flower' });
    instanced(world, flowerGeo(), mat, list, { cast: false, chunk: 24 });
}

// ---------------------------------------------------------------- entry

export function buildVegetation(world) {
    const { mats, layout, island, quality } = world;
    const trees = scatterTrees(world);
    const lt = leafTex();
    const foliage = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: lt.map, normalMap: lt.normalMap, roughness: 0.9 }), { amount: 0.22, height: 10, key: 'pine' });
    const crown = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: lt.map, normalMap: lt.normalMap, roughness: 0.85 }), { amount: 0.18, height: 7, key: 'crown' });
    const kinds = { pine: [], broad: [], blossom: [] };
    for (const t of trees) {
        kinds[t.kind].push(t);
        world.colliders.push({ x: t.x, z: t.z, r: t.kind === 'pine' ? 0.4 : 0.5 });
    }
    for (let v = 0; v < 3; v++) {
        instanced(world, pineGeo(100 + v).geo, foliage, kinds.pine.filter((t) => t.v === v));
        instanced(world, broadleafGeo(200 + v, false).geo, crown, kinds.broad.filter((t) => t.v === v));
        instanced(world, broadleafGeo(300 + v, true).geo, crown, kinds.blossom.filter((t) => t.v === v));
    }
    world.trees = trees;

    // cypresses by the statue niches, trimmed if they'd sit on a path
    const cyp = world.cypress.filter((c) => island.pathDistAt(c.x, c.z) > PATH_HALF + 0.8);
    const cg = cypressGeo(9).geo;
    const cm = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: lt.map, normalMap: lt.normalMap, roughness: 0.9 }), { amount: 0.1, height: 5, key: 'cyp' });
    instanced(world, cg, cm, cyp.map((c, i) => ({ ...c, s: c.h / 5.25, sx: 0.85, sz: 0.85, rot: i })));
    for (const c of cyp) world.colliders.push({ x: c.x, z: c.z, r: 0.45 });

    buildHedges(world);

    // boulders: tumbled along the shore and outcropping on the hills
    const r = rng('rocks');
    const rocks = [];
    const H = island.half - 8;
    for (let i = 0; i < quality.rockTries; i++) {
        const x = r.range(-H, H), z = r.range(-H, H);
        const sd = island.shoreAt(x, z);
        const shore = sd > -7 && sd < 3;
        const hill = sd < -10 && island.flatAt(x, z) < 0.1 && fbm2(x * 0.05, z * 0.05) > 0.25;
        if (!shore && !(hill && r() < 0.35)) continue;
        if (!clearOf(world, x, z, -2)) continue;
        const s = shore ? r.range(0.7, 2.6) : r.range(0.5, 1.5);
        rocks.push({ x, z, y: island.heightAt(x, z) - s * 0.3, sx: s, sy: s * r.range(0.7, 1.2), sz: s, rot: r() * TAU, tilt: r.range(-0.3, 0.3), v: i % 3 });
        if (!shore || island.heightAt(x, z) > 0.5) world.colliders.push({ x, z, r: s * 0.9 });
    }
    for (let v = 0; v < 3; v++) instanced(world, rockGeo(500 + v), mats.granite, rocks.filter((k) => k.v === v));

    for (const f of layout.features) if (f.type === 'tree') buildGreatTree(world, f);
    buildGrass(world);
    buildFlowers(world);
}

/** Show grass chunks only near the camera. */
export function updateGrass(world, cam) {
    if (!world.grassChunks) return;
    const lim = world.grassFade + 12;
    for (const c of world.grassChunks) c.mesh.visible = Math.hypot(c.x - cam.x, c.z - cam.z) < lim;
}
