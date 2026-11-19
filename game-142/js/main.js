// Kaboom Keep — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, the castle map, play, pause and the results.
//
// ?debug=1 exposes window.__kk for the dev/ harnesses; &fast=N runs N× simulation per frame.
// The title screen plays a castle in the background with the bot (no sound): the attract demo.

import { STEP, MAX_FRAME, AMMO_ORDER } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadProgress, recordResult, forgetAll, unlocked } from './save.js';
import { newGame, step } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { clampAim } from './sim/aim.js';
import { LEVELS } from './sim/levels.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const ATTRACT = !(DEBUG && params.get('attract') === '0');
const coarse = () => !!window.matchMedia?.('(pointer: coarse)').matches;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const canvas = document.getElementById('view');
const view = new View(canvas, { lowPower: coarse() });
view.followShots = settings.follow;
let pendingAmmo = null;
let introLevel = 0;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); view.followShots = s.follow; updateTouch(); },
    onDeleteSave: () => { forgetAll(); refreshTitle(); if (ui.stack.includes('map')) ui.buildMap(); },
    onAmmo: (k) => { pendingAmmo = k; },
    onPickLevel: (i) => { introLevel = i; ui.showIntro(i); },
});

const firstOpen = () => { for (let i = LEVELS.length - 1; i >= 0; i--) if (unlocked(i)) return i; return 0; };
let G = newGame(1, firstOpen());
let mode = 'title';              // title | play | over
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null;
let attract = ATTRACT ? makeBot({ skill: 0.8, settle: 3 }) : null;
let attractT = 0;
let wasRunning = false;
const seen = {};
view.reset(G);
view.mode = 'title';

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title') audio.playMusic('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

const on = (id, fn) => document.getElementById(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    fn(b.dataset.act);
});
on('title-menu', (act) => {
    if (act === 'play') { ui.buildMap(); ui.openScreen('map'); }
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g, true); else { ui.toast('That save could not be read.'); clearSave(); refreshTitle(); }
    } else ui.openScreen(act);
});
on('pause-menu', (act) => {
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'restart') startGame(newGame(seedNow(), G.level));
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
on('over-menu', (act) => {
    if (act === 'retry') startGame(newGame(seedNow(), G.level));
    else if (act === 'next') { const n = Math.min(LEVELS.length - 1, G.level + 1); toTitle(false); introLevel = n; ui.showIntro(n); }
    else if (act === 'map') { toTitle(false); ui.buildMap(); ui.openScreen('map'); }
});
document.getElementById('intro-go').addEventListener('click', () => { audio.ui('click'); startGame(newGame(seedNow(), introLevel)); });
document.getElementById('btn-pause').addEventListener('click', () => pause());

const seedNow = () => (Date.now() % 1e9) | 0;

function startGame(g, resumed = false) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();       // a focused button would swallow Space for the whole castle
    mode = 'play';
    view.mode = 'play';
    view.reset(G);
    acc = 0;
    input.flush();
    drag = null; dragAim = null; pendingAmmo = null;
    bot = null;
    ui.showHud(true);
    updateTouch();
    audio.playMusic('play');
    if (!resumed) setTimeout(() => audio.say('pip', 'knockitdown', 0.6), 600);
    saveGame(G);
}

function toTitle(showTitle = true) {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    view.mode = 'title';
    ui.showHud(false);
    G = newGame(1, firstOpen());
    view.reset(G);
    attractT = 0;
    if (attract) attract = makeBot({ skill: 0.8, settle: 3 });
    refreshTitle();
    if (showTitle) ui.openScreen('title');
    audio.playMusic('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse() || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindButton(document.getElementById('btn-fire'), () => input.pressA());

// ------------------------------------------------------------------ aiming by dragging the view
let drag = null, dragAim = null;
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen() || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
});
canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) { drag.moved = true; view.backToCannon(); }
    if (!drag.moved) return;
    const k = 0.0034 * (e.pointerType === 'touch' ? 1.1 : 1);
    const base = dragAim || G.aim;
    dragAim = clampAim({ yaw: base.yaw - dx * k, pitch: base.pitch - dy * k * 0.75 });
});
const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // a press that never wandered is a tap: fire (or do the ball's trick)
    if (!drag.moved && performance.now() - drag.t0 < 450 && e.type === 'pointerup') input.pressA();
    drag = null;
};
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, endDrag);

function ammoFromCmd() {
    const avail = AMMO_ORDER.filter((k) => k in LEVELS[G.level].ammo);
    let k = pendingAmmo;
    pendingAmmo = null;
    const c = input.ammoCmd;
    input.ammoCmd = null;
    if (c && c.index !== undefined) k = avail[c.index] || null;
    else if (c && c.step) {
        const have = avail.filter((a) => G.ammo[a] > 0);
        if (have.length) k = have[(have.indexOf(G.sel) + c.step + have.length) % have.length];
    }
    return k;
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents(silent = false) {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (silent) return;
    audio.onEvents(G, ev);
    const over = ev.find((e) => e.type === 'over');
    if (over && mode === 'play') {
        mode = 'over';
        clearSave();
        const best = recordResult(G.level, over.won, over.stars, over.score);
        view.mode = 'end';
        setTimeout(() => { if (mode === 'over') { ui.showHud(false); ui.showResult(G, over, best); } }, DEBUG ? 300 : 1100);
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
    // back from a menu: the key or tap that closed it must not also act in the castle
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running || mode === 'over') {
        acc += dt * FAST * view.timeScale;
        let n = 0;
        while (acc >= STEP && n < 6 * FAST) {
            let inp;
            if (bot) inp = botInput(G, bot);
            else {
                const s = input.state();
                inp = { x: s.x, y: s.y, a: s.a && running, aim: dragAim, ammo: ammoFromCmd() };
                if (dragAim && !drag) dragAim = null;     // a released drag is applied once
            }
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        if (acc > STEP * 6 * FAST) acc = 0;   // a slow device drops time rather than spiral
        saveT += dt;
        if (saveT > 20 && mode === 'play') { saveT = 0; saveGame(G); }
        flushEvents();
    } else if (mode === 'title' && attract && ui.top() !== 'title') {
        // the attract demo: the bot knocks the castle down, then the next castle goes up
        acc += dt * view.timeScale;
        let n = 0;
        while (acc >= STEP && n < 3) { step(G, botInput(G, attract), STEP); acc -= STEP; n++; }
        if (acc > STEP * 3) acc = 0;
        flushEvents(true);
        if (G.over) {
            attractT += dt;
            if (attractT > 3) { G = newGame(1, (G.level + 1) % LEVELS.length); view.reset(G); attract = makeBot({ skill: 0.8, settle: 3 }); attractT = 0; }
        }
    } else { acc = 0; flushEvents(true); }
    view.frame(G, dt, time, { aiming: running && !bot });
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__kk = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(level = 0, seed = 1) { startGame(newGame(seed, level)); return G; },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, skill = 1) { const b = makeBot({ skill }); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        aim(yaw, pitch) { G.aim = clampAim({ yaw, pitch }); },
        save: () => saveGame(G),
        hasSave,
        progress: loadProgress,
    };
}
