/**
 * bosses.js — the seven boss fights. Each boss is a def (stats + moves) and a
 * pick() that chooses the next attack from the distance, the phase and a
 * little memory. Bosses have poise: they shrug off hits until enough damage
 * lands, then flinch or fall, so they can't be juggled to death but always
 * reward a good combo. Below a threshold each enters phase 2 (new colours,
 * new attacks, sometimes reinforcements).
 */

import { isFree, setState, startMove, GRAV } from './fighter.js';
import { ENEMY_MOVES as M, walkTo, faceTo, stand, act } from './enemies.js';
import { PLAYER_MOVES as PM } from './moves.js';

const pDown = (p) => !p || p.state === 'down' || p.state === 'getup' || p.state === 'dead' || p.invuln > 0.3 || p.state === 'grabbed';

const waves = (w, b, n = 1, spd = 230) => {
    for (let k = 0; k < n; k++) for (const d of [-1, 1]) {
        w.spawnProj({ type: 'wave', team: 'enemy', x: b.x + d * (20 + k * 6), y: 0, z: b.z, vx: d * (spd - k * 40), dmg: 12, kb: 'knock', push: 140, lift: 220, ttl: 2.4, delay: k * 0.25, owner: b.id });
    }
};

// ---------------------------------------------------------------- moves
const BM = {
    // Jackhammer
    hammer: { anim: 'slam', st: 0.5, ac: 0.1, rc: 0.5, dmg: 16, box: [8, 76, 0, 120], kb: 'knock', push: 200, lift: 260, armor: true, shake: 6, warn: true, sfx: 'thud',
        onActive(w, b) { w.emit({ t: 'shock', x: b.x + b.face * 50, z: b.z, r: 34, color: 'dust' }); } },
    jhJab: { anim: 'punch', st: 0.26, ac: 0.08, rc: 0.34, dmg: 10, box: [8, 70, 50, 116], kb: 'heavy', push: 80, stun: 0.45, whiff: 'swishH' },
    pound: { anim: 'jump', air: true, landEnd: true, st: 0.4, ac: 1.5, rc: 0.02, armor: true, warn: true,
        onStart(w, b) { b.anim = 'windup'; },
        onActive(w, b) { const p = w.player; b.anim = 'jump'; b.vy = 560; b.vx = p ? Math.max(-180, Math.min(180, (p.x - b.x) / 0.95)) : 0; },
        onLand(w, b) {
            w.aoe(b, { x: b.x, z: b.z, r: 44, zr: 20, dmg: 14, kb: 'knock', push: 160, lift: 240, shake: 8 });
            waves(w, b, b.ai.p2 ? 2 : 1);
            w.emit({ t: 'shock', x: b.x, z: b.z, r: 60, color: 'dust' }); w.emit({ t: 'sfx', id: 'boom', x: b.x });
            startMove(w, b, 'poundRec');
        } },
    poundRec: { anim: 'land', st: 0.01, ac: 0.01, rc: 0.55 },
    rush: { ...M.charge, vx: [0, 330, 0], dmg: 18, box: [0, 44, 6, 110] },
    bossGrab: { ...M.grabE, box: [0, 46, 20, 110], st: 0.3 },
    bossThrow: { ...M.throwE, onActive(w, e) { w.throwGrabbed(e, 1, 20); } },

    // Viper
    vSlash: { ...M.slashE, st: 0.12, dmg: 9, box: [6, 52, 34, 74] },
    vSlash2: { ...M.slash2E, st: 0.08, dmg: 9, box: [6, 52, 34, 74] },
    vDash: { anim: 'lunge', st: 0.38, ac: 0.3, rc: 0.4, vx: [0, 520, 0], dmg: 13, box: [0, 46, 30, 70], kb: 'knock', push: 180, lift: 220, warn: true, spark: 'slash', whiff: 'swishH',
        onActive(w, b) { w.emit({ t: 'trail', id: b.id, dur: 0.32 }); } },
    vFan: { anim: 'toss', st: 0.3, ac: 0.05, rc: 0.35, warn: true, sfx: 'swish',
        onActive(w, b) { for (const vz of [-70, 0, 70]) w.spawnProj({ type: 'knife', team: 'enemy', x: b.x + b.face * 18, y: 54, z: b.z, vx: b.face * 300, vz, dmg: 8, kb: 'heavy', push: 50, ttl: 1.6, owner: b.id }); } },
    vFlip: { ...M.flipE, ac: 0.42 },
    vMirage: { anim: 'taunt', st: 0.5, ac: 0.1, rc: 0.3, inv: true,
        onActive(w, b) { w.emit({ t: 'banner', text: 'VENOM MIRAGE', kind: 'boss' }); for (const s of [-1, 1]) w.spawnGhost(b, 'viper', s); } },

    // Oni
    oSlash: { ...M.slashE, st: 0.3, dmg: 13, box: [10, 86, 26, 96], push: 70, kb: 'heavy', stun: 0.5, warn: true },
    oSlash2: { ...M.slash2E, st: 0.16, dmg: 12, box: [10, 86, 26, 96], push: 160, lift: 200, kb: 'knock' },
    oStance: { anim: 'stance', st: 0.12, ac: 1.5, rc: 0.25,
        onStart(w, b) { w.emit({ t: 'glint', id: b.id }); w.emit({ t: 'sfx', id: 'sheath', x: b.x }); },
        counter(w, b, a) { b.face = a.x >= b.x ? 1 : -1; startMove(w, b, 'oCounter'); w.emit({ t: 'banner', text: 'COUNTER!', kind: 'small' }); } },
    oCounter: { anim: 'slash2', st: 0.04, ac: 0.1, rc: 0.4, inv: true, dmg: 18, box: [0, 90, 10, 100], kb: 'knock', push: 220, lift: 260, spark: 'slash', shake: 6, sfx: 'slashHit',
        onStart(w, b) { w.emit({ t: 'flashScreen', color: 'white' }); } },
    oWave: { anim: 'swingC', st: 0.42, ac: 0.08, rc: 0.4, warn: true, sfx: 'swishH',
        onActive(w, b) { w.spawnProj({ type: 'swordwave', team: 'enemy', x: b.x + b.face * 30, y: 0, z: b.z, vx: b.face * 270, dmg: 13, kb: 'knock', push: 150, lift: 220, ttl: 2.2, h: 42, owner: b.id }); } },
    oBlink: { anim: 'stance', st: 0.35, ac: 0.05, rc: 0.05, inv: true,
        onStart(w, b) { b.intangible = true; w.emit({ t: 'vanish', id: b.id }); w.emit({ t: 'sfx', id: 'blink', x: b.x }); },
        onActive(w, b) {
            const p = w.player; b.intangible = false;
            if (p) { b.x = Math.max(w.camL + 20, Math.min(w.camR - 20, p.x - p.face * 50)); b.z = p.z; b.face = p.x >= b.x ? 1 : -1; }
            w.emit({ t: 'appear', id: b.id });
        },
        onEnd(w, b) { b.intangible = false; startMove(w, b, 'oSlash2'); } },
    oCuts: { anim: 'stance', st: 0.6, ac: 1.6, rc: 0.5, inv: true,
        onStart(w, b) { w.emit({ t: 'banner', text: 'THOUSAND CUTS', kind: 'boss' }); w.emit({ t: 'flashScreen', color: 'red' }); },
        onTick(w, b, dt, ph) {
            if (ph !== 'ac') return;
            b.ai.cutT = (b.ai.cutT || 0) - dt;
            if (b.ai.cutT <= 0 && w.player) { b.ai.cutT = 0.27; w.addHazard({ type: 'slashmark', x: w.player.x + w.rng.range(-14, 14), z: w.player.z, delay: 0.55, r: 22, dmg: 11 }); }
        } },

    // Bulwark
    bSmash: { ...M.slamE, st: 0.55, dmg: 17, box: [10, 80, 0, 130], push: 210, lift: 260, shake: 7, onActive(w, b) { w.emit({ t: 'shock', x: b.x + b.face * 54, z: b.z, r: 40, color: 'dust' }); } },
    bMissiles: { anim: 'shoot', st: 0.5, ac: 0.6, rc: 0.5, warn: true, sfx: 'launch',
        onActive(w, b) {
            const p = w.player; if (!p) return;
            const n = b.ai.p2 ? 7 : 5;
            for (let k = 0; k < n; k++) {
                const x = p.x + (k === 0 ? 0 : w.rng.range(-90, 90)), z = k === 0 ? p.z : w.rng.range(w.zMin, w.zMax);
                w.addHazard({ type: 'reticle', x, z, delay: 1.1 + k * 0.18, r: 26, dmg: 14 });
            }
            w.emit({ t: 'missiles', id: b.id, n });
        } },
    bFlame: { anim: 'punch', st: 0.45, ac: 1.25, rc: 0.4, warn: true,
        onActive(w, b) { w.emit({ t: 'sfx', id: 'flame', x: b.x }); },
        onTick(w, b, dt, ph) {
            if (ph !== 'ac') return;
            b.ai.ft = (b.ai.ft || 0) - dt;
            if (b.ai.ft <= 0) { b.ai.ft = 0.05; w.spawnProj({ type: 'flame', team: 'enemy', x: b.x + b.face * 50, y: 64 + w.rng.range(-6, 6), z: b.z + w.rng.range(-6, 6), vx: b.face * w.rng.range(220, 280), vy: w.rng.range(-20, 20), dmg: 4, kb: 'light', push: 30, stun: 0.22, ttl: 0.45, pierce: true, owner: b.id }); }
        },
        onEnd(w, b) { if (b.ai.p2) { setState(b, 'stunned', 'dizzy'); b.stun = 2.2; b.vulnerable = true; w.emit({ t: 'steam', id: b.id }); w.emit({ t: 'banner', text: 'OVERHEATED!', kind: 'small' }); } } },
    bCharge: { ...M.charge, vx: [0, 280, 0], dmg: 18, box: [0, 54, 6, 120], st: 0.7 },

    // Goliath
    gSwipe: { anim: 'slam', st: 0.5, ac: 0.12, rc: 0.55, dmg: 17, box: [10, 96, 0, 130], kb: 'knock', push: 200, lift: 260, armor: true, warn: true, shake: 6, sfx: 'thud' },
    gPunch: { anim: 'punch', st: 0.34, ac: 0.1, rc: 0.4, dmg: 12, box: [10, 90, 50, 130], kb: 'heavy', push: 100, stun: 0.5, whiff: 'swishH' },
    gSpit: { anim: 'spit', st: 0.45, ac: 0.08, rc: 0.45, warn: true, sfx: 'spit',
        onActive(w, b) { for (const k of [-1, 0, 1]) w.spawnProj({ type: 'acid', team: 'enemy', x: b.x + b.face * 30, y: 110, z: b.z + k * 18, vx: b.face * (150 + k * 30), vy: 200, grav: true, dmg: 9, kb: 'heavy', push: 40, ttl: 3, owner: b.id }); } },
    gLeap: { anim: 'jump', st: 0.4, ac: 2.0, rc: 0.6, inv: true,
        onStart(w, b) { b.anim = 'windup'; },
        onActive(w, b) { b.anim = 'jump'; b.ai.leapT = 0; b.intangible = true; w.emit({ t: 'sfx', id: 'whoosh', x: b.x }); },
        onTick(w, b, dt, ph) {
            if (ph === 'st') return;
            if (ph === 'ac') {
                b.ai.leapT += dt;
                const p = w.player;
                if (b.ai.leapT < 0.4) { b.y += 900 * dt; }
                else if (b.ai.leapT < 1.4) {
                    if (!b.ai.shadow && p) b.ai.shadow = w.addHazard({ type: 'shadow', x: p.x, z: p.z, delay: 99, r: 40 });
                    if (p && b.ai.shadow) { const s = b.ai.shadow; s.x += (p.x - s.x) * Math.min(1, dt * 3); s.z += (p.z - s.z) * Math.min(1, dt * 3); }
                    b.y = 400;
                } else {
                    const s = b.ai.shadow;
                    if (s) { b.x = s.x; b.z = s.z; }
                    b.y -= 1100 * dt;
                    if (b.y <= 0) {
                        b.y = 0; b.intangible = false;
                        if (s) { s.done = true; b.ai.shadow = null; }
                        w.aoe(b, { x: b.x, z: b.z, r: 52, zr: 24, dmg: 22, kb: 'knock', push: 200, lift: 300, shake: 10 });
                        waves(w, b, 1, 200);
                        w.emit({ t: 'shock', x: b.x, z: b.z, r: 72, color: 'dust' }); w.emit({ t: 'sfx', id: 'boom', x: b.x });
                        b.mt = b.move.st + b.move.ac; b.anim = 'land';
                    }
                }
                b.vx = 0; b.vy = 0;
            }
        },
        noGrav: true },

    // Mika (mirrors Juno)
    mJab: { ...PM.jab, st: 0.08, dmg: 6 }, mCross: { ...PM.cross, st: 0.08, dmg: 7 }, mHook: { ...PM.hook, st: 0.09, dmg: 8 }, mKick: { ...PM.kick, st: 0.12, dmg: 12 },
    mRail: { ...PM.rail, st: 0.3, warn: true, onEnd(w, b) { startMove(w, b, 'mRailEnd'); } }, mRailEnd: { ...PM.railEnd },
    mArc: { ...PM.arc, st: 0.32, warn: true, dmg: 12, cost: 0 },
    mPulse: { ...PM.pulse, st: 0.32, warn: true, proj: { ...PM.pulse.proj, vx: 300, dmg: 10, type: 'pulseR' } },
    mMeteor: { anim: 'jump', st: 0.3, ac: 1.3, rc: 0.02, air: true, landEnd: true, warn: true,
        onActive(w, b) { const p = w.player; b.vy = 470; b.vx = p ? Math.max(-200, Math.min(200, (p.x - b.x) / 0.8)) : 0; b.ai.diving = false; },
        onTick(w, b, dt, ph) { if (ph === 'ac' && !b.ai.diving && b.vy < 0) { b.ai.diving = true; b.anim = 'meteor'; b.vy = -620; b.vx = b.face * 40; } },
        onLand(w, b) {
            w.aoe(b, { x: b.x, z: b.z, r: 58, zr: 24, dmg: 15, kb: 'knock', push: 180, lift: 280, shake: 6 });
            w.emit({ t: 'shock', x: b.x, z: b.z, r: 58, color: 'red' }); w.emit({ t: 'sfx', id: 'boom', x: b.x });
            startMove(w, b, 'meteorRec');
        } },
    meteorRec: { anim: 'land', st: 0.01, ac: 0.01, rc: 0.45 },
    mSummon: { anim: 'overdrive', st: 0.4, ac: 0.1, rc: 0.3, inv: true,
        onActive(w, b) { w.emit({ t: 'banner', text: 'OVERRIDE SURGE', kind: 'boss' }); w.spawnEnemy('drone', 'L', { pal: 'base' }); w.spawnEnemy('drone', 'R', { pal: 'base' }); } },

    // Magnus, phase 1
    hThrust: { anim: 'lunge', st: 0.34, ac: 0.18, rc: 0.4, vx: [0, 300, 0], dmg: 13, box: [6, 74, 40, 74], kb: 'knock', push: 170, lift: 200, warn: true, spark: 'slash', whiff: 'swishH' },
    hSlash: { ...M.slashE, st: 0.2, dmg: 10, box: [6, 66, 34, 80] },
    hSlash2: { ...M.slash2E, st: 0.12, dmg: 10, box: [6, 66, 34, 80] },
    hWave: { anim: 'swingC', st: 0.4, ac: 0.08, rc: 0.4, warn: true,
        onActive(w, b) { w.spawnProj({ type: 'swordwave', team: 'enemy', x: b.x + b.face * 26, y: 0, z: b.z, vx: b.face * 250, dmg: 12, kb: 'knock', push: 150, lift: 200, ttl: 2.2, h: 40, gold: true, owner: b.id }); } },
    hStance: { ...BM_stance() },
    hBoard: { anim: 'stand', st: 0.5, ac: 0.1, rc: 0.4, inv: true,
        onActive(w, b) { w.emit({ t: 'banner', text: '"SECURITY."', kind: 'boss' }); w.spawnEnemy('synth', 'L', { pal: 'elite' }); w.spawnEnemy('synth', 'R', { pal: 'elite' }); } },

    // Magnus, ASCENDANT
    aSlash: { anim: 'slash', st: 0.3, ac: 0.1, rc: 0.4, dmg: 15, box: [10, 100, 10, 140], kb: 'knock', push: 190, lift: 220, warn: true, spark: 'slash', sfx: 'slashHit', whiff: 'swishH', z: 16 },
    aBeam: { anim: 'beam', st: 0.3, ac: 1.0, rc: 0.4,
        onActive(w, b) {
            const p = w.player; if (!p) return;
            const n = b.ai.p2 ? 2 : 1;
            for (let k = 0; k < n; k++) {
                const z = k === 0 ? p.z : (p.z > (w.zMin + w.zMax) / 2 ? w.zMin + 10 : w.zMax - 10);
                w.addHazard({ type: 'beam', z, delay: 0.9, dur: 0.7, dmg: 18, zr: 9 });
            }
            w.emit({ t: 'sfx', id: 'charge', x: b.x });
        } },
    aDive: { anim: 'fly', st: 0.3, ac: 1.6, rc: 0.5, inv: true, noGrav: true,
        onActive(w, b) { b.ai.diveT = 0; b.intangible = true; },
        onTick(w, b, dt, ph) {
            if (ph !== 'ac') return;
            b.ai.diveT += dt; const p = w.player;
            if (b.ai.diveT < 0.35) b.y += 700 * dt;
            else if (b.ai.diveT < 1.1) {
                if (!b.ai.shadow && p) b.ai.shadow = w.addHazard({ type: 'shadow', x: p.x, z: p.z, delay: 99, r: 44, gold: true });
                if (p && b.ai.shadow) { const s = b.ai.shadow; s.x += (p.x - s.x) * Math.min(1, dt * 3.5); s.z += (p.z - s.z) * Math.min(1, dt * 3.5); }
                b.y = 320; b.anim = 'stomp';
            } else {
                const s = b.ai.shadow; if (s) { b.x = s.x; b.z = s.z; }
                b.y -= 1200 * dt;
                if (b.y <= 0) {
                    b.y = 0; b.intangible = false; if (s) { s.done = true; b.ai.shadow = null; }
                    w.aoe(b, { x: b.x, z: b.z, r: 56, zr: 26, dmg: 20, kb: 'knock', push: 210, lift: 300, shake: 10 });
                    waves(w, b, b.ai.p2 ? 2 : 1, 240);
                    w.emit({ t: 'shock', x: b.x, z: b.z, r: 80, color: 'gold' }); w.emit({ t: 'sfx', id: 'boom', x: b.x });
                    b.mt = b.move.st + b.move.ac; b.anim = 'land';
                }
            }
            b.vx = 0; b.vy = 0;
        } },
    aOrbs: { anim: 'beam', st: 0.35, ac: 0.1, rc: 0.4, warn: true, sfx: 'pulse',
        onActive(w, b) { for (let k = 0; k < (b.ai.p2 ? 5 : 3); k++) w.spawnProj({ type: 'orb', team: 'enemy', x: b.x + b.face * 20, y: b.y + 70, z: b.z, vx: b.face * (90 + k * 30), vy: 60 - k * 40, vz: (k - 1) * 40, dmg: 10, kb: 'heavy', push: 70, ttl: 4, homing: 1.3, owner: b.id }); } },
    aSummon: { anim: 'beam', st: 0.4, ac: 0.1, rc: 0.3, inv: true,
        onActive(w, b) { w.emit({ t: 'banner', text: '"KNEEL."', kind: 'boss' }); w.spawnEnemy('drone', 'L', { pal: 'base' }); w.spawnEnemy('drone', 'R', { pal: 'b' }); w.spawnEnemy('synth', 'R', { pal: 'gold' }); } },
};
function BM_stance() {
    return { anim: 'stance', st: 0.12, ac: 1.1, rc: 0.25,
        onStart(w, b) { w.emit({ t: 'glint', id: b.id }); },
        counter(w, b, a) { b.face = a.x >= b.x ? 1 : -1; startMove(w, b, 'hCounter'); w.emit({ t: 'banner', text: 'COUNTER!', kind: 'small' }); } };
}
BM.hStance = BM_stance();
BM.hCounter = { ...BM.oCounter, dmg: 16, box: [0, 78, 20, 90] };

// ---------------------------------------------------------------- defs
const base = { w: 16, weight: 2.4, boss: true, noGrab: true, downTime: 1.0, stunMul: 0.6 };
export const BOSSES = {
    jackhammer: { ...base, name: 'JACKHAMMER MALONE', title: 'King of the Rustbelt', sprite: 'jackhammer', hp: 420, poise: 32, speed: 58, zspeed: 40, w: 20, h: 116, range: 60, p2At: 0.5, p2pal: 'rage',
        moves: { hammer: BM.hammer, jab: BM.jhJab, pound: BM.pound, poundRec: BM.poundRec, rush: BM.rush, grab: BM.bossGrab, throwF: BM.bossThrow },
        onPhase2(w, b) { w.spawnEnemy('punk', 'L', {}); w.spawnEnemy('punk', 'R', {}); },
        pick(w, b, p, adx, dz) {
            const ai = b.ai;
            if (adx < 64 && dz < 10) return w.rng.pick(ai.p2 ? ['hammer', 'jab', 'grab', 'jab', 'hammer'] : ['hammer', 'jab', 'jab', 'grab']);
            if (adx > 110 && dz < 8 && w.rng() < 0.5) return 'rush';
            if (w.rng() < (ai.p2 ? 0.5 : 0.3)) return 'pound';
            return null;
        } },
    viper: { ...base, name: 'VIPER', title: 'Aurex Retrieval Division', sprite: 'viper', hp: 400, poise: 18, speed: 120, zspeed: 80, w: 11, h: 76, range: 44, p2At: 0.5, weight: 1.4,
        moves: { slash: BM.vSlash, slash2: BM.vSlash2, dash: BM.vDash, fan: BM.vFan, flip: BM.vFlip, mirage: BM.vMirage },
        combos: [['slash', 'slash2'], ['slash', 'slash2', 'slash']],
        evade: 0.45,
        onPhase2(w, b) { b.ai.mirageT = 0; },
        pick(w, b, p, adx, dz) {
            const ai = b.ai;
            if (ai.p2 && ai.mirageT <= 0) { ai.mirageT = 14; return 'mirage'; }
            if (adx < 50 && dz < 8) return 'combo';
            if (adx > 90 && dz < 8 && w.rng() < 0.5) return 'dash';
            if (adx > 110 && w.rng() < 0.35) return 'fan';
            return null;
        } },
    oni: { ...base, name: 'KURODA, THE ONI', title: 'Neural Subject Zero', sprite: 'oni', hp: 480, poise: 34, speed: 72, zspeed: 50, w: 13, h: 92, range: 78, p2At: 0.4, p2pal: 'rage', weight: 1.8,
        moves: { slash: BM.oSlash, slash2: BM.oSlash2, oSlash2: BM.oSlash2, stance: BM.oStance, oCounter: BM.oCounter, wave: BM.oWave, blink: BM.oBlink, cuts: BM.oCuts },
        combos: [['slash', 'slash2'], ['slash']],
        pick(w, b, p, adx, dz) {
            const ai = b.ai;
            if (ai.p2 && ai.cutsT <= 0) { ai.cutsT = 13; return 'cuts'; }
            if (adx < 84 && dz < 10) return w.rng() < 0.3 ? 'stance' : 'combo';
            const r = w.rng();
            if (r < 0.3 && dz < 8) return 'wave';
            if (r < 0.5) return 'blink';
            if (r < 0.65) return 'stance';
            return null;
        } },
    bulwark: { ...base, name: 'BULWARK', title: 'Cmdr. Rourke, Aurex Security', sprite: 'bulwark', hp: 600, poise: 46, speed: 44, zspeed: 30, w: 24, h: 130, range: 74, p2At: 0.5, p2pal: 'hot', weight: 3,
        moves: { smash: BM.bSmash, missiles: BM.bMissiles, flame: BM.bFlame, charge: BM.bCharge },
        onPhase2(w, b) { w.spawnEnemy('guard', 'L', {}); w.spawnEnemy('gunner', 'R', {}); },
        pick(w, b, p, adx, dz) {
            if (adx < 80 && dz < 12) return w.rng() < 0.6 ? 'smash' : 'flame';
            if (adx < 140 && dz < 10 && w.rng() < 0.4) return 'flame';
            if (adx > 120 && dz < 8 && w.rng() < 0.3) return 'charge';
            if (w.rng() < 0.45) return 'missiles';
            return null;
        } },
    goliath: { ...base, name: 'SPECIMEN G-7', title: '"Goliath" — VANTA Candidate #7', sprite: 'goliath', hp: 640, poise: 42, speed: 52, zspeed: 34, w: 24, h: 140, range: 92, p2At: 0.5, p2pal: 'rage', weight: 3,
        moves: { swipe: BM.gSwipe, punch: BM.gPunch, spit: BM.gSpit, leap: BM.gLeap, grab: { ...BM.bossGrab, box: [0, 60, 20, 130] }, throwF: { ...BM.bossThrow, onActive(w, e) { w.throwGrabbed(e, 1, 22); } } },
        onPhase2(w, b) { w.spawnEnemy('husk', 'L', {}); w.spawnEnemy('husk', 'R', { pal: 'b' }); },
        pick(w, b, p, adx, dz) {
            if (adx < 96 && dz < 12) return w.rng.pick(['swipe', 'punch', 'grab', 'swipe']);
            const r = w.rng();
            if (r < 0.35) return 'spit';
            if (r < 0.6) return 'leap';
            return null;
        } },
    mika: { ...base, name: 'MIKA VEGA', title: 'VANTA-8 — Neural Control Active', barLabel: 'NEURAL CONTROL', sprite: 'mika', hp: 520, poise: 24, speed: 118, zspeed: 78, w: 10, h: 70, range: 36, p2At: 0.5, weight: 1.2,
        moves: { jab: BM.mJab, cross: BM.mCross, hook: BM.mHook, kick: BM.mKick, rail: BM.mRail, mRailEnd: BM.mRailEnd, arc: BM.mArc, pulse: BM.mPulse, meteor: BM.mMeteor, meteorRec: BM.meteorRec, summon: BM.mSummon },
        combos: [['jab', 'cross', 'hook', 'kick'], ['jab', 'cross'], ['kick']],
        onPhase2(w, b) { b.ai.summonReady = true; },
        pick(w, b, p, adx, dz) {
            const ai = b.ai;
            if (ai.summonReady) { ai.summonReady = false; return 'summon'; }
            if ((ai.recentHits || 0) >= 4 && adx < 60) { ai.recentHits = 0; return 'arc'; }
            if (adx < 40 && dz < 8) return 'combo';
            const r = w.rng();
            if (adx > 80 && dz < 8 && r < 0.35) return 'rail';
            if (adx > 100 && dz < 6 && r < 0.6) return 'pulse';
            if (r < 0.25) return 'meteor';
            return null;
        } },
    magnus: { ...base, name: 'MAGNUS HALE', title: 'Chief Executive, Aurex Dynamics', sprite: 'magnus', hp: 420, poise: 30, speed: 84, zspeed: 56, w: 11, h: 80, range: 66, p2At: 0.6,
        moves: { thrust: BM.hThrust, slash: BM.hSlash, slash2: BM.hSlash2, wave: BM.hWave, stance: BM.hStance, hCounter: BM.hCounter, board: BM.hBoard },
        combos: [['slash', 'slash2'], ['slash', 'slash2', 'thrust']],
        onPhase2(w, b) { b.ai.boardReady = true; },
        pick(w, b, p, adx, dz) {
            const ai = b.ai;
            if (ai.boardReady) { ai.boardReady = false; return 'board'; }
            if (adx < 70 && dz < 10) return w.rng() < 0.25 ? 'stance' : 'combo';
            const r = w.rng();
            if (adx > 80 && dz < 8 && r < 0.4) return 'thrust';
            if (dz < 8 && r < 0.7) return 'wave';
            return null;
        } },
    magnus2: { ...base, name: 'MAGNUS HALE — ASCENDANT', title: 'The Board Has Voted', sprite: 'magnus2', hp: 640, poise: 46, speed: 76, zspeed: 52, w: 20, h: 150, range: 96, p2At: 0.5, p2pal: 'rage', weight: 3, flying: true, alt: 34,
        moves: { slash: BM.aSlash, beam: BM.aBeam, dive: BM.aDive, orbs: BM.aOrbs, summon: BM.aSummon },
        idleAnim: 'fly',
        onPhase2(w, b) { b.ai.summonReady = true; },
        pick(w, b, p, adx, dz) {
            const ai = b.ai;
            if (ai.summonReady) { ai.summonReady = false; return 'summon'; }
            if (adx < 100 && dz < 14 && w.rng() < 0.55) return 'slash';
            const r = w.rng();
            if (r < 0.3) return 'beam';
            if (r < 0.55) return 'dive';
            if (r < 0.8) return 'orbs';
            return null;
        } },
};

// ---------------------------------------------------------------- think
export function thinkBoss(w, b, dt) {
    const ai = b.ai, def = b.def;
    ai.cd = (ai.cd ?? 1.2) - dt; ai.ecd = (ai.ecd ?? 0) - dt;
    ai.cutsT = (ai.cutsT ?? 4) - dt; ai.mirageT = (ai.mirageT ?? 0) - dt;
    if (!ai.p2 && b.hp < b.maxHp * def.p2At && b.hp > 0) {
        ai.p2 = true;
        if (def.p2pal) b.pal = def.p2pal;
        w.emit({ t: 'bossPhase', id: b.id });
        if (def.onPhase2) def.onPhase2(w, b);
    }
    if (def.flying && b.state !== 'attack' && b.state !== 'fall' && b.state !== 'down' && b.state !== 'getup' && b.state !== 'dead') {
        b.y += (def.alt + Math.sin(w.t * 2) * 6 - b.y) * Math.min(1, dt * 3);
    }
    // combo continuation
    if (ai.wasAttacking && b.state !== 'attack') {
        ai.wasAttacking = false;
        if (isFree(b) && ai.combo && ai.combo.length && b.lastHit) { b.lastHit = false; act(w, b, ai.combo.shift()); ai.wasAttacking = true; return; }
        ai.combo = [];
        ai.cd = w.rng.range(0.35, 0.9) / w.diff.aggr * (ai.p2 ? 0.75 : 1);
    }
    if (b.state === 'attack') { ai.wasAttacking = true; return; }
    if (b.state === 'grabbing') { if (b.st > 0.5) act(w, b, 'throwF'); return; }
    if (!isFree(b)) return;
    const p = w.player;
    if (!p) { stand(b); return; }
    const dx = p.x - b.x, adx = Math.abs(dx), dz = Math.abs(p.z - b.z);

    // evasive bosses read your startup
    if (def.evade && p.state === 'attack' && p.phase === 'st' && adx < 60 && dz < 10 && ai.ecd <= 0 && w.rng() < def.evade) {
        ai.ecd = 1.6; faceTo(b, p); act(w, b, 'flip'); return;
    }
    if (pDown(p)) {
        const tx = p.x + (b.x < p.x ? -1 : 1) * (def.range + 50);
        walkTo(w, b, Math.max(w.camL + 30, Math.min(w.camR - 30, tx)), p.z, 0.7); faceTo(b, p);
        if (def.flying) b.state = 'idle', b.anim = def.idleAnim;
        return;
    }
    if (ai.cd <= 0) {
        const choice = def.pick(w, b, p, adx, dz);
        if (choice === 'combo') {
            const c = w.rng.pick(def.combos);
            faceTo(b, p); ai.combo = c.slice(1); act(w, b, c[0]); return;
        }
        if (choice) { faceTo(b, p); ai.combo = []; act(w, b, choice); return; }
    }
    // reposition: get to range on the player's depth
    const want = ai.cd > 0.4 ? def.range + 30 : def.range * 0.8;
    const tx = p.x - Math.sign(dx || 1) * want;
    walkTo(w, b, Math.max(w.camL + 24, Math.min(w.camR - 24, tx)), p.z, ai.p2 ? 1.15 : 1);
    faceTo(b, p);
    if (def.flying) { b.anim = def.idleAnim; }
}

export { GRAV, setState, startMove };
