// HEXAPOD RISING — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and
// moves between the title, story, briefing, play, report, hangar, game over and ending.
//
// ?debug=1 exposes window.__hr for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low|med|high picks graphics.

import { STEP, MAX_FRAME } from './config.js';
import { LEVELS } from './sim/data.js';
import { PROLOGUE } from './sim/story.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, loadBest, saveBest } from './save.js';
import * as Gm from './sim/game.js';
import { refreshStats, freePod } from './sim/core.js';
import { makeBot, botInput, botBuy } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const coarse = window.matchMedia?.('(pointer: coarse)').matches;
const quality = ['low', 'med', 'high'].includes(params.get('q')) ? params.get('q') : (['low', 'med', 'high'].includes(settings.gfx) ? settings.gfx : (coarse ? 'med' : 'high'));

const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const canvas = $('view');
const input = new Input(canvas);
let view = null;
try {
    const { View } = await import('./view/view.js');
    view = new View(canvas, { quality });
} catch (err) {
    console.error('[view]', err);
    document.body.insertAdjacentHTML('beforeend', '<p class="noscript">HEXAPOD RISING needs WebGL. Please try another browser.</p>');
}
if (view) { view.onStep = (x, z, sc) => audio.footstep(sc); view.onBossStep = (d) => audio.bossStep(d); view.onTeleport = () => audio.teleport(); }
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
input.bindTouch({
    moveZone: $('move-zone'), moveStick: $('move-stick'), aimZone: $('aim-zone'), aimStick: $('aim-stick'),
    fire: $('tb-fire'), msl: $('tb-msl'), jump: $('tb-jump'), boost: $('tb-boost'),
});

let G = null;                 // the game on screen: the campaign, or the attract-mode demo on the title
let mode = 'title';           // title | story | brief | play | after | report | hangar | dead | ending
let attract = null, attractBot = null, attractN = 0, attractWait = 0;
let acc = 0, time = 0, last = performance.now(), saveT = 0, bot = null, wasRunning = false, later = null;
const seen = {};

// ------------------------------------------------------------------ attract mode (the title's background)
function startAttract() {
    const L = attractN % LEVELS.length; attractN++;
    attract = Gm.newGame(1000 + attractN * 17);
    const n = Math.min(5, Math.floor(L * 0.9) + 1);
    attract.upg = { guns: Math.min(5, n), missiles: Math.min(5, n - (n > 2 ? 1 : 0)), armor: Math.min(5, n + 1), fuel: Math.min(5, n), legs: Math.min(5, n) };
    refreshStats(attract);
    Gm.startLevel(attract, L);
    Gm.begin(attract);
    attractBot = makeBot({ skill: 1 });
    attractWait = 0;
    G = attract;
}

// ------------------------------------------------------------------ menus
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') newCampaign();
    else if (act === 'continue') continueGame();
    else ui.openScreen(act);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
$('btn-pause').addEventListener('click', () => pause());

function newCampaign() {
    attract = null;
    G = Gm.newGame((Date.now() % 1e9) | 0);
    ui.closeAll(); ui.showHud(false);
    mode = 'story';
    ui.story(PROLOGUE, () => gotoBrief());
}
function continueGame() {
    const g = loadGame();
    if (!g) { ui.toast('That save could not be read.'); return; }
    attract = null; G = g; ui.closeAll();
    if (g.phase === 'play') { mode = 'play'; ui.showHud(true); updateTouch(); input.flush(); ui.openScreen('pause'); }
    else if (g.phase === 'complete') showReport();
    else if (g.phase === 'hangar') gotoHangar();
    else gotoBrief();
}
function gotoBrief() {
    mode = 'brief'; ui.showHud(false);
    saveGame(G);
    ui.brief(G, () => deploy());
}
function deploy() {
    Gm.begin(G);
    mode = 'play'; acc = 0;
    document.activeElement?.blur?.();
    input.flush(); ui.showHud(true); updateTouch();
    if (G.level === 0 && !G.flags.hinted) { G.flags.hinted = 1; ui.toast('WASD walk · mouse aim and fire · Space jump · Shift boost'); }
}
function showReport() {
    mode = 'report'; ui.showHud(false); saveGame(G);
    ui.report(G, () => { if (G.level >= LEVELS.length - 1) toTitle(); else gotoHangar(); });
}
function gotoHangar() {
    Gm.toHangar(G);
    mode = 'hangar'; ui.showHud(false);
    saveGame(G);
    ui.hangar(G, (t) => Gm.buy(G, t), () => { Gm.deploy(G); gotoBrief(); });
}
function toTitle() {
    ui.closeAll(); ui.showHud(false);
    mode = 'title'; later = null;
    refreshTitle();
    startAttract();
    ui.openScreen('title');
}
function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}
function updateTouch() {
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ['pause', 'howto', 'settings'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

function readInput() {
    const s = input.state(), p = G.player;
    const inp = { x: s.x, y: s.y, aim: false, ax: 0, az: -1, ad: 26, fire: s.fire, msl: s.msl, jump: s.jump, jet: s.jet, boost: s.boost };
    if (s.aim) { const l = Math.hypot(s.aim.x, s.aim.z) || 1; inp.aim = true; inp.ax = s.aim.x / l; inp.az = s.aim.z / l; inp.ad = 24; }
    else if (s.mouse && view) {
        const gp = view.groundPoint(input.mouse.x, input.mouse.y);
        if (gp) { const dx = gp.x - p.x, dz = gp.z - p.z, d = Math.hypot(dx, dz); if (d > 2) { inp.aim = true; inp.ax = dx / d; inp.az = dz / d; inp.ad = d; } }
    }
    return inp;
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view?.onEvents(G, ev);
    if (G !== attract) { audio.onEvents(G, ev); ui.onEvents(G, ev); }
    if (G === attract) { audio.onEvents(G, ev.filter((e) => e.type === 'boom' || e.type === 'shot').slice(0, 3)); return; }
    for (const e of ev) {
        if (e.type === 'dead') { mode = 'after'; later = { t: 2.2, fn: () => { mode = 'dead'; ui.showHud(false); ui.dead(G, () => { Gm.retry(G); Gm.begin(G); mode = 'play'; acc = 0; input.flush(); ui.showHud(true); updateTouch(); }, () => { saveGame(G); toTitle(); }); } }; }
        else if (e.type === 'levelComplete') { mode = 'after'; later = { t: 2.4, fn: () => showReport() }; }
        else if (e.type === 'victory') {
            mode = 'after';
            later = { t: 7, fn: () => {
                const best = loadBest();
                if (G.score > best.score) { best.score = G.score; }
                best.rescued = Math.max(best.rescued, G.rescued); best.clears++; saveBest(best);
                clearSave(); mode = 'ending'; ui.showHud(false);
                ui.ending(G, best, () => toTitle());
            } };
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
    if (later) { later.t -= dt; if (later.t <= 0) { const f = later.fn; later = null; f(); } }

    const live = (mode === 'play' || mode === 'after') && !ui.anyScreen();
    if (live && !wasRunning) input.flush();             // the key or tap that closed a menu must not also act in the game
    wasRunning = live;
    let viewMode = 'play';
    if (mode === 'hangar') viewMode = 'hangar';
    if (live) {
        acc += dt * FAST;
        const inp = mode === 'play' ? (bot ? botInput(G, bot, STEP) : readInput()) : { x: 0, y: 0, aim: false, ax: 0, az: -1, ad: 26, fire: false, msl: false, jump: false, jet: false, boost: false };
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            Gm.step(G, bot && mode === 'play' ? botInput(G, bot, STEP) : inp, STEP);
            input.consumeEdges(); inp.msl = inp.jump = false;
            acc -= STEP; n++;
        }
        saveT += dt;
        if (saveT > 20 && mode === 'play') { saveT = 0; saveGame(G); }
        // aim feedback
        if (mode === 'play') {
            const s = input.lastDevice;
            let show = false, rx = 0, ry = 0;
            if (s === 'mouse') { show = true; rx = input.mouse.x; ry = input.mouse.y; }
            else if (inp.aim && view) { const p = G.player, pr = view.project(p.x + inp.ax * 24, p.y + 1, p.z + inp.az * 24); show = pr.visible; rx = pr.x; ry = pr.y; }
            ui.reticle(rx, ry, show);
        }
    } else {
        acc = 0;
        if (mode === 'title') {
            if (!attract) startAttract();
            G = attract;
            if (attract.phase === 'play') {
                const n = Math.max(1, Math.round(dt / STEP));
                for (let i = 0; i < n; i++) Gm.step(attract, botInput(attract, attractBot, STEP), STEP);
            } else { attractWait += dt; if (attractWait > 2.5) startAttract(); }
        }
        if (mode !== 'play') ui.reticle(0, 0, false);
    }
    flushEvents();
    if (view && G) {
        view.frame(G, dt, time, viewMode);
        const playing = (mode === 'play' || mode === 'after') && !ui.anyScreen();
        audio.update(G, dt, playing || mode === 'title', view.B ? view.B.wind : 0.4);
    }
    if ((mode === 'play' || mode === 'after') && G) ui.hud(G, dt);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hr = {
        get G() { return G; },
        get mode() { return mode; },
        seen, get view() { return view; }, ui, audio, input,
        /** Skip the title and story and start a mission: start(seed, level, upgrades). */
        start(seed = 1, level = 0, upg = null) {
            attract = null; ui.closeAll();
            G = Gm.newGame(seed);
            if (upg) { Object.assign(G.upg, upg); refreshStats(G); }
            if (level > 0) Gm.startLevel(G, level);
            if (upg) Gm.refit(G);
            Gm.begin(G); mode = 'play'; acc = 0; input.flush(); ui.showHud(true); updateTouch(); return G;
        },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && G.phase === 'play'; t += STEP) Gm.step(G, botInput(G, b, STEP), STEP); flushEvents(); },
        warp(z, x) { const p = G.player; p.z = z; p.x = x ?? G.world.cx(z); p.y = G.world.h(p.x, p.z); p.vx = p.vz = 0; view && (view.camSnap = true); },
        god() { G.player.shieldT = 1e9; },
        hangar() { if (G.phase === 'play' || G.phase === 'brief') { G.scrap = Math.max(G.scrap, 900); G.phase = 'complete'; } gotoHangar(); },
        buy: (t) => Gm.buy(G, t),
        brief: () => gotoBrief(),
        save: () => saveGame(G), hasSave,
        botBuy: () => botBuy(G),
        skip() { later && (later.t = 0); },
        freePod(i = 0) { const p = G.pods[i]; if (p) freePod(G, p); return p ? p.id : 0; },
    };
}
