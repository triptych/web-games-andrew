// Notice-board quests and the daily contracts. Pure.

import { TOWN, TOWNS, GOODS, GOOD, REGIONS, FAMILIES, HIRE_CLASSES, TAVERN } from './data.js';
import { QUESTS, monsterXp, monsterGold } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { regionOpen, dijkstra, maxRegion } from './world.js';
import { partyLevel, addXp, addCaravanXp, makeMember, makeItem, gainItem, xpMult, goldMult } from './party.js';
import { cargoCap } from './economy.js';
import { log, emit, plural } from './core.js';
import { gainMat } from './book.js';

const COURIER = ['Carry a sealed letter to', 'Escort a pilgrim to', 'Deliver medicine to', 'Take a wedding cake to', 'Return a lost dog to', 'Bring the mail to'];

function rngFor(G, a, b, c = 0) { return makeRng(Math.floor(hash3(a, b, G.seed ^ c) * 4294967296)); }

/** One quest posted at a town. scale multiplies its reward (daily contracts pay more). */
export function makeQuest(G, rng, from, kind = null, scale = 1) {
    const T = TOWN[from];
    const lvl = Math.max(1, Math.round(partyLevel(G)));
    kind = kind || rng.weighted([{ k: 'deliver', weight: 0.35 }, { k: 'bounty', weight: 0.4 }, { k: 'courier', weight: 0.25 }]).k;
    const q = { id: G.nextId++, kind, from, done: false, have: 0, scale };
    const { dist } = dijkstra(G, from);
    const open = TOWNS.filter((t) => dist[t.id] !== undefined && t.id !== from);
    const top = maxRegion(G);
    const to0 = open.length ? rng.pick(open) : null;
    const goods = to0 ? GOODS.filter((g) => g.region <= top && !to0.produces.includes(g.id)) : [];
    if (kind === 'deliver' && !goods.length) kind = q.kind = 'courier';
    if (kind === 'deliver') {
        const to = to0;
        const g = rng.pick(goods);
        q.good = g.id;
        q.town = to.id;
        q.n = Math.max(2, Math.min(Math.floor(cargoCap(G) / 2), rng.int(3, 9)));
        q.gold = Math.round(q.n * g.base * 1.6 * scale);
        q.xp = Math.round(monsterXp(lvl) * (2 + q.n / 2) * scale);
        q.title = `${to.name} needs ${q.n} ${g.name}`;
    } else if (kind === 'bounty') {
        const regions = [T.region, T.region - 1].filter((r) => r >= 0 && regionOpen(G, r) && REGIONS[r].lv[0] <= lvl + 3);
        const r = regions.length ? rng.pick(regions) : T.region;
        const fam = rng.pick(REGIONS[r].monsters.filter((f) => !FAMILIES[f].rare));
        const L = Math.round((REGIONS[r].lv[0] + REGIONS[r].lv[1]) / 2) + 10 * G.tier;
        q.fam = fam; q.region = r;
        q.n = rng.int(4, 9);
        q.gold = Math.round(q.n * monsterGold(L) * 2.4 * scale);
        q.xp = Math.round(q.n * monsterXp(L) * 1.2 * scale);
        q.title = `Slay ${q.n} ${FAMILIES[fam].plural} in ${REGIONS[r].name}`;
    } else {
        const near = open.filter((t) => dist[t.id] <= 120);
        const to = rng.pick(near.length ? near : open.length ? open : [T]);
        q.kind = 'courier';
        q.town = to.id;
        q.n = 1;
        q.gold = Math.round((20 + dist[to.id] * 0.8) * (1 + TOWN[to.id].region) * (1 + 0.5 * G.tier) * scale);
        q.xp = Math.round(monsterXp(lvl) * 3 * scale);
        q.title = `${rng.pick(COURIER)} ${to.name}`;
    }
    return q;
}

/** The notice board and tavern a town shows on this visit (the same on a reload). */
export function stockTown(G, town) {
    const v = G.towns[town].visits;
    const ix = TOWNS.findIndex((t) => t.id === town);
    const rng = rngFor(G, ix, v, 77);
    G.board = [];
    for (let i = 0; i < QUESTS.board; i++) G.board.push(makeQuest(G, rng, town));
    const pool = TAVERN[TOWN[town].region];
    G.tavern = [];
    for (let i = 0; i < 2; i++) {
        const cls = rng.chance(0.75) ? rng.pick(pool) : rng.pick(HIRE_CLASSES);
        const m = makeMember(G, cls, Math.max(1, G.level - rng.int(0, 2)), rng);
        G.tavern.push({ m, cost: hireCost(m.level) });
    }
}

export const hireCost = (level) => Math.round(30 * Math.pow(level, 1.5) + 20);

export function accept(G, qid) {
    const i = G.board.findIndex((q) => q.id === qid);
    if (i < 0 || G.quests.length >= QUESTS.active) return false;
    G.quests.push(G.board[i]);
    G.board.splice(i, 1);
    return true;
}

export function autoAccept(G) {
    let n = 0;
    while (G.quests.length < QUESTS.active && G.board.length) { accept(G, G.board[0].id); n++; }
    return n;
}

function reward(G, q, daily) {
    q.done = true;
    const gold = Math.round(q.gold * goldMult(G));
    const xp = Math.round(q.xp * xpMult(G));
    G.gold += gold;
    G.stats.goldEarned += gold;
    G.stats.quests++;
    addCaravanXp(G, xp);
    for (const m of G.party) addXp(G, m, xp);
    if (daily) {
        const rng = rngFor(G, G.t, q.id, 5);
        gainItem(G, makeItem(G, rng, Math.round(partyLevel(G)) + 1 + 10 * G.tier, { luck: 0.6, minRarity: 2 }), 'Contract reward');
    }
    log(G, 'quest', `${daily ? 'Contract' : 'Quest'} done: ${q.title}. +${gold}g, +${xp} xp.`, true);
    emit(G, { type: 'quest', title: q.title, gold, daily });
}

/** Deliveries and couriers finish on arrival. */
export function onArrive(G, town) {
    const check = (q, daily) => {
        if (q.done || q.town !== town) return;
        if (q.kind === 'courier') reward(G, q, daily);
        else if (q.kind === 'deliver') {
            const c = G.cargo[q.good];
            if (!c || c.n < q.n) return;
            const avg = c.cost / c.n;
            c.n -= q.n; c.cost -= avg * q.n;
            if (c.n <= 0) delete G.cargo[q.good];
            reward(G, q, daily);
        }
    };
    for (const q of G.quests) check(q, false);
    for (const q of G.daily.contracts) check(q, true);
    G.quests = G.quests.filter((q) => !q.done);
}

/** Bounties count kills. */
export function onKill(G, fam, n) {
    const check = (q, daily) => {
        if (q.done || q.kind !== 'bounty' || q.fam !== fam) return;
        q.have = Math.min(q.n, q.have + n);
        if (q.have >= q.n) reward(G, q, daily);
    };
    for (const q of G.quests) check(q, false);
    for (const q of G.daily.contracts) check(q, true);
    G.quests = G.quests.filter((q) => !q.done);
}

/** A new real-world day: three fresh contracts, and the morning post. */
export function newDay(G, day) {
    const d = G.daily;
    d.streak = d.day === day - 1 ? d.streak + 1 : 1;
    d.day = day;
    d.claimed = false;
    const rng = rngFor(G, day, 3, 11);
    const town = G.at || G.road?.to || 'hearthford';
    d.contracts = ['bounty', 'deliver', 'courier'].map((k) => {
        const q = makeQuest(G, rng, town, k, 2.5);
        q.daily = true;
        return q;
    });
    log(G, 'daily', `A new day: the morning post has arrived, and ${plural(3, 'contract')} with it.`, true);
    emit(G, { type: 'newDay', day });
}

export function claimPost(G) {
    const d = G.daily;
    if (d.claimed || d.day < 0) return null;
    d.claimed = true;
    const rng = rngFor(G, d.day, 9, 13);
    const k = 1 + 0.1 * Math.min(d.streak - 1, 10);
    const gold = Math.round(40 * Math.pow(G.level, 1.2) * k * (1 + 0.5 * G.tier));
    G.gold += gold;
    G.stats.goldEarned += gold;
    const mats = {};
    for (let i = 0; i < 3 + Math.min(d.streak, 5); i++) {
        const m = rng.pick(['hide', 'meat', 'ore', 'timber', 'herb', 'crystal']);
        mats[m] = (mats[m] || 0) + 1;
        gainMat(G, m);
    }
    const it = makeItem(G, rng, Math.round(partyLevel(G)) + 10 * G.tier, { luck: 0.3 * k, minRarity: 1 });
    gainItem(G, it, 'Morning post');
    G.stats.chests++;
    log(G, 'daily', `Opened the morning post (day ${d.streak} in a row): ${gold}g and a ${it.name}.`);
    emit(G, { type: 'chest', gold });
    return { gold, mats, item: it, streak: d.streak };
}

export { GOOD };
