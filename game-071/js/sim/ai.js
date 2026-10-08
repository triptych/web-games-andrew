/**
 * ai.js — perception, hostility, steering and behaviours for everyone who isn't the player.
 *
 * think() runs every ~0.25 s per actor and chooses a goal and an intent; steer() runs every tick,
 * turning the goal into a wish velocity through moveBody(). Combat intents call into combat.js.
 */
import { moveBody } from './physics.js';
import { startAttack, startBash, startDraw, releaseArrow, startCast, startSigil, aimDir, BOW_FULL } from './combat.js';
import { SPELLS } from './magic.js';
import { itemDef } from './items.js';
import { weaponIn } from './inventory.js';
import { angDiff } from './rng.js';

// ------------------------------------------------------------------ hostility
const ENEMIES = {
    player: ['reaver', 'bandit', 'undead', 'cult', 'gloom', 'automaton', 'dragon', 'wild'],
    guard: ['reaver', 'bandit', 'undead', 'cult', 'gloom', 'automaton', 'dragon', 'wild', 'giant'],
    town: [],
    friend: ['reaver', 'bandit', 'undead', 'cult', 'gloom', 'automaton', 'dragon', 'wild'],
    bandit: ['player', 'guard', 'friend', 'reaver', 'hearth', 'town', 'wild'],
    undead: ['player', 'guard', 'friend', 'bandit', 'town', 'reaver', 'hearth', 'wild', 'prey'],
    cult: ['player', 'guard', 'friend', 'town', 'hearth'],
    gloom: ['player', 'guard', 'friend', 'bandit', 'wild', 'automaton'],
    automaton: ['player', 'guard', 'friend', 'gloom', 'bandit'],
    dragon: ['player', 'guard', 'friend', 'town', 'bandit', 'reaver', 'hearth', 'giant', 'wild', 'prey'],
    wild: ['player', 'guard', 'friend', 'bandit', 'prey', 'town', 'reaver', 'hearth'],
    giant: [],
    prey: [],
    reaver: ['player', 'guard', 'friend', 'hearth', 'town', 'bandit', 'wild'],   // sea-raiders: everyone's enemy
    hearth: ['bandit', 'undead', 'dragon', 'wild', 'reaver'],
};

export function hostile(a, b) {
    if (a === b || a.dead || b.dead) return false;
    if (a.stats.calmed || b.stats.calmed) return false;
    if (a.stats.frenzied || b.stats.frenzied) return true;
    const fa = a.kind === 'player' || a.faction === 'player' ? 'player' : a.faction;
    const fb = b.kind === 'player' || b.faction === 'player' ? 'player' : b.faction;
    if (fa === 'player' && b.hostileToPlayer) return true;
    if (fb === 'player' && a.hostileToPlayer) return true;
    if (a.angry?.has?.(b.id) || b.angry?.has?.(a.id)) return true;
    if (fa === fb) return false;
    if (a.ai?.kind === 'passive' && fa !== 'dragon') return false;
    if (b.ai?.kind === 'passive' && fb === 'player' && a.kind !== 'player') return false;
    return (ENEMIES[fa] || []).includes(fb) || (ENEMIES[fb] || []).includes(fa);
}

// ------------------------------------------------------------------ perception
export function canSee(world, a, b) {
    const ex = a.pos.x, ey = a.pos.y + a.h * 0.9, ez = a.pos.z;
    const tx = b.pos.x, ty = b.pos.y + b.h * 0.7, tz = b.pos.z;
    if (world.space.colliders.raycast(ex, ey, ez, tx, ty, tz) >= 0) return false;
    if (world.space.blockedRay && world.space.blockedRay(ex, ey, ez, tx, ty, tz)) return false;
    if (world.space.kind === 'ext') {
        const T = world.terrain;
        for (let s = 1; s < 8; s++) {
            const t = s / 8, x = ex + (tx - ex) * t, z = ez + (tz - ez) * t, y = ey + (ty - ey) * t;
            if (T.heightAt(x, z) > y) return false;
        }
    }
    return true;
}

/** How fast `a` notices the player (per second). */
export function detectionRate(world, a, p, d) {
    if (a.blind && !p.moving) return 0;
    const sh = p.sheet;
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z;
    const front = (dx * fx + dz * fz) / (d || 1) > 0.15 ? 1 : 0.25;
    const see = !a.blind && canSee(world, a, p);
    const light = world.lightAt(p.pos);
    const speed = Math.hypot(p.vel.x, p.vel.z);
    let move = speed < 0.2 ? 0.35 : speed < 2.5 ? 0.8 : speed < 5.5 ? 1.5 : 3;
    let noise = 1 + (p.stats.heavyPieces || 0) * 0.08 * (sh?.perks.sn_muffled ? 0.5 : 1) * (p.stats.hush ? 0 : 1);
    if (p.act.kind === 'attack' || p.act.kind === 'cast') noise += sh?.perks.il_quiet ? 0 : 0.8;
    let rate;
    noise *= 1 - (p.stats.stealth || 0);
    if (see) rate = 1.6 * front * light * move * noise;
    else rate = d < 9 ? 0.6 * move * noise * (p.sneaking ? 0.3 : 1) : 0;
    if (p.sneaking) {
        const skill = (sh ? sh.skills.sneak + (p.stats.skillMod.sneak || 0) : 30);
        rate *= 0.45 * (1 - Math.min(0.85, skill / 150)) * (1 - (sh?.perks.sn_stealth ? 0.2 : 0));
    }
    if (p.stats.invisible) rate *= 0.04;
    if (a.ai?.state === 'sleep') rate *= 0.3;
    return rate / (1 + d / 7);
}

// ------------------------------------------------------------------ steering
const tmpQ = [];
function blockedAhead(world, a, dx, dz, dist) {
    const x = a.pos.x + dx * dist, z = a.pos.z + dz * dist;
    const near = world.space.colliders.query(x, z, a.r + 0.2, tmpQ);
    for (const s of near) {
        if (a.pos.y + a.h < s.y0 || a.pos.y + 0.5 > s.y1) continue;
        if (s.walk) continue;
        return true;
    }
    if (world.space.blocked && world.space.blocked({ x, z }, a.r, a.pos.y)) return true;
    if (world.space.kind === 'ext') {
        const n = world.terrain.normalAt(x, z);
        if (n.y < 0.66 && world.terrain.heightAt(x, z) > a.pos.y + 0.3) return true;
        if (world.terrain.waterAt(x, z) > world.terrain.heightAt(x, z) + 1.0 && a.rig !== 'dragon' && !a.swim) return true;
    }
    return false;
}

export function steer(world, a, dt) {
    const ai = a.ai;
    let wx = 0, wz = 0, speed = 0;
    const st = a.stats;
    const busyAct = a.act.kind === 'stagger' || a.act.kind === 'knock' || a.dead || st.paralyzed;
    if (!busyAct && ai.goal) {
        // follow a grid path indoors
        let gx = ai.goal.x, gz = ai.goal.z;
        if (world.space.path && ai.path && ai.path.length) {
            const wp = ai.path[0];
            if (Math.hypot(wp.x - a.pos.x, wp.z - a.pos.z) < 0.8) ai.path.shift();
            if (ai.path.length) { gx = ai.path[0].x; gz = ai.path[0].z; }
        }
        let dx = gx - a.pos.x, dz = gz - a.pos.z;
        const d = Math.hypot(dx, dz);
        const stop = ai.goal.stop ?? 0.6;
        if (d > stop) {
            dx /= d; dz /= d;
            if (blockedAhead(world, a, dx, dz, 1.1)) {
                const side = ai.side || (ai.side = world.rng.chance(0.5) ? 1 : -1);
                let found = false;
                for (const ang of [0.6, 1.1, 1.6, 2.2]) {
                    const c = Math.cos(ang * side), s = Math.sin(ang * side);
                    const rx = dx * c - dz * s, rz = dx * s + dz * c;
                    if (!blockedAhead(world, a, rx, rz, 1.1)) { dx = rx; dz = rz; found = true; break; }
                }
                if (!found) { ai.side = -side; const ndx = -dz * side, ndz = dx * side; dx = ndx; dz = ndz; }
            } else ai.side = 0;
            speed = ai.goal.speed ?? a.speed;
            if (d < 2) speed *= Math.max(0.35, d / 2);
            wx = dx; wz = dz;
        }
    }
    if (a.act.kind === 'attack' && a.act.phase !== 'recover') speed *= a.act.power ? 0.35 : 0.6;
    if (a.act.kind === 'cast' || a.act.kind === 'draw') speed *= 0.45;
    speed *= st.speedMul;
    if (a.float) { a.vel.y = 0; }
    const res = moveBody(a, { x: wx * speed, z: wz * speed, jump: false }, dt, world.space);
    if (a.float) a.pos.y = Math.max(a.pos.y, world.space.ground(a.pos.x, a.pos.z, a.pos.y + 1) + 0.6);
    // stuck detection: sidestep
    const hs = Math.hypot(a.vel.x, a.vel.z);
    a.moving = hs;
    if (speed > 0.5 && hs < 0.25) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1.2) { ai.side = -(ai.side || 1); ai.stuck = 0; ai.repath = true; } } else ai.stuck = 0;
    // facing: toward the target in combat, else toward movement
    let face = null;
    if (ai.faceTarget) { const t = world.byId(ai.target); if (t) face = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z)); }
    if (face === null && hs > 0.3) face = Math.atan2(-a.vel.x, -a.vel.z);
    if (face === null && ai.faceYaw != null) face = ai.faceYaw;
    if (face !== null && !busyAct) {
        const rate = a.rig === 'dragon' ? 1.4 : a.tpl === 'giant' || a.tpl === 'steam_colossus' ? 2.5 : 7;
        a.yaw += angDiff(a.yaw, face) * Math.min(1, dt * rate);
    }
    return res;
}

// ------------------------------------------------------------------ behaviours
function nearestEnemy(world, a, range) {
    let best = null, bd = range;
    for (const t of world.actors) {
        if (t === a || t.dead || !hostile(a, t)) continue;
        if (t.kind === 'player') continue;   // the player is noticed through detection
        const d = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
        if (d < bd && (d < 6 || canSee(world, a, t))) { best = t; bd = d; }
    }
    return best;
}

function enterCombat(world, a, t) {
    const ai = a.ai;
    if (ai.target === t.id && ai.state === 'combat') return;
    ai.state = 'combat'; ai.target = t.id; ai.combatT = 0; ai.cool = 0.4 + world.rng.next() * 0.6;
    if (t.kind === 'player') world.emit('aggro', { actor: a });
    if (a.tpl && (a.ai.kind === 'beast' || a.rig === 'humanoid') && world.rng.chance(0.4)) world.emit('bark', { actor: a, kind: 'combat' });
    // packs and camps join in
    for (const o of world.actors) {
        if (o === a || o.dead || o.faction !== a.faction || o.ai?.state === 'combat' || o.kind === 'player') continue;
        if (Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) < 18) { o.ai.state = 'combat'; o.ai.target = t.id; o.ai.cool = 0.5 + world.rng.next(); }
    }
}

export function think(world, a, dt) {
    const ai = a.ai;
    const p = world.player;
    ai.think -= dt;
    if (ai.think > 0) return;
    ai.think = 0.2 + world.rng.next() * 0.1;
    const step = 0.25;
    if (a.dead) return;
    if (a.summonT != null) { a.summonT -= step; if (a.summonT <= 0) { world.dismiss(a); return; } }
    const st = a.stats;
    // fear: run from the nearest hostile / the caster
    if (st.feared || (ai.kind === 'passive' && ai.state === 'flee')) {
        const threat = world.byId(ai.fleeFrom || ai.target) || p;
        const dx = a.pos.x - threat.pos.x, dz = a.pos.z - threat.pos.z, d = Math.hypot(dx, dz) || 1;
        ai.goal = { x: a.pos.x + dx / d * 20, z: a.pos.z + dz / d * 20, speed: a.speed * 1.1, stop: 0 };
        ai.faceTarget = false;
        if (ai.kind === 'passive' && d > 45) { ai.state = 'idle'; }
        return;
    }
    switch (ai.kind) {
        case 'passive': return thinkPassive(world, a);
        case 'civilian': return thinkCivilian(world, a);
        case 'follower': case 'summon': return thinkFollower(world, a);
        case 'dragon': return;   // dragon.js
        default: return thinkFighter(world, a);
    }
}

function thinkPassive(world, a) {
    const ai = a.ai, p = world.player;
    const d = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z);
    if ((d < (p.sneaking ? 12 : 26) && a.faction === 'prey') || a.lastHitBy) { ai.state = 'flee'; ai.fleeFrom = a.lastHitBy || p.id; return; }
    if (a.tpl === 'mammoth' && a.lastHitBy) { a.ai.kind = 'beast'; return; }
    wander(world, a, 18, 1.2);
}

function wander(world, a, radius, speed) {
    const ai = a.ai;
    if (!ai.goal || Math.hypot(ai.goal.x - a.pos.x, ai.goal.z - a.pos.z) < 1 || world.rng.chance(0.02)) {
        if (world.rng.chance(0.4)) { ai.goal = null; ai.idleT = 2 + world.rng.next() * 4; return; }
        const ang = world.rng.next() * Math.PI * 2, r = world.rng.next() * radius;
        const hx = ai.home?.x ?? a.pos.x, hz = ai.home?.z ?? a.pos.z;
        ai.goal = { x: hx + Math.cos(ang) * r, z: hz + Math.sin(ang) * r, speed, stop: 0.8 };
    }
}

function thinkCivilian(world, a) {
    const ai = a.ai;
    const threat = nearestEnemy(world, a, 20) || (a.lastHitBy && world.byId(a.lastHitBy)) || (world.player.hostileToPlayerArea && null);
    if (a.hostileToPlayer && a.role !== 'citizen') return thinkFighter(world, a);
    if (threat && !a.combatant) {
        ai.state = 'cower';
        const dx = a.pos.x - threat.pos.x, dz = a.pos.z - threat.pos.z, d = Math.hypot(dx, dz) || 1;
        ai.goal = { x: a.pos.x + dx / d * 12, z: a.pos.z + dz / d * 12, speed: 4.8, stop: 0 };
        if (world.rng.chance(0.05)) world.emit('bark', { actor: a, kind: 'fear' });
        return;
    }
    if (ai.state === 'cower') ai.state = 'idle';
    // schedule: walk to the anchor the population manager picked
    if (ai.dest) {
        const d = Math.hypot(ai.dest.x - a.pos.x, ai.dest.z - a.pos.z);
        ai.goal = { x: ai.dest.x, z: ai.dest.z, speed: ai.dest.run ? 4 : 1.7, stop: 0.6 };
        if (d < 1.2) { ai.goal = null; ai.faceYaw = ai.dest.rot ?? ai.faceYaw; ai.atDest = true; } else ai.atDest = false;
    } else wander(world, a, 6, 1.4);
}

function thinkFollower(world, a) {
    const ai = a.ai, p = world.player;
    const leader = world.byId(ai.leader) || p;
    // fight whoever the leader fights or whoever attacks us
    let t = world.byId(ai.target);
    if (!t || t.dead || !hostile(a, t)) {
        t = null;
        for (const o of world.actors) {
            if (o.dead || !hostile(a, o) || o.kind === 'player') continue;
            const d = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
            if (d < 22 && (o.ai?.target === leader.id || o.ai?.target === a.id || o.lastHitBy === leader.id) && (!t || d < Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z))) t = o;
        }
        ai.target = t ? t.id : null;
    }
    if (t) { ai.state = 'combat'; return fightTarget(world, a, t); }
    ai.state = 'follow';
    ai.faceTarget = false;
    if (ai.waiting) { ai.goal = null; return; }
    const d = Math.hypot(leader.pos.x - a.pos.x, leader.pos.z - a.pos.z);
    if (d > 60 && world.space.kind === 'ext') {   // catch up off-screen
        a.pos.x = leader.pos.x + Math.sin(leader.yaw) * 3; a.pos.z = leader.pos.z + Math.cos(leader.yaw) * 3;
        a.pos.y = world.space.ground(a.pos.x, a.pos.z, 1e4);
    }
    if (d > 4) ai.goal = { x: leader.pos.x + Math.sin(leader.yaw) * 2.2, z: leader.pos.z + Math.cos(leader.yaw) * 2.2, speed: d > 9 ? Math.max(5.5, Math.hypot(leader.vel.x, leader.vel.z) + 0.5) : 2.4, stop: 2.5 };
    else ai.goal = null;
    a.sneaking = leader.sneaking;
}

function thinkFighter(world, a) {
    const ai = a.ai, p = world.player;
    let t = world.byId(ai.target);
    if (t && (t.dead || !hostile(a, t))) { t = null; ai.target = null; ai.state = 'idle'; ai.faceTarget = false; if (a.faction !== 'player') world.emit('bark', { actor: a, kind: 'victory' }); }
    // perceive the player
    const dp = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z);
    if (!t && hostile(a, p) && dp < 60 && Math.abs(p.pos.y - a.pos.y) < 30) {
        a.detect = Math.max(0, a.detect + detectionRate(world, a, p, dp) * 0.25 - 0.03);
        if (a.lastHitBy === p.id) a.detect = 1.2;
        if (a.detect >= 1) enterCombat(world, a, p);
        else if (a.detect > 0.5) {
            if (ai.state === 'sleep') { ai.state = 'waking'; ai.wakeT = 1.2; world.emit('wake', { actor: a }); }
            else if (ai.state !== 'waking') { ai.state = 'search'; ai.lastSeen = { x: p.pos.x, z: p.pos.z }; if (!ai.searchBark) { ai.searchBark = true; world.emit('bark', { actor: a, kind: 'search' }); } }
        } else if (ai.state === 'search' && a.detect < 0.15) { ai.state = 'idle'; ai.searchBark = false; world.emit('bark', { actor: a, kind: 'giveup' }); }
    } else if (!t) a.detect = Math.max(0, a.detect - 0.05);
    if (!t) {
        const o = nearestEnemy(world, a, a.ai.state === 'sleep' ? 6 : 26);
        if (o) { if (ai.state === 'sleep') { ai.state = 'waking'; ai.wakeT = 1; } else enterCombat(world, a, o); }
    }
    if (ai.state === 'waking') { ai.wakeT -= 0.25; ai.goal = null; if (ai.wakeT <= 0) { ai.state = 'idle'; a.detect = Math.max(a.detect, 0.8); } return; }
    if (ai.state === 'sleep') { ai.goal = null; return; }
    if (t) return fightTarget(world, a, t);
    if (ai.state === 'search' && ai.lastSeen) { ai.goal = { x: ai.lastSeen.x, z: ai.lastSeen.z, speed: 1.8, stop: 1.5 }; ai.faceTarget = false; return; }
    // idle: guards patrol; camp folk mill about their home; the dead stay at rest
    ai.faceTarget = false;
    if (ai.kind === 'guard' && ai.patrol?.length) {
        const wp = ai.patrol[ai.pi || 0];
        if (Math.hypot(wp.x - a.pos.x, wp.z - a.pos.z) < 1.5) { ai.pi = ((ai.pi || 0) + 1) % ai.patrol.length; ai.pause = 3; }
        if (ai.pause > 0) { ai.pause -= 0.25; ai.goal = null; } else ai.goal = { x: wp.x, z: wp.z, speed: 1.6, stop: 1 };
        return;
    }
    if (a.undead && ai.restPos) { ai.goal = { x: ai.restPos.x, z: ai.restPos.z, speed: 1.6, stop: 0.8 }; if (Math.hypot(ai.restPos.x - a.pos.x, ai.restPos.z - a.pos.z) < 1) { ai.state = 'sleep'; a.detect = 0; } return; }
    wander(world, a, ai.kind === 'beast' ? 25 : 8, ai.kind === 'beast' ? 1.6 : 1.3);
}

function fightTarget(world, a, t) {
    const ai = a.ai;
    ai.faceTarget = true;
    ai.combatT = (ai.combatT || 0) + 0.25;
    ai.cool = (ai.cool || 0) - 0.25;
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    const w = weaponIn(a, 'right');
    const reach = (w && !w.d.bow ? w.d.reach : a.reach || 1.8) * (a.rig === 'humanoid' ? Math.max(1, a.scale * 0.85) : 1) + t.r * 0.8;
    // flee when badly hurt (animals and the cowardly)
    if ((ai.kind === 'beast' && !a.boss && a.hp < a.hpMax * 0.15 && a.tpl !== 'giantrat' && !a.undead) || (a.hp < a.hpMax * 0.12 && a.tpl === 'bandit' && world.rng.chance(0.3))) {
        ai.state = 'flee'; ai.fleeFrom = t.id;
        const l = d || 1;
        ai.goal = { x: a.pos.x - dx / l * 20, z: a.pos.z - dz / l * 20, speed: a.speed, stop: 0 };
        ai.faceTarget = false;
        return;
    }
    // storm sigils (wight bosses)
    if (a.npcSigil && ai.cool <= 0 && d < 10 && world.rng.chance(0.12)) { if (startSigil(world, a)) { ai.cool = 6; return; } }
    // mages: keep distance, heal, summon, cast
    const spells = a.spells || [];
    if ((ai.kind === 'mage' || (spells.length && a.rig === 'humanoid' && world.rng.chance(0.1))) && spells.length && a.mp > 15) {
        const heal = spells.find((s) => SPELLS[s].kind === 'heal' || SPELLS[s].kind === 'self' && SPELLS[s].heal);
        const summon = spells.find((s) => SPELLS[s].kind === 'summon');
        const armorS = spells.find((s) => SPELLS[s].armor);
        const attack = spells.filter((s) => ['bolt', 'ball', 'conc'].includes(SPELLS[s].kind));
        let choice = null;
        if (a.hp < a.hpMax * 0.4 && heal) choice = heal;
        else if (summon && !world.actors.some((o) => o.summoner === a.id && !o.dead) && world.rng.chance(0.4)) choice = summon;
        else if (armorS && !a.effects.some((e) => e.id === 'armorSpell') && world.rng.chance(0.3)) choice = armorS;
        else if (attack.length) {
            const conc = attack.filter((s) => SPELLS[s].kind === 'conc');
            const ranged = attack.filter((s) => SPELLS[s].kind !== 'conc');
            choice = d < 6 && conc.length ? world.rng.pick(conc) : ranged.length ? world.rng.pick(ranged) : conc[0];
        }
        if (choice && a.act.kind === 'idle' && ai.cool <= 0 && (SPELLS[choice].kind !== 'conc' || d < 7)) {
            a.hands.right = choice;
            if (startCast(world, a, 'right')) { ai.cool = SPELLS[choice].kind === 'conc' ? 0 : 1.2 + world.rng.next(); ai.concT = 1.5 + world.rng.next(); }
        }
        if (a.act.kind === 'cast' && a.act.conc) { ai.concT -= 0.25; if (ai.concT <= 0 || d > 8) { a.act = { kind: 'idle', t: 0 }; world.emit('castEnd', { actor: a }); ai.cool = 1.5; } }
        // keep 9–16 m
        const want = d < 8 ? -1 : d > 18 ? 1 : 0;
        const l = d || 1;
        const sx = -dz / l, sz = dx / l, side = Math.sin(ai.combatT * 0.7 + a.level) > 0 ? 1 : -1;
        ai.goal = { x: a.pos.x + dx / l * want * 6 + sx * side * 3, z: a.pos.z + dz / l * want * 6 + sz * side * 3, speed: a.speed * 0.8, stop: 0.3 };
        return;
    }
    // archers
    if (w?.d.bow) {
        if (d < 3.5 && a.inv.some((e) => itemDef(e)?.type === 'weapon' && !itemDef(e).bow)) {
            const melee = a.inv.find((e) => itemDef(e)?.type === 'weapon' && !itemDef(e).bow);
            a.equip.right = melee;
        } else {
            if (a.act.kind === 'idle' && ai.cool <= 0 && canSee(world, a, t)) { startDraw(world, a); ai.drawFor = BOW_FULL * 1.2 + world.rng.next() * 0.5; }
            if (a.act.kind === 'draw' && a.act.t >= (ai.drawFor || 1.2)) { releaseArrow(world, a); ai.cool = 0.8 + world.rng.next() * 1.4; }
            const want = d < 9 ? -1 : d > 24 ? 1 : 0;
            const l = d || 1;
            const side = Math.sin(ai.combatT * 0.5 + a.level) > 0 ? 1 : -1;
            ai.goal = { x: a.pos.x + dx / l * want * 5 - dz / l * side * 2, z: a.pos.z + dz / l * want * 5 + dx / l * side * 2, speed: a.speed * 0.7, stop: 0.3 };
            return;
        }
    } else if (!w && a.rig === 'humanoid' && a.equip.right == null) {
        // pick up a weapon again if we swapped away from a bow
        const bow = a.inv.find((e) => itemDef(e)?.bow);
        if (bow && d > 6) a.equip.right = bow;
    }
    // melee
    const giant = a.tpl === 'giant' || a.tpl === 'steam_colossus';
    if (d > reach * 0.9) {
        // beasts circle in; people close directly
        const l = d || 1;
        let gx = t.pos.x, gz = t.pos.z;
        if (ai.kind === 'beast' && d < 8 && ai.cool > 0) { const side = a.level % 2 ? 1 : -1; gx = t.pos.x - dz / l * 3 * side; gz = t.pos.z + dx / l * 3 * side; }
        ai.goal = { x: gx, z: gz, speed: a.speed * (d > 10 ? 1 : 0.85), stop: reach * 0.7 };
        if (world.space.path && (ai.repath || !ai.path || ai.pathT <= 0)) { ai.path = world.space.path(a.pos, t.pos); ai.pathT = 1; ai.repath = false; } else ai.pathT = (ai.pathT || 0) - 0.25;
        a.blocking = false;
    } else {
        ai.goal = null;
        ai.path = null;
        // block when the target winds up (shield users), sometimes bash back
        const tAttacking = t.act.kind === 'attack' && t.act.phase === 'wind';
        const shield = a.equip.left && itemDef(a.equip.left)?.slot === 'shield';
        if (tAttacking && (shield || w) && a.act.kind === 'idle' && world.rng.chance(shield ? 0.55 : 0.25) && a.rig === 'humanoid') { a.blocking = true; ai.blockT = 0.6 + world.rng.next() * 0.5; }
        if (a.blocking) {
            ai.blockT -= 0.25;
            if (ai.blockT <= 0) { a.blocking = false; if (shield && world.rng.chance(0.3)) startBash(world, a); }
            return;
        }
        if (a.act.kind === 'idle' && ai.cool <= 0 && a.sp > 5) {
            const power = (a.sp > a.spMax * 0.5 && world.rng.chance(giant ? 0.8 : 0.28)) || (ai.kind === 'beast' && world.rng.chance(0.2));
            if (startAttack(world, a, 'right', power)) ai.cool = (giant ? 1.6 : ai.kind === 'beast' ? 0.8 : 0.7) + world.rng.next() * (giant ? 1.2 : 0.9);
        }
        // wolves dart back after biting
        if (ai.kind === 'beast' && a.act.kind === 'attack' && a.act.phase === 'recover' && a.tpl !== 'bear' && world.rng.chance(0.4)) {
            const l = d || 1;
            ai.goal = { x: a.pos.x - dx / l * 3, z: a.pos.z - dz / l * 3, speed: a.speed, stop: 0.2 };
        }
    }
}

export function aimLead(world, a, t, speed) {
    const d = aimDir(world, a, t);
    return d;
}
