// HAYATE RIVER STRIKE — entry point. Boots the view, runs the fixed-step simulation, routes input and events,
// and moves between the title (with a bot-played demo behind it), play, pause, the dock and the end screen.
//
// ?debug=1 exposes window.__hrs for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, FUEL, SECTORS } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, loadMeta, saveMeta, hasSave, saveGame, loadGame, clearSave, clearAll } from './save.js';
import { newGame, step, nextSector, bank } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { SECTOR_DATA, BOSSES } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
let meta = loadMeta();
const audio = new Audio('audio/');
audio.setVolumes(settings);
audio.setMuted(settings.muted);
const input = new Input();
const view = new View(document.getElementById('view'), document.getElementById('fx2d'), document.getElementById('popups'));
const ui = new UI({
    audio, settings, meta,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onResetAll: () => { clearAll(); meta = loadMeta(); ui.meta = meta; refreshTitle(); },
    onMeta: () => { saveMeta(meta); refreshTitle(); },
});

let mode = 'title';          // title | play | dock | over
let demo = newDemo();
let G = demo.G;
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null;              // the debug autoplay bot
let wasRunning = false;
let stopT = 0;               // hit-stop: real seconds left with the sim frozen
const seen = {};
const voiceQ = [];
let fuelWarnT = 0, lowHullSaid = -1, jumpSaidT = 0;

function newDemo() {
    const seed = 1000 + Math.floor(Math.random() * 9000);
    return { G: newGame(seed, { hull: 2, rounds: 2, racks: 1, barrels: 1 }), bot: makeBot({ skill: 1, seed }) };
}

// ------------------------------------------------------------------ menus
function refreshTitle() { ui.meta = meta; ui.refreshTitle(hasSave()); }
refreshTitle();
ui.openScreen('title');
audio.playMusic('title');

const unlock = () => { audio.init(); audio.playMusic(audio.wantTrack); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

function menu(id, handler) {
    document.getElementById(id).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        audio.ui('click');
        handler(b.dataset.act);
    });
}
menu('title-menu', (act) => {
    if (act === 'new') { clearSave(); startGame(newGame(seedNow(), meta.ranks)); }
    else if (act === 'continue') { const g = loadGame(); if (g) startGame(g, true); else ui.toast('That save could not be read.'); }
    else { ui.inRun = false; ui.openScreen(act); }
});
menu('pause-menu', (act) => {
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { bankCores(); saveGame(G); toTitle(); }
    else { ui.inRun = true; ui.openScreen(act); }
});
menu('dock-menu', (act) => {
    if (act === 'launch') launchFromDock();
    else { ui.inRun = false; ui.openScreen('skills'); }
});
menu('over-menu', (act) => {
    if (act === 'again') startGame(newGame(seedNow(), meta.ranks));
    else if (act === 'title') toTitle();
    else { ui.inRun = false; ui.openScreen('skills'); }
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-mute').addEventListener('click', () => toggleMute());

function seedNow() { return (Date.now() % 1e9) | 0; }

function toggleMute() {
    settings.muted = !settings.muted;
    audio.setMuted(settings.muted);
    saveSettings(settings);
    document.getElementById('btn-mute').textContent = settings.muted ? '✕' : '♪';
    ui.toast(settings.muted ? 'Sound off' : 'Sound on');
}
document.getElementById('btn-mute').textContent = settings.muted ? '✕' : '♪';

function startGame(g, resumed = false) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();    // a focused button would swallow Space and Enter all game
    mode = 'play';
    acc = 0; stopT = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    view.clearAll();
    view.terrain.reset();
    view.camInit = false;
    voiceQ.length = 0;
    lowHullSaid = -1;
    if (!resumed) { meta.runs++; saveMeta(meta); }
    else ui.banner(`SECTOR ${G.sector + 1}`, SECTOR_DATA[G.sector].name);
    saveGame(G);
}

function launchFromDock() {
    if (mode !== 'dock') return;
    nextSector(G, meta.ranks);
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    lowHullSaid = -1;
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    view.clearAll();
    view.terrain.reset();
    demo = newDemo();
    G = demo.G;
    view.camInit = false;
    refreshTitle();
    ui.openScreen('title');
    audio.playMusic('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    bankCores();
    saveGame(G);
    ui.openScreen('pause');
}

/** Move this run's new cores into the meta save. */
function bankCores() {
    const n = bank(G);
    if (n > 0) { meta.cores += n; meta.earned += n; saveMeta(meta); }
    return n;
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    ui.setTouch(on);
    input.autoFire = settings.autofire === 'on' || (settings.autofire === 'auto' && on);
    ui.setAutoFire(input.autoFire);
}
input.onTouch = updateTouch;
input.bindMouse(document.getElementById('view'));
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-jump'), () => input.pressJump());
input.bindButton(document.getElementById('btn-missile'), () => input.pressMissile());
input.bindButton(document.getElementById('btn-fire'), () => input.holdFire(true), () => input.holdFire(false));

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (key === 'KeyM') { toggleMute(); return; }
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'over', 'dock'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ comms: voice + subtitles, one at a time
function comms(id, delay = 0) { voiceQ.push({ id, at: time + delay }); }
function pumpComms() {
    if (!voiceQ.length || voiceQ[0].at > time) return;
    if (audio.ctx && audio.ctx.state === 'running') {
        if (audio.ctx.currentTime < audio.voiceBusy) return;
        const { id } = voiceQ.shift();
        audio.voice(id, true);
        ui.say(id, 3.4);
    } else if (ui.commsT <= 0) {
        const { id } = voiceQ.shift();
        ui.say(id, 2.8);
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    if (mode === 'title') return;
    audio.onEvents(G, ev);
    for (const e of ev) {
        switch (e.type) {
            case 'hitstop': stopT = Math.max(stopT, e.t / FAST); break;
            case 'sector':
                ui.banner(`SECTOR ${e.sector + 1}`, e.name);
                if (e.sector === 0) { comms('tomo-start', 0.4); comms('rin-launch', 0.5); } else comms('rin-launch', 0.6);
                break;
            case 'miniboss': ui.banner('WARNING!!', `${e.name} · ${e.title}`, true); comms('tomo-mini', 0.8); break;
            case 'boss':
                ui.banner('WARNING!!', `${e.name} · ${e.title}`, true);
                comms('tomo-boss', 0.8);
                if (G.sector === 0) comms('kurogane-taunt', 1);
                if (G.sector === SECTORS - 1) comms('kurogane-final', 1);
                if (G.sector === 1) comms('rin-boss', 1);
                break;
            case 'phase':
                ui.banner(e.name, `PHASE ${e.phase + 1}`, !!e.overdrive);
                if (e.overdrive) comms('tomo-overdrive'); else comms('rin-core');
                break;
            case 'bosskill':
                ui.banner(e.mini ? 'BREAKTHROUGH!' : 'DESTROYED!', `+${(BOSSES[e.key].score * 1).toLocaleString()}`);
                if (!e.mini && G.sector < SECTORS - 1) comms('rin-bosskill', 0.3);
                break;
            case 'dock':
                mode = 'dock';
                bankCores();
                saveGame(G);
                ui.showHud(false);
                ui.showDock(G);
                refreshTitle();
                ui.openScreen('dock');
                audio.voice('tomo-dock', true);
                break;
            case 'pickup': if (e.kind === 'overdrive') comms('rin-overdrive'); break;
            case 'jump': if (time > jumpSaidT && Math.random() < 0.2) { jumpSaidT = time + 14; comms('rin-jump'); } break;
            case 'victory': case 'over': endRun(e.type === 'victory'); break;
        }
    }
}

function endRun(won) {
    mode = 'over';
    const banked = G.cores;
    bankCores();
    meta.best = Math.max(meta.best, G.score);
    if (won) meta.wins++;
    saveMeta(meta);
    clearSave();
    ui.showOver(G, banked, meta.best);
    refreshTitle();
    voiceQ.length = 0;
    if (won) { comms('kurogane-defeat', 0.5); comms('rin-victory', 0.6); } else comms('rin-over', 0.8);
    setTimeout(() => { if (mode === 'over') { ui.showHud(false); ui.openScreen('over'); } }, won ? 1600 : 1300);
}

function watchGauges() {
    if (mode !== 'play') return;
    const b = G.boat;
    if (b.fuel < FUEL.low && time > fuelWarnT) { fuelWarnT = time + 25; comms('tomo-fuel'); }
    if (b.hull < G.stats.maxHull * 0.3 && lowHullSaid !== G.sector) { lowHullSaid = G.sector; comms('rin-lowhull'); }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = (mode === 'play' && !ui.anyScreen()) || mode === 'title' || mode === 'over';
    if (running && !wasRunning) input.flush();     // the key that closed a menu must not act in the game (game-078)
    wasRunning = running;
    if (running && stopT > 0) { stopT -= dt; acc = 0; }
    else if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            let inp;
            if (mode === 'title') { inp = botInput(demo.G, demo.bot, STEP); if (demo.G.phase === 'dock') nextSector(demo.G); }
            else if (mode === 'over') inp = { x: 0, y: 0, fire: false, jump: false, missile: false };
            else inp = bot ? botInput(G, bot, STEP) : input.state();
            step(G, inp, STEP);
            if (mode === 'play') input.consumeEdges();   // only once a step has seen them
            acc -= STEP;
            n++;
            if (G.events.some((e) => e.type === 'hitstop' || e.type === 'dock' || e.type === 'over' || e.type === 'victory')) break;
        }
        if (mode === 'title' && G.over) { demo = newDemo(); G = demo.G; view.clearAll(); view.terrain.reset(); view.camInit = false; }
        if (mode === 'play') { saveT += dt; if (saveT > 15) { saveT = 0; bankCores(); saveGame(G); } }
    } else acc = 0;
    flushEvents();
    watchGauges();
    pumpComms();
    view.shakeScale = settings.shake ? 1 : 0;
    view.frame(G, dt, time);
    audio.engine(mode === 'play' && !ui.anyScreen() && !G.over, G.boat.speed, G.boat.throttle, G.boat.z > 0.1);
    if (mode === 'play') audio.playMusic(G.boss && !G.boss.mini ? 'boss' : 'river');
    else if (mode === 'title') audio.playMusic('title');
    else audio.playMusic(null);
    if (mode === 'play') ui.hud(G, dt);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') { bankCores(); saveGame(G); } });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hrs = {
        get G() { return G; },
        get mode() { return mode; },
        get meta() { return meta; },
        seen, view, ui, audio, input,
        start(seed = 1, sector = 0, ranks = meta.ranks) { startGame(newGame(seed, ranks, sector)); return G; },
        autoplay(on = true) { bot = on ? makeBot({ skill: 1, seed: 7 }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot({ skill: 1, seed: 3 }); for (let t = 0; t < sec && !G.over && G.phase !== 'dock'; t += STEP) step(G, botInput(G, b, STEP), STEP); flushEvents(); },
        launch: () => launchFromDock(),
        save: () => saveGame(G),
        hasSave,
        give(cores) { meta.cores += cores; saveMeta(meta); refreshTitle(); },
    };
}
