/**
 * main.js — Kraken's Gambit entry point.
 *
 * Screens: title → setup → play (→ game over → review). The simulation (js/sim)
 * decides everything; this file feeds it input, replays its records through the
 * 3D view (js/view) and the HUD (js/ui), and asks the AI worker for moves.
 *
 * Library: three.js r165 via the import map in index.html.
 */

import * as THREE from 'three';
import { initStage, scene, camera, controls, renderer, uniforms, render, clock, turnCamera, viewSide, fitCamera, setInsets, onResizeCall } from './view/stage.js';
import { Scenery } from './view/scenery.js';
import { BoardView, squarePos } from './view/board3d.js';
import { FX } from './view/fx.js';
import { updateTweens, flushTweens, wait, setAnimSpeed, activeTweens } from './view/anim.js';
import { animateFlags } from './view/ships.js';
import { playEvent, warmCreatures } from './view/creatures.js';
import { renderThumbs } from './ui/thumbs.js';
import * as hud from './ui/hud.js';
import { initAudio, sfx, setSound, setMusic } from './audio.js';
import { loadGame, saveGame, clearGame, loadPrefs, savePrefs } from './save.js';
import { Match } from './sim/game.js';
import { SEA_EVENTS, EVENT_IDS } from './sim/seaEvents.js';
import { Position, parseUci, sqName, parseSq, fileOf, rankOf, sq as mkSq, F_EP, WHITE } from './sim/chess.js';
import { chooseMove } from './sim/ai.js';

const $ = hud.$;
const DEBUG = new URLSearchParams(location.search).has('debug');

// ------------------------------------------------------------------ state
const prefs = loadPrefs();
if (!prefs.setup.events) prefs.setup.events = [...EVENT_IDS];
prefs.setup.events = prefs.setup.events.filter((e) => EVENT_IDS.includes(e));
let match = null;
let screen = 'title';       // 'title' | 'setup' | 'play' | 'over'
let busy = false;           // an animation or AI turn is in progress
let aiThinking = false;
let token = 0;              // bumps on new game / undo, cancelling stale async work
let sel = -1, hover = -1, cursor = -1;
let legal = [];
let hint = [];
let hintTimer = 0;
let desyncs = 0;
let lastSetup = null;

// ------------------------------------------------------------------ boot
initStage($('stage'));
const fx = new FX(scene);
const scenery = new Scenery(scene);
const board = new BoardView(scene, fx);
board.setBoard(Position.start().b);
board.setLabels(prefs.labels);
renderThumbs();
hud.buildHelp();
warmCreatures(scene, renderer, camera);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;

const domFlash = () => {
    const f = $('flash');
    f.style.transition = 'none'; f.style.opacity = '0.75';
    requestAnimationFrame(() => { f.style.transition = 'opacity 0.35s'; f.style.opacity = '0'; });
};
const sounds = { ...sfx, thunder() { sfx.thunder(); domFlash(); } };
const eventCtx = { board, fx, sfx: sounds, scene, camera, clockT: () => uniforms.uTime.value };

// ------------------------------------------------------------------ AI worker
let worker = null, workerFailed = false, reqId = 0;
const pending = new Map();
function syncAI(payload) {
    return chooseMove(Position.fromFEN(payload.fen), { ...payload, now: () => performance.now() });
}
function aiRequest(payload) {
    return new Promise((resolve) => {
        const id = ++reqId;
        if (!worker && !workerFailed) {
            try {
                worker = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' });
                worker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p.resolve(e.data); } };
                worker.onerror = (e) => {
                    e.preventDefault?.();
                    workerFailed = true; worker = null;
                    for (const [, p] of pending) setTimeout(() => p.resolve(syncAI(p.payload)), 10);
                    pending.clear();
                };
            } catch { workerFailed = true; worker = null; }
        }
        if (worker) { pending.set(id, { resolve, payload }); worker.postMessage({ id, ...payload }); }
        else setTimeout(() => resolve(syncAI(payload)), 30);
    });
}

// ------------------------------------------------------------------ screens
/** Tell the camera which parts of the screen the HUD covers, for the current layout. */
function layoutInsets() {
    if (screen !== 'play' && screen !== 'over') { setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); return; }
    const W = window.innerWidth, H = window.innerHeight;
    if (H <= 520 && W > H) setInsets({ left: 0, right: 64, top: 40, bottom: 0 });
    else if (W <= 760) setInsets({ left: 0, right: 0, top: 84, bottom: 72 });
    else setInsets({ left: 0, right: W > 1000 ? 270 : 0, top: 52, bottom: 78 });
}
onResizeCall(layoutInsets);

function show(name) {
    screen = name;
    layoutInsets();
    $('title').hidden = name !== 'title';
    $('setup').hidden = name !== 'setup';
    $('hud').hidden = !(name === 'play' || name === 'over');
    controls.autoRotate = name === 'title' || name === 'setup';
    hud.tip(null);
}

function refreshContinue() {
    const s = loadGame();
    $('btn-continue').hidden = !(s && !s.result);
}

const setup = JSON.parse(JSON.stringify(prefs.setup));
hud.buildSetup(setup, () => { prefs.setup = JSON.parse(JSON.stringify(setup)); savePrefs(prefs); });
$('opt-autoturn').checked = prefs.autoTurn;
$('opt-autoturn').onchange = (e) => { prefs.autoTurn = e.target.checked; savePrefs(prefs); };

function firstGesture() { initAudio(); setSound(prefs.sound); setMusic(prefs.music); }

$('btn-new').onclick = () => { firstGesture(); sfx.click(); show('setup'); };
$('btn-continue').onclick = () => {
    firstGesture(); sfx.click();
    const s = loadGame();
    if (s) startMatch(null, s);
};
$('btn-howto').onclick = () => { firstGesture(); sfx.click(); $('help').hidden = false; };
$('btn-setup-back').onclick = () => { sfx.click(); show('title'); };
$('btn-sail').onclick = () => { firstGesture(); sfx.select(); startMatch(JSON.parse(JSON.stringify(setup))); };
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => { $(b.dataset.close).hidden = true; };
for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'promo' && m.id !== 'over') m.hidden = true; });
}

// ------------------------------------------------------------------ a match
const randomSeed = () => Math.random().toString(36).slice(2, 10);

function startMatch(opts, saved = null) {
    token++;
    flushTweens();
    busy = false; aiThinking = false;
    sel = -1; hint = []; cursor = -1;
    hud.thinking(false);
    hud.hideBanner();
    $('over').hidden = true;
    if (saved) {
        match = Match.fromJSON(saved);
        if (!match) { hud.toast('That voyage log was unreadable. Starting fresh.'); clearGame(); show('setup'); return; }
    } else {
        const side = opts.side === 0 ? (Math.random() < 0.5 ? 1 : -1) : opts.side;
        match = new Match({ mode: opts.mode, human: side, level: opts.level, sea: opts.sea, events: [...opts.events], seed: randomSeed() });
        lastSetup = opts;
    }
    if (!lastSetup) lastSetup = { mode: match.opts.mode, side: match.opts.human, level: match.opts.level, sea: match.opts.sea, events: [...match.opts.events] };
    board.setBoard(match.pos.b);
    legal = match.result ? [] : match.legal();
    show('play');
    const view = match.opts.mode === 'ai' ? match.opts.human : (prefs.autoTurn ? match.turn : 1);
    fitCamera(viewSide());
    turnCamera(view, 1.3);
    afterChange();
    saveGame(match.toJSON());
    if (match.result) finish(false);
    else aiTurn();
}

function afterChange() {
    hud.setTurn(match, match.opts);
    hud.setSea(match.opts);
    hud.setLocker(match);
    hud.setLog(match);
    $('btn-undo').disabled = !match.canUndo();
    $('btn-hint').disabled = !match.isHumanTurn() || !!match.result;
    refreshMarks();
}

function refreshMarks() {
    if (!match) return;
    const targets = sel >= 0 ? legal.filter((l) => l.from === sel).map((l) => ({ to: l.to, capture: !!match.pos.b[l.to] || !!(l.flag & F_EP) })) : [];
    const inCheck = !match.result && match.pos.inCheck();
    board.setMarks({
        sel, targets, hint,
        last: match.lastMove,
        check: inCheck ? match.pos.kingSq(match.turn) : -1,
        hover: hover >= 0 ? hover : cursor,
    });
}

async function commit(m) {
    const my = token;
    busy = true;
    sel = -1; hint = [];
    clearTimeout(hintTimer);
    refreshMarks();
    const rec = match.play(m);
    // Save at once: closing the tab mid-animation must not lose the move.
    if (rec.result) clearGame(); else saveGame(match.toJSON());
    hud.setLog(match);
    hud.setTurn(match, match.opts);
    // The simulation has already moved on; animations only replay it. If one
    // throws, log it and resync below rather than leaving the game stuck.
    try {
        await board.playMove(rec.move, sounds);
        if (my !== token) return;
        if (rec.event) {
            const def = SEA_EVENTS[rec.event.type];
            sfx.sting(def.good);
            hud.showBanner(rec.event);
            await wait(0.5);
            await playEvent(rec.event, eventCtx);
            if (my !== token) return;
            await wait(0.6);
            hud.hideBanner(400);
        }
    } catch (err) {
        console.error('[kraken] animation failed', err);
        hud.hideBanner();
    }
    if (my !== token) return;
    if (!board.matches(match.pos.b)) {
        desyncs++;
        console.warn('[kraken] view out of step with the sim after', rec.move.san, rec.event?.type || '', '— resyncing');
        board.setBoard(match.pos.b);
    }
    legal = match.result ? [] : match.legal();
    afterChange();
    saveGame(match.toJSON());
    if (rec.check && !rec.result) sfx.bell();
    busy = false;
    if (rec.result) { finish(true); return; }
    if (match.opts.mode === 'pvp' && prefs.autoTurn) turnCamera(match.turn, 1.0);
    aiTurn();
}

async function aiTurn() {
    if (!match || match.result || match.isHumanTurn() || screen !== 'play') return;
    const my = token;
    busy = true; aiThinking = true;
    const who = hud.sideName(match.turn);
    const lines = [`The ${who} captain is plotting a course…`, `The ${who} captain peers through the spyglass…`, `The ${who} captain consults the charts…`];
    hud.thinking(true, lines[Math.floor(Math.random() * lines.length)]);
    const t0 = performance.now();
    const res = await aiRequest({ fen: match.pos.toFEN(), history: match.keys, level: match.opts.level, seed: Math.floor(Math.random() * 1e9) });
    const minWait = DEBUG ? 0 : 650 - (performance.now() - t0);
    if (minWait > 0) await new Promise((r) => setTimeout(r, minWait));
    if (my !== token) return;
    aiThinking = false;
    hud.thinking(false);
    if (!res.move || !match.pos.legalMoves().includes(res.move)) {
        // Shouldn't happen; never stall the game on it.
        const any = match.pos.legalMoves();
        if (!any.length) { busy = false; return; }
        res.move = any[0];
    }
    await commit(res.move);
}

function finish(fresh) {
    screen = 'over';
    clearGame();
    refreshContinue();
    const r = match.result;
    if (fresh) {
        const humanWon = match.opts.mode === 'pvp' ? r.winner !== 0 : r.winner === match.opts.human;
        if (r.winner !== 0 && humanWon) { sfx.win(); fx.sparkle(squarePos(match.pos.kingSq(r.winner)), 40); } else sfx.lose();
    }
    setTimeout(() => { if (match && match.result && screen === 'over') hud.showOver(match, match.opts); }, fresh ? 1300 : 50);
}

// ------------------------------------------------------------------ input: squares
/**
 * Resolve a click: the ship hit (if any) and the water square under the pointer.
 * A legal destination wins, then one of your own ships, then the water square.
 */
function resolveClick(hit) {
    const own = (s) => s >= 0 && match.pos.b[s] && Math.sign(match.pos.b[s]) === match.turn;
    const target = (s) => s >= 0 && sel >= 0 && legal.some((l) => l.from === sel && l.to === s);
    const shipSq = hit.item ? hit.item.sq : -1;
    if (target(shipSq)) return shipSq;
    if (target(hit.waterSq)) return hit.waterSq;
    if (own(shipSq)) return shipSq;
    if (own(hit.waterSq)) return hit.waterSq;
    return shipSq >= 0 ? shipSq : hit.waterSq;
}

async function onSquare(s) {
    if (screen !== 'play' || !match || match.result || s < 0) return;
    if (busy || !match.isHumanTurn()) {
        if (aiThinking) hud.toast('Hold fast. The enemy captain is thinking.');
        return;
    }
    const piece = match.pos.b[s];
    if (sel >= 0) {
        const opts = legal.filter((l) => l.from === sel && l.to === s);
        if (opts.length) {
            let m = opts[0].m;
            if (opts.length > 1) {
                const t = await hud.pickPromotion(match.turn);
                m = opts.find((o) => o.promo === t).m;
            }
            await commit(m);
            return;
        }
    }
    if (piece && Math.sign(piece) === match.turn) {
        if (sel === s) { sel = -1; refreshMarks(); return; }
        sel = s;
        sfx.select();
        if (!legal.some((l) => l.from === s)) hud.toast(match.pos.inCheck() ? 'Your Flagship is in check! Deal with that first.' : 'That ship has no legal move.');
    } else {
        if (sel >= 0) sfx.deny();
        sel = -1;
    }
    refreshMarks();
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function squareFromScreen(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const w = ray.intersectObject(board.water, false)[0];
    const waterSq = w ? board.squareOfPoint(w.point) : -1;
    // Tall sails overlap the rank behind them on screen. If the ray passes through the
    // ship on the water square it lands on, that's the one meant; else the nearest hit.
    const hits = ray.intersectObjects(board.pickables(), false).map((h) => h.object.userData.item);
    const item = hits.find((it) => it.sq === waterSq) || hits[0] || null;
    return { sq: item ? item.sq : waterSq, item, waterSq };
}

const canvas = renderer.domElement;
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 700;
    down = null;
    if (moved > 10 || !quick) return;
    if (screen === 'title' || screen === 'setup') return;
    const hit = squareFromScreen(e.clientX, e.clientY);
    cursor = -1;
    if (match) onSquare(resolveClick(hit));
});
let moveQueued = null;
canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    moveQueued = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => { moveQueued = null; hover = -1; hud.tip(null); refreshMarks(); });

function processHover() {
    if (!moveQueued || screen !== 'play' || !match) return;
    const { x, y } = moveQueued;
    moveQueued = null;
    const { sq, item } = squareFromScreen(x, y);
    if (item) hud.tip(`${hud.pieceTitle(item.piece)} · ${sqName(item.sq)}`, x, y);
    else hud.tip(null);
    const h = sq >= 0 ? sq : -1;
    if (h !== hover) { hover = h; refreshMarks(); }
    canvas.style.cursor = item && match.isHumanTurn() && Math.sign(item.piece) === match.turn ? 'pointer' : sel >= 0 && legal.some((l) => l.from === sel && l.to === sq) ? 'pointer' : '';
}

// ------------------------------------------------------------------ toolbar
function undo() {
    if (!match || (screen !== 'play' && screen !== 'over')) return;
    if (busy && !aiThinking) { hud.toast('Wait for the sea to settle…'); return; }
    if (!match.canUndo()) { hud.toast('Nothing to take back.'); return; }
    token++;
    aiThinking = false; busy = false;
    hud.thinking(false);
    if (!match.undo()) { hud.toast('Nothing to take back.'); return; }
    sfx.click();
    $('over').hidden = true;
    screen = 'play';
    sel = -1; hint = [];
    board.setBoard(match.pos.b);
    legal = match.result ? [] : match.legal();
    afterChange();
    saveGame(match.toJSON());
    refreshContinue();
    if (match.opts.mode === 'pvp' && prefs.autoTurn) turnCamera(match.turn, 0.8);
    aiTurn();
}

async function giveHint() {
    if (!match || busy || match.result || !match.isHumanTurn()) return;
    const my = token;
    hud.toast('The first mate studies the waters…', 1200);
    const res = await aiRequest({ fen: match.pos.toFEN(), history: match.keys, level: 4, seed: 1, override: { time: 700 } });
    if (my !== token || !res.move) return;
    const l = legal.find((x) => x.m === res.move);
    hint = [l.from, l.to];
    sel = -1;
    refreshMarks();
    hud.toast(`Try ${l.san}`);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint = []; refreshMarks(); }, 5000);
}

function toggleLabels() { prefs.labels = !prefs.labels; board.setLabels(prefs.labels); savePrefs(prefs); syncTools(); }
function toggleSound() { prefs.sound = !prefs.sound; initAudio(); setSound(prefs.sound); savePrefs(prefs); syncTools(); }
function toggleMusic() { prefs.music = !prefs.music; initAudio(); setMusic(prefs.music); savePrefs(prefs); syncTools(); }
function syncTools() {
    hud.setToolState('btn-labels', prefs.labels);
    hud.setToolState('btn-sound', prefs.sound);
    hud.setToolState('btn-music', prefs.music);
    $('btn-sound').querySelector('.ico').textContent = prefs.sound ? '🔊' : '🔇';
}
syncTools();

$('btn-undo').onclick = undo;
$('btn-hint').onclick = giveHint;
$('btn-turn').onclick = () => { sfx.click(); turnCamera(-viewSide(), 1.0); };
$('btn-labels').onclick = toggleLabels;
$('btn-sound').onclick = toggleSound;
$('btn-music').onclick = toggleMusic;
$('btn-help').onclick = () => { sfx.click(); $('help').hidden = false; };
$('btn-menu').onclick = () => { sfx.click(); $('menu').hidden = false; };
$('sea-pill').onclick = () => { sfx.click(); $('help').hidden = false; };
$('panel-toggle').onclick = () => {
    const p = $('panel');
    p.classList.toggle('open');
    $('panel-toggle').setAttribute('aria-expanded', p.classList.contains('open'));
};
$('menu-resume').onclick = () => { $('menu').hidden = true; };
$('menu-resign').onclick = () => {
    $('menu').hidden = true;
    if (!match || match.result) return;
    token++; busy = false; aiThinking = false; hud.thinking(false);
    const who = match.opts.mode === 'ai' ? match.opts.human : match.turn;
    match.resign(who);
    legal = [];
    afterChange();
    finish(true);
};
$('menu-new').onclick = () => { $('menu').hidden = true; token++; show('setup'); };
$('menu-title').onclick = () => { $('menu').hidden = true; token++; busy = false; hud.thinking(false); refreshContinue(); show('title'); };
$('over-rematch').onclick = () => { sfx.select(); startMatch(lastSetup || setup); };
$('over-new').onclick = () => { $('over').hidden = true; show('setup'); };
$('over-review').onclick = () => { $('over').hidden = true; };

// ------------------------------------------------------------------ keyboard
window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (k === 'Escape') {
        for (const id of ['help', 'menu']) if (!$(id).hidden) { $(id).hidden = true; return; }
        if (screen === 'play' && sel >= 0) { sel = -1; refreshMarks(); return; }
        if (screen === 'play') $('menu').hidden = false;
        else if (screen === 'setup') show('title');
        return;
    }
    if (screen !== 'play' && screen !== 'over') return;
    if (!$('promo').hidden || !$('menu').hidden) return;
    const flip = viewSide() < 0 ? -1 : 1;
    const moveCursor = (df, dr) => {
        if (cursor < 0) cursor = sel >= 0 ? sel : (match.turn === WHITE ? mkSq(4, 1) : mkSq(4, 6));
        const f = Math.max(0, Math.min(7, fileOf(cursor) + df * flip)), r = Math.max(0, Math.min(7, rankOf(cursor) + dr * flip));
        cursor = mkSq(f, r);
        hover = -1;
        refreshMarks();
        e.preventDefault();
    };
    if (k === 'ArrowUp') moveCursor(0, 1);
    else if (k === 'ArrowDown') moveCursor(0, -1);
    else if (k === 'ArrowLeft') moveCursor(-1, 0);
    else if (k === 'ArrowRight') moveCursor(1, 0);
    else if ((k === 'Enter' || k === ' ') && cursor >= 0) { e.preventDefault(); onSquare(cursor); }
    else if (k === 'u' || k === 'U') undo();
    else if (k === 'h' || k === 'H') giveHint();
    else if (k === 'f' || k === 'F') turnCamera(-viewSide(), 1.0);
    else if (k === 'l' || k === 'L') toggleLabels();
    else if (k === 'm' || k === 'M') toggleSound();
    else if (k === 'n' || k === 'N') toggleMusic();
    else if (k === '?') $('help').hidden = !$('help').hidden;
});

// ------------------------------------------------------------------ loop
let loopErrors = 0;
function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), DEBUG ? 0.2 : 0.05);
    uniforms.uTime.value += dt;
    const t = uniforms.uTime.value;
    try {
        updateTweens(dt);
        controls.update();
        processHover();
        board.update(dt, t);
        scenery.update(dt, t, camera);
        fx.update(dt);
        animateFlags(t);
    } catch (err) {
        // One exception must never freeze the sea: log it (a few times) and keep rendering.
        if (loopErrors++ < 5) console.error(err);
    }
    render();
}

show('title');
refreshContinue();
frame();
setTimeout(() => $('loading').classList.add('gone'), 200);

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    const project = (v) => {
        const p = v.clone().project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    };
    window.__kg = {
        ready: true,
        state: () => ({
            screen, busy, aiThinking, desyncs,
            turn: match?.turn, ply: match?.ply, fen: match?.pos.toFEN(), result: match?.result,
            sel, legal: legal.length, events: match ? match.log.filter((e) => e.event).length : 0,
            lastEvent: match ? [...match.log].reverse().find((e) => e.event)?.event?.type : null,
            anims: activeTweens(), view: viewSide(), items: board.items.size,
            matches: match ? board.matches(match.pos.b) : true,
        }),
        start: (o = {}) => startMatch({ mode: 'ai', side: 1, level: 1, sea: 'off', events: [...EVENT_IDS], ...o }),
        startFen: (fen, o = {}) => {
            startMatch({ mode: 'pvp', side: 1, level: 1, sea: 'off', events: [...EVENT_IDS], ...o });
            match.pos = Position.fromFEN(fen);
            match.keys = [match.pos.key()];
            board.setBoard(match.pos.b);
            legal = match.legal();
            afterChange();
        },
        move: (u) => { const m = parseUci(match.pos, u); if (!m) throw new Error('illegal ' + u); return commit(m); },
        force: (type) => { match.forceNext = type; },
        screenOf: (name) => project(squarePos(parseSq(name))),
        pieceScreen: (name) => project(squarePos(parseSq(name), 0.1)),
        speed: (n) => setAnimSpeed(n),
        focus: (name, dist = 4.5, polar = 0.95) => {
            const t = squarePos(parseSq(name));
            controls.target.copy(t);
            const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(t));
            camera.position.copy(t).add(new THREE.Vector3().setFromSphericalCoords(dist, polar, sph.theta));
            controls.update();
        },
        snapCamera: () => { flushTweens(); },
        brightness: () => {
            const gl = renderer.getContext();
            render();
            const px = new Uint8Array(4);
            gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            return px[0] + px[1] + px[2];
        },
        match: () => match,
    };
} else {
    window.__kg = { ready: true };
}
