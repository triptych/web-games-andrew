/**
 * main.js — boot, the frame loop, and the glue between the simulation, the 3D view, the DOM and
 * the sound. The simulation runs on a fixed 1/30 s step (1×, 2× or 3× per frame); `world.events`
 * (heals, arrivals, collapses, cures, waves) become particles, sounds, kind words and toasts.
 *
 * Behind the title and the valley map, a demo level plays itself with the balance bot.
 *
 * Debug: ?debug=1 exposes window.__hr; ?fast=N runs N× simulation; ?q=0|1|2 forces a quality tier;
 * ?level=N opens that level's briefing.
 */

import * as THREE from 'three';
import { STEP, W, H, THEMES, VERSION } from './config.js';
import { World } from './sim/world.js';
import { Bot } from './sim/bot.js';
import { levelDef, LEVELS, ENDLESS, newStations } from './sim/levels.js';
import { STATIONS, TRADES, BOSSES, DEAD } from './sim/data.js';
import { lettersFor } from './sim/names.js';
import { idx, buildable } from './sim/mapgen.js';
import { RNG } from './rng.js';
import * as stage from './view/stage.js';
import { Terrain } from './view/terrain.js';
import { Actors } from './view/actors.js';
import { FX } from './view/fx.js';
import { Weather } from './view/weather.js';
import { stationModel, disposeGroup } from './view/models.js';
import { ghostMat, time as timeU } from './view/materials.js';
import * as UI from './ui.js';
import { Input } from './input.js';
import { initAudio, sfx, setVolumes, setMuted, setMood } from './audio.js';
import * as Save from './save.js';

const params = new URLSearchParams(location.search);
const STATION_SCALE = 1.25;
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(20, Number(params.get('fast')) || 1));

const app = {
    mode: 'title', world: null, bot: null, levelN: 1, demo: true, preview: false,
    speed: 1, paused: false, acc: 0, frameNo: 0, seq: 0, t: 0,
    progress: Save.loadProgress(), settings: Save.loadSettings(),
    tool: null, sel: null, hover: null, runSeed: 0, hintStep: 0, hintT: 0, flags: {}, resultsShown: false,
    stationViews: new Map(), ghost: null, ghostKey: '', moanT: 3, insetsKey: '',
};
window.addEventListener('error', () => {});

// ------------------------------------------------------------------ boot
const isPhone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
let quality = params.has('q') ? Number(params.get('q')) : app.settings.quality >= 0 ? app.settings.quality : isPhone ? 1 : 0;
const canvas = document.getElementById('gl');
stage.initStage(canvas, quality);
const terrain = new Terrain(stage.scene);
const dyn = new THREE.Group();
dyn.position.set(-W / 2, 0, -H / 2);
stage.scene.add(dyn);
const actors = new Actors(dyn);
const fx = new FX(dyn);
const weather = new Weather(dyn);
const vrng = new RNG(1234);
const clock = new THREE.Clock();

setVolumes(app.settings.music, app.settings.sfx);
setMuted(app.settings.muted);

let resizePending = true;
window.addEventListener('resize', () => { resizePending = true; });
window.visualViewport?.addEventListener('resize', () => { resizePending = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.mode === 'play' && !app.paused) { app.paused = true; app.flags.autoPaused = true; } });
const unlockAudio = () => { initAudio(); };
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

// ------------------------------------------------------------------ levels
function demoLevel() {
    const u = Math.min(12, app.progress.unlocked);
    const pick = LEVELS.filter((l) => !l.boss && l.n <= u);
    return pick[pick.length - 1].n;
}

function loadLevel(n, { demo = false, preview = false, runSeed = 0 } = {}) {
    app.levelN = n;
    app.demo = demo;
    app.preview = preview;
    app.runSeed = runSeed;
    const roster = demo ? { firefighter: 6, nurse: 6, gardener: 6, athlete: 6, musician: 6, mechanic: 6, storyteller: 3 } : { ...app.progress.roster };
    app.world = new World({ level: n, roster, runSeed });
    app.bot = demo ? new Bot(app.world) : null;
    app.seq = 0;
    app.acc = 0;
    app.resultsShown = false;
    app.hintStep = 0; app.hintT = 0; app.flags = {};
    const L = app.world.level;
    terrain.build(app.world.map, app.world.theme);
    const T = stage.applyTheme(app.world.theme, !!L.dusk);
    weather.set(app.world.theme, T.night);
    actors.clear();
    fx.clear();
    for (const [, v] of app.stationViews) { dyn.remove(v.group); disposeGroup(v.group); }
    app.stationViews.clear();
    selectTool(null);
    deselect();
    stage.resetView();
    stage.snapCamera();
    const act = L.endless ? ['autumn', 'winter', 'city'].indexOf(app.world.theme) + 1 : L.act;
    setMood(demo ? 'title' : L.boss ? 'boss' : 'play', act);
    actors.setVisible(!demo || app.mode !== 'title');
}

// ------------------------------------------------------------------ screens
function toTitle() {
    UI.closeModal();
    app.mode = 'title';
    UI.showScreen('title');
    UI.renderTitle(app.progress);
    if (!app.demo || !app.world) loadLevel(demoLevel(), { demo: true });
    stage.rig.auto = 0.05;
    setMood('title');
    actors.setVisible(false);
}
function openValley() {
    UI.closeModal();
    sfx.ui();
    app.mode = 'valley';
    UI.showScreen('valley');
    UI.renderValley(app.progress);
    if (!app.demo) loadLevel(demoLevel(), { demo: true });
    stage.rig.auto = 0.05;
    actors.setVisible(false);
}
function openBrief(n) {
    sfx.ui();
    UI.closeModal();
    app.mode = 'brief';
    const L = levelDef(n);
    UI.renderBrief(L, app.progress);
    UI.showScreen('brief');
    loadLevel(n, { preview: true, runSeed: L.endless ? (Date.now() % 100000) : 0 });
    stage.rig.auto = 0.05;
    actors.setVisible(false);
}
function startLevel() {
    sfx.ui();
    initAudio();
    app.mode = 'play';
    stage.rig.auto = 0;
    const L = app.world.level;
    if (!app.preview || app.world.time > 0 || app.world.stations.length) loadLevel(app.levelN, { runSeed: app.runSeed });
    app.preview = false;
    app.demo = false;
    app.speed = 1;
    app.paused = false;
    UI.uiState.tab = 'stations';
    UI.showScreen('play');
    UI.buildTray(app.world, newStations(L));
    actors.setVisible(true);
    setMood(L.boss ? 'boss' : 'play', L.endless ? ['autumn', 'winter', 'city'].indexOf(app.world.theme) + 1 : L.act);
    app.progress.stats.played++;
    Save.saveProgress(app.progress);
    resizePending = true;
    UI.toast(L.endless ? 'Open Road' : `${L.boss ? '☠ ' : ''}${L.name}`, 'big', 2200);
}

// ------------------------------------------------------------------ actions (UI and input call these)
const act = {
    openValley, openBrief, startLevel, toTitle,
    openJournal: () => { sfx.ui(); UI.journal(app.progress); },
    openSettings: () => { sfx.ui(); openSettings(() => UI.closeModal()); },
    sfx: (k) => sfx[k] && sfx[k](),
    gate() {
        if (app.mode !== 'play' || !app.world) return;
        if (app.world.startWave()) { app.paused = false; }
        else if (app.world.state === 'wave') { /* already walking */ }
    },
    speed() { if (app.mode !== 'play') return; app.speed = app.speed >= 3 ? 1 : app.speed + 1; sfx.ui(); },
    pause() { if (app.mode !== 'play') return; app.paused = !app.paused; app.flags.autoPaused = false; sfx.ui(); },
    toggleSound() { app.settings.muted = !app.settings.muted; setMuted(app.settings.muted); Save.saveSettings(app.settings); },
    menu() { if (app.mode !== 'play') return; openPauseMenu(); },
    escape() {
        if (UI.modalOpen()) { if (UI.uiState.modalClose) UI.uiState.modalClose(); return; }
        if (app.mode === 'brief') { openValley(); return; }
        if (app.mode === 'valley') { toTitle(); return; }
        if (app.mode !== 'play') return;
        if (app.tool) { selectTool(null); return; }
        if (app.sel) { deselect(); return; }
        openPauseMenu();
    },
    recentre() { stage.resetView(); },
    zoom(f) { stage.zoomBy(f); },
    drag(x0, y0, x1, y1) {
        const a = stage.groundAt(x0, y0), b = stage.groundAt(x1, y1);
        if (a && b) stage.panBy(a.x - b.x, a.z - b.z);
    },
    hover(x, y) { app.hover = { x, y }; },
    tap(x, y) { onTap(x, y); },
    toolKey(i) {
        if (app.mode !== 'play') return;
        if (app.world.boss && UI.uiState.tab === 'vols') { const k = Object.keys(TRADES)[i]; if (k) selectTool({ vol: k }); return; }
        const k = app.world.open[i];
        if (k) selectTool({ station: k });
    },
    selectTool,
    rebuildTray: () => UI.buildTray(app.world, newStations(app.world.level)),
    upgrade(id) {
        const r = app.world.upgrade(id);
        if (r.ok) { sfx.upgrade(); const s = app.world.stations.find((q) => q.id === id); fx.burst('sparkle', s.x, s.z, { n: 14, y: 0.4 }); UI.renderCard(app.world, true); }
        else { sfx.error(); UI.toast(r.why === 'supplies' ? 'Not enough supplies yet' : 'Already fully set up'); }
    },
    upgradeSelected() { if (app.sel && app.sel.kind === 'station') act.upgrade(app.sel.id); },
    sell(id) {
        const s = app.world.stations.find((q) => q.id === id);
        if (!s) return;
        app.world.sell(id);
        sfx.packUp();
        fx.burst('dust', s.x, s.z);
        deselect();
    },
    recall(id) { if (app.world.recall(id).ok) { sfx.recall(); deselect(); } },
    cardClosed() { app.sel = null; fx.hideRange(); },
};
UI.initUI(act);
const input = new Input(canvas, act);

function selectTool(t) {
    if (t && app.tool && ((t.station && t.station === app.tool.station) || (t.vol && t.vol === app.tool.vol))) t = null;   // tap again to put it back
    app.tool = t;
    UI.uiState.tool = t;
    if (t) { deselect(); sfx.tab(); }
    terrain.showOverlay(!!t, app.world ? app.world.occ : null);
    if (app.ghost) { dyn.remove(app.ghost); disposeGroup(app.ghost); app.ghost = null; app.ghostKey = ''; }
    if (!t) fx.hideRange();
    if (t && t.station) {
        const { group } = stationModel(t.station, 0);
        const gm = ghostMat(true);
        group.traverse((o) => { if (o.isMesh) { o.material = gm; o.castShadow = false; } });
        group.visible = false;
        dyn.add(group);
        app.ghost = group;
        app.ghostKey = t.station;
    }
    if (t && app.mode === 'play' && app.world.level.hints && app.hintStep === 0) app.hintStep = 1;
}

function deselect() { app.sel = null; UI.hideCard(); fx.hideRange(); }

const WHY = {
    supplies: 'Not enough supplies yet', ground: 'Stations go on open grass beside the road', taken: 'Something is already there', locked: 'Not open on this road yet',
    none: 'Nobody of that trade is free right now', slots: 'Every volunteer slot is filled: call someone back first', over: '', boss: '', trade: '',
};

function tileAt(x, y) {
    const g = stage.groundAt(x, y);
    if (!g) return null;
    return { x: Math.floor(g.x), z: Math.floor(g.z), fx: g.x, fz: g.z };
}

function onTap(x, y) {
    if (app.mode !== 'play' || !app.world) return;
    const w = app.world;
    const t = tileAt(x, y);
    if (app.tool) {
        if (!t) return;
        if (app.tool.station) {
            const r = w.build(app.tool.station, t.x, t.z);
            if (r.ok) {
                sfx.build();
                fx.burst('dust', r.station.x, r.station.z);
                fx.burst('sparkle', r.station.x, r.station.z, { n: 10 });
                const keep = w.supplies >= STATIONS[app.tool.station].cost[0] && !matchMedia('(pointer: coarse)').matches && app.flags.shift;
                if (!keep) selectTool(null); else terrain.showOverlay(true, w.occ);
            } else { sfx.error(); if (WHY[r.why]) UI.toast(WHY[r.why], '', 1600); }
        } else if (app.tool.vol) {
            const r = w.deploy(app.tool.vol, t.x, t.z);
            if (r.ok) {
                sfx.deploy();
                fx.burst('heart', r.person.x, r.person.z, { n: 3, col: 0xffd86a });
                if (w.available(app.tool.vol) <= 0 || w.activeVols() >= w.slots) selectTool(null); else terrain.showOverlay(true, w.occ);
            } else { sfx.error(); if (WHY[r.why]) UI.toast(WHY[r.why], '', 1600); }
        }
        return;
    }
    // select: a person or one of the dead under the finger, else a station on the tile
    const hit = actors.pick(w, x, y, stage.toScreen, matchMedia('(pointer: coarse)').matches ? 34 : 24);
    if (hit) { app.sel = hit; UI.showCard(hit, w); sfx.tab(); return; }
    if (t && t.x >= 0 && t.z >= 0 && t.x < W && t.z < H) {
        const o = w.occ[idx(t.x, t.z)];
        if (o > 0) { app.sel = { kind: 'station', id: o }; UI.showCard(app.sel, w); sfx.tab(); return; }
        if (o < 0) { app.sel = { kind: 'person', id: -o }; UI.showCard(app.sel, w); sfx.tab(); return; }
    }
    deselect();
}
window.addEventListener('keydown', (e) => { if (e.key === 'Shift') app.flags.shift = true; });
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') app.flags.shift = false; });

function openPauseMenu() {
    const wasPaused = app.paused;
    app.paused = true;
    UI.pauseMenu({
        levelName: app.world.level.name,
        resume: () => { UI.closeModal(); app.paused = wasPaused && !app.flags.autoPaused ? wasPaused : false; },
        restart: () => { UI.closeModal(); loadLevel(app.levelN, { runSeed: app.runSeed }); startLevel(); },
        settings: () => openSettings(() => openPauseMenu()),
        quit: () => { UI.closeModal(); openValley(); },
    });
}

function openSettings(back) {
    UI.settingsPanel(app.settings, {
        change: (k, v) => {
            app.settings[k] = v;
            if (k === 'music' || k === 'sfx') setVolumes(app.settings.music, app.settings.sfx);
            if (k === 'quality') { quality = v >= 0 ? v : isPhone ? 1 : 0; stage.setQuality(quality); resizePending = true; }
            Save.saveSettings(app.settings);
        },
        reset: () => UI.confirm('Forget every road, every letter and every volunteer?', () => { app.progress = Save.resetProgress(); Save.saveProgress(app.progress); toTitle(); }, () => openSettings(back)),
        back,
    });
}

// ------------------------------------------------------------------ results
function finishLevel() {
    if (app.resultsShown || app.demo) return;
    app.resultsShown = true;
    const w = app.world;
    const sum = w.summary();
    const P = app.progress;
    const rng = new RNG((Date.now() >>> 0) ^ 0x5eed);
    const letters = lettersFor(rng, sum.saved.filter((s) => !s.restored), 3);
    if (w.boss && w.bossCured) letters.unshift({ from: BOSSES[w.level.boss].from, open: 'Dear Haven,', body: ['I don\'t remember much of the last few weeks. I remember a terrible weight, and then light, and then a lot of people I didn\'t know telling me I was going to be all right.', 'They were right. Thank you for not giving up on me.'], sign: 'Your friend,', kind: 'adult' });
    // progress keeps everyone who made it, even on a road that ended early
    P.roster = { ...w.roster };
    P.letters = [...letters, ...P.letters];
    P.remembered = [...sum.lost, ...P.remembered];
    const s = P.stats;
    s.saved += sum.stats.saved; s.thriving += sum.stats.thriving; s.lost += sum.stats.lost; s.cured += sum.stats.cured; s.treated += sum.stats.treated;
    let unlockedText = '';
    const L = w.level;
    if (sum.state === 'won' && !L.endless) {
        s.won++;
        const rec = P.levels[L.n] || { stars: 0 };
        P.levels[L.n] = { stars: Math.max(rec.stars || 0, sum.stars), saved: Math.max(rec.saved || 0, sum.stats.saved), spawned: sum.stats.spawned };
        if (P.unlocked === L.n && L.n < 12) { P.unlocked = L.n + 1; unlockedText = `A new road opens: ${LEVELS[L.n].name}.`; }
    }
    if (L.endless) P.endlessBest = Math.max(P.endlessBest || 0, sum.stats.saved);
    const firstFinish = sum.state === 'won' && L.n === 12 && !P.finished;
    if (firstFinish) P.finished = true;
    Save.saveProgress(P);
    if (sum.state === 'won') { sfx.victory(); setMood('win'); } else sfx.defeat();
    const show = () => UI.results(sum, letters, {
        boss: !!L.boss,
        unlockedText,
        next: sum.state === 'won' && L.n < 12 && !L.endless ? () => { UI.closeModal(); openBrief(L.n + 1); } : null,
        retry: () => { UI.closeModal(); loadLevel(app.levelN, { runSeed: L.endless ? (Date.now() % 100000) : 0 }); startLevel(); },
        valley: () => { UI.closeModal(); openValley(); },
    });
    setTimeout(() => {
        if (app.mode !== 'play') return;
        if (firstFinish) UI.epilogue(show); else show();
        for (let i = 0; i < 3; i++) setTimeout(() => sfx.letter(), 900 + i * 350);
    }, 1600);
}

// ------------------------------------------------------------------ events → feel
function screenOf(target) {
    const w = app.world;
    if (!w) return null;
    if (target.id) {
        const p = w.people.find((q) => q.id === target.id) || w.dead.find((q) => q.id === target.id);
        if (p) { target.x = p.x; target.z = p.z; target.hgt = p.boss ? 2.2 : 0.78; }
        else if (target.x == null) return null;
    }
    return stage.toScreen(target.x, target.hgt ?? 0.5, target.z);
}

function handleEvents() {
    const w = app.world;
    const evs = w.eventsSince(app.seq);
    if (!evs.length) return;
    app.seq = evs[evs.length - 1].seq;
    const play = app.mode === 'play';
    const words = play && app.settings.words;
    let healN = 0;
    for (const e of evs) {
        switch (e.type) {
            case 'heal': if (healN++ < 6) fx.burst('heal', e.x, e.z, { col: 0x7cf28a }); if (play) sfx.heal(); break;
            case 'mend': fx.burst('heal', e.x, e.z, { col: 0x9ff0ff }); break;
            case 'splash': fx.burst('splash', e.x, e.z, { r: e.r, col: 0x8af27a }); fx.ring(e.x, e.z, e.r, 0x8af27a, 0.5); if (play) sfx.cureSick(); break;
            case 'fed': fx.burst('steam', e.x, e.z, { y: 0.45 }); fx.burst('heart', e.x, e.z, { n: 1, col: 0xffd86a }); if (play) sfx.soup(); break;
            case 'warm': fx.burst('ember', e.x, e.z); fx.burst('heart', e.x, e.z, { n: 1, col: 0xff9a5a }); if (play) sfx.warm(); break;
            case 'calm': fx.burst('notes', e.x, e.z, { n: 2 }); if (play) sfx.calm(); break;
            case 'splinted': fx.burst('sparkle', e.x, e.z, { n: 6, col: 0xffffff }); if (play) sfx.splint(); break;
            case 'revive': fx.burst('sparkle', e.x, e.z, { n: 12, col: 0xffe48a }); fx.burst('heart', e.x, e.z, { n: 3 }); if (play) sfx.revive(); break;
            case 'carry': fx.burst('dust', e.x, e.z, { col: 0xffffff }); if (play) sfx.carry(); break;
            case 'say': if (words) UI.word(e.id, e.text, '', 2.4); break;
            case 'saved': {
                fx.burst('heart', e.x, e.z, { n: e.thriving ? 4 : 2, col: e.thriving ? 0xff7a8a : 0xffb0b8 });
                if (e.thriving) fx.burst('sparkle', e.x, e.z, { n: 6 });
                actors.addToCrowd({ z: e.z, look: e.look, kind: e.kind, trade: e.trade, restored: e.restored }, () => vrng.next());
                terrain.setGrowth(w.stats.saved + w.stats.restored);
                if (play) { sfx.saved(e.thriving); UI.word(null, `+${e.gain} 📦`, 'gain', 1.4); const last = UI.uiState.words[UI.uiState.words.length - 1]; if (last) { last.x = e.x; last.z = e.z; last.hgt = 0.6; } }
                if (play && e.joins && !app.flags.firstJoin) { app.flags.firstJoin = true; UI.toast(`🙋 ${e.name.first} arrived thriving and joined the volunteers!`, '', 3200); }
                break;
            }
            case 'collapse':
                fx.burst('dust', e.x, e.z);
                if (play) {
                    sfx.collapse();
                    if (!app.flags.firstDown && !e.vol) { app.flags.firstDown = true; UI.toast(`Someone collapsed! ${w.open.includes('stretcher') ? 'A Medic Tent or Stretcher Crew' : 'A Medic Tent'} in reach can still get them up.`, 'hope', 3800); }
                }
                break;
            case 'lost':
                fx.burst('lantern', e.x, e.z);
                if (play) { sfx.lost(); UI.toast(`🏮 ${e.name.first} ${e.name.last}'s lantern rose. Hope −1`, 'hope', 3200); }
                break;
            case 'scratch': fx.burst('scratch', e.x, e.z); if (play) sfx.scratch(); break;
            case 'spit': if (play) sfx.spit(); break;
            case 'spitHit': fx.burst('splash', e.x, e.z, { r: 0.4, col: 0x9ad84a }); break;
            case 'howl': fx.ring(e.x, e.z, 2.5, 0xb48af2, 0.9); fx.burst('bolt', e.x, e.z); if (play) sfx.howl(); break;
            case 'freeze': fx.burst('bolt', ...posOf(e.id)); break;
            case 'flare': fx.ring(e.x, e.z, e.r, 0xfff2b0, 0.6); fx.burst('sparkle', e.x, e.z, { n: 16, y: 0.9, col: 0xfff2b0 }); if (play) sfx.flare(); break;
            case 'ring': { fx.ring(e.x, e.z, e.r, 0xf2c14e, 1.1); const v = app.stationViews.get(e.id); if (v) v.swing = 1; if (play) sfx.bell(); break; }
            case 'turnAway': fx.burst('dust', e.x, e.z, { col: 0x8a8a9a }); break;
            case 'fogTakes': break;
            case 'waveStart':
                if (play) {
                    sfx.waveStart(e.boss);
                    if (!e.boss) UI.toast(w.endless ? `Wave ${e.wave}` : `Wave ${e.wave} of ${w.waveCount}: they're coming down the road`, '', 2200);
                    if (w.level.hints && app.hintStep < 3) app.hintStep = 3;
                }
                break;
            case 'waveEnd': if (play) { sfx.waveEnd(); UI.toast(`Wave ${e.wave} home safe · +${e.bonus} 📦`, '', 2400); if (w.level.hints && e.wave === 1) app.hintStep = 5; } break;
            case 'early': if (play) UI.toast(`Early start · +${e.bonus} 📦`, '', 1600); break;
            case 'deploy': fx.burst('sparkle', e.x, e.z, { n: 8, col: 0xffd86a }); break;
            case 'recall': fx.burst('dust', e.x, e.z, { col: 0xffffff }); break;
            case 'volRest': fx.burst('dust', e.x, e.z, { col: 0xffffff }); if (play) UI.toast(`${TRADES[e.trade].icon} A ${TRADES[e.trade].name.toLowerCase()} needs rest. Back in 20s.`, '', 2200); break;
            case 'cured':
                fx.burst('cure', e.x, e.z, { y: 0.3 });
                if (play) sfx.cure();
                if (play && !app.flags.firstCure) { app.flags.firstCure = true; UI.toast('✨ Cured! They walk home as themselves again, and join the volunteers.', '', 3600); }
                break;
            case 'bossArrives': if (play) { sfx.boss(); stage.rig.shake = 0.8; UI.toast(`☠ ${BOSSES[e.kind].name} is coming`, 'boss', 3600); } break;
            case 'bossPhase': if (play) { stage.rig.shake = 1; stage.flash(0.35, 0xb48af2); UI.toast(e.phase === 1 ? 'It\'s weakening, and angry!' : 'Almost there! Don\'t let go!', 'boss', 2600); } break;
            case 'bossCured':
                stage.flash(1, 0xfff6d8);
                fx.burst('cure', e.x, e.z, { y: 0.8, s: 4 });
                fx.burst('confetti', e.x, e.z, { n: 60 });
                for (const z of w.dead) fx.burst('cure', z.x, z.z);
                if (play) { sfx.bossCured(); UI.toast(`✨ ${BOSSES[e.kind].name} is cured: ${e.who}`, 'big', 6000); }
                break;
            case 'slam': fx.ring(e.x, e.z, e.r, 0xb06af2, 0.6); fx.burst('dust', e.x, e.z); stage.rig.shake = Math.max(stage.rig.shake, 0.6); if (play) sfx.slam(); break;
            case 'wail': fx.ring(e.x, e.z, e.r, 0x9ff0ff, 1.2); fx.burst('flake', e.x, e.z, { y: 0.8 }); if (play) sfx.wail(); break;
            case 'glob': if (play) sfx.glob(); break;
            case 'globHit': fx.burst('splash', e.x, e.z, { r: 0.8, col: 0x9af27a }); fx.ring(e.x, e.z, e.r, 0x9af27a, 0.5); break;
            case 'spray': fx.burst('spray', e.x, e.z, { tx: e.tx, tz: e.tz }); if (play) sfx.spray(); break;
            case 'beam': fx.beam(e.x, e.z, e.tx, e.tz); if (play) sfx.beam(); break;
            case 'bloom': fx.burst('splash', e.x, e.z, { r: e.r, col: 0x8ad86a }); fx.ring(e.x, e.z, e.r, 0x8ad86a, 0.5); break;
            case 'breach': if (play) { stage.rig.shake = 0.5; UI.toast(e.boss ? 'It reached the Haven…' : `The dead reached the gate · Hope −${e.hope}`, 'hope', 2200); } break;
            case 'victory': case 'defeat': if (play) finishLevel(); break;
            default: break;
        }
    }
}
function posOf(id) {
    const p = app.world.people.find((q) => q.id === id);
    return p ? [p.x, p.z, { y: 0.5 }] : [-99, -99, {}];
}

// ------------------------------------------------------------------ stations in 3D
function syncStations(dt, t) {
    const w = app.world;
    const live = new Set();
    for (const s of w.stations) {
        live.add(s.id);
        let v = app.stationViews.get(s.id);
        if (!v || v.lv !== s.lv) {
            if (v) { dyn.remove(v.group); disposeGroup(v.group); }
            const m = stationModel(s.type, s.lv);
            v = { group: m.group, parts: m.parts, lv: s.lv, bounce: v ? 1 : 0.8, cool: s.cool, swing: 0, idleT: Math.random() };
            v.group.position.set(s.x, 0, s.z);
            dyn.add(v.group);
            app.stationViews.set(s.id, v);
        }
        if (s.cool > v.cool + 0.2 || (s.channel && !v.ch)) v.bounce = Math.max(v.bounce, 0.5);
        v.cool = s.cool;
        v.ch = !!s.channel;
        v.bounce = Math.max(0, v.bounce - dt * 3);
        const b = v.bounce;
        const k0 = STATION_SCALE;
        v.group.scale.set(k0 * (1 + b * 0.12), k0 * (1 - b * 0.1 + Math.sin(b * 12) * b * 0.08), k0 * (1 + b * 0.12));
        // face the person being helped
        if (s.aim) {
            const p = w.people.find((q) => q.id === s.aim);
            if (p && s.type !== 'lantern' && s.type !== 'bell') {
                const want = Math.atan2(p.x - s.x, p.z - s.z);
                let d = want - v.group.rotation.y;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                v.group.rotation.y += d * Math.min(1, dt * 3);
            }
        }
        v.swing = Math.max(0, v.swing - dt * 0.6);
        for (const pt of v.parts) {
            switch (pt.kind) {
                case 'halo': { const k = 1 + Math.sin(t * 2.2 + s.id) * 0.08; pt.mesh.scale.set(k, k, k); break; }
                case 'flame': { const k = 0.85 + Math.sin(t * 13 + (pt.phase || 0)) * 0.15 + Math.sin(t * 7.3 + s.id) * 0.08; pt.mesh.scale.set(1, k, 1); break; }
                case 'bubble': { const k = 0.9 + Math.sin(t * 4 + s.id) * 0.12; pt.mesh.scale.set(k, k, k); break; }
                case 'sway': pt.mesh.rotation.z = Math.sin(t * 3 + s.id) * 0.1; pt.mesh.position.y = 0.12 + Math.abs(Math.sin(t * 3)) * 0.015; break;
                case 'bell': pt.mesh.rotation.z = Math.sin(t * 9) * 0.5 * v.swing; break;
                default: break;
            }
        }
        // idle life
        v.idleT -= dt;
        if (v.idleT <= 0) {
            v.idleT = 0.25 + Math.random() * 0.2;
            if (s.type === 'kitchen') fx.burst('steam', s.x, s.z - 0.05, { y: 0.3 });
            else if (s.type === 'fire') { fx.burst('ember', s.x, s.z, { y: 0.25 }); if (Math.random() < 0.3) fx.burst('steam', s.x, s.z, { y: 0.5 }); }
            else if (s.type === 'song' && s.busy) fx.burst('notes', s.x, s.z, { n: 1, y: 0.4 });
            else if (s.type === 'remedy' && Math.random() < 0.4) fx.emit({ x: s.x - 0.16, y: 0.5, z: s.z - 0.08, vy: 0.2, life: 0.8, size: 0.04, col: 0x8af27a, cell: 11 });
        }
    }
    for (const [id, v] of app.stationViews) if (!live.has(id)) { dyn.remove(v.group); disposeGroup(v.group); app.stationViews.delete(id); }
}

function updateGhost() {
    const w = app.world;
    if (app.mode !== 'play' || !app.tool || !app.hover) { if (app.ghost) app.ghost.visible = false; if (app.tool && !app.hover) fx.hideRange(); return; }
    const t = tileAt(app.hover.x, app.hover.y);
    if (!t || t.x < 0 || t.z < 0 || t.x >= W || t.z >= H) { if (app.ghost) app.ghost.visible = false; fx.hideRange(); return; }
    let ok, range;
    if (app.tool.station) { ok = !w.canBuild(app.tool.station, t.x, t.z); range = STATIONS[app.tool.station].lv[0].range; }
    else { ok = !w.canDeploy(app.tool.vol, t.x, t.z); range = TRADES[app.tool.vol].range; }
    if (app.ghost) {
        app.ghost.visible = buildable(w.map, t.x, t.z);
        app.ghost.position.set(t.x + 0.5, 0, t.z + 0.5);
        app.ghost.scale.setScalar(STATION_SCALE);
        app.ghost.traverse((o) => { if (o.isMesh) o.material.color.setHex(ok ? 0x8ff0a0 : 0xff7a6a); });
    }
    fx.showRange(t.x + 0.5, t.z + 0.5, range, app.tool.station ? STATIONS[app.tool.station].color : TRADES[app.tool.vol].color, ok);
}

function updateSelectionRing() {
    if (!app.sel || app.tool) return;
    const w = app.world;
    if (app.sel.kind === 'station') {
        const s = w.stations.find((q) => q.id === app.sel.id);
        if (s) fx.showRange(s.x, s.z, STATIONS[s.type].lv[s.lv].range, STATIONS[s.type].color);
    } else if (app.sel.kind === 'person') {
        const p = w.people.find((q) => q.id === app.sel.id);
        if (p && p.role === 'vol') fx.showRange(p.x, p.z, TRADES[p.trade].range, TRADES[p.trade].color);
        else if (p) fx.showRange(p.x, p.z, 0.32, 0xffffff);
    } else {
        const z = w.dead.find((q) => q.id === app.sel.id);
        if (z) fx.showRange(z.x, z.z, z.boss ? 1.1 : 0.32, 0xb48af2);
    }
}

// ------------------------------------------------------------------ tutorial hints
function hints(dt) {
    const w = app.world;
    if (app.mode !== 'play' || UI.modalOpen()) { UI.hint(null); return; }
    const L = w.level;
    app.hintT += dt;
    let text = null;
    if (L.hints) {
        const hasMedic = w.stations.some((s) => s.type === 'medic'), hasLantern = w.stations.some((s) => s.type === 'lantern');
        if (app.hintStep <= 1 && !hasMedic) text = app.tool ? 'Now tap a <b>grass tile beside the road</b>. The ring shows how far it reaches.' : 'People are coming down the road, hurt. Pick the <b>⛑️ Medic Tent</b> below.';
        else if (app.hintStep <= 2 && !hasLantern && w.wave === 0) { app.hintStep = 2; text = 'Good! A <b>🏮 Lantern</b> near the road slows the dead who follow them.'; }
        else if (app.hintStep <= 2 && w.wave === 0) text = 'When you\'re ready, press <b>▶ Open the gate</b>.';
        else if (app.hintStep === 3) { text = 'Tap anyone to see how they\'re doing. The bar is their health; the icons show what hurts.'; if (app.hintT > 9) { app.hintStep = 4; } }
        else if (app.hintStep === 5) { text = 'Tap a station to <b>upgrade</b> it. People who arrive <b>thriving</b> bring more supplies and become volunteers.'; if (app.hintT > 30 || w.wave >= 2) app.hintStep = 6; }
        if (app.hintStep === 3 && app.hintT > 9) app.hintStep = 4;
        if (app.hintStep !== app.lastHintStep) { app.hintT = 0; app.lastHintStep = app.hintStep; }
    } else if (L.boss && w.wave === 0 && !app.flags.bossHintDone) {
        text = UI.uiState.tab === 'vols' ? (w.activeVols() ? 'Place a few more, then <b>▶ Open the gate</b>. Your stations heal volunteers too.' : 'Pick a trade, then tap the grass <b>right beside the road</b>. The dead stop to fight volunteers in reach.') : 'This time, fight back with the cure. Open <b>🙋 Volunteers</b> below and place them beside the road.';
    } else if (L.boss && w.wave > 0) app.flags.bossHintDone = true;
    UI.hint(text);
}

// ------------------------------------------------------------------ the frame
function frame() {
    requestAnimationFrame(frame);
    if (resizePending) {
        resizePending = false;
        stage.resize();
        const { w: vw, h: vh } = stage.viewSize();
        actors.setRes(vw, vh, isPhone);
        fx.setView(stage.renderer.getDrawingBufferSize(new THREE.Vector2()).y, stage.camera.fov);
        app.insetsKey = '';
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    app.t += dt;
    timeU.value = app.t;
    const w = app.world;
    if (w) {
        const running = app.mode === 'play' ? !app.paused && !UI.modalOpen() : (app.demo && app.mode !== 'brief');
        if (running) {
            app.acc += dt * (app.mode === 'play' ? app.speed : 1) * FAST;
            let n = 0;
            while (app.acc >= STEP && n < 40) {
                if (app.bot) app.bot.step(STEP); else w.tick(STEP);
                app.acc -= STEP; n++;
            }
            if (n >= 40) app.acc = 0;
            // the demo starts over when it ends
            if (app.demo && (w.state === 'won' || w.state === 'lost' || w.time > 600)) loadLevel(demoLevel(), { demo: true });
        }
        handleEvents();
        syncStations(dt, app.t);
        actors.update(app.world, dt, app.t);
        app.moanT -= dt;
        if (app.moanT <= 0) { app.moanT = 3 + Math.random() * 4; if (app.mode === 'play' && w.dead.length && !app.paused) sfx.moan(); }
        // the blight drifts off the dead in boss levels; the beacon brightens as people arrive
        if (w.boss && Math.random() < 0.3) { const z = w.dead[Math.floor(Math.random() * w.dead.length)]; if (z) fx.burst('blight', z.x, z.z, { y: z.boss ? 1 : 0.3 }); }
        if (terrain.beacon) {
            const saved = w.stats.saved + w.stats.restored;
            stage.setBeacon(terrain.beacon.x - W / 2, terrain.beacon.z - H / 2, 0.6 + Math.min(3, saved * 0.06) + Math.sin(app.t * 2) * 0.1);
            if (terrain.campfire && Math.random() < 0.15) fx.burst('ember', terrain.campfire.x, terrain.campfire.z, { y: 0.1 });
        }
    }
    fx.update(dt, app.world);
    weather.update(dt, app.t);
    terrain.update(dt);
    if (stage.getFlash() > 0) stage.flash(Math.max(0, stage.getFlash() - dt * 1.4));
    if (app.mode === 'play' && w) {
        updateGhost();
        updateSelectionRing();
        UI.updateHUD(w, { speed: app.speed, paused: app.paused, muted: app.settings.muted });
        UI.renderCard(w);
        hints(dt);
        const ins = UI.hudInsets();
        const key = `${Math.round(ins.top)}-${Math.round(ins.bottom)}`;
        if (key !== app.insetsKey) { app.insetsKey = key; stage.setInsets(ins.top, ins.bottom); }
    } else {
        const key = 'menu';
        if (app.insetsKey !== key) { app.insetsKey = key; stage.setInsets(40, 20); }
    }
    UI.updateWords(dt, screenOf);
    stage.updateCamera(dt, app.t);
    stage.render();
    app.frameNo++;
}

// ------------------------------------------------------------------ go
toTitle();
if (params.has('level')) { const n = Number(params.get('level')); if (levelDef(n)) { app.progress.unlocked = Math.max(app.progress.unlocked, Math.min(12, n)); openBrief(n); } }
requestAnimationFrame(frame);

if (DEBUG) {
    window.__hr = {
        app, act, stage, terrain, actors, fx, UI, VERSION, THEMES, DEAD,
        get world() { return app.world; },
        step(n = 1) { for (let i = 0; i < n; i++) app.world.tick(STEP); },
        /** Screen position of the centre of tile (x, z). */
        tileScreen(x, z) { return stage.toScreen(x + 0.5, 0, z + 0.5); },
        frame: () => app.frameNo,
        save: Save,
    };
}
