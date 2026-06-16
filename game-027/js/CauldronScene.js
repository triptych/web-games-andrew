/**
 * CauldronScene — between-levels crafting screen (game-plan §4 / §Other screens).
 *
 * Opened by pressing C. Two modes:
 *   readOnly: true  — mid-level recipe reference; no crafting, just browse.
 *   readOnly: false — between-levels workbench; spend elements to unlock tile types.
 *
 * Layout: left column = tile-type list with unlock status / recipe / UNLOCK button;
 * right column = your element stores; bottom = close hint.
 *
 * Data: reads state.stores, state.unlockedTypes, state.cauldronTier.
 * On unlock: calls state.spendElements(recipe) + state.unlockTileType(id, recipe);
 *            emits tileTypeUnlocked (handled by state, sounds listen in main).
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, ELEMENTS, TILE_TYPE_DEFS, CAULDRON_TIERS } from './config.js';
import { state } from './state.js';
import { events } from './events.js';
import { playUiClick, playTileUnlocked } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const ELEM_MAP = new Map(ELEMENTS.map(e => [e.id, e]));

// Column geometry
const COL_L_X  = 60;
const COL_L_W  = 730;
const COL_R_X  = 820;
const COL_R_W  = GAME_WIDTH - COL_R_X - 40;
const ROW_H    = 54;
const LIST_Y   = 120;

export class CauldronScene extends Scene {
    constructor() { super({ key: 'CauldronScene' }); }

    create(data = {}) {
        this._readOnly   = !!data.readOnly;
        this._returnTo   = data.returnTo || 'ResultScene';
        this._returnData = data.returnData || {};
        this._selected   = null;  // currently highlighted tile-type def

        // Dim overlay behind the panel.
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
            toHexInt(COLORS.bg), 0.92);

        this._drawHeader();
        this._drawStores();
        this._buildList();
        this._drawFooter();

        // C / Escape to close.
        this.input.keyboard.on('keydown-C', () => this._close());
        this.input.keyboard.on('keydown-ESC', () => this._close());
        this.input.on('pointerdown', (p) => this._onPointerDown(p));
    }

    // ---- Header -----------------------------------------------------------

    _drawHeader() {
        const tier = CAULDRON_TIERS.find(t => t.tier === state.cauldronTier) || CAULDRON_TIERS[0];
        const label = this._readOnly ? '⚗  CAULDRON  (recipe reference — read only)' : `⚗  CAULDRON  ·  ${tier.name}`;
        this.add.text(COL_L_X, 24, label, {
            fontSize: '22px', fontFamily: 'monospace', fontStyle: 'bold', color: hex(COLORS.gold),
        });
        this.add.text(COL_L_X, 56, this._readOnly
            ? 'Browse tile-type recipes. Close with C or Esc.'
            : 'Spend harvested elements to unlock new tile types for future levels.', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });
        // Divider
        const g = this.add.graphics();
        g.lineStyle(1, toHexInt(COLORS.panelEdge), 0.6);
        g.lineBetween(COL_L_X, 88, GAME_WIDTH - 40, 88);
    }

    // ---- Element stores (right column) ------------------------------------

    _drawStores() {
        const g = this.add.graphics();
        g.fillStyle(toHexInt(COLORS.panel), 0.9);
        g.fillRoundedRect(COL_R_X - 12, LIST_Y - 14, COL_R_W + 24, ELEMENTS.length * 28 + 52, 8);
        g.lineStyle(1.5, toHexInt(COLORS.panelEdge), 0.8);
        g.strokeRoundedRect(COL_R_X - 12, LIST_Y - 14, COL_R_W + 24, ELEMENTS.length * 28 + 52, 8);

        this.add.text(COL_R_X, LIST_Y - 4, 'YOUR STORES', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });

        this._storeTexts = {};
        ELEMENTS.forEach((e, i) => {
            const qty = state.storeCount(e.id);
            const y = LIST_Y + 22 + i * 28;
            const t = this.add.text(COL_R_X, y,
                `${e.glyph} ${e.name.padEnd(7)} × ${qty}`, {
                fontSize: '15px', fontFamily: 'monospace',
                color: qty > 0 ? hex(e.color) : hex(COLORS.textDim),
            });
            this._storeTexts[e.id] = t;
        });
    }

    _refreshStores() {
        for (const [id, t] of Object.entries(this._storeTexts)) {
            const e = ELEM_MAP.get(id);
            const qty = state.storeCount(id);
            t.setText(`${e.glyph} ${e.name.padEnd(7)} × ${qty}`);
            t.setColor(qty > 0 ? hex(e.color) : hex(COLORS.textDim));
        }
    }

    // ---- Tile-type list (left column) -------------------------------------

    _buildList() {
        if (this._listContainer) this._listContainer.destroy(true);
        this._listContainer = this.add.container(0, 0);
        this._rows = [];

        const g = this.add.graphics();
        g.fillStyle(toHexInt(COLORS.panel), 0.85);
        g.fillRoundedRect(COL_L_X - 12, LIST_Y - 14, COL_L_W + 24,
            TILE_TYPE_DEFS.length * ROW_H + 28, 8);
        g.lineStyle(1.5, toHexInt(COLORS.panelEdge), 0.7);
        g.strokeRoundedRect(COL_L_X - 12, LIST_Y - 14, COL_L_W + 24,
            TILE_TYPE_DEFS.length * ROW_H + 28, 8);
        this._listContainer.add(g);

        TILE_TYPE_DEFS.forEach((def, i) => {
            const y = LIST_Y + 8 + i * ROW_H;
            this._addRow(def, y, i);
        });
    }

    _addRow(def, y, idx) {
        const unlocked  = state.isUnlocked(def.id);
        const canUnlock = !this._readOnly && state.canUnlock(def);
        const processable = new Set(state.processableTiers);
        // Is the recipe at least within what the cauldron can process (ignoring cost)?
        const tierOk = Object.keys(def.recipe).every(eid => {
            const e = ELEM_MAP.get(eid);
            return e && processable.has(e.tier);
        });
        const locked = !unlocked && !tierOk;  // cauldron tier gate

        // Row highlight background (hit rect stored for click detection)
        const rowBg = this.add.graphics().setDepth(1);
        if (unlocked) {
            rowBg.fillStyle(0x2a3a20, 0.5);
            rowBg.fillRoundedRect(COL_L_X - 8, y - 2, COL_L_W + 16, ROW_H - 4, 4);
        }
        this._listContainer.add(rowBg);

        // Status marker
        const marker = unlocked ? '✓' : (locked ? '·' : '○');
        const markerCol = unlocked ? hex(COLORS.success) : (locked ? hex(COLORS.textDim) : hex(COLORS.brass));
        const mt = this.add.text(COL_L_X, y + 14, marker, {
            fontSize: '18px', fontFamily: 'monospace', color: markerCol,
        }).setDepth(2);
        this._listContainer.add(mt);

        // Tile-type name + rarity
        const nameCol = unlocked ? hex(COLORS.text) : (locked ? hex(COLORS.textDim) : hex(COLORS.parchment));
        const nt = this.add.text(COL_L_X + 28, y + 6, def.name, {
            fontSize: '16px', fontFamily: 'monospace', fontStyle: unlocked ? 'normal' : 'normal',
            color: nameCol,
        }).setDepth(2);
        this._listContainer.add(nt);

        const rt = this.add.text(COL_L_X + 28, y + 28, def.rarity.toUpperCase(), {
            fontSize: '10px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setDepth(2);
        this._listContainer.add(rt);

        // Recipe cost display
        const recipeStr = this._recipeStr(def.recipe);
        const recipeCol = locked ? hex(COLORS.textDim) : (canUnlock ? hex(COLORS.gold) : hex(COLORS.textDim));
        const recipe_x = COL_L_X + 200;
        const rct = this.add.text(recipe_x, y + 14, recipeStr, {
            fontSize: '14px', fontFamily: 'monospace', color: recipeCol,
        }).setDepth(2);
        this._listContainer.add(rct);

        // UNLOCK button (only when between-levels, not read-only, and affordable)
        if (!this._readOnly && !unlocked && !locked) {
            const btnCol = canUnlock ? toHexInt(COLORS.success) : toHexInt(COLORS.textDim);
            const btnAlpha = canUnlock ? 0.9 : 0.4;
            const btnLabel = canUnlock ? '[ UNLOCK ]' : '[ UNLOCK ]';
            const btn_x = COL_L_X + COL_L_W - 120;
            const btnBg = this.add.graphics().setDepth(2);
            btnBg.fillStyle(btnCol, btnAlpha * 0.25);
            btnBg.fillRoundedRect(btn_x - 4, y + 4, 116, 36, 5);
            btnBg.lineStyle(1.5, btnCol, btnAlpha);
            btnBg.strokeRoundedRect(btn_x - 4, y + 4, 116, 36, 5);
            this._listContainer.add(btnBg);

            const btnT = this.add.text(btn_x + 4, y + 14, btnLabel, {
                fontSize: '14px', fontFamily: 'monospace', color: canUnlock ? hex(COLORS.success) : hex(COLORS.textDim),
            }).setDepth(3);
            this._listContainer.add(btnT);

            if (canUnlock) {
                // Store hit rect for click detection
                this._rows.push({
                    def,
                    hitX: btn_x - 4, hitY: y + 4, hitW: 116, hitH: 36,
                });
            }
        }

        // Greyed "tier locked" note
        if (locked) {
            const lt = this.add.text(COL_L_X + COL_L_W - 180, y + 14,
                `needs tier ${this._minTierFor(def)} cauldron`, {
                fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setDepth(2);
            this._listContainer.add(lt);
        }
    }

    _recipeStr(recipe) {
        const parts = Object.entries(recipe).map(([id, n]) => {
            const e = ELEM_MAP.get(id);
            return `${e ? e.glyph : '?'} ${n}`;
        });
        return parts.length ? parts.join('  ') : '(free)';
    }

    _minTierFor(def) {
        // The minimum cauldron tier that can process all of this recipe's elements.
        let minTier = 1;
        for (const eid of Object.keys(def.recipe)) {
            const e = ELEM_MAP.get(eid);
            if (!e) continue;
            const tierIdx = ['common','uncommon','rare','exotic'].indexOf(e.tier);
            minTier = Math.max(minTier, tierIdx + 1);
        }
        return minTier;
    }

    // ---- Footer -----------------------------------------------------------

    _drawFooter() {
        const hint = this._readOnly
            ? 'C or Esc — close and return to game'
            : 'C or Esc — close and return to workbench    •    click UNLOCK to spend elements';
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, hint, {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5, 1);
    }

    // ---- Input ------------------------------------------------------------

    _onPointerDown(pointer) {
        if (this._readOnly) return;
        for (const row of this._rows) {
            if (pointer.x >= row.hitX && pointer.x <= row.hitX + row.hitW
                && pointer.y >= row.hitY && pointer.y <= row.hitY + row.hitH) {
                this._attemptUnlock(row.def);
                return;
            }
        }
    }

    _attemptUnlock(def) {
        if (!state.canUnlock(def)) return;
        const spent = state.spendElements(def.recipe);
        if (!spent) return;
        state.unlockTileType(def.id, def.recipe);
        playUiClick();
        playTileUnlocked();
        this._refreshStores();
        this._buildList();   // rebuild rows to reflect new unlock state
    }

    // ---- Close ------------------------------------------------------------

    _close() {
        playUiClick();
        this.scene.stop('CauldronScene');
        if (this._returnTo === 'GameScene') {
            // Mid-level read-only: just resume the paused scenes.
            this.scene.resume('GameScene');
            this.scene.resume('UIScene');
        } else {
            // Between-levels: launch the next level.
            this.scene.start('GameScene');
            this.scene.launch('UIScene');
        }
    }
}
