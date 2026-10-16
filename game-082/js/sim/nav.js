// A map of where you can get to in a sector, made by actually jumping. Pure.
//
// Every run of standing surface is a node. From sample points on each one, the real body mover
// (the same one the player uses) tries a straight jump, jumps holding left or right for a while,
// and walking off each end; wherever the body lands is an edge. The bot plans on this graph, and
// the sim test proves with it that every enemy, the air current and the top gap can be reached.
// A pure function of the level, so it is cached per level.

import { PLAYER, STEP } from '../config.js';
import { buildLevel } from './levels.js';
import { moveBody, segments, segmentAt } from './physics.js';

const JUMP_HOLDS = [0.06, 0.14, 0.24, 0.36, 0.5, 0.7, 9];
const WALK_HOLDS = [0, 0.12, 0.3, 0.55, 9];
const cache = new Map();

/** Fly one action from (x0, y0) standing; where does it land? */
export function simulate(L, segs, x0, y0, act) {
    const b = { x: x0, y: y0, w: PLAYER.w, h: PLAYER.h, vx: 0, vy: 0, ground: true };
    let t = 0, air = 0;
    if (act.kind === 'jump') { b.vy = -PLAYER.jumpV; b.ground = false; }
    while (t < 4) {
        t += STEP;
        let dir = act.dir;
        if (act.kind === 'jump') { if (t > act.hold) dir = 0; }
        else if (!b.ground) { air += STEP; if (air > act.hold) dir = 0; }
        else if (t > 2.5) return null;          // walked into a wall
        b.vx = dir * PLAYER.speed;
        if (!b.ground) b.vy = Math.min(PLAYER.maxFall, b.vy + PLAYER.gravity * STEP);
        moveBody(L, b, STEP);
        if (b.landed) {
            const s = segmentAt(segs, b.x, b.y, b.w);
            return s ? { seg: s.id, x: b.x, time: t, wrapped: !!b.wrapped } : null;
        }
    }
    return null;
}

/** Standing x range on a segment (a body hangs a little over each end). */
export function standRange(s) {
    return [s.c0 + 0.35, s.c1 + 0.65];
}

export function navFor(idx) {
    if (cache.has(idx)) return cache.get(idx);
    const L = buildLevel(idx);
    const segs = segments(L);
    const edges = segs.map(() => []);
    for (const s of segs) {
        const [lo, hi] = standRange(s);
        const xs = [];
        for (let x = lo; x < hi; x += 0.9) xs.push(x);
        xs.push(hi);
        const seen = new Set();
        const add = (x0, act) => {
            const r = simulate(L, segs, x0, s.r, act);
            if (!r || (r.seg === s.id && Math.abs(r.x - x0) < 0.6)) return;
            const key = `${r.seg}:${Math.round(r.x)}:${Math.round(x0)}`;
            if (seen.has(key)) return;
            seen.add(key);
            edges[s.id].push({ from: s.id, x0, act, to: r.seg, x1: r.x, time: r.time, wrapped: r.wrapped });
        };
        for (const x0 of xs) {
            add(x0, { kind: 'jump', dir: 0, hold: 0 });
            for (const dir of [-1, 1]) for (const hold of JUMP_HOLDS) add(x0, { kind: 'jump', dir, hold });
        }
        for (const hold of WALK_HOLDS) { add(lo, { kind: 'walk', dir: -1, hold }); add(hi, { kind: 'walk', dir: 1, hold }); }
    }
    const nav = { idx, segs, edges };
    cache.set(idx, nav);
    return nav;
}

/** Cheapest route from (segment, x) to any segment in `goals` (a Set). Returns a list of edges. */
export function route(nav, from, x, goals) {
    if (goals.has(from)) return [];
    const n = nav.segs.length;
    const dist = new Array(n).fill(Infinity), via = new Array(n).fill(null), at = new Array(n).fill(0);
    dist[from] = 0; at[from] = x;
    const open = new Set([from]);
    while (open.size) {
        let u = -1;
        for (const k of open) if (u < 0 || dist[k] < dist[u]) u = k;
        open.delete(u);
        if (goals.has(u)) {
            const out = [];
            for (let k = u; k !== from; k = via[k].from) out.unshift(via[k]);
            return out;
        }
        for (const e of nav.edges[u]) {
            const c = dist[u] + Math.abs(at[u] - e.x0) / PLAYER.speed + e.time + 0.15;
            if (c < dist[e.to]) { dist[e.to] = c; via[e.to] = e; at[e.to] = e.x1; open.add(e.to); }
        }
    }
    return null;
}

/** Every segment reachable from `from`. */
export function reachable(nav, from) {
    const seen = new Set([from]), q = [from];
    while (q.length) {
        const u = q.shift();
        for (const e of nav.edges[u]) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
    }
    return seen;
}
