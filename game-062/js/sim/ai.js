// Monster brains. Every monster has a windup before any hit lands (the view shows it), so a
// player who is paying attention can always step out of the way. Bosses telegraph their big
// attacks as 'slam' areas on the floor.

import { AGGRO_RADIUS } from '../config.js';
import { walkable } from './tiles.js';
import { los, clearLine } from './path.js';
import { ELITE_MODS } from './data/monsters.js';

const rollDmg = (w, m, k = 1) => w.rng.range(m.def.dmg[0], m.def.dmg[1]) * m.dmgMul * k;

export function updateMonster(w, m, dt) {
    const h = w.hero, def = m.def;
    m.cd -= dt;
    m.special -= dt;
    m.anim += dt;
    const d = w.dist(m, h);

    // Windups in progress.
    if (m.act) {
        const a = m.act;
        a.t += dt;
        if (a.track) m.face = Math.atan2(h.y - m.y, h.x - m.x);
        if (a.charge && a.t >= a.hitAt) {
            const sp = a.speed * dt;
            const ox = m.x, oy = m.y;
            w.moveActor(m, Math.cos(a.ang) * sp, Math.sin(a.ang) * sp);
            m.moving = true;
            if (!a.fired && w.dist(m, h) < m.r + h.r + 0.25) { a.fired = true; w.damageHero(rollDmg(w, m, 1.6), 'phys', m); h.knock = { x: Math.cos(a.ang) * 4, y: Math.sin(a.ang) * 4, t: 0.18 }; }
            if (Math.hypot(m.x - ox, m.y - oy) < sp * 0.3) a.t = a.dur;   // hit a wall
        } else if (!a.fired && a.t >= a.hitAt) { a.fired = true; a.fire(); }
        if (a.t >= a.dur) m.act = null;
        return;
    }

    // Waking up.
    if (m.state === 'disguised') {
        if (d < 1.8 || m.hp < m.maxHp) { m.state = 'chase'; w.aggroPack(m); w.emit('mimicWake', { id: m.id, x: m.x, y: m.y }); }
        return;
    }
    if (m.state === 'sleep') {
        if (d < 9.5 && los(w.map, m.x, m.y, h.x, h.y)) { m.state = 'chase'; m.aggro = true; w.emit('bossWake', { id: m.id, mon: m.type, name: m.name, line: def.intro }); m.special = 2; }
        return;
    }
    if (!m.aggro && !h.dead) {
        const near = d < AGGRO_RADIUS * (m.elite ? 1.15 : 1);
        if (near && los(w.map, m.x, m.y, h.x, h.y)) { w.aggroPack(m); w.emit('alert', { id: m.id }); }
    }
    if (m.mods.includes('stinky') && m.aggro && (m.anim % 1.2) < dt) {
        w.areas.push({ id: w.id(), kind: 'stink', x: m.x, y: m.y, r: 1.6, t: 0, dur: 3, tick: 0.5, tickT: 0.3, owner: 'mon', dmg: 2.5 * m.dmgMul, elem: 'pois' });
        w.emit('stink', { x: m.x, y: m.y, r: 1.6, dur: 3 });
    }
    if (m.mods.includes('sticky') && m.moving && (m.anim % 0.7) < dt) {
        w.areas.push({ id: w.id(), kind: 'jamtrail', x: m.x, y: m.y, r: 0.9, t: 0, dur: 5, tick: 0.3, tickT: 0, owner: 'mon', dmg: 0, slow: true, elem: 'phys' });
        w.emit('jamtrail', { x: m.x, y: m.y, r: 0.9, dur: 5 });
    }

    if (!m.aggro || h.dead) { idle(w, m, dt); return; }
    const brain = BRAINS[def.ai] || BRAINS.melee;
    brain(w, m, dt, d);
}

function idle(w, m, dt) {
    if (m.def.ai === 'turret' || m.burrowed) return;
    m.wander.t -= dt;
    if (m.wander.t <= 0) {
        m.wander.t = w.rng.range(2, 5);
        const a = w.rng.range(0, 6.283), r = w.rng.range(0.5, 2);
        const x = m.home.x + Math.cos(a) * r, y = m.home.y + Math.sin(a) * r;
        if (walkable(w.tileAt(x, y)) && clearLine(w.map, m.x, m.y, x, y)) { m.wander.x = x; m.wander.y = y; }
    }
    if (Math.hypot(m.wander.x - m.x, m.wander.y - m.y) > 0.15) w.steer(m, m.wander.x, m.wander.y, m.speed * 0.35, dt);
}

function chase(w, m, dt, speedK = 1) {
    if (!w.steerToHero(m, dt, m.speed * w.speedMul(m) * speedK)) idle(w, m, dt);
}

function retreat(w, m, dt) {
    const h = w.hero;
    const a = Math.atan2(m.y - h.y, m.x - h.x);
    const tx = m.x + Math.cos(a) * 2, ty = m.y + Math.sin(a) * 2;
    if (walkable(w.tileAt(tx, ty))) w.steer(m, tx, ty, m.speed * 0.8 * w.speedMul(m), dt);
    m.face = Math.atan2(h.y - m.y, h.x - m.x);
}

/** Begin a windup; fire() runs when it lands. */
function windup(w, m, kind, hitAt, fire, extra = {}) {
    m.act = { kind, t: 0, hitAt, dur: hitAt + (extra.recover ?? 0.3), fired: false, fire, ...extra };
    m.face = Math.atan2(w.hero.y - m.y, w.hero.x - m.x);
    w.emit('monAttack', { id: m.id, kind, windup: hitAt, x: m.x, y: m.y });
}

function meleeSwing(w, m, k = 1) {
    const def = m.def;
    m.cd = def.cd * w.rng.range(0.85, 1.15);
    windup(w, m, 'melee', def.windup, () => {
        const h = w.hero;
        if (w.dist(m, h) <= def.range + h.r + 0.35 && !h.dead) w.damageHero(rollDmg(w, m, k), m.elem, m);
        w.emit('monSwing', { id: m.id, x: m.x, y: m.y, face: m.face });
    });
}

function shoot(w, m, opts = {}) {
    const def = m.def, h = w.hero;
    m.cd = def.cd * w.rng.range(0.85, 1.2);
    windup(w, m, 'shoot', def.windup, () => {
        const n = opts.n || 1, spread = opts.spread || 0;
        // Lead the target a little.
        const t = w.dist(m, h) / (def.projSpeed || 8);
        const lead = opts.lead ?? 0.4;
        const tx = h.x + (h.dir.x || 0) * h.st.moveSpeed * t * lead, ty = h.y + (h.dir.y || 0) * h.st.moveSpeed * t * lead;
        const base = Math.atan2(ty - m.y, tx - m.x);
        for (let i = 0; i < n; i++) {
            const ang = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
            w.spawnProj({
                owner: 'mon', proj: opts.proj || def.proj, x: m.x + Math.cos(ang) * 0.4, y: m.y + Math.sin(ang) * 0.4,
                vx: Math.cos(ang) * (def.projSpeed || 8), vy: Math.sin(ang) * (def.projSpeed || 8), dmg: rollDmg(w, m, opts.k || 1), elem: m.elem === 'phys' ? def.elem : m.elem,
                srcId: m.id, life: 2.2, puddle: !!def.puddle, radius: opts.radius || 0, boomerang: def.proj === 'peel', r: 0.22,
            });
        }
    }, { track: true });
}

function radial(w, m, n, proj, k = 1, speed = 8, phase = 0) {
    for (let i = 0; i < n; i++) {
        const ang = phase + (i / n) * Math.PI * 2;
        w.spawnProj({ owner: 'mon', proj, x: m.x + Math.cos(ang) * (m.r + 0.1), y: m.y + Math.sin(ang) * (m.r + 0.1), vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg: rollDmg(w, m, k), elem: m.elem, srcId: m.id, life: 2.4, r: 0.22 });
    }
}

function slam(w, m, x, y, r, delay, k, elem, extra = {}) {
    w.areas.push({ id: w.id(), kind: 'slam', x, y, r, t: 0, dur: delay, dmg: rollDmg(w, m, k), elem, srcId: m.id, ...extra });
    w.emit('telegraph', { x, y, r, dur: delay, elem });
}

function inMeleeRange(w, m, d) { return d <= m.def.range + w.hero.r + 0.1 && clearLine(w.map, m.x, m.y, w.hero.x, w.hero.y); }

function summon(w, m, type, n, rad = 2.5) {
    for (let i = 0; i < n; i++) {
        const s = w.freeSpotNear(m.x, m.y, rad, false);
        if (!s) continue;
        const c = w.spawnMon(type, s.x, s.y, { packId: m.packId, minion: true, lvlBonus: -1 });
        c.aggro = true; c.state = 'chase';
        w.emit('summon', { id: c.id, x: s.x, y: s.y });
    }
}

// ---------------------------------------------------------------------------- brains
const BRAINS = {
    melee(w, m, dt, d) {
        if (inMeleeRange(w, m, d)) { m.face = Math.atan2(w.hero.y - m.y, w.hero.x - m.x); if (m.cd <= 0) meleeSwing(w, m, m.mods.includes('bouncy') ? 1 : 1); return; }
        chase(w, m, dt);
    },

    swarm(w, m, dt, d) {
        const h = w.hero;
        if (inMeleeRange(w, m, d) && m.cd <= 0) { meleeSwing(w, m); return; }
        // Orbit and dart: aim at a jittered point around the hero.
        const t = w.time * 3 + m.id;
        const ox = Math.cos(t) * 1.1, oy = Math.sin(t * 1.3) * 1.1;
        if (d > 3) chase(w, m, dt);
        else w.steer(m, h.x + ox * (m.cd > 0 ? 1 : 0.2), h.y + oy * (m.cd > 0 ? 1 : 0.2), m.speed * w.speedMul(m), dt);
    },

    ranged(w, m, dt, d) {
        const h = w.hero, def = m.def;
        const see = d < def.range && los(w.map, m.x, m.y, h.x, h.y);
        if (see && d < def.keep - 1.5) { retreat(w, m, dt); if (m.cd <= 0 && d > 1.5) shoot(w, m); return; }
        if (see) { m.face = Math.atan2(h.y - m.y, h.x - m.x); if (m.cd <= 0) shoot(w, m); return; }
        chase(w, m, dt);
    },

    burrow(w, m, dt, d) {
        if (m.burrowed) {
            if (d < 1.5) { m.burrowed = false; m.st = 2.8; w.emit('surface', { id: m.id, x: m.x, y: m.y }); m.cd = 0.15; return; }
            chase(w, m, dt, 1.1);
            return;
        }
        m.st -= dt;
        if (m.st <= 0 && !m.act && d > 2.2) { m.burrowed = true; w.emit('burrow', { id: m.id, x: m.x, y: m.y }); return; }
        BRAINS.melee(w, m, dt, d);
    },

    shaman(w, m, dt, d) {
        // Revive a fallen friend, heal a hurt one, else lob spores from a distance.
        if (m.special <= 0) {
            const corpse = w.mons.find((o) => o.dead && !o.revived && !o.boss && o.type !== 'eggplant' && o.deadT > 0.8 && o.deadT < 12 && w.dist(o, m) < 6);
            if (corpse) {
                m.special = 5;
                windup(w, m, 'cast', 0.8, () => {
                    if (!corpse.dead) return;
                    corpse.dead = false; corpse.revived = true; corpse.hp = Math.round(corpse.maxHp * 0.6); corpse.aggro = true; corpse.state = 'chase'; corpse.deadT = 0;
                    w.emit('revive', { id: corpse.id, x: corpse.x, y: corpse.y, by: m.id });
                });
                return;
            }
            const hurt = w.mons.find((o) => !o.dead && o !== m && o.hp < o.maxHp * 0.6 && w.dist(o, m) < 6);
            if (hurt) {
                m.special = 4;
                windup(w, m, 'cast', 0.6, () => { hurt.hp = Math.min(hurt.maxHp, hurt.hp + hurt.maxHp * m.def.heal); w.emit('healMon', { id: hurt.id, x: hurt.x, y: hurt.y, by: m.id }); });
                return;
            }
        }
        BRAINS.ranged(w, m, dt, d);
    },

    kamikaze(w, m, dt, d) {
        if (d < 1.4 && !w.hero.dead) {
            windup(w, m, 'swell', m.def.windup, () => {
                const r = m.def.blast;
                w.emit('explode', { x: m.x, y: m.y, r, elem: 'pois', splat: true });
                if (w.dist(m, w.hero) < r + w.hero.r) w.damageHero(rollDmg(w, m), 'pois', m, { aoe: true });
                w.killMon(m, { self: true });
            }, { recover: 0.05 });
            return;
        }
        chase(w, m, dt);
    },

    turret(w, m, dt, d) {
        const h = w.hero, def = m.def;
        m.face = Math.atan2(h.y - m.y, h.x - m.x);
        if (m.cd <= 0 && d < def.range && los(w.map, m.x, m.y, h.x, h.y)) {
            m.cd = def.cd;
            windup(w, m, 'shoot', def.windup, () => { radial(w, m, def.needles, 'needle', 0.8, def.projSpeed, w.rng.range(0, 1)); }, {});
        }
    },

    charger(w, m, dt, d) {
        const h = w.hero;
        if (m.special <= 0 && d > 3 && d < 7.5 && clearLine(w.map, m.x, m.y, h.x, h.y, m.r)) {
            m.special = 6;
            const ang = Math.atan2(h.y - m.y, h.x - m.x);
            m.act = { kind: 'charge', t: 0, hitAt: 0.65, dur: 0.65 + 0.7, fired: false, charge: true, ang, speed: 9.5 };
            m.face = ang;
            w.emit('monAttack', { id: m.id, kind: 'charge', windup: 0.65, x: m.x, y: m.y, ang });
            return;
        }
        BRAINS.melee(w, m, dt, d);
    },

    caster(w, m, dt, d) {
        const h = w.hero;
        if (m.special <= 0 && d < 2.6) {
            // Blink away.
            for (let k = 0; k < 12; k++) {
                const a = w.rng.range(0, 6.283), r = w.rng.range(4, 6);
                const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
                if (w.passable(x, y, m.r, true) && walkable(w.tileAt(x, y)) && los(w.map, x, y, h.x, h.y)) {
                    w.emit('blink', { id: m.id, fx: m.x, fy: m.y, tx: x, ty: y });
                    m.x = x; m.y = y; m.special = 5; m.cd = Math.min(m.cd, 0.6);
                    return;
                }
            }
            m.special = 2;
        }
        BRAINS.ranged(w, m, dt, d);
    },

    brute(w, m, dt, d) {
        if (m.special <= 0 && d < 3) {
            m.special = 7;
            slam(w, m, m.x, m.y, 2.7, 1.1, 1.7, 'phys', { stun: 0.6 });
            windup(w, m, 'slam', 1.1, () => w.emit('monSwing', { id: m.id, x: m.x, y: m.y, face: m.face, big: true }), { recover: 0.4 });
            return;
        }
        if ((m.anim % 2.5) < dt) {
            w.areas.push({ id: w.id(), kind: 'stink', x: m.x, y: m.y, r: 1.4, t: 0, dur: 3.5, tick: 0.5, tickT: 0.4, owner: 'mon', dmg: 1.8 * m.dmgMul, elem: 'pois' });
            w.emit('stink', { x: m.x, y: m.y, r: 1.4, dur: 3.5 });
        }
        BRAINS.melee(w, m, dt, d);
    },

    mimic(w, m, dt, d) { BRAINS.melee(w, m, dt, d); },

    // ------------------------------------------------------------------------ bosses
    juicer(w, m, dt, d) {
        const h = w.hero;
        if (m.phase === 0 && m.hp < m.maxHp * 0.5) {
            m.phase = 1; m.speed *= 1.3; m.def = { ...m.def, cd: m.def.cd * 0.8 };
            w.emit('bossPhase', { id: m.id, line: 'MORE PULP!' });
            summon(w, m, 'grape', 4);
        }
        if (m.special <= 0) {
            m.special = m.phase ? 5 : 6.5;
            if (w.rng.chance(0.5) && d > 2.5 && clearLine(w.map, m.x, m.y, h.x, h.y, m.r * 0.8)) {
                const ang = Math.atan2(h.y - m.y, h.x - m.x);
                m.act = { kind: 'charge', t: 0, hitAt: 0.8, dur: 0.8 + 0.9, fired: false, charge: true, ang, speed: 11 };
                m.face = ang;
                w.emit('monAttack', { id: m.id, kind: 'charge', windup: 0.8, x: m.x, y: m.y, ang });
                w.emit('telegraphLine', { x: m.x, y: m.y, ang, len: 9, w: m.r * 2, dur: 0.8 });
            } else {
                windup(w, m, 'spray', 0.7, () => { radial(w, m, 14, 'juice', 0.7, 7.5, w.rng.range(0, 1)); setTimeoutSim(w, 0.35, () => !m.dead && radial(w, m, 14, 'juice', 0.7, 7.5, 0.22)); }, { recover: 0.6 });
            }
            return;
        }
        BRAINS.melee(w, m, dt, d);
    },

    mango(w, m, dt, d) {
        const h = w.hero;
        const frac = m.hp / m.maxHp;
        if ((m.phase === 0 && frac < 0.66) || (m.phase === 1 && frac < 0.33)) {
            m.phase++;
            w.emit('bossPhase', { id: m.id, line: m.phase === 1 ? 'Rise, my little peppers!' : 'I SHALL PICKLE YOU!' });
            summon(w, m, 'chili', 3 + m.phase);
        }
        if (m.special <= 0) {
            m.special = 6.5 - m.phase;
            if (w.rng.chance(0.55)) {
                windup(w, m, 'cast', 0.5, () => {
                    for (let i = 0; i < 4 + m.phase * 2; i++) {
                        const a = w.rng.range(0, 6.283), r = i === 0 ? 0 : w.rng.range(1.5, 4.5);
                        const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
                        if (walkable(w.tileAt(x, y))) slam(w, m, x, y, 1.5, 1.2 + i * 0.08, 1.1, 'fire');
                    }
                }, { recover: 0.4 });
            } else {
                windup(w, m, 'cast', 0.6, () => radial(w, m, 18, 'chutney', 0.8, 6.5, w.time), { recover: 0.4 });
            }
            return;
        }
        if (d < 2.5 && (m.anim % 6) < dt * 2) {
            BRAINS.caster(w, m, dt, d);
            return;
        }
        const see = los(w.map, m.x, m.y, h.x, h.y);
        if (see && d < 9) {
            if (d < 4) retreat(w, m, dt);
            m.face = Math.atan2(h.y - m.y, h.x - m.x);
            if (m.cd <= 0) shoot(w, m, { n: 3, spread: 0.5, radius: 1.1, proj: 'chutney' });
            return;
        }
        chase(w, m, dt);
    },

    durianlord(w, m, dt, d) {
        const h = w.hero;
        const frac = m.hp / m.maxHp;
        if ((m.phase === 0 && frac < 0.66) || (m.phase === 1 && frac < 0.33)) {
            m.phase++;
            w.emit('bossPhase', { id: m.id, line: m.phase === 1 ? 'Breathe deeply, little fruit!' : 'THE STINK IS ETERNAL!' });
            summon(w, m, m.phase === 1 ? 'durian' : 'chili', m.phase === 1 ? 1 : 4, 3.5);
            if (m.phase === 1) summon(w, m, 'grape', 3, 3.5);
            if (m.phase === 2) { m.speed *= 1.25; }
        }
        if ((m.anim % (3.2 - m.phase * 0.6)) < dt) {
            w.areas.push({ id: w.id(), kind: 'stink', x: m.x, y: m.y, r: 2.2, t: 0, dur: 4, tick: 0.5, tickT: 0.5, owner: 'mon', dmg: 2.4 * m.dmgMul * 0.25, elem: 'pois' });
            w.emit('stink', { x: m.x, y: m.y, r: 2.2, dur: 5 });
        }
        if (m.special <= 0) {
            m.special = 5.5 - m.phase * 0.8;
            const r = w.rng.next();
            if (r < 0.34) {
                // Stink nova: get out of the big circle.
                slam(w, m, m.x, m.y, 5.2, 1.6, 1.4, 'pois');
                windup(w, m, 'nova', 1.6, () => w.emit('monSwing', { id: m.id, x: m.x, y: m.y, face: m.face, big: true }), { recover: 0.5 });
            } else if (r < 0.67) {
                windup(w, m, 'cast', 0.7, () => { radial(w, m, 16 + m.phase * 4, 'spike', 0.7, 7.5, w.time); if (m.phase) setTimeoutSim(w, 0.45, () => !m.dead && radial(w, m, 16, 'spike', 0.7, 7.5, w.time + 0.2)); }, { recover: 0.5 });
            } else {
                // Spike rain around the hero.
                windup(w, m, 'cast', 0.5, () => {
                    for (let i = 0; i < 5 + m.phase * 2; i++) {
                        const a = w.rng.range(0, 6.283), rr = i === 0 ? 0 : w.rng.range(1.2, 4);
                        const x = h.x + Math.cos(a) * rr, y = h.y + Math.sin(a) * rr;
                        if (walkable(w.tileAt(x, y))) slam(w, m, x, y, 1.4, 1.1 + i * 0.07, 1.0, 'phys');
                    }
                }, { recover: 0.4 });
            }
            return;
        }
        if (inMeleeRange(w, m, d) && m.cd <= 0) {
            m.cd = m.def.cd;
            const ang = Math.atan2(h.y - m.y, h.x - m.x);
            const x = m.x + Math.cos(ang) * 1.6, y = m.y + Math.sin(ang) * 1.6;
            slam(w, m, x, y, 1.9, m.def.windup, 1.1, 'phys');
            windup(w, m, 'melee', m.def.windup, () => w.emit('monSwing', { id: m.id, x: m.x, y: m.y, face: m.face }));
            return;
        }
        chase(w, m, dt);
    },
};

function setTimeoutSim(w, t, fn) { w.later(t, fn); }

export { ELITE_MODS };
