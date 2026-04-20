/**
 * UIScene — HUD overlay, runs in parallel with GameScene.
 *
 * Displays:
 *   - Player HP bar and stats (top-left of viewport)
 *   - Floor number, gold, keys
 *   - Combat overlay (when in combat)
 *   - Message log (bottom of viewport)
 *   - Inventory screen (I key toggle)
 *   - Shop overlay (when stepping on shop tile)
 *   - Game-over and victory screens
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS,
    VIEW_WIDTH, VIEW_HEIGHT, MAP_PANEL_X, MAP_PANEL_WIDTH,
    SHOP_ITEMS,
} from './config.js';
import { saveHighScore } from './storage.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const HUD_BG   = 'rgba(0,0,0,0.55)';
const LOG_LINES = 5;

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        this._inventoryOpen = false;
        this._shopOpen      = false;
        this._shopContainer = null;
        this._invContainer  = null;

        this._buildHUD();
        this._buildCombatPanel();
        this._buildLog();
        this._subscribeEvents();
        this._refresh();
    }

    // -------------------------------------------------------
    // HUD (left panel header bar)
    // -------------------------------------------------------

    _buildHUD() {
        this._hudBg = this.add.rectangle(0, 0, VIEW_WIDTH, 54, 0x000000, 0.6).setOrigin(0, 0);

        this._hpLabel = this.add.text(10, 8, '', {
            fontSize: '14px', color: hex(COLORS.success), fontFamily: 'monospace',
        });

        this._hpBarBg = this.add.rectangle(10, 28, 200, 12, 0x202020).setOrigin(0, 0);
        this._hpBar   = this.add.rectangle(10, 28, 200, 12, 0x40dc60).setOrigin(0, 0);

        this._statsLabel = this.add.text(220, 8, '', {
            fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
        });

        this._statusLabel = this.add.text(220, 28, '', {
            fontSize: '11px', color: '#40ff40', fontFamily: 'monospace',
        });

        this._floorLabel = this.add.text(VIEW_WIDTH - 10, 8, '', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(1, 0);

        this._goldLabel = this.add.text(VIEW_WIDTH - 10, 28, '', {
            fontSize: '13px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(1, 0);
    }

    _buildCombatPanel() {
        this._combatPanel = this.add.container(10, 60).setVisible(false);

        const bg = this.add.rectangle(0, 0, 360, 80, 0x1a0010, 0.9).setOrigin(0, 0);
        this._combatTitle = this.add.text(8, 6, '', {
            fontSize: '14px', color: hex(COLORS.danger), fontFamily: 'monospace',
        });
        this._combatHpBar = this.add.rectangle(8, 28, 200, 10, 0xdc4040).setOrigin(0, 0);
        this._combatHpBg  = this.add.rectangle(8, 28, 200, 10, 0x202020).setOrigin(0, 0);
        this._combatStats = this.add.text(8, 44, '', {
            fontSize: '12px', color: '#c8a0a0', fontFamily: 'monospace',
        });
        this._combatHint = this.add.text(8, 60, 'Space — Attack', {
            fontSize: '11px', color: '#806060', fontFamily: 'monospace',
        });

        this._combatPanel.add([bg, this._combatHpBg, this._combatHpBar,
                               this._combatTitle, this._combatStats, this._combatHint]);
    }

    _buildLog() {
        const logY = VIEW_HEIGHT - LOG_LINES * 18 - 8;
        this._logBg = this.add.rectangle(0, logY - 4, VIEW_WIDTH, LOG_LINES * 18 + 12, 0x000000, 0.5)
            .setOrigin(0, 0);

        this._logLabels = [];
        for (let i = 0; i < LOG_LINES; i++) {
            this._logLabels.push(this.add.text(8, logY + i * 18, '', {
                fontSize: '12px',
                color: i === 0 ? hex(COLORS.text) : '#606080',
                fontFamily: 'monospace',
            }));
        }
    }

    // -------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------

    _subscribeEvents() {
        this._offs = [
            events.on('playerMoved',    ()        => this._refresh()),
            events.on('floorChanged',   ()        => this._refresh()),
            events.on('combatStart',    ({enemy}) => this._showCombat(enemy)),
            events.on('combatEnd',      ()        => this._hideCombat()),
            events.on('enemyDied',      ()        => this._hideCombat()),
            events.on('playerAttacked', ()        => this._refreshCombat()),
            events.on('enemyAttacked',  ()        => { this._refresh(); if (state.inCombat) this._refreshCombat(); }),
            events.on('logMessage',     ()        => this._updateLog()),
            events.on('gameOver',       ()        => this._showGameOver()),
            events.on('gameWon',        ()        => this._showVictory()),
            events.on('itemPickedUp',   ()        => this._refresh()),
            events.on('toggleInventory',()        => this._toggleInventory()),
            events.on('openShop',       ()        => this._openShop()),
        ];
    }

    // -------------------------------------------------------
    // Refresh helpers
    // -------------------------------------------------------

    _refresh() {
        const hpPct = Math.max(0, state.playerHp / state.playerMaxHp);
        this._hpLabel.setText(`HP  ${state.playerHp} / ${state.playerMaxHp}`);
        this._hpBar.width = Math.floor(200 * hpPct);
        const barColor = hpPct > 0.5 ? 0x40dc60 : hpPct > 0.25 ? 0xdcdc40 : 0xdc4040;
        this._hpBar.setFillStyle(barColor);

        this._statsLabel.setText(
            `LV ${state._playerLevel}  ATK ${state._playerAtk}  DEF ${state._playerDef}  XP ${state._playerXp}/${state._xpToNext}`
        );

        this._floorLabel.setText(`Floor ${state.floor}`);

        const keyStr = state.keys > 0 ? `  Keys:${state.keys}` : '';
        this._goldLabel.setText(`Gold ${state.gold}${keyStr}`);

        const effects = [];
        if (state.poisonTurns > 0) effects.push(`POISON(${state.poisonTurns})`);
        if (state.stunTurns   > 0) effects.push(`STUN(${state.stunTurns})`);
        this._statusLabel.setText(effects.join('  '));

        this._updateLog();
    }

    _updateLog() {
        for (let i = 0; i < LOG_LINES; i++) {
            this._logLabels[i].setText(state.log[i] || '');
        }
    }

    // -------------------------------------------------------
    // Combat panel
    // -------------------------------------------------------

    _showCombat(enemy) {
        this._currentEnemy = enemy;
        this._combatPanel.setVisible(true);
        this._refreshCombat();
    }

    _refreshCombat() {
        const e = this._currentEnemy;
        if (!e) return;
        const bossTag = e.isBoss ? ' [BOSS]' : '';
        this._combatTitle.setText(`Fighting: ${e.type}${bossTag}`);
        const hpPct = Math.max(0, e.hp / e.maxHp);
        this._combatHpBar.width = Math.floor(200 * hpPct);
        this._combatStats.setText(`HP ${e.hp}/${e.maxHp}  ATK ${e.atk}  DEF ${e.def || 0}`);
    }

    _hideCombat() {
        this._combatPanel.setVisible(false);
        this._currentEnemy = null;
    }

    // -------------------------------------------------------
    // Inventory screen
    // -------------------------------------------------------

    _toggleInventory() {
        if (this._shopOpen) return; // can't open inventory while shopping
        if (this._inventoryOpen) {
            this._closeInventory();
        } else {
            this._openInventory();
        }
    }

    _openInventory() {
        this._inventoryOpen = true;
        this._buildInventoryPanel();
    }

    _closeInventory() {
        this._inventoryOpen = false;
        if (this._invContainer) {
            this._invContainer.destroy();
            this._invContainer = null;
        }
    }

    _buildInventoryPanel() {
        if (this._invContainer) this._invContainer.destroy();

        const W = 480, H = 500;
        const X = VIEW_WIDTH / 2 - W / 2;
        const Y = VIEW_HEIGHT / 2 - H / 2;

        const items = state.inventory.filter(it => !it.picked || it.picked);
        const container = this.add.container(X, Y);
        this._invContainer = container;

        const bg = this.add.rectangle(0, 0, W, H, 0x0a0a20, 0.96).setOrigin(0, 0);
        const border = this.add.rectangle(0, 0, W, H, 0x4060a0, 0).setOrigin(0, 0);
        border.setStrokeStyle(2, 0x4060a0, 1);

        const title = this.add.text(W / 2, 16, 'INVENTORY', {
            fontSize: '20px', color: hex(COLORS.accent), fontFamily: 'monospace',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        const hint = this.add.text(W / 2, H - 20, 'Press I to close', {
            fontSize: '12px', color: '#606080', fontFamily: 'monospace',
        }).setOrigin(0.5, 1);

        const statsText = this.add.text(12, 44, [
            `Gold: ${state.gold}   Keys: ${state.keys || 0}`,
            `ATK: ${state._playerAtk}   DEF: ${state._playerDef}   LV: ${state._playerLevel}`,
        ].join('\n'), {
            fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
        });

        const sep = this.add.rectangle(10, 90, W - 20, 1, 0x4060a0, 0.6).setOrigin(0, 0);

        const invTitle = this.add.text(12, 100, 'Items collected:', {
            fontSize: '12px', color: '#8090b0', fontFamily: 'monospace',
        });

        const children = [bg, border, title, hint, statsText, sep, invTitle];

        if (items.length === 0) {
            const empty = this.add.text(W / 2, H / 2, 'No items yet.', {
                fontSize: '14px', color: '#404060', fontFamily: 'monospace',
            }).setOrigin(0.5);
            children.push(empty);
        } else {
            // Group by name and count
            const counts = {};
            for (const it of items) {
                counts[it.name] = (counts[it.name] || 0) + 1;
            }
            let row = 0;
            for (const [name, count] of Object.entries(counts)) {
                const y = 122 + row * 22;
                const label = this.add.text(20, y, `${count}x  ${name}`, {
                    fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
                });
                children.push(label);
                row++;
                if (y > H - 60) break;
            }
        }

        container.add(children);
        container.setDepth(200);
    }

    // -------------------------------------------------------
    // Shop overlay
    // -------------------------------------------------------

    _openShop() {
        if (this._shopOpen) return;
        this._shopOpen      = true;
        this._shopCursor    = 0;
        this._buildShopPanel();
        state.addMessage('You enter the merchant\'s shop. Buy with number keys.');
    }

    _closeShop() {
        this._shopOpen = false;
        if (this._shopContainer) {
            this._shopContainer.destroy();
            this._shopContainer = null;
        }
        if (this._shopKeyCapture) {
            this._shopKeyCapture.forEach(k => k.destroy());
            this._shopKeyCapture = null;
        }
    }

    _buildShopPanel() {
        if (this._shopContainer) this._shopContainer.destroy();

        const W = 500, H = 420;
        const X = VIEW_WIDTH / 2 - W / 2;
        const Y = VIEW_HEIGHT / 2 - H / 2;

        const container = this.add.container(X, Y);
        this._shopContainer = container;

        const bg = this.add.rectangle(0, 0, W, H, 0x0a1a0a, 0.97).setOrigin(0, 0);
        const border = this.add.rectangle(0, 0, W, H, 0x40a060, 0).setOrigin(0, 0);
        border.setStrokeStyle(2, 0x40a060, 1);

        const title = this.add.text(W / 2, 14, 'MERCHANT\'S SHOP', {
            fontSize: '20px', color: hex(COLORS.gold), fontFamily: 'monospace',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        const goldTxt = this.add.text(W / 2, 42, `Your Gold: ${state.gold}`, {
            fontSize: '14px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(0.5, 0);
        this._shopGoldTxt = goldTxt;

        const sep = this.add.rectangle(10, 68, W - 20, 1, 0x40a060, 0.5).setOrigin(0, 0);

        const hint = this.add.text(W / 2, H - 16, 'Press 1-7 to buy  |  Escape to leave', {
            fontSize: '12px', color: '#406040', fontFamily: 'monospace',
        }).setOrigin(0.5, 1);

        const children = [bg, border, title, goldTxt, sep, hint];

        this._shopRowLabels = [];
        for (let i = 0; i < SHOP_ITEMS.length; i++) {
            const item = SHOP_ITEMS[i];
            const y    = 80 + i * 44;
            const canAfford = state.gold >= item.price;
            const col  = canAfford ? hex(COLORS.text) : '#504050';

            const numLabel = this.add.text(14, y, `[${i + 1}]`, {
                fontSize: '14px', color: canAfford ? hex(COLORS.accent) : '#303050',
                fontFamily: 'monospace',
            });

            const nameLabel = this.add.text(54, y, item.name, {
                fontSize: '14px', color: col, fontFamily: 'monospace',
            });

            const effectLabel = this.add.text(54, y + 18, this._shopItemDesc(item), {
                fontSize: '11px', color: '#608060', fontFamily: 'monospace',
            });

            const priceLabel = this.add.text(W - 14, y + 8, `${item.price}g`, {
                fontSize: '14px', color: canAfford ? hex(COLORS.gold) : '#504050',
                fontFamily: 'monospace',
            }).setOrigin(1, 0);

            children.push(numLabel, nameLabel, effectLabel, priceLabel);
            this._shopRowLabels.push({ numLabel, nameLabel, effectLabel, priceLabel, item });
        }

        container.add(children);
        container.setDepth(200);

        // Capture number keys 1-7 and Escape for shop navigation
        this._shopKeyCapture = [];
        for (let i = 1; i <= SHOP_ITEMS.length; i++) {
            const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes['ONE'] + i - 1);
            const idx  = i - 1;
            const cb   = key.on('down', () => this._buyShopItem(idx));
            this._shopKeyCapture.push(key);
        }
        const esc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        esc.on('down', () => this._closeShop());
        this._shopKeyCapture.push(esc);
    }

    _shopItemDesc(item) {
        switch (item.effect) {
            case 'heal':    return `Restores ${item.value} HP`;
            case 'atk':     return `ATK +${item.value}`;
            case 'def':     return `DEF +${item.value}`;
            case 'antidote':return `Cures poison`;
            case 'scroll':  return `Damages all visible enemies for ${item.value}`;
            case 'wand':    return `Shoots enemy ahead for ${item.value} damage`;
            default:        return '';
        }
    }

    _buyShopItem(idx) {
        const item = SHOP_ITEMS[idx];
        if (!item) return;
        if (!state.canAfford(item.price)) {
            state.addMessage(`Not enough gold to buy ${item.name}.`);
            this._refreshShopGold();
            return;
        }
        state.spendGold(item.price);

        // Apply effect immediately (consumables) or add to inventory (permanent gear)
        switch (item.effect) {
            case 'heal':
                state.healPlayer(item.value);
                state.addMessage(`Bought ${item.name}. Healed ${item.value} HP.`);
                break;
            case 'atk':
                state._playerAtk += item.value;
                state.addMessage(`Bought ${item.name}. ATK +${item.value}.`);
                break;
            case 'def':
                state._playerDef += item.value;
                state.addMessage(`Bought ${item.name}. DEF +${item.value}.`);
                break;
            case 'antidote':
                state.poisonTurns = 0;
                state.addMessage(`Bought Antidote. Poison cured!`);
                break;
            case 'scroll':
                state.addMessage(`Bought Fire Scroll. Use it next combat!`);
                state.inventory.push({ ...item, picked: true });
                break;
            case 'wand':
                state.addMessage(`Bought Magic Wand. Use it next combat!`);
                state.inventory.push({ ...item, picked: true });
                break;
        }

        this._refreshShopGold();
        this._rebuildShopRows();
        this._refresh();
        events.emit('itemPickedUp', item);
    }

    _refreshShopGold() {
        if (this._shopGoldTxt) this._shopGoldTxt.setText(`Your Gold: ${state.gold}`);
    }

    _rebuildShopRows() {
        // Rebuild shop to reflect new affordability
        this._buildShopPanel();
    }

    // -------------------------------------------------------
    // Game-over / victory
    // -------------------------------------------------------

    _showGameOver() {
        saveHighScore(state.score);

        const CX = VIEW_WIDTH / 2;
        const CY = VIEW_HEIGHT / 2;

        this.add.rectangle(CX, CY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.75).setOrigin(0.5).setDepth(300);

        this.add.text(CX, CY - 60, 'YOU DIED', {
            fontSize: '64px', color: hex(COLORS.danger),
            fontFamily: 'monospace', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(301);

        this.add.text(CX, CY + 10, `Floor ${state.floor}  |  Score ${state.score}`, {
            fontSize: '22px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(301);

        this.add.text(CX, CY + 60, 'Press R to restart  |  Escape for menu', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(301);
    }

    _showVictory() {
        saveHighScore(state.score);

        const CX = VIEW_WIDTH / 2;
        const CY = VIEW_HEIGHT / 2;

        this.add.rectangle(CX, CY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.75).setOrigin(0.5).setDepth(300);

        this.add.text(CX, CY - 60, 'VICTORY!', {
            fontSize: '64px', color: hex(COLORS.gold),
            fontFamily: 'monospace', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(301);

        this.add.text(CX, CY + 10, `All ${state.floor} floors conquered!  Score ${state.score}`, {
            fontSize: '20px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(301);

        this.add.text(CX, CY + 60, 'Press R to play again  |  Escape for menu', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(301);
    }

    shutdown() {
        if (this._offs) this._offs.forEach(off => off());
        this._closeShop();
        this._closeInventory();
    }
}
