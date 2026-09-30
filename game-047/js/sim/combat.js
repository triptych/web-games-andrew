/**
 * combat.js — poker-solitaire combat. Pure and seeded.
 *
 * The player places cards from their hand onto a 5×5 table. Whenever a row,
 * column or diagonal fills it is scored as a poker hand and fires: chips flow
 * into their suit's channel (Blades → damage, Staves → damage to all, Coins →
 * Ward, Hearts → healing), every channel multiplied by the hand's mult. Then
 * the line's cards go to the discard pile.
 *
 * Every public function mutates `st` and pushes events onto st.events, which
 * the view drains to animate. The simulation is always already "done"; the
 * view plays catch-up.
 */

import { makeRng } from './rng.js';
import {
    GRID, HAND_SIZE, MAX_HAND, DEALS, REDRAWS, HANDS, SUIT_INFO,
    CROSS_MULT, DIAG_MULT, WEAK_MULT, EXPOSED_MULT, rankChips,
} from './rules.js';
import { evaluate, majoritySuit } from './poker.js';
import { ARCANA, cardChips, jokerCard, ashCard, arcanaCost } from './cards.js';
import { makeEnemy, passiveInfo } from './monsters.js';
import { healAmt } from './relics.js';

// ------------------------------------------------------------------ geometry

export const LINES = (() => {
    const out = [];
    for (let r = 0; r < GRID; r++) out.push({ id: `r${r}`, kind: 'row', cells: [0, 1, 2, 3, 4].map((c) => r * GRID + c) });
    for (let c = 0; c < GRID; c++) out.push({ id: `c${c}`, kind: 'col', cells: [0, 1, 2, 3, 4].map((r) => r * GRID + c) });
    out.push({ id: 'd0', kind: 'diag', cells: [0, 6, 12, 18, 24] });
    out.push({ id: 'd1', kind: 'diag', cells: [4, 8, 12, 16, 20] });
    return out;
})();
const LINES_BY_CELL = Array.from({ length: GRID * GRID }, (_, i) => LINES.filter((l) => l.cells.includes(i)));

// ------------------------------------------------------------------ setup

/**
 * @param o.deck      array of card objects (copied)
 * @param o.relics    array of relic ids
 * @param o.hp/maxHp  player health
 * @param o.elixirs   array (null = empty slot), mutated in place by useElixir
 * @param o.species   list of species (from monsters.encounterFor)
 * @param o.world/floor/kind
 * @param o.seed      combat seed
 * @param o.gold      the player's gold (Mammon can tax it)
 */
export function createCombat(o) {
    const rng = makeRng(o.seed);
    const relics = new Set(o.relics);
    const st = {
        rng, relics, world: o.world, floor: o.floor, kind: o.kind,
        player: { hp: o.hp, maxHp: o.maxHp, ward: 0, st: { might: 0, weak: 0, exposed: 0, burn: 0, regen: 0 } },
        enemies: [],
        draw: [], hand: [], discard: [], exhaust: [],
        board: Array.from({ length: GRID * GRID }, () => ({ card: null, seal: 0, frost: 0 })),
        turn: 0, deals: 0, redraws: 0, phase: 'player',
        handSize: HAND_SIZE + (relics.has('pockets') ? 1 : 0) + (relics.has('crownMirage') ? 1 : 0),
        dealsMax: DEALS + (relics.has('quickHand') ? 1 : 0),
        redrawsMax: REDRAWS + (relics.has('hourglass') ? 1 : 0) + (relics.has('loadedDie') ? 1 : 0) + (relics.has('crownMirage') ? 1 : 0),
        favour: 0, luck: 0, firedAny: false, oathUsed: false,
        gold: o.gold ?? 0, goldGained: 0, goldLost: 0,
        elixirs: o.elixirs ?? [],
        shattered: [], relicsLost: [],
        nextEid: 1, tempUid: 1_000_000,
        target: 0,
        events: [],
        stats: { lines: 0, crosses: 0, bestHand: null, dmg: 0, hands: {}, turns: 0 },
    };

    // deck → draw pile (copies, so combat-only changes never touch the run deck)
    st.draw = o.deck.map((c) => ({ ...c }));
    rng.shuffle(st.draw);

    for (const sp of o.species) addEnemy(st, makeEnemy(sp, o.world, o.floor, rng));

    // start-of-combat relics
    const p = st.player;
    if (relics.has('regenMoss')) p.st.regen += 4;
    if (relics.has('whalebone')) p.st.might += 1;
    if (o.might) p.st.might += o.might;
    for (const e of st.enemies) {
        if (relics.has('warhorn')) e.st.exposed += 2;
        if (relics.has('veil')) e.st.weak += 2;
    }
    if (relics.has('crownJoker')) st.hand.push(jokerCard(st.tempUid++, true));

    for (const e of st.enemies) rollIntent(st, e);
    emit(st, 'combatStart', { enemies: st.enemies.map((e) => e.eid) });
    startTurn(st, true);
    return st;
}

function addEnemy(st, e) {
    e.eid = st.nextEid++;
    st.enemies.push(e);
    return e;
}

export function emit(st, type, data = {}) {
    st.events.push({ type, ...data });
    if (st.events.length > 3000) st.events.splice(0, st.events.length - 3000);
}

// ------------------------------------------------------------------ queries

export const alive = (st) => st.enemies.filter((e) => e.alive);
export const enemyByEid = (st, eid) => st.enemies.find((e) => e.eid === eid);

export function currentTarget(st) {
    const al = alive(st);
    if (!al.length) return null;
    const t = st.enemies.find((e) => e.eid === st.target && e.alive);
    return t ?? al[0];
}

export function setTarget(st, eid) {
    const e = enemyByEid(st, eid);
    if (e && e.alive) { st.target = eid; emit(st, 'target', { eid }); return true; }
    return false;
}

export function arcScale(st) { return 1 + 0.3 * st.world; }

export function effectiveCost(st, c) {
    if (c.kind !== 'arcana') return 1;
    if (st.relics.has('philosopher') && st.turn === 1) return 0;
    return arcanaCost(c);
}

export function canPlace(st, cell) {
    const b = st.board[cell];
    return b && !b.card && b.seal <= 0;
}

export function cardsOnTable(st) {
    return st.board.reduce((n, b) => n + (b.card ? 1 : 0), 0);
}

// ------------------------------------------------------------------ drawing

function drawOne(st) {
    if (st.hand.length >= MAX_HAND) return null;
    if (!st.draw.length) {
        if (!st.discard.length) return null;
        st.draw = st.discard;
        st.discard = [];
        st.rng.shuffle(st.draw);
        emit(st, 'reshuffle', { n: st.draw.length });
    }
    const c = st.draw.pop();
    st.hand.push(c);
    emit(st, 'draw', { uid: c.uid });
    return c;
}

export function drawN(st, n) {
    for (let i = 0; i < n; i++) if (!drawOne(st)) break;
}

function toDiscard(st, c) {
    if (c.temp) { emit(st, 'vanish', { uid: c.uid }); return; }
    st.discard.push(c);
}

// ------------------------------------------------------------------ turns

function startTurn(st, first = false) {
    const p = st.player;
    st.turn++;
    st.stats.turns = st.turn;
    p.ward = 0;
    if (st.relics.has('stoneskin')) p.ward += 4;
    if (st.relics.has('crownRime')) p.ward += 6;
    if (first && st.relics.has('bastion')) p.ward += 10;
    if (p.ward) emit(st, 'ward', { who: 'player', n: p.ward, total: p.ward });

    if (p.st.burn > 0) {
        loseHp(st, p.st.burn, 'burn');
        p.st.burn--;
        if (st.phase === 'lost') return;
    }
    if (p.st.regen > 0) { healPlayer(st, p.st.regen, 'regen'); p.st.regen--; }

    for (let i = 0; i < st.board.length; i++) {
        const b = st.board[i];
        if (b.seal > 0 && --b.seal === 0) emit(st, 'unseal', { cell: i });
        if (b.frost > 0 && --b.frost === 0) emit(st, 'thaw', { cell: i });
    }

    st.deals = st.dealsMax + (st.turn === 1 ? (st.relics.has('lantern') ? 1 : 0) + (st.relics.has('crownAsh') ? 1 : 0) : 0);
    st.redraws = st.redrawsMax;
    st.favour = 0;
    st.oathUsed = false;
    st.phase = 'player';
    emit(st, 'turnStart', { turn: st.turn });
    drawN(st, Math.max(0, st.handSize - st.hand.length));
}

export function endTurn(st) {
    if (st.phase !== 'player') return false;
    st.phase = 'enemy';
    emit(st, 'turnEnd', { turn: st.turn });
    enemyTurn(st);
    if (st.phase === 'enemy') startTurn(st);
    return true;
}

function enemyTurn(st) {
    const p = st.player;
    const pre = { weak: p.st.weak, exposed: p.st.exposed };
    for (const e of [...st.enemies]) {
        if (!e.alive || st.phase !== 'enemy') continue;
        e.ward = 0;
        if (e.armored) { e.ward += e.armored; emit(st, 'ward', { who: e.eid, n: e.armored, total: e.ward }); }
        if (e.st.burn > 0) {
            damageEnemy(st, e, e.st.burn, 'burn');
            e.st.burn--;
            if (!e.alive || st.phase !== 'enemy') continue;
        }
        if (e.passive === 'regen') healEnemy(st, e, Math.round(e.maxHp * 0.06));
        if (e.st.regen > 0) { healEnemy(st, e, e.st.regen); e.st.regen--; }
        if (e.passive === 'enrage') { e.st.might += 1; emit(st, 'status', { who: e.eid, key: 'might', v: e.st.might }); }
        emit(st, 'enemyAct', { eid: e.eid, move: e.intent?.name ?? '', t: e.intent?.t ?? 'none' });
        executeMove(st, e, e.intent);
        e.hist.push(e.intent);
        if (e.hist.length > 4) e.hist.shift();
    }
    if (st.phase !== 'enemy') return;
    // end of round: debuffs tick down
    if (pre.weak > 0) p.st.weak = Math.max(0, p.st.weak - 1);
    if (pre.exposed > 0) p.st.exposed = Math.max(0, p.st.exposed - 1);
    for (const e of alive(st)) {
        if (e.st.weak > 0) e.st.weak--;
        if (e.st.exposed > 0) e.st.exposed--;
    }
    for (const e of alive(st)) rollIntent(st, e);
    emit(st, 'intents', {});
}

// ------------------------------------------------------------------ intents

function moveValid(st, e, mv) {
    if (!mv) return false;
    if (mv.t === 'summon') return alive(st).length < 5 && !!e.minionSpecies;
    if (mv.t === 'healAlly') return alive(st).some((a) => a.hp < a.maxHp * 0.75);
    return true;
}

export function rollIntent(st, e) {
    const rng = st.rng;
    let mv = null;
    e.charged = false;
    if (e.seq) {
        for (let tries = 0; tries < e.seq.length; tries++) {
            const cand = e.moves[e.seq[e.seqI % e.seq.length]];
            e.seqI++;
            if (moveValid(st, e, cand)) { mv = cand; break; }
        }
    } else {
        const last = e.hist[e.hist.length - 1], last2 = e.hist[e.hist.length - 2];
        const opts = e.moves.filter((m2) => moveValid(st, e, m2) && !(m2 === last && m2 === last2));
        const pool = opts.length ? opts : e.moves;
        let total = 0;
        for (const m2 of pool) total += m2.wt ?? 1;
        let r = rng.next() * total;
        for (const m2 of pool) { r -= m2.wt ?? 1; if (r <= 0) { mv = m2; break; } }
        mv = mv ?? pool[0];
    }
    e.intent = mv ?? e.moves[0];
}

/** How an intent reads to the player: icon kind, numbers with modifiers applied. */
export function intentInfo(st, e) {
    const mv = e.intent;
    if (!mv || !e.alive) return null;
    const dmg = mv.dmg ? attackDamage(st, e, mv.dmg) : 0;
    const hits = mv.hits ?? (mv.dmg ? 1 : 0);
    const curse = ['seal', 'ash', 'steal', 'scramble', 'frost', 'flood', 'void', 'mirage'];
    let kind = 'unknown', text = '';
    switch (mv.t) {
        case 'attack': kind = 'attack'; text = `Attacks for ${dmg}.`; break;
        case 'multi': kind = 'attack'; text = `Attacks ${hits} times for ${dmg}.`; break;
        case 'attackDebuff': kind = 'attackDebuff'; text = `Attacks for ${dmg} and applies ${mv.n} ${stName(mv.st)}.`; break;
        case 'drain': kind = 'attack'; text = `Attacks for ${dmg} and heals ${mv.heal}.`; break;
        case 'tax': kind = 'attack'; text = `Attacks for ${dmg} and takes ${mv.gold} gold.`; break;
        case 'ward': kind = 'defend'; text = `Gains ${mv.n} Ward.`; break;
        case 'guard': kind = 'defend'; text = `Gives every ally ${mv.n} Ward.`; break;
        case 'buff': kind = 'buff'; text = `Gains ${mv.might} Might${mv.heal ? ` and heals ${mv.heal}` : ''}.`; break;
        case 'enrage': kind = 'buff'; text = `Gains ${mv.might} Might.`; break;
        case 'debuff': kind = 'debuff'; text = `Applies ${mv.n} ${stName(mv.st)}${mv.also ? ` and ${mv.n} ${stName(mv.also)}` : ''}.`; break;
        case 'healAlly': kind = 'heal'; text = `Heals an ally for ${mv.n}.`; break;
        case 'summon': kind = 'summon'; text = 'Summons help.'; break;
        case 'charge': kind = 'charge'; text = 'Is gathering its strength…'; break;
        case 'seal': kind = 'curse'; text = `Seals ${mv.cells} empty cell${mv.cells > 1 ? 's' : ''} for ${mv.turns} turn${mv.turns > 1 ? 's' : ''}.`; break;
        case 'ash': kind = 'curse'; text = `Shuffles ${mv.n} Ash into your discard pile${mv.seal ? ` and seals ${mv.seal} cells` : ''}.`; break;
        case 'steal': kind = mv.dmg ? 'attack' : 'curse'; text = `Steals your best table card${mv.heal ? ` and heals ${mv.heal}` : ''}${mv.dmg ? `, then attacks for ${dmg}` : ''}.`; break;
        case 'scramble': kind = 'curse'; text = `Scrambles ${mv.rows} row${mv.rows > 1 ? 's' : ''} of the table.`; break;
        case 'frost': kind = mv.dmg ? 'attack' : 'curse'; text = `Frosts ${mv.cells} cells (0 chips for 2 turns)${mv.dmg ? ` and attacks for ${dmg}` : ''}.`; break;
        case 'flood': kind = 'curse'; text = `The tide washes away row ${tideRow(e) + 1} without scoring it.`; break;
        case 'void': kind = 'curse'; text = `The void erases column ${voidCol(e) + 1} without scoring it.`; break;
        case 'mirage': kind = 'curse'; text = `Changes the suits of ${mv.n} table cards.`; break;
        default: break;
    }
    return { kind, name: mv.name, dmg, hits, text, curse: curse.includes(mv.t) };
}

export function stName(k) {
    return { weak: 'Weak', exposed: 'Exposed', burn: 'Burn', regen: 'Regen', might: 'Might' }[k] ?? k;
}

function attackDamage(st, e, base) {
    let d = base + e.st.might;
    if (e.st.weak > 0) d *= WEAK_MULT;
    if (st.player.st.exposed > 0) d *= EXPOSED_MULT;
    return Math.max(0, Math.floor(d));
}

// ------------------------------------------------------------------ enemy moves

function executeMove(st, e, mv) {
    if (!mv) return;
    const p = st.player;
    const hit = (base) => { if (e.alive && st.phase === 'enemy') damagePlayer(st, attackDamage(st, e, base), e); };
    switch (mv.t) {
        case 'attack': hit(mv.dmg); break;
        case 'multi': for (let i = 0; i < mv.hits; i++) hit(mv.dmg); break;
        case 'attackDebuff': hit(mv.dmg); applyPlayerStatus(st, mv.st, mv.n); break;
        case 'drain': hit(mv.dmg); healEnemy(st, e, mv.heal); break;
        case 'tax': {
            const g = Math.min(mv.gold, st.gold);
            if (g > 0) { st.gold -= g; st.goldLost += g; emit(st, 'goldLost', { n: g, eid: e.eid }); }
            hit(mv.dmg);
            break;
        }
        case 'ward': e.ward += mv.n; emit(st, 'ward', { who: e.eid, n: mv.n, total: e.ward }); break;
        case 'guard':
            for (const a of alive(st)) { a.ward += mv.n; emit(st, 'ward', { who: a.eid, n: mv.n, total: a.ward }); }
            break;
        case 'buff':
        case 'enrage':
            e.st.might += mv.might;
            emit(st, 'status', { who: e.eid, key: 'might', v: e.st.might });
            if (mv.heal) healEnemy(st, e, mv.heal);
            break;
        case 'debuff':
            applyPlayerStatus(st, mv.st, mv.n);
            if (mv.also) applyPlayerStatus(st, mv.also, mv.n);
            break;
        case 'healAlly': {
            const al = alive(st).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (al) healEnemy(st, al, mv.n);
            break;
        }
        case 'charge': e.charged = true; emit(st, 'charge', { eid: e.eid }); break;
        case 'summon': {
            for (let i = 0; i < (mv.n ?? 1) && alive(st).length < 5; i++) {
                const m2 = addEnemy(st, makeEnemy(e.minionSpecies, st.world, st.floor, st.rng));
                rollIntent(st, m2);
                emit(st, 'summon', { eid: m2.eid, by: e.eid });
            }
            break;
        }
        case 'seal': sealCells(st, mv.cells, mv.turns); break;
        case 'ash': {
            for (let i = 0; i < mv.n; i++) st.discard.push(ashCard(st.tempUid++));
            emit(st, 'ashed', { n: mv.n, eid: e.eid });
            if (mv.seal) sealCells(st, mv.seal, 2);
            break;
        }
        case 'steal': {
            let best = -1, bv = -1;
            st.board.forEach((b, i) => { if (b.card && cardChips(b.card) + (b.card.ench ? 3 : 0) > bv) { bv = cardChips(b.card) + (b.card.ench ? 3 : 0); best = i; } });
            if (best >= 0) {
                const c = st.board[best].card;
                st.board[best].card = null;
                emit(st, 'steal', { cell: best, uid: c.uid, eid: e.eid });
                toDiscard(st, c);
                if (mv.heal) healEnemy(st, e, mv.heal);
            } else emit(st, 'fizzle', { eid: e.eid });
            if (mv.dmg) hit(mv.dmg);
            break;
        }
        case 'scramble': scrambleRows(st, mv.rows); break;
        case 'frost': {
            const cells = st.rng.shuffle([...Array(GRID * GRID).keys()].filter((i) => st.board[i].seal <= 0 && st.board[i].frost <= 0)).slice(0, mv.cells);
            const turns = st.relics.has('seerEye') ? 1 : 2;
            for (const i of cells) st.board[i].frost = turns + 1; // +1: it ticks at your turn start
            if (cells.length) emit(st, 'frost', { cells, eid: e.eid });
            if (mv.dmg) hit(mv.dmg);
            break;
        }
        case 'flood': wipeLine(st, LINES.find((l) => l.id === `r${tideRow(e)}`), 'flood', e); e.tides = (e.tides ?? 0) + 1; break;
        case 'void': wipeLine(st, LINES.find((l) => l.id === `c${voidCol(e)}`), 'void', e); e.voids = (e.voids ?? 0) + 1; break;
        case 'mirage': {
            const cells = st.rng.shuffle(st.board.map((b, i) => i).filter((i) => st.board[i].card && st.board[i].card.kind === 'play' && !st.board[i].card.joker)).slice(0, mv.n);
            const changes = [];
            for (const i of cells) {
                const c = st.board[i].card;
                const opts = ['S', 'C', 'D', 'H'].filter((s) => s !== c.suit);
                c.suit = st.rng.pick(opts);
                changes.push({ cell: i, uid: c.uid, suit: c.suit });
            }
            emit(st, 'mirage', { changes, eid: e.eid });
            break;
        }
        default: break;
    }
    // enemy board meddling can complete lines by accident — they fire for you
    if (st.phase === 'enemy') checkAllLines(st);
    void p;
}

function sealCells(st, n, turns) {
    // prefer cells in rows/columns that are nearly full: that is what hurts
    const empties = [...Array(GRID * GRID).keys()].filter((i) => !st.board[i].card && st.board[i].seal <= 0);
    const scored = empties.map((i) => {
        let s = st.rng.next() * 2;
        for (const l of LINES_BY_CELL[i]) s += l.cells.filter((c) => st.board[c].card).length;
        return { i, s };
    }).sort((a, b) => b.s - a.s);
    const t = st.relics.has('seerEye') ? 1 : turns;
    const cells = scored.slice(0, n).map((x) => x.i);
    for (const i of cells) st.board[i].seal = t + 1; // +1: ticks at your turn start
    if (cells.length) emit(st, 'seal', { cells, turns: t });
}

function scrambleRows(st, rows) {
    const cands = [0, 1, 2, 3, 4].filter((r) => st.board.slice(r * 5, r * 5 + 5).filter((b) => b.card).length >= 1);
    st.rng.shuffle(cands);
    const moves = [];
    for (const r of cands.slice(0, rows)) {
        const slots = [0, 1, 2, 3, 4].map((c) => r * 5 + c).filter((i) => st.board[i].seal <= 0);
        const cards = slots.map((i) => st.board[i].card);
        st.rng.shuffle(cards);
        slots.forEach((i, k) => {
            if (st.board[i].card !== cards[k]) moves.push({ cell: i, uid: cards[k]?.uid ?? null });
            st.board[i].card = cards[k];
        });
    }
    emit(st, 'scramble', { moves, board: st.board.map((b) => b.card?.uid ?? null) });
}

/** The tide rises from the bottom row; the void eats columns left to right. */
export function tideRow(e) { return 4 - ((e.tides ?? 0) % 5); }
export function voidCol(e) { return (e.voids ?? 0) % 5; }

/** Cells a Warden's intent is about to wipe (for the view to warn about). */
export function threatenedCells(st) {
    const out = new Set();
    for (const e of alive(st)) {
        const t = e.intent?.t;
        if (t === 'flood') for (let c = 0; c < 5; c++) out.add(tideRow(e) * 5 + c);
        if (t === 'void') for (let r = 0; r < 5; r++) out.add(r * 5 + voidCol(e));
    }
    return [...out];
}

function fullestLine(st, kind) {
    let best = null, bn = 0;
    for (const l of LINES) {
        if (l.kind !== kind) continue;
        const n = l.cells.filter((i) => st.board[i].card).length;
        if (n > bn) { bn = n; best = l; }
    }
    return best;
}

function wipeLine(st, line, how, e) {
    if (!line || !line.cells.some((i) => st.board[i].card)) { emit(st, 'fizzle', { eid: e.eid }); return; }
    const uids = [];
    for (const i of line.cells) {
        const c = st.board[i].card;
        if (c) { uids.push(c.uid); st.board[i].card = null; toDiscard(st, c); }
    }
    emit(st, 'wipe', { how, line: line.id, cells: line.cells, uids, eid: e.eid });
}

// ------------------------------------------------------------------ damage & healing

export function damageEnemy(st, e, amount, source) {
    if (!e.alive) return 0;
    let amt = amount;
    if (source !== 'burn' && source !== 'thorns' && e.st.exposed > 0) amt *= EXPOSED_MULT;
    amt = Math.max(0, Math.round(amt));
    const blocked = Math.min(e.ward, amt);
    e.ward -= blocked;
    const loss = amt - blocked;
    e.hp -= loss;
    st.stats.dmg += loss;
    emit(st, 'hitEnemy', { eid: e.eid, amount: amt, blocked, loss, hp: Math.max(0, e.hp), source });
    if (source === 'blades' && e.thorns > 0 && st.phase !== 'won') {
        emit(st, 'thorns', { eid: e.eid, n: e.thorns });
        damagePlayer(st, e.thorns, null, true);
    }
    if (e.hp <= 0) killEnemy(st, e);
    else checkPhase(st, e);
    return loss;
}

function killEnemy(st, e) {
    e.alive = false;
    e.hp = 0;
    emit(st, 'death', { eid: e.eid, boss: !!e.boss });
    if (e.boss) {
        for (const m2 of st.enemies) if (m2.alive && m2.minion) { m2.alive = false; m2.hp = 0; emit(st, 'flee', { eid: m2.eid }); }
    }
    if (!alive(st).length && st.phase !== 'lost') {
        st.phase = 'won';
        emit(st, 'win', {});
    }
}

function checkPhase(st, e) {
    if (!e.phases) return;
    while (e.phases[e.phase + 1] && e.hp / e.maxHp <= e.phases[e.phase + 1].at) {
        e.phase++;
        const ph = e.phases[e.phase];
        e.moves = ph.moves;
        e.seq = ph.seq;
        e.seqI = 0;
        e.charged = false;
        const en = ph.enter ?? {};
        if (en.clear) { e.st.weak = 0; e.st.exposed = 0; e.st.burn = 0; }
        if (en.might) e.st.might += en.might;
        if (en.ward) e.ward += en.ward;
        rollIntent(st, e);
        emit(st, 'phase', { eid: e.eid, name: ph.name, index: e.phase });
    }
}

function healEnemy(st, e, n) {
    if (!e.alive || n <= 0) return;
    const before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + Math.round(n));
    if (e.hp > before) emit(st, 'healEnemy', { eid: e.eid, n: e.hp - before, hp: e.hp });
}

function damagePlayer(st, amount, attacker, isThorns = false) {
    const p = st.player;
    if (st.phase === 'won' || st.phase === 'lost') return;
    const amt = Math.max(0, Math.round(amount));
    const blocked = Math.min(p.ward, amt);
    p.ward -= blocked;
    const loss = amt - blocked;
    p.hp -= loss;
    emit(st, 'hitPlayer', { amount: amt, blocked, loss, hp: Math.max(0, p.hp), eid: attacker?.eid ?? null, thorns: isThorns });
    if (attacker && attacker.alive && amt > 0) {
        const back = (st.relics.has('thornmail') ? 3 : 0) + (st.relics.has('crownBriars') ? 5 : 0);
        if (back) damageEnemy(st, attacker, back, 'thorns');
    }
    checkPlayerDeath(st);
}

function loseHp(st, n, why) {
    const p = st.player;
    p.hp -= n;
    emit(st, 'hitPlayer', { amount: n, blocked: 0, loss: n, hp: Math.max(0, p.hp), eid: null, why });
    checkPlayerDeath(st);
}

function checkPlayerDeath(st) {
    const p = st.player;
    if (p.hp > 0 || st.phase === 'lost') return;
    if (st.relics.has('phoenix')) {
        st.relics.delete('phoenix');
        st.relicsLost.push('phoenix');
        p.hp = Math.round(p.maxHp * 0.4);
        emit(st, 'revive', { hp: p.hp });
        return;
    }
    p.hp = 0;
    st.phase = 'lost';
    emit(st, 'lose', {});
}

function healPlayer(st, n, why) {
    const p = st.player;
    n = Math.round(n);
    if (n <= 0) return 0;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    if (p.hp > before) emit(st, 'healPlayer', { n: p.hp - before, hp: p.hp, why });
    return p.hp - before;
}

function gainWard(st, n, why) {
    n = Math.round(n);
    if (n <= 0) return;
    st.player.ward += n;
    emit(st, 'ward', { who: 'player', n, total: st.player.ward, why });
}

function applyPlayerStatus(st, key, n) {
    st.player.st[key] = (st.player.st[key] ?? 0) + n;
    emit(st, 'status', { who: 'player', key, v: st.player.st[key] });
}

function applyEnemyStatus(st, e, key, n) {
    if (!e.alive) return;
    if (key === 'burn' && st.relics.has('brazier')) n *= 2;
    e.st[key] = (e.st[key] ?? 0) + n;
    emit(st, 'status', { who: e.eid, key, v: e.st[key] });
}

// ------------------------------------------------------------------ scoring

/**
 * Score a set of table cells as one line. Pure (apart from Lucky rolls, which
 * use the combat RNG and so stay deterministic). Returns the breakdown the
 * view animates.
 */
export function scoreLine(st, cells, { cross = false, diag = false, preview = false } = {}) {
    const R = st.relics;
    const cards = cells.map((i) => st.board[i].card).filter(Boolean);
    const hand = evaluate(cards);
    const maj = majoritySuit(cards);
    const chips = { S: 0, C: 0, D: 0, H: 0 };
    const per = [];
    let mult = HANDS[hand].mult;
    let mul = 1;
    const extras = { gold: 0, heal: 0, burn: 0, ward: 0 };
    const shatter = [];
    for (const i of cells) {
        const c = st.board[i].card;
        if (!c) continue;
        if (c.kind === 'ash') { per.push({ cell: i, uid: c.uid, chips: 0, suit: null }); continue; }
        const suit = c.joker ? maj : c.suit;
        let ch = cardChips(c);
        if (st.board[i].frost > 0) ch = 0;
        else {
            if (suit === 'S' && R.has('whetstone')) ch += 2;
            if (suit === 'C' && R.has('runestaff')) ch += 2;
            if (suit === 'D' && R.has('ironring')) ch += 2;
            if (suit === 'H' && R.has('heartwood')) ch += 2;
            if (suit === 'C' && R.has('crownAsh')) ch += 3;
            if (!c.joker) {
                if (c.rank >= 2 && c.rank <= 5 && R.has('smallPips')) ch += 3;
                if (c.rank >= 11 && c.rank <= 13 && R.has('portrait')) ch += 4;
                if (c.rank === 14 && R.has('aceband')) ch += 8;
            }
            if (c.ench === 'keen') ch += 6;
            if (c.ench === 'lucky' && !preview && st.rng.chance(1 / 3)) ch += 10;
            if (c.ench === 'echo') ch *= 2;
        }
        if (c.ench === 'radiant') mult += 0.5;
        if (c.ench === 'glass') {
            mul *= 1.5;
            if (!preview && st.rng.chance(0.25)) shatter.push(c.uid);
        }
        if (c.ench === 'gilded') extras.gold += 3;
        if (c.ench === 'vampiric') extras.heal += 2;
        if (c.ench === 'blazing') extras.burn += 3;
        if (c.ench === 'stone') extras.ward += 4;
        chips[suit] += ch;
        per.push({ cell: i, uid: c.uid, chips: ch, suit });
    }
    if (st.player.st.might > 0) chips[maj] += st.player.st.might;

    if ((hand === 'pair' || hand === 'twoPair') && R.has('twinStones')) mult += 0.75;
    if ((hand === 'flush' || hand === 'straightFlush' || hand === 'royalFlush') && R.has('monoSeal')) mult += 1.5;
    if ((hand === 'straight' || hand === 'straightFlush' || hand === 'royalFlush') && R.has('stair')) mult += 1.5;
    if ((hand === 'threeKind' || hand === 'fourKind') && R.has('kinMirror')) mult += 1.5;
    if (hand === 'fullHouse' && R.has('hearth')) { mult += 2; extras.heal += 5; }
    if (R.has('crownDeep')) mult += 0.75;

    const bonuses = [];
    if (cross) { const x = R.has('crossroads') ? 2 : CROSS_MULT; mul *= x; bonuses.push(`Cross ×${x}`); }
    if (diag) { const x = R.has('compass') ? 2 : DIAG_MULT; mul *= x; bonuses.push(`Diagonal ×${x}`); }
    if (st.favour > 0) { mul *= 2; bonuses.push('Favour ×2'); }
    if (st.luck > 0) { mul *= 2; bonuses.push('Luck ×2'); }
    if (!st.firedAny && R.has('firstBlood')) { mul *= 2; bonuses.push('First Blood ×2'); }
    if (hand === 'high' && R.has('lonelyCrown')) { mul *= 2; bonuses.push('Lonely ×2'); }

    const M = mult * mul;
    const weak = st.player.st.weak > 0 ? WEAK_MULT : 1;
    let dmg = chips.S * M * SUIT_INFO.S.scale * weak;
    const aoe = chips.C * M * SUIT_INFO.C.scale * weak;
    const ward = chips.D * M * SUIT_INFO.D.scale;
    const heal = chips.H * M * SUIT_INFO.H.scale * (R.has('chalice') ? 1.5 : 1);
    let oath = false;
    if (chips.S > 0 && R.has('oathbrand') && !st.oathUsed) { dmg *= 1.3; oath = true; }
    if (R.has('kettle')) dmg += heal * 0.5 * weak;
    if (R.has('crownMammon')) dmg += ward * 0.5 * weak;

    return {
        hand, name: HANDS[hand].name, mult: HANDS[hand].mult, bonusMult: mult - HANDS[hand].mult, mul, total: M,
        chips, per, maj, bonuses, oath,
        out: { dmg: Math.round(dmg), aoe: Math.round(aoe), ward: Math.round(ward), heal: Math.round(heal) },
        extras, shatter,
    };
}

/** Lines through `cell` that would complete if a card were placed there. */
export function linesCompletedBy(st, cell) {
    return LINES_BY_CELL[cell].filter((l) => l.cells.every((i) => i === cell || st.board[i].card));
}

function fireLines(st, lines, { reap = false } = {}) {
    if (!lines.length || st.phase === 'won' || st.phase === 'lost') return;
    const cross = lines.length >= 2;
    if (cross) st.stats.crosses++;
    const scores = lines.map((l) => ({ line: l, s: scoreLine(st, l.cells, { cross, diag: l.kind === 'diag' }) }));
    const cleared = new Set();
    for (const { line, s } of scores) {
        if (st.phase === 'won' || st.phase === 'lost') break;
        st.firedAny = true;
        if (st.favour > 0) st.favour = 0;
        if (st.luck > 0) st.luck = 0;
        if (s.oath) st.oathUsed = true;
        st.stats.lines++;
        st.stats.hands[s.hand] = (st.stats.hands[s.hand] ?? 0) + 1;
        if (!st.stats.bestHand || HANDS[s.hand].tier > HANDS[st.stats.bestHand].tier) st.stats.bestHand = s.hand;
        const target = currentTarget(st);
        emit(st, 'fire', { line: line.id, kind: line.kind, cells: line.cells, hand: s.hand, name: s.name, mult: s.total, per: s.per, chips: s.chips, out: s.out, bonuses: s.bonuses, cross, reap, target: target?.eid ?? null });
        applyScore(st, s, target);
        line.cells.forEach((i) => cleared.add(i));
    }
    if (cross && st.relics.has('crownStorm') && st.phase !== 'won') {
        emit(st, 'storm', {});
        for (const e of alive(st)) damageEnemy(st, e, 20 + 4 * st.world, 'staves');
    }
    // clear the fired cards (even after a win, so the table animates cleanly)
    const uids = [];
    for (const i of cleared) {
        const c = st.board[i].card;
        if (!c) continue;
        st.board[i].card = null;
        uids.push(c.uid);
        if (st.shattered.includes(c.uid)) { st.exhaust.push(c); continue; }
        toDiscard(st, c);
    }
    emit(st, 'clear', { cells: [...cleared], uids });
}

function applyScore(st, s, target) {
    const R = st.relics;
    const o = s.out;
    if (o.dmg > 0 && target) {
        const dealt = damageEnemy(st, target, o.dmg, 'blades');
        if (R.has('vampFang') && dealt > 0) healPlayer(st, dealt * 0.1, 'fang');
    }
    if (o.aoe > 0) for (const e of alive(st)) damageEnemy(st, e, o.aoe, 'staves');
    if (st.phase === 'lost') return;
    if (o.ward > 0) gainWard(st, o.ward, 'coins');
    if (o.heal > 0) healPlayer(st, o.heal, 'hearts');
    const x = s.extras;
    if (x.gold) { st.gold += x.gold; st.goldGained += x.gold; emit(st, 'gold', { n: x.gold }); }
    if (x.heal) healPlayer(st, x.heal, 'vampiric');
    if (x.ward) gainWard(st, x.ward, 'stone');
    const t2 = currentTarget(st);
    if (x.burn && t2) applyEnemyStatus(st, t2, 'burn', x.burn);
    for (const uid of s.shatter) { st.shattered.push(uid); emit(st, 'shatter', { uid }); }
    if (R.has('idol')) { st.gold += 2; st.goldGained += 2; emit(st, 'gold', { n: 2 }); }
    if (R.has('crownTides')) healPlayer(st, 3, 'tides');
    if (R.has('emberCoal')) for (const e of alive(st)) applyEnemyStatus(st, e, 'burn', 1);
}

function checkAllLines(st) {
    const full = LINES.filter((l) => l.cells.every((i) => st.board[i].card));
    if (full.length) fireLines(st, full);
}

// ------------------------------------------------------------------ player actions

export function placeCard(st, handIdx, cell) {
    if (st.phase !== 'player' || st.deals <= 0) return false;
    const c = st.hand[handIdx];
    if (!c || c.kind === 'arcana' || !canPlace(st, cell)) return false;
    st.hand.splice(handIdx, 1);
    st.board[cell].card = c;
    st.deals--;
    emit(st, 'place', { uid: c.uid, cell });
    const lines = linesCompletedBy(st, cell);
    if (lines.length) fireLines(st, lines);
    return true;
}

export function redraw(st, handIdx) {
    if (st.phase !== 'player' || st.redraws <= 0) return false;
    const c = st.hand[handIdx];
    if (!c) return false;
    st.hand.splice(handIdx, 1);
    st.redraws--;
    emit(st, 'redraw', { uid: c.uid });
    toDiscard(st, c);
    drawOne(st);
    return true;
}

/** Can this arcana be played on this target? target: {eid} | {cell} | {cells:[a,b]} | {cell, suit} */
export function arcanaTargetOk(st, c, target) {
    const a = ARCANA[c.id];
    const tableCard = (i) => st.board[i]?.card && st.board[i].card.kind === 'play';
    switch (a.target) {
        case 'enemy': return !!currentTarget(st);
        case 'grid': return target && tableCard(target.cell) && (c.id !== 'ascend' || (!st.board[target.cell].card.joker && st.board[target.cell].card.rank < 14));
        case 'grid2': return target && target.cells?.length === 2 && target.cells[0] !== target.cells[1] && tableCard(target.cells[0]) && tableCard(target.cells[1]);
        case 'gridSuit': return target && tableCard(target.cell) && !st.board[target.cell].card.joker && 'SCDH'.includes(target.suit);
        default: return true;
    }
}

export function playArcana(st, handIdx, target = {}) {
    if (st.phase !== 'player') return false;
    const c = st.hand[handIdx];
    if (!c || c.kind !== 'arcana') return false;
    const cost = effectiveCost(st, c);
    if (cost > st.deals) return false;
    if (!arcanaTargetOk(st, c, target)) return false;
    const a = ARCANA[c.id];
    const n = c.up ? a.un : a.n;
    const sc = arcScale(st);
    st.hand.splice(handIdx, 1);
    st.deals -= cost;
    const tgt = target.eid ? enemyByEid(st, target.eid) : null;
    const foe = tgt && tgt.alive ? tgt : currentTarget(st);
    emit(st, 'arcana', { uid: c.uid, id: c.id, target, eid: foe?.eid ?? null });
    const B = st.board;
    switch (c.id) {
        case 'fireball': damageEnemy(st, foe, n * sc, 'spell'); break;
        case 'barrier': gainWard(st, n * sc, 'spell'); break;
        case 'transmute': B[target.cell].card.suit = target.suit; emit(st, 'mirage', { changes: [{ cell: target.cell, uid: B[target.cell].card.uid, suit: target.suit }], eid: null }); break;
        case 'swap': {
            const [a1, b1] = target.cells;
            [B[a1].card, B[b1].card] = [B[b1].card, B[a1].card];
            emit(st, 'swap', { cells: [a1, b1] });
            if (n) drawN(st, 1);
            break;
        }
        case 'ascend': {
            const tc = B[target.cell].card;
            tc.rank = Math.min(14, tc.rank + n);
            emit(st, 'ascend', { cell: target.cell, uid: tc.uid, rank: tc.rank });
            break;
        }
        case 'sweep': {
            const tc = B[target.cell].card;
            B[target.cell].card = null;
            emit(st, 'sweep', { cell: target.cell, uid: tc.uid });
            toDiscard(st, tc);
            if (n) drawN(st, 1);
            break;
        }
        case 'foresight': drawN(st, n); break;
        case 'conjure': { const j = jokerCard(st.tempUid++, true); st.hand.push(j); emit(st, 'conjure', { uid: j.uid }); break; }
        case 'secondWind': st.deals += n; emit(st, 'deals', { n }); break;
        case 'gamble': {
            const k = st.hand.length;
            for (const h of st.hand.splice(0)) { emit(st, 'redraw', { uid: h.uid }); toDiscard(st, h); }
            drawN(st, k + n);
            break;
        }
        case 'hex': applyEnemyStatus(st, foe, 'weak', n); applyEnemyStatus(st, foe, 'exposed', n); break;
        case 'salvo': for (let i = 0; i < n; i++) { const al = alive(st); if (!al.length) break; damageEnemy(st, st.rng.pick(al), 5 * sc, 'spell'); } break;
        case 'thunder': for (const e of alive(st)) { damageEnemy(st, e, n * sc, 'spell'); applyEnemyStatus(st, e, 'exposed', 1); } break;
        case 'purify': {
            const p = st.player.st;
            p.weak = 0; p.exposed = 0; p.burn = 0;
            B.forEach((b, i) => { if (b.seal > 0 || b.frost > 0) { b.seal = 0; b.frost = 0; emit(st, 'unseal', { cell: i }); emit(st, 'thaw', { cell: i }); } });
            emit(st, 'status', { who: 'player', key: 'weak', v: 0 });
            if (n) gainWard(st, n * sc, 'spell');
            break;
        }
        case 'favour': st.favour = 1; if (c.up) { st.deals += 1; emit(st, 'deals', { n: 1 }); } emit(st, 'favour', {}); break;
        case 'mirror': { const cp = { ...B[target.cell].card, uid: st.tempUid++, temp: true }; st.hand.push(cp); emit(st, 'conjure', { uid: cp.uid }); break; }
        case 'kindle': applyEnemyStatus(st, foe, 'burn', Math.round(n * (1 + 0.2 * st.world))); break;
        case 'mend': healPlayer(st, n * sc, 'spell'); st.player.st.regen += Math.round(n / 3); emit(st, 'status', { who: 'player', key: 'regen', v: st.player.st.regen }); break;
        case 'bulwark': gainWard(st, n * cardsOnTable(st) * (1 + 0.15 * st.world), 'spell'); break;
        case 'harvest': {
            const row = fullestLine(st, 'row');
            const sum = row ? row.cells.reduce((s2, i) => s2 + (B[i].card ? cardChips(B[i].card) : 0), 0) : 0;
            damageEnemy(st, foe, sum * n * (1 + 0.1 * st.world), 'spell');
            break;
        }
        case 'rally': st.player.st.might += n; emit(st, 'status', { who: 'player', key: 'might', v: st.player.st.might }); break;
        case 'reap': {
            const row = fullestLine(st, 'row');
            if (row) fireLines(st, [{ ...row, cells: row.cells.filter((i) => B[i].card) }], { reap: true });
            break;
        }
        default: break;
    }
    if (a.exhaust && !(c.id === 'reap' && c.up)) { st.exhaust.push(c); emit(st, 'exhaust', { uid: c.uid }); } else toDiscard(st, c);
    return true;
}

export function useElixir(st, slot, eid = null) {
    if (st.phase !== 'player') return false;
    const id = st.elixirs[slot];
    if (!id) return false;
    st.elixirs[slot] = null;
    const w = st.world;
    emit(st, 'elixir', { id, slot });
    const foe = (eid && enemyByEid(st, eid)?.alive) ? enemyByEid(st, eid) : currentTarget(st);
    switch (id) {
        case 'heal': healPlayer(st, healAmt(w), 'elixir'); break;
        case 'ironbark': gainWard(st, 12 + w * 5, 'elixir'); break;
        case 'dragonfire': for (const e of alive(st)) damageEnemy(st, e, 12 + w * 6, 'spell'); break;
        case 'quicken': st.deals += 2; emit(st, 'deals', { n: 2 }); break;
        case 'fortune': {
            const k = Math.max(st.handSize, st.hand.length);
            for (const h of st.hand.splice(0)) { emit(st, 'redraw', { uid: h.uid }); toDiscard(st, h); }
            drawN(st, k);
            st.redraws++;
            break;
        }
        case 'luck': st.luck = 1; emit(st, 'favour', {}); break;
        case 'antidote': {
            const p = st.player.st;
            p.weak = 0; p.exposed = 0; p.burn = 0; p.regen += 4;
            emit(st, 'status', { who: 'player', key: 'regen', v: p.regen });
            break;
        }
        case 'strength': st.player.st.might += 3; emit(st, 'status', { who: 'player', key: 'might', v: st.player.st.might }); break;
        default: break;
    }
    void foe;
    return true;
}

/** Best-guess preview of what placing hand card `handIdx` at `cell` would fire. */
export function previewPlacement(st, handIdx, cell) {
    const c = st.hand[handIdx];
    if (!c || c.kind === 'arcana' || !canPlace(st, cell)) return null;
    const lines = linesCompletedBy(st, cell);
    if (!lines.length) return [];
    st.board[cell].card = c;
    const res = lines.map((l) => ({ line: l.id, cells: l.cells, ...scoreLine(st, l.cells, { cross: lines.length >= 2, diag: l.kind === 'diag', preview: true }) }));
    st.board[cell].card = null;
    return res;
}

/** Summary for the end of combat, consumed by run.js. */
export function combatResult(st) {
    return {
        won: st.phase === 'won',
        hp: Math.max(0, st.player.hp),
        goldGained: st.goldGained,
        goldLost: st.goldLost,
        shattered: [...st.shattered],
        relicsLost: [...st.relicsLost],
        elixirs: [...st.elixirs],
        stats: { ...st.stats },
        killed: st.enemies.filter((e) => !e.alive && !e.minion).map((e) => ({ name: e.name, tier: e.tier })),
    };
}

export { passiveInfo, rankChips };
