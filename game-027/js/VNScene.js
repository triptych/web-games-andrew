/**
 * VNScene — Visual-Novel overlay scene (game-plan §Phase 6).
 *
 * Launched in parallel over any other scene:
 *   this.scene.launch('VNScene', { scriptId, onComplete });
 *
 * Responsibilities:
 *   - Slide-in panel from the bottom edge (200ms ease-out), slide out on end
 *   - Dim backdrop over the parent scene
 *   - Procedural character portraits (canvas silhouettes, ~120×180 logical px)
 *   - Name plate + typewriter text box
 *   - Choice buttons (up to 3 options, mouse + keyboard)
 *   - Skip button (skips entire remaining script)
 *   - Portrait cross-fade on state swap
 *   - Pauses the parent scene(s); resumes + calls onComplete on dialog end
 *
 * The scene itself is self-contained: it talks to DialogRunner and emits the
 * same events that dialog.js defines (dialogLineShown, dialogEnded, etc.).
 */

import { Scene }  from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, REDUCED_MOTION } from './config.js';
import { DialogRunner, CHARACTERS }        from './dialog.js';
import { playDialogAdvance, playDialogOpen, playDialogClose, playChoiceHover } from './sounds.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PANEL_H   = 220;          // panel height in pixels
const PANEL_Y   = GAME_HEIGHT - PANEL_H;   // resting Y position (slid in)
const PORTRAIT_W  = 160;
const PORTRAIT_H  = 200;
const TEXT_X      = PORTRAIT_W + 24;
const TEXT_W      = GAME_WIDTH - TEXT_X - 24;
const NAMEPLATE_Y = 14;
const TEXT_Y      = 42;
const TEXT_ROWS_H = PANEL_H - TEXT_Y - 52;  // usable text area height
const ADVANCE_HINT_Y = PANEL_H - 26;
const TYPE_SPEED  = 28;         // chars/second

function hex(arr) { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }
function lerpColor(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

// ---------------------------------------------------------------------------
// Procedural portrait renderer
// ---------------------------------------------------------------------------

/**
 * Draws a character portrait onto a Phaser Graphics object.
 * Each character has a distinct silhouette shape + palette.
 * @param {Phaser.GameObjects.Graphics} g
 * @param {object} charDef
 * @param {string} portraitState
 */
function drawPortrait(g, charDef, portraitState) {
    g.clear();
    const p = charDef.palette;

    switch (charDef.id) {

        case 'player': {
            // Hooded apprentice with worn apron
            const hood = p.robe;
            const skin = p.skin;
            const trim = p.trim;
            // Body / robe
            g.fillStyle(toHexInt(hood), 1);
            g.fillRoundedRect(28, 90, 104, 110, 8);
            // Apron
            g.fillStyle(toHexInt(trim), 0.7);
            g.fillRect(46, 110, 68, 76);
            // Neck
            g.fillStyle(toHexInt(skin), 1);
            g.fillRect(62, 68, 36, 28);
            // Head
            g.fillStyle(toHexInt(skin), 1);
            g.fillEllipse(80, 60, 56, 60);
            // Hood
            g.fillStyle(toHexInt(hood), 0.9);
            g.fillTriangle(44, 56, 116, 56, 80, 14);
            g.fillEllipse(80, 56, 58, 36);
            // Expression varies by state
            const eyeY = 56;
            if (portraitState === 'alarmed') {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(68, eyeY, 4);
                g.fillCircle(92, eyeY, 4);
            } else if (portraitState === 'pleased' || portraitState === 'determined') {
                g.fillStyle(0x1a120a, 1);
                g.fillRect(64, eyeY - 1, 6, 3);
                g.fillRect(88, eyeY - 1, 6, 3);
            } else {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(68, eyeY, 3);
                g.fillCircle(92, eyeY, 3);
            }
            break;
        }

        case 'guildmaster': {
            // Stern elder, brass monocle, dark robe
            const skin = p.skin;
            const robe = p.robe;
            const trim = p.trim;
            const mono = p.mono;
            // Robe body
            g.fillStyle(toHexInt(robe), 1);
            g.fillRoundedRect(22, 88, 116, 112, 6);
            // Collar/trim
            g.lineStyle(3, toHexInt(trim), 1);
            g.strokeRoundedRect(22, 88, 116, 112, 6);
            // Neck + head
            g.fillStyle(toHexInt(skin), 1);
            g.fillRect(64, 66, 32, 28);
            g.fillEllipse(80, 56, 54, 58);
            // Hair (grey-white bun)
            g.fillStyle(0xd0c8b8, 1);
            g.fillEllipse(80, 28, 52, 32);
            g.fillRect(54, 28, 52, 24);
            // Eyes
            const eyeY = 52;
            if (portraitState === 'pleased') {
                g.fillStyle(0x1a120a, 1);
                g.fillRect(63, eyeY, 8, 3);
                g.fillRect(84, eyeY, 8, 3);
            } else if (portraitState === 'alarmed') {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(68, eyeY, 4.5);
                g.fillCircle(89, eyeY, 4.5);
            } else {
                // stern / neutral — half-lidded
                g.fillStyle(0x1a120a, 1);
                g.fillRect(62, eyeY - 1, 10, 5);
                g.fillRect(83, eyeY - 1, 10, 5);
                g.fillStyle(0x1a120a, 0.6);
                g.fillRect(62, eyeY - 4, 10, 3);
                g.fillRect(83, eyeY - 4, 10, 3);
            }
            // Monocle (right eye)
            g.lineStyle(2, toHexInt(mono), 1);
            g.strokeCircle(89, eyeY, 9);
            g.lineStyle(1, toHexInt(mono), 0.7);
            g.lineBetween(98, eyeY + 6, 106, 76);
            break;
        }

        case 'rival': {
            // Flashy coat, smirking, stylish
            const skin = p.skin;
            const robe = p.robe;
            const trim = p.trim;
            // Coat
            g.fillStyle(toHexInt(robe), 1);
            g.fillRoundedRect(20, 86, 120, 114, 6);
            // Lapels
            g.fillStyle(toHexInt(trim), 0.8);
            g.fillTriangle(80, 88, 46, 88, 58, 130);
            g.fillTriangle(80, 88, 114, 88, 102, 130);
            // Neck + head
            g.fillStyle(toHexInt(skin), 1);
            g.fillRect(64, 64, 32, 28);
            g.fillEllipse(80, 54, 52, 56);
            // Hair (dark, swept)
            g.fillStyle(0x2a1e10, 1);
            g.fillEllipse(80, 28, 54, 32);
            g.fillRect(54, 20, 52, 22);
            // Swept-side cowlick
            g.fillStyle(0x2a1e10, 1);
            g.fillTriangle(106, 28, 118, 14, 112, 36);
            // Eyes
            const eyeY = 50;
            if (portraitState === 'smug' || portraitState === 'pleased') {
                // half-closed + smirk
                g.fillStyle(0x1a120a, 1);
                g.fillRect(62, eyeY, 8, 4);
                g.fillRect(85, eyeY, 8, 4);
                g.fillStyle(0x1a120a, 0.5);
                g.fillRect(62, eyeY - 3, 8, 3);
                g.fillRect(85, eyeY - 3, 8, 3);
            } else if (portraitState === 'alarmed') {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(67, eyeY, 4.5);
                g.fillCircle(90, eyeY, 4.5);
            } else {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(67, eyeY, 3.5);
                g.fillCircle(90, eyeY, 3.5);
            }
            break;
        }

        case 'spirit': {
            // Translucent geometric spirit — uses glow + gem palette
            const body = p.body;
            const glow = p.glow;
            const gem  = p.gem;
            // Outer glow halo
            g.fillStyle(toHexInt(glow), 0.10);
            g.fillCircle(80, 100, 80);
            g.fillStyle(toHexInt(glow), 0.08);
            g.fillCircle(80, 100, 70);
            // Body — translucent diamond/hex shape
            g.fillStyle(toHexInt(body), 0.55);
            g.fillTriangle(80, 18, 28, 90, 132, 90);   // upper diamond half
            g.fillTriangle(28, 90, 132, 90, 80, 190);  // lower diamond half
            // Inner glow
            g.fillStyle(toHexInt(glow), 0.22);
            g.fillTriangle(80, 38, 44, 90, 116, 90);
            g.fillTriangle(44, 90, 116, 90, 80, 170);
            // Central gem
            const gemCol = toHexInt(gem);
            g.fillStyle(gemCol, 0.9);
            g.fillCircle(80, 90, 12);
            g.lineStyle(2, toHexInt(glow), 0.9);
            g.strokeCircle(80, 90, 12);
            // Face — minimal, alien
            const eyeY = 74;
            const eyeGlow = portraitState === 'urgent' ? 0xffcc44 : toHexInt(glow);
            g.fillStyle(eyeGlow, 0.95);
            g.fillRect(68, eyeY, 6, 5);
            g.fillRect(86, eyeY, 6, 5);
            if (portraitState === 'curious') {
                g.fillStyle(toHexInt(glow), 0.6);
                g.fillCircle(80, eyeY + 18, 3);
            }
            // Geometric edges
            g.lineStyle(1, toHexInt(glow), 0.35);
            g.strokeTriangle(80, 18, 28, 90, 132, 90);
            g.strokeTriangle(28, 90, 132, 90, 80, 190);
            break;
        }

        case 'vendor': {
            // Stout apothecary with many pockets
            const skin = p.skin;
            const coat = p.coat;
            const trim = p.trim;
            // Coat body
            g.fillStyle(toHexInt(coat), 1);
            g.fillRoundedRect(18, 92, 124, 108, 8);
            // Pockets
            g.fillStyle(toHexInt(trim), 0.5);
            g.fillRoundedRect(28, 112, 32, 22, 3);
            g.fillRoundedRect(66, 112, 26, 22, 3);
            g.fillRoundedRect(100, 112, 28, 22, 3);
            g.lineStyle(1, toHexInt(trim), 0.7);
            g.strokeRoundedRect(28, 112, 32, 22, 3);
            g.strokeRoundedRect(66, 112, 26, 22, 3);
            g.strokeRoundedRect(100, 112, 28, 22, 3);
            // Wide neck + head
            g.fillStyle(toHexInt(skin), 1);
            g.fillRect(58, 64, 44, 32);
            g.fillEllipse(80, 56, 62, 60);
            // Hat (small round cap)
            g.fillStyle(toHexInt(coat), 1);
            g.fillEllipse(80, 26, 64, 20);
            g.fillRect(54, 16, 52, 18);
            g.lineStyle(2, toHexInt(trim), 0.9);
            g.strokeEllipse(80, 26, 64, 20);
            // Eyes
            const eyeY = 52;
            if (portraitState === 'warm' || portraitState === 'pleased') {
                // crinkled warm smile
                g.fillStyle(0x1a120a, 1);
                g.fillRect(63, eyeY, 8, 4);
                g.fillRect(88, eyeY, 8, 4);
                g.fillStyle(0x1a120a, 0.45);
                g.fillRect(63, eyeY - 3, 8, 3);
                g.fillRect(88, eyeY - 3, 8, 3);
            } else if (portraitState === 'curious') {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(68, eyeY, 4);
                g.fillCircle(91, eyeY, 4);
                // one raised "brow"
                g.lineStyle(2, 0x1a120a, 0.9);
                g.lineBetween(85, eyeY - 8, 99, eyeY - 12);
            } else {
                g.fillStyle(0x1a120a, 1);
                g.fillCircle(68, eyeY, 3.5);
                g.fillCircle(91, eyeY, 3.5);
            }
            break;
        }

        default: {
            // Generic silhouette fallback
            g.fillStyle(0x5a4a3a, 0.7);
            g.fillEllipse(80, 56, 52, 56);
            g.fillRoundedRect(30, 88, 100, 112, 6);
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// VNScene
// ---------------------------------------------------------------------------

export class VNScene extends Scene {
    constructor() { super({ key: 'VNScene' }); }

    /**
     * @param {object} data
     * @param {string}   data.scriptId    — key into SCRIPTS
     * @param {string[]} data.pauseScenes — scene keys to pause/resume (default: previous scene)
     * @param {Function} data.onComplete  — called when dialog ends
     */
    create(data = {}) {
        this._scriptId    = data.scriptId   || 'ch1-intro';
        this._pauseScenes = data.pauseScenes || [];
        this._onComplete  = data.onComplete  || null;

        // Pause the underlying game scenes.
        for (const key of this._pauseScenes) {
            if (this.scene.get(key) && this.scene.isActive(key)) {
                this.scene.pause(key);
            }
        }

        this._typeTimer   = 0;
        this._typeIndex   = 0;
        this._typeTarget  = '';
        this._typing      = false;
        this._showCursor  = false;
        this._cursorTimer = 0;
        this._closingDown = false;
        this._choiceIdx   = 0;

        // Create the DialogRunner and start.
        this._runner = new DialogRunner(this._scriptId);
        this._runner.start();

        // -- Backdrop --
        this._backdrop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setDepth(0);

        // -- Main panel (slides in from bottom) --
        this._panelContainer = this.add.container(0, GAME_HEIGHT).setDepth(1); // off-screen start

        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(toHexInt(COLORS.panel), 0.97);
        panelBg.fillRoundedRect(0, 0, GAME_WIDTH, PANEL_H, 0);
        panelBg.lineStyle(2, toHexInt(COLORS.brass), 0.7);
        panelBg.strokeRoundedRect(0, 0, GAME_WIDTH, PANEL_H, 0);
        this._panelContainer.add(panelBg);

        // Portrait canvas texture
        this._portraitGfx = this.add.graphics().setPosition(12, 10);
        this._panelContainer.add(this._portraitGfx);
        // Portrait fade overlay (for cross-fade effect)
        this._portraitFadeGfx = this.add.graphics().setPosition(12, 10).setAlpha(0);
        this._panelContainer.add(this._portraitFadeGfx);

        // Name plate
        this._nameText = this.add.text(TEXT_X, NAMEPLATE_Y, '', {
            fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.brass),
        }).setDepth(2);
        this._panelContainer.add(this._nameText);

        // Text box (the live typing area)
        this._dialogText = this.add.text(TEXT_X, TEXT_Y, '', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.text),
            wordWrap: { width: TEXT_W, useAdvancedWrap: true },
        }).setDepth(2);
        this._panelContainer.add(this._dialogText);

        // Advance cursor ▶
        this._cursorText = this.add.text(GAME_WIDTH - 28, ADVANCE_HINT_Y, '▶', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.gold),
        }).setAlpha(0).setDepth(2);
        this._panelContainer.add(this._cursorText);

        // Choice buttons container (hidden until a choice beat)
        this._choiceContainer = this.add.container(TEXT_X, TEXT_Y).setDepth(2);
        this._panelContainer.add(this._choiceContainer);
        this._choiceHitRects = [];
        this._choiceLabels   = [];

        // Skip button
        const skipBg = this.add.graphics();
        skipBg.fillStyle(toHexInt(COLORS.panelEdge), 0.7);
        skipBg.fillRoundedRect(GAME_WIDTH - 80, 6, 68, 22, 4);
        const skipTxt = this.add.text(GAME_WIDTH - 46, 17, 'SKIP', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5).setDepth(3);
        this._skipHit = { x: GAME_WIDTH - 80, y: 6, w: 68, h: 22 };
        this._panelContainer.add(skipBg);
        this._panelContainer.add(skipTxt);

        // Input wiring
        this.input.keyboard.on('keydown-SPACE', () => this._onAdvance());
        this.input.keyboard.on('keydown-ENTER', () => this._onAdvance());
        this.input.keyboard.on('keydown-UP',    () => this._moveChoice(-1));
        this.input.keyboard.on('keydown-DOWN',  () => this._moveChoice(1));
        this.input.on('pointerdown', (p) => this._onPointerDown(p));
        this.input.on('pointermove', (p) => this._onPointerMove(p));

        // Slide the panel in (instant when prefers-reduced-motion).
        playDialogOpen();
        if (REDUCED_MOTION) {
            this._panelContainer.y = PANEL_Y;
            this._refreshDisplay();
        } else {
            this.tweens.add({
                targets:  this._panelContainer,
                y:        PANEL_Y,
                duration: 200,
                ease:     'Sine.easeOut',
                onComplete: () => this._refreshDisplay(),
            });
        }
    }

    // ---- Display refresh ----------------------------------------------------

    _refreshDisplay() {
        this._choiceContainer.removeAll(true);
        this._choiceHitRects = [];
        this._choiceLabels   = [];

        if (this._runner.done) { this._close(); return; }

        // Choice beat
        if (this._runner.choices) {
            this._nameText.setText('');
            this._dialogText.setText('Choose your response:');
            this._cursorText.setAlpha(0);
            this._buildChoiceButtons(this._runner.choices);
            return;
        }

        const cur = this._runner.current;
        if (!cur) { this._close(); return; }

        // Portrait update (cross-fade if different)
        const charDef = cur.speaker ? CHARACTERS[cur.speaker] : null;
        this._updatePortrait(charDef, cur.portrait);

        // Name plate
        const charName = charDef ? charDef.name : '';
        this._nameText.setText(charName.toUpperCase());

        // Start typing (or auto-advance silent beats)
        if (cur.silent) {
            this._dialogText.setText('');
            this._cursorText.setAlpha(0);
            this.time.delayedCall(320, () => {
                if (!this._closingDown) {
                    this._runner.advance();
                    this._refreshDisplay();
                }
            });
        } else {
            this._startTyping(cur.text || '');
        }
    }

    _startTyping(fullText) {
        this._typeTarget = fullText;
        if (REDUCED_MOTION) {
            // Skip typewriter — show text immediately.
            this._typeIndex = fullText.length;
            this._typing    = false;
            this._dialogText.setText(fullText);
            this._showCursor = true;
        } else {
            this._typeIndex  = 0;
            this._typing     = true;
            this._showCursor = false;
            this._dialogText.setText('');
            this._cursorText.setAlpha(0);
        }
    }

    _finishTyping() {
        this._typing = false;
        this._typeIndex = this._typeTarget.length;
        this._dialogText.setText(this._typeTarget);
        this._showCursor = true;
    }

    // ---- Portrait rendering -------------------------------------------------

    _updatePortrait(charDef, portraitState) {
        if (!charDef) { this._portraitGfx.clear(); return; }

        // If same char+state, no cross-fade needed.
        if (this._currentChar === charDef.id && this._currentPortraitState === portraitState) return;

        // Cross-fade: snapshot current portrait via alpha, draw new on main.
        if (this._currentChar && !REDUCED_MOTION) {
            // Copy current portrait to fade-out layer, then cross-fade.
            this._portraitFadeGfx.clear();
            const oldChar  = CHARACTERS[this._currentChar];
            const oldState = this._currentPortraitState || 'neutral';
            if (oldChar) drawPortrait(this._portraitFadeGfx, oldChar, oldState);
            this._portraitFadeGfx.setAlpha(1);
            this.tweens.add({
                targets: this._portraitFadeGfx, alpha: 0, duration: 160, ease: 'Linear',
            });
        }

        drawPortrait(this._portraitGfx, charDef, portraitState || 'neutral');
        this._currentChar         = charDef.id;
        this._currentPortraitState = portraitState || 'neutral';
    }

    // ---- Choice UI ----------------------------------------------------------

    _buildChoiceButtons(choices) {
        this._choiceIdx = 0;
        const btnH  = 30;
        const btnGap = 6;
        choices.forEach((c, i) => {
            const by = i * (btnH + btnGap);
            const bg = this.add.graphics();
            bg.fillStyle(toHexInt(COLORS.panelEdge), i === this._choiceIdx ? 0.9 : 0.5);
            bg.fillRoundedRect(0, by, TEXT_W, btnH, 4);
            bg.lineStyle(2, toHexInt(i === this._choiceIdx ? COLORS.gold : COLORS.panelEdge), 0.8);
            bg.strokeRoundedRect(0, by, TEXT_W, btnH, 4);
            const lbl = this.add.text(12, by + btnH / 2, c.label, {
                fontSize: '13px', fontFamily: 'monospace',
                color: hex(i === this._choiceIdx ? COLORS.gold : COLORS.textDim),
            }).setOrigin(0, 0.5);
            this._choiceContainer.add(bg);
            this._choiceContainer.add(lbl);
            this._choiceHitRects.push({ x: TEXT_X, y: PANEL_Y + TEXT_Y + by, w: TEXT_W, h: btnH });
            this._choiceLabels.push({ bg, lbl });
        });
    }

    _moveChoice(dir) {
        if (!this._runner.choices) return;
        const n = this._runner.choices.length;
        this._choiceIdx = (this._choiceIdx + dir + n) % n;
        playChoiceHover();
        this._refreshChoiceHighlight();
    }

    _refreshChoiceHighlight() {
        this._choiceLabels.forEach(({ bg, lbl }, i) => {
            bg.clear();
            bg.fillStyle(toHexInt(COLORS.panelEdge), i === this._choiceIdx ? 0.9 : 0.5);
            const btnH = 30;
            const by   = i * (btnH + 6);
            bg.fillRoundedRect(0, by, TEXT_W, btnH, 4);
            bg.lineStyle(2, toHexInt(i === this._choiceIdx ? COLORS.gold : COLORS.panelEdge), 0.8);
            bg.strokeRoundedRect(0, by, TEXT_W, btnH, 4);
            lbl.setColor(hex(i === this._choiceIdx ? COLORS.gold : COLORS.textDim));
        });
    }

    // ---- Input --------------------------------------------------------------

    _onAdvance() {
        if (this._closingDown) return;

        if (this._runner.choices) {
            playDialogAdvance();
            this._runner.selectChoice(this._choiceIdx);
            this._refreshDisplay();
            return;
        }

        if (this._typing) {
            // Skip typewriter — show full text immediately.
            this._finishTyping();
            return;
        }

        if (this._showCursor) {
            playDialogAdvance();
            this._showCursor = false;
            this._cursorText.setAlpha(0);
            this._runner.advance();
            this._refreshDisplay();
        }
    }

    _onPointerDown(pointer) {
        if (this._closingDown) return;

        // Skip button
        const s = this._skipHit;
        const py = pointer.y - PANEL_Y;
        if (pointer.x >= s.x && pointer.x <= s.x + s.w && py >= s.y && py <= s.y + s.h) {
            this._skipAll();
            return;
        }

        // Choice button clicks
        if (this._runner.choices) {
            for (let i = 0; i < this._choiceHitRects.length; i++) {
                const r = this._choiceHitRects[i];
                if (pointer.x >= r.x && pointer.x <= r.x + r.w &&
                    pointer.y >= r.y && pointer.y <= r.y + r.h) {
                    this._choiceIdx = i;
                    playDialogAdvance();
                    this._runner.selectChoice(i);
                    this._refreshDisplay();
                    return;
                }
            }
            return;
        }

        // Anywhere else in panel = advance.
        if (pointer.y >= PANEL_Y) {
            this._onAdvance();
        }
    }

    _onPointerMove(pointer) {
        if (!this._runner.choices) return;
        for (let i = 0; i < this._choiceHitRects.length; i++) {
            const r = this._choiceHitRects[i];
            if (pointer.x >= r.x && pointer.x <= r.x + r.w &&
                pointer.y >= r.y && pointer.y <= r.y + r.h) {
                if (this._choiceIdx !== i) {
                    this._choiceIdx = i;
                    playChoiceHover();
                    this._refreshChoiceHighlight();
                }
                return;
            }
        }
    }

    _skipAll() {
        if (this._closingDown) return;
        // Run through all remaining beats without display.
        let guard = 0;
        while (!this._runner.done && guard++ < 500) {
            if (this._runner.choices) {
                this._runner.selectChoice(0); // pick first choice on skip
            } else {
                this._runner.advance();
            }
        }
        this._close();
    }

    // ---- Close --------------------------------------------------------------

    _close() {
        if (this._closingDown) return;
        this._closingDown = true;
        playDialogClose();
        if (REDUCED_MOTION) {
            this._teardown();
        } else {
            this.tweens.add({
                targets:  this._panelContainer,
                y:        GAME_HEIGHT,
                duration: 180,
                ease:     'Sine.easeIn',
                onComplete: () => this._teardown(),
            });
            this.tweens.add({
                targets:  this._backdrop,
                alpha:    0,
                duration: 200,
                ease:     'Linear',
            });
        }
    }

    _teardown() {
        // Resume paused scenes.
        for (const key of this._pauseScenes) {
            if (this.scene.get(key) && this.scene.isPaused(key)) {
                this.scene.resume(key);
            }
        }
        const cb = this._onComplete;
        this.scene.stop('VNScene');
        if (cb) cb();
    }

    // ---- Update loop (typewriter + cursor blink) ----------------------------

    update(time, delta) {
        const dt = delta / 1000;

        if (this._typing) {
            this._typeTimer += dt;
            const charsToAdd = Math.floor(this._typeTimer * TYPE_SPEED);
            if (charsToAdd > 0) {
                this._typeTimer -= charsToAdd / TYPE_SPEED;
                this._typeIndex = Math.min(this._typeIndex + charsToAdd, this._typeTarget.length);
                this._dialogText.setText(this._typeTarget.slice(0, this._typeIndex));
                if (this._typeIndex >= this._typeTarget.length) {
                    this._finishTyping();
                }
            }
        }

        if (this._showCursor) {
            this._cursorTimer += dt;
            const on = Math.floor(this._cursorTimer * 2) % 2 === 0;
            this._cursorText.setAlpha(on ? 1 : 0);
        }
    }
}
