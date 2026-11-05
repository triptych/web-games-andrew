// THE HERO'S MERCHANT: the simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the UI, the bot and the tests change it only through act() and step().
//
//   act(G, cmd)   - one player decision (buy, sell, craft, travel ...). Returns { ok, msg }.
//   step(G, inp, dt) - advances the clock and the journey; inp = { ff } to hurry the road along.

import { START, WAGONS, STASH, ECLIPSE_DAY, REGION_LEVEL, DAY_SECONDS, BURDEN, XP } from '../config.js';
import { makeRng } from '../rng.js';
import { TOWN, TOWNS, NEIGHBORS, SHOP_DEFS } from './data/towns.js';
import { MATS, FAMS, SLOT_ORDER, itemDef, basePrice, itemName, recipeById, isGear, matGrade, keyOf, gradeOf, catOf } from './data/items.js';
import { INTRO, rankFor, NO_OFFER_TEXT } from './data/story.js';
import { QUESTS } from './data/quests.js';
import { room, addItems, removeItems, count, itemById, moveItem, mergeStacks, autoSort, weightOf, resizeInv, stashAdd, stashRoom, stashRemove, stashCount, normLv } from './inv.js';
import * as M from './market.js';
import { log, emit, gainXp, have, takeAny, repUp, inGuildTown } from './core.js';
import { acceptQuest, abandonQuest, turnInQuest, refreshBoard, expireQuests, updateHeroes, spawnHero, serveHero } from './quest.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fail = (msg) => ({ ok: false, msg });
const ok = (msg, extra = {}) => ({ ok: true, msg, ...extra });

export function newGame(seed = 1) {
    const G = {
        v: 1, seed, rng: makeRng(seed),
        t: 0, day: START.day, hour: 8,
        gold: START.gold, xp: 0, lv: 1,
        loc: START.town, travel: null, pending: null,
        wagon: 0, inv: { w: WAGONS[0].w, h: WAGONS[0].h, items: [] }, nextId: 1, nextQ: 1, nextHid: 1,
        stash: { cap: STASH.start, items: [] },
        towns: {}, mkt: {}, known: {}, gen: {}, q: { active: {}, done: {} },
        heroCall: null, ending: null, over: false,
        log: [], events: [],
        stats: { earned: 0, spent: 0, questGold: 0, heroGold: 0, heroes: 0, quests: 0, crafted: 0, sold: 0, bought: 0, travelDays: 0, roadEvents: 0, xp: 0, maxGold: START.gold, visited: 1 },
    };
    for (const t of TOWNS) G.towns[t.id] = { rep: 0, events: [], heroes: [], board: [], visited: t.id === START.town };
    M.initMarkets(G);
    for (const t of TOWNS) refreshBoard(G, t.id);
    for (const id of ['hearthmere', 'willowbrook', 'copperfield']) spawnHero(G, id);
    for (const t of TOWNS.slice(3)) if (G.rng() < 0.4) spawnHero(G, t.id);
    snapshotPrices(G, G.loc);
    G.q.active.s0 = { day: 1 };
    emit(G, { type: 'dialog', id: 'intro', lines: INTRO });
    log(G, 'You inherit Gran Mirabel\'s handcart in Hearthmere.');
    return G;
}

// ---------------------------------------------------------------- weight, wagon, intel
export function burden(G) {
    const cap = WAGONS[G.wagon].cap;
    const w = weightOf(G);
    const r = w / cap;
    return { w, cap, r, mult: r <= BURDEN.soft ? 1 : 1 + (Math.min(r, BURDEN.hard) - 1) * 1.2, over: r > BURDEN.soft, blocked: r > BURDEN.hard };
}
export function snapshotPrices(G, townId) {
    const p = {};
    const add = (t, lv) => {
        const buy = M.stockCap(townId, t, lv) > 0 ? Math.round(M.buyUnit(G, townId, t, lv)) : 0;
        const sell = M.shopFor(townId, t) ? Math.round(M.sellUnit(G, townId, t, lv)) : 0;
        if (buy || sell) p[keyOf(t, lv)] = [buy, sell];
    };
    for (const id of Object.keys(MATS)) if (id !== 'parcel') add(id, 0);
    for (const f of SLOT_ORDER) for (let lv = 1; lv <= 10; lv++) add(f, lv);
    G.known[townId] = { day: G.day, p };
}
export function canTravel(G, to) {
    const road = NEIGHBORS[G.loc]?.find((n) => n.to === to);
    if (!road) return { ok: false, reason: 'No road leads there from here.' };
    const need = REGION_LEVEL[TOWN[to].region];
    if (G.lv < need) return { ok: false, reason: `The guards of that region only admit merchants of level ${need}.`, need };
    const b = burden(G);
    if (b.blocked) return { ok: false, reason: 'Your wagon is too heavy to move. Sell or stash something.' };
    return { ok: true, days: Math.max(1, Math.ceil(road.days * b.mult)), base: road.days };
}
export const stashUpgradeCost = (G) => (G.stash.cap >= STASH.max ? 0 : STASH.cost[Math.min(STASH.cost.length - 1, (G.stash.cap - STASH.start) / STASH.step)]);

// ---------------------------------------------------------------- time
function advanceDay(G) {
    G.day++;
    M.dailyMarket(G);
    updateHeroes(G);
    if (G.day % 7 === 0) for (const t of TOWNS) refreshBoard(G, t.id);
    expireQuests(G);
    emit(G, { type: 'day', day: G.day });
    if (G.day > ECLIPSE_DAY && !G.ending) endGame(G, null);
}

function roadEvent(G, tr) {
    const to = TOWN[tr.to], from = TOWN[tr.from];
    const R = Math.max(to.region, from.region);
    const guard = WAGONS[G.wagon].guard;
    if (G.rng() > 0.15 + 0.015 * R) return;
    const roll = G.rng();
    G.stats.roadEvents++;
    if (roll < 0.28 * (1 - 0.1 * guard)) {
        const demand = Math.max(10 * R, Math.round(G.gold * (0.05 + G.rng() * 0.05)));
        G.pending = { kind: 'bandits', demand, chance: banditChance(G, R) };
        emit(G, { type: 'road', kind: 'bandits' });
    } else if (roll < 0.52) {
        const pool = Object.values(MATS).filter((m) => m.cat !== 'quest' && matGrade(m.id) <= R + 1 && m.price <= 130 * R);
        const m = pool[Math.floor(G.rng() * pool.length)];
        const n = 3 + Math.floor(G.rng() * 6);
        G.pending = { kind: 'wanderer', t: m.id, lv: 0, n, unit: Math.max(1, Math.round(m.price * 0.68)) };
        emit(G, { type: 'road', kind: 'wanderer' });
    } else if (roll < 0.72) {
        const pool = Object.values(MATS).filter((m) => m.cat !== 'quest' && matGrade(m.id) <= R && m.price <= 100);
        const m = pool[Math.floor(G.rng() * pool.length)];
        const n = 2 + Math.floor(G.rng() * 5);
        const got = addItems(G, m.id, 0, n);
        if (got) { log(G, `You find ${got} ${m.name} by the roadside.`, 'good'); emit(G, { type: 'road', kind: 'find', t: m.id, n: got }); }
    } else if (roll < 0.87) {
        tr.total++;
        log(G, 'A storm slows the road: one extra day.', 'bad');
        emit(G, { type: 'road', kind: 'storm' });
    } else {
        const cost = Math.min(G.gold, 8 * R + 6);
        G.gold -= cost; G.stats.spent += cost;
        log(G, `A wheel cracks. Repairs cost ${cost}g.`, 'bad');
        emit(G, { type: 'road', kind: 'breakdown', cost });
    }
}
export function banditChance(G, R) {
    const best = (fam) => G.inv.items.filter((i) => i.t === fam).reduce((a, i) => Math.max(a, i.lv), 0);
    const gear = best('sword') + best('armor') + best('shield');
    return clamp(0.3 + 0.025 * G.lv + 0.06 * WAGONS[G.wagon].guard + 0.014 * gear - 0.05 * R, 0.1, 0.92);
}

function arrive(G) {
    const tr = G.travel;
    G.loc = tr.to;
    G.travel = null;
    G.hour = 8;
    const T = G.towns[G.loc];
    if (!T.visited) { T.visited = true; G.stats.visited++; gainXp(G, 12 * TOWN[G.loc].region); }
    snapshotPrices(G, G.loc);
    log(G, `Arrived in ${TOWN[G.loc].name}.`);
    emit(G, { type: 'arrive', town: G.loc });
}

/** Advance time. In a town only the sky moves; on the road the journey advances day by day. */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    const tr = G.travel;
    if (tr) {
        if (G.pending) return;
        tr.prog += (dt * (inp?.ff || 1)) / DAY_SECONDS;
        G.hour = (8 + tr.prog * 24) % 24;
        while (tr.prog >= tr.ticks + 1 && tr.ticks < tr.total && !G.pending) {
            tr.ticks++;
            G.stats.travelDays++;
            advanceDay(G);
            if (tr.ticks < tr.total) roadEvent(G, tr);
        }
        if (!G.pending && tr.ticks >= tr.total) arrive(G);
    } else {
        G.hour = Math.min(18.5, G.hour + dt * 0.12);
    }
}

// ---------------------------------------------------------------- the ending
function endGame(G, picks) {
    const slots = {};
    let score = 0;
    for (const s of SLOT_ORDER) { slots[s] = picks?.[s] || 0; score += slots[s]; }
    const rank = picks ? rankFor(score) : null;
    G.ending = { day: G.day, score, rank: rank?.id || null, title: rank?.title || 'The Unfulfilled', slots, missed: !picks, text: picks ? rank.text : NO_OFFER_TEXT };
    emit(G, { type: 'ending' });
    log(G, picks ? `The Offer is made: ${score}/100, ${G.ending.title}.` : 'The Eclipse comes. The Hero marches on without you.', 'good');
}
/** For each kit slot, the levels you could offer (wagon + stash). */
export function offerOptions(G) {
    const out = {};
    for (const s of SLOT_ORDER) {
        const lvs = new Set();
        for (const it of G.inv.items) if (it.t === s) lvs.add(it.lv);
        for (const it of G.stash.items) if (it.t === s) lvs.add(it.lv);
        out[s] = [...lvs].sort((a, b) => b - a);
    }
    return out;
}

// ---------------------------------------------------------------- commands
export function act(G, c) {
    if (G.over) return fail('The game is over.');
    if (G.pending && c.t !== 'resolve') return fail('Decide what to do about the road first.');
    if (G.travel && c.t !== 'resolve') return fail('You are on the road.');
    const here = TOWN[G.loc];
    switch (c.t) {
        case 'buy': return buy(G, c);
        case 'sell': return sell(G, c);
        case 'sellJunk': return sellJunk(G);
        case 'move': return moveItem(G, c.id, c.x, c.y, c.r) ? ok('Moved.') : fail('That does not fit there.');
        case 'merge': return mergeStacks(G, c.from, c.to) ? ok('Stacked.') : fail('Cannot stack those.');
        case 'sort': return autoSort(G) ? ok('Wagon sorted.') : fail('Could not repack.');
        case 'mark': {
            const it = itemById(G, c.id);
            if (!it) return fail('No such item.');
            if ('fav' in c) { it.fav = !!c.fav; if (it.fav) it.junk = false; }
            if ('junk' in c) { it.junk = !!c.junk; if (it.junk) it.fav = false; }
            return ok('Marked.');
        }
        case 'stash': {
            if (!here.guild) return fail('You need a Guild House to use the stash.');
            const it = itemById(G, c.id);
            if (!it || it.qid) return fail('That cannot be stored.');
            const n = clamp(c.n === 'all' || c.n == null ? it.n : c.n, 1, it.n);
            const put = stashAdd(G, it.t, it.lv, n);
            if (!put) return fail('The stash is full.');
            removeItems(G, it.t, it.lv, put);
            return ok(`Stored ${put}.`);
        }
        case 'unstash': {
            if (!here.guild) return fail('You need a Guild House to use the stash.');
            const s = G.stash.items[c.idx];
            if (!s) return fail('Nothing there.');
            const n = clamp(c.n === 'all' || c.n == null ? s.n : c.n, 1, s.n);
            const got = addItems(G, s.t, s.lv, Math.min(n, room(G, s.t, s.lv, n)));
            if (!got) return fail('No room in the wagon.');
            stashRemove(G, s.t, s.lv, got);
            return ok(`Took ${got}.`);
        }
        case 'stashUp': {
            if (!here.guild) return fail('You need a Guild House.');
            const cost = stashUpgradeCost(G);
            if (!cost) return fail('The vault cannot grow any more.');
            if (G.gold < cost) return fail(`You need ${cost}g.`);
            G.gold -= cost; G.stats.spent += cost; G.stash.cap += STASH.step;
            return ok('The vault grows.');
        }
        case 'upgradeWagon': {
            if (!here.guild) return fail('Wainwrights work at Guild Houses.');
            const nx = WAGONS[G.wagon + 1];
            if (!nx) return fail('You already own the finest wagon in the realm.');
            if (G.lv < nx.lv) return fail(`The ${nx.name} needs merchant level ${nx.lv}.`);
            if (G.gold < nx.cost) return fail(`You need ${nx.cost}g.`);
            G.gold -= nx.cost; G.stats.spent += nx.cost; G.wagon++;
            resizeInv(G, nx.w, nx.h);
            log(G, `You buy a ${nx.name}.`, 'good');
            emit(G, { type: 'wagon', tier: G.wagon });
            return ok(`You now drive a ${nx.name}.`);
        }
        case 'craft': return craft(G, c);
        case 'accept': return acceptQuest(G, c.id);
        case 'turnin': return turnInQuest(G, c.id);
        case 'abandon': return abandonQuest(G, c.id);
        case 'hero': return serveHero(G, c.hid, c.w, c.id || 0);
        case 'rest': {
            const cost = 6;
            if (G.gold < cost) return fail('The inn costs 6g a night.');
            G.gold -= cost; G.stats.spent += cost;
            advanceDay(G); G.hour = 8;
            snapshotPrices(G, G.loc);
            return ok('You rest a night at the inn.');
        }
        case 'travel': {
            const to = c.to;
            const t = canTravel(G, to);
            if (!t.ok) return fail(t.reason);
            if (G.ending && G.over) return fail('The story is over.');
            G.travel = { from: G.loc, to, total: t.days, prog: 0, ticks: 0 };
            G.hour = 8;
            emit(G, { type: 'travel', from: G.loc, to, days: t.days });
            return ok(`Setting out for ${TOWN[to].name}: ${t.days} day${t.days > 1 ? 's' : ''}.`);
        }
        case 'resolve': return resolve(G, c.choice);
        case 'offer': {
            if (G.loc !== 'aurelion') return fail('The Hero\'s camp is outside Aurelion.');
            if (!G.heroCall) return fail('The Hero has not called for you yet.');
            if (G.ending) return fail('The Offer has already been made.');
            const picks = {};
            for (const s of SLOT_ORDER) {
                const lv = c.picks?.[s] | 0;
                if (!lv) continue;
                if (have(G, s, lv) < 1) return fail(`You do not have a level ${lv} ${FAMS[s].name.toLowerCase()}.`);
                picks[s] = lv;
            }
            for (const s of Object.keys(picks)) takeAny(G, s, picks[s], 1);
            endGame(G, picks);
            return ok('The Offer is made.');
        }
        default: return fail('Unknown command.');
    }
}

function buy(G, c) {
    const { shop } = c;
    const t = c.item;
    const lv = normLv(t, c.lv);
    if (!M.shopHas(G.loc, shop, t)) return fail('That shop does not sell that.');
    const d = itemDef(t, lv);
    if (!d) return fail('Unknown item.');
    const stock = M.stockOf(G, G.loc, t, lv);
    if (stock < 1) return fail('Sold out.');
    let n = Math.min(c.n | 0 || 1, stock);
    n = Math.min(n, room(G, t, lv, n));
    if (n < 1) return fail('No room in the wagon.');
    const b = burden(G);
    const spare = WAGONS[G.wagon].cap * BURDEN.hard - b.w;
    n = Math.min(n, Math.floor(spare / Math.max(0.01, d.wt)));
    if (n < 1) return fail('Too heavy to lift.');
    while (n > 0 && M.quote(G, G.loc, t, lv, 'buy', n).total > G.gold) n--;
    if (n < 1) return fail('You cannot afford that.');
    const cost = M.applyBuy(G, G.loc, t, lv, n);
    G.gold -= cost;
    G.stats.spent += cost; G.stats.bought += n;
    addItems(G, t, lv, n);
    emit(G, { type: 'buy', t, lv, n, cost });
    return ok(`Bought ${n} ${d.name} for ${cost}g.`, { n, cost });
}
function sellOne(G, it, n) {
    const sh = M.shopFor(G.loc, it.t);
    if (!sh || it.t === 'parcel') return null;
    n = Math.min(n, it.n);
    const base = basePrice(it.t, it.lv) * n;
    const total = M.applySell(G, G.loc, it.t, it.lv, n);
    const name = itemName(it.t, it.lv);
    const t = it.t, lv = it.lv;
    removeItems(G, t, lv, n);
    // removeItems took the lowest/non-favourite stack first; that is fine for same-kind stacks
    G.gold += total;
    G.stats.earned += total; G.stats.sold += n;
    G.stats.maxGold = Math.max(G.stats.maxGold, G.gold);
    gainXp(G, total * XP.sale + Math.max(0, total - base) * XP.profit);
    emit(G, { type: 'sell', t, lv, n, gain: total });
    return { n, total, name };
}
function sell(G, c) {
    const it = itemById(G, c.id);
    if (!it) return fail('No such item.');
    if (it.fav) return fail('That is marked as a favourite. Unmark it to sell.');
    if (!M.shopFor(G.loc, it.t)) return fail('No shop here buys that.');
    const n = clamp(c.n === 'all' || c.n == null ? it.n : c.n | 0, 1, it.n);
    const r = sellOne(G, it, n);
    if (!r) return fail('Nobody buys that.');
    return ok(`Sold ${r.n} ${r.name} for ${r.total}g.`, { n: r.n, total: r.total });
}
function sellJunk(G) {
    let total = 0, n = 0;
    for (const it of [...G.inv.items]) {
        if (!it.junk || it.fav) continue;
        const r = sellOne(G, G.inv.items.find((x) => x.id === it.id) || it, it.n);
        if (r) { total += r.total; n += r.n; }
    }
    return n ? ok(`Sold ${n} junk items for ${total}g.`, { n, total }) : fail('No junk-marked items could be sold here.');
}

function craft(G, c) {
    const r = recipeById(c.rid);
    if (!r) return fail('Unknown recipe.');
    const lvStation = TOWN[G.loc].stations[r.station] || 0;
    if (lvStation < r.stationLv) return fail(lvStation ? `This ${r.station} is only level ${lvStation}; you need ${r.stationLv}.` : 'There is no workshop of that kind here.');
    if (G.lv < r.needLv) return fail(`You need merchant level ${r.needLv} for that recipe.`);
    const outT = r.out, outLv = r.outLv;
    const d = itemDef(outT, outLv);
    let n = Math.max(1, c.n | 0 || 1);
    for (const i of r.inputs) n = Math.min(n, Math.floor(have(G, i.t, 0) / i.n));
    if (n < 1) return fail('You are missing ingredients.');
    n = Math.min(n, room(G, outT, outLv, n));
    if (n < 1) return fail('No room in the wagon for the result.');
    const unitFee = Math.max(1, Math.round(d.price * 0.05));
    n = Math.min(n, Math.floor(G.gold / unitFee));
    if (n < 1) return fail(`The workshop fee is ${unitFee}g.`);
    for (const i of r.inputs) takeAny(G, i.t, 0, i.n * n);
    G.gold -= unitFee * n; G.stats.spent += unitFee * n;
    addItems(G, outT, outLv, n);
    G.stats.crafted += n;
    gainXp(G, d.price * XP.craft * n * (r.fam === 'ingot' ? 0.5 : 1) + 3 * n);
    emit(G, { type: 'craft', t: outT, lv: outLv, n });
    log(G, `Crafted ${n} ${d.name}.`, 'good');
    return ok(`Crafted ${n} ${d.name}.`, { n });
}

function resolve(G, choice) {
    const p = G.pending;
    if (!p) return fail('Nothing to decide.');
    const R = Math.max(TOWN[G.travel.to].region, TOWN[G.travel.from].region);
    if (p.kind === 'bandits') {
        let won = false, msg;
        if (choice === 'pay') {
            const pay = Math.min(G.gold, p.demand);
            G.gold -= pay; G.stats.spent += pay;
            msg = `You hand over ${pay}g and the bandits melt away.`;
        } else {
            const chance = choice === 'flee' ? 0.55 : p.chance;
            won = G.rng() < chance;
            if (won) {
                const loot = Math.round(p.demand * 1.4) + 10 * R;
                G.gold += loot; G.stats.earned += loot;
                gainXp(G, 18 * R + 10);
                msg = choice === 'flee' ? 'You whip the horses and leave them in the dust.' : `You beat the bandits back and find ${loot}g in their camp!`;
            } else {
                const lost = Math.min(G.gold, p.demand * 2);
                G.gold -= lost; G.stats.spent += lost;
                const stacks = G.inv.items.filter((i) => !i.fav && !i.qid);
                let extra = '';
                if (stacks.length && G.rng() < 0.3) {
                    const s = stacks[Math.floor(G.rng() * stacks.length)];
                    const k = Math.max(1, Math.floor(s.n / 2));
                    removeItems(G, s.t, s.lv, k);
                    extra = ` They also make off with ${k} ${itemName(s.t, s.lv)}.`;
                }
                if (choice === 'flee') { G.travel.total++; extra += ' Fleeing costs you a day.'; }
                msg = `It goes badly: you lose ${lost}g.${extra}`;
            }
        }
        log(G, msg, won ? 'good' : 'bad');
        emit(G, { type: 'road-result', kind: 'bandits', won, msg });
        G.pending = null;
        return ok(msg, { won });
    }
    if (p.kind === 'wanderer') {
        G.pending = null;
        if (choice !== 'accept') return ok('You wave the peddler on.');
        let n = Math.min(p.n, room(G, p.t, 0, p.n));
        n = Math.min(n, Math.floor(G.gold / p.unit));
        if (n < 1) return ok('You cannot take the goods.');
        G.gold -= p.unit * n; G.stats.spent += p.unit * n;
        addItems(G, p.t, 0, n);
        log(G, `You buy ${n} ${MATS[p.t].name} from a road peddler, cheap.`, 'good');
        return ok(`Bought ${n} ${MATS[p.t].name}.`);
    }
    G.pending = null;
    return ok('');
}

// ---------------------------------------------------------------- save
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}
export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
