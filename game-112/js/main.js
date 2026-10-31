// Quill & Legion — entry point. Boots the view, routes input, keeps the screens in step with the
// campaign's G.screen, paces the foe's turn, saves.
//
// ?debug=1 exposes window.__ql for the dev/ harnesses; &fast=N plays animations and the foe N× faster.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Play } from './play.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, step, runEnemyPhase, score, nextNodes } from './sim/game.js';
import { makeBattle, stackById } from './sim/battle.js';
import { makeBot, botCommand } from './sim/bot.js';
import { glyphURL, INTENT_GLYPH } from './glyphs.js';
import { CREATURES, RELICS } from './sim/data.js';
import { hexPos } from './view/stage.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

// intent icons as CSS backgrounds
{
    const css = Object.entries(INTENT_GLYPH).map(([k, g]) => `.i-${k} .ig { background-image: ${glyphURL(g)}; }`).join('\n');
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
}

const settings = loadSettings();
const audio = new Audio();
const input = new Input();
let G = null;
let mode = 'title';             // title | run
let time = 0, last = performance.now(), acc = 0;
let bot = null;
let shownScreen = null;
let battleShown = null;
let finishing = false;
const seen = {};

const view = new View($('view'), {
    labels: $('labels'), floats: $('floats'), audio,
    hooks: {
        banner: (t, cls) => ui.banner(t, cls),
        card: () => {},
        curse: () => ui.toast('A Doubt slips into your discard pile.'),
        idle: () => { play.refresh(); updatePads(); },
    },
});
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); applySettings(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    portrait: (key, side) => view.portrait(key, side),
});
const play = new Play({ view, ui, audio, getG: () => G, send: (cmd) => send(cmd) });
ui.onInfoClose = () => { play.insp = null; play.refresh(); };

function applySettings() {
    audio.setVolumes(settings.sfx, settings.music);
    view.setCalm(!!settings.calm);
    view.speed = FAST * (+settings.speed || 1);
    document.body.classList.toggle('calm', !!settings.calm);
}
applySettings();

// ------------------------------------------------------------------ layout
function updatePads() {
    const battle = mode === 'run' && G?.screen === 'battle';
    view.stage.setPad(battle ? ui.pads() : { top: 52, bottom: ui.isOpen('title') ? Math.min(innerHeight * 0.45, $('title').querySelector('.sheet').getBoundingClientRect().height + 20) : 0, left: 0, right: 0 });
}
ui.on = (name) => { if (name === 'screens') requestAnimationFrame(updatePads); };
window.addEventListener('resize', () => requestAnimationFrame(updatePads));
window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(updatePads));

// ------------------------------------------------------------------ the title diorama
function showDiorama() {
    const B = makeBattle({
        seed: 4, army: [{ key: 'pikemen', count: 22 }, { key: 'bowmen', count: 12 }, { key: 'griffins', count: 4 }, { key: 'knights', count: 2 }],
        groups: [['goblins', 26], ['orcs', 9], ['brutes', 2]], relics: [], hero: { atk: 0, def: 0, lore: 1 },
    });
    // move the two hosts toward each other, as if mid-battle
    const at = { 1: [2, 2], 2: [1, 4], 3: [3, 1], 4: [3, 3], 5: [5, 2], 6: [5, 4], 7: [6, 1] };
    for (const s of B.stacks) if (at[s.id]) [s.c, s.r] = at[s.id];
    B.phase = 'deploy';
    view.showBattle(B, 0, { orbit: true });
    view.visible = true;
}

function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

function goTitle() {
    ui.closeAll();
    mode = 'title';
    G = null;
    shownScreen = null; battleShown = null;
    ui.showBattleHud(false);
    showDiorama();
    refreshTitle();
    audio.setMood('title');
    ui.openScreen('title');
}

// ------------------------------------------------------------------ commands
/** Every player action goes through here: the UI, the board, the bot. */
function send(cmd) {
    if (!G) return { ok: false, err: 'no game' };
    const before = G.screen;
    const r = act(G, cmd);
    if (!r.ok) return r;
    if (G.screen !== before || !['place', 'begin', 'play', 'move', 'end'].includes(cmd.t)) syncScreen();
    if (G.screen !== 'battle' || cmd.t === 'end' || cmd.t === 'begin') saveGame(G);
    if (G.screen === 'battle') play.refresh();
    return r;
}

function startRun(seed) {
    G = newGame(seed);
    mode = 'run';
    ui.closeAll();
    shownScreen = null; battleShown = null;
    input.flush();
    document.activeElement?.blur?.();
    syncScreen();
    saveGame(G);
}

const SHEETS = ['reward', 'boon', 'bossrelic', 'dwelling', 'shop', 'camp', 'event', 'treasure', 'victory', 'defeat'];

/** Show whatever G.screen says, and render it. */
function syncScreen() {
    if (!G) return;
    const s = G.screen;
    // the battle
    if (s === 'battle') {
        if (battleShown !== G.battle) {
            ui.closeAll();
            battleShown = G.battle;
            finishing = false;
            play.reset();
            view.showBattle(G.battle, G.act);
            view.visible = true;
            ui.showBattleHud(true);
            audio.setMood(G.battle.kind === 'boss' ? 'boss' : 'battle');
            input.flush();
            requestAnimationFrame(() => { updatePads(); play.refresh(); });
        }
        play.refresh();
        shownScreen = s;
        return;
    }
    battleShown = null;
    ui.showBattleHud(false);
    // the map sits under every sheet between battles
    for (const id of SHEETS) if (id !== s && ui.isOpen(id)) ui.closeScreen(id);
    if (s === 'map' || SHEETS.includes(s)) {
        if (s === 'map' || !['reward', 'victory', 'defeat'].includes(s)) {
            ui.renderMap(G);
            if (!ui.isOpen('map')) ui.openScreen('map');
            view.visible = false;
        }
        audio.setMood('map');
    }
    if (s === 'reward') ui.renderReward(G);
    if (s === 'boon') ui.renderBoon(G);
    if (s === 'bossrelic') ui.renderBossRelic(G);
    if (s === 'dwelling') ui.renderDwelling(G);
    if (s === 'shop') ui.renderShop(G);
    if (s === 'camp') ui.renderCamp(G);
    if (s === 'event') ui.renderEvent(G);
    if (s === 'treasure') ui.renderTreasure(G);
    if (s === 'victory' || s === 'defeat') { ui.renderEnd(G, s, score(G)); clearSave(); }
    if (SHEETS.includes(s) && !ui.isOpen(s)) { ui.openScreen(s); audio.ui('open'); }
    if (G.pick) openPick();
    else if (ui.isOpen('deck') && pickOpen) { pickOpen = false; ui.closeScreen('deck'); }
    shownScreen = s;
}

let pickOpen = false;
function openPick() {
    ui.renderDeck(G, G.pick.why);
    pickOpen = true;
    ui.openScreen('deck');
}

// ------------------------------------------------------------------ menus and sheets
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
    new: () => startRun((Date.now() % 1e9) | 0),
    continue: () => {
        const g = loadGame();
        if (!g) { ui.toast('That save could not be read.'); return; }
        G = g; mode = 'run'; ui.closeAll(); shownScreen = null; battleShown = null;
        input.flush(); document.activeElement?.blur?.();
        syncScreen();
    },
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
});
menu('pause-menu', {
    resume: () => ui.closeScreen('pause'),
    howto: () => ui.openScreen('howto'),
    settings: () => ui.openScreen('settings'),
    quit: () => { saveGame(G); goTitle(); },
    abandon: () => { clearSave(); goTitle(); },
});

function pause() {
    if (mode !== 'run' || ui.isOpen('pause')) return;
    audio.ui('open');
    if (G) saveGame(G);
    ui.openScreen('pause');
}
click('btn-pause', pause);
click('btn-mappause', pause);
click('btn-begin', () => send({ t: 'begin' }));
click('btn-end', () => play.endTurn());
click('btn-draw', () => { if (G?.battle) { ui.renderDeck(G, 'draw', G.battle.draw); ui.openScreen('deck'); } });
click('btn-disc', () => { if (G?.battle) { ui.renderDeck(G, 'discard', G.battle.discard); ui.openScreen('deck'); } });
click('btn-army', () => { ui.renderArmy(G, { dismiss: true }); ui.openScreen('army'); });
click('btn-dw-army', () => { ui.renderArmy(G, { dismiss: true }); ui.openScreen('army'); });
click('btn-deck', () => { ui.renderDeck(G, 'view'); ui.openScreen('deck'); });
click('btn-deck-close', () => {
    if (G?.pick) { if (G.pick.free) return; send({ t: 'pickDeck', uid: null }); }
    pickOpen = false;
    ui.closeScreen('deck');
});
$('deck-grid').addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (!c || !G?.pick || !c.dataset.uid) return;
    const r = send({ t: 'pickDeck', uid: +c.dataset.uid });
    if (!r.ok) { ui.toast(r.err); audio.ui('deny'); return; }
    audio.ui('quill');
    pickOpen = false;
    ui.closeScreen('deck');
    syncScreen();
});
$('army-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dismiss]');
    if (!b) return;
    const k = CREATURES[G.army[+b.dataset.dismiss].key].name;
    if (!confirmTwice(b, `Dismiss the ${k}? Tap again.`)) return;
    send({ t: 'dismiss', i: +b.dataset.dismiss });
    ui.renderArmy(G, { dismiss: true });
    if (G.screen === 'dwelling') ui.renderDwelling(G);
});
function confirmTwice(b, msg) {
    if (b.dataset.armed) return true;
    b.dataset.armed = '1';
    b.textContent = 'Sure?';
    ui.toast(msg);
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Dismiss'; }, 2500);
    return false;
}
for (const el of [$('map-relics')]) el.addEventListener('click', (e) => { const b = e.target.closest('[data-relic]'); if (b) ui.showRelic(b.dataset.relic); });

// the map
$('map-svg').addEventListener('click', (e) => {
    const n = e.target.closest('.node.next');
    if (!n) return;
    audio.ui('quill');
    send({ t: 'go', id: n.dataset.node });
});
$('map-svg').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const n = e.target.closest('.node.next');
    if (n) { e.preventDefault(); send({ t: 'go', id: n.dataset.node }); }
});

// spoils
$('reward-body').addEventListener('click', (e) => {
    if (e.target.closest('#rw-relic')) { audio.ui('coin'); send({ t: 'takeRelic' }); ui.renderReward(G); return; }
    if (e.target.closest('#rw-skip')) { send({ t: 'pickCard', i: -1 }); ui.renderReward(G); return; }
    const c = e.target.closest('.card[data-i]');
    if (c) { audio.ui('quill'); send({ t: 'pickCard', i: +c.dataset.i }); ui.renderReward(G); }
});
click('btn-reward-go', () => send({ t: 'leave' }));
$('boon-list').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) send({ t: 'boon', i: +b.dataset.i }); });
$('bossrelic-list').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) send({ t: 'pickRelic', i: +b.dataset.i }); });
click('btn-bossrelic-skip', () => send({ t: 'pickRelic', i: -1 }));
// dwellings
$('dw-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recruit]');
    if (!b) return;
    const r = send({ t: 'recruit', key: b.dataset.recruit, n: +b.dataset.n });
    if (!r.ok) { ui.toast(r.err); audio.ui('deny'); return; }
    audio.ui('coin');
    ui.toast(`${b.dataset.n} ${CREATURES[b.dataset.recruit].name} join the legion.`);
    ui.renderDwelling(G);
});
click('btn-dw-leave', () => send({ t: 'leave' }));
// the scriptorium
$('shop-body').addEventListener('click', (e) => {
    const c = e.target.closest('.card[data-i]');
    const rl = e.target.closest('[data-buyrelic]');
    let r = null;
    if (c) r = send({ t: 'buyCard', i: +c.dataset.i });
    else if (rl) r = send({ t: 'buyRelic', i: +rl.dataset.buyrelic });
    else if (e.target.closest('#shop-remove')) { r = send({ t: 'removeCard' }); }
    if (!r) return;
    if (!r.ok) { ui.toast(r.err); audio.ui('deny'); return; }
    audio.ui('coin');
    if (G.screen === 'shop') ui.renderShop(G);
});
click('btn-shop-leave', () => send({ t: 'leave' }));
// the campfire
$('camp-body').addEventListener('click', (e) => {
    if (e.target.closest('#camp-rest')) { send({ t: 'rest' }); ui.renderCamp(G); }
    else if (e.target.closest('#camp-inscribe')) send({ t: 'inscribe' });
});
click('btn-camp-leave', () => send({ t: 'leave' }));
// encounters
$('ev-opts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const r = send({ t: 'choose', i: +b.dataset.i });
    if (!r.ok) { ui.toast(r.err); return; }
    ui.renderEvent(G);
});
click('btn-ev-go', () => send({ t: 'leave' }));
click('btn-treasure-go', () => send({ t: 'leave' }));
click('btn-victory-go', () => { clearSave(); goTitle(); });
click('btn-defeat-go', () => { clearSave(); goTitle(); });

// ------------------------------------------------------------------ the board and the hand
const canvas = $('view');
let downAt = null;
canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    downAt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
    if (!downAt || mode !== 'run' || G?.screen !== 'battle' || ui.anyScreen()) { downAt = null; return; }
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) { downAt = null; return; }
    downAt = null;
    const h = view.stage.pick(e.clientX, e.clientY);
    play.cur = null;
    if (h) play.onTile(h[0], h[1]); else play.cancel();
});
canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'run' || G?.screen !== 'battle' || e.pointerType === 'touch') return;
    const h = view.stage.pick(e.clientX, e.clientY);
    play.cur = null;
    play.onHover(h ? h[0] : null, h ? h[1] : null);
});
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (G?.screen === 'battle') play.cancel(); });
$('hand').addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (c && c.dataset.uid) play.onCard(+c.dataset.uid);
});
$('labels').addEventListener('click', () => {});

// ------------------------------------------------------------------ keys and the gamepad
function handlePresses() {
    input.poll();
    const p = input.next();             // one per frame: presses never merge
    if (!p) return;
    const k = p.key;
    if (ui.anyScreen() && ui.top() !== 'map') {
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape' || k === 'KeyP') {
            const top = ui.top();
            if (['howto', 'settings', 'pause', 'army', 'relicinfo'].includes(top) || (top === 'deck' && !G?.pick?.free)) { audio.ui('close'); if (top === 'deck') $('btn-deck-close').click(); else ui.closeTop(); }
        } else if (k === 'Enter' && p.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'run' || !G) return;
    if (G.screen === 'map') {
        if (k === 'Escape' || k === 'KeyP') { pause(); return; }
        const nodes = [...document.querySelectorAll('#map-svg .node.next')];
        if (!nodes.length) return;
        if (k.startsWith('Arrow')) {
            const i = nodes.indexOf(document.activeElement);
            nodes[(i + (k === 'ArrowLeft' || k === 'ArrowUp' ? nodes.length - 1 : 1) + (i < 0 ? 1 : 0)) % nodes.length].focus();
        } else if (k === 'Enter' && p.pad && document.activeElement?.dataset?.node) send({ t: 'go', id: document.activeElement.dataset.node });
        return;
    }
    if (G.screen === 'battle') {
        if (play.key(p)) return;
        if (k === 'Escape' || k === 'KeyP') pause();
    }
}

// ------------------------------------------------------------------ events and the loop
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    if (G.screen === 'battle' || ev.some((e) => e.type === 'won' || e.type === 'lost')) view.onEvents(ev);
    for (const e of ev) {
        if (e.type === 'relic' && RELICS[e.id]) ui.toast(`Relic: ${RELICS[e.id].name}`);
    }
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();
    if (mode === 'run' && G) {
        const B = G.battle;
        // the foe's turn: one move at a time, and only while the view is idle
        if (B && B.phase === 'enemy' && !B.over && !ui.isOpen('pause')) {
            acc += dt * FAST;
            let n = 0;
            while (acc >= STEP && n++ < 12 * FAST) { step(G, { hold: play.busy }, STEP); acc -= STEP; }
        } else acc = 0;
        if (bot && !ui.isOpen('pause')) runBot();
        // a decided battle: once the last blow has been shown, on to the spoils
        if (B && B.over && !play.busy && !finishing) {
            finishing = true;
            setTimeout(() => { if (G && G.battle === B) { send({ t: 'finish' }); } }, 500 / FAST);
        }
    }
    flushEvents();
    const wasBusy = view.busy;
    view.frame(dt, time);
    if (G?.screen === 'battle' && wasBusy !== view.busy) play.refresh();
}

let botT = 0;
function runBot() {
    botT -= 1;
    if (botT > 0 || play.busy) return;
    if (G.screen === 'battle' && G.battle.phase === 'enemy') return;
    if (G.screen === 'battle' && G.battle.over) return;
    const cmd = botCommand(G, bot);
    if (!cmd) return;
    if (cmd.t === 'pickDeck') { send(cmd); pickOpen = false; ui.closeScreen('deck'); syncScreen(); }
    else send(cmd);
    botT = 6;
}

document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'run') { if (G) saveGame(G); if (G?.screen === 'battle') pause(); } });
window.addEventListener('pagehide', () => { if (mode === 'run' && G) saveGame(G); });

goTitle();
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ql = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input, play,
        start(seed = 1) { startRun(seed); return G; },
        /** Jump straight into the first skirmish of a new run. */
        battle(seed = 1) { startRun(seed); send({ t: 'go', id: nextNodes(G)[0].id }); return G.battle; },
        autoplay(on = true) { bot = on ? makeBot({ seed: 5 }) : null; },
        /** The bot finishes the current battle at once; the view skips its animations. */
        ff() {
            const b = makeBot({ seed: 3 });
            let n = 0;
            while (G.screen === 'battle' && !G.battle.over && n++ < 2000) {
                if (G.battle.phase === 'enemy') { runEnemyPhase(G); continue; }
                act(G, botCommand(G, b));
            }
            G.events.length = 0;
            view.skip();
            play.refresh();
        },
        send,
        save: () => saveGame(G),
        hasSave,
        idle: () => !play.busy,
        /** Where a hex is on screen, in client px. */
        screenOf(c, r) { return view.stage.toScreen(hexPos(c, r, 0.1)); },
        stack: (id) => stackById(G.battle, id),
    };
}
