// GIANT'S VAULT: the 21 skills as rules over a few effect types, plus projectiles, ground zones and summons. Pure.
// useSkill(G, id, aim) is the only way a skill happens: the player's input, the bot and the tests all call it.

import { SKILLS, skillVal } from './data/masteries.js';
import { rankOf, resOf } from './stats.js';
import { hitMonster, weaponRoll, gainRes, heal, hurtPlayer } from './combat.js';
import { lastFit, moveBody, isFloor, fits } from './world.js';
import { MON } from '../config.js';

const alive = (m) => m.life > 0 && m.state !== 'dead';
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The monster an 'enemy'-targeted skill picks: nearest to the aim point (within 2.5 m), else nearest to the player. */
export function pickTarget(G, aim, range) {
    const P = G.player;
    let best = null, bd = Infinity;
    for (const m of G.mons) {
        if (!alive(m) || dist(m, P) > range + m.radius) continue;
        const d = aim ? Math.hypot(m.x - aim.x, m.y - aim.y) : dist(m, P);
        if (d < bd) { bd = d; best = m; }
    }
    if (best && aim && bd > 2.5 + best.radius) {
        // nothing at the aim point: the nearest enemy within 70° of where we aim
        const fa = Math.atan2(aim.y - P.y, aim.x - P.x);
        let b2 = null, d2 = Infinity;
        for (const m of G.mons) {
            if (!alive(m)) continue;
            const d = dist(m, P);
            if (d > range + m.radius) continue;
            let da = Math.abs(Math.atan2(m.y - P.y, m.x - P.x) - fa);
            if (da > Math.PI) da = 2 * Math.PI - da;
            if (da < 0.61 && d < d2) { d2 = d; b2 = m; }
        }
        return b2 || best;
    }
    return best;
}

/** How long using a skill holds the player still. */
function castTime(G, S) {
    const s = G.player.stats;
    if (S.attack) return 1 / s.atkRate;
    if (S.fx.type === 'leap' || S.fx.type === 'blink') return 0.3;
    return 0.4 / (1 + s.atkSpeedPct / 100);
}

/** Why the skill can't be used right now ('' if it can). Range checks are the caller's. */
export function skillBlocked(G, id) {
    const P = G.player, S = SKILLS[id];
    if (!S || S.kind !== 'active') return 'not an active skill';
    const r = rankOf(G, id);
    if (!r) return 'not learned';
    if ((P.cds[id] || 0) > 0) return 'cooldown';
    if (P.busy > 0 && !S.channel) return 'busy';
    const cost = costOf(G, id);
    const res = resOf(id);
    if (S.spendAll ? P.res[res] < S.cost : P.res[res] < cost) return `not enough ${res}`;
    return '';
}

export function costOf(G, id) {
    const S = SKILLS[id], P = G.player;
    if (id === 'leap' && P.stats.powers.leapFree) return 0;
    return S.cost || 0;
}

/** Use a skill toward an aim point. Returns '' on success or the reason it was not used. */
export function useSkill(G, id, aim) {
    const why = skillBlocked(G, id);
    if (why) return why;
    const P = G.player, S = SKILLS[id], r = rankOf(G, id), fx = S.fx;
    const v = (k) => skillVal(id, k, r);
    const res = resOf(id);
    aim = aim || { x: P.x + Math.cos(P.face), y: P.y + Math.sin(P.face) };
    // targeted skills need a target in range
    let target = null;
    if (S.target === 'enemy' || fx.type === 'beam' || fx.type === 'chain') {
        target = pickTarget(G, aim, fx.range || 7);
        if (!target) return 'no target';
    }
    if (fx.type === 'arc') {
        const reach = fx.radius + 0.6;
        if (!G.mons.some((m) => alive(m) && dist(m, P) < reach + m.radius)) return 'no target';
    }
    const tx = target ? target.x : aim.x, ty = target ? target.y : aim.y;
    P.face = Math.atan2(ty - P.y, tx - P.x);
    // pay
    let spent = costOf(G, id);
    if (S.spendAll) spent = P.res[res];
    P.res[res] -= spent;
    if (S.cd) P.cds[id] = S.cd * (1 - P.stats.cdrPct / 100) * (id === 'wrath' && P.stats.powers.wrathCd ? 0.5 : 1);
    P.busy = castTime(G, S);
    P.combatT = 0;
    G.stats.casts[id] = (G.stats.casts[id] || 0) + 1;
    G.events.push({ type: 'cast', skill: id, x: P.x, y: P.y, tx, ty });

    const el = S.el;
    switch (fx.type) {
        case 'arc': {
            const lightning = P.stats.powers.cleaveArc;
            let hits = 0;
            const hit = [];
            for (const m of G.mons) {
                if (!alive(m)) continue;
                const d = dist(m, P);
                if (d > fx.radius + m.radius) continue;
                let da = Math.abs(Math.atan2(m.y - P.y, m.x - P.x) - P.face);
                if (da > Math.PI) da = 2 * Math.PI - da;
                if (da > fx.angle / 2 && d > m.radius + 0.5) continue;
                hitMonster(G, m, weaponRoll(G) * v('mult'), { el: lightning ? 'lightning' : el, skill: id });
                hit.push(m.id);
                hits++;
                if (P.synergy === 'galvanic' && G.rng() < 0.2) chainFrom(G, m, 0.6 * skillVal('chain', 'mult', Math.max(1, rankOf(G, 'chain'))), 2, hit);
            }
            if (lightning && hits) {
                // arcs to 2 more enemies beyond the swing
                let from = G.mons.find((m) => m.id === hit[0]);
                for (let k = 0; k < 2 && from; k++) {
                    const n = nearestUnhit(G, from, 6, hit);
                    if (!n) break;
                    hitMonster(G, n, weaponRoll(G) * v('mult') * 0.8, { el: 'lightning', skill: id });
                    G.events.push({ type: 'arc', x0: from.x, y0: from.y, x1: n.x, y1: n.y });
                    hit.push(n.id); from = n;
                }
            }
            gainRes(G, 'rage', (S.gain || 0) + fx.gainPerHit * Math.min(hits, 6));
            if (P.stats.powers.wrathCd) {
                P.cleaveCount = (P.cleaveCount || 0) + 1;
                if (P.cleaveCount % 3 === 0) nova(G, P.x, P.y, 3.6, 2.0, 'phys', { skill: id });
            }
            break;
        }
        case 'leap': {
            const d = Math.min(fx.range, Math.hypot(aim.x - P.x, aim.y - P.y));
            const land = lastFit(G.area, P.x, P.y, P.x + Math.cos(P.face) * d, P.y + Math.sin(P.face) * d, 0.42);
            G.events.push({ type: 'leap', x0: P.x, y0: P.y, x: land.x, y: land.y });
            P.x = land.x; P.y = land.y;
            nova(G, P.x, P.y, v('radius'), v('mult'), 'phys', { stagger: fx.stagger, skill: id });
            if (P.synergy === 'bloodpact') raiseShade(G, P.x, P.y, true);
            break;
        }
        case 'buff': {
            if (fx.buff === 'warcry') {
                addBuff(G, { k: 'warcry', t: fx.dur, dmgPct: v('dmgPct') });
                for (const m of G.mons) if (alive(m) && dist(m, P) < fx.radius) { m.taunt = fx.taunt; m.tauntBy = null; m.aggro = true; m.armorBreak = { t: fx.dur }; }
                if (P.stats.powers.bulwark) { addBuff(G, { k: 'bulwark', t: fx.dur }); P.cds.leap = 0; }
            } else if (fx.buff === 'shield') {
                addBuff(G, { k: 'shield', t: fx.dur, hp: (P.stats.maxLife * v('shieldPct')) / 100, zap: v('zap') });
            } else if (fx.buff === 'tempest') {
                addBuff(G, { k: 'tempest', t: fx.dur, next: 0, every: fx.every, mult: v('mult'), range: fx.range });
            }
            break;
        }
        case 'channel':
            P.channel = id; P.channelTick = 0; P.busy = 0;
            break;
        case 'nova': {
            let mult = v('mult');
            if (id === 'wrath') mult *= 1 + Math.max(0, spent - 50) * fx.perRage;
            nova(G, P.x, P.y, fx.radius, mult, el, { stun: fx.stun, killHeal: fx.killHeal, skill: id, stagger: 1 });
            break;
        }
        case 'proj': {
            const split = id === 'spark' && P.stats.powers.sparkSplit;
            fireShot(G, P.x, P.y, P.face, { speed: fx.speed, range: fx.range, r: fx.radius, mult: v('mult'), el, pierce: Math.floor(v('pierce')) + (split ? 2 : 0), kind: id, split });
            break;
        }
        case 'chain': {
            const more = P.stats.powers.chainMore;
            const hit = [target.id];
            hitMonster(G, target, weaponRoll(G) * v('mult'), { el, skill: id });
            G.events.push({ type: 'arc', x0: P.x, y0: P.y, x1: target.x, y1: target.y });
            chainFrom(G, target, v('mult'), Math.floor(v('bounces')) + (more ? 3 : 0), hit, more ? 1.15 : 1, fx.hop);
            break;
        }
        case 'ground': {
            const d = Math.min(fx.range, Math.hypot(aim.x - P.x, aim.y - P.y));
            const p = lastFit(G.area, P.x, P.y, P.x + Math.cos(P.face) * d, P.y + Math.sin(P.face) * d, 0);
            const times = P.stats.powers.thunderThrice ? 3 : 1;
            for (let k = 0; k < times; k++) G.zones.push({ id: G.nextId++, x: p.x, y: p.y, r: fx.radius, t: fx.delay + k * 0.45, mult: v('mult'), el, from: 'player', kind: id, stagger: fx.stagger });
            break;
        }
        case 'beam': {
            const targets = [target];
            if (P.stats.powers.rendSplit) {
                const hit = [target.id];
                for (let k = 0; k < 2; k++) { const n = nearestUnhit(G, P, fx.range, hit); if (!n) break; targets.push(n); hit.push(n.id); }
            }
            for (const t of targets) {
                const dealt = hitMonster(G, t, weaponRoll(G) * v('mult'), { el, skill: id });
                heal(G, dealt * v('heal'));
                if (P.stats.powers.rendSplit) { healAllies(G, dealt * v('heal')); }
                G.events.push({ type: 'beam', x0: P.x, y0: P.y, x1: t.x, y1: t.y });
            }
            gainRes(G, 'essence', S.gain || 0);
            break;
        }
        case 'blink': {
            const d = Math.min(fx.range, Math.hypot(aim.x - P.x, aim.y - P.y));
            const x0 = P.x, y0 = P.y;
            const land = lastFit(G.area, P.x, P.y, P.x + Math.cos(P.face) * d, P.y + Math.sin(P.face) * d, 0.42);
            P.x = land.x; P.y = land.y;
            addBuff(G, { k: 'dr', t: fx.dur, pct: v('dr') });
            G.events.push({ type: 'blink', x0, y0, x: P.x, y: P.y, player: true });
            if (P.stats.powers.stepDecoy) G.minions.push({ id: G.nextId++, kind: 'decoy', x: x0, y: y0, life: 1e9, max: 1e9, t: 2, cd: 0 });
            if (P.stats.powers.skystep) {
                for (const at of [{ x: x0, y: y0 }, P]) {
                    const t = nearestUnhit(G, at, 9, []);
                    if (t) { hitMonster(G, t, weaponRoll(G) * 1.7, { el: 'lightning', skill: 'chain' }); chainFrom(G, t, 1.7, 3, [t.id]); }
                }
            }
            break;
        }
        case 'summon':
            raiseShade(G, P.x + Math.cos(P.face) * 1.2, P.y + Math.sin(P.face) * 1.2, false, r);
            break;
        case 'curse': {
            const d = Math.min(fx.range, Math.hypot(aim.x - P.x, aim.y - P.y));
            const cx = P.x + Math.cos(P.face) * d, cy = P.y + Math.sin(P.face) * d;
            for (const m of G.mons) if (alive(m) && Math.hypot(m.x - cx, m.y - cy) < fx.radius + m.radius) { m.curse = { pct: v('vulnPct'), t: fx.dur, slow: fx.slow }; m.aggro = true; }
            G.events.push({ type: 'curse', x: cx, y: cy, r: fx.radius });
            break;
        }
    }
    return '';
}

function addBuff(G, b) {
    const P = G.player;
    P.buffs = P.buffs.filter((x) => x.k !== b.k);
    P.buffs.push(b);
    G.events.push({ type: 'buff', k: b.k });
}

function nearestUnhit(G, from, range, hit) {
    let best = null, bd = range;
    for (const m of G.mons) {
        if (!alive(m) || hit.includes(m.id)) continue;
        const d = dist(m, from);
        if (d < bd) { bd = d; best = m; }
    }
    return best;
}

function chainFrom(G, from, mult, bounces, hit, grow = 1, hop = 6) {
    let cur = from, m = mult;
    for (let k = 0; k < bounces; k++) {
        let next = nearestUnhit(G, cur, hop, hit);
        // Void Current: lightning also bounces off the player's shades (each shade bounce finds a new target)
        if (!next && G.player.synergy === 'voidcurrent') {
            const s = G.minions.find((x) => x.kind === 'shade' && !hit.includes(x.id) && dist(x, cur) < hop);
            if (s) { hit.push(s.id); G.events.push({ type: 'arc', x0: cur.x, y0: cur.y, x1: s.x, y1: s.y }); cur = s; continue; }
        }
        if (!next) break;
        m *= grow;
        hitMonster(G, next, weaponRoll(G) * m, { el: 'lightning', skill: 'chain', proc: true });
        G.events.push({ type: 'arc', x0: cur.x, y0: cur.y, x1: next.x, y1: next.y });
        hit.push(next.id);
        cur = next;
    }
}

export function nova(G, x, y, r, mult, el, opts = {}) {
    G.events.push({ type: 'nova', x, y, r, el, skill: opts.skill });
    for (const m of G.mons.slice()) {
        if (!alive(m) || Math.hypot(m.x - x, m.y - y) > r + m.radius) continue;
        hitMonster(G, m, weaponRoll(G) * mult, { el, ...opts });
    }
}

function fireShot(G, x, y, a, o) {
    G.shots.push({
        id: G.nextId++, from: 'player', x: x + Math.cos(a) * 0.5, y: y + Math.sin(a) * 0.5, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed,
        r: o.r, mult: o.mult, el: o.el, pierce: o.pierce, hit: [], range: o.range, kind: o.kind, split: !!o.split, src: o.src || 'player',
    });
}

function raiseShade(G, x, y, free = false, rank) {
    const P = G.player;
    const r = rank || Math.max(1, rankOf(G, 'shade'));
    const max = Math.floor(skillVal('shade', 'max', r)) + (P.stats.powers.shadeArmy ? 2 : 0);
    const shades = G.minions.filter((s) => s.kind === 'shade');
    if (shades.length >= max) {
        if (free) return;
        // the oldest shade makes way
        const old = shades.reduce((a, b) => (a.t < b.t ? a : b));
        expireMinion(G, old);
    }
    if (!fits(G.area, x, y, 0.4)) { x = P.x; y = P.y; }
    const life = (P.stats.maxLife * skillVal('shade', 'hpPct', r)) / 100;
    G.minions.push({ id: G.nextId++, kind: 'shade', x, y, life, max: life, t: SKILLS.shade.fx.life, cd: 0.4, mult: skillVal('shade', 'mult', r), sparkT: 2 });
    G.events.push({ type: 'shade', x, y });
}

function healAllies(G, amt) {
    for (const s of G.minions) if (s.kind === 'shade') s.life = Math.min(s.max, s.life + amt);
    const pet = G.pet;
    if (pet.state !== 'away') pet.life = Math.min(pet.max, pet.life + amt);
}

function expireMinion(G, s) {
    const i = G.minions.indexOf(s);
    if (i < 0) return;
    G.minions.splice(i, 1);
    if (s.kind === 'shade' && G.player.stats.powers.shadeArmy) nova(G, s.x, s.y, 2.5, 1.5, 'shadow', { src: 'shade' });
    if (s.kind === 'decoy') nova(G, s.x, s.y, 3, 2.5, 'shadow', {});
    G.events.push({ type: 'minionGone', id: s.id, kind: s.kind, x: s.x, y: s.y });
}

// ------------------------------------------------------------------------------------------------------ per step

/** Buffs, channels, cooldowns and resource regeneration. inp.held[] says which slots are held (for channels). */
export function stepPlayerSkills(G, dt, channelHeld) {
    const P = G.player, s = P.stats;
    for (const k in P.cds) if (P.cds[k] > 0) P.cds[k] = Math.max(0, P.cds[k] - dt);
    P.busy = Math.max(0, P.busy - dt);
    // resources
    if (P.masteries.includes('storm')) gainRes(G, 'mana', 7 * (1 + (s.manaRegenPct || 0) / 100) * dt);
    if (P.masteries.includes('umbra')) gainRes(G, 'essence', 1.5 * dt);
    P.combatT = (P.combatT || 0) + dt;
    if (P.combatT > 3) P.res.rage = Math.max(0, P.res.rage - 7 * dt);
    if (s.lifeRegen) heal(G, s.lifeRegen * dt);
    // buffs
    for (let i = P.buffs.length - 1; i >= 0; i--) {
        const b = P.buffs[i];
        b.t -= dt;
        if (b.k === 'tempest') {
            b.next -= dt;
            if (b.next <= 0) {
                b.next = b.every;
                const near = G.mons.filter((m) => alive(m) && dist(m, P) < b.range);
                if (near.length) {
                    const m = near[Math.floor(G.rng() * near.length)];
                    hitMonster(G, m, weaponRoll(G) * b.mult, { el: 'lightning', skill: 'tempest' });
                    G.events.push({ type: 'bolt', x: m.x, y: m.y });
                }
            }
        }
        if (b.t <= 0) P.buffs.splice(i, 1);
    }
    // the channel (Whirlwind) runs while its button is held and Rage lasts
    if (P.channel) {
        const S = SKILLS[P.channel];
        if (!channelHeld || P.res.rage <= 0 || P.life <= 0) { P.channel = null; }
        else {
            P.res.rage = Math.max(0, P.res.rage - S.drain * dt);
            P.combatT = 0;
            P.channelTick -= dt;
            if (P.channelTick <= 0) {
                P.channelTick = S.fx.tick / (1 + s.atkSpeedPct / 200);
                const r = rankOf(G, P.channel);
                nova(G, P.x, P.y, S.fx.radius, skillVal(P.channel, 'mult', r), S.el, { skill: P.channel });
                if (s.powers.whirlSpark) {
                    const t = nearestUnhit(G, P, 9, []);
                    if (t) fireShot(G, P.x, P.y, Math.atan2(t.y - P.y, t.x - P.x), { speed: 20, range: 12, r: 0.35, mult: 1.0, el: 'lightning', pierce: 0, kind: 'spark' });
                }
            }
        }
    }
}

export function stepShots(G, dt) {
    const A = G.area, P = G.player;
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const b = G.shots[i];
        const step = Math.hypot(b.vx, b.vy) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.range -= step;
        let dead = b.range <= 0 || !isFloor(A, b.x, b.y);
        if (!dead && b.from === 'mon') {
            if (P.life > 0 && Math.hypot(P.x - b.x, P.y - b.y) < b.r + 0.42) {
                const src = G.mons.find((m) => m.id === b.src);
                const got = hurtPlayer(G, b.dmg, b.el, b.lvl, src);
                if (Math.hypot(b.vx, b.vy) <= MON.dodgeSpeed) G.stats.dodgeable = (G.stats.dodgeable || 0) + got;
                dead = true;
            } else {
                const pet = G.pet;
                if ((pet.state === 'follow' || pet.state === 'fight') && Math.hypot(pet.x - b.x, pet.y - b.y) < b.r + 0.5) { pet.life -= b.dmg * 0.5; dead = true; }
            }
        } else if (!dead) {
            for (const m of G.mons) {
                if (!alive(m) || b.hit.includes(m.id)) continue;
                if (Math.hypot(m.x - b.x, m.y - b.y) > b.r + m.radius) continue;
                b.hit.push(m.id);
                hitMonster(G, m, weaponRoll(G) * b.mult, { el: b.el, skill: b.kind, src: b.src === 'shade' ? 'shade' : 'player', proc: b.src === 'shade' });
                if (b.split) {
                    b.split = false;
                    const a = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
                    for (const da of [-0.5, 0.5]) G.shots.push({ ...b, id: G.nextId++, vx: Math.cos(a + da) * sp, vy: Math.sin(a + da) * sp, hit: b.hit.slice(), pierce: 0, split: false, range: 8 });
                }
                if (b.pierce-- <= 0) { dead = true; break; }
            }
        }
        if (dead) { G.shots.splice(i, 1); G.events.push({ type: 'shotEnd', id: b.id, x: b.x, y: b.y, kind: b.kind, from: b.from }); }
    }
}

export function stepZones(G, dt) {
    const P = G.player;
    for (let i = G.zones.length - 1; i >= 0; i--) {
        const z = G.zones[i];
        z.t -= dt;
        if (z.t > 0) continue;
        G.zones.splice(i, 1);
        G.events.push({ type: 'zone', x: z.x, y: z.y, r: z.r, kind: z.kind, from: z.from, el: z.el });
        if (z.from === 'mon') {
            // telegraphed damage: what a careful player steps out of (the bot's skill dial is measured on it)
            if (P.life > 0 && Math.hypot(P.x - z.x, P.y - z.y) < z.r + 0.42) G.stats.dodgeable = (G.stats.dodgeable || 0) + hurtPlayer(G, z.dmg, z.el, z.lvl, G.mons.find((m) => m.id === z.src));
            for (const s of G.minions) if (Math.hypot(s.x - z.x, s.y - z.y) < z.r) s.life -= z.dmg * 0.5;
        } else {
            for (const m of G.mons.slice()) {
                if (!alive(m) || Math.hypot(m.x - z.x, m.y - z.y) > z.r + m.radius) continue;
                hitMonster(G, m, weaponRoll(G) * z.mult, { el: z.el, skill: z.kind, stagger: z.stagger });
            }
        }
    }
}

/** Shades follow the player and fight; decoys stand and draw monsters. */
export function stepMinions(G, dt) {
    const P = G.player, A = G.area;
    for (let i = G.minions.length - 1; i >= 0; i--) {
        const s = G.minions[i];
        s.t -= dt;
        if (s.t <= 0 || s.life <= 0) { expireMinion(G, s); continue; }
        if (s.kind === 'decoy') {
            for (const m of G.mons) if (alive(m) && dist(m, s) < 6) { m.taunt = 0.3; m.tauntBy = s.id; }
            continue;
        }
        s.cd -= dt;
        // Void Current: shades throw Spark Bolts
        if (P.synergy === 'voidcurrent' && (s.sparkT -= dt) <= 0) {
            s.sparkT = 2;
            const t = nearestUnhit(G, s, 10, []);
            if (t) fireShot(G, s.x, s.y, Math.atan2(t.y - s.y, t.x - s.x), { speed: 18, range: 12, r: 0.35, mult: 0.9, el: 'lightning', pierce: 0, kind: 'spark', src: 'shade' });
        }
        const t = nearestUnhit(G, s, 9, []);
        let gx = P.x, gy = P.y, want = 2;
        if (t && dist(t, P) < 14) { gx = t.x; gy = t.y; want = 1.0 + t.radius; }
        const d = Math.hypot(gx - s.x, gy - s.y);
        if (d > want) moveBody(A, s, ((gx - s.x) / d) * 6 * dt, ((gy - s.y) / d) * 6 * dt, 0.35);
        else if (t && s.cd <= 0) {
            s.cd = 1.0;
            hitMonster(G, t, weaponRoll(G) * s.mult, { el: 'shadow', src: 'shade', proc: true });
        }
        if (dist(s, P) > 20) { s.x = P.x; s.y = P.y; }
    }
}

