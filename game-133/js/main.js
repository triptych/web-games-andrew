// Lanternhall — entry point. Boots the UI, sends commands to the sim and its events to the UI, the visual novel
// layer and the audio, and moves between the title, the game and the ending. Nearly everything in the sim is
// turn-based; the frame loop only feeds real time to step() (the tavern till and the Stamp Rush sand-glass),
// types text and reads the keyboard.
//
// ?debug=1 exposes window.__lh for the dev/ harnesses; &fast=N speeds up typing, auto mode and the till N times.

import { DAYS, JOBS } from './config.js';
import { ART, CG_FILES, preload } from './assets.js';
import { Audio } from './audio.js';
import { VN } from './vn.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, listSlots, saveSlot, loadSlot, latestSlot, clearSlot, clearAll, loadAlbum, saveAlbum } from './save.js';
import { newGame, act, step, chapterOf, advName } from './sim/game.js';
import { makeBot, botCommand } from './sim/bot.js';
import { CAST } from './sim/data/cast.js';
import { RANKS } from './config.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings);
const vn = new VN({ audio, settings, fast: FAST });
let album = loadAlbum();

let G = null;
let mode = 'title';            // title | game | ending
let last = performance.now();
let saveT = 0;
let swallow = 0;               // real seconds during which a key or tap does not advance the story (after a screen closes)
const seen = {};               // a count of every sim event drained, for the tests

const ui = new UI({ audio, settings, vn, send: (cmd) => send(cmd), onSettings: (s) => { saveSettings(s); audio.setVolumes(s); } });
ui.mini.speed = FAST;
preload([ART.title, ART.bg('hall'), ART.bg('street'), ART.bg('office')]);

// ------------------------------------------------------------------ layout
// The app is sized in px from visualViewport: on phones 100vh is taller than what is visible.
function layout() {
    const vv = window.visualViewport;
    document.documentElement.style.setProperty('--app-h', Math.round(vv ? vv.height : innerHeight) + 'px');
    const hud = $('hud');
    document.documentElement.style.setProperty('--hud-h', ((hud && !hud.hidden ? hud.offsetHeight : 0) || 52) + 'px');
}
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);
layout();

// ------------------------------------------------------------------ title and menus
function refreshTitle() { $('btn-continue').hidden = latestSlot() < 0; }
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); if (mode === 'title' && !audio.want) audio.play('title'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

let gender = album.who?.gender || 'n';
function drawGender() { for (const b of $('ng-gender').children) { b.classList.toggle('on', b.dataset.g === gender); b.setAttribute('aria-checked', b.dataset.g === gender); } }
$('ng-gender').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) { gender = b.dataset.g; audio.ui('click'); drawGender(); } });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') { if (album.who) $('ng-name').value = album.who.name; drawGender(); ui.openScreen('newgame'); }
    else if (a === 'continue') { const g = loadSlot(latestSlot()); if (g) startGame(g); else ui.toast('That save could not be read.'); }
    else if (a === 'load') ui.openSlots('load', listSlots(), slotPicked);
    else if (a === 'album') ui.openAlbum(album);
    else ui.openScreen(a);
});
$('ng-go').addEventListener('click', () => {
    audio.ui('click');
    const who = { name: $('ng-name').value.trim() || 'Robin', gender };
    album.who = who;
    saveAlbum(album);
    startGame(newGame((Date.now() % 1e9) | 0, who));
});
$('menu-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('menu');
    else if (a === 'save') ui.openSlots('save', listSlots(), slotPicked);
    else if (a === 'load') ui.openSlots('load', listSlots(), slotPicked);
    else if (a === 'album') ui.openAlbum(album);
    else if (a === 'quit') { autosave(); toTitle(); }
    else ui.openScreen(a);
});
$('set-delete').addEventListener('click', () => {
    if (!confirm('Delete every saved game and the endings you have found?')) return;
    clearAll();
    album = loadAlbum();
    refreshTitle();
    ui.toast('All saves deleted.');
});
$('btn-menu').addEventListener('click', () => { audio.ui('open'); ui.openScreen('menu'); });
$('btn-handbook').addEventListener('click', () => { audio.ui('open'); ui.action('handbook'); });
$('ending-album').addEventListener('click', () => { audio.ui('click'); ui.openAlbum(album); });
$('ending-again').addEventListener('click', () => { audio.ui('click'); toTitle(); });
$('dlg').querySelector('.vn-ctrl').addEventListener('click', (e) => { const b = e.target.closest('[data-vn]'); if (b) vnControl(b.dataset.vn); });

function slotPicked(m, i) {
    if (m === 'save') {
        if (!G || G.over) return;
        ui.toast(saveSlot(i, G) ? `Saved to slot ${i}.` : 'Could not save: storage is blocked.');
        ui.closeScreen('slots');
    } else {
        const g = loadSlot(i);
        if (g) startGame(g); else ui.toast('That save could not be read.');
    }
}

function autosave() { return !!G && !G.over && saveSlot(0, G); }

function startGame(g) {
    G = g;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'game';
    vn.who = { name: G.name, gender: G.gender, partner: G.partner ? CAST[G.partner].name.split(' ')[0] : '' };
    vn.log.length = 0;
    vn.auto = false; vn.skipping = false;
    vnButtons();
    ui.tab = 'desk'; ui.lastHtml = '';
    G.events.length = 0;
    hubMusic();
    refresh();
    layout();
    autosave();
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    G = null;
    $('hud').hidden = true; $('panel').hidden = true; $('dlg').hidden = true;
    vn.clearStage(); vn.setBg(null);
    refreshTitle();
    ui.openScreen('title');
    audio.play('title');
}

function hubMusic() {
    if (!G || G.scene) return;
    audio.play(G.phase === 'raid' || chapterOf(G.day) >= 3 ? 'gloam' : G.mg?.game === 'dice' ? 'tavern' : 'hall');
}

// ------------------------------------------------------------------ commands and events
function send(cmd) {
    if (!G || mode !== 'game') return false;
    const ok = act(G, cmd);
    if (ok) refresh();
    return ok;
}

function refresh() {
    drain();
    if (mode === 'game') ui.refresh(G);
    layout();
}

function drain() {
    if (!G || !G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        switch (e.type) {
            case 'music': audio.play(e.id); break;
            case 'sfx': audio.sfx(e.id); break;
            case 'sceneStart':
                if (e.title && e.kind !== 'talk') { const t = $('scene-title'); t.hidden = true; void t.offsetWidth; t.textContent = e.title; t.hidden = false; }
                if (e.kind === 'talk' || e.kind === 'heart') audio.play('tender');
                break;
            case 'sceneEnd': if (!G.scene) { vn.skipping = false; vnButtons(); hubMusic(); swallow = 0.25; } break;
            case 'fx': ui.floats(e.fx); break;
            case 'partner': vn.who.partner = CAST[e.id].name.split(' ')[0]; ui.toast(`You and ${vn.who.partner} are together. 💍`); audio.sfx('bell'); break;
            case 'promoted': ui.toast(`Promoted: ${e.job}!`); audio.sfx('rankup'); break;
            case 'rankup': ui.toast(`${advName(e.adv)} has earned ${RANKS[e.rank]} rank!`); audio.sfx('rankup', 0.7); break;
            case 'day': autosave(); hubMusic(); if (e.day > 1) audio.sfx('bell', 0.5); break;
            case 'petition': audio.sfx('door', 0.6); break;
            case 'posted': audio.sfx('stamp'); break;
            case 'declined': audio.sfx('door', 0.4); break;
            case 'assigned': break;
            case 'report': break;
            case 'healed': audio.sfx('bottle'); break;
            case 'upgrade': audio.sfx('coin'); ui.toast('The guild is a little grander.'); break;
            case 'till': audio.sfx('coin'); ui.floats({ gold: e.gold }); break;
            case 'debtpaid': audio.sfx('coin'); ui.toast('The Crown\'s debt is paid in full.'); break;
            case 'mgstart': hubMusic(); break;
            case 'stamp': audio.sfx(e.good ? 'stamp' : 'fail', e.good ? 1 : 0.5); break;
            case 'drop': audio.sfx('drop'); break;
            case 'bottled': audio.sfx('bottle'); break;
            case 'fizz': audio.sfx('fizz'); break;
            case 'step': audio.sfx('step', 0.6); break;
            case 'roll': audio.sfx('dice'); break;
            case 'bank': audio.sfx('coin'); break;
            case 'clash': audio.sfx('clash'); break;
            case 'mgdone': audio.sfx(e.stars ? 'win' : 'fail'); hubMusic(); break;
            case 'raid': audio.sfx(e.res === 'lost' ? 'fail' : 'cheer'); break;
            case 'over': gameOver(); break;
            default: break;
        }
    }
}

function gameOver() {
    mode = 'ending';
    if (!album.endings.includes(G.ending.id)) { album.endings.push(G.ending.id); saveAlbum(album); }
    clearSlot(0);
    $('dlg').hidden = true; $('panel').hidden = true; $('hud').hidden = true;
    vn.clearStage();
    ui.closeAll();
    ui.showEnding(G, album);
}

// ------------------------------------------------------------------ the story controls
function vnButtons() {
    for (const b of $('dlg').querySelectorAll('[data-vn]')) b.classList.toggle('on', (b.dataset.vn === 'auto' && vn.auto) || (b.dataset.vn === 'skip' && vn.skipping));
}
function vnControl(what) {
    audio.ui('click');
    if (what === 'log') ui.openLog();
    else if (what === 'auto') { vn.auto = !vn.auto; vn.skipping = false; }
    else if (what === 'skip') { vn.skipping = !vn.skipping; vn.auto = false; }
    else if (what === 'menu') ui.openScreen('menu');
    vnButtons();
}
vn.onAdvance = () => { if (swallow <= 0) send({ t: 'next' }); };
vn.onChoose = (i) => send({ t: 'choose', i });

// ------------------------------------------------------------------ keys
const CLOSABLE = ['menu', 'handbook', 'party', 'album', 'log', 'howto', 'settings', 'slots', 'newgame'];
window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') && e.code !== 'Escape') return;
    if (e.repeat && !e.code.startsWith('Arrow')) return;
    const top = ui.top();
    if (e.code === 'Escape') {
        e.preventDefault();
        if (top && CLOSABLE.includes(top)) { audio.ui('close'); ui.closeTop(); swallow = 0.25; }
        else if (!top && mode === 'game') { audio.ui('open'); ui.openScreen('menu'); }
        return;
    }
    if (top === 'mg') {
        if (G && ui.mini.key(G, e.code)) e.preventDefault();
        return;
    }
    if (top) {
        if (e.code === 'ArrowDown') { e.preventDefault(); ui.moveFocus(1); }
        else if (e.code === 'ArrowUp') { e.preventDefault(); ui.moveFocus(-1); }
        return;
    }
    if (mode !== 'game' || !G) return;
    if (e.code === 'KeyH') { ui.action('handbook'); return; }
    if (G.scene) {
        const onButton = tag === 'BUTTON';
        if ((e.code === 'Enter' || e.code === 'Space') && !onButton) { e.preventDefault(); if (swallow <= 0) vn.tap(); }
        else if (/^Digit[1-9]$/.test(e.code)) vn.choose(+e.code.slice(5) - 1);
        else if (e.code === 'KeyA') vnControl('auto');
        else if (e.code === 'Tab') { e.preventDefault(); vnControl('skip'); }
        else if (e.code === 'KeyL') vnControl('log');
    } else if (/^Digit[1-4]$/.test(e.code)) ui.setTab(['desk', 'board', 'roster', 'guild'][+e.code.slice(5) - 1]);
});

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    swallow = Math.max(0, swallow - dt);
    if (mode !== 'game' || !G) return;
    const blocked = ui.anyScreen() && ui.top() !== 'mg' && ui.top() !== 'petition' && ui.top() !== 'party';
    if (!blocked) {
        const mgBefore = !!G.mg && !G.mg.done;
        // the Cauldron's recipe is shown before the clock or the player can touch it
        if (!(G.mg?.game === 'brew' && ui.mini.showing)) step(G, dt * (G.mg ? 1 : FAST));
        ui.mini.tick(G, dt);
        if (G.events.length || (mgBefore && G.mg?.done)) refresh();
        ui.tick(G);
        if (G.scene) {
            vn.tick(dt);
            if (vn.skipping && !G.scene.cur?.choice) { vn.complete(); send({ t: 'next' }); }
        }
        saveT += dt;
        if (saveT > 30) { saveT = 0; autosave(); }
    }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });
window.addEventListener('pagehide', () => autosave());
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    let bot = null;
    window.__lh = {
        get G() { return G; },
        get mode() { return mode; },
        seen, ui, vn, audio, album: () => album, CG_FILES, DAYS, JOBS,
        start(seed = 1, who = { name: 'Robin', gender: 'n' }) { startGame(newGame(seed, who)); return G; },
        send,
        /** Play the scene on stage to its end, taking the first answer each time. */
        skip() { let n = 0; while (G?.scene && n++ < 3000) send(G.scene.cur.choice ? { t: 'choose', i: G.scene.cur.choice[0].i } : { t: 'next' }); return n; },
        /** Let the bot play through the real command path until `day` (or the ending). */
        ff(day = DAYS + 1, route = 'golden') {
            bot = bot && bot.route === route ? bot : makeBot({ route, seed: G.seed });
            let n = 0;
            while (mode === 'game' && G.day < day && n++ < 20000) {
                if (!send(botCommand(G, bot))) break;
                if (!G.scene && !G.mg) step(G, 2);
            }
            ui.mini.show = null;
            refresh();
            return G.day;
        },
        save: () => autosave(),
        hasSave: () => latestSlot() >= 0,
    };
}
