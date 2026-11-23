// Inn Over My Head — entry point. Boots the view, runs the fixed-step simulation, routes input and events, plays
// story scenes, and moves between the title, the inn, expeditions and battles.
//
// ?debug=1 exposes window.__iomh for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act } from './sim/game.js';
import { idleCatchUp } from './sim/hotel.js';
import { SCENES, VIGNETTES, ITEMS } from './sim/data.js';
import { makeBot, botCmd } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const view = new View($('view'), audio);
let G = newGame(1);
let mode = 'title';          // title | play
let acc = 0, time = 0, last = performance.now(), saveT = 0, labelT = 0, botT = 0;
let bot = null;
const seen = {};
const keys = [];             // key presses in order, one handled per frame
let endingShown = false;

const ui = new UI({
    audio, settings,
    onAct: (cmd) => doAct(cmd),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.bindPanelExtras();
view.battle.pop = (pos, text, cls) => { const s = view.stage.toScreen(pos, 'battle'); ui.pop(s.x, s.y, text, cls); };
view.battle.banner = (text, kind) => ui.banner(text, kind);

function doAct(cmd) {
    const ok = act(G, cmd);
    if (cmd.t === 'battleDone' || cmd.t === 'return' || cmd.t === 'depart') audio.music(G.mode === 'battle' ? null : 'inn');
    if (cmd.t === 'recruit' && ok) ui.closeScreen('choice');
    flushEvents();
    return ok;
}

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
view.stage.setBackdrop('hotel');

for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { audio.init(); if (mode === 'title') audio.music('title'); }, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') {
        const s = loadGame();
        if (!s) { ui.toast('That save could not be read.', 'bad'); return; }
        startGame(s.G);
        welcomeBack(s.away);
    } else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'quests') { ui.closeScreen('pause'); ui.openPanel('quests'); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => openPause());
$('ending-go').addEventListener('click', () => { ui.closeScreen('ending'); doAct({ t: 'seenEnding' }); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    keys.length = 0;
    endingShown = !!G.flags.ending;
    audio.music(G.mode === 'battle' ? (G.battle?.boss ? 'boss' : 'battle') : 'inn');
    if (G.mode === 'battle') { G.events.push({ type: 'battleStart', region: G.battle.region, boss: G.battle.boss, restore: true }); flushEvents(); }
    saveGame(G);
}

function welcomeBack(away) {
    if (away < 60 || G.mode !== 'hotel') return;
    const r = idleCatchUp(G, away);
    flushEvents(true);
    const items = Object.entries(r.items).map(([k, n]) => `${n} ${ITEMS[k]?.name || k}`).join(', ');
    ui.toast(`🏡 While you were away (${Math.round(r.secs / 60)} min): +${r.gold} G${items ? ', ' + items : ''}${r.days ? `, ${r.days} day${r.days > 1 ? 's' : ''} passed` : ''}.`, 'good');
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showMode('none');
    G = newGame(1);
    refreshTitle();
    ui.openScreen('title');
    audio.music('title');
}

function openPause() {
    if (mode !== 'play' || ui.anyScreen() || ui.talking) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

const PANELS = ['desk', 'kitchen', 'rooms', 'garden', 'staff', 'bonds', 'bag', 'ledger', 'expedition'];

// ------------------------------------------------------------------ input
window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT') && e.code !== 'Escape') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
    if (e.repeat) return;
    keys.push(e.code);
});

function handleKey() {
    const k = keys.shift();
    if (!k) return;
    if (ui.talking) { if (k === 'Enter' || k === 'Space' || k === 'Escape') ui.dlgNext(); return; }
    if (ui.anyScreen()) {
        const top = ui.top();
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape' && top !== 'title' && top !== 'choice' && top !== 'ending') { audio.ui('close'); ui.closeTop(); }
        else if (k === 'Space' && top === 'panel' && G.cook) doAct({ t: 'stir' });
        return;
    }
    if (mode !== 'play') return;
    if (G.mode === 'battle') { if (ui.battleKey(k)) return; }
    if (k === 'Escape' || k === 'KeyP') { openPause(); return; }
    if (G.mode === 'hotel') {
        if (k === 'Space' && G.cook) doAct({ t: 'stir' });
        const n = k.startsWith('Digit') ? +k.slice(5) : 0;
        if (n >= 1 && n <= PANELS.length) ui.openPanel(PANELS[n - 1]);
    } else if (G.mode === 'expedition' && (k === 'ArrowDown' || k === 'ArrowUp')) {
        const list = [...$('exped-card').querySelectorAll('button:not([disabled])')];
        const i = list.indexOf(document.activeElement);
        list[(i + (k === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
}

// taps and clicks on the 3D view: dust bunnies and rooms at the inn, enemies in battle
let downAt = null;
$('view').addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
$('view').addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12 || mode !== 'play' || ui.anyScreen() || ui.talking) return;
    downAt = null;
    if (G.mode === 'hotel') {
        const p = view.hotel.pick(e.clientX, e.clientY);
        if (!p) return;
        if (p.kind === 'bunny') doAct({ t: 'sweep', room: p.room });
        else ui.openPanel({ lobby: 'desk', kitchen: 'kitchen', garden: 'garden' }[p.id] || 'rooms');
    } else if (G.mode === 'battle') {
        const id = view.battle.pickUnit(e.clientX, e.clientY);
        if (id) ui.pickTarget(id);
    }
});

// ------------------------------------------------------------------ events
function flushEvents(quiet = false) {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (!quiet) { audio.onEvents(G, ev); ui.onEvents(G, ev); }
    if (ev.some((e) => e.type === 'battleStart')) { ui.bmenu = 'root'; ui.pending = null; }
}

function stories() {
    if (mode !== 'play' || ui.talking || ui.anyScreen() || view.busy) return;
    if (G.mode === 'battle' && G.battle && !['won', 'lost', 'fled'].includes(G.battle.phase)) return;
    if (G.scenes.length) { const k = G.scenes[0]; if (SCENES[k]) ui.showScene(k, SCENES[k]); else doAct({ t: 'sceneDone' }); return; }
    if (G.vignettes.length && G.mode === 'hotel') { const v = VIGNETTES[G.vignettes[0]]; ui.showScene(G.vignettes[0], v.lines, v.title); return; }
    if (G.mode === 'hotel') {
        const r = Object.keys(G.recruits).find((h) => G.recruits[h].stage === 'ready');
        if (r) { ui.showRecruit(r); return; }
        if (G.won && !endingShown) {
            endingShown = true;
            $('ending-text').textContent = `Debt paid on day ${G.day}${G.late ? ` (with ${G.late} late fee${G.late > 1 ? 's' : ''})` : ''}. ${G.stats.checkins} guests, ${G.stats.cooked} meals, ${G.stats.swept} dust bunnies shooed, ${G.stats.wins} battles won. The Drowsy Dragonfly stays open, and Madame Goldmaw has booked the Sunroom.`;
            ui.openScreen('ending');
        }
    }
}

// ------------------------------------------------------------------ frame loop
const BLOCKING = new Set(['title', 'pause', 'howto', 'settings', 'choice', 'ending']);
let lastMode = null;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handleKey();
    const blocked = ui.stack.some((s) => BLOCKING.has(s)) || ui.talking;
    const running = mode === 'play' && !blocked;
    const spd = G.mode === 'battle' ? settings.speed : 1;
    if (running) {
        acc += dt * FAST * spd;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            step(G, STEP, { hold: view.busy || G.events.length > 0 });
            acc -= STEP; n++;
            if (G.events.length) flushEvents();
        }
        if (bot) { botT += dt * FAST; if (botT > 0.25) { botT = 0; const c = botCmd(G, bot); if (c) doAct(c); } }
        saveT += dt;
        if (saveT > 15) { saveT = 0; saveGame(G); }
    } else acc = 0;
    flushEvents();
    stories();
    const uiMode = mode !== 'play' ? 'none' : G.mode;
    if (uiMode !== lastMode) { ui.showMode(uiMode); lastMode = uiMode; }
    view.frame(G, dt * (G.mode === 'battle' || view.busy ? spd * (DEBUG ? Math.min(4, FAST) : 1) : 1));
    if (mode === 'play') {
        if (G.mode === 'hotel') { ui.hud(G, time); labelT += dt; if (labelT > 0.1 && !ui.anyScreen()) { labelT = 0; ui.roomLabels(G, view.hotel); } }
        else if (G.mode === 'expedition') ui.expedCard(G, false);
        else if (G.mode === 'battle') {
            ui.G = G;
            ui.battleHud(G, view, view.busy);
            if (['won', 'lost', 'fled'].includes(G.battle.phase)) ui.expedCard(G, view.busy);
            else $('exped').hidden = true;
        }
    }
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (mode === 'play') saveGame(G); }
    else if (hiddenAt && mode === 'play') { const away = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; welcomeBack(away); }
});
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__iomh = {
        get G() { return G; }, get mode() { return mode; }, seen, view, ui, audio, keys,
        start(seed = 1, skipIntro = true) { startGame(newGame(seed)); if (skipIntro) G.scenes.length = 0; return G; },
        act: (cmd) => doAct(cmd),
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing (the view catches up on the events). */
        ff(sec, skill = 1) {
            const b = makeBot({ skill });
            let t = 0, th = 0;
            while (t < sec) { step(G, STEP); t += STEP; th += STEP; if (th > 0.3) { th = 0; const c = botCmd(G, b); if (c) act(G, c); } if (G.events.length > 400) flushEvents(true); }
            flushEvents(true);
        },
        save: () => saveGame(G), hasSave,
        busy: () => view.busy || G.events.length > 0,
    };
}
