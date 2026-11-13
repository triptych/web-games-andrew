// Spawning and level setup. Pure: everything random comes from G.rng.

import { GROUND, UFO, CEIL, FLOOR, PICKUP_LIFE } from '../config.js';
import { SPECIMENS, ENEMIES, LEVELS, PICKUPS } from './data.js';

export const level = (G) => LEVELS[G.level];
export const holdCap = (G) => UFO.hold + G.up.hold;
export const hullMax = (G) => UFO.hull + G.up.hull;
export const intakeX = (G) => G.W / 2;

/** Weighted pick from { key: weight }. */
export function weighted(rng, table) {
    let sum = 0;
    for (const k in table) sum += table[k];
    let r = rng() * sum;
    for (const k in table) { r -= table[k]; if (r < 0) return k; }
    return Object.keys(table)[0];
}

/** An x on the ground at least `away` from x0 (the saucer), inside the level. */
export function groundX(G, x0, away) {
    for (let i = 0; i < 30; i++) {
        const x = G.rng.range(2, G.W - 2);
        if (Math.abs(x - x0) >= away) return x;
    }
    return x0 + away < G.W - 2 ? x0 + away : Math.max(2, x0 - away);
}

export function spawnSpecimen(G, kind, x, extra = {}) {
    const s = {
        id: G.nextId++, kind, x, y: GROUND, vx: 0, vy: 0,
        dir: G.rng() < 0.5 ? -1 : 1, state: 'walk', turnT: G.rng.range(0.5, 3), daze: 0, noBeam: 0,
        dropped: false, wake: null, ...extra,
    };
    G.specs.push(s);
    return s;
}

export function spawnEnemy(G, kind, x) {
    const d = ENEMIES[kind];
    const e = {
        id: G.nextId++, kind, x, dir: G.rng() < 0.5 ? -1 : 1,
        cd: G.rng.range(1.5, 3) + (kind === 'boss' ? 2 : 0), wind: 0, fire: 0, aimX: 0,
        turnT: G.rng.range(1, 4), zap: 0, inv: 0, hp: d.hp || 1, pattern: 0, deflT: 0,
    };
    G.enemies.push(e);
    return e;
}

export function spawnPickup(G, ux) {
    const kind = weighted(G.rng, Object.fromEntries(Object.entries(PICKUPS).map(([k, p]) => [k, p.weight])));
    const x = Math.max(2, Math.min(G.W - 2, ux + G.rng.range(-14, 14)));
    const y = G.rng.range(CEIL + 1.2, FLOOR - 1.5);
    G.pickups.push({ id: G.nextId++, kind, x, y, life: PICKUP_LIFE });
}

/** Lay out episode G.level from scratch: walkers, enemies, timers. Upgrades, score and lives carry over. */
export function startLevel(G) {
    const L = level(G);
    G.W = L.W;
    G.phase = 'brief';
    G.timeLeft = L.time;
    G.lt = 0;
    G.specs = [];
    G.enemies = [];
    G.shots = [];
    G.jets = [];
    G.pickups = [];
    G.respawns = [];
    G.specT = 2;
    G.pickT = G.rng.range(6, 10);
    G.jetT = L.jets ? L.jets * 0.7 : 0;
    G.hurried = false;
    G.quotaMet = false;
    G.bossDown = false;
    G.report = null;
    G.offers = [];
    G.stats = { banked: {}, bankedN: 0, hits: 0, bonks: 0, crashes: 0, destroyed: 0 };
    const cx = G.W / 2;
    G.ufo = {
        x: cx, y: 3.2, vx: 0, vy: 0, hull: hullMax(G), energy: 100, beam: false, lock: false,
        inv: 0, dead: 0, hold: [], defects: 0, glitch: null, dockT: 0, dropCd: 0, fullT: 0,
        fx: { turbo: 0, mega: 0, shield: 0, net: 0, dazzle: 0 },
    };
    for (let i = 0; i < L.pop; i++) spawnSpecimen(G, weighted(G.rng, L.spec), groundX(G, -999, 0));
    for (const [kind, n] of L.enemies) {
        for (let i = 0; i < n; i++) {
            const x = kind === 'boss' ? cx + (G.rng() < 0.5 ? -12 : 12) : groundX(G, cx, 9);
            spawnEnemy(G, kind, x);
        }
    }
}

export const enemyBox = (e) => ({ w: ENEMIES[e.kind].w, h: ENEMIES[e.kind].h });
export const specBox = (s) => ({ w: SPECIMENS[s.kind].w, h: SPECIMENS[s.kind].h });
