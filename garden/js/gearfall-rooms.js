// Gearfall's buildings, every one of them open: a shell with a doorway in the
// front (the door hanging off its hinges or flat on the floor) and windows with
// broken glass round the frames; upper floors whose windows are painted by the
// city's shader; roofs flat, gabled, fallen in, tin or broken off short; and on
// the ground floor, rooms. The floor plan is cut into rooms by partitions,
// each with a doorway, and each room is furnished for what the building was
// (a house's sofa and beds, a shop's shelves, an office's desks, a warehouse's
// crates) and then left to rot: furniture turned over, ceiling panels down,
// rubble, puddles, paper everywhere, wires hanging, and now and then a bulb
// that still works, more or less.

import * as THREE from 'three';
import { C, mat, WIN, FLOOR, WALL_IN, rock, cyl, cone, sphere, quad, vquad, tri, prism, gearGeo, tube, sag, rusty, grimy, vary, TAU } from './gearfall-kit.js';
import { rng, clamp, lerp } from './util.js';

const V3 = THREE.Vector3;
export const WALL_T = 0.3;

const IN_WALL = ['#8a8470', '#7a8a7a', '#9a8a70', '#6a7a8a', '#8a7a7a', '#8a8a8a', '#7a6a5a', '#9a9a80'];
const WOOD = C('#5a3e28'), WOOD_D = C('#3a281a'), METAL = C('#5e6264'), METAL_D = C('#3a3c3e');
const FABRIC = ['#5a4a3a', '#4a5a5a', '#6a4a4a', '#5a5a3a', '#4a4a5a', '#6a5a48'];
const PAPER = ['#d8d0b8', '#c8bc9a', '#e0dccc', '#b8ac8a', '#a89c80'];
const GLASS = C('#5a7a80');
const RUST = rusty('#6a5a4a', 0.75, 2.2);

/**
 * Everything for one building into ctx: { acc, cols, lights, signs, r }.
 * `b` is a plan from lotPlan(): { kind, x, z, w, d, yaw, gH, H, color, seed, win, roof, damaged, sign }.
 */
export function buildBuilding(ctx, b) {
    const { acc } = ctx;
    const r = rng(`gfb:${b.x.toFixed(2)}:${b.z.toFixed(2)}:${b.seed}`);
    const B = mat(b.x, 0, b.z, b.yaw);
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const W = (lx, lz) => ({ x: b.x + lx * cy + lz * sy, z: b.z - lx * sy + lz * cy });
    const at = (lx, ly, lz, ry = 0, sx = 1, sy2 = sx, sz = sx, tx = 0, tz = 0) => B.clone().multiply(mat(lx, ly, lz, ry, sx, sy2, sz, tx, tz));
    const col = (lx, lz, rad) => {
        const p = W(lx, lz);
        ctx.cols.push({ x: p.x, z: p.z, r: rad });
    };
    const colLine = (ax, az, bx, bz, rad = 0.22) => {
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.ceil(L / 0.38));
        for (let i = 0; i <= n; i++) col(lerp(ax, bx, i / n), lerp(az, bz, i / n), rad);
    };
    const light = (lx, ly, lz, o = {}) => {
        const p = W(lx, lz);
        ctx.lights.push({ x: p.x, y: ly, z: p.z, color: o.color ?? 0xffd8a0, flick: o.flick ?? 0, power: o.power ?? 1, range: o.range ?? 7, kind: 'in' });
    };

    const { w, d, gH } = b;
    const T = WALL_T;
    const ext = grimy(b.color, 0.35);
    const inCol = vary(r.pick(IN_WALL), r, 0.1);
    const ceilCol = C('#6a665c').multiplyScalar(0.8 + r() * 0.2);
    const kind = b.kind;
    const floorStyle = kind === 'house' ? (r() < 0.6 ? FLOOR.boards : FLOOR.carpet) : kind === 'shop' ? FLOOR.tiles : kind === 'warehouse' || kind === 'shack' ? FLOOR.concrete : r() < 0.5 ? FLOOR.tiles : FLOOR.carpet;
    const floorCol = floorStyle === FLOOR.boards ? C('#6a4a30') : floorStyle === FLOOR.carpet ? vary(r.pick(['#5a4a3a', '#4a4a52', '#5a3a3a', '#3a4a42']), r) : C('#7a7670');

    // ----------------------------------------------------------- the floor
    acc.box(w - 0.02, 0.06, d - 0.02, at(0, -0.04, 0), { color: floorCol, inside: 1, win: floorStyle, seed: r() });

    // ----------------------------------------------------------- the outside walls, with their openings
    // openings are { a, b, y0, y1 } along a wall's run; y0 = 0 is a doorway
    const dw = kind === 'house' || kind === 'shack' ? 1.1 : kind === 'flat' ? 1.5 : kind === 'warehouse' ? 1.2 : 2.4;
    const doorX = clamp(r.range(-w / 2 + 1.6, w / 2 - 1.6) * (kind === 'tower' || kind === 'office' ? 0.2 : 0.7), -w / 2 + dw / 2 + 0.6, w / 2 - dw / 2 - 0.6);
    const doorH = Math.min(gH - 0.4, kind === 'tower' || kind === 'office' || kind === 'shop' ? 2.8 : 2.15);
    const front = [{ a: doorX - dw / 2, b: doorX + dw / 2, y0: 0, y1: doorH, door: true }];
    const winOps = (run0, run1, avoid, o) => {
        const ops = [];
        const len = run1 - run0;
        const n = Math.max(0, Math.floor(len / o.every));
        for (let i = 0; i < n; i++) {
            const c = run0 + (len / n) * (i + 0.5);
            if (avoid.some((op) => c + o.w / 2 > op.a - 0.4 && c - o.w / 2 < op.b + 0.4)) continue;
            if (r() < (o.skip ?? 0.15)) continue;
            ops.push({ a: c - o.w / 2, b: c + o.w / 2, y0: o.y0, y1: Math.min(o.y1, gH - 0.35) });
        }
        return ops;
    };
    const winSpec = kind === 'shop' ? { every: 3.2, w: 2.6, y0: 0.6, y1: 3.1, skip: 0 } : kind === 'tower' || kind === 'office' ? { every: 3.0, w: 2.4, y0: 0.5, y1: 3.6, skip: 0.1 } : kind === 'warehouse' ? { every: 5, w: 2.2, y0: gH - 1.9, y1: gH - 0.6, skip: 0.3 } : kind === 'shack' ? { every: 3, w: 0.8, y0: 1.0, y1: 1.7, skip: 0.4 } : { every: 3.0, w: 1.1, y0: 0.95, y1: 2.15, skip: 0.2 };
    if (kind === 'warehouse') {
        // the loading door, rolled up or torn away
        const lw = Math.min(5, w * 0.3);
        const lx = doorX > 0 ? doorX - dw / 2 - 1.2 - lw / 2 : doorX + dw / 2 + 1.2 + lw / 2;
        if (Math.abs(lx) + lw / 2 < w / 2 - 0.6) front.push({ a: lx - lw / 2, b: lx + lw / 2, y0: 0, y1: Math.min(gH - 0.6, 4.4), door: true, loading: true });
    }
    front.push(...winOps(-w / 2 + 0.5, w / 2 - 0.5, front, winSpec));
    const back = winOps(-w / 2 + 0.5, w / 2 - 0.5, [], { ...winSpec, skip: 0.45 });
    const left = winOps(-d / 2 + T + 0.5, d / 2 - T - 0.5, [], { ...winSpec, skip: 0.35 });
    const right = winOps(-d / 2 + T + 0.5, d / 2 - T - 0.5, [], { ...winSpec, skip: 0.35 });

    const wallColor = (inFace) => (v, n, wp, face) => (face === inFace ? inCol : ext(v, n, wp));
    const IN_FACE = { front: 5, back: 4, left: 0, right: 1 };
    const insideOf = (inFace) => (face) => (face === inFace ? 1 : face === 2 || face === 3 ? 1 : 0);
    // a run of wall: 'front'/'back' run along x at z = +-(d/2 - T/2); 'left'/'right' along z at x = -+(w/2 - T/2)
    const wallRun = (side, ops) => {
        const alongX = side === 'front' || side === 'back';
        const fixed = side === 'front' ? d / 2 - T / 2 : side === 'back' ? -d / 2 + T / 2 : side === 'left' ? -w / 2 + T / 2 : w / 2 - T / 2;
        const s0 = alongX ? -w / 2 : -d / 2 + T, s1 = alongX ? w / 2 : d / 2 - T;
        const inF = IN_FACE[side];
        const o = { colorFn: wallColor(inF), inside: insideOf(inF), win: WALL_IN, seed: r() };
        const piece = (a, bb, y0, y1, solid) => {
            if (bb - a < 0.01 || y1 - y0 < 0.01) return;
            const m = (a + bb) / 2, L = bb - a;
            if (alongX) acc.box(L, y1 - y0, T, at(m, y0, fixed), o);
            else acc.box(T, y1 - y0, L, at(fixed, y0, m), o);
            if (solid) {
                if (alongX) colLine(a, fixed, bb, fixed);
                else colLine(fixed, a, fixed, bb);
            }
        };
        const list = [...ops].sort((p, q) => p.a - q.a);
        let cur = s0;
        for (const op of list) {
            piece(cur, op.a, 0, gH, true);
            piece(op.a, op.b, 0, op.y0, op.y0 > 0.3);
            piece(op.a, op.b, op.y1, gH, false);
            cur = op.b;
            if (!op.door) shards(alongX, fixed, op, side);
        }
        piece(cur, s1, 0, gH, true);
    };
    // glass left in a window frame, and some on the ground under it
    const shards = (alongX, fixed, op, side) => {
        const n = r.int(1, 4);
        const out = side === 'front' || side === 'right' ? 1 : -1;
        for (let i = 0; i < n; i++) {
            const s = r() < 0.5 ? op.a + 0.02 : op.b - 0.02;
            const top = r() < 0.5;
            const y = top ? op.y1 - 0.02 : op.y0 + 0.02;
            const h = r.range(0.12, 0.45) * (top ? -1 : 1);
            const m = alongX ? at(s + (s === op.a + 0.02 ? 0.12 : -0.12), y, fixed, 0, r.range(0.25, 0.5), h, 1) : at(fixed, y, s + (s === op.a + 0.02 ? 0.12 : -0.12), Math.PI / 2, r.range(0.25, 0.5), h, 1);
            acc.add(tri(), m, { color: GLASS, inside: 0.5 });
        }
        if (op.y0 < 0.4) return;
        for (let i = 0; i < 4; i++) {
            const s = lerp(op.a, op.b, r());
            const off = out * r.range(0.25, 1.1) * (r() < 0.5 ? 1 : -1);
            const lx = alongX ? s : fixed + off, lz = alongX ? fixed + off : s;
            acc.add(quad(), at(lx, 0.02, lz, r() * TAU, r.range(0.06, 0.2), 1, r.range(0.05, 0.16)), { color: GLASS, inside: 0.6 });
        }
    };
    wallRun('front', front);
    wallRun('back', back);
    wallRun('left', left);
    wallRun('right', right);

    // the door: hanging open off one hinge, or down on the floor
    for (const op of front.filter((o) => o.door && !o.loading)) {
        const k = r();
        const lw = op.b - op.a;
        const leafCol = vary(r.pick(['#5a3a24', '#3a4a4a', '#4a3a2a', '#6a6a60', '#5a2a1a']), r);
        if (k < 0.45) {
            const hx = r() < 0.5 ? op.a : op.b, dir = hx === op.a ? 1 : -1;
            const ang = r.range(1.3, 2.1) * dir;
            acc.box(lw * 0.95, op.y1 - 0.06, 0.05, at(hx, 0.03, d / 2 - T - 0.03, ang).multiply(mat(dir * lw * 0.47, 0, 0)), { color: leafCol, inside: 0.5 });
        } else if (k < 0.75) {
            acc.box(lw * 0.95, 0.05, op.y1 - 0.06, at(op.a + lw / 2 + r.range(-0.2, 0.2), 0.03, d / 2 - T - 1.2 - r() * 0.4, r.range(-0.3, 0.3)), { color: leafCol, inside: 1 });
        }
        // the frame
        acc.box(0.08, op.y1, T + 0.04, at(op.a - 0.04, 0, d / 2 - T / 2), { color: WOOD_D });
        acc.box(0.08, op.y1, T + 0.04, at(op.b + 0.04, 0, d / 2 - T / 2), { color: WOOD_D });
    }
    for (const op of front.filter((o) => o.loading)) {
        // a roller shutter rolled up, with its torn bottom hanging
        acc.box(op.b - op.a, 0.5, 0.45, at((op.a + op.b) / 2, op.y1, d / 2 - T / 2 - 0.3), { colorFn: RUST, inside: 0.5 });
        acc.box((op.b - op.a) * r.range(0.3, 0.6), r.range(0.4, 1.4), 0.04, at(op.a + (op.b - op.a) * 0.3, op.y1 - 0.9, d / 2 - T + 0.1, 0, 1, 1, 1, 0.08), { colorFn: RUST, inside: 0.5, sway: 0.05 });
    }

    // ----------------------------------------------------------- above: floors, roof
    const roofY = buildUpper(ctx, b, r, at, ext, ceilCol, colLine);

    // ----------------------------------------------------------- the outside extras
    exterior(ctx, b, r, at, ext, colLine, col, light, front, roofY);

    // ----------------------------------------------------------- the rooms
    const inner = { x0: -w / 2 + T, x1: w / 2 - T, z0: -d / 2 + T, z1: d / 2 - T };
    const clear = [{ x: doorX, z: d / 2 - T - 0.9, r: 1.4 }];
    for (const op of front.filter((o) => o.loading)) clear.push({ x: (op.a + op.b) / 2, z: d / 2 - T - 1.5, r: 2.4 });
    const rooms = [];
    const minRoom = kind === 'tower' || kind === 'office' ? 7 : kind === 'warehouse' ? 11 : kind === 'shack' ? 99 : 3.6;
    const parts = (rect, depth) => {
        const rw = rect.x1 - rect.x0, rd = rect.z1 - rect.z0;
        const big = Math.max(rw, rd);
        if (depth >= 3 || big < minRoom * 1.7 || (depth > 0 && r() < 0.18)) {
            rooms.push(rect);
            return;
        }
        const splitX = rw > rd;   // a wall across x (running along z)
        const len = splitX ? rw : rd;
        let s = (splitX ? rect.x0 : rect.z0) + len * r.range(0.38, 0.62);
        // keep partitions clear of the front door
        if (splitX && Math.abs(s - doorX) < dw / 2 + 0.7) s = doorX + (s < doorX ? -1 : 1) * (dw / 2 + 0.7);
        const span0 = splitX ? rect.z0 : rect.x0, span1 = splitX ? rect.z1 : rect.x1;
        const gap = Math.min(1.1, (span1 - span0) - 1.0);
        const gp = r.range(span0 + 0.5 + gap / 2, span1 - 0.5 - gap / 2);
        partition(splitX, s, span0, span1, gp, gap);
        if (splitX) {
            clear.push({ x: s, z: gp, r: 1.0 });
            parts({ ...rect, x1: s - 0.075 }, depth + 1);
            parts({ ...rect, x0: s + 0.075 }, depth + 1);
        } else {
            clear.push({ x: gp, z: s, r: 1.0 });
            parts({ ...rect, z1: s - 0.075 }, depth + 1);
            parts({ ...rect, z0: s + 0.075 }, depth + 1);
        }
    };
    const partition = (splitX, s, a, bb, gp, gap) => {
        const o = { color: inCol, inside: 1, win: WALL_IN, seed: r() };
        const h = gH;
        const seg = (p0, p1) => {
            if (p1 - p0 < 0.05) return;
            const m = (p0 + p1) / 2;
            if (splitX) {
                acc.box(0.15, h, p1 - p0, at(s, 0, m), o);
                colLine(s, p0, s, p1, 0.16);
            } else {
                acc.box(p1 - p0, h, 0.15, at(m, 0, s), o);
                colLine(p0, s, p1, s, 0.16);
            }
        };
        seg(a, gp - gap / 2);
        seg(gp + gap / 2, bb);
        // the lintel over the gap, and sometimes a hole knocked through the wall instead
        const lm = splitX ? at(s, 2.1, gp) : at(gp, 2.1, s);
        if (h > 2.15) acc.box(splitX ? 0.15 : gap, h - 2.1, splitX ? gap : 0.15, lm, o);
    };
    parts(inner, 0);
    furnish(ctx, b, r, at, rooms, clear, col, light, inCol);
}

// ------------------------------------------------------------------ floors above and the roof

function buildUpper(ctx, b, r, at, ext, ceilCol, colLine) {
    const { acc } = ctx;
    const { w, d, gH, H } = b;
    const ceiling = (face) => (face === 3 ? 1 : 0);
    const upColor = (v, n, wp, face) => (face === 3 ? ceilCol : ext(v, n, wp));
    if (H > gH + 0.5) {
        let top = H;
        if (b.damaged) top = gH + (H - gH) * r.range(0.55, 0.85);
        acc.box(w, top - gH, d, at(0, gH, 0), { colorFn: upColor, inside: ceiling, win: b.win, seed: b.seed });
        // a cornice between the shop floor and the rest
        acc.box(w + 0.3, 0.35, d + 0.3, at(0, gH - 0.05, 0), { colorFn: ext });
        if (b.damaged) {
            // broken off: ragged stumps of floors, girders sticking up, a slab hanging
            const n = r.int(3, 6);
            for (let i = 0; i < n; i++) {
                const pw = w * r.range(0.25, 0.55), pd = d * r.range(0.25, 0.55);
                const px = r.range(-w / 2 + pw / 2, w / 2 - pw / 2), pz = r.range(-d / 2 + pd / 2, d / 2 - pd / 2);
                const ph = (H - top) * r.range(0.15, 1);
                acc.box(pw, ph, pd, at(px, top, pz), { colorFn: ext, win: b.win, seed: b.seed });
            }
            for (let i = 0; i < 10; i++) {
                const gx = r.range(-w / 2, w / 2), gz = r() < 0.5 ? (r() < 0.5 ? -d / 2 : d / 2) : r.range(-d / 2, d / 2);
                acc.box(0.25, r.range(1.5, 6), 0.25, at(gx, top, gz, r() * 3, 1, 1, 1, r.range(-0.4, 0.4), r.range(-0.4, 0.4)), { colorFn: RUST });
            }
            const sx = r.sign();
            acc.box(w * 0.4, 0.3, d * 0.6, at(sx * w * 0.42, top - 2.5, 0, 0, 1, 1, 1, 0, sx * 0.9), { colorFn: ext });
            return top;
        }
        roofJunk(ctx, b, r, at, H, w, d);
        return H;
    }
    // one storey: a ceiling slab, then the roof
    const roofT = 0.3;
    acc.box(w, roofT, d, at(0, gH, 0), { colorFn: upColor, inside: ceiling });
    const y = gH + roofT;
    if (b.roof === 'gable' || b.roof === 'collapsed') {
        gable(ctx, b, r, at, y, w, d, b.roof === 'collapsed');
        return y + 2.2;
    }
    if (b.roof === 'shed' || b.roof === 'tin') {
        // corrugated sheets on a low pitch, some gone, ribs showing
        const tin = rusty('#7a7a74', 0.6, 1.8);
        const pitch = 0.08;
        acc.box(w + 0.4, 0.06, d + 0.6, at(0, y + 0.25, 0, 0, 1, 1, 1, pitch), { colorFn: tin });
        for (let x = -w / 2; x <= w / 2; x += 0.5) acc.box(0.05, 0.05, d + 0.6, at(x, y + 0.31, 0, 0, 1, 1, 1, pitch), { colorFn: tin });
        if (b.kind === 'warehouse') {
            // trusses under the roof
            for (let z = -d / 2 + 3; z < d / 2 - 1; z += 4) {
                ctx.acc.box(w - 0.6, 0.18, 0.18, at(0, b.gH - 0.25, z), { colorFn: RUST, inside: 1 });
                for (let k = -2; k <= 2; k++) ctx.acc.box(0.12, 1.2, 0.12, at(k * w * 0.18, b.gH - 1.2, z, 0, 1, 1, 1, 0, k * 0.25), { colorFn: RUST, inside: 1 });
            }
        }
        return y + 0.4;
    }
    // flat, with a parapet
    for (const s of [-1, 1]) {
        acc.box(w, 0.8, 0.25, at(0, y, s * (d / 2 - 0.125)), { colorFn: ext });
        acc.box(0.25, 0.8, d, at(s * (w / 2 - 0.125), y, 0), { colorFn: ext });
    }
    roofJunk(ctx, b, r, at, y, w, d);
    return y;
}

function gable(ctx, b, r, at, y, w, d, collapsed) {
    const { acc } = ctx;
    const rise = 2.2, over = 0.35;
    const shingle = grimy(r.pick(['#4a3a32', '#3a3a3e', '#5a3a2a', '#4a4a3a']), 0.4);
    const ridgeAlongX = w >= d;
    const span = (ridgeAlongX ? d : w) / 2 + over, len = (ridgeAlongX ? w : d) + over * 2;
    const pitch = Math.atan2(rise, span - over);
    const plane = Math.hypot(span, rise * span / (span - over));
    // the gable ends: a prism filling the attic
    const pm = ridgeAlongX ? at(0, y, 0, 0, w, rise, d) : at(0, y, 0, Math.PI / 2, d, rise, w);
    acc.add(prism(), pm, { colorFn: (v, n, wp) => grimy(b.color, 0.4)(v, n, wp) });
    for (const s of [-1, 1]) {
        if (collapsed && s > 0) {
            // this side has fallen in: a broken sheet sagging, rafters bare
            const tilt = pitch * 0.25;
            const m = ridgeAlongX ? at(0, y + 0.2, s * span * 0.45, 0, 1, 1, 1, s * tilt) : at(s * span * 0.45, y + 0.2, 0, Math.PI / 2, 1, 1, 1, s * tilt);
            acc.box(len * 0.6, 0.08, plane * 0.6, m, { colorFn: shingle });
            for (let k = -len / 2 + 0.6; k < len / 2; k += 0.9) {
                const rm = ridgeAlongX ? at(k, y + rise / 2, s * span / 2, 0, 1, 1, 1, -s * (Math.PI / 2 - pitch)) : at(s * span / 2, y + rise / 2, k, Math.PI / 2, 1, 1, 1, -s * (Math.PI / 2 - pitch));
                if (r() < 0.75) acc.box(0.1, plane * 0.95, 0.12, rm.multiply(mat(0, -plane * 0.47, 0)), { color: WOOD_D });
            }
            continue;
        }
        const m = ridgeAlongX
            ? at(0, y + rise / 2 - 0.05, s * (span - over) / 2, 0, 1, 1, 1, s * pitch)
            : at(s * (span - over) / 2, y + rise / 2 - 0.05, 0, Math.PI / 2, 1, 1, 1, s * pitch);
        acc.box(len, 0.1, plane, m, { colorFn: shingle });
    }
    // a chimney
    if (r() < 0.6) acc.box(0.6, rise + 1, 0.6, at(r.range(-w / 3, w / 3), y, r.range(-d / 4, d / 4)), { colorFn: grimy('#6a4a3a', 0.5) });
}

function roofJunk(ctx, b, r, at, y, w, d) {
    const { acc } = ctx;
    const n = Math.min(6, Math.floor((w * d) / 60) + 1);
    for (let i = 0; i < n; i++) {
        const k = r();
        const x = r.range(-w / 2 + 1.5, w / 2 - 1.5), z = r.range(-d / 2 + 1.5, d / 2 - 1.5);
        if (k < 0.45) acc.box(r.range(1, 2), r.range(0.7, 1.2), r.range(1, 1.6), at(x, y, z, r() * 3), { colorFn: rusty('#8a8a84', 0.5) });
        else if (k < 0.6) acc.box(0.5, 0.9, 0.5, at(x, y, z), { color: METAL_D });
    }
    // a water tank on legs, an aerial with a red light still blinking
    if (b.H > 20 && r() < 0.5) {
        const x = r.range(-w / 4, w / 4), z = r.range(-d / 4, d / 4);
        for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) acc.box(0.2, 3, 0.2, at(x + a * 1.3, y, z + c * 1.3), { colorFn: RUST });
        acc.add(cyl(12), at(x, y + 3, z, 0, 1.8, 3, 1.8), { colorFn: rusty('#5a4a3a', 0.4, 1.4) });
        acc.add(cone(12), at(x, y + 6, z, 0, 1.9, 0.8, 1.9), { colorFn: rusty('#4a3a2a', 0.5) });
    }
    if (b.H > 30 && r() < 0.6) {
        const x = r.range(-w / 3, w / 3), z = r.range(-d / 3, d / 3), h = r.range(6, 16);
        acc.add(cyl(5), at(x, y, z, 0, 0.12, h, 0.12, r.range(-0.08, 0.08)), { color: METAL });
        acc.add(sphere(6, 4), at(x, y + h, z, 0, 0.25), { color: C('#ff2a1a'), glow: 3, flick: r.range(0.05, 1) });
    }
}

// ------------------------------------------------------------------ outside details

function exterior(ctx, b, r, at, ext, colLine, col, light, front, roofY) {
    const { acc } = ctx;
    const { w, d, gH, H, kind } = b;
    // a drainpipe down one corner
    if (H > 6 || kind === 'house') {
        const sx = r.sign(), top = H > gH ? (b.damaged ? gH + (H - gH) * 0.5 : H) : gH;
        acc.add(cyl(6), at(sx * (w / 2 + 0.08), 0, d / 2 - 0.15, 0, 0.07, top, 0.07, r() < 0.2 ? 0.1 : 0), { colorFn: RUST });
    }
    // an awning over a shop, torn to strips that move in the wind
    if (kind === 'shop' && !b.garage) {
        const aw = Math.min(w - 1, 8), ac = vary(r.pick(['#6a2a22', '#2a4a5a', '#4a5a2a', '#6a5a2a']), r);
        const m = at(r.range(-0.5, 0.5), gH - 0.9, d / 2 + 0.7, 0, 1, 1, 1, 0.35);
        acc.box(aw, 0.05, 1.5, m, { color: ac });
        for (let x = -aw / 2 + 0.2; x < aw / 2; x += 0.3) {
            if (r() < 0.5) continue;
            const L = r.range(0.2, 0.9);
            acc.box(0.25, L, 0.02, at(x + r.range(-0.05, 0.05), gH - 1.2 - L + 0.1, d / 2 + 1.4), { color: ac.clone().multiplyScalar(0.8), sway: 0.12, swayH: L });
        }
    }
    // a sign over the door: neon if it has one, or a painted board
    if (b.sign) {
        const p = at(0, gH - 0.55, d / 2 + 0.12);
        ctx.signs?.add(p, Math.min(w * 0.8, 6), r);
    } else if ((kind === 'shop' || kind === 'office') && r() < 0.6) {
        acc.box(Math.min(w * 0.7, 6), 0.8, 0.12, at(r.range(-0.4, 0.4), gH - 1, d / 2 + 0.08, 0, 1, 1, 1, 0, r.range(-0.12, 0.12)), { colorFn: rusty(r.pick(['#6a3a2a', '#2a3a5a', '#5a5a3a']), 0.6) });
    }
    // fire escapes zigzag up the side of a block of flats
    if ((kind === 'flat' || kind === 'shop') && H > gH + 4 && r() < 0.7) {
        const sx = r.sign(), x = sx * (w / 2 + 0.6);
        const floors = Math.floor((H - gH) / 3.1);
        for (let f = 0; f < floors - (b.damaged ? 2 : 0); f++) {
            const y = gH + 0.4 + f * 3.1;
            acc.box(1.1, 0.06, Math.min(d - 2, 5), at(x, y, 0), { colorFn: RUST });
            acc.box(0.05, 1, Math.min(d - 2, 5), at(x + sx * 0.53, y, 0), { colorFn: RUST });
            acc.box(0.5, 0.05, 3.6, at(x, y + 1.55, f % 2 ? 0.6 : -0.6, 0, 1, 1, 1, (f % 2 ? 1 : -1) * 0.71), { colorFn: RUST });
        }
        // the bottom ladder, hanging loose
        acc.box(0.45, 2.4, 0.05, at(x, gH - 2, 1.6, 0, 1, 1, 1, 0, 0.15 * sx), { colorFn: RUST, sway: 0.03 });
    }
    // air conditioners rusting on the walls
    if (H > gH + 3) {
        for (let i = 0; i < 4; i++) {
            if (r() < 0.4) continue;
            const y = gH + 1 + r() * (H - gH - 3) * (b.damaged ? 0.5 : 1);
            const xx = r.range(-w / 2 + 1, w / 2 - 1);
            acc.box(0.8, 0.5, 0.6, at(xx, y, d / 2 + 0.3), { colorFn: rusty('#8a8a80', 0.6) });
        }
    }
    // a house's porch, steps and broken fence
    if (kind === 'house') {
        acc.box(Math.min(w - 1, 4.5), 0.2, 1.6, at(0, 0, d / 2 + 0.8), { color: WOOD });
        const pw = Math.min(w - 1, 4.5);
        if (r() < 0.7) {
            for (const s of [-1, 1]) acc.box(0.12, 2.2, 0.12, at(s * (pw / 2 - 0.1), 0.2, d / 2 + 1.5, 0, 1, 1, 1, r() < 0.3 ? 0.15 : 0), { color: WOOD_D });
            acc.box(pw + 0.3, 0.1, 1.8, at(0, 2.4, d / 2 + 0.85, 0, 1, 1, 1, r() < 0.4 ? -0.2 : 0.05), { color: WOOD_D });
            col(-pw / 2 + 0.1, d / 2 + 1.5, 0.15);
            col(pw / 2 - 0.1, d / 2 + 1.5, 0.15);
        }
        // fence round the yard, palings fallen
        const fz = d / 2 + r.range(3.5, 5.5), fw = w + r.range(2, 4);
        for (let x = -fw / 2; x <= fw / 2; x += 0.22) {
            if (Math.abs(x) < 1.2 || r() < 0.3) continue;
            const fallen = r() < 0.12;
            acc.box(0.1, 1, 0.03, at(x, 0, fz, 0, 1, 1, 1, fallen ? 1.45 : r.range(-0.1, 0.1), r.range(-0.08, 0.08)), { color: C('#8a8270').multiplyScalar(0.7 + r() * 0.3) });
        }
        for (const s of [-1, 1]) acc.box(fw / 2 - 1.2, 0.06, 0.05, at(s * (fw / 4 + 0.6), 0.7, fz - 0.03), { color: C('#7a7262') });
        colLine(-fw / 2, fz, -1.3, fz, 0.1);
        colLine(1.3, fz, fw / 2, fz, 0.1);
        // a dead tree in the yard, a mailbox
        if (r() < 0.6) deadTree(ctx, at, r, r.range(-w / 2, w / 2), d / 2 + r.range(1.8, 3), col);
        acc.box(0.1, 1.1, 0.1, at(1.6, 0, fz + 0.4, 0, 1, 1, 1, r.range(-0.2, 0.2)), { color: WOOD_D });
        acc.box(0.3, 0.25, 0.5, at(1.6, 1.05, fz + 0.4), { colorFn: rusty('#3a4a5a', 0.6) });
    }
    // an outside light by the door, mostly dead
    if (kind !== 'shack' && r() < 0.5) {
        const on = r() < 0.28;
        acc.box(0.2, 0.3, 0.15, at(front[0].b + 0.4, 2.3, d / 2 + 0.08), { color: on ? C('#ffd890') : C('#3a3a30'), glow: on ? 1.6 : 0, flick: on ? r.range(0.05, 1) : 0 });
        if (on) light(front[0].b + 0.4, 2.3, d / 2 + 0.6, { color: 0xffc070, flick: 0, power: 0.6, range: 6 });
    }
}

export function deadTree(ctx, at, r, lx, lz, col) {
    const { acc } = ctx;
    const bark = C('#3a3028').multiplyScalar(0.8 + r() * 0.3);
    const h = r.range(3, 6), lean = r.range(-0.12, 0.12);
    acc.add(cone(6), at(lx, 0, lz, r() * 3, 0.22, h, 0.22, lean), { color: bark });
    for (let i = 0; i < 5; i++) {
        const y = h * r.range(0.4, 0.85), a = r() * TAU, L = r.range(1, 2.4);
        acc.add(cone(4), at(lx + Math.sin(lean) * y * 0, y, lz, a, 0.07, L, 0.07, r.range(0.6, 1.1)), { color: bark });
    }
    col?.(lx, lz, 0.3);
}

// ------------------------------------------------------------------ furnishing the rooms

function furnish(ctx, b, r, at, rooms, clear, col, light, inCol) {
    const { acc } = ctx;
    const kind = b.kind, gH = b.gH;
    const placed = [];
    const free = (x, z, rad, rect) => {
        if (x - rad < rect.x0 + 0.05 || x + rad > rect.x1 - 0.05 || z - rad < rect.z0 + 0.05 || z + rad > rect.z1 - 0.05) return false;
        for (const c of clear) if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return false;
        for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < p.r + rad) return false;
        return true;
    };
    // an item's frame, and its parts in it
    const frame = (x, z, ry, tipped = 0, lift = 0) => at(x, lift, z, ry, 1, 1, 1, 0, tipped);
    const part = (F, w, h, d, x, y, z, color, o = {}) => acc.box(w, h, d, F.clone().multiply(mat(x, y, z, o.ry || 0, 1, 1, 1, o.tx || 0, o.tz || 0)), { color, inside: 1, ...o.extra });

    const ITEMS = {
        table(x, z, ry, rr) {
            const F = rr() < 0.3 ? frame(x, z, ry, Math.PI / 2, 0.4) : frame(x, z, ry, rr() < 0.3 ? 0.12 : 0);
            part(F, 1.4, 0.06, 0.8, 0, 0.72, 0, WOOD);
            for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (rr() < 0.85) part(F, 0.06, 0.72, 0.06, a * 0.62, 0, c * 0.32, WOOD_D);
            return 0.7;
        },
        chair(x, z, ry, rr) {
            const tip = rr() < 0.45;
            const F = tip ? frame(x, z, ry, Math.PI / 2, 0.22) : frame(x, z, ry);
            part(F, 0.44, 0.05, 0.44, 0, 0.45, 0, WOOD);
            part(F, 0.44, 0.5, 0.05, 0, 0.47, -0.2, WOOD);
            for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(F, 0.04, 0.45, 0.04, a * 0.19, 0, c * 0.19, WOOD_D);
            return 0;
        },
        desk(x, z, ry, rr) {
            const F = frame(x, z, ry, rr() < 0.15 ? Math.PI / 2 : 0, rr() < 0.15 ? 0.4 : 0);
            const dc = rr() < 0.5 ? METAL : WOOD;
            part(F, 1.5, 0.05, 0.75, 0, 0.73, 0, dc);
            part(F, 0.45, 0.73, 0.7, -0.5, 0, 0, dc.clone().multiplyScalar(0.8));
            part(F, 0.04, 0.73, 0.7, 0.72, 0, 0, dc);
            if (rr() < 0.6) {
                // a computer, its screen dead or cracked
                part(F, 0.45, 0.38, 0.4, 0.2, 0.78, -0.05, C('#8a8678'));
                part(F, 0.38, 0.3, 0.01, 0.2, 0.82, 0.155, C('#0a0c0c'));
            }
            for (let i = 0; i < 3; i++) part(F, 0.21, 0.01, 0.29, rr.range(-0.6, 0.6), 0.78, rr.range(-0.25, 0.25), C(rr.pick(PAPER)), { ry: rr() * 3 });
            const c = rr() < 0.5;
            if (c) ITEMS.chair(x + Math.sin(ry) * 0.8, z + Math.cos(ry) * 0.8, ry + Math.PI + rr.range(-0.6, 0.6), rr);
            return 0.8;
        },
        cabinet(x, z, ry, rr) {
            const tip = rr() < 0.3;
            const F = tip ? frame(x, z, ry, Math.PI / 2, 0.25) : frame(x, z, ry);
            const cc = rusty(rr.pick(['#6a6e64', '#5a5e62', '#7a7462']), 0.35, 2);
            acc.box(0.5, 1.35, 0.6, F, { colorFn: cc, inside: 1 });
            for (let k = 0; k < 4; k++) {
                const open = rr() < 0.3 ? rr.range(0.15, 0.45) : 0;
                part(F, 0.44, 0.28, 0.04, 0, 0.08 + k * 0.32, 0.31 + open, C('#4a4e4a'));
                if (open) part(F, 0.4, 0.04, open, 0, 0.08 + k * 0.32, 0.31 + open / 2, C('#3a3e3a'));
            }
            return 0.45;
        },
        shelf(x, z, ry, rr) {
            const fallen = rr() < 0.3;
            const F = fallen ? frame(x, z, ry, 0, 0.2).multiply(mat(0, 0, 0, 0, 1, 1, 1, Math.PI / 2 * 0.98)) : frame(x, z, ry);
            const sc = rr() < 0.5 ? WOOD : METAL;
            part(F, 0.05, 1.9, 0.4, -0.6, 0, 0, sc);
            part(F, 0.05, 1.9, 0.4, 0.6, 0, 0, sc);
            for (let k = 0; k < 5; k++) {
                part(F, 1.2, 0.03, 0.4, 0, 0.1 + k * 0.44, 0, sc);
                for (let i = 0; i < 6; i++) if (rr() < 0.4) part(F, rr.range(0.05, 0.14), rr.range(0.15, 0.3), 0.25, rr.range(-0.5, 0.5), 0.13 + k * 0.44, 0, C(rr.pick(['#6a3a2a', '#2a4a3a', '#5a5a6a', '#8a7a4a', '#6a6a6a'])));
            }
            // what fell off, on the floor
            for (let i = 0; i < 6; i++) part(frame(x, z, ry), rr.range(0.12, 0.25), rr.range(0.03, 0.08), rr.range(0.15, 0.3), rr.range(-1, 1), 0, rr.range(0.3, 1.2), C(rr.pick(['#6a3a2a', '#2a4a3a', '#8a7a4a', '#5a5a6a'])), { ry: rr() * 3 });
            return 0.7;
        },
        sofa(x, z, ry, rr) {
            const fc = C(rr.pick(FABRIC));
            const F = frame(x, z, ry);
            part(F, 2, 0.42, 0.85, 0, 0, 0, fc);
            part(F, 2, 0.5, 0.22, 0, 0.42, -0.32, fc.clone().multiplyScalar(0.85));
            part(F, 0.22, 0.3, 0.85, -0.9, 0.42, 0, fc.clone().multiplyScalar(0.9));
            part(F, 0.22, 0.3, 0.85, 0.9, 0.42, 0, fc.clone().multiplyScalar(0.9));
            // the stuffing coming out
            if (rr() < 0.6) part(F, 0.5, 0.08, 0.4, rr.range(-0.6, 0.6), 0.42, 0.05, C('#c8c0a8'));
            return 0.95;
        },
        bed(x, z, ry, rr) {
            const F = frame(x, z, ry);
            part(F, 1.4, 0.3, 2.0, 0, 0, 0, WOOD_D);
            part(F, 1.35, 0.2, 1.9, 0.02, 0.3, 0.02, C('#8a8270'), { tz: rr() < 0.3 ? 0.08 : 0 });
            part(F, 1.4, 0.9, 0.08, 0, 0, -1, WOOD_D);
            part(F, 0.5, 0.12, 0.35, -0.3, 0.5, -0.7, C('#a89c84'));
            // a stain on the mattress
            part(F, 0.6, 0.01, 0.5, 0.2, 0.505, 0.2, C('#5a4a32'));
            return 1.1;
        },
        fridge(x, z, ry, rr) {
            const tip = rr() < 0.25;
            const F = tip ? frame(x, z, ry, Math.PI / 2, 0.35) : frame(x, z, ry);
            const fc = rusty('#c8c4b4', 0.35, 3);
            acc.box(0.7, 1.75, 0.65, F, { colorFn: fc, inside: 1 });
            // the door hanging open
            acc.box(0.68, 1.7, 0.05, F.clone().multiply(mat(0.35, 0.03, 0.34, rr.range(0.6, 1.8)).multiply(mat(-0.34, 0, 0))), { colorFn: fc, inside: 1 });
            part(F, 0.6, 1.6, 0.01, 0, 0.08, 0.33, C('#1a1a18'));
            return 0.5;
        },
        stove(x, z, ry, rr) {
            const F = frame(x, z, ry);
            acc.box(0.7, 0.9, 0.65, F, { colorFn: rusty('#8a8a84', 0.6, 3), inside: 1 });
            for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(F, 0.18, 0.02, 0.18, a * 0.17, 0.9, c * 0.16, C('#1a1a1a'));
            return 0.5;
        },
        counter(x, z, ry, rr, len = 2.6) {
            const F = frame(x, z, ry);
            part(F, len, 0.95, 0.6, 0, 0, 0, C(rr.pick(['#6a5a48', '#5a5a5a', '#7a6a58'])));
            part(F, len + 0.1, 0.05, 0.7, 0, 0.95, 0, C('#8a8478'));
            if (rr() < 0.5) {
                part(F, 0.45, 0.3, 0.4, rr.range(-len / 3, len / 3), 1.0, 0, C('#3a3a3a'));
                part(F, 0.3, 0.05, 0.25, rr.range(-len / 3, len / 3), 1.0, 0.1, C('#2a2a2a'), { ry: 0.3 });
            }
            return len / 2;
        },
        tv(x, z, ry, rr) {
            const tip = rr() < 0.3;
            const F = tip ? frame(x, z, ry, 0, 0).multiply(mat(0, 0.3, 0, 0, 1, 1, 1, -Math.PI / 2)) : frame(x, z, ry);
            part(F, 0.8, 0.5, 0.5, 0, 0, 0, WOOD_D);
            part(F, 0.7, 0.55, 0.55, 0, 0.5, 0, C('#2a2a28'));
            part(F, 0.55, 0.42, 0.01, 0, 0.56, 0.28, C('#0c1010'));
            return 0.45;
        },
        crate(x, z, ry, rr) {
            const s = rr.range(0.7, 1.3), stack = rr() < 0.4 ? 2 : 1;
            for (let k = 0; k < stack; k++) {
                const F = frame(x + rr.range(-0.1, 0.1), z + rr.range(-0.1, 0.1), ry + rr.range(-0.2, 0.2) + k * 0.3);
                const cc = C(rr.pick(['#7a6040', '#6a5236', '#5a4a34'])).multiplyScalar(0.8 + rr() * 0.3);
                part(F, s, s * 0.8, s, 0, k * s * 0.8, 0, cc);
                part(F, s + 0.02, 0.06, s + 0.02, 0, k * s * 0.8 + s * 0.4, 0, cc.clone().multiplyScalar(0.7));
            }
            return s * 0.7;
        },
        barrel(x, z, ry, rr) {
            const tip = rr() < 0.35;
            const m = tip ? frame(x, z, ry, Math.PI / 2, 0.3) : frame(x, z, ry);
            acc.add(cyl(10), m.clone().multiply(mat(0, 0, 0, 0, 0.3, 0.9, 0.3)), { colorFn: rusty(rr.pick(['#3a5a3a', '#6a2a1a', '#2a3a5a', '#7a6a2a']), 0.6, 3), inside: 1 });
            return 0.35;
        },
        pallet(x, z, ry, rr) {
            const F = frame(x, z, ry);
            for (let k = -2; k <= 2; k++) part(F, 0.18, 0.03, 1.2, k * 0.24, 0.12, 0, WOOD);
            for (const k of [-1, 0, 1]) part(F, 1.1, 0.12, 0.1, 0, 0, k * 0.5, WOOD_D);
            return 0.6;
        },
        rubble(x, z, ry, rr) {
            const s = rr.range(0.7, 1.6);
            const rc = C(rr.pick(['#6a645a', '#5a564e', '#7a7064', '#6a5a4a']));
            for (let i = 0; i < 7; i++) {
                const a = rr() * TAU, d = rr() * s;
                const k = rr.range(0.15, 0.45) * s;
                acc.add(rock(rr() * 6), at(x + Math.cos(a) * d * 0.7, k * 0.3, z + Math.sin(a) * d * 0.7, rr() * 3, k, k, k), { color: rc.clone().multiplyScalar(0.8 + rr() * 0.3), inside: 1 });
            }
            // rebar
            for (let i = 0; i < 2; i++) part(frame(x, z, rr() * 3), 0.03, rr.range(0.6, 1.4), 0.03, rr.range(-0.4, 0.4), 0, rr.range(-0.4, 0.4), C('#5a3a22'), { tx: rr.range(-0.7, 0.7), tz: rr.range(-0.7, 0.7) });
            return s * 0.75;
        },
        ceilingPanel(x, z, ry, rr) {
            // a section of ceiling come down at one end
            const L = rr.range(1.2, 2.4);
            const tilt = Math.asin(clamp((gH - 0.2) / (L * 1.6), 0.2, 0.95));
            acc.box(1.2, 0.04, L * 1.6, at(x, 0.02, z, ry, 1, 1, 1, -tilt).multiply(mat(0, 0, L * 0.8)), { color: C('#8a867a'), inside: 1 });
            return 0;
        },
        beam(x, z, ry, rr) {
            const L = rr.range(2.5, 4.5);
            acc.box(0.25, 0.3, L, at(x, 0.05, z, ry, 1, 1, 1, -rr.range(0.15, 0.5)).multiply(mat(0, 0, L / 2)), { colorFn: RUST, inside: 1 });
            return 0;
        },
        machine(x, z, ry, rr) {
            // a lathe or press, seized
            const F = frame(x, z, ry);
            acc.box(1.8, 1, 0.9, F, { colorFn: rusty('#3a5a4a', 0.65, 2), inside: 1 });
            acc.box(0.5, 1.2, 0.5, F.clone().multiply(mat(-0.5, 1, 0)), { colorFn: rusty('#3a5a4a', 0.7, 2), inside: 1 });
            acc.add(gearGeo(rr.int(0, 3)), F.clone().multiply(mat(0.5, 1.3, 0, 0, 0.45, 0.45, 0.45, Math.PI / 2)), { colorFn: RUST, inside: 1 });
            return 1.0;
        },
        cart(x, z, ry, rr) {
            const F = frame(x, z, ry, rr() < 0.5 ? Math.PI / 2 : 0, rr() < 0.5 ? 0.3 : 0);
            part(F, 0.55, 0.45, 0.85, 0, 0.45, 0, C('#8a8a8a'));
            part(F, 0.5, 0.04, 0.8, 0, 0.2, 0, C('#6a6a6a'));
            return 0.45;
        },
        mattress(x, z, ry, rr) {
            part(frame(x, z, ry, 0.03), 0.9, 0.15, 1.9, 0, 0, 0, C('#7a7058'));
            return 0;
        },
        lobbyDesk(x, z, ry, rr) {
            ITEMS.counter(x, z, ry, rr, 3.4);
            return 1.6;
        },
        plant(x, z, ry, rr) {
            const tip = rr() < 0.4;
            const F = tip ? frame(x, z, ry, Math.PI / 2, 0.2) : frame(x, z, ry);
            acc.add(cyl(8), F.clone().multiply(mat(0, 0, 0, 0, 0.22, 0.45, 0.22)), { color: C('#6a4a3a'), inside: 1 });
            for (let i = 0; i < 4; i++) acc.add(cone(4), F.clone().multiply(mat(0, 0.45, 0, rr() * TAU, 0.02, rr.range(0.4, 0.9), 0.02, rr.range(0.3, 0.9))), { color: C('#4a3a24'), inside: 1 });
            return 0.25;
        },
    };

    const THEMES = {
        house: [['sofa', 'tv', 'table', 'chair', 'shelf', 'plant'], ['table', 'chair', 'chair', 'fridge', 'stove', 'counter'], ['bed', 'cabinet', 'shelf', 'chair']],
        flat: [['sofa', 'tv', 'table', 'chair', 'bed'], ['table', 'chair', 'fridge', 'stove'], ['crate', 'cabinet', 'shelf']],
        shop: [['shelf', 'shelf', 'shelf', 'counter', 'cart', 'crate']],
        office: [['desk', 'desk', 'desk', 'cabinet', 'cabinet', 'plant', 'chair']],
        tower: [['lobbyDesk', 'plant', 'sofa', 'plant'], ['desk', 'desk', 'cabinet', 'chair', 'plant']],
        warehouse: [['crate', 'crate', 'barrel', 'pallet', 'crate', 'machine', 'barrel']],
        shack: [['mattress', 'table', 'barrel', 'chair', 'crate']],
    };
    const themes = THEMES[kind] || THEMES.flat;
    rooms.forEach((rect, ri) => {
        const rw = rect.x1 - rect.x0, rd = rect.z1 - rect.z0, area = rw * rd;
        const theme = themes[ri % themes.length];
        const n = clamp(Math.round(area / 6), 2, 14);
        // big rooms keep a few pillars
        if ((kind === 'tower' || kind === 'office' || kind === 'warehouse') && rw > 9 && rd > 9) {
            for (let px = rect.x0 + 4; px < rect.x1 - 2; px += 6) for (let pz = rect.z0 + 4; pz < rect.z1 - 2; pz += 6) {
                if (clear.some((c) => Math.hypot(px - c.x, pz - c.z) < c.r + 0.6)) continue;
                acc.box(0.6, gH, 0.6, at(px, 0, pz), { color: C('#7a766c'), inside: 1, win: WALL_IN, seed: r() });
                col(px, pz, 0.42);
                placed.push({ x: px, z: pz, r: 0.6 });
            }
        }
        for (let i = 0; i < n; i++) {
            const name = i < theme.length ? theme[i] : r.pick(theme);
            // along a wall, facing into the room, or anywhere
            let x, z, ry;
            const sideK = r();
            const rad = name === 'sofa' || name === 'bed' || name === 'lobbyDesk' ? 1.2 : name === 'machine' ? 1.1 : 0.75;
            let ok = false;
            for (let tries = 0; tries < 8 && !ok; tries++) {
                if (sideK < 0.7) {
                    const s = r.int(0, 3);
                    if (s === 0) [x, z, ry] = [r.range(rect.x0 + rad, rect.x1 - rad), rect.z0 + rad * 0.7, 0];
                    else if (s === 1) [x, z, ry] = [r.range(rect.x0 + rad, rect.x1 - rad), rect.z1 - rad * 0.7, Math.PI];
                    else if (s === 2) [x, z, ry] = [rect.x0 + rad * 0.7, r.range(rect.z0 + rad, rect.z1 - rad), Math.PI / 2];
                    else [x, z, ry] = [rect.x1 - rad * 0.7, r.range(rect.z0 + rad, rect.z1 - rad), -Math.PI / 2];
                    ry += r.range(-0.25, 0.25);
                } else [x, z, ry] = [r.range(rect.x0 + rad, rect.x1 - rad), r.range(rect.z0 + rad, rect.z1 - rad), r() * TAU];
                ok = free(x, z, rad * 0.8, rect);
            }
            if (!ok) continue;
            const cr = ITEMS[name](x, z, ry, r);
            placed.push({ x, z, r: rad * 0.8 });
            if (cr > 0.1) col(x, z, cr);
        }
        // decay everywhere: rubble, a fallen panel or beam, a puddle, paper, wires
        const decay = clamp(Math.round(area / 14), 1, 6);
        for (let i = 0; i < decay; i++) {
            const x = r.range(rect.x0 + 0.6, rect.x1 - 0.6), z = r.range(rect.z0 + 0.6, rect.z1 - 0.6);
            if (!free(x, z, 0.6, rect)) continue;
            const k = r();
            if (k < 0.35) {
                const cr = ITEMS.rubble(x, z, 0, r);
                col(x, z, cr * 0.8);
                placed.push({ x, z, r: cr });
            } else if (k < 0.5) ITEMS.ceilingPanel(x, z, r() * TAU, r);
            else if (k < 0.6 && kind !== 'house') ITEMS.beam(x, z, r() * TAU, r);
            else if (k < 0.8) acc.add(sphere(10, 2), at(x, 0.005, z, r() * 3, r.range(0.4, 1.3), 0.004, r.range(0.4, 1.0)), { color: C('#101416'), inside: 1 });
            else {
                // wires and a strip of ceiling hanging down, moving in the draught
                const L = r.range(0.8, gH - 0.6);
                acc.add(tube([new V3(0, 0, 0), new V3(0.1, -L * 0.5, 0.05), new V3(-0.05, -L, 0.1)], 0.015, 4, 3), at(x, gH - 0.02, z), { color: C('#1a1a1a'), inside: 1, sway: 0.18, swayH: -L });
            }
        }
        // paper drifts in the corners
        const np = clamp(Math.round(area / 2.5), 4, 30);
        for (let i = 0; i < np; i++) {
            const x = r.range(rect.x0 + 0.15, rect.x1 - 0.15), z = r.range(rect.z0 + 0.15, rect.z1 - 0.15);
            acc.add(quad(), at(x, 0.008 + i * 0.0006, z, r() * TAU, 0.21, 1, 0.29), { color: C(r.pick(PAPER)).multiplyScalar(0.7 + r() * 0.3), inside: 1 });
        }
        // a light: a bare bulb or a strip light, flickering if it works at all
        if (r() < (kind === 'warehouse' || kind === 'tower' ? 0.55 : 0.4)) {
            const lx = (rect.x0 + rect.x1) / 2 + r.range(-0.5, 0.5), lz = (rect.z0 + rect.z1) / 2 + r.range(-0.5, 0.5);
            const works = r() < 0.6;
            const strip = kind !== 'house' && kind !== 'shack' && r() < 0.6;
            const fseed = works ? r.range(0.02, 1) : 0;
            const lc = strip ? C('#d8f0e8') : C('#ffd49a');
            if (strip) {
                const hang = r() < 0.3;
                acc.box(1.3, 0.06, 0.14, at(lx, gH - 0.12 - (hang ? 0.5 : 0), lz, r() * 0.3, 1, 1, 1, 0, hang ? 0.6 : 0), { color: works ? lc : C('#5a5a5a'), glow: works ? 2.2 : 0, flick: fseed, inside: 1 });
            } else {
                acc.add(cyl(4), at(lx, gH - 0.6, lz, 0, 0.008, 0.6, 0.008), { color: C('#111'), inside: 1, sway: 0.03, swayH: 0.6 });
                acc.add(sphere(6, 4), at(lx, gH - 0.65, lz, 0, 0.06), { color: works ? lc : C('#4a4a40'), glow: works ? 3 : 0, flick: fseed, inside: 1 });
            }
            if (works) light(lx, gH - 0.5, lz, { color: strip ? 0xc8f0e0 : 0xffc890, flick: fseed, power: strip ? 1.3 : 1, range: Math.min(10, Math.max(rw, rd) + 2) });
        }
    });
}
