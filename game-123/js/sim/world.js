// The hidden world the cartographer is charting. Pure: it is built from a seed and nothing else, so a
// saved game only has to remember the seed. The player never reads this directly; they chart it.

import { WORLD, T } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { astar } from './path.js';

const W = WORLD.w, H = WORLD.h, N = W * H;

function vnoise(x, y, s) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash3(x0, y0, s), b = hash3(x0 + 1, y0, s), c = hash3(x0, y0 + 1, s), d = hash3(x0 + 1, y0 + 1, s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, s, oct = 4) {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
        sum += vnoise(x * f, y * f, s + o * 131) * amp;
        norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
}

const TOWN_NAMES = ['Ashford', 'Brindle', 'Coldwater', 'Dunmere', 'Eastwick', 'Fallowmoor', 'Greywick', 'Hollin', 'Ironbridge', 'Kestrel Cross', 'Larkhill', 'Marrowdale'];
const HARBOR_NAMES = ['Saltmere', 'Gullhaven', 'Tidewick', 'Brinemouth', 'Skerry Quay', 'Pearlport', 'Kelpgate', 'Windlass'];
const RUIN_NAMES = ['the Ruins of Karth', 'the Sunken Citadel', 'Old Vael', 'the Hollow Keep', 'the Obsidian Court', 'Maren’s Tomb'];
const ORE_NAMES = ['Greyfang Vein', 'Redseam', 'Deepdelve', 'Silverlode', 'Coalback', 'Brightstone', 'Ironmaw', 'Gildspar'];
const SHRINE_NAMES = ['Shrine of Dawn', 'the Weeping Stone', 'Saint Orrin’s Cairn', 'the Moonwell', 'the Hermit’s Chapel', 'the Stag Altar', 'Pilgrim’s Rest'];
const NAMES = {
    town: TOWN_NAMES, harbor: HARBOR_NAMES, ruin: RUIN_NAMES, ore: ORE_NAMES, shrine: SHRINE_NAMES,
    farm: ['Hobb’s Acre', 'Longfield', 'Barleymow', 'Dewdrop Farm', 'Haywain', 'Cobbler’s Rise', 'Thistledown'],
    lighthouse: ['the Lantern Light', 'Cape Beacon'],
    reef: ['a reef'],
};

export const isWater = (t) => t === T.DEEP || t === T.SEA || t === T.SHOAL || t === T.LAKE;
export const isOpenSea = (t) => t === T.DEEP || t === T.SEA || t === T.SHOAL;

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Build the world for a seed. Retries with a nudged seed until it has everything a season needs. */
export function buildWorld(seed) {
    let last = null;
    for (let attempt = 0; attempt < 40; attempt++) {
        const w = tryWorld(seed, attempt);
        w.attempt = attempt;
        last = w;
        if (w.valid) return w;
    }
    return last;
}

function tryWorld(seed, attempt) {
    const s = (((seed | 0) * 7919) + attempt * 104729 + 12345) | 0;
    const rng = makeRng(s ^ 0x5bd1e995);
    const elev = new Float32Array(N), terrain = new Uint8Array(N);

    // ---- elevation and moisture
    const ox = rng.range(0, 99), oy = rng.range(0, 99);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const nx = ((x + 0.5) / W) * 2 - 1, ny = ((y + 0.5) / H) * 2 - 1;
            const d = Math.hypot(nx * 0.92, ny * 1.0);
            const n = fbm(x / 15 + ox, y / 15 + oy, s);
            elev[y * W + x] = n * 1.15 + 0.2 - Math.pow(d, 1.8) * 0.62;
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const e = elev[i];
            const m = fbm(x / 11 + 40 + ox, y / 11 + 70 + oy, s + 7);
            let t;
            if (e < 0.2) t = T.DEEP;
            else if (e < 0.31) t = T.SEA;
            else if (e < 0.37) t = T.SHOAL;
            else if (e < 0.41) t = T.SAND;
            else if (e > 0.8) t = T.MOUNTAIN;
            else if (e > 0.66) t = T.HILLS;
            else if (e < 0.55 && m > 0.66) t = T.SWAMP;
            else if (m > 0.54) t = T.FOREST;
            else if (m < 0.3 && e < 0.62) t = T.DESERT;
            else t = T.PLAINS;
            terrain[i] = t;
        }
    }

    // ---- rivers: downhill from the high ground to the sea, or to a lake where they run out
    let rivers = 0;
    const highs = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (terrain[y * W + x] === T.HILLS || terrain[y * W + x] === T.MOUNTAIN) highs.push([x, y]);
    for (let tries = 0; tries < 120 && rivers < 4 && highs.length; tries++) {
        const [sx, sy] = highs[Math.floor(rng() * highs.length)];
        const path = [], seen = new Set();
        let x = sx, y = sy, ended = 'sink';
        for (let n = 0; n < 140; n++) {
            path.push([x, y]); seen.add(y * W + x);
            let best = -1, be = elev[y * W + x] + 0.012;   // a little uphill is allowed, so a river can spill out of a dip
            for (const [dx, dy] of NB8) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx)) continue;
                const e = elev[ny * W + nx] + hash3(nx, ny, s) * 0.008;
                if (e < be) { be = e; best = ny * W + nx; }
            }
            if (best < 0) break;
            x = best % W; y = (best / W) | 0;
            if (terrain[best] <= T.SAND) { ended = 'sea'; break; }
        }
        if (path.length < 8 || (ended === 'sink' && path.length < 14)) continue;
        for (const [px, py] of path) {
            const i = py * W + px;
            if (terrain[i] > T.SAND) terrain[i] = T.RIVER;
        }
        if (ended === 'sink') {
            const [lx, ly] = path[path.length - 1];
            terrain[ly * W + lx] = T.LAKE;
            for (const [dx, dy] of NB4) {
                const i = (ly + dy) * W + lx + dx;
                if (lx + dx >= 0 && lx + dx < W && ly + dy >= 0 && ly + dy < H && terrain[i] > T.SAND && terrain[i] !== T.RIVER && elev[i] < elev[ly * W + lx] + 0.03) terrain[i] = T.LAKE;
            }
        }
        rivers++;
    }

    // ---- features
    const features = [];
    const featureAt = new Int16Array(N).fill(-1);
    const nameUsed = new Set();
    const add = (kind, x, y) => {
        const pool = NAMES[kind];
        let name = pool[0];
        for (let k = 0; k < 12; k++) { name = rng.pick(pool); if (!nameUsed.has(name) || kind === 'reef') break; }
        nameUsed.add(name);
        const f = { id: features.length, kind, x, y, name };
        features.push(f);
        featureAt[y * W + x] = f.id;
        return f;
    };
    const candidates = (pred) => {
        const out = [];
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (featureAt[y * W + x] < 0 && pred(x, y, terrain[y * W + x])) out.push([x, y]);
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
    };
    const scatter = (kind, count, minDist, pred, avoidKinds = []) => {
        let n = 0;
        for (const [x, y] of candidates(pred)) {
            if (n >= count) break;
            let ok = true;
            for (const f of features) {
                const need = f.kind === kind ? minDist : (avoidKinds.includes(f.kind) ? 6 : 0);
                if (need && Math.hypot(f.x - x, f.y - y) < need) { ok = false; break; }
            }
            if (!ok) continue;
            add(kind, x, y); n++;
        }
        return n;
    };
    const waterAdj = (x, y) => NB4.some(([dx, dy]) => { const t = terrain[(y + dy) * W + x + dx]; return t === T.SEA || t === T.SHOAL || t === T.DEEP; });
    const openWaterNear = (x, y) => NB8.every(([dx, dy]) => terrain[(y + dy) * W + x + dx] !== T.MOUNTAIN);

    scatter('town', 5, 13, (x, y, t) => t === T.PLAINS);
    scatter('harbor', 4, 15, (x, y, t) => t === T.SAND && waterAdj(x, y) && openWaterNear(x, y));
    scatter('farm', 7, 7, (x, y, t) => t === T.PLAINS, ['town']);
    scatter('ruin', 4, 12, (x, y, t) => t === T.FOREST || t === T.HILLS || t === T.DESERT || t === T.SWAMP || t === T.PLAINS, ['town', 'farm']);
    scatter('ore', 9, 4, (x, y, t) => t === T.HILLS || t === T.MOUNTAIN);
    scatter('shrine', 7, 6, (x, y, t) => t === T.HILLS || t === T.FOREST || t === T.MOUNTAIN || t === T.PLAINS, ['town', 'ruin']);
    scatter('lighthouse', 1, 20, (x, y, t) => t === T.SAND && waterAdj(x, y), ['harbor']);

    // ---- reefs: a few on the lane between every pair of harbors, so a chart that misses them wrecks the ship
    const harbors = features.filter((f) => f.kind === 'harbor');
    const shipCost = (i) => {
        const t = terrain[i];
        if (featureAt[i] >= 0 && features[featureAt[i]].kind === 'harbor') return 1;
        if (featureAt[i] >= 0 && features[featureAt[i]].kind === 'reef') return Infinity;
        return t === T.DEEP || t === T.SEA ? 1 : t === T.SHOAL ? 4 : Infinity;
    };
    for (let a = 0; a < harbors.length; a++) {
        for (let b = a + 1; b < harbors.length; b++) {
            const A = harbors[a], B = harbors[b];
            const first = astar(W, H, shipCost, A.x, A.y, B.x, B.y);
            if (!first || first.path.length < 12) continue;
            for (let k = 0; k < 3; k++) {
                const cur = astar(W, H, shipCost, A.x, A.y, B.x, B.y);
                if (!cur || cur.path.length < 12) break;
                const lo = Math.floor(cur.path.length * (0.25 + 0.2 * k)), hi = Math.floor(cur.path.length * (0.45 + 0.2 * k));
                const [rx, ry] = cur.path[rng.int(Math.max(4, lo), Math.min(cur.path.length - 5, Math.max(lo, hi)))];
                const i = ry * W + rx;
                if (featureAt[i] >= 0 || terrain[i] === T.SAND) continue;
                add('reef', rx, ry);
                if (!astar(W, H, shipCost, A.x, A.y, B.x, B.y)) { features.pop(); featureAt[i] = -1; }
            }
        }
    }
    // a few more where the shoals are, for colour
    scatter('reef', 6, 3, (x, y, t) => t === T.SHOAL || t === T.SEA);

    // ---- is it a world a season can be set in?
    let land = 0, plains = 0;
    for (let i = 0; i < N; i++) { const t = terrain[i]; if (t >= T.SAND && t !== T.LAKE) land++; if (t === T.PLAINS) plains++; }
    const landFrac = land / N;
    const count = (k) => features.filter((f) => f.kind === k).length;
    // a 20×14 window must be able to hold three of each prospecting target, or those commissions cannot be set
    const windowMax = (kind) => {
        const fs = features.filter((f) => f.kind === kind);
        let best = 0;
        for (let y = 0; y <= H - 14; y += 2) for (let x = 0; x <= W - 20; x += 2) {
            best = Math.max(best, fs.filter((f) => f.x >= x && f.x < x + 20 && f.y >= y && f.y < y + 14).length);
        }
        return best;
    };
    const valid = windowMax('ore') >= 3 && windowMax('shrine') >= 3 && landFrac > 0.32 && landFrac < 0.64 && plains >= 220
        && count('town') >= 3 && count('harbor') >= 2 && count('ruin') >= 2 && count('ore') >= 5 && count('shrine') >= 4;
    return { w: W, h: H, seed, terrain, elev, features, featureAt, valid, landFrac };
}

export const featureName = (f) => f.name;
export { NAMES };
