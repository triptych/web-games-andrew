// Hemlock Hollow: entry point. Boots the view, feeds typed commands to the sim, prints what the
// sim says, and moves between the title, play, death and the ending.
//
// ?debug=1 exposes window.__hh for the dev/ harnesses; &fast=1 prints text instantly.

import { VERSION } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, checkpoint, restore, latest, clearSave } from './save.js';
import { newGame, act, statusOf, sceneOf } from './sim/game.js';
import { runScript, play, WALKTHROUGH } from './sim/bot.js';
import { ROOMS } from './sim/data/rooms.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
if (DEBUG && params.get('fast')) settings.speed = 'instant';
if (window.A11Y?.reducedMotion) settings.speed = settings.speed === 'instant' ? 'instant' : 'fast';
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const view = new View($('view'));
view.calm = !!window.A11Y?.reducedMotion;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onCommand: (c) => submit(c),
});

let G = newGame(1);
G.events.length = 0;
let mode = 'title';          // title | play | dead | over
const seen = {};             // a count of every sim event drained, for the tests
const history = []; let hist = -1;
let afterTyping = null;      // a screen to open once the text has finished typing

// ------------------------------------------------------------------ layout: size the page from the visible viewport
function layout() {
    const vv = window.visualViewport;
    document.documentElement.style.setProperty('--vh', Math.round(vv ? vv.height : innerHeight) + 'px');
}
layout();
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ------------------------------------------------------------------ events
function handle(evs) {
    const sfxEvs = [];
    for (const e of evs) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        if (e.type === 'say') ui.print(e.text, e.cls);
        else if (e.type === 'chapter') ui.card(e);
        else if (e.type === 'room') { view.onRoom(); ui.roomName(ROOMS[e.id].name); }
        else if (e.type === 'score') ui.toast(`+${e.n}`);
        else if (e.type === 'clue') ui.toast('Journal updated');
        else if (e.type === 'meta') meta(e.cmd);
        else if (e.type === 'dead') afterTyping = () => showDead(e);
        else if (e.type === 'end') afterTyping = () => showEnd(e);
        if (e.type === 'sfx' || e.type === 'room' || e.type === 'score' || e.type === 'dead' || e.type === 'end' || e.type === 'dread') sfxEvs.push(e);
    }
    audio.onEvents(G, sfxEvs);
    audio.setDread(G.dread);
    ui.status(G);
    ui.chips(G);
    if (evs.some((e) => e.type === 'checkpoint') && !G.dead) checkpoint(G, ui.lines);
    if (ui.idle() && afterTyping) { const f = afterTyping; afterTyping = null; f(); }
}
function drain() { handle(G.events.splice(0)); }

function submit(line) {
    line = String(line || '').trim();
    if (!line || mode !== 'play') return;
    ui.flush();
    ui.echo(line);
    history.push(line); hist = history.length;
    act(G, line);
    drain();
    $('cmd').value = ''; ui.pending = null; ui.first = null; ui.chips(G);
}

function meta(cmd) {
    if (cmd === 'save') { checkpoint(G, ui.lines, true) ? ui.toast('Game saved.') : ui.toast('Could not save (storage blocked).'); }
    else if (cmd === 'restore') doRestore();
    else if (cmd === 'restart') startGame(newGame((Date.now() % 1e9) | 0));
    else if (cmd === 'quit') toTitle(true);
}

// ------------------------------------------------------------------ flow
function startGame(g, log) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'play'; afterTyping = null;
    document.body.classList.remove('title'); view.title = false;
    ui.clearLog();
    if (log) { ui.setLog(log); ui.print('— You take up the thread again. —', 'sys'); }
    ui.reset();
    drain();
    if (log) { act(G, 'look'); drain(); }
    ui.roomName(ROOMS[G.room].name);
    if (!matchMedia('(pointer: coarse)').matches) $('cmd').focus({ preventScroll: true });
}

function toTitle(save) {
    if (save && mode === 'play') checkpoint(G, ui.lines, true);
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title'; view.title = true;
    document.body.classList.add('title');
    refreshTitle();
    ui.openScreen('title');
}

function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

function doRestore() {
    const r = restore();
    if (!r) { ui.toast('Nothing to restore.'); startGame(newGame((Date.now() % 1e9) | 0)); return; }
    startGame(r.G, r.log);
    ui.toast('Restored.');
}

function showDead(e) {
    mode = 'dead';
    $('dead-title').textContent = e.title;
    $('dead-text').textContent = e.text;
    $('dead-restore').hidden = !hasSave();
    ui.openScreen('dead');
}
function showEnd(e) {
    mode = 'over';
    $('over-title').textContent = e.title;
    $('over-score').textContent = `Score: ${e.score} of 100. Evidence ${G.evidence.length} of 5. Captives freed ${G.rescued.length} of 4. ${e.ending === 'dawn' ? 'The best ending.' : 'Another road is waiting.'}`;
    clearSave(); refreshTitle();
    ui.openScreen('over');
}

// ------------------------------------------------------------------ menus
refreshTitle();
ui.openScreen('title');
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const act_ = b.dataset.act;
    if (act_ === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (act_ === 'continue') { const r = latest(); if (r) startGame(r.G, r.log); else ui.toast('That save could not be read.'); }
    else ui.openScreen(act_);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'save') { meta('save'); }
    else if (a === 'quit') toTitle(true);
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());
$('dead-restore').addEventListener('click', () => doRestore());
$('dead-restart').addEventListener('click', () => startGame(newGame((Date.now() % 1e9) | 0)));
$('dead-title-btn').addEventListener('click', () => toTitle(false));
$('over-again').addEventListener('click', () => startGame(newGame((Date.now() % 1e9) | 0)));
$('over-title-btn').addEventListener('click', () => toTitle(false));
function pause() { if (mode === 'play' && !ui.anyScreen()) { ui.flush(); ui.openScreen('pause'); } }

const coarse = matchMedia('(pointer: coarse)').matches;
function setChips(on) { $('quick').classList.toggle('off', !on); $('btn-chips').setAttribute('aria-pressed', String(on)); }
setChips(coarse);
$('btn-chips').addEventListener('click', () => setChips($('quick').classList.contains('off')));
$('cmdform').addEventListener('submit', (e) => { e.preventDefault(); submit($('cmd').value); });
$('cmd').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hist = Math.max(0, hist - 1); $('cmd').value = history[hist]; }
    else if (e.key === 'ArrowDown' && history.length) { e.preventDefault(); hist = Math.min(history.length, hist + 1); $('cmd').value = history[hist] || ''; }
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (ui.anyScreen()) { if (!['title', 'dead', 'over'].includes(ui.top())) ui.closeTop(); } else pause();
    } else if (mode === 'play' && !ui.anyScreen() && document.activeElement === document.body && e.key.length === 1 && !e.ctrlKey && !e.metaKey) $('cmd').focus();
    else if (e.key === ' ' && ui.queue.length) ui.flush();
});
$('log').addEventListener('click', () => ui.flush());

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !G.dead) checkpoint(G, ui.lines, true); });
window.addEventListener('pagehide', () => { if (mode === 'play' && !G.dead && !G.ending) checkpoint(G, ui.lines, true); });

// ------------------------------------------------------------------ frame loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    ui.update(dt);
    view.frame(G, dt);
    if (afterTyping && ui.idle()) { const f = afterTyping; afterTyping = null; f(); }
}
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hh = {
        get G() { return G; },
        get mode() { return mode; },
        seen, ui, view, audio,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        run(cmd) { submit(cmd); return G; },
        /** Play the first n commands of the walkthrough through the real UI path, the way a careful player would. */
        walk(n = Infinity) {
            let k = 0;
            const one = (cmd) => { ui.flush(); ui.echo(cmd); play(G, cmd, handle); };
            for (const st of WALKTHROUGH) {
                if (G.dead || G.ending) break;
                if (typeof st === 'string') { if (k++ >= n) break; one(st); }
                else if (st[0] === 'wait*') { for (let i = 0; i < 12 && !G.flags[st[1]] && !G.dead; i++) one('wait'); }
                else if (st[0] === 'rest*') { for (let i = 0; i < 8 && G.ember < st[1] && !G.dead; i++) one('rest'); }
            }
            return G;
        },
        autowin() { return runScript(G, WALKTHROUGH, () => {}); },
        status: () => statusOf(G), scene: () => sceneOf(G), version: VERSION,
    };
}
