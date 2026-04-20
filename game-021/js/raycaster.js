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

// Sprite appearance per enemy type (fallback colors + image crop)
// crop: { x, y, w, h } — content bounding box within the 600x327 source image
const SPRITE_DEFS = {
    Slime:    { body: 0x40cc40, dark: 0x208820, label: 'Sl', crop: { x: 159, y: 44,  w: 282, h: 259 } },
    Goblin:   { body: 0xcc7020, dark: 0x885010, label: 'Go', crop: { x: 164, y: 44,  w: 272, h: 259 } },
    Skeleton: { body: 0xd0d0a0, dark: 0x909060, label: 'Sk', crop: { x: 184, y: 44,  w: 292, h: 259 } },
    Orc:      { body: 0xcc3030, dark: 0x881818, label: 'Or', crop: { x: 154, y: 39,  w: 282, h: 264 } },
    Lich:     { body: 0x9030cc, dark: 0x601888, label: 'Li', crop: { x: 159, y: 17,  w: 294, h: 308 } },
};
const SPRITE_DEFAULT = { body: 0xff4040, dark: 0xaa2020, label: '??' };

// Sprite appearance per item effect
const ITEM_DEFS = {
    heal:     { body: 0xff4488, dark: 0xaa2255 },
    atk:      { body: 0xff8800, dark: 0xaa5500 },
    def:      { body: 0x4488ff, dark: 0x2255aa },
    gold:     { body: 0xffd700, dark: 0xaa8800 },
    antidote: { body: 0x44ff88, dark: 0x22aa55 },
};
const ITEM_DEFAULT = { body: 0xffd700, dark: 0xaa8800 };

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
        this._gfx    = scene.add.graphics({ x: 0, y: 0 }).setDepth(0);
        this._hpGfx  = scene.add.graphics({ x: 0, y: 0 }).setDepth(2);
        this._zBuf   = new Float32Array(RAY_COUNT); // depth buffer per column
        // Pool of text objects for sprite labels
        this._labelPool = [];
        // Pool of Phaser Image objects for enemy sprites, keyed by type
        this._imgPool = {}; // type -> Image[]
        // Geometry mask to clip images to the 3D view area
        const maskGfx = scene.make.graphics({ add: false });
        maskGfx.fillStyle(0xffffff);
        maskGfx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        this._viewMask = maskGfx.createGeometryMask();
        this._maskGfx  = maskGfx;
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
        this._hpGfx.clear();

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
        this._renderSprites(gfx, px, py, angle, sprites || []);
    }

    // Return a pooled (or newly created) Phaser Image for the given enemy type.
    _getPooledImage(type) {
        const key = 'sprite_' + type;
        if (!this._imgPool[type]) this._imgPool[type] = [];
        const pool = this._imgPool[type];
        // Find one not currently active
        for (const img of pool) {
            if (!img._inUse) { img._inUse = true; return img; }
        }
        // Create new — textures may not exist for unknown types
        if (!this._scene.textures.exists(key)) return null;
        const img = this._scene.add.image(0, 0, key).setOrigin(0.5, 0.5).setDepth(1).setMask(this._viewMask);
        img._inUse = true;
        pool.push(img);
        return img;
    }

    _renderSprites(gfx, px, py, angle, sprites) {
        const halfH = VIEW_HEIGHT / 2;

        // Mark all pooled images as inactive before this frame
        for (const pool of Object.values(this._imgPool)) {
            for (const img of pool) { img._inUse = false; img.setVisible(false); }
        }

        // Transform each sprite into camera space, sort back-to-front
        const transformed = [];
        for (const sp of sprites) {
            // Enemies must be alive; items must not be picked up
            if (sp.effect !== undefined ? sp.picked : !sp.alive) continue;
            // Sprite world centre
            const sx = sp.x + 0.5 - px;
            const sy = sp.y + 0.5 - py;

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
            const isItem = sp.effect !== undefined;
            const def    = isItem
                ? (ITEM_DEFS[sp.effect] || ITEM_DEFAULT)
                : (SPRITE_DEFS[sp.type] || SPRITE_DEFAULT);

            // Screen X of sprite centre
            const screenX = Math.floor(VIEW_WIDTH / 2 + (side / fwd) * (VIEW_WIDTH / (2 * Math.tan(FOV / 2))));

            // Full projected height
            const projH = Math.min(VIEW_HEIGHT, Math.floor(VIEW_HEIGHT / fwd));

            // Items are smaller (half height, sit on the floor)
            const spriteH = isItem ? Math.max(4, Math.floor(projH * 0.45)) : projH;
            const spriteW = isItem ? Math.max(4, Math.floor(projH * 0.35)) : projH;

            // Vertical position: enemies centered, items sit on floor
            const drawTop    = isItem
                ? Math.floor(halfH + projH / 2) - spriteH   // floor-aligned
                : Math.floor(halfH - spriteH / 2);
            const drawBottom = drawTop + spriteH;
            const drawLeft   = screenX - Math.floor(spriteW / 2);
            const drawRight  = drawLeft + spriteW;

            // Brightness by distance
            const bright = Math.max(0.15, Math.min(1.0, 0.25 + 0.75 * (1 - fwd / MAX_DEPTH)));

            if (!isItem) {
                // --- Enemy: render using pooled Phaser Image ---
                const img = this._getPooledImage(sp.type);
                if (img && def.crop) {
                    const crop = def.crop;
                    // Check centre column is not occluded
                    const zIdx = Math.floor(screenX / (VIEW_WIDTH / RAY_COUNT));
                    const visible = zIdx >= 0 && zIdx < RAY_COUNT && fwd < this._zBuf[zIdx];
                    if (visible) {
                        // Crop to content bounding box so transparent margins don't inflate the sprite
                        img.setCrop(crop.x, crop.y, crop.w, crop.h);
                        // Scale to spriteH × spriteH (square billboard)
                        img.setDisplaySize(spriteH, spriteH);
                        img.setPosition(screenX, drawTop + spriteH / 2);
                        img.setAlpha(bright);
                        img.setVisible(true);
                    }
                } else if (img) {
                    img.setVisible(false);
                }

                // HP bar above sprite (drawn on _hpGfx layer, above images)
                if (spriteH > 20 && sp.hp !== undefined && sp.maxHp !== undefined) {
                    const barW  = Math.min(spriteW, 40);
                    const barX  = screenX - Math.floor(barW / 2);
                    const barY  = Math.max(2, drawTop - 6);
                    const hpPct = Math.max(0, sp.hp / sp.maxHp);

                    const barZIdx = Math.floor(screenX / (VIEW_WIDTH / RAY_COUNT));
                    if (barZIdx >= 0 && barZIdx < RAY_COUNT && fwd < this._zBuf[barZIdx]) {
                        this._hpGfx.fillStyle(0x1a1a1a, 0.8);
                        this._hpGfx.fillRect(barX, barY, barW, 3);
                        const barColor = hpPct > 0.5 ? 0x40dc60 : hpPct > 0.25 ? 0xdcdc40 : 0xdc4040;
                        this._hpGfx.fillStyle(barColor, 1);
                        this._hpGfx.fillRect(barX, barY, Math.ceil(barW * hpPct), 3);
                    }
                }
            } else {
                // --- Item: draw as coloured diamond (graphics) ---
                const br = ((def.body >> 16) & 0xff) * bright;
                const bg = ((def.body >>  8) & 0xff) * bright;
                const bb = ( def.body        & 0xff) * bright;
                const bodyHex = toHex(br, bg, bb);

                const dr = ((def.dark >> 16) & 0xff) * bright;
                const dg = ((def.dark >>  8) & 0xff) * bright;
                const db = ( def.dark        & 0xff) * bright;
                const darkHex = toHex(dr, dg, db);

                const colStart = Math.max(0, drawLeft);
                const colEnd   = Math.min(VIEW_WIDTH - 1, drawRight);

                for (let cx = colStart; cx <= colEnd; cx++) {
                    const zIdx = Math.floor(cx / (VIEW_WIDTH / RAY_COUNT));
                    if (zIdx < 0 || zIdx >= RAY_COUNT) continue;
                    if (fwd >= this._zBuf[zIdx]) continue;

                    const texX = (cx - drawLeft) / spriteW;
                    const distFromCenter = Math.abs(texX - 0.5);
                    const colHex = distFromCenter < 0.35 ? bodyHex : darkHex;

                    gfx.fillStyle(colHex, 1);
                    const texX_c  = texX - 0.5;
                    const halfSpan = 0.5 - Math.abs(texX_c);
                    const itemTop    = Math.max(0, Math.floor(drawTop    + spriteH * (0.5 - halfSpan)));
                    const itemBottom = Math.min(VIEW_HEIGHT, Math.ceil(drawBottom - spriteH * (0.5 - halfSpan)));
                    if (itemBottom > itemTop) {
                        gfx.fillRect(cx, itemTop, 1, itemBottom - itemTop);
                    }
                }

                // Glint highlight at top of item diamond
                const glintZIdx = Math.floor(screenX / (VIEW_WIDTH / RAY_COUNT));
                if (glintZIdx >= 0 && glintZIdx < RAY_COUNT && fwd < this._zBuf[glintZIdx]) {
                    gfx.fillStyle(0xffffff, 1);
                    gfx.fillRect(screenX - 1, drawTop + Math.floor(spriteH * 0.15), 2, 2);
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
        this._hpGfx.destroy();
        this._viewMask.destroy();
        this._maskGfx.destroy();
        for (const lbl of this._labelPool) lbl.destroy();
        this._labelPool = [];
        for (const pool of Object.values(this._imgPool)) {
            for (const img of pool) img.destroy();
        }
        this._imgPool = {};
    }
}
