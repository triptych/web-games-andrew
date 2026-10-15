// EMBERLEAF — entry point. Boots the view, runs the fixed-step simulation, routes input to the
// world, the dialogue box, the battle menus and the screens, picks the music, and saves.
//
// ?debug=1 exposes window.__el for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, mapOf, _test } from './sim/game.js';
import { makeBot, botInput, botAct } from './sim/bot.js';
import { BIOMES } from './sim/data/world.js';
import { zoneAt } from './sim/worldgen.js';
import { addItem } from './sim/rules.js';
import { startBattle } from './sim/battle.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
view.onLand = () => audio.land();

let G = newGame(1, { skipIntro: true });   // the title screen shows Lantern Square behind it
let mode = 'title';                         // title | play
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
let lastMode = 'explore';
let swallowUntil = 0;
let pendingEnding = false;
const seen = {};

const game = {
    get G() { return G; },
    act(cmd) {
        const ok = act(G, cmd);
        settle();
        return ok;
    },
};
const ui = new UI({
    audio, settings, view, game,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title') audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'bag') { ui.closeScreen('pause'); openBag(); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-bag').addEventListener('click', () => openBag());
document.getElementById('ending-go').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('ending'); saveGame(G); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    lastMode = G.mode;
    settle();
    music();
    if (G.mode === 'explore') saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    ui.hideDialog();
    if (ui.bat) ui.battleEnd();
    mode = 'title';
    bot = null;
    ui.showHud(false);
    G = newGame(1, { skipIntro: true });
    G.events.length = 0;
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}
function openBag(tab) {
    if (mode !== 'play' || (ui.anyScreen() && ui.top() !== 'bag')) return;
    if (G.mode === 'battle') return;
    audio.ui('open');
    ui.openBag(G, tab);
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => {
    if (G.mode === 'dialog') ui.dialogPress();
    else input.pressA();
});

// ------------------------------------------------------------------ music
function music() {
    if (mode !== 'play') return;
    if (G.mode === 'battle') return;           // the battle picks its own
    const M = mapOf(G);
    if (M.kind === 'world') {
        const z = zoneAt(G.p.x, G.p.y);
        audio.play(BIOMES[z?.biome]?.music || 'fields');
    } else if (M.id === 'library') audio.play('library', 1 + Math.floor(G.placed.length / 2.4));
    else if (M.kind === 'dungeon') audio.play(M.music || 'dungeon');
    else audio.play(M.music || 'house');
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    if (mode !== 'play') return;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    let remusic = false, save = false;
    for (const e of ev) {
        if (e.type === 'warp' || e.type === 'zone' || e.type === 'restore') remusic = true;
        if (e.type === 'rest' || e.type === 'warp' || e.type === 'restore' || e.type === 'quest') save = true;
        if (e.type === 'ending') pendingEnding = true;
    }
    if (remusic) music();
    if (save) saveSoon = 0.3;
}
let saveSoon = 0;

/** After anything changes the game: drain events, and handle a change of mode. */
function settle() {
    flushEvents();
    if (G.mode !== lastMode) {
        const from = lastMode;
        lastMode = G.mode;
        if (from === 'battle' && G.mode !== 'battle') { ui.battleEnd(); music(); }
        if (from === 'shop') ui.closeScreen('shop');
        if (G.mode === 'explore') {
            // the key or tap that closed a dialogue must not also act in the world (game-073)
            input.flush();
            swallowUntil = performance.now() + 250;
            ui.hideDialog();
            // a button that just disappeared (Continue, a choice) must not keep the focus, or the
            // next Space would press it instead of acting in the world
            if (!ui.anyScreen()) document.activeElement?.blur?.();
            if (pendingEnding && !G.fade) { pendingEnding = false; showEnding(); }
        }
        if (G.mode === 'battle') document.activeElement?.blur?.();
    }
}

function showEnding() {
    document.getElementById('ending-text').textContent =
        `Twelve grimoires home, ${Object.values(G.common).filter((v) => v === 2).length} books back on their shelves, and Marigold Ashby awake and asking for tea. Vellumvale has its library back — and its Librarian.`;
    audio.play('ending');
    ui.openScreen('ending');
}

// ------------------------------------------------------------------ input routing
const ARROW = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
// Space and Enter on a focused button already press it (the browser does that); the other Action
// keys, and a gamepad's A, must press it too
const ACTION = ['Space', 'Enter', 'NumpadEnter', 'KeyZ', 'KeyJ'];
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    const action = ACTION.includes(key) && !press.onButton;
    if (ui.anyScreen()) {
        if (ARROW[key]) ui.moveFocus(ARROW[key]);
        else if ((key === 'Escape' || key === 'KeyP' || key === 'KeyI' || key === 'Tab') && ui.top() !== 'title' && ui.top() !== 'ending') { audio.ui('close'); ui.closeTop(); }
        else if (action && document.activeElement?.tagName === 'BUTTON') ui.pressFocused(ui.top());
        return;
    }
    if (mode !== 'play') return;
    if (G.mode === 'dialog') {
        const choices = !!G.dialog?.choices && ui.dlg.done;
        if (choices && ARROW[key]) { ui.moveFocus(ARROW[key], 'dlg-choices'); return; }
        if (action) ui.dialogPress();
        return;
    }
    if (G.mode === 'battle') {
        if (ARROW[key]) ui.moveFocus(ARROW[key], 'b-menu');
        else if (key === 'Escape' || key === 'KeyX' || key === 'Backspace') ui.battleBack();
        else if (action && ui.battleIdle()) ui.pressFocused('b-menu');
        return;
    }
    if (G.mode === 'explore') {
        if (key === 'Escape' || key === 'KeyP') pause();
        else if (key === 'KeyI' || key === 'Tab' || key === 'KeyX') openBag();
        else if (key === 'KeyM') openBag('map');
    }
}

// ------------------------------------------------------------------ frame loop
const NONE = { x: 0, y: 0, a: false };
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    // the auto-player shops for itself (the shop screen would otherwise pause it)
    if (bot && mode === 'play' && G.mode === 'shop' && ui.top() === 'shop') { const c = botAct(G, bot); if (c) game.act(c); }
    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) { input.flush(); swallowUntil = now + 200; }
    wasRunning = running;
    if (running) {
        if (bot && !G.fade) {
            // the auto-player waits for the UI the way a person would
            if (G.mode === 'dialog' && ui.dlg.done) game.act(botAct(G, bot) || { type: 'advance' });
            else if (G.mode === 'battle' && ui.battleIdle()) { const c = botAct(G, bot); if (c && (c.type !== 'battleDone' || ui.bat?.ended || ui.bat?.result)) game.act(c); }
            else if (G.mode === 'shop') { const c = botAct(G, bot); if (c) game.act(c); }
            else if (G.mode === 'explore') { const c = botAct(G, bot); if (c) game.act(c); }
        }
        acc += dt * FAST;
        let n = 0;
        if (now < swallowUntil) input.consumeEdges();
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot && G.mode === 'explore' ? botInput(G, bot, STEP) : (G.mode === 'explore' ? input.state() : NONE);
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
            if (G.events.length) settle();
        }
        saveT += dt;
        if (saveT > 20 && G.mode === 'explore') { saveT = 0; saveGame(G); }
        if (saveSoon > 0) { saveSoon -= dt; if (saveSoon <= 0) saveGame(G); }
    } else {
        acc = 0;
        if (mode === 'title') {
            // a slow day passes in Lantern Square behind the title
            G.clock = (G.clock + dt * 6) % 600;
        }
    }
    settle();
    ui.tick(G, dt);
    audio.tick();
    view.frame(G, dt, { dim: mode === 'title' ? 0.15 : 0 });
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G.mode === 'explore') pause(); saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__el = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, act: (c) => game.act(c),
        start(seed = 1, opts = {}) { startGame(newGame(seed, opts)); return G; },
        autoplay(on = true, o = {}) { bot = on ? makeBot(o) : null; },
        /** Run the sim ahead synchronously with the bot playing; dialogues and battles resolve too. */
        ff(sec, o = {}) {
            const b = makeBot(o);
            const end = G.t + sec;
            let guard = 0;
            const quiet = () => { for (const e of G.events.splice(0)) seen[e.type] = (seen[e.type] || 0) + 1; };
            while ((G.t < end || G.mode !== 'explore' || G.fade) && guard++ < 4e6) {
                if (G.mode === 'explore' && !G.fade) { const c = botAct(G, b); if (c) act(G, c); }
                if (G.mode === 'explore' || G.fade) step(G, G.fade ? NONE : botInput(G, b, STEP), STEP);
                else { const c = botAct(G, b); if (c) act(G, c); step(G, NONE, STEP); }
                if (o.until && o.until(G)) break;
                quiet();
            }
            ui.hideDialog();
            if (ui.bat) ui.battleEnd();
            lastMode = G.mode;
            music();
            return G.t;
        },
        save: () => saveGame(G),
        hasSave,
        warp(map, x, y) { _test.doWarp(G, { to: map, x, y, dir: 'down' }); settle(); },
        give(id, n = 1) { addItem(G, id, n); },
        grant(ids) { for (const id of ids) if (!G.books.includes(id)) G.books.push(id); },
        fight(ids, opts = {}) { startBattle(G, ids, opts); settle(); },
    };
}
