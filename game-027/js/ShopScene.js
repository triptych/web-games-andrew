/**
 * ShopScene.js — Consumables-only shop node screen (game-plan §8).
 *
 * Launched when the player lands on a shop node from the run map. Sells
 * consumable items for currency (grams). Passives are NOT sold here (§8).
 * Leaving returns to MapScene and marks the node resolved.
 *
 * Received data: { nodeId: string }
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { ITEM_DEFS } from './items.js';
import { state }     from './state.js';
import { events }    from './events.js';
import { playUiClick, playPurchase, playItemUse } from './sounds.js';

function hex(arr)      { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const PANEL_W = 680;
const PANEL_H = 480;
const PANEL_X = (GAME_WIDTH  - PANEL_W) / 2;
const PANEL_Y = (GAME_HEIGHT - PANEL_H) / 2;

const ROW_H = 68;
const ROW_X = PANEL_X + 24;
const ROWS_Y = PANEL_Y + 100;

export class ShopScene extends Scene {
    constructor() { super({ key: 'ShopScene' }); }

    create(data) {
        data = data || {};
        this._nodeId     = data.nodeId || null;
        this._firstVisit = !state.hasSeenScript('shop-pellerin-intro');
        this._selected   = null; // item index

        // ── Background dim ────────────────────────────────────────────────
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT, toHexInt(COLORS.bg));

        // ── Panel ─────────────────────────────────────────────────────────
        const gfx = this.add.graphics();
        gfx.fillStyle(toHexInt(COLORS.panel), 0.98);
        gfx.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);
        gfx.lineStyle(2, toHexInt(COLORS.gold), 0.85);
        gfx.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);

        // ── Header ────────────────────────────────────────────────────────
        this.add.text(GAME_WIDTH / 2, PANEL_Y + 28,
            '🛒  THE APOTHECARY MARKET', {
            fontSize: '22px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.gold),
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, PANEL_Y + 56,
            '"Quality reagents for the discerning alchemist."  — Pellerin', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5);

        // ── Currency display ──────────────────────────────────────────────
        this._currencyTxt = this.add.text(PANEL_X + PANEL_W - 16, PANEL_Y + 28,
            `💰 ${state.currency} grams`, {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.parchment),
        }).setOrigin(1, 0.5);

        // ── Item rows ─────────────────────────────────────────────────────
        this._rows = [];
        ITEM_DEFS.forEach((item, i) => {
            this._rows.push(this._buildRow(item, i));
        });

        // ── Description panel ─────────────────────────────────────────────
        const descY = ROWS_Y + ITEM_DEFS.length * ROW_H + 8;
        this._descBg = this.add.graphics();
        this._descBg.fillStyle(toHexInt(COLORS.bg), 0.7);
        this._descBg.fillRoundedRect(ROW_X, descY, PANEL_W - 48, 42, 5);

        this._descTxt = this.add.text(ROW_X + 12, descY + 10,
            'Select an item to see its description.', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });

        // ── BUY button ────────────────────────────────────────────────────
        const btnY = PANEL_Y + PANEL_H - 64;
        this._buyBtnGfx = this.add.graphics();
        this._buyBtnTxt = this.add.text(PANEL_X + 180, btnY + 17, '[ BUY ]', {
            fontSize: '16px', fontFamily: 'monospace', color: hex(COLORS.parchment),
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this._buyBtnTxt.on('pointerdown', () => this._onBuy());
        this._buyBtnTxt.on('pointerover', () => this._buyBtnTxt.setColor(hex(COLORS.gold)));
        this._buyBtnTxt.on('pointerout',  () => this._buyBtnTxt.setColor(hex(COLORS.parchment)));
        this._refreshBuyBtn();

        // ── LEAVE button ──────────────────────────────────────────────────
        const leaveTxt = this.add.text(PANEL_X + PANEL_W - 80, btnY + 17, '[ LEAVE → ]', {
            fontSize: '15px', fontFamily: 'monospace', color: hex(COLORS.brass),
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        leaveTxt.on('pointerdown', () => this._leave());
        leaveTxt.on('pointerover', () => leaveTxt.setColor(hex(COLORS.gold)));
        leaveTxt.on('pointerout',  () => leaveTxt.setColor(hex(COLORS.brass)));

        // ── Keyboard shortcuts ────────────────────────────────────────────
        this.input.keyboard.on('keydown-ESC',   () => this._leave());
        this.input.keyboard.on('keydown-ENTER', () => this._onBuy());

        // ── First visit: fire shop-pellerin-intro VN script ───────────────
        if (this._firstVisit) {
            state.markScriptSeen('shop-pellerin-intro');
            this.time.delayedCall(200, () => {
                this.scene.launch('VNScene', {
                    scriptId:    'shop-pellerin-intro',
                    pauseScenes: ['ShopScene'],
                    onComplete:  () => this.scene.resume('ShopScene'),
                });
            });
        }

        // Listen for currency changes (in case something external modifies it).
        this._off = events.on('currencyChanged', (amt) => {
            this._currencyTxt.setText(`💰 ${amt} grams`);
            this._refreshAllRows();
            this._refreshBuyBtn();
        });

        this.events.on('shutdown', () => { if (this._off) { this._off(); this._off = null; } });
    }

    // ── Row builder ───────────────────────────────────────────────────────────

    _buildRow(item, i) {
        const y    = ROWS_Y + i * ROW_H;
        const x    = ROW_X;
        const w    = PANEL_W - 48;
        const affordable = state.currency >= item.price;
        const owned  = state.itemCount(item.id);

        const bgGfx = this.add.graphics();
        this._drawRowBg(bgGfx, x, y, w, false, affordable);

        const glyphTxt = this.add.text(x + 16, y + ROW_H / 2,
            item.glyph, {
            fontSize: '20px', fontFamily: 'monospace',
            color: affordable ? hex(COLORS.gold) : hex(COLORS.textDim),
        }).setOrigin(0, 0.5);

        const nameTxt = this.add.text(x + 48, y + 14,
            item.name, {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
            color: affordable ? hex(COLORS.parchment) : hex(COLORS.textDim),
        });

        const flavorTxt = this.add.text(x + 48, y + 34,
            item.flavor, {
            fontSize: '11px', fontFamily: 'monospace',
            color: hex(COLORS.textDim),
        });

        const priceTxt = this.add.text(x + w - 16, y + ROW_H / 2,
            `${item.price}g`, {
            fontSize: '14px', fontFamily: 'monospace',
            color: affordable ? hex(COLORS.gold) : hex(COLORS.danger),
        }).setOrigin(1, 0.5);

        const ownedTxt = this.add.text(x + w - 16, y + 14,
            `own ×${owned}`, {
            fontSize: '11px', fontFamily: 'monospace',
            color: hex(COLORS.textDim),
        }).setOrigin(1, 0);

        // Hit area — manual rect test to avoid Phaser 4 container issues.
        const zone = this.add.zone(x + w / 2, y + ROW_H / 2, w, ROW_H)
            .setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            this._selectRow(i);
        });
        zone.on('pointerdown', () => {
            this._selectRow(i);
        });

        return { bgGfx, glyphTxt, nameTxt, flavorTxt, priceTxt, ownedTxt, zone, item, y, x, w };
    }

    _drawRowBg(gfx, x, y, w, selected, affordable) {
        gfx.clear();
        const alpha = selected ? 0.5 : 0.15;
        const col   = selected ? toHexInt(COLORS.brass) : toHexInt(COLORS.panelEdge);
        gfx.fillStyle(col, alpha);
        gfx.fillRoundedRect(x, y + 2, w, ROW_H - 4, 5);
        if (selected) {
            gfx.lineStyle(1.5, toHexInt(COLORS.gold), 0.8);
            gfx.strokeRoundedRect(x, y + 2, w, ROW_H - 4, 5);
        }
    }

    _selectRow(i) {
        this._selected = i;
        this._refreshAllRows();
        const item = ITEM_DEFS[i];
        this._descTxt.setText(`${item.glyph}  ${item.description}`);
        this._refreshBuyBtn();
    }

    _refreshAllRows() {
        this._rows.forEach((row, i) => {
            const selected   = i === this._selected;
            const affordable = state.currency >= row.item.price;
            this._drawRowBg(row.bgGfx, row.x, row.y, row.w, selected, affordable);
            const col = affordable ? hex(COLORS.parchment) : hex(COLORS.textDim);
            const priceCol = affordable ? hex(COLORS.gold) : hex(COLORS.danger);
            row.glyphTxt.setColor(affordable ? hex(COLORS.gold) : hex(COLORS.textDim));
            row.nameTxt.setColor(col);
            row.priceTxt.setColor(priceCol);
            row.ownedTxt.setText(`own ×${state.itemCount(row.item.id)}`);
        });
    }

    _refreshBuyBtn() {
        const item = this._selected != null ? ITEM_DEFS[this._selected] : null;
        const canBuy = item && state.currency >= item.price;
        this._buyBtnGfx.clear();
        const btnY = PANEL_Y + PANEL_H - 64;
        const col  = canBuy ? toHexInt(COLORS.panelEdge) : toHexInt(COLORS.bg);
        this._buyBtnGfx.fillStyle(col, 0.9);
        this._buyBtnGfx.fillRoundedRect(PANEL_X + 100, btnY, 160, 34, 5);
        this._buyBtnTxt.setColor(canBuy ? hex(COLORS.parchment) : hex(COLORS.textDim));
    }

    _onBuy() {
        if (this._selected == null) return;
        const item = ITEM_DEFS[this._selected];
        if (!item) return;
        if (!state.spendCurrency(item.price)) return; // can't afford
        state.giveItem(item.id, 1);
        state.save();
        playPurchase();
        events.emit('itemPurchased', { itemId: item.id, cost: item.price });
        this._refreshAllRows();
        this._refreshBuyBtn();
        this._currencyTxt.setText(`💰 ${state.currency} grams`);
        // Brief flash on the bought item row.
        const row = this._rows[this._selected];
        if (row) {
            this.tweens.add({ targets: [row.nameTxt, row.ownedTxt],
                alpha: 0.3, yoyo: true, duration: 120 });
        }
    }

    _leave() {
        playUiClick();
        if (this._nodeId) state.resolveNode(this._nodeId);
        state.save();
        this.scene.start('MapScene');
    }
}
