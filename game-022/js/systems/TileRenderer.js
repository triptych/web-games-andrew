/**
 * TileRenderer — draws visible tiles into a Phaser Graphics object.
 * Only redraws tiles that are within the camera viewport + margin.
 * Also handles fog-of-war overlay.
 */

import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ORE_DEFS, BLOCK } from '../data/ores.js';
import { getBlock } from './WorldGen.js';

// Hex lighten: add brightness to a hex color
function lighten(hex, amt) {
    const r = Math.min(255, ((hex >> 16) & 0xFF) + amt);
    const g = Math.min(255, ((hex >> 8)  & 0xFF) + amt);
    const b = Math.min(255, (hex         & 0xFF) + amt);
    return (r << 16) | (g << 8) | b;
}

function darken(hex, amt) { return lighten(hex, -amt); }

export class TileRenderer {
    constructor(scene, world, exploredTiles) {
        this._scene = scene;
        this._world = world;
        this._explored = exploredTiles; // Uint8Array, same size as world

        // Main tile graphics layer
        this._gfx = scene.add.graphics();
        this._gfx.setDepth(0);

        // Fog of war overlay
        this._fog = scene.add.graphics();
        this._fog.setDepth(10);

        // Animated tile overlay (lava flicker, etc.)
        this._animTimer = 0;

        this._lastCamX = -9999;
        this._lastCamY = -9999;
        this._lightRadius = 3;
        this._playerTileX = 60;
        this._playerTileY = 0;
        this._dirty = true;
    }

    setLightRadius(r)  { this._lightRadius = r; }
    setDirty()         { this._dirty = true; }

    // Reveal all tiles in a rectangle (seismic scan) — marks explored so fog lifts
    seismicReveal(centerCol, startRow, numRows, halfWidth) {
        for (let r = startRow; r < Math.min(WORLD_ROWS, startRow + numRows); r++) {
            for (let dc = -halfWidth; dc <= halfWidth; dc++) {
                const c = centerCol + dc;
                if (c < 0 || c >= WORLD_COLS) continue;
                this._explored[r * WORLD_COLS + c] = 1;
            }
        }
    }

    // Mark tiles around player as explored
    revealAround(tileX, tileY, radius) {
        const r2 = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= r2) {
                    const row = tileY + dy;
                    const col = tileX + dx;
                    if (row >= 0 && row < WORLD_ROWS && col >= 0 && col < WORLD_COLS) {
                        this._explored[row * WORLD_COLS + col] = 1;
                    }
                }
            }
        }
    }

    update(dt, playerTileX, playerTileY, camX, camY) {
        this._animTimer += dt;
        this._playerTileX = playerTileX;
        this._playerTileY = playerTileY;

        const camMoved = Math.abs(camX - this._lastCamX) > 0.5 ||
                         Math.abs(camY - this._lastCamY) > 0.5;

        if (camMoved || this._dirty || this._animTimer > 0.5) {
            this._lastCamX = camX;
            this._lastCamY = camY;
            if (this._animTimer > 0.5) this._animTimer = 0;
            this._dirty = false;

            this.revealAround(playerTileX, playerTileY, this._lightRadius);
            this._redrawTiles(camX, camY);
            this._redrawFog(camX, camY);
        }
    }

    _redrawTiles(camX, camY) {
        const gfx = this._gfx;
        gfx.clear();

        const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 2);
        const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 2);
        const endCol   = Math.min(WORLD_COLS - 1, startCol + Math.ceil(GAME_WIDTH  / TILE_SIZE) + 4);
        const endRow   = Math.min(WORLD_ROWS - 1, startRow + Math.ceil(GAME_HEIGHT / TILE_SIZE) + 4);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const blockId = getBlock(this._world, row, col);
                if (blockId === BLOCK.AIR) continue;

                const def = ORE_DEFS[blockId];
                if (!def) continue;

                const px = col * TILE_SIZE;
                const py = row * TILE_SIZE;

                // Lava flicker
                let color = def.color;
                if (blockId === BLOCK.LAVA) {
                    const flicker = Math.sin(this._animTimer * 8 + col * 0.7) * 20;
                    color = lighten(color, flicker);
                }

                // Tile body (slightly darker border effect)
                gfx.fillStyle(darken(color, 20), 1.0);
                gfx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                // Tile face (inset 1px)
                gfx.fillStyle(color, 1.0);
                gfx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

                // Ore highlight dot
                if (!def.isFill && blockId !== BLOCK.BEDROCK) {
                    gfx.fillStyle(lighten(color, 60), 0.9);
                    gfx.fillRect(px + 2, py + 2, 3, 3);

                    // Special glow for rare ores (tier 4+)
                    if (def.value >= 350) {
                        gfx.lineStyle(1, lighten(color, 80), 0.5);
                        gfx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    }
                }

                // Bedrock cross-hatch
                if (blockId === BLOCK.BEDROCK) {
                    gfx.lineStyle(1, 0x555555, 0.4);
                    gfx.beginPath();
                    for (let i = 0; i < TILE_SIZE; i += 4) {
                        gfx.moveTo(px, py + i);
                        gfx.lineTo(px + i, py);
                    }
                    gfx.strokePath();
                }
            }
        }
    }

    _redrawFog(camX, camY) {
        const fog = this._fog;
        fog.clear();

        const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
        const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
        const endCol   = Math.min(WORLD_COLS - 1, startCol + Math.ceil(GAME_WIDTH  / TILE_SIZE) + 2);
        const endRow   = Math.min(WORLD_ROWS - 1, startRow + Math.ceil(GAME_HEIGHT / TILE_SIZE) + 2);

        const px2 = this._playerTileX;
        const py2 = this._playerTileY;
        const lr  = this._lightRadius;
        const lr2 = lr * lr;

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const explored = this._explored[row * WORLD_COLS + col];
                const dx = col - px2, dy = row - py2;
                const dist2 = dx * dx + dy * dy;

                if (dist2 <= lr2) {
                    // In light — fully clear, with falloff at edges
                    const dist = Math.sqrt(dist2);
                    const edge = dist / lr;
                    if (edge > 0.7) {
                        fog.fillStyle(0x000000, (edge - 0.7) / 0.3 * 0.4);
                        fog.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                } else if (explored) {
                    // Explored but out of light
                    fog.fillStyle(0x000000, 0.65);
                    fog.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                    // Unexplored
                    fog.fillStyle(0x000000, 1.0);
                    fog.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}
