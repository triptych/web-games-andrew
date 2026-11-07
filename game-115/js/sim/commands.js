// Everything the player (or the bot) can do. Each command validates, changes the game and returns
// { ok, why? }. The UI, the bot and the tests all go through act().

import { BOUNDS } from '../config.js';
import { BUILDINGS, costOf, reqHall, nameOf, stat } from './data/buildings.js';
import { ITEMS, RECIPES, canEquip } from './data/items.js';
import { UPGRADES } from './data/upgrades.js';
import {
    nextId, push, toast, stock, has, pay, refund, addItem, takeItem, earn, hall, hallLv, bldById, hById, vById, recomputeMods, count, marketPrice, builtOf, capOf, cozyOf,
} from './core.js';
import { NODE_KINDS, placeProblem, clearNodesUnder, rebuildOcc, ownedAt } from './world.js';
import { assign, autoAssign, welcome, freeSlots } from './townsfolk.js';
import { buildTimeFor, builderCap, constructions, refreshNear, canRun } from './production.js';
import { hire, dismiss, heroStats, heroCap } from './heroes.js';
import { dispatch, recall } from './quests.js';
import { claim } from './journal.js';
import { buyOffer } from './events.js';
import { stat as bstat } from './data/buildings.js';

const fail = (why) => ({ ok: false, why });
const ok = (x = {}) => ({ ok: true, ...x });

function costText(cost) {
    return Object.entries(cost).map(([k, n]) => `${n} ${k === 'gold' ? 'gold' : ITEMS[k].name}`).join(', ');
}
export function missing(G, cost) {
    const out = [];
    for (const k in cost) {
        const have = k === 'gold' ? G.gold : stock(G, k);
        if (have < cost[k]) out.push(k === 'gold' ? `${cost[k] - have} more gold` : `${cost[k] - have} more ${ITEMS[k].name}`);
    }
    return out;
}

/** What it would take to put up or upgrade a building: { cost, time, why? }. */
export function buildInfo(G, type, lv) {
    const d = BUILDINGS[type];
    const info = { cost: costOf(type, lv), time: buildTimeFor(G, type, lv), hall: reqHall(type, lv), why: null };
    if (lv > d.maxLv) info.why = 'Fully upgraded.';
    else if (type !== 'hall' && hallLv(G) < info.hall) info.why = `Needs the Hall at level ${info.hall}.`;
    else if (type === 'hall' && G.renown < stat('hall', lv, 'renown')) info.why = `Needs ${stat('hall', lv, 'renown')} renown (you have ${G.renown}).`;
    if (G.upgradeDiscount) info.cost = info.cost;
    return info;
}

function applyDiscount(G, cost) {
    const d = G.mods.upgradeDiscount;
    if (!d) return cost;
    const out = {};
    for (const k in cost) out[k] = k === 'gold' ? Math.ceil(cost[k] * (1 - d)) : cost[k];
    return out;
}

export function act(G, c) {
    switch (c.t) {
        case 'harvest': return harvest(G, c.id);
        case 'build': return build(G, c.type, c.x, c.y);
        case 'upgrade': return upgrade(G, c.id);
        case 'move': return move(G, c.id, c.x, c.y);
        case 'demolish': return demolish(G, c.id);
        case 'cancel': return cancelBuild(G, c.id);
        case 'assign': return assign(G, c.vid, c.bid ?? null) ? ok() : fail('No free place there.');
        case 'autoAssign': autoAssign(G, !!c.all); return ok();
        case 'welcome': return welcome(G, c.id, c.accept !== false);
        case 'queue': return queue(G, c.bid, c.rid, c.n || 1);
        case 'dequeue': { const b = bldById(G, c.bid); if (b) b.queue.splice(c.i, 1); return ok(); }
        case 'target': return setTarget(G, c.bid, c.rid, c.n);
        case 'hire': return hire(G, c.rid);
        case 'dismiss': return dismiss(G, c.hid);
        case 'dispatch': return dispatch(G, c.qid, c.heroes);
        case 'recall': return recall(G, c.pid);
        case 'auto': { const h = hById(G, c.hid); if (h) h.auto = c.on !== false; return ok(); }
        case 'equip': return equip(G, c.hid, c.item);
        case 'give': return give(G, c.hid, c.item);
        case 'shelf': return shelf(G, c.slot, c.item);
        case 'price': G.priceMul[c.item] = Math.max(0.5, Math.min(2.5, c.mul)); return ok();
        case 'sell': return sell(G, c.item, c.n);
        case 'autosell': { if (c.keep == null) delete G.autoSell[c.item]; else G.autoSell[c.item] = Math.max(0, c.keep); return ok(); }
        case 'research': return research(G, c.id);
        case 'claim': return claim(G, c.id);
        case 'merchant': return buyOffer(G, c.i, c.n || 1);
        case 'opt': G.opts[c.key] = c.value; return ok();
        case 'pin': G.pinned = c.id; return ok();
        default: return fail('Unknown command.');
    }
}

// ---------------------------------------------------------------- the wild
function harvest(G, id) {
    const n = G.nodes.find((x) => x.id === id);
    if (!n) return fail('Nothing there.');
    if (n.regrow > 0) return fail('Still growing back.');
    if (!ownedAt(G, n.x, n.y)) return fail('That land is not yours yet.');
    const k = NODE_KINDS[n.k];
    G.stats.hits++;
    n.hp--;
    let got = 0;
    if (k.perHit) got += addItem(G, k.item, k.perHit);
    const lucky = G.rng() < 0.12;
    if (n.hp <= 0) {
        got += addItem(G, k.item, k.fell + (lucky ? 1 : 0));
        n.regrow = k.regrow;
        n.hp = k.hp;
        if (n.k === 'rock' && G.rng() < 0.12) addItem(G, 'ore', 1);
        if (n.k === 'rock' && G.rng() < 0.015) addItem(G, 'gem', 1);
        if (n.k === 'tree' && G.rng() < 0.05) addItem(G, 'honey', 1);
        G.stats.felled++;
        push(G, { type: 'felled', id: n.id, k: n.k, x: n.x, y: n.y, item: k.item, n: got });
    } else push(G, { type: 'hit', id: n.id, k: n.k, x: n.x, y: n.y, item: k.item, n: got });
    if (got === 0 && stock(G, k.item) >= capOf(G, k.item)) toast(G, `${ITEMS[k.item].name} storage is full.`, 'bad');
    return ok({ got });
}

// ---------------------------------------------------------------- building
function build(G, type, x, y) {
    const d = BUILDINGS[type];
    if (!d || type === 'hall') return fail('Cannot build that.');
    if (hallLv(G) < d.unlock) return fail(`Needs the Hall at level ${d.unlock}.`);
    const info = buildInfo(G, type, 1);
    const cost = applyDiscount(G, info.cost);
    const p = placeProblem(G, type, x, y);
    if (p) return fail(`Cannot build here: ${p}.`);
    const m = missing(G, cost);
    if (m.length) return fail(`Needs ${m.join(', ')}.`);
    pay(G, cost);
    const got = clearNodesUnder(G, type, x, y);
    for (const k in got) addItem(G, k, got[k]);
    const b = {
        id: nextId(G), type, x, y, lv: 0, workers: [], bld: { t: info.time, total: info.time, to: 1, seq: nextId(G) }, acc: {}, job: null, queue: [], auto: {}, near: 0,
    };
    G.buildings.push(b);
    rebuildOcc(G);
    G.stats.placed++;
    push(G, { type: 'placed', id: b.id, btype: type });
    return ok({ id: b.id });
}

function upgrade(G, id) {
    const b = bldById(G, id);
    if (!b || b.lv < 1) return fail('Not ready.');
    if (b.bld) return fail('Already being built.');
    const to = b.lv + 1;
    const info = buildInfo(G, b.type, to);
    if (info.why) return fail(info.why);
    const cost = applyDiscount(G, info.cost);
    const m = missing(G, cost);
    if (m.length) return fail(`Needs ${m.join(', ')}.`);
    pay(G, cost);
    b.bld = { t: info.time, total: info.time, to, seq: nextId(G) };
    push(G, { type: 'upgradeStart', id: b.id });
    return ok();
}

function cancelBuild(G, id) {
    const b = bldById(G, id);
    if (!b || !b.bld) return fail('Nothing to cancel.');
    const cost = applyDiscount(G, costOf(b.type, b.bld.to));
    refund(G, cost, 1);
    if (b.lv < 1) { G.buildings = G.buildings.filter((x) => x !== b); rebuildOcc(G); }
    else b.bld = null;
    return ok();
}

function move(G, id, x, y) {
    const b = bldById(G, id);
    if (!b || b.type === 'hall') return fail('That one stays put.');
    const p = placeProblem(G, b.type, x, y, b.id);
    if (p) return fail(`Cannot move here: ${p}.`);
    b.x = x; b.y = y;
    clearNodesUnder(G, b.type, x, y);
    rebuildOcc(G);
    refreshNear(G);
    push(G, { type: 'moved', id: b.id });
    return ok();
}

function demolish(G, id) {
    const b = bldById(G, id);
    if (!b || b.type === 'hall') return fail('You cannot knock down the Hall.');
    for (const vid of b.workers) { const v = vById(G, vid); if (v) v.job = null; }
    let spent = {};
    for (let l = 1; l <= Math.max(1, b.lv); l++) for (const [k, n] of Object.entries(costOf(b.type, l))) spent[k] = (spent[k] || 0) + n;
    refund(G, spent, 0.4);
    G.buildings = G.buildings.filter((x) => x !== b);
    rebuildOcc(G);
    recomputeMods(G);
    push(G, { type: 'demolished', id });
    return ok();
}

// ---------------------------------------------------------------- crafting orders
function queue(G, bid, rid, n) {
    const b = bldById(G, bid);
    const rec = RECIPES[rid];
    if (!b || !rec || rec.station !== b.type) return fail('This station cannot make that.');
    if (rec.lv > b.lv) return fail(`Needs ${nameOf(b.type, rec.lv)} or better.`);
    const q = b.queue.find((x) => x.rid === rid);
    if (q) q.n = Math.min(99, q.n + n); else if (b.queue.length >= 8) return fail('The queue is full.'); else b.queue.push({ rid, n });
    return ok();
}
function setTarget(G, bid, rid, n) {
    const b = bldById(G, bid);
    const rec = RECIPES[rid];
    if (!b || !rec || rec.station !== b.type) return fail('This station cannot make that.');
    if (n <= 0) delete b.auto[rid]; else b.auto[rid] = Math.min(500, n);
    return ok();
}

// ---------------------------------------------------------------- heroes and the shop
function equip(G, hid, item) {
    const h = hById(G, hid);
    const it = ITEMS[item];
    if (!h || !it) return fail('No such thing.');
    if (it.cat === 'potion') {
        if (h.pots.length >= 2) return fail('Carrying two already.');
        if (!takeItem(G, item, 1)) return fail('None in storage.');
        h.pots.push(item);
        return ok();
    }
    if (!canEquip(h.cls, it)) return fail('They cannot use that.');
    if (it.reqLv > h.lv) return fail(`Needs level ${it.reqLv}.`);
    if (!takeItem(G, item, 1)) return fail('None in storage.');
    const old = h.equip[it.slot];
    h.equip[it.slot] = item;
    if (old) addItem(G, old, 1);
    return ok();
}
function give(G, hid, item) { return equip(G, hid, item); }

function shelf(G, slot, item) {
    const shop = builtOf(G, 'itemshop');
    const n = shop.reduce((s, b) => s + bstat('itemshop', b.lv, 'shelves'), 0);
    if (slot < 0 || slot >= n) return fail('No such shelf.');
    if (item && !['gear', 'potion'].includes(ITEMS[item]?.cat)) return fail('Only gear and potions go on the shelves.');
    if (item && G.shelves.some((s, i) => s === item && i !== slot)) return fail('Already on a shelf.');
    while (G.shelves.length <= slot) G.shelves.push(null);
    G.shelves[slot] = item || null;
    return ok();
}

export function shelfCount(G) { return builtOf(G, 'itemshop').reduce((s, b) => s + bstat('itemshop', b.lv, 'shelves'), 0); }

function sell(G, item, n) {
    if (!builtOf(G, 'market').length) return fail('Build a Market first.');
    const it = ITEMS[item];
    if (!it || it.noSell) return fail('That cannot be sold.');
    n = Math.min(n, stock(G, item));
    if (n <= 0) return fail('None to sell.');
    takeItem(G, item, n);
    const gold = n * marketPrice(G, item);
    earn(G, gold);
    G.stats.marketGold += gold; G.stats.marketSold += n;
    push(G, { type: 'sell', item, n, gold });
    return ok({ gold });
}

function research(G, id) {
    const u = UPGRADES[id];
    if (!u) return fail('No such upgrade.');
    if (G.upgrades[id]) return fail('Already learned.');
    if (hallLv(G) < u.hall) return fail(`Needs the Hall at level ${u.hall}.`);
    if (u.req.some((r) => !G.upgrades[r])) return fail('Learn the earlier upgrades first.');
    const cost = applyDiscount(G, u.cost);
    const m = missing(G, cost);
    if (m.length) return fail(`Needs ${m.join(', ')}.`);
    pay(G, cost);
    G.upgrades[id] = true;
    recomputeMods(G);
    G.cozy = cozyOf(G);
    push(G, { type: 'research', id });
    toast(G, `Learned: ${u.name}.`, 'good');
    return ok();
}

export function upgradeCost(G, id) { return applyDiscount(G, UPGRADES[id].cost); }
export function buildCost(G, type, lv) { return applyDiscount(G, costOf(type, lv)); }
