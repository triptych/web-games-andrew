/**
 * raycaster.js — Software raycaster with procedural brick texturing
 * and billboard sprite rendering for enemies/items/torches/props.
 *
 * Wall texturing strategy (no image assets):
 *   1. Draw each wall column as a solid coloured rect (base colour).
 *   2. Overdraw horizontal mortar lines across the column.
 *   3. If wallX is near a brick-column boundary, overdraw a vertical mortar line.
 *   4. Cracked walls (variant 1) add dark diagonal crack marks.
 *   5. Mossy walls (variant 2) add green tint patches.
 *   N/S faces (side===1) use a darker base colour.
 *   All colours are attenuated by distance.
 *
 * Sprite strategy:
 *   Enemies rendered as pooled Phaser Images (depth-tested).
 *   Items, torches, and props rendered as procedural graphics billboards.
 *   Torches animate with a flicker by sampling a sine wave each frame.
 */

import { TILE_WALL, TILE_DOOR, TILE_LOCKED_DOOR,
         VIEW_WIDTH, VIEW_HEIGHT, FOV_DEGREES, RAY_COUNT, MAX_DEPTH } from './config.js';

const FOV  = (FOV_DEGREES * Math.PI) / 180;
const HALF = FOV / 2;

// Base wall colours per tile type and variant, [EW-face, NS-face]
const TILE_BASE = {
    [TILE_WALL]:        { ew: { r: 160, g: 128, b: 88 },  ns: { r: 110, g:  88, b: 60 } },
    [TILE_DOOR]:        { ew: { r: 140, g:  88, b: 44 },  ns: { r:  96, g:  60, b: 30 } },
    [TILE_LOCKED_DOOR]: { ew: { r: 180, g:  60, b:  0 },  ns: { r: 120, g:  40, b:  0 } },
};
// Cracked wall tint (cooler/darker)
const CRACKED_TINT = { r: 0.88, g: 0.84, b: 0.80 };
// Mossy wall tint (greener)
const MOSSY_TINT   = { r: 0.80, g: 1.05, b: 0.75 };

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
    constructor(scene, grid, gridW, gridH, wallVariants) {
        this._scene   = scene;
        this._grid    = grid;
        this._gridW   = gridW;
        this._gridH   = gridH;
        this._wallVar = wallVariants || null; // 2D array of wall variant indices
        this._time    = 0; // elapsed ms for torch animation
        this._gfx    = scene.add.graphics({ x: 0, y: 0 }).setDepth(0);
        this._hpGfx  = scene.add.graphics({ x: 0, y: 0 }).setDepth(2);
        this._zBuf   = new Float32Array(RAY_COUNT); // depth buffer per column
        this._labelPool = [];
        this._imgPool = {};
    }

    setGrid(grid, gridW, gridH, wallVariants) {
        this._grid    = grid;
        this._gridW   = gridW;
        this._gridH   = gridH;
        this._wallVar = wallVariants || this._wallVar;
    }

    /**
     * @param {number} px      player X (world)
     * @param {number} py      player Y (world)
     * @param {number} angle   player facing angle (radians)
     * @param {Array}  sprites array of {x, y, type, alive} — enemies/items/torches/props
     * @param {number} delta   frame delta ms (for torch animation)
     */
    render(px, py, angle, sprites, delta) {
        this._time += (delta || 16);
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

            // Apply wall variant tint
            let bc = darken(base, bright);
            if (this._wallVar && hit.mapX !== undefined && hit.mapY !== undefined) {
                const variant = this._wallVar[hit.mapY]?.[hit.mapX] || 0;
                if (variant === 1) {
                    bc = { r: bc.r * CRACKED_TINT.r, g: bc.g * CRACKED_TINT.g, b: bc.b * CRACKED_TINT.b };
                } else if (variant === 2) {
                    bc = { r: bc.r * MOSSY_TINT.r, g: bc.g * MOSSY_TINT.g, b: bc.b * MOSSY_TINT.b };
                }
            }

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

            // Extra detail for cracked walls: dark crack streak on specific wallX fractions
            if (this._wallVar && hit.mapX !== undefined && hit.mapY !== undefined) {
                const variant = this._wallVar[hit.mapY]?.[hit.mapX] || 0;
                if (variant === 1) {
                    // Crack: a thin dark diagonal line near wallX=0.3 and wallX=0.65
                    const fx = hit.wallX;
                    if ((fx > 0.27 && fx < 0.35) || (fx > 0.62 && fx < 0.70)) {
                        const crackC = darken({ r: 20, g: 18, b: 14 }, bright);
                        gfx.fillStyle(toHex(crackC.r, crackC.g, crackC.b), 1);
                        const crackOff = Math.round((fx - 0.3) * wallH * 3);
                        gfx.fillRect(cx, wallY + Math.floor(wallH * 0.2) + crackOff, cw, 2);
                        gfx.fillRect(cx, wallY + Math.floor(wallH * 0.5) + crackOff, cw, 1);
                    }
                } else if (variant === 2) {
                    // Mossy patches: irregular green blobs in lower third of wall
                    const fx = hit.wallX;
                    const seed = (fx * 17 + hit.mapX * 3 + hit.mapY * 7) % 1;
                    if (seed > 0.55 && seed < 0.85) {
                        const mossC = darken({ r: 40, g: 90, b: 30 }, bright);
                        gfx.fillStyle(toHex(mossC.r, mossC.g, mossC.b), 0.7);
                        const mossY = wallY + Math.floor(wallH * 0.55);
                        const mossH = Math.max(2, Math.floor(wallH * 0.35));
                        gfx.fillRect(cx, mossY, cw, mossH);
                    }
                }
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
        const img = this._scene.add.image(0, 0, key).setOrigin(0.5, 0.5).setDepth(1);
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

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Transform each sprite into camera space, sort back-to-front
        const transformed = [];
        for (const sp of sprites) {
            // Enemies must be alive; items must not be picked up; torches/props always visible
            if (sp.isTorch || sp.isProp) {
                // always include
            } else if (sp.effect !== undefined) {
                if (sp.picked) continue;
            } else {
                if (!sp.alive) continue;
            }

            // Sprite world centre
            const sx = sp.x + 0.5 - px;
            const sy = sp.y + 0.5 - py;

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

        // Track the closest enemy fwd at each screen X for HP bar culling
        const closestEnemyFwd = new Map(); // screenX -> fwd of nearest enemy

        // First pass: determine the nearest enemy at each screen X
        for (const { sp, fwd, side } of transformed) {
            if (sp.isTorch || sp.isProp || sp.effect !== undefined) continue;
            const screenX = Math.floor(VIEW_WIDTH / 2 + (side / fwd) * (VIEW_WIDTH / (2 * Math.tan(FOV / 2))));
            const existing = closestEnemyFwd.get(screenX);
            if (existing === undefined || fwd < existing) closestEnemyFwd.set(screenX, fwd);
        }

        for (const { sp, fwd, side } of transformed) {
            const isTorch = sp.isTorch === true;
            const isProp  = sp.isProp  === true;
            const isItem  = !isTorch && !isProp && sp.effect !== undefined;
            const isEnemy = !isTorch && !isProp && !isItem;

            const def = isItem
                ? (ITEM_DEFS[sp.effect] || ITEM_DEFAULT)
                : isEnemy ? (SPRITE_DEFS[sp.type] || SPRITE_DEFAULT) : null;

            // Screen X of sprite centre
            const screenX = Math.floor(VIEW_WIDTH / 2 + (side / fwd) * (VIEW_WIDTH / (2 * Math.tan(FOV / 2))));

            // Full projected height
            const projH = Math.min(VIEW_HEIGHT, Math.floor(VIEW_HEIGHT / fwd));

            // Brightness by distance
            const bright = Math.max(0.15, Math.min(1.0, 0.25 + 0.75 * (1 - fwd / MAX_DEPTH)));

            if (isTorch) {
                // --- Torch: animated flickering flame billboard ---
                this._renderTorch(gfx, screenX, projH, fwd, bright);
                continue;
            }

            if (isProp) {
                // --- Prop: barrel / skeleton / crate / bones ---
                this._renderProp(gfx, sp, screenX, projH, fwd, bright);
                continue;
            }

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

            if (isEnemy) {
                // Sample several columns across sprite width to test occlusion.
                const colPx = VIEW_WIDTH / RAY_COUNT;
                const halfW = spriteH / 2;
                let visibleCols = 0;
                for (let sOff = -0.4; sOff <= 0.4; sOff += 0.2) {
                    const sX = screenX + sOff * halfW;
                    const zIdx = Math.floor(sX / colPx);
                    if (zIdx >= 0 && zIdx < RAY_COUNT && fwd < this._zBuf[zIdx]) visibleCols++;
                }
                const visible = visibleCols > 0;

                // --- Enemy: render using pooled Phaser Image ---
                const img = this._getPooledImage(sp.type);
                if (img && def.crop) {
                    if (visible) {
                        img.setCrop(def.crop.x, def.crop.y, def.crop.w, def.crop.h);
                        img.setDisplaySize(spriteH, spriteH);
                        img.setPosition(screenX, drawTop + spriteH / 2);
                        img.setAlpha(bright);
                        img.setDepth(1 + (MAX_DEPTH - fwd) / MAX_DEPTH);
                        img.setVisible(true);
                    }
                } else if (img) {
                    img.setVisible(false);
                }

                // HP bar: only draw if this enemy is the nearest at its screen column
                if (visible && spriteH > 20 && sp.hp !== undefined && sp.maxHp !== undefined
                        && closestEnemyFwd.get(screenX) === fwd) {
                    const barW  = Math.min(spriteW, 40);
                    const barX  = screenX - Math.floor(barW / 2);
                    const barY  = Math.max(2, drawTop - 6);
                    const hpPct = Math.max(0, sp.hp / sp.maxHp);
                    this._hpGfx.fillStyle(0x1a1a1a, 0.8);
                    this._hpGfx.fillRect(barX, barY, barW, 3);
                    const barColor = hpPct > 0.5 ? 0x40dc60 : hpPct > 0.25 ? 0xdcdc40 : 0xdc4040;
                    this._hpGfx.fillStyle(barColor, 1);
                    this._hpGfx.fillRect(barX, barY, Math.ceil(barW * hpPct), 3);
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

    // Animated torch: a flickering orange/yellow flame on a short wall-sconce post
    _renderTorch(gfx, screenX, projH, fwd, bright) {
        const halfH = VIEW_HEIGHT / 2;
        const t = this._time / 1000;

        // Flicker: modulate size and color with multiple sine waves
        const flicker = 0.85 + 0.15 * Math.sin(t * 8.7 + screenX * 0.3)
                              + 0.08 * Math.sin(t * 13.1 + screenX * 0.7);

        // Torch is wall-mounted at ~eye height — vertically centered
        const torchH = Math.max(3, Math.floor(projH * 0.30 * flicker));
        const torchW = Math.max(2, Math.floor(torchH * 0.55));
        const postH  = Math.max(2, Math.floor(projH * 0.10));

        const centerY = Math.floor(halfH - projH * 0.05); // slightly above center

        const flameTop  = centerY - torchH;
        const flameLeft = screenX - Math.floor(torchW / 2);

        // Depth-test centre column
        const zIdx = Math.floor(screenX / (VIEW_WIDTH / RAY_COUNT));
        if (zIdx < 0 || zIdx >= RAY_COUNT || fwd >= this._zBuf[zIdx]) return;

        // Outer flame (orange)
        const fr = Math.min(255, 255 * bright);
        const fg = Math.min(255, (120 + 60 * flicker) * bright);
        gfx.fillStyle(toHex(fr, fg, 0), 0.92);
        gfx.fillRect(flameLeft, flameTop, torchW, torchH);

        // Inner flame (bright yellow core, narrower)
        const coreW = Math.max(1, Math.floor(torchW * 0.45));
        const coreH = Math.max(1, Math.floor(torchH * 0.55));
        gfx.fillStyle(toHex(Math.min(255, 255 * bright), Math.min(255, 220 * bright), Math.min(255, 60 * bright)), 1);
        gfx.fillRect(screenX - Math.floor(coreW / 2), flameTop + Math.floor(torchH * 0.15), coreW, coreH);

        // Torch post (dark brown stub below flame)
        const postLeft = screenX - Math.max(1, Math.floor(torchW * 0.25));
        const postW    = Math.max(2, Math.floor(torchW * 0.5));
        gfx.fillStyle(toHex(80 * bright, 50 * bright, 20 * bright), 1);
        gfx.fillRect(postLeft, centerY, postW, postH);

        // Glow halo (semi-transparent orange circle drawn as a rect)
        const glowR = Math.floor(torchW * 1.8);
        gfx.fillStyle(toHex(Math.min(255, 200 * bright), Math.min(255, 80 * bright), 0), 0.12 * flicker);
        gfx.fillRect(screenX - glowR, flameTop - Math.floor(glowR * 0.5), glowR * 2, torchH + glowR);
    }

    // Prop: barrel, skeleton, crate, bones — drawn as procedural graphics billboards
    _renderProp(gfx, sp, screenX, projH, fwd, bright) {
        const halfH = VIEW_HEIGHT / 2;

        const propH = Math.max(3, Math.floor(projH * 0.55));
        const propW = Math.max(2, Math.floor(projH * 0.45));
        const drawTop  = Math.floor(halfH + projH / 2) - propH;
        const drawLeft = screenX - Math.floor(propW / 2);

        // Depth-test: sample across prop width, skip if fully occluded
        const colPx2 = VIEW_WIDTH / RAY_COUNT;
        const halfPropW = propW / 2;
        let propVisible = false;
        for (let sOff = -0.45; sOff <= 0.45; sOff += 0.225) {
            const sX = screenX + sOff * halfPropW;
            const zIdx = Math.floor(sX / colPx2);
            if (zIdx >= 0 && zIdx < RAY_COUNT && fwd < this._zBuf[zIdx]) { propVisible = true; break; }
        }
        if (!propVisible) return;

        const b = bright;

        if (sp.type === 'barrel') {
            // Brown wooden barrel with darker stave lines
            gfx.fillStyle(toHex(140 * b, 90 * b, 40 * b), 1);
            gfx.fillRect(drawLeft, drawTop, propW, propH);
            // Darker top/bottom caps
            const capH = Math.max(1, Math.floor(propH * 0.12));
            gfx.fillStyle(toHex(100 * b, 65 * b, 25 * b), 1);
            gfx.fillRect(drawLeft, drawTop, propW, capH);
            gfx.fillRect(drawLeft, drawTop + propH - capH, propW, capH);
            // Metal band (dark grey stripe in middle)
            const bandH = Math.max(1, Math.floor(propH * 0.10));
            gfx.fillStyle(toHex(55 * b, 55 * b, 55 * b), 1);
            gfx.fillRect(drawLeft, drawTop + Math.floor(propH * 0.42), propW, bandH);
            // Vertical stave crack lines
            const staveW = Math.max(1, Math.floor(propW / 4));
            gfx.fillStyle(toHex(90 * b, 58 * b, 22 * b), 1);
            gfx.fillRect(drawLeft + staveW, drawTop, 1, propH);
            gfx.fillRect(drawLeft + staveW * 2, drawTop, 1, propH);
            gfx.fillRect(drawLeft + staveW * 3, drawTop, 1, propH);

        } else if (sp.type === 'crate') {
            // Wooden crate — square-ish box with cross brace
            const ch = Math.max(3, Math.floor(propH * 0.85));
            const cw = Math.max(3, Math.floor(propW * 0.90));
            const ct = drawTop + (propH - ch);
            const cl = drawLeft + Math.floor((propW - cw) / 2);
            gfx.fillStyle(toHex(160 * b, 115 * b, 55 * b), 1);
            gfx.fillRect(cl, ct, cw, ch);
            // Dark border
            const bd = 1;
            gfx.fillStyle(toHex(80 * b, 58 * b, 22 * b), 1);
            gfx.fillRect(cl, ct, cw, bd);
            gfx.fillRect(cl, ct + ch - bd, cw, bd);
            gfx.fillRect(cl, ct, bd, ch);
            gfx.fillRect(cl + cw - bd, ct, bd, ch);
            // Diagonal bracing
            gfx.fillStyle(toHex(90 * b, 65 * b, 28 * b), 1);
            gfx.fillRect(cl + Math.floor(cw / 2) - 1, ct, 2, ch);
            gfx.fillRect(cl, ct + Math.floor(ch / 2) - 1, cw, 2);

        } else if (sp.type === 'skeleton') {
            // Skull (white oval) + ribcage + leg bones
            const skH = propH;
            const skT = drawTop;
            // Skull
            const skullH = Math.max(2, Math.floor(skH * 0.30));
            const skullW = Math.max(2, Math.floor(propW * 0.55));
            gfx.fillStyle(toHex(210 * b, 205 * b, 185 * b), 1);
            gfx.fillRect(screenX - Math.floor(skullW / 2), skT, skullW, skullH);
            // Eye sockets
            if (skullH > 4) {
                const eyeY = skT + Math.floor(skullH * 0.35);
                const eyeOff = Math.max(1, Math.floor(skullW * 0.18));
                gfx.fillStyle(toHex(20 * b, 18 * b, 15 * b), 1);
                gfx.fillRect(screenX - eyeOff - 1, eyeY, 2, Math.max(1, Math.floor(skullH * 0.28)));
                gfx.fillRect(screenX + eyeOff - 1, eyeY, 2, Math.max(1, Math.floor(skullH * 0.28)));
            }
            // Ribcage area
            const ribT = skT + skullH + Math.max(1, Math.floor(skH * 0.04));
            const ribH = Math.max(2, Math.floor(skH * 0.38));
            const ribW = Math.max(2, Math.floor(propW * 0.70));
            gfx.fillStyle(toHex(185 * b, 180 * b, 160 * b), 1);
            gfx.fillRect(screenX - Math.floor(ribW / 2), ribT, ribW, ribH);
            // Rib lines
            if (ribH > 6) {
                gfx.fillStyle(toHex(100 * b, 95 * b, 80 * b), 1);
                for (let ri = 1; ri < 3; ri++) {
                    gfx.fillRect(screenX - Math.floor(ribW / 2), ribT + Math.floor(ribH * ri / 3), ribW, 1);
                }
            }
            // Leg bones (two thin rectangles)
            const legT = ribT + ribH + Math.max(1, Math.floor(skH * 0.03));
            const legH = Math.max(2, skH - (legT - skT));
            const legW = Math.max(1, Math.floor(propW * 0.18));
            const legOff = Math.max(2, Math.floor(propW * 0.18));
            gfx.fillStyle(toHex(195 * b, 190 * b, 170 * b), 1);
            gfx.fillRect(screenX - legOff - legW, legT, legW, legH);
            gfx.fillRect(screenX + legOff, legT, legW, legH);

        } else {
            // 'bones' — scattered bone pile on the floor (low, wide)
            const bonesH = Math.max(2, Math.floor(propH * 0.30));
            const bonesW = Math.max(3, Math.floor(propW * 1.20));
            const bonesT = drawTop + propH - bonesH;
            const bonesL = screenX - Math.floor(bonesW / 2);
            gfx.fillStyle(toHex(195 * b, 190 * b, 165 * b), 1);
            gfx.fillRect(bonesL, bonesT, bonesW, bonesH);
            // A couple of dark gaps for individual bones
            if (bonesW > 6) {
                gfx.fillStyle(toHex(50 * b, 45 * b, 35 * b), 1);
                gfx.fillRect(bonesL + Math.floor(bonesW * 0.3), bonesT, 1, bonesH);
                gfx.fillRect(bonesL + Math.floor(bonesW * 0.65), bonesT, 1, bonesH);
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
            if (cell === TILE_WALL || cell === TILE_DOOR || cell === TILE_LOCKED_DOOR) {
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

        return { dist: absDist, tileType, wallX, side, mapX, mapY };
    }

    destroy() {
        this._gfx.destroy();
        this._hpGfx.destroy();
        for (const lbl of this._labelPool) lbl.destroy();
        this._labelPool = [];
        for (const pool of Object.values(this._imgPool)) {
            for (const img of pool) img.destroy();
        }
        this._imgPool = {};
    }
}
