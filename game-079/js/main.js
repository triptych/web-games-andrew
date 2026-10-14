// VENDETTA OVERDRIVE — entry point. Boots the view, runs the fixed-step simulation, routes input
// and events, and moves between the title (with the bot playing behind it), the briefing, play,
// pause, the tally, CONTINUE?, and the ending.
//
// ?debug=1 exposes window.__vo for the dev/ harnesses; &fast=N runs N× simulation per frame;
// &seed=N fixes the campaign seed.

import { STEP, MAX_FRAME, FURY } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadArchive, archiveTapes } from './save.js';
import { newGame, step, continueLevel, nextLevel, startLevel, LEVEL_COUNT } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { LEVELS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const SEED = DEBUG && params.get('seed') ? +params.get('seed') : null;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
input.sens = settings.sens; input.invert = settings.invert;
const view = new View($('view'));
view.setFov(settings.fov);
const ui = new UI({
    audio, settings,
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        input.sens = s.sens; input.invert = s.invert;
        view.setFov(s.fov);
        if (s.quality !== 'auto') view.setQuality(+s.quality);
        updateTouch();
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

const coarse = window.matchMedia?.('(pointer: coarse)').matches;
let quality = settings.quality === 'auto' ? (coarse ? 1 : 2) : +settings.quality;
view.setQuality(quality);

// the title screen shows the bot playing the Strip
let G = newGame(SEED ?? 1987, 1);
let bot = makeBot({ skill: 0.8, seed: 3 });
let attract = true;
let mode = 'title';          // title | brief | play | tally | dead | won
let acc = 0, time = 0, last = performance.now(), saveT = 0, deadT = 0, wasRunning = false;
let autoBot = null;
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audio.wantSong = 'title';

const unlock = () => { audio.init(); if (audio.ctx && !audio.song && audio.wantSong) audio.playSong(audio.wantSong); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'continue') {
        const g = loadGame();
        if (!g) { ui.toast('That save could not be read.'); return; }
        if (g.phase === 'dead') continueLevel(g);
        if (g.phase === 'clear') nextLevel(g);
        enterGame(g);
    } else if (act === 'tapes') { ui.tapes(loadArchive()); ui.openScreen('tapes'); }
    else ui.openScreen(act);
});
$('diff-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-diff]');
    if (!b) return;
    audio.ui('start');
    enterGame(newGame(SEED ?? ((Date.now() % 1e9) | 0), +b.dataset.diff));
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') { ui.closeScreen('pause'); input.requestLock(); }
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else if (act === 'tapes') { ui.tapes(archiveTapes(G.tapes)); ui.openScreen('tapes'); }
    else ui.openScreen(act);
});
$('btn-pause').addEventListener('click', () => pause());
$('brief-go').addEventListener('click', () => { audio.ui('start'); beginPlay(); });
$('tally-next').addEventListener('click', () => {
    audio.ui('click');
    if (nextLevel(G)) { saveGame(G); showBrief(); }
});
$('dead-go').addEventListener('click', () => { audio.ui('start'); continueLevel(G); saveGame(G); showBrief(); });
$('dead-quit').addEventListener('click', () => { audio.ui('click'); toTitle(); });
$('won-title').addEventListener('click', () => { audio.ui('click'); clearSave(); toTitle(); });

/** A game is loaded or started: show its briefing. */
function enterGame(g) {
    G = g;
    attract = false;
    bot = null;
    showBrief();
}

function showBrief() {
    ui.closeAll();
    mode = 'brief';
    input.enabled = false;
    ui.showHud(false);
    ui.brief(G);
    ui.openScreen('brief');
    audio.playSong(LEVELS[G.level].id);
    audio.setIntensity(0);
}

function beginPlay() {
    ui.closeAll();
    document.activeElement?.blur?.();     // a focused button would swallow Space and Enter all game
    mode = 'play';
    acc = 0;
    input.flush();
    input.enabled = true;
    ui.showHud(true);
    updateTouch();
    if (!ui.touchOn) input.requestLock();
    saveGame(G);
}

function toTitle() {
    ui.closeAll();
    input.enabled = false;
    input.exitLock();
    mode = 'title';
    ui.showHud(false);
    G = newGame(SEED ?? 1987, 1);
    bot = makeBot({ skill: 0.8, seed: 3 });
    attract = true;
    audio.setOverdrive(false);
    audio.playSong('title');
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    input.exitLock();
    ui.openScreen('pause');
}

function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindCanvas($('view'), () => { if (mode === 'play' && !ui.anyScreen()) input.requestLock(); });
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindLook($('look-zone'));
input.bindLook($('t-fire'), () => input.hold('fire', true), () => input.hold('fire', false));
input.bindButton($('t-jump'), () => input.hold('jump', true), () => input.hold('jump', false));
input.bindButton($('t-kick'), () => input.press('kick'));
input.bindButton($('t-reload'), () => input.press('reload'));
input.bindButton($('t-next'), () => input.cycle(1));
input.bindButton($('t-bomb'), () => input.press('bomb'));
input.bindButton($('t-swap'), () => input.press('use'));
input.bindButton($('t-over'), () => input.press('over'));
let wasLocked = false;
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === $('view');
    if (!locked && wasLocked && mode === 'play' && !ui.anyScreen()) pause();
    wasLocked = locked;
});

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'brief', 'tally', 'dead', 'won'].includes(ui.top())) {
            audio.ui('close');
            const wasPause = ui.top() === 'pause';
            ui.closeTop();
            if (wasPause) input.requestLock();
        } else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

/** Light aim assist for thumbs and sticks: a slow pull toward an enemy near the crosshair. */
function aimAssist(inp) {
    if (!(input.lastDevice === 'touch' || input.lastDevice === 'pad') || !inp.fire) return;
    const p = G.player;
    let best = null, ba = 0.1;
    for (const e of G.enemies) {
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > 40) continue;
        let a = Math.atan2(dx, -dz) - p.yaw;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) < ba) { ba = Math.abs(a); best = { a, pitch: Math.atan2(e.y + e.h * 0.55 - p.y - 1.6, d) - p.pitch }; }
    }
    if (best) { inp.dyaw += best.a * 0.06; inp.dpitch += best.pitch * 0.05; }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    if (attract) return;
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'pickup' && e.kind === 'tape') archiveTapes(G.tapes);
        else if (e.type === 'clear') {
            mode = 'tally';
            input.enabled = false;
            input.exitLock();
            ui.showHud(false);
            ui.tally(G);
            ui.openScreen('tally');
            audio.setOverdrive(false);
            audio.setIntensity(0);
            saveGame(G);
        } else if (e.type === 'death') { mode = 'dead'; deadT = 0; input.enabled = false; audio.setOverdrive(false); }
        else if (e.type === 'won') {
            mode = 'won';
            input.enabled = false;
            input.exitLock();
            ui.showHud(false);
            archiveTapes(G.tapes);
            clearSave();
            ui.won(G);
            ui.openScreen('won');
            audio.playSong('ending');
            audio.setIntensity(1);
        } else if (e.type === 'boss') { audio.playSong('boss'); }
        else if (e.type === 'bossDead' && G.level + 1 < LEVEL_COUNT) { audio.playSong(LEVELS[G.level].id); }
    }
}

const QUIPS_DEAD = ['Roxy is down. The aliens are doing a little dance.', 'Dad would have walked that off.', 'Insert coin. Kick butt.', 'One more try. One more tape.'];

// ------------------------------------------------------------------ frame loop
let fpsT = 0, fpsN = 0, slow = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    const realDt = Math.min(1, (now - last) / 1000);     // UI timers run on the wall clock
    last = now;
    time += dt;
    input.frame(dt);
    handlePresses();

    const running = (mode === 'play' || mode === 'dead' || attract) && !(!attract && ui.anyScreen() && mode === 'play');
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            let inp;
            if (attract) inp = botInput(G, bot);
            else if (autoBot) inp = botInput(G, autoBot);
            else { inp = input.state(); if (n === 0) aimAssist(inp); }
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
            if (attract) {
                if (G.phase === 'dead') { continueLevel(G); bot = makeBot({ skill: 0.8, seed: 5 }); }
                else if (G.phase === 'clear') { G = newGame((G.seed * 31 + 7) % 1e9, 1); bot = makeBot({ skill: 0.8, seed: 3 }); }
            }
        }
        if (mode === 'play') {
            saveT += dt;
            if (saveT > 30) { saveT = 0; saveGame(G); }
        }
    } else acc = 0;
    flushEvents();
    // CONTINUE? appears after the camera has hit the floor
    if (mode === 'dead') {
        deadT += realDt;
        if (deadT > 1.6 && ui.top() !== 'dead') {
            input.exitLock();
            ui.showHud(false);
            $('dead-line').textContent = QUIPS_DEAD[(G.tally.deaths + G.level) % QUIPS_DEAD.length];
            ui.openScreen('dead');
        }
        if (ui.top() === 'dead') {
            const left = Math.max(0, 9 - Math.floor(deadT - 1.6));
            $('dead-count').textContent = left;
            if (deadT - 1.6 > 10.5) toTitle();
        }
    }
    // music follows the fight
    if (!attract && mode === 'play') {
        const p = G.player;
        let near = 0;
        for (const e of G.enemies) if (e.alert && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < 900) near++;
        audio.setIntensity(G.bossState === 'active' || p.overdrive > 0 ? 2 : near > 0 ? 1 : 0);
    } else if (attract) audio.setIntensity(1);
    view.frame(G, dt, time, { lookDX: input.takeLookFrame().x, lookDY: 0, attract, scan: settings.scan });
    if (mode === 'play' || mode === 'dead') ui.hud(G, dt);
    $('lock-hint').hidden = !(mode === 'play' && !ui.anyScreen() && !ui.touchOn && !input.locked && input.lastDevice !== 'pad');
    // automatic quality: drop a tier after three slow samples
    fpsT += dt; fpsN++;
    if (fpsT > 2) {
        const fps = fpsN / fpsT;
        fpsT = 0; fpsN = 0;
        if (settings.quality === 'auto' && fps < 38 && quality > 0) { if (++slow >= 3) { quality--; view.setQuality(quality); slow = 0; } }
        else slow = 0;
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__vo = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        /** Skip the menus: a new game (seed, difficulty) at a level, playing. */
        start(seed = 1, diff = 1, level = 0) {
            G = newGame(seed, diff);
            if (level) startLevel(G, level);
            attract = false; bot = null;
            showBrief(); beginPlay();
            return G;
        },
        autoplay(on = true) { autoBot = on ? makeBot({ skill: 1 }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) {
            const b = makeBot({ skill: 1 });
            for (let t = 0; t < sec && G.phase === 'play'; t += STEP) step(G, botInput(G, b), STEP);
            flushEvents();
        },
        god(on = true) { G.god = on; },
        save: () => saveGame(G),
        hasSave,
        fury() { G.player.fury = FURY.max; },
    };
}
