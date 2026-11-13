// UFOops! — entry point. Boots the view, runs the fixed-step simulation, routes input and events,
// and keeps the DOM screens in step with the sim's phase: episode card, play, report card, game over, the end.
//
// ?debug=1 exposes window.__uo for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { LEVELS } from './sim/data.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import { newGame, step } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { status as artStatus } from './view/art.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let G = attractGame();       // the title screen plays a demo behind the logo
let mode = 'title';          // title | play
let bot = makeBot({ skill: 0.9, seed: 5 });
let autoBot = null;          // ?debug=1 autoplay
let pendingCmd = null;       // a menu choice waiting for the next sim step
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let wasRunning = false;
const seen = {};             // a count of every sim event drained during play, for the tests

function attractGame() { return newGame(((Math.random() * 1e6) | 0) + 1, Math.floor(Math.random() * 3)); }

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !hasSave();
    const b = loadBest();
    document.getElementById('best').textContent = b ? `Best score: ${b.score.toLocaleString('en-US')}${b.won ? ' ★ finished the season' : ''}` : '';
}
refreshTitle();
ui.openScreen('title');
audio.wantSong = 'theme';

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(DEBUG && params.get('seed') ? +params.get('seed') : ((Date.now() % 1e9) | 0)));
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
document.getElementById('brief-go').addEventListener('click', () => { audio.ui('click'); send({ t: 'go' }, 'brief'); });
document.getElementById('over-continue').addEventListener('click', () => { audio.ui('click'); send({ t: 'continue' }, 'over'); });
document.getElementById('over-menu').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('won-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0)); });

/** Close a screen and hand its choice to the sim on the next step. */
function send(cmd, screen) {
    pendingCmd = cmd;
    if (screen) ui.closeScreen(screen);
    document.activeElement?.blur?.();
}

function startGame(g) {
    G = g;
    ui.closeAll();
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    pendingCmd = null;
    input.flush();
    view.ready = false;
    view.parts.length = 0; view.pops.length = 0;
    audio.setHum(false);
    syncScreens();
    updateTouch();
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    ui.showHud(false);
    audio.setHum(false);
    G = attractGame();
    view.ready = false;
    pendingCmd = null;
    refreshTitle();
    ui.openScreen('title');
    audio.playSong('theme');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen() || G.phase !== 'play') return;
    audio.ui('open');
    audio.setHum(false);
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
const beamBtn = document.getElementById('btn-beam');
input.bindHold(beamBtn, (on) => { input.setTouchBeam(on); beamBtn.classList.toggle('on', on); });
input.bindButton(document.getElementById('btn-drop'), () => input.pressDrop());

/** Open whichever screen the sim's phase calls for, if none is up. */
function syncScreens() {
    if (mode !== 'play' || pendingCmd) return;
    ui.showHud(G.phase === 'play');
    if (ui.anyScreen()) return;
    if (G.phase === 'brief') { ui.showBrief(G); audio.playSong('theme'); }
    else if (G.phase === 'report') { ui.showReport(G, (cmd) => send(cmd, 'report')); audio.playSong('report'); }
    else if (G.phase === 'over') { clearSave(); saveBest(G.score, false); ui.showOver(G); audio.stopSong(); }
    else if (G.phase === 'won') { clearSave(); saveBest(G.score, true); ui.showWon(G); audio.playSong('theme'); }
    else if (G.phase === 'play') audio.playSong(LEVELS[G.level].boss ? 'boss' : 'play');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ['pause', 'howto', 'settings'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    if (mode !== 'play') return;              // the attract demo is seen, not heard
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(G, ev);
    ui.onEvents(G, ev, pick);
    if (ev.some((e) => ['report', 'level', 'go', 'over', 'won', 'continue'].includes(e.type))) {
        if (ev.some((e) => e.type === 'report' || e.type === 'level')) saveGame(G);
        syncScreens();
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    if (mode === 'play' && !ui.anyScreen() && !pendingCmd && G.phase !== 'play') syncScreens();

    const running = mode === 'title' || (mode === 'play' && !ui.anyScreen());
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = mode === 'title' ? botInput(G, bot, STEP) : autoBot ? botInput(G, autoBot, STEP) : input.state();
            if (pendingCmd && mode === 'play') { inp.cmd = pendingCmd; pendingCmd = null; }
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
            if (G.events.length > 64) flushEvents();
        }
        if (mode === 'title' && (G.phase === 'over' || G.phase === 'won')) G = attractGame();
        if (mode === 'play' && G.phase === 'play') {
            saveT += dt;
            if (saveT > 20) { saveT = 0; saveGame(G); }
        }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G, dt);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__uo = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Skip the title: a fresh game at episode `lvl`, on its episode card (or in play with go = true). */
        start(seed = 1, lvl = 0, go = false) { startGame(newGame(seed, lvl)); if (go) send({ t: 'go' }, 'brief'); return G; },
        autoplay(on = true) { autoBot = on ? makeBot({ seed: 3 }) : null; },
        /** Run the sim ahead synchronously with the bot flying; events reach the view as usual. */
        ff(sec) { const b = makeBot({ seed: 4 }); for (let t = 0; t < sec && G.phase === 'play'; t += STEP) step(G, botInput(G, b, STEP), STEP); flushEvents(); },
        /** The bot plays the current episode out to its report card. */
        finish() { const b = makeBot({ seed: 4 }); for (let t = 0; t < 400 && G.phase === 'play'; t += STEP) step(G, botInput(G, b, STEP), STEP); flushEvents(); return G.phase; },
        cmd(c) { pendingCmd = c; },
        /** Painted art: { total, ok, failed }. Recorded audio: buffers decoded, files that failed, what's playing. */
        art: () => artStatus(),
        sound: () => ({ sfx: Object.keys(audio.buf || {}).length, voices: Object.keys(audio.voiceBuf || {}).length, failed: audio.failed || [], playing: audio.nowPlaying?.() }),
        save: () => saveGame(G),
        hasSave,
    };
}
