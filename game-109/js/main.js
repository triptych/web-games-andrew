// STARBLAZER '86 — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title (an attract-mode demo plays behind it), play, pause and game over.
//
// ?debug=1 exposes window.__sb for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadScores, qualifies, addHighScore } from './save.js';
import { newGame, step, jumpToWave, enterDock, buy, launch } from './sim/game.js';
import { waveLine, reaction, overLine, dockLine, preBossScene, dockScene } from './story.js';
import { makeBot, botInput } from './sim/bot.js';

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
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let hi = loadScores()[0].s;
let G = demoGame();          // the title screen shows a bot playing in the background
let mode = 'title';          // title | play | over
let acc = 0;
let last = performance.now();
let saveT = 0;
let bot = makeBot({ skill: 0.85 });     // drives the title demo
let autoBot = null;                     // the debug hook's autoplay
let wasRunning = false;
let hushed = false;
const seen = {};             // a count of every sim event drained, for the tests
let lastComm = -99;          // when Mira last spoke (view time), so her reactions are rationed

// ------------------------------------------------------------------ the story
const storyOn = () => settings.story !== 'off';

/** Play a cutscene (Mira over a painted scene); with the story off, go straight to what follows. */
function playStory(id, onDone) {
    if (!storyOn()) { onDone?.(); return; }
    audio.hush(true);                      // the game is paused behind it; this also stops the announcer
    ui.openStory(id, G.wave, {
        draw: (c, scene, t, o) => view.drawStoryScene(c, scene, t, o),
        speak: (text) => audio.sayMira(text),
        onDone: () => { audio.shush(); onDone?.(); },
    });
}

/** Mira in the comm strip. Reactions are rationed; a wave's own line always goes out. */
function comm({ text, mood }, always = true) {
    if (!storyOn() || (!always && view.time - lastComm < 9)) return;
    lastComm = view.time;
    view.comm(text, mood);
}

/** What the story does with this batch of sim events. */
function storyEvents(ev) {
    if (!storyOn()) return;
    for (const e of ev) {
        if (e.type === 'wave') {
            const scene = e.kind === 'boss' ? preBossScene(e.n) : null;
            if (scene) playStory(scene);
            else {
                comm(waveLine(e.n, e.kind, G.seed));
                if (G.lives === 1 && e.n > 1) view.comm(reaction('lowlives', e.n, G.seed).text, 'worry');
            }
        } else if (e.type === 'pdie') comm(reaction('pdie', G.wave, G.seed + seen.pdie), false);
        else if (e.type === 'waveclear' && e.perfect && e.kind !== 'bonus') comm(reaction('perfect', G.wave, G.seed + (seen.waveclear || 0)), false);
        else if (e.type === '1up') comm(reaction('oneup', G.wave, G.seed), false);
    }
}

/** The shop opens: first a cutscene on the big occasions, otherwise a quip from Mira on the screen. */
function openHangar() {
    const open = () => { ui.openDock(G); saveGame(G); };
    const scene = dockScene(G.wave);
    const quip = document.getElementById('dock-quip');
    quip.hidden = !storyOn() || !!scene;
    if (!quip.hidden) quip.textContent = dockLine(G.wave, G.seed);
    if (scene && storyOn()) playStory(scene, open); else open();
}

function demoGame() { return newGame((Date.now() % 1e9) | 0); }
const freshGame = () => newGame((Date.now() % 1e9) | 0);

// ------------------------------------------------------------------ settings
function applySettings() {
    audio.setVolumes(settings.sfx, settings.music);
    audio.setVoice(settings.voice !== 'off');
    view.setOptions({ crt: settings.crt === 'on', calm: settings.effects === 'calm' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });
    updateTouch();
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    const auto = settings.autofire === 'on' || (settings.autofire === 'auto' && on);
    input.autofire = auto && mode === 'play';
    ui.setTouch(on, undefined, auto);
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindFire(document.getElementById('btn-a'));
input.bindButton(document.getElementById('btn-b'), () => input.pressBomb());

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !hasSave();
    hi = loadScores()[0].s;
    ui.setHi(hi);
}
refreshTitle();
applySettings();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(freshGame(), false, true);
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g, true); else ui.toast('That save could not be read.');
    } else if (act === 'scores') ui.showScores(loadScores());
    else ui.openScreen(act);
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
for (const id of ['dock-list', 'dock-supplies']) {
    document.getElementById(id).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-buy]');
        if (!b || b.disabled) return;
        if (buy(G, b.dataset.buy)) ui.renderDock(G); else audio.ui('close');
    });
}
document.getElementById('story-next').addEventListener('click', () => ui.storyNext());
document.getElementById('story-skip').addEventListener('click', () => ui.storyEnd());
document.getElementById('story-scene').addEventListener('click', () => ui.storyNext());
document.getElementById('story-text').addEventListener('click', () => ui.storyNext());
document.getElementById('dock-go').addEventListener('click', () => {
    ui.closeScreen('dock');
    if (launch(G)) saveGame(G);
});
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(freshGame()); });      // (no intro again)
document.getElementById('over-quit').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('over-entry').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('over-name').value;
    settings.name = (name || 'AAA').toUpperCase().slice(0, 3);
    saveSettings(settings);
    const { table, rank } = addHighScore(name, G.score, G.wave);
    hi = table[0].s;
    audio.ui('start');
    ui.showOverTable(table, rank);
});

/** Tell the audio what the current wave is (a loaded game never emitted the event). */
function announceWave() {
    audio.onEvents(G, [{ type: 'wave', n: G.wave, kind: G.plan.kind, boss: G.plan.boss ? G.plan.boss.idx : -1 }]);
}

function startGame(g, resumed = false, intro = false) {
    G = g;
    ui.storyAbort();
    view.clearComms();
    lastComm = -99;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    view.fx.reset();
    view.stars.sector = -1;
    input.flush();
    ui.showHud(true);
    applySettings();
    audio.ui('start');
    if (intro) playStory('intro');
    if (resumed) {
        G.events.length = 0;
        if (G.phase === 'dock' && G.dock?.st === 'shop') ui.openDock(G); else announceWave();     // a game saved in the hangar comes back to it
    }
    saveGame(G);
}

function toTitle() {
    ui.storyAbort();
    view.clearComms();
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    audio.setMusic('off');
    G = demoGame();
    bot = makeBot({ skill: 0.85 });
    view.fx.reset();
    view.stars.sector = -1;
    input.flush();
    applySettings();
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
// Keyboard in cutscenes. The game's own keys are the way through: Z, J, Space, Enter or → advance a line
// (the first press finishes the typing), X, Esc or P skip the scene. This runs first and swallows the key,
// so a press cannot also click a focused button (a double step) or count as a shot, and a held key does not
// race through the lines.
window.addEventListener('keydown', (e) => {
    if (!ui.storyOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const next = ['KeyZ', 'KeyJ', 'Space', 'Enter', 'NumpadEnter', 'ArrowRight'].includes(e.code);
    const skip = ['Escape', 'KeyX', 'KeyP'].includes(e.code);
    if (!next && !skip) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (next) ui.storyNext(); else ui.storyEnd();
}, { capture: true });

/** Can Esc / X close this screen? (The title, the game-over sheet, the hangar and cutscenes have their own ways out.) */
const closable = () => !['title', 'over', 'dock', 'story'].includes(ui.top());

/** Press the focused button (what Enter and Space do natively, on the game's own keys too). */
function pressFocused() {
    const el = document.activeElement;
    if (el && el.tagName === 'BUTTON' && !el.disabled) el.click();
}

function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        // menus and dialogs, all by keyboard: arrows or W/S move, Z / J / Enter press the focused button,
        // X / Esc / P go back, and L launches from the hangar
        if (key === 'ArrowDown' || key === 'KeyS') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'KeyW') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP' || key === 'KeyX') && closable()) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'KeyZ' || key === 'KeyJ' || (key === 'Enter' && press.pad)) pressFocused();
        else if (key === 'KeyL' && ui.top() === 'dock') document.getElementById('dock-go').click();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    if (mode === 'title') {              // the demo is for the eyes only
        view.onEvents(G, ev);
        return;
    }
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    storyEvents(ev);
    if (ev.some((e) => e.type === 'dockopen')) openHangar();
    if (ev.some((e) => e.type === 'over')) {
        mode = 'over';
        clearSave();
        ui.showHud(false);
        input.autofire = false;
        const q = document.getElementById('over-quip');
        q.hidden = !storyOn();
        q.textContent = overLine(G.wave, G.seed);
        const entry = qualifies(G.score);
        const table = entry ? null : loadScores();
        ui.showOver(G, entry, settings.name, table);
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handlePresses();

    if (mode === 'title') {
        // attract mode: the bot plays on behind the title, and starts again when it dies
        if (G.over) { G = demoGame(); bot = makeBot({ skill: 0.85 }); view.fx.reset(); view.stars.sector = -1; }
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12) { step(G, botInput(G, bot), STEP); acc -= STEP; n++; }
        if (n >= 12) acc = 0;
    } else {
        const running = mode === 'play' && !ui.anyScreen();
        // back from a menu: the key or tap that closed it must not also act in the game
        if (running && !wasRunning) input.flush();
        wasRunning = running;
        if (running) {
            acc += dt * FAST;
            let n = 0;
            while (acc >= STEP && n < 12 * FAST) {
                const inp = autoBot ? botInput(G, autoBot) : input.state();
                step(G, inp, STEP);
                input.consumeEdges();             // only once a step has seen them
                acc -= STEP;
                n++;
            }
            saveT += dt;
            if (saveT > 20) { saveT = 0; saveGame(G); }
        } else acc = 0;
    }
    flushEvents();

    const quiet = mode !== 'play' || ui.anyScreen();
    if (quiet !== hushed) { hushed = quiet; audio.hush(quiet); }
    view.frame(G, dt, { mode, hi, paused: mode === 'play' && ui.anyScreen() });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__sb = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, settings,
        start(seed = 1, intro = false) { startGame(newGame(seed), false, intro); return G; },
        /** Play a cutscene now (intro, boss0, dock0, boss1, boss2, finale). */
        story(id, onDone) { playStory(id, onDone); },
        autoplay(on = true, skill = 1) { autoBot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, skill = 1) { const b = makeBot({ skill }); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        /** Fly to the mothership now (as after a boss). */
        dock() { enterDock(G); flushEvents(); },
        /** Cut to wave n. */
        wave(n) { jumpToWave(G, n); flushEvents(); },
        /** Put a bullet on the ship so it dies (down to its last life if `last`). */
        die(last = false) { const p = G.player; if (last) G.lives = 1; p.inv = 0; G.ebullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, k: 0 }); },
        save: () => saveGame(G),
        hasSave,
    };
}
