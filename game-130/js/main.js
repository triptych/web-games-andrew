// Starbase Spooky — entry point. Boots the view, runs the fixed-step simulation, routes pointer, touch, keyboard
// and gamepad input onto the sim's commands, and moves between the title, play and the screens.
//
// ?debug=1 exposes window.__ss for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, W, H } from './config.js';
import { View } from './view/view.js';
import { loadArt } from './view/assets.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, front, objective } from './sim/game.js';
import { makeBot, botCommand } from './sim/bot.js';
import { ROOMS } from './sim/data/rooms.js';
import { LINES, DEDUCE } from './sim/data/story.js';
import { QUESTION } from './sim/data/questions.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings);
const canvas = $('view');
const view = new View(canvas);
loadArt();

let G = null;
let mode = 'title';          // title | play
let map = false;             // the station map is open
let acc = 0, time = 0, last = performance.now();
let bot = null;
let hover = null, focus = null, pointer = null;
let idle = 0;                // seconds Kit has stood around with nothing happening (Orby's hint button nudges)
let autoT = null;
const seen = {};
const keys = [];             // presses in order, one handled per frame

const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onAnswer: (i) => command({ t: 'answer', i }),
    onNext: () => next(),
    onSolve: () => command({ t: 'solve' }),
});

// ------------------------------------------------------------------ layout
function layout() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
    const portrait = vh > vw * 1.05;
    // On anything but a short landscape phone the dialogue gets its own strip under the picture, so it never
    // covers Kit or a visitor. On a short landscape phone it floats over the bottom of the picture instead.
    const below = portrait || vh >= 480;
    const top = portrait ? Math.min(Math.round(vh * 0.12), 100) : below ? 56 : 0;
    const strip = below && !portrait ? Math.max(130, Math.min(180, Math.round(vh * 0.24))) : 0;
    const s = Math.min(vw / W, (vh - top - strip) / H);
    const cw = Math.round(W * s), ch = Math.round(H * s);
    const cx = Math.round((vw - cw) / 2);
    const cy = portrait ? top : below ? top : Math.round((vh - ch) / 2);
    const r = document.documentElement.style;
    r.setProperty('--cx', cx + 'px'); r.setProperty('--cy', cy + 'px');
    r.setProperty('--cw', cw + 'px'); r.setProperty('--ch', ch + 'px');
    document.body.classList.toggle('portrait', below);
    document.body.classList.toggle('tall', portrait);
    document.body.classList.toggle('narrow', vw < 620);
}
layout();
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title') audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
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
$('btn-hint').addEventListener('click', () => command({ t: 'hint' }));
$('btn-map').addEventListener('click', () => toggleMap());
$('btn-notebook').addEventListener('click', () => openNotebook('clues'));
$('night-next').addEventListener('click', () => { audio.ui('click'); next(true); });
$('end-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0)); });
$('end-title').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    map = false;
    acc = 0; idle = 0;
    keys.length = 0;
    hover = focus = null;
    ui.shownKey = null;
    ui.showHud(true);
    audio.init();
    flushEvents();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    audio.stopVoice();
    mode = 'title';
    map = false;
    G = null;
    ui.showHud(false);
    for (const id of ['talk', 'quiz', 'pz-bar']) $(id).hidden = true;
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
}

function pause() {
    if (mode !== 'play' || (ui.anyScreen() && ui.top() !== 'notebook')) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function openNotebook(tab) {
    if (mode !== 'play' || !G) return;
    ui.renderNotebook(G);
    ui.tab(tab);
    audio.ui('open');
    ui.openScreen('notebook');
}

function toggleMap(on = !map) {
    if (mode !== 'play' || !G) return;
    if (on && front(G)) return;
    map = on;
    focus = null;
    audio.ui(on ? 'open' : 'close');
}

// ------------------------------------------------------------------ commands
function command(cmd) {
    if (mode !== 'play' || !G) return false;
    if (cmd.t === 'closemap') { toggleMap(false); return true; }
    const okd = act(G, cmd);
    if (okd) {
        idle = 0;
        if (cmd.t === 'go') { map = false; focus = null; }
        if (cmd.t === 'pick' && cmd.i !== undefined) view.press(cmd.i);
        if (cmd.t !== 'next') audio.ui('click');
    }
    flushEvents();
    return okd;
}

/** Advance the current line (or the night card). A line can't be skipped in its first quarter second. */
function next(force = false) {
    if (!G) return;
    const f = front(G);
    if (!f || !(f.say || f.night)) return;
    if (!force && f.say && performance.now() - ui.lineAt < 250) return;
    clearTimeout(autoT);
    audio.stopVoice();
    command({ t: 'next' });
}

function activate(t) {
    if (!t) return;
    command(t.cmd);
}

// ------------------------------------------------------------------ pointer and touch
function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
}
function hit(p) {
    const list = view.targets;
    for (let i = list.length - 1; i >= 0; i--) {
        const t = list[i];
        if (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h) return t;
    }
    return null;
}
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen()) return;
    e.preventDefault();
    const p = toGame(e);
    pointer = p;
    const f = front(G);
    if (f?.say) { next(); return; }
    const t = hit(p);
    if (t) { focus = null; activate(t); return; }
    // a tap on the floor just walks there
    if (!f && !map && p.y > ROOMS[G.room].floor - 60) command({ t: 'walk', x: p.x });
});
canvas.addEventListener('pointermove', (e) => {
    pointer = toGame(e);
    hover = mode === 'play' ? hit(pointer) : null;
    showLabel(hover);
});
canvas.addEventListener('pointerleave', () => { hover = null; pointer = null; showLabel(null); });

function showLabel(t) {
    const el = $('label');
    if (!t || !t.label) { el.hidden = true; return; }
    const r = canvas.getBoundingClientRect();
    el.hidden = false;
    el.textContent = t.label;
    el.style.left = `${((t.x + t.w / 2) * r.width) / W}px`;
    el.style.top = `${(Math.max(14, t.y) * r.height) / H}px`;
}

// ------------------------------------------------------------------ keyboard and gamepad
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT') && e.code !== 'Escape') return;
    // Space and the arrows must not scroll the page, but Space must still press a focused button
    if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
    if (e.repeat) return;
    keys.push({ key: e.code, tag });
});
const padPrev = [];
function pollPad() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const gp = pads.find((p) => p && p.connected);
    if (!gp) return;
    const MAP = { 0: 'Enter', 1: 'Escape', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 2: 'KeyH', 3: 'KeyM' };
    for (const i in MAP) {
        const on = !!gp.buttons[i]?.pressed;
        if (on && !padPrev[i]) keys.push({ key: MAP[i], pad: true });
        padPrev[i] = on;
    }
}

/** The canvas targets in reading order, for the arrow keys. */
function ordered() {
    return [...view.targets].sort((a, b) => (Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < 40 ? a.x - b.x : a.y + a.h / 2 - (b.y + b.h / 2)));
}
function moveFocus(dir) {
    const list = ordered();
    if (!list.length) return;
    const i = focus ? list.findIndex((t) => t.key === focus.key) : -1;
    focus = list[(i + dir + list.length) % list.length];
    showLabel(focus);
}

function handleKeys() {
    const k = keys.shift();
    if (!k) return;
    const key = k.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' && !['title', 'night', 'end'].includes(top)) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && k.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    const f = front(G);
    if (key === 'Escape') { if (map) toggleMap(false); else pause(); return; }
    if (f?.say) {
        // Enter or Space on the focused ▶ button is the browser's own click; anything else here is "next"
        if ((key === 'Space' || key === 'Enter') && k.tag !== 'BUTTON') next();
        else if (k.pad && key === 'Enter') next();
        return;
    }
    if (f && (f.ask || f.ded !== undefined)) {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[key];
        if (n !== undefined) command({ t: 'answer', i: n });
        else if (key === 'ArrowDown' || key === 'ArrowRight') moveButtons(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') moveButtons(-1);
        else if (key === 'Enter' && k.pad) document.activeElement?.click?.();
        return;
    }
    if (key === 'KeyH' && !f) command({ t: 'hint' });
    else if (key === 'KeyM' && !f) toggleMap();
    else if (key === 'KeyN') openNotebook('clues');
    else if (['ArrowRight', 'ArrowDown'].includes(key)) moveFocus(1);
    else if (['ArrowLeft', 'ArrowUp'].includes(key)) moveFocus(-1);
    else if ((key === 'Enter' || key === 'Space') && focus) activate(view.targets.find((t) => t.key === focus.key));
}
function moveButtons(dir) {
    const list = [...document.querySelectorAll('#quiz-answers .ans')].filter((b) => !b.disabled);
    const i = list.indexOf(document.activeElement);
    list[(i + dir + list.length) % list.length]?.focus();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'say') {
            clearTimeout(autoT);
            const id = e.id;
            audio.say(id, () => {
                if (settings.auto === 'on' && G && front(G)?.say === id) autoT = setTimeout(() => { if (front(G)?.say === id) next(true); }, 700);
            });
            // warm the next few lines
            audio.prefetch(G.queue.slice(1, 5).filter((s) => s.say).map((s) => s.say));
        } else if (e.type === 'map') toggleMap(true);
        else if (e.type === 'book') { /* Orby mentions it; the Notebook opens after his line */ ui.wantBook = true; }
        else if (e.type === 'room') { map = false; focus = null; }
        else if (e.type === 'job' || e.type === 'night' || e.type === 'day') saveGame(G);
        else if (e.type === 'end') { clearSave(); audio.play('ending'); }
    }
}

function theme() {
    if (!G || mode !== 'play') return 'title';
    if (G.over) return 'ending';
    if (G.puzzle) return 'fixit';
    if (G.room === 'vents' || front(G)?.night || (G.day === 5 && G.done.solve && !G.done.home)) return 'spooky';
    return 'station';
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    pollPad();
    handleKeys();
    const running = mode === 'play' && G && !ui.anyScreen();
    if (running) {
        if (bot) {
            const c = botCommand(G, bot);
            if (c) { if (c.t === 'next') { audio.stopVoice(); } command(c); }
        }
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) { step(G, STEP); acc -= STEP; n++; }
        if (!front(G) && G.kit.tx === null && !map) idle += dt; else idle = 0;
    } else acc = 0;
    flushEvents();
    if (G && mode === 'play') {
        ui.sync(G);
        ui.hud(G, idle > 20);
        if (ui.wantBook && !front(G)) { ui.wantBook = false; openNotebook('facts'); }
        if (front(G)?.end) ui.showEnd(G);
    }
    view.frame(G, { mode: map ? 'map' : mode, hover, focus, pointer, marker: idle > 12 }, dt, time);
    // a focus that isn't a target any more (the room changed, a puzzle piece went) is dropped
    if (focus && !view.targets.some((t) => t.key === focus.key)) { focus = null; showLabel(null); }
    if (hover && !view.targets.some((t) => t.key === hover.key)) { hover = null; if (!focus) showLabel(null); }
    if (audio.ctx) audio.play(theme());
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') { saveGame(G); pause(); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ss = {
        get G() { return G; },
        get mode() { return mode; },
        get map() { return map; },
        seen, view, ui, audio,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        act: (cmd) => command(cmd),
        next: () => next(true),
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Let the bot play n commands at once (lines included); events reach the view as usual. */
        ff(n = 50, skill = 1) {
            const b = makeBot({ skill });
            for (let i = 0, k = 0; k < n && i < 100000 && G && !G.over; i++) {
                const c = botCommand(G, b);
                if (c) { act(G, c); k++; } else step(G, STEP);
            }
            audio.stopVoice();
            flushEvents();
        },
        /** Fast-forward until a condition on G holds (bot playing). */
        until(fn, skill = 1) { const b = makeBot({ skill }); for (let i = 0; i < 200000 && G && !G.over && !fn(G); i++) { const c = botCommand(G, b); if (c) act(G, c); else step(G, STEP); } audio.stopVoice(); flushEvents(); return fn(G); },
        /** The client (CSS px) centre of a canvas target, for real taps in the browser test. */
        targetAt(key) {
            const t = view.targets.find((x) => x.key === key);
            if (!t) return null;
            const r = canvas.getBoundingClientRect();
            return { x: r.left + ((t.x + t.w / 2) * r.width) / W, y: r.top + ((t.y + t.h / 2) * r.height) / H };
        },
        targets: () => view.targets.map((t) => t.key),
        objective: () => objective(G),
        save: () => saveGame(G),
        hasSave,
        lines: LINES,
        /** The right answer to the question on screen. */
        rightAnswer() { const f = G?.queue[0]; return f?.ask ? QUESTION[f.ask].ok : f?.ded !== undefined ? DEDUCE[f.ded].ok : null; },
    };
}
