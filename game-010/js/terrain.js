/**
 * terrain.js — Pre-generates biome tiles for the Tiny Town grid.
 *
 * Each grid cell gets a terrain type (field, grassland, mountain, lake)
 * assigned at game start. Terrain is drawn as the bottom layer and is
 * always visible whether or not a building sits on the cell (the building
 * tile draws on top with slight transparency).
 *
 * Usage:
 *   import { generateTerrain, getTerrainAt, drawTerrainLayer } from './terrain.js';
 *   generateTerrain();                    // call once at scene start
 *   drawTerrainLayer(k, gridToScreen);    // draw all background tiles
 */

import { GRID_COLS, GRID_ROWS, TILE_SIZE, TERRAIN, TERRAIN_KEYS } from './config.js';

// 2D array [row][col] = terrain key string
let _terrain = [];

// Simple seeded noise helpers — group tiles into biome blobs using
// a 2D gradient noise approximation (smooth random walk).
function _seededRandom(seed) {
    // xorshift32
    let s = seed | 0;
    return function () {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return (s >>> 0) / 0xffffffff;
    };
}

/**
 * Generate terrain for the grid.
 * Uses blob-based random fill so biomes form natural-looking patches.
 */
export function generateTerrain() {
    const rng = _seededRandom(Date.now() ^ 0xdeadbeef);
    _terrain = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

    // Assign each tile a biome value based on a smooth noise approach:
    // generate a float grid then bucket into terrain types.
    const floats = Array.from({ length: GRID_ROWS }, () => new Float32Array(GRID_COLS));

    // Seed random "centres" that bias nearby tiles towards one type
    const CENTRES = 14;
    const centres = [];
    for (let i = 0; i < CENTRES; i++) {
        centres.push({
            col:  rng() * GRID_COLS,
            row:  rng() * GRID_ROWS,
            val:  rng(),
        });
    }

    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            // Weighted sum of nearest centres (inverse-distance)
            let totalW = 0;
            let totalV = 0;
            for (const c of centres) {
                const dx = col - c.col;
                const dy = row - c.row;
                const d2 = dx * dx + dy * dy + 0.0001;
                const w  = 1 / d2;
                totalW += w;
                totalV += w * c.val;
            }
            floats[row][col] = totalV / totalW;
        }
    }

    // Map float [0,1) → terrain bucket
    const n = TERRAIN_KEYS.length;
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            // Use custom thresholds so lake is rarer (20%), mountain moderate (20%)
            const v = floats[row][col];
            let key;
            if (v < 0.20) key = 'lake';
            else if (v < 0.40) key = 'mountain';
            else if (v < 0.70) key = 'field';
            else key = 'grassland';
            _terrain[row][col] = key;
        }
    }
}

export function getTerrainAt(col, row) {
    return _terrain[row]?.[col] ?? 'field';
}

/** Returns a deep copy of the terrain grid for serialisation. */
export function getTerrainGrid() {
    return _terrain.map(row => [...row]);
}

/** Restores terrain from a previously saved grid (skips random generation). */
export function setTerrainGrid(grid) {
    _terrain = grid.map(row => [...row]);
}

/**
 * Draw all terrain background tiles into Kaplay.
 * Call once per scene after generateTerrain().
 * Returns an array of all created entities (for cleanup on reset).
 */
export function drawTerrainLayer(k, gridToScreen) {
    const entities = [];
    const PAD = 0; // terrain fills the full tile with no gap

    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const key    = _terrain[row][col];
            const def    = TERRAIN[key];
            const { x, y } = gridToScreen(col, row);

            // Base fill
            const base = k.add([
                k.pos(x + PAD, y + PAD),
                k.rect(TILE_SIZE - PAD * 2, TILE_SIZE - PAD * 2),
                k.color(...def.color),
                k.z(2),
            ]);
            entities.push(base);

            // Small accent detail — a tiny dot or stripe per biome type
            entities.push(..._drawTerrainDetail(k, key, def, x, y));
        }
    }

    return entities;
}

function _drawTerrainDetail(k, key, def, x, y) {
    const T = TILE_SIZE;
    const cx = x + T / 2;
    const cy = y + T / 2;
    const out = [];

    if (key === 'field') {
        // Two small horizontal strips like crop rows
        for (let i = 0; i < 3; i++) {
            out.push(k.add([
                k.pos(x + 5, y + 8 + i * 10),
                k.rect(T - 10, 2),
                k.color(...def.accent),
                k.opacity(0.5),
                k.z(3),
            ]));
        }
    } else if (key === 'grassland') {
        // Tiny scattered dots
        const offsets = [[6,6],[16,12],[8,22],[22,8],[24,20],[12,28]];
        for (const [ox, oy] of offsets) {
            out.push(k.add([
                k.pos(x + ox, y + oy),
                k.rect(3, 4),
                k.color(...def.accent),
                k.opacity(0.6),
                k.z(3),
            ]));
        }
    } else if (key === 'mountain') {
        // Simple triangle-like shape using stacked rects
        const rows = [
            { w: 6,  top: 6  },
            { w: 12, top: 12 },
            { w: 18, top: 18 },
        ];
        for (const r of rows) {
            out.push(k.add([
                k.pos(cx - r.w / 2, y + r.top),
                k.rect(r.w, 4),
                k.color(...def.accent),
                k.opacity(0.65),
                k.z(3),
            ]));
        }
    } else if (key === 'lake') {
        // Soft oval approximated by a smaller inset rect with rounded look
        out.push(k.add([
            k.pos(cx, cy),
            k.rect(T - 12, T - 14),
            k.color(...def.accent),
            k.anchor('center'),
            k.opacity(0.45),
            k.z(3),
        ]));
        // Tiny highlight stripe
        out.push(k.add([
            k.pos(cx - 4, cy - 3),
            k.rect(8, 2),
            k.color(140, 190, 255),
            k.anchor('center'),
            k.opacity(0.5),
            k.z(3),
        ]));
    }

    return out;
}
