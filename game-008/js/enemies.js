/**
 * enemies.js — Special enemies: Flea, Spider, Scorpion.
 *
 * Phase 5: All non-centipede enemies with movement, node interaction,
 * player collision, and tower targeting support.
 *
 * Public API:
 *   initEnemies(k)
 *   spawnFlea(k)
 *   spawnSpider(k)
 *   spawnScorpion(k)
 *   hitEnemyAt(col, row)     — called by player bullets (returns true if hit)
 */

import {
    TILE_SIZE, GRID_COLS, GRID_ROWS,
    ENEMY_ZONE_MAX, BUFFER_ZONE_MIN, PLAYER_ZONE_MIN, PLAYER_ZONE_MAX,
    ENEMY_DEFS,
    COLORS,
    SCORE_SPIDER_KILL_BASE,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    tileToWorld, worldToTile,
    isNodeAt, placeNode, spawnNodeEntity,
    poisonNode, refreshNodeVisual, removeNode, destroyNodeEntity,
} from './grid.js';
import { playFleaDrop, playSpiderMove, playSegmentKill, playScorpionMove, playNodePoison } from './sounds.js';

// ============================================================
// Constants
// ============================================================

const FLEA_INTERVAL     = 0.18;  // seconds per tile drop
const SPIDER_INTERVAL   = 0.22;  // seconds per tile move
const SCORPION_INTERVAL = 0.20;  // seconds per tile move

// Spider erratic move directions (4-directional + staying in player zone)
const SPIDER_DIRS = [
    { dc:  1, dr:  0 },
    { dc: -1, dr:  0 },
    { dc:  0, dr:  1 },
    { dc:  0, dr: -1 },
    { dc:  1, dr:  1 },
    { dc: -1, dr:  1 },
    { dc:  1, dr: -1 },
    { dc: -1, dr: -1 },
];

// ============================================================
// Module state
// ============================================================

let _k = null;

// ============================================================
// Public init
// ============================================================

export function initEnemies(k) {
    _k = k;

    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;
        const dt = k.dt();
        for (const enemy of [...state.enemies]) {
            if (enemy.dead) continue;
            enemy._timer -= dt;
            if (enemy._timer <= 0) {
                _stepEnemy(k, enemy);
            }
            // Sync visual
            if (enemy.ent && enemy.ent.exists()) {
                const w = tileToWorld(enemy.col, enemy.row);
                enemy.ent.pos = k.vec2(w.x, w.y);
                // Sync attached decoration entities
                for (const e of enemy.eyes ?? []) {
                    if (!e || !e.exists()) continue;
                    // Eyes positioned relative to body center
                    const idx = (enemy.eyes ?? []).indexOf(e);
                    e.pos = k.vec2(w.x + (idx === 0 ? -5 : 5), w.y - 5);
                }
                for (let i = 0; i < (enemy.legs ?? []).length; i++) {
                    const leg = enemy.legs[i];
                    if (!leg || !leg.exists()) continue;
                    const angle = (i / 4) * Math.PI * 2;
                    leg.pos = k.vec2(w.x + Math.cos(angle) * 10, w.y + Math.sin(angle) * 10);
                }
                if (enemy.tail && enemy.tail.exists()) {
                    enemy.tail.pos = k.vec2(w.x - enemy.dirX * 10, w.y - 8);
                }
            }
        }

        // Remove dead enemies from state
        const alive = state.enemies.filter(e => !e.dead);
        state.enemies.length = 0;
        state.enemies.push(...alive);
    });

    // Player-enemy collision check (runs each frame separately so it's clear)
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;
        const playerTile = _getPlayerTile();
        if (!playerTile) return;

        for (const enemy of state.enemies) {
            if (enemy.dead) continue;
            if (enemy.col === playerTile.col && enemy.row === playerTile.row) {
                events.emit('playerHitByEnemy', enemy.type);
                _killEnemy(k, enemy, false); // remove enemy on collision
                // Damage is handled by player.js listening to this event
            }
        }
    });

    // Player bullets also hit enemies — wired via hitEnemyAt() called from player.js
}

// ============================================================
// Step helpers
// ============================================================

function _stepEnemy(k, enemy) {
    switch (enemy.type) {
        case 'flea':     _stepFlea(k, enemy);     break;
        case 'spider':   _stepSpider(k, enemy);   break;
        case 'scorpion': _stepScorpion(k, enemy); break;
    }
}

// ---- Flea ----

function _stepFlea(k, enemy) {
    enemy._timer = FLEA_INTERVAL;

    // Drop straight down
    const nextRow = enemy.row + 1;

    // Chance to create a node as it passes (only in enemy/buffer zone)
    if (enemy.row <= BUFFER_ZONE_MIN + 1) {
        if (Math.random() < 0.28 && !isNodeAt(enemy.col, enemy.row) && !state.hasTower(enemy.col, enemy.row)) {
            placeNode(enemy.col, enemy.row);
            spawnNodeEntity(k, enemy.col, enemy.row);
        }
    }

    if (nextRow >= GRID_ROWS) {
        // Flea left the bottom — just remove it
        _killEnemy(k, enemy, false);
        return;
    }

    enemy.row = nextRow;
}

// ---- Spider ----

function _stepSpider(k, enemy) {
    enemy._timer = SPIDER_INTERVAL + Math.random() * 0.1;

    // Spider eats nodes it lands on
    if (isNodeAt(enemy.col, enemy.row)) {
        removeNode(enemy.col, enemy.row);
        destroyNodeEntity(k, enemy.col, enemy.row);
    }

    // Erratic movement — pick a random direction, stay in player zone
    const shuffled = [...SPIDER_DIRS].sort(() => Math.random() - 0.5);
    for (const dir of shuffled) {
        const nc = enemy.col + dir.dc;
        const nr = enemy.row + dir.dr;
        if (nc < 0 || nc >= GRID_COLS) continue;
        if (nr < PLAYER_ZONE_MIN || nr > PLAYER_ZONE_MAX) continue;
        enemy.col = nc;
        enemy.row = nr;
        break;
    }

    // Random chittering sound (sparse)
    if (Math.random() < 0.15) playSpiderMove();

    // Spider lifespan check — leave after ~5–8 seconds of movement
    enemy._life = (enemy._life ?? 0) + 1;
    if (enemy._life > 35) {
        _killEnemy(k, enemy, false);
    }
}

// ---- Scorpion ----

function _stepScorpion(k, enemy) {
    enemy._timer = SCORPION_INTERVAL;

    // Poison the node at the current tile if one exists
    if (isNodeAt(enemy.col, enemy.row)) {
        poisonNode(enemy.col, enemy.row);
        refreshNodeVisual(k, enemy.col, enemy.row);
        playNodePoison();
    }

    // Periodic crawl sound
    if (Math.random() < 0.25) playScorpionMove();

    // Move horizontally across the row
    const nextCol = enemy.col + enemy.dirX;

    if (nextCol < 0 || nextCol >= GRID_COLS) {
        // Reached the far edge — scorpion exits
        _killEnemy(k, enemy, false);
        return;
    }

    enemy.col = nextCol;
}

// ============================================================
// Spawn functions
// ============================================================

export function spawnFlea(k) {
    // Random column in the enemy zone, not on a tower slot
    const col = 1 + Math.floor(Math.random() * (GRID_COLS - 2));
    const def = ENEMY_DEFS.flea;

    const w = tileToWorld(col, 0);
    const ent = k.add([
        k.pos(w.x, w.y),
        k.rect(TILE_SIZE * 0.55, TILE_SIZE * 0.55, { radius: 3 }),
        k.color(...COLORS.flea),
        k.anchor('center'),
        k.z(12),
        'enemy',
        'flea',
    ]);

    // Eyes
    const eyeL = k.add([k.pos(w.x - 5, w.y - 5), k.circle(2), k.color(0,0,0), k.anchor('center'), k.z(13), 'enemy']);
    const eyeR = k.add([k.pos(w.x + 5, w.y - 5), k.circle(2), k.color(0,0,0), k.anchor('center'), k.z(13), 'enemy']);

    const enemy = {
        type:   'flea',
        col,
        row:    0,
        hp:     def.hp,
        reward: def.reward,
        score:  def.score,
        ent,
        eyes:   [eyeL, eyeR],
        _timer: FLEA_INTERVAL,
        dead:   false,
    };

    state.enemies.push(enemy);
    playFleaDrop();
    return enemy;
}

export function spawnSpider(k) {
    // Spider spawns from either side, entering the player zone
    const fromLeft = Math.random() < 0.5;
    const col = fromLeft ? 0 : GRID_COLS - 1;
    const row = PLAYER_ZONE_MIN + Math.floor(Math.random() * 2); // row 15 or 16
    const def = ENEMY_DEFS.spider;

    const w = tileToWorld(col, row);
    const ent = k.add([
        k.pos(w.x, w.y),
        k.circle(TILE_SIZE * 0.3),
        k.color(...COLORS.spider),
        k.anchor('center'),
        k.z(12),
        'enemy',
        'spider',
    ]);

    // Draw 4 simple legs using small rects
    const legs = [];
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const lx = w.x + Math.cos(angle) * 10;
        const ly = w.y + Math.sin(angle) * 10;
        const leg = k.add([
            k.pos(lx, ly),
            k.circle(2),
            k.color(130, 50, 210),
            k.anchor('center'),
            k.z(11),
            'enemy',
        ]);
        legs.push(leg);
    }

    const enemy = {
        type:   'spider',
        col,
        row,
        hp:     def.hp,
        reward: def.reward,
        score:  def.score,
        ent,
        legs,
        _timer: SPIDER_INTERVAL,
        _life:  0,
        dead:   false,
    };

    state.enemies.push(enemy);
    return enemy;
}

export function spawnScorpion(k) {
    // Scorpion enters from one side on a random enemy-zone row
    const fromLeft = Math.random() < 0.5;
    const col  = fromLeft ? 0 : GRID_COLS - 1;
    const dirX = fromLeft ? 1 : -1;
    const row  = 1 + Math.floor(Math.random() * (ENEMY_ZONE_MAX - 1)); // row 1-11
    const def  = ENEMY_DEFS.scorpion;

    const w = tileToWorld(col, row);
    const ent = k.add([
        k.pos(w.x, w.y),
        k.rect(TILE_SIZE * 0.65, TILE_SIZE * 0.45, { radius: 3 }),
        k.color(...COLORS.scorpion),
        k.anchor('center'),
        k.z(12),
        'enemy',
        'scorpion',
    ]);

    // Tail dot
    const tail = k.add([
        k.pos(w.x - dirX * 10, w.y - 8),
        k.circle(4),
        k.color(200, 40, 100),
        k.anchor('center'),
        k.z(13),
        'enemy',
    ]);

    const enemy = {
        type:   'scorpion',
        col,
        row,
        dirX,
        hp:     def.hp,
        reward: def.reward,
        score:  def.score,
        ent,
        tail,
        _timer: SCORPION_INTERVAL,
        dead:   false,
    };

    state.enemies.push(enemy);
    return enemy;
}

// ============================================================
// Hit / kill API — called by player bullets and towers
// ============================================================

/**
 * Hit the non-centipede enemy at the given tile.
 * Returns true if an enemy was found and hit.
 */
export function hitEnemyAt(col, row) {
    for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (enemy.col === col && enemy.row === row) {
            enemy.hp -= 1;
            if (enemy.hp <= 0) {
                _killEnemy(_k, enemy, true);
            }
            return true;
        }
    }
    return false;
}

// ============================================================
// Internal kill
// ============================================================

function _killEnemy(k, enemy, awardRewards) {
    if (enemy.dead) return;
    enemy.dead = true;

    // Destroy visual entities
    if (enemy.ent && enemy.ent.exists())  enemy.ent.destroy();
    for (const e of enemy.eyes  ?? []) { if (e && e.exists()) e.destroy(); }
    for (const e of enemy.legs  ?? []) { if (e && e.exists()) e.destroy(); }
    if (enemy.tail && enemy.tail.exists()) enemy.tail.destroy();

    if (!awardRewards) return;

    playSegmentKill();

    // Gold reward
    state.earn(enemy.reward);

    // Score
    let sc = enemy.score ?? 0;
    if (enemy.type === 'spider') {
        // Classic: more points the further into the player zone
        const depth = enemy.row - PLAYER_ZONE_MIN;
        sc = SCORE_SPIDER_KILL_BASE + depth * 150;
    }
    state.addScore(sc);

    events.emit('enemyKilled', enemy.type, enemy.col, enemy.row);
    events.emit('goldChanged', state.gold);
}

// ============================================================
// Helper: get current player tile from ship position
// (Approximated from state — player.js manages the actual position)
// ============================================================

function _getPlayerTile() {
    // We read from the 'playerShip' tagged entities in Kaplay
    if (!_k) return null;
    const ships = _k.get('playerShip');
    if (!ships || ships.length === 0) return null;
    const ship = ships[0];
    return worldToTile(ship.pos.x, ship.pos.y);
}
