/**
 * Nightline — entry point.
 *
 * A lo-fi night drive through an endless procedural city. There are no goals
 * and nothing can crash: you choose a speed and a lane, pull over where you
 * like, and change the radio. Everything — the city, the textures, the music —
 * is generated at run time.
 *
 * Library: three.js r165 via the import map in index.html.
 */

import * as THREE from 'three';
import { FOV, FOG_DENSITY, SETTINGS_KEY, LOG_KEY, START_KMH } from './config.js';
import { Road } from './road.js';
import { City } from './city.js';
import {
    makeWindowTexture, makeSignAtlas, makeGlowTexture, makeSteamTexture, makeSkylineTexture, Billboards,
} from './textures.js';
import { makeMaterials, U } from './materials.js';
import { Traffic } from './traffic.js';
import { Car } from './car.js';
import { CameraRig, CAM_LABELS } from './camera.js';
import { Weather } from './weather.js';
import { Sky } from './sky.js';
import { Pipeline } from './render.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { AMBIENT_LINES } from './stops.js';
import { mulberry32, hash2 } from './rng.js';

// ------------------------------------------------------------------ setup
class Bus {
    constructor() { this.m = new Map(); }
    on(e, f) { if (!this.m.has(e)) this.m.set(e, new Set()); this.m.get(e).add(f); return () => this.m.get(e).delete(f); }
    emit(e, ...a) { const s = this.m.get(e); if (s) for (const f of s) f(...a); }
}

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const seed = params.get('seed') ? hash2([...params.get('seed')].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7), 99) : (Math.random() * 1e9) | 0;
const rand = mulberry32(seed ^ 0x99);

const settings = { res: 'lofi', retro: true, refl: true, rain: 'auto', music: 0.7, sfx: 0.8 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* private mode */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };
let nightLog = [];
try { nightLog = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { nightLog = []; }

const bus = new Bus();
const ui = new UI();
const pipeline = new Pipeline(document.getElementById('view'));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, FOG_DENSITY);
const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 2600);

const billboards = new Billboards();
const tex = {
    windows: makeWindowTexture(seed),
    signs: makeSignAtlas(seed ^ 0x51),
    glow: makeGlowTexture(),
    steam: makeSteamTexture(),
    skyline: makeSkylineTexture(seed ^ 0x5e),
    billboards,
};
const M = makeMaterials(tex);
const road = new Road(seed);
const city = new City(scene, road, M, tex, seed);
const traffic = new Traffic(scene, road, M, seed);
const car = new Car(scene, road, M, bus);
const rig = new CameraRig(camera, road, car, seed);
const weather = new Weather(scene, M, tex, seed);
const sky = new Sky(scene, M, tex, seed);
const audio = new AudioEngine();

const state = {
    started: false, paused: false, drift: false, hudOff: false, time: 0, photo: false,
    district: null, clockStart: 22 * 60 + 50 + Math.floor(rand() * 90),
};

// environment colours ease between districts
const env = {
    fog: new THREE.Color(), sky: new THREE.Color(), lamp: new THREE.Color(),
    tFog: new THREE.Color(), tSky: new THREE.Color(), tLamp: new THREE.Color(),
};

function applySettings() {
    pipeline.configure({ preset: settings.res, retro: settings.retro, reflections: settings.refl });
    document.body.classList.toggle('no-retro', !settings.retro);
    weather.setLock(settings.rain === 'auto' ? null : parseFloat(settings.rain));
    audio.setVolumes(settings.music, settings.sfx);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    ui.settings(settings);
}
applySettings();
window.addEventListener('resize', () => applySettings());

// ------------------------------------------------------------------ clock
function clockStr() {
    const m = state.clockStart + Math.floor(state.time * 4 / 60);
    const wrapped = 22 * 60 + ((m - 22 * 60) % (7 * 60) + 7 * 60) % (7 * 60);
    const h = Math.floor(wrapped / 60) % 24, mm = wrapped % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ stops
const stopState = { lines: [], next: 0, parkedAt: 0 };

bus.on('stopRequested', (st) => ui.toast(`Blinker on — pulling over at ${st.name}`));
bus.on('stopMissed', (st) => ui.toast(`Missed the turn-in for ${st.name}. Plenty more city.`));
bus.on('parked', (st) => {
    document.body.classList.add('parked');
    ui.showStop(st, st.district.name, clockStr());
    audio.chime();
    const pool = st.def.lines.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    pool.splice(2 + Math.floor(rand() * 2), 0, AMBIENT_LINES[Math.floor(rand() * AMBIENT_LINES.length)]);
    stopState.lines = pool;
    stopState.next = 1.2;
    stopState.parkedAt = state.time;
    nightLog.push({ name: st.name, label: st.label, district: st.district.name, time: clockStr(), km: (car.odo / 1000).toFixed(1) });
    if (nightLog.length > 60) nightLog.shift();
    try { localStorage.setItem(LOG_KEY, JSON.stringify(nightLog)); } catch { /* ignore */ }
    ui.log(nightLog);
});
bus.on('departed', () => { ui.hideStop(); document.body.classList.remove('parked'); });

function stopAction() {
    if (car.mode !== 'parked' || !car.stop) return;
    const r = car.stop.def.results;
    ui.stopResult(r[Math.floor(rand() * r.length)]);
    audio.click();
}

function driveOn() {
    if (car.resume()) { ui.stopLeaving(); audio.click(); }
}

function pullOver() {
    if (car.mode === 'parked') { driveOn(); return; }
    if (car.mode !== 'drive') return;
    if (car.wantStop) { car.cancelStop(); ui.toast('Never mind. Keep driving.'); return; }
    if (!car.requestStop()) ui.toast('Nothing to pull over for yet — keep an eye out.');
}

// ------------------------------------------------------------------ drift mode (the car drives itself)
const ai = { laneT: 12, speedT: 20, parkFor: 0, decided: new Set() };

function autopilot(dt, allowStops) {
    ai.laneT -= dt; ai.speedT -= dt;
    if (ai.speedT <= 0) { car.setCruise(48 + rand() * 42); ai.speedT = 25 + rand() * 35; }
    if (car.mode === 'drive' && !car.wantStop) {
        const st = car.reachableStop();
        if (allowStops && st && !ai.decided.has(st.id) && st.s - car.s < 300) {
            ai.decided.add(st.id);
            if (rand() < 0.55) car.requestStop();
        } else if (ai.laneT <= 0) {
            car.requestLane(car.lane === 0 ? 1 : -1);
            ai.laneT = 14 + rand() * 30;
        }
    }
    if (car.mode === 'parked') {
        if (ai.parkFor <= 0) ai.parkFor = 22 + rand() * 25;
        ai.parkFor -= dt;
        if (ai.parkFor <= 0) driveOn();
    }
}

function setDrift(on, quiet = false) {
    state.drift = on;
    ui.drift(on);
    if (on) {
        car.input.up = car.input.down = car.input.brake = false;
        if (rig.mode === 'chase') { rig.setMode('cinema'); ui.camLabel(CAM_LABELS.cinema); state.driftCam = true; }
        if (!quiet) ui.toast('Drift mode. The car has it from here.');
    } else {
        if (state.driftCam && rig.mode === 'cinema') { rig.setMode('chase'); ui.camLabel(CAM_LABELS.chase); }
        state.driftCam = false;
        if (!quiet) ui.toast('You have the wheel.');
    }
}

// ------------------------------------------------------------------ radio
audio.onTrack = (st, track) => ui.radio(st, track);
function changeStation(dir) {
    const st = audio.setStation(audio.station + dir);
    ui.radio(st, null);
}

// ------------------------------------------------------------------ start / menu
function start() {
    if (state.started) return;
    state.started = true;
    audio.init();
    audio.setVolumes(settings.music, settings.sfx);
    ui.radio(audio.stationInfo, null);
    ui.start();
    setDrift(false, true);
    rig.setMode('chase');
    ui.camLabel(CAM_LABELS.chase);
    car.setCruise(START_KMH);
    ai.decided.clear();
}

function setMenu(open) {
    ui.menu(open);
    state.paused = open;
    if (open) ui.log(nightLog);
}

document.getElementById('title').addEventListener('click', () => { if (bootDone) start(); });
document.getElementById('m-resume').addEventListener('click', () => setMenu(false));
document.getElementById('btn-menu').addEventListener('click', () => setMenu(!ui.menuOpen));
document.getElementById('btn-cam').addEventListener('click', () => ui.camLabel(CAM_LABELS[rig.cycle()]));
document.getElementById('btn-radio').addEventListener('click', () => changeStation(1));
document.getElementById('btn-drift').addEventListener('click', () => setDrift(!state.drift));
document.getElementById('btn-photo').addEventListener('click', () => { state.photo = true; });
document.getElementById('prompt').addEventListener('click', pullOver);
document.getElementById('sc-go').addEventListener('click', driveOn);
document.getElementById('sc-action').addEventListener('click', stopAction);

for (const b of document.querySelectorAll('.mt')) {
    b.addEventListener('click', () => {
        for (const o of document.querySelectorAll('.mt')) o.classList.toggle('on', o === b);
        for (const p of document.querySelectorAll('.m-page')) p.classList.toggle('hidden', p.dataset.page !== b.dataset.tab);
    });
}
const seg = (id, key, conv = (v) => v) => {
    for (const b of document.querySelectorAll(`#${id} button`)) {
        b.addEventListener('click', () => { settings[key] = conv(b.dataset.v); saveSettings(); applySettings(); });
    }
};
seg('set-res', 'res');
seg('set-retro', 'retro', (v) => v === '1');
seg('set-refl', 'refl', (v) => v === '1');
seg('set-rain', 'rain');
for (const [id, key] of [['set-music', 'music'], ['set-sfx', 'sfx']]) {
    document.getElementById(id).addEventListener('input', (e) => { settings[key] = parseFloat(e.target.value); saveSettings(); audio.setVolumes(settings.music, settings.sfx); });
}

// ------------------------------------------------------------------ input
const DRIVE_KEYS = new Set(['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'Space', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD']);
function takeWheel() { if (state.drift) setDrift(false); }

window.addEventListener('keydown', (e) => {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!state.started) { if (bootDone) start(); return; }
    if (ui.menuOpen) { if (e.code === 'Escape' || e.code === 'KeyM') setMenu(false); return; }
    if (e.repeat && !['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(e.code)) return;
    if (DRIVE_KEYS.has(e.code)) takeWheel();
    switch (e.code) {
    case 'ArrowUp': case 'KeyW': car.input.up = true; break;
    case 'ArrowDown': case 'KeyS': car.input.down = true; break;
    case 'Space': car.input.brake = true; break;
    case 'ArrowLeft': case 'KeyA': car.requestLane(-1); break;
    case 'ArrowRight': case 'KeyD': car.requestLane(1); break;
    case 'KeyE': case 'Enter': pullOver(); break;
    case 'KeyR': changeStation(e.shiftKey ? -1 : 1); break;
    case 'KeyC': ui.camLabel(CAM_LABELS[rig.cycle()]); break;
    case 'KeyZ': setDrift(!state.drift); break;
    case 'KeyH': state.hudOff = !state.hudOff; ui.hudHidden(state.hudOff); break;
    case 'KeyP': state.photo = true; break;
    case 'Escape': case 'KeyM': setMenu(true); break;
    }
});
window.addEventListener('keyup', (e) => {
    switch (e.code) {
    case 'ArrowUp': case 'KeyW': car.input.up = false; break;
    case 'ArrowDown': case 'KeyS': car.input.down = false; break;
    case 'Space': car.input.brake = false; break;
    }
});
window.addEventListener('blur', () => { car.input.up = car.input.down = car.input.brake = false; });
// A background tab throttles timers to once a second, which would make the
// radio's scheduler stutter; pause the audio instead and pick up on return.
document.addEventListener('visibilitychange', () => {
    if (!audio.ctx) return;
    if (document.hidden) audio.ctx.suspend(); else audio.ctx.resume();
});

// touch: show the on-screen controls once a finger is seen
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
ui.touch(coarse);
window.addEventListener('touchstart', () => ui.touch(true), { once: true, passive: true });
const hold = (id, key) => {
    const el = document.getElementById(id);
    const on = (e) => { e.preventDefault(); takeWheel(); car.input[key] = true; el.classList.add('down'); };
    const off = () => { car.input[key] = false; el.classList.remove('down'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
};
hold('t-faster', 'up'); hold('t-slower', 'down'); hold('t-brake', 'brake');
document.getElementById('t-left').addEventListener('pointerdown', (e) => { e.preventDefault(); takeWheel(); car.requestLane(-1); });
document.getElementById('t-right').addEventListener('pointerdown', (e) => { e.preventDefault(); takeWheel(); car.requestLane(1); });

// ------------------------------------------------------------------ events from the world
function drainEvents() {
    for (const e of traffic.takeEvents()) {
        if (e === 'flyby') audio.flyby();
        if (e === 'police') { audio.siren(); if (state.started && rand() < 0.5) ui.toast('A patrol spinner sweeps the street ahead.'); }
    }
    for (const e of weather.takeEvents()) {
        if (e.type === 'thunder') setTimeout(() => audio.thunder(e.power), e.delay * 1000);
    }
}

// ------------------------------------------------------------------ frame
let last = performance.now();
let bootDone = false;
let blinkAcc = 0, blinkOn = false;
let flickerOn = true;
const tmpDir = new THREE.Vector2();

function updateEnvironment(dt) {
    const d = road.districtAt(car.s);
    if (d !== state.district) {
        const first = !state.district;
        state.district = d;
        env.tFog.setRGB(...d.def.fog); env.tSky.setRGB(...d.def.sky); env.tLamp.setRGB(...d.def.lamp);
        if (first) { env.fog.copy(env.tFog); env.sky.copy(env.tSky); env.lamp.copy(env.tLamp); }
        if (state.started) ui.banner(d.type === 'skyway' ? 'ELEVATED' : 'ENTERING', d.name.toUpperCase());
    }
    const k = Math.min(1, dt * 0.35);
    env.fog.lerp(env.tFog, k); env.sky.lerp(env.tSky, k); env.lamp.lerp(env.tLamp, k);
    U.uFogColor.value.copy(env.fog);
    U.uSky.value.copy(env.sky);
    U.uLamp.value.copy(env.lamp);
    scene.fog.color.copy(env.fog);
    const dens = FOG_DENSITY * (1 + weather.rain * 0.22) * (d.type === 'skyway' ? 0.82 : d.type === 'harbor' ? 1.12 : 1);
    U.uFogDensity.value += (dens - U.uFogDensity.value) * k;
    scene.fog.density = U.uFogDensity.value;
}

function updatePrompt() {
    if (!state.started) return;
    let text = '', armed = false;
    const touch = document.body.classList.contains('touch');
    if (car.mode === 'drive') {
        if (car.wantStop) {
            text = `◆ Pulling over at ${car.wantStop.name} · ${Math.max(0, Math.round(car.wantStop.s - car.s))} m`;
            armed = true;
        } else {
            const st = car.reachableStop();
            if (st) text = `◆ ${st.name} · ${st.label} · ${Math.round(st.s - car.s)} m — ${touch ? 'tap' : 'E'} to pull over`;
        }
    } else if (car.mode === 'toBay') {
        text = `◆ Pulling in to ${car.stop.name}…`; armed = true;
    } else if (car.mode === 'fromBay' && car._leaveFrom === null) {
        text = '◆ Waiting for a gap in the traffic…'; armed = true;
    }
    ui.prompt(text, armed);
}

function simStep(dt) {
    state.time += dt;
    if (!state.started) autopilot(dt, false);
    else if (state.drift) autopilot(dt, true);
    car.update(dt, traffic);
    traffic.update(dt, car, camera.position, state.time);
    city.update(car.s, 1);
    updateEnvironment(dt);
    weather.update(dt, state.time, camera.position, city.vents(car.s, 160));
    billboards.update(dt);
    drainEvents();

    // flickering neon
    if (flickerOn ? rand() < 0.025 : rand() < 0.3) flickerOn = !flickerOn;
    M.signFlicker.opacity = flickerOn ? 1 : 0.12;

    // flavour lines while parked
    if (car.mode === 'parked' && stopState.lines.length) {
        stopState.next -= dt;
        if (stopState.next <= 0) {
            ui.stopLine(stopState.lines.shift());
            stopState.next = 9;
        }
    }
    // blinker tick
    if (car.blinker !== 0 && state.started) {
        blinkAcc += dt;
        if (blinkAcc > 0.4) { blinkAcc = 0; blinkOn = !blinkOn; audio.blinker(blinkOn); }
    } else blinkAcc = 0;
}

function renderFrame(dt) {
    rig.update(dt, state.time);
    sky.update(dt, camera.position);
    U.uTime.value = state.time;
    U.uCarPos.value.copy(car.pos);
    tmpDir.set(Math.sin(car.heading), Math.cos(car.heading));
    U.uCarDir.value.copy(tmpDir);
    pipeline.render(scene, camera, road.elevation(car.s), state.time);
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!bootDone) return;

    if (!state.paused) simStep(dt);

    renderFrame(dt);

    if (state.photo) {
        state.photo = false;
        const a = document.createElement('a');
        a.href = pipeline.snapshot(4);
        a.download = `nightline-${clockStr().replace(':', '')}-${Math.round(car.odo)}.png`;
        a.click();
        ui.toast('Photo saved.');
        audio.click();
    }

    audio.update(dt, { speed: car.v, rain: weather.rain, inside: rig.mode === 'hood', parked: car.mode === 'parked' });
    if (state.started) {
        ui.dash(car, clockStr(), state.district ? state.district.name : '');
        updatePrompt();
    }
}

// ------------------------------------------------------------------ boot
// Build the first stretch of city over a few frames so the page stays responsive.
function boot() {
    car.update(0, traffic);
    rig.setMode('cinema');
    let steps = 0;
    const tick = () => {
        const done = city.update(car.s, 3);
        steps++;
        if (!done && steps < 200) { setTimeout(tick, 0); return; }
        for (let i = 0; i < 30; i++) traffic.update(0.5, car, camera.position, i * 0.5);
        bootDone = true;
        ui.ready();
        window.__ready = true;
    };
    tick();
}
boot();
requestAnimationFrame(frame);

if (DEBUG) {
    window.__nl = {
        THREE, scene, camera, road, city, traffic, car, rig, weather, audio, pipeline, ui, state, settings, U, M, seed,
        start,
        /** Jump to just before the next stop and ask to pull over there. */
        nextStop() {
            const st = road.nextStop(car.s + 60);
            car.s = st.s - 120; car.u = 5.4; car.lane = car.targetLane = 1; car.mode = 'drive'; car.wantStop = null;
            city.update(car.s, 99);
            return st;
        },
        teleport(s) {
            car.s = s; car.mode = 'drive'; car.stop = car.wantStop = null; car.u = 5.4; car.lane = car.targetLane = 1;
            ui.hideStop(); document.body.classList.remove('parked');
            city.update(car.s, 99);
        },
        /** Render one frame right now (so a test can read the canvas in the same task). */
        renderNow() { renderFrame(1 / 60); },
        /** Mean brightness (0–255) of the frame, rendered and read in one go. */
        luminance() {
            renderFrame(1 / 60);
            const c = document.createElement('canvas'); c.width = 64; c.height = 36;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.drawImage(pipeline.canvas, 0, 0, 64, 36);
            const p = g.getImageData(0, 0, 64, 36).data;
            let sum = 0;
            for (let i = 0; i < p.length; i += 4) sum += p[i] + p[i + 1] + p[i + 2];
            return sum / (p.length / 4) / 3;
        },
        /** Park at the next stop of a type (or any) right away. */
        parkAt(type) {
            road.ensure(car.s + 40000);
            const st = road.stops.find((q) => q.s > car.s + 40 && (!type || q.type === type));
            if (!st) return null;
            car.s = st.s + 18.7; car.u = 9.8; car.v = 0; car.mode = 'parked'; car.stop = st; car.wantStop = null;
            city.update(car.s, 99);
            car.update(0, traffic);
            rig.stopBlend = 1; rig.snap = true;
            bus.emit('parked', st);
            return st.name;
        },
        districts() { return road.districts.map((d) => [d.type, d.start, d.end]); },
        /** Run the simulation without rendering (for tests). */
        sim(seconds, dt = 1 / 30, onStep = null) {
            for (let t = 0; t < seconds; t += dt) {
                simStep(dt);
                rig.update(dt, state.time);
                if (onStep) onStep();
            }
        },
    };
}
