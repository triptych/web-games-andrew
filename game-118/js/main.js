// The Kids Table: entry point. Boots the view, runs the sim's clock, routes input and events, and moves
// between the title, play, pause and the ending.
//
// ?debug=1 exposes window.__kt for the dev/ harnesses; &fast=N runs N x the simulation clock.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { BoardInput } from './board-input.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, offline, findMerge, debugPlace } from './sim/game.js';
import { makeBot, botAct } from './sim/bot.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();

let view;
try {
    view = new View($('view'));
} catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend', '<p class="noscript">The Kids Table needs WebGL, and this browser could not start it.</p>');
    throw err;
}

let G = newGame(7);          // the title screen shows a game in the background, played by the bot
let mode = 'title';          // title | play
let acc = 0, time = 0, last = performance.now(), saveT = 0, savePending = false, hiddenAt = 0;
let bot = null;              // ?debug=1 autoplay
let demoBot = makeBot({ skill: 1, seed: 11 });
let demoAge = 0;
const seen = {};             // a count of every sim event drained, for the tests

const ui = new UI({
    audio, settings, act: (cmd) => doAct(cmd),
    getView: () => view,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); applyMotion(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.setGame(G);
const board = new BoardInput({ canvas: $('view'), view, getG: () => G, act: (cmd) => doAct(cmd), canPlay: () => mode === 'play' && !ui.anyScreen(), audio });

function applyMotion() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const calm = settings.motion === 'calm' || (settings.motion === 'auto' && reduced);
    view.setCalm(calm);
    document.documentElement.classList.toggle('calm', calm);
}
applyMotion();

// ------------------------------------------------------------------ layout

function relayout() {
    const w = view.w, h = view.h;
    if (!w) return;
    let r;
    if (mode === 'play') r = ui.layoutRect(w, h);
    else {
        const s = $('title').querySelector('.sheet').getBoundingClientRect();
        r = w > h * 1.15 ? { l: s.right + 8, t: 8, r: w - 8, b: h - 8 } : { l: 0, t: s.bottom + 4, r: w, b: h - 8 };
    }
    view.setSafeRect(r);
}
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
window.visualViewport?.addEventListener('resize', relayout);
document.fonts?.ready?.then(() => relayout());

// ------------------------------------------------------------------ menus and modes

function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
view.reset(G);
requestAnimationFrame(relayout);

const unlock = () => { audio.init(); if (!audio.timer) audio.startMusic(); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (act === 'continue') {
        const s = loadGame();
        if (s) startGame(s.G, s.away); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());
$('win-keep').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('win'); });
$('win-title').addEventListener('click', () => { audio.ui('click'); saveGame(G); toTitle(); });

function startGame(g, away = 0) {
    G = g;
    if (away > 0) offline(G, away);
    ui.closeAll();
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    ui.setGame(G);
    ui.showHud(true);
    board.reset();
    board.touch();
    view.reset(G);
    input.flush();
    relayout();
    saveGame(G);
    if (away > 90) ui.toast('Welcome back! Your generators recharged while you were away.');
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    ui.showHud(false);
    G = newGame((Date.now() % 1e9) | 0);
    demoBot = makeBot({ skill: 1, seed: G.seed });
    demoAge = 0;
    ui.setGame(G);
    board.reset();
    view.reset(G);
    refreshTitle();
    ui.openScreen('title');
    relayout();
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

/** Every command from the player (and the debug hooks) goes through here. */
function doAct(cmd) {
    const r = act(G, cmd);
    board.touch();
    if (r.ok) savePending = true;
    return r;
}

// ------------------------------------------------------------------ input routing

function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if ((key === 'Enter' || key === 'Space') && press.onButton) return;     // the focused button takes it
    if (key === 'Escape' || key === 'KeyP') { if (!(key === 'Escape' && board.key('Escape'))) pause(); return; }
    board.key(key);
}

// ------------------------------------------------------------------ events

function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev, { cardPoint: (slot) => ui.cardPoint(slot) });
    if (mode === 'play') {
        audio.onEvents(G, ev);
        ui.onEvents(G, ev, view);
    }
}

// ------------------------------------------------------------------ frame loop

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'title' || (mode === 'play' && !ui.anyScreen());
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 40 * FAST) {
            step(G, STEP);
            const b = mode === 'title' ? demoBot : bot;
            if (b) { const c = botAct(G, b, STEP); if (c) act(G, c); }
            acc -= STEP;
            n++;
        }
        if (acc > STEP * 40) acc = 0;
        if (mode === 'title') { demoAge += dt; if (demoAge > 600 || G.won) { G = newGame((Date.now() % 1e9) | 0); demoBot = makeBot({ skill: 1, seed: G.seed }); demoAge = 0; ui.setGame(G); view.reset(G); } }
    } else acc = 0;

    if (mode === 'play') {
        saveT += dt;
        if ((savePending && saveT > 2.5) || saveT > 15) { saveT = 0; savePending = false; saveGame(G); }
    }
    flushEvents();

    // marks, the tip, and a hint when you have been still for a while
    const idle = mode === 'play' && !ui.anyScreen() && board.idleFor() > 7 && !board.dragging;
    let hint = [];
    if (idle) {
        const pair = findMerge(G);
        if (pair) hint = pair;
        else { const g = G.cells.findIndex((it) => it && it.k === 'gen' && it.ch > 0); if (g >= 0) hint = [g]; }
    }
    const playing = mode === 'play' && !ui.anyScreen();
    view.setMarks(playing ? { ...board.marks(), hint } : { cursor: -1, selected: -1, hover: -1, hint: [] });
    if (mode === 'play') {
        ui.updateHud(G);
        const m = board.marks();
        ui.setTip(G, playing ? (m.selected >= 0 ? m.selected : m.cursor >= 0 ? m.cursor : m.hover) : -1);
        for (const id of ['shop', 'tables', 'plan']) if (ui.top() === id && Math.floor(time * 4) !== Math.floor((time - dt) * 4)) ui.refresh(id);
        const hot = $('d-compost');
        hot.setAttribute('aria-dropeffect', board.dragging ? 'move' : 'none');
    }
    view.frame(G, dt, time);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (mode === 'play') saveGame(G); }
    else if (mode === 'play' && hiddenAt) { offline(G, (Date.now() - hiddenAt) / 1000); hiddenAt = 0; last = performance.now(); }
});
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__kt = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, board,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot({ seed: 5 }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) {
            const b = makeBot({ seed: 5 });
            let won = false;
            for (let t = 0; t < sec; t += STEP) {
                step(G, STEP);
                const c = botAct(G, b, STEP);
                if (c) act(G, c);
                if (G.events.some((e) => e.type === 'win')) won = true;
                if (G.events.length > 400) G.events.length = 0;
            }
            G.events.length = 0;
            if (won && mode === 'play') ui.showWin(G);
            view.reset(G);
        },
        act: (cmd) => doAct(cmd),
        place(cell, c, t) { debugPlace(G, cell, c, t); },
        set(o) { Object.assign(G, o); },
        cellClient: (i, y) => view.cellToClient(i, y),
        cardPoint: (s) => ui.cardPoint(s),
        relayout,
        save: () => saveGame(G),
        hasSave,
    };
}
