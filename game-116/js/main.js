// SOLITAIRE FROM OUTER SPACE — entry point. Boots the view, routes taps, keys and panel clicks into
// sim commands, feeds the sim's events to the view (which plays them back) and moves between the
// title, the run, the intermission and the end.
//
// ?debug=1 exposes window.__sfos for the dev/ harnesses; &fast=N plays the event show N× faster.

import { MAX_FRAME, STEP } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import { act, newGame, score, step } from './sim/game.js';
import { makeBot, botCommand } from './sim/bot.js';
import { GADGETS, RELICS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onCmd: (cmd, btn) => panelCmd(cmd, btn),
});
function applySettings() { view.film = settings.film; view.speed = FAST * (+settings.speed || 1); }
applySettings();

let G = null;                // null on the title screen
let mode = 'title';          // title | play | over
let time = 0;
let last = performance.now();
let bot = null;
let botWait = 0;
const pending = [];          // taps held while the show plays (at most two)
const seen = {};             // a count of every sim event drained, for the tests
let best = loadBest();

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

const newSeed = () => (Date.now() % 1e9) | 0;
document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame(newSeed()));
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { if (G && !G.over) saveGame(G); toTitle(); }
    else if (a === 'deck') ui.showDeck(G);
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-deck').addEventListener('click', () => { if (G && !ui.anyScreen()) { audio.ui('open'); ui.showDeck(G); } });
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame(newSeed())); });
document.getElementById('over-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    pending.length = 0;
    input.flush();
    G.events.length = 0;
    view.reset(G);
    ui.showHud(true);
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    G = null;
    bot = null;
    ui.showHud(false);
    ui.syncPanel({ over: true });
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    if (G && !G.over) saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ commands
function busy() { return view.busy || (G && G.events.length > 0); }

function doCmd(cmd) {
    if (!G || G.over) return false;
    const ok = act(G, cmd);
    if (!ok) { audio.ui('no'); return false; }
    if (G.over) {
        clearSave();
        best = { ...best, score: Math.max(best.score, score(G)), runs: best.runs + 1, wins: best.wins + (G.won ? 1 : 0) };
        saveBest(best);
    } else saveGame(G);
    return true;
}
function queueCmd(cmd) {
    if (pending.length < 2) pending.push(cmd);
}
function panelCmd(cmd, btn) {
    if (busy()) return;
    audio.ui(cmd.t === 'buy' || cmd.t === 'take' ? 'buy' : 'click');
    btn?.blur?.();
    doCmd(cmd);
}

/** A tap or a key on something in the canvas. */
function activate(hit) {
    if (!hit || !G) return;
    if (view.targeting >= 0) {
        const i = view.targeting;
        view.targeting = -1;
        if (hit.kind === 'card') queueCmd({ t: 'gadget', i, target: hit.id });
        return;
    }
    switch (hit.kind) {
        case 'card':
            if (hit.ok) queueCmd({ t: 'play', id: hit.id });
            else { audio.ui('no'); view.hover = hit; }
            break;
        case 'draw': queueCmd({ t: 'draw' }); break;
        case 'end': queueCmd({ t: 'end' }); break;
        case 'gadget': {
            const k = G.gadgets[hit.i];
            if (!hit.ok) { audio.ui('no'); ui.toast(`${GADGETS[k].name} needs ${GADGETS[k].cost} charge. Play Atom cards to charge up.`); break; }
            if (GADGETS[k].target) { view.targeting = hit.i; audio.ui('open'); }
            else queueCmd({ t: 'gadget', i: hit.i });
            break;
        }
        case 'node': queueCmd({ t: 'go', id: hit.id }); break;
        default: view.hover = hit;     // info only: the beam, the enemy, the intent
    }
}

const canvas = document.getElementById('view');
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen() || ui.panelOpen()) return;
    e.preventDefault();
    document.activeElement?.blur?.();
    activate(view.hitAt(e.clientX, e.clientY));
});
canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    view.hover = view.hitAt(e.clientX, e.clientY);
    canvas.style.cursor = view.hover?.ok ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => { view.hover = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------------ keys
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play' || !G) return;
    if (ui.panelOpen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' || key === 'KeyP') pause();
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (key === 'Escape' || key === 'KeyP') {
        if (view.targeting >= 0) { view.targeting = -1; audio.ui('close'); } else pause();
        return;
    }
    if (press.onButton) return;   // a focused HUD button takes its own Enter and Space
    if (key === 'ArrowLeft') view.moveFocus(-1, 0);
    else if (key === 'ArrowRight') view.moveFocus(1, 0);
    else if (key === 'ArrowUp') view.moveFocus(0, -1);
    else if (key === 'ArrowDown') view.moveFocus(0, 1);
    else if (key === 'Enter' || key === 'Space') {
        const h = view.focusHit();
        if (h) activate(h); else view.moveFocus(1, 0);
    } else if (key === 'KeyD' && G.phase === 'battle') {
        const btn = view.hits.find((h) => h.key === 'btn');
        if (btn) activate(btn);
    } else if (key === 'KeyE' && G.phase === 'battle') queueCmd({ t: 'end' });
    else if (/^Digit[1-3]$/.test(key) && G.phase === 'battle') {
        const h = view.hits.find((x) => x.key === `gadget:${+key.slice(5) - 1}`);
        if (h) activate(h);
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.push(ev);
}
view.onEvent = (e) => {
    audio.event(e);
    if (e.type === 'gain' && e.what === 'gadget') ui.toast(`New gadget: ${GADGETS[e.k].name}`);
    if (e.type === 'gain' && e.what === 'relic') ui.toast(`Souvenir: ${RELICS[e.k].icon} ${RELICS[e.k].name}`);
};

function musicFor() {
    if (!G) return 'title';
    if (G.phase === 'battle' || (G.phase === 'reward' && G.offer?.kind === 'reward')) return G.battle?.tier === 'boss' ? 'boss' : 'battle';
    return 'map';
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    if (G && mode === 'play') {
        step(G, null, dt);
        const free = !ui.anyScreen();
        if (free && !busy() && pending.length) {
            const cmd = pending.shift();
            doCmd(cmd);
        } else if (free && !busy() && bot && !G.over) {
            botWait -= dt * FAST;
            if (botWait <= 0) {
                botWait = 0.12;
                const cmd = botCommand(G, bot);
                if (cmd) doCmd(cmd);
            }
        }
        flushEvents();
        if (!busy()) {
            ui.syncPanel(G);
            if (G.over && mode === 'play') { mode = 'over'; ui.showHud(false); ui.showOver(G, best); }
        }
        if (view.targeting >= 0 && G.phase !== 'battle') view.targeting = -1;
    }
    audio.setMusic(musicFor());
    view.frame(G, dt, time);
    if (G && (mode === 'play')) ui.hud(G, G.phase === 'battle' ? view.shown : null);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (G && mode === 'play' && !G.over) saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__sfos = {
        get G() { return G; },
        get mode() { return mode; },
        get busy() { return busy() || pending.length > 0; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 11 }) : null; },
        /** Run the bot synchronously for n commands (or until a phase), then let the view catch up. */
        ff(n = 50, until = null) {
            const b = makeBot({ seed: 5 });
            for (let i = 0; i < n && G && !G.over; i++) {
                if (until && until(G)) break;
                const c = botCommand(G, b);
                if (!c || !act(G, c)) break;
            }
            flushEvents();
            view.finish();
            if (G && !G.over) saveGame(G);
        },
        cmd: (c) => doCmd(c),
        finish: () => { flushEvents(); view.finish(); },
        save: () => saveGame(G),
        hasSave,
        STEP,
    };
}
