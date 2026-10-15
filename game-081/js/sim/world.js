// First-person movement, collision and the things you can walk up to. Pure.
//
// Map cells are CELL metres square; cell (x, y) spans [x·CELL, (x+1)·CELL] in world x and z.
// yaw 0 looks toward −z (up the map); forward is (sin yaw, −cos yaw).

import { CELL, PLAYER, PITCH_LIMIT } from '../config.js';
import { MAPS, legendAt } from './data/maps.js';
import { QUESTS } from './data/story.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The cell a letter sits in, for every occurrence (scan of the grid). */
export function findCells(mapId, ch) {
    const out = [];
    MAPS[mapId].grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push([x, y]); });
    return out;
}

export const cellCentre = (x, y) => [(x + 0.5) * CELL, (y + 0.5) * CELL];

/**
 * Everything on the current map you can see or use, built from the map and the game state.
 * Each: { key, kind, x, y, solid, label, hidden, ...kind-specific }.
 */
export function mapEnts(G) {
    const cached = G._ents;
    const sig = `${G.map}|${G.wv}`;
    if (cached && cached.sig === sig) return cached.list;
    const mapId = G.map;
    const M = MAPS[mapId];
    const list = [];
    const seats = [];
    let tableCell = null;
    M.grid.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const L = legendAt(mapId, row[x]);
            if (!L) continue;
            if (L.kind === 'seat') { seats.push([x, y]); continue; }
            if (L.kind === 'table') tableCell = [x, y];
            list.push(entFor(G, mapId, L, x, y));
        }
    });
    if (mapId === 'clinic') {
        const waiting = G.patients.filter((p) => p.where === 'clinic' && p.state === 'waiting');
        waiting.slice(0, seats.length).forEach((p, i) => {
            const [x, y] = seats[i];
            list.push({ key: `p:${p.id}`, kind: 'patient', id: p.id, x, y, solid: true, label: `Talk to ${p.name}` });
        });
        const onTable = G.patients.find((p) => p.where === 'clinic' && p.state === 'table');
        if (onTable && tableCell) list.push({ key: `p:${onTable.id}`, kind: 'patient', id: onTable.id, x: tableCell[0], y: tableCell[1], solid: true, onTable: true, label: `${onTable.name} is on the table` });
        // In the epilogue the Gilded Company works off its sentence in the hall.
        if (G.act >= 4) {
            const spots = [[3, 6, 'aldric'], [13, 8, 'vessa'], [9, 2, 'corvin'], [13, 4, 'lumina']];
            for (const [x, y, id] of spots) list.push({ key: `n:${id}`, kind: 'npc', id, x, y, solid: true, label: 'Talk to the orderly' });
        }
    }
    const out = list.filter((e) => !e.gone);
    G._ents = { sig, list: out };
    return out;
}

function entFor(G, mapId, L, x, y) {
    const base = { key: `${x},${y}`, kind: L.kind, x, y, solid: !!L.solid, label: L.label || '' };
    const Q = G.quests[mapId];
    switch (L.kind) {
        case 'patient': {
            const p = G.patients.find((q) => q.where === mapId && q.slot === L.slot);
            if (!p) return { ...base, gone: true };
            return { ...base, id: p.id, label: p.state === 'healed' ? `${p.name} (healed)` : `Treat ${p.name}`, healed: p.state === 'healed' };
        }
        case 'boss': {
            const p = G.patients.find((q) => q.where === mapId && q.boss);
            if (!p) return { ...base, gone: true };
            return { ...base, kind: 'patient', boss: true, id: p.id, label: p.state === 'healed' ? `${p.name} (healed)` : `Treat ${p.name}`, healed: p.state === 'healed' };
        }
        case 'gate': return { ...base, solid: !Q?.gate, open: !!Q?.gate, label: Q?.gate ? '' : 'Try the way through' };
        case 'trap': {
            const done = !!Q?.traps?.[base.key];
            return { ...base, solid: !done, disarmed: done, label: done ? '' : 'Disarm the Company trap' };
        }
        case 'chest': {
            const open = !!Q?.chests?.[base.key];
            return { ...base, relic: L.relic, open, label: open ? '' : 'Open the chest' };
        }
        case 'evidence': {
            const got = !!Q?.evidence;
            return { ...base, gone: got, label: 'Pick it up' };
        }
        case 'exit': return { ...base, label: L.label };
        default: return { ...base, ...L, key: base.key, x, y, solid: !!L.solid, label: L.label || '' };
    }
}

/** Static walls and liquids for a map, as a Uint8Array (1 = blocked). Cached per map id. */
const staticCache = {};
function staticSolid(mapId) {
    if (staticCache[mapId]) return staticCache[mapId];
    const M = MAPS[mapId];
    const w = M.grid[0].length, h = M.grid.length;
    const a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const ch = M.grid[y][x];
            if (ch === '#' || ch === '~' || ch === 'o' || ch === 'T') a[y * w + x] = 1;
        }
    }
    return (staticCache[mapId] = { a, w, h });
}

/** The full blocked grid for the current state: walls plus solid entities. */
export function solidGrid(G) {
    const cached = G._solid;
    const sig = `${G.map}|${G.wv}`;
    if (cached && cached.sig === sig) return cached;
    const s = staticSolid(G.map);
    const a = s.a.slice();
    for (const e of mapEnts(G)) if (e.solid) a[e.y * s.w + e.x] = 1;
    G._solid = { sig, a, w: s.w, h: s.h };
    return G._solid;
}

export function blocked(G, x, y) {
    const s = solidGrid(G);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return true;
    return s.a[y * s.w + x] === 1;
}

/** Move the player one step. inp: { mx, my, dyaw, dpitch, sprint }. */
export function stepPlayer(G, inp, dt) {
    const P = G.player;
    P.yaw += inp.dyaw || 0;
    P.pitch = clamp(P.pitch + (inp.dpitch || 0), -PITCH_LIMIT, PITCH_LIMIT);
    let mx = inp.mx || 0, my = inp.my || 0;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const speed = inp.sprint ? PLAYER.sprint : PLAYER.speed;
    const fx = Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
    const vx = (fx * my + rx * mx) * speed, vz = (fz * my + rz * mx) * speed;
    const moved = moveCircle(G, P, vx * dt, vz * dt);
    P.walk = (P.walk || 0) + moved;
    return moved;
}

/** Slide a circle through the grid, axis by axis. Returns distance moved. */
export function moveCircle(G, P, dx, dz) {
    const x0 = P.x, z0 = P.z;
    const r = PLAYER.radius;
    P.x += dx;
    resolve(G, P, r, 'x', dx);
    P.z += dz;
    resolve(G, P, r, 'z', dz);
    return Math.hypot(P.x - x0, P.z - z0);
}

function resolve(G, P, r, axis, d) {
    const cx = Math.floor(P.x / CELL), cz = Math.floor(P.z / CELL);
    for (let y = cz - 1; y <= cz + 1; y++) {
        for (let x = cx - 1; x <= cx + 1; x++) {
            if (!blocked(G, x, y)) continue;
            const minX = x * CELL, maxX = minX + CELL, minZ = y * CELL, maxZ = minZ + CELL;
            const nx = clamp(P.x, minX, maxX), nz = clamp(P.z, minZ, maxZ);
            const ddx = P.x - nx, ddz = P.z - nz;
            const d2 = ddx * ddx + ddz * ddz;
            if (d2 >= r * r) continue;
            if (axis === 'x') {
                if (d > 0) P.x = minX - r; else if (d < 0) P.x = maxX + r;
                else if (d2 > 0) { const dd = Math.sqrt(d2); P.x = nx + (ddx / dd) * r; }
            } else {
                if (d > 0) P.z = minZ - r; else if (d < 0) P.z = maxZ + r;
                else if (d2 > 0) { const dd = Math.sqrt(d2); P.z = nz + (ddz / dd) * r; }
            }
        }
    }
}

/** The thing you are looking at and close enough to use, or null. */
export function facing(G) {
    const P = G.player;
    const fx = Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let best = null, bestScore = -Infinity;
    for (const e of mapEnts(G)) {
        if (!e.label) continue;
        const [cx, cz] = cellCentre(e.x, e.y);
        const dx = cx - P.x, dz = cz - P.z;
        const dist = Math.hypot(dx, dz);
        // distance to the cell's edge, not its centre: a solid thing is a whole cell wide
        const edge = Math.max(0, dist - (e.solid ? CELL * 0.5 : CELL * 0.4));
        if (edge > PLAYER.reach - 0.9) continue;
        const dot = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
        if (dot < 0.45) continue;
        const score = dot * 2 - edge;
        if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
}

/** Breadth-first route over cells from the player to stand beside (x, y). Returns [[x,y],…] or null. */
export function routeTo(G, tx, ty) {
    const s = solidGrid(G);
    const P = G.player;
    const sx = Math.floor(P.x / CELL), sy = Math.floor(P.z / CELL);
    const goal = new Set();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const gx = tx + dx, gy = ty + dy;
        if (gx >= 0 && gy >= 0 && gx < s.w && gy < s.h && !s.a[gy * s.w + gx]) goal.add(gy * s.w + gx);
    }
    if (!s.a[ty * s.w + tx]) goal.add(ty * s.w + tx);
    const start = sy * s.w + sx;
    const prev = new Int32Array(s.w * s.h).fill(-1);
    const q = [start];
    prev[start] = start;
    while (q.length) {
        const k = q.shift();
        if (goal.has(k)) {
            const path = [];
            for (let c = k; c !== start; c = prev[c]) path.push([c % s.w, Math.floor(c / s.w)]);
            path.push([sx, sy]);
            return path.reverse();
        }
        const x = k % s.w, y = Math.floor(k / s.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
            const n = ny * s.w + nx;
            if (prev[n] !== -1 || s.a[n]) continue;
            // a diagonal needs both orthogonal cells open, or the circle snags on the corner
            if (dx && dy && (s.a[y * s.w + nx] || s.a[ny * s.w + x])) continue;
            prev[n] = k;
            q.push(n);
        }
    }
    return null;
}

/** Is the straight line between two world points clear of blocked cells? (sampled densely, end included) */
export function lineClear(G, x0, z0, x1, z1, pad = 0.3) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.ceil(d / 0.2));
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        for (const [ox, oz] of [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]]) {
            if (blocked(G, Math.floor((x + ox) / CELL), Math.floor((z + oz) / CELL))) return false;
        }
    }
    return true;
}

/**
 * Where to head next along a route: the farthest route cell visible in a straight line (and at
 * least one step along), so a guide arrow points along the walk, not through walls.
 */
export function steerPoint(G, path) {
    if (!path || path.length < 2) return null;
    const P = G.player;
    let pick = path[1];
    for (let i = 2; i < path.length; i++) {
        const [cx, cz] = cellCentre(path[i][0], path[i][1]);
        if (lineClear(G, P.x, P.z, cx, cz)) pick = path[i]; else break;
    }
    return cellCentre(pick[0], pick[1]);
}

/** Put the player at a map's start. */
export function placeAtStart(G, mapId) {
    const M = MAPS[mapId];
    const [x, y, yaw] = M.start;
    const [wx, wz] = cellCentre(x, y);
    G.map = mapId;
    G.player = { x: wx, z: wz, yaw, pitch: 0, walk: 0 };
    G.wv++;
}

/** The quest label for a map id, or the clinic. */
export const placeName = (mapId) => MAPS[mapId]?.name ?? QUESTS[mapId]?.label ?? mapId;
