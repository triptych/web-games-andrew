/**
 * GameScene — Main gameplay scene.
 *
 * Owns:
 *   - Dungeon generation (via dungeon.js)
 *   - 3D raycasted view (via raycaster.js)
 *   - Player movement (grid-step / blobber style)
 *   - Turn-based combat resolution
 *   - Enemy AI (roam + alert chase, ranged attacks)
 *   - Status effects (poison, stun)
 *   - Animated damage numbers in the 3D view
 *   - Minimap rendering (right panel, per-type enemy colors)
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
    playPoison, playStun, playRangedAttack,
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
    enemy:   0xff4040,   // fallback (per-type colors used when available)
    item:    0xffd700,
    stDown:  0x00ff80,
    stUp:    0x8060ff,
    door:    0xc87820,
    unknown: 0x0a0a14,
};

// How many tiles the enemy can "see" the player to become alerted
const ALERT_RADIUS = 7;

// -------------------------------------------------------
// Simple BFS pathfinder (grid, avoiding walls & doors)
// Returns next step {x,y} toward target, or null if no path.
// -------------------------------------------------------
function bfsStep(grid, fromX, fromY, toX, toY, enemies) {
    if (fromX === toX && fromY === toY) return null;

    // Build a set of occupied enemy tiles (excluding the mover itself)
    const occupied = new Set();
    for (const e of enemies) {
        if (e.alive) occupied.add(`${e.x},${e.y}`);
    }
    // Remove the current mover from occupied so it doesn't block itself
    occupied.delete(`${fromX},${fromY}`);

    const visited = new Set();
    visited.add(`${fromX},${fromY}`);
    const queue = [{ x: fromX, y: fromY, firstStep: null }];

    while (queue.length > 0) {
        const { x, y, firstStep } = queue.shift();

        for (let d = 0; d < 4; d++) {
            const nx = x + DIR_DX[d];
            const ny = y + DIR_DY[d];
            const key = `${nx},${ny}`;

            if (nx < 0 || nx >= DUNGEON_COLS || ny < 0 || ny >= DUNGEON_ROWS) continue;
            if (visited.has(key)) continue;

            const cell = grid[ny][nx];
            const isWall = cell === TILE_WALL || cell === TILE_DOOR;
            // Target tile may be occupied by player — allow it
            const isTarget = (nx === toX && ny === toY);

            if (!isWall && (!occupied.has(key) || isTarget)) {
                visited.add(key);
                const step = firstStep || { x: nx, y: ny };
                if (isTarget) return step;
                queue.push({ x: nx, y: ny, firstStep: step });
            }
        }

        if (visited.size > 400) break; // safety cap
    }
    return null;
}

// -------------------------------------------------------
// Line-of-sight check (DDA, stops at walls/doors)
// -------------------------------------------------------
function hasLos(grid, ax, ay, bx, by) {
    let x = ax + 0.5, y = ay + 0.5;
    const tx = bx + 0.5, ty = by + 0.5;
    const dx = tx - x, dy = ty - y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
        x += sx; y += sy;
        const mx = Math.floor(x), my = Math.floor(y);
        if (mx < 0 || mx >= DUNGEON_COLS || my < 0 || my >= DUNGEON_ROWS) return false;
        const cell = grid[my][mx];
        if (cell === TILE_WALL || cell === TILE_DOOR) return false;
    }
    return true;
}

// Manhattan distance
function mdist(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    preload() {
        this.load.image('sprite_Goblin',   'img/gobllin.png');
        this.load.image('sprite_Lich',     'img/lich.png');
        this.load.image('sprite_Orc',      'img/orc.png');
        this.load.image('sprite_Skeleton', 'img/skeleton.png');
        this.load.image('sprite_Slime',    'img/slime.png');
    }

    create() {
        state.reset();

        this._mapVisible   = true;
        this._inputLocked  = false;  // locked during combat animation
        this._dmgNumbers   = [];     // active floating damage number objects
        this._doorAnim     = [];     // door-open animations { x, y, timer }

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
        if (this._dmgLayer)  this._dmgLayer.destroy();

        // Clear damage number objects
        this._dmgNumbers = [];
        this._doorAnim   = [];

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

        // Reset status effects
        state.poisonTurns = 0;
        state.stunTurns   = 0;

        // Create raycaster
        this._raycaster = new Raycaster(this, grid, DUNGEON_COLS, DUNGEON_ROWS);

        // Create minimap graphics layer
        this._mapGfx = this.add.graphics();
        this._mapGfx.setVisible(this._mapVisible);

        // Graphics layer for damage numbers (above 3D view)
        this._dmgLayer = this.add.graphics();

        // Render first frame
        this._updateVisibility();
        this._renderMinimap();
        this._raycaster.render(state.playerX, state.playerY, DIR_ANGLE[state.playerFacing], [...this._enemies, ...this._items]);

        events.emit('floorChanged', floorNum);
        state.addMessage(`You descend to floor ${floorNum}.`);
    }

    // -------------------------------------------------------
    // Update loop
    // -------------------------------------------------------

    update(time, delta) {
        if (state.isGameOver) return;
        if (this._inputLocked) return;

        // Animate damage numbers
        this._tickDmgNumbers(delta);

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
        this._endPlayerTurn();
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
            this._startCombat(blocker);
            return;
        }

        if (cell === TILE_WALL) {
            playBump();
            return;
        }

        if (cell === TILE_DOOR) {
            playDoorOpen();
            this._grid[ny][nx] = TILE_EMPTY;
            this._raycaster.setGrid(this._grid, DUNGEON_COLS, DUNGEON_ROWS);
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

        this._endPlayerTurn();
    }

    // Called after every player action (move/turn/attack-kill)
    _endPlayerTurn() {
        // Apply stun — skip enemy AI if player stunned
        if (state.stunTurns > 0) {
            state.stunTurns--;
            state.addMessage(`You are stunned! (${state.stunTurns} turns remaining)`);
        }

        // Apply poison tick
        if (state.poisonTurns > 0) {
            const poisonDmg = 2;
            state.playerHp -= poisonDmg;
            state.poisonTurns--;
            playPoison();
            state.addMessage(`Poison deals ${poisonDmg} damage. (${state.poisonTurns} turns remaining)`);
            events.emit('enemyAttacked', { enemy: null, damage: poisonDmg });
            if (state.isGameOver) {
                this._afterMove();
                return;
            }
        }

        // Enemy AI turn (only if player not stunned this turn)
        if (state.stunTurns === 0) {
            this._runEnemyAI();
        }

        this._afterMove();
    }

    _afterMove() {
        this._updateVisibility();
        this._renderMinimap();
        this._raycaster.render(state.playerX, state.playerY, DIR_ANGLE[state.playerFacing], [...this._enemies, ...this._items]);
        events.emit('playerMoved', {
            x: state.playerX, y: state.playerY, facing: state.playerFacing,
        });
    }

    // -------------------------------------------------------
    // Enemy AI — runs after every player turn
    // -------------------------------------------------------

    _runEnemyAI() {
        const px = Math.floor(state.playerX);
        const py = Math.floor(state.playerY);

        for (const e of this._enemies) {
            if (!e.alive) continue;
            if (state.isGameOver) break;
            // Skip enemies that already acted this turn (combat counter-attack)
            if (e._actedThisTurn) { e._actedThisTurn = false; continue; }

            // Alert check: if player is in radius and has LoS, become alerted
            const dist = mdist(e.x, e.y, px, py);
            if (!e.alerted && dist <= ALERT_RADIUS && hasLos(this._grid, e.x, e.y, px, py)) {
                e.alerted = true;
            }

            if (e.alerted) {
                this._alertedAI(e, px, py, dist);
            } else {
                this._roamAI(e);
            }
        }
    }

    _alertedAI(e, px, py, dist) {
        // Ranged enemy: if in range and has LoS, shoot instead of moving
        if (e.ranged && dist <= e.range && hasLos(this._grid, e.x, e.y, px, py)) {
            this._enemyRangedAttack(e);
            return;
        }

        // Adjacent to player — melee
        if (dist === 1) {
            this._enemyMeleeAttack(e);
            return;
        }

        // Otherwise BFS toward player
        const step = bfsStep(this._grid, e.x, e.y, px, py, this._enemies);
        if (step) {
            // Check if step is adjacent to player — attack instead
            if (step.x === px && step.y === py) {
                this._enemyMeleeAttack(e);
            } else {
                e.x = step.x;
                e.y = step.y;
            }
        }
    }

    _roamAI(e) {
        // Random roam: try current direction, turn on failure
        for (let attempt = 0; attempt < 4; attempt++) {
            const nx = e.x + DIR_DX[e.roamDir];
            const ny = e.y + DIR_DY[e.roamDir];
            if (nx < 0 || nx >= DUNGEON_COLS || ny < 0 || ny >= DUNGEON_ROWS) {
                e.roamDir = Math.floor(Math.random() * 4);
                continue;
            }
            const cell = this._grid[ny][nx];
            if (cell === TILE_WALL || cell === TILE_DOOR) {
                e.roamDir = Math.floor(Math.random() * 4);
                continue;
            }
            // Don't walk onto another enemy
            const blocked = this._enemies.some(o => o !== e && o.alive && o.x === nx && o.y === ny);
            if (blocked) {
                e.roamDir = Math.floor(Math.random() * 4);
                continue;
            }
            // Don't walk onto player tile
            const px = Math.floor(state.playerX);
            const py = Math.floor(state.playerY);
            if (nx === px && ny === py) {
                e.roamDir = Math.floor(Math.random() * 4);
                continue;
            }
            e.x = nx;
            e.y = ny;
            break;
        }
    }

    _enemyMeleeAttack(e) {
        const rawDmg  = Math.max(1, e.atk + Math.floor(Math.random() * 3));
        const netDmg  = Math.max(1, rawDmg - state._playerDef);

        // 15% chance to stun
        const stuns = Math.random() < 0.15 && e.type !== 'Slime';
        // Orc has 20% chance to poison
        const poisons = Math.random() < 0.20 && e.type === 'Orc';

        state.playerHp -= netDmg;
        playPlayerHit();

        let msg = `${e.type} hits you for ${netDmg} damage.`;
        if (stuns) {
            state.stunTurns = Math.max(state.stunTurns, 2);
            playStun();
            msg += ' You are stunned!';
        }
        if (poisons && state.poisonTurns === 0) {
            state.poisonTurns = 3;
            playPoison();
            msg += ' You are poisoned!';
        }

        state.addMessage(msg);
        events.emit('enemyAttacked', { enemy: e, damage: netDmg });

        // Show damage number on player side
        this._spawnDmgNumber(netDmg, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 40, 0xff4040);
    }

    _enemyRangedAttack(e) {
        const rawDmg = Math.max(1, e.atk - 1 + Math.floor(Math.random() * 3));
        const netDmg = Math.max(1, rawDmg - state._playerDef);

        // Lich: 30% chance to poison
        const poisons = Math.random() < 0.30 && e.type === 'Lich';

        state.playerHp -= netDmg;
        playRangedAttack();

        let msg = `${e.type} shoots you for ${netDmg} damage.`;
        if (poisons && state.poisonTurns === 0) {
            state.poisonTurns = 3;
            playPoison();
            msg += ' You are poisoned!';
        }

        state.addMessage(msg);
        events.emit('enemyAttacked', { enemy: e, damage: netDmg });

        this._spawnDmgNumber(netDmg, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 40, 0xff4040);
    }

    // -------------------------------------------------------
    // Floating damage numbers
    // -------------------------------------------------------

    _spawnDmgNumber(amount, screenX, screenY, color) {
        this._dmgNumbers.push({
            text: String(amount),
            x:    screenX + (Math.random() - 0.5) * 40,
            y:    screenY,
            vy:   -60,     // px / sec upward
            life:  1.0,    // seconds remaining
            alpha: 1.0,
            color,
        });
    }

    _spawnEnemyDmgNumber(amount, enemyX, enemyY) {
        // Project enemy grid pos to rough screen position (center of view = close enemies)
        // Approximate: use horizontal angle offset from player facing
        const px = Math.floor(state.playerX);
        const py = Math.floor(state.playerY);
        const dx = enemyX - px;
        const dy = enemyY - py;
        // Angle of enemy relative to player facing
        const angle = Math.atan2(dy, dx);
        const facingAngle = DIR_ANGLE[state.playerFacing];
        let deltaAngle = angle - facingAngle;
        // Normalise to -PI..PI
        while (deltaAngle >  Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

        const FOV = (60 * Math.PI) / 180;
        const screenXFrac = 0.5 + deltaAngle / FOV;
        const screenX = screenXFrac * VIEW_WIDTH;

        // Distance → vertical position (closer = lower = larger)
        const dist = Math.sqrt(dx * dx + dy * dy);
        const wallH = Math.min(VIEW_HEIGHT, VIEW_HEIGHT / Math.max(0.5, dist));
        const screenY = VIEW_HEIGHT / 2 - wallH / 2 + 10;

        if (screenX > 0 && screenX < VIEW_WIDTH) {
            this._spawnDmgNumber(amount, screenX, Math.max(60, screenY), 0xffff60);
        } else {
            // Off-screen: show in center area
            this._spawnDmgNumber(amount, VIEW_WIDTH / 2 + (Math.random() - 0.5) * 80,
                                 VIEW_HEIGHT * 0.35, 0xffff60);
        }
    }

    _tickDmgNumbers(delta) {
        if (this._dmgNumbers.length === 0) return;

        const dt = delta / 1000;
        this._dmgLayer.clear();

        for (let i = this._dmgNumbers.length - 1; i >= 0; i--) {
            const n = this._dmgNumbers[i];
            n.y     += n.vy * dt;
            n.vy    *= 0.92;           // decelerate
            n.life  -= dt;
            n.alpha  = Math.max(0, n.life);

            if (n.life <= 0) {
                this._dmgNumbers.splice(i, 1);
                continue;
            }

            // Draw shadow
            this._dmgLayer.fillStyle(0x000000, n.alpha * 0.6);
            this._dmgLayer.fillRect(n.x - 1 + 2, n.y + 2, n.text.length * 10, 14);

            // We use a simple rectangle per character (no text objects to avoid GC thrash)
            // Actually Phaser Graphics can't draw text — we'll use a pooled Text approach.
        }

        // We need text objects for damage numbers. Manage a simple pool.
        this._renderDmgNumbersText();
    }

    _renderDmgNumbersText() {
        // Lazy-init text pool
        if (!this._dmgPool) this._dmgPool = [];

        // Hide all
        for (const t of this._dmgPool) t.setVisible(false);

        for (let i = 0; i < this._dmgNumbers.length; i++) {
            const n = this._dmgNumbers[i];
            let txt = this._dmgPool[i];
            if (!txt) {
                txt = this.add.text(0, 0, '', {
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    stroke: '#000000',
                    strokeThickness: 3,
                });
                this._dmgPool.push(txt);
            }
            const hexColor = '#' + n.color.toString(16).padStart(6, '0');
            txt.setStyle({ color: hexColor, fontSize: '18px', fontFamily: 'monospace',
                           stroke: '#000000', strokeThickness: 3 });
            txt.setText(n.text);
            txt.setPosition(n.x - txt.width / 2, n.y);
            txt.setAlpha(n.alpha);
            txt.setVisible(true);
            txt.setDepth(100);
        }
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
                    if (cell === TILE_WALL)             color = MAP_COLORS.wall;
                    else if (cell === TILE_DOOR)        color = MAP_COLORS.door;
                    else if (cell === TILE_STAIRS_DOWN) color = MAP_COLORS.stDown;
                    else if (cell === TILE_STAIRS_UP)   color = MAP_COLORS.stUp;
                    else                                color = MAP_COLORS.floor;
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

        // Enemies — use per-type color, alerted enemies shown brighter
        for (const e of this._enemies) {
            if (!e.alive) continue;
            const mc = e.x - startCol;
            const mr = e.y - startRow;
            if (mc < 0 || mc >= cols || mr < 0 || mr >= rows) continue;
            if (!this._visible[e.y][e.x]) continue;
            const color = e.color || MAP_COLORS.enemy;
            gfx.fillStyle(color, 1);
            gfx.fillRect(offX + mc * tS + 2, offY + mr * tS + 2, tS - 4, tS - 4);
            // Alerted indicator: white dot in corner
            if (e.alerted) {
                gfx.fillStyle(0xffffff, 1);
                gfx.fillRect(offX + mc * tS + tS - 4, offY + mr * tS + 1, 3, 3);
            }
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

        // Status effect indicators (top of minimap panel)
        this._renderStatusBar(gfx, offX, offY + rows * tS + 8);
    }

    _renderStatusBar(gfx, x, y) {
        if (state.poisonTurns > 0) {
            gfx.fillStyle(0x40ff40, 0.85);
            gfx.fillRect(x, y, 12, 12);
            // "P" indicator drawn via minimap text would need text objects — skip graphic for now
        }
        if (state.stunTurns > 0) {
            gfx.fillStyle(0xffff00, 0.85);
            gfx.fillRect(x + 16, y, 12, 12);
        }
    }

    // -------------------------------------------------------
    // Combat (turn-based — player attack)
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

        // Show damage number over enemy position
        this._spawnEnemyDmgNumber(dmgToEnemy, enemy.x, enemy.y);

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
            this._endPlayerTurn();
            return;
        }

        // Enemy counter-attacks (brief delay for feel), then run other enemies' AI turns
        this._inputLocked = true;
        this.time.delayedCall(220, () => {
            this._inputLocked = false;
            if (!enemy.alive || state.isGameOver) {
                state.endCombat();
                this._endPlayerTurn();
                return;
            }
            // The bumped enemy already gets its action here (counter-attack)
            // Mark it as acted so _runEnemyAI skips it this turn
            enemy._actedThisTurn = true;
            this._enemyMeleeAttack(enemy);
            state.endCombat();
            if (!state.isGameOver) {
                this._endPlayerTurn();
            } else {
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
            case 'antidote':
                state.poisonTurns = 0;
                state.addMessage(`Used ${item.name}. Poison cured!`);
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
        this._raycaster.render(state.playerX, state.playerY, DIR_ANGLE[state.playerFacing], [...this._enemies, ...this._items]);
    }

    _restart() {
        events.clearAll();
        // Clean up damage text pool
        if (this._dmgPool) {
            for (const t of this._dmgPool) t.destroy();
            this._dmgPool = null;
        }
        this.scene.restart();
        const ui = this.scene.get('UIScene');
        if (ui) ui.scene.restart();
    }

    _goToMenu() {
        events.clearAll();
        if (this._raycaster) this._raycaster.destroy();
        if (this._dmgPool) {
            for (const t of this._dmgPool) t.destroy();
            this._dmgPool = null;
        }
        this.scene.stop('UIScene');
        this.scene.start('SplashScene');
    }

    shutdown() {
        if (this._offGameOver) this._offGameOver();
        if (this._raycaster)   this._raycaster.destroy();
        if (this._dmgPool) {
            for (const t of this._dmgPool) t.destroy();
            this._dmgPool = null;
        }
    }
}
