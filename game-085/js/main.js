// Wanderwain — entry point. Boots the view, runs the fixed-step simulation, catches the caravan up on the
// time you were away, routes input, commands and events, and moves between the title and the road.
//
// ?debug=1 exposes window.__ww for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, advance, command, checkIn, offlineCap, snapshot, chronicle } from './sim/game.js';
import { makeBot, botCheckIn, botPlay } from './sim/bot.js';
import { TOWN } from './sim/data.js';
import { isNight } from './sim/world.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
let G = null;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onCommand: (c) => {
        if (mode !== 'play') return { ok: false, msg: '' };
        const r = command(G, c);
        if (r.ok && c.type !== 'odds') saveSoon = true;
        return r;
    },
});

let mode = 'title';          // title | play
let acc = 0, time = 0, last = performance.now();
let saveT = 0, dayT = 0, botT = 0, saveSoon = false;
let bot = null;
let hiddenAt = 0;
let dayOffset = 0;           // tests move the calendar
const seen = {};

/** The local calendar day, as a number. */
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000) + dayOffset;

// The title shows a caravan of its own on the road, driven by the bot.
function demoGame() {
    const g = newGame(20250);
    g.orders.route = 'explore';
    botPlay(g, makeBot(), 1200, advance);
    g.at && (g.dwell = 2);
    return g;
}
G = demoGame();
const demoBot = makeBot();

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') {
        if (hasSave() && !confirmNew()) return;
        startGame(newGame((Date.now() % 1e9) | 0), 0);
    } else if (act === 'continue') {
        const s = loadGame();
        if (s) startGame(s.G, s.savedAt ? (Date.now() - s.savedAt) / 1000 : 0);
        else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
let newArmed = 0;
function confirmNew() {
    // a second tap within 4 s, so one stray tap can't throw away a caravan
    if (performance.now() - newArmed < 4000) return true;
    newArmed = performance.now();
    ui.toast('Tap New Caravan again to start over. Your saved caravan will be replaced.');
    return false;
}
document.getElementById('menu-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('menu');
    else if (act === 'quit') { save(); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-menu').addEventListener('click', () => openMenu());
const rally = document.getElementById('btn-rally');
rally.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pressA(); });
rally.addEventListener('click', (e) => { if (e.detail === 0) input.pressA(); });
document.getElementById('view').addEventListener('pointerdown', () => { if (mode === 'play' && !ui.anyScreen()) input.pressA(); });

function startGame(g, awaySecs) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showPlay(true);
    ui.setTab('road');
    checkIn(G, today());
    if (awaySecs > 30) catchUp(awaySecs);
    save();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showPlay(false);
    G = demoGame();
    refreshTitle();
    ui.openScreen('title');
}

function openMenu() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    save();
    ui.openScreen('menu');
}

function save() { if (mode === 'play') saveGame(G); saveSoon = false; }

/** Time away, through the same rules, capped by the Great Lantern; then the chronicle. */
function catchUp(secs) {
    secs = Math.floor(secs);
    const cap = offlineCap(G);
    const n = Math.min(secs, cap);
    const snap = snapshot(G);
    advance(G, n);
    G.events.length = 0;
    checkIn(G, today());
    ui.showAway(chronicle(G, snap), secs > cap ? cap : 0);
    view.fight = null;
    return n;
}

// ------------------------------------------------------------------ input routing
const TAB_KEYS = { Digit1: 'road', Digit2: 'caravan', Digit3: 'pack', Digit4: 'quests', Digit5: 'map', Digit6: 'town' };
function handlePresses() {
    input.poll();
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'letter') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') openMenu();
    else if (TAB_KEYS[key]) { audio.ui('click'); ui.setTab(TAB_KEYS[key]); }
    else if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
    else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
    else if (input.isRallyKey(key) && !press.onButton) input.pressA();
    else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    if (mode !== 'play') { view.onEvents(G, ev.filter((e) => e.type === 'battle')); return; }
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    const big = settings.fights === 'big';
    const shown = big ? ev.filter((e) => e.type !== 'battle' || e.warden || e.foes.some((f) => f.elite)) : ev;
    view.onEvents(G, shown);
    audio.onEvents(G, shown, !big);
    ui.onEvents(G, ev);
    if (ev.some((e) => ['quest', 'levelup', 'warden', 'recruit', 'newDay'].includes(e.type))) saveSoon = true;
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    // the road never stops, even with a menu open; only the title's demo caravan runs on its own
    acc += dt * FAST;
    let n = 0;
    while (acc >= STEP && n < 12 * FAST) {
        step(G, mode === 'play' ? input.state() : { a: false }, STEP);
        if (mode === 'play') input.consumeEdges();
        acc -= STEP;
        n++;
    }
    if (n >= 12 * FAST) acc = 0;
    if (mode === 'title') { botT += dt; if (botT > 20) { botT = 0; botCheckIn(G, demoBot); } }
    if (mode === 'play') {
        if (bot) { botT += dt * FAST; if (botT > 10) { botT = 0; botCheckIn(G, bot); } }
        saveT += dt;
        if (saveT > 15 || (saveSoon && saveT > 2)) { saveT = 0; save(); }
        dayT += dt;
        if (dayT > 30) { dayT = 0; checkIn(G, today()); }
        if (G.letters.length && !ui.anyScreen()) ui.showLetter(G.letters[0]);
    }
    flushEvents();
    view.setFrame(ui.sceneRect());
    view.frame(G, dt, time);
    const T = TOWN[G.at || G.road?.to || 'hearthford'];
    audio.setScene(T.region, isNight(G));
    if (mode === 'play') ui.update(G, time);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); save(); }
    else if (hiddenAt && mode === 'play') {
        const away = (Date.now() - hiddenAt) / 1000;
        hiddenAt = 0;
        last = performance.now();
        if (away > 30) catchUp(away);
    }
});
window.addEventListener('pagehide', () => save());

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ww = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed), 0); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the game ahead quietly with the bot checking in; then the view and UI carry on from there. */
        ff(sec) { botPlay(G, makeBot(), sec, advance, (g) => checkIn(g, today())); G.events.length = 0; ui.sig = null; },
        /** Exactly what coming back after `sec` seconds away does. */
        away(sec) { return catchUp(sec); },
        cmd: (c) => command(G, c),
        day(n) { dayOffset += n; checkIn(G, today()); },
        save, hasSave,
    };
}
