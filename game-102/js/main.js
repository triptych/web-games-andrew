// STARSLING — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, play, pause and the end-of-sector sheet.
//
// ?debug=1 exposes window.__ss for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadProgress, recordResult, unlocked, clearProgress } from './save.js';
import { newGame, step } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { LEVELS } from './sim/levels.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); updateTouch(); },
    onDeleteSave: () => { clearSave(); clearProgress(); progress = loadProgress(); refreshTitle(); },
});
ui.project = (x, y) => view.worldToScreen(x, y);
input.screenToWorld = (x, y) => view.screenToWorld(x, y);
input.canPull = () => mode === 'play' && !ui.anyScreen() && G.state === 'ready' && G.ammo.length > 0;
input.inFlight = () => mode === 'play' && !ui.anyScreen() && G.state === 'flight';
input.bindCanvas(document.getElementById('view'));

let G = newGame(1, 0);       // the title screen shows a sector in the background
let mode = 'title';          // title | play | over
let progress = loadProgress();
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

const newSeed = () => (Date.now() % 1e9) | 0;

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

function openLevels() {
    ui.renderLevels(progress, (i) => unlocked(progress, i), (i) => { audio.ui('click'); startGame(newGame(newSeed(), i)); });
    ui.openScreen('levels');
}

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(newSeed(), 0));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else if (act === 'levels') openLevels();
    else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'retry') startGame(newGame(newSeed(), G.level));
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('over-retry').addEventListener('click', () => { audio.ui('click'); startGame(newGame(newSeed(), G.level)); });
document.getElementById('over-next').addEventListener('click', () => { audio.ui('click'); startGame(newGame(newSeed(), G.level + 1)); });
document.getElementById('over-levels').addEventListener('click', () => { audio.ui('click'); toTitle(); openLevels(); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = newGame(1, 0);
    refreshTitle();
    ui.openScreen('title');
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
input.bindButton(document.getElementById('btn-a'), () => input.pressAct());

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
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    const over = ev.find((e) => e.type === 'over');
    if (over) {
        mode = 'over';
        clearSave();
        ui.showHud(false);
        let best = false;
        if (G.won) {
            best = G.score > (progress.best[G.level] || 0);
            progress = recordResult(G.level, G.stars, G.score);
        }
        ui.showOver(G, { hasNext: G.level + 1 < LEVELS.length, best });
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
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ss = {
        get G() { return G; },
        get mode() { return mode; },
        get progress() { return progress; },
        seen, view, ui, audio, input,
        start(seed = 1, level = 0) { startGame(newGame(seed, level)); return G; },
        autoplay(on = true) { bot = on ? makeBot({ skill: 0.6 }) : null; },
        /** Run the sim ahead synchronously with a bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot({ skill: 0.6 }); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        save: () => saveGame(G),
        hasSave,
    };
}
