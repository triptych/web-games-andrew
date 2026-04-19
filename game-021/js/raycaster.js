/**
 * raycaster.js — Software raycaster with procedural brick texturing
 * and billboard sprite rendering for enemies/items.
 *
 * Wall texturing strategy (no image assets):
 *   1. Draw each wall column as a solid coloured rect (base colour).
 *   2. Overdraw horizontal mortar lines across the column.
 *   3. If wallX is near a brick-column boundary, overdraw a vertical mortar line.
 *   N/S faces (side===1) use a darker base colour.
 *   All colours are attenuated by distance.
 *
 * Sprite strategy:
 *   Enemies are drawn as coloured rectangles with a simple face glyph,
 *   projected using the standard billboard transform and depth-tested
 *   against the wall Z-buffer.
 */

import { TILE_WALL, TILE_DOOR, VIEW_WIDTH, VIEW_HEIGHT, FOV_DEGREES, RAY_COUNT, MAX_DEPTH } from './config.js';

const FOV  = (FOV_DEGREES * Math.PI) / 180;
const HALF = FOV / 2;

// Base wall colours per tile type, [EW-face, NS-face]
const TILE_BASE = {
    [TILE_WALL]: { ew: { r: 160, g: 128, b: 88 },  ns: { r: 110, g:  88, b: 60 } },
    [TILE_DOOR]: { ew: { r: 140, g:  88, b: 44 },  ns: { r:  96, g:  60, b: 30 } },
};

const MORTAR  = { r: 60, g: 55, b: 50 };  // mortar / grout colour
const BRICK_COLS   = 4;     // bricks per tile width
const BRICK_ROWS   = 3;     // mortar lines per tile height (world units)
const MORTAR_PX    = 2;     // mortar line thickness in screen pixels
const MORTAR_V_W   = 0.06;  // vertical mortar width as fraction of tile (0..1)

const CEILING_COLOR = (20 << 16) | (20 << 8) | 40;
const FLOOR_COLOR   = (50 << 16) | (40 << 8) | 30;

// Sprite appearance per enemy type
const SPRITE_DEFS = {
    Slime:    { body: 0x40cc40, dark: 0x208820, label: 'Sl' },
    Goblin:   { body: 0xcc7020, dark: 0x885010, label: 'Go' },
    Skeleton: { body: 0xd0d0a0, dark: 0x909060, label: 'Sk' },
    Orc:      { body: 0xcc3030, dark: 0x881818, label: 'Or' },
    Lich:     { body: 0x9030cc, dark: 0x601888, label: 'Li' },
};
const SPRITE_DEFAULT = { body: 0xff4040, dark: 0xaa2020, label: '??' };

function toHex(r, g, b) {
    return (Math.max(0, Math.min(255, r | 0)) << 16)
         | (Math.max(0, Math.min(255, g | 0)) << 8)
         |  Math.max(0, Math.min(255, b | 0));
}

function darken(c, t) {
    return { r: c.r * t, g: c.g * t, b: c.b * t };
}

export class Raycaster {
    constructor(scene, grid, gridW, gridH) {
        this._scene = scene;
        this._grid  = grid;
        this._gridW = gridW;
        this._gridH = gridH;
        this._gfx   = scene.add.graphics({ x: 0, y: 0 });
        this._zBuf  = new Float32Array(RAY_COUNT); // depth buffer per column
        // Pool of text objects for sprite labels
        this._labelPool = [];
    }

    setGrid(grid, gridW, gridH) {
        this._grid  = grid;
        this._gridW = gridW;
        this._gridH = gridH;
    }

    /**
     * @param {number} px  player X (world)
     * @param {number} py  player Y (world)
     * @param {number} angle  player facing angle (radians)
     * @param {Array}  sprites  array of {x, y, type, alive} — enemies/items to draw
     */
    render(px, py, angle, sprites) {
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

        // --- Wall pass ---
        for (let i = 0; i < RAY_COUNT; i++) {
            const rayAngle = angle - HALF + (i / RAY_COUNT) * FOV;
            const hit      = this._castRay(px, py, rayAngle);

            // Fisheye correction
            const corrected = Math.max(0.05, hit.dist * Math.cos(rayAngle - angle));
            this._zBuf[i] = corrected;

            // Wall slice
            const wallH = Math.min(VIEW_HEIGHT, VIEW_HEIGHT / corrected);
            const wallY = Math.floor(halfH - wallH / 2);
            const wallB = wallY + Math.ceil(wallH);
            const cw    = Math.ceil(colW) + 1;
            const cx    = Math.floor(i * colW);

            const bright = 0.25 + 0.75 * Math.max(0, 1 - corrected / MAX_DEPTH);

            const base = (TILE_BASE[hit.tileType] || TILE_BASE[TILE_WALL])[hit.side === 1 ? 'ns' : 'ew'];
            const bc   = darken(base, bright);

            gfx.fillStyle(toHex(bc.r, bc.g, bc.b), 1);
            gfx.fillRect(cx, wallY, cw, wallB - wallY);

            // Horizontal mortar lines
            const brickCol    = Math.floor(hit.wallX * BRICK_COLS);
            const rowOffset   = (brickCol & 1) ? 0.5 : 0;
            const rowPxHeight = wallH / BRICK_ROWS;
            const mc = darken(MORTAR, bright);
            gfx.fillStyle(toHex(mc.r, mc.g, mc.b), 1);

            for (let row = 0; row <= BRICK_ROWS; row++) {
                const lineY = wallY + Math.round((row + rowOffset) * rowPxHeight) - 1;
                if (lineY >= wallY && lineY + MORTAR_PX <= wallB) {
                    gfx.fillRect(cx, lineY, cw, MORTAR_PX);
                }
            }

            // Vertical mortar line
            const fracInCol = (hit.wallX * BRICK_COLS) % 1;
            if (fracInCol < MORTAR_V_W || fracInCol > 1 - MORTAR_V_W) {
                gfx.fillStyle(toHex(mc.r, mc.g, mc.b), 1);
                gfx.fillRect(cx, wallY, cw, wallB - wallY);
            }
        }

        // --- Sprite pass ---
        if (sprites && sprites.length > 0) {
            this._renderSprites(gfx, px, py, angle, sprites);
        }
    }

    _renderSprites(gfx, px, py, angle, sprites) {
        const halfH = VIEW_HEIGHT / 2;

        // Transform each sprite into camera space, sort back-to-front
        const transformed = [];
        for (const sp of sprites) {
            if (!sp.alive) continue;
            // Sprite world centre
            const sx = sp.x + 0.5 - px;
            const sy = sp.y + 0.5 - py;

            // Rotate into camera space
            // Camera plane: right-perpendicular of facing direction
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            // Forward (into screen) component
            const fwd  = sx * cosA + sy * sinA;
            if (fwd <= 0.1) continue; // behind player

            // Sideways (left/right) component
            const side = -sx * sinA + sy * cosA;

            const distSq = sx * sx + sy * sy;
            transformed.push({ sp, fwd, side, distSq });
        }

        // Sort farthest first so near sprites overdraw far ones
        transformed.sort((a, b) => b.distSq - a.distSq);

        for (const { sp, fwd, side } of transformed) {
            const def = SPRITE_DEFS[sp.type] || SPRITE_DEFAULT;

            // Screen X of sprite centre
            // Project using same FOV as wall rays: half-plane width at dist 1 = tan(FOV/2)
            const screenX = Math.floor(VIEW_WIDTH / 2 + (side / fwd) * (VIEW_WIDTH / (2 * Math.tan(FOV / 2))));

            // Sprite projected height (same formula as wall)
            const spriteH = Math.min(VIEW_HEIGHT, Math.floor(VIEW_HEIGHT / fwd));
            const spriteW = spriteH; // square sprite

            const drawTop    = Math.floor(halfH - spriteH / 2);
            const drawBottom = drawTop + spriteH;
            const drawLeft   = screenX - Math.floor(spriteW / 2);
            const drawRight  = drawLeft + spriteW;

            // Brightness by distance
            const bright = Math.max(0.15, Math.min(1.0, 0.25 + 0.75 * (1 - fwd / MAX_DEPTH)));

            // Unpack body color
            const br = ((def.body >> 16) & 0xff) * bright;
            const bg = ((def.body >>  8) & 0xff) * bright;
            const bb = ( def.body        & 0xff) * bright;
            const bodyHex = toHex(br, bg, bb);

            const dr = ((def.dark >> 16) & 0xff) * bright;
            const dg = ((def.dark >>  8) & 0xff) * bright;
            const db = ( def.dark        & 0xff) * bright;
            const darkHex = toHex(dr, dg, db);

            // Draw column by column, depth-testing against zBuf
            const colStart = Math.max(0, drawLeft);
            const colEnd   = Math.min(VIEW_WIDTH - 1, drawRight);

            for (let cx = colStart; cx <= colEnd; cx++) {
                const zIdx = Math.floor(cx / (VIEW_WIDTH / RAY_COUNT));
                if (zIdx < 0 || zIdx >= RAY_COUNT) continue;
                if (fwd >= this._zBuf[zIdx]) continue; // occluded by wall

                // Sprite column fraction (0..1 left to right)
                const texX = (cx - drawLeft) / spriteW;

                // Side shadows (left/right 12% of width = dark)
                const isShadow = texX < 0.12 || texX > 0.88;
                const colHex   = isShadow ? darkHex : bodyHex;

                gfx.fillStyle(colHex, 1);
                gfx.fillRect(cx, Math.max(0, drawTop), 1, Math.min(VIEW_HEIGHT, drawBottom) - Math.max(0, drawTop));
            }

            // Eye dots — two small dark squares in upper body area
            const eyeY    = drawTop + Math.floor(spriteH * 0.28);
            const eyeSize = Math.max(1, Math.floor(spriteW * 0.1));
            const eyeLX   = screenX - Math.floor(spriteW * 0.22);
            const eyeRX   = screenX + Math.floor(spriteW * 0.12);

            if (eyeY >= 0 && eyeY + eyeSize < VIEW_HEIGHT) {
                // Check depth for eye columns
                const eyeLIdx = Math.floor(eyeLX / (VIEW_WIDTH / RAY_COUNT));
                const eyeRIdx = Math.floor(eyeRX / (VIEW_WIDTH / RAY_COUNT));
                if (eyeLIdx >= 0 && eyeLIdx < RAY_COUNT && fwd < this._zBuf[eyeLIdx]) {
                    gfx.fillStyle(darkHex, 1);
                    gfx.fillRect(eyeLX, eyeY, eyeSize, eyeSize);
                }
                if (eyeRIdx >= 0 && eyeRIdx < RAY_COUNT && fwd < this._zBuf[eyeRIdx]) {
                    gfx.fillStyle(darkHex, 1);
                    gfx.fillRect(eyeRX, eyeY, eyeSize, eyeSize);
                }
            }

            // HP bar above sprite (if in view and sprite is large enough)
            if (spriteH > 20 && sp.hp !== undefined && sp.maxHp !== undefined) {
                const barW  = Math.min(spriteW, 40);
                const barX  = screenX - Math.floor(barW / 2);
                const barY  = Math.max(2, drawTop - 6);
                const hpPct = Math.max(0, sp.hp / sp.maxHp);

                // Check depth at bar centre
                const barZIdx = Math.floor(screenX / (VIEW_WIDTH / RAY_COUNT));
                if (barZIdx >= 0 && barZIdx < RAY_COUNT && fwd < this._zBuf[barZIdx]) {
                    gfx.fillStyle(0x1a1a1a, 0.8);
                    gfx.fillRect(barX, barY, barW, 3);
                    const barColor = hpPct > 0.5 ? 0x40dc60 : hpPct > 0.25 ? 0xdcdc40 : 0xdc4040;
                    gfx.fillStyle(barColor, 1);
                    gfx.fillRect(barX, barY, Math.ceil(barW * hpPct), 3);
                }
            }
        }
    }

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

        for (let depth = 0; depth < MAX_DEPTH; depth++) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaX; mapX += stepX; side = 0;
            } else {
                sideDistY += deltaY; mapY += stepY; side = 1;
            }

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

        const absDist = Math.abs(dist);

        let wallX = side === 0 ? py + absDist * sin : px + absDist * cos;
        wallX -= Math.floor(wallX);

        return { dist: absDist, tileType, wallX, side };
    }

    destroy() {
        this._gfx.destroy();
        for (const lbl of this._labelPool) lbl.destroy();
        this._labelPool = [];
    }
}
