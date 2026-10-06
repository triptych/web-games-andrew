// ships.js — the procedural fleet. Every chess piece is modelled in code:
//   Pawn   → Dinghy        a rowboat with a stubby sail and oars
//   Knight → Longship      striped square sail, shields, a seahorse figurehead
//   Bishop → Schooner      tall triangular sails set at an angle, swallowtail pennant
//   Rook   → Lighthouse    striped tower on a rocky islet, glowing lantern, sweeping beam
//   Queen  → Man-o'-War    three masts, two gun decks, a coronet at the main top
//   King   → Flagship      the biggest hull, stern castle, three tiers of sail, a crown
// Parts are merged per material, cached per (type, colour), and shared by all
// instances, so a full board is a few hundred draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, TEX, teamOf, NO_OUTLINE } from './toon.js';
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from '../sim/chess.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** Transform a geometry in place: { x, y, z, rx, ry, rz, sx, sy, sz, s }. */
export function place(geo, t = {}) {
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    _q.setFromEuler(_e);
    const s = t.s ?? 1;
    _s.set((t.sx ?? 1) * s, (t.sy ?? 1) * s, (t.sz ?? 1) * s);
    _v.set(t.x || 0, t.y || 0, t.z || 0);
    _m.compose(_v, _q, _s);
    geo.applyMatrix4(_m);
    return geo;
}

/** A cylinder from a to b (Vector3s). */
export function rod(a, b, r0, r1 = r0, seg = 6) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
    g.translate(0, len / 2, 0);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(a.x, a.y, a.z);
    return g;
}

/** Make sure a triangle soup's first face points along `want`; flip all faces if not. */
function orient(index, pos, want, sample = 0) {
    const i0 = index[sample * 3], i1 = index[sample * 3 + 1], i2 = index[sample * 3 + 2];
    const a = new THREE.Vector3().fromArray(pos, i0 * 3), b = new THREE.Vector3().fromArray(pos, i1 * 3), c = new THREE.Vector3().fromArray(pos, i2 * 3);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(want) < 0) for (let i = 0; i < index.length; i += 3) { const t = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = t; }
}

function geoFrom(pos, uv, index) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
}

/**
 * Parametric hull, bow towards -z, waterline at y = 0.
 * Returns { hull, deck, transom, deckY(u), halfW(u), zAt(u) }.
 */
export function makeHull({ L, B, H, D = H * 0.43, transom = 0.62, sheer = 0.05, bowRise = 0.05, sternRise = 0.03, segL = 36, segV = 12 }) {
    const width = (u) => {
        if (u < 0.3) { const k = (0.3 - u) / 0.3; return 1 - (1 - transom) * k * k; }
        const t = (u - 0.3) / 0.7;
        return Math.pow(Math.max(0, Math.cos(t * Math.PI / 2)), 0.72);
    };
    const top = (u) => H + sheer * Math.pow(2 * u - 1, 2) * H + bowRise * Math.pow(Math.max(0, u - 0.7) / 0.3, 2) + sternRise * Math.pow(Math.max(0, 0.25 - u) / 0.25, 2);
    const bot = (u) => -D * (1 - 0.75 * Math.pow(Math.max(0, u - 0.72) / 0.28, 2)) * (1 - 0.25 * Math.pow(Math.max(0, 0.2 - u) / 0.2, 2));
    const lat = (v) => Math.pow(Math.sin(Math.min(1, v) * Math.PI / 2), 0.55);
    const zAt = (u) => L / 2 - u * L;
    const halfW = (u) => (B / 2) * width(u);

    const pos = [], uv = [], cols = segV + 1;
    const sides = [];
    for (const side of [1, -1]) {
        const base = pos.length / 3;
        for (let i = 0; i <= segL; i++) {
            const u = i / segL, z = zAt(u), hw = halfW(u), yt = top(u), yb = bot(u);
            for (let j = 0; j <= segV; j++) {
                const v = j / segV;
                pos.push(side * hw * lat(v), yb + (yt - yb) * v, z);
                uv.push(side > 0 ? u : 1 - u, v);
            }
        }
        const idx = [];
        for (let i = 0; i < segL; i++) {
            for (let j = 0; j < segV; j++) {
                const a = base + i * cols + j, b = a + cols, c = b + 1, d = a + 1;
                idx.push(a, b, d, b, c, d);
            }
        }
        // Sample a face mid-hull, mid-height, so the collapsed bow can't fool the test.
        const sample = ((segL >> 1) * segV + (segV >> 1)) * 2;
        orient(idx, pos, new THREE.Vector3(side, 0, 0), sample);
        sides.push(...idx);
    }
    const hull = geoFrom(pos, uv, sides);

    // Transom: a fan closing the stern.
    const tp = [0, (top(0) + bot(0)) / 2, L / 2], tuv = [0.005, 0.5];
    for (let j = 0; j <= segV; j++) { const v = j / segV; tp.push(halfW(0) * lat(v), bot(0) + (top(0) - bot(0)) * v, L / 2); tuv.push(0.005, v); }
    for (let j = segV; j >= 0; j--) { const v = j / segV; tp.push(-halfW(0) * lat(v), bot(0) + (top(0) - bot(0)) * v, L / 2); tuv.push(0.005, v); }
    const tIdx = [];
    const n = tp.length / 3 - 1;
    for (let k = 1; k < n; k++) tIdx.push(0, k, k + 1);
    orient(tIdx, tp, new THREE.Vector3(0, 0, 1), Math.floor(tIdx.length / 6));
    const transomGeo = geoFrom(tp, tuv, tIdx);

    // Deck: a strip following the sheer, a little below the rail.
    const deckDrop = H * 0.22;
    const deckY = (u) => top(u) - deckDrop;
    const dp = [], duv = [], didx = [];
    for (let i = 0; i <= segL; i++) {
        const u = i / segL, yb = bot(u), yt = top(u), y = deckY(u);
        const w = halfW(u) * lat((y - yb) / (yt - yb)) * 0.98;
        dp.push(-w, y, zAt(u), w, y, zAt(u));
        duv.push(0, u * L * 2.4, 1, u * L * 2.4);
        if (i < segL) { const a = i * 2; didx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    orient(didx, dp, new THREE.Vector3(0, 1, 0), segL >> 1);
    const deck = geoFrom(dp, duv, didx);
    return { hull, deck, transom: transomGeo, deckY, halfW, zAt, top };
}

/** Billowed rectangular sail in the XY plane, centred, bulging towards -z. */
function squareSail(w, h, bulge = 0.05, topW = w) {
    const g = new THREE.PlaneGeometry(1, 1, 10, 10);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        const ww = topW + (w - topW) * (0.5 - y);
        p.setXYZ(i, x * ww, y * h, -bulge * Math.sin((x + 0.5) * Math.PI) * Math.sin((y + 0.5) * Math.PI) - bulge * 0.4 * (0.5 - y));
    }
    g.computeVertexNormals();
    return g;
}

/** Triangle sail through three points (local), billowed along `bulgeDir`. */
function triSail(a, b, c, bulge, bulgeDir) {
    const seg = 10, pos = [], uv = [], idx = [];
    const rowStart = [];
    for (let i = 0; i <= seg; i++) {
        rowStart.push(pos.length / 3);
        const t = i / seg;
        const L = new THREE.Vector3().lerpVectors(a, c, t), R = new THREE.Vector3().lerpVectors(b, c, t);
        const cnt = seg - i;
        for (let j = 0; j <= cnt; j++) {
            const s = cnt ? j / cnt : 0.5;
            const p = new THREE.Vector3().lerpVectors(L, R, s);
            const k = Math.sin(Math.PI * (cnt ? s : 0.5)) * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.6);
            p.addScaledVector(bulgeDir, bulge * k);
            pos.push(p.x, p.y, p.z);
            uv.push(s * (1 - t) + t * 0.5, t);
        }
    }
    for (let i = 0; i < seg; i++) {
        const cnt = seg - i;
        for (let j = 0; j < cnt; j++) {
            const a0 = rowStart[i] + j, a1 = a0 + 1, b0 = rowStart[i + 1] + j;
            idx.push(a0, a1, b0);
            if (j < cnt - 1) idx.push(a1, b0 + 1, b0);
        }
    }
    return geoFrom(pos, uv, idx);
}

function crownGeo(r, points, withCross) {
    const parts = [];
    const band = new THREE.CylinderGeometry(r, r * 0.9, r * 0.55, 20, 1, true);
    parts.push(band);
    parts.push(place(new THREE.TorusGeometry(r * 0.95, r * 0.12, 6, 20), { rx: Math.PI / 2, y: -r * 0.27 }));
    for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2;
        parts.push(place(new THREE.ConeGeometry(r * 0.2, r * 0.75, 6), { x: Math.cos(a) * r * 0.92, z: Math.sin(a) * r * 0.92, y: r * 0.6 }));
        parts.push(place(new THREE.SphereGeometry(r * 0.13, 8, 6), { x: Math.cos(a) * r * 0.92, z: Math.sin(a) * r * 0.92, y: r * 1.0 }));
    }
    if (withCross) {
        parts.push(place(new THREE.SphereGeometry(r * 0.32, 12, 10), { y: r * 0.55 }));
        parts.push(place(new THREE.BoxGeometry(r * 0.14, r * 0.7, r * 0.14), { y: r * 1.15 }));
        parts.push(place(new THREE.BoxGeometry(r * 0.45, r * 0.14, r * 0.14), { y: r * 1.25 }));
    } else {
        parts.push(place(new THREE.SphereGeometry(r * 0.38, 12, 10), { y: r * 0.45 }));
    }
    return parts;
}

// ------------------------------------------------------------------- flags
// Flags share one geometry per shape; animateFlags() ripples them every frame.
const flagGeos = [];
function flagGeometry(w, h, swallow = false) {
    const g = new THREE.PlaneGeometry(w, h, 12, 4);
    g.translate(w / 2, 0, 0);
    const p = g.attributes.position;
    if (swallow) {
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) / w, y = p.getY(i) / h;
            if (x > 0.6) p.setX(i, p.getX(i) - Math.max(0, (x - 0.6)) * w * (1 - Math.abs(y) * 2) * 0.9);
        }
    }
    g.userData.base = Float32Array.from(p.array);
    g.userData.w = w;
    flagGeos.push(g);
    return g;
}
export function animateFlags(t) {
    for (const g of flagGeos) {
        const p = g.attributes.position, base = g.userData.base, w = g.userData.w;
        for (let i = 0; i < p.count; i++) {
            const x = base[i * 3] / w;
            p.setZ(i, Math.sin(x * 7 - t * 7) * 0.22 * w * x + Math.sin(x * 3 - t * 3.1) * 0.08 * w * x);
            p.setY(i, base[i * 3 + 1] + Math.sin(x * 5 - t * 5) * 0.04 * w * x);
        }
        p.needsUpdate = true;
        g.computeVertexNormals();
    }
}
let FLAG_STD, FLAG_PENNANT, FLAG_SWALLOW;
function flags() {
    if (!FLAG_STD) {
        FLAG_STD = flagGeometry(0.16, 0.1);
        FLAG_PENNANT = flagGeometry(0.2, 0.05, true);
        FLAG_SWALLOW = flagGeometry(0.26, 0.07, true);
    }
}

// ------------------------------------------------------------------- builders
// Each builder returns { parts: [{ g, mat }], flags: [{ geo, mat, x, y, z, ry }], extras, size }

const WOOD = () => toon(0x9a6436);
const MAST = () => toon(0xb07a44);
const ROPE = () => toon(0x5b4630, { outline: NO_OUTLINE });
const DARK = () => toon(0x26212a);
const GOLD = () => toon(0xf3c44f, { emissive: 0x3a2600 });
const GLASS = () => toon(0xfff2b0, { emissive: 0xffd760, emissiveIntensity: 0.9, outline: { thickness: 0.003, color: [0.25, 0.18, 0.05] } });

function hullParts(color, spec, guns = 0) {
    const h = makeHull(spec);
    const hullMat = toon(0xffffff, { map: TEX.hull(color, guns), side: THREE.DoubleSide });
    return {
        h,
        parts: [
            { g: h.hull, mat: hullMat },
            { g: h.transom, mat: toon(teamOf(color).band) },
            { g: h.deck, mat: toon(0xffffff, { map: TEX.deckPlanks() }) },
        ],
    };
}

function mastWithSails(parts, color, { z, deckY, height, tiers, sailKind = 'plain', emblemTier = -1, width = 0.3, lean = 0 }) {
    const base = new THREE.Vector3(0, deckY, z), tip = new THREE.Vector3(0, deckY + height, z + lean);
    parts.push({ g: rod(base, tip, 0.016, 0.009, 8), mat: MAST() });
    let y = deckY + height * 0.3;
    const span = height * 0.66;
    tiers.forEach((frac, i) => {
        const th = span * frac;
        const w = width * (1 - i * 0.18);
        const yTop = y + th;
        const zz = z + lean * ((yTop - deckY) / height);
        parts.push({ g: rod(new THREE.Vector3(-w * 0.6, yTop, zz), new THREE.Vector3(w * 0.6, yTop, zz), 0.007, 0.007, 5), mat: MAST() });
        const kind = i === emblemTier ? 'emblem' : sailKind;
        const sail = place(squareSail(w, th * 0.96, 0.045 * (w / 0.3), w * 0.86), { y: y + th / 2, z: zz - 0.012 });
        parts.push({ g: sail, mat: toon(0xffffff, { map: TEX.sail(color, kind), side: THREE.DoubleSide, soft: true }) });
        y = yTop + 0.012;
    });
    // crow's nest
    parts.push({ g: place(new THREE.CylinderGeometry(0.035, 0.028, 0.03, 10), { x: 0, y: deckY + height * 0.82, z: z + lean * 0.82 }), mat: WOOD() });
    return tip;
}

function stays(parts, tip, bowPt, sternPt) {
    parts.push({ g: rod(tip, bowPt, 0.0035, 0.0035, 4), mat: ROPE() });
    parts.push({ g: rod(tip, sternPt, 0.0035, 0.0035, 4), mat: ROPE() });
}

function buildDinghy(color) {
    const spec = { L: 0.5, B: 0.25, H: 0.075, transom: 0.72, sheer: 0.35, bowRise: 0.03, segL: 28 };
    const { h, parts } = hullParts(color, spec);
    const dy = h.deckY(0.5);
    // thwarts
    for (const u of [0.32, 0.6]) parts.push({ g: place(new THREE.BoxGeometry(h.halfW(u) * 1.85, 0.014, 0.05), { y: dy + 0.03, z: h.zAt(u) }), mat: WOOD() });
    // oars resting across the gunwales
    for (const s of [1, -1]) {
        const a = new THREE.Vector3(s * 0.05, dy + 0.045, 0.05), b = new THREE.Vector3(s * 0.25, dy - 0.01, -0.06);
        parts.push({ g: rod(a, b, 0.006, 0.006, 5), mat: MAST() });
        parts.push({ g: place(new THREE.BoxGeometry(0.012, 0.004, 0.06), { x: s * 0.255, y: dy - 0.012, z: -0.075, ry: s * 0.4 }), mat: MAST() });
    }
    const tip = mastWithSails(parts, color, { z: h.zAt(0.62), deckY: dy, height: 0.3, tiers: [0.72], sailKind: 'emblem', width: 0.2 });
    // a lantern at the stern
    const lz = h.zAt(0.06);
    parts.push({ g: rod(new THREE.Vector3(0, dy, lz), new THREE.Vector3(0, dy + 0.09, lz), 0.005), mat: WOOD() });
    parts.push({ g: place(new THREE.BoxGeometry(0.028, 0.034, 0.028), { y: dy + 0.1, z: lz }), mat: GLASS() });
    flags();
    return { parts, flags: [{ geo: FLAG_PENNANT, color, x: 0, y: tip.y - 0.02, z: tip.z, scale: 0.7 }], size: { L: 0.5, B: 0.25, top: tip.y } };
}

function buildLongship(color) {
    const spec = { L: 0.8, B: 0.26, H: 0.07, transom: 0.0, sheer: 0.9, bowRise: 0.04, sternRise: 0.06, segL: 40 };
    const { h, parts } = hullParts(color, spec);
    const dy = h.deckY(0.5);
    const gold = GOLD();
    // Seahorse figurehead: a curling neck, a long-snouted head, ears and a finned crest.
    const prowZ = h.zAt(1);
    const neck = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, h.top(0.96), prowZ + 0.05),
        new THREE.Vector3(0, 0.2, prowZ - 0.01),
        new THREE.Vector3(0, 0.3, prowZ - 0.02),
        new THREE.Vector3(0, 0.37, prowZ + 0.03),
    ]);
    parts.push({ g: new THREE.TubeGeometry(neck, 16, 0.026, 8), mat: gold });
    const head = new THREE.Vector3(0, 0.39, prowZ + 0.035);
    parts.push({ g: place(new THREE.SphereGeometry(0.045, 14, 10), { x: head.x, y: head.y, z: head.z, sx: 0.8, sy: 0.9, sz: 1.1 }), mat: gold });
    parts.push({ g: rod(head.clone().add(new THREE.Vector3(0, -0.005, -0.02)), head.clone().add(new THREE.Vector3(0, -0.035, -0.095)), 0.022, 0.014, 8), mat: gold });
    for (const s of [1, -1]) {
        parts.push({ g: place(new THREE.ConeGeometry(0.012, 0.04, 5), { x: s * 0.02, y: head.y + 0.045, z: head.z + 0.012, rx: 0.4 }), mat: gold });
        parts.push({ g: place(new THREE.SphereGeometry(0.009, 8, 6), { x: s * 0.033, y: head.y + 0.008, z: head.z - 0.02 }), mat: DARK() });
    }
    for (let i = 0; i < 4; i++) {
        const p = neck.getPoint(0.3 + i * 0.18);
        parts.push({ g: place(new THREE.ConeGeometry(0.016, 0.045, 4), { x: 0, y: p.y, z: p.z + 0.03, rx: Math.PI / 2 + 0.3, sz: 0.4 }), mat: toon(teamOf(color).band) });
    }
    // curling tail at the stern
    const sternZ = h.zAt(0);
    const tail = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, h.top(0.03), sternZ - 0.04),
        new THREE.Vector3(0, 0.2, sternZ + 0.0),
        new THREE.Vector3(0, 0.26, sternZ - 0.04),
        new THREE.Vector3(0, 0.23, sternZ - 0.07),
    ]);
    parts.push({ g: new THREE.TubeGeometry(tail, 12, 0.018, 6), mat: gold });
    // shields along the rail
    const shieldMat = toon(0xffffff, { map: TEX.shield(color) });
    for (const s of [1, -1]) {
        for (let i = 0; i < 4; i++) {
            const u = 0.28 + i * 0.13;
            const disc = new THREE.CylinderGeometry(0.036, 0.036, 0.008, 16);
            parts.push({ g: place(disc, { x: s * (h.halfW(u) + 0.004), y: h.top(u) - 0.012, z: h.zAt(u), rz: Math.PI / 2, rx: Math.PI / 2 }), mat: shieldMat });
        }
    }
    const tip = mastWithSails(parts, color, { z: h.zAt(0.52), deckY: dy, height: 0.5, tiers: [0.82], sailKind: 'stripes', width: 0.36 });
    stays(parts, tip, new THREE.Vector3(0, h.top(0.95), h.zAt(0.95)), new THREE.Vector3(0, h.top(0.05), h.zAt(0.05)));
    flags();
    return { parts, flags: [{ geo: FLAG_PENNANT, color, x: 0, y: tip.y - 0.01, z: tip.z }], size: { L: 0.8, B: 0.26, top: tip.y } };
}

function buildSchooner(color) {
    const spec = { L: 0.72, B: 0.24, H: 0.095, transom: 0.55, sheer: 0.4, bowRise: 0.02 };
    const { h, parts } = hullParts(color, spec);
    const dy = h.deckY(0.5);
    const sailMat = (kind) => toon(0xffffff, { map: TEX.sail(color, kind), side: THREE.DoubleSide, soft: true });
    const angle = 0.55; // sails set on a reach so they face the camera, not edge-on
    const rot = (p, pivot) => p.clone().sub(pivot).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(pivot);
    const masts = [{ u: 0.66, h: 0.6, big: false }, { u: 0.36, h: 0.78, big: true }];
    let mainTip = null;
    for (const m of masts) {
        const z = h.zAt(m.u);
        const base = new THREE.Vector3(0, dy, z), tip = new THREE.Vector3(0, dy + m.h, z + 0.03);
        parts.push({ g: rod(base, tip, 0.015, 0.008, 8), mat: MAST() });
        // A tall triangle: luff up the mast, foot along a boom.
        const footLen = m.big ? 0.36 : 0.26;
        const a = new THREE.Vector3(0, dy + 0.06, z + 0.01), b = new THREE.Vector3(0, dy + 0.06, z + footLen), c = new THREE.Vector3(0, tip.y - 0.03, z + 0.03);
        const pivot = new THREE.Vector3(0, 0, z);
        const ra = rot(a, pivot), rb = rot(b, pivot), rc = rot(c, pivot);
        const bulgeDir = new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        parts.push({ g: triSail(ra, rb, rc, 0.05, bulgeDir), mat: sailMat(m.big ? 'emblem' : 'plain') });
        parts.push({ g: rod(ra, rb, 0.006, 0.006, 5), mat: MAST() });
        if (m.big) mainTip = tip;
    }
    // jib from the bowsprit
    const bowTop = new THREE.Vector3(0, h.top(1), h.zAt(1));
    const sprit = new THREE.Vector3(0, bowTop.y + 0.05, bowTop.z - 0.12);
    parts.push({ g: rod(bowTop.clone().add(new THREE.Vector3(0, -0.01, 0.05)), sprit, 0.008, 0.005, 6), mat: MAST() });
    const foreTip = new THREE.Vector3(0, dy + 0.58, h.zAt(0.66) + 0.03);
    parts.push({ g: triSail(sprit, new THREE.Vector3(0.03, dy + 0.06, h.zAt(0.8)), foreTip.clone().add(new THREE.Vector3(0, -0.05, 0)), 0.04, new THREE.Vector3(-0.6, 0, -0.3).normalize()), mat: sailMat('plain') });
    parts.push({ g: rod(sprit, foreTip, 0.0035), mat: ROPE() });
    parts.push({ g: rod(mainTip, new THREE.Vector3(0, h.top(0.02), h.zAt(0.02)), 0.0035), mat: ROPE() });
    flags();
    return { parts, flags: [{ geo: FLAG_SWALLOW, color, x: 0, y: mainTip.y - 0.01, z: mainTip.z }], size: { L: 0.72, B: 0.24, top: mainTip.y } };
}

function buildLighthouse(color) {
    const t = teamOf(color);
    const parts = [];
    // Rocky islet
    const rock = new THREE.IcosahedronGeometry(0.34, 2);
    const p = rock.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 1 + 0.12 * Math.sin(x * 19 + z * 7) * Math.cos(y * 13 + x * 5) + 0.06 * Math.sin(z * 31);
        p.setXYZ(i, x * n, Math.max(-0.1, y * 0.42 * n), z * n);
    }
    rock.computeVertexNormals();
    parts.push({ g: place(rock, { y: 0.0 }), mat: toon(0xffffff, { map: TEX.rock() }) });
    // Plinth
    parts.push({ g: place(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 20), { y: 0.155 }), mat: toon(0xb9b4aa) });
    // Tower (lathe)
    const prof = [];
    const H0 = 0.19, H1 = 0.78;
    for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        prof.push(new THREE.Vector2(0.15 - 0.055 * k + 0.012 * Math.sin(k * Math.PI), H0 + (H1 - H0) * k));
    }
    const tower = new THREE.LatheGeometry(prof, 28);
    parts.push({ g: tower, mat: toon(0xffffff, { map: TEX.tower(color) }) });
    // Door
    parts.push({ g: place(new THREE.BoxGeometry(0.05, 0.08, 0.02), { y: H0 + 0.04, z: -0.145 }), mat: toon(0x5c3b22) });
    // Gallery + railing
    parts.push({ g: place(new THREE.CylinderGeometry(0.135, 0.11, 0.03, 24), { y: H1 + 0.015 }), mat: toon(t.stripe) });
    parts.push({ g: place(new THREE.TorusGeometry(0.128, 0.006, 6, 28), { rx: Math.PI / 2, y: H1 + 0.08 }), mat: DARK() });
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        parts.push({ g: place(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4), { x: Math.cos(a) * 0.128, z: Math.sin(a) * 0.128, y: H1 + 0.055 }), mat: DARK() });
    }
    // Lantern room
    parts.push({ g: place(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12), { y: H1 + 0.08 }), mat: GLASS() });
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push({ g: place(new THREE.BoxGeometry(0.008, 0.1, 0.008), { x: Math.cos(a) * 0.077, z: Math.sin(a) * 0.077, y: H1 + 0.08 }), mat: DARK() });
    }
    parts.push({ g: place(new THREE.SphereGeometry(0.088, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: H1 + 0.13 }), mat: toon(t.stripe) });
    parts.push({ g: place(new THREE.SphereGeometry(0.018, 10, 8), { y: H1 + 0.225 }), mat: GOLD() });
    parts.push({ g: place(new THREE.ConeGeometry(0.006, 0.05, 5), { y: H1 + 0.26 }), mat: GOLD() });
    return { parts, flags: [], beamY: H1 + 0.08, size: { L: 0.62, B: 0.62, top: H1 + 0.29 }, building: true };
}

function buildManOWar(color) {
    const spec = { L: 0.82, B: 0.32, H: 0.16, transom: 0.66, sheer: 0.3, bowRise: 0.03, sternRise: 0.05 };
    const { h, parts } = hullParts(color, spec, 2);
    const dy = h.deckY(0.5);
    const fore = mastWithSails(parts, color, { z: h.zAt(0.74), deckY: h.deckY(0.74), height: 0.74, tiers: [0.5, 0.36], width: 0.3 });
    const main = mastWithSails(parts, color, { z: h.zAt(0.47), deckY: dy, height: 0.92, tiers: [0.48, 0.34, 0.2], emblemTier: 0, width: 0.36 });
    const mizzen = mastWithSails(parts, color, { z: h.zAt(0.18), deckY: h.deckY(0.18), height: 0.64, tiers: [0.5, 0.3], width: 0.26 });
    // Coronet at the main top: the queen's mark.
    for (const g of crownGeo(0.045, 8, false)) parts.push({ g: place(g, { x: main.x, y: main.y + 0.03, z: main.z }), mat: GOLD() });
    // Bowsprit + jib
    const bow = new THREE.Vector3(0, h.top(1), h.zAt(1));
    const sprit = new THREE.Vector3(0, bow.y + 0.07, bow.z - 0.17);
    parts.push({ g: rod(bow.clone().add(new THREE.Vector3(0, -0.02, 0.08)), sprit, 0.012, 0.006, 6), mat: MAST() });
    parts.push({ g: triSail(sprit, new THREE.Vector3(0, h.top(0.93) + 0.02, h.zAt(0.93)), fore.clone().add(new THREE.Vector3(0, -0.12, 0)), 0.04, new THREE.Vector3(-1, 0, 0)), mat: toon(0xffffff, { map: TEX.sail(color, 'plain'), side: THREE.DoubleSide, soft: true }) });
    stays(parts, main, sprit, new THREE.Vector3(0, h.top(0), h.zAt(0)));
    parts.push({ g: rod(fore, sprit, 0.0035), mat: ROPE() });
    // Cannon muzzles out of the gunports
    for (const s of [1, -1]) {
        for (let i = 0; i < 4; i++) {
            const u = 0.3 + i * 0.13;
            const y = h.top(u) - spec.H * 0.32;
            parts.push({ g: rod(new THREE.Vector3(s * (h.halfW(u) - 0.01), y, h.zAt(u)), new THREE.Vector3(s * (h.halfW(u) + 0.03), y, h.zAt(u)), 0.011, 0.011, 8), mat: DARK() });
        }
    }
    // Stern lanterns
    parts.push({ g: place(new THREE.SphereGeometry(0.02, 10, 8), { y: h.top(0) + 0.03, z: h.zAt(0) - 0.01 }), mat: GLASS() });
    flags();
    return { parts, flags: [{ geo: FLAG_STD, color, x: 0, y: mizzen.y - 0.02, z: mizzen.z }], size: { L: 0.82, B: 0.32, top: main.y + 0.12 } };
}

function buildFlagship(color) {
    const spec = { L: 0.88, B: 0.36, H: 0.17, transom: 0.7, sheer: 0.25, bowRise: 0.03, sternRise: 0.09 };
    const { h, parts } = hullParts(color, spec, 1);
    const dy = h.deckY(0.5);
    const t = teamOf(color);
    // Stern castle with gilded windows
    const cz = h.zAt(0.1), cw = h.halfW(0.1) * 1.8, cy = h.deckY(0.1);
    parts.push({ g: place(new THREE.BoxGeometry(cw, 0.11, 0.2), { y: cy + 0.055, z: cz + 0.02 }), mat: toon(t.band) });
    parts.push({ g: place(new THREE.BoxGeometry(cw * 1.08, 0.018, 0.22), { y: cy + 0.115, z: cz + 0.02 }), mat: GOLD() });
    for (let i = -1; i <= 1; i++) {
        parts.push({ g: place(new THREE.BoxGeometry(0.04, 0.045, 0.006), { x: i * cw * 0.3, y: cy + 0.06, z: cz + 0.123 }), mat: GLASS() });
    }
    for (const s of [1, -1]) parts.push({ g: place(new THREE.SphereGeometry(0.026, 10, 8), { x: s * cw * 0.45, y: cy + 0.15, z: cz + 0.1 }), mat: GLASS() });
    const fore = mastWithSails(parts, color, { z: h.zAt(0.76), deckY: h.deckY(0.76), height: 0.8, tiers: [0.48, 0.34, 0.2], width: 0.32 });
    const main = mastWithSails(parts, color, { z: h.zAt(0.5), deckY: dy, height: 1.0, tiers: [0.46, 0.34, 0.22], emblemTier: 0, width: 0.4 });
    const mizzen = mastWithSails(parts, color, { z: h.zAt(0.24), deckY: h.deckY(0.24), height: 0.7, tiers: [0.5, 0.3], width: 0.28 });
    // The crown: the king's mark.
    for (const g of crownGeo(0.07, 5, true)) parts.push({ g: place(g, { x: main.x, y: main.y + 0.045, z: main.z }), mat: GOLD() });
    const bow = new THREE.Vector3(0, h.top(1), h.zAt(1));
    const sprit = new THREE.Vector3(0, bow.y + 0.08, bow.z - 0.19);
    parts.push({ g: rod(bow.clone().add(new THREE.Vector3(0, -0.02, 0.08)), sprit, 0.013, 0.006, 6), mat: MAST() });
    parts.push({ g: triSail(sprit, new THREE.Vector3(0, h.top(0.93) + 0.02, h.zAt(0.93)), fore.clone().add(new THREE.Vector3(0, -0.14, 0)), 0.045, new THREE.Vector3(-1, 0, 0)), mat: toon(0xffffff, { map: TEX.sail(color, 'plain'), side: THREE.DoubleSide, soft: true }) });
    stays(parts, main, sprit, new THREE.Vector3(0, h.top(0) + 0.1, h.zAt(0)));
    parts.push({ g: rod(fore, sprit, 0.0035), mat: ROPE() });
    parts.push({ g: rod(mizzen, new THREE.Vector3(0, h.top(0) + 0.1, h.zAt(0)), 0.0035), mat: ROPE() });
    for (const s of [1, -1]) {
        for (let i = 0; i < 5; i++) {
            const u = 0.3 + i * 0.11;
            const y = h.top(u) - spec.H * 0.22;
            parts.push({ g: rod(new THREE.Vector3(s * (h.halfW(u) - 0.01), y, h.zAt(u)), new THREE.Vector3(s * (h.halfW(u) + 0.035), y, h.zAt(u)), 0.012, 0.012, 8), mat: DARK() });
        }
    }
    // Figurehead: a gilded ball and scroll at the bow
    parts.push({ g: place(new THREE.SphereGeometry(0.03, 12, 10), { y: bow.y - 0.02, z: bow.z + 0.005 }), mat: GOLD() });
    flags();
    return {
        parts,
        flags: [
            { geo: FLAG_STD, color, crown: true, x: 0, y: cy + 0.32, z: cz + 0.05, pole: true },
            { geo: FLAG_PENNANT, color, x: 0, y: fore.y - 0.01, z: fore.z },
        ],
        size: { L: 0.88, B: 0.36, top: main.y + 0.18 },
    };
}

const BUILDERS = { [PAWN]: buildDinghy, [KNIGHT]: buildLongship, [BISHOP]: buildSchooner, [ROOK]: buildLighthouse, [QUEEN]: buildManOWar, [KING]: buildFlagship };

const pieceCache = new Map();
function mergedPiece(type, color) {
    const key = `${type}:${color}`;
    if (pieceCache.has(key)) return pieceCache.get(key);
    const spec = BUILDERS[type](color);
    const byMat = new Map();
    for (const { g, mat } of spec.parts) {
        let geo = g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        if (!byMat.has(mat)) byMat.set(mat, []);
        byMat.get(mat).push(geo);
    }
    const meshes = [];
    for (const [mat, geos] of byMat) meshes.push({ geo: mergeGeometries(geos), mat });
    const out = { meshes, flags: spec.flags, size: spec.size, building: !!spec.building, beamY: spec.beamY };
    pieceCache.set(key, out);
    return out;
}

let beamMat = null;
function beamMaterial() {
    if (!beamMat) {
        beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        beamMat.userData.outlineParameters = NO_OUTLINE;
    }
    return beamMat;
}

/**
 * A new piece object: { root, body, beam, size, building }.
 * root is placed on the board; body bobs and rolls inside it.
 */
export function createPiece(piece) {
    const type = Math.abs(piece), color = Math.sign(piece);
    const def = mergedPiece(type, color);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    for (const { geo, mat } of def.meshes) body.add(new THREE.Mesh(geo, mat));
    for (const f of def.flags) {
        const mat = toon(0xffffff, { map: TEX.flag(color, !!f.crown), side: THREE.DoubleSide, soft: true, outline: { thickness: 0.003, color: [0.12, 0.1, 0.14] } });
        const flag = new THREE.Mesh(f.geo, mat);
        flag.position.set(f.x, f.y, f.z);
        flag.rotation.y = -Math.PI / 2;  // stream aft (towards +z) from the mast
        if (f.scale) flag.scale.setScalar(f.scale);
        body.add(flag);
        if (f.pole) {
            const pole = new THREE.Mesh(rod(new THREE.Vector3(f.x, f.y - 0.22, f.z), new THREE.Vector3(f.x, f.y + 0.06, f.z), 0.006), MAST());
            body.add(pole);
        }
    }
    let beam = null;
    if (def.building) {
        const g = new THREE.ConeGeometry(0.1, 1.1, 16, 1, true);
        g.translate(0, -0.55, 0);
        g.rotateZ(Math.PI / 2);
        beam = new THREE.Mesh(g, beamMaterial());
        beam.position.y = def.beamY;
        beam.renderOrder = 5;
        body.add(beam);
    }
    if (color < 0) body.rotation.y = Math.PI; // Pirates face south
    return { root, body, beam, size: def.size, building: def.building, type, color };
}

/** Clone a model with a single override material (ghost ship, thumbnails). */
export function createGhost(type, color, material) {
    const p = createPiece(type * color);
    p.root.traverse((o) => { if (o.isMesh) o.material = material; });
    return p;
}
