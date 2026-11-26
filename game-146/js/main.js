// JINGLE POP — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and moves
// between the title, the story, the level map, play, pause and the results.
//
// ?debug=1 exposes window.__jp for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, SAVE_KEY, VERSION } from './config.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import * as Save from './save.js';
import { newGame, step, targets } from './sim/game.js';
import { traceShot } from './sim/hex.js';
import { makeBot, botInput } from './sim/bot.js';
import { LEVELS, CHAPTERS, STORY, POWERS } from './sim/data/levels.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = Save.loadSettings();
let progress = Save.loadProgress();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'));
view.calm = settings.calm;
view.guideMode = settings.guide;
view.setIcons(Object.fromEntries([...Object.keys(POWERS)].map((k) => [k, `art/icon-${k}.webp`])));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { Save.saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); view.calm = s.calm; view.guideMode = s.guide; },
    onErase: () => { Save.clearProgress(); progress = Save.loadProgress(); refreshTitle(); },
});

let G = newGame({ level: 1, seed: 1 });
let mode = 'title';          // title | play | over
let acc = 0, time = 0, saveT = 0;
let last = performance.now();
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() {
    document.getElementById('btn-continue').hidden = !Save.hasSave();
    document.getElementById('btn-story').textContent = progress.seen.includes('intro') ? `Play Level ${progress.unlocked}` : 'Start the Story';
}
refreshTitle();
ui.openScreen('title');
// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-146'.
// The save is everything stored under SAVE_KEY (settings stay on the device); loading writes it back and reloads.
const cloud = makeCloud({ game: 'game-146' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'play' && G) Save.saveGame(G); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const p = snapValue(snap, SAVE_KEY + '.progress'); const st = p ? Object.values(p.stars || {}).reduce((a, b) => a + (+b || 0), 0) : 0; return p ? `Level ${p.unlocked || 1} · ${st}★${p.endless ? ` · endless best ${p.endless}` : ''}` : 'A Jingle Pop game'; },
    hasGame: () => mode === 'play' || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();
audio.play('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'story') storyOrLevel(progress.unlocked);
    else if (act === 'continue') {
        const g = Save.loadGame();
        if (g) startGame(g); else { ui.toast('That save could not be read.'); Save.clearSave(); refreshTitle(); }
    } else if (act === 'endless') startEndless();
    else if (act === 'map') openMap();
    else if (act === 'cloud') cloudUI.open();
    else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'restart') { Save.clearSave(); G.mode === 'endless' ? startEndless(true) : startLevel(G.level); }
    else if (act === 'quit') { Save.saveGame(G); cloudUI.autosave({ force: true }); toTitle(); }
    else if (act === 'cloud') cloudUI.open();
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('result-again').addEventListener('click', () => { audio.ui('click'); G.mode === 'endless' ? startEndless(true) : startLevel(G.level); });
document.getElementById('result-next').addEventListener('click', () => {
    audio.ui('click');
    if (G.level >= LEVELS.length) return playEnding();
    storyOrLevel(G.level + 1);
});
document.getElementById('result-map').addEventListener('click', () => { audio.ui('click'); G.mode === 'endless' ? toTitle() : openMap(); });
document.getElementById('ending-done').addEventListener('click', () => { audio.ui('click'); toTitle(); });

// tray and sack: presses go through Input, so a tap on finger-down is never lost between steps
document.getElementById('tray-hit').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button[data-slot]');
    if (!b) return;
    e.preventDefault();
    const i = +b.dataset.slot;
    if (i === 0) input.edges.cycle = true; else input.pressSwap(i);
});
document.getElementById('sack').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button[data-use]');
    if (!b || b.classList.contains('empty')) return;
    e.preventDefault();
    input.pressUse(+b.dataset.use);
});
for (const id of ['tray-hit', 'sack']) document.getElementById(id).addEventListener('click', (e) => e.preventDefault());

function openMap() {
    ui.buildMap(progress, (id) => storyOrLevel(id));
    ui.openScreen('map');
}

/** Play the story scenes this level needs (the intro, a new chapter's opening), then the level. */
function storyOrLevel(id) {
    id = Math.max(1, Math.min(LEVELS.length, id));
    const def = LEVELS[id - 1];
    const lines = [];
    if (!progress.seen.includes('intro')) { lines.push(...STORY.intro); mark('intro'); }
    const chKey = 'ch' + def.ch;
    if (def.n === 1 && !progress.seen.includes(chKey)) { lines.push(...STORY.chapters[def.ch]); mark(chKey); }
    if (!lines.length) return startLevel(id);
    ui.closeAll();
    ui.setBackdrop(CHAPTERS[def.ch].bg);
    ui.story(lines, () => startLevel(id));
}
function mark(key) { if (!progress.seen.includes(key)) { progress.seen.push(key); Save.saveProgress(progress); } }

function startLevel(id) {
    startGame(newGame({ mode: 'level', level: id, seed: (Date.now() % 1e9) | 0 }));
}
function startEndless(again = false) {
    const go = () => startGame(newGame({ mode: 'endless', seed: (Date.now() % 1e9) | 0 }));
    if (again || progress.seen.includes('endless')) return go();
    mark('endless');
    ui.closeAll();
    ui.setBackdrop('ridge');
    ui.story([STORY.endless], go);
}

function levelName(g) {
    if (g.mode === 'endless') return 'Blizzard';
    const d = LEVELS[g.level - 1];
    return `${d.ch + 1}-${d.n} ${d.name}`;
}

function startGame(g) {
    G = g;
    ui.closeAll();
    ui.clearToasts();
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    input.enabled = true;
    ui.showHud(true);
    ui._layoutKey = null; ui._sk = null; ui._dk = null;
    const ch = G.mode === 'level' ? CHAPTERS[LEVELS[G.level - 1].ch] : null;
    ui.setBackdrop(ch ? ch.bg : 'ridge');
    audio.play(ch ? ch.music : 'endless');
    view.falling.length = 0;
    view.offY = 0;
    ui.setElf('elf');
    if (G.mode === 'level') {
        const d = LEVELS[G.level - 1];
        const ch2 = CHAPTERS[d.ch];
        const first = ch2.meet && d.specials[ch2.meet] && !LEVELS.slice(0, G.level - 1).some((l) => l.specials[ch2.meet]);
        const extra = first ? ` New: ${({ gift: 'presents', coal: 'coal', ice: 'frozen ornaments', bell: 'golden bells', prism: 'prism baubles' })[ch2.meet]}!` : '';
        const tray = d.n === 1 && d.slots > 1 && LEVELS[G.level - 2]?.slots !== d.slots ? ` Your tray now holds ${d.slots} ornaments: tap one to load it.` : '';
        ui.toast(`Level ${d.ch + 1}-${d.n}: ${d.name}.${extra}${tray}`, 3200);
        if (G.shots === 0) setTimeout(() => audio.say('juni-start', { gap: 0 }), 400);
    } else if (G.shots === 0) setTimeout(() => audio.say('juni-blizzard', { gap: 0 }), 400);
    Save.saveGame(G);
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    input.enabled = false;
    ui.showHud(false);
    G = newGame({ level: 1, seed: 1 });
    refreshTitle();
    ui.setBackdrop(null);
    ui.openScreen('title');
    audio.play('title');
}

function playEnding() {
    ui.closeAll();
    ui.showHud(false);
    input.enabled = false;
    mode = 'title';
    ui.setBackdrop('hoard');
    audio.play('title');
    ui.story(STORY.ending, () => { progress.done = true; Save.saveProgress(progress); ui.openScreen('ending'); });
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    Save.saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ input routing
input.toAim = (cx, cy) => view.aimFor(cx, cy);
input.bindBoard(document.getElementById('view'));

function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && top !== 'title' && top !== 'result' && top !== 'story' && top !== 'ending') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Escape' && top === 'story') document.getElementById('story-skip').click();
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function voice(name, chance = 1) {
    if (Math.random() > chance) return;
    audio.say(name);
}

function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        switch (e.type) {
            case 'pop': {
                const n = e.list.length;
                const cx = e.list.reduce((a, b) => a + b.x, 0) / n, cy = e.list.reduce((a, b) => a + b.y, 0) / n;
                ui.callout(view, cx, cy, '+' + Math.round(10 * e.mult * n), false, e.mult > 1 ? '#ffd86a' : '');
                if (G.streak >= 3 && e.how === 'match') { ui.callout(view, 5.5, 8, `Combo ×${e.mult.toFixed(2).replace(/\.?0+$/, '')}`, true); voice('juni-combo', 0.5); }
                break;
            }
            case 'drop':
                if (!G.over && e.list.length >= 3) {
                    const cx = e.list.reduce((a, b) => a + b.x, 0) / e.list.length;
                    ui.callout(view, cx, 9, `+${e.list.length * 20 * e.bonus} drop!`, false, '#9fe6ff');
                    voice('juni-timber', e.list.length >= 6 ? 0.8 : 0.3);
                    ui.setElf('elf-cheer', 900);
                }
                break;
            case 'big': ui.callout(view, 5.5, 7, e.n >= 14 ? 'Jingle-tastic!' : 'Merry!', true); voice('juni-wow', 0.6); ui.setElf('elf-cheer', 1200); break;
            case 'gift': ui.callout(view, e.x, e.y, POWERS[e.p].name + '!', false, '#ffe08a'); voice('juni-gift', 0.35); break;
            case 'power': if (e.from === 'spirit') ui.toast(`Christmas spirit! ${POWERS[e.p].name} added to your sack.`); if (e.full) ui.toast('Sack full: +200 points instead.'); break;
            case 'load': case 'use': voice('juni-watch', 0.35); if (e.type === 'use') ui.toast(POWERS[e.p].name + '! ' + POWERS[e.p].desc); break;
            case 'almost': ui.toast(`Only ${e.left} ornament${e.left === 1 ? '' : 's'} left!`); voice('juni-almost', 0.8); break;
            case 'danger': voice('juni-careful', 0.7); ui.setElf('elf-sad', 1000); break;
            case 'lower': ui.callout(view, 5.5, 2.5, 'The ceiling drops!', false, '#cfe6ff'); break;
            case 'won': onWon(e); break;
            case 'lost': onLost(); break;
            default: break;
        }
    }
}

function onWon(e) {
    mode = 'over';
    input.enabled = false;
    Save.clearSave();
    const id = G.level;
    const prevBest = progress.best[id] || 0;
    progress.stars[id] = Math.max(progress.stars[id] || 0, e.stars);
    progress.best[id] = Math.max(prevBest, e.score);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, id + 1));
    Save.saveProgress(progress);
    ui.setElf('elf-cheer', 4000);
    audio.play('win');
    setTimeout(() => audio.say(e.stars === 3 ? 'juni-stars' : 'juni-win', { force: true }), 900);
    setTimeout(() => {
        if (mode !== 'over' || G.result !== 'won') return;
        ui.showHud(false);
        ui.result({ won: true, G, newBest: e.score > prevBest && prevBest > 0, last: id >= LEVELS.length });
    }, 1600);
}

function onLost() {
    mode = 'over';
    input.enabled = false;
    Save.clearSave();
    ui.setElf('elf-sad', 4000);
    audio.play('lose');
    let best = progress.endless, newBest = false;
    if (G.mode === 'endless' && G.score > progress.endless) { progress.endless = best = G.score; newBest = true; Save.saveProgress(progress); }
    setTimeout(() => audio.say('juni-lose', { force: true }), 700);
    setTimeout(() => {
        if (mode !== 'over' || G.result !== 'lost') return;
        ui.showHud(false);
        ui.result({ won: false, endless: G.mode === 'endless', G, best, newBest });
    }, 1500);
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    input.enabled = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : input.state();
            const out = step(G, inp, STEP);
            if (!bot) input.consume(out.fired);
            acc -= STEP;
            n++;
            if (G.over) break;
        }
        saveT += dt;
        if (saveT > 15) { saveT = 0; Save.saveGame(G); cloudUI.autosave(); }
    } else acc = 0;
    flushEvents();
    const playing = mode === 'play' || mode === 'over';
    const trace = running && G.phase === 'aim' ? traceShot(G, G.aim, G.loaded === 'candy') : null;
    view.frame(G, dt, time, { playing, trace, guide: true });
    if (playing) {
        ui.layout(view, G);
        ui.hud(G, levelName(G));
        ui.tickElf();
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (mode === 'play') Save.saveGame(G); } });
window.addEventListener('pagehide', () => { if (mode === 'play') Save.saveGame(G); cloudUI.autosave({ keepalive: true }); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__jp = {
        get G() { return G; },
        get mode() { return mode; },
        get progress() { return progress; },
        seen, view, ui, audio, input,
        start(level = 1, seed = 1) { startGame(newGame({ mode: 'level', level, seed })); return G; },
        endless(seed = 1) { startGame(newGame({ mode: 'endless', seed })); return G; },
        story: (id) => storyOrLevel(id),
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        targets: () => targets(G),
        save: () => Save.saveGame(G),
        hasSave: () => Save.hasSave(),
        unlockAll() { progress.unlocked = LEVELS.length; for (const k of ['intro', 'ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'endless']) mark(k); Save.saveProgress(progress); refreshTitle(); },
    };
}
