// NEBULA REQUIEM — entry point. Boots the view, runs the fixed-step simulation, routes input and events, plays the
// story's scenes, and moves between the title (with a live attract demo behind it), play, game over and results.
//
// ?debug=1 exposes window.__nr for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low forces low quality.

import { STEP, MAX_FRAME, SAVE_KEY, VERSION } from './config.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadScores, addScore, hiScore, loadSeen, markSeen } from './save.js';
import { newGame, step } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { STAGES } from './sim/data/world.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
if (params.get('q') === 'low') settings.quality = 'low';
const audio = new Audio();
audio.setVolumes(settings);
const input = new Input();
const view = new View(document.getElementById('view'), { quality: settings.quality });
view.setQuality(settings.calm || matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s); updateTouch(); view.setQuality(s.calm); if (s.quality !== view.stage.quality) ui.toast('Graphics change applies after a reload'); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let G = attractGame();
let mode = 'title';           // title | play | done
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null;
let attractBot = makeBot({ skill: 1, seed: 3 });
let wasRunning = false;
let pending = { done: false, cont: false };
let seenScenes = loadSeen();
let hi = hiScore();
const seen = {};

function attractGame() {
    const pilots = ['sora', 'kaito', 'lyra'];
    const g = newGame(((Date.now() / 1000) | 0) % 9973, { pilot: pilots[(Date.now() / 7000 | 0) % 3], skipIntro: true, stage: (Date.now() / 13000 | 0) % 2 });
    g.god = true;
    return g;
}

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-144'.
// The save is everything stored under its save key (settings stay on the device); loading writes it back and reloads.
const cloud = makeCloud({ game: 'game-144' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'play') saveGame(G); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const d = snapValue(snap, SAVE_KEY)?.data; return d ? `Wave ${d.wave ?? 1} · ${(d.score ?? 0).toLocaleString('en-US')} points` : 'A NEBULA REQUIEM game'; },
    hasGame: () => (mode === 'play') || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();
audio.music.want = 'title';

const unlock = () => { const first = !audio.ctx; audio.init(); if (first) audio.playMusic(mode === 'title' ? 'title' : audio.music.want, true); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'story' || act === 'endless') ui.openSelect(act);
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read');
    } else if (act === 'scores') ui.showScores(loadScores());
    else if (act === 'cloud') cloudUI.open();
    else ui.openScreen(act);
});
document.getElementById('select-go').addEventListener('click', () => {
    audio.ui('click');
    startGame(newGame((Date.now() % 1e9) | 0, { mode: ui.sel.mode, pilot: ui.sel.pilot, diff: ui.sel.diff }));
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); cloudUI.autosave({ force: true }); toTitle(); }
    else if (act === 'cloud') cloudUI.open();
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('over-cont').addEventListener('click', () => { audio.ui('click'); pending.cont = true; ui.closeScreen('over'); });
document.getElementById('over-quit').addEventListener('click', () => { audio.ui('click'); pending.done = true; ui.closeScreen('over'); });
document.getElementById('results-ok').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('scene-skip').addEventListener('click', (e) => { e.stopPropagation(); ui.skipScene(); });
document.getElementById('scene').addEventListener('pointerdown', (e) => { if (e.target.id !== 'scene-skip') { e.preventDefault(); ui.nextLine(); } });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    bot = null;
    input.flush();
    pending = { done: false, cont: false };
    ui.showHud(true);
    updateTouch();
    view.sky.id = null;                  // the view picks the run's stage up on its next frame
    audio.playMusic(G.mode === 'endless' ? 'endless' : STAGES[G.stage].music);
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    if (ui.inScene()) ui.skipScene();
    mode = 'title';
    ui.showHud(false);
    G = attractGame();
    attractBot = makeBot({ skill: 1, seed: 3 });
    view.sky.id = null;
    refreshTitle();
    ui.openScreen('title');
    audio.playMusic('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen() || ui.inScene()) return;
    audio.ui('open');
    saveGame(G);
    const p = G.player;
    document.getElementById('pause-gear').textContent = `Power ${p.power} · options ${p.options} · rockets ${p.rockets} · shield ${p.shield} · warp ${p.warpMax} · halo ${p.halo}`;
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('t-bomb'), () => input.press('bomb'));
input.bindButton(document.getElementById('t-warp'), () => input.press('warp'));
input.bindButton(document.getElementById('t-burst'), () => input.press('burst'));
input.bindHold(document.getElementById('t-focus'), (on) => { input.touchFocus = on; });

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.inScene()) {
        if (key === 'Escape') ui.skipScene();
        else if (['Enter', 'Space', 'KeyZ', 'KeyX', 'NumpadEnter'].includes(key)) ui.nextLine();
        return;
    }
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'over', 'results'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ scenes and events
function runScenes() {
    if (mode !== 'play' || G.phase !== 'talk' || ui.inScene() || pending.done) return;
    const id = G.talk;
    if (settings.scenes === 'skip' && seenScenes.has(id + ':' + G.pilot)) { pending.done = true; return; }
    if (id.endsWith('-end')) audio.playMusic('ending');
    ui.playScene(id, G.pilot, () => { markSeen(id + ':' + G.pilot); seenScenes.add(id + ':' + G.pilot); pending.done = true; input.flush(); });
}

function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (mode !== 'play') return;
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'stage' || e.type === 'theme') audio.playMusic(G.mode === 'endless' ? 'endless' : STAGES[G.stage].music);
        if (e.type === 'bossDie') setTimeout(() => { if (mode === 'play' && G.mode === 'story' && !G.boss) audio.playMusic(STAGES[G.stage].music); }, 4500);
        if (e.type === 'gameover') {
            clearSave();
            ui.showHud(true);
            ui.gameOver(G, G.mode === 'story');
            audio.playMusic(null);
        }
        if (e.type === 'final' || e.type === 'won') {
            mode = 'done';
            clearSave();
            const rank = addScore(G.mode, { score: G.score, pilot: G.pilot, note: G.mode === 'endless' ? `wave ${G.wave}` : G.won ? 'cleared' : `stage ${G.stage + 1}`, at: Date.now() });
            hi = hiScore();
            ui.showHud(false);
            ui.results(G, e.type === 'won' ? 'Mission Complete' : G.mode === 'endless' ? 'Survival Over' : 'Game Over');
            if (rank) ui.toast(`High score #${rank}`);
            if (e.type === 'won') audio.playMusic('ending');
        }
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    runScenes();
    ui.tickScene(dt);

    const running = (mode === 'play' && !ui.anyScreen() && !ui.inScene()) || mode === 'title';
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            let inp;
            if (mode === 'title') inp = botInput(G, attractBot);
            else if (bot) inp = { ...botInput(G, bot), ...(pending.done ? { done: true } : {}), ...(pending.cont ? { cont: true } : {}) };
            else inp = { ...input.state(), done: pending.done, cont: pending.cont };
            step(G, inp, STEP);
            input.consumeEdges();
            pending.done = pending.cont = false;
            acc -= STEP;
            n++;
            if (G.events.length > 200) flushEvents();
        }
        if (mode === 'title' && (G.over || G.phase === 'over' || G.t > 150)) { G = attractGame(); attractBot = makeBot({ skill: 1, seed: 3 }); view.sky.id = null; }
        saveT += dt;
        if (mode === 'play' && saveT > 20 && G.phase === 'play') { saveT = 0; saveGame(G); cloudUI.autosave(); }
    } else acc = 0;
    flushEvents();
    if (mode === 'play') audio.frame(G);
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G, hi);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); cloudUI.autosave({ keepalive: true }); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__nr = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Start a run directly (skips the title and select screens). */
        start(seed = 1, opts = {}) { startGame(newGame(seed, { skipIntro: true, ...opts })); return G; },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !G.over && G.phase !== 'over'; t += STEP) { step(G, botInput(G, b), STEP); if (G.events.length > 200) flushEvents(); } flushEvents(); },
        god(on = true) { G.god = on; },
        save: () => saveGame(G),
        hasSave,
    };
}
