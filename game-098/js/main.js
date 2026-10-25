// Wyrmbond — entry point. Boots the view, runs the fixed-step simulation, routes input and events,
// keeps the real-time clock that warms eggs, and moves between the title, the roost and battles.
//
// ?debug=1 exposes window.__wb for the dev/ harnesses; &fast=N plays animations and the enemy N× faster.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI, $ } from './ui/ui.js';
import { RoostUI } from './ui/roostui.js';
import { Play } from './play.js';
import { paperDataUrl } from './view/paint.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, runEnemyPhase } from './sim/game.js';
import { makeBot, botInput, botRoost } from './sim/bot.js';
import { stepSide } from './sim/ai.js';
import { CHAPTERS, PROLOGUE, STARTERS } from './sim/story.js';
import { SPECIES } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
$('paper').style.backgroundImage = `url(${paperDataUrl()})`;

let G = newGame(1);
let mode = 'title';            // title | starter | hub | battle
let acc = 0, time = 0, last = performance.now(), saveT = 0, clockT = 0;
let bot = null;
let wasRunning = false;
const seen = {};

const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
const view = new View($('view'), {
    floats: $('floats'),
    audio,
    hooks: {
        banner: (text, kind) => ui.banner(text, kind),
        battleOpen: (ev) => ui.duelOpen(ev),
        battleHp: (side, hp) => ui.duelHp(side, hp),
        battleClose: () => ui.duelClose(),
        power: (ev) => ui.powerCut(ev),
        talk: (lines) => ui.talk(lines),
        talkCancel: () => ui.skipTalk(),
        result: () => { if (G.battle?.result) setTimeout(() => { if (G.battle?.result && mode === 'battle') ui.showResult(G, G.battle); }, 500); },
        unchained: (ev) => { if (ev.ok) ui.toast(`${ev.name} joins your flock!`); },
    },
});
const roostUi = new RoostUI({ ui, audio, view, getG: () => G, act: (cmd, o) => doAct(cmd, o), onBattle: (t) => beginBattle(t) });
const play = new Play({ view, ui, roostUi, audio, getG: () => G, act: (cmd) => act(G, cmd) });

function applySettings() {
    audio.setVolumes(settings.sfx, settings.music);
    view.setCalm(!!settings.calm);
    view.speed = FAST * (+settings.speed || 1);
    view.quickFights = settings.fights === 'quick';
    document.body.classList.toggle('calm', !!settings.calm);
}
applySettings();

/** A roost command from the UI: run it, save, redraw. */
function doAct(cmd, { quiet = false } = {}) {
    const r = act(G, cmd);
    if (!r.ok && !quiet) { audio.ui('deny'); ui.toast(niceErr(r.err)); }
    if (r.ok) saveGame(G);
    roostUi.refreshTop();
    view.refreshRoost(G);
    return r;
}
const niceErr = (e) => ({ 'not enough gold': 'Not enough gold.', 'stable full': 'Your stable is full. Buy a Stable Wing at the Market, or release a dragon.', 'egg basket full': 'The egg basket is full.', 'not ready to breed': 'Those two need to rest first.' }[e] || e[0].toUpperCase() + e.slice(1) + '.');

// ------------------------------------------------------------------ layout
function updatePads() {
    if (mode === 'battle') { view.setPad(ui.pads()); return; }
    const panel = $('hub-panel');
    if (mode === 'hub' && !$('hub').hidden) {
        const r = panel.getBoundingClientRect();
        if (innerWidth / innerHeight < 0.9) view.setPad({ top: 50, bottom: innerHeight - r.top, left: 0, right: 0 });
        else view.setPad({ top: 50, bottom: 70, left: innerHeight < 480 ? 110 : 0, right: innerWidth - r.left });
    } else view.setPad({ top: 0, bottom: innerHeight * 0.35, left: 0, right: 0 });
}
ui.on = (name) => { if (name === 'screens') requestAnimationFrame(updatePads); };
window.addEventListener('resize', () => requestAnimationFrame(updatePads));
window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(updatePads));

// ------------------------------------------------------------------ the real-time clock
/** Bring the roost up to the wall clock: eggs warm, rings train, the hoard grows. */
function tickClock(report = false) {
    if (!G.meta.started) return;
    const now = Date.now();
    const sec = G.meta.wall ? (now - G.meta.wall) / 1000 : 0;
    act(G, { t: 'idle', sec: Math.max(0, sec), wall: now });
    if (report && sec > 90) ui.toast(`While you were away (${Math.round(Math.min(sec, 8 * 3600) / 60)} min), the eggs kept warm and the flock kept training.`);
}

// ------------------------------------------------------------------ scenes
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

function goTitle() {
    ui.closeAll();
    mode = 'title';
    ui.showBattleHud(false);
    G = newGame(1);
    view.showRoost(G);
    refreshTitle();
    audio.setMood('title');
    ui.openScreen('title');
    updatePads();
}

function goHub(tab = 'map') {
    ui.closeAll();
    mode = 'hub';
    ui.showBattleHud(false);
    if (G.battle) act(G, { t: 'leave' });
    G.events.length = 0;
    view.showRoost(G);
    ui.starterName = G.meta.dragons[0]?.name || 'your dragon';
    audio.setMood('roost');
    tickClock();
    saveGame(G);
    ui.openScreen('hub');
    roostUi.show(tab);
    updatePads();
    input.flush();
}

/** Start a battle: from the Journey (with its opening scene) or straight in (tests, retries). */
async function beginBattle({ ch, wild, rids }, { story = true } = {}) {
    const r = act(G, wild ? { t: 'start', wild: true, rids } : { t: 'start', ch, rids });
    if (!r.ok) { ui.toast(niceErr(r.err)); return; }
    lastStart = { ch, wild, rids };
    enterBattle();
    const C = !wild ? CHAPTERS[ch] : null;
    if (story && C && !G.meta.cleared[C.id] && C.pre?.length) {
        await ui.talk(C.pre);
    }
    flushEvents();
}
let lastStart = null;

function enterBattle() {
    ui.closeAll();
    mode = 'battle';
    const B = G.battle;
    view.showBoard(B, B.theme);
    ui.showBattleHud(true);
    play.reset();
    play.refresh();
    audio.setMood(B.co.e ? 'boss' : 'battle');
    acc = 0;
    input.flush();
    updatePads();
    // on a portrait phone the whole map makes tiles too small to tap: start zoomed in on Kestrel
    if (innerWidth < 600 && innerHeight > innerWidth) {
        const t = B.units.find((u) => u.tamer);
        view.stage.zoom = 1.6;
        if (t) { const p = view.stage.tilePos(t.x, t.y); view.stage.pan.set(p.x, p.z); }
        view.stage.fit();
    }
    requestAnimationFrame(() => { updatePads(); play.refresh(); });
}

async function afterBattle(retry = false) {
    const B = G.battle;
    if (!B) return goHub();
    ui.closeScreen('result');
    const res = B.result;
    const C = B.ch >= 0 ? CHAPTERS[B.ch] : null;
    act(G, { t: 'leave' });
    G.events.length = 0;
    saveGame(G);
    if (retry && lastStart) return beginBattle(lastStart, { story: false });
    if (res?.win && res.first && C?.post?.length) {
        await ui.talk(C.post);
    }
    goHub(res?.eggs?.length ? 'hatchery' : 'map');
    if (res?.win && C?.id === 'ch12' && res.first) ui.toast('🌅 The End. Your roost lives on: hatch, breed and hunt as long as you like.');
}

function pause() {
    if (mode === 'battle') {
        if (ui.anyScreen() || !G.battle || G.battle.over) return;
        audio.ui('open');
        saveGame(G);
        $('pause-obj').textContent = G.battle.objective.text;
        ui.openScreen('pause');
    } else if (mode === 'hub' && ui.top() === 'hub') { audio.ui('open'); ui.openScreen('hubmenu'); }
}

// ------------------------------------------------------------------ menus
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// a mouse click leaves focus on the button, and Enter would press it again: battle buttons let go of focus
const click = (id, fn) => $(id).addEventListener('click', (e) => { audio.ui('click'); if (e.currentTarget.closest('#bhud, #duel')) e.currentTarget.blur(); fn(e); });
const menu = (id, handlers) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    handlers[b.dataset.act]?.();
});

menu('title-menu', {
    new: () => newStory((Date.now() % 1e9) | 0),
    continue: () => {
        const g = loadGame();
        if (!g) { ui.toast('That save could not be read.'); return; }
        G = g;
        tickClock(true);
        ui.starterName = G.meta.dragons[0]?.name || 'your dragon';
        ui.starterSp = G.meta.dragons[0]?.sp;
        if (G.battle && !G.battle.over) { enterBattle(); flushEvents(); } else goHub();
    },
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
    credits: () => ui.openScreen('credits'),
});

async function newStory(seed, { skipStory = false } = {}) {
    G = newGame(seed);
    G.meta.wall = Date.now();
    ui.closeAll();
    mode = 'starter';
    audio.setMood('title');
    if (!skipStory) await ui.talk(PROLOGUE);
    $('starter-list').innerHTML = STARTERS.map((sp) => {
        const S = SPECIES[sp];
        return `<button class="pick" data-sp="${sp}"><img src="${view.thumb({ sp, lv: 1 }, 220)}" alt=""><b>${S.name}</b><span>${S.el === 'ember' ? '🔥 Ember' : S.el === 'tide' ? '💧 Tide' : '🌿 Verdant'} · ${S.cls === 'wyvern' ? 'flies' : S.cls === 'serpent' ? 'swims' : 'walks'}</span><small>${S.desc}</small></button>`;
    }).join('');
    ui.openScreen('starter');
}

$('starter-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sp]');
    if (!b) return;
    audio.ui('select');
    const r = act(G, { t: 'starter', sp: b.dataset.sp });
    if (!r.ok) return;
    G.events.length = 0;
    audio.crack();
    const d = G.meta.dragons[0];
    ui.starterName = d.name;
    ui.starterSp = d.sp;
    ui.closeScreen('starter');
    ui.toast(`🐣 ${d.name} the ${SPECIES[d.sp].name} hatched!`);
    saveGame(G);
    await beginBattle({ ch: 0, rids: [d.rid] });
});

menu('pause-menu', {
    resume: () => ui.closeScreen('pause'),
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
    retreat: () => { act(G, { t: 'leave', retreat: true }); goHub(); },
    quit: () => { saveGame(G); goTitle(); },
});
menu('hubmenu-menu', {
    resume: () => ui.closeScreen('hubmenu'),
    story: () => ui.storySoFar(G),
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
    quit: () => { saveGame(G); goTitle(); },
});
click('btn-hub-menu', () => pause());
click('btn-res-ok', () => afterBattle(false));
click('btn-res-retry', () => afterBattle(true));

// ------------------------------------------------------------------ battle controls
click('btn-end', () => play.endButton());
click('btn-pause', () => pause());
click('btn-next', () => play.nextUnit(1));
click('btn-power', () => play.powerButton());
click('btn-zoom', () => { view.stage.zoomBy(view.stage.zoom > 1.5 ? 0.01 : 1.8); });
click('btn-skipfight', () => { view.boost = true; view.skipping = true; view.tl.finishAll(); });

// The map: tap to act, drag to pan, pinch or wheel to zoom. A press that wandered ~10 px is a drag.
const canvas = $('view');
const pointers = new Map();
let down = null, pinch = null;
canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.stage.zoom };
        down = null;
        return;
    }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, lx: e.clientX, ly: e.clientY, drag: false };
    if (mode === 'battle' && view.busy && !ui.blocking()) view.boost = true;
});
canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        view.stage.zoom = 1; view.stage.zoomBy(pinch.z * d / Math.max(1, pinch.d));
        return;
    }
    if (down && down.id === e.pointerId && mode === 'battle') {
        if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.drag = true;
        if (down.drag && view.stage.zoom > 1.01) view.stage.panBy(e.clientX - down.lx, e.clientY - down.ly);
        down.lx = e.clientX; down.ly = e.clientY;
    }
    if (e.pointerType === 'mouse' && mode === 'battle' && !ui.blocking() && !down?.drag) {
        const t = view.pick(e.clientX, e.clientY);
        if (t && (!play.cur || t.x !== play.cur.x || t.y !== play.cur.y)) play.hover(t.x, t.y);
    }
});
const endPtr = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const d = down;
    if (!d || d.id !== e.pointerId) return;
    down = null;
    if (e.type !== 'pointerup' || d.drag || mode !== 'battle' || ui.blocking()) return;
    const t = view.pick(e.clientX, e.clientY);
    play.showCursor = e.pointerType === 'mouse';
    if (t) play.onTile(t.x, t.y); else play.back();
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { if (mode !== 'battle') return; e.preventDefault(); view.stage.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (mode === 'battle') play.back(); });

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    // the press that closed a scene, and a double-tap after it, must not also act on the map
    if (!ui.talking && performance.now() - (ui.talkEndAt || -1e9) < 250) return;
    if (ui.talking) {
        if (key === 'Enter' || key === 'Space' || key === 'Escape') ui.advance();
        return;
    }
    const top = ui.top();
    if (top && top !== 'hub') {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' && !['title', 'starter', 'result'].includes(top)) { audio.ui('close'); ui.closeTop(); }
        else if ((key === 'Enter' || key === 'Space') && (press.pad || (!press.onButton && press.raw !== 'Enter' && press.raw !== 'Space'))) document.activeElement?.click?.();
        return;
    }
    if (mode === 'hub') {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1, 'hub');
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1, 'hub');
        else if (key === 'Escape' || key === 'KeyP') pause();
        else if ((key === 'Enter' || key === 'Space') && (press.pad || (!press.onButton && press.raw !== 'Enter' && press.raw !== 'Space'))) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'battle') return;
    if (play.busy && (key === 'Space' || key === 'Enter')) { view.boost = true; return; }
    if (key === 'KeyP') { pause(); return; }
    if (play.onKey(key)) return;
    if (key === 'Escape') pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'ready' && mode !== 'title') ui.toast(`🥚 A ${SPECIES[e.sp].name} egg is ready to hatch!`);
        if (e.type === 'grow' && e.why === 'training' && mode === 'hub') ui.toast(`🏟️ ${e.name} trained up to level ${e.lv}!`);
    }
    if (ev.some((e) => e.type === 'phase' && e.team === 'p')) saveGame(G);
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    clockT += dt;
    if (clockT >= 1) { clockT = 0; if (mode !== 'title' && mode !== 'starter') tickClock(); if (mode === 'hub') { roostUi.tick(); view.refreshRoost(G); } }

    const B = G.battle;
    const running = mode === 'battle' && B && !B.over && !ui.blocking();
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        if (bot && B.phase === 'p' && !play.busy) {
            const { cmd } = botInput(G, bot);
            if (cmd) { const r = act(G, cmd); if (!r.ok && cmd.t === 'act') act(G, { t: 'act', id: cmd.id, do: 'wait' }); }
        }
        acc += dt * FAST * (+settings.speed || 1);
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            step(G, { hold: play.busy }, STEP);
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'battle') play.sync();
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'battle') pause(); if (mode !== 'title') saveGame(G); } else if (mode !== 'title') tickClock(true); });
window.addEventListener('pagehide', () => { if (mode !== 'title') saveGame(G); });

refreshTitle();
view.showRoost(G);
audio.setMood('title');
ui.openScreen('title');
updatePads();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__wb = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, play, roostUi,
        /** A new game with a starter chosen, straight to the roost. */
        start(seed = 1, sp = 'cinderwing') {
            G = newGame(seed); G.meta.wall = Date.now();
            act(G, { t: 'starter', sp }); G.events.length = 0;
            goHub(); return G;
        },
        /** Start a chapter (unlocking those before it), skipping its opening scene. */
        battle(ch = 0, unlock = true) {
            if (!G.meta.started) { act(G, { t: 'starter', sp: 'cinderwing' }); G.events.length = 0; }
            if (unlock) { G.meta.ch = Math.max(G.meta.ch, ch); for (let i = 0; i < ch; i++) G.meta.cleared[CHAPTERS[i].id] = true; if (ch >= 3) G.meta.flags.breed = G.meta.flags.wild = true; }
            if (G.battle) act(G, { t: 'leave', retreat: true });
            G.events.length = 0;
            beginBattle({ ch, rids: G.meta.party }, { story: false });
            return G.battle;
        },
        newStory: (seed = 7) => newStory(seed),
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** The bot finishes the battle at once; the view skips its animations. */
        ff(maxActions = 3000) {
            const b = makeBot();
            let n = 0;
            ui.skipTalk();
            while (G.battle && !G.battle.over && n++ < maxActions) {
                if (G.battle.phase === 'e') { runEnemyPhase(G); continue; }
                stepSide(G, G.battle, 'p', { caution: b.caution });
            }
            view.skipping = true;
            flushEvents();
            view.tl.finishAll();
            return G.battle?.over || null;
        },
        tend() { botRoost(G, makeBot()); roostUi.show(); view.refreshRoost(G); },
        idle(sec) { act(G, { t: 'idle', sec }); },
        save: () => saveGame(G),
        hasSave,
        skipTalk: () => ui.skipTalk(),
        screenOf: (x, y) => view.screenOf(x, y, 0.2),
        goHub: (tab) => goHub(tab),
    };
}
