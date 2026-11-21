// VACANCY — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and moves between
// the title, the waking, play, reading, pause and the end.
//
// ?debug=1 exposes window.__va for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low|medium|high
// forces the picture quality; &seed=N starts that city straight away.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, objective } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { seedFromText } from './rng.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const coarse = window.matchMedia?.('(pointer: coarse)').matches;
const quality = params.get('q') || (settings.quality === 'auto' ? (coarse ? 'low' : 'medium') : settings.quality);
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const canvas = document.getElementById('view');
const input = new Input(canvas);
input.sens = settings.sens; input.invert = settings.invert;
const view = new View(canvas, quality);
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); input.sens = s.sens; input.invert = s.invert; updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let G = null;
let mode = 'title';          // title | loading | intro | play | over
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null, wasRunning = false, flash = true;
const seen = {};
const $ = (id) => document.getElementById(id);

const INTRO = 'You wake on a bare mattress that smells of rain.\n\nThe ceiling has come down in one corner. Grey light leaks through the boards over the window. Nothing in the house makes a sound; nothing outside does either. No traffic. No birds.\n\nOn the nightstand, where you must have left them, are a heavy flashlight and an old brass compass. The compass needle is not pointing north. It is pointing at something.';

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') begin(newSeed(), true);
    else if (act === 'seed') begin($('seed-input').value.trim() ? seedFromText($('seed-input').value) : newSeed(), true);
    else if (act === 'continue') {
        const g = loadGame();
        if (g) begin(g, false); else ui.toast('That journey could not be read.');
    } else ui.openScreen(act);
});
$('seed-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); begin(seedFromText(e.target.value || String(newSeed())), true); } });
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else if (act === 'journal') openJournal();
    else if (act === 'map') openMap();
    else ui.openScreen(act);
});
$('btn-pause').addEventListener('click', () => pause());
$('btn-journal').addEventListener('click', () => openJournal());
$('btn-map').addEventListener('click', () => openMap());
$('intro-go').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('intro'); play(); });
$('over-again').addEventListener('click', () => { audio.ui('click'); begin(newSeed(), true); });

function newSeed() { return (Date.now() % 1e9) >>> 0; }

/** Build a city (behind the loading screen), then wake up in it. */
function begin(gOrSeed, fresh) {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'loading';
    ui.showHud(false);
    $('loading-msg').textContent = 'Waking up…';
    ui.openScreen('loading');
    // two frames so the loading screen paints before the city is built
    requestAnimationFrame(() => requestAnimationFrame(() => {
        G = typeof gOrSeed === 'number' ? newGame(gOrSeed) : gOrSeed;
        view.setGame(G);
        view.warm(G, DEBUG ? 600 : 2500);
        ui.closeScreen('loading');
        saveGame(G);
        if (fresh) { $('intro-text').textContent = INTRO; mode = 'intro'; ui.openScreen('intro'); }
        else play();
    }));
}

function play() {
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    requestLock();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    input.releaseMouse();
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    $('pause-seed').textContent = `City seed ${G.seed}`;
    input.releaseMouse();
    ui.openScreen('pause');
}
function openJournal() { if (mode !== 'play') return; audio.ui('open'); input.releaseMouse(); ui.renderJournal(G); ui.openScreen('journal'); }
function openMap() { if (mode !== 'play') return; audio.ui('open'); input.releaseMouse(); ui.renderMap(G); ui.openScreen('map'); }

function requestLock() {
    input.wantLock = !(input.lastDevice === 'touch' || ui.touchOn);
    if (input.wantLock && document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
}
canvas.addEventListener('click', () => { if (mode === 'play' && !ui.anyScreen()) requestLock(); });
document.addEventListener('pointerlockchange', () => {
    // the browser's own Escape releases the mouse: treat that as a pause
    if (!document.pointerLockElement && mode === 'play' && !ui.anyScreen() && input.wantLock) pause();
});

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindLook($('look-zone'));
input.bindButton($('btn-use'), () => input.pressA());
input.bindButton($('btn-run'), () => { input.touchRun = !input.touchRun; $('btn-run').classList.toggle('on', input.touchRun); });
input.bindButton($('btn-light'), () => toggleFlash());
function toggleFlash() { flash = !flash; view.setFlashlight(flash); audio.tone({ freq: 1800, dur: 0.03, type: 'square', vol: 0.04, verb: 0 }); }

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP' || (key === 'KeyJ' && top === 'journal') || (key === 'KeyM' && top === 'map')) && !['title', 'over', 'intro', 'loading'].includes(top)) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyJ' || key === 'Tab') openJournal();
    else if (key === 'KeyM') openMap();
    else if (key === 'KeyF') toggleFlash();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    const d = ev.find((e) => e.type === 'diary');
    if (d && !bot) { input.releaseMouse(); ui.showDiary(G, d.k); }
    if (ev.some((e) => e.type === 'diary' || e.type === 'item')) saveGame(G);
    if (ev.some((e) => e.type === 'won')) {
        mode = 'over';
        clearSave();
        ui.showHud(false);
        input.releaseMouse();
        ui.showEnding(G);
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    const running = (mode === 'play' || (mode === 'over' && false)) && !ui.anyScreen() && G;
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot, STEP) : input.state(dt);
            step(G, inp, STEP);
            input.consumeEdges();
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
        ui.setLockHint(input.wantLock && document.pointerLockElement !== canvas && !input.drag);
    } else acc = 0;
    // the ending keeps playing out behind its card
    if (mode === 'over' && G && G.portal > 0 && !G.won) step(G, { x: 0, y: 0, a: false }, dt);
    flushEvents();
    if (G && mode !== 'title') {
        view.frame(G, dt, time, { pitch: input.pitch });
        if (mode === 'play') ui.hud(G, dt);
        const lamp = view.lightList?.find((l) => !l.street && !l.diary && !l.neon);
        const ld = lamp ? Math.hypot(lamp.x - G.p.x, lamp.z - G.p.z) : 99;
        audio.setScene({ inside: view.inside ?? 0, buzz: Math.max(0, 1 - ld / 9), ring: G.power ? Math.max(0, 1 - view.camera.position.distanceTo(view.ringPos) / 40) : 0 }, dt);
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play' && G) saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

if (params.get('seed') && DEBUG) begin(+params.get('seed'), false);

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__va = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Start a city and skip the title and the waking. */
        start(seed = 1) { begin(seed, false); },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !G.won; t += STEP) { step(G, botInput(G, b, STEP), STEP); } flushEvents(); },
        /** Stand next to the compass's target (or a thing by id), facing it. */
        tp(id) {
            const t = id ? G.thingById.get(id) : objective(G);
            const p = G.p;
            p.L = t.L; p.x = t.x; p.z = t.z + 1.2; p.yaw = 0; p.air = false;
            p.y = t.L * (G.city.buildings[t.b]?.h ?? 0);
            view.camY = p.y + 1.62;
            view.update(G, 0, true);
        },
        look(pitch) { input.pitch = pitch; },
        save: () => saveGame(G),
        hasSave,
        objective: () => objective(G),
    };
}
