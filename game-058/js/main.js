/**
 * main.js — Bumble Basket entry point: app state machine, input, saving,
 * and the glue between the sim (js/sim), the three.js view (js/view), the
 * DOM UI (ui.js) and sound (audio.js).
 *
 * Modes: title → map → (sense card) → intro → play ⇄ pause → win | lose
 *        picnic is play with no move limit; album and settings hang off the
 *        title and map.
 *
 * Library: three.js r165 via import map (see index.html).
 */

import * as THREE from 'three';
import {
    LEVELS, GARDENS, PICNIC_UNLOCK, KINDS, KIND_IDS, COLOURS, FAMILIES, SENSES,
    POWERS, MIN_CHAIN, GOLDEN_CHAIN, SAVE_KEY,
} from './config.js';
import { Game } from './sim/game.js';
import { findHint, bestChain } from './sim/search.js';
import { makeRng } from './sim/rng.js';
import {
    initScene, resize as resizeScene, fitBoard, setGarden, updateScene, render, renderer, camera,
    cellToWorld, toScreen, screenToCell, scene, applyQuality, clearBasket, setBasketSide,
} from './view/scene.js';
import { FX } from './view/fx.js';
import { BoardView } from './view/board.js';
import { Bee } from './view/bee.js';
import * as UI from './ui.js';
import { fruitThumb } from './view/thumbs.js';
import * as A from './audio.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const SEED_PARAM = new URLSearchParams(location.search).get('seed');
const $ = (id) => document.getElementById(id);

// ============================================================
// Save
// ============================================================

function defaultSave() {
    return {
        v: 1, stars: {}, best: {}, unlocked: 0, album: {}, picnicBest: 0, picnicOpen: false,
        sensesSeen: { kind: true }, tutorialDone: false,
        settings: { sound: true, music: true, fancy: true, gentle: false },
    };
}
function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const s = JSON.parse(raw);
            const d = defaultSave();
            return { ...d, ...s, settings: { ...d.settings, ...(s.settings ?? {}) }, sensesSeen: { ...d.sensesSeen, ...(s.sensesSeen ?? {}) } };
        }
    } catch { /* private mode or bad data */ }
    return defaultSave();
}
function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
const save = loadSave();

// ============================================================
// Boot
// ============================================================

const canvas = $('c');
initScene(canvas, { fancy: save.settings.fancy });
const fx = new FX(scene);
const board = new BoardView(fx);
const bee = new Bee(scene);
board.gentle = save.settings.gentle;
document.body.classList.toggle('gentle', save.settings.gentle);
A.setSound(save.settings.sound);
A.setMusic(save.settings.music);
UI.setVersion();

let mode = 'title';
let game = null;
let levelIndex = -1;       // -1 = picnic / demo
let busy = false;
let armed = -1;
let path = [];
let dragging = false;
let lastSample = null;
let lastNope = -1;
let idleT = 0;
let hintShown = false;
let gardenKey = '';
let demoT = 0;
let demoBusy = false;
let seedCounter = 0;

function nextSeed() {
    if (SEED_PARAM) return (Number(SEED_PARAM) || 1) + seedCounter++ * 7919;
    return (Date.now() ^ (Math.random() * 1e9)) >>> 0;
}

function useGarden(g, mask) {
    const key = `${g}|${mask}`;
    if (key === gardenKey) return;
    gardenKey = key;
    setGarden(g, mask);
}

// ============================================================
// Layout
// ============================================================

function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    setBasketSide(W > H * 1.15);
    let rect;
    if (mode === 'play' || mode === 'pause' || mode === 'win' || mode === 'lose') {
        rect = UI.freeRect();
    } else if (mode === 'title') {
        const card = document.querySelector('.title-card').getBoundingClientRect();
        rect = { left: 8, top: 44, right: W - 8, bottom: Math.max(card.top - 4, H * 0.4) };
        if (card.width < W * 0.6 && card.top < H * 0.3) rect = { left: card.right + 8, top: 8, right: W - 8, bottom: H - 8 };
    } else {
        const land = W > H && H < 520;
        rect = land ? { left: 6, top: 60, right: W - 86, bottom: H - 6 } : { left: 6, top: 76, right: W - 6, bottom: H - 104 };
    }
    fitBoard(rect);
    fx.setPixelScale(renderer.domElement.height, camera.fov);
}

function onResize() {
    resizeScene();
    layout();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
// Mobile URL bars slide in and out without always firing window resize.
window.visualViewport?.addEventListener('resize', onResize);
document.addEventListener('visibilitychange', () => {
    A.setHidden(document.hidden);
    if (document.hidden && mode === 'play') pause();
});

// ============================================================
// Screens & flow
// ============================================================

function setMode(m) {
    mode = m;
    UI.setHud(m === 'play' || m === 'pause' || m === 'win' || m === 'lose');
    requestAnimationFrame(layout);
}

function demoGame() {
    const spec = {
        g: 3, mask: 'full', moves: 999, goals: [], sizes: ['S', 'M', 'L'],
        kinds: [['apple', 3], 'orange', ['grape', 2], ['banana', 2], 'strawberry', 'blueberry', 'lemon', 'lime', ['peach', 2], 'pineapple', ['dragonfruit', 2], ['cherry', 2]],
    };
    return new Game(spec, { seed: nextSeed(), senses: ['kind', 'colour', 'size', 'family'] });
}

function toTitle() {
    endDrag(false);
    armed = -1;
    UI.powerHint(null);
    UI.hand(null);
    game = demoGame();
    levelIndex = -1;
    useGarden(0, 'full');
    clearBasket();
    board.build(game);
    setMode('title');
    UI.showScreen('title-screen');
    $('picnic-btn').disabled = !save.picnicOpen;
    $('picnic-btn').title = save.picnicOpen ? 'Endless picnic' : 'Finish Sunny Orchard to unlock';
}

function toMap() {
    endDrag(false);
    UI.hand(null);
    setMode('map');
    UI.renderMap(save, (li) => { A.sfxClick(); enterLevel(li); });
    UI.showScreen('map-screen');
}

function enterLevel(li) {
    const L = LEVELS[li];
    const senses = GARDENS[L.g].senses;
    const newest = senses[senses.length - 1];
    if (L.g > 0 && !save.sensesSeen[newest]) {
        prepareLevel(li);
        UI.renderSense(newest);
        setMode('sense');
        UI.showScreen('sense-screen');
        A.sfxSense();
        $('sense-ok').onclick = () => {
            A.sfxClick();
            save.sensesSeen[newest] = true;
            persist();
            showIntro(li);
        };
        return;
    }
    prepareLevel(li);
    showIntro(li);
}

function prepareLevel(li) {
    levelIndex = li;
    const L = LEVELS[li];
    game = new Game(L, { seed: nextSeed() });
    useGarden(L.g, L.mask);
    clearBasket();
    board.build(game);
}

function showIntro(li) {
    UI.renderIntro(li, LEVELS[li]);
    setMode('intro');
    UI.showScreen('intro-screen');
}

function startPlay() {
    UI.hideScreens();
    setMode('play');
    UI.buildTickets(game);
    UI.buildJars(game, onJarTap);
    refreshHud();
    idleT = 0;
    hintShown = false;
    if (levelIndex === 0 && !save.tutorialDone) setTimeout(() => showHint(true), 900);
}

function startPicnic() {
    const top = Math.min(save.unlocked, LEVELS.length - 1);
    const g = Math.max(0, Math.min(3, LEVELS[top].g));
    const senses = GARDENS[g].senses;
    const allowed = [
        ['apple', 'orange', 'grape', 'banana', 'pear', 'cherry'],
        ['apple', 'orange', 'grape', 'banana', 'pear', 'cherry', 'strawberry', 'blueberry', 'raspberry', 'lemon', 'lime'],
        ['apple', 'orange', 'grape', 'banana', 'pear', 'cherry', 'strawberry', 'blueberry', 'raspberry', 'lemon', 'lime', 'peach', 'mango'],
        KIND_IDS,
    ][g];
    const rng = makeRng(nextSeed());
    const kinds = rng.shuffle([...allowed]).map(k => ({ kind: k, colours: senses.includes('colour') ? KINDS[k].colours.slice() : [KINDS[k].colours[0]] }));
    const spec = {
        picnic: true, g, mask: 'full', moves: Infinity, goals: [],
        sizes: senses.includes('size') ? ['S', 'M', 'L'] : ['M'],
        kinds: kinds.slice(0, 5).map(k => [k.kind, k.colours.length]),
        extraKinds: kinds.slice(5), maxKinds: 10,
    };
    levelIndex = -1;
    game = new Game(spec, { seed: nextSeed(), senses });
    useGarden(g, 'full');
    clearBasket();
    board.build(game);
    startPlay();
    UI.toast('Picnic time!');
}

function refreshHud(filled = []) {
    if (!game) return;
    UI.updateTickets(game);
    UI.updateMoves(game);
    UI.updateScore(game.score);
    UI.updateJars(game, armed, filled);
    if (game.status === 'playing' && !game.picnic && game.movesLeft() <= 0) UI.powerHint('Out of moves — use your power-ups!');
}

function mergeAlbum() {
    const fresh = [];
    for (const k of game.found) {
        if (!save.album[k]) fresh.push(k);
        save.album[k] = (save.album[k] ?? 0) + 1;
    }
    return fresh;
}

async function onWin() {
    busy = true;
    UI.powerHint(null);
    const li = levelIndex;
    bee.cheer();
    fx.confetti(new THREE.Vector3(0, 0, 0), 90);
    UI.toast(LEVELS[li].finale ? 'Set complete!' : 'Basket full!', 1400);
    A.sfxWin();
    const fresh = mergeAlbum();
    save.stars[li] = Math.max(save.stars[li] ?? 0, game.stars);
    save.best[li] = Math.max(save.best[li] ?? 0, game.score);
    if (li >= save.unlocked) save.unlocked = Math.min(LEVELS.length, li + 1);
    if (save.unlocked >= PICNIC_UNLOCK) save.picnicOpen = true;
    if (li === 0) save.tutorialDone = true;
    persist();
    await wait(1300);
    if (mode !== 'play') { busy = false; return; }
    setMode('win');
    UI.renderWin(game, li, fresh, (i) => A.sfxStar(i));
    UI.showScreen('win-screen');
    busy = false;
}

function onLose() {
    UI.powerHint(null);
    A.sfxLose();
    mergeAlbum();
    persist();
    setMode('lose');
    UI.renderGoalsInto('lose-goals', game);
    $('lose-more').disabled = game.continued;
    UI.showScreen('lose-screen');
}

function endPicnic() {
    const fresh = mergeAlbum();
    save.picnicBest = Math.max(save.picnicBest, game.score);
    persist();
    setMode('result');
    UI.renderPicnicEnd(game, save.picnicBest, fresh);
    UI.showScreen('picnic-screen');
}

const wait = (ms) => new Promise(res => setTimeout(res, ms));

// ============================================================
// Actions
// ============================================================

const CHEERS = [[15, 'Un-bee-lievable!'], [12, 'Bee-utiful!'], [9, 'Juicy!'], [7, 'Sweet!']];

async function run(events) {
    if (!events) return;
    busy = true;
    board.clearTrail();
    fx.clearTrail();
    UI.chainCount(null);
    board.setHint(null);
    UI.hand(null);
    handPath = null;
    hintShown = false;
    const filled = game.takeFilledJars();
    UI.updateTickets(game);
    UI.updateMoves(game);
    UI.updateScore(game.score);
    UI.updateJars(game, armed, filled);
    if (filled.length) {
        setTimeout(() => {
            A.sfxJar();
            UI.toast(`${POWERS[game.jars[filled[0]].power].icon} ${POWERS[game.jars[filled[0]].power].label}!`);
        }, 350);
    }
    await board.play(events, game);
    busy = false;
    idleT = 0;
    refreshHud();
    if (game.status === 'won') onWin();
    else if (game.status === 'lost') onLose();
}

function onJarTap(i) {
    if (mode !== 'play' || busy || !game) return;
    A.initAudio();
    const jar = game.jars[i];
    idleT = 0;
    if (jar.charges <= 0) {
        A.sfxNope();
        const need = jar.need - jar.fill;
        UI.powerHint(`Collect ${need} more ${UI.traitLabel(jar.sense, jar.target)} to earn ${POWERS[jar.power].icon} ${POWERS[jar.power].label}`);
        setTimeout(() => { if (armed < 0) UI.powerHint(null); }, 2200);
        return;
    }
    if (jar.power === 'rainbow') {
        const ev = game.usePower(i);
        if (ev) {
            A.sfxRainbow();
            UI.toast('🌈 Rainbow Wings!');
            UI.powerHint('Your next trail can hop between any fruit!');
            setTimeout(() => UI.powerHint(null), 2200);
            refreshHud();
        }
        return;
    }
    if (armed === i) {
        armed = -1;
        UI.powerHint(null);
    } else {
        armed = i;
        A.sfxArm();
        UI.powerHint(`${POWERS[jar.power].icon} ${POWERS[jar.power].tip}`);
    }
    UI.updateJars(game, armed);
}

function usePowerAt(r, c) {
    const i = armed;
    const ev = game.usePower(i, r, c);
    if (!ev) { A.sfxNope(); board.nudge(r, c); return; }
    armed = -1;
    UI.powerHint(null);
    run(ev);
}

// ============================================================
// Input: drawing a trail
// ============================================================

function cellOf(hit) {
    const r = Math.round(hit.r), c = Math.round(hit.c);
    return { r, c, d: Math.hypot(hit.r - r, hit.c - c) };
}

function linkColour(traits, b) {
    const t = traits[0];
    if (t === 'golden') return { hex: 0xffd040, css: '#ffc020', label: 'golden!' };
    if (t === 'rainbow') return { hex: 0xff7ad0, css: '#ff7ad0', label: 'rainbow!' };
    if (t === 'colour') return { hex: COLOURS[b.colour].hex, css: COLOURS[b.colour].css, label: SENSES.colour.hop };
    if (t === 'size') return { hex: 0x8ac8ff, css: '#5aa8ff', label: SENSES.size.hop };
    if (t === 'family') return { hex: new THREE.Color(FAMILIES[b.family].css).getHex(), css: FAMILIES[b.family].css, label: `${FAMILIES[b.family].label}!` };
    return { hex: 0xffb72b, css: '#ffb72b', label: SENSES.kind.hop };
}

function trailColours() {
    const out = [];
    for (let i = 1; i < path.length; i++) {
        const a = game.cells[path[i - 1][0]][path[i - 1][1]].fruit;
        const b = game.cells[path[i][0]][path[i][1]].fruit;
        out.push(linkColour(game.linkTraits(a, b), b).hex);
    }
    return out;
}

function candidates() {
    if (!path.length) return [];
    const [lr, lc] = path[path.length - 1];
    const out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (game.canExtend(path, lr + dr, lc + dc)) out.push([lr + dr, lc + dc]);
    }
    return out;
}

function refreshTrail() {
    board.setTrail(path, candidates());
}

function tryCell(r, c, d) {
    if (d > 0.44 || !game.inBounds(r, c)) return;
    const last = path[path.length - 1];
    if (last && last[0] === r && last[1] === c) return;
    const prev = path[path.length - 2];
    if (prev && prev[0] === r && prev[1] === c) {
        path.pop();
        A.sfxUndo();
        A.buzzPitch(path.length);
        refreshTrail();
        return;
    }
    if (!last || !Game.adjacent(last, [r, c])) return;
    if (path.some(([pr, pc]) => pr === r && pc === c)) return;
    if (game.canExtend(path, r, c)) {
        const a = game.cells[last[0]][last[1]].fruit, b = game.cells[r][c].fruit;
        path.push([r, c]);
        lastNope = -1;
        A.sfxHop(path.length - 1);
        A.buzzPitch(path.length);
        const lc = linkColour(game.linkTraits(a, b), b);
        // Tag the middle of the hop; the count bubble sits over the new fruit.
        const mid = cellToWorld(last[0], last[1]).add(cellToWorld(r, c)).multiplyScalar(0.5).setY(0.9);
        const p = toScreen(mid);
        UI.linkTag(lc.label, lc.css, p.x, p.y);
        if (path.length === GOLDEN_CHAIN) fx.sparkle(cellToWorld(r, c), 0xffe066, 10);
        refreshTrail();
    } else {
        const key = r * game.cols + c;
        if (key !== lastNope && game.selectable(r, c)) {
            lastNope = key;
            A.sfxNope();
            board.nudge(r, c);
        }
    }
}

function onDown(e) {
    if (mode !== 'play' || busy || !game || game.status !== 'playing') return;
    A.initAudio();
    idleT = 0;
    board.setHint(null);
    const hit = screenToCell(e.clientX, e.clientY);
    if (!hit) return;
    const { r, c, d } = cellOf(hit);
    if (!game.inBounds(r, c) || d > 0.62) return;
    if (armed >= 0) { usePowerAt(r, c); return; }
    if (game.movesLeft() <= 0) { UI.powerHint('Out of moves — use your power-ups!'); return; }
    if (!game.selectable(r, c)) {
        if (game.cells[r][c].fruit?.frost) UI.toast('Frozen! Pick next to it.', 900);
        A.sfxNope();
        board.nudge(r, c);
        return;
    }
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragging = true;
    path = [[r, c]];
    lastSample = hit;
    lastNope = -1;
    A.startBuzz();
    A.sfxHop(0);
    bee.follow(hit.point);
    refreshTrail();
}

function onMove(e) {
    if (!dragging) return;
    const hit = screenToCell(e.clientX, e.clientY);
    if (!hit) return;
    bee.follow(hit.point);
    // Sample along the segment so fast swipes don't skip cells.
    const dr = hit.r - lastSample.r, dc = hit.c - lastSample.c;
    const steps = Math.max(1, Math.ceil(Math.hypot(dr, dc) / 0.2));
    for (let i = 1; i <= steps; i++) {
        const fr = lastSample.r + dr * (i / steps), fc = lastSample.c + dc * (i / steps);
        const { r, c, d } = cellOf({ r: fr, c: fc });
        tryCell(r, c, d);
    }
    lastSample = hit;
}

function endDrag(commit = true) {
    if (!dragging) return;
    dragging = false;
    A.stopBuzz();
    bee.idle();
    const p = path;
    path = [];
    board.clearTrail();
    fx.clearTrail();
    UI.chainCount(null);
    if (!commit || !game) return;
    if (p.length >= MIN_CHAIN) {
        const ev = game.playChain(p);
        if (ev) {
            const n = p.length;
            const cheer = CHEERS.find(([k]) => n >= k);
            if (cheer) setTimeout(() => UI.toast(cheer[1]), 150);
            const end = toScreen(cellToWorld(p[n - 1][0], p[n - 1][1]).setY(1.4));
            UI.floater(`+${10 * n * n}`, end.x, end.y);
            if (levelIndex === 0 && !save.tutorialDone) { save.tutorialDone = true; persist(); }
            run(ev);
        }
    } else if (p.length === 2) {
        UI.toast('Need 3 or more!', 800);
    }
}

canvas.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', () => endDrag(true));
window.addEventListener('pointercancel', () => endDrag(true));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (armed >= 0) { armed = -1; UI.powerHint(null); UI.updateJars(game, armed); return; }
        if (mode === 'play') return pause();
        if (mode === 'pause') return resume();
    }
    if ((e.key === 'p' || e.key === 'P') && (mode === 'play' || mode === 'pause')) return mode === 'play' ? pause() : resume();
    if ((e.key === 'h' || e.key === 'H') && mode === 'play') showHint(false);
});

/** The bubble over the newest fruit: trail length, and how close golden is. */
function updateChainCount() {
    if (!path.length) { UI.chainCount(null); return; }
    const [r, c] = path[path.length - 1];
    const p = toScreen(cellToWorld(r, c).setY(1.35));
    const n = path.length;
    const note = n >= GOLDEN_CHAIN ? 'golden!' : n === GOLDEN_CHAIN - 1 ? '1 more for golden!' : n < MIN_CHAIN ? `${MIN_CHAIN - n} more` : '';
    UI.chainCount(n, note, p.x, p.y, n >= GOLDEN_CHAIN, n >= MIN_CHAIN);
}

// ============================================================
// Hints
// ============================================================

let handPath = null, handT = 0;
function showHint(withHand) {
    if (!game || busy || dragging || game.status !== 'playing') return;
    const h = findHint(game);
    if (!h) return;
    board.setHint(h);
    hintShown = true;
    handPath = withHand ? h.slice(0, Math.min(h.length, 4)) : null;
    handT = 0;
}

function updateHand(dt) {
    if (!handPath || dragging || busy) { UI.hand(null); return; }
    handT += dt;
    const seg = 0.55;
    const total = seg * (handPath.length - 1) + 0.9;
    const t = handT % total;
    const i = Math.min(handPath.length - 2, Math.floor(t / seg));
    const k = Math.min(1, (t - i * seg) / seg);
    const a = cellToWorld(...handPath[i]), b = cellToWorld(...handPath[i + 1]);
    const p = toScreen(a.lerp(b, k * k * (3 - 2 * k)).setY(0.4));
    UI.hand(p.x, p.y);
}

// ============================================================
// Pause & buttons
// ============================================================

function pause() {
    if (mode !== 'play' || busy) return;
    endDrag(false);
    setMode('pause');
    UI.renderGoalsInto('pause-goals', game);
    $('pause-goals').classList.toggle('hidden', !!game.picnic);
    $('pause-map').textContent = game.picnic ? 'Pack up' : 'Map';
    $('pause-restart').textContent = game.picnic ? 'New picnic' : 'Restart';
    UI.setToggle('pause-sound', save.settings.sound);
    UI.setToggle('pause-music', save.settings.music);
    UI.showScreen('pause-screen');
}
function resume() {
    UI.hideScreens();
    setMode('play');
}

function restart() {
    if (game?.picnic) return startPicnic();
    prepareLevel(levelIndex);
    UI.hideScreens();
    startPlay();
}

const click = (id, fn) => $(id).addEventListener('click', (e) => { A.initAudio(); A.sfxClick(); fn(e); });

click('play-btn', toMap);
click('picnic-btn', startPicnic);
click('album-btn', () => openAlbum('title'));
click('settings-btn', () => openSettings('title'));
click('map-back', toTitle);
click('map-picnic', startPicnic);
click('map-album', () => openAlbum('map'));
click('intro-go', startPlay);
click('intro-back', toMap);
click('pause-btn', pause);
click('pause-resume', resume);
click('pause-restart', restart);
click('pause-map', () => { if (game?.picnic) endPicnic(); else toMap(); });
click('pause-sound', () => { toggleSetting('sound'); UI.setToggle('pause-sound', save.settings.sound); });
click('pause-music', () => { toggleSetting('music'); UI.setToggle('pause-music', save.settings.music); });
click('win-map', toMap);
click('win-replay', () => { prepareLevel(levelIndex); UI.hideScreens(); startPlay(); });
click('win-next', () => {
    const next = levelIndex + 1;
    if (next >= LEVELS.length) return startPicnic();
    enterLevel(next);
});
click('lose-more', () => {
    if (game.continueGame()) {
        UI.hideScreens();
        setMode('play');
        refreshHud();
        UI.toast('+5 moves!');
    }
});
click('lose-retry', restart);
click('lose-map', toMap);
click('picnic-map', toMap);
click('picnic-again', startPicnic);
click('album-back', () => (albumFrom === 'map' ? toMap() : toTitle()));
click('set-close', () => (settingsFrom === 'map' ? toMap() : toTitle()));
click('set-sound', () => toggleSetting('sound'));
click('set-music', () => toggleSetting('music'));
click('set-fancy', () => toggleSetting('fancy'));
click('set-motion', () => toggleSetting('gentle'));
click('set-reset', () => {
    if (!confirm('Reset all stars, stamps and senses?')) return;
    const keep = save.settings;
    Object.assign(save, defaultSave(), { settings: keep });
    persist();
    toTitle();
});

let albumFrom = 'title', settingsFrom = 'title';
function openAlbum(from) {
    albumFrom = from;
    setMode('album');
    UI.renderAlbum(save);
    UI.showScreen('album-screen');
}
function openSettings(from) {
    settingsFrom = from;
    setMode('settings');
    renderSettings();
    UI.showScreen('settings-screen');
}
function renderSettings() {
    UI.setToggle('set-sound', save.settings.sound);
    UI.setToggle('set-music', save.settings.music);
    UI.setToggle('set-fancy', save.settings.fancy);
    UI.setToggle('set-motion', save.settings.gentle);
}
function toggleSetting(k) {
    save.settings[k] = !save.settings[k];
    if (k === 'sound') A.setSound(save.settings.sound);
    if (k === 'music') A.setMusic(save.settings.music);
    if (k === 'fancy') { applyQuality(save.settings.fancy); onResize(); }
    if (k === 'gentle') { board.gentle = save.settings.gentle; document.body.classList.toggle('gentle', save.settings.gentle); }
    persist();
    renderSettings();
}

// ============================================================
// Hooks: view events → sound & words
// ============================================================

let landT = 0;
board.hooks = {
    pop: (i, n) => { if (mode === 'play' || mode === 'win') A.sfxPop(i, n); },
    land: (basket) => {
        const now = performance.now();
        if (now - landT < 70) return;
        landT = now;
        if (mode === 'play' || mode === 'win') basket ? A.sfxLand() : A.sfxDrop();
    },
    chainStart: (ev, stagger) => {
        bee.zip(ev.items.map(it => cellToWorld(it.r, it.c)), Math.max(0.05, stagger));
    },
    golden: () => { if (mode === 'play') { A.sfxGolden(); UI.toast('✨ Golden fruit!'); } },
    leaf: () => { if (mode === 'play') A.sfxLeaf(); },
    thaw: () => { if (mode === 'play') A.sfxThaw(); },
    shuffle: () => { if (mode === 'play') { A.sfxShuffle(); UI.toast('Shake shake!'); } },
    bomb: () => A.sfxBomb(),
    honey: () => A.sfxHoney(),
    paint: () => A.sfxPaint(),
    basket: (n) => { A.sfxBasket(); UI.toast(`🧺 Basket ${n} full!`); bee.cheer(); },
};

// ============================================================
// Frame loop
// ============================================================

let last = performance.now();
let elapsed = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    tick(dt);
    render();
}

function tick(dt) {
    board.update(dt);
    bee.update(dt, elapsed);
    fx.update(dt, elapsed);
    updateScene(dt, save.settings.gentle);
    if (dragging && game) {
        fx.setTrail(path, trailColours(), lastSample?.point, elapsed, game.wild);
        updateChainCount();
        fx.setCandidates(candidates(), elapsed);
    }
    if (mode === 'play' && game && !busy && !dragging && game.status === 'playing') {
        idleT += dt;
        if (!hintShown && idleT > 7) showHint(false);
    }
    updateHand(dt);
    // The title screen's bee plays by itself.
    if (mode === 'title' && game && !demoBusy) {
        demoT += dt;
        if (demoT > 2.6) {
            demoT = 0;
            const res = bestChain(game, (p) => p.length + Math.random() * 2, { maxLen: 7, budget: 1500 });
            const ev = res && game.playChain(res.path);
            if (ev) { demoBusy = true; board.play(ev, game).then(() => { demoBusy = false; }); }
        }
    }
}

requestAnimationFrame(frame);
toTitle();
onResize();
$('loading').classList.add('hidden');

// ============================================================
// Debug hooks (?debug=1)
// ============================================================

if (DEBUG) {
    window.__bb = {
        get game() { return game; },
        get mode() { return mode; },
        get busy() { return busy; },
        get armed() { return armed; },
        save,
        board, bee, fx,
        LEVELS,
        /** Jump straight into a level (skips cards). */
        start(li) { prepareLevel(li); save.sensesSeen = { kind: true, colour: true, size: true, family: true }; UI.hideScreens(); startPlay(); board.fastForward(); },
        picnic() { startPicnic(); board.fastForward(); },
        /** Screen position (CSS px) of a cell's fruit. */
        cellScreen(r, c) { return toScreen(cellToWorld(r, c).setY(0.4)); },
        /** Finish all running animations now. */
        finish() { board.fastForward(); },
        best(maxLen = 8, goalWeight = 1) { return bestChain(game, (p) => p.length + game.goalValue(p) * goalWeight, { maxLen, budget: 8000 })?.path; },
        play(p) { const ev = game.playChain(p); if (ev) run(ev); return !!ev; },
        give(power) { const j = game.jars.find(j => j.power === power); if (j) { j.charges = Math.max(1, j.charges); refreshHud(); } return !!j; },
        win() {
            for (const g of game.goals) g.have = g.n - 1;
            refreshHud();
        },
        setMoves(n) { game.moves = game.movesUsed + n; refreshHud(); },
        layout,
        freeRect: UI.freeRect,
        thumb: fruitThumb,
        trail() { return path.map(p => [...p]); },
    };
}
