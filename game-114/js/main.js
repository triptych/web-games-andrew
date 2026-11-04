// LAST COLONIST — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title (with the bot playing behind it), the story, briefings,
// play, pause, sector clears, game over and the ending.
//
// ?debug=1 exposes window.__lc for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, nextLevel, continueGame, LEVELS } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
input.autofire = settings.autofire === 'on';
const view = new View(document.getElementById('view'), { quality: settings.quality, shake: settings.shake === 'on' });
const ui = new UI({
    audio, settings,
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        view.setQuality(s.quality);
        view.setShake(s.shake === 'on');
        input.autofire = s.autofire === 'on';
        updateTouch();
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

const demo = () => { const g = newGame(20260 + Math.floor(Math.random() * 1000), { level: Math.floor(Math.random() * LEVELS.length) }); g.demo = true; g.god = true; return g; };
let G = demo();               // the title screen shows the bot playing in the background
let demoBot = makeBot({ skill: 1, seed: 3 });
let mode = 'title';           // title | story | brief | play | clear | over | won
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
let wonT = 0;
const seen = {};

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audio.muted = true;
audio.play('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.muted = false;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') newCampaign();
    else if (act === 'continue') {
        const g = loadGame();
        if (!g) { ui.toast('That save could not be read.'); refreshTitle(); return; }
        G = g;
        if (G.levelT < 0.5) toBrief(); else startPlay();
    } else { audio.muted = true; ui.openScreen(act); }
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
document.getElementById('story-go').addEventListener('click', () => { audio.ui('click'); toBrief(); });
document.getElementById('brief-go').addEventListener('click', () => { audio.ui('click'); startPlay(); });
document.getElementById('clear-go').addEventListener('click', () => {
    audio.ui('click');
    if (nextLevel(G)) { G.events.length = 0; saveGame(G); toBrief(); }
});
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); continueGame(G); G.events.length = 0; saveGame(G); startPlay(); });
document.getElementById('over-quit').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('ending-go').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function newCampaign(seed = (Date.now() % 1e9) | 0) {
    G = newGame(seed, { hard: settings.hard === 'hard' });
    mode = 'story';
    ui.closeAll();
    ui.showHud(false);
    saveGame(G);
    audio.play('title');
    ui.showStory();
}

function toBrief() {
    ui.closeAll();
    mode = 'brief';
    ui.showHud(false);
    audio.play('title');
    ui.showBrief(G.levelIdx);
}

function startPlay() {
    ui.closeAll();
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    audio.muted = false;
    const L = LEVELS[G.levelIdx];
    audio.play(G.arenaLocked && G.boss && !G.boss.dead ? 'boss' : L.theme === 'ship' ? 'ship' : 'alien');
    ui.banner(`SECTOR ${G.levelIdx + 1}`, L.name);
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    ui.showHud(false);
    G = demo();
    demoBot = makeBot({ skill: 1, seed: 3 });
    refreshTitle();
    audio.muted = true;
    audio.play('title');
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    document.getElementById('pause-where').textContent = `Sector ${G.levelIdx + 1}: ${LEVELS[G.levelIdx].name}`;
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindHold(document.getElementById('btn-jump'), 'jump');
input.bindHold(document.getElementById('btn-fire'), 'fire');
input.bindHold(document.getElementById('btn-flare'), 'flare');

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'KeyS') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'KeyW') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ['pause', 'howto', 'settings'].includes(ui.top())) {
            audio.ui('close');
            ui.closeTop();
            if (mode === 'title' && ui.top() === 'title') audio.muted = true;
        } else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (mode === 'title') return;          // the attract mode is silent and has no HUD
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'clear') { mode = 'clear'; saveGame(G); setTimeout(() => { if (mode === 'clear' && !ui.anyScreen()) { ui.showHud(false); ui.showClear(G.tally); } }, 1600); }
        else if (e.type === 'over') { mode = 'over'; ui.showHud(false); ui.showOver(G); }
        else if (e.type === 'won') { mode = 'won'; wonT = 3.2; clearSave(); }
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = (mode === 'play' && !ui.anyScreen()) || mode === 'title';
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            let inp;
            if (mode === 'title') inp = botInput(G, demoBot);
            else inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            if (mode !== 'title') input.consumeEdges();      // only once a step has seen them
            acc -= STEP;
            n++;
        }
        if (mode === 'title' && (G.phase === 'clear' || G.phase === 'won' || G.levelT > 150)) { G = demo(); demoBot = makeBot({ skill: 1, seed: 3 }); }
        if (mode === 'play') {
            saveT += dt;
            if (saveT > 20) { saveT = 0; saveGame(G); }
        }
    } else acc = 0;
    if (mode === 'won' && wonT > 0) {
        wonT -= dt;
        if (wonT <= 0) { ui.showHud(false); ui.showEnding(G); }
    }
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play' || mode === 'clear') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__lc = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Skip the title and the story: straight into play on a sector. */
        start(seed = 1, level = 0, opts = {}) { G = newGame(seed, { level, ...opts }); startPlay(); return G; },
        newCampaign,
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        god(on = true) { G.god = on; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, skill = 1) {
            const b = makeBot({ skill });
            for (let t = 0; t < sec && (G.phase === 'play' || G.phase === 'dying'); t += STEP) step(G, botInput(G, b), STEP);
            flushEvents();
        },
        save: () => saveGame(G),
        hasSave,
    };
}
