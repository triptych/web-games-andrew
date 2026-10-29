// INTRUDER ALERT '84 — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title (with the bot playing an attract demo behind it), play,
// level-ups, pause and game over.
//
// ?debug=1 exposes window.__ia for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import { newGame, step, choose } from './sim/game.js';
import { makeBot, botInput, botChoose } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onChoose: (i) => pick(i),
});

let attractSeed = 84;
let G = newGame(attractSeed);   // the title screen shows the bot playing behind it
let attractBot = makeBot();
let mode = 'title';             // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
let swallowUntil = 0;           // after a level-up pick, the rest of a mashed key must not act
const seen = {};                // a count of every sim event drained in play, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !hasSave();
    ui.setHiscore(loadBest());
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
    if (act === 'new') startGame(newGame((Date.now() % 1e9) | 0), true);
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
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0), true); });
document.getElementById('over-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g, fresh = false) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    bot = bot ? makeBot() : null;
    input.flush();
    ui.showHud(true);
    updateTouch();
    view.parts.length = 0;
    audio.setPlaying(true, Math.min(4, G.sector));
    if (fresh) { ui.banner('INTRUDER ALERT!'); audio.say('Intruder alert! Intruder alert!'); }
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    audio.setPlaying(false);
    audio.hush();
    G = newGame(++attractSeed);
    attractBot = makeBot();
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

/** The player picked level-up card i. */
function pick(i) {
    if (mode !== 'play' || !G.choice || !choose(G, i)) return;
    ui.closeScreen('levelup');
    document.activeElement?.blur?.();
    input.flush();
    swallowUntil = performance.now() + 250;
    flushEvents();
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => input.pressA());

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    if (performance.now() < swallowUntil) return;
    const key = press.key;
    if (ui.top() === 'levelup') {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[key];
        if (n !== undefined) { pick(n); return; }
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
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
    if (mode !== 'play') return;              // the attract demo only gets pictures
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (ev.some((e) => e.type === 'over')) {
        mode = 'over';
        clearSave();
        saveBest(G.score);
        ui.showHud(false);
        audio.setPlaying(false);
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
    if (running !== wasRunning && mode === 'play') audio.setPlaying(running || ui.top() === 'levelup');
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST && !G.choice && !G.over) {
            const inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        if (G.choice) acc = 0;
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else if (mode === 'title') {
        // the attract demo: the bot plays at normal speed behind the title
        acc += dt;
        while (acc >= STEP) {
            if (G.choice) choose(G, botChoose(G));
            step(G, botInput(G, attractBot), STEP);
            acc -= STEP;
        }
        if (G.over) { G = newGame(++attractSeed); attractBot = makeBot(); }
    } else acc = 0;
    flushEvents();
    if (mode === 'play' && G.choice && !ui.anyScreen()) {
        if (bot) { choose(G, botChoose(G)); flushEvents(); } else ui.showChoice(G);
    }
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ia = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing (and picking upgrades). */
        ff(sec) {
            const b = makeBot();
            for (let t = 0; t < sec && !G.over; t += STEP) {
                if (G.choice) { if (ui.top() === 'levelup') ui.closeScreen('levelup'); choose(G, botChoose(G)); }
                step(G, botInput(G, b), STEP);
            }
            flushEvents();
        },
        pick,
        save: () => saveGame(G),
        hasSave,
    };
}
