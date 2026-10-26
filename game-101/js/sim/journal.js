// The journal: counts of everything the party has met, beaten, found, bought, sold and used.
// Entries are keyed by template (a steel sword, a healing potion, a Cave Rat), so the shelves have a
// fixed number of slots to fill however deep the dungeon goes. Pure.

import { WEAPONS, ARMORS, CHARMS, POTIONS, SCROLLS, WANDS, TOMES, COLLECTIBLES, matList } from './items.js';
import { FAMILIES, VARIANT_NAMES } from './monsters.js';
import { NPC_KINDS, TRAP_KINDS, GATHER_KINDS } from './dungeon.js';

export const newJournal = () => ({ mon: {}, items: {}, npc: {}, trap: {}, gather: {}, misc: {}, best: {} });

function bump(o, key, field, n) {
    const e = o[key] || (o[key] = {});
    e[field] = (e[field] || 0) + n;
    return e;
}
export function rec(G, cat, key, field, n = 1) { return bump(G.journal[cat], key, field, n); }
export const misc = (G, key, n = 1) => { G.journal.misc[key] = (G.journal.misc[key] || 0) + n; };
export const miscMax = (G, key, v) => { if (v > (G.journal.misc[key] || 0)) G.journal.misc[key] = v; };

export function recMon(G, m, field) {
    const e = rec(G, 'mon', m.fam, field);
    if (m.variant) {
        const vv = e.v || (e.v = {});
        const x = vv[m.variant] || (vv[m.variant] = {});
        x[field] = (x[field] || 0) + 1;
    }
    if (m.boss) misc(G, field === 'killed' ? 'bossesSlain' : 'bossesMet');
}
export function recItem(G, it, field, n = 1) {
    rec(G, 'items', it.key, field, n);
    const b = G.journal.best;
    if (it.rar !== undefined && (it.t === 'w' || it.t === 'a' || it.t === 'c')) {
        const cur = b[it.t];
        if (!cur || it.rar > cur.rar || (it.rar === cur.rar && it.ilvl > cur.ilvl)) b[it.t] = { name: it.name, rar: it.rar, ilvl: it.ilvl };
    }
}

export const NPC_NAMES = {
    merchant: 'Wandering Merchant', hermit: 'Hermit', adventurer: 'Lost Adventurer', gambler: 'Gambler', riddler: 'Riddler', healer: 'Wayside Healer', questgiver: 'Guild Runner',
};
export const TRAP_NAMES = { dart: 'Poison Dart', pit: 'Pit', alarm: 'Alarm Bell', tele: 'Teleporter', spin: 'Spinner', rune: 'Fire Rune', gas: 'Sleeping Gas' };
export const GATHER_NAMES = { herb: 'Herb Patch', ore: 'Ore Seam', bug: 'Bug Nest', relic: 'Relic Mound' };

/** Every slot on every shelf, in order: [{ key, name }] per category. */
export function registry() {
    const reg = { weapons: [], armor: [], charms: [], potions: [], scrolls: [], wands: [], tomes: [], collectibles: [], monsters: [], npcs: [], traps: [], gathers: [] };
    for (const b of WEAPONS) matList({ t: 'w' }).forEach((m, i) => reg.weapons.push({ key: `w:${b.id}:${i}`, name: `${m} ${b.name}`, grp: b.id }));
    for (const b of ARMORS) matList({ t: 'a', wt: b.wt }).forEach((m, i) => reg.armor.push({ key: `a:${b.id}:${i}`, name: `${m} ${b.name}`, grp: b.slot }));
    for (const c of CHARMS) reg.charms.push({ key: `c:${c.id}`, name: c.name });
    for (const k in POTIONS) reg.potions.push({ key: `p:${k}`, name: POTIONS[k].name });
    for (const k in SCROLLS) reg.scrolls.push({ key: `s:${k}`, name: SCROLLS[k].name });
    for (const k in WANDS) reg.wands.push({ key: `m:${k}`, name: WANDS[k].name });
    for (const k in TOMES) reg.tomes.push({ key: `t:${k}`, name: `Tome of ${TOMES[k]}` });
    for (const c of COLLECTIBLES) reg.collectibles.push({ key: `x:${c.id}`, name: c.name, grp: c.kind });
    for (const f of FAMILIES) reg.monsters.push({ key: f.id, name: f.name, fam: f });
    for (const k of NPC_KINDS) reg.npcs.push({ key: k, name: NPC_NAMES[k] });
    for (const k of TRAP_KINDS) reg.traps.push({ key: k, name: TRAP_NAMES[k] });
    for (const k of GATHER_KINDS) reg.gathers.push({ key: k, name: GATHER_NAMES[k] });
    return reg;
}
export const REG = registry();
export const VARIANT_COUNT = VARIANT_NAMES.length;

/** How much of each shelf is filled: { cat: [have, total] }. */
export function completion(G) {
    const j = G.journal, out = {};
    const count = (list, obj, f = () => true) => [list.filter((e) => obj[e.key] && f(obj[e.key])).length, list.length];
    out.weapons = count(REG.weapons, j.items); out.armor = count(REG.armor, j.items); out.charms = count(REG.charms, j.items);
    out.potions = count(REG.potions, j.items); out.scrolls = count(REG.scrolls, j.items); out.wands = count(REG.wands, j.items);
    out.tomes = count(REG.tomes, j.items); out.collectibles = count(REG.collectibles, j.items);
    out.monsters = count(REG.monsters, j.mon, (e) => e.killed > 0);
    out.npcs = count(REG.npcs, j.npc); out.traps = count(REG.traps, j.trap); out.gathers = count(REG.gathers, j.gather);
    return out;
}
