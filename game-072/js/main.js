// RUNEBORE — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, play, scenes, shops and the ending.

import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, saveInfo, clearSave } from './save.js';
import { newGame, step, travel, finishEnding, useItem } from './sim/game.js';
import { playScene, EPILOGUE } from './sim/story.js';
import { makeBot, botInput } from './sim/bot.js';
import { ITEMS } from './config.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, +(params.get('fast') || 1)) : 1;
const STEP = 1 / 120;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const canvas = document.getElementById('gl');
const view = new View(canvas, { quality: settings.quality });
view.shakeK = settings.shake ? 1 : 0;

const ui = new UI({
    audio, input, settings,
    onSettings: (s, extra) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        if (view.quality !== s.quality) view.setQuality(s.quality);
        view.shakeK = s.shake ? 1 : 0;
        if (extra?.deleteSave) { clearSave(); ui.titleInfo(null); }
        updateTouch();
    },
});

let G = newGame(7, 'Rook');      // the title screen shows the town with Thimble parked by the Spire
let mode = 'title';              // title | play | ending
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
ui.G = G;

// ------------------------------------------------------------------
// Title and menus
// ------------------------------------------------------------------
ui.titleInfo(saveInfo());
document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.init();
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'continue') continueGame();
    else if (act === 'new') { ui.openScreen('newgame'); setTimeout(() => document.getElementById('name-input').focus(), 50); }
    else ui.openScreen(act);
});
document.getElementById('newgame-back').addEventListener('click', () => { audio.ui('close'); ui.closeScreen('newgame'); });
document.getElementById('newgame-go').addEventListener('click', () => startNew());
document.getElementById('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') startNew(); });

document.querySelector('#pause .menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'journal') { ui.closeScreen('pause'); ui.openJournal(G); }
    else if (act === 'quit') { saveGame(G); ui.closeScreen('pause'); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => { audio.ui('open'); if (mode === 'play') ui.openScreen('pause'); });
document.getElementById('btn-journal').addEventListener('click', () => { audio.ui('open'); if (mode === 'play') ui.openJournal(G); });
document.getElementById('btn-enter').addEventListener('click', () => enterHere());

function startNew() {
    const name = (document.getElementById('name-input').value || 'Rook').trim().replace(/[<>]/g, '').slice(0, 16) || 'Rook';
    audio.init();
    audio.ui('click');
    const seed = DEBUG && params.get('seed') ? +params.get('seed') : (Date.now() % 1e9) | 0;
    G = newGame(seed, name);
    ui.closeScreen('newgame');
    beginPlay();
    playScene(G, 'prologue');
    saveGame(G);
}

function continueGame() {
    const g = loadGame();
    if (!g) { ui.toast('That save could not be read.'); return; }
    G = g;
    beginPlay();
    ui.toast(`Welcome back, ${G.name}.`);
}

function beginPlay() {
    ui.G = G;
    ui.closeScreen('title');
    mode = 'play';
    acc = 0;
    view.snapCam = true;
    input.clear();
    ui.showHud(true);
    updateTouch();
}

function toTitle() {
    mode = 'title';
    ui.showHud(false);
    G = newGame(7, 'Rook');
    ui.G = G;
    view.snapCam = true;
    ui.titleInfo(saveInfo());
    ui.openScreen('title');
}

// ------------------------------------------------------------------
// Buildings, travel, items
// ------------------------------------------------------------------
function enterHere() {
    if (mode !== 'play' || !G.at || G.rig.drill || ui.anyScreen() || ui.inScene()) return;
    audio.init();
    ui.openPanel(G, G.at);
}
ui.onTravel = (dest) => {
    if (travel(G, dest)) { flushEvents(); saveGame(G); }
};
ui.canUseItems = () => mode === 'play' && !ui.anyScreen() && !ui.inScene();
ui.onScreenClosed = (id) => { if (id === 'panel' || id === 'journal') saveGame(G); };
ui.onSceneDone = (id) => {
    if (id === 'ending_stay' || id === 'ending_rest') startEpilogue();
    if (ui.panelKey) ui.renderPanel();
    saveGame(G);
};
ui.onChoice = () => flushEvents();

function startEpilogue() {
    mode = 'ending';
    ui.showHud(false);
    const choice = G.story.flags.endingChoice === 'rest' ? 'rest' : 'stay';
    ui.cards([...EPILOGUE.common, ...EPILOGUE[choice]], () => {
        ui.endingSheet(G, () => {
            finishEnding(G);
            flushEvents();
            mode = 'play';
            ui.showHud(true);
            updateTouch();
            saveGame(G);
        });
    });
}

function updateTouch() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    if (mode === 'play') ui.setTouch(on); else ui.touchOn = on;
}
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && input.lastDevice !== 'touch') { input.lastDevice = 'touch'; updateTouch(); } audio.init(); }, { capture: true });

// ------------------------------------------------------------------
// Input routing
// ------------------------------------------------------------------
function handleKeys() {
    for (const { key } of input.drain()) {
        if (key !== 'Escape') audio.init();
        if (ui.cardsNext && ui.topScreen() === 'cards') { if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(key)) ui.cardsNext(); continue; }
        if (ui.scene) {
            if (['Space', 'Enter', 'KeyE', 'NumpadEnter', 'Escape', 'ArrowDown', 'KeyS'].includes(key)) ui.advance();
            continue;
        }
        if (ui.anyScreen()) {
            const top = ui.topScreen();
            if (key === 'Escape' && top !== 'title' && top !== 'ending') { audio.ui('close'); ui.closeTop(); }
            else if (key === 'KeyE' && top === 'panel') ui.closePanel();
            else if (key === 'KeyJ' && top === 'journal') ui.closeTop();
            else if (key === 'KeyP' && top === 'pause') ui.closeTop();
            continue;
        }
        if (mode !== 'play') continue;
        if (key === 'Escape' || key === 'KeyP') { audio.ui('open'); ui.openScreen('pause'); }
        else if (key === 'KeyE' || key === 'Enter' || key === 'NumpadEnter') enterHere();
        else if (key === 'KeyJ' || key === 'Tab') { audio.ui('open'); ui.openJournal(G); }
        else if (key === 'KeyM') { audio.ui('open'); ui.openJournal(G, 'map'); }
        else if (/^Digit[1-5]$/.test(key)) ui.useItem(ITEMS[+key.slice(5) - 1].key);
    }
}

// ------------------------------------------------------------------
// Events
// ------------------------------------------------------------------
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev, view);
    for (const e of ev) if (e.type === 'scene') ui.queueScene(e.id);
    if (!view.shakeK) view.fx.shake = 0;
}

// ------------------------------------------------------------------
// Frame loop
// ------------------------------------------------------------------
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    handleKeys();

    const sceneUp = ui.pumpScenes();
    const running = mode === 'play' && !sceneUp && !ui.anyScreen();
    if (running) {
        let inp = input.state();
        if (bot) {
            inp = botInput(G, bot, STEP);
        }
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            step(G, inp, STEP);
            acc -= STEP;
            n++;
            if (G.events.some((e) => e.type === 'scene')) { acc = 0; break; }
            if (bot) inp = botInput(G, bot, STEP);
        }
    } else acc = 0;
    flushEvents();
    if (bot) autoDismiss();
    ui.sceneUpdate(dt);

    const inp = input.state();
    view.frame(G, dt, time, {
        title: mode === 'title',
        pressDown: running && inp.down,
        pressSide: running && !!inp.x,
        business: mode === 'play' ? ui.business(G) : {},
    });
    if (mode === 'play') ui.hud(G, dt, running ? 'play' : 'paused');
    audio.update(G, dt, mode === 'play' ? (running ? 'play' : 'paused') : mode);

    if (mode === 'play' && running) {
        saveT += dt;
        if (saveT > 30) { saveT = 0; saveGame(G); }
    }
    if ((time % 1) < dt) updateTouch();
}

// The autoplayer clicks through scenes and choices on its own.
function autoDismiss() {
    if (ui.scene) {
        const line = ui.scene.lines[ui.scene.i];
        if (line && line.choice) document.querySelector('#dlg-choices button')?.click();
        else { ui.advance(); ui.advance(); }
    }
    if (ui.cardsNext) ui.cardsNext();
    if (ui.topScreen() === 'ending') document.getElementById('ending-next').click();
    if (ui.topScreen() === 'panel') ui.closePanel();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (mode === 'play') {
            saveGame(G);
            if (!ui.anyScreen() && !ui.inScene()) ui.openScreen('pause');
        }
    }
});
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------
// Debug hooks (?debug=1)
// ------------------------------------------------------------------
if (DEBUG) {
    window.__rb = {
        get G() { return G; },
        get mode() { return mode; },
        view, ui, audio, input,
        newGame(seed = 1, name = 'Tester') { G = newGame(seed, name); ui.closeScreen('title'); beginPlay(); return G; },
        god(on = true) { this._god = on; if (on) { G.up = { drill: 6, hull: 6, tank: 6, vanes: 5, cargo: 6, lantern: 5, ward: 5 }; G.rig.fuel = 999; G.rig.hull = 999; } },
        money(n) { G.money += n; },
        relic(i) { G.relics[i] = true; },
        tp(c, r) { Object.assign(G.rig, { x: c + 0.5, y: -r + 0.38, vx: 0, vy: 0, drill: null }); view.snapCam = true; },
        autoplay(on = true) { bot = on ? makeBot({ god: false }) : null; },
        skipScenes() { ui.sceneQueue.length = 0; if (ui.scene) { ui.scene = null; document.getElementById('dialog').hidden = true; } },
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec; t += STEP) step(G, botInput(G, b, STEP), STEP); flushEvents(); },
        enter() { enterHere(); },
        use(k) { return useItem(G, k); },
        save() { return saveGame(G); },
        hasSave,
    };
}
