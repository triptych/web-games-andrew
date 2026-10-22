// The jungle: a ring of screens built from a seed. Pure and deterministic, and the same world
// every time for the same seed. Nothing here moves: logs, crocodiles, vines and scorpions are
// functions of the clock (see game.js), so a screen is just a description.
//
// Rules the generator keeps (simtest.mjs checks every one over many seeds):
//  - the first and last 40 px of a surface screen are always clear, so a screen change never lands
//    Harry in a hazard, and the same goes for the first and last 30 px of a tunnel
//  - a pit wider than a jump has a vine over it; a crocodile pit has three crocodiles
//  - a ladder hole is in the middle (LX); a cobra or fire keeps 56 px from it and a pit 44 px, so a jump
//    that clears one lands with room to jump the other
//  - a tunnel wall only stands on a screen with a ladder, so a wall never traps anyone
//  - in every lane of the tunnels (every third screen) there is a ladder at least every 8 screens
//  - 24 treasures, on different screens, 16 on the surface and 8 in the tunnels

import { makeRng } from '../rng.js';
import {
    W, N_SCREENS, TREASURES, LX, TUNNEL_STRIDE, CROC, VINE,
} from '../config.js';

const cache = new Map();
export function getWorld(seed) {
    let w = cache.get(seed);
    if (!w) {
        if (cache.size > 40) cache.delete(cache.keys().next().value);
        w = buildWorld(seed);
        cache.set(seed, w);
    }
    return w;
}

const KINDS = [
    { k: 'clear',      w: 6, ladderOK: true },
    { k: 'log1',       w: 9, ladderOK: true },
    { k: 'log2',       w: 8, ladderOK: true },
    { k: 'log3',       w: 6 },
    { k: 'cobra',      w: 7, ladderOK: true },
    { k: 'fire',       w: 5, ladderOK: true },
    { k: 'pit',        w: 6, ladderOK: true },
    { k: 'tarvine',    w: 9 },
    { k: 'sandvine',   w: 7 },
    { k: 'croc',       w: 8 },
    { k: 'ladder',     w: 8 },
    { k: 'ladderpits', w: 5 },
    { k: 'ladderlog',  w: 5 },
];
const TOTAL_W = KINDS.reduce((a, k) => a + k.w, 0);
const LADDER_KINDS = new Set(['ladder', 'ladderpits', 'ladderlog']);

function pickKind(rng, avoid) {
    for (let tries = 0; tries < 4; tries++) {
        let r = rng() * TOTAL_W;
        for (const k of KINDS) {
            r -= k.w;
            if (r <= 0) { if (k.k !== avoid || tries === 3) return k; break; }
        }
    }
    return KINDS[0];
}

function blank(i) {
    return { i, kind: 'clear', ladder: false, logs: [], pits: [], crocs: [], vine: null, cobras: [], fires: [], treasure: null,
        tunnel: { wall: false, scorp: null } };
}

function addLogs(s, rng, n) {
    const v = rng.range(46, 60), sp = rng.range(115, 135);
    const P = (n - 1) * sp + W + 24 + rng.range(60, 140);
    const phase0 = rng.range(0, P);
    for (let k = 0; k < n; k++) s.logs.push({ v, P, phase: phase0 + k * sp });
}

function addVinePit(s, rng, type) {
    const x0 = rng.range(92, 132), x1 = x0 + 100;
    s.pits.push({ x0, x1, type });
    s.vine = { x: (x0 + x1) / 2, y0: VINE.y0, L: VINE.L, A: VINE.A, T: VINE.T, phi: rng.range(0, Math.PI * 2) };
}

function fillKind(s, kind, rng) {
    s.kind = kind;
    switch (kind) {
        case 'log1': addLogs(s, rng, 1); break;
        case 'log2': addLogs(s, rng, 2); break;
        case 'log3': addLogs(s, rng, 3); break;
        case 'cobra': {
            if (rng() < 0.3) {
                const a = rng.range(90, 140);
                s.cobras.push({ x: a }, { x: rng.range(a + 85, 240) });
            } else s.cobras.push({ x: rng.range(100, 230) });
            break;
        }
        case 'fire': s.fires.push({ x: rng.range(100, 230) }); break;
        case 'pit': {
            const type = rng() < 0.5 ? 'tar' : 'sand';
            if (rng() < 0.4) {
                s.pits.push({ x0: 72, x1: 106, type }, { x0: 214, x1: 248, type });
            } else {
                const x0 = rng.range(100, 186);
                s.pits.push({ x0, x1: x0 + 34, type });
            }
            break;
        }
        case 'tarvine': addVinePit(s, rng, 'tar'); break;
        case 'sandvine': addVinePit(s, rng, 'sand'); break;
        case 'croc': {
            const x0 = rng.range(80, 108);
            s.pits.push({ x0, x1: x0 + 126, type: 'water' });
            const base = rng.range(0, CROC.period);
            const stagger = (rng() < 0.5 ? 1 : -1) * rng.range(0.45, 0.65);
            for (let k = 0; k < 3; k++) s.crocs.push({ x: x0 + 23 + 40 * k, phase: base + k * stagger });
            break;
        }
        case 'ladder': s.ladder = true; break;
        case 'ladderpits': {
            s.ladder = true;
            const type = rng() < 0.5 ? 'tar' : 'sand';
            s.pits.push({ x0: 72, x1: 106, type }, { x0: 214, x1: 248, type });
            break;
        }
        case 'ladderlog': s.ladder = true; addLogs(s, rng, 1); break;
        default: break;
    }
}

/** Replace a screen's content with a bare ladder screen. */
function forceLadder(s) {
    Object.assign(s, blank(s.i), { kind: 'ladder', ladder: true });
}

function laneOf(i) { return i % TUNNEL_STRIDE; }

export function buildWorld(seed) {
    const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
    const N = N_SCREENS;
    const screens = [];
    let prev = '';
    for (let i = 0; i < N; i++) {
        const s = blank(i);
        const k = i === 0 ? KINDS[0] : pickKind(rng, prev);
        fillKind(s, k.k, rng);
        // a ladder can be added to the screens that leave the middle free
        if (k.ladderOK && i !== 0 && rng() < 0.4 && !s.pits.some((p) => p.x1 > LX - 44 && p.x0 < LX + 44)
            && !s.cobras.some((c) => Math.abs(c.x - LX) < 56) && !s.fires.some((f) => Math.abs(f.x - LX) < 56)) {
            s.ladder = true;
        }
        screens.push(s);
        prev = k.k;
    }

    // a ladder at least every 8 screens in every lane of the tunnels
    for (let lane = 0; lane < TUNNEL_STRIDE; lane++) {
        const idx = [];
        for (let i = lane; i < N; i += TUNNEL_STRIDE) idx.push(i);
        if (!idx.some((i) => screens[i].ladder)) forceLadder(screens[idx[idx.length >> 1]]);
        const first = idx.findIndex((i) => screens[i].ladder);
        let since = 0;
        for (let n = 1; n <= idx.length; n++) {
            const s = screens[idx[(first + n) % idx.length]];
            if (s.ladder) since = 0;
            else if (++since >= 8) { if (s.i !== 0) forceLadder(s); since = 0; }
        }
    }

    // tunnel walls: only where there is a ladder
    for (const s of screens) if (s.ladder && rng() < 0.45) s.tunnel.wall = true;

    // treasures: one about every 4 screens, a third of them underground
    const used = new Set([0]);
    const treasures = [];
    for (let k = 0; k < TREASURES; k++) {
        const base = Math.floor((k * N) / TREASURES + 2 + rng.range(-1, 1.99));
        const under = k % 3 === 1;
        let place = null;
        for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
            const i = (((base + d) % N) + N) % N;
            if (used.has(i)) continue;
            if (under && !screens[i].ladder) continue;
            place = i; break;
        }
        if (place === null) {
            for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
                const i = (((base + d) % N) + N) % N;
                if (!used.has(i)) { place = i; break; }
            }
            if (under) forceLadder(screens[place]);
        }
        used.add(place);
        const t = { id: k, kind: k % 4, screen: place, layer: under ? 'tunnel' : 'surface', x: under ? 60 : 288 };
        screens[place].treasure = t;
        treasures.push(t);
    }

    // scorpions
    for (const s of screens) {
        const guard = s.treasure && s.treasure.layer === 'tunnel';
        if (!guard && rng() >= 0.5) continue;
        const v = rng.range(26, 40);
        let lo, hi;
        if (guard) { lo = 80; hi = 135; }
        else if (!s.ladder) { lo = 50; hi = 270; }
        else if (s.tunnel.wall) { if (rng() < 0.5) continue; lo = 80; hi = 135; }
        else if (rng() < 0.5) { lo = 80; hi = 135; }
        else { lo = 190; hi = 290; }
        s.tunnel.scorp = { x0: lo, x1: hi, v, phase: rng.range(0, 2 * (hi - lo)) };
    }

    return { seed, N, screens, treasures, start: 0 };
}

export { LADDER_KINDS };
