/**
 * MapScene — Tile-based overworld / dungeon exploration.
 *
 * Renders the active map, handles player movement, NPC interaction,
 * random encounters, and exits to other maps.
 *
 * Communicates via EventBus:
 *   Emits: 'battleStart', 'dialogStart', 'sceneTransition'
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, COLORS } from './config.js';
import { getMap, isWalkable } from './maps.js';
import { getNPC } from './dialog.js';
import { ENCOUNTER_GROUPS } from './characters.js';
import { playFootstep, playBattleStart } from './sounds.js';

// Tile color palette for procedural rendering (no sprite sheets yet)
const TILE_COLORS = {
    0: 0x3a6b2a,   // grass
    1: 0x7a6550,   // floor (stone)
    2: 0x302828,   // wall
    3: 0x2040a0,   // water
    4: 0x1a4010,   // tree
    5: 0x9a8060,   // path
    6: 0x806040,   // door
    7: 0x3a2858,   // ruins floor
    8: 0x080510,   // void
};
const TILE_BORDER = {
    2: 0x504040,
    4: 0x254d18,
};

export class MapScene extends Phaser.Scene {
    constructor() { super({ key: 'MapScene' }); }

    init(data) {
        this._mapId = data.mapId || state.currentMap;
        this._startTx = data.tx ?? state.playerTileX;
        this._startTy = data.ty ?? state.playerTileY;
    }

    create() {
        this._map = getMap(this._mapId);
        state.setMap(this._mapId, this._startTx, this._startTy);

        this._tileGfx   = [];
        this._npcSprites = {};
        this._moveTimer  = 0;
        this._moveCooldown = 0.18;   // seconds between moves
        this._stepCount  = 0;

        this._buildMap();
        this._buildNPCs();

        // Player sprite must exist before _setupCamera calls startFollow
        this._player = this.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 0xa07cff);
        this._player.setDepth(10);
        this._syncPlayerPos();

        this._setupCamera();
        this._setupKeys();
        this._setupEvents();

        // Map name label
        this._mapLabel = this.add.text(10, 10, this._map.name, {
            fontSize: '14px',
            color: '#dcdcf0',
            fontFamily: 'monospace',
            backgroundColor: '#00000080',
            padding: { x: 6, y: 3 },
        }).setScrollFactor(0).setDepth(100);
    }

    _buildMap() {
        const { width, height, tiles } = this._map;
        this._tileGfx = [];

        for (let ty = 0; ty < height; ty++) {
            for (let tx = 0; tx < width; tx++) {
                const tileId = tiles[ty * width + tx];
                const color  = TILE_COLORS[tileId] ?? 0x202020;
                const x = tx * TILE_SIZE + TILE_SIZE / 2;
                const y = ty * TILE_SIZE + TILE_SIZE / 2;
                const rect = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, color);
                rect.setDepth(0);

                // Simple tile icons via text
                const icons = { 4: '🌲', 3: '💧', 6: '🚪' };
                if (icons[tileId]) {
                    this.add.text(x, y, icons[tileId], { fontSize: '18px' }).setOrigin(0.5).setDepth(1);
                }

                this._tileGfx.push(rect);
            }
        }
    }

    _buildNPCs() {
        if (!this._map.npcs) return;
        for (const npc of this._map.npcs) {
            if (npc.condition && !this._checkCondition(npc.condition)) continue;
            const def = getNPC(npc.id);
            const x   = npc.tx * TILE_SIZE + TILE_SIZE / 2;
            const y   = npc.ty * TILE_SIZE + TILE_SIZE / 2;

            this.add.circle(x, y, TILE_SIZE / 2 - 2, 0xffaa00).setDepth(2);
            this.add.text(x, y, def?.portrait || '?', { fontSize: '20px' }).setOrigin(0.5).setDepth(3);
            this._npcSprites[npc.id] = { tx: npc.tx, ty: npc.ty, treeId: npc.treeId };
        }
    }

    _setupCamera() {
        const mapW = this._map.width  * TILE_SIZE;
        const mapH = this._map.height * TILE_SIZE;
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.cameras.main.startFollow(this._player, true, 0.1, 0.1);
    }

    _setupKeys() {
        this._keys = this.input.keyboard.addKeys({
            up:      Phaser.Input.Keyboard.KeyCodes.UP,
            down:    Phaser.Input.Keyboard.KeyCodes.DOWN,
            left:    Phaser.Input.Keyboard.KeyCodes.LEFT,
            right:   Phaser.Input.Keyboard.KeyCodes.RIGHT,
            w:       Phaser.Input.Keyboard.KeyCodes.W,
            s:       Phaser.Input.Keyboard.KeyCodes.S,
            a:       Phaser.Input.Keyboard.KeyCodes.A,
            d:       Phaser.Input.Keyboard.KeyCodes.D,
            confirm: Phaser.Input.Keyboard.KeyCodes.SPACE,
            enter:   Phaser.Input.Keyboard.KeyCodes.ENTER,
            menu:    Phaser.Input.Keyboard.KeyCodes.M,
            escape:  Phaser.Input.Keyboard.KeyCodes.ESC,
        });
    }

    _setupEvents() {
        this._offBattleEnd = events.on('battleEnd', (result) => {
            if (!result.won) {
                events.clearAll();
                this.scene.start('SplashScene');
                this.scene.stop('UIScene');
            }
        });
    }

    update(time, delta) {
        if (state.isGameOver || state.isPaused) return;

        const dt = delta / 1000;
        this._moveTimer -= dt;

        if (this._moveTimer <= 0) {
            let dx = 0, dy = 0;
            const k = this._keys;

            if (Phaser.Input.Keyboard.JustDown(k.up)    || Phaser.Input.Keyboard.JustDown(k.w))    dy = -1;
            else if (Phaser.Input.Keyboard.JustDown(k.down)  || Phaser.Input.Keyboard.JustDown(k.s))  dy =  1;
            else if (Phaser.Input.Keyboard.JustDown(k.left)  || Phaser.Input.Keyboard.JustDown(k.a))  dx = -1;
            else if (Phaser.Input.Keyboard.JustDown(k.right) || Phaser.Input.Keyboard.JustDown(k.d))  dx =  1;

            // Hold-to-move (after first press the repeat uses held state)
            if (dx === 0 && dy === 0) {
                if (k.up.isDown    || k.w.isDown)    dy = -1;
                else if (k.down.isDown  || k.s.isDown)  dy =  1;
                else if (k.left.isDown  || k.a.isDown)  dx = -1;
                else if (k.right.isDown || k.d.isDown)  dx =  1;
            }

            if (dx !== 0 || dy !== 0) {
                this._tryMove(dx, dy);
                this._moveTimer = this._moveCooldown;
            }
        }

        // Confirm / interact
        if (Phaser.Input.Keyboard.JustDown(this._keys.confirm) || Phaser.Input.Keyboard.JustDown(this._keys.enter)) {
            this._interact();
        }

        // Menu
        if (Phaser.Input.Keyboard.JustDown(this._keys.menu)) {
            this._openMenu();
        }
    }

    _tryMove(dx, dy) {
        const nx = state.playerTileX + dx;
        const ny = state.playerTileY + dy;
        const { width, height, tiles } = this._map;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;

        const tileId = tiles[ny * width + nx];
        if (!isWalkable(tileId)) return;

        state.setMap(this._mapId, nx, ny);
        this._syncPlayerPos();
        playFootstep();

        this._stepCount++;
        this._checkEvents(nx, ny);
        this._checkExits(nx, ny);
        this._checkEncounter();
    }

    _syncPlayerPos() {
        const x = state.playerTileX * TILE_SIZE + TILE_SIZE / 2;
        const y = state.playerTileY * TILE_SIZE + TILE_SIZE / 2;
        this._player.setPosition(x, y);
    }

    _interact() {
        // Check adjacent tiles for NPCs
        const dirs = [[0,-1],[0,1],[-1,0],[1,0],[0,0]];
        for (const [dx, dy] of dirs) {
            const tx = state.playerTileX + dx;
            const ty = state.playerTileY + dy;
            for (const [npcId, npc] of Object.entries(this._npcSprites)) {
                if (npc.tx === tx && npc.ty === ty) {
                    this._startDialog(npcId, npc.treeId);
                    return;
                }
            }
        }
    }

    _startDialog(npcId, treeId) {
        state.isPaused = true;
        events.emit('dialogStart', npcId);
        this.scene.launch('DialogScene', { npcId, treeId, callerScene: 'MapScene' });
        this.scene.pause('MapScene');
    }

    _openMenu() {
        state.isPaused = true;
        this.scene.launch('MenuScene', { callerScene: 'MapScene' });
        this.scene.pause('MapScene');
    }

    _checkExits(tx, ty) {
        if (!this._map.exits) return;
        for (const exit of this._map.exits) {
            if (exit.tx === tx && exit.ty === ty) {
                if (exit.condition && !this._checkCondition(exit.condition)) {
                    // TODO: show "You cannot go this way yet" message
                    return;
                }
                this.scene.start('MapScene', { mapId: exit.toMap, tx: exit.toTx, ty: exit.toTy });
                return;
            }
        }
    }

    _checkEvents(tx, ty) {
        if (!this._map.events) return;
        for (const ev of this._map.events) {
            if (ev.tx === tx && ev.ty === ty) {
                if (ev.condition && !this._checkCondition(ev.condition)) continue;
                if (ev._triggered && ev.once) continue;
                ev._triggered = true;

                if (ev.type === 'lore') {
                    this.scene.launch('DialogScene', {
                        npcId: null,
                        treeId: null,
                        singleText: ev.payload.text,
                        callerScene: 'MapScene',
                    });
                    this.scene.pause('MapScene');
                } else if (ev.type === 'treasure') {
                    state.addItem({ id: ev.payload.itemId, qty: 1 });
                    events.emit('itemAdded', { id: ev.payload.itemId });
                } else if (ev.type === 'boss') {
                    this._triggerBattle(ev.payload.enemyGroup);
                }
            }
        }
    }

    _checkEncounter() {
        const enc = this._map.encounters;
        if (!enc) return;

        // Encounter every ~6-10 steps randomly
        if (this._stepCount % Phaser.Math.Between(6, 10) !== 0) return;
        if (Math.random() > enc.rate) return;

        const chapter = state.chapter;
        const groupKey = enc.groups[chapter] || enc.groups[1];
        this._triggerBattle(groupKey);
    }

    _triggerBattle(groupKey) {
        const groups = ENCOUNTER_GROUPS[groupKey];
        if (!groups) return;
        const group = groups[Phaser.Math.Between(0, groups.length - 1)];
        playBattleStart();
        state.isPaused = true;
        this.scene.launch('BattleScene', { enemyIds: group, callerScene: 'MapScene' });
        this.scene.pause('MapScene');
    }

    _checkCondition(condition) {
        if (condition.startsWith('chapter_')) {
            return state.chapter >= parseInt(condition.split('_')[1]);
        }
        if (condition.startsWith('quest_active_')) {
            return state.quests.active.includes(condition.replace('quest_active_', ''));
        }
        if (condition.startsWith('flag_')) {
            return !!state.getFlag(condition);
        }
        return true;
    }

    shutdown() {
        if (this._offBattleEnd) this._offBattleEnd();
    }
}
