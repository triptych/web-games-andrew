/**
 * CharacterScene.js — Character screen (game-plan §UI / §8 / §10).
 *
 * Tabbed modal openable from the run map (B key) and from mid-level pause.
 * Tabs: Inventory (consumables), Stats, Skill Tree.
 *
 * Received data: { returnTo: 'MapScene' | 'GameScene' }
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { ITEM_DEFS } from './items.js';
import { SKILL_DEFS, canUnlock, unlock, isUnlocked } from './skilltree.js';
import { state }     from './state.js';
import { events }    from './events.js';
import { playUiClick, playSkillUnlock } from './sounds.js';

function hex(arr)      { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const PANEL_W = 760;
const PANEL_H = 540;
const PANEL_X = (GAME_WIDTH  - PANEL_W) / 2;
const PANEL_Y = (GAME_HEIGHT - PANEL_H) / 2;

const TABS  = ['INVENTORY', 'STATS', 'SKILL TREE'];
const TAB_W = 140;

// ── Skill tree layout ─────────────────────────────────────────────────────────
// Position each node in the panel-local space (relative to content origin).
// Three branches across a ~700×380 canvas area inside the panel.
const CONTENT_X = PANEL_X + 20;
const CONTENT_Y = PANEL_Y + 100;

// Node positions, keyed by skill id. Laid out as a mind-map in 3 columns.
const NODE_POS = {
    // Efficiency branch (left)
    tile_swap:        { x: 100, y: 80  },
    steady_hand:      { x: 30,  y: 200 },
    catalyst_affinity:{ x: 170, y: 200 },
    // Insight branch (center)
    deep_sight:       { x: 360, y: 80  },
    surveyor:         { x: 290, y: 200 },
    vein_sense:       { x: 430, y: 200 },
    // Power branch (right)
    surge:            { x: 600, y: 80  },
    overflow:         { x: 530, y: 200 },
    reclaim:          { x: 670, y: 200 },
};

// Branch header label positions
const BRANCH_LABELS = [
    { label: 'EFFICIENCY', x: 100, y: 20 },
    { label: 'INSIGHT',    x: 360, y: 20 },
    { label: 'POWER',      x: 600, y: 20 },
];

export class CharacterScene extends Scene {
    constructor() { super({ key: 'CharacterScene' }); }

    create(data) {
        data = data || {};
        this._returnTo = data.returnTo || 'MapScene';
        this._activeTab = data.tab || 0;
        this._selectedSkillId = null;

        // ── Background dim ────────────────────────────────────────────────
        const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT, 0x000000);
        dim.setAlpha(0.65);

        // ── Panel ─────────────────────────────────────────────────────────
        const gfx = this.add.graphics();
        gfx.fillStyle(toHexInt(COLORS.panel), 0.98);
        gfx.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);
        gfx.lineStyle(2, toHexInt(COLORS.gold), 0.85);
        gfx.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);

        // ── Title bar ─────────────────────────────────────────────────────
        this.add.text(PANEL_X + 24, PANEL_Y + 20,
            '◈  THE ALCHEMIST', {
            fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.gold),
        });

        // ── Close button ──────────────────────────────────────────────────
        const closeTxt = this.add.text(PANEL_X + PANEL_W - 20, PANEL_Y + 20,
            '[ CLOSE ]', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeTxt.on('pointerdown', () => this._close());
        closeTxt.on('pointerover', () => closeTxt.setColor(hex(COLORS.gold)));
        closeTxt.on('pointerout',  () => closeTxt.setColor(hex(COLORS.brass)));

        // ── Tab bar ───────────────────────────────────────────────────────
        this._tabGfx   = this.add.graphics();
        this._tabTexts = [];
        const tabY = PANEL_Y + 52;
        TABS.forEach((label, i) => {
            const tx = PANEL_X + 24 + i * (TAB_W + 8);
            const t = this.add.text(tx + TAB_W / 2, tabY + 16, label, {
                fontSize: '12px', fontFamily: 'monospace',
                color: hex(COLORS.parchment),
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            t.on('pointerdown', () => { playUiClick(); this._switchTab(i); });
            t.on('pointerover', () => { if (i !== this._activeTab) t.setColor(hex(COLORS.gold)); });
            t.on('pointerout',  () => { if (i !== this._activeTab) t.setColor(hex(COLORS.parchment)); });
            this._tabTexts.push(t);
        });

        // ── Content area ──────────────────────────────────────────────────
        this._contentObjects = [];
        this._drawTabBg();
        this._buildTab(this._activeTab);

        // ── Keyboard ──────────────────────────────────────────────────────
        this.input.keyboard.on('keydown-ESC', () => this._close());
        this.input.keyboard.on('keydown-B',   () => this._close());

        // Listen for item/XP changes so live tabs refresh.
        this._offs = [];
        this._offs.push(events.on('itemCountChanged', () => {
            if (this._activeTab === 0) { this._clearContent(); this._buildInventoryTab(); }
        }));
        this._offs.push(events.on('xpChanged', () => {
            if (this._activeTab === 1) { this._clearContent(); this._buildStatsTab(); }
            if (this._activeTab === 2) { this._clearContent(); this._buildSkillTreeTab(); }
        }));
        this._offs.push(events.on('skillUnlocked', () => {
            if (this._activeTab === 2) { this._clearContent(); this._buildSkillTreeTab(); }
        }));
        this.events.on('shutdown', () => { this._offs.forEach(off => off()); this._offs = []; });
    }

    // ── Tab management ────────────────────────────────────────────────────────

    _drawTabBg() {
        const tabY = PANEL_Y + 52;
        this._tabGfx.clear();
        TABS.forEach((label, i) => {
            const tx = PANEL_X + 24 + i * (TAB_W + 8);
            const isActive = i === this._activeTab;
            this._tabGfx.fillStyle(
                isActive ? toHexInt(COLORS.panelEdge) : toHexInt(COLORS.bg), 0.85);
            this._tabGfx.fillRoundedRect(tx, tabY, TAB_W, 32, { tl: 5, tr: 5, bl: 0, br: 0 });
            if (isActive) {
                this._tabGfx.lineStyle(1.5, toHexInt(COLORS.gold), 0.7);
                this._tabGfx.strokeRoundedRect(tx, tabY, TAB_W, 32, { tl: 5, tr: 5, bl: 0, br: 0 });
            }
            this._tabTexts[i].setColor(isActive ? hex(COLORS.gold) : hex(COLORS.parchment));
        });
        this._tabGfx.lineStyle(1, toHexInt(COLORS.panelEdge), 0.7);
        this._tabGfx.lineBetween(PANEL_X + 16, tabY + 32, PANEL_X + PANEL_W - 16, tabY + 32);
    }

    _switchTab(i) {
        this._activeTab = i;
        this._selectedSkillId = null;
        this._drawTabBg();
        this._clearContent();
        this._buildTab(i);
    }

    _clearContent() {
        for (const obj of this._contentObjects) obj.destroy();
        this._contentObjects = [];
    }

    _buildTab(i) {
        if (i === 0)      this._buildInventoryTab();
        else if (i === 1) this._buildStatsTab();
        else              this._buildSkillTreeTab();
    }

    // ── Inventory tab ─────────────────────────────────────────────────────────

    _buildInventoryTab() {
        const startY = PANEL_Y + 104;
        const cx     = PANEL_X + 24;

        const header = this.add.text(cx, startY, 'CONSUMABLES  (one-off — buy more at a shop)', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._contentObjects.push(header);

        const ITEM_W = 150;
        const ITEM_H = 82;
        const GAP    = 12;
        const cols   = 4;

        ITEM_DEFS.forEach((item, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const ix  = cx + col * (ITEM_W + GAP);
            const iy  = startY + 28 + row * (ITEM_H + GAP);

            const count    = state.itemCount(item.id);
            const hasItem  = count > 0;
            const bgAlpha  = hasItem ? 0.35 : 0.12;
            const textCol  = hasItem ? hex(COLORS.parchment) : hex(COLORS.textDim);

            const bg = this.add.graphics();
            bg.fillStyle(toHexInt(COLORS.panelEdge), bgAlpha);
            bg.fillRoundedRect(ix, iy, ITEM_W, ITEM_H, 6);
            if (hasItem) {
                bg.lineStyle(1.5, toHexInt(COLORS.brass), 0.5);
                bg.strokeRoundedRect(ix, iy, ITEM_W, ITEM_H, 6);
            }
            this._contentObjects.push(bg);

            const glyph = this.add.text(ix + ITEM_W / 2, iy + 16, item.glyph, {
                fontSize: '20px', fontFamily: 'monospace',
                color: hasItem ? hex(COLORS.gold) : hex(COLORS.textDim),
            }).setOrigin(0.5);
            this._contentObjects.push(glyph);

            const name = this.add.text(ix + ITEM_W / 2, iy + 40, item.name, {
                fontSize: '11px', fontFamily: 'monospace', color: textCol,
                wordWrap: { width: ITEM_W - 8 }, align: 'center',
            }).setOrigin(0.5);
            this._contentObjects.push(name);

            const cntStr = hasItem ? `×${count}` : '×0';
            const cnt = this.add.text(ix + ITEM_W / 2, iy + 62, cntStr, {
                fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
                color: hasItem ? hex(COLORS.gold) : hex(COLORS.textDim),
            }).setOrigin(0.5);
            this._contentObjects.push(cnt);
        });

        const hint = this.add.text(cx, startY + 28 + ITEM_H + GAP + 14,
            'Items are used from the item bar during a level.', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });
        this._contentObjects.push(hint);
    }

    // ── Stats tab ─────────────────────────────────────────────────────────────

    _buildStatsTab() {
        const startY = PANEL_Y + 110;
        const cx     = PANEL_X + 36;
        const lh     = 30;

        const lines = [
            [`XP`,             `${state.xp} XP`],
            [`Currency`,       `${state.currency} grams`],
            [`Cauldron`,       `Tier ${state.cauldronTier}`],
            [`Chapter`,        `${state.runChapter}`],
            [`Tiles unlocked`, `${state.unlockedTypes.size}`],
            [`Skills unlocked`,`${state.unlockedSkills.size} / ${SKILL_DEFS.length}`],
        ];

        const hdr = this.add.text(cx, startY - 20, 'THE ALCHEMIST\'S LEDGER', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._contentObjects.push(hdr);

        const divGfx = this.add.graphics();
        divGfx.lineStyle(1, toHexInt(COLORS.panelEdge), 0.5);
        divGfx.lineBetween(cx, startY, PANEL_X + PANEL_W - 36, startY);
        this._contentObjects.push(divGfx);

        lines.forEach(([label, value], i) => {
            const y = startY + 12 + i * lh;
            const labelTxt = this.add.text(cx, y, label, {
                fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            });
            const valueTxt = this.add.text(PANEL_X + PANEL_W - 36, y, value, {
                fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
                color: hex(COLORS.parchment),
            }).setOrigin(1, 0);
            this._contentObjects.push(labelTxt, valueTxt);
        });

        // XP bar
        const barY = startY + 12 + lines.length * lh + 8;
        const barW = PANEL_W - 72;
        const xpBarGfx = this.add.graphics();
        xpBarGfx.fillStyle(toHexInt(COLORS.panelEdge), 0.7);
        xpBarGfx.fillRoundedRect(cx, barY, barW, 16, 4);
        // Fill proportional to XP (show relative to next milestone every 200 XP)
        const milestone = Math.max(200, Math.ceil(state.xp / 200) * 200);
        const fill = Math.min(1, state.xp / milestone);
        if (fill > 0) {
            xpBarGfx.fillStyle(toHexInt(COLORS.gold), 0.85);
            xpBarGfx.fillRoundedRect(cx, barY, Math.round(barW * fill), 16, 4);
        }
        const xpLabel = this.add.text(cx + barW / 2, barY + 8,
            `${state.xp} XP`, {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.bg),
        }).setOrigin(0.5);
        this._contentObjects.push(xpBarGfx, xpLabel);

        // Items summary
        const ownedY = barY + 36;
        const ownedHdr = this.add.text(cx, ownedY, 'CONSUMABLES IN INVENTORY', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._contentObjects.push(ownedHdr);

        let anyItems = false;
        let rowIdx = 0;
        ITEM_DEFS.forEach((item) => {
            const count = state.itemCount(item.id);
            if (count === 0) return;
            anyItems = true;
            const row = this.add.text(cx, ownedY + 22 + rowIdx * 22,
                `${item.glyph}  ${item.name.padEnd(18)} ×${count}`, {
                fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.parchment),
            });
            this._contentObjects.push(row);
            rowIdx++;
        });
        if (!anyItems) {
            const none = this.add.text(cx, ownedY + 22, 'No items yet. Visit a shop node!', {
                fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            });
            this._contentObjects.push(none);
        }
    }

    // ── Skill Tree tab ────────────────────────────────────────────────────────

    _buildSkillTreeTab() {
        const ox = CONTENT_X;
        const oy = CONTENT_Y;

        // XP readout
        const xpTxt = this.add.text(PANEL_X + PANEL_W - 24, PANEL_Y + 92,
            `✦ ${state.xp} XP to spend`, {
            fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.gold),
        }).setOrigin(1, 0);
        this._contentObjects.push(xpTxt);

        // Branch labels
        for (const b of BRANCH_LABELS) {
            const t = this.add.text(ox + b.x, oy + b.y, b.label, {
                fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            }).setOrigin(0.5);
            this._contentObjects.push(t);
        }

        // Draw edges (prerequisite lines) first so nodes sit on top
        const edgeGfx = this.add.graphics();
        this._contentObjects.push(edgeGfx);
        edgeGfx.lineStyle(1.5, toHexInt(COLORS.panelEdge), 0.6);
        for (const skill of SKILL_DEFS) {
            const toPos = NODE_POS[skill.id];
            for (const prereqId of skill.prereqs) {
                const fromPos = NODE_POS[prereqId];
                if (!fromPos || !toPos) continue;
                // Brighter edge if both are unlocked
                const bothUnlocked = isUnlocked(skill.id) && isUnlocked(prereqId);
                edgeGfx.lineStyle(bothUnlocked ? 2 : 1.5,
                    bothUnlocked ? toHexInt(COLORS.gold) : toHexInt(COLORS.panelEdge),
                    bothUnlocked ? 0.8 : 0.45);
                edgeGfx.lineBetween(
                    ox + fromPos.x, oy + fromPos.y,
                    ox + toPos.x,   oy + toPos.y);
            }
        }

        // Draw nodes
        this._skillNodeObjs = {};
        for (const skill of SKILL_DEFS) {
            this._drawSkillNode(skill, ox, oy);
        }

        // Info / unlock panel at the bottom
        this._skillInfoGfx = this.add.graphics();
        this._skillInfoTxt = this.add.text(
            PANEL_X + 24, PANEL_Y + PANEL_H - 100, '', {
            fontSize: '12px', fontFamily: 'monospace',
            color: hex(COLORS.parchment), wordWrap: { width: PANEL_W - 180 },
        });
        this._unlockBtn = this._makeUnlockBtn();
        this._contentObjects.push(this._skillInfoGfx, this._skillInfoTxt, this._unlockBtn);

        if (this._selectedSkillId) this._selectSkill(this._selectedSkillId);
    }

    _drawSkillNode(skill, ox, oy) {
        const pos       = NODE_POS[skill.id];
        if (!pos) return;
        const nx        = ox + pos.x;
        const ny        = oy + pos.y;
        const R         = 28;
        const unlocked  = isUnlocked(skill.id);
        const available = !unlocked && canUnlock(skill.id);
        // locked = prereqs not met OR not enough XP

        const nodeGfx = this.add.graphics();
        // Outer ring
        nodeGfx.lineStyle(unlocked ? 2.5 : 1.5,
            unlocked  ? toHexInt(COLORS.gold) :
            available ? toHexInt(COLORS.brass) :
                        toHexInt(COLORS.panelEdge),
            unlocked ? 1 : available ? 0.8 : 0.4);
        nodeGfx.strokeCircle(nx, ny, R);
        // Fill
        nodeGfx.fillStyle(
            unlocked  ? toHexInt(COLORS.panel) :
            available ? toHexInt(COLORS.bg) :
                        toHexInt(COLORS.bg), unlocked ? 0.95 : 0.5);
        nodeGfx.fillCircle(nx, ny, R - 1);

        const glyphTxt = this.add.text(nx, ny - 6, skill.glyph, {
            fontSize: '18px', fontFamily: 'monospace',
            color: unlocked ? hex(COLORS.gold) : available ? hex(COLORS.brass) : hex(COLORS.textDim),
        }).setOrigin(0.5);

        const nameTxt = this.add.text(nx, ny + 12, skill.name, {
            fontSize: '8px', fontFamily: 'monospace',
            color: unlocked ? hex(COLORS.parchment) : available ? hex(COLORS.textDim) : hex(COLORS.textDim),
        }).setOrigin(0.5);

        // State indicator dot
        const dotColor = unlocked ? 0x88ff88 : available ? 0xccaa44 : 0x445566;
        const dot = this.add.circle(nx + R - 6, ny - R + 6, 5, dotColor);

        // Hit area for interaction
        const hitZone = this.add.circle(nx, ny, R + 4, 0xffffff, 0);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this._selectSkill(skill.id));
        hitZone.on('pointerover', () => {
            nodeGfx.clear();
            nodeGfx.lineStyle(2.5, toHexInt(COLORS.gold), 0.9);
            nodeGfx.strokeCircle(nx, ny, R);
            nodeGfx.fillStyle(toHexInt(COLORS.panelEdge), 0.6);
            nodeGfx.fillCircle(nx, ny, R - 1);
        });
        hitZone.on('pointerout', () => {
            nodeGfx.clear();
            nodeGfx.lineStyle(unlocked ? 2.5 : 1.5,
                unlocked  ? toHexInt(COLORS.gold) :
                available ? toHexInt(COLORS.brass) :
                            toHexInt(COLORS.panelEdge),
                unlocked ? 1 : available ? 0.8 : 0.4);
            nodeGfx.strokeCircle(nx, ny, R);
            nodeGfx.fillStyle(
                unlocked ? toHexInt(COLORS.panel) : toHexInt(COLORS.bg),
                unlocked ? 0.95 : 0.5);
            nodeGfx.fillCircle(nx, ny, R - 1);
        });

        this._contentObjects.push(nodeGfx, glyphTxt, nameTxt, dot, hitZone);
        this._skillNodeObjs[skill.id] = { nodeGfx, glyphTxt, nameTxt, dot };
    }

    _makeUnlockBtn() {
        const bx = PANEL_X + PANEL_W - 150;
        const by = PANEL_Y + PANEL_H - 95;
        const bw = 120;
        const bh = 36;

        const btnGfx = this.add.graphics();
        btnGfx.fillStyle(toHexInt(COLORS.panelEdge), 0.5);
        btnGfx.fillRoundedRect(bx, by, bw, bh, 6);
        btnGfx.lineStyle(1.5, toHexInt(COLORS.gold), 0.7);
        btnGfx.strokeRoundedRect(bx, by, bw, bh, 6);
        btnGfx.setVisible(false);

        const btnTxt = this.add.text(bx + bw / 2, by + bh / 2, 'UNLOCK', {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.gold),
        }).setOrigin(0.5).setVisible(false);

        const hitZone = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh, 0xffffff, 0);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.setVisible(false);
        hitZone.on('pointerdown', () => this._tryUnlock());
        hitZone.on('pointerover', () => {
            btnGfx.clear();
            btnGfx.fillStyle(toHexInt(COLORS.gold), 0.2);
            btnGfx.fillRoundedRect(bx, by, bw, bh, 6);
            btnGfx.lineStyle(2, toHexInt(COLORS.gold), 1);
            btnGfx.strokeRoundedRect(bx, by, bw, bh, 6);
        });
        hitZone.on('pointerout', () => {
            btnGfx.clear();
            btnGfx.fillStyle(toHexInt(COLORS.panelEdge), 0.5);
            btnGfx.fillRoundedRect(bx, by, bw, bh, 6);
            btnGfx.lineStyle(1.5, toHexInt(COLORS.gold), 0.7);
            btnGfx.strokeRoundedRect(bx, by, bw, bh, 6);
        });

        this._unlockBtnParts = { btnGfx, btnTxt, hitZone };
        return btnTxt; // dummy return — parts tracked separately
    }

    _selectSkill(skillId) {
        this._selectedSkillId = skillId;
        const def       = SKILL_DEFS.find(s => s.id === skillId);
        if (!def) return;
        const unlocked  = isUnlocked(skillId);
        const available = !unlocked && canUnlock(skillId);

        // Info text
        const stateStr = unlocked ? '● UNLOCKED' : available ? '○ AVAILABLE' : '· LOCKED';
        const costStr  = unlocked ? '' : `  cost: ${def.xpCost} XP`;
        const prereqStr = def.prereqs.length
            ? `  requires: ${def.prereqs.join(', ')}`
            : '';
        const typeStr  = def.type === 'activated'
            ? `  [activated · cooldown: ${def.oncePerLevel ? 'once/level' : def.cooldown + ' placements'}]`
            : '  [always-on]';

        this._skillInfoTxt.setText(
            `${def.glyph}  ${def.name.toUpperCase()}  ${stateStr}${costStr}${prereqStr}\n` +
            `${def.desc}${typeStr}\n` +
            `${def.flavor}`
        );

        // Show/hide unlock button
        const show = available && !unlocked;
        if (this._unlockBtnParts) {
            this._unlockBtnParts.btnGfx.setVisible(show);
            this._unlockBtnParts.btnTxt.setVisible(show);
            this._unlockBtnParts.hitZone.setVisible(show);
        }

        playUiClick();
    }

    _tryUnlock() {
        if (!this._selectedSkillId) return;
        const ok = unlock(this._selectedSkillId);
        if (ok) {
            playSkillUnlock();
            // Rebuild tree to reflect new state
            this._clearContent();
            this._buildSkillTreeTab();
        }
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    _close() {
        playUiClick();
        if (this._returnTo === 'GameScene') {
            this.scene.stop('CharacterScene');
            const gs = this.scene.get('GameScene');
            if (gs && this.scene.isPaused('GameScene')) this.scene.resume('GameScene');
        } else {
            this.scene.start('MapScene');
        }
    }
}
