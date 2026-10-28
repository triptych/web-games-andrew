// SOLDER & RAIN: entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, the shop, the bench and the story.
//
// ?debug=1 exposes window.__sr for the dev/ harnesses; &fast=N runs N× simulation per frame;
// &q=low|med|high picks the graphics tier.

import { STEP, MAX_FRAME, TOOLS } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, step } from './sim/game.js';
import { describe, parseRef } from './sim/rules.js';
import { nextGoal } from './sim/plan.js';
import { repairJob, playCampaign } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const quality = params.get('q') || (settings.quality === 'auto' ? 'med' : settings.quality);
const canvas = document.getElementById('view');
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.calm ? settings.music * 0.6 : settings.music);
const input = new Input(canvas);
const reduced = settings.calm || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const view = new View(canvas, { quality, reduced });
const ui = new UI({
    audio, settings,
    act: (c) => doAct(c),
    onSettings: (s) => {
        saveSettings(s); audio.setVolumes(s.sfx, s.calm ? s.music * 0.6 : s.music);
        G.manual = !!s.manual; view.setReduced(s.calm || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        view.setQuality(params.get('q') || (s.quality === 'auto' ? 'med' : s.quality)); updateTouch();
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let G = freshGame(1);
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let guideT = 0, guideJob = 0, bot = null, wasRunning = false, drag = null, statusFlash = 0, lastFree = { kind: 'blaster', tier: 3, seed: 1 };
const seen = {};             // a count of every sim event drained, for the tests

function freshGame(seed) {
    const g = newGame(seed);
    g.manual = !!settings.manual;
    return g;
}
function resetGame(g) {
    G = g; G.manual = !!settings.manual;
    view.clearJob(); acc = 0; bot = null; drag = null;
    input.flush();
    ui.closeAll();
}

// ------------------------------------------------------------------ commands
function doAct(c) {
    const ok = act(G, c);
    return ok;
}

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') { resetGame(freshGame(((Date.now() % 1e6) | 0) + 1)); doAct({ t: 'campaign', seed: G.seed }); startPlay(); }
    else if (a === 'continue') {
        const g = loadGame();
        if (g) { resetGame(g); startPlay(); } else ui.toast('That save could not be read.');
    } else if (a === 'free') ui.openScreen('freebench');
    else ui.openScreen(a);
});
document.getElementById('fb-go').addEventListener('click', () => {
    audio.ui('click');
    lastFree = ui.freeBenchChoice();
    ui.closeAll();
    resetGame(freshGame(lastFree.seed)); doAct({ t: 'free', ...lastFree }); startPlay();
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'board') { ui.closeScreen('pause'); ui.openBoard(G); }
    else ui.openScreen(a);
});
for (const id of ['btn-pause', 'btn-pause2']) document.getElementById(id).addEventListener('click', () => pause());
document.getElementById('btn-call').addEventListener('click', () => {
    audio.ui('bell');
    doAct({ t: document.getElementById('btn-call').dataset.mode === 'close' ? 'close' : 'call' });
});
document.getElementById('btn-board').addEventListener('click', () => { audio.ui('open'); ui.openBoard(G); });
document.getElementById('btn-upgrades').addEventListener('click', () => { audio.ui('open'); ui.openUpgrades(G); });
document.getElementById('btn-accept').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'accept' }); });
document.getElementById('btn-collect').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'collect' }); });
document.getElementById('btn-nextday').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'nextday' }); saveGame(G); });
document.getElementById('btn-credits-title').addEventListener('click', () => { audio.ui('click'); clearSave(); toTitle(); });
document.getElementById('btn-free-title').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('btn-free-again').addEventListener('click', () => { audio.ui('click'); lastFree = { ...lastFree, seed: 1 + Math.floor(Math.random() * 99999) }; doAct({ t: 'again', ...lastFree }); });
document.getElementById('dialogue').addEventListener('click', (e) => { if (e.target.closest('#d-opts')) return; ui.advanceDialogue(G); });
document.getElementById('btn-test').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'test' }); });
document.getElementById('btn-hint').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'hint' }); document.getElementById('task').open = true; });
document.getElementById('btn-rev').addEventListener('click', () => { audio.ui('click'); doAct({ t: 'reverse' }); });
document.getElementById('btn-spares').addEventListener('click', (e) => {
    const J = G.job;
    if (J && J.held && J.held.k === 'part' && J.dev.parts[J.held.id].spare) { e.stopImmediatePropagation(); doAct({ t: 'return' }); }
}, { capture: true });
for (const b of document.querySelectorAll('[data-cam]')) {
    b.addEventListener('click', () => {
        const k = b.dataset.cam;
        if (k === 'left') view.orbit(-90, 0); else if (k === 'right') view.orbit(90, 0);
        else if (k === 'in') view.zoomBy(-260); else if (k === 'out') view.zoomBy(260); else view.resetCamera();
    });
}
document.getElementById('tools').addEventListener('click', () => {});

function startPlay() {
    ui.closeAll();
    document.activeElement?.blur?.();
    acc = 0; input.flush(); updateTouch();
}
function toTitle() {
    resetGame(freshGame(1));
    refreshTitle();
}
function pause() {
    if (G.phase === 'title' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}
function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
updateTouch();

// ------------------------------------------------------------------ keys
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if (key === 'Escape' || key === 'KeyP') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    const phase = G.phase;
    if (phase === 'title' || phase === 'brief' || phase === 'result' || phase === 'endday' || phase === 'credits' || phase === 'freeover') {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (phase === 'dialogue') {
        const line = G.dlg && G.dlg.lines[G.dlg.i];
        if (key === 'Escape' || key === 'KeyP') { pause(); return; }
        if (line && line.ask) {
            if (key === 'ArrowDown') ui.moveFocus(1, 'dialogue'); else if (key === 'ArrowUp') ui.moveFocus(-1, 'dialogue');
            else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
            return;
        }
        if (key === 'Space' || key === 'Enter' || key === 'KeyZ') ui.advanceDialogue(G);
        return;
    }
    if (phase === 'shop') {
        if (key === 'Escape' || key === 'KeyP') pause();
        else if (key === 'KeyB') ui.openBoard(G);
        else if (key === 'Space' || key === 'Enter') document.getElementById('btn-call').click();
        return;
    }
    if (phase === 'bench') {
        if (key === 'Escape' || key === 'KeyP') { pause(); return; }
        if (key === 'KeyT') doAct({ t: 'test' });
        else if (key === 'KeyH') document.getElementById('btn-hint').click();
        else if (key === 'KeyR') doAct({ t: 'reverse' });
        else if (key === 'KeyC') view.resetCamera();
        else if (key === 'KeyU') document.getElementById('btn-spares').click();
        else if (/^(Digit|Numpad)[1-9]$/.test(key)) {
            const t = TOOLS[+key.slice(-1) - 1];
            if (t) doAct({ t: 'tool', tool: t.id });
        }
    }
}

// ------------------------------------------------------------------ pointer
function pointerFrame(dt) {
    const bench = G.phase === 'bench' && !ui.anyScreen();
    const evs = input.drainPointer();
    const g = input.takeGesture();
    if (!bench) { drag = null; view.ptrActive = false; return; }
    if (g.zoom) view.zoomBy(g.zoom);
    if (g.dx || g.dy) view.pan(g.dx, g.dy);
    if (input.keys.has('KeyQ') || input.keys.has('ArrowLeft')) view.orbit(-280 * dt, 0);
    if (input.keys.has('KeyE') || input.keys.has('ArrowRight')) view.orbit(280 * dt, 0);
    if (input.keys.has('ArrowUp')) view.orbit(0, -200 * dt);
    if (input.keys.has('ArrowDown')) view.orbit(0, 200 * dt);
    if (input.keys.has('KeyZ')) view.zoomBy(-360 * dt);
    if (input.keys.has('KeyX')) view.zoomBy(360 * dt);
    const J = G.job;
    for (const ev of evs) {
        if (ev.t === 'cancel') { if (drag && drag.kind === 'sim') doAct({ t: 'up' }); drag = null; continue; }
        if (ev.t === 'down') {
            view.ptrActive = true;
            const pk = view.pick(ev.x, ev.y, G, ev.touch);
            if (ev.button === 2) { drag = { kind: 'orbit', x: ev.x, y: ev.y }; continue; }
            if (ev.button === 1 || ev.shift) { drag = { kind: 'pan', x: ev.x, y: ev.y }; continue; }
            if (!J || J.test) { drag = null; continue; }
            if (J.held || pk.ref) {
                drag = { kind: 'sim' };
                doAct({ t: 'down', ref: pk.ref, bx: pk.bx, bz: pk.bz, ax: pk.ax, az: pk.az, px: pk.px, pz: pk.pz });
                ui.setHover(pk.ref ? describe(J.dev, pk.ref) : '');
            } else drag = { kind: 'orbit', x: ev.x, y: ev.y };
        } else if (ev.t === 'move') {
            view.ptrActive = true;
            if (drag && (drag.kind === 'orbit' || drag.kind === 'pan')) {
                if (drag.kind === 'orbit') view.orbit(ev.x - drag.x, ev.y - drag.y); else view.pan(ev.x - drag.x, ev.y - drag.y);
                drag.x = ev.x; drag.y = ev.y;
                continue;
            }
            const pk = view.pick(ev.x, ev.y, G, ev.touch);
            if (J) {
                doAct({ t: 'move', ref: pk.ref, bx: pk.bx, bz: pk.bz, ax: pk.ax, az: pk.az, px: pk.px, pz: pk.pz });
                if (!ev.touch || ev.held) { view.setHover(G, pk.ref); ui.setHover(pk.ref && !J.held ? describe(J.dev, pk.ref) : ''); }
            }
        } else if (ev.t === 'up') {
            if (drag && drag.kind === 'sim' && J) {
                const el = document.elementFromPoint(ev.x, ev.y);
                const held = J.held;
                if (held && held.k === 'part' && J.dev.parts[held.id].spare && el && el.closest('#spares, #btn-spares')) doAct({ t: 'return' });
                else doAct({ t: 'up' });
            }
            if (ev.touch) view.ptrActive = false;
            drag = null;
        }
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'tool' && !e.auto) { const t = TOOLS.find((x) => x.id === e.tool); ui.setHover(t ? `${t.name}: ${t.blurb}` : ''); statusFlash = 2.4; }
        if (e.type === 'day') saveGame(G);
        if (e.type === 'ending') clearSave();
    }
}

// ------------------------------------------------------------------ frame loop
/** How much of the screen the bench HUD covers at the top and bottom (the camera frames what is left). */
function frameSafe() {
    const hh = innerHeight;
    let bottom = 0, top = 0;
    for (const sel of ['#tools', '#actions']) {
        const r = document.querySelector(sel).getBoundingClientRect();
        if (r.height && r.top > hh * 0.4) bottom = Math.max(bottom, hh - r.top + 6);
    }
    const t = document.getElementById('hud-top').getBoundingClientRect();
    top = Math.max(0, t.bottom + 4);
    const gd = document.getElementById('guide');
    if (!gd.hidden) top = Math.max(top, gd.getBoundingClientRect().bottom + 4);
    // landscape phones put the bars at the sides, not the bottom: the bench has the full height
    view.setSafe(Math.min(top, hh * 0.25), Math.min(bottom, hh * 0.5));
}
/** Is the live "Next:" guide showing? Always, never, or (the default) for the first two days. */
function guideOn() {
    const g = settings.guide;
    if (g === 'on') return true;
    if (g === 'off') return false;
    const s = G.story;
    return !!(s && (s.free ? G.job && G.job.tier <= 1 : s.day <= 2));
}
function guideFrame(dt) {
    const J = G.job;
    if (!J) return;
    guideT -= dt;
    if (guideT > 0) return;
    guideT = 0.25;
    const on = guideOn() && !J.test;
    if (on && J.id !== guideJob) { guideJob = J.id; if (innerWidth > 560) document.getElementById('task').open = true; }
    let goal = null;
    if (on) { try { goal = nextGoal(G, {}); } catch { goal = null; } }
    ui.setGuide(goal, on); view.setGuide(goal, on);
}
let prevPhase = G.phase;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    input.poll();
    handlePresses();
    pointerFrame(dt);

    const running = G.phase === 'bench' && !ui.anyScreen();
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            if (bot) { const r = bot.next(); if (r.done) bot = null; }
            step(G, {}, STEP);
            acc -= STEP; n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else {
        acc = 0;
        if (bot && G.phase !== 'bench' && G.phase !== 'title') { const r = bot.next(); if (r.done) bot = null; }
    }
    if (G.phase === 'bench') { frameSafe(); guideFrame(dt); } else if (guideT !== -1) { guideT = -1; ui.setGuide(null, false); view.setGuide(null, false); }
    flushEvents();
    if (statusFlash > 0) { statusFlash -= dt; if (statusFlash <= 0) ui.setHover(''); }
    ui.sync(G, dt, time);
    if (G.phase !== prevPhase) {
        prevPhase = G.phase;
        audio.setMood(G.phase === 'bench' ? 'bench' : G.phase === 'title' ? 'title' : 'shop');
        if (G.phase !== 'title' && G.phase !== 'credits') saveGame(G);
        document.activeElement?.blur?.();
        if (G.phase === 'title') refreshTitle();
    }
    view.frame(G, dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden && G.phase !== 'title') { saveGame(G); if (G.phase === 'bench') pause(); } });
window.addEventListener('pagehide', () => { if (G.phase !== 'title') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    const run = (gen) => { for (let r = gen.next(); !r.done; r = gen.next()) step(G, {}, STEP); flushEvents(); };
    window.__sr = {
        get G() { return G; },
        get mode() { return G.phase; },
        seen, view, ui, audio, input, act: doAct, nextGoal: (o) => nextGoal(G, o || {}),
        free(kind = 'noodlebot', tier = 1, seed = 1) { resetGame(freshGame(seed)); doAct({ t: 'free', kind, tier, seed }); startPlay(); return G; },
        campaign(seed = 1) { resetGame(freshGame(seed)); doAct({ t: 'campaign', seed }); startPlay(); return G; },
        /** Repair the current job with the bot, instantly. */
        solve(opt = { clean: true, stash: true }) { run(repairJob(G, opt)); },
        /** Run n bot goals, then stop (for looking at a half-finished repair). */
        goals(n = 5, opt = { clean: true, stash: true }) { try { run(repairJob(G, { ...opt, maxGoals: n })); } catch (e) { if (!/gave up/.test(e.message)) throw e; } },
        /** Play the whole campaign instantly. */
        playAll(opt = {}) { run(playCampaign(G, opt)); },
        autoplay(on = true, opt = { clean: true, stash: true }) { bot = on ? repairJob(G, opt) : null; },
        project: (ref) => view.project(ref),
        pick: (x, y) => view.pick(x, y, G, false),
        save: () => saveGame(G), hasSave,
        toTitle,
    };
}
