// Dragonroll — entry point. Boots the view, routes input, makes the player's choices through the
// sim's act(), feeds the resulting events to the view's director, and moves between the title,
// the game and the ending.
//
// ?debug=1 exposes window.__dr for the dev/ harnesses; &fast=N plays animations N× faster.

import { MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act as simAct, addXp, beginBattle, startDragon } from './sim/game.js';
import { makeBot, botAction, battleCommand } from './sim/bot.js';
import { stats, newMember } from './sim/party.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const canvas = document.getElementById('view');
const view = new View(canvas, document.getElementById('fxlayer'));
view.stage.setQuality(settings.quality);
view.battleSpeed = settings.bspeed;
view.board.fx.calm = view.battle.fx.calm = settings.calm;
const input = new Input(canvas);

let G = newGame(7, { cls: 'knight' });   // the title shows a game in the background
let mode = 'title';                       // title | game | over
let last = performance.now();
let time = 0;
let bot = null;                           // the autoplay bot (debug), or null
let wasIdle = false;
let saveT = 0;
const seen = {};

const ui = new UI({
    audio, settings, view,
    act: (a) => doAct(a),
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        view.stage.setQuality(s.quality);
        view.battleSpeed = s.bspeed;
        view.board.fx.calm = view.battle.fx.calm = s.calm;
    },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
ui.onAgain = () => { ui.closeScreen('over'); startNew(ui.newCls, ui.newLen, G.heroName); };
ui.onTitle = () => toTitle();

view.listeners.push((e) => {
    seen[e.type] = (seen[e.type] || 0) + 1;
    ui.onEvent(e, G);
    audio.onEvent(e);
    if (e.type === 'b_valor') ui.dispValor = e.v;
    if (e.type === 'b_start') { ui.dispValor = G.valor; music(); }
    if (e.type === 'b_end' && e.result === 'win') { audio.jingle(G.battle?.kind === 'dragon' ? 'win' : 'victory'); }
    if (e.type === 'gold' || e.type === 'toll' || e.type === 'buy') ui.setGold(Math.max(0, G.gold));
});

view.sync(G);
view.board.overview(true);

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
    if (a === 'new') { ui.openScreen('newgame'); ui.paintClassPortraits(); document.getElementById('hero-name').value = ''; }
    else if (a === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(a);
});
document.getElementById('btn-start').addEventListener('click', () => {
    audio.ui('click');
    startNew(ui.newCls, ui.newLen, document.getElementById('hero-name').value);
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
document.getElementById('btn-menu').addEventListener('click', () => pause());
document.getElementById('btn-roll').addEventListener('click', () => roll());
document.getElementById('btn-party').addEventListener('click', () => { audio.ui('open'); ui.openParty(G); });
document.getElementById('btn-bag').addEventListener('click', () => { audio.ui('open'); ui.openBag(G); });
document.getElementById('btn-map').addEventListener('click', () => toggleMap());
const autoBtn = document.getElementById('b-auto');
const setAuto = (on) => { settings.auto = on; autoBtn.setAttribute('aria-pressed', String(on)); saveSettings(settings); };
setAuto(!!settings.auto);
autoBtn.addEventListener('click', () => { setAuto(!settings.auto); ui.presentKey = ''; });
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
document.getElementById('target-cancel').addEventListener('click', () => { ui.cmdState = null; ui.presentKey = ''; });

function startNew(cls, length, name) {
    const seed = (Date.now() % 1e9) | 0;
    startGame(newGame(seed, { cls, length, name }));
    ui.banner('Emberwyld Isle', `${G.laps} laps until the dragon wakes`);
}

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'game';
    input.flush();
    view.sync(G);
    view.board.overview(false);
    view.board.userYaw = 0;
    view.board.userZoom = 1;
    ui.hideDecision();
    ui.showHud(G.phase === 'battle' ? 'battle' : 'board');
    ui.refresh(G);
    if (G.battle && G.phase === 'battle') resumeBattle();
    music();
    saveGame(G);
}

/** A save made mid-battle: rebuild the field from the sim's state. */
function resumeBattle() {
    const B = G.battle;
    view.push([{ type: 'b_start', kind: B.kind, units: B.units.map((u) => ({ side: u.side, eid: u.eid, mid: u.mid, name: u.name, lv: u.lv, hp: u.hp, maxhp: u.maxhp, mp: u.mp, maxmp: u.maxmp, boss: u.boss, alive: u.alive })) }]);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(null);
    ui.hideDecision();
    G = newGame(7, { cls: 'knight' });
    view.sync(G);
    view.board.overview(true);
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
}

function pause() {
    if (mode !== 'game' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function toggleMap() {
    if (mode !== 'game' || view.inBattle) return;
    const on = view.board.mode !== 'overview';
    view.board.overview(on);
    if (!on) view.board.focusOn(G.pos);
    audio.ui(on ? 'open' : 'close');
}

function roll() {
    if (mode !== 'game' || G.phase !== 'roll' || view.busy) return;
    if (view.board.mode === 'overview') { view.board.overview(false); }
    view.board.userYaw *= 0.0;
    doAct({ type: 'roll' });
}

// ------------------------------------------------------------------ acting
function doAct(a) {
    if (mode !== 'game' && !(mode === 'over')) return 'not playing';
    const prev = G.phase;
    const why = simAct(G, a);
    if (why) {
        if (!bot) { ui.toast(why.charAt(0).toUpperCase() + why.slice(1) + '.'); audio.ui('error'); }
        return why;
    }
    const ev = G.events.splice(0);
    view.push(ev);
    if (prev === 'reward' || prev === 'defeat') {
        if (!['dungeonCamp'].includes(G.phase) && G.phase !== 'battle') view.leaveBattle();
    }
    ui.hideDecision();
    if (!ui.anyScreen() || ui.top() === 'town') { /* keep the town open while shopping */ }
    if (G.phase === 'town' && !document.getElementById('town').hidden) ui.renderTown(G);
    if (!document.getElementById('partyscreen').hidden) ui.renderParty(G);
    ui.refresh(G);
    if (G.over) mode = 'over';
    saveGame(G);
    return '';
}

// ------------------------------------------------------------------ music by context
function music() {
    if (mode === 'title') return audio.play('title');
    const B = G.battle;
    if (G.phase === 'victory') return audio.stop();
    if (G.phase === 'gameover') { audio.stop(); return; }
    if (view.inBattle || G.phase === 'battle') {
        if (B?.kind === 'dragon') return audio.play('dragon');
        if (B?.kind === 'boss') return audio.play('boss');
        if (B?.dungeon || G.phase === 'dungeonCamp') return audio.play('dungeon');
        return audio.play('battle');
    }
    if (G.phase === 'dungeonCamp') return audio.play('dungeon');
    if (G.phase === 'town') return audio.play('town');
    return audio.play('board');
}

// ------------------------------------------------------------------ input routing
input.onDrag = (dx, dy) => { if (mode !== 'over' && !view.inBattle) view.board.orbit(dx, dy); };
input.onZoom = (f) => { if (!view.inBattle) view.board.zoom(f); };
input.onTap = (x, y) => {
    if (view.busy && mode === 'game') { view.hurry(true); return; }
    if (mode !== 'game' || view.inBattle || ui.anyScreen()) return;
    const r = canvas.getBoundingClientRect();
    const nx = ((x - r.left) / r.width) * 2 - 1, ny = -((y - r.top) / r.height) * 2 + 1;
    const i = view.board.pick(nx, ny);
    if (G.phase === 'portal' && i >= 0 && i !== 30) { ui.pickTile?.(i); return; }
    ui.tileInfo(G, i);
};
input.onTouch = () => {};

function handleKeys() {
    const press = input.next();
    if (!press) return;
    const k = press.key;
    if (ui.anyScreen()) {
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if ((k === 'Escape' || k === 'KeyP') && !['title', 'over', 'town'].includes(ui.top())) { audio.ui('close'); ui.closeTop(); }
        else if (k === 'Escape' && ui.top() === 'town') document.getElementById('town-leave')?.focus();
        else if ((k === 'Enter' || k === 'Space') && (press.pad || !press.onButton)) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'game') return;
    if (view.busy) { if (k === 'Space' || k === 'Enter') view.hurry(true); return; }
    const panelUp = !document.getElementById('panel').hidden || !document.getElementById('cmd').hidden;
    if (k === 'Escape' || k === 'KeyP') {
        if (ui.cmdState) { ui.cmdState = null; ui.presentKey = ''; return; }
        pause();
        return;
    }
    if (k === 'ArrowDown' || k === 'ArrowRight') { if (panelUp) ui.moveFocus(1); return; }
    if (k === 'ArrowUp' || k === 'ArrowLeft') { if (panelUp) ui.moveFocus(-1); return; }
    if (k === 'KeyM') return toggleMap();
    if (k === 'Tab') { ui.openParty(G); return; }
    if (k === 'KeyB') { ui.openBag(G); return; }
    if (k === 'Space' || k === 'Enter') {
        if (press.onButton && !press.pad) return;      // the browser presses the focused button itself
        if (G.phase === 'roll') return roll();
        const root = !document.getElementById('cmd').hidden ? 'cmd' : 'panel';
        const list = ui.buttons(root);
        const b = list.includes(document.activeElement) ? document.activeElement : (list.find((x) => x.classList.contains('primary')) || list[0]);
        b?.click();
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000) * FAST;
    last = now;
    time += dt;
    handleKeys();
    if (mode === 'title') { view.board.userYaw += dt * 0.05; }
    view.update(dt, time);
    const idle = !view.busy;
    if (idle && view.speed !== 1) view.hurry(false);
    if (mode === 'game' || mode === 'over') {
        if (view.inBattle) { ui.battleRefresh(G); ui.placeMarkers(); }
        if (idle) {
            // back to the island once a battle is over and its card is closed
            if (view.inBattle && !G.battle && !['reward', 'defeat', 'dungeonCamp', 'victory', 'gameover'].includes(G.phase)) view.leaveBattle();
            const hudMode = view.inBattle ? 'battle' : (mode === 'game' ? 'board' : null);
            if (ui.hudMode !== hudMode) ui.showHud(hudMode);
            if (!wasIdle) { ui.refresh(G); music(); if (G.over) { audio.jingle(G.over === 'win' ? 'win' : 'gameover'); } }
            if (!ui.anyScreen() || ui.top() === 'town' || ui.top() === 'over') ui.present(G);
            // the in-battle Auto button, and the debug autoplay bot
            if (mode === 'game' && G.phase === 'battle' && settings.auto && !bot && !ui.anyScreen()) doAct({ type: 'cmd', ...battleCommand(G, autoBot) });
            else if (bot && mode === 'game' && !ui.anyScreen()) {
                const a = botAction(G, bot);
                if (a) { if (G.phase === 'town') { if (doAct(a)) doAct({ type: 'leave' }); } else doAct(a); }
            }
        }
        wasIdle = idle;
        saveT += dt;
        if (saveT > 15 && mode === 'game') { saveT = 0; saveGame(G); }
    }
}
const autoBot = makeBot({ skill: 1, seed: 99 });

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game') { saveGame(G); pause(); } });
window.addEventListener('pagehide', () => { if (mode === 'game') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__dr = {
        get G() { return G; },
        get mode() { return mode; },
        get busy() { return view.busy; },
        get phase() { return G.phase; },
        seen, view, ui, audio, input,
        start(seed = 1, opts = {}) { startGame(newGame(seed, { cls: 'knight', ...opts })); return G; },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 5 }) : null; },
        act: (a) => doAct(a),
        /** Run the bot ahead in the sim with no animation, then sync the view. */
        ff(steps = 50, skill = 1) {
            const b = makeBot({ skill, seed: 11 });
            for (let i = 0; i < steps && !G.over; i++) { const a = botAction(G, b); if (!a || simAct(G, a)) break; G.events.length = 0; }
            view.sync(G);
            if (G.battle && G.phase === 'battle') resumeBattle();
            ui.hideDecision(); ui.refresh(G);
            return G.phase;
        },
        /** Start a battle at once: fight(['slime', 'goblin'], 2, 'encounter', 'meadow'). */
        fight(ids = ['slime', 'goblin'], lv = 1, kind = 'encounter', region = 'meadow', dungeon = null) {
            G.after = { k: 'endTurn' };
            beginBattle(G, { kind, region, dungeon, enemies: ids.map((id) => ({ id, lv })), canFlee: kind !== 'boss' && kind !== 'dragon', shards: G.shards.length });
            view.push(G.events.splice(0));
            ui.hideDecision();
            return G.phase;
        },
        /** Jump to the final battle with a ready party. */
        dragon(level = 24) {
            for (const c of ['pip', 'grumli']) if (!G.party.some((m) => m.id === c) && G.party.length < 3) { G.hired[c] = true; G.party.push(newMember(G, c)); }
            this.level(level);
            for (const m of G.party) m.gear.weapon = 'dragonbane';
            G.shards = ['shardEmber', 'shardVerdant', 'shardTide', 'shardRime'];
            startDragon(G, true);
            view.push(G.events.splice(0));
            ui.hideDecision();
            return G.phase;
        },
        /** Add companions to the party: recruit('pip', 'sylva'). */
        recruit(...ids) { for (const id of ids) { if (G.party.length < 3) { G.hired[id] = true; G.party.push(newMember(G, id)); } } ui.refresh(G); },
        give(gold = 500) { G.gold += gold; ui.refresh(G); },
        level(n) { addXp(G, 0); G.level = n; for (const m of G.party) { const s = stats(G, m); m.hp = s.maxhp; m.mp = s.maxmp; } G.events.length = 0; ui.refresh(G); },
        save: () => saveGame(G),
        hasSave,
    };
}
