/**
 * enemies.js — the rank-and-file: stats, move lists and AI.
 *
 * AI shape (classic beat-'em-up crowd control):
 *   - Only a few enemies may be "engaged" at once; they hold attack tokens
 *     (world.takeToken). Everyone else hovers at a distance, strafing in depth
 *     and drifting to flank, so a crowd surrounds you instead of queueing.
 *   - To attack, an enemy lines up on your depth (z) first, telegraphs (long
 *     startup, a warning flash on heavy moves), then strikes. After a combo
 *     it backs off and gives the token back.
 *   - Nobody kicks you while you're down; they wait for you to get up.
 */

import { isFree, setState, startMove, GRAV } from './fighter.js';

// ------------------------------------------------------------------ helpers
export function faceTo(e, p) { if (p) e.face = p.x >= e.x ? 1 : -1; }

export function walkTo(w, e, tx, tz, mul = 1) {
    const dx = tx - e.x, dz = tz - e.z;
    const ax = Math.abs(dx) > 3 ? Math.sign(dx) : 0;
    const az = Math.abs(dz) > 2 ? Math.sign(dz) * Math.min(1, Math.abs(dz) / 10) : 0;
    e.vx = ax * e.speed * mul; e.vz = az * e.zspeed * mul;
    const moving = ax || az;
    const ns = moving ? (mul > 1.4 && e.moves && e.def.canRun ? 'run' : 'walk') : 'idle';
    if (e.state !== ns) { e.state = ns; e.st = 0; e.anim = ns === 'idle' ? (e.def.idleAnim || 'idle') : ns; e.animT = 0; }
    return !moving;
}

export function stand(e) {
    e.vx = 0; e.vz = 0;
    if (e.state !== 'idle') { e.state = 'idle'; e.st = 0; e.anim = e.def.idleAnim || 'idle'; e.animT = 0; }
}

/** Steer apart from allies so a crowd spreads out in depth. */
export function separate(w, e) {
    for (const o of w.fighters) {
        if (o === e || o.team !== e.team || o.state === 'dead') continue;
        const dx = e.x - o.x, dz = e.z - o.z;
        if (Math.abs(dx) < 20 && Math.abs(dz) < 10) {
            e.vz += (dz >= 0 ? 1 : -1) * 26;
            e.vx += (dx >= 0 ? 1 : -1) * 18;
        }
    }
}

export function act(w, e, name) {
    const ok = startMove(w, e, name);
    if (ok && e.move.warn) { e.flash = 0.18; e.flashColor = 3; w.emit({ t: 'warn', id: e.id }); }
    return ok;
}

const pDown = (p) => !p || p.state === 'down' || p.state === 'getup' || p.state === 'dead' || p.invuln > 0.3 || p.state === 'grabbed';

// ------------------------------------------------------------------ moves
const M = {
    punchE: { anim: 'punch', st: 0.22, ac: 0.07, rc: 0.32, dmg: 6, box: [6, 38, 40, 68], kb: 'light', push: 40, stun: 0.34, whiff: 'swish' },
    jabE: { anim: 'jab', st: 0.16, ac: 0.06, rc: 0.24, dmg: 4, box: [6, 36, 40, 68], kb: 'light', push: 30, stun: 0.3, whiff: 'swish' },
    kickE: { anim: 'kick', st: 0.3, ac: 0.08, rc: 0.36, dmg: 9, box: [8, 48, 20, 56], kb: 'knock', push: 150, lift: 200, whiff: 'swishH', warn: true },
    flykick: { anim: 'jumpkick', air: true, holdAir: true, st: 0.16, ac: 0.5, rc: 0.1, dmg: 9, box: [6, 44, 8, 50], kb: 'knock', push: 150, lift: 180,
        onActive(w, e) { e.vy = 300; e.vx = e.face * 190; } },
    slashE: { anim: 'slash', st: 0.2, ac: 0.07, rc: 0.3, dmg: 8, box: [6, 48, 34, 72], kb: 'light', push: 40, stun: 0.36, spark: 'slash', sfx: 'slashHit', whiff: 'swish' },
    slash2E: { anim: 'slash2', st: 0.12, ac: 0.07, rc: 0.3, dmg: 7, box: [6, 48, 34, 72], kb: 'heavy', push: 50, spark: 'slash', sfx: 'slashHit', whiff: 'swish' },
    lungeE: { anim: 'lunge', st: 0.36, ac: 0.22, rc: 0.4, vx: [0, 300, 0], dmg: 10, box: [4, 44, 34, 66], kb: 'knock', push: 160, lift: 190, spark: 'slash', warn: true, whiff: 'swishH' },
    knifeToss: { anim: 'toss', st: 0.3, ac: 0.05, rc: 0.35, proj: { type: 'knife', dx: 18, dy: 54, vx: 300, dmg: 8, kb: 'heavy', push: 50, ttl: 1.6 }, warn: true },
    slamE: { anim: 'slam', st: 0.48, ac: 0.1, rc: 0.5, dmg: 14, box: [6, 54, 4, 86], kb: 'knock', push: 170, lift: 240, armor: true, shake: 5, warn: true, sfx: 'thud' },
    heavyPunch: { anim: 'punch', st: 0.3, ac: 0.08, rc: 0.36, dmg: 10, box: [6, 50, 40, 84], kb: 'heavy', push: 80, stun: 0.5, whiff: 'swishH' },
    grabE: { anim: 'grab', st: 0.26, ac: 0.12, rc: 0.4, box: [0, 34, 20, 80], kb: 'grab', grab: true, dmg: 0 },
    throwE: { anim: 'throwF', grabMove: true, st: 0.2, ac: 0.1, rc: 0.35, onActive(w, e) { w.throwGrabbed(e, 1, 15); } },
    charge: {
        anim: 'windup', st: 0.65, ac: 1.0, rc: 0.45, vx: [0, 290, 0], dmg: 14, box: [0, 34, 6, 80], kb: 'knock', push: 220, lift: 230, armor: true, warn: true, shake: 4,
        onActive(w, e) { e.anim = 'charge'; e.animT = 0; e.ai.chargeFrom = e.x; },
        onTick(w, e, dt, ph) {
            if (ph === 'ac' && (Math.abs(e.x - e.ai.chargeFrom) > 230 || e.x < w.camL - 10 || e.x > w.camR + 10)) {
                e.mt = e.move.st + e.move.ac; e.anim = 'idle';
            }
        },
        onEnd(w, e) { e.anim = 'idle'; },
    },
    batonE: { anim: 'cross', st: 0.24, ac: 0.07, rc: 0.32, dmg: 8, box: [6, 50, 36, 74], kb: 'heavy', push: 60, spark: 'elec', sfx: 'zap', whiff: 'swish' },
    bashE: { anim: 'bash', st: 0.28, ac: 0.12, rc: 0.4, vx: [0, 150, 0], dmg: 7, box: [4, 36, 20, 74], kb: 'knock', push: 190, lift: 150, warn: true, sfx: 'clang' },
    shootE: { anim: 'shoot', st: 0.5, ac: 0.05, rc: 0.38, proj: { type: 'bullet', dx: 28, dy: 54, vx: 380, dmg: 9, kb: 'heavy', push: 60, ttl: 1.6 }, sfx: 'gun',
        onStart(w, e) { w.emit({ t: 'aim', id: e.id, dur: 0.5 }); } },
    flipE: { anim: 'flip', air: true, holdAir: true, st: 0.02, ac: 0.4, rc: 0.05, inv: true, onStart(w, e) { e.vy = 330; e.vx = -e.face * 170; } },
    jumpSlash: { anim: 'jumpkick', air: true, holdAir: true, st: 0.18, ac: 0.55, rc: 0.1, dmg: 9, box: [4, 46, 10, 60], kb: 'knock', push: 150, lift: 170, spark: 'slash', warn: true,
        onActive(w, e) { const p = w.player; const d = p ? Math.min(160, Math.abs(p.x - e.x)) : 100; e.vy = 330; e.vx = e.face * d * 1.6; } },
    shuriken: { anim: 'toss', st: 0.22, ac: 0.05, rc: 0.25, proj: { type: 'shuriken', dx: 18, dy: 50, vx: 330, dmg: 6, kb: 'light', push: 40, ttl: 1.6 } },
    pounce: { anim: 'leap', st: 0.32, ac: 0.6, rc: 0.25, air: true, landEnd: true, dmg: 11, box: [0, 40, 10, 66], kb: 'knock', push: 160, lift: 200, spark: 'slash', warn: true,
        onActive(w, e) { const p = w.player; const d = p ? Math.min(170, Math.abs(p.x - e.x)) : 100; e.vy = 300; e.vx = e.face * d * 1.85; } },
    laser: { anim: 'shoot', st: 0.55, ac: 0.05, rc: 0.45, proj: { type: 'laser', dx: 12, dy: 10, vx: 320, dmg: 7, kb: 'heavy', push: 50, ttl: 1.5 }, sfx: 'laser',
        onStart(w, e) { w.emit({ t: 'aim', id: e.id, dur: 0.55 }); } },
    spitE: { anim: 'spit', st: 0.42, ac: 0.06, rc: 0.4, proj: { type: 'acid', dx: 16, dy: 64, vx: 160, vy: 220, dmg: 8, kb: 'heavy', push: 40, ttl: 3, grav: true }, sfx: 'spit', warn: true },
};
export const ENEMY_MOVES = M;

// ------------------------------------------------------------------ defs
export const ENEMIES = {
    punk: { name: 'STREET RAT', sprite: 'punk', hp: 34, speed: 70, zspeed: 46, w: 10, h: 72, score: 150, cred: [5, 20], ai: 'brawler', range: 32,
        moves: { punch: M.punchE, jab: M.jabE, kick: M.kickE, flykick: M.flykick }, combos: [['jab', 'punch'], ['punch'], ['kick'], ['jab', 'jab', 'kick']], jumpAttack: 'flykick',
        variants: ['base', 'b', 'c', 'd', 'e'], canRun: true },
    knifer: { name: 'SHIV', sprite: 'knifer', hp: 30, speed: 78, zspeed: 50, w: 10, h: 72, score: 200, cred: [10, 25], ai: 'brawler', range: 38,
        moves: { slash: M.slashE, slash2: M.slash2E, lunge: M.lungeE, toss: M.knifeToss }, combos: [['slash', 'slash2'], ['slash'], ['lunge']], ranged: 'toss', rangedCd: 4,
        dash: 'lunge', variants: ['base', 'b', 'c', 'd'], canRun: true },
    bruiser: { name: 'BULK', sprite: 'bruiser', hp: 95, speed: 46, zspeed: 32, w: 15, h: 86, score: 500, cred: [30, 60], ai: 'heavy', range: 40, poise: 18, weight: 1.6,
        moves: { slam: M.slamE, punch: M.heavyPunch, charge: M.charge, grab: M.grabE, throwF: M.throwE }, variants: ['base', 'b', 'c'], downTime: 0.9 },
    guard: { name: 'AUREX SEC', sprite: 'guard', hp: 55, speed: 56, zspeed: 38, w: 11, h: 76, score: 300, cred: [15, 35], ai: 'guard', range: 38, weight: 1.15,
        moves: { baton: M.batonE, bash: M.bashE }, variants: ['base', 'elite'], blocker: true },
    gunner: { name: 'ENFORCER', sprite: 'gunner', hp: 40, speed: 62, zspeed: 44, w: 10, h: 74, score: 300, cred: [15, 35], ai: 'ranged', range: 34,
        moves: { shoot: M.shootE, punch: M.punchE }, variants: ['base', 'b', 'c'], canRun: true },
    ninja: { name: 'KUNOICHI', sprite: 'ninja', hp: 44, speed: 96, zspeed: 62, w: 9, h: 70, score: 400, cred: [20, 40], ai: 'ninja', range: 40,
        moves: { slash: { ...M.slashE, st: 0.14 }, slash2: M.slash2E, jumpSlash: M.jumpSlash, flip: M.flipE, shuriken: M.shuriken }, combos: [['slash', 'slash2'], ['slash', 'slash2', 'slash']],
        variants: ['base', 'b', 'c'], canRun: true },
    ripper: { name: 'RIPPER', sprite: 'ripper', hp: 62, speed: 82, zspeed: 54, w: 11, h: 74, score: 450, cred: [20, 45], ai: 'leaper', range: 40, poise: 6,
        moves: { slash: { ...M.slashE, dmg: 9, st: 0.16 }, slash2: { ...M.slash2E, dmg: 9 }, pounce: M.pounce }, combos: [['slash', 'slash2'], ['slash', 'slash2', 'slash']],
        variants: ['base', 'b'], canRun: true },
    synth: { name: 'SYNTH TROOPER', sprite: 'synth', hp: 62, speed: 80, zspeed: 54, w: 10, h: 72, score: 450, cred: [20, 45], ai: 'synth', range: 34,
        moves: { jab: { ...M.jabE, st: 0.12, dmg: 5 }, cross: { ...M.punchE, anim: 'cross', st: 0.12, dmg: 7 }, kick: { ...M.kickE, st: 0.22, dmg: 10 }, lunge: { ...M.lungeE, anim: 'lunge', dmg: 11 } },
        combos: [['jab', 'cross', 'kick'], ['jab', 'cross'], ['kick']], dash: 'lunge', variants: ['base', 'elite', 'gold'], blockChance: 0.35, canRun: true },
    husk: { name: 'HUSK', sprite: 'husk', hp: 80, speed: 40, zspeed: 28, w: 14, h: 82, score: 400, cred: [20, 50], ai: 'heavy', range: 40, poise: 12, weight: 1.4,
        moves: { slam: M.slamE, punch: M.heavyPunch, spit: M.spitE }, ranged: 'spit', rangedCd: 3.5, variants: ['base', 'b'], noCharge: true, downTime: 0.9 },
    drone: { name: 'HORNET DRONE', sprite: 'drone', hp: 22, speed: 80, zspeed: 60, w: 12, h: 26, hy0: 0, score: 250, cred: [10, 25], ai: 'drone', flying: true, alt: 46,
        moves: { shoot: M.laser }, variants: ['base', 'b'], idleAnim: 'hover', noGrab: true, weight: 0.8 },
    mine: { name: 'TICK MINE', sprite: 'mine', hp: 8, speed: 96, zspeed: 70, w: 9, h: 18, score: 100, cred: [0, 5], ai: 'mine', noGrab: true, weight: 0.7, variants: ['base'] },
};

// ------------------------------------------------------------------ AI
function hoverPoint(w, e, p) {
    const ai = e.ai;
    if (!ai.side) ai.side = e.x < p.x ? -1 : 1;
    // occasionally swap sides to flank, more so if the other side is empty
    if (w.rng() < 0.12) {
        const mine = w.fighters.filter((o) => o.team === 'enemy' && Math.sign(o.x - p.x) === ai.side).length;
        const other = w.fighters.filter((o) => o.team === 'enemy' && Math.sign(o.x - p.x) === -ai.side).length;
        if (mine > other + 1) ai.side = -ai.side;
    }
    ai.hx = ai.side * w.rng.range(72, 120);
    ai.hz = Math.max(w.zMin, Math.min(w.zMax, p.z + w.rng.range(-26, 26)));
}

function cooldown(w, e) {
    const [a, b] = e.def.cooldown || [0.6, 1.4];
    e.ai.cd = w.rng.range(a, b) / w.diff.aggr;
}

function engage(w, e, p, dt, opts = {}) {
    const ai = e.ai, def = e.def;
    const dx = p.x - e.x, dz = p.z - e.z, adx = Math.abs(dx);
    const range = def.range;
    if (adx <= range + 4 && Math.abs(dz) <= 7 && !pDown(p)) {
        faceTo(e, p);
        const combo = w.rng.pick(def.combos || [[Object.keys(e.moves)[0]]]);
        ai.combo = combo.slice(1);
        act(w, e, combo[0]);
        return true;
    }
    // dash attacks from mid range when lined up
    if (def.dash && adx > 60 && adx < 120 && Math.abs(dz) < 6 && w.rng() < 0.02 * w.diff.aggr && !pDown(p)) {
        faceTo(e, p); ai.combo = []; act(w, e, def.dash); return true;
    }
    if (def.jumpAttack && adx > 70 && adx < 110 && Math.abs(dz) < 6 && w.rng() < 0.012 * w.diff.aggr && !pDown(p)) {
        faceTo(e, p); ai.combo = []; act(w, e, def.jumpAttack); return true;
    }
    const tx = p.x - Math.sign(dx || 1) * (range * 0.75);
    walkTo(w, e, tx, p.z, opts.speedMul || (adx > 120 ? 1.3 : 1));
    faceTo(e, p);
    return false;
}

function hover(w, e, p, dt) {
    const ai = e.ai;
    if (ai.hx === undefined || ai.t <= 0) hoverPoint(w, e, p);
    const arrived = walkTo(w, e, p.x + ai.hx, ai.hz, 0.75);
    faceTo(e, p);
    if (arrived && e.def.moves && w.rng() < 0.003 && e.state === 'idle' && !e.def.flying) { e.anim = 'taunt'; e.animT = 0; ai.taunt = 1.2; }
}

/** Run after a move finishes: continue the combo if it connected. */
function afterMove(w, e) {
    const ai = e.ai;
    if (ai.combo && ai.combo.length && e.lastHit) {
        const nx = ai.combo.shift();
        e.lastHit = false;
        act(w, e, nx);
        return true;
    }
    ai.combo = [];
    if (e.token) w.releaseToken(e);
    cooldown(w, e);
    ai.mode = 'hover'; ai.t = w.rng.range(0.4, 0.9);
    hoverPoint(w, e, w.player || e);
    return false;
}

const THINK = {
    brawler(w, e, p, dt) {
        const ai = e.ai;
        if (ai.t <= 0) {
            ai.t = w.rng.range(0.25, 0.55);
            const want = ai.cd <= 0 && !pDown(p);
            ai.mode = want && (e.token || w.takeToken(e)) ? 'engage' : 'hover';
            if (ai.mode === 'hover') hoverPoint(w, e, p);
        }
        if (e.def.ranged && ai.rcd <= 0 && Math.abs(p.z - e.z) < 6 && Math.abs(p.x - e.x) > 90 && Math.abs(p.x - e.x) < 220 && !pDown(p)) {
            faceTo(e, p); ai.rcd = e.def.rangedCd || 4; ai.combo = []; act(w, e, e.def.ranged); return;
        }
        if (ai.mode === 'engage') engage(w, e, p, dt); else hover(w, e, p, dt);
    },
    synth(w, e, p, dt) {
        THINK.brawler(w, e, p, dt);
        // raise a guard while waiting, if the player is close and coming
        e.blocking = ai_blocking(w, e, p);
    },
    guard(w, e, p, dt) {
        const ai = e.ai;
        e.blocking = true;
        if (ai.blocked >= 2 && Math.abs(p.x - e.x) < 50) { ai.blocked = 0; faceTo(e, p); e.blocking = false; ai.combo = []; act(w, e, 'bash'); return; }
        if (ai.t <= 0) {
            ai.t = w.rng.range(0.3, 0.6);
            ai.mode = ai.cd <= 0 && !pDown(p) && (e.token || w.takeToken(e)) ? 'engage' : 'hover';
            if (ai.mode === 'hover') hoverPoint(w, e, p);
        }
        if (ai.mode === 'engage') {
            const dx = p.x - e.x;
            if (Math.abs(dx) <= e.def.range + 4 && Math.abs(p.z - e.z) <= 7 && !pDown(p)) {
                faceTo(e, p); e.blocking = false; ai.combo = w.rng() < 0.4 ? ['bash'] : [];
                act(w, e, 'baton');
            } else { walkTo(w, e, p.x - Math.sign(dx || 1) * 30, p.z, 0.9); faceTo(e, p); }
        } else hover(w, e, p, dt);
    },
    heavy(w, e, p, dt) {
        const ai = e.ai, def = e.def;
        const dx = p.x - e.x, adx = Math.abs(dx), dz = Math.abs(p.z - e.z);
        if (ai.t <= 0) {
            ai.t = w.rng.range(0.35, 0.7);
            ai.mode = ai.cd <= 0 && !pDown(p) && (e.token || w.takeToken(e)) ? 'engage' : 'hover';
            if (ai.mode === 'hover') hoverPoint(w, e, p);
        }
        if (def.ranged && ai.rcd <= 0 && dz < 8 && adx > 70 && adx < 190 && !pDown(p)) {
            faceTo(e, p); ai.rcd = def.rangedCd; ai.combo = []; act(w, e, def.ranged); return;
        }
        if (ai.mode !== 'engage') { hover(w, e, p, dt); return; }
        if (!def.noCharge && adx > 90 && adx < 200 && dz < 6 && ai.ccd <= 0 && !pDown(p)) {
            faceTo(e, p); ai.ccd = w.rng.range(4, 7); ai.combo = []; act(w, e, 'charge'); return;
        }
        if (adx <= def.range + 6 && dz <= 8 && !pDown(p)) {
            faceTo(e, p); ai.combo = [];
            const r = w.rng();
            if (e.moves.grab && r < 0.25 && p.state !== 'attack') act(w, e, 'grab');
            else if (r < 0.6) act(w, e, 'slam');
            else act(w, e, 'punch');
            return;
        }
        walkTo(w, e, p.x - Math.sign(dx || 1) * def.range * 0.8, p.z, 1); faceTo(e, p);
    },
    ranged(w, e, p, dt) {
        const ai = e.ai;
        const dx = p.x - e.x, adx = Math.abs(dx), dz = p.z - e.z;
        if (adx < 44 && Math.abs(dz) < 8 && ai.cd <= 0 && !pDown(p)) { faceTo(e, p); ai.combo = []; act(w, e, 'punch'); return; }
        if (!ai.side) ai.side = e.x < p.x ? -1 : 1;
        if (adx < 60 && w.rng() < 0.01) ai.side = -ai.side;
        const want = ai.side * w.rng.range(130, 170);
        if (ai.t <= 0) { ai.t = w.rng.range(0.4, 0.8); ai.tx = p.x + want; }
        const inView = e.x > w.camL + 16 && e.x < w.camR - 16;
        if (Math.abs(dz) < 5 && adx > 80 && ai.rcd <= 0 && inView && !pDown(p)) {
            faceTo(e, p); ai.rcd = w.rng.range(1.8, 3.2) / w.diff.aggr; ai.combo = []; act(w, e, 'shoot'); return;
        }
        const tx = Math.max(w.camL + 24, Math.min(w.camR - 24, ai.tx ?? p.x + want));
        walkTo(w, e, tx, p.z, 0.9); faceTo(e, p);
    },
    ninja(w, e, p, dt) {
        const ai = e.ai;
        const dx = p.x - e.x, adx = Math.abs(dx), dz = Math.abs(p.z - e.z);
        // read the player's startup and slip away
        if (p.state === 'attack' && p.phase === 'st' && adx < 56 && dz < 10 && ai.ecd <= 0 && w.rng() < 0.35 * w.diff.aggr && Math.sign(dx) === -p.face) {
            ai.ecd = 2.2; faceTo(e, p); act(w, e, 'flip'); return;
        }
        if (ai.rcd <= 0 && dz < 6 && adx > 110 && adx < 240 && !pDown(p)) { faceTo(e, p); ai.rcd = w.rng.range(3, 5); ai.combo = []; act(w, e, 'shuriken'); return; }
        if (ai.t <= 0) {
            ai.t = w.rng.range(0.2, 0.45);
            ai.mode = ai.cd <= 0 && !pDown(p) && (e.token || w.takeToken(e)) ? 'engage' : 'hover';
            if (ai.mode === 'hover') hoverPoint(w, e, p);
        }
        if (ai.mode === 'engage' && adx > 70 && adx < 150 && dz < 6 && w.rng() < 0.04 && !pDown(p)) { faceTo(e, p); ai.combo = []; act(w, e, 'jumpSlash'); return; }
        if (ai.mode === 'engage') engage(w, e, p, dt, { speedMul: 1.2 }); else hover(w, e, p, dt);
    },
    leaper(w, e, p, dt) {
        const ai = e.ai;
        const adx = Math.abs(p.x - e.x), dz = Math.abs(p.z - e.z);
        if (ai.t <= 0) {
            ai.t = w.rng.range(0.25, 0.5);
            ai.mode = ai.cd <= 0 && !pDown(p) && (e.token || w.takeToken(e)) ? 'engage' : 'hover';
            if (ai.mode === 'hover') hoverPoint(w, e, p);
        }
        if (ai.mode === 'engage' && adx > 80 && adx < 160 && dz < 6 && ai.pcd <= 0 && !pDown(p)) { faceTo(e, p); ai.pcd = w.rng.range(2.5, 4.5); ai.combo = []; act(w, e, 'pounce'); return; }
        if (ai.mode === 'engage') engage(w, e, p, dt); else hover(w, e, p, dt);
    },
    drone(w, e, p, dt) {
        const ai = e.ai;
        e.y += (e.def.alt + Math.sin(w.t * 3 + e.id) * 4 - e.y) * Math.min(1, dt * 3);
        if (!ai.side) ai.side = e.x < p.x ? -1 : 1;
        if (ai.t <= 0) { ai.t = w.rng.range(1, 2); if (w.rng() < 0.3) ai.side = -ai.side; ai.dist = w.rng.range(80, 130); }
        const tx = Math.max(w.camL + 20, Math.min(w.camR - 20, p.x + ai.side * (ai.dist || 100)));
        walkTo(w, e, tx, p.z, 1);
        e.state = 'idle'; e.anim = 'hover';
        faceTo(e, p);
        if (Math.abs(p.z - e.z) < 5 && ai.rcd <= 0 && !pDown(p) && e.x > w.camL && e.x < w.camR) {
            ai.rcd = w.rng.range(1.6, 2.8) / w.diff.aggr; act(w, e, 'shoot');
        }
    },
    mine(w, e, p, dt) {
        const ai = e.ai;
        if (ai.armed !== undefined) {
            e.vx = e.vz = 0; ai.armed -= dt;
            e.flash = (Math.floor(ai.armed * 12) % 2) ? 0.05 : 0; e.flashColor = 3;
            if (ai.armed <= 0) w.explodeMine(e);
            return;
        }
        const dx = p.x - e.x, dz = p.z - e.z;
        if (Math.abs(dx) < 22 && Math.abs(dz) < 9 && !pDown(p)) { ai.armed = 0.65; e.state = 'idle'; e.anim = 'idle'; w.emit({ t: 'sfx', id: 'beep', x: e.x }); return; }
        walkTo(w, e, p.x, p.z, 1); faceTo(e, p);
    },
};

function ai_blocking(w, e, p) {
    if (!isFree(e) || !e.def.blockChance) return false;
    const close = Math.abs(p.x - e.x) < 70 && Math.abs(p.z - e.z) < 12 && Math.sign(p.x - e.x) === e.face;
    if (!close) { e.ai.blockRoll = null; return false; }
    if (e.ai.blockRoll == null) e.ai.blockRoll = w.rng() < e.def.blockChance * w.diff.aggr;
    if (e.ai.blockRoll && (p.state === 'attack')) { stand(e); return true; }
    return false;
}

/** Called every step for each enemy (not bosses — see bosses.js). */
export function thinkEnemy(w, e, dt) {
    const ai = e.ai;
    ai.t = (ai.t ?? 0) - dt; ai.cd = (ai.cd ?? 0.6) - dt; ai.rcd = (ai.rcd ?? 1.5) - dt;
    ai.ccd = (ai.ccd ?? 2) - dt; ai.ecd = (ai.ecd ?? 0) - dt; ai.pcd = (ai.pcd ?? 1.5) - dt;
    if (ai.taunt > 0) { ai.taunt -= dt; if (isFree(e)) { e.vx = e.vz = 0; return; } }

    // move just finished? continue the combo or back off
    if (ai.wasAttacking && e.state !== 'attack') { ai.wasAttacking = false; if (isFree(e) && afterMove(w, e)) { ai.wasAttacking = true; return; } }
    if (e.state === 'attack') { ai.wasAttacking = true; return; }
    if (e.state === 'grabbing') {
        e.grabT -= 0;
        if (e.st > 0.55) act(w, e, 'throwF');
        return;
    }
    if (!isFree(e)) { e.blocking = false; if (e.token && e.state !== 'attack') w.releaseToken(e); return; }
    if (e.def.ai !== 'guard' && e.def.ai !== 'synth') e.blocking = false;

    const p = w.player;
    if (!p) { stand(e); return; }
    // walk on screen first
    if (e.x < w.camL - 4 || e.x > w.camR + 4) {
        walkTo(w, e, Math.max(w.camL + 30, Math.min(w.camR - 30, e.x)), e.z, 1.2); faceTo(e, p); return;
    }
    (THINK[e.def.ai] || THINK.brawler)(w, e, p, dt);
    if (isFree(e) && !e.def.flying) separate(w, e);
}

export { GRAV, setState };
