/**
 * overlord.js — the player's own avatar: account level, talents, spells.
 * Imports nothing from state.js so state.js can use it.
 */

import { TALENTS, TALENT_MAX, SPELLS, SPELL_IDS, OVERLORD_MAX_LEVEL } from '../data/world.js';

export function olXpToNext(level) { return Math.round(110 * Math.pow(level, 1.6)); }

export function maxStamina(S) { return 60 + S.overlord.level * 2; }

/** Returns levels gained. Each level refills some stamina and grants a talent point. */
export function addOverlordXp(S, n) {
    const O = S.overlord;
    if (O.level >= OVERLORD_MAX_LEVEL) return 0;
    let gained = 0;
    O.xp += Math.floor(n);
    while (O.level < OVERLORD_MAX_LEVEL && O.xp >= olXpToNext(O.level)) {
        O.xp -= olXpToNext(O.level);
        O.level++;
        gained++;
        S.res.stamina = Math.max(S.res.stamina, 0) + 20 + O.level;
        S.res.gems += 15;
    }
    if (O.level >= OVERLORD_MAX_LEVEL) O.xp = 0;
    // auto-equip a newly unlocked spell into an empty slot
    if (gained) {
        for (const id of SPELL_IDS) {
            if (SPELLS[id].level <= O.level && !O.spells.includes(id)) {
                const empty = O.spells.indexOf(null);
                if (empty >= 0) O.spells[empty] = id;
            }
        }
    }
    return gained;
}

export function talentPoints(S) {
    const spent = Object.values(S.overlord.talents).reduce((a, b) => a + b, 0);
    return Math.max(0, S.overlord.level - 1 - spent);
}

export function talentCost(S, id) { return 1; }

export function raiseTalent(S, id) {
    if (!TALENTS[id]) return false;
    if (S.overlord.talents[id] >= TALENT_MAX) return false;
    if (talentPoints(S) < 1) return false;
    S.overlord.talents[id]++;
    return true;
}

export function resetTalents(S) {
    for (const k of Object.keys(S.overlord.talents)) S.overlord.talents[k] = 0;
}

export function unlockedSpells(S) { return SPELL_IDS.filter((id) => SPELLS[id].level <= S.overlord.level); }

export function setSpell(S, slot, id) {
    if (id && !unlockedSpells(S).includes(id)) return false;
    const other = 1 - slot;
    if (id && S.overlord.spells[other] === id) S.overlord.spells[other] = S.overlord.spells[slot];
    S.overlord.spells[slot] = id;
    return true;
}

export function spellPower(S) { return 1 + (S.overlord.talents.sovereignty || 0) * TALENTS.sovereignty.per; }
export function fortune(S) { return (S.overlord.talents.fortune || 0); }
