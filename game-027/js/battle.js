/**
 * battle.js — Battle grid overlay (game-plan §11c, Phase 5).
 *
 * Enemies occupy one or more grid cells. Clearing a line that passes through
 * an enemy cell deals damage (base × combo multiplier). When an enemy reaches
 * 0 HP it is destroyed. Win when all enemies are destroyed.
 *
 * Enemy turns fire every N placements (ENEMY_TURN_INTERVAL). On a turn each
 * enemy may:
 *   'advance'  — spread into an adjacent empty cell (not occupied cells)
 *   'harden'   — gain +1 armor (next hit reduced by 1, min 0)
 *   'attack'   — deal damage to the player's HP bar
 *
 * Failure 3: if player HP reaches 0 → emit levelFailed {reason:'defeated'}.
 * An enemy-caused jam (advance fills the board) is still reported as 'jammed'
 * by the existing jam-check — the turn timer HUD warns the player in advance.
 *
 * BattleManager is created by GameScene alongside LevelManager (for battle
 * levels). It also updates the Grid with enemy occupancy so that canPlace
 * respects enemy cells as obstacles.
 *
 * API:
 *   afterPlacement()   — call AFTER grid.clearLines() + LevelManager.afterPlacement()
 *   dispose()
 *   enemies            — live enemy list (for HUD)
 *   playerHp / playerMaxHp
 *   placementsUntilTurn
 *
 * Events emitted:
 *   enemyDamaged       { enemyId, dmg, hpLeft }
 *   enemyDefeated      { enemyId }
 *   enemyTurn          { actions }
 *   playerDamaged      { dmg, hpLeft }
 *   levelFailed        { reason: 'defeated' }        — when player HP reaches 0
 *   battleStateChanged { enemies, playerHp, placementsUntilTurn }
 */

import { events } from './events.js';
import { state }  from './state.js';

export const ENEMY_TURN_INTERVAL = 4;  // enemy acts every N placements
export const BASE_DAMAGE         = 8;  // base damage per cleared line through an enemy

export class BattleManager {
    /**
     * @param {object} levelDef — level definition with `enemies` array
     * @param {object} grid     — Grid instance (to mark enemy cells as obstacles)
     */
    constructor(levelDef, grid) {
        this.def  = levelDef;
        this.grid = grid;
        this._offs = [];
        this._defeated = false;

        const battleDef = levelDef.battle || {};
        this._playerHp    = battleDef.playerHp    || 20;
        this._playerMaxHp = battleDef.playerHp    || 20;
        this._turnInterval = battleDef.turnInterval || ENEMY_TURN_INTERVAL;
        this._placementsSinceTurn = 0;

        // Initialise enemies from the level def.
        this._enemies = (levelDef.enemies || []).map(e => ({
            id:       e.id,
            name:     e.name || 'Enemy',
            cells:    e.cells.map(c => ({ ...c })),  // mutable copies
            hp:       e.hp,
            maxHp:    e.hp,
            armor:    e.armor || 0,
            behavior: e.behavior || ['attack'],   // array of actions in priority order
            damage:   e.damage || 3,              // damage to player per attack
        }));

        // Mark enemy cells as obstacles in the grid.
        this._markGrid();

        // Subscribe to linesCleared to compute damage.
        this._offs.push(events.on('linesCleared', (d) => this._onLinesCleared(d)));

        this._emitState();
    }

    // --- Public API -----------------------------------------------------------

    get enemies()              { return this._enemies; }
    get playerHp()             { return this._playerHp; }
    get playerMaxHp()          { return this._playerMaxHp; }
    get placementsUntilTurn()  { return this._turnInterval - this._placementsSinceTurn; }
    get allDefeated()          { return this._enemies.every(e => e.hp <= 0); }

    afterPlacement() {
        if (this._defeated) return;
        this._placementsSinceTurn += 1;
        if (this._placementsSinceTurn >= this._turnInterval) {
            this._placementsSinceTurn = 0;
            this._doEnemyTurn();
        }
        this._emitState();
    }

    dispose() {
        this._offs.forEach(off => off());
        this._offs = [];
        // Clear enemy obstacles from grid.
        this._unmarkGrid();
    }

    // --- Grid obstacle management -------------------------------------------

    _markGrid() {
        for (const e of this._enemies) {
            if (e.hp <= 0) continue;
            for (const c of e.cells) {
                if (this.grid.inBounds(c.x, c.y)) {
                    if (!this.grid.cells[c.y][c.x]) {
                        this.grid.cells[c.y][c.x] = { tileType: null, enemy: e.id };
                    }
                }
            }
        }
    }

    _unmarkGrid() {
        for (let y = 0; y < this.grid.h; y++) {
            for (let x = 0; x < this.grid.w; x++) {
                if (this.grid.cells[y][x] && this.grid.cells[y][x].enemy) {
                    this.grid.cells[y][x] = null;
                }
            }
        }
    }

    // --- Line clears → damage ------------------------------------------------

    _onLinesCleared({ rows, cols, cells, combo }) {
        const lines = rows.length + cols.length;
        if (lines === 0) return;

        for (const e of this._enemies) {
            if (e.hp <= 0) continue;
            // Count how many of this enemy's cells were cleared.
            const hitsOnEnemy = e.cells.filter(ec =>
                cells.some(c => c.x === ec.x && c.y === ec.y)
            ).length;
            if (hitsOnEnemy === 0) continue;

            const raw   = BASE_DAMAGE * hitsOnEnemy * Math.max(1, combo);
            const dmg   = Math.max(0, raw - e.armor);
            e.hp        = Math.max(0, e.hp - dmg);

            events.emit('enemyDamaged', { enemyId: e.id, dmg, hpLeft: e.hp });

            if (e.hp <= 0) {
                // Remove this enemy's cells from the grid.
                for (const c of e.cells) {
                    if (this.grid.inBounds(c.x, c.y) &&
                        this.grid.cells[c.y][c.x] &&
                        this.grid.cells[c.y][c.x].enemy === e.id) {
                        this.grid.cells[c.y][c.x] = null;
                    }
                }
                events.emit('enemyDefeated', { enemyId: e.id });
            }
        }

        this._emitState();
    }

    // --- Enemy turn ----------------------------------------------------------

    _doEnemyTurn() {
        const actions = [];
        for (const e of this._enemies) {
            if (e.hp <= 0) continue;
            const action = this._pickAction(e);
            if (action) {
                actions.push({ enemyId: e.id, action });
                this._executeAction(e, action);
            }
        }
        events.emit('enemyTurn', { actions });
        this._emitState();
    }

    _pickAction(enemy) {
        for (const behavior of enemy.behavior) {
            if (behavior === 'advance') {
                const target = this._findAdvanceTarget(enemy);
                if (target) return { type: 'advance', target };
            }
            if (behavior === 'harden') {
                return { type: 'harden' };
            }
            if (behavior === 'attack') {
                return { type: 'attack' };
            }
        }
        return null;
    }

    _executeAction(enemy, action) {
        switch (action.type) {
            case 'advance': {
                const { x, y } = action.target;
                if (this.grid.inBounds(x, y) && !this.grid.cells[y][x]) {
                    this.grid.cells[y][x] = { tileType: null, enemy: enemy.id };
                    enemy.cells.push({ x, y });
                }
                break;
            }
            case 'harden':
                enemy.armor += 1;
                break;
            case 'attack': {
                if (this._defeated) break;
                const dmg = enemy.damage;
                this._playerHp = Math.max(0, this._playerHp - dmg);
                events.emit('playerDamaged', { dmg, hpLeft: this._playerHp });
                if (this._playerHp <= 0) {
                    this._defeated = true;
                    state.failed = true;
                    events.emit('levelFailed', { reason: 'defeated' });
                }
                break;
            }
        }
    }

    _findAdvanceTarget(enemy) {
        // Look for an empty adjacent cell to any of this enemy's cells.
        const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
        const occupied = new Set(enemy.cells.map(c => `${c.x},${c.y}`));
        for (const c of enemy.cells) {
            for (const { dx, dy } of dirs) {
                const nx = c.x + dx, ny = c.y + dy;
                if (!this.grid.inBounds(nx, ny)) continue;
                if (occupied.has(`${nx},${ny}`)) continue;
                if (!this.grid.cells[ny][nx]) return { x: nx, y: ny };
            }
        }
        return null;
    }

    // --- State broadcast -----------------------------------------------------

    _emitState() {
        events.emit('battleStateChanged', {
            enemies:              this._enemies,
            playerHp:             this._playerHp,
            playerMaxHp:          this._playerMaxHp,
            placementsUntilTurn:  this.placementsUntilTurn,
        });
    }
}
