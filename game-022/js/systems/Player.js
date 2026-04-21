/**
 * Player — the drill machine.
 * Manages position (tile-based), drilling, fuel, hull, and movement.
 * Rendered as a Phaser Graphics composite.
 */

import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, GAME_WIDTH, GAME_HEIGHT,
         FUEL_BURN_MOVE, FUEL_BURN_IDLE, FUEL_BURN_WINCH,
         LAVA_DAMAGE_PER_SEC, FUEL_EMPTY_DAMAGE_PER_SEC,
         CAVE_IN_DAMAGE_MIN, CAVE_IN_DAMAGE_MAX, START_SPEED_TILES_PER_SEC,
         START_WINCH_TILES_PER_SEC, LOOSE_ROCK_RATES } from '../config.js';
import { ORE_DEFS, BLOCK } from '../data/ores.js';
import { getBlock, setBlock, getTierAtRow } from './WorldGen.js';
import { GameState } from './GameState.js';
import { playDrill, playOreCollect, playHullDamage, setEngineHum, playLavaHiss, playCaveIn, playSingingVein } from './SoundManager.js';

const BASE_SPEED  = START_SPEED_TILES_PER_SEC;
const BASE_WINCH  = START_WINCH_TILES_PER_SEC;

// Sub-tile position for smooth movement (pixels within a tile)
const MOVE_THRESHOLD = TILE_SIZE; // pixels to move before snapping to new tile

export class Player {
    constructor(scene, world, exploredTiles) {
        this._scene  = scene;
        this._world  = world;
        this._explored = exploredTiles;

        // Tile position
        this._tileCol = GameState.playerCol;
        this._tileRow = Math.max(0, GameState.playerRow);

        // Pixel position (used for smooth scrolling)
        this._px = this._tileCol * TILE_SIZE;
        this._py = this._tileRow * TILE_SIZE;

        // Movement accumulator
        this._moveAccX = 0;
        this._moveAccY = 0;

        // Drill state
        this._drilling   = false;
        this._drillTimer = 0;
        this._drillTarget = null; // {row, col}
        this._drillDir   = null;  // 'down' | 'left' | 'right'

        // Falling state
        this._falling = false;
        this._fallSpeed = 0;

        // Winching state
        this._winching = false;

        // Only fire onAtBase after the player has descended at least one tile
        this._hasDescended = false;

        // Lava proximity
        this._lavaTimer = 0;

        // Visual
        this._gfx = scene.add.graphics();
        this._gfx.setDepth(20);
        this._drillAngle = 0;

        this._drawMachine();

        // Particle emitter placeholder (scene-level)
        this._particles = [];

        // Callbacks
        this.onDamageTaken = null;  // (amount, source) => void
        this.onFuelChanged = null;  // () => void
        this.onOreCollected = null; // (blockId) => void
        this.onAtBase = null;       // () => void
        this.onDepthChanged = null; // (depthMeters) => void
        this.onGameOver = null;     // () => void
        this.onSingingVeinFound = null; // () => void
    }

    get tileCol() { return this._tileCol; }
    get tileRow() { return this._tileRow; }
    get pixelX()  { return this._px + TILE_SIZE / 2; }
    get pixelY()  { return this._py + TILE_SIZE / 2; }

    get isAtBase() { return this._tileRow <= 0; }

    getDepthMeters() { return this._tileRow * TILE_SIZE; }

    _speed()  { return BASE_SPEED  * (GameState.derived.speedMult || 1.0); }
    _winch()  { return BASE_WINCH  * (GameState.derived.winchMult || 1.0); }

    update(dt, actions) {
        if (GameState.hull.current <= 0) return;

        const derived = GameState.derived;
        const fuel    = GameState.fuel;
        const hull    = GameState.hull;

        // --- Nanite repair ---
        if (derived.naniteRepair && hull.current < hull.max) {
            GameState.repairHull(dt);
        }

        // --- Gravity / falling ---
        if (!this._drilling && !this._winching) {
            const blockBelow = getBlock(this._world, this._tileRow + 1, this._tileCol);
            const onGround   = blockBelow !== BLOCK.AIR || this._tileRow >= WORLD_ROWS - 1;
            if (!onGround && this._moveAccY === 0) {
                this._falling = true;
                this._fallSpeed = Math.min(this._fallSpeed + dt * 200, 400);
            } else {
                if (this._falling && this._fallSpeed > 200) {
                    // Impact
                    const impactDmg = Math.floor((this._fallSpeed - 200) / 20);
                    this._takeDamage(impactDmg, 'impact');
                }
                this._falling = false;
                this._fallSpeed = 0;
            }
        }

        if (this._falling) {
            this._moveAccY += this._fallSpeed * dt;
            if (this._moveAccY >= TILE_SIZE) {
                this._moveAccY -= TILE_SIZE;
                this._tileRow = Math.min(WORLD_ROWS - 1, this._tileRow + 1);
            }
            this._updatePos();
            return;
        }

        // --- Fuel-empty damage ---
        if (fuel.current <= 0 && !this.isAtBase) {
            hull.current = Math.max(0, hull.current - FUEL_EMPTY_DAMAGE_PER_SEC * dt);
            this._checkDeath();
        }

        // --- Active input processing ---
        let moving = false;
        let isWinch = false;

        if (!this._drilling) {
            if (actions.up && !this.isAtBase) {
                // Winch up
                if (fuel.current > 0) {
                    this._winching = true;
                    isWinch = true;
                    const speed = this._winch();
                    this._moveAccY -= speed * dt * TILE_SIZE;

                    while (this._moveAccY <= -TILE_SIZE) {
                        this._moveAccY += TILE_SIZE;
                        if (this._tileRow > 0) {
                            this._tileRow--;
                        }
                    }
                    moving = true;
                } else {
                    this._winching = false;
                }
            } else {
                this._winching = false;
            }

            if (actions.up && this.isAtBase) {
                // Already at surface — trigger base (only after having gone underground)
                if (this._hasDescended && this.onAtBase) this.onAtBase();
            }

            if (actions.left && !actions.up) {
                const targetBlock = getBlock(this._world, this._tileRow, this._tileCol - 1);
                if (targetBlock === BLOCK.AIR) {
                    const speed = this._speed();
                    this._moveAccX -= speed * dt * TILE_SIZE;
                    if (this._moveAccX <= -TILE_SIZE) {
                        this._moveAccX += TILE_SIZE;
                        if (this._tileCol > 1) this._tileCol--;
                    }
                    moving = true;
                } else if (targetBlock !== BLOCK.BEDROCK && fuel.current > 0) {
                    this._startDrill('left', this._tileRow, this._tileCol - 1);
                }
            }

            if (actions.right && !actions.up) {
                const targetBlock = getBlock(this._world, this._tileRow, this._tileCol + 1);
                if (targetBlock === BLOCK.AIR) {
                    const speed = this._speed();
                    this._moveAccX += speed * dt * TILE_SIZE;
                    if (this._moveAccX >= TILE_SIZE) {
                        this._moveAccX -= TILE_SIZE;
                        if (this._tileCol < WORLD_COLS - 2) this._tileCol++;
                    }
                    moving = true;
                } else if (targetBlock !== BLOCK.BEDROCK && fuel.current > 0) {
                    this._startDrill('right', this._tileRow, this._tileCol + 1);
                }
            }

            if (actions.down && !actions.up) {
                const targetBlock = getBlock(this._world, this._tileRow + 1, this._tileCol);
                if (targetBlock === BLOCK.AIR) {
                    // Free fall
                } else if (targetBlock !== BLOCK.BEDROCK && fuel.current > 0) {
                    this._startDrill('down', this._tileRow + 1, this._tileCol);
                }
            }
        }

        // --- Drilling tick ---
        if (this._drilling && this._drillTarget) {
            moving = true;
            if (fuel.current > 0) {
                this._drillTimer -= dt;
                this._drillAngle += dt * 15;

                if (this._drillTimer <= 0) {
                    this._completeDrill();
                }
            } else {
                // Out of fuel — stop drilling
                this._drilling = false;
                this._drillTarget = null;
            }
        }

        // --- Fuel consumption ---
        if (!this.isAtBase) {
            let burn = FUEL_BURN_IDLE;
            if (moving) burn = isWinch ? FUEL_BURN_WINCH : FUEL_BURN_MOVE;
            GameState.fuel.current = Math.max(0, GameState.fuel.current - burn * dt);
            if (this.onFuelChanged) this.onFuelChanged();
        }

        // --- Lava damage ---
        this._checkLavaProximity(dt);

        // --- Engine sound ---
        setEngineHum(moving, this._speed() / BASE_SPEED);

        // --- Depth tracking ---
        const depthM = this.getDepthMeters();
        GameState.trackDepth(depthM);
        if (this.onDepthChanged) this.onDepthChanged(depthM);

        // --- Update position ---
        this._updatePos();

        // Track descent so base trigger only fires after going underground
        if (this._tileRow > 1) this._hasDescended = true;

        // --- Check base arrival ---
        if (this._tileRow <= 0 && this._hasDescended && this.onAtBase) {
            this._hasDescended = false; // reset so next deploy requires descent again
            this.onAtBase();
        }
    }

    _startDrill(dir, targetRow, targetCol) {
        const blockId = getBlock(this._world, targetRow, targetCol);
        const def     = ORE_DEFS[blockId];
        if (!def || def.hardness >= 99) return; // bedrock

        const derived = GameState.derived;
        const drillPower = derived.drillPower || 1;

        let drillTime;
        if (derived.instant) {
            drillTime = 0.01;
        } else {
            drillTime = Math.max(0.05, Math.ceil(def.hardness / drillPower) * 0.15);
        }

        this._drilling    = true;
        this._drillTimer  = drillTime;
        this._drillTarget = { row: targetRow, col: targetCol };
        this._drillDir    = dir;

        playDrill(def.hardness);
    }

    _completeDrill() {
        const { row, col } = this._drillTarget;
        const blockId = getBlock(this._world, row, col);
        const def     = ORE_DEFS[blockId];

        this._drilling    = false;
        this._drillTarget = null;

        if (!def) return;

        // Remove block
        setBlock(this._world, row, col, BLOCK.AIR);

        // Move into drilled space
        const dir = this._drillDir;
        if (dir === 'down')  this._tileRow = row;
        if (dir === 'left')  this._tileCol = col;
        if (dir === 'right') this._tileCol = col;

        // Collect ore
        if (!def.isFill) {
            const added = GameState.addToCargoHold(blockId, def);
            if (added) {
                const tierIdx = getTierAtRow(row);
                playOreCollect(tierIdx);
                if (this.onOreCollected) this.onOreCollected(blockId);
                if (blockId === BLOCK.SINGING_VEIN && !GameState.stats.singingVeinFound) {
                    GameState.stats.singingVeinFound = true;
                    playSingingVein();
                    if (this.onSingingVeinFound) this.onSingingVeinFound();
                }
            }
        }

        // Cave-in check
        this._checkCaveIn(row, col);

        // Renderer dirty
        this._worldDirty = true;
    }

    _checkCaveIn(row, col) {
        const tierIdx = getTierAtRow(row);
        const rate    = LOOSE_ROCK_RATES[Math.min(tierIdx, LOOSE_ROCK_RATES.length - 1)];

        // Check adjacent blocks for loose-rock flag (probabilistic)
        const adjacents = [
            [row - 1, col], [row - 1, col - 1], [row - 1, col + 1],
        ];
        for (const [r, c] of adjacents) {
            const b = getBlock(this._world, r, c);
            if (b === BLOCK.STONE && Math.random() < rate) {
                // Block falls
                setBlock(this._world, r, c, BLOCK.AIR);
                setBlock(this._world, r + 1, c, BLOCK.STONE);
                playCaveIn();
                // If player is at the landing spot, take damage
                if (r + 1 === this._tileRow && c === this._tileCol) {
                    const dmg = CAVE_IN_DAMAGE_MIN + Math.floor(Math.random() * (CAVE_IN_DAMAGE_MAX - CAVE_IN_DAMAGE_MIN));
                    this._takeDamage(dmg, 'cave-in');
                }
            }
        }
    }

    _checkLavaProximity(dt) {
        const r = this._tileRow, c = this._tileCol;
        const neighbors = [
            getBlock(this._world, r, c - 1),
            getBlock(this._world, r, c + 1),
            getBlock(this._world, r + 1, c),
            getBlock(this._world, r - 1, c),
        ];
        const nearLava = neighbors.includes(BLOCK.LAVA);
        if (nearLava) {
            const derived = GameState.derived;
            if (derived.pressureShield && this._shieldCooldown <= 0) {
                // Shield active — no damage
            } else {
                this._takeDamage(LAVA_DAMAGE_PER_SEC * dt, 'lava');
                this._lavaTimer += dt;
                if (this._lavaTimer > 1.0) { this._lavaTimer = 0; playLavaHiss(); }
            }
        }
    }

    _takeDamage(amount, source) {
        if (amount <= 0) return;
        GameState.hull.current = Math.max(0, GameState.hull.current - amount);
        if (amount >= 5) playHullDamage(Math.min(3, amount / 10));
        if (this.onDamageTaken) this.onDamageTaken(amount, source);
        this._checkDeath();
    }

    _checkDeath() {
        if (GameState.hull.current <= 0) {
            GameState.hull.current = 0;
            GameState.stats.totalDeaths++;
            GameState.cargo.slots = []; // lose all cargo
            GameState.save();
            if (this.onGameOver) this.onGameOver();
        }
    }

    _updatePos() {
        this._px = this._tileCol * TILE_SIZE + this._moveAccX;
        this._py = this._tileRow * TILE_SIZE + this._moveAccY;
        this._gfx.setPosition(this._px, this._py);
        GameState.playerCol = this._tileCol;
        GameState.playerRow = this._tileRow;
    }

    _drawMachine() {
        const g = this._gfx;
        g.clear();

        const w = TILE_SIZE, h = TILE_SIZE * 1.5;

        // Body
        g.fillStyle(0x445566, 1);
        g.fillRect(0, 0, w, h);

        // Cockpit
        g.fillStyle(0x88CCFF, 1);
        g.fillRect(w * 0.2, h * 0.05, w * 0.6, h * 0.2);

        // Hull detail stripe
        g.fillStyle(0x334455, 1);
        g.fillRect(0, h * 0.35, w, h * 0.05);

        // Drill tip
        g.fillStyle(0xFF8800, 1);
        g.fillTriangle(
            w * 0.3, h,
            w * 0.7, h,
            w * 0.5, h + 6
        );

        // Thruster (left side)
        g.fillStyle(0xFF6600, 0.8);
        g.fillRect(-2, h * 0.5, 3, 8);

        // Lights
        g.fillStyle(0xFFFF99, 1);
        g.fillCircle(2, h * 0.3, 2);
        g.fillCircle(w - 2, h * 0.3, 2);
    }

    // Call when upgrades change the machine appearance
    refreshVisuals() {
        this._drawMachine();
    }

    // Teleport to base
    teleportToBase() {
        this._tileRow = 0;
        this._tileCol = GameState.playerCol;
        this._moveAccX = 0;
        this._moveAccY = 0;
        this._updatePos();
        if (this.onAtBase) this.onAtBase();
    }

    // Use consumable recall flare
    useRecallFlare() {
        const c = GameState.consumables;
        if (c.recall_flare > 0) {
            c.recall_flare--;
            this.teleportToBase();
            return true;
        }
        return false;
    }

    useTNT() {
        const c = GameState.consumables;
        if (c.tnt <= 0) return false;
        c.tnt--;
        const r = this._tileRow, col = this._tileCol;
        // Blast 3x3 area below
        for (let dr = 0; dr <= 2; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const b = getBlock(this._world, r + dr, col + dc);
                if (b !== BLOCK.BEDROCK && b !== BLOCK.AIR) {
                    setBlock(this._world, r + dr, col + dc, BLOCK.AIR);
                }
            }
        }
        this._worldDirty = true;
        return true;
    }
}
