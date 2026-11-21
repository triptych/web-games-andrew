// One level of one building as meshes: floors, ceilings and their fluorescent panels, both faces of every wall
// (doors, windows, broken walls, railings, shop glass), stair runs, holes, furniture and decay. Built when the walker
// comes near and thrown away when they leave; everything comes from the sim's interior data (read only).

import * as THREE from 'three';
import { TILE, WALL_T, DOOR_GAP } from '../config.js';
import { E, F, WALLS, FLOORS, CEILS, getEdge, edgeLock } from '../sim/interior.js';
import { lockKind } from '../sim/world.js';
import { Kit } from './kit.js';
import { surface, plain, decal } from './tex.js';
import { buildProp } from './props.js';
import { modelFor, addVehicles } from './vehicles.js';

const WALL_TEX = { yellow: 'yellow', floral: 'floral', plaster: 'plaster', concrete: 'concrete', tile: 'tile', lab: 'lab', brick: 'brick', rust: 'rust' };
const FLOOR_TEX = { carpet: 'carpet', wood: 'wood', tile: 'tile', terrazzo: 'terrazzo', concrete: 'fconcrete', lino: 'lino' };
const REP = { yellow: 2.4, floral: 2.2, plaster: 3, concrete: 3, tile: 2, lab: 2.4, brick: 2.6, rust: 3, carpet: 3, wood: 2.5, terrazzo: 3, fconcrete: 4, lino: 2, ceiling: 1.2 };

/** Where a window sits in a wall of floor height H: [sill, top] above the floor. Shared with the city shell. */
export function windowSpan(H, type) {
    if (type === 'factory' || type === 'warehouse' || type === 'hall') return [H * 0.55, H * 0.88];
    if (type === 'garage') return [1.05, H - 0.3];
    return [Math.min(0.9, H * 0.3), Math.min(H - 0.45, 2.35)];
}
export const DOOR_H = 2.15;

const hash = (a, b, c = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); };

export function buildLevel(G, I, L, opts = {}) {
    const K = new Kit();
    const b = I.b, lv = I.levels[L], H = I.H, w = I.w, d = I.d;
    const ox = I.x0, oz = I.z0, y0 = L * H;
    const lamps = [];
    const roomOf = (x, z) => (x < 0 || z < 0 || x >= w || z >= d) ? null : lv.room[z * w + x] === -2 ? lv.rooms[lv.stairRoom] : lv.rooms[lv.room[z * w + x]] ?? lv.rooms[0];
    const flags = (x, z) => lv.flags[z * w + x];
    const floorM = (f) => surface(FLOOR_TEX[FLOORS[f]] ?? 'fconcrete', { bump: 0.4 });
    const wallM = (r) => surface(WALL_TEX[WALLS[r?.wall ?? 2]] ?? 'plaster', { bump: 0.35 });
    const wallRep = (r) => REP[WALL_TEX[WALLS[r?.wall ?? 2]]] ?? 3;
    const decayK = b.decay;
    const top = L === I.floors - 1;
    const roof = I.theme.ceil === 'open' || (top && b.type === 'garage');

    // ------------------------------------------------------------ floors and ceilings
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        const i = z * w + x, f = lv.flags[i];
        const X0 = ox + x * TILE, Z0 = oz + z * TILE, X1 = X0 + TILE, Z1 = Z0 + TILE;
        const room = roomOf(x, z);
        // corner shading: darker where walls meet the floor
        const wallOn = (dir) => { const e = getEdge(I, lv, x, z, dir); return e === E.WALL || e === E.WINDOW || e === E.GLASS; };
        const nN = wallOn(0), nE = wallOn(1), nS = wallOn(2), nW = wallOn(3);
        const ao = (a, b2) => { const k = 1 - (a ? 0.28 : 0) - (b2 ? 0.28 : 0); return k; };
        const mold = f & F.MOLD ? 0.82 : 1;
        const tint = (k) => [k * mold * (room?.backrooms ? 1 : 0.95), k * mold, k * mold * (f & F.MOLD ? 0.9 : 0.95)];
        const cols = [tint(ao(nS, nW)), tint(ao(nS, nE)), tint(ao(nN, nE)), tint(ao(nN, nW))];
        if (lv.floor[i] > 0 && !(f & (F.VOID | F.VOIDSTAIR | F.HOLE | F.STAIR))) {
            const r = REP[FLOOR_TEX[FLOORS[lv.floor[i]]]] ?? 3;
            const yy = y0 + (f & F.SINK ? -0.1 : 0) + 0.002;
            K.quad(floorM(lv.floor[i]), [X0, yy, Z1], [X1, yy, Z1], [X1, yy, Z0], [X0, yy, Z0], [[X0 / r, Z1 / r], [X1 / r, Z1 / r], [X1 / r, Z0 / r], [X0 / r, Z0 / r]], cols);
        }
        if (f & F.HOLE) brokenEdges(K, X0, Z0, y0, hash(x, z, L));
        // the underside of this floor, seen from the level below (through atriums, stairwells, holes in its ceiling)
        if (L > 0 && lv.floor[i] > 0 && !(f & (F.VOID | F.VOIDSTAIR | F.HOLE))) K.quad(surface('concrete', { bump: 0.3 }), [X0, y0 - 0.04, Z0], [X1, y0 - 0.04, Z0], [X1, y0 - 0.04, Z1], [X0, y0 - 0.04, Z1], [[X0 / 3, Z0 / 3], [X1 / 3, Z0 / 3], [X1 / 3, Z1 / 3], [X0 / 3, Z1 / 3]], [0.35, 0.35, 0.34]);
        // the roof, from inside, over the top floor
        if (top) {
            const ry = y0 + H - 0.01;
            const sky = lv.atriumRect && x >= lv.atriumRect.x && x < lv.atriumRect.x + lv.atriumRect.w && z >= lv.atriumRect.z && z < lv.atriumRect.z + lv.atriumRect.d;
            const atriumAbove = b.type === 'mall' && I.levels[0].atrium && (() => { const a = I.levels[0].atrium; return x >= a.x && x < a.x + a.w && z >= a.z && z < a.z + a.d; })();
            if (sky || atriumAbove) skylight(K, X0, Z0, ry + 1.2, hash(x, z, 77));
            else K.quad(surface('rust', { bump: 0.4 }), [X0, ry, Z0], [X1, ry, Z0], [X1, ry, Z1], [X0, ry, Z1], [[X0 / 3, Z0 / 3], [X1 / 3, Z0 / 3], [X1 / 3, Z1 / 3], [X0 / 3, Z1 / 3]], [0.3, 0.29, 0.28]);
            if (roof && x % 4 === 0 && z === 0) truss(K, ox + x * TILE + 1, oz, d * TILE, ry - 0.05);
        }
        // the ceiling
        const ceilType = CEILS[room?.ceil ?? 1];
        const noCeil = f & (F.STAIR | F.NOCEIL | F.VOID | F.TREE) || ceilType === 'open' || (top && roof);
        if (!noCeil) {
            const ch = y0 + H - (ceilType === 'tiles' ? 0.25 : 0.02);
            const tx = ceilType === 'tiles' ? 'ceiling' : ceilType === 'concrete' ? 'concrete' : 'plaster';
            const r = REP[tx] ?? 3;
            const cc = [0.8 * mold, 0.8 * mold, 0.78 * mold];
            K.quad(surface(tx, { bump: 0.3 }), [X0, ch, Z0], [X1, ch, Z0], [X1, ch, Z1], [X0, ch, Z1], [[X0 / r, Z0 / r], [X1 / r, Z0 / r], [X1 / r, Z1 / r], [X0 / r, Z1 / r]], cc);
            if (ceilType === 'tiles') {
                // the plenum above a dropped ceiling, seen through missing tiles
                if (hash(x, z, L + 7) < 0.06 + decayK * 0.1) ceilingGap(K, X0, Z0, ch, y0 + H, hash(x, z, L + 3));
            }
            if (f & F.LAMP && !(f & F.SOLID && false)) {
                const lit = room?.lit && I.power;
                const broken = hash(x, z, L + 11) < 0.25 + decayK * 0.2;
                const cx = X0 + TILE / 2, cz = Z0 + TILE / 2;
                if (broken && hash(x, z, L + 12) < 0.5) {
                    // a fitting hanging by one chain
                    K.tube(plain('metal'), [cx - 0.5, ch, cz], [cx - 0.6, ch - 0.9, cz + 0.1], 0.008, 4, [0.3, 0.3, 0.3]);
                    K.at(cx - 0.2, ch - 0.85, cz, 0.3, () => K.box(plain('metal'), 0, 0, 0, 1.2, 0.08, 0.3, [0.7, 0.7, 0.66]));
                } else {
                    const glow = lit && !broken;
                    K.quad(glow ? plain('glow') : plain('paint'), [cx - 0.3, ch - 0.015, cz - 0.6], [cx + 0.3, ch - 0.015, cz - 0.6], [cx + 0.3, ch - 0.015, cz + 0.6], [cx - 0.3, ch - 0.015, cz + 0.6],
                        [[0, 0], [1, 0], [1, 1], [0, 1]], glow ? (room?.backrooms ? [1.6, 1.45, 0.95] : [1.5, 1.5, 1.35]) : [0.55, 0.55, 0.5]);
                    if (glow) lamps.push({ x: cx, y: ch - 0.1, z: cz, back: !!room?.backrooms, flick: hash(x, z, L + 13) < 0.3 });
                }
            }
        }
        if (f & F.NOCEIL && !(f & (F.STAIR | F.TREE)) && !top && ceilType !== 'open') ceilingGap(K, X0, Z0, y0 + H - 0.25, y0 + H, hash(x, z, L + 5), true);
        // dressing on the floor
        if (f & F.PUDDLE) K.flat(waterMat(), X0 + 1, y0 + 0.012, Z0 + 1, 1.4 + hash(x, z) * 0.5, 1.2 + hash(z, x) * 0.6, hash(x, z, 2) * 3, [1, 1, 1]);
        if (f & F.RUBBLE) buildProp(K, { k: 'debris', x: X0 + 1, z: Z0 + 1, r: 0, big: hash(x, z, 3) < 0.4 }, 0, y0, 0);
        if (f & F.DEBRIS) buildProp(K, { k: 'papers', x: X0 + 1, z: Z0 + 1, r: 0 }, 0, y0, 0);
        if (f & F.LEAVES && !(f & (F.VOID | F.HOLE))) K.flat(decal('d-leaves', 'alpha'), X0 + 1, y0 + 0.01, Z0 + 1, 2.0, 2.0, hash(x, z, 4) * 6, [1, 1, 1]);
        if (f & F.MOLD && !(f & (F.VOID | F.VOIDSTAIR | F.HOLE | F.STAIR)) && hash(x, z, 9) < 0.5) K.flat(decal('d-mold'), X0 + 1, y0 + 0.008, Z0 + 1, 1.9, 1.9, hash(x, z, 6) * 6, [1, 1, 1]);
        if (f & F.STAIR) stairRun(K, I, lv, x, z, X0, Z0, y0, H);
    }

    // ------------------------------------------------------------ walls
    const T2 = WALL_T / 2;
    const doWall = (x, z, dir) => {
        // the edge between tile (x, z) and its neighbour in dir: build the face on each side that is inside
        const e = getEdge(I, lv, x, z, dir);
        if (e === E.NONE) return;
        const nx = x + [0, 1, 0, -1][dir], nz = z + [-1, 0, 1, 0][dir];
        const aIn = x >= 0 && z >= 0 && x < w && z < d, bIn = nx >= 0 && nz >= 0 && nx < w && nz < d;
        // the edge line in world coords, running from p0 to p1
        let p0, p1, nrm;
        if (dir === 0) { p0 = [ox + x * TILE, oz + z * TILE]; p1 = [p0[0] + TILE, p0[1]]; nrm = [0, 1]; }
        else { p0 = [ox + (x + 1) * TILE, oz + z * TILE]; p1 = [p0[0], p0[1] + TILE]; nrm = [-1, 0]; }
        // side A is the tile (x, z) (normal points into it for dir 0: +z; dir 1: -x)
        const sides = [];
        if (aIn) sides.push({ room: roomOf(x, z), s: 1, tile: [x, z] });
        if (bIn) sides.push({ room: roomOf(nx, nz), s: -1, tile: [nx, nz] });
        const lock = e === E.DOOR ? edgeLock(I, lv, x, z, dir) : null;
        const open = lock ? G.openSet.has(lock) : true;
        for (const side of sides) {
            const n = [nrm[0] * side.s, nrm[1] * side.s];
            const off = [n[0] * T2, n[1] * T2];
            const a = [p0[0] + off[0], p0[1] + off[1]], c = [p1[0] + off[0], p1[1] + off[1]];
            const m = wallM(side.room), rep = wallRep(side.room);
            const face = (u0, u1, h0, h1, tintBottom = 0.55) => wallFace(K, m, rep, a, c, n, u0, u1, y0 + h0, y0 + h1, tintBottom, y0, H);
            if (e === E.WALL) face(0, 1, 0, H);
            else if (e === E.WINDOW) { const [s0, s1] = windowSpan(H, b.type); face(0, 1, 0, s0); face(0, 1, s1, H); }
            else if (e === E.DOOR) {
                const g = DOOR_GAP / TILE / 2;
                face(0, 0.5 - g, 0, H); face(0.5 + g, 1, 0, H); face(0.5 - g, 0.5 + g, Math.min(DOOR_H, H), H);
            } else if (e === E.BROKEN) {
                const hh = 0.25 + hash(x, z, dir + L * 4) * 0.9;
                face(0, 0.18, 0, H * (0.55 + hash(z, x, dir) * 0.4)); face(0.82, 1, 0, H * (0.5 + hash(x, dir, z) * 0.45));
                face(0.18, 0.82, 0, hh);
                if (hash(x, z, dir + 9) < 0.6) face(0.18, 0.82, H - 0.5 - hash(dir, x, z) * 0.6, H);
            } else if (e === E.GLASS) {
                face(0, 1, 0, 0.35); face(0, 1, Math.min(H - 0.2, 2.7), H);
            }
            // a mould bloom or a water stain on this face
            const [tx, tz] = side.tile;
            if (e !== E.RAIL && (flags(tx, tz) & F.MOLD) && hash(tx, tz, dir + 31) < 0.6) {
                const u = 0.2 + hash(tx, dir, tz) * 0.6, s = 0.9 + hash(dir, tz, tx) * 1.2;
                decalOnWall(K, decal(hash(tx, tz, dir) < 0.5 ? 'd-mold' : 'd-stain'), a, c, n, u, y0 + (hash(tx, tz, 2) < 0.5 ? s / 2 + 0.02 : H - s / 2 - 0.3), s);
            } else if ((e === E.WALL) && hash(tx, tz, dir + 41) < 0.05 + decayK * 0.08) {
                decalOnWall(K, decal('d-cracks'), a, c, n, 0.5, y0 + 1.4, 1.6);
            } else if (e === E.WALL && hash(tx, tz, dir + 51) < 0.012 + decayK * 0.015) {
                decalOnWall(K, decal('d-graffiti', 'alpha'), a, c, n, 0.5, y0 + 1.4, 1.5);
            } else if (e === E.WALL && side.room?.kind === 'store' && hash(tx, tz, dir + 61) < 0.25) {
                decalOnWall(K, decal('poster' + Math.floor(hash(tx, dir, tz) * 4), 'alpha'), a, c, n, 0.5, y0 + 1.5, 1.3);
            }
        }
        if (e === E.RAIL) railing(K, p0, p1, y0);
        if (e === E.GLASS) shopGlass(K, p0, p1, y0, Math.min(H - 0.2, 2.7));
        if (e === E.DOOR) doorLeaf(K, p0, p1, nrm, y0, x, z, dir, L, lock, open, lock ? lockKind(G.city, lock) : null);
        if (e === E.BROKEN) buildProp(K, { k: 'debris', x: (p0[0] + p1[0]) / 2, z: (p0[1] + p1[1]) / 2, r: 0 }, 0, y0, 0);
        // the top of a wall that stops short of the ceiling (a railing, a broken wall) needs no cap; full walls meet the ceiling
    };
    for (let z = 0; z <= d; z++) for (let x = 0; x < w; x++) doWall(x, z, 0);
    for (let z = 0; z < d; z++) for (let x = -1; x < w; x++) {
        // eW of tile (x + 1, z) is the edge between x and x + 1: ask it as dir 1 of tile x
        if (x < 0) { const e = getEdge(I, lv, 0, z, 3); if (e !== E.NONE) doWallW(0, z); continue; }
        doWall(x, z, 1);
    }
    function doWallW(x, z) {
        // the west perimeter: ask from the inside tile as its west edge, then reuse the dir-1 code from a virtual tile
        const e = getEdge(I, lv, x, z, 3);
        const save = e;
        void save;
        // a virtual tile at x - 1 would be outside; build the face directly
        const p0 = [ox, oz + z * TILE], p1 = [ox, oz + (z + 1) * TILE], n = [1, 0];
        const room = roomOf(x, z), m = wallM(room), rep = wallRep(room);
        const a = [p0[0] + n[0] * T2, p0[1]], c = [p1[0] + n[0] * T2, p1[1]];
        const face = (u0, u1, h0, h1) => wallFace(K, m, rep, a, c, n, u0, u1, y0 + h0, y0 + h1, 0.55, y0, H);
        if (e === E.WINDOW) { const [s0, s1] = windowSpan(H, b.type); face(0, 1, 0, s0); face(0, 1, s1, H); }
        else if (e === E.DOOR) { const g = DOOR_GAP / TILE / 2; face(0, 0.5 - g, 0, H); face(0.5 + g, 1, 0, H); face(0.5 - g, 0.5 + g, DOOR_H, H); const lock = edgeLock(I, lv, x, z, 3); doorLeaf(K, p0, p1, [1, 0], y0, x, z, 3, L, lock, lock ? G.openSet.has(lock) : true, lock ? lockKind(G.city, lock) : null); }
        else if (e === E.GLASS) { face(0, 1, 0, 0.35); face(0, 1, 2.7, H); shopGlass(K, p0, p1, y0, 2.7); }
        else face(0, 1, 0, H);
    }

    // ------------------------------------------------------------ furniture
    const cars = [];
    for (const p of lv.props) {
        if (p.k === 'pcar' && modelFor({ ...p, x: ox + p.x, z: oz + p.z })) cars.push({ ...p, x: ox + p.x, y: y0, z: oz + p.z });
        else buildProp(K, p, ox, y0, oz);
    }
    let g = K.build({ name: `b${b.id}L${L}` });
    if (cars.length) { g ??= new THREE.Group(); addVehicles(g, cars); }
    return { group: g, lamps };
}

// ------------------------------------------------------------------ pieces

function wallFace(K, m, rep, a, c, n, u0, u1, h0, h1, tintBottom, floorY, H) {
    if (h1 - h0 < 0.01 || u1 - u0 < 0.001) return;
    const x0 = a[0] + (c[0] - a[0]) * u0, z0 = a[1] + (c[1] - a[1]) * u0;
    const x1 = a[0] + (c[0] - a[0]) * u1, z1 = a[1] + (c[1] - a[1]) * u1;
    // orient so the face points along n
    const cross = (x1 - x0) * n[1] - (z1 - z0) * n[0];
    let A = [x0, z0], B = [x1, z1];
    if (cross < 0) [A, B] = [B, A];
    const along = (p) => (Math.abs(n[0]) > 0.5 ? p[1] : p[0]);
    const shade = (h) => { const t = (h - floorY) / H; return 0.5 + Math.min(1, t * 2.2) * 0.42 - (t > 0.92 ? (t - 0.92) * 2 : 0); };
    const cb = shade(h0), ct = shade(h1);
    K.quad(m, [A[0], h0, A[1]], [B[0], h0, B[1]], [B[0], h1, B[1]], [A[0], h1, A[1]],
        [[along(A) / rep, h0 / rep], [along(B) / rep, h0 / rep], [along(B) / rep, h1 / rep], [along(A) / rep, h1 / rep]],
        [[cb, cb, cb * 0.97], [cb, cb, cb * 0.97], [ct, ct, ct], [ct, ct, ct]]);
}

function decalOnWall(K, m, a, c, n, u, yc, s) {
    const mx = a[0] + (c[0] - a[0]) * u + n[0] * 0.012, mz = a[1] + (c[1] - a[1]) * u + n[1] * 0.012;
    const tx = n[1], tz = -n[0];     // along the wall, chosen so the quad faces n
    const hs = s / 2;
    K.quad(m, [mx - tx * hs, yc - hs, mz - tz * hs], [mx + tx * hs, yc - hs, mz + tz * hs], [mx + tx * hs, yc + hs, mz + tz * hs], [mx - tx * hs, yc + hs, mz - tz * hs], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]);
}

let water = null;
function waterMat() {
    if (water) return water;
    water = new THREE.MeshStandardMaterial({ color: 0x1b1d1a, roughness: 0.04, metalness: 0.5, transparent: true, opacity: 0.72, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    return water;
}

function skylight(K, X0, Z0, y, r) {
    // a glass roof in an iron grid; some panes long gone
    const m = plain('metal');
    for (const d of [0, 1]) { K.box(m, X0 + 1, y, Z0 + d * 2, 2, 0.12, 0.08, [0.2, 0.2, 0.2]); K.box(m, X0 + d * 2, y, Z0 + 1, 0.08, 0.12, 2, [0.2, 0.2, 0.2]); }
    if (r < 0.45) return;
    K.quad(plain('glass'), [X0, y, Z0], [X0 + 2, y, Z0], [X0 + 2, y, Z0 + 2], [X0, y, Z0 + 2], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.55, 0.6, 0.6]);
}

function truss(K, x, z0, len, y) {
    const m = plain('rust');
    K.tube(m, [x, y - 1.2, z0], [x, y - 1.2, z0 + len], 0.08, 6, [0.45, 0.32, 0.24]);
    for (let t = 0; t < len; t += 2) K.tube(m, [x, y - 1.2, z0 + t], [x, y, z0 + t + 1], 0.04, 5, [0.45, 0.32, 0.24]);
}

function brokenEdges(K, X0, Z0, y, r) {
    // splintered boards round a hole in the floor
    const m = plain('wood');
    for (let i = 0; i < 8; i++) {
        const side = i % 4, t = (i * 0.37 + r) % 1;
        const len = 0.25 + ((r * 7 + i * 0.3) % 1) * 0.5;
        const px = side === 1 ? X0 + 2 - len / 2 : side === 3 ? X0 + len / 2 : X0 + 0.2 + t * 1.6;
        const pz = side === 0 ? Z0 + len / 2 : side === 2 ? Z0 + 2 - len / 2 : Z0 + 0.2 + t * 1.6;
        K.at(px, y - 0.06, pz, side % 2 ? Math.PI / 2 : 0, () => K.box(m, 0, 0, 0, 0.18, 0.08, len, [0.42, 0.34, 0.26]));
    }
    // the joists below
    for (const dx of [0.5, 1.5]) K.box(plain('wood'), X0 + dx, y - 0.32, Z0 + 1, 0.12, 0.28, 2, [0.3, 0.24, 0.18]);
}

function ceilingGap(K, X0, Z0, ch, top, r, wide = false) {
    // a black void above, with pipes and a dangling cable
    const m = plain('paint');
    K.quad(m, [X0, top - 0.01, Z0], [X0 + 2, top - 0.01, Z0], [X0 + 2, top - 0.01, Z0 + 2], [X0, top - 0.01, Z0 + 2], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.04, 0.04, 0.04]);
    K.tube(plain('rust'), [X0, top - 0.15, Z0 + 0.6], [X0 + 2, top - 0.15, Z0 + 0.6], 0.06, 6, [0.5, 0.35, 0.25]);
    if (r < 0.6) K.tube(plain('paint'), [X0 + 1 + r, ch, Z0 + 1], [X0 + 0.9 + r, ch - 0.7 - r, Z0 + 1.2], 0.012, 4, [0.05, 0.05, 0.05]);
    if (wide || r < 0.3) {
        // a ceiling tile hanging down on one corner
        K.quad(surface('ceiling'), [X0 + 0.2, ch - 0.05, Z0 + 0.3], [X0 + 0.8, ch - 0.6, Z0 + 0.3], [X0 + 0.8, ch - 0.6, Z0 + 0.9], [X0 + 0.2, ch - 0.05, Z0 + 0.9], [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]], [0.7, 0.68, 0.6]);
    }
}

function stairRun(K, I, lv, x, z, X0, Z0, y0, H) {
    const s = lv.stair[z * I.w + x] - 1, dir = s >> 4, k = s & 15;
    const steps = Math.max(3, Math.round(H / I.S / 0.19));
    const rise = H / I.S / steps;
    const m = I.b.type === 'house' ? plain('wood') : plain('concrete');
    const col = I.b.type === 'house' ? [0.5, 0.4, 0.3] : [0.55, 0.54, 0.5];
    for (let j = 0; j < steps; j++) {
        const t0 = j / steps, t1 = (j + 1) / steps;
        const yTop = y0 + (k * steps + j + 1) * rise;
        // tread spans t0..t1 along the run direction within this tile
        let bx0, bx1, bz0, bz1;
        if (dir === 2) { bx0 = X0; bx1 = X0 + 2; bz0 = Z0 + t0 * 2; bz1 = Z0 + t1 * 2; }
        else if (dir === 0) { bx0 = X0; bx1 = X0 + 2; bz0 = Z0 + 2 - t1 * 2; bz1 = Z0 + 2 - t0 * 2; }
        else if (dir === 1) { bz0 = Z0; bz1 = Z0 + 2; bx0 = X0 + t0 * 2; bx1 = X0 + t1 * 2; }
        else { bz0 = Z0; bz1 = Z0 + 2; bx0 = X0 + 2 - t1 * 2; bx1 = X0 + 2 - t0 * 2; }
        const yb = y0 + k * steps * rise - 0.3;
        K.box(m, (bx0 + bx1) / 2, yb, (bz0 + bz1) / 2, bx1 - bx0, yTop - yb, bz1 - bz0, [col, col], 1);
    }
}

function railing(K, p0, p1, y) {
    const m = plain('metal'), col = [0.4, 0.42, 0.4];
    K.tube(m, [p0[0], y + 1.05, p0[1]], [p1[0], y + 1.05, p1[1]], 0.035, 6, col);
    K.tube(m, [p0[0], y + 0.55, p0[1]], [p1[0], y + 0.55, p1[1]], 0.02, 5, col);
    for (let t = 0; t <= 1.001; t += 0.5) {
        const x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
        K.tube(m, [x, y, z], [x, y + 1.05, z], 0.025, 5, col);
    }
}

function shopGlass(K, p0, p1, y, h) {
    const mg = plain('glass'), mf = plain('metal');
    K.quad(mg, [p0[0], y + 0.35, p0[1]], [p1[0], y + 0.35, p1[1]], [p1[0], y + h, p1[1]], [p0[0], y + h, p0[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.55, 0.62, 0.6]);
    K.quad(mg, [p1[0], y + 0.35, p1[1]], [p0[0], y + 0.35, p0[1]], [p0[0], y + h, p0[1]], [p1[0], y + h, p1[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.55, 0.62, 0.6]);
    for (const t of [0, 1]) { const x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t; K.box(mf, x, y, z, 0.08, h, 0.08, [0.3, 0.3, 0.3]); }
}

function doorLeaf(K, p0, p1, nrm, y, x, z, dir, L, lock, open, kind) {
    const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
    const along = [p1[0] - p0[0], p1[1] - p0[1]].map((v) => v / TILE);
    const gap = DOOR_GAP;
    const r = hash(x, z, dir + L);
    const m = plain('wood');
    if (lock && !open) {
        // closed, and dressed for its lock: boards, a chain, a card reader
        K.at(mx, y, mz, Math.atan2(along[0], along[1]) - Math.PI / 2, () => {
            K.box(m, 0, 0, 0, gap, DOOR_H, 0.06, [0.35, 0.27, 0.2]);
            if (kind === 'boards') for (let i = 0; i < 4; i++) K.at(0, 0.4 + i * 0.45, 0.07, (i % 2 ? 0.25 : -0.2), () => K.box(plain('wood'), 0, 0, 0, gap + 0.5, 0.18, 0.04, [0.5, 0.42, 0.32]));
            if (kind === 'chain') { K.tube(plain('metal'), [-0.5, 1.0, 0.06], [0.5, 1.1, 0.06], 0.03, 5, [0.5, 0.5, 0.48]); K.box(plain('metal'), 0.1, 0.85, 0.08, 0.12, 0.16, 0.06, [0.6, 0.55, 0.3]); }
            if (kind === 'badge' || kind === 'lab') { K.box(plain('paint'), gap / 2 + 0.25, 1.1, 0.06, 0.12, 0.18, 0.04, [0.12, 0.12, 0.12]); K.box(plain('glow'), gap / 2 + 0.25, 1.24, 0.085, 0.04, 0.02, 0.01, [1.4, 0.1, 0.05]); }
        });
        return;
    }
    if (r < 0.35) return;          // no door left in the frame
    // a door standing open at an angle on its hinge
    const ang = 1.2 + r * 0.6;
    const hx = mx - along[0] * gap / 2, hz = mz - along[1] * gap / 2;
    K.at(hx, y + (r > 0.9 ? 0.02 : 0), hz, Math.atan2(along[0], along[1]) - Math.PI / 2 + ang * (r > 0.65 ? 1 : -1), () => K.box(m, gap / 2, 0, 0, gap, DOOR_H - 0.03, 0.05, [0.45, 0.36, 0.26]));
}
