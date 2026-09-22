/**
 * enemies.js — the 14 enemy archetypes and the generic enemy update.
 *
 * PURE: an archetype is data plus two pure-ish functions — `move(e, w, dt)` and
 * optional `onDeath(e, w)` — that only touch the entity and the world API
 * (`w.fire`, `w.spawnEnemy`, `w.spawnPod`, `w.fx`). Nothing here imports three.js
 * or the DOM, so dev/simtest.mjs can fly whole waves headlessly.
 *
 * Attack cycling is generic: each archetype lists `attacks`, and the shared
 * update walks that list — cooldown → windup (telegraph) → fire → repeat.
 * Every attack that matters has a windup, because the GDD promises that every
 * pattern in the game is dodgeable by a player who reads it.
 */

import { ARENA, COLORS } from '../core/config.js';
import { aimAt, DOWN } from './patterns.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- archetypes

export const ENEMIES = {
    drone: {
        id: 'drone', name: 'Drone', hp: 5, r: 0.55, score: 80, model: 'drone',
        color: 0xff9f6e, speed: 9,
        move(e, w, dt) {
            e.y -= e.speed * dt;
            e.x += Math.sin(e.t * 2 + e.seedPhase) * 1.6 * dt;
        },
        attacks: [],
    },

    skimmer: {
        id: 'skimmer', name: 'Skimmer', hp: 10, r: 0.62, score: 140, model: 'skimmer',
        color: 0xffc46e, speed: 4.2,
        move(e, w, dt) {
            e.y -= e.speed * 0.45 * dt;
            e.x = e.homeX + Math.sin(e.t * 1.5 + e.seedPhase) * (e.amp ?? 6);
        },
        attacks: [
            { pattern: 'aimed', count: 1, speed: 7, windup: 0.35, cooldown: 1.5, kind: 'orb' },
        ],
    },

    lancer: {
        id: 'lancer', name: 'Lancer', hp: 18, r: 0.7, score: 220, model: 'lancer',
        color: 0xff7f6e, speed: 13,
        move(e, w, dt) {
            // dive at the player's column, then peel away to the nearest edge
            if (e.mode === undefined) { e.mode = 'approach'; e.lockX = w.player.x; }
            if (e.mode === 'approach') {
                e.x += clamp(e.lockX - e.x, -6, 6) * dt * 1.6;
                e.y -= e.speed * 0.5 * dt;
                if (e.y < w.player.y + 7 || e.t > 3.2) e.mode = 'peel';
            } else {
                e.peelDir ??= e.x < 0 ? -1 : 1;
                e.x += e.peelDir * e.speed * 0.8 * dt;
                e.y -= e.speed * dt;
            }
        },
        attacks: [
            { pattern: 'fan', count: 3, spread: 34, speed: 7.5, windup: 0.4, cooldown: 1.9, kind: 'dart' },
        ],
    },

    turret: {
        id: 'turret', name: 'Turret', hp: 42, r: 0.78, score: 300, model: 'turret',
        color: 0xbfc8e8, speed: 1.6, armored: true,
        move(e, w, dt) { e.y -= e.speed * dt; },      // rides the scenery downward
        attacks: [
            { pattern: 'spiral', count: 6, spin: 17, speed: 5.4, windup: 0.5, cooldown: 1.15,
              repeat: 3, repeatGap: 0.28, kind: 'orb' },
        ],
    },

    weaver: {
        id: 'weaver', name: 'Weaver', hp: 24, r: 0.66, score: 260, model: 'weaver',
        color: 0xffb0e0, speed: 3.4,
        move(e, w, dt) {
            // figure-eight around a slowly descending anchor
            e.anchorY -= 0.75 * dt;
            const k = e.t * 1.25 + e.seedPhase;
            e.x = e.homeX + Math.sin(k) * (e.amp ?? 5.2);
            e.y = e.anchorY + Math.sin(k * 2) * 2.1;
        },
        attacks: [
            { pattern: 'ring', count: 8, speed: 5.0, windup: 0.45, cooldown: 2.1, kind: 'orb' },
        ],
    },

    popper: {
        id: 'popper', name: 'Popper', hp: 14, r: 0.6, score: 180, model: 'popper',
        color: 0xff6ea0, speed: 3.0,
        move(e, w, dt) {
            e.y -= e.speed * dt;
            e.x += Math.sin(e.t * 0.9 + e.seedPhase) * 2.4 * dt;
        },
        attacks: [],
        onDeath(e, w) {
            // a death nova plus three drones: killing it up close is a decision
            w.fire(e, { pattern: 'nova', count: 10, speed: 2.2, speedAfter: 7.5, hang: 0.6,
                        kind: 'orb', color: COLORS.enemyBulletHot });
            for (let i = 0; i < 3; i++) {
                w.spawnEnemy('drone', e.x + (i - 1) * 0.9, e.y, { speed: 7 + i });
            }
        },
    },

    shieldbearer: {
        id: 'shieldbearer', name: 'Shieldbearer', hp: 66, r: 0.95, score: 420, model: 'shieldbearer',
        color: 0x9fd0ff, shieldArc: 120, shieldHp: 40,
        speed: 2.2,
        move(e, w, dt) {
            e.y -= e.speed * dt * (e.y > 6 ? 2.2 : 0.55);
            e.x += Math.cos(e.t * 0.8 + e.seedPhase) * 2.8 * dt;
        },
        attacks: [
            { pattern: 'aimed', count: 3, spread: 12, speed: 6.4, windup: 0.5, cooldown: 2.0, kind: 'dart' },
        ],
    },

    sniper: {
        id: 'sniper', name: 'Sniper', hp: 24, r: 0.6, score: 340, model: 'sniper',
        color: 0xff5f8f, speed: 2.0,
        move(e, w, dt) {
            // holds high and tracks the player's column slowly
            const targetY = ARENA.top - 3.5;
            e.y += clamp(targetY - e.y, -4, 4) * dt * 1.2;
            e.x += clamp(w.player.x - e.x, -2.2, 2.2) * dt;
        },
        attacks: [
            { pattern: 'laser', warn: 0.85, duration: 0.9, width: 0.85, windup: 0, cooldown: 2.6 },
        ],
    },

    carrier: {
        id: 'carrier', name: 'Carrier', hp: 150, r: 1.5, score: 900, model: 'carrier',
        color: 0xc8b0ff, speed: 1.5, podsOnDeath: 2,
        move(e, w, dt) {
            e.y -= e.speed * dt * (e.y > 8 ? 2.4 : 0.6);
            e.x = e.homeX + Math.sin(e.t * 0.5 + e.seedPhase) * 3.4;
            e.hatchT = (e.hatchT ?? 0) + dt;
            if (e.hatchT > 2.4 && e.y < ARENA.top - 2) {
                e.hatchT = 0;
                w.spawnEnemy('drone', e.x - 0.8, e.y - 0.4, { speed: 7.5 });
                w.spawnEnemy('drone', e.x + 0.8, e.y - 0.4, { speed: 7.5 });
            }
        },
        attacks: [
            { pattern: 'rain', count: 4, speed: 4.2, windup: 0.4, cooldown: 2.4, kind: 'orb', fromTop: false },
        ],
        onDeath(e, w) {
            for (let i = 0; i < (e.def.podsOnDeath ?? 2); i++) {
                w.spawnPod(e.x + (i - 0.5) * 1.6, e.y);
            }
        },
    },

    minelayer: {
        id: 'minelayer', name: 'Minelayer', hp: 38, r: 0.72, score: 320, model: 'minelayer',
        color: 0xffd36e, speed: 4.6,
        move(e, w, dt) {
            e.y -= e.speed * 0.5 * dt;
            e.x += Math.sin(e.t * 2.2 + e.seedPhase) * 4.5 * dt;
        },
        attacks: [
            { pattern: 'cluster', count: 3, spread: 90, speed: 3.4, burstAt: 2.2, burstCount: 9,
              burstSpeed: 4.8, windup: 0.5, cooldown: 2.8, aimed: false },
        ],
    },

    reaver: {
        id: 'reaver', name: 'Reaver', hp: 42, r: 0.8, score: 480, model: 'reaver',
        color: 0xff4f6e, speed: 22,
        move(e, w, dt) {
            e.mode ??= 'wind';
            if (e.mode === 'wind') {
                e.y -= 2.0 * dt;
                e.windT = (e.windT ?? 0) + dt;
                if (e.windT > 0.9) {
                    e.mode = 'charge';
                    const a = aimAt(e.x, e.y, w.player.x, w.player.y);
                    e.cvx = Math.cos(a) * e.speed;
                    e.cvy = Math.sin(a) * e.speed;
                    e.firedPass = false;
                }
            } else {
                e.x += e.cvx * dt;
                e.y += e.cvy * dt;
                e.cvx *= 1 - 0.55 * dt;
                e.cvy *= 1 - 0.55 * dt;
                if (!e.firedPass && e.y < w.player.y + 1.5) {
                    e.firedPass = true;
                    w.fire(e, { pattern: 'whip', count: 11, arc: 120, speed: 3.6, speedEnd: 7.4,
                                kind: 'shard', dir: e.x < w.player.x ? 1 : -1 });
                }
            }
        },
        attacks: [],
    },

    bloom: {
        id: 'bloom', name: 'Bloom', hp: 52, r: 0.9, score: 520, model: 'bloom',
        color: 0xff8ed0, speed: 2.6,
        move(e, w, dt) {
            const targetY = e.holdY ?? 5;
            e.y += clamp(targetY - e.y, -5, 5) * dt * 1.1;
            e.x = e.homeX + Math.sin(e.t * 0.7 + e.seedPhase) * 2.6;
        },
        attacks: [
            { pattern: 'flower', count: 6, per: 3, splay: 30, spin: 11, speed: 4.4,
              windup: 0.7, cooldown: 2.4, kind: 'petal' },
        ],
    },

    choirling: {
        id: 'choirling', name: 'Choirling', hp: 28, r: 0.6, score: 300, model: 'choirling',
        color: 0xd0a0ff, speed: 3.0, beatLocked: true,
        move(e, w, dt) {
            // moves in discrete hops on the Chorus's beat — the whole swarm
            // steps at once, which is what makes the level read as music
            e.hopFrom ??= { x: e.x, y: e.y };
            if (e.lastBeat !== w.beatIndex) {
                e.lastBeat = w.beatIndex;
                e.hopFrom = { x: e.x, y: e.y };
                e.hopTo = {
                    x: clamp(e.homeX + Math.sin(w.beatIndex * 1.1 + e.seedPhase) * 5.5,
                             ARENA.left + 1, ARENA.right - 1),
                    y: e.y - 1.15,
                };
                e.hopT = 0;
            }
            if (e.hopTo) {
                e.hopT = Math.min(1, (e.hopT ?? 0) + dt / Math.max(0.08, w.beatInterval * 0.6));
                const k = e.hopT * e.hopT * (3 - 2 * e.hopT);
                e.x = e.hopFrom.x + (e.hopTo.x - e.hopFrom.x) * k;
                e.y = e.hopFrom.y + (e.hopTo.y - e.hopFrom.y) * k;
            }
        },
        attacks: [
            { pattern: 'spiral', count: 5, spin: 23, speed: 5.0, windup: 0.3, cooldown: 1.0,
              onBeat: true, kind: 'orb' },
        ],
    },

    seraph: {
        id: 'seraph', name: 'Seraph', hp: 210, r: 1.25, score: 1500, model: 'seraph',
        color: 0xfff0b0, speed: 2.4, elite: true,
        move(e, w, dt) {
            const targetY = e.holdY ?? 7;
            e.y += clamp(targetY - e.y, -4, 4) * dt * 1.0;
            e.x = e.homeX + Math.sin(e.t * 0.55 + e.seedPhase) * 5.5;
        },
        attacks: [
            { pattern: 'wall', count: 20, gaps: 2, gapWidth: 2.8, speed: 4.6, windup: 0.9,
              cooldown: 2.6, kind: 'shard', angle: DOWN },
            { pattern: 'fan', count: 7, spread: 72, speed: 6.4, windup: 0.5, cooldown: 1.8,
              repeat: 2, repeatGap: 0.4, kind: 'dart' },
        ],
    },
};

export const ENEMY_IDS = Object.keys(ENEMIES);

// ------------------------------------------------------------- construction

let nextId = 1;
export function resetEnemyIds() { nextId = 1; }

export function makeEnemy(typeId, x, y, opts = {}, w = null) {
    const def = ENEMIES[typeId];
    if (!def) throw new Error(`[enemies] unknown enemy "${typeId}"`);
    const hpMult = opts.hpMult ?? 1;
    const e = {
        id: nextId++,
        type: typeId,
        def,
        x, y,
        homeX: opts.homeX ?? x,
        anchorY: opts.anchorY ?? y,
        holdY: opts.holdY,
        amp: opts.amp,
        speed: opts.speed ?? def.speed ?? 3,
        hp: Math.max(1, Math.round((opts.hp ?? def.hp) * hpMult)),
        maxHp: Math.max(1, Math.round((opts.hp ?? def.hp) * hpMult)),
        r: def.r,
        score: def.score,
        shieldHp: def.shieldHp ?? 0,
        t: 0,
        seedPhase: opts.seedPhase ?? 0,
        alive: true,
        hitFlash: 0,
        atkIndex: 0,
        atkTimer: opts.atkDelay ?? (def.attacks?.[0]?.cooldown ?? 1) * 0.6,
        windup: 0,
        repeatsLeft: 0,
        repeatTimer: 0,
        phase: 0,
        dropTable: opts.dropTable ?? null,
        podOnDeath: opts.podOnDeath ?? 0,
        fromWave: opts.fromWave ?? null,
        entering: true,
    };
    if (w && typeof w.rng === 'function') e.seedPhase = opts.seedPhase ?? w.rng.range(0, Math.PI * 2);
    return e;
}

// ------------------------------------------------------------------- update

/**
 * Generic per-enemy update: movement script, then the attack cycle.
 * `w` is the world; it supplies `w.fire(emitter, attackSpec)`.
 */
export function updateEnemy(e, w, dt) {
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4);

    e.def.move?.(e, w, dt);

    // Off-field culling. Enemies are allowed to live above the arena while they
    // fly in, but anything that leaves the sides or the bottom is gone.
    const m = ARENA.margin + 2;
    if (e.y < ARENA.bottom - m || e.y > ARENA.top + 14
        || e.x < ARENA.left - m || e.x > ARENA.right + m) {
        e.alive = false;
        e.escaped = true;
        return;
    }

    const onField = e.y < ARENA.top - 0.5 && e.y > ARENA.bottom + 0.5;
    if (!onField) return;
    e.entering = false;

    const attacks = e.def.attacks;
    if (!attacks || attacks.length === 0) return;
    const atk = attacks[e.atkIndex % attacks.length];

    // mid-volley repeats (a turret's three-shot spiral burst)
    if (e.repeatsLeft > 0) {
        e.repeatTimer -= dt;
        if (e.repeatTimer <= 0) {
            w.fire(e, atk);
            e.phase++;
            e.repeatsLeft--;
            e.repeatTimer = atk.repeatGap ?? 0.25;
            if (e.repeatsLeft === 0) {
                e.atkIndex++;
                e.atkTimer = atk.cooldown ?? 1.5;
            }
        }
        return;
    }

    if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
            w.fire(e, atk);
            e.phase++;
            const reps = (atk.repeat ?? 1) - 1;
            if (reps > 0) {
                e.repeatsLeft = reps;
                e.repeatTimer = atk.repeatGap ?? 0.25;
            } else {
                e.atkIndex++;
                e.atkTimer = atk.cooldown ?? 1.5;
            }
        }
        return;
    }

    e.atkTimer -= dt;
    const beatReady = !atk.onBeat || e.lastFireBeat !== w.beatIndex;
    if (e.atkTimer <= 0 && beatReady) {
        if (atk.onBeat) e.lastFireBeat = w.beatIndex;
        e.windup = atk.windup ?? 0.001;
        e.windupMax = e.windup;
        w.fx('windup', { x: e.x, y: e.y, duration: e.windup, enemy: e.id });
    }
}
