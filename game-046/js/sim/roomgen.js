/**
 * roomgen.js — procedural room layouts.
 *
 * Every room is 11 columns wide and 11–21 rows tall. A pattern (scatter,
 * pillars, bars, pools, lanes, ring, noise, arena, shrine) lays obstacles on
 * the left half and mirrors them — Archero's rooms read as designed because
 * they are symmetric. Obstacles are ROCK (blocks walking and arrows) or PIT
 * (water / lava / chasm by biome: blocks walking, arrows fly over), in the
 * proportion the chapter's recipe asks for; later chapters add SPIKE traps.
 *
 * Validation: the door must be reachable from the spawn, most of the floor
 * must be reachable, and sealed-off pockets are filled in, so an enemy can
 * never spawn somewhere the player cannot get to. A layout that fails is
 * re-rolled from the same seed stream; the last resort is an open arena.
 */

import { makeRng } from './rng.js';
import { makeGrid, cellAt, setCell, flowField, walkable, FLOOR, ROCK, PIT, SPIKE } from './grid.js';

const COLS = 11;
const MID = 5;

const SHAPES = [
    [[0, 0]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2]],
];

function put(g, c, r, t) {
    if (c < 0 || c >= COLS || r < 0 || r >= g.rows) return;
    setCell(g, c, r, t);
    setCell(g, COLS - 1 - c, r, t);
}

const obstacle = (rng, gen) => (rng.chance(gen.pit) ? PIT : ROCK);

const PATTERNS = {
    scatter(g, rng, gen) {
        const n = rng.int(3, 3 + Math.floor(g.rows / 5));
        for (let i = 0; i < n; i++) {
            const shape = rng.pick(SHAPES), t = obstacle(rng, gen);
            const c = rng.int(0, 4), r = rng.int(3, g.rows - 5);
            for (const [dc, dr] of shape) if (c + dc <= 4) put(g, c + dc, r + dr, t);
        }
        if (rng.chance(0.4)) {
            const r = rng.int(5, g.rows - 6);
            setCell(g, MID, r, obstacle(rng, gen));
        }
    },
    pillars(g, rng, gen) {
        const step = rng.int(3, 4);
        const cols = rng.pick([[1, 3], [2], [1, 4], [3]]);
        const big = rng.chance(0.3);
        const t = rng.chance(gen.pit * 0.5) ? PIT : ROCK;
        for (let r = 4; r < g.rows - 4; r += step) {
            for (const c of cols) {
                put(g, c, r, t);
                if (big) { put(g, c, r + 1, t); if (c < 4) put(g, c + 1, r, t), put(g, c + 1, r + 1, t); }
            }
        }
    },
    bars(g, rng, gen) {
        let side = rng.chance(0.5);
        const mirrored = rng.chance(0.4);
        for (let r = 4; r < g.rows - 4; r += rng.int(3, 5)) {
            const t = obstacle(rng, gen);
            if (mirrored) {
                const len = rng.int(2, 3);
                for (let c = 0; c < len; c++) put(g, c, r, t);
            } else {
                const len = rng.int(4, 7);
                for (let c = 0; c < len; c++) setCell(g, side ? c : COLS - 1 - c, r, t);
                side = !side;
            }
        }
    },
    pools(g, rng, gen) {
        const count = g.rows > 17 ? 2 : 1;
        const band = (g.rows - 8) / count;
        for (let k = 0; k < count; k++) {
            const h = rng.int(2, 3);
            const r0 = Math.floor(4 + band * k + rng.range(0, Math.max(0, band - h - 1)));
            const c0 = rng.int(1, 3);
            const t = rng.chance(Math.max(0.35, gen.pit)) ? PIT : ROCK;
            for (let r = r0; r < r0 + h; r++) for (let c = c0; c <= MID; c++) put(g, c, r, t);
            // A bridge: through the middle, or around the sides.
            if (rng.chance(0.5)) for (let r = r0; r < r0 + h; r++) setCell(g, MID, r, FLOOR);
        }
        if (rng.chance(0.6)) put(g, 0, rng.int(4, g.rows - 5), ROCK);
    },
    lanes(g, rng, gen) {
        const c = rng.pick([2, 3]);
        const t = rng.chance(Math.max(0.4, gen.pit)) ? PIT : ROCK;
        for (let r = 4; r < g.rows - 4; r++) put(g, c, r, t);
        // Gaps so the lanes connect.
        const gaps = rng.int(1, 2);
        for (let i = 0; i < gaps; i++) {
            const r = rng.int(5, g.rows - 6);
            put(g, c, r, FLOOR); put(g, c, r + 1, FLOOR);
        }
        if (rng.chance(0.6)) setCell(g, MID, Math.floor(g.rows / 2), ROCK);
    },
    ring(g, rng, gen) {
        const cy = Math.floor(g.rows / 2), rad = rng.int(2, 3);
        const t = obstacle(rng, gen);
        for (let r = cy - rad; r <= cy + rad; r++) {
            for (let c = MID - rad; c <= MID; c++) {
                const edge = r === cy - rad || r === cy + rad || c === MID - rad;
                const gap = r === cy || c === MID;
                if (edge && !gap) put(g, c, r, t);
            }
        }
        if (rng.chance(0.5)) setCell(g, MID, cy, ROCK);
    },
    noise(g, rng, gen) {
        for (let r = 3; r < g.rows - 3; r++) {
            for (let c = 0; c <= MID; c++) {
                if (rng.chance(0.13)) put(g, c, r, obstacle(rng, gen));
            }
        }
    },
    arena(g, rng, gen) {
        const a = Math.round(g.rows * 0.33), b = Math.round(g.rows * 0.66);
        const c = rng.pick([1, 2]);
        put(g, c, a, ROCK); put(g, c, b, ROCK);
        if (rng.chance(gen.pit)) { put(g, 0, a + 2, PIT); put(g, 0, a + 3, PIT); }
    },
    shrine(g) {
        put(g, 1, 3, ROCK); put(g, 1, g.rows - 3, ROCK);
    },
};

/** Tiles reachable on foot from the spawn, plus whether the door is. */
function reachability(g) {
    const dist = flowField(g, MID, 1);
    let reach = 0, open = 0;
    for (let i = 0; i < dist.length; i++) {
        if (walkable(g.cells[i])) { open++; if (dist[i] < 9999) reach++; }
    }
    return { dist, reach, open, door: dist[(g.rows - 1) * COLS + MID] < 9999 };
}

function carveSafe(g) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < COLS; c++) setCell(g, c, r, FLOOR);
    for (let r = g.rows - 2; r < g.rows; r++) for (let c = 3; c <= 7; c++) setCell(g, c, r, FLOOR);
}

/**
 * @param {number} seed
 * @param {'combat'|'angel'|'miniboss'|'boss'} kind
 * @param {{pit:number, spikes:number, patterns:Object}} gen
 */
export function generateRoom(seed, kind, gen) {
    const rng = makeRng(seed);
    const rows = kind === 'boss' ? 17 : kind === 'angel' ? 11 : kind === 'miniboss' ? 15 : rng.int(15, 21);

    for (let attempt = 0; attempt < 40; attempt++) {
        const g = makeGrid(COLS, rows);
        const pattern = kind === 'angel' ? 'shrine'
            : (kind === 'boss' || kind === 'miniboss') ? 'arena'
            : rng.weighted(gen.patterns);
        PATTERNS[pattern](g, rng, gen);
        carveSafe(g);

        let blocked = 0;
        for (const v of g.cells) if (v !== FLOOR) blocked++;
        if (blocked / g.cells.length > 0.34) continue;

        const r = reachability(g);
        if (!r.door || r.reach < r.open * 0.8 || r.reach < g.cells.length * 0.55) continue;

        // Seal pockets nobody can walk into, so nothing spawns there.
        for (let i = 0; i < g.cells.length; i++) {
            if (walkable(g.cells[i]) && r.dist[i] >= 9999) g.cells[i] = ROCK;
        }
        // Spike traps on reachable floor, away from the spawn and the door.
        if (gen.spikes > 0 && kind === 'combat') {
            for (let rr = 4; rr < rows - 3; rr++) {
                for (let c = 0; c <= MID; c++) {
                    if (cellAt(g, c, rr) === FLOOR && rng.chance(gen.spikes)) {
                        put(g, c, rr, SPIKE);
                        if (rng.chance(0.5) && cellAt(g, c, rr + 1) === FLOOR) put(g, c, rr + 1, SPIKE);
                    }
                }
            }
        }
        return { cols: COLS, rows, grid: g, pattern, kind, seed, attempts: attempt + 1 };
    }

    const g = makeGrid(COLS, rows);
    PATTERNS.arena(g, rng, { pit: 0 });
    carveSafe(g);
    return { cols: COLS, rows, grid: g, pattern: 'arena', kind, seed, attempts: 41 };
}
