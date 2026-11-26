// Folio & Fable — the simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// Everything the player can do is a command passed to act(G, cmd); the shop clock runs in step(G, dt) only while
// the doors are open. The view reads G and drains G.events; the bot and the tests drive act() and step() directly.

import { DAY, SHOP, START, ECON, EXP } from '../config.js';
import { makeRng } from '../rng.js';
import {
    KINDS, KIND_IDS, RARITY, VIRTUE_IDS, SKILLS, MATERIALS, MATERIAL_IDS, MASTERWORK, FURNITURE, FOLK, FOLK_IDS,
    FOLK_NAMES, REQUEST_REASONS, HEROES, HERO_IDS, PLACES, PLACE_IDS, INSPIRATIONS, CHAPTERS, VOICES,
} from './data.js';
import { makeBook, bookValue, stat } from './books.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const DOOR = -0.7;

// ================================================================== new game
export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        day: 1,
        phase: 'morning',              // morning | open | evening
        clock: 0,
        gold: START.gold,
        renown: 0,
        nextId: 1,
        books: [],
        mats: { paper: 2, ink: 1, honey: 1 },
        shop: { width: SHOP.width, wall: new Array(SHOP.width).fill(null), floor: new Array(SHOP.width).fill(null) },
        stored: {},                    // furniture bought but not placed: { type: count }
        heroes: {},
        exps: [],
        customers: [],
        schedule: [],
        commissions: [],
        trader: null,
        town: { valor: 0, wit: 0, hearth: 0, charm: 0, wonder: 0 },
        inspired: [],
        patterns: ['cookbook', 'novel', 'almanac'],
        player: { skills: [], binding: 0, read: 0, readToday: false },
        flags: { exp: false, bindery: false, trader: false, observatory: false },
        story: { ch: 1, base: 0, told: [] },
        ending: false,
        stats: { sold: 0, earned: 0, expeditions: 0, crafted: 0, requests: 0, talked: 0, inspired: 0, masterwork: 0, visitors: 0, days: 0 },
        today: null,
        talkedToday: [],
        ledger: [],
        events: [],                    // { type, ... } since the last drain; never saved
    };
    for (const h of HERO_IDS) G.heroes[h] = { hired: false, lv: 1, xp: 0, book: null, away: null };
    // Elowen's shop as Tam finds it: two dusty shelves and her last ten books
    G.shop.wall[1] = { type: 'shelf' };
    G.shop.wall[4] = { type: 'shelf' };
    const kinds = ['cookbook', 'cookbook', 'novel', 'novel', 'novel', 'almanac', 'almanac', 'poetry', 'bestiary', 'atlas'];
    for (const k of kinds) addBook(G, { kind: k, rarity: G.rng() < 0.2 ? 1 : 0, talk: false });
    G.story.base = counter(G, CHAPTERS[0]);
    return G;
}

function addBook(G, opts) {
    const b = makeBook(G.nextId++, (G.rng() * 2 ** 31) | 0, opts);
    G.books.push(b);
    return b;
}

// ================================================================== lookups (used by the view, the bot and the tests)
export const book = (G, id) => G.books.find((b) => b.id === id) || null;
export const has = (G, insp) => G.inspired.includes(insp);
export const knows = (G, skill) => G.player.skills.includes(skill);
export const bindingLevel = (G) => 1 + Math.floor(Math.sqrt(G.player.binding));
export const isFree = (b) => !b.loc || b.loc.row;          // on a shelf or in the back room: can be sold or given
export const unshelved = (G) => G.books.filter((b) => !b.loc);

export function cell(G, row, slot) { return G.shop[row]?.[slot] || null; }
export function cap(G, row, slot) { const c = cell(G, row, slot); return c ? FURNITURE[c.type].cap || 0 : 0; }
export function shelfBooks(G, row, slot) {
    const out = [];
    for (const b of G.books) if (b.loc && b.loc.row === row && b.loc.slot === slot) out[b.loc.i] = b;
    return out;
}
/** The kind with four or more books on a shelf, if any: a section. */
export function section(G, row, slot) {
    const n = {};
    for (const b of shelfBooks(G, row, slot)) if (b) n[b.kind] = (n[b.kind] || 0) + 1;
    const best = Object.entries(n).sort((a, c) => c[1] - a[1])[0];
    return best && best[1] >= 4 ? best[0] : null;
}

export function cozy(G) {
    const n = {};
    let c = 0;
    for (const row of ['wall', 'floor']) for (const x of G.shop[row]) {
        if (!x) continue;
        n[x.type] = (n[x.type] || 0) + 1;
        c += FURNITURE[x.type].cozy * (n[x.type] > 2 ? 0.5 : 1);
    }
    if (knows(G, 'cozykeeping')) c += 4;
    return Math.round(c);
}

/** How eye-catching a shelf or table is: decor beside it, a section, a lamp in front. */
export function appeal(G, row, slot) {
    const c = cell(G, row, slot);
    if (!c || !FURNITURE[c.type].cap) return 0;
    let a = c.type === 'table' ? 1.4 : 1;
    for (const d of [-1, 0, 1]) {
        const w = cell(G, 'wall', slot + d), f = cell(G, 'floor', slot + d);
        if (w && (w.type === 'painting' || w.type === 'ivy')) a += 0.35;
        if (f && ['lamp', 'fern', 'armchair', 'cat'].includes(f.type)) a += d === 0 ? 0.45 : 0.25;
    }
    if (section(G, row, slot)) a += 0.6;
    return a;
}

export function visitorsToday(G) {
    let n = 3 + Math.floor(cozy(G) / 6) + Math.floor(G.renown / 15);
    if (has(G, 'bakery')) n += 1;
    if (has(G, 'bakery2')) n += 2;
    if (G.day === 1) n = 4;
    return clamp(n, 3, 12);
}

export function priceOf(G, b, folk = null) {
    let p = b.value * (1 + Math.min(ECON.renownPriceCap, G.renown * ECON.renownPrice));
    if (knows(G, 'silvertongue')) p *= 1 + ECON.silverTongue;
    if (folk) p *= Math.sqrt(FOLK[folk].budget);
    return Math.max(1, Math.round(p));
}

// ------------------------------------------------------------------ requests
export function matches(b, req) {
    if (!b || !req) return false;
    if (req.kind && b.kind !== req.kind) return false;
    if (req.virtue && stat(b, req.virtue) < (req.min || 1)) return false;
    if (req.skill && !b.skill) return false;
    if (req.talk && !b.talk) return false;
    return true;
}
export function describeReq(req) {
    const parts = [];
    if (req.kind) parts.push(`a ${KINDS[req.kind].name.toLowerCase()}`);
    else parts.push('a book');
    if (req.virtue) parts.push(`with ${req.virtue[0].toUpperCase() + req.virtue.slice(1)} ${req.min}+`);
    if (req.skill) parts.push('that teaches a skill');
    return parts.join(' ');
}
/** Books that could answer a request: on the shelves or in the back room, not carried by an adventurer. */
export function candidates(G, req) {
    return G.books.filter((b) => isFree(b) && !b.masterwork && matches(b, req)).sort((a, c) => a.value - c.value);
}

function makeRequest(G, folkId, r) {
    const F = FOLK[folkId];
    const lo = 1 + Math.floor(G.day / 9), hi = 2 + Math.floor(G.renown / 14);
    const min = clamp(r.int(lo, Math.max(lo, hi)), 1, 9);
    const x = r();
    let req;
    if (x < 0.35) req = { kind: r.pick(F.kinds) };
    else if (x < 0.7) req = { virtue: r.pick(F.virtues), min };
    else if (x < 0.9 || G.story.ch <= 3) req = { kind: r.pick(F.kinds), virtue: r.pick(F.virtues), min: Math.max(1, min - 1) };
    else req = { skill: true };
    // a kind+virtue the kind never carries would be unanswerable; fall back to the kind alone
    if (req.kind && req.virtue && !KINDS[req.kind].virtues.includes(req.virtue)) { delete req.virtue; delete req.min; }
    return req;
}

// ------------------------------------------------------------------ expeditions
export function heroPower(G, hid, placeId) {
    const H = HEROES[hid], h = G.heroes[hid], P = PLACES[placeId];
    const b = h.book ? book(G, h.book) : null;
    let p = h.lv;
    P.virtues.forEach((v, i) => {
        const w = i === 0 ? 1 : 0.5;
        p += w * ((H.stats[v] || 0) + (b ? stat(b, v) : 0));
    });
    const skills = [H.skill, b?.skill].filter(Boolean);
    if (skills.includes('campfire')) p += 2;
    if (P.bonus && skills.includes(P.bonus)) p += P.bonus === 'swimming' ? 4 : 5;
    return p;
}
export function partyPower(G, heroes, placeId) {
    let p = heroes.reduce((a, h) => a + heroPower(G, h, placeId), 0);
    if (has(G, 'guild')) p += 1;
    if (has(G, 'guild2')) p += 2;
    return p;
}
export function chanceOf(G, heroes, placeId) {
    if (!heroes.length) return 0;
    const p = partyPower(G, heroes, placeId);
    return clamp(EXP.baseChance + EXP.slope * p / PLACES[placeId].need, EXP.minChance, EXP.maxChance);
}
export function partySkills(G, heroes) {
    const s = new Set();
    for (const h of heroes) {
        if (HEROES[h].skill) s.add(HEROES[h].skill);
        const b = G.heroes[h].book && book(G, G.heroes[h].book);
        if (b?.skill) s.add(b.skill);
    }
    return s;
}
export function placeOpen(G, id) {
    const u = PLACES[id].unlock;
    if (u.start) return true;
    if (u.renown != null) return G.renown >= u.renown;
    if (u.chapter) return G.flags.observatory;
    return false;
}
export const homeHeroes = (G) => HERO_IDS.filter((h) => G.heroes[h].hired && !G.heroes[h].away);
export function heroAvailable(G, hid) {
    if (G.heroes[hid].hired) return false;
    if (hid === 'rook') return false;                       // Rook comes with the story
    if (hid === 'fen') return G.flags.exp && G.day >= 3;
    if (hid === 'juniper') return G.flags.exp && (has(G, 'guild') || G.day >= 10);
    if (hid === 'maris') return G.flags.exp && (G.story.ch >= 5 || G.day >= 14);
    return false;
}

// ------------------------------------------------------------------ crafting
export function canUsePattern(G, kind) { return G.flags.bindery && G.patterns.includes(kind); }
export function upChance(G) {
    let c = 0.55 + 0.05 * (bindingLevel(G) - 1);
    if (knows(G, 'finebinding')) c += 0.2;
    if (has(G, 'tower2')) c += 0.15;
    return clamp(c, 0, 0.95);
}
/** What a recipe can make: the rarity range and the chance of each step up. */
export function craftPreview(G, { cover, accents = [] }) {
    const lo = MATERIALS[cover] ? MATERIALS[cover].tier - 1 : 0;
    const ups = accents.filter((a) => a === 'gold' || a === 'star').length;
    return { lo, hi: Math.min(4, lo + ups), chance: upChance(G) };
}
export function hasMats(G, list) {
    const need = {};
    for (const m of list) need[m] = (need[m] || 0) + 1;
    return Object.entries(need).every(([m, n]) => (G.mats[m] || 0) >= n);
}

// ------------------------------------------------------------------ trader
export function traderPrice(G, item) {
    let p = item.book ? item.book.value * ECON.traderMarkup : MATERIALS[item.mat].price * item.n * ECON.traderMarkup;
    if (knows(G, 'appraisal')) p *= 1 - ECON.appraisal;
    return Math.max(1, Math.round(p));
}

// ================================================================== the commands
const OK = { ok: true };
const no = (msg) => ({ ok: false, msg });
const calm = (G) => G.phase !== 'open';

export function act(G, cmd) {
    const res = run(G, cmd);
    if (res.ok) checkStory(G);
    return res;
}

function run(G, c) {
    switch (c.t) {
        // ---------------------------------------------------------- arranging the shop
        case 'buyFurniture': {
            const F = FURNITURE[c.type];
            if (!F) return no('No such furniture.');
            if (!calm(G)) return no('Not while the shop is open.');
            if (F.unique && (G.stored[c.type] || placedCount(G, c.type))) return no('You already have one.');
            if (G.gold < F.cost) return no('Not enough gold.');
            G.gold -= F.cost;
            G.stored[c.type] = (G.stored[c.type] || 0) + 1;
            G.events.push({ type: 'bought', what: c.type });
            return OK;
        }
        case 'place': {
            const F = FURNITURE[c.type];
            if (!F || !calm(G)) return no('Not now.');
            if (!(G.stored[c.type] > 0)) return no('Buy it first.');
            if (F.row !== c.row) return no(F.row === 'wall' ? 'That goes on the wall.' : 'That stands on the floor.');
            if (!(c.slot >= 0 && c.slot < G.shop.width) || G.shop[c.row][c.slot]) return no('That spot is taken.');
            G.shop[c.row][c.slot] = { type: c.type };
            G.stored[c.type]--;
            G.events.push({ type: 'placed', row: c.row, slot: c.slot, what: c.type });
            return OK;
        }
        case 'pickup': {
            if (!calm(G)) return no('Not while the shop is open.');
            const x = cell(G, c.row, c.slot);
            if (!x) return no('Nothing there.');
            for (const b of shelfBooks(G, c.row, c.slot)) if (b) b.loc = null;
            G.shop[c.row][c.slot] = null;
            G.stored[x.type] = (G.stored[x.type] || 0) + 1;
            G.events.push({ type: 'pickedUp', row: c.row, slot: c.slot, what: x.type });
            return OK;
        }
        case 'move': {
            if (!calm(G)) return no('Not while the shop is open.');
            const r = G.shop[c.row];
            if (!r || !(c.from >= 0 && c.from < G.shop.width && c.to >= 0 && c.to < G.shop.width) || !r[c.from]) return no('Nothing to move.');
            [r[c.from], r[c.to]] = [r[c.to], r[c.from]];
            for (const b of G.books) if (b.loc && b.loc.row === c.row) {
                if (b.loc.slot === c.from) b.loc.slot = c.to; else if (b.loc.slot === c.to) b.loc.slot = c.from;
            }
            G.events.push({ type: 'moved', row: c.row });
            return OK;
        }
        case 'expand': {
            const i = SHOP.widths.indexOf(G.shop.width);
            if (i < 0 || i >= SHOP.expand.length) return no('The shop can\'t grow any more.');
            if (!calm(G)) return no('Not while the shop is open.');
            const cost = SHOP.expand[i];
            if (G.gold < cost) return no('Not enough gold.');
            G.gold -= cost;
            G.shop.width += 2;
            G.shop.wall.push(null, null);
            G.shop.floor.push(null, null);
            G.events.push({ type: 'expanded', width: G.shop.width });
            return OK;
        }
        case 'shelve': {
            const b = book(G, c.book);
            if (!b || b.masterwork) return no('That book stays with you.');
            if (b.loc && b.loc.adv) return no('An adventurer is carrying it.');
            if (b.loc && b.loc.held) return no('A customer has it.');
            const k = cap(G, c.row, c.slot);
            if (!k) return no('Nowhere to put it.');
            const on = shelfBooks(G, c.row, c.slot);
            let i = c.i;
            if (i == null || on[i]) { i = 0; while (i < k && on[i]) i++; }
            if (i >= k) return no('That shelf is full.');
            b.loc = { row: c.row, slot: c.slot, i };
            G.events.push({ type: 'shelved', book: b.id });
            return OK;
        }
        case 'unshelve': {
            const b = book(G, c.book);
            if (!b || !b.loc || !b.loc.row) return no('It isn\'t on a shelf.');
            b.loc = null;
            G.events.push({ type: 'unshelved', book: b.id });
            return OK;
        }
        case 'autoShelve': return autoShelve(G);

        // ---------------------------------------------------------- adventurers
        case 'hire': {
            if (!calm(G)) return no('Not now.');
            if (!heroAvailable(G, c.hero)) return no('Not available.');
            const cost = HEROES[c.hero].hire;
            if (G.gold < cost) return no('Not enough gold.');
            G.gold -= cost;
            G.heroes[c.hero].hired = true;
            G.events.push({ type: 'hired', hero: c.hero });
            return OK;
        }
        case 'equip': {
            const h = G.heroes[c.hero];
            if (!h || !h.hired || h.away) return no('They aren\'t here.');
            if (h.book) { const old = book(G, h.book); if (old) old.loc = null; h.book = null; }
            if (c.book != null) {
                const b = book(G, c.book);
                if (!b || !isFree(b) || b.masterwork) return no('You can\'t give them that one.');
                b.loc = { adv: c.hero };
                h.book = b.id;
            }
            G.events.push({ type: 'equipped', hero: c.hero, book: c.book ?? null });
            return OK;
        }
        case 'send': {
            if (!calm(G)) return no('Not while the shop is open.');
            if (!G.flags.exp) return no('No one to send yet.');
            const P = PLACES[c.place];
            if (!P || !placeOpen(G, c.place)) return no('Nobody knows the way there yet.');
            const party = [...new Set(c.heroes || [])];
            if (!party.length || party.length > 3) return no('Send one to three adventurers.');
            if (party.some((h) => !G.heroes[h]?.hired || G.heroes[h].away)) return no('Someone isn\'t free.');
            const chance = chanceOf(G, party, c.place);
            const days = Math.max(1, P.days - (partySkills(G, party).has('pathfinding') ? 1 : 0));
            const e = { id: G.nextId++, place: c.place, heroes: party, days, left: days, chance };
            G.exps.push(e);
            for (const h of party) G.heroes[h].away = e.id;
            G.events.push({ type: 'sent', exp: e.id, place: c.place, heroes: party });
            return OK;
        }

        // ---------------------------------------------------------- the trader
        case 'buy': {
            if (!G.trader || G.phase === 'open') return no('Ottoline isn\'t here.');
            const it = G.trader.stock[c.i];
            if (!it || it.sold) return no('Already sold.');
            const p = traderPrice(G, it);
            if (G.gold < p) return no('Not enough gold.');
            G.gold -= p;
            it.sold = true;
            if (it.book) { it.book.id = G.nextId++; it.book.loc = null; G.books.push(it.book); }
            else G.mats[it.mat] = (G.mats[it.mat] || 0) + it.n;
            G.events.push({ type: 'traded', item: c.i, price: p });
            return OK;
        }

        // ---------------------------------------------------------- the bindery
        case 'craft': return craft(G, c);
        case 'rebind': {
            if (!G.flags.bindery || !calm(G)) return no('Not now.');
            const b = book(G, c.book);
            if (!b || b.masterwork) return no('No book.');
            if (b.plus >= 3) return no('It can\'t be made any finer.');
            if (!(G.mats.thread > 0)) return no('Rebinding needs Silver Thread.');
            const gold = knows(G, 'gilding') ? 0 : ECON.rebindGold * (b.plus + 1);
            if (G.gold < gold) return no('Not enough gold.');
            G.gold -= gold;
            G.mats.thread--;
            b.plus++;
            for (const v of Object.keys(b.stats)) b.stats[v]++;
            b.value = bookValue(b);
            G.events.push({ type: 'rebound', book: b.id, plus: b.plus });
            return OK;
        }

        // ---------------------------------------------------------- books that talk, and reading
        case 'talk': {
            const b = book(G, c.book);
            if (!b || !b.talk) return no('It\'s just a book. A good one, but just a book.');
            const V = VOICES[b.talk];
            const line = b.masterwork ? 'Thank you, Tam. Keep the lamps lit.' : G.rng.pick(V ? V.lines : ['…']).replace('{t}', b.title);
            G.stats.talked++;
            let gift = null;
            if (knows(G, 'whispering') && !G.talkedToday.includes(b.id)) {
                gift = G.rng.pick(['paper', 'ink', 'thread', 'flower', 'leather', 'rose', 'honey', 'ember', 'moon', 'seal']);
                G.mats[gift] = (G.mats[gift] || 0) + 1;
            }
            if (!G.talkedToday.includes(b.id)) G.talkedToday.push(b.id);
            G.events.push({ type: 'talk', book: b.id, line, voice: b.talk, gift });
            return OK;
        }
        case 'read': {
            if (G.phase !== 'evening') return no('Tam reads in the evening, after closing.');
            if (G.player.readToday) return no('One book an evening. Tam needs her sleep.');
            const b = book(G, c.book);
            if (!b) return no('No book.');
            if (b.read) return no('Already read.');
            b.read = true;
            G.player.read++;
            G.player.readToday = true;
            let learned = null;
            if (b.skill && SKILLS[b.skill].who === 'player' && !knows(G, b.skill)) { G.player.skills.push(b.skill); learned = b.skill; }
            G.events.push({ type: 'read', book: b.id, learned });
            return OK;
        }

        // ---------------------------------------------------------- the day
        case 'open': {
            if (G.phase !== 'morning') return no('The shop is already open.');
            openShop(G);
            return OK;
        }
        case 'close': {
            if (G.phase !== 'open') return no('The shop isn\'t open.');
            G.clock = Math.max(G.clock, DAY.seconds);
            G.schedule.length = 0;
            for (const cu of G.customers) if (cu.state === 'in' || cu.state === 'browse' || cu.state === 'ask') leave(G, cu);
            return OK;
        }
        case 'serve': {
            const cu = G.customers.find((x) => x.id === c.cust);
            if (!cu || !cu.want || cu.state === 'out') return no('They\'ve gone.');
            const b = book(G, c.book);
            if (!b || !isFree(b) || b.masterwork) return no('You can\'t sell that one.');
            if (!matches(b, cu.want)) return no('That isn\'t what they asked for.');
            const price = Math.round(priceOf(G, b, cu.folk) * ECON.requestBonus);
            sell(G, b, price, cu.folk, 2);
            G.renown += 2;
            G.stats.requests++;
            if (G.today) G.today.requests++;
            G.events.push({ type: 'served', cust: cu.id, book: b.id, title: b.title, price, folk: cu.folk });
            cu.want = null;
            leave(G, cu, true);
            return OK;
        }
        case 'commission': {
            const cu = G.customers.find((x) => x.id === c.cust);
            if (!cu || !cu.want || cu.state === 'out') return no('They\'ve gone.');
            if (G.commissions.length >= SHOP.maxCommissions) return no('The commission board is full.');
            G.commissions.push({ id: G.nextId++, folk: cu.folk, name: cu.name, req: cu.want, reason: cu.reason, until: G.day + SHOP.commissionDays });
            G.events.push({ type: 'commissioned', cust: cu.id });
            cu.want = null;
            leave(G, cu, true);
            return OK;
        }
        case 'decline': {
            const cu = G.customers.find((x) => x.id === c.cust);
            if (!cu || cu.state === 'out') return no('They\'ve gone.');
            cu.want = null;
            leave(G, cu);
            G.events.push({ type: 'declined', cust: cu.id });
            return OK;
        }
        case 'fulfill': {
            const k = G.commissions.findIndex((x) => x.id === c.com);
            if (k < 0) return no('No such commission.');
            const com = G.commissions[k];
            const b = book(G, c.book);
            if (!b || !isFree(b) || b.masterwork) return no('You can\'t sell that one.');
            if (!matches(b, com.req)) return no('That isn\'t what they asked for.');
            const price = Math.round(priceOf(G, b, com.folk) * ECON.commissionBonus);
            sell(G, b, price, com.folk, 2);
            G.commissions.splice(k, 1);
            G.renown += 3;
            G.stats.requests++;
            G.events.push({ type: 'fulfilled', com: com.id, book: b.id, title: b.title, price, folk: com.folk, name: com.name });
            return OK;
        }
        case 'next': {
            if (G.phase !== 'evening') return no('Close the shop first.');
            nextDay(G);
            return OK;
        }
        case 'ack': {
            if (!G.story.told.includes(c.key)) G.story.told.push(c.key);
            return OK;
        }
        default: return no('Unknown command.');
    }
}

function placedCount(G, type) {
    let n = 0;
    for (const row of ['wall', 'floor']) for (const x of G.shop[row]) if (x && x.type === type) n++;
    return n;
}

/** Fill every shelf and table from the back room: each shelf takes the kind it already leans to (making
 *  sections), tables take the most valuable books. */
function autoShelve(G) {
    let moved = 0;
    const loose = () => G.books.filter((b) => !b.loc && !b.masterwork);
    const slots = [];
    for (const row of ['wall', 'floor']) for (let s = 0; s < G.shop.width; s++) if (cap(G, row, s)) slots.push({ row, s });
    // tables first, with the best books
    for (const { row, s } of slots.filter((x) => cell(G, x.row, x.s).type === 'table')) {
        const pool = loose().sort((a, c) => c.value - a.value);
        for (const b of pool) { if (run(G, { t: 'shelve', book: b.id, row, slot: s }).ok) moved++; else break; }
    }
    for (const { row, s } of slots.filter((x) => cell(G, x.row, x.s).type === 'shelf')) {
        const on = shelfBooks(G, row, s).filter(Boolean);
        const free = cap(G, row, s) - on.length;
        if (free <= 0) continue;
        const pool = loose();
        if (!pool.length) break;
        const count = {};
        for (const b of on) count[b.kind] = (count[b.kind] || 0) + 2;
        for (const b of pool) count[b.kind] = (count[b.kind] || 0) + 1;
        const lean = Object.entries(count).sort((a, c) => c[1] - a[1])[0][0];
        pool.sort((a, c) => (c.kind === lean) - (a.kind === lean) || c.value - a.value);
        for (const b of pool.slice(0, free)) if (run(G, { t: 'shelve', book: b.id, row, slot: s }).ok) moved++;
    }
    return moved ? OK : no('Nothing to shelve, or nowhere to put it.');
}

// ------------------------------------------------------------------ crafting
function craft(G, c) {
    if (!G.flags.bindery) return no('The bindery is still asleep.');
    if (!calm(G)) return no('Not while the shop is open.');
    let { kind, cover, ink } = c;
    let accents = (c.accents || []).filter(Boolean);
    const mw = !!c.masterwork;
    if (mw) {
        if (G.story.ch < 7) return no('Not yet.');
        ({ kind, cover, ink } = MASTERWORK);
        accents = MASTERWORK.accents.slice();
    } else {
        if (!canUsePattern(G, kind)) return no('You don\'t know that pattern yet.');
        if (MATERIALS[cover]?.type !== 'cover') return no('Choose a cover.');
        if (MATERIALS[ink]?.type !== 'ink') return no('Choose an ink.');
        if (accents.length > 2 || new Set(accents).size !== accents.length || accents.some((a) => MATERIALS[a]?.type !== 'accent')) return no('Up to two different accents.');
    }
    const used = [cover, ink, ...accents];
    if (!hasMats(G, used)) return no('You don\'t have all of those.');
    for (const m of used) G.mats[m]--;

    let rarity = MATERIALS[cover].tier - 1;
    const up = upChance(G);
    for (const a of accents) if ((a === 'gold' || a === 'star') && G.rng() < up) rarity++;
    rarity = mw ? 4 : Math.min(4, rarity);
    const virtue = MATERIALS[ink].virtue;
    const bonus = {};
    const add = (v, n) => { bonus[v] = (bonus[v] || 0) + n; };
    const lvBonus = Math.floor((bindingLevel(G) - 1) / 2) + (has(G, 'school2') ? 1 : 0);
    if (lvBonus) add(virtue, lvBonus);
    if (accents.includes('clasp')) add(virtue, 2);
    if (accents.includes('flower')) add('charm', 2);
    if (accents.includes('star')) add('wonder', 3);
    if (accents.includes('feather')) add('valor', 3);
    const teach = accents.includes('feather') || accents.includes('seal');
    const voice = G.rng.pick(Object.keys(VOICES));
    const b = makeBook(G.nextId++, (G.rng() * 2 ** 31) | 0, {
        kind, rarity, virtue, bonus, cover, accents, crafted: true,
        skill: teach ? undefined : (kind === 'manual' ? undefined : null),
        talk: mw ? 'elowen' : kind !== 'grimoire' ? false : accents.includes('star') ? voice : undefined,
        title: mw ? MASTERWORK.name : undefined, masterwork: mw,
    });
    if (teach && !b.skill) b.skill = G.rng.pick(kind === 'manual' ? Object.keys(SKILLS) : ['campfire', 'pathfinding', 'lockpicking', 'appraisal', 'silvertongue', 'cozykeeping']);
    if (accents.includes('thread')) for (const v of Object.keys(b.stats)) b.stats[v]++;
    if (mw) b.author = 'Elowen Inkwright & Tam';
    b.value = bookValue(b);
    G.books.push(b);
    G.player.binding += rarity >= 3 ? 2 : 1;
    G.stats.crafted++;
    if (mw) G.stats.masterwork++;
    G.events.push({ type: 'crafted', book: b.id, rarity, masterwork: mw });
    return OK;
}

// ------------------------------------------------------------------ selling and the town
function sell(G, b, price, folk, townMult = 1) {
    G.gold += price;
    G.stats.sold++;
    G.stats.earned += price;
    if (G.today) { G.today.sold++; G.today.earned += price; }
    G.ledger.unshift({ title: b.title, price, folk, day: G.day });
    if (G.ledger.length > 40) G.ledger.length = 40;
    G.books.splice(G.books.indexOf(b), 1);
    // renown is a float: ordinary sales add a third of a point, rare ones a whole point or two
    G.renown = Math.round((G.renown + (b.rarity >= 3 ? 2 : b.rarity === 2 ? 1 : 0.34)) * 100) / 100;
    for (const [v, n] of Object.entries(b.stats)) G.town[v] += n * townMult;
    G.events.push({ type: 'sold', book: b.id, title: b.title, price, folk });
    inspire(G);
}

function inspire(G) {
    for (const I of INSPIRATIONS) {
        if (G.inspired.includes(I.id) || G.town[I.virtue] < I.need) continue;
        G.inspired.push(I.id);
        G.stats.inspired++;
        if (I.id === 'guild' && !G.patterns.includes('bestiary')) G.patterns.push('bestiary');
        if (I.id === 'school' && !G.patterns.includes('atlas')) G.patterns.push('atlas');
        if (I.id === 'theatre' && !G.patterns.includes('poetry')) G.patterns.push('poetry');
        G.events.push({ type: 'inspired', id: I.id });
    }
}

// ------------------------------------------------------------------ the open shop
function openShop(G) {
    G.phase = 'open';
    G.clock = 0;
    G.customers = [];
    const n = visitorsToday(G);
    G.today = { visitors: n, sold: 0, earned: 0, requests: 0, day: G.day };
    const r = G.rng;
    const times = [];
    for (let i = 0; i < n; i++) times.push(r.range(0.02, 0.82) * DAY.seconds);
    times.sort((a, b) => a - b);
    const reqChance = G.story.ch >= 4 ? 0.42 : G.story.ch >= 2 ? 0.32 : 0.25;
    G.schedule = times.map((t, i) => {
        const pool = FOLK_IDS.filter((f) => f !== 'child' || has(G, 'school') || G.day > 6);
        const folk = r.pick(pool);
        const asks = !(G.day === 1 && i < 2) && r() < reqChance;
        return { t, folk, asks, name: r.pick(FOLK_NAMES[folk]) };
    });
    // day one always has at least one request, so the counter is met early
    if (G.day === 1 && G.schedule.length > 2 && !G.schedule.some((s) => s.asks)) G.schedule[2].asks = true;
    G.events.push({ type: 'opened', visitors: n });
}

function spawn(G, s) {
    const r = G.rng;
    const cu = {
        id: G.nextId++, folk: s.folk, name: s.name, x: DOOR, tx: DOOR, state: 'in', timer: 0,
        want: null, reason: null, target: null, tries: 1 + Math.min(2, Math.floor(cozy(G) / 8) + (placedCount(G, 'armchair') ? 1 : 0)),
        carry: null, patience: DAY.patience + (placedCount(G, 'cat') ? 10 : 0), bob: r(),
    };
    G.stats.visitors++;
    if (s.asks) {
        cu.want = makeRequest(G, s.folk, r);
        cu.reason = r.pick(REQUEST_REASONS[s.folk]);
        cu.tx = G.shop.width + 0.1 - 0.55 * G.customers.filter((x) => x.state === 'ask' || (x.want && x.state === 'in')).length;
    } else if (!pickShelf(G, cu)) {
        cu.tx = r.range(0.5, G.shop.width - 0.5);
        cu.tries = 0;
    }
    G.customers.push(cu);
    G.events.push({ type: 'enter', cust: cu.id, folk: cu.folk, asks: !!cu.want });
}

function pickShelf(G, cu) {
    const r = G.rng, F = FOLK[cu.folk];
    const opts = [];
    for (const row of ['wall', 'floor']) for (let s = 0; s < G.shop.width; s++) {
        const on = shelfBooks(G, row, s).filter(Boolean);
        if (!on.length) continue;
        const sec = section(G, row, s);
        const liked = on.filter((b) => F.kinds.includes(b.kind)).length / on.length;
        const w = appeal(G, row, s) * (1 + 2 * liked + (sec && F.kinds.includes(sec) ? 1 : 0)) * (cu.target && cu.target.row === row && cu.target.slot === s ? 0.15 : 1);
        opts.push({ row, slot: s, w });
    }
    if (!opts.length) return false;
    let x = r() * opts.reduce((a, o) => a + o.w, 0);
    let pick = opts[opts.length - 1];
    for (const o of opts) { x -= o.w; if (x <= 0) { pick = o; break; } }
    cu.target = { row: pick.row, slot: pick.slot };
    cu.tx = pick.slot + 0.5 + r.range(-0.18, 0.18);
    cu.state = 'in';
    return true;
}

function taste(folk, b) {
    const F = FOLK[folk];
    return (F.kinds.includes(b.kind) ? 1 : 0) + (F.virtues.some((v) => stat(b, v) > 0) ? 0.5 : 0) + 0.1 * b.rarity;
}

function browse(G, cu) {
    const r = G.rng;
    const { row, slot } = cu.target;
    const on = shelfBooks(G, row, slot).filter(Boolean);
    let best = null, bs = -1;
    for (const b of on) { const s = taste(cu.folk, b) + r() * 0.6; if (s > bs) { bs = s; best = b; } }
    cu.tries--;
    if (best) {
        const t = taste(cu.folk, best);
        let p = 0.22 + 0.28 * t + cozy(G) * 0.012;
        if (section(G, row, slot)) p += 0.1;
        if (cell(G, row, slot)?.type === 'table') p += 0.12;
        const near = (type) => [-1, 0, 1].some((d) => cell(G, 'floor', slot + d)?.type === type);
        if (near('armchair')) p += 0.08;
        if (near('lamp')) p += 0.04;
        if (r() < clamp(p, 0.05, 0.9)) {
            best.loc = { held: cu.id };
            cu.carry = best.id;
            cu.state = 'in';
            cu.paying = true;
            cu.tx = G.shop.width + 0.1 - 0.5 * Math.min(3, G.customers.filter((x) => x.state === 'ask').length);
            G.events.push({ type: 'picked', cust: cu.id, book: best.id });
            return;
        }
    }
    if (cu.tries > 0 && G.clock < DAY.seconds && pickShelf(G, cu)) return;
    leave(G, cu);
}

function leave(G, cu, happy = false) {
    if (cu.carry) { const b = book(G, cu.carry); if (b) b.loc = null; cu.carry = null; cu.paying = false; }
    cu.state = 'out';
    cu.tx = DOOR;
    cu.happy = happy;
}

/** Run the open shop for dt seconds. */
export function step(G, dt) {
    if (G.phase !== 'open') return;
    G.clock += dt;
    while (G.schedule.length && G.schedule[0].t <= G.clock) spawn(G, G.schedule.shift());
    for (let i = G.customers.length - 1; i >= 0; i--) {
        const cu = G.customers[i];
        if (cu.state === 'in' || cu.state === 'out') {
            const d = cu.tx - cu.x, s = DAY.walk * dt;
            cu.x = Math.abs(d) <= s ? cu.tx : cu.x + Math.sign(d) * s;
            if (cu.x !== cu.tx) continue;
            if (cu.state === 'out') {
                G.customers.splice(i, 1);
                G.events.push({ type: 'leave', cust: cu.id, happy: !!cu.happy });
            } else if (cu.paying) { cu.state = 'pay'; cu.timer = DAY.pay; }
            else if (cu.want) { cu.state = 'ask'; G.events.push({ type: 'ask', cust: cu.id }); }
            else if (cu.target) { cu.state = 'browse'; cu.timer = DAY.browse; G.events.push({ type: 'browse', cust: cu.id }); }
            else leave(G, cu);
        } else if (cu.state === 'browse') {
            cu.timer -= dt;
            if (cu.timer <= 0) browse(G, cu);
        } else if (cu.state === 'pay') {
            cu.timer -= dt;
            if (cu.timer <= 0) {
                const b = book(G, cu.carry);
                cu.carry = null; cu.paying = false;
                if (b) sell(G, b, priceOf(G, b, cu.folk), cu.folk);
                leave(G, cu, true);
                checkStory(G);
            }
        } else if (cu.state === 'ask') {
            cu.patience -= dt;
            if (cu.patience <= 0) { G.events.push({ type: 'gaveUp', cust: cu.id }); cu.want = null; leave(G, cu); }
        }
    }
    if (G.clock >= DAY.seconds && !G.schedule.length && !G.customers.length) {
        G.phase = 'evening';
        G.stats.days++;
        G.events.push({ type: 'closed', ...G.today });
    }
}

// ------------------------------------------------------------------ the night: expeditions, the trader, the morning
function nextDay(G) {
    G.day++;
    G.phase = 'morning';
    G.clock = 0;
    G.customers = [];
    G.player.readToday = false;
    G.talkedToday = [];
    // adventurers come home
    for (const e of G.exps.slice()) {
        e.left--;
        if (e.left > 0) continue;
        G.exps.splice(G.exps.indexOf(e), 1);
        resolveExpedition(G, e);
    }
    // commissions wait a while, then quietly lapse
    for (const com of G.commissions.slice()) if (com.until < G.day) {
        G.commissions.splice(G.commissions.indexOf(com), 1);
        G.events.push({ type: 'lapsed', com: com.id, name: com.name });
    }
    if (has(G, 'garden')) { G.gold += ECON.gardenGold; G.events.push({ type: 'patron', gold: ECON.gardenGold }); }
    if (has(G, 'theatre')) G.renown += 1;
    // the donation basket: the town leaves a few old books on the step every morning
    const gifts = Math.min(3, 1 + Math.floor(G.renown / 25));
    const given = [];
    for (let i = 0; i < gifts; i++) given.push(addBook(G, { rarity: G.rng() < 0.25 ? 1 : 0 }).id);
    G.events.push({ type: 'donation', books: given });
    G.trader = null;
    if (G.flags.trader && (G.day % 3 === 0 || G.day === G.flags.traderFirst)) makeTrader(G);
    G.events.push({ type: 'morning', day: G.day });
}

function resolveExpedition(G, e) {
    const r = G.rng, P = PLACES[e.place];
    const win = r() < e.chance;
    const skills = partySkills(G, e.heroes);
    const power = partyPower(G, e.heroes, e.place);
    let rolls = win ? 3 + (skills.has('lockpicking') ? 1 : 0) + (power / P.need > 1.4 ? 1 : 0) : 1 + (skills.has('lockpicking') ? 1 : 0);
    const loot = { mats: {}, books: [] };
    while (rolls-- > 0) {
        if (r() < 0.62) {
            const m = r.pick(P.mats);
            G.mats[m] = (G.mats[m] || 0) + 1;
            loot.mats[m] = (loot.mats[m] || 0) + 1;
        } else {
            const [lo, hi] = P.rarity;
            const rarity = lo + Math.floor(Math.pow(r(), 1.7) * (hi - lo + 1));
            const b = addBook(G, { kind: r.pick(P.kinds), rarity });
            loot.books.push(b.id);
        }
    }
    const xp = Math.round((win ? 1.5 : 0.6) * P.need);
    const ups = [];
    for (const h of e.heroes) {
        const H = G.heroes[h];
        H.away = null;
        H.xp += xp;
        while (H.lv < EXP.maxLevel && H.xp >= EXP.xpPerLevel * H.lv) { H.xp -= EXP.xpPerLevel * H.lv; H.lv++; ups.push(h); }
    }
    G.stats.expeditions++;
    G.events.push({ type: 'returned', exp: e.id, place: e.place, heroes: e.heroes, win, loot, xp, ups });
}

function makeTrader(G) {
    const r = G.rng;
    const stock = [];
    const n = 3 + (has(G, 'tower') ? 1 : 0);
    const rareBias = Math.min(0.6, G.renown / 80);
    for (let i = 0; i < n; i++) {
        const x = r();
        const rarity = x < 0.35 - rareBias * 0.3 ? 0 : x < 0.7 - rareBias * 0.3 ? 1 : x < 0.92 ? 2 : 3;
        stock.push({ book: makeBook(0, (r() * 2 ** 31) | 0, { kind: r.pick(KIND_IDS), rarity: has(G, 'tower') && i === n - 1 ? Math.max(2, rarity) : rarity }) });
    }
    // the story needs a talking book: Ottoline always has one until Tam owns one
    if (G.story.ch === 5 && !G.books.some((b) => b.talk)) {
        stock[0] = { book: makeBook(0, (r() * 2 ** 31) | 0, { kind: 'grimoire', rarity: 2, talk: r.pick(Object.keys(VOICES)) }) };
    }
    const pool = MATERIAL_IDS.filter((m) => m !== 'star' && m !== 'dragonhide');
    for (let i = 0; i < 4; i++) {
        const mat = r.pick(pool);
        stock.push({ mat, n: MATERIALS[mat].price > 10 ? 1 : r.int(1, 3) });
    }
    // the masterwork's inks and leaf can be bought; the star has to be fetched from the Observatory
    if (G.story.ch === 7) {
        for (const m of ['moon', 'gold']) if (!(G.mats[m] > 0)) stock.push({ mat: m, n: 1 });
    }
    if (r() < 0.3) stock.push({ mat: r.pick(['dragonhide', 'oak', 'moon']), n: 1 });
    G.trader = { stock };
    G.events.push({ type: 'trader', items: stock.length });
}

// ------------------------------------------------------------------ the story
export function counter(G, ch) {
    return G.stats[ch.counter] || 0;
}
export function chapterProgress(G) {
    const ch = CHAPTERS[G.story.ch - 1];
    if (!ch) return null;
    const total = ch.counter === 'inspired' || ch.counter === 'masterwork';
    const n = counter(G, ch) - (total ? 0 : G.story.base);
    return { ch, n: Math.max(0, Math.min(ch.target, n)), done: n >= ch.target };
}

function checkStory(G) {
    for (let guard = 0; guard < 8; guard++) {
        const p = chapterProgress(G);
        if (!p || !p.done) return;
        const n = p.ch.n;
        reward(G, n);
        G.story.ch++;
        const next = CHAPTERS[G.story.ch - 1];
        if (next) G.story.base = counter(G, next);
        G.events.push({ type: 'chapter', n });
        if (n === 7) { G.ending = true; G.events.push({ type: 'ending' }); }
    }
}

function reward(G, n) {
    const give = (m, k) => { G.mats[m] = (G.mats[m] || 0) + k; };
    if (n === 1) { G.gold += 30; G.flags.exp = true; G.heroes.rook.hired = true; }
    if (n === 2) { G.flags.bindery = true; give('paper', 2); give('leather', 1); give('ink', 1); give('honey', 1); }
    if (n === 3) { if (!G.patterns.includes('manual')) G.patterns.push('manual'); give('leather', 2); give('seal', 1); }
    if (n === 4) { G.flags.trader = true; G.flags.traderFirst = G.day + 1; G.renown += 5; }
    if (n === 5) { if (!G.patterns.includes('grimoire')) G.patterns.push('grimoire'); if (!knows(G, 'whispering')) G.player.skills.push('whispering'); }
    if (n === 6) { G.flags.observatory = true; give('moon', 1); }
}

// ================================================================== save
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (!Array.isArray(G.books) || !G.shop || !G.heroes) throw new Error('damaged save');
    return G;
}

export { RARITY, VIRTUE_IDS };
