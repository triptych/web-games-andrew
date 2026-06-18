/**
 * ResultScene — level result screen (game-plan §Other screens, Phase 4).
 *
 * Save/load affordances:
 *   Win:  "✓ PROGRESS SAVED" badge; two buttons — CONTINUE (next level) and
 *         TITLE (save already done, just quit to splash).
 *   Fail: RETRY button (same level, no save change) and TITLE button.
 *   C key always opens the Cauldron between levels (read-write).
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, ELEMENTS } from './config.js';
import { playUiClick } from './sounds.js';
import { state } from './state.js';

function hex(arr)      { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const ELEM = {};
for (const e of ELEMENTS) ELEM[e.id] = e;

const MESSAGES = {
    complete:   { title: 'OBJECTIVE COMPLETE',    color: COLORS.success },
    jammed:     { title: 'THE LATTICE IS JAMMED', color: COLORS.danger  },
    infeasible: { title: 'THE QUEST SLIPS AWAY',  color: COLORS.danger  },
    defeated:   { title: 'YOU WERE OVERWHELMED',  color: COLORS.danger  },
};

function makeButton(scene, cx, y, w, h, label, labelColor, borderColor, bgAlpha = 0.9) {
    const bg = scene.add.graphics();
    bg.fillStyle(toHexInt(COLORS.panel), bgAlpha);
    bg.fillRoundedRect(cx - w / 2, y, w, h, 6);
    bg.lineStyle(2, toHexInt(borderColor), 0.85);
    bg.strokeRoundedRect(cx - w / 2, y, w, h, 6);
    scene.add.text(cx, y + h / 2, label, {
        fontSize: '15px', fontFamily: 'monospace', color: hex(labelColor),
    }).setOrigin(0.5);
    return { x: cx - w / 2, y, w, h };
}

function hits(rect, px, py) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

export class ResultScene extends Scene {
    constructor() { super({ key: 'ResultScene' }); }

    create(data) {
        const CX = GAME_WIDTH / 2;
        const CY = GAME_HEIGHT / 2;

        const reason  = data.reason || 'jammed';
        const info    = MESSAGES[reason] || MESSAGES.jammed;
        const isWin   = reason === 'complete';
        const rewards = data.rewards || {};

        // Dim backdrop
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT,
            toHexInt(COLORS.bg), 0.90);

        // Level name
        if (data.levelName) {
            this.add.text(CX, CY - 158, data.levelName.toUpperCase(), {
                fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setOrigin(0.5);
        }

        // Outcome title
        this.add.text(CX, CY - 126, info.title, {
            fontSize: '36px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(info.color),
        }).setOrigin(0.5);

        // ✓ PROGRESS SAVED badge (win only — save happens in GameScene._onObjectiveMet)
        if (isWin) {
            this.add.text(CX, CY - 90, '✓ PROGRESS SAVED', {
                fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.success),
            }).setOrigin(0.5);
        }

        // Cauldron upgraded badge
        if (data.cauldronUpgraded) {
            this.add.text(CX, CY - (isWin ? 68 : 84), '⚗  CAULDRON UPGRADED!', {
                fontSize: '17px', fontFamily: 'monospace', fontStyle: 'bold',
                color: hex(COLORS.gold),
            }).setOrigin(0.5);
        }

        // Score
        const scoreY = CY - (data.cauldronUpgraded ? (isWin ? 44 : 58) : (isWin ? 58 : 72));
        this.add.text(CX, scoreY, `SCORE  ${data.score}`, {
            fontSize: '28px', fontFamily: 'monospace', color: hex(COLORS.gold),
        }).setOrigin(0.5);

        let rowY = scoreY + 42;

        // Best combo
        this.add.text(CX, rowY, `BEST COMBO  ×${data.maxCombo}`, {
            fontSize: '15px', fontFamily: 'monospace', color: hex(COLORS.text),
        }).setOrigin(0.5);
        rowY += 26;

        // Harvested elements this level
        const harvested = data.harvested || {};
        const harvestLines = Object.entries(harvested).filter(([, n]) => n > 0);
        if (harvestLines.length) {
            const parts = harvestLines.map(([id, n]) => {
                const e = ELEM[id] || { glyph: '?', name: id };
                return `${e.glyph} ${e.name} +${n}`;
            });
            this.add.text(CX, rowY, 'HARVESTED   ' + parts.join('    '), {
                fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
            }).setOrigin(0.5);
            rowY += 24;
        }

        // Rewards (win only)
        if (isWin && (rewards.currency || rewards.xp)) {
            const rewardParts = [];
            if (rewards.currency) rewardParts.push(`+${rewards.currency} grams`);
            if (rewards.xp)       rewardParts.push(`+${rewards.xp} XP`);
            this.add.text(CX, rowY, 'REWARDS   ' + rewardParts.join('    '), {
                fontSize: '15px', fontFamily: 'monospace', color: hex(COLORS.gold),
            }).setOrigin(0.5);
            rowY += 24;

            // Running totals (read from state — already updated before ResultScene launched)
            this.add.text(CX, rowY, `Total: ${state.currency} grams   ${state.xp} XP`, {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setOrigin(0.5);
            rowY += 22;
        }

        // Cauldron hint (win only — on fail just retry)
        if (isWin) {
            this.add.text(CX, rowY + 6, 'C — open Cauldron to spend harvested elements', {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.brass),
            }).setOrigin(0.5);
        }

        // Next level hint (win)
        if (isWin && data.nextLevelName) {
            this.add.text(CX, rowY + 26, `NEXT: ${data.nextLevelName}`, {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setOrigin(0.5);
        }

        // --- Buttons ---
        const btnY  = CY + 118;
        const gap   = 20;

        let contHit, retryHit, titleHit;

        if (isWin) {
            // CONTINUE  |  TITLE
            contHit  = makeButton(this, CX - 100, btnY, 180, 42,
                '▶  CONTINUE', COLORS.gold, COLORS.gold);
            titleHit = makeButton(this, CX + 110, btnY, 160, 42,
                '⌂  TITLE', COLORS.textDim, COLORS.panelEdge, 0.7);
        } else {
            // RETRY  |  TITLE
            retryHit = makeButton(this, CX - 100, btnY, 180, 42,
                '↺  RETRY', COLORS.parchment, COLORS.panelEdge);
            titleHit = makeButton(this, CX + 110, btnY, 160, 42,
                '⌂  TITLE', COLORS.textDim, COLORS.panelEdge, 0.7);
        }

        // Keyboard shortcuts hint
        this.add.text(CX, btnY + 52,
            isWin ? 'Space / Enter — continue   •   Esc — title' : 'Space / Enter — retry   •   Esc — title', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5);

        // --- Actions ---
        const goTitle = () => {
            playUiClick();
            // Save is already current (written on win). On fail, don't touch it.
            this.scene.start('SplashScene');
            this.scene.stop('ResultScene');
        };

        const proceed = () => {
            playUiClick();
            if (isWin) {
                // Go back to the run map to pick the next node.
                this.scene.start('MapScene');
            } else {
                // Retry: re-enter GameScene with the same node.
                this.scene.start('GameScene', {
                    nodeId:   data.nodeId,
                    nodeType: data.nodeType,
                    retry:    true,
                });
                this.scene.launch('UIScene');
            }
            this.scene.stop('ResultScene');
        };

        this.input.keyboard.on('keydown-C', () => {
            playUiClick();
            this.scene.start('CauldronScene', { readOnly: false, returnTo: 'ResultScene', returnData: data });
        });
        this.input.keyboard.on('keydown-SPACE', proceed);
        this.input.keyboard.on('keydown-ENTER', proceed);
        this.input.keyboard.on('keydown-ESC',   goTitle);

        this.input.on('pointerdown', (p) => {
            if      (contHit  && hits(contHit,  p.x, p.y)) proceed();
            else if (retryHit && hits(retryHit, p.x, p.y)) proceed();
            else if (titleHit && hits(titleHit, p.x, p.y)) goTitle();
        });

        this._t = 0;

        // Phase 6: fire boss-clear / chapter-complete VN dialog (one-shot per boss).
        this._maybeLaunchBossDialog(data, isWin);
    }

    _maybeLaunchBossDialog(data, isWin) {
        if (!isWin || !data.cauldronUpgraded) return;
        // Determine which boss-clear script to use (default ch1).
        const scriptId = 'ch1-boss-clear';
        if (state.hasSeenScript(scriptId)) return;
        this.time.delayedCall(600, () => {
            this.scene.launch('VNScene', {
                scriptId,
                pauseScenes: ['ResultScene'],
                onComplete:  () => { /* ResultScene resumes; player can now navigate */ },
            });
        });
    }

    update(time, delta) {
        this._t += delta / 1000;
    }
}
