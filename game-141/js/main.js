// SANDSUNK: entry point. Boots the view, the museum viewer, sound and the UI; turns taps, clicks and keys into
// commands for act(); drains G.events to the view, the sound and the UI once per command; and moves between the
// title, the dig, camp and the ending.
//
// ?debug=1 exposes window.__ss for the dev/ harnesses (see dev/README.md).

import { MAX_FRAME, STORY_FLOORS } from './config.js';
import { View } from './view/view.js';
import { Museum } from './view/museum.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, exposed } from './sim/game.js';
import { makeBot, botCommand } from './sim/bot.js';
import { ITEM_ORDER } from './sim/data/items.js';
import { floorName } from './sim/data/story.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View($('view'));
view.shakeOn = settings.shake !== 'off' && !window.A11Y?.reducedMotion;
const museum = new Museum($('viewer-canvas'));
let G = newGame(1);            // the title screen shows a floor behind it
let mode = 'title';             // title | play
let markMode = false;
let saveDue = 0;
let bot = null, botT = 0;
const seen = {};                // a count of every sim event drained, for the tests

const ui = new UI({
    audio, view, museum, settings, cmd: (c) => command(c),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); view.shakeOn = s.shake !== 'off'; },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.onArm = () => { ui.hud(G); };

// ------------------------------------------------------------------ commands
function command(cmd) {
    if (mode !== 'play') return false;
    const ok = act(G, cmd);
    flushEvents();
    saveDue = 0.4;
    return ok;
}

function flushEvents() {
    if (!G.events.length) { ui.hud(G); return; }
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'camp') toCamp(e.why);
        else if (e.type === 'embark') fromCamp();
        else if (e.type === 'floor') enterFloor();
        else if (e.type === 'ending') showEnding();
        else if (e.type === 'descend') dive();
    }
    ui.hud(G);
    musicFor();
}

function musicFor() {
    if (mode !== 'play') { audio.music('camp'); return; }
    if (G.mode === 'camp') audio.music('camp');
    else if (G.mode === 'ending') audio.music('ending');
    else audio.music(G.F.treasure ? 'treasure' : 'dig');
}

function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
view.sync(G);

const unlock = () => { audio.init(); musicFor(); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ menus
$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
const openPanel = (id) => {
    audio.ui('open');
    if (id === 'shop') { if (G.mode !== 'camp') { ui.toast("Zahra's shop is up at camp."); return; } ui.renderShop(G); }
    if (id === 'skills') ui.renderSkills(G);
    if (id === 'quests') ui.renderQuests(G);
    if (id === 'museum') ui.renderMuseum(G);
    ui.openScreen(id);
};
$('btn-pause').addEventListener('click', () => pause());
$('btn-quests').addEventListener('click', () => openPanel('quests'));
$('btn-skills').addEventListener('click', () => openPanel('skills'));
$('hud-avatar').addEventListener('click', () => openPanel('skills'));
$('btn-museum').addEventListener('click', () => openPanel('museum'));
$('btn-shop').addEventListener('click', () => openPanel('shop'));
$('btn-camp').addEventListener('click', () => { audio.ui('click'); command({ t: 'camp' }); });
$('btn-descend').addEventListener('click', () => command({ t: 'descend' }));
$('btn-mark').addEventListener('click', () => setMark(!markMode));
for (const b of document.querySelectorAll('#camp [data-open]')) b.addEventListener('click', () => openPanel(b.dataset.open));
$('camp-embark').addEventListener('click', () => { audio.ui('click'); command({ t: 'embark' }); });
$('camp-quit').addEventListener('click', () => { audio.ui('click'); saveGame(G); toTitle(); });
$('ending-go').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('ending'); command({ t: 'continue' }); });
$('ending-quit').addEventListener('click', () => { audio.ui('click'); saveGame(G); toTitle(); });
$('viewer-prev').addEventListener('click', () => ui.stepViewer(-1));
$('viewer-next').addEventListener('click', () => ui.stepViewer(1));

function setMark(on) {
    markMode = on;
    $('btn-mark').setAttribute('aria-pressed', on ? 'true' : 'false');
    view.setCursor(view.cursor, markMode);
    audio.play('mark', { rate: on ? 1.1 : 0.8 });
}

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'play';
    input.flush();
    ui.showHud(true);
    ui.armed = null;
    setMark(false);
    view.sync(G);
    flushEvents();
    if (G.mode === 'camp') toCamp('load');
    else if (G.mode === 'ending') showEnding();
    saveGame(G);
    layout();
    musicFor();
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    ui.showHud(false);
    G = newGame(1);
    G.events.length = 0;
    view.sync(G);
    refreshTitle();
    ui.openScreen('title');
    layout();
    musicFor();
}

function toCamp(why) {
    for (const id of [...ui.stack]) if (id !== 'camp') ui.closeScreen(id);
    $('camp-heading').textContent = 'Camp on the Rim';
    $('camp-note').textContent = why === 'faint' ? 'The camel-drivers carried you up. Rest, restock, and climb back down when you are ready: the floor is just as you left it.'
        : why === 'tired' ? 'Worn out, you climbed the rope to rest. Your floor waits below, just as you left it.'
            : `Rested and ready. Floor ${G.n}, ${floorName(G.n)}, waits below.`;
    $('camp-embark').textContent = `Climb down to floor ${G.n}`;
    ui.openScreen('camp');
    musicFor();
}
function fromCamp() { ui.closeAll(); document.activeElement?.blur?.(); musicFor(); }
function showEnding() {
    $('ending-stats').textContent = `Reached level ${G.lv} · ${G.stats.blocks} blocks broken · ${G.stats.monsters} monsters bested · ${G.stats.disarmed} traps disarmed · ${G.stats.expeditions} expeditions`;
    ui.openScreen('ending');
}
function enterFloor() {
    view.sync(G);
    layout();
    ui.toast(`${G.n > STORY_FLOORS ? `Deep ${G.n - STORY_FLOORS}` : `Floor ${G.n}`}: ${floorName(G.n)}`, true);
}
function dive() {
    // the camera dives into the hatch while the screen washes to sand, then the new floor drops in
    view.cam.dive = 0.001;
    $('fade').classList.add('on');
    setTimeout(() => { $('fade').classList.remove('on'); view.cam.dive = 0; }, 520);
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ the board: taps, clicks, long-presses
const canvas = $('view');
let press = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen()) return;
    const i = view.pick(e.clientX, e.clientY);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, i, t: performance.now(), button: e.button, long: false };
    if (e.pointerType === 'touch') {
        press.timer = setTimeout(() => {
            if (!press || press.i < 0) return;
            press.long = true;
            boardAct(press.i, true);
        }, 420);
    }
});
canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && mode === 'play' && !ui.anyScreen()) view.setCursor(view.pick(e.clientX, e.clientY), markMode);
    if (press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) { clearTimeout(press.timer); press.i = -1; }
});
canvas.addEventListener('pointerup', (e) => {
    if (!press || press.id !== e.pointerId) return;
    clearTimeout(press.timer);
    const p = press;
    press = null;
    if (p.long || p.i < 0 || mode !== 'play' || ui.anyScreen()) return;
    boardAct(p.i, p.button === 2);
});
canvas.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });

/** What a tap on cell i means right now. alt = right-click or long-press: mark. */
function boardAct(i, alt) {
    if (G.mode !== 'dig') return;
    const c = G.F.cells[i];
    if (!c) return;
    view.setCursor(i, markMode);
    if (ui.armed) {
        const id = ui.armed;
        ui.armed = null;
        command({ t: 'use', id, i });
        return;
    }
    if (c.k === 'b' && (alt || markMode)) { command({ t: 'mark', i }); return; }
    command({ t: 'dig', i });
}

// ------------------------------------------------------------------ keys and the pad
function handlePresses() {
    const p = input.next();
    if (!p) return;
    const key = p.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'camp', 'ending'].includes(top)) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && p.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    const F = G.F;
    let c = view.cursor >= 0 ? view.cursor : F.start;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[key];
    if (mv) {
        const x = Math.max(0, Math.min(F.w - 1, (c % F.w) + mv[0])), y = Math.max(0, Math.min(F.h - 1, Math.floor(c / F.w) + mv[1]));
        view.setCursor(y * F.w + x, markMode);
        return;
    }
    if (key === 'Space' || key === 'Enter') { if (view.cursor < 0) view.setCursor(F.start, markMode); boardAct(view.cursor, false); return; }
    if (key === 'KeyF') { if (view.cursor >= 0) boardAct(view.cursor, true); return; }
    if (key === 'KeyX') { setMark(!markMode); return; }
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(key);
    if (n >= 0) { ui.useItem(ITEM_ORDER[n]); return; }
    if (key === 'KeyK') openPanel('skills');
    else if (key === 'KeyQ') openPanel('quests');
    else if (key === 'KeyM') openPanel('museum');
    else if (key === 'KeyC') command({ t: 'camp' });
    else if (key === 'KeyE' && F.cleared) command({ t: 'descend' });
    else if (key === 'Escape' || key === 'KeyP') { if (ui.armed) { ui.armed = null; ui.hud(G); } else pause(); }
}

// ------------------------------------------------------------------ frame loop
function layout() { view.setInsets(ui.insets()); }
let last = performance.now(), time = 0, layoutT = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    layoutT -= dt;
    if (layoutT <= 0) { layoutT = 0.5; layout(); }
    if (bot && mode === 'play' && !ui.anyScreen()) {
        botT -= dt;
        if (botT <= 0) {
            botT = bot.delay;
            const c = botCommand(G, bot);
            if (c) command(c);
        }
    }
    if (saveDue > 0) { saveDue -= dt; if (saveDue <= 0 && mode === 'play') saveGame(G); }
    ui.tick(dt);
    view.frame(G, dt, time);
    museum.frame(dt, time);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') { saveGame(G); pause(); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
input.onTouch = () => layout();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ss = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, museum, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        act(cmd) { return command(cmd); },
        /** Run n bot commands at once through the real command path (events reach the view and UI). */
        bot(n = 50, skill = 1, until = null) {
            const b = makeBot({ skill, seed: 3 });
            for (let k = 0; k < n; k++) {
                if (until && until(G)) break;
                if (G.mode === 'camp' || G.mode === 'ending') ui.closeAll();
                const c = botCommand(G, b);
                if (!c) return 'stuck';
                command(c);
            }
            return G.n;
        },
        autoplay(on = true, delay = 0.12) { bot = on ? { ...makeBot({ seed: 5 }), delay } : null; },
        exposed: (i) => exposed(G.F, i),
        cellAt: (i) => view.project(i),
        save: () => saveGame(G),
        hasSave,
    };
}
