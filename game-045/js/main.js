/**
 * main.js — PINBREAK '86 entry point.
 *
 * Modes: 'title' (attract-mode demo: the bot plays behind the logo)
 *        → 'playing' ⇄ 'paused' → 'over'
 *
 * Frame loop: real dt (capped) × time scale (slow-mo / hit-stop) feeds a
 * fixed 1/480 s simulation accumulator. The sim's fx queue is drained once a
 * frame into the juice director, then every view syncs from the world.
 *
 * Library: three.js r165 via import map (see index.html).
 */

import { PHYS } from './config.js';
import { createWorld, stepWorld, comboMult } from './sim/world.js';
import { makeBot, botInput } from './sim/bot.js';
import {
    initScene, renderer, renderFrame, setSway, setFollow, setQuality, getQuality,
} from './view/scene.js';
import { initBackdrop, updateBackdrop } from './view/backdrop.js';
import { initTableView, syncTableView, resetTableView, setBallGlows, setBallGlowColor } from './view/tableView.js';
import { initBalls, syncBalls, resetBalls } from './view/balls.js';
import { initFx, updateFx, resetFx } from './view/fx.js';
import { updateLights, clearLights } from './view/lights.js';
import { initJuice, handleEvent, frameJuice } from './juice.js';
import { initInput, readInput, setInputEnabled } from './input.js';
import {
    initUI, showScreen, updateHUD, resetHUD, showGameOver, setBest, setMuted,
} from './ui.js';
import {
    initAudio, startMusic, setMusicIntensity, getBeatPulse, toggleSound, isSoundEnabled,
    setSoundEnabled, playUiClick,
} from './sounds.js';
import { state } from './state.js';

// ============================================================
// Boot
// ============================================================

initScene();
initBackdrop();
initBalls(renderer);
initFx();

let mode = 'title';
let world = createWorld(Date.now() & 0xffff);
let bot = makeBot();
initTableView(world);

// --- Time control for the juice director ---
let hitstop = 0;
let slowScale = 1, slowTimer = 0;
const laterQueue = [];
initJuice({
    hitstop: (s) => { hitstop = Math.max(hitstop, s); },
    slowmo: (scale, s) => { slowScale = Math.min(slowScale, scale); slowTimer = Math.max(slowTimer, s); },
    later: (fn, s) => laterQueue.push({ fn, t: s }),
});

initUI({
    start: startGame,
    resume: () => setPaused(false),
    quit: toTitle,
    again: startGame,
    menu: toTitle,
    mute: () => {
        initAudio();
        const on = toggleSound();
        state.muted = !on;
        state.save();
        setMuted(!on);
    },
    pause: () => setPaused(true),
});
setBest(state.best);
setSoundEnabled(!state.muted);
setMuted(state.muted);

initInput({
    isBallHeld: () => mode === 'playing' && world.balls.some((b) => b.held),
    onKey: (e) => {
        if (mode === 'title' && (e.code === 'Space' || e.code === 'Enter')) startGame();
        else if (mode === 'over' && (e.code === 'Space' || e.code === 'Enter')) startGame();
        else if (e.code === 'KeyP' || e.code === 'Escape') {
            if (mode === 'playing') setPaused(true);
            else if (mode === 'paused') setPaused(false);
        } else if (e.code === 'KeyM') {
            document.getElementById('mute-btn').click();
        }
    },
});

showScreen('title');
setSway(1);

// ============================================================
// Mode changes
// ============================================================

function freshWorld(seed) {
    resetTableView();
    resetBalls();
    resetFx();
    clearLights();
    resetHUD();
    world = createWorld(seed);
    bot = makeBot();
    hitstop = 0; slowScale = 1; slowTimer = 0;
    laterQueue.length = 0;
    acc = 0;
}

function startGame() {
    initAudio();
    startMusic();
    playUiClick();
    freshWorld((Date.now() ^ 0x5bd1e995) >>> 0);
    world.fxQueue.length = 0;
    mode = 'playing';
    overTimer = -1;
    setSway(0);
    showScreen(null);
    setInputEnabled(true);
}

function toTitle() {
    playUiClick();
    freshWorld(Date.now() & 0xffff);
    mode = 'title';
    setSway(1);
    setInputEnabled(false);
    showScreen('title');
    setBest(state.best);
}

function setPaused(p) {
    if (p && mode === 'playing') {
        mode = 'paused';
        setInputEnabled(false);
        showScreen('pause');
    } else if (!p && mode === 'paused') {
        mode = 'playing';
        setInputEnabled(true);
        showScreen(null);
        playUiClick();
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// ============================================================
// Frame loop
// ============================================================

let acc = 0;
let overTimer = -1;
let elapsed = 0;
let fpsFrames = 0, fpsTime = 0, slowSamples = 0;
let lastT = performance.now();

function frame(now) {
    requestAnimationFrame(frame);
    // Cap dt — a hidden tab returns one giant delta on the first frame back.
    const realDt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    elapsed += realDt;

    // --- Time effects ---
    if (slowTimer > 0) {
        slowTimer -= realDt;
        if (slowTimer <= 0) slowScale = 1;
    } else if (slowScale < 1) {
        slowScale = Math.min(1, slowScale + realDt * 3);
    }
    let simDt = realDt * slowScale;
    if (hitstop > 0) { hitstop -= realDt; simDt = 0; }
    for (let i = laterQueue.length - 1; i >= 0; i--) {
        laterQueue[i].t -= realDt;
        if (laterQueue[i].t <= 0) { const { fn } = laterQueue[i]; laterQueue.splice(i, 1); fn(); }
    }

    // --- Simulation ---
    if (mode === 'playing' || mode === 'title' || mode === 'over') {
        const input = mode === 'playing' ? readInput()
            : mode === 'title' ? botInput(bot, world, simDt)
            : { left: false, right: false, launch: false, nudge: false };
        acc += simDt;
        let steps = 0;
        while (acc >= PHYS.tick && steps < 60) {
            stepWorld(world, input, PHYS.tick);
            input.nudge = false;                  // edge-triggered: first sub-step only
            acc -= PHYS.tick;
            steps++;
        }
        if (steps >= 60) acc = 0;

        // The attract demo never ends: restart it when the bot loses.
        if (mode === 'title' && world.over) freshWorld((world.score + 17) & 0xffff);
    }

    // --- Events → juice ---
    const quiet = mode === 'title';
    const q = world.fxQueue;
    for (let i = 0; i < q.length; i++) {
        handleEvent(q[i], world, quiet);
        if (q[i].type === 'gameOver' && mode === 'playing') overTimer = 1.8;
    }
    q.length = 0;
    frameJuice(world, realDt);

    if (overTimer > 0 && mode === 'playing') {
        overTimer -= realDt;
        if (overTimer <= 0) {
            const isNew = state.submit(world.score);
            showGameOver(world, state.best, isNew);
            mode = 'over';
            setInputEnabled(false);
            showScreen('over');
        }
    }

    // --- Music intensity follows the action ---
    const mult = comboMult(world);
    const live = world.balls.length;
    let intensity = mode === 'playing' ? 1 : 0;
    if (mode === 'playing' && (mult >= 3 || live >= 2)) intensity = 2;
    if (mode === 'playing' && (mult >= 5 || live >= 3)) intensity = 3;
    setMusicIntensity(intensity);
    const hype = mode === 'playing' ? Math.min(1, (mult - 1) / 5 + (live - 1) * 0.25) : 0;

    // --- Views ---
    const beat = getBeatPulse(elapsed);
    const fire = world.power.fire > 0;
    setBallGlows(world.balls);
    setBallGlowColor(fire ? 0xff7a1a : 0x35f2ff);
    const lead = world.balls.find((b) => !b.held);
    if (lead && mode === 'playing') setFollow(lead.x, lead.y); else setFollow(0.65, 14);
    syncTableView(world, realDt, elapsed, beat);
    syncBalls(world, realDt, fire);
    updateFx(realDt);
    updateLights(realDt);
    updateBackdrop(realDt, elapsed, beat, hype);
    if (mode !== 'title') updateHUD(world, realDt);
    renderFrame(realDt, elapsed);

    // --- Adaptive quality: drop a tier after sustained low frame rates ---
    fpsFrames++;
    fpsTime += realDt;
    if (fpsTime >= 1) {
        const fps = fpsFrames / fpsTime;
        fpsFrames = 0; fpsTime = 0;
        if (fps < 42) slowSamples++; else slowSamples = 0;
        if (slowSamples >= 3 && getQuality() < 2 && !debug) {
            setQuality(getQuality() + 1);
            slowSamples = 0;
        }
    }
}

// ============================================================
// Debug hooks (?debug=1) — used by dev/browsertest.mjs
// ============================================================

const debug = new URLSearchParams(location.search).has('debug');
if (debug) {
    window.__pb = {
        get world() { return world; },
        get mode() { return mode; },
        start: startGame,
        pause: setPaused,
        power(kind, t = 10) { world.power[kind] = t; },
        blastAt(x, y) { world.blasts.push({ x, y, t: 0 }); },
        clearBricks() { for (const b of world.bricks) { b.alive = false; } world.bricksLeft = 0; },
        sound: isSoundEnabled,
    };
}

requestAnimationFrame((t) => { lastT = t; frame(t); });
