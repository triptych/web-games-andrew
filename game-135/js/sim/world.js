// What is solid in the town right now, and the geometry helpers the rules use. Pure.

import { BUILDINGS, RIVER, BRIDGE, TREES, TREE_HALF } from './data/city.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export const jobDone = (G, id) => G.jobs[id].st === 'done';
export const stepDone = (G, id, i) => G.jobs[id].st === 'done' || G.jobs[id].step > i;

/** Is this building standing? (`from`: once a job is done; `until`: until a step of a job is done.) */
export function buildingUp(G, b) {
    if (b.from) return jobDone(G, b.from);
    if (b.until) return !stepDone(G, b.until[0], b.until[1]);
    return true;
}

const TREE_RECTS = TREES.map((t) => ({ x: t.x - TREE_HALF, y: t.y - TREE_HALF, w: TREE_HALF * 2, h: TREE_HALF * 2 }));
const RIVER_OPEN = [
    { x: RIVER.x, y: RIVER.y, w: RIVER.w, h: BRIDGE.y - RIVER.y },
    { x: RIVER.x, y: BRIDGE.y + BRIDGE.h, w: RIVER.w, h: RIVER.y + RIVER.h - BRIDGE.y - BRIDGE.h },
];

// The list only changes when a job step completes (G.rev), so it is built once per change. The cache is derived
// from G alone and never saved.
const cache = new WeakMap();
/** Every solid rectangle: standing buildings, trees and the river (with a gap at the bridge once it is built). */
export function obstacles(G) {
    const c = cache.get(G);
    if (c && c.rev === G.rev) return c.list;
    const list = BUILDINGS.filter((b) => buildingUp(G, b)).concat(TREE_RECTS, jobDone(G, 'bridge') ? RIVER_OPEN : [RIVER]);
    cache.set(G, { rev: G.rev, list });
    return list;
}

/** Push a circle out of a rectangle. Returns true if it was touching. */
export function pushOut(c, r, rect) {
    const nx = clamp(c.x, rect.x, rect.x + rect.w), ny = clamp(c.y, rect.y, rect.y + rect.h);
    const dx = c.x - nx, dy = c.y - ny, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        c.x = nx + (dx / d) * r; c.y = ny + (dy / d) * r;
        return true;
    }
    // the centre is inside: leave by the nearest edge
    const l = c.x - rect.x, rt = rect.x + rect.w - c.x, t = c.y - rect.y, b = rect.y + rect.h - c.y, m = Math.min(l, rt, t, b);
    if (m === l) c.x = rect.x - r; else if (m === rt) c.x = rect.x + rect.w + r; else if (m === t) c.y = rect.y - r; else c.y = rect.y + rect.h + r;
    return true;
}

/** Distance from a point to a rectangle's edge (0 inside). */
export function distRect(p, rect) {
    const dx = Math.max(rect.x - p.x, 0, p.x - rect.x - rect.w), dy = Math.max(rect.y - p.y, 0, p.y - rect.y - rect.h);
    return Math.hypot(dx, dy);
}

/** Centres of the cells of a rect to be rolled flat. */
export function cellsOf(rect, size) {
    const out = [], nx = Math.ceil(rect.w / size), ny = Math.ceil(rect.h / size);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push({ x: rect.x + (i + 0.5) * rect.w / nx, y: rect.y + (j + 0.5) * rect.h / ny });
    return out;
}

/** A point in the vehicle's frame: f metres ahead, l metres to its right. */
export function local(p, d) {
    const c = Math.cos(p.a), s = Math.sin(p.a), dx = d.x - p.x, dy = d.y - p.y;
    return { f: dx * c + dy * s, l: -dx * s + dy * c };
}
