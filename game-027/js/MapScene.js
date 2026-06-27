/**
 * MapScene.js — Run map screen (game-plan §9).
 *
 * Displays the chapter's procedural DAG map. The player clicks a forward
 * (reachable) node to commit their route and enter that node's content.
 *
 * Received data (from SplashScene or ResultScene):
 *   { fromNodeId?: string }  — the just-completed node; omit for entry.
 *
 * State used:
 *   state.runMap          — { mapData, currentNodeId, visitedIds, committedPath }
 *   state.currency / xp / cauldronTier — shown in header bar
 *
 * Node states:
 *   visited  — already completed (dimmed, locked)
 *   current  — the node just cleared (highlighted with a ✓)
 *   forward  — clickable choices
 *   other    — reachable but not yet forward (dim)
 *   unreachable — never reachable from current path (greyed)
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state } from './state.js';
import { generateMap, getForwardNodeIds, getNodeDef, getReachableIds, NODE_META, nodeToScene } from './map.js';
import { playUiClick } from './sounds.js';

function hex(arr) {
    return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

// Map display area (inside the full 1280×720 canvas)
const MAP_X    = 80;
const MAP_Y    = 90;
const MAP_W    = GAME_WIDTH  - 160;
const MAP_H    = GAME_HEIGHT - 160;

const NODE_R   = 26;   // circle radius
const EDGE_CLR = 0x8b7355;

export class MapScene extends Scene {
    constructor() { super({ key: 'MapScene' }); }

    create(data) {
        data = data || {};

        // ── Ensure run map exists in state ─────────────────────────────────
        if (!state.runMap) {
            // First time entering the map this run — generate it.
            const seed    = state.runSeed;
            const chapter = state.runChapter;
            const mapData = generateMap(seed, chapter);
            state.initRunMap(mapData);
        }

        const { mapData, currentNodeId, visitedIds } = state.runMap;

        // Forward candidates from current position
        const forwardIds = currentNodeId
            ? new Set(getForwardNodeIds(mapData, currentNodeId))
            : new Set([mapData.entryNodeId]);

        // All reachable from entry (for dimming truly unreachable branches)
        const reachable = getReachableIds(mapData, mapData.entryNodeId);

        // ── Background ────────────────────────────────────────────────────
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT, toHexInt(COLORS.bg));

        // Header panel
        const hdr = this.add.graphics();
        hdr.fillStyle(toHexInt(COLORS.panel), 0.95);
        hdr.fillRect(0, 0, GAME_WIDTH, 56);
        hdr.lineStyle(1, toHexInt(COLORS.panelEdge), 0.7);
        hdr.lineBetween(0, 56, GAME_WIDTH, 56);

        // Title
        this.add.text(GAME_WIDTH / 2, 28,
            `CHAPTER ${state.runChapter}  —  THE ALCHEMIST'S PATH`, {
            fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.parchment),
        }).setOrigin(0.5);

        // Stats row
        this.add.text(24, 28,
            `💰 ${state.currency} grams   ⭐ ${state.xp} XP   ⚗ Tier ${state.cauldronTier}`, {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.gold),
        }).setOrigin(0, 0.5);

        // Key hints
        this.add.text(GAME_WIDTH - 24, 28, 'C — Cauldron   B — Character', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(1, 0.5);

        // Instruction text
        const instrY = GAME_HEIGHT - 28;
        this.add.text(GAME_WIDTH / 2, instrY,
            forwardIds.size ? 'Choose your next node — click a highlighted destination' : 'BOSS CLEARED — chapter complete!', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        }).setOrigin(0.5);

        // ── Draw edges ────────────────────────────────────────────────────
        const edgeGfx = this.add.graphics();
        for (const { from, to } of mapData.edges) {
            const fn = getNodeDef(mapData, from);
            const tn = getNodeDef(mapData, to);
            const fx = MAP_X + fn.x * MAP_W;
            const fy = MAP_Y + fn.y * MAP_H;
            const tx = MAP_X + tn.x * MAP_W;
            const ty = MAP_Y + tn.y * MAP_H;

            // Highlight edges leading to forward nodes
            const isHot = currentNodeId === from && forwardIds.has(to);
            edgeGfx.lineStyle(isHot ? 2 : 1, isHot ? 0xd4a853 : EDGE_CLR, isHot ? 0.75 : 0.35);
            edgeGfx.lineBetween(fx, fy, tx, ty);
        }

        // ── Draw nodes ────────────────────────────────────────────────────
        this._nodeHitAreas = []; // { nodeId, cx, cy, r, forward }

        for (const layer of mapData.layers) {
            for (const node of layer) {
                const cx = MAP_X + node.x * MAP_W;
                const cy = MAP_Y + node.y * MAP_H;

                const isVisited  = visitedIds.has(node.id);
                const isCurrent  = node.id === currentNodeId;
                const isForward  = forwardIds.has(node.id);
                const isReach    = reachable.has(node.id);

                this._drawNode(node, cx, cy, isVisited, isCurrent, isForward, isReach);

                if (isForward) {
                    this._nodeHitAreas.push({ nodeId: node.id, cx, cy, r: NODE_R + 8 });
                }
            }
        }

        // ── Input ─────────────────────────────────────────────────────────
        this.input.on('pointerdown', (p) => this._onPointerDown(p, forwardIds, mapData));
        this.input.on('pointermove', (p) => this._onPointerMove(p));

        // Fire ch1-intro VN dialog on first ever map visit.
        this._maybeLaunchPendingIntro();

        this.input.keyboard.on('keydown-C', () => {
            playUiClick();
            this.scene.start('CauldronScene', { readOnly: false, returnTo: 'MapScene' });
        });
        // B — character screen (inventory / stats).
        this.input.keyboard.on('keydown-B', () => {
            playUiClick();
            this.scene.start('CharacterScene', { returnTo: 'MapScene' });
        });
        this.input.keyboard.on('keydown-ESC', () => {
            playUiClick();
            this.scene.start('SplashScene');
        });

        // Tooltip container (updated on hover)
        this._tooltip = this.add.text(0, 0, '', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.parchment),
            backgroundColor: '#' + toHexInt(COLORS.panel).toString(16).padStart(6, '0'),
            padding: { x: 8, y: 5 },
        }).setDepth(10).setVisible(false);
    }

    // ── Node renderer ──────────────────────────────────────────────────────

    _drawNode(node, cx, cy, isVisited, isCurrent, isForward, isReach) {
        const meta = NODE_META[node.type] || NODE_META.explore;
        const gfx  = this.add.graphics();

        // Alpha / glow based on state
        let bgAlpha  = 0.9;
        let ringAlpha = 0.85;
        let iconAlpha = 1;

        if (isVisited && !isCurrent) {
            bgAlpha = 0.4; ringAlpha = 0.35; iconAlpha = 0.45;
        } else if (!isReach) {
            bgAlpha = 0.18; ringAlpha = 0.12; iconAlpha = 0.2;
        } else if (!isForward && !isCurrent && !isVisited) {
            bgAlpha = 0.55; ringAlpha = 0.45; iconAlpha = 0.6;
        }

        // Outer glow ring for forward nodes
        if (isForward) {
            gfx.lineStyle(3, 0xf9ca24, 0.9);
            gfx.strokeCircle(cx, cy, NODE_R + 6);
        }

        // Current node done-ring
        if (isCurrent) {
            gfx.lineStyle(3, 0x6ab04c, 0.85);
            gfx.strokeCircle(cx, cy, NODE_R + 4);
        }

        // Fill circle
        gfx.fillStyle(toHexInt(COLORS.panel), bgAlpha);
        gfx.fillCircle(cx, cy, NODE_R);
        gfx.lineStyle(2, meta.color, ringAlpha);
        gfx.strokeCircle(cx, cy, NODE_R);

        // Icon
        const iconStyle = {
            fontSize: node.type === 'boss' ? '18px' : '16px',
            fontFamily: 'monospace',
            color: '#' + meta.color.toString(16).padStart(6, '0'),
            alpha: iconAlpha,
        };
        this.add.text(cx, cy - (isVisited && !isCurrent ? 0 : 2), meta.icon, iconStyle)
            .setOrigin(0.5)
            .setAlpha(iconAlpha);

        // Label below node
        const labelColor = isForward
            ? hex(COLORS.parchment)
            : isVisited
                ? hex(COLORS.textDim)
                : hex(COLORS.textDim);

        this.add.text(cx, cy + NODE_R + 8, meta.label, {
            fontSize: '10px', fontFamily: 'monospace', color: labelColor,
        }).setOrigin(0.5).setAlpha(iconAlpha);

        // ✓ badge on visited nodes
        if (isVisited && !isCurrent) {
            this.add.text(cx + NODE_R - 4, cy - NODE_R + 4, '✓', {
                fontSize: '10px', fontFamily: 'monospace', color: hex(COLORS.success),
            }).setOrigin(0.5);
        }

        // CURRENT badge
        if (isCurrent) {
            this.add.text(cx, cy - NODE_R - 14, '◀ HERE', {
                fontSize: '9px', fontFamily: 'monospace', color: hex(COLORS.gold),
            }).setOrigin(0.5);
        }
    }

    // ── Interaction ───────────────────────────────────────────────────────

    _onPointerDown(p, forwardIds, mapData) {
        for (const { nodeId, cx, cy, r } of this._nodeHitAreas) {
            const dx = p.x - cx, dy = p.y - cy;
            if (dx * dx + dy * dy <= r * r) {
                playUiClick();
                this._commitNode(nodeId, mapData);
                return;
            }
        }
    }

    _onPointerMove(p) {
        let hit = null;
        for (const area of this._nodeHitAreas) {
            const dx = p.x - area.cx, dy = p.y - area.cy;
            if (dx * dx + dy * dy <= (area.r) * (area.r)) { hit = area; break; }
        }
        if (!hit) { this._tooltip.setVisible(false); return; }
        const node = getNodeDef(state.runMap.mapData, hit.nodeId);
        const meta = NODE_META[node.type];
        this._tooltip
            .setText(`${meta.icon} ${meta.label}`)
            .setPosition(hit.cx + NODE_R + 4, hit.cy - 10)
            .setVisible(true);
    }

    _commitNode(nodeId, mapData) {
        // Advance state
        state.commitNode(nodeId);

        const node = getNodeDef(mapData, nodeId);

        // Resolve to which Phaser scene to launch
        if (node.type === 'shop') {
            // Phase 8: launch the real ShopScene.
            this.scene.start('ShopScene', { nodeId });
            return;
        }

        if (node.type === 'cache') {
            // Cache/event: pick a flavor script that hasn't been seen yet (or cycle).
            const CACHE_SCRIPTS = [
                'cache-spirit-1', 'cache-rival-1', 'cache-vendor-1',
                'cache-spirit-2', 'cache-spirit-3', 'cache-rival-2',
                'cache-vendor-2', 'cache-spirit-4', 'cache-guildmaster-1',
            ];
            const unseen = CACHE_SCRIPTS.filter(id => !state.hasSeenScript(id));
            const scriptId = unseen.length > 0 ? unseen[0] : CACHE_SCRIPTS[0];
            this.scene.start('VNScene', {
                scriptId,
                nodeId,
                pauseScenes: [],
                onComplete: () => {
                    state.resolveNode(nodeId);
                    this.scene.start('MapScene');
                },
            });
            return;
        }

        // Boss node: fire a chapter-specific pre-boss taunt (one-shot) then launch.
        if (node.type === 'boss') {
            const tautId = `ch${state.runChapter}-boss-taunt`;
            if (!state.hasSeenScript(tautId)) {
                this.scene.start('VNScene', {
                    scriptId: tautId,
                    pauseScenes: [],
                    onComplete: () => {
                        this.scene.start('GameScene', { nodeId: node.id, nodeType: node.type });
                        this.scene.launch('UIScene');
                    },
                });
                return;
            }
        }

        // Puzzle nodes (explore / refine / battle / elite)
        this.scene.start('GameScene', { nodeId: node.id, nodeType: node.type });
        this.scene.launch('UIScene');
    }

    _maybeLaunchPendingIntro() {
        const scriptId = state.getDialogFlag('pendingIntro');
        if (!scriptId) return;
        state.setDialogFlag('pendingIntro', null);
        this.time.delayedCall(300, () => {
            if (!this.scene.isActive('MapScene')) return;
            this.scene.launch('VNScene', {
                scriptId,
                pauseScenes: ['MapScene'],
                onComplete:  () => {
                    this.scene.resume('MapScene');
                },
            });
        });
    }

}
