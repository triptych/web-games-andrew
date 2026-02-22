/**
 * waves.js — Wave sequencer: spawn centipedes, schedule special enemies,
 * detect wave completion, award gold/score, and trigger the between-wave shop.
 *
 * Phase 5: Complete wave progression with all enemy types.
 *
 * Public API:
 *   initWaves(k)        — call once inside 'game' scene (after initCentipede)
 *   startNextWave()     — advance to the next wave and begin it
 */

import {
    WAVE_DEFS,
    GOLD_PER_WAVE, GOLD_NO_DEATH_BONUS, GOLD_BOSS_BONUS,
    SCORE_WAVE_COMPLETE, SCORE_NO_DEATH_BONUS, SCORE_BOSS_KILL,
    SMART_BOMBS_PER_WAVE,
    ENEMY_ZONE_MAX, GRID_COLS,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { spawnCentipede } from './centipede.js';
import { spawnFlea, spawnSpider, spawnScorpion } from './enemies.js';
import { isInPlacementMode } from './towers.js';
import { openShopOverlay } from './shop.js';
import { playWaveComplete, playWaveStart, playNodeMarchStep, playCountdownTick, playBossAlert, playGameWon } from './sounds.js';
import { removeNode, placeNode, destroyNodeEntity, spawnNodeEntity } from './grid.js';
import { showCountdown } from './ui.js';

// ============================================================
// Module state
// ============================================================

let _k = null;

// Active special-enemy spawn timers: array of { type, remaining, count }
let _specialSchedule = [];

// Seconds elapsed since wave started (used to trigger scheduled specials)
let _waveTime = 0;

// Interval tracking for special spawns that recur
let _specialsSent = [];   // indices of schedules already spawned

// Check-for-completion poll timer
let _completeCheckTimer = 0;
const COMPLETE_CHECK_INTERVAL = 0.5; // seconds between completion checks

// Flag: waiting for shop to close before starting next wave
let _waitingForShop = false;

// Flag: shop closed but player entered placement mode — wait for them to place/cancel
let _waitingForPlacement = false;

// Spawn origin of the current wave's centipede (col + dirX) — used by cleanup.
let _spawnCol  = 0;
let _spawnDirX = 1;

// Three possible spawn points: left, center, right
const SPAWN_ORIGINS = [
    { col: 0,  dirX:  1 },   // upper-left  → moves right
    { col: 11, dirX:  1 },   // upper-center → moves right
    { col: 22, dirX: -1 },   // upper-right  → moves left
];

// ============================================================
// Public init
// ============================================================

export function initWaves(k) {
    _k = k;

    // When shop closes, either start the wave immediately or wait for placement.
    events.on('shopClosed', () => {
        if (!_waitingForShop) return;
        _waitingForShop = false;
        // Defer one frame so shop.js can call enterPlacementMode() synchronously
        // before we check whether placement mode is active.
        _k.wait(0, () => {
            if (state.isGameOver) return;
            if (isInPlacementMode()) {
                // Player chose a tower — wait until they place or cancel it
                _waitingForPlacement = true;
            } else {
                startNextWave();
            }
        });
    });

    // Once placement finishes (tower placed or ESC cancelled), start the wave.
    events.on('placementModeChanged', (active) => {
        if (!active && _waitingForPlacement) {
            _waitingForPlacement = false;
            if (!state.isGameOver) startNextWave();
        }
    });

    // Also check completion whenever a segment dies — catches the exact kill.
    events.on('segmentKilled', () => {
        if (state.isWaveActive) _checkWaveComplete();
    });

    // Per-frame: advance wave timer and check for completion (backup poll)
    k.onUpdate(() => {
        if (state.isGameOver || !state.isWaveActive) return;
        const dt = k.dt();

        if (!state.isPaused) {
            // Tick scheduled special spawns
            _waveTime += dt;
            _tickSpecials();
        }

        // Poll for wave completion (runs even while paused so a paused-then-
        // unpaused kill isn't missed)
        _completeCheckTimer -= dt;
        if (_completeCheckTimer <= 0) {
            _completeCheckTimer = COMPLETE_CHECK_INTERVAL;
            _checkWaveComplete();
        }
    });

    // Start wave 1 on the next frame (ensures all init functions have run)
    let _firstFrameDone = false;
    k.onUpdate(() => {
        if (_firstFrameDone) return;
        _firstFrameDone = true;
        startNextWave();
    });
}

// ============================================================
// Wave start
// ============================================================

export function startNextWave() {
    if (state.isGameOver) return;

    const nextWave = state.wave + 1;
    const def = WAVE_DEFS[nextWave - 1];
    if (!def) {
        // All waves cleared — game won!
        events.emit('gameWon');
        return;
    }

    state.wave        = nextWave;
    state.isWaveActive = true;
    state.waveKills   = 0;
    state.waveDeaths  = 0;
    state.smartBombs  = SMART_BOMBS_PER_WAVE;

    // Reset wave tracking
    _waveTime         = 0;
    _specialSchedule  = [];
    _specialsSent     = [];
    _completeCheckTimer = COMPLETE_CHECK_INTERVAL;

    // Destroy any leftover enemies from previous wave
    _clearLeftoverEnemies();

    // Build special spawn schedule
    for (const s of def.specials) {
        _specialSchedule.push({ type: s.type, startTime: s.startTime, count: s.count, sent: false });
    }

    // Spawn centipede(s), paused until countdown finishes
    const segCount = def.segments ?? 12;
    const origin   = SPAWN_ORIGINS[Math.floor(Math.random() * SPAWN_ORIGINS.length)];
    _spawnCol      = origin.col;
    _spawnDirX     = origin.dirX;
    spawnCentipede(_k, def.centipedeType, segCount, _spawnCol, 0, _spawnDirX);
    state.isPaused = true;

    // Emit event — UI shows wave banner
    events.emit('waveStarted', nextWave);
    if (def.isBoss) playBossAlert(); else playWaveStart();

    // 3-2-1 countdown, then unpause
    showCountdown(_k, playCountdownTick, () => {
        state.isPaused = false;
    });
}

// ============================================================
// Special enemy scheduling
// ============================================================

function _tickSpecials() {
    for (const entry of _specialSchedule) {
        if (entry.sent) continue;
        if (_waveTime >= entry.startTime) {
            entry.sent = true;
            _spawnSpecials(entry.type, entry.count);
        }
    }
}

function _spawnSpecials(type, count) {
    const k = _k;
    for (let i = 0; i < count; i++) {
        // Stagger spawns by 0.4s each
        k.wait(i * 0.4, () => {
            if (state.isGameOver || !state.isWaveActive) return;
            if (type === 'flea')     spawnFlea(k);
            if (type === 'spider')   spawnSpider(k);
            if (type === 'scorpion') spawnScorpion(k);
        });
    }
}

// ============================================================
// Wave completion check
// ============================================================

function _checkWaveComplete() {
    if (!state.isWaveActive) return;

    // Wave is complete when all centipede segments are gone.
    // Dead centipedes remove themselves from state.centipedes, so we check
    // both emptiness and that no remaining entry has live segments.
    const allSegmentsGone = state.centipedes.every(c => c.segments.length === 0);

    if (!allSegmentsGone) return;

    // Also require no live fleas (they block completion; spiders/scorpions don't).
    const activeFleas = state.enemies.filter(e => e.type === 'flea' && !e.dead);
    if (activeFleas.length > 0) return;

    _onWaveComplete();
}

// ============================================================
// Wave complete
// ============================================================

function _onWaveComplete() {
    if (!state.isWaveActive) return;
    state.isWaveActive = false;

    const waveNum = state.wave;
    const def = WAVE_DEFS[waveNum - 1] ?? {};

    // Kill any remaining non-flea enemies (spiders, scorpions)
    _clearLeftoverEnemies();

    // Gold rewards
    let goldEarned = GOLD_PER_WAVE;
    if (def.isBoss)         goldEarned += GOLD_BOSS_BONUS;
    if (state.waveDeaths === 0) goldEarned += GOLD_NO_DEATH_BONUS;
    state.earn(goldEarned);

    // Score
    let scoreEarned = SCORE_WAVE_COMPLETE * waveNum;
    if (def.isBoss)         scoreEarned += SCORE_BOSS_KILL;
    if (state.waveDeaths === 0) scoreEarned += SCORE_NO_DEATH_BONUS;
    state.addScore(scoreEarned);

    playWaveComplete();
    events.emit('waveComplete', waveNum, goldEarned);

    // Last wave — game won
    if (waveNum >= WAVE_DEFS.length) {
        _k.wait(2, () => { playGameWon(); events.emit('gameWon'); });
        return;
    }

    // Run cleanup sequence, then open shop when it finishes
    _waitingForShop = true;
    _k.wait(1.5, () => {
        if (!state.isGameOver) _runCleanupSequence(() => {
            if (!state.isGameOver) openShopOverlay();
        });
    });
}

// ============================================================
// Between-wave cleanup: clear spawn area, shift nodes down
// ============================================================

/**
 * Classic Centipede inter-wave behaviour:
 *  1. Immediately remove any nodes jammed into the centipede spawn area
 *     (cols 0–2, rows 0–1) so it has room to enter next wave.
 *  2. March all remaining enemy-zone nodes one row down, one row at a time,
 *     with a marching thump sound for each row step.
 *  3. Nodes already on the bottom row of the enemy zone (row ENEMY_ZONE_MAX)
 *     are removed — they have nowhere to go.
 * @param {Function} onDone  called when animation is complete
 */
function _runCleanupSequence(onDone) {
    const k = _k;

    // ---- Step 1: clear spawn-corner clutter (instant, silent) ----
    // Remove nodes within 2 columns of the centipede's spawn point (rows 0–1)
    // so it has room to enter without being deflected immediately.
    const SPAWN_CLEAR_ROWS = 2;
    const clearColStart = Math.max(0, _spawnCol - 1);
    const clearColEnd   = Math.min(GRID_COLS - 1, _spawnCol + 2);
    for (let r = 0; r < SPAWN_CLEAR_ROWS; r++) {
        for (let c = clearColStart; c <= clearColEnd; c++) {
            if (state.hasNode(c, r)) {
                destroyNodeEntity(k, c, r);
                removeNode(c, r);
            }
        }
    }

    // ---- Step 2: collect nodes to march (row by row, bottom-up) ----
    // We process bottom row first so moving down never overwrites an
    // already-moved node.  Rows: ENEMY_ZONE_MAX down to 0.

    // How many row steps to animate.  In classic Centipede the field advances
    // by 1 row per wave, but we cap at 1 to keep the play area valid.
    const MARCH_ROWS = 1;

    // Build list of (col, row) for every node currently in the enemy zone,
    // sorted bottom-to-top so we can move them down safely.
    const nodesToMove = [];
    for (let r = ENEMY_ZONE_MAX; r >= 0; r--) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (state.hasNode(c, r)) nodesToMove.push({ col: c, row: r });
        }
    }

    if (nodesToMove.length === 0) {
        onDone();
        return;
    }

    // Stagger: play one thump per animation step, move all nodes together.
    // We do MARCH_ROWS visual steps with a short delay between them.
    const STEP_DELAY  = 0.18; // seconds between march steps
    let stepsDone = 0;

    function doStep() {
        if (state.isGameOver) { onDone(); return; }

        playNodeMarchStep(stepsDone);

        // Move all collected nodes down by 1 (nodes on ENEMY_ZONE_MAX are removed)
        // Process bottom-to-top so we don't double-move
        for (const n of nodesToMove) {
            const newRow = n.row + 1;

            // Remove visual at old position
            destroyNodeEntity(k, n.col, n.row);

            // Remove from state at old position
            const nodeData = state.getNode(n.col, n.row);
            state.removeNode(n.col, n.row);

            if (newRow > ENEMY_ZONE_MAX || !nodeData) {
                // Falls off the bottom of enemy zone — gone
                events.emit('nodeDestroyed', n.col, n.row);
            } else if (!state.hasNode(n.col, newRow) && !state.hasTower(n.col, newRow)) {
                // Place at new row
                state.setNode(n.col, newRow, nodeData);
                spawnNodeEntity(k, n.col, newRow);
                // Update the tracking object for subsequent steps
                n.row = newRow;
            }
            // If destination is occupied (tower/node), the node is lost
        }

        stepsDone++;
        if (stepsDone < MARCH_ROWS) {
            k.wait(STEP_DELAY, doStep);
        } else {
            // Small pause after last step, then proceed
            k.wait(STEP_DELAY, onDone);
        }
    }

    // Brief pause before march begins, to let wave-complete banner clear
    k.wait(0.3, doStep);
}

// ============================================================
// Cleanup
// ============================================================

function _clearLeftoverEnemies() {
    // Remove all centipede entities and state
    for (const c of [...state.centipedes]) {
        for (const ent of c.segEntities ?? []) {
            if (ent && ent.exists()) ent.destroy();
        }
        for (const ent of c.eyeEntities ?? []) {
            if (ent && ent.exists()) ent.destroy();
        }
    }
    state.centipedes.length = 0;

    // Remove all non-centipede enemies
    for (const enemy of [...state.enemies]) {
        if (enemy.ent && enemy.ent.exists()) enemy.ent.destroy();
        enemy.dead = true;
    }
    state.enemies.length = 0;
}
