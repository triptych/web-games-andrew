// Trail search over a scan: is any move left, a hint to show, and the best trail by a scoring
// function (the bot). Depth-first over the 8-neighbour graph with a node budget, so a very
// linkable grid (four senses, a Phoenix trail) can't blow the search up.

import { MIN_CHAIN } from './data/ailments.js';
import { selectable, canLink, goalValue } from './scan.js';

export const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function neighbours(S, r, c) {
    const out = [];
    for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < S.rows && nc >= 0 && nc < S.cols) out.push([nr, nc]);
    }
    return out;
}

/** True if at least one legal trail of MIN_CHAIN exists. */
export function hasMove(S, wild = S.wild) {
    for (let r = 0; r < S.rows; r++) {
        for (let c = 0; c < S.cols; c++) {
            if (!selectable(S, r, c)) continue;
            if (dfsAny(S, [[r, c]], wild)) return true;
        }
    }
    return false;
}

function dfsAny(S, path, wild) {
    if (path.length >= MIN_CHAIN) return true;
    const [r, c] = path[path.length - 1];
    const a = S.cells[r][c].m;
    for (const [nr, nc] of neighbours(S, r, c)) {
        if (!selectable(S, nr, nc)) continue;
        if (path.some(([pr, pc]) => pr === nr && pc === nc)) continue;
        if (!canLink(S, a, S.cells[nr][nc].m, wild)) continue;
        path.push([nr, nc]);
        if (dfsAny(S, path, wild)) return true;
        path.pop();
    }
    return false;
}

/** Best trail by score(path), called on every path of length >= MIN_CHAIN. */
export function bestChain(S, score, { maxLen = 14, budget = 20000, wild = S.wild, rng = null } = {}) {
    let best = null, bestScore = -Infinity, nodes = 0;
    const visited = new Uint8Array(S.rows * S.cols);
    const path = [];
    const starts = [];
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) if (selectable(S, r, c)) starts.push([r, c]);
    if (rng) rng.shuffle(starts);
    const per = Math.max(60, Math.floor(budget / Math.max(1, starts.length)));

    function dfs(r, c, local) {
        if (nodes >= budget || local.n >= per) return;
        nodes++; local.n++;
        path.push([r, c]);
        visited[r * S.cols + c] = 1;
        if (path.length >= MIN_CHAIN) {
            const s = score(path);
            if (s > bestScore) { bestScore = s; best = path.slice(); }
        }
        if (path.length < maxLen) {
            const a = S.cells[r][c].m;
            for (const [nr, nc] of neighbours(S, r, c)) {
                if (visited[nr * S.cols + nc]) continue;
                if (!selectable(S, nr, nc)) continue;
                if (!canLink(S, a, S.cells[nr][nc].m, wild)) continue;
                dfs(nr, nc, local);
            }
        }
        visited[r * S.cols + c] = 0;
        path.pop();
    }

    for (const [r, c] of starts) {
        dfs(r, c, { n: 0 });
        if (nodes >= budget) break;
    }
    return best ? { path: best, score: bestScore } : null;
}

/** A hint: a long trail found quickly, preferring ones that help the goals. */
export function findHint(S) {
    const res = bestChain(S, (p) => p.length + goalValue(S, p) * 0.5, { maxLen: 8, budget: 6000 });
    return res ? res.path : null;
}
