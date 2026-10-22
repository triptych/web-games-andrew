// Party members, their stats, equipment, levelling and the shared inventory. Pure.

import { CHARS, statAt, skillsAt, xpToNext } from './data/classes.js';
import { ITEMS, weaponFor, armorFor } from './data/items.js';
import { MAX_LEVEL, MAX_ACTIVE, MAX_ITEMS } from '../config.js';

export function starterGear(id, lvl) {
    const c = CHARS[id];
    const tier = Math.min(5, Math.floor((lvl - 1) / 8));
    return { weapon: weaponFor(c.weapon, tier), armor: armorFor(c.armor[0], tier), charm: null };
}

export function newMember(id, lvl = 1) {
    const m = { id, lvl, xp: 0, equip: starterGear(id, lvl), bonus: { hp: 0, mp: 0, atk: 0, mag: 0 }, hp: 1, mp: 1, kills: 0 };
    const s = memberStats(m);
    m.hp = s.mhp; m.mp = s.mmp;
    return m;
}

/** Stats with equipment and seeds folded in. */
export function memberStats(m) {
    const c = CHARS[m.id];
    const out = {};
    for (const k of ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd']) out[k] = statAt(m.id, m.lvl, k) + (m.bonus[k] || 0);
    for (const slot of ['weapon', 'armor', 'charm']) {
        const it = ITEMS[m.equip[slot]];
        if (!it?.stats) continue;
        for (const [k, v] of Object.entries(it.stats)) out[k] = (out[k] || 0) + v;
    }
    return { mhp: Math.max(1, out.hp), mmp: Math.max(0, out.mp), atk: out.atk, mag: out.mag, def: out.def, res: out.res, spd: Math.max(1, out.spd), weaponType: ITEMS[m.equip.weapon]?.wtype || c.weapon };
}

export function immunities(m) {
    const it = ITEMS[m.equip.charm];
    return it?.immune || [];
}

export function canEquip(id, itemId) {
    const it = ITEMS[itemId], c = CHARS[id];
    if (!it) return false;
    if (it.type === 'weapon') return it.wtype === c.weapon;
    if (it.type === 'armor') return c.armor.includes(it.akind);
    return it.type === 'charm';
}

/** Add xp; returns the level-ups. */
export function gainXp(m, xp) {
    const ups = [];
    if (m.lvl >= MAX_LEVEL) return ups;
    m.xp += xp;
    while (m.lvl < MAX_LEVEL && m.xp >= xpToNext(m.lvl)) {
        m.xp -= xpToNext(m.lvl);
        const before = memberStats(m);
        m.lvl++;
        const after = memberStats(m);
        m.hp += after.mhp - before.mhp; m.mp += after.mmp - before.mmp;
        const learned = CHARS[m.id].skills.filter((s) => s.lvl === m.lvl).map((s) => s.id);
        ups.push({ id: m.id, lvl: m.lvl, learned, gain: { hp: after.mhp - before.mhp, mp: after.mmp - before.mmp, atk: after.atk - before.atk, mag: after.mag - before.mag, def: after.def - before.def, spd: after.spd - before.spd } });
        if (m.lvl >= MAX_LEVEL) m.xp = 0;
    }
    return ups;
}

export function clampHpMp(m) {
    const s = memberStats(m);
    m.hp = Math.max(0, Math.min(s.mhp, m.hp));
    m.mp = Math.max(0, Math.min(s.mmp, m.mp));
}

export function fullHeal(m) { const s = memberStats(m); m.hp = s.mhp; m.mp = s.mmp; }

export function avgLevel(G) {
    const ids = G.party.active.length ? G.party.active : Object.keys(G.party.members);
    return ids.reduce((a, id) => a + G.party.members[id].lvl, 0) / Math.max(1, ids.length);
}

export function recruit(G, id) {
    if (G.party.members[id]) return null;
    const lvl = Math.max(1, Math.round(avgLevel(G)) - 1);
    const m = newMember(id, lvl);
    G.party.members[id] = m;
    if (G.party.active.length < MAX_ACTIVE) G.party.active.push(id);
    else G.party.reserve.push(id);
    return m;
}

export function swapActive(G, outId, inId) {
    const a = G.party.active.indexOf(outId);
    const r = G.party.reserve.indexOf(inId);
    if (a < 0 || r < 0) return false;
    G.party.active[a] = inId; G.party.reserve[r] = outId;
    return true;
}

// ---------------------------------------------------------------- inventory
export function count(G, id) { return G.inv[id] || 0; }
export function addItem(G, id, n = 1) {
    if (!ITEMS[id]) return false;
    G.inv[id] = Math.min(MAX_ITEMS, (G.inv[id] || 0) + n);
    return true;
}
export function removeItem(G, id, n = 1) {
    if ((G.inv[id] || 0) < n) return false;
    G.inv[id] -= n;
    if (G.inv[id] <= 0) delete G.inv[id];
    return true;
}
export function equip(G, id, itemId) {
    const m = G.party.members[id];
    const it = ITEMS[itemId];
    if (!m || !canEquip(id, itemId) || !removeItem(G, itemId)) return false;
    const slot = it.type;
    const old = m.equip[slot];
    if (old) addItem(G, old);
    m.equip[slot] = itemId;
    clampHpMp(m);
    return true;
}
export function unequip(G, id, slot) {
    const m = G.party.members[id];
    if (!m || !m.equip[slot]) return false;
    addItem(G, m.equip[slot]);
    m.equip[slot] = null;
    clampHpMp(m);
    return true;
}
export function knownSkills(m) { return skillsAt(m.id, m.lvl); }
