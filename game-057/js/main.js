/**
 * main.js — boot, the state machine (title → intro → sector card → game ⇄
 * pause / perk / log → game over | next sector | ending), the fixed-step
 * loop, input from keyboard, mouse, gamepad and touch, saves and sound cues.
 *
 * The title screen runs a live attract demo: a bot-driven, invulnerable
 * marine in a random sector, rendered by the same view.
 */

import { SIM_DT, SAVE_KEY, SECTORS, PLAYER } from './config.js';
import { SECTOR_CARDS, ESCAPE_CARD, HORDE_CARD } from './story.js';
import { newRun, newWorld, step, completeSector, choosePerk } from './sim/world.js';
import { makeBot, botInput } from './sim/bot.js';
import { initScene, setTier, detectTier, resize, render, updatePost, Q, post, setDynScale, getDynScale, renderer } from './view/scene.js';
import { View } from './view/view.js';
import { bugThumb } from './view/thumbs.js';
import * as UI from './ui.js';
import { initAudio, S, setVolumes, startMusic, stopMusic, setIntensity } from './audio.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

const G = {
    mode: 'title', world: null, run: null, attract: null, view: null, meta: null,
    acc: 0, last: performance.now(), time: 0, timeScale: 1, slowT: 0, deadT: 0,
    keys: new Set(), mouse: { x: innerWidth / 2, y: innerHeight / 2, down: false }, actions: [],
    inputMode: matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse',
    aimDir: { x: 0, y: -1 }, aim: { x: 0, y: 0 }, pad: { prev: [], active: false },
    frameTimes: [], dynT: 0, heartT: 0, fpsT: 0, frames: 0, musicTheme: null,
};

// ------------------------------------------------------------------ Save

const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.9, music: 0.55, quality: 'auto', shake: true, assist: true, autofire: true, fps: false };

function loadSave() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { raw = null; }
    const m = raw && raw.v === 1 ? raw : {};
    G.meta = {
        v: 1,
        settings: { ...DEFAULT_SETTINGS, ...(m.settings ?? {}) },
        run: m.run ?? null,
        seen: m.seen ?? {}, logs: m.logs ?? {},
        hordeBest: m.hordeBest ?? 0, beaten: !!m.beaten, lastDifficulty: m.lastDifficulty ?? 'marine',
    };
    if (G.meta.run) reviveRun(G.meta.run);
}

/** JSON turns Infinity into null; put the rifle's endless reserve back. */
function reviveRun(run) {
    for (const wp of run.loadout.weapons) if (wp.id === 'pulse') wp.reserve = Infinity;
}

function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.meta)); } catch { /* storage blocked */ }
}

// ------------------------------------------------------------------ Boot

function boot() {
    loadSave();
    const st = G.meta.settings;
    initScene($('c'), st.quality === 'auto' ? detectTier() : st.quality);
    G.view = new View();
    G.view.shakeOn = st.shake;
    UI.initTouch();
    bindInput();
    bindMenus();
    applyTouchMode();
    onResize();
    startAttract();
    showTitle();
    requestAnimationFrame(loop);
    if (DEBUG) installDebug();
}

function onResize() {
    resize();
    document.body.classList.toggle('portrait', innerHeight > innerWidth * 1.05);
}

function applyTouchMode() {
    UI.ui.touchMode = G.inputMode === 'touch';
    document.body.classList.toggle('touch', UI.ui.touchMode);
    const playing = G.mode === 'game';
    $('touch').classList.toggle('hidden', !(UI.ui.touchMode && playing));
    $('crosshair').classList.toggle('hidden', !(G.inputMode === 'mouse' && playing));
    document.body.classList.toggle('playing', playing);
}

// ------------------------------------------------------------------ Attract & title

function startAttract() {
    const seed = (Math.random() * 1e9) >>> 0;
    const run = newRun({ seed, difficulty: 'marine' });
    run.sector = Math.floor(Math.random() * 5);
    run.loadout.weapons.push({ id: ['scatter', 'flame', 'smart', 'minigun', 'plasma'][run.sector], mk: 2, mag: 99, reserve: 999 });
    const w = newWorld(run, { cap: Math.min(160, Q.cap) });
    w.god = true;
    w.events.length = 0;
    G.attract = { world: w, bot: makeBot(), t: 0 };
    G.world = w;
    G.view.setWorld(w);
}

function showTitle() {
    G.mode = 'title';
    for (const id of ['hud', 'pause', 'gameover', 'perk', 'log', 'bigmap', 'sector-card', 'victory', 'intro']) UI.hide(id);
    UI.show('title');
    const run = G.meta.run;
    const cont = $('m-continue');
    if (run && run.mode === 'campaign') {
        const where = run.sector >= 5 ? 'The escape' : `Sector ${SECTORS[run.sector].roman} — ${SECTORS[run.sector].name}`;
        cont.innerHTML = `Continue<small>${where}</small>`;
        cont.classList.remove('hidden');
    } else cont.classList.add('hidden');
    $('best-line').textContent = (G.meta.beaten ? 'Ellie is home. ' : '') + (G.meta.hordeBest ? `Horde best: wave ${G.meta.hordeBest}` : '');
    applyTouchMode();
    playMusic(SECTORS[0]);
    setIntensity(0);
}

function playMusic(theme) {
    if (G.musicTheme === theme.id) return;
    G.musicTheme = theme.id;
    startMusic(theme);
}

// ------------------------------------------------------------------ Starting play

function newCampaign(difficulty) {
    G.meta.lastDifficulty = difficulty;
    G.run = newRun({ seed: (Math.random() * 1e9) >>> 0, difficulty });
    G.meta.run = G.run;
    writeSave();
    UI.hide('difficulty'); UI.hide('title');
    G.mode = 'intro';
    UI.playIntro(() => beginSector());
}

function continueCampaign() {
    G.run = G.meta.run;
    UI.hide('title');
    beginSector();
}

function startHorde(difficulty) {
    G.run = newRun({ seed: (Math.random() * 1e9) >>> 0, difficulty, mode: 'horde' });
    G.run.best = G.meta.hordeBest;
    UI.hide('difficulty'); UI.hide('title');
    beginSector();
}

function beginSector() {
    const run = G.run;
    G.world = newWorld(run, { cap: Q.cap });
    G.attract = null;
    G.view.setWorld(G.world);
    UI.setupMap(G.world);
    UI.hudReset();
    G.acc = 0; G.timeScale = 1; G.slowT = 0; G.deadT = 0;
    G.actions.length = 0;
    G.aimDir = { x: 0, y: -1 };
    const card = run.mode === 'horde' ? HORDE_CARD : run.sector >= 5 ? ESCAPE_CARD : SECTOR_CARDS[run.sector];
    const roman = run.mode === 'horde' ? '∞' : run.sector >= 5 ? '!' : SECTORS[run.sector].roman;
    playMusic(G.world.theme);
    setIntensity(run.sector >= 5 ? 1 : 0);
    if (run.mode === 'campaign') { G.meta.run = run; writeSave(); }
    G.mode = 'card';
    UI.fade(false);
    UI.sectorCard(card, roman, () => {
        G.mode = 'game';
        UI.show('hud');
        applyTouchMode();
        G.last = performance.now();
    }, DEBUG ? 0.3 : 4);
}

// ------------------------------------------------------------------ Loop

function loop(now) {
    requestAnimationFrame(loop);
    const rdt = Math.min(0.1, (now - G.last) / 1000);
    G.last = now;
    G.time += rdt;
    pollGamepad();
    let alpha = 1, vdt = rdt;
    if (G.mode === 'title' && G.attract) {
        alpha = stepAttract(rdt);
    } else if (G.mode === 'game' && G.world) {
        if (G.slowT > 0) { G.slowT -= rdt; G.timeScale = G.slowT > 0 ? 0.25 : 1; }
        vdt = rdt * G.timeScale;
        alpha = stepGame(vdt);
    } else if (G.world) {
        alpha = 1;
        vdt = ['paused', 'perk', 'log', 'over'].includes(G.mode) ? 0 : rdt;
    }
    if (G.world) {
        const w = G.world;
        G.view.frame(w, alpha, Math.max(vdt, G.mode === 'game' ? 0 : 0.0001), G.mode === 'game' ? G.aim : null);
        if (G.mode === 'game' || G.mode === 'perk' || G.mode === 'log') {
            UI.updateHud(w, rdt, G.time);
            if (UI.ui.touchMode) UI.touchButtons(w);
            if (G.inputMode === 'mouse') UI.updateCrosshair(G.mouse.x, G.mouse.y, w);
        }
    }
    if (G.mode !== 'game') post.hurt = 0;
    updatePost(rdt, G.time);
    render();
    perf(rdt);
}

function stepAttract(dt) {
    const a = G.attract;
    a.t += dt;
    const w = a.world;
    G.acc += dt;
    let n = 0;
    while (G.acc >= SIM_DT && n < 4) {
        if (w.phase === 'perk') choosePerk(w, w.perkOptions[0]);
        step(w, botInput(w, a.bot));
        for (const ev of w.events) G.view.handle(ev, w);
        w.events.length = 0;
        G.acc -= SIM_DT; n++;
    }
    if (n >= 4) G.acc = 0;
    if (a.t > 100 || w.phase === 'complete' || w.phase === 'victory') startAttract();
    return G.acc / SIM_DT;
}

function stepGame(dt) {
    const w = G.world;
    G.acc += dt;
    let n = 0;
    while (G.acc >= SIM_DT && n < 6) {
        const input = buildInput(w);
        step(w, input);
        drainEvents(w);
        G.acc -= SIM_DT;
        n++;
        if (w.phase !== 'play' && w.phase !== 'dead') break;
    }
    if (n >= 6) G.acc = 0;
    // Phase transitions.
    if (w.phase === 'perk' && G.mode === 'game') openPerk(w);
    else if (w.phase === 'complete' && G.mode === 'game') sectorDone(w);
    else if (w.phase === 'victory' && G.mode === 'game') victory(w);
    else if (w.phase === 'dead') {
        G.deadT += dt;
        if (G.deadT > 2.4 && G.mode === 'game') gameOver(w);
    }
    // Music intensity and heartbeat.
    if (G.mode === 'game') {
        const boss = w.boss && !w.boss.dead;
        setIntensity(boss ? 2 : (w.activeRoom >= 0 || w.mode === 'escape' || (w.horde && w.horde.t <= 0)) ? 1 : 0);
        const p = w.player;
        G.heartT -= dt;
        if (p.alive && p.hp < p.maxHp * 0.3 && G.heartT <= 0) { S.heartbeat(); G.heartT = 0.85; }
    }
    return Math.min(1, G.acc / SIM_DT);
}

function perf(dt) {
    G.frames++;
    G.fpsT += dt;
    if (G.fpsT >= 0.5) {
        const fps = G.frames / G.fpsT;
        if (G.meta.settings.fps) { $('fps').classList.remove('hidden'); $('fps').textContent = `${fps.toFixed(0)} fps · ${Q.tier} · ${(getDynScale() * 100).toFixed(0)}% · ${G.world?.enemies.length ?? 0} bugs`; }
        else $('fps').classList.add('hidden');
        G.frames = 0; G.fpsT = 0;
        // Adaptive resolution in auto mode.
        if (!DEBUG && G.meta.settings.quality === 'auto' && G.mode === 'game') {
            G.dynT += 0.5;
            if (fps < 42 && getDynScale() > 0.6 && G.dynT > 2) { setDynScale(getDynScale() - 0.1); G.dynT = 0; }
            else if (fps > 58 && getDynScale() < 1 && G.dynT > 5) { setDynScale(getDynScale() + 0.1); G.dynT = 0; }
        }
    }
}

// ------------------------------------------------------------------ Events → sound & UI

function drainEvents(w) {
    const view = G.view;
    for (const ev of w.events) {
        view.handle(ev, w);
        UI.onEvent(ev, w);
        sound(ev);
        switch (ev.type) {
        case 'spawn': G.meta.seen[ev.kind] = 1; break;
        case 'bossIntro': G.meta.seen[ev.kind] = 1; break;
        case 'bossDead': G.slowT = 1.6; break;
        case 'log':
            G.meta.logs[`${ev.sector}-${ev.log}`] = 1;
            writeSave();
            openLog(ev.sector, ev.log);
            break;
        default: break;
        }
    }
    w.events.length = 0;
}

function sound(ev) {
    switch (ev.type) {
    case 'shot': S.shot(ev.quiet ? 'drone' : ev.weapon); break;
    case 'phit': S.hit(); break;
    case 'kill': if (ev.kind === 'bloater') S.acid(); S.kill(ev.kind, ev.r > 0.6); break;
    case 'explode': if (ev.owner !== 'none' || Math.random() < 0.5) { if (ev.kind === 'acid' || ev.kind === 'egg') S.acid(); else S.explode(ev.r); } break;
    case 'hurt': S.hurt(); break;
    case 'roll': S.roll(); break;
    case 'pickup': S.pickup(ev.kind); break;
    case 'reload': S.reload(); break;
    case 'reloaded': S.reloaded(); break;
    case 'empty': S.empty(); break;
    case 'swap': S.swap(); break;
    case 'door': S.door(ev.open); break;
    case 'lock': S.lock(); break;
    case 'clear': S.clear(); break;
    case 'spawn': S.spawn(); break;
    case 'screech': S.screech(ev.kind); break;
    case 'roar': S.roar(['ravager', 'goliath', 'zero', 'widow', 'mother'].includes(ev.kind)); break;
    case 'bossIntro': case 'bossPhase': S.roar(true); break;
    case 'bossDead': S.bossDead(); break;
    case 'thud': case 'erupt': S.thud(); break;
    case 'pulse': S.pulse(); break;
    case 'charge': S.charge(); break;
    case 'telegraph': case 'target': S.telegraph(); break;
    case 'spit': case 'swell': S.spit(); break;
    case 'eshot': S.eshot(ev.heavy); break;
    case 'buzz': S.buzz(); break;
    case 'slash': case 'blinkOut': case 'blinkIn': S.slash(); break;
    case 'throw': case 'missile': case 'lob': S.throw(); break;
    case 'bounce': S.bounce(); break;
    case 'chest': S.chest(); break;
    case 'buy': S.buy(); break;
    case 'heal': S.heal(); break;
    case 'denied': S.denied(); break;
    case 'upgrade': case 'newWeapon': S.upgrade(); break;
    case 'power': S.power(); break;
    case 'perk': S.perk(); break;
    case 'death': S.death(); break;
    case 'victory': S.victory(); break;
    case 'elevator': case 'freeEllie': S.elevator(); break;
    case 'armorBreak': S.explode(3); break;
    case 'birth': S.spawn(); break;
    case 'detonate': S.explode(6); break;
    default: break;
    }
}

// ------------------------------------------------------------------ Phase handlers

function openPerk(w) {
    G.mode = 'perk';
    applyTouchMode();
    UI.buildPerks(w.perkOptions, (id) => {
        S.perk();
        choosePerk(w, id);
        UI.hide('perk');
        drainEvents(w);
        G.mode = 'game';
        applyTouchMode();
    });
}

function openLog(sector, idx) {
    G.mode = 'log';
    applyTouchMode();
    UI.showLog(sector, idx);
}

function closeLog() {
    UI.closeLog();
    if (G.mode === 'log') { G.mode = 'game'; applyTouchMode(); G.last = performance.now(); }
}

function sectorDone(w) {
    G.mode = 'transition';
    applyTouchMode();
    UI.fade(true);
    if (G.run.mode === 'campaign') {
        completeSector(w);
        G.meta.run = G.run;
        writeSave();
    }
    setTimeout(() => { UI.hide('hud'); beginSector(); }, 900);
}

function victory(w) {
    G.mode = 'victory';
    applyTouchMode();
    G.meta.beaten = true;
    G.meta.run = null;
    writeSave();
    stopMusic(); G.musicTheme = null;
    UI.fade(true);
    setTimeout(() => {
        UI.hide('hud');
        UI.fade(false);
        UI.playEnding(G.run, () => { startAttract(); showTitle(); });
    }, 1400);
}

function gameOver(w) {
    G.mode = 'over';
    applyTouchMode();
    if (w.mode === 'horde') {
        G.meta.hordeBest = Math.max(G.meta.hordeBest, w.horde.wave);
        writeSave();
    }
    UI.gameOver(G.run, w, () => {
        UI.hide('gameover');
        if (G.run.mode === 'horde') { startHorde(G.run.difficulty); return; }
        G.run.stats.deaths++;
        G.run.attempt++;
        beginSector();
    }, () => { UI.hide('gameover'); quitToTitle(); });
}

function quitToTitle() {
    if (G.run?.mode === 'campaign' && G.meta.run) writeSave();
    G.run = null;
    UI.hide('hud');
    startAttract();
    showTitle();
}

function pause(on) {
    if (on && G.mode === 'game') {
        G.mode = 'paused';
        UI.pauseStats(G.run, G.world);
        UI.show('pause');
        applyTouchMode();
    } else if (!on && G.mode === 'paused') {
        for (const id of ['pause', 'settings', 'help', 'bigmap']) UI.hide(id);
        G.mode = 'game';
        G.last = performance.now();
        applyTouchMode();
    }
}

function toggleMap() {
    if (UI.isShown('bigmap')) { UI.hide('bigmap'); if (G.mode === 'paused' && G.mapPaused) { G.mapPaused = false; pause(false); } return; }
    if (G.mode === 'game') { pause(true); UI.hide('pause'); G.mapPaused = true; }
    if (!G.world || G.mode === 'title') return;
    $('bigmap-title').textContent = G.world.mode === 'campaign' ? `Sector ${G.world.theme.roman} — ${G.world.theme.name}` : G.world.theme.name;
    UI.drawBigMap(G.world);
    UI.show('bigmap');
}

// ------------------------------------------------------------------ Input

function buildInput(w) {
    const p = w.player;
    const k = G.keys;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    mx += UI.touch.move.x; my += UI.touch.move.y;
    const pad = G.pad;
    if (pad.lx !== undefined) { mx += pad.lx; my += pad.ly; }
    let fire = false;
    const st = G.meta.settings;
    // Aim.
    if (G.inputMode === 'mouse') {
        const wp = G.view.screenToWorld(G.mouse.x, G.mouse.y, 1.15);
        G.aim.x = wp.x; G.aim.y = wp.y;
        fire = G.mouse.down;
        const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1;
        G.aimDir = { x: dx / d, y: dy / d };
    } else {
        if (G.inputMode === 'touch' && UI.touch.aim.active && UI.touch.aim.mag > 0.15) { G.aimDir = { x: UI.touch.aim.x, y: UI.touch.aim.y }; fire = st.autofire && UI.touch.aim.fire; }
        if (G.inputMode === 'pad') {
            if (Math.hypot(pad.rx, pad.ry) > 0.25) { const d = Math.hypot(pad.rx, pad.ry); G.aimDir = { x: pad.rx / d, y: pad.ry / d }; if (st.autofire && d > 0.85) fire = true; }
            else if (Math.hypot(mx, my) > 0.3 && !pad.rt) { const d = Math.hypot(mx, my); G.aimDir = { x: mx / d, y: my / d }; }
            if (pad.rt) fire = true;
        }
        // With no aim input, face the way we walk.
        if (G.inputMode === 'touch' && !UI.touch.aim.active && Math.hypot(mx, my) > 0.3) { const d = Math.hypot(mx, my); G.aimDir = { x: mx / d, y: my / d }; }
        G.aim.x = p.x + G.aimDir.x * 7; G.aim.y = p.y + G.aimDir.y * 7;
    }
    const input = { mx, my, aimX: G.aim.x, aimY: G.aim.y, fire, assist: st.assist && G.inputMode !== 'mouse', roll: false, grenade: false, pulse: false, interact: false, reload: false, swap: 0, slot: -1 };
    const acts = [...G.actions, ...UI.touch.actions];
    G.actions.length = 0; UI.touch.actions.length = 0;
    for (const a of acts) {
        if (typeof a === 'object') { if (a.slot !== undefined) input.slot = a.slot; if (a.swap) input.swap = a.swap; continue; }
        input[a] = true;
    }
    if (input.swap === true) input.swap = 1;
    return input;
}

function act(a) { if (G.mode === 'game') G.actions.push(a); }

function bindInput() {
    addEventListener('resize', onResize);
    addEventListener('keydown', (e) => {
        initAudio();
        if (G.inputMode !== 'mouse') { G.inputMode = 'mouse'; applyTouchMode(); }
        if (e.code === 'Tab') e.preventDefault();
        if (e.repeat) { G.keys.add(e.code); return; }
        G.keys.add(e.code);
        if (G.mode === 'log' && (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter')) { closeLog(); return; }
        if (G.mode === 'perk' && /^Digit[1-3]$/.test(e.code)) { const b = $('perk-list').children[+e.code.slice(5) - 1]; if (b) b.click(); return; }
        if (e.code === 'Escape' || e.code === 'KeyP') {
            if (UI.isShown('settings')) { UI.hide('settings'); return; }
            if (UI.isShown('help')) { UI.hide('help'); return; }
            if (UI.isShown('codex')) { UI.hide('codex'); return; }
            if (UI.isShown('bigmap')) { toggleMap(); return; }
            if (G.mode === 'game') pause(true); else if (G.mode === 'paused') pause(false);
            return;
        }
        if (e.code === 'KeyM') { toggleMap(); return; }
        if (G.mode !== 'game') return;
        switch (e.code) {
        case 'Space': case 'ShiftLeft': case 'ShiftRight': act('roll'); break;
        case 'KeyG': act('grenade'); break;
        case 'KeyQ': act('pulse'); break;
        case 'KeyE': case 'KeyF': act('interact'); break;
        case 'KeyR': act('reload'); break;
        case 'Tab': act({ swap: e.shiftKey ? -1 : 1 }); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': act({ slot: +e.code.slice(5) - 1 }); break;
        default: break;
        }
    });
    addEventListener('keyup', (e) => G.keys.delete(e.code));
    addEventListener('blur', () => { G.keys.clear(); G.mouse.down = false; if (G.mode === 'game') pause(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'game') pause(true); });
    const canvas = $('c');
    addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') {
            G.mouse.x = e.clientX; G.mouse.y = e.clientY;
            if (G.inputMode !== 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) { G.inputMode = 'mouse'; applyTouchMode(); }
        }
    });
    addEventListener('pointerdown', (e) => {
        initAudio();
        if (e.pointerType !== 'mouse') {
            if (G.inputMode !== 'touch') { G.inputMode = 'touch'; applyTouchMode(); }
            return;
        }
        if (G.inputMode !== 'mouse') { G.inputMode = 'mouse'; applyTouchMode(); }
        if (e.target !== canvas) return;
        if (e.button === 0) G.mouse.down = true;
        if (e.button === 2) act('grenade');
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) G.mouse.down = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (G.mode === 'game') act({ swap: e.deltaY > 0 ? 1 : -1 }); }, { passive: true });
    $('weapon-panel').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const s = e.target.closest('.slot');
        if (s && G.inputMode === 'mouse') act({ slot: +s.dataset.slot });
        else act({ swap: 1 });
    });
    $('map-wrap').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMap(); });
    $('pause-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(true); });
    addEventListener('gamepadconnected', () => UI.toast('Gamepad connected'));
}

const PAD_DEAD = 0.18;
function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    const P = G.pad;
    if (!gp) { P.lx = undefined; return; }
    const ax = (i) => { const v = gp.axes[i] ?? 0; return Math.abs(v) < PAD_DEAD ? 0 : v; };
    const btn = (i) => !!gp.buttons[i]?.pressed;
    const val = (i) => gp.buttons[i]?.value ?? 0;
    P.lx = ax(0); P.ly = ax(1); P.rx = ax(2); P.ry = ax(3); P.rt = val(7) > 0.3;
    const pressed = (i) => btn(i) && !P.prev[i];
    const any = gp.buttons.some((b) => b.pressed) || Math.abs(P.lx) + Math.abs(P.ly) + Math.abs(P.rx) + Math.abs(P.ry) > 0.5;
    if (any && G.inputMode !== 'pad') { G.inputMode = 'pad'; applyTouchMode(); initAudio(); }
    if (G.mode === 'game') {
        if (pressed(0) || pressed(4)) act('roll');
        if (pressed(1)) act('pulse');
        if (pressed(2)) act(G.world?.prompt ? 'interact' : 'reload');
        if (pressed(3) || pressed(5)) act({ swap: 1 });
        if (pressed(6)) act('grenade');
        if (pressed(8)) toggleMap();
        if (pressed(9)) pause(true);
    } else {
        // Menu navigation: d-pad / stick moves focus, A presses, B / Start backs out.
        const focusables = [...document.querySelectorAll('.screen:not(.hidden) button:not(.hidden)')].filter((b) => b.offsetParent);
        const navY = (pressed(12) ? -1 : pressed(13) ? 1 : 0) || (Math.abs(P.ly) > 0.6 && !P.navHeld ? Math.sign(P.ly) : 0);
        P.navHeld = Math.abs(P.ly) > 0.6;
        if (navY && focusables.length) {
            const i = focusables.indexOf(document.activeElement);
            focusables[(i + navY + focusables.length) % focusables.length].focus();
        }
        if (pressed(0)) { if (G.mode === 'log') closeLog(); else if (document.activeElement?.click && focusables.includes(document.activeElement)) document.activeElement.click(); else focusables[0]?.focus(); }
        if (pressed(9) || pressed(1)) { if (G.mode === 'paused') pause(false); else if (G.mode === 'log') closeLog(); else if (UI.isShown('bigmap')) toggleMap(); }
    }
    P.prev = gp.buttons.map((b) => b.pressed);
}

// ------------------------------------------------------------------ Menus

function bindMenus() {
    const click = (id, fn) => $(id).addEventListener('click', () => { initAudio(); S.ui(); fn(); });
    click('m-new', () => { UI.buildDifficulty(newCampaign); UI.show('difficulty'); });
    click('m-continue', continueCampaign);
    click('m-horde', () => { UI.buildDifficulty(startHorde); UI.show('difficulty'); });
    click('m-codex', () => { UI.buildCodex(G.meta, 'brood', (t) => bugThumb(renderer, t)); UI.show('codex'); });
    click('m-settings', openSettings);
    click('m-help', () => UI.show('help'));
    click('p-resume', () => pause(false));
    click('p-map', () => { UI.hide('pause'); G.mapPaused = false; UI.drawBigMap(G.world); UI.show('bigmap'); });
    click('p-settings', openSettings);
    click('p-help', () => UI.show('help'));
    click('p-quit', () => { UI.hide('pause'); quitToTitle(); });
    click('log-close', closeLog);
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
        S.ui();
        const scr = b.closest('.screen');
        scr.classList.add('hidden');
        if (scr.id === 'bigmap') { if (G.mapPaused) { G.mapPaused = false; pause(false); } else if (G.mode === 'paused') UI.show('pause'); }
    }));
    document.querySelectorAll('#codex .tab').forEach((t) => t.addEventListener('click', () => { S.ui(); UI.buildCodex(G.meta, t.dataset.tab, (x) => bugThumb(renderer, x)); }));
    document.querySelectorAll('.mbtn').forEach((b) => b.addEventListener('pointerenter', () => S.hover()));
    // Settings.
    const st = () => G.meta.settings;
    const bindRange = (id, key) => $(id).addEventListener('input', (e) => { st()[key] = +e.target.value; setVolumes(st()); writeSave(); });
    bindRange('s-master', 'master'); bindRange('s-sfx', 'sfx'); bindRange('s-music', 'music');
    $('s-quality').addEventListener('change', (e) => { st().quality = e.target.value; setTier(e.target.value === 'auto' ? detectTier() : e.target.value); setDynScale(1); writeSave(); UI.toast('Graphics: ' + Q.tier + ' (some changes apply next sector)'); });
    const bindCheck = (id, key, after) => $(id).addEventListener('change', (e) => { st()[key] = e.target.checked; if (after) after(); writeSave(); });
    bindCheck('s-shake', 'shake', () => { G.view.shakeOn = st().shake; });
    bindCheck('s-assist', 'assist'); bindCheck('s-autofire', 'autofire'); bindCheck('s-fps', 'fps');
    setVolumes(G.meta.settings);
    $('intro').addEventListener('click', (e) => { if (e.target.id !== 'intro-skip') S.typing(); });
}

function openSettings() {
    const s = G.meta.settings;
    $('s-master').value = s.master; $('s-sfx').value = s.sfx; $('s-music').value = s.music;
    $('s-quality').value = s.quality; $('s-shake').checked = s.shake; $('s-assist').checked = s.assist;
    $('s-autofire').checked = s.autofire; $('s-fps').checked = s.fps;
    UI.show('settings');
}

// ------------------------------------------------------------------ Debug hooks (?debug=1)

function installDebug() {
    window.__hb = {
        get G() { return G; },
        get world() { return G.world; },
        get mode() { return G.mode; },
        meta: () => G.meta,
        /** Step the simulation synchronously (input optional). */
        advance(sec, input) {
            const w = G.world;
            const n = Math.round(sec / SIM_DT);
            for (let i = 0; i < n; i++) {
                step(w, input ?? buildInput(w));
                if (G.mode === 'title') { for (const ev of w.events) G.view.handle(ev, w); w.events.length = 0; }
                else drainEvents(w);
                if (w.phase !== 'play' && w.phase !== 'dead') break;
            }
        },
        bot(sec) {
            const w = G.world, bot = makeBot();
            const n = Math.round(sec / SIM_DT);
            for (let i = 0; i < n; i++) {
                if (w.phase === 'perk' || w.phase === 'complete' || w.phase === 'victory' || w.phase === 'dead') break;
                const input = botInput(w, bot);
                G.aim.x = input.aimX; G.aim.y = input.aimY;
                step(w, input);
                drainEvents(w);
            }
            this.snapCam();
        },
        snapCam() { const p = G.world.player; G.view.camTarget = null; G.view.camLook.set(p.x, 0, p.y); },
        god(on = true) { G.world.god = on; },
        killAll() { for (const e of G.world.enemies) if (!e.boss) { e.hp = 0; e.dead = true; } },
        newGame(difficulty = 'marine') { newCampaign(difficulty); },
        startHorde(difficulty = 'marine') { startHorde(difficulty); },
        /** Start a campaign at sector n (5 = escape) with a mid-game loadout. */
        toSector(n, difficulty = 'marine') {
            UI.hide('title');
            G.run = newRun({ seed: 12345, difficulty });
            G.run.sector = n;
            if (n > 0) G.run.loadout.weapons.push({ id: 'scatter', mk: 2, mag: 6, reserve: 40 }, { id: 'smart', mk: 2, mag: 120, reserve: 300 });
            beginSector();
        },
        /** Teleport into the boss room (it locks behind you). */
        toBoss() {
            const w = G.world;
            const r = w.lv.rooms.find((x) => x.type === 'boss');
            w.player.x = r.cx; w.player.y = r.y + r.h - 3; w.player.ox = w.player.x; w.player.oy = w.player.y;
            for (const d of w.lv.doors) if (d.room === r.id) { /* doors lock on entry */ }
        },
        toRoom(type = 'combat') {
            const w = G.world;
            const r = w.lv.rooms.find((x) => x.type === type && !x.state);
            if (!r) return false;
            w.player.x = r.cx; w.player.y = r.cy + 1; w.player.ox = w.player.x; w.player.oy = w.player.y;
            return true;
        },
        give(id, mk = 1) { const p = G.world.player; if (p.weapons.length < PLAYER.slots) p.weapons.push({ id, mk, mag: 99, reserve: 999 }); },
        screen(x, y, h) { return G.view.worldToScreen(x, y, h); },
        skipCard() { const sc = $('sector-card'); if (!sc.classList.contains('hidden')) sc.click(); },
    };
}

boot();
