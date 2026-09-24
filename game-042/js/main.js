// ============================================================
// POPGUN PIP — boot, layout, the fixed-step loop and the screen state
// machine (title → map → card → play ⇄ pause → clear / game over / ending).
// ============================================================

import { STEP, WORLDS, GADGETS, WEAPON_ORDER, KEEP_SHARDS, START_LIVES, LEVELS_PER_WORLD, MAX_HEARTS } from './config.js';
import { Art } from './art.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { generateLevel } from './levelgen.js';
import { newSave, loadSave, writeSave, eraseSave, loadOpts, writeOpts, profileOf } from './save.js';
import { drawTitle, drawMap, drawCard, drawPause, drawGadget, drawGameOver, drawEnding, nodePositions } from './screens.js';
import { initAudio, resumeAudio, suspendAudio, play, jingle, playSong, stopMusic, musicTick, songFor, MOODS, setSound, setMusic, isSoundOn, isMusicOn, currentSong } from './audio.js';

const canvas = document.getElementById('screen');
const stage = document.getElementById('stage');
const deck = document.getElementById('deck');
const pauseBtn = document.getElementById('b-pause');
const backLink = document.getElementById('back');

function fail(msg) {
    const el = document.getElementById('fail');
    if (el) { el.textContent = msg; el.hidden = false; }
}

let art, R;
try {
    art = new Art();
    R = new Renderer(canvas, art);
} catch (err) {
    fail('POPGUN PIP could not start its graphics: ' + err.message);
    throw err;
}
const input = new Input();
const opts = loadOpts();
setSound(opts.sound); setMusic(opts.music);

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const view = {
    screen: 'title', t: 0, st: 0, sel: 0, buttons: [], lastButtons: [],
    touch: coarse, portrait: false, overlay: null, pauseSel: 0, flash: 0,
    mapWorld: 1, mapSel: 0, walk: null, confirmErase: false, endSel: 0, cardT: 0,
    hudTop: 0, hudRight: 0,
};

let save = loadSave();
let game = null, level = null, run = null, profile = null;
let cur = { world: 1, index: 1, fromCheckpoint: false };
const levels = new Map();

// ------------------------------------------------------------ layout
// The canvas backing store IS the game's pixel buffer; CSS scales it by a
// whole number of device pixels (s), so pixels stay square and crisp.
function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const safe = getComputedStyle(document.getElementById('safe'));
    const st = parseFloat(safe.paddingTop) || 0, sb = parseFloat(safe.paddingBottom) || 0;
    const portrait = view.touch && vh > vw * 1.05;
    view.portrait = portrait;
    document.body.classList.toggle('touch', view.touch);
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('landscape', view.touch && !portrait);
    let areaW = vw, areaH = vh, areaTop = 0;
    if (portrait) {
        const deckH = Math.round(Math.min(310, Math.max(200, vh * 0.36)) + sb);
        areaTop = st;
        areaH = vh - deckH - st;
        document.documentElement.style.setProperty('--deckH', deckH + 'px');
    }
    const devW = areaW * dpr, devH = areaH * dpr;
    let s = Math.max(1, Math.min(Math.floor(devH / 200), Math.floor(devW / (portrait ? 208 : 300))));
    let W = Math.floor(devW / s), H = Math.floor(devH / s);
    W = Math.min(W, 480); H = Math.min(H, 320);
    if (W < 180 || H < 150) { s = Math.max(1, s - 1); W = Math.min(480, Math.floor(devW / s)); H = Math.min(320, Math.floor(devH / s)); }
    R.resize(W, H);
    const cssW = W * s / dpr, cssH = H * s / dpr;
    const snap = v => Math.round(v * dpr) / dpr;
    stage.style.left = '0px'; stage.style.top = areaTop + 'px';
    stage.style.width = areaW + 'px'; stage.style.height = areaH + 'px';
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.style.left = snap((areaW - cssW) / 2) + 'px';
    canvas.style.top = snap((areaH - cssH) / 2) + 'px';
    view.scale = s; view.dpr = dpr;
    view.cssPerPx = s / dpr;
    // keep the HUD clear of the floating pause button in landscape touch mode
    view.hudRight = view.touch && !portrait ? Math.ceil(56 / view.cssPerPx) : 0;
    if (game) { game.viewW = W; game.viewH = H; }
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 100));

// ------------------------------------------------------------ input wiring
input.bindDeck(document.getElementById('dpad'), [
    [document.getElementById('b-jump'), 'jump'],
    [document.getElementById('b-fire'), 'fire'],
    [document.getElementById('b-swap'), 'swap'],
]);
pauseBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); initAudio(); resumeAudio();
    if (view.screen === 'play' && !view.overlay) openPause();
    else if (view.screen === 'play' && view.overlay === 'pause') closePause();
    else if (view.screen === 'map') toTitle();
});
input.onDevice = d => {
    if (d === 'touch' && !view.touch) { view.touch = true; layout(); }
};
input.onKey = (code) => {
    initAudio(); resumeAudio();
    if (code === 'KeyM') { toggleMusic(); return; }
    if (code === 'Escape') {
        if (view.screen === 'play') { if (view.overlay === 'pause') closePause(); else if (!view.overlay) openPause(); }
        else if (view.screen === 'map') toTitle();
        else if (view.screen === 'title' && view.confirmErase) { view.confirmErase = false; view.sel = 0; }
    }
};
const unlock = () => { initAudio(); resumeAudio(); };
window.addEventListener('pointerup', unlock);
window.addEventListener('touchend', unlock);

canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    unlock();
    if (e.pointerType === 'touch' && !view.touch) { view.touch = true; layout(); }
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * R.W, y = (e.clientY - r.top) / r.height * R.H;
    const b = view.lastButtons.slice().reverse().find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    if (b) press(b.id);
    else if (view.screen === 'card' && view.cardT > 0.4) view.cardT = 99;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { suspendAudio(); if (view.screen === 'play' && !view.overlay) openPause(); }
    else resumeAudio();
});

// ------------------------------------------------------------ progress helpers
const key = (w, i) => `${w}-${i}`;
const isCleared = (w, i) => !!save && save.cleared.includes(key(w, i));
const totalShards = () => (save ? save.shards.length : 0);
function isUnlocked(w, i) {
    if (!save) return false;
    if (w === 1 && i === 1) return true;
    if (w === 5 && i === 5 && totalShards() < KEEP_SHARDS) return false;
    if (i === 1) return isCleared(w - 1, LEVELS_PER_WORLD);
    return isCleared(w, i - 1);
}
function unlockedWorlds() { let n = 1; for (let w = 2; w <= 5; w++) if (isUnlocked(w, 1)) n = w; return n; }
function levelInfo(w) {
    return i => {
        const locked = !isUnlocked(w, i);
        const shards = [0, 1, 2].map(k => save.shards.includes(`${w}-${i}-${k}`));
        let lockText = null;
        if (locked && w === 5 && i === 5 && isCleared(5, 4)) lockText = `NEEDS ${KEEP_SHARDS} SHARDS (${totalShards()})`;
        return { locked, cleared: isCleared(w, i), shards, gates: save.seen[key(w, i)] || null, lockText };
    };
}
function persist() {
    if (!save) return;
    if (run) { save.score = run.score; save.coins = run.coins; save.lives = run.lives; save.hi = Math.max(save.hi || 0, run.score); }
    writeSave(save);
}
function getLevel(w, i) {
    const k = key(w, i);
    if (!levels.has(k)) levels.set(k, generateLevel(save.seed, w, i));
    return levels.get(k);
}

// ------------------------------------------------------------ music
function levelSong() {
    if (!level) return;
    if (level.castle) playSong('castle' + level.world, songFor('castle', MOODS.castle, level.world));
    else playSong(`lv${level.world}-${level.index}`, songFor('level', WORLDS[level.world - 1].mood, save.seed * 31 + level.world * 7 + level.index));
}
function gameSong() {
    if (game && game.player.star > 0) playSong('star', songFor('star', MOODS.star));
    else if (game && game.boss && !game.boss.dead) playSong('boss', songFor('boss', MOODS.boss, level.world));
    else levelSong();
}
function toggleMusic() { opts.music = !isMusicOn(); setMusic(opts.music); writeOpts(opts); }
function toggleSound() { opts.sound = !isSoundOn(); setSound(opts.sound); writeOpts(opts); }

// ------------------------------------------------------------ screen changes
function titleItems() {
    if (view.confirmErase) return [{ id: 'eraseYes', label: 'YES, START OVER', color: '#F85898' }, { id: 'eraseNo', label: 'NO, KEEP IT' }];
    const items = [];
    if (save) items.push({ id: 'continue', label: 'CONTINUE' });
    items.push({ id: 'new', label: 'NEW GAME' });
    items.push({ id: 'music', label: 'MUSIC ' + (isMusicOn() ? 'ON' : 'OFF') });
    items.push({ id: 'sound', label: 'SOUND ' + (isSoundOn() ? 'ON' : 'OFF') });
    return items;
}
function pauseItems() {
    return [
        { id: 'resume', label: 'RESUME' },
        { id: 'exit', label: 'EXIT TO MAP' },
        { id: 'music', label: 'MUSIC ' + (isMusicOn() ? 'ON' : 'OFF') },
        { id: 'sound', label: 'SOUND ' + (isSoundOn() ? 'ON' : 'OFF') },
    ];
}

function setScreen(s) {
    view.screen = s; view.st = 0; view.sel = 0;
    view.buttons = []; view.lastButtons = [];
    const inPlay = s === 'play' || s === 'card';
    backLink.classList.toggle('hide', inPlay && view.overlay !== 'pause');
    pauseBtn.hidden = !(s === 'play');
    input.clearEdges();
}

function toTitle() {
    persist();
    game = null; view.overlay = null;
    setScreen('title');
    playSong('title', songFor('title', MOODS.title));
}

function startNew() {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    eraseSave();
    save = newSave(seed);
    levels.clear();
    writeSave(save);
    toMap(1, 0);
}

function toMap(world, node) {
    persist();
    game = null; view.overlay = null;
    if (world !== undefined) { view.mapWorld = world; view.mapSel = node; save.at = { world, node }; }
    else { view.mapWorld = save.at.world || 1; view.mapSel = save.at.node || 0; }
    view.walk = null;
    setScreen('map');
    playSong('map', songFor('map', MOODS.map));
}

function enterLevel(w, i, fromCheckpoint = false) {
    if (!isUnlocked(w, i)) { play('deny'); return; }
    cur = { world: w, index: i, fromCheckpoint };
    save.at = { world: w, node: i - 1 };
    stopMusic();
    view.cardT = 0; view.cardLoaded = false;
    setScreen('card');
}

function beginPlay() {
    level = getLevel(cur.world, cur.index);
    save.seen[key(cur.world, cur.index)] = level.gates;
    profile = profileOf(save);
    run = { score: save.score, coins: save.coins, lives: save.lives };
    const wIdx = game && game.level === level ? game.player.weaponIdx : 0;
    game = new Game(level, profile, run, { checkpoint: cur.fromCheckpoint, weaponIdx: wIdx });
    game.viewW = R.W; game.viewH = R.H;
    game.snapCamera();
    persist();
}

function openPause() { view.overlay = 'pause'; view.pauseSel = 0; play('pause'); backLink.classList.remove('hide'); input.clearEdges(); }
function closePause() { view.overlay = null; backLink.classList.add('hide'); input.clearEdges(); }

// ------------------------------------------------------------ taps and menu actions
function press(id) {
    play('menu');
    switch (view.screen) {
        case 'title': return titleAction(id);
        case 'map': return mapAction(id);
        case 'play':
            if (view.overlay === 'pause') return pauseAction(id);
            if (view.overlay === 'gadget' && id === 'ok') return gadgetDone();
            return;
        case 'gameover': if (id === 'continue') { run = null; save.lives = START_LIVES; persist(); toMap(); } return;
        case 'ending': if (id === 'keepplaying') toMap(5, 4); else if (id === 'totitle') toTitle(); return;
    }
}

function titleAction(id) {
    switch (id) {
        case 'continue': toMap(); break;
        case 'new': if (save) { view.confirmErase = true; view.sel = 1; } else startNew(); break;
        case 'eraseYes': view.confirmErase = false; startNew(); break;
        case 'eraseNo': view.confirmErase = false; view.sel = 0; break;
        case 'music': toggleMusic(); break;
        case 'sound': toggleSound(); break;
    }
}

function mapAction(id) {
    if (id === 'play') return enterLevel(view.mapWorld, view.mapSel + 1);
    if (id === 'prevWorld') return switchWorld(-1);
    if (id === 'nextWorld') return switchWorld(1);
    if (id.startsWith('node')) {
        const i = Number(id.slice(4));
        if (!isUnlocked(view.mapWorld, i + 1)) { play('deny'); view.mapSel = i; return; }
        if (i === view.mapSel) enterLevel(view.mapWorld, i + 1);
        else walkTo(i);
    }
}

function walkTo(i) {
    const nodes = nodePositions(R.W, R.H);
    view.walk = { from: nodes[view.mapSel], to: nodes[i], t: 0, dir: i > view.mapSel ? 1 : -1 };
    view.mapSel = i;
    save.at = { world: view.mapWorld, node: i };
}

function switchWorld(d) {
    const w = view.mapWorld + d;
    if (w < 1 || w > 5 || (d > 0 && unlockedWorlds() < w)) { play('deny'); return; }
    view.mapWorld = w;
    view.mapSel = d > 0 ? 0 : 4;
    while (view.mapSel > 0 && !isUnlocked(w, view.mapSel + 1)) view.mapSel--;
    save.at = { world: w, node: view.mapSel };
    play('select');
}

function pauseAction(id) {
    switch (id) {
        case 'resume': closePause(); break;
        case 'exit': run && persist(); toMap(cur.world, cur.index - 1); break;
        case 'music': toggleMusic(); break;
        case 'sound': toggleSound(); break;
    }
}

// ------------------------------------------------------------ game events
function applyItem(item) {
    if (GADGETS.includes(item)) {
        if (!save.gadgets.includes(item)) save.gadgets.push(item);
        if ((item === 'frost' || item === 'rocket') && !save.weapons.includes(item)) save.weapons.push(item);
    } else if (item === 'spread') {
        if (!save.weapons.includes('spread')) save.weapons.push('spread');
    } else if (item === 'heart') {
        save.maxHearts = Math.min(MAX_HEARTS, save.maxHearts + 1);
    } else if (item === 'chip') {
        save.chips++;
    }
    save.weapons.sort((a, b) => WEAPON_ORDER.indexOf(a) - WEAPON_ORDER.indexOf(b));
    // live-update the running game
    if (game) {
        const cw = game.weapon;
        profile.gadgets = new Set(save.gadgets);
        profile.weapons.length = 0; profile.weapons.push(...save.weapons);
        profile.maxHearts = save.maxHearts;
        profile.chips = save.chips;
        game.ab.boots = profile.gadgets.has('boots'); game.ab.mitts = profile.gadgets.has('mitts');
        if (item === 'heart') game.player.hp = profile.maxHearts;
        game.player.weaponIdx = Math.max(0, profile.weapons.indexOf(item === 'spread' || item === 'frost' || item === 'rocket' ? item : cw));
    }
}

function handleEvent(e) {
    switch (e.type) {
        case 'sfx': play(e.name); break;
        case 'shake': game.shake = Math.max(game.shake, e.amt); break;
        case 'flash': view.flash = 0.15; break;
        case 'die': jingle.die(); save.stats.deaths++; break;
        case 'died':
            run.lives--;
            if (run.lives <= 0) { persist(); save.lives = START_LIVES; run = null; writeSave(save); stopMusic(); jingle.gameover(); setScreen('gameover'); game = null; }
            else { persist(); enterLevel(cur.world, cur.index, game.checkpoint && game.checkpoint.on); }
            break;
        case 'flag': jingle.clear(); break;
        case 'clear':
            if (!save.cleared.includes(key(cur.world, cur.index))) save.cleared.push(key(cur.world, cur.index));
            save.stats.kills += game.stats.kills;
            persist();
            toMap(cur.world, Math.min(4, cur.index));
            if (cur.index < 5) { const nodes = nodePositions(R.W, R.H); view.walk = { from: nodes[cur.index - 1], to: nodes[Math.min(4, cur.index)], t: -0.4, dir: 1 }; }
            break;
        case 'shard':
            if (!e.ghost) { const k = `${cur.world}-${cur.index}-${e.slot}`; if (!save.shards.includes(k)) save.shards.push(k); persist(); }
            jingle.shard();
            break;
        case 'vault':
            if (!save.vaults.includes(key(cur.world, cur.index))) save.vaults.push(key(cur.world, cur.index));
            applyItem(e.item); persist();
            view.overlay = 'gadget'; view.gadget = { item: e.item, t: 0, after: 'resume' };
            jingle.gadget();
            break;
        case 'gadget':
            if (e.item !== 'sun') applyItem(e.item);
            if (!save.cleared.includes(key(cur.world, cur.index))) save.cleared.push(key(cur.world, cur.index));
            save.stats.kills += game.stats.kills;
            persist();
            view.overlay = 'gadget'; view.gadget = { item: e.item, t: 0, after: e.item === 'sun' ? 'ending' : 'nextworld' };
            jingle.gadget();
            break;
        case 'boss': gameSong(); break;
        case 'bossdead': stopMusic(); break;
        case 'star': gameSong(); break;
        case 'secret': play('secret'); break;
    }
}

function gadgetDone() {
    const g = view.gadget;
    if (!g || g.t < 0.8) return;
    view.overlay = null;
    backLink.classList.add('hide');
    if (g.after === 'resume') { gameSong(); input.clearEdges(); }
    else if (g.after === 'nextworld') { const nw = Math.min(5, cur.world + 1); toMap(nw, 0); }
    else if (g.after === 'ending') { save.done = true; persist(); game = null; setScreen('ending'); view.endSel = 0; playSong('ending', songFor('ending', MOODS.ending)); }
}

// ------------------------------------------------------------ per-screen update
let acc = 0;
function update(dt) {
    view.st += dt;
    if (view.flash > 0) view.flash -= dt;
    switch (view.screen) {
        case 'title': return menuNav(titleItems().length, id => titleAction(titleItems()[id].id));
        case 'map': return updateMap(dt);
        case 'card': {
            view.cardT += dt;
            if (!view.cardLoaded && view.cardT > 0.05) { beginPlay(); view.cardLoaded = true; }
            const s = input.snapshot();
            if (view.cardT > 0.4 && (s.jumpPressed || s.pausePressed)) view.cardT = 99;
            if (view.cardLoaded && view.cardT > (cur.fromCheckpoint ? 1.2 : 1.8)) { setScreen('play'); gameSong(); }
            return;
        }
        case 'play': return updatePlay(dt);
        case 'gameover': {
            const s = input.snapshot();
            if (view.st > 1.2 && (s.jumpPressed || s.pausePressed)) press('continue');
            return;
        }
        case 'ending': {
            if (view.st > 7) menuNav(2, i => press(i ? 'totitle' : 'keepplaying'), 'endSel');
            else input.snapshot();
            return;
        }
    }
}

function menuNav(n, act, field = 'sel') {
    const s = input.snapshot();
    if (s.upPressed) { view[field] = (view[field] + n - 1) % n; play('menu'); }
    if (s.downPressed) { view[field] = (view[field] + 1) % n; play('menu'); }
    if (s.jumpPressed || s.pausePressed) { play('select'); act(view[field]); }
}

function updateMap(dt) {
    if (view.walk) {
        view.walk.t += dt * 4;
        if (view.walk.t >= 1) view.walk = null;
        input.snapshot();
        return;
    }
    const s = input.snapshot();
    const w = view.mapWorld;
    if (s.rightPressed) {
        if (view.mapSel < 4 && isUnlocked(w, view.mapSel + 2)) walkTo(view.mapSel + 1);
        else if (view.mapSel === 4 && w < 5 && unlockedWorlds() > w) switchWorld(1);
        else play('deny');
    }
    if (s.leftPressed) {
        if (view.mapSel > 0) walkTo(view.mapSel - 1);
        else if (w > 1) switchWorld(-1);
    }
    if (s.upPressed && w < unlockedWorlds()) switchWorld(1);
    if (s.downPressed && w > 1) switchWorld(-1);
    if (s.jumpPressed || s.pausePressed) enterLevel(w, view.mapSel + 1);
}

function updatePlay(dt) {
    if (view.overlay === 'pause') {
        const items = pauseItems();
        const s = input.snapshot();
        if (s.upPressed) { view.pauseSel = (view.pauseSel + items.length - 1) % items.length; play('menu'); }
        if (s.downPressed) { view.pauseSel = (view.pauseSel + 1) % items.length; play('menu'); }
        if (s.jumpPressed) pauseAction(items[view.pauseSel].id);
        else if (s.pausePressed) closePause();
        return;
    }
    if (view.overlay === 'gadget') {
        view.gadget.t += dt;
        const s = input.snapshot();
        if (s.jumpPressed || s.pausePressed || s.firePressed) gadgetDone();
        return;
    }
    if (!game) return;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
        const s = input.snapshot();
        if (s.pausePressed) { openPause(); acc = 0; return; }
        game.step(s, STEP);
        acc -= STEP;
        steps++;
        if (game.events.length) {
            const evs = game.events.splice(0);
            for (const e of evs) { handleEvent(e); if (!game || view.screen !== 'play') return; }
        }
        if (view.overlay) { acc = 0; return; }
    }
    if (steps >= 5) acc = 0;
    if (view.flash > 0 && game) game.flashT = view.flash;
    else if (game) game.flashT = 0;
}

// ------------------------------------------------------------ render
function render() {
    view.buttons = [];
    const t = view.t;
    switch (view.screen) {
        case 'title': drawTitle(R, view, t, titleItems(), view.sel); break;
        case 'map': {
            let walk = null;
            if (view.walk) {
                const k = Math.max(0, Math.min(1, view.walk.t));
                walk = [view.walk.from[0] + (view.walk.to[0] - view.walk.from[0]) * k, view.walk.from[1] + (view.walk.to[1] - view.walk.from[1]) * k];
            }
            drawMap(R, view, t, {
                world: view.mapWorld, sel: view.mapSel, walk, walkDir: view.walk ? view.walk.dir : 1,
                unlockedWorlds: unlockedWorlds(), levelInfo: levelInfo(view.mapWorld), totalShards: totalShards(),
                gadgets: new Set(save.gadgets), touch: view.touch,
            });
            break;
        }
        case 'card': drawCard(R, t, cur.world, cur.index, run ? run.lives : save.lives, (getLevelName()), !view.cardLoaded); break;
        case 'play':
            if (game) {
                R.drawGame(game, game.t);
                R.hud(game, profile, run, { right: view.hudRight });
            }
            if (view.overlay === 'pause') drawPause(R, view, pauseItems(), view.pauseSel, view.touch);
            if (view.overlay === 'gadget') drawGadget(R, view, view.gadget.t, view.gadget.item, view.touch);
            break;
        case 'gameover': drawGameOver(R, view, view.st, view.touch); break;
        case 'ending': drawEnding(R, view, view.st, { shards: totalShards(), score: save.score, kills: save.stats.kills, deaths: save.stats.deaths, sel: view.endSel }); break;
    }
    view.lastButtons = view.buttons;
}

function getLevelName() {
    const l = levels.get(key(cur.world, cur.index));
    return l ? l.name : '';
}

// ------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(Math.max(dt, 0), 0.1);
    view.t += dt;
    input.pollPad();
    try {
        update(dt);
        render();
    } catch (err) {
        console.error(err);
        fail('Something went pop: ' + err.message);
        throw err;
    }
    musicTick();
}

layout();
setScreen('title');
requestAnimationFrame(frame);
// title music starts on the first interaction (browsers need a gesture)
window.addEventListener('pointerdown', () => { if (view.screen === 'title' && !currentSong()) playSong('title', songFor('title', MOODS.title)); }, { once: true });
window.addEventListener('keydown', () => { if (view.screen === 'title' && !currentSong()) playSong('title', songFor('title', MOODS.title)); }, { once: true });

// test hook
window.__pip = { get game() { return game; }, view, get save() { return save; }, input, R, enterLevel, toMap, applyItem, get level() { return level; } };
