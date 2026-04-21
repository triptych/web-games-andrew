/**
 * WorldGen — Procedural world generation.
 * Returns a Uint8Array of size WORLD_COLS * WORLD_ROWS.
 * Index formula: row * WORLD_COLS + col
 */

import { BLOCK, TIER_ORE_TABLES, TIER_ORE_RATES } from '../data/ores.js';
import { DEPTH_TIERS, WORLD_COLS, WORLD_ROWS, BEDROCK_STRIP_INTERVAL } from '../config.js';

function getTierIndex(row) {
    for (let i = DEPTH_TIERS.length - 1; i >= 0; i--) {
        if (row >= DEPTH_TIERS[i].rowStart) return i;
    }
    return 0;
}

function weightedPick(table, rng) {
    const total = table.reduce((s, e) => s + e.weight, 0);
    let r = rng() * total;
    for (const e of table) {
        r -= e.weight;
        if (r <= 0) return e.block;
    }
    return table[table.length - 1].block;
}

// Simple seeded LCG RNG
function makeLCG(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0xFFFFFFFF;
    };
}

export function generateWorld(seed = 12345) {
    const rng = makeLCG(seed);
    const world = new Uint8Array(WORLD_COLS * WORLD_ROWS);

    function set(row, col, blockId) {
        if (row >= 0 && row < WORLD_ROWS && col >= 0 && col < WORLD_COLS) {
            world[row * WORLD_COLS + col] = blockId;
        }
    }
    function get(row, col) {
        if (row < 0 || row >= WORLD_ROWS || col < 0 || col >= WORLD_COLS) return BLOCK.BEDROCK;
        return world[row * WORLD_COLS + col];
    }

    // --- Pass 1: fill all with tier fill block ---
    for (let row = 0; row < WORLD_ROWS; row++) {
        const tierIdx = getTierIndex(row);
        const fillBlock = DEPTH_TIERS[tierIdx].fillBlock;
        for (let col = 0; col < WORLD_COLS; col++) {
            set(row, col, fillBlock);
        }
    }

    // --- Pass 2: borders = bedrock ---
    for (let row = 0; row < WORLD_ROWS; row++) {
        set(row, 0, BLOCK.BEDROCK);
        set(row, WORLD_COLS - 1, BLOCK.BEDROCK);
    }

    // --- Pass 3: horizontal bedrock strips with gaps ---
    for (let row = BEDROCK_STRIP_INTERVAL; row < WORLD_ROWS; row += BEDROCK_STRIP_INTERVAL) {
        const gapCol = 1 + Math.floor(rng() * (WORLD_COLS - 5));
        for (let col = 1; col < WORLD_COLS - 1; col++) {
            if (col < gapCol || col > gapCol + 2) {
                set(row, col, BLOCK.BEDROCK);
            }
        }
    }

    // --- Pass 4: ore placement ---
    for (let row = 0; row < WORLD_ROWS; row++) {
        const tierIdx = getTierIndex(row);
        const oreRate = TIER_ORE_RATES[tierIdx];
        const oreTable = TIER_ORE_TABLES[tierIdx];

        for (let col = 1; col < WORLD_COLS - 1; col++) {
            const existing = get(row, col);
            // Skip bedrock
            if (existing === BLOCK.BEDROCK) continue;

            if (rng() < oreRate) {
                set(row, col, weightedPick(oreTable, rng));
            }
        }
    }

    // --- Pass 5: lava pockets ---
    for (let row = 0; row < WORLD_ROWS; row++) {
        const tierIdx = getTierIndex(row);
        const lavaRate = DEPTH_TIERS[tierIdx].lavaRate;
        if (lavaRate <= 0) continue;

        for (let col = 1; col < WORLD_COLS - 1; col++) {
            if (get(row, col) === BLOCK.STONE && rng() < lavaRate) {
                // Small lava cluster (1-3 tiles)
                set(row, col, BLOCK.LAVA);
                if (rng() < 0.4 && col + 1 < WORLD_COLS - 1) set(row, col + 1, BLOCK.LAVA);
            }
        }
    }

    // --- Pass 6: cave generation (cellular automata) for tiers 3+ ---
    for (const tier of DEPTH_TIERS) {
        if (tier.caveRate <= 0) continue;

        // Initial random fill for CA
        const caGrid = new Uint8Array(WORLD_COLS * (tier.rowEnd - tier.rowStart + 1));
        const rows = tier.rowEnd - tier.rowStart + 1;
        const offset = tier.rowStart;

        for (let r = 0; r < rows; r++) {
            for (let col = 1; col < WORLD_COLS - 1; col++) {
                caGrid[r * WORLD_COLS + col] = rng() < 0.45 ? 0 : 1; // 0=cave, 1=solid
            }
        }

        // 3 CA passes
        for (let pass = 0; pass < 3; pass++) {
            const next = caGrid.slice();
            for (let r = 1; r < rows - 1; r++) {
                for (let col = 1; col < WORLD_COLS - 1; col++) {
                    let solidNeighbors = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const nr = r + dr, nc = col + dc;
                            if (nr < 0 || nr >= rows || nc < 0 || nc >= WORLD_COLS) { solidNeighbors++; continue; }
                            solidNeighbors += caGrid[nr * WORLD_COLS + nc];
                        }
                    }
                    next[r * WORLD_COLS + col] = solidNeighbors >= 5 ? 1 : 0;
                }
            }
            caGrid.set(next);
        }

        // Apply caves to world — only carve if cave probability threshold met
        for (let r = 0; r < rows; r++) {
            for (let col = 1; col < WORLD_COLS - 1; col++) {
                if (caGrid[r * WORLD_COLS + col] === 0 && rng() < tier.caveRate) {
                    const worldRow = offset + r;
                    if (get(worldRow, col) !== BLOCK.BEDROCK) {
                        set(worldRow, col, BLOCK.AIR);
                    }
                }
            }
        }
    }

    // --- Pass 7: ensure surface entry shaft (col 58-62, rows 0-5 are clear) ---
    for (let row = 0; row < 6; row++) {
        for (let col = 57; col <= 63; col++) {
            if (get(row, col) !== BLOCK.BEDROCK) set(row, col, BLOCK.AIR);
        }
    }

    // --- Pass 8: Singing Vein cluster near rows 350-380 (hidden but findable) ---
    const svRow = 355 + Math.floor(rng() * 20);
    const svCol = 10 + Math.floor(rng() * (WORLD_COLS - 20));
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (get(svRow + dr, svCol + dc) !== BLOCK.BEDROCK) {
                set(svRow + dr, svCol + dc, BLOCK.SINGING_VEIN);
            }
        }
    }

    return world;
}

export function getBlock(world, row, col) {
    if (row < 0 || row >= WORLD_ROWS || col < 0 || col >= WORLD_COLS) return BLOCK.BEDROCK;
    return world[row * WORLD_COLS + col];
}

export function setBlock(world, row, col, blockId) {
    if (row >= 0 && row < WORLD_ROWS && col >= 0 && col < WORLD_COLS) {
        world[row * WORLD_COLS + col] = blockId;
    }
}

export function getTileDepthMeters(row) {
    return row * 16; // TILE_SIZE = 16
}

export function getTierAtRow(row) {
    return getTierIndex(row);
}
