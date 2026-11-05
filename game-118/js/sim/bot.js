// An auto-player. It plays through the same act()/step() the player uses, so the tests, the balance table
// and an attract-mode demo all exercise the real rules. It plans: finish quests, craft what the quests and the
// Hero's kit need, buy the ingredients where they are cheap, and trade between towns to pay for it all.
// (It reads every market directly, which a player can't: it is a balance probe, not a model of a person.)
// Pure, like the rest of js/sim.

import { WAGONS, REGION_LEVEL, ECLIPSE_DAY } from '../config.js';
import { TOWN, TOWNS, NEIGHBORS } from './data/towns.js';
import { MATS, FAMS, SLOT_ORDER, gearRecipe, itemDef, basePrice, keyOf } from './data/items.js';
import { QUESTS, STORY_ORDER } from './data/quests.js';
import { count, room, weightOf, usedCells } from './inv.js';
import * as M from './market.js';
import { act, burden, canTravel, step, stashUpgradeCost } from './game.js';
import { questsAt, questDef, reqProgress, questReady, nextStoryId } from './quest.js';
import { have } from './core.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, basis: {}, heldDay: {}, goal: null, stuck: 0, lastTown: null, visits: {}, dither: 0 };
}

const unlocked = (G, id) => G.lv >= REGION_LEVEL[TOWN[id].region];
/** Days from `from` to every unlocked town (Dijkstra over the roads), with the first hop of each route. */
function routes(G, from) {
    const dist = { [from]: 0 }, first = {};
    const open = [from];
    while (open.length) {
        open.sort((a, b) => dist[a] - dist[b]);
        const c = open.shift();
        for (const n of NEIGHBORS[c]) {
            if (!unlocked(G, n.to)) continue;
            const d = dist[c] + n.days;
            if (dist[n.to] === undefined || d < dist[n.to]) { dist[n.to] = d; first[n.to] = c === from ? n.to : first[c]; open.push(n.to); }
        }
    }
    return { dist, first };
}

// ---------------------------------------------------------------- what do I need?
const holdAll = (G, t, lv, min) => count(G, t, lv, min) + G.stash.items.filter((s) => s.t === t && (min ? s.lv >= lv : s.lv === lv)).reduce((a, s) => a + s.n, 0);

/** Leaf materials missing for everything the plan wants: Map material -> units. Also lists gear still to craft. */
export function plan(G) {
    const targets = [];
    const addQuest = (q) => { for (const r of q.req || []) targets.push({ t: r.t, lv: r.lv || 0, min: !!r.lv, n: r.n, why: q.id }); };
    const nid = nextStoryId(G);
    const focus = !G.heroCall && nid && nid !== 's7' && G.lv >= QUESTS[nid].lv && nid !== 's0';
    if (focus) addQuest(QUESTS[nid]);
    else if (!G.heroCall) for (const id of Object.keys(G.q.active)) { const q = questDef(G, id); if (q) addQuest(q); }
    const K = kitTarget(G);
    if (K > 0) for (const s of SLOT_ORDER) targets.push({ t: s, lv: K, min: false, n: 1, why: 'kit' });
    const need = new Map(), crafts = [];
    const pool = new Map();   // virtual inventory so one item does not satisfy two targets
    const held = (t, lv, min) => { const k = t + ':' + lv + ':' + min; if (!pool.has(k)) pool.set(k, holdAll(G, t, lv, min)); return pool.get(k); };
    const use = (t, lv, min, n) => { const k = t + ':' + lv + ':' + min; pool.set(k, held(t, lv, min) - n); };
    for (const tg of targets) {
        const h = Math.max(0, Math.min(tg.n, held(tg.t, tg.lv, tg.min)));
        use(tg.t, tg.lv, tg.min, h);
        let miss = tg.n - h;
        if (miss <= 0) continue;
        if (!FAMS[tg.t]) { need.set(tg.t, (need.get(tg.t) || 0) + miss); continue; }
        const lv = tg.lv || 1;
        const r = gearRecipe(tg.t, lv);
        crafts.push({ rid: r.rid, n: miss, why: tg.why });
        for (const i of r.inputs) {
            const k = `m:${i.t}`;
            const hh = Math.max(0, Math.min(i.n * miss, held(i.t, 0, false)));
            use(i.t, 0, false, hh);
            const m2 = i.n * miss - hh;
            if (m2 > 0) need.set(i.t, (need.get(i.t) || 0) + m2);
        }
    }
    return { need, crafts, targets };
}
/** The level of gear the bot aims to hand the Hero, and to stockpile for. */
function kitTarget(G) {
    if (G.ending) return 0;
    if (G.heroCall) return 10;
    return 0;
}

export function sourcesOf(G, t) {
    const out = [];
    for (const T of TOWNS) if (unlocked(G, T.id) && M.stockCap(T.id, t, 0) > 0) out.push(T.id);
    return out;
}
function stationTowns(G, station, lv) {
    return TOWNS.filter((T) => unlocked(G, T.id) && (T.stations[station] || 0) >= lv).map((T) => T.id);
}
const feasibleQuest = (G, q) => {
    if (q.kind === 'courier') return unlocked(G, q.to);
    return (q.req || []).every((r) => {
        if (FAMS[r.t]) {
            const rec = gearRecipe(r.t, r.lv || 1);
            return G.lv + 2 >= rec.needLv && stationTowns({ ...G, lv: 99 }, rec.station, rec.stationLv).length > 0 && rec.inputs.every((i) => sourcesOf({ ...G, lv: 99 }, i.t).length > 0);
        }
        return sourcesOf({ ...G, lv: 99 }, r.t).length > 0;
    });
};

// ---------------------------------------------------------------- one turn in a town
function tidyWagon(G) { act(G, { t: 'sort' }); }
function wantSet(G, pl) {
    // item keys the bot must not sell: gear and materials that quests or the kit still need
    const keep = new Map();
    for (const tg of pl.targets) keep.set(tg.t + ':' + (tg.min ? 'min' + tg.lv : tg.lv), tg);
    return keep;
}
const isReserved = (G, it, pl) => {
    for (const tg of pl.targets) {
        if (it.t !== tg.t) continue;
        if (tg.min ? it.lv >= tg.lv : it.lv === tg.lv) return true;
    }
    for (const [t] of pl.need) if (it.t === t) return true;
    for (const c of pl.crafts) { const r = gearRecipe(c.rid.split(':')[0], +c.rid.split(':')[1]); if (r && r.inputs.some((i) => i.t === it.t)) return true; }
    return false;
};

function doQuests(G, bot) {
    // turn in
    for (const id of Object.keys(G.q.active)) {
        const q = questDef(G, id);
        if (q && questReady(G, q)) act(G, { t: 'turnin', id });
    }
    // accept what looks doable
    const activeN = Object.keys(G.q.active).length;
    let n = activeN;
    for (const { q, state } of questsAt(G, G.loc)) {
        if (state !== 'available' || G.loc !== q.town) continue;
        const nonStory = Object.keys(G.q.active).filter((id) => !questDef(G, id).story).length;
        if (nonStory >= 3 && !q.story) continue;
        if (q.gen && q.deadline - G.day < 9) continue;
        if (!feasibleQuest(G, q)) continue;
        const r = act(G, { t: 'accept', id: q.id });
        if (r.ok) n++;
    }
    for (const id of Object.keys(G.q.active)) { const q = questDef(G, id); if (q && questReady(G, q)) act(G, { t: 'turnin', id }); }
}
function doHeroes(G) {
    for (const h of [...G.towns[G.loc].heroes]) {
        h.wants.forEach((w, i) => {
            if (!w.done) act(G, { t: 'hero', hid: h.id, w: i });
        });
    }
}
function doCraft(G, bot, pl) {
    let crafted = true, guard = 0;
    while (crafted && guard++ < 30) {
        crafted = false;
        for (const c of pl.crafts) {
            const r = gearRecipe(c.rid.split(':')[0], +c.rid.split(':')[1]);
            const res = act(G, { t: 'craft', rid: c.rid, n: c.n });
            if (res.ok) { crafted = true; break; }
        }
        if (crafted) { const np = plan(G); pl.crafts = np.crafts; pl.need = np.need; pl.targets = np.targets; }
    }
    // craft for profit: a gear piece a visiting hero here wants
    for (const h of G.towns[G.loc].heroes) for (const w of h.wants) {
        if (w.done) continue;
        for (let lv = w.minLv; lv <= Math.min(10, w.minLv + 1); lv++) {
            const rid = `${w.fam}:${lv}`;
            if (have(G, w.fam, w.minLv, true) > 0) break;
            const r = act(G, { t: 'craft', rid, n: 1 });
            if (r.ok) break;
        }
    }
}
function doBuyWants(G, bot, pl) {
    const reserve = 25;
    // most valuable shortages first
    const list = [...pl.need.entries()].sort((a, b) => basePrice(b[0]) * b[1] - basePrice(a[0]) * a[1]);
    for (const [t, n] of list) {
        const shop = TOWN[G.loc].shops.find((s) => M.shopHas(G.loc, s, t));
        if (!shop || M.stockOf(G, G.loc, t, 0) < 1) continue;
        // buy here if this is among the cheapest sources, or the only one nearby
        const here = M.buyUnit(G, G.loc, t, 0);
        const rt = routes(G, G.loc);
        const alt = Math.min(...sourcesOf(G, t).filter((x) => x === G.loc || (rt.dist[x] ?? 99) <= 2).map((x) => (x === G.loc ? here : M.midPrice(G, x, t, 0) * 1.07)));
        if (here > alt * 1.3 && bot.skill > 0.2) continue;
        const afford = Math.floor(Math.max(0, G.gold - reserve) / Math.max(1, here));
        const k = Math.min(n, afford);
        if (k > 0) act(G, { t: 'buy', shop, item: t, lv: 0, n: k });
    }
}
function doSell(G, bot, pl, here) {
    const rt = routes(G, G.loc);
    for (const it of [...G.inv.items]) {
        if (it.qid || it.fav) continue;
        if (!M.shopFor(G.loc, it.t)) continue;
        if (isReserved(G, it, pl)) continue;
        const key = keyOf(it.t, it.lv);
        const price = M.sellUnit(G, G.loc, it.t, it.lv);
        const basis = bot.basis[key] ?? basePrice(it.t, it.lv) * 0.8;
        // is a clearly better market within a short trip?
        let better = 0;
        for (const T of TOWNS) {
            if (T.id === G.loc || !unlocked(G, T.id) || rt.dist[T.id] > 3) continue;
            const p = M.sellUnit(G, T.id, it.t, it.lv);
            if (p > better) better = p;
        }
        const held = G.day - (bot.heldDay[key] ?? G.day);
        if ((price >= basis * 1.04 && price >= better * 0.88) || bot.stuck > 2 || price >= better * 1.0 || held > 9 || usedCells(G) > G.inv.w * G.inv.h * 0.7) {
            act(G, { t: 'sell', id: it.id, n: 'all' });
        }
    }
}
function doBuyTrade(G, bot, pl) {
    const rt = routes(G, G.loc);
    const b = burden(G);
    let best = null;
    const shops = TOWN[G.loc].shops;
    const cands = [];
    for (const id of Object.keys(MATS)) {
        if (id === 'parcel') continue;
        const stock = M.stockOf(G, G.loc, id, 0);
        if (stock < 1) continue;
        const buy = M.buyUnit(G, G.loc, id, 0);
        for (const T of TOWNS) {
            if (T.id === G.loc || !unlocked(G, T.id) || rt.dist[T.id] > 4) continue;
            const sellP = M.sellUnit(G, T.id, id, 0) * 0.93;
            const prof = sellP - buy;
            if (prof / buy < 0.12) continue;
            const days = rt.dist[T.id];
            cands.push({ id, to: T.id, buy, prof, days, stock });
        }
    }
    const spend = Math.max(0, G.gold - 20);
    for (const c of cands) {
        const d = MATS[c.id];
        const byGold = Math.floor(spend / c.buy);
        const byRoom = Math.min(room(G, c.id, 0), Math.floor((WAGONS[G.wagon].cap - b.w) / d.wt));
        const freeCells = G.inv.w * G.inv.h - usedCells(G) - 8;
        const n = Math.min(c.stock, byGold, byRoom, Math.max(0, freeCells * d.stack));
        if (n < 1) continue;
        c.n = n;
        c.score = (n * c.prof) / (c.days + 0.5);
        if (!best || c.score > best.score) best = c;
    }
    if (!best) return null;
    const shop = shops.find((s) => M.shopHas(G.loc, s, best.id));
    const r = act(G, { t: 'buy', shop, item: best.id, lv: 0, n: best.n });
    if (r.ok) {
        const key = best.id;
        const old = bot.basis[key];
        bot.basis[key] = r.cost / r.n;
        bot.heldDay[key] = G.day;
        return best.to;
    }
    return null;
}

function maybeUpgrade(G) {
    const nx = WAGONS[G.wagon + 1];
    if (nx && TOWN[G.loc].guild && G.lv >= nx.lv && G.gold >= nx.cost * 1.6) act(G, { t: 'upgradeWagon' });
}

export function pickDestination(G, bot, pl, tradeGoal) {
    const rt = routes(G, G.loc);
    const go = (to) => (to && to !== G.loc && rt.first[to] ? rt.first[to] : null);
    // 0. the offer
    if (G.heroCall && !G.ending && G.loc !== 'aurelion') {
        const full = SLOT_ORDER.every((s) => have(G, s, 10) > 0);
        if (full || G.day > ECLIPSE_DAY - 25) return go('aurelion');
    }
    // 0b. the Hero's chain: go and hand it in once I hold everything, or to hear the Call
    const nid = nextStoryId(G);
    if (nid && !G.heroCall) {
        const sq = QUESTS[nid];
        if (G.lv >= sq.lv && sq.town !== G.loc && unlocked(G, sq.town)) {
            const have_ = sq.req.every((r) => have(G, r.t, r.lv || 0, !!r.lv) >= r.n);
            if (have_) return go(sq.town);
        }
    }
    // 1. a quest I can hand in
    let bestQ = null;
    for (const id of Object.keys(G.q.active)) {
        const q = questDef(G, id);
        if (!q || q.turn === G.loc || !unlocked(G, q.turn)) continue;
        const ready = reqProgress({ ...G, loc: q.turn }, q).every((r) => r.have >= r.n);
        if (ready) { const d = rt.dist[q.turn]; if (d !== undefined && (!bestQ || d < bestQ.d)) bestQ = { to: q.turn, d }; }
    }
    if (bestQ) return go(bestQ.to);
    // 2. craft: ingredients on hand, workshop elsewhere
    for (const c of pl.crafts) {
        const [fam, lv] = c.rid.split(':');
        const r = gearRecipe(fam, +lv);
        if (r.inputs.every((i) => have(G, i.t, 0) >= i.n) && G.lv >= r.needLv) {
            const ts = stationTowns(G, r.station, r.stationLv).filter((t) => rt.dist[t] !== undefined).sort((a, b) => rt.dist[a] - rt.dist[b]);
            if (ts[0] && ts[0] !== G.loc) return go(ts[0]);
        }
    }
    // 3. fetch missing ingredients (the biggest shortage in value)
    const missing = [...pl.need.entries()].filter(([t]) => have(G, t, 0) < pl.need.get(t)).sort((a, b) => basePrice(b[0]) * b[1] - basePrice(a[0]) * a[1]);
    for (const [t, n] of missing) {
        if (G.gold < Math.min(80, basePrice(t) * 2)) continue;
        const ss = sourcesOf(G, t).filter((s) => rt.dist[s] !== undefined && s !== G.loc).sort((a, b) => rt.dist[a] - rt.dist[b]);
        if (ss[0]) return go(ss[0]);
    }
    // 4. trade
    if (tradeGoal) return go(tradeGoal);
    // 5. sell what I carry at the best nearby market
    let bestSell = null;
    for (const it of G.inv.items) {
        if (it.qid || isReserved(G, it, pl)) continue;
        for (const T of TOWNS) {
            if (T.id === G.loc || !unlocked(G, T.id) || rt.dist[T.id] === undefined) continue;
            const v = M.sellUnit(G, T.id, it.t, it.lv) * it.n / (rt.dist[T.id] + 0.5);
            if (!bestSell || v > bestSell.v) bestSell = { to: T.id, v };
        }
    }
    if (bestSell) return go(bestSell.to);
    // 6. wander toward a town I have not been in lately
    const ns = NEIGHBORS[G.loc].filter((n) => unlocked(G, n.to)).sort((a, b) => (bot.visits[a.to] || 0) - (bot.visits[b.to] || 0));
    return ns[0]?.to || null;
}

/** Play one stop: everything the bot does in a town, then set off. Returns false if it could not move. */
export function botTurn(G, bot) {
    if (G.travel || G.pending || G.over) return false;
    bot.visits[G.loc] = (bot.visits[G.loc] || 0) + 1;
    tidyWagon(G);
    let pl = plan(G);
    doQuests(G, bot);
    doHeroes(G);
    pl = plan(G);
    doCraft(G, bot, pl);
    pl = plan(G);
    const goldBefore = G.gold;
    doSell(G, bot, pl);
    maybeUpgrade(G);
    tidyWagon(G);
    pl = plan(G);
    doBuyWants(G, bot, pl);
    tidyWagon(G);
    // offer?
    if (G.heroCall && !G.ending && G.loc === 'aurelion') {
        const picks = {};
        for (const s of SLOT_ORDER) { for (let lv = 10; lv >= 1; lv--) if (have(G, s, lv) > 0) { picks[s] = lv; break; } }
        const full = SLOT_ORDER.every((s) => picks[s] >= 9);
        if (full || G.day > ECLIPSE_DAY - 12) { act(G, { t: 'offer', picks }); return true; }
    }
    pl = plan(G);
    const tradeGoal = doBuyTrade(G, bot, pl);
    pl = plan(G);
    let hop = pickDestination(G, bot, pl, tradeGoal);
    if (bot.skill < 1 && G.rng() < (1 - bot.skill) * 0.3) {
        const ns = NEIGHBORS[G.loc].filter((n) => unlocked(G, n.to));
        hop = ns[Math.floor(G.rng() * ns.length)].to;
    }
    if (!hop) { const r = act(G, { t: 'rest' }); bot.stuck++; return r.ok; }
    const r = act(G, { t: 'travel', to: hop });
    if (!r.ok) {
        // too heavy? sell something heavy, otherwise rest
        const heavy = G.inv.items.filter((i) => !i.qid).sort((a, b) => itemDef(b.t, b.lv).wt * b.n - itemDef(a.t, a.lv).wt * a.n)[0];
        if (heavy) act(G, { t: 'sell', id: heavy.id, n: 'all' });
        const r2 = act(G, { t: 'travel', to: hop });
        if (!r2.ok) { act(G, { t: 'rest' }); bot.stuck++; return false; }
    }
    bot.stuck = G.gold <= goldBefore ? bot.stuck + 0.5 : 0;
    return true;
}

/** Resolve a road encounter the way a cautious merchant would. */
export function botPending(G, bot) {
    const p = G.pending;
    if (!p) return;
    if (p.kind === 'bandits') {
        act(G, { t: 'resolve', choice: p.chance >= 0.55 ? 'fight' : p.demand <= G.gold * 0.12 ? 'pay' : 'fight' });
    } else if (p.kind === 'wanderer') {
        const base = basePrice(p.t, p.lv);
        act(G, { t: 'resolve', choice: p.unit < base * 0.72 && G.gold > p.unit * p.n + 60 ? 'accept' : 'decline' });
    } else act(G, { t: 'resolve', choice: 'ok' });
}

/** Drive a game with the bot until it ends or maxDays pass. Returns the game. */
export function runBot(G, bot, { maxDays = 400, dt = 0.25, onStop = null } = {}) {
    let guard = 0;
    while (!G.over && !(G.ending) && G.day <= maxDays && guard++ < 200000) {
        if (G.pending) { botPending(G, bot); continue; }
        if (G.travel) { step(G, { ff: 1 }, dt); continue; }
        botTurn(G, bot);
        G.events.length = 0;
        if (onStop) onStop(G);
    }
    return G;
}

// A bot for the template-compatible hooks: attract mode runs it a stop at a time.
export function botInput() { return { ff: 1 }; }
