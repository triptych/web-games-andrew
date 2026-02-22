/**
 * player.js — Player ship: movement, auto-fire, smart bomb, lives.
 *
 * Phase 3: Playable core loop — move, shoot, kill centipede, die, smart bomb.
 *
 * Public API (called from main.js):
 *   initPlayer(k)
 */

import {
    GAME_WIDTH, GAME_HEIGHT,
    TILE_SIZE, GRID_COLS, GRID_ROWS,
    GRID_OFFSET_X, GRID_OFFSET_Y,
    PLAYER_ZONE_MIN,
    COLORS,
    SCORE_NODE_DESTROY,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    worldToTile, isNodeAt,
    damageNode, refreshNodeVisual, destroyNodeEntity,
} from './grid.js';
import { hitCentipedeAt } from './centipede.js';
import { hitEnemyAt } from './enemies.js';
import { playShoot, playPlayerHit, playSmartBomb, playNodeHit, playNodeDestroy } from './sounds.js';

// ============================================================
// Constants
// ============================================================

const SHIP_SPEED      = 280;   // px/s horizontal
const VERT_SPEED      = 220;   // px/s vertical (within player zone)
const BULLET_SPEED    = 600;   // px/s upward
const FIRE_RATE       = 0.25;  // seconds between auto-fire shots
const INVINCIBLE_TIME = 2.0;   // seconds of invincibility after being hit
const FLASH_PERIOD    = 0.12;  // seconds per flash cycle (during invincibility)

// ============================================================
// Module state
// ============================================================

let _k;

// Ship world-space pixel centre
let _shipX = 0, _shipY = 0;

// Visual entities (recreated per scene)
let _shipEnt, _cockpitEnt, _gunLEnt, _gunREnt;

// Timers
let _invincTimer = 0;
let _flashTimer  = 0;
let _fireTimer   = 0;

// Active bullets: [{ ent, x, y }]
let _bullets = [];

// Movement bounds (pixel centres within the player zone)
let _minX, _maxX, _minY, _maxY;

// ============================================================
// Public init — call once inside the 'game' scene
// ============================================================

export function initPlayer(k) {
    _k = k;

    // Reset per-scene state
    _invincTimer = 0;
    _flashTimer  = 0;
    _fireTimer   = 0;   // fire on first update
    _bullets     = [];

    // Movement bounds: pixel centres of the outermost tile columns/rows
    // in the player zone.
    _minX = GRID_OFFSET_X + TILE_SIZE / 2;
    _maxX = GRID_OFFSET_X + GRID_COLS * TILE_SIZE - TILE_SIZE / 2;
    _minY = GRID_OFFSET_Y + PLAYER_ZONE_MIN * TILE_SIZE + TILE_SIZE / 2;
    _maxY = GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE - TILE_SIZE / 2;

    // Start: bottom-centre of the playfield
    _shipX = GAME_WIDTH / 2;
    _shipY = _maxY;

    _spawnShipEntities(k);

    // Life lost when centipede falls off the bottom edge
    events.on('centipedeFellOffBottom', () => _playerHit(k));

    // Life lost when a spider walks into the player
    events.on('playerHitByEnemy', () => _playerHit(k));

    // Per-frame update loop
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;
        const dt = k.dt();
        _handleMovement(k, dt);
        _handleAutoFire(k, dt);
        _updateBullets(k, dt);
        _checkCollision(k);
        _updateInvincibility(dt);
        _updateShipVisuals();
    });

    // Smart Bomb — space or B
    k.onKeyPress('space', () => {
        if (!state.isGameOver && !state.isPaused) _detonateSmartBomb(k);
    });
    k.onKeyPress('b', () => {
        if (!state.isGameOver && !state.isPaused) _detonateSmartBomb(k);
    });
}

// ============================================================
// Ship visual entities
// ============================================================

function _spawnShipEntities(k) {
    // Destroy any leftover ship from a previous scene run
    k.destroyAll('playerShip');

    const [sr, sg, sb] = COLORS.playerShip; // cyan-blue

    // Main hull: wide, shallow rectangle
    _shipEnt = k.add([
        k.pos(_shipX, _shipY),
        k.rect(34, 14, { radius: 2 }),
        k.color(sr, sg, sb),
        k.anchor('center'),
        k.opacity(1),
        k.z(20),
        'playerShip',
    ]);

    // Cockpit bubble: brighter circle above the hull
    _cockpitEnt = k.add([
        k.pos(_shipX, _shipY - 10),
        k.circle(7),
        k.color(160, 220, 255),
        k.anchor('center'),
        k.opacity(1),
        k.z(21),
        'playerShip',
    ]);

    // Left gun barrel
    _gunLEnt = k.add([
        k.pos(_shipX - 13, _shipY - 5),
        k.rect(4, 13, { radius: 1 }),
        k.color(40, 130, 210),
        k.anchor('center'),
        k.opacity(1),
        k.z(20),
        'playerShip',
    ]);

    // Right gun barrel
    _gunREnt = k.add([
        k.pos(_shipX + 13, _shipY - 5),
        k.rect(4, 13, { radius: 1 }),
        k.color(40, 130, 210),
        k.anchor('center'),
        k.opacity(1),
        k.z(20),
        'playerShip',
    ]);
}

function _updateShipVisuals() {
    if (!_shipEnt || !_shipEnt.exists()) return;

    // Flash on/off during invincibility
    const vis = _invincTimer <= 0 || (Math.floor(_flashTimer / FLASH_PERIOD) % 2 === 0);
    const opa = vis ? 1 : 0;

    _shipEnt.pos    = _k.vec2(_shipX,       _shipY);
    _cockpitEnt.pos = _k.vec2(_shipX,       _shipY - 10);
    _gunLEnt.pos    = _k.vec2(_shipX - 13,  _shipY - 5);
    _gunREnt.pos    = _k.vec2(_shipX + 13,  _shipY - 5);

    _shipEnt.opacity    = opa;
    _cockpitEnt.opacity = opa;
    _gunLEnt.opacity    = opa;
    _gunREnt.opacity    = opa;
}

// ============================================================
// Movement
// ============================================================

function _handleMovement(k, dt) {
    let dx = 0, dy = 0;

    if (k.isKeyDown('left')  || k.isKeyDown('a')) dx -= 1;
    if (k.isKeyDown('right') || k.isKeyDown('d')) dx += 1;
    if (k.isKeyDown('up')    || k.isKeyDown('w')) dy -= 1;
    if (k.isKeyDown('down')  || k.isKeyDown('s')) dy += 1;

    _shipX = Math.max(_minX, Math.min(_maxX, _shipX + dx * SHIP_SPEED * dt));
    _shipY = Math.max(_minY, Math.min(_maxY, _shipY + dy * VERT_SPEED * dt));
}

// ============================================================
// Auto-fire
// ============================================================

function _handleAutoFire(k, dt) {
    _fireTimer -= dt;
    if (_fireTimer <= 0) {
        _fireTimer += FIRE_RATE; // accumulate to keep rate stable under low FPS
        _fireBullet(k);
    }
}

function _fireBullet(k) {
    playShoot();
    const bx = _shipX;
    const by = _shipY - 16; // spawn just above the ship cockpit

    const ent = k.add([
        k.pos(bx, by),
        k.rect(4, 12, { radius: 1 }),
        k.color(...COLORS.playerBullet),
        k.anchor('center'),
        k.z(15),
        'playerBullet',
    ]);
    _bullets.push({ ent, x: bx, y: by });
}

// ============================================================
// Bullet update + collision detection
// ============================================================

function _updateBullets(k, dt) {
    const dead = [];

    for (let i = 0; i < _bullets.length; i++) {
        const b = _bullets[i];
        b.y -= BULLET_SPEED * dt;

        // Left the top of the screen — discard
        if (b.y < GRID_OFFSET_Y - TILE_SIZE) {
            dead.push(i);
            if (b.ent.exists()) b.ent.destroy();
            continue;
        }

        // Sync visual
        if (b.ent.exists()) {
            b.ent.pos = _k.vec2(b.x, b.y);
        }

        // Tile the bullet occupies right now
        const tile = worldToTile(b.x, b.y);
        if (!tile) continue; // outside grid area — let it fly off-screen

        const { col, row } = tile;

        // --- Centipede segment hit ---
        if (hitCentipedeAt(col, row)) {
            dead.push(i);
            if (b.ent.exists()) b.ent.destroy();
            continue;
        }

        // --- Special enemy hit (flea, spider, scorpion) ---
        if (hitEnemyAt(col, row)) {
            dead.push(i);
            if (b.ent.exists()) b.ent.destroy();
            continue;
        }

        // --- Node hit ---
        if (isNodeAt(col, row)) {
            const hp = damageNode(col, row);
            if (hp === 0) {
                destroyNodeEntity(k, col, row);
                state.addScore(SCORE_NODE_DESTROY);
                playNodeDestroy();
            } else if (hp > 0) {
                refreshNodeVisual(k, col, row);
                playNodeHit();
            }
            dead.push(i);
            if (b.ent.exists()) b.ent.destroy();
            continue;
        }
    }

    // Remove in reverse order so earlier indices remain valid
    for (let i = dead.length - 1; i >= 0; i--) {
        _bullets.splice(dead[i], 1);
    }
}

// ============================================================
// Player–centipede collision (tile-based)
// ============================================================

function _checkCollision(k) {
    if (_invincTimer > 0) return;

    const tile = worldToTile(_shipX, _shipY);
    if (!tile) return;

    for (const c of state.centipedes) {
        for (const seg of c.segments) {
            if (seg.col === tile.col && seg.row === tile.row) {
                _playerHit(k);
                return;
            }
        }
    }
}

// ============================================================
// Player hit / death
// ============================================================

function _playerHit(k) {
    if (_invincTimer > 0 || state.isGameOver) return;

    playPlayerHit();
    events.emit('playerHit');
    state.waveDeaths++;
    state.lives -= 1; // state.js emits 'gameOver' when lives reach 0

    if (state.isGameOver) {
        k.destroyAll('playerShip');
        return;
    }

    // Grant invincibility period
    _invincTimer = INVINCIBLE_TIME;
    _flashTimer  = 0;
}

function _updateInvincibility(dt) {
    if (_invincTimer <= 0) return;
    _invincTimer -= dt;
    _flashTimer  += dt;
    if (_invincTimer <= 0) {
        _invincTimer = 0;
        _flashTimer  = 0;
    }
}

// ============================================================
// Smart Bomb
// ============================================================

/**
 * Kills every centipede segment on screen.
 * Segments split the centipede as normal, but we collect all positions
 * first so split children are also caught by subsequent hitCentipedeAt calls.
 */
function _detonateSmartBomb(k) {
    if (state.smartBombs <= 0) return;
    state.smartBombs -= 1;
    playSmartBomb();

    // Snapshot all segment positions before any kills (kills cause splits)
    const positions = [];
    for (const c of state.centipedes) {
        for (const seg of c.segments) {
            positions.push({ col: seg.col, row: seg.row });
        }
    }

    // Kill each position; split centipedes inherit the same tile positions,
    // so the remaining hitCentipedeAt calls will find and kill them too.
    for (const { col, row } of positions) {
        hitCentipedeAt(col, row);
    }

    _flashScreen(k);
}

function _flashScreen(k) {
    // Full-screen white flash
    const flash = k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(255, 255, 255),
        k.opacity(0.65),
        k.z(80),
        'smartBombFlash',
    ]);

    let t = 0;
    flash.onUpdate(() => {
        t += k.dt();
        if (t >= 0.35) {
            if (flash.exists()) flash.destroy();
            return;
        }
        if (flash.exists()) flash.opacity = 0.65 * (1 - t / 0.35);
    });

    // Expanding shockwave rings from the ship position
    _spawnShockwave(k, _shipX, _shipY, [100, 200, 255]);
    _spawnShockwave(k, _shipX, _shipY, [255, 255, 255], 0.1);
}

function _spawnShockwave(k, cx, cy, color, delay = 0) {
    const DURATION   = 0.5;
    const MAX_RADIUS = 420;
    let t = -delay;

    // We draw the ring by shrinking an outlined circle (using a rect approximation with outline)
    // Kaplay doesn't have circle outline natively; use an opaque circle with a slightly smaller
    // filled circle on top. We fake the ring by spawning two circles and masking the inner one.
    // Simpler: just animate a circle that grows and fades.
    const ring = k.add([
        k.pos(cx, cy),
        k.circle(1),
        k.color(...color),
        k.opacity(0),
        k.anchor('center'),
        k.z(79),
        'shockwave',
    ]);

    ring.onUpdate(() => {
        t += k.dt();
        if (t < 0) return;
        if (!ring.exists()) return;
        const progress = t / DURATION;
        if (progress >= 1) { ring.destroy(); return; }
        // Grow radius, fade out
        ring.radius  = 1 + MAX_RADIUS * progress;
        ring.opacity = (1 - progress) * 0.45;
    });
}
