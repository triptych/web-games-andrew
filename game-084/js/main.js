// ROMANCER — entry point. Boots the lab, moves between the title, the lab, the workbench and
// playing a cart on the television, runs the VESTA-8 at a fixed 60 frames a second, tells the
// story and keeps the save.
//
// ?debug=1 exposes window.__rm for the dev/ harnesses; &fast=N runs N× console frames per frame.

import { STEP, MAX_FRAME } from './config.js';
import { V, exportHTML, importCart } from './runtime/index.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { Bench } from './ui/bench.js';
import { $ } from './ui/dom.js';
import { loadSettings, saveSettings, hasSave, saveProgress, loadProgress, loadStudio, saveStudio, clearSave } from './save.js';
import { MISSIONS, missionById } from './meta/missions.js';
import { SCENES } from './meta/story.js';
import { BOTS } from './meta/bots.js';
import {
    newProgress, hasFeature, paletteSize, missionTasks, recordPlay, tryComplete, repairTask, checkAchievements,
    currentMission, memory, isDone, FEATURES, ACHIEVEMENTS, addCreative, creativeById, removeCreative, templates, featuresFor,
} from './meta/progress.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
const autoQuality = () => (coarse ? 1 : 2);
const quality = params.has('quality') ? +params.get('quality') : settings.quality >= 0 ? settings.quality : autoQuality();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'), quality);
view.setCRTAmount([0, 0.5, 1][settings.crt] ?? 1);

let P = null;                 // the researcher's progress
let expedition = false;       // false until New Expedition or Continue: a Studio visit alone saves only the Studio
let mode = 'title';           // title | lab | bench | play
let benchCtx = null;          // { kind: 'mission', id } | { kind: 'studio', id }
let run = null, runCart = null, playCtx = null;
let acc = 0, time = 0, last = performance.now();
let botOn = false, botState = {};
let attract = null;
let lastLog = [];
let pendingComplete = null;
const seen = {};              // a count of every console event drained, for the tests

const ui = new UI({
    audio, settings,
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        const q = s.quality >= 0 ? s.quality : autoQuality();
        if (q !== view.quality) view.setQuality(q);
        view.setCRTAmount([0, 0.5, 1][s.crt] ?? 1);
        updatePad();
        if (mode === 'bench') bench.openTab(bench.tab);
    },
    onDeleteSave: () => { clearSave(); P = null; expedition = false; toTitle(); },
});

// ------------------------------------------------------------------ progress helpers
const feature = (f) => !!P && hasFeature(P, f, benchCtx?.kind === 'studio' && settings.openArchive);
const palSize = () => (P ? paletteSize(P, benchCtx?.kind === 'studio' && settings.openArchive) : 4);
function displayPalette() {
    // until RALLY is restored the colour DAC is broken: everything shows as green phosphor
    if (P && (hasFeature(P, 'pal8') || (playCtx?.studio && settings.openArchive))) return V.PAL_RGB;
    return V.PHOSPHOR;
}
function save() {
    if (!P) return;
    if (expedition) saveProgress(P); else saveStudio(P);
}
let saveT = null;
const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 600); };
function stat(k, n = 1) { if (!P) return; P.stats[k] = (P.stats[k] || 0) + n; awardAchievements(); }
function awardAchievements() {
    if (!P || !expedition) return [];
    const got = checkAchievements(P);
    for (const a of got) ui.toast(`${a.icon} Commendation: ${a.name}`, true);
    return got;
}
function ensureProgress() {
    if (P) return;
    P = newProgress();
    const st = loadStudio();
    P.creative = st.carts;
    P.nextId = Math.max(P.nextId, st.nextId, st.carts.length + 1);
}

// ------------------------------------------------------------------ the workbench
const bench = new Bench({
    audio, view, ui,
    feature, paletteSize: palSize,
    taskStates: () => (benchCtx?.kind === 'mission' ? missionTasks(P, benchCtx.id) : []),
    stat,
    lastLog: () => lastLog,
    onChange: (kind) => {
        if (benchCtx?.kind === 'studio') { const e = creativeById(P, benchCtx.id); if (e) e.cart = bench.cart; }
        refreshPreview();
        saveSoon();
        void kind;
    },
    onPlay: () => playBench(),
    onBack: () => toLab(),
    onRepair: (taskId) => {
        const s = P.missions[benchCtx.id];
        const live = s.cart;
        repairTask(P, benchCtx.id, taskId);
        const fresh = s.cart;
        s.cart = live;
        bench.replaceCart(fresh);
        ui.toast('VESTA patched it from memory.', true);
        save();
    },
    onResetMission: () => {
        const s = P.missions[benchCtx.id];
        bench.replaceCart(missionById(benchCtx.id).build());
        void s;
        save();
    },
    onCopyToStudio: () => {
        const e = addCreative(P, JSON.parse(JSON.stringify(bench.cart)), bench.cart.title + ' (copy)');
        save();
        ui.toast(`Copied to the Studio as “${e.cart.title}”.`, true);
    },
    openCodex: (t) => openCodex(t),
});

function openBench(ctx, opts = {}) {
    ensureProgress();
    benchCtx = ctx;
    let cart, mission = null;
    if (ctx.kind === 'mission') { cart = P.missions[ctx.id].cart; mission = missionById(ctx.id); }
    else cart = creativeById(P, ctx.id).cart;
    ui.closeAll();
    ui.showHub(false);
    mode = 'bench';
    view.setPose('bench');
    view.setSlot(mission, cart);
    bench.open({ cart, mode: ctx.kind === 'studio' ? 'studio' : 'mission', mission, tab: opts.tab });
    refreshPreview();
    audio.setHum(true, 0.6);
}
function refreshPreview() {
    if (mode !== 'bench' || !bench.cart) return;
    const Pp = V.prepare(bench.cart);
    const li = bench.tab === 'map' ? bench.editors.map.li : 0;
    view.showFB(V.previewFrame(Pp, li), displayPalette());
    view.setScreen({ power: 1, noise: 0 });
}

// ------------------------------------------------------------------ playing on the television
function startRun(cart, ctx) {
    runCart = cart;
    playCtx = ctx;
    run = V.newRun(V.prepare(cart), { seed: (Date.now() % 1e6) | 1 });
    botState = {};
    acc = 0;
    drainRun();
}
function playBench() {
    const ctx = benchCtx.kind === 'mission' ? { mission: benchCtx.id, back: 'bench' } : { studio: benchCtx.id, back: 'bench' };
    bench.close();
    beginPlay(bench.cart, ctx);
}
function beginPlay(cart, ctx) {
    audio.init();
    ui.closeAll();
    ui.showHub(false);
    attract = null;
    mode = 'play';
    input.capture = true;
    input.clear();
    document.activeElement?.blur?.();
    startRun(cart, ctx);
    $('playbar').hidden = false;
    $('play-title').textContent = cart.title;
    updatePad();
    view.setPose('crt');
    view.setScreen({ power: 1, noise: 0 });
    audio.setHum(false);
    stat('plays', 0);
}
function recordRun() {
    if (!run || !P) return;
    const st = run.stats;
    if (st.frames < 2 && !st.wins) return;
    const id = playCtx?.mission;
    if (id) recordPlay(P, id, st); else P.stats.plays++;
    if (st.wins) {
        if (playCtx?.studio) P.stats.creatorWin = true;
        if (id === 'rally' && (run.globals.rival || 0) === 0) P.stats.shutout = true;
    }
    // Debugger: a cart that hit a script error, then ran cleanly
    const key = id || playCtx?.studio;
    P.errored = P.errored || {};
    if (run.status === 'error') P.errored[key] = true;
    else if (P.errored[key] && st.frames > 300) { P.stats.debugged = true; delete P.errored[key]; }
    lastLog = run.log.slice();
    run.stats = { ...st, maxG: {}, wins: 0, frames: 0 };
    save();
}
function stopPlay() {
    if (mode !== 'play') return;
    recordRun();
    audio.synth.stopMusic();
    input.capture = false;
    $('playbar').hidden = true;
    updatePad();
    const ctx = playCtx;
    run = null;
    playCtx = null;
    awardAchievements();
    if (ctx?.mission && checkComplete(ctx.mission)) return;
    if (ctx?.back === 'bench') openBench(ctx.mission ? { kind: 'mission', id: ctx.mission } : { kind: 'studio', id: ctx.studio });
    else toLab();
    if (lastLog.length) ui.toast('print() output is in the checklist panel.');
}
function drainRun() {
    if (!run) return;
    const ev = run.events.splice(0);
    for (const e of ev) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        if (e.type === 'sfx' || e.type === 'win' || e.type === 'lose') view.pulseScope(0.6);
        if (e.type === 'error') ui.toast(`Script error in ${e.who === 'game' ? 'the game script' : e.who}, line ${e.line}: ${e.msg}`);
        if (e.type === 'win' && playCtx?.mission) {
            recordRun();
            if (missionTasks(P, playCtx.mission).every((t) => t.done)) pendingComplete = { id: playCtx.mission, t: 1.6 };
        }
    }
    audio.onCartEvents(runCart, ev);
}
function stepPlay(dt) {
    acc += dt * FAST;
    let n = 0;
    while (acc >= STEP && n < 4 * FAST) {
        let m = botOn && playCtx?.mission && BOTS[playCtx.mission] ? BOTS[playCtx.mission](run, botState) : input.mask();
        if (!botOn) input.consume();
        if (run.status !== 'run' && run.status !== 'error' && run.overT > 40 && (m & V.BTN.a) && !(run.btn & V.BTN.a)) {
            recordRun();
            const r2 = V.restartRun(run);
            run = r2;
            botState = {};
            drainRun();
        } else V.stepRun(run, m);
        drainRun();
        acc -= STEP;
        n++;
    }
    if (n === 0) {
        // no console frame ran: keep a tap made now for the next one (game-059)
    }
    audio.synth.tick();
    V.drawRun(run);
    view.showFB(run.fb, displayPalette());
}

// ------------------------------------------------------------------ restoring a cartridge
function checkComplete(id) {
    const done = tryComplete(P, id);
    if (!done) return false;
    const m = missionById(id);
    view.setCarts(MISSIONS, P);
    view.setMemory(MISSIONS.map((x) => P.missions[x.id].state));
    view.setSlot(null);
    toLab(true);
    audio.fanfare();
    const items = done.unlocked.map((u) => ({ text: '◆ ' + u.label }));
    if (done.next) items.push({ text: '▸ Recovered: cartridge ' + missionById(done.next).n + ' — ' + (missionById(done.next).final ? 'handwritten' : missionById(done.next).title) });
    for (const a of awardAchievements()) items.push({ text: `${a.icon} ${a.name} — ${a.text}`, ach: true });
    save();
    ui.restored(m, P.missions[id].cart, memory(P), items);
    ui.onClose = (sid) => {
        if (sid !== 'restored') return;
        ui.onClose = null;
        const scene = m.final ? 'ending' : 'done_' + id;
        story(scene).then(() => {
            if (m.final) { P.ended = true; awardAchievements(); save(); ui.toast('The Studio is yours. Make anything.', true); }
            refreshHub();
        });
    };
    return true;
}

// ------------------------------------------------------------------ story
function story(id) {
    const lines = SCENES[id];
    if (!lines || !P) return Promise.resolve();
    P.scenes[id] = true;
    save();
    return ui.playScene(lines, { name: P.name, title: P.missions.last.cart?.title || '' });
}

// ------------------------------------------------------------------ the lab
function refreshHub() {
    if (!P) return;
    const m = currentMission(P);
    let info;
    if (m) {
        const st = missionTasks(P, m.id);
        const next = m.tasks[st.findIndex((t) => !t.done)];
        info = { eyebrow: m.final ? 'CARTRIDGE 9 · HANDWRITTEN' : `CARTRIDGE ${m.n} · ${m.year}`, title: m.title, goal: next ? next.text : 'Ready to play.', pulse: true };
    } else info = { eyebrow: 'ALL CARTRIDGES RESTORED', title: 'THE STUDIO IS YOURS', goal: 'Make anything. Export it. Share it.' };
    info.memory = memory(P);
    ui.hub(info);
}
function toLab(silent) {
    ensureProgress();
    bench.close();
    ui.closeAll();
    mode = 'lab';
    benchCtx = null;
    input.capture = false;
    view.setPose('lab');
    view.setCarts(MISSIONS, P);
    view.setMemory(MISSIONS.map((x) => P.missions[x.id].state));
    const cm = currentMission(P);
    view.setSlot(cm, cm ? P.missions[cm.id].cart : null);
    ui.showHub(true);
    refreshHub();
    audio.setHum(true);
    void silent;
}
function toTitle() {
    if (mode === 'play') { recordRun(); audio.synth.stopMusic(); run = null; playCtx = null; }
    bench.close();
    ui.closeAll();
    ui.showHub(false);
    $('playbar').hidden = true;
    input.capture = false;
    mode = 'title';
    benchCtx = null;
    view.setPose('title');
    if (P) { view.setCarts(MISSIONS, P); view.setMemory(MISSIONS.map((x) => P.missions[x.id].state)); }
    $('btn-continue').hidden = !hasSave();
    ui.openScreen('title');
    updatePad();
    startAttract();
}

/** Insert a cartridge: the first time, VESTA briefs you. */
function insert(id) {
    const s = P.missions[id];
    if (!s || s.state === 'locked') return;
    audio.ui('insert');
    const go = () => openBench({ kind: 'mission', id });
    if (!P.scenes['brief_' + id] && SCENES['brief_' + id]) { ui.closeAll(); story('brief_' + id).then(go); }
    else go();
}

// ------------------------------------------------------------------ title attract mode
function startAttract() {
    attract = null;
    const restored = P ? MISSIONS.filter((m) => isDone(P, m.id) && ['rally', 'brick', 'invasion', 'munch', 'dungeon'].includes(m.id)) : [];
    if (!restored.length) { view.setScreen({ power: 1, noise: 0 }); return; }
    const m = restored[Math.floor(Math.random() * restored.length)];
    attract = { id: m.id, run: V.newRun(V.prepare(P.missions[m.id].cart), { seed: (Date.now() % 1e5) | 1 }), bot: {}, acc: 0 };
}
function stepAttract(dt) {
    if (!attract) { drawBoot(); return; }
    attract.acc += dt;
    while (attract.acc >= STEP) {
        attract.acc -= STEP;
        V.stepRun(attract.run, BOTS[attract.id](attract.run, attract.bot));
        attract.run.events.length = 0;
        if (attract.run.status !== 'run' || attract.run.stats.frames > 60 * 40) { startAttract(); return; }
    }
    V.drawRun(attract.run);
    V.rectfill(attract.run.fb, 0, 112, 160, 8, 0);
    V.text(attract.run.fb, 'DEMO  ·  ' + missionById(attract.id).title, 4, 113, 6);
    view.showFB(attract.run.fb, displayPalette());
}
const bootFB = V.makeFB();
function drawBoot() {
    const fb = bootFB;
    V.resetClip();
    V.cls(fb, 0);
    V.text(fb, 'VESTA-8 BIOS 1.0', 8, 8, 3);
    V.text(fb, '(C) 1983 HALCYON ELECTRONICS', 8, 16, 2);
    V.text(fb, 'MEMORY CHECK ... ' + (P ? memory(P) : 0) + '%', 8, 32, 3);
    const m = P && currentMission(P);
    if (mode === 'lab' && m) {
        V.text(fb, 'CARTRIDGE: ' + m.title, 8, 48, 3);
        V.text(fb, 'TAP THE CONSOLE TO REPAIR IT', 8, 56, 2);
    } else V.text(fb, 'INSERT CARTRIDGE', 8, 48, 3);
    if (Math.floor(time * 2) % 2) V.rectfill(fb, 8, 64, 4, 6, 3);
    for (let i = 0; i < 9; i++) {
        const st = P ? P.missions[MISSIONS[i].id].state : 'locked';
        V.rectfill(fb, 8 + i * 16, 96, 12, 8, st === 'done' ? 3 : st === 'open' ? 2 : 1);
    }
    V.text(fb, 'SECTORS', 8, 88, 2);
    view.showFB(fb, displayPalette());
}

// ------------------------------------------------------------------ menus and buttons
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') { if (hasSave()) ui.openScreen('confirm-new'); else ui.openScreen('name'); }
    else if (act === 'continue') {
        const p = loadProgress();
        if (!p) { ui.toast('That save could not be read.'); return; }
        P = p; expedition = true;
        audio.ui('boot');
        toLab();
    } else if (act === 'studio') { ensureProgress(); openStudio(); }
    else ui.openScreen(act);
});
$('confirm-new-go').addEventListener('click', () => { ui.closeScreen('confirm-new'); ui.openScreen('name'); });
$('name-go').addEventListener('click', () => startExpedition($('name-input').value));
$('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') startExpedition(e.target.value); });
function startExpedition(name) {
    const studio = loadStudio();
    P = newProgress(String(name || 'ORI').trim().toUpperCase().replace(/[^A-Z0-9 \-']/g, '').slice(0, 14) || 'ORI');
    P.creative = studio.carts;
    P.nextId = Math.max(P.nextId, studio.nextId, studio.carts.length + 1);
    expedition = true;
    save();
    audio.init();
    audio.ui('boot');
    toLab();
    story('prologue').then(() => { ui.toast('Tap the console, or WORKBENCH, to start repairing RALLY.'); refreshHub(); });
}

$('dock').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || mode !== 'lab') return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'bench') { const m = currentMission(P); if (m) insert(m.id); else openStudio(); }
    else if (act === 'archive') openArchive();
    else if (act === 'studio') openStudio();
    else if (act === 'journal') openJournal('log');
    else if (act === 'codex') openCodex('script');
    else if (act === 'menu') ui.openScreen('menu');
});
$('hub-card').addEventListener('click', () => { const m = currentMission(P); if (m) ui.brief(m, P.missions[m.id].state, { onInsert: insert, onPlay: playRestored }); });
$('menu-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('menu');
    else if (act === 'quit') { save(); toTitle(); }
    else ui.openScreen(act);
});
$('play-stop').addEventListener('click', () => { audio.ui('close'); stopPlay(); });
$('play-restart').addEventListener('click', () => { if (run) { recordRun(); startRun(runCart, playCtx); audio.ui('click'); } });

function openArchive() {
    ui.archive(MISSIONS, P, { onInsert: (id) => { ui.closeAll(); insert(id); }, onPlay: (id) => playRestored(id) });
    ui.openScreen('archive');
    view.setPose('shelf');
    ui.onClose = (id) => { if (id === 'archive' && mode === 'lab') view.setPose('lab'); };
}
function playRestored(id) { beginPlay(P.missions[id].cart, { mission: id, back: 'lab' }); }

function openStudio() {
    ensureProgress();
    const render = () => ui.studio(P.creative, {
        note: settings.openArchive ? 'Open Archive is on: every tool is unlocked here.' : `Tools here are the ones VESTA has recovered (${Object.keys(FEATURES).filter((f) => hasFeature(P, f)).length} of ${Object.keys(FEATURES).length}). Restore cartridges for more, or switch on Open Archive in Settings.`,
        templates: templates(P),
        onOpen: (id) => openBench({ kind: 'studio', id }),
        onPlay: (id) => beginPlay(creativeById(P, id).cart, { studio: id, back: mode === 'title' ? 'title' : 'lab' }),
        onDelete: (id) => { removeCreative(P, id); save(); render(); },
    });
    render();
    ui.openScreen('studio');
    $('studio-create').onclick = () => {
        const t = templates(P).find((x) => x.id === $('studio-template').value) || templates(P)[0];
        const e = addCreative(P, t.cart(), t.id === 'blank' ? 'MY GAME ' + (P.creative.length + 1) : undefined);
        save();
        audio.ui('insert');
        openBench({ kind: 'studio', id: e.id });
    };
    $('studio-import').onclick = () => $('studio-file').click();
    $('studio-file').onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f) return;
        const c = importCart(await f.text());
        if (!c) { ui.toast('That file doesn\'t hold a VESTA-8 cart.'); return; }
        addCreative(P, c);
        save();
        render();
        ui.toast(`Loaded “${c.title}” into the Studio.`, true);
    };
}
function openJournal(tab) {
    const render = (t) => ui.journal(P, MISSIONS, SCENES, ACHIEVEMENTS, t, (scene) => { ui.closeAll(); story(scene); });
    render(tab);
    for (const b of $('journal-tabs').children) b.onclick = () => render(b.dataset.jt);
    ui.openScreen('journal');
}
function openCodex(tab) {
    const ctx = { missions: MISSIONS, P, features: FEATURES, hasFeature: (f) => feature(f) || (P && hasFeature(P, f)) };
    ui.codex(tab, ctx);
    for (const b of $('codex-tabs').children) b.onclick = () => ui.codex(b.dataset.ct, ctx);
    ui.openScreen('codex');
}

// tapping things in the lab: a cartridge on the shelf, or the console and the TV
let downAt = null;
$('view').addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
$('view').addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
    downAt = null;
    if (mode !== 'lab' || ui.anyScreen() || ui.sceneOpen()) return;
    const hit = view.pick(e.clientX, e.clientY);
    if (!hit) return;
    audio.ui('click');
    if (hit.mission) ui.brief(missionById(hit.mission), P.missions[hit.mission].state, { onInsert: insert, onPlay: playRestored });
    else { const m = currentMission(P); if (m) insert(m.id); else openStudio(); }
});
let parallax = { x: 0, y: 0 }, hover = null;
window.addEventListener('pointermove', (e) => {
    parallax = { x: (e.clientX / innerWidth - 0.5) * 2, y: -(e.clientY / innerHeight - 0.5) * 2 };
    if (mode === 'lab' && e.pointerType === 'mouse' && !ui.anyScreen()) { const h = view.pick(e.clientX, e.clientY); hover = h?.mission || null; $('view').style.cursor = h ? 'pointer' : ''; }
});

// ------------------------------------------------------------------ touch pad
function updatePad() {
    const touchy = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    const show = mode === 'play' && touchy;
    document.body.classList.toggle('playing', mode === 'play');
    $('pad').hidden = !show;
    const portrait = innerHeight > innerWidth;
    view.setInsets({ top: 56, bottom: show ? (portrait ? 210 : 0) : 10, left: show && !portrait ? 190 : 10, right: show && !portrait ? 190 : 10 });
}
input.onTouch = updatePad;
input.bindPad($('pad'));
window.addEventListener('resize', updatePad);

// ------------------------------------------------------------------ keys for menus
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const k = press.key;
    if (ui.sceneOpen()) { if (k === 'Enter' || k === 'Space' || k === 'KeyZ' || k === 'Escape') ui.advance(); return; }
    if (mode === 'play') { if (k === 'Escape') stopPlay(); return; }
    if (ui.anyScreen()) {
        if (k === 'ArrowDown') ui.moveFocus(1);
        else if (k === 'ArrowUp') ui.moveFocus(-1);
        else if (k === 'Escape' && ui.top() !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (k === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'bench' && k === 'Escape' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName)) toLab();
    else if (mode === 'lab' && k === 'Escape') ui.openScreen('menu');
}

// ------------------------------------------------------------------ frame loop
let skip = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    ui.tickDialogue(dt);
    if (mode === 'play' && run) {
        stepPlay(dt);
        if (pendingComplete && (pendingComplete.t -= dt) <= 0) {
            const id = pendingComplete.id;
            pendingComplete = null;
            if (mode === 'play') {
                input.capture = false; $('playbar').hidden = true; run = null; playCtx = null; audio.synth.stopMusic(); updatePad();
                checkComplete(id);
            }
        }
    } else if (mode === 'title' || mode === 'lab') {
        if (mode === 'title') stepAttract(dt); else drawBoot();
        audio.tick(time, true);
    }
    // the workbench covers the screen: draw the lab behind it a few times a second only
    if (mode === 'bench' && (skip = (skip + 1) % 6) !== 0) return;
    view.frame(mode === 'bench' ? dt * 6 : dt, { parallax: mode === 'play' ? null : parallax, hover, buttons: mode === 'play' && run ? run.btn : 0 });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'play') recordRun(); save(); } });
window.addEventListener('pagehide', () => save());

// boot
P = null;
if (hasSave()) { const p = loadProgress(); if (p) P = p; }
toTitle();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__rm = {
        get P() { return P; },
        get mode() { return mode; },
        get run() { return run; },
        get bench() { return bench; },
        get playCtx() { return playCtx; },
        seen, view, ui, audio, input, V, MISSIONS,
        /** Skip the title: a fresh expedition, no story. */
        start(name = 'TEST') { startExpedition(name); ui.endScene(); return P; },
        insert(id) { insert(id); ui.endScene(); },
        endScene() { ui.endScene(); },
        repairAll(id) { for (const t of missionById(id).tasks) if (t.fix) bench.h.onRepair(t.id); },
        tasks(id) { return missionTasks(P, id); },
        play() { if (mode === 'bench') playBench(); },
        stop() { stopPlay(); },
        autoplay(on = true) { botOn = on; botState = {}; },
        /** Run the console ahead with the mission's bot until it ends or time runs out. */
        ff(sec) {
            if (!run) return null;
            const f = BOTS[playCtx?.mission];
            for (let i = 0; i < sec * 60 && run.status === 'run'; i++) { V.stepRun(run, f ? f(run, botState) : 0); drainRun(); }
            return run.status;
        },
        exportHTML() { return exportHTML(bench.cart || P.missions.rally.cart); },
        features() { return Object.keys(FEATURES).filter((f) => feature(f)); },
        featuresFor,
        save, hasSave,
    };
}
