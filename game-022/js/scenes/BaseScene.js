/**
 * BaseScene — sell/upgrade/shop overlay.
 * Launched over GameScene (which is paused).
 * Resumed when player clicks "DEPLOY".
 */
import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { GameState } from '../systems/GameState.js';
import { UPGRADES, CONSUMABLES } from '../data/upgrades.js';
import { playUiClick, playUpgrade } from '../systems/SoundManager.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }
function fmtC(n)  { return n.toLocaleString() + ' cr'; }

const TAB = { SELL: 0, UPGRADES: 1, SHOP: 2 };

export class BaseScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.BASE }); }

    create() {
        this._tab = TAB.SELL;

        // Dim background
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.88)
            .setDepth(0);

        // Header
        this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, 0x111122).setDepth(1);
        this.add.text(12, 22, 'DELVERHAVEN BASE', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0.5).setDepth(2);

        this._creditsLabel = this.add.text(GAME_WIDTH - 12, 22, fmtC(GameState.credits), {
            fontSize: '14px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(1, 0.5).setDepth(2);

        // Tabs
        this._tabBtns = [];
        const tabNames = ['SELL CARGO', 'UPGRADES', 'SHOP'];
        tabNames.forEach((name, i) => {
            const x = 60 + i * 130;
            const btn = this.add.text(x, 58, name, {
                fontSize: '11px', fontFamily: 'monospace', color: '#556677',
            }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => { playUiClick(); this._switchTab(i); });
            this._tabBtns.push(btn);
        });

        // Content container (cleared on tab switch)
        this._contentGroup = [];

        // Deploy button (always visible at bottom)
        const deployBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '[ DEPLOY ]', {
            fontSize: '18px', color: hex(COLORS.success), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
        deployBtn.on('pointerover',  () => deployBtn.setColor('#FFFFFF'));
        deployBtn.on('pointerout',   () => deployBtn.setColor(hex(COLORS.success)));
        deployBtn.on('pointerdown',  () => {
            playUiClick();
            GameState.save();
            this.scene.stop(SCENE.BASE);
            this.scene.resume(SCENE.GAME);
        });

        // Auto-sell cargo on arrival, then show sell tab
        const sold = GameState.sellAllCargo();
        if (sold > 0) {
            this._sellFlash = sold;
        }
        this._switchTab(TAB.SELL);
    }

    _clearContent() {
        for (const obj of this._contentGroup) obj.destroy();
        this._contentGroup = [];
        this._creditsLabel.setText(fmtC(GameState.credits));
    }

    _add(obj) { this._contentGroup.push(obj); return obj; }

    _switchTab(idx) {
        this._tab = idx;
        this._clearContent();
        this._tabBtns.forEach((b, i) => b.setColor(i === idx ? hex(COLORS.accent) : '#556677'));
        if (idx === TAB.SELL)     this._buildSellTab();
        if (idx === TAB.UPGRADES) this._buildUpgradesTab();
        if (idx === TAB.SHOP)     this._buildShopTab();
    }

    _buildSellTab() {
        const TOP = 80, CX = GAME_WIDTH / 2;
        this._add(this.add.text(CX, TOP, 'CARGO HOLD', {
            fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2));

        if (this._sellFlash) {
            this._add(this.add.text(CX, TOP + 22, `Sold for +${this._sellFlash} credits!`, {
                fontSize: '12px', color: hex(COLORS.success), fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(2));
        } else {
            this._add(this.add.text(CX, TOP + 22, 'Cargo auto-sold on arrival.', {
                fontSize: '11px', color: '#556677', fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(2));
        }

        // Stats
        const s = GameState.stats;
        const lines = [
            `Deepest reached:   ${s.maxDepth}m`,
            `Total runs:        ${s.totalRuns}`,
            `Total earned:      ${fmtC(s.totalCreditsEarned)}`,
            `Ores sold:         ${s.totalOresSold}`,
            `Deaths:            ${s.totalDeaths}`,
        ];
        lines.forEach((line, i) => {
            this._add(this.add.text(CX, TOP + 60 + i * 22, line, {
                fontSize: '12px', color: hex(COLORS.text), fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(2));
        });

        // Fuel & hull status
        const d = GameState.derived;
        this._add(this.add.text(CX, TOP + 185, `Hull: ${GameState.hull.current}/${d.hullMax} HP`, {
            fontSize: '12px', color: GameState.hull.current < d.hullMax * 0.4 ? hex(COLORS.danger) : hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(2));

        this._add(this.add.text(CX, TOP + 205, `Fuel: ${Math.round(GameState.fuel.current)}/${d.fuelMax}`, {
            fontSize: '12px', color: GameState.fuel.current < d.fuelMax * 0.2 ? hex(COLORS.danger) : hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(2));
    }

    _buildUpgradesTab() {
        const TOP = 78, LEFT = 10;
        const cats = ['hull', 'drill', 'tank', 'engine', 'cargo', 'lights'];
        const catLabels = ['HULL', 'DRILL', 'TANK', 'ENGINE', 'CARGO', 'LIGHTS'];
        const maxDepth = GameState.stats.maxDepth;
        let y = TOP;

        cats.forEach((cat, ci) => {
            this._add(this.add.text(LEFT, y, catLabels[ci], {
                fontSize: '10px', color: hex(COLORS.accent), fontFamily: 'monospace', fontStyle: 'bold',
            }).setDepth(2));
            y += 14;

            const currentLevel = GameState.upgrades[cat];
            const upgrades = UPGRADES[cat];

            upgrades.forEach((upg) => {
                const owned   = currentLevel >= upg.level;
                const nextUp  = currentLevel === upg.level - 1;
                const locked  = maxDepth < upg.unlockDepth;
                const canBuy  = nextUp && !locked && GameState.credits >= upg.cost;

                let color = owned ? '#334455' : (locked ? '#332233' : (canBuy ? hex(COLORS.success) : '#554433'));
                const label = owned ? `[✓] ${upg.name}` : (locked ? `[🔒 ${upg.unlockDepth}m] ${upg.name}` : `${upg.name}`);

                const row = this._add(this.add.text(LEFT, y, label, {
                    fontSize: '10px', color, fontFamily: 'monospace',
                }).setDepth(2));

                const costTxt = this._add(this.add.text(GAME_WIDTH - LEFT, y, owned ? 'owned' : fmtC(upg.cost), {
                    fontSize: '10px', color: owned ? '#334455' : (canBuy ? hex(COLORS.gold) : '#553322'),
                    fontFamily: 'monospace',
                }).setOrigin(1, 0).setDepth(2));

                if (canBuy) {
                    row.setInteractive({ useHandCursor: true });
                    row.on('pointerover',  () => row.setColor('#FFFFFF'));
                    row.on('pointerout',   () => row.setColor(color));
                    row.on('pointerdown',  () => {
                        if (GameState.spendCredits(upg.cost)) {
                            playUpgrade();
                            GameState.applyUpgrade(cat, upg.level);
                            GameState.save();
                            this._switchTab(TAB.UPGRADES);
                        }
                    });
                }
                y += 14;
            });
            y += 4;
        });

        // Specials header
        if (y < GAME_HEIGHT - 80) {
            this._add(this.add.text(LEFT, y, 'SPECIAL', {
                fontSize: '10px', color: '#CC88FF', fontFamily: 'monospace', fontStyle: 'bold',
            }).setDepth(2));
            y += 14;

            const owned = GameState.upgrades.special;
            UPGRADES.special.forEach((upg) => {
                const isOwned = owned.includes(upg.id);
                const locked  = maxDepth < upg.unlockDepth;
                const canBuy  = !isOwned && !locked && GameState.credits >= upg.cost;
                const color   = isOwned ? '#334455' : (locked ? '#332233' : (canBuy ? hex(COLORS.success) : '#554433'));
                const label   = isOwned ? `[✓] ${upg.name}` : (locked ? `[🔒${upg.unlockDepth}m] ${upg.name}` : upg.name);

                const row = this._add(this.add.text(LEFT, y, label, {
                    fontSize: '10px', color, fontFamily: 'monospace',
                }).setDepth(2));
                this._add(this.add.text(GAME_WIDTH - LEFT, y, isOwned ? 'owned' : fmtC(upg.cost), {
                    fontSize: '10px', color: isOwned ? '#334455' : (canBuy ? hex(COLORS.gold) : '#553322'),
                    fontFamily: 'monospace',
                }).setOrigin(1, 0).setDepth(2));

                if (canBuy) {
                    row.setInteractive({ useHandCursor: true });
                    row.on('pointerover', () => row.setColor('#FFFFFF'));
                    row.on('pointerout',  () => row.setColor(color));
                    row.on('pointerdown', () => {
                        if (GameState.spendCredits(upg.cost)) {
                            playUpgrade();
                            GameState.applyUpgrade('special', upg.id);
                            GameState.save();
                            this._switchTab(TAB.UPGRADES);
                        }
                    });
                }
                y += 14;
                if (y > GAME_HEIGHT - 90) return; // stop if out of space
            });
        }
    }

    _buildShopTab() {
        const TOP = 80, CX = GAME_WIDTH / 2;
        this._add(this.add.text(CX, TOP, 'SUPPLY SHOP', {
            fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2));

        let y = TOP + 24;
        CONSUMABLES.forEach((item) => {
            const canBuy = GameState.credits >= item.cost;

            const row = this._add(this.add.text(16, y, `${item.icon} ${item.name}`, {
                fontSize: '11px', color: canBuy ? hex(COLORS.text) : '#445544', fontFamily: 'monospace',
            }).setDepth(2));

            this._add(this.add.text(16, y + 13, `  ${item.desc}`, {
                fontSize: '9px', color: '#556677', fontFamily: 'monospace',
            }).setDepth(2));

            const costBtn = this._add(this.add.text(GAME_WIDTH - 12, y + 6, fmtC(item.cost), {
                fontSize: '11px', color: canBuy ? hex(COLORS.gold) : '#553322', fontFamily: 'monospace',
            }).setOrigin(1, 0.5).setDepth(2));

            if (canBuy) {
                const hitArea = this._add(this.add.rectangle(GAME_WIDTH - 70, y + 6, 100, 24, 0x000000, 0)
                    .setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true }));
                hitArea.on('pointerdown', () => {
                    playUiClick();
                    this._buyConsumable(item);
                    this._switchTab(TAB.SHOP);
                });
            }
            y += 34;
        });
    }

    _buyConsumable(item) {
        if (!GameState.spendCredits(item.cost)) return;
        const fuel = GameState.fuel, hull = GameState.hull, d = GameState.derived;
        const c    = GameState.consumables;

        switch (item.id) {
            case 'fuel_full': GameState.refuel(d.fuelMax); break;
            case 'fuel_half': GameState.refuel(d.fuelMax * 0.5); break;
            case 'repair_full': GameState.repairHull(d.hullMax); break;
            case 'repair_kit': c.repair_kit++; break;
            case 'cargo_temp': GameState.cargo.maxSlots = Math.min(d.cargoSlots + 5, 999); break;
            case 'tnt':        c.tnt++; break;
            case 'recall_flare': c.recall_flare++; break;
            case 'lucky_charm':
                c.lucky_charm++;
                d.luckyCharmActive = true;
                break;
            case 'void_map':
                GameState.stats.voidMapFragments = (GameState.stats.voidMapFragments || 0) + 1;
                break;
            case 'seismic':
                // Reveal next 20 rows — handled in GameScene
                this.registry.set('seismicReveal', true);
                break;
        }
        GameState.save();
    }
}
