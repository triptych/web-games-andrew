// What consumables and tomes do to a party member. Used by the field menu and by the battle. Pure.

import { clamp } from './core.js';
import { calc, healMember } from './party.js';
import { POTIONS, TOMES } from './items.js';

/** Apply a potion to a member. Returns { ok, text, amt }. `battle` lets buffs through. */
export function potionEffect(it, m, alchemist = false) {
    const P = POTIONS[it.eff], s = calc(m), mul = alchemist ? 1.5 : 1, pot = it.pot;
    switch (P.k) {
        case 'hp': {
            if (m.hp <= 0) return { ok: false, text: `${m.name} is down.` };
            const amt = Math.round((Math.min(1, 0.2 + 0.06 * pot) * s.maxhp + 20 + 10 * pot) * mul);
            if (m.hp >= s.maxhp) return { ok: false, text: `${m.name} is already well.` };
            const before = m.hp;
            healMember(m, amt);
            return { ok: true, amt: m.hp - before, text: `${m.name} recovers ${m.hp - before} HP.` };
        }
        case 'mp': {
            if (m.hp <= 0) return { ok: false, text: `${m.name} is down.` };
            const amt = Math.round((Math.min(1, 0.2 + 0.06 * pot) * s.maxmp + 10 + 4 * pot) * mul);
            if (m.mp >= s.maxmp) return { ok: false, text: `${m.name}'s mana is full.` };
            const before = m.mp;
            healMember(m, 0, amt);
            return { ok: true, amt: m.mp - before, text: `${m.name} recovers ${m.mp - before} MP.` };
        }
        case 'cure': {
            let any = false;
            for (const st of P.cures) if (m.st[st]) { delete m.st[st]; any = true; }
            return any ? { ok: true, text: `${m.name} is cured.` } : { ok: false, text: 'No effect.' };
        }
        case 'revive': {
            if (m.hp > 0) return { ok: false, text: `${m.name} is not fallen.` };
            m.hp = Math.max(1, Math.round(s.maxhp * clamp(0.25 + pot * 0.05, 0, 1) * mul));
            m.st = {};
            return { ok: true, text: `${m.name} rises!` };
        }
        case 'full': {
            if (m.hp <= 0) return { ok: false, text: `${m.name} is down.` };
            m.hp = s.maxhp; m.mp = s.maxmp;
            for (const k of ['poison', 'sleep', 'stun']) delete m.st[k];
            return { ok: true, text: `${m.name} feels reborn.` };
        }
        case 'buff': {
            if (m.hp <= 0) return { ok: false, text: `${m.name} is down.` };
            m.cb = m.cb || { guard: false, buf: {} };
            const mult = 1 + (25 + pot) / 100;
            m.cb.buf[P.stat] = { m: mult, t: 5 };
            return { ok: true, text: `${m.name} feels stronger.` };
        }
    }
    return { ok: false, text: 'Nothing happens.' };
}

export function tomeEffect(it, m) {
    m.bonus[it.eff] = (m.bonus[it.eff] || 0) + it.amt;
    return { ok: true, text: `${m.name} gains ${it.amt} ${TOMES[it.eff]}!` };
}
export const canUseInField = (it) => it.t === 'p' ? !['buff'].includes(POTIONS[it.eff].k) : it.t === 't' || it.t === 's' || (it.t === 'm' && it.skill === 'heal');
