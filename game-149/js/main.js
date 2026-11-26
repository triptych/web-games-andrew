// Echoheart Academy — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and moves
// between the title, the game (story, campus, battles, mini-games) and the ending.
//
// ?debug=1 exposes window.__ea for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, SAVE_KEY, VERSION } from './config.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';
import { View } from './view/view.js';
import { MiniView } from './view/miniview.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { VNView } from './ui/vn.js';
import { BattleUI } from './ui/battleui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, playScene } from './sim/game.js';
import { makeBot, botDecide } from './sim/bot.js';
import { nameOf } from './sim/rules.js';
import { CAST, ITEMS, PLACES } from './sim/data.js';
import { GRADES } from './sim/minis.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings);
const input = new Input();
const view = new View($('view'));
view.arena.audio = audio;
const mini = new MiniView(audio);

let G = null;
let mode = 'title';          // title | game | ending
let acc = 0, time = 0, last = performance.now(), saveT = 0, wasRunning = false;
let bot = null;
let lastBattle = null;
let swallow = 0;             // ignore presses briefly after a sheet or a line closes (a double tap mustn't act twice)
const seen = {};

const send = (cmd) => {
    if (!G) return false;
    const ok = act(G, cmd);
    flushEvents();
    return ok;
};
const ui = new UI({
    audio, settings, send,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
const vnv = new VNView({ audio, settings, send, nameOf: (who) => (G ? nameOf(G, who) : who) });
const bui = new BattleUI({ audio, send });

// ------------------------------------------------------------------ title and menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-149'.
// The save is everything stored under SAVE_KEY (settings stay on the device); loading writes it back and reloads.
const cloud = makeCloud({ game: 'game-149' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'game' && G) saveGame(G); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const s = snapValue(snap, SAVE_KEY); return s ? `${s.name || s.data?.name || 'Kai'} · Day ${s.day || s.data?.day || 1}` : 'An Echoheart game'; },
    hasGame: () => mode === 'game' || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();
audio.want = 'title';

const unlock = () => { audio.init(); if (mode === 'title') audio.setTheme('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') { ui.openScreen('namescr'); $('name-input').select(); }
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
$('name-go').addEventListener('click', () => {
    audio.ui('click');
    const name = $('name-input').value.trim().replace(/[<>]/g, '') || 'Kai';
    startGame(newGame((Date.now() % 1e9) | 0, name));
});
$('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('name-go').click(); });
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); cloudUI.autosave({ force: true }); toTitle(); }
    else if (a === 'journal') ui.openJournal(G);
    else if (a === 'bag') ui.openBag(G);
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());
$('vn-menu').addEventListener('click', (e) => { e.stopPropagation(); pause(); });
$('btn-journal').addEventListener('click', () => { audio.ui('open'); ui.openJournal(G); });
$('btn-bag').addEventListener('click', () => { audio.ui('open'); ui.openBag(G); });
$('hud-prompt').addEventListener('click', () => visit());
$('m-done').addEventListener('click', () => { audio.ui('click'); send({ t: 'miniDone' }); });
$('ending-back').addEventListener('click', () => { clearSave(); toTitle(); });

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'game';
    acc = 0;
    input.flush();
    lastBattle = null;
    vnv.lastBg = null;
    saveGame(G);
    flushEvents();
    updateTouch();
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    G = null;
    bot = null;
    vnv.show(false);
    bui.show(false);
    $('mini-ui').hidden = true;
    ui.showHud(false);
    view.setMode('none');
    refreshTitle();
    ui.openScreen('title');
    audio.setTheme('title');
}

function pause() {
    if (mode !== 'game' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function visit() {
    if (!G || G.mode !== 'map' || !G.near || ui.anyScreen()) return;
    audio.ui('open');
    send({ t: 'visit', place: G.near });
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    ui.setTouch(on, mode === 'game' && G?.mode === 'map' && !ui.anyScreen());
    mini.touch = on;
}
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindButton($('btn-a'), () => visit());
// the mini-game pad: a press is a direction edge, and holding it is a held direction
const PADKEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const b of document.querySelectorAll('.mpad[data-dir]')) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pushDir(b.dataset.dir); input.keys.add(PADKEY[b.dataset.dir]); try { b.setPointerCapture(e.pointerId); } catch { /* */ } });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => input.keys.delete(PADKEY[b.dataset.dir]));
}
input.bindButton($('m-a'), () => input.pressA());
// tapping a lane in the Fireball Gallery fires into it; tapping elsewhere in a mini-game is the action button
$('mini-canvas').addEventListener('pointerdown', (e) => {
    if (!G?.mini || G.mini.result) return;
    const F = mini.field();
    if (G.mini.game === 'fireball') { const lane = Math.floor((e.clientX - F.x) / (F.w / 3)); if (lane >= 0 && lane < 3) input.pushDir(['left', 'up', 'right'][lane]); }
    else if (G.mini.game === 'potion') input.pressA();
});
// a tap on the campus that isn't the stick: enter the place you're standing at
$('view').addEventListener('click', () => { if (G?.mode === 'map' && G.near) visit(); });

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    if (swallow > 0) return;
    const key = press.key;
    const onButton = document.activeElement?.tagName === 'BUTTON' && (key === 'Space' || key === 'Enter');
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP' || key === 'KeyB' && ui.top() === 'bag' || key === 'KeyJ' && ui.top() === 'journal') && !['title', 'ending'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); swallow = 0.15; }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'game' || !G) return;
    if (key === 'Escape' || key === 'KeyP') {
        if (G.mode === 'battle' && bui.back()) return;
        pause();
        return;
    }
    if (onButton && !press.pad) return;                    // the browser clicks the focused button itself
    switch (G.mode) {
        case 'vn':
            if (G.vn?.choices) {
                if (key === 'ArrowDown' || key === 'ArrowRight') vnv.focusChoice(1);
                else if (key === 'ArrowUp' || key === 'ArrowLeft') vnv.focusChoice(-1);
                else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
            } else if (['Space', 'Enter', 'KeyZ'].includes(key)) vnv.advance();
            break;
        case 'map':
            if (['Space', 'Enter', 'KeyZ'].includes(key)) visit();
            else if (key === 'KeyJ') { audio.ui('open'); ui.openJournal(G); }
            else if (key === 'KeyB') { audio.ui('open'); ui.openBag(G); }
            break;
        case 'battle': {
            const menu = [...document.querySelectorAll('#b-menu button:not([disabled]), #b-end button')].filter((b) => b.getClientRects().length);
            if (!menu.length) break;
            const i = menu.indexOf(document.activeElement);
            if (key === 'ArrowDown' || key === 'ArrowRight') menu[(i + 1 + menu.length) % menu.length].focus();
            else if (key === 'ArrowUp' || key === 'ArrowLeft') menu[(i - 1 + menu.length) % menu.length].focus();
            else if (press.pad && key === 'Enter') document.activeElement?.click?.();
            else if (['Space', 'Enter', 'KeyZ'].includes(key) && i < 0) menu[0].click();
            break;
        }
        case 'mini':
            if (G.mini?.result && ['Space', 'Enter', 'KeyZ'].includes(key)) send({ t: 'miniDone' });
            break;
    }
}

// ------------------------------------------------------------------ events
const TOAST = {
    item: (e) => (e.n > 0 && !['moonpetal', 'mochitreat'].includes(e.item) ? `Got ${ITEMS[e.item].name}${e.n > 1 ? ' ×' + e.n : ''}!` : null),
    join: (e) => `${CAST[e.who].name} joined the party!`,
    levelUp: (e) => (e.who === 'kai' ? `${G.name} reached level ${e.lv}!` : null),
    charm: (e) => `Echo Charm ${e.n}/12 — ${e.text}`,
    petal: () => `Moonpetal (${G.inv.moonpetal || 0}/5)`,
    treat: () => `Cloud Marshmallow (${G.inv.mochitreat || 0}/3)`,
    heartUp: (e) => `♥ ${CAST[e.who].name}: ${e.hearts} hearts`,
    gift: (e) => ({ love: `${CAST[e.who].name} LOVES it! ♥♥`, like: `${CAST[e.who].name} likes it! ♥`, meh: `${CAST[e.who].name} says thanks.` }[e.value]),
    buy: (e) => `Bought ${ITEMS[e.item].name}.`,
    rest: () => 'Everyone is rested and ready.',
    freed: (e) => `Freed ${e.id === 'best' ? CAST[G.captive || 'ren']?.name || 'your friend' : e.id === 'firsties' ? 'the first-years' : CAST[e.id].name}!`,
    retry: () => 'Try again! You can do this.',
};
const SFX_EVENT = { charm: 'charm', petal: 'charm', treat: 'charm', heartUp: 'heal', levelUp: 'levelup', join: 'quest', quest: 'quest', gift: 'heal', freed: 'shatter', moonrise: 'bell', capture: 'hollow', chapter: 'whoosh', bg: null };

function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'sfx') audio.sfx(e.v);
        else if (SFX_EVENT[e.type]) audio.sfx(SFX_EVENT[e.type]);
        if (e.type === 'mini') mini.onEvent(e.game, e.e);
        if (e.type === 'miniDone') audio.sfx(e.grade >= 2 ? 'victory' : 'quest');
        if (e.type === 'panel') ui.openPanel(G, e.place);
        if (e.type === 'gift') audio.voice(e.who, e.value === 'love' ? (e.who === 'hana' ? 'thanks' : e.who === 'pip' ? 'yay' : e.who === 'lys' ? 'win' : 'win') : 'hi');
        if (e.type === 'turn') { const a = G.battle?.actors.find((x) => x.id === e.who); if (a && G.battle.turn < 3) audio.bark(a.kind, 'start', 0.5); }
        const t = TOAST[e.type]?.(e);
        if (t) ui.toast(t, e.type === 'heartUp' || e.type === 'gift' ? 'heart' : '');
        if (e.type === 'ending') { mode = 'ending'; clearSave(); }
        if (e.type === 'day') saveGame(G);
    }
}

// ------------------------------------------------------------------ layers
function syncLayers(dt) {
    if (mode === 'title' || !G) return;
    const m = G.mode;
    vnv.show(m === 'vn');
    if (m === 'vn') vnv.render(G, dt);
    // the campus
    ui.showHud(m === 'map');
    if (m === 'map') ui.hud(G);
    if (m !== 'map' && ui.stack.includes('panel')) ui.closeScreen('panel');
    if (m === 'map' && !G.panel && ui.top() === 'panel') ui.closeScreen('panel');
    // battles
    bui.show(m === 'battle');
    if (m === 'battle') {
        if (G.battle !== lastBattle) { lastBattle = G.battle; view.setMode('none'); }
        view.setMode('arena', G);
        bui.render(G, view.busy || G.events.length > 0);
    } else lastBattle = null;
    // mini-games
    $('mini-ui').hidden = m !== 'mini';
    $('m-result').hidden = !(m === 'mini' && G.mini?.result);
    if (m === 'mini') mini.draw(G, dt, time);
    if (m === 'map') view.setMode('campus', G);
    else if (m !== 'battle') view.setMode('none');
    if (mode === 'ending' && !ui.stack.includes('ending')) { ui.showEnding(G); audio.setTheme('title'); }
    // music
    if (m === 'battle') audio.setTheme(G.battle?.music || 'battle');
    else if (m === 'mini') audio.setTheme(G.climax ? 'climax' : 'academy');
    else if (m !== 'end') audio.setTheme(G.music || 'academy');
    updateTouch();
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    swallow = Math.max(0, swallow - dt);
    handlePresses();

    const running = mode === 'game' && G && !ui.anyScreen();
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        const hold = view.busy;
        while (acc >= STEP && n < 12 * FAST) {
            let inp;
            if (bot) {
                const d = botDecide(G, bot);
                if (d.cmd && !(G.mode === 'battle' && (view.busy || G.events.length))) send(d.cmd);
                inp = d.inp || { x: 0, y: 0, a: false, dir: null };
            } else {
                inp = input.state();
                inp.dir = G.mode === 'mini' ? input.takeDir() : null;
            }
            step(G, inp, STEP, { hold });
            if (!bot) { input.consumeEdges(); if (G.mode !== 'mini') input.dirs.length = 0; }
            acc -= STEP;
            n++;
            if (G.events.length && G.mode === 'battle') flushEvents();
        }
        if (G.mode === 'map') { saveT += dt; if (saveT > 30) { saveT = 0; saveGame(G); cloudUI.autosave(); } }
    } else acc = 0;
    flushEvents();
    syncLayers(dt);
    if (view.mode !== 'none') view.frame(G, dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'game' && G) saveGame(G); cloudUI.autosave({ keepalive: true }); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ea = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, vnv, bui, mini,
        start(seed = 1, name = 'Kai') { startGame(newGame(seed, name)); return G; },
        act: (cmd) => send(cmd),
        scene(name) { playScene(G, name); flushEvents(); },
        autoplay(on = true, opts = {}) { bot = on ? makeBot({ skill: 1, ...opts }) : null; },
        /** Run the sim ahead with the bot, synchronously, until done(G) or the seconds run out. */
        ff(sec, opts = {}, done = null) {
            const b = makeBot({ skill: 1, ...opts });
            for (let t = 0; t < sec && !G.ended && !(done && done(G)); t += STEP) {
                const d = botDecide(G, b);
                if (d.cmd) act(G, d.cmd);
                step(G, d.inp || { x: 0, y: 0, a: false, dir: null }, STEP);
                if (G.events.length > 200) G.events.splice(0, G.events.length - 50);
            }
            flushEvents();
            return G;
        },
        busy: () => view.busy || (G?.events.length ?? 0) > 0,
        save: () => saveGame(G),
        hasSave,
        place: (id) => { G.pos = { x: PLACES[id].x, z: PLACES[id].z + 0.5, face: 0 }; },
        grades: GRADES,
    };
}
