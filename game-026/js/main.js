/**
 * main.js — Three.js entry point.
 *
 * Game states: 'splash' → 'playing' → 'gameover'
 *
 * Library: three.js r165 via import map (see index.html)
 */

import * as THREE from 'three';

import { initScene, renderer, scene, camera, clock } from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, hideSplash, logMessage, showDamage, updateActionHint,
         showInventory, hideInventory, showPause, hidePause } from './ui.js';
import { initAudio, playUiClick, playItemPickup, playOpenChest,
         playLevelTransition, playVictory } from './sounds.js';

import { initDungeon, buildLevelByDepth, tileAt, updateTorches,
         clearSpawnTile, lootAt, consumeLootTile } from './dungeon.js';
import { initPlayer, updatePlayer, handleInput } from './player.js';
import { initCombat, startCombat, isInCombat, updateCombat } from './combat.js';
import { LEVEL_1_SPAWNS, LEVEL_2_SPAWNS, LEVEL_3_SPAWNS, ITEMS } from './config.js';

// ============================================================
// THREE.JS GOTCHAS (read before adding anything)
// ============================================================
//
// 1. RESIZE — camera.updateProjectionMatrix() is REQUIRED after changing
//    camera.aspect. The scaffold does this in scene.js — don't remove it.
//
// 2. CLOCK CAP — Math.min(clock.getDelta(), 0.05) is mandatory. A backgrounded
//    tab returns a huge delta on first frame after unhide; without the cap
//    movement tweens / physics will tunnel through walls.
//
// 3. COLOR — new THREE.Color(255, 0, 255) is WHITE, not magenta. Color takes
//    floats 0..1. Use 0xRRGGBB hex integers everywhere instead.
//
// 4. GPU MEMORY — three.js does not auto-free geometries/materials. If you
//    spawn/destroy lots of meshes (monsters, loot), call mesh.geometry.dispose()
//    and mesh.material.dispose() before removing. Negligible for a fixed scene.
//
// ============================================================
// Init
// ============================================================

initScene();
initUI();
initDungeon();   // build the level mesh once; player spawns into it on start
initCombat();    // wire combat event listener

// ============================================================
// Game state machine
// ============================================================

let mode = 'splash';   // 'splash' | 'playing' | 'paused' | 'gameover' | 'won'

// Spawn data per depth (1-indexed)
const SPAWN_DATA = [LEVEL_1_SPAWNS, LEVEL_2_SPAWNS, LEVEL_3_SPAWNS];

// Active spawns for the current level — rebuilt on each descent
let _currentSpawns = {};

function startGame() {
    if (mode === 'playing') return;
    mode = 'playing';
    state.reset();
    _currentSpawns = { ...LEVEL_1_SPAWNS };
    buildLevelByDepth(1);
    events.emit('depthChanged', state.depth);
    events.emit('hpChanged', { cur: state.hp, max: state.hpMax });
    initPlayer();
    initAudio();
    playUiClick();
    hideSplash();
    logMessage('You descend into the Crypt of the Forgotten...');
}

events.on('gameOver', () => { mode = 'gameover'; });
events.on('gameWon',  () => { mode = 'won'; playVictory(); });

// Monster encounter: player steps onto an 'M' tile
events.on('tileEntered', ({ x, z, tile }) => {
    if (tile === 'M') {
        const spawnKey = `${x},${z}`;
        const monsterId = _currentSpawns[spawnKey];
        if (!monsterId) return;
        clearSpawnTile(x, z);
        startCombat(monsterId);
        return;
    }
    if (tile === 'C') {
        // Chest/loot tile — auto-pickup
        _pickupLoot(x, z);
        return;
    }
    if (tile === 'W') {
        // Win tile — crypt heart
        state.win();
        return;
    }
});


function _pickupLoot(x, z) {
    const itemId = lootAt(x, z);
    if (!itemId) return;
    const def = ITEMS[itemId];
    if (!def) return;
    consumeLootTile(x, z);
    state.addItem(itemId);
    playOpenChest();
    playItemPickup();
    logMessage(`Found: ${def.name}`);
    events.emit('pickupGold');   // score flash as visual feedback
}

// Block player movement while in combat
events.on('combatStarted', () => { state.isPaused = true; });
events.on('combatEnded',   () => { state.isPaused = false; });

// Level transition on stairs
events.on('stairsReached', () => {
    if (mode !== 'playing') return;
    const nextDepth = state.depth + 1;
    if (nextDepth > 3) {
        // No level 4 — already won via 'W' tile, but guard anyway
        return;
    }
    state.isPaused = true;
    events.emit('levelTransitionStart', { depth: nextDepth });
    playLevelTransition();
    setTimeout(() => {
        state.depth = nextDepth;
        const idx = Math.max(0, nextDepth - 1);
        _currentSpawns = { ...[LEVEL_1_SPAWNS, LEVEL_2_SPAWNS, LEVEL_3_SPAWNS][idx] };
        buildLevelByDepth(nextDepth);
        initPlayer();
        // Partial rest on descent: restore up to 50% of max HP (never reduces HP)
        const restoreTarget = Math.floor(state.hpMax * 0.5);
        if (state.hp < restoreTarget) state.hp = restoreTarget;
        events.emit('hpChanged', { cur: state.hp, max: state.hpMax });
        state.isPaused = false;
        events.emit('levelTransitionEnd');
        logMessage(`You descend to Depth ${nextDepth}. The darkness thickens.`);
    }, 1800);
});

// Context-sensitive action hint: 'C' chest tiles are interactable (walkable auto-pickup),
// and we show SEARCH when any interactable tile is directly ahead.
const INTERACTABLE_TILES = new Set(['C']);
events.on('playerMoved', ({ x, z, facing }) => {
    const { dx, dz } = [{ dx:0,dz:-1 },{ dx:1,dz:0 },{ dx:0,dz:1 },{ dx:-1,dz:0 }][facing];
    const ahead = tileAt(x + dx, z + dz);
    updateActionHint(INTERACTABLE_TILES.has(ahead));
});

// Search action (F) — check tile ahead for interactables or describe the wall
events.on('playerSearch', ({ aheadX, aheadZ }) => {
    const ahead = tileAt(aheadX, aheadZ);
    if (ahead === 'C') {
        _pickupLoot(aheadX, aheadZ);
    } else if (INTERACTABLE_TILES.has(ahead)) {
        logMessage('You find something here...');
    } else {
        const wallMessages = [
            'You run your hand along the cold stone. Nothing.',
            'The wall is solid. No hidden passages here.',
            'Damp moss clings to the stonework. Nothing unusual.',
            'Ancient carvings, but no mechanism to activate.',
        ];
        logMessage(wallMessages[(aheadX * 7 + aheadZ * 13) % wallMessages.length]);
    }
});

// Camera shake state — grid-safe (no position stored between frames)
let _shake = null;   // { t, dur, mag }
const SHAKE_DUR = 0.22;
const SHAKE_MAG = 0.06;

events.on('damageTaken', () => {
    showDamage();
    _shake = { t: 0, dur: SHAKE_DUR, mag: SHAKE_MAG };
});

// ============================================================
// Input
// ============================================================

let _inventoryOpen = false;

function onAnyKey(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (mode === 'splash') {
        startGame();
        return;
    }
    if (e.key === 'r' || e.key === 'R') {
        location.reload();
        return;
    }
    if (e.key === 'Escape') {
        if (_inventoryOpen) { _closeInventory(); return; }
        location.reload();
        return;
    }
    if (mode === 'gameover' || mode === 'won') return;

    // Inventory toggle (I)
    if ((e.key === 'i' || e.key === 'I') && !isInCombat()) {
        if (_inventoryOpen) _closeInventory();
        else _openInventory();
        return;
    }
    // Pause toggle (P)
    if ((e.key === 'p' || e.key === 'P') && !isInCombat() && !_inventoryOpen) {
        if (mode === 'paused') {
            mode = 'playing';
            state.isPaused = false;
            hidePause();
        } else if (mode === 'playing') {
            mode = 'paused';
            state.isPaused = true;
            showPause();
        }
        return;
    }
    if (mode === 'playing') {
        if (isInCombat()) {
            const actionMap = { '1': 'attack', '2': 'defend', '3': 'item', '4': 'flee' };
            if (actionMap[e.key]) {
                events.emit('combatAction', { action: actionMap[e.key] });
                return;
            }
        }
        if (!_inventoryOpen) handleInput(e);
    }
}

function _openInventory() {
    if (_inventoryOpen) return;
    _inventoryOpen = true;
    state.isPaused = true;
    showInventory();
}

function _closeInventory() {
    if (!_inventoryOpen) return;
    _inventoryOpen = false;
    state.isPaused = false;
    hideInventory();
}
document.addEventListener('keydown', onAnyKey);
document.addEventListener('click',   () => { if (mode === 'splash') startGame(); });

// ============================================================
// Render loop
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    // Cap dt — a hidden tab returns one giant delta on first frame.
    const dt = Math.min(clock.getDelta(), 0.05);

    if (mode === 'playing') {
        updatePlayer(dt);
        updateCombat(dt);
    }

    updateTorches(dt);

    // Grid-safe camera shake — offset is applied and removed each frame
    if (_shake) {
        _shake.t += dt;
        const p = _shake.t / _shake.dur;
        if (p < 1) {
            const decay = 1 - p;
            // Use a seeded-by-time oscillation so shake varies without random
            const ox = Math.sin(p * 47.3) * _shake.mag * decay;
            const oy = Math.cos(p * 38.7) * _shake.mag * decay;
            camera.position.x += ox;
            camera.position.y += oy;
            renderer.render(scene, camera);
            camera.position.x -= ox;
            camera.position.y -= oy;
        } else {
            _shake = null;
            renderer.render(scene, camera);
        }
    } else {
        renderer.render(scene, camera);
    }
}
animate();
