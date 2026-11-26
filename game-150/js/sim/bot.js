// An auto-player. It plays through act() and step(), the same commands the player's taps send, so the tests, the
// balance table and the attract demo all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1 plays well: decor before luxuries, sections on the shelves, the best book for each request, expeditions it
// can win, the story's materials. Lower skill buys less, declines more and crafts whatever it has.

import {
    act, step, book, isFree, shelfBooks, cap, cell, candidates, chanceOf, placeOpen, homeHeroes, heroAvailable, hasMats,
    traderPrice, canUsePattern, cozy, unshelved,
} from './game.js';
import { FURNITURE, HEROES, HERO_IDS, PLACES, PLACE_IDS, MATERIALS, MASTERWORK, VIRTUE_IDS, SKILLS } from './data.js';
import { stat, totalPoints } from './books.js';
import { SHOP, STEP } from '../config.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    let s = (seed * 2654435761) >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { skill, rnd, log: [] };
}

const free = (G, row) => { const out = []; for (let s = 0; s < G.shop.width; s++) if (!G.shop[row][s]) out.push(s); return out; };
const count = (G, type) => ['wall', 'floor'].reduce((n, r) => n + G.shop[r].filter((x) => x && x.type === type).length, 0) + (G.stored[type] || 0);
const capacity = (G) => { let n = 0; for (const r of ['wall', 'floor']) for (let s = 0; s < G.shop.width; s++) n += cap(G, r, s); return n; };

function buyAndPlace(G, type) {
    const F = FURNITURE[type];
    const spots = free(G, F.row);
    if (!spots.length || G.gold < F.cost) return false;
    if (!act(G, { t: 'buyFurniture', type }).ok) return false;
    // decor goes beside a shelf when it can
    let best = spots[0], bw = -1;
    for (const s of spots) {
        let w = 0;
        for (const d of [-1, 0, 1]) if (cell(G, 'wall', s + d)?.type === 'shelf') w += d === 0 ? 2 : 1;
        if (type === 'shelf') w = -Math.abs(s - G.shop.width / 2);
        if (w > bw) { bw = w; best = s; }
    }
    return act(G, { t: 'place', type, row: F.row, slot: best }).ok;
}

/** Everything the bot does before opening the doors. */
export function morning(G, bot) {
    const sk = bot.skill;
    // place anything bought but not placed
    for (const [type, n] of Object.entries(G.stored)) for (let i = 0; i < n; i++) {
        const spots = free(G, FURNITURE[type].row);
        if (spots.length) act(G, { t: 'place', type, row: FURNITURE[type].row, slot: spots[0] });
    }
    // story materials first in the last chapter
    if (G.story.ch === 7 && G.trader) buyStory(G);
    if (G.story.ch === 5 && G.trader && !G.books.some((b) => b.talk)) {
        const i = G.trader.stock.findIndex((it) => it.book && it.book.talk && !it.sold);
        if (i >= 0) act(G, { t: 'buy', i });
    }
    // room for the books
    const loose = G.books.filter((b) => !b.loc && !b.masterwork).length;
    if (loose > 2 && free(G, 'wall').length && (G.gold > 35 || capacity(G) < 8)) buyAndPlace(G, 'shelf');
    if (!free(G, 'wall').length && !free(G, 'floor').length || (loose > 8 && !free(G, 'wall').length)) {
        const i = SHOP.widths.indexOf(G.shop.width);
        if (i >= 0 && i < SHOP.expand.length && G.gold > SHOP.expand[i] + 60 * sk) act(G, { t: 'expand' });
    }
    // decor, cheapest coziness first; a careless bot skips it
    if (bot.rnd() < sk) {
        for (const type of ['fern', 'lamp', 'cat', 'armchair', 'ivy', 'painting', 'table']) {
            if (G.gold < 60) break;
            if (FURNITURE[type].unique && count(G, type)) continue;
            if (count(G, type) >= 2 + Math.floor(G.shop.width / 4)) continue;
            buyAndPlace(G, type);
        }
    }
    // hire whoever is available
    for (const h of HERO_IDS) if (heroAvailable(G, h) && G.gold >= HEROES[h].hire + 30) act(G, { t: 'hire', hero: h });
    // crafting
    craftAll(G, bot);
    // the trader: rare books worth reselling, and materials for the masterwork
    if (G.trader && sk >= 0.8) {
        G.trader.stock.forEach((it, i) => {
            if (it.sold) return;
            const p = traderPrice(G, it);
            if (G.gold < p + 60) return;
            if (it.book && it.book.rarity >= 2) act(G, { t: 'buy', i });
            else if (it.mat && ['moon', 'gold', 'leather', 'oak', 'thread', 'dragonhide', 'star'].includes(it.mat)) act(G, { t: 'buy', i });
        });
    }
    // fulfil commissions from stock
    for (const com of G.commissions.slice()) {
        const c = candidates(G, com.req)[0];
        if (c) act(G, { t: 'fulfill', com: com.id, book: c.id });
    }
    // expeditions
    expeditions(G, bot);
    // talk to talking books
    for (const b of G.books.filter((x) => x.talk)) act(G, { t: 'talk', book: b.id });
    act(G, { t: 'autoShelve' });
}

function buyStory(G) {
    G.trader.stock.forEach((it, i) => {
        if (!it.sold && it.mat && ['dragonhide', 'star', 'moon', 'gold'].includes(it.mat) && !(G.mats[it.mat] > 0)) act(G, { t: 'buy', i });
    });
}

function craftAll(G, bot) {
    if (!G.flags.bindery) return;
    if (G.story.ch === 7 && hasMats(G, [MASTERWORK.cover, MASTERWORK.ink, ...MASTERWORK.accents])) {
        act(G, { t: 'craft', masterwork: true });
        return;
    }
    const keep = G.story.ch >= 6 ? new Set(['dragonhide', 'star', 'moon', 'gold']) : new Set();
    for (let guard = 0; guard < 4; guard++) {
        const covers = ['dragonhide', 'oak', 'leather', 'paper'].filter((m) => G.mats[m] > (keep.has(m) ? 1 : 0));
        const inks = ['moon', 'ember', 'rose', 'honey', 'ink'].filter((m) => G.mats[m] > (keep.has(m) ? 1 : 0));
        if (!covers.length || !inks.length) return;
        const ink = bot.skill >= 0.8 ? inks[0] : inks[inks.length - 1];
        const kinds = G.patterns.filter((k) => canUsePattern(G, k));
        // a pattern whose virtues include the ink's, or a manual when there's a seal
        const v = MATERIALS[ink].virtue;
        const kind = (G.mats.seal > 0 && kinds.includes('manual')) ? 'manual' : (kinds.find((k) => k !== 'manual' && ['cookbook', 'novel', 'poetry', 'bestiary', 'atlas', 'almanac', 'grimoire'].includes(k) && kindFits(k, v)) || kinds[0]);
        const accents = ['gold', 'clasp', 'thread', 'feather', 'seal', 'flower'].filter((a) => G.mats[a] > (keep.has(a) ? 1 : 0)).slice(0, bot.skill >= 0.8 ? 2 : 1);
        if (!act(G, { t: 'craft', kind, cover: covers[0], ink, accents }).ok) return;
    }
}
const KV = { cookbook: ['hearth', 'charm'], novel: ['valor', 'charm', 'wonder'], poetry: ['charm', 'wonder'], bestiary: ['valor', 'wit'], atlas: ['wonder', 'wit'], almanac: ['hearth', 'wit'], grimoire: ['wonder', 'wit'], manual: ['wit'] };
const kindFits = (k, v) => KV[k].includes(v);

function expeditions(G, bot) {
    if (!G.flags.exp) return;
    let home = homeHeroes(G);
    if (!home.length) return;
    // the story's places first in the last chapters
    const want = G.story.ch === 7
        ? (!(G.mats.star > 0) ? 'observatory' : !(G.mats.dragonhide > 0) ? 'attic' : null)
        : null;
    const open = PLACE_IDS.filter((p) => placeOpen(G, p));
    const order = want && open.includes(want) ? [want, ...open.filter((p) => p !== want).reverse()] : open.slice().reverse();
    for (const place of order) {
        if (!home.length) break;
        // give each hero the free book that helps most here
        for (const h of home) equipBest(G, h, place);
        // the smallest party that is likely to win
        const ranked = home.slice().sort((a, b) => heroScore(G, b, place) - heroScore(G, a, place));
        let party = [];
        for (const h of ranked) {
            party.push(h);
            if (chanceOf(G, party, place) >= (bot.skill >= 0.8 ? 0.8 : 0.6) || party.length === 3) break;
        }
        const ch = chanceOf(G, party, place);
        if (ch < (place === want ? 0.5 : 0.7) && place !== 'woods') continue;
        if (act(G, { t: 'send', heroes: party, place }).ok) home = home.filter((h) => !party.includes(h));
    }
}
function heroScore(G, h, place) { return chanceOf(G, [h], place); }
function equipBest(G, h, place) {
    const P = PLACES[place];
    const cur = G.heroes[h].book && book(G, G.heroes[h].book);
    const score = (b) => (b ? stat(b, P.virtues[0]) + 0.5 * stat(b, P.virtues[1]) + (b.skill && SKILLS[b.skill].who === 'adv' ? 2 : 0) : 0);
    let best = cur, bs = score(cur);
    for (const b of G.books) {
        if (!isFree(b) || b.masterwork || b.talk) continue;
        const s = score(b) - b.value / 200;
        if (s > bs + 0.5) { bs = s; best = b; }
    }
    if (best && best !== cur) act(G, { t: 'equip', hero: h, book: best.id });
}

/** Answer whoever is waiting at the counter. */
export function serve(G, bot) {
    for (const cu of G.customers) {
        if (cu.state !== 'ask' || !cu.want) continue;
        const c = candidates(G, cu.want).filter((b) => !(b.loc && b.loc.adv));
        if (c.length && bot.rnd() < 0.5 + bot.skill / 2) act(G, { t: 'serve', cust: cu.id, book: c[0].id });
        else if (G.commissions.length < SHOP.maxCommissions && bot.rnd() < bot.skill) act(G, { t: 'commission', cust: cu.id });
        else act(G, { t: 'decline', cust: cu.id });
    }
}

export function evening(G, bot) {
    // read: a skill Tam can learn first, then anything unread
    const unread = G.books.filter((b) => !b.read && !b.masterwork);
    const learn = unread.find((b) => b.skill && SKILLS[b.skill].who === 'player' && !G.player.skills.includes(b.skill));
    const pick = learn || unread.sort((a, b) => totalPoints(b) - totalPoints(a))[0];
    if (pick) act(G, { t: 'read', book: pick.id });
    // rebind the best adventurer book now and then
    if (G.flags.bindery && G.mats.thread > 0 && G.gold > 100) {
        const b = G.books.filter((x) => x.loc && x.loc.adv && x.plus < 3)[0];
        if (b) act(G, { t: 'rebind', book: b.id });
    }
}

/** One whole day: morning, the open shop to closing, the evening and the night. */
export function playDay(G, bot, { dt = STEP * 6, onStep = null } = {}) {
    morning(G, bot);
    act(G, { t: 'open' });
    let guard = 0;
    while (G.phase === 'open' && guard++ < 100000) {
        step(G, dt);
        serve(G, bot);
        if (onStep) onStep(G);
    }
    evening(G, bot);
    act(G, { t: 'next' });
}

export { VIRTUE_IDS, cozy, unshelved, shelfBooks };
