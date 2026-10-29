// Kaiju Roll — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, play, pause, the level sheets and game over.
//
// ?debug=1 exposes window.__kr for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, saveBest } from './save.js';
import { newGame, step, choosePerk, nextLevel, destroyedFrac } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { LEVELS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
// reduced motion: gentler shake, no blinking power-ups
view.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
view.shakeScale = view.reduced ? Math.min(0.3, settings.shake) : settings.shake;
view.setOutline(settings.outline !== false);
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.shakeScale = view.reduced ? Math.min(0.3, s.shake) : s.shake; view.setOutline(s.outline !== false); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

const freshSeed = () => ((Date.now() * 2654435761) >>> 0) % 1e9;
let G = newGame(freshSeed() | 1, 0);     // the title screen shows a bot rolling through a city
let attract = makeBot({ skill: 0.85 });
let mode = 'title';                      // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;                          // the debug autoplayer
let wasRunning = false;
const seen = {};                         // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); ui.refreshBest(); }
refreshTitle();
ui.openScreen('title');

let musicLevel = -1;
const unlock = () => {
    audio.init();
    if (audio.ctx && musicLevel < 0) { musicLevel = 0; audio.music.start(0, 'title'); }
};
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

function startMusic(level, m) { if (!audio.ctx) return; musicLevel = level; audio.music.start(level, m); }

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(freshSeed()), false);
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g, true); else ui.toast('That save could not be read.');
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
document.getElementById('intro-go').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('intro'); input.flush(); });
document.getElementById('clear-next').addEventListener('click', () => {
    audio.ui('click');
    ui.closeScreen('clear');
    nextLevel(G);
    input.flush();
    bot && (bot.target = null);
    startMusic(G.level, 'play');
    saveGame(G);
    ui.showIntro(G);
});
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame(freshSeed()), false); });
document.getElementById('over-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g, skipIntro) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.waveSeen = {};
    ui.showHud(true);
    updateTouch();
    startMusic(G.level, 'play');
    saveGame(G);
    if (!skipIntro) ui.showIntro(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = newGame(freshSeed() | 1, 0);
    attract = makeBot({ skill: 0.85 });
    startMusic(0, 'title');
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
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => input.pressA());

// ------------------------------------------------------------------ input routing
const FIXED_SCREENS = ['title', 'over', 'intro', 'clear'];
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !FIXED_SCREENS.includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    const isAttract = mode === 'title';
    if (!isAttract) for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (isAttract) return;                    // the title's bot is silent
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'clear') {
            saveGame(G);
            ui.showClear(G, (id) => choosePerk(G, id));
        } else if (e.type === 'win' || e.type === 'over') {
            const won = e.type === 'win';
            mode = 'over';
            const nb = saveBest(G.score, G.level);
            clearSave();
            ui.showHud(false);
            ui.showOver(G, won, nb);
        }
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
    // back from a menu: the key or tap that closed it must not also act in the game
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
        if (saveT > 20) { saveT = 0; if (G.phase === 'play') saveGame(G); }
    } else if (mode === 'title') {
        // attract mode: a bot plays the real game behind the menu
        if (G.over || G.phase !== 'play') { G = newGame(freshSeed() | 1, Math.floor(Math.random() * 3)); attract = makeBot({ skill: 0.85 }); }
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12) { step(G, botInput(G, attract), STEP); acc -= STEP; n++; }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') {
        ui.hud(G, view);
        if (audio.ctx) {
            const frac = destroyedFrac(G) / LEVELS[G.level].goal;
            audio.music.setIntensity(0.15 + 0.5 * Math.min(1, frac) + (G.foes.length ? 0.2 : 0) + (G.combo.n >= 10 ? 0.1 : 0));
            audio.music.duck(ui.anyScreen() || G.phase === 'dead');
        }
    } else if (audio.ctx) audio.music.duck(false);
    audio.onFrame(G, running);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play' && G.phase === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__kr = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Skip the title and the intro card: straight into city `level` (0-4). */
        start(seed = 1, level = 0) { startGame(newGame(seed, level), true); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; stops when the city is flattened. */
        ff(sec) {
            const b = makeBot();
            for (let t = 0; t < sec && !G.over && G.phase !== 'clear' && G.phase !== 'won'; t += STEP) step(G, botInput(G, b), STEP);
            flushEvents();
        },
        next() { ui.closeScreen('clear'); nextLevel(G); startMusic(G.level, 'play'); ui.showIntro(G); },
        save: () => saveGame(G),
        hasSave,
    };
}
