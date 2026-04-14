/**
 * main.js — Village of the Wandering Blade  (Phase 3)
 *
 * Three.js action RPG: explore the countryside, slay monsters,
 * gather resources, return to build and develop your village,
 * complete quests, and face the dragon boss.
 *
 * Architecture:
 *   world.js    — terrain, lighting, scene setup
 *   player.js   — player mesh, movement, attacks, camera
 *   monsters.js — monster spawning, AI (incl. skeleton, dragon)
 *   pickups.js  — resource orbs + harvestable resource nodes
 *   village.js  — building meshes, village mode
 *   quests.js   — quest system, NPC givers, quest log UI
 *   minimap.js  — 2D overhead minimap canvas
 *   save.js     — localStorage save/load
 *   ui.js       — DOM HUD
 *   state.js    — global state, auto-emits events
 *   events.js   — EventBus
 *   sounds.js   — Web Audio API
 *   config.js   — constants
 *
 * Controls:
 *   WASD / Arrows — move
 *   Mouse         — rotate camera (click to lock pointer)
 *   Space         — attack
 *   E             — interact (build in village / harvest nodes outside)
 *   I             — inventory / equip weapons
 *   Q             — quest log
 *   M             — minimap toggle
 *   H             — use health potion
 *   C             — craft potion (near alchemist)
 *   Escape        — unlock pointer / close panels
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

import { initWorld, updateRabbits } from './world.js';
import { initPlayer, requestPointerLock } from './player.js';
import { initMonsters } from './monsters.js';
import { initPickups }  from './pickups.js';
import { initVillage, builtPositions } from './village.js';
import { initUI, showBuildPanel, hideBuildPanel } from './ui.js';
import { initQuests, showQuestLog, hideQuestLog } from './quests.js';
import { initMinimap } from './minimap.js';
import { initSave, saveGame, loadGame, hasSave } from './save.js';
import { state }        from './state.js';
import { events }       from './events.js';
import { initAudio, startAmbient, startDungeonAmbient, stopDungeonAmbient, playUiClick, playLevelUp, playGameOver, playHeal } from './sounds.js';
import {
    VILLAGE_RADIUS, DAY_CYCLE_DURATION,
    DAY_AMBIENT_INT, NIGHT_AMBIENT_INT,
    DAY_SUN_INT, NIGHT_SUN_INT,
    DAY_SKY_HEX, NIGHT_SKY_HEX,
    POTION_COST_HERBS, POTION_HEAL_AMOUNT,
} from './config.js';
import { showInventory, hideInventory, initInventory } from './inventory.js';
import { initDungeons } from './dungeon.js';
import { initSplashScene } from './splash.js';

// ============================================================
// Splash → Game start
// ============================================================

const splashEl  = document.getElementById('splash');
const hudEl     = document.getElementById('hud');
const startBtn  = document.getElementById('splash-start');
let gameStarted = false;

// Start monster showcase immediately (torn down when game begins)
const stopSplashScene = initSplashScene();

// Show continue button if save exists
if (hasSave()) {
    const continueBtn = document.createElement('button');
    continueBtn.className = 'start-btn';
    continueBtn.style.marginBottom = '0.5rem';
    continueBtn.textContent = 'CONTINUE';
    startBtn.parentNode.insertBefore(continueBtn, startBtn);
    continueBtn.addEventListener('click', () => _startGame(true));
}

function _startGame(loadSave = false) {
    if (gameStarted) return;
    gameStarted = true;
    stopSplashScene();   // free splash Three.js renderer before main game starts
    initAudio();
    startAmbient();
    playUiClick();
    splashEl.style.display = 'none';
    hudEl.style.display    = 'block';
    _initGame(loadSave);
}

startBtn.addEventListener('click', () => _startGame(false));
document.addEventListener('keydown', (e) => {
    if (!gameStarted && !['Shift','Control','Alt','Meta'].includes(e.key)) {
        _startGame(false);
    }
});

// ============================================================
// Game init
// ============================================================

function _initGame(loadSave = false) {
    // --- World ---
    const { scene, camera, renderer, fireGroup, ambient, sun, stars, rabbits } = initWorld();

    // --- Systems ---
    const { playerGroup, update: updatePlayer } = initPlayer(scene, camera);
    const { monsters, update: updateMonsters }  = initMonsters(scene);
    const { pickups, nodes, update: updatePickups, checkNodeHarvest } = initPickups(scene);
    const { update: updateVillage }             = initVillage(scene);
    const { npcs, update: updateQuests }        = initQuests(scene);
    const dungeonSystem = initDungeons(scene);
    const minimap = initMinimap(playerGroup, () => monsters, nodes, dungeonSystem.dungeonEntrances);

    initUI();
    initInventory();
    initSave();

    // Restore save if requested
    if (loadSave) {
        const ok = loadGame();
        if (ok) events.emit('message', 'Game loaded!', '#88ddff');
    }

    // --- Potion HUD ---
    const potionCountEl = document.getElementById('potion-count');
    const potionMaxEl   = document.getElementById('potion-max');
    events.on('potionsChanged', (count, max) => {
        if (potionCountEl) potionCountEl.textContent = count;
        if (potionMaxEl)   potionMaxEl.textContent   = max;
    });
    // Emit initial values
    events.emit('potionsChanged', state.potions, state.maxPotions);

    // --- Event sounds ---
    events.on('playerLevelUp', () => playLevelUp());
    events.on('gameOver', () => {
        playGameOver();
        saveGame();  // save on death so progress isn't lost
        setTimeout(() => {
            document.getElementById('hud-mode').textContent = 'GAME OVER';
            document.getElementById('hud-mode').style.color = '#e05555';
        }, 200);
    });

    // --- Day/night state ---
    let dayTime = 0;
    const dayColor      = new THREE.Color(DAY_SKY_HEX);
    const nightColor    = new THREE.Color(NIGHT_SKY_HEX);
    const fogDayColor   = new THREE.Color(DAY_SKY_HEX);
    const fogNightColor = new THREE.Color(0x040610);

    // ============================================================
    // Input handling
    // ============================================================

    /**
     * Toggle a UI panel open/closed, playing the UI click sound either way.
     * @param {Function} showFn - function to call when opening
     * @param {Function} hideFn - function to call when closing
     * @param {string}   panelId - id of the panel element used to detect current state
     */
    function _togglePanel(showFn, hideFn, panelId) {
        const el = document.getElementById(panelId);
        const isOpen = el?.style.display === 'block';
        isOpen ? hideFn() : showFn();
        playUiClick();
    }

    document.addEventListener('keydown', (e) => {
        // --- Q: Quest log ---
        if (e.code === 'KeyQ') {
            _togglePanel(showQuestLog, hideQuestLog, 'quest-panel');
            return;
        }

        // --- H: Use potion ---
        if (e.code === 'KeyH') {
            if (state.usePotion()) {
                playHeal();
                events.emit('message', `Used a health potion! (+${POTION_HEAL_AMOUNT} HP)`, '#88ddaa');
            } else if (state.potions <= 0) {
                events.emit('message', 'No potions. Craft some at the Alchemist!', '#cc8844');
            } else {
                events.emit('message', 'HP is already full.', '#667766');
            }
            return;
        }

        // --- C: Craft potion (near alchemist in village) ---
        if (e.code === 'KeyC') {
            const pPos = playerGroup.position;
            const distToVillage = Math.sqrt(pPos.x * pPos.x + pPos.z * pPos.z);
            if (distToVillage > VILLAGE_RADIUS + 2) {
                events.emit('message', 'Return to the village to craft potions.', '#c8a844');
                return;
            }
            if (state.getBuildingLevel('alchemist') < 1) {
                events.emit('message', 'Build the Alchemist\'s Lab first!', '#cc8844');
                return;
            }
            if (state.potions >= state.maxPotions) {
                events.emit('message', `Potion bag is full (${state.potions}/${state.maxPotions}).`, '#cc8844');
                return;
            }
            if (state.craftPotion()) {
                playUiClick();
                events.emit('message', `Crafted a health potion! (${state.potions}/${state.maxPotions})`, '#88ddaa');
            } else {
                events.emit('message', `Need ${POTION_COST_HERBS} herbs to craft a potion.`, '#cc8844');
            }
            return;
        }

        // --- Tab: toggle mode ---
        if (e.code === 'Tab') {
            e.preventDefault();
            state.mode = state.mode === 'explore' ? 'village' : 'explore';
            playUiClick();
            return;
        }

        // --- E: Interact ---
        if (e.code === 'KeyE') {
            const pPos = playerGroup.position;

            // --- Inside dungeon ---
            if (dungeonSystem.isInDungeon()) {
                // Try exit portal
                if (dungeonSystem.tryExitDungeon(pPos, playerGroup)) {
                    stopDungeonAmbient();   // resumes forest sounds internally
                    return;
                }
                // Try chest collect
                if (dungeonSystem.tryCollectChest(pPos)) return;
                events.emit('message', 'Walk to the blue portal to exit the dungeon.', '#8888cc');
                return;
            }

            // --- Overworld: try enter dungeon ---
            if (dungeonSystem.tryEnterDungeon(pPos, playerGroup)) {
                startDungeonAmbient();
                return;
            }

            const distToVillage = Math.sqrt(pPos.x * pPos.x + pPos.z * pPos.z);
            if (distToVillage <= VILLAGE_RADIUS + 2) {
                _togglePanel(showBuildPanel, hideBuildPanel, 'build-panel');
            } else {
                // Try harvesting a nearby resource node
                const harvested = checkNodeHarvest(pPos);
                if (!harvested) {
                    events.emit('message', 'Nothing to harvest here. Look for glowing resource nodes or a dungeon entrance.', '#667766');
                }
            }
            return;
        }

        // --- I: Inventory ---
        if (e.code === 'KeyI') {
            _togglePanel(showInventory, hideInventory, 'inventory-panel');
            return;
        }

        // --- Escape: close panels ---
        if (e.code === 'Escape') {
            const qp = document.getElementById('quest-panel');
            if (qp?.style.display === 'block')                              { hideQuestLog(); return; }
            if (document.getElementById('inventory-panel')?.style.display === 'block') { hideInventory(); return; }
            if (document.getElementById('build-panel').style.display === 'block')      { hideBuildPanel(); return; }
            if (document.pointerLockElement) document.exitPointerLock();
        }
    });

    // --- Pointer lock on click ---
    renderer.domElement.addEventListener('click', () => requestPointerLock());

    // ============================================================
    // Game loop
    // ============================================================

    const clock = new THREE.Clock();
    let frameCount  = 0;
    let tickTimer   = 0;

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.1);
        frameCount++;
        tickTimer += dt;

        if (!state.isGameOver) {
            const pPos = playerGroup.position;

            // When in dungeon, pass dungeon monsters to player attack system too
            const activeDungeonMonsters = dungeonSystem.getActiveDungeonMonsters();
            const allMonsters = dungeonSystem.isInDungeon()
                ? activeDungeonMonsters
                : monsters;
            const activeDungeon = dungeonSystem.getCurrentDungeon();
            const dungeonBounds = activeDungeon ? activeDungeon.getStageBounds() : undefined;
            const dungeonWalkable = activeDungeon ? (x, z) => activeDungeon.isWalkable(x, z) : undefined;
            updatePlayer(dt, allMonsters, pickups, builtPositions, dungeonBounds, dungeonWalkable);
            updateMonsters(dt, pPos, camera);
            dungeonSystem.update(dt, pPos, camera);
            updatePickups(dt, pPos);
            updateQuests(dt);
            updateRabbits(rabbits, dt);
            minimap.update();

            // Gametic event for autosave
            if (tickTimer >= 1) {
                events.emit('gameTick', tickTimer);
                tickTimer = 0;
            }

            // Day/night cycle
            dayTime = (dayTime + dt / DAY_CYCLE_DURATION) % 1;
            const rawBlend   = Math.sin(dayTime * Math.PI * 2) * -0.5 + 0.5;
            const nightBlend = Math.max(0, (rawBlend - 0.3) / 0.7);
            ambient.intensity = DAY_AMBIENT_INT + (NIGHT_AMBIENT_INT - DAY_AMBIENT_INT) * nightBlend;
            sun.intensity     = DAY_SUN_INT     + (NIGHT_SUN_INT     - DAY_SUN_INT)     * nightBlend;
            scene.background  = new THREE.Color().lerpColors(dayColor, nightColor, nightBlend);
            scene.fog.color.lerpColors(fogDayColor, fogNightColor, nightBlend);
            stars.visible     = nightBlend > 0.2;

            updateVillage(dt, nightBlend);

            // Campfire flame — capture timestamp once to keep all flicker calculations in sync
            if (fireGroup.userData.flame || fireGroup.userData.fireLight) {
                const now = Date.now();
                if (fireGroup.userData.flame) {
                    const flame = fireGroup.userData.flame;
                    flame.position.y = 0.5 + Math.sin(now * 0.006) * 0.12;
                    flame.scale.setScalar(0.9 + Math.sin(now * 0.009) * 0.15);
                    flame.material.color.setHex(now % 400 < 200 ? 0xff7722 : 0xff9933);
                }
                if (fireGroup.userData.fireLight) {
                    const flicker = Math.sin(now * 0.012) * 0.5;
                    fireGroup.userData.fireLight.intensity = (2.2 + flicker) * (0.5 + nightBlend * 0.8);
                }
            }

            // Dead monster cleanup every 300 frames
            if (frameCount % 300 === 0) {
                monsters.splice(0, monsters.length, ...monsters.filter(m => m.alive || m.dying));
            }
        }

        renderer.render(scene, camera);
    }

    animate();
}
