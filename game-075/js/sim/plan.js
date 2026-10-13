// Reachability and the lock planner. A realm is a set of places joined by
// locks: castle gates (keys), cracked walls (a plasma charge), the static wall
// (the grey pixel), data rivers (the bridge, which can only be in one place at
// a time), the Citadel gate (three chrome shards) and the boss. The planner
// searches the states of those locks breadth-first and returns the order to
// open them in, or null if the realm can't be finished. The tests use it to
// prove every realm (and every REMIX shuffle) solvable; the bot follows it.

import { T, FLOOR, GATE, CHASM, CRACK, BARRIER } from '../config.js';

const cx = (e) => e.x + e.w / 2;
const cy = (e) => e.y + e.h / 2;

/** Lookup tables from tile to gate / crack group, built once per map. */
function tables(M) {
    if (M._tables) return M._tables;
    const gateOf = new Int16Array(M.gw * M.gh).fill(-1);
    const crackOf = new Int16Array(M.gw * M.gh).fill(-1);
    M.gates.forEach((g, i) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) gateOf[(g.y + y) * M.gw + g.x + x] = i; });
    M.cracks.forEach((c, i) => { for (const k of c.tiles) crackOf[k] = i; });
    const padAt = new Int16Array(M.gw * M.gh).fill(-1);
    M.pads.forEach((p, i) => {
        for (let y = p.y / T; y < (p.y + p.h) / T; y++) for (let x = p.x / T; x < (p.x + p.w) / T; x++) padAt[y * M.gw + x] = i;
    });
    M._tables = { gateOf, crackOf, padAt };
    return M._tables;
}

/**
 * Flood fill of every tile the 8 px square can stand on, from `start`, given
 * a lock state. `hyp` = { gates:Set, cracks:Set, barrier:bool, bridge:rect|null }.
 * Without `hyp`, uses the world as it is.
 */
export function flood(w, hyp = null, start = null) {
    const M = w.map;
    const { gateOf, crackOf, padAt } = tables(M);
    const laid = hyp ? hyp.bridge : (w.items || []).find((i) => i.kind === 'bridge' && i.laid) || null;
    const pass = (x, y) => {
        const t = M.at(x, y);
        if (t === FLOOR) return true;
        const k = y * M.gw + x;
        if (t === GATE) return !!hyp && hyp.gates.has(gateOf[k]);
        if (t === CRACK) return !!hyp && hyp.cracks.has(crackOf[k]);
        if (t === BARRIER) return !!hyp && hyp.barrier;
        if (t === CHASM && laid) {
            const px = x * T + 4, py = y * T + 4;
            return px > laid.x && px < laid.x + laid.w && py > laid.y && py < laid.y + laid.h;
        }
        return false;
    };
    const out = new Uint8Array(M.gw * M.gh);
    const s = start || M.start;
    const sx = Math.floor((s.x + 4) / T), sy = Math.floor((s.y + 4) / T);
    const q = [sy * M.gw + sx];
    out[q[0]] = 1;
    while (q.length) {
        const k = q.pop();
        const x = k % M.gw, y = (k / M.gw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= M.gw || ny >= M.gh) continue;
            const nk = ny * M.gw + nx;
            if (out[nk] || !pass(nx, ny)) continue;
            out[nk] = 1; q.push(nk);
        }
        const pi = padAt[k];
        if (pi >= 0 && M.pads[pi].link >= 0) {
            const to = M.pads[M.pads[pi].link];
            const nk = ((to.y + to.h / 2) / T | 0) * M.gw + ((to.x + to.w / 2) / T | 0);
            if (!out[nk]) { out[nk] = 1; q.push(nk); }
        }
    }
    return out;
}

/** What the player can reach right now (used by the bat and to rescue items). */
export function reachMask(w) {
    const M = w.map;
    const hyp = { gates: new Set(), cracks: new Set(), barrier: !!(M.barrier && M.barrier.broken), bridge: (w.items || []).find((i) => i.kind === 'bridge' && i.laid) || null };
    M.gates.forEach((g, i) => { if (g.open >= 0.7) hyp.gates.add(i); });
    M.cracks.forEach((c, i) => { if (c.broken) hyp.cracks.add(i); });
    return flood(w, hyp);
}

const tileOf = (M, x, y) => Math.floor(y / T) * M.gw + Math.floor(x / T);
const inR = (M, R, e) => !!R[tileOf(M, cx(e), cy(e))];

/** Every lock in the realm, with what it needs and where you stand to open it. */
export function locks(w) {
    const M = w.map;
    const out = [];
    M.gates.forEach((g, i) => {
        if (g.home) return;
        const approach = [];
        for (let x = 0; x < g.w; x++) approach.push((g.y + g.h) * M.gw + g.x + x);
        if (g.color === 'chrome') out.push({ type: 'shards', gate: i, approach });
        else out.push({ type: 'gate', gate: i, color: g.color, approach });
    });
    M.cracks.forEach((c, i) => {
        const approach = [];
        for (const k of c.tiles) for (const d of [1, -1, M.gw, -M.gw]) if (M.tiles[k + d] === FLOOR) approach.push(k + d);
        out.push({ type: 'crack', crack: i, approach });
    });
    if (M.barrier) {
        const b = M.barrier, approach = [];
        for (let x = 0; x < b.w; x++) approach.push((b.y + b.h) * M.gw + b.x + x);
        out.push({ type: 'barrier', approach });
    }
    M.bridgeSpots.forEach((s, i) => {
        const approach = [];
        if (s.orient === 'v') for (let x = s.x / T | 0; x < (s.x + s.w) / T; x++) { approach.push((s.y / T - 1) * M.gw + x); approach.push(((s.y + s.h) / T) * M.gw + x); }
        else for (let y = s.y / T | 0; y < (s.y + s.h) / T; y++) { approach.push(y * M.gw + s.x / T - 1); approach.push(y * M.gw + (s.x + s.w) / T); }
        out.push({ type: 'bridge', spot: i, rect: s, approach });
    });
    if (w.boss && !w.boss.dead) out.push({ type: 'boss' });
    return out;
}

/**
 * Breadth-first search over lock states. Returns the list of steps (each a
 * lock to open, then { type: 'deliver' }), or null if the realm can't be won.
 */
export function solve(w) {
    const M = w.map;
    const L = locks(w);
    const start = {
        gates: new Set(M.gates.map((g, i) => (g.open >= 0.7 ? i : -1)).filter((i) => i >= 0)),
        cracks: new Set(M.cracks.map((c, i) => (c.broken ? i : -1)).filter((i) => i >= 0)),
        barrier: !!(M.barrier && M.barrier.broken),
        bridge: (w.items || []).find((i) => i.kind === 'bridge' && i.laid) || null,
        bridgeSpot: -1,
        bossDead: !w.boss || (w.boss.dead && !w.boss.active),
        steps: [],
    };
    const item = (pred) => (w.items || []).find(pred);
    const bridgeItem = item((i) => i.kind === 'bridge');
    const key = (s) => [[...s.gates].sort().join('.'), [...s.cracks].sort().join('.'), s.barrier ? 1 : 0, s.bridgeSpot, s.bossDead ? 1 : 0].join('|');
    const seen = new Set([key(start)]);
    const queue = [start];
    const homeRoom = M.rooms[M.homeVault];
    const homeTile = (homeRoom.y0 + 12) * M.gw + homeRoom.x0 + 20;
    const startPt = w.player && !w.player.dead ? w.player : M.start;
    // a tile just inside the arena's door stands for "the boss can be reached"
    const arena = w.boss ? M.rooms[w.boss.room] : null;
    const arenaTile = arena ? (arena.y0 + 20) * M.gw + arena.x0 + 20 : -1;
    let guard = 0;
    while (queue.length && guard++ < 4000) {
        const s = queue.shift();
        const R = flood(w, s, startPt);
        const reachable = (e) => e && (e.holder === 'player' || inR(M, R, e));
        // the goal: the chalice to the Sunset Keep's vault
        const chal = item((i) => i.kind === 'chalice');
        const chaliceOk = s.bossDead && (chal ? reachable(chal) : (arenaTile >= 0 && R[arenaTile]));
        if (chaliceOk && R[homeTile]) return [...s.steps, { type: 'deliver' }];
        const sword = item((i) => i.kind === 'sword');
        for (const lk of L) {
            const ns = { gates: new Set(s.gates), cracks: new Set(s.cracks), barrier: s.barrier, bridge: s.bridge, bridgeSpot: s.bridgeSpot, bossDead: s.bossDead, steps: [...s.steps, lk] };
            const near = lk.approach ? lk.approach.some((k) => R[k]) : true;
            let ok = false;
            if (lk.type === 'gate') {
                if (s.gates.has(lk.gate)) continue;
                const k = item((i) => i.kind === 'key' && i.color === lk.color);
                ok = near && reachable(k);
                ns.gates.add(lk.gate);
            } else if (lk.type === 'shards') {
                if (s.gates.has(lk.gate)) continue;
                const alive = (w.dragons || []).filter((d) => d.shard && !d.dead);
                const loose = (w.pickups || []).filter((p) => p.kind === 'shard' && !p.taken);
                ok = near && alive.every((d) => inR(M, R, d)) && loose.every((p) => inR(M, R, p)) && (!alive.length || reachable(sword));
                ns.gates.add(lk.gate);
            } else if (lk.type === 'crack') {
                if (s.cracks.has(lk.crack)) continue;
                const ch = item((i) => i.kind === 'charge');
                ok = near && (reachable(ch) || (M.dispenser && R[tileOf(M, M.dispenser.x + 4, M.dispenser.y + 4)]));
                ns.cracks.add(lk.crack);
            } else if (lk.type === 'barrier') {
                if (s.barrier) continue;
                ok = near && reachable(item((i) => i.kind === 'pixel'));
                ns.barrier = true;
            } else if (lk.type === 'bridge') {
                if (s.bridgeSpot === lk.spot) continue;
                const where = s.bridgeSpot >= 0 ? L.find((l) => l.type === 'bridge' && l.spot === s.bridgeSpot).approach.some((k) => R[k]) : reachable(bridgeItem);
                ok = near && !!bridgeItem && where;
                ns.bridge = lk.rect; ns.bridgeSpot = lk.spot;
            } else if (lk.type === 'boss') {
                if (s.bossDead) continue;
                ok = !!w.boss && !!R[arenaTile] && reachable(sword);
                ns.bossDead = true;
                // the arena gate shuts behind you and opens again when he falls
                const cg = M.gates.findIndex((g) => g.color === 'chrome');
                if (cg >= 0) ns.gates.add(cg);
            }
            if (!ok) continue;
            const k = key(ns);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push(ns);
        }
    }
    return null;
}
