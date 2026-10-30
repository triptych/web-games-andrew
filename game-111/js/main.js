// NEON ARCANA — entry point. Boots the view, routes input to the play controller and the menus,
// sends commands to the sim, plays its events through the view, the audio and the UI, keeps the
// Restoration's progress, and moves between the title, play, the end of a reading and the ending.
//
// ?debug=1 exposes window.__na for the dev/ harnesses; &fast=N speeds the bot's autoplay.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Controller } from './play.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadMeta, saveMeta, newMeta, clearAll } from './save.js';
import { newGame, step, act, concede } from './sim/game.js';
import { makeBot, botCommand } from './sim/bot.js';
import { ARCANA } from './sim/arcana.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
let meta = loadMeta();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const $ = (id) => document.getElementById(id);

/** The space the HUD and the powers bar leave free for the lattice. */
function margins() {
    const h = window.visualViewport?.height ?? innerHeight;
    const M = { top: 10, bottom: 10, left: 10, right: 10 };
    if (!$('hud').hidden) M.top = Math.round($('hud').getBoundingClientRect().bottom + 30);
    const p = $('powers');
    if (!p.hidden) {
        const r = p.getBoundingClientRect();
        if (r.height > r.width) M.left = Math.round(r.right + 8);
        else M.bottom = Math.round(h - r.top + 8);
    }
    if (mode === 'title') { M.top = 64; M.bottom = 20; }
    return M;
}

let mode = 'title';          // title | play | over | ending
const view = new View($('view'), { margins: () => margins() });
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); applyCalm(); },
    onDeleteSave: () => { clearAll(); meta = newMeta(); refreshTitle(); view.setWorld(meta.restored, 0); audio.setWorld(0); },
    onPower: (p) => ctl.power(p),
});

let G = newGame(1, { mode: 'endless' });     // the title screen's attract game
let attract = makeBot({ skill: 0.85, seed: 5 });
let attractT = 0;
let time = 0;
let last = performance.now();
let bot = null, botT = 0;
let overAt = 0, endingAt = 0, omenAt = 0, omenArc = -1;
let wasRunning = false;
let frames = 0;
const seen = {};             // a count of every sim event drained, for the tests

const ctl = new Controller({
    view, audio, ui,
    getG: () => G,
    enabled: () => mode === 'play' && !ui.anyScreen() && !view.busy && !G.events.length && !G.over,
    act: (cmd) => doAct(cmd),
});

function doAct(cmd) {
    const ok = act(G, cmd);
    flushEvents();
    if (ok && mode === 'play') saveGame(G);
    return ok;
}

function applyCalm() {
    const calm = settings.calm === 'on' || (settings.calm === 'auto' && !!window.A11Y?.reducedMotion);
    view.setCalm(calm);
}
applyCalm();

// ------------------------------------------------------------------ menus
function refreshTitle() {
    ui.title(meta, hasSave());
    ui.setDeckState(meta.restored);
}
refreshTitle();
view.setWorld(meta.restored, meta.restored.length);
audio.setWorld(meta.restored.length / 22);
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'quest') startQuest();
    else if (a === 'endless') startGame(newGame(seed(), { mode: 'endless', restored: meta.restored }));
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else { ui.toast('That reading could not be read.'); clearSave(); refreshTitle(); }
    } else ui.openScreen(a);
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
$('hud-arc').addEventListener('click', () => { audio.ui('open'); ui.setDeckState([...new Set([...meta.restored, ...G.restored])]); ui.openScreen('deck'); });
$('btn-concede').addEventListener('click', () => { audio.ui('click'); concede(G); flushEvents(); });
$('over-again').addEventListener('click', () => {
    audio.ui('click');
    if (G.mode === 'quest' && meta.restored.length < 22) startQuest();
    else startGame(newGame(seed(), { mode: 'endless', restored: meta.restored }));
});
$('over-menu').addEventListener('click', () => { audio.ui('click'); toTitle(); });
$('ending-on').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('ending'); mode = 'play'; });
$('ending-menu').addEventListener('click', () => { audio.ui('click'); saveGame(G); toTitle(); });

function seed() { return ((Date.now() % 1e9) ^ Math.floor(performance.now() * 1000)) >>> 0; }

function startQuest() {
    const n = meta.restored.length;
    if (n >= 22) { startGame(newGame(seed(), { mode: 'endless', restored: meta.restored })); return; }
    // a quest reading still saved keeps its light as embers
    const old = loadGame();
    if (old && old.mode === 'quest' && old.arc === n) meta.embers = Math.max(meta.embers, old.light);
    clearSave();
    meta.readings++;
    saveMeta(meta);
    startGame(newGame(seed(), { mode: 'quest', arc: n, restored: meta.restored, embers: meta.embers }));
}

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    view.reset();
    ctl.reset();
    input.flush();
    overAt = endingAt = 0;
    ui.showHud(true);
    ui.cardArc = -1;
    view.setWorld([...meta.restored, ...G.restored], G.arc);
    view.resize(true);
    audio.setIntensity(1);
    G.events.length = 0;
    omenAt = time + 0.4; omenArc = G.arc;
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = newGame(seed(), { mode: 'endless' });
    attract = makeBot({ skill: 0.85, seed: seed() });
    view.reset();
    ctl.reset();
    refreshTitle();
    view.setWorld(meta.restored, meta.restored.length);
    audio.setIntensity(0);
    ui.openScreen('title');
    view.resize(true);
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    input.pollPad();
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && top !== 'title' && top !== 'over' && top !== 'ending') { audio.ui('close'); ui.closeTop(); }
        else if ((key === 'Enter' && press.pad) || (key === 'Enter' && !press.onButton)) {
            const el = document.activeElement;
            if (el && el.tagName === 'BUTTON' && el.closest('.screen')) el.click();
        }
        return;
    }
    if (mode === 'play' && ctl.key(key) === 'pause') pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev, time);
    if (mode === 'title') return;
    audio.onEvents(G, ev);
    let restored = false;
    for (const e of ev) {
        if (e.type === 'restore') {
            restored = true;
            if (!meta.restored.includes(e.arc)) meta.restored.push(e.arc);
            meta.restored.sort((a, b) => a - b);
            meta.embers = 0;
            saveMeta(meta);
            ui.rekindle(e.arc, e.power);
            audio.setWorld(meta.restored.length / 22);
            ui.setDeckState(meta.restored);
        } else if (e.type === 'arrive' && !e.fresh) {
            omenAt = time + (restored ? 3.3 : 0.3); omenArc = e.arc;
        } else if (e.type === 'ascend') {
            omenAt = time + 0.2; omenArc = G.arc;
        } else if (e.type === 'stuck') {
            ui.toast('No glyph fits — call on the Arcana.');
        } else if (e.type === 'ending') {
            meta.won = true;
            saveMeta(meta);
            endingAt = time + 4.2;
        } else if (e.type === 'over') {
            if (G.mode === 'quest' && !G.won) meta.embers = G.light;
            if (G.mode === 'quest') meta.best = Math.max(meta.best, G.score);
            else meta.bestFree = Math.max(meta.bestFree, G.score);
            saveMeta(meta);
            clearSave();
            mode = 'over';
            overAt = time + 1.4;
        }
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    frames++;
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        step(G, null, dt);
        if (bot && !view.busy && !G.events.length) {
            botT -= dt * FAST;
            if (botT <= 0) { botT = 0.25; const c = botCommand(G, bot); if (c) doAct(c); else if (G.stuck) { concede(G); flushEvents(); } }
        }
    }
    if (mode === 'title') {
        attractT -= dt;
        if (attractT <= 0) {
            attractT = 0.7;
            if (G.over) { G = newGame(seed(), { mode: 'endless' }); view.reset(); }
            else { const c = botCommand(G, attract); if (c) act(G, c); else concede(G); }
        }
    }
    if (omenAt && time >= omenAt && mode === 'play') { omenAt = 0; ui.omen(omenArc, G.mode); }
    if (overAt && time >= overAt && mode === 'over') { overAt = 0; ui.showHud(false); ui.over(G, meta); ui.openScreen('over'); }
    if (endingAt && time >= endingAt && mode === 'play') { endingAt = 0; mode = 'ending'; saveGame(G); ui.openScreen('ending'); }
    flushEvents();
    view.frame(G, dt, time, mode === 'play' ? ctl.viewState(time) : { sel: -1 });
    audio.resonance = G.resonance || 0;
    if (mode === 'play' || mode === 'over' || mode === 'ending') ui.hud(G, ctl);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
document.fonts?.ready?.then(() => { view.repaint(); ui.cardArc = -1; ui.repaintDeck = true; });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__na = {
        get G() { return G; },
        get mode() { return mode; },
        get meta() { return meta; },
        get frames() { return frames; },
        seen, view, ui, audio, input, ctl,
        /** Start a reading straight away. opts as newGame: { mode, arc, restored, embers }. */
        start(s = 1, opts = { mode: 'quest' }) {
            const o = { restored: meta.restored, ...opts };
            if (o.mode === 'quest' && o.arc === undefined) o.arc = o.restored.length;
            startGame(newGame(s, o));
            return G;
        },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 3 }) : null; },
        /** Have the bot play n moves at once; events reach the view as usual. */
        ff(n = 10, skill = 1) {
            const b = makeBot({ skill, seed: 11 });
            for (let k = 0; k < n && !G.over; k++) { const c = botCommand(G, b); if (!c) break; act(G, c); }
            flushEvents();
            return G.score;
        },
        act: (cmd) => doAct(cmd),
        setMeta(m) { meta = { ...newMeta(), ...m }; saveMeta(meta); refreshTitle(); view.setWorld(meta.restored, meta.restored.length); },
        save: () => saveGame(G),
        hasSave,
        STEP, ARCANA,
    };
}
