// SEEDFALL — entry point. Boots the view, runs the fixed-step simulation, routes input, commands and events, and
// moves between the title, the year and its ending.
//
// ?debug=1 exposes window.__sf for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low|high.

import { STEP, MAX_FRAME, SPEEDS } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, talkChoices, currentGoal } from './sim/game.js';
import { makeBot, botTick } from './sim/bot.js';
import { ZONES, ENEMIES } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const coarse = window.matchMedia?.('(pointer: coarse)').matches;
const quality = params.get('q') || (settings.quality === 'auto' ? (coarse ? 'medium' : 'high') : settings.quality);
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
input.sens = settings.sens; input.invert = settings.invert;
const canvas = document.getElementById('view');
input.bindCanvas(canvas);
const view = new View(canvas, quality);

/** The title screen looks out of the Command Deck window at Cradle. */
function titleGame() {
    const g = newGame(7);
    g.talk = null; g.queue.length = 0;
    g.me.x = -1.5; g.me.z = -39; g.me.yaw = 0.1; g.me.pitch = -0.05; g.me.room = 'command';
    g.events.length = 0;
    return g;
}
let G = titleGame();
let mode = 'title';                 // title | play | over
let fadeUntil = 0;
let acc = 0, time = 0, last = performance.now(), saveT = 0, bot = null, wasRunning = false, swallowUntil = 0;
const seen = {};
const cmds = [];                    // commands from buttons, drained in order at the start of a frame
const send = (c, cb) => cmds.push({ c, cb });

const ui = new UI({
    audio, settings, send,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); input.sens = s.sens; input.invert = s.invert; updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame(((Date.now() % 1e9) | 0) + 1));
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'abort') { ui.closeScreen('pause'); send({ t: 'abort' }); }
    else ui.openScreen(a);
});
for (const id of ['btn-pause', 'btn-pause2']) $(id).addEventListener('click', () => pause());
for (const b of document.querySelectorAll('#hud-speeds button')) b.addEventListener('click', () => { audio.ui('click'); send({ t: 'speed', i: +b.dataset.speed }); });
$('hud-use').addEventListener('click', () => useTerminal());
$('report-ok').addEventListener('click', () => { audio.ui('click'); send({ t: 'report' }); ui.closeScreen('report'); saveGame(G); });
$('ending-again').addEventListener('click', () => { audio.ui('click'); clearSave(); toTitle(); });

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.G = G;
    ui.showHud(G.mode === 'mission' ? 'mission' : 'station');
    updateTouch();
    if (G.report) ui.showReport(G);
    saveGame(G);
}
function toTitle() {
    ui.closeAll();
    mode = 'title';
    input.exitLock();
    ui.showHud(null);
    G = titleGame();
    ui.G = G;
    refreshTitle();
    ui.openScreen('title');
}
function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    input.exitLock();
    if (G.mode !== 'mission') saveGame(G);
    $('btn-abort').hidden = G.mode !== 'mission';
    ui.openScreen('pause');
}
function useTerminal() {
    if (mode !== 'play' || G.mode !== 'station' || G.talk || ui.anyScreen() || !G.near) return;
    send({ t: 'use' }, (r) => {
        if (!r.ok) return;
        if (G.talk) pendingPanel = r.panel; else openPanel(r.panel);
    });
}
let pendingPanel = null;
function openPanel(p) {
    if (!p || p === 'iris' || p === 'pod') return;
    input.exitLock();
    ui.openPanel(p, G);
}

function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindLook($('look-zone'));
input.bindHold($('btn-a'), 'a');
input.bindHold($('btn-b'), 'b');
input.bindHold($('btn-c'), 'c');
input.bindHold($('btn-r'), 'r');
canvas.addEventListener('click', () => {
    if (mode !== 'play' || ui.anyScreen()) return;
    if (G.talk) { ui.talkAdvance(); return; }
    input.requestLock();
});
// a tap on the station view in touch mode never acts; the Use button does

// ------------------------------------------------------------------ presses
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const k = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (k === 'ArrowDown' || k === 'ArrowRight' && top !== 'term') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft' && top !== 'term') ui.moveFocus(-1);
        else if ((k === 'Escape' || k === 'KeyP') && top !== 'title' && top !== 'ending' && top !== 'report') { audio.ui('close'); ui.closeTop(); }
        else if ((k === 'Enter' || k === 'Space') && press.pad) document.activeElement?.click?.();
        else if (k === 'Enter' && top === 'report') $('report-ok').click();
        return;
    }
    if (mode !== 'play') return;
    if (G.talk) {
        if (performance.now() < swallowUntil) return;
        if (talkChoices(G) && document.activeElement?.dataset?.choice) {
            if (k === 'ArrowDown' || k === 'ArrowUp') { const bs = [...document.querySelectorAll('#talk-choices button')]; const i = bs.indexOf(document.activeElement); bs[(i + (k === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); }
            return;
        }
        if (['Enter', 'Space', 'KeyE', 'KeyF', 'NumpadEnter'].includes(k)) ui.talkAdvance();
        else if (k === 'Escape') pause();
        return;
    }
    if (k === 'Escape' || k === 'KeyP') { pause(); return; }
    if (G.mode === 'station' && ['KeyE', 'KeyF', 'Enter', 'Space', 'NumpadEnter'].includes(k)) useTerminal();
    if (G.mode === 'station' && k === 'Tab') { /* nothing */ }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    if (mode === 'play') ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'deploy') { fadeUntil = performance.now() + 600; ui.showHud('mission'); }
        if (e.type === 'missionEnd') { ui.showHud('station'); input.flush(); swallowUntil = performance.now() + 300; saveGame(G); }
        if (e.type === 'talk') { swallowUntil = performance.now() + 250; }
        if (e.type === 'ending') { mode = 'over'; clearSave(); }
    }
}

function music() {
    if (mode === 'over' || G.over) return 'end';
    if (G.mode !== 'mission' || !G.mission) return 'station';
    if (G.mission.enemies.some((e) => ENEMIES[e.type].boss && e.alive && e.provoked)) return 'boss';
    return ZONES[G.mission.zone].id === 'hollow' ? 'hollow' : 'planet';
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    input.frame(dt);
    handlePresses();
    while (cmds.length) { const { c, cb } = cmds.shift(); const r = act(G, c); cb?.(r); }

    const running = mode === 'play' && !ui.anyScreen() && !G.talk && !G.over;
    input.world = running;
    if (running && !wasRunning) input.flush();      // the key that closed a menu must not act (game-078)
    wasRunning = running;
    document.getElementById('crosshair').hidden = !(running && G.mode === 'mission');
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? (botTick(G, bot) || { x: 0, y: 0, turn: 0 }) : input.state();
            if (n === 0 && G.mode === 'mission') view.addPitch(inp.pitch || 0);
            if (G.mode === 'mission' && !bot) inp.pitch = 0;
            step(G, inp, STEP);
            input.consumeEdges();
            acc -= STEP;
            n++;
            if (G.talk || G.over || ui.anyScreen()) break;
        }
        saveT += dt;
        if (saveT > 20 && G.mode === 'station') { saveT = 0; saveGame(G); }
    } else {
        acc = 0;
        if (bot && mode === 'play' && !ui.anyScreen()) botTick(G, bot);
    }
    flushEvents();
    // what follows from the sim's state: a report, an ending, a panel waiting for TILLY to finish
    if (mode === 'play' && !G.talk && pendingPanel) { const p = pendingPanel; pendingPanel = null; openPanel(p); }
    if (mode === 'play' && !G.talk && G.report && G.mode === 'station' && ui.top() !== 'report' && !bot) ui.showReport(G);
    if (mode === 'over' && !G.talk && ui.top() !== 'ending') { ui.showHud(null); input.exitLock(); ui.showEnding(G); }
    audio.setTheme(mode === 'title' ? 'station' : music());

    if (mode === 'title') { G.me.yaw = 0.1 + Math.sin(time * 0.07) * 0.12; G.me.pitch = -0.08 + Math.sin(time * 0.05) * 0.03; G.day = 120 + Math.sin(time * 0.1) * 80; }
    $('fade').style.opacity = Math.max(0, (fadeUntil - performance.now()) / 600).toFixed(3);
    view.goalTerm = mode === 'play' ? (G.talk ? null : currentGoalTerm()) : null;
    view.frame(G, dt * (DEBUG ? Math.min(FAST, 4) : 1), time);
    if (mode === 'play' || mode === 'over') { ui.talk(G, dt); ui.hud(G); ui.refreshPanel(); }
}
function currentGoalTerm() { try { return currentGoal(G).term || null; } catch { return null; } }

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (mode === 'play' && G.mode === 'station') saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__sf = {
        get G() { return G; }, set G(g) { G = g; ui.G = g; },
        get mode() { return mode; },
        seen, view, ui, audio, input, SPEEDS,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        /** Skip TILLY's lines until a choice or the queue is empty. */
        skipTalk() { let n = 0; while (G.talk && !talkChoices(G) && n++ < 500) act(G, { t: 'next' }); return !G.talk; },
        act(c) { const r = act(G, c); flushEvents(); return r; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the whole game ahead synchronously with the bot playing, for seconds of sim time or until pred(G). */
        ff(sec, pred) { const b = makeBot(); let t = 0; while (t < sec && !G.over && !(pred && pred(G))) { const inp = botTick(G, b); if (inp) { step(G, inp, STEP); t += STEP; } else t += STEP * 4; } flushEvents(); return G; },
        step(inp, n = 1) { for (let i = 0; i < n; i++) step(G, { x: 0, y: 0, turn: 0, ...inp }, STEP); flushEvents(); },
        save: () => saveGame(G), hasSave,
        probe: () => { view.frame(G, 0.016, time); return view.probe(); },
    };
}
