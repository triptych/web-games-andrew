// LANTERNHOLLOW — entry point. Builds the dungeon from the share link (or the last one, or a fresh seed), runs the
// builder (tools, undo, the depth slider) and the first-person walk (fixed-step sim, input, events), and keeps the
// URL hash in step with what is on screen.
//
// ?debug=1 exposes window.__lh for the dev/ harnesses; &fast=N runs the walk N× per frame.

import { STEP, MAX_FRAME, WALK } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { bindBuilderControls } from './controls.js';
import { loadSettings, saveSettings, saveParams, loadParams } from './save.js';
import { newGame, rebuild, step, totals } from './sim/game.js';
import { placeAt } from './sim/walker.js';
import { makeBot, botInput } from './sim/bot.js';
import { encode, decode, normalize, seedPhrase } from './sim/share.js';
import { stampProblem } from './sim/features.js';
import { TILES } from './sim/tiles.js';
import { ELEMENTS } from './sim/data/elements.js';
import { makeRng } from './rng.js';
import { onProgress, pending, progressState } from './progress.js';

const params0 = new URLSearchParams(location.search);
const DEBUG = params0.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params0.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

// The builder's own dice (not the sim's): a fresh seed phrase from the clock.
const dice = makeRng((Date.now() ^ (performance.now() * 1000)) >>> 0);
const freshSeed = () => seedPhrase(dice);

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const canvas = $('view');
canvas.tabIndex = 0;
const input = new Input(canvas);
const view = new View(canvas);

// ------------------------------------------------------------------ the loading screen (it is in the HTML already)
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function setLoad(step, frac, detail = '') {
    if (step) $('load-step').textContent = step;
    if (frac !== undefined) $('load-fill').style.width = `${Math.round(Math.max(0.05, Math.min(1, frac)) * 100)}%`;
    $('load-detail').textContent = detail;
}
setLoad('Growing the dungeon…', 0.1, 'wave function collapse, one level at a time');
await nextPaint();

// ------------------------------------------------------------------ the dungeon
const shared = decode(location.hash);
let G = newGame(shared || loadParams() || { seed: freshSeed() });
let cur = 0;                 // the level shown in the builder
let mode = 'build';          // build | walk
const undo = [];
const seen = {};
let bot = null;              // the tour: the explorer bot walks for you
let acc = 0, time = 0, last = performance.now(), wasRunning = false, hintT = 0;

const ui = new UI({
    audio, settings,
    onParams: (fn, label) => queueApply(fn, label),
    onLevel: (k) => setLevel(k),
    onTool: () => { view.setCursor(null); hoverAt(lastHover); },
    onSettings: (s) => {
        saveSettings(s);
        audio.setVolumes(s.sfx, s.music);
        view.setParallax(s.pom);
        updateTouch();
    },
});

/** Tell the view how much of the screen the workbench covers, so the dungeon centres in the rest. */
function updateInset() {
    const b = $('bench').getBoundingClientRect();
    const phone = window.innerWidth <= 760;
    if (mode !== 'build' || !b.width) view.setInset(0, 0);
    else if (phone) view.setInset(0, Math.round(window.innerHeight - b.top));
    else view.setInset(Math.round(b.right), 0);
}
new ResizeObserver(() => updateInset()).observe($('bench'));
window.addEventListener('resize', updateInset);
updateInset();
view.setDungeon(G.d, G.params, 0);
view.setParallax(settings.pom);
ui.sync(G.params, G.d, cur);
writeHash();

/** The small chip that says the dungeon is regrowing or new stone is being painted. */
let growing = false;
function updateBusy() {
    const tex = pending('textures');
    const show = growing || (tex > 0 && $('loading').classList.contains('done'));
    $('busy').hidden = !show;
    if (show) $('busy-text').textContent = growing ? 'Growing the dungeon…' : `Painting new stone… ${tex} to go`;
}
/** Apply a workbench change after the busy chip has had a frame to appear (the rebuild itself is synchronous). */
function queueApply(fn, label) {
    growing = true;
    updateBusy();
    requestAnimationFrame(() => setTimeout(() => {
        try { applyParams(fn, label); } finally { growing = false; updateBusy(); }
    }, 0));
}

function writeHash() {
    const h = '#' + encode(G.params);
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch { /* sandboxed */ }
    saveParams(G.params);
}

/** Change the params with fn(draft, freshSeed), rebuild, and remember the old ones for undo. */
function applyParams(fn, label = '') {
    const before = JSON.stringify(G.params);
    const draft = JSON.parse(before);
    fn(draft, freshSeed);
    const next = normalize(draft);
    if (JSON.stringify(next) === before) return false;
    try {
        const sizeSame = next.size === G.params.size;
        rebuild(G, next);
        undo.push(before);
        if (undo.length > 60) undo.shift();
        cur = Math.min(cur, G.d.levels.length - 1);
        view.setDungeon(G.d, G.params, cur, sizeSame);
        ui.sync(G.params, G.d, cur);
        writeHash();
        flushEvents();
        audio.ui('grow');
        const L = G.d.levels[cur];
        if (L.loosened && G.params.pins.some((p) => p.l === cur)) ui.toast('Some painted squares couldn’t fit together, so this level grew without them.');
        else if (label && label !== 'Theme') ui.toast(`✨ ${label}`);
        return true;
    } catch (err) {
        console.warn('[lanternhollow] rebuild failed', err);
        ui.toast('That didn’t grow. Try a different mix.');
        rebuild(G, JSON.parse(before));
        return false;
    }
}

function doUndo() {
    const prev = undo.pop();
    if (!prev) { ui.toast('Nothing to undo'); return; }
    rebuild(G, JSON.parse(prev));
    cur = Math.min(cur, G.d.levels.length - 1);
    view.setDungeon(G.d, G.params, cur, true);
    ui.sync(G.params, G.d, cur);
    writeHash();
    flushEvents();
    audio.ui('erase');
    ui.toast('↶ Undone');
}

function setLevel(k) {
    k = Math.max(0, Math.min(G.d.levels.length - 1, k));
    if (k === cur) return;
    cur = k;
    view.showLevel(k);
    view.setPins(G.params);
    view.frameLevel(false);
    ui.sync(G.params, G.d, cur);
    audio.ui('level');
}

// ------------------------------------------------------------------ builder taps
const FAM_NAME = {
    rock: 'Solid rock', tunnel: 'Tunnel', bend: 'Tunnel bend', tee: 'Tunnel fork', cross: 'Crossroads', dead: 'Dead end',
    floor: 'Chamber', wall: 'Chamber wall', corner: 'Chamber corner', inner: 'Chamber nook', door: 'Doorway',
    pool: 'Pool', poolEdge: 'Pool edge', poolCorner: 'Pool edge', poolInner: 'Pool edge', stream: 'Stream', streamBend: 'Stream bend',
    inlet: 'Stream into a pool', spout: 'Waterfall', well: 'Well', stairsDown: 'Stairs down', stairsUp: 'Stairs up',
};

/** The features at a micro cell, including torches and windows hung on the wall that cell is. */
function featuresAt(L, mx, my) {
    return L.features.filter((f) => (f.mx === mx && f.my === my) || (f.dir !== undefined && f.mx + DX[f.dir] === mx && f.my + DY[f.dir] === my));
}

function describe(c) {
    const L = G.d.levels[cur];
    const fam = TILES[L.tiles[c.cy * L.w + c.cx]].fam;
    const f = featuresAt(L, c.mx, c.my)[0];
    const fname = f ? (ELEMENTS[f.kind]?.name || (f.kind === 'torch' ? 'Wall torch' : `Peek window into ${f.nook === 'den' ? 'a sleeping den' : 'a tiny ' + f.nook}`)) : '';
    const name = fam === 'stairsUp' && cur === 0 ? 'The way in' : FAM_NAME[fam] || fam;
    const pinned = G.params.pins.some((p) => p.l === cur && p.x === c.cx && p.y === c.cy);
    return `${fname ? fname + ' · ' : ''}${name}${pinned ? ' 📌' : ''}`;
}

let lastHover = null;
function hoverAt(pos) {
    lastHover = pos;
    if (!pos || mode !== 'build') { view.setCursor(null); ui.hover(''); return; }
    const c = view.pick(pos.x, pos.y);
    if (!c) { view.setCursor(null); ui.hover(''); return; }
    const L = G.d.levels[cur];
    const t = ui.tool;
    if (t === 'paint') view.setCursor(c, 'cell', c.cx > 0 && c.cy > 0 && c.cx < L.w - 1 && c.cy < L.h - 1);
    else if (t === 'stamp') view.setCursor(c, 'micro', !stampProblem(L, c.mx, c.my, ui.stamp));
    else if (t === 'erase') view.setCursor(c, 'micro', featuresAt(L, c.mx, c.my).length > 0);
    else view.setCursor(null);
    ui.hover(describe(c));
}

function tapAt(x, y) {
    if (mode !== 'build' || ui.anyScreen()) return;
    const c = view.pick(x, y);
    if (!c) return;
    const L = G.d.levels[cur];
    const t = ui.tool;
    if (t === 'paint') {
        if (c.cx <= 0 || c.cy <= 0 || c.cx >= L.w - 1 || c.cy >= L.h - 1) { audio.ui('nope'); ui.toast('The edge of the map stays solid rock.'); return; }
        const fam = TILES[L.tiles[c.cy * L.w + c.cx]].fam;
        if (fam === 'stairsUp' || fam === 'stairsDown') { audio.ui('nope'); ui.toast('The stairs stay where they are.'); return; }
        const had = G.params.pins.find((p) => p.l === cur && p.x === c.cx && p.y === c.cy);
        audio.ui('paint');
        queueApply((p) => {
            p.pins = p.pins.filter((q) => !(q.l === cur && q.x === c.cx && q.y === c.cy));
            if (!had || had.b !== ui.brush) p.pins.push({ l: cur, x: c.cx, y: c.cy, b: ui.brush });
        }, '');
    } else if (t === 'stamp') {
        const why = stampProblem(L, c.mx, c.my, ui.stamp);
        if (why) { audio.ui('nope'); ui.toast(`Can’t place that here: ${why}.`); return; }
        audio.ui('stamp');
        queueApply((p) => {
            p.erased = p.erased.filter((e) => !(e.l === cur && e.x === c.mx && e.y === c.my));
            p.stamps.push({ l: cur, x: c.mx, y: c.my, k: ui.stamp });
        }, '');
    } else if (t === 'erase') {
        const fs = featuresAt(L, c.mx, c.my);
        if (!fs.length) { audio.ui('nope'); return; }
        audio.ui('erase');
        queueApply((p) => {
            for (const f of fs) {
                const before = p.stamps.length;
                p.stamps = p.stamps.filter((e) => !(e.l === cur && e.x === f.mx && e.y === f.my));
                if (p.stamps.length === before) p.erased.push({ l: cur, x: f.mx, y: f.my });
            }
        }, '');
    } else {
        const d = describe(c);
        ui.hover(d);
        if (window.matchMedia?.('(pointer: coarse)').matches) ui.toast(d);
    }
    hoverAt(lastHover);
}

bindBuilderControls(canvas, view, {
    active: () => mode === 'build' && !ui.anyScreen(),
    onTap: (x, y) => tapAt(x, y),
    onHover: (x, y) => hoverAt(x === null ? null : { x, y }),
});

// ------------------------------------------------------------------ walking
function startWalk(tour = false) {
    if (mode === 'walk') return;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    document.activeElement?.blur?.();
    mode = 'walk';
    document.body.classList.add('walking');
    placeAt(G, cur, 'up');
    view.setMode('walk');
    view.showLevel(G.lv, false);
    updateInset();
    $('walk').hidden = false;
    $('walk-hint').classList.remove('gone');
    hintT = 6;
    input.walking = true;
    input.flush();
    audio.walking = true;
    bot = tour ? makeBot() : null;
    acc = 0;
    updateTouch();
    ui.walkHud(G);
    if (tour) ui.toast('🕯️ A little tour. Touch anything to take over.');
    else ui.toast(`🕯️ ${G.d.levels[G.lv].name}`);
}

function leaveWalk() {
    if (mode !== 'walk') return;
    mode = 'build';
    bot = null;
    input.walking = false;
    input.unlock();
    audio.walking = false;
    document.body.classList.remove('walking');
    $('walk').hidden = true;
    cur = G.lv;
    view.setMode('build');
    updateInset();
    view.showLevel(cur, false);
    view.setPins(G.params);
    view.frameLevel(false);
    ui.sync(G.params, G.d, cur);
    updateTouch();
}

$('btn-walk').addEventListener('click', () => { audio.ui('open'); startWalk(); });
$('btn-leave').addEventListener('click', () => { audio.ui('close'); leaveWalk(); });
$('btn-share').addEventListener('click', () => openShare());
$('btn-help').addEventListener('click', () => { audio.ui('open'); ui.openScreen('howto'); });
$('btn-settings').addEventListener('click', () => { audio.ui('open'); ui.openScreen('settings'); });
$('btn-undo').addEventListener('click', () => doUndo());
$('btn-run').addEventListener('pointerdown', (e) => { e.preventDefault(); input.run = !input.run; $('btn-run').classList.toggle('on', input.run); });
input.bindStick($('stick-zone'), $('stick'), document.querySelector('#stick .knob'));
input.bindLook($('look-zone'));

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    settings.seen = true;
    saveSettings(settings);
    const act = b.dataset.act;
    if (act === 'build') { ui.closeScreen('title'); document.activeElement?.blur?.(); }
    else if (act === 'walk') startWalk();
    else ui.openScreen(act);
});

function shareUrl() { return location.origin + location.pathname + '#' + encode(G.params); }
function openShare() {
    audio.ui('open');
    $('share-url').value = shareUrl();
    const p = G.params, edits = p.pins.length + p.stamps.length + p.erased.length;
    $('share-sum').textContent = `“${p.seed}” · ${G.d.levels.length} level${G.d.levels.length === 1 ? '' : 's'}${edits ? ` · ${edits} hand-made touch${edits === 1 ? '' : 'es'}` : ''}`;
    ui.openScreen('share');
}
$('btn-copy').addEventListener('click', async () => {
    const url = $('share-url').value;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* no clipboard permission */ }
    if (!ok) { $('share-url').select(); try { ok = document.execCommand('copy'); } catch { /* old API gone */ } }
    audio.ui('copy');
    ui.toast(ok ? '🔗 Link copied, ready to share' : 'Select the link and copy it');
});

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch'));
    ui.setTouch(on, mode === 'walk');
    $('walk-hint').textContent = on ? 'Left thumb to walk · drag on the right to look' : 'Click to look around · WASD to walk · Shift to hurry · Esc for the workbench';
}
input.onTouch = updateTouch;
document.addEventListener('pointerlockchange', () => {
    if (mode === 'walk' && !input.locked) { $('walk-hint').classList.remove('gone'); hintT = 4; }
});

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

// ------------------------------------------------------------------ keys
function handlePresses() {
    const press = input.next();
    if (!press) return;
    const k = press.key;
    if (ui.anyScreen()) {
        if (k === 'ArrowDown') ui.moveFocus(1);
        else if (k === 'ArrowUp') ui.moveFocus(-1);
        else if (k === 'Escape' && ui.top() !== 'title') { audio.ui('close'); ui.closeTop(); }
        else if (k === 'Escape' && ui.top() === 'title') { ui.closeScreen('title'); }
        return;
    }
    if (mode === 'walk') {
        if (bot && !['Escape'].includes(k)) { bot = null; ui.toast('You have the lantern now.'); }
        if (k === 'Escape' || k === 'Tab') leaveWalk();
        else if (k === 'KeyM') $('minimap').hidden = !$('minimap').hidden;
        return;
    }
    if (press.ctrl && k === 'KeyZ') { doUndo(); return; }
    if (k.startsWith('Digit')) { const n = +k.slice(5); if (n >= 1 && n <= 5) setLevel(n - 1); }
    else if (k === 'PageDown' || k === 'BracketRight') setLevel(cur + 1);
    else if (k === 'PageUp' || k === 'BracketLeft') setLevel(cur - 1);
    else if (k === 'KeyR') $('btn-dice').click();
    else if (k === 'KeyW' || k === 'Enter') startWalk();
    else if (k === 'KeyT') startWalk(true);
    else if (k === 'KeyF') view.frameLevel(false);
    else if (k === 'Escape') ui.setTool('look');
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        if (e.type === 'befriend') ui.toast(`💛 The ${ELEMENTS[e.kind].name} is your friend now`);
        else if (e.type === 'loot') ui.toast(`💰 ${ELEMENTS[e.kind].name}: +${e.value} gold`);
        else if (e.type === 'stairs') { $('fade').classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => $('fade').classList.remove('on'))); ui.toast(`${e.to > e.from ? '⬇️' : '⬆️'} ${e.name}`); }
        else if (e.type === 'exit') ui.toast('🌙 The way out… but it’s so cozy down here.');
    }
    if (ev.some((e) => e.type === 'befriend' || e.type === 'loot')) {
        const t = totals(G);
        if (G.friends === t.friends && Object.keys(G.found).length === t.friends + t.hoards) ui.toast('🏮 Every friend met and every hoard found. What a lovely dungeon!');
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'walk' && !ui.anyScreen();
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        const held = input.state();
        if (bot && (held.fx || held.sx || held.turn || input.look.dx || input.look.dy)) { bot = null; ui.toast('You have the lantern now.'); }
        const look = input.takeLook();
        let yaw = look.dx * 0.0024 * settings.look, pitch = -look.dy * 0.002 * settings.look;
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : { fx: held.fx, sx: held.sx, run: held.run, yaw: yaw + held.turn * WALK.turn * STEP, pitch };
            yaw = 0; pitch = 0;
            step(G, inp, STEP);
            acc -= STEP;
            n++;
            if (bot?.done) { bot = null; ui.toast('🏮 Tour’s over. Every friend met, every hoard found.'); }
        }
        hintT -= dt;
        if (hintT < 0 && input.locked) $('walk-hint').classList.add('gone');
        ui.walkHud(G);
        ui.minimap(G);
    } else acc = 0;
    flushEvents();
    audio.update();
    view.frame(G, dt, time);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { saveParams(G.params); input.clear(); } });
window.addEventListener('pagehide', () => saveParams(G.params));
window.addEventListener('hashchange', () => {
    const p = decode(location.hash);
    if (p && encode(p) !== encode(G.params)) applyParams((d) => Object.assign(d, p), 'Opened a shared dungeon');
});

// ------------------------------------------------------------------ welcome
if (shared) {
    $('welcome-text').textContent = `Someone shared a dungeon with you: ${G.d.levels.length} level${G.d.levels.length === 1 ? '' : 's'}, starting with ${G.d.levels[0].name}. Walk it by lantern light, or open the workbench and make it your own.`;
    const menu = $('title-menu');
    menu.prepend(menu.querySelector('[data-act="walk"]'));
    menu.querySelector('[data-act="walk"]').classList.add('primary');
    menu.querySelector('[data-act="build"]').classList.remove('primary');
    menu.querySelector('[data-act="build"]').textContent = 'Open the workbench';
}
/** Wait for the textures and the models (with a progress bar), compile the shaders, then lift the curtain. */
async function finishBoot() {
    setLoad('Painting the stone…', 0.2);
    const t0 = performance.now();
    const show = () => {
        const tx = progressState.textures || { total: 0, done: 0 }, md = progressState.models || { total: 0, done: 0 };
        const frac = 0.2 + 0.5 * (tx.total ? tx.done / tx.total : 1) + 0.2 * (md.total ? md.done / md.total : 1);
        const step = pending('textures') ? 'Painting the stone…' : 'Waking the residents…';
        setLoad(step, frac, `${tx.done} of ${tx.total} stones painted · ${md.done} of ${md.total} residents awake`);
    };
    const off = onProgress(show);
    show();
    // models are nice to have on the first frame but never worth more than a short wait
    while ((pending('textures') && performance.now() - t0 < 60000) || (pending('models') && performance.now() - t0 < 15000)) await sleep(100);
    off();
    setLoad('Lighting the lanterns…', 0.95, 'warming up the shaders');
    await nextPaint();
    try { await Promise.race([view.renderer.compileAsync(view.scene, view.camera), sleep(8000)]); } catch { /* compiled on the first frame instead */ }
    requestAnimationFrame((t) => { last = t; frame(t); });
    await nextPaint();
    await nextPaint();
    setLoad(null, 1);
    $('loading').classList.add('done');
    if (DEBUG) window.__lhBootMs = Math.round(performance.now());
    setTimeout(() => { $('loading').hidden = true; }, 700);
    onProgress(updateBusy);
    ui.openScreen('title');
}
finishBoot();

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__lh = {
        get G() { return G; },
        get mode() { return mode; },
        get cur() { return cur; },
        get bot() { return bot; },
        seen, view, ui, audio, input,
        apply: (fn, label) => applyParams(fn, label),
        setLevel, startWalk, leaveWalk, doUndo, shareUrl,
        undoDepth: () => undo.length,
        /** Walk the explorer bot ahead synchronously; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !b.done; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); return b.done; },
        /** Screen point of a micro cell's floor on the shown level (for real taps in the tests). */
        screenOf(mx, my, y = 0) {
            const v = new view.camera.position.constructor((mx + 0.5) * 2, y, (my + 0.5) * 2).project(view.camera);
            const r = canvas.getBoundingClientRect();
            return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
        },
    };
}
