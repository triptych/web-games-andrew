// CLEAN SLATE — the simulation. Pure: no DOM, no renderer, no Math.random, no clock.
// Turn-based: everything the player (or the bot, or a test) does is one act(G, cmd). act() checks
// the command, resolves it at once and pushes G.events for the view, the sound and the HUD.
//
// A run: letters (choose tonight's visitor) → night (Pyramid solitaire against their past) →
// won (partner or farewell) → day (market, one chore) → maybe an interlude → letters ... three
// acts of three nights and a boss. Resolve is the run's health; at 0 the knives come back out.

import { RUN, settleTips } from '../config.js';
import { makeRng } from '../rng.js';
import { CARDS, STARTER, MARKET, fxOf } from './data/cards.js';
import { RIVALS, ACTS, WEIGHTS } from './data/rivals.js';
import { ROOMS, INTERLUDES, endingFor } from './data/inn.js';
import { buildLayout } from './layout.js';

export const def = (id) => CARDS[id];

// ------------------------------------------------------------------ run
export function newGame(seed = 1) {
    const G = {
        v: 1, seed, rng: makeRng(hashSeed(seed)),
        phase: 'letters', act: 1, night: 0,
        resolve: RUN.resolve, maxResolve: RUN.resolve, tips: RUN.tips, notoriety: 0,
        deck: [], partners: [], rooms: [], seen: [], usedInterludes: [], uid: 0,
        letters: [], fight: null, won: null, day: null, interlude: null, ending: null, over: false,
        stats: { nights: 0, settles: 0, blades: 0, tipsEarned: 0, refused: 0 },
        events: [],
    };
    for (const id of STARTER) addCard(G, id);
    dealLetters(G);
    G.events.push({ type: 'intro' });
    return G;
}

function hashSeed(s) {
    let h = (s | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
}

function addCard(G, id, up = false) {
    const c = { uid: 'c' + (++G.uid), id, up };
    G.deck.push(c);
    return c;
}
const has = (G, room) => G.rooms.includes(room);
const shuffle = (rng, a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const bladesInDeck = (G) => G.deck.filter((c) => def(c.id).suit === 'blade').length;

// ------------------------------------------------------------------ letters
function dealLetters(G) {
    const A = ACTS[G.act];
    if (G.night >= 3) { G.letters = [A.boss]; }
    else {
        const pool = A.rivals.filter((id) => !G.seen.includes(id));
        G.letters = shuffle(G.rng, pool.slice()).slice(0, Math.min(2, pool.length));
    }
    G.phase = 'letters';
    G.events.push({ type: 'letters', ids: G.letters.slice() });
}

// ------------------------------------------------------------------ the night
function startFight(G, rid) {
    const R = RIVALS[rid];
    const L = buildLayout(R.layout);
    const w = WEIGHTS[R.weights];
    const total = w.reduce((a, b) => a + b, 0);
    const rollRank = () => { let x = G.rng() * total; for (let r = 1; r <= 13; r++) { x -= w[r]; if (x <= 0) return r; } return 13; };
    const faceUp = R.faceUp + (has(G, 'board') ? 1 : 0);
    const slots = L.slots.map((s) => ({
        id: s.id, rank: rollRank(), up: s.r >= L.rows - faceUp, gone: false, lock: 0, taint: false, bounty: false,
    }));
    const tag = (k, n) => { const free = shuffle(G.rng, slots.filter((s) => !s.taint && !s.bounty).map((s) => s.id)); for (const id of free.slice(0, n)) slots[id][k] = true; };
    if (R.traits.taint) tag('taint', R.traits.taint);
    if (R.traits.bounty) tag('bounty', R.traits.bounty);
    const cards = {};
    for (const c of G.deck) cards[c.uid] = { id: c.id, up: c.up };
    G.fight = {
        rival: rid, round: 1, slots, cards, tmp: 0,
        draw: shuffle(G.rng, G.deck.map((c) => c.uid)), hand: [], discard: [], out: [],
        composure: has(G, 'cellar') ? 2 : 0, soothe: 0, streak: 0, pours: 0, blades: 0, fluster: 0,
        intentAt: G.rng.int(0, R.intents.length - 1), intent: null,
    };
    G.seen.push(rid);
    G.phase = 'night';
    G.events.push({ type: 'arrive', rival: rid });
    nextIntent(G);
    drawCards(G, handSize(G));
}

const handSize = (G) => RUN.hand + (has(G, 'snug') ? 1 : 0);
export const layoutOf = (F) => buildLayout(RIVALS[F.rival].layout);
const LAYOUTS = {};
function lay(F) { return (LAYOUTS[F.rival] ||= layoutOf(F)); }

/** A rival card is open once both cards below it are gone. */
export function exposed(F, id) {
    const s = F.slots[id];
    return !s.gone && lay(F).slots[id].coveredBy.every((c) => F.slots[c].gone);
}
export const openSlots = (F) => F.slots.filter((s) => exposed(F, s.id));

function nextIntent(G) {
    const F = G.fight, R = RIVALS[F.rival];
    const it = { ...R.intents[F.intentAt % R.intents.length] };
    F.intentAt++;
    if (it.t === 'hit') it.n = Math.round(it.n * RUN.hitScale[G.act]) + Math.floor(G.notoriety / RUN.notorietyStep);
    F.intent = it;
    G.events.push({ type: 'intent', intent: { ...it } });
}

function drawCards(G, n) {
    const F = G.fight;
    for (let k = 0; k < n; k++) {
        if (!F.draw.length) {
            if (!F.discard.length) break;
            F.draw = shuffle(G.rng, F.discard.splice(0));
            G.events.push({ type: 'reshuffle' });
        }
        const uid = F.draw.pop();
        F.hand.push(uid);
        G.events.push({ type: 'draw', uid });
    }
}

/** A hand card's rank and effects as they stand in this fight. */
export function cardInfo(F, uid) {
    const c = F.cards[uid], d = def(c.id);
    return { uid, d, fx: fxOf(d, c.up), rank: d.rank, up: c.up };
}

/** Can these two be paired? a/b are { slot: id } or { hand: uid }. */
export function canPair(G, a, b) {
    const F = G.fight;
    if (!F || G.phase !== 'night') return false;
    if (a.hand && b.hand) return false;
    if (a.slot != null && b.slot != null && a.slot === b.slot) return false;
    const side = (x) => {
        if (x.slot != null) {
            const s = F.slots[x.slot];
            if (!s || !exposed(F, x.slot) || s.lock) return null;
            return { rank: s.rank, flex: 0, wild: false };
        }
        if (!F.hand.includes(x.hand)) return null;
        const ci = cardInfo(F, x.hand);
        if (ci.d.trick || ci.d.junk) return null;
        return { rank: ci.rank, flex: RUN.flex + (ci.fx.flex || 0), wild: !!ci.fx.wild };
    };
    const A = side(a), B = side(b);
    if (!A || !B) return false;
    if (A.wild || B.wild) return true;
    return Math.abs(A.rank + B.rank - 13) <= Math.max(A.flex, B.flex);
}

/** The plain sum of a pair (a wild card counts as whatever makes 13). */
export function sumOf(G, a, b) {
    const F = G.fight;
    const r = (x) => (x.slot != null ? F.slots[x.slot].rank : cardInfo(F, x.hand).fx.wild ? null : cardInfo(F, x.hand).rank);
    const ra = r(a), rb = r(b);
    return ra == null || rb == null ? 13 : ra + rb;
}

/** Every legal move right now (for the UI's hints, the bot and the tests). */
export function legalMoves(G) {
    const F = G.fight;
    if (!F || G.phase !== 'night') return [];
    const out = [];
    const open = openSlots(F).filter((s) => !s.lock);
    for (let i = 0; i < open.length; i++) {
        if (open[i].rank === 13) out.push({ t: 'solo', slot: open[i].id });
        for (let j = i + 1; j < open.length; j++) if (canPair(G, { slot: open[i].id }, { slot: open[j].id })) out.push({ t: 'pair', a: { slot: open[i].id }, b: { slot: open[j].id } });
    }
    for (const uid of F.hand) {
        const ci = cardInfo(F, uid);
        if (ci.d.junk) continue;
        if (ci.d.trick) { for (const s of open) out.push({ t: 'cut', hand: uid, slot: s.id }); continue; }
        if (ci.rank === 13) out.push({ t: 'solo', hand: uid });
        for (const s of open) if (canPair(G, { hand: uid }, { slot: s.id })) out.push({ t: 'pair', a: { hand: uid }, b: { slot: s.id } });
    }
    if (F.pours < pourLimit(G)) for (const uid of F.hand) out.push({ t: 'pour', hand: uid });
    out.push({ t: 'end' });
    return out;
}
const pourLimit = (G) => RUN.pours + (has(G, 'garden') ? 1 : 0);

function hurt(G, n, why, direct = false) {
    const F = G.fight;
    if (n <= 0) return;
    let left = n;
    if (!direct && F) { const soak = Math.min(F.composure, left); F.composure -= soak; left -= soak; if (soak) G.events.push({ type: 'block', n: soak }); }
    if (left <= 0) return;
    G.resolve = Math.max(0, G.resolve - left);
    G.events.push({ type: 'hurt', n: left, why });
    if (G.resolve <= 0 && !G.over) {
        G.over = true; G.phase = 'over';
        G.events.push({ type: 'over' });
    }
}
const heal = (G, n) => { const was = G.resolve; G.resolve = Math.min(G.maxResolve, G.resolve + n); if (G.resolve > was) G.events.push({ type: 'heal', n: G.resolve - was }); };
const gainTips = (G, n) => { if (n <= 0) return; G.tips += n; G.stats.tipsEarned += n; G.events.push({ type: 'tips', n }); };

/** Use a card from the hand: its effects, then it goes to the discard pile. */
function useCard(G, uid) {
    const F = G.fight, ci = cardInfo(F, uid);
    F.hand.splice(F.hand.indexOf(uid), 1);
    F.discard.push(uid);
    G.events.push({ type: 'use', uid, card: ci.d.id });
    if (ci.d.suit === 'blade') {
        F.blades++; G.notoriety++; G.stats.blades++;
        G.events.push({ type: 'blade', card: ci.d.id, first: G.stats.blades === 1 });
        if (RIVALS[F.rival].traits.warrant) hurt(G, RUN.warrant, 'warrant', true);
    }
    const fx = ci.fx;
    if (fx.block) { F.composure += fx.block; G.events.push({ type: 'composure', n: fx.block }); }
    if (fx.heal) heal(G, fx.heal);
    if (fx.tips) gainTips(G, fx.tips);
    if (fx.soothe) { F.soothe += fx.soothe; G.events.push({ type: 'soothe', n: fx.soothe }); }
    if (fx.streak) F.streak += fx.streak;
    if (fx.unlock) for (const s of F.slots) if (s.lock) { s.lock = 0; G.events.push({ type: 'unlock', slot: s.id }); }
    if (fx.reveal) reveal(G, fx.reveal);
    if (fx.draw) drawCards(G, fx.draw);
    return ci;
}

function reveal(G, n) {
    const F = G.fight;
    const hidden = F.slots.filter((s) => !s.gone && !s.up).sort((a, b) => b.id - a.id);   // nearest the open rows first
    for (const s of hidden.slice(0, n)) { s.up = true; G.events.push({ type: 'flip', slot: s.id }); }
}

/** A rival card is settled: gone from the pyramid. with: the hand card it was paired with, if any. */
function settle(G, id, withCard = null, how = 'pair') {
    const F = G.fight, s = F.slots[id];
    s.gone = true; s.lock = 0;
    F.streak++;
    G.stats.settles++;
    G.events.push({ type: 'settle', slot: id, rank: s.rank, streak: F.streak, how });
    gainTips(G, settleTips(F.streak));
    if (s.bounty) { gainTips(G, RUN.bounty); G.events.push({ type: 'bounty', slot: id }); }
    if (s.taint && how !== 'cut' && !(withCard && withCard.d.suit === 'hearth')) hurt(G, RUN.taint, 'taint', true);
    // anything newly open turns face up
    for (const c of lay(F).slots[id].covers) if (exposed(F, c) && !F.slots[c].up) { F.slots[c].up = true; G.events.push({ type: 'flip', slot: c }); }
}

function checkCleared(G) {
    const F = G.fight;
    if (G.over || !F.slots.every((s) => s.gone)) return false;
    const R = RIVALS[F.rival];
    const reward = (R.boss ? RUN.bossReward : RUN.reward[G.act]) + (has(G, 'sign') ? 5 : 0);
    G.stats.nights++;
    gainTips(G, reward);
    heal(G, RUN.healAfter + (has(G, 'kitchen') ? 5 : 0));
    const canPartner = !!R.partner && F.blades <= R.trust;
    G.won = { rival: F.rival, canPartner, blades: F.blades, reward, rounds: F.round };
    G.phase = 'won';
    G.events.push({ type: 'cleared', rival: F.rival, canPartner, rounds: F.round });
    return true;
}

function endRound(G) {
    const F = G.fight;
    // a grudge you're still holding hurts
    const grudges = F.hand.filter((u) => def(F.cards[u].id).junk).length;
    if (grudges) hurt(G, grudges * RUN.grudge, 'grudge', true);
    if (G.over) return;
    rivalActs(G);
    if (G.over || G.phase !== 'night') return;
    // clean up for the next round
    const keep = F.hand.filter((u) => cardInfo(F, u).fx.retain);
    for (const u of F.hand) if (!keep.includes(u)) F.discard.push(u);
    F.hand = keep;
    F.composure = has(G, 'cellar') ? 2 : 0;
    F.soothe = 0; F.streak = 0; F.pours = 0;
    F.round++;
    nextIntent(G);
    const n = Math.max(1, handSize(G) - F.fluster) - keep.length;
    F.fluster = 0;
    G.events.push({ type: 'round', round: F.round });
    drawCards(G, Math.max(0, n));
}

function rivalActs(G) {
    const F = G.fight, it = F.intent;
    for (const s of F.slots) if (s.lock) { s.lock = 0; G.events.push({ type: 'unlock', slot: s.id }); }
    G.events.push({ type: 'rival', intent: { ...it } });
    const open = () => shuffle(G.rng, openSlots(F));
    switch (it.t) {
        case 'hit': hurt(G, Math.max(0, it.n - F.soothe), 'hit'); break;
        case 'grudge':
            for (let k = 0; k < it.n; k++) {
                const uid = 't' + (++F.tmp);
                F.cards[uid] = { id: 'grudge', up: false };
                F.draw.splice(G.rng.int(0, F.draw.length), 0, uid);
            }
            G.events.push({ type: 'grudge', n: it.n });
            break;
        case 'lock': for (const s of open().slice(0, it.n)) { s.lock = 1; G.events.push({ type: 'lock', slot: s.id }); } break;
        case 'muddle':
            for (const s of open().slice(0, it.n)) { s.rank = G.rng.int(1, 13); G.events.push({ type: 'muddle', slot: s.id, rank: s.rank }); }
            break;
        case 'drain': { const n = Math.min(G.tips, it.n); G.tips -= n; G.events.push({ type: 'drain', n }); break; }
        case 'fluster': F.fluster = 1; G.events.push({ type: 'fluster' }); break;
        case 'restock': {
            const L = lay(F);
            const empty = shuffle(G.rng, L.slots.filter((s) => s.bottom && F.slots[s.id].gone).map((s) => s.id));
            for (const id of empty.slice(0, it.n)) {
                Object.assign(F.slots[id], { gone: false, up: true, rank: G.rng.int(1, 13), lock: 0, taint: false, bounty: false });
                G.events.push({ type: 'restock', slot: id });
            }
            break;
        }
    }
}

// ------------------------------------------------------------------ after a night
function afterNight(G) {
    const R = RIVALS[G.won.rival];
    G.won = null; G.fight = null;
    if (R.final) {
        G.ending = endingFor({ notoriety: G.notoriety, partners: G.partners.length, blades: bladesInDeck(G) });
        G.phase = 'ending'; G.over = true;
        G.events.push({ type: 'ending', ending: G.ending });
        return;
    }
    if (R.boss) { G.act++; G.night = 0; G.events.push({ type: 'act', act: G.act }); } else G.night++;
    setupDay(G);
}

function setupDay(G) {
    const pool = MARKET.slice();
    const offers = [];
    while (offers.length < RUN.market && pool.length) {
        // blades are rarer: the pawnshop only has so many of your old things
        const id = pool.splice(G.rng.int(0, pool.length - 1), 1)[0];
        if (def(id).suit === 'blade' && G.rng() < 0.5) continue;
        offers.push(id);
    }
    const rooms = Object.keys(ROOMS).filter((r) => !G.rooms.includes(r));
    G.day = { offers, room: rooms.length ? G.rng.pick(rooms) : null, chore: null };
    G.phase = 'day';
    G.events.push({ type: 'day' });
}

export const priceOf = (G, id) => def(id).price + (G.act - 1) * 2;

function leaveDay(G) {
    G.day = null;
    const left = INTERLUDES.filter((x) => !G.usedInterludes.includes(x.id));
    if (left.length && G.rng() < RUN.interlude && G.night < 3) {
        const x = G.rng.pick(left);
        G.usedInterludes.push(x.id);
        G.interlude = x.id;
        G.phase = 'interlude';
        G.events.push({ type: 'interlude', id: x.id });
        return;
    }
    dealLetters(G);
}

function interludeFx(G, fx) {
    if (fx.tips > 0) gainTips(G, fx.tips);
    if (fx.tips < 0) G.tips = Math.max(0, G.tips + fx.tips);
    if (fx.notoriety) G.notoriety = Math.max(0, G.notoriety + fx.notoriety);
    if (fx.maxResolve) { G.maxResolve += fx.maxResolve; heal(G, fx.maxResolve); }
    if (fx.heal) heal(G, fx.heal);
    if (fx.card) { const id = fx.card === 'random' ? G.rng.pick(MARKET.filter((m) => def(m).suit !== 'blade')) : fx.card; addCard(G, id); G.events.push({ type: 'gain', card: id }); }
    if (fx.polish) {
        const can = G.deck.filter((c) => !c.up && !def(c.id).junk);
        if (can.length) { const c = G.rng.pick(can); c.up = true; G.events.push({ type: 'polish', uid: c.uid, card: c.id }); }
    }
}

// ------------------------------------------------------------------ the one entry point
const nope = (G, why) => { G.events.push({ type: 'nope', why }); return false; };

export function act(G, cmd) {
    if (!cmd || !cmd.t) return false;
    const F = G.fight;
    switch (G.phase) {
        case 'letters':
            if (cmd.t !== 'host' || !G.letters.includes(cmd.id)) return nope(G, 'letter');
            G.letters = [];
            startFight(G, cmd.id);
            return true;

        case 'night': {
            if (cmd.t === 'pair') {
                if (!canPair(G, cmd.a, cmd.b)) return nope(G, 'pair');
                const handSide = cmd.a.hand ? cmd.a : cmd.b.hand ? cmd.b : null;
                const slotSides = [cmd.a, cmd.b].filter((x) => x.slot != null).map((x) => x.slot);
                const clean = handSide && sumOf(G, cmd.a, cmd.b) === 13;
                const ci = handSide ? useCard(G, handSide.hand) : null;
                if (G.over) return true;
                if (clean) { F.composure += RUN.clean; G.events.push({ type: 'clean', n: RUN.clean }); }
                for (const id of slotSides) { if (!F.slots[id].gone) settle(G, id, ci); if (G.over) return true; }
                G.events.push({ type: 'pair', slots: slotSides, uid: handSide?.hand || null });
                checkCleared(G);
                return true;
            }
            if (cmd.t === 'solo') {
                if (cmd.slot != null) {
                    const s = F.slots[cmd.slot];
                    if (!s || !exposed(F, cmd.slot) || s.lock || s.rank !== 13) return nope(G, 'solo');
                    settle(G, cmd.slot, null, 'king');
                    checkCleared(G);
                    return true;
                }
                if (!F.hand.includes(cmd.hand)) return nope(G, 'solo');
                const ci = cardInfo(F, cmd.hand);
                if (ci.rank !== 13 || ci.d.trick) return nope(G, 'solo');
                useCard(G, cmd.hand);
                return true;
            }
            if (cmd.t === 'cut') {
                if (!F.hand.includes(cmd.hand)) return nope(G, 'cut');
                const ci = cardInfo(F, cmd.hand);
                const s = F.slots[cmd.slot];
                if (!ci.fx.cut || !s || !exposed(F, cmd.slot) || s.lock) return nope(G, 'cut');
                useCard(G, cmd.hand);
                if (G.over) return true;
                settle(G, cmd.slot, ci, 'cut');
                checkCleared(G);
                return true;
            }
            if (cmd.t === 'pour') {
                if (!F.hand.includes(cmd.hand) || F.pours >= pourLimit(G)) return nope(G, 'pour');
                F.pours++;
                F.hand.splice(F.hand.indexOf(cmd.hand), 1);
                const junk = def(F.cards[cmd.hand].id).junk;
                (junk ? F.out : F.discard).push(cmd.hand);
                G.events.push({ type: 'pour', uid: cmd.hand, grudge: !!junk });
                drawCards(G, 1);
                return true;
            }
            if (cmd.t === 'end') { endRound(G); return true; }
            return nope(G, 'night');
        }

        case 'won': {
            const R = RIVALS[G.won.rival];
            if (cmd.t === 'partner') {
                if (!G.won.canPartner) return nope(G, 'trust');
                const c = addCard(G, R.partner);
                G.partners.push(R.id);
                G.events.push({ type: 'partner', rival: R.id, uid: c.uid, card: R.partner });
            } else if (cmd.t === 'farewell') {
                gainTips(G, RUN.farewell.tips);
                heal(G, RUN.farewell.heal);
                if (R.partner && !G.won.canPartner) G.stats.refused++;
                G.events.push({ type: 'farewell', rival: R.id, refused: !!R.partner && !G.won.canPartner });
            } else return nope(G, 'won');
            afterNight(G);
            return true;
        }

        case 'day': {
            const D = G.day;
            if (cmd.t === 'buy') {
                const id = D.offers[cmd.i];
                if (!id || G.tips < priceOf(G, id)) return nope(G, 'buy');
                G.tips -= priceOf(G, id);
                const c = addCard(G, id);
                D.offers[cmd.i] = null;
                G.events.push({ type: 'bought', card: id, uid: c.uid });
                return true;
            }
            if (cmd.t === 'room') {
                const R = D.room && ROOMS[D.room];
                if (!R || G.tips < R.price) return nope(G, 'room');
                G.tips -= R.price;
                G.rooms.push(R.id);
                D.room = null;
                if (R.id === 'fireplace') { G.maxResolve += 10; heal(G, 10); }
                G.events.push({ type: 'built', room: R.id });
                return true;
            }
            if (cmd.t === 'chore') {
                if (D.chore) return nope(G, 'chore');
                if (cmd.kind === 'rest') { heal(G, Math.round(G.maxResolve * RUN.rest)); }
                else if (cmd.kind === 'polish') {
                    const c = G.deck.find((x) => x.uid === cmd.uid);
                    if (!c || c.up || def(c.id).junk) return nope(G, 'polish');
                    c.up = true;
                    G.events.push({ type: 'polish', uid: c.uid, card: c.id });
                } else if (cmd.kind === 'letgo') {
                    const i = G.deck.findIndex((x) => x.uid === cmd.uid);
                    if (i < 0 || G.deck.length <= RUN.minDeck) return nope(G, 'letgo');
                    const [c] = G.deck.splice(i, 1);
                    const blade = def(c.id).suit === 'blade';
                    if (blade) G.notoriety = Math.max(0, G.notoriety - 1);
                    G.events.push({ type: 'letgo', card: c.id, blade });
                } else return nope(G, 'chore');
                D.chore = cmd.kind;
                return true;
            }
            if (cmd.t === 'leave') { leaveDay(G); return true; }
            return nope(G, 'day');
        }

        case 'interlude': {
            const X = INTERLUDES.find((x) => x.id === G.interlude);
            const o = X?.options[cmd.i];
            if (cmd.t !== 'choose' || !o) return nope(G, 'interlude');
            interludeFx(G, o.fx);
            G.events.push({ type: 'chose', id: X.id, i: cmd.i, result: o.result });
            G.interlude = null;
            dealLetters(G);
            return true;
        }
    }
    return nope(G, 'phase');
}

/** The turn-based sim has no clock; step() exists for the shared loop and does nothing. */
export function step() { /* turn-based */ }

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
