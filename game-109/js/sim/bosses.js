// The bosses. Every fifth wave is one: the Mothership (wave 5), the Crab (10), the Overlord (15),
// then round again, tougher each time. Each fights in three phases keyed on its health, and when it
// dies it comes apart over two seconds in a chain of explosions. Pure, like the rest of js/sim.

import { W, H, clamp, shoot, aimAt, bulletSpeed, emit } from './util.js';

export const BOSS_NAMES = ['MOTHERSHIP', 'CRAB WARDEN', 'THE OVERLORD'];
const BASE_HP = [420, 1100, 1700];
const REST_Y = [54, 60, 52];
const SHAPES = [
    { r: 24, parts: [{ dx: 0, dy: 0, r: 15 }, { dx: -21, dy: 3, r: 9 }, { dx: 21, dy: 3, r: 9 }] },
    { r: 28, parts: [{ dx: 0, dy: 0, r: 16 }, { dx: -27, dy: 6, r: 9 }, { dx: 27, dy: 6, r: 9 }] },
    { r: 26, parts: [{ dx: 0, dy: 0, r: 14 }, { dx: -24, dy: -2, r: 9 }, { dx: 24, dy: -2, r: 9 }, { dx: 0, dy: 11, r: 8 }] },
];

/** The props for addEnemy('boss', ...). `cycle` counts completed rounds of the three bosses. */
export function bossProps(G, idx, cycle) {
    const hp = Math.round(BASE_HP[idx] * (1 + cycle * 0.5));
    return {
        ai: 'boss', hp, maxHp: hp, r: SHAPES[idx].r, parts: SHAPES[idx].parts.map((q) => ({ ...q })),
        x: W / 2, y: -52, inv: true, cnt: true,
        boss: { idx, cycle, st: 'enter', t: 0, a: 1.4, s: 0.5, c: 1, pi: 0, pt: 0, rot: 0, adds: 0, dyingT: 0, boomT: 0, bs: 'idle', bt: 0 },
    };
}

function fan(G, x, y, n, spread, ang, sp, k = 0) {
    for (let i = 0; i < n; i++) shoot(G, x, y, ang + (i - (n - 1) / 2) * spread, sp, k);
}
function ring(G, x, y, n, rot, sp, k = 0) {
    for (let i = 0; i < n; i++) shoot(G, x, y, rot + (i / n) * Math.PI * 2, sp, k);
}
const addDrones = (G, e, n) => {
    for (let i = 0; i < n; i++) {
        const m = i % 2 ? 1 : -1;
        G.adds.push({ type: 'drone', props: { cnt: false, path: { k: 'bez', d: 3, p: [e.x + m * 10, e.y + 10, e.x + m * 80, e.y + 70, e.x - m * 60, e.y + 150, e.x + m * 30, H + 40] } } });
    }
};

// ------------------------------------------------------------------ the three
function mothership(G, e, b, dt, f, rate) {
    e.x = W / 2 + 66 * Math.sin(b.t * 0.5);
    e.y = REST_Y[0] + 5 * Math.sin(b.t * 1.3);
    const sp = bulletSpeed(G) * 1.1;
    b.a -= dt * rate;
    if (b.a <= 0) {
        if (f > 0.66) { fan(G, e.x, e.y + 12, 5, 0.24, aimAt(G, e.x, e.y), sp); b.a = 1.7; }
        else if (f > 0.33) { fan(G, e.x, e.y + 12, 5, 0.24, aimAt(G, e.x, e.y), sp); b.a = 1.45; }
        else { b.rot += 0.27; ring(G, e.x, e.y + 6, 14, b.rot, sp * 0.8); fan(G, e.x, e.y + 12, 3, 0.2, aimAt(G, e.x, e.y), sp * 1.1, 1); b.a = 1.35; }
        emit(G, { type: 'eshot', k: 'boss' });
    }
    if (f <= 0.66) {                       // the side cannons wake up
        b.s -= dt * rate;
        if (b.s <= 0) { b.s = 0.55; shoot(G, e.x - 21, e.y + 12, Math.PI / 2, sp * 1.15, 2); shoot(G, e.x + 21, e.y + 12, Math.PI / 2, sp * 1.15, 2); }
    }
    if (f <= 0.33) {                       // and it calls for help
        b.c -= dt;
        if (b.c <= 0) { b.c = 6; addDrones(G, e, 2); }
    }
}

function crab(G, e, b, dt, f, rate) {
    e.x = W / 2 + 52 * Math.sin(b.t * 0.42);
    e.y = REST_Y[1] + 4 * Math.sin(b.t * 1.1);
    const sp = bulletSpeed(G);
    b.pt += dt;
    if (b.pt > 7) { b.pt = 0; b.pi = (b.pi + 1) % 3; b.s = 0.4; }
    b.s -= dt;
    if (b.pi === 0) {                      // spiral arms
        if (b.s <= 0) {
            b.s = 0.15 / rate; b.rot += 0.5;
            const arms = f < 0.4 ? 4 : 3;
            ring(G, e.x, e.y + 8, arms, b.rot, sp * 0.85);
        }
    } else if (b.pi === 1) {               // a curtain with two gaps in it
        if (b.s <= 0) {
            b.s = 1.2 / rate;
            const gap = G.rng.int(1, 10);
            for (let i = 0; i < 12; i++) if (Math.abs(i - gap) > 0.5 && Math.abs(i - gap - 1) > 0.5) shoot(G, 9 + i * 18.4, e.y + 12, Math.PI / 2, sp * 0.8, 0);
        }
    } else if (b.s <= 0) {                 // aimed bursts from the claws
        b.s = 0.8 / rate;
        fan(G, e.x - 27, e.y + 12, 3, 0.16, aimAt(G, e.x - 27, e.y), sp * 1.05, 1);
        fan(G, e.x + 27, e.y + 12, 3, 0.16, aimAt(G, e.x + 27, e.y), sp * 1.05, 1);
    }
    if (f < 0.5) {
        b.c -= dt;
        if (b.c <= 0) { b.c = 5.5; addDrones(G, e, 2); }
    }
}

function overlord(G, e, b, dt, f, rate) {
    const sp = bulletSpeed(G);
    b.pt += dt;
    if (b.pt > 8.5) { b.pt = 0; b.pi = (b.pi + 1) % 3; b.s = 0.5; b.bs = 'idle'; b.bt = 0; e.beam = null; }
    b.s -= dt;
    e.y = REST_Y[2] + 4 * Math.sin(b.t * 0.9);
    if (b.pi === 0) {                      // the beam: a thin warning line, then a column of light
        b.bt += dt;
        if (b.bs === 'idle') {
            // drift above the player to line it up, then lock
            const tx = clamp(G.player.alive ? G.player.x : W / 2, 30, W - 30);
            e.x += clamp(tx - e.x, -48 * dt, 48 * dt);
            if (b.bt > 1.5 / rate) { b.bs = 'warn'; b.bt = 0; e.beam = { x: e.x, w: 3, on: false }; emit(G, { type: 'beamwarn', x: e.x }); }
        } else if (b.bs === 'warn') {
            if (b.bt > 1.0) { b.bs = 'fire'; b.bt = 0; e.beam = { x: e.beam.x, w: 20, on: true }; emit(G, { type: 'beam', x: e.beam.x }); }
        } else if (b.bs === 'fire') {
            e.beam.w = 20 - 8 * clamp(b.bt / 1.0, 0, 1);
            if (b.bt > 1.0) { b.bs = 'idle'; b.bt = 0; e.beam = null; }
        }
        if (b.s <= 0) { b.s = 1.5 / rate; fan(G, e.x, e.y + 12, 3, 0.3, aimAt(G, e.x, e.y), sp, 1); }
    } else if (b.pi === 1) {               // a pair of rotating rings
        e.x += clamp(W / 2 - e.x, -30 * dt, 30 * dt);
        if (b.s <= 0) { b.s = 0.95 / rate; b.rot += Math.PI / 16; ring(G, e.x, e.y + 8, 16, b.rot, sp * 0.75); }
    } else {                               // it strafes and the sky rains
        e.x = W / 2 + 60 * Math.sin(b.t * 0.7);
        b.c -= dt;
        if (b.c <= 0) { b.c = 0.14 / rate; shoot(G, G.rng.range(8, W - 8), 4, Math.PI / 2, sp * 0.85, 0); }
        if (b.s <= 0) { b.s = 1.0 / rate; fan(G, e.x, e.y + 12, 2, 0.12, aimAt(G, e.x, e.y), sp * 1.2, 2); }
    }
    if (f < 0.4 && b.pi !== 0) {
        b.adds += dt;
        if (b.adds > 6) { b.adds = 0; addDrones(G, e, 2); }
    }
}

const FIGHT = [mothership, crab, overlord];

// ------------------------------------------------------------------ the update
export function updateBoss(G, e, dt) {
    const b = e.boss;
    b.t += dt;
    if (b.st === 'enter') {
        const u = clamp(b.t / 3, 0, 1), eased = 1 - (1 - u) * (1 - u);
        e.y = -52 + (REST_Y[b.idx] + 52) * eased;
        if (u >= 1) { b.st = 'fight'; b.t = 0; e.inv = false; }
        return;
    }
    if (b.st === 'dying') return dying(G, e, b, dt);
    const f = e.hp / e.maxHp;
    const rate = (1 + b.cycle * 0.2 + G.diff * 0.008) * (f < 0.4 ? 1.2 : 1);
    FIGHT[b.idx](G, e, b, dt, f, rate);
}

/** Called by the game when a boss's health runs out. */
export function startBossDeath(G, e) {
    e.boss.st = 'dying';
    e.boss.dyingT = 0;
    e.boss.boomT = 0;
    e.inv = true;
    e.beam = null;
}

function dying(G, e, b, dt) {
    b.dyingT += dt;
    b.boomT -= dt;
    // shake apart: wobble in place while the chain of explosions runs across the hull
    e.x += Math.sin(b.dyingT * 55) * 0.35;
    if (b.boomT <= 0 && b.dyingT < 2.2) {
        b.boomT = 0.085;
        const q = e.parts[G.rng.int(0, e.parts.length - 1)];
        const x = e.x + q.dx + (G.rng() - 0.5) * q.r * 1.6, y = e.y + q.dy + (G.rng() - 0.5) * q.r * 1.4;
        emit(G, { type: 'boom', x, y, size: G.rng() < 0.3 ? 2 : 1, c: G.rng.int(0, 5) });
    }
    if (b.dyingT >= 2.4 && !e.bossDone) {
        e.bossDone = true;
        emit(G, { type: 'bossdown', x: e.x, y: e.y, idx: b.idx });
        emit(G, { type: 'boom', x: e.x, y: e.y, size: 3, c: 0 });
    }
}
