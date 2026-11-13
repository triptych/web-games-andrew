// GIANT'S VAULT — entry point. Boots the view, runs the fixed-step simulation, routes input and events, and moves
// between the title, class choice, play, the panels and death.
//
// ?debug=1 exposes window.__tv for the dev/ harnesses; &fast=N runs N× simulation per frame; &q=low draws less;
// &models=0 keeps the code-built stand-ins.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { Panels } from './ui/panels.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step, act, NONE } from './sim/game.js';
import { makeBot, botInput, botManage } from './sim/bot.js';
import { AREAS } from './sim/data/world.js';
import { SKILLS } from './sim/data/masteries.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const LOW = params.get('q') === 'low';

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const canvas = document.getElementById('view');
const input = new Input(canvas);
const view = new View(canvas, document.getElementById('overlay'), { low: LOW });
view.overlay.numbers = settings.numbers;
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); view.overlay.numbers = s.numbers; if (G) act(G, { t: 'filter', level: s.filter }); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
// back from a menu: the press that closed it must not also act in the game. Flushed the moment the last screen
// closes, not on the next frame, or a key pressed in between is lost too.
ui.onResume = () => input.flush();
const panels = new Panels({ ui, audio, cmd: (c) => { const r = act(G, c); flushEvents(); return r; } });

let G = null;
let mode = 'title';          // title | play
let acc = 0, time = 0, last = performance.now(), saveT = 0;
let bot = null, botT = 0;
let attackId = null;         // the monster the mouse is attacking
let pendingFeature = null;   // a town feature we're walking to, to use on arrival
const USABLE = ['npc', 'stash', 'obelisk', 'shrine', 'waystone'];   // features a click or a tap opens
let pendingDrop = null;      // a labelled item we're walking to, to pick up
const seen = {};

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title') audio.setTheme('town'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') ui.showClasses((cls) => startGame(newGame((Date.now() % 1e9) | 0, cls)));
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
document.getElementById('card-ok').addEventListener('click', () => { audio.ui('close'); ui.closeScreen('card'); });
document.getElementById('btn-pause').addEventListener('click', () => pause());
for (const b of document.querySelectorAll('#hud-btns [data-panel]')) b.addEventListener('click', () => { if (G) panels.toggle(b.dataset.panel, G); });
document.getElementById('btn-labels').addEventListener('click', () => { input.labels = !input.labels; });
document.getElementById('pet-chip').addEventListener('click', () => { if (G) { panels.tab = 'pet'; panels.open('inventory', G); } });
document.getElementById('prompt').addEventListener('click', () => { if (G?.near) useFeature(G.near); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    act(G, { t: 'filter', level: settings.filter });
    ui.buildSlots(G, (i) => { if (i === 'potion') input.pressPotion(); else if (i === 'portal') input.pressPortal(); else input.pressSlot(i); });
    ui.tSlotEls.forEach((b, i) => { if (i < 5) input.bindSkillButton(b, i); else input.bindButton(b, () => (i === 5 ? input.pressPotion() : input.pressPortal())); });
    ui.showHud(true);
    updateTouch();
    flushEvents();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = null;
    refreshTitle();
    ui.openScreen('title');
    audio.setTheme('town');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));

/** Open whatever a town feature is. */
function useFeature(id) {
    const f = G.features.find((x) => x.id === id);
    if (!f) return;
    pendingFeature = null;
    const kind = f.kind === 'npc' ? (f.role === 'merchant' ? 'merchant' : 'chronicler') : f.kind;
    if (['merchant', 'chronicler', 'stash', 'obelisk', 'shrine', 'waystone'].includes(kind)) panels.open(kind, G);
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && top !== 'title' && top !== 'dead') { audio.ui('close'); ui.closeTop(); }
        else if (top === 'panel' && ((key === 'KeyI' && panels.kind === 'inventory') || (key === 'KeyK' && panels.kind === 'skills') || (key === 'KeyC' && panels.kind === 'character'))) ui.closeTop();
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyI') panels.open('inventory', G);
    else if (key === 'KeyK') panels.open('skills', G);
    else if (key === 'KeyC') panels.open('character', G);
}

/** The sim's input record for this frame, from the mouse, keys, pad and touch. */
function gather() {
    const st = input.state();
    const inp = { ...NONE, held: st.held.slice(), press: input.edges.slots.slice(), potion: input.edges.potion, portal: input.edges.portal, interact: input.edges.interact, stand: st.stand, mx: st.x, my: st.y };
    const P = G.player, m = input.mouse;
    const mouseAim = input.lastDevice === 'mouse' || input.lastDevice === 'keys';
    const ground = mouseAim && m.x >= 0 ? view.pick(m.x, m.y) : null;
    if (m.leftPress) {
        const lbl = input.labels || G.drops.some((d) => d.item && ['legendary', 'mythic', 'set'].includes(G.items[d.item]?.rarity)) ? view.overlay.labelAt(m.x, m.y) : null;
        const mon = view.pickMonster(G, m.x, m.y);
        const feat = ground && G.features.find((f) => USABLE.includes(f.kind) && Math.hypot(f.x - ground.x, f.y - ground.y) < 1.6);
        attackId = null; pendingDrop = null; pendingFeature = null;
        if (lbl) pendingDrop = lbl;
        else if (mon) attackId = mon.id;
        else if (feat) pendingFeature = feat.id;
    }
    if (input.edges.tap) {
        const t = input.edges.tap;
        const lbl = view.overlay.labelAt(t.x, t.y);
        let feat = null, fd = 56;                     // px: a fingertip's worth around the thing's middle
        for (const f of G.features) {
            if (!USABLE.includes(f.kind)) continue;
            const sp = view.screenOf(f.x, f.y, f.kind === 'npc' ? 0.9 : 0.6);
            const d = Math.hypot(sp.x - t.x, sp.y - t.y);
            if (d < fd) { fd = d; feat = f; }
        }
        if (lbl) { pendingDrop = lbl; pendingFeature = null; }
        else if (feat) { pendingFeature = feat.id; pendingDrop = null; }
    }
    if (!m.left && !m.leftPress) attackId = null;
    // auto-aim for pads and touch: the nearest enemy, else straight ahead
    let aim = ground;
    if (!mouseAim) {
        let best = null, bd = 13;
        for (const q of G.mons) { if (q.life <= 0) continue; const d = Math.hypot(q.x - P.x, q.y - P.y); if (d < bd) { bd = d; best = q; } }
        aim = best ? { x: best.x, y: best.y } : { x: P.x + Math.cos(P.face) * 4, y: P.y + Math.sin(P.face) * 4 };
    }
    const target = attackId && G.mons.find((q) => q.id === attackId && q.life > 0);
    if (target) { inp.held[0] = true; inp.press[0] = inp.press[0] || m.leftPress; aim = { x: target.x, y: target.y }; }
    else if (attackId) attackId = null;
    if (aim) { inp.ax = aim.x; inp.ay = aim.y; }
    // the right button is skill 2 at the mouse
    if (m.right) inp.held[1] = true;
    if (m.rightPress) inp.press[1] = true;
    // click and hold on the ground: walk toward the cursor (Diablo's rule)
    if (!target && m.left && ground && !pendingDrop && !pendingFeature && !(Math.hypot(inp.mx, inp.my) > 0.15)) { inp.tx = ground.x; inp.ty = ground.y; }
    if (pendingDrop) {
        const d = G.drops.find((x) => x.id === pendingDrop);
        if (!d) pendingDrop = null;
        else if (Math.hypot(d.x - P.x, d.y - P.y) < 1.8) { act(G, { t: 'pickup', id: d.id }); pendingDrop = null; }
        else { inp.tx = d.x; inp.ty = d.y; }
    }
    if (pendingFeature) {
        const f = G.features.find((x) => x.id === pendingFeature);
        if (!f) pendingFeature = null;
        else if (Math.hypot(f.x - P.x, f.y - P.y) < 2.2) useFeature(f.id);
        else { inp.tx = f.x; inp.ty = f.y + 1; }
    }
    return inp;
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'interact') useFeature(e.id);
        if (e.type === 'area' || e.type === 'bossDead') { saveGame(G); attackId = null; pendingFeature = null; pendingDrop = null; }
        if (e.type === 'levelup' || e.type === 'learned' || e.type === 'equip' || e.type === 'sold' || e.type === 'moved' || e.type === 'petBack') panels.refresh(G);
    }
}

function theme() {
    if (!G) return 'town';
    if (G.mons.some((m) => m.boss && m.aggro && m.life > 0)) return 'boss';
    if (G.rift) return 'rift';
    const a = AREAS[G.area.id].act;
    return a === 0 ? 'town' : `act${Math.min(3, a)}`;
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    const running = mode === 'play' && !ui.anyScreen();
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            if (bot && (botT -= STEP) <= 0) { botT = 0.5; botManage(G, bot); }
            const inp = bot ? botInput(G, bot) : gather();
            step(G, inp, STEP);
            input.consumeEdges();
            acc -= STEP;
            n++;
            if (G.events.length > 40) flushEvents();
        }
        saveT += dt;
        if (saveT > 15) { saveT = 0; saveGame(G); }
    } else {
        acc = 0;
        // death plays on behind the screen: the sim counts down to the respawn
        if (mode === 'play' && G?.mode === 'dead' && ui.top() === 'dead') step(G, NONE, dt);
    }
    flushEvents();
    if (G) {
        audio.setTheme(theme());
        view.frame(G, dt, time, { labels: input.labels });
        if (mode === 'play') ui.hud(G, time);
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (G) saveGame(G); } });
window.addEventListener('pagehide', () => { if (G && mode === 'play') saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__tv = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, panels,
        start(seed = 1, cls = 'ironsworn') { startGame(newGame(seed, cls)); for (const id of [...ui.stack]) ui.closeScreen(id); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot; events reach the view as usual. */
        ff(sec) { const b = makeBot(); let t = 0, mt = 0; while (t < sec) { if ((mt -= STEP) <= 0) { mt = 0.5; botManage(G, b); } step(G, botInput(G, b), STEP); t += STEP; if (G.events.length > 300) G.events.splice(0, 200); } flushEvents(); for (const id of [...ui.stack]) if (id !== 'panel') ui.closeScreen(id); },
        act: (c) => { const r = act(G, c); flushEvents(); return r; },
        skills: SKILLS,
        save: () => saveGame(G),
        hasSave,
    };
}
