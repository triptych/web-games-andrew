// Glimmerglade — entry point. Boots the view, routes taps, drags, keys and the gamepad into sim commands (one per
// frame, never while wisps are still flying), hands sim events to the view, the sound and the UI, and keeps the
// progress: stars, unlocked levels, woken creatures, the daily dewdrop streak and the puzzle in play.
//
// ?debug=1 exposes window.__gg for the dev/ harnesses.

import { STEP, MAX_FRAME, CHAPTERS, WISPS, LEVELS_PER_CHAPTER, TOTAL_LEVELS, ENDING } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI, dayKey } from './ui.js';
import { loadSettings, saveSettings, loadProgress, saveProgress, clearProgress, freshProgress } from './save.js';
import { newGame, act, step, serialize, deserialize } from './sim/game.js';
import { canPour, isOpen, legalMoves } from './sim/rules.js';
import { makeBot, botCommand } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

const settings = loadSettings();
let P = loadProgress();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new View(document.getElementById('view'));
view.onLand = (kind, colour) => audio.land(kind, colour);
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDelete: () => { clearProgress(); P = freshProgress(); G = null; toTitle(); },
    onLevel: (n) => startLevel(n),
});

let G = null;                 // the puzzle in play (null on the title)
let mode = 'title';           // title | play | won
let time = 0, last = performance.now();
let cmds = [];                // commands waiting for the board to settle
let bot = null, botT = 0;
let said = {};                // voice lines already said this level
let areaT = 0;
const seen = {};              // a count of every sim event drained, for the tests

function applySettings() {
    audio.setVolumes(settings.sfx, settings.music, settings.voice);
    view.glyphs = settings.glyphs; view.sprites.clear();
    view.calm = settings.calm;
    document.documentElement.classList.toggle('calm', settings.calm);
}
applySettings();

const save = () => { if (G && !G.won && mode === 'play') P.cur = serialize(G); return saveProgress(P); };

// ------------------------------------------------------------------ places and music
const chapterOf = (g) => (g.kind === 'level' ? Math.floor(g.n / LEVELS_PER_CHAPTER) : g.ch);
function label(g) {
    if (g.kind === 'daily') return { num: '☀', name: 'Daily Dewdrop' };
    if (g.kind === 'dream') return { num: '✨', name: 'Endless Dreams' };
    return { num: String(g.n + 1), name: CHAPTERS[chapterOf(g)].name };
}
function musicFor(g) {
    if (!g) return 'title';
    if (g.kind !== 'level') return 'star';
    const c = chapterOf(g);
    return c < 2 ? 'meadow' : c < 4 ? 'moon' : 'star';
}

// ------------------------------------------------------------------ starting and leaving
function begin(g) {
    G = g;
    mode = 'play';
    cmds = []; said = {};
    ui.closeAll();
    document.activeElement?.blur?.();
    input.flush();
    ui.showHud(true);
    ui.setBackdrop(CHAPTERS[chapterOf(G)].id);
    audio.play(musicFor(G));
    fitArea();
    view.reset(G);
    ui.hud(G, label(G));
    ui.pulseTools(false);
    P.cur = serialize(G);
    saveProgress(P);
}

function startLevel(n) {
    n = Math.max(0, Math.min(TOTAL_LEVELS - 1, n));
    const g = newGame('level', n);
    const ch = Math.floor(n / LEVELS_PER_CHAPTER);
    if (!P.story.includes(ch)) {
        P.story.push(ch);
        saveProgress(P);
        ui.closeAll();
        ui.setBackdrop(CHAPTERS[ch].id);
        audio.play(musicFor(g));
        const lines = [{ who: 'willow', text: CHAPTERS[ch].intro, vo: `willow-${ch + 1}` }];
        if (ch === 0) lines.push({ who: 'lumi', text: "Leave it to me, Grandmother Willow. I'll bring every wisp home!", vo: 'lumi-promise' });
        ui.story(lines, () => begin(g));
        return;
    }
    begin(g);
    if (Math.random() < 0.4) say('lumi-start');
}

function startDaily() {
    const k = dayKey();
    begin(newGame('daily', +k.replace(/-/g, '')));
    say('lumi-daily', true);
}
function startDream() { begin(newGame('dream', (Date.now() % 1e9) | 0)); }

function resume() {
    if (P.cur) {
        try { begin(deserialize(P.cur)); return; } catch { P.cur = null; }
    }
    if (P.ending && P.unlocked >= TOTAL_LEVELS - 1 && P.stars[TOTAL_LEVELS - 1]) { openMap(); return; }
    startLevel(P.unlocked);
}

function toTitle() {
    if (G && mode === 'play') save();
    ui.closeAll();
    mode = 'title';
    G = null;
    ui.showHud(false);
    ui.title(P);
    audio.play('title');
    ui.openScreen('title');
}

function openMap() { ui.map(P); ui.openScreen('map'); }

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    save();
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ menus
document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'play') resume();
    else if (a === 'map') openMap();
    else if (a === 'daily') startDaily();
    else if (a === 'journal') { ui.journal(P); ui.openScreen('journal'); }
    else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'restart') { ui.closeScreen('pause'); queue({ t: 'restart' }); }
    else if (a === 'map') openMap();
    else if (a === 'quit') toTitle();
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-dream').addEventListener('click', () => { audio.ui('click'); startDream(); });
document.getElementById('story-next').addEventListener('click', () => ui.storyNext?.());
document.getElementById('win-next').addEventListener('click', () => { audio.ui('click'); afterWin('next'); });
document.getElementById('win-again').addEventListener('click', () => { audio.ui('click'); afterWin('again'); });
document.getElementById('win-map').addEventListener('click', () => { audio.ui('click'); afterWin('map'); });
document.getElementById('ending-done').addEventListener('click', () => { audio.ui('click'); toTitle(); });
for (const b of document.querySelectorAll('#toolbar .tool')) {
    // finger-down: a click waits for the lift and feels late
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); useTool(b.dataset.tool); });
    b.addEventListener('click', (e) => { if (!e.detail) useTool(b.dataset.tool); });   // keyboard Enter / Space on a focused tool
}

function useTool(t) {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('click');
    view.selected = -1;
    if (t === 'restart') {
        if (!restartArmed || performance.now() - restartArmed > 2500) { restartArmed = performance.now(); ui.toast('Tap Restart again to start over'); return; }
        restartArmed = 0;
    }
    queue({ t });
}
let restartArmed = 0;

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ the board: taps and drags
const canvas = document.getElementById('view');
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || ui.anyScreen()) return;
    e.preventDefault();
    view.cursor = -1;
    const i = view.hitTube(e.clientX, e.clientY);
    drag = { id: e.pointerId, from: tap(i) };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
});
canvas.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const j = view.hitTube(e.clientX, e.clientY);
    if (drag.from >= 0 && j >= 0 && j !== drag.from && view.selected === drag.from) tap(j);
    drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });

/** A tap on blossom i (or on nothing): lift, put down, switch, or pour. Returns the lifted blossom or -1. */
function tap(i) {
    if (!G || G.won) return -1;
    const sel = view.selected;
    const pickable = (k) => k >= 0 && isOpen(G.tubes[k], G.blooms) && G.tubes[k].s.length > 0;
    if (i < 0) { view.selected = -1; return -1; }
    if (sel < 0) {
        if (pickable(i)) { view.selected = i; audio.ui('lift'); return i; }
        if (G.tubes[i].lock > G.blooms) { ui.toast(`Brambles: ${G.tubes[i].lock - G.blooms} more bloom${G.tubes[i].lock - G.blooms > 1 ? 's' : ''}`); }
        queue({ t: 'pour', from: i, to: i });       // a gentle "nope" shake
        return -1;
    }
    if (i === sel) { view.selected = -1; return -1; }
    if (!canPour(G.tubes, G.blooms, sel, i) && pickable(i)) {
        // a blossom the lifted wisps can't go into: you've changed your mind, lift this one instead
        view.selected = i; audio.ui('lift'); return i;
    }
    queue({ t: 'pour', from: sel, to: i });
    return -1;
}

function queue(cmd) { cmds.push(cmd); }

// ------------------------------------------------------------------ keys and the gamepad
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && top !== 'title' && top !== 'story' && top !== 'win') { audio.ui('close'); ui.closeTop(); }
        else if (top === 'story' && (key === 'Enter' || key === 'Space') && !press.onButton) ui.storyNext?.();
        else if (press.pad && (key === 'Space' || key === 'Enter')) document.activeElement?.click?.();
        else if (press.pad && key === 'KeyZ' && top !== 'title') { audio.ui('close'); ui.closeTop(); }
        return;
    }
    if (mode !== 'play' || !G) return;
    const n = G.tubes.length;
    const per = view.per || n;
    const move = (d) => { view.cursor = view.cursor < 0 ? Math.max(0, view.selected) : (view.cursor + d + n) % n; };
    if (key === 'ArrowRight' || key === 'KeyD') move(1);
    else if (key === 'ArrowLeft' || key === 'KeyA') move(-1);
    else if (key === 'ArrowDown' || key === 'KeyS') move(per);
    else if (key === 'ArrowUp' || key === 'KeyW') move(-per);
    else if (key === 'Space' || key === 'Enter') { if (view.cursor < 0) view.cursor = 0; else tap(view.cursor); }
    else if (/^Digit[0-9]$/.test(key)) { const i = (+key.slice(5) + 9) % 10; if (i < n) { view.cursor = i; tap(i); } }
    else if (key === 'KeyZ' || key === 'KeyU' || key === 'Backspace') useTool('undo');
    else if (key === 'KeyH') useTool('hint');
    else if (key === 'KeyG') useTool('sprout');
    else if (key === 'KeyR') useTool('restart');
    else if (key === 'Escape' || key === 'KeyP') pause();
}

// ------------------------------------------------------------------ voices
function say(name, force = false) {
    if (!force && said[name]) return false;
    if (audio.say(name, { force, gap: 5 })) { said[name] = true; return true; }
    return false;
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    let dirty = false;
    for (const e of ev) {
        if (e.type === 'bloom') {
            const first = P.woke[e.colour] === 0;
            P.woke[e.colour]++;
            dirty = true;
            ui.companion('cheer');
            if (first) {
                setTimeout(() => ui.toast(`A new friend wakes: ${WISPS[e.colour].creature}!`), 700);
                say('lumi-hello', true);
            } else if (G.blooms >= 6) say('lumi-wow');
            else if (G.blooms === 1) say(Math.random() < 0.5 ? 'lumi-bloom' : 'lumi-pretty');
            const left = G.tubes.filter((t) => !t.done && t.s.length).length;
            if (left > 0 && G.colours - G.blooms === 1) say('lumi-almost');
        } else if (e.type === 'reveal') say('lumi-mist');
        else if (e.type === 'unlock') say('lumi-unlock', true);
        else if (e.type === 'sprout') say('lumi-sprout', true);
        else if (e.type === 'hint') {
            if (e.from >= 0) say('lumi-hint');
            else { ui.banner('This tangle can’t be untangled now. Undo a few pours, or restart.'); ui.pulseTools(true); say('lumi-think'); }
        } else if (e.type === 'nope' && e.why === 'hints') ui.toast('No fireflies left this level');
        else if (e.type === 'nope' && e.from >= 0 && e.from !== e.to) { ui.companion('think'); if (Math.random() < 0.25) say('lumi-oops'); }
        else if (e.type === 'stuck') {
            ui.banner('No more pours. Undo, grow a sprout, or restart.', 5000);
            ui.pulseTools(true);
            ui.companion('think');
            say('lumi-stuck', true);
        } else if (e.type === 'pour' || e.type === 'undo' || e.type === 'restart') {
            ui.pulseTools(false);
            dirty = true;
        } else if (e.type === 'win') won(e);
    }
    if (dirty) save();
    ui.hud(G, label(G));
}

let winInfo = null;
function won(e) {
    mode = 'won';
    const g = G;
    let best = false;
    if (g.kind === 'level') {
        best = e.stars > P.stars[g.n];
        P.stars[g.n] = Math.max(P.stars[g.n], e.stars);
        P.unlocked = Math.max(P.unlocked, Math.min(TOTAL_LEVELS - 1, g.n + 1));
    } else if (g.kind === 'daily') {
        const today = dayKey();
        if (P.daily.last !== today) {
            const y = new Date(); y.setDate(y.getDate() - 1);
            P.daily.streak = P.daily.last === dayKey(y) ? P.daily.streak + 1 : 1;
            P.daily.best = Math.max(P.daily.best, P.daily.streak);
            P.daily.last = today;
        }
    } else P.dreams++;
    P.cur = null;
    saveProgress(P);
    const lastLevel = g.kind === 'level' && g.n === TOTAL_LEVELS - 1;
    winInfo = {
        best,
        replay: g.kind === 'level',
        nextLabel: g.kind === 'level' ? (lastLevel ? 'The Ending' : 'Next') : g.kind === 'daily' ? 'Title' : 'Another Dream',
        lastLevel,
    };
    const delay = settings.calm ? 700 : 1700;
    setTimeout(() => {
        if (G !== g || mode !== 'won') return;
        audio.play('win');
        say(e.stars === 3 ? 'lumi-stars' : 'lumi-win', true);
        ui.win(g, winInfo);
        ui.openScreen('win');
        setTimeout(() => { for (let k = 0; k < e.stars; k++) setTimeout(() => audio.ui('star'), k * 250); }, 150);
    }, delay);
}

function afterWin(what) {
    const g = G;
    if (!g) return;
    if (what === 'map') { toTitle(); openMap(); return; }
    if (what === 'again') { startLevel(g.n); return; }
    if (g.kind === 'level') {
        if (winInfo?.lastLevel) { ending(); return; }
        startLevel(g.n + 1);
    } else if (g.kind === 'daily') toTitle();
    else startDream();
}

function ending() {
    ui.closeAll();
    ui.showHud(false);
    mode = 'title';
    ui.story(ENDING, () => {
        P.ending = true; saveProgress(P);
        ui.openScreen('ending');
    });
}

// ------------------------------------------------------------------ frame loop
function fitArea() {
    const r = ui.reserved();
    view.setArea(r.top, r.bottom, r.right);
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    input.poll();
    handlePresses();
    const playing = mode === 'play' && G && !ui.anyScreen();
    if (G && mode === 'play') step(G, dt);
    // one command per frame, and only once the board has caught up with the last one
    if (playing && !view.busy && !G.events.length) {
        if (bot && (botT += dt) > (bot.fast ? 0 : 0.45)) { botT = 0; const c = botCommand(G, bot); if (c) cmds.push(c); }
        const c = cmds.shift();
        if (c) act(G, c);
    } else if (!playing && mode !== 'play') cmds = [];
    flushEvents();
    if (G && (areaT += dt) > 0.5) { areaT = 0; fitArea(); }
    view.frame(G, dt, time, mode !== 'title' && !!G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); pause(); } });
window.addEventListener('pagehide', () => save());
window.addEventListener('resize', () => { if (G) fitArea(); });

// ------------------------------------------------------------------ boot
ui.title(P);
ui.openScreen('title');
audio.play('title');
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__gg = {
        get G() { return G; },
        get P() { return P; },
        get mode() { return mode; },
        get busy() { return view.busy || (G ? G.events.length > 0 : false) || cmds.length > 0; },
        seen, view, ui, audio, input, settings,
        start(n = 0) { P.story = [0, 1, 2, 3, 4]; startLevel(n); return G; },
        daily: startDaily,
        dream: startDream,
        act(cmd) { cmds.push(cmd); },
        tap,
        /** Win the level in play at once with the solver's line; events reach the view and the UI as usual. */
        win() { const b = makeBot({ skill: 'perfect' }); let c; while (G && !G.won && (c = botCommand(G, b))) act(G, c); flushEvents(); },
        /** Play the level in play with the perfect bot, one pour per half second (or as fast as the board allows). */
        autoplay(on = true, fast = false) { bot = on ? Object.assign(makeBot({ skill: 'perfect' }), { fast }) : null; },
        legal: () => (G ? legalMoves(G.tubes, G.blooms) : []),
        tubeCenter: (i) => view.tubeCenter(i),
        save, toTitle, openMap,
    };
}
