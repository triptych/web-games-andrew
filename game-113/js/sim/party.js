// The band: levels, HP, power, charms and items. Pure.

import { CHARS } from './data/chars.js';
import { ITEMS, CHARMS } from './data/items.js';
import { MAX_LEVEL, xpToNext } from '../config.js';

export function newParty() {
    return { members: ['lyra'], st: { lyra: { lv: 1, xp: 0, hp: CHARS.lyra.hp0 } }, items: { lozenge: 1 }, charms: [], equip: {} };
}

export const charmFx = (G, id) => CHARMS[G.party.equip[id]]?.fx || {};
export function maxHp(G, id) {
    const c = CHARS[id], s = G.party.st[id];
    return Math.round((c.hp0 + c.hpG * (s.lv - 1)) * (charmFx(G, id).hp || 1));
}
export function power(G, id) {
    const c = CHARS[id], s = G.party.st[id];
    return (c.pow0 + c.powG * (s.lv - 1)) * (charmFx(G, id).pow || 1);
}
export const alive = (G, id) => G.party.st[id].hp > 0;

export function join(G, id) {
    if (G.party.members.includes(id)) return;
    const lv = Math.max(...G.party.members.map((m) => G.party.st[m].lv));
    G.party.st[id] = { lv, xp: 0, hp: 0 };
    G.party.members.push(id);
    G.party.members.sort((a, b) => CHARS[a].lane - CHARS[b].lane);
    G.party.st[id].hp = maxHp(G, id);
    G.flags[id + 'Joined'] = true;
    G.events.push({ type: 'join', who: id });
}

export function healAll(G, pct = 1) {
    for (const m of G.party.members) {
        const s = G.party.st[m], mx = maxHp(G, m);
        s.hp = Math.min(mx, Math.max(s.hp, 0) + Math.ceil(mx * pct));
    }
}

/** XP to every member; level-ups heal fully. Returns [{ who, lv }] for the results screen. */
export function gainXp(G, xp) {
    const ups = [];
    for (const m of G.party.members) {
        const s = G.party.st[m];
        s.xp += xp;
        while (s.lv < MAX_LEVEL && s.xp >= xpToNext(s.lv)) {
            s.xp -= xpToNext(s.lv);
            s.lv++;
            ups.push({ who: m, lv: s.lv });
        }
        if (ups.some((u) => u.who === m)) s.hp = maxHp(G, m);
    }
    for (const u of ups) G.events.push({ type: 'levelUp', who: u.who, lv: u.lv });
    return ups;
}

export function giveItem(G, item, n = 1) {
    if (CHARMS[item]) { if (!G.party.charms.includes(item)) G.party.charms.push(item); }
    else G.party.items[item] = (G.party.items[item] || 0) + n;
}

/** Use an item from the menu. Returns false when it can't be used. */
export function useItem(G, item, target) {
    const it = ITEMS[item];
    if (!it || it.auto || !(G.party.items[item] > 0)) return false;
    if (it.use.heal) {
        const s = G.party.st[target];
        if (!s || s.hp >= maxHp(G, target)) return false;
        s.hp = Math.min(maxHp(G, target), Math.max(0, s.hp) + it.use.heal);
    } else if (it.use.healAllPct) {
        if (G.party.members.every((m) => G.party.st[m].hp >= maxHp(G, m))) return false;
        healAll(G, it.use.healAllPct);
    }
    G.party.items[item]--;
    G.events.push({ type: 'useItem', item, target });
    return true;
}

/** Wear a charm (or null to take it off). A charm worn by someone else moves. */
export function equip(G, who, charm) {
    if (!G.party.members.includes(who)) return false;
    if (charm && !G.party.charms.includes(charm)) return false;
    for (const m of Object.keys(G.party.equip)) if (G.party.equip[m] === charm) delete G.party.equip[m];
    const before = maxHp(G, who);
    if (charm) G.party.equip[who] = charm; else delete G.party.equip[who];
    const s = G.party.st[who];
    if (s.hp > 0) s.hp = Math.max(1, Math.min(maxHp(G, who), s.hp + (maxHp(G, who) - before)));
    return true;
}
