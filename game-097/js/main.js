// Hollow Gambit — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, the sanctum and a battle.
//
// ?debug=1 exposes window.__hg for the dev/ harnesses; &fast=N plays animations and the enemy N× faster.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Play } from './play.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, buildBattle, nextChapter, unlocked, runEnemyPhase } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';
import { CHAPTERS } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();

let G = newGame(1);          // the title screen shows chapter 1 behind the menu; the real game replaces G
let mode = 'title';          // title | hub | battle
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

const applySettings = () => {
    audio.setVolumes(settings.sfx, settings.music);
    view.setCalm(!!settings.calm);
    view.speed = FAST * (settings.quick ? 2 : 1);
    document.body.classList.toggle('calm', !!settings.calm);
};

const view = new View($('view'), {
    floats: $('floats'),
    audio,
    hooks: {
        banner: (text, kind) => ui.banner(text, kind),
        battleOpen: (ev) => { ui.battleOpen(ev); view.stage.setArenaPad($('cut').getBoundingClientRect().bottom + 6); },
        battleHp: (side, hp) => ui.battleHp(side, hp),
        battleClose: () => ui.battleClose(),
        levelup: (ev) => ui.levelup(ev),
        result: (ev) => { if (G.battle) ui.showResult(G, ev); },
    },
});

const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
const play = new Play({ view, ui, audio, getG: () => G, act: (cmd) => act(G, cmd) });
applySettings();

// ------------------------------------------------------------------ layout
function updatePads() {
    if (mode === 'battle') { view.setPad(ui.pads()); return; }
    const top = ui.top();
    const side = top && $(top).classList.contains('side') && innerWidth >= 900;
    view.setPad({ top: 52, bottom: 0, left: side ? $(top).querySelector('.sheet').getBoundingClientRect().right + 20 : 0, right: 0 });
}
ui.on = (name) => { if (name === 'screens') updatePads(); };
window.addEventListener('resize', () => requestAnimationFrame(updatePads));
window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(updatePads));

// ------------------------------------------------------------------ scenes
const themeOf = (ci) => CHAPTERS[ci].ambience;

function showPreview(ci) {
    view.showBoard(buildBattle(G, ci), themeOf(ci), { orbit: true });
    updatePads();
}

function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

function goTitle() {
    ui.closeAll();
    mode = 'title';
    ui.showBattleHud(false);
    G = newGame(1);
    showPreview(0);
    refreshTitle();
    audio.setMood('hub');
    ui.openScreen('title');
}

function goHub(openChapter = false) {
    ui.closeAll();
    mode = 'hub';
    ui.showBattleHud(false);
    ui.chSel = Math.min(openChapter === true ? nextChapter(G) : ui.chSel, CHAPTERS.length - 1);
    if (!unlocked(G, ui.chSel)) ui.chSel = nextChapter(G);
    showPreview(ui.chSel);
    audio.setMood('hub');
    saveGame(G);
    ui.renderHub(G);
    ui.openScreen('hub');
    if (openChapter) openCampaign();
}

function openCampaign() { ui.renderCampaign(G); ui.openScreen('campaign'); }

function enterBattle() {
    ui.closeAll();
    mode = 'battle';
    const B = G.battle;
    view.showBoard(B, themeOf(B.ch), { orbit: false });
    ui.showBattleHud(true);
    play.reset();
    play.refresh();
    updatePads();
    audio.setMood('battle');
    acc = 0;
    input.flush();
    // the board is laid out now that the HUD is visible: fit the camera to what is left
    requestAnimationFrame(() => { updatePads(); play.refresh(); });
}

function startChapter(ci) {
    const r = act(G, { t: 'start', ch: ci });
    if (!r.ok) { ui.toast(r.err === 'locked' ? 'That chapter is locked.' : 'Cannot start: ' + r.err); audio.ui('deny'); return; }
    enterBattle();
}

function pause() {
    if (mode !== 'battle' || ui.anyScreen() || !G.battle || G.battle.over) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ menus
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

const click = (id, fn) => $(id).addEventListener('click', (e) => { audio.ui('click'); fn(e); });
const menu = (id, handlers) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    handlers[b.dataset.act]?.();
});

menu('title-menu', {
    new: () => { G = newGame((Date.now() % 1e9) | 0); ui.chSel = 0; goHub(); },
    continue: () => {
        const g = loadGame();
        if (!g) { ui.toast('That save could not be read.'); return; }
        G = g;
        if (G.battle && !G.battle.over) enterBattle(); else { G.battle = null; ui.chSel = nextChapter(G); goHub(); }
    },
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
});
menu('hub-menu', {
    campaign: openCampaign,
    summon: () => { ui.renderSummon(G); ui.openScreen('summon'); },
    roster: () => { ui.renderRoster(G); ui.openScreen('roster'); },
    settings: () => ui.openScreen('settings'),
    title: () => { saveGame(G); goTitle(); },
});
menu('pause-menu', {
    resume: () => ui.closeScreen('pause'),
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
    retreat: () => { act(G, { t: 'leave', retreat: true }); goHub(); },
    title: () => { saveGame(G); goTitle(); },
});

$('chapter-list').addEventListener('click', (e) => {
    const b = e.target.closest('.chapter');
    if (!b) return;
    const ci = +b.dataset.ch;
    if (!unlocked(G, ci)) { audio.ui('deny'); ui.toast('Clear the chapter before it first.'); return; }
    audio.ui('select');
    ui.renderCampaign(G, ci);
    showPreview(ci);
});
click('btn-march', () => startChapter(ui.chSel));

click('btn-sum1', () => summon(1));
click('btn-sum10', () => summon(10));
function summon(n) {
    const r = act(G, { t: 'summon', n });
    if (!r.ok) { audio.ui('deny'); ui.toast('Not enough shards.'); return; }
    saveGame(G);
    ui.renderSummon(G); ui.renderHub(G);
    ui.showSummonResults(r.pulls);
}
click('btn-pulls-skip', () => $('pulls').classList.add('all'));
click('btn-pulls-done', () => ui.closeScreen('summon-result'));

$('roster-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rid]');
    if (!b) return;
    audio.ui('select');
    ui.rosterSel = +b.dataset.rid;
    ui.renderRoster(G);
});
$('roster-detail').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio.ui('click');
    const party = G.meta.party.slice();
    if (b.dataset.party) {
        const rid = +b.dataset.party, i = party.indexOf(rid);
        if (i >= 0) { if (party.length === 1) { ui.toast('You need at least one piece in the party.'); return; } party.splice(i, 1); } else party.push(rid);
    } else if (b.dataset.up) {
        const rid = +b.dataset.up, i = party.indexOf(rid);
        if (i > 0) [party[i - 1], party[i]] = [party[i], party[i - 1]];
    } else return;
    act(G, { t: 'party', rids: party });
    saveGame(G);
    ui.renderRoster(G); ui.renderHub(G);
});

click('btn-res-hub', () => { act(G, { t: 'leave' }); goHub(); });
click('btn-res-next', () => {
    const was = G.battle.ch;
    act(G, { t: 'leave' });
    ui.chSel = Math.min(was + 1, CHAPTERS.length - 1);
    goHub(false);
    openCampaign();
});

// ------------------------------------------------------------------ battle controls
click('btn-ability', () => play.abilityButton());
click('btn-wait', () => play.waitButton());
click('btn-end', () => play.endButton());
click('btn-pause', () => pause());
click('btn-danger', () => play.toggleDanger());
click('btn-fc-yes', () => play.confirm());
click('btn-fc-no', () => play.cancel());

// Taps on the board. A press that wandered about 10 px was a drag, not a tap, and never acts.
const canvas = $('view');
let down = null;
canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
    if (mode === 'battle' && view.busy && !ui.anyScreen()) view.boost = true;     // hurry whatever is playing
});
canvas.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || d.id !== e.pointerId || mode !== 'battle' || ui.anyScreen()) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
    const p = view.pick(e.clientX, e.clientY);
    play.showCursor = e.pointerType === 'mouse';
    if (p) play.onTile(p.x, p.y); else play.cancel();
});
canvas.addEventListener('pointercancel', () => { down = null; });
canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || mode !== 'battle' || ui.anyScreen()) return;
    const p = view.pick(e.clientX, e.clientY);
    if (p && (p.x !== play.cur.x || p.y !== play.cur.y || !play.showCursor)) play.hover(p.x, p.y);
});
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (mode === 'battle') play.cancel(); });

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const t = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' && !['title', 'hub', 'result', 'summon-result'].includes(t)) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Escape' && t === 'summon-result') ui.closeTop();
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'battle') return;
    if (view.busy && (key === 'Space' || key === 'Enter')) { view.boost = true; return; }
    if (play.onKey(key)) return;
    if (key === 'Escape' || key === 'KeyP') pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    if (ev.some((e) => e.type === 'phase' && !e.start)) saveGame(G);
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const B = G.battle;
    const running = mode === 'battle' && B && !B.over && !ui.anyScreen();
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        if (bot && B.phase === 'p' && !view.busy) {
            const { cmd } = botInput(G, bot);
            if (cmd) act(G, cmd);
        }
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            step(G, { hold: view.busy }, STEP);
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else {
        acc = 0;
        step(G, { hold: true }, 0);
    }
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'battle') play.sync();
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { if (mode === 'battle') pause(); else if (mode === 'hub') saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode !== 'title') saveGame(G); });

refreshTitle();
showPreview(0);
audio.setMood('hub');
ui.openScreen('title');
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__hg = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, play,
        /** A new game straight to the sanctum. */
        start(seed = 1) { G = newGame(seed); ui.chSel = 0; goHub(); return G; },
        /** Start a chapter (unlocking the ones before it when `unlock`), straight into the battle. */
        battle(ch = 0, unlock = true) {
            if (unlock) for (let i = 0; i < ch; i++) G.meta.cleared[CHAPTERS[i].id] = true;
            if (G.battle) act(G, { t: 'leave', retreat: true });
            ui.chSel = ch;
            startChapter(ch);
            return G.battle;
        },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Let the bot finish the battle at once; the view skips its animations. */
        ff(maxActions = 3000) {
            const b = makeBot();
            let n = 0;
            while (G.battle && !G.battle.over && n++ < maxActions) {
                if (G.battle.phase === 'e') { runEnemyPhase(G); continue; }
                const { cmd } = botInput(G, b);
                if (!cmd || !act(G, cmd).ok) break;
            }
            view.skipping = true;
            flushEvents();
            view.tl.finishAll();
            return G.battle?.over || null;
        },
        save: () => saveGame(G),
        hasSave,
        /** Where a square is on screen, for tests that click the canvas. */
        screenOf: (x, y) => view.screenOf(x, y, 0.4),
    };
}
