// Fray & the Spiral Isle — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title and the journey.
//
// ?debug=1 exposes window.__si for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low draws less.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, nextGoal } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { LINES } from './sim/data/story.js';
import { zone, findThing, standNear } from './sim/world.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const LOW = params.get('q') === 'low';
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
const canvas = $('view');
const input = new Input(canvas);
const view = new View(canvas, { low: LOW });
const applySettings = (s) => { audio.setVolumes(s.sfx, s.music, s.voice); input.sens = s.look; input.invert = !!s.invert; };
applySettings(settings);
const ui = new UI({
    audio, input, settings,
    onSettings: (s) => { saveSettings(s); applySettings(s); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let G = newGame(1);          // the title screen has a game behind it
let mode = 'title';          // title | play
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audio.play('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That saved journey could not be read.');
    } else ui.openScreen(act);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
$('btn-pause').addEventListener('click', () => pause());
$('btn-journal').addEventListener('click', () => openJournal());
$('btn-hint').addEventListener('click', () => input.command({ t: 'hint' }));

function startGame(g) {
    G = g;
    ui.G = G;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    input.pitch = 0;
    ui.showHud(true);
    updateTouch();
    enterZone(true);
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    input.releaseMouse();
    ui.showHud(false);
    audio.hush();
    audio.play('title'); audio.ambience(null);
    G = newGame(1);
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    input.releaseMouse();
    ui.openScreen('pause');
}
function openJournal() {
    if (mode !== 'play' || ui.top() === 'journal') return;
    audio.ui('open');
    input.releaseMouse();
    ui.G = G;
    ui.openScreen('journal');
}

function enterZone(announce) {
    const def = zone(G.zone).def;
    audio.play(def.music); audio.ambience(def.music);
    if (announce) ui.place(def.name, performance.now());
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindLook($('look-zone'));
input.bindButton($('btn-a'), () => input.pressA());

// ------------------------------------------------------------------ input routing
const GO = { ArrowUp: 'n', KeyW: 'n', ArrowRight: 'e', KeyD: 'e', ArrowDown: 's', KeyS: 's', ArrowLeft: 'w', KeyA: 'w' };
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP' || (key === 'KeyJ' && ui.top() === 'journal')) && ui.top() !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'KeyP') pause();
    else if (key === 'KeyJ' || key === 'Tab') openJournal();
    else if (G.tun && !G.cards.length) {
        if (GO[key]) input.command({ t: 'go', d: GO[key] });
        else if (key === 'Escape' || key === 'Backspace' || key === 'KeyB') input.command({ t: 'back' });
    } else if (key === 'Escape') { if (!input.locked) pause(); }        // with the mouse captured, Esc just lets it go
    else if (key === 'KeyH') input.command({ t: 'hint' });
}

// ------------------------------------------------------------------ events
function flushEvents(now) {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev, now);
    for (const e of ev) {
        if (e.type === 'say') audio.say(Array.isArray(LINES[e.line]) ? `${e.line}-${e.n + 1}` : e.line);
        else if (e.type === 'travel') { if (e.to !== e.from) enterZone(false); saveGame(G); }
        else if (e.type === 'gem' || e.type === 'keepsake' || e.type === 'healed' || e.type === 'tunDone') saveGame(G);
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        input.wantLock = !G.cards.length && !G.tun;
        if (!input.wantLock) input.releaseMouse();
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : input.state(STEP);
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else { acc = 0; input.wantLock = false; }
    flushEvents(now);
    view.pitch = mode === 'play' ? input.pitch : 0.08;
    if (mode === 'title') G.player.yaw = Math.sin(time * 0.05) * 0.4;
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G, now);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__si = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, nextGoal: () => nextGoal(G),
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true, explore = false) { bot = on ? makeBot({ explore }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, explore = false) {
            const b = (this._bot = this._bot && this._botG === G ? this._bot : makeBot({ explore })); this._botG = G;
            for (let t = 0; t < sec && !G.done; t += STEP) { step(G, botInput(G, b), STEP); if (G.events.length > 300) flushEvents(performance.now()); }
            flushEvents(performance.now());
            return { t: G.t, zone: G.zone, gems: G.gems.length };
        },
        /** Close whatever cards are up. */
        skipCards() { for (let i = 0; i < 30 && G.cards.length; i++) step(G, { a: true }, STEP); flushEvents(performance.now()); },
        /** Stand beside a thing, looking at it (for screenshots and tests). `back` metres further off. */
        goto(id, back = 0) {
            const { zone: z, thing: t } = findThing(id);
            G.zone = z;
            const spots = standNear(z, G.flags, t, 3 + back + (t.solid || 0)).sort((a, b) => Math.hypot(b[0] - t.x, b[1] - t.z) - Math.hypot(a[0] - t.x, a[1] - t.z));
            const [x, zz] = spots[0] || [t.x, t.z];
            G.player.x = x; G.player.z = zz; G.player.yaw = Math.atan2(t.x - x, -(t.z - zz));
            G.fray.x = x + 1; G.fray.z = zz + 1; G.fray.crumbs.length = 0;
            enterZone(false);
            return { x, z: zz };
        },
        save: () => saveGame(G),
        hasSave,
    };
}
