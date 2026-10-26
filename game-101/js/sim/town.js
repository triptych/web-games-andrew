// The town: shops, the inn and its recruits, the church, the tavern, and the Guild's investments
// (the idle part: businesses you own pay you every day and give you a discount). Pure.

import { seeded } from '../rng.js';
import { MAX_PARTY, IDLE_SECONDS_PER_DAY, SLOTS } from '../config.js';
import { say, ev, avgLvl, clamp } from './core.js';
import {
    genWeapon, genArmor, genCharm, genPotion, genScroll, genWand, genTome, priceOf, POTIONS, WANDS, WEAPONS, purify,
} from './items.js';
import { calc, makeMember, CLASS_IDS, CLASSES, fullHeal, healMember, isAlive, slotFor, canEquip, itemScore } from './party.js';
import { give, take } from './inv.js';
import { recItem, misc } from './journal.js';
import { genQuest } from './quests.js';

export const BIZ = {
    tavern: { name: 'Hearth & Hound Tavern', short: 'Tavern', baseCost: 150, baseInc: 9, perk: 'meal prices' },
    items: { name: 'Item Shop', short: 'Item Shop', baseCost: 200, baseInc: 11, perk: 'item shop prices' },
    smith: { name: 'Weaponsmith', short: 'Smithy', baseCost: 260, baseInc: 14, perk: 'weapon and armour prices' },
    magic: { name: 'Magic Emporium', short: 'Magic', baseCost: 320, baseInc: 17, perk: 'magic shop prices' },
    inn: { name: 'Inn', short: 'Inn', baseCost: 180, baseInc: 10, perk: 'room rates and recruiting fees' },
    church: { name: 'Church', short: 'Church', baseCost: 240, baseInc: 12, perk: 'temple fees' },
    guild: { name: "Adventurers' Guild", short: 'Guild', baseCost: 400, baseInc: 20, perk: 'sell prices and quest rewards' },
};
export const BIZ_IDS = Object.keys(BIZ);

export const newBiz = () => Object.fromEntries(BIZ_IDS.map((k) => [k, { lvl: 0, pend: 0, total: 0 }]));
export const discount = (lvl) => 0.6 * (1 - Math.pow(0.955, lvl));
export const disc = (G, id) => discount(G.biz[id].lvl);
export const investCost = (G, id) => Math.round(BIZ[id].baseCost * Math.pow(1.32, G.biz[id].lvl));
export function income(G, id, lvl = G.biz[id].lvl) {
    if (lvl <= 0) return 0;
    return Math.round(BIZ[id].baseInc * lvl * Math.pow(1.08, lvl - 1) * (1 + G.maxDepth * 0.04));
}
export const pendCap = (G, id) => income(G, id) * 10;
export const totalPending = (G) => BIZ_IDS.reduce((a, k) => a + G.biz[k].pend, 0);
export const totalIncome = (G) => BIZ_IDS.reduce((a, k) => a + income(G, k), 0);
const syncBonus = (G) => { G.guildBonus = disc(G, 'guild'); };

export function invest(G, id) {
    const cost = investCost(G, id);
    if (G.gold < cost) { say(G, 'Not enough gold.', 12); return false; }
    G.gold -= cost; G.stats.goldSpent += cost;
    G.biz[id].lvl++;
    syncBonus(G);
    misc(G, 'investments');
    say(G, `${BIZ[id].name} upgraded to level ${G.biz[id].lvl}.`, 10);
    ev(G, 'invest', { id });
    return true;
}
export function collect(G) {
    let sum = 0;
    for (const k of BIZ_IDS) { sum += G.biz[k].pend; G.biz[k].total += G.biz[k].pend; G.biz[k].pend = 0; }
    if (sum > 0) { G.gold += sum; G.stats.goldEarned += sum; misc(G, 'collected', sum); say(G, `Collected ${sum}g from your businesses.`, 14); ev(G, 'gold'); }
    return sum;
}

// ------------------------------------------------------------------ time
export function advanceDay(G, quiet = false) {
    G.day++;
    G.stats.days++;
    for (const k of BIZ_IDS) {
        const inc = income(G, k);
        if (inc) G.biz[k].pend = Math.min(pendCap(G, k), G.biz[k].pend + inc);
    }
    restock(G);
    refreshRecruits(G);
    refreshBoard(G);
    if (!quiet) ev(G, 'day', { day: G.day });
}
/** Real time passing (the tab open, or closed for a while). Pure: main supplies the seconds. */
export function tickIdle(G, seconds) {
    G.idleAcc += seconds;
    let n = 0;
    while (G.idleAcc >= IDLE_SECONDS_PER_DAY) { G.idleAcc -= IDLE_SECONDS_PER_DAY; advanceDay(G, true); n++; }
    if (n) ev(G, 'idleDays', { n });
    return n;
}

// ------------------------------------------------------------------ gear for new members
export function kitOut(rng, m, ilvl) {
    const c = CLASSES[m.cls];
    const w = genWeapon(rng, ilvl, { base: rng.pick(WEAPONS.filter((b) => c.wpn.includes(b.grp))).id, rar: 0, noCurse: true });
    m.eq.weapon = w;
    for (const slot of ['body', 'head', 'hands', 'feet', 'shield']) {
        if (slot === 'shield' && (!c.shield || w.hands === 2)) continue;
        const a = genArmor(rng, ilvl, { slot, maxWt: c.wt, rar: 0, noCurse: true });
        if (canEquip(m, a).ok) m.eq[slot] = a;
    }
    for (const slot of SLOTS) if (m.eq[slot]) { m.eq[slot].id = 0; }
    const s = calc(m);
    m.hp = s.maxhp; m.mp = s.maxmp;
}

// ------------------------------------------------------------------ shops
export const SHOPS = ['items', 'smith', 'magic'];
export function restock(G) {
    const rng = seeded(G.seed, G.day, 31 + Math.floor(G.maxDepth / 3));
    const il = Math.max(1, G.maxDepth);
    const items = [];
    const P = (eff, bonus = 0) => genPotion(rng, il + bonus, eff);
    items.push(P('heal', -2), P('heal'), P('mana', -1), P('antidote', -2));
    if (G.maxDepth >= 3) items.push(P('panacea'), P('revive', -2));
    if (G.maxDepth >= 5) items.push(P('heal', 5), P('mana', 4));
    if (G.maxDepth >= 8) items.push(P('might'), P('ward'), P('haste'));
    if (G.maxDepth >= 12) items.push(P('elixir'));
    items.push(genScroll(rng, il, 'escape'), genScroll(rng, il, 'map'));
    const smith = [];
    for (const b of ['sword', 'axe', 'mace', 'spear', 'bow', 'staff', 'dagger', 'whip', 'wand']) smith.push(genWeapon(rng, il + rng.int(-2, 1), { base: b, maxRarity: 2, noCurse: true, minRarity: rng() < 0.4 ? 1 : 0 }));
    for (const slot of ['shield', 'head', 'body', 'hands', 'feet', 'body', 'head']) smith.push(genArmor(rng, il + rng.int(-2, 1), { slot, maxRarity: 2, noCurse: true, minRarity: rng() < 0.4 ? 1 : 0 }));
    const magic = [];
    for (const s of ['fire', 'ice', 'shock', 'sleep', 'holy']) magic.push(genScroll(rng, il + rng.int(-2, 1), s));
    magic.push(genScroll(rng, il, 'teleport'));
    for (let i = 0; i < 2; i++) magic.push(genWand(rng, il + rng.int(-1, 2)));
    for (let i = 0; i < 5; i++) magic.push(genCharm(rng, il + rng.int(-1, 2), { maxRarity: 3, noCurse: true }));
    if (G.maxDepth >= 4) magic.push(genTome(rng, il));
    const uniq = (list) => list.filter((it, i) => it.sig == null || list.findIndex((x) => x.sig === it.sig) === i);
    items.splice(0, items.length, ...uniq(items));
    for (const list of [items, smith, magic]) list.forEach((it, i) => { it.sid = i + 1; it.price = priceOf(it); });
    G.town.stock = { day: G.day, items, smith, magic, sold: { smith: [], magic: [] } };
}
export function shopStock(G, shop) {
    const st = G.town.stock;
    if (shop === 'items') return st.items;
    return st[shop].filter((it) => !st.sold[shop].includes(it.sid));
}
export const buyPrice = (G, shop, it) => Math.max(1, Math.round(it.price * (1 - disc(G, shop))));
export const sellPrice = (G, it) => {
    const mul = 0.35 + 0.35 * (disc(G, 'guild') / 0.6);
    return Math.max(1, Math.round(priceOf(it) * mul));
};

export function buy(G, shop, sid, qty = 1) {
    const st = G.town.stock, list = shop === 'items' ? st.items : st[shop];
    const it = list.find((x) => x.sid === sid);
    if (!it) return false;
    const stackBuy = it.sig != null;
    qty = stackBuy ? clamp(qty, 1, 99) : 1;
    const cost = buyPrice(G, shop, it) * qty;
    if (G.gold < cost) { say(G, 'Not enough gold.', 12); return false; }
    const copy = JSON.parse(JSON.stringify(it));
    delete copy.sid;
    copy.n = stackBuy ? qty : undefined;
    if (!stackBuy) delete copy.n;
    if (G.inv.length >= 80 && !(stackBuy && G.inv.some((x) => x.sig === copy.sig))) { say(G, 'Your bag is full.', 12); return false; }
    G.gold -= cost; G.stats.goldSpent += cost;
    give(G, copy, 'bought');
    if (!stackBuy && shop !== 'items') st.sold[shop].push(sid);
    say(G, `Bought ${it.name}${stackBuy && qty > 1 ? ' ×' + qty : ''} for ${cost}g.`, 14);
    ev(G, 'buy');
    return true;
}
export function sell(G, id, qty = 1) {
    const it = G.inv.find((x) => x.id === id);
    if (!it) return false;
    const n = clamp(qty, 1, it.n || 1);
    const gold = sellPrice(G, it) * n;
    if (G.party.some((m) => Object.values(m.eq).includes(it))) return false;
    const taken = take(G, id, n);
    recItem(G, taken, 'sold', n);
    G.gold += gold; G.stats.goldEarned += gold;
    say(G, `Sold ${it.name}${n > 1 ? ' ×' + n : ''} for ${gold}g.`, 14);
    ev(G, 'sell');
    return true;
}
/** Sell every collectible the open quests do not need. */
export function sellJunk(G) {
    const need = new Set(G.quests.active.filter((q) => q.type === 'gather').map((q) => q.cid));
    let total = 0, n = 0;
    for (const it of [...G.inv]) {
        if (it.t !== 'x') continue;
        if (need.has(it.cid)) continue;
        const g = sellPrice(G, it) * it.n;
        total += g; n += it.n;
        recItem(G, it, 'sold', it.n);
        take(G, it.id, it.n);
    }
    G.gold += total; G.stats.goldEarned += total;
    say(G, n ? `Sold ${n} collectibles for ${total}g.` : 'Nothing to sell.', n ? 14 : 7);
    if (n) ev(G, 'sell');
    return total;
}
export const rechargeCost = (G, it) => Math.max(1, Math.round((it.max - it.charges) * (6 + it.ilvl * 1.5) * (1 - disc(G, 'magic'))));
export function recharge(G, id) {
    const it = G.inv.find((x) => x.id === id);
    if (!it || it.t !== 'm') return false;
    const c = rechargeCost(G, it);
    if (it.charges >= it.max) return false;
    if (G.gold < c) { say(G, 'Not enough gold.', 12); return false; }
    G.gold -= c; G.stats.goldSpent += c; it.charges = it.max;
    say(G, `${it.name} recharged for ${c}g.`, 11);
    return true;
}

// ------------------------------------------------------------------ inn
export const roomCost = (G) => Math.round((8 + avgLvl(G) * 2.5) * G.party.length * (1 - disc(G, 'inn')));
export function rest(G) {
    const c = roomCost(G);
    if (G.gold < c) { say(G, 'You cannot afford a room.', 12); return false; }
    G.gold -= c; G.stats.goldSpent += c;
    for (const m of G.party) if (m.hp > 0) { const keepCurse = m.st.curse; fullHeal(m); if (keepCurse) m.st.curse = true; } else { /* the fallen need a priest */ }
    advanceDay(G);
    misc(G, 'rests');
    say(G, `The party rests. Day ${G.day} begins.`, 10);
    ev(G, 'rest');
    return true;
}
export const recruitCost = (G, r) => Math.round((40 + Math.pow(r.lvl, 1.6) * 16) * (1 - disc(G, 'inn') * 0.8));
export function refreshRecruits(G) {
    const rng = seeded(G.seed, G.day, 77);
    const avg = Math.max(1, avgLvl(G));
    const counts = {};
    for (const m of G.party) counts[m.cls] = (counts[m.cls] || 0) + 1;
    const out = [];
    for (let i = 0; i < 3; i++) {
        const cls = rng.weighted(CLASS_IDS, (c) => 1 / (1 + (counts[c] || 0)));
        const lvl = Math.max(1, Math.round(avg + rng.int(-3, 2)));
        const m = makeMember(rng, cls, lvl);
        kitOut(rng, m, Math.max(1, Math.round(Math.max(lvl, G.maxDepth * 0.8))));
        out.push(m);
    }
    G.town.recruits = out;
}
export function recruit(G, idx) {
    const r = G.town.recruits[idx];
    if (!r) return false;
    if (G.party.length >= MAX_PARTY) { say(G, 'The party is full.', 12); return false; }
    const c = recruitCost(G, r);
    if (G.gold < c) { say(G, 'Not enough gold.', 12); return false; }
    G.gold -= c; G.stats.goldSpent += c;
    G.town.recruits.splice(idx, 1);
    G.party.push(r);
    for (const slot of SLOTS) if (r.eq[slot]) r.eq[slot].id = ++G.uid;
    say(G, `${r.name} the ${CLASSES[r.cls].name} joins the party!`, 10);
    ev(G, 'recruit');
    misc(G, 'recruited');
    return true;
}
/** Send a member home; their gear goes back in the bag. */
export function dismiss(G, idx) {
    if (G.party.length <= 1) return false;
    const [m] = G.party.splice(idx, 1);
    for (const slot of SLOTS) { const it = m.eq[slot]; if (it) { it.id = it.id || ++G.uid; give(G, it, 'reward'); } }
    say(G, `${m.name} leaves the party.`, 7);
    return true;
}

// ------------------------------------------------------------------ church
export const churchPrice = (G, svc, m) => {
    const L = m ? m.lvl : avgLvl(G);
    const base = { revive: 50 + L * 25, cure: 10 + L * 3, curse: 40 + L * 14, heal: 20 + L * 6, bless: 120 + avgLvl(G) * 30 }[svc];
    return Math.max(1, Math.round(base * (1 - disc(G, 'church'))));
};
export const cursedGear = (m) => SLOTS.map((s) => m.eq[s]).filter((it) => it && it.cursed);
export function church(G, svc, idx) {
    const m = G.party[idx];
    if (svc === 'bless') {
        const c = churchPrice(G, 'bless');
        if (G.gold < c) { say(G, 'Not enough gold.', 12); return false; }
        G.gold -= c; G.stats.goldSpent += c; G.bless = { left: 10 };
        say(G, 'A blessing settles on the party: +20% gold for 10 battles.', 10);
        return true;
    }
    if (!m) return false;
    const c = churchPrice(G, svc, m);
    let ok = false;
    if (G.gold < c) { say(G, 'Not enough gold.', 12); return false; }
    if (svc === 'revive') {
        if (m.hp > 0) return false;
        m.hp = Math.max(1, Math.round(calc(m).maxhp * 0.5)); m.st = {}; ok = true;
        say(G, `${m.name} is raised from the dead.`, 10);
    } else if (svc === 'cure') {
        if (m.hp <= 0 || !(m.st.poison || m.st.sleep || m.st.stun)) return false;
        for (const k of ['poison', 'sleep', 'stun']) delete m.st[k]; ok = true;
        say(G, `${m.name} is cured.`, 10);
    } else if (svc === 'curse') {
        const gear = cursedGear(m);
        if (!m.st.curse && !gear.length) return false;
        delete m.st.curse;
        for (const it of gear) purify(it);
        ok = true;
        say(G, `The curse upon ${m.name} is lifted.`, 10);
        misc(G, 'dispelled');
    } else if (svc === 'heal') {
        if (m.hp <= 0) return false;
        const keep = m.st.curse; fullHeal(m); if (keep) m.st.curse = true; ok = true;
        say(G, `${m.name} is restored.`, 10);
    }
    if (ok) { G.gold -= c; G.stats.goldSpent += c; ev(G, 'church'); misc(G, 'prayers'); }
    return ok;
}

// ------------------------------------------------------------------ tavern
export const MEALS = {
    stew: { name: 'Hunter\'s Stew', mul: 1, hp: 0.3, mp: 0.1, desc: 'Heals 30% HP, 10% MP.' },
    roast: { name: 'Honey Roast', mul: 2.4, hp: 0.65, mp: 0.4, desc: 'Heals 65% HP, 40% MP.' },
    feast: { name: 'Dragon Feast', mul: 6, hp: 1, mp: 1, feast: 3, desc: 'Full heal, and +15% attack and defence for 3 battles.' },
};
export const mealPrice = (G, id) => Math.max(1, Math.round(MEALS[id].mul * (4 + avgLvl(G) * 1.8) * G.party.length * 0.5 * (1 - disc(G, 'tavern'))));
export function eat(G, id) {
    const M = MEALS[id], c = mealPrice(G, id);
    if (G.gold < c) { say(G, 'Not enough gold.', 12); return false; }
    G.gold -= c; G.stats.goldSpent += c;
    for (const m of G.party) if (isAlive(m)) { const s = calc(m); healMember(m, Math.round(s.maxhp * M.hp), Math.round(s.maxmp * M.mp)); }
    if (M.feast) G.feast = { left: M.feast };
    say(G, `The party enjoys ${M.name}.`, 10);
    ev(G, 'eat');
    misc(G, 'meals');
    return true;
}

// ------------------------------------------------------------------ guild board
export function refreshBoard(G) {
    const rng = seeded(G.seed, G.day, 99);
    G.quests.board = [];
    for (let i = 0; i < 4; i++) G.quests.board.push(genQuest(G, rng));
}

/** Put the best usable gear from the bag on a member (used for recruits, the bot and the Auto-equip button). */
export function autoEquip(G, m) {
    let changed = 0;
    for (const slot of SLOTS) {
        const cur = m.eq[slot];
        if (cur && cur.cursed) continue;
        let best = cur, bs = itemScore(cur);
        for (const it of G.inv) {
            if (!['w', 'a', 'c'].includes(it.t)) continue;
            const sl = it.t === 'c' ? slotFor({ eq: { acc1: 1, acc2: 1 } }, it) : slotFor(m, it);
            if (it.t === 'c' ? false : sl !== slot) continue;
            if (it.t === 'c' && slot !== 'acc1' && slot !== 'acc2') continue;
            if (!canEquip(m, it).ok) continue;
            if (it.cursed && !it.known && G.rng() < 0.0) continue;
            const sc = itemScore(it) * (it.t === 'w' ? weaponFit(m, it) : 1);
            if (sc > bs * 1.02) { best = it; bs = sc; }
        }
        if (best !== cur && best) {
            take(G, best.id, 1);
            if (cur) { give(G, cur, 'reward'); }
            m.eq[slot] = best;
            if (best.cursed && !best.known) { best.known = true; say(G, `${m.name}'s ${best.name} is cursed!`, 5); }
            changed++;
        }
    }
    return changed;
}
const weaponFit = (m, it) => ((m.cls === 'mage' || m.cls === 'cleric' || m.cls === 'alchemist') ? 1 + (it.st.mag || 0) / Math.max(1, it.st.atk || 1) * 0.4 : 1);
export { POTIONS, WANDS };
