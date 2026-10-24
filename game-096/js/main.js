// Homeward Hop — entry point. Boots the view, runs the fixed-step simulation, routes input and events,
// and moves between the title, the map, the workshop, a level, the results and the story.
//
// ?debug=1 exposes window.__hh for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import './sim/scripts.js';                       // registers the levels
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasProgress, loadProgress, saveProgress, clearProgress } from './save.js';
import { newGame, step, SHELL_IDS } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { LEVELS, levelMeta, worldOf, STORY, SHELLS } from './sim/data.js';
import { emptyProgress, applyResult, shellsOwned, isUnlocked, nextLevelId, firstOpenLevel, build, toggleEquip, invById } from './sim/progress.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
let P = loadProgress();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); applyQuality(); updateTouch(); },
    onDeleteSave: () => { clearProgress(); P = emptyProgress(); refreshTitle(); },
    onShell: (i) => { input.edge.sel = i + 1; },
});

let G = null;
let mode = 'title';          // title | map | workshop | play | win | cutscene
let acc = 0, time = 0, last = performance.now(), wasRunning = false;
let bot = null;
let finished = false;
let hitstop = 0;            // a few frames of stillness on a big hit: it makes a smash feel heavier
let currentId = 'l1_1';
const seen = {};             // a count of every sim event drained, for the tests
const NONE = { x: 0, y: 0, jump: false, jumpHeld: false, spin: false, power: false, powerHeld: false, swap: 0, sel: 0 };

// ------------------------------------------------------------------ settings
function coarse() { return !!window.matchMedia?.('(pointer: coarse)').matches; }
function applyQuality() {
    const sh = settings.shadows === 'on' || (settings.shadows === 'auto' && !coarse());
    view.setQuality({ shadows: sh, dpr: coarse() ? 1.75 : 2 });
    const calm = settings.calm === 'on' || (settings.calm === 'auto' && !!window.A11Y?.reducedMotion);
    view.setReducedMotion(calm);
    document.documentElement.classList.toggle('calm', calm);
}
function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse() || input.lastDevice === 'touch')));
}
applyQuality();
input.onTouch = updateTouch;
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindButton($('btn-jump'), 'jump', { hold: true });
input.bindButton($('btn-spin'), 'spin');
input.bindButton($('btn-power'), 'power', { hold: true });
input.bindButton($('btn-swap'), 'swap');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ scenes
function loadBackdrop(id, opts = {}) {
    currentId = id;
    G = newGame(id, { seed: 7, shells: shellsOwned(P), equipped: P.equipped, ...opts });
    view.loadLevel(G);
    flushEvents();
}

function refreshTitle() { ui.refreshTitle(P, hasProgress() || P.started); }

function toTitle() {
    ui.closeAll(); ui.showHud(false);
    mode = 'title';
    if (!G || G.levelId !== 'l1_1' || G.status !== 'play') loadBackdrop('l1_1');
    audio.playSong('title'); audio.setIntensity(0);
    refreshTitle();
    ui.openScreen('title');
}

function openMap(focus) {
    ui.closeAll(); ui.showHud(false);
    mode = 'map';
    audio.playSong('title'); audio.setIntensity(0);
    ui.buildMap(P, (id) => launch(id));
    ui.openScreen('map');
    ui.focusLevel(focus || firstOpenLevel(P));
}

function openWorkshop() {
    mode = 'workshop';
    ui.buildWorkshop(P, { onBuild: doBuild, onEquip: doEquip });
    ui.openScreen('workshop');
}
function doBuild(id) {
    if (!build(P, id)) { audio.ui('no'); return; }
    saveProgress(P);
    view.pinch.setGear(P.equipped);
    audio.ui('craft');
    ui.toast(`Built: ${invById(id).name}!`);
    ui.buildWorkshop(P, { onBuild: doBuild, onEquip: doEquip });
    ui.craftFx(id);
}
function doEquip(id) {
    const r = toggleEquip(P, id);
    if (r === 'full') { audio.ui('no'); ui.toast('Three at a time: take one off first.'); return; }
    audio.ui('equip');
    saveProgress(P);
    view.pinch.setGear(P.equipped);
    ui.buildWorkshop(P, { onBuild: doBuild, onEquip: doEquip });
}

/** Go to a level from the map: tell the world's story the first time, then play. */
function launch(id) {
    if (!isUnlocked(P, id)) { audio.ui('no'); return; }
    const meta = levelMeta(id), w = meta.world;
    ui.closeAll();
    const first = !P.seen['w' + w] && STORY['w' + w];
    if (first) {
        P.seen['w' + w] = 1; saveProgress(P);
        mode = 'cutscene';
        ui.say(STORY['w' + w], () => startLevel(id));
    } else startLevel(id);
}

function startLevel(id) {
    ui.closeAll();
    const meta = levelMeta(id);
    currentId = id;
    G = newGame(id, { seed: 1 + LEVELS.findIndex((l) => l.id === id) * 7, shells: shellsOwned(P), equipped: P.equipped });
    view.loadLevel(G);
    mode = 'play'; acc = 0; finished = false;
    input.flush(); document.activeElement?.blur?.();
    ui.showHud(true); updateTouch();
    ui.startLevel(G, meta, worldOf(id));
    const theme = G.level.theme;
    audio.playSong(theme); audio.setIntensity(0);
    P.plays = (P.plays || 0) + 1;
    if (meta.boss && !P.seen['pre_' + id] && STORY['pre_' + id]) {
        P.seen['pre_' + id] = 1; saveProgress(P);
        ui.say(STORY['pre_' + id], () => { input.flush(); });
    }
}

function pause() {
    if (mode !== 'play' || ui.anyScreen() || ui.talking) return;
    audio.ui('open');
    ui.openScreen('pause');
}

function finishLevel() {
    if (finished) return;
    finished = true;
    const meta = levelMeta(currentId);
    const run = {
        pearls: G.pearls, pearlTotal: G.level.pearlTotal, curios: G.curioL.map((c) => (c.got ? 1 : 0)),
        time: G.time, oopsies: G.oopsies,
    };
    const res = applyResult(P, currentId, run);
    saveProgress(P);
    const done = () => {
        ui.showHud(false);
        const next = nextLevelId(currentId);
        ui.showComplete({ meta, run, res, hasNext: !!next, final: !!meta.final, world: worldOf(currentId) });
    };
    if (meta.boss && STORY['post_' + currentId] && !P.seen['post_' + currentId]) {
        P.seen['post_' + currentId] = 1; saveProgress(P);
        ui.say(STORY['post_' + currentId], done);
    } else done();
}

// ------------------------------------------------------------------ menus
$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') {
        if (P.started && !confirmNew()) return;
        P = emptyProgress(); P.started = false; saveProgress(P);
        ui.closeAll(); mode = 'cutscene';
        P.seen.intro = 1;
        ui.say(STORY.intro, () => launch('l1_1'));
    } else if (act === 'continue') openMap();
    else if (act === 'workshop') openWorkshop();
    else ui.openScreen(act);
});
let newArmed = 0;
function confirmNew() {
    // a second press within four seconds confirms: no browser dialogs, so touch and keyboard behave the same
    if (time - newArmed < 4) return true;
    newArmed = time; ui.toast('This starts over. Press again to be sure.');
    return false;
}
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'restart') startLevel(currentId);
    else if (act === 'quit') { toMapFromLevel(); }
    else ui.openScreen(act);
});
function toMapFromLevel() { ui.closeAll(); ui.showHud(false); openMap(currentId); }
$('btn-pause').addEventListener('click', () => pause());
$('map-workshop').addEventListener('click', () => { audio.ui('click'); openWorkshop(); });
$('cl-map').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('complete'); openMap(nextLevelId(currentId) || currentId); });
$('cl-replay').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('complete'); startLevel(currentId); });
$('cl-next').addEventListener('click', () => {
    audio.ui('click');
    ui.closeScreen('complete');
    if (levelMeta(currentId).final) { mode = 'cutscene'; ui.say(STORY.ending, () => { ui.showCredits(P); }); return; }
    const next = nextLevelId(currentId);
    if (next) launch(next); else openMap();
});
$('cr-map').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('credits'); openMap(); });
$('cr-title').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('credits'); toTitle(); });

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.talking) {
        if (key === 'Enter' || key === 'Space' || key === 'KeyE' || key === 'KeyZ') ui.dlgAdvance();
        else if (key === 'Escape') ui.dlgSkip();
        return;
    }
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'complete', 'credits'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    // on a pad the B button is the shell power in play, and Start is pause
    if (mode === 'play' && (key === 'KeyP' || (key === 'Escape' && !press.pad))) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        if (e.type === 'bossStart') audio.setIntensity(1);
        if (e.type === 'bossDefeat') audio.setIntensity(0);
        if (!document.documentElement.classList.contains('calm')) {
            if (e.type === 'bossHit' || e.type === 'bossDefeat') hitstop = Math.max(hitstop, 0.16);
            else if (e.type === 'slam' || e.type === 'bossSmash') hitstop = Math.max(hitstop, 0.07);
            else if (e.type === 'kill' || e.type === 'crate' && e.kind === 'iron') hitstop = Math.max(hitstop, 0.035);
        }
    }
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (!settings.calm || settings.calm === 'off') for (const e of ev) if (e.type === 'win' && !document.documentElement.classList.contains('calm')) { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
    if (ev.some((e) => e.type === 'win') && mode === 'play') mode = 'win';
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    ui.update(dt);
    // closing the workshop returns to the map (or the title), and closing the map returns to the title
    if (mode === 'map' || mode === 'workshop') {
        const s = ui.stack;
        if (s.includes('workshop')) mode = 'workshop';
        else if (s.includes('map')) mode = 'map';
        else if (!ui.talking) { mode = 'title'; if (!s.includes('title')) { refreshTitle(); ui.openScreen('title'); } }
    } else if (mode === 'title' && ui.stack.includes('workshop')) mode = 'workshop';

    const playing = mode === 'play' && !ui.anyScreen() && !ui.talking;
    // back from a menu or a dialogue: the key or tap that closed it must not also act in the game
    if (playing && !wasRunning) input.flush();
    wasRunning = playing;
    let running = playing;
    if (hitstop > 0) { hitstop -= dt; running = false; }
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST && G.status === 'play') {
            const inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
    } else acc = 0;
    if (mode === 'win') {
        step(G, NONE, dt * FAST);
        if (G.winT > 2.4) finishLevel();
    }
    flushEvents();
    const vmode = mode === 'play' ? 'play' : mode === 'win' ? 'win' : 'title';
    if (G) {
        view.frame(G, dt, time, vmode);
        if (mode === 'play') ui.hud(G, view);
        audio.update(G, dt);
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'play') pause(); } });
window.addEventListener('pagehide', () => { try { saveProgress(P); } catch { /* blocked */ } });

// ------------------------------------------------------------------ boot
loadBackdrop('l1_1');
refreshTitle();
ui.openScreen('title');
audio.playSong('title');
requestAnimationFrame((t) => { last = t; frame(t); const L = $('loading'); L.classList.add('gone'); setTimeout(() => L.remove(), 600); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hh = {
        get G() { return G; },
        get mode() { return mode; },
        get P() { return P; },
        seen, view, ui, audio, input,
        start(id = 'l1_1', opts = {}) {
            if (opts.shells != null || opts.equipped) { /* applied below */ }
            startLevel(id);
            if (opts.god) G.god = true;
            return G;
        },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with a bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); G.god = true; for (let t = 0; t < sec && G.status === 'play'; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        tp(x, y, z) { G.p.x = x; G.p.y = y; G.p.z = z; G.p.vx = G.p.vy = G.p.vz = 0; },
        win() { G.status = 'play'; G.p.x = G.level.goal ? G.level.goal.x : G.p.x; if (G.level.goal) { G.p.z = G.level.goal.z; G.p.y = G.level.goal.y; } step(G, NONE, STEP); flushEvents(); },
        give(kind, n = 3) { P.parts[kind] = (P.parts[kind] || 0) + n; saveProgress(P); },
        clearAll() { for (const l of LEVELS) P.cleared[l.id] = { pearls: 10, pearlTotal: 10, curios: [1, 1, 1], time: 60, oopsies: 0, flawless: true, clears: 1 }; P.started = true; saveProgress(P); },
        openMap, openWorkshop, toTitle, launch, pause, finishLevel,
        save: () => saveProgress(P),
        hasSave: hasProgress,
    };
}
