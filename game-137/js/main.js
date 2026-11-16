// SHARDFRAME — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, the opening cinematic, the hangar, a sortie, the
// debrief and the ending.
//
// ?debug=1 exposes window.__sf for the dev/ harnesses; &fast=N runs N× simulation per frame;
// &q=low draws without antialiasing at 1× pixels.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Cinematic } from './cinematic.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act } from './sim/game.js';
import { makeBot, botInput, botHangar } from './sim/bot.js';
import { giftsWaiting } from './sim/hangar.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
document.body.classList.toggle('calm', !!settings.calm);
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'), { low: params.get('q') === 'low' || settings.detail === 'low' });
let G = null;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); updateTouch(); document.body.classList.toggle('calm', !!s.calm); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    act: (cmd) => { const r = G ? act(G, cmd) : false; flushEvents(); save(); return r; },
});
const cin = new Cinematic({ audio, onDone: () => { toHangar(); ui.comm('mirei', 'Welcome aboard the Skylark, Kai. Pick a sortie, check your mech, and visit the Crew deck once you’ve rescued someone.', 7); } });

let mode = 'title';          // title | intro | hangar | mission | debrief | ending
let acc = 0, time = 0, last = performance.now(), saveT = 0, hangarT = 0;
let bot = null, pendingPick = null, pendingTap = null, wasRunning = false;
const seen = {};

// ------------------------------------------------------------------ helpers
function save() { return G ? saveGame(G) : false; }
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
view.setMode('off');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
audio.playMusic('title');

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
updateTouch();
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindHold(document.getElementById('btn-mag'));
input.bindButton(document.getElementById('btn-od'), () => input.pressOD());
input.bindButton(document.getElementById('btn-beam'), () => input.pressBeam());
// tap or click the field to focus fire: the sim gets the ground point under the finger
document.getElementById('view').addEventListener('pointerdown', (e) => {
    if (mode !== 'mission' || !G?.run || ui.modal() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = view.screenToGround(e.clientX, e.clientY);
    if (p) pendingTap = p;
});

// ------------------------------------------------------------------ modes
function setBodyHangar(on) { document.body.classList.toggle('in-hangar', on); }

function startNewGame(seed = (Date.now() % 1e9) | 0, { intro = true } = {}) {
    G = newGame(seed);
    save();
    ui.closeAll();
    document.activeElement?.blur?.();
    if (intro) { mode = 'intro'; view.setMode('off'); setBodyHangar(false); cin.start(); }
    else toHangar();
}

function toHangar() {
    ui.closeAll();
    ui.clearOverlays();
    ui.showHud(false);
    mode = 'hangar';
    view.setMode('hangar');
    setBodyHangar(true);
    audio.playMusic('hangar');
    ui.renderHangar(G);
    ui.openScreen('hangar');
    save();
}

function toMission() {
    ui.closeAll();
    document.activeElement?.blur?.();
    setBodyHangar(false);
    mode = 'mission';
    acc = 0;
    view.setMode('mission');
    input.flush();
    ui.showHud(true);
    updateTouch();
    audio.playMusic(G.run.enemies.some((e) => e.boss) ? 'boss' : 'battle');
    save();
}

function toDebrief() {
    mode = 'debrief';
    ui.showHud(false);
    ui.clearOverlays();
    view.setMode('off');
    setBodyHangar(true);
    audio.playMusic('hangar');
    ui.openDebrief(G);
    save();
}

function resume(loaded) {
    G = loaded.G;
    act(G, { t: 'idle', secs: loaded.away });
    const n = giftsWaiting(G);
    G.events.length = 0;
    if (G.mode === 'mission') { toMission(); pause(); }
    else if (G.mode === 'debrief') toDebrief();
    else toHangar();
    if (n) ui.toast(`🎁 While you were away the crew left ${n} gift${n > 1 ? 's' : ''}`);
}

function pause() {
    if (ui.modal() && ui.top() !== 'hangar') return;
    if (mode !== 'mission' && mode !== 'hangar') return;
    audio.ui('open');
    const inMission = mode === 'mission';
    document.querySelector('#pause-menu [data-act="resume"]').textContent = inMission ? 'Resume' : 'Back';
    document.getElementById('btn-abort').hidden = !inMission;
    save();
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ menus
document.getElementById('title-menu').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') {
        if (hasSave() && !(await ui.confirm('Start a new game? The saved campaign will be replaced.'))) return;
        startNewGame();
    } else if (a === 'continue') {
        const g = loadGame();
        if (g) resume(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'abort') {
        if (!(await ui.confirm('Abort the sortie? You keep half the credits you picked up.'))) return;
        ui.closeScreen('pause');
        act(G, { t: 'abort' });
        flushEvents();
    } else if (a === 'quit') { save(); toTitle(); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('hg-menu').addEventListener('click', () => pause());
document.getElementById('brief-launch').addEventListener('click', () => {
    audio.ui('click');
    if (act(G, { t: 'launch', mission: ui.briefId })) { flushEvents(); toMission(); }
});
document.getElementById('cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    pickCard(+b.dataset.pick);
});
document.getElementById('db-ok').addEventListener('click', () => {
    audio.ui('click');
    const ending = G.debrief?.ending;
    act(G, { t: 'done' });
    ui.closeScreen('debrief');
    if (ending) { mode = 'ending'; ui.openScreen('ending'); audio.playMusic('title'); }
    else toHangar();
});
document.getElementById('end-ok').addEventListener('click', () => { audio.ui('click'); toHangar(); });

function pickCard(i) {
    if (!G?.run?.choice || i >= G.run.choice.length) return;
    audio.ui('click');
    pendingPick = i;
    ui.closeScreen('levelup');
}

function toTitle() {
    ui.closeAll();
    ui.clearOverlays();
    ui.showHud(false);
    mode = 'title';
    view.setMode('off');
    setBodyHangar(false);
    audio.playMusic('title');
    refreshTitle();
    ui.openScreen('title');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (mode === 'intro') {
        if (key === 'Escape') cin.finish();
        else if (key === 'Enter' || key === 'Space') cin.next();
        return;
    }
    if (ui.top() === 'levelup') {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[key];
        if (n != null) { pickCard(n); return; }
    }
    if (ui.anyScreen() && !(mode === 'hangar' && ui.top() === 'hangar')) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'levelup', 'debrief', 'ending', 'hangar', 'confirm'].includes(ui.top())) { audio.ui('click'); ui.closeTop(); }
        else if (key === 'Escape' && ui.top() === 'confirm') document.getElementById('confirm-no').click();
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'hangar' && (key === 'Escape' || key === 'KeyP')) pause();
    if (mode === 'mission' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (mode === 'mission' && G.mode === 'debrief') toDebrief();
    if (mode === 'hangar' && ev.some((e) => ['gift_ready', 'gift', 'bought', 'upgraded', 'equip'].includes(e.type))) ui.renderHangar(G);
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    const realDt = Math.min(1, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    cin.update(realDt);

    // the crew's clock runs in real time whenever a game is open
    if (G && !document.hidden) act(G, { t: 'idle', secs: realDt });

    const R = G?.run;
    if (mode === 'mission' && R && R.choice && pendingPick == null && ui.top() !== 'levelup' && !ui.modal()) ui.openLevelUp(R);
    const running = mode === 'mission' && R && !ui.modal();
    if (running && !wasRunning) input.flush();   // the key that closed a menu must not act in the game
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST && G.mode === 'mission') {
            const inp = bot ? botInput(G, bot) : input.state();
            if (pendingPick != null) { inp.pick = pendingPick; pendingPick = null; }
            if (pendingTap) { inp.tap = pendingTap; pendingTap = null; }
            step(G, inp, STEP);
            input.consumeEdges();
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 15) { saveT = 0; save(); }
        audio.tick(G, dt);
    } else acc = 0;
    flushEvents();
    if (G) view.frame(G, dt, time); else view.frame({ run: null, hangar: null }, dt, time);
    if (mode === 'mission' && G?.run) {
        ui.hud(G, view);
        ui.speedlines(G.run.mech.odT > 0);
        ui.flash(view.flash);
    } else ui.flash(0);
    if (mode === 'hangar') { hangarT += realDt; if (hangarT > 1 && ui.tab === 'crew' && !ui.modal()) { hangarT = 0; ui.renderHangar(G); } }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'mission') pause(); save(); } });
window.addEventListener('pagehide', () => save());

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__sf = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, cin,
        newGame(seed = 1, opts = { intro: false }) { startNewGame(seed, opts); return G; },
        launch(id = 1) { G.unlocked = Math.max(G.unlocked, id); if (act(G, { t: 'launch', mission: id })) { flushEvents(); toMission(); } return G.run; },
        autoplay(on = true) { bot = on ? makeBot({ seed: 3 }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) {
            const b = makeBot({ seed: 5 });
            for (let t = 0; t < sec && G.mode === 'mission'; t += STEP) { step(G, botInput(G, b), STEP); if (G.events.length > 4000) flushEvents(); }
            flushEvents();
        },
        hangarBot() { botHangar(G, makeBot({ seed: 9 })); flushEvents(); if (G.mode === 'mission') toMission(); },
        save, hasSave,
        loadAndResume() { const g = loadGame(); if (g) resume(g); return !!g; },
    };
}
