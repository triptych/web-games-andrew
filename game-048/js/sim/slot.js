/**
 * slot.js — reel strips, the visible grid, and payline evaluation.
 *
 * grid[c][r]: column c (reel), row r (0 = top). A line is { rows: [r0..rc] }.
 * A line wins when 3+ symbols from the left match; wilds stand in for any
 * payable symbol. Cores and Glitches never pay on lines.
 */

import { PAYABLE } from './symbols.js';

export function buildStrip(weights, rng) {
    const strip = [];
    for (const id in weights) for (let i = 0; i < weights[id]; i++) strip.push(id);
    rng.shuffle(strip);
    // Spread wilds and cores so a strip never shows two in one window by construction.
    for (const rare of ['wild', 'core']) {
        for (let i = 0; i < strip.length; i++) {
            if (strip[i] !== rare) continue;
            const prev = strip[(i - 1 + strip.length) % strip.length];
            if (prev === rare) {
                for (let j = 0; j < strip.length; j++) {
                    const k = (i + 3 + j) % strip.length;
                    if (strip[k] !== 'wild' && strip[k] !== 'core') { [strip[i], strip[k]] = [strip[k], strip[i]]; break; }
                }
            }
        }
    }
    return strip;
}

export const mod = (a, n) => ((a % n) + n) % n;

/** Symbol of reel `reel` at window row r. */
export function stripAt(reel, r) {
    return reel.strip[mod(reel.pos + r, reel.strip.length)];
}

/**
 * Evaluate a grid. Returns { wins, cores, glitches }.
 * win: { line, sym, len, cells: [[c,r]...], wilds, dir, kind }
 */
export function evaluateGrid(grid, L, lines) {
    const cols = grid.length;
    const rows = grid[0].length;
    const eff = (s) => (s === 'glitch' && L.mods.eater >= 3 ? 'wild' : s);
    const wins = [];

    const scan = (line, li, dir) => {
        let target = null, len = 0, wilds = 0;
        for (let k = 0; k < cols; k++) {
            const c = dir > 0 ? k : cols - 1 - k;
            const s = eff(grid[c][line.rows[c]]);
            if (s === 'wild') { len++; wilds++; continue; }
            if (!PAYABLE.includes(s)) break;
            if (target === null) { target = s; len++; continue; }
            if (s === target) { len++; continue; }
            break;
        }
        if (target === null && len === 0) return null;
        const sym = target ?? 'wild';
        const minLen = L.nearMiss && dir > 0 ? 2 : 3;
        if (len < minLen) return null;
        const cells = [];
        for (let k = 0; k < len; k++) {
            const c = dir > 0 ? k : cols - 1 - k;
            cells.push([c, line.rows[c]]);
        }
        return { line: li, sym, len, cells, wilds, dir, kind: 'line' };
    };

    lines.forEach((line, li) => {
        const w = scan(line, li, 1);
        if (w) wins.push(w);
        if (L.mods.mirror && (!w || w.len < cols)) {
            const m = scan(line, li, -1);
            if (m && m.len >= 3) wins.push(m);
        }
    });

    if (L.mods.cluster) {
        const seen = new Set();
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const s = grid[c][r];
                if (seen.has(c * 10 + r) || !PAYABLE.includes(s)) continue;
                const group = [];
                const stack = [[c, r]];
                seen.add(c * 10 + r);
                while (stack.length) {
                    const [x, y] = stack.pop();
                    group.push([x, y]);
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                        if (seen.has(nx * 10 + ny) || grid[nx][ny] !== s) continue;
                        seen.add(nx * 10 + ny);
                        stack.push([nx, ny]);
                    }
                }
                if (group.length >= L.mods.cluster) {
                    group.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
                    wins.push({ line: -1, sym: s, len: Math.min(5, group.length), cells: group, wilds: 0, dir: 1, kind: 'cluster' });
                }
            }
        }
    }

    let cores = 0, glitches = 0;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        if (grid[c][r] === 'core') cores++;
        else if (grid[c][r] === 'glitch') glitches++;
    }
    return { wins, cores, glitches };
}
