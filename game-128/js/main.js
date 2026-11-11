// Gemheart Saga — entry point. Boots the view, the UI and the sound, runs the fixed-step battle simulation, routes
// input and sim events, and moves between the title, the hero choice, story scenes, the village and battles.
//
// ?debug=1 exposes window.__gs for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { BattleView } from './view/battle.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, step } from './sim/game.js';
import { makeBot, botBattle } from './sim/bot.js';
import { ART, preload } from './assets.js';
import { HEROES } from './sim/data/heroes.js';
import { REGIONS } from './sim/data/world.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
let clockOffset = 0;
const now = () => Date.now() + clockOffset;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const view = new BattleView(document.getElementById('view'), {
    onSwap: (a, b) => { if (G && G.mode === 'battle') cmd({ t: 'swap', a, b }); },
    onSelect: () => audio.ui('select'),
});
view.calm = !!settings.calm || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ui = new UI({
    audio, settings, cmd: (c) => cmd(c), now, G: () => G,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); view.calm = !!s.calm; ui.folk.calm = !!s.calm; },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    onTitle: () => toTitle(),
});
ui.folk.calm = view.calm;

let G = null;
let acc = 0;
let time = 0;
let last = performance.now();
let bot = null;
let resultAt = 0;               // seconds left before the result screen opens
let wasRunning = false;
const seen = {};

preload([ART.icons('gems'), ART.icons('misc'), ART.icons('goods'), ART.bg('title'), ART.bg('village'), ART.buildings,
    ...HEROES.map((h) => ART.por(h.id)), ...REGIONS.map((r) => ART.bg(r.id))]);

// ------------------------------------------------------------------ title and menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (!audio.current) audio.play(G ? null : 'title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') ui.heroSelect((hero) => startGame(newGame(Math.floor(Math.random() * 1e9) + 1, hero)));
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'flee') { ui.closeScreen('pause'); cmd({ t: 'flee' }); }
    else ui.openScreen(a);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('btn-vsettings').addEventListener('click', () => { audio.ui('open'); ui.openScreen('settings'); });
document.getElementById('btn-adventure').addEventListener('click', () => { audio.ui('open'); ui.openPanel({ kind: 'adventure' }, G); });
document.getElementById('btn-hero').addEventListener('click', () => { audio.ui('open'); ui.openPanel({ kind: 'hero', tab: 'skills' }, G); });
document.getElementById('btn-requests').addEventListener('click', () => { audio.ui('open'); ui.openPanel({ kind: 'requests' }, G); });
document.getElementById('result-go').addEventListener('click', () => { audio.ui('click'); ui.closeScreen('result'); cmd({ t: 'continue' }); });
document.getElementById('scene-next').addEventListener('click', () => sceneNext());
document.getElementById('scene-skip').addEventListener('click', () => { audio.ui('click'); audio.hush(); cmd({ t: 'skip' }); });
document.getElementById('scene').addEventListener('click', (e) => { if (!e.target.closest('button')) sceneNext(); });
ui.onClose = (id) => { if (id === 'ending' && G) sync(); };

function sceneNext() {
    if (ui.finishTyping()) return;
    audio.ui('click');
    cmd({ t: 'next' });
}

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();
    input.flush();
    act(G, { t: 'collect', now: now() });
    flushEvents();
    sync();
    saveGame(G);
}

function toTitle() {
    if (G) saveGame(G);
    G = null;
    ui.closeAll();
    document.getElementById('bhud').hidden = true;
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
}

function pause() {
    if (!G || G.mode !== 'battle' || ui.has('pause') || ui.has('result')) return;
    audio.ui('open');
    ui.openScreen('pause');
}

// ------------------------------------------------------------------ commands
function cmd(c) {
    if (!G) return false;
    const before = G.mode;
    const okd = act(G, c);
    if (!okd && ['build', 'buy', 'upgrade', 'learn', 'equip', 'equipBest', 'unequipAll', 'claim', 'sell'].includes(c.t)) audio.ui('no');
    flushEvents();
    if (G.mode !== before || c.t === 'next' || c.t === 'continue' || c.t === 'skip') sync();
    else if (G.mode === 'village') { ui.renderVillage(G); ui.renderPanel(G); }
    if (G.mode === 'village' && okd) saveGame(G);
    return okd;
}

/** Bring the screens in line with G.mode. */
function sync() {
    if (!G) return;
    const hud = document.getElementById('bhud');
    if (G.mode === 'scene') {
        hud.hidden = true;
        for (const s of ['village', 'panel', 'result']) if (ui.has(s)) ui.closeScreen(s);
        ui.showScene(G);
        audio.play(G.scene.tag === 'opening' ? 'title' : 'story');
    } else if (G.mode === 'village') {
        // a new tale reaches the village after its opening scene: start the idle clock now (v1.2.0; the collect in
        // startGame came during the scene and was ignored, so production never began until a reload)
        if (!G.village.last) { act(G, { t: 'collect', now: now() }); flushEvents(); }
        audio.hush();
        hud.hidden = true;
        for (const s of ['scene', 'result', 'pause']) if (ui.has(s)) ui.closeScreen(s);
        if (!ui.has('village')) ui.openScreen('village');
        if (ui.has('ending')) ui.openScreen('ending');      // the tale's end stays on top of the village it returns to
        ui.renderVillage(G);
        if (!document.getElementById('ticker').children.length) ui.ticker.now(G, now(), ui.today());   // never an empty feed
        if (!ui.has('ending')) audio.play('village');
    } else if (G.mode === 'battle') {
        audio.hush();
        for (const s of ['scene', 'village', 'panel']) if (ui.has(s)) ui.closeScreen(s);
        document.activeElement?.blur?.();
        hud.hidden = false;
        ui.buildHud(G, (id) => cmd({ t: 'skill', node: id }), (id) => cmd({ t: 'item', id }));
        ui.placeHud(view.layout);
        resultAt = 0;
    }
}

// ------------------------------------------------------------------ events
const TOAST = {
    levelup: (e) => `Level ${e.lv}! A skill point to spend.`,
    collect: (e) => `Collected ${Object.entries(e.got).map(([k, v]) => `${v} ${k}`).join(', ')}.`,
    daily: (e) => `Daily gift: ${e.got.gold} gold and materials. Streak ${e.streak}! Harvest festival for 2 hours.`,
    build: (e) => `Built to level ${e.lv}.`,
    claim: () => 'Request complete. Reward claimed.',
    upgrade: (e) => `Upgraded to +${e.plus}.`,
    learn: (e) => `Learned rank ${e.rank}.`,
    equipBest: (e) => `Now wearing your best gear (${e.n} piece${e.n > 1 ? 's' : ''} changed).`,
    unequipAll: () => 'All gear taken off.',
};
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (TOAST[e.type]) ui.toast(TOAST[e.type](e));
        if (e.type === 'line') { ui.showScene(G); }
        if (e.type === 'ending') ui.showEnding(G, e.credits);
        if (e.type === 'item' || e.type === 'won') ui.buildHud(G, (id) => cmd({ t: 'skill', node: id }), (id) => cmd({ t: 'item', id }));
        if ((e.type === 'won' || e.type === 'lost' || e.type === 'fled') && G.mode === 'battle') resultAt = e.type === 'won' ? 1.1 : 0.6;
    }
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    input.poll();
    const press = input.next();
    if (!press) return;
    const key = press.key;
    const top = ui.top();
    if (top && !['village', 'scene', 'title'].includes(top)) {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape' || (key === 'KeyP' && top === 'pause')) {
            if (top === 'result') return;
            audio.ui('close'); ui.closeTop();
        } else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (top === 'title') {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (!G) return;
    if (G.mode === 'scene') {
        if ((key === 'Enter' || key === 'Space') && !press.onButton) sceneNext();
        else if (key === 'Escape') { audio.hush(); cmd({ t: 'skip' }); }
        return;
    }
    if (G.mode === 'village') {
        if (key === 'ArrowDown' || key === 'ArrowRight') ui.moveFocus(1);
        else if (key === 'ArrowUp' || key === 'ArrowLeft') ui.moveFocus(-1);
        else if (key === 'Escape') { if (!ui.closeTip()) ui.openScreen('settings'); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (G.mode === 'battle') {
        if (key === 'Escape' || key === 'KeyP') { pause(); return; }
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[key];
        if (n !== undefined) {
            if (n < 3) { const b = document.querySelectorAll('#skills .skill')[n]; if (b) cmd({ t: 'skill', node: b.dataset.skill }); }
            else { const id = ui.hudItems?.[n - 3]; if (id) cmd({ t: 'item', id }); }
            return;
        }
        view.key(key);
    }
}

// ------------------------------------------------------------------ frame loop
function frame(nowMs) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (nowMs - last) / 1000);
    last = nowMs;
    time += dt;
    handlePresses();
    const running = !!G && G.mode === 'battle' && !ui.has('pause') && !ui.has('settings') && !ui.has('howto') && !ui.has('result');
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            if (bot) { const c = botBattle(G, bot, STEP); if (c && c.t !== 'continue') act(G, c); }
            step(G, STEP);
            acc -= STEP;
            n++;
            if (G.mode !== 'battle') break;
        }
        flushEvents();
        if (resultAt > 0) {
            resultAt -= dt;
            if (resultAt <= 0 && G.battle && (G.battle.phase === 'won' || G.battle.phase === 'lost')) {
                ui.showResult(G);
                saveGame(G);
            }
        }
    } else acc = 0;
    if (G && G.mode === 'battle') {
        view.frame(G, dt, time);
        ui.hud(G);
        ui.placeHud(view.layout);
    } else view.frame({ battle: null }, dt, time);
    // the villagers walk while Briarwick is on top (built the first time it shows, so its size is known)
    if (G && G.mode === 'village' && ui.top() === 'village') {
        if (!ui.folk.built) ui.folk.build();
        ui.folk.frame(dt);
    }
    if (G && G.mode === 'village' && Math.floor(time) !== Math.floor(time - dt) && ui.top() === 'village') {
        ui.renderVillage(G);
        ui.ticker.tick(G, 1, now(), ui.today());
    }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (G) saveGame(G); } });
window.addEventListener('pagehide', () => { if (G) saveGame(G); });
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__gs = {
        get G() { return G; },
        get mode() { return G ? G.mode : 'title'; },
        seen, view, ui, audio, input,
        /** A new game straight into the village, scenes skipped. */
        start(seed = 1, hero = 'kael') {
            startGame(newGame(seed, hero));
            for (let i = 0; i < 30 && G.mode === 'scene'; i++) act(G, { t: 'next' });
            flushEvents(); sync();
            return G;
        },
        cmd: (c) => cmd(c),
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill }) : null; },
        /** Run the battle ahead synchronously with the bot. */
        ff(sec) {
            const b = makeBot({ skill: 1 });
            for (let t = 0; t < sec && G.mode === 'battle' && G.battle.phase !== 'won' && G.battle.phase !== 'lost'; t += STEP) {
                const c = botBattle(G, b, STEP); if (c && c.t !== 'continue') act(G, c);
                step(G, STEP);
            }
            flushEvents();
        },
        /** Win the current fight now. */
        win() { if (G?.battle) { G.battle.foe.hp = 1; G.battle.board.out.push({ k: 0, n: 3, chain: 1, blast: false, special: 0, x: 3, y: 3 }); step(G, STEP); flushEvents(); } },
        skipScene() { for (let i = 0; i < 60 && G.mode === 'scene'; i++) act(G, { t: 'next' }); flushEvents(); sync(); },
        clock(ms) { clockOffset += ms; },
        save: () => saveGame(G),
        hasSave,
    };
}
