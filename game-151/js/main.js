// One Shot — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and moves
// between the title, the hangar, the briefing, the rounds, the shot and its grade.
//
// ?debug=1 exposes window.__os for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, VERSION, SAVE_KEY } from './config.js';
import { View } from './view/view.js';
import { BoardView } from './view/board.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act } from './sim/game.js';
import { makeBot, botCmd } from './sim/bot.js';
import { BOSSES, LINES } from './sim/data.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View($('view'));
const ui = new UI({
    audio, settings,
    onAct: (cmd) => doAct(cmd),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-151'
const cloud = makeCloud({ game: 'game-151' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'play') saveGame(G); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const d = snapValue(snap, SAVE_KEY)?.data; return d ? `Mothership ${Math.min(d.unlocked + 1, BOSSES.length)} · ⬢ ${d.scrap}` : 'A sortie'; },
    version: VERSION,
    toast: (t) => ui.toast(t),
});
const board = new BoardView($('board'), {
    onSwap: (a, b) => doAct({ t: 'swap', a, b }),
});

let G = newGame(1);
let mode = 'title';          // title | play
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null, botSkill = 1;
let wasRunning = false;
let rushSaid = -1;
let introSaid = false;
const seen = {};             // a count of every sim event drained, for the tests
const PHASE_SCREENS = ['hangar', 'brief', 'route', 'result'];

function doAct(cmd) {
    const ok = act(G, cmd);
    if (!ok && cmd.t === 'buy') audio.ui('bad');
    if (ok && cmd.t === 'buy') { audio.play('route', { vol: 0.6 }); }
    flushEvents();
    syncScreens();
    return ok;
}

// ------------------------------------------------------------------ the screens that follow the sim
function phaseScreen() {
    if (mode !== 'play') return null;
    if (!G.m) return 'hangar';
    return { brief: 'brief', clear: 'route', result: 'result' }[G.m.phase] || null;
}
function syncScreens() {
    const want = phaseScreen();
    for (const id of PHASE_SCREENS) if (id !== want && !$(id).hidden) ui.closeScreen(id);
    if (want === 'hangar') ui.renderHangar(G);
    if (want === 'brief') ui.renderBrief(G);
    if (want === 'result') ui.renderResult(G);
    if (want && $(want).hidden) {
        // a screen opened over a running round must not take the finger or key that triggered it
        document.activeElement?.blur?.();
        ui.openScreen(want);
    }
    const fighting = mode === 'play' && G.m && ['round', 'lance', 'beam', 'clear'].includes(G.m.phase);
    ui.showHud(!!fighting);
    board.enabled = !!(fighting && (G.m.phase === 'round' || G.m.phase === 'lance'));
    $('btn-skip').hidden = !(G.m && G.m.phase === 'beam');
    $('pause-abort').hidden = !(G.m && ['round', 'lance', 'clear', 'brief'].includes(G.m.phase));
}

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
cloudUI.boot();

const unlock = () => { audio.init(); if (mode === 'title') audio.setTheme('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); cloudUI.autosave({ force: true }); toTitle(); }
    else if (a === 'cloud') cloudUI.open();
    else if (a === 'abort') { ui.closeScreen('pause'); doAct({ t: 'abort' }); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());
$('btn-fire').addEventListener('pointerdown', (e) => { e.preventDefault(); doAct({ t: 'fire' }); });
$('btn-fire').addEventListener('click', () => doAct({ t: 'fire' }));      // keyboard Enter on a focused button
$('btn-skip').addEventListener('click', () => doAct({ t: 'skip' }));
$('view').addEventListener('pointerdown', () => { if (G.m?.phase === 'beam' && G.m.t > 1.5) doAct({ t: 'skip' }); });
$('brief-launch').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'launch' }); });
$('brief-back').addEventListener('click', () => { audio.ui('close'); doAct({ t: 'abort' }); });
$('result-done').addEventListener('click', () => {
    audio.ui('click');
    const ending = G.m?.result?.ending;
    doAct({ t: 'done' });
    if (ending) { ui.openScreen('ending'); sayLines(LINES.ending); }
});
$('result-retry').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'retry' }); });
$('hangar-go').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'start', level: G.ended ? BOSSES.length - 1 : Math.min(G.unlocked, BOSSES.length - 1) }); });
$('hangar-menu').addEventListener('click', () => { audio.ui('click'); ui.openScreen('pause'); });

function startGame(g) {
    G = g;
    // a save taken mid-shot lands on its grade
    if (G.m?.phase === 'beam') act(G, { t: 'skip' });
    G.events.length = 0;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    view.setLevel(G.m ? G.m.level : Math.min(G.unlocked, BOSSES.length - 1));
    view.resetBoss();
    audio.setTheme(G.m && G.m.phase === 'lance' ? 'lance' : G.m && G.m.phase === 'round' ? 'battle' : 'title');
    syncScreens();
    if (!G.m && G.missions === 0 && !introSaid) { introSaid = true; sayLines(LINES.intro); }
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    G = newGame(1);
    syncScreens();
    refreshTitle();
    ui.openScreen('title');
    audio.setTheme('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

/** Lines one after another, each when the last has finished. */
let sayQ = [];
function sayLines(lines) { sayQ = [...lines]; nextLine(); }
function nextLine() {
    const l = sayQ.shift();
    if (!l) return;
    ui.say(l, audio);
    setTimeout(nextLine, ui.commT * 1000);
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    input.poll();
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' || key === 'KeyP') {
            const top = ui.top();
            if (top === 'brief') doAct({ t: 'abort' });
            else if (['pause', 'settings', 'howto', 'ending'].includes(top)) { audio.ui('close'); ui.closeTop(); }
            else if (top === 'hangar') ui.openScreen('pause');
        } else if (press.pad && (key === 'Space')) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play' || !G.m) return;
    const ph = G.m.phase;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (ph === 'beam' && (key === 'Space' || key === 'Enter')) doAct({ t: 'skip' });
    else if (key === 'KeyF' || key === 'Enter') doAct({ t: 'fire' });
    else if (ph === 'round' || ph === 'lance') {
        const dir = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[key];
        if (dir) board.key(dir);
        else if (key === 'Space' || key === 'KeyZ' || key === 'KeyJ') board.pick();
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev, time);
    board.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        switch (e.type) {
            case 'brief': sayLines(LINES.brief[BOSSES[e.level].id] || []); break;
            case 'round':
                ui.clearReadout();
                rushSaid = -1;
                if (e.round === 0) ui.say(LINES.launch, audio);
                break;
            case 'roundEnd':
                ui.renderRoute(G, e);
                if (e.cleared) ui.say(LINES.clear, audio);
                break;
            case 'clear':
                if (e.rush >= 6 && rushSaid !== G.m?.round) { rushSaid = G.m?.round; ui.say(LINES.rush, audio); }
                break;
            case 'exposed': ui.say(LINES.exposed, audio); break;
            case 'shift': if (G.m?.phase === 'lance' || Math.random() < 0.35) ui.say(LINES.shift, audio); break;
            case 'lowHull': ui.say(LINES.lowHull, audio); break;
            case 'downed': ui.say(LINES.downed, audio); break;
            case 'fire': ui.cutin(); if (!G.m?.desperate) setTimeout(() => ui.say(LINES.fire, audio), 50); break;
            case 'stage': {
                const ok = e.ratio >= 1, r = e.ratio.toFixed(2) + '×';
                const txt = {
                    speed: ok ? `SPEED ${r} · LOCKED ON` : `SPEED ${r} · IT DODGES`,
                    barrier: ok ? `ELEMENTS ${r} · BARRIER BROKEN` : `ELEMENTS ${r} · BARRIER HOLDS`,
                    armor: ok ? `POWER ${r} · ARMOR PIERCED` : `POWER ${r} · ARMOR HOLDS`,
                }[e.key];
                ui.readout(txt, ok ? 'ok' : 'no');
                break;
            }
            case 'destroyed': ui.readout('DESTROYED!', 'ok verdict'); setTimeout(() => ui.say(LINES.destroyed, audio), 400); break;
            case 'survived': ui.readout('IT SURVIVED', 'no verdict'); ui.say(LINES.survived, audio); break;
            case 'result': ui.clearReadout(); saveGame(G); break;
            case 'hangar': saveGame(G); break;
        }
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    ui.tick(dt);

    const m = G.m;
    const running = mode === 'play' && m && ['round', 'lance', 'beam'].includes(m.phase) && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            step(G, STEP);
            if (bot && G.m) { const c = botCmd(G, bot, STEP); if (c) act(G, c); }
            acc -= STEP;
            n++;
            if (G.events.length) { flushEvents(); syncScreens(); }
            if (!G.m || !['round', 'lance', 'beam'].includes(G.m.phase)) break;
        }
        saveT += dt;
        if (saveT > 15) { saveT = 0; saveGame(G); cloudUI.autosave(); }
    } else {
        acc = 0;
        // the bot also works the hangar and the screens between rounds
        if (bot && mode === 'play' && !['pause', 'settings', 'howto', 'ending'].includes(ui.top())) {
            const c = botCmd(G, bot, dt);
            if (c) doAct(c);
        }
    }
    flushEvents();
    const L = ui.layout(!!(G.m && G.m.phase === 'beam'));
    view.setRegion(L.region);
    board.place(L.board.x, L.board.y, L.board.size);
    if (mode === 'play' && G.m) ui.hud(G);
    if (G.m && ['round', 'lance', 'beam', 'clear'].includes(G.m.phase)) board.frame(G, dt, time);
    view.frame(G, dt, time, mode);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (mode === 'play') saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); cloudUI.autosave({ keepalive: true }); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__os = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, board,
        /** A fresh game straight into the briefing of `level` (or launched, with launch = true). */
        start(seed = 1, level = 0, launch = false) {
            const g = newGame(seed);
            g.unlocked = Math.max(level, 0);
            startGame(g);
            doAct({ t: 'start', level });
            if (launch) doAct({ t: 'launch' });
            return G;
        },
        act: (cmd) => doAct(cmd),
        autoplay(on = true, skill = 1) { botSkill = skill; bot = on ? makeBot({ skill, seed: 3 }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, skill = botSkill) {
            const b = makeBot({ skill, seed: 5 });
            for (let t = 0; t < sec; t += STEP) {
                if (!G.m) break;
                step(G, STEP);
                const c = botCmd(G, b, STEP);
                if (c && c.t !== 'done' && c.t !== 'route') act(G, c);
                if (G.m && G.m.phase === 'clear') break;
            }
            flushEvents();
            syncScreens();
        },
        save: () => saveGame(G),
        hasSave,
        syncScreens,
    };
}
