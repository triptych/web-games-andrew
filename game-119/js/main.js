// THE HERO'S MERCHANT: entry point. Boots the painted world, runs the fixed-step simulation (which only moves
// the clock and the journey), routes input and events, and moves between title, play and the ending.
//
// ?debug=1 exposes window.__thm for the dev/ harnesses; &fast=N runs the road N times faster.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { $ } from './dom.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act } from './sim/game.js';
import { makeBot, botTurn, botPending, runBot } from './sim/bot.js';
import { TOWN } from './sim/data/towns.js';
import { itemName } from './sim/data/items.js';
import { addItems } from './sim/inv.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'));

let G = newGame(1);          // the title screen shows a game in the background
G.events.length = 0;
let mode = 'boot';           // boot | title | play | over
let mapOpen = false;         // in a town, looking at the map to pick a destination
let hurry = false;
let acc = 0, time = 0, last = performance.now(), saveT = 0, wasRunning = false;
let bot = null, botT = 0, endingShown = false;
const seen = {};

const ui = new UI({
    audio, settings,
    getG: () => G,
    act: (cmd, o) => doAct(cmd, o),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.onMapToggle = () => { if (!G.travel && mode === 'play') { ui.closePanel(); mapOpen = !mapOpen; ui.dock(true, mapOpen ? 'map' : 'town'); } };
ui.onMenu = () => pause();
ui.onHurry = () => { hurry = !hurry; };

// ------------------------------------------------------------------ commands from the UI
function doAct(cmd, o = {}) {
    const r = act(G, cmd);
    if (!r.ok) { if (!o.silent) { ui.toast(r.msg, 'bad'); audio.ui('bad'); } }
    else if (!o.quiet && r.msg) ui.toast(r.msg, 'good');
    ui.renderPanel();
    ui.hud(G);
    if (r.ok && (cmd.t === 'rest' || cmd.t === 'upgradeWagon' || cmd.t === 'turnin' || cmd.t === 'offer')) saveGame(G);
    return r;
}
function go(to) {
    if (to === null) { mapOpen = false; ui.dock(true, 'town'); return; }
    const r = act(G, { t: 'travel', to });
    if (!r.ok) { ui.toast(r.msg, 'bad'); audio.ui('bad'); return; }
    ui.toast(r.msg);
    ui.closePanel();
    hurry = false;
    ui.dock(true, 'map');
    saveGame(G);
}

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
const unlock = () => { audio.init(); audio.start(); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.', 'bad'); }
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

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    ui.closePanel(); ui.closeModal();
    document.activeElement?.blur?.();
    mode = 'play'; mapOpen = false; acc = 0; endingShown = !!g.ending; hurry = false;
    input.flush();
    ui.ps.sel = 0; ui.ps.offer = null;
    ui.showHud(true);
    ui.dock(true, 'town');
    ui.hud(G, true);
    audio.setMood('town');
    flushEvents();
    saveGame(G);
}
function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    ui.closePanel(); ui.closeModal();
    mode = 'title';
    ui.showHud(false);
    $('places').replaceChildren(); ui.placeSig = '';
    G = newGame(1);
    G.events.length = 0;
    refreshTitle();
    ui.openScreen('title');
}
function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    input.poll();
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    const ov = ui.overlay();
    if (ov === 'dialog') { if (key === 'Enter' || key === 'Space' || key === 'PadA') ui.advanceDialog(); else if (key === 'Escape') ui.advanceDialog(); return; }
    if (ov === 'modal') {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'PadA') document.activeElement?.click?.();
        else if (key === 'Escape' && !G.pending) { ui.closeModal(); }
        return;
    }
    if (ov === 'screen') {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'PadA') document.activeElement?.click?.();
        else if ((key === 'Escape') && ui.top() !== 'title' && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        return;
    }
    if (mode !== 'play') return;
    const hot = { KeyI: 'wagon', KeyQ: 'quests', KeyL: 'ledger' }[key];
    if (hot && !G.travel) { ui.panelId === hot ? ui.closePanel() : ui.openPanel(hot); return; }
    if (key === 'KeyM' && !G.travel) { ui.onMapToggle(); return; }
    if (ov === 'panel') {
        if (key === 'Escape') ui.closePanel();
        else if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'PadA') document.activeElement?.click?.();
        return;
    }
    if (key === 'Escape') pause();
    else if (key === 'ArrowDown' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowLeft') { document.activeElement === document.body && ui.focusables($('places')).length ? ui.focusables($('places'))[0].focus() : ui.moveFocusIn?.($('places'), key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1); }
    else if (key === 'PadA') document.activeElement?.click?.();
    else if (key === 'Space' && G.travel) hurry = !hurry;
}
ui.moveFocusIn = (root, dir) => {
    const list = ui.focusables(root);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    list[(i + dir + list.length) % list.length].focus();
};

// ------------------------------------------------------------------ events
const OPEN = { market: 'market', workshop: 'workshop', board: 'board', inn: 'inn', guild: 'guild', hero: 'hero' };
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'dialog') ui.dialog(e.lines, e.id === 'intro' ? () => ui.toast('Tap the market to buy goods. Your first job: Pim wants grain in Willowbrook.') : null);
        else if (e.type === 'levelup') ui.toast(`Merchant level ${e.lv}: ${['', '', '', 'a Donkey Cart is now available.', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''][e.lv] || 'new recipes and goods await.'}`, 'good');
        else if (e.type === 'region') ui.toast('A new region of the realm is open to you!', 'good');
        else if (e.type === 'market-event' && e.town === G.loc) ui.toast(`News: ${TOWN[e.town].name} has a market event.`);
        else if (e.type === 'road' && e.kind === 'find') ui.toast(`You find ${e.n} ${itemName(e.t, 0)} by the road.`, 'good');
        else if (e.type === 'road' && e.kind === 'storm') ui.toast('A storm slows you: one extra day.', 'bad');
        else if (e.type === 'road' && e.kind === 'breakdown') ui.toast(`A wheel cracks. Repairs cost ${e.cost}g.`, 'bad');
        else if (e.type === 'road-result') ui.toast(e.msg, e.won ? 'good' : 'bad');
        else if (e.type === 'arrive') { mapOpen = false; ui.dock(true, 'town'); ui.toast(`Welcome to ${TOWN[e.town].name}.`, 'good'); saveGame(G); }
        else if (e.type === 'sell') ui.float(`+${e.gain}g`, innerWidth / 2, innerHeight / 2);
        else if (e.type === 'quest-done') ui.toast(`Quest complete! +${e.gold}g`, 'good');
        else if (e.type === 'hero-sale') ui.float(`+${e.gold}g`, innerWidth / 2, innerHeight / 2);
    }
}
function showEndingWhenReady() {
    if (!G.ending || endingShown || ui.dlgCur || ui.dlgQueue.length) return;
    endingShown = true;
    ui.closePanel();
    mode = 'over';
    clearSave();
    ui.ending(G, {
        keep: () => { ui.closeScreen('over'); mode = 'play'; saveGame(G); },
        again: () => { ui.closeScreen('over'); startGame(newGame((Date.now() % 1e9) | 0)); },
    });
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const overlayBlocks = ui.anyScreen() || ui.dlgCur || !$('modal-layer').hidden;
    const running = mode === 'play' && !overlayBlocks && !ui.panelId;
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running || (mode === 'play' && G.travel && !overlayBlocks)) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            step(G, { ff: hurry ? 4 : 1 }, STEP);
            acc -= STEP; n++;
            if (G.pending || !G.travel) break;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else acc = 0;
    if (bot && mode === 'play' && !overlayBlocks && !G.ending) {
        botT += dt;
        if (G.pending) botPending(G, bot);
        else if (!G.travel && botT > 0.25) { botT = 0; ui.closePanel(); botTurn(G, bot); }
    }
    flushEvents();
    if (mode === 'play' || mode === 'over') {
        ui.encounter(G);
        showEndingWhenReady();
    }
    // the view
    const vmode = mode === 'title' || mode === 'boot' ? 'title' : G.travel || mapOpen ? 'map' : 'town';
    view.setMode(vmode);
    audio.setMood(G.travel ? 'road' : ui.panelId === 'hero' ? 'hero' : 'town');
    view.frame(G, dt, time);
    if (mode === 'play' || mode === 'over') {
        ui.hud(G);
        ui.dock(false, vmode === 'map' ? 'map' : 'town');
        const showPlaces = mode === 'play' && !G.travel && !ui.panelId && !overlayBlocks && !(G.pending);
        $('places').style.visibility = showPlaces ? '' : 'hidden';
        ui.places(G, vmode === 'map' ? 'map' : 'town', view.points(G), { town: (id) => ui.travelModal(G, id, go), venue: (id) => { if (id === 'travel') { mapOpen = true; ui.dock(true, 'map'); } else ui.openPanel(OPEN[id]); }, hover: (id) => view.setHover(id) });
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

// ------------------------------------------------------------------ boot
function boot() {
    requestAnimationFrame(() => setTimeout(() => {
        view.init();
        mode = 'title';
        refreshTitle();
        ui.openScreen('title');
        $('loading').classList.add('done');
        setTimeout(() => $('loading').remove(), 700);
        last = performance.now();
        requestAnimationFrame(frame);
    }, 30));
}
boot();

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__thm = {
        get G() { return G; },
        get mode() { return mode; },
        get mapOpen() { return mapOpen; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the bot synchronously for some days; events reach the view as usual. */
        ff(days = 10) { const b = makeBot(); runBot(G, b, { maxDays: G.day + days }); flushEvents(); return G.day; },
        act: (cmd) => doAct(cmd),
        skip() { ui.dlgQueue.length = 0; ui.dlgCur = null; $('dialog').hidden = true; },
        open: (id) => ui.openPanel(id),
        give(t, lv = 0, n = 1) { const k = addItems(G, t, lv, n); ui.renderPanel(); ui.hud(G, true); return k; },
        save: () => saveGame(G),
        hasSave,
    };
}
