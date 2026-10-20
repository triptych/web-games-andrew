// Auto-players. Pure, like the rest of js/sim.
//
// The dig bot plays the board through the same trySwap the player uses. It tries every legal swap
// on a copy of the board (with its random state scrambled, so it can't see what will fall in) and
// scores the result by goal progress. skill in [0, 1] is how often it takes its best idea rather
// than one of its next few, and how much it notices specials. A perfect bot says a level can be
// won; a skill-0.5 bot says roughly how a person will find it.
//
// The museum bot plays the whole game: digs the next level, does tasks when it can afford them,
// empties the till, retries or buys moves when it loses.

import * as Bd from './board.js';
import * as Gm from './game.js';
import { makeRng } from '../rng.js';

const W = { color: 1, soil: 1.6, fossil: 4, rock: 2.2, crust: 1.6, relic: 10 };

function progress(B) {
    let p = 0;
    for (const g of B.goals) p += Math.min(g.got, g.n) * (W[g.kind] || 1);
    // relics further down are worth a little, so the bot clears under them
    if (B.relic) {
        for (let i = 0; i < B.cells.length; i++) {
            const t = B.cells[i].t;
            if (t && t.k === 'relic') p += (Math.floor(i / B.C) / B.R) * 9;
        }
    }
    return p;
}

function specialsOnBoard(B) {
    let n = 0;
    for (const cell of B.cells) if (cell.t && (cell.t.k === 'sun' || cell.t.s)) n += cell.t.k === 'sun' ? 3 : cell.t.s === 'bomb' ? 1.6 : 1.2;
    return n;
}

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed) };
}

/** The bot's chosen swap for this board, as [[r1, c1], [r2, c2]], or null. */
export function botMove(B, bot) {
    const moves = Bd.findMoves(B);
    if (!moves.length) return null;
    const p0 = progress(B);
    const scored = [];
    for (const m of moves) {
        const copy = Bd.cloneBoard(B);
        copy.rs = (copy.rs ^ 0x9e3779b9) + Math.floor(bot.rng() * 1e6);
        Bd.trySwap(copy, m[0][0], m[0][1], m[1][0], m[1][1]);
        let v = progress(copy) - p0;
        if (copy.state === 'won') v += 1000;
        v += (specialsOnBoard(copy) - specialsOnBoard(B)) * 2.5 * bot.skill;
        v += (copy.score - B.score) / 3000;
        // prefer moves low on the board: they shake up more of it
        v += (m[0][0] / B.R) * 0.3;
        scored.push({ m, v });
    }
    scored.sort((a, b) => b.v - a.v);
    if (bot.rng() < bot.skill) return scored[0].m;
    const top = scored.slice(0, Math.max(2, Math.round(3 + (1 - bot.skill) * 6)));
    return top[Math.floor(bot.rng() * top.length)].m;
}

/** Play a board to the end. Returns { won, movesUsed, score, chain }. */
export function playBoard(B, bot, maxMoves = 400) {
    for (let k = 0; k < maxMoves && B.state === 'play'; k++) {
        const m = botMove(B, bot);
        if (!m) break;
        Bd.trySwap(B, m[0][0], m[0][1], m[1][0], m[1][1]);
        B.ev.length = 0;
    }
    return { won: B.state === 'won', movesUsed: B.movesUsed, score: B.score, chain: B.chainBest };
}

// ------------------------------------------------------------------ the whole game
/**
 * Play the story from a new game until the finale, or until `limit` digs. Returns a log.
 * onDig(G, n, won) is called after every dig, for tests and balance tables.
 */
export function playGame(G, { skill = 0.6, limit = 400, seed = 3, buyMoves = true, onDig = null } = {}) {
    const bot = makeBot({ skill, seed });
    const log = { digs: 0, wins: 0, losses: 0, moveBuys: 0, tasks: 0, stuck: null, perChapter: [] };
    Gm.finishIntro(G);
    for (let guard = 0; guard < limit * 3 && log.digs < limit && !G.finished; guard++) {
        G.events.length = 0;
        Gm.step(G, null, 90);                   // a minute and a half in the museum between digs
        Gm.collectTill(G);
        // tasks first, whenever one can be done
        let didTask = false;
        for (const t of Gm.openTasks(G)) if (Gm.doTask(G, t.id)) { log.tasks++; didTask = true; break; }
        if (didTask) continue;
        let n = Gm.nextLevel(G);
        if (!n) {
            // the chapter is blocked on stars: replay the last level for one
            const t = Gm.openTasks(G)[0];
            if (!t) { log.stuck = 'no task and no level'; break; }
            const why = Gm.taskBlock(G, t.id);
            if (why && !/★|tasks first/.test(why)) { log.stuck = `${t.id}: ${why}`; break; }
            n = G.level;
        }
        Gm.startDig(G, n);
        const B = G.dig.B;
        for (;;) {
            playBoard(B, bot);
            Gm.digSwap(G, -1, -1, -1, -1);      // flush the board's events into a result
            if (B.state === 'won') break;
            if (buyMoves && G.coins >= Gm.extraMovesCost(G) && G.dig.extra < 2 && closeToGoal(B)) {
                Gm.buyMoves(G); log.moveBuys++; continue;
            }
            break;
        }
        const won = B.state === 'won';
        log.digs++;
        if (won) log.wins++; else log.losses++;
        onDig?.(G, n, won);
        Gm.leaveDig(G);
    }
    return log;
}

function closeToGoal(B) {
    const need = B.goals.reduce((a, g) => a + Math.max(0, g.n - g.got) / Math.max(1, g.n), 0);
    return need < 0.35;
}
