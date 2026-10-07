/**
 * main.js — Dirt Crown entry point.
 *
 * The simulation (js/sim) owns tracks, cars, AI, races and the career, and knows nothing of the
 * screen. This file runs a race on a fixed 120 Hz step, turns input into controls, feeds the 3D view
 * (js/view) and the DOM UI (js/ui), plays sounds for the simulation's events, saves the career and
 * moves between the title, the garage hub, story scenes, races and results.
 *
 * Modes: loading → title → hub ⇄ race → results → (story) → hub. Story scenes play over whichever
 * scene is behind them (the garage or the track).
 *
 * URL: ?debug=1 exposes window.__dc; ?fast=N runs the simulation N× per frame; ?q=0|1|2 forces a
 * quality tier; ?event=ID starts straight in an event (with ?debug=1).
 *
 * Library: three.js r165 via the import map in index.html.
 */

import * as THREE from 'three';
import { initStage, applyLook, followSun, render, renderer, scene, camera, updateChase, resetChase, addShake, orbitCam, chase, setQuality, setGrade, resize } from './view/stage.js';
import { World } from './view/world.js';
import { CarModel } from './view/carmodel.js';
import { FX } from './view/fx.js';
import { Garage } from './view/garage.js';
import { ENV_LOOK } from './view/envs.js';
import { Track } from './sim/track.js';
import { TRACKS, trackDef } from './sim/tracks.js';
import { Race } from './sim/race.js';
import { Driver } from './sim/ai.js';
import { SURF } from './sim/surfaces.js';
import { CIRCUITS, EVENTS, newProfile, buildField, recordResult, buyUpgrade, playerRating, cleared, nextEvent, DRIVERS, LOCALS } from './sim/career.js';
import { specFromLevels, levelsForRating, paintById, PAINTS, LIVERIES } from './sim/parts.js';
import { TRIGGERS, REX_LINES } from './sim/story.js';
import { DT, COUNTDOWN } from './config.js';
import { Rng, hashStr } from './rng.js';
import { Input } from './input.js';
import * as save from './save.js';
import { initAudio, sfx, setVolumes, startRaceAudio, stopRaceAudio, raceAudio, playMusic, duckMusic } from './audio.js';
import { Hud, ordinal, fmtTime } from './ui/hud.js';
import * as UI from './ui/screens.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Number(params.get('fast')) || 1);
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ boot
const settings = save.loadSettings();
const coarse = matchMedia('(pointer: coarse)').matches;
const qualityOf = () => (settings.quality === 'auto' ? (coarse ? 1 : 0) : Number(settings.quality));
let quality = params.has('q') ? Number(params.get('q')) : qualityOf();
const canvas = $('gl');
initStage(canvas, quality);
const input = new Input();
const hud = new Hud();
let garage = null;

const app = {
    mode: 'loading', profile: save.loadProfile(), settings,
    race: null, world: null, track: null, models: [], colors: [], fx: null, ev: null, field: null,
    acc: 0, t: 0, frameNo: 0, paused: false, doneT: 0, introT: 0, envId: 'flats',
    storyBg: null, title: null, resetCD: 0, rexDone: false, finishShown: false,
};
window.__dcApp = app;

// ------------------------------------------------------------------ settings
app.applySettings = () => {
    setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
    chase.mode = settings.camera | 0;
    input.autoGas = !!settings.autoGas;
    document.body.classList.toggle('autogas', !!settings.autoGas);
    const q = params.has('q') ? Number(params.get('q')) : qualityOf();
    if (q !== quality) { quality = q; setQuality(q); if (app.fx) app.fx.setView(renderer, camera); }
    save.saveSettings(settings);
};
app.applySettings();

const persist = () => { if (app.profile && !app.profile.guest) save.saveProfile(app.profile); };

// ------------------------------------------------------------------ looks
function playerLook(p, over = null) {
    const o = over || p;
    return { kind: 'buggy', levels: { ...p.levels }, paint: o.paint, livery: o.livery, trim: o.trim, num: p.num };
}
app.previewLook = (over) => { if (garage && app.profile) garage.setCar(playerLook(app.profile, over)); };
app.buyUpgrade = (cat) => {
    const ok = buyUpgrade(app.profile, cat);
    if (ok) { persist(); garage.setCar(playerLook(app.profile)); }
    return ok;
};
app.buyLook = (cur, cost) => {
    const p = app.profile;
    p.coins -= cost;
    if (!p.owned.paint.includes(cur.paint)) p.owned.paint.push(cur.paint);
    if (!p.owned.livery.includes(cur.livery)) p.owned.livery.push(cur.livery);
    p.paint = cur.paint; p.livery = cur.livery; p.trim = cur.trim;
    persist();
    garage.setCar(playerLook(p));
};
app.setNumber = (n) => { app.profile.num = n; persist(); garage.setCar(playerLook(app.profile)); };

// ------------------------------------------------------------------ fades
function fadeTo(fn) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => {
        try { fn(); } catch (e) { console.error(e); }
        requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    }, 360);
}

// ------------------------------------------------------------------ the race scene
function disposeRace() {
    if (app.world) { app.world.dispose(); app.world = null; }
    for (const m of app.models) { scene.remove(m.root); m.dispose(); }
    app.models = [];
    if (app.fx) { app.fx.dispose(); app.fx = null; }
    if (app.headlight) { app.headlight.parent?.remove(app.headlight); app.headlight = null; }
    app.race = null;
}

/** Build the world and cars for an event. field[0] is the player (or a bot on the title screen). */
function buildRace(ev, field, { bots = false } = {}) {
    disposeRace();
    const def = trackDef(ev.track, !!ev.reverse);
    const track = new Track(def);
    const envId = TRACKS[ev.track].env;
    const look = ENV_LOOK[envId];
    app.envId = envId;
    app.track = track;
    applyLook(look, track.bounds);
    app.world = new World(scene, track, envId, quality);
    app.fx = new FX(scene, quality);
    app.fx.setView(renderer, camera);
    app.fx.setWeather(look.motes);
    app.fx.setSkidColor(look.rut);
    const targets = ev.type === 'tt' ? ttTargets(track, ev) : null;
    ev.targets = targets;
    const seed = hashStr(ev.id + (app.profile?.stats?.races || 0));
    const entrants = field.map((e, k) => (bots && k === 0 ? { ...e, ai: { skill: 0.85, lane: 0 } } : e));
    app.race = new Race({ track, type: ev.type, laps: ev.laps, entrants, targets, rubber: !ev.boss && ev.type !== 'duel' && ev.type !== 'tt', seed });
    app.field = field;
    app.colors = field.map((e) => e.look.paintHex ?? paintById(e.look.paint).hex);
    app.models = field.map((e, k) => {
        const m = new CarModel(e.look, { noShadow: quality >= 2 || (k > 0 && quality >= 1) });
        scene.add(m.root);
        return m;
    });
    if (ev.type === 'tt') app.models.forEach((m, k) => { if (k) m.root.visible = false; });
    // Headlights after dark.
    if ((look.night || 0) > 0.4 && quality < 2 && !bots) {
        const sl = new THREE.SpotLight(0xfff2d8, 60, 70, 0.55, 0.5, 1.5);
        sl.position.set(0, 1.2, 1.2);
        sl.target.position.set(0, 0, 20);
        app.models[0].root.add(sl, sl.target);
        app.headlight = sl;
    }
    app.models.forEach((m, k) => m.update(app.race.cars[k], track, 0.016, 0));
    app.world.setLights(0);
    app.acc = 0; app.doneT = 0; app.introT = 0; app.rexDone = false; app.finishShown = false; app.resetCD = 0;
    app.lastSurf = app.race.cars.map(() => '');
    resetChase();
    return track;
}

/** Medal times for a time trial: a quick bot with the field's car sets gold; silver +5%, bronze +10%. */
function ttTargets(track, ev) {
    const spec = specFromLevels(levelsForRating(ev.rating, ['engine', 'tires']));
    const r = new Race({ track, type: 'race', laps: ev.laps, entrants: [{ name: 'bot', spec, ai: { skill: 0.9, lane: 0 } }], seed: 5 });
    while (!r.cars[0].finished && r.t < 600) r.step(DT);
    const T = r.cars[0].finishT;
    return [T * 1.02, T * 1.07, T * 1.13].map((x) => Math.round(x * 100) / 100);
}

// ------------------------------------------------------------------ title (attract mode)
function titleField() {
    const rng = new Rng(77);
    const kinds = ['buggy', 'pickup', 'rally', 'dune', 'trophy', 'raven'];
    const paints = [0xd9b23a, 0x2f6be0, 0xd8322a, 0x3bbd5b, 0x8e2bd9, 0x15161a];
    return kinds.map((kind, k) => {
        const lv = levelsForRating(300 + k * 110);
        return { name: 'Bot ' + k, spec: specFromLevels(lv), look: { kind, levels: lv, paintHex: paints[k], trimHex: 0xf4f1e8, livery: ['stripes', 'number', 'flames', 'bolt', 'checker', 'checker'][k], num: 3 + k * 11 }, ai: { skill: 0.75 + rng.next() * 0.2, lane: rng.range(-0.6, 0.6) } };
    });
}
function enterTitle() {
    app.mode = 'title';
    stopRaceAudio();
    hud.show(false);
    UI.showHub(false);
    UI.show('results', false);
    UI.show('title', true);
    UI.refreshTitle();
    camera.clearViewOffset();
    if (!app.title || app.race?.type !== 'attract') {
        const ev = { id: 'attract', track: 'barnyard', type: 'race', laps: 99 };
        buildRace(ev, titleField(), { bots: true });
        app.race.type = 'attract';
        app.race.phase = 'race';
        app.title = { cam: 0, t: 0, focus: 0 };
    }
    playMusic('title');
}
app.toTitle = () => fadeTo(enterTitle);

// ------------------------------------------------------------------ hub
function enterHub(tabName = 'races') {
    app.mode = 'hub';
    stopRaceAudio();
    hud.show(false);
    UI.show('title', false);
    UI.show('results', false);
    if (!garage) garage = new Garage(renderer);
    garage.setCar(playerLook(app.profile));
    garage.setCrown(app.profile.done);
    UI.showHub(true, tabName);
    playMusic('garage');
}
app.toHub = (tab) => fadeTo(() => enterHub(tab));

app.newCareer = (name, num) => {
    initAudio();
    app.profile = newProfile(name);
    app.profile.num = num;
    persist();
    fadeTo(() => {
        enterHub('races');
        UI.showHub(false);
        app.storyBg = 'garage';
        playScene('prologue', () => {
            UI.showHub(true, 'races');
            UI.toast('🔧 Tip: win races for coins, then spend them in the <b>Garage</b> tab. Every upgrade shows on the car.', 6000);
        });
    });
};
app.continueCareer = () => { initAudio(); app.toHub('races'); };
app.eraseCareer = () => { save.clearProfile(); app.profile = null; enterTitle(); };
app.replayScene = (id) => {
    UI.showHub(false);
    app.storyBg = 'garage';
    playScene(id, () => UI.showHub(true, 'career'), true);
};

function playScene(id, done, replay = false) {
    if (app.profile && !replay) { app.profile.seen[id] = true; persist(); }
    duckMusic(true);
    UI.playScene(id, () => { duckMusic(false); done?.(); });
}

// ------------------------------------------------------------------ races
app.startEvent = (ev) => {
    initAudio();
    fadeTo(() => {
        UI.showHub(false);
        UI.show('title', false);
        UI.show('results', false);
        camera.clearViewOffset();
        app.ev = ev;
        const field = buildField(ev, app.profile);
        buildRace(ev, field);
        app.mode = 'race';
        app.paused = false;
        hud.setup(app.race, app.colors, ev);
        hud.show(true);
        startRaceAudio();
        playMusic(app.envId);
        const sc = TRIGGERS.before[ev.id];
        if (sc && !app.profile.seen[sc]) {
            app.storyBg = 'world';
            app.holdCountdown = true;
            hud.show(false);
            playScene(sc, () => { app.holdCountdown = false; if (app.mode === 'race') hud.show(true); });
        } else app.holdCountdown = false;
    });
};

app.freeRace = (trackId, laps, reverse) => {
    initAudio();
    if (!app.profile) { app.profile = newProfile('Guest'); app.profile.guest = true; }
    const env = TRACKS[trackId].env;
    const ci = Math.max(0, CIRCUITS.findIndex((c) => c.env === env));
    const ev = { id: 'free', name: `Free Race: ${TRACKS[trackId].name}`, track: trackId, reverse, type: 'race', laps, rating: playerRating(app.profile), pay: 0, ci, env, free: true };
    app.startEvent(ev);
};

function finishRace() {
    const r = app.race, ev = app.ev;
    const res = r.results || r.makeResults();
    stopRaceAudio();
    hud.show(false);
    let pay = null;
    const p = app.profile;
    const prevCleared = ev.free ? true : cleared(ev, p.results[ev.id]);
    if (!ev.free) {
        pay = recordResult(p, ev, res);
        persist();
    }
    app.mode = 'results';
    playMusic(res.pos === 1 || res.medal ? 'victory' : 'garage');
    const nowCleared = !ev.free && cleared(ev, p.results[ev.id]) && cleared(ev, res);
    UI.showResults(res, ev, pay, app.colors, () => {
        // Continue: the story after a first clear, then the hub.
        UI.show('results', false);
        const after = TRIGGERS.after[ev.id], lose = TRIGGERS.lose[ev.id];
        if (!ev.free && nowCleared && !prevCleared && after && !p.seen[after]) {
            const sc = after;
            app.storyBg = sceneBg(sc);
            if (app.storyBg === 'garage') { enterHub('races'); UI.showHub(false); }
            playScene(sc, () => {
                if (ev.final) { enterHub('career'); UI.toast('👑 The Dirt Crown is on the trophy shelf. Every track is open for free races.', 7000); UI.credits(); }
                else afterClear(ev);
            });
        } else if (!ev.free && !cleared(ev, res) && lose && !p.seen[lose]) {
            app.storyBg = 'garage';
            enterHub('garage');
            UI.showHub(false);
            playScene(lose, () => UI.showHub(true, 'garage'));
        } else if (ev.free) app.toTitleOrHub();
        else afterClear(ev, true);
    }, () => { UI.show('results', false); app.startEvent(ev); }, () => { UI.show('results', false); app.toHub('garage'); });
}
function sceneBg(id) { return ['post-sal', 'lose-final', 'prologue'].includes(id) ? 'garage' : 'world'; }
function afterClear(ev, plain) {
    const p = app.profile;
    const nx = nextEvent(p);
    app.toHub('races');
    if (!plain && nx && nx.ci !== ev.ci) setTimeout(() => UI.toast(`🗺️ <b>${CIRCUITS[nx.ci].name}</b> is open! ${CIRCUITS[nx.ci].icon}`, 5000), 600);
}
app.toTitleOrHub = () => { if (app.profile && !app.profile.guest) app.toHub('races'); else { app.profile = save.loadProfile(); app.toTitle(); } };

function pause() {
    if (app.mode !== 'race' || app.paused || UI.storyActive()) return;
    app.paused = true;
    sfx.click();
    UI.pauseMenu(() => { app.paused = false; }, () => { app.paused = false; app.startEvent(app.ev); }, () => { app.paused = false; stopRaceAudio(); hud.show(false); if (app.ev.free) app.toTitleOrHub(); else app.toHub('races'); }, app.ev.free);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('h-pause').addEventListener('click', (e) => { e.stopPropagation(); pause(); });

// ------------------------------------------------------------------ input presses
input.on((a) => {
    if (a === 'touchmode') { app.applySettings(); return; }
    if (UI.storyActive()) { if (a === 'confirm') UI.storyAdvance(); return; }
    if (a === 'mute') { settings.muted = !settings.muted; app.applySettings(); UI.toast(settings.muted ? '🔇 Muted' : '🔊 Sound on', 1200); return; }
    if (UI.modalOpen()) { if (a === 'pause' || a === 'back') { if (app.mode === 'race' && app.paused) { UI.closeModal(); app.paused = false; } else UI.closeModal(); } return; }
    if (app.mode === 'race') {
        if (a === 'pause') pause();
        if (a === 'camera') { chase.mode = (chase.mode + 1) % 3; settings.camera = chase.mode; save.saveSettings(settings); }
        if (a === 'reset' && app.race && app.race.phase === 'race' && !app.race.player.finished && app.resetCD <= 0) { app.race.player.reset(app.track); app.resetCD = 1.5; }
    } else if (app.mode === 'title') {
        if (a === 'confirm') (app.profile ? app.continueCareer() : $('t-new').click());
    } else if (app.mode === 'results') {
        if (a === 'confirm') $('r-cont')?.click();
    } else if (app.mode === 'hub') {
        if (a === 'pause') UI.hubMenu();
    }
});
addEventListener('keydown', (e) => { if (UI.storyActive() && (e.code === 'Space')) { e.preventDefault(); UI.storyAdvance(); } });
// Any first gesture starts the audio.
const unlock = () => { initAudio(); if (app.mode === 'title') playMusic('title'); };
addEventListener('pointerdown', unlock, { once: true });
addEventListener('keydown', unlock, { once: true });

UI.bindApp(app);
UI.initTitle();
UI.initStory();
UI.initHub();

// ------------------------------------------------------------------ per-frame race view
const tmpV = new THREE.Vector3();
function handleEvents(r) {
    const P = r.player, w = app.world, fx = app.fx;
    for (const e of r.events) {
        switch (e.type) {
            case 'beep': sfx.beep(); hud.countdown(e.n); break;
            case 'go': sfx.go(); hud.go(); w.setLights('go'); setTimeout(() => app.world === w && w.setLights('off'), 2500); break;
            case 'launch': sfx.launch(e.good); hud.msg(e.good ? 'PERFECT START!' : 'TOO EARLY!', e.good ? 'green' : 'red'); break;
            case 'lap':
                if (e.car === 0) {
                    if (r.type === 'elim') { hud.msg(`LAP ${e.lap}  ·  ${fmtTime(e.time)}`, ''); sfx.lap(); }
                    else if (e.last) { hud.msg('FINAL LAP!', 'gold'); sfx.finalLap(); }
                    else { hud.msg(`LAP ${e.lap + 1}  ·  ${fmtTime(e.time)}`, ''); sfx.lap(); }
                }
                break;
            case 'finish':
                if (e.car === 0) {
                    const pos = r.type === 'tt' ? 0 : e.pos;
                    const res = r.results || r.makeResults();
                    if (r.type === 'tt') hud.big(res.medal ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[res.medal] : 'FINISH', fmtTime(res.time));
                    else hud.big(`${pos}${ordinal(pos)}`, 'FINISH');
                    const good = r.type === 'tt' ? !!res.medal : pos <= 3;
                    if ((r.type === 'tt' && res.medal === 'gold') || pos === 1) { sfx.win(); fx.confetti(P.x, P.y + 2, P.z, 120); w.uCheer.value = 1; }
                    else if (good) sfx.podium(); else sfx.lose();
                }
                break;
            case 'elim': {
                const c = r.cars[e.car];
                hud.msg(e.car === 0 ? 'YOU ARE OUT!' : `${c.name} is out!`, 'red');
                sfx.elim();
                if (e.car === 0) hud.big('OUT!', `${e.left + 1}${ordinal(e.left + 1)} place`);
                break;
            }
            case 'coin': w.takeCoin(e.idx); sfx.coin(); fx.sparkle(e.x, e.y, e.z); break;
            case 'wall':
                if (e.car === 0) { sfx.wall(e.v); if (settings.shake) addShake(Math.min(0.6, e.v * 0.05)); }
                fx.sparks(e.x, e.y, e.z, Math.min(20, 4 + e.v * 2));
                break;
            case 'bump':
                if (e.car === 0 || e.other === 0) { sfx.bump(e.v); if (settings.shake) addShake(Math.min(0.5, e.v * 0.05)); }
                fx.burst(e.x, e.y - 0.4, e.z, ENV_LOOK[app.envId].dust, 6, 3, 0.6, 0.6);
                break;
            case 'land': {
                const c = r.cars[e.car];
                fx.burst(e.x, e.y, e.z, surfDust(c.surface), Math.min(24, 6 + e.impact * 1.4), 3 + e.impact * 0.3, 1, 1);
                if (['water', 'mud', 'bog'].includes(c.surface)) fx.splash(e.x, e.y, e.z, surfDust(c.surface), c.vx, c.vz);
                if (e.car === 0) {
                    sfx.land(e.impact);
                    if (settings.shake) addShake(Math.min(0.7, e.impact * 0.035));
                    if (e.clean && e.airT > 0.55) hud.msg(e.airT > 1.1 ? 'HUGE AIR!  +N₂O' : 'BIG AIR!  +N₂O', 'blue');
                    if (app.profile) { app.profile.stats.jumps = (app.profile.stats.jumps || 0) + 1; app.profile.stats.airtime = (app.profile.stats.airtime || 0) + e.airT; }
                }
                break;
            }
            case 'reset': if (e.car === 0) { sfx.reset(); hud.msg('BACK ON TRACK', ''); } break;
            case 'draft': hud.msg('SLIPSTREAM', 'blue'); break;
            default: break;
        }
    }
}
const gY = (x, z) => (app.world ? app.world.groundY(x, z) : -Infinity);
const surfDust = (s) => ({ oil: 0x1a1a20, dirt: ENV_LOOK[app.envId].dust, mud: 0x4a3420, water: 0xdfeef0, snow: 0xffffff, pack: 0xf4f8ff, ice: 0xe8f6ff, sand: 0xe8cc96, gravel: 0xb8b0a0, grass: 0x8a9a5a, bog: 0x4a4a2a }[s] ?? ENV_LOOK[app.envId].dust);

function carVisuals(dt, t) {
    const r = app.race, tr = app.track, fx = app.fx;
    const look = ENV_LOOK[app.envId];
    for (let k = 0; k < r.cars.length; k++) {
        const c = r.cars[k], m = app.models[k];
        if (r.type === 'tt' && k) continue;
        // Knocked-out cars fade away after a moment.
        if (c.out) { m.root.visible = r.t - (c.outT || 0) < 2.5; if (!m.root.visible) continue; }
        m.update(c, tr, dt, t);
        m.root.updateMatrixWorld(true);
        const fast = c.speed > 3 && !c.air;
        const S = SURF[c.surface] || SURF.dirt;
        // Splash on entering water or mud at speed.
        if (c.surface !== app.lastSurf[k]) {
            if ((c.surface === 'water' || c.surface === 'mud') && c.speed > 8) {
                fx.splash(c.x, c.y, c.z, surfDust(c.surface), c.vx, c.vz);
                if (k === 0) sfx.splash();
            }
            app.lastSurf[k] = c.surface;
        }
        for (const side of [-1, 1]) {
            m.rearWheelWorld(tmpV, side);
            const wx = tmpV.x, wy = c.y, wz = tmpV.z;
            if (fast) {
                const amt = Math.min(1, c.speed / 30) * (0.5 + Math.min(1, c.slip * 3)) * (S.loose > 0.5 ? 1.2 : 1);
                const rate = (8 + c.speed * 1.4) * (quality >= 2 ? 0.4 : quality === 1 ? 0.7 : 1) * (k === 0 ? 1 : 0.6);
                let n = rate * dt * amt;
                while (n > 0) { if (Math.random() < n) fx.wheel(wx, wy, wz, c.vx, c.vz, c.surface, amt, look.dust); n -= 1; }
            }
            const marking = !c.air && c.speed > 5 && (c.slip > 0.16 || c.drifting || (c.brake > 0.5 && c.speed > 10));
            fx.skid(`${k}${side}`, wx, wy, wz, c.h, marking && c.surface !== 'water', Math.min(1, c.slip * 2 + 0.2));
        }
        if (c.boosting || c.launch > 0) {
            for (const tip of m.exhaustTips) {
                tmpV.copy(tip).applyMatrix4(m.body.matrixWorld);
                fx.nitro(tmpV.x, tmpV.y, tmpV.z, -Math.sin(c.h) * 8, -Math.cos(c.h) * 8);
            }
        }
    }
}

function nearestRival(r) {
    const P = r.player;
    let best = Infinity, sp = 0;
    for (let k = 1; k < r.cars.length; k++) {
        const c = r.cars[k];
        if (c.out) continue;
        const d = Math.hypot(c.x - P.x, c.z - P.z);
        if (d < best) { best = d; sp = c.speed / c.spec.top; }
    }
    return { d: best, sp };
}

function updateRace(dt, t) {
    const r = app.race;
    if (!r) return;
    const blocked = app.paused || UI.modalOpen() || UI.storyActive() || app.holdCountdown;
    const ctl = input.poll(dt);
    if (!blocked) {
        app.acc += dt * FAST;
        let steps = 0;
        while (app.acc >= DT && steps < 12 * FAST) {
            r.step(DT, ctl);
            handleEvents(r);
            app.acc -= DT;
            steps++;
        }
        if (app.resetCD > 0) app.resetCD -= dt;
    }
    // Countdown lamps.
    if (r.phase === 'countdown') app.world.setLights(Math.max(0, Math.min(5, Math.floor(((COUNTDOWN - r.cd) / COUNTDOWN) * 6))));
    // Rex on the PA, once, just after the start.
    if (r.phase === 'race' && !app.rexDone && r.t > 1.4) {
        app.rexDone = true;
        const lines = REX_LINES[app.envId] || REX_LINES.flats;
        hud.rex(lines[(hashStr(app.ev.id) + (app.profile?.stats?.races || 0)) % lines.length]);
    }
    carVisuals(dt, t);
    const P = r.player;
    // Camera: a swoop round the grid during the countdown, the chase cam while racing, a slow
    // orbit after the finish.
    if (r.phase === 'countdown' || app.holdCountdown) {
        app.introT += dt;
        const k = Math.min(1, app.introT / (COUNTDOWN + (app.holdCountdown ? 99 : 0.4)));
        const ease = k * k * (3 - 2 * k);
        if (app.holdCountdown || ease < 0.85) {
            const yaw = P.h + Math.PI * (1 - ease) * 1.1 + (app.holdCountdown ? t * 0.08 : 0);
            orbitCam(P.x, P.y, P.z, 7 + (1 - ease) * 6, 2.2 + (1 - ease) * 3, yaw + Math.PI, 0.8, 55, gY);
            chase.init = false;
        } else updateChase(P, dt, (x, z) => app.world.groundY(x, z));
    } else if (P.finished || (r.type === 'elim' && P.out)) {
        app.doneT += dt;
        if (app.doneT < 1.2) updateChase(P, dt, (x, z) => app.world.groundY(x, z));
        else orbitCam(P.x, P.y, P.z, 8.5, 2.6, t * 0.35, 0.8, 50, gY);
        if (app.envId === 'dome' || app.ev.final) { if (Math.random() < dt * 1.4 && r.results && r.results.pos === 1) { const a = Math.random() * 6.28; app.fx.firework(P.x + Math.cos(a) * 60, P.y + 30 + Math.random() * 20, P.z + Math.sin(a) * 60); sfx.firework(); } }
        if (app.doneT > (r.type === 'elim' && P.out && !P.finished ? 2.2 : 3.4) && !app.finishShown) { app.finishShown = true; finishRace(); }
    } else updateChase(P, dt, (x, z) => app.world.groundY(x, z));
    setGrade({ blur: P.boosting || P.launch > 0 ? Math.min(1, P.speed / 30) : 0 });
    // Audio.
    const nr = nearestRival(r);
    const S = SURF[P.surface] || SURF.dirt;
    raceAudio(dt, {
        speedFrac: Math.min(1, Math.max(0, P.vLong) / (P.spec.top * 1.1)), speed: P.speed, throttle: r.phase === 'countdown' ? (input.ctl.throttle) : P.throttle,
        boost: P.boosting || P.launch > 0, slip: P.drifting ? Math.max(P.slip, 0.3) : P.slip, air: P.air, wet: ['water', 'mud', 'bog'].includes(P.surface), ice: P.surface === 'ice',
        rough: S.rough, packSpeed: nr.sp, packDist: nr.d, paused: blocked && !app.holdCountdown,
    });
}

function updateTitle(dt, t) {
    const r = app.race;
    if (!r) return;
    app.acc += dt;
    let steps = 0;
    while (app.acc >= DT && steps < 10) { r.step(DT, null); app.acc -= DT; steps++; }
    for (const c of r.cars) if (c.lap > 90) c.lap = 1;
    carVisuals(dt, t);
    // Cinematic cameras: a low orbit, a chase, a trackside shot; a new car every few seconds.
    const T = app.title;
    T.t += dt;
    if (T.t > 6.5) { T.t = 0; T.cam = (T.cam + 1) % 3; T.focus = (T.focus + 2) % r.cars.length; chase.init = false; }
    const c = r.cars[T.focus];
    if (T.cam === 0) orbitCam(c.x, c.y, c.z, 8.5, 1.8, c.h + 2.4 + T.t * 0.25, 0.7, 48, gY);
    else if (T.cam === 1) updateChase(c, dt, (x, z) => app.world.groundY(x, z));
    else {
        if (!T.spot || T.t < dt * 1.5) {
            const i = app.track.wrap(c.loc.i + 30);
            const p = app.track.pointAt(i, 0, app.track.wall + 3);
            T.spot = [p.x, app.world.groundY(p.x, p.z) + 1.4, p.z];
        }
        camera.position.set(...T.spot);
        camera.lookAt(c.x, c.y + 0.8, c.z);
        if (camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); }
    }
}

// ------------------------------------------------------------------ the loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    app.t += dt;
    app.frameNo++;
    resize();
    const t = app.t;
    UI.storyTick(dt);
    if (app.mode === 'loading') return;

    // Which scene is on screen.
    const garageView = app.mode === 'hub' || (UI.storyActive() && app.storyBg === 'garage');
    if (garageView && garage) {
        // Shift the picture so the car sits beside (or above) the hub panel.
        const panel = $('hub-panel');
        const W = innerWidth, H = innerHeight;
        if (!$('hub').classList.contains('hidden') && panel && panel.offsetWidth) {
            const rc = panel.getBoundingClientRect();
            const wide = rc.width < W * 0.8;
            if (wide) camera.setViewOffset(W, H, rc.width / 2, 0, W, H);
            else camera.setViewOffset(W, H, 0, (H - rc.top) / 2 + 10, W, H);
        } else camera.clearViewOffset();
        garage.update(dt, t, camera);
        render(garage.scene);
        return;
    }
    camera.clearViewOffset();
    if (app.mode === 'title') updateTitle(dt, t);
    else if (app.mode === 'race' || app.mode === 'results') {
        if (app.mode === 'results') {
            // Keep the cars rolling to a stop behind the results.
            const r = app.race;
            if (r) { app.acc += dt; let n = 0; while (app.acc >= DT && n++ < 6) { r.step(DT, { throttle: 0, brake: 0.3, steer: 0 }); app.acc -= DT; } carVisuals(dt, t); orbitCam(r.player.x, r.player.y, r.player.z, 9, 2.8, t * 0.3, 0.8, 50, gY); }
        } else updateRace(dt, t);
        if (app.race && app.mode === 'race') hud.update(dt);
    }
    if (app.world) {
        app.world.update(t, dt);
        const P = app.race?.player;
        if (P) followSun(P.x, P.y, P.z);
    }
    if (app.fx) app.fx.update(dt, t, camera);
    render();
}

// ------------------------------------------------------------------ start
async function boot() {
    const bar = $('load-bar'), msg = $('load-msg');
    const step = (f, m) => new Promise((res) => { bar.style.width = `${f * 100}%`; msg.textContent = m; setTimeout(res, 30); });
    await step(0.2, 'Raking the dirt…');
    garage = new Garage(renderer);
    await step(0.45, 'Painting the barns…');
    enterTitle();
    await step(0.9, 'Filling the grandstands…');
    render();
    await step(1, 'Ready!');
    UI.show('loading', false);
    if (DEBUG && params.get('event') && EVENTS[params.get('event')]) {
        if (!app.profile) { app.profile = newProfile('Tester'); persist(); }
        app.startEvent(EVENTS[params.get('event')]);
    }
}
requestAnimationFrame(frame);
boot().catch((e) => { console.error(e); $('load-msg').textContent = 'Something went wrong: ' + e.message; });

// ------------------------------------------------------------------ debug hooks
if (DEBUG) {
    window.__dc = {
        app, input, settings, UI, CIRCUITS, EVENTS, DRIVERS, LOCALS, PAINTS, LIVERIES,
        get race() { return app.race; },
        coins(n) { app.profile.coins += n; persist(); if (app.mode === 'hub') UI.refreshHub(); },
        levels(lv) { Object.assign(app.profile.levels, lv); persist(); if (app.mode === 'hub') { garage.setCar(playerLook(app.profile)); UI.refreshHub(); } },
        go(id) { app.startEvent(EVENTS[id]); },
        skipStory() { while (UI.storyActive()) UI.storyAdvance(); },
        /** Finish the current race in first place (or `pos`). */
        win(pos = 1) {
            const r = app.race, P = r.player;
            if (r.type === 'tt') { P.finished = true; P.lap = r.laps; P.finishT = r.targets ? r.targets[0] - 1 : 30; r.t = P.finishT; r.finishOrder.unshift(P); r.playerDone = true; r.results = r.makeResults(); r.events.push({ type: 'finish', car: 0, pos: 1 }); handleEvents(r); return; }
            const others = r.cars.filter((c) => c !== P && !c.out);
            others.forEach((c, k) => { if (k < pos - 1) { c.finished = true; c.lap = r.laps; c.finishT = r.t + 0.5 + k; r.finishOrder.push(c); } });
            P.finished = true; P.lap = r.laps; P.finishT = r.t + pos; r.finishOrder.push(P);
            r.t += pos + 1;
            r.playerDone = true;
            r.results = r.makeResults();
            r.events.length = 0;
            r.events.push({ type: 'finish', car: 0, pos: r.results.pos });
            handleEvents(r);
        },
        playerLook: () => playerLook(app.profile),
        /** Let the AI drive the player's car (for screenshots and soak tests). */
        autopilot(skill = 0.9) { const r = app.race; r.drivers[0] = new Driver(r.player, { skill, lane: 0, nitroHappy: 0.8 }, 9); },
        hideUI() { for (const id of ['hud', 'title', 'hub']) document.getElementById(id).classList.add('hidden'); },
        cam: chase,
    };
}
