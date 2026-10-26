// GLITTERBALL GROOVE — entry point. Boots the stage, runs the fixed-step simulation, routes keys,
// pointers and the gamepad, and moves between the power screen, boot pre-roll, attract loop,
// menus, play, pause, game over and the high-score entry.
//
// ?debug=1 exposes window.__gg for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME, W, H, TIMING, MODES } from './config.js';
import { Stage } from './view/stage.js';
import { Backdrop } from './view/backdrop.js';
import { FX } from './view/fx.js';
import { BoardView } from './view/board3d.js';
import { Dancers } from './view/dancers.js';
import { UI } from './ui/ui.js';
import { Audio, BPM } from './audio.js';
import { Input } from './input.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, scoreRank, addScore, bestScore, clearScores } from './save.js';
import { newGame, step, findMoves, isCalm, DIRS } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const canvas = document.getElementById('view');
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input(canvas);
input.onGesture = () => audio.init();

const stage = new Stage(canvas, settings.quality);
stage.calm = settings.calm;
const ui = new UI({ settings, onSettings: applySettings });
const fx = new FX(stage.scene);
const backdrop = new Backdrop(stage.scene, stage.camera, stage.envMap);
const board = new BoardView(stage.scene, stage, fx, stage.envMap);
const dancers = new Dancers(stage.scene, stage.envMap);
stage.setLook(settings.crt);
stage.power = 0;

const EMPTY = newGame(1);               // what the board shows when nothing is on it
EMPTY.grid.fill(null);

let G = null;                           // the player's game
let demo = null, demoBot = null;        // the attract loop's game
let acc = 0, time = 0, last = performance.now();
let pending = [];                       // swap commands waiting for the next sim step
let cursor = { r: 3, c: 3, grabbed: false, show: false };
let drag = null;
let readyT = 0;
let powerAnim = -1;
let bot = null;
let hintT = 0, hint = null;
let lastSecond = -1;
let credits = 1;
const seen = {};                        // a count of every sim event drained, for the tests
let room = 0;
let wasDemoPage = false;
let lastScreen = '';
let slowT = 0, slowFrames = 0, slowCount = 0;
const SCREEN_NAMES = { power: 'Power screen. Press any key.', boot: 'Booting.', attract: 'Attract mode. Press any key to start.', menu: 'Main menu.', modes: 'Choose a mode.', scores: 'Hall of fame.', howto: 'How to play.', settings: 'Settings.', confirm: 'Clear all scores?', ready: 'Get ready.', hud: 'Go!', pause: 'Paused.', over: 'Game over.', entry: 'New high score. Enter your initials.' };
const say = (t) => window.A11Y?.announce?.(t);

// ------------------------------------------------------------------ settings and layout
function applySettings(st, id) {
    saveSettings(st);
    audio.setVolumes(st.sfx, st.music);
    stage.calm = st.calm;
    stage.setLook(st.crt);
    if (id === 'quality') { stage.setQuality(st.quality); onResize(); }
    if (id === 'sfx') audio.ui('select');
}

function onResize() {
    ui.resize(stage.w, stage.h);
    const b = ui.boardCss();
    stage.setBoardRect(b.cx, b.cy, b.size, ui.VH);
    stage.setUi(ui.canvas, true);
    const pr = stage.renderer.getPixelRatio();
    fx.setScale(stage.h * pr, stage.fov);
    backdrop.resize(stage, pr);
}
stage.onResize = onResize;
onResize();

// ------------------------------------------------------------------ actions from the UI
function act(a) {
    if (!a) return;
    switch (a) {
        case 'blip': audio.ui('move'); break;
        case 'type': audio.ui('type'); break;
        case 'poweron':
            audio.powerOn(); audio.ui('coin'); powerAnim = 0; stage.power = 0;
            audio.play('menu');
            ui.go('boot');
            break;
        case 'skipboot': ui.go('attract'); audio.ui('select'); break;
        case 'menu': audio.ui('select'); audio.sting(); toMenu(); break;
        case 'play': audio.ui('select'); ui.go('modes'); break;
        case 'continue': {
            audio.ui('select');
            const g = loadGame();
            if (g) beginGame(g); else ui.go('menu');
            break;
        }
        case 'start:dance': case 'start:jam': audio.ui('select'); beginGame(newGame(freshSeed(), a.slice(6))); break;
        case 'scores': audio.ui('select'); ui.scoreMode = 'dance'; ui.go('scores'); break;
        case 'howto': audio.ui('select'); ui.go('howto'); break;
        case 'settings': audio.ui('select'); ui.go('settings'); break;
        case 'confirm': audio.ui('select'); ui.go('confirm'); break;
        case 'clear:yes': clearScores(); audio.ui('back'); ui.go('settings'); break;
        case 'clear:no': audio.ui('back'); ui.go('settings'); break;
        case 'back': audio.ui('back'); goBack(); break;
        case 'pause': pause(); break;
        case 'resume': audio.ui('back'); resume(); break;
        case 'restart': audio.ui('select'); beginGame(newGame(freshSeed(), G.mode)); break;
        case 'savequit': audio.ui('back'); saveGame(G); G = null; toMenu(); break;
        case 'quit': audio.ui('back'); clearSave(); G = null; toMenu(); break;
        case 'again': audio.ui('select'); beginGame(newGame(freshSeed(), G.mode)); break;
        case 'entry': audio.ui('select'); ui.go('entry', { rank: ui.data.rank, score: G.score }); break;
        case 'entrydone': {
            const name = ui.entry.name.join('');
            const rank = addScore(G.mode, { name, score: G.score, level: G.level });
            audio.fanfare();
            ui.scoreMode = G.mode;
            ui.go('scores', { highlight: rank });
            ui.back = 'menu';                                  // after go(), which would have remembered 'entry'
            break;
        }
        default: break;
    }
}

function goBack() {
    const b = ui.back || 'menu';
    if (b === 'pause') ui.go('pause'); else if (b === 'attract') toMenu(); else ui.go(b === 'hud' ? 'menu' : b);
    if (ui.screen === 'pause') ui.sel = 2;
}
function toMenu() {
    ui.go('menu');
    audio.play('menu');
    audio.setKey(0);
    audio.hurryUp(false);
    board.setCursor(0, 0, false);
}
const freshSeed = () => (Date.now() ^ ((Math.random() * 1e9) | 0)) % 1e9;

function beginGame(g) {
    G = g;
    clearSave();
    pending = [];
    cursor = { r: 3, c: 3, grabbed: false, show: input.lastDevice === 'keys' || input.lastDevice === 'pad' };
    drag = null;
    hint = null;
    acc = 0;
    bot = null;
    readyT = 0;
    lastSecond = -1;
    room = (G.level - 1) % 5;
    backdrop.setRoom(room);
    credits = Math.max(0, credits - 1);
    input.flush();
    ui.go('ready', { countdown: 3 });
    audio.play('menu');
    audio.setKey(0);
}

function startPlay() {
    ui.go('hud');
    audio.play('play');
    audio.ui('go');
    input.flush();
    acc = 0;
}

function pause() {
    if (ui.screen !== 'hud') return;
    audio.ui('pause');
    saveGame(G);
    ui.go('pause');
}
function resume() {
    ui.go('hud');
    input.flush();
    drag = null;
    acc = 0;
}

function finishGame() {
    clearSave();
    audio.play('menu');
    audio.setKey(0);
    audio.hurryUp(false);
    const rank = scoreRank(G.mode, G.score);
    const title = MODES[G.mode].time ? "TIME'S UP!" : 'OUT OF MOVES!';
    if (rank >= 0) audio.fanfare();
    ui.go('over', { rank, title });
    board.setCursor(0, 0, false);
}

// ------------------------------------------------------------------ keys
function handleKey(press) {
    const s = ui.screen;
    if (s === 'hud') return playKey(press);
    if (s === 'ready') { if (press.key === 'Escape') { G = null; toMenu(); } return; }
    act(ui.key(press));
}

function playKey(press) {
    const k = press.key;
    if (k === 'Escape' || press.raw === 'KeyP') return pause();
    if (press.raw === 'KeyH') { hintT = 99; return; }
    if (G.state !== 'play') return;
    cursor.show = true;
    const dirs = { ArrowUp: DIRS.UP, ArrowRight: DIRS.RIGHT, ArrowDown: DIRS.DOWN, ArrowLeft: DIRS.LEFT };
    const dr = [-1, 0, 1, 0], dc = [0, 1, 0, -1];
    if (k in dirs) {
        const d = dirs[k];
        if (cursor.grabbed) {
            pending.push({ t: 'swap', r: cursor.r, c: cursor.c, d });
            cursor.r = Math.max(0, Math.min(H - 1, cursor.r + dr[d])); cursor.c = Math.max(0, Math.min(W - 1, cursor.c + dc[d]));
            cursor.grabbed = false;
        } else {
            cursor.r = Math.max(0, Math.min(H - 1, cursor.r + dr[d])); cursor.c = Math.max(0, Math.min(W - 1, cursor.c + dc[d]));
            audio.ui('tick');
        }
    } else if (k === 'Enter') {
        cursor.grabbed = !cursor.grabbed;
        audio.ui(cursor.grabbed ? 'select' : 'back');
    }
}

// ------------------------------------------------------------------ pointers
function uiPoint(p) {
    const s = stage.toSource(p.x, p.y);
    return s ? { x: s.u * ui.VW, y: (1 - s.v) * ui.VH } : null;
}

function handlePointer(p) {
    const up = uiPoint(p);
    const type = p.type === 'cancel' ? 'up' : p.type;
    const s = ui.screen;
    if (s === 'hud') {
        if (up && type === 'down') {
            const h = ui.hitAt(up.x, up.y);
            if (h && h.id === 'pause') { drag = { pauseDown: true }; return; }
        }
        if (type === 'up' && drag?.pauseDown) { drag = null; if (up) { const h = ui.hitAt(up.x, up.y); if (h && h.id === 'pause') pause(); } return; }
        return boardPointer(p, type);
    }
    if (s === 'ready') return;
    if (!up) return;
    act(ui.pointer(type, up.x, up.y));
}

function boardPointer(p, type) {
    if (!G || G.state !== 'play') { drag = null; return; }
    const hit = stage.pickBoard(p.x, p.y, board.root);
    if (type === 'down') {
        cursor.show = false;
        if (!hit || hit.r < 0 || hit.c < 0 || hit.r >= H || hit.c >= W) { drag = null; return; }
        drag = { r: hit.r, c: hit.c, fr0: hit.fr, fc0: hit.fc, swapped: false, id: p.id };
    } else if (type === 'move' && drag && !drag.swapped && hit) {
        const dx = hit.fc - (drag.c + 0.5), dy = hit.fr - (drag.r + 0.5);
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 0.42) {
            const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.RIGHT : DIRS.LEFT) : (dy > 0 ? DIRS.DOWN : DIRS.UP);
            pending.push({ t: 'swap', r: drag.r, c: drag.c, d });
            drag.swapped = true;
            cursor.grabbed = false;
        }
    } else if (type === 'up' && drag) {
        const d = drag;
        drag = null;
        if (d.swapped || !hit) return;
        // a tap: select, or swap with the selected neighbour
        if (hit.r < 0 || hit.c < 0 || hit.r >= H || hit.c >= W) return;
        if (cursor.grabbed) {
            const dr = hit.r - cursor.r, dc = hit.c - cursor.c;
            if (Math.abs(dr) + Math.abs(dc) === 1) {
                pending.push({ t: 'swap', r: cursor.r, c: cursor.c, d: dr < 0 ? DIRS.UP : dr > 0 ? DIRS.DOWN : dc > 0 ? DIRS.RIGHT : DIRS.LEFT });
                cursor.grabbed = false; cursor.show = false;
                return;
            }
            if (dr === 0 && dc === 0) { cursor.grabbed = false; cursor.show = false; audio.ui('back'); return; }
        }
        cursor.r = hit.r; cursor.c = hit.c; cursor.grabbed = true; cursor.show = true;
        audio.ui('tick');
    }
}

// ------------------------------------------------------------------ events
function flush(game) {
    if (!game.events.length) return;
    const ev = game.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    const ctx = { project: (r, c) => stage.project(board.cellWorld(r, c, 0.3), ui.VW, ui.VH) };
    board.onEvents(game, ev, time);
    audio.onEvents(game, ev);
    if (game === G) ui.onEvents(game, ev, ctx);
    for (const e of ev) {
        if (e.type === 'level') { room = (e.level - 1) % 5; backdrop.setRoom(room); }
        if (e.type === 'fever') { stage.kick(0.3, 0.8); audio.setKey(2); if (game === G) say('Disco fever!'); }
        if (e.type === 'level' && game === G) say(`Level ${e.level}.`);
        if (e.type === 'feverEnd') audio.setKey(0);
        if (e.type === 'over' && game === G && (ui.screen === 'hud' || ui.screen === 'pause')) finishGame();
    }
}

// ------------------------------------------------------------------ keeping up
/** If frames run slow for several seconds in a row on High, step the quality down (never in the test harness). */
function watchSpeed(real) {
    if (DEBUG || ui.screen === 'power' || document.hidden || real > 0.5) { slowT = 0; slowFrames = 0; return; }
    slowT += real; slowFrames++;
    if (slowT < 4) return;
    const avg = slowT / slowFrames;
    slowT = 0; slowFrames = 0;
    if (avg > 0.036 && settings.quality !== 'low') {
        if (++slowCount >= 2) {
            slowCount = 0;
            settings.quality = settings.quality === 'high' ? 'medium' : 'low';
            applySettings(settings, 'quality');
        }
    } else slowCount = 0;
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const real = (now - last) / 1000;
    const dt = Math.min(MAX_FRAME, real);
    last = now;
    time += dt;
    watchSpeed(real);
    if (ui.screen !== lastScreen) { lastScreen = ui.screen; if (SCREEN_NAMES[ui.screen] && !(ui.screen === 'over' && G)) say(SCREEN_NAMES[ui.screen]); if (ui.screen === 'over' && G) say(`Game over. Score ${G.score}.`); }

    // power-on collapse
    if (powerAnim >= 0) { powerAnim += dt / 1.0; stage.power = Math.min(1, powerAnim); if (powerAnim >= 1) powerAnim = -1; }
    else if (stage.power < 1 && ui.screen !== 'power') stage.power = 1;
    if (ui.screen === 'power') stage.power = 1;

    // input: one key per frame so presses never merge; every pointer event
    const press = input.next();
    if (press) handleKey(press);
    for (let p; (p = input.nextPointer());) handlePointer(p);

    // the screens that run on timers
    const s = ui.screen;
    if (s === 'boot') {
        if (ui.t > 0.35 && !ui.stung && ui.t > 3.0) { ui.stung = true; audio.sting(); }
        if (ui.t > 4.7) { ui.stung = false; ui.go('attract'); }
    }
    if (s === 'ready') {
        readyT += dt;
        const n = Math.ceil(3 - readyT);
        const cd = readyT >= 3 ? 0 : n;
        if (cd !== ui.data.countdown) { ui.data.countdown = cd; if (cd > 0) audio.ui('count'); }
        if (readyT >= 3.5) startPlay();
    }
    if (s === 'attract' || s === 'menu' || s === 'modes') {
        // idle in a menu long enough and the attract loop starts again
        if (s !== 'attract' && ui.idle > 40) ui.go('attract');
    }

    // the games
    const scene = ui.scene();
    const attractDemo = ui.screen === 'attract' && scene.demo;
    if (attractDemo && !wasDemoPage) { demo = newGame(freshSeed(), Math.random() < 0.7 ? 'dance' : 'jam'); demoBot = makeBot({ skill: 0.85, seed: freshSeed() % 9999, rt: 0.8 }); acc = 0; backdrop.setRoom(Math.floor(Math.random() * 5)); }
    wasDemoPage = attractDemo;
    audio.setSfxScale(attractDemo ? 0.4 : 1);
    const active = attractDemo ? demo : G;
    if (attractDemo) {
        if (demo.state === 'over') { demo = newGame(freshSeed(), 'dance'); demoBot = makeBot({ skill: 0.85, seed: freshSeed() % 9999, rt: 0.8 }); }
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 12) { step(demo, botInput(demo, demoBot, STEP), STEP); acc -= STEP; n++; }
        flush(demo);
    } else if (ui.screen === 'hud' && G) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            let inp = null;
            if (bot) inp = botInput(G, bot, STEP);
            else if (pending.length) { inp = { cmds: pending }; pending = []; }
            step(G, inp, STEP);
            acc -= STEP;
            n++;
            if (G.events.length > 40) flush(G);
        }
        flush(G);
        // the last ten seconds tick
        if (MODES[G.mode].time && G.state === 'play' && G.time <= 10) {
            const sec = Math.ceil(G.time);
            if (sec !== lastSecond) { lastSecond = sec; audio.ui('tick'); }
            audio.hurryUp(true);
        } else audio.hurryUp(false);
        audio.setIntensity(G.fever > 0 || G.combo >= 4 ? 3 : 2);
    } else acc = 0;

    // hints: after a pause in play, point at a move
    hint = null;
    if (ui.screen === 'hud' && G && G.state === 'play' && settings.hints) {
        if (G.idleT > TIMING.hintAfter || hintT > 50) {
            if (isCalm(G)) { const m = findMoves(G, 1)[0]; if (m) hint = [{ r: m.r, c: m.c }, { r: m.r + (m.dir === DIRS.DOWN ? 1 : 0), c: m.c + (m.dir === DIRS.RIGHT ? 1 : 0) }]; }
        }
        if (G.idleT < 0.2) hintT = 0;
    }

    // the picture
    const showG = ui.screen === 'power' || ui.screen === 'boot' ? EMPTY : active || EMPTY;
    board.setVisible(scene.board && !!(attractDemo || G));
    board.setCursor(cursor.r, cursor.c, cursor.show && ui.screen === 'hud' || cursor.grabbed && ui.screen === 'hud', cursor.grabbed);
    board.setHint(hint);

    const b = audio.beat();
    let kick;
    if (b) kick = b.kick;
    else { const ph = ((time * BPM) / 60) % 1; kick = Math.exp(-ph * 5); }
    const fevering = active && active.fever > 0;
    ui.draw(dt, time, {
        G: ui.screen === 'attract' ? demo : G, demoG: demo, hi: bestScore(G ? G.mode : 'dance'), countdown: ui.data.countdown, credits,
        project: (r, c) => stage.project(board.cellWorld(r, c, 0.3), ui.VW, ui.VH),
    });
    backdrop.update(dt, time, { beat: kick, fever: fevering ? 1 : 0, dim: scene.dim, dist: stage.dist, camera: stage.camera, ballTop: !scene.board, calm: settings.calm });
    board.sync(showG, dt, time, { beat: kick, fever: fevering ? 1 : 0, room, calm: settings.calm });
    dancers.update(dt, time, b ? b.beat : (time * BPM) / 60, { show: stage.w / stage.h > 1.3 && !scene.board && scene.dim >= 0.8, camera: stage.camera, aspect: stage.w / stage.h });
    fx.update(dt);
    const look = { fade: 1, bloom: scene.dim < 0.3 ? 0.6 : 1 };
    stage.render(dt, time, look);
    void showG;
}

// ------------------------------------------------------------------ lifecycle
document.addEventListener('visibilitychange', () => { if (document.hidden && ui.screen === 'hud') pause(); });
window.addEventListener('pagehide', () => { if (G && (ui.screen === 'hud' || ui.screen === 'pause')) saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    const centre = (r) => { const rect = canvas.getBoundingClientRect(); return { x: rect.left + (r.x + r.w / 2) / ui.VW * rect.width, y: rect.top + (r.y + r.h / 2) / ui.VH * rect.height }; };
    window.__gg = {
        get G() { return G; },
        get demo() { return demo; },
        get screen() { return ui.screen; },
        get cursor() { return cursor; },
        seen, stage, ui, audio, input, board, fx, backdrop, dancers,
        /** Skip the pre-roll and start a game at once. */
        start(modeId = 'dance', seed = 1) { beginGame(newGame(seed, modeId)); readyT = 3.5; startPlay(); return G; },
        autoplay(on = true, skill = 1) { bot = on ? makeBot({ skill, seed: 3 }) : null; },
        /** Run the sim ahead, with the bot playing, then show what happened. */
        ff(sec, skill = 1) { const b = makeBot({ skill, seed: 5 }); for (let t = 0; t < sec && G.state !== 'over'; t += STEP) step(G, botInput(G, b, STEP), STEP); flush(G); },
        goto(screen, data) { ui.go(screen, data); if (screen === 'menu') toMenu(); },
        toMenu() { toMenu(); },
        /** Client coordinates of the centre of a UI control, by id. */
        hit(id) { const h = ui.hits.find((x) => x.id === id); return h ? centre(h) : null; },
        hits() { return ui.hits.map((h) => h.id); },
        /** Client coordinates of a board cell. */
        cell(r, c) {
            const w = board.cellWorld(r, c, 0.2);
            const v = w.clone().project(stage.camera);
            const rect = canvas.getBoundingClientRect();
            // the source image u,v → the bent output position (search, since the bend has no closed-form inverse)
            let best = null, bd = 1e9;
            const su = v.x * 0.5 + 0.5, sv = v.y * 0.5 + 0.5;
            for (let ox = 0; ox <= 1; ox += 0.01) for (let oy = 0; oy <= 1; oy += 0.01) {
                const [bu, bv] = bendFor(ox, oy);
                const d = (bu - su) ** 2 + (bv - sv) ** 2;
                if (d < bd) { bd = d; best = [ox, oy]; }
            }
            // refine
            let [bx, by] = best;
            for (let it = 0; it < 4; it++) {
                const step2 = 0.01 / (it + 1);
                for (let ox = bx - 0.01; ox <= bx + 0.01; ox += step2) for (let oy = by - 0.01; oy <= by + 0.01; oy += step2) {
                    const [bu, bv] = bendFor(ox, oy);
                    const d = (bu - su) ** 2 + (bv - sv) ** 2;
                    if (d < bd) { bd = d; bx = ox; by = oy; }
                }
            }
            return { x: rect.left + bx * rect.width, y: rect.top + (1 - by) * rect.height };
        },
        moves() { return G ? findMoves(G) : []; },
        save: () => saveGame(G),
        hasSave,
        settings,
        press(key, raw = key) { input.queue.push({ key, raw, ch: key.length === 1 ? key : '' }); },
    };
    const bendFor = (u, v) => {
        const c = stage.curv;
        let x = u * 2 - 1, y = v * 2 - 1;
        const ox = Math.abs(y) / 6.0, oy = Math.abs(x) / 4.5;
        x += x * ox * ox * c; y += y * oy * oy * c;
        const k = c > 0.0001 ? 0.975 : 1;
        x *= k; y *= k;
        return [x * 0.5 + 0.5, y * 0.5 + 0.5];
    };
}
