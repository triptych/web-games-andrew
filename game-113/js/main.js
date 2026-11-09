// Crystal Crescendo — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and moves
// between the title, play, the screens and the credits.
//
// In a duel the song is the clock: when audio is running (and fast=1) the simulation is advanced to the AudioContext's
// time, so the notes on screen, the music and the judging all agree. Lane presses keep the time they were made and are
// handed to the sim as song times.
//
// ?debug=1 exposes window.__ccr for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { loadAssets } from './view/assets.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { Highway } from './ui/highway.js';
import { loadSettings, saveSettings, hasSave, saveInfo, saveGame, loadGame, clearSave, markCleared, wasCleared } from './save.js';
import { newGame, step, act } from './sim/game.js';
import { retreat } from './sim/battle.js';
import { makeBot, botInput } from './sim/bot.js';
import { MAPS } from './sim/data/maps.js';
import { BATTLE_TALK } from './sim/data/script.js';
import { CHARS } from './sim/data/chars.js';
import { join } from './sim/party.js';
import { loadMap, npcsOf } from './sim/field.js';
import { endScene, startScene } from './sim/story.js';
import { startBattle } from './sim/battle.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const BLOCKING = new Set(['title', 'newgame', 'howto', 'settings', 'pause', 'band']);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const Q = params.has('q') ? Math.max(0, Math.min(2, +params.get('q'))) : settings.quality;
await loadAssets();              // generated art (assets/); anything missing falls back to the sprite painted in code
const view = new View(document.getElementById('view'), Q);
const highway = new Highway(document.getElementById('highway'));
highway.speed = settings.speed;
const ui = new UI({
    audio, settings,
    onSettings: (s) => {
        saveSettings(s); audio.setVolumes(s.sfx, s.music); updateTouch();
        highway.speed = s.speed;
        if (mode === 'play' && G.difficulty !== s.difficulty) G.difficulty = s.difficulty;      // takes effect from the next duel
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.onPads = (pads) => input.bindLanes(pads);

let G = titleGame();
let mode = 'title';              // title | play | ending
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null;
// Auto battle: the test bot, playing well but not perfectly, through the same inputs a player uses
const autoBot = makeBot({ skill: 0.9, seed: 113 });
let autoSteps = 0, handSteps = 0;
let wasRunning = false;
let countdown = 0;               // the 3-2-1 after unpausing a duel
let pend = { a: false, pick: null, b: false };
let lastMode = null;
let anchorDirty = true;
const seen = {};

function titleGame() {
    const g = newGame(1);
    step(g, { x: 0, y: 0, a: false }, STEP);      // the prologue sets its stage and waits on its title card
    g.events.length = 0;
    return g;
}

// ------------------------------------------------------------------ menus
function refreshTitle() {
    const has = hasSave();
    document.getElementById('btn-continue').hidden = !has;
    const info = saveInfo();
    document.getElementById('save-info').textContent = info ? `${MAPS[info.map]?.name || ''} · Lyra Lv ${info.lv} · ${info.members?.length || 1} in the band${wasCleared() ? ' · ★ cleared' : ''}` : wasCleared() ? '★ You have heard the whole song.' : '';
}
refreshTitle();
ui.openScreen('title');

for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act2 = b.dataset.act;
    if (act2 === 'new') ui.openScreen('newgame');
    else if (act2 === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else ui.openScreen(act2);
});
document.getElementById('diff-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-diff]');
    if (!b) return;
    audio.ui('click');
    settings.difficulty = b.dataset.diff; saveSettings(settings);
    document.getElementById('set-diff').value = settings.difficulty;
    startGame(newGame((Date.now() % 1e9) | 0, b.dataset.diff));
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') resume();
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else if (a === 'band') { ui.renderBand(G, menuCmd); ui.openScreen('band'); }
    else if (a === 'retreat') { retreat(G); ui.closeAll(); flushEvents(); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-bpause').addEventListener('click', () => pause());
input.bindButton(document.getElementById('btn-auto'), () => toggleAuto());
// Enter or Space on the focused button (and element.click()) arrive as a click with no pointer behind it
document.getElementById('btn-auto').addEventListener('click', (e) => { if (e.detail === 0) toggleAuto(); });

function toggleAuto() {
    settings.autoBattle = !settings.autoBattle;
    saveSettings(settings);
    document.getElementById('set-auto').value = settings.autoBattle ? 'on' : 'off';
    audio.ui(settings.autoBattle ? 'open' : 'close');
    ui.toast(settings.autoBattle ? 'Auto battle on: the band plays itself.' : 'Auto battle off: you play.');
    window.A11Y?.announce?.(settings.autoBattle ? 'Auto battle on' : 'Auto battle off');
}
document.getElementById('btn-menu').addEventListener('click', () => openBand());
document.getElementById('res-ok').addEventListener('click', () => { audio.ui('click'); pend.a = true; });
document.getElementById('def-retry').addEventListener('click', () => { audio.ui('click'); pend.pick = 'retry'; });
document.getElementById('def-crystal').addEventListener('click', () => { audio.ui('click'); pend.pick = 'crystal'; });
document.getElementById('map-cancel').addEventListener('click', () => { audio.ui('close'); pend.b = true; });
document.getElementById('end-ok').addEventListener('click', () => { audio.ui('click'); toTitle(); });
document.getElementById('dialogue').addEventListener('pointerdown', (e) => { e.preventDefault(); input.pressA(); });
input.bindButton(document.getElementById('btn-cres'), (e) => { input.pressCres(e.timeStamp || performance.now()); input.pressA(); });

function menuCmd(cmd) { const ok = act(G, cmd); flushEvents(); return ok; }
function openBand() { if (mode !== 'play' || G.mode !== 'field' || ui.anyScreen()) return; audio.ui('open'); ui.renderBand(G, menuCmd); ui.openScreen('band'); }

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();       // a focused button would swallow Space and Enter for the whole game
    mode = 'play';
    acc = 0; lastMode = null; anchorDirty = true;
    input.flush();
    ui.lastArea = null;
    updateTouch();
    if (G.mode === 'worldmap') openWorldmap();
}

function toTitle() {
    ui.closeAll();
    ui.hideDialogue();
    mode = 'title';
    G = titleGame();
    bot = null;
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    if (!['field', 'battle', 'scene'].includes(G.mode)) return;
    audio.ui('open');
    saveGame(G);
    const B = G.battle;
    document.getElementById('pause-retreat').hidden = !(G.mode === 'battle' && B && B.from === 'field' && !B.boss);
    document.getElementById('pause-band').hidden = G.mode !== 'field';
    ui.openScreen('pause');
}
function resume() {
    ui.closeScreen('pause');
    if (G.mode === 'battle' && G.battle?.state === 'run') { countdown = 1.5; input.flush(); }
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
    ui.padsFor = null;
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => input.pressA());

function openWorldmap() {
    ui.renderWorldmap(G, (k) => { audio.ui('click'); pend.pick = k; });
    ui.openScreen('worldmap');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && !['title', 'results', 'defeat', 'ending', 'worldmap'].includes(top)) { audio.ui('close'); if (top === 'pause') resume(); else ui.closeTop(); }
        else if (key === 'Escape' && top === 'worldmap') pend.b = true;
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'Tab' && G.mode === 'battle') toggleAuto();
    else if ((key === 'KeyM' || key === 'Tab') && G.mode === 'field') openBand();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    highway.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'battleStart' || e.type === 'talkEnd' || e.type === 'talkStart') anchorDirty = true;
        if (e.type === 'battleStart') { autoSteps = 0; handSteps = 0; }
        if (e.type === 'victory') ui.autoUsed = autoSteps && !handSteps ? 'all' : autoSteps ? 'part' : null;
        if (e.type === 'crystal' || e.type === 'battleEnd' || e.type === 'arrive') saveGame(G);
        if (e.type === 'sceneEnd') saveGame(G);
    }
}

/** React to the sim changing mode: the screens that belong to each one. */
function syncScreens() {
    if (G.mode === lastMode) return;
    const prev = lastMode;
    lastMode = G.mode;
    if (prev === 'results') ui.closeScreen('results');
    if (prev === 'defeat') ui.closeScreen('defeat');
    if ((prev === 'worldmap' || prev === 'travel') && G.mode !== 'travel' && G.mode !== 'worldmap') ui.closeScreen('worldmap');
    if (G.mode === 'results') setTimeout(() => { if (G.mode === 'results') ui.showResults(G); }, 0);
    else if (G.mode === 'defeat') ui.openScreen('defeat');
    else if (G.mode === 'worldmap' && prev !== 'travel') openWorldmap();
    else if (G.mode === 'ending') { markCleared(); clearSave(); ui.hideDialogue(); ui.showEnding(G); mode = 'ending'; }
    if (G.mode === 'battle') { input.flush(); anchorDirty = true; }
}

// ------------------------------------------------------------------ frame loop
const NONE_IN = { x: 0, y: 0, a: false, b: false, lanes: [], held: [false, false, false, false], cres: null, pick: null };

function frame(now) {
    requestAnimationFrame(frame);
    const realDt = (now - last) / 1000;
    const dt = Math.min(MAX_FRAME, realDt);
    last = now;
    time += dt;
    handlePresses();
    syncScreens();
    input.battle = mode === 'play' && G.mode === 'battle' && G.battle?.state !== 'talk';

    const blocking = ui.stack.some((s) => BLOCKING.has(s));
    const running = mode === 'play' && !blocking && !view.busy;
    if (running && !wasRunning) { input.flush(); anchorDirty = true; }
    wasRunning = running;
    if (countdown > 0 && running) {
        countdown -= dt;
        const el = document.getElementById('countdown');
        el.hidden = countdown <= 0; el.textContent = countdown > 1 ? '3' : countdown > 0.5 ? '2' : '1';
        anchorDirty = true;
    } else if (running) {
        stepFrame(dt, now, realDt);
    } else acc = 0;
    if (countdown <= 0) document.getElementById('countdown').hidden = true;

    flushEvents();
    syncScreens();
    if (G.mode === 'travel') ui.travelTick(G);

    // dialogue: shown while a line is waiting
    const lineUp = (G.mode === 'scene' && G.scene?.line) || (G.mode === 'battle' && G.battle?.state === 'talk');
    if (!lineUp && ui.dlg.active) ui.hideDialogue();
    // a line the sim is waiting on is always on screen (after a skipped frame, a restore, a closed menu)
    if (lineUp && !ui.dlg.active) {
        if (G.mode === 'scene') ui.say(G.scene.line.who, G.scene.line.text, false);
        else { const ln = BATTLE_TALK[G.battle.talk.key]?.[G.battle.talk.i]; if (ln) ui.say(ln.who, ln.text, true); }
    }
    ui.tickDialogue(dt);

    view.frame(G, dt, time);
    const inBattle = view.showing === 'battle' && G.battle && mode === 'play';
    const touch = ui.touchOn;
    highway.resize(view.w, view.h, touch);
    highway.offset = 0;
    if (inBattle && !view.busy) highway.draw(G, dt, time); else highway.draw({ battle: null }, dt, time);
    const L = inBattle ? highway.computeLayout(G.battle) : null;
    ui.battleHud(G, inBattle && !view.busy, L);
    ui.fieldHud(G, mode === 'play' && view.showing === 'field' && (G.mode === 'field' || G.mode === 'scene') && !view.busy);
    ui.showTouchDeck(mode === 'play' && G.mode === 'field' && !ui.anyScreen());
    document.getElementById('lane-pads').hidden = !touch;

    // music
    if (audio.on) {
        if (G.battle && G.mode === 'battle') audio.battleTick(G);
        else if (mode !== 'ending') audio.fieldTick(G, mode === 'title');
    }
    saveT += dt;
    if (mode === 'play' && G.mode === 'field' && saveT > 30) { saveT = 0; saveGame(G); }
}

function stepFrame(dt, now, realDt) {
    const B = G.battle;
    // a duel follows the audio clock; everything else the frame clock
    let steps;
    if (B && G.mode === 'battle' && B.state === 'run' && audio.on && FAST === 1 && !bot) {
        if (anchorDirty) { audio.anchor = audio.now - B.t + 0.06; anchorDirty = false; audio.sched = B.t; }
        const target = audio.now + 0.06 - audio.anchor;     // song time that is sounding now
        const need = Math.min(0.1, target - B.t);
        steps = Math.max(0, Math.floor(need / STEP + 1e-6));
        acc = 0;
    } else {
        if (B && audio.on) { audio.anchor = audio.now - B.t + 0.06; }
        acc += dt * FAST;
        steps = 0;
        while (acc >= STEP && steps < 12 * FAST) { acc -= STEP; steps++; }
    }
    // presses, as song times
    let presses = [];
    let cres = null;
    if (B && G.mode === 'battle') {
        const songNow = B.t + steps * STEP;
        const off = (settings.offset || 0) / 1000;
        // how much song time this frame covers per real second: 1 normally, less on a capped slow frame, FAST when testing
        const ratio = realDt > 1e-4 ? Math.min(FAST, (steps * STEP) / realDt) : 1;
        const songAt = (at) => songNow - Math.max(0, (now - at) / 1000) * ratio - off;
        presses = input.takeLanePresses().map((p) => ({ lane: p.lane, t: songAt(p.at) }));
        const c = input.takeCres();
        if (c) cres = { t: songAt(c.at) };
        for (const p of presses) highway.flash[p.lane] = 1;
    } else { input.takeLanePresses(); input.takeCres(); }

    for (let n = 0; n < steps; n++) {
        let inp;
        if (bot) inp = botInput(G, bot);
        else {
            const st = input.state();
            inp = { ...NONE_IN, x: st.x, y: st.y, a: st.a, b: st.b || pend.b, pick: pend.pick };
            if (pend.a) inp.a = true;
            // a press while the dialogue is still typing finishes the line instead of skipping it
            if (inp.a && ui.dialogueTyping() && (G.mode === 'scene' || G.battle?.state === 'talk')) { ui.completeDialogue(); inp.a = false; input.consumeEdges(); }
            if (G.mode === 'battle' && settings.autoBattle && G.battle?.state === 'run') {
                // auto battle: the band's lanes, holds and Crescendo come from the auto player; the dialogue stays yours
                const ai = botInput(G, autoBot);
                inp.lanes = ai.lanes; inp.held = ai.held; inp.cres = ai.cres;
                presses = []; cres = null;
                autoSteps++;
            } else if (G.mode === 'battle') {
                if (G.battle?.state === 'run') handSteps++;
                const bt = G.battle ? G.battle.t + STEP : 0;
                inp.lanes = presses.filter((p) => p.t <= bt || n === steps - 1);
                presses = presses.filter((p) => !inp.lanes.includes(p));
                inp.held = input.laneHeld.slice();
                if (cres && (cres.t <= bt || n === steps - 1)) { inp.cres = cres; cres = null; }
            }
        }
        const before = G.mode;
        step(G, inp, STEP);
        if (!bot) { input.consumeEdges(); pend = { a: false, pick: null, b: false }; }
        if (G.mode !== before) { flushEvents(); syncScreens(); if (G.mode === 'battle' || before === 'battle') break; }
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    /** Jump to a chapter with the band and flags it would have, for tests and screenshots. */
    const CHAPTERS = {
        beach: { flags: ['awake'], members: [], map: 'beach', at: [14.5, 11.5] },
        aurelune: { flags: ['awake', 'metOtto', 'seenAurelune'], members: [], map: 'aurelune', at: [11.5, 12.5] },
        marisonde: { flags: ['awake', 'metOtto', 'surface', 'seenAurelune', 'seenMarisonde'], members: ['sera'], map: 'marisonde', at: [5.5, 4.5] },
        sunreach: { flags: ['awake', 'metOtto', 'surface', 'seenMarisonde', 'maelstraBeaten', 'seenSunreach'], members: ['sera', 'mari'], map: 'sunreach', at: [4.5, 6.5] },
        frosthold: { flags: ['awake', 'metOtto', 'surface', 'maelstraBeaten', 'hollowhayBeaten', 'seenFrosthold'], members: ['sera', 'mari', 'ingrid'], map: 'frosthold', at: [18.5, 9.5] },
        spire: { flags: ['awake', 'metOtto', 'surface', 'maelstraBeaten', 'hollowhayBeaten', 'rimefangBeaten', 'seenSpire'], members: ['sera', 'mari', 'ingrid'], map: 'spire', at: [11.5, 11.5] },
    };
    window.__ccr = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, highway,
        start(seed = 1, diff = 'normal') { startGame(newGame(seed, diff)); return G; },
        chapter(name, lv = 1) {
            const c = CHAPTERS[name];
            startGame(newGame(7, 'normal'));
            endScene(G);
            for (const f of c.flags) G.flags[f] = true;
            for (const m of c.members) join(G, m);
            for (const m of G.party.members) { G.party.st[m].lv = lv; G.party.st[m].hp = 999; }
            for (const m of G.party.members) G.party.st[m].hp = Math.min(G.party.st[m].hp, 64 + CHARS[m].hpG * (lv - 1));
            loadMap(G, c.map, c.at[0], c.at[1]);
            G.p.hidden = false; G.mode = 'field'; G.events.length = 0; lastMode = null;
            return G;
        },
        battle(enemy, opts = {}) { startBattle(G, enemy, { from: 'field', ...opts }); return G.battle; },
        scene(id) { startScene(G, id); },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec, skill = 1) { const b = makeBot({ skill }); for (let t = 0; t < sec; t += STEP) { step(G, botInput(G, b), STEP); if (G.events.length > 200) flushEvents(); } flushEvents(); syncScreens(); },
        /** Play the current scene through (every line confirmed) until it hands over to the field, a battle or a menu. */
        skipScene(max = 120) { for (let t = 0; t < max && G.mode === 'scene'; t += STEP) { step(G, { ...NONE_IN, a: true }, STEP); if (G.events.length > 200) flushEvents(); } flushEvents(); syncScreens(); return G.mode; },
        /** Stand next to a person on this map, facing them. */
        near(id) { const n = npcsOf(G).find((x) => x.id === id); if (!n) return false; G.p.x = n.x + 1.0; G.p.y = n.y; G.p.dir = 'left'; G.safeT = 3; return true; },
        save: () => saveGame(G),
        hasSave,
        pause, resume,
    };
}
