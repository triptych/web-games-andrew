// Doom & Doilies: The Sugar Siege — entry point. Boots the view, runs the fixed-step simulation, routes input,
// turns sim events into dialogue, toasts, sound and screens, and moves between the title, the town and the siege.
//
// ?debug=1 exposes window.__ds for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, DAY_LEN, IDLE, MODES, SAVE_KEY, VERSION } from './config.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';
import { View } from './view/view.js';
import { loadAssets } from './view/assets.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI, totalsText } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, savedAt, loadLegacy, saveLegacy, clearLegacy } from './save.js';
import { newGame, step, act, questDef } from './sim/game.js';
import { makeBot, botInput, storyTurn } from './sim/bot.js';
import { BUILDINGS, DAY_EVENTS, ADVENTURERS, STAFF } from './sim/data.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'));
let G = newGame(1);
let mode = 'title';
let quiet = false;           // tests can silence the dialogue
let ffing = false;           // fast-forwarding: the bot's refused tries are not news
let bot = null;
let acc = 0, time = 0, last = performance.now(), saveT = 0, wasRunning = false;
let pendingAfterResult = null;
let storyBot = null;         // story mode: Lord Vellum runs the town
let hiddenAt = null;         // when the tab was hidden, for the time-away bonus
const seen = {};

const send = (cmd) => {
    if (mode !== 'play') return false;
    const r = act(G, cmd);
    flushEvents();
    return r;
};
const ui = new UI({
    audio, settings, send,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onShow: (g) => showGoal(g),
});

/** "Show me": scroll the town to the goal and point at it, then open what it needs. */
function showGoal(g) {
    if (mode !== 'play' || G.mode !== 'town') return;
    const s = g.show;
    if (!s) {
        // nothing to point at: nudge time along
        if (G.speed < 2) send({ t: 'speed', v: 2 });
        for (const b of document.querySelectorAll('[data-speed="2"], [data-speed="3"], #btn-sleep')) { b.classList.remove('pulse-on'); void b.offsetWidth; b.classList.add('pulse-on'); }
        ui.toast('⏩ Time is running at 2×. Try 3× or ☾ to sleep until morning.');
        return;
    }
    if (s.panel) { ui.openPanel(s.panel); return; }
    if (s.plot == null || s.plot < 0) return;
    view.centreOn(s.plot);
    view.point(s.plot);
    if (g.id === 'collect') return;           // the bubble is right there: the arrow is enough
    view.selPlot = s.plot;
    ui.hintBuild = s.build || null;
    ui.openPanel('plot:' + s.plot);
}
ui.G = G;
// Lady Noxia's cheers on the tip card; the test harnesses (debug=1) turn them off unless &cheer=1
ui.cheers = !DEBUG || params.get('cheer') === '1';

loadAssets().then(() => { document.body.classList.add('art-ready'); });

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');
// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-143'.
// The save is everything stored under its save key (settings stay on the device); loading writes it back and reloads.
const cloud = makeCloud({ game: 'game-143' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'play' && !G.over) saveGame(G); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const d = snapValue(snap, SAVE_KEY)?.data; return d ? `Day ${d.day ?? 1} of the siege` : 'A Sugar Siege game'; },
    hasGame: () => (mode === 'play') || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();

const unlock = () => { audio.init(); if (mode === 'title') audio.playTheme('town'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') ui.showModes(loadLegacy());
    else if (a === 'continue') {
        const at = savedAt(), g = loadGame();
        if (g) { startGame(g); if (at) claimIdle((Date.now() - at) / 1000); } else ui.toast('That save could not be read.');
    } else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
document.getElementById('mode-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b || !MODES.includes(b.dataset.mode)) return;
    audio.ui('click');
    newRun(b.dataset.mode);
});
/** A new game in a mode; a fallen hard-mode town's head start goes to it. */
function newRun(mode) {
    const legacy = loadLegacy();
    clearLegacy();
    startGame(newGame((Date.now() % 1e9) | 0, { mode, legacy }));
}
/** Back after `sec` seconds away: the town saved some of its takings. */
function claimIdle(sec) {
    if (mode !== 'play' || !(sec >= IDLE.min)) return;
    send({ t: 'idle', sec: Math.round(sec) });
    saveGame(G);
}
document.getElementById('gameover-title').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('gameover-again').addEventListener('click', () => { audio.ui('click'); newRun('hard'); });
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); cloudUI.autosave({ force: true }); toTitle(); }
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
for (const id of ['btn-pause', 'btn-pause2']) document.getElementById(id).addEventListener('click', () => pause());
for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => { audio.ui('click'); send({ t: 'speed', v: +b.dataset.speed }); });
document.getElementById('btn-sleep').addEventListener('click', () => { audio.ui('click'); send({ t: 'nextDay' }); });
document.getElementById('btn-queen').addEventListener('click', () => send({ t: 'queen' }));
document.getElementById('result-ok').addEventListener('click', () => {
    audio.ui('click');
    ui.closeScreen('result');
    const next = pendingAfterResult; pendingAfterResult = null;
    next?.();
});
document.getElementById('ending-ok').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('ending'); audio.playTheme('town'); saveGame(G); });

function startGame(g) {
    G = g; ui.G = G;
    storyBot = G.diff === 'story' ? makeBot({ skill: 1, seed: 3, pace: 2.5 }) : null;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    view.pan = null;
    syncMode();
    updateTouch();
    if (G.flags.intro) ui.toast(`Welcome back, Madam Mayor. Day ${G.day}.`);
    else if (G.legacy) ui.toast(`🎁 Your last town's savings came along: ${totalsText(G.legacy)}`);
    saveGame(G);
}
function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    ui.talkQ.length = 0; ui.talkCur = null;
    mode = 'title';
    ui.showTown(false); ui.showBattle(false);
    G = newGame(1); ui.G = G;
    refreshTitle();
    ui.openScreen('title');
    audio.playTheme('town');
}
function pause() {
    if (mode !== 'play' || ui.top() === 'pause') return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}
function syncMode() {
    const battle = G.mode === 'battle';
    ui.showTown(mode === 'play' && !battle);
    ui.showBattle(mode === 'play' && battle, G);
    themeFor();
}
function themeFor() {
    if (mode !== 'play') { audio.playTheme('town'); return; }
    const B = G.battle;
    if (!B) audio.playTheme(G.ended && ui.top() === 'ending' ? 'love' : 'town');
    else if (B.queen || B.result === 'love') audio.playTheme('love');
    else if (B.king != null) audio.playTheme('king');
    else audio.playTheme('battle');
}
function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.touchOn = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    document.getElementById('b-hint').textContent = ui.touchOn ? 'Tap or drag on the field to throw doilies' : 'Click or hold on the field to throw doilies · ← → aim, Space throws';
}
input.onTouch = updateTouch;

// ------------------------------------------------------------------ the canvas: plots in town, aiming in a siege
const canvas = document.getElementById('view');
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen()) return;
    if (G.mode === 'battle') { input.pointerDown(e.pointerId, view.toField(e.clientX)); try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ } return; }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
});
canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'play') return;
    if (G.mode === 'battle') { if (e.pointerType === 'mouse') input.hoverAim(view.toField(e.clientX)); input.pointerMove(e.pointerId, view.toField(e.clientX)); return; }
    if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x;
        drag.moved += Math.abs(dx) + Math.abs(e.clientY - drag.y);
        drag.x = e.clientX; drag.y = e.clientY;
        if (drag.moved > 10) view.panBy(dx);
    } else if (e.pointerType === 'mouse' && !ui.anyScreen()) {
        const bub = view.pickBubble(e.clientX, e.clientY);
        view.hoverPlot = bub >= 0 ? -1 : view.pickTown(G, e.clientX, e.clientY);
        canvas.style.cursor = bub >= 0 || view.hoverPlot !== -1 ? 'pointer' : '';
    }
});
const endPtr = (e) => {
    if (G.mode === 'battle') { input.pointerUp(e.pointerId); return; }
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (e.type !== 'pointerup' || d.moved > 10 || mode !== 'play' || ui.anyScreen()) return;
    // a bubble first: they float over the buildings, so a tap on one never opens the panel underneath
    const bub = view.pickBubble(e.clientX, e.clientY);
    if (bub >= 0) { send({ t: 'collect', plot: bub }); return; }
    const hit = view.pickTown(G, e.clientX, e.clientY);
    if (hit === -1) return;
    audio.ui('open');
    view.selPlot = hit;
    ui.openPanel(hit === 'hall' ? 'hall' : 'plot:' + hit);
};
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, endPtr);

// ------------------------------------------------------------------ keys and pad
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (top === 'talk' && (key === 'Space' || key === 'Enter' || key === 'KeyZ') && press.pad !== false) {
            // a focused Next button turns Space and Enter into its own click; anything else advances here
            if (document.activeElement?.id !== 'talk-next' && document.activeElement?.id !== 'talk-skip') ui.nextLine();
            return;
        }
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && top !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') { pause(); return; }
    if (G.mode === 'battle') {
        const ab = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[key];
        if (ab != null) { const ids = Object.keys(G.battle.abil); const order = ['web', 'flare', 'stomp', 'buns'].filter((i) => ids.includes(i)); if (order[ab]) send({ t: 'ability', id: order[ab] }); }
        if (key === 'KeyQ') send({ t: 'queen' });
    } else {
        const panels = { KeyQ: 'quests', KeyS: 'staff', KeyH: 'heroes', KeyG: 'defence', KeyB: 'bake', KeyT: 'whatnext' };
        if (key === 'KeyC') send({ t: 'collectAll' });
        if (panels[key]) { audio.ui('open'); ui.openPanel(panels[key]); }
        if (key === 'KeyN') send({ t: 'nextDay' });
        if (key === 'Digit0' || key === 'Digit1' || key === 'Digit2' || key === 'Digit3') send({ t: 'speed', v: +key.slice(5) });
    }
}

// ------------------------------------------------------------------ events → story, toasts and screens
function say(lines, cb) { if (quiet) { cb?.(); return; } ui.talk(lines.filter(Boolean), cb); }
function scene(id, cb) { if (quiet) { cb?.(); return; } ui.talkScene(id, cb); }

function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        switch (e.type) {
            // after the intro (and the first quests), Lord Vellum explains the basics
            case 'scene': scene(e.id, e.id === 'intro' ? () => scene('tutorial') : undefined); break;
            case 'questNew': { const q = questDef(e.id); say([q.intro]); break; }
            case 'questDone': { const q = questDef(e.id); say([q.outro, q.outro2]); ui.toast(`✅ ${q.title}: ${ui.rewardText(q.reward)}`); break; }
            case 'day': {
                const d = DAY_EVENTS.find((x) => x.id === e.ev);
                ui.toast(`🌅 Day ${e.day}. ${d ? d.text : ''}${e.daysLeft <= 2 ? ` The siege comes in ${e.daysLeft} day${e.daysLeft > 1 ? 's' : ''}!` : ''}`);
                saveGame(G);
                break;
            }
            case 'built': if (e.kind) ui.toast(`${BUILDINGS[e.kind].icon} ${BUILDINGS[e.kind].name} ${e.lvl > 1 ? 'is now ★' + e.lvl : 'is ready'}!`); else if (e.part) ui.toast(e.part === 'wall' ? `🧱 The wall is now level ${e.lvl}!` : `🏛️ The Town Hall is now level ${e.lvl}!`); break;
            case 'hired': ui.toast(`🗡️ ${ADVENTURERS[e.adv].name} moves into the Grinning Gourd.`); break;
            case 'idle': ui.idleNews(e.got, e.sec); break;
            case 'refused': {
                if (ffing || bot) break;
                const why = { 'too dear': "We can't afford that yet.", 'no room': 'The tavern is full. Upgrade it for more rooms.', 'not yet': 'Not yet.', 'plot not open': 'Upgrade the Town Hall to use that plot.', busy: 'Already being built.' }[e.why];
                if (why) ui.toast(why);
                break;
            }
            case 'bakeMilestone': ui.toast(`🎂 The Grand Bake is ${e.pct}% done!`); break;
            case 'ovenStarved': ui.toast('🔥 The Great Oven ran out of flour or sugar.'); break;
            case 'invasion': {
                ui.closeScreen('panel');
                view.selPlot = -1;
                syncMode();
                ui.toast(e.readyAll ? '🛡️ Everything on the checklist is ready: the wall is stronger!' : '🔔 The Crumb Horde is here! To the wall!');
                // the first siege ever: how the wall works
                if (e.wave === 0 && !e.epi && !G.stats.wavesLost && !G.retries) scene('siege1');
                saveGame(G);
                break;
            }
            case 'kingArrives': themeFor(); scene('king'); break;
            case 'queen': themeFor(); scene('queen'); break;
            case 'knightDown': ui.toast('Sir Tobias is down! He\'ll be back on his feet soon.'); break;
            case 'battleEnd': onBattleEnd(e); break;
        }
    }
    ui.onEvents?.(G, ev);
}

function onBattleEnd(e) {
    syncMode();
    if (e.result === 'over') {
        // hard mode: this town is done; the next one starts with some of what it had
        saveLegacy(e.legacy);
        clearSave();
        ui.showGameOver(G, e);
        return;
    }
    saveGame(G);
    if (e.result === 'love') { themeFor(); audio.playTheme('love'); scene('ending', () => ui.showEnding(G)); return; }
    ui.showResult(e);
    if (e.result === 'win' && !e.epi && G.phase >= 1 && G.phase <= 3) pendingAfterResult = () => scene('phase' + (G.phase + 1));
    else if (e.result === 'retreat') pendingAfterResult = () => scene('retreat');
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        const speed = G.mode === 'battle' ? 1 : G.speed;
        acc += dt * FAST * speed;
        let n = 0, townT = 0;
        while (acc >= STEP && n < 12 * FAST * 3) {
            if (G.mode === 'town') townT += STEP;
            if (storyBot && !bot && G.mode === 'town') {
                // story mode: Lord Vellum takes his turn; his refused tries are not news
                const e0 = G.events.length;
                storyTurn(G, storyBot, STEP);
                if (G.events.length > e0) G.events.splice(e0, G.events.length - e0, ...G.events.slice(e0).filter((x) => x.type !== 'refused'));
            }
            const inp = bot ? botInput(G, bot, STEP) : input.state();
            const ev0 = G.events.length;
            step(G, inp, STEP);
            input.consumeEdges(G.mode !== 'battle' || G.events.slice(ev0).some((e) => e.type === 'throw'));
            acc -= STEP;
            n++;
            if (G.events.length && G.events.some((e) => e.type === 'questNew' || e.type === 'questDone' || e.type === 'scene' || e.type === 'kingArrives' || e.type === 'queen' || e.type === 'battleEnd' || e.type === 'invasion')) break;
        }
        if (n >= 12 * FAST * 3) acc = 0;
        view.tickTown(G, townT);
        saveT += dt;
        if (saveT > 20 && G.mode === 'town' && !G.over) { saveT = 0; saveGame(G); cloudUI.autosave(); }
    } else acc = 0;
    flushEvents();
    view.selPlot = ui.panel ? view.selPlot : -1;
    view.frame(G, dt, time, mode, input);
    if (mode === 'play') {
        if (G.mode === 'battle') ui.battleHud(G); else ui.hud(G, dt);
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); hiddenAt = Date.now(); return; }
    if (hiddenAt != null) { const away = (Date.now() - hiddenAt) / 1000; hiddenAt = null; claimIdle(away); }
});
window.addEventListener('pagehide', () => { if (mode === 'play' && !G.over) saveGame(G); cloudUI.autosave({ keepalive: true }); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ds = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        set quiet(v) { quiet = !!v; }, get quiet() { return quiet; },
        start(seed = 1, mode = 'normal', legacy = null) { startGame(newGame(seed, { mode, legacy })); return G; },
        idle: (sec) => claimIdle(sec),
        newRun,
        load(g) { startGame(g); },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 5 }) : null; },
        /** Run the sim ahead with the bot playing; events reach the view, sound and screens as usual. */
        ff(sec, skill = 1) {
            const b = makeBot({ skill, seed: 11 });
            ffing = true;
            for (let t = 0; t < sec; t += STEP) {
                step(G, botInput(G, b, STEP), STEP);
                if (G.events.length > 200) flushEvents();
            }
            flushEvents();
            ffing = false;
        },
        act: (c) => send(c),
        save: () => saveGame(G),
        hasSave,
        DAY_LEN,
        STAFF,
    };
}
