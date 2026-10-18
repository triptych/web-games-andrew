// Prices, trade and rations. Pure: prices are a function of the town, the good, the game clock and how much
// the caravan has bought or sold there lately.

import { GOODS, GOOD, TOWN, TOWNS, UPGRADES } from './data.js';
import { DAY, FOOD } from '../config.js';
import { hash3 } from '../rng.js';
import { cartLevel } from './party.js';
import { clamp, log, emit } from './core.js';
import { noteGood } from './book.js';

const TOWN_IX = Object.fromEntries(TOWNS.map((t, i) => [t.id, i]));
const GOOD_IX = Object.fromEntries(GOODS.map((g, i) => [g.id, i]));
const PRESS_DECAY = 1 / 40;            // one unit of buying or selling pressure fades every 40 ticks

/** The pressure the caravan's own trading has put on a price, after it has faded. */
function pressure(G, town, good) {
    const p = G.towns[town].press[good];
    if (!p) return 0;
    const left = Math.max(0, Math.abs(p.v) - (G.t - p.t) * PRESS_DECAY);
    return Math.sign(p.v) * left;
}
function push(G, town, good, dv) {
    const v = pressure(G, town, good) + dv;
    if (Math.abs(v) < 1e-6) delete G.towns[town].press[good];
    else G.towns[town].press[good] = { v, t: G.t };
}

/** The town's middle price for a good. */
export function midPrice(G, town, good) {
    const T = TOWN[town], g = GOOD[good];
    let f;
    if (T.produces.includes(good)) f = 0.62;
    else if (g.region === T.region) f = 0.85;
    else f = 1 + 0.1 * Math.abs(g.region - T.region);
    if (T.wants.includes(good)) f *= 1.35;
    const ph = hash3(TOWN_IX[town], GOOD_IX[good], G.seed) * Math.PI * 2;
    f *= 1 + 0.1 * Math.sin((2 * Math.PI * G.t) / (5 * DAY) + ph);
    f *= clamp(1 - 0.012 * pressure(G, town, good), 0.55, 1.6);
    return g.base * f;
}

export function traderK(G) {
    const l = cartLevel(G, 'trader');
    return l ? { buy: 1 - (3 + l) / 100, sell: 1 + (4 + 2 * l) / 100 } : { buy: 1, sell: 1 };
}
export const buyPrice = (G, town, good) => Math.max(1, Math.round(midPrice(G, town, good) * 1.08 * traderK(G).buy));
export const sellPrice = (G, town, good) => Math.max(1, Math.round(midPrice(G, town, good) * 0.92 * traderK(G).sell));

export const cargoCap = (G) => 20 + 10 * G.up.hold + 8 * cartLevel(G, 'trader');
export const cargoUsed = (G) => Object.values(G.cargo).reduce((a, c) => a + c.n, 0);
export const larderCap = (G) => FOOD.larder + FOOD.larderPerLevel * G.up.larder;
export const rationPrice = (G, town) => Math.round(FOOD.price * (1 + 0.45 * TOWN[town].region) * 10) / 10;

/** Units of a good that quests are waiting for. Auto-trade never sells them. */
export function reserved(G, good) {
    let n = 0;
    for (const q of allQuests(G)) if (q.kind === 'deliver' && q.good === good && !q.done) n += q.n;
    return n;
}
export const allQuests = (G) => G.quests.concat(G.daily.contracts.filter((q) => !q.done));

export function buy(G, good, n = 1) {
    const town = G.at;
    if (!town) return 0;
    let got = 0;
    while (got < n && cargoUsed(G) < cargoCap(G)) {
        const p = buyPrice(G, town, good);
        if (G.gold < p) break;
        G.gold -= p;
        const c = G.cargo[good] || (G.cargo[good] = { n: 0, cost: 0 });
        c.n++; c.cost += p;
        push(G, town, good, -1);
        got++;
        G.stats.goldSpent += p;
        noteGood(G, good, { bought: 1, spent: p });
    }
    return got;
}

export function sell(G, good, n = 1) {
    const town = G.at;
    const c = G.cargo[good];
    if (!town || !c) return 0;
    let sold = 0, take = 0;
    while (sold < n && c.n > 0) {
        const p = sellPrice(G, town, good);
        const avg = c.cost / c.n;
        G.gold += p;
        take += p;
        G.stats.profit += p - avg;
        c.cost -= avg; c.n--;
        push(G, town, good, 1);
        sold++;
        noteGood(G, good, { sold: 1, earned: p });
    }
    if (c.n <= 0) delete G.cargo[good];
    G.stats.goldEarned += take;
    G.stats.trades += sold;
    return take;
}

export function buyRations(G, n) {
    if (!G.at) return 0;
    const p = rationPrice(G, G.at);
    const can = Math.max(0, Math.min(n, larderCap(G) - G.rations, Math.floor(G.gold / p)));
    G.rations += can;
    G.gold -= can * p;
    G.stats.goldSpent += can * p;
    return can;
}

/**
 * What a sensible quartermaster does on arrival: fill the larder, sell what fetches a good price here,
 * buy quest goods, then fill the hold with what this town makes cheaply. Returns { sold, spent }.
 */
export function autoTrade(G) {
    const town = G.at;
    buyRations(G, larderCap(G));
    let sold = 0, spent = 0;
    for (const g of Object.keys(G.cargo)) {
        const keep = reserved(G, g);
        while (G.cargo[g] && G.cargo[g].n > keep) {
            const c = G.cargo[g], avg = c.cost / c.n, base = GOOD[g].base;
            if (sellPrice(G, town, g) < Math.max(avg * 1.12, base * 0.95)) break;
            sold += sell(G, g, 1);
        }
    }
    // quest goods, at a fair price
    for (const g of GOODS) {
        const need = reserved(G, g.id) - (G.cargo[g.id]?.n || 0);
        for (let i = 0; i < need; i++) {
            if (buyPrice(G, town, g.id) > g.base * 1.25) break;
            const before = G.gold;
            if (!buy(G, g.id, 1)) break;
            spent += before - G.gold;
        }
    }
    // speculation: spend up to 60% of the purse on local bargains
    const budget = G.gold * 0.6;
    let used = 0, guard = 0;
    const cands = GOODS.filter((g) => buyPrice(G, town, g.id) <= g.base * 0.8);
    while (cands.length && cargoUsed(G) < cargoCap(G) && guard++ < 400) {
        let any = false;
        for (const g of cands) {
            const p = buyPrice(G, town, g.id);
            if (p > g.base * 0.85 || used + p > budget) continue;
            if (!buy(G, g.id, 1)) continue;
            used += p; any = true;
            if (cargoUsed(G) >= cargoCap(G)) break;
        }
        if (!any) break;
    }
    spent += used;
    if (sold > 0) emit(G, { type: 'trade', gold: sold });
    return { sold, spent };
}

export function upgradeText(key, l) { return UPGRADES[key].text(l); }
export function logTrade(G, town, r) {
    if (r.sold > 0 || r.spent > 0) log(G, 'trade', `Traded at ${TOWN[town].name}: sold ${Math.round(r.sold)}g of goods, bought ${Math.round(r.spent)}g.`);
}
