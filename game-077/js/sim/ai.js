// Guard brains. Called by the world once per fixed step while time flows.
//
// States
//   patrol      walk the route / stand the post (sweeping the look angle)
//   suspicious  "?" — stop and stare at something seen or heard
//   investigate walk over to it
//   look        stand and look around, then return
//   return      walk back to the route
//   alert       "!" — chase the last place a teammate was seen, shoot on sight
//   search      evasion: sweep around where the alarm started
//   dance       a boombox is playing
//   stun        knocked about but awake; slides with the physics
//   ko / sleep  out cold; a body other guards can find
//   gone        sunk

import { VISION, GUARD, ALARM } from '../config.js';
import { castRay, lineOfSight, angleDiff, findPath, walkable, tileAt, T } from './physics.js';

const TAU = Math.PI * 2;

export function rnd(S) {
    let a = (S.rs = (S.rs + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const DOWN_STATES = new Set(['ko', 'sleep', 'gone']);
export const isDown = (f) => DOWN_STATES.has(f.state);
export const isAwake = (f) => !f.gone && !DOWN_STATES.has(f.state) && f.state !== 'stun';

/** The vision cone a guard has right now. */
export function coneOf(S, f) {
    const k = f.kd;
    let range = VISION.range, half = VISION.half;
    if (f.state === 'alert' || f.state === 'search' || S.alarm.mode === 'alert' || S.alarm.mode === 'evasion') { range = VISION.alertRange; half = VISION.alertHalf; }
    else if (S.alarm.mode === 'caution' || f.state === 'investigate' || f.state === 'look' || f.state === 'suspicious') { range = VISION.cautionRange; half = VISION.cautionHalf; }
    if (k.dog) { range = VISION.dogRange; half = VISION.dogHalf; }
    range *= k.see;
    if (f.state === 'dance') { range = 1.2; half = 0.6; }
    return { range, half, smell: k.dog ? VISION.dogSmell : 0.9 };
}

function setRoute(W, f, x, y) {
    const r = findPath(W.S, W.L, f.x, f.y, x, y);
    f.route = r || [];
    f.ri = 0;
    return !!r;
}

function turnToward(f, a, rate, dt) {
    const d = angleDiff(f.face, a);
    const m = rate * dt;
    f.face += Math.abs(d) <= m ? d : Math.sign(d) * m;
}

/** Walk along f.route. Returns true when the route is finished. */
function followRoute(f, speed, dt) {
    if (!f.route || f.ri >= f.route.length) { f.vx = 0; f.vy = 0; return true; }
    const [tx, ty] = f.route[f.ri];
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    const last = f.ri === f.route.length - 1;
    if (d < (last ? 0.12 : 0.35)) {
        f.ri++;
        if (f.ri >= f.route.length) { f.vx = 0; f.vy = 0; return true; }
        return false;
    }
    const s = last ? Math.min(speed, d * 4 + 0.3) : speed;
    f.vx = (dx / d) * s; f.vy = (dy / d) * s;
    turnToward(f, Math.atan2(dy, dx), 6, dt);
    return false;
}

function goReturn(W, f) {
    f.state = 'return';
    const p = f.path[f.pi] ?? f.path[0];
    setRoute(W, f, p[0], p[1]);
}

export function makeSuspicious(W, f, x, y, sus = 0.4) {
    if (!isAwake(f) || f.state === 'alert' || f.state === 'dance') return;
    f.sus = Math.max(f.sus, sus);
    if (f.state !== 'suspicious') W.emit('suspicious', { id: f.id, x: f.x, y: f.y });
    f.state = 'suspicious';
    f.st = 0.8;
    f.seen = { x, y };
}

/** Everything one guard does in one step. */
export function updateFoe(W, f, dt) {
    const S = W.S;
    f.shootT = Math.max(0, f.shootT - dt);
    f.biteT = Math.max(0, (f.biteT || 0) - dt);
    if (f.gone) return;

    if (f.state === 'ko' || f.state === 'sleep') {
        f.ctl = false;
        f.koT -= dt;
        if (f.koT <= 0 && !f.dazed) {
            f.state = 'look'; f.st = 2.2; f.ctl = true; f.sus = 0.3;
            W.emit('wake', { id: f.id, x: f.x, y: f.y });
            W.setCaution();
        }
        return;
    }
    if (f.state === 'stun') {
        f.ctl = false;
        f.st -= dt;
        if (f.st <= 0 && Math.hypot(f.vx, f.vy) < 0.3) {
            f.ctl = true; f.vx = 0; f.vy = 0;
            if (S.alarm.mode === 'alert') { f.state = 'alert'; f.route = []; }
            else if (f.hitBy) makeSuspicious(W, f, f.hitBy.x, f.hitBy.y, 0.75);
            else goReturn(W, f);
        }
        return;
    }
    f.ctl = true;
    const k = f.kd;
    const walk = 1.5 * k.speed, run = (k.dog ? GUARD.dogRun : GUARD.run) * Math.min(1.2, k.speed);

    switch (f.state) {
        case 'patrol': {
            if (f.path.length <= 1) {
                const [px, py] = f.path[0];
                if (Math.hypot(px - f.x, py - f.y) > 0.4) { goReturn(W, f); break; }
                f.vx = 0; f.vy = 0;
                const target = f.look + f.sweep * Math.sin((S.t + f.phase) * TAU / f.period);
                turnToward(f, target, 2.5, dt);
                break;
            }
            if (f.pause > 0) {
                f.pause -= dt; f.vx = 0; f.vy = 0;
                const nx = f.path[(f.pi + 1) % f.path.length];
                if (f.pause < 0.5) turnToward(f, Math.atan2(nx[1] - f.y, nx[0] - f.x), 3.5, dt);
                if (f.pause <= 0) f.pi = (f.pi + 1) % f.path.length;
                break;
            }
            const [tx, ty] = f.path[f.pi];
            const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
            if (d < 0.15) { f.pause = 0.9; f.vx = 0; f.vy = 0; break; }
            // Straight line if clear, otherwise route round whatever is in the way.
            if (!f.route?.length || f.ri >= f.route.length || f.routeFor !== f.pi) {
                if (!setRoute(W, f, tx, ty)) { f.pi = (f.pi + 1) % f.path.length; break; }
                f.routeFor = f.pi;
            }
            if (followRoute(f, walk, dt)) f.route = [];
            break;
        }
        case 'return': {
            if (followRoute(f, walk, dt)) {
                f.state = 'patrol'; f.route = []; f.pause = 0.4;
            }
            break;
        }
        case 'suspicious': {
            f.vx = 0; f.vy = 0;
            turnToward(f, Math.atan2(f.seen.y - f.y, f.seen.x - f.x), 5, dt);
            f.st -= dt;
            if (f.st <= 0) {
                f.state = 'investigate';
                if (!setRoute(W, f, f.seen.x, f.seen.y)) { f.state = 'look'; f.st = 2; }
            }
            break;
        }
        case 'investigate': {
            if (followRoute(f, walk * 1.25, dt) || Math.hypot(f.seen.x - f.x, f.seen.y - f.y) < (f.bodyId != null ? 1.1 : 0.6)) {
                if (f.bodyId != null) {
                    const body = S.bodies.find((b) => b.id === f.bodyId);
                    if (body && !body.gone && isDown(body)) W.bodyFound(f, body);
                    f.bodyId = null;
                }
                f.state = 'look'; f.st = 2.4; f.vx = 0; f.vy = 0;
            }
            break;
        }
        case 'look': {
            f.vx = 0; f.vy = 0;
            f.face += dt * 1.8 * (f.id % 2 ? 1 : -1);
            f.st -= dt;
            if (f.st <= 0) {
                if (S.alarm.mode === 'evasion') { f.state = 'search'; f.route = []; }
                else goReturn(W, f);
            }
            break;
        }
        case 'alert': {
            const tgt = W.visibleTarget(f);
            if (tgt) {
                f.lastSeen = { x: tgt.x, y: tgt.y };
                turnToward(f, Math.atan2(tgt.y - f.y, tgt.x - f.x), 7, dt);
                const d = Math.hypot(tgt.x - f.x, tgt.y - f.y);
                if (k.dog) {
                    f.route = [[tgt.x, tgt.y]]; f.ri = 0;
                    followRoute(f, run, dt);
                } else if (k.gun) {
                    // close the distance a little, but mostly stand and shoot
                    if (d > GUARD.shootRange * 0.75) { f.route = [[tgt.x, tgt.y]]; f.ri = 0; followRoute(f, walk, dt); }
                    else { f.vx = 0; f.vy = 0; }
                    if (f.shootT <= 0 && d <= GUARD.shootRange) {
                        W.fireBullet(f, tgt);
                        f.shootT = GUARD.shootCool * (k.boss ? 0.8 : 1) + rnd(S) * 0.4;
                    }
                } else {
                    // unarmed (police): run at them
                    f.route = [[tgt.x, tgt.y]]; f.ri = 0;
                    followRoute(f, run, dt);
                }
            } else {
                const ls = f.lastSeen ?? S.alarm;
                if (!f.route?.length || f.ri >= f.route.length || f.chasing !== `${ls.x | 0},${ls.y | 0}`) {
                    f.chasing = `${ls.x | 0},${ls.y | 0}`;
                    if (!setRoute(W, f, ls.x, ls.y)) f.route = [];
                }
                if (followRoute(f, run, dt)) f.face += dt * 2.4;
            }
            break;
        }
        case 'search': {
            if (!f.route?.length || f.ri >= f.route.length) {
                if (f.st > 0) { f.st -= dt; f.vx = 0; f.vy = 0; f.face += dt * 2; break; }
                for (let n = 0; n < 8; n++) {
                    const x = S.alarm.x + (rnd(S) - 0.5) * 9, y = S.alarm.y + (rnd(S) - 0.5) * 9;
                    if (walkable(S, W.L, Math.floor(x), Math.floor(y)) && setRoute(W, f, x, y)) break;
                }
                f.st = 1.4;
            }
            followRoute(f, walk * 1.4, dt);
            break;
        }
        case 'dance': {
            const bb = S.boomboxes.find((b) => b.id === f.boombox);
            if (!bb) { goReturn(W, f); break; }
            const d = Math.hypot(bb.x - f.x, bb.y - f.y);
            if (d > 1.5) {
                if (!f.route?.length || f.ri >= f.route.length) setRoute(W, f, bb.x, bb.y);
                if (followRoute(f, walk * 1.3, dt) && d > 1.5) { f.route = [[bb.x, bb.y]]; f.ri = 0; }
            } else {
                f.vx = 0; f.vy = 0;
                f.face = Math.atan2(bb.y - f.y, bb.x - f.x) + Math.sin(S.t * 7 + f.id) * 0.9;
            }
            break;
        }
        default:
            f.state = 'patrol';
    }
}

/** Sight and suspicion for one guard. */
export function senseFoe(W, f, dt) {
    const S = W.S;
    if (!isAwake(f) || f.state === 'dance') { f.sus = Math.max(0, f.sus - dt * 0.4); return; }
    const cone = coneOf(S, f);
    const tgt = W.visibleTarget(f, cone);
    if (tgt) {
        const d = Math.hypot(tgt.x - f.x, tgt.y - f.y);
        if (f.state === 'alert') {
            f.lastSeen = { x: tgt.x, y: tgt.y };
            W.refreshAlarm(tgt.x, tgt.y);
            return;
        }
        const moving = Math.hypot(tgt.vx, tgt.vy) > 0.4 ? 1.6 : 1;
        const star = tgt.who === 'roxy' ? 0.5 : 1;
        const caution = S.alarm.mode === 'caution' ? 1.5 : 1;
        let rate = 1.5 * (1 + 2 * Math.max(0, 1 - d / cone.range)) * moving * star * caution;
        if (d < 1.2) rate += 4;
        f.sus += rate * dt;
        f.seen = { x: tgt.x, y: tgt.y };
        if (f.sus >= 1) { W.raiseAlarm(f, tgt.x, tgt.y); return; }
        if (f.sus >= 0.3 && (f.state === 'patrol' || f.state === 'return' || f.state === 'look' || f.state === 'investigate')) {
            if (f.state !== 'investigate') makeSuspicious(W, f, tgt.x, tgt.y, f.sus);
            else f.seen = { x: tgt.x, y: tgt.y };
        }
        return;
    }
    f.sus = Math.max(0, f.sus - dt * 0.3);
    // a colleague on the floor?
    if (f.state === 'patrol' || f.state === 'return' || f.state === 'look') {
        for (const b of S.bodies) {
            if (b.kind !== 'foe' || b === f || b.gone || !isDown(b) || b.found) continue;
            const d = Math.hypot(b.x - f.x, b.y - f.y);
            if (d > VISION.bodyRange * f.kd.see) continue;
            if (Math.abs(angleDiff(f.face, Math.atan2(b.y - f.y, b.x - f.x))) > cone.half) continue;
            if (!lineOfSight(S, W.L, f.x, f.y, b.x, b.y)) continue;
            b.found = true;
            f.bodyId = b.id;
            f.state = 'investigate';
            f.seen = { x: b.x, y: b.y };
            setRoute(W, f, b.x, b.y);
            W.emit('suspicious', { id: f.id, x: f.x, y: f.y, body: true });
            break;
        }
    }
}

export function alertAll(W) {
    for (const f of W.S.bodies) {
        if (f.kind !== 'foe' || !isAwake(f)) continue;
        if (f.state !== 'alert') { f.state = 'alert'; f.route = []; f.chasing = null; }
    }
}

export function toSearch(W) {
    for (const f of W.S.bodies) {
        if (f.kind !== 'foe' || !isAwake(f)) continue;
        f.state = 'search'; f.route = []; f.st = rnd(W.S) * 1.5;
    }
}

export function toReturn(W) {
    for (const f of W.S.bodies) {
        if (f.kind !== 'foe' || !isAwake(f)) continue;
        if (f.state === 'search' || f.state === 'alert') goReturn(W, f);
    }
}

export { goReturn, setRoute };

export function startDance(W, bb) {
    for (const f of W.S.bodies) {
        if (f.kind !== 'foe' || !isAwake(f) || f.state === 'alert' || f.kd.dog) continue;
        const d = Math.hypot(bb.x - f.x, bb.y - f.y);
        if (d > 9) continue;
        f.state = 'dance'; f.boombox = bb.id; f.route = []; f.sus = 0;
        setRoute(W, f, bb.x, bb.y);
    }
}

export function noiseAt(W, x, y, radius) {
    W.emit('noise', { x, y, r: radius });
    for (const f of W.S.bodies) {
        if (f.kind !== 'foe' || !isAwake(f)) continue;
        if (f.state === 'alert' || f.state === 'dance') continue;
        const d = Math.hypot(f.x - x, f.y - y);
        if (d > radius) continue;
        makeSuspicious(W, f, x, y, 0.35);
    }
}

export { tileAt, T, castRay };
