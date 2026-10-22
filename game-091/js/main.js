// STARSPIN — entry point. Boots the view, routes input to sim actions, and plays each resolved
// turn back as a timed show: the sim resolves a whole FIRE at once and emits events that carry a
// snapshot of the HUD, the show releases them one beat at a time, and new actions wait until the
// show and the reels are done.
//
// ?debug=1 exposes window.__ss for the dev/ harnesses; &fast=N plays the show N× faster.

import { STEP } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, can } from './sim/game.js';
import { snap } from './sim/battle.js';
import { makeBot, botAct } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

// how long each event holds the show before the next one plays (seconds at normal speed)
const DUR = {
    battle: 0.7, nudge: 0.22, respin: 0.75, fire: 0.45, hit: 0.32, edie: 0.45, burn: 0.2, pblock: 0.2,
    pheal: 0.2, charge: 0.15, eturn: 0.25, eact: 0.38, phit: 0.3, eheal: 0.3, jam: 0.35, turn: 0.05, win: 1.0, sector: 0.6,
};

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const insets = () => {
    if (mode !== 'play') return { top: 40, bottom: 40 };
    const bar = document.getElementById('bar').getBoundingClientRect();
    return { top: 64, bottom: Math.round(bar.height) + 6 };
};
let mode = 'title';          // title | play | over
const view = new View(document.getElementById('view'), { insets });
view.setCalm(settings.calm);
const ui = new UI({
    audio, settings, input,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.setCalm(s.calm); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    request: (a) => request(a),
});

let G = null;
let show = [];               // events waiting to play
let showT = 0;               // time left on the event playing now
let lastSnap = null;
let pending = [];            // player actions waiting for the show to finish
let bot = null;
let overPending = false;
let phaseKey = '';
let phaseScreen = null;
let time = 0;
let last = performance.now();
const seen = {};             // a count of every sim event played, for the tests

const speed = () => (settings.speed || 1) * FAST;
const idle = () => !show.length && showT <= 0 && !view.busy();

// ------------------------------------------------------------------ setup
function attract() {
    G = newGame(((Date.now() / 1000) | 0) % 9973 + 1);
    bot = makeBot({ skill: 0.9, seed: 3 });
    audio.muted = true;
    resync();
}

/** Point the view and the HUD at G as it is now (a new game, a loaded save, a fast-forward). */
function resync() {
    G.events.length = 0;
    show = []; showT = 0; lastSnap = null;
    view.backdrop.setSector(G.sector);
    audio.setSong(G.sector);
    if (G.b) {
        view.setBattle(G.b.enemies.map((e) => e.id), G.b.reels, G.b.stops);
        ui.buildBattle(G, G.b.enemies.map((e) => e.id), G.b.reels.length);
        view.sync(G);
    }
}

function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-tree').addEventListener('click', () => openTreeView());
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0)); });
document.getElementById('over-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    bot = null;
    overPending = false;
    phaseKey = ''; phaseScreen = null;
    pending = [];
    input.flush();
    audio.muted = false;
    audio.setPlaying(true);
    ui.showPlay(true);
    resync();
    view.resize(true);
    // place the tags now rather than on the next frame, which can be slow in coming
    ui.hud(G, snap(G), view.anchors(), true);
    updateTouch();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showPlay(false);
    audio.setPlaying(false);
    attract();
    view.resize(true);
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.isOpen('pause')) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function openTreeView() {
    if (mode !== 'play' || G.phase !== 'battle' || ui.anyScreen()) return;
    audio.ui('open');
    ui.showTree(G, true);
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;

// ------------------------------------------------------------------ actions
/** A player action from a button, a tap or a key. It waits until the show is done. */
function request(a) {
    if (mode !== 'play' || !a) return;
    const top = ui.top();
    if (top === 'pause' || top === 'settings' || top === 'howto') return;
    if (top === 'tree' && ui.treeView) return;
    if (a.t === 'nudge' || a.t === 'respin' || a.t === 'target') audio.ui('click');
    if (pending.length < 3) pending.push(a);
}

function takeAction(a) {
    if (!can(G, a)) { if (mode === 'play') audio.ui('deny'); return false; }
    step(G, { act: a }, STEP);
    drain();
    if (mode === 'play') saveGame(G);
    return true;
}

function drain() {
    if (!G.events.length) return;
    for (const e of G.events.splice(0)) show.push(e);
}

function play(e) {
    seen[e.type] = (seen[e.type] || 0) + 1;
    if (e.s) lastSnap = e.s;
    if (e.type === 'sector') audio.setSong(e.sector);
    view.onEvent(G, e);
    audio.onEvent(e);
    ui.onEvent(G, e, view.anchors());
    if (e.type === 'over' && mode === 'play') overPending = true;
}

function release(dt) {
    showT -= dt * speed();
    while (showT <= 0 && show.length) {
        const e = show.shift();
        play(e);
        const n = e.type === 'spin' ? 0.8 + e.stops.length * 0.22 : DUR[e.type] || 0;
        showT += n;
    }
    if (!show.length && showT < 0) showT = 0;
}

// ------------------------------------------------------------------ phase screens
const PHASE_SCREEN = { reward: 'reward', tree: 'tree', way: 'way' };

function syncScreens() {
    if (mode !== 'play' || !idle()) return;
    const want = PHASE_SCREEN[G.phase] || null;
    const key = `${G.phase}:${G.sector}:${G.stop}:${G.points}:${G.tree.lit.length}`;
    if (phaseScreen && (phaseScreen !== want || key !== phaseKey)) {
        ui.closeScreen(phaseScreen);
        phaseScreen = null;
    }
    if (want && !phaseScreen && !ui.isOpen('pause') && !ui.isOpen('settings') && !ui.isOpen('howto')) {
        if (ui.isOpen('tree')) ui.closeScreen('tree');           // a look-only tree from the HUD
        if (want === 'reward') ui.showReward(G);
        else if (want === 'tree') ui.showTree(G);
        else if (want === 'way') ui.showWay(G);
        phaseScreen = want;
        phaseKey = key;
        pending = [];
        input.flush();
    }
    if (overPending && !G.b?.enemies.some((e, i) => view.foes[i] && !view.foes[i].dead && e.hp <= 0)) {
        overPending = false;
        mode = 'over';
        clearSave();
        ui.showPlay(false);
        audio.setPlaying(false);
        ui.showOver(G);
    }
}

// ------------------------------------------------------------------ input routing
function nextTarget(dir) {
    if (!G.b || G.phase !== 'battle') return;
    const n = G.b.enemies.length;
    for (let k = 1; k <= n; k++) {
        const i = (G.b.target + dir * k + n * 2) % n;
        if (G.b.enemies[i].hp > 0) { request({ t: 'target', i }); return; }
    }
}

function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' || key === 'KeyP' || (key === 'KeyC' && top === 'tree' && ui.treeView)) {
            if (top === 'pause' || top === 'settings' || top === 'howto' || (top === 'tree' && ui.treeView)) { audio.ui('close'); ui.closeTop(); }
            else if (mode === 'play' && PHASE_SCREEN[G.phase] === top) pause();
        } else if ((key === 'Enter' || key === 'Space') && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    const n = G.b ? G.b.reels.length : 3;
    if (key === 'Space' || key === 'Enter' || key === 'NumpadEnter') request(ui.goAction);
    else if (key === 'ArrowLeft' || key === 'KeyA') ui.select((ui.sel - 1 + n) % n);
    else if (key === 'ArrowRight' || key === 'KeyD') ui.select((ui.sel + 1) % n);
    else if (/^Digit[1-5]$/.test(key)) ui.select(+key.slice(5) - 1);
    else if (key === 'ArrowUp' || key === 'KeyW') request({ t: 'nudge', reel: ui.sel, dir: 1 });
    else if (key === 'ArrowDown' || key === 'KeyS') request({ t: 'nudge', reel: ui.sel, dir: -1 });
    else if (key === 'KeyR' || key === 'KeyX') request({ t: 'respin', reel: ui.sel });
    else if (key === 'KeyT') nextTarget(1);
    else if (key === 'KeyQ') nextTarget(-1);
    else if (key === 'KeyC') openTreeView();
    else if (key === 'Escape' || key === 'KeyP') pause();
}

// ------------------------------------------------------------------ frame loop
let attractWait = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    release(dt);

    const blocked = ui.isOpen('pause') || ui.isOpen('settings') || ui.isOpen('howto');
    if (idle() && !blocked) {
        if (mode === 'title' && bot) {
            if (G.over) { attractWait += dt; if (attractWait > 2) { attractWait = 0; attract(); } }
            else takeAction(botAct(G, bot));
        } else if (mode === 'play') {
            if (bot && !pending.length) { const a = botAct(G, bot); if (a) pending.push(a); }
            if (pending.length) takeAction(pending.shift());
        }
    }
    syncScreens();
    if (idle()) { lastSnap = null; view.sync(G); }
    const D = lastSnap || snap(G);
    const sdt = dt * speed();
    view.frame(G, sdt, time, mode === 'play' ? ui.sel : -1);
    if (mode === 'play') ui.hud(G, D, view.anchors(), idle());
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

attract();
refreshTitle();
ui.openScreen('title');
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ss = {
        get G() { return G; },
        get mode() { return mode; },
        get pending() { return pending.length; },
        seen, view, ui, audio, input,
        idle,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot({ skill: 1, seed: 5 }) : null; },
        /** Play `n` bot actions synchronously (or until `until(G)` is true), then snap the view to the result. */
        ff(n = 1e6, until = null) {
            const b = makeBot({ skill: 1, seed: 9 });
            for (let k = 0; k < n && !G.over && !(until && until(G)); k++) {
                const a = botAct(G, b);
                if (!a || !can(G, a)) break;
                step(G, { act: a }, STEP);
                for (const e of G.events) seen[e.type] = (seen[e.type] || 0) + 1;
                if (G.events.some((e) => e.type === 'over')) overPending = mode === 'play';
                G.events.length = 0;
            }
            resync();
            if (mode === 'play') saveGame(G);
            return G.phase;
        },
        /** Take an action now, as the player would. */
        act(a) { request(a); },
        save: () => saveGame(G),
        hasSave,
    };
}
