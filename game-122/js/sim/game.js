// The simulation. Pure: no DOM, no rendering, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// One pane at a time: the glass starts misted over a station's view. A drop of water is steered
// across it and wipes the mist away, spending water as it goes; beads of rain land on the glass
// and are absorbed for more. A drop that holds too much water slides down and runs off the sill;
// one that wipes itself dry is spent; either way a fresh one beads at the top. Clear most of the
// pane and the rest melts away, the curios in the view are all seen, and the pane becomes a
// postcard in the album. Eight stations make the journey; after that the train runs on through
// the small hours, back past every station, with a rarer curio at each.

import { FIELD, FOG, FOG_CELL, DROP, BEADS, TAP, FLOW, CHIME, SPOT, PANE } from '../config.js';
import { makeRng } from '../rng.js';
import { STATIONS, CURIO_COUNT, paneCurios } from './scenes.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const N = FOG.gw * FOG.gh;
const CELL_AREA = FOG_CELL * FOG_CELL;

export const wipeRadius = (m) => DROP.r0 + DROP.rk * Math.sqrt(Math.max(0, m));
export const beadRadius = (m) => 0.07 + 0.13 * Math.sqrt(m);

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        total: 0,                   // seconds played, all panes
        station: 0,                 // index into STATIONS
        late: false,                // a pass in the small hours (after the journey)
        loopOrder: [],
        loopIdx: 0,
        journeyDone: false,
        albumDone: false,
        panes: 0,                   // panes cleared
        album: {},                  // station id → { visits, found: [ids], seal, best }
        events: [],                 // { type, ... } since the last drain; never saved
    };
    startPane(G);
    return G;
}

/** The pane in front of the player now. */
export const station = (G) => STATIONS[G.station];
export const curios = (G) => paneCurios(G.station, G.late);
export const clearedFrac = (G) => 1 - G.fogSum / (255 * N);

function startPane(G) {
    const rng = G.rng;
    G.paneSeed = rng.int(1, 1e9);
    G.t = 0;
    G.phase = 'play';               // play | reveal | done
    G.melt = 0;
    G.fog = new Uint8Array(N).fill(255);
    G.fogSum = 255 * N;
    G.fogVer = (G.fogVer || 0) + 1;
    G.beads = [];
    G.beadT = 0;
    G.tapCD = 0;
    G.flow = 0;
    G.flowLevel = 0;
    G.chimeAcc = 0;
    G.chimeN = 0;
    G.spotT = 0;
    G.found = [];                   // curio ids seen in this pane
    G.selfFound = [];               // ...of which the player uncovered (not the melt)
    G.stats = { drops: 1, wiped: 0, merges: 0, flowTime: 0, bestFlow: 0 };
    // A few old rain runs already streak the glass, as they would on a real window.
    const runs = rng.int(2, 3);
    for (let i = 0; i < runs; i++) {
        let x = rng.range(1, FIELD.w - 1);
        const y1 = rng.range(2.2, 6.5);
        for (let y = 0; y < y1; y += 0.06) { x += Math.sin(y * 3 + i) * 0.012; wipe(G, x, y, 0.13); }
    }
    for (let i = 0; i < 7; i++) spawnBead(G);
    G.drop = newDrop(rng.range(3, FIELD.w - 3));
    G.events.push({ type: 'pane', station: G.station, late: G.late });
}

function newDrop(x) {
    return { x, y: DROP.spawnY, vx: 0, vy: 0, m: DROP.m0, alive: true, wait: 0, age: 0 };
}

function spawnBead(G) {
    if (G.beads.length >= BEADS.max) return;
    const rng = G.rng;
    const m = rng.range(BEADS.mLo, BEADS.mHi);
    G.beads.push({ x: rng.range(0.3, FIELD.w - 0.3), y: rng.range(0.3, FIELD.h - 0.3), m, roll: 0, age: 0 });
}

/**
 * Wipe the mist in a soft-edged disc. Returns the area cleared (square units, counting partial
 * cells by how much mist left them).
 */
export function wipe(G, x, y, R) {
    const fog = G.fog;
    const inner = R * 0.62, band = R - inner;
    const c0 = Math.max(0, Math.floor((x - R) / FOG_CELL)), c1 = Math.min(FOG.gw - 1, Math.floor((x + R) / FOG_CELL));
    const r0 = Math.max(0, Math.floor((y - R) / FOG_CELL)), r1 = Math.min(FOG.gh - 1, Math.floor((y + R) / FOG_CELL));
    let dec = 0;
    for (let r = r0; r <= r1; r++) {
        const cy = (r + 0.5) * FOG_CELL - y;
        for (let c = c0; c <= c1; c++) {
            const cx = (c + 0.5) * FOG_CELL - x;
            const d = Math.sqrt(cx * cx + cy * cy);
            if (d >= R) continue;
            const v = d <= inner ? 0 : Math.round(255 * (d - inner) / band);
            const i = r * FOG.gw + c;
            if (v < fog[i]) { dec += fog[i] - v; fog[i] = v; }
        }
    }
    if (dec) { G.fogSum -= dec; G.fogVer++; }
    return (dec / 255) * CELL_AREA;
}

/** Share of a disc that is clearer than `clear`. */
function visibleShare(G, x, y, R) {
    let n = 0, clearN = 0;
    const c0 = Math.max(0, Math.floor((x - R) / FOG_CELL)), c1 = Math.min(FOG.gw - 1, Math.floor((x + R) / FOG_CELL));
    const r0 = Math.max(0, Math.floor((y - R) / FOG_CELL)), r1 = Math.min(FOG.gh - 1, Math.floor((y + R) / FOG_CELL));
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const dx = (c + 0.5) * FOG_CELL - x, dy = (r + 0.5) * FOG_CELL - y;
            if (dx * dx + dy * dy > R * R) continue;
            n++;
            if (G.fog[r * FOG.gw + c] < SPOT.clear) clearN++;
        }
    }
    return n ? clearN / n : 1;
}

/** Advance one fixed step. inp = { x, y, a }: x and y in [-1, 1] (y down), a = tap the glass. */
export function step(G, inp, dt) {
    if (G.phase === 'done') return;
    G.t += dt;
    G.total += dt;
    if (G.phase === 'reveal') { stepReveal(G, dt); return; }

    // rain
    G.beadT += dt * BEADS.rate;
    while (G.beadT >= 1) { G.beadT -= 1; spawnBead(G); }
    for (const b of G.beads) b.age += dt;
    G.tapCD = Math.max(0, G.tapCD - dt);

    const d = G.drop;
    let wiped = 0;
    if (!d.alive) {
        d.wait -= dt;
        if (d.wait <= 0) {
            G.drop = newDrop(clamp(d.x, 1, FIELD.w - 1));
            G.stats.drops++;
            G.events.push({ type: 'drop', x: G.drop.x, y: G.drop.y });
        }
    } else {
        d.age += dt;
        if (inp.a && G.tapCD <= 0) {
            G.tapCD = TAP.cooldown;
            let n = 0;
            for (const b of G.beads) if (Math.hypot(b.x - d.x, b.y - d.y) < TAP.reach) { b.roll = 1; n++; }
            G.events.push({ type: 'tap', x: d.x, y: d.y, n });
        }
        const len = Math.hypot(inp.x, inp.y);
        const k = len > 1 ? 1 / len : 1;
        const speed = DROP.speed / (1 + 0.18 * Math.max(0, d.m - 1));
        const slide = DROP.slide * Math.max(0, d.m - DROP.cling);
        const tx = inp.x * k * speed;
        const ty = inp.y * k * speed + slide;
        const e = Math.min(1, dt * 9);
        d.vx += (tx - d.vx) * e;
        d.vy += (ty - d.vy) * e;
        const R = wipeRadius(d.m);
        d.x = clamp(d.x + d.vx * dt, R * 0.5, FIELD.w - R * 0.5);
        d.y = Math.max(R * 0.5, d.y + d.vy * dt);

        wiped = wipe(G, d.x, d.y, R);
        d.m -= wiped * DROP.cost;
        G.stats.wiped += wiped;

        // beads it touches join it
        for (let i = G.beads.length - 1; i >= 0; i--) {
            const b = G.beads[i];
            if (Math.hypot(b.x - d.x, b.y - d.y) < R * 0.85 + beadRadius(b.m)) {
                G.beads.splice(i, 1);
                d.m += b.m;
                G.stats.merges++;
                G.events.push({ type: 'merge', x: b.x, y: b.y, m: d.m });
            }
        }

        if (d.y > FIELD.h + R) {
            d.alive = false; d.wait = DROP.respawn;
            G.events.push({ type: 'runoff', x: d.x });
        } else if (d.m < DROP.mMin) {
            d.alive = false; d.wait = DROP.respawn;
            G.events.push({ type: 'dry', x: d.x, y: d.y });
        }
    }

    // beads tapped loose roll to the drop
    if (G.drop.alive) {
        for (const b of G.beads) {
            if (!b.roll) continue;
            const dx = G.drop.x - b.x, dy = G.drop.y - b.y, l = Math.hypot(dx, dy) || 1;
            const s = Math.min(l, TAP.pull * dt);
            b.x += (dx / l) * s; b.y += (dy / l) * s;
        }
    } else for (const b of G.beads) b.roll = 0;

    // flow: steady wiping of fresh mist
    const inFlow = dt > 0 && wiped / dt >= FLOW.rate;
    G.flow = clamp(G.flow + (inFlow ? FLOW.up : -FLOW.down) * dt, 0, FLOW.max);
    if (inFlow) { G.stats.flowTime += dt; }
    const lvl = Math.floor(G.flow + 1e-9);
    if (lvl !== G.flowLevel) {
        // up a level as soon as it is reached; down only once it has fallen well below
        if (lvl > G.flowLevel || G.flow < G.flowLevel - 0.35) {
            G.flowLevel = lvl > G.flowLevel ? lvl : G.flowLevel - 1;
            G.stats.bestFlow = Math.max(G.stats.bestFlow, G.flowLevel);
            G.events.push({ type: 'flow', level: G.flowLevel });
        }
    }

    // a note for every so much glass wiped
    G.chimeAcc += wiped;
    while (G.chimeAcc >= CHIME.every) {
        G.chimeAcc -= CHIME.every;
        G.events.push({ type: 'chime', i: G.chimeN++, x: d.x, y: d.y, flow: G.flowLevel });
    }

    G.spotT += dt;
    if (G.spotT >= SPOT.every) { G.spotT = 0; checkSpots(G, true); }

    if (clearedFrac(G) >= PANE.complete) {
        G.phase = 'reveal';
        G.melt = 0;
        G.events.push({ type: 'complete', station: G.station, late: G.late });
    }
}

function checkSpots(G, self) {
    for (const c of curios(G)) {
        if (G.found.includes(c.id)) continue;
        if (!self || visibleShare(G, c.x, c.y, c.r) >= SPOT.need) {
            G.found.push(c.id);
            if (self) G.selfFound.push(c.id);
            const known = albumHas(G, c.id);
            G.events.push({ type: 'spot', id: c.id, name: c.name, x: c.x, y: c.y, self, fresh: !known, rare: c === STATIONS[G.station].rare });
        }
    }
}

function albumHas(G, id) {
    const a = G.album[STATIONS[G.station].id];
    return !!a && a.found.includes(id);
}

function stepReveal(G, dt) {
    const before = G.melt;
    G.melt += dt;
    const dec = Math.ceil(255 * dt / PANE.melt) + 1;
    const fog = G.fog;
    let sum = 0;
    for (let i = 0; i < N; i++) { const v = fog[i] > dec ? fog[i] - dec : 0; fog[i] = v; sum += v; }
    G.fogSum = sum;
    G.fogVer++;
    // the drop lets go and runs down
    const d = G.drop;
    if (d.alive) {
        d.vx *= 0.9; d.vy = Math.min(3, Math.max(0, d.vy) + dt * 4); d.y += d.vy * dt;
        if (d.y > FIELD.h + 1) d.alive = false;
    }
    if (before < PANE.melt * 0.5 && G.melt >= PANE.melt * 0.5) checkSpots(G, false);
    if (G.melt >= PANE.melt) finishPane(G);
}

function finishPane(G) {
    G.phase = 'done';
    G.fog.fill(0); G.fogSum = 0; G.fogVer++;
    const s = STATIONS[G.station];
    const list = curios(G);
    const seal = list.every((c) => G.selfFound.includes(c.id));
    const a = G.album[s.id] || (G.album[s.id] = { visits: 0, found: [], seal: false, best: 0, late: false });
    a.visits++;
    for (const id of G.found) if (!a.found.includes(id)) a.found.push(id);
    a.seal = a.seal || seal;
    a.late = a.late || G.late;
    a.best = a.best ? Math.min(a.best, G.t) : G.t;
    G.panes++;
    const last = !G.late && G.station === STATIONS.length - 1;
    G.events.push({ type: 'postcard', station: G.station, late: G.late, seal, time: G.t, found: G.found.slice(), selfFound: G.selfFound.slice(), last });
    if (!G.albumDone && albumCount(G) >= CURIO_COUNT) {
        G.albumDone = true;
        G.events.push({ type: 'albumComplete' });
    }
}

/** Curios in the album, all stations. */
export function albumCount(G) {
    let n = 0;
    for (const k in G.album) n += G.album[k].found.length;
    return n;
}

/** On to the next window (after a postcard). */
export function nextPane(G) {
    if (G.phase !== 'done') return false;
    if (!G.late) {
        if (G.station < STATIONS.length - 1) G.station++;
        else { G.journeyDone = true; G.late = true; shuffleLoop(G); G.station = G.loopOrder[0]; }
    } else {
        G.loopIdx++;
        if (G.loopIdx >= G.loopOrder.length) shuffleLoop(G);
        G.station = G.loopOrder[G.loopIdx];
    }
    startPane(G);
    return true;
}

function shuffleLoop(G) {
    const prev = G.loopOrder[G.loopOrder.length - 1];
    const order = STATIONS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = G.rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    if (order[0] === prev && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    G.loopOrder = order;
    G.loopIdx = 0;
}

// ------------------------------------------------------------------ saves

/** Run-length code the mist: long runs of clear and misted glass shrink to a few numbers. */
function encodeFog(fog) {
    const out = [];
    let i = 0;
    while (i < fog.length) {
        const v = fog[i];
        let n = 1;
        while (i + n < fog.length && fog[i + n] === v) n++;
        if (n > 2) out.push(-n, v); else for (let k = 0; k < n; k++) out.push(v);
        i += n;
    }
    return out;
}

function decodeFog(arr) {
    const fog = new Uint8Array(N);
    let i = 0;
    for (let k = 0; k < arr.length; k++) {
        if (arr[k] < 0) { fog.fill(arr[k + 1], i, i - arr[k]); i -= arr[k]; k++; } else fog[i++] = arr[k];
    }
    if (i !== N) throw new Error('bad mist data');
    return fog;
}

export function serialize(G) {
    const { rng, events, fog, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state(), fog: encodeFog(fog) }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, fog, ...rest } = d;
    if (!STATIONS[rest.station]) throw new Error('unknown station');
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [], fog: decodeFog(fog) };
    G.rng.setState(rngState);
    return G;
}
