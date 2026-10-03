/**
 * main.js — boot, the state machine (title ↔ game), the fixed-step loop,
 * input, saves, and the glue that turns simulation events into sound, HUD
 * reactions, banners and tutorial hints.
 *
 * The title screen plays a live attract demo behind the menu: a bot-driven
 * world in a random region, rendered by the same view.
 */

import * as THREE from 'three';
import {
    SIM_DT, UNITS, UNIT_ORDER, POWERS, RARITIES, REGIONS, FINAL_WAVE, regionIndex, localWave, isBossWave,
    REKINDLE_MIN_WAVE, embersFor, activeLanes,
} from './config.js';
import * as W from './sim/world.js';
import { botSpend, botTick } from './sim/bot.js';
import { newFoes } from './sim/waves.js';
import { SAVE_KEY, newMeta, normalizeSave, buyRank, rekindle, rekindleGain, offlineGold } from './sim/meta.js';
import { initScene, resize, render, camera, isPortrait, getQuality, setPixelQuality, shake } from './view/scene.js';
import { initFx, setParticleScale, initNumbers } from './view/fx.js';
import * as V from './view/view.js';
import * as UI from './ui.js';
import { initAudio, S as SFX, setSound, setMusic, setMusicState } from './audio.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

const G = {
    mode: 'title', world: null, attract: null, meta: null, runSave: null, savedAt: 0,
    speed: 1, slow: 0, acc: 0, t: 0, last: performance.now(),
    selCard: null, armedPower: -1, armedKeepfire: false, snapshot: null, lostEarned: 0,
    drag: null, down: null, queue: [], autoT: -1, frameTimes: [], qualityLock: false,
    victoryPending: false,
};

// ------------------------------------------------------------------ Save / load

function loadSave() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { raw = null; }
    const n = normalizeSave(raw);
    G.meta = n.meta;
    G.runSave = n.run;
    G.savedAt = n.savedAt;
}

function writeSave() {
    const data = { v: 1, meta: G.meta, run: G.runSave, savedAt: Date.now() };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

function saveRun() {
    if (G.mode !== 'game' || !G.world) return;
    if (G.world.phase === 'prep') G.runSave = W.serializeRun(G.world);
    else if (G.snapshot) G.runSave = G.snapshot;
    // Bestiary is permanent.
    for (const k in G.world.seen) G.meta.seen[k] = Math.max(G.meta.seen[k] ?? 0, G.world.seen[k]);
    G.meta.best = Math.max(G.meta.best, G.world.best);
    writeSave();
}

// ------------------------------------------------------------------ Boot

function pickQuality() {
    const q = G.meta.settings.quality;
    if (q !== 'auto' && q !== undefined) return +q;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(innerWidth, innerHeight) < 600;
    return coarse || small ? 1 : 2;
}

async function boot() {
    loadSave();
    const quality = pickQuality();
    initScene($('c'), quality);
    initFx((await import('./view/scene.js')).scene, quality);
    initNumbers($('numbers'));
    UI.initUI(handlers);
    UI.writeSettings(G.meta.settings);
    setSound(G.meta.settings.sound);
    setMusic(G.meta.settings.music);
    newAttract();
    V.initView(G.attract, quality, null);
    onResize();
    addEventListener('resize', onResize);
    addEventListener('orientationchange', () => setTimeout(onResize, 200));
    bindInput();
    toTitle(true);
    $('loading').remove();
    requestAnimationFrame(loop);
    if (DEBUG) exposeDebug();
}

function onResize() {
    const w = innerWidth, h = innerHeight;
    let safe = { top: 0, bottom: 0, left: 0, right: 0 };
    const landPhone = h < 520 && w > h;
    // On landscape phones "Sound the Horn" lives in the bottom bar (the prep panel would cover lanes).
    const sb = $('start-btn');
    if (landPhone && sb.parentElement.id !== 'bottom') $('bottom').appendChild(sb);
    if (!landPhone && sb.parentElement.id !== 'prep-panel') $('prep-panel').appendChild(sb);
    if (G.mode === 'game') {
        const top = $('top').getBoundingClientRect();
        const bot = $('bottom').getBoundingClientRect();
        safe = { top: top.bottom + (landPhone ? 2 : 58), bottom: h - bot.top + 2, left: 6, right: isPortraitLike() ? 58 : landPhone ? 8 : 64 };
    } else {
        safe = { top: h * 0.08, bottom: h * 0.02, left: 0, right: 0 };
    }
    resize(w, h, safe, landPhone && G.mode === 'game');
    setParticleScale(h);
}
const isPortraitLike = () => innerHeight > innerWidth * 1.05;

// ------------------------------------------------------------------ Title / attract

function newAttract() {
    const seed = (Math.random() * 1e9) >>> 0;
    const r = Math.floor(Math.random() * 6);
    const wave = r * 10 + 3 + Math.floor(Math.random() * 5);
    const w = W.createWorld({ seed, wave, gold: Math.round(900 * Math.pow(1.17, wave)) });
    for (let i = 0; i < 25; i++) botSpend(w);
    w.gold = 400;
    w.god = true;
    W.startWave(w);
    W.drainEvents(w);
    G.attract = w;
}

function toTitle(first = false) {
    if (G.mode === 'game') saveRun();
    G.mode = 'title';
    for (const id of ['keep', 'clear', 'modal', 'lost', 'pause', 'settings', 'embers', 'bestiary', 'help', 'victory']) UI.hideScreen(id);
    UI.closeUnitPanel();
    UI.showHUD(false);
    UI.showScreen('title');
    clearSelection();
    if (!first || !G.attract) newAttract();
    V.setWorld(G.attract);
    onResize();
    const run = G.runSave;
    const info = run ? `Defence in progress: wave ${run.wave} · ${REGIONS[regionIndex(run.wave)].name}` : G.meta.best ? `Best wave: ${G.meta.best}${G.meta.rekindles ? ` · Rekindled ${G.meta.rekindles}×` : ''}` : '';
    UI.setTitleInfo(info, !!run);
    $('ember-count').textContent = G.meta.embers ? `(${G.meta.embers})` : '';
    setMusicState(Math.floor(Math.random() * 6), 0);
}

// ------------------------------------------------------------------ Game start

function startGame(world, opts = {}) {
    G.mode = 'game';
    G.world = world;
    G.speed = 1; G.acc = 0; G.slow = 0;
    G.snapshot = null;
    UI.hideScreen('title');
    UI.showHUD(true);
    V.setWorld(world);
    clearSelection();
    onResize();
    requestAnimationFrame(onResize);
    W.drainEvents(world);
    prepFlow(opts);
}

function newGame() {
    initAudio();
    if (G.runSave && !confirm('Abandon the defence in progress and start a new one?')) return;
    const seed = (Math.random() * 1e9) >>> 0;
    const w = W.createWorld({ seed, ember: G.meta.tree });
    G.runSave = W.serializeRun(w);
    writeSave();
    startGame(w, { fresh: true });
}

function continueGame() {
    initAudio();
    if (!G.runSave) return;
    let w;
    try { w = W.restoreRun(G.runSave, G.meta.tree); } catch (err) { console.warn('save unreadable', err); G.runSave = null; writeSave(); toTitle(); return; }
    const off = offlineGold(G.runSave, (Date.now() - G.savedAt) / 1000);
    startGame(w, { resumed: true });
    if (off > 0) { w.gold += off; UI.toast(`While you were away the Treasury earned ${UI.fmt(off)} gold.`, false, 4000); }
}

/** Everything that happens as a wave's prep begins: cards, region intro, new allies and foes, hints, save. */
function prepFlow(opts = {}) {
    const w = G.world;
    UI.renderPrep(w);
    UI.buildCards(w);
    setMusicState(w.regionIdx, 0);
    G.queue = [];
    if (localWave(w.wave) === 1 || opts.fresh || opts.resumed) G.queue.push(() => UI.showModal(UI.regionCardHTML(w), opts.resumed ? 'Resume' : 'To the walls'));
    if (isBossWave(w.wave) && !opts.retry) G.queue.push(() => UI.showModal(UI.bossCardHTML(w), 'Hold the line'));
    for (const k of UNIT_ORDER) if (UNITS[k].unlock === w.wave && w.wave > 1 && !opts.retry) G.queue.push(() => UI.showModal(UI.allyCardHTML(k), 'Welcome'));
    const fresh = newFoes(w.wave).filter((a) => a !== 'boss');
    if (fresh.length && !opts.retry) G.queue.push(() => UI.showModal(UI.foeCardsHTML(w, fresh), 'Ready'));
    runQueue();
    saveRun();
    G.autoT = G.meta.settings.autoStart ? 2.5 : -1;
}

function runQueue() {
    if (UI.isOpen('modal')) return;
    if (!G.queue.length) { prepHints(); return; }
    G.queue.shift()();
}

// ------------------------------------------------------------------ Tutorial hints

function hint(key, text, ms = 5200) {
    if (!G.meta.settings.hints || G.meta.hintsSeen[key]) return false;
    G.meta.hintsSeen[key] = 1;
    UI.toast(text, true, ms);
    return true;
}
function prepHints() {
    const w = G.world;
    if (!w || G.mode !== 'game') return;
    if (w.wave === 1) hint('place', 'Tap the Archer card, then a glowing square in front of the wall to place a second archer. Then Sound the Horn!', 7000);
    else if (w.wave === 2) hint('alch', 'Alchemists brew gold every few seconds. Place one or two early: gold wins wars.', 6500);
    else if (w.wave === 3) hint('towers', 'Two more lanes open! Tap the castle (or Keep) to build towers: each tier is a safe platform for your party.', 7000);
    else if (w.wave === 4) hint('keepfire', 'The Keep sells the Keepfire Beacon: a firestorm down a whole lane, charged by kills.', 6500);
    else if (w.wave === 6) hint('upgrade', 'Tap any party member to level it up. Perks unlock at levels 3, 6 and 10.', 6500);
}

// ------------------------------------------------------------------ Actions (handlers for the UI)

function clearSelection() {
    G.selCard = null;
    G.armedPower = -1;
    G.armedKeepfire = false;
    UI.setSelectedCard(null);
    UI.targetHint(null);
    if (G.world) { V.setHighlights(G.world, null); V.setHover(G.world, null); }
}

function selectCard(t) {
    const w = G.world;
    if (G.selCard === t) { clearSelection(); return; }
    clearSelection();
    G.selCard = t;
    UI.setSelectedCard(t);
    UI.closeUnitPanel();
    V.setSelected(w, null);
    V.setHighlights(w, W.validSlots(w, t));
    const why = w.gold < W.cardCost(w, t) ? 'gold' : w.phase === 'wave' && w.cards[t] > 0 ? 'recharging' : null;
    if (why) UI.toast(why === 'gold' ? `Not enough gold for the ${UNITS[t].name}` : `${UNITS[t].name} is still recharging`);
}

const REASONS = {
    gold: 'Not enough gold', recharging: 'That card is still recharging', occupied: 'Something is already there',
    'no tower': 'Build a tower on that lane first (tap the castle)', 'field only': 'That one fights in the field, not on the walls',
    'beyond the bailey': 'Beyond the bailey: widen it in the Keep', blocked: 'Something blocks that spot', locked: 'Not unlocked yet', 'not now': 'Not now',
};

function tryPlace(slot) {
    const w = G.world;
    if (!slot || !G.selCard) return false;
    const why = W.placeUnit(w, G.selCard, slot);
    if (why) { UI.toast(REASONS[why] ?? why); SFX.error(); return false; }
    clearSelection();
    return true;
}

const handlers = {
    click: () => { initAudio(); SFX.click(); },
    modalDone: () => runQueue(),
    startWave() {
        const w = G.world;
        if (!w || w.phase !== 'prep' || UI.isOpen('modal') || G.queue.length) return;
        initAudio();
        G.snapshot = W.serializeRun(w);
        G.runSave = G.snapshot;
        writeSave();
        W.startWave(w);
        G.autoT = -1;
        clearSelection();
    },
    openKeep() { if (!G.world) return; initAudio(); UI.closeUnitPanel(); UI.renderKeep(G.world, G.meta); UI.showScreen('keep'); },
    buyCastle(key) { const why = W.buyCastle(G.world, key); if (why) { SFX.error(); UI.toast(why === 'gold' ? 'Not enough gold' : why); } UI.renderKeep(G.world, G.meta); },
    buyTower(lane) { const why = W.buyTower(G.world, lane); if (why) SFX.error(); UI.renderKeep(G.world, G.meta); },
    speed() {
        const max = (G.meta.tree.warp ?? 0) > 0 ? 3 : 2;
        G.speed = G.speed >= max ? 1 : G.speed + 1;
    },
    pause() { if (G.mode === 'game' && G.world.phase === 'wave') { UI.showScreen('pause'); $('pause-info').innerHTML = `Wave ${G.world.wave} · ${REGIONS[G.world.regionIdx].name}<br><span class="dim">Quitting mid-wave saves you at the start of this wave.</span>`; } },
    resume() { UI.hideScreen('pause'); },
    keepfire() {
        const w = G.world;
        if (!w || w.phase !== 'wave' || w.castle.keepfire <= 0) return;
        if (w.kf < 100) { UI.toast('The Keepfire is still gathering. Kills feed it.'); return; }
        if (G.armedKeepfire) { clearSelection(); return; }
        clearSelection();
        G.armedKeepfire = true;
        UI.targetHint('Tap a lane to unleash the Keepfire');
    },
    power(i) {
        const w = G.world;
        if (!w || w.phase !== 'wave') { UI.toast('Powerups work during a wave'); return; }
        const p = w.powers[i];
        if (!p) return;
        const def = POWERS[p.power];
        if (def.target === 'none') { W.usePower(w, i); clearSelection(); return; }
        if (G.armedPower === i) { clearSelection(); return; }
        clearSelection();
        G.armedPower = i;
        UI.targetHint(def.target === 'lane' ? `${def.name}: tap a lane` : `${def.name}: tap a spot on the field`);
    },
    cardDown(t, e) {
        initAudio();
        if (!G.world || (G.world.phase !== 'prep' && G.world.phase !== 'wave')) return;
        selectCard(t);
        if (G.selCard) G.drag = { t, id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
    },
    closeUnit() { UI.closeUnitPanel(); V.setSelected(G.world, null); },
    upgradeUnit(id) { const why = W.upgradeUnit(G.world, id); if (why) { SFX.error(); UI.toast(why === 'gold' ? 'Not enough gold' : why); } UI.renderUnitPanel(G.world); G.panelT = 0.12; },
    sellUnit(id) { W.sellUnit(G.world, id); UI.closeUnitPanel(); V.setSelected(G.world, null); },
    relic(r, replace = -1) {
        const w = G.world;
        if (!W.chooseRelic(w, r, replace)) return;
        UI.hideScreen('clear');
        if (G.victoryPending) { G.victoryPending = false; showVictory(); }
    },
    retry() {
        if (!G.snapshot) return;
        const w = W.retryFrom(G.snapshot, G.lostEarned, G.meta.tree);
        UI.hideScreen('lost');
        startGame(w, { retry: true });
        UI.toast(`Rallied! +${UI.fmt(w.retryBonus)} gold from the attempt. Spend it and try again.`, false, 4200);
    },
    toTitle: () => toTitle(),
    continueGame, newGame,
    openEmbers() { UI.renderEmbers(G.meta, currentRun()); UI.showScreen('embers'); },
    openBestiary() {
        // The species are rolled per defence, so show the one in progress (or the saved one).
        let w = G.mode === 'game' ? G.world : null;
        if (!w && G.runSave) { try { w = W.restoreRun(G.runSave, G.meta.tree); } catch { w = null; } }
        UI.renderBestiary(G.meta, w ?? G.attract);
        UI.showScreen('bestiary');
    },
    buyRank(k) { if (buyRank(G.meta, k)) { SFX.upgrade(true); writeSave(); } UI.renderEmbers(G.meta, currentRun()); },
    rekindle() {
        const run = currentRun();
        const gain = rekindleGain(run);
        if (!gain) return;
        if (!confirm(`Rekindle? This defence ends and you start again from wave 1 with ${gain} Embers to spend.`)) return;
        rekindle(G.meta, run);
        G.runSave = null;
        G.world = null;
        G.snapshot = null;
        writeSave();
        UI.hideScreen('lost');
        toTitle();
        UI.renderEmbers(G.meta, null);
        UI.showScreen('embers');
        SFX.fanfare();
    },
    reset() {
        if (!confirm('Erase all progress, Embers and settings?')) return;
        try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
        loadSave();
        UI.writeSettings(G.meta.settings);
        UI.hideScreen('settings');
        toTitle();
    },
    settings(s) {
        const prevQ = G.meta.settings.quality;
        G.meta.settings = { ...G.meta.settings, ...s };
        setSound(s.sound); setMusic(s.music);
        if (s.quality !== prevQ) { const q = s.quality === 'auto' ? pickQuality() : +s.quality; setPixelQuality(Math.min(q, 2)); G.qualityLock = s.quality !== 'auto'; }
        writeSave();
    },
    closed(id) { if (id === 'keep') UI.closeUnitPanel(); },
};

/** The run as the meta layer sees it (live world if playing, else the save). */
function currentRun() {
    if (G.mode === 'game' && G.world) return { best: G.world.best, wave: G.world.wave, castle: G.world.castle };
    return G.runSave;
}

// ------------------------------------------------------------------ Input

function bindInput() {
    const cv = $('c');
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
        initAudio();
        G.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    addEventListener('pointermove', (e) => {
        if (G.mode !== 'game' || !G.world) return;
        if (G.drag && e.pointerId === G.drag.id) {
            if (!G.drag.active && Math.hypot(e.clientX - G.drag.x, e.clientY - G.drag.y) > 14) G.drag.active = true;
        }
        if (G.selCard && (e.pointerType === 'mouse' || G.drag?.active)) {
            const slot = V.pickSlot(G.world, e.clientX, e.clientY);
            V.setHover(G.world, slot, slot ? !W.canPlace(G.world, G.selCard, slot) || W.canPlace(G.world, G.selCard, slot) === 'recharging' : false);
        } else if ((G.armedPower >= 0 || G.armedKeepfire) && e.pointerType === 'mouse') {
            const l = V.pickLane(e.clientX, e.clientY);
            V.setHover(G.world, l ? { kind: 'field', lane: l.lane, col: Math.floor(l.x) } : null, true);
        }
    });
    addEventListener('pointerup', (e) => {
        if (G.drag && e.pointerId === G.drag.id) {
            const d = G.drag;
            G.drag = null;
            if (d.active) {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                if (el === $('c')) tryPlace(V.pickSlot(G.world, e.clientX, e.clientY));
                V.setHover(G.world, null);
                return;
            }
        }
        if (!G.down || e.pointerId !== G.down.id) return;
        const dn = G.down;
        G.down = null;
        if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 16) return;
        if (e.target !== $('c')) return;
        tap(e.clientX, e.clientY, e.pointerType);
    });
    addEventListener('keydown', onKey);
    addEventListener('blur', () => { if (G.mode === 'game' && G.world?.phase === 'wave' && !anyBlocking()) handlers.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G.mode === 'game') { saveRun(); if (G.world?.phase === 'wave' && !anyBlocking()) handlers.pause(); } } });
}

function tap(x, y, ptype = 'mouse') {
    if (G.mode !== 'game' || !G.world) return;
    const w = G.world;
    if (anyBlocking()) return;
    if (G.armedPower >= 0) {
        const l = V.pickLane(x, y);
        if (!l) return;
        W.usePower(w, G.armedPower, l);
        clearSelection();
        return;
    }
    if (G.armedKeepfire) {
        const l = V.pickLane(x, y);
        if (!l) return;
        W.fireKeepfire(w, l.lane);
        clearSelection();
        return;
    }
    const orb = V.pickOrb(w, x, y, ptype === 'mouse' ? 34 : 54);
    if (orb) {
        const pos = V.orbScreen(orb.id);
        W.collectOrb(w, orb.id);
        if (orb.kind === 'mote' && pos) UI.flyCoins(pos.x, pos.y, 4);
        return;
    }
    if (G.selCard) {
        const slot = V.pickSlot(w, x, y);
        if (slot) { tryPlace(slot); return; }
        clearSelection();
        return;
    }
    const u = V.pickUnit(w, x, y);
    if (u) {
        UI.openUnitPanel(w, u, V.unitScreen(u));
        V.setSelected(w, u);
        return;
    }
    if (V.pickCastle(x, y)) { handlers.openKeep(); return; }
    UI.closeUnitPanel();
    V.setSelected(w, null);
}

const BLOCKING = ['keep', 'clear', 'modal', 'lost', 'pause', 'settings', 'embers', 'bestiary', 'help', 'victory', 'title'];
const anyBlocking = () => BLOCKING.some((id) => UI.isOpen(id));

function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key;
    if (k === 'm' || k === 'M') { const on = !G.meta.settings.sound; handlers.settings({ ...G.meta.settings, sound: on, music: on }); UI.writeSettings(G.meta.settings); return; }
    if (G.mode !== 'game' || !G.world) return;
    const w = G.world;
    if (k === 'Escape') {
        if (UI.isOpen('modal')) { $('modal-ok').click(); return; }
        for (const id of ['keep', 'settings', 'help', 'bestiary', 'embers']) if (UI.isOpen(id)) { UI.hideScreen(id); return; }
        if (UI.isOpen('pause')) { handlers.resume(); return; }
        if (G.selCard || G.armedPower >= 0 || G.armedKeepfire) { clearSelection(); return; }
        if (UI.unitPanelId()) { handlers.closeUnit(); return; }
        handlers.pause();
        return;
    }
    if (UI.isOpen('modal') && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('modal-ok').click(); return; }
    if (anyBlocking()) return;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (w.phase === 'prep') handlers.startWave(); else if (w.phase === 'wave') handlers.pause(); return; }
    if (k === 'p' || k === 'P') { handlers.pause(); return; }
    if (k === 's' || k === 'S') { handlers.speed(); return; }
    if (k === 'k' || k === 'K') { handlers.openKeep(); return; }
    if (k === 'f' || k === 'F') { handlers.keepfire(); return; }
    const pi = 'qwer'.indexOf(k.toLowerCase());
    if (pi >= 0) { handlers.power(pi); return; }
    const di = '1234567890-'.indexOf(k);
    if (di >= 0) { const list = W.unlockedUnits(w); if (list[di]) selectCard(list[di]); return; }
    if (k === 'u' || k === 'U') { const id = UI.unitPanelId(); if (id) handlers.upgradeUnit(id); }
}

// ------------------------------------------------------------------ Events → sound & HUD

const SHOOT_SFX = { archer: 'bow', pyro: 'fireball', frost: 'ice', ballista: 'ballista', cleric: 'holy', dwarf: 'fireball' };

function onGameEvents(w, events) {
    for (const e of events) {
        switch (e.type) {
            case 'waveStart':
                SFX.horn(2);
                UI.banner(`Wave ${e.wave}`, e.boss ? `${REGIONS[w.regionIdx].boss.name} is coming` : REGIONS[w.regionIdx].name);
                setMusicState(w.regionIdx, e.boss ? 1 : 1);
                if (w.wave === 1) setTimeout(() => hint('mote', 'Tap the falling embers for gold, and glowing orbs for powerups.', 5500), 9000);
                break;
            case 'horde': SFX.horn(3); UI.banner('A great horde approaches!', '', 'red'); break;
            case 'bossArrive': {
                SFX.roar();
                const R = REGIONS[w.regionIdx];
                UI.banner(R.boss.name, R.boss.title, 'red');
                setMusicState(w.regionIdx, 2);
                break;
            }
            case 'shoot': { const s = SHOOT_SFX[e.unit]; if (s) SFX[s](); break; }
            case 'swing': SFX.clang(); break;
            case 'chain': SFX.zap(); break;
            case 'strike': SFX.zap(); break;
            case 'hit': if (e.dtype === 'phys') SFX.thunk(); break;
            case 'explode': if (e.kind === 'barrel' || e.kind === 'meteor' || e.kind === 'sapper' || e.kind === 'enemyBlast') SFX.boom(e.kind === 'meteor' ? 2 : 1.2); else if (e.kind === 'fire') SFX.boom(0.5); break;
            case 'kill': {
                const sp = w.speciesById[e.species];
                if (sp) SFX.voice(sp.voice.kind, sp.voice.pitch * (0.9 + Math.random() * 0.2));
                if (e.gold >= 20 || Math.random() < 0.25) { const p = V.screenOf(e.x, e.y + 0.6, e.z); UI.flyCoins(p.x, p.y, Math.min(5, 1 + Math.floor(e.gold / 15))); SFX.coin(); }
                if (e.arch === 'treasure') UI.toast('Loot! The carrier dropped its hoard.');
                break;
            }
            case 'bossDown': G.slow = 1.6; SFX.fanfare(); UI.banner('Victory!', `${REGIONS[w.regionIdx].boss.name} has fallen`); break;
            case 'wallHit': SFX.wallHit(); if (w.wallHp < w.wallMax * 0.3) SFX.alarm(); break;
            case 'brew': SFX.brew(); { const p = V.screenOf(e.x, 0.9, e.z); UI.flyCoins(p.x, p.y, 1); } break;
            case 'collect': SFX.collect(); if (e.kind === 'power' && !e.sold) hint('usepower', 'Powerup stashed! Tap it on the right (or press Q/W/E) to use it.', 5000); if (e.sold) UI.toast(`Powerup slots full: sold for ${e.gold} gold`); break;
            case 'orb': hint('orb', 'A powerup orb! Tap it before it fades.', 4500); break;
            case 'place': SFX.place(); break;
            case 'upgrade': SFX.upgrade(e.perk); if (e.perk) UI.toast(`${UNITS[e.unit].name} perk: ${UNITS[e.unit].perks[e.level]}`); break;
            case 'sell': SFX.sell(); break;
            case 'unitDie': SFX.unitDie(); UI.toast(`Your ${UNITS[e.unit].name} has fallen!`); if (UI.unitPanelId() === e.id) UI.closeUnitPanel(); break;
            case 'power': {
                const map = { meteor: 'meteor', nova: 'nova', storm: 'thunder', rally: 'horn', mend: 'mend', midas: 'midas', arrows: 'arrows', quake: 'quake' };
                SFX[map[e.power]]?.();
                UI.banner(POWERS[e.power].name, RARITIES[e.rarity].name, '');
                break;
            }
            case 'keepfire': SFX.keepfire(); UI.banner('KEEPFIRE!', '', 'red'); break;
            case 'bossAct':
                if (['howl', 'warcry', 'enrage', 'land', 'stomp'].includes(e.act)) SFX.roar();
                if (e.act === 'telegraph') UI.toast('Vael draws breath — clear that lane!');
                if (e.act === 'freeze') SFX.nova();
                if (e.act === 'breath') SFX.boom(1.6);
                break;
            case 'phoenix': UI.banner('Phoenix Feather!', 'The wall rises from the ashes'); break;
            case 'escape': UI.toast('The loot carrier escaped!'); break;
            case 'leap': SFX.voice('growl', 1.2, false); break;
            case 'emerge': SFX.boom(0.4); break;
            case 'freeze': SFX.ice(); break;
            case 'castle': SFX.upgrade(false); SFX.place(); break;
            case 'relic': SFX.relic(); break;
            case 'waveClear':
                SFX.fanfare();
                setMusicState(w.regionIdx, 0);
                UI.banner(e.boss ? 'Region Secured!' : 'Wave Held!', `+${UI.fmt(e.bonus + e.interest)} gold`);
                if (e.wave === FINAL_WAVE && !G.meta.won) G.victoryPending = true;
                G.meta.kills += e.kills;
                setTimeout(() => { if (G.world === w && w.phase === 'cleared') UI.openClear(w); }, 1300);
                break;
            case 'lost': {
                SFX.defeat();
                G.lostEarned = e.earned;
                const run = { best: w.best };
                setTimeout(() => { if (G.world === w) UI.showLost(w, e.earned, rekindleGain(run) > 0, rekindleGain(run)); }, 1500);
                break;
            }
            case 'prep': if (G.world === w) setTimeout(() => prepFlow(), 30); break;
        }
    }
}

function showVictory() {
    G.meta.won = true;
    writeSave();
    $('victory-body').innerHTML = `Vael falls out of the sky and the Black Sun goes out like a snuffed candle.<br><br>Emberhold stands. Its fire is the only light for a hundred leagues, and for the first time in a long while, it is enough.<br><br><span class="dim">The Night-tide does not end; it never did. The Long Night goes on from here, wave after wave, as far as you can hold it. Rekindle whenever you like.</span>`;
    UI.showScreen('victory');
    SFX.fanfare();
}

// ------------------------------------------------------------------ Loop

function loop(now) {
    requestAnimationFrame(loop);
    const rdt = Math.min(0.05, (now - G.last) / 1000);
    G.last = now;
    G.t += rdt;
    adaptQuality(rdt);

    if (G.mode === 'title') {
        const w = G.attract;
        G.acc += rdt;
        let steps = 0;
        while (G.acc >= SIM_DT && steps < 4) { W.step(w, SIM_DT); G.acc -= SIM_DT; steps++; if ((Math.round(w.waveT * 60) % 20) === 0) botTick(w); }
        V.onEvents(w, W.drainEvents(w));
        if (w.phase !== 'wave') { newAttract(); V.setWorld(G.attract); }
        V.setCameraQuat(camera.quaternion);
        V.updateView(G.attract, rdt, G.t);
        render(rdt, G.t);
        return;
    }

    const w = G.world;
    const blocked = anyBlocking();
    let scale = G.speed;
    if (G.slow > 0) { G.slow -= rdt; scale *= 0.3; }
    let vdt = rdt;
    if (w.phase === 'wave' && !blocked) {
        G.acc += rdt * scale;
        let steps = 0;
        while (G.acc >= SIM_DT && steps < 12) { W.step(w, SIM_DT); G.acc -= SIM_DT; steps++; }
        if (steps >= 12) G.acc = 0;
        vdt = rdt * scale;
    } else if (blocked) vdt = rdt * 0.15;
    const evs = W.drainEvents(w);
    if (evs.length) { V.onEvents(w, evs); onGameEvents(w, evs); }
    if (w.phase === 'prep' && G.autoT > 0 && !blocked && !G.queue.length) { G.autoT -= rdt; if (G.autoT <= 0) handlers.startWave(); }
    V.setCameraQuat(camera.quaternion);
    V.updateView(w, vdt, G.t);
    UI.updateHUD(w, { speed: G.speed, armedPower: G.armedPower, armedKeepfire: G.armedKeepfire, hidePrep: UI.isOpen('modal') });
    $('start-btn').classList.toggle('hidden', w.phase !== 'prep');
    if (UI.unitPanelId() && (G.panelT = (G.panelT ?? 0) - rdt) <= 0) {
        G.panelT = 0.12;
        UI.renderUnitPanel(w);
        const u = w.units.find((x) => x.id === UI.unitPanelId());
        if (u) V.setSelected(w, u); else V.setSelected(w, null);
    }
    if (UI.isOpen('keep')) $('keep-gold').textContent = UI.fmt(w.gold);
    render(vdt, G.t);
}

function adaptQuality(dt) {
    if (G.qualityLock || DEBUG) return;
    G.frameTimes.push(dt);
    if (G.frameTimes.length < 180) return;
    const avg = G.frameTimes.reduce((a, b) => a + b, 0) / G.frameTimes.length;
    G.frameTimes.length = 0;
    const q = getQuality();
    if (avg > 0.04 && q > 0) { setPixelQuality(q - 1); onResize(); }
}

// ------------------------------------------------------------------ Debug hooks (?debug=1)

function exposeDebug() {
    window.__kf = {
        get world() { return G.world; }, get attract() { return G.attract; }, get mode() { return G.mode; }, G, W, V, UI,
        gold(n = 1e5) { G.world.gold += n; },
        killAll() { for (const e of G.world.enemies) W.damageEnemy(G.world, e, 1e12, { type: 'phys', explosive: true }); },
        god(on = true) { G.world.god = on; },
        toWave(n) { const w = W.createWorld({ seed: G.world?.seed ?? 7, wave: n, ember: G.meta.tree, gold: 900 * Math.pow(1.13, n) }); startGame(w, {}); return w; },
        skipModals() { while (UI.isOpen('modal')) $('modal-ok').click(); },
        quality: (q) => setPixelQuality(q),
        newGame, startWave: () => handlers.startWave(), state: () => G.meta, save: () => writeSave(),
        shake, handlers,
        /** Step the simulation synchronously (events flow through the normal path). */
        advance(sec) {
            const w = G.world;
            for (let i = 0; i < Math.round(sec / SIM_DT) && w.phase === 'wave'; i++) W.step(w, SIM_DT);
            const evs = W.drainEvents(w);
            V.onEvents(w, evs); onGameEvents(w, evs);
            return w.phase;
        },
        orb(kind = 'power', x = 3, lane = 2) {
            const w = G.world;
            if (kind === 'mote') W.spawnMote(w); else W.spawnPowerOrb(w, x, (lane - 2) * 1.15, 0);
            const o = w.orbs[w.orbs.length - 1];
            if (kind === 'mote') { o.y = 0.6; o.t = 3; }
            return o.id;
        },
        cellScreen(lane, col) { return V.screenOf(col + 0.5, 0, (lane - 2) * 1.15); },
        wallScreen(lane, tier) { const p = V.slotPos(G.world, { kind: 'wall', lane, tier }); return V.screenOf(p.x, p.y + 0.3, p.z); },
    };
}

boot().catch((err) => {
    console.error(err);
    const l = $('loading');
    if (l) l.textContent = 'Could not start: ' + err.message;
});
