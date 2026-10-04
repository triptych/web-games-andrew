/**
 * bot.js — a greedy auto-player for balance runs and tests.
 *
 * Each step it spends any charged power-up where it helps most, then plays
 * the trail with the best goal value (plus a little for length and golden
 * fruit). `skill` < 1 shrinks the search and adds noise, standing in for a
 * casual player who spots shorter trails.
 */

import { bestChain, neighbours } from './search.js';
import { Game } from './game.js';
import { GOLDEN_CHAIN } from '../config.js';

function areaValue(game, cells) {
    const path = cells.filter(([r, c]) => game.cells[r][c].fruit && !game.cells[r][c].fruit.frost);
    return game.goalValue(path) + path.length * 0.1;
}

/** Try one power-up. Returns events or null. */
export function botPower(game, force = false) {
    for (let i = 0; i < game.jars.length; i++) {
        const jar = game.jars[i];
        if (jar.charges <= 0) continue;
        if (jar.power === 'rainbow') {
            if (!game.wild && game.movesLeft() > 0) return game.usePower(i);
            continue;
        }
        let best = null, bestV = -1;
        for (let r = 0; r < game.rows; r++) {
            for (let c = 0; c < game.cols; c++) {
                const f = game.cells[r][c].fruit;
                if (game.cells[r][c].hole) continue;
                let v = -1;
                if (jar.power === 'bomb') {
                    const area = [[r, c], ...neighbours(game, r, c)];
                    v = areaValue(game, area) + game._obstaclesTouched([[r, c]], 'leaf') * 3 + game._obstaclesTouched([[r, c]], 'frost') * 3;
                } else if (jar.power === 'honey' && f && !f.frost) {
                    const same = [];
                    game.forEachFruit((g, gr, gc) => { if (g.kind === f.kind && !g.frost) same.push([gr, gc]); });
                    v = areaValue(game, same);
                } else if (jar.power === 'paint' && f && !f.frost && !f.golden) {
                    // Count how many neighbours already share the colour or would after painting.
                    v = neighbours(game, r, c).filter(([nr, nc]) => game.cells[nr][nc].fruit && !game.cells[nr][nc].fruit.frost).length;
                    for (const g of game.goals) if (g.t === 'colour' && g.v === f.colour && g.have < g.n) v += 4;
                }
                if (v > bestV) { bestV = v; best = [r, c]; }
            }
        }
        if (best && (bestV >= 3 || force || jar.charges >= 2)) {
            const ev = game.usePower(i, best[0], best[1]);
            if (ev) return ev;
        }
    }
    return null;
}

/** One bot move. Returns events, or null if nothing could be done. */
export function botStep(game, { skill = 1, rng = null } = {}) {
    if (game.status !== 'playing') return null;
    const outOfMoves = game.movesLeft() <= 0;
    const p = botPower(game, outOfMoves);
    if (p) return p;
    if (outOfMoves) return null;
    const noise = skill < 1 && rng ? () => (rng() - 0.5) * (1 - skill) * 6 : () => 0;
    const res = bestChain(game, (path) =>
        game.goalValue(path) * 3 + path.length + (path.length >= GOLDEN_CHAIN ? 2 : 0) + noise(),
        { maxLen: skill < 1 ? 5 + Math.round(skill * 7) : 14, budget: Math.floor(20000 * skill) + 1500, rng });
    if (!res) return null;
    return game.playChain(res.path);
}

/** Play a whole level. Returns the finished game. */
export function botPlay(game, opts = {}) {
    let guard = 0;
    while (game.status === 'playing' && guard++ < 500) {
        const ev = botStep(game, opts);
        if (!ev) break;
    }
    return game;
}

export { Game };
