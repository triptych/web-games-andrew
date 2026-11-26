// The Last Apprentice — entry point. Boots the stage, the ward view, the dialogue box and the UI, routes commands
// to the sim and its events to everything that answers them, and moves between the title, the story and the end.
// The story is turn-based: nothing in the sim runs on a clock. The frame loop only types text, drives auto and
// skip, animates the stage (colour ripples, particles, the ward-lock) and reads the keyboard and gamepad.
//
// ?debug=1 exposes window.__tla for the dev/ harnesses; &fast=N speeds up typing, auto mode and the ward's
// opening blaze N times.

import { VERSION, SAVE_KEY } from './config.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';
import { ART, preload } from './assets.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { VN } from './vn.js';
import { UI, chapterLabel } from './ui.js';
import { Stage } from './view/stage.js';
import { WardView } from './view/ward.js';
import { loadSettings, saveSettings, listSlots, saveSlot, loadSlot, latestSlot, clearAll, loadAlbum, saveAlbum } from './save.js';
import { newGame, act, huesRestored } from './sim/game.js';
import { hint as wardHint } from './sim/ward.js';
import { makeBot, botCommand } from './sim/bot.js';
import { CAST } from './sim/data/cast.js';
import { CHAPTERS, HUES } from './sim/data/chapters.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
// a first visit follows the system's reduced-motion setting; after that the game's own setting wins
try { if (!localStorage.getItem('last-apprentice.v1.settings') && matchMedia('(prefers-reduced-motion: reduce)').matches) settings.motion = 'reduced'; } catch { /* blocked */ }
const audio = new Audio();
audio.setVolumes(settings);
const input = new Input();
const stage = new Stage($('stage'), $('fx'), { reduceMotion: settings.motion === 'reduced' });
const wardView = new WardView($('ward'), { onTurn: (ring, dir) => send({ t: 'turn', ring, dir }), reduceMotion: settings.motion === 'reduced' });
const vn = new VN({ audio, settings, fast: FAST });
let album = loadAlbum();

let G = null;
let mode = 'title';            // title | game | ending
let advances = 0;
let holdUntil = 0;             // a ward's opening blaze plays out before the story goes on
let now = 0;
const seen = {};               // a count of every sim event drained, for the tests
let autoBot = null;            // ?debug=1: the bot playing through the real UI

const ui = new UI({
    audio, settings,
    send: (cmd) => send(cmd),
    onSettings: (s, key) => {
        saveSettings(s);
        audio.setVolumes(s);
        if (key === 'motion') { stage.reduce = wardView.reduce = s.motion === 'reduced'; }
        if (key === 'puzzle') refresh();
    },
    onSlot: (m, i) => slotPicked(m, i),
});
ui.album = album;
$('version').textContent = `v${VERSION}`;

// ------------------------------------------------------------------ layout
// The app is sized in px from visualViewport: on phones 100vh is taller than what is visible.
function layout() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : innerWidth), h = Math.round(vv ? vv.height : innerHeight);
    document.documentElement.style.setProperty('--app-h', h + 'px');
    document.documentElement.style.setProperty('--app-w', w + 'px');
    stage.resize(w, h);
    wardView.resize(w, h);
    if (G?.phase === 'map') { stage.setBg('map', mapFit()); ui.placePins(G, stage); }
}
const mapFit = () => (stage.cssW / stage.cssH < 1.25 ? 'contain' : 'cover');
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);
layout();

// ------------------------------------------------------------------ title
function showTitle() {
    stage.setBg(ART.title, 'cover', true);
    stage.clear();
    stage.setHues(stage.titleHues(album.done), true);
    $('btn-continue').hidden = latestSlot() < 0;
    ui.openScreen('title');
}
showTitle();
// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-140'.
// The save is everything stored under its save key (settings stay on the device); loading writes it back and reloads.
const cloud = makeCloud({ game: 'game-140' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'game') save(); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const slots = Object.keys(snap || {}).filter((k) => /\.slot\d+$/.test(k)).length; return `The Last Apprentice · ${slots} save slot${slots === 1 ? '' : 's'}`; },
    hasGame: () => (mode === 'game') || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();
preload([ART.bg('ravenmoor'), ART.bg('library'), ART.cg('book')]);

const unlock = () => { audio.init(); if (mode === 'title' && !audio.current) audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') {
        if (album.name) $('ng-name').value = album.name;
        ui.openScreen('newgame');
    } else if (a === 'continue') {
        const g = loadSlot(latestSlot());
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else if (a === 'load') ui.openSlots('load', listSlots());
    else if (a === 'gallery') { ui.journalTab = 'gallery'; ui.openJournal(null, album); }
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
$('ng-go').addEventListener('click', () => {
    audio.ui('click');
    const name = $('ng-name').value.trim().replace(/[{}<>]/g, '') || 'Wren';
    album.name = name;
    saveAlbum(album);
    ui.closeScreen('newgame');
    startGame(newGame((Date.now() % 1e9) | 0, name));
});
$('ng-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('ng-go').click(); });
$('menu-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('menu');
    else if (a === 'journal') { ui.closeScreen('menu'); openJournal(); }
    else if (a === 'save') ui.openSlots('save', listSlots());
    else if (a === 'load') ui.openSlots('load', listSlots());
    else if (a === 'quit') { save(); ui.closeScreen('menu'); cloudUI.autosave({ force: true }); toTitle(); }
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
$('set-delete').addEventListener('click', () => {
    if (!confirm('Delete every saved story and the gallery?')) return;
    clearAll();
    album = loadAlbum();
    ui.album = album;
    $('btn-continue').hidden = true;
    ui.toast('All saves deleted.');
});
$('btn-journal').addEventListener('click', () => { audio.ui('click'); openJournal(); });
$('btn-menu').addEventListener('click', () => { audio.ui('click'); ui.openScreen('menu'); });
$('ending-gallery').addEventListener('click', () => { audio.ui('click'); ui.journalTab = 'gallery'; ui.openJournal(null, album); });
$('ending-title-btn').addEventListener('click', () => { audio.ui('click'); toTitle(); });
$('dlg').querySelector('.vn-ctrl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vn]');
    if (b) vnControl(b.dataset.vn);
});
// a tap on the painted stage itself also moves the story on
$('stage').addEventListener('click', () => { if (mode === 'game' && vn.open && !ui.top()) vn.tap(); });

// the ward-lock's buttons
$('ward-cw').addEventListener('click', () => wardTurn(1));
$('ward-ccw').addEventListener('click', () => wardTurn(-1));
$('ward-sel').addEventListener('click', () => { audio.ui('click'); wardView.select(1); });
$('ward-hint').addEventListener('click', () => { if (wardView.active) send({ t: 'hint' }); });
$('ward-unseal').addEventListener('click', () => { if (wardView.active) { audio.ui('click'); send({ t: 'unseal' }); } });
function wardTurn(dir) { if (wardView.active) send({ t: 'turn', ring: wardView.sel, dir }); }

function openJournal() { if (G) { ui.journalTab = ui.journalTab === 'gallery' ? 'wards' : ui.journalTab; ui.openJournal(G, album); } }

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
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    input.flush();
    mode = 'game';
    holdUntil = 0;
    autoBot = null;
    ui.G = G;
    vn.log = [];
    vn.name = G.name;
    vn.lineKey = null;
    vn.auto = false; vn.skipping = false;
    stage.setHues(G.hues, true);
    stage.clear();
    wardView.hide();
    flushEvents();              // a new story's first events: the chapter card and the music
    if (G.phase === 'ward' && G.ward) wardView.show(G.ward);
    if (G.phase === 'end') { showEnding(); return; }
    audio.play(G.phase === 'ward' ? 'ward' : G.phase === 'map' ? mapMusic() : G.stage?.music || 'grey');
    refresh();
    save();
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    G = null; autoBot = null;
    ui.G = null;
    vn.auto = false; vn.skipping = false;
    audio.stopVoice();
    vn.hide();
    wardView.hide();
    for (const id of ['ward', 'ward-ui', 'camp-ui', 'map-ui', 'map-pins', 'busy', 'chapter-card']) $(id).hidden = true;
    ui.hud(null);
    document.documentElement.style.setProperty('--warm', '0');
    showTitle();
    audio.play('title');
}

// ------------------------------------------------------------------ commands
function send(cmd) {
    if (!G || mode !== 'game' || holding()) return false;
    const ok = act(G, cmd);
    if (!ok) { audio.ui('no'); return false; }
    flushEvents();
    refresh();
    if (cmd.t !== 'advance' || ++advances % 8 === 0) save();
    return true;
}

const holding = () => now < holdUntil;
const mapMusic = () => (huesRestored(G) < 4 ? 'grey' : 'bloom');

/** Put the stage, the dialogue box and the panels in step with G. */
function refresh() {
    if (!G || mode !== 'game') return;
    ui.hud(G);
    if (holding()) {
        $('busy').hidden = false;
        vn.hide();
        for (const id of ['camp-ui', 'map-ui', 'map-pins', 'ward-ui']) $(id).hidden = true;
        return;
    }
    $('busy').hidden = true;
    const ph = G.phase;
    if (ph !== 'map') stage.setBg(G.stage?.bg || null);
    // the ward-lock
    const inWard = ph === 'ward' && !!G.ward;
    if (inWard && wardView.w !== G.ward) wardView.show(G.ward);
    if (!inWard && wardView.w && wardView.open === 0) wardView.hide();
    $('ward').hidden = !inWard;
    wardView.assist = inWard && settings.puzzle === 'story';
    wardView.assistHint = wardView.assist ? wardHint(G.ward) : null;
    ui.ward(G, wardView);
    if (inWard) {
        stage.setActors([]);
        stage.setCg('ward-' + G.ward.id);
    }
    if (ph === 'scene' && G.scene) {
        const st = G.stage;
        stage.setCg(st.cg);
        stage.setActors(st.actors, G.scene.cur?.who);
        vn.render(G);
        input.vnActive = true;
    } else {
        vn.hide();
        input.vnActive = false;
        if (ph !== 'scene') audio.stopVoice();
    }
    if (ph === 'camp') { stage.setActors([]); stage.setCg(null); }
    if (ph === 'map') {
        stage.setActors([]); stage.setCg(null);
        stage.setBg('map', mapFit());
    }
    ui.camp(G);
    ui.map(G, stage);
    if (ph === 'end' && mode === 'game') showEnding();
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
            case 'cg': if (!album.cgs.includes(e.id)) { album.cgs.push(e.id); albumDirty = true; } break;
            case 'chapter': chapterCard(e.ch); break;
            case 'wardStart': wardView.show(G.ward); break;
            case 'hint': wardView.hint(e); break;
            case 'wardOpen':
                wardView.opened(e.hue);
                holdUntil = now + 3.2 / FAST;
                vn.skipping = false;
                if (!e.unsealed && e.moves <= e.par) ui.toast(`Opened in ${e.moves} turns: as few as it can be done.`, 'gold');
                break;
            case 'hue': {
                stage.setHues(G.hues);
                stage.ripple(e.hue);
                const H = HUES[e.hue];
                setTimeout(() => ui.toast(`<b style="color:${H.css}">${H.name}</b> returns to the world.`, 'hue'), 900 / FAST);
                break;
            }
            case 'bond': {
                const C = CAST[e.who];
                if (C) ui.toast(`<b style="color:${G.hues[C.hue] ? C.color : '#d4d6df'}">${C.name.split(' ')[0]}</b> will remember that.`);
                break;
            }
            case 'hope': ui.toast('<span class="spark">✦</span> Hope', 'hope'); break;
            case 'map': audio.play(mapMusic()); break;
            case 'end':
                album.done = true; albumDirty = true;
                break;
        }
    }
    if (albumDirty) saveAlbum(album);
}

function chapterCard(ch) {
    const el = $('chapter-card');
    const c = CHAPTERS[ch];
    $('cc-num').textContent = chapterLabel(ch);
    $('cc-title').textContent = c.title;
    $('cc-place').textContent = c.place;
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(chapterCard.tm);
    chapterCard.tm = setTimeout(() => { el.hidden = true; }, 4200 / FAST);
}

function showEnding() {
    mode = 'ending';
    vn.hide();
    audio.stopVoice();
    for (const id of ['ward', 'ward-ui', 'camp-ui', 'map-ui', 'map-pins', 'busy']) $(id).hidden = true;
    ui.hud(null);
    stage.setHues([1, 1, 1, 1, 1, 1, 1]);
    stage.clear();
    stage.setBg(ART.cg('last-page'));
    album.done = true;
    for (const id of G.seenCg) if (!album.cgs.includes(id)) album.cgs.push(id);
    saveAlbum(album);
    save();
    ui.ending(G, album);
}

// ------------------------------------------------------------------ the dialogue box
vn.onAdvance = () => send({ t: 'advance' });
vn.onChoose = (i) => send({ t: 'choose', i });

function vnControl(k) {
    audio.ui('click');
    if (k === 'auto') { vn.auto = !vn.auto; vn.wait = 0; vn.skipping = false; }
    else if (k === 'skip') { vn.skipping = !vn.skipping; vn.auto = false; }
    else if (k === 'log') ui.openLog(vn.log);
    else if (k === 'menu') ui.openScreen('menu');
    for (const b of $('dlg').querySelectorAll('[data-vn]')) b.classList.toggle('on', (b.dataset.vn === 'auto' && vn.auto) || (b.dataset.vn === 'skip' && vn.skipping));
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const p = input.next();
    if (!p) return;
    const k = p.key;
    const top = ui.top();
    const onButton = p.target === 'BUTTON' && !p.pad;
    if (!$('viewer').hidden) { $('viewer').hidden = true; return; }
    if (top) {
        if (k === 'ArrowDown' || k === 'ArrowRight') moveFocus(1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') moveFocus(-1);
        else if (k === 'Escape') ui.closeTop();
        else if ((k === 'Enter' || k === 'KeyZ') && p.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'game' || holding()) return;
    if (k === 'KeyJ') { openJournal(); return; }
    if (k === 'Escape') { ui.openScreen('menu'); return; }
    if (vn.open) {
        if ((k === 'Enter' || k === 'Space' || k === 'KeyZ') && !onButton) vn.tap();
        else if (/^Digit[1-6]$/.test(k)) vn.choose(+k.slice(5) - 1);
        else if (k === 'KeyA') vnControl('auto');
        else if (k === 'Tab') vnControl('skip');
        else if (k === 'KeyL') vnControl('log');
        else if (k === 'ArrowDown' || k === 'ArrowUp') moveFocus(k === 'ArrowDown' ? 1 : -1);
        else if ((k === 'Enter' || k === 'KeyZ') && p.pad) document.activeElement?.click?.();
        return;
    }
    if (G.phase === 'ward' && wardView.active) {
        if (k === 'ArrowUp') wardView.select(-1);
        else if (k === 'ArrowDown') wardView.select(1);
        else if (k === 'ArrowRight' || k === 'KeyD') wardTurn(1);
        else if (k === 'ArrowLeft' || k === 'KeyA') wardTurn(-1);
        else if (k === 'KeyH') send({ t: 'hint' });
        else if (k === 'KeyU') send({ t: 'unseal' });
        return;
    }
    if (k === 'ArrowDown' || k === 'ArrowRight') moveFocus(1);
    else if (k === 'ArrowUp' || k === 'ArrowLeft') moveFocus(-1);
    else if ((k === 'Enter' || k === 'KeyZ') && p.pad) document.activeElement?.click?.();
}

/** Move keyboard focus through the buttons of whatever is in front. */
function moveFocus(d) {
    const top = ui.top();
    const scope = top ? $(top) : vn.open ? $('dlg-choices') : G?.phase === 'camp' ? $('camp-ui') : G?.phase === 'map' ? $('map-ui') : document.body;
    const list = [...scope.querySelectorAll('button:not([disabled]):not([hidden]), input, select')].filter((b) => b.offsetParent !== null);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const n = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length;
    list[n].focus();
}

// ------------------------------------------------------------------ frame loop
let last = performance.now();
let botTimer = 0;
let wasHolding = false;
function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    now += dt;
    handlePresses();
    vn.tick(dt);
    stage.frame(dt);
    wardView.frame(dt * (wardView.open > 0 ? FAST : 1), G ? G.hues : [0, 0, 0, 0, 0, 0, 0]);
    if (G && mode === 'game') {
        if (G.phase === 'ward') ui.ward(G, wardView);
        const h = holding();
        if (wasHolding && !h) refresh();
        wasHolding = h;
    }
    if (autoBot && mode === 'game' && !ui.top() && !holding()) {
        botTimer += dt;
        if (botTimer >= autoBot.every) { botTimer = 0; const cmd = botCommand(G, autoBot.bot); if (cmd) send(cmd); }
    }
}

function save() { if (G && mode === 'game') saveSlot(0, G); }
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', () => { save(); cloudUI.autosave({ keepalive: true }); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    /** Let the bot play (no rendering in between) until `done(G)` holds; events are counted, not shown. */
    const fastForward = (done, policy = 'kind') => {
        const bot = makeBot({ policy, seed: 5 });
        let guard = 0;
        while (G && !done(G) && G.phase !== 'end' && guard++ < 40000) {
            const cmd = botCommand(G, bot);
            if (!cmd || !act(G, cmd)) break;
            for (const e of G.events) {
                seen[e.type] = (seen[e.type] || 0) + 1;
                if (e.type === 'cg' && !album.cgs.includes(e.id)) album.cgs.push(e.id);
            }
            G.events.length = 0;
        }
        holdUntil = 0;
        $('chapter-card').hidden = true;
        stage.setHues(G.hues, true);
        wardView.hide();
        if (G.phase === 'ward') { wardView.show(G.ward); audio.play('ward'); }
        else if (G.stage?.music) audio.play(G.stage.music);
        vn.lineKey = null;
        refresh();
        return { phase: G.phase, ch: G.ch, scene: G.scene?.id || null, hues: huesRestored(G) };
    };
    window.__tla = {
        get G() { return G; },
        get mode() { return mode; },
        get album() { return album; },
        get holding() { return holding(); },
        get webgl() { return stage.webgl; },
        seen, ui, vn, audio, input, stage, wardView, VERSION,
        start(seed = 1, name = 'Wren') { startGame(newGame(seed, name)); return G.phase; },
        send,
        /** The bot plays until the given phase (ward, camp, map, end) or chapter. */
        toPhase: (phase, policy) => fastForward((g) => g.phase === phase, policy),
        toChapter: (ch, policy) => fastForward((g) => g.ch >= ch, policy),
        toScene: (id, policy) => fastForward((g) => g.scene?.id === id, policy),
        /** Let the bot play through the real UI, one command every `every` seconds. */
        autoplay(policy = 'kind', every = 0.05) { autoBot = policy ? { bot: makeBot({ policy, seed: 3 }), every } : null; return !!autoBot; },
        slots: listSlots, save,
        get busy() { return holding(); },
    };
}
