// FABLECART — entry point. Boots the console, runs the fixed-step simulation, routes input and
// events, and moves between the boot screen, the console room, the Stage, the Sticker Press and play.
//
//   boot  → room ⇄ (shelf | book | stage | press | play)
//
// The console room is itself a cart run by the same engine as every game made on it.
// ?debug=1 exposes window.__fc for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, ROWS } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI, $ } from './ui/screens.js';
import { createShelf } from './ui/shelf.js';
import { createStage } from './ui/stage.js';
import { createPress } from './ui/press.js';
import { loadSettings, saveSettings, loadStore, saveStore, clearStore, getCart, editableCurrent } from './save.js';
import { roomCart } from './sim/cart.js';
import { newWorld, step, heroesOf } from './sim/world.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
let store = loadStore();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'));
view.calm = !!settings.calm;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); view.calm = !!s.calm; updateTouch(); },
    onDeleteAll: () => { clearStore(); store = loadStore(); shelf.refresh(); },
});

let G = newWorld(roomCart(), 0, 1);
let mode = 'boot';           // boot | room | play | stage | press
let returnTo = 'room';       // where play and the Press go back to
let playCart = null;
let seedCounter = 1;
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let overT = 0;               // a short beat between the last blow and the end screen
let restartT = 0;            // the Press's test stage restarts itself after a win or loss
let bot = null;
let lastStation = 12;
let wasRunning = false;
const seen = {};

const persist = () => saveStore(store);

const host = {
    get store() { return store; },
    view, audio, ui, input,
    get cart() { return getCart(store); },
    /** The cart to change: forks the read-only starter into the player's shelf the first time. */
    ensureEditable() { const c = editableCurrent(store); persist(); shelf.refresh(); return c; },
    persist,
    setWorld(w) { G = w; },
    get mode() { return mode; },
    enterRoom: (spawnX) => enterRoom(spawnX),
    enterStage: (cart, scene) => enterStage(cart, scene),
    openPress: (id, ret) => openPress(id, ret),
    playCart: (cart, ret) => startPlay(cart, ret),
    layout: () => layout(),
    toast: (t) => ui.toast(t),
    newSticker: (ret) => shelf.newStickerFlow(ret),
};

const shelf = createShelf(host);
const stage = createStage(host);
const press = createPress(host);

// ------------------------------------------------------------------ layout (px from visualViewport)

function layout() {
    const vv = window.visualViewport;
    const W = Math.max(1, Math.round(vv ? vv.width : innerWidth));
    const H = Math.max(1, Math.round(vv ? vv.height : innerHeight));
    const app = $('app'), bar = $('bar'), wrap = $('wrap'), panel = $('panel');
    Object.assign(app.style, { width: W + 'px', height: H + 'px' });
    const barH = bar.offsetHeight;
    const areaH = H - barH;
    const withPanel = mode === 'stage' || mode === 'press';
    panel.hidden = !withPanel;
    const landscape = W >= H * 1.1 && W >= 700;
    document.body.classList.toggle('landscape', withPanel && landscape);
    const place = (el, x, y, w, h) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    if (!withPanel) place(wrap, 0, barH, W, areaH);
    else if (landscape) {
        const pw = Math.max(340, Math.min(520, Math.round(W * 0.4)));
        place(wrap, 0, barH, W - pw, areaH);
        place(panel, W - pw, barH, pw, areaH);
    } else {
        const wh = Math.min(Math.round(areaH * 0.46), Math.round(W * 0.625) + 6);
        place(wrap, 0, barH, W, wh);
        place(panel, 0, barH + wh, W, areaH - wh);
    }
    view.setSize(wrap.clientWidth, wrap.clientHeight);
}
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ------------------------------------------------------------------ modes

function setBar(sub, { home = false, pause = false } = {}) {
    $('bar-sub').textContent = sub;
    $('btn-home').hidden = !home;
    $('btn-pause').hidden = !pause;
}

function showPanels(which) {
    $('stage-panel').hidden = which !== 'stage';
    $('press-panel').hidden = which !== 'press';
}

function enterRoom(spawnX = lastStation) {
    ui.closeAll();
    mode = 'room';
    $('boot-start').hidden = true;
    lastStation = spawnX;
    G = newWorld(roomCart({ x: spawnX, y: 7.5 }), 0, 7);
    acc = 0; bot = null;
    showPanels(null);
    setBar('', {});
    audio.setTune('room');
    input.flush();
    layout();
    updateTouch();
    ui.refreshTouch(true);
}

function enterStage(cart, sceneIdx = 0) {
    ui.closeAll();
    mode = 'stage';
    showPanels('stage');
    setBar(cart.name, { home: true });
    audio.setTune('make');
    layout();
    stage.enter(cart, sceneIdx);
    ui.refreshTouch(false);
}

function openPress(stickerId, ret) {
    const cart = host.ensureEditable();
    ui.closeAll();
    returnTo = ret;
    mode = 'press';
    showPanels('press');
    setBar(cart.name, {});
    audio.setTune('make');
    layout();
    press.enter(cart, stickerId);
    updateTouch();
    ui.refreshTouch(false);
}

function pressDone() {
    if (returnTo === 'stage') enterStage(getCart(store), stage.sceneIndex);
    else { enterRoom(lastStation); shelf.openBook(); }
}

function startPlay(cart, ret) {
    ui.closeAll();
    returnTo = ret;
    playCart = cart;
    mode = 'play';
    G = newWorld(cart, 0, (Date.now() % 1e6) + seedCounter++);
    acc = 0; overT = 0;
    showPanels(null);
    setBar(cart.name, { pause: true });
    audio.setTune('play');
    view.startGoal();
    input.flush();
    layout();
    updateTouch();
    ui.refreshTouch(true);
}

function leavePlay() {
    ui.closeAll();
    if (returnTo === 'stage') enterStage(getCart(store), stage.sceneIndex);
    else enterRoom(lastStation);
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    // the Press has its own pad row under the picture
    ui.setTouch(mode !== 'press' && (settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'))));
}
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindButton($('btn-a'), 'a');
input.bindButton($('btn-b'), 'b');

// a quick tap on the picture is a tap on a sticker (the stick zone covers most of it, so it forwards)
function tapAt(cx, cy) {
    if (mode !== 'room' && mode !== 'play' && mode !== 'press') return;
    const cell = view.toCell(cx, cy);
    if (cell) input.tap(cell);
}
$('view').addEventListener('pointerdown', (e) => { if (mode !== 'stage') tapAt(e.clientX, e.clientY); });
{
    let down = null;
    const z = $('stick-zone');
    z.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    z.addEventListener('pointerup', (e) => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 350) tapAt(e.clientX, e.clientY);
        down = null;
    });
}

// ------------------------------------------------------------------ menus

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

function powerOn() {
    if (mode !== 'boot' || time - view.bootT < 1.2) return;
    audio.init();
    audio.boot();
    $('boot-start').hidden = true;
    enterRoom(12);
}
$('boot-start').addEventListener('click', powerOn);
$('view').addEventListener('pointerdown', () => { if (mode === 'boot') powerOn(); });

$('pr-done').addEventListener('click', () => { audio.ui('close'); host.persist(); pressDone(); });
$('btn-home').addEventListener('click', () => { audio.ui('close'); persist(); enterRoom(lastStation); });
$('btn-pause').addEventListener('click', () => pause());
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'restart') startPlay(playCart, returnTo);
    else if (act === 'quit') leavePlay();
    else ui.openScreen(act);
});
$('over-again').addEventListener('click', () => { audio.ui('click'); startPlay(playCart, returnTo); });
$('over-back').addEventListener('click', () => { audio.ui('click'); leavePlay(); });

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    $('pause-quit').textContent = returnTo === 'stage' ? 'Back to the Stage' : 'Back to the Console';
    ui.openScreen('pause');
}

function onConsole(open) {
    const hero = heroesOf(G)[0];
    if (hero) { hero.y = Math.min(ROWS - 1.2, hero.y + 2.2); hero.ct = {}; lastStation = hero.x; }
    ui.audio.ui('open');
    if (open === 'shelf') shelf.openShelf();
    else if (open === 'press') shelf.openBook();
    else if (open === 'stage') { const cart = host.ensureEditable(); enterStage(cart, 0); }
    else if (open === 'play') startPlay(host.cart, 'room');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press1 = input.next();               // one per frame: presses never merge
    if (!press1) return;
    const key = press1.key;
    if (mode === 'boot') { powerOn(); return; }
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press1.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
    else if ((mode === 'stage' || mode === 'press') && key === 'Escape') (mode === 'stage' ? $('btn-home') : $('pr-done')).click();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'console' && mode === 'room') onConsole(e.open);
        else if (e.type === 'win' && mode === 'play') { audio.play('win'); overT = 1.1; }
        else if (e.type === 'lose' && mode === 'play') { audio.play('lose'); overT = 1.1; }
        else if ((e.type === 'win' || e.type === 'lose') && mode === 'press') restartT = 1.3;
    }
}

function showOver() {
    const won = G.status === 'won';
    $('over-title').textContent = won ? 'You win!' : 'Game over';
    const bits = [`Score ${G.score}`];
    for (const k of ['coin', 'gem', 'star']) if (G.inv[k]) bits.push(`${G.inv[k]} ${k}${G.inv[k] > 1 ? 's' : ''}`);
    $('over-text').textContent = (won ? 'The cartridge is complete. ' : 'Your hero has fallen. ') + bits.join(' · ');
    $('over-back').textContent = returnTo === 'stage' ? 'Back to the Stage' : 'Back to the Console';
    ui.openScreen('over');
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const live = mode === 'room' || mode === 'play' || mode === 'press';
    const running = live && !ui.anyScreen() && G.status === 'play';
    // back from a menu: the key or tap that closed it must not also act in the game
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot && mode === 'play' ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();               // only once a step has seen them
            acc -= STEP;
            n++;
            if (G.status !== 'play') break;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; persist(); }
    } else acc = 0;
    flushEvents();

    if (mode === 'play' && G.status !== 'play' && overT > 0) {
        overT -= dt;
        if (overT <= 0 && !ui.anyScreen()) showOver();
    }
    if (mode === 'press' && restartT > 0) { restartT -= dt; if (restartT <= 0) press.restart(); }

    view.frame(G, dt, time, {
        mode,
        edit: mode === 'stage' ? stage.overlay() : null,
        labels: mode === 'room',
        goal: mode === 'play' ? playCart?.goal : null,
    });
    ui.refreshTouch(mode === 'room' || mode === 'play');
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); persist(); } });
window.addEventListener('pagehide', persist);

layout();
view.bootT = 0;
setBar('', {});
$('boot-start').hidden = false;
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__fc = {
        get G() { return G; },
        get mode() { return mode; },
        get cart() { return getCart(store); },
        seen, view, ui, audio, input, store, stage, press, shelf,
        room: (x) => enterRoom(x),
        open: (what) => onConsole(what),
        pressOn: (sid, ret = 'stage') => openPress(sid, ret),
        stageOn: (i = 0) => enterStage(host.ensureEditable(), i),
        play(sceneCart = host.cart, seed = 1) { startPlay(sceneCart, 'room'); G = newWorld(sceneCart, 0, seed); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && G.status === 'play'; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        persist,
        cell: (x, y) => view.toClient(x, y),
        get layout() { const r = (id) => { const b = $(id).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }; return { wrap: r('wrap'), panel: r('panel'), canvas: r('view') }; },
    };
}
