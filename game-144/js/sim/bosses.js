// The six bosses. Each has phases (own HP bar, own patterns, a time limit) and destructible parts that are
// mounted enemies: break a part and its attack stops. Pure.
//
// B = { id, key, x, y, t, phase, pt (phase time), hp, maxhp, vuln, coreW: {x,y,r}, entering, s (boss state) }

import { FIELD, BOSS_HP, STAGE_BOSS_HP } from '../config.js';
import { BOSSES } from './data/world.js';
import { emit } from './patterns.js';
import { spawnEnemy, killEnemy, ev, addScore, cancelBullets, dropItem, dropGems } from './core.js';

const TAU = Math.PI * 2;

/** Fire `fn` every `period` seconds of boss time, per key. */
function every(B, key, period, fn) {
    B.tm[key] = (B.tm[key] ?? period * 0.5) - B.dt;
    if (B.tm[key] <= 0) { B.tm[key] += period; fn(); }
}
const src = (B, ox = 0, oy = 0, c) => ({ x: B.x + ox, y: B.y + oy, ang: B.s.ang || 0, c: c ?? B.c, id: B.id });
const partsAlive = (G, B, type) => G.enemies.filter((e) => e.parent === B.id && !e.dead && (!type || e.type === type || e.part === type));
const bob = (B, ax = 1.5, ay = 2.5, fx = 0.35, fy = 0.5) => { B.x = B.hx + Math.sin(B.t * fx) * ax; B.y = B.hy + Math.sin(B.t * fy) * ay; };
function track(G, B, k = 0.6, lo = 3, hi = FIELD.h - 3) {
    const ty = Math.max(lo, Math.min(hi, G.player.y));
    B.y += (ty - B.y) * Math.min(1, B.dt * k);
}

// ---------------------------------------------------------------------------- definitions
export const BOSS_DEFS = {
    // 1. A dreadnought you fly over and under: its hull is solid; the core opens once its engines are down.
    bellwether: {
        hx: 22.5, hy: 9, c: 0, core: { ox: -6.2, oy: 0, r: 1.5 },
        // the hull is solid; its engines hang above and below the stern, so you fly along the hull to reach them
        walls: [{ x: -5.2, y: -2.4, w: 13.5, h: 4.8 }],
        parts: [
            { type: 'turret', ox: -3, oy: -2.9 }, { type: 'turret', ox: -3, oy: 2.9 },
            { type: 'bigturret', ox: 2.2, oy: -3.0 }, { type: 'turret', ox: 4.5, oy: 3.0 },
            { type: 'engine', ox: 7.6, oy: -3.6, tag: 'engine' }, { type: 'engine', ox: 7.6, oy: 3.6, tag: 'engine' },
        ],
        phases: [
            { hp: 520, time: 45, armored: true, step(G, B) {
                bob(B, 0.6, 1.4, 0.3, 0.45);
                // the core is shut until both engines are down (or the clock runs out)
                B.vuln = partsAlive(G, B, 'engine').length === 0 || B.pt > 32;
                every(B, 'curtain', 4.0, () => emit(G, 'curtain', src(B, -6, 0), { rows: 11, speed: 6, gap: 4 }));
                if (B.vuln) every(B, 'fan', 1.1, () => emit(G, 'fan', src(B, -6, 0), { n: 9, arc: 1.4, speed: 8 }));
            } },
            { hp: 700, time: 50, step(G, B) {
                bob(B, 0.8, 2.6, 0.3, 0.5);
                B.vuln = true;
                every(B, 'spiral', 0.14, () => { B.s.ang = (B.s.ang || 0) + 0.23; emit(G, 'ring', src(B, -6, 0), { n: 4, speed: 5.2, off: B.s.ang, step: 0 }); });
                every(B, 'aim', 1.9, () => emit(G, 'aimed', src(B, -6, 0, 3), { n: 5, spread: 0.16, speed: 8.5 }));
            } },
            { hp: 620, time: 50, step(G, B) {
                bob(B, 1.2, 3.2, 0.4, 0.6);
                B.vuln = true;
                every(B, 'stop', 1.6, () => emit(G, 'stopgo', src(B, -6, 0), { n: 18, speed: 7, at: 0.55, wait: 0.5, speed2: 9 }));
                every(B, 'laser', 4.2, () => emit(G, 'laser', src(B, -6, 0, 0), { warm: 1.0, life: 1.1, w: 1.0 }));
            } },
        ],
    },

    // 2. A crystal serpent: the body is a chain of segments that shoot; the head is the core.
    wyrm: {
        hx: 22, hy: 9, c: 2, core: { ox: 0, oy: 0, r: 1.3 }, trail: true,
        parts: Array.from({ length: 12 }, (_, i) => ({ type: 'segment', follow: (i + 1) * 4, hp: 3 })),
        phases: [
            { hp: 650, time: 50, step(G, B) {
                B.x = B.hx + Math.sin(B.t * 0.7) * 5; B.y = B.hy + Math.sin(B.t * 1.4) * 5.5;
                B.vuln = true;
                every(B, 'aim', 1.0, () => emit(G, 'aimed', src(B), { n: 5, spread: 0.16, speed: 9 }));
                every(B, 'split', 2.4, () => emit(G, 'split', src(B, 0, 0, 2), { n: 3, at: 0.8, ring: 10, speed: 5, speed2: 5 }));
            } },
            { hp: 760, time: 50, step(G, B) {
                B.x = B.hx + 2 + Math.sin(B.t * 0.5) * 3; B.y = B.hy + Math.sin(B.t * 0.9) * 6;
                B.vuln = true;
                every(B, 'breath', 3.6, () => emit(G, 'laser', src(B, -1, 0, 2), { warm: 0.9, life: 1.3, w: 0.9 }));
                every(B, 'shard', 0.35, () => emit(G, 'fan', src(B), { n: 3, arc: 0.5, speed: 7.5, k: 'needle', c: 1 }));
            } },
            { hp: 620, time: 50, step(G, B) {
                B.x = B.hx + Math.sin(B.t * 0.9) * 6; B.y = B.hy + Math.sin(B.t * 1.8) * 5;
                B.vuln = true;
                every(B, 'flower', 1.1, () => emit(G, 'flower', src(B), { n: 18, speed: 5.5, curve: 0.7 }));
                // segments blow up one by one into rings
                every(B, 'pop', 2.2, () => { const s = partsAlive(G, B)[0]; if (s) { emit(G, 'ring', s, { n: 12, speed: 5, c: 1 }); killEnemy(G, s, 'pop'); } });
            } },
        ],
    },

    // 3. The engine of the mothership: a wall of pipes; its eye opens and shuts.
    organ: {
        hx: 27, hy: 9, c: 0, core: { ox: -1.2, oy: 0, r: 1.8 },
        walls: [{ x: 0.4, y: -9, w: 6, h: 18 }],
        parts: [
            { type: 'turret', ox: -0.4, oy: -7 }, { type: 'bigturret', ox: -0.6, oy: -4 }, { type: 'turret', ox: -0.4, oy: -2.2 },
            { type: 'turret', ox: -0.4, oy: 2.2 }, { type: 'bigturret', ox: -0.6, oy: 4 }, { type: 'turret', ox: -0.4, oy: 7 },
        ],
        phases: [
            { hp: 700, time: 50, step(G, B) {
                B.vuln = (B.pt % 6.5) < 4;                       // the eye: open 4 s, shut 2.5 s
                if (B.vuln !== B.s.open) { B.s.open = B.vuln; ev(G, 'eye', { open: B.vuln }); }
                every(B, 'curtain', 2.8, () => emit(G, 'curtain', src(B, -2, 0), { rows: 12, speed: 6, gap: 3 }));
                if (B.vuln) every(B, 'aim', 0.7, () => emit(G, 'aimed', src(B, -1.5, 0, 3), { n: 3, spread: 0.2, speed: 9 }));
            } },
            { hp: 820, time: 55, step(G, B) {
                B.vuln = true;
                every(B, 'tent', 3.0, () => {
                    const up = (B.s.k = (B.s.k || 0) + 1) % 2;
                    emit(G, 'laser', src(B, -1, up ? -6 : 6, 0), { ang: Math.PI + (up ? 0.35 : -0.35), warm: 1.0, life: 1.6, w: 0.8, spin: up ? -0.3 : 0.3 });
                });
                every(B, 'ring', 0.9, () => emit(G, 'ring', src(B, -1.5, 0), { n: 16, speed: 5.5 }));
            } },
            { hp: 700, time: 55, step(G, B) {
                B.vuln = true;
                every(B, 'accel', 1.2, () => emit(G, 'accel', src(B, -1.5, 0, 3), { n: 14, acc: 7, speed: 10 }));
                every(B, 'home', 3.0, () => emit(G, 'homing', src(B, -1.5, 0, 2), { n: 4, speed: 4 }));
                every(B, 'curtain', 3.4, () => emit(G, 'curtain', src(B, -2, 0), { rows: 14, speed: 5, gap: 4 }));
            } },
        ],
    },

    // 4. Admiral Voss's war-frame: a cannon arm, missile pods and a beam sword. Break the arms, lose the attacks.
    titan: {
        hx: 24, hy: 9, c: 0, core: { ox: 0.4, oy: -1.2, r: 1.4 },
        parts: [
            { type: 'bigturret', ox: -2.4, oy: 1.8, tag: 'cannon' },
            { type: 'turret', ox: 0.6, oy: -3.6, tag: 'pods' }, { type: 'turret', ox: 2.2, oy: -3.2, tag: 'pods' },
            { type: 'turret', ox: -1.6, oy: -2.4, tag: 'sword' },
        ],
        phases: [
            { hp: 720, time: 50, step(G, B) {
                B.x = B.hx + Math.sin(B.t * 0.4) * 1.5; track(G, B, 0.7, 6.5, 11.5);
                B.vuln = true;
                if (B.part('cannon')) every(B, 'beam', 3.4, () => emit(G, 'laser', src(B, -2.4, 1.8, 0), { warm: 1.1, life: 1.0, w: 1.2 }));
                if (B.part('pods')) every(B, 'pods', 2.6, () => emit(G, 'homing', src(B, 1, -3.6, 3), { n: 3, speed: 4.5 }));
                every(B, 'stream', 1.6, () => emit(G, 'stream', src(B, 0, -1.2), { n: 7, gap: 0.06, speed: 12 }));
            } },
            { hp: 820, time: 55, step(G, B) {
                // the sword: lunge forward and sweep, then pull back
                const ph = B.pt % 6;
                const tx = ph < 1.4 ? 14 : B.hx;
                B.x += (tx - B.x) * Math.min(1, B.dt * 2.2); track(G, B, 0.9, 6.5, 11.5);
                B.vuln = true;
                if (ph > 0.9 && ph - B.dt <= 0.9 && B.part('sword')) emit(G, 'laser', src(B, -1.6, -2.4, 1), { ang: Math.PI * 0.62, warm: 0.45, life: 0.7, w: 0.9, len: 11, spin: 2.6 });
                every(B, 'fan', 0.9, () => emit(G, 'fan', src(B, 0, -1.2), { n: 11, arc: 1.6, speed: 7.5 }));
            } },
            { hp: 700, time: 55, step(G, B) {
                bob(B, 2, 4.5, 0.5, 0.7);
                B.vuln = true;
                every(B, 'stop', 1.3, () => emit(G, 'stopgo', src(B, 0, -1.2), { n: 20, speed: 8, at: 0.45, wait: 0.55, speed2: 9.5 }));
                every(B, 'spiral', 0.1, () => emit(G, 'spiral', src(B, 0, -1.2, 3), { arms: 2, speed: 6, rot: 3.2 }));
            } },
        ],
    },

    // 5. The Mother of Eyes: tentacle eyes around a great eye; she lays eggs that hatch.
    mother: {
        hx: 24, hy: 9, c: 4, core: { ox: 0, oy: 0, r: 2.0 },
        parts: [0, 1, 2, 3, 4, 5].map((i) => ({ type: 'turret', ox: Math.cos(Math.PI / 2 + (i / 6) * TAU) * 3.6, oy: Math.sin(Math.PI / 2 + (i / 6) * TAU) * 3.6, tag: 'tentacle', i, hp: 2.5 })),
        phases: [
            { hp: 760, time: 55, step(G, B) {
                bob(B, 1.5, 3, 0.35, 0.5);
                B.vuln = true;
                swayTentacles(G, B, 3.6);
                every(B, 'eggs', 3.2, () => { for (let k = 0; k < 3; k++) spawnEnemy(G, 'egg', B.x - 2, B.y - 3 + k * 3, { mv: { speed: 3, vy: (k - 1) * 1.5 }, force: true }); });
                every(B, 'aim', 1.6, () => emit(G, 'aimed', src(B), { n: 5, spread: 0.25, speed: 8 }));
            } },
            { hp: 860, time: 55, step(G, B) {
                bob(B, 2, 3.5, 0.4, 0.6);
                B.vuln = true;
                swayTentacles(G, B, 4.2);
                every(B, 'flower', 0.8, () => emit(G, 'flower', src(B), { n: 20, speed: 5.5, curve: 0.8 }));
                every(B, 'home', 3.2, () => emit(G, 'homing', src(B, 0, 0, 2), { n: 3, speed: 4 }));
            } },
            { hp: 760, time: 55, step(G, B) {
                bob(B, 3, 4, 0.5, 0.8);
                B.vuln = true;
                swayTentacles(G, B, 5);
                every(B, 'split', 1.3, () => emit(G, 'split', src(B), { n: 5, at: 0.7, ring: 9, speed: 6, speed2: 5.5 }));
                every(B, 'accel', 1.9, () => emit(G, 'accel', src(B, 0, 0, 4), { n: 16, acc: 6, speed: 9 }));
            } },
        ],
    },

    // 6. Seraphine Null, the Requiem Heart: halo rings that orbit her, and four movements.
    heart: {
        hx: 24, hy: 9, c: 5, core: { ox: 0, oy: 0, r: 1.6 },
        parts: [0, 1, 2].map((i) => ({ type: 'bigturret', ox: 0, oy: 0, tag: 'halo', i })),
        phases: [
            { name: 'GLORIA', hp: 800, time: 55, step(G, B) {
                bob(B, 1, 2.5, 0.3, 0.45); orbitHalos(G, B, 3.5, 0.8);
                B.vuln = true;
                every(B, 'ring', 0.55, () => { B.s.ang = (B.s.ang || 0) + 0.17; emit(G, 'ring', src(B), { n: 22, speed: 5, off: B.s.ang, step: 0 }); });
                every(B, 'aim', 1.3, () => emit(G, 'aimed', src(B, 0, 0, 3), { n: 5, spread: 0.1, speed: 10 }));
            } },
            { name: 'WINGS OF LIGHT', hp: 900, time: 60, step(G, B) {
                bob(B, 1.5, 2, 0.35, 0.5); orbitHalos(G, B, 4.2, -1.0);
                B.vuln = true;
                every(B, 'wings', 4.5, () => { for (const a of [Math.PI * 0.8, Math.PI * 1.2]) emit(G, 'laser', src(B, 0, 0, 1), { ang: a, warm: 1.0, life: 2.2, w: 0.8, spin: a < Math.PI ? 0.32 : -0.32 }); });
                every(B, 'ring', 1.0, () => emit(G, 'ring', src(B), { n: 18, speed: 4.5 }));
            } },
            { name: 'LACRIMOSA', hp: 900, time: 60, step(G, B) {
                bob(B, 2, 3.5, 0.4, 0.6); orbitHalos(G, B, 3, 1.4);
                B.vuln = true;
                every(B, 'stop', 1.4, () => emit(G, 'stopgo', src(B, 0, 0, 1), { n: 24, speed: 7, at: 0.5, wait: 0.7, speed2: 8.5 }));
                every(B, 'curtain', 3.0, () => emit(G, 'curtain', src(B, 0, 0, 5), { rows: 14, speed: 5.5, gap: 3 }));
            } },
            { name: 'REQUIEM', hp: 1000, time: 60, step(G, B) {
                B.x += (B.hx + 1 - B.x) * B.dt; B.y += (9 - B.y) * B.dt; orbitHalos(G, B, 5, 2.2);
                B.vuln = true;
                every(B, 'spiralA', 0.08, () => emit(G, 'spiral', src(B, 0, 0, 5), { arms: 3, speed: 5.5, rot: 2.6 }));
                every(B, 'spiralB', 0.11, () => { B.s.b = (B.s.b || 0) - 0.2; emit(G, 'ring', { x: B.x, y: B.y, c: 1 }, { n: 3, speed: 4.5, off: B.s.b, step: 0 }); });
                every(B, 'accel', 2.6, () => emit(G, 'accel', src(B, 0, 0, 3), { n: 12, acc: 5, speed: 9 }));
            } },
        ],
    },
};

function swayTentacles(G, B, R) {
    for (const e of partsAlive(G, B)) {
        const i = e.mv.i || 0;
        const a = Math.PI / 2 + (i / 6) * TAU + Math.sin(B.t * 1.3 + i) * 0.25;
        e.ox = Math.cos(a) * R; e.oy = Math.sin(a) * R * 1.1;
    }
}
function orbitHalos(G, B, R, w) {
    for (const e of partsAlive(G, B)) {
        const a = B.t * w + ((e.mv.i || 0) / 3) * TAU;
        e.ox = Math.cos(a) * R; e.oy = Math.sin(a) * R;
    }
}

// ---------------------------------------------------------------------------- lifecycle
export function startBoss(G, key, o = {}) {
    const D = BOSS_DEFS[key];
    const mul = BOSS_HP * (STAGE_BOSS_HP[key] || 1) * (G.ehp || 1) * (o.hpMul || 1);
    const B = {
        id: G.nextId++, key, x: FIELD.w + 10, y: D.hy, hx: D.hx, hy: D.hy, t: 0, pt: 0, dt: 0, phase: 0, c: D.c,
        hp: D.phases[0].hp * mul, maxhp: D.phases[0].hp * mul, mul, vuln: false, entering: 3.0, flash: 0, dead: false, armor: 1,
        coreW: { x: 0, y: 0, r: D.core.r }, s: {}, tm: {}, trail: [], phaseBonus: 0, timeouts: 0,
    };
    if (o.hpScale) { B.hp *= o.hpScale; B.maxhp *= o.hpScale; }
    G.boss = B;
    for (const p of D.parts) {
        const e = spawnEnemy(G, p.type, B.x + (p.ox || 0), B.y + (p.oy || 0), { parent: B.id, ox: p.ox || 0, oy: p.oy || 0, part: p.tag || 'boss', force: true, mv: { i: p.i ?? 0 }, hpMul: 4 * (p.hp || 1) * (o.hpMul || 1), delay: 1.5 });
        if (e && p.follow) { e.parent = B.id; e.ox = p.follow; e.type = 'segment'; e.followBoss = true; }
    }
    ev(G, 'boss', { key, name: BOSSES[key].name, title: BOSSES[key].title });
}

/** Advance the boss. Returns 'dead' on the frame it dies. */
export function stepBoss(G, dt) {
    const B = G.boss;
    if (!B || B.dead) return null;
    const D = BOSS_DEFS[B.key];
    B.dt = dt;
    B.t += dt;
    B.part = (tag) => G.enemies.some((e) => e.parent === B.id && !e.dead && e.part === tag);
    if (B.flash > 0) B.flash -= dt;
    // fly in
    if (B.entering > 0) {
        B.entering -= dt;
        B.x += (B.hx - B.x) * Math.min(1, dt * 1.6);
        B.vuln = false;
        updateBossGeometry(G, B, D);
        return null;
    }
    B.pt += dt;
    const ph = D.phases[B.phase];
    ph.step(G, B, dt);
    if (D.trail) {
        B.s.tt = (B.s.tt || 0) + dt;
        if (B.s.tt > 0.05) { B.s.tt = 0; B.trail.unshift([B.x, B.y]); if (B.trail.length > 70) B.trail.pop(); }
    }
    updateBossGeometry(G, B, D);
    if (B.hp <= 0 || B.pt > ph.time) {
        const timedOut = B.hp > 0;
        if (timedOut) B.timeouts++;
        else { addScore(G, 20000 * (B.phase + 1) * Math.max(0.2, 1 - B.pt / ph.time) + 10000); }
        cancelBullets(G, () => true, true, 160);
        G.beams.length = 0;
        if (B.phase + 1 >= D.phases.length) return killBoss(G, B, timedOut);
        B.phase++;
        B.pt = 0;
        B.tm = {};
        const np = D.phases[B.phase];
        B.hp = B.maxhp = np.hp * B.mul;
        G.chill = 1.2;
        ev(G, 'phase', { key: B.key, phase: B.phase, name: np.name || '', timedOut });
    }
    return null;
}

function updateBossGeometry(G, B, D) {
    B.coreW.x = B.x + D.core.ox; B.coreW.y = B.y + D.core.oy;
    // segments follow the head along its trail
    if (D.trail) for (const e of G.enemies) if (e.followBoss && !e.dead) {
        const p = B.trail[Math.min(B.trail.length - 1, e.ox | 0)];
        if (p) { e.x = p[0]; e.y = p[1]; e.mv.fx = 1; }
        else { e.x = B.x + 1; e.y = B.y; }
    }
    if (D.walls) for (const w of D.walls) G.walls.push({ x: B.x + w.x, y: B.y + w.y, w: w.w, h: w.h, boss: true });
}

function killBoss(G, B, timedOut) {
    B.dead = true;
    B.vuln = false;
    for (const e of G.enemies) if (e.parent === B.id && !e.dead) killEnemy(G, e, 'boss');
    addScore(G, timedOut ? 50000 : 200000 * (1 + (G.stage || 0)));
    dropGems(G, B.x, B.y, 40, true);
    dropItem(G, 'P', B.x, B.y - 2);
    dropItem(G, 'B', B.x, B.y + 2);
    G.bossesKilled++;
    G.bossClear = 4.0;
    ev(G, 'bossDie', { key: B.key, x: B.x, y: B.y, timedOut });
    return 'dead';
}

/** Segments that belong to the boss move with it; mounted parts read the boss's position via G.boss. */
export function isBossPart(G, e) { return G.boss && e.parent === G.boss.id; }
