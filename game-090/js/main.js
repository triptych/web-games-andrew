// Verdant Protocol — entry point. Boots the view, routes input, acts on the sim for the player,
// feeds the sim's events to the view's director (which animates them in order and tells the UI and
// the audio as each one plays), and moves between the title, the station, a floor and a battle.
//
// ?debug=1 exposes window.__vp for the dev/ harnesses; &fast=N plays animations N× faster and
// &q=0|1|2 forces the graphics quality.

import { MAX_FRAME, STEP } from './config.js';
import { View } from './view/view.js';
import { Audio, TRACK_FOR_THEME } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act as simAct, step as simStep, startScene, joinDaemon, sceneNode } from './sim/game.js';
import { startBattle } from './sim/battle.js';
import { enterZone, floorOf } from './sim/explore.js';
import { makeBot, botTick, battleDecision } from './sim/bot.js';
import { ZONES } from './sim/data/zones.js';
import { SCENES } from './sim/data/story.js';
import { calc, newDaemon } from './sim/units.js';
import { tideOf } from './config.js';
import { healAll } from './sim/world.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
if (DEBUG && params.has('q')) settings.quality = +params.get('q');
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const canvas = document.getElementById('view');
const view = new View(canvas, settings.quality);
view.battleSpeed = settings.bspeed;
view.stage.calm = settings.calm;
view.battle.fx.calm = view.explore.fx.calm = settings.calm;
document.body.classList.toggle('calm', !!settings.calm);
const input = new Input(canvas);

let G = newGame(7, { name: 'Agent' });       // the title shows the station behind a game that is not played
let mode = 'title';                          // title | game
let last = performance.now();
let time = 0;
let accStep = 0;
let saveT = 0, mapT = 0;
let bot = null;                              // the autoplay bot (debug), or null
let lastPhase = '';
let backdropKey = '';
const seen = {};
const autoBot = makeBot({ skill: 1, seed: 99 });

const ui = new UI({
    audio, settings, view, input,
    act: (a) => doAct(a),
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        view.stage.setQuality(s.quality); view.quality = s.quality;
        view.battleSpeed = s.bspeed;
        view.stage.calm = s.calm; view.battle.fx.calm = view.explore.fx.calm = s.calm;
        document.body.classList.toggle('calm', !!s.calm);
        updateTouch();
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.G = G;
ui.onSave = () => saveNow();
ui.onQuit = (ended) => { if (!ended) saveNow(); toTitle(); };

// events reach the UI, the audio and the scene backdrop at the moment they play
view.listeners.push((e) => {
    seen[e.type] = (seen[e.type] || 0) + 1;
    ui.battle.onEvent(e, G);
    audio.onEvent(e);
    if (e.type === 'b_start') { ui.showHud('battle'); music(); }
    else if (e.type === 'scene') setBackdrop(e);
    else if (e.type === 'scene_end') { view.hub.speaker = null; }
    else if (e.type === 'hub') { view.hub.setTide(e.tide); view.hub.syncParty(G); }
    else if (e.type === 'x_floor') ui.field.key = '';
    else if (e.type === 'x_boss') music();
    else if (e.type === 'join' || e.type === 'splice') view.hub.syncParty(G);
    else if (e.type === 'b_end') { if (e.result === 'win' && G.battle?.kind !== 'normal') { /* the boss card shows after the cheer */ } }
});

view.hub.setTide(0);
view.hub.preset('title'); view.hub.snap();

// ------------------------------------------------------------------ title and menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
audio.play('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') { ui.openScreen('newgame'); ui.paintLooks(); }
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
document.getElementById('btn-start').addEventListener('click', () => {
    audio.ui('click');
    startNew(document.getElementById('hero-name').value);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { ui.closeScreen('pause'); saveNow(); toTitle(); }
    else ui.openScreen(a);
});
document.getElementById('btn-fmenu').addEventListener('click', () => pause());
document.getElementById('btn-fparty').addEventListener('click', () => openMenu());
const autoBtn = document.getElementById('b-auto');
const setAuto = (on) => { settings.auto = on; autoBtn.setAttribute('aria-pressed', String(on)); saveSettings(settings); };
setAuto(false);
autoBtn.addEventListener('click', () => setAuto(!settings.auto));
const speedBtn = document.getElementById('b-speed');
const SPEEDS = [1, 1.5, 2.2];
const paintSpeed = () => { speedBtn.textContent = { 1: '1×', 1.5: '1.5×', 2.2: '2×' }[view.battleSpeed] ?? '1×'; };
paintSpeed();
speedBtn.addEventListener('click', () => {
    const i = (SPEEDS.indexOf(view.battleSpeed) + 1) % SPEEDS.length;
    view.battleSpeed = settings.bspeed = SPEEDS[i];
    document.getElementById('set-bspeed').value = String(SPEEDS[i]);
    saveSettings(settings);
    paintSpeed();
});

function startNew(name) {
    const seed = (Date.now() % 1e9) | 0;
    const g = newGame(seed, { name, look: ui.newLook, diff: ui.newDiff });
    g.look = ui.newLook;
    startGame(g);
}

function startGame(g) {
    G = g;
    ui.G = G;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'game';
    bot = null;
    input.flush();
    view.clear();
    view.explore.clear(); view.explore.key = '';
    view.battle.clearUnits();
    ui.battle.reset();
    ui.vn.hide();
    lastPhase = '';
    backdropKey = '';
    ui._menuKey = ''; ui._rewardKey = ''; ui._defeat = false;
    view.hub.syncParty(G);
    view.hub.setTide(tideOf(G.day));
    view.hub.preset('overview'); view.hub.snap();
    view.G = G;
    // the sim has already queued the scene or hub event of the game it started with
    playEvents();
    if (G.phase === 'scene') {
        const sc = SCENES[G.scene.id];
        setBackdrop({ id: G.scene.id, bg: sc.bg });
    }
    if (G.phase === 'explore') { view.use('explore'); }
    reconcile(true);
    saveNow();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(null);
    ui.vn.hide();
    ui.battle.reset();
    view.clear();
    view.use('hub');
    view.hub.preset('title');
    G = newGame(7, { name: 'Agent' });
    ui.G = G;
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
    lastPhase = '';
}

function pause() {
    if (mode !== 'game' || ui.anyScreen() || !['hub', 'explore', 'scene'].includes(G.phase)) return;
    audio.ui('open');
    saveNow();
    ui.openScreen('pause');
}
function openMenu() {
    if (mode !== 'game' || ui.anyScreen() || !['hub', 'explore'].includes(G.phase)) return;
    audio.ui('open');
    ui.panels.open_('menu');
}

function saveNow() {
    if (mode === 'game' && ['hub', 'explore', 'scene'].includes(G.phase) && !view.busy) saveGame(G);
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => input.pressA());
input.bindHold(document.getElementById('btn-dash'), (on) => { input.runBtn = on; });
input.onDrag = (dx) => { if (mode === 'game' && G.phase === 'explore') view.explore.orbit(dx); };
input.onZoom = (f) => { if (mode === 'game' && G.phase === 'explore') view.explore.zoom(f); };

// ------------------------------------------------------------------ backdrops for scenes
function setBackdrop(e) {
    const def = SCENES[e.id];
    if (!def) return;
    const bg = def.bg || 'hub';
    const key = e.id;
    if (bg.startsWith('zone:')) {
        const zone = bg.slice(5);
        const boss = def.then.find((o) => o.k === 'boss')?.id || (/^boss_(\w+)_post$/.test(e.id) ? e.id.match(/^boss_(\w+)_post$/)[1] : null);
        view.backdrop.show(zone, boss, /_post$/.test(e.id));
        view.use('backdrop');
        music(zone);
    } else {
        view.use('hub');
        view.hub.preset('talk');
        view.hub.syncParty(G);
        music();
    }
    view.fade = 1; view.fadeDir = -1;
}

// ------------------------------------------------------------------ acting
function doAct(a) {
    if (mode !== 'game') return 'not playing';
    const why = simAct(G, a);
    if (why) return why;
    playEvents();
    return '';
}

function playEvents() {
    if (G.events.length) view.push(G.events.splice(0));
}

// ------------------------------------------------------------------ music by context
function music(zoneHint = null) {
    if (mode === 'title') return audio.play('title');
    const B = G.battle;
    if (G.phase === 'credits') return audio.stop();
    if (view.scene === 'battle' || G.phase === 'battle' || G.phase === 'reward') {
        if (B?.kind === 'final') return audio.play('final');
        if (B?.kind === 'boss') return audio.play('boss');
        return audio.play('battle');
    }
    if (zoneHint) return audio.play(TRACK_FOR_THEME[ZONES[zoneHint].theme] || 'hub');
    if (G.phase === 'explore' && G.explore) return audio.play(TRACK_FOR_THEME[G.explore.theme || ZONES[G.explore.zone].theme] || 'tunnel');
    return audio.play('hub');
}

// ------------------------------------------------------------------ keeping the view and HUD in step with the phase
function desiredHud() {
    switch (G.phase) {
        case 'scene': return 'scene';
        case 'hub': return 'hub';
        case 'explore': return 'field';
        case 'battle': case 'reward': return 'battle';
        default: return null;
    }
}

function reconcile(force = false) {
    if (view.busy) return;
    const ph = G.phase;
    const want = desiredHud();
    if (ui.hudMode !== want || force) ui.showHud(want);
    if (ph !== lastPhase || force) {
        // the scene the camera should be showing
        if (ph === 'hub') {
            if (view.scene !== 'hub') { view.leaveBattle('hub'); view.use('hub'); view.fade = 1; view.fadeDir = -1; }
            view.hub.preset(ui.panels.cur ? view.hub.mode : 'overview');
            view.hub.syncParty(G); view.hub.setTide(tideOf(G.day));
            if (lastPhase && lastPhase !== 'hub') saveNow();
        } else if (ph === 'explore') {
            if (view.scene !== 'explore') { view.leaveBattle('explore'); view.use('explore'); view.fade = 1; view.fadeDir = -1; }
            if (lastPhase !== 'explore' && lastPhase !== 'battle' && lastPhase !== 'reward') view.explore.key = '';
        } else if (ph === 'scene') {
            // setBackdrop was called by the scene event
        }
        music();
        lastPhase = ph;
    }
}

// ------------------------------------------------------------------ input routing
function handleKeys() {
    const press = input.next();
    if (!press || mode === 'title' && !ui.anyScreen()) return;
    const k = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if ((k === 'Escape' || k === 'KeyP') && !['title', 'reward', 'credits'].includes(top) && !(top === 'modal' && (G.phase === 'defeat' || G.explore?.menu))) { audio.ui('close'); if (top === 'panel') ui.panels.close(); else ui.closeTop(); }
        else if (k === 'Escape' && top === 'modal' && G.explore?.menu) { ui.closeScreen('modal'); doAct({ type: 'closeMenu' }); }
        else if ((k === 'Enter' || k === 'Space') && (press.pad || !press.onButton)) { const el = document.activeElement; if (el && el !== document.body) el.click?.(); }
        return;
    }
    if (mode !== 'game') return;
    switch (G.phase) {
        case 'scene':
            if (k === 'Space' || k === 'Enter' || k === 'KeyZ') {
                if (press.onButton && !press.pad) return;
                if (sceneNode(G)?.ch) document.activeElement?.click?.(); else ui.vn.tap();
            } else if (k === 'Escape' || k === 'KeyP') pause();
            else if (k === 'ArrowDown' || k === 'ArrowUp') ui.moveFocus(k === 'ArrowDown' ? 1 : -1, null) ;
            break;
        case 'hub':
            if (k === 'Escape' || k === 'KeyP') pause();
            else if (k === 'Tab') openMenu();
            else if (k === 'ArrowRight' || k === 'ArrowLeft') moveHub(k === 'ArrowRight' ? 1 : -1);
            else if ((k === 'Enter' || k === 'Space') && !press.onButton) { const b = document.activeElement; if (b && b.classList.contains('cbtn')) b.click(); else document.querySelector('#hub-nav .cbtn')?.focus(); }
            break;
        case 'explore':
            if (k === 'Escape' || k === 'KeyP') pause();
            else if (k === 'Tab') openMenu();
            break;
        case 'battle':
            if (view.busy) { if (k === 'Space' || k === 'Enter') view.hurry(true); return; }
            if (ui.battle.key_(k, G)) return;
            if (k === 'ArrowDown' || k === 'ArrowRight') moveBattle(1);
            else if (k === 'ArrowUp' || k === 'ArrowLeft') moveBattle(-1);
            else if (k === 'Escape') ui.battle.back(G);
            else if ((k === 'Space' || k === 'Enter') && !press.onButton) { const el = document.activeElement; if (el && (el.closest('#cmd') || el.closest('.recode'))) el.click(); else (document.querySelector('#cmd button:not([disabled])') || document.querySelector('.recode button:not([disabled])'))?.focus(); }
            break;
    }
}
function moveHub(dir) {
    const list = [...document.querySelectorAll('#hub-nav .cbtn')];
    const i = list.indexOf(document.activeElement);
    list[(i + dir + list.length) % list.length]?.focus();
}
function moveBattle(dir) {
    const root = document.querySelector('.recode') ? '.recode' : '#cmd';
    const list = [...document.querySelectorAll(`${root} button:not([disabled])`)];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    list[(i + dir + list.length) % list.length].focus();
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(MAX_FRAME, (now - last) / 1000);
    const dt = rdt * FAST;
    last = now;
    time += dt;
    handleKeys();

    if (mode === 'game') {
        const idle = !view.busy;
        // walking: fixed steps, only when nothing is in the way
        if (G.phase === 'explore' && !ui.anyScreen() && idle && !G.explore.menu) {
            const st = input.state();
            if (st.cam) view.explore.yaw += st.cam * rdt * 1.8;
            accStep += rdt;
            let n = 0;
            while (accStep >= STEP && n < 12) {
                const w = view.explore.toWorld(st.x, st.y);
                const a = botMode() ? null : { x: w.x, y: w.y, run: st.run, a: input.edges.a };
                if (a) simStep(G, a, STEP);
                else botTick(G, bot, STEP);
                input.consumeEdges();
                accStep -= STEP; n++;
                if (G.events.length) playEvents();
                if (G.phase !== 'explore' || G.explore?.menu) { accStep = 0; break; }
            }
        } else accStep = 0;
        playEvents();
    }
    view.update(dt, time, G);
    ui.G = G;

    if (mode === 'game') {
        const idle = !view.busy;
        if (idle && view.speed !== 1) view.hurry(false);
        if (idle) {
            reconcile();
            if (view.scene === 'battle' && G.phase === 'battle') { ui.battle.sync(G); }
            if (!ui.anyScreen() || ['reward', 'modal', 'credits'].includes(ui.top())) ui.present(G);
            if (G.phase === 'battle' && !ui.anyScreen()) {
                if (bot) { botTick(G, bot); playEvents(); }
                else if (settings.auto && G.battle && G.battle.phase === 'p' && !G.battle.neg) { doAct(battleDecisionCmd()); ui.battle.refresh(); }
            } else if (bot && !ui.anyScreen() && G.phase !== 'explore') { botTick(G, bot); playEvents(); }
            saveT += rdt;
            if (saveT > 15) { saveT = 0; saveNow(); }
        }
        if (ui.hudMode === 'battle') ui.battle.frame(G);
        if (ui.hudMode === 'field') { mapT += rdt; if (mapT > 0.12) { mapT = 0; ui.field.minimap(G); ui.field.refresh(G); ui.field.hint(G); } }
    }
}
const botMode = () => !!bot;
function battleDecisionCmd() { const c = battleDecision(G, autoBot); return c; }

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game') { saveNow(); pause(); } });
window.addEventListener('pagehide', () => { if (mode === 'game') saveNow(); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    const skipScenes = () => {
        let n = 0;
        while (G.phase === 'scene' && n++ < 400) {
            const node = sceneNode(G);
            doAct(node?.ch ? { type: 'choose', i: node.ch.findIndex((c) => !c.if) } : { type: 'next' });
        }
    };
    window.__vp = {
        get G() { return G; },
        get mode() { return mode; },
        get phase() { return G.phase; },
        get busy() { return view.busy; },
        seen, view, ui, audio, input,
        /** New game at once, past the prologue, in the hub. */
        start(seed = 1, opts = {}) {
            const g = newGame(seed, { name: opts.name || 'Tester', look: opts.look || 0 });
            g.look = opts.look || 0;
            startGame(g);
            if (opts.skip !== false) { skipScenes(); view.clear(); reconcile(true); }
            return G;
        },
        skipScenes,
        act: (a) => doAct(a),
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 5 }) : null; },
        /** Run the bot ahead in the sim with no animation, then let the view catch up. */
        ff(ticks = 200, skill = 1) {
            const b = makeBot({ skill, seed: 11 });
            for (let i = 0; i < ticks && G.phase !== 'credits'; i++) { if (!botTick(G, b, 1 / 30)) break; G.events.length = 0; }
            view.clear(); view.explore.key = ''; view.battle.clearUnits(); lastPhase = ''; ui.battle.reset();
            if (G.phase === 'battle') { const B = G.battle; view.push([{ type: 'b_start', kind: B.kind, zone: B.zone, units: B.units.map((u) => ({ id: u.id, side: u.side, sp: u.sp, name: u.name, lv: u.lv, hp: u.hp, maxhp: u.maxhp, mp: u.mp, maxmp: u.maxmp, boss: u.boss, elite: u.elite, alive: u.alive, down: u.down, agent: u.agent })) }]); }
            reconcile(true);
            return G.phase;
        },
        /** Enter a zone from the hub, optionally down to a floor. */
        deploy(zone = 'underpass', floor = 0) {
            skipScenes();
            if (G.phase !== 'hub') return G.phase;
            doAct({ type: 'deploy', zone });
            return G.phase;
        },
        teleport(x, y) { if (G.explore) { G.explore.p.x = x; G.explore.p.y = y; } },
        /** Start a battle at once. fight(['mossling','rustbot'], 3, 'normal'). */
        fight(ids = ['mossling', 'rustbot'], lv = null, kind = 'normal', zone = 'underpass') {
            skipScenes();
            if (!G.explore && G.phase === 'hub') enterZone(G, zone);
            startBattle(G, { kind, zone, foes: ids.map((id) => ({ id, lv: lv ?? undefined, boss: kind !== 'normal' })), canFlee: kind === 'normal' });
            playEvents();
            return G.phase;
        },
        /** Give the party daemons: recruit('mossling', 'scrapfox'). */
        recruit(...ids) { for (const id of ids) { const u = joinDaemon(G, id); } playEvents(); },
        level(n) { for (const u of [G.agent, ...G.stock]) u.lv = n; healAll(G); },
        give(scrap = 500) { G.scrap += scrap; },
        chapter(n) { G.chapter = n; },
        save: () => saveGame(G),
        hasSave,
    };
}
