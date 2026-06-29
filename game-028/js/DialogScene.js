/**
 * DialogScene — Visual novel dialogue overlay.
 *
 * Launched over MapScene (which is paused).
 * Handles dialog trees, typewriter text, speaker portraits, and choices.
 *
 * Input:
 *   data.npcId       — NPC id (for portrait/name lookup)
 *   data.treeId      — Dialog tree id from dialog.js
 *   data.singleText  — If set, show a single message with no choices
 *   data.callerScene — Scene to resume when dialog ends
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DIALOG_BOX_HEIGHT, DIALOG_CHAR_SPEED } from './config.js';
import { getDialog, getNPC } from './dialog.js';
import { ITEM_DEFS } from './items.js';
import { QUEST_DEFS } from './quests.js';
import { playDialogAdvance, playDialogEnd, playUiClick } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class DialogScene extends Phaser.Scene {
    constructor() { super({ key: 'DialogScene' }); }

    init(data) {
        this._npcId      = data.npcId;
        this._treeId     = data.treeId;
        this._singleText = data.singleText;
        this._caller     = data.callerScene || 'MapScene';
    }

    create() {
        this._npc        = this._npcId ? getNPC(this._npcId) : null;
        this._tree       = this._treeId ? getDialog(this._treeId) : null;
        this._nodeId     = this._tree?.start || null;
        this._charIdx    = 0;
        this._charTimer  = 0;
        this._typing     = true;
        this._choiceIdx  = 0;
        this._choices    = [];
        this._waitInput  = false;
        this._done       = false;

        this._buildUI();
        this._advanceNode(this._nodeId);
        this._setupInput();
    }

    _buildUI() {
        const BOX_Y = GAME_HEIGHT - DIALOG_BOX_HEIGHT - 10;

        // Dim overlay (semi-transparent)
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setDepth(0);

        // Dialog box
        this.add.rectangle(GAME_WIDTH / 2, BOX_Y + DIALOG_BOX_HEIGHT / 2, GAME_WIDTH - 40, DIALOG_BOX_HEIGHT, 0x0c0820)
            .setStrokeStyle(2, 0x6040a0).setDepth(1);

        // Portrait box (left side)
        this._portraitBg = this.add.rectangle(50, BOX_Y + DIALOG_BOX_HEIGHT / 2, 80, 80, 0x1a0830)
            .setStrokeStyle(1, 0x6040a0).setDepth(2);
        this._portraitText = this.add.text(50, BOX_Y + DIALOG_BOX_HEIGHT / 2,
            this._npc?.portrait || '?', { fontSize: '40px' })
            .setOrigin(0.5).setDepth(3);

        // Speaker name
        this._speakerLabel = this.add.text(100, BOX_Y + 14, '', {
            fontSize: '16px',
            color: hex(COLORS.accent),
            fontFamily: 'Georgia, serif',
            fontStyle: 'bold',
        }).setDepth(3);

        // Dialog text
        this._dialogText = this.add.text(100, BOX_Y + 40, '', {
            fontSize: '15px',
            color: hex(COLORS.text),
            fontFamily: 'Georgia, serif',
            wordWrap: { width: GAME_WIDTH - 200 },
            lineSpacing: 6,
        }).setDepth(3);

        // Choice buttons container
        this._choiceContainer = this.add.container(0, 0).setDepth(4);

        // Advance prompt
        this._advPrompt = this.add.text(GAME_WIDTH - 60, GAME_HEIGHT - 25, '▼ SPACE', {
            fontSize: '12px',
            color: hex(COLORS.muted),
            fontFamily: 'monospace',
        }).setDepth(4);

        this._BOX_Y = BOX_Y;
    }

    _advanceNode(nodeId) {
        if (this._singleText) {
            this._startTypewriter('Narrator', null, this._singleText, 'end', []);
            return;
        }

        if (!nodeId || nodeId === 'end' || !this._tree) {
            this._endDialog();
            return;
        }

        const node = this._tree.nodes[nodeId];
        if (!node) { this._endDialog(); return; }

        // Execute action if any
        if (node.action) this._executeAction(node.action);

        const choices = node.choices || [];
        const next    = node.next || 'end';

        this._startTypewriter(node.speaker || this._npc?.name || '?', this._npc?.portrait, node.text, next, choices);
    }

    _startTypewriter(speaker, portrait, text, next, choices) {
        this._currentText    = text;
        this._currentSpeaker = speaker;
        this._currentNext    = next;
        this._currentChoices = choices;
        this._charIdx        = 0;
        this._typing         = true;
        this._waitInput      = false;
        this._choiceIdx      = 0;

        this._speakerLabel.setText(speaker);
        this._dialogText.setText('');

        // Update portrait
        if (portrait) this._portraitText.setText(portrait);

        this._choiceContainer.removeAll(true);
    }

    update(time, delta) {
        if (this._done) return;

        if (this._typing) {
            this._charTimer += delta / 1000;
            const charDelay = 1 / DIALOG_CHAR_SPEED;

            while (this._charTimer >= charDelay && this._charIdx < this._currentText.length) {
                this._charTimer -= charDelay;
                this._charIdx++;
                this._dialogText.setText(this._currentText.slice(0, this._charIdx));
            }

            if (this._charIdx >= this._currentText.length) {
                this._typing    = false;
                this._waitInput = true;
                this._drawChoices();
            }
        }
    }

    _drawChoices() {
        this._choiceContainer.removeAll(true);

        if (this._currentChoices.length === 0) {
            // Simple advance
            this._advPrompt.setText('▼ SPACE to continue');
            return;
        }

        this._advPrompt.setText('');
        // Place choices inside the dialog box, below the dialog text
        const baseY = this._BOX_Y + 100;

        this._currentChoices.forEach((choice, i) => {
            const sel = i === this._choiceIdx;
            const btn = this.add.text(120, baseY + i * 28,
                (sel ? '▶ ' : '  ') + choice.label, {
                    fontSize: '15px',
                    color: sel ? hex(COLORS.gold) : hex(COLORS.text),
                    fontFamily: 'Georgia, serif',
                    backgroundColor: sel ? '#2a1840' : '#00000000',
                    padding: { x: 6, y: 3 },
                }).setDepth(5);
            this._choiceContainer.add(btn);
        });
    }

    _setupInput() {
        this.input.keyboard.on('keydown', (e) => this._onKey(e.key));
        this.input.on('pointerdown', () => this._onSpace());
    }

    _onKey(key) {
        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            if (this._waitInput && this._currentChoices.length > 0) {
                this._choiceIdx = Math.max(0, this._choiceIdx - 1);
                this._drawChoices();
                playUiClick();
            }
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            if (this._waitInput && this._currentChoices.length > 0) {
                this._choiceIdx = Math.min(this._currentChoices.length - 1, this._choiceIdx + 1);
                this._drawChoices();
                playUiClick();
            }
        } else if (key === ' ' || key === 'Enter') {
            this._onSpace();
        } else if (key === 'Escape') {
            this._endDialog();
        }
    }

    _onSpace() {
        if (this._typing) {
            // Skip to end of current text
            this._charIdx  = this._currentText.length;
            this._typing   = false;
            this._waitInput = true;
            this._dialogText.setText(this._currentText);
            this._drawChoices();
            return;
        }

        if (!this._waitInput) return;

        if (this._currentChoices.length > 0) {
            const choice = this._currentChoices[this._choiceIdx];
            if (choice.action) this._executeAction(choice.action);
            playDialogAdvance();
            this._advanceNode(choice.next);
        } else {
            playDialogAdvance();
            this._advanceNode(this._currentNext);
        }
    }

    _executeAction(action) {
        if (!action) return;
        switch (action.type) {
            case 'giveQuest':
                state.acceptQuest(action.payload);
                break;
            case 'completeQuest':
                state.completeQuest(action.payload);
                break;
            case 'giveItem':
                state.addItem({ id: action.payload.id, qty: action.payload.qty || 1 });
                break;
            case 'setFlag':
                state.setFlag(action.payload.name, action.payload.value);
                break;
            case 'joinParty':
                state.addToParty(action.payload);
                break;
            case 'rest':
                if (state.gold >= action.payload.cost) {
                    state.spendGold(action.payload.cost);
                    state.restorePartyFull();
                } else {
                    this._currentText = "You don't have enough gold for a room.";
                    this._charIdx = this._currentText.length;
                    this._dialogText.setText(this._currentText);
                }
                break;
        }
    }

    _endDialog() {
        if (this._done) return;
        this._done = true;
        playDialogEnd();
        state.isPaused = false;
        events.emit('dialogEnd', this._npcId);
        this.scene.stop('DialogScene');
        this.scene.resume(this._caller);
    }

    shutdown() {
        this.input.keyboard.off('keydown');
    }
}
