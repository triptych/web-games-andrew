// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.

import { FIELD, PLAYER, PICKUP, ROUND } from '../config.js';
import { makeRng } from '../rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newGame(seed = 1) {
    const G = {
        v: 1,                       // save format version
        seed,
        rng: makeRng(seed),
        t: 0,
        score: 0,
        over: false,
        player: { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0, dash: 0 },
        pickups: [],
        events: [],                 // { type, ... } since the last drain; never saved
    };
    for (let i = 0; i < PICKUP.count; i++) spawnPickup(G);
    return G;
}

function spawnPickup(G) {
    G.pickups.push({ x: G.rng.range(1, FIELD.w - 1), y: G.rng.range(1, FIELD.h - 1) });
}

/** Advance one fixed step. inp = { x, y, a }: x and y in [-1, 1] (y down), a = pressed since the last step. */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    const p = G.player;
    const len = Math.hypot(inp.x, inp.y);
    const k = len > 1 ? 1 / len : 1;              // diagonals are not faster
    if (inp.a && p.dash <= 0) { p.dash = 0.25; G.events.push({ type: 'dash' }); }
    const speed = PLAYER.speed * (p.dash > 0 ? 2.2 : 1);
    p.dash = Math.max(0, p.dash - dt);
    p.vx = inp.x * k * speed;
    p.vy = inp.y * k * speed;
    p.x = clamp(p.x + p.vx * dt, PLAYER.radius, FIELD.w - PLAYER.radius);
    p.y = clamp(p.y + p.vy * dt, PLAYER.radius, FIELD.h - PLAYER.radius);

    for (let i = G.pickups.length - 1; i >= 0; i--) {
        const c = G.pickups[i];
        if (Math.hypot(c.x - p.x, c.y - p.y) < PLAYER.radius + PICKUP.radius) {
            G.pickups.splice(i, 1);
            G.score += PICKUP.score;
            G.events.push({ type: 'pickup', x: c.x, y: c.y });
            spawnPickup(G);
        }
    }
    if (G.t >= ROUND.seconds) {
        G.over = true;
        G.events.push({ type: 'over', score: G.score });
    }
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
