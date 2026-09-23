/**
 * main.js — boot, the mode state machine, and the frame loop.
 *
 * The loop runs the simulation on a fixed 1/120s timestep with an accumulator
 * (so physics and pattern timing are identical on a 60Hz and a 144Hz display),
 * then renders once. Simulation events are drained once per frame and handed to
 * the view, the audio and the UI — each decides what, if anything, to do.
 */

import { TICK, MAX_FRAME_DT, DIFFICULTY, PLAYER, ARENA } from './core/config.js';
import { state, MODE, setMode, newRun, addCadet } from './core/state.js';
import { loadSave, writeSave, recordRun } from './core/save.js';
import { input, initInput, setPointerWorld, consumeFlare, consumeOd, onPause, onAnyKey,
         resetInput, captureBind, setBinds, DEFAULT_BINDS, getBinds,
         setVirtualHold } from './core/input.js';
import { createWorld, stepWorld, levelSummary } from './sim/world.js';
import { LEVELS, LEVEL_COUNT } from './sim/levels.js';
import { cadetForLevel, CADET_BY_ID } from './sim/story.js';
import { initScene, screenToWorld, clock, setQuality, quality, QUALITY } from './view/scene.js';
import { initRender, renderWorld, setLevelVisuals, handleFxEvent, resetRender, spawnBanner } from './view/render.js';
import { setBackdropQuality } from './view/backdrop.js';
import { initHud, updateHud, showHud } from './ui/hud.js';
import { initComms, updateComms, say, sayRaw, clearComms } from './ui/comms.js';
import * as menus from './ui/menus.js';
import { initAudio, resumeAudio, setAudioOptions, setMusicLevel, handleAudioEvent, sfx } from './audio/sounds.js';

let accumulator = 0;
let lastFpsT = 0;
let frames = 0;
let pendingSummary = null;
let touchEls = {};
let dragAnchor = null;      // where the finger and the ship were when a drag began
let slowFrames = 0;         // consecutive half-second samples below target

// --------------------------------------------------------------------- boot

function boot() {
    state.save = loadSave();
    setBinds(state.save.binds ?? DEFAULT_BINDS);

    const canvas = document.getElementById('gl');
    initScene(canvas);
    initRender();
    initHud();
    initComms();
    initMenuActions();
    menus.initMenus({
        onStart: startRun,
        onIntroDone: afterIntro,
        onLaunch: launchLevel,
        onResume: resumeGame,
        onNextLevel: nextLevel,
        onContinue: continueRun,
        onRetry: retryLevel,
        onQuit: toTitle,
        onBack: toTitle,
        onBackToPause: () => menus.showPause(state.run),
    });
    initInput(canvas);
    initTouchControls();

    onPause(() => {
        if (state.mode === MODE.PLAYING) pauseGame();
        else if (state.mode === MODE.PAUSED) resumeGame();
    });
    onAnyKey(() => { initAudio(); resumeAudio(); });
    if (typeof window !== 'undefined') {
        window.addEventListener('pointerdown', () => { initAudio(); resumeAudio(); }, { once: true });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state.mode === MODE.PLAYING) pauseGame();
        });
    }

    applyAudioOptions();
    const savedQuality = state.save.options.quality ?? 'auto';
    if (savedQuality !== 'auto') { quality.auto = false; setQuality(Number(savedQuality)); }
    setBackdropQuality(QUALITY[quality.tier].octaves);
    toTitle();
    requestAnimationFrame(frame);
}

/**
 * Drop a quality tier if the frame rate will not hold. Only while playing, only
 * downward, and only after three consecutive bad samples, so one hitch (a boss
 * spawning, a tab regaining focus) never costs the player their visuals.
 */
function adaptQuality() {
    if (state.mode !== MODE.PLAYING || !quality.auto) return;
    if (state.fps > 0 && state.fps < 40) slowFrames++;
    else slowFrames = 0;
    if (slowFrames >= 3 && quality.tier < QUALITY.length - 1) {
        slowFrames = 0;
        if (setQuality(quality.tier + 1)) {
            setBackdropQuality(QUALITY[quality.tier].octaves);
            console.info(`[starcadet] frame rate low — dropped to quality tier ${quality.tier}`);
        }
    }
}

export function isTouchDevice() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

function applyAudioOptions() {
    setAudioOptions({ sfx: state.save.options.sfx, music: state.save.options.music });
}

// ------------------------------------------------------------- menu plumbing

function initMenuActions() {
    menus.registerAction('start', startRun);
    menus.registerAction('introDone', afterIntro);
    menus.registerAction('levelselect', () => menus.showLevelSelect(state.save));
    menus.registerAction('options', () => menus.showOptions(state.save, { fromPause: state.mode === MODE.PAUSED }));
    menus.registerAction('roll', () => menus.showRoll(state.save));
    menus.registerAction('back', toTitle);
    menus.registerAction('backToPause', () => menus.showPause(state.run));
    menus.registerAction('resume', resumeGame);
    menus.registerAction('quit', toTitle);
    menus.registerAction('launch', launchLevel);
    menus.registerAction('next', nextLevel);
    menus.registerAction('continueRun', continueRun);
    menus.registerAction('retryLevel', retryLevel);
    menus.registerAction('pickLevel', (value) => {
        const level = Number(value);
        state.run = newRun(state.save.difficulty, level);
        // Level select hands you the wing you would have had by then, or the
        // Heart's final phase would be unwinnable from a cold start.
        for (const cadet of LEVELS.filter((l) => l.id < level).map((l) => cadetForLevel(l.id)).filter(Boolean)) {
            addCadet(state.run, cadet);
        }
        state.run.rescued = LEVELS.filter((l) => l.id < level)
            .reduce((sum, l) => sum + Math.round(l.podBudget * 2.2), 0);
        showBriefing();
    });
    menus.registerAction('pickDifficulty', (value) => {
        state.save.difficulty = value;
        writeSave(state.save);
        sfx.ui();
        if (state.mode === MODE.PAUSED) menus.showOptions(state.save, { fromPause: true });
        else if (state.mode === MODE.LEVEL_SELECT) menus.showLevelSelect(state.save);
        else menus.showOptions(state.save);
    });
    menus.registerAction('quality', (value) => {
        const q = value === 'auto' ? null : Number(value);
        state.save.options.quality = value;
        quality.auto = q === null;
        if (q !== null) {
            setQuality(q);
            setBackdropQuality(QUALITY[quality.tier].octaves);
        }
        writeSave(state.save);
        sfx.ui();
        menus.showOptions(state.save, { fromPause: state.mode === MODE.PAUSED });
    });
    menus.registerAction('toggle', (value) => {
        state.save.options[value] = !state.save.options[value];
        writeSave(state.save);
        applyAudioOptions();
        sfx.ui();
        menus.showOptions(state.save, { fromPause: state.mode === MODE.PAUSED });
    });
    menus.registerAction('rebind', (value) => {
        menus.markCapturing(value);
        captureBind(value, () => {
            state.save.binds = getBinds();
            writeSave(state.save);
            menus.showOptions(state.save, { fromPause: state.mode === MODE.PAUSED });
        });
    });
    menus.registerAction('resetBinds', () => {
        setBinds(DEFAULT_BINDS);
        state.save.binds = DEFAULT_BINDS;
        writeSave(state.save);
        menus.showOptions(state.save, { fromPause: state.mode === MODE.PAUSED });
    });
}

// ------------------------------------------------------------------- modes

function toTitle() {
    setMode(MODE.TITLE);
    state.world = null;
    resetRender();
    clearComms();
    showHud(false);
    showTouch(false);
    menus.showTitle(state.save);
}

function startRun() {
    state.run = newRun(state.save.difficulty, 1);
    if (!state.save.seenIntro) {
        setMode(MODE.BRIEFING);
        menus.showIntro();
    } else {
        showBriefing();
    }
}

function afterIntro() {
    state.save.seenIntro = true;
    writeSave(state.save);
    showBriefing();
}

function showBriefing() {
    setMode(MODE.BRIEFING);
    showHud(false);
    showTouch(false);
    menus.showBriefing(state.run.level, state.run);
}

function launchLevel() {
    const run = state.run;
    const world = createWorld({
        level: run.level,
        run,
        seed: `${run.seed}:${run.difficulty}`,
        // On a touch device there is no fire button by design (you need both
        // thumbs for flying and flares), so auto-fire is not optional there.
        autofire: state.save.options.autofire || isTouchDevice(),
    });
    // carry the ship's condition between levels
    world.player.weapon = run.weapon;
    world.player.power = run.power;
    world.player.lives = run.lives;
    world.player.flares = Math.max(run.flares, PLAYER.startFlares);
    state.world = world;

    setLevelVisuals(world.level);
    setMusicLevel(world.levelNum);
    clearComms();
    menus.hideScreens();
    showHud(true);
    showTouch(true);
    resetInput();
    dragAnchor = null;
    setMode(MODE.PLAYING);
    accumulator = 0;
    clock.getDelta();
    spawnBanner(`${world.level.name}`, '#7ef2ff', { y: 6, scale: 2.0, life: 2.6 });
}

function pauseGame() {
    if (state.mode !== MODE.PLAYING) return;
    setMode(MODE.PAUSED);
    resetInput();
    menus.showPause(state.run);
}

function resumeGame() {
    if (state.mode !== MODE.PAUSED) return;
    menus.hideScreens();
    setMode(MODE.PLAYING);
    accumulator = 0;
    dragAnchor = null;               // the finger moved while the menu was up
    input.pointer.rebase = true;
    clock.getDelta();
}

function finishLevel() {
    const world = state.world;
    const run = state.run;
    const summary = levelSummary(world);
    pendingSummary = summary;

    run.score += summary.score;
    run.rescued += summary.cadets;
    run.lost += summary.cadetsLost;
    run.podsRescued += summary.rescued;
    run.podsLost += summary.lost;
    run.weapon = world.player.weapon;
    run.power = world.player.power;
    run.lives = world.player.lives;
    run.flares = world.player.flares;
    run.levelResults.push(summary);

    const cadet = cadetForLevel(run.level);
    if (cadet) addCadet(run, cadet);

    recordRun(state.save, {
        level: run.level, score: summary.score, rescued: summary.rescued,
        rank: summary.rank, cleared: true,
    });
    if (run.level >= LEVEL_COUNT) state.save.clears++;
    writeSave(state.save);

    setMode(MODE.LEVEL_CLEAR);
    showHud(false);
    showTouch(false);
    menus.showLevelClear(summary, run, cadet);
}

function nextLevel() {
    const run = state.run;
    if (run.level >= LEVEL_COUNT) {
        setMode(MODE.ENDING);
        state.world = null;
        resetRender();
        menus.showEnding(run);
        return;
    }
    run.level++;
    state.world = null;
    resetRender();
    showBriefing();
}

function gameOver() {
    setMode(MODE.GAME_OVER);
    showHud(false);
    showTouch(false);
    menus.showGameOver(state.run, { canContinue: state.run.continues > 0 });
}

function continueRun() {
    const run = state.run;
    if (run.continues <= 0) return retryLevel();
    run.continues--;
    run.lives = DIFFICULTY[run.difficulty].lives;
    run.power = Math.max(1, run.power - 1);
    run.flares = PLAYER.startFlares;
    state.world = null;
    resetRender();
    launchLevel();
}

function retryLevel() {
    const run = state.run;
    run.lives = DIFFICULTY[run.difficulty].lives;
    run.flares = PLAYER.startFlares;
    state.world = null;
    resetRender();
    showBriefing();
}

// -------------------------------------------------------------- event drain

function drainEvents(world) {
    const q = world.fxQueue;
    if (q.length === 0) return;
    for (const ev of q) {
        handleFxEvent(ev, world);
        handleAudioEvent(ev);
        if (ev.type === 'comms') say(ev.id);
        if (ev.type === 'cadetRescued') {
            const cadet = CADET_BY_ID[ev.cadet];
            if (cadet) sayRaw(cadet.callsign, cadet.rescueLine, 6);
        }
        if (ev.type === 'playerRespawn' || ev.type === 'playerDeath') {
            dragAnchor = null;
            input.pointer.rebase = true;
        }
        if (ev.type === 'podLost' && ev.reason === 'fell') maybeSay('l1_pod_lost', 0.1);
        if (ev.type === 'odReady') maybeSay('od_ready', 0.5);
    }
    q.length = 0;
}

const saidRecently = new Map();
function maybeSay(id, chance = 1) {
    const now = performance.now();
    if ((saidRecently.get(id) ?? -1e9) > now - 25000) return;
    if (Math.random() > chance) return;
    saidRecently.set(id, now);
    say(id);
}

// -------------------------------------------------------------------- loop

function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), MAX_FRAME_DT);

    frames++;
    lastFpsT += dt;
    if (lastFpsT >= 0.5) {
        state.fps = Math.round(frames / lastFpsT);
        frames = 0; lastFpsT = 0;
        const fpsEl = document.getElementById('fps');
        if (fpsEl) {
            fpsEl.textContent = state.save.options.showFps
                ? `${state.fps} FPS${quality.tier ? ` · Q${quality.tier}` : ''}` : '';
        }
        adaptQuality();
    }

    updateComms(dt);

    const world = state.world;
    if (state.mode === MODE.PLAYING && world) {
        if (input.pointer.active && input.pointer.px !== undefined) {
            const p = screenToWorld(input.pointer.px, input.pointer.py);
            if (input.pointer.relative) {
                // Touch: move the ship BY the finger's travel, not TO the finger.
                if (input.pointer.rebase || !dragAnchor) {
                    input.pointer.rebase = false;
                    dragAnchor = { wx: p.x, wy: p.y, sx: world.player.x, sy: world.player.y };
                }
                const pad = PLAYER.bounds.pad;
                const gain = PLAYER.touchGain;
                const rawX = dragAnchor.sx + (p.x - dragAnchor.wx) * gain;
                const rawY = dragAnchor.sy + (p.y - dragAnchor.wy) * gain;
                const tx = Math.max(ARENA.left + pad, Math.min(ARENA.right - pad, rawX));
                const ty = Math.max(ARENA.bottom + pad, Math.min(ARENA.top - pad, rawY));
                // Absorb the overshoot into the anchor. Without this, dragging
                // past the wall builds up an offset and the ship ignores the
                // first part of the drag back — the classic sticky-edge feel.
                dragAnchor.sx += tx - rawX;
                dragAnchor.sy += ty - rawY;
                setPointerWorld(tx, ty);
            } else {
                dragAnchor = null;
                setPointerWorld(p.x, p.y);
            }
        }
        const snapshot = {
            ax: input.ax, ay: input.ay,
            focus: input.focus,
            fire: input.fire,
            flare: consumeFlare(),
            od: consumeOd(),
            pointer: input.pointer,
        };

        accumulator += dt;
        let steps = 0;
        while (accumulator >= TICK && steps < 8) {
            stepWorld(world, snapshot, TICK);
            // edge-triggered inputs fire on the first sub-step only
            snapshot.flare = false;
            snapshot.od = false;
            accumulator -= TICK;
            steps++;
        }
        if (steps >= 8) accumulator = 0;    // give up catching up rather than spiral

        drainEvents(world);
        updateHud(world, state.run);
        renderWorld(world, dt);

        if (world.phase === 'done') finishLevel();
        else if (world.phase === 'failed') gameOver();
    } else if (world) {
        drainEvents(world);
        renderWorld(world, dt, { paused: true });
    } else {
        renderIdle(dt);
    }
}

/** Menus still want a living backdrop behind them. */
function renderIdle(dt) {
    renderWorld(IDLE_WORLD, dt, { paused: true });
}

const IDLE_WORLD = {
    player: { x: 0, y: -9, alive: false, respawnTimer: 1, invuln: 0, focus: false,
              odActive: 0, tilt: 0, firing: false, drone: null, graze: 0 },
    enemies: [], pBullets: [], eBullets: [], pods: [], pickups: [], hazards: [],
    beams: [], fields: [], waves: [], boss: null, phase: 'idle', chain: 0,
    level: { id: 1, name: 'HANGAR RING', cues: [] }, t: 0, fxQueue: [],
    stats: { score: 0 },
};

// ------------------------------------------------------------ touch controls

function initTouchControls() {
    touchEls = {
        wrap: document.getElementById('touch'),
        flare: document.getElementById('touch-flare'),
        od: document.getElementById('touch-od'),
        focus: document.getElementById('touch-focus'),
        pause: document.getElementById('touch-pause'),
    };
    const press = (node, fn) => {
        if (!node) return;
        node.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(true); }, { passive: false });
        node.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); fn(false); }, { passive: false });
        node.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); fn(true); });
        node.addEventListener('mouseup', (e) => { e.preventDefault(); e.stopPropagation(); fn(false); });
    };
    press(touchEls.flare, (down) => { if (down) input.flare = true; });
    press(touchEls.od, (down) => { if (down) input.od = true; });
    press(touchEls.focus, (down) => { setVirtualHold('focus', down); touchEls.focus?.classList.toggle('on', down); });
    press(touchEls.pause, (down) => { if (down) (state.mode === MODE.PLAYING ? pauseGame() : resumeGame()); });
}

function showTouch(show) {
    touchEls.wrap?.classList.toggle('hidden', !show);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    // A small debug handle: lets a dev console (or a Playwright driver) inspect
    // the live run and jump to a boss without a cheat menu in the UI.
    window.__sc = { state, MODE, startRun, launchLevel };
}

export { boot, startRun, launchLevel };
