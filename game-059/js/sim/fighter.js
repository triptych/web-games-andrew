/**
 * fighter.js — what every body in a fight shares: physics on the 2.5D plane,
 * the move/phase machine, hit detection, and hit reactions (flinch, juggle,
 * knockdown, bounce, getting up, grabs and throws).
 *
 * Coordinates: x along the street, z into the screen (0 = front edge of the
 * walkable strip), y height above the ground. One unit = one sprite pixel.
 *
 * A move is data: { anim, st, ac, rc } durations for startup / active /
 * recovery, a hitbox [x0, x1, y0, y1] measured forward from the fighter's
 * feet, depth tolerance z, damage and a knock type, plus optional velocity,
 * invulnerability, armour, projectiles and hooks. The view reads
 * fighter.phase and fighter.phaseT to choose the frame, so art and hitboxes
 * can never drift apart.
 */

export const GRAV = 1150;
const FREE = new Set(['idle', 'walk', 'run', 'land']);
const NO_HIT = new Set(['down', 'dead', 'getup', 'grabbedThrow']);

let nextId = 1;
export function resetIds() { nextId = 1; }

export function makeFighter(def, o = {}) {
    const f = {
        id: nextId++, kind: 'fighter', def, team: o.team || 'enemy',
        sprite: def.sprite, pal: o.pal || 'base', name: o.name || def.name,
        x: o.x || 0, y: o.y || 0, z: o.z || 30, vx: 0, vy: 0, vz: 0, face: o.face || -1,
        hp: def.hp, maxHp: def.hp, state: 'idle', st: 0, anim: def.idleAnim || 'idle', animT: 0,
        move: null, moveName: '', mt: 0, phase: null, phaseT: 0, hits: new Map(), hitLanded: false,
        invuln: o.invuln || 0, hitstop: 0, flash: 0, flashColor: 0,
        poiseMax: def.poise || 0, poise: def.poise || 0, poiseT: 0,
        juggle: 0, bounce: 0, stun: 0, downT: 0, ko: false,
        grab: null, grabbedBy: null, grabT: 0, grabHits: 0,
        thrown: null, throwDmg: 0, thrownHits: null,
        w: def.w || 10, h: def.h || 70, weight: def.weight || 1,
        speed: def.speed || 70, zspeed: def.zspeed || 46,
        boss: !!def.boss, flying: !!def.flying, remove: false, deadT: 0,
        dmgMul: 1, blocking: false, blockHits: 0, hurtFlip: false,
        token: false, intent: null, ai: {}, tags: o.tags || {},
        armorAll: false,
    };
    return f;
}

export const isFree = (f) => FREE.has(f.state);
export const moveInv = (f) => {
    const mv = f.state === 'attack' && f.move;
    if (!mv || !mv.inv) return false;
    if (mv.inv === true) return true;
    return f.mt >= mv.inv[0] && f.mt <= mv.inv[1];
};
export const canBeHit = (f) => !NO_HIT.has(f.state) && f.invuln <= 0 && !f.remove && !f.intangible && !moveInv(f);
export const onGround = (f) => f.y <= 0.01 && f.vy <= 0;

export function setState(f, s, anim) {
    f.state = s; f.st = 0;
    if (anim) { f.anim = anim; f.animT = 0; }
    if (s !== 'attack') { f.move = null; f.moveName = ''; f.phase = null; }
}

/** Begin a move by name from f.moves. Returns false if unknown. */
export function startMove(w, f, name) {
    const mv = f.moves[name];
    if (!mv) return false;
    if (mv.turn) f.face = -f.face;
    f.state = 'attack'; f.st = 0;
    f.move = mv; f.moveName = name; f.mt = 0; f.phase = 'st'; f.phaseT = 0;
    f.hits.clear(); f.hitLanded = false; f._activeFired = false;
    f.anim = mv.anim || name; f.animT = 0;
    if (mv.vy0 !== undefined) f.vy = mv.vy0;
    if (mv.onStart) mv.onStart(w, f);
    if (mv.sfxStart) w.emit({ t: 'sfx', id: mv.sfxStart, x: f.x });
    return true;
}

export function endMove(w, f) {
    const mv = f.move;
    if (mv && mv.onEnd) mv.onEnd(w, f);
    if (f.state !== 'attack' || f.move !== mv) return;   // hook changed state
    if (f.y > 0.5 || mv.air) setState(f, 'jump', 'jump');
    else setState(f, mv.after || 'idle', mv.afterAnim || f.def.idleAnim || 'idle');
}

/** World-space hitbox of the current active move, or null. */
export function activeBox(f) {
    const mv = f.move;
    if (!mv || f.phase !== 'ac' || !mv.box) return null;
    const [x0, x1, y0, y1] = mv.box;
    if (mv.aoe) return { x0: f.x - x1, x1: f.x + x1, y0: f.y + y0, y1: f.y + y1, z: mv.z ?? 14, zc: f.z, aoe: true };
    return f.face > 0
        ? { x0: f.x + x0, x1: f.x + x1, y0: f.y + y0, y1: f.y + y1, z: mv.z ?? 12, zc: f.z }
        : { x0: f.x - x1, x1: f.x - x0, y0: f.y + y0, y1: f.y + y1, z: mv.z ?? 12, zc: f.z };
}

export function overlaps(box, t) {
    if (Math.abs(t.z - box.zc) > box.z) return false;
    const tx0 = t.x - t.w, tx1 = t.x + t.w;
    const ty0 = t.y + (t.hy0 || 0), ty1 = t.y + t.h;
    return box.x1 >= tx0 && box.x0 <= tx1 && box.y1 >= ty0 && box.y0 <= ty1;
}

// ------------------------------------------------------------- per-step
export function stepFighter(w, f, dt) {
    if (f.flash > 0) f.flash -= dt;
    if (f.hitstop > 0) { f.hitstop -= dt; return; }
    f.st += dt; f.animT += dt;
    if (f.invuln > 0) f.invuln -= dt;
    if (f.poiseMax > 0 && f.poise < f.poiseMax) {
        f.poiseT -= dt;
        if (f.poiseT <= 0) f.poise = Math.min(f.poiseMax, f.poise + f.poiseMax * dt * 0.6);
    }

    switch (f.state) {
        case 'idle': case 'walk': case 'run':
            if (!f.flying && f.y > 0) { f.vy -= GRAV * dt; }
            break;
        case 'land':
            f.vx *= 0.8;
            if (f.st > 0.08) setState(f, 'idle', f.def.idleAnim || 'idle');
            break;
        case 'jump':
            f.vy -= GRAV * dt;
            break;
        case 'attack': stepMove(w, f, dt); break;
        case 'hurt':
            f.vx -= f.vx * Math.min(1, dt * 9);
            f.vz = 0;
            if (f.flying) f.vy = 0;
            if (f.st >= f.stun) setState(f, 'idle', f.def.idleAnim || 'idle');
            break;
        case 'fall':
            f.vy -= GRAV * dt * (f.flying ? 1 : 1);
            if (f.thrown) thrownCollide(w, f);
            break;
        case 'down':
            f.vx -= f.vx * Math.min(1, dt * 10);
            if (f.st >= f.downT) {
                if (f.hp <= 0) { setState(f, 'dead', 'down'); f.deadT = 0; w.onDeath(f); }
                else { setState(f, 'getup', 'getup'); }
            }
            break;
        case 'getup':
            if (f.st >= 0.36) {
                setState(f, 'idle', f.def.idleAnim || 'idle');
                f.invuln = Math.max(f.invuln, f.team === 'player' ? 1.1 : 0.25);
            }
            break;
        case 'dead':
            f.deadT += dt;
            if (f.team !== 'player' && f.deadT > 1.3) f.remove = true;
            break;
        case 'grabbed': {
            const g = f.grabbedBy;
            if (!g || g.state !== 'grabbing' && !(g.state === 'attack' && g.move && g.move.grabMove)) {
                f.grabbedBy = null; setState(f, 'hurt', 'hurt'); f.stun = 0.2; break;
            }
            f.x = g.x + g.face * (g.def.grabDist || 22); f.z = g.z; f.y = 0; f.face = -g.face;
            f.vx = f.vz = 0;
            break;
        }
        case 'grabbing':
            f.vx = f.vz = 0;
            f.grabT -= dt;
            if (!f.grab || f.grab.state !== 'grabbed' || f.grabT <= 0) {
                if (f.grab && f.grab.state === 'grabbed') { f.grab.grabbedBy = null; setState(f.grab, 'idle', 'idle'); f.grab.invuln = 0.3; }
                f.grab = null; setState(f, 'idle', 'idle');
            }
            break;
        case 'dizzy': case 'block': case 'stunned':
            f.vx -= f.vx * Math.min(1, dt * 9);
            if (f.st >= f.stun) { f.blocking = false; setState(f, 'idle', f.def.idleAnim || 'idle'); }
            break;
        default:
            // custom AI states manage themselves
            break;
    }

    // integrate
    f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt;
    if (!f.flying || f.state === 'fall' || f.state === 'down' || f.state === 'dead') {
        if (f.y <= 0) {
            f.y = 0;
            if (f.vy < 0) landed(w, f);
            f.vy = Math.max(0, f.vy);
        }
    } else if (f.y < 0) f.y = 0;
    if (f.state !== 'dead' && !f.offStage) f.z = Math.max(w.zMin, Math.min(w.zMax, f.z));
}

function landed(w, f) {
    const vy = f.vy;
    if (f.state === 'jump') {
        setState(f, 'land', 'land'); f.vx *= 0.3; f.vz = 0;
        if (f.dropIn) { f.dropIn = false; w.emit({ t: 'dust', x: f.x, z: f.z, big: true }); }
        return;
    }
    if (f.state === 'attack' && f.move && (f.move.air || f.move.landEnd)) {
        if (f.move.onLand) f.move.onLand(w, f);
        if (f.state === 'attack') {
            setState(f, 'land', 'land'); f.vx *= 0.2;
        }
        return;
    }
    if (f.state === 'fall') {
        if (f.thrown && f.throwDmg) {
            const d = f.throwDmg; f.throwDmg = 0;
            damage(w, f, d, f.thrown);
            w.emit({ t: 'shake', a: 4 }); w.emit({ t: 'sfx', id: 'thud', x: f.x });
        }
        if ((vy < -240 || f.thrown) && f.bounce === 0 && !f.flying) {
            f.bounce = 1; f.vy = 150; f.vx *= 0.45;
            w.emit({ t: 'dust', x: f.x, z: f.z, big: vy < -400 });
            w.emit({ t: 'sfx', id: 'thud', x: f.x });
            return;
        }
        f.thrown = null; f.thrownHits = null;
        setState(f, 'down', 'down');
        f.vx *= 0.3; f.juggle = 0; f.bounce = 0;
        f.downT = f.hp <= 0 ? 0.55 : (f.team === 'player' ? 0.55 : (f.def.downTime || 0.75));
        w.emit({ t: 'dust', x: f.x, z: f.z });
        if (f.flying && f.hp <= 0) w.emit({ t: 'explode', x: f.x, y: 8, z: f.z, r: 22 });
        return;
    }
    if (FREE.has(f.state) && f.dropIn) { f.dropIn = false; w.emit({ t: 'dust', x: f.x, z: f.z, big: true }); }
}

function stepMove(w, f, dt) {
    const mv = f.move;
    f.mt += dt * (mv.speedMul ? mv.speedMul(f) : 1) * (f.od ? 1.12 : 1);
    const st = mv.st, ac = mv.ac, rc = mv.rc;
    let ph;
    if (f.mt < st) { ph = 'st'; f.phaseT = f.mt / st; }
    else if (f.mt < st + ac) { ph = 'ac'; f.phaseT = (f.mt - st) / ac; }
    else if (f.mt < st + ac + rc || (mv.air && mv.holdAir && f.y > 0)) { ph = 'rc'; f.phaseT = rc ? Math.min(1, (f.mt - st - ac) / rc) : 1; }
    else { endMove(w, f); return; }
    if (ph === 'ac' && !f._activeFired) {
        f._activeFired = true;
        if (mv.vyA !== undefined) f.vy = mv.vyA;
        if (mv.proj) w.spawnProjFrom(f, mv.proj);
        if (mv.onActive) mv.onActive(w, f);
        if (mv.sfx && !mv.sfxOnHit) w.emit({ t: 'sfx', id: mv.sfx, x: f.x });
        if (mv.whiff) w.emit({ t: 'sfx', id: mv.whiff, x: f.x });
        if (f.state !== 'attack' || f.move !== mv) return;
    }
    f.phase = ph;
    // velocity
    if (mv.vx) {
        const v = mv.vx[ph === 'st' ? 0 : ph === 'ac' ? 1 : 2];
        if (v !== undefined && v !== null) f.vx = v * f.face * (f.od ? 1.1 : 1);
    } else if (!mv.air && f.y <= 0) {
        f.vx -= f.vx * Math.min(1, dt * 10);
    }
    if (!mv.keepZ) f.vz = 0;
    if (mv.air || f.y > 0) { if (!mv.noGrav && !(mv.noGravSt && ph === 'st')) f.vy -= GRAV * dt * (mv.gravMul || 1); }
    if (mv.track && ph === 'st' && w.player) {
        const dz = w.player.z - f.z;
        f.vz = Math.max(-mv.track, Math.min(mv.track, dz * 6));
    }
    if (mv.onTick) mv.onTick(w, f, dt, ph);
}

// ------------------------------------------------------------- damage
export function damage(w, t, amount, srcTeam) {
    if (t.armorAll) amount *= 0.25;
    t.hp -= amount;
    if (t.team === 'player') { w.stats.dmgTaken += amount; w.addMeter(t, amount * 0.8); }
    if (t.hp <= 0 && !t.ko) {
        t.hp = 0; t.ko = true;
        w.onKO(t, srcTeam);
    }
}

/**
 * Resolve one hit. `a` is the attacker (fighter or projectile owner),
 * `mv` the move/projectile data, `dir` the direction the hit pushes.
 * Returns 'hit' | 'block' | 'armor' | null.
 */
export function applyHit(w, a, t, mv, dir, ctx = {}) {
    if (!canBeHit(t)) return null;
    if (t.grabbedBy && t.grabbedBy !== a) { const g = t.grabbedBy; g.grab = null; setState(g, 'idle', 'idle'); t.grabbedBy = null; }
    if (t.grab && t.state === 'grabbing') { t.grab.grabbedBy = null; setState(t.grab, 'idle', 'idle'); t.grab = null; }

    // counter stance (Oni, Magnus): striking it during the window triggers a riposte
    if (t.state === 'attack' && t.move && t.move.counter && t.phase === 'ac' && a.kind === 'fighter') {
        t.move.counter(w, t, a);
        return 'block';
    }
    // guard: a blocker facing the hit stops anything that isn't overhead / unblockable
    if (t.blocking && t.face === -dir && !mv.unblockable && !(a.y > 10 && a.kind === 'fighter') && !mv.grab) {
        t.blockHits++;
        t.vx = dir * 70; t.flash = 0.06; t.flashColor = 1;
        if (a.kind === 'fighter') { a.hitstop = 0.05; a.vx = -dir * 40; }
        t.hitstop = 0.05;
        w.emit({ t: 'block', x: t.x - dir * t.w, y: t.y + t.h * 0.6, z: t.z });
        if (t.ai) t.ai.blocked = (t.ai.blocked || 0) + 1;
        return 'block';
    }

    let dmg = (mv.dmg || 0) * (ctx.mul || 1);
    if (a.dmgMul) dmg *= a.dmgMul * (a.od ? 1.5 : 1);
    if (t.team === 'player') dmg *= w.diff.dmgTaken * (t.armorMul || 1);
    if (t.vulnerable) dmg *= 1.5;
    dmg = Math.max(1, Math.round(dmg));

    // hit sparks / stop / shake
    const kb = mv.kb || 'light';
    const hs = mv.hitstop ?? (kb === 'light' ? 0.055 : kb === 'heavy' ? 0.075 : 0.1);
    t.hitstop = hs; if (a.kind === 'fighter' && !ctx.noStopAttacker) a.hitstop = hs;
    t.flash = 0.1; t.flashColor = 0;
    w.emit({ t: 'hit', id: t.id, x: t.x - dir * t.w * 0.5, y: ctx.hy ?? (t.y + Math.min(t.h * 0.75, Math.max(t.h * 0.3, (mv.box ? (mv.box[2] + mv.box[3]) / 2 : t.h * 0.6)))), z: t.z, kind: mv.spark || kb, dmg, team: a.team, sfx: mv.sfx || (kb === 'light' ? 'hitL' : 'hitH') });
    if (mv.shake) w.emit({ t: 'shake', a: mv.shake });

    w.onHitLanded(a, t, dmg, mv);
    damage(w, t, dmg, a.team);

    if (kb === 'grab' && !t.ko) { t.flash = 0.12; return 'hit'; }
    if (t.ko) {
        if (t.grabbedBy) { const g = t.grabbedBy; g.grab = null; t.grabbedBy = null; if (g.state === 'grabbing') setState(g, 'idle', 'idle'); }
        knock(t, dir, Math.max(160, (mv.push || 120) * 1.2), Math.max(260, mv.lift || 0));
        t.ko = true;
        return 'hit';
    }

    // poise / armour: big enemies shrug off small hits until it breaks
    const armored = t.armorAll || (t.state === 'attack' && t.move && t.move.armor) || t.superArmor;
    if (t.poiseMax > 0 || armored) {
        if (armored && !mv.breaksArmor) { t.flashColor = 2; return 'armor'; }
        if (t.poiseMax > 0) {
            t.poise -= dmg * (mv.poiseMul || 1);
            t.poiseT = 1.4;
            if (t.poise > 0 && kb !== 'grab') { t.flashColor = 2; t.vx += dir * 10; return 'armor'; }
            t.poise = t.poiseMax;
        }
    }

    const air = t.y > 2 || t.state === 'fall' || t.state === 'jump' || (t.flying && t.y > 2);
    if (t.state === 'attack') { if (t.move && t.move.onInterrupt) t.move.onInterrupt(w, t); }
    if (t.token) w.releaseToken(t);
    t.face = -dir;
    if (kb === 'knock' || kb === 'launch' || (air && !t.flying) || t.juggle >= 4) {
        const lift = kb === 'launch' ? (mv.lift || 360) : air ? Math.max(150, Math.min(300, (mv.lift || 0) || 170)) : (mv.lift || 230);
        const push = (kb === 'light' || kb === 'heavy') && air ? (mv.push || 40) + 30 : (mv.push || 130);
        knock(t, dir, t.juggle >= 4 ? push + 80 : push, lift);
        t.juggle++;
    } else {
        setState(t, 'hurt', t.hurtFlip ? 'hurt2' : 'hurt');
        t.hurtFlip = !t.hurtFlip;
        t.stun = (mv.stun || (kb === 'light' ? 0.3 : 0.42)) * (t.stunMul || 1);
        t.vx = dir * (mv.push || 40) / t.weight;
    }
    return 'hit';
}

export function knock(t, dir, push, lift) {
    setState(t, 'fall', 'fall');
    t.vx = dir * push / t.weight;
    t.vy = lift / Math.sqrt(t.weight);
    t.vz = 0;
    t.bounce = 0;
}

/** A thrown body is a weapon: it bowls over anyone on its own team it touches. */
function thrownCollide(w, f) {
    if (!f.thrownHits) f.thrownHits = new Set();
    for (const o of w.fighters) {
        if (o === f || o.team !== f.team || f.thrownHits.has(o.id) || !canBeHit(o)) continue;
        if (Math.abs(o.z - f.z) > 12 || Math.abs(o.x - f.x) > o.w + 14 || f.y > o.h) continue;
        f.thrownHits.add(o.id);
        const dir = Math.sign(f.vx) || 1;
        applyHit(w, { kind: 'body', team: f.thrown, x: f.x, y: f.y, dmgMul: 1 }, o, { dmg: 10, kb: 'knock', push: 160, lift: 240, spark: 'heavy', shake: 3 }, dir);
    }
}
