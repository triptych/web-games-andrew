// Crown & Crumpet — entry point. Boots the view, routes input and events, and moves the campaign
// through its phases: title → intro (story, party, snack) → battle → outro → … → ending.
//
// ?debug=1 exposes window.__cc for the dev/ harnesses; &fast=N plays animations N× faster.

import { MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Play } from './play.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, beginBattle, finishChapter, setParty, setSnack, chapterOf } from './sim/game.js';
import { botCommand, makeBot } from './sim/bot.js';
import { act } from './sim/game.js';
import { CHAPTERS, ENDING, CLASSES } from './sim/data.js';
import { makeRng } from './rng.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View($('view'));

let G = newGame(1);
let scene = 'title';         // title | game
let last = performance.now();
let saveT = 0;
let bot = null;              // debug autoplay: the bot plays the player's party too
const seen = {};             // a count of every sim event drained, for the tests

const applySettings = () => {
    audio.setVolumes(settings.sfx, settings.music);
    view.calm = !!settings.calm || !!window.A11Y?.reducedMotion;
    view.speed = FAST * (settings.quick ? 2 : 1);
    document.body.classList.toggle('calm', !!settings.calm);
};

const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onParty: (keys) => { if (!setParty(G, keys)) ui.toast('That party will not work.'); },
    onSnack: (id) => setSnack(G, id),
});
const play = new Play({ view, ui, audio, getG: () => G, isAuto: () => !!bot });
applySettings();

view.onPlay = (ev) => {
    audio.play(ev, G);
    if (ev.type === 'turn') {
        const u = G.B?.units.find((o) => o.id === ev.id);
        if (u) window.A11Y?.announce(`${CLASSES[u.key].name}'s turn`);
    }
};
view.onTalk = (lines, done) => ui.talk(lines, done);
view.onEnd = (ev) => {
    if (ev.result === 'win') showPhase();
    else openLose();
};
view.onTap = (x, y) => { audio.init(); play.tap(x, y); };
view.onHover = (x, y) => play.hover(x, y);
view.onZoom = (z) => { $('btn-zoom').hidden = !z; };
$('btn-zoom').addEventListener('click', () => { view.resetZoom(); $('btn-zoom').blur(); });

/** The lose sheet says exactly why, so a surprising defeat can be reported precisely. */
function openLose() {
    const B = G.B;
    const names = B.units.filter((u) => u.team === 'p').map((u) => `${CLASSES[u.key].name} ${u.alive ? `(${u.hp}/${u.maxhp} hp)` : 'fainted'}`);
    $('lose-why').textContent = B.over?.why === 'timeout' ? `The battle went on for ${B.turnNo} turns, so it was called off. ` + names.join(', ') + '.' : names.join(', ') + '.';
    ui.openScreen('lose');
}

// ------------------------------------------------------------------ title and scenery
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

/** A throwaway battle just to have a board and idle students to look at behind a sheet. */
function showScenery(g) {
    const P = newGame(1);
    P.chapter = g.chapter; P.roster = [...g.roster]; P.party = [...g.party];
    beginBattle(P);
    P.events.length = 0;
    view.setBattle(P, true);
    view.ov = {};
}

function toTitle() {
    ui.closeAll();
    scene = 'title';
    bot = null;
    ui.showHud(false);
    G = newGame(1);
    showScenery(G);
    refreshTitle();
    audio.music('camp');
    ui.openScreen('title');
}

function startCampaign(g) {
    G = g;
    scene = 'game';
    ui.closeAll();
    input.flush();
    document.activeElement?.blur?.();
    showPhase();
}

/** Show whatever the campaign is up to: a story scene and its sheet, or the battle. */
function showPhase() {
    ui.closeAll();
    const ch = chapterOf(G);
    if (G.phase === 'battle') { enterBattle(); return; }
    ui.showHud(false);
    audio.music(G.phase === 'ending' ? 'ending' : 'camp');
    if (G.phase === 'intro') {
        showScenery(G);
        const sheet = () => { saveGame(G); ui.intro(G, () => { ui.closeAll(); startBattle(); }); };
        if (!G.seenPre) { G.seenPre = true; ui.talk(ch.pre, sheet); } else sheet();
    } else if (G.phase === 'outro') {
        ui.talk(ch.post.length ? ch.post : [['narrator', 'And the kitchens fell quiet.']], () => {
            ui.outro(G, () => { ui.closeAll(); finishChapter(G); saveGame(G); showPhase(); });
        });
    } else if (G.phase === 'ending') {
        showScenery({ chapter: CHAPTERS.length - 1, roster: G.roster, party: G.roster.slice(0, 5) });
        ui.talk(ENDING, () => { saveGame(G); ui.ending(G, toTitle); });
    }
}

function startBattle() {
    beginBattle(G);
    enterBattle();
}

function enterBattle() {
    view.setBattle(G);
    document.body.classList.toggle('dark', !!view.theme.dark);
    // the sim has already queued its opening turn; the view hears about it as usual
    document.activeElement?.blur?.();
    input.flush();
    play.reset();
    play.turnId = null;
    ui.orderKey = '';
    ui.cardKey = null;
    ui.showHud(true);
    ui.setChapterTag(`Chapter ${G.chapter + 1} · ${chapterOf(G).title}`);
    audio.music(chapterOf(G).final ? 'boss' : 'battle');
    flushEvents();
    if (G.B.over?.result === 'lose') openLose();
    saveGame(G);
}

// ------------------------------------------------------------------ menus
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act2 = b.dataset.act;
    if (act2 === 'new') startCampaign(newGame((Date.now() % 1e9) | 0));
    else if (act2 === 'continue') {
        const g = loadGame();
        if (g) startCampaign(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(act2);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());
$('cmd').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (!b) return;
    play.command(b.dataset.cmd);
    b.blur();                         // a focused button would swallow Space and Enter for the whole battle
});
$('lose-retry').addEventListener('click', () => { audio.ui('click'); ui.closeAll(); startBattle(); });
$('lose-party').addEventListener('click', () => { audio.ui('click'); G.phase = 'intro'; G.B = null; G.seenPre = true; showPhase(); });
$('lose-title').addEventListener('click', () => { audio.ui('click'); saveGame(G); toTitle(); });

function pause() {
    if (scene !== 'game' || G.phase !== 'battle' || ui.anyScreen() || G.B?.over) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ input routing
function handlePress() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.top() === 'talk') {
        if (key === 'Enter' || key === 'Space' || key === 'KeyZ' || key === 'NumpadEnter') ui.talkAdvance();
        else if (key === 'Escape') ui.talkSkip();
        return;
    }
    if (ui.anyScreen()) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'intro', 'outro', 'ending', 'lose'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (scene === 'game' && G.phase === 'battle') {
        const zf = { Equal: 1.25, NumpadAdd: 1.25, Minus: 0.8, NumpadSubtract: 0.8 }[key];
        if (zf) { view.zoomAt(view.w / 2, view.h / 2, zf); return; }
        if (key === 'Digit0' || key === 'Numpad0') { view.resetZoom(); return; }
        if (play.press(key, press.shift)) return;
        if (key === 'Escape' || key === 'KeyP') pause();
    }
}

// ------------------------------------------------------------------ events and the frame loop
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
}

function layout() {
    const hud = !$('hud').hidden;
    const land = window.matchMedia('(max-height: 460px)').matches;     // landscape phone: the commands sit in a right-hand column
    const b = hud ? (land ? 40 : ui.bottomH() + 40) : 24;
    const t = hud ? ui.topH() : 56;
    const r = hud && land ? $('bottom').offsetWidth : 6;
    if (view.inset.b !== b || view.inset.t !== t || view.inset.r !== r) view.setInsets({ t, b, r });
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handlePress();
    ui.talkUpdate(dt * FAST, settings.quick);
    if (scene === 'game' && G.phase === 'battle' && G.B && !ui.anyScreen()) {
        // the enemy (or the debug bot) plays one command at a time, once the view has caught up
        step(G, { hold: view.busy || G.events.length > 0, auto: !!bot });
    }
    flushEvents();
    layout();
    if (scene === 'game' && G.phase === 'battle') play.update();
    else if (scene === 'game' || scene === 'title') { view.ov = {}; }
    if (scene !== 'game' || G.phase !== 'battle' || ui.talking) view.ghost = false;      // story scenes and menus show everyone solid
    if (G.phase === 'battle' && scene === 'game' && G.B && !ui.anyScreen()) ui.order(G);
    view.frame(G, dt, view.time, view.ov);
    if (scene === 'game' && G.phase === 'battle') {
        saveT += dt;
        if (saveT > 15) { saveT = 0; saveGame(G); }
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (scene === 'game') saveGame(G); } });
window.addEventListener('pagehide', () => { if (scene === 'game') saveGame(G); });

toTitle();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    const idle = () => G.events.length === 0 && !view.busy;
    window.__cc = {
        get G() { return G; },
        get mode() { return scene === 'title' ? 'title' : G.phase; },
        get scene() { return scene; },
        seen, view, ui, audio, input, play, idle,
        /** A new campaign at `chapter` with everyone recruited so far, straight into its battle. */
        start(seed = 1, chapter = 0, skipIntro = true) {
            const g = newGame(seed);
            g.chapter = chapter;
            const order = ['pip', 'bram', 'mina', 'juniper', 'fenn', 'pudge'];
            g.roster = order.slice(0, Math.max(2, Math.min(6, chapter + 1)));
            if (chapter >= 5) g.roster = [...order];
            g.party = g.roster.slice(0, CHAPTERS[chapter].slots);
            if (!g.party.includes('pip')) g.party[0] = 'pip';
            g.seenPre = true;
            startCampaign(g);
            if (skipIntro) { ui.closeAll(); startBattle(); }
            return G;
        },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** The bot finishes the battle in the sim at once; the view skips its animations. */
        ff() {
            const b = makeBot(); const rr = makeRng(G.seed + 7);
            let n = 0;
            ui.closeAll();
            while (G.phase === 'battle' && G.B && !G.B.over && n++ < 5000) {
                const u = G.B.units.find((o) => o.id === G.B.turn.id);
                if (u.team === 'p') { const r = act(G, botCommand(G, b, rr)); if (!r.ok) act(G, { t: 'wait' }); } else step(G, {});
                G.events.length = 0;
            }
            view.skipAll(G);
            if (G.B?.over) { if (G.B.over.result === 'win') showPhase(); else openLose(); }
        },
        save: () => saveGame(G),
        hasSave,
        screenOf: (x, y) => view.tileToClient(x, y),
    };
}
