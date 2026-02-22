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
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { spawnCentipede } from './centipede.js';
import { spawnFlea, spawnSpider, spawnScorpion } from './enemies.js';
import { openShopOverlay } from './shop.js';
import { playWaveComplete, playWaveStart } from './sounds.js';

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

// ============================================================
// Public init
// ============================================================

export function initWaves(k) {
    _k = k;

    // When shop closes (after between-wave timer or player clicks Start Wave),
    // begin the next wave.
    events.on('shopClosed', () => {
        if (_waitingForShop) {
            _waitingForShop = false;
            startNextWave();
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

    // Spawn centipede(s)
    const segCount = def.segments ?? 12;
    spawnCentipede(_k, def.centipedeType, segCount, 0, 0, 1);

    // Emit event — UI shows wave banner
    events.emit('waveStarted', nextWave);
    playWaveStart();
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
        _k.wait(2, () => events.emit('gameWon'));
        return;
    }

    // Open between-wave shop, then start next wave when shop closes
    _waitingForShop = true;
    _k.wait(1.5, () => {
        if (!state.isGameOver) openShopOverlay();
    });
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
