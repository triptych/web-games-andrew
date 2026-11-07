// PERIHELION — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title (where the bot plays a silent demo), play, pause and the end.
//
// ?debug=1 exposes window.__ph for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import { newGame, step } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { PLAYER } from './config.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
if (DEBUG && params.has('q')) settings.quality = Math.max(0, Math.min(2, +params.get('q')));
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const canvas = document.getElementById('view');
const view = new View(canvas, { quality: settings.quality });
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.setQuality(s.quality); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

const newSeed = () => (Date.now() % 1e9) | 0;
let G = newGame(DEBUG ? 3 : newSeed());   // the title screen shows the bot playing in the background
let demo = makeBot({ skill: 0.9, seed: 11 });
let mode = 'title';          // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

audio.muted = true;
audio.setMusic('title');

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !hasSave();
    const best = loadBest();
    document.getElementById('best').textContent = best ? `Best ${best}` : '';
}
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(newSeed(), { cadet: settings.diff === 'cadet' }));
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
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame(newSeed(), { cadet: settings.diff === 'cadet' })); });
document.getElementById('over-menu').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    audio.muted = false;
    audio.setMusic(G.level === 7 ? 'boss' : 'play');
    ui.showHud(true);
    updateTouch();
    ui.say(G.t > 1 ? 'Welcome back, Commander.' : 'Good morning, Commander. Shall we begin?', 4);
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = newGame(newSeed());
    demo = makeBot({ skill: 0.9, seed: 11 });
    audio.muted = true;
    audio.setMusic('title');
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
input.aimFrom = (x, y) => view.aimFrom(G, x, y);
input.bindMouse(canvas);
input.bindStick('move', document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindStick('aim', document.getElementById('aim-zone'), document.getElementById('aim'), document.querySelector('#aim .knob'));
input.bindButton(document.getElementById('btn-dash'), () => input.pressDash());

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
    if (mode === 'title') { view.onEvents(G, ev, { quiet: true }); return; }
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (ev.some((e) => e.type === 'level')) saveGame(G);
    if (ev.some((e) => e.type === 'over' || e.type === 'win')) {
        mode = 'over';
        clearSave();
        saveBest(G.score);
        ui.showHud(false);
        ui.openScreen('over');
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
    input.enabled = running;
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
    } else if (mode === 'title') {
        // the demo: the bot plays a real game, silently, while the camera circles the rock
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12) { step(G, botInput(G, demo), STEP); acc -= STEP; n++; }
        if (G.over) { G = newGame(newSeed()); demo = makeBot({ skill: 0.9, seed: 11 }); }
    } else acc = 0;
    flushEvents();
    audio.setBreath(running && G.phase === 'play', Math.max(0, 1 - G.player.hp / PLAYER.hp));
    view.frame(G, dt, time, mode === 'title' ? 'title' : 'play');
    if (mode === 'play') ui.hud(G, dt);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ph = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1, level = 0) { startGame(newGame(seed, { level })); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !G.over; t += STEP) { step(G, botInput(G, b), STEP); if (G.events.length > 400) flushEvents(); } flushEvents(); },
        skipIntro() { if (G.phase === 'intro') G.phaseT = 0.001; },
        save: () => saveGame(G),
        hasSave,
    };
}
