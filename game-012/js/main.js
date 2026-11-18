// Arcana Pull: entry point. Boots sound and the UI; turns taps, clicks and keys into commands for act(); drains
// G.events to the UI, the stage and the sound once per command; plays battles on the stage; saves after every command;
// moves between the title, the parlour, the Well, battles, Readings and the endings.
//
// ?debug=1 exposes window.__ap for the dev/ harnesses (see dev/README.md). &fast=1 skips battle replays.

import { VERSION, MAX_FRAME, TRIAL_COUNT } from './config.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Stage } from './view/stage.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, act, legal, trialOf } from './sim/game.js';
import { botCommand } from './sim/bot.js';
import { CARDS } from './sim/data/cards.js';
import { ART, ROOT } from './media.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = params.get('fast') === '1';
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
let G = null;
let mode = 'title';                 // title | hub | battle | reading | ending | over
let pendingBattle = null;           // the 'battle' event being replayed
let frames = 0;
const seen = {};                    // a count of every sim event drained, for the tests
const calm = () => settings.motion === 'off' || !!window.A11Y?.reducedMotion;

const stage = new Stage($('stage'), $('fx'), audio);
const ui = new UI({
    audio, settings, cmd: (c) => command(c),
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); document.body.classList.toggle('calm', calm()); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});
audio.onSay = (id, secs) => ui.subtitle(id, secs);
document.body.classList.toggle('calm', calm());
$('version').textContent = 'v' + VERSION;

// ------------------------------------------------------------------ commands and events
function command(c) {
    if (!G) return false;
    const ok = act(G, c);
    flush();
    if (G) saveGame(G);
    return ok;
}

function flush() {
    const ev = G.events.splice(0);
    for (const e of ev) {
        seen[e.type] = (seen[e.type] || 0) + 1;
        switch (e.type) {
            case 'pulled': ui.showReveal(e.cards); audio.play('dust', { vol: 0.5 }); break;
            case 'starUp': audio.play('star'); ui.toast(`${cardName(e.id)} rises to ${'★'.repeat(e.star)}`); ui.renderDetail(); break;
            case 'party': if (e.auto && !e.quiet) { audio.play('whoosh'); ui.toast('The spread is set.'); } break;
            case 'armed': audio.play(e.on ? 'star' : 'click', { vol: 0.7 }); break;
            case 'used': ui.toast('The Wheel turns: ten free draws!'); break;
            case 'battle': startBattle(e); break;
            case 'reading': toReading(e); break;
            case 'omen': onOmen(e); break;
            case 'trial': if (mode !== 'reading') toHub(true); break;
            case 'retry': toHub(false); break;
            case 'ending': toEnding(); break;
            case 'ascend': audio.say('ascend'); break;
            case 'omenEnd': ui.toast('The omen fades.'); break;
            case 'deny': onDeny(e.why); break;
            default: break;
        }
    }
    if (mode === 'hub') ui.renderHub();
    if (ui.isOpen('well')) ui.renderWell();
    if (ui.isOpen('grimoire')) ui.renderGrimoire();
}
const cardName = (id) => CARDS[id]?.name || id;

function onDeny(why) {
    audio.ui('deny');
    const msg = { dust: 'Not enough stardust.', party: 'Place at least one card in your spread.', copies: 'Not enough copies yet.', phase: null }[why];
    if (msg) ui.toast(msg);
}

// ------------------------------------------------------------------ moving between places
function hideAll() {
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    ui.stack = [];
    $('reveal').hidden = true;
}

function refreshTitle() { $('btn-continue').hidden = !hasSave(); }

function toTitle() {
    hideAll();
    mode = 'title';
    refreshTitle();
    ui.openScreen('title');
    audio.music('parlour');
}

function startGame(g, isNew) {
    G = g;
    ui.G = G;
    G.events.length = 0;
    if (G.phase === 'reading' && G.reading) { toReading({ cards: G.reading.cards }); return; }
    if (G.phase === 'ending') { toEnding(); return; }
    if (G.phase === 'won' || G.phase === 'lost') { act(G, { t: 'next' }); flush(); }
    if (G.phase === 'over') { hideAll(); mode = 'over'; ui.showOver(G); audio.music('reading'); return; }
    toHub(false);
    if (isNew) setTimeout(() => audio.say('intro'), 400);
    saveGame(G);
}

function toHub(newTrial) {
    hideAll();
    mode = 'hub';
    ui.openScreen('hub');
    ui.renderHub();
    audio.music('parlour');
    if (newTrial) setTimeout(() => audio.say('t' + G.trial), 500);
    setTimeout(() => (G.party.some(Boolean) ? $('btn-fight') : $('btn-well')).focus(), 50);
}

function startBattle(e) {
    pendingBattle = e;
    hideAll();
    mode = 'battle';
    ui.openScreen('battle');
    $('realm').style.backgroundImage = `url(${ROOT}${ART.realm(e.realm)})`;
    $('caption').textContent = '';
    $('bat-title').textContent = trialOf(G).name;
    setSpeed(settings.speed);
    stage.play(e, { speed: speedScale(settings.speed), motion: !calm() });
    audio.music(e.trial === TRIAL_COUNT ? 'boss' : 'battle');
    if (e.trial === TRIAL_COUNT) audio.say('wintro');
    if (FAST) stage.skip();
}
stage.onLine = (text, side) => {
    const c = $('caption');
    c.textContent = text;
    c.className = 'caption ' + (side === 0 ? 'ally' : 'foe');
    clearTimeout(stage.capT);
    stage.capT = setTimeout(() => { c.textContent = ''; }, 1600);
};
stage.onVoice = (id) => audio.say(id);
stage.onDone = (r) => {
    if (mode !== 'battle') return;
    audio.play(r.won ? 'victory' : 'defeat');
    setTimeout(() => audio.say(r.won ? 'win' : G.phase === 'over' ? 'over' : 'lost'), 900);
    ui.showResult(r, G);
};
/** The stage runs sim seconds; 1× is a calm pace, 4× a quick one. */
const speedScale = (s) => ({ 1: 1, 2: 1.8, 4: 3.6 }[s] || 1.8);
function setSpeed(s) {
    settings.speed = s;
    saveSettings(settings);
    stage.speed = speedScale(s);
    document.querySelectorAll('.speeds .sp').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.speed === s ? 'true' : 'false'));
}

function afterResult() {
    ui.closeScreen('result');
    audio.hush();
    if (G.phase === 'over') { hideAll(); mode = 'over'; ui.showOver(G); audio.music('reading'); return; }
    command({ t: 'next' });
}

function toReading(e) {
    hideAll();
    mode = 'reading';
    ui.showReading(e.cards);
    audio.music('reading');
    setTimeout(() => audio.say('reading'), 500);
}
function onOmen(e) {
    audio.play('omen');
    setTimeout(() => audio.play(e.reversed ? 'curse' : 'rise'), 600);
    setTimeout(() => audio.say(e.reversed ? 'reversed' : 'upright'), 900);
    ui.readingResult(e);
}

function toEnding() {
    hideAll();
    mode = 'ending';
    ui.showEnding(G);
    audio.music('reading');
    setTimeout(() => audio.say('ending'), 600);
}

// ------------------------------------------------------------------ buttons
$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui();
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0), true);
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g, false); else ui.toast('That save could not be read.'); }
    else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui();
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(a);
});
$('btn-pause').addEventListener('click', () => { audio.ui(); ui.openScreen('pause'); });
$('btn-well').addEventListener('click', () => { audio.ui(); ui.openWell(); });
$('btn-pull1').addEventListener('click', () => command({ t: 'pull', n: 1 }));
$('btn-pull10').addEventListener('click', () => command({ t: 'pull', n: 10 }));
$('btn-grimoire').addEventListener('click', () => { audio.ui(); ui.setPick(-1); ui.openGrimoire(); });
$('btn-charms').addEventListener('click', () => { audio.ui(); ui.openCharms(); });
$('btn-auto').addEventListener('click', () => command({ t: 'auto' }));
$('btn-fight').addEventListener('click', () => { audio.ui(); command({ t: 'fight' }); });
$('btn-skip').addEventListener('click', () => { audio.ui(); stage.skip(); });
document.querySelectorAll('.speeds .sp').forEach((b) => b.addEventListener('click', () => { audio.ui(); setSpeed(+b.dataset.speed); }));
$('btn-res-next').addEventListener('click', () => { audio.ui(); afterResult(); });
$('btn-reading-done').addEventListener('click', () => { audio.ui(); toHub(true); });
$('btn-ascend').addEventListener('click', () => { audio.ui(); command({ t: 'ascend' }); });
$('btn-end-title').addEventListener('click', () => { audio.ui(); toTitle(); });
$('btn-over-title').addEventListener('click', () => { audio.ui(); clearSave(); toTitle(); });
$('btn-over-new').addEventListener('click', () => { audio.ui(); startGame(newGame((Date.now() % 1e9) | 0), true); });

// ------------------------------------------------------------------ keys
window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') && e.code !== 'Escape') return;
    if (e.code === 'Escape') {
        if (!$('reveal').hidden) { ui.revealAll(); return; }
        if (ui.closeTop()) return;
        if (mode === 'hub') { audio.ui(); ui.openScreen('pause'); }
        return;
    }
    if (e.repeat) return;
    if (mode === 'battle' && !ui.isOpen('result')) {
        if (e.code === 'Digit1') setSpeed(1);
        else if (e.code === 'Digit2') setSpeed(2);
        else if (e.code === 'Digit4') setSpeed(4);
        else if (e.code === 'KeyS') stage.skip();
        return;
    }
    if (mode === 'hub' && !ui.anySheet()) {
        if (e.code === 'KeyW') { audio.ui(); ui.openWell(); }
        else if (e.code === 'KeyG') { audio.ui(); ui.openGrimoire(); }
        else if (e.code === 'KeyC') { audio.ui(); ui.openCharms(); }
        else if (e.code === 'KeyA') command({ t: 'auto' });
        else if (e.code === 'KeyF') { audio.ui(); command({ t: 'fight' }); }
    }
});

// first gesture: start the audio
const unlock = () => { audio.init(); audio.music(audio.wantTheme || 'parlour'); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
window.addEventListener('resize', () => stage.resize());

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    frames++;
    if (mode === 'battle') stage.update(dt);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

toTitle();
$('loading').classList.add('gone');
setTimeout(() => $('loading').remove(), 500);

// ------------------------------------------------------------------ debug hooks
if (DEBUG) {
    window.__ap = {
        get G() { return G; }, get mode() { return mode; }, get frames() { return frames; },
        seen, ui, stage, audio, settings,
        start(seed = 1) { startGame(newGame(seed), true); return true; },
        act(c) { return command(c); },
        legal() { return G ? legal(G) : []; },
        /** The bot plays n commands; battle replays are skipped and results dismissed. */
        ff(n = 1, style = 'careful') {
            for (let k = 0; k < n; k++) {
                if (mode === 'battle') { stage.skip(); }
                if (ui.isOpen('result')) { afterResult(); continue; }
                if (!$('reveal').hidden) { $('reveal').hidden = true; continue; }
                if (mode === 'reading' && !$('btn-reading-done').hidden) { toHub(true); continue; }
                const c = botCommand(G, style, Math.random);
                if (!c) break;
                command(c);
            }
            return { phase: G.phase, trial: G.trial, mode };
        },
        save() { return saveGame(G); }, hasSave,
        battleDone() { return mode === 'battle' && !stage.running; },
    };
}
