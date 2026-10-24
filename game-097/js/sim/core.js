// Shared sim helpers: building battle units from roster records, killing them, handing out XP.

import { XP } from '../config.js';
import { UNITS, STAT_KEYS, statsOf, expectedGains, gainAmount } from './data.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rec = (G, rid) => G.meta.roster.find((r) => r.rid === rid) || null;

function applyStats(u, s) {
    const dHp = s.hp - u.hpMax;
    u.hpMax = s.hp; u.hp = clamp(u.hp + dHp, 1, u.hpMax);
    u.atk = s.atk; u.def = s.def; u.spd = s.spd; u.skl = s.skl;
}

/** A piece on the board. Player pieces take their stats from a roster record, the dead from their level. */
export function makeUnit(B, key, team, x, y, { lv = 1, record = null, boss = false, recruit = false } = {}) {
    const def = UNITS[key];
    const s = record ? statsOf(key, record.gains, record.bond) : statsOf(key, expectedGains(key, lv), 0);
    return {
        id: B.nextId++, key, rid: record ? record.rid : 0, team, name: def.name, el: def.el,
        x, y, lv: record ? record.lv : lv,
        hp: s.hp, hpMax: s.hp, atk: s.atk, def: s.def, spd: s.spd, skl: s.skl,
        ability: def.ability, acted: false, cd: 0, mods: [], boss, recruit,
    };
}

export function addMod(u, mod) {
    u.mods = u.mods.filter((m) => m.name !== mod.name);
    u.mods.push(mod);
}

/** Take a piece off the board. */
export function killUnit(G, u, why = 'slain') {
    const B = G.battle;
    B.units = B.units.filter((o) => o !== u);
    if (u.team === 'e') B.stats.kills++; else B.stats.losses++;
    G.events.push({ type: 'death', id: u.id, key: u.key, team: u.team, at: [u.x, u.y], why, boss: u.boss });
}

export const xpFor = (u, foe, kill) => Math.max(4, (kill ? 30 : 12) + 3 * clamp(foe.lv - u.lv, -5, 8));

/** XP for a player piece. Level-ups roll the growth rates and show up as events. */
export function gainXp(G, u, amt) {
    if (u.team !== 'p' || !amt) return;
    const r = rec(G, u.rid);
    if (!r || r.lv >= XP.maxLevel) return;
    r.xp += amt;
    while (r.xp >= XP.perLevel && r.lv < XP.maxLevel) {
        r.xp -= XP.perLevel;
        r.lv++;
        const gains = {};
        for (const k of STAT_KEYS) {
            if (G.rng() * 100 < UNITS[r.key].growth[k]) { r.gains[k] = (r.gains[k] || 0) + gainAmount(k); gains[k] = gainAmount(k); }
        }
        u.lv = r.lv;
        const ev = { type: 'levelup', id: u.id, rid: r.rid, name: u.name, lv: r.lv, gains };
        G.events.push(ev);
        G.battle.stats.levelups.push({ rid: r.rid, name: u.name, lv: r.lv, gains });
    }
    if (r.lv >= XP.maxLevel) r.xp = 0;
    applyStats(u, statsOf(r.key, r.gains, r.bond));
}
