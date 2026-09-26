// ============================================================
// Job board postings, rolled each morning from seed + day.
// ctx: { level, open (region indices reachable), species, sites,
//        known (recipe ids), villagers (job ids), season }
// ============================================================

import { rngFor } from '../core/rng.js';
import { ITEM } from '../data/items.js';
import { CROPS, cropInSeason } from '../data/crops.js';
import { BIOMES } from '../data/monsters.js';

const GATHER_BASE = ['wood', 'stone', 'fiber', 'hay', 'clay', 'coal', 'sap'];

export function rollPostings(seed, day, ctx) {
    const rng = rngFor(seed, 'board', day);
    const out = [];
    const n = Math.min(5, 2 + ctx.level);
    const types = [['gather', 4], ['hunt', 3], ['delve', ctx.open.length ? 2 : 0], ['deliver', ctx.villagers.length ? 2 : 0], ['expedition', ctx.villagers.length ? 2 : 0]];
    for (let k = 0; k < n; k++) {
        const type = rng.weighted(types.filter(t => t[1] > 0));
        const p = make(type, rng, ctx, k);
        if (p) { p.id = `b${day}_${k}`; p.posted = day; out.push(p); }
    }
    return out;
}

function make(type, rng, ctx, k) {
    const topRegion = Math.max(1, ...ctx.open);
    const stars = Math.min(5, Math.max(1, rng.int(1, 2) + Math.floor((topRegion - 1) * 0.8)));
    const gold = Math.round((60 + stars * 70) * rng.range(0.85, 1.2) / 10) * 10;
    const coz = 6 + stars * 5;
    const expires = rng.int(2, 4);
    if (type === 'gather') {
        const pool = [...GATHER_BASE];
        for (const r of ctx.open) { const b = BIOMES[r - 1]; pool.push(...b.forage.slice(0, 3), ...b.ore.filter(o => o !== 'coal')); }
        for (const c of CROPS) if (c.seasons !== 'any' && cropInSeason(c, ctx.season)) pool.push(c.id);
        const id = rng.pick(pool);
        const it = ITEM[id];
        const cheap = it.sell < 10;
        const n = cheap ? rng.int(10, 25) + stars * 5 : Math.max(1, Math.round(rng.int(2, 6) * (1 + stars * 0.25)));
        return { type, item: id, n, stars, reward: { gold: gold + Math.round(it.sell * n * 0.6), coz, items: bonusItem(rng, stars) }, expires, title: `Wanted: ${n} × ${it.name}`, desc: pickLine(rng, GATHER_LINES, { item: it.name }), fit: it.cat };
    }
    if (type === 'hunt') {
        const regions = ctx.open.length ? ctx.open : [1];
        const r = rng.pick(regions);
        const sp = rng.pick(ctx.byRegion[r]);
        const S = ctx.species[sp];
        const n = rng.int(2, 4) + Math.floor(stars / 2);
        return { type, species: sp, region: r, n, stars: Math.max(stars, r), reward: { gold: gold + r * 60, coz, items: [[S.drop, rng.int(2, 4)]] }, expires, title: `Hunt: ${n} × ${S.name}`, desc: pickLine(rng, HUNT_LINES, { name: S.name }), fit: 'monster' };
    }
    if (type === 'delve') {
        const sites = ctx.sites.filter(s => ctx.open.includes(s.region));
        if (!sites.length) return null;
        const s = rng.pick(sites);
        const floor = Math.min(s.floors - (s.kind === 'dungeon' ? 1 : 0), rng.int(2, s.floors));
        return { type, site: s.id, floor, stars: Math.min(5, s.region + (floor > 3 ? 1 : 0)), reward: { gold: gold + floor * 40, coz, items: [[rng.pick(BIOMES[s.region - 1].ore), rng.int(3, 6)]] }, expires: expires + 1, title: `Delve: ${s.name}, floor ${floor}`, desc: pickLine(rng, DELVE_LINES, { place: s.name }), fit: 'ore' };
    }
    if (type === 'deliver') {
        const dish = rng.pick(ctx.known.length ? ctx.known : ['fried_egg']);
        const who = rng.pick(ctx.villagers);
        return { type, item: dish, n: 1, to: who, stars: Math.max(1, stars - 1), reward: { gold: gold + ITEM[dish].sell, coz: coz + 4, friend: 60 }, expires, title: `Deliver: ${ITEM[dish].name}`, desc: `A neighbour is craving ${ITEM[dish].name}. Bring one to the board.`, fit: 'dish', playerOnly: true };
    }
    if (type === 'expedition') {
        const r = rng.pick(ctx.open.length ? ctx.open : [1]);
        const days = rng.int(1, 3);
        const b = BIOMES[r - 1];
        const loot = [[rng.pick(b.forage), rng.int(3, 6)], [rng.pick(b.ore), rng.int(4, 8)]];
        if (rng.chance(0.25 + days * 0.1)) loot.push([rng.pick(b.gem), 1]);
        return { type, region: r, days, stars: Math.min(5, r + days - 1), reward: { gold: gold + days * 50, coz, items: loot }, expires, title: `Expedition: ${days} day${days > 1 ? 's' : ''} in region ${r}`, desc: 'Send villagers to scout and bring back whatever they find.', fit: 'expedition', villagerOnly: true };
    }
    return null;
}

function bonusItem(rng, stars) {
    if (!rng.chance(0.4)) return [];
    return [[rng.pick(['seed_turnip', 'seed_potato', 'seed_wheat', 'tonic', 'coal', 'hardwood', 'fried_egg']), rng.int(1, 3) + Math.floor(stars / 2)]];
}
const GATHER_LINES = ["We're running low on {item}. Anyone?", "The Mayor's asking for {item} for repairs.", "A trader from the valley will pay well for {item}.", "Need {item}! Will trade coin and gratitude."];
const HUNT_LINES = ["{name}s have been getting into the grain. Could someone thin them out?", "Travellers keep being chased by {name}s on the road.", "A {name} pack is getting bold. Please be careful."];
const DELVE_LINES = ["Someone should check how deep {place} goes these days.", "The Scholar wants notes from inside {place}.", "Old maps of {place} are wrong. Go see for yourself?"];
function pickLine(rng, lines, vars) { return rng.pick(lines).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m); }

/** Success chance for villagers taking a posting. */
export function assignChance(p, villagers, JOBS) {
    if (!villagers.length) return 0;
    let c = 0.5 - (p.stars - 1) * 0.1;
    let fitSum = 0;
    for (const v of villagers) {
        const J = JOBS[v.job];
        const qf = J.questFit[p.type] ?? 1;
        fitSum += (qf - 1) * 0.8 + (v.level - 1) * 0.06 + (v.happiness - 50) / 400;
    }
    c += fitSum;
    if (villagers.length > 1) c += 0.15;
    return Math.max(0.1, Math.min(0.95, c));
}
export const postingDays = p => p.type === 'expedition' ? p.days : p.type === 'delve' ? 2 : p.type === 'hunt' ? 2 : 1;
