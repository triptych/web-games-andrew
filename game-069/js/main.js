// PHOSPHOR PATROL — boot, the fixed-step loop and the mode machine:
//   attract (title → the Reapers → how to play → high scores → demo) → menu → play
//   ⇄ pause → continue → initials → attract, with an ending between loops.
//
// ?debug=1 exposes window.__pp for tests.

import { SIM_DT, DIFFICULTY, VIEW_W, FIELD } from './config.js';
import { World, newSession } from './sim/world.js';
import { Bot } from './sim/bot.js';
import { WAVES, WAVE_COUNT } from './sim/waves.js';
import { View } from './view/view.js';
import { C } from './view/hud.js';
import { audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import * as store from './save.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const ui = new UI();
const view = new View(ui.canvas);
const input = new Input(ui);
const data = store.load();

audio.setSound(data.settings.sound);
audio.setMusic(data.settings.music);
view.r.crt = data.settings.crt;

const relayout = () => ui.layout(view.r);
ui.onResize = relayout;
addEventListener('resize', relayout);
if (window.visualViewport) visualViewport.addEventListener('resize', relayout);
relayout();

// Audio may only start inside a user gesture (Safari is strict about it).
const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });

const PAGES = [['title', 9], ['reapers', 9], ['howto', 9], ['hiscores', 7], ['demo', 32]];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .!-';
const START_WAVES = [0, 5, 10];

const G = {
    mode: 'attract', page: 0, pageT: 0, t: 0, acc: 0,
    world: null, session: null, bot: null, autoBot: null,
    sel: 0, startIdx: 0, contT: 0, goT: 0, entry: null, endT: 0, highlight: -1,
    idleT: 0, lastScore: 0, hits: [], camX: 1600, total: 1,
    pend: { firePressed: false, bomb: false, hyper: false },
};

const hiScore = () => Math.max(data.hiscores[0] ? data.hiscores[0].score : 0, G.session && !(G.world && G.world.demo) ? G.session.score : 0);

// ================================================================== flow
function setMode(m) {
    if (m !== 'play' && m !== 'pause' && m !== 'continue') view.hud.clearEffects();
    G.mode = m;
    G.sel = 0;
    ui.setPlaying(m === 'play' || m === 'pause' || m === 'continue');
    if (m !== 'play') audio.stopLoops();
}

function startAttract(page = 0) {
    setMode('attract');
    G.page = page; G.pageT = 0;
    G.world = null; G.bot = null;
    view.reset();
}

function nextPage() {
    G.page = (G.page + 1) % PAGES.length;
    G.pageT = 0;
    G.highlight = -1;
    if (PAGES[G.page][0] === 'demo') startDemo();
    else { G.world = null; view.reset(); }
}

function startDemo() {
    const S = newSession('arcade', [0, 1, 2, 3, 6][Math.floor(Math.random() * 5)]);
    S.lives = 2;
    G.session = S;
    G.world = new World(S, { seed: (Math.random() * 1e9) | 0, demo: true });
    G.bot = new Bot(0.9);
    G.acc = 0;
    view.reset();
}

function openMenu() {
    audio.init();
    audio.ui('coin');
    G.world = null;
    view.reset();
    setMode('menu');
    G.idleT = 0;
}

function unlockedStarts() { return START_WAVES.filter((w) => w <= data.maxWave); }

function startGame() {
    const starts = unlockedStarts();
    const wave = starts[Math.min(G.startIdx, starts.length - 1)] || 0;
    G.session = newSession(data.settings.difficulty, wave);
    newWorld();
    setMode('play');
    audio.ui('select');
}

function newWorld() {
    G.world = new World(G.session, { seed: (Math.random() * 1e9) | 0 });
    G.total = Math.max(1, G.world.quotaLeft() + (G.world.def.boss ? 30 : 0));
    G.acc = 0;
    view.reset();
    view.hud.clearEffects();
    flush(G.world);
}

function advanceWave() {
    const S = G.session;
    S.wave++;
    if (S.wave >= WAVE_COUNT) {
        setMode('ending');
        G.endT = 0; G.world = null;
        view.reset();
        return;
    }
    if (S.wave > data.maxWave && S.loop === 0) { data.maxWave = S.wave; store.save(data); }
    newWorld();
}

function finishGame() {
    const S = G.session;
    G.lastScore = S.score;
    const rank = store.rankOf(data.hiscores, S.score);
    if (rank >= 0) {
        setMode('entry');
        G.entry = { name: '', pos: 0, letter: 0, score: S.score, wave: `${(S.wave % WAVE_COUNT) + 1}${S.loop ? 'L' + (S.loop + 1) : ''}`.slice(0, 4), rank, acc: 0 };
        audio.ui('hiscore');
    } else {
        startAttract(3);
    }
}

function commitEntry() {
    const e = G.entry;
    const name = (e.name + '   ').slice(0, 3).replace(/ +$/, (m) => '.'.repeat(m.length));
    data.hiscores.splice(e.rank, 0, { name, score: e.score, wave: e.wave });
    data.hiscores.length = Math.min(10, data.hiscores.length);
    store.save(data);
    startAttract(3);
    G.highlight = e.rank;
    G.pageT = -4;
}

// ================================================================== events → view, hud, audio
function flush(w, silent = false) {
    for (const e of w.events) {
        view.onEvent(e, w);
        view.hud.onEvent(e, w);
        if (!silent) audio.onEvent(e);
    }
    w.events.length = 0;
}

function stepWorld(dt, inp, bot, silent = !!bot && G.mode === 'attract') {
    const w = G.world;
    const P = G.pend;
    P.firePressed = P.firePressed || inp.firePressed;
    P.bomb = P.bomb || inp.bomb;
    P.hyper = P.hyper || inp.hyper;
    G.acc = Math.min(G.acc + dt, 0.25);
    const n = Math.floor(G.acc / SIM_DT);
    G.acc -= n * SIM_DT;
    for (let k = 0; k < n; k++) {
        let si;
        if (bot) si = bot.decide(w, SIM_DT);
        else si = { ...inp, firePressed: k === 0 && P.firePressed, bomb: k === 0 && P.bomb, hyper: k === 0 && P.hyper };
        w.step(SIM_DT, si);
    }
    if (n > 0) { P.firePressed = false; P.bomb = false; P.hyper = false; }
    flush(w, silent);
}

// ================================================================== menus
const onOff = (v) => (v ? 'ON' : 'OFF');
function menuItems() {
    const s = data.settings;
    const items = [{ id: 'start', label: 'START GAME' }, { id: 'diff', label: `MODE: ${DIFFICULTY[s.difficulty].name}` }];
    const starts = unlockedStarts();
    if (starts.length > 1) items.push({ id: 'wave', label: `START AT WAVE ${starts[Math.min(G.startIdx, starts.length - 1)] + 1}` });
    items.push({ id: 'sound', label: `SOUND: ${onOff(s.sound)}` }, { id: 'music', label: `MUSIC: ${onOff(s.music)}` }, { id: 'crt', label: `CRT FX: ${onOff(s.crt)}` });
    return items;
}
function pauseItems() {
    const s = data.settings;
    return [{ id: 'resume', label: 'RESUME' }, { id: 'sound', label: `SOUND: ${onOff(s.sound)}` }, { id: 'music', label: `MUSIC: ${onOff(s.music)}` }, { id: 'crt', label: `CRT FX: ${onOff(s.crt)}` }, { id: 'quit', label: 'QUIT GAME' }];
}

function toggle(id, dir = 1) {
    const s = data.settings;
    if (id === 'diff') s.difficulty = s.difficulty === 'arcade' ? 'cadet' : 'arcade';
    if (id === 'wave') { const n = unlockedStarts().length; G.startIdx = (G.startIdx + dir + n) % n; }
    if (id === 'sound') { s.sound = !s.sound; audio.setSound(s.sound); }
    if (id === 'music') { s.music = !s.music; audio.setMusic(s.music); }
    if (id === 'crt') { s.crt = !s.crt; view.r.crt = s.crt; view.r.clearHistory = true; }
    store.save(data);
    audio.ui('move');
}

function tapHit(tp) { return G.hits.find((r) => tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h); }

/** Shared up/down/confirm/tap handling. Returns the activated item id (or null). */
function navigate(items, inp) {
    if (inp.up) { G.sel = (G.sel + items.length - 1) % items.length; audio.ui('move'); }
    if (inp.down) { G.sel = (G.sel + 1) % items.length; audio.ui('move'); }
    for (const tp of inp.taps) {
        const h = tapHit(tp);
        if (h && typeof h.id === 'number') { G.sel = h.id; return items[h.id].id; }
    }
    const it = items[G.sel];
    if ((inp.left || inp.right) && !['start', 'resume', 'quit'].includes(it.id)) { toggle(it.id, inp.left ? -1 : 1); return null; }
    if ((inp.confirm || inp.firePressed) && !inp.taps.length) return it.id;
    return null;
}

// ================================================================== per-mode update
function update(dt, inp) {
    if (inp.mute) toggle('sound');
    if (inp.any) G.idleT = 0; else G.idleT += dt;

    switch (G.mode) {
        case 'attract': {
            G.pageT += dt;
            const [page, dur] = PAGES[G.page];
            if (inp.confirm || inp.firePressed || inp.taps.length) { openMenu(); break; }
            if (page === 'demo' && G.world) {
                stepWorld(dt, inp, G.bot);
                if (G.world.state === 'gameover' || G.world.state === 'done') G.pageT = Math.max(G.pageT, dur - 1);
            }
            if (G.pageT >= dur) nextPage();
            break;
        }
        case 'menu': {
            if (G.idleT > 40) { startAttract(0); break; }
            if (inp.back) { audio.ui('back'); startAttract(0); break; }
            const items = menuItems();
            G.sel = Math.min(G.sel, items.length - 1);
            const id = navigate(items, inp);
            if (id === 'start') startGame();
            else if (id) toggle(id);
            break;
        }
        case 'play': {
            if (inp.pause || document.hidden) { setMode('pause'); audio.ui('pause'); break; }
            stepWorld(dt, inp, G.autoBot, false);
            const w = G.world;
            if (w.state === 'done') advanceWave();
            else if (w.state === 'gameover') {
                G.goT += dt;
                if (G.goT > 1.8) { setMode('continue'); G.contT = 10; G.goT = 0; }
            } else G.goT = 0;
            break;
        }
        case 'pause': {
            if (inp.pause) { setMode('play'); break; }
            const id = navigate(pauseItems(), inp);
            if (id === 'resume') setMode('play');
            else if (id === 'quit') finishGame();
            else if (id) toggle(id);
            break;
        }
        case 'continue': {
            const before = Math.ceil(G.contT);
            G.contT -= dt;
            if (Math.ceil(G.contT) !== before) audio.ui('continue');
            if (inp.confirm || inp.firePressed || inp.taps.length) {
                G.world.continueGame();
                flush(G.world);
                setMode('play');
                audio.ui('coin');
            } else if (G.contT <= 0) finishGame();
            break;
        }
        case 'entry': updateEntry(inp); break;
        case 'ending': {
            G.endT += dt;
            G.camX += dt * 40;
            if (Math.random() < dt * 3) {
                const cols = [C.pink, C.yellow, C.green, C.cyan, C.orange];
                const c = cols[Math.floor(Math.random() * cols.length)];
                const x = view.camX - 160 + Math.random() * 320, y = 110 + Math.random() * 120;
                view.fx.sparks1(x, y, c, 50, 160, 1.4);
                view.fx.ring(x, y, c, 50, 0.7);
                audio.onEvent({ type: 'explode', size: 0.6 });
            }
            if (G.endT > 18 || (G.endT > 5 && (inp.confirm || inp.firePressed || inp.taps.length))) {
                const S = G.session;
                S.loop++; S.wave = 0;
                newWorld();
                setMode('play');
            }
            break;
        }
    }
}

function updateEntry(inp) {
    const e = G.entry;
    const step = (d) => { e.letter = (e.letter + d + LETTERS.length) % LETTERS.length; audio.ui('type'); };
    if (inp.up) step(1);
    if (inp.down) step(-1);
    for (const tp of inp.taps) {
        const h = tapHit(tp);
        if (!h) continue;
        if (h.id === 'up') step(1);
        if (h.id === 'down') step(-1);
        if (h.id === 'ok') { accept(); return; }
    }
    for (const ch of inp.typed) {
        if (ch === '\b') { if (e.pos > 0) { e.pos--; e.name = e.name.slice(0, e.pos); } continue; }
        const i = LETTERS.indexOf(ch);
        if (i >= 0 && ch !== ' ') { e.letter = i; accept(); if (G.mode !== 'entry') return; }
    }
    if (inp.left && !inp.typed.length && e.pos > 0) { e.pos--; e.name = e.name.slice(0, e.pos); }
    const typedLetter = inp.typed.some((ch) => ch !== '\b' && ch !== ' ' && LETTERS.includes(ch));
    if (!typedLetter && (inp.firePressed || inp.right || inp.confirm) && !inp.taps.length) accept();
    function accept() {
        e.name = e.name.slice(0, e.pos) + LETTERS[e.letter];
        e.pos++;
        audio.ui('select');
        if (e.pos >= 3) commitEntry();
    }
}

// ================================================================== draw
function draw(dt) {
    const hud = view.hud, t = G.t;
    const hi = hiScore();
    view.beginFrame();
    switch (G.mode) {
        case 'attract': {
            const page = PAGES[G.page][0];
            if (page === 'demo' && G.world) {
                view.drawWorld(G.world, t);
                hud.drawPlay(G.world, G.session, hi, t);
                if (G.world.state === 'tally') hud.drawTally(G.world, t);
                hud.drawPushStart(t, 196, ui.touch);
            } else {
                backdrop(dt, t, page === 'title');
                if (page === 'title') {
                    hud.drawFrame(t);
                    hud.text(String(G.lastScore).padStart(6, ' '), 10, 282, C.text, 1.7, 'left', 1.1);
                    hud.text('HI', 304, 284, C.grey, 1, 'left', 0.9);
                    hud.text(String(hi), 390, 284, C.yellow, 1.2, 'right', 0.95);
                    hud.drawLogo(t, Math.min(1, G.pageT / 2.2));
                    if (G.pageT > 2.4) hud.text('DEFEND THE COLONY OF LUMEN', VIEW_W / 2, 132, C.green, 1.1, 'center');
                    hud.drawPushStart(t, 92, ui.touch);
                    hud.text(ui.touch ? 'TAP THE SCREEN' : 'PRESS ENTER OR CLICK', VIEW_W / 2, 74, C.grey, 0.9, 'center');
                    hud.drawFooter(t);
                } else if (page === 'reapers') hud.drawReapers(t, G.pageT);
                else if (page === 'howto') hud.drawHowTo(t, G.pageT, ui.touch);
                else if (page === 'hiscores') { hud.drawHiscores(data.hiscores, t, G.highlight); hud.drawPushStart(t, 24, ui.touch); }
            }
            break;
        }
        case 'menu': {
            backdrop(dt, t, true);
            hud.drawLogo(t, 1, 222);
            hud.drawMenu('', menuItems(), G.sel, t, 150);
            const diff = data.settings.difficulty;
            hud.text(diff === 'cadet' ? 'CADET: 5 SHIPS, SLOWER REAPERS' : 'ARCADE: 3 SHIPS, THE REAL THING', VIEW_W / 2, 36, C.grey, 0.95, 'center');
            hud.text(ui.touch ? 'TAP TO CHOOSE' : '^ ~ CHOOSE   { } CHANGE   ENTER GO', VIEW_W / 2, 20, C.dim, 0.9, 'center');
            break;
        }
        case 'play': case 'pause': case 'continue': {
            const w = G.world;
            view.drawWorld(w, t);
            hud.drawPlay(w, G.session, hi, t);
            if (w.state === 'tally') hud.drawTally(w, t);
            if (w.state === 'gameover' && G.mode === 'play') hud.drawGameOver(t);
            if (G.mode === 'pause') { hud.drawPaused(t); hud.drawMenu('', pauseItems(), G.sel, t, 170); }
            if (G.mode === 'continue') {
                hud.drawContinue(Math.ceil(G.contT) - 1, t);
                hud.text(`CONTINUES USED: ${G.session.continues}`, VIEW_W / 2, 92, C.grey, 1, 'center');
                hud.text(ui.touch ? 'TAP TO CONTINUE' : 'PRESS FIRE TO CONTINUE', VIEW_W / 2, 76, C.yellow, 1, 'center', 0.6 + 0.4 * Math.sin(t * 6));
            }
            break;
        }
        case 'entry':
            backdrop(dt, t, false);
            hud.drawEntry({ ...G.entry, name: G.entry.name + (G.entry.pos < 3 ? LETTERS[G.entry.letter] : '') }, t, ui.touch);
            break;
        case 'ending': {
            backdrop(dt, t, true);
            const lines = [['CONGRATULATIONS!', C.yellow], ['THE REAPERS ARE BEATEN', C.cyan], ['AND LUMEN LIVES', C.green], ['', C.white], ['BUT THE SWARM REMEMBERS...', C.pink], [`LOOP ${G.session.loop + 2} BEGINS`, C.red]];
            lines.forEach(([s, c], i) => { if (G.endT > 0.8 + i * 1.2) hud.text(s, VIEW_W / 2, 220 - i * 22, c, 1.5, 'center', 1, Math.min(1, (G.endT - 0.8 - i * 1.2) * 2)); });
            hud.text(String(G.session.score), VIEW_W / 2, 70, C.white, 2, 'center');
            break;
        }
    }
    hud.drawEffects(t, dt);
    view.endFrame(dt, t);
    G.hits = hud.hits.slice();
}

function backdrop(dt, t, terrain) {
    G.camX = (G.camX + dt * 45) % 3200;
    view.camX = G.camX;
    view.drawStars(t, G.camX);
    if (terrain) view.drawTerrain(G.camX, true, t);
}

// ================================================================== audio beds
function music(dt) {
    if (!audio.ready()) return;
    const w = G.world;
    let song = null;
    if (G.mode === 'ending') song = 'ending';
    else if ((G.mode === 'attract' && PAGES[G.page][0] !== 'demo') || G.mode === 'menu' || G.mode === 'entry') song = 'title';
    else if (G.mode === 'play' && w && w.def.boss && w.state !== 'tally' && w.state !== 'done') song = 'boss';
    audio.playSong(song);
    if (G.mode === 'play' && w && !w.def.boss && (w.state === 'play' || w.state === 'dying')) {
        const left = w.enemiesLeft();
        const tension = Math.min(1, w.stateT / 100 + (1 - left / G.total) * 0.7);
        audio.heartbeat(dt, tension);
    }
    audio.setThrust(G.mode === 'play' && w && w.ship.alive && w.ship.thrusting ? 1 : 0);
}

// ================================================================== loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    G.t += dt;
    const inp = input.frame();
    update(dt, inp);
    draw(dt);
    music(dt);
}
startAttract(0);
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') setMode('pause'); });

// ================================================================== debug hooks
if (DEBUG) {
    window.__pp = {
        get mode() { return G.mode; }, get page() { return PAGES[G.page][0]; }, get world() { return G.world; }, get session() { return G.session; },
        G, view, data, audio, WAVES, ui, FIELD,
        start(diff = 'arcade', wave = 0) { data.settings.difficulty = diff; openMenu(); startGame(); G.session.wave = wave; newWorld(); },
        god(on = true) { if (G.world) G.world.god = on; },
        clearWave() {
            const w = G.world; if (!w) return;
            for (const k in w.quota) w.quota[k] = 0;
            for (const e of w.enemies) if (e.alive && !e.boss) w.kill(e, 'test');
            if (w.boss && !w.boss.dead) w.boss.die();
        },
        skipIntro() { if (G.world && G.world.state === 'intro') G.world.stateT = 99; },
        goPage(n) { G.page = n - 1; nextPage(); },
        autoplay(on = true) { G.autoBot = on ? new Bot(1) : null; },
        /** Run the sim ahead (bot flying) without rendering; effects only for the last half second. */
        ff(secs, bot = true) {
            const w = G.world; if (!w) return;
            const b = G.autoBot || new Bot(1);
            const n = Math.round(secs / SIM_DT);
            for (let i = 0; i < n; i++) {
                w.step(SIM_DT, bot ? b.decide(w, SIM_DT) : {});
                if (i < n - 60) w.events.length = 0;
                if (w.state === 'done' || w.state === 'gameover') break;
            }
            return w.state;
        },
    };
}
