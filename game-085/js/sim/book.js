// The scrapbook: a record of every person met, every monster fought, every piece of gear and every good
// handled, every town reached and every road driven. Written by the rules as things happen; read by the
// Scrapbook tab. Pure.

import { TOWN, FAMILIES, REGIONS } from './data.js';
import { emit } from './core.js';

const MAX_ITEMS = 500;
const MAX_LEGS = 1000;

export function newBook() {
    return { people: {}, monsters: {}, wardens: {}, items: {}, goods: {}, mats: {}, places: {}, legs: [], letters: [], lore: [], seen: 0 };
}

/** Saves from before the scrapbook get one, filled from what the save already knows. */
export function ensureBook(G) {
    if (G.book) return;
    G.book = newBook();
    for (const m of G.party) notePerson(G, m, 'riding', G.at, true);
    for (const t in G.towns) if (G.towns[t].visits > 0) G.book.places[t] = { first: 0 };
}

/** How many entries the scrapbook holds: what the "new" badge counts. */
export function bookCount(G) {
    const b = G.book;
    return Object.keys(b.people).length + Object.keys(b.monsters).length + Object.keys(b.wardens).length
        + Object.keys(b.items).length + Object.keys(b.places).length;
}

const whereNow = (G) => G.at || (G.road ? `${G.road.from}>${G.road.to}` : 'hearthford');

// ------------------------------------------------------------------ people
/** status: riding (in the caravan), asked (a wanderer's offer), passed (declined or moved on), parted (left the caravan). */
export function notePerson(G, m, status, where = null, quiet = false) {
    const b = G.book;
    const p = b.people[m.id];
    if (!p) {
        b.people[m.id] = { id: m.id, name: m.name, cls: m.cls, level: m.level, status, met: G.t, where: where || whereNow(G), since: G.t };
        if (!quiet) emit(G, { type: 'discover', kind: 'person', name: m.name });
        return;
    }
    p.level = Math.max(p.level, m.level);
    if (p.status !== status) { p.status = status; p.since = G.t; }
}

// ------------------------------------------------------------------ monsters and Wardens
export function noteFoes(G, foes, won, region) {
    const b = G.book;
    for (const f of foes) {
        if (f.warden) continue;
        let r = b.monsters[f.fam];
        if (!r) {
            r = b.monsters[f.fam] = { fam: f.fam, seen: 0, kills: 0, elites: 0, first: G.t, region, top: 0 };
            emit(G, { type: 'discover', kind: 'monster', name: FAMILIES[f.fam].name });
        }
        r.seen++;
        r.top = Math.max(r.top, f.level);
        if (won) { r.kills++; if (f.elite) r.elites++; }
    }
}

export function noteWarden(G, region, won) {
    const b = G.book;
    let w = b.wardens[region];
    if (!w) {
        w = b.wardens[region] = { region, tries: 0, wins: 0, first: G.t, beaten: null };
        emit(G, { type: 'discover', kind: 'warden', name: REGIONS[region].warden.name });
    }
    w.tries++;
    if (won) { w.wins++; if (w.beaten === null) w.beaten = G.t; }
}

// ------------------------------------------------------------------ things
export function noteItem(G, it, source) {
    const b = G.book;
    const r = b.items[it.name];
    if (r) {
        r.n++;
        r.rarity = Math.max(r.rarity, it.rarity);
        r.ilvl = Math.max(r.ilvl, it.ilvl);
        return;
    }
    b.items[it.name] = { name: it.name, slot: it.slot, rarity: it.rarity, ilvl: it.ilvl, n: 1, first: G.t, source };
    const keys = Object.keys(b.items);
    if (keys.length > MAX_ITEMS) {
        // forget the plainest, oldest piece; never the rare ones
        let worst = null;
        for (const k of keys) {
            const x = b.items[k];
            if (!worst || x.rarity < worst.rarity || (x.rarity === worst.rarity && x.first < worst.first)) worst = x;
        }
        delete b.items[worst.name];
    }
}

export function noteGood(G, good, { bought = 0, sold = 0, spent = 0, earned = 0 }) {
    const r = G.book.goods[good] || (G.book.goods[good] = { bought: 0, sold: 0, spent: 0, earned: 0 });
    r.bought += bought; r.sold += sold; r.spent += spent; r.earned += earned;
}

/** Add materials to the caravan and to the scrapbook's tally. */
export function gainMat(G, mat, n = 1) {
    G.mats[mat] += n;
    G.book.mats[mat] = (G.book.mats[mat] || 0) + n;
}

// ------------------------------------------------------------------ places and roads
export function notePlace(G, town) {
    if (G.book.places[town]) return;
    G.book.places[town] = { first: G.t };
    if (G.t > 0) emit(G, { type: 'discover', kind: 'place', name: TOWN[town].name });
}

export function noteLeg(G, from, to, miles, leg) {
    const L = G.book.legs;
    L.push({ t: G.t, from, to, mi: Math.round(miles), f: leg?.fights || 0, w: leg?.won || 0, g: Math.round(leg?.gold || 0), k: leg?.kills || 0 });
    if (L.length > MAX_LEGS) L.splice(0, L.length - MAX_LEGS);
}

export function noteLetter(G, letter) {
    if (letter && !G.book.letters.includes(letter.title)) G.book.letters.push(letter.title);
}
