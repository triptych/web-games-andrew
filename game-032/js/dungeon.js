/**
 * dungeon.js — Room layout, tile rendering, player, enemies, and combat
 * for the top-down 8-bit dungeon crawler.
 *
 * All gameplay entities are tagged so `k.destroyAll(tag)` can clean up
 * between floors / scene restarts.
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, COLORS, ENEMY_DEFS,
    PLAYER_SPEED, PLAYER_ATTACK_DMG, PLAYER_ATTACK_RANGE,
    PLAYER_ATTACK_COOLDOWN, PLAYER_INVULN_TIME,
} from './config.js';
import { playSwordSwing, playHit, playEnemyDeath, playPickup, playPlayerHurt } from './sounds.js';

const COLS = Math.floor(GAME_WIDTH  / TILE_SIZE);
const ROWS = Math.floor(GAME_HEIGHT / TILE_SIZE);

// Plain Math.random() helper — avoids relying on unconfirmed k.rand() signature.
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let k;
let player;
let attackCooldownTimer = 0;
let invulnTimer = 0;
let walls = []; // { x, y, w, h } in world px, for simple AABB collision

// ============================================================
// Public API
// ============================================================

export function initDungeon(kaplay) {
    k = kaplay;
    walls = [];
    _buildRoom();
    _spawnPlayer();
    _spawnEnemies();
    _spawnTreasure();
}

export function updateDungeon(dt) {
    if (!player || state.isGameOver || state.isPaused) return;

    _handleMovement(dt);
    _handleAttackInput();

    if (attackCooldownTimer > 0) attackCooldownTimer -= dt;
    if (invulnTimer > 0) {
        invulnTimer -= dt;
        player.opacity = (Math.floor(invulnTimer * 20) % 2 === 0) ? 0.4 : 1;
        if (invulnTimer <= 0) player.opacity = 1;
    }
}

// ============================================================
// Room / tiles
// ============================================================

function _buildRoom() {
    // Floor tiles (checkerboard for texture, like the reference screenshot)
    for (let ty = 0; ty < ROWS; ty++) {
        for (let tx = 0; tx < COLS; tx++) {
            const isWallRing = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
            const px = tx * TILE_SIZE;
            const py = ty * TILE_SIZE;

            if (isWallRing) {
                k.add([
                    k.pos(px, py),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(...COLORS.wall),
                    k.outline(2, k.rgb(...COLORS.mortar)),
                    k.anchor('topleft'),
                    k.z(1),
                    'dungeon', 'wallTile',
                ]);
                walls.push({ x: px, y: py, w: TILE_SIZE, h: TILE_SIZE });
            } else {
                const alt = (tx + ty) % 2 === 0;
                k.add([
                    k.pos(px, py),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(...(alt ? COLORS.floor : COLORS.floorAlt)),
                    k.anchor('topleft'),
                    k.z(0),
                    'dungeon', 'floorTile',
                ]);
            }
        }
    }

    // A few interior pillar/wall blocks for maze feel
    const interiorBlocks = [
        { x: 6, y: 4, w: 2, h: 2 },
        { x: 14, y: 8, w: 3, h: 1 },
        { x: 20, y: 3, w: 1, h: 4 },
        { x: 9, y: 12, w: 4, h: 1 },
    ];
    for (const b of interiorBlocks) {
        for (let ty = b.y; ty < b.y + b.h; ty++) {
            for (let tx = b.x; tx < b.x + b.w; tx++) {
                const px = tx * TILE_SIZE;
                const py = ty * TILE_SIZE;
                k.add([
                    k.pos(px, py),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(...COLORS.wallDark),
                    k.outline(2, k.rgb(...COLORS.mortar)),
                    k.anchor('topleft'),
                    k.z(1),
                    'dungeon', 'wallTile',
                ]);
                walls.push({ x: px, y: py, w: TILE_SIZE, h: TILE_SIZE });
            }
        }
    }

    // Torches on the outer wall for atmosphere (visual only)
    const torchSpots = [
        [3, 0], [10, 0], [17, 0], [23, 0],
    ];
    for (const [tx, ty] of torchSpots) {
        const px = tx * TILE_SIZE + TILE_SIZE / 2;
        const py = ty * TILE_SIZE + TILE_SIZE + 4;
        const torch = k.add([
            k.pos(px, py),
            k.circle(6),
            k.color(...COLORS.torch),
            k.anchor('center'),
            k.z(2),
            k.opacity(1),
            'dungeon', 'torch',
            { t: Math.random() * 10 },
        ]);
        torch.onUpdate(() => {
            torch.t += k.dt() * 8;
            torch.opacity = 0.7 + Math.sin(torch.t) * 0.3;
        });
    }
}

// ============================================================
// Player
// ============================================================

function _spawnPlayer() {
    player = k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2),
        k.rect(TILE_SIZE * 0.6, TILE_SIZE * 0.8),
        k.color(210, 215, 225),
        k.outline(2, k.rgb(60, 60, 80)),
        k.anchor('center'),
        k.opacity(1),
        k.z(10),
        'dungeon', 'player',
        { facing: k.vec2(0, 1) },
    ]);
}

function _handleMovement(dt) {
    let dx = 0, dy = 0;
    if (k.isKeyDown('left')  || k.isKeyDown('a')) dx -= 1;
    if (k.isKeyDown('right') || k.isKeyDown('d')) dx += 1;
    if (k.isKeyDown('up')    || k.isKeyDown('w')) dy -= 1;
    if (k.isKeyDown('down')  || k.isKeyDown('s')) dy += 1;

    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    player.facing = k.vec2(dx, dy);

    const nextX = player.pos.x + dx * PLAYER_SPEED * dt;
    const nextY = player.pos.y + dy * PLAYER_SPEED * dt;

    const halfW = (TILE_SIZE * 0.6) / 2;
    const halfH = (TILE_SIZE * 0.8) / 2;

    // Move on each axis independently so sliding along walls works
    if (!_collidesWall(nextX, player.pos.y, halfW, halfH)) {
        player.pos = k.vec2(nextX, player.pos.y);
    }
    if (!_collidesWall(player.pos.x, nextY, halfW, halfH)) {
        player.pos = k.vec2(player.pos.x, nextY);
    }
}

function _collidesWall(cx, cy, halfW, halfH) {
    const left = cx - halfW, right = cx + halfW;
    const top = cy - halfH, bottom = cy + halfH;
    for (const w of walls) {
        if (right > w.x && left < w.x + w.w && bottom > w.y && top < w.y + w.h) {
            return true;
        }
    }
    return false;
}

function _handleAttackInput() {
    if (attackCooldownTimer > 0) return;
    if (k.isKeyPressed('space')) {
        _performAttack();
    }
}

function _performAttack() {
    attackCooldownTimer = PLAYER_ATTACK_COOLDOWN;
    playSwordSwing();

    const dir = player.facing;
    const hitX = player.pos.x + dir.x * PLAYER_ATTACK_RANGE;
    const hitY = player.pos.y + dir.y * PLAYER_ATTACK_RANGE;

    // Brief visual swing indicator
    const swing = k.add([
        k.pos(hitX, hitY),
        k.circle(TILE_SIZE * 0.5),
        k.color(...COLORS.accent),
        k.opacity(0.5),
        k.anchor('center'),
        k.z(9),
        'dungeon', 'swingFx',
    ]);
    k.wait(0.1, () => k.destroy(swing));

    // Hit any enemy within range
    const enemies = k.get('enemy');
    for (const e of enemies) {
        const d = Math.hypot(e.pos.x - hitX, e.pos.y - hitY);
        if (d < TILE_SIZE * 0.7) {
            _damageEnemy(e, PLAYER_ATTACK_DMG);
        }
    }
}

// ============================================================
// Enemies
// ============================================================

function _spawnEnemies() {
    const count = 3 + Math.min(state.level, 6);
    for (let i = 0; i < count; i++) {
        _spawnSlime();
    }
}

function _spawnSlime() {
    const def = ENEMY_DEFS.slime;
    let px, py, tries = 0;
    do {
        px = randInt(2, COLS - 2) * TILE_SIZE + TILE_SIZE / 2;
        py = randInt(2, ROWS - 2) * TILE_SIZE + TILE_SIZE / 2;
        tries++;
    } while (_collidesWall(px, py, TILE_SIZE * 0.4, TILE_SIZE * 0.4) && tries < 30);

    const scaledHealth = def.health + (state.level - 1) * 8;

    const enemy = k.add([
        k.pos(px, py),
        k.circle(TILE_SIZE * 0.35),
        k.color(...def.color),
        k.outline(2, k.rgb(30, 90, 40)),
        k.anchor('center'),
        k.opacity(1),
        k.z(8),
        'dungeon', 'enemy',
        {
            hp: scaledHealth,
            maxHp: scaledHealth,
            speed: def.speed,
            damage: def.damage,
            scoreValue: def.score,
            hitTimer: 0,
            wobble: Math.random() * 10,
        },
    ]);

    enemy.onUpdate(() => {
        if (state.isGameOver || state.isPaused || !player) return;

        // Wobble animation (slime squish)
        enemy.wobble += k.dt() * 6;
        const s = 1 + Math.sin(enemy.wobble) * 0.08;
        enemy.scale = k.vec2(s, 1 / s);

        // Chase player
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;

        const nextX = enemy.pos.x + nx * enemy.speed * k.dt();
        const nextY = enemy.pos.y + ny * enemy.speed * k.dt();
        if (!_collidesWall(nextX, nextY, TILE_SIZE * 0.3, TILE_SIZE * 0.3)) {
            enemy.pos = k.vec2(nextX, nextY);
        }

        if (enemy.hitTimer > 0) enemy.hitTimer -= k.dt();

        // Contact damage to player
        if (dist < TILE_SIZE * 0.55 && invulnTimer <= 0) {
            _damagePlayer(enemy.damage);
        }
    });
}

function _damageEnemy(enemy, amount) {
    if (enemy.hitTimer > 0) return; // brief i-frames per hit to avoid multi-tick damage
    enemy.hitTimer = 0.15;
    enemy.hp -= amount;
    playHit();

    // Flash red
    const originalColor = enemy.color;
    enemy.color = k.color(255, 255, 255);
    k.wait(0.08, () => {
        if (enemy.exists()) enemy.color = originalColor;
    });

    if (enemy.hp <= 0) {
        playEnemyDeath();
        state.addScore(enemy.scoreValue);
        events.emit('enemyKilled', enemy);
        k.destroy(enemy);

        // Spawn a new slime after a delay to keep the floor populated
        k.wait(1.5, () => {
            if (!state.isGameOver && k.get('enemy').length < 8) _spawnSlime();
        });
    }
}

function _damagePlayer(amount) {
    invulnTimer = PLAYER_INVULN_TIME;
    playPlayerHurt();
    state.damage(amount);
    events.emit('playerHit', amount);
}

// ============================================================
// Treasure
// ============================================================

function _spawnTreasure() {
    const count = 3;
    for (let i = 0; i < count; i++) {
        let px, py, tries = 0;
        do {
            px = randInt(2, COLS - 2) * TILE_SIZE + TILE_SIZE / 2;
            py = randInt(2, ROWS - 2) * TILE_SIZE + TILE_SIZE / 2;
            tries++;
        } while (_collidesWall(px, py, TILE_SIZE * 0.3, TILE_SIZE * 0.3) && tries < 30);

        const gem = k.add([
            k.pos(px, py),
            k.rect(TILE_SIZE * 0.4, TILE_SIZE * 0.4),
            k.color(...COLORS.gold),
            k.outline(2, k.rgb(140, 100, 0)),
            k.anchor('center'),
            k.z(5),
            'dungeon', 'treasure',
            { value: 25, bob: Math.random() * 10, baseY: py },
        ]);

        gem.onUpdate(() => {
            if (state.isGameOver || state.isPaused || !player) return;
            gem.bob += k.dt() * 4;
            gem.pos = k.vec2(gem.pos.x, gem.baseY + Math.sin(gem.bob) * 3);

            const d = Math.hypot(player.pos.x - gem.pos.x, player.pos.y - gem.pos.y);
            if (d < TILE_SIZE * 0.6) {
                playPickup();
                state.addScore(gem.value);
                events.emit('treasureCollected', gem.value);
                k.destroy(gem);
            }
        });
    }
}
