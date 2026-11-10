// The First Dragon Prince — entry point. Boots the UI, routes commands to the sim and its events to the UI, the
// visual novel layer and the audio, and moves between the title, the game, album replays and the ending.
// The game is turn-based: nothing in the sim runs on a clock. The frame loop only types text, drives auto mode,
// animates the embers and reads the keyboard and gamepad.
//
// ?debug=1 exposes window.__fdp for the dev/ harnesses; &fast=N speeds up typing and auto mode N times.

import { VERSION, MONTHS, SLOTS } from './config.js';
import { ART, preload } from './assets.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { VN } from './vn.js';
import { UI } from './ui.js';
import { Embers } from './embers.js';
import { loadSettings, saveSettings, listSlots, saveSlot, loadSlot, latestSlot, clearAll, loadAlbum, saveAlbum } from './save.js';
import { newGame, act, sceneLines } from './sim/game.js';
import { beginScene } from './sim/scene.js';
import { sceneDef } from './sim/scenes.js';
import { makeBot, botCommand, playThrough, ROUTES } from './sim/bot.js';
import { CAST } from './sim/data/cast.js';
import { ENDING, ENDINGS } from './sim/data/endings.js';
import { PLACE } from './sim/data/places.js';
import { REGION } from './sim/data/adventures.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings);
const input = new Input();
const vn = new VN({ audio, settings, fast: FAST });
const embers = new Embers($('embers'));
let album = loadAlbum();

let G = null;
let R = null;                  // an album replay's sandbox game
let mode = 'title';            // title | game | replay | ending
let advances = 0;
const seen = {};               // a count of every sim event drained, for the tests
let autoBot = null;            // ?debug=1: the bot playing through the real UI

const ui = new UI({
    audio, settings, vn,
    send: (cmd) => send(cmd),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s); },
    onAlbumReplay: (rec) => startReplay(rec),
    onSlot: (m, i) => slotPicked(m, i),
});
ui.onRender = () => {};
$('version').textContent = `v${VERSION}`;
$('title').querySelector('.title-art').style.backgroundImage = `url('${ART.title}')`;
preload([ART.title, ART.bg('city'), ART.bg('study')]);

// ------------------------------------------------------------------ layout
// The app is sized in px from visualViewport: on phones 100vh is taller than what is visible.
function layout() {
    const vv = window.visualViewport;
    const h = Math.round(vv ? vv.height : innerHeight);
    document.documentElement.style.setProperty('--app-h', h + 'px');
    embers.resize();
    hudHeight();
}
/** The HUD wraps onto two rows on narrow phones; the panel and toasts sit below whatever height it has. */
function hudHeight() {
    const hud = $('hud');
    const h = hud && !hud.hidden ? hud.offsetHeight : 0;
    document.documentElement.style.setProperty('--hud-h', (h || 8) + 'px');
}
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);
layout();

// ------------------------------------------------------------------ title
function refreshTitle() { $('btn-continue').hidden = latestSlot() < 0; }
refreshTitle();
ui.openScreen('title');
embers.on = true;

const unlock = () => { audio.init(); if (mode === 'title' && !audio.current) audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') {
        const n = album.names;
        if (n) { $('ng-name').value = n.name; $('ng-gname').value = n.gname; $('ng-title').value = n.title; }
        ui.openScreen('newgame');
    } else if (a === 'continue') {
        const g = loadSlot(latestSlot());
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else if (a === 'load') ui.openSlots('load', listSlots());
    else if (a === 'album') ui.openAlbum(album);
    else ui.openScreen(a);
});
$('ng-go').addEventListener('click', () => {
    audio.ui('click');
    const names = { name: $('ng-name').value.trim() || 'Cael', gname: $('ng-gname').value.trim() || 'Aldous', title: $('ng-title').value };
    album.names = names;
    saveAlbum(album);
    ui.closeScreen('newgame');
    startGame(newGame((Date.now() % 1e9) | 0, names));
});
$('menu-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('menu');
    else if (a === 'save') ui.openSlots('save', listSlots());
    else if (a === 'load') ui.openSlots('load', listSlots());
    else if (a === 'album') ui.openAlbum(album);
    else if (a === 'quit') { save(); ui.closeScreen('menu'); toTitle(); }
    else ui.openScreen(a);
});
$('set-delete').addEventListener('click', () => {
    if (!confirm('Delete every saved game and the album?')) return;
    clearAll();
    album = loadAlbum();
    refreshTitle();
    ui.toast('All saves deleted.');
});
$('btn-status').addEventListener('click', () => { audio.ui('click'); if (G) ui.openStatus(G); });
$('btn-album').addEventListener('click', () => { audio.ui('click'); ui.openAlbum(album); });
$('btn-menu').addEventListener('click', () => { audio.ui('click'); ui.openScreen('menu'); });
$('replay-exit').addEventListener('click', () => endReplay());
$('ending-album').addEventListener('click', () => { audio.ui('click'); ui.openAlbum(album); });
$('ending-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });
$('dlg').querySelector('.vn-ctrl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vn]');
    if (b) vnControl(b.dataset.vn);
});

function slotPicked(m, i) {
    if (m === 'save') {
        if (G && saveSlot(i, G)) { ui.toast(`Saved to slot ${i}.`); ui.openSlots('save', listSlots()); }
        else ui.toast('Saving is not available (storage is blocked).');
        return;
    }
    const g = loadSlot(i);
    if (!g) { ui.toast('That save could not be read.'); return; }
    for (const id of ['slots', 'menu']) ui.closeScreen(id);
    startGame(g);
}

function startGame(g) {
    G = g;
    R = null;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    input.flush();
    mode = 'game';
    embers.on = false;
    ui.G = G;
    ui.place = null; ui.sub = null; ui.results = []; ui.encounter = null; ui.planSlots = [];
    vn.log = [];
    vn.names = { name: G.name, gname: G.gname, you: G.title, partner: G.partner ? CAST[G.partner].name : '' };
    vn.lineKey = null;
    flushEvents();
    if (G.scene?.stage?.music) audio.play(G.scene.stage.music);
    if (G.over) { showEnding(); return; }
    refresh();
    save();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    G = null; R = null; autoBot = null;
    ui.G = null;
    vn.auto = false; vn.skipping = false;
    audio.stopVoice();
    $('panel').hidden = true; $('dlg').hidden = true; $('replay-bar').hidden = true;
    vn.clearStage();
    vn.setBg(null);
    ui.hud(null);
    refreshTitle();
    ui.openScreen('title');
    embers.on = true;
    audio.play('title');
}

// ------------------------------------------------------------------ commands
function send(cmd) {
    if (!G || mode !== 'game') return false;
    const ok = act(G, cmd);
    if (!ok) { audio.ui('no'); return false; }
    flushEvents();
    refresh();
    if (cmd.t !== 'advance' || ++advances % 8 === 0) save();
    return true;
}

function refresh() {
    if (mode === 'replay') { vn.render(R, R.age); musicFor(R); return; }
    if (!G || mode !== 'game') return;
    ui.hud(G);
    hudHeight();
    if (G.over) { showEnding(); return; }
    const what = ui.render(G);
    input.vnActive = what === 'scene';
    if (what === 'scene') vn.render(G, G.age);
    else { audio.stopVoice(); vn.auto = vn.auto && false; }
    musicFor(G, what);
}

function musicFor(g, what = 'scene') {
    if (g.scene) { if (g.scene.stage.music) audio.play(g.scene.stage.music); return; }
    if (what === 'result' || what === 'encounter') return;
    const phase = g.phase;
    if (phase === 'free') {
        const p = ui.place;
        audio.play({ castle: 'court', varre: 'court', spire: 'arcane', harbor: 'harbor', temple: 'holy', peaks: 'dragon', manor: 'manor', theatre: 'festival' }[p] || 'town');
    } else if (phase === 'plan' || phase === 'run') audio.play('manor');
    else if (phase === 'adventure') audio.play(g.adv && g.adv.k >= 3 ? 'tension' : g.adv?.region === 'peaks' ? 'dragon' : 'epic');
    else if (phase === 'festival') audio.play('festival');
    else if (phase === 'starfall') audio.play('romance');
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    audio.onEvents(ev);
    let albumDirty = false;
    for (const e of ev) {
        switch (e.type) {
            case 'period': ui.results.push(e); break;
            case 'encounter': ui.encounter = e; break;
            case 'cg': if (!album.cgs.includes(e.id)) { album.cgs.push(e.id); albumDirty = true; } break;
            case 'sceneStart':
                if (e.kind === 'story' || e.kind === 'heart' || e.kind === 'ending') showSceneTitle(e.title);
                break;
            case 'sceneEnd':
                $('scene-title').hidden = true;
                if (e.album) { album.scenes[UI.albumKey(e.id, e.args)] = { id: e.id, args: e.args, title: e.title, kind: e.kind, age: e.age }; albumDirty = true; }
                break;
            case 'month': if (e.month === 1 && e.age > 10) ui.toast(`🎂 ${G.name} turns ${e.age}.`); else ui.toast(`${MONTHS[e.month - 1]}, age ${e.age}`); break;
            case 'stipend': ui.toast(`Royal stipend: +${e.gold} 🪙`); break;
            case 'heart': ui.toast(`♥ A new moment with ${CAST[e.who].name} (${e.n}/4)`, 'love'); break;
            case 'betrothed':
                vn.names.partner = CAST[e.id].name;
                ui.toast(`💍 ${G.name} and ${CAST[e.id].name} are promised to each other.`, 'love');
                break;
            case 'gift': if (e.taste === 'loves') ui.toast(`${CAST[e.who].name} loved it!`, 'love'); break;
            case 'use': ui.toast('Used.'); break;
            case 'accept': ui.toast('Quest accepted. Schedule it in the planner.'); break;
            case 'phase': if (e.phase === 'plan') ui.place = null; break;
            case 'ending':
                if (!album.endings.includes(e.id)) { album.endings.push(e.id); albumDirty = true; }
                break;
        }
    }
    if (albumDirty) saveAlbum(album);
}

function showSceneTitle(t) {
    const el = $('scene-title');
    el.hidden = false;
    el.textContent = t;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(showSceneTitle.tm);
    showSceneTitle.tm = setTimeout(() => { el.hidden = true; }, 2600 / FAST);
}

function showEnding() {
    mode = 'ending';
    const E = ENDING[G.ending.id];
    $('panel').hidden = true; $('dlg').hidden = true;
    vn.clearStage();
    vn.setBg(ART.cg(E.cg));
    vn.dim(false);
    $('ending-title').textContent = E.title;
    $('ending-sub').textContent = E.bad ? 'Not every story ends well. Try again: the prince deserves it.'
        : G.ending.partner ? `With ${CAST[G.ending.partner].name} at his side.` : 'And whatever else he became, he was yours.';
    $('ending-count').textContent = `${album.endings.length} of ${ENDINGS.length} endings found`;
    ui.hud(null);
    embers.on = true;
    ui.openScreen('ending');
    save();
}

// ------------------------------------------------------------------ album replays
function startReplay(rec) {
    if (!rec) return;
    const names = G ? { name: G.name, gname: G.gname, title: G.title } : (album.names || {});
    const g = newGame(1, names);
    g.scene = null; g.queue = []; g.events = [];
    g.age = rec.age || 16;
    const def = sceneDef(rec.id, rec.args);
    if (rec.args?.partner) g.partner = rec.args.partner;
    beginScene(g, { id: rec.id, args: rec.args, title: def.title, kind: def.kind, album: false }, def.lines, { replay: true });
    R = g;
    R.prevMode = mode;
    mode = 'replay';
    for (const id of [...ui.stack]) ui.closeScreen(id);
    $('panel').hidden = true;
    $('replay-bar').hidden = false;
    ui.hud(null);
    embers.on = false;
    vn.log = [];
    vn.lineKey = null;
    vn.names = { name: names.name || 'Cael', gname: names.gname || 'Aldous', you: names.title || 'Father', partner: '' };
    input.vnActive = true;
    drainReplay();
    refresh();
}

function drainReplay() {
    const ev = R.events.splice(0);
    audio.onEvents(ev);
}

function replayCmd(cmd) {
    act(R, cmd);
    drainReplay();
    if (!R.scene) { endReplay(); return; }
    refresh();
}

function endReplay() {
    const back = R?.prevMode;
    R = null;
    audio.stopVoice();
    vn.auto = false; vn.skipping = false;
    $('replay-bar').hidden = true;
    $('dlg').hidden = true;
    vn.clearStage();
    if (back === 'game' && G) { mode = 'game'; vn.names = { name: G.name, gname: G.gname, you: G.title, partner: G.partner ? CAST[G.partner].name : '' }; vn.lineKey = null; refresh(); }
    else if (back === 'ending' && G) showEnding();
    else toTitle();
    ui.openAlbum(album);
}

// ------------------------------------------------------------------ the VN box
vn.onAdvance = () => { if (mode === 'replay') replayCmd({ t: 'advance' }); else send({ t: 'advance' }); };
vn.onChoose = (i) => { if (mode === 'replay') replayCmd({ t: 'choose', i }); else send({ t: 'choose', i }); };

function vnControl(k) {
    audio.ui('click');
    if (k === 'auto') { vn.auto = !vn.auto; vn.wait = 0; }
    else if (k === 'skip') { if (mode === 'replay') replayCmd({ t: 'skip' }); else send({ t: 'skip' }); }
    else if (k === 'log') ui.openLog(vn.log);
    else if (k === 'menu') { if (mode === 'replay') endReplay(); else ui.openScreen('menu'); }
    for (const b of $('dlg').querySelectorAll('[data-vn]')) b.classList.toggle('on', b.dataset.vn === 'auto' && vn.auto);
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const p = input.next();
    if (!p) return;
    const k = p.key;
    const top = ui.top();
    const onButton = p.target === 'BUTTON' && !p.pad;
    if (top) {
        if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
        else if (k === 'Escape') { if (!$('viewer').hidden) $('viewer').hidden = true; else ui.closeTop(); }
        else if ((k === 'Enter' || k === 'KeyZ') && p.pad) document.activeElement?.click?.();
        return;
    }
    if (!$('viewer').hidden) { $('viewer').hidden = true; return; }
    const inScene = !$('dlg').hidden;
    if (inScene) {
        if ((k === 'Enter' || k === 'Space' || k === 'KeyZ') && !onButton) vn.tap();
        else if (/^Digit[1-6]$/.test(k)) vn.choose(+k.slice(5) - 1);
        else if (k === 'KeyA') vnControl('auto');
        else if (k === 'Tab') vnControl('skip');
        else if (k === 'KeyL') vnControl('log');
        else if (k === 'Escape') vnControl('menu');
        else if (k === 'ArrowDown' || k === 'ArrowUp') ui.moveFocus(k === 'ArrowDown' ? 1 : -1);
        return;
    }
    if (mode !== 'game') return;
    if (k === 'ArrowDown' || k === 'ArrowRight') ui.moveFocus(1);
    else if (k === 'ArrowUp' || k === 'ArrowLeft') ui.moveFocus(-1);
    else if (k === 'Escape') { if (ui.place) { ui.place = null; ui.refresh(); } else ui.openScreen('menu'); }
    else if (k === 'KeyS') ui.openStatus(G);
    else if ((k === 'Enter' || k === 'KeyZ') && p.pad) document.activeElement?.click?.();
}

// ------------------------------------------------------------------ frame loop
let last = performance.now();
let botTimer = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    handlePresses();
    vn.tick(dt);
    embers.update(dt);
    if (autoBot && mode === 'game' && !ui.top()) {
        botTimer += dt;
        if (botTimer >= autoBot.every) { botTimer = 0; botStep(); }
    }
}

function botStep() {
    if (ui.encounter) { ui.encounter = null; refresh(); return; }
    if (ui.results.length) { ui.results.shift(); refresh(); return; }
    const cmd = botCommand(G, autoBot.bot);
    if (cmd) send(cmd);
}

function save() { if (G && mode !== 'replay') saveSlot(0, G); }
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__fdp = {
        get G() { return G; },
        get R() { return R; },
        get mode() { return mode; },
        get album() { return album; },
        seen, ui, vn, audio, input, VERSION, ROUTES: Object.keys(ROUTES),
        /** A new game with these names, straight into the prologue. */
        start(seed = 1, names = {}) { startGame(newGame(seed, { name: 'Cael', gname: 'Aldous', title: 'Father', ...names })); return G.phase; },
        send,
        /** Finish the current scene (and any queued after it), taking the first choice each time. */
        skipScenes() {
            let n = 0;
            while (G.scene && n++ < 500) {
                const c = G.scene.cur;
                act(G, c?.choice ? { t: 'choose', i: c.choice[0].i } : { t: 'skip' });
            }
            flushEvents(); refresh(); return !G.scene;
        },
        /** Let the bot play through the real UI, one command every `every` seconds. */
        autoplay(route = 'king', every = 0.05) { autoBot = route ? { bot: makeBot({ route, seed: 3 }), every } : null; return !!autoBot; },
        /** The bot plays n months in a blink (no rendering in between). */
        months(n = 1, route = 'king') {
            const bot = makeBot({ route, seed: 5 });
            const end = G.turn + n;
            let guard = 0;
            while (!G.over && (G.turn < end || G.scene || G.phase !== 'free') && guard++ < 50000) act(G, botCommand(G, bot));
            flushEvents(); ui.results = []; ui.encounter = null; $('toasts').innerHTML = '';
            refresh(); return { age: G.age, month: G.month, phase: G.phase };
        },
        /** The bot plays to the ending scene (left playing). */
        toEnding(route = 'king') {
            const bot = makeBot({ route, seed: 5 });
            let guard = 0;
            while (!(G.phase === 'ending') && !G.over && guard++ < 80000) act(G, botCommand(G, bot));
            flushEvents(); ui.results = []; ui.encounter = null; $('toasts').innerHTML = '';
            refresh(); return G.ending;
        },
        playThrough: (route = 'king') => { const r = playThrough(G, makeBot({ route, seed: 5 })); flushEvents(); ui.results = []; ui.encounter = null; refresh(); return r; },
        replay(key) { const rec = album.scenes[key]; if (rec) startReplay(rec); return !!rec; },
        unlockAll() {
            for (const [k, id, args, title] of ui.albumScenes()) album.scenes[k] = { id, args, title, kind: 'story', age: 16 };
            album.endings = ENDINGS.map((e) => e.id);
            saveAlbum(album);
        },
        get busy() { return false; },
        slots: listSlots, save,
        place(id) { ui.place = id; ui.sub = null; refresh(); return !!PLACE[id]; },
    };
}
