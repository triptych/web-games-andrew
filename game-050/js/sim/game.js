/**
 * game.js — the save profile and every action on it. This is where the systems meet:
 * battles pay out gold/XP/items/books and quest progress; books raise stats, unlock
 * buildings and the building level cap; buildings turn time into resources, and
 * resources into gear, potions, spell ranks, XP and book study.
 *
 * Pure: time comes in as `now` (ms), randomness from the profile's own seeded rng.
 */

import { makeRng, hashSeed, clamp } from './rng.js';
import { CLASSES, STATS, SPELLS, POTIONS, POTION_IDS, BLESSINGS, BLESSING_IDS, BLESSING_BATTLES, MANA, RES, xpToNext, POINTS_PER_LEVEL, MAX_LEVEL } from './data.js';
import { makeBattle } from './battle.js';
import { makeMonster, FAMILIES } from './monsters.js';
import { makeItem, SLOTS, itemScore } from './items.js';
import { WINGS, generateWingMap, openNodes, EVENTS } from './regions.js';
import { BOOKS, BOOK_BY_ID, bookMult, MAX_TIER, studyCost, studyReq } from './books.js';
import {
    BUILDINGS, BUILDING_IDS, PLOTS, isUnlocked, bLevel, buildCost, levelCap, canAfford, pay, tickTown, capacity,
    questSlots, carryLimit, maxSpellRank, forgeCost, forgeItemLevel, forgeLuck, potionUnlocked, rankCost, rate,
} from './town.js';
import { makeQuest, questDone, bump } from './quests.js';

export const SAVE_VERSION = 1;
export const BAG_LIMIT = 36;

// ------------------------------------------------------------------ Creation

export function newProfile({ cls = 'mage', name, seed = 1, now = 0 }) {
    const C = CLASSES[cls];
    const p = {
        v: SAVE_VERSION, seed, cls, name: (name || C.startName).slice(0, 16),
        level: 1, xp: 0, points: 0, alloc: Object.fromEntries(STATS.map((s) => [s, 0])),
        gear: { weapon: null, armor: null, charm: null, tome: null }, bag: [], uid: 1,
        spells: {}, slots: [],
        res: { gold: 60, wood: 0, stone: 0, herbs: 0, crystal: 0, ink: 0 },
        potions: Object.fromEntries(POTION_IDS.map((id) => [id, 0])), loadout: {},
        books: {}, town: {}, plots: {},
        wings: WINGS.map(() => ({ cleared: {}, visits: {}, keeper: false, guardian: false })), wingOpen: 0,
        quests: { active: [], nextId: 1 },
        counters: { gems: {}, kills: {}, collected: {}, wins: 0, losses: 0, fours: 0, cascades: 0, spells: 0, potions: 0, upgrades: 0, flawless: 0, battles: 0 },
        blessings: [], story: { queue: [], seen: {} }, flags: {},
        endless: { floor: 1, best: 0 }, won: false,
        rng: hashSeed(seed, 'loot') >>> 0, t: now, created: now, playMs: 0,
    };
    // Starting kit: a common weapon and the class's first two spells.
    learnSpells(p);
    const w = makeItem(rngOf(p), { slot: 'weapon', cls, iL: 1, rarity: 0, uid: p.uid++ });
    p.gear.weapon = w;
    saveRng(p);
    queueStory(p, 'prologue');
    refreshQuests(p);
    return p;
}

// One rng per profile, persisted as an integer state.
let _rng = null, _rngOwner = null;
export function rngOf(p) {
    if (_rngOwner !== p) { _rng = makeRng(0); _rngOwner = p; }
    _rng.state = p.rng;
    return _rng;
}
function saveRng(p) { if (_rngOwner === p) p.rng = _rng.state; }
function withRng(p, fn) { const r = rngOf(p); const out = fn(r); saveRng(p); return out; }

// ------------------------------------------------------------------ Derived hero

export function gearMods(p) {
    const m = {};
    for (const s of SLOTS) {
        const it = p.gear[s];
        if (!it) continue;
        for (const [k, v] of Object.entries(it.mods)) m[k] = (m[k] || 0) + v;
    }
    return m;
}

export function heroStats(p) {
    const C = CLASSES[p.cls];
    const g = gearMods(p);
    const firstM = bookMult(p, 'first');
    const st = {};
    for (const s of STATS) st[s] = Math.round((C.base[s] + p.alloc[s] + (g[s] || 0)) * (1 + 0.1 * firstM));
    const manaPer = {}, startMana = {};
    for (const c of MANA) {
        manaPer[c] = g['manaPer.' + c] || 0;
        startMana[c] = g['startMana.' + c] || 0;
    }
    manaPer.spark += Math.round(bookMult(p, 'sparks'));
    startMana.spark += Math.round(4 * bookMult(p, 'thunder'));
    const scaleStat = st[C.scale];
    return {
        stats: st,
        maxHp: Math.round((48 + 6 * st.vitality + 6 * (p.level - 1) + (g.maxHp || 0)) * (1 + 0.2 * bookMult(p, 'lexicon'))),
        skullDmg: Math.round((2 + st.might / (p.cls === 'warrior' ? 3.3 : 3) + 0.12 * p.level) * (1 + (g.skullPct || 0)) * 10) / 10,
        manaCap: 14 + st.focus + Math.round(3 * bookMult(p, 'tides')),
        spellPower: 1 + (p.cls === 'mage' ? 0.07 : 0.06) * scaleStat + 0.02 * p.level + (g.spellPct || 0),
        crit: Math.min(0.6, 0.015 * st.fortune + (g.critPct || 0) + 0.04 * bookMult(p, 'stars')),
        goldMult: 1 + 0.03 * st.fortune + (g.goldPct || 0) + 0.25 * bookMult(p, 'ledger'),
        xpMult: 1 + 0.02 * st.fortune + (g.xpPct || 0) + 0.15 * bookMult(p, 'bestiary'),
        ward: Math.min(0.5, g.ward || 0),
        lifesteal: Math.min(0.5, g.lifesteal || 0),
        thorns: g.thorns || 0,
        haste: Math.min(0.3, g.haste || 0),
        manaPer, startMana,
        leafHeal: bookMult(p, 'almanac'),
        fireBoost: 0.2 * bookMult(p, 'ember'),
        slots: 4 + (p.books.stars ? 1 : 0),
    };
}

export function heroSide(p) {
    const h = heroStats(p);
    const bl = new Set(p.blessings.map((b) => b.id));
    const mana = { ...h.startMana };
    if (bl.has('ember')) mana.fire += 6;
    if (bl.has('tide')) mana.water += 6;
    if (bl.has('grove')) mana.leaf += 6;
    if (bl.has('storm')) mana.spark += 6;
    return {
        name: p.name, isPlayer: true, level: p.level,
        maxHp: h.maxHp, hp: h.maxHp, shield: (bl.has('aegis') ? 15 : 0) + (p.cls === 'mage' ? Math.round(h.maxHp * 0.2) : 0), ward: h.ward, thorns: h.thorns,
        skullDmg: h.skullDmg + (bl.has('might') ? 2 : 0), crit: h.crit, spellPower: h.spellPower,
        manaCap: h.manaCap, mana, manaPer: h.manaPer,
        spells: p.slots.filter((id) => p.spells[id]).map((id) => ({ id, rank: p.spells[id] })),
        buffs: [], goldMult: h.goldMult * (bl.has('fortune') ? 1.4 : 1), xpMult: h.xpMult * (bl.has('wisdom') ? 1.4 : 1),
        leafHeal: h.leafHeal, lifesteal: h.lifesteal, fireBoost: h.fireBoost, hasteChance: h.haste,
        weak: null, resist: null,
    };
}

// ------------------------------------------------------------------ Spells

function learnSpells(p) {
    const learned = [];
    for (const [id, s] of Object.entries(SPELLS)) {
        const ok = (s.cls === p.cls && p.level >= s.lvl) || (s.cls === 'book' && p.books.gears);
        if (ok && !p.spells[id]) {
            p.spells[id] = id === 'clockbomb' ? 1 + Math.max(0, (p.books.gears || 1) - 1) : 1;
            learned.push(id);
            if (p.slots.length < heroStats(p).slots) p.slots.push(id);
        }
    }
    return learned;
}

export function setSlots(p, ids) {
    const max = heroStats(p).slots;
    p.slots = [...new Set(ids.filter((id) => p.spells[id]))].slice(0, max);
    return p.slots;
}

export function rankUpSpell(p, id) {
    const r = p.spells[id];
    if (!r || r >= maxSpellRank(p)) return { ok: false, why: 'Mage Tower level too low' };
    const cost = rankCost(r);
    if (!canAfford(p, cost)) return { ok: false, why: 'Not enough resources' };
    pay(p, cost);
    p.spells[id] = r + 1;
    return { ok: true, rank: r + 1 };
}

// ------------------------------------------------------------------ XP & levels

export function gainXp(p, n, src = 'other') {
    const ups = [];
    p.xp += Math.round(n);
    bump(p, `xpFrom.${src}`, Math.round(n));
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
        p.xp -= xpToNext(p.level);
        p.level++;
        p.points += POINTS_PER_LEVEL;
        const spells = learnSpells(p);
        const buildings = BUILDING_IDS.filter((id) => BUILDINGS[id].unlock.level === p.level);
        for (const b of buildings) queueStory(p, 'unlock_' + b);
        ups.push({ level: p.level, spells, buildings });
    }
    if (p.level >= MAX_LEVEL) p.xp = Math.min(p.xp, xpToNext(p.level));
    return ups;
}

export function allocate(p, stat) {
    if (p.points <= 0 || !STATS.includes(stat)) return false;
    p.points--; p.alloc[stat]++;
    return true;
}
export function autoAllocate(p) {
    const pref = CLASSES[p.cls].prefer;
    let i = (p.level * 7) % pref.length;
    while (p.points > 0) allocate(p, pref[i++ % pref.length]);
}
export function respecCost(p) { return 30 * p.level; }
export function respec(p) {
    const c = respecCost(p);
    if (p.res.gold < c) return false;
    p.res.gold -= c;
    for (const s of STATS) { p.points += p.alloc[s]; p.alloc[s] = 0; }
    return true;
}

// ------------------------------------------------------------------ Items

export function addItem(p, item) {
    p.bag.push(item);
    let sold = null;
    if (p.bag.length > BAG_LIMIT) {
        // Bag overflow: sell the least useful item automatically.
        let worst = 0;
        p.bag.forEach((it, i) => { if (itemScore(it, p.cls) < itemScore(p.bag[worst], p.cls)) worst = i; });
        sold = p.bag.splice(worst, 1)[0];
        p.res.gold += sold.value;
    }
    return sold;
}

export function equip(p, uid) {
    const i = p.bag.findIndex((it) => it.uid === uid);
    if (i < 0) return false;
    const it = p.bag[i];
    p.bag.splice(i, 1);
    if (p.gear[it.slot]) p.bag.push(p.gear[it.slot]);
    p.gear[it.slot] = it;
    clampSlots(p);
    return true;
}
export function unequip(p, slot) {
    if (!p.gear[slot] || p.bag.length >= BAG_LIMIT) return false;
    p.bag.push(p.gear[slot]);
    p.gear[slot] = null;
    return true;
}
export function sell(p, uid) {
    const i = p.bag.findIndex((it) => it.uid === uid);
    if (i < 0) return 0;
    const it = p.bag.splice(i, 1)[0];
    p.res.gold += it.value;
    return it.value;
}
function clampSlots(p) { p.slots = p.slots.slice(0, heroStats(p).slots); }

function dropItem(p, iL, luck, minRarity = 0) {
    return withRng(p, (r) => {
        let rarity = null;
        if (minRarity) rarity = Math.max(minRarity, r.int(minRarity, Math.min(4, minRarity + 1)) - (r.chance(0.5) ? 1 : 0));
        return makeItem(r, { cls: p.cls, iL, luck, rarity: rarity ?? undefined, uid: p.uid++ });
    });
}

// ------------------------------------------------------------------ Town

export function tick(p, now) {
    tickTown(p, now);
    p.t = now;
}

/** Baskets as they stand at `now` without collecting (for the away summary). */
export function catchUp(p, now) {
    const before = {};
    for (const id of BUILDING_IDS) if (p.town[id] && BUILDINGS[id].res) before[id] = p.town[id].basket || 0;
    const minutes = Math.max(0, (now - (p.t || now)) / 60000);
    tickTown(p, now);
    p.t = now;
    const gained = {};
    for (const id of Object.keys(before)) {
        const d = p.town[id].basket - before[id];
        if (d >= 1) gained[id] = Math.floor(d);
    }
    return { minutes, gained };
}

export function collect(p, id) {
    const b = p.town[id];
    if (!b || !BUILDINGS[id].res) return null;
    const n = Math.floor(b.basket || 0);
    if (n <= 0) return null;
    b.basket -= n;
    const res = BUILDINGS[id].res;
    let ups = [];
    if (res === 'xp') ups = gainXp(p, n, 'training');
    else { p.res[res] += n; bump(p, `collected.${res}`, n); }
    return { id, res, n, ups };
}

export function collectAll(p) {
    const out = [];
    for (const id of BUILDING_IDS) { const c = collect(p, id); if (c) out.push(c); }
    return out;
}

export function canBuild(p, id) {
    if (!isUnlocked(p, id)) return { ok: false, why: 'Locked' };
    const L = bLevel(p, id);
    if (L >= levelCap(p)) return { ok: false, why: `Level cap ${levelCap(p)} — return more books to raise it` };
    const cost = buildCost(p, id);
    if (!canAfford(p, cost)) return { ok: false, why: 'Not enough resources', cost };
    return { ok: true, cost };
}

export function freePlots(p) {
    const used = new Set(Object.values(p.town).map((b) => b.plot));
    return [...Array(PLOTS).keys()].filter((i) => !used.has(i));
}

export function build(p, id, plot, now) {
    const c = canBuild(p, id);
    if (!c.ok) return c;
    if (!p.town[id]) {
        if (plot === undefined || plot === null) plot = freePlots(p)[0];
        if (plot === undefined || freePlots(p).indexOf(plot) < 0) return { ok: false, why: 'No free plot' };
        tickTown(p, now);
        pay(p, c.cost);
        p.town[id] = { level: 1, plot, basket: 0, t: now };
    } else {
        tickTown(p, now);
        pay(p, c.cost);
        p.town[id].level++;
    }
    bump(p, 'upgrades');
    return { ok: true, level: p.town[id].level };
}

export function craft(p, slot) {
    if (!bLevel(p, 'forge')) return { ok: false, why: 'Build a Forge first' };
    const cost = forgeCost(p);
    if (!canAfford(p, cost)) return { ok: false, why: 'Not enough resources' };
    pay(p, cost);
    const item = withRng(p, (r) => makeItem(r, { cls: p.cls, slot, iL: forgeItemLevel(p), luck: forgeLuck(p), uid: p.uid++ }));
    const sold = addItem(p, item);
    return { ok: true, item, sold };
}

export function brew(p, id) {
    if (!potionUnlocked(p, id)) return { ok: false, why: 'Alchemist level too low' };
    const cost = POTIONS[id].cost;
    if (!canAfford(p, cost)) return { ok: false, why: 'Not enough ingredients' };
    pay(p, cost);
    p.potions[id]++;
    return { ok: true };
}

export function study(p, bookId) {
    const book = BOOK_BY_ID[bookId];
    const t = p.books[bookId];
    if (!book || !t) return { ok: false, why: 'Not recovered yet' };
    if (t >= MAX_TIER) return { ok: false, why: 'Fully studied' };
    if (bLevel(p, 'scriptorium') < studyReq(t + 1)) return { ok: false, why: `Needs Scriptorium level ${studyReq(t + 1)}` };
    const cost = studyCost(book, t + 1);
    if (!canAfford(p, cost)) return { ok: false, why: 'Not enough ink or gold', cost };
    pay(p, cost);
    p.books[bookId] = t + 1;
    if (bookId === 'gears') p.spells.clockbomb = Math.max(p.spells.clockbomb || 1, t + 1);
    return { ok: true, tier: t + 1 };
}

// ------------------------------------------------------------------ Quests

export function refreshQuests(p) {
    const slots = questSlots(p);
    withRng(p, (r) => { while (p.quests.active.length < slots) p.quests.active.push(makeQuest(p, r)); });
}

export function claimQuest(p, qid) {
    const q = p.quests.active.find((x) => x.id === qid);
    if (!q || !questDone(p, q)) return null;
    p.quests.active = p.quests.active.filter((x) => x !== q);
    const got = { gold: q.reward.gold, xp: q.reward.xp };
    p.res.gold += q.reward.gold;
    for (const r of RES) if (r !== 'gold' && q.reward[r]) { p.res[r] += q.reward[r]; got[r] = q.reward[r]; }
    if (q.reward.potion) { p.potions[q.reward.potion]++; got.potion = q.reward.potion; }
    if (q.reward.item) { got.item = dropItem(p, p.level + 1, 0.8, 1); got.sold = addItem(p, got.item); }
    got.ups = gainXp(p, q.reward.xp, 'quest');
    bump(p, 'questsDone');
    refreshQuests(p);
    return got;
}

export function rerollCost(p) { return 10 + p.level * 4; }
export function rerollQuest(p, qid) {
    const i = p.quests.active.findIndex((x) => x.id === qid);
    if (i < 0 || p.res.gold < rerollCost(p)) return false;
    p.res.gold -= rerollCost(p);
    withRng(p, (r) => { p.quests.active[i] = makeQuest(p, r); });
    return true;
}

// ------------------------------------------------------------------ The wings

const mapCache = new Map();
export function wingMap(p, wi) {
    const key = `${p.seed}:${wi}`;
    if (!mapCache.has(key)) mapCache.set(key, generateWingMap(p.seed, wi));
    return mapCache.get(key);
}

export function nodeState(p, wi, id) {
    const map = wingMap(p, wi);
    const w = p.wings[wi];
    if (wi > p.wingOpen) return 'locked';
    if (w.cleared[id]) return 'cleared';
    return openNodes(map, w.cleared).has(id) ? 'open' : 'locked';
}

/** The monster a battle context will field. Deterministic per visit. */
export function monsterFor(p, ctx) {
    if (ctx.type === 'node' || ctx.type === 'patrol') {
        const W = WINGS[ctx.wing];
        const map = wingMap(p, ctx.wing);
        const visits = p.wings[ctx.wing].visits[ctx.node ?? 'patrol'] || 0;
        const r = makeRng(hashSeed(p.seed, 'mon', ctx.wing, ctx.node ?? 'patrol', visits, ctx.type === 'patrol' ? p.counters.battles : 0));
        if (ctx.type === 'patrol') {
            const lvl = clamp(Math.round(r.range(W.lo, W.hi)), 1, 60);
            const fam = r.chance(0.08) ? W.rare : r.pick(W.bestiary);
            return makeMonster(r, { level: Math.max(lvl, Math.min(W.hi, p.level - 1)), family: fam, rank: 'normal', tier: ctx.wing });
        }
        const node = map.nodes[ctx.node];
        if (node.kind === 'keeper' || node.kind === 'guardian' || node.kind === 'final') {
            const b = W[node.kind];
            return makeMonster(r, { level: node.level + (node.kind === 'guardian' ? 1 : 0), family: b.family, rank: node.kind, name: b.name, signature: b.signature, mods: b.mods, tier: ctx.wing, resist: b.resist });
        }
        const fam = r.chance(0.08) ? W.rare : r.pick(W.bestiary);
        return makeMonster(r, { level: node.level, family: fam, rank: node.kind === 'elite' ? 'elite' : 'normal', tier: ctx.wing });
    }
    if (ctx.type === 'bounty') {
        const q = p.quests.active.find((x) => x.id === ctx.quest);
        const b = q.bounty;
        const r = makeRng(b.seed);
        const m = makeMonster(r, { level: b.level, family: b.family, rank: 'elite' });
        m.name = 'Wanted: ' + m.name;
        m.side.name = m.name;
        return m;
    }
    if (ctx.type === 'endless') {
        const f = p.endless.floor;
        const r = makeRng(hashSeed(p.seed, 'endless', f));
        const famIds = Object.keys(FAMILIES);
        return makeMonster(r, { level: 33 + f, family: r.pick(famIds), rank: f % 5 === 0 ? 'elite' : 'normal', tier: 6 });
    }
    throw new Error('unknown battle context ' + ctx.type);
}

/** Potions actually carried into a battle (loadout clipped to stock and carry limit). */
export function carried(p) {
    const out = {};
    let left = carryLimit(p);
    for (const id of POTION_IDS) {
        const n = Math.min(p.loadout[id] || 0, p.potions[id], left);
        if (n > 0) { out[id] = n; left -= n; }
    }
    return out;
}

export function startBattle(p, ctx) {
    const mon = monsterFor(p, ctx);
    const side = heroSide(p);
    const seed = hashSeed(p.seed, 'battle', p.counters.battles, ctx.type, ctx.wing ?? 0, ctx.node ?? 0);
    const potions = carried(p);
    const L = mon.level;
    const bt = makeBattle(side, mon.side, seed, { potions, coinValue: 1 + L * 0.35, starValue: 1 + L * 0.3, kind: mon.rank });
    if (!p.books.bestiary) { bt.sides.e.weakHidden = true; }
    return { ctx, mon, bt, carriedPotions: { ...potions } };
}

export function finishBattle(p, run) {
    const { ctx, mon, bt } = run;
    const h = bt.sides.p;
    const win = bt.over === 'win';
    const out = { win, xp: 0, gold: 0, items: [], book: null, ups: [], story: [], sold: [] };
    p.counters.battles++;
    // Potions spent
    for (const [id, n] of Object.entries(run.carriedPotions)) p.potions[id] -= n - (bt.potions[id] || 0);
    // Quest counters
    bt.stats.gems.forEach((n, i) => { if (n) bump(p, `gems.${i}`, n); });
    bump(p, 'fours', bt.stats.fours);
    bump(p, 'cascades', bt.stats.cascades);
    bump(p, 'spells', bt.stats.spells);
    bump(p, 'potions', bt.stats.potions);
    // Blessings fade with every battle fought.
    p.blessings = p.blessings.map((b) => ({ ...b, left: b.left - 1 })).filter((b) => b.left > 0);

    if (win) {
        out.xp = Math.round((mon.xp * h.xpMult) + bt.loot.xp);
        out.gold = Math.round((mon.gold * h.goldMult) + bt.loot.gold);
        bump(p, 'wins');
        bump(p, `kills.${mon.family}`);
        if (h.hp >= h.maxHp * 0.7) bump(p, 'flawless');
        // Loot
        const dropChance = { normal: 0.2, elite: 0.65, keeper: 1, guardian: 1, final: 1 }[mon.rank] ?? 0.2;
        const luck = { normal: 0, elite: 0.8, keeper: 1.2, guardian: 1.6, final: 2.5 }[mon.rank] ?? 0;
        if (withRng(p, (r) => r.chance(dropChance))) {
            const it = dropItem(p, mon.level, luck, mon.rank === 'guardian' || mon.rank === 'final' ? 2 : mon.rank === 'keeper' ? 1 : 0);
            out.items.push(it);
            const s = addItem(p, it); if (s) out.sold.push(s);
        }
        if (ctx.type === 'node') {
            const w = p.wings[ctx.wing];
            const node = wingMap(p, ctx.wing).nodes[ctx.node];
            w.cleared[ctx.node] = true;
            if (node.kind === 'keeper' || node.kind === 'guardian' || node.kind === 'final') {
                const book = BOOKS.find((b) => b.wing === ctx.wing && b.at === node.kind);
                if (book && !p.books[book.id]) {
                    p.books[book.id] = 1;
                    out.book = book.id;
                    learnSpells(p);
                    clampSlots(p);
                    if (book.unlock) queueStory(p, 'unlock_' + book.unlock);
                }
                const key = node.kind === 'final' ? 'final_post' : `${node.kind}_post_${ctx.wing}`;
                queueStory(p, key);
                if (node.kind === 'keeper') w.keeper = true;
                if (node.kind === 'guardian') {
                    w.guardian = true;
                    if (p.wingOpen === ctx.wing && ctx.wing < WINGS.length - 1) {
                        p.wingOpen = ctx.wing + 1;
                    }
                }
                if (node.kind === 'final') { p.won = true; queueStory(p, 'ending'); }
            }
        }
        if (ctx.type === 'bounty') {
            const q = p.quests.active.find((x) => x.id === ctx.quest);
            if (q) q.done = true;
        }
        if (ctx.type === 'endless') {
            p.endless.best = Math.max(p.endless.best, p.endless.floor);
            p.endless.floor++;
        }
    } else {
        out.xp = Math.round(bt.loot.xp * 0.5);
        out.gold = Math.max(0, Math.round(bt.loot.gold * 0.5));
        bump(p, 'losses');
    }
    if (ctx.type === 'node' || ctx.type === 'patrol') {
        const k = ctx.node ?? 'patrol';
        p.wings[ctx.wing].visits[k] = (p.wings[ctx.wing].visits[k] || 0) + 1;
    }
    p.res.gold += out.gold;
    out.ups = gainXp(p, out.xp, 'battle');
    refreshQuests(p);
    return out;
}

// ------------------------------------------------------------------ Non-battle nodes

function unitGold(p) { return 20 + p.level * 10; }
function unitXp(p) { return 15 + p.level * 8 + p.level * p.level * 0.5; }
function unitRes(p) { return 30 + p.level * 10; }

export function nodeEvent(p, wi, id) {
    const r = makeRng(hashSeed(p.seed, 'event', wi, id));
    return r.pick(EVENTS);
}

export function shrineOptions(p, wi, id) {
    const r = makeRng(hashSeed(p.seed, 'shrine', wi, id));
    const ids = r.shuffle(BLESSING_IDS.slice());
    return ids.slice(0, 2);
}

function addBlessing(p, id) {
    p.blessings = p.blessings.filter((b) => b.id !== id);
    p.blessings.push({ id, left: BLESSING_BATTLES });
}

export function openTreasure(p, wi, id) {
    if (nodeState(p, wi, id) !== 'open') return null;
    const node = wingMap(p, wi).nodes[id];
    const gold = Math.round(unitGold(p) * 1.5);
    p.res.gold += gold;
    const item = dropItem(p, node.level + 1, 1.2, 1);
    const sold = addItem(p, item);
    p.wings[wi].cleared[id] = true;
    return { gold, item, sold };
}

export function takeBlessing(p, wi, id, bid) {
    if (nodeState(p, wi, id) !== 'open' || !shrineOptions(p, wi, id).includes(bid)) return false;
    addBlessing(p, bid);
    p.wings[wi].cleared[id] = true;
    return true;
}

export function resolveEvent(p, wi, id, choice) {
    if (nodeState(p, wi, id) !== 'open') return null;
    const ev = nodeEvent(p, wi, id);
    const eff = ev.choices[choice]?.effect;
    if (!eff) return null;
    const got = { ups: [] };
    if (eff.pay) {
        const c = Math.round(unitGold(p) * 2 * eff.pay);
        if (p.res.gold < c) return { fail: `You need ${c} gold.` };
        p.res.gold -= c; got.paid = c;
    }
    if (eff.gold) { const n = Math.round(unitGold(p) * 2 * eff.gold); p.res.gold += n; got.gold = n; }
    if (eff.xp) { const n = Math.round(unitXp(p) * 2 * eff.xp); got.xp = n; got.ups = gainXp(p, n, 'event'); }
    for (const r of ['wood', 'stone', 'herbs', 'crystal', 'ink']) if (eff[r]) { const n = Math.round(unitRes(p) * eff[r] * (r === 'crystal' || r === 'ink' ? 0.3 : 1)); p.res[r] += n; got[r] = n; }
    if (eff.blessing) { const b = withRng(p, (r) => r.pick(BLESSING_IDS)); addBlessing(p, b); got.blessing = b; }
    if (eff.item) { got.item = dropItem(p, p.level + 1, 1.5, 1); got.sold = addItem(p, got.item); }
    if (eff.potion) { const pid = withRng(p, (r) => r.pick(POTION_IDS)); p.potions[pid]++; got.potion = pid; }
    p.wings[wi].cleared[id] = true;
    return got;
}

// ------------------------------------------------------------------ Story

export function queueStory(p, key) {
    if (p.story.seen[key] || p.story.queue.includes(key)) return;
    p.story.queue.push(key);
}
export function nextStory(p) {
    const key = p.story.queue.shift();
    if (key) p.story.seen[key] = true;
    return key || null;
}

/** Pre-fight story for a node, if any (keeper/guardian/final). */
export function preFightScene(p, ctx) {
    if (ctx.type !== 'node') return null;
    const node = wingMap(p, ctx.wing).nodes[ctx.node];
    if (node.kind === 'final') return 'final_pre';
    if (node.kind === 'keeper' || node.kind === 'guardian') return `${node.kind}_pre_${ctx.wing}`;
    return null;
}

// ------------------------------------------------------------------ Misc

export function buildingInfo(p, id) {
    const def = BUILDINGS[id];
    return {
        id, def, level: bLevel(p, id), unlocked: isUnlocked(p, id), cap: levelCap(p),
        rate: rate(p, id), capacity: p.town[id] ? capacity(p, id) : 0, basket: p.town[id]?.basket || 0,
        cost: buildCost(p, id),
    };
}

export function booksReturned(p) { return Object.keys(p.books).length; }

export { carryLimit, questSlots, levelCap, maxSpellRank, forgeCost, forgeItemLevel, BLESSINGS };
