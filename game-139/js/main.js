// CLEAN SLATE — entry point. Boots the view, routes taps and keys into sim commands (act), drains the sim's events
// into the view, the sound and the DOM, and saves after every command.
//
// ?debug=1 exposes window.__cs for the dev/ harnesses; &fast=1 makes the attract bot play every frame.

import { MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, canPair, cardInfo, exposed, layoutOf, legalMoves } from './sim/game.js';
import { makeBot, botCommand } from './sim/bot.js';
import { RIVALS } from './sim/data/rivals.js';
import { cardText } from './sim/data/cards.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG && params.get('fast') === '1';
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
const applyAudio = (s) => audio.setVolumes(s.sfx, s.music, s.voice, s.narrator !== 'off');
applyAudio(settings);
const view = new View($('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applyAudio(s); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onCmd: (cmd) => command(cmd),
});

let G = null;                // the run (null on the title screen)
let mode = 'title';          // title | run
let sel = null;              // the chosen card: { slot } | { hand }
let pour = false;            // Pour One Out: the next hand card tapped is poured
let cursor = null;           // keyboard focus on the table: 's12' or 'h<uid>'
let bot = null;              // autoplay (debug)
let botT = 0;
let last = performance.now();
let layout = null, layoutKey = null;
const seen = {};             // a count of every sim event drained, for the tests
const keys = [];             // key presses, one handled per frame

// ------------------------------------------------------------------ title
function refreshTitle() { $('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startRun(newGame((Date.now() % 1e9) | 0));
    else if (a === 'continue') { const g = loadGame(); if (g) startRun(g, true); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { if (G) saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => pause());
$('btn-end').addEventListener('click', () => command({ t: 'end' }));
$('btn-pour').addEventListener('click', () => { pour = !pour; sel = null; audio.ui('click'); });
$('btn-deck').addEventListener('click', () => ui.openDeck(G));
$('over-again').addEventListener('click', () => { audio.ui('click'); startRun(newGame((Date.now() % 1e9) | 0)); });
$('ending-again').addEventListener('click', () => { audio.ui('click'); startRun(newGame((Date.now() % 1e9) | 0)); });

function startRun(g, resumed = false) {
    G = g;
    mode = 'run';
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    sel = null; pour = false; cursor = null; keys.length = 0;
    if (resumed) G.events.length = 0;
    flushEvents();
    ui.sync(G, true);
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    ui.hidePhase();
    mode = 'title'; G = null; bot = null;
    ui.showHud(false);
    refreshTitle();
    ui.openScreen('title');
    audio.shutUp();
}

function pause() {
    if (mode !== 'run' || ui.anyOverlay()) return;
    if (G) saveGame(G);
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ commands
function command(cmd) {
    if (!G) return false;
    const ok = act(G, cmd);
    if (ok) { sel = null; if (cmd.t === 'pour' || G.phase !== 'night') pour = false; }
    flushEvents();
    ui.sync(G, true);
    if (G.over) clearSave(); else saveGame(G);
    return ok;
}

function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
}

// ------------------------------------------------------------------ the night: taps
const night = () => mode === 'run' && G?.phase === 'night' && !ui.anyOverlay();

function tap(p) {
    if (!night() || !p) return;
    const F = G.fight;
    audio.ui('click');
    if (p.hand) {
        const ci = cardInfo(F, p.hand);
        if (pour) { command({ t: 'pour', hand: p.hand }); return; }
        if (sel?.hand === p.hand) {
            if (ci.rank === 13 && !ci.d.trick) command({ t: 'solo', hand: p.hand });
            else sel = null;
            return;
        }
        if (sel?.slot != null && !ci.d.trick && canPair(G, { slot: sel.slot }, p)) { command({ t: 'pair', a: p, b: { slot: sel.slot } }); return; }
        if (ci.d.junk) { ui.toast('A Grudge pairs with nothing. Pour it out.'); return; }
        sel = { hand: p.hand };
        return;
    }
    const s = F.slots[p.slot];
    if (sel?.hand) {
        const ci = cardInfo(F, sel.hand);
        if (ci.d.trick) { command({ t: 'cut', hand: sel.hand, slot: p.slot }); return; }
        if (canPair(G, sel, p)) { command({ t: 'pair', a: sel, b: p }); return; }
        if (s.rank === 13) { command({ t: 'solo', slot: p.slot }); return; }
        sel = { slot: p.slot };
        return;
    }
    if (sel?.slot != null) {
        if (sel.slot === p.slot) { if (s.rank === 13) command({ t: 'solo', slot: p.slot }); else sel = null; return; }
        if (canPair(G, sel, p)) { command({ t: 'pair', a: sel, b: p }); return; }
    }
    if (s.rank === 13) { command({ t: 'solo', slot: p.slot }); return; }
    sel = { slot: p.slot };
}

$('view').addEventListener('pointerdown', (e) => {
    if (!night()) return;
    e.preventDefault();
    tap(view.pick(e.clientX, e.clientY));
});

/** Which cards would pair with the selection (the view glows them). */
function targets() {
    const out = new Set();
    if (!night() || !sel) return out;
    const F = G.fight;
    const trick = sel.hand && cardInfo(F, sel.hand).d.trick;
    for (const s of F.slots) {
        if (!exposed(F, s.id) || s.lock || sel.slot === s.id) continue;
        if (trick || canPair(G, sel, { slot: s.id })) out.add('s' + s.id);
    }
    if (sel.slot != null) for (const u of F.hand) if (canPair(G, sel, { hand: u })) out.add('h' + u);
    return out;
}

function hint() {
    if (!G || G.phase !== 'night') return '';
    const F = G.fight;
    if (pour) return 'Pour one out: tap a card in your hand to discard it and draw another. A Grudge is gone for the night.';
    if (sel?.hand) {
        const ci = cardInfo(F, sel.hand);
        const extra = ci.d.trick ? 'Tap any open rival card.' : ci.rank === 13 ? 'Tap it again to play it alone, or tap a rival card.' : `Tap an open rival card that makes ${13 - ci.rank} (±${1 + (ci.fx.flex || 0)}).`;
        return `${ci.d.name}${ci.up ? ' +' : ''}: ${cardText(ci.d, ci.up)}. ${extra}`;
    }
    if (sel?.slot != null) return `${F.slots[sel.slot].rank}: tap a card that makes 13 with it.`;
    if (!legalMoves(G).some((m) => m.t === 'pair' || m.t === 'solo' || m.t === 'cut')) return 'No pairs left this round. Pour one out, or end the round.';
    return 'Pair to 13: a card in your hand (12–14 counts) with an open rival card, or two rival cards. Kings go alone.';
}

// ------------------------------------------------------------------ keys
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT') && e.code !== 'Escape') return;
    // Space must still press a focused button: preventDefault() on it would cancel the click (game-078)
    if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
    if (e.repeat) return;
    // Enter/Space act on the top screen even when focus sits elsewhere: lib/a11y.js moves focus into a phase screen
    // that opens behind a story, and the story's button must still answer. The story always advances by our hand
    // (never also by the browser's own click), so one press is one line.
    const active = ui.active();
    if ((e.code === 'Enter' || e.code === 'Space') && active && (active === 'story' || !document.getElementById(active).contains(e.target))) {
        e.preventDefault();
        keys.push('Activate');
        return;
    }
    keys.push(e.code);
});

function cursorList() {
    const F = G.fight;
    const open = F.slots.filter((s) => exposed(F, s.id) && !s.lock).map((s) => s.id);
    const L = layout.slots;
    open.sort((a, b) => L[b].r - L[a].r || L[a].x - L[b].x);
    return { pyr: open.map((id) => 's' + id), hand: F.hand.map((u) => 'h' + u) };
}

function handleKey() {
    const k = keys.shift();
    if (!k) return;
    if (k === 'Activate') {
        if (ui.top() === 'story') ui.nextStory();
        else if (ui.active()) { ui.focusFirst(ui.active()); document.activeElement?.click?.(); }
        return;
    }
    if (ui.anyOverlay() || (mode === 'run' && ui.phaseShown)) {
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape' || k === 'KeyP') {
            const top = ui.top();
            if (top === 'story') ui.nextStory();
            else if (top && top !== 'title') { audio.ui('click'); ui.closeTop(); }
        }
        return;
    }
    if (!night()) return;
    const L = cursorList();
    const all = [...L.pyr, ...L.hand];
    if (k === 'Escape') { if (sel || pour) { sel = null; pour = false; } else pause(); return; }
    if (k === 'KeyP') { pause(); return; }
    if (k === 'KeyE') { command({ t: 'end' }); return; }
    if (k === 'KeyQ') { pour = !pour; sel = null; return; }
    if (k === 'KeyD') { ui.openDeck(G); return; }
    if (!all.length) return;
    if (!cursor || !all.includes(cursor)) cursor = L.hand[0] || all[0];
    const inHand = cursor[0] === 'h';
    const row = inHand ? L.hand : L.pyr;
    const i = row.indexOf(cursor);
    if (k === 'ArrowLeft') cursor = row[(i - 1 + row.length) % row.length];
    else if (k === 'ArrowRight') cursor = row[(i + 1) % row.length];
    else if (k === 'ArrowUp' && inHand && L.pyr.length) cursor = L.pyr[Math.min(i, L.pyr.length - 1)];
    else if (k === 'ArrowDown' && !inHand && L.hand.length) cursor = L.hand[Math.min(i, L.hand.length - 1)];
    else if (k === 'Enter' || k === 'Space') tap(cursor[0] === 'h' ? { hand: cursor.slice(1) } : { slot: +cursor.slice(1) });
}

// ------------------------------------------------------------------ frame loop
function music() {
    if (mode !== 'run' || !G) return 'day';
    if (G.phase === 'night') return RIVALS[G.fight.rival].boss ? 'boss' : 'night';
    if (G.phase === 'ending') return 'ending';
    if (G.phase === 'over') return null;
    return 'day';
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handleKey();
    if (bot && G && !G.over) {
        if (ui.storyOpen()) ui.nextStory();
        else if (ui.top() === 'deck') ui.closeScreen('deck');
        else if (!ui.anyOverlay()) {
            botT -= dt;
            if (botT <= 0) { botT = FAST ? 0 : 0.25; const c = botCommand(G, bot); if (c && !command(c) && G.phase === 'night') command({ t: 'end' }); }
        }
    }
    if (G?.fight) {
        const key = G.fight.rival;
        if (key !== layoutKey) { layout = layoutOf(G.fight); layoutKey = key; }
    }
    view.sel = night() ? sel : null;
    view.targets = targets();
    view.cursor = night() ? cursor : null;
    view.frame(G || { phase: 'title', fight: null }, dt, layout);
    const inNight = mode === 'run' && G?.phase === 'night';
    ui.showHud(inNight);
    if (inNight) ui.hud(G, { hint: ui.anyOverlay() ? '' : hint(), pour });
    audio.playMusic(music());
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'run' && G?.phase === 'night') pause(); });
window.addEventListener('pagehide', () => { if (G && mode === 'run') saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__cs = {
        get G() { return G; },
        get mode() { return mode; },
        get sel() { return sel; },
        seen, view, ui, audio,
        start(seed = 1) { startRun(newGame(seed)); return G; },
        act(cmd) { return command(cmd); },
        autoplay(on = true, opts = {}) { bot = on ? makeBot({ seed: 7, ...opts }) : null; },
        /** Play n bot commands now (stories are skipped). */
        ff(n = 50, opts = {}) {
            const b = makeBot({ seed: 11, ...opts });
            for (let i = 0; i < n && G && !G.over; i++) { const c = botCommand(G, b); if (!c) break; if (!command(c) && G.phase === 'night') command({ t: 'end' }); }
            while (ui.storyOpen()) ui.nextStory();
            if (ui.top() === 'deck') ui.closeScreen('deck');
        },
        skipStory() { while (ui.storyOpen()) ui.nextStory(); },
        screenOf: (s) => view.screenOf(s),
        legal: () => legalMoves(G),
        save: () => saveGame(G),
        hasSave,
    };
}
