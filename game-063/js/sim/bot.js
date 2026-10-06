// A golfer that searches: it clones the world, tries a grid of clubs × aims × powers, plays each shot
// out with the real physics, scores where the ball ends up and refines around the best few. Used by
// dev/simtest.mjs to prove every hole can be played at par, and by the title-screen demo.
//
// Scoring a resting ball: geodesic distance to the target over playable ground (so doglegs and
// island holes are understood), plus a penalty for bad lies; hazards are heavily penalised; boss
// hits and monster kills are rewarded.

import { SURF } from './realms.js';
import { CLUBS, CLUB_ORDER } from './clubs.js';
import { runUntilSettled } from './world.js';

const GEO_CELL = 2;
const LIE_PEN = { [SURF.rough]: 5, [SURF.sand]: 9, [SURF.dune]: 6, [SURF.snow]: 9, [SURF.quick]: 14, [SURF.ash]: 4 };
const IDEAL = { gopher: 7, worm: 13, yeti: 24, ogre: 24, bogey: 8 };

// Geodesic distance from the cup over the course, on a coarse grid (Dijkstra, 8-neighbour).
export function geoField(course) {
    if (course._geo) return course._geo;
    const step = GEO_CELL / course.cell;
    const nx = Math.ceil(course.nx / step), nz = Math.ceil(course.nz / step);
    const cost = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = course.x0 + i * GEO_CELL, z = course.z0 + j * GEO_CELL;
        const s = course.surfAt(x, z);
        cost[j * nx + i] = s === SURF.void || s === SURF.oob ? 4 : s === SURF.water || s === SURF.lava ? 2.2 : 1;
    }
    const dist = new Float64Array(nx * nz).fill(Infinity);  // Float64: a float32 store would round below the popped key and skip it
    const ci = Math.round((course.cup.x - course.x0) / GEO_CELL), cj = Math.round((course.cup.z - course.z0) / GEO_CELL);
    // binary heap
    const heap = [];
    const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const k0 = cj * nx + ci;
    dist[k0] = 0; push(0, k0);
    const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
        const [d, k] = pop();
        if (d > dist[k]) continue;
        const i = k % nx, j = (k / nx) | 0;
        for (const [di, dj, w] of N) {
            const a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
            const kk = b * nx + a;
            const nd = d + w * GEO_CELL * (cost[k] + cost[kk]) * 0.5;
            if (nd < dist[kk]) { dist[kk] = nd; push(nd, kk); }
        }
    }
    course._geo = { nx, nz, dist };
    return course._geo;
}

function geoAt(course, x, z) {
    const g = geoField(course);
    const i = Math.max(0, Math.min(g.nx - 1, Math.round((x - course.x0) / GEO_CELL)));
    const j = Math.max(0, Math.min(g.nz - 1, Math.round((z - course.z0) / GEO_CELL)));
    const d = g.dist[j * g.nx + i];
    // plus the straight bit from the cell centre
    return (d === Infinity ? 999 : d);
}

// Damage dealt so far, counting Lord Bogey's first form (his HP resets when he transforms).
function bossProgress(b) {
    if (b.kind === 'bogey') return b.phase === 1 ? 3 - b.hp : 3 + (6 - b.hp);
    return b.max - b.hp;
}

// Score a world whose shot has finished (lower is better).
export function scoreEnd(w0, w) {
    const s = w.s, B = s.ball;
    if (s.phase === 'done') return -10000 + s.strokes;
    let score = 0;
    if (s.phase === 'hazard') score += 400;
    const course = w.course;
    // monsters, pickups
    score -= (s.stats.monsters - w0.s.stats.monsters) * 6;
    score -= (s.stats.coins - w0.s.stats.coins) * 0.5;
    if (s.boss) {
        const hits = bossProgress(s.boss) - bossProgress(w0.s.boss);
        score -= hits * 300;
        if (!w0.s.sealed) { /* boss already down: normal golf */ }
        else if (s.sealed) {
            const def = w.hole.boss;
            const T = s.boss.kind === 'bogey' && s.boss.phase === 2 ? { x: s.boss.dragon[0], z: s.boss.dragon[1] - 14 } : { x: def.x, z: def.z };
            const d = Math.hypot(B.x - T.x, B.z - T.z);
            if (s.phase !== 'hazard') score += Math.abs(d - (IDEAL[s.boss.kind] ?? 10)) * 1.2 + (LIE_PEN[B.surf] ?? 0) * 2;
            return score;
        }
    }
    if (s.phase === 'hazard') return score + geoAt(course, s.prev.x, s.prev.z);
    const d = Math.hypot(B.x - course.cup.x, B.z - course.cup.z);
    let geo = geoAt(course, B.x, B.z);
    if (d < 6) geo = d;
    score += geo + (LIE_PEN[B.surf] ?? 0);
    // on the green, a putt from far away is worth more than its length
    if (B.surf === SURF.green) score += d > 3 ? 2 + d * 0.15 : d * 0.4;
    else score += 4;
    return score;
}

function tryShot(w, shot, acc = 0, pm = 1) {
    const c = w.clone(true);
    c.setAim(shot.yaw);
    c.s.armed = { spell: shot.spell ?? null, item: null };
    if (!c.shoot({ club: shot.club, power: Math.min(1, shot.power * pm), acc, perfect: acc === 0 })) return Infinity;
    // play out the flight (stop at settle so the boss turn isn't counted)
    let t = 0;
    while (t < 50 && c.s.phase === 'flight') { c.step(1 / 240); t += 1 / 240; }
    return scoreEnd(w, c);
}

// Risk-aware score: the perfect strike plus a hook, a slice and a fat/thin hit, weighted.
function robust(w, shot, risk) {
    if (!risk) return tryShot(w, shot);
    const putt = shot.club === 'putter';
    const a = putt ? 0.25 : 0.3 * risk;
    const outs = [tryShot(w, shot), tryShot(w, shot, a, 1), tryShot(w, shot, -a, 1), tryShot(w, shot, 0, 1 + (putt ? 0.08 : 0.05) * risk), tryShot(w, shot, 0, 1 - (putt ? 0.08 : 0.05) * risk)];
    return outs[0] * 0.4 + (outs[1] + outs[2] + outs[3] + outs[4]) * 0.15;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Pick a shot. opts: { effort: 1 (default) }
export function chooseShot(w, opts = {}) {
    const s = w.s, B = s.ball;
    const T = w.target();
    const dist = Math.hypot(T.x - B.x, T.z - B.z);
    const lie = w.lieSurf();
    const direct = Math.atan2(T.x - B.x, T.z - B.z);
    const route = w.defaultAim();
    let clubs;
    if (lie === SURF.green && !s.sealed) clubs = dist > 30 ? ['putter', 'wedge'] : ['putter'];
    else if (dist < 14 && !s.sealed) clubs = ['putter', 'wedge'];
    else if (dist < 60) clubs = s.sealed ? ['wedge', 'iron', 'putter'] : ['wedge', 'iron'];
    else if (dist < 110) clubs = ['iron', 'wedge', 'driver'];
    else clubs = ['driver', 'iron', 'wedge'];
    const centres = Math.abs(wrap(route - direct)) > 0.05 ? [direct, route] : [direct];
    const cands = [];
    for (const club of clubs) {
        const putt = club === 'putter';
        const span = putt ? 0.22 : 0.75, ystep = putt ? 0.035 : 0.1;
        const powers = putt ? range(0.06, 1, 0.045) : range(0.2, 1, 0.08);
        for (const cy of centres) for (let dy = -span; dy <= span + 1e-6; dy += ystep) for (const power of powers) cands.push({ club, yaw: cy + dy, power });
    }
    // spells: Seeker on putts/approaches near the cup, Fireball against a boss
    const spell = pickSpell(w, dist, lie);
    const risk = opts.risk ?? 0;
    for (const c of cands) { c.spell = spell; c.score = tryShot(w, c); }
    cands.sort((a, b) => a.score - b.score);
    // re-score the most promising under mis-hits, then refine around the best few
    const pool = cands.slice(0, risk ? 14 : 4);
    if (risk) { for (const c of pool) c.score = robust(w, c, risk); pool.sort((a, b) => a.score - b.score); }
    const top = pool.slice(0, risk ? 3 : 4);
    let best = top[0];
    for (const t of top) {
        const putt = t.club === 'putter';
        for (let dy = -2; dy <= 2; dy++) for (let dp = -2; dp <= 2; dp++) {
            if (!dy && !dp) continue;
            if (risk && (Math.abs(dy) + Math.abs(dp)) % 2) continue;
            const c = { club: t.club, yaw: t.yaw + dy * (putt ? 0.009 : 0.025), power: Math.min(1, Math.max(0.03, t.power + dp * (putt ? 0.011 : 0.02))), spell };
            c.score = robust(w, c, risk);
            if (c.score < best.score) best = c;
        }
    }
    return best;
}

function pickSpell(w, dist, lie) {
    const s = w.s;
    const has = (id, mp) => s.spells.includes(id) && s.mp >= mp;
    if (s.sealed && has('fire', 3) && dist < 45) return 'fire';
    if (!s.sealed && has('seek', 4) && dist < 40 && dist > 4) return 'seek';
    if (has('ward', 2) && s.wind.speed > 3 && dist > 60) return 'ward';
    return null;
}

function range(a, b, st) { const out = []; for (let v = a; v <= b + 1e-6; v += st) out.push(+v.toFixed(3)); return out; }

// Play a whole hole. noise: 0 = perfect strikes; >0 = timing errors (power ±, hook/slice) from rng.
export function playHole(w, opts = {}) {
    const noise = opts.noise ?? 0;
    const rng = opts.rng;
    if (opts.risk === undefined) opts = { ...opts, risk: noise };
    const log = [];
    let guard = 0;
    while (w.s.phase !== 'done' && w.s.phase !== 'failed' && guard++ < 40) {
        if (w.s.phase !== 'aim') { w.step(1 / 240); continue; }
        const shot = chooseShot(w, opts);
        w.setAim(shot.yaw);
        w.s.armed.spell = shot.spell && w.s.mp >= 2 ? shot.spell : null;
        let power = shot.power, acc = 0, perfect = true;
        if (noise > 0) {
            const r = () => rng.next() * 2 - 1;
            const putt = shot.club === 'putter';
            power = Math.max(0.03, Math.min(1, power * (1 + r() * (putt ? 0.1 : 0.06) * noise)));
            acc = r() * 0.5 * noise;
            perfect = Math.abs(acc) < 0.07;
            w.setAim(shot.yaw + r() * (putt ? 0.035 : 0.02) * noise);
        }
        w.shoot({ club: shot.club, power, acc, perfect });
        log.push({ yaw: +w.s.aimYaw.toFixed(3), club: shot.club, power: +power.toFixed(2), acc: +acc.toFixed(2), score: +shot.score.toFixed(1) });
        runUntilSettled(w);
        if (opts.onShot) opts.onShot(w, shot);
    }
    return { strokes: w.s.strokes, phase: w.s.phase, log };
}

export { CLUBS, CLUB_ORDER };
