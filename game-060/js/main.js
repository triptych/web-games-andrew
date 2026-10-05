// BRICKVADERS — boot, the fixed-step loop and the mode machine:
//   attract (title → score table → capsules → high scores → demo) → menu → play
//   ⇄ pause → continue → initials → attract, with an ending between loops.
//
// ?debug=1 exposes window.__bv for tests.

import { SIM_DT, DIFFICULTY, MAX_BOMBS, W } from './config.js';
import { World, newSession } from './sim/world.js';
import { Bot } from './sim/bot.js';
import { STAGES, SECTORS, SECTOR_START } from './sim/levels.js';
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

const PAGES = [['title', 9], ['scores', 7.5], ['capsules', 6.5], ['hiscores', 6], ['demo', 30]];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .!-';

const G = {
    mode: 'attract', page: 0, pageT: 0, t: 0, acc: 0,
    world: null, session: null, bot: null,
    sel: 0, startSector: 0, contT: 0, entry: null, endT: 0, highlight: -1,
    beatT: 0, beatI: 0, idleT: 0, lastScore: 0, hits: [],
    pend: { firePressed: false, bomb: false, dx: 0 },
};

const hiScore = () => Math.max(data.hiscores[0] ? data.hiscores[0].score : 0, G.session && !G.world?.demo ? G.session.score : 0);

// ================================================================== flow
function setMode(m) {
    if (m !== 'play' && m !== 'pause' && m !== 'continue') view.hud.clearEffects();
    G.mode = m;
    G.sel = 0;
    ui.setPlaying(m === 'play' || m === 'pause' || m === 'continue');
}

function startAttract(page = 0) {
    setMode('attract');
    G.page = page; G.pageT = 0;
    G.world = null; G.bot = null;
    view.reset();
    view.setBackdrop('synth');
    audio.stopLoops();
}

function nextPage() {
    G.page = (G.page + 1) % PAGES.length;
    G.pageT = 0;
    G.highlight = -1;
    if (PAGES[G.page][0] === 'demo') startDemo();
    else { G.world = null; view.reset(); view.setBackdrop(G.page % 2 ? 'nebula' : 'synth'); }
}

function startDemo() {
    const picks = [0, 1, 2, 5, 6, 10, 11, 15, 16];
    const S = newSession('arcade', picks[Math.floor(Math.random() * picks.length)]);
    S.lives = 2;
    G.session = S;
    G.world = new World(S, { seed: (Math.random() * 1e9) | 0, demo: true });
    G.bot = new Bot(0.92);
    G.acc = 0;
    view.reset();
}

function openMenu() {
    audio.init();
    audio.ui('coin');
    G.world = null;
    view.reset();
    view.setBackdrop('synth');
    setMode('menu');
    G.startSector = Math.min(G.startSector, data.maxSector);
    G.idleT = 0;
}

function startGame() {
    const stage = SECTOR_START[G.startSector] || 0;
    G.session = newSession(data.settings.difficulty, stage);
    if (stage > 0) G.session.bombs = 2;
    newWorld();
    setMode('play');
    audio.ui('select');
}

function newWorld() {
    G.world = new World(G.session, { seed: (Math.random() * 1e9) | 0 });
    G.acc = 0;
    view.reset();
    flush(G.world);
}

function advanceStage() {
    const S = G.session;
    S.stage++;
    if (S.stage >= STAGES.length) {
        setMode('ending');
        G.endT = 0; G.world = null;
        view.reset(); view.setBackdrop('synth');
        return;
    }
    const st = STAGES[S.stage];
    if (st.sector > data.maxSector) { data.maxSector = st.sector; store.save(data); }
    if (st.type === 'wave' && st.wave === 1) S.bombs = Math.min(MAX_BOMBS, S.bombs + 1);
    newWorld();
}

function finishGame() {
    const S = G.session;
    G.lastScore = S.score;
    const rank = store.rankOf(data.hiscores, S.score);
    if (rank >= 0) {
        setMode('entry');
        G.entry = { name: '', pos: 0, letter: 0, score: S.score, stage: STAGES[Math.min(S.stage, STAGES.length - 1)].label + (S.loop ? `L${S.loop + 1}` : ''), rank, acc: 0 };
        G.entry.stage = G.entry.stage.slice(0, 3);
        audio.ui('hiscore');
    } else {
        startAttract(3);
    }
}

function commitEntry() {
    const e = G.entry;
    const name = (e.name + '   ').slice(0, 3).replace(/ +$/, (m) => '.'.repeat(m.length));
    data.hiscores.splice(e.rank, 0, { name, score: e.score, stage: e.stage });
    data.hiscores.length = Math.min(10, data.hiscores.length);
    store.save(data);
    startAttract(3);
    G.highlight = e.rank;
    G.pageT = -4;
}

function saveSettings() { store.save(data); }

// ================================================================== events → view + audio
function flush(w, silent = false) {
    for (const e of w.events) {
        view.onEvent(e, w);
        if (!silent) {
            const at = audio.now + 0.06 + (e.t - w.time);
            if (e.type === 'beat') audio.beat(e.i, e.interval, e.song, e.march, at);
            else audio.onEvent(e, at);
        }
    }
    w.events.length = 0;
}

function stepWorld(dt, inp, bot, silent = !!bot) {
    const w = G.world;
    const P = G.pend;
    P.firePressed = P.firePressed || inp.firePressed;
    P.bomb = P.bomb || inp.bomb;
    P.dx += inp.dx;
    G.acc = Math.min(G.acc + dt, 0.25);
    const n = Math.floor(G.acc / SIM_DT);
    G.acc -= n * SIM_DT;
    for (let k = 0; k < n; k++) {
        let si;
        if (bot) si = bot.decide(w, SIM_DT);
        else si = { ...inp, firePressed: k === 0 && P.firePressed, bomb: k === 0 && P.bomb, dx: P.dx / n };
        w.step(SIM_DT, si);
    }
    if (n > 0) { P.firePressed = false; P.bomb = false; P.dx = 0; }
    flush(w, silent);
}

// ================================================================== menu helpers
const onOff = (v) => (v ? 'ON' : 'OFF');
function menuItems() {
    const s = data.settings;
    const items = [{ id: 'start', label: 'START GAME' }, { id: 'diff', label: `MODE: ${DIFFICULTY[s.difficulty].name}` }];
    if (data.maxSector > 0) items.push({ id: 'sector', label: `SECTOR: ${G.startSector + 1} ${SECTORS[G.startSector].name}`.slice(0, 26) });
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
    if (id === 'sector') G.startSector = (G.startSector + dir + data.maxSector + 1) % (data.maxSector + 1);
    if (id === 'sound') { s.sound = !s.sound; audio.setSound(s.sound); }
    if (id === 'music') { s.music = !s.music; audio.setMusic(s.music); }
    if (id === 'crt') { s.crt = !s.crt; view.r.crt = s.crt; }
    saveSettings();
    audio.ui('move');
}

/** Shared up/down/confirm/tap handling. Returns the activated item id (or null). */
function navigate(items, inp) {
    if (inp.up) { G.sel = (G.sel + items.length - 1) % items.length; audio.ui('move'); }
    if (inp.down) { G.sel = (G.sel + 1) % items.length; audio.ui('move'); }
    for (const tp of inp.taps) {
        const h = G.hits.find((r) => tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h);
        if (h && typeof h.id === 'number') { G.sel = h.id; return items[h.id].id; }
    }
    const it = items[G.sel];
    if ((inp.left || inp.right) && it.id !== 'start' && it.id !== 'resume' && it.id !== 'quit') { toggle(it.id, inp.left ? -1 : 1); return null; }
    if (inp.confirm && !inp.taps.length) return it.id;
    return null;
}

// ================================================================== per-mode update + draw
function update(dt, inp) {
    if (inp.mute) { toggle('sound'); }
    if (inp.any) G.idleT = 0; else G.idleT += dt;
    const hud = view.hud;
    hud.begin();

    switch (G.mode) {
        case 'attract': {
            G.pageT += dt;
            const [page, dur] = PAGES[G.page];
            if (inp.confirm || inp.firePressed || inp.taps.length) { openMenu(); break; }
            if (page === 'demo' && G.world) {
                stepWorld(dt, inp, G.bot);
                if (G.world.state === 'gameover' || G.world.state === 'done') G.pageT = dur;
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
            if (inp.pause || document.hidden) { setMode('pause'); audio.stopLoops(); audio.ui('pause'); break; }
            stepWorld(dt, inp, G.autoBot || null, false);
            const w = G.world;
            if (w.state === 'done') advanceStage();
            else if (w.state === 'gameover') { setMode('continue'); G.contT = 10; }
            break;
        }
        case 'pause': {
            if (inp.pause) { setMode('play'); break; }
            const id = navigate(pauseItems(), inp);
            if (id === 'resume') setMode('play');
            else if (id === 'quit') { G.lastScore = G.session.score; finishGame(); }
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
        case 'entry': updateEntry(dt, inp); break;
        case 'ending': {
            G.endT += dt;
            if (Math.random() < dt * 4) {
                const cols = [[1, 0.3, 0.4], [1, 0.8, 0.2], [0.3, 1, 0.5], [0.3, 0.8, 1], [0.8, 0.4, 1]];
                const c = cols[Math.floor(Math.random() * cols.length)];
                const x = 30 + Math.random() * 180, y = 120 + Math.random() * 150;
                view.fx.explode(x, y, c, 1.6);
                for (let i = 0; i < 24; i++) view.fx.debris(x, y, c, x + (Math.random() - 0.5), y + (Math.random() - 0.5), 1.4, 1);
                audio.onEvent({ type: 'boom' }, audio.now + 0.02);
            }
            if (G.endT > 18 || (G.endT > 5 && (inp.confirm || inp.taps.length))) {
                const S = G.session;
                S.loop++; S.stage = 0; S.bombs = Math.min(MAX_BOMBS, S.bombs + 1);
                newWorld();
                setMode('play');
            }
            break;
        }
    }
    draw(dt, inp);
}

function updateEntry(dt, inp) {
    const e = G.entry;
    const step = (d) => { e.letter = (e.letter + d + LETTERS.length) % LETTERS.length; audio.ui('type'); };
    if (inp.up) step(1);
    if (inp.down) step(-1);
    e.acc += inp.dx;
    while (e.acc > 9) { e.acc -= 9; step(1); }
    while (e.acc < -9) { e.acc += 9; step(-1); }
    for (const tp of inp.taps) {
        const h = G.hits.find((r) => tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h);
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
    if (!inp.typed.length && (inp.firePressed || inp.right || inp.confirm) && !inp.taps.length) accept();
    function accept() {
        e.name = e.name.slice(0, e.pos) + LETTERS[e.letter];
        e.pos++;
        audio.ui('select');
        if (e.pos >= 3) commitEntry();
    }
}

function draw(dt, inp) {
    const hud = view.hud, t = G.t;
    const v = view.vox;
    const hi = hiScore();
    switch (G.mode) {
        case 'attract': {
            const page = PAGES[G.page][0];
            if (page === 'demo' && G.world) {
                view.drawWorld(G.world, t);
                hud.drawPlay(G.world, G.session, hi, t);
                if ((t * 1.2) % 1 < 0.65) hud.text('DEMO PLAY', W / 2, 150, C.yellow, 2, 'center');
                hud.drawPushStart(t, 172);
            } else {
                v.begin();
                if (page === 'title') { view.drawLogo(t, G.pageT, true); view.drawMarchers(t); }
                v.end();
                hud.drawTop(G.lastScore, hi, '1-1', 0, t);
                if (page === 'title') {
                    if (G.pageT > 1.4) hud.text('BREAKOUT  x  INVADERS', W / 2, 136, C.yellow, 1, 'center');
                    if (G.pageT > 2.0) hud.text('THE BRICK ARMADA IS COMING!', W / 2, 150, C.pink, 1, 'center');
                    hud.drawPushStart(t, 232);
                    hud.text(ui.touch ? 'TAP TO START' : 'CLICK OR PRESS ENTER', W / 2, 248, C.grey, 1, 'center');
                    hud.drawFooter(t);
                } else if (page === 'scores') hud.drawScoreTable(t, G.pageT);
                else if (page === 'capsules') hud.drawCapsuleTable(t, G.pageT);
                else if (page === 'hiscores') { hud.drawHiscores(data.hiscores, t, G.highlight); hud.drawPushStart(t, 250); }
                if (page !== 'title' && page !== 'hiscores') hud.drawPushStart(t, 286);
            }
            break;
        }
        case 'menu':
            v.begin(); view.drawLogo(t, 10, false); v.end();
            hud.drawTop(G.lastScore, hi, '1-1', 0, t);
            hud.drawMenu('- SELECT -', menuItems(), G.sel, t, 158);
            hud.text(data.settings.difficulty === 'cadet' ? 'CADET: 5 SHIPS, SLOWER FOE' : 'ARCADE: 3 SHIPS, THE REAL DEAL', W / 2, 270, C.grey, 1, 'center');
            hud.text(ui.touch ? 'TAP TO CHOOSE' : '^ v CHOOSE  { } CHANGE', W / 2, 284, C.dim, 1, 'center');
            break;
        case 'play': case 'pause': case 'continue': {
            const w = G.world;
            view.drawWorld(w, t);
            hud.drawPlay(w, G.session, hi, t);
            if (w.state === 'intro' && w.stage.type === 'wave' && w.stateT > 1.1) hud.text('READY!', W / 2, 196, C.white, 1, 'center');
            if (w.state === 'tally') hud.drawTally(w, t);
            if (G.mode === 'pause') {
                hud.ctx.fillStyle = 'rgba(0,0,8,0.7)'; hud.ctx.fillRect(20, 96, W - 40, 128);
                hud.text('PAUSED', W / 2, 104, C.yellow, 2, 'center');
                hud.drawMenu('', pauseItems(), G.sel, t, 134);
            }
            if (G.mode === 'continue') {
                hud.ctx.fillStyle = 'rgba(0,0,8,0.6)'; hud.ctx.fillRect(0, 90, W, 130);
                hud.drawContinue(Math.ceil(G.contT) - 1, t);
                hud.text(`CONTINUES USED: ${G.session.continues}`, W / 2, 206, C.grey, 1, 'center');
            }
            break;
        }
        case 'entry':
            v.begin(); view.drawMarchers(t); v.end();
            hud.drawTop(G.entry.score, hi, '', 0, t);
            hud.drawEntry({ ...G.entry, name: G.entry.name + (G.entry.pos < 3 ? LETTERS[G.entry.letter] : '') }, t);
            break;
        case 'ending': {
            v.begin(); view.drawLogo(t, 10, false); v.end();
            const lines = [['CONGRATULATIONS!', C.yellow], ['THE BRICK ARMADA', C.cyan], ['IS DEFEATED!', C.cyan], ['', C.white], ['EARTH IS SAFE...', C.green], ['...FOR NOW.', C.green], ['', C.white], ['THE INVADERS ARE ANGRY', C.red], [`LOOP ${G.session.loop + 2} BEGINS`, C.pink]];
            lines.forEach(([s, c], i) => { if (G.endT > 0.8 + i * 1.1) hud.text(s, W / 2, 140 + i * 14, c, 1, 'center'); });
            hud.drawTop(G.session.score, hi, 'END', G.session.loop, t);
            break;
        }
    }
    hud.drawEffects(t);
    hud.end();
    G.hits = hud.hits.slice();
}

// ================================================================== menu music clock
function menuMusic(dt) {
    const song = G.mode === 'ending' ? 'ending' : (G.mode === 'attract' && PAGES[G.page][0] !== 'demo') || G.mode === 'menu' || G.mode === 'entry' ? 'title' : null;
    if (!song || !audio.ready()) return;
    const interval = song === 'ending' ? 0.18 : 0.17;
    G.beatT += dt;
    if (G.beatT >= interval) {
        G.beatT -= interval;
        if (G.beatT > interval) G.beatT = 0;
        G.beatI++;
        audio.beat(G.beatI, interval, song, false, audio.now + 0.05);
        view.beat = 1;
    }
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
    menuMusic(dt);
    view.frame(dt, G.t);
}
startAttract(0);
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') { setMode('pause'); audio.stopLoops(); } });

// ================================================================== debug hooks
if (DEBUG) {
    window.__bv = {
        get mode() { return G.mode; }, get page() { return PAGES[G.page][0]; }, get world() { return G.world; }, get session() { return G.session; },
        G, view, data, audio, STAGES,
        start(diff = 'arcade', stage = 0) { data.settings.difficulty = diff; G.startSector = 0; openMenu(); startGame(); G.session.stage = stage; newWorld(); },
        god(on = true) { if (G.world) G.world.god = on; },
        killAll() { const w = G.world; if (!w) return; for (const s of w.slots) if (s.alive && s.inv) w.killInvader(s, 'shot'); for (const e of w.free) if (e.alive) w.killInvader(e, 'shot'); if (w.boss && !w.boss.dead) { w.boss.coreHp = 0; w.bossDie(); } },
        skipIntro() { if (G.world && G.world.state === 'intro') G.world.stateT = 99; },
        goPage(n) { G.page = n - 1; nextPage(); },
        autoplay(on = true) { G.autoBot = on ? new Bot(1) : null; },
    };
}
