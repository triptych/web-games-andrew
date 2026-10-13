// Terrain: a floor and a ceiling as functions of world x. A stage lists keyframes
// [worldX, floorY, ceilY, roughness]; between keys the heights ease with a
// smoothstep, and roughness adds deterministic 1D noise. A floor at or below
// NONE_FLOOR (or a ceiling at or above NONE_CEIL) is "no terrain".
//
// The sim collides against these functions and the view builds its meshes from
// the very same calls, so what you see is exactly what you hit.

import { hash01 } from '../rng.js';
import { H } from '../config.js';

export const NONE_FLOOR = -4;
export const NONE_CEIL = H + 4;
export const MIN_GAP = 5.6;

function vnoise(x, seed) {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = hash01(i, seed), b = hash01(i + 1, seed);
    return (a + (b - a) * u) * 2 - 1;
}

export function fbm1(x, seed) {
    return vnoise(x, seed) * 0.6 + vnoise(x * 2.13 + 17.1, seed + 7) * 0.28 + vnoise(x * 4.7 + 3.3, seed + 13) * 0.12;
}

const smooth = (t) => t * t * (3 - 2 * t);

export class Terrain {
    /** @param keys [[worldX, floor, ceil, rough], ...] sorted by worldX */
    constructor(keys, seed = 1) {
        this.keys = keys;
        this.seed = seed;
        this._i = 0;
    }

    _seg(wx) {
        const k = this.keys;
        if (wx <= k[0][0]) return [k[0], k[0], 0];
        if (wx >= k[k.length - 1][0]) return [k[k.length - 1], k[k.length - 1], 0];
        let i = this._i;
        if (i >= k.length - 1 || k[i][0] > wx || k[i + 1][0] < wx) {
            // binary search; the cache makes sequential sampling O(1)
            let lo = 0, hi = k.length - 2;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                if (k[mid][0] <= wx) lo = mid; else hi = mid - 1;
            }
            i = this._i = lo;
        }
        const a = k[i], b = k[i + 1];
        return [a, b, smooth((wx - a[0]) / Math.max(1e-6, b[0] - a[0]))];
    }

    /** { floor, ceil } at world x. */
    at(wx) {
        const [a, b, t] = this._seg(wx);
        let floor = a[1] + (b[1] - a[1]) * t;
        let ceil = a[2] + (b[2] - a[2]) * t;
        const rough = (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * t;
        if (rough > 0) {
            if (floor > NONE_FLOOR + 0.5) floor += rough * fbm1(wx * 0.21, this.seed);
            if (ceil < NONE_CEIL - 0.5) ceil -= rough * fbm1(wx * 0.19 + 400, this.seed + 3);
        }
        if (ceil - floor < MIN_GAP) {
            const mid = (ceil + floor) / 2;
            floor = mid - MIN_GAP / 2; ceil = mid + MIN_GAP / 2;
        }
        return { floor, ceil };
    }

    floorAt(wx) { return this.at(wx).floor; }
    ceilAt(wx) { return this.at(wx).ceil; }

    hasFloor(wx) { return this.floorAt(wx) > -0.5; }
    hasCeil(wx) { return this.ceilAt(wx) < H + 0.5; }
}
