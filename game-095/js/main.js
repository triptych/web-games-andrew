// Hauntly Manor — entry point. Boots the stage, runs the fixed-step clock, routes taps, keys and
// events, and moves between the title, play and the ending.
//
// ?debug=1 exposes window.__hm for the dev/ harnesses; &fast=N runs the clock N× faster.

import { STEP, MAX_FRAME, IDLE_NUDGE } from './config.js';
import { Stage } from './view/stage.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, intro, act, step, nudge } from './sim/game.js';
import { makeBot, botAct } from './sim/bot.js';
import { HOTSPOTS, hotspotName, hotspotShown } from './sim/world.js';
import { ITEMS, ROOMS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const canvas = $('view');
let stage;
try { stage = new Stage(canvas, { quality: settings.quality }); } catch (err) {
    console.warn('[stage] no WebGL', err);
    document.body.insertAdjacentHTML('beforeend', '<p class="noscript" style="text-align:center;padding:24px;z-index:100">Hauntly Manor draws its rooms with WebGL, and this browser could not start it. Try another browser or turn on hardware acceleration.</p>');
    throw err;
}
stage.calm = settings.calm;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); stage.setQuality(s.quality); stage.calm = s.calm; },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onAct: (a) => dispatch(a),
});

let G = newGame(1);          // the title screen shows a house in the background
let mode = 'title';          // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let bot = null;
let focusId = null;
let nudgeT = 0;
let pointerOn = false;
let pointerType = 'mouse';
const seen = {};             // a count of every sim event drained, for the tests
ui.G = G;
stage.setRoom(G.room, G);

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audioWant('title');

function audioWant(name) { audio.play(name); }
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0), true);
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g, false); else ui.toast('That save could not be read.');
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
$('btn-journal').addEventListener('click', () => openJournal('clues'));
$('btn-map').addEventListener('click', () => openJournal('map'));
$('btn-hint').addEventListener('click', () => dispatch({ type: 'hint' }));
function toggleGlints() { stage.showAll = !stage.showAll; $('btn-glint').setAttribute('aria-pressed', String(stage.showAll)); audio.ui('select'); }
$('btn-glint').addEventListener('click', toggleGlints);
$('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0), true); });
$('over-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g, isNew) {
    G = g;
    ui.G = G;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    focusId = null;
    input.flush();
    ui.hideDialogue();
    ui.pending.length = 0;
    ui.packKey = '';
    ui.showHud(true);
    ui.setRoom(G.room);
    ui.setGoal(G);
    ui.syncPack(G);
    stage.setRoom(G.room, G);
    audioWant(G.f.party_ready ? 'party' : 'explore');
    if (isNew) { intro(G); flushEvents(); }
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = newGame(1);
    ui.G = G;
    stage.setRoom(G.room, G);
    refreshTitle();
    ui.openScreen('title');
    audioWant('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}
function openJournal(tab) {
    if (mode !== 'play' || (ui.anyScreen() && ui.top() !== 'journal')) return;
    if (ui.top() === 'journal') { ui.closeScreen('journal'); return; }
    audio.ui('page');
    ui.tab = tab;
    ui.openScreen('journal');
}

// ------------------------------------------------------------------ actions
/** Apply one action to the sim and let every layer react to what it did. */
function dispatch(a) {
    if (mode !== 'play') return;
    act(G, a);
    flushEvents();
    ui.syncPack(G);
}

const SAVE_ON = new Set(['give', 'take', 'clue', 'unlock', 'room', 'place', 'solved', 'combine', 'code', 'flag']);
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        if (e.type === 'hint') { nudgeT = 6; stage.nudgeId = e.room === G.room ? e.id : null; if (e.room && e.room !== G.room && e.level >= 2) ui.toast(`Try the <b>${ROOMS[e.room].name}</b>`); }
        if (e.type === 'room') { focusId = null; stage.nudgeId = null; }
        if (e.type === 'ending') clearSave();
    }
    stage.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (ev.some((e) => SAVE_ON.has(e.type)) && !G.ending) saveGame(G);
}

// the box is empty: open what an action asked for, show the choices, or end the story
ui.onDialogueEnd = () => {
    if (mode !== 'play') return;
    ui.runPending();
    if (G.ending) endStory();
};
function endStory() {
    if (mode === 'over') return;
    mode = 'over';
    ui.showHud(false);
    ui.showEnding(G);
}

// ------------------------------------------------------------------ the scene: pointer and taps
let down = null;
canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    pointerType = e.pointerType;
});
canvas.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 14) tapScene(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', () => { down = null; });
canvas.addEventListener('pointermove', (e) => {
    pointerType = e.pointerType;
    if (e.pointerType === 'touch') return;
    pointerOn = true; focusId = null;
    stage.setPointer(e.clientX, e.clientY);
    tipAt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => { pointerOn = false; stage.clearPointer(); });
let tipAt = { x: 0, y: 0 };

function tapScene(x, y) {
    if (mode !== 'play' || ui.anyScreen()) return;
    if (ui.hasWords()) { ui.advance(); return; }
    if (G.talk) return;
    stage.setPointer(x, y);
    const id = stage.pick(G);
    if (pointerType === 'touch') stage.clearPointer();
    if (id) doHotspot(id);
}
function doHotspot(id) {
    if (ui.held) { const item = ui.held; ui.select(null); dispatch({ type: 'use', item, id }); }
    else dispatch({ type: 'click', id });
}

// ------------------------------------------------------------------ keys
function hotspotsByX() {
    const out = [];
    for (const id of Object.keys(stage.cur?.hot || {})) {
        if (!hotspotShown(G, id)) continue;
        const p = stage.screenOf(id);
        if (p) out.push({ id, x: p.x, y: p.y });
    }
    return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && top !== 'title' && top !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'KeyJ' && top === 'journal') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (ui.hasWords()) {
        if ((key === 'Enter' || key === 'Space') && !press.onButton) ui.advance();
        else if (key === 'Escape') ui.advance();
        return;
    }
    if (G.talk) {
        const box = $('choices'), btns = [...box.querySelectorAll('button')];
        const i = btns.indexOf(document.activeElement);
        if ((key === 'ArrowDown' || key === 'ArrowRight') && btns.length) btns[(i + 1) % btns.length].focus();
        else if ((key === 'ArrowUp' || key === 'ArrowLeft') && btns.length) btns[(i - 1 + btns.length) % btns.length].focus();
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyJ') openJournal('clues');
    else if (key === 'KeyM') openJournal('map');
    else if (key === 'KeyH') dispatch({ type: 'hint' });
    else if (key === 'KeyG') toggleGlints();
    else if (/^Digit[1-9]$/.test(key)) ui.selectIndex(+key.slice(5) - 1);
    else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'KeyA' || key === 'KeyD') {
        const list = hotspotsByX();
        if (!list.length) return;
        const dir = key === 'ArrowRight' || key === 'KeyD' ? 1 : -1;
        const i = list.findIndex((h) => h.id === focusId);
        focusId = list[(i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length)].id;
        pointerOn = false; stage.clearPointer();
        audio.ui('select');
    } else if ((key === 'Enter' || key === 'Space') && !press.onButton) {
        if (focusId && hotspotShown(G, focusId)) doHotspot(focusId);
    }
}

// ------------------------------------------------------------------ the frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    if (bot && mode === 'play') autoplayTick();

    const running = mode === 'play' && !ui.anyScreen();
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) { step(G, STEP); acc -= STEP; n++; }
    } else acc = 0;
    flushEvents();
    ui.update(dt);
    if (mode === 'play') {
        ui.refreshTalk(G);
        ui.syncPack(G);
        const idle = running && !ui.hasWords() && !G.talk && G.idle > IDLE_NUDGE;
        ui.glow(idle);
        if (idle && G.idle > IDLE_NUDGE * 2) { const n = nudge(G); stage.nudgeId = n && n.room === G.room ? n.id : null; }
        else if (nudgeT > 0) nudgeT -= dt;
        else stage.nudgeId = null;
    }
    // hover: what is under the pointer (or the keyboard focus) gets a tooltip and a glint
    let hid = null;
    if (mode === 'play' && !ui.anyScreen() && !ui.hasWords() && !G.talk) {
        hid = focusId && hotspotShown(G, focusId) ? focusId : pointerOn ? stage.pick(G) : null;
    }
    stage.hoverId = hid;
    canvas.style.cursor = hid ? 'pointer' : 'default';
    if (hid) {
        let p = tipAt;
        if (hid === focusId) { const s = stage.screenOf(hid); if (s) p = s; }
        ui.setTip(hotspotName(G, hid), p.x, p.y, ui.held ? `Use ${ITEMS[ui.held].name} on` : '');
    } else ui.setTip(null);
    stage.shakeOn = true;
    stage.frame(G, dt, time, { pointerOn });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (mode === 'play') saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
function autoplayTick() {
    if (ui.hasWords()) { ui.advance(); return; }
    if (ui.anyScreen()) { ui.closeTop(); return; }
    const a = botAct(G, bot);
    if (a.type === 'done' || a.type === 'stuck') return;
    if (a.type !== 'wait') dispatch(a);
}

if (DEBUG) {
    window.__hm = {
        get G() { return G; },
        get mode() { return mode; },
        seen, stage, ui, audio, input, settings,
        start(seed = 1, keepIntro = false) { startGame(newGame(seed), true); if (!keepIntro) { ui.hideDialogue(); ui.pending.length = 0; } return G; },
        do: (a) => dispatch(a),
        tap: (id) => doHotspot(id),
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the bot ahead in the sim, until `until(G)` or `sec` seconds; dialogue is skipped. */
        ff(sec = 60, until = null) {
            const b = makeBot();
            for (let t = 0; t < sec && !G.ending && !(until && until(G)); t += 0.1) {
                const a = botAct(G, b);
                if (a.type === 'done' || a.type === 'stuck') break;
                if (a.type !== 'wait') act(G, a);
                for (let i = 0; i < 12; i++) step(G, STEP);
                G.events.length = 0;
            }
            ui.hideDialogue(); ui.pending.length = 0;
            ui.setRoom(G.room); ui.setGoal(G); ui.packKey = ''; ui.syncPack(G); stage.setRoom(G.room, G);
        },
        skip() { ui.hideDialogue(); ui.pending.length = 0; },
        save: () => saveGame(G),
        hasSave: () => hasSave(),
        screenOf: (id) => stage.screenOf(id),
        hot: () => Object.keys(stage.cur?.hot || {}),
    };
}
