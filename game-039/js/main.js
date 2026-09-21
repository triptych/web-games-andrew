/**
 * Wakeform — bootstrap, the fixed-timestep loop, and the app object the screens
 * drive. Everything renders into a 160x192 offscreen buffer that is blitted to
 * the visible canvas with nearest-neighbour scaling.
 */

import { VIEW_W, VIEW_H, CORE_X, CORE_Y } from './game/constants.js';
import { bus, EV } from './core/bus.js';
import { makeRng, newSeedString } from './core/rand.js';
import { initInput, sampleInput, flushInput } from './core/input.js';
import { makePalette, polColor } from './render/palette.js';
import { buildSprites } from './render/sprites.js';
import { buildPlayfield, buildStarfield } from './render/playfield.js';
import {
    drawFrame, drawBanner, addSpark, updateSparks, addShake, clearSparks
} from './render/draw.js';
import { updateProbe } from './game/probe.js';
import { updateWake, resetWake } from './game/wake.js';
import { updateMotes, resetMotes, moteCount } from './game/motes.js';
import { updateScore } from './game/scoring.js';
import { tickWave } from './game/waves.js';
import {
    newRun, deserialiseRun, serialiseRun, bindRunEvents, advancePhase,
    completeWave, setBanner, PHASE
} from './game/state.js';
import {
    readSlot, writeSlot, clearSlot, getHiscore, setHiscore
} from './game/save.js';
import * as audio from './audio.js';
import {
    makeTitleScreen, makeHowToScreen, makeSlotScreen, makePauseScreen,
    makeGameOverScreen, centreText
} from './ui/screens.js';

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------

const visible = document.getElementById('screen');
const vctx = visible.getContext('2d');

const buffer = document.createElement('canvas');
buffer.width = VIEW_W;
buffer.height = VIEW_H;
const g = buffer.getContext('2d');
g.imageSmoothingEnabled = false;

let scale = 3;
let offX = 0;
let offY = 0;

function resize() {
    const pad = 8;
    const availW = Math.max(160, window.innerWidth - pad * 2);
    const availH = Math.max(192, window.innerHeight - pad * 2);
    // 2600 pixels were roughly 2:1, so each buffer pixel is drawn twice as wide.
    const sx = availW / (VIEW_W * 2);
    const sy = availH / VIEW_H;
    scale = Math.max(1, Math.min(sx, sy));

    const dispW = Math.floor(VIEW_W * 2 * scale);
    const dispH = Math.floor(VIEW_H * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    visible.width = Math.floor(dispW * dpr);
    visible.height = Math.floor(dispH * dpr);
    visible.style.width = dispW + 'px';
    visible.style.height = dispH + 'px';
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.imageSmoothingEnabled = false;
    offX = 0;
    offY = 0;
}
window.addEventListener('resize', resize);

/** Convert a page coordinate to buffer coordinates, for menu pointer input. */
function toBuffer(clientX, clientY) {
    const r = visible.getBoundingClientRect();
    const bx = ((clientX - r.left) / r.width) * VIEW_W;
    const by = ((clientY - r.top) / r.height) * VIEW_H;
    return [bx, by];
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = {
    seed: newSeedString(),
    pal: null,
    sprites: null,
    playfield: null,
    stars: null,
    rs: null,
    unbind: null,
    screens: [],
    newRecord: false,
    time: 0,
    /** Cosmetic-only counter so echo ticks do not play on every single shed. */
    shedTick: 0,

    sfx: {
        menu: () => audio.sfxMenu(),
        confirm: () => audio.sfxConfirm(),
        muted: () => audio.isMuted(),
        toggleMute: () => audio.setMuted(!audio.isMuted())
    },

    /** Regenerate all seeded art for a seed. */
    buildArt(seed) {
        app.seed = seed;
        const artRng = makeRng(seed + ':art');
        app.pal = makePalette(artRng);
        app.sprites = buildSprites(artRng, app.pal);
        app.playfield = buildPlayfield(makeRng(seed + ':field'), app.pal);
        app.stars = buildStarfield(makeRng(seed + ':stars'));
    },

    pushScreen(name) {
        const s = screenFactory[name]();
        if (s.onEnter) s.onEnter();
        app.screens.push(s);
        flushInput();
    },

    popScreen() {
        app.screens.pop();
        flushInput();
    },

    replaceScreens(name) {
        app.screens.length = 0;
        if (name) app.pushScreen(name);
        flushInput();
    },

    get activeScreen() {
        return app.screens.length ? app.screens[app.screens.length - 1] : null;
    },

    startNewRun(seed) {
        if (app.unbind) app.unbind();
        const s = seed || newSeedString();
        app.buildArt(s);
        resetWake();
        resetMotes();
        clearSparks();
        app.rs = newRun(s);
        app.unbind = bindRunEvents(app.rs, fx);
        app.newRecord = false;
        setBanner(app.rs, 'WAVE 1', 1.8);
        app.replaceScreens(null);
    },

    quitToTitle() {
        if (app.unbind) { app.unbind(); app.unbind = null; }
        resetWake();
        resetMotes();
        clearSparks();
        app.rs = null;
        app.buildArt(newSeedString());
        app.replaceScreens('title');
    },

    saveToSlot(slot) {
        if (!app.rs) return;
        const ok = writeSlot(slot, serialiseRun(app.rs));
        setBanner(app.rs, ok ? 'SAVED' : 'SAVE FAILED', 1.4);
    },

    autosave() {
        if (!app.rs || app.rs.run.phase === PHASE.OVER) return;
        writeSlot('auto', serialiseRun(app.rs));
    },

    loadFromSlot(slot) {
        const data = readSlot(slot);
        if (!data) return;
        if (app.unbind) app.unbind();
        app.buildArt(data.seed);
        clearSparks();
        app.rs = deserialiseRun(data);
        app.unbind = bindRunEvents(app.rs, fx);
        app.newRecord = false;
        setBanner(app.rs, 'RESUMED', 1.4);
        app.replaceScreens(null);
    },

    /** Resume the autosave written at the last wave break or tab hide. */
    continueRun() {
        const data = readSlot('auto');
        if (!data) { app.startNewRun(); return; }
        if (app.unbind) app.unbind();
        app.buildArt(data.seed);
        clearSparks();
        app.rs = deserialiseRun(data);
        app.unbind = bindRunEvents(app.rs, fx);
        app.newRecord = false;
        setBanner(app.rs, 'RESUMED', 1.4);
        app.replaceScreens(null);
    },

    deleteSlot(slot) {
        clearSlot(slot);
    }
};

const screenFactory = {
    title: () => makeTitleScreen(app),
    howto: () => makeHowToScreen(app),
    save: () => makeSlotScreen(app, 'save'),
    load: () => makeSlotScreen(app, 'load'),
    pause: () => makePauseScreen(app),
    gameover: () => makeGameOverScreen(app)
};

// ---------------------------------------------------------------------------
// Event -> audio/visual effects
// ---------------------------------------------------------------------------

const fx = {
    onAbsorb(p, chain, gained) {
        audio.sfxAbsorb(chain);
        addSpark(p.x, p.y, polColor(app.pal, p.pol), 6, 30);
        if (chain >= 4) addSpark(p.x, p.y, app.pal.white, 3, 44);
    },
    onCoreHit(p, remaining) {
        audio.sfxCoreHit();
        addSpark(CORE_X, CORE_Y, app.pal.warn, 14, 50);
        addShake(remaining <= 1 ? 4 : 2.5);
        if (app.rs) setBanner(app.rs, remaining > 0 ? 'BREACH' : 'CRITICAL', 1.0);
    },
    onSplit(p) {
        audio.sfxSplit();
        addSpark(p.x, p.y, app.pal.white, 5, 34);
    },
    onFlip(p) {
        audio.sfxFlip(p.pol);
    },
    onShed() {
        // Only every 5th shed makes a sound, or it becomes a drone.
        if (++app.shedTick % 5 === 0) audio.sfxShed();
    },
    onReclaim(p) {
        audio.sfxReclaim();
        addSpark(p.x, p.y, app.pal.hud, 2, 18);
    },
    onEchoEaten(p) {
        audio.sfxEchoEaten();
        addSpark(p.x, p.y, app.pal.warn, 3, 22);
    },
    onChainBreak() {
        audio.sfxChainBreak();
    },
    onFluxEmpty() {
        audio.sfxFluxEmpty();
    },
    onWaveStart(p) {
        audio.sfxWaveStart(p.wave);
        if (app.rs) {
            setBanner(app.rs, p.surge ? 'SURGE ' + p.wave : 'WAVE ' + p.wave, 1.6);
        }
    },
    onSurge() {
        audio.sfxSurge();
        addShake(2);
    }
};

bus.on(EV.GAME_OVER, (p) => {
    audio.sfxGameOver();
    app.newRecord = p.score > getHiscore();
    setHiscore(p.score);
    // Finishing a run invalidates the autosave, or the player could reload
    // straight back into a lost board.
    clearSlot('auto');
    app.pushScreen('gameover');
});

bus.on(EV.WAVE_CLEAR, (p) => {
    if (app.rs) setBanner(app.rs, 'CLEAR +' + p.bonus, 1.6);
    app.autosave();
});

// ---------------------------------------------------------------------------
// Menu key handling (screens are not driven by the game input sampler)
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
    audio.resumeAudio();
    const s = app.activeScreen;
    // Mark the event as belonging to a menu BEFORE handling it. The input
    // module's listener runs after this one, and closing a screen here would
    // otherwise make that listener think the key arrived during gameplay — so
    // the Escape that closed the pause menu would immediately reopen it.
    if (s) e.__menuHandled = true;
    if (!s) return;
    const k = e.key.toLowerCase();

    if (k === 'arrowup' || k === 'w') { s.move(-1); e.preventDefault(); }
    else if (k === 'arrowdown' || k === 's') { s.move(1); e.preventDefault(); }
    else if (k === 'arrowleft' || k === 'a') { if (s.name === 'howto') s.move(-1); }
    else if (k === 'arrowright' || k === 'd') {
        if (s.name === 'howto') s.move(1);
        else if (s.deleteSelected) s.deleteSelected();
    }
    else if (k === ' ' || k === 'enter') { s.select(); e.preventDefault(); }
    else if (k === 'escape' || k === 'p') { s.back(); e.preventDefault(); }
});

visible.addEventListener('pointerdown', (e) => {
    audio.resumeAudio();
    const s = app.activeScreen;
    if (!s || !s.pointer) return;
    const [bx, by] = toBuffer(e.clientX, e.clientY);
    s.pointer(bx, by);
});

// Touch on the playfield should also start audio.
visible.addEventListener('touchstart', () => audio.resumeAudio(), { passive: true });

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

const STEP = 1 / 60;
let accumulator = 0;
let last = 0;

function frame(ts) {
    requestAnimationFrame(frame);

    if (!last) last = ts;
    // Cap the delta so a backgrounded tab does not tunnel the whole simulation,
    // and floor it at zero: a non-monotonic timestamp would otherwise let
    // app.time drift negative, which breaks every cyclic animation lookup.
    let dt = Math.min(Math.max((ts - last) / 1000, 0), 0.05);
    last = ts;
    app.time += dt;

    const screen = app.activeScreen;
    const paused = !!screen;

    if (!paused && app.rs) {
        accumulator += dt;
        let steps = 0;
        while (accumulator >= STEP && steps < 5) {
            stepGame(STEP);
            accumulator -= STEP;
            steps++;
        }
        if (steps >= 5) accumulator = 0;
    } else {
        accumulator = 0;
        // Menus still animate.
        updateSparks(dt);
    }

    render(dt);
}

function stepGame(dt) {
    const rs = app.rs;
    if (rs.run.phase === PHASE.OVER) return;

    const input = sampleInput();

    if (input.pause) {
        app.pushScreen('pause');
        return;
    }

    updateProbe(rs.probe, input, dt);
    updateWake(dt, rs.probe, input);
    updateMotes(dt, rs.probe, rs.difficulty);
    updateScore(rs.score, dt);
    updateSparks(dt);

    const phaseResult = advancePhase(rs, dt, moteCount() === 0);

    if (rs.run.phase === PHASE.ACTIVE && rs.waveObj) {
        const allSpawned = tickWave(rs.waveObj, dt);
        if (allSpawned) rs.run.phase = PHASE.DRAINING;
    } else if (rs.run.phase === PHASE.DRAINING) {
        // Clearing the board completes the wave; so does running out the drain
        // grace period, which stops a player from stalling by hoarding motes in
        // traps. Motes left on the board carry over into the next wave.
        if (moteCount() === 0) {
            completeWave(rs);
        } else if (phaseResult && phaseResult.forceNextWave) {
            completeWave(rs, false);
            setBanner(rs, 'WAVE INBOUND', 1.4);
        }
    }
}

function render(dt) {
    g.imageSmoothingEnabled = false;

    const screen = app.activeScreen;

    // A transparent screen (pause) draws over the frozen board.
    if (!screen || screen.transparent) {
        if (app.rs) {
            drawFrame(g, {
                pal: app.pal,
                sprites: app.sprites,
                playfield: app.playfield,
                stars: app.stars,
                probe: app.rs.probe,
                score: app.rs.score,
                run: app.rs.run,
                time: app.time
            }, screen ? 0 : dt);

            if (app.rs.banner) {
                const c = app.rs.bannerT > 0.3 || Math.floor(app.time * 8) % 2
                    ? app.pal.white
                    : app.pal.hudDim;
                drawBanner(g, app.pal, app.rs.banner, 28, c, 1);
            }
        } else {
            g.fillStyle = '#000';
            g.fillRect(0, 0, VIEW_W, VIEW_H);
        }
    }

    if (screen) screen.draw(g, app.pal, app.sprites, app.time);

    // --- blit the buffer, stretched 2:1 per pixel, with scanlines ---
    const dispW = parseFloat(visible.style.width);
    const dispH = parseFloat(visible.style.height);
    vctx.imageSmoothingEnabled = false;
    vctx.fillStyle = '#000';
    vctx.fillRect(0, 0, dispW, dispH);
    vctx.drawImage(buffer, 0, 0, VIEW_W, VIEW_H, 0, 0, dispW, dispH);

    drawScanlines(dispW, dispH);
}

/** CRT scanlines, drawn only when there is room for them to read as lines. */
function drawScanlines(w, h) {
    const lineH = h / VIEW_H;
    if (lineH < 3) return;
    vctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < VIEW_H; y++) {
        vctx.fillRect(0, Math.floor(y * lineH + lineH - 1), w, 1);
    }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// Expose a read-only handle for the dev smoke tests, which need to assert on
// which screen is actually open rather than infer it from a key sequence.
if (typeof window !== 'undefined') {
    window.__wakeform = {
        stack: () => app.screens.map((s) => s.name),
        hasRun: () => !!app.rs
    };
}

function boot() {
    resize();
    // The input module suppresses game input whenever a screen is open, so a
    // single keypress is never handled by both the menu and the probe.
    initInput(visible, () => app.screens.length > 0);
    audio.initAudio();
    app.buildArt(app.seed);
    app.pushScreen('title');

    // Autosave on tab hide so a closed tab does not lose a run.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) app.autosave();
    });
    window.addEventListener('pagehide', () => app.autosave());

    requestAnimationFrame(frame);
}

boot();
