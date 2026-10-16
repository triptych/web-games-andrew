// WYRMZONE — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title (with the bot flying a demo behind it), play, pause and
// game over.
//
// ?debug=1 exposes window.__wz for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import { newGame, step, continueGame, nextCycle } from './sim/game.js';
import { STAGE_INDEX } from './sim/data.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const canvas = document.getElementById('view');
const view = new View(canvas);
view.setCrt(settings.crt);
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.setCrt(s.crt); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
let best = loadBest();
view.hud.best = best;
ui.setBest(best);

// the title screen plays a demo behind it: the bot on foot, then on the wing
const DEMOS = ['march1', 'sky', 'march3', 'gorge', 'boss', 'ramparts'];
let demoIdx = 0, demoT = 0;
const demoGame = () => newGame(1000 + demoIdx * 77, { stage: STAGE_INDEX[DEMOS[demoIdx % DEMOS.length]] });
let G = demoGame();
let demoBot = makeBot({ skill: 1, seed: 3 });
let mode = 'title';          // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
let lastMode = null;
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audio.playSong('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

const newSeed = () => (Date.now() % 1e9) | 0;

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(newSeed()));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('over-continue').addEventListener('click', () => {
    audio.ui('click');
    if (continueGame(G)) resume();
});
document.getElementById('over-cycle').addEventListener('click', () => {
    audio.ui('click');
    if (nextCycle(G)) resume();
});
document.getElementById('over-title').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g) {
    G = g;
    view.hud.reset();
    lastMode = null;
    resume();
    saveGame(G);
}

/** Into play with the current G: close every screen and let go of the keyboard focus. */
function resume() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    audio.playSong(G.mode === 'flight' ? 'flight' : G.stageIdx === STAGE_INDEX.boss ? 'boss' : 'march');
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    demoT = 0;
    G = demoGame();
    view.hud.reset();
    refreshTitle();
    ui.setBest(best);
    ui.openScreen('title');
    audio.playSong('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindMouse(canvas);
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindFire(document.getElementById('btn-fire'));

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    if (mode !== 'play') return;              // the demo is seen, not heard
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(G, ev);
    if (ev.some((e) => e.type === 'stage')) saveGame(G);
    if (G.score > best) { best = G.score; view.hud.best = best; }
    if (ev.some((e) => e.type === 'over')) {
        mode = 'over';
        clearSave();
        saveBest(best);
        ui.showHud(false);
        ui.showOver(G, best);
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        const flight = G.mode === 'flight';
        const aimAt = (x, y) => view.screenToAim(x, y);
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : input.state(G.mode === 'flight', aimAt, settings.invert);
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
            if (G.over) break;
        }
        if (flight !== (G.mode === 'flight')) acc = 0;
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else if (mode === 'title') {
        // the attract demo
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12) { step(G, botInput(G, demoBot), STEP); acc -= STEP; n++; }
        demoT += dt;
        if (G.over || demoT > 24) { demoIdx++; demoT = 0; G = demoGame(); demoBot = makeBot({ skill: 1, seed: demoIdx }); }
    } else acc = 0;
    if (G.mode !== lastMode) { lastMode = G.mode; ui.setMode(G.mode); }
    flushEvents();
    audio.update(G, dt, running);
    view.hud.demo = mode === 'title';
    view.frame(G, dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); saveBest(best); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__wz = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Skip the title. stage: an index or an id ('sky', 'gorge', ...). */
        start(seed = 1, stage = 0) {
            const s = typeof stage === 'string' ? STAGE_INDEX[stage] : stage;
            startGame(newGame(seed, { stage: s }));
            return G;
        },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        /** Run the sim ahead with no input at all (enemies get their way). */
        idle(sec) { for (let t = 0; t < sec && !G.over; t += STEP) step(G, { x: 0, y: 0, a: false, abs: false }, STEP); flushEvents(); },
        save: () => saveGame(G),
        hasSave,
    };
}
