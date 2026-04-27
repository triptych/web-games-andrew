/**
 * UIScene — HUD overlay running in parallel with GameScene.
 * Renders: depth, fuel bar, hull bar, cargo bar, alerts, d-pad (mobile).
 */
import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, COLORS, WORLD_COLS, WORLD_ROWS, TILE_SIZE } from '../config.js';
import { GameState } from '../systems/GameState.js';
import { setDPad, isMobileDevice } from '../systems/InputManager.js';
import { playUiClick, tickAlarms } from '../systems/SoundManager.js';
import { DEPTH_TIERS } from '../config.js';
import { ORE_DEFS, BLOCK } from '../data/ores.js';
import { getBlock } from '../systems/WorldGen.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const HUD_H = 110;  // bottom HUD height
const HUD_Y = GAME_HEIGHT - HUD_H;

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.UI }); }

    create() {
        this._alerts = [];
        this._alertTimer = 0;
        this._prevTier = -1;
        this._tierLabel = null;
        this._tierLabelTimer = 0;

        this._buildHUD();
        if (isMobileDevice()) this._buildDPad();

        // Minimap — only rendered when Depth Radar upgrade is active
        this._minimapGfx = this.add.graphics().setDepth(55);
        this._minimapTimer = 0;
        this._world = null; // lazily fetched from registry
    }

    _buildHUD() {
        // Bottom panel background
        this._hudBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_H / 2, GAME_WIDTH, HUD_H, COLORS.uiBg)
            .setDepth(50);
        this.add.rectangle(GAME_WIDTH / 2, HUD_Y - 1, GAME_WIDTH, 2, COLORS.uiBorder).setDepth(51);

        // Top bar
        this.add.rectangle(GAME_WIDTH / 2, 14, GAME_WIDTH, 28, 0x0A0A18).setDepth(50);
        this.add.rectangle(GAME_WIDTH / 2, 28, GAME_WIDTH, 2, COLORS.uiBorder).setDepth(51);

        this._depthLabel = this.add.text(10, 14, 'DEPTH: 0m', {
            fontSize: '12px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setDepth(52);

        this._creditsLabel = this.add.text(GAME_WIDTH - 10, 14, '500 cr', {
            fontSize: '12px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(1, 0.5).setDepth(52);

        this._tierLabel = this.add.text(GAME_WIDTH / 2, 14, '', {
            fontSize: '10px', color: '#9966CC', fontFamily: 'monospace',
        }).setOrigin(0.5, 0.5).setDepth(52).setAlpha(0);

        // Hull bar
        const barX = 10, barW = GAME_WIDTH - 20, barH = 12;
        const row1 = HUD_Y + 8;
        this.add.text(barX, row1, 'HULL', { fontSize: '9px', color: '#886655', fontFamily: 'monospace' }).setDepth(52);
        this._hullBg   = this.add.rectangle(barX + 28, row1 + 5, barW - 28, barH, 0x221111).setOrigin(0, 0.5).setDepth(52);
        this._hullFill = this.add.rectangle(barX + 28, row1 + 5, barW - 28, barH, COLORS.hullBar).setOrigin(0, 0.5).setDepth(53);
        this._hullText = this.add.text(GAME_WIDTH - barX, row1, '', { fontSize: '9px', color: '#CCAAAA', fontFamily: 'monospace' }).setOrigin(1, 0).setDepth(54);

        // Fuel bar
        const row2 = row1 + 20;
        this.add.text(barX, row2, 'FUEL', { fontSize: '9px', color: '#886644', fontFamily: 'monospace' }).setDepth(52);
        this._fuelBg   = this.add.rectangle(barX + 28, row2 + 5, barW - 28, barH, 0x221100).setOrigin(0, 0.5).setDepth(52);
        this._fuelFill = this.add.rectangle(barX + 28, row2 + 5, barW - 28, barH, COLORS.fuelBar).setOrigin(0, 0.5).setDepth(53);
        this._fuelText = this.add.text(GAME_WIDTH - barX, row2, '', { fontSize: '9px', color: '#CCBB99', fontFamily: 'monospace' }).setOrigin(1, 0).setDepth(54);

        // Cargo bar
        const row3 = row2 + 20;
        this.add.text(barX, row3, 'HOLD', { fontSize: '9px', color: '#668866', fontFamily: 'monospace' }).setDepth(52);
        this._cargoBg   = this.add.rectangle(barX + 28, row3 + 5, barW - 28, barH, 0x111811).setOrigin(0, 0.5).setDepth(52);
        this._cargoFill = this.add.rectangle(barX + 28, row3 + 5, barW - 28, barH, COLORS.cargoBar).setOrigin(0, 0.5).setDepth(53);
        this._cargoText = this.add.text(GAME_WIDTH - barX, row3, '', { fontSize: '9px', color: '#99BB99', fontFamily: 'monospace' }).setOrigin(1, 0).setDepth(54);

        // Upgrade indicators (small icons row)
        this._upgradeRow = this.add.text(barX, row3 + 20, '', {
            fontSize: '9px', color: '#446688', fontFamily: 'monospace',
        }).setDepth(52);

        // Alert text (center)
        this._alertText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', {
            fontSize: '20px', fontFamily: 'monospace', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(60).setAlpha(0);

        // Lore text (top, fades in/out)
        this._loreText = this.add.text(GAME_WIDTH / 2, 48, '', {
            fontSize: '10px', color: '#8877AA', fontFamily: 'monospace',
            wordWrap: { width: GAME_WIDTH - 20 },
        }).setOrigin(0.5, 0).setDepth(60).setAlpha(0);
        this._loreTimer = 0;

        // Pause overlay
        this._pauseOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
            .setDepth(70).setVisible(false);
        this._pauseText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'PAUSED\n\nP / Esc to resume', {
            fontSize: '24px', color: hex(COLORS.text), fontFamily: 'monospace', align: 'center',
        }).setOrigin(0.5).setDepth(71).setVisible(false);
    }

    _buildDPad() {
        const PAD_X = 70, PAD_Y = GAME_HEIGHT - 48, BTN = 36;
        const dirs = [
            { dir: 'left',  x: PAD_X - BTN, y: PAD_Y, label: '◄' },
            { dir: 'right', x: PAD_X + BTN, y: PAD_Y, label: '►' },
            { dir: 'up',    x: PAD_X,        y: PAD_Y - BTN, label: '▲' },
            { dir: 'down',  x: PAD_X,        y: PAD_Y + BTN * 0.6, label: '▼' },
        ];
        dirs.forEach(({ dir, x, y, label }) => {
            const btn = this.add.rectangle(x, y, BTN - 2, BTN - 2, 0x223344, 0.85)
                .setInteractive().setDepth(55);
            this.add.text(x, y, label, { fontSize: '16px', color: '#AACCEE', fontFamily: 'monospace' })
                .setOrigin(0.5).setDepth(56);
            btn.on('pointerdown',   () => { setDPad(dir, true);  btn.setFillStyle(0x4488AA, 0.9); });
            btn.on('pointerup',     () => { setDPad(dir, false); btn.setFillStyle(0x223344, 0.85); });
            btn.on('pointerout',    () => { setDPad(dir, false); btn.setFillStyle(0x223344, 0.85); });
        });

        // USE button
        const useBtn = this.add.rectangle(GAME_WIDTH - 55, GAME_HEIGHT - 48, BTN * 1.2, BTN - 2, 0x334422, 0.85)
            .setInteractive().setDepth(55);
        this.add.text(GAME_WIDTH - 55, GAME_HEIGHT - 48, 'USE', { fontSize: '11px', color: '#AABB88', fontFamily: 'monospace' })
            .setOrigin(0.5).setDepth(56);
        useBtn.on('pointerdown', () => { setDPad('use', true);  useBtn.setFillStyle(0x668833, 0.9); });
        useBtn.on('pointerup',   () => { setDPad('use', false); useBtn.setFillStyle(0x334422, 0.85); });
        useBtn.on('pointerout',  () => { setDPad('use', false); useBtn.setFillStyle(0x334422, 0.85); });
    }

    showAlert(msg, color = '#FF4444') {
        this._alertText.setText(msg).setColor(color).setAlpha(1);
        this._alertTimer = 2.0;
    }

    showLore(text) {
        this._loreText.setText(text).setAlpha(1);
        this._loreTimer = 4.0;
    }

    setPaused(v) {
        this._pauseOverlay.setVisible(v).setAlpha(v ? 0.5 : 0);
        this._pauseText.setVisible(v);
    }

    update(_, delta) {
        const dt = delta / 1000;
        const h = GameState.hull, f = GameState.fuel, d = GameState.derived;

        // Hull bar
        const hullPct = Math.max(0, h.current / d.hullMax);
        const barW = GAME_WIDTH - 38;
        this._hullFill.width = barW * hullPct;
        this._hullFill.setFillStyle(hullPct < 0.25 ? 0xFF2222 : COLORS.hullBar);
        this._hullText.setText(`${Math.ceil(h.current)}/${d.hullMax}`);

        // Fuel bar
        const fuelPct = Math.max(0, f.current / d.fuelMax);
        this._fuelFill.width = barW * fuelPct;
        this._fuelFill.setFillStyle(fuelPct < 0.2 ? 0xFF4400 : COLORS.fuelBar);
        this._fuelText.setText(`${Math.round(f.current)}/${d.fuelMax}`);

        // Cargo bar
        const cargoUsed = GameState.getCargoUsed();
        const cargoMax  = GameState.getCargoMax();
        const cargoPct  = cargoMax > 0 ? cargoUsed / cargoMax : 0;
        this._cargoFill.width = barW * cargoPct;
        this._cargoFill.setFillStyle(cargoPct >= 1 ? 0xFF8800 : COLORS.cargoBar);
        this._cargoText.setText(`${cargoUsed}/${cargoMax}`);

        // Depth & credits
        const depthM = GameState.playerRow * 16;
        this._depthLabel.setText(`DEPTH: ${depthM}m`);
        this._creditsLabel.setText(`${GameState.credits} cr`);

        // Upgrade indicator row
        const sp = GameState.upgrades.special;
        const indicators = [];
        if (sp.includes('teleport') && d.teleporterCharged) indicators.push('BEAM');
        if (sp.includes('shield'))   indicators.push('SHD');
        if (sp.includes('nanites'))  indicators.push('NAN');
        if (GameState.consumables.recall_flare > 0) indicators.push(`FLARE x${GameState.consumables.recall_flare}`);
        if (GameState.consumables.tnt > 0)          indicators.push(`TNT x${GameState.consumables.tnt}`);
        if (GameState.consumables.seismic > 0)      indicators.push(`SEISMIC x${GameState.consumables.seismic}`);
        this._upgradeRow.setText(indicators.join('  '));

        // Tier label
        const tierIdx = Math.min(DEPTH_TIERS.length - 1,
            DEPTH_TIERS.findIndex(t => depthM <= t.rowEnd * 16));
        if (tierIdx !== this._prevTier && tierIdx >= 0) {
            this._prevTier = tierIdx;
            this._tierLabel.setText(DEPTH_TIERS[tierIdx].name).setAlpha(1);
            this._tierLabelTimer = 3.0;
        }
        if (this._tierLabelTimer > 0) {
            this._tierLabelTimer -= dt;
            this._tierLabel.setAlpha(Math.min(1, this._tierLabelTimer));
        }

        // Alert fade
        if (this._alertTimer > 0) {
            this._alertTimer -= dt;
            this._alertText.setAlpha(Math.min(1, this._alertTimer));
            // Flash for critical warnings
            if (this._alertText.text === 'LOW FUEL' || this._alertText.text === 'HULL CRITICAL') {
                this._alertText.setAlpha(Math.round(this._alertTimer * 4) % 2 === 0 ? 1 : 0.3);
            }
        }

        // Lore fade
        if (this._loreTimer > 0) {
            this._loreTimer -= dt;
            if (this._loreTimer < 1) this._loreText.setAlpha(this._loreTimer);
        }

        // Persistent alerts
        if (fuelPct < 0.2) {
            if (this._alertTimer <= 0) this.showAlert('LOW FUEL', '#FF4400');
        }
        if (hullPct < 0.25) {
            if (this._alertTimer <= 0) this.showAlert('HULL CRITICAL', '#FF2222');
        }

        tickAlarms(delta, fuelPct < 0.2, hullPct < 0.25);

        // Minimap (Depth Radar upgrade)
        this._minimapTimer += dt;
        if (this._minimapTimer >= 0.25) {
            this._minimapTimer = 0;
            if (GameState.derived.depthRadar) {
                this._drawMinimap();
            } else {
                this._minimapGfx.clear();
                if (this._minimapLabel) this._minimapLabel.setVisible(false);
            }
        }
    }

    // Mini radar: 60×80px panel, right side of screen above HUD
    _drawMinimap() {
        if (!this._world) {
            this._world = this.scene.get(SCENE.GAME)
                ? this.scene.get(SCENE.GAME).registry.get('world')
                : null;
            if (!this._world) return;
        }

        const MAP_W = 60, MAP_H = 80;
        const MAP_X = GAME_WIDTH - MAP_W - 4;
        const MAP_Y = HUD_Y - MAP_H - 4;

        // How many world rows/cols to show
        const VIEW_ROWS = 50;  // rows visible in minimap height
        const VIEW_COLS = 30;  // cols visible in minimap width
        const playerCol = GameState.playerCol;
        const playerRow = GameState.playerRow;

        const startRow = Math.max(0, playerRow - Math.floor(VIEW_ROWS * 0.3));
        const startCol = Math.max(0, Math.min(WORLD_COLS - VIEW_COLS, playerCol - Math.floor(VIEW_COLS / 2)));

        const cellW = MAP_W / VIEW_COLS;
        const cellH = MAP_H / VIEW_ROWS;

        const g = this._minimapGfx;
        g.clear();

        // Background
        g.fillStyle(0x050510, 0.85);
        g.fillRect(MAP_X - 1, MAP_Y - 1, MAP_W + 2, MAP_H + 2);
        g.lineStyle(1, 0x334466, 1);
        g.strokeRect(MAP_X - 1, MAP_Y - 1, MAP_W + 2, MAP_H + 2);

        // Tiles
        for (let dr = 0; dr < VIEW_ROWS; dr++) {
            const r = startRow + dr;
            if (r >= WORLD_ROWS) break;
            for (let dc = 0; dc < VIEW_COLS; dc++) {
                const c = startCol + dc;
                if (c >= WORLD_COLS) break;

                const blockId = getBlock(this._world, r, c);
                if (blockId === BLOCK.AIR) continue;

                const def = ORE_DEFS[blockId];
                if (!def) continue;

                const px = MAP_X + dc * cellW;
                const py = MAP_Y + dr * cellH;

                // Show ore tiles bright; fill tiles dim
                if (!def.isFill && blockId !== BLOCK.BEDROCK) {
                    g.fillStyle(def.color, 1);
                    g.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH));
                } else if (blockId === BLOCK.BEDROCK) {
                    g.fillStyle(0x333333, 0.8);
                    g.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH));
                } else {
                    // dim fill block
                    g.fillStyle(def.color, 0.25);
                    g.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH));
                }
            }
        }

        // Player dot
        const relCol = playerCol - startCol;
        const relRow = playerRow - startRow;
        if (relCol >= 0 && relCol < VIEW_COLS && relRow >= 0 && relRow < VIEW_ROWS) {
            const px = MAP_X + relCol * cellW;
            const py = MAP_Y + relRow * cellH;
            g.fillStyle(0xFFFFFF, 1);
            g.fillRect(px - 1, py - 1, Math.ceil(cellW) + 2, Math.ceil(cellH) + 2);
            g.fillStyle(0x00CCFF, 1);
            g.fillRect(px, py, Math.ceil(cellW), Math.ceil(cellH));
        }

        // Label
        if (!this._minimapLabel) {
            this._minimapLabel = this.add.text(MAP_X, MAP_Y - 12, 'RADAR', {
                fontSize: '8px', color: '#446688', fontFamily: 'monospace',
            }).setDepth(56);
        }
        this._minimapLabel.setVisible(true);
    }
}
