// The road network, how fast the caravan moves along it, and where it goes next on its own. Pure.

import { ROADS, TOWN, TOWNS, REGIONS, GOODS, otherEnd, roadMiles } from './data.js';
import { TRAVEL, DAY, NIGHT_FROM, NIGHT_TO } from '../config.js';
import { cartLevel, partyLevel } from './party.js';
import { sellPrice, buyPrice, cargoUsed, cargoCap, allQuests } from './economy.js';
import { wardenFoes, predictOdds } from './battle.js';

export const isOpen = (G, road) => road.gate === null || !!G.lit[road.gate];
export const regionOpen = (G, r) => r === 0 || !!G.lit[r - 1];
export const maxRegion = (G) => { let r = 0; while (r < 5 && G.lit[r]) r++; return r; };

export function roadsFrom(G, town) {
    return ROADS.filter((r) => (r.a === town || r.b === town) && isOpen(G, r));
}

export const miles = (road) => roadMiles(road, TRAVEL.milesPerUnit);

/** Shortest distances in miles from a town over open roads: { dist, prev }. */
export function dijkstra(G, from) {
    const dist = { [from]: 0 }, prev = {}, done = new Set();
    for (;;) {
        let u = null;
        for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
        if (u === null) break;
        done.add(u);
        for (const r of roadsFrom(G, u)) {
            const v = otherEnd(r, u), d = dist[u] + miles(r);
            if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = u; }
        }
    }
    return { dist, prev };
}

/** The first town on the shortest way from `from` to `to`, or null. */
export function nextHop(G, from, to) {
    if (from === to) return null;
    const { prev } = dijkstra(G, from);
    if (prev[to] === undefined) return null;
    let v = to;
    while (prev[v] !== from) v = prev[v];
    return v;
}

export function dayFrac(G) { return (G.t % DAY) / DAY; }
export function isNight(G) { const f = dayFrac(G); return f >= NIGHT_FROM || f < NIGHT_TO; }

/** Miles per tick, everything included. */
export function speed(G) {
    let s = TRAVEL.speed * (1 + 0.12 * G.up.wheels);
    const scout = cartLevel(G, 'scout');
    if (scout) s *= 1 + (4 + 2 * scout) / 100;
    if (G.rations <= 0) s *= TRAVEL.hungry;
    if (G.buffs.rally > G.t) s *= TRAVEL.rally.mult;
    if (G.buffs.storm > G.t) s *= 0.7;
    if (G.buffs.shrine && G.buffs.shrine.kind === 'swift' && G.buffs.shrine.until > G.t) s *= 1.25;
    return s;
}

/** Where on the map the caravan is: { x, y } in map units. */
export function mapPos(G) {
    if (G.at || !G.road) { const T = TOWN[G.at || 'hearthford']; return { x: T.x, y: T.y }; }
    const A = TOWN[G.road.from], B = TOWN[G.road.to], k = G.road.done / G.road.miles;
    return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k };
}

/** Monster level on the current road. */
export function roadLevel(G) {
    const r = G.road;
    if (!r) return TOWN[G.at].danger;
    const a = TOWN[r.from].danger, b = TOWN[r.to].danger;
    return Math.round(a + (b - a) * (r.done / r.miles));
}

// ------------------------------------------------------------------ the planner
/** Can the party take the Warden of this region with the odds the orders ask for? */
export function wardenOdds(G, region) {
    return predictOdds(G, wardenFoes(G, region), 16);
}

/** The next unlit Waystone (region index), or 5 for the Night Roads after the ending. */
export function nextWarden(G) { return G.ended ? 5 : maxRegion(G); }

/** Towns the current quests want to go to, nearest first. */
export function questTargets(G) {
    const out = [];
    const here = G.at;
    for (const q of allQuests(G)) {
        if (q.done) continue;
        if (q.kind === 'courier') out.push(q.town);
        else if (q.kind === 'deliver') {
            if ((G.cargo[q.good]?.n || 0) >= q.n) out.push(q.town);
            else {
                // go and buy it where it's made
                const src = TOWNS.filter((t) => t.produces.includes(q.good) && regionOpen(G, t.region));
                for (const t of src) out.push(t.id);
            }
        } else if (q.kind === 'bounty') {
            if (TOWN[here]?.region === q.region) {
                // already there: keep moving along this region's roads
                for (const r of roadsFrom(G, here)) { const v = otherEnd(r, here); if (TOWN[v].region === q.region) out.push(v); }
            } else for (const t of TOWNS) if (t.region === q.region && regionOpen(G, t.region)) out.push(t.id);
        }
    }
    return out.filter((t) => t !== here);
}

function tradeScore(G, town, dist) {
    const sp = speed(G) || 0.01;
    const time = dist / sp + 120;
    let value = 0;
    for (const g in G.cargo) {
        const c = G.cargo[g];
        value += Math.max(0, sellPrice(G, town, g) * c.n - c.cost);
    }
    // an empty hold looks for somewhere to buy
    const free = cargoCap(G) - cargoUsed(G);
    if (free > 0) {
        let best = 0;
        for (const g of GOODS) if (TOWN[town].produces.includes(g.id)) best = Math.max(best, g.base - buyPrice(G, town, g.id));
        value += best * Math.min(free, G.gold / 20) * 0.5;
    }
    return value / time;
}

/** Pick the next town to drive to, or null to stay. */
export function planNext(G) {
    const here = G.at;
    if (!here) return null;
    if (G.course) {
        if (G.course === here) { G.course = null; return null; }
        const h = nextHop(G, here, G.course);
        if (h) return h;
        G.course = null;
    }
    const route = G.orders.route;
    if (route === 'hold') return null;
    const { dist } = dijkstra(G, here);
    const lvl = partyLevel(G);
    const safe = (t) => REGIONS[TOWN[t].region].lv[0] <= lvl + 4 || TOWN[t].region <= TOWN[here].region;
    const reachable = Object.keys(dist).filter((t) => t !== here && safe(t));
    if (!reachable.length) return null;

    let target = null;
    if (route === 'quests') {
        // a Warden we can beat comes first
        const w = nextWarden(G);
        if (G.orders.autoChallenge && w <= 5 && (!G.lit[w] || G.ended)) {
            const cap = REGIONS[w].warden.town;
            if (dist[cap] !== undefined && cap !== here && G.oddsCache && G.oddsCache.r === w && G.oddsCache.p >= 0.65) target = cap;
        }
        if (!target) {
            let best = Infinity;
            for (const t of questTargets(G)) if (dist[t] !== undefined && safe(t) && dist[t] < best) { best = dist[t]; target = t; }
        }
    }
    if (!target && route === 'explore') {
        target = reachable.reduce((a, b) => {
            const va = G.towns[a].visits, vb = G.towns[b].visits;
            return vb < va || (vb === va && dist[b] < dist[a]) ? b : a;
        });
    }
    if (!target) {
        let best = -1;
        for (const t of reachable) {
            if (dist[t] > 260) continue;
            const s = tradeScore(G, t, dist[t]) - G.towns[t].visits * 1e-6;
            if (s > best) { best = s; target = t; }
        }
        if (!target) target = reachable[0];
    }
    return nextHop(G, here, target);
}
