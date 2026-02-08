import { WAVE_DEFS, WAVE_BONUS_GOLD } from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { spawnEnemy } from './enemies.js';

let k;
let spawning = false;

export function initWaves(kaplay) {
    k = kaplay;

    // Spacebar starts next wave
    k.onKeyPress("space", () => {
        startNextWave();
    });

    // Wave completed: give bonus gold
    events.on('waveCompleted', () => {
        state.earn(WAVE_BONUS_GOLD);
    });
}

export function startNextWave() {
    if (state.isWaveActive) return;
    if (state.isGameOver || state.isVictory) return;
    if (state.wave >= WAVE_DEFS.length) return;

    state.wave++;
    state.isWaveActive = true;
    state._enemiesSpawnedThisWave = 0;

    const waveDef = WAVE_DEFS[state.wave - 1];

    // Count total enemies this wave
    let total = 0;
    for (const group of waveDef.enemies) {
        total += group.count;
    }
    state._totalEnemiesThisWave = total;

    events.emit('waveStarted', state.wave);

    // Spawn enemies using wait chains
    for (const group of waveDef.enemies) {
        spawnGroup(group.type, group.count, group.interval);
    }
}

function spawnGroup(type, count, interval) {
    let spawned = 0;

    function spawnNext() {
        if (state.isGameOver || spawned >= count) return;
        spawnEnemy(type);
        state._enemiesSpawnedThisWave++;
        spawned++;
        if (spawned < count) {
            k.wait(interval, spawnNext);
        }
    }

    spawnNext();
}
