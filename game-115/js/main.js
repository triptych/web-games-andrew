// Hearthwick — entry point. Boots the view, runs the fixed-step town simulation at 1×, 2× or 4×,
// routes taps and keys, saves, and catches the town up when you were away.
//
// ?debug=1 exposes window.__hw for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, OFFLINE } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, offline } from './sim/game.js';
import { makeBot, botStep } from './sim/bot.js';
import { hourOf } from './sim/core.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const NODEMO = DEBUG && params.get('demo') === '0';

const settings = loadSettings();
if (params.get('q') != null && DEBUG) settings.quality = +params.get('q');
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
let G = null;
const view = new View(document.getElementById('view'), { quality: settings.quality });
const ui = new UI({
    audio, settings, view, getG: () => G, act: (cmd) => act(G, cmd),
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        view.setQuality(s.quality);
        applyOptions();
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let mode = 'title';          // title | play
let paused = false;
let speed = 1;
let acc = 0, time = 0, last = performance.now(), saveT = 0, hiddenAt = 0;
let bot = null, demoBot = null;
let endingT = 0;
const seen = {};

// ------------------------------------------------------------------ a game to look at behind the title
function demoGame() {
    const g = newGame(7 + Math.floor(Math.random() * 90));
    g.demo = true;
    g.opts.autoWelcome = true;
    demoBot = makeBot({ skill: 1 });
    if (!NODEMO) {
        const days = 7;
        while (g.day <= days) { botStep(g, demoBot, STEP); step(g, null, STEP); g.events.length = 0; }
    }
    return g;
}
function applyOptions() {
    if (G && !G.demo) G.opts.autoWelcome = settings.autowelcome === 'on';
    const calm = settings.calm === 'on' || (settings.calm === 'auto' && window.A11Y?.reducedMotion);
    document.body.classList.toggle('calm', !!calm);
    view.calm = !!calm;
}

G = demoGame();
view.G = G;
applyOptions();

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
document.body.classList.add('in-title');
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act2 = b.dataset.act;
    if (act2 === 'new') newTown();
    else if (act2 === 'continue') {
        const s = loadGame();
        if (!s) { ui.toast('That save could not be read.', 'bad'); refreshTitle(); return; }
        startPlay(s.G, s.savedAt);
    } else ui.openScreen(act2);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-speed').addEventListener('click', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; paused = false; audio.ui('click'); showSpeed(); });
document.getElementById('welcome-ok').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('welcome'); });
document.getElementById('ending-go').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('ending'); saveGame(G); });
function showSpeed() { ui.setSpeed(speed, paused); view.speed = paused ? 1 : speed; }

function newTown(seed = (Date.now() % 1e9) | 0) {
    startPlay(newGame(seed), Date.now(), true);
}

function startPlay(g, savedAt, fresh = false) {
    ui.closeAll();
    G = g;
    G.demo = false;
    view.reset();
    view.G = G;
    mode = 'play';
    document.body.classList.remove('in-title');
    paused = false;
    acc = 0;
    input.flush();
    applyOptions();
    ui.showHud(true);
    showSpeed();
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    const c = view.stage.cam;
    const h = G.buildings.find((b) => b.type === 'hall');
    view.stage.cam.x = h.x + 1.5; view.stage.cam.z = h.y + 2.5; view.stage.cam.zoom = fresh ? 1.15 : 1;
    if (!fresh && savedAt) {
        const away = (Date.now() - savedAt) / 1000;
        const s = offline(G, away);
        if (s && (s.gold || s.quests || s.renown || s.newVillagers || Object.keys(s.items).length)) ui.showWelcome(s);
    }
    if (fresh) ui.banner('🛖 Welcome to Hearthwick! Tap the trees and boulders around your hut to gather wood and stone.', 'good', 10);
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    ui.showHud(false);
    mode = 'title';
    document.body.classList.add('in-title');
    G = demoGame();
    view.reset();
    view.G = G;
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    document.getElementById('pause-where').textContent = `Day ${G.day} · ${G.villagers.length} villagers · ${G.heroes.length} heroes`;
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ the map: taps, drags, zoom
input.bindCanvas(view.canvas);
input.placing = () => !!ui.placing;
input.h = {
    tap: (x, y, type) => { if (mode !== 'play' || ui.anyScreen()) return; const p = view.pick(x, y); ui.worldTap(p, x, y, type); },
    hover: (x, y, touch) => { if (mode === 'play') ui.placeHover(x, y, touch); },
    pan: (dx, dy) => { if (mode === 'play') view.panScreen(dx, dy); },
    zoom: (f, x, y) => { view.zoomBy(f, x, y); },
    cancel: () => ui.cancelPlace(),
};
input.onTouch = () => document.body.classList.add('touch');

// ------------------------------------------------------------------ keys
const HOTKEYS = { KeyB: 'build', KeyT: 'town', KeyH: 'heroes', KeyQ: 'quests', KeyJ: 'journal', KeyU: 'upgrades', KeyI: 'items' };
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title'].includes(ui.top()) && !(ui.top() === 'welcome')) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape') {
        if (ui.placing) ui.cancelPlace();
        else if (ui.panel) { if (ui.history.length || ui.state.hero != null || ui.state.quest != null) ui.back(); else { audio.ui('close'); ui.close(); } }
        else pause();
    } else if (HOTKEYS[key]) { if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur(); ui.togglePanel(HOTKEYS[key]); }
    else if (key === 'Space' && document.activeElement?.tagName !== 'BUTTON') { paused = !paused; showSpeed(); }
    else if (key === 'Digit1') { speed = 1; paused = false; showSpeed(); }
    else if (key === 'Digit2') { speed = 2; paused = false; showSpeed(); }
    else if (key === 'Digit3') { speed = 4; paused = false; showSpeed(); }
    else if (key === 'Enter' && ui.placing) ui.placeConfirm();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (mode === 'title') return;          // the attract mode is silent and has no HUD
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (ev.some((e) => e.type === 'won') && !endingT) endingT = 3;
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    // looking around with keys or a stick
    if (mode === 'play' && !ui.anyScreen()) {
        const p = input.pan();
        if (p.x || p.y) view.panWorld(p.x * dt * 11 / view.stage.cam.zoom, p.y * dt * 11 / view.stage.cam.zoom);
        const z = input.zoomKey();
        if (z) view.zoomBy(Math.exp(z * dt * 1.4));
    }

    const running = (mode === 'play' && !ui.anyScreen() && !paused) || mode === 'title';
    if (running) {
        acc += dt * (mode === 'title' ? 1 : speed) * FAST;
        let n = 0;
        const maxN = 60 * FAST;
        while (acc >= STEP && n < maxN) {
            if (mode === 'title') botStep(G, demoBot, STEP);
            else if (bot) botStep(G, bot, STEP);
            step(G, null, STEP);
            acc -= STEP;
            n++;
        }
        if (n >= maxN) acc = 0;
        saveT += dt;
        if (mode === 'play' && saveT > 15) { saveT = 0; saveGame(G); }
    } else acc = 0;
    if (endingT > 0) { endingT -= dt; if (endingT <= 0) { endingT = -1; ui.showEnding(G); } }
    flushEvents();
    if (mode === 'title') {
        // a slow drift over the town behind the menu
        view.stage.cam.x = 17.5 + Math.sin(time * 0.05) * 2.5; view.stage.cam.z = 13.5; view.stage.cam.zoom = 0.85;
    }
    view.frame(G, dt, time);
    if (mode === 'play') {
        ui.hud(G, dt);
        audio.tick(G.hour ?? hourOf(G.t), G.weather, dt);
    } else audio.tick(11, 'clear', dt);
}

// ------------------------------------------------------------------ away from the tab
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        hiddenAt = Date.now();
        if (mode === 'play') saveGame(G);
    } else if (mode === 'play' && hiddenAt) {
        const away = (Date.now() - hiddenAt) / 1000;
        hiddenAt = 0;
        const s = away >= OFFLINE.minAway ? offline(G, away) : null;
        if (s && (s.gold || s.quests || Object.keys(s.items).length)) ui.showWelcome(s);
    }
});
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hw = {
        get G() { return G; },
        get mode() { return mode; },
        get paused() { return paused; },
        seen, view, ui, audio, input,
        /** Skip the title: straight into a fresh town. */
        start(seed = 1) { startPlay(newGame(seed), Date.now(), true); return G; },
        act: (cmd) => act(G, cmd),
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, withBot = true) {
            const b = withBot ? makeBot({ skill: 1 }) : null;
            for (let t = 0; t < sec; t += STEP) { if (b) botStep(G, b, STEP); step(G, null, STEP); if (G.events.length > 400) G.events.length = 0; }
            flushEvents();
        },
        offline: (sec) => offline(G, sec),
        setSpeed(s) { speed = s; paused = false; showSpeed(); },
        save: () => saveGame(G),
        hasSave,
        loadSaved() { const s = loadGame(); if (s) startPlay(s.G, s.savedAt); return !!s; },
        toTitle,
    };
}
