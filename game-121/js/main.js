// ARCANA WAGON — entry point. Boots the view, runs the sim's clock, routes input and events, and moves between
// the title and play. Every story move is a command sent to the sim (act); the sim only needs the clock for the
// things the view is animating.
//
// ?debug=1 exposes window.__aw for the dev/ harnesses; &fast=N runs N× the clock; &q=high|low sets graphics.

import { STEP, MAX_FRAME } from './config.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act as simAct, step as simStep } from './sim/game.js';
import { makeBot, botCmd } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
audio.setMood('title');

// A browser without WebGL still gets the menus, the sim and the saves.
let view = null;
const canvas = document.getElementById('view');
try {
    const m = await import('./view/view.js');
    view = new m.View(canvas, { quality: params.get('q') || settings.gfx });
} catch (err) {
    console.warn('[view] unavailable', err);
}
const nullView = { onEvents() {}, frame() {}, setMode() {}, setTalking() {}, resize() {} };
if (!view) view = nullView;

let G = newGame(1);
let mode = 'title';                 // title | play
let acc = 0, time = 0, last = performance.now(), bot = null, saveCool = 0;
const seen = {};                    // a count of every sim event drained, for the tests

const doAct = (cmd) => {
    const ok = simAct(G, cmd);
    flushEvents();
    return ok;
};

const ui = new UI({
    audio, settings, getG: () => G, act: doAct,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
const input = new Input({ onArrow: (d) => (ui.anyScreen() || mode === 'play') && ui.moveFocus(d) });

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    G = newGame(1);
    ui.reset();
    view.setMode('title');
    audio.setMood('title');
    refreshTitle();
    ui.openScreen('title');
}
function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'play';
    acc = 0;
    input.flush();
    ui.reset();
    view.setMode('play');
    flushEvents();
    saveGame(G);
}
const newSeed = () => (Date.now() % 1e9) | 0;
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

function menuClick(act) {
    audio.ui('click');
    if (act === 'new') startGame(newGame(newSeed()));
    else if (act === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
}
for (const id of ['title-menu', 'pause-menu']) {
    document.getElementById(id).addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) menuClick(b.dataset.act); });
}
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-codex').addEventListener('click', () => { if (mode === 'play' && !ui.anyScreen()) { audio.ui('open'); ui.openScreen('codex'); } });
document.getElementById('end-again').addEventListener('click', () => { audio.ui('click'); clearSave(); startGame(newGame(newSeed())); });
document.getElementById('end-menu').addEventListener('click', () => { audio.ui('click'); clearSave(); toTitle(); });

function pause() {
    if (mode !== 'play' || ui.anyScreen() || G.phase === 'ending') return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if (key === 'ArrowRight' && press.pad) ui.moveFocus(1);
        else if (key === 'ArrowLeft' && press.pad) ui.moveFocus(-1);
        else if (key === 'Escape' && !ui.modal()) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'KeyC' && ui.top() === 'codex') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'KeyC' && ui.top() === 'evening') { audio.ui('open'); ui.openScreen('codex'); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        else if (/^(Digit|Numpad)[1-9]$/.test(key)) ui.pressNumber(+key.slice(-1));
        else if ((key === 'Enter' || key === 'Space' || key === 'NumpadEnter') && !(document.activeElement instanceof HTMLButtonElement)) ui.primary();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyC') { audio.ui('open'); ui.openScreen('codex'); }
    else if (key === 'KeyF') ui.focusClouded();
    else if (key === 'Backspace') ui.unplaceLast();
    else if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
    else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
    else if (/^(Digit|Numpad)[1-9]$/.test(key)) ui.pressNumber(+key.slice(-1));
    else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
    else if (key === 'Enter' || key === 'Space' || key === 'NumpadEnter') { if (!(document.activeElement instanceof HTMLButtonElement)) { if (!ui.primary()) ui.advance(); } }
}

// ------------------------------------------------------------------ events
const SAVE_ON = new Set(['day', 'knock', 'dusk', 'deal', 'result', 'evening', 'festival', 'prince', 'plot']);
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (mode === 'play' && ev.some((e) => SAVE_ON.has(e.type))) saveGame(G);
    if (ev.some((e) => e.type === 'end')) clearSave();
}

function moodFor() {
    if (mode === 'title') return 'title';
    const ph = G.phase;
    if (ph === 'festival' || ph === 'finale' || ph === 'ending') return 'festival';
    if (ph === 'scene' && G.dlg?.ctx?.kind === 'prince') return 'tense';
    if (ph === 'scene' || ph === 'dusk') return 'night';
    if (G.client?.grand) return ph === 'ball' || ph === 'deal' ? 'ball' : 'tense';
    if (ph === 'ball' || ph === 'deal' || ph === 'flip') return 'ball';
    return 'calm';
}

// ------------------------------------------------------------------ frame loop
const PAUSING = ['pause', 'codex', 'howto', 'settings'];
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    if (mode === 'play') {
        const paused = ui.stack.some((s) => PAUSING.includes(s));
        if (!paused) {
            acc += dt * FAST;
            let n = 0;
            while (acc >= STEP && n < 12 * FAST) { simStep(G, STEP); acc -= STEP; n++; }
            if (bot) { const c = botCmd(G, bot); if (c) simAct(G, c); }
            flushEvents();
        } else acc = 0;
        ui.sync(G, dt, true);
        const line = G.dlg?.lines[G.dlg.i];
        view.setTalking(ui.isTyping && line?.w === 'c');
    }
    audio.setMood(moodFor());
    if (mode === 'play' && (G.phase === 'festival' || G.phase === 'finale') && Math.random() < dt * 0.6) audio.firework();
    view.frame(G, DEBUG ? dt * Math.min(FAST, 4) : dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'play') { saveGame(G); pause(); } } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__aw = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Skip the title and start a game (optionally a ready-made one). */
        start(seed = 1, g = null) { startGame(g || newGame(seed)); return G; },
        act: (cmd) => doAct(cmd),
        autoplay(on = true, opts = {}) { bot = on ? makeBot(opts) : null; },
        /** Let the bot play, with no rendering in between, until pred(G) is true (or it runs out of commands). */
        playTo(pred, opts = {}, maxCmds = 6000) {
            const b = makeBot(opts);
            let n = 0;
            const keep = [];
            while (!pred(G) && G.phase !== 'ending' && n++ < maxCmds) { const c = botCmd(G, b); if (!c) break; if (!simAct(G, c)) simStep(G, 0.5); for (const e of G.events) if (['evening', 'prince', 'finale'].includes(e.type)) keep.push(e); G.events.length = 0; }
            ui.reset(); view.onEvents(G, keep.slice(-1)); flushEvents(); view.settle?.(G, 4);
            if (G.phase === 'ending') clearSave();
            return pred(G);
        },
        save: () => saveGame(G),
        hasSave,
        toTitle,
    };
}
