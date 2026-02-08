import {
    TILE_SIZE, GRID_COLS, GRID_ROWS, GRID_OFFSET_Y,
    PATH_WAYPOINTS, COLORS,
} from './config.js';
import { state } from './state.js';

// Pre-computed path cell set for quick lookup
const pathCells = new Set();
// World-space waypoints for enemy movement
export const worldPath = [];

function buildPathData() {
    // Build path cells between consecutive waypoints
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
        const from = PATH_WAYPOINTS[i];
        const to = PATH_WAYPOINTS[i + 1];

        if (from.col === to.col) {
            const minR = Math.min(from.row, to.row);
            const maxR = Math.max(from.row, to.row);
            for (let r = minR; r <= maxR; r++) {
                pathCells.add(`${from.col},${r}`);
            }
        } else {
            const minC = Math.min(from.col, to.col);
            const maxC = Math.max(from.col, to.col);
            for (let c = minC; c <= maxC; c++) {
                pathCells.add(`${c},${from.row}`);
            }
        }
    }

    // Build world-space waypoints
    for (const wp of PATH_WAYPOINTS) {
        worldPath.push({
            x: wp.col * TILE_SIZE + TILE_SIZE / 2,
            y: GRID_OFFSET_Y + wp.row * TILE_SIZE + TILE_SIZE / 2,
        });
    }
}

export function isPathCell(col, row) {
    return pathCells.has(`${col},${row}`);
}

export function isBuildable(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (isPathCell(col, row)) return false;
    if (state.isCellOccupied(col, row)) return false;
    return true;
}

export function gridToWorld(col, row) {
    return {
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
    };
}

export function worldToGrid(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor((y - GRID_OFFSET_Y) / TILE_SIZE);
    return { col, row };
}

export function isInGrid(x, y) {
    return y >= GRID_OFFSET_Y && y < GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE &&
           x >= 0 && x < GRID_COLS * TILE_SIZE;
}

// Simple seeded pseudo-random for consistent tile variation
function tileHash(col, row) {
    let h = col * 374761393 + row * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) & 0xff;
}

export function initMap(k) {
    buildPathData();

    // Render grid tiles
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const x = col * TILE_SIZE;
            const y = GRID_OFFSET_Y + row * TILE_SIZE;
            const onPath = isPathCell(col, row);
            const hash = tileHash(col, row);

            if (onPath) {
                // Path tile
                const c = COLORS.path;
                const variation = (hash % 15) - 7;
                k.add([
                    k.pos(x, y),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(c.r + variation, c.g + variation, c.b + variation),
                    k.outline(1, k.rgb(COLORS.pathBorder.r, COLORS.pathBorder.g, COLORS.pathBorder.b)),
                    k.z(0),
                ]);
            } else {
                // Grass tile
                const useAlt = hash % 3 === 0;
                const c = useAlt ? COLORS.grassAlt : COLORS.grass;
                const variation = (hash % 10) - 5;
                k.add([
                    k.pos(x, y),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(c.r + variation, c.g + variation, c.b + variation),
                    k.outline(1, k.rgb(50, 80, 40)),
                    k.opacity(0.95),
                    k.z(0),
                ]);
            }
        }
    }

    // Spawn indicator (left edge)
    const spawnWP = PATH_WAYPOINTS[0];
    const spawnPos = gridToWorld(spawnWP.col, spawnWP.row);
    k.add([
        k.pos(spawnPos.x - TILE_SIZE / 2 + 4, spawnPos.y),
        k.text(">>", { size: 20 }),
        k.color(255, 80, 80),
        k.anchor("left"),
        k.z(1),
    ]);

    // Exit indicator (right edge)
    const exitWP = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    const exitPos = gridToWorld(exitWP.col, exitWP.row);
    k.add([
        k.pos(exitPos.x + TILE_SIZE / 2 - 4, exitPos.y),
        k.text(">>", { size: 20 }),
        k.color(255, 80, 80),
        k.anchor("right"),
        k.z(1),
    ]);
}
