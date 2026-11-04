// One fight: the alien table (TriPeaks), your stock and the beam, chains, gadgets and the creature's turn.
// Pure. Every change pushes an event carrying a snapshot (e.s) of the numbers the HUD shows, so the
// view can play a resolved turn back blow by blow without reading G ahead of the picture.

import { CHARGE_MAX, DRAWS_PER_TURN, SCALE, SWEEP } from '../config.js';
import { CARDS, ENEMIES, GADGETS, LAYOUTS, SUITS } from './data.js';

// ------------------------------------------------------------------ helpers
export const hasRelic = (G, k) => G.relics.includes(k);
export const rankFits = (a, b) => { const d = Math.abs(a - b); return d === 1 || d === 12; };

export function cardFx(card) {
    const d = CARDS[card.k];
    return (card.up ? d.up : d.fx) || {};
}
export const isWild = (card) => !!CARDS[card.k]?.wild && card.src !== 'tab';
export const isStatic = (card) => !!CARDS[card.k]?.static && card.src !== 'tab';

function snap(G) {
    const B = G.battle;
    const s = { hp: G.hp, maxHp: G.maxHp, bucks: G.bucks };
    if (B) Object.assign(s, { block: B.block, charge: B.charge, draws: B.draws, chain: B.chainBase + B.plays, ehp: B.enemy.hp, emax: B.enemy.maxHp, eblock: B.enemy.block, estr: B.enemy.str, eweak: B.enemy.weak, stock: B.stock.length, disc: B.discard.length, wild: B.wildBeam, xray: B.xray, intent: B.enemy.intent ? intentInfo(B) : null });
    return s;
}
/** Push an event with a snapshot of the HUD numbers as e.s (so no event may use `s` for anything else). */
export function emit(G, e) { e.s = snap(G); G.events.push(e); }

/** Can this table card go on the beam right now? */
export function fits(B, c) {
    const beam = B.beam;
    if (!beam) return true;
    if (B.wildBeam) return true;
    if (beam.src !== 'tab' && CARDS[beam.k]?.static) return false;
    if (beam.src !== 'tab' && CARDS[beam.k]?.wild) return true;
    return rankFits(beam.r, c.r);
}
export function covered(B, c) {
    for (const o of B.tab) if (o.row === c.row + 1 && Math.abs(o.col - c.col) <= 1) return true;
    return false;
}
export const playable = (B, c) => c.up && !c.frozen && fits(B, c);
export const playableCards = (B) => B.tab.filter((c) => playable(B, c));

/** One hit of a move: its base scaled for the reel, plus strength, less a quarter when Dazed. */
export const hitFor = (e, n) => Math.max(0, Math.floor((Math.round(n * (e.dmul || 1)) + e.str) * (e.weak > 0 ? 0.75 : 1)));

/** The creature's next move with its numbers worked out (strength, Dazed), for the intent badge. */
export function intentInfo(B) {
    const e = B.enemy;
    if (e.stun) return { t: 'stun' };
    const m = e.intent;
    const hit = (n) => hitFor(e, n);
    const out = { ...m };
    if (m.n != null) out.dmg = hit(m.n);
    return out;
}

function standardDeck(G) {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
    return G.rng.shuffle(d);
}

// ------------------------------------------------------------------ setup
export function startBattle(G, key) {
    const def = ENEMIES[key];
    const tier = def.boss ? 'boss' : def.elite ? 'elite' : 'fight';
    const [hm, dm] = (SCALE[G.act] || SCALE[SCALE.length - 1])[tier];
    let hp = Math.round(G.rng.int(def.hp[0], def.hp[1]) * hm);
    if (hasRelic(G, 'saucer_shard')) hp = Math.round(hp * 0.9);
    const rankOf = (c) => (c.k === 'plain' ? c.r : c.k === 'slime' ? G.rng.int(1, 13) : CARDS[c.k].r);
    const stock = G.deck.map((c) => ({ ...c, r: rankOf(c), s: c.s ?? -1, src: 'deck' }));
    G.rng.shuffle(stock);
    const B = {
        key, tier,
        enemy: { k: key, hp, maxHp: hp, block: 0, str: 0, dmul: dm, weak: 0, stun: false, step: def.boss ? 0 : G.rng.int(0, def.moves.length - 1), intent: null },
        layout: def.layout, edeck: standardDeck(G), tab: [], nextId: 1, deals: 0,
        stock, discard: [], beam: null, wildBeam: false,
        plays: 0, chainBase: 0, rayBonus: 0, turn: 1, atomThisTurn: 0, badgeUsed: false,
        block: hasRelic(G, 'lead_apron') ? 8 : 0,
        charge: hasRelic(G, 'rabbit_foot') ? 2 : 0,
        draws: DRAWS_PER_TURN + (hasRelic(G, 'wristwatch') ? 1 : 0),
        xray: false, done: false, won: false,
        stats: { best: 0, sweeps: 0 },
    };
    if (hasRelic(G, 'lucky_dice')) B.chainBase = 1;
    B.enemy.intent = def.moves[B.enemy.step % def.moves.length];
    G.battle = B;
    emit(G, { type: 'battle', key, tier: B.tier });
    deal(G, B);
    turnCard(G, B);
    return B;
}

function deal(G, B) {
    const L = LAYOUTS[B.layout];
    B.tab = [];
    L.forEach((cols, row) => {
        for (const col of cols) {
            if (!B.edeck.length) B.edeck = standardDeck(G);
            const c = B.edeck.pop();
            B.tab.push({ id: B.nextId++, r: c.r, s: c.s, row, col, up: false, frozen: false });
        }
    });
    B.deals++;
    refresh(G, B, false);
    emit(G, { type: 'deal', n: B.tab.length, layout: B.layout, cards: B.tab.map((c) => ({ ...c })) });
}

/** Turn up every card nothing covers any more. */
function refresh(G, B, announce = true) {
    for (const c of B.tab) {
        if (!c.up && !covered(B, c)) {
            c.up = true;
            if (announce) emit(G, { type: 'flip', id: c.id, r: c.r, suit: c.s });
        }
    }
}

// ------------------------------------------------------------------ damage and block
function hitEnemy(G, B, n, { pierce = false, src = 'card' } = {}) {
    const e = B.enemy;
    let dmg = Math.max(0, Math.round(n));
    let blocked = 0;
    if (!pierce && e.block > 0) { blocked = Math.min(e.block, dmg); e.block -= blocked; dmg -= blocked; }
    e.hp = Math.max(0, e.hp - dmg);
    G.stats.dmg += dmg;
    emit(G, { type: 'hit', who: 'enemy', n: dmg, blocked, src });
    return dmg;
}

function hitPlayer(G, B, n, src = 'enemy') {
    let dmg = Math.max(0, Math.round(n));
    let blocked = 0;
    if (B && B.block > 0) { blocked = Math.min(B.block, dmg); B.block -= blocked; dmg -= blocked; }
    G.hp = Math.max(0, G.hp - dmg);
    G.stats.taken += dmg;
    emit(G, { type: 'hit', who: 'player', n: dmg, blocked, src });
    return dmg;
}
export { hitPlayer };

function gainBlock(G, B, n) { if (n <= 0) return; B.block += n; emit(G, { type: 'block', who: 'player', n }); }
function gainCharge(G, B, n) {
    if (n <= 0) return;
    const was = B.charge;
    B.charge = Math.min(CHARGE_MAX, B.charge + n);
    if (B.charge > was) emit(G, { type: 'charge', n: B.charge - was });
}
function heal(G, n) {
    const was = G.hp;
    G.hp = Math.min(G.maxHp, G.hp + n);
    if (G.hp > was) emit(G, { type: 'heal', who: 'player', n: G.hp - was });
}

/** Battle over? Then mark it and tell the caller to stop. */
function checkEnd(G, B) {
    if (B.done) return true;
    if (B.enemy.hp <= 0) {
        B.done = true; B.won = true;
        emit(G, { type: 'defeat', key: B.key, tier: B.tier });
        return true;
    }
    if (G.hp <= 0) {
        B.done = true; B.won = false;
        emit(G, { type: 'dead', key: B.key });
        return true;
    }
    return false;
}

// ------------------------------------------------------------------ the effect of a stock card
function applyFx(G, B, card) {
    const fx = cardFx(card);
    if (fx.selfDmg) hitPlayer(G, B, fx.selfDmg, 'slime');
    if (fx.dmg) for (let i = 0; i < (fx.hits || 1); i++) { hitEnemy(G, B, fx.dmg, { src: card.k }); if (B.enemy.hp <= 0) break; }
    if (fx.block) gainBlock(G, B, fx.block);
    if (fx.charge) gainCharge(G, B, fx.charge);
    if (fx.heal) heal(G, fx.heal);
    if (fx.weak) { B.enemy.weak += fx.weak; emit(G, { type: 'status', what: 'weak', n: fx.weak }); }
    if (fx.strDown) { B.enemy.str -= fx.strDown; emit(G, { type: 'status', what: 'shrink', n: fx.strDown }); }
    if (fx.reveal && !B.xray) { B.xray = true; emit(G, { type: 'status', what: 'xray' }); }
    if (fx.rayBonus) { B.rayBonus += fx.rayBonus; emit(G, { type: 'status', what: 'boost', n: fx.rayBonus }); }
    if (fx.chainBase) { B.chainBase += fx.chainBase; emit(G, { type: 'status', what: 'chain', n: fx.chainBase }); }
}

/** The beam card is covered: your own cards go to the discard, jammed junk burns up. */
function retireBeam(B) {
    if (B.beam && B.beam.src !== 'tab' && !B.beam.temp) B.discard.push(B.beam);
}

// ------------------------------------------------------------------ player commands
/** Play a face-up, uncovered table card onto the beam. */
export function playCard(G, id) {
    const B = G.battle;
    if (!B || B.done) return false;
    const i = B.tab.findIndex((c) => c.id === id);
    if (i < 0 || !playable(B, B.tab[i])) return false;
    const c = B.tab[i];
    B.tab.splice(i, 1);
    retireBeam(B);
    B.beam = { r: c.r, s: c.s, src: 'tab', id: c.id };
    B.wildBeam = false;
    B.plays++;
    const chain = B.chainBase + B.plays;
    B.stats.best = Math.max(B.stats.best, B.plays);
    G.stats.bestChain = Math.max(G.stats.bestChain, B.plays);
    G.stats.played++;
    emit(G, { type: 'play', id: c.id, r: c.r, suit: c.s, chain, row: c.row, col: c.col });
    const suit = SUITS[c.s].k;
    if (suit === 'ray') hitEnemy(G, B, 2 + chain + B.rayBonus + (hasRelic(G, 'ray_lens') ? 1 : 0), { src: 'ray' });
    else if (suit === 'rocket') hitEnemy(G, B, 1 + chain + B.rayBonus + (hasRelic(G, 'rocket_fins') ? 1 : 0), { pierce: true, src: 'rocket' });
    else if (suit === 'shield') gainBlock(G, B, 2 + chain + (hasRelic(G, 'tin_shield') ? 1 : 0));
    else if (suit === 'atom') {
        let n = B.plays >= 4 ? 2 : 1;
        if (B.atomThisTurn === 0 && hasRelic(G, 'slide_rule')) n++;
        B.atomThisTurn++;
        gainCharge(G, B, n);
    }
    if (hasRelic(G, 'pocket_robot') && B.plays % 5 === 0) gainCharge(G, B, 2);
    if (hasRelic(G, 'sheriff_badge') && B.plays >= 6 && !B.badgeUsed) { B.badgeUsed = true; gainBlock(G, B, 6); }
    if (checkEnd(G, B)) return true;
    afterTableChange(G, B);
    return true;
}

function afterTableChange(G, B) {
    refresh(G, B);
    if (B.tab.length === 0) {
        B.stats.sweeps++;
        G.stats.sweeps++;
        emit(G, { type: 'sweep' });
        hitEnemy(G, B, hasRelic(G, 'moon_rock') ? SWEEP.big : SWEEP.dmg, { src: 'sweep' });
        if (checkEnd(G, B)) return;
        deal(G, B);
    }
}

/** Turn the top of the stock onto the beam. Returns the card, or null with nothing left to draw. */
function flipStock(G, B) {
    if (!B.stock.length && B.discard.length) {
        B.stock = G.rng.shuffle(B.discard.splice(0));
        emit(G, { type: 'reshuffle', n: B.stock.length });
    }
    if (!B.stock.length) return null;
    const card = B.stock.pop();
    retireBeam(B);
    B.beam = card;
    B.wildBeam = false;
    return card;
}

/** The free card that starts every turn. */
function turnCard(G, B) {
    const card = flipStock(G, B);
    if (!card) return;
    emit(G, { type: 'draw', card: { ...card }, quick: true, free: true });
    applyFx(G, B, card);
}

/** Spend a draw on the next stock card (a Quick card gives the draw back). */
export function drawCard(G, { free = false } = {}) {
    const B = G.battle;
    if (!B || B.done) return false;
    if (!free && B.draws <= 0) return false;
    if (!B.stock.length && !B.discard.length) return false;
    const card = flipStock(G, B);
    const quick = free || !!cardFx(card).quick;
    if (!quick) B.draws--;
    G.stats.draws++;
    emit(G, { type: 'draw', card: { ...card }, quick });
    applyFx(G, B, card);
    checkEnd(G, B);
    return true;
}

/** End the turn: the creature makes its move, then a new turn turns over a fresh beam card. */
export function endTurn(G) {
    const B = G.battle;
    if (!B || B.done) return false;
    emit(G, { type: 'endTurn' });
    enemyTurn(G, B);
    if (checkEnd(G, B)) return true;
    newTurn(G, B);
    turnCard(G, B);
    checkEnd(G, B);
    return true;
}

/** Spend charge on a gadget. target is a table card id for the Disintegrator. */
export function useGadget(G, i, target = null) {
    const B = G.battle;
    if (!B || B.done) return false;
    const k = G.gadgets[i];
    const def = GADGETS[k];
    if (!def || B.charge < def.cost) return false;
    const fx = def.fx;
    let tc = null;
    if (def.target) {
        tc = B.tab.find((c) => c.id === target);
        if (!tc || !tc.up) return false;
    }
    if (fx.wildBeam && (B.wildBeam || (B.beam && isWild(B.beam)))) return false;
    if (fx.stun && B.enemy.stun) return false;
    if (fx.reveal && B.xray) return false;
    if (fx.freeDraw && !B.stock.length && !B.discard.length) return false;
    if (fx.thaw && !B.tab.some((c) => c.frozen) && fx.block == null) return false;
    B.charge -= def.cost;
    G.stats.gadgets++;
    emit(G, { type: 'gadget', k, i, target });
    if (fx.dmg) hitEnemy(G, B, fx.dmg, { src: k });
    if (fx.block) gainBlock(G, B, fx.block);
    if (fx.wildBeam) { B.wildBeam = true; emit(G, { type: 'status', what: 'wild' }); }
    if (fx.weak) { B.enemy.weak += fx.weak; emit(G, { type: 'status', what: 'weak', n: fx.weak }); }
    if (fx.stun) { B.enemy.stun = true; emit(G, { type: 'status', what: 'stun' }); }
    if (fx.reveal) { B.xray = true; emit(G, { type: 'status', what: 'xray' }); }
    if (fx.thaw) { for (const c of B.tab) c.frozen = false; emit(G, { type: 'status', what: 'thaw' }); }
    if (checkEnd(G, B)) return true;
    if (fx.vaporize) {
        B.tab.splice(B.tab.indexOf(tc), 1);
        emit(G, { type: 'vaporize', id: tc.id });
        afterTableChange(G, B);
        if (checkEnd(G, B)) return true;
    }
    if (fx.freeDraw) return drawCard(G, { free: true });
    return true;
}

// ------------------------------------------------------------------ the creature's turn
function enemyTurn(G, B) {
    const e = B.enemy;
    const def = ENEMIES[B.key];
    e.block = 0;
    if (B.tab.some((c) => c.frozen)) { for (const c of B.tab) c.frozen = false; emit(G, { type: 'thaw' }); }
    if (e.stun) {
        e.stun = false;
        emit(G, { type: 'stunned' });
    } else {
        const m = e.intent;
        const dmg = (n) => hitFor(e, n);
        emit(G, { type: 'enemyMove', move: m.t });
        switch (m.t) {
            case 'atk':
                for (let h = 0; h < (m.hits || 1); h++) { hitPlayer(G, B, dmg(m.n)); if (G.hp <= 0) break; }
                break;
            case 'atkblock':
                hitPlayer(G, B, dmg(m.n));
                e.block += m.b; emit(G, { type: 'block', who: 'enemy', n: m.b });
                break;
            case 'block':
                e.block += m.n; emit(G, { type: 'block', who: 'enemy', n: m.n });
                break;
            case 'buff':
                e.str += m.str; emit(G, { type: 'status', what: 'grow', n: m.str });
                if (m.block) { e.block += m.block; emit(G, { type: 'block', who: 'enemy', n: m.block }); }
                break;
            case 'jam': {
                if (m.n) hitPlayer(G, B, dmg(m.n));
                if (G.hp <= 0) break;
                if (m.junk === 'static' && hasRelic(G, 'tinfoil_hat')) { emit(G, { type: 'status', what: 'tinfoil' }); break; }
                for (let j = 0; j < m.count; j++) {
                    const card = { uid: -1, k: m.junk, r: m.junk === 'slime' ? G.rng.int(1, 13) : 0, s: -1, src: 'deck', temp: true };
                    B.stock.splice(G.rng.int(0, B.stock.length), 0, card);
                }
                emit(G, { type: 'jam', junk: m.junk, count: m.count });
                break;
            }
            case 'freeze': {
                if (m.n) hitPlayer(G, B, dmg(m.n));
                if (G.hp <= 0) break;
                const ups = B.tab.filter((c) => c.up && !c.frozen);
                G.rng.shuffle(ups);
                const got = ups.slice(0, m.count);
                for (const c of got) c.frozen = true;
                emit(G, { type: 'freeze', ids: got.map((c) => c.id) });
                break;
            }
            case 'drain': {
                const got = hitPlayer(G, B, dmg(m.n));
                const was = e.hp;
                e.hp = Math.min(e.maxHp, e.hp + got);
                if (e.hp > was) emit(G, { type: 'heal', who: 'enemy', n: e.hp - was });
                break;
            }
            case 'wind':
                emit(G, { type: 'status', what: 'wind' });
                break;
        }
    }
    if (e.weak > 0) e.weak--;
    e.step++;
    e.intent = def.moves[e.step % def.moves.length];
}

function newTurn(G, B) {
    B.turn++;
    B.block = 0;
    B.plays = 0;
    B.chainBase = hasRelic(G, 'lucky_dice') ? 1 : 0;
    B.rayBonus = 0;
    B.atomThisTurn = 0;
    B.badgeUsed = false;
    B.draws = DRAWS_PER_TURN;
    emit(G, { type: 'turn', turn: B.turn });
    if (hasRelic(G, 'atomic_coffee')) gainCharge(G, B, 1);
}
