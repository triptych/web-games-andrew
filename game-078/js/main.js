// Sugarplum Drop — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title (with the bot playing a demo behind it), play, pause and
// game over.
//
// ?debug=1 exposes window.__sd for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, loadBest, saveBest, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, addBody } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
let best = loadBest();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
view.snowOn = settings.snow !== 'off';
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.snowOn = s.snow !== 'off'; },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
input.bindCanvas(document.getElementById('view'));

let G = null;
let mode = 'title';          // title | play | over
let demoBot = null;
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests
const freshSeed = () => (Date.now() % 1e9) | 0;

function newDemo() {
    G = newGame(DEBUG ? 1 : freshSeed());
    demoBot = makeBot({ skill: 0.85, seed: G.seed, think: 0.45 });
}

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !hasSave();
    ui.setBest(best);
}
newDemo();
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); audio.startMusic(); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame(freshSeed()));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else { ui.toast('That save could not be read.'); clearSave(); refreshTitle(); }
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
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame(freshSeed())); });
document.getElementById('over-title').addEventListener('click', () => { audio.ui('click'); toTitle(); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    view.parts.length = 0;
    view.texts.length = 0;
    input.flush();
    ui.showHud(true);
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    newDemo();
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
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

function playerInput() {
    const s = input.state();
    const aim = s.aimClient === null ? null : view.toWorld(s.aimClient, 0).x;
    return { dx: s.dx, aim, drop: s.drop };
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    if (mode === 'title') return;              // the demo is seen, not heard
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (mode === 'play' && ev.some((e) => e.type === 'over')) gameOver();
}

function gameOver() {
    mode = 'over';
    clearSave();
    refreshTitle();
    const isNew = G.score > best.score;
    best = { score: Math.max(best.score, G.score), tier: Math.max(best.tier, G.topTier) };
    saveBest(best);
    ui.showHud(false);
    ui.showOver(G, best, isNew && G.score > 0);
    ui.openScreen('over');
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const playing = mode === 'play' && !ui.anyScreen();
    // coming back from a menu: the key or tap that closed it must not also drop a treat
    if (playing && !wasRunning) input.flush();
    wasRunning = playing;
    if (playing || mode === 'title') {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            if (mode === 'title') step(G, botInput(G, demoBot, STEP), STEP);
            else {
                step(G, bot ? botInput(G, bot, STEP) : playerInput(), STEP);
                input.consumeEdges();         // only once a step has seen them
            }
            acc -= STEP;
            n++;
        }
        if (mode === 'title' && G.over) newDemo();
        if (playing) {
            saveT += dt;
            if (saveT > 15) { saveT = 0; saveGame(G); }
        }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G, best);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__sd = {
        get G() { return G; },
        get mode() { return mode; },
        get best() { return best; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot({ seed: 3 }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot({ seed: 5 }); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b, STEP), STEP); flushEvents(); },
        /** Put a treat in the jar (tests and screenshots). */
        place(tier, x, y) { return addBody(G, tier, x, y).id; },
        save: () => saveGame(G),
        hasSave,
    };
}
