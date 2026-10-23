// THE LONG HELIX — entry point. Boots the terminal, runs the power-on and floppy-boot show, routes
// keys and clicks to the story, and moves between power, boot, title, play and the end.
//
// ?debug=1 exposes window.__lh for the dev/ harnesses and skips the boot show (add &boot=1 to keep it);
// &fast=N types and draws N× faster.

import { VERSION, TYPE_CPS } from './config.js';
import { View } from './view/terminal.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, choose, useItem, dropItem, passageOf } from './sim/game.js';
import { makeBot, botAct, botDo } from './sim/bot.js';
import { NODES } from './sim/story.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(60, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);
const ENDING_TOTAL = Object.values(NODES).filter((n) => n.end).length;

const settings = loadSettings();
const audio = new Audio();
const input = new Input();
const view = new View($('transcript'), $('story'));
view.fast = FAST;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onUse: (id) => itemAction(() => useItem(G, id)),
    onDrop: (id) => itemAction(() => dropItem(G, id)),
});

let G = newGame(1);
let mode = 'power';              // power | boot | title | play | over
let last = performance.now();
let bot = null;
let boot = null;                 // the running boot show
const seen = {};                 // a count of every sim event drained, for the tests

function applySettings() {
    document.body.dataset.phosphor = settings.phosphor;
    document.body.dataset.crt = settings.crt;
    view.speed = TYPE_CPS[settings.speed] ? settings.speed : 'normal';
    audio.setVolumes(settings.sfx, settings.hum);
    view.setPhosphor();
}
applySettings();
view.onChar = (ch) => audio.key(ch);
view.drawStatic($('title-art'), 'title');

// ------------------------------------------------------------------ power on and the floppy boot
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / FAST));

function showPower() {
    mode = 'power';
    $('boot').hidden = false;
    $('boot-text').textContent = '';
    document.querySelector('.boot-hint').textContent = 'PRESS ANY KEY OR TAP TO SWITCH ON THE MONITOR';
}

async function runBoot() {
    mode = 'boot';
    const token = boot = { skipped: false };
    const pre = $('boot-text');
    document.querySelector('.boot-hint').textContent = 'PRESS ANY KEY OR TAP TO SKIP';
    const say = async (text, ms = 120) => { if (token.skipped) return; pre.textContent += text + '\n'; audio.key('a'); await sleep(ms); };
    await say('HGC-720 MONOCHROME GRAPHICS ADAPTER  V1.2', 200);
    await say('VIDEO RAM 64K  720 x 348  ........ OK', 200);
    await say('VESPER BIOS 2.04   (C) 1986 VESPER SOFTWARE WORKS', 160);
    if (!token.skipped) {
        const base = pre.textContent;
        for (let k = 0; k <= 640 && !token.skipped; k += 64) { pre.textContent = base + `MEMORY TEST ${String(k).padStart(3)}K`; await sleep(45); }
        if (!token.skipped) pre.textContent = base + 'MEMORY TEST 640K OK\n';
    }
    await say('KEYBOARD ........................ OK', 100);
    await say('DRIVE A: 360K   DRIVE B: NONE', 160);
    await say('', 100);
    await say('INSERT SYSTEM DISK IN DRIVE A:', 250);
    if (!token.skipped) audio.floppy('boot');
    await sleep(1400);
    await say('A>HELIX.EXE', 200);
    await say(`LOADING THE LONG HELIX V${VERSION} ...`, 500);
    await say('SEQUENCE LOADED. 13 JOURNAL PAGES. 7 ENDINGS.', 300);
    if (!token.skipped) await sleep(400);
    finishBoot();
}

function finishBoot() {
    if (boot) boot.skipped = true;
    boot = null;
    $('boot').hidden = true;
    toTitle();
}

function powerOn() {
    audio.init();
    runBoot();
}

// ------------------------------------------------------------------ menus
function refreshTitle() {
    $('btn-continue').hidden = !hasSave();
    ui.setEndings(settings.endings, ENDING_TOTAL);
}

function toTitle() {
    ui.closeAll();
    $('game').hidden = true;
    mode = 'title';
    bot = null;
    G = newGame(1);
    view.clear();
    refreshTitle();
    ui.openScreen('title');
}

function startGame(g, restored = false) {
    G = g;
    ui.closeAll();
    // a focused button would swallow Enter and Space for the whole game
    document.activeElement?.blur?.();
    $('game').hidden = false;
    mode = 'play';
    input.flush();
    ui.sel = null; ui.sig = '';
    ui.setTab('story');
    view.setPhosphor();
    if (restored) { view.restore(G); G.events.length = 0; }
    else { view.clear(); flushEvents(); }
    saveGame(G);
}

const newSeed = () => (Date.now() % 1e9) | 0;
function menuClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') { clearSave(); startGame(newGame(newSeed())); }
    else if (act === 'continue') {
        const g = loadGame();
        if (g) { audio.floppy('read'); startGame(g, true); } else ui.toast('That save could not be read');
    } else if (act === 'resume') ui.closeScreen('menu');
    else if (act === 'quit') { saveGame(G); audio.floppy('write'); toTitle(); }
    else ui.openScreen(act);
}
$('title-menu').addEventListener('click', menuClick);
$('menu-list').addEventListener('click', menuClick);
$('btn-menu').addEventListener('click', () => openMenu());
$('btn-journal').addEventListener('click', () => { audio.ui('open'); ui.openScreen('journal'); });
view.onEndAction = (act) => { audio.ui('click'); if (act === 'new') { clearSave(); startGame(newGame(newSeed())); } else toTitle(); };

function openMenu() {
    if (mode !== 'play' && mode !== 'over') return;
    if (ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('menu');
    $('btn-menu').blur();
}

$('boot').addEventListener('pointerdown', () => { if (mode === 'power') powerOn(); else if (mode === 'boot') finishBoot(); });
// a tap or click on the story while it is typing finishes the typing
$('story').addEventListener('pointerdown', () => { if (view.busy) view.skip(); });

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ acting
view.onChoose = (i) => doChoose(i);

function doChoose(i) {
    if (mode !== 'play' || view.busy || ui.anyScreen()) return false;
    audio.ui('click');
    view.clearChoices();
    const ok = choose(G, i);
    flushEvents();
    if (!G.over) saveGame(G);
    return ok;
}

function itemAction(fn) {
    if (mode !== 'play') return;
    const ok = fn();
    const ev = G.events.splice(0);
    audio.onEvents(G, ev);
    const msg = ev.filter((e) => e.type === 'notice').map((e) => e.text)[0];
    if (msg) ui.toast(msg.length > 70 ? msg.slice(0, 67) + '...' : msg);
    else if (ok) ui.toast('Done');
    ui.sig = '';
    if (ok) saveGame(G);
}

function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    // a screen reader hears the new text at once, not as it is typed
    const spoken = ev.flatMap((e) => (e.type === 'result' ? e.lines : e.type === 'scene' && !e.quiet ? passageOf(G, e.node).lines : []));
    if (spoken.length) window.A11Y?.announce?.(spoken.join(' '));
    const end = ev.find((e) => e.type === 'end');
    if (end) {
        mode = 'over';
        clearSave();
        if (!settings.endings.includes(end.id)) { settings.endings.push(end.id); saveSettings(settings); }
    }
}

// ------------------------------------------------------------------ input routing
// the arrows move focus the moment they are pressed (see input.js); while the story is typing they queue,
// and then finish the typing like any other key
input.onArrow = (dir) => {
    if (mode === 'power' || mode === 'boot') return false;
    if (ui.anyScreen()) { ui.moveFocus(dir); return true; }
    if ((mode === 'play' || mode === 'over') && !view.busy) { view.moveFocus(dir); return true; }
    return false;
};

function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (mode === 'power') { powerOn(); return; }
    if (mode === 'boot') { finishBoot(); return; }
    if (ui.anyScreen()) {
        if (key === 'Escape' && ui.top() !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'KeyJ' && ui.top() === 'journal') { audio.ui('close'); ui.closeTop(); }
        return;
    }
    if (mode !== 'play' && mode !== 'over') return;
    // while the story is typing, any key finishes it and does nothing else
    if (view.busy) { view.skip(); return; }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(key);
    if (digit) { if (mode === 'play') view.pressNumber(+digit[1]); return; }
    if (key === 'Enter' || key === 'Space' || key === 'NumpadEnter') view.focusFirst();
    else if (key === 'Escape') { if ($('game').dataset.tab !== 'story') ui.setTab('story'); else openMenu(); }
    else if (key === 'KeyJ') { audio.ui('open'); ui.openScreen('journal'); }
    else if (key === 'KeyC') ui.setTab('sheet');
    else if (key === 'KeyI') ui.setTab('pack');
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    handlePresses();
    if (mode === 'play' || mode === 'over') {
        view.frame(dt);
        ui.sync(G);
        if (bot && mode === 'play' && !view.busy && !ui.anyScreen()) {
            const act = botAct(G, bot);
            if (act?.kind === 'choose') doChoose(act.i);
            else if (act) { botDo(G, bot, act); G.events.length = 0; }
        }
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') saveGame(G); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

if (DEBUG && params.get('boot') !== '1') toTitle();
else showPower();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__lh = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1) { clearSave(); startGame(newGame(seed)); return G; },
        choose: doChoose,
        autoplay(on = true, goal = 'edit', seed = 1) { bot = on ? makeBot({ seed, goal }) : null; },
        /** Play n bot actions synchronously, finishing the typing each time; events reach the view as usual. */
        ff(n, goal = 'edit', seed = 1) {
            const b = makeBot({ seed, goal });
            for (let k = 0; k < n && !G.over; k++) {
                view.skip();
                const act = botAct(G, b);
                if (!act) break;
                if (act.kind === 'choose') { view.clearChoices(); }
                botDo(G, b, act);
                flushEvents();
            }
            view.skip();
            return G;
        },
        skip: () => view.skip(),
        save: () => saveGame(G),
        hasSave,
    };
}
