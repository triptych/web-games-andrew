// Rainglass — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, the window, postcards, the album and the ending.
//
// ?debug=1 exposes window.__rg for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, nextPane } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.rain);
const input = new Input();
const view = new View(document.getElementById('view'));
view.grainOn = settings.grain;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.rain); view.grainOn = s.grain; updateTouch(); },
    onDeleteSave: () => { clearSave(); if (mode !== 'title') toTitle(); refreshTitle(); },
});

let G = newGame(1);          // the title screen plays a demo pane in the background
let mode = 'title';          // title | play | postcard | ending
let demoBot = makeBot({ skill: 0.6, seed: 5 });
let demoWait = 0;
let lastCard = null;         // the postcard event on screen
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

const seed = () => (Date.now() % 1e9) | 0;
document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') { if (hasSave()) ui.openScreen('confirm'); else startGame(newGame(seed())); }
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That journey could not be read.');
    } else if (act === 'album') ui.showAlbum(loadGame());
    else ui.openScreen(act);
});
document.getElementById('confirm-yes').addEventListener('click', () => { audio.ui('click'); clearSave(); startGame(newGame(seed())); });
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else if (act === 'album') ui.showAlbum(G);
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-album-hud').addEventListener('click', () => { if (mode === 'play' && !ui.anyScreen()) { audio.ui('open'); ui.showAlbum(G); } });
document.getElementById('pc-next').addEventListener('click', () => {
    audio.ui('card');
    ui.closeScreen('postcard');
    if (lastCard?.last) { mode = 'ending'; ui.showHud(false); ui.showEnding(G); }
    else onward();
});
document.getElementById('end-next').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('ending'); onward(); });
document.getElementById('end-album').addEventListener('click', () => { audio.ui('open'); ui.showAlbum(G); });

function onward() {
    nextPane(G);
    flushEvents();
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    ui.showHud(true);
    input.flush();
    saveGame(G);
}

function startGame(g) {
    G = g;
    if (G.phase === 'done') nextPane(G);      // saved on a postcard: on to the next window
    G.events.push({ type: 'pane', station: G.station, late: G.late });
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    audio.setMode('play');
    audio.setFlow(G.flowLevel);
    ui.showHud(true);
    updateTouch();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    audio.setMode('title');
    ui.showHud(false);
    G = newGame(1);
    demoBot = makeBot({ skill: 0.6, seed: 5 });
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
input.bindPointer(document.getElementById('view'));
input.bindButton(document.getElementById('btn-tap'), () => input.pressA());

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'postcard', 'ending'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
    else if (mode === 'play' && key === 'KeyM') { audio.ui('open'); ui.showAlbum(G); }
}

/** Keys and pad, or the drop drawn toward the cursor (mouse) or along the drag (touch). */
const DRAG_GAIN = 1.25;
function playerInput() {
    const inp = input.state();
    const pt = input.point;
    if (pt && !inp.x && !inp.y && G.drop.alive) {
        let w;
        if (pt.touch) {
            // relative: the drag moves a target that starts on the drop (re-anchored for each new drop)
            if (!pt.anchor || pt.anchor.n !== G.stats.drops) { pt.anchor = { x: G.drop.x, y: G.drop.y, n: G.stats.drops }; pt.sx = pt.x; pt.sy = pt.y; }
            w = { x: pt.anchor.x + (pt.x - pt.sx) / view.pane.s * DRAG_GAIN, y: pt.anchor.y + (pt.y - pt.sy) / view.pane.s * DRAG_GAIN };
            // don't let the target run away past the edges: pull the anchor along instead
            const cx = Math.max(-0.5, Math.min(12.5, w.x)), cy = Math.max(-0.5, Math.min(9.5, w.y));
            pt.anchor.x += cx - w.x; pt.anchor.y += cy - w.y;
            w = { x: cx, y: cy };
        } else w = view.toWorld(pt.x, pt.y);
        const dx = w.x - G.drop.x, dy = w.y - G.drop.y, d = Math.hypot(dx, dy);
        if (d > 0.04) { const m = Math.min(1, d / 0.45); inp.x = dx / d * m; inp.y = dy / d * m; }
    }
    return inp;
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    if (mode === 'title') return;             // the demo is seen, not heard
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    const card = ev.find((e) => e.type === 'postcard');
    if (card) {
        mode = 'postcard';
        lastCard = card;
        ui.showHud(false);
        ui.showPostcard(G, card);
        saveGame(G);
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
            step(G, bot ? botInput(G, bot) : playerInput(), STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else if (mode === 'title') {
        acc += dt;
        while (acc >= STEP) { step(G, botInput(G, demoBot), STEP); acc -= STEP; }
        if (G.phase === 'done' && (demoWait += dt) > 3) { demoWait = 0; nextPane(G); }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G, view);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (mode !== 'title') saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode !== 'title') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__rg = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(s = 1) { startGame(newGame(s)); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && G.phase !== 'done'; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        next: () => document.getElementById('pc-next').click(),
        save: () => saveGame(G),
        hasSave,
    };
}
