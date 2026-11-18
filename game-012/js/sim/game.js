// Arcana Pull — the run, as a pure command machine. newGame(seed) makes a run; act(G, cmd) changes it and
// pushes events onto G.events for the view, the sound and the UI to drain. No DOM, no clock, no Math.random:
// one seed and one list of commands always give the same run.
//
// Phases: hub (pull, build, fight) → won | lost (the result, then 'next') → reading (after Thresholds 3, 6, 9)
//         → hub … → ending (after The World) → ascend (the next round, harder, cards kept). 'over' when the lives run out.
//
// Commands:
//   { t: 'pull', n: 1 | 10 }          spend stardust at the Well
//   { t: 'place', slot, id }          put a card in a party slot (id null empties it; a card already placed moves)
//   { t: 'swap', a, b }               swap two party slots
//   { t: 'auto' }                     fill the party with the strongest line the sim can find for this Threshold
//   { t: 'starUp', id }               spend copies to raise a card's stars
//   { t: 'arm', item } / { t: 'disarm', item }   ready a charm for the next battle (the Wheel Token pays at once)
//   { t: 'fight' }                    the battle; the result is settled at once (the view replays it)
//   { t: 'next' }                     leave the result screen
//   { t: 'pick', i }                  choose a card at a Reading
//   { t: 'ascend' }                   after the ending, begin again one Ascension higher

import { makeRng } from '../rng.js';
import {
    PARTY_SIZE, TRIAL_COUNT, READING_AFTER, LIVES, START_DUST, PULL_COST, TEN_COST, RATES, PITY, SOFT_PITY, SOFT_STEP,
    FEATURED_SHARE, STAR_COST, MAX_STAR, SPARE_DUST, winDust, LOSS_DUST, winScore, ENEMY_SCALE, ASCENSION_STEP, TRIAL_HP, TRIAL_ATK,
    OMEN_FIGHTS, REVERSED_CHANCE, MAX_ITEMS,
} from '../config.js';
import { CARDS, CARD_IDS, BY_RARITY, RARITY_ORDER, ELEMENTS, SUIT_INFO } from './data/cards.js';
import { ENEMIES, TRIALS } from './data/enemies.js';
import { BLESSINGS, CURSES, ITEMS, ITEM_IDS } from './data/omens.js';
import { resolve, cardStats, resonance, elemMult, lineup } from './battle.js';

// ------------------------------------------------------------------ the run

export function newGame(seed = 1) {
    const G = {
        v: 2, seed: seed >>> 0, rs: 0,
        asc: 0, trial: 1, lives: LIVES, dust: START_DUST, score: 0,
        owned: {}, party: [null, null, null, null],
        pity: 0, featured: null,
        omen: null, items: [], armed: [],
        phase: 'hub', reading: null, result: null,
        seen: [], stats: { pulls: 0, wins: 0, losses: 0, legendaries: 0, fights: 0, best: 0 },
    };
    attach(G, makeRng(seed));
    G.featured = pickFeatured(G);
    G.events.push({ type: 'start', trial: G.trial });
    return G;
}

function attach(G, rng) {
    Object.defineProperty(G, 'rng', { value: rng, enumerable: false, writable: true });
    Object.defineProperty(G, 'events', { value: [], enumerable: false, writable: true });
}

export function serialize(G) {
    return JSON.stringify({ ...G, rs: G.rng.state() });
}
export function deserialize(s) {
    const o = typeof s === 'string' ? JSON.parse(s) : s;
    if (!o || o.v !== 2) throw new Error('not an Arcana Pull v2 save');
    const G = { ...o };
    const rng = makeRng(0);
    rng.setState(o.rs);
    attach(G, rng);
    return G;
}

// ------------------------------------------------------------------ helpers

export const trialOf = (G) => TRIALS[G.trial - 1];
const emit = (G, type, data = {}) => G.events.push({ type, ...data });
const deny = (G, why) => { emit(G, 'deny', { why }); return false; };

/** The Major Arcana a Threshold features: one whose element beats the Threshold's, if any does. */
function pickFeatured(G) {
    const tr = trialOf(G);
    const majors = BY_RARITY.L;
    const good = majors.filter((id) => ELEMENTS[CARDS[id].el]?.beats === tr.el);
    const pool = good.length ? good : majors;
    return pool[Math.floor(G.rng() * pool.length)];
}

/** Chance (0–100) that the next pull is Legendary. */
export function legendaryRate(G) {
    if (G.pity + 1 >= PITY) return 100;
    return RATES.L + Math.max(0, G.pity + 1 - SOFT_PITY) * SOFT_STEP;
}

function rollRarity(G, floor) {
    const lr = legendaryRate(G);
    if (lr >= 100) return 'L';
    const w = { ...RATES, L: lr };
    if (floor) for (const r of RARITY_ORDER) { if (r === floor) break; w[r] = 0; }
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let x = G.rng() * total;
    for (const r of RARITY_ORDER) { x -= w[r]; if (x < 0) return r; }
    return 'C';
}

function pullOne(G, floor = null) {
    const r = rollRarity(G, floor);
    let id;
    if (r === 'L' && G.featured && G.rng() < FEATURED_SHARE) id = G.featured;
    else { const pool = BY_RARITY[r]; id = pool[Math.floor(G.rng() * pool.length)]; }
    if (r === 'L') { G.pity = 0; G.stats.legendaries++; }
    else if (!G.omen?.pityFrozen) G.pity++;
    G.stats.pulls++;
    const o = G.owned[id];
    let dup = false, spare = 0;
    if (!o) { G.owned[id] = { star: 1, copies: 0 }; if (!G.seen.includes(id)) G.seen.push(id); }
    else {
        dup = true;
        if (o.star >= MAX_STAR) { spare = SPARE_DUST; G.dust += spare; }
        else o.copies++;
    }
    return { id, rarity: r, dup, spare, featured: id === G.featured };
}

// ------------------------------------------------------------------ fighters

/** The modifiers in force for the next battle: omen, armed charms, resonance and Ascension. */
export function battleMods(G, party = G.party) {
    const om = G.omen?.fx || {};
    const res = resonance(party);
    const armed = new Set(G.armed);
    return {
        res,
        atk: 1 + res.atk + (om.atk || 0),
        hp: 1 + (om.hp || 0),
        spd: 1 + res.spd + (om.spd || 0),
        def: res.def,
        heal: 1 + res.heal,
        crit: res.crit,
        shield: res.shield + (om.shield || 0) + (armed.has('star_vial') ? 0.35 : 0),
        poison: om.poison || 0,
        regen: res.regen,
        charge: res.charge,
        foeAtk: armed.has('moon_shard') ? 0.8 : 1,
        foeScale: ENEMY_SCALE * (1 + ASCENSION_STEP * G.asc),
    };
}

export function allySpec(G, id, m) {
    const c = CARDS[id], st = cardStats(id, G.owned[id]?.star || 1);
    const hp = Math.round(st.hp * m.hp);
    return {
        id, name: c.name, el: c.el, suit: c.suit,
        hp, atk: Math.round(st.atk * m.atk), spd: +(st.spd * m.spd).toFixed(2), def: Math.min(0.7, st.def + m.def),
        skill: c.skill, crit: (c.suit === 'swords' ? 0.12 : 0) + m.crit, healMult: m.heal, regen: m.regen, poison: m.poison,
        charge: m.charge, shield: Math.round(m.shield * hp),
    };
}

export function foeSpecs(G, trial = G.trial, m = battleMods(G)) {
    return TRIALS[trial - 1].foes.map((fid) => {
        const e = ENEMIES[fid];
        return {
            id: fid, name: e.name, el: e.el, hp: Math.round(e.hp * m.foeScale * TRIAL_HP[trial - 1]),
            atk: Math.round(e.atk * m.foeScale * m.foeAtk * TRIAL_ATK[trial - 1]),
            spd: e.spd, def: e.def, skill: e.skill, aim: e.aim, dodge: e.dodge, undying: e.undying, deathBlast: e.deathBlast,
            thorns: e.thorns, regen: e.regen, shieldAt: e.shieldAt ? [...e.shieldAt] : null, harvest: e.harvest, chargeHit: !!e.charge,
            opener: e.opener, phases: e.phases, boss: !!e.boss, elite: !!e.elite,
        };
    });
}

/** The party and the line of Hollows as they would start the next battle. */
export function preview(G, party = G.party) {
    const m = battleMods(G, party);
    const ids = party.filter(Boolean);
    return { ...lineup(ids.map((id) => allySpec(G, id, m)), foeSpecs(G, G.trial, m)), mods: m };
}

/** A card's rough worth against a Threshold: its numbers times its element's edge. Used by Auto and the bot. */
export function cardPower(G, id, trial = G.trial) {
    const st = cardStats(id, G.owned[id]?.star || 1), c = CARDS[id];
    const tr = TRIALS[trial - 1];
    const vsEl = tr.el === 'spirit' ? 1 : elemMult(c.el, tr.el);           // how hard it hits them
    const fromEl = tr.el === 'spirit' ? 1 : elemMult(tr.el, c.el);         // how hard they hit it
    const off = st.atk * st.spd / 10 * vsEl;
    const tough = st.hp / (1 - st.def) / fromEl;
    const rareBonus = { C: 1, U: 1.05, R: 1.12, E: 1.2, L: 1.35 }[c.rarity];
    return (off * 6 + tough * 0.35) * rareBonus;
}

/** The strongest four for a Threshold: a tank in front, a healer if one is owned, the rest by power. */
export function bestParty(G, trial = G.trial) {
    const ids = Object.keys(G.owned).sort((a, b) => cardPower(G, b, trial) - cardPower(G, a, trial));
    if (!ids.length) return [null, null, null, null];
    const pick = [];
    const take = (id) => { if (id && !pick.includes(id) && pick.length < PARTY_SIZE) pick.push(id); };
    take(ids.find((id) => CARDS[id].suit === 'pentacles' || id === 'm04'));
    take(ids.find((id) => CARDS[id].suit === 'cups' || ['m03', 'm05', 'm14', 'm17'].includes(id)));
    for (const id of ids) take(id);
    // the toughest card leads; healers and strikers behind
    const toughness = (id) => { const s = cardStats(id, G.owned[id].star); return s.hp / (1 - s.def); };
    pick.sort((a, b) => toughness(b) - toughness(a));
    const front = pick.shift();
    const rest = pick.sort((a, b) => (CARDS[a].suit === 'cups') - (CARDS[b].suit === 'cups'));
    const out = [front, ...rest];
    while (out.length < PARTY_SIZE) out.push(null);
    return out;
}

// ------------------------------------------------------------------ act

export function act(G, cmd) {
    if (!cmd || typeof cmd.t !== 'string') return deny(G, 'bad');
    switch (cmd.t) {
        case 'pull': return pull(G, cmd.n === 10 ? 10 : 1);
        case 'place': return place(G, cmd.slot, cmd.id ?? null);
        case 'swap': return swap(G, cmd.a, cmd.b);
        case 'auto': return auto(G);
        case 'starUp': return starUp(G, cmd.id);
        case 'arm': return arm(G, cmd.item, true);
        case 'disarm': return arm(G, cmd.item, false);
        case 'fight': return fight(G);
        case 'next': return next(G);
        case 'pick': return pick(G, cmd.i);
        case 'ascend': return ascend(G);
        default: return deny(G, 'unknown');
    }
}

function pull(G, n, free = false) {
    if (G.phase !== 'hub' && !free) return deny(G, 'phase');
    const cost = free ? 0 : n === 10 ? TEN_COST : PULL_COST;
    if (G.dust < cost) return deny(G, 'dust');
    G.dust -= cost;
    const got = [];
    for (let i = 0; i < n; i++) got.push(pullOne(G));
    if (n === 10 && !got.some((g) => RARITY_ORDER.indexOf(g.rarity) >= 2)) {
        // the tenth card is Rare or better: undo the last pull's bookkeeping and draw it again
        const last = got.pop();
        undoPull(G, last);
        got.push(pullOne(G, 'R'));
    }
    emit(G, 'pulled', { cards: got, cost, free });
    if (G.party.every((p) => !p)) auto(G, true);
    return true;
}
function undoPull(G, g) {
    const o = G.owned[g.id];
    if (g.spare) G.dust -= g.spare;
    else if (g.dup) o.copies--;
    else { delete G.owned[g.id]; G.seen = G.seen.filter((s) => s !== g.id); }
    if (!G.omen?.pityFrozen) G.pity = Math.max(0, G.pity - 1);
    G.stats.pulls--;
}

function place(G, slot, id) {
    if (G.phase !== 'hub') return deny(G, 'phase');
    if (!Number.isInteger(slot) || slot < 0 || slot >= PARTY_SIZE) return deny(G, 'slot');
    if (id !== null && !G.owned[id]) return deny(G, 'unowned');
    const was = id ? G.party.indexOf(id) : -1;
    if (was >= 0) G.party[was] = G.party[slot];
    G.party[slot] = id;
    emit(G, 'party', { party: [...G.party] });
    return true;
}
function swap(G, a, b) {
    if (G.phase !== 'hub') return deny(G, 'phase');
    if (![a, b].every((s) => Number.isInteger(s) && s >= 0 && s < PARTY_SIZE) || a === b) return deny(G, 'slot');
    [G.party[a], G.party[b]] = [G.party[b], G.party[a]];
    emit(G, 'party', { party: [...G.party] });
    return true;
}
function auto(G, quiet = false) {
    if (G.phase !== 'hub') return deny(G, 'phase');
    if (!Object.keys(G.owned).length) return deny(G, 'empty');
    G.party = bestParty(G);
    emit(G, 'party', { party: [...G.party], auto: true, quiet });
    return true;
}

export const starCost = (G, id) => STAR_COST[G.owned[id]?.star || 0] ?? Infinity;
export const canStarUp = (G, id) => !!G.owned[id] && G.owned[id].star < MAX_STAR && G.owned[id].copies >= starCost(G, id);

function starUp(G, id) {
    if (G.phase !== 'hub') return deny(G, 'phase');
    if (!canStarUp(G, id)) return deny(G, 'copies');
    const o = G.owned[id];
    o.copies -= starCost(G, id);
    o.star++;
    emit(G, 'starUp', { id, star: o.star });
    return true;
}

function arm(G, item, on) {
    if (G.phase !== 'hub') return deny(G, 'phase');
    const k = G.items.indexOf(item);
    if (on) {
        if (k < 0) return deny(G, 'item');
        if (item === 'wheel_token') {
            G.items.splice(k, 1);
            emit(G, 'used', { item });
            return pull(G, 10, true);
        }
        if (G.armed.includes(item)) return deny(G, 'armed');
        G.armed.push(item);
    } else {
        const a = G.armed.indexOf(item);
        if (a < 0) return deny(G, 'item');
        G.armed.splice(a, 1);
    }
    emit(G, 'armed', { item, on });
    return true;
}

function fight(G) {
    if (G.phase !== 'hub') return deny(G, 'phase');
    const ids = G.party.filter(Boolean);
    if (!ids.length) return deny(G, 'party');
    const m = battleMods(G);
    const allies = ids.map((id) => allySpec(G, id, m));
    const foes = foeSpecs(G, G.trial, m);
    const start = lineup(allies, foes);
    const res = resolve(allies, foes, G.rng);
    G.stats.fights++;
    // charms are spent by the battle
    const sun = G.armed.includes('sun_sigil');
    for (const it of G.armed) G.items.splice(G.items.indexOf(it), 1);
    G.armed = [];
    const om = G.omen;
    let dust;
    if (res.won) {
        dust = winDust(G.trial) * (sun ? 2 : 1) * (om?.fx.dustMult || 1);
        dust = Math.round(dust);
        G.dust += dust;
        const sc = winScore(G.trial, res.survivors) * (1 + G.asc);
        G.score += sc;
        G.stats.wins++;
        G.phase = 'won';
        G.result = { won: true, trial: G.trial, dust, score: sc, survivors: res.survivors, t: res.t };
    } else {
        dust = Math.round(LOSS_DUST * (om?.fx.dustMult || 1));
        G.dust += dust;
        G.lives--;
        G.stats.losses++;
        G.phase = G.lives <= 0 ? 'over' : 'lost';
        G.result = { won: false, trial: G.trial, dust, lives: G.lives, t: res.t, timeout: res.log.some((e) => e.e === 'timeout') };
    }
    if (om && --om.left <= 0) { emit(G, 'omenEnd', { omen: om.id }); G.omen = null; }
    emit(G, 'battle', { start, log: res.log, won: res.won, result: { ...G.result }, trial: G.trial, realm: trialOf(G).id });
    if (G.phase === 'over') emit(G, 'over', { score: G.score });
    return true;
}

function next(G) {
    if (G.phase === 'won') {
        const done = G.trial;
        G.stats.best = Math.max(G.stats.best, done);
        if (done >= TRIAL_COUNT) {
            G.phase = 'ending';
            emit(G, 'ending', { asc: G.asc, score: G.score });
            return true;
        }
        G.trial++;
        G.featured = pickFeatured(G);
        if (READING_AFTER.includes(done)) return dealReading(G);
        G.phase = 'hub';
        emit(G, 'trial', { trial: G.trial });
        return true;
    }
    if (G.phase === 'lost') {
        G.phase = 'hub';
        emit(G, 'retry', { trial: G.trial, lives: G.lives });
        return true;
    }
    return deny(G, 'phase');
}

function dealReading(G) {
    const deck = [...CARD_IDS];
    const cards = [];
    for (let i = 0; i < 3; i++) {
        const k = Math.floor(G.rng() * deck.length);
        cards.push(deck.splice(k, 1)[0]);
    }
    G.phase = 'reading';
    G.reading = { cards, picked: -1 };
    emit(G, 'reading', { cards });
    return true;
}

/** What a Reading card would give, upright and reversed. */
export function omenFor(id) {
    const s = CARDS[id].suit;
    return { up: BLESSINGS[s], down: CURSES[s] };
}

function pick(G, i) {
    if (G.phase !== 'reading' || !G.reading) return deny(G, 'phase');
    if (!Number.isInteger(i) || i < 0 || i > 2) return deny(G, 'pick');
    const id = G.reading.cards[i];
    const reversed = G.rng() < REVERSED_CHANCE;
    const o = omenFor(id)[reversed ? 'down' : 'up'];
    G.reading.picked = i;
    let item = null;
    if (o.item) {
        item = ITEM_IDS[Math.floor(G.rng() * ITEM_IDS.length)];
        if (G.items.length < MAX_ITEMS) G.items.push(item); else item = null;
    }
    if (o.dust) G.dust += o.dust;
    G.omen = (o.item || o.dust) && !o.atk && !o.hp ? null : { id: o.id, name: o.name, text: o.text, card: id, reversed, left: OMEN_FIGHTS, fx: o, pityFrozen: !!o.pityFrozen };
    emit(G, 'omen', { card: id, reversed, omen: o.id, name: o.name, text: o.text, item });
    G.reading = null;
    G.phase = 'hub';
    emit(G, 'trial', { trial: G.trial });
    return true;
}

function ascend(G) {
    if (G.phase !== 'ending') return deny(G, 'phase');
    G.asc++;
    G.trial = 1;
    G.lives = LIVES;
    G.omen = null;
    G.phase = 'hub';
    G.dust += 300;
    G.featured = pickFeatured(G);
    emit(G, 'ascend', { asc: G.asc });
    emit(G, 'trial', { trial: G.trial });
    return true;
}

/** Each charm a Hollow might drop at a win: none here; charms come from Fortune readings and Ascension gifts. */
export function legal(G) {
    const out = [];
    if (G.phase === 'hub') {
        if (G.dust >= PULL_COST) out.push({ t: 'pull', n: 1 });
        if (G.dust >= TEN_COST) out.push({ t: 'pull', n: 10 });
        if (G.party.some(Boolean)) out.push({ t: 'fight' });
        for (const id of Object.keys(G.owned)) if (canStarUp(G, id)) out.push({ t: 'starUp', id });
        for (const it of G.items) if (!G.armed.includes(it)) out.push({ t: 'arm', item: it });
        if (Object.keys(G.owned).length) out.push({ t: 'auto' });
    } else if (G.phase === 'won' || G.phase === 'lost') out.push({ t: 'next' });
    else if (G.phase === 'reading') for (let i = 0; i < 3; i++) out.push({ t: 'pick', i });
    else if (G.phase === 'ending') out.push({ t: 'ascend' });
    return out;
}

export { CARDS, ENEMIES, TRIALS, ITEMS, SUIT_INFO, ELEMENTS };
