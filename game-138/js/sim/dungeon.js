// The dungeon generator. Pure: generate(params) always builds the same dungeon from the same params.
//
// Each level is a wave function collapse over the tile set in tiles.js, with its stairs pinned first: the stairs down
// on level k and the stairs up on level k+1 share a cell, so walking down lands you under the stairs you took.
// After the collapse the level is proved: the part reachable from the stairs up (moving through walkable edges) must
// hold the stairs down and cover a sensible share of the map; everything else is filled with rock. A level that fails
// is collapsed again with the rng's next numbers; after GEN.tries attempts the player's painted pins are loosened.

import { TILES, FAMILIES, DX, DY, tilesOf, isWalk, BRUSHES } from './tiles.js';
import { collapse } from './wfc.js';
import { makeRng, hashString } from '../rng.js';
import { SIZES, GEN } from '../config.js';
import { THEMES } from './data/themes.js';
import { placeFeatures } from './features.js';

const ROCK = TILES.findIndex((t) => t.fam === 'rock');
const STAIRS_DOWN = tilesOf(['stairsDown']);
const STAIRS_UP = tilesOf(['stairsUp']);
const SPACER = tilesOf(['rock', 'tunnel', 'bend', 'tee', 'cross', 'dead']);

/**
 * Spacers: a jittered lattice of cells that may only be rock or tunnel. Without them the open floor tile spreads and
 * every chamber merges into one cavern; with them chambers stay chamber-sized and tunnels run between them.
 * Busier "chambers" settings spread the lattice out, so rooms grow.
 */
function spacers(rng, w, h, mix) {
    const S = mix.chambers >= 8 ? 6 : mix.chambers >= 6 ? 5 : 4;
    const out = [];
    for (let y = rng.int(1, 2); y < h - 1; y += S) {
        for (let x = rng.int(1, 3); x < w - 1; x += S) {
            out.push({ x: Math.min(w - 2, x + rng.int(-1, 1)), y: Math.min(h - 2, Math.max(1, y + rng.int(-1, 1))) });
        }
    }
    return out;
}

/** A tile's weight from the mix sliders (0–9; 5 is the tile set's own balance, 0 turns a kind off). */
export function tileWeights(mix) {
    return Float64Array.from(TILES, (t) => {
        const f = FAMILIES[t.fam];
        if (f.mix === 'never') return 0;
        if (!f.mix) return t.w;
        const v = mix[f.mix] ?? 5;
        return v <= 0 ? 0 : t.w * Math.pow(v / 5, 1.7);
    });
}

const edgeOpen = (e) => e !== '###';

/** Cells reachable from `from` through open edges. Returns a Uint8Array mask. */
function reachCells(tiles, w, h, from) {
    const seen = new Uint8Array(w * h);
    const q = [from];
    seen[from] = 1;
    while (q.length) {
        const c = q.pop(), x = c % w, y = (c / w) | 0;
        for (let d = 0; d < 4; d++) {
            const nx = x + DX[d], ny = y + DY[d];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nc = ny * w + nx;
            if (seen[nc] || !edgeOpen(TILES[tiles[c]].edges[d])) continue;
            seen[nc] = 1;
            q.push(nc);
        }
    }
    return seen;
}

/** Where every level's stairs go, decided before any level is collapsed. */
function placeStairs(rng, w, h, n) {
    const inner = () => ({ x: rng.int(1, w - 2), y: rng.int(1, h - 2) });
    const diag = Math.hypot(w, h);
    const up = [inner()];
    const down = [];
    for (let k = 0; k < n; k++) {
        if (k === n - 1) break;
        let best = null, bd = -1;
        for (let i = 0; i < 16; i++) {
            const c = inner();
            const d = Math.hypot(c.x - up[k].x, c.y - up[k].y);
            if (d > bd) { bd = d; best = c; }
            if (d >= diag * GEN.stairsGap && i >= 3) break;
        }
        down.push(best);
        up.push(best);
    }
    return { up, down };
}

/** Collapse one level. Returns { tiles, loosened } (tiles already pruned to the reachable part). */
function collapseLevel({ w, h, weights, up, down, pins, rng, spacing }) {
    const upC = up.y * w + up.x, downC = down ? down.y * w + down.x : -1;
    const tryWith = (userPins, tries, wts = weights) => {
        const map = new Map();
        for (const sp of spacing) {
            // spacers keep clear of the stairs and of painted squares: a painted chamber needs open neighbours
            if ([up, down, ...userPins].some((s) => s && Math.abs(s.x - sp.x) <= 1 && Math.abs(s.y - sp.y) <= 1)) continue;
            map.set(sp.y * w + sp.x, SPACER);
        }
        for (const p of userPins) map.set(p.y * w + p.x, tilesOf(BRUSHES[p.b].fams));
        map.set(upC, STAIRS_UP);
        if (down) map.set(downC, STAIRS_DOWN);
        for (let a = 0; a < tries; a++) {
            const tiles = collapse({ w, h, weights: wts, pins: map, rng });
            if (!tiles) continue;
            const seen = reachCells(tiles, w, h, upC);
            if (down && !seen[downC]) continue;
            // a painted square must end up in the dungeon, not in a pocket the pruning below would fill in
            if (userPins.some((p) => p.b !== 'rock' && !seen[p.y * w + p.x])) continue;
            let kept = 0;
            for (let c = 0; c < w * h; c++) {
                if (!seen[c]) tiles[c] = ROCK;
                else if (tiles[c] !== ROCK) kept++;
            }
            const frac = kept / (w * h);
            if (frac < GEN.minWalk || frac > GEN.maxWalk) continue;
            return tiles;
        }
        return null;
    };
    let tiles = pins.length ? tryWith(pins, GEN.tries) : null;
    if (tiles) return { tiles, loosened: false };
    tiles = tryWith([], GEN.tries * 3);
    if (tiles) return { tiles, loosened: pins.length > 0 };
    // the mix can be set so that nothing fits (no tunnels and no chambers): fall back to the default balance
    tiles = tryWith([], 400, tileWeights({}));
    if (!tiles) throw new Error('level could not be generated');
    return { tiles, loosened: true, fallback: true };
}

/** The micro grid: one character per micro cell, as an array of row strings. */
function microGrid(tiles, w, h) {
    const rows = [];
    for (let y = 0; y < h; y++) {
        for (let r = 0; r < 3; r++) {
            let s = '';
            for (let x = 0; x < w; x++) s += TILES[tiles[y * w + x]].rows[r];
            rows.push(s);
        }
    }
    return rows;
}

/** Chambers: groups of room-family cells joined by open edges. */
function findRooms(tiles, w, h) {
    const roomOf = new Int16Array(w * h).fill(-1);
    const rooms = [];
    for (let c = 0; c < w * h; c++) {
        if (roomOf[c] >= 0 || !FAMILIES[TILES[tiles[c]].fam].room) continue;
        const room = { id: rooms.length, cells: [] };
        const q = [c];
        roomOf[c] = room.id;
        while (q.length) {
            const k = q.pop(), x = k % w, y = (k / w) | 0;
            room.cells.push(k);
            for (let d = 0; d < 4; d++) {
                const nx = x + DX[d], ny = y + DY[d];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const nc = ny * w + nx;
                if (roomOf[nc] >= 0 || !FAMILIES[TILES[tiles[nc]].fam].room || !edgeOpen(TILES[tiles[k]].edges[d])) continue;
                roomOf[nc] = room.id;
                q.push(nc);
            }
        }
        rooms.push(room);
    }
    return { rooms, roomOf };
}

/** Waterfalls: every spout tile pours from its rock edge into the water micro cell beside it. */
function findSpouts(tiles, w, h) {
    const out = [];
    for (let c = 0; c < w * h; c++) {
        const t = TILES[tiles[c]];
        if (t.fam !== 'spout') continue;
        const x = c % w, y = (c / w) | 0;
        const dir = t.edges.findIndex((e) => e === '###');
        // the water micro cell against the wall is the tile's centre (the wall is the row or column beyond it)
        const mx = x * 3 + 1, my = y * 3 + 1;
        out.push({ cx: x, cy: y, dir, mx, my });
    }
    return out;
}

function levelName(rng, theme) {
    const th = THEMES[theme];
    return `The ${rng.pick(th.adj)} ${rng.pick(th.words)}`;
}

/**
 * Build the whole dungeon. params are normalised (js/sim/share.js normalize()).
 * Returns { w, h, mw, mh, levels: [{ k, theme, name, tiles, grid, rooms, roomOf, spouts, up, down, features, loosened }] }
 */
export function generate(params) {
    const size = SIZES[params.size] || SIZES.m;
    const { w, h } = size;
    const seed = hashString(params.seed);
    const n = params.levels;
    const stairs = placeStairs(makeRng(seed ^ 0x51a1e5), w, h, n);
    const weights = tileWeights(params.mix);
    const levels = [];
    for (let k = 0; k < n; k++) {
        const rng = makeRng(seed + Math.imul(k + 1, 0x9e3779b1));
        const pins = params.pins.filter((p) => p.l === k && p.x > 0 && p.y > 0 && p.x < w - 1 && p.y < h - 1);
        const up = stairs.up[k], down = stairs.down[k] || null;
        const spacing = spacers(rng, w, h, params.mix);
        const { tiles, loosened, fallback } = collapseLevel({ w, h, weights, up, down, pins, rng, spacing });
        const theme = params.themes[k];
        const { rooms, roomOf } = findRooms(tiles, w, h);
        const L = {
            k, theme, name: levelName(makeRng(seed ^ Math.imul(k + 7, 0x85ebca6b)), theme),
            w, h, mw: w * 3, mh: h * 3,
            tiles: Array.from(tiles), grid: microGrid(tiles, w, h), rooms, roomOf: Array.from(roomOf),
            spouts: findSpouts(tiles, w, h),
            up: { cx: up.x, cy: up.y, mx: up.x * 3 + 1, my: up.y * 3 + 1 },
            down: down ? { cx: down.x, cy: down.y, mx: down.x * 3 + 1, my: down.y * 3 + 1 } : null,
            loosened: !!loosened, fallback: !!fallback,
        };
        L.features = placeFeatures(L, params, makeRng(seed ^ Math.imul(k + 3, 0xc2b2ae35)), k === n - 1);
        levels.push(L);
    }
    return { w, h, mw: w * 3, mh: h * 3, levels };
}

export { isWalk };
