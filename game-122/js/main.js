// Wrack & Wonder — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, play and the ending.
//
// ?debug=1 exposes window.__ww for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, MAGIC } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { Book } from './ui/book.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, saveInfo } from './save.js';
import { newGame, step, act as simAct, focusOf, currentGoal } from './sim/game.js';
import { makeBot, botTick } from './sim/bot.js';
import { nearFire } from './sim/magic.js';
import { hashStr } from './rng.js';
import { ITEMS } from './sim/data/reagents.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const coarse = window.matchMedia?.('(pointer: coarse)').matches;
const quality = params.get('q') || (settings.quality === 'auto' ? (coarse ? 'medium' : 'high') : settings.quality);
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
input.sens = settings.sens; input.invert = settings.invert;
const canvas = document.getElementById('view');
input.bindCanvas(canvas);
input.dragLook = true;

// the title screen shows the island at dusk from the beach
function titleGame() {
    const g = newGame(7, 'Rowan');
    g.tod = 0.53; g.p.x = 30; g.p.z = 172; g.p.yaw = -0.35; g.p.pitch = 0.06;
    g.events.length = 0;
    return g;
}
let G = titleGame();
const view = new View(canvas, G, quality);
let mode = 'title';                // title | play | over
let acc = 0, time = 0, last = performance.now(), saveT = 0, bot = null, wasRunning = false;
let focus = null, stepDist = 0, suppressLock = false;
const seen = {};

const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); input.sens = s.sens; input.invert = s.invert; updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    act: (cmd) => doAct(cmd),
});
const book = new Book(ui, (cmd) => doAct(cmd));
ui.onBookClose = () => { input.flush(); };

function doAct(cmd) {
    const r = simAct(G, cmd);
    flushEvents();
    if (!document.getElementById('book').hidden) book.refresh(G);
    return r;
}

// ------------------------------------------------------------------ menus
function refreshTitle() {
    const info = saveInfo();
    const b = document.getElementById('btn-continue');
    b.hidden = !info;
    if (info) b.textContent = `Continue: ${info.name}, day ${info.day}`;
}
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); audio.setHum(G.laws.hum); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'continue') { const g = loadGame(); if (g) startGame(g, true); else ui.toast('That save could not be read.'); }
    else if (a === 'newgame') { document.getElementById('ng-name').value = settings.name || 'Rowan'; document.getElementById('ng-seed').value = ''; ui.openScreen('newgame'); }
    else ui.openScreen(a);
});
document.getElementById('ng-go').addEventListener('click', () => {
    audio.ui('click');
    const name = document.getElementById('ng-name').value.trim() || 'Rowan';
    const raw = document.getElementById('ng-seed').value.trim();
    const seed = raw ? (/^\d+$/.test(raw) ? (+raw % 1e9) : hashStr(raw) % 1e9) : (Date.now() % 1e9) | 0;
    settings.name = name; saveSettings(settings);
    if (hasSave() && !confirmOverwrite()) return;
    startGame(newGame(seed, name));
});
function confirmOverwrite() { return true; }   // starting anew replaces the old save, as the button says
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'book') { ui.closeScreen('pause'); book.open(G); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-book').addEventListener('click', () => openBook());
document.getElementById('end-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g, resumed = false) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    view.build(G);
    audio.init(); audio.setHum(G.laws.hum);
    book.draft = null; book.edit = 0;
    saveGame(G);
    if (resumed) ui.toast(`Day ${G.day}. You pick up where you left off.`, 'story');
    if (G.dialog) ui.showDialog(G);
    flushEvents();
    if (!coarse) requestLook();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    exitLook();
    ui.showHud(false);
    G = titleGame();
    view.build(G);
    refreshTitle();
    ui.openScreen('title');
}

function openScreenFromPlay(fn) { suppressLock = true; exitLook(); fn(); }
function pause() {
    if (mode !== 'play' || ui.top() === 'pause') return;
    audio.ui('open');
    saveGame(G);
    const g = currentGoal(G);
    document.getElementById('pause-info').textContent = `${G.name} · Day ${G.day} · ${g.text}`;
    openScreenFromPlay(() => ui.openScreen('pause'));
}
function openBook(tab) {
    if (mode !== 'play' || G.dialog) return;
    audio.ui('open');
    openScreenFromPlay(() => book.open(G, tab));
}

function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindLook(document.getElementById('look-zone'));
input.bindButton(document.getElementById('t-cast'), () => input.push('Cast'));
input.bindButton(document.getElementById('t-use'), () => input.push('KeyE'));
input.bindButton(document.getElementById('t-jump'), () => input.pressJump());

// pointer lock: click the view to look; losing it by Esc pauses
function requestLook() { if (mode === 'play' && !ui.anyScreen() && input.lastDevice !== 'touch') input.requestLock(); }
function exitLook() { input.exitLock(); }
canvas.addEventListener('click', () => { if (mode === 'play' && !ui.anyScreen() && !input.locked) requestLook(); });
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && mode === 'play' && !ui.anyScreen() && !suppressLock && !G.over) pause();
    if (locked) suppressLock = false;
});

// ------------------------------------------------------------------ input routing
const ESC = ['Escape', 'KeyP'];
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (top === 'dialog' || top === 'pageview') {
            if (key === 'Escape' && top === 'pageview') { doAct({ t: 'closeDialog' }); if (!G.dialog) ui.closeScreen('pageview'); }
            else if ((key === 'KeyE' || key === 'Enter' || key === 'Space') && !press.onButton) {
                if (top === 'pageview') { doAct({ t: 'closeDialog' }); ui.closeScreen('pageview'); }
                else if (document.getElementById('dlg-next').hidden === false) doAct({ t: 'say' });
            } else if (key === 'ArrowDown') ui.moveFocus(1);
            else if (key === 'ArrowUp') ui.moveFocus(-1);
            else if (press.pad && key === 'Space') document.activeElement?.click?.();
            return;
        }
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((ESC.includes(key) || ((key === 'Tab' || key === 'KeyB') && top === 'book')) && top !== 'title' && top !== 'ending') { audio.ui('close'); ui.closeTop(); }
        else if (press.pad && key === 'Space') document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (ESC.includes(key)) pause();
    else if (key === 'Tab' || key === 'KeyB') openBook();
    else if (key === 'KeyJ') openBook('marks');
    else if (key === 'KeyM') openBook('map');
    else if (key === 'KeyE') doAct({ t: 'use' });
    else if (key === 'Cast' || key === 'KeyF') doAct({ t: 'cast' });
    else if (key === 'Digit1' || key === 'Digit2' || key === 'Digit3') doAct({ t: 'select', slot: +key.slice(5) - 1 });
    else if (key === 'BracketRight') doAct({ t: 'select', slot: G.sel + 1 });
    else if (key === 'BracketLeft') doAct({ t: 'select', slot: G.sel - 1 });
    else if (key === 'KeyQ') {
        const f = ['clamcooked', 'chanterellecooked', 'berries', 'chanterelle', 'clam'].find((k) => G.bag[k] > 0);
        if (f) { doAct({ t: 'eat', item: f }); ui.toast(`You eat the ${ITEMS[f].name.toLowerCase()}.`); } else ui.toast('You have nothing to eat.');
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    if (mode === 'title') return;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'openInstrument') openScreenFromPlay(() => ui.openInstrument(G, e.inst));
        if (e.type === 'openRest') openScreenFromPlay(() => ui.openRest(G, e.at));
        if (e.type === 'dialog' || e.type === 'dialogStep' || e.type === 'dialogClose' || e.type === 'home') {
            if (G.dialog) openScreenFromPlay(() => ui.showDialog(G)); else ui.showDialog(G);
        }
        if (e.type === 'ending') {
            mode = 'over';
            clearSave();
            ui.showHud(false);
            exitLook();
            setTimeout(() => ui.ending(G), 600);
        }
        if (e.type === 'rest' || e.type === 'collapse') ui.fadeFlash();
    }
}

// ------------------------------------------------------------------ frame loop
function footsteps(dt) {
    const p = G.p;
    if (!p.ground) return;
    stepDist += Math.hypot(p.vx, p.vz) * dt;
    if (stepDist > 2.1) {
        stepDist = 0;
        const w = view.W.water(p.x, p.z);
        const surf = w ? 'water' : p.inside || G.flags.bridge && Math.abs(p.z - 35) < 1.2 && p.x < -118 && p.x > -133 ? 'wood' : p.y > 27 && Math.hypot(p.x, p.z) < 20 ? 'stone' : p.region === 'shore' ? 'sand' : 'grass';
        audio.footstep(surf);
    }
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen() && !G.dialog;
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    input.look_enabled = running;
    input.frame(dt);
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            let inp = input.state();
            if (bot) { const b = botTick(G, bot); for (const c of b.cmds) simAct(G, c); inp = b.inp; }
            step(G, inp, STEP);
            input.consumeEdges();
            acc -= STEP;
            n++;
            if (G.dialog) break;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
        footsteps(dt);
    } else acc = 0;
    if (mode === 'title') {
        // a slow look around the island
        G.p.yaw = -0.35 + Math.sin(time * 0.05) * 0.5;
        G.tod = 0.52 + Math.sin(time * 0.02) * 0.03;
    }
    flushEvents();
    focus = running ? focusOf(G) : null;
    view.nearFire = mode === 'play' && nearFire(G, G.p.x, G.p.z, G.p.y) ? 1 : 0;
    view.frame(G, dt, time, { hideHand: mode === 'title' });
    audio.frame(G, view, dt);
    if (mode === 'play') {
        ui.hud(G, dt, focus, (e) => view.colorOf(e));
        const lh = document.getElementById('lock-hint');
        lh.hidden = !(running && !input.locked && input.lastDevice === 'keys' && !coarse);
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'play' && !ui.anyScreen() && !G.dialog) pause(); else if (mode === 'play') saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ww = {
        get G() { return G; },
        get mode() { return mode; },
        get focus() { return focus; },
        seen, view, ui, audio, input, book,
        start(seed = 1, name = 'Test') { startGame(newGame(seed, name)); return G; },
        act: (cmd) => doAct(cmd),
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, b = makeBot()) {
            const end = G.t + sec;
            let guard = 0;
            while (G.t < end && !G.over && guard++ < sec * 200) {
                const r = botTick(G, b);
                for (const c of r.cmds) simAct(G, c);
                step(G, r.inp, STEP);
                if (G.events.length > 400) flushEvents();
            }
            flushEvents();
            return G.t;
        },
        /** Teleport for screenshots and tests. */
        put(x, z, yaw = G.p.yaw, pitch = 0) { const y = view.W.height(x, z); Object.assign(G.p, { x, z, y, yaw, pitch, vx: 0, vz: 0, vy: 0 }); },
        save: () => saveGame(G),
        hasSave,
        MAGIC,
    };
}
