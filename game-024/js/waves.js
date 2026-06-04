/**
 * waves.js — Wave spawner and progression.
 *
 * Replaces the placeholder timer-spawner from Phase 2 with discrete, escalating
 * waves. A small state machine drives the flow:
 *
 *   PREP      → brief beat before wave 1, then announce it.
 *   SPAWNING  → trickle the wave's enemies onto the field on a short interval,
 *               cycling through the movement patterns.
 *   ACTIVE    → all of this wave's enemies are out; wait for the field to clear
 *               (player kills them or they fly off the bottom).
 *   BREAK     → field is clear: pause WAVE_BREAK seconds, then advance + fanfare.
 *
 * Difficulty scales per wave: more enemies (WAVE_BASE_COUNT + wave*GROWTH),
 * faster descent, and a slightly tighter spawn interval.
 *
 * Public API:
 *   initWaves()       — wire up. Call once.
 *   resetWaves()      — restart the sequence at wave 1. Call on (re)start.
 *   updateWaves(dt)   — advance the state machine. Call each playing frame.
 */

import { state }  from './state.js';
import { playWaveStart, playBossWarn } from './sounds.js';
import { spawnEnemy, getEnemies } from './enemies.js';
import { showWaveBanner, resetWaveBanner } from './waveBanner.js';
import {
    WAVE_BASE_COUNT,
    WAVE_COUNT_GROWTH,
    WAVE_BREAK,
    FIELD_HALF_W,
    FIELD_HALF_H,
    PATTERNS,
    ENEMY_TYPES,
    ENEMY_FIRE_WAVE,
    BOSS_EVERY,
    BOSS_HP,
    BOSS_VALUE,
    BOSS_FIRE_COOLDOWN,
} from './config.js';

// --- Tunables ---
const PREP_DELAY     = 0.8;   // beat before the first wave announces
const SPAWN_INTERVAL = 0.55;  // base seconds between enemy spawns within a wave
const SPEED_BASE     = 5;     // descent speed of a wave-1 enemy
const SPEED_GROWTH   = 0.6;   // +units/sec of descent speed per wave

// Pattern rotation. Early waves lean on the simpler patterns; later waves draw
// from the full set so the mix gets busier.
const EARLY_PATTERNS = [PATTERNS.DIVE, PATTERNS.SINE];
const ALL_PATTERNS   = [PATTERNS.DIVE, PATTERNS.SINE, PATTERNS.ORBIT, PATTERNS.SWOOP];

// Enemy-type pool by wave (Phase 4 variety). Wave 1–2 is all grunts so the
// player learns the basics; darters join at 3, brutes/weavers at 4+, and from
// 6 on the full bestiary is in rotation.
function _typePoolForWave(wave) {
    if (wave <= 2) return [ENEMY_TYPES.GRUNT];
    if (wave <= 3) return [ENEMY_TYPES.GRUNT, ENEMY_TYPES.DARTER];
    if (wave <= 5) return [ENEMY_TYPES.GRUNT, ENEMY_TYPES.DARTER, ENEMY_TYPES.WEAVER, ENEMY_TYPES.BRUTE];
    return [
        ENEMY_TYPES.GRUNT, ENEMY_TYPES.DARTER, ENEMY_TYPES.DARTER,
        ENEMY_TYPES.WEAVER, ENEMY_TYPES.BRUTE,
    ];
}

// Weavers feel best on weaving lanes; pair them with sine/orbit when possible.
function _patternForType(type, defaultPattern) {
    if (type.key === ENEMY_TYPES.WEAVER.key) {
        return Math.random() < 0.5 ? PATTERNS.SINE : PATTERNS.ORBIT;
    }
    return defaultPattern;
}

const PHASE = { PREP: 'prep', SPAWNING: 'spawning', ACTIVE: 'active', BREAK: 'break' };

let phase       = PHASE.PREP;
let timer       = 0;     // counts down within the current phase
let toSpawn     = 0;     // enemies left to spawn in the current wave
let spawnIndex  = 0;     // rotates through the pattern list

export function initWaves() { /* nothing to pre-build */ }

export function resetWaves() {
    phase      = PHASE.PREP;
    timer      = PREP_DELAY;
    toSpawn    = 0;
    spawnIndex = 0;
    resetWaveBanner();
    // state.reset() (in main.startGame) has already put us at wave 1.
}

function _countForWave(wave) {
    return WAVE_BASE_COUNT + (wave - 1) * WAVE_COUNT_GROWTH;
}

function _speedForWave(wave) {
    return SPEED_BASE + (wave - 1) * SPEED_GROWTH;
}

function _patternsForWave(wave) {
    return wave <= 2 ? EARLY_PATTERNS : ALL_PATTERNS;
}

function _spawnInterval(wave) {
    // Tighten the interval as waves climb, but never below a readable floor.
    return Math.max(0.25, SPAWN_INTERVAL - (wave - 1) * 0.03);
}

function _isBossWave(wave) {
    return wave % BOSS_EVERY === 0;
}

// Fraction of a wave's enemies that shoot back. Climbs with the wave from
// ENEMY_FIRE_WAVE onward, capped so a wave is never a total bullet wall.
function _fireFraction(wave) {
    if (wave < ENEMY_FIRE_WAVE) return 0;
    return Math.min(0.6, 0.2 + (wave - ENEMY_FIRE_WAVE) * 0.08);
}

// Begin spawning the current wave (state.wave is already correct).
function _beginWave() {
    const wave = state.wave;
    toSpawn    = _countForWave(wave);
    spawnIndex = 0;
    timer      = 0;            // spawn the first enemy immediately
    phase      = PHASE.SPAWNING;
    playWaveStart();

    const bossWave = _isBossWave(wave);
    // Splash the "WAVE N" banner (red WARNING variant on boss waves).
    showWaveBanner(wave, bossWave);

    // A mini-boss arrives at the top of every Nth wave alongside the regulars.
    if (bossWave) {
        playBossWarn();
        spawnEnemy({
            isBoss:  true,
            pattern: PATTERNS.SINE,            // weaves so it's not a sitting duck
            x:       0,
            z:       -FIELD_HALF_H - 2,
            hp:      BOSS_HP + wave * 2,       // tankier each appearance
            speed:   2.2,                      // slow, looming
            amp:     FIELD_HALF_W * 0.5,
            freq:    0.8,
            value:   BOSS_VALUE,
            canFire: true,
            fireCd:  BOSS_FIRE_COOLDOWN,
        });
    }
}

function _spawnOne() {
    const wave     = state.wave;
    const patterns = _patternsForWave(wave);
    const types    = _typePoolForWave(wave);

    // Rotate the base pattern; pick a type at random from the wave's pool.
    const basePattern = patterns[spawnIndex % patterns.length];
    const type        = types[Math.floor(Math.random() * types.length)];
    const pattern     = _patternForType(type, basePattern);
    spawnIndex++;

    spawnEnemy({
        type,
        pattern,
        speed: _speedForWave(wave) + Math.random() * 1.5,
        // Spread starting X across the field so a wave doesn't stack in a column.
        x:     (Math.random() * 2 - 1) * (FIELD_HALF_W * 0.85),
        // value/hp/speed come from the type profile (spawnEnemy applies them).
        // Arm a share of the wave to shoot back, scaled by the type's fireMul.
        canFire: Math.random() < _fireFraction(wave) * type.fireMul,
    });
}

export function updateWaves(dt) {
    timer -= dt;

    switch (phase) {
        case PHASE.PREP:
            // First wave: state is already at wave 1, just announce and start.
            if (timer <= 0) _beginWave();
            break;

        case PHASE.SPAWNING:
            if (timer <= 0 && toSpawn > 0) {
                _spawnOne();
                toSpawn--;
                timer = _spawnInterval(state.wave);
            }
            if (toSpawn <= 0) phase = PHASE.ACTIVE;
            break;

        case PHASE.ACTIVE:
            // Wave is fully spawned; wait for the field to empty.
            if (getEnemies().length === 0) {
                phase = PHASE.BREAK;
                timer = WAVE_BREAK;
            }
            break;

        case PHASE.BREAK:
            if (timer <= 0) {
                state.nextWave();   // bumps HUD via waveChanged
                _beginWave();
            }
            break;
    }
}
