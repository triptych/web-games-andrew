/**
 * GameScene — core block-placement puzzle (game-plan §1–§3, Phase 1).
 *
 * Responsibilities:
 *   - render the lattice and the tray (sets of 3)
 *   - drag-and-drop with snap + ghost preview (green = fits, red = collision)
 *   - commit placement → line-clear detection → scoring (combo/streak) → juice
 *   - deal the next set when the hand empties
 *   - "jammed" failure (§Failure 1) with a near-stuck HUD warning
 *
 * Pure-data logic lives in grid.js / supply.js / pieces.js / state.js; this
 * scene is the Phaser view + input layer.
 */

import { Scene, Geom } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import {
    GAME_WIDTH, GRID_W, GRID_H, CELL_SIZE, CELL_GAP, GRID_X, GRID_Y,
    TRAY_SLOT_X, TRAY_Y, TRAY_CELL, COLORS, TILE_TYPES,
    SCORE_PER_CELL, STREAK_BONUS, SUPPLY_TILES, ELEMENTS, STARTING_LAYOUTS,
} from './config.js';
import { Grid } from './grid.js';
import { Supply } from './supply.js';
import { Deposits } from './deposits.js';
import { getShape } from './pieces.js';
import { state } from './state.js';
import { events } from './events.js';
import {
    playPickup, playPlace, playInvalid, playLineClear, playCombo,
    playSetDealt, playJammed, playCoverStripped, playHarvest,
    playLevelComplete, playInfeasible, playCauldronUpgrade,
} from './sounds.js';
import { LevelManager, getLevelDef, objectiveLabel } from './level.js';

function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }
function hexStr(arr)   { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
const TILE = {};
for (const t of TILE_TYPES) TILE[t.id] = t;
const ELEM = {};
for (const e of ELEMENTS) ELEM[e.id] = e;
const ELEM_FALLBACK = ELEMENTS[0];

export class GameScene extends Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        state.reset();

        // Load the current level definition (driven by run progression).
        this.levelDef = getLevelDef(state.runLevelIndex);
        const seed    = this.levelDef.seed || 20260614;
        const slack   = this.levelDef.supplySlack ?? 1.6;
        // Supply size: objective-driven (§4). For now use SUPPLY_TILES * slack / 1.6
        // as a simple approximation; Phase 9 will tune per-objective workload.
        const supplyTotal = Math.ceil(SUPPLY_TILES * (slack / 1.6) / 3) * 3;

        this.grid     = new Grid(this.levelDef.gridW || GRID_W, this.levelDef.gridH || GRID_H);
        this.supply   = new Supply(seed, supplyTotal);
        this.deposits = new Deposits(this.levelDef.depositSet);   // §5

        // LevelManager wires objective tracking / win / Failure 2.
        this.levelMgr = new LevelManager(this.levelDef, this.grid, this.deposits, this.supply);

        // Listen for objective-met here (GameScene is the orchestrator).
        this._levelOffsets = [];
        this._levelOffsets.push(events.on('objectiveMet', () => this._onObjectiveMet()));
        this._levelOffsets.push(events.on('levelFailed',  (d) => {
            if (d.reason === 'infeasible') this._onInfeasible();
        }));

        // Layers (back → front)
        this.boardGfx   = this.add.graphics();                 // grid cells (rebuilt each change)
        this.buriedGfx  = this.add.graphics().setDepth(5);     // buried-deposit overlay
        this.blockGfx   = this.add.graphics().setDepth(10);    // placed blocks
        this.fxLayer    = this.add.container(0, 0).setDepth(20); // dissolve motes / harvest flourish
        this.ghostGfx   = this.add.graphics().setDepth(50);    // drag ghost
        this.trayLayer  = this.add.container(0, 0).setDepth(40);

        this.drag = null;     // active drag: { slot, shape, tileType, container, gx, gy, valid }
        this.traySprites = []; // per-slot { container, slot } | null
        // tooltip is rendered by UIScene (top scene) via tooltipShow/tooltipHide events

        this._applyStartingLayout(seed);
        this._drawBoard();
        this._drawBuried();
        this._redrawBlocks();

        // Deal the first set.
        this.supply.deal(this.grid);
        this._buildTray();
        playSetDealt();

        // All pointer interaction is handled at the scene level and hit-tested
        // manually (robust — avoids fragile per-container hit areas in Phaser 4).
        this.input.on('pointerdown', (p) => this._onPointerDown(p));
        this.input.on('pointermove', (p) => this._onPointerMove(p));
        this.input.on('pointerup',   (p) => this._onDragEnd(p));

        // Restart key — retries the same level (same seed, same index).
        this.input.keyboard.on('keydown-R', () => {
            this.scene.stop('UIScene');
            this.scene.start('GameScene');
            this.scene.launch('UIScene');
        });

        // C — open cauldron in read-only recipe-reference mode mid-level (§4).
        this.input.keyboard.on('keydown-C', () => {
            this.scene.launch('CauldronScene', { readOnly: true, returnTo: 'GameScene' });
            this.scene.pause('GameScene');
            this.scene.pause('UIScene');
        });

        // Esc — save current run state and return to the title screen.
        this.input.keyboard.on('keydown-ESC', () => {
            state.save();
            this.scene.stop('UIScene');
            this.scene.start('SplashScene');
        });

        events.emit('scoreChanged', state.score);
        // Tell the UI about the current level and its objective.
        events.emit('levelStarted', {
            levelName: this.levelDef.name,
            objective: this.levelDef.objective,
            objectiveLabel: objectiveLabel(this.levelDef.objective),
        });
        this._announceJamRisk();
    }

    // ---- Board rendering ---------------------------------------------------

    _cellRect(cx, cy) {
        return {
            x: GRID_X + cx * CELL_SIZE + CELL_GAP,
            y: GRID_Y + cy * CELL_SIZE + CELL_GAP,
            w: CELL_SIZE - CELL_GAP * 2,
            h: CELL_SIZE - CELL_GAP * 2,
        };
    }

    _drawBoard() {
        const g = this.boardGfx;
        g.clear();
        // Panel backdrop behind the lattice.
        g.fillStyle(toHexInt(COLORS.gridBg), 1);
        g.fillRoundedRect(GRID_X - 12, GRID_Y - 12, GRID_W * CELL_SIZE + 24, GRID_H * CELL_SIZE + 24, 8);
        g.lineStyle(2, toHexInt(COLORS.panelEdge), 0.8);
        g.strokeRoundedRect(GRID_X - 12, GRID_Y - 12, GRID_W * CELL_SIZE + 24, GRID_H * CELL_SIZE + 24, 8);

        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const r = this._cellRect(x, y);
                const tint = ((x + y) % 2 === 0) ? COLORS.cellEmpty : COLORS.cellEmptyHi;
                g.fillStyle(toHexInt(tint), 1);
                g.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
            }
        }
    }

    /** Pre-fill the grid with the level's starting block layout (pick by seed). */
    _applyStartingLayout(seed) {
        const layout = STARTING_LAYOUTS[seed % STARTING_LAYOUTS.length];
        for (const { x, y, tileType } of layout) {
            if (this.grid.inBounds(x, y) && this.grid.isEmpty(x, y)) {
                this.grid.cells[y][x] = { tileType };
            }
        }
    }

    /**
     * Buried-deposit overlay (§5): a subtle dark inset + the element glyph, with
     * a small pip stack showing remaining cover layers. Buried cells are still
     * normal lattice cells (placeable-over), so this draws UNDER the block layer
     * and is only visible on empty deposit cells.
     */
    _drawBuried() {
        const g = this.buriedGfx;
        g.clear();
        if (this._buriedGlyphs) this._buriedGlyphs.forEach(t => t.destroy());
        this._buriedGlyphs = [];

        for (const dep of this.deposits.all()) {
            const nearly = this.deposits.isNearlyHarvested(dep);
            const elem = ELEM[dep.element] || ELEM_FALLBACK;
            for (const c of dep.cells) {
                const layers = this.deposits.coverLayers(c.x, c.y);
                if (layers <= 0) continue;  // fully uncovered cell — nothing to draw
                const r = this._cellRect(c.x, c.y);

                // "buried" inset: darker tile with a faint element-tinted glow.
                g.fillStyle(0x000000, 0.30);
                g.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
                g.lineStyle(2, toHexInt(elem.color), nearly ? 0.85 : 0.4);
                g.strokeRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 3);

                // cover-layer pips (top-right corner): one dot per remaining layer.
                for (let i = 0; i < layers; i++) {
                    g.fillStyle(toHexInt(elem.color), 0.85);
                    g.fillCircle(r.x + r.w - 7 - i * 7, r.y + 7, 2.4);
                }

                // dim element glyph hinting what's buried (full ident on hover).
                const t = this.add.text(r.x + r.w / 2, r.y + r.h / 2, elem.glyph, {
                    fontSize: '20px', fontFamily: 'monospace',
                    color: '#' + elem.color.map(v => Math.round(v * 0.7).toString(16).padStart(2, '0')).join(''),
                }).setOrigin(0.5).setDepth(6).setAlpha(nearly ? 0.9 : 0.5);
                this._buriedGlyphs.push(t);
            }
        }
    }

    _redrawBlocks() {
        const g = this.blockGfx;
        g.clear();
        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const cell = this.grid.cells[y][x];
                if (!cell) continue;
                this._drawBlockCell(g, x, y, cell.tileType, 1);
            }
        }
    }

    _drawBlockCell(g, cx, cy, tileType, alpha) {
        const r = this._cellRect(cx, cy);
        const col = toHexInt((TILE[tileType] || TILE_TYPES[0]).color);
        g.fillStyle(col, alpha);
        g.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
        // inner highlight for a little depth
        g.fillStyle(0xffffff, 0.12 * alpha);
        g.fillRoundedRect(r.x + 3, r.y + 3, r.w - 6, Math.max(2, r.h * 0.28), 3);
    }

    // ---- Tray --------------------------------------------------------------

    _buildTray() {
        this.trayLayer.removeAll(true);
        this.traySprites = [];

        this.supply.hand.forEach((tile, slot) => {
            if (!tile) { this.traySprites[slot] = null; return; }
            const shape = getShape(tile.shapeId);
            const c = this._makeTrayShape(shape, tile.tileType);
            c.x = TRAY_SLOT_X[slot];
            c.y = TRAY_Y;
            this.trayLayer.add(c);

            // Screen-space hit rect (with a little padding) for manual hit-testing.
            const bw = shape.w * TRAY_CELL, bh = shape.h * TRAY_CELL;
            const pad = 14;
            const hit = new Geom.Rectangle(c.x - bw / 2 - pad, c.y - bh / 2 - pad, bw + pad * 2, bh + pad * 2);
            this.traySprites[slot] = { container: c, slot, hit };
        });
    }

    /** Scene-level pointerdown: pick up a tray shape if the press lands on one. */
    _onPointerDown(pointer) {
        if (this.drag || state.failed) return;
        for (const ts of this.traySprites) {
            if (ts && ts.container.visible && Geom.Rectangle.Contains(ts.hit, pointer.x, pointer.y)) {
                this._onDragStart(ts.slot, pointer);
                return;
            }
        }
    }

    /** Build a small container drawing of a shape, origin-centered. */
    _makeTrayShape(shape, tileType, scale = 1) {
        const c = this.add.container(0, 0);
        const g = this.add.graphics();
        const col = toHexInt((TILE[tileType] || TILE_TYPES[0]).color);
        const cell = TRAY_CELL * scale;
        const bw = shape.w * cell, bh = shape.h * cell;
        const ox = -bw / 2, oy = -bh / 2;
        for (const cc of shape.cells) {
            const x = ox + cc.x * cell, y = oy + cc.y * cell;
            g.fillStyle(col, 1);
            g.fillRoundedRect(x + 2, y + 2, cell - 4, cell - 4, 4);
            g.fillStyle(0xffffff, 0.14);
            g.fillRoundedRect(x + 4, y + 4, cell - 8, (cell - 8) * 0.3, 3);
        }
        c.add(g);

        // Glyph badge so the tile type reads at a glance (§UI: glyph + color).
        const glyph = (TILE[tileType] || TILE_TYPES[0]).glyph;
        const t = this.add.text(0, oy - 10, glyph, {
            fontSize: '14px', fontFamily: 'monospace', color: '#1a120a', fontStyle: 'bold',
        }).setOrigin(0.5);
        c.add(t);
        return c;
    }

    // ---- Drag & drop -------------------------------------------------------

    _onDragStart(slot, pointer) {
        if (state.failed) return;
        const tile = this.supply.hand[slot];
        if (!tile) return;
        this._hideTooltip();

        const shape = getShape(tile.shapeId);
        const ts = this.traySprites[slot];
        if (ts && ts.container) ts.container.setVisible(false);

        // Floating drag preview at full board cell size.
        const container = this._makeBoardSizedShape(shape, tile.tileType);
        container.setDepth(60);
        container.x = pointer.x;
        container.y = pointer.y;

        this.drag = { slot, shape, tileType: tile.tileType, container, gx: -1, gy: -1, valid: false };
        playPickup();
        events.emit('shapePicked', { shapeId: tile.shapeId });
        this._updateGhost(pointer);
    }

    _makeBoardSizedShape(shape, tileType) {
        const c = this.add.container(0, 0);
        const g = this.add.graphics();
        const col = toHexInt((TILE[tileType] || TILE_TYPES[0]).color);
        // Anchor the shape so the pointer sits near the shape's first cell center.
        const ox = -CELL_SIZE / 2, oy = -CELL_SIZE / 2;
        for (const cc of shape.cells) {
            const x = ox + cc.x * CELL_SIZE, y = oy + cc.y * CELL_SIZE;
            g.fillStyle(col, 0.9);
            g.fillRoundedRect(x + CELL_GAP, y + CELL_GAP, CELL_SIZE - CELL_GAP * 2, CELL_SIZE - CELL_GAP * 2, 4);
        }
        c.add(g);
        return c;
    }

    /** Scene-level move: drag the held shape, else show a buried-cell tooltip. */
    _onPointerMove(pointer) {
        if (this.drag) {
            this.drag.container.x = pointer.x;
            this.drag.container.y = pointer.y;
            this._updateGhost(pointer);
            this._hideTooltip();
        } else {
            this._updateTooltip(pointer);
        }
    }

    /** Compute the snapped grid origin under the pointer and draw the ghost. */
    _updateGhost(pointer) {
        const d = this.drag;
        // The drag container's first cell sits at the pointer; map pointer to a cell.
        const gx = Math.round((pointer.x - GRID_X - CELL_SIZE / 2) / CELL_SIZE);
        const gy = Math.round((pointer.y - GRID_Y - CELL_SIZE / 2) / CELL_SIZE);

        d.gx = gx; d.gy = gy;
        d.valid = this.grid.canPlace(d.shape, gx, gy);

        const g = this.ghostGfx;
        g.clear();
        // Only draw a board ghost when the pointer is near the lattice.
        const overBoard = pointer.x >= GRID_X - CELL_SIZE && pointer.x <= GRID_X + GRID_W * CELL_SIZE + CELL_SIZE
                       && pointer.y >= GRID_Y - CELL_SIZE && pointer.y <= GRID_Y + GRID_H * CELL_SIZE + CELL_SIZE;
        if (!overBoard) return;

        const col = toHexInt(d.valid ? COLORS.ghostOk : COLORS.ghostBad);
        for (const cc of d.shape.cells) {
            const x = gx + cc.x, y = gy + cc.y;
            if (!this.grid.inBounds(x, y)) continue;
            const r = this._cellRect(x, y);
            g.fillStyle(col, d.valid ? 0.35 : 0.30);
            g.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
            g.lineStyle(2, col, 0.9);
            g.strokeRoundedRect(r.x, r.y, r.w, r.h, 4);
        }
    }

    _onDragEnd() {
        const d = this.drag;
        if (!d) return;
        this.drag = null;
        this.ghostGfx.clear();
        d.container.destroy();

        if (d.valid && this.grid.canPlace(d.shape, d.gx, d.gy)) {
            this._commitPlacement(d);
        } else {
            // Invalid → return the shape to the tray.
            playInvalid();
            events.emit('placeInvalid');
            const ts = this.traySprites[d.slot];
            if (ts && ts.container) ts.container.setVisible(true);
        }
    }

    // ---- Placement → clear → score ----------------------------------------

    _commitPlacement(d) {
        const filled = this.grid.place(d.shape, d.gx, d.gy, d.tileType);
        this.supply.consumeSlot(d.slot);
        this._redrawBlocks();
        playPlace();
        events.emit('shapePlaced', { shapeId: d.shape.id, cells: filled });

        // small settle squash on the placed cells
        this._settleFlash(filled);

        // Line clears (§3).
        const { rows, cols, cells } = this.grid.clearLines();
        const lines = rows.length + cols.length;

        if (lines > 0) {
            this._dissolve(cells);
            this._redrawBlocks();
            const base = cells.length * SCORE_PER_CELL * Math.max(1, lines); // combo multiplier
            state.applyPlacement(lines);
            const streakBonus = state.streak > 1 ? (state.streak - 1) * STREAK_BONUS : 0;
            state.score = state.score + base + streakBonus;
            events.emit('linesCleared', { rows, cols, cells, combo: lines });
            if (lines >= 2) playCombo(lines); else playLineClear(lines);

            // §5 — strip deposit covers on cleared cells, harvest on full reveal.
            const { stripped, harvested } = this.deposits.onLinesCleared(cells);
            if (stripped.length) {
                playCoverStripped();
                this._drawBuried();
            }
            for (const h of harvested) {
                state.addElement(h.elementId, h.qty);
                const dep = this.deposits.byId.get(h.depositId);
                this._harvestFlourish(dep);
                playHarvest();
            }
        } else {
            state.applyPlacement(0); // breaks streak
        }

        // Refill the hand if empty, then check for a jam.
        if (this.supply.handEmpty()) {
            const dealt = this.supply.deal(this.grid);
            if (dealt) { this._buildTray(); playSetDealt(); }
        } else {
            this._buildTray();
        }

        this._checkJam();
        this._announceJamRisk();
        // Objective / infeasibility check AFTER jam check (jam takes priority).
        if (!state.failed) this.levelMgr.afterPlacement();
    }

    // ---- Failure 1: jammed -------------------------------------------------

    _checkJam() {
        if (state.failed) return;
        const held = this.supply.heldShapeIds();
        if (held.length === 0 && this.supply.remaining === 0) {
            // Supply exhausted without winning — let LevelManager decide infeasibility.
            // If the objective was already met (_onObjectiveMet fires first), this won't
            // be reached. Otherwise treat as infeasible (out of pieces, §Failure 2).
            if (!this.levelMgr.isMet) {
                this.levelMgr.afterPlacement(); // triggers infeasible emit if applicable
            }
            return;
        }
        if (held.length > 0 && !this.grid.anyHeldFits(held)) {
            // No held shape fits anywhere → jammed.
            state.failed = true;
            playJammed();
            events.emit('levelFailed', { reason: 'jammed' });
            this.time.delayedCall(600, () => this._endLevel('jammed'));
        }
    }

    /** Flag a held shape that has very few legal spots left (§Failure 1 warning). */
    _announceJamRisk() {
        if (state.failed) return;
        const held = this.supply.hand.filter(Boolean);
        let worst = null;
        for (const tile of held) {
            const n = this.grid.countPlacements(getShape(tile.shapeId));
            if (worst === null || n < worst.legalSpots) worst = { shapeId: tile.shapeId, legalSpots: n };
        }
        if (worst) events.emit('shapeNearlyStuck', worst);
    }

    // ---- Objective met (win condition satisfied) ---------------------------

    _onObjectiveMet() {
        if (state.failed || this._objectiveAlreadyMet) return;
        this._objectiveAlreadyMet = true;
        playLevelComplete();

        // Award rewards from the level def.
        const rewards = this.levelDef.rewards || {};
        if (rewards.currency) state.addCurrency(rewards.currency);
        if (rewards.xp)       state.addXP(rewards.xp);
        const upgradedCauldron = !!rewards.cauldronUpgrade;
        if (upgradedCauldron) {
            state.upgradeCauldron();
            playCauldronUpgrade();
        }

        // Advance run progression and persist.
        state.advanceLevel(); // also calls state.save()

        this.time.delayedCall(400, () => this._endLevel('complete', rewards, upgradedCauldron));
    }

    // ---- Failure 2: infeasible --------------------------------------------

    _onInfeasible() {
        if (state.failed) return;
        state.failed = true;
        playInfeasible();
        this.time.delayedCall(200, () => this._endLevel('infeasible'));
    }

    _endLevel(reason, rewards = {}, cauldronUpgraded = false) {
        this.scene.stop('UIScene');
        this.scene.start('ResultScene', {
            reason,
            score:           state.score,
            maxCombo:        state.maxCombo,
            harvested:       state.harvested,
            rewards,
            cauldronUpgraded,
            levelName:       this.levelDef.name,
            nextLevelName:   getLevelDef(state.runLevelIndex).name,
        });
    }

    // ---- Juice -------------------------------------------------------------

    _settleFlash(cells) {
        const g = this.add.graphics().setDepth(45);
        g.fillStyle(0xffffff, 0.25);
        for (const { x, y } of cells) {
            const r = this._cellRect(x, y);
            g.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
    }

    /** Cleared cells flash + dissolve into rising motes (§UI motion). */
    _dissolve(cells) {
        const flash = this.add.graphics().setDepth(46);
        flash.fillStyle(0xffffff, 0.55);
        for (const { x, y } of cells) {
            const r = this._cellRect(x, y);
            flash.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
        }
        this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });

        for (const { x, y } of cells) {
            const r = this._cellRect(x, y);
            for (let i = 0; i < 3; i++) {
                const mote = this.add.circle(
                    r.x + Math.random() * r.w,
                    r.y + Math.random() * r.h,
                    2 + Math.random() * 2,
                    toHexInt(COLORS.gold), 0.9,
                ).setDepth(47);
                this.fxLayer.add(mote);
                this.tweens.add({
                    targets: mote,
                    y: mote.y - (28 + Math.random() * 40),
                    alpha: 0,
                    duration: 500 + Math.random() * 300,
                    ease: 'Sine.easeOut',
                    onComplete: () => mote.destroy(),
                });
            }
        }
    }

    /** Harvest flourish (§UI): a gold ring blooms over the deposit + the element
     *  glyph rises and fades from the deposit's center. */
    _harvestFlourish(dep) {
        // Center of the deposit's bounding box.
        let cx = 0, cy = 0;
        for (const c of dep.cells) { const r = this._cellRect(c.x, c.y); cx += r.x + r.w / 2; cy += r.y + r.h / 2; }
        cx /= dep.cells.length; cy /= dep.cells.length;

        const elem = ELEM[dep.element] || ELEM_FALLBACK;
        const col = toHexInt(elem.color);

        // expanding ring — draw as a Graphics object so we can tween its scale
        const ring = this.add.graphics().setDepth(48);
        ring.lineStyle(3, col, 0.95);
        ring.strokeCircle(cx, cy, 8);
        this.fxLayer.add(ring);
        this.tweens.add({ targets: ring, scaleX: 9, scaleY: 9, alpha: 0, duration: 650,
            ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });

        // rising glyph
        const glyph = this.add.text(cx, cy, elem.glyph, {
            fontSize: '34px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hexStr(elem.color),
        }).setOrigin(0.5).setDepth(49);
        this.fxLayer.add(glyph);
        this.tweens.add({ targets: glyph, y: cy - 52, alpha: 0, scale: 1.4, duration: 850,
            ease: 'Sine.easeOut', onComplete: () => glyph.destroy() });

        // redraw the (now-uncovered) cells
        this._drawBuried();
    }

    // ---- Buried-cell hover tooltip ----------------------------------------

    _updateTooltip(pointer) {
        const gx = Math.floor((pointer.x - GRID_X) / CELL_SIZE);
        const gy = Math.floor((pointer.y - GRID_Y) / CELL_SIZE);
        let dep = null;
        if (this.grid.inBounds(gx, gy) && this.deposits.coverLayers(gx, gy) > 0) {
            dep = this.deposits.depositAt(gx, gy);
        }
        if (!dep) { this._hideTooltip(); return; }

        const elem = ELEM[dep.element] || ELEM_FALLBACK;
        const layers = this.deposits.coverLayers(gx, gy);
        const label = `${elem.glyph} ${elem.name} (${elem.tier})\n` +
                      `${layers} cover${layers === 1 ? '' : 's'} left · clear lines over it`;

        events.emit('tooltipShow', { x: pointer.x, y: pointer.y, label, color: elem.color });
    }

    _hideTooltip() {
        events.emit('tooltipHide');
    }

    shutdown() {
        if (this.levelMgr) { this.levelMgr.dispose(); this.levelMgr = null; }
        this._levelOffsets && this._levelOffsets.forEach(off => off());
        this._levelOffsets = [];
        events.clearAll();
    }
}
