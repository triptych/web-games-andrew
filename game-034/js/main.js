/**
 * main.js — Idle Delve entry point.
 *
 * Boot sequence:
 *   1. Load saved state (gold, upgrades, deepest floor) from localStorage.
 *   2. Compute elapsed offline time and fast-forward a lightweight simulation
 *      to approximate rooms/floors cleared + gold earned, capped at MAX_OFFLINE_MS.
 *   3. Show an "away summary" toast if any offline time was simulated.
 *   4. Start the live delve loop: generate floor -> walk rooms -> auto-battle -> repeat.
 *
 * No engine — raw Canvas 2D render loop driven by requestAnimationFrame, with a
 * separate fixed-tick combat scheduler (BASE_TICK_MS / speed) layered on top.
 */

import { STAGE_W, STAGE_H, BASE_TICK_MS, ROOM_PAUSE_MS, SAVE_INTERVAL_MS, MAX_OFFLINE_MS, SPEEDS } from './config.js';
import { state } from './state.js';
import { events } from './events.js';
import { buildParty } from './heroes.js';
import { generateFloor } from './dungeon.js';
import { CombatEngine } from './combat.js';
import { initRender, renderFrame, spawnParticle, spawnFloatingText } from './render.js';
import { initUI, tickGoldDisplay, setFloorRoom, renderPartyStrip, showAwaySummary, updateSpeedBtn } from './ui.js';
import * as sfx from './sounds.js';

// ============================================================
// Delve run state (not persisted mid-combat — only floor/gold/upgrades persist)
// ============================================================

let floorNum = 1;
let currentFloor = null;
let roomIdx = 0;
let party = [];
let combat = null;
let phase = 'approach'; // 'approach' | 'combat' | 'roomEnd' | 'floorEnd'
let phaseTimer = 0;
let speedIdx = 0;
let runGoldEarned = 0;
let runFloorsCleared = 0;
let runWiped = false;
let audioReady = false;

function tickIntervalMs() {
    return BASE_TICK_MS / SPEEDS[speedIdx];
}

// ============================================================
// Boot
// ============================================================

function boot() {
    const canvas = document.getElementById('stage');
    initRender(canvas);

    const elapsed = state.load();

    initUI({
        onSpeedToggle: () => { speedIdx = (speedIdx + 1) % SPEEDS.length; },
        onMuteToggle: () => {},
        getSpeedIdx: () => speedIdx,
    });

    floorNum = Math.max(state.startingFloor, floorNum);
    party = buildParty();
    startFloor(floorNum);
    renderPartyStrip(party);

    if (elapsed > 1000) {
        simulateOffline(Math.min(elapsed, MAX_OFFLINE_MS));
    }

    // First user gesture anywhere unlocks audio.
    const unlock = () => { if (!audioReady) { sfx.initAudio(); audioReady = true; } };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    setInterval(() => state.save(), SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', () => state.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) state.save(); });

    requestAnimationFrame(loop);
}

// Use a self-rescheduling timeout instead of setInterval so speed changes take effect immediately.
function scheduleNextTick() {
    setTimeout(() => {
        gameTick();
        scheduleNextTick();
    }, tickIntervalMs());
}

// ============================================================
// Offline catch-up simulation
// ============================================================

function simulateOffline(elapsedMs) {
    const avgRoomMs = BASE_TICK_MS * 3 + ROOM_PAUSE_MS; // rough average ticks-per-room guess
    let roomsToSim = Math.floor(elapsedMs / avgRoomMs);
    roomsToSim = Math.min(roomsToSim, 4000); // hard safety cap on loop iterations

    let simFloor = floorNum;
    let simRoomIdx = roomIdx;
    let simFloorDef = currentFloor;
    let simParty = buildParty();
    let goldEarned = 0;
    let floorsCleared = 0;
    let wiped = false;

    for (let i = 0; i < roomsToSim; i++) {
        if (simRoomIdx >= simFloorDef.rooms.length) {
            simFloor += 1;
            floorsCleared += 1;
            simFloorDef = generateFloor(simFloor);
            simRoomIdx = 0;
            continue;
        }
        const room = simFloorDef.rooms[simRoomIdx];
        if (room.type === 'treasure') {
            goldEarned += Math.round(room.gold * state.goldMul);
        } else if (room.type === 'rest') {
            for (const h of simParty) if (h.alive) h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * room.healPct));
        } else {
            const result = simulateCombatInstant(simParty, room.monsters);
            goldEarned += Math.round(room.monsters.length * room.goldPerMonster * state.goldMul);
            if (result === 'defeat') {
                wiped = true;
                simFloor = state.startingFloor;
                simFloorDef = generateFloor(simFloor);
                simRoomIdx = 0;
                simParty = buildParty();
                continue;
            }
        }
        simRoomIdx += 1;
    }

    if (goldEarned > 0) {
        state.addGold(goldEarned);
        runGoldEarned = 0; // offline gold already banked directly, not part of the "live run"
    }
    if (simFloor > state.deepestFloor) state.deepestFloor = simFloor;

    // The sim loop can land exactly on the floor boundary (simRoomIdx === rooms.length)
    // when roomsToSim runs out right after the last room of a floor. Roll over to floor+1
    // here so the live scheduler never reads an out-of-bounds room.
    if (simRoomIdx >= simFloorDef.rooms.length) {
        simFloor += 1;
        floorsCleared += 1;
        simFloorDef = generateFloor(simFloor);
        simRoomIdx = 0;
    }

    // Resume live play from wherever the simulation left off.
    floorNum = simFloor;
    currentFloor = simFloorDef;
    roomIdx = simRoomIdx;
    party = simParty;
    renderPartyStrip(party);

    if (roomsToSim > 0) {
        showAwaySummary({ elapsedMs, floorsCleared, goldEarned, wiped });
    }
}

/** Fast, non-visual resolution of a fight for offline simulation — same math as CombatEngine. */
function simulateCombatInstant(livingParty, monsterDefs) {
    const monsters = monsterDefs.map(m => ({ ...m, hp: m.maxHp, alive: true }));
    const engine = new CombatEngine(livingParty, monsters);
    let guard = 0;
    while (!engine.finished && guard < 500) { engine.tick(); guard++; }
    return engine.result;
}

// ============================================================
// Live delve progression
// ============================================================

function startFloor(num) {
    currentFloor = generateFloor(num);
    roomIdx = 0;
    startRoom();
}

function startRoom() {
    phase = 'approach';
    phaseTimer = 0;
    const room = currentFloor.rooms[roomIdx];
    setFloorRoom(floorNum, roomIdx, currentFloor.rooms.length);

    if (room.type === 'combat') {
        combat = new CombatEngine(party, room.monsters);
    } else {
        combat = null;
    }
}

function resolveNonCombatRoom(room) {
    if (room.type === 'treasure') {
        const gold = Math.round(room.gold * state.goldMul);
        state.addGold(gold);
        runGoldEarned += gold;
        events.emit('combatLog', { text: `Found a treasure cache: +${gold} gold!`, kind: 'gold' });
        spawnFloatingText(STAGE_W / 2, STAGE_H * 0.5, `+${gold} gold`, [255, 211, 77]);
        sfx.playGoldPickup();
    } else if (room.type === 'rest') {
        for (const h of party) {
            if (!h.alive) continue;
            h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * room.healPct));
        }
        events.emit('combatLog', { text: 'The party rests and recovers.', kind: 'heal' });
    }
    advanceRoom();
}

function advanceRoom() {
    roomIdx += 1;
    if (roomIdx >= currentFloor.rooms.length) {
        floorNum += 1;
        runFloorsCleared += 1;
        if (floorNum > state.deepestFloor) state.deepestFloor = floorNum;
        sfx.playFloorAdvance();
        events.emit('combatLog', { text: `— Floor ${floorNum} —`, kind: 'clear' });
        startFloor(floorNum);
    } else {
        startRoom();
    }
}

// Auto-revive charges (Cleric's Blessing upgrade) refill once per delve cycle — i.e. once the
// party makes it back down past floor 1 of the current cycle, charges are available again.
let revivesLeftThisDelve = state.reviveCharges;

function handlePartyWipe() {
    // Auto-revive: if a charge is available, resurrect the party in place instead of resetting.
    if (revivesLeftThisDelve > 0) {
        revivesLeftThisDelve -= 1;
        for (const h of party) {
            h.alive = true;
            h.hp = h.maxHp;
        }
        events.emit('combatLog', { text: `The Cleric's Blessing revives the party! (${revivesLeftThisDelve} charge(s) left)`, kind: 'heal' });
        phase = 'combat';
        return;
    }

    runWiped = true;
    sfx.playPartyWipe();
    events.emit('combatLog', { text: 'The party has been wiped out...', kind: 'death' });

    const bonus = Math.round(runGoldEarned * 0.15);
    if (bonus > 0) state.addGold(bonus);

    floorNum = state.startingFloor;
    party = buildParty();
    runGoldEarned = 0;
    revivesLeftThisDelve = state.reviveCharges;
    startFloor(floorNum);
    renderPartyStrip(party);
}

// ============================================================
// Fixed-rate combat tick (called on a self-rescheduling timeout, see scheduleNextTick)
// ============================================================

function gameTick() {
    const room = currentFloor.rooms[roomIdx];

    if (phase === 'approach') {
        phase = room.type === 'combat' ? 'combat' : 'nonCombat';
        return;
    }

    if (phase === 'nonCombat') {
        resolveNonCombatRoom(room);
        return;
    }

    if (phase === 'combat') {
        const endedThisTick = combat.tick();
        renderPartyStrip(party);

        // sound + particle feedback for the tick that just happened is handled via events (wired in boot()).

        if (endedThisTick) {
            if (combat.result === 'victory') {
                const gold = Math.round(room.monsters.length * room.goldPerMonster * state.goldMul);
                state.addGold(gold);
                runGoldEarned += gold;
                sfx.playRoomClear();
                events.emit('combatLog', { text: `Room cleared! +${gold} gold`, kind: 'clear' });
                events.emit('roomCleared', roomIdx);
                phase = 'roomEnd';
                phaseTimer = 0;
            } else {
                phase = 'wiped';
                phaseTimer = 0;
            }
        }
        return;
    }

    if (phase === 'roomEnd') {
        advanceRoom();
        return;
    }

    if (phase === 'wiped') {
        handlePartyWipe();
        return;
    }
}

// ============================================================
// Event wiring for feedback (particles/sfx keyed off combat events)
// ============================================================

events.on('heroDamaged', (id, amount) => {
    const h = party.find(x => x.id === id);
    if (!h) return;
    spawnFloatingText(STAGE_W * 0.18 + party.indexOf(h) * 90, STAGE_H * 0.72 - 30, `-${amount}`, [255, 93, 108]);
    spawnParticle(STAGE_W * 0.18 + party.indexOf(h) * 90, STAGE_H * 0.72, [255, 93, 108], { count: 5 });
    sfx.playHit(amount);
});

events.on('monsterDamaged', (id, amount, isCrit) => {
    const idx = currentFloor.rooms[roomIdx].monsters.findIndex(m => m.id === id);
    if (idx === -1) return;
    const x = STAGE_W * 0.62 + idx * 80;
    spawnFloatingText(x, STAGE_H * 0.42 - 30, `-${amount}`, isCrit ? [255, 211, 77] : [255, 255, 255]);
    spawnParticle(x, STAGE_H * 0.42, [255, 255, 255], { count: isCrit ? 10 : 5 });
    if (isCrit) sfx.playCrit(); else sfx.playHit(amount);
});

events.on('heroDied', () => sfx.playHeroDown());
events.on('monsterDied', (id) => {
    const idx = currentFloor.rooms[roomIdx].monsters.findIndex(m => m.id === id);
    const x = idx === -1 ? STAGE_W * 0.62 : STAGE_W * 0.62 + idx * 80;
    spawnParticle(x, STAGE_H * 0.42, [120, 220, 140], { count: 12, spread: 180 });
    sfx.playMonsterDeath();
});

// ============================================================
// Render loop
// ============================================================

let lastTime = performance.now();

function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    tickGoldDisplay(dt);
    updateSpeedBtn();

    const room = currentFloor.rooms[roomIdx];
    const roomType = room ? room.type : 'combat';
    const monsters = (room && room.type === 'combat') ? room.monsters : [];
    const roomLabel = room && room.isBossRoom ? 'BOSS ROOM' :
        room && room.type === 'treasure' ? 'Treasure Room' :
        room && room.type === 'rest' ? 'Rest Room' : `Floor ${floorNum}`;

    renderFrame(dt, { floorNum, roomType, party, monsters, roomLabel });

    requestAnimationFrame(loop);
}

// ============================================================
// Start
// ============================================================

boot();
scheduleNextTick();
