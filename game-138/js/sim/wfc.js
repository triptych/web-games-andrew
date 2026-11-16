// Wave function collapse over the tile set in tiles.js. Pure: randomness comes from the rng passed in.
//
// collapse({ w, h, weights, pins, rng }) → Int16Array of tile ids (row-major), or null on a contradiction.
//   weights: Float64Array(T), a tile's weight (0 = never chosen unless pinned)
//   pins:    Map(cellIndex → array of allowed tile ids); a pinned cell may use a weight-0 tile
// The border's outer edges are always rock, so a level never opens onto nothing.

import { TILES, T, COMPAT, DX, DY } from './tiles.js';

const ROCK_EDGE = '###';

export function collapse({ w, h, weights, pins = new Map(), rng }) {
    const n = w * h;
    const dom = new Uint8Array(n * T);          // dom[c*T + t] = 1 while tile t is still possible in cell c
    const count = new Int16Array(n);
    for (let c = 0; c < n; c++) {
        const x = c % w, y = (c / w) | 0;
        const pin = pins.get(c);
        let k = 0;
        for (let t = 0; t < T; t++) {
            const e = TILES[t].edges;
            let ok = pin ? pin.includes(t) : weights[t] > 0;
            if (ok && y === 0 && e[0] !== ROCK_EDGE) ok = false;
            if (ok && x === w - 1 && e[1] !== ROCK_EDGE) ok = false;
            if (ok && y === h - 1 && e[2] !== ROCK_EDGE) ok = false;
            if (ok && x === 0 && e[3] !== ROCK_EDGE) ok = false;
            if (ok) { dom[c * T + t] = 1; k++; }
        }
        if (!k) return null;
        count[c] = k;
    }
    const wt = (t) => (weights[t] > 0 ? weights[t] : 0.05);   // a pinned zero-weight tile still has to be pickable

    // AC-3: when a cell loses options, its neighbours keep only the tiles some remaining option supports.
    const stack = [];
    const propagate = () => {
        while (stack.length) {
            const c = stack.pop();
            const x = c % w, y = (c / w) | 0;
            for (let d = 0; d < 4; d++) {
                const nx = x + DX[d], ny = y + DY[d];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const nc = ny * w + nx;
                if (count[nc] === 1 && done[nc]) continue;
                const allowed = new Uint8Array(T);
                for (let t = 0; t < T; t++) if (dom[c * T + t]) for (const b of COMPAT[d][t]) allowed[b] = 1;
                let changed = false;
                for (let t = 0; t < T; t++) {
                    if (dom[nc * T + t] && !allowed[t]) { dom[nc * T + t] = 0; count[nc]--; changed = true; }
                }
                if (count[nc] === 0) return false;
                if (changed) stack.push(nc);
            }
        }
        return true;
    };
    const done = new Uint8Array(n);
    for (let c = 0; c < n; c++) stack.push(c);
    if (!propagate()) return null;

    for (;;) {
        // the undecided cell with the least weighted entropy (noise breaks ties)
        let best = -1, bestH = Infinity;
        for (let c = 0; c < n; c++) {
            if (done[c]) continue;
            if (count[c] === 1) { done[c] = 1; continue; }
            let sw = 0, swl = 0;
            for (let t = 0; t < T; t++) if (dom[c * T + t]) { const v = wt(t); sw += v; swl += v * Math.log(v); }
            const H = Math.log(sw) - swl / sw + rng() * 1e-3;
            if (H < bestH) { bestH = H; best = c; }
        }
        if (best < 0) break;
        let sw = 0;
        for (let t = 0; t < T; t++) if (dom[best * T + t]) sw += wt(t);
        let r = rng() * sw, pick = -1;
        for (let t = 0; t < T; t++) {
            if (!dom[best * T + t]) continue;
            pick = t;
            r -= wt(t);
            if (r <= 0) break;
        }
        for (let t = 0; t < T; t++) dom[best * T + t] = t === pick ? 1 : 0;
        count[best] = 1;
        done[best] = 1;
        stack.push(best);
        if (!propagate()) return null;
    }
    const out = new Int16Array(n);
    for (let c = 0; c < n; c++) {
        for (let t = 0; t < T; t++) if (dom[c * T + t]) { out[c] = t; break; }
    }
    return out;
}
