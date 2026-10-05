/**
 * player.js — turns one frame of input into Juno's actions.
 *
 * Input (from js/input.js or the bot):
 *   { x, z: -1..1 (z+ is into the screen), atk, jump, spec, ovr: edge flags,
 *     run: bool, specHeld: bool }
 * Presses are buffered for 0.2 s so a button tapped a frame early during a
 * recovery still comes out — essential on touch screens.
 */

import { isFree, setState, startMove, GRAV } from './fighter.js';
import { PLAYER_MOVES, PLAYER_DEF, WEAPONS, weaponSwing } from './moves.js';

const BUF = 0.2;
const JUMP_V = 390;

export function initPlayer(p) {
    p.moves = { ...PLAYER_MOVES };
    p.buf = { atk: 0, jump: 0, spec: 0, ovr: 0 };
    p.energy = p.maxEnergy || 100;
    p.meter = 0; p.od = 0; p.weapon = null;
    p.specCharge = 0; p.airCount = 0;
}

function trySpend(w, p, cost) {
    if (p.od > 0) return true;
    if (p.energy >= cost) { p.energy -= cost; return true; }
    return false;
}

function doSpecial(w, p, inp, ctx) {
    if (p.weapon && ctx !== 'air') {           // SPECIAL with a weapon = throw it
        startMove(w, p, p.weapon.type === 'knives' ? 'tossKnife' : 'tossWeapon');
        if (p.weapon && p.weapon.type === 'knives') { p.weapon.uses--; if (p.weapon.uses <= 0) p.weapon = null; }
        return true;
    }
    if (ctx === 'air') {
        if (!trySpend(w, p, 20)) return lowEnergy(w, p);
        w.stats.specials++; return startMove(w, p, 'meteor');
    }
    if (ctx === 'combo' && p.unlocks.rising) {
        if (!trySpend(w, p, 15)) return lowEnergy(w, p);
        w.stats.specials++; return startMove(w, p, 'rising');
    }
    if (Math.abs(inp.x) > 0.5) {
        p.face = Math.sign(inp.x);
        if (!trySpend(w, p, 25)) return lowEnergy(w, p);
        w.stats.specials++; return startMove(w, p, 'rail');
    }
    // Arc Burst: costs health when the battery is flat, but never kills
    if (!trySpend(w, p, 20)) {
        if (p.hp <= 9) return lowEnergy(w, p);
        p.hp -= 8; w.emit({ t: 'hpcost', amount: 8 });
    }
    w.stats.specials++;
    return startMove(w, p, 'arc');
}

function lowEnergy(w, p) { w.emit({ t: 'lowEnergy' }); w.emit({ t: 'sfx', id: 'denied' }); return false; }

function startAttack(w, p, inp) {
    if (p.weapon) {
        if (p.weapon.type === 'knives') { startMove(w, p, 'tossKnife'); p.weapon.uses--; if (p.weapon.uses <= 0) p.weapon = null; return; }
        p.moves.swingA = weaponSwing(p.weapon, 'swingA');
        startMove(w, p, 'swingA');
        return;
    }
    if (p.state === 'run' || (p.runT || 0) > 0.12) { startMove(w, p, 'dashknee'); return; }
    if (inp.x && Math.sign(inp.x) === -p.face) { startMove(w, p, 'backfist'); return; }
    startMove(w, p, 'jab');
}

export function controlPlayer(w, p, inp, dt) {
    const b = p.buf;
    for (const k of ['atk', 'jump', 'spec', 'ovr']) { if (inp[k]) b[k] = BUF; else if (b[k] > 0) b[k] -= dt; }
    // energy & overdrive clocks
    const regen = p.energyRegen * (p.od > 0 ? 3 : 1);
    p.energy = Math.min(p.maxEnergy, p.energy + regen * dt);
    if (p.od > 0) { p.od -= dt; if (p.od <= 0) { p.od = 0; p.pal = 'base'; w.emit({ t: 'odEnd' }); } }

    // Pulse shot: hold SPECIAL ~0.35 s and release
    if (p.unlocks.pulse) {
        if (inp.specHeld && (isFree(p) || p.state === 'jump')) p.specCharge += dt;
        else {
            if (p.specCharge > 0.35 && isFree(p) && !p.weapon) {
                if (trySpend(w, p, 15)) { startMove(w, p, 'pulse'); w.stats.specials++; b.spec = 0; }
                else lowEnergy(w, p);
                p.specCharge = 0; return;
            }
            p.specCharge = 0;
        }
    }

    if (p.hitstop > 0) return;

    if (b.ovr > 0 && p.meter >= 100 && p.od <= 0 && (isFree(p) || p.state === 'hurt' || p.state === 'jump')) {
        b.ovr = 0; p.meter = 0;
        if (p.state === 'jump') { p.vy = 0; p.y = 0; }
        startMove(w, p, 'overdrive');
        return;
    }

    switch (p.state) {
        case 'idle': case 'walk': case 'run': case 'land': {
            const spd = p.speed * (p.od > 0 ? 1.15 : 1);
            const running = inp.run && Math.abs(inp.x) > 0.3;
            p.runT = running ? (p.runT || 0) + dt : 0;
            p.vx = inp.x * spd * (running ? 1.85 : 1);
            p.vz = inp.z * p.zspeed * (running ? 0.7 : 1);
            if (Math.abs(inp.x) > 0.15) p.face = Math.sign(inp.x);
            if (p.state !== 'land') {
                const moving = Math.abs(inp.x) > 0.1 || Math.abs(inp.z) > 0.1;
                const ns = running ? 'run' : moving ? 'walk' : 'idle';
                if (ns !== p.state) { p.state = ns; p.st = 0; p.anim = ns; p.animT = 0; }
            }
            if (b.spec > 0 && !(p.unlocks.pulse && inp.specHeld)) { b.spec = 0; doSpecial(w, p, inp, 'ground'); return; }
            if (b.jump > 0) {
                b.jump = 0;
                setState(p, 'jump', 'jump');
                p.vy = JUMP_V; p.vx = inp.x * p.speed * (running ? 1.5 : 1.05); p.vz = inp.z * p.zspeed * 0.6;
                p.airCount = 0;
                w.emit({ t: 'sfx', id: 'jump', x: p.x });
                return;
            }
            if (b.atk > 0) {
                b.atk = 0;
                if (!p.weapon && w.tryPickupWeapon(p)) return;
                startAttack(w, p, inp);
                return;
            }
            if (Math.abs(inp.x) > 0.3 && !p.weapon) w.tryGrab(p, Math.sign(inp.x));
            break;
        }
        case 'jump':
            if (b.atk > 0 && p.airCount === 0) {
                b.atk = 0; p.airCount = 1;
                if (inp.z < -0.5) startMove(w, p, 'stomp');
                else startMove(w, p, Math.abs(p.vx) > 20 ? 'jumpkick' : 'jumpknee');
                return;
            }
            if (b.spec > 0) { b.spec = 0; doSpecial(w, p, inp, 'air'); return; }
            break;
        case 'attack': {
            const mv = p.move;
            // air combo follow-up
            if ((p.moveName === 'jumpkick' || p.moveName === 'jumpknee') && p.hitLanded && p.unlocks.aircombo && b.atk > 0 && p.airCount === 1) {
                b.atk = 0; p.airCount = 2; startMove(w, p, 'airkick2'); return;
            }
            if (mv.grabMove || mv.air) break;
            // cancels after a connecting hit
            if (p.hitLanded && (p.phase === 'ac' || p.phase === 'rc')) {
                if (b.spec > 0 && (mv.chain || mv.weaponHit)) { b.spec = 0; if (doSpecial(w, p, inp, 'combo')) return; }
                if (b.jump > 0 && mv.chain && mv.chain <= 3) { b.jump = 0; startMove(w, p, 'upper'); return; }
            }
            if (b.atk > 0 && mv.next && (p.phase === 'rc' || (p.phase === 'ac' && p.phaseT > 0.5))) {
                b.atk = 0;
                if (p.weapon && mv.weaponHit) {
                    if (p.weapon) { p.moves[mv.next] = weaponSwing(p.weapon, mv.next); startMove(w, p, mv.next); }
                } else if (!p.weapon && mv.chain) {
                    if (Math.sign(inp.x) === -p.face && mv.chain <= 2) startMove(w, p, 'backfist');
                    else startMove(w, p, mv.next);
                }
                return;
            }
            break;
        }
        case 'hurt':
            if (b.spec > 0 && p.unlocks.counter && p.energy >= 35) {
                b.spec = 0; p.energy -= 35; w.stats.specials++;
                startMove(w, p, 'arc'); w.emit({ t: 'banner', text: 'COUNTER BURST', kind: 'small' });
            }
            break;
        case 'grabbing': {
            const tgt = p.grab;
            if (!tgt) break;
            if (b.jump > 0) {                    // vault over to the other side
                b.jump = 0;
                p.x = tgt.x + p.face * 22; p.face = -p.face; tgt.face = -p.face;
                p.grabT = Math.max(p.grabT, 0.8);
                w.emit({ t: 'sfx', id: 'jump', x: p.x });
                break;
            }
            if (b.atk > 0) {
                b.atk = 0;
                if (inp.x && Math.sign(inp.x) === p.face) startMove(w, p, 'throwF');
                else if (inp.x && Math.sign(inp.x) === -p.face) startMove(w, p, 'throwB');
                else if (p.grabHits >= 2) { startMove(w, p, 'headbutt'); p.grab = null; tgt.grabbedBy = null; setState(tgt, 'hurt', 'hurt'); tgt.stun = 0.4; }
                else { p.grabHits++; startMove(w, p, 'knee'); p.grabT = Math.max(p.grabT, 0.7); }
            }
            break;
        }
        default: break;
    }
}

export { PLAYER_DEF, WEAPONS, GRAV };
