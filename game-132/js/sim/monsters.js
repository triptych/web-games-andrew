// GIANT'S VAULT: spawning packs, elites and bosses; monster AI. Pure.
//
// AI states: idle → chase → wind (an attack winding up; big ones draw a red ring) → back to chase.
// stagger and stun cancel a wind-up. Monsters walk down a flow field toward the player, so walls never trap them.
// Only monsters within ACTIVE metres of the player think; the rest sleep, which keeps a 60 m dungeon cheap.

import { MON, RIFT } from '../config.js';
import { MONSTERS, BOSSES, ELITE_AFFIXES, ACT_MONSTERS } from './data/monsters.js';
import { AREAS, RIFT_MODS } from './data/world.js';
import { moveBody, fits, los, clearPath, flow, downhill } from './world.js';
import { hurtPlayer, monsterHit, monDef } from './combat.js';

const ACTIVE = 26;

function scaleFor(G) {
    const r = G.rift;
    if (!r) return { hp: 1, dmg: 1, speed: 1, density: 1, elite: 1 };
    const mods = r.mods.map((k) => RIFT_MODS[k]);
    const m = (k, d = 1) => mods.reduce((a, x) => a * (x[k] || 1), d);
    return {
        hp: Math.pow(RIFT.hpPerTier, r.tier - 1) * m('hp'), dmg: Math.pow(RIFT.dmgPerTier, r.tier - 1) * m('dmg'),
        speed: m('speed'), density: m('density'), elite: m('elite'),
    };
}

export function makeMonster(G, kind, x, y, lvl, extra = {}) {
    const boss = extra.boss;
    const def = boss ? BOSSES[boss] : MONSTERS[kind];
    const sc = scaleFor(G);
    let hp = MON.hp(lvl) * def.hp * sc.hp, dmg = MON.dmg(lvl) * def.dmg * sc.dmg, speed = def.speed * sc.speed, atk = def.atk;
    const elite = extra.elite || null;
    if (elite) {
        hp *= elite.minion ? 1.6 : MON.eliteHp;
        dmg *= elite.minion ? 1.1 : MON.eliteDmg;
        for (const a of elite.affixes) {
            const A = ELITE_AFFIXES[a];
            if (A.speed) speed *= A.speed;
            if (A.atk) atk *= A.atk;
            if (A.dmg) dmg *= A.dmg;
        }
    }
    const m = {
        id: G.nextId++, kind: boss ? boss : kind, boss: boss || null, x, y, face: 0, lvl,
        life: Math.round(hp), max: Math.round(hp), dmg, speed, atk, radius: def.radius, reach: def.reach,
        state: 'idle', t: 0, cd: G.rng() * atk, aggro: !!extra.aggro, elite, hx: x, hy: y,
        shock: null, curse: null, taunt: 0, hitT: 0, novaT: 4, swings: 0, heavy: false, phase: 0, abilityT: 2.5, chargeT: 0,
    };
    G.mons.push(m);
    return m;
}

/** Fill an area with packs from its spawn points. */
export function populate(G) {
    const A = G.area, def = AREAS[A.id];
    if (A.kind === 'town') return;
    const rng = G.rng, sc = scaleFor(G);
    const act = def.act === 4 ? 1 + ((A.seed >>> 0) % 3) : def.act;
    const kinds = def.act === 4 ? [...ACT_MONSTERS[1], ...ACT_MONSTERS[2], ...ACT_MONSTERS[3]] : ACT_MONSTERS[act];
    const floorCells = A.grid.reduce((n, c) => n + c, 0);
    const packs = Math.round((floorCells / 100) * def.density * sc.density * 0.42);
    const maxD = Math.max(1, ...A.spawns.map((p) => p.d));
    const pts = A.spawns.slice();
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    const lvlAt = (p) => {
        if (G.rift) return RIFT.baseLevel + (G.rift.tier - 1) * RIFT.levelPerTier;
        return Math.round(def.lvl[0] + (def.lvl[1] - def.lvl[0]) * (p.d / maxD));
    };
    for (let k = 0; k < packs && k < pts.length; k++) {
        const p = pts[k], lvl = lvlAt(p);
        const kind = rng.pick(kinds), M = MONSTERS[kind];
        const roll = rng();
        if (roll < MON.eliteChance * sc.elite * 0.5) {
            // a rare (yellow) with minions
            const affixes = pickAffixes(rng, 2);
            makeMonster(G, kind, p.x, p.y, lvl, { elite: { tier: 'rare', affixes, name: rareName(rng, M.name) } });
            const n = rng.int(MON.rareMinions[0], MON.rareMinions[1]);
            for (let i = 0; i < n; i++) placeNear(G, kind, p, lvl, { elite: { tier: 'minion', minion: true, affixes: [] } });
        } else if (roll < MON.eliteChance * sc.elite) {
            // a champion (blue) pack: all share one affix
            const affixes = pickAffixes(rng, 1);
            const n = rng.int(MON.champions[0], MON.champions[1]);
            for (let i = 0; i < n; i++) placeNear(G, kind, p, lvl, { elite: { tier: 'champion', affixes } });
        } else {
            const n = M.pack ? rng.int(4, 6) : rng.int(3, 5);
            for (let i = 0; i < n; i++) placeNear(G, i === 0 || rng() < 0.7 ? kind : rng.pick(kinds), p, lvl);
        }
    }
    if (A.bossAt && def.boss && !G.player.bossesKilled.includes(def.boss)) {
        // the boss stands in its room on a spot big enough for it, as near the exit as there is one
        const r = BOSSES[def.boss].radius * 0.8;
        let best = A.bossAt, bd = Infinity;
        for (let y = 1; y < A.h - 1; y++) for (let x = 1; x < A.w - 1; x++) {
            const d = Math.hypot(x + 0.5 - A.bossAt.x, y + 0.5 - A.bossAt.y);
            if (d < bd && d < 12 && fits(A, x + 0.5, y + 0.5, r)) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
        }
        makeMonster(G, null, best.x, best.y, def.lvl[1] + 1, { boss: def.boss });
    }
}

function pickAffixes(rng, n) {
    const all = Object.keys(ELITE_AFFIXES), out = [];
    while (out.length < n) { const a = rng.pick(all); if (!out.includes(a)) out.push(a); }
    return out;
}
function rareName(rng, base) {
    const a = ['Gloom', 'Rot', 'Grave', 'Storm', 'Blood', 'Bone', 'Ash', 'Dread'], b = ['maw', 'fang', 'hide', 'claw', 'eye', 'heart'];
    return `${rng.pick(a)}${rng.pick(b)} the ${base}`;
}

function placeNear(G, kind, p, lvl, extra = {}) {
    const M = MONSTERS[kind];
    for (let t = 0; t < 12; t++) {
        const a = G.rng() * Math.PI * 2, d = t === 0 ? 0 : 0.8 + G.rng() * 2.2;
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (fits(G.area, x, y, M.radius)) return makeMonster(G, kind, x, y, lvl, extra);
    }
    return null;
}

/** The flow field toward the player's cell, cached until the player changes cell (it is a pure function of G). */
function playerFlow(G) {
    const P = G.player, cx = Math.floor(P.x), cy = Math.floor(P.y);
    const c = G._flow;
    if (c && c.cx === cx && c.cy === cy && c.area === G.area.uid) return c.d;
    const d = flow(G.area, cx, cy);
    G._flow = { cx, cy, area: G.area.uid, d };
    return d;
}

/** The target a monster goes for: the player, or a taunting decoy / pet / shade nearby. */
function targetOf(G, m) {
    const P = G.player;
    if (m.taunt > 0 && m.tauntBy) {
        const t = G.minions.find((s) => s.id === m.tauntBy) || (G.pet.id === m.tauntBy && G.pet.state !== 'down' && G.pet.state !== 'away' ? G.pet : null);
        if (t) return t;
    }
    // minions and the pet draw monsters that are closer to them than to the player
    let best = P, bd = Math.hypot(P.x - m.x, P.y - m.y);
    for (const s of G.minions) { const d = Math.hypot(s.x - m.x, s.y - m.y); if (d < bd - 1.5) { best = s; bd = d; } }
    const pet = G.pet;
    if (pet.state === 'follow' || pet.state === 'fight') { const d = Math.hypot(pet.x - m.x, pet.y - m.y); if (d < bd - 1.5) best = pet; }
    return best;
}

function strike(G, m, tgt, mult = 1) {
    const def = monDef(m);
    const dmg = monsterHit(G, m, mult);
    if (tgt === G.player) {
        const taken = hurtPlayer(G, dmg, def.el, m.lvl, m);
        if (taken && m.elite?.affixes?.includes('vampiric')) m.life = Math.min(m.max, m.life + taken * ELITE_AFFIXES.vampiric.leech * 4);
    } else {
        tgt.life -= dmg;
        G.events.push({ type: 'allyHit', id: tgt.id, amt: Math.round(dmg) });
    }
}

function shoot(G, m, tx, ty, opts = {}) {
    const def = monDef(m), pr = def.proj || { speed: 12, radius: 0.35 };
    const a = Math.atan2(ty - m.y, tx - m.x) + (opts.spread || 0);
    const sp = opts.speed || pr.speed;
    G.shots.push({
        id: G.nextId++, from: 'mon', x: m.x + Math.cos(a) * m.radius, y: m.y + Math.sin(a) * m.radius, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: opts.radius || pr.radius, dmg: monsterHit(G, m, opts.mult || 1), el: def.el, lvl: m.lvl, range: opts.range || 16, kind: opts.kind || m.kind, src: m.id,
    });
}

function telegraph(G, m, x, y, r, mult, delay = MON.telegraph, kind = 'slam') {
    G.zones.push({ id: G.nextId++, x, y, r, t: delay, dmg: monsterHit(G, m, mult), el: monDef(m).el, from: 'mon', lvl: m.lvl, kind, src: m.id });
}

// ------------------------------------------------------------------------------------------------------ the step

export function stepMonsters(G, dt) {
    const A = G.area, P = G.player;
    const field = G.mons.length ? playerFlow(G) : null;
    for (let i = G.mons.length - 1; i >= 0; i--) {
        const m = G.mons[i];
        if (m.state === 'dead') { m.t -= dt; if (m.t <= 0) G.mons.splice(i, 1); continue; }
        m.hitT = Math.max(0, m.hitT - dt);
        if (m.shock && (m.shock.t -= dt) <= 0) m.shock = null;
        if (m.curse && (m.curse.t -= dt) <= 0) m.curse = null;
        if (m.armorBreak && (m.armorBreak.t -= dt) <= 0) m.armorBreak = null;
        m.taunt = Math.max(0, m.taunt - dt);
        const dP = Math.hypot(P.x - m.x, P.y - m.y);
        if (dP > ACTIVE && !m.boss) continue;
        if (P.life <= 0 || G.mode !== 'play') continue;
        if (!m.aggro) {
            if (dP < MON.aggro && los(A, m.x, m.y, P.x, P.y)) { m.aggro = true; G.events.push({ type: 'aggro', id: m.id, boss: m.boss }); }
            else continue;
        }
        if (m.state === 'stagger' || m.state === 'stun') {
            m.t -= dt;
            if (m.t <= 0) { m.state = 'chase'; m.cd = Math.max(m.cd, 0.3); }
            continue;
        }
        m.cd -= dt;
        const tgt = targetOf(G, m);
        const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy) || 1;
        m.face = Math.atan2(dy, dx);
        const def = monDef(m);

        // elite affixes that act on their own
        if (m.elite?.affixes?.includes('thunder')) {
            m.novaT -= dt;
            if (m.novaT <= 0 && dP < 8) { m.novaT = 5; telegraph(G, m, m.x, m.y, 3.2, 1.3, 0.9, 'nova'); }
        }

        if (m.boss) { bossBrain(G, m, tgt, d, dt, field); continue; }

        if (m.state === 'wind') {
            m.t -= dt;
            if (m.t > 0) continue;
            m.state = 'chase'; m.cd = m.atk;
            if (def.ai === 'ranged') { shoot(G, m, tgt.x, tgt.y); G.events.push({ type: 'monShoot', id: m.id, kind: m.kind }); }
            else if (def.ai === 'caster') {
                shoot(G, m, tgt.x, tgt.y, { radius: 0.5 });
                if (def.raises && G.rng() < 0.35 && G.mons.filter((o) => o.state !== 'dead').length < 90) {
                    const a = G.rng() * 6.28;
                    const r = placeNear(G, def.raises, { x: m.x + Math.cos(a) * 1.5, y: m.y + Math.sin(a) * 1.5 }, m.lvl, { aggro: true });
                    if (r) G.events.push({ type: 'raise', id: r.id, x: r.x, y: r.y });
                }
            } else if (def.ai === 'charger' || m.heavy) {
                // the blow lands on the telegraph zone placed when the wind-up began (zones step on their own)
                m.heavy = false;
            } else if (d <= m.reach + 0.6) strike(G, m, tgt);
            continue;
        }

        const inReach = def.ai === 'ranged' || def.ai === 'caster' ? d <= def.reach && los(A, m.x, m.y, tgt.x, tgt.y) : d <= m.reach;
        if (inReach && m.cd <= 0) {
            m.state = 'wind';
            if (def.ai === 'charger') { m.t = MON.telegraph; telegraph(G, m, m.x + (dx / d) * 1.4, m.y + (dy / d) * 1.4, 1.9, 1.6); }
            else if (def.ai === 'melee' && m.elite && !m.elite.minion && ++m.swings % MON.heavyEvery === 0) {
                // an elite's heavy blow: a red ring in front of it first, so it can be stepped out of
                m.heavy = true; m.t = MON.telegraph;
                telegraph(G, m, m.x + (dx / d) * 1.2, m.y + (dy / d) * 1.2, 1.8, MON.heavyMult, MON.telegraph, 'heavy');
            } else m.t = def.ai === 'melee' ? 0.35 : 0.45;
            G.events.push({ type: 'monAttack', id: m.id, kind: m.kind });
            continue;
        }
        // movement: ranged keep their distance; others close in down the flow field
        let speed = m.speed * (m.curse ? 1 - m.curse.slow : 1);
        let mx = 0, my = 0;
        if ((def.ai === 'ranged' || def.ai === 'caster') && inReach) {
            if (d < def.reach * 0.45) { mx = -dx / d; my = -dy / d; speed *= 0.7; }
        } else if (def.ai === 'charger' && d < 9 && d > 3 && (m.chargeT -= dt) <= 0 && los(A, m.x, m.y, tgt.x, tgt.y)) {
            m.chargeT = 4; m.rush = 0.6; G.events.push({ type: 'charge', id: m.id });
        }
        if (m.rush > 0) { m.rush -= dt; speed *= 2.6; mx = dx / d; my = dy / d; }
        else if (!mx && !(inReach && def.ai !== 'melee')) {
            if (d > m.reach * 0.8) {
                if (tgt === P && field && !clearPath(A, m.x, m.y, P.x, P.y, m.radius * 0.8)) {
                    const n = downhill(A, field, m.x, m.y);
                    if (n) { const ex = n.cx - m.x, ey = n.cy - m.y, el = Math.hypot(ex, ey) || 1; mx = ex / el; my = ey / el; }
                } else { mx = dx / d; my = dy / d; }
            }
        }
        if (mx || my) moveBody(A, m, mx * speed * dt, my * speed * dt, m.radius * 0.8);
    }
    separate(G);
}

/** Push overlapping monsters apart so packs spread around the player instead of stacking. */
function separate(G) {
    const ms = G.mons, A = G.area, P = G.player;
    for (let i = 0; i < ms.length; i++) {
        const a = ms[i];
        if (a.state === 'dead' || Math.abs(a.x - P.x) > ACTIVE || Math.abs(a.y - P.y) > ACTIVE) continue;
        for (let j = i + 1; j < ms.length; j++) {
            const b = ms[j];
            if (b.state === 'dead') continue;
            const dx = b.x - a.x, dy = b.y - a.y, r = (a.radius + b.radius) * 0.85;
            if (Math.abs(dx) > r || Math.abs(dy) > r) continue;
            const d = Math.hypot(dx, dy);
            if (d >= r || d < 1e-6) continue;
            const push = (r - d) * 0.5, nx = dx / d, ny = dy / d;
            const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
            moveBody(A, a, -nx * push * wa, -ny * push * wa, a.radius * 0.8);
            moveBody(A, b, nx * push * wb, ny * push * wb, b.radius * 0.8);
        }
        // and keep them out of the player
        const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy), r = a.radius + 0.42;
        if (d < r && d > 1e-6) moveBody(A, a, (dx / d) * (r - d), (dy / d) * (r - d), a.radius * 0.8);
    }
}

// ------------------------------------------------------------------------------------------------------ bosses

function bossBrain(G, m, tgt, d, dt, field) {
    const B = BOSSES[m.boss], A = G.area, P = G.player;
    // phases: crossing a threshold adds summons and speeds the boss up
    const frac = m.life / m.max;
    while (m.phase < B.phases.length && frac <= B.phases[m.phase]) {
        m.phase++;
        m.speed *= 1.12; m.atk *= 0.88;
        G.events.push({ type: 'bossPhase', id: m.id, boss: m.boss, phase: m.phase, line: B.taunt[Math.min(m.phase, B.taunt.length - 1)] });
        summon(G, m, B, 3 + m.phase);
    }
    if (m.state === 'wind') { m.t -= dt; if (m.t <= 0) m.state = 'chase'; return; }
    m.abilityT -= dt;
    if (m.abilityT <= 0 && d < 16) {
        const pool = B.abilities.filter((a) => !a.startsWith('summon') || m.phase > 0);
        const ab = pool[Math.floor(G.rng() * pool.length)];
        m.abilityT = Math.max(1.6, 3.2 - m.phase * 0.5);
        m.state = 'wind'; m.t = 0.7;
        G.events.push({ type: 'bossCast', id: m.id, ability: ab });
        if (ab === 'slam') telegraph(G, m, tgt.x, tgt.y, 3.0, 1.7, 0.85);
        else if (ab === 'quake') telegraph(G, m, m.x, m.y, 6.5, 2.0, 1.1, 'quake');
        else if (ab === 'meteor') for (let k = 0; k < 4 + m.phase; k++) telegraph(G, m, P.x + G.rng.range(-4, 4), P.y + G.rng.range(-4, 4), 1.8, 1.3, 1.0 + k * 0.15, 'meteor');
        else if (ab === 'spray') for (let k = -2; k <= 2; k++) shoot(G, m, tgt.x, tgt.y, { spread: k * 0.2, speed: 10, radius: 0.45, kind: 'spray' });
        else if (ab === 'volley') for (let k = -1; k <= 1; k++) shoot(G, m, tgt.x, tgt.y, { spread: k * 0.12, speed: 14, radius: 0.4, kind: 'bone' });
        else if (ab === 'bonering') for (let k = 0; k < 12; k++) shoot(G, m, m.x + Math.cos(k * 0.5236), m.y + Math.sin(k * 0.5236), { speed: 8, radius: 0.45, kind: 'bone', mult: 0.9 });
        else if (ab === 'blink') {
            for (let t = 0; t < 10; t++) {
                const a = G.rng() * 6.28, r = 6 + G.rng() * 3, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
                if (fits(A, x, y, m.radius)) { G.events.push({ type: 'blink', id: m.id, x0: m.x, y0: m.y, x, y }); m.x = x; m.y = y; break; }
            }
        } else if (ab.startsWith('summon')) summon(G, m, B, 2 + m.phase);
        return;
    }
    // walk in and melee (Morwen keeps her distance and casts)
    if (B.ranged) {
        if (d < 5) { moveBody(A, m, (-(tgt.x - m.x) / d) * m.speed * dt, (-(tgt.y - m.y) / d) * m.speed * dt, m.radius * 0.8); }
        else if (d > 10) chaseStep(G, m, tgt, d, dt, field);
        return;
    }
    if (d <= m.reach && m.cd <= 0) { m.cd = m.atk; strike(G, m, tgt, 1); G.events.push({ type: 'monAttack', id: m.id, kind: m.kind }); return; }
    if (d > m.reach * 0.8) chaseStep(G, m, tgt, d, dt, field);
}

function chaseStep(G, m, tgt, d, dt, field) {
    const A = G.area;
    let mx = (tgt.x - m.x) / d, my = (tgt.y - m.y) / d;
    if (field && !clearPath(A, m.x, m.y, tgt.x, tgt.y, Math.min(m.radius * 0.8, 0.7))) {
        const n = downhill(A, field, m.x, m.y);
        if (n) { const ex = n.cx - m.x, ey = n.cy - m.y, el = Math.hypot(ex, ey) || 1; mx = ex / el; my = ey / el; }
    }
    moveBody(A, m, mx * m.speed * dt, my * m.speed * dt, Math.min(m.radius * 0.8, 0.7));
}

function summon(G, m, B, n) {
    const ab = B.abilities.find((a) => a.startsWith('summon'));
    if (!ab) return;
    const kind = ab.split(':')[1];
    if (G.mons.filter((o) => o.state !== 'dead').length > 80) return;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28;
        const r = placeNear(G, kind, { x: m.x + Math.cos(a) * 2.5, y: m.y + Math.sin(a) * 2.5 }, Math.max(1, m.lvl - 2), { aggro: true });
        if (r) G.events.push({ type: 'raise', id: r.id, x: r.x, y: r.y });
    }
}

