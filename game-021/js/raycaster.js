/**
 * raycaster.js — Software raycaster with procedural brick/stone textures.
 *
 * Texturing approach (no image assets):
 *   - wallX  : fractional hit position along the wall face (0..1)
 *   - Bricks : horizontal mortar lines every BRICK_H fraction of wall height,
 *              offset alternately so rows interlock like real brickwork.
 *   - N/S faces are drawn slightly darker than E/W (Wolfenstein shading).
 *   - Distance attenuation darkens everything further away.
 */

import { TILE_WALL, TILE_DOOR, VIEW_WIDTH, VIEW_HEIGHT, FOV_DEGREES, RAY_COUNT, MAX_DEPTH } from './config.js';

const FOV  = (FOV_DEGREES * Math.PI) / 180;
const HALF = FOV / 2;

// Base RGB for each tile type, light face
const TILE_BASE = {
    [TILE_WALL]: { r: 160, g: 130, b: 90 },
    [TILE_DOOR]: { r: 140, g:  90, b: 45 },
};
const MORTAR_DARKEN = 0.45;   // mortar lines this fraction darker
const SIDE_DARKEN   = 0.75;   // N/S faces multiplier
const BRICK_COLS    = 4;       // brick columns per tile width
const BRICK_ROWS    = 4;       // mortar lines per tile height (in world units)
const MORTAR_FRAC   = 0.08;   // mortar thickness as fraction of brick height

const CEILING_COLOR = (20 << 16) | (20 << 8) | 40;
const FLOOR_COLOR   = (50 << 16) | (40 << 8) | 30;

// Pack r,g,b (0-255 each) into a Phaser hex int
function rgb(r, g, b) {
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export class Raycaster {
    constructor(scene, grid, gridW, gridH) {
        this._scene  = scene;
        this._grid   = grid;
        this._gridW  = gridW;
        this._gridH  = gridH;

        this._gfx = scene.add.graphics({ x: 0, y: 0 });
    }

    setGrid(grid, gridW, gridH) {
        this._grid  = grid;
        this._gridW = gridW;
        this._gridH = gridH;
    }

    render(px, py, angle) {
        const gfx   = this._gfx;
        const halfH = VIEW_HEIGHT / 2;
        const colW  = VIEW_WIDTH / RAY_COUNT;

        gfx.clear();

        // Ceiling
        gfx.fillStyle(CEILING_COLOR, 1);
        gfx.fillRect(0, 0, VIEW_WIDTH, halfH);

        // Floor
        gfx.fillStyle(FLOOR_COLOR, 1);
        gfx.fillRect(0, halfH, VIEW_WIDTH, halfH);

        // Wall columns
        for (let i = 0; i < RAY_COUNT; i++) {
            const rayAngle = angle - HALF + (i / RAY_COUNT) * FOV;
            const { dist, tileType, wallX, side, mapX, mapY } = this._castRay(px, py, rayAngle);

            // Fisheye correction
            const corrected = Math.max(0.05, dist * Math.cos(rayAngle - angle));

            // Wall slice dimensions
            const wallH = Math.min(VIEW_HEIGHT, VIEW_HEIGHT / corrected);
            const wallY = halfH - wallH / 2;

            // Distance factor (1=close, 0=far)
            const distFactor = Math.max(0, 1 - corrected / MAX_DEPTH);

            // Base colour for this tile type
            const base = TILE_BASE[tileType] || TILE_BASE[TILE_WALL];

            // N/S faces (side===1) are darker
            const faceMul = side === 1 ? SIDE_DARKEN : 1.0;

            // Determine brick pattern from wallX
            // Which brick column is this column in?
            const brickCol = Math.floor(wallX * BRICK_COLS);
            // Row offset alternates per brick column for interlocking
            const rowOffset = (brickCol % 2) * 0.5;

            // wallX within this brick cell (0..1)
            const cellX = (wallX * BRICK_COLS) - brickCol;

            // Is this a vertical mortar line?
            const isMortarV = cellX < MORTAR_FRAC || cellX > (1 - MORTAR_FRAC);

            // We split the wall column into horizontal segments for mortar lines
            // Each brick row spans (wallH / BRICK_ROWS) screen pixels
            const brickPixH = wallH / BRICK_ROWS;

            // We'll iterate over brick rows and draw sub-rects
            let curY = wallY;
            const segCount = Math.ceil(BRICK_ROWS) + 1;

            for (let row = 0; row < segCount; row++) {
                // What fraction down the wall is the top of this row?
                const rowFracTop = row / BRICK_ROWS;
                // Adjusted row index accounting for the column offset
                const adjRow = Math.floor((rowFracTop + rowOffset) * BRICK_ROWS);
                const cellY  = ((rowFracTop + rowOffset) * BRICK_ROWS) - adjRow;

                const isMortarH = cellY < MORTAR_FRAC;
                const isMortar  = isMortarV || isMortarH;

                const mortarMul = isMortar ? MORTAR_DARKEN : 1.0;

                // Combined brightness: distance + face + mortar
                const bright = distFactor * 0.6 + 0.4; // 0.4 ambient, scaled by distance
                const mul    = bright * faceMul * mortarMul;

                const r = Math.min(255, base.r * mul);
                const g = Math.min(255, base.g * mul);
                const b = Math.min(255, base.b * mul);

                // Height of this segment in screen pixels
                const segH = Math.ceil(brickPixH) + 1;
                const nextY = wallY + (row + 1) * brickPixH;
                const drawH = Math.min(Math.ceil(nextY) - Math.ceil(curY), wallH - (Math.ceil(curY) - Math.ceil(wallY)));

                if (drawH <= 0) break;

                gfx.fillStyle(rgb(r, g, b), 1);
                gfx.fillRect(
                    Math.floor(i * colW),
                    Math.ceil(curY),
                    Math.ceil(colW) + 1,
                    drawH + 1
                );

                curY = nextY;
                if (curY > wallY + wallH) break;
            }
        }
    }

    /** DDA ray cast. Returns { dist, tileType, wallX, side, mapX, mapY }. */
    _castRay(px, py, angle) {
        const cos = Math.cos(angle) || 1e-8;
        const sin = Math.sin(angle) || 1e-8;

        let mapX = Math.floor(px);
        let mapY = Math.floor(py);

        const deltaX = Math.abs(1 / cos);
        const deltaY = Math.abs(1 / sin);

        const stepX = cos > 0 ? 1 : -1;
        const stepY = sin > 0 ? 1 : -1;

        let sideDistX = cos > 0 ? (mapX + 1 - px) * deltaX : (px - mapX) * deltaX;
        let sideDistY = sin > 0 ? (mapY + 1 - py) * deltaY : (py - mapY) * deltaY;

        let side     = 0;
        let tileType = TILE_WALL;
        let depth    = 0;

        while (depth < MAX_DEPTH) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaX;
                mapX      += stepX;
                side       = 0;
            } else {
                sideDistY += deltaY;
                mapY      += stepY;
                side       = 1;
            }
            depth++;

            if (mapX < 0 || mapX >= this._gridW || mapY < 0 || mapY >= this._gridH) break;

            const cell = this._grid[mapY][mapX];
            if (cell === TILE_WALL || cell === TILE_DOOR) {
                tileType = cell;
                break;
            }
        }

        const dist = side === 0
            ? (mapX - px + (1 - stepX) / 2) / cos
            : (mapY - py + (1 - stepY) / 2) / sin;

        // wallX: fractional hit position along the face (0..1)
        let wallX;
        if (side === 0) {
            wallX = py + Math.abs(dist) * sin;
        } else {
            wallX = px + Math.abs(dist) * cos;
        }
        wallX -= Math.floor(wallX);

        return { dist: Math.abs(dist), tileType, wallX, side, mapX, mapY };
    }

    destroy() {
        this._gfx.destroy();
    }
}
