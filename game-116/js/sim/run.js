// The run around the fights: the map of each reel, rewards, the Army Surplus store, the diner,
// strange broadcasts, souvenirs, deck edits and moving from reel to reel. Pure.

import { ACT_HEAL, ACTS, BUCKS, DECK_MIN, GADGET_DROP, GADGET_SLOTS, MAP, REST_HEAL, SHOP } from '../config.js';
import { CARDS, CARD_POOL, ENEMIES, EVENTS, EVENT_KEYS, GADGETS, GADGET_POOL, RELICS, RELIC_POOL, REELS } from './data.js';
import { emit, hasRelic, startBattle } from './battle.js';

// ------------------------------------------------------------------ the map
// Non-crossing random walks climb the rows one lane at a time (edges r:a→b and r:c→d cross when
// (a − c)(b − d) < 0; a straight step never does), the nodes are every visited cell, and every node
// in the last row leads to the boss. Rows: 0 is the bottom (always a fight), 3 holds treasure,
// the last row is the diner.
export function makeMap(G) {
    const R = MAP.rows, L = MAP.lanes, rng = G.rng;
    const edges = [];
    const cells = new Map();
    const cell = (r, l) => {
        const k = r * 10 + l;
        if (!cells.has(k)) cells.set(k, { id: -1, row: r, lane: l, type: 'fight', next: [] });
        return cells.get(k);
    };
    const crosses = (r, a, b) => edges.some((e) => e.r === r && (a - e.a) * (b - e.b) < 0);
    for (let w = 0; w < MAP.walks; w++) {
        let lane = w === 0 ? 0 : w === 1 ? L - 1 : rng.int(0, L - 1);
        cell(0, lane);
        for (let r = 0; r < R - 1; r++) {
            const opts = [lane - 1, lane, lane + 1].filter((x) => x >= 0 && x < L && !crosses(r, lane, x));
            const nxt = rng.pick(opts);
            if (!edges.some((e) => e.r === r && e.a === lane && e.b === nxt)) edges.push({ r, a: lane, b: nxt });
            cell(r + 1, nxt);
            lane = nxt;
        }
    }
    const nodes = [...cells.values()].sort((p, q) => p.row - q.row || p.lane - q.lane);
    nodes.forEach((n, i) => { n.id = i; });
    const at = (r, l) => nodes.find((n) => n.row === r && n.lane === l);
    for (const e of edges) at(e.r, e.a).next.push(at(e.r + 1, e.b).id);
    for (const n of nodes) n.next.sort((a, b) => nodes[a].lane - nodes[b].lane);
    const boss = { id: nodes.length, row: R, lane: (L - 1) / 2, type: 'boss', next: [] };
    for (const n of nodes) if (n.row === R - 1) n.next.push(boss.id);
    nodes.push(boss);

    // types, row by row, never two elites, shops or diners in a row along a path
    const parents = (n) => nodes.filter((p) => p.next.includes(n.id));
    for (const n of nodes) {
        if (n.type === 'boss') continue;
        if (n.row === 0) { n.type = 'fight'; continue; }
        if (n.row === R - 1) { n.type = 'rest'; continue; }
        if (n.row === 3) { n.type = 'treasure'; continue; }
        let t;
        for (let tries = 0; tries < 8; tries++) {
            const x = rng();
            t = x < 0.45 ? 'fight' : x < 0.67 ? 'event' : x < 0.8 ? 'elite' : x < 0.9 ? 'shop' : 'rest';
            if (t === 'elite' && n.row < 2) continue;
            if (t === 'rest' && n.row >= R - 2) continue;
            if ((t === 'elite' || t === 'shop' || t === 'rest') && parents(n).some((p) => p.type === t)) continue;
            break;
        }
        n.type = t;
    }
    if (!nodes.some((n) => n.type === 'shop')) {
        const c = nodes.filter((n) => (n.type === 'fight' || n.type === 'event') && n.row >= 1 && n.row <= R - 2);
        if (c.length) rng.pick(c).type = 'shop';
    }
    return { nodes, boss: boss.id };
}

/** The nodes you may travel to next. */
export function choices(G) {
    if (G.phase !== 'map') return [];
    const m = G.map;
    if (G.pos == null) return m.nodes.filter((n) => n.row === 0).map((n) => n.id);
    return m.nodes[G.pos].next.slice();
}

// ------------------------------------------------------------------ deck and inventory
export function addCard(G, k, up = false, extra = {}) {
    const c = { uid: G.nextUid++, k, up: !!up, ...extra };
    if (k === 'plain' && c.r == null) { c.r = G.rng.int(1, 13); c.s = G.rng.int(0, 3); }
    G.deck.push(c);
    emit(G, { type: 'gain', what: 'card', k, up: c.up });
    return c;
}
export const upgradable = (c) => !c.up && !CARDS[c.k].junk;
export function canRemove(G) { return G.deck.length > DECK_MIN; }

function addRelic(G, k) {
    if (!k || G.relics.includes(k)) return false;
    G.relics.push(k);
    if (k === 'golden_theremin') { G.maxHp += 14; G.hp = Math.min(G.maxHp, G.hp + 14); }
    emit(G, { type: 'gain', what: 'relic', k });
    return true;
}

function rollRarity(G, tier) {
    const x = G.rng();
    if (tier === 'boss') return x < 0.5 ? 'rare' : 'uncommon';
    if (tier === 'elite') return x < 0.15 ? 'rare' : x < 0.55 ? 'uncommon' : 'common';
    return x < 0.06 ? 'rare' : x < 0.4 ? 'uncommon' : 'common';
}
function cardChoices(G, tier, n = 3) {
    const out = [];
    for (let guard = 0; out.length < n && guard < 50; guard++) {
        const k = G.rng.pick(CARD_POOL[rollRarity(G, tier)]);
        if (out.some((o) => o.k === k)) continue;
        const upChance = [0, 0.15, 0.3][G.act] ?? 0;
        out.push({ k, up: G.rng() < upChance });
    }
    return out;
}
function randomRelic(G, tiers) {
    const pool = tiers.flatMap((t) => RELIC_POOL[t]).filter((k) => !G.relics.includes(k));
    return pool.length ? G.rng.pick(pool) : null;
}
function randomGadget(G) {
    const pool = GADGET_POOL.filter((k) => !G.gadgets.includes(k));
    return pool.length ? G.rng.pick(pool) : null;
}
/** Put a gadget in a free slot, or in place of the one in `slot` when all are full. */
function takeGadget(G, k, slot) {
    if (!GADGETS[k]) return false;
    if (G.gadgets.length < GADGET_SLOTS) G.gadgets.push(k);
    else {
        if (slot == null || slot < 0 || slot >= G.gadgets.length) return false;
        G.gadgets[slot] = k;
    }
    emit(G, { type: 'gain', what: 'gadget', k });
    return true;
}

// ------------------------------------------------------------------ travelling
export function travel(G, id) {
    if (!choices(G).includes(id)) return false;
    const n = G.map.nodes[id];
    G.pos = id;
    G.trail.push(id);
    G.stats.floors++;
    G.offer = null;
    emit(G, { type: 'travel', id, kind: n.type });
    const reel = REELS[G.act];
    if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') {
        let key;
        if (n.type === 'boss') key = reel.boss;
        else {
            const pool = (n.type === 'elite' ? reel.elites : reel.fights).filter((k) => k !== G.lastFoe);
            key = G.rng.pick(pool);
        }
        G.lastFoe = key;
        G.phase = 'battle';
        startBattle(G, key);
    } else if (n.type === 'rest') {
        G.phase = 'rest';
        G.offer = { kind: 'rest' };
    } else if (n.type === 'shop') {
        G.phase = 'shop';
        G.offer = makeShop(G);
    } else if (n.type === 'treasure') {
        G.phase = 'reward';
        G.offer = { kind: 'treasure', bucks: 0, cards: [], cardTaken: true, gadget: null, gadgetTaken: true, relics: [randomRelic(G, ['common', 'uncommon'])].filter(Boolean), relicTaken: false };
    } else if (n.type === 'event') {
        const pool = EVENT_KEYS.filter((k) => !G.seenEvents.includes(k));
        const k = G.rng.pick(pool.length ? pool : EVENT_KEYS);
        G.seenEvents.push(k);
        G.phase = 'event';
        G.offer = { kind: 'event', k, chosen: -1, result: null, gadget: null, gadgetTaken: true };
    }
    return true;
}

// ------------------------------------------------------------------ after a fight
export function battleWon(G) {
    const B = G.battle;
    const tier = B.tier;
    G.stats[tier === 'boss' ? 'bosses' : tier === 'elite' ? 'elites' : 'fights']++;
    let bucks = G.rng.int(...BUCKS[tier]);
    if (hasRelic(G, 'piggy_bank')) bucks = Math.round(bucks * 1.5);
    G.bucks += bucks;
    emit(G, { type: 'bucks', n: bucks });
    if (hasRelic(G, 'jukebox')) {
        const was = G.hp;
        G.hp = Math.min(G.maxHp, G.hp + 5);
        if (G.hp > was) emit(G, { type: 'heal', who: 'player', n: G.hp - was });
    }
    const gadget = tier === 'elite' || (tier === 'fight' && G.rng() < GADGET_DROP) ? randomGadget(G) : null;
    let relics = [];
    if (tier === 'elite') relics = [randomRelic(G, ['common', 'uncommon'])].filter(Boolean);
    if (tier === 'boss') {
        const pool = RELIC_POOL.boss.filter((k) => !G.relics.includes(k));
        G.rng.shuffle(pool);
        relics = pool.slice(0, 2);
        if (relics.length < 2) { const r = randomRelic(G, ['uncommon', 'common']); if (r && !relics.includes(r)) relics.push(r); }
    }
    G.offer = { kind: 'reward', tier, bucks, cards: cardChoices(G, tier), cardTaken: false, gadget, gadgetTaken: !gadget, relics, relicTaken: !relics.length };
    G.phase = 'reward';
}

export function take(G, cmd) {
    const o = G.offer;
    if (!o || (o.kind !== 'reward' && o.kind !== 'treasure' && o.kind !== 'event')) return false;
    if (cmd.what === 'card') {
        if (o.kind === 'event' || o.cardTaken) return false;
        const c = o.cards[cmd.i];
        if (!c) return false;
        addCard(G, c.k, c.up);
        o.cardTaken = true;
        return true;
    }
    if (cmd.what === 'gadget') {
        if (!o.gadget || o.gadgetTaken) return false;
        if (!takeGadget(G, o.gadget, cmd.slot)) return false;
        o.gadgetTaken = true;
        return true;
    }
    if (cmd.what === 'relic') {
        if (o.kind === 'event' || o.relicTaken) return false;
        const k = o.relics[cmd.i ?? 0];
        if (!k || !addRelic(G, k)) return false;
        o.relicTaken = true;
        return true;
    }
    return false;
}

/** Leave whatever panel is up: back to the map, on to the next reel, or into the credits. */
export function done(G) {
    if (G.pick) return false;
    const o = G.offer;
    if (G.phase === 'intro') { G.phase = 'map'; G.offer = null; emit(G, { type: 'phase', phase: 'map' }); return true; }
    if (G.phase === 'event' && o && o.chosen < 0) return false;
    if (!['reward', 'shop', 'rest', 'event'].includes(G.phase)) return false;
    const bossDown = G.phase === 'reward' && o?.tier === 'boss';
    G.battle = null;
    G.offer = null;
    if (bossDown) return nextAct(G);
    G.phase = 'map';
    emit(G, { type: 'phase', phase: 'map' });
    return true;
}

function nextAct(G) {
    if (G.act >= ACTS - 1) {
        G.over = true; G.won = true; G.phase = 'over';
        emit(G, { type: 'over', won: true });
        return true;
    }
    G.act++;
    G.map = makeMap(G);
    G.pos = null;
    G.trail = [];
    const missing = G.maxHp - G.hp;
    const h = Math.round(missing * ACT_HEAL);
    G.hp += h;
    G.phase = 'intro';
    emit(G, { type: 'act', act: G.act, heal: h });
    return true;
}

export function gameOver(G) {
    G.over = true; G.won = false; G.phase = 'over';
    emit(G, { type: 'over', won: false });
}

// ------------------------------------------------------------------ the Army Surplus store
function makeShop(G) {
    const cards = cardChoices(G, 'fight', 2).concat(cardChoices(G, 'elite', 2)).filter((c, i, a) => a.findIndex((d) => d.k === c.k) === i).slice(0, 4);
    const price = (c) => {
        const base = { common: SHOP.card[0], uncommon: 58, rare: SHOP.card[1] }[CARDS[c.k].rarity] ?? 50;
        return base + (c.up ? 18 : 0) + G.rng.int(-4, 4);
    };
    const gk = randomGadget(G);
    const rk = randomRelic(G, ['common', 'uncommon']);
    return {
        kind: 'shop',
        cards: cards.map((c) => ({ ...c, price: price(c), sold: false })),
        gadget: gk ? { k: gk, price: SHOP.gadget + G.rng.int(-6, 6), sold: false } : null,
        relic: rk ? { k: rk, price: SHOP.relic + G.rng.int(-10, 10), sold: false } : null,
        removeUsed: false,
    };
}

export function buy(G, cmd) {
    const o = G.offer;
    if (G.phase !== 'shop' || !o || G.pick) return false;
    const pay = (n) => { G.bucks -= n; emit(G, { type: 'bucks', n: -n }); };
    if (cmd.what === 'card') {
        const c = o.cards[cmd.i];
        if (!c || c.sold || G.bucks < c.price) return false;
        pay(c.price); c.sold = true; addCard(G, c.k, c.up);
        return true;
    }
    if (cmd.what === 'gadget') {
        const g = o.gadget;
        if (!g || g.sold || G.bucks < g.price) return false;
        if (!takeGadget(G, g.k, cmd.slot)) return false;
        pay(g.price); g.sold = true;
        return true;
    }
    if (cmd.what === 'relic') {
        const r = o.relic;
        if (!r || r.sold || G.bucks < r.price) return false;
        pay(r.price); r.sold = true; addRelic(G, r.k);
        return true;
    }
    if (cmd.what === 'remove') {
        if (o.removeUsed || G.bucks < G.removePrice || !canRemove(G)) return false;
        G.pick = { why: 'remove', cost: G.removePrice };
        return true;
    }
    return false;
}

// ------------------------------------------------------------------ the diner
export function rest(G, cmd) {
    if (G.phase !== 'rest' || G.pick) return false;
    if (cmd.what === 'heal') {
        const was = G.hp;
        G.hp = Math.min(G.maxHp, G.hp + Math.round(G.maxHp * REST_HEAL));
        emit(G, { type: 'heal', who: 'player', n: G.hp - was });
        G.offer.used = 'heal';
        return done(G);
    }
    if (cmd.what === 'upgrade') {
        if (!G.deck.some(upgradable)) return false;
        G.pick = { why: 'upgrade' };
        return true;
    }
    return false;
}

// ------------------------------------------------------------------ picking a card from the deck
export function pick(G, uid) {
    const p = G.pick;
    if (!p) return false;
    if (uid == null) {            // cancelled
        if (p.locked) return false;
        G.pick = null;
        return true;
    }
    const c = G.deck.find((d) => d.uid === uid);
    if (!c) return false;
    if (p.why === 'remove') {
        if (!canRemove(G)) return false;
        G.deck.splice(G.deck.indexOf(c), 1);
        if (p.cost) {
            G.bucks -= p.cost; emit(G, { type: 'bucks', n: -p.cost });
            G.removePrice += SHOP.removeStep;
            G.offer.removeUsed = true;
        }
        emit(G, { type: 'remove', k: c.k });
    } else if (p.why === 'upgrade') {
        if (!upgradable(c)) return false;
        c.up = true;
        emit(G, { type: 'upgrade', k: c.k });
    }
    G.pick = null;
    if (G.phase === 'rest') return done(G);
    return true;
}

// ------------------------------------------------------------------ strange broadcasts
export function optionOk(G, opt) {
    if (opt.needBucks && G.bucks < opt.needBucks) return false;
    if (opt.needDeck && !canRemove(G)) return false;
    return true;
}

export function choose(G, i) {
    const o = G.offer;
    if (G.phase !== 'event' || !o || o.chosen >= 0 || G.pick) return false;
    const ev = EVENTS[o.k];
    const opt = ev.options[i];
    if (!opt || !optionOk(G, opt)) return false;
    o.chosen = i;
    o.result = opt.result;
    const d = opt.do;
    if (d.pay) { G.bucks -= d.pay; emit(G, { type: 'bucks', n: -d.pay }); }
    if (d.bucks) { G.bucks += d.bucks; emit(G, { type: 'bucks', n: d.bucks }); }
    if (d.maxHp) { G.maxHp += d.maxHp; emit(G, { type: 'maxhp', n: d.maxHp }); }
    if (d.heal) { const was = G.hp; G.hp = Math.min(G.maxHp, G.hp + d.heal); if (G.hp > was) emit(G, { type: 'heal', who: 'player', n: G.hp - was }); }
    if (d.dmg) {
        G.hp = Math.max(1, G.hp - d.dmg);      // a broadcast can hurt, but never kills
        G.stats.taken += d.dmg;
        emit(G, { type: 'hit', who: 'player', n: d.dmg, blocked: 0, src: 'event' });
    }
    if (d.curse) addCard(G, d.curse);
    if (d.relic) { const r = randomRelic(G, ['common', 'uncommon']); if (r) addRelic(G, r); else { G.bucks += 40; emit(G, { type: 'bucks', n: 40 }); } }
    if (d.card) { const c = cardChoices(G, 'fight', 1)[0]; addCard(G, c.k, c.up); }
    if (d.rareCard) addCard(G, G.rng.pick(CARD_POOL.rare));
    if (d.upgradeRandom) {
        const ups = G.deck.filter(upgradable);
        if (ups.length) { const c = G.rng.pick(ups); c.up = true; emit(G, { type: 'upgrade', k: c.k }); }
    }
    if (d.gadget) { const k = randomGadget(G); if (k) { o.gadget = k; o.gadgetTaken = false; } }
    if (d.remove) G.pick = { why: 'remove', cost: 0, locked: true };
    emit(G, { type: 'choose', k: o.k, i });
    return true;
}

// ------------------------------------------------------------------ for the view and the bot
export const nodeIcon = (t) => ({ fight: 'fight', elite: 'elite', boss: 'boss', rest: 'rest', shop: 'shop', event: 'event', treasure: 'treasure' })[t];
export const enemyDef = (k) => ENEMIES[k];
