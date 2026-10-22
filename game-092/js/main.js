// NEONFALL — entry point. Boots the view, runs the fixed-step simulation, routes input and events,
// and moves between the title (a bot plays a demo behind the menu), play, pause and the end.
//
// ?debug=1 exposes window.__nf for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, TIME_LIMIT, TREASURES } from './config.js';
import { View } from './view/view.js';
import { audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import { newGame, step, crocWarn } from './sim/game.js';
import { getWorld } from './sim/world.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const seedParam = params.get('seed');

const settings = loadSettings();
if (!localStorageHas() && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) settings.calm = true;
function localStorageHas() { try { return localStorage.getItem('neonfall.v1.settings') !== null; } catch { return false; } }

const input = new Input();
const view = new View(document.getElementById('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
function applySettings() {
    audio.setLevels(settings.sfx, settings.music);
    view.calm = !!settings.calm;
    view.crtOn = !!settings.crt;
    audio.calm = !!settings.calm;
}
applySettings();

let G = newGame(1);          // the title screen shows a bot playing in the background
let mode = 'title';          // title | play | over
let demoBot = null;
let acc = 0;
let time = 0;
let last = performance.now();
let freezeUntil = 0;
let saveT = 0;
let bot = null;              // autoplay (debug)
let wasRunning = false;
let best = loadBest();
const seen = {};             // a count of every sim event drained, for the tests

const freshSeed = () => (seedParam ? +seedParam : (Date.now() % 1e9) | 0) || 1;

// ------------------------------------------------------------------ the title demo
function startDemo() {
    const seed = (Math.floor(Math.random() * 1e6) + 1);
    G = newGame(seed);
    demoBot = makeBot({ skill: 1, seed });
    view.base = 0;
}

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !hasSave();
    best = loadBest();
    ui.setBest(best);
}
startDemo();
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title') audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.sfx('select');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(freshSeed()));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.sfx('select');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('over-again').addEventListener('click', () => { audio.sfx('select'); startGame(newGame(freshSeed())); });
document.getElementById('over-title-btn').addEventListener('click', () => { audio.sfx('back'); toTitle(); });

function startGame(g) {
    G = g;
    demoBot = null;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    view.base = 0;
    view.fx.parts.length = 0; view.fx.ghosts.length = 0; view.pops.length = 0;
    input.flush();
    ui.shownScore = G.score;
    ui.showHud(true);
    updateTouch();
    saveGame(G);
    audio.sfx('start');
    setMusic();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    startDemo();
    refreshTitle();
    ui.openScreen('title');
    audio.setTunnel(false);
    audio.play('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.sfx('open');
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => input.pressA());

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') { ui.moveFocus(1); audio.sfx('move'); }
        else if (key === 'ArrowUp') { ui.moveFocus(-1); audio.sfx('move'); }
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'over') { audio.sfx('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
const SFX = {
    jump: () => audio.sfx('jump'),
    land: (e) => { if (e.impact > 110) audio.sfx('land', { impact: e.impact }); },
    step: () => audio.sfx('step'),
    grab: () => audio.sfx('grab'),
    release: () => audio.sfx('release'),
    hit: () => audio.sfx('hit'),
    respawn: () => audio.sfx('respawn'),
    treasure: (e) => audio.sfx('treasure', { streak: e.streak }),
    life: () => audio.sfx('life'),
    screen: () => audio.sfx('screen'),
    ladder: () => audio.sfx('ladder'),
    rung: () => audio.sfx('rung'),
    tick: (e) => audio.sfx('tick', { sec: e.sec }),
    hurry: () => audio.sfx('hurry'),
    death: (e) => {
        audio.sfx(e.kind === 'sink' ? 'sink' : e.kind === 'drown' ? 'splash' : e.kind === 'chomp' ? 'chomp' : 'zap');
        audio.sfx('death');
    },
};

function flushEvents(quiet = false) {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    // a fast-forward drops the effects of what it skipped, but the view still has to follow the screens
    view.onEvents(G, quiet ? ev.filter((e) => e.type === 'screen') : ev);
    if (quiet) view.takeHitstop();
    else if (mode === 'play') {
        for (const e of ev) SFX[e.type]?.(e);
        if (FAST === 1) { const h = view.takeHitstop(); if (h) freezeUntil = performance.now() + Math.min(160, h); } else view.takeHitstop();
    } else view.takeHitstop();
    if (mode === 'play' && ev.some((e) => e.type === 'over')) endGame(ev.find((e) => e.type === 'over'));
    if (mode === 'title' && G.over) startDemo();
}

function endGame(e) {
    mode = 'over';
    clearSave();
    ui.showHud(false);
    const n = e.treasures;
    const wasBest = G.score > best.score;
    best = saveBest(G.score, n);
    audio.sfx(e.reason === 'won' ? 'win' : e.reason === 'time' ? 'timeup' : 'over');
    audio.setTunnel(false);
    audio.play(e.reason === 'won' ? 'ending' : null);
    ui.showOver(G, best, wasBest);
}

// ------------------------------------------------------------------ music follows the play
let lastSong = null;
function setMusic() {
    let id = 'title';
    if (mode === 'play') id = G.left < 120 ? 'hurry' : ['j1', 'j2', 'j3'][Math.min(2, Math.floor(G.screen / 32))];
    else if (mode === 'over') return;
    audio.layer = mode === 'play' && G.left < 60 ? 4 : 3;
    if (id !== lastSong) { lastSong = id; audio.play(id); }
    audio.setTunnel(mode === 'play' && G.p.layer === 'tunnel');
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const playing = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (playing && !wasRunning) input.flush();
    wasRunning = playing;
    const frozen = now < freezeUntil;

    if (playing && !frozen) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST && !G.over) {
            const inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
        for (const c of getWorld(G.seed).screens[G.screen].crocs) if (crocWarn(c, G.t)) { audio.sfx('crocwarn'); break; }
        if (G.p.st === 'vine') audio.sfx('swing');
    } else if (mode === 'title' && demoBot) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12 && !G.over) { step(G, botInput(G, demoBot), STEP); acc -= STEP; n++; }
        if (G.t > 150 || G.over) startDemo();
    } else if (!playing) acc = 0;

    flushEvents();
    setMusic();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G, dt);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    let ffBot = null;
    window.__nf = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) {
            if (!ffBot) ffBot = makeBot();
            for (let t = 0; t < sec && !G.over; t += STEP) { step(G, botInput(G, ffBot), STEP); if (G.events.length > 50) flushEvents(true); }
            flushEvents(true);
        },
        /** Put Harry somewhere: screen index, x, and 'surface' or 'tunnel'. */
        tp(screen, x = 40, layer = 'surface') {
            G.screen = screen; G.p.x = x; G.p.layer = layer; G.p.y = layer === 'tunnel' ? 172 : 104;
            G.p.st = 'ground'; G.p.vx = G.p.vy = 0; G.p.inv = 1; G.visited[screen] = 1;
        },
        save: () => saveGame(G),
        hasSave,
    };
}
