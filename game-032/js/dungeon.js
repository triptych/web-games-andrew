/**
 * dungeon.js — Floors, the player, enemies and combat for the top-down
 * 8-bit dungeon crawler.
 *
 * A run is FINAL_FLOOR floors deep. Each floor is a single room whose interior
 * pillars are generated, then checked by flood fill so every floor tile is
 * reachable. Every foe on a floor must die before its stairs open; on the
 * final floor the stairs are replaced by the Hollow Crown, which wins the run.
 *
 * Enemies:
 *   slime    — chases, sliding along walls
 *   bat      — fast, erratic, flies over pillars (from floor 2)
 *   skeleton — keeps its distance and throws bones it can see you with (from floor 3)
 *
 * All gameplay entities are tagged 'dungeon' so `k.destroyAll('dungeon')`
 * clears a floor before the next is built.
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, COLORS, ENEMY_DEFS,
    PLAYER_SPEED, PLAYER_ATTACK_DMG, PLAYER_ATTACK_RANGE,
    PLAYER_ATTACK_COOLDOWN, PLAYER_INVULN_TIME,
    FINAL_FLOOR, POTION_HEAL, POTION_FLOORS,
    BONE_SPEED, BONE_DAMAGE, BONE_COOLDOWN,
} from './config.js';
import {
    playSwordSwing, playHit, playEnemyDeath, playPickup, playPlayerHurt,
    playLevelDown, playStairsOpen, playThrow, playVictory,
} from './sounds.js';
import { touch } from './touch.js';

const COLS = Math.floor(GAME_WIDTH  / TILE_SIZE);
const ROWS = Math.floor(GAME_HEIGHT / TILE_SIZE);
const SPAWN = { tx: Math.floor(COLS / 2), ty: Math.floor(ROWS / 2) };

const PLAYER_HALF_W = (TILE_SIZE * 0.6) / 2;
const PLAYER_HALF_H = (TILE_SIZE * 0.8) / 2;

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let k;
let player;
let attackCooldownTimer = 0;
let invulnTimer = 0;
let grid = [];        // grid[ty][tx]: 1 = wall, 0 = floor
let reachable = [];   // floor tiles reachable from the spawn, as {tx, ty}
let exit = null;      // the stairs (or the crown on the final floor)
let exitOpen = false;
let descending = false;
let swings = 0;       // for the debug hook

// ============================================================
// Public API
// ============================================================

export function initDungeon(kaplay) {
    k = kaplay;
    attackCooldownTimer = 0;
    invulnTimer = 0;
    _buildFloor();
}

export function updateDungeon(dt) {
    if (!player || state.isOver || state.isPaused || descending) return;

    _handleMovement(dt);
    _handleAttackInput();
    _checkExit();

    if (attackCooldownTimer > 0) attackCooldownTimer -= dt;
    if (invulnTimer > 0) {
        invulnTimer -= dt;
        player.opacity = (Math.floor(invulnTimer * 20) % 2 === 0) ? 0.4 : 1;
        if (invulnTimer <= 0) player.opacity = 1;
    }
}

// ============================================================
// Floor generation
// ============================================================

function _buildFloor() {
    descending = false;
    exitOpen = false;
    grid = _generateLayout(state.level);
    reachable = _floodFill(SPAWN.tx, SPAWN.ty);

    _drawTiles();
    _spawnPlayer();
    _spawnExit();
    _spawnEnemies();
    _spawnTreasure();
    if (POTION_FLOORS.includes(state.level)) _spawnPotion();

    events.emit('floorEntered', state.level);
}

/**
 * Outer wall ring plus random interior pillars. Pillars keep clear of the
 * spawn and of the HUD corner, and stay two tiles off the outer wall so a
 * corridor runs all the way round. A layout is rejected if any floor tile
 * can't be reached from the spawn.
 */
function _generateLayout(floor) {
    const blockCount = 5 + Math.min(floor, 7);
    for (let attempt = 0; attempt < 60; attempt++) {
        const g = [];
        for (let ty = 0; ty < ROWS; ty++) {
            g.push([]);
            for (let tx = 0; tx < COLS; tx++) {
                g[ty].push(tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1 ? 1 : 0);
            }
        }
        for (let i = 0; i < blockCount; i++) {
            const horizontal = Math.random() < 0.5;
            const w = horizontal ? randInt(2, 5) : randInt(1, 2);
            const h = horizontal ? randInt(1, 2) : randInt(2, 4);
            const x = randInt(2, COLS - 3 - w);
            const y = randInt(2, ROWS - 3 - h);
            const nearSpawn = x <= SPAWN.tx + 3 && x + w >= SPAWN.tx - 3 && y <= SPAWN.ty + 3 && y + h >= SPAWN.ty - 3;
            const underHud = x < 8 && y < 3;
            if (nearSpawn || underHud) continue;
            for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) g[ty][tx] = 1;
        }
        let floorTiles = 0;
        for (const row of g) for (const v of row) if (v === 0) floorTiles++;
        grid = g;
        if (_floodFill(SPAWN.tx, SPAWN.ty).length === floorTiles) return g;
    }
    // Every attempt boxed something in: fall back to an open room.
    return grid.map((row, ty) => row.map((_, tx) => (tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1 ? 1 : 0)));
}

function _floodFill(sx, sy) {
    const seen = new Set([`${sx},${sy}`]);
    const out = [];
    const queue = [[sx, sy]];
    while (queue.length) {
        const [tx, ty] = queue.shift();
        out.push({ tx, ty });
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = tx + dx, ny = ty + dy;
            const key = `${nx},${ny}`;
            if (!seen.has(key) && grid[ny]?.[nx] === 0) {
                seen.add(key);
                queue.push([nx, ny]);
            }
        }
    }
    return out;
}

/** Floors get darker and redder the deeper you go. */
function _floorColors(floor) {
    const t = (floor - 1) / (FINAL_FLOOR - 1);
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return {
        floor:    mix(COLORS.floor,    [34, 14, 16]),
        floorAlt: mix(COLORS.floorAlt, [40, 18, 20]),
        wall:     mix(COLORS.wall,     [86, 40, 34]),
        wallDark: mix(COLORS.wallDark, [56, 22, 20]),
    };
}

function _drawTiles() {
    const pal = _floorColors(state.level);
    for (let ty = 0; ty < ROWS; ty++) {
        for (let tx = 0; tx < COLS; tx++) {
            const px = tx * TILE_SIZE, py = ty * TILE_SIZE;
            if (grid[ty][tx] === 1) {
                const outer = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
                k.add([
                    k.pos(px, py),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(...(outer ? pal.wall : pal.wallDark)),
                    k.outline(2, k.rgb(...COLORS.mortar)),
                    k.z(1),
                    'dungeon', 'wallTile',
                ]);
            } else {
                k.add([
                    k.pos(px, py),
                    k.rect(TILE_SIZE, TILE_SIZE),
                    k.color(...((tx + ty) % 2 === 0 ? pal.floor : pal.floorAlt)),
                    k.z(0),
                    'dungeon', 'floorTile',
                ]);
            }
        }
    }

    // Torches along the top wall, for atmosphere
    for (let tx = 3; tx < COLS - 2; tx += 7) {
        const torch = k.add([
            k.pos(tx * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE + 4),
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

function _tileCenter({ tx, ty }) {
    return k.vec2(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
}

/** A random reachable tile at least `minDist` tiles from the spawn and not in `taken`. */
function _freeTile(minDist, taken) {
    const pool = reachable.filter(({ tx, ty }) =>
        Math.hypot(tx - SPAWN.tx, ty - SPAWN.ty) >= minDist && !taken.has(`${tx},${ty}`));
    const tile = pool.length ? pool[randInt(0, pool.length - 1)] : reachable[randInt(0, reachable.length - 1)];
    taken.add(`${tile.tx},${tile.ty}`);
    return tile;
}

const occupied = new Set();

// ============================================================
// Player
// ============================================================

function _spawnPlayer() {
    occupied.clear();
    occupied.add(`${SPAWN.tx},${SPAWN.ty}`);
    player = k.add([
        k.pos(_tileCenter(SPAWN)),
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

    let speed = 1;
    if (dx === 0 && dy === 0 && (touch.dx || touch.dy)) {
        dx = touch.dx; dy = touch.dy;
        speed = Math.min(1, Math.hypot(dx, dy));
    }
    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    player.facing = k.vec2(dx, dy);

    _moveBox(player, dx * PLAYER_SPEED * speed * dt, dy * PLAYER_SPEED * speed * dt, PLAYER_HALF_W, PLAYER_HALF_H);
}

/** Move one axis at a time so bodies slide along walls instead of sticking. */
function _moveBox(obj, mx, my, halfW, halfH) {
    let moved = false;
    if (mx && !_collidesWall(obj.pos.x + mx, obj.pos.y, halfW, halfH)) {
        obj.pos = k.vec2(obj.pos.x + mx, obj.pos.y);
        moved = true;
    }
    if (my && !_collidesWall(obj.pos.x, obj.pos.y + my, halfW, halfH)) {
        obj.pos = k.vec2(obj.pos.x, obj.pos.y + my);
        moved = true;
    }
    return moved;
}

/** True if the box overlaps any wall tile. Looks up only the tiles under it. */
function _collidesWall(cx, cy, halfW, halfH) {
    const x0 = Math.floor((cx - halfW) / TILE_SIZE), x1 = Math.floor((cx + halfW - 0.01) / TILE_SIZE);
    const y0 = Math.floor((cy - halfH) / TILE_SIZE), y1 = Math.floor((cy + halfH - 0.01) / TILE_SIZE);
    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            if (grid[ty]?.[tx] !== 0) return true;
        }
    }
    return false;
}

function _isWallAt(x, y) {
    return grid[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)] !== 0;
}

/** Can a thrown bone get from a to b without hitting a wall? */
function _lineOfSight(a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (_isWallAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
}

function _handleAttackInput() {
    if (attackCooldownTimer > 0) return;
    if (k.isKeyPressed('space') || touch.attack) _performAttack();
}

function _performAttack() {
    attackCooldownTimer = PLAYER_ATTACK_COOLDOWN;
    swings++;
    playSwordSwing();

    const dir = player.facing;
    const hitX = player.pos.x + dir.x * PLAYER_ATTACK_RANGE;
    const hitY = player.pos.y + dir.y * PLAYER_ATTACK_RANGE;

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

    for (const e of k.get('enemy')) {
        if (Math.hypot(e.pos.x - hitX, e.pos.y - hitY) < TILE_SIZE * 0.7) {
            _damageEnemy(e, PLAYER_ATTACK_DMG, dir);
        }
    }
    // Swatting a bone out of the air is allowed
    for (const b of k.get('bone')) {
        if (Math.hypot(b.pos.x - hitX, b.pos.y - hitY) < TILE_SIZE * 0.7) k.destroy(b);
    }
}

function _damagePlayer(amount) {
    if (invulnTimer > 0 || godMode) return;
    invulnTimer = PLAYER_INVULN_TIME;
    playPlayerHurt();
    k.shake(5);
    state.damage(amount);
    events.emit('playerHit', amount);
}

// ============================================================
// Exit: stairs, or the Hollow Crown on the final floor
// ============================================================

function _spawnExit() {
    // The farthest fifth of the reachable floor, so every floor is a crossing
    const byDistance = [...reachable].sort((a, b) =>
        Math.hypot(b.tx - SPAWN.tx, b.ty - SPAWN.ty) - Math.hypot(a.tx - SPAWN.tx, a.ty - SPAWN.ty));
    const far = byDistance.slice(0, Math.max(1, Math.floor(byDistance.length / 5)));
    const tile = far[randInt(0, far.length - 1)];
    occupied.add(`${tile.tx},${tile.ty}`);
    const final = state.level >= FINAL_FLOOR;

    exit = k.add([
        k.pos(_tileCenter(tile)),
        k.rect(TILE_SIZE - 4, TILE_SIZE - 4),
        k.color(...COLORS.stairs),
        k.outline(2, k.rgb(...COLORS.mortar)),
        k.anchor('center'),
        k.opacity(1),
        k.z(3),
        'dungeon', 'exit',
        { t: 0, final },
    ]);
    if (final) {
        // A crown on a dark pedestal; it lights up when the floor is clear
        exit.add([k.pos(0, 2), k.rect(18, 9), k.color(110, 90, 30), k.anchor('center')]);
        for (const x of [-7, 0, 7]) exit.add([k.pos(x, -5), k.rect(4, 7), k.color(110, 90, 30), k.anchor('center')]);
    } else {
        // Three steps going down
        for (let i = 0; i < 3; i++) {
            exit.add([k.pos(0, -8 + i * 8), k.rect(TILE_SIZE - 10 - i * 6, 3), k.color(70, 52, 40), k.anchor('center')]);
        }
    }
    exit.onUpdate(() => {
        if (!exitOpen) return;
        exit.t += k.dt() * 4;
        exit.opacity = 0.75 + Math.sin(exit.t) * 0.25;
    });
}

function _openExit() {
    if (exitOpen || !exit) return;
    exitOpen = true;
    exit.color = k.rgb(...COLORS.stairsOpen);
    for (const part of exit.children) part.color = exit.final ? k.rgb(...COLORS.gold) : k.rgb(120, 70, 20);
    playStairsOpen();
    events.emit('stairsOpened', exit.final);
}

function _checkExit() {
    if (!exitOpen || !exit) return;
    if (Math.hypot(player.pos.x - exit.pos.x, player.pos.y - exit.pos.y) > TILE_SIZE * 0.6) return;

    if (exit.final) {
        playVictory();
        state.win();
        return;
    }
    descending = true;
    playLevelDown();
    k.wait(0.35, () => {
        k.destroyAll('dungeon');
        state.nextLevel();
        _buildFloor();
    });
}

// ============================================================
// Enemies
// ============================================================

function _pickType(floor) {
    const types = Object.entries(ENEMY_DEFS).filter(([, d]) => d.from <= floor);
    let roll = Math.random() * types.reduce((s, [, d]) => s + d.weight, 0);
    for (const [id, d] of types) {
        roll -= d.weight;
        if (roll <= 0) return id;
    }
    return types[0][0];
}

function _spawnEnemies() {
    const count = Math.min(4 + state.level, 13);
    state.foesLeft = count;
    for (let i = 0; i < count; i++) {
        _spawnEnemy(_pickType(state.level), _freeTile(6, occupied));
    }
}

function _spawnEnemy(type, tile) {
    const def = ENEMY_DEFS[type];
    const hp = def.health + (state.level - 1) * def.hpPerFloor;
    const size = type === 'bat' ? TILE_SIZE * 0.28 : TILE_SIZE * 0.35;

    const enemy = k.add([
        k.pos(_tileCenter(tile)),
        type === 'skeleton' ? k.rect(TILE_SIZE * 0.55, TILE_SIZE * 0.8) : k.circle(size),
        k.color(...def.color),
        k.outline(2, k.rgb(...def.outline)),
        k.anchor('center'),
        k.opacity(1),
        k.scale(1),
        k.z(8),
        'dungeon', 'enemy',
        {
            type,
            hp,
            maxHp: hp,
            speed: def.speed,
            damage: def.damage,
            scoreValue: def.score,
            baseColor: def.color,
            hitTimer: 0,
            phase: Math.random() * 10,
            throwTimer: BONE_COOLDOWN * (0.5 + Math.random()),
            strafe: Math.random() < 0.5 ? 1 : -1,
        },
    ]);

    if (type === 'bat') {
        // Two wings, flapping
        for (const side of [-1, 1]) {
            const wing = enemy.add([k.pos(side * size, 0), k.rect(size * 1.1, size * 0.5), k.color(...def.outline), k.anchor(side < 0 ? 'right' : 'left'), k.scale(1)]);
            wing.onUpdate(() => { wing.scale = k.vec2(1, 0.4 + Math.abs(Math.sin(enemy.phase * 3)) * 0.9); });
        }
    } else if (type === 'skeleton') {
        // Two dark eye sockets
        for (const x of [-4, 4]) enemy.add([k.pos(x, -6), k.rect(3, 3), k.color(30, 20, 20), k.anchor('center')]);
    }

    enemy.onUpdate(() => {
        if (state.isOver || state.isPaused || descending || !player) return;
        const dt = k.dt();
        enemy.phase += dt;
        if (enemy.hitTimer > 0) enemy.hitTimer -= dt;

        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;

        if (enemy.type === 'slime') {
            const s = 1 + Math.sin(enemy.phase * 6) * 0.08;
            enemy.scale = k.vec2(s, 1 / s);
            _moveBox(enemy, nx * enemy.speed * dt, ny * enemy.speed * dt, TILE_SIZE * 0.3, TILE_SIZE * 0.3);
        } else if (enemy.type === 'bat') {
            _updateBat(enemy, nx, ny, dt);
        } else {
            _updateSkeleton(enemy, nx, ny, dist, dt);
        }

        if (dist < TILE_SIZE * 0.55) _damagePlayer(enemy.damage);
    });
}

/** Bats zig-zag towards you and flutter over pillars, but stay inside the room. */
function _updateBat(bat, nx, ny, dt) {
    const angle = Math.atan2(ny, nx) + Math.sin(bat.phase * 3.1) * 1.1;
    const min = TILE_SIZE * 1.4;
    const x = Math.min(GAME_WIDTH - min, Math.max(min, bat.pos.x + Math.cos(angle) * bat.speed * dt));
    const y = Math.min(ROWS * TILE_SIZE - min, Math.max(min, bat.pos.y + Math.sin(angle) * bat.speed * dt));
    bat.pos = k.vec2(x, y);
}

/** Skeletons hold four to six tiles off, circle you, and throw bones when they can see you. */
function _updateSkeleton(sk, nx, ny, dist, dt) {
    const near = TILE_SIZE * 3.5, far = TILE_SIZE * 6;
    let mx = 0, my = 0;
    if (dist > far) { mx = nx; my = ny; }
    else if (dist < near) { mx = -nx; my = -ny; }
    else { mx = -ny * sk.strafe; my = nx * sk.strafe; }
    const half = TILE_SIZE * 0.27;
    if (!_moveBox(sk, mx * sk.speed * dt, my * sk.speed * dt, half, TILE_SIZE * 0.38)) sk.strafe *= -1;

    sk.throwTimer -= dt;
    if (sk.throwTimer <= 0 && dist < TILE_SIZE * 11 && _lineOfSight(sk.pos, player.pos)) {
        sk.throwTimer = BONE_COOLDOWN;
        _throwBone(sk.pos, nx, ny);
    }
}

function _throwBone(from, nx, ny) {
    playThrow();
    const bone = k.add([
        k.pos(from),
        k.rect(12, 4),
        k.color(235, 230, 210),
        k.anchor('center'),
        k.rotate(0),
        k.z(9),
        'dungeon', 'bone',
        { vx: nx * BONE_SPEED, vy: ny * BONE_SPEED },
    ]);
    bone.onUpdate(() => {
        if (state.isOver || state.isPaused || descending) return;
        const dt = k.dt();
        bone.pos = k.vec2(bone.pos.x + bone.vx * dt, bone.pos.y + bone.vy * dt);
        bone.angle += 720 * dt;
        if (_isWallAt(bone.pos.x, bone.pos.y)) { k.destroy(bone); return; }
        if (Math.hypot(player.pos.x - bone.pos.x, player.pos.y - bone.pos.y) < 14) {
            k.destroy(bone);
            _damagePlayer(BONE_DAMAGE);
        }
    });
}

function _damageEnemy(enemy, amount, dir) {
    if (enemy.hitTimer > 0) return; // brief i-frames per hit to avoid multi-tick damage
    enemy.hitTimer = 0.15;
    enemy.hp -= amount;
    playHit();

    // White flash (an rgb value, not a color() component)
    enemy.color = k.rgb(255, 255, 255);
    k.wait(0.08, () => {
        if (enemy.exists()) enemy.color = k.rgb(...enemy.baseColor);
    });
    // Knockback
    _moveBox(enemy, dir.x * 12, dir.y * 12, TILE_SIZE * 0.3, TILE_SIZE * 0.3);

    if (enemy.hp <= 0) {
        playEnemyDeath();
        state.addScore(enemy.scoreValue);
        events.emit('enemyKilled', enemy);
        k.destroy(enemy);
        state.foesLeft -= 1;
        if (state.foesLeft === 0) _openExit();
    }
}

// ============================================================
// Pickups
// ============================================================

function _spawnTreasure() {
    const count = 3 + Math.floor(state.level / 3);
    for (let i = 0; i < count; i++) {
        const c = _tileCenter(_freeTile(3, occupied));
        const gem = k.add([
            k.pos(c),
            k.rect(TILE_SIZE * 0.4, TILE_SIZE * 0.4),
            k.color(...COLORS.gold),
            k.outline(2, k.rgb(140, 100, 0)),
            k.anchor('center'),
            k.z(5),
            'dungeon', 'treasure',
            { value: 25 + state.level * 5, bob: Math.random() * 10, baseY: c.y },
        ]);
        gem.onUpdate(() => {
            if (state.isOver || state.isPaused || !player) return;
            gem.bob += k.dt() * 4;
            gem.pos = k.vec2(gem.pos.x, gem.baseY + Math.sin(gem.bob) * 3);
            if (Math.hypot(player.pos.x - gem.pos.x, player.pos.y - gem.pos.y) < TILE_SIZE * 0.6) {
                playPickup();
                state.addScore(gem.value);
                events.emit('treasureCollected', gem.value);
                k.destroy(gem);
            }
        });
    }
}

function _spawnPotion() {
    const c = _tileCenter(_freeTile(4, occupied));
    const potion = k.add([
        k.pos(c),
        k.circle(TILE_SIZE * 0.22),
        k.color(...COLORS.potion),
        k.outline(2, k.rgb(90, 20, 30)),
        k.anchor('center'),
        k.z(5),
        'dungeon', 'potion',
    ]);
    potion.add([k.pos(0, -TILE_SIZE * 0.26), k.rect(5, 6), k.color(170, 140, 110), k.anchor('center')]);
    potion.onUpdate(() => {
        if (state.isOver || state.isPaused || !player) return;
        if (Math.hypot(player.pos.x - potion.pos.x, player.pos.y - potion.pos.y) < TILE_SIZE * 0.6) {
            playPickup();
            state.heal(POTION_HEAL);
            events.emit('potionDrunk', POTION_HEAL);
            k.destroy(potion);
        }
    });
}

// ============================================================
// Debug hooks (exposed as window.__ih with ?debug=1; see dev/README.md)
// ============================================================

let godMode = false;

export const debug = {
    get player() { return player; },
    get exitOpen() { return exitOpen; },
    get swings() { return swings; },
    god(on = true) { godMode = on; },
    killAll() {
        for (const e of k.get('enemy')) {
            e.hitTimer = 0;
            _damageEnemy(e, 1e9, k.vec2(0, 0));
        }
    },
    /** Put the player on the exit (it still has to be open to use). */
    toExit() { player.pos = exit.pos.clone(); },
    toFloor(n) {
        k.destroyAll('dungeon');
        state.level = n;
        _buildFloor();
    },
    /** Facts about the current floor that must always hold. */
    check() {
        let floorTiles = 0;
        for (const row of grid) for (const v of row) if (v === 0) floorTiles++;
        const reach = new Set(reachable.map(({ tx, ty }) => `${tx},${ty}`));
        const tileOf = (p) => `${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)}`;
        const walkers = k.get('enemy').filter((e) => e.type !== 'bat');
        return {
            floor: state.level,
            floorTiles,
            reachable: reachable.length,
            exitReachable: reach.has(tileOf(exit.pos)),
            walkersReachable: walkers.every((e) => reach.has(tileOf(e.pos))),
            enemies: k.get('enemy').length,
            types: [...new Set(k.get('enemy').map((e) => e.type))].sort(),
            foesLeft: state.foesLeft,
            potions: k.get('potion').length,
        };
    },
};
