// HARD HAT HARBOR — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and
// moves between the title, the job board, the people who talk, and driving.
//
// ?debug=1 exposes window.__hh for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low draws less;
// &models=0 keeps the code-built stand-ins.

import { STEP, MAX_FRAME, VEHICLES } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI, prompt } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, current } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { JOB, SPEECH } from './sim/data/jobs.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'), { low: params.get('q') === 'low' });
const pend = { veh: null, job: null };      // choices made in the DOM, handed to the next sim step
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onVeh: (id) => { if (mode === 'play') pend.veh = id; },
    onJob: (id) => chooseJob(id),
});

let G = newGame(1);          // the title screen shows the town in the background
let mode = 'title';          // title | play
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
let after = [];              // things to show once the sim's events have been heard (job done, the finale)
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audio.setTheme('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame((Date.now() % 1e9) | 0), true);
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g, false); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-jobs').addEventListener('click', () => openJobs());

function startGame(g, fresh) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0; after = []; pend.veh = pend.job = null;
    view.camYaw = null;
    input.flush();
    ui.showHud(true);
    updateTouch();
    audio.setTheme('work');
    saveGame(G);
    if (fresh && !bot) ui.talk(SPEECH.intro.giver, SPEECH.intro.text, { voice: 'intro', button: 'Show me the jobs!', onOk: () => openJobs() });
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    audio.stopVoice();
    mode = 'title';
    ui.showHud(false);
    G = newGame(1);
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

function openJobs() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    ui.showJobs(G);
}

/** A job was picked on the board: its giver explains it, and then it is taken. */
function chooseJob(id) {
    ui.closeScreen('jobs');
    if (G.active === id) return;
    const job = JOB[id], js = G.jobs[id];
    ui.talk(job.giver, job.brief, { steps: job.steps.slice(js.step), voice: `${id}-brief`, onOk: () => { pend.job = id; } });
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    ui.setTouch(on);
    ui.key = on ? 'The red button' : input.lastDevice === 'pad' ? 'A' : 'SPACE';
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindAction(document.getElementById('btn-a'));

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if (key === 'Escape' || key === 'KeyP' || (key === 'KeyJ' && top === 'jobs')) {
            // Escape answers a person the same way their button does; it never leaves the title
            if (top === 'talk' || top === 'done' || top === 'finale') { if (key === 'Escape') document.getElementById(top + '-ok').click(); }
            else if (top !== 'title') { audio.ui('close'); ui.closeTop(); }
        } else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyJ') openJobs();
    else if (/^Digit[1-8]$/.test(key)) pend.veh = VEHICLES[+key.slice(5) - 1].id;
    else if (key === 'KeyQ' || key === 'KeyE') {
        const i = VEHICLES.findIndex((v) => v.id === G.veh), n = VEHICLES.length;
        pend.veh = VEHICLES[(i + (key === 'KeyE' ? 1 : n - 1)) % n].id;
    }
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'switch' && !audio.voicePlaying) audio.voice('call-' + e.veh);
        else if (e.type === 'stepDone') { const c = current(G); if (c && c.job.id === e.job) ui.toast(`Next: ${c.st.text}`); saveGame(G); }
        else if (e.type === 'unlock') ui.toast(`New job on the board: ${JOB[e.job].title}`);
        else if (e.type === 'jobDone') { after.push({ t: 'done', job: e.job, stars: e.stars, time: e.time }); saveGame(G); }
        else if (e.type === 'allDone') after.push({ t: 'finale' });
    }
}

/** One at a time: the thank-you for a finished job, then the finale, then back to the board. */
function showAfter() {
    if (!after.length || ui.anyScreen() || mode !== 'play') return;
    const a = after.shift();
    if (bot) { if (a.t === 'done') ui.toast(`${JOB[a.job].title}: ${'★'.repeat(a.stars)}`); return; }
    if (a.t === 'done') ui.jobDone(JOB[a.job], a.stars, a.time, () => { if (!after.length && !G.finished) openJobs(); });
    else ui.finale(G, SPEECH.finale.text, null);
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : input.state();
            // a swap asked for during the last swap's cooldown waits for it, instead of being dropped
            if (pend.veh && G.switchCd <= 0) { inp.veh = pend.veh; pend.veh = null; }
            if (pend.job) { inp.job = pend.job; pend.job = null; }
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else acc = 0;
    flushEvents();
    showAfter();
    audio.setEngine(running, G.p.v, G.veh);
    view.frame(G, dt, time, { orbit: mode === 'title' });
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hh = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, pend,
        prompt: () => prompt(G, ui.key),
        /** Start a game without the mayor's welcome. */
        start(seed = 1) { startGame(newGame(seed), false); return G; },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 5 }) : null; },
        /** Run the sim ahead synchronously with a bot playing; events reach the view as usual. until: stop early. */
        ff(sec, until = null) {
            const b = makeBot({ seed: 5 });
            for (let t = 0; t < sec && !G.finished; t += STEP) { step(G, botInput(G, b), STEP); if (until && until(G)) break; }
            flushEvents();
            after = [];                      // (the thank-you screens are for players, not for a fast-forward)
            return G.t;
        },
        cmd(c) { Object.assign(pend, c); },
        save: () => saveGame(G),
        hasSave,
    };
}
