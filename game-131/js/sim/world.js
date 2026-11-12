// Zones compiled from data: where things are, what blocks the way, how to walk. Pure.

import { PLAYER } from '../config.js';
import { ZONES, TUNNELS } from './data/zones.js';
import { fieldStand, heightAt } from './terrain.js';
import { ISLE } from '../config.js';

const compiled = {};

/** A zone ready for use: { id, def, kind, cell, w, h, rows, things, byId, solids, doors }. */
export function zone(id) {
    if (compiled[id]) return compiled[id];
    const def = ZONES[id];
    if (!def) throw new Error('no zone ' + id);
    const Z = { id, def, kind: def.kind, things: [], byId: {}, solids: [], doorCells: {} };
    if (def.kind === 'grid') {
        Z.cell = def.cell;
        Z.h = def.map.length;
        Z.w = Math.max(...def.map.map((r) => r.length));
        Z.rows = def.map.map((r) => r.padEnd(Z.w, ' '));
        const used = {};
        for (let r = 0; r < Z.h; r++) for (let c = 0; c < Z.w; c++) {
            const ch = Z.rows[r][c];
            let d = def.legend[ch];
            if (!d) continue;
            if (Array.isArray(d)) { used[ch] = (used[ch] || 0) + 1; d = d[used[ch] - 1]; if (!d) throw new Error(`${id}: too many '${ch}'`); }
            const t = { ...d, x: (c + 0.5) * Z.cell, z: (r + 0.5) * Z.cell, c, r };
            Z.things.push(t);
            if (t.type === 'door') Z.doorCells[c + ',' + r] = t.flag;
        }
    } else Z.things = def.things.map((t) => ({ ...t }));
    for (const t of Z.things) {
        if (Z.byId[t.id]) throw new Error(`${id}: two things called ${t.id}`);
        Z.byId[t.id] = t;
        if (t.solid && !(t.type === 'door' && Z.kind === 'grid')) Z.solids.push(t);
    }
    compiled[id] = Z;
    return Z;
}

export const zoneIds = () => Object.keys(ZONES);

/** Which zone a thing id lives in. */
export function findThing(thingId) {
    for (const id of zoneIds()) { const t = zone(id).byId[thingId]; if (t) return { zone: id, thing: t }; }
    return null;
}

function cellBlocked(Z, flags, c, r) {
    if (c < 0 || r < 0 || c >= Z.w || r >= Z.h) return true;
    const ch = Z.rows[r][c];
    if (ch === '#' || ch === ' ') return true;
    const door = Z.doorCells[c + ',' + r];
    return !!door && !flags[door];
}

/** Can a body of radius r stand at (x, z) in this zone, given which doors are open (flags)? */
export function canStand(zoneId, flags, x, z, r = PLAYER.radius) {
    const Z = zone(zoneId);
    if (Z.kind === 'grid') {
        const s = Z.cell;
        const c0 = Math.floor((x - r) / s), c1 = Math.floor((x + r) / s), r0 = Math.floor((z - r) / s), r1 = Math.floor((z + r) / s);
        for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
            if (!cellBlocked(Z, flags, cc, rr)) continue;
            const nx = Math.max(cc * s, Math.min(x, (cc + 1) * s)), nz = Math.max(rr * s, Math.min(z, (rr + 1) * s));
            if ((nx - x) ** 2 + (nz - z) ** 2 < r * r) return false;
        }
    } else if (!fieldStand(x, z, r)) return false;
    for (const t of Z.solids) {
        if (t.type === 'door' && flags[t.flag]) continue;
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < (t.solid + r) ** 2) return false;
    }
    return true;
}

/** Move a body by (dx, dz), sliding along whatever blocks it. Returns the new position. */
export function move(zoneId, flags, x, z, dx, dz, r = PLAYER.radius) {
    if (canStand(zoneId, flags, x + dx, z + dz, r)) return { x: x + dx, z: z + dz };
    if (dx && canStand(zoneId, flags, x + dx, z, r)) return { x: x + dx, z };
    if (dz && canStand(zoneId, flags, x, z + dz, r)) return { x, z: z + dz };
    return { x, z };
}

/** Height of the ground (the view and the camera use it; grid zones are flat). */
export function groundY(zoneId, x, z) { return zone(zoneId).kind === 'field' ? heightAt(x, z) : 0; }

// ---------------------------------------------------------------- the walking lattice (proofs, scatter, the bot)
/** Lattice of 1 m nodes over a zone: { n, w, at(i) → [x, z], index(x, z) }. */
export function lattice(zoneId) {
    const Z = zone(zoneId);
    if (Z.lat) return Z.lat;
    const field = Z.kind === 'field';
    const w = field ? ISLE.size + 1 : Z.w * Z.cell, h = field ? ISLE.size + 1 : Z.h * Z.cell;
    const off = field ? -ISLE.size / 2 : 0.5;
    Z.lat = {
        w, h, n: w * h,
        at: (i) => [(i % w) + off, Math.floor(i / w) + off],
        index: (x, z) => { const a = Math.round(x - off), b = Math.round(z - off); return a < 0 || b < 0 || a >= w || b >= h ? -1 : a + b * w; },
    };
    return Z.lat;
}

/**
 * Breadth-first distances (in lattice steps) from a set of start points, walking only where a body can stand.
 * Returns an Int32Array, -1 where unreachable. `flags` says which doors are open; pass ALL_OPEN for "eventually".
 */
export function distField(zoneId, flags, starts) {
    const L = lattice(zoneId), dist = new Int32Array(L.n).fill(-1), q = [];
    const ok = new Int8Array(L.n);            // 0 unknown, 1 yes, 2 no
    const stand = (i) => { if (!ok[i]) { const [x, z] = L.at(i); ok[i] = canStand(zoneId, flags, x, z) ? 1 : 2; } return ok[i] === 1; };
    for (const [x, z] of starts) { const i = L.index(x, z); if (i >= 0 && dist[i] < 0 && stand(i)) { dist[i] = 0; q.push(i); } }
    for (let head = 0; head < q.length; head++) {
        const i = q[head], cx = i % L.w, cz = (i / L.w) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= L.w || nz >= L.h) continue;
            const j = nx + nz * L.w;
            if (dist[j] >= 0 || !stand(j)) continue;
            const [ax, az] = L.at(i);
            if (!edgeOpen(zoneId, flags, ax, az, ax + dx, az + dz)) continue;
            dist[j] = dist[i] + 1; q.push(j);
        }
    }
    return dist;
}

/** Is the straight metre between two lattice nodes walkable? Sampled at quarters: a tree can pinch just off the middle. */
export function edgeOpen(zoneId, flags, x0, z0, x1, z1) {
    for (const t of [0.25, 0.5, 0.75]) if (!canStand(zoneId, flags, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    return true;
}

/** Lattice points within `reach` of a thing where a body can stand: where you would stop to use it. */
export function standNear(zoneId, flags, t, reach = PLAYER.reach - 0.6 + (t.solid || 0)) {
    const out = [];
    for (let dz = -Math.ceil(reach); dz <= Math.ceil(reach); dz++) for (let dx = -Math.ceil(reach); dx <= Math.ceil(reach); dx++) {
        const L = lattice(zoneId), i = L.index(t.x + dx, t.z + dz);
        if (i < 0) continue;
        const [x, z] = L.at(i);
        if (Math.hypot(x - t.x, z - t.z) <= reach && canStand(zoneId, flags, x, z)) out.push([x, z]);
    }
    return out;
}

/** A flags object in which every door is open. */
export const ALL_OPEN = new Proxy({}, { get: () => true });

// ---------------------------------------------------------------- tunnels
const tun = {};
export function tunnel(id) {
    if (tun[id]) return tun[id];
    const def = TUNNELS[id];
    const T = { id, def, rows: def.map, h: def.map.length, w: def.map[0].length, baubles: [] };
    for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
        const ch = T.rows[y][x];
        if (ch === 'S') T.start = { x, y };
        else if (ch === 'L' || ch === 'I' || ch === 'H') T.goal = { x, y };
        else if (ch === 'b') T.baubles.push({ x, y });
    }
    // steps from every cell to the goal: Thimble hears the hum get nearer or further
    T.hum = {};
    const q = [T.goal]; T.hum[T.goal.x + ',' + T.goal.y] = 0;
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = q[i].x + dx, y = q[i].y + dy, k = x + ',' + y;
        if (T.hum[k] === undefined && tunnelOpen(T, x, y)) { T.hum[k] = T.hum[q[i].x + ',' + q[i].y] + 1; q.push({ x, y }); }
    }
    tun[id] = T;
    return T;
}
export function tunnelOpen(T, x, y) { return y >= 0 && y < T.h && x >= 0 && x < T.w && T.rows[y][x] !== '#'; }
export const tunnelIds = () => Object.keys(TUNNELS);
