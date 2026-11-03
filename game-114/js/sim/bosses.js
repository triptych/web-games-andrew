// The four bosses. Each fights in a 24-tile arena that locks behind the player. Pure.
//
// A boss is { k, x, y, w, h, hp, maxHp, state, st, t, phase, vulnerable, ... }: x its centre,
// y its feet, as for every other body. Its patterns read G.player and push enemy shots, minions
// and hazards (floor shockwaves, the Queen's beam).

import { BOSSES } from '../config.js';
import { ev, addEnemy, eShot, aimAt, lobAt, hurtPlayer, inBox } from './common.js';

const FLOOR = 2;

export function spawnBoss(G) {
    const a = G.level.arena;
    const d = BOSSES[a.boss];
    const hp = Math.round(d.hp * (G.hard ? 1.25 : 1));
    const B = {
        k: a.boss, w: d.w, h: d.h, hp, maxHp: hp, x: a.x1 - 5, y: FLOOR, vx: 0, vy: 0,
        state: 'intro', st: 2.0, t: 0, phase: 1, vulnerable: false, flash: 0, face: -1, dead: false, deadT: 0, n: 0,
    };
    if (B.k === 'warden') { B.x = (a.x0 + a.x1) / 2 + 4; B.y = 15; B.baseY = 8.6; }
    if (B.k === 'gravemaw') { B.x = a.x1 - 6; B.hy = -1; B.h = 0; B.tx = B.x; B.st = 1.6; }
    if (B.k === 'queen') { B.x = a.x1 - 3.2; B.st = 2.6; }
    G.boss = B;
    ev(G, 'bossIntro', { k: B.k, name: d.name, x: B.x, y: B.y });
    return B;
}

const pick = (G, opts) => {
    let tot = 0;
    for (const [, w] of opts) tot += w;
    let r = G.rng() * tot;
    for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
    return opts[0][0];
};

// ====================================================================== the Brood Mother
function brood(G, B, dt) {
    const p = G.player, a = G.level.arena;
    B.vulnerable = true;
    const fast = B.phase === 2 ? 1.35 : 1;
    switch (B.state) {
        case 'intro':
            B.vulnerable = false;
            if ((B.st -= dt) <= 0) { B.state = 'walk'; B.st = 1.2; }
            if (B.st < 1.2 && !B.roared) { B.roared = true; ev(G, 'roar', { x: B.x, y: B.y + 2, k: 'brood' }); }
            break;
        case 'walk':
            B.face = p.x < B.x ? -1 : 1;
            B.vx = B.face * 1.6 * fast;
            if ((B.st -= dt) <= 0) {
                const kids = G.enemies.filter((e) => e.k === 'skitter').length;
                B.state = pick(G, [['spit', 3], ['charge', 2.4], ['birth', kids < 3 ? 1.6 : 0]]);
                B.st = B.state === 'charge' ? 0.7 : 0.45;
                B.n = 0;
                B.vx = 0;
                if (B.state === 'charge') ev(G, 'roar', { x: B.x, y: B.y + 2, k: 'brood' });
            }
            break;
        case 'spit':
            B.vx = 0;
            if ((B.st -= dt) <= 0) {
                const n = B.phase === 2 ? 5 : 3;
                for (let i = 0; i < n; i++) {
                    const tx = p.x + (i - (n - 1) / 2) * 1.7;
                    const v = lobAt(B.x + B.face * 1.8, B.y + 2.2, tx, FLOOR, 20, 1.05 + i * 0.06);
                    eShot(G, B.x + B.face * 1.8, B.y + 2.2, v.vx, v.vy, 'acid', 20);
                }
                ev(G, 'spit', { x: B.x + B.face * 1.8, y: B.y + 2.2, big: true });
                B.n++;
                B.st = 0.55;
                if (B.n >= (B.phase === 2 ? 2 : 1)) { B.state = 'walk'; B.st = 1.3 / fast; }
            }
            break;
        case 'birth':
            if ((B.st -= dt) <= 0) {
                for (let i = 0; i < 2; i++) {
                    const e = addEnemy(G, 'skitter', B.x + B.face * 1.5, B.y + 0.6, { vy: 8 + i * 3, vx: B.face * (3 + i * 2) });
                    e.face = B.face;
                }
                ev(G, 'hatch', { x: B.x, y: B.y + 1, big: true });
                B.state = 'walk'; B.st = 1.4 / fast;
            }
            break;
        case 'charge':
            if (B.st > 0) { B.st -= dt; B.face = p.x < B.x ? -1 : 1; B.vx = 0; break; }
            B.vx = B.face * 11 * fast;
            if ((B.face < 0 && B.x <= a.x0 + B.w / 2 + 0.2) || (B.face > 0 && B.x >= a.x1 - B.w / 2 - 0.2)) {
                B.vx = 0; B.state = 'stun'; B.st = 1.1;
                ev(G, 'slam', { x: B.x + B.face * 2, y: FLOOR, big: true });
            }
            break;
        case 'stun':
            if ((B.st -= dt) <= 0) { B.state = 'walk'; B.st = 1.0; }
            break;
    }
    B.x = Math.max(a.x0 + B.w / 2, Math.min(a.x1 - B.w / 2, B.x + B.vx * dt));
}

// ====================================================================== WARDEN-9
function warden(G, B, dt) {
    const p = G.player, a = G.level.arena;
    const mid = (a.x0 + a.x1) / 2;
    B.vulnerable = B.state !== 'intro';
    const fast = B.phase === 2 ? 1.3 : 1;
    const drift = () => {
        const tx = mid + Math.sin(B.t * 0.55) * 7.5;
        B.x += (tx - B.x) * Math.min(1, dt * 1.6);
        B.y += (B.baseY + Math.sin(B.t * 1.7) * 0.5 - B.y) * Math.min(1, dt * 2.5);
    };
    switch (B.state) {
        case 'intro':
            B.y += (B.baseY - B.y) * Math.min(1, dt * 1.4);
            if ((B.st -= dt) <= 0) { B.state = 'hover'; B.st = 1.0; ev(G, 'roar', { x: B.x, y: B.y + 1, k: 'warden' }); }
            break;
        case 'hover':
            drift();
            if ((B.st -= dt) <= 0) {
                const m = G.enemies.filter((e) => e.k === 'missile').length;
                B.state = pick(G, [['burst', 3], ['missiles', m < 2 ? 2 : 0], ['slam', 2]]);
                B.n = 0; B.st = 0.4;
                if (B.state === 'slam') { B.st = 0.9; ev(G, 'warn', { x: B.x, y: B.y, k: 'slam' }); }
            }
            break;
        case 'burst':
            drift();
            if ((B.st -= dt) <= 0) {
                const sx = B.x, sy = B.y + 0.6;
                const base = Math.atan2(p.y + 0.9 - sy, p.x - sx);
                const spread = B.phase === 2 ? [-0.22, 0, 0.22] : [0];
                for (const s of spread) eShot(G, sx, sy, Math.cos(base + s) * 11, Math.sin(base + s) * 11, 'bolt');
                ev(G, 'eshot', { x: sx, y: sy, k: 'warden' });
                B.n++;
                B.st = 0.17;
                if (B.n >= 5) { B.state = 'hover'; B.st = 1.2 / fast; }
            }
            break;
        case 'missiles':
            drift();
            if ((B.st -= dt) <= 0) {
                const n = B.phase === 2 ? 4 : 3;
                for (let i = 0; i < n; i++) {
                    const side = i % 2 ? 1 : -1;
                    addEnemy(G, 'missile', B.x + side * 1.4, B.y + 1, { vx: side * (2 + i), vy: 6 + i * 0.8, st: 0 });
                }
                ev(G, 'launch', { x: B.x, y: B.y + 1 });
                B.state = 'hover'; B.st = 1.6 / fast;
            }
            break;
        case 'slam':
            B.st -= dt;
            if (B.st > 0) { B.x += (p.x - B.x) * Math.min(1, dt * 3); break; }
            B.vy = -26;
            B.y += B.vy * dt;
            if (B.y <= FLOOR) {
                B.y = FLOOR; B.vy = 0; B.state = 'slammed'; B.st = 0.9;
                ev(G, 'slam', { x: B.x, y: FLOOR, big: true });
                for (const dir of [-1, 1]) G.hazards.push({ k: 'wave', x: B.x + dir * 1.6, y: FLOOR, dir, speed: 9 * fast, life: 2.6, w: 0.7, h: 0.9 });
            }
            break;
        case 'slammed':
            if ((B.st -= dt) <= 0) { B.state = 'rise'; }
            break;
        case 'rise':
            B.y += (B.baseY - B.y) * Math.min(1, dt * 2.2);
            if (Math.abs(B.y - B.baseY) < 0.3) { B.state = 'hover'; B.st = 1.0 / fast; }
            break;
    }
}

// ====================================================================== GRAVEMAW
function gravemaw(G, B, dt) {
    const p = G.player, a = G.level.arena;
    const fast = B.phase === 2 ? 1.25 : 1;
    switch (B.state) {
        case 'intro':
            B.rumble = (B.rumble || 0) - dt;
            if (B.rumble <= 0) { B.rumble = 0.3; ev(G, 'rumble', { x: B.tx, y: FLOOR }); }
            if ((B.st -= dt) <= 0) { B.state = 'erupt'; ev(G, 'roar', { x: B.x, y: FLOOR + 4, k: 'gravemaw' }); }
            break;
        case 'burrow':
            B.st -= dt;
            if (B.st > 0.55) B.tx = Math.max(a.x0 + 2.5, Math.min(a.x1 - 2.5, p.x));
            B.rumble = (B.rumble || 0) - dt;
            if (B.rumble <= 0) { B.rumble = 0.22; ev(G, 'rumble', { x: B.tx, y: FLOOR }); }
            if (B.st <= 0) { B.x = B.tx; B.state = 'erupt'; ev(G, 'erupt', { x: B.x, y: FLOOR }); }
            break;
        case 'erupt':
            B.x = B.tx;
            B.hy = Math.min(9.5, B.hy + 24 * dt);
            if (B.hy >= 9.5) { B.state = 'exposed'; B.st = 2.8 / fast; B.n = 0; }
            break;
        case 'exposed': {
            B.st -= dt;
            const shots = B.phase === 2 ? 2 : 1;
            const at = [1.9, 0.9];
            if (B.n < shots && B.st < at[B.n] / fast) {
                const n = B.phase === 2 ? 12 : 9;
                const off = B.n * 0.3;
                for (let i = 0; i < n; i++) {
                    const ang = off + (i / n) * Math.PI * 2;
                    eShot(G, B.x, B.hy - 0.6, Math.cos(ang) * 6.5, Math.sin(ang) * 6.5, 'ring');
                }
                ev(G, 'ring', { x: B.x, y: B.hy - 0.6 });
                B.n++;
            }
            if (B.st <= 0) B.state = 'sink';
            break;
        }
        case 'sink':
            B.hy -= 12 * dt;
            if (B.hy <= -1) {
                B.hy = -1;
                B.state = 'burrow';
                B.st = (B.phase === 2 && G.rng() < 0.5 ? 0.9 : 1.5) / fast;
            }
            break;
    }
    // the body is a column from the floor to the head
    B.y = FLOOR;
    B.h = Math.max(0, B.hy - FLOOR);
    B.vulnerable = B.h > 0.8 && B.state !== 'intro';
}

// ====================================================================== the Hive Queen
function queen(G, B, dt) {
    const p = G.player, a = G.level.arena;
    B.vulnerable = B.state !== 'intro';
    const fast = 1 + (B.phase - 1) * 0.2;
    switch (B.state) {
        case 'intro':
            if ((B.st -= dt) <= 0) { B.state = 'idle'; B.st = 1.0; }
            if (B.st < 1.6 && !B.roared) { B.roared = true; ev(G, 'roar', { x: B.x, y: B.y + 7, k: 'queen' }); }
            break;
        case 'idle':
            if ((B.st -= dt) <= 0) {
                const opts = [['spray', 3], ['eggs', G.enemies.length < 5 ? 2.2 : 0]];
                if (B.phase >= 2) opts.push(['beam', 3]);
                if (B.phase >= 3 && G.enemies.filter((e) => e.k === 'wisp').length < 2) opts.push(['wisps', 1.4]);
                B.state = pick(G, opts);
                B.st = 0.5; B.n = 0;
                if (B.state === 'beam') {
                    B.st = 0.95;
                    B.beamY = G.rng() < 0.5 ? 2.45 : 3.45;
                    G.hazards.push({ k: 'beam', y: B.beamY, x0: a.x0, x1: B.x - 2, warn: 0.95, on: 0.5, h: 0.5 });
                    ev(G, 'warn', { x: B.x - 2, y: B.beamY, k: 'beam', high: B.beamY > 3 });
                }
            }
            break;
        case 'spray':
            if ((B.st -= dt) <= 0) {
                const sx = B.x - 2.2, sy = B.y + 6.8;
                const base = Math.atan2(p.y + 0.9 - sy, p.x - sx);
                const n = B.phase >= 3 ? 7 : 5;
                for (let i = 0; i < n; i++) {
                    const ang = base + (i - (n - 1) / 2) * 0.19;
                    eShot(G, sx, sy, Math.cos(ang) * 7, Math.sin(ang) * 7, 'spit');
                }
                ev(G, 'spit', { x: sx, y: sy, big: true });
                B.n++;
                B.st = 0.6;
                if (B.n >= Math.min(2, B.phase)) { B.state = 'idle'; B.st = 1.6 / fast; }
            }
            break;
        case 'eggs':
            if ((B.st -= dt) <= 0) {
                for (let i = 0; i < 1 + B.phase; i++) {
                    const tx = a.x0 + 3 + G.rng() * (B.x - a.x0 - 8);
                    const v = lobAt(B.x - 2, B.y + 7.5, tx, FLOOR, 18, 1.2 + i * 0.12);
                    eShot(G, B.x - 2, B.y + 7.5, v.vx, v.vy, 'egg', 18);
                }
                ev(G, 'launch', { x: B.x - 2, y: B.y + 7.5, k: 'eggs' });
                B.state = 'idle'; B.st = 1.4 / fast;
            }
            break;
        case 'beam':
            if ((B.st -= dt) <= -0.5) { B.state = 'idle'; B.st = 1.0 / fast; }
            break;
        case 'wisps':
            if ((B.st -= dt) <= 0) {
                for (let i = 0; i < 2; i++) addEnemy(G, 'wisp', B.x - 2.5, B.y + 5 + i * 2, { vx: -4, vy: i ? 2 : -2 });
                ev(G, 'hatch', { x: B.x - 2.5, y: B.y + 6, big: true });
                B.state = 'idle'; B.st = 1.0;
            }
            break;
    }
}

const PATTERNS = { brood, warden, gravemaw, queen };

export function stepBoss(G, dt) {
    const B = G.boss;
    if (!B) return;
    B.t += dt;
    B.flash = Math.max(0, B.flash - dt);
    if (B.dead) {
        B.deadT -= dt;
        B.boomT = (B.boomT || 0) - dt;
        if (B.boomT <= 0 && B.deadT > 0.6) {
            B.boomT = 0.22;
            const bh = B.k === 'gravemaw' ? Math.max(2, B.hy - FLOOR) : B.h;
            ev(G, 'boom', { x: B.x + (G.rng() - 0.5) * B.w, y: B.y + G.rng() * bh, r: 1.6, kind: 'boss' });
        }
        return;
    }
    const prev = B.phase;
    const f = B.hp / B.maxHp;
    B.phase = B.k === 'queen' ? (f < 0.33 ? 3 : f < 0.66 ? 2 : 1) : (f < 0.5 ? 2 : 1);
    if (B.phase !== prev) {
        ev(G, 'phase', { k: B.k, phase: B.phase, x: B.x, y: B.y + B.h / 2 });
        // KESTREL drops a med kit into the arena
        const a = G.level.arena;
        G.pickups.push({ k: 'med', x: a.x0 + 3 + Math.floor(G.rng() * 6), y: FLOOR, id: 100 + B.phase, taken: false, drop: true });
        ev(G, 'supply', { x: G.pickups[G.pickups.length - 1].x, y: FLOOR });
    }
    PATTERNS[B.k](G, B, dt);
    // contact
    const p = G.player;
    if (!p.dead && B.state !== 'intro' && B.h > 0.5) {
        const pb = { x: p.x, y: p.y, w: p.w, h: p.h };
        if (Math.abs(pb.x - B.x) * 2 < pb.w + B.w * 0.85 && pb.y < B.y + B.h * 0.95 && B.y < pb.y + pb.h) {
            if (hurtPlayer(G, 1, 'boss')) p.vx = (p.x < B.x ? -1 : 1) * 6;
        }
    }
    if (B.hp <= 0) {
        B.dead = true;
        B.vulnerable = false;
        B.deadT = B.k === 'queen' ? 4.5 : 3.2;
        ev(G, 'bossDown', { k: B.k, x: B.x, y: B.y + Math.max(1, B.h) / 2 });
        for (const e of G.enemies) if (!e.dead) { e.dead = true; ev(G, 'kill', { k: e.k, x: e.x, y: e.y + e.h / 2, from: 'boss' }); }
        G.ebul.length = 0;
        G.hazards.length = 0;
    }
}

export function stepHazards(G, dt) {
    const p = G.player;
    for (const h of G.hazards) {
        h.life = (h.life ?? 99) - dt;
        if (h.k === 'wave') {
            h.x += h.dir * h.speed * dt;
            const a = G.level.arena;
            if (a && (h.x < a.x0 || h.x > a.x1)) h.life = 0;
            if (!p.dead && inBox(p.x, p.y + 0.1, h, p.w / 2) && p.y < h.y + h.h) hurtPlayer(G, 1, 'wave');
        } else if (h.k === 'beam') {
            if (h.warn > 0) { h.warn -= dt; if (h.warn <= 0) ev(G, 'beam', { y: h.y, x0: h.x0, x1: h.x1 }); }
            else {
                h.on -= dt;
                if (h.on <= 0) h.life = 0;
                else if (!p.dead && p.x > h.x0 && p.x < h.x1 && p.y < h.y + h.h / 2 && p.y + p.h > h.y - h.h / 2) hurtPlayer(G, 1, 'beam');
            }
        }
    }
    if (G.hazards.some((h) => h.life <= 0)) G.hazards = G.hazards.filter((h) => h.life > 0);
}
