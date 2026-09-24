// ============================================================
// BURROWGUARD — boot, main loop, screens and input routing.
// ============================================================

import { Renderer } from './gl.js';
import { buildAtlas } from './atlas.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { computeLayout, inRect } from './layout.js';
import { drawWorld, drawHUD, drawControls, drawTitle, drawPause, drawGameOver, drawBackdrop } from './render.js';
import { initAudio, resumeAudio, suspendAudio, sfx, musicTick, stopMusic, isSoundOn, setSound } from './audio.js';
import { COLS, ROWS, TOWER_ORDER } from './config.js';
import { DX, DY } from './world.js';

const STEP = 1 / 60;
const KEY_HI = 'burrowguard.hi', KEY_FX = 'burrowguard.fx', KEY_SND = 'burrowguard.sound';

// localStorage can throw (private mode, blocked storage): never let it break the game.
const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } },
};

function fail(msg) {
    const el = document.getElementById('fail');
    if (el) { el.textContent = msg; el.hidden = false; }
}

const canvas = document.getElementById('gl');
let R;
try {
    R = new Renderer(canvas);
    R.setAtlas(buildAtlas());
} catch (err) {
    fail('BURROWGUARD needs WebGL, and this browser could not start it. (' + err.message + ')');
    throw err;
}

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const view = {
    screen: 'title',
    paused: false,
    buttons: [],
    lastButtons: [],
    touch: coarse,
    quality: store.get(KEY_FX, 'auto'),
    userQuality: store.get(KEY_FX, null) !== null,
    lost: false,
    hiSaved: false,
};
if (view.quality === 'auto') view.quality = 'high';
setSound(store.get(KEY_SND, '1') === '1');

const game = new Game(((Date.now() ^ (Math.random() * 1e9)) >>> 0));
game.hi = Number(store.get(KEY_HI, 0)) || 0;

let L = null;

// ------------------------------------------------------------ input routing
const handler = {
    down(id, x, y, type) {
        initAudio();
        resumeAudio();
        if (type === 'touch' || type === 'pen') view.touch = true;
        if (view.screen === 'title') { startGame(); return; }
        const b = hitButton(x, y);
        if (b) { pressButton(b, id); return; }
        if (view.paused) return;
        if (game.phase === 'gameover') { if (game.phaseT > 1.5) toTitle(); return; }
        if (inRect(L.field, x, y)) {
            const c = Math.floor((x - L.field.x) / L.field.tile), r = Math.floor((y - L.field.y) / L.field.tile);
            if (c >= 0 && r >= 0 && c < COLS && r < ROWS) game.tapCell(c, r);
            return;
        }
        // Anywhere else that isn't a button is a place to put a thumb down and steer.
        input.startStick(id, x, y);
    },
    move(id, x, y, type) {
        if (type !== 'mouse' || !L) return;
        if (inRect(L.field, x, y)) {
            L.hover = { c: Math.floor((x - L.field.x) / L.field.tile), r: Math.floor((y - L.field.y) / L.field.tile) };
        } else L.hover = null;
    },
    // iOS only unlocks Web Audio from touchend/click, not from a touch-start pointerdown.
    up() { initAudio(); resumeAudio(); },
    key(code) {
        initAudio();
        resumeAudio();
        if (view.screen === 'title') {
            if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') startGame();
            return;
        }
        if (game.phase === 'gameover') {
            if (game.phaseT > 1.5 && (code === 'Enter' || code === 'Space')) toTitle();
            return;
        }
        if (view.paused) {
            if (code === 'KeyP' || code === 'Escape' || code === 'Enter') togglePause(false);
            return;
        }
        switch (code) {
            case 'Escape':
                if (game.buildType || game.selected) { game.buildType = null; game.selected = null; }
                else togglePause(true);
                break;
            case 'KeyP': togglePause(true); break;
            case 'KeyM': toggleSound(); break;
            case 'KeyN': case 'Enter': case 'NumpadEnter': if (game.callWave()) sfx.click(); break;
            case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
                game.chooseBuild(TOWER_ORDER[Number(code.slice(5)) - 1]); break;
            case 'KeyB': {
                if (!game.buildType) break;
                const p = game.player;
                if (game.build(p.fx + DX[p.dir], p.fy + DY[p.dir], game.buildType)) game.buildType = null;
                break;
            }
            case 'KeyU': game.upgrade(game.selected); break;
            case 'Backspace': case 'Delete': game.sell(game.selected); break;
        }
    },
};

const input = new Input(canvas, handler);

function hitButton(x, y) {
    const list = view.lastButtons;
    for (let i = list.length - 1; i >= 0; i--) if (inRect(list[i], x, y)) return list[i];
    return null;
}

function pressButton(b, id) {
    switch (b.id) {
        case 'pause': togglePause(!view.paused); break;
        case 'pump': input.pressPump(id); break;
        case 'go': if (game.callWave()) sfx.click(); break;
        case 'upgrade': game.upgrade(game.selected); break;
        case 'sell': game.sell(game.selected); break;
        case 'deselect': game.selected = null; sfx.click(); break;
        case 'resume': togglePause(false); break;
        case 'sound': toggleSound(); break;
        case 'quality': setQuality(view.quality === 'high' ? 'low' : 'high', true); sfx.click(); break;
        case 'quit': view.paused = false; toTitle(); break;
        default:
            if (b.id.startsWith('build:')) game.chooseBuild(b.id.slice(6));
    }
}

function toggleSound() {
    setSound(!isSoundOn());
    store.set(KEY_SND, isSoundOn() ? '1' : '0');
    if (!isSoundOn()) stopMusic();
    sfx.click();
}

function togglePause(on) {
    if (view.screen !== 'game' || game.phase === 'gameover') return;
    view.paused = on;
    input.releaseAll();
    if (on) stopMusic();
    sfx.click();
}

function startGame() {
    view.screen = 'game';
    view.paused = false;
    view.hiSaved = false;
    input.releaseAll();
    game.newGame();
    sfx.start();
}

function toTitle() {
    saveHi();
    view.screen = 'title';
    view.paused = false;
    input.releaseAll();
    stopMusic();
}

function saveHi() {
    if (game.hi > (Number(store.get(KEY_HI, 0)) || 0)) store.set(KEY_HI, game.hi);
}

// ------------------------------------------------------------ layout & quality
function safeInsets() {
    const el = document.getElementById('safe');
    if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(el);
    return {
        top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0,
    };
}

function resize() {
    const cssW = Math.max(1, window.innerWidth), cssH = Math.max(1, window.innerHeight);
    const cap = view.quality === 'high' ? 2 : 1.25;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    L = computeLayout(cssW, cssH, dpr, safeInsets());
    R.resize(L.W, L.H);
    R.scan = L.px;
    R.scanOff = L.field.y;
    input.dpr = dpr;
}

function setQuality(q, byUser) {
    view.quality = q;
    if (byUser) { view.userQuality = true; store.set(KEY_FX, q); }
    R.post = q === 'high';
    resize();
}

// Drop to LOW after three straight seconds under 40fps — once, and never
// over a choice the player made themselves.
const perf = { frames: 0, time: 0, slow: 0 };
function perfSample(dt) {
    perf.frames++; perf.time += dt;
    if (perf.time < 1) return;
    const fps = perf.frames / perf.time;
    perf.frames = 0; perf.time = 0;
    view.fps = fps;
    if (view.userQuality || view.quality === 'low' || document.hidden) return;
    perf.slow = fps < 40 ? perf.slow + 1 : 0;
    if (perf.slow >= 3) setQuality('low', false);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (view.screen === 'game' && game.phase !== 'gameover') view.paused = true;
        input.releaseAll();
        stopMusic();
        suspendAudio();
        saveHi();
    } else resumeAudio();
});
window.addEventListener('pagehide', saveHi);

canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); view.lost = true; });
canvas.addEventListener('webglcontextrestored', () => { R.init(); view.lost = false; resize(); });

// ------------------------------------------------------------ loop
let last = performance.now(), acc = 0, T = 0;

function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    T += dt;
    perfSample(dt);

    if (view.screen === 'game' && !view.paused) {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps++ < 8) {
            game.update(STEP, input.snapshot());
            acc -= STEP;
        }
        const live = game.phase === 'play';
        musicTick(dt, live && game.player.moving, live && game.fright > 0);
        if (game.phase === 'gameover' && !view.hiSaved) { view.hiSaved = true; saveHi(); stopMusic(); }
    }
    if (!view.lost) render();
}

function render() {
    const btns = [];
    view.buttons = btns;
    R.begin([0.012, 0.012, 0.035]);
    if (view.screen === 'title') {
        drawTitle(R, L, T, game.hi, view);
    } else {
        drawBackdrop(R, L, T);
        drawWorld(R, game, L, T);
        drawHUD(R, game, L, T);
        drawControls(R, game, L, view, input, T);
        if (game.phase === 'gameover') { btns.length = 0; drawGameOver(R, game, L, T, view); }
        if (view.paused) { btns.length = 0; drawPause(R, L, view, isSoundOn(), view.quality); }
    }
    R.end();
    view.lastButtons = btns;
}

setQuality(view.quality, false);
requestAnimationFrame(t => { last = t; frame(t); });

// Test/debug handle (read-only use by dev/ harnesses).
window.__burrowguard = { game, view, input, get layout() { return L; }, renderer: R };
