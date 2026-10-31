// The campaign: three books (acts), each a branching map of nodes ending in a boss. Pure.
//
// Everything the player does is a command through act(G, cmd), which validates, resolves at once and
// pushes events. step(G, { hold }, dt) only paces the foes' moves while the view animates. The UI,
// the bot and the tests all go through act(), so the whole game can be played in Node.
//
// G.screen says what is in front of the player:
//   map · battle · reward · boon · bossrelic · dwelling · shop · camp · event · treasure · victory · defeat
// and G.pick, when set, is a "choose a card from your deck" prompt over the current screen.

import { START, MAP, ACTS, ARMY_MAX, XP, GOLD, SHOP, COMBAT, AI_DELAY } from '../config.js';
import { CREATURES, FOES, CARDS, RELICS, BOONS, ACT_INFO, BOSS_ESCORT, EVENTS, RARITY_W } from './data.js';
import { makeRng } from '../rng.js';
import * as BT from './battle.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------ a new run
export function newGame(seed = 1) {
    const G = {
        v: 1, seed, rng: makeRng(seed),
        act: 0, gold: START.gold,
        hero: { ...START.hero, lvl: 1, xp: 0, draw: 0, ink: 0, pending: 0 },
        army: [], deck: [], nextUid: 1, relics: [],
        map: null, screen: 'map', battle: null, node: null,
        reward: null, boon: null, bossrelic: null, offer: null, shop: null, camp: null, event: null, treasure: null,
        pick: null, removeCost: SHOP.remove, seenEvents: [],
        stats: { battles: 0, elites: 0, bosses: 0, slain: 0, lost: 0, recruited: 0, gold: 0, floors: 0, cards: 0 },
        over: null, events: [],
    };
    for (const id of START.deck) addCard(G, id);
    for (const [key, n] of START.army) addToArmy(G, key, n);
    G.map = genMap(G.rng, 0);
    return G;
}

function addCard(G, id, up = false) {
    const c = { uid: G.nextUid++, id, up };
    G.deck.push(c);
    return c;
}

export const armyMax = (G) => ARMY_MAX + (G.relics.includes('warhorn') ? 1 : 0);

/** Add creatures to the legion: a new stack (and its signature card) or reinforcements for one. */
function addToArmy(G, key, n) {
    let s = G.army.find((a) => a.key === key);
    if (!s) {
        s = { key, count: 0, full: 0 };
        G.army.push(s);
        addCard(G, CREATURES[key].sig);
    }
    s.count += n; s.full += n;
    return s;
}

function removeFromArmy(G, i) {
    const s = G.army[i];
    if (!s) return;
    G.army.splice(i, 1);
    const sig = CREATURES[s.key].sig;
    G.deck = G.deck.filter((c) => c.id !== sig);
}

/** The General's effective stats, with relics. */
export function heroStats(G) {
    const h = G.hero;
    let atk = h.atk, def = h.def, lore = h.lore;
    if (G.relics.includes('whetstone')) atk += 2;
    if (G.relics.includes('crest')) def += 2;
    if (G.relics.includes('lantern')) lore += 1;
    if (G.relics.includes('warhorn')) { atk += 1; def += 1; }
    return { atk, def, lore, draw: h.draw, ink: h.ink };
}

export const xpNeed = (G) => XP.base + XP.step * (G.hero.lvl - 1);

// ------------------------------------------------------------------ the map
/**
 * A Spire-style map: MAP.paths walks up MAP.floors floors over MAP.lanes columns, stepping at most one
 * column sideways each floor and never crossing an earlier edge. Floor 0 is a skirmish, the middle
 * floor a hoard, the last a campfire, and the boss waits above it all.
 */
export function genMap(rng, act) {
    const F = MAP.floors, L = MAP.lanes;
    const id = (f, c) => `${f}-${c}`;
    const nodes = new Map();
    const edges = new Set();
    const node = (f, c) => {
        if (!nodes.has(id(f, c))) nodes.set(id(f, c), { id: id(f, c), f, col: c, type: null, next: [], jx: rng.range(-0.22, 0.22), jy: rng.range(-0.18, 0.18) });
        return nodes.get(id(f, c));
    };
    const starts = [];
    for (let p = 0; p < MAP.paths; p++) {
        let c = rng.int(0, L - 1);
        if (p === 1) { let t = 0; while (c === starts[0] && t++ < 10) c = rng.int(0, L - 1); }
        starts.push(c);
        node(0, c);
        for (let f = 0; f < F - 1; f++) {
            const opts = [c - 1, c, c + 1].filter((x) => x >= 0 && x < L);
            for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
            let nc = opts.find((x) => x === c || !edges.has(`${f}:${x}>${c}`)) ?? c;
            edges.add(`${f}:${c}>${nc}`);
            const a = node(f, c), b = node(f + 1, nc);
            if (!a.next.includes(b.id)) a.next.push(b.id);
            c = nc;
        }
    }
    const list = [...nodes.values()].sort((a, b) => a.f - b.f || a.col - b.col);
    const parents = (n) => list.filter((p) => p.next.includes(n.id));
    const W = [['battle', 40], ['event', 20], ['dwelling', 19], ['elite', 9], ['shop', 7], ['camp', 6]];
    for (const n of list) {
        if (n.f === 0) { n.type = 'battle'; continue; }
        if (n.f === F - 1) { n.type = 'camp'; continue; }
        if (n.f === 4) { n.type = 'treasure'; continue; }
        const banned = new Set();
        if (n.f < 2) banned.add('elite');
        if (n.f < 2 || n.f >= F - 2) banned.add('camp');
        for (const p of parents(n)) if (['elite', 'camp', 'shop', 'dwelling'].includes(p.type)) banned.add(p.type);
        const opts = W.filter(([t]) => !banned.has(t));
        let tot = 0; for (const [, w] of opts) tot += w;
        let r = rng() * tot;
        n.type = opts[0][0];
        for (const [t, w] of opts) { r -= w; if (r <= 0) { n.type = t; break; } }
    }
    // an early dwelling on every map, so the legion can grow before the first lair
    if (!list.some((n) => n.type === 'dwelling' && n.f >= 1 && n.f <= 3)) {
        const cand = list.filter((n) => (n.f === 2 || n.f === 3) && n.type === 'battle');
        const pick = cand[0] || list.find((n) => n.f === 2);
        if (pick) pick.type = 'dwelling';
    }
    // and a late one, to spend the book's gold before its boss
    if (!list.some((n) => n.type === 'dwelling' && n.f >= 5 && n.f <= 6)) {
        const pick = list.find((n) => (n.f === 5 || n.f === 6) && n.type === 'battle') || list.find((n) => n.f === 6 && n.type === 'event');
        if (pick) pick.type = 'dwelling';
    }
    const boss = { id: 'boss', f: F, col: (L - 1) / 2, type: 'boss', next: [], jx: 0, jy: 0 };
    for (const n of list) if (n.f === F - 1) n.next.push('boss');
    list.push(boss);
    return { act, nodes: list, cur: null, visited: [] };
}

export const nodeById = (G, id) => G.map.nodes.find((n) => n.id === id) || null;
export function nextNodes(G) {
    const cur = G.map.cur ? nodeById(G, G.map.cur) : null;
    return cur ? cur.next.map((i) => nodeById(G, i)) : G.map.nodes.filter((n) => n.f === 0);
}

// ------------------------------------------------------------------ battles
function scaleGroups(groups, f, act) {
    return groups.map(([k, n]) => [k, Math.max(1, Math.round(n * (1 + 0.07 * f) * (1 + 0.05 * act)))]);
}

function startBattle(G, kind, groups, extra = {}) {
    const army = G.army.map((a) => ({ key: a.key, count: a.count }));
    const B = BT.makeBattle({
        seed: (G.rng() * 2 ** 31) | 0, army, groups, relics: G.relics, hero: heroStats(G),
        kind, act: G.act, deck: G.deck, boss: extra.boss || null,
    });
    G.battle = B;
    G.screen = 'battle';
    G.events.push({ type: 'battle', kind });
    return B;
}

function encounter(G, n) {
    const info = ACT_INFO[G.act];
    if (n.type === 'boss') {
        const k = info.boss;
        return startBattle(G, 'boss', [[k, 1], ...scaleGroups(BOSS_ESCORT[k], 4, G.act)], { boss: k });
    }
    const list = n.type === 'elite' ? info.elite : info.skirm;
    // the first fights of the first book come from the gentler half of the table
    const pool = G.act === 0 && n.f <= 1 && n.type === 'battle' ? list.slice(0, 3) : list;
    return startBattle(G, n.type, scaleGroups(G.rng.pick(pool), n.f, G.act));
}

function finishBattle(G) {
    const B = G.battle;
    const won = B.over === 'won';
    const surv = BT.survivors(B);
    let lost = 0;
    const gone = [];
    G.army.forEach((a, i) => {
        const left = surv[i] ?? 0;
        const dead = a.count - left;
        lost += dead;
        if (left <= 0) { gone.push(i); return; }
        const back = won ? Math.floor(dead * (G.relics.includes('surgeon') ? 0.5 : COMBAT.recover)) : 0;
        a.recovered = back;
        a.count = Math.min(a.full, left + back);
    });
    G.stats.lost += lost;
    for (const i of gone.reverse()) removeFromArmy(G, i);
    G.stats.slain += B.slain || 0;
    G.battle = null;
    if (!won || !G.army.length) {
        G.over = 'lost';
        G.screen = 'defeat';
        G.events.push({ type: 'defeat' });
        return;
    }
    G.stats.battles++;
    const kind = B.kind;
    if (kind === 'elite') G.stats.elites++;
    if (kind === 'boss') G.stats.bosses++;
    const [lo, hi] = GOLD[kind === 'boss' ? 'boss' : kind === 'elite' || kind === 'rob' ? 'elite' : 'skirmish'];
    let gold = Math.round(G.rng.int(lo, hi) * Math.pow(GOLD.act, G.act) * (G.relics.includes('purse') ? 1.25 : 1));
    G.gold += gold;
    G.stats.gold += gold;
    const xp = kind === 'boss' ? 120 : kind === 'elite' ? 75 : 45;
    G.hero.xp += xp;
    while (G.hero.xp >= xpNeed(G)) { G.hero.xp -= xpNeed(G); G.hero.lvl++; G.hero.pending++; }
    const cards = cardChoices(G, kind === 'elite' || kind === 'boss' ? 1.5 : 1);
    const relic = kind === 'elite' || kind === 'rob' ? randomRelic(G) : null;
    G.reward = { gold, xp, cards, relic, relicTaken: false, cardTaken: false, kind, lost, recovered: G.army.reduce((n, a) => n + (a.recovered || 0), 0) };
    for (const a of G.army) delete a.recovered;
    G.screen = 'reward';
    G.events.push({ type: 'victory', kind });
}

function rollRarity(G, luck = 1) {
    const r = G.rng() * 100;
    const rare = RARITY_W.rare * luck, unc = RARITY_W.uncommon * luck;
    return r < rare ? 'rare' : r < rare + unc ? 'uncommon' : 'common';
}

function cardChoices(G, luck = 1, n = 3) {
    const out = [];
    for (let i = 0, t = 0; out.length < n && t < 60; t++) {
        const rar = rollRarity(G, luck);
        const pool = Object.keys(CARDS).filter((k) => CARDS[k].rarity === rar && !out.includes(k));
        if (pool.length) out.push(G.rng.pick(pool));
    }
    return out;
}

function randomRelic(G, rarities = ['common', 'uncommon', 'rare']) {
    const pool = Object.keys(RELICS).filter((k) => rarities.includes(RELICS[k].rarity) && !G.relics.includes(k));
    if (!pool.length) return null;
    // commons are commoner
    const w = (k) => ({ common: 5, uncommon: 3, rare: 1 })[RELICS[k].rarity] || 1;
    let tot = 0; for (const k of pool) tot += w(k);
    let r = G.rng() * tot;
    for (const k of pool) { r -= w(k); if (r <= 0) return k; }
    return pool[0];
}

function gainRelic(G, k) {
    if (!k || G.relics.includes(k)) return;
    G.relics.push(k);
    G.events.push({ type: 'relic', id: k });
}

// ------------------------------------------------------------------ places
function tierCap(G) { return ACT_INFO[G.act].tiers; }
const STOCK = { 1: 20, 2: 10, 3: 6, 4: 4, 5: 2, 6: 2, 7: 1 };

export function priceOf(G, key) {
    let p = CREATURES[key].cost;
    if (G.relics.includes('mapcase')) p *= 0.85;
    if (G.relics.includes('crown')) p *= 1.4;
    return Math.max(1, Math.round(p));
}

function makeDwelling(G) {
    const cap = tierCap(G);
    const keys = Object.keys(CREATURES).filter((k) => CREATURES[k].tier <= cap);
    const picks = [];
    // one creature you already field, if any can be bought here, so stacks can be refilled
    const owned = G.army.map((a) => a.key).filter((k) => CREATURES[k].tier <= cap);
    if (owned.length) picks.push(G.rng.pick(owned));
    // and the rest weighted toward the higher tiers this book allows
    for (let t = 0; picks.length < 3 && t < 40; t++) {
        const k = G.rng.pick(keys);
        const tier = CREATURES[k].tier;
        if (picks.includes(k)) continue;
        if (G.rng() > 0.35 + tier / (cap + 1) * 0.6) continue;
        picks.push(k);
    }
    return { stock: picks.map((k) => ({ key: k, n: Math.max(1, Math.round(STOCK[CREATURES[k].tier] * (1 + G.act * 0.6) * G.rng.range(0.8, 1.25))) })) };
}

function makeShop(G) {
    const cards = [];
    const want = ['common', 'common', 'uncommon', 'uncommon', 'rare'];
    for (const rar of want) {
        const pool = Object.keys(CARDS).filter((k) => CARDS[k].rarity === rar && !cards.some((c) => c.id === k));
        const id = G.rng.pick(pool);
        const base = { common: 45, uncommon: 70, rare: 130 }[rar];
        cards.push({ id, price: Math.round(base * G.rng.range(0.9, 1.1) * (1 + G.act * 0.25)), sold: false });
    }
    const relics = [];
    for (let i = 0; i < 2; i++) {
        const k = randomRelic({ ...G, relics: [...G.relics, ...relics.map((r) => r.id)] });
        if (k) relics.push({ id: k, price: Math.round({ common: 140, uncommon: 190, rare: 260 }[RELICS[k].rarity] * G.rng.range(0.9, 1.1)), sold: false });
    }
    return { cards, relics, removed: false };
}

function enterNode(G, n) {
    G.node = n.id;
    G.map.cur = n.id;
    G.map.visited.push(n.id);
    G.stats.floors++;
    G.events.push({ type: 'enter', node: n.id, kind: n.type });
    switch (n.type) {
        case 'battle': case 'elite': case 'boss': encounter(G, n); break;
        case 'dwelling': G.offer = makeDwelling(G); G.screen = 'dwelling'; break;
        case 'shop': G.shop = makeShop(G); G.screen = 'shop'; break;
        case 'camp': G.camp = { done: false }; G.screen = 'camp'; break;
        case 'treasure': {
            const relic = randomRelic(G, ['common', 'uncommon']);
            const gold = Math.round(G.rng.int(40, 70) * Math.pow(GOLD.act, G.act));
            gainRelic(G, relic);
            G.gold += gold;
            G.treasure = { relic, gold };
            G.screen = 'treasure';
            break;
        }
        case 'event': {
            const pool = Object.keys(EVENTS).filter((k) => EVENTS[k].acts.includes(G.act) && !G.seenEvents.includes(k));
            const id = pool.length ? G.rng.pick(pool) : 'armory';
            G.seenEvents.push(id);
            G.event = { id, result: null };
            G.screen = 'event';
            break;
        }
        default: G.screen = 'map';
    }
}

function backToMap(G) {
    G.offer = G.shop = G.camp = G.event = G.treasure = G.reward = null;
    if (G.hero.pending > 0) { openBoon(G); return; }
    if (G.node === 'boss' && G.act < ACTS) { openBossRelic(G); return; }
    G.screen = 'map';
}

function openBoon(G) {
    const keys = Object.keys(BOONS).filter((k) => !((k === 'ink' || k === 'draw') && G.hero[k] >= 2));
    const opts = [];
    while (opts.length < 3 && keys.length) opts.push(keys.splice(Math.floor(G.rng() * keys.length), 1)[0]);
    G.boon = { opts };
    G.screen = 'boon';
}

function openBossRelic(G) {
    if (G.act >= ACTS - 1) { win(G); return; }
    const pool = Object.keys(RELICS).filter((k) => RELICS[k].rarity === 'boss' && !G.relics.includes(k));
    const opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(G.rng() * pool.length), 1)[0]);
    if (!opts.length) { nextAct(G); return; }
    G.bossrelic = { opts };
    G.screen = 'bossrelic';
}

function nextAct(G) {
    G.bossrelic = null;
    G.act++;
    for (const a of G.army) a.count = a.full;
    G.map = genMap(G.rng, G.act);
    G.node = null;
    G.screen = 'map';
    G.events.push({ type: 'act', act: G.act });
}

function win(G) {
    G.over = 'won';
    G.screen = 'victory';
    G.events.push({ type: 'triumph' });
}

export function score(G) {
    const s = G.stats;
    return s.floors * 10 + s.battles * 25 + s.elites * 50 + s.bosses * 250 + Math.round(G.gold / 4) + (G.over === 'won' ? 1000 : 0);
}

// ------------------------------------------------------------------ events
function applyEvent(G, opt) {
    const ev = G.event;
    const id = ev.id;
    const say = (t) => { ev.result = t; };
    const biggest = () => G.army.reduce((b, a, i) => (a.count * CREATURES[a.key].hp > (b ? G.army[b.i].count * CREATURES[G.army[b.i].key].hp : -1) ? { i } : b), null);
    const loseFrac = (a, f) => { a.count = Math.max(1, Math.round(a.count * (1 - f))); };
    switch (`${id}:${opt.id}`) {
        case 'well:wish':
            if (G.rng() < 0.5) { const r = randomRelic(G); gainRelic(G, r); say(r ? `The well hums a low note. Something bright rises in the bucket: ${RELICS[r].name}.` : 'The well hums, pleased, and gives you nothing.'); }
            else say('The coins splash. Nothing happens. Somewhere, a frog laughs.');
            break;
        case 'sage:learn': {
            const cand = G.deck.filter((c) => !c.up && CARDS[c.id].up && CARDS[c.id].kind !== 'curse');
            const got = [];
            for (let i = 0; i < 2 && cand.length; i++) { const c = cand.splice(Math.floor(G.rng() * cand.length), 1)[0]; c.up = true; got.push(CARDS[c.id].name); }
            say(got.length ? `She annotates your orders in a spidery hand. Inscribed: ${got.join(' and ')}.` : 'She reads your deck and hands it back. "Nothing to add."');
            break;
        }
        case 'sage:rare': {
            const pool = Object.keys(CARDS).filter((k) => CARDS[k].rarity === 'rare');
            const k = G.rng.pick(pool);
            addCard(G, k);
            const b = biggest();
            if (b) loseFrac(G.army[b.i], 0.15);
            say(`She whispers ${CARDS[k].name} into your ear. On the way out, some of your soldiers do not follow.`);
            break;
        }
        case 'peddler:buy': { const r = randomRelic(G); gainRelic(G, r); say(r ? `"Pleasure doing business!" It is ${RELICS[r].name}. It seems fine.` : '"Sold out! Ha!" He keeps the gold.'); break; }
        case 'peddler:rob':
            ev.fight = true;
            say('The goblin whistles. His cousins come out of the ditch.');
            break;
        case 'shrine:pray': G.hero.lore += 1; addCard(G, 'doubt'); say('The idol does not move. You know more than you did. You are less sure of it.'); break;
        case 'shrine:loot': { G.gold += 140; const b = biggest(); if (b) loseFrac(G.army[b.i], 0.2); say('You fill a sack with silver. By morning a fifth of your strongest company has walked away into the fog.'); break; }
        case 'knight:help': {
            if (G.army.length < armyMax(G) || G.army.some((a) => a.key === 'knights')) { addToArmy(G, 'knights', 2 + G.act); G.stats.recruited += 2 + G.act; say('Two scattered knights ride in at dawn, and the knight himself with them. Knights Errant join the legion.'); }
            else { G.gold += 60; say('He has no place in your full legion, so he presses 60 gold on you instead.'); }
            break;
        }
        case 'knight:rob': G.gold += 100; addCard(G, 'guilt'); say('He does not resist. That is the worst part.'); break;
        case 'ring:dance':
            if (G.rng() < 0.55) { for (const a of G.army) a.count = a.full; say('The legion dances until dawn and wakes refreshed: every stack is at full strength.'); }
            else { for (const a of G.army) loseFrac(a, 0.1); say('The music speeds up. Some of your soldiers dance away into the trees and are not seen again.'); }
            break;
        case 'ring:eat': {
            const cand = G.deck.filter((c) => !c.up && CARDS[c.id].up && CARDS[c.id].kind !== 'curse');
            if (cand.length) { const c = G.rng.pick(cand); c.up = true; say(`Colours. Revelations. ${CARDS[c.id].name} makes sense now. Your stomach does not.`); } else say('Colours. Nothing else.');
            addCard(G, 'wound');
            break;
        }
        case 'armory:atk': G.hero.atk += 1; say('Good steel, still sharp. +1 Attack.'); break;
        case 'armory:def': G.hero.def += 1; say('Heavy oak shields with iron bosses. +1 Defence.'); break;
        case 'riddle:right': { const r = randomRelic(G, ['uncommon', 'rare']); gainRelic(G, r); say(r ? `"Correct." The mouth opens. Inside: ${RELICS[r].name}.` : '"Correct." The mouth opens. It is empty. "Inflation," says the dragon.'); break; }
        case 'riddle:wrong': { const b = biggest(); if (b) loseFrac(G.army[b.i], 0.15); say('"Wrong." The brass head breathes a short, polite gout of flame.'); break; }
        case 'mercs:hire': {
            const cap = Math.min(7, tierCap(G));
            const keys = Object.keys(CREATURES).filter((k) => CREATURES[k].tier <= cap && CREATURES[k].tier >= Math.max(1, cap - 2) && (G.army.length < armyMax(G) || G.army.some((a) => a.key === k)));
            if (!keys.length) { G.gold += 150; say('The captain looks at your crowded camp and shakes his head. He gives the gold back.'); break; }
            const k = G.rng.pick(keys);
            const n = Math.max(1, Math.round(150 / CREATURES[k].cost * 1.5));
            addToArmy(G, k, n); G.stats.recruited += n;
            say(`${n} ${CREATURES[k].name} sign on for the season.`);
            break;
        }
        case 'mercs:dice':
            if (G.rng() < 0.45) { G.gold += 150; say('Snake eyes for them, sixes for you. You walk off 100 gold up.'); }
            else say('Their dice roll a little too well. You are 50 gold lighter.');
            break;
        case 'tome:read': {
            const cand = G.deck.filter((c) => CARDS[c.id].rarity !== 'sig');
            const names = [];
            for (let i = 0; i < 2 && cand.length; i++) {
                const c = cand.splice(Math.floor(G.rng() * cand.length), 1)[0];
                const pool = Object.keys(CARDS).filter((k) => ['common', 'uncommon', 'rare'].includes(CARDS[k].rarity));
                const was = CARDS[c.id].name;
                c.id = G.rng.pick(pool); c.up = false;
                names.push(`${was} became ${CARDS[c.id].name}`);
            }
            say(`The ink on your orders crawls. ${names.join('; ')}.`);
            break;
        }
        case 'tome:burn': G.pick = { why: 'remove', free: true }; say('The tome burns green. Choose a card to erase.'); break;
        case 'field:scav': G.gold += 70; addCard(G, 'wound'); say('70 gold in old coin, and a rusty nail through someone\'s boot.'); break;
        case 'field:bury': G.pick = { why: 'remove', free: true }; say('You bury them properly. Choose a card to erase.'); break;
        case 'crossroads:dupe': G.pick = { why: 'dupe', free: true }; say('The fox licks a quill. Choose a card to copy.'); break;
        case 'crossroads:relic': { for (const a of G.army) loseFrac(a, 0.1); const r = randomRelic(G); gainRelic(G, r); say(r ? `A tenth of the legion follows the fox down a road that isn't there. It leaves ${RELICS[r].name}.` : 'The fox takes his tithe and leaves nothing. Foxes.'); break; }
        default: say('You go on your way.'); break;
    }
}

// ------------------------------------------------------------------ commands
const OK = { ok: true };
const no = (err) => ({ ok: false, err });

/** Every player action. Returns { ok, err }. */
export function act(G, cmd) {
    const r = actInner(G, cmd);
    if (G.battle) G.events.push(...G.battle.events.splice(0));
    return r;
}

function actInner(G, cmd) {
    if (G.over && cmd.t !== 'noop') return no('the run is over');
    if (G.pick && cmd.t !== 'pickDeck') return no('choose a card first');
    switch (cmd.t) {
        case 'go': {
            if (G.screen !== 'map') return no('not on the map');
            const n = nextNodes(G).find((x) => x.id === cmd.id);
            if (!n) return no('not reachable');
            enterNode(G, n);
            return OK;
        }
        // --- battle
        case 'place': {
            if (G.screen !== 'battle') return no('no battle');
            return BT.place(G.battle, cmd.id, cmd.at[0], cmd.at[1]);
        }
        case 'begin': if (G.screen !== 'battle') return no('no battle'); return BT.begin(G.battle);
        case 'play': {
            if (G.screen !== 'battle') return no('no battle');
            const r = BT.playCard(G.battle, cmd);
            if (r.ok) G.stats.cards++;
            return r;
        }
        case 'move': {
            if (G.screen !== 'battle') return no('no battle');
            return BT.moveStack(G.battle, cmd.id, cmd.at);
        }
        case 'end': {
            if (G.screen !== 'battle') return no('no battle');
            const r = BT.endTurn(G.battle);
            return r;
        }
        case 'finish': {
            // leave a decided battle (after the view has shown the last blow)
            if (G.screen !== 'battle' || !G.battle?.over) return no('the battle is not over');
            G.events.push(...G.battle.events.splice(0));
            finishBattle(G);
            if (G.screen === 'reward' && G.reward && G.event?.fight) G.event = null;
            return OK;
        }
        // --- rewards
        case 'pickCard': {
            if (G.screen !== 'reward' || G.reward.cardTaken) return no('nothing to take');
            if (cmd.i >= 0) { const id = G.reward.cards[cmd.i]; if (!id) return no('no such card'); addCard(G, id); G.events.push({ type: 'gaincard', id }); }
            G.reward.cardTaken = true;
            return OK;
        }
        case 'takeRelic': {
            if (G.screen !== 'reward' || !G.reward.relic || G.reward.relicTaken) return no('no relic');
            gainRelic(G, G.reward.relic);
            G.reward.relicTaken = true;
            return OK;
        }
        case 'boon': {
            if (G.screen !== 'boon') return no('no boon');
            const k = G.boon.opts[cmd.i];
            if (!k) return no('no such boon');
            applyBoon(G, k);
            G.hero.pending--;
            G.boon = null;
            backToMap(G);
            return OK;
        }
        case 'pickRelic': {
            if (G.screen !== 'bossrelic') return no('no relic to pick');
            const k = G.bossrelic.opts[cmd.i];
            if (cmd.i >= 0 && !k) return no('no such relic');
            if (k) gainRelic(G, k);
            nextAct(G);
            return OK;
        }
        // --- dwellings
        case 'recruit': {
            if (G.screen !== 'dwelling') return no('no dwelling');
            const s = G.offer.stock.find((x) => x.key === cmd.key);
            const n = Math.floor(cmd.n);
            if (!s || n <= 0 || n > s.n) return no('not that many');
            if (!G.army.some((a) => a.key === cmd.key) && G.army.length >= armyMax(G)) return no('the legion is full');
            const cost = n * priceOf(G, cmd.key);
            if (cost > G.gold) return no('not enough gold');
            G.gold -= cost; s.n -= n;
            addToArmy(G, cmd.key, n);
            G.stats.recruited += n;
            G.events.push({ type: 'recruit', key: cmd.key, n });
            return OK;
        }
        case 'dismiss': {
            if (!['dwelling', 'camp', 'map'].includes(G.screen)) return no('not here');
            if (G.army.length <= 1 || !G.army[cmd.i]) return no('cannot dismiss');
            removeFromArmy(G, cmd.i);
            return OK;
        }
        // --- the scriptorium
        case 'buyCard': {
            if (G.screen !== 'shop') return no('no shop');
            const c = G.shop.cards[cmd.i];
            if (!c || c.sold) return no('sold');
            if (c.price > G.gold) return no('not enough gold');
            G.gold -= c.price; c.sold = true; addCard(G, c.id);
            G.events.push({ type: 'gaincard', id: c.id });
            return OK;
        }
        case 'buyRelic': {
            if (G.screen !== 'shop') return no('no shop');
            const r = G.shop.relics[cmd.i];
            if (!r || r.sold) return no('sold');
            if (r.price > G.gold) return no('not enough gold');
            G.gold -= r.price; r.sold = true; gainRelic(G, r.id);
            return OK;
        }
        case 'removeCard': {
            if (G.screen !== 'shop' || G.shop.removed) return no('no erasures left');
            if (G.removeCost > G.gold) return no('not enough gold');
            G.pick = { why: 'remove', price: G.removeCost, shop: true };
            return OK;
        }
        // --- the campfire
        case 'rest': {
            if (G.screen !== 'camp' || G.camp.done) return no('no campfire');
            const f = G.relics.includes('grail') ? 0.25 : 0.5;
            let n = 0;
            for (const a of G.army) { const add = Math.ceil((a.full - a.count) * f); a.count += add; n += add; }
            G.camp.done = 'rest';
            G.camp.raised = n;
            G.events.push({ type: 'rest', n });
            return OK;
        }
        case 'inscribe': {
            if (G.screen !== 'camp' || G.camp.done) return no('no campfire');
            if (!G.deck.some(canUpgrade)) return no('nothing to inscribe');
            G.pick = { why: 'upgrade', camp: true };
            return OK;
        }
        // --- encounters
        case 'choose': {
            if (G.screen !== 'event' || G.event.result) return no('no choice');
            const ev = EVENTS[G.event.id];
            const opt = ev.opts[cmd.i];
            if (!opt) return no('no such choice');
            if (opt.gold && G.gold < opt.gold) return no('not enough gold');
            if (opt.gold) G.gold -= opt.gold;
            G.event.chose = cmd.i;
            applyEvent(G, opt);
            return OK;
        }
        // --- picking a card from your deck
        case 'pickDeck': {
            if (!G.pick) return no('nothing to pick');
            const p = G.pick;
            if (cmd.uid == null) {
                if (p.free) return no('you must choose');
                G.pick = null; return OK;
            }
            const c = G.deck.find((x) => x.uid === cmd.uid);
            if (!c) return no('no such card');
            if (p.why === 'remove') {
                if (CARDS[c.id].rarity === 'sig') return no('a signature card leaves only with its creatures');
                if (p.price) { if (G.gold < p.price) return no('not enough gold'); G.gold -= p.price; G.removeCost += SHOP.removeStep; G.shop.removed = true; }
                G.deck = G.deck.filter((x) => x !== c);
                G.events.push({ type: 'erase', id: c.id });
            } else if (p.why === 'upgrade') {
                if (!canUpgrade(c)) return no('cannot be inscribed');
                c.up = true;
                if (p.camp) G.camp.done = 'inscribe';
                G.events.push({ type: 'inscribe', id: c.id });
            } else if (p.why === 'dupe') {
                if (CARDS[c.id].rarity === 'sig' || CARDS[c.id].kind === 'curse') return no('the fox will not copy that');
                addCard(G, c.id, c.up);
                G.events.push({ type: 'gaincard', id: c.id });
            }
            G.pick = null;
            return OK;
        }
        case 'leave': {
            if (G.screen === 'event' && G.event?.fight) {
                const groups = scaleGroups([['goblins', 20], ['slingers', 10], ['bandits', 6]], 3, G.act);
                startBattle(G, 'rob', groups);
                return OK;
            }
            if (G.screen === 'event' && !G.event.result) return no('make a choice');
            if (G.screen === 'reward' && !G.reward.cardTaken) G.reward.cardTaken = true;
            if (!['reward', 'dwelling', 'shop', 'camp', 'event', 'treasure'].includes(G.screen)) return no('nowhere to leave');
            backToMap(G);
            return OK;
        }
        case 'noop': return OK;
        default: return no('unknown command');
    }
}

export const canUpgrade = (c) => !c.up && !!CARDS[c.id].up && CARDS[c.id].kind !== 'curse';

function applyBoon(G, k) {
    const h = G.hero;
    if (k === 'atk') h.atk += 3;
    else if (k === 'def') h.def += 3;
    else if (k === 'lore') h.lore += 1;
    else if (k === 'gold') G.gold += 120;
    else if (k === 'levy') for (const a of G.army) { const n = Math.max(1, Math.round(a.full * 0.15)); a.count += n; a.full += n; }
    else if (k === 'draw') h.draw += 1;
    else if (k === 'ink') h.ink += 1;
    G.events.push({ type: 'boon', id: k });
}


/**
 * Advance time: the foes move one at a time, AI_DELAY apart, and only while the view isn't busy
 * (inp.hold). Nothing else in the game runs on a clock.
 */
export function step(G, inp, dt) {
    const B = G.battle;
    if (!B || B.phase !== 'enemy' || B.over) return;
    if (inp && inp.hold) return;
    B.eqT += dt;
    if (B.eqT < AI_DELAY) return;
    B.eqT = 0;
    BT.stepEnemy(B);
    G.events.push(...B.events.splice(0));
}

/** Tests and fast-forward: play the whole enemy phase at once. */
export function runEnemyPhase(G) {
    const B = G.battle;
    if (!B) return;
    let guard = 0;
    while (B.phase === 'enemy' && !B.over && guard++ < 60) { BT.stepEnemy(B); }
    G.events.push(...B.events.splice(0));
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, battle, ...rest } = G;
    const out = clone(rest);
    out.rngState = rng.state();
    if (battle) {
        const { rng: br, events: be, ...b } = battle;
        out.battle = clone(b);
        out.battle.rngState = br.state();
    } else out.battle = null;
    return out;
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, battle, ...rest } = clone(d);
    const G = { ...rest, rng: makeRng(0), events: [], battle: null };
    G.rng.setState(rngState);
    if (battle) {
        const { rngState: bs, ...b } = battle;
        G.battle = { ...b, rng: makeRng(0), events: [] };
        G.battle.rng.setState(bs);
    }
    return G;
}

export { CREATURES, FOES, CARDS, RELICS, BOONS, ACT_INFO, EVENTS };
