// PIXELCRYPT: entry point. Boots the stage, the UI and the sound; runs the frame loop (input routing,
// playback of sim events, 3D render) and the idle clock. The sim only ever changes through act().
//
// ?debug=1 exposes window.__pc for the dev/ harnesses; &fast=N plays the battle animations N× faster.

import { Stage } from './view/stage.js';
import { Audio } from './audio.js';
import { Input, MOVE_KEYS } from './input.js';
import { UI } from './ui/ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act as simAct, tickIdle } from './sim/game.js';
import { makeBot, botStep } from './sim/bot.js';
import { enterFloor } from './sim/world.js';
import { totalPending } from './sim/town.js';
import { OFFLINE_MAX_DAYS, IDLE_SECONDS_PER_DAY } from './config.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const $ = (id) => document.getElementById(id);
const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const stage = new Stage($('view'));

let G = newGame(1);
let mode = 'title';              // title | play
let bot = null;
let last = performance.now();
let time = 0;
let saveT = 0;
let idleT = 0;
const seen = {};                 // a count of every sim event drained, for the tests

const ctx = {
    G: () => G,
    settings,
    hasSave,
    act(cmd) { simAct(G, cmd); drain(); },
    save(toast = false) {
        const ok = saveGame(G);
        if (toast) ui.addLog(ok ? 'Game saved.' : G.battle ? 'You cannot save in the middle of a battle.' : 'Could not save (storage unavailable).', ok ? 10 : 12);
        return ok;
    },
    newGame({ classes, names }) { startGame(newGame((Date.now() % 1e9) | 0, classes, names)); },
    continueGame() {
        const s = loadGame();
        if (!s) { ui.addLog('That save could not be read.', 12); return; }
        const before = totalPending(s.G);
        const secs = Math.min(OFFLINE_MAX_DAYS * IDLE_SECONDS_PER_DAY, Math.max(0, (Date.now() - s.savedAt) / 1000));
        const days = tickIdle(s.G, secs);
        s.G.events.length = 0;
        startGame(s.G);
        if (days > 0) {
            const got = totalPending(s.G) - before;
            ui.addLog(`While you were away, ${days} day${days > 1 ? 's' : ''} passed. Your businesses earned ${got}g.`, 14);
        }
    },
    toTitle() { saveGame(G); toTitle(); },
    deleteSave() { clearSave(); },
    applySettings() {
        audio.setVolumes(settings.sfx, settings.music);
        saveSettings(settings);
        applyLook();
        updateTouch();
    },
    onFloor() {}, onTown() {},
};
const ui = new UI({ ctx, audio, stage, settings });

function drain() {
    const evs = G.events.splice(0);
    for (const e of evs) seen[e.type] = (seen[e.type] || 0) + 1;
    ui.events(evs);
}

function applyLook() {
    $('viewbox').classList.toggle('scan', !!settings.scan);
    stage.reduced = !!settings.calm;
    document.body.classList.toggle('calm', !!settings.calm);
}
function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    document.body.classList.toggle('touch', on);
}
input.onTouch = updateTouch;
for (const b of document.querySelectorAll('#deck [data-key]')) input.bindButton(b, b.dataset.key, b.hasAttribute('data-repeat'));

// ------------------------------------------------------------------ title / start / quit
function showTitle() {
    mode = 'title';
    ui.closeAll();
    $('app').classList.add('intro');
    stage.setMode('town');
    stage.town.select(0);
    audio.setMusic('menu', 5);
    ui.open('title');
}
function startGame(g) {
    G = g;
    mode = 'play';
    bot = null;
    ui.closeAll();
    ui.floorRef = null; ui.bs = null; ui.auto = false; ui.q.length = 0; ui.wait = 0; ui.over = {}; ui.eover = {};
    stage.setBattle(null);
    $('app').classList.remove('intro');
    input.flush();
    ui.el.log.replaceChildren();
    drain();
    ui.syncWorld();
    if (!G.floor) { stage.setMode('town'); audio.setMusic('town', 3); }
    ui.sync();
    ui.refresh();
    updateTouch();
}
function toTitle() {
    G = newGame(1);
    ui.floorRef = null; ui.bs = null; ui.q.length = 0; ui.wait = 0;
    stage.setBattle(null);
    ui.refresh();
    showTitle();
}

// ------------------------------------------------------------------ input routing
function canAct() { return !ui.busy && !stage.busy; }

const KEY_MOVE = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', KeyQ: 'sl', KeyE: 'sr' };

function handlePress(press) {
    const key = press.key;
    audio.init();
    if (ui.anyScreen()) {
        const t = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' || (key === 'KeyI' && t.name !== 'title' && t.name !== 'create')) { if (!t.noClose) ui.close(); }
        else if (key === 'KeyM' && t.name === 'map') ui.close();
        else if (/^Digit[1-9]$/.test(key)) ui.pick(+key.slice(5) - 1);
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return true;
    }
    if (mode !== 'play') return true;
    if (G.battle) {
        if (/^Digit[1-4]$/.test(key)) ui.pick(+key.slice(5) - 1);
        else if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return true;
    }
    if (G.dialog) return true;
    if (G.floor) {
        if (KEY_MOVE[key]) {
            if (!canAct()) return false;                 // keep it queued
            ctx.act({ t: 'move', m: KEY_MOVE[key] });
            return true;
        }
        if (key === 'Space' || key === 'KeyF' || key === 'Enter') { if (!canAct()) return false; ctx.act({ t: 'interact' }); }
        else if (key === 'KeyM') ui.open('map');
        else if (key === 'KeyI' || key === 'Escape') ui.open('camp', { tab: 'items' });
        else if (key === 'KeyH') { /* reserved */ }
        return true;
    }
    // town
    if (/^Digit[1-8]$/.test(key)) { const i = +key.slice(5) - 1; stage.town.select(i); ui.openPlace(['dungeon', 'guild', 'items', 'smith', 'magic', 'church', 'tavern', 'inn'][i]); }
    else if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
    else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
    else if (key === 'KeyI' || key === 'Escape') ui.open('camp', { tab: 'items' });
    else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
    return true;
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += rawDt;
    const dt = rawDt * FAST;
    input.pollPad();
    const press = input.peek();
    if (press && handlePress(press)) input.next();
    else if (!press && mode === 'play' && !ui.anyScreen() && G.floor && !G.battle && !G.dialog) {
        for (const k of input.repeats(now)) if (KEY_MOVE[k] && canAct()) ctx.act({ t: 'move', m: KEY_MOVE[k] });
    }
    // the bot plays the real game when asked
    if (bot && mode === 'play' && !ui.busy && !stage.busy) {
        for (let n = 0; n < FAST; n++) {
            if (ui.busy) break;
            botStep(G, bot);
            drain();
        }
    }
    // idle clock: one game day every IDLE_SECONDS_PER_DAY of real time
    if (mode === 'play' && !document.hidden && !['smith', 'items', 'magic', 'inn', 'guild', 'church', 'tavern'].includes(ui.top()?.name)) {
        idleT += rawDt;
        if (idleT >= 1) {
            const n = idleT; idleT = 0;
            if (tickIdle(G, n) > 0) { drain(); ui.addLog('A new day dawns in town.', 7); }
            else G.events.length = 0;
        }
    }
    ui.pump(dt * (settings.fast ? 1.8 : 1));
    stage.update(dt, time);
    stage.render();
    ui.frame(rawDt, G);
    if (mode === 'play') {
        saveT += rawDt;
        if (saveT > 25) { saveT = 0; if (!G.battle) saveGame(G); }
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') saveGame(G); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { capture: true });

applyLook();
updateTouch();
ui.refresh();
showTitle();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__pc = {
        get G() { return G; },
        get mode() { return mode; },
        seen, ui, stage, audio, input, settings,
        start(seed = 1, classes) { startGame(newGame(seed, classes)); return G; },
        act: (c) => ctx.act(c),
        autoplay(on = true, o = {}) { bot = on ? makeBot(o) : null; },
        /** Run the bot for n commands synchronously (the UI catches up afterwards). */
        ff(n = 100, o = {}) { const b = bot || makeBot(o); for (let i = 0; i < n; i++) { G.events.length = 0; if (!botStep(G, b)) break; } ui.q.length = 0; ui.wait = 0; ui.over = {}; ui.eover = {}; if (G.battle) ui.resultsShown = false; ui.syncWorld(); ui.sync(); ui.refresh(); return G; },
        /** Put the party on floor N (for screenshots). */
        go(depth = 1) { G.maxDepth = Math.max(G.maxDepth, depth); G.dialog = null; G.battle = null; enterFloor(G, depth, 'up'); drain(); return G; },
        save: () => saveGame(G),
        hasSave,
        toTitle: () => toTitle(),
        press: (code) => input.push(code),
        ctx,
    };
}
