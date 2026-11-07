// Atlas of Ink — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, a season of commissions, pause and the end.
//
// ?debug=1 exposes window.__ai for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, recordBest } from './save.js';
import { newGame, step, next, deliver } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

const ATTRACT_SEEDS = [11, 4, 23, 8, 15, 42];
let attractN = 0;
let G = newGame(ATTRACT_SEEDS[0]);   // the title screen charts a map in the background, played by the bot
let mode = 'title';                  // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;                      // set by ?debug autoplay: the bot plays the real game
let wasRunning = false;
let wasScreen = true;                // was a screen open on the previous frame?
let attract = { bot: makeBot({ skill: 0.9 }), wait: 0, acc: 0 };
const seen = {};                     // a count of every sim event drained during play, for the tests
const CLOSABLE = new Set(['howto', 'settings', 'pause', 'confirm']);

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); ui.showBest(loadBest()); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ?debug=1&seed=N makes New Season deterministic for the browser tests
const freshSeed = () => (DEBUG && params.get('seed') ? +params.get('seed') : (Date.now() % 1e9) | 0);
$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(freshSeed()), true);
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g, false); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else if (act === 'brief') { ui.showBrief(G, false); ui.openScreen('brief'); }
    else ui.openScreen(act);
});
$('btn-pause').addEventListener('click', () => pause());
$('btn-brief').addEventListener('click', () => { if (canAct()) { audio.ui('open'); ui.showBrief(G, false); ui.openScreen('brief'); } });
$('confirm-yes').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('confirm'); if (G.phase === 'work') deliver(G); });
$('result-next').addEventListener('click', () => {
    audio.ui('click');
    ui.closeScreen('result');
    next(G);
    if (G.phase === 'work') { saveGame(G); openBrief(); }
});
$('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame(freshSeed()), true); });
$('over-menu').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function openBrief() { ui.showBrief(G, true); ui.openScreen('brief'); }
function canAct() { return mode === 'play' && G.phase === 'work' && !ui.anyScreen(); }

function startGame(g, withBrief) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.hudIdx = -1;
    ui.showHud(true);
    updateTouch();
    view.snap();
    audio.setMood('work');
    if (G.phase === 'result') { ui.showResult(G); ui.openScreen('result'); }
    else if (withBrief) openBrief();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    attractN++;
    G = newGame(ATTRACT_SEEDS[attractN % ATTRACT_SEEDS.length]);
    attract = { bot: makeBot({ skill: 0.9 }), wait: 0, acc: 0 };
    view.snap();
    audio.setMood('title');
    audio.setChannel(null);
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (!canAct()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function askDeliver() {
    if (!canAct()) return;
    audio.ui('open');
    ui.showConfirm(G);
    ui.openScreen('confirm');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindHold($('btn-a'));
input.bindButton($('btn-d'), askDeliver);

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && CLOSABLE.has(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play' || G.phase !== 'work') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyE' || (key === 'Enter' && !press.pad)) askDeliver();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    if (mode === 'title') return;                          // the attract demo is silent and shows no screens
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'result') { ui.showResult(G); ui.openScreen('result'); }
        else if (e.type === 'over') {
            mode = 'over';
            clearSave();
            const isBest = recordBest({ points: e.points, stars: e.stars, rank: e.rank });
            ui.showBest(loadBest());
            ui.showOver(G, e.rank, isBest);
            ui.showHud(false);
            ui.openScreen('over');
        }
    }
}

// ------------------------------------------------------------------ the demo behind the title
function attractStep(dt) {
    if (G.phase === 'work') {
        attract.acc += dt;
        let n = 0;
        while (attract.acc >= STEP && n < 12 && G.phase === 'work') {
            step(G, botInput(G, attract.bot), STEP);
            attract.acc -= STEP; n++;
        }
    } else if (G.phase === 'result') {
        attract.wait += dt;
        if (attract.wait > 2.4) { attract.wait = 0; next(G); }
    } else if (G.phase === 'over') {
        attractN++;
        G = newGame(ATTRACT_SEEDS[attractN % ATTRACT_SEEDS.length]);
        attract = { bot: makeBot({ skill: 0.9 }), wait: 0, acc: 0 };
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    // the key or tap that closed a screen (Enter on Begin, say) must not also act in the game
    const screenOpen = ui.anyScreen();
    if (wasScreen && !screenOpen) input.flush();
    wasScreen = screenOpen;
    handlePresses();

    const running = mode === 'play' && G.phase === 'work' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST && G.phase === 'work') {
            const inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else {
        acc = 0;
        if (mode === 'title') attractStep(dt);
    }
    audio.setChannel(running && G.channel ? G.channel.focus : null);
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    const dbg = makeBot();
    window.__ai = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1, brief = false) { startGame(newGame(seed), brief); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) {
            for (let t = 0; t < sec && G.phase === 'work'; t += STEP) step(G, botInput(G, dbg), STEP);
            // let the bot finish a spell it is holding, or the real (empty) input would release it half-focused
            for (let n = 0; G.channel && G.phase === 'work' && n < 400; n++) step(G, botInput(G, dbg), STEP);
            flushEvents();
        },
        /** Let the bot finish the current commission and hand it over. */
        finish() { let g = 0; while (G.phase === 'work' && g++ < 1e6) step(G, botInput(G, dbg), STEP); flushEvents(); },
        deliver() { deliver(G); flushEvents(); },
        /** Skip ahead to commission n without playing the ones before it. */
        jump(n) { while (G.idx < n && G.phase !== 'over') { deliver(G); next(G); } G.events.length = 0; view.snap(); },
        save: () => saveGame(G),
        hasSave,
    };
}
