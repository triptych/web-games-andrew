/**
 * bosses.js — six data-driven bosses.
 *
 * A boss is: an ordered list of PHASES, each with an HP threshold, a movement
 * script, and a cycle of ATTACKS. An attack is either a pattern from
 * patterns.js or a `special` handled below (claw sweeps, vanishing into cloud,
 * blinking, summoning, the flare wave that erases YOUR bullets).
 *
 * Every attack carries a `windup`: the boss flares and a warning shape draws
 * before anything is fired. That is the contract that keeps the bullet hell
 * fair — see GDD §2.2.
 *
 * PURE: no three.js, no DOM. The view reads boss.state/phase/windup to animate.
 */

import { ARENA, COLORS } from '../core/config.js';
import { DOWN } from './patterns.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ------------------------------------------------------------ movement scripts

/**
 * MOVEMENT AND THE NO-TELEPORT RULE
 *
 * The oscillating scripts below (sway, dip, orbit) describe a *target* point on
 * a curve, and the boss is then eased toward it — it is never assigned straight
 * onto the curve.
 *
 * Assigning directly is what made bosses jump. `b.x = sin(moveT) * amp` is only
 * continuous if b.x was already exactly on that curve, and it never is:
 *
 *   - `moveT` runs during the 2.4s entry while x is pinned at 0, so the instant
 *     the fight began the sine was already a third of a cycle in and the boss
 *     snapped across the arena (Tarpon: 5.3 units in one tick, 641 u/s).
 *   - every phase change swaps amp/cx/moveSpeed, so the curve moves out from
 *     under the boss and it snaps again.
 *   - `ram` and Nimbus's cloud-hide both park the boss off-curve, and it
 *     snapped back on resume.
 *
 * `approach()` caps how fast a boss may be corrected onto its curve, so all of
 * those cases become a fast slide instead of a teleport. Genuine teleports —
 * Kel's blink, Nimbus leaving the cloud — still exist, but they are explicit
 * and they announce themselves with an fx event.
 *
 * `phaseT` (reset on every phase entry) drives the curves instead of `moveT`,
 * so each phase starts at the beginning of its own oscillation.
 */

/** 3t^2-2t^3 on [0,1]: starts and ends with zero velocity. */
function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

/** Move `cur` toward `target` no faster than `rate` units/sec. */
function approach(cur, target, rate, dt) {
    const d = target - cur;
    const step = rate * dt;
    if (d > step) return cur + step;
    if (d < -step) return cur - step;
    return target;
}

// How fast a boss is allowed to be dragged back onto its movement curve.
const TRACK_X = 9;      // units/sec laterally
const TRACK_Y = 5;      // units/sec vertically

export const MOVES = {
    hold(b, w, dt, ph) {
        b.y += clamp((ph.y ?? 8) - b.y, -4, 4) * dt * 1.4;
        b.x += clamp((ph.x ?? 0) - b.x, -6, 6) * dt * 1.4;
    },
    sway(b, w, dt, ph) {
        b.y += clamp((ph.y ?? 8) - b.y, -4, 4) * dt * 1.4;
        const targetX = (ph.cx ?? 0) + Math.sin(b.phaseT * (ph.moveSpeed ?? 0.6)) * (ph.amp ?? 5);
        b.x = approach(b.x, targetX, TRACK_X, dt);
    },
    hunt(b, w, dt, ph) {
        b.y += clamp((ph.y ?? 8) - b.y, -4, 4) * dt * 1.2;
        b.x += clamp(w.player.x - b.x, -1, 1) * (ph.moveSpeed ?? 3.2) * dt;
        b.x = clamp(b.x, ARENA.left + 2.5, ARENA.right - 2.5);
    },
    dip(b, w, dt, ph) {
        const base = ph.y ?? 8;
        const targetX = (ph.cx ?? 0) + Math.sin(b.phaseT * (ph.moveSpeed ?? 0.5)) * (ph.amp ?? 6);
        const targetY = base - Math.max(0, Math.sin(b.phaseT * 0.7)) * (ph.dip ?? 4);
        b.x = approach(b.x, targetX, TRACK_X, dt);
        b.y = approach(b.y, targetY, TRACK_Y, dt);
    },
    orbit(b, w, dt, ph) {
        const k = b.phaseT * (ph.moveSpeed ?? 0.8);
        const targetX = (ph.cx ?? 0) + Math.cos(k) * (ph.amp ?? 5.5);
        const targetY = (ph.y ?? 7) + Math.sin(k * 2) * (ph.ampY ?? 2.2);
        b.x = approach(b.x, targetX, TRACK_X, dt);
        b.y = approach(b.y, targetY, TRACK_Y, dt);
    },
    // Nimbus: slides behind the cloud deck, only lightning betraying its position
    cloud(b, w, dt, ph) {
        b.cloudT = (b.cloudT ?? 0) + dt;
        if (b.hidden) {
            if (b.cloudT > (ph.hideFor ?? 2.2)) {
                b.cloudT = 0; b.hidden = false;
                b.x = w.rng.range(ARENA.left + 3, ARENA.right - 3);
                b.y = (ph.y ?? 8) + w.rng.range(-1.5, 1.5);
                w.fx('bossAppear', { x: b.x, y: b.y });
            }
        } else if (b.cloudT > (ph.showFor ?? 3.4)) {
            b.cloudT = 0; b.hidden = true;
            w.fx('bossVanish', { x: b.x, y: b.y });
        }
        if (!b.hidden) MOVES.sway(b, w, dt, ph);
    },
    // Kel: blinks the way a pilot rolls — short, sharp, always toward an angle
    blink(b, w, dt, ph) {
        b.blinkT = (b.blinkT ?? 0) + dt;
        if (b.blinkT > (ph.every ?? 2.6)) {
            b.blinkT = 0;
            w.fx('bossBlink', { x: b.x, y: b.y });
            b.x = clamp(w.player.x + w.rng.range(-7, 7), ARENA.left + 2.5, ARENA.right - 2.5);
            b.y = (ph.y ?? 8) + w.rng.range(-1, 1.5);
            w.fx('bossAppear', { x: b.x, y: b.y });
        } else {
            MOVES.sway(b, w, dt, ph);
        }
    },
};

// --------------------------------------------------------------- boss specials

export const SPECIALS = {
    // TARPON's cargo claws: physical hazards that sweep the arena
    claw(b, w, a) {
        const dir = (b.clawDir = -(b.clawDir ?? -1));
        w.spawnHazard({
            x: dir < 0 ? ARENA.left - 1 : ARENA.right + 1,
            y: b.y - (a.dy ?? 3.2),
            vx: dir * (a.speed ?? 9), vy: 0,
            r: a.r ?? 1.5, life: 4.2, kind: 'claw', damage: 1,
        });
    },
    // IRONMAW's ram: the hull itself becomes the attack
    ram(b, w, a) {
        b.ramming = { t: 0, dur: a.duration ?? 1.4, fromY: b.y, toY: a.toY ?? 1.5 };
        w.fx('bossRam', { x: b.x, y: b.y });
    },
    summon(b, w, a) {
        const types = a.types ?? ['drone'];
        for (let i = 0; i < (a.count ?? 3); i++) {
            const t = types[i % types.length];
            w.spawnEnemy(t, b.x + (i - (a.count ?? 3) / 2) * 2.2, b.y - 1.2, { speed: a.speed });
        }
    },
    // WARDEN KEL fires a flare of his own — it erases YOUR bullets, so you have
    // to stop shooting and read him instead
    flarewave(b, w, a) {
        w.spawnWave({ x: b.x, y: b.y, r: 0.5, maxR: a.maxR ?? 16, speed: a.speed ?? 13,
                      erasesPlayerBullets: true });
        w.fx('flareWave', { x: b.x, y: b.y });
    },
    // THE CHORUS HEART's phase-4 opener: the arena briefly goes dark and the
    // only light is the bullets
    dim(b, w, a) { w.fx('dim', { duration: a.duration ?? 2.5 }); },

    heal(b, w, a) {
        b.hp = Math.min(b.maxHp, b.hp + (a.amount ?? 0));
    },
};

// ------------------------------------------------------------------- the bosses

const warm = COLORS.enemyBullet;
const hot = COLORS.enemyBulletHot;
const white = COLORS.enemyBulletWhite;

export const BOSSES = {
    // L1 — a tutorial boss with real teeth: everything is slow and telegraphed
    tarpon: {
        id: 'tarpon', name: 'TARPON', title: 'HIJACKED DOCK LOADER', model: 'tarpon',
        hp: 1700, r: 2.6, color: 0xffb066, score: 25000, entryY: 9,
        intro: 'Dock loader TARPON — it is not a warship. It just has claws.',
        phases: [
            {
                name: 'GRAPPLE', hpFrom: 1.0, move: 'sway', moveSpeed: 0.55, amp: 5.5, y: 8.5,
                attacks: [
                    { pattern: 'fan', count: 7, spread: 62, speed: 5.0, windup: 0.8, cooldown: 1.3, repeat: 2, repeatGap: 0.5, kind: 'orb', color: warm },
                    { special: 'claw', dy: 3.4, speed: 8, windup: 1.0, cooldown: 2.2 },
                    { pattern: 'aimed', count: 3, spread: 10, speed: 7, windup: 0.5, cooldown: 1.0, repeat: 3, repeatGap: 0.3, kind: 'dart', color: warm },
                ],
            },
            {
                name: 'OVERLOAD', hpFrom: 0.5, move: 'hunt', moveSpeed: 3.0, y: 9,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'OVERLOAD', boss: b.id }),
                attacks: [
                    { pattern: 'rain', count: 9, speed: 4.2, windup: 0.6, cooldown: 1.1, repeat: 3, repeatGap: 0.45, kind: 'orb', color: warm },
                    { pattern: 'spiral', count: 9, spin: 21, speed: 4.8, windup: 0.7, cooldown: 1.0,
                      repeat: 7, repeatGap: 0.2, kind: 'orb', color: hot },
                    { special: 'claw', dy: 2.8, speed: 11, windup: 0.8, cooldown: 1.8 },
                ],
            },
        ],
    },

    // L2 — fought through cloud; you shoot where the lightning was
    nimbus: {
        id: 'nimbus', name: 'NIMBUS', title: 'ATMOSPHERIC HARVESTER', model: 'nimbus',
        hp: 2500, r: 2.8, color: 0xffd98a, score: 40000, entryY: 9,
        intro: 'It hides in the cloud deck. Watch the lightning — that is where it is.',
        phases: [
            {
                name: 'SQUALL', hpFrom: 1.0, move: 'sway', moveSpeed: 0.7, amp: 6, y: 8.5,
                attacks: [
                    { pattern: 'ring', count: 20, speed: 4.6, windup: 0.7, cooldown: 1.3, repeat: 3, repeatGap: 0.5, kind: 'orb', color: warm },
                    { pattern: 'laser', warn: 0.9, duration: 1.0, width: 1.0, sweep: 22, windup: 0, cooldown: 2.4, follow: true },
                ],
            },
            {
                name: 'THUNDERHEAD', hpFrom: 0.62, move: 'cloud', hideFor: 2.0, showFor: 3.4, amp: 5, y: 8.5,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'THUNDERHEAD', boss: b.id }),
                attacks: [
                    { pattern: 'wall', count: 20, gaps: 2, gapWidth: 3.0, speed: 4.8, windup: 1.0,
                      cooldown: 2.4, kind: 'shard', color: warm, angle: DOWN },
                    { pattern: 'whip', count: 18, arc: 130, speed: 3.6, speedEnd: 7.0, windup: 0.8,
                      cooldown: 1.2, repeat: 2, repeatGap: 0.55, kind: 'shard', color: hot },
                ],
            },
            {
                name: 'DOWNBURST', hpFrom: 0.28, move: 'dip', moveSpeed: 0.8, amp: 6.5, dip: 4, y: 9,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'DOWNBURST', boss: b.id }),
                attacks: [
                    { pattern: 'nova', count: 24, speed: 2.4, speedAfter: 8.5, hang: 0.9, windup: 0.9,
                      cooldown: 1.6, repeat: 2, repeatGap: 0.7, kind: 'orb', color: hot },
                    { pattern: 'rain', count: 11, speed: 4.6, windup: 0.4, cooldown: 0.9, repeat: 3, repeatGap: 0.35, kind: 'orb', color: warm },
                    { pattern: 'laser', warn: 0.7, duration: 1.2, width: 1.2, sweep: -30, windup: 0, cooldown: 2.0, follow: true },
                ],
            },
        ],
    },

    // L3 — four destructible turrets; kill them and the fight really does get easier
    ironmaw: {
        id: 'ironmaw', name: 'IRONMAW', title: 'SCAV-BUILT BATTLESHIP', model: 'ironmaw',
        hp: 3400, r: 3.4, color: 0xd8e0f0, score: 60000, entryY: 10,
        intro: 'Four turrets. Take them and it loses an attack each time. Aim.',
        parts: [
            { id: 'tl', name: 'PORT FORE TURRET', dx: -2.6, dy: 0.9, r: 0.95, hp: 360 },
            { id: 'tr', name: 'STBD FORE TURRET', dx: 2.6, dy: 0.9, r: 0.95, hp: 360 },
            { id: 'bl', name: 'PORT AFT TURRET', dx: -3.3, dy: -1.3, r: 0.95, hp: 420 },
            { id: 'br', name: 'STBD AFT TURRET', dx: 3.3, dy: -1.3, r: 0.95, hp: 420 },
        ],
        phases: [
            {
                name: 'BROADSIDE', hpFrom: 1.0, move: 'sway', moveSpeed: 0.45, amp: 4.5, y: 9,
                attacks: [
                    { pattern: 'spiral', count: 8, spin: 19, speed: 4.8, windup: 0.6, cooldown: 1.0,
                      repeat: 7, repeatGap: 0.2, kind: 'orb', color: warm, needsPart: 'tl' },
                    { pattern: 'fan', count: 11, spread: 80, speed: 5.4, windup: 0.6, cooldown: 1.1,
                      repeat: 3, repeatGap: 0.35, kind: 'dart', color: warm, needsPart: 'tr' },
                    { pattern: 'cluster', count: 4, spread: 100, speed: 4.4, burstAt: 1.3, burstCount: 10,
                      windup: 0.7, cooldown: 2.2, needsPart: 'bl', aimed: false },
                    { pattern: 'aimed', count: 5, spread: 9, speed: 8, windup: 0.5, cooldown: 1.4,
                      kind: 'dart', color: hot, needsPart: 'br' },
                    { pattern: 'ring', count: 22, speed: 4.4, windup: 0.8, cooldown: 1.5, repeat: 3, repeatGap: 0.45, kind: 'orb', color: warm },
                ],
            },
            {
                name: 'BOARD', hpFrom: 0.58, move: 'hunt', moveSpeed: 2.6, y: 9,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'BOARD', boss: b.id }),
                attacks: [
                    { special: 'summon', count: 4, types: ['drone', 'lancer'], windup: 0.8, cooldown: 3.0 },
                    { pattern: 'wall', count: 22, gaps: 2, gapWidth: 2.6, speed: 5.0, windup: 0.9,
                      cooldown: 2.2, kind: 'shard', color: warm, angle: DOWN },
                    { pattern: 'spiral', count: 11, spin: -23, speed: 5.0, windup: 0.6, cooldown: 1.0,
                      repeat: 8, repeatGap: 0.17, kind: 'orb', color: hot },
                ],
            },
            {
                name: 'SCUTTLE', hpFrom: 0.24, move: 'sway', moveSpeed: 1.1, amp: 6.5, y: 8.5,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'SCUTTLE', boss: b.id }),
                attacks: [
                    { special: 'ram', duration: 1.5, toY: 2.0, windup: 1.1, cooldown: 3.0 },
                    { pattern: 'nova', count: 26, speed: 2.6, speedAfter: 9, hang: 0.8, windup: 0.8,
                      cooldown: 1.5, repeat: 2, repeatGap: 0.6, kind: 'orb', color: hot },
                    { pattern: 'whip', count: 20, arc: 150, speed: 3.8, speedEnd: 7.4, windup: 0.7,
                      cooldown: 1.2, repeat: 2, repeatGap: 0.5, kind: 'shard', color: white },
                ],
            },
        ],
    },

    // L4 — everything is on the beat. The downbeat IS the windup.
    choirmaster: {
        id: 'choirmaster', name: 'THE CHOIRMASTER', title: 'SEEDER-HULK PRIME', model: 'choirmaster',
        hp: 4200, r: 3.0, color: 0xd6a8ff, score: 85000, entryY: 9, beatLocked: true,
        intro: 'It conducts. Every attack lands on the downbeat — so dodge on the downbeat.',
        phases: [
            {
                name: 'FIRST MOVEMENT', hpFrom: 1.0, move: 'orbit', moveSpeed: 0.6, amp: 5.5, ampY: 1.8, y: 8,
                attacks: [
                    { pattern: 'spiral', count: 11, spin: 16, speed: 4.4, windup: 0.5, cooldown: 0.8,
                      repeat: 9, repeatGap: 0.19, onBeat: true, kind: 'orb', color: 0xffa8e8 },
                    { pattern: 'ring', count: 24, speed: 4.2, windup: 0.6, cooldown: 1.1, repeat: 3, repeatGap: 0.5,
                      onBeat: true, kind: 'orb', color: warm },
                ],
            },
            {
                name: 'COUNTERPOINT', hpFrom: 0.66, move: 'sway', moveSpeed: 0.9, amp: 6.5, y: 8.5,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'COUNTERPOINT', boss: b.id }),
                attacks: [
                    { pattern: 'spiral', count: 10, spin: 24, speed: 4.6, windup: 0.4, cooldown: 0.7,
                      repeat: 11, repeatGap: 0.17, onBeat: true, kind: 'orb', color: 0xffa8e8 },
                    { pattern: 'spiral', count: 10, spin: -24, speed: 4.2, windup: 0.4, cooldown: 0.7,
                      repeat: 11, repeatGap: 0.17, onBeat: true, kind: 'orb', color: 0x8fd6ff },
                    { pattern: 'flower', count: 8, per: 4, splay: 32, spin: 13, speed: 4.0,
                      windup: 0.7, cooldown: 1.3, repeat: 3, repeatGap: 0.4, kind: 'petal', color: hot },
                ],
            },
            {
                name: 'CRESCENDO', hpFrom: 0.3, move: 'hunt', moveSpeed: 2.2, y: 8.5,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'CRESCENDO', boss: b.id }),
                attacks: [
                    { pattern: 'whip', count: 22, arc: 160, speed: 3.8, speedEnd: 7.6, windup: 0.6,
                      cooldown: 1.0, repeat: 2, repeatGap: 0.45, kind: 'shard', color: white, onBeat: true },
                    { pattern: 'flower', count: 10, per: 4, splay: 34, spin: 17, speed: 4.2,
                      windup: 0.6, cooldown: 1.1, repeat: 3, repeatGap: 0.38, kind: 'petal', color: hot },
                    { special: 'summon', count: 3, types: ['choirling'], windup: 0.6, cooldown: 3.4 },
                    { pattern: 'nova', count: 28, speed: 2.8, speedAfter: 8.6, hang: 0.85, windup: 0.7,
                      cooldown: 1.5, repeat: 2, repeatGap: 0.55, kind: 'orb', color: white },
                ],
            },
        ],
    },

    // L5 — your flight instructor, using the drills he taught you
    kel: {
        id: 'kel', name: 'WARDEN KEL', title: 'FLIGHT INSTRUCTOR, HALCYON ACADEMY', model: 'kel',
        hp: 4800, r: 2.4, color: 0x9fe8ff, score: 110000, entryY: 9,
        intro: 'Instructor Aramaki. He still sounds like himself. That is the worst part.',
        phases: [
            {
                name: 'DRILL ONE — SPACING', hpFrom: 1.0, move: 'blink', every: 3.0, amp: 5, y: 8.5,
                attacks: [
                    { pattern: 'aimed', count: 5, spread: 8, speed: 7.6, windup: 0.55, cooldown: 0.9,
                      repeat: 3, repeatGap: 0.3, kind: 'dart', color: 0x9fe8ff },
                    { pattern: 'fan', count: 13, spread: 90, speed: 5.4, windup: 0.6, cooldown: 1.1,
                      repeat: 3, repeatGap: 0.4, kind: 'dart', color: warm },
                ],
            },
            {
                name: 'DRILL TWO — DISCIPLINE', hpFrom: 0.72, move: 'blink', every: 2.2, amp: 6, y: 8.5,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'DRILL TWO', boss: b.id }),
                attacks: [
                    { special: 'flarewave', maxR: 15, speed: 13, windup: 0.9, cooldown: 4.0 },
                    { pattern: 'wall', count: 24, gaps: 1, gapWidth: 2.4, speed: 5.4, windup: 0.9,
                      cooldown: 2.0, kind: 'shard', color: warm, angle: DOWN },
                    { pattern: 'spiral', count: 11, spin: 27, speed: 5.0, windup: 0.5, cooldown: 0.9,
                      repeat: 9, repeatGap: 0.16, kind: 'orb', color: hot },
                ],
            },
            {
                name: 'DRILL THREE — THE THING I NEVER TAUGHT YOU', hpFrom: 0.42, move: 'hunt', moveSpeed: 4.0, y: 8,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'DRILL THREE', boss: b.id }),
                attacks: [
                    { pattern: 'homing', count: 7, spread: 80, speed: 3.6, turnRate: 2.0, homingUntil: 4,
                      windup: 0.6, cooldown: 1.5, repeat: 2, repeatGap: 0.5, kind: 'seeker', color: hot },
                    { pattern: 'laser', warn: 0.7, duration: 1.1, width: 1.1, sweep: 34, windup: 0, cooldown: 2.0, follow: true },
                    { pattern: 'whip', count: 20, arc: 140, speed: 4.0, speedEnd: 7.8, windup: 0.55,
                      cooldown: 1.0, repeat: 2, repeatGap: 0.45, kind: 'shard', color: white },
                ],
            },
            {
                name: 'KEL', hpFrom: 0.16, move: 'sway', moveSpeed: 1.4, amp: 7, y: 8.5,
                onEnter: (b, w) => { w.fx('bossPhase', { name: 'KEL', boss: b.id }); w.comms('kel_fighting_it'); },
                attacks: [
                    { pattern: 'ring', count: 28, speed: 4.0, windup: 0.8, cooldown: 1.2, repeat: 3, repeatGap: 0.45, kind: 'orb', color: white },
                    { pattern: 'spiral', count: 8, spin: 31, speed: 5.4, windup: 0.4, cooldown: 0.8,
                      repeat: 12, repeatGap: 0.15, kind: 'orb', color: hot },
                    { special: 'flarewave', maxR: 18, speed: 15, windup: 0.8, cooldown: 3.6 },
                ],
            },
        ],
    },

    // L6 — reprises every boss, then the story-gated finale
    heart: {
        id: 'heart', name: 'THE CHORUS HEART', title: 'THE THING AT THE TOP OF THE TETHER',
        model: 'heart', hp: 6800, r: 3.8, color: 0xff7fd0, score: 200000, entryY: 9.5,
        intro: 'Everything it has taken, it is still using. Including their voices.',
        phases: [
            {
                name: 'REPRISE — TARPON', hpFrom: 1.0, move: 'sway', moveSpeed: 0.6, amp: 5.5, y: 9,
                attacks: [
                    { pattern: 'fan', count: 13, spread: 76, speed: 5.2, windup: 0.6, cooldown: 1.0, repeat: 3, repeatGap: 0.4, kind: 'orb', color: warm },
                    { special: 'claw', dy: 3.0, speed: 10, windup: 0.8, cooldown: 2.0 },
                    { pattern: 'rain', count: 12, speed: 4.4, windup: 0.4, cooldown: 0.9, repeat: 3, repeatGap: 0.35, kind: 'orb', color: warm },
                ],
            },
            {
                name: 'REPRISE — NIMBUS & IRONMAW', hpFrom: 0.76, move: 'dip', moveSpeed: 0.85, amp: 6, dip: 3.5, y: 9,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'REPRISE II', boss: b.id }),
                attacks: [
                    { pattern: 'laser', warn: 0.75, duration: 1.1, width: 1.1, sweep: 28, windup: 0, cooldown: 2.2, follow: true },
                    { pattern: 'wall', count: 24, gaps: 2, gapWidth: 2.5, speed: 5.2, windup: 0.85,
                      cooldown: 2.0, kind: 'shard', color: warm, angle: DOWN },
                    { pattern: 'nova', count: 30, speed: 2.6, speedAfter: 8.8, hang: 0.9, windup: 0.8,
                      cooldown: 1.4, repeat: 2, repeatGap: 0.6, kind: 'orb', color: hot },
                    { special: 'summon', count: 4, types: ['weaver', 'popper'], windup: 0.7, cooldown: 3.4 },
                ],
            },
            {
                name: 'REPRISE — THE CHOIR', hpFrom: 0.5, move: 'orbit', moveSpeed: 0.75, amp: 6, ampY: 2, y: 8.5,
                onEnter: (b, w) => w.fx('bossPhase', { name: 'REPRISE III', boss: b.id }),
                attacks: [
                    { pattern: 'spiral', count: 12, spin: 22, speed: 4.6, windup: 0.45, cooldown: 0.75,
                      repeat: 11, repeatGap: 0.17, onBeat: true, kind: 'orb', color: 0xffa8e8 },
                    { pattern: 'spiral', count: 12, spin: -22, speed: 4.2, windup: 0.45, cooldown: 0.75,
                      repeat: 11, repeatGap: 0.17, onBeat: true, kind: 'orb', color: 0x8fd6ff },
                    { pattern: 'flower', count: 11, per: 4, splay: 33, spin: 15, speed: 4.2,
                      windup: 0.6, cooldown: 1.2, repeat: 3, repeatGap: 0.38, kind: 'petal', color: hot },
                ],
            },
            {
                // "EVERY NAME": a 24-arm spiral that opens one safe lane per
                // named cadet rescued. The story is literally the difficulty.
                name: 'EVERY NAME', hpFrom: 0.26, move: 'hunt', moveSpeed: 2.4, y: 8.5,
                onEnter: (b, w) => { w.fx('bossPhase', { name: 'EVERY NAME', boss: b.id }); w.comms('heart_final'); },
                attacks: [
                    { special: 'dim', duration: 2.0, windup: 0.4, cooldown: 6.0 },
                    { pattern: 'spiral', count: 24, spin: 9, speed: 4.4, windup: 0.7, cooldown: 1.0,
                      repeat: 9, repeatGap: 0.22, kind: 'orb', color: white,
                      lanes: (b, w) => w.run.cadets.length + (w.heartMercy ? 1 : 0) },
                    { pattern: 'whip', count: 24, arc: 170, speed: 4.0, speedEnd: 7.8, windup: 0.6,
                      cooldown: 1.1, repeat: 2, repeatGap: 0.45, kind: 'shard', color: hot },
                    { pattern: 'homing', count: 8, spread: 100, speed: 3.4, turnRate: 1.8, homingUntil: 4.5,
                      windup: 0.6, cooldown: 1.6, repeat: 2, repeatGap: 0.5, kind: 'seeker', color: hot },
                    { pattern: 'ring', count: 30, speed: 4.0, windup: 0.8, cooldown: 1.3, repeat: 3, repeatGap: 0.45, kind: 'orb', color: white,
                      lanes: (b, w) => w.run.cadets.length + (w.heartMercy ? 1 : 0) },
                ],
            },
        ],
    },
};

export const BOSS_IDS = Object.keys(BOSSES);

// ----------------------------------------------------------------- lifecycle

export function makeBoss(id, w, opts = {}) {
    const def = BOSSES[id];
    if (!def) throw new Error(`[bosses] unknown boss "${id}"`);
    const hp = Math.round(def.hp * (opts.hpMult ?? 1));
    return {
        id, def, isBoss: true,
        x: 0, y: ARENA.top + 6,
        hp, maxHp: hp,
        r: def.r,
        state: 'entry',          // entry → fight → transition → dying → dead
        stateT: 0,
        phaseIndex: 0,
        phase: def.phases[0],
        atkIndex: 0,
        atkTimer: 1.2,
        windup: 0,
        windupMax: 0,
        repeatsLeft: 0,
        repeatTimer: 0,
        moveT: 0,
        phaseT: 0,              // resets on every phase entry — drives the curves
        spiralPhase: 0,
        hitFlash: 0,
        hidden: false,
        invuln: true,
        alive: true,
        parts: (def.parts ?? []).map((p) => ({ ...p, maxHp: p.hp, alive: true, hitFlash: 0 })),
    };
}

function resolve(value, b, w) {
    return typeof value === 'function' ? value(b, w) : value;
}

/** Attacks whose turret has been shot off are skipped — the fight gets easier. */
function attackAvailable(b, a) {
    if (!a.needsPart) return true;
    const part = b.parts.find((p) => p.id === a.needsPart);
    return !part || part.alive;
}

function nextAttack(b) {
    const list = b.phase.attacks;
    for (let i = 1; i <= list.length; i++) {
        const idx = (b.atkIndex + i) % list.length;
        if (attackAvailable(b, list[idx])) return idx;
    }
    return b.atkIndex;
}

export function updateBoss(b, w, dt) {
    b.stateT += dt;
    b.moveT += dt;
    b.phaseT += dt;
    if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt * 4);

    if (b.state === 'entry') {
        b.y += ((b.def.entryY ?? 9) - b.y) * Math.min(1, dt * 1.6);
        b.invuln = true;
        if (b.stateT > 2.4) { b.state = 'fight'; b.stateT = 0; b.phaseT = 0; b.invuln = false; }
        return;
    }

    if (b.state === 'transition') {
        b.invuln = true;
        if (b.stateT > 1.5) {
            b.state = 'fight'; b.stateT = 0; b.invuln = false;
            b.phase.onEnter?.(b, w);
        }
        return;
    }

    if (b.state === 'dying') {
        b.invuln = true;
        MOVES.sway(b, w, dt, { y: b.y, amp: 1, moveSpeed: 2 });
        if (b.stateT > 3.2) { b.state = 'dead'; b.alive = false; w.onBossDefeated(b); }
        return;
    }

    if (b.state !== 'fight') return;

    // Any path that empties the health bar kills the boss, not just a bullet
    // going through damageBoss() — a flare field, a ram, a debug poke. Without
    // this a boss on 0 HP sat in its last phase forever.
    if (b.hp <= 0) { enterDying(b, w); return; }

    // --- phase advance -------------------------------------------------
    const frac = b.hp / b.maxHp;
    const next = b.def.phases[b.phaseIndex + 1];
    if (next && frac <= next.hpFrom) {
        b.phaseIndex++;
        b.phase = next;
        b.state = 'transition';
        b.stateT = 0;
        b.phaseT = 0;
        b.atkIndex = 0;
        b.atkTimer = 1.0;
        b.windup = 0;
        b.repeatsLeft = 0;
        w.clearEnemyBullets({ score: true });
        w.fx('bossPhaseFlash', { x: b.x, y: b.y, phase: b.phase.name });
        return;
    }

    // --- movement ------------------------------------------------------
    if (b.ramming) {
        const r = b.ramming;
        r.t += dt;
        const k = clamp(r.t / r.dur, 0, 1);
        // Smoothstep in and back out. The old curve used an exponent below 1
        // on the way down, which has an infinite slope at k=0 and so lurched
        // ~0.44u on the ram's very first tick (53 u/s) before easing normally.
        const lunge = k < 0.5 ? smoothstep(k * 2) : 1 - smoothstep((k - 0.5) * 2);
        b.y = r.fromY + (r.toY - r.fromY) * lunge;
        // Don't snap back to fromY — the ease above already returns to it, and
        // assigning it outright put a visible hop on the last tick of a ram.
        if (r.t >= r.dur) b.ramming = null;
    } else {
        (MOVES[b.phase.move] ?? MOVES.sway)(b, w, dt, b.phase);
    }
    b.x = clamp(b.x, ARENA.left + 2, ARENA.right - 2);

    // --- attack cycle ---------------------------------------------------
    const list = b.phase.attacks;
    if (!list || list.length === 0) return;
    let atk = list[b.atkIndex % list.length];

    if (b.repeatsLeft > 0) {
        b.repeatTimer -= dt;
        if (b.repeatTimer <= 0) {
            fireBossAttack(b, w, atk);
            b.repeatsLeft--;
            b.repeatTimer = atk.repeatGap ?? 0.25;
            if (b.repeatsLeft === 0) {
                b.atkIndex = nextAttack(b);
                b.atkTimer = atk.cooldown ?? 1.6;
            }
        }
        return;
    }

    if (b.windup > 0) {
        b.windup -= dt;
        if (b.windup <= 0) {
            fireBossAttack(b, w, atk);
            const reps = (atk.repeat ?? 1) - 1;
            if (reps > 0) {
                b.repeatsLeft = reps;
                b.repeatTimer = atk.repeatGap ?? 0.25;
            } else {
                b.atkIndex = nextAttack(b);
                b.atkTimer = atk.cooldown ?? 1.6;
            }
        }
        return;
    }

    b.atkTimer -= dt;
    if (b.atkTimer > 0) return;
    if (!attackAvailable(b, atk)) { b.atkIndex = nextAttack(b); return; }
    if (b.hidden) return;                     // Nimbus cannot fire from inside the cloud
    if (atk.onBeat && b.lastBeat === w.beatIndex) return;
    if (atk.onBeat) b.lastBeat = w.beatIndex;

    b.windup = Math.max(0.05, atk.windup ?? 0.5);
    b.windupMax = b.windup;
    w.fx('bossWindup', { x: b.x, y: b.y, duration: b.windup, attack: atk.pattern ?? atk.special });
}

function fireBossAttack(b, w, atk) {
    if (atk.special) {
        const fn = SPECIALS[atk.special];
        if (!fn) throw new Error(`[bosses] unknown special "${atk.special}"`);
        fn(b, w, atk);
        return;
    }
    const spec = { ...atk };
    if (typeof spec.lanes === 'function') spec.lanes = resolve(spec.lanes, b, w);
    w.fire(b, spec);
    b.spiralPhase++;
}

function enterDying(b, w) {
    b.hp = 0;
    b.state = 'dying';
    b.stateT = 0;
    b.windup = 0;
    b.repeatsLeft = 0;
    w.clearEnemyBullets({ score: true });
    w.fx('bossDying', { x: b.x, y: b.y, boss: b.id });
}

/** Called by collision code. Returns true if this hit killed the boss. */
export function damageBoss(b, w, amount) {
    if (b.invuln || b.state !== 'fight') return false;
    b.hp -= amount;
    b.hitFlash = 1;
    if (b.hp <= 0) {
        enterDying(b, w);
        return true;
    }
    return false;
}

export function damageBossPart(b, w, part, amount) {
    if (!part.alive) return false;
    part.hp -= amount;
    part.hitFlash = 1;
    if (part.hp <= 0) {
        part.alive = false;
        w.fx('partDestroyed', { x: b.x + part.dx, y: b.y + part.dy, name: part.name });
        w.addScore(4000);
        return true;
    }
    return false;
}
