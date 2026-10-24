// The duel. When a piece takes another, the two fight in the Fire Emblem way: strike, counter,
// then a follow-up for whoever is at least 4 speed faster. Hit chances are rolled "true hit" (the
// average of two rolls). Pure: randomness comes from G.rng.

import { COMBAT, TERRAIN } from '../config.js';
import { ELEMENTS } from './data.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** +1 the attacker has the element edge, -1 it is at a disadvantage, 0 neutral. */
export function advantage(a, d) {
    if (a === d) return 0;
    if ((a === 'umbra' && d === 'lumen') || (a === 'lumen' && d === 'umbra')) return 1;
    if (ELEMENTS[a].beats === d) return 1;
    if (ELEMENTS[d].beats === a) return -1;
    return 0;
}

/** A unit's stats with every active buff and curse added in. */
export function eff(u) {
    const o = { atk: u.atk, def: u.def, spd: u.spd, skl: u.skl };
    for (const m of u.mods) for (const k of ['atk', 'def', 'spd']) if (m[k]) o[k] += m[k];
    o.atk = Math.max(0, o.atk); o.def = Math.max(0, o.def); o.spd = Math.max(1, o.spd);
    return o;
}

export const terrainAt = (B, x, y) => TERRAIN[B.tiles[y][x]];

/** One side's strike against the other, standing on tile t. */
function strike(a, d, t) {
    const A = eff(a), D = eff(d);
    const adv = advantage(a.el, d.el);
    const mult = adv > 0 ? COMBAT.advMult : adv < 0 ? COMBAT.disMult : 1;
    return {
        adv,
        dmg: Math.max(1, Math.round(A.atk * mult) - D.def - t.def),
        hit: clamp(COMBAT.baseHit + A.skl * 2 - D.spd * 2 - t.avo + adv * COMBAT.advHit, 10, 100),
        crit: clamp(Math.floor(A.skl / 2) - 1, 0, 40),
    };
}

/** What a fight between a (moving to take d) and d would look like. `stop` is the square a stands
 *  on while it fights, which decides the terrain the defender's blows land on. */
export function forecast(B, a, d, stop = [a.x, a.y]) {
    const fa = strike(a, d, terrainAt(B, d.x, d.y));
    const fd = strike(d, a, terrainAt(B, stop[0], stop[1]));
    const A = eff(a), D = eff(d);
    const seq = ['a', 'd'];
    if (A.spd - D.spd >= COMBAT.doubleSpd) seq.push('a');
    else if (D.spd - A.spd >= COMBAT.doubleSpd) seq.push('d');
    return { a: fa, d: fd, seq };
}

/** Expected damage each side deals if the fight runs, without rolling dice. For the AI and the forecast panel. */
export function expected(f, aHp, dHp) {
    let ha = aHp, hd = dHp, dealt = 0, taken = 0;
    for (const side of f.seq) {
        if (ha <= 0 || hd <= 0) break;
        const s = side === 'a' ? f.a : f.d;
        const e = (s.hit / 100) * s.dmg * (1 + (s.crit / 100) * (COMBAT.critMult - 1));
        if (side === 'a') { const x = Math.min(e, hd); hd -= x; dealt += x; } else { const x = Math.min(e, ha); ha -= x; taken += x; }
    }
    return { dealt, taken, kills: hd <= 0.5, dies: ha <= 0.5 };
}

const trueHit = (rng, chance) => ((rng() + rng()) * 50) < chance;

const snap = (u) => ({ id: u.id, key: u.key, name: u.name, el: u.el, team: u.team, hp: u.hp, hpMax: u.hpMax, boss: !!u.boss });

/** Roll the fight and write the damage into the two units. Returns the 'battle' event. */
export function fight(G, a, d, stop) {
    const B = G.battle;
    const f = forecast(B, a, d, stop);
    const info = { a: snap(a), d: snap(d) };
    let hpA = a.hp, hpD = d.hp;
    const strikes = [];
    for (const side of f.seq) {
        if (hpA <= 0 || hpD <= 0) break;
        const s = side === 'a' ? f.a : f.d;
        const hit = trueHit(G.rng, s.hit);
        const crit = hit && G.rng() * 100 < s.crit;
        const dmg = hit ? s.dmg * (crit ? COMBAT.critMult : 1) : 0;
        if (side === 'a') hpD = Math.max(0, hpD - dmg); else hpA = Math.max(0, hpA - dmg);
        strikes.push({ by: side, hit, crit, dmg, hpA, hpD });
    }
    a.hp = hpA; d.hp = hpD;
    return { type: 'battle', ...info, f, strikes, from: [a.x, a.y], to: [d.x, d.y], stop: stop.slice() };
}

/** A spell's damage: always hits, ignores half the defence. */
export function spellDamage(B, a, d, mult = 1) {
    const A = eff(a), D = eff(d);
    const adv = advantage(a.el, d.el);
    const m = adv > 0 ? COMBAT.advMult : adv < 0 ? COMBAT.disMult : 1;
    const t = terrainAt(B, d.x, d.y);
    return Math.max(1, Math.round(A.atk * mult * m) - Math.floor((D.def + t.def) * COMBAT.spell));
}
