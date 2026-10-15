// Salve & Scale — entry point. Boots the view, runs the fixed-step simulation, routes input
// (world, dialogue, the scan and menus) and events, and moves between the title and play.
//
// ?debug=1 exposes window.__ss for the dev/ harnesses; &fast=N runs N× simulation per frame;
// &quality=0|1|2 overrides the graphics setting.

import { STEP, MAX_FRAME, CELL } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, objective, objectiveRoute, patientById } from './sim/game.js';
import { facing, steerPoint, mapEnts, blocked } from './sim/world.js';
import { canExtend, linkTraits, focusLeft } from './sim/scan.js';
import { findHint } from './sim/search.js';
import { makeBot, botTick, choosePower, chooseChain } from './sim/bot.js';
import { SENSES } from './sim/data/ailments.js';
import { RELICS, EVIDENCE } from './sim/data/skills.js';
import { QUESTS } from './sim/data/story.js';
import { MAPS } from './sim/data/maps.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const coarse = window.matchMedia?.('(pointer: coarse)').matches;
const quality = params.has('quality') ? +params.get('quality') : settings.quality >= 0 ? settings.quality : 1;
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
input.sens = settings.sens; input.invert = settings.invert;
const canvas = document.getElementById('view');
const view = new View(canvas, quality);
input.bindCanvas(canvas);

let G = newGame(1);          // the title screen shows the clinic behind it
let mode = 'title';          // title | play
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null;
let wasRunning = false;
let swallowUntil = 0;        // after a dialogue closes, ignore world presses briefly (game-073)
const seen = {};

const ui = new UI({
    audio, settings, view,
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        input.sens = s.sens; input.invert = s.invert;
        if (s.quality >= 0 && s.quality !== view.stage.quality) view.setQuality(s.quality);
        updateTouch();
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onAct: (a) => doAct(a),
});
ui.onHint = () => showHint(true);

function doAct(a) {
    const ok = act(G, a);
    flushEvents();
    return ok;
}

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') { if (hasSave()) ui.openScreen('confirm-new'); else startGame(newGame((Date.now() % 1e9) | 0)); }
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
});
document.getElementById('btn-new-yes').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0)); });
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'journal') { ui.closeScreen('pause'); openJournal(); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-journal').addEventListener('click', () => openJournal());

function openJournal(tab = null) {
    if (mode !== 'play' || G.scan) return;
    audio.ui('open');
    ui.atGrimoire = false;
    ui.openJournal(G, tab);
}

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showWorldHud(true);
    updateTouch();
    if (G.scan) { ui.openScan(G); view.onEvents(G, [{ type: 'scanStart', id: G.scan.pid }]); }
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    ui.closeScan();
    view.scan.close();
    view.mode = 'world';
    mode = 'title';
    ui.showWorldHud(false);
    input.exitLock();
    G = newGame(1);
    G.talk = null;
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    input.exitLock();
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindLook(document.getElementById('look-zone'), () => worldUse());
input.bindButton(document.getElementById('btn-use'), () => worldUse());

function worldUse() {
    if (mode !== 'play' || ui.anyScreen()) return;
    if (G.talk) { ui.advanceTalk(); return; }
    if (G.scan || performance.now() < swallowUntil) return;
    doAct({ type: 'interact' });
}

// desktop: click the view to lock the pointer; once locked, a click uses
canvas.addEventListener('mousedown', (e) => {
    if (mode !== 'play' || ui.anyScreen() || G.scan || e.button !== 0) return;
    if (G.talk) { ui.advanceTalk(); return; }
    if (input.lastDevice === 'touch') return;
    if (!input.locked) { input.requestLock(); return; }
    worldUse();
});

// ------------------------------------------------------------------ the scan's pointer input
const scan = { path: [], dragging: false, pointer: null, idle: 0, hint: null, cursor: null };

function scanCanExt(r, c) {
    const S = G.scan?.S;
    return S ? canExtend(S, scan.path, r, c) : false;
}
function setScanPath(p) {
    scan.path = p;
    view.scan.setPath(p, G.scan?.S, scanCanExt);
    scan.idle = 0;
    view.scan.setHint(null);
    const S = G.scan?.S;
    if (S && p.length >= 2) {
        const a = p[p.length - 2], b = p[p.length - 1];
        const tr = linkTraits(S, S.cells[a[0]][a[1]].m, S.cells[b[0]][b[1]].m);
        const label = tr.includes('bloom') ? 'lifebloom!' : tr.includes('phoenix') ? 'phoenix!' : tr[0] ? SENSES[tr[0]].hop + '!' : '';
        const pos = view.scan.screenOf(b[0], b[1]);
        ui.showTag(p.length >= (S.mods.bloomChain) ? `${label}  ✿ ${p.length}` : label, pos.x, pos.y);
    } else ui.showTag('');
}

function scanTouch(r, c) {
    const S = G.scan.S;
    const path = scan.path;
    const i = path.findIndex(([pr, pc]) => pr === r && pc === c);
    if (i === path.length - 2 && i >= 0) { setScanPath(path.slice(0, -1)); audio.hop(path.length, true); return; }
    if (i >= 0) return;
    if (canExtend(S, path, r, c)) { setScanPath([...path, [r, c]]); audio.hop(path.length); }
    else if (path.length && S.cells[r]?.[c]?.m) audio.nope();
}

function commitPath() {
    const p = scan.path;
    scan.dragging = false;
    if (p.length >= 3) doAct({ type: 'scanChain', path: p });
    setScanPath([]);
}

canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || !G.scan || ui.anyScreen() || G.talk) return;
    if (G.scan.S.status !== 'playing') return;
    const cell = view.scan.pick(e.clientX, e.clientY);
    if (!cell) return;
    e.preventDefault();
    if (ui.armed != null) {
        const ok = doAct({ type: 'scanPower', vial: ui.armed, r: cell[0], c: cell[1] });
        if (ok) { ui.armed = null; view.scan.armed = null; ui.scanTip(''); ui.updateScan(G); }
        return;
    }
    scan.dragging = true;
    scan.pointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
    setScanPath([]);
    scanTouch(cell[0], cell[1]);
});
canvas.addEventListener('pointermove', (e) => {
    if (!G.scan) return;
    const cell = view.scan.pick(e.clientX, e.clientY, true);
    if (!scan.dragging || e.pointerId !== scan.pointer || !cell) return;
    scanTouch(cell[0], cell[1]);
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => {
    if (!scan.dragging || e.pointerId !== scan.pointer) return;
    if (ev === 'pointercancel') { scan.dragging = false; setScanPath([]); return; }
    commitPath();
});

function showHint(now = false) {
    const S = G.scan?.S;
    if (!S || S.status !== 'playing') return;
    if (!now && !settings.hints) return;
    const h = findHint(S);
    view.scan.setHint(h);
    if (now && h) ui.scanTip('Pip suggests a trail. Follow the wave!');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP' || key === 'Backspace') && !['title', 'ending', 'scanresult'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if ((key === 'KeyJ' || key === 'Tab') && ui.top() === 'journal') { ui.closeTop(); }
        else if ((key === 'Enter' && press.pad) || ((key === 'KeyE' || key === 'KeyZ') && !press.onButton) || ((key === 'Enter' || key === 'Space') && !press.onButton)) ui.pressFocused();
        return;
    }
    if (mode !== 'play') return;
    if (G.talk) {
        if (['Space', 'Enter', 'KeyE', 'KeyZ', 'NumpadEnter'].includes(key)) ui.advanceTalk();
        else if (key === 'Escape') pause();
        return;
    }
    if (G.scan) { scanKey(key); return; }
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyJ' || key === 'Tab') openJournal();
    else if (['KeyE', 'Space', 'Enter', 'KeyF'].includes(key) && performance.now() >= swallowUntil) doAct({ type: 'interact' });
}

function scanKey(key) {
    const S = G.scan.S;
    if (S.status !== 'playing') return;
    if (key === 'Escape') {
        if (ui.armed != null) { ui.armed = null; view.scan.armed = null; ui.scanTip(''); ui.updateScan(G); }
        else if (scan.path.length) setScanPath([]);
        else pause();
        return;
    }
    if (key === 'KeyH') { showHint(true); return; }
    if (/^Digit[1-4]$/.test(key)) { ui.onVial(+key.slice(5) - 1); return; }
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] }[key];
    if (!scan.cursor) scan.cursor = scan.path.length ? scan.path[scan.path.length - 1].slice() : [Math.floor(S.rows / 2), Math.floor(S.cols / 2)];
    if (mv) {
        scan.cursor = [Math.max(0, Math.min(S.rows - 1, scan.cursor[0] + mv[0])), Math.max(0, Math.min(S.cols - 1, scan.cursor[1] + mv[1]))];
        view.scan.setCursor(scan.cursor);
        audio.ui('click');
        return;
    }
    view.scan.setCursor(scan.cursor);
    if (key === 'Space' || key === 'KeyE' || key === 'KeyZ') {
        if (ui.armed != null) { if (doAct({ type: 'scanPower', vial: ui.armed, r: scan.cursor[0], c: scan.cursor[1] })) { ui.armed = null; view.scan.armed = null; ui.updateScan(G); } return; }
        scanTouch(scan.cursor[0], scan.cursor[1]);
    } else if (key === 'Enter' || key === 'NumpadEnter') commitPath();
    else if (key === 'Backspace') setScanPath(scan.path.slice(0, -1));
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        if (e.type === 'scanEvents') for (const s of e.list) seen['scan:' + s.type] = (seen['scan:' + s.type] || 0) + 1;
    }
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    if (mode !== 'play') return;
    for (const e of ev) {
        switch (e.type) {
            case 'open':
                input.exitLock();
                if (e.what === 'skills') { audio.ui('open'); ui.atGrimoire = true; ui.openJournal(G, 'skills'); }
                else if (e.what === 'shop') { audio.ui('open'); ui.openShop(G); }
                else if (e.what === 'map') { audio.ui('open'); ui.openMap(G); }
                break;
            case 'talk': input.exitLock(); break;
            case 'talkEnd': swallowUntil = performance.now() + 250; input.flush(); break;
            case 'scanStart': if (!G.scan) break; input.exitLock(); ui.openScan(G); setScanPath([]); scan.cursor = null; view.scan.setCursor(null); scan.idle = 0; layoutScan(); break;
            case 'scanEvents':
                if (!G.scan) break;
                ui.updateScan(G);
                if (e.list.some((s) => s.type === 'phase')) { ui.toast(`Phase ${G.scan.S.phase + 1}: ${G.scan.S.spec.name}`, true); ui.openScan(G); layoutScan(); }
                if (e.list.some((s) => s.type === 'vial' && s.full)) ui.toast('A vial is full!');
                if (e.list.some((s) => s.type === 'end')) setTimeout(() => { if (G.scan && G.scan.S.status !== 'playing') ui.showResult(G); }, 650);
                break;
            case 'useItem': ui.updateScan(G); break;
            case 'scanEnd': ui.closeScan(); ui.closeAll(); setScanPath([]); if (e.won) ui.toast(`+${e.gold} 🌙  +${e.renown} ✦`); saveGame(G); break;
            case 'levelUp': ui.toast(`Renown level ${e.level}! A skill point for the Grimoire.`, true); break;
            case 'sense': ui.toast(`New sense: ${SENSES[e.sense].icon} ${SENSES[e.sense].name}`, true); break;
            case 'evidence': ui.toast(`Evidence: ${EVIDENCE[e.id].icon} ${EVIDENCE[e.id].label}`, true); break;
            case 'relic': ui.toast(`Relic: ${RELICS[e.id].icon} ${RELICS[e.id].label}`, true); break;
            case 'call': ui.toast(`A call! ${QUESTS[e.quest].icon} ${QUESTS[e.quest].label}`, true); break;
            case 'gate': ui.toast('The way is open.'); break;
            case 'learn': ui.toast('Learned!'); break;
            case 'upgrade': ui.toast('The clinic is a little finer.'); break;
            case 'rest': if (e.brewed) ui.toast('The copper still brewed a remedy overnight.'); saveGame(G); break;
            case 'travel': saveGame(G); break;
            case 'act': saveGame(G); break;
            case 'ending': input.exitLock(); document.getElementById('toasts').innerHTML = ''; ui.openEnding(); break;
            default: break;
        }
    }
}

/** Tell the scan view how much room the HUD takes. */
function layoutScan() {
    requestAnimationFrame(() => {
        const top = document.getElementById('scan-top').getBoundingClientRect();
        const bottom = document.getElementById('scan-bottom').getBoundingClientRect();
        const W = view.stage.w, H = view.stage.h;
        const side = W < 600 ? 8 : 96;
        view.scan.setInsets({ top: Math.min(H * 0.4, top.bottom + 6), bottom: Math.min(H * 0.45, H - bottom.top + 6), left: side, right: side });
    });
}
window.addEventListener('resize', () => { if (G.scan) layoutScan(); });

// ------------------------------------------------------------------ frame loop
let routeT = 0, routeCache = null, objCache = null, routeSig = '';
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    const runNow = mode === 'play' && !ui.anyScreen() && !G.talk && !G.scan && !G.ending;
    // the press that closed a menu or a conversation must not also act in the world (game-078)
    if (runNow && !wasRunning) input.dropBefore(Math.max(ui.closedAt || 0, swallowUntil - 250));
    handlePresses();
    input.frame(dt, !G.scan);

    const talking = ui.talk(mode === 'play' ? G : { talk: null }, dt);
    const running = mode === 'play' && !ui.anyScreen() && !G.talk && !G.scan && !G.ending;
    input.look_enabled = running;
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            if (bot) { const inp = botTick(G, bot, STEP); if (inp) step(G, inp, STEP); }
            else step(G, input.state(), STEP);
            input.consumeEdges();
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else {
        acc = 0;
        if (bot && mode === 'play' && !ui.anyScreen()) botTick(G, bot, STEP);
    }
    if (mode === 'title') {
        // the clinic slowly turning behind the title, from the middle of the hall
        G.player.x = 8.4 * CELL; G.player.z = 7.6 * CELL;
        G.player.pitch = -0.08;
        G.player.yaw = -1.2 + Math.sin(time * 0.06) * 1.1;
    }
    flushEvents();

    // HUD and guidance
    let f = null, o = null, steer = null;
    if (mode === 'play' && !G.scan) {
        f = !G.talk ? facing(G) : null;
        routeT -= dt;
        const sig = `${G.map}|${G.wv}|${!!G.talk}`;
        if (routeT <= 0 || sig !== routeSig) { routeT = 0.25; routeSig = sig; const r = objectiveRoute(G); objCache = r?.o ?? objective(G); routeCache = r; }
        o = objCache;
        if (routeCache?.path) {
            const sp = steerPoint(G, routeCache.path) ?? [(routeCache.o.x + 0.5) * CELL, (routeCache.o.y + 0.5) * CELL];
            const want = Math.atan2(sp[0] - G.player.x, -(sp[1] - G.player.z));
            let d = want - G.player.yaw;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            steer = d;
        }
        ui.hud(G, { facing: f, objective: o, steer, keyHint: input.lastDevice === 'pad' ? 'A' : 'E' });
        ui.setLockHint(!input.locked && !talking && running && input.lastDevice !== 'touch' && input.lastDevice !== 'pad');
    }
    if (G.scan && mode === 'play') {
        scan.idle += dt;
        if (scan.idle > 7 && !scan.path.length && !view.scan.hint && settings.hints && G.scan.S.status === 'playing') showHint(false);
    }
    // music follows the place
    if (mode === 'title') audio.setTheme('title');
    else if (G.ending) audio.setTheme('ending');
    else if (G.scan) audio.setTheme(patientById(G, G.scan.pid)?.boss ? 'boss' : 'scan');
    else audio.setTheme(MAPS[G.map].theme);

    view.frame(G, dt, time, { facing: f, objective: o, moving: running && input.moving() });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'play') saveGame(G); pause(); } });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ss = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, settings,
        /** Skip the title: start a new game (or a given state) and close the intro. */
        start(seed = 1, skipIntro = true) { startGame(newGame(seed)); if (skipIntro) { while (G.talk) act(G, { type: 'talkEnd' }); flushEvents(); } return G; },
        autoplay(on = true, opts = {}) { bot = on ? makeBot({ seed: 5, ...opts }) : null; },
        /** Run the campaign bot synchronously for game seconds, or until a predicate holds. */
        ff(sec, until = null) {
            const b = makeBot({ seed: 3 });
            let t = 0, guard = 0;
            while (t < sec && guard++ < 2e6 && !(until && until(G))) {
                const inp = botTick(G, b, STEP);
                if (inp) { step(G, inp, STEP); t += STEP; }
                if (G.events.length > 400) flushEvents();
            }
            flushEvents();
            return G;
        },
        act: (a) => doAct(a),
        facing: () => facing(G),
        ents: () => mapEnts(G),
        blocked: (x, y) => blocked(G, x, y),
        objective: () => objective(G, { bot: true }),
        scanCell: (r, c) => view.scan.screenOf(r, c),
        scanPath: () => scan.path.slice(),
        save: () => saveGame(G),
        hasSave,
        load(d) { const g = loadGame(); if (g) startGame(g); return !!g; },
        focusLeft: () => (G.scan ? focusLeft(G.scan.S) : null),
        hint: () => (G.scan ? findHint(G.scan.S) : null),
        /** Let the scan bot play the open scan to its end through act(). */
        solveScan(maxMoves = 300) {
            let n = 0;
            while (G.scan && G.scan.S.status === 'playing' && n++ < maxMoves) {
                const S = G.scan.S;
                const p = choosePower(S, focusLeft(S) <= 0);
                if (p && act(G, { type: 'scanPower', vial: p.vial, r: p.r, c: p.c })) continue;
                const path = chooseChain(S);
                if (!path || !act(G, { type: 'scanChain', path })) break;
            }
            flushEvents();
            return G.scan?.S.status;
        },
    };
}
