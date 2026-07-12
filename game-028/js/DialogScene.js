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
import { getDialog, getNPC, SHOP_STOCKS } from './dialog.js';
import { ITEM_DEFS, getItem } from './items.js';
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

        // Shop overlay container (hidden until _openShop)
        this._shopContainer = this.add.container(0, 0).setDepth(20).setVisible(false);
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

        let node = this._tree.nodes[nodeId];
        if (!node) { this._endDialog(); return; }

        // Silent routing node: jump straight to whichever route condition matches, no text shown
        if (node.routes) {
            const match = node.routes.find(r => !r.condition || this._checkCondition(r.condition));
            this._advanceNode(match ? match.next : (node.next || 'end'));
            return;
        }

        // Execute action if any
        if (node.action) this._executeAction(node.action);

        const choices = (node.choices || []).filter(c => !c.condition || this._checkCondition(c.condition));
        const next    = node.next || 'end';

        this._startTypewriter(node.speaker || this._npc?.name || '?', this._npc?.portrait, node.text, next, choices);
    }

    _checkCondition(condition) {
        if (condition.startsWith('chapter_')) return state.chapter >= parseInt(condition.split('_')[1]);
        if (condition.startsWith('quest_done_')) return state.isQuestDone(condition.replace('quest_done_', ''));
        if (condition.startsWith('quest_active_')) return state.quests.active.includes(condition.replace('quest_active_', ''));
        if (condition.startsWith('has_item_')) return state.hasItem(condition.replace('has_item_', ''));
        if (condition.startsWith('has_qty:')) {
            const [, id, qty] = condition.split(':');
            return state.getItemQty(id) >= parseInt(qty);
        }
        if (condition.startsWith('all_flags:')) {
            const names = condition.slice('all_flags:'.length).split(',');
            return names.every(n => !!state.getFlag(n));
        }
        if (condition.startsWith('flag_')) return !!state.getFlag(condition);
        if (condition.startsWith('not_flag_')) return !state.getFlag(condition.replace('not_', ''));
        if (condition.startsWith('party_has_')) return state.party.includes(condition.replace('party_has_', ''));
        return true;
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

    _openShop(stockId) {
        this._shopStock = (SHOP_STOCKS[stockId] || []).map(id => getItem(id)).filter(Boolean);
        this._shopIdx   = 0;
        this._shopMode  = true;
        this._shopContainer.setVisible(true);
        this._drawShop();
    }

    _drawShop() {
        this._shopContainer.removeAll(true);

        const CX = GAME_WIDTH / 2, CY = GAME_HEIGHT / 2;
        this._shopContainer.add(this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75));
        this._shopContainer.add(this.add.rectangle(CX, CY, 720, 480, 0x0c0820).setStrokeStyle(2, 0x6040a0));
        this._shopContainer.add(this.add.text(CX, CY - 220, 'Shop', {
            fontSize: '22px', color: hex(COLORS.accent), fontFamily: 'Georgia, serif', fontStyle: 'bold',
        }).setOrigin(0.5));
        this._shopContainer.add(this.add.text(CX, CY - 190, `Gold: ${state.gold}`, {
            fontSize: '15px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(0.5));

        const listX = CX - 320, listY = CY - 150;
        this._shopStock.forEach((def, i) => {
            const sel = i === this._shopIdx;
            const y   = listY + i * 34;
            const canAfford = state.gold >= def.buyPrice;
            this._shopContainer.add(this.add.text(listX, y,
                (sel ? '▶ ' : '  ') + `${def.icon} ${def.name}`, {
                    fontSize: '15px',
                    color: sel ? hex(COLORS.gold) : canAfford ? hex(COLORS.text) : '#666666',
                    fontFamily: 'monospace',
                }));
            this._shopContainer.add(this.add.text(listX + 480, y, `${def.buyPrice}g`, {
                fontSize: '15px',
                color: sel ? hex(COLORS.gold) : canAfford ? hex(COLORS.text) : '#666666',
                fontFamily: 'monospace',
            }));
        });

        const cur = this._shopStock[this._shopIdx];
        if (cur) {
            this._shopContainer.add(this.add.text(CX, CY + 180, cur.desc, {
                fontSize: '13px', color: hex(COLORS.muted), fontFamily: 'monospace',
                wordWrap: { width: 640 }, align: 'center',
            }).setOrigin(0.5));
        }

        this._shopContainer.add(this.add.text(CX, CY + 220, 'Enter: Buy    Esc: Leave shop', {
            fontSize: '12px', color: hex(COLORS.muted), fontFamily: 'monospace',
        }).setOrigin(0.5));
    }

    _onShopKey(key) {
        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            this._shopIdx = Math.max(0, this._shopIdx - 1);
            playUiClick();
            this._drawShop();
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            this._shopIdx = Math.min(this._shopStock.length - 1, this._shopIdx + 1);
            playUiClick();
            this._drawShop();
        } else if (key === 'Enter' || key === ' ') {
            this._buyItem();
        } else if (key === 'Escape') {
            this._closeShop();
        }
    }

    _buyItem() {
        const def = this._shopStock[this._shopIdx];
        if (!def || state.gold < def.buyPrice) return;
        state.spendGold(def.buyPrice);
        state.addItem({ id: def.id, qty: 1 });
        playUiClick();
        this._drawShop();
    }

    _closeShop() {
        this._shopMode = false;
        this._shopContainer.setVisible(false);
        playDialogAdvance();
        this._advanceNode(this._currentNext);
    }

    _setupInput() {
        this.input.keyboard.on('keydown', (e) => this._onKey(e.key));
        this.input.on('pointerdown', () => { if (!this._shopMode) this._onSpace(); });
    }

    _onKey(key) {
        if (this._shopMode) { this._onShopKey(key); return; }

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
            case 'setChapter':
                state.setChapter(action.payload);
                break;
            case 'joinParty':
                state.addToParty(action.payload);
                break;
            case 'shop':
                this._openShop(action.payload);
                break;
            case 'turnInItems':
                state.removeItem(action.payload.itemId, action.payload.qty);
                state.completeQuest(action.payload.questId);
                break;
            case 'multi':
                for (const sub of action.payload) this._executeAction(sub);
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
