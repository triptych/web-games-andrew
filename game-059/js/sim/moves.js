/**
 * moves.js — Juno's move list, the pickup weapons, and the VANTA-7 suit's
 * special moves. All numbers are world units (sprite pixels) and seconds.
 *
 * Chain:   ATK ATK ATK ATK          jab, cross, elbow, roundhouse (knockdown)
 *          ...then JUMP after a hit  launcher uppercut (juggle)
 *          back + ATK                backfist (turns around)
 *          run + ATK                 dash knee
 * Air:     ATK                       flying kick (or jumping knee straight up)
 *          down + ATK                dive stomp (bounces off)
 * Grab:    walk into a dazed foe     ATK knees x2 then headbutt,
 *          toward/away + ATK         throw / suplex, JUMP vaults over
 * Suit:    SPECIAL                   Arc Burst (360°, invulnerable)
 *          toward/away + SPECIAL     Rail Dash
 *          SPECIAL in the air        Meteor Drop
 *          OVERDRIVE (meter full)    8 s of double-fast, heavy-hitting suit
 */

import { GRAV, setState, startMove } from './fighter.js';

export const PLAYER_DEF = {
    name: 'JUNO', sprite: 'juno', hp: 100, w: 10, h: 70, speed: 112, zspeed: 74, weight: 1,
    grabDist: 22,
};

export const WEAPONS = {
    pipe: { name: 'STEEL PIPE', uses: 22, dmg: [11, 11, 17], reach: 16, spark: 'heavy', sfx: 'clang', whiff: 'swishH' },
    katana: { name: 'MONO-KATANA', uses: 18, dmg: [12, 12, 19], reach: 22, spark: 'slash', sfx: 'slashHit', whiff: 'swish', fast: true },
    baton: { name: 'SHOCK BATON', uses: 20, dmg: [9, 9, 14], reach: 12, spark: 'elec', sfx: 'zap', whiff: 'swish', stun: 0.75 },
    knives: { name: 'THROWING KNIVES', uses: 5, throwOnly: true },
};

const L = { kb: 'light', stun: 0.34, whiff: 'swish' };

export const PLAYER_MOVES = {
    jab: { ...L, anim: 'jab', st: 0.05, ac: 0.06, rc: 0.12, dmg: 5, box: [6, 38, 40, 66], push: 26, next: 'cross', chain: 1, meter: 1 },
    cross: { ...L, anim: 'cross', st: 0.05, ac: 0.06, rc: 0.14, dmg: 6, box: [6, 40, 40, 66], push: 30, next: 'hook', chain: 2 },
    hook: { anim: 'hook', st: 0.07, ac: 0.07, rc: 0.17, dmg: 7, kb: 'heavy', stun: 0.42, box: [4, 34, 38, 68], push: 34, next: 'kick', chain: 3, whiff: 'swish' },
    kick: { anim: 'kick', st: 0.09, ac: 0.08, rc: 0.27, dmg: 12, kb: 'knock', box: [8, 48, 20, 54], push: 175, lift: 220, shake: 3, chain: 4, vx: [0, 50, 0], whiff: 'swishH' },
    upper: { anim: 'upper', st: 0.06, ac: 0.09, rc: 0.3, dmg: 10, kb: 'launch', box: [0, 32, 34, 92], lift: 390, push: 30, shake: 2, whiff: 'swishH' },
    backfist: { anim: 'backfist', turn: true, st: 0.06, ac: 0.07, rc: 0.2, dmg: 9, kb: 'heavy', box: [4, 38, 38, 68], push: 70, stun: 0.5, whiff: 'swish' },
    dashknee: { anim: 'dashknee', st: 0.03, ac: 0.2, rc: 0.24, dmg: 12, kb: 'knock', box: [0, 34, 24, 60], push: 185, lift: 210, vx: [200, 240, 20], shake: 3, whiff: 'swishH' },
    jumpkick: { anim: 'jumpkick', air: true, holdAir: true, st: 0.04, ac: 0.36, rc: 0.1, dmg: 11, kb: 'knock', box: [6, 44, 8, 50], push: 150, lift: 170, whiff: 'swishH' },
    jumpknee: { anim: 'jumpknee', air: true, holdAir: true, st: 0.04, ac: 0.3, rc: 0.1, dmg: 9, kb: 'heavy', box: [0, 30, 22, 60], push: 60, stun: 0.5 },
    airkick2: { anim: 'airkick2', air: true, holdAir: true, st: 0.05, ac: 0.24, rc: 0.1, dmg: 10, kb: 'knock', box: [6, 46, 14, 54], vyA: 170, push: 160, lift: 200, whiff: 'swishH' },
    stomp: {
        anim: 'stomp', air: true, holdAir: true, st: 0.06, ac: 0.6, rc: 0.05, dmg: 10, kb: 'knock', box: [-16, 16, -10, 20], vyA: -440, push: 90, lift: 220, z: 14,
        onHitLanded(w, f) { f.vy = 300; f.mt = f.move.st + f.move.ac; },
    },

    // ---- grab follow-ups (target is held, so hits use kb 'grab': no release) ----
    knee: { anim: 'knee', grabMove: true, st: 0.07, ac: 0.06, rc: 0.15, dmg: 6, kb: 'grab', box: [0, 34, 10, 70], z: 14, sfx: 'hitH',
        onEnd(w, f) { if (f.grab && f.grab.state === 'grabbed') { setState(f, 'grabbing', 'grab'); } } },
    headbutt: { anim: 'headbutt', grabMove: true, st: 0.08, ac: 0.06, rc: 0.22, dmg: 10, kb: 'knock', box: [0, 34, 10, 76], z: 14, push: 170, lift: 220, shake: 3 },
    throwF: {
        anim: 'throwF', grabMove: true, st: 0.13, ac: 0.1, rc: 0.25,
        onActive(w, f) { w.throwGrabbed(f, 1); },
    },
    throwB: {
        anim: 'throwB', grabMove: true, st: 0.14, ac: 0.12, rc: 0.3,
        onActive(w, f) { w.throwGrabbed(f, -1); },
    },

    // ---- suit specials ----
    arc: {
        anim: 'arc', st: 0.1, ac: 0.24, rc: 0.22, inv: true, dmg: 14, kb: 'knock', aoe: true, box: [0, 54, -4, 84], z: 24,
        push: 175, lift: 270, shake: 5, spark: 'elec', sfx: 'zap', cost: 20,
        onActive(w, f) { w.emit({ t: 'arc', id: f.id, x: f.x, y: f.y + 40, z: f.z, od: !!f.od }); w.emit({ t: 'sfx', id: 'arc', x: f.x }); },
    },
    rail: {
        anim: 'rail', st: 0.1, ac: 0.3, rc: 0.04, inv: true, dmg: 6, kb: 'heavy', stun: 0.5, box: [0, 38, 22, 70], z: 14, rehit: 0.08,
        vx: [0, 340, 60], push: 340, spark: 'elec', cost: 25,
        onActive(w, f) { w.emit({ t: 'trail', id: f.id, dur: 0.32 }); w.emit({ t: 'sfx', id: 'rail', x: f.x }); },
        onEnd(w, f) { startMove(w, f, 'railEnd'); },
    },
    railEnd: { anim: 'upper', st: 0.02, ac: 0.08, rc: 0.26, dmg: 10, kb: 'knock', box: [0, 38, 22, 86], push: 210, lift: 320, shake: 4, spark: 'elec', inv: true },
    meteor: {
        anim: 'meteor', air: true, landEnd: true, st: 0.14, ac: 0.8, rc: 0.02, inv: true, noGravSt: true, dmg: 12, kb: 'knock', box: [-14, 22, -6, 34], z: 14,
        push: 140, lift: 240, cost: 20, spark: 'elec',
        onStart(w, f) { f.vy = 120; f.vx *= 0.3; },
        onTick(w, f, dt, ph) { if (ph === 'st') { f.vy = Math.max(f.vy, 0) * 0.9; f.vx *= 0.9; } },
        onActive(w, f) { f.vy = -700; f.vx = f.face * 60; w.emit({ t: 'sfx', id: 'dive', x: f.x }); },
        onLand(w, f) {
            w.aoe(f, { x: f.x, z: f.z, r: 66, zr: 26, dmg: 16, kb: 'knock', push: 190, lift: 300, spark: 'elec', shake: 7 });
            w.emit({ t: 'shock', x: f.x, z: f.z, r: 66, color: f.od ? 'od' : 'cyan' });
            w.emit({ t: 'sfx', id: 'boom', x: f.x });
            startMove(w, f, 'meteorRec');
        },
    },
    meteorRec: { anim: 'land', st: 0.01, ac: 0.01, rc: 0.2, inv: true },
    rising: {
        anim: 'rising', air: true, holdAir: true, st: 0.06, ac: 0.3, rc: 0.25, inv: true, vyA: 430, dmg: 7, kb: 'launch', lift: 440, push: 20,
        rehit: 0.1, box: [-2, 32, 18, 100], z: 14, cost: 15, spark: 'elec', sfx: 'zap',
        onActive(w, f) { f.vx = f.face * 40; w.emit({ t: 'trail', id: f.id, dur: 0.3 }); },
    },
    pulse: {
        anim: 'pulse', st: 0.12, ac: 0.06, rc: 0.22, cost: 15, sfx: 'pulse',
        proj: { type: 'pulse', dx: 26, dy: 50, vx: 330, dmg: 12, kb: 'heavy', push: 90, pierce: true, ttl: 1.4 },
    },
    overdrive: {
        anim: 'overdrive', st: 0.28, ac: 0.18, rc: 0.16, inv: true, dmg: 10, kb: 'knock', aoe: true, box: [0, 80, -4, 96], z: 34, push: 200, lift: 280, shake: 8, spark: 'elec',
        onStart(w, f) { w.emit({ t: 'sfx', id: 'odCharge', x: f.x }); w.emit({ t: 'freeze', dur: 0.35 }); },
        onActive(w, f) { w.startOverdrive(f); w.emit({ t: 'shock', x: f.x, z: f.z, r: 90, color: 'od' }); w.emit({ t: 'sfx', id: 'odBlast', x: f.x }); },
    },

    // ---- weapons (dmg/box filled per weapon at swing time) ----
    swingA: { anim: 'swingA', st: 0.07, ac: 0.07, rc: 0.16, kb: 'heavy', stun: 0.45, box: [4, 50, 30, 74], push: 50, next: 'swingB', weaponStep: 0 },
    swingB: { anim: 'swingB', st: 0.06, ac: 0.07, rc: 0.17, kb: 'heavy', stun: 0.45, box: [4, 50, 30, 74], push: 55, next: 'swingC', weaponStep: 1 },
    swingC: { anim: 'swingC', st: 0.11, ac: 0.08, rc: 0.3, kb: 'knock', box: [4, 54, 18, 80], push: 190, lift: 240, shake: 4, weaponStep: 2 },
    tossKnife: { anim: 'toss', st: 0.08, ac: 0.05, rc: 0.16, proj: { type: 'knife', dx: 20, dy: 54, vx: 380, dmg: 13, kb: 'heavy', push: 60, ttl: 1.2 }, sfx: 'swish' },
    tossWeapon: { anim: 'toss', st: 0.1, ac: 0.05, rc: 0.2, sfx: 'swishH',
        onActive(w, f) { w.throwWeapon(f); } },
};

/** Clone the swing for the held weapon so damage/reach/spark come from it. */
export function weaponSwing(weapon, name) {
    const base = PLAYER_MOVES[name];
    const W = WEAPONS[weapon.type];
    const mv = { ...base };
    mv.dmg = W.dmg[base.weaponStep];
    mv.box = [base.box[0], base.box[1] + W.reach - 14, base.box[2], base.box[3]];
    mv.spark = W.spark; mv.sfx = W.sfx; mv.whiff = W.whiff;
    if (W.fast) { mv.st *= 0.8; mv.rc *= 0.8; }
    if (W.stun) mv.stun = W.stun;
    mv.weaponHit = true;
    return mv;
}

/** Suit upgrades bought in the safehouse. */
export const UPGRADES = [
    { id: 'power', name: 'Servo Fists', max: 3, cost: [300, 650, 1100], desc: '+15% damage per level.' },
    { id: 'armor', name: 'Ablative Plating', max: 3, cost: [300, 650, 1100], desc: '-12% damage taken per level.' },
    { id: 'vital', name: 'Trauma Gel', max: 2, cost: [400, 900], desc: '+20 max health per level.' },
    { id: 'cap', name: 'Capacitor Bank', max: 3, cost: [250, 550, 950], desc: '+25 max energy and faster recharge.' },
    { id: 'od', name: 'Overdrive Core', max: 2, cost: [500, 1000], desc: 'Overdrive lasts 3 s longer and charges faster.' },
    { id: 'pulse', name: 'Pulse Emitter', max: 1, cost: [600], desc: 'Hold SPECIAL, then release: a piercing energy shot (15 energy).' },
    { id: 'rising', name: 'Rising Arc', max: 1, cost: [550], desc: 'SPECIAL during a combo: an invulnerable launcher (15 energy).' },
    { id: 'counter', name: 'Counter Burst', max: 1, cost: [700], desc: 'SPECIAL while being hit: escape with an Arc Burst (35 energy).' },
    { id: 'aircombo', name: 'Gyro Stabilizer', max: 1, cost: [450], desc: 'A second kick in the air after a flying kick or knee lands.' },
    { id: 'life', name: 'Spare Suit Core', max: 9, cost: [1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4400], desc: 'One extra life.', consumable: true },
];

export function applyProfile(p, prof) {
    const u = prof.upgrades || {};
    p.maxHp = PLAYER_DEF.hp + 20 * (u.vital || 0);
    p.hp = Math.min(p.hp, p.maxHp);
    p.dmgMul = 1 + 0.15 * (u.power || 0);
    p.armorMul = 1 - 0.12 * (u.armor || 0);
    p.maxEnergy = 100 + 25 * (u.cap || 0);
    p.energyRegen = 5 + 2.5 * (u.cap || 0);
    p.odDur = 8 + 3 * (u.od || 0);
    p.odGain = 1 + 0.3 * (u.od || 0);
    p.unlocks = { pulse: !!u.pulse, rising: !!u.rising, counter: !!u.counter, aircombo: !!u.aircombo };
}

export { GRAV };
