/**
 * GameScene — Main gameplay scene.
 *
 * Owns:
 *   - Dungeon generation (via dungeon.js)
 *   - 3D raycasted view (via raycaster.js)
 *   - Player movement (grid-step / blobber style)
 *   - Turn-based combat resolution
 *   - Minimap rendering (right panel)
 *   - Item pickup
 *
 * Communicates with UIScene via EventBus.
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS,
    DUNGEON_COLS, DUNGEON_ROWS,
    TILE_EMPTY, TILE_WALL, TILE_DOOR, TILE_STAIRS_DOWN, TILE_STAIRS_UP,
    VIEW_WIDTH, VIEW_HEIGHT,
    MAP_PANEL_X, MAP_PANEL_WIDTH, MAP_TILE_SIZE,
    TOTAL_FLOORS,
} from './config.js';
import { generateDungeon } from './dungeon.js';
import { Raycaster }       from './raycaster.js';
import {
    playFootstep, playBump, playDoorOpen,
    playAttack, playEnemyAttack, playPlayerHit, playEnemyDie,
    playPickup, playStairs, playGameOver,
} from './sounds.js';

// Facing direction vectors (0=N, 1=E, 2=S, 3=W)
const DIR_DX = [  0,  1,  0, -1 ];
const DIR_DY = [ -1,  0,  1,  0 ];
// Facing angle in radians for the raycaster (0=E = 0 rad, so offset from North)
const DIR_ANGLE = [ -Math.PI / 2, 0, Math.PI / 2, Math.PI ];

const MAP_COLORS = {
    wall:    0x3c3c50,
    floor:   0x181830,
    player:  0x00e8ff,
    enemy:   0xff4040,
    item:    0xffd700,
    stDown:  0x00ff80,
    stUp:    0x8060ff,
    door:    0xc87820,
    unknown: 0x0a0a14,
};

export class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        state.reset();

        this._mapVisible  = true;
        this._inputLocked = false; // locked during combat animation

        // Generate first floor
        this._loadFloor(state.floor);

        // Key bindings
        this._cursors = this.input.keyboard.createCursorKeys();
        this._keys = this.input.keyboard.addKeys({
            w:       Phaser.Input.Keyboard.KeyCodes.W,
            a:       Phaser.Input.Keyboard.KeyCodes.A,
            s:       Phaser.Input.Keyboard.KeyCodes.S,
            d:       Phaser.Input.Keyboard.KeyCodes.D,
            space:   Phaser.Input.Keyboard.KeyCodes.SPACE,
            m:       Phaser.Input.Keyboard.KeyCodes.M,
            i:       Phaser.Input.Keyboard.KeyCodes.I,
            r:       Phaser.Input.Keyboard.KeyCodes.R,
            escape:  Phaser.Input.Keyboard.KeyCodes.ESC,
        });

        this._offGameOver = events.on('gameOver', () => this._handleGameOver());
    }

    // -------------------------------------------------------
    // Floor loading
    // -------------------------------------------------------

    _loadFloor(floorNum) {
        // Clean up previous raycaster if any
        if (this._raycaster) this._raycaster.destroy();
        if (this._mapGfx)    this._mapGfx.destroy();

        const { grid, rooms, startPos, stairsUp, stairsDown, enemies, items } = generateDungeon(floorNum);
        this._grid       = grid;
        this._rooms      = rooms;
        this._stairsDown = stairsDown;
        this._stairsUp   = stairsUp;
        this._enemies    = enemies.map(e => ({ ...e, alive: true }));
        this._items      = items.map(it => ({ ...it, picked: false }));

        // Visibility map (fog of war)
        this._visible = [];
        for (let r = 0; r < DUNGEON_ROWS; r++) {
            this._visible.push(new Array(DUNGEON_COLS).fill(false));
        }

        // Place player
        state.playerX      = startPos.x + 0.5;
        state.playerY      = startPos.y + 0.5;
        state.playerFacing = 2; // South
        state.enemies      = this._enemies;

        // Create raycaster
        this._raycaster = new Raycaster(this, grid, DUNGEON_COLS, DUNGEON_ROWS);

        // Create minimap graphics layer
        this._mapGfx = this.add.graphics();
        this._mapGfx.setVisible(this._mapVisible);

        // Render first frame
        this._updateVisibility();
        this._renderMinimap();
        this._raycaster.render(state.playerX, state.playerY, DIR_ANGLE[state.playerFacing]);

        events.emit('floorChanged', floorNum);
        state.addMessage(`You descend to floor ${floorNum}.`);
    }

    // -------------------------------------------------------
    // Update loop
    // -------------------------------------------------------

    update(time, delta) {
        if (state.isGameOver) return;
        if (this._inputLocked) return;

        this._handleInput();
    }

    _handleInput() {
        const jd = Phaser.Input.Keyboard.JustDown;

        // Toggle map
        if (jd(this._keys.m)) {
            this._mapVisible = !this._mapVisible;
            this._mapGfx.setVisible(this._mapVisible);
        }

        // Restart
        if (jd(this._keys.r)) { this._restart(); return; }

        // Menu
        if (jd(this._keys.escape)) { this._goToMenu(); return; }

        // Movement — step-based (blobber)
        const forward  = jd(this._keys.w) || jd(this._cursors.up);
        const backward = jd(this._keys.s) || jd(this._cursors.down);
        const turnL    = jd(this._keys.a) || jd(this._cursors.left);
        const turnR    = jd(this._keys.d) || jd(this._cursors.right);
        const attack   = jd(this._keys.space);

        if (turnL)    { this._turn(-1); return; }
        if (turnR)    { this._turn( 1); return; }
        if (forward)  { this._move( 1); return; }
        if (backward) { this._move(-1); return; }
        if (attack)   { this._attackFacing(); return; }
    }

    // Turn left (-1) or right (+1)
    _turn(dir) {
        state.playerFacing = (state.playerFacing + 4 + dir) % 4;
        this._afterMove();
    }

    // Move forward (+1) or backward (-1) one tile
    _move(dir) {
        const f  = (state.playerFacing + (dir < 0 ? 2 : 0)) % 4;
        const nx = Math.floor(state.playerX) + DIR_DX[f];
        const ny = Math.floor(state.playerY) + DIR_DY[f];

        if (nx < 0 || nx >= DUNGEON_COLS || ny < 0 || ny >= DUNGEON_ROWS) {
            playBump();
            return;
        }

        const cell = this._grid[ny][nx];

        // Check enemy blocking
        const blocker = this._enemies.find(e => e.alive && e.x === nx && e.y === ny);
        if (blocker) {
            // Bump into enemy — start combat
            this._startCombat(blocker);
            return;
        }

        if (cell === TILE_WALL) {
            playBump();
            return;
        }

        if (cell === TILE_DOOR) {
            playDoorOpen();
            this._grid[ny][nx] = TILE_EMPTY; // open door
        }

        // Actually move
        state.playerX = nx + 0.5;
        state.playerY = ny + 0.5;
        playFootstep();

        // Check stairs
        if (cell === TILE_STAIRS_DOWN) {
            this._descend();
            return;
        }
        if (cell === TILE_STAIRS_UP) {
            this._ascend();
            return;
        }

        // Check item pickup
        const item = this._items.find(it => !it.picked && it.x === nx && it.y === ny);
        if (item) {
            this._pickupItem(item);
        }

        this._afterMove();
    }

    _afterMove() {
        this._updateVisibility();
        this._renderMinimap();
        this._raycaster.render(state.playerX, state.playerY, DIR_ANGLE[state.playerFacing]);
        events.emit('playerMoved', {
            x: state.playerX, y: state.playerY, facing: state.playerFacing,
        });
    }

    // -------------------------------------------------------
    // Visibility (simple flood-fill within radius)
    // -------------------------------------------------------

    _updateVisibility() {
        const cx  = Math.floor(state.playerX);
        const cy  = Math.floor(state.playerY);
        const RAD = 5;

        for (let dy = -RAD; dy <= RAD; dy++) {
            for (let dx = -RAD; dx <= RAD; dx++) {
                if (dx * dx + dy * dy > RAD * RAD) continue;
                const mx = cx + dx;
                const my = cy + dy;
                if (mx >= 0 && mx < DUNGEON_COLS && my >= 0 && my < DUNGEON_ROWS) {
                    this._visible[my][mx] = true;
                }
            }
        }
    }

    // -------------------------------------------------------
    // Minimap
    // -------------------------------------------------------

    _renderMinimap() {
        if (!this._mapGfx) return;
        const gfx = this._mapGfx;
        gfx.clear();

        // Background panel
        gfx.fillStyle(0x050510, 1);
        gfx.fillRect(MAP_PANEL_X, 0, MAP_PANEL_WIDTH, GAME_HEIGHT);

        const tS  = MAP_TILE_SIZE;
        const offX = MAP_PANEL_X + 10;
        const offY = 10;

        const cols = Math.min(DUNGEON_COLS, Math.floor(MAP_PANEL_WIDTH / tS));
        const rows = Math.min(DUNGEON_ROWS, Math.floor(GAME_HEIGHT / tS));

        // Camera: center on player
        const px = Math.floor(state.playerX);
        const py = Math.floor(state.playerY);
        const startCol = Math.max(0, px - Math.floor(cols / 2));
        const startRow = Math.max(0, py - Math.floor(rows / 2));

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const mc = startCol + c;
                const mr = startRow + r;
                if (mc >= DUNGEON_COLS || mr >= DUNGEON_ROWS) continue;

                if (!this._visible[mr][mc]) {
                    gfx.fillStyle(MAP_COLORS.unknown, 1);
                } else {
                    const cell = this._grid[mr][mc];
                    let color;
                    if (cell === TILE_WALL)         color = MAP_COLORS.wall;
                    else if (cell === TILE_DOOR)    color = MAP_COLORS.door;
                    else if (cell === TILE_STAIRS_DOWN) color = MAP_COLORS.stDown;
                    else if (cell === TILE_STAIRS_UP)   color = MAP_COLORS.stUp;
                    else                            color = MAP_COLORS.floor;
                    gfx.fillStyle(color, 1);
                }
                gfx.fillRect(offX + c * tS, offY + r * tS, tS - 1, tS - 1);
            }
        }

        // Items
        for (const item of this._items) {
            if (item.picked) continue;
            const mc = item.x - startCol;
            const mr = item.y - startRow;
            if (mc < 0 || mc >= cols || mr < 0 || mr >= rows) continue;
            if (!this._visible[item.y][item.x]) continue;
            gfx.fillStyle(MAP_COLORS.item, 1);
            gfx.fillRect(offX + mc * tS + 2, offY + mr * tS + 2, tS - 4, tS - 4);
        }

        // Enemies
        for (const e of this._enemies) {
            if (!e.alive) continue;
            const mc = e.x - startCol;
            const mr = e.y - startRow;
            if (mc < 0 || mc >= cols || mr < 0 || mr >= rows) continue;
            if (!this._visible[e.y][e.x]) continue;
            gfx.fillStyle(MAP_COLORS.enemy, 1);
            gfx.fillRect(offX + mc * tS + 2, offY + mr * tS + 2, tS - 4, tS - 4);
        }

        // Player arrow
        const pc = px - startCol;
        const pr = py - startRow;
        gfx.fillStyle(MAP_COLORS.player, 1);
        gfx.fillRect(offX + pc * tS + 2, offY + pr * tS + 2, tS - 4, tS - 4);

        // Facing indicator
        const arrowDx = DIR_DX[state.playerFacing];
        const arrowDy = DIR_DY[state.playerFacing];
        gfx.fillStyle(0xffffff, 1);
        gfx.fillRect(
            offX + (pc + arrowDx * 0.5 + 0.5) * tS,
            offY + (pr + arrowDy * 0.5 + 0.5) * tS,
            3, 3
        );
    }

    // -------------------------------------------------------
    // Combat (turn-based)
    // -------------------------------------------------------

    _attackFacing() {
        const f  = state.playerFacing;
        const tx = Math.floor(state.playerX) + DIR_DX[f];
        const ty = Math.floor(state.playerY) + DIR_DY[f];
        const enemy = this._enemies.find(e => e.alive && e.x === tx && e.y === ty);
        if (enemy) {
            this._startCombat(enemy);
        } else {
            state.addMessage('You swing at the air.');
            playAttack();
        }
    }

    _startCombat(enemy) {
        state.startCombat(enemy);
        this._doCombatRound(enemy);
    }

    _doCombatRound(enemy) {
        if (!enemy.alive || state.isGameOver) return;

        // Player attacks
        const pAtk  = state._playerAtk;
        const eDef  = enemy.def || 0;
        const dmgToEnemy = Math.max(1, pAtk - eDef + Math.floor(Math.random() * 3));
        enemy.hp -= dmgToEnemy;
        playAttack();
        state.addMessage(`You hit ${enemy.type} for ${dmgToEnemy} damage.`);
        events.emit('playerAttacked', { target: enemy, damage: dmgToEnemy });

        if (enemy.hp <= 0) {
            enemy.alive = false;
            playEnemyDie();
            state.addMessage(`${enemy.type} defeated! +${enemy.xpReward} XP`);
            state.gainXp(enemy.xpReward);
            state.gold += enemy.goldDrop;
            state.addScore(enemy.xpReward * 10);
            events.emit('enemyDied', { enemy });
            state.endCombat();
            this._afterMove();
            return;
        }

        // Enemy counter-attacks
        this.time.delayedCall(200, () => {
            if (!enemy.alive || state.isGameOver) return;
            const eDmg = Math.max(1, enemy.atk - state._playerDef + Math.floor(Math.random() * 3));
            state.damagePlayer(0); // trigger HP update via damagePlayer overriding defence
            const rawDmg = Math.max(1, enemy.atk + Math.floor(Math.random() * 3));
            state.playerHp -= rawDmg;
            playPlayerHit();
            state.addMessage(`${enemy.type} hits you for ${rawDmg} damage.`);
            events.emit('enemyAttacked', { enemy, damage: rawDmg });

            if (!state.isGameOver) {
                state.endCombat();
                this._afterMove();
            }
        });
    }

    // -------------------------------------------------------
    // Item pickup
    // -------------------------------------------------------

    _pickupItem(item) {
        item.picked = true;
        playPickup();

        switch (item.effect) {
            case 'heal':
                state.healPlayer(item.value);
                state.addMessage(`Picked up ${item.name}. Healed ${item.value} HP.`);
                break;
            case 'atk':
                state._playerAtk += item.value;
                state.addMessage(`Picked up ${item.name}. ATK +${item.value}.`);
                break;
            case 'def':
                state._playerDef += item.value;
                state.addMessage(`Picked up ${item.name}. DEF +${item.value}.`);
                break;
            case 'gold':
                state.gold += item.value;
                state.addMessage(`Picked up ${item.name}. Gold +${item.value}.`);
                break;
        }

        state.inventory.push(item);
        events.emit('itemPickedUp', item);
    }

    // -------------------------------------------------------
    // Floor transitions
    // -------------------------------------------------------

    _descend() {
        playStairs();
        if (state.floor >= TOTAL_FLOORS) {
            // Victory
            state.addScore(5000);
            state.addMessage('You reached the bottom and escaped with the treasure!');
            events.emit('gameWon');
            return;
        }
        state.floor++;
        this._loadFloor(state.floor);
    }

    _ascend() {
        playStairs();
        if (state.floor <= 1) return;
        state.floor--;
        this._loadFloor(state.floor);
    }

    // -------------------------------------------------------
    // Game over / restart / menu
    // -------------------------------------------------------

    _handleGameOver() {
        playGameOver();
        this._raycaster.render(state.playerX, state.playerY, DIR_ANGLE[state.playerFacing]);
    }

    _restart() {
        events.clearAll();
        this.scene.restart();
        const ui = this.scene.get('UIScene');
        if (ui) ui.scene.restart();
    }

    _goToMenu() {
        events.clearAll();
        if (this._raycaster) this._raycaster.destroy();
        this.scene.stop('UIScene');
        this.scene.start('SplashScene');
    }

    shutdown() {
        if (this._offGameOver) this._offGameOver();
        if (this._raycaster)   this._raycaster.destroy();
    }
}
