/**
 * SplashScene — apothecary title screen (game-plan §Other screens, Phase 4).
 *
 * Save/load affordances:
 *   - If a save exists: shows a CONTINUE button (with level name, currency, XP
 *     from the save) and a separate NEW RUN button that requires an explicit click
 *     to prevent accidental overwrite.
 *   - Any key only triggers CONTINUE when a save exists; clicking outside the
 *     buttons does nothing when there's a save (forces deliberate choice).
 *   - No save: any key or click starts a new run immediately.
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';
import { state } from './state.js';
import { getLevelDef } from './level.js';

function hex(arr)      { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

// Draw a button with a label; returns the hit-rect.
function makeButton(scene, cx, y, w, h, label, labelColor, borderColor, alpha = 0.9) {
    const bg = scene.add.graphics();
    bg.fillStyle(toHexInt(COLORS.panel), alpha);
    bg.fillRoundedRect(cx - w / 2, y, w, h, 6);
    bg.lineStyle(2, toHexInt(borderColor), 0.9);
    bg.strokeRoundedRect(cx - w / 2, y, w, h, 6);
    scene.add.text(cx, y + h / 2, label, {
        fontSize: '15px', fontFamily: 'monospace', color: hex(labelColor),
    }).setOrigin(0.5);
    return { x: cx - w / 2, y, w, h };
}

function hits(rect, px, py) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

export class SplashScene extends Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH / 2;
        const CY = GAME_HEIGHT / 2;

        this._drawLatticeMotif();

        // Glow behind title
        const glow = this.add.graphics();
        glow.fillStyle(toHexInt(COLORS.gold), 0.07);
        glow.fillEllipse(CX, CY - 70, 760, 200);

        // Title
        this.add.text(CX + 3, CY - 96, "ALCHEMIST'S", {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a120a',
        }).setOrigin(0.5);
        this.add.text(CX, CY - 100, "ALCHEMIST'S", {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.gold), stroke: hex(COLORS.brass), strokeThickness: 2,
        }).setOrigin(0.5);
        this.add.text(CX + 3, CY - 28, 'LATTICE', {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold', color: '#0a1410',
        }).setOrigin(0.5);
        this.add.text(CX, CY - 32, 'LATTICE', {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.parchment), stroke: hex(COLORS.brass), strokeThickness: 2,
        }).setOrigin(0.5);
        this.add.text(CX, CY + 28, 'PLACE  •  CLEAR  •  TRANSMUTE', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.brass), letterSpacing: 4,
        }).setOrigin(0.5);

        this._started  = false;
        this._contHit  = null;
        this._newHit   = null;
        this._prompt   = null;

        const hasSave = state.hasSave();

        if (hasSave) {
            // Load save just to read its metadata for the button label.
            state.load();
            const lvl = getLevelDef(state.runLevelIndex);

            // Save info strip
            this.add.text(CX, CY + 54,
                `Saved run:  ${lvl.name}  ·  ${state.currency} grams  ·  ${state.xp} XP`, {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setOrigin(0.5);

            // CONTINUE button — prominent, gold border
            this._contHit = makeButton(this, CX, CY + 72, 340, 46,
                `▶  CONTINUE RUN`, COLORS.gold, COLORS.gold);

            // NEW RUN button — subdued, with a warning note
            this._newHit = makeButton(this, CX, CY + 130, 280, 38,
                'NEW RUN  (erases save)', COLORS.textDim, COLORS.panelEdge, 0.7);

            // Any key = continue (safe default); click discriminates between buttons.
            this.input.keyboard.on('keydown', (e) => {
                if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
                this._continue();
            });
            this.input.on('pointerdown', (p) => {
                if (hits(this._newHit, p.x, p.y))       this._newRun();
                else if (hits(this._contHit, p.x, p.y)) this._continue();
                // Clicks outside buttons do nothing — deliberate choice required.
            });

            this._prompt = this.add.text(CX, CY + 186, 'press any key to continue', {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setOrigin(0.5);

        } else {
            // No save — any interaction starts a fresh run.
            this.input.keyboard.on('keydown', (e) => {
                if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
                this._newRun();
            });
            this.input.on('pointerdown', () => this._newRun());

            this._prompt = this.add.text(CX, CY + 82, 'PRESS ANY KEY OR CLICK TO BEGIN', {
                fontSize: '16px', fontFamily: 'monospace', color: hex(COLORS.text),
            }).setOrigin(0.5);
        }

        // Controls footer
        this.add.text(CX, GAME_HEIGHT - 52,
            'DRAG a shape from the tray onto the lattice  •  fill a row or column to clear it', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5);
        this.add.text(CX, GAME_HEIGHT - 32,
            'C — cauldron   •   R — restart level   •   Esc — save & return to title', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 4', {
            fontSize: '10px', fontFamily: 'monospace', color: '#3a2e20',
        }).setOrigin(1, 1);

        this._t = 0;
    }

    update(time, delta) {
        this._t += delta / 1000;
        if (this._prompt) {
            const a = (Math.sin(this._t * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
            this._prompt.setAlpha(a);
        }
    }

    _drawLatticeMotif() {
        const g = this.add.graphics();
        const size = 56;
        const cols = Math.ceil(GAME_WIDTH / size);
        const rows = Math.ceil(GAME_HEIGHT / size);
        g.lineStyle(1, toHexInt(COLORS.panelEdge), 0.06);
        for (let i = 0; i <= cols; i++) {
            g.beginPath(); g.moveTo(i * size, 0); g.lineTo(i * size, GAME_HEIGHT); g.strokePath();
        }
        for (let j = 0; j <= rows; j++) {
            g.beginPath(); g.moveTo(0, j * size); g.lineTo(GAME_WIDTH, j * size); g.strokePath();
        }
    }

    _continue() {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        // Save was already loaded in create(); just launch.
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
        this.scene.stop('SplashScene');
    }

    _newRun() {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        state.clearSave();
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
        this.scene.stop('SplashScene');
    }
}
