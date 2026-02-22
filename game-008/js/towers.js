/**
 * towers.js — Tower placement, auto-fire, upgrade, sell.
 *
 * Phase 4: Full tower economy — buy, place, upgrade, sell.
 *
 * Public API:
 *   initTowers(k)
 *   placeTowerAt(k, type, col, row)   — called from shop/click handler
 *   getTowerAt(col, row)              — returns tower data or null
 *   sellTowerAt(k, col, row)
 *   upgradeTowerAt(k, col, row)
 *   enterPlacementMode(type)
 *   exitPlacementMode()
 */

import {
    TILE_SIZE, GRID_COLS,
    GRID_OFFSET_X, GRID_OFFSET_Y,
    TOWER_DEFS,
    COLORS, SELL_REFUND_RATE,
    TOWER_MAX_HP, TOWER_REPAIR_COST, TOWER_SHOCKWAVE_RADIUS,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { tileToWorld, isTowerSlot, isNodeAt, worldToTile, removeNode, destroyNodeEntity } from './grid.js';
import { hitCentipedeAt } from './centipede.js';
import { hitEnemyAt }     from './enemies.js';
import { playTowerPlace, playTowerSell, playTowerUpgrade, playTowerHit, playTowerExplosion } from './sounds.js';
import { spawnShockwave } from './player.js';

// ============================================================
// Tower object schema (stored in state.towers map)
// ============================================================
// {
//   type:       string,      // key from TOWER_DEFS
//   col, row:   number,
//   tier:       0|1|2,       // 0 = base, 1 = T2, 2 = T3
//   totalSpent: number,      // cumulative gold invested (for sell calc)
//   hp:         number,      // current HP (max = TOWER_MAX_HP)
//   maxHp:      number,      // max HP (= TOWER_MAX_HP)
//   // Effective stats (base + upgrades applied):
//   damage:     number,
//   fireRate:   number,      // seconds per shot
//   range:      number,      // tiles
//   // Special fields vary per type
//   pellets:    number,      // scatter
//   slowFactor: number,      // freeze
//   slowDuration: number,    // freeze
//   chainCount: number,      // tesla
//   splashRadius: number,    // mortar
//   destroysNodes: boolean,  // mortar
//   dualShot:   boolean,     // blaster T3
//   // Firing state (not persisted):
//   cooldown:   number,      // seconds until next shot
//   // Kaplay entities (not persisted):
//   entities:   [],          // array of k entities for this tower
// }

// ============================================================
// Module state
// ============================================================

let _k;
let _placementMode = false;   // are we placing a tower right now?
let _placementType = null;    // which tower type we're placing

// Hover highlight entity (shown over the hovered tower slot in placement mode)
let _hoverEnt = null;

// ============================================================
// Public init
// ============================================================

export function initTowers(k) {
    _k = k;

    // Handle shooter projectile hits on towers
    events.on('shooterHitTower', (col, row) => {
        damageTowerAt(k, col, row);
    });

    // Per-frame: fire all placed towers
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;
        const dt = k.dt();
        for (const tower of state.towers.values()) {
            _updateTower(k, tower, dt);
        }
    });

    // Click on the grid
    k.onClick(() => {
        if (state.isGameOver) return;
        const mousePos = k.mousePos();
        const tile = worldToTile(mousePos.x, mousePos.y);
        if (!tile) return;
        const { col, row } = tile;

        if (_placementMode && _placementType) {
            _tryPlace(k, _placementType, col, row);
        } else if (state.hasTower(col, row)) {
            // Let shop.js handle the upgrade/sell popup via event
            events.emit('towerClicked', col, row);
        }
    });

    // Track mouse for placement hover highlight
    k.onUpdate(() => {
        if (!_placementMode) {
            if (_hoverEnt && _hoverEnt.exists()) { _hoverEnt.destroy(); _hoverEnt = null; }
            return;
        }
        const mp = k.mousePos();
        const tile = worldToTile(mp.x, mp.y);
        if (!tile) {
            if (_hoverEnt && _hoverEnt.exists()) { _hoverEnt.destroy(); _hoverEnt = null; }
            return;
        }
        const { col, row } = tile;
        const isValidSlot = isTowerSlot(col, row) && !isNodeAt(col, row) && !state.hasTower(col, row);
        const px = GRID_OFFSET_X + col * TILE_SIZE;
        const py = GRID_OFFSET_Y + row * TILE_SIZE;

        if (!_hoverEnt || !_hoverEnt.exists()) {
            _hoverEnt = k.add([
                k.pos(px, py),
                k.rect(TILE_SIZE, TILE_SIZE),
                k.color(isValidSlot ? 0 : 200, isValidSlot ? 200 : 0, 0),
                k.opacity(0.4),
                k.z(25),
                'towerHover',
            ]);
        } else {
            _hoverEnt.pos   = k.vec2(px, py);
            _hoverEnt.color = k.rgb(isValidSlot ? 0 : 200, isValidSlot ? 200 : 0, 0);
        }
    });

    // Cancel placement on right-click or escape
    k.onKeyPress('escape', () => {
        if (_placementMode) exitPlacementMode();
    });
}

// ============================================================
// Placement mode
// ============================================================

export function enterPlacementMode(type) {
    _placementMode = true;
    _placementType = type;
    state.isPaused = true;
    events.emit('placementModeChanged', true, type);
}

export function exitPlacementMode() {
    _placementMode = false;
    _placementType = null;
    state.isPaused = false;
    if (_hoverEnt && _hoverEnt.exists()) { _hoverEnt.destroy(); _hoverEnt = null; }
    events.emit('placementModeChanged', false, null);
}

export function isInPlacementMode() { return _placementMode; }

// ============================================================
// Tower creation
// ============================================================

function _tryPlace(k, type, col, row) {
    if (!isTowerSlot(col, row))       { _flashInvalid(); return; }
    if (state.hasTower(col, row))     { _flashInvalid(); return; }
    if (isNodeAt(col, row))           { _flashInvalid(); return; }

    const def = TOWER_DEFS[type];
    if (!def) return;
    if (!state.spend(def.cost)) {
        events.emit('notEnoughGold');
        return;
    }

    placeTowerAt(k, type, col, row, def.cost);
    exitPlacementMode();
}

export function placeTowerAt(k, type, col, row, spent) {
    const def = TOWER_DEFS[type];
    const tower = {
        type,
        col,
        row,
        tier:         0,
        totalSpent:   spent ?? def.cost,
        hp:           TOWER_MAX_HP,
        maxHp:        TOWER_MAX_HP,
        damage:       def.damage,
        fireRate:     def.fireRate,
        range:        def.range,
        // Type-specific
        pellets:      def.pellets      ?? 1,
        slowFactor:   def.slowFactor   ?? 0,
        slowDuration: def.slowDuration ?? 0,
        chainCount:   def.chainCount   ?? 0,
        splashRadius: def.splashRadius ?? 0,
        destroysNodes:def.destroysNodes ?? false,
        dualShot:     false,
        // Runtime — start at full cooldown so the tower doesn't fire on frame 1
        cooldown: def.fireRate,
        entities: [],
    };

    state.setTower(col, row, tower);
    _spawnTowerEntities(k, tower);
    playTowerPlace();
    events.emit('towerPlaced', type, col, row);
    events.emit('goldChanged', state.gold);
}

// ============================================================
// Sell / upgrade
// ============================================================

export function sellTowerAt(k, col, row) {
    const tower = state.getTower(col, row);
    if (!tower) return;

    const refund = Math.floor(tower.totalSpent * SELL_REFUND_RATE);
    _destroyTowerEntities(tower);
    state.removeTower(col, row);
    state.earn(refund);
    playTowerSell();
    events.emit('towerSold', col, row);
    events.emit('goldChanged', state.gold);
}

export function upgradeTowerAt(k, col, row) {
    const tower = state.getTower(col, row);
    if (!tower) return;
    const def = TOWER_DEFS[tower.type];
    if (!def || tower.tier >= def.upgrades.length) return;

    const upg = def.upgrades[tower.tier];
    if (!state.spend(upg.cost)) {
        events.emit('notEnoughGold');
        return;
    }

    tower.totalSpent += upg.cost;
    tower.tier       += 1;
    tower.damage     += (upg.damage      ?? 0);
    tower.fireRate   += (upg.fireRate    ?? 0); // negative = faster
    tower.range      += (upg.range       ?? 0);
    if (upg.pellets)      tower.pellets      += upg.pellets;
    if (upg.slowFactor)   tower.slowFactor   += upg.slowFactor;
    if (upg.slowDuration) tower.slowDuration += upg.slowDuration;
    if (upg.chainCount)   tower.chainCount   += upg.chainCount;
    if (upg.splashRadius) tower.splashRadius += upg.splashRadius;
    if (upg.dualShot)     tower.dualShot      = true;

    tower.fireRate = Math.max(0.1, tower.fireRate); // clamp

    // Rebuild visual with upgrade indicator
    _destroyTowerEntities(tower);
    _spawnTowerEntities(k, tower);

    playTowerUpgrade();
    events.emit('towerUpgraded', col, row, tower.tier);
    events.emit('goldChanged', state.gold);
}

export function getTowerAt(col, row) {
    return state.getTower(col, row) ?? null;
}

// ============================================================
// Tower damage / repair
// ============================================================

/**
 * Deal 1 point of damage to the tower at (col, row).
 * If HP reaches 0 the tower is destroyed with a shockwave.
 * chainDepth limits cascading explosions (max 1 chain).
 * Returns true if a tower was hit.
 */
export function damageTowerAt(k, col, row, chainDepth = 0) {
    const tower = state.getTower(col, row);
    if (!tower) return false;

    tower.hp -= 1;
    playTowerHit();
    events.emit('towerDamaged', col, row, tower.hp);

    if (tower.hp <= 0) {
        // Tower destroyed by enemy fire — no refund
        _destroyTowerEntities(tower);
        state.removeTower(col, row);
        events.emit('towerDestroyed', col, row);
        events.emit('goldChanged', state.gold);
        // Trigger shockwave
        _towerShockwave(k, col, row, chainDepth);
    } else {
        // Refresh visual to show damage tint
        _destroyTowerEntities(tower);
        _spawnTowerEntities(k, tower);
    }
    return true;
}

/**
 * Shockwave from a destroyed tower at (col, row).
 * Damages all enemies and other towers within TOWER_SHOCKWAVE_RADIUS tiles.
 * chainDepth: chains only propagate one level deep so a chain of towers
 * dying doesn't cause infinite recursion.
 */
function _towerShockwave(k, col, row, chainDepth) {
    playTowerExplosion();

    const center = tileToWorld(col, row);

    // Visual: two expanding rings reusing the smart-bomb shockwave (orange fire palette)
    spawnShockwave(k, center.x, center.y, [255, 140, 20]);
    spawnShockwave(k, center.x, center.y, [255, 220, 80], 0.08);

    // --- Damage enemies within radius ---
    // Centipede segments
    for (const c of [...state.centipedes]) {
        for (const seg of [...c.segments]) {
            const dc = Math.abs(seg.col - col);
            const dr = Math.abs(seg.row - row);
            if (dc <= TOWER_SHOCKWAVE_RADIUS && dr <= TOWER_SHOCKWAVE_RADIUS) {
                hitCentipedeAt(seg.col, seg.row);
            }
        }
    }
    // Special enemies (flea, spider, scorpion, shooter)
    for (const enemy of [...state.enemies]) {
        if (enemy.dead || enemy.col == null) continue;
        const dc = Math.abs(enemy.col - col);
        const dr = Math.abs(enemy.row - row);
        if (dc <= TOWER_SHOCKWAVE_RADIUS && dr <= TOWER_SHOCKWAVE_RADIUS) {
            hitEnemyAt(enemy.col, enemy.row);
        }
    }

    // --- Damage adjacent towers (chain explosions capped at depth 1) ---
    if (chainDepth < 1) {
        // Collect targets first so we don't mutate the map while iterating
        const neighborTargets = [];
        for (const [, t] of state.towers) {
            if (t.col === col && t.row === row) continue; // skip self (already removed)
            const dc = Math.abs(t.col - col);
            const dr = Math.abs(t.row - row);
            if (dc <= TOWER_SHOCKWAVE_RADIUS && dr <= TOWER_SHOCKWAVE_RADIUS) {
                neighborTargets.push({ col: t.col, row: t.row });
            }
        }
        for (const nb of neighborTargets) {
            damageTowerAt(k, nb.col, nb.row, chainDepth + 1);
        }
    }
}

/**
 * Repair the tower at (col, row) by 1 HP.
 * Costs TOWER_REPAIR_COST gold per HP.
 * Returns true if repair succeeded.
 */
export function repairTowerAt(k, col, row) {
    const tower = state.getTower(col, row);
    if (!tower || tower.hp >= tower.maxHp) return false;

    const missingHp = tower.maxHp - tower.hp;
    const cost = missingHp * TOWER_REPAIR_COST;
    if (!state.spend(cost)) {
        events.emit('notEnoughGold');
        return false;
    }

    tower.hp = tower.maxHp;
    // Rebuild visual to remove damage tint
    _destroyTowerEntities(tower);
    _spawnTowerEntities(k, tower);
    playTowerUpgrade(); // reuse the upgrade chime — sounds like a repair
    events.emit('towerRepaired', col, row);
    events.emit('goldChanged', state.gold);
    return true;
}

// ============================================================
// Tower update (auto-fire)
// ============================================================

function _updateTower(k, tower, dt) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) return;

    const target = _findTarget(tower);
    if (!target) return;

    tower.cooldown = tower.fireRate;
    _fireTower(k, tower, target);
}

/**
 * Find the best target for this tower.
 * Priority: centipede head > body > other enemies (Phase 5).
 * Returns { col, row } or null.
 */
function _findTarget(tower) {
    const rangeSquared = (tower.range * TILE_SIZE) ** 2;
    const wx = GRID_OFFSET_X + tower.col * TILE_SIZE + TILE_SIZE / 2;
    const wy = GRID_OFFSET_Y + tower.row * TILE_SIZE + TILE_SIZE / 2;

    let best    = null;
    let bestDist = Infinity;
    let bestPriority = -1;

    for (const c of state.centipedes) {
        for (let i = 0; i < c.segments.length; i++) {
            const seg = c.segments[i];
            const sx = GRID_OFFSET_X + seg.col * TILE_SIZE + TILE_SIZE / 2;
            const sy = GRID_OFFSET_Y + seg.row * TILE_SIZE + TILE_SIZE / 2;
            const d2 = (sx - wx) ** 2 + (sy - wy) ** 2;
            if (d2 > rangeSquared) continue;

            const priority = (i === 0) ? 1 : 0; // head gets priority 1
            if (priority > bestPriority || (priority === bestPriority && d2 < bestDist)) {
                best = { col: seg.col, row: seg.row, centipede: c, segIndex: i };
                bestDist = d2;
                bestPriority = priority;
            }
        }
    }

    // Also check non-centipede enemies (flea, spider, scorpion)
    // They compete at body-level priority (0) — same as centipede body segments
    for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (enemy.col == null) continue;
        const sx = GRID_OFFSET_X + enemy.col * TILE_SIZE + TILE_SIZE / 2;
        const sy = GRID_OFFSET_Y + enemy.row * TILE_SIZE + TILE_SIZE / 2;
        const d2 = (sx - wx) ** 2 + (sy - wy) ** 2;
        if (d2 > rangeSquared) continue;
        const priority = 0; // same as centipede body
        if (priority > bestPriority || (priority === bestPriority && d2 < bestDist)) {
            best = { col: enemy.col, row: enemy.row, enemy };
            bestDist = d2;
            bestPriority = priority;
        }
    }

    return best;
}

function _fireTower(k, tower, target) {
    switch (tower.type) {
        case 'blaster': _fireBlaster(k, tower, target); break;
        case 'sniper':  _fireSniper(k, tower, target);  break;
        case 'scatter': _fireScatter(k, tower, target); break;
        case 'freeze':  _fireFreeze(k, tower, target);  break;
        case 'tesla':   _fireTesla(k, tower, target);   break;
        case 'mortar':  _fireMortar(k, tower, target);  break;
    }
}

// ---- Blaster ----
function _fireBlaster(k, tower, target) {
    _spawnTowerBullet(k, tower, target.col, target.row, tower.damage, COLORS.playerBullet);
    if (tower.dualShot) {
        // Second shot — slight offset toward adjacent segment
        const altTarget = { col: target.col, row: Math.min(target.row + 1, 17) };
        _spawnTowerBullet(k, tower, altTarget.col, altTarget.row, tower.damage, COLORS.playerBullet);
    }
}

// ---- Sniper — pierces all segments in a vertical column ----
function _fireSniper(k, tower, target) {
    // Fire a beam down (or up) from tower toward target column.
    // Hit every centipede segment in that column within range.
    const col = target.col;
    const towerWX = GRID_OFFSET_X + tower.col * TILE_SIZE + TILE_SIZE / 2;
    const towerWY = GRID_OFFSET_Y + tower.row * TILE_SIZE + TILE_SIZE / 2;

    // Find all segments in this column within range and hit them all
    const hits = [];
    for (const c of [...state.centipedes]) {
        for (const seg of c.segments) {
            if (seg.col !== col) continue;
            const sx = GRID_OFFSET_X + seg.col * TILE_SIZE + TILE_SIZE / 2;
            const sy = GRID_OFFSET_Y + seg.row * TILE_SIZE + TILE_SIZE / 2;
            const d2 = (sx - towerWX) ** 2 + (sy - towerWY) ** 2;
            if (d2 <= (tower.range * TILE_SIZE) ** 2) {
                hits.push({ col: seg.col, row: seg.row });
            }
        }
    }
    for (const h of hits) {
        _dealDamage(h.col, h.row, tower.damage);
    }

    // Visual: a beam from tower to target
    _spawnBeam(k, tower, target.col, target.row, [255, 255, 255]);
}

// ---- Scatter — 3 pellets in spread ----
function _fireScatter(k, tower, target) {
    const offsets = [-1, 0, 1]; // col offset for each pellet
    for (const off of offsets.slice(0, tower.pellets)) {
        const tc = Math.max(0, Math.min(GRID_COLS - 1, target.col + off));
        _spawnTowerBullet(k, tower, tc, target.row, tower.damage, COLORS.flea);
    }
}

// ---- Freeze — slows centipedes hit ----
function _fireFreeze(k, tower, target) {
    _dealDamage(target.col, target.row, tower.damage);

    // Apply slow to the centipede that has a segment at target
    for (const c of state.centipedes) {
        const hit = c.segments.some(s => s.col === target.col && s.row === target.row);
        if (hit) {
            c.applySlow(tower.slowFactor, tower.slowDuration);
            break;
        }
    }

    _spawnTowerBullet(k, tower, target.col, target.row, 0, [100, 230, 255]);
}

// ---- Tesla — chains to nearby segments ----
function _fireTesla(k, tower, target) {
    _dealDamage(target.col, target.row, tower.damage);
    _spawnArc(k, tower, target, [255, 230, 50]);

    // Find up to chainCount additional adjacent segments to chain to
    let chainTargets = [];
    const chainRange = 3 * TILE_SIZE;
    const visited = new Set([`${target.col},${target.row}`]);

    for (const c of state.centipedes) {
        for (const seg of c.segments) {
            const key = `${seg.col},${seg.row}`;
            if (visited.has(key)) continue;
            const tx = GRID_OFFSET_X + target.col * TILE_SIZE + TILE_SIZE / 2;
            const ty = GRID_OFFSET_Y + target.row * TILE_SIZE + TILE_SIZE / 2;
            const sx = GRID_OFFSET_X + seg.col * TILE_SIZE + TILE_SIZE / 2;
            const sy = GRID_OFFSET_Y + seg.row * TILE_SIZE + TILE_SIZE / 2;
            const d2 = (sx - tx) ** 2 + (sy - ty) ** 2;
            if (d2 <= chainRange ** 2) {
                chainTargets.push({ col: seg.col, row: seg.row });
                visited.add(key);
            }
            if (chainTargets.length >= tower.chainCount) break;
        }
        if (chainTargets.length >= tower.chainCount) break;
    }

    for (const ct of chainTargets) {
        _dealDamage(ct.col, ct.row, tower.damage);
        _spawnArc(k, { col: target.col, row: target.row }, ct, [255, 200, 30]);
    }
}

// ---- Mortar — AOE splash ----
function _fireMortar(k, tower, target) {
    // Small "shell" visual then explosion
    _spawnShell(k, tower, target, () => {
        // On impact
        _spawnExplosion(k, target.col, target.row, tower.splashRadius);

        // Damage all segments within splashRadius tiles
        for (const c of [...state.centipedes]) {
            for (const seg of [...c.segments]) {
                const dx = Math.abs(seg.col - target.col);
                const dy = Math.abs(seg.row - target.row);
                if (dx <= tower.splashRadius && dy <= tower.splashRadius) {
                    _dealDamage(seg.col, seg.row, tower.damage);
                }
            }
        }

        // Optionally destroy nodes in splash radius
        if (tower.destroysNodes) {
            for (let dc = -tower.splashRadius; dc <= tower.splashRadius; dc++) {
                for (let dr = -tower.splashRadius; dr <= tower.splashRadius; dr++) {
                    const nc = target.col + dc;
                    const nr = target.row + dr;
                    if (isNodeAt(nc, nr)) {
                        removeNode(nc, nr);
                        destroyNodeEntity(k, nc, nr);
                    }
                }
            }
        }
    });
}

// ============================================================
// Damage helper
// ============================================================

function _dealDamage(col, row, damage) {
    // Try centipede first, then special enemies
    for (let i = 0; i < damage; i++) {
        if (hitCentipedeAt(col, row)) continue;
        if (hitEnemyAt(col, row)) continue;
        break; // nothing left at this tile
    }
}

// ============================================================
// Visual helpers — tower bullets & effects
// ============================================================

const BULLET_SPEED = 480; // px/s

function _spawnTowerBullet(k, tower, targetCol, targetRow, damage, color) {
    const from = tileToWorld(tower.col, tower.row);
    const to   = tileToWorld(targetCol, targetRow);
    const dx   = to.x - from.x;
    const dy   = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vx   = (dx / dist) * BULLET_SPEED;
    const vy   = (dy / dist) * BULLET_SPEED;

    let bx = from.x, by = from.y;
    let elapsed = 0;
    const travelTime = dist / BULLET_SPEED;

    const ent = k.add([
        k.pos(bx, by),
        k.circle(3),
        k.color(...color),
        k.anchor('center'),
        k.z(15),
        'towerBullet',
    ]);

    ent.onUpdate(() => {
        elapsed += k.dt();
        bx += vx * k.dt();
        by += vy * k.dt();
        if (ent.exists()) ent.pos = k.vec2(bx, by);

        if (elapsed >= travelTime) {
            // Impact
            if (ent.exists()) ent.destroy();
            if (damage > 0) _dealDamage(targetCol, targetRow, damage);
        }
    });
}

function _spawnBeam(k, tower, targetCol, targetRow, color) {
    const from = tileToWorld(tower.col, tower.row);
    const to   = tileToWorld(targetCol, targetRow);

    const beam = k.add([
        k.pos(from.x, from.y),
        k.rect(2, Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)),
        k.color(...color),
        k.rotate(Math.atan2(to.x - from.x, from.y - to.y) * 180 / Math.PI),
        k.anchor('top'),
        k.opacity(0.9),
        k.z(14),
        'towerEffect',
    ]);

    let t = 0;
    beam.onUpdate(() => {
        t += k.dt();
        if (t > 0.15) { if (beam.exists()) beam.destroy(); return; }
        if (beam.exists()) beam.opacity = 0.9 * (1 - t / 0.15);
    });
}

function _spawnArc(k, fromTile, toTile, color) {
    // Simple flash dot at source and dest
    const from = tileToWorld(fromTile.col, fromTile.row);
    const to   = tileToWorld(toTile.col,   toTile.row);

    for (const pos of [from, to]) {
        const spark = k.add([
            k.pos(pos.x, pos.y),
            k.circle(8),
            k.color(...color),
            k.anchor('center'),
            k.opacity(0.9),
            k.z(14),
            'towerEffect',
        ]);
        let t = 0;
        spark.onUpdate(() => {
            t += k.dt();
            if (t > 0.12) { if (spark.exists()) spark.destroy(); return; }
            if (spark.exists()) spark.opacity = 0.9 * (1 - t / 0.12);
        });
    }
}

function _spawnShell(k, tower, target, onImpact) {
    const from = tileToWorld(tower.col, tower.row);
    const to   = tileToWorld(target.col, target.row);
    const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2) || 1;
    const travelTime = dist / (BULLET_SPEED * 0.6); // mortars are slower

    let bx = from.x, by = from.y;
    let elapsed = 0;

    const ent = k.add([
        k.pos(bx, by),
        k.circle(5),
        k.color(200, 200, 80),
        k.anchor('center'),
        k.z(15),
        'towerBullet',
    ]);

    ent.onUpdate(() => {
        elapsed += k.dt();
        const t = elapsed / travelTime;
        bx = from.x + (to.x - from.x) * t;
        // Arc upward
        by = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 40;
        if (ent.exists()) ent.pos = k.vec2(bx, by);

        if (elapsed >= travelTime) {
            if (ent.exists()) ent.destroy();
            onImpact();
        }
    });
}

function _spawnExplosion(k, col, row, radius) {
    const center = tileToWorld(col, row);
    const explSize = (radius * 2 + 1) * TILE_SIZE;

    const expl = k.add([
        k.pos(center.x, center.y),
        k.circle(explSize / 2),
        k.color(255, 140, 20),
        k.anchor('center'),
        k.opacity(0.7),
        k.z(16),
        'towerEffect',
    ]);

    let t = 0;
    expl.onUpdate(() => {
        t += k.dt();
        if (t > 0.3) { if (expl.exists()) expl.destroy(); return; }
        if (expl.exists()) expl.opacity = 0.7 * (1 - t / 0.3);
    });
}

// ============================================================
// Tower visual entities
// ============================================================

function _spawnTowerEntities(k, tower) {
    const def = TOWER_DEFS[tower.type];
    const { x, y } = tileToWorld(tower.col, tower.row);
    const px = x - TILE_SIZE / 2;
    const py = y - TILE_SIZE / 2;
    let [r, g, b] = def.color;

    tower.entities = [];

    // Damage tint: shift colour toward red proportionally to damage taken
    const damageRatio = 1 - (tower.hp / tower.maxHp); // 0 = full, 1 = near-dead
    if (damageRatio > 0) {
        r = Math.min(255, Math.round(r + (255 - r) * damageRatio * 0.7));
        g = Math.max(0,   Math.round(g * (1 - damageRatio * 0.6)));
        b = Math.max(0,   Math.round(b * (1 - damageRatio * 0.6)));
    }

    // Base square
    const base = k.add([
        k.pos(x, y),
        k.rect(TILE_SIZE - 4, TILE_SIZE - 4, { radius: 3 }),
        k.color(r, g, b),
        k.outline(tower.tier > 0 ? 2 : 1, k.rgb(
            Math.min(255, r + 60),
            Math.min(255, g + 60),
            Math.min(255, b + 60)
        )),
        k.anchor('center'),
        k.z(5),
        'tower',
        { col: tower.col, row: tower.row },
    ]);
    tower.entities.push(base);

    // Type-specific decoration
    _addTowerDecoration(k, tower, x, y, r, g, b);

    // Tier badge (T2/T3)
    if (tower.tier > 0) {
        const badge = k.add([
            k.pos(x + TILE_SIZE / 2 - 8, y - TILE_SIZE / 2 + 2),
            k.text(tower.tier === 1 ? 'T2' : 'T3', { size: 8 }),
            k.color(255, 230, 50),
            k.anchor('right'),
            k.z(7),
            'tower',
            { col: tower.col, row: tower.row },
        ]);
        tower.entities.push(badge);
    }

    // HP pips (bottom of tower, only shown if damaged)
    if (tower.hp < tower.maxHp) {
        for (let i = 0; i < tower.maxHp; i++) {
            const filled = i < tower.hp;
            const pip = k.add([
                k.pos(x - (tower.maxHp - 1) * 4 + i * 8, y + TILE_SIZE / 2 - 4),
                k.circle(3),
                k.color(filled ? 80 : 200, filled ? 200 : 40, filled ? 80 : 40),
                k.anchor('center'),
                k.z(7),
                'tower',
                { col: tower.col, row: tower.row },
            ]);
            tower.entities.push(pip);
        }
    }
}

function _addTowerDecoration(k, tower, cx, cy, r, g, b) {
    let ent;
    switch (tower.type) {
        case 'blaster':
            // Barrel: small rect pointing up
            ent = k.add([
                k.pos(cx, cy - TILE_SIZE * 0.22),
                k.rect(6, 14, { radius: 2 }),
                k.color(Math.min(255, r + 80), Math.min(255, g + 80), 255),
                k.anchor('center'),
                k.z(6),
                'tower',
                { col: tower.col, row: tower.row },
            ]);
            tower.entities.push(ent);
            break;

        case 'sniper':
            // Long thin barrel
            ent = k.add([
                k.pos(cx, cy - TILE_SIZE * 0.3),
                k.rect(4, 22, { radius: 1 }),
                k.color(240, 240, 255),
                k.anchor('center'),
                k.z(6),
                'tower',
                { col: tower.col, row: tower.row },
            ]);
            tower.entities.push(ent);
            break;

        case 'scatter':
            // Three tiny barrels fanning out
            for (let i = -1; i <= 1; i++) {
                ent = k.add([
                    k.pos(cx + i * 6, cy - TILE_SIZE * 0.2),
                    k.rect(4, 10, { radius: 1 }),
                    k.color(255, 180, 80),
                    k.anchor('center'),
                    k.z(6),
                    'tower',
                    { col: tower.col, row: tower.row },
                ]);
                tower.entities.push(ent);
            }
            break;

        case 'freeze':
            // Diamond (rotated square)
            ent = k.add([
                k.pos(cx, cy),
                k.rect(18, 18, { radius: 2 }),
                k.color(80, 220, 240),
                k.rotate(45),
                k.anchor('center'),
                k.z(6),
                'tower',
                { col: tower.col, row: tower.row },
            ]);
            tower.entities.push(ent);
            break;

        case 'tesla':
            // Zigzag "lightning" dot above center
            ent = k.add([
                k.pos(cx, cy - 8),
                k.circle(6),
                k.color(255, 240, 50),
                k.anchor('center'),
                k.z(6),
                'tower',
                { col: tower.col, row: tower.row },
            ]);
            tower.entities.push(ent);
            break;

        case 'mortar':
            // Large angled barrel
            ent = k.add([
                k.pos(cx + 5, cy - 8),
                k.rect(8, 18, { radius: 2 }),
                k.color(160, 160, 160),
                k.rotate(-25),
                k.anchor('center'),
                k.z(6),
                'tower',
                { col: tower.col, row: tower.row },
            ]);
            tower.entities.push(ent);
            break;
    }
}

function _destroyTowerEntities(tower) {
    for (const e of tower.entities) {
        if (e && e.exists()) e.destroy();
    }
    tower.entities = [];
}

// ============================================================
// Range indicator (shown on hover, called from shop.js)
// ============================================================

let _rangeEnt = null;

export function showRangeFor(k, col, row) {
    hideRange(k);
    const tower = state.getTower(col, row);
    if (!tower) return;
    const { x, y } = tileToWorld(col, row);
    const rangeR = tower.range * TILE_SIZE;

    _rangeEnt = k.add([
        k.pos(x, y),
        k.circle(rangeR),
        k.color(100, 200, 255),
        k.opacity(0.12),
        k.outline(1, k.rgb(100, 200, 255)),
        k.anchor('center'),
        k.z(4),
        'rangeIndicator',
    ]);
}

export function hideRange(k) {
    k.destroyAll('rangeIndicator');
    _rangeEnt = null;
}

// ============================================================
// Flash invalid placement
// ============================================================

function _flashInvalid() {
    events.emit('invalidPlacement');
}
