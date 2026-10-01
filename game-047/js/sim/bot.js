/**
 * bot.js — a heuristic player, used by dev/simtest.mjs to balance the game and
 * by the title screen's attract mode. Pure: reads and mutates sim state only.
 */

import {
    placeCard, endTurn, redraw, playArcana, useElixir, setTarget, alive, previewPlacement,
    intentInfo, canPlace, LINES, effectiveCost, arcanaTargetOk, currentTarget,
} from './combat.js';
import { cardChips, cardValue, ARCANA } from './cards.js';
import { GRID } from './rules.js';

const LINES_BY_CELL = Array.from({ length: GRID * GRID }, (_, i) => LINES.filter((l) => l.cells.includes(i)));

function incoming(st) {
    let d = 0;
    for (const e of alive(st)) {
        const it = intentInfo(st, e);
        if (it?.dmg) d += it.dmg * (it.hits || 1);
    }
    return d;
}

function outValue(st, res) {
    let v = 0;
    const t = currentTarget(st);
    const al = alive(st);
    const need = Math.max(0, incoming(st) - st.player.ward);
    const missing = st.player.maxHp - st.player.hp;
    for (const r of res) {
        const o = r.out;
        v += Math.min(o.dmg, (t?.hp ?? 0) + (t?.ward ?? 0) + 5) * 1.0;
        for (const e of al) v += Math.min(o.aoe, e.hp + e.ward) * 0.9;
        v += Math.min(o.ward, need) * 1.1 + o.ward * 0.08;
        v += Math.min(o.heal, missing) * 0.9;
    }
    return v;
}

/** How promising a partial line is, as a number. */
function lineShape(cards) {
    const n = cards.length;
    if (!n) return 0;
    let ash = 0, jok = 0;
    const suits = { S: 0, C: 0, D: 0, H: 0 };
    const ranks = new Map();
    let chips = 0;
    for (const c of cards) {
        if (c.kind === 'ash') { ash++; continue; }
        if (c.joker) { jok++; continue; }
        suits[c.suit]++;
        if (c.ench === 'wild') for (const s in suits) if (s !== c.suit) suits[s] += 0.99;
        ranks.set(c.rank, (ranks.get(c.rank) ?? 0) + 1);
        chips += cardChips(c) + (c.ench ? 4 : 0);
    }
    const maxSuit = Math.max(...Object.values(suits)) + jok;
    let s = chips * 0.35;
    if (maxSuit >= n && n >= 2) s += n * n * 1.6;           // still a flush
    let pairs = 0;
    for (const k of ranks.values()) pairs += (k * (k - 1)) / 2;
    s += pairs * 7 + jok * 5;
    const rs = [...ranks.keys()];
    if (!pairs && rs.length >= 2) {
        const span = Math.max(...rs) - Math.min(...rs);
        if (span <= 4) s += n * 2.2;
    }
    s -= ash * 14;
    return s * (0.6 + n * 0.12);
}

function placementScore(st, hi, cell) {
    const res = previewPlacement(st, hi, cell);
    if (res === null) return -Infinity;
    const c = st.hand[hi];
    if (res.length) return 40 + outValue(st, res);
    let s = 0;
    for (const l of LINES_BY_CELL[cell]) {
        const before = l.cells.map((i) => st.board[i].card).filter(Boolean);
        const blocked = l.cells.some((i) => st.board[i].seal > 0);
        const after = before.concat([c]);
        const d = lineShape(after) - lineShape(before);
        s += d * (l.kind === 'diag' ? 0.35 : 1) * (blocked ? 0.5 : 1);
    }
    if (st.board[cell].frost > 0) s -= cardChips(c) * 0.5;
    return s;
}

function pickTarget(st) {
    const al = alive(st);
    if (!al.length) return;
    // lowest effective HP first, but prefer dangerous foes
    let best = al[0], bv = -Infinity;
    for (const e of al) {
        const it = intentInfo(st, e);
        const threat = (it?.dmg ?? 0) * (it?.hits || 1) + (e.boss ? 8 : 0);
        const v = threat * 1.2 - (e.hp + e.ward) * 0.35 + (e.minion ? -6 : 0);
        if (v > bv) { bv = v; best = e; }
    }
    setTarget(st, best.eid);
}

function tryArcana(st) {
    for (let i = 0; i < st.hand.length; i++) {
        const c = st.hand[i];
        if (c.kind !== 'arcana') continue;
        const cost = effectiveCost(st, c);
        if (cost > st.deals) continue;
        const a = ARCANA[c.id];
        let target = {};
        if (a.target === 'grid' || a.target === 'gridSuit' || a.target === 'grid2') {
            const cells = st.board.map((b, k) => k).filter((k) => st.board[k].card && st.board[k].card.kind === 'play');
            if (!cells.length) continue;
            if (c.id === 'sweep') {
                const ash = st.board.findIndex((b) => b.card && b.card.kind === 'ash');
                if (ash < 0) continue;
                target = { cell: ash };
            } else if (a.target === 'grid2') {
                if (cells.length < 2) continue;
                target = { cells: [cells[0], cells[cells.length - 1]] };
                if (st.rng.next() < 0.6) continue;
            } else if (a.target === 'gridSuit') {
                // push a card toward its row's main suit
                let done = false;
                for (const k of cells) {
                    const r = Math.floor(k / 5);
                    const row = [0, 1, 2, 3, 4].map((x) => st.board[r * 5 + x].card).filter((x) => x && x.suit);
                    const tally = {};
                    for (const x of row) tally[x.suit] = (tally[x.suit] ?? 0) + 1;
                    const top = Object.entries(tally).sort((a1, b1) => b1[1] - a1[1])[0];
                    if (top && top[1] >= 2 && st.board[k].card.suit !== top[0] && !st.board[k].card.joker) { target = { cell: k, suit: top[0] }; done = true; break; }
                }
                if (!done) continue;
            } else {
                target = { cell: cells.reduce((b, k) => (cardChips(st.board[k].card) > cardChips(st.board[b].card) ? k : b), cells[0]) };
            }
        }
        if (!arcanaTargetOk(st, c, target)) continue;
        if (c.id === 'barrier' && incoming(st) <= st.player.ward) continue;
        if (c.id === 'mend' && st.player.hp > st.player.maxHp * 0.8) continue;
        if (c.id === 'purify' && !st.board.some((b) => b.seal > 0 || b.frost > 0) && !st.player.st.weak) continue;
        if (c.id === 'bulwark' && st.board.filter((b) => b.card).length < 6) continue;
        if (c.id === 'harvest' && st.board.filter((b) => b.card).length < 4) continue;
        if (c.id === 'reap' && st.board.filter((b) => b.card).length < 8) continue;
        if (c.id === 'gamble' && st.hand.length > 3) continue;
        if (playArcana(st, i, target)) return true;
    }
    return false;
}

function tryElixir(st) {
    for (let i = 0; i < st.elixirs.length; i++) {
        const id = st.elixirs[i];
        if (!id) continue;
        const p = st.player;
        const boss = alive(st).some((e) => e.boss || e.tier === 'elite');
        let use = false;
        if (id === 'heal') use = p.hp < p.maxHp * 0.35;
        else if (id === 'ironbark') use = incoming(st) > p.ward + p.hp * 0.4;
        else if (id === 'antidote') use = p.st.weak > 0 || p.st.burn > 3;
        else use = boss && st.turn <= 2;
        if (use && useElixir(st, i)) return true;
    }
    return false;
}

/** Play one whole player turn, then end it. */
export function botTurn(st) {
    if (st.phase !== 'player') return;
    pickTarget(st);
    tryElixir(st);
    let guard = 0;
    while (st.phase === 'player' && guard++ < 40) {
        pickTarget(st);
        if (tryArcana(st)) continue;
        if (st.deals <= 0) break;
        let best = null, bv = -Infinity;
        for (let hi = 0; hi < st.hand.length; hi++) {
            if (st.hand[hi].kind === 'arcana') continue;
            for (let cell = 0; cell < GRID * GRID; cell++) {
                if (!canPlace(st, cell)) continue;
                const v = placementScore(st, hi, cell);
                if (v > bv) { bv = v; best = [hi, cell]; }
            }
        }
        if (!best) {
            // nothing placeable: redraw an arcana we can't afford, else stop
            if (st.redraws > 0 && st.hand.length) { redraw(st, 0); continue; }
            break;
        }
        if (bv < 0 && st.redraws > 0) {
            const worst = st.hand.reduce((w, c, k) => (c.kind === 'ash' || cardChips(c) < cardChips(st.hand[w]) ? k : w), 0);
            if (redraw(st, worst)) continue;
        }
        placeCard(st, best[0], best[1]);
    }
    if (st.phase === 'player') endTurn(st);
}

/** Card preference for rewards/shops. */
export function cardWant(c, deckSize) {
    if (c.kind === 'arcana') {
        const good = { secondWind: 70, favour: 65, foresight: 50, thunder: 60, fireball: 50, reap: 60, rally: 55, conjure: 60, mend: 35, barrier: 40, hex: 40, kindle: 35 };
        return (good[c.id] ?? 25) + (c.up ? 15 : 0) - deckSize * 0.6;
    }
    return cardValue(c) - 30 - deckSize * 0.8;
}
