/**
 * search.js — trail search over a Game: is any move left, a hint to show,
 * and the best trail by a scoring function (used by the bot).
 *
 * All searches are depth-first over the 8-neighbour graph with a node
 * budget, so a very linkable blanket (four senses, rainbow wings) can't
 * blow up the search.
 */

import { MIN_CHAIN } from '../config.js';

export const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function neighbours(game, r, c) {
    const out = [];
    for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < game.rows && nc >= 0 && nc < game.cols) out.push([nr, nc]);
    }
    return out;
}

/** True if at least one legal trail of MIN_CHAIN exists. */
export function hasMove(game, wild = game.wild) {
    for (let r = 0; r < game.rows; r++) {
        for (let c = 0; c < game.cols; c++) {
            if (!game.selectable(r, c)) continue;
            if (_dfsAny(game, [[r, c]], wild)) return true;
        }
    }
    return false;
}

function _dfsAny(game, path, wild) {
    if (path.length >= MIN_CHAIN) return true;
    const [r, c] = path[path.length - 1];
    const a = game.cells[r][c].fruit;
    for (const [nr, nc] of neighbours(game, r, c)) {
        if (!game.selectable(nr, nc)) continue;
        if (path.some(([pr, pc]) => pr === nr && pc === nc)) continue;
        if (!game.canLink(a, game.cells[nr][nc].fruit, wild)) continue;
        path.push([nr, nc]);
        if (_dfsAny(game, path, wild)) return true;
        path.pop();
    }
    return false;
}

/**
 * Best trail by `score(path)` (called on every path of length >= MIN_CHAIN).
 * maxLen caps trail length, budget caps visited nodes overall.
 */
export function bestChain(game, score, { maxLen = 14, budget = 20000, wild = game.wild, rng = null } = {}) {
    let best = null, bestScore = -Infinity, nodes = 0;
    const visited = new Uint8Array(game.rows * game.cols);
    const path = [];

    const starts = [];
    for (let r = 0; r < game.rows; r++) for (let c = 0; c < game.cols; c++) if (game.selectable(r, c)) starts.push([r, c]);
    if (rng) rng.shuffle(starts);
    // Share the budget so every start gets a look.
    const per = Math.max(60, Math.floor(budget / Math.max(1, starts.length)));

    function dfs(r, c, local) {
        if (nodes >= budget || local.n >= per) return;
        nodes++; local.n++;
        path.push([r, c]);
        visited[r * game.cols + c] = 1;
        if (path.length >= MIN_CHAIN) {
            const s = score(path);
            if (s > bestScore) { bestScore = s; best = path.slice(); }
        }
        if (path.length < maxLen) {
            const a = game.cells[r][c].fruit;
            for (const [nr, nc] of neighbours(game, r, c)) {
                if (visited[nr * game.cols + nc]) continue;
                if (!game.selectable(nr, nc)) continue;
                if (!game.canLink(a, game.cells[nr][nc].fruit, wild)) continue;
                dfs(nr, nc, local);
            }
        }
        visited[r * game.cols + c] = 0;
        path.pop();
    }

    for (const [r, c] of starts) {
        dfs(r, c, { n: 0 });
        if (nodes >= budget) break;
    }
    return best ? { path: best, score: bestScore } : null;
}

/** A hint: the longest trail found quickly, preferring ones that help goals. */
export function findHint(game) {
    const res = bestChain(game, (p) => p.length + game.goalValue(p) * 0.5, { maxLen: 8, budget: 6000 });
    return res ? res.path : null;
}
