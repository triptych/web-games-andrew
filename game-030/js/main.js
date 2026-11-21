// Boot, the title screen, the frame loop and the glue: input becomes act() commands, G.events are routed to the
// views, the audio and the UI, and the game saves when it changes place, rests or ends a battle.
// ?debug=1 exposes window.__cl (the live game, event counts, start, autoplay, fast).

import { VERSION } from './config.js';
import { newGame, act, currentLine } from './sim/game.js';
import { newBot, botCommand } from './sim/bot.js';
import { autoCommand, startBattle } from './sim/battle.js';
import { findPath, personAt, bumpAt, DIRS, faceTile, propAt } from './sim/world.js';
import { MAPS } from './sim/data/maps.js';
import { CAST } from './sim/data/cast.js';
import { ITEMS } from './sim/data/items.js';
import { QUESTS } from './sim/data/quests.js';
import { PARTY } from './sim/data/party.js';
import { BARKS } from './sim/data/barks.js';
import { loadArt, img, itemUrl, artUrl } from './view/assets.js';
import { MapView } from './view/map.js';
import { BattleView } from './view/battle.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { VN } from './vn.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, +params.get('fast') || 1);

const settings = loadSettings();
const audio = new Audio();
const input = new Input();
const canvas = $('view');
const mapView = new MapView(canvas);
let G = null;
let screen = 'loading';         // loading · title · game · ending
let bot = null, autoBattle = false;
let path = [];                  // queued steps from a tap
let dialogBg = null;            // the painting behind the current scene
let swallow = 0;                // ignore Space/Enter for a moment after a dialogue closes
const counts = {};

const send = (cmd) => {
    if (!G) return 'no game';
    const err = act(G, cmd);
    if (!err) pump();
    return err;
};

const ui = new UI({ audio, send, settings, onSettings: () => { audio.setVolumes(settings); saveSettings(settings); battleView.speed = settings.bspeed * FAST; } });
const vn = new VN({ audio, settings });
vn.fast = FAST;
vn.onAdvance = () => send({ t: 'next' });
vn.onChoose = (i) => send({ t: 'choose', i });

const battleView = new BattleView(canvas, {
    log: (t, tell) => ui.log(t, tell),
    pop: (i, t, c) => ui.pop(i, t, c),
    cardFx: (i, c) => ui.cardFx(i, c),
    cardPos: (i) => ui.cardPos(i),
    sfx: (n) => audio.sfx(n),
    bark: (u, key) => { if (!u || !settings.barks) return; const who = u.side === 'p' ? u.id : u.id === 'bigbertha' ? 'bertha' : null; const t = who && BARKS[u.id]?.[key]; if (t) audio.bark(who, t, u.side === 'e' || key === 'win'); },
    music: (n) => audio.play(n),
    order: (o) => ui.order(G, o),
    turn: () => {},
    refresh: (disp) => ui.renderCards(G, disp),
    result: (kind, e) => { pendingResult = { kind, e }; },
    other: (e) => onEvent(e, true),
});
// what the battle stage plays in order (the rest is handled at once)
const STAGED = new Set(['act', 'hit', 'heal', 'mpGain', 'mpLoss', 'status', 'statusEnd', 'resist', 'cure', 'stunned', 'ko', 'raise', 'tell',
    'fleeFail', 'fled', 'victory', 'defeat', 'yourTurn', 'round', 'levelup', 'item', 'quest', 'questDone', 'steal', 'recover', 'summon']);
battleView.speed = settings.bspeed * FAST;
let pendingResult = null;
ui.onAuto = (on) => { autoBattle = on; };
ui.onSystem = (k) => {
    if (k === 'save') { if (saveGame(G)) ui.toast('Saved.'); else ui.toast('Saving is blocked in this browser.'); }
    if (k === 'settings') ui.open('settings');
    if (k === 'howto') ui.open('howto');
    if (k === 'title') { saveGame(G); ui.close('menu'); toTitle(); }
};

// ------------------------------------------------------------------ sizing
function resize() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : window.innerWidth), h = Math.round(vv ? vv.height : window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    mapView.resize(w, h, dpr);
    battleView.resize(w, h, dpr);
    if (G?.battle) battleView.layout(G);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ screens
function showTitle() {
    screen = 'title';
    for (const id of ['hud', 'touch', 'vn', 'battle', 'ending', 'hint']) $(id).hidden = true;
    $('title').hidden = false;
    $('btn-continue').hidden = !hasSave();
    $('version').textContent = `v${VERSION}`;
    audio.play('title');
    ($('btn-continue').hidden ? $('btn-new') : $('btn-continue')).focus({ preventScroll: true });
}
function toTitle() { G = null; ui.battleClose(); vn.hide(); showTitle(); }

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    audio.init(); audio.setVolumes(settings);
    if (b.dataset.act === 'new') start(newGame((Date.now() % 1e9) | 0));
    if (b.dataset.act === 'continue') { const g = loadGame(); if (g) start(g); else { ui.toast('That save could not be read.'); clearSave(); $('btn-continue').hidden = true; } }
    if (b.dataset.act === 'howto') ui.open('howto');
    if (b.dataset.act === 'settings') ui.open('settings');
});
$('btn-end').addEventListener('click', () => { clearSave(); toTitle(); });
$('btn-menu').addEventListener('click', () => { if (G?.mode === 'explore') ui.openMenu(G); });
$('btn-hint').addEventListener('click', () => { if (G) ui.hint(G); });
$('btn-log').addEventListener('click', () => { vn.showLog(); ui.stack.push('logsheet'); });

function start(g) {
    G = g;
    screen = 'game';
    $('title').hidden = true;
    $('ending').hidden = true;
    $('hud').hidden = false;
    $('touch').hidden = !input.touch;
    input.flush();
    path = [];
    dialogBg = null;
    mapView.lx = undefined;
    mapView.sync(G);
    if (G.mode === 'battle') { battleView.begin(G); ui.battleOpen(G, battleView); audio.play(G.battle.boss ? 'boss' : 'battle'); }
    else audio.play(MAPS[G.map].music);
    if (G.mode === 'shop') ui.openShop(G);
    if (G.mode === 'ending') ui.ending(G);
    pump();
    ui.renderHud(G);
}
input.onTouch = (on) => { if (screen === 'game') $('touch').hidden = !on || !(G?.mode === 'explore' || G?.mode === 'shop'); };

// ------------------------------------------------------------------ events
function pump() {
    if (!G) return;
    const evs = G.events.splice(0);
    for (const e of evs) {
        counts[e.type] = (counts[e.type] || 0) + 1;
        if (inBattle && STAGED.has(e.type)) battleView.feed([e]);
        else onEvent(e);
    }
    if (G.mode === 'dialog') {
        const line = currentLine(G);
        if (line?.cg) dialogBg = { kind: 'cg', id: line.cg };
        else if (line?.bg) dialogBg = { kind: 'bg', id: line.bg };
        if (line?.music) audio.play(line.music);
                vn.render(line);
    } else if (vn.open) { vn.hide(); dialogBg = null; swallow = 0.25; }
    if (!inBattle && !$('battle').hidden && G.mode !== 'defeat') ui.battleClose();
    const exploring = G.mode === 'explore' || G.mode === 'shop';
    $('hud').hidden = !exploring;
    $('touch').hidden = !exploring || !input.touch;
    if (!exploring) $('hint').hidden = true;
    ui.renderHud(G);
}
let inBattle = false;

function onEvent(e, fromBattle) {
    switch (e.type) {
        case 'step': mapView.sync(G); if (G.stats.steps % 2) audio.sfx('step', 0.35); break;
        case 'map': {
            const was = mapView.mapId;
            mapView.sync(G);
            const m = MAPS[G.map];
            if (m.interior || (was && MAPS[was]?.interior)) audio.sfx('door', 0.7);
            if (G.mode !== 'battle') audio.play(m.music);
            ui.toast(`<b>${m.name}</b>`);
            path = [];
            if (saveGame(G)) G.stats.saves++;
            break;
        }
        case 'bonk': break;
        case 'blocked': ui.say(e.msg || 'You can\'t go that way yet.'); audio.ui('deny'); path = []; break;
        case 'chest': audio.sfx('chest'); if (e.gold) ui.toast(`+${e.gold} gold`, '', null); break;
        case 'item': ui.toast(`+${e.n} ${ITEMS[e.id].name}`, '', itemUrl(e.id)); break;
        case 'quest': audio.sfx('quest'); ui.toast(`New quest: <b>${QUESTS[e.id].title}</b>`, 'quest'); break;
        case 'questDone': audio.sfx('quest'); ui.toast(`Quest complete: <b>${QUESTS[e.id].title}</b>${e.reward.gold ? ` · +${e.reward.gold} gold` : ''}`, 'quest'); break;
        case 'levelup': audio.sfx('levelup'); ui.toast(`Level ${e.level}!${e.learned.map((l) => ` ${PARTY[l.who].name} learns ${l.name}.`).join('')}`, 'lvl'); break;
        case 'join': audio.sfx('quest'); ui.toast(`<b>${PARTY[e.who].name}</b> joins the party!`, 'quest', artUrl('chibi', e.who)); break;
        case 'rest': audio.sfx('heal'); saveGame(G); ui.toast('The party is rested. Saved.'); break;
        case 'buy': case 'sell': audio.sfx('coin'); ui.refreshOpen(); break;
        case 'equip': audio.sfx('shield', 0.6); break;
        case 'shop': ui.openShop(G); break;
        case 'shopClose': ui.closeShop(); saveGame(G); break;
        case 'battleStart': {
            inBattle = true; path = []; mapView.snap();
            battleView.begin(G);
            ui.battleOpen(G, battleView);
            pendingResult = null;
            audio.play(G.battle.boss ? 'boss' : 'battle');
            break;
        }
        case 'battleEnd': {
            inBattle = false;
            battleView.queue.length = 0;
            if (e.result !== 'lose') { ui.battleClose(); if (G.mode !== 'ending') audio.play(MAPS[G.map].music); saveGame(G); mapView.sync(G); }
            break;
        }
        case 'retry': break;
        case 'ending': audio.play('ending'); clearSave(); ui.ending(G); screen = 'ending'; break;
        default: break;
    }
}

// ------------------------------------------------------------------ input
canvas.addEventListener('pointerdown', (e) => {
    audio.init();
    if (!G || G.mode !== 'explore' || ui.sheetOpen) return;
    const r = canvas.getBoundingClientRect();
    const [tx, ty] = mapView.tileAt(e.clientX - r.left, e.clientY - r.top);
    const target = personAt(G, tx, ty) || bumpAt(G, tx, ty);
    let p = target ? findPath(G, G.map, G.x, G.y, tx, ty, true) : findPath(G, G.map, G.x, G.y, tx, ty, false);
    if (!p && !target) {
        // a tap on something solid: walk next to it
        p = findPath(G, G.map, G.x, G.y, tx, ty, true);
    }
    if (!p) { audio.ui('deny'); return; }
    path = p;
    if (target) path.push({ toward: [tx, ty] });
});
window.addEventListener('pointerdown', () => audio.init(), { capture: true });
window.addEventListener('keydown', () => audio.init(), { capture: true });

function handlePress(p) {
    if (p.t === 'back' && ui.closeTop()) return;
    if (!$('title').hidden || screen !== 'game' || !G) return;
    if (ui.sheetOpen) return;
    if (G.mode === 'dialog') {
        if (p.t === 'ok') vn.tap();
        else if (p.t.startsWith('num')) vn.choose(+p.t.slice(3) - 1);
        else if (p.t === 'log') { vn.showLog(); ui.stack.push('logsheet'); }
        else if (p.t === 'auto') vn.setAuto(!vn.auto);
        else if (p.t === 'skip') vn.setSkip(!vn.skipping);
        return;
    }
    if (G.mode === 'explore') {
        if (p.t === 'dir') { if (!mapView.busy) { path = []; send({ t: 'move', dir: p.dir }); } }   // a tap shorter than a frame still steps
        else if (p.t === 'ok') { if (swallow <= 0) { path = []; send({ t: 'interact' }); } }   // not the Space that closed a dialogue
        else if (p.t === 'menu') ui.openMenu(G);
        else if (p.t === 'journal') ui.openMenu(G, 'journal');
        else if (p.t === 'hint') ui.hint(G);
        return;
    }
    if (G.mode === 'battle') {
        if (p.t === 'dir') { if (!ui.targetKey(p.dir)) moveFocus(p.dir); }
        else if (p.t === 'ok') document.activeElement?.click?.();
        else if (p.t === 'back' && ui.bsel && ui.bsel.stage !== 'root') { ui.bsel.stage = 'root'; ui.renderBattleMenu(G); }
        else if (p.t === 'auto') { ui.autoOn = !ui.autoOn; autoBattle = ui.autoOn; if (ui.bsel) ui.renderBattleMenu(G); }
    }
}

/** Arrow keys move the focus around the buttons on screen (battle menus). */
function moveFocus(dir) {
    const box = !$('b-result').hidden ? $('b-result') : $('b-menu');
    const els = [...box.querySelectorAll('button:not([disabled])')];
    if (!els.length) return;
    let k = els.indexOf(document.activeElement);
    k = k < 0 ? 0 : (k + (dir === 'up' || dir === 'left' ? -1 : 1) + els.length) % els.length;
    els[k].focus({ preventScroll: true });
}

// ------------------------------------------------------------------ the loop
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    swallow = Math.max(0, swallow - dt);
    const p = input.take();
    if (p) handlePress(p);
    if (G && screen === 'game') update(dt * FAST);
    draw(dt);
    requestAnimationFrame(frame);
}

function update(dt) {
    if (bot && G.mode !== 'ending') {
        if (!(inBattle && battleView.busy) && !(!inBattle && G.mode !== 'dialog' && mapView.busy) && (!ui.sheetOpen || G.mode === 'shop')) {
            for (let k = 0; k < FAST; k++) {
                const cmd = botCommand(G, bot);
                if (!cmd) break;
                if (G.mode === 'battle' && G.battle.over && cmd.t === 'end') { $('b-result').hidden = true; }
                act(G, cmd);
                pump();
                if (G.mode === 'battle' || G.mode === 'dialog' || (G.mode !== 'dialog' && mapView.busy)) break;
            }
        }
        vn.tick(dt);
        return;
    }
    if (G.mode === 'explore' && !ui.sheetOpen && !mapView.busy) {
        const dir = input.dir;
        if (dir) { path = []; send({ t: 'move', dir }); }
        else if (path.length) {
            const step = path.shift();
            if (typeof step === 'string') send({ t: 'move', dir: step });
            else if (step.toward) {
                const [tx, ty] = step.toward;
                const dx = tx - G.x, dy = ty - G.y;
                const d = Math.abs(dx) + Math.abs(dy) === 1 ? (dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up') : null;
                if (d) send({ t: 'move', dir: d });
            }
        }
    }
    const ready = (() => { const [fx, fy] = faceTile(G); return G.mode === 'explore' && (personAt(G, fx, fy) || bumpAt(G, fx, fy) || (propAt(G, fx, fy)?.counter)); })();
    $('btn-act').classList.toggle('ready', !!ready);
    if (G.mode === 'dialog') vn.tick(dt);
    if (inBattle && G.battle) {
        const B = G.battle;
        if (!battleView.busy) {
            if (pendingResult) {
                const r = pendingResult; pendingResult = null;
                if ($('b-result').hidden) ui.battleResult(G, r.kind, r.e);
            } else if (!B.over && B.await !== null) {
                if (autoBattle) { const err = send(autoCommand(G, 1)); if (err) send({ t: 'defend' }); }
                else ui.battleMenu(G);
            }
        }
    }
}

function draw(dt) {
    const ctx = canvas.getContext('2d');
    if (screen !== 'game' || !G) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0d0818'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    if (inBattle && G.battle) { battleView.draw(G, dt); return; }
    if (G.mode === 'dialog' && dialogBg) {
        const im = img(dialogBg.kind, dialogBg.id);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#05030b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (im) {
            const s = Math.max(canvas.width / im.width, canvas.height / im.height);
            ctx.drawImage(im, (canvas.width - im.width * s) / 2, (canvas.height - im.height * s) / 2, im.width * s, im.height * s);
        }
        return;
    }
    mapView.draw(G, dt);
}

// ------------------------------------------------------------------ boot
window.addEventListener('visibilitychange', () => { if (document.hidden && G && screen === 'game') saveGame(G); });
window.addEventListener('pagehide', () => { if (G && screen === 'game') saveGame(G); });

if (DEBUG) {
    window.__cl = {
        get G() { return G; }, counts, mapView, battleView, ui, vn, audio,
        start: (seed = 1) => { audio.init(); start(newGame(seed)); },
        load: (g) => start(g),
        autoplay: (on = true, opts = {}) => { bot = on ? newBot({ skill: 1, ...opts }) : null; if (on) { vn.setSkip(true); } },
        busy: () => !!G && ((inBattle && battleView.busy) || (!inBattle && G.mode !== 'dialog' && mapView.busy) || G.events.length > 0),
        send,
        path: (x, y, adj = false) => findPath(G, G.map, G.x, G.y, x, y, adj),
        mode: () => G?.mode,
        fight: (group, boss = false) => { startBattle(G, group, { boss }); pump(); },
        warp: (map, x, y) => { G.map = map; G.x = x; G.y = y; mapView.lx = undefined; mapView.sync(G); pump(); },
    };
}

loadArt((f) => { $('ld-fill').style.width = Math.round(f * 100) + '%'; }).then(() => {
    $('loading').hidden = true;
    showTitle();
    requestAnimationFrame(frame);
});
