/**
 * abilities.js — the level-up ability pool: rolling choices, granting an
 * ability, and folding abilities + talents into the player's live stats.
 */

import { ABILITIES, DEVIL_POOL, DEVIL_HP_COST, PLAYER } from '../config.js';

const count = (p, id) => p.ab[id] || 0;

function available(w, id) {
    const p = w.player, def = ABILITIES[id];
    if (count(p, id) >= def.max) return false;
    if (id === 'heal') return p.hp < p.stat.maxHp * 0.85;
    if (id === 'extralife') return !p.extraLife;
    return true;
}

/** Up to n distinct ability ids, weighted, never offering maxed-out ones. */
export function rollAbilities(w, n = 3, pool = null) {
    const ids = (pool ?? Object.keys(ABILITIES)).filter((id) => available(w, id));
    const out = [];
    const weights = {};
    for (const id of ids) weights[id] = ABILITIES[id].weight;
    while (out.length < n && Object.keys(weights).length) {
        const id = w.rng.weighted(weights);
        out.push(id);
        delete weights[id];
    }
    return out;
}

export function rollDevil(w) {
    const opts = rollAbilities(w, 1, DEVIL_POOL);
    return opts.length ? opts : rollAbilities(w, 1);
}

/** Apply one pick. Returns the ability id actually granted. */
export function grantAbility(w, id) {
    const p = w.player;
    if (id === 'heal') {
        healPlayer(w, p.stat.maxHp * 0.35);
        return id;
    }
    const before = p.stat.maxHp;
    p.ab[id] = count(p, id) + 1;
    if (id === 'extralife') p.extraLife = true;
    recalcStats(w);
    if (id === 'hpboost') healPlayer(w, p.stat.maxHp - before);
    if (id === 'aegis') p.aegisT = 0;
    p.picked.push(id);
    return id;
}

/** Devil deal: permanently trade a slice of max HP for the ability. */
export function devilDeal(w, id) {
    const p = w.player;
    p.devilMul *= 1 - DEVIL_HP_COST;
    grantAbility(w, id);
    p.hp = Math.min(p.hp, p.stat.maxHp);
}

export function healPlayer(w, amount) {
    const p = w.player;
    const amt = Math.round(amount * (1 + 0.08 * (w.talents.recover || 0)));
    const before = p.hp;
    p.hp = Math.min(p.stat.maxHp, p.hp + amt);
    const gained = Math.round(p.hp - before);
    if (gained > 0) w.fxQueue.push({ type: 'heal', x: p.x, y: p.y, amt: gained });
}

export function recalcStats(w) {
    const p = w.player, t = w.talents, a = p.ab;
    const s = p.stat;
    s.atk = PLAYER.atk * (1 + 0.08 * (t.power || 0)) * (1 + 0.25 * count(p, 'atk'));
    s.aspd = PLAYER.aspd * (1 + 0.04 * (t.agility || 0)) * (1 + 0.15 * count(p, 'aspd'));
    s.crit = PLAYER.crit + 0.12 * count(p, 'crit');
    s.critMul = PLAYER.critMul + 0.4 * count(p, 'crit');
    s.maxHp = Math.round(PLAYER.hp * (1 + 0.1 * (t.vitality || 0)) * (1 + 0.2 * count(p, 'hpboost')) * p.devilMul);
    s.speed = PLAYER.speed * (1 + 0.12 * count(p, 'speed'));
    s.dodge = Math.min(0.45, 0.12 * count(p, 'dodge'));
    s.armor = 1 - 0.03 * (t.armor || 0);
    s.arrowMul = Math.pow(0.9, count(p, 'multishot')) * Math.pow(0.88, count(p, 'front')) * (a.giant ? 1.35 : 1);
    s.arrowR = a.giant ? 0.24 : 0.14;
    p.hp = Math.min(p.hp, s.maxHp);
}
