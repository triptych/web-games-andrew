// Room geometry: footprints, what is where, whether a thing fits, and who can be walked to.
// Pure. Floor tiles are (x, y) with 0 ≤ x < w, 0 ≤ y < d. The two back walls are
//   L: along x at y = 0 (u = x),   R: along y at x = 0 (u = y),   v = row up the wall.

import { KINDS } from './data/catalog.js';
import { WALL_ROWS } from '../config.js';

const key = (x, y) => x + ',' + y;

/** [w, d] of a thing at a rotation (odd turns swap them). */
export function footprint(item, rot = 0) {
    const [w, d] = KINDS[item.kind].fp[item.size];
    return rot & 1 ? [d, w] : [w, d];
}

/** Floor tiles a placed thing covers (a thing on top covers its one tile). */
export function tilesOf(item, at = item.at) {
    if (!at || at.layer === 'wall') return [];
    if (at.layer === 'top') return [[at.x, at.y]];
    const [w, d] = footprint(item, at.rot);
    const out = [];
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push([at.x + i, at.y + j]);
    return out;
}

export function wallLength(G, wall) { return wall === 'L' ? G.w : G.d; }

export function doorTile(G) {
    const dr = G.room.door;
    return dr.wall === 'L' ? [dr.u, 0] : [0, dr.u];
}

/** Everything that stands where: floor, rug, top, wall. Built fresh from G.items. */
export function occupancy(G, skipId = -1) {
    const floor = new Map(), rug = new Map(), top = new Map(), wall = new Map();
    for (const dr of [G.room.door]) for (let v = 0; v < 2; v++) wall.set(`${dr.wall}:${dr.u}:${v}`, 'door');
    for (const wi of G.room.windows) for (let i = 0; i < wi.w; i++) for (let v = 1; v < 3; v++) wall.set(`${wi.wall}:${wi.u + i}:${v}`, 'window');
    for (const it of G.items) {
        if (!it.at || it.id === skipId) continue;
        const at = it.at;
        if (at.layer === 'wall') {
            const [w, h] = KINDS[it.kind].fp[it.size];
            for (let i = 0; i < w; i++) for (let v = 0; v < h; v++) wall.set(`${at.wall}:${at.u + i}:${at.v + v}`, it.id);
        } else if (at.layer === 'top') {
            if (at.on === skipId) continue;
            top.set(key(at.x, at.y), it.id);
        } else {
            const m = at.layer === 'rug' ? rug : floor;
            for (const [x, y] of tilesOf(it)) m.set(key(x, y), it.id);
        }
    }
    return { floor, rug, top, wall };
}

export function inRoom(G, x, y) { return x >= 0 && y >= 0 && x < G.w && y < G.d; }
export function isBlocked(G, x, y) { return G.room.blocked.some(([bx, by]) => bx === x && by === y); }

function byId(G, id) { return G.items.find((i) => i.id === id) || null; }

/**
 * Where would this thing go for a pointer at (x, y) (floor things) or (wall, u, v) (wall things)?
 * Returns { at } or { why } with a reason the UI can show. A small thing pointed at a surface
 * goes on top of it; anywhere else it stands on the floor. The thing itself is ignored, so a
 * placed thing can be moved onto tiles it already covers.
 */
export function placementFor(G, id, spec) {
    const item = byId(G, id);
    if (!item) return { why: 'missing' };
    const K = KINDS[item.kind];
    const occ = occupancy(G, id);
    const rot = ((spec.rot | 0) % 4 + 4) % 4;

    if (K.layer === 'wall') {
        const wall = spec.wall;
        if (wall !== 'L' && wall !== 'R') return { why: 'wall' };
        const [w, h] = K.fp[item.size];
        const len = wallLength(G, wall);
        const u = Math.max(0, Math.min(len - w, spec.u | 0));
        const v = Math.max(0, Math.min(WALL_ROWS - h, spec.v | 0));
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
            const o = occ.wall.get(`${wall}:${u + i}:${v + j}`);
            if (o === 'door') return { why: 'door' };
            if (o === 'window') return { why: 'window' };
            if (o !== undefined) return { why: 'taken' };
        }
        return { at: { layer: 'wall', wall, u, v } };
    }

    const x = spec.x | 0, y = spec.y | 0;
    if (K.layer === 'small') {
        if (!inRoom(G, x, y)) return { why: 'outside' };
        const under = occ.floor.get(key(x, y));
        if (under !== undefined) {
            const host = byId(G, under);
            if (!host || !KINDS[host.kind].surface) return { why: 'taken' };
            if (occ.top.has(key(x, y))) return { why: 'taken' };
            return { at: { layer: 'top', on: host.id, x, y, rot } };
        }
        if (isBlocked(G, x, y)) return { why: 'blocked' };
        const [dx, dy] = doorTile(G);
        if (x === dx && y === dy) return { why: 'door' };
        return { at: { layer: 'floor', x, y, rot } };
    }

    const at = { layer: K.layer, x, y, rot };
    const [dx, dy] = doorTile(G);
    for (const [tx, ty] of tilesOf(item, at)) {
        if (!inRoom(G, tx, ty)) return { why: 'outside' };
        if (isBlocked(G, tx, ty)) return { why: 'blocked' };
        if (K.layer === 'rug') {
            if (occ.rug.has(key(tx, ty))) return { why: 'taken' };
        } else {
            if (occ.floor.has(key(tx, ty))) return { why: 'taken' };
            if (tx === dx && ty === dy) return { why: 'door' };
        }
    }
    return { at };
}

/** Is any tile of a within one step (any direction, or the same tile) of any tile of b? */
export function near(a, b) {
    const ta = tilesOf(a), tb = tilesOf(b);
    for (const [ax, ay] of ta) for (const [bx, by] of tb) if (Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1) return true;
    return false;
}

/** A floor thing touching one of the two back walls. */
export function againstWall(item) {
    if (!item.at || item.at.layer !== 'floor') return false;
    return tilesOf(item).some(([x, y]) => x === 0 || y === 0);
}

/** On or beside a window's floor tiles. */
export function byWindow(G, item) {
    const tiles = tilesOf(item);
    for (const wi of G.room.windows) {
        for (const [x, y] of tiles) {
            if (wi.wall === 'L' && y <= 1 && x >= wi.u - 1 && x <= wi.u + wi.w) return true;
            if (wi.wall === 'R' && x <= 1 && y >= wi.u - 1 && y <= wi.u + wi.w) return true;
        }
    }
    return false;
}

/** Does a placed thing stand (at least partly) on a rug? */
export function onRug(G, item, occ = occupancy(G)) {
    return tilesOf(item).some(([x, y]) => occ.rug.has(key(x, y)) && occ.rug.get(key(x, y)) !== item.id);
}

/**
 * Walkability: flood the free floor from the door tile; every thing standing on the floor must
 * have a free, reached tile beside it (4 directions). Things on top are reached through their host.
 * Returns { ok, reached: Set, stuck: [ids] }.
 */
export function walk(G, occ = occupancy(G)) {
    const free = (x, y) => inRoom(G, x, y) && !isBlocked(G, x, y) && !occ.floor.has(key(x, y));
    const [sx, sy] = doorTile(G);
    const reached = new Set();
    if (free(sx, sy)) {
        reached.add(key(sx, sy));
        const q = [[sx, sy]];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                const k = key(nx, ny);
                if (!reached.has(k) && free(nx, ny)) { reached.add(k); q.push([nx, ny]); }
            }
        }
    }
    const stuck = [];
    for (const it of G.items) {
        if (!it.at || it.at.layer !== 'floor') continue;
        const ok = tilesOf(it).some(([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => reached.has(key(nx, ny))));
        if (!ok) stuck.push(it.id);
    }
    return { ok: stuck.length === 0, reached, stuck };
}

/** Fraction of usable floor tiles covered by floor things (rugs don't count). */
export function coverage(G, occ = occupancy(G)) {
    const usable = G.w * G.d - G.room.blocked.length;
    return usable > 0 ? occ.floor.size / usable : 0;
}
