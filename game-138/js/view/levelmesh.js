// A level's geometry, built from its micro grid: floors, walls, the diorama's caps and earthy sides, the ceiling
// (first person only), sunken water, wells (interior-mapped shafts), stairs, waterfalls, peek windows (interior
// mapping) and the anchors where lights and flames go. Reads the level; never changes it.
//
// Micro cell (mx, my) spans x ∈ [mx·M, (mx+1)·M], z ∈ [my·M, (my+1)·M]; y is up, the floor is y = 0.

import * as THREE from 'three';
import { MICRO as M, WALL_H } from '../config.js';
import { themeMaterials, waterMaterial, waterfallMaterial } from './materials.js';
import { interiorMaterial } from './interior.js';
import { ELEMENTS } from '../sim/data/elements.js';

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const WATER_Y = -0.42, WATER_SURF = -0.12, BLOCK_BOTTOM = -1.8;

/** Accumulates quads per material key, then makes one mesh per key. */
class Builder {
    constructor() { this.parts = {}; }
    part(k) { return (this.parts[k] ||= { pos: [], nrm: [], uv: [], col: [] }); }
    /** Four corners, counter-clockwise seen from the front. uvs: [u, v] × 4; ao: one shade per corner. */
    quad(k, p, n, uvs, ao = [1, 1, 1, 1]) {
        const q = this.part(k);
        for (const i of [0, 1, 2, 0, 2, 3]) {
            q.pos.push(p[i][0], p[i][1], p[i][2]);
            q.nrm.push(n[0], n[1], n[2]);
            q.uv.push(uvs[i][0], uvs[i][1]);
            q.col.push(ao[i], ao[i], ao[i]);
        }
    }
    /** A horizontal quad over [x0, x1] × [z0, z1] at height y, facing up (or down). UVs are world metres / 2. */
    flat(k, x0, z0, x1, z1, y, down = false, ao) {
        const p = [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]];
        const uv = p.map((v) => [v[0] / 2, -v[2] / 2]);
        const a = ao || [1, 1, 1, 1];
        if (down) this.quad(k, [p[3], p[2], p[1], p[0]], [0, -1, 0], [uv[3], uv[2], uv[1], uv[0]], [a[3], a[2], a[1], a[0]]);
        else this.quad(k, p, [0, 1, 0], uv, a);
    }
    /** A vertical quad centred on (cx, cz), `width` wide, from y0 to y1, facing (nx, nz). */
    wall(k, cx, cz, nx, nz, width, y0, y1, aoBottom = 0.6) {
        const dx = nz, dz = -nx;                   // along the wall, so the normal comes out of the front
        const ax = cx - dx * width / 2, az = cz - dz * width / 2, bx = cx + dx * width / 2, bz = cz + dz * width / 2;
        const ua = (ax * dx + az * dz) / 2, ub = ua + width / 2;
        this.quad(k, [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [nx, 0, nz],
            [[ua, y0 / 2], [ub, y0 / 2], [ub, y1 / 2], [ua, y1 / 2]], [aoBottom, aoBottom, 1, 1]);
    }
    /** An axis-aligned box (all six faces), for steps, rims and frames. */
    box(k, x0, y0, z0, x1, y1, z1) {
        this.flat(k, x0, z0, x1, z1, y1);
        this.flat(k, x0, z0, x1, z1, y0, true);
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
        this.wall(k, cx, z1, 0, 1, w, y0, y1, 0.85);
        this.wall(k, cx, z0, 0, -1, w, y0, y1, 0.85);
        this.wall(k, x1, cz, 1, 0, d, y0, y1, 0.85);
        this.wall(k, x0, cz, -1, 0, d, y0, y1, 0.85);
    }
    meshes(mats) {
        const out = [];
        for (const [k, q] of Object.entries(this.parts)) {
            if (!mats[k]) continue;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(q.nrm, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
            g.setAttribute('color', new THREE.Float32BufferAttribute(q.col, 3));
            g.computeBoundingSphere();
            const m = new THREE.Mesh(g, mats[k]);
            m.name = k;
            out.push(m);
        }
        return out;
    }
}

/**
 * Build level L. Returns { group, ceiling, lights: [{ x, y, z, color, range, fire, kind }], flames: [...], splashes: [...] }
 * group holds everything; ceiling is a separate mesh (shown in first person only).
 */
export function buildLevel(L) {
    const mats = themeMaterials(L.theme);
    const look = mats.look;
    const b = new Builder();
    const at = (x, y) => (x < 0 || y < 0 || x >= L.mw || y >= L.mh ? '#' : L.grid[y][x]);
    const solid = (ch) => ch === '#';
    const lights = [], flames = [], splashes = [];
    const group = new THREE.Group();
    group.name = 'level-' + L.k;

    // ambient occlusion at a floor corner: how much rock touches it
    const cornerAO = (cx, cy) => {
        let r = 0;
        for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (solid(at(cx + ox, cy + oy))) r++;
        return 1 - r * 0.17;
    };

    for (let my = 0; my < L.mh; my++) {
        for (let mx = 0; mx < L.mw; mx++) {
            const ch = at(mx, my);
            const x0 = mx * M, z0 = my * M, x1 = x0 + M, z1 = z0 + M;
            const cx = x0 + M / 2, cz = z0 + M / 2;
            if (solid(ch)) { b.flat('cap', x0, z0, x1, z1, WALL_H); continue; }
            const ao = [cornerAO(mx, my + 1), cornerAO(mx + 1, my + 1), cornerAO(mx + 1, my), cornerAO(mx, my)];
            const floorY = ch === '~' ? WATER_Y : 0;
            if (ch === '.') b.flat('floor', x0, z0, x1, z1, 0, false, ao);
            else if (ch === '~') b.flat('under', x0, z0, x1, z1, WATER_Y, false, ao);
            if (ch !== '^') b.flat('ceil', x0, z0, x1, z1, WALL_H, true);
            for (let d = 0; d < 4; d++) {
                const n = at(mx + DX[d], my + DY[d]);
                const ex = cx + DX[d] * M / 2, ez = cz + DY[d] * M / 2;
                if (solid(n)) b.wall('wall', ex, ez, -DX[d], -DY[d], M, floorY, WALL_H);
                // the step down into water, seen from the water side
                else if (ch === '~' && n !== '~') b.wall('trim', ex, ez, -DX[d], -DY[d], M, WATER_Y, 0, 0.7);
            }
            if (ch === 'o') buildWell(b, group, cx, cz, L, mx, my, at);
            if (ch === 'v') buildStairsDown(b, cx, cz, mx, my, at);
            if (ch === '^') buildStairsUp(b, cx, cz, mx, my, at, L.k === 0);
        }
    }

    // the diorama's earthy sides
    const W = L.mw * M, H = L.mh * M;
    const side = (cx, cz, nx, nz, w) => {
        const dx = nz, dz = -nx;
        const ax = cx - dx * w / 2, az = cz - dz * w / 2, bx = cx + dx * w / 2, bz = cz + dz * w / 2;
        const ua = (ax * dx + az * dz) / 4, ub = ua + w / 4;
        b.quad('side', [[ax, BLOCK_BOTTOM, az], [bx, BLOCK_BOTTOM, bz], [bx, WALL_H, bz], [ax, WALL_H, az]], [nx, 0, nz],
            [[ua, 0], [ub, 0], [ub, 1.25], [ua, 1.25]]);
    };
    side(W / 2, H, 0, 1, W); side(W / 2, 0, 0, -1, W); side(W, H / 2, 1, 0, H); side(0, H / 2, -1, 0, H);

    // water surfaces: one plane per water micro, slightly above the sunken floor
    const water = new Builder();
    for (let my = 0; my < L.mh; my++) for (let mx = 0; mx < L.mw; mx++) {
        if (at(mx, my) === '~') water.flat('water', mx * M, my * M, (mx + 1) * M, (my + 1) * M, WATER_SURF);
    }

    // waterfalls pour out of the wall into each spout's water
    const fallMat = waterfallMaterial(look.water);
    for (const s of L.spouts) {
        const cx = (s.mx + 0.5) * M, cz = (s.my + 0.5) * M;
        const ex = cx + DX[s.dir] * (M / 2 - 0.04), ez = cz + DY[s.dir] * (M / 2 - 0.04);
        const g = new THREE.PlaneGeometry(1.1, WALL_H - 0.4 - WATER_SURF);
        const fall = new THREE.Mesh(g, fallMat);
        fall.position.set(ex, (WALL_H - 0.4 + WATER_SURF) / 2, ez);
        fall.rotation.y = Math.atan2(-DX[s.dir], -DY[s.dir]);
        fall.name = 'waterfall';
        group.add(fall);
        // the stone lip it spills from
        const lx = ex - DX[s.dir] * 0.12, lz = ez - DY[s.dir] * 0.12;
        b.box('trim', lx - 0.7, WALL_H - 0.5, lz - 0.7 + (DX[s.dir] ? 0.4 : 0.55), lx + 0.7, WALL_H - 0.35, lz + 0.7 - (DX[s.dir] ? 0.4 : 0.55));
        splashes.push({ x: cx + DX[s.dir] * (M / 2 - 0.4), y: WATER_SURF, z: cz + DY[s.dir] * (M / 2 - 0.4) });
    }

    // torches and peek windows on the walls
    for (const f of L.features) {
        if (f.kind !== 'torch' && f.kind !== 'window') continue;
        const cx = (f.mx + 0.5) * M, cz = (f.my + 0.5) * M;
        const nx = -DX[f.dir], nz = -DY[f.dir];
        const ex = cx + DX[f.dir] * M / 2, ez = cz + DY[f.dir] * M / 2;
        if (f.kind === 'torch') {
            const px = ex + nx * 0.18, pz = ez + nz * 0.18;
            b.box('iron', px - 0.06, 1.55, pz - 0.06, px + 0.06, 1.95, pz + 0.06);
            b.box('iron', Math.min(ex, px) - 0.04, 1.7, Math.min(ez, pz) - 0.04, Math.max(ex, px) + 0.04, 1.78, Math.max(ez, pz) + 0.04);
            flames.push({ x: px, y: 2.05, z: pz, s: 0.5 });
            lights.push({ x: px + nx * 0.4, y: 2.1, z: pz + nz * 0.4, color: look.light, range: 7, fire: 1, kind: 'torch', id: f.id });
        } else {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), interiorMaterial(f.nook, { depth: 1.8, glow: 1 }));
            win.position.set(ex + nx * 0.015, 1.45, ez + nz * 0.015);
            win.rotation.y = Math.atan2(nx, nz);
            win.scale.set(1.25, 1.05, 1);
            win.name = 'window';
            win.userData.id = f.id;
            group.add(win);
            // frame and bars
            const dx = nz, dz = -nx, hw = 0.7;
            const fx = ex + nx * 0.06, fz = ez + nz * 0.06;
            const bar = (ox, y0, y1, t) => b.box('wood', fx + dx * ox - t - Math.abs(nx) * 0.05, y0, fz + dz * ox - t - Math.abs(nz) * 0.05, fx + dx * ox + t + Math.abs(nx) * 0.05, y1, fz + dz * ox + t + Math.abs(nz) * 0.05);
            bar(-hw, 0.85, 2.05, 0.07); bar(hw, 0.85, 2.05, 0.07);
            const beam = (y) => b.box('wood', Math.min(fx - dx * hw, fx + dx * hw) - 0.07 - Math.abs(nx) * 0.05, y - 0.07, Math.min(fz - dz * hw, fz + dz * hw) - 0.07 - Math.abs(nz) * 0.05,
                Math.max(fx - dx * hw, fx + dx * hw) + 0.07 + Math.abs(nx) * 0.05, y + 0.07, Math.max(fz - dz * hw, fz + dz * hw) + 0.07 + Math.abs(nz) * 0.05);
            beam(0.88); beam(2.02);
            for (const ox of [-0.32, 0, 0.32]) {
                const bx = fx + dx * ox + nx * 0.04, bz = fz + dz * ox + nz * 0.04;
                b.box('iron', bx - 0.025, 0.9, bz - 0.025, bx + 0.025, 2.0, bz + 0.025);
            }
            lights.push({ x: ex + nx * 0.6, y: 1.5, z: ez + nz * 0.6, color: 0xffc27a, range: 4, fire: 0.3, kind: 'window', id: f.id });
        }
    }

    // light from the glowing elements
    for (const f of L.features) {
        const e = ELEMENTS[f.kind];
        if (!e?.glow) continue;
        const cx = (f.mx + 0.5) * M, cz = (f.my + 0.5) * M;
        lights.push({ x: cx, y: Math.max(1, e.h + 0.4), z: cz, color: e.glow[0], range: e.glow[1] * 1.6, fire: e.fire ? 1 : 0.15, kind: f.kind, id: f.id });
        if (e.fire) flames.push({ x: cx, y: f.kind === 'campfire' ? 0.35 : e.h * 0.95, z: cz, s: e.fire * 0.9 });
        if (f.kind === 'candles') flames.push({ x: cx, y: e.h * 0.9, z: cz, s: 0.35 });
    }
    // a lamp at each stairwell so the way on is always easy to spot
    for (const s of [L.up, L.down]) if (s) lights.push({ x: (s.mx + 0.5) * M, y: 2.4, z: (s.my + 0.5) * M, color: 0xffd58a, range: 8, fire: 0.2, kind: 'stairs' });

    const meshMats = { ...mats, wood: woodMat(), iron: ironMat() };
    for (const m of b.meshes(meshMats)) {
        if (m.name === 'ceil') continue;
        group.add(m);
    }
    const ceiling = b.meshes({ ceil: mats.ceil })[0];
    ceiling.visible = false;
    group.add(ceiling);
    const wm = water.meshes({ water: waterMaterial(look.water) })[0];
    if (wm) { wm.renderOrder = 2; group.add(wm); }
    return { group, ceiling, lights, flames, splashes };
}

let wood = null, iron = null;
const woodMat = () => wood || (wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8, vertexColors: true }));
const ironMat = () => iron || (iron = new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.5, metalness: 0.4, vertexColors: true }));

function buildWell(b, group, cx, cz) {
    // a low stone rim round the hole, and the hole itself: an interior-mapped shaft going down
    const r = M / 2, t = 0.22, h = 0.5;
    b.box('trim', cx - r + 0.1, 0, cz - r + 0.1, cx + r - 0.1, h, cz - r + 0.1 + t);
    b.box('trim', cx - r + 0.1, 0, cz + r - 0.1 - t, cx + r - 0.1, h, cz + r - 0.1);
    b.box('trim', cx - r + 0.1, 0, cz - r + 0.1 + t, cx - r + 0.1 + t, h, cz + r - 0.1 - t);
    b.box('trim', cx + r - 0.1 - t, 0, cz - r + 0.1 + t, cx + r - 0.1, h, cz + r - 0.1 - t);
    b.flat('floor', cx - r, cz - r, cx + r, cz - r + 0.1, 0);
    b.flat('floor', cx - r, cz + r - 0.1, cx + r, cz + r, 0);
    b.flat('floor', cx - r, cz - r + 0.1, cx - r + 0.1, cz + r - 0.1, 0);
    b.flat('floor', cx + r - 0.1, cz - r + 0.1, cx + r, cz + r - 0.1, 0);
    const inner = M - 0.2 - t * 2;
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), interiorMaterial('well', { depth: 7, glow: 0, shaft: 1 }));
    shaft.rotation.x = -Math.PI / 2;
    shaft.position.set(cx, 0.3, cz);
    shaft.scale.set(inner, inner, 1);
    shaft.name = 'well';
    group.add(shaft);
}

/** The direction from a stairwell to its most open neighbour (stairs run that way). */
function stairDir(mx, my, at) {
    let best = 0, bo = -1;
    for (let d = 0; d < 4; d++) {
        let open = 0;
        for (let k = 1; k <= 3; k++) { const ch = at(mx + DX[d] * k, my + DY[d] * k); if (ch === '#' || ch === 'o') break; open++; }
        if (open > bo) { bo = open; best = d; }
    }
    return best;
}

function buildStairsDown(b, cx, cz, mx, my, at) {
    // steps that sink from the floor towards the far side of the stairwell, inside a little stone box
    const d = stairDir(mx, my, at), r = M / 2, depth = 2.6, n = 7;
    const ax = DX[d], az = DY[d];
    for (let i = 0; i < n; i++) {
        const y = -((i + 1) / n) * depth;
        const a0 = r - (i / n) * M, a1 = r - ((i + 1) / n) * M;       // from the open side to the back
        const sx0 = cx + ax * a0, sz0 = cz + az * a0, sx1 = cx + ax * a1, sz1 = cz + az * a1;
        const px = Math.abs(az) * r, pz = Math.abs(ax) * r;
        b.box('trim', Math.min(sx0, sx1) - px, y - 0.2, Math.min(sz0, sz1) - pz, Math.max(sx0, sx1) + px, y, Math.max(sz0, sz1) + pz);
    }
    for (let k = 0; k < 4; k++) b.wall('trim', cx + DX[k] * r, cz + DY[k] * r, -DX[k], -DY[k], M, -depth - 0.2, 0, 0.3);
    b.flat('under', cx - r, cz - r, cx + r, cz + r, -depth - 0.2);
}

function buildStairsUp(b, cx, cz, mx, my, at, top) {
    // steps rising from the floor to the ceiling, climbing away from the open side
    const d = stairDir(mx, my, at), r = M / 2, n = 8, rise = WALL_H;
    const ax = DX[d], az = DY[d];
    b.flat('floor', cx - r, cz - r, cx + r, cz + r, 0);
    for (let i = 0; i < n; i++) {
        const y = ((i + 1) / n) * rise;
        const a0 = r - (i / n) * M, a1 = r - ((i + 1) / n) * M;
        const sx0 = cx + ax * a0, sz0 = cz + az * a0, sx1 = cx + ax * a1, sz1 = cz + az * a1;
        const px = Math.abs(az) * (r - 0.4), pz = Math.abs(ax) * (r - 0.4);
        // each step a slab with a short riser under it, so the staircase reads as steps and not a ramp of wall
        b.box(top ? 'wood' : 'trim', Math.min(sx0, sx1) - px, Math.max(0, y - 0.55), Math.min(sz0, sz1) - pz, Math.max(sx0, sx1) + px, y, Math.max(sz0, sz1) + pz);
    }
}
