// Doom & Doilies — entry point. Boots the view, runs the fixed-step simulation, routes clicks, keys and taps into
// sim commands, hands sim events to the view, the audio and the UI, saves, and counts time away.
//
// ?debug=1 exposes window.__dd for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, rates, roomOpen } from './sim/game.js';
import { makeBot, botCommands, botShop } from './sim/bot.js';
import { HOBBIES, ABILITIES, MINIONS, DECOR } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(60, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const canvas = document.getElementById('view');
const view = new View(canvas, { quality: +settings.quality });
const queue = [];                         // commands from buttons, keys and taps, applied in order
const send = (cmd, cb) => { queue.push({ cmd, cb }); };
let overview = false;
const setOverview = (on) => { overview = on === 'toggle' ? !overview : !!on; view.overview = overview; ui.overview = overview; };
const ui = new UI({
    audio, settings, sprites: view.sprites, send,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onOverview: setOverview,
});

function applySettings() {
    audio.setVolumes(settings.sfx, settings.music);
    view.setQuality(+settings.quality);
    const calm = settings.calm === 'on' || (settings.calm === 'auto' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    document.body.classList.toggle('calm', !!calm);
    view.calm = !!calm;
    view.floatersOn = settings.floaters !== 'off';
}
applySettings();

let G = demoGame();
let mode = 'title';                       // title | play
let acc = 0, time = 0, last = performance.now(), saveT = 0, clockT = 0, layoutT = 0;
let bot = null;
const demoBot = makeBot({ cps: 2.5, every: 2, react: 3 });
const seen = {};

/** The castle behind the title screen: a few rooms already busy. */
function demoGame() {
    const g = newGame(77);
    g.charm = 5e9; g.charmRun = 5e9; g.gold = 1e4;
    const buy = { imp: 7, cauldron: 6, golem: 4, spider: 5, loom: 3, bat: 4, gargoyle: 4, wraith: 3, portrait: 5, skeleton: 3, mimic: 2, lich: 1 };
    for (const [id, n] of Object.entries(buy)) { g.charmRun = Math.max(g.charmRun, 1e15); act(g, { t: 'buy', id, n }); }
    for (const d of DECOR.slice(0, 10)) act(g, { t: 'decor', id: d.id });
    g.charm = 0; g.dread = 72; g.events.length = 0;
    return g;
}

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
document.fonts?.ready.then(() => ui.fitTitle());
window.addEventListener('resize', () => { if (!document.getElementById('title').hidden) ui.fitTitle(); });

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') {
        if (hasSave()) ui.confirm('Start a new castle?', '<p>Your saved castle — its minions, legend, heirlooms and trophies — will be replaced.</p>', 'Start over', () => startGame(newGame((Date.now() % 1e9) | 0)));
        else startGame(newGame((Date.now() % 1e9) | 0));
    } else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g, true); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
document.getElementById('btn-menu').addEventListener('click', () => openMenu());

function startGame(g, loaded = false) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    queue.length = 0;
    setOverview(false);
    ui.showPlay(true);
    view.setInsets(ui.layout());
    // time away since the last save
    if (loaded && G.wall) {
        const sec = (Date.now() - G.wall) / 1000;
        if (sec > 30) act(G, { t: 'idle', sec });
    }
    act(G, { t: 'clock', wall: Date.now() });
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showPlay(false);
    G = demoGame();
    setOverview(false);
    view.setInsets({});
    refreshTitle();
    ui.openScreen('title');
}

function openMenu() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ the castle under the pointer
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen()) return;
    e.preventDefault();
    view.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
    const hit = view.pick(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.type === 'visitor') send({ t: 'visitor', vid: hit.vid });
    else if (hit.type === 'room') {
        if (!roomOpen(G, hit.id)) ui.roomHint(hit.id);
        else { send({ t: 'room', id: hit.id }); setOverview(false); }
    }
    else send({ t: 'craft' });
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// a mouse click on a panel button must not leave it focused, or the next Space would press it instead of crafting
document.addEventListener('click', (e) => { if (e.detail && mode === 'play' && !ui.anyScreen()) e.target.closest?.('#panel button, #dock button, #abilities button, #btn-visitor')?.blur(); });

// ------------------------------------------------------------------ keys
const ROOM_IDS = HOBBIES.map((h) => h.id);
function handleKeys() {
    input.poll();
    if (ui.anyScreen()) {
        const press = input.next();             // menus take one press per frame
        if (!press) return;
        const k = press.key;
        if (k === 'ArrowDown') ui.moveFocus(1);
        else if (k === 'ArrowUp') ui.moveFocus(-1);
        else if ((k === 'Escape' || k === 'KeyP') && ui.top() !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (press.pad && (k === 'Space')) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') { input.flush(); return; }
    for (let press = input.next(); press; press = input.next()) {
        const k = press.key;
        if ((k === 'Space' || k === 'Enter') && !press.onButton) { view.lastPointer = null; send({ t: 'craft' }); }
        else if (k === 'KeyC' || k === 'Digit1') send({ t: 'ability', id: 'cackle' });
        else if (/^Digit[2-4]$/.test(k)) send({ t: 'ability', id: ABILITIES[+k.slice(5) - 1].id });
        else if (k === 'KeyQ' || k === 'ArrowLeft' || k === 'KeyE' || k === 'ArrowRight') {
            // the next open room that way; locked rooms are skipped
            const d = k === 'KeyQ' || k === 'ArrowLeft' ? -1 : 1, n = ROOM_IDS.length;
            for (let i = 1; i < n; i++) {
                const id = ROOM_IDS[(ROOM_IDS.indexOf(G.room) + d * i + n * 2) % n];
                if (roomOpen(G, id)) { send({ t: 'room', id }); break; }
            }
            setOverview(false);
        } else if (k === 'KeyV') { if (G.visitors[0]) send({ t: 'visitor', vid: G.visitors[0].vid }); }
        else if (k === 'Tab') setOverview('toggle');
        else if (k === 'Escape' || k === 'KeyP') { openMenu(); break; }
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (mode !== 'play') return;
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (ev.some((e) => e.type === 'relocate' || e.type === 'decor' || e.type === 'perk')) saveGame(G);
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const gap = (now - last) / 1000;
    const dt = Math.min(MAX_FRAME, gap);
    last = now;
    time += dt;
    // a long stall (a hidden tab, a sleeping laptop) counts as time away
    if (mode === 'play' && gap > 2) send({ t: 'idle', sec: gap - dt });
    handleKeys();
    while (queue.length) {
        const { cmd, cb } = queue.shift();
        const ok = act(G, cmd);
        cb?.(ok);
    }
    if (mode === 'play') {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            if (bot) { for (const c of botCommands(G, bot, STEP)) act(G, c); for (const c of botShop(G, bot)) act(G, c); }
            step(G, STEP);
            acc -= STEP;
            n++;
        }
        if (acc > STEP * 12 * FAST) acc = 0;
        clockT += dt;
        if (clockT >= 1) { clockT = 0; act(G, { t: 'clock', wall: Date.now() }); }
        saveT += dt;
        if (saveT > 15) { saveT = 0; saveGame(G); }
    } else {
        // the title screen's castle keeps busy on its own
        for (const c of botCommands(G, demoBot, dt)) if (c.t !== 'room') act(G, c);
        step(G, dt);
    }
    flushEvents();
    view.frame(G, dt, time);
    const R = rates(G);
    if (mode === 'play') ui.update(G, R, dt);
    layoutT -= dt;
    if (layoutT <= 0) { layoutT = 0.25; view.setInsets(ui.layout()); }
    audio.tick(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') { act(G, { t: 'clock', wall: Date.now() }); saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') { act(G, { t: 'clock', wall: Date.now() }); saveGame(G); } });
window.addEventListener('resize', () => { layoutT = 0; });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__dd = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, send,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true, opts = {}) { bot = on ? makeBot({ cps: 4, ...opts }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, opts = {}) {
            const b = makeBot({ cps: 5, ...opts });
            for (let t = 0; t < sec; t += STEP) { for (const c of botCommands(G, b, STEP)) act(G, c); for (const c of botShop(G, b)) act(G, c); step(G, STEP); }
            const keep = G.events.filter((e) => e.type !== 'craft');
            G.events.length = 0; G.events.push(...keep.slice(-40));
            flushEvents();
        },
        give(charm = 0, gold = 0) { G.charm += charm; G.charmRun += charm; G.charmAll += charm; G.gold += gold; },
        save: () => saveGame(G),
        hasSave,
        rates: () => rates(G),
        MINIONS,
    };
}
