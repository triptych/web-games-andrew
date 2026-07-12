/**
 * MenuScene — In-game pause/menu overlay.
 * Launched over MapScene (which is paused).
 *
 * Tabs:
 *   Party   — HP/MP, level, status of each party member
 *   Items   — Inventory list with use/inspect
 *   Quests  — Active and completed quest list
 *   Map     — Current map name and player position
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { PARTY_DEFS } from './characters.js';
import { getItem } from './items.js';
import { getQuest } from './quests.js';
import { getMap } from './maps.js';
import { playUiClick, playMenuOpen } from './sounds.js';
import { saveGame } from './save.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const TABS = ['Party', 'Items', 'Quests', 'Map'];

export class MenuScene extends Phaser.Scene {
    constructor() { super({ key: 'MenuScene' }); }

    init(data) {
        this._caller = data.callerScene || 'MapScene';
    }

    create() {
        this._tabIdx     = 0;
        this._listIdx    = 0;
        this._container  = this.add.container(0, 0).setDepth(10);

        playMenuOpen();
        this._buildFrame();
        this._setupInput();
        this._refresh();
    }

    _buildFrame() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Backdrop
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setDepth(1);

        // Main panel
        this.add.rectangle(CX, CY, GAME_WIDTH - 60, GAME_HEIGHT - 60, 0x0c0820)
            .setStrokeStyle(2, 0x6040a0).setDepth(2);

        // Panel title
        this.add.text(40, 22, 'Menu', {
            fontSize: '22px', color: hex(COLORS.accent), fontFamily: 'Georgia, serif', fontStyle: 'bold',
        }).setDepth(3);

        // Hint
        this.add.text(GAME_WIDTH - 40, GAME_HEIGHT - 22, 'M / Esc: Close    Arrow Keys: Navigate', {
            fontSize: '11px', color: hex(COLORS.muted), fontFamily: 'monospace',
        }).setOrigin(1, 1).setDepth(3);
    }

    _refresh() {
        this._container.removeAll(true);
        this._drawTabs();
        this._drawContent();
    }

    _drawTabs() {
        TABS.forEach((tab, i) => {
            const x   = 80 + i * 150;
            const sel = i === this._tabIdx;
            const bg  = this.add.rectangle(x, 60, 130, 32, sel ? 0x3a1860 : 0x150c30)
                .setStrokeStyle(1, sel ? 0xa07cff : 0x403060).setDepth(3);
            const lbl = this.add.text(x, 60, tab, {
                fontSize: '15px',
                color: sel ? hex(COLORS.accent) : hex(COLORS.muted),
                fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(4);
            this._container.add([bg, lbl]);
        });
    }

    _drawContent() {
        const contentY = 100;
        const tab = TABS[this._tabIdx];

        if (tab === 'Party')  this._drawParty(contentY);
        if (tab === 'Items')  this._drawItems(contentY);
        if (tab === 'Quests') this._drawQuests(contentY);
        if (tab === 'Map')    this._drawMap(contentY);
    }

    _drawParty(y) {
        state.party.forEach((id, i) => {
            const def = PARTY_DEFS[id];
            if (!def) return;
            const px = 80 + (i % 2) * 580;
            const py = y + Math.floor(i / 2) * 220;

            const card = this.add.rectangle(px + 250, py + 80, 500, 160, 0x150c2a).setStrokeStyle(1, 0x4a3070).setDepth(3);
            this._container.add(card);

            // Portrait
            this._container.add(this.add.text(px + 40, py + 60, def.portrait, { fontSize: '48px' }).setOrigin(0.5).setDepth(4));
            this._container.add(this.add.text(px + 40, py + 100, def.title, { fontSize: '10px', color: hex(COLORS.muted), fontFamily: 'monospace' }).setOrigin(0.5).setDepth(4));

            // Name + level
            this._container.add(this.add.text(px + 80, py + 24, `${def.name}  Lv.${state.level}`, {
                fontSize: '18px', color: def.color || hex(COLORS.accent), fontFamily: 'Georgia, serif', fontStyle: 'bold',
            }).setDepth(4));

            // Live HP/MP + scaled stats
            const curHp  = state.getHp(id);
            const curMp  = state.getMp(id);
            const maxHp  = state.getMaxHp(id);
            const maxMp  = state.getMaxMp(id);
            const sAtk   = state.getScaledStat(id, 'atk');
            const sDef   = state.getScaledStat(id, 'def');
            const sSpd   = state.getScaledStat(id, 'spd');

            const hpColor = curHp < maxHp * 0.3 ? '#ff5050' : curHp < maxHp * 0.6 ? '#ffcc44' : '#80ff80';
            const stats = [
                { label: `HP:  ${curHp} / ${maxHp}`,             color: hpColor },
                { label: `MP:  ${curMp} / ${maxMp}`,             color: '#8888ff' },
                { label: `ATK: ${sAtk}   DEF: ${sDef}   SPD: ${sSpd}`, color: hex(COLORS.text) },
            ];
            stats.forEach((s, si) => {
                this._container.add(this.add.text(px + 80, py + 50 + si * 22, s.label, {
                    fontSize: '13px', color: s.color, fontFamily: 'monospace',
                }).setDepth(4));
            });

            // HP/MP bars
            const barW = 280;
            this._drawBar(px + 80, py + 48, barW, 6, curHp, maxHp, 0x40cc40, 0x102010);
            this._drawBar(px + 80, py + 70, barW, 6, curMp, maxMp, 0x4080ff, 0x101030);

            // Abilities
            this._container.add(this.add.text(px + 80, py + 122, `Abilities: ${def.abilities.map(a => a.name).join(', ')}`, {
                fontSize: '11px', color: hex(COLORS.muted), fontFamily: 'monospace',
                wordWrap: { width: 380 },
            }).setDepth(4));
        });
    }

    _drawBar(x, y, w, h, val, max, fillColor, bgColor) {
        const ratio = Math.max(0, Math.min(1, val / max));
        this._container.add(this.add.rectangle(x + w / 2, y, w, h, bgColor).setOrigin(0.5).setDepth(4));
        if (ratio > 0) {
            this._container.add(this.add.rectangle(x + (w * ratio) / 2, y, w * ratio, h, fillColor).setOrigin(0.5).setDepth(4));
        }
    }

    _drawItems(y) {
        const inv = state.inventory;

        if (inv.length === 0) {
            this._container.add(this.add.text(GAME_WIDTH / 2, y + 80, 'Inventory is empty.', {
                fontSize: '16px', color: hex(COLORS.muted), fontFamily: 'Georgia, serif', fontStyle: 'italic',
            }).setOrigin(0.5).setDepth(4));
            return;
        }

        inv.forEach((entry, i) => {
            const def = getItem(entry.id);
            if (!def) return;
            const rowY  = y + i * 38;
            const sel   = i === this._listIdx;

            const bg = this.add.rectangle(GAME_WIDTH / 2, rowY + 16, GAME_WIDTH - 120, 34,
                sel ? 0x2a1848 : 0x100820).setDepth(3);
            this._container.add(bg);

            this._container.add(this.add.text(80, rowY + 4, `${def.icon}  ${def.name}  x${entry.qty}`, {
                fontSize: '15px', color: sel ? hex(COLORS.gold) : hex(COLORS.text), fontFamily: 'monospace',
            }).setDepth(4));

            this._container.add(this.add.text(500, rowY + 4, def.desc, {
                fontSize: '12px', color: hex(COLORS.muted), fontFamily: 'monospace',
            }).setDepth(4));
        });

        this._container.add(this.add.text(80, y + inv.length * 38 + 20,
            'Space/Enter: Use item  (consumables only)', {
                fontSize: '11px', color: hex(COLORS.muted), fontFamily: 'monospace',
            }).setDepth(4));
    }

    _drawQuests(y) {
        const active    = state.quests.active;
        const completed = state.quests.completed;

        let rowY = y;
        this._container.add(this.add.text(80, rowY, 'Active Quests', {
            fontSize: '16px', color: hex(COLORS.accent), fontFamily: 'Georgia, serif', fontStyle: 'bold',
        }).setDepth(4));
        rowY += 30;

        if (active.length === 0) {
            this._container.add(this.add.text(100, rowY, 'None.', { fontSize: '13px', color: hex(COLORS.muted), fontFamily: 'monospace' }).setDepth(4));
            rowY += 24;
        } else {
            for (const id of active) {
                const q = getQuest(id);
                if (!q) continue;
                this._container.add(this.add.text(100, rowY, `📋 ${q.title}`, { fontSize: '14px', color: hex(COLORS.gold), fontFamily: 'monospace' }).setDepth(4));
                rowY += 22;
                this._container.add(this.add.text(120, rowY, q.desc, {
                    fontSize: '11px', color: hex(COLORS.muted), fontFamily: 'monospace', wordWrap: { width: GAME_WIDTH - 200 },
                }).setDepth(4));
                rowY += 26;
            }
        }

        rowY += 16;
        this._container.add(this.add.text(80, rowY, 'Completed Quests', {
            fontSize: '16px', color: hex(COLORS.success), fontFamily: 'Georgia, serif', fontStyle: 'bold',
        }).setDepth(4));
        rowY += 28;

        if (completed.length === 0) {
            this._container.add(this.add.text(100, rowY, 'None yet.', { fontSize: '13px', color: hex(COLORS.muted), fontFamily: 'monospace' }).setDepth(4));
        } else {
            for (const id of completed) {
                const q = getQuest(id);
                if (!q) continue;
                this._container.add(this.add.text(100, rowY, `✅ ${q.title}`, { fontSize: '13px', color: hex(COLORS.muted), fontFamily: 'monospace' }).setDepth(4));
                rowY += 22;
            }
        }
    }

    _drawMap(y) {
        const mapName = getMap(state.currentMap)?.name || state.currentMap;
        const tx = state.playerTileX;
        const ty = state.playerTileY;

        this._container.add(this.add.text(GAME_WIDTH / 2, y + 40, mapName, {
            fontSize: '28px', color: hex(COLORS.accent), fontFamily: 'Georgia, serif', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(4));

        this._container.add(this.add.text(GAME_WIDTH / 2, y + 90, `Player position: (${tx}, ${ty})`, {
            fontSize: '14px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(4));

        this._container.add(this.add.text(GAME_WIDTH / 2, y + 130, `Chapter ${state.chapter}  |  Level ${state.level}  |  ${state.gold} gold`, {
            fontSize: '14px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(4));

        this._container.add(this.add.text(GAME_WIDTH / 2, y + 180, 'Press S to save your progress', {
            fontSize: '13px', color: hex(COLORS.muted), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(4));

        if (this._saveMsg) {
            this._container.add(this.add.text(GAME_WIDTH / 2, y + 210, this._saveMsg, {
                fontSize: '13px', color: hex(COLORS.success), fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(4));
        }
    }

    _setupInput() {
        this.input.keyboard.on('keydown', (e) => {
            const key = e.key;

            if (key === 'Escape' || key === 'm' || key === 'M') {
                this._close();
                return;
            }

            if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                this._tabIdx = (this._tabIdx - 1 + TABS.length) % TABS.length;
                this._listIdx = 0;
                playUiClick();
            } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                this._tabIdx = (this._tabIdx + 1) % TABS.length;
                this._listIdx = 0;
                playUiClick();
            }

            if (TABS[this._tabIdx] === 'Items') {
                const inv = state.inventory;
                if (key === 'ArrowDown' || key === 's') {
                    this._listIdx = Math.min(this._listIdx + 1, inv.length - 1);
                    playUiClick();
                } else if (key === 'ArrowUp' || key === 'w') {
                    this._listIdx = Math.max(0, this._listIdx - 1);
                    playUiClick();
                } else if (key === ' ' || key === 'Enter') {
                    this._useSelectedItem();
                }
            }

            if (TABS[this._tabIdx] === 'Map' && (key === 's' || key === 'S')) {
                const ok = saveGame();
                this._saveMsg = ok ? 'Game saved!' : 'Save failed.';
                playUiClick();
                this.time.delayedCall(2000, () => { this._saveMsg = null; this._refresh(); });
            }

            this._refresh();
        });
    }

    _useSelectedItem() {
        const inv  = state.inventory;
        const entry = inv[this._listIdx];
        if (!entry) return;
        const def = getItem(entry.id);
        if (!def || !def.usable) return;

        // Simple: consumable heal/restore on first alive party member
        if (def.effect.heal) {
            // In a real implementation, open target picker — simplified for Phase 1
            events.emit('healPartyMember', { memberId: state.party[0], amount: def.effect.heal });
            state.removeItem(entry.id);
        } else if (def.effect.mpRestore) {
            events.emit('restoreMPMember', { memberId: state.party[0], amount: def.effect.mpRestore });
            state.removeItem(entry.id);
        }
    }

    _close() {
        state.isPaused = false;
        playUiClick();
        this.scene.stop('MenuScene');
        this.scene.resume(this._caller);
    }

    shutdown() {
        this.input.keyboard.off('keydown');
    }
}
