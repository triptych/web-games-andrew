/**
 * sounds.js — procedural Web Audio: every sound effect and a generative
 * soundtrack. No audio files. Call initAudio() from the first user gesture.
 *
 * Music: each chapter composes its own loop from a seed — key, mode, tempo,
 * a four-chord progression, a bass figure, an arpeggio and an 8-step melody
 * motif — played by a look-ahead step sequencer (a 25 ms timer schedules
 * 16th notes ~120 ms ahead on the audio clock). Intensity layers:
 *   0 calm (title, cleared rooms, shrines): pad + bass
 *   1 fight: + drums + arpeggio
 *   2 boss: + lead motif, busier hats
 */

import { makeRng } from './sim/rng.js';

let ctx = null;
let master, sfxBus, musicBus, noiseBuf = null;
let enabled = true;
let musicOn = false;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.26; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 25);
}

export const isSoundEnabled = () => enabled;
export function setSoundEnabled(v) {
    enabled = v;
    if (master) master.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.05);
}

// ------------------------------------------------------------------ Primitives

const now = () => ctx.currentTime;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const last = new Map();
function limit(key, gap) {
    if (!ctx || !enabled) return false;
    const t = ctx.currentTime;
    if ((last.get(key) ?? -1) > t - gap) return false;
    last.set(key, t);
    return true;
}

function tone(type, f, dur, vol, o = {}) {
    if (!ctx || !enabled) return;
    const t = (o.at ?? now()) + (o.delay ?? 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
        const fl = ctx.createBiquadFilter();
        fl.type = o.filterType ?? 'lowpass';
        fl.frequency.setValueAtTime(o.filter, t);
        if (o.filterTo) fl.frequency.exponentialRampToValueAtTime(o.filterTo, t + dur);
        fl.Q.value = o.q ?? 1;
        osc.connect(fl); node = fl;
    }
    node.connect(g);
    g.connect(o.bus ?? sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
}

function noise(dur, vol, o = {}) {
    if (!ctx || !enabled) return;
    const t = (o.at ?? now()) + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate ?? 1;
    const fl = ctx.createBiquadFilter();
    fl.type = o.type ?? 'lowpass';
    fl.frequency.setValueAtTime(o.f ?? 2000, t);
    if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    fl.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus ?? sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ Effects

export const sfx = {
    click() { tone('triangle', 880, 0.06, 0.12); tone('triangle', 1320, 0.05, 0.08, { delay: 0.03 }); },
    shoot(n = 1) {
        if (!limit('shoot', 0.05)) return;
        tone('triangle', 520 + Math.random() * 40, 0.09, 0.12, { to: 180, slide: 0.07 });
        noise(0.05, 0.08 + Math.min(0.08, n * 0.01), { type: 'highpass', f: 3000 });
    },
    hit(crit) {
        if (!limit('hit', 0.025)) return;
        noise(0.06, 0.2, { f: crit ? 3200 : 1400, fTo: 300 });
        tone('sine', crit ? 320 : 180, 0.08, 0.2, { to: 70 });
        if (crit) tone('square', 1400, 0.05, 0.06, { to: 900, filter: 3000 });
    },
    dot() { if (limit('dot', 0.08)) noise(0.05, 0.06, { f: 900 }); },
    kill(big) {
        if (!limit('kill', 0.04)) return;
        tone('square', big ? 300 : 520, 0.12, 0.12, { to: big ? 60 : 140, filter: 2400 });
        noise(big ? 0.4 : 0.15, big ? 0.35 : 0.18, { f: big ? 1200 : 2400, fTo: 200 });
    },
    hurt() {
        tone('sawtooth', 160, 0.25, 0.22, { to: 60, filter: 900 });
        noise(0.2, 0.25, { f: 900, fTo: 150 });
    },
    dodge() { noise(0.18, 0.15, { type: 'bandpass', f: 1200, fTo: 4000, q: 2 }); },
    block() { tone('triangle', 1200, 0.25, 0.15, { to: 900 }); tone('sine', 2400, 0.2, 0.08); },
    xp() { if (limit('xp', 0.03)) tone('sine', 1200 + Math.random() * 500, 0.05, 0.05); },
    coin() { if (!limit('coin', 0.05)) return; tone('square', 1568, 0.06, 0.06, { filter: 5000 }); tone('square', 2093, 0.09, 0.06, { delay: 0.05, filter: 5000 }); },
    heart() { [523, 659, 784].forEach((f, i) => tone('triangle', f, 0.3, 0.1, { delay: i * 0.05 })); },
    levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0.18, 0.08, { delay: i * 0.06, filter: 4000 })); noise(0.5, 0.08, { type: 'highpass', f: 5000, delay: 0.1 }); },
    pick() { [784, 1175, 1568].forEach((f, i) => tone('triangle', f, 0.25, 0.12, { delay: i * 0.05 })); },
    enemyFire(kind) {
        if (!limit('efire', 0.06)) return;
        if (kind === 'bomb') { tone('sine', 300, 0.2, 0.1, { to: 600 }); return; }
        tone(kind === 'arrow' ? 'triangle' : 'sine', kind === 'arrow' ? 700 : 420, 0.12, 0.08, { to: kind === 'arrow' ? 300 : 220 });
    },
    wind() { if (limit('wind', 0.1)) tone('sine', 300, 0.4, 0.05, { to: 900, attack: 0.2 }); },
    boom(big) {
        noise(big ? 0.7 : 0.4, big ? 0.5 : 0.35, { f: 1800, fTo: 80 });
        tone('sine', big ? 90 : 120, big ? 0.6 : 0.35, big ? 0.45 : 0.3, { to: 30 });
    },
    slam() { tone('sine', 80, 0.45, 0.45, { to: 28 }); noise(0.35, 0.3, { f: 600, fTo: 60 }); },
    beam() { tone('sawtooth', 220, 0.45, 0.12, { to: 880, filter: 2000 }); noise(0.4, 0.1, { type: 'bandpass', f: 3000, q: 3 }); },
    charge() { noise(0.25, 0.2, { type: 'bandpass', f: 500, fTo: 1500, q: 3 }); tone('sawtooth', 110, 0.25, 0.08, { to: 220, filter: 800 }); },
    land() { if (limit('land', 0.08)) tone('sine', 140, 0.12, 0.12, { to: 60 }); },
    freeze() { [2637, 3136, 3951].forEach((f, i) => tone('sine', f, 0.15, 0.05, { delay: i * 0.03 })); },
    bolt() { if (limit('bolt', 0.06)) noise(0.12, 0.18, { type: 'bandpass', f: 4000, q: 4 }); },
    door() { noise(0.6, 0.12, { f: 300, fTo: 100 }); [659, 988].forEach((f, i) => tone('triangle', f, 0.4, 0.1, { delay: 0.3 + i * 0.1 })); },
    exit() { noise(0.4, 0.12, { type: 'bandpass', f: 600, fTo: 2400, q: 1.5 }); },
    clear() { [523, 784, 1047].forEach((f, i) => tone('triangle', f, 0.35, 0.12, { delay: i * 0.08 })); },
    bossSpawn() { tone('sawtooth', 55, 1.6, 0.3, { filter: 400, filterTo: 1200, attack: 0.3 }); tone('sawtooth', 82, 1.6, 0.2, { filter: 400, attack: 0.3 }); noise(1.2, 0.2, { f: 300, attack: 0.3 }); },
    roar() { tone('sawtooth', 90, 0.8, 0.3, { to: 50, filter: 700 }); noise(0.8, 0.3, { type: 'bandpass', f: 400, q: 1 }); },
    victory() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0.3, 0.09, { delay: i * 0.11, filter: 3500 })); },
    death() { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, 0.4, 0.14, { delay: i * 0.15 })); },
    revive() { [392, 523, 659, 784, 1047].forEach((f, i) => tone('sine', f, 0.4, 0.12, { delay: i * 0.07 })); noise(0.8, 0.1, { type: 'highpass', f: 4000 }); },
    teleport() { tone('sine', 1600, 0.3, 0.08, { to: 200 }); },
    spikes() { noise(0.08, 0.15, { type: 'highpass', f: 2500 }); },
};

// ------------------------------------------------------------------ Music

const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const CHAPTER_MOODS = [
    { mode: 'major', bpm: 112, root: 55 },   // glade
    { mode: 'minor', bpm: 100, root: 50 },   // crypt
    { mode: 'phrygian', bpm: 118, root: 52 },// ember
    { mode: 'dorian', bpm: 104, root: 57 },  // frost
    { mode: 'dorian', bpm: 96, root: 53 },   // fungal
    { mode: 'mixolydian', bpm: 108, root: 55 }, // tidal
    { mode: 'harmonic', bpm: 124, root: 48 },// forge
    { mode: 'minor', bpm: 110, root: 56 },   // crystal
    { mode: 'major', bpm: 120, root: 58 },   // sky
    { mode: 'phrygian', bpm: 128, root: 49 },// void
];

let song = null;
let intensity = 0;
let step = 0, nextT = 0;

function compose(chapter) {
    const mood = CHAPTER_MOODS[(chapter - 1) % CHAPTER_MOODS.length];
    const rng = makeRng(chapter * 7919 + 13);
    const scale = MODES[mood.mode];
    const deg = (d, oct = 0) => mood.root + scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
    const progs = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 5, 4]];
    const prog = rng.pick(progs);
    const motif = [];
    let d = rng.int(0, 4);
    for (let i = 0; i < 8; i++) { motif.push(rng.chance(0.2) ? null : d); d += rng.pick([-2, -1, 1, 1, 2, 0]); d = Math.max(-1, Math.min(9, d)); }
    const arpShape = rng.pick([[0, 2, 4, 7], [0, 4, 2, 4], [0, 2, 4, 2], [4, 2, 0, 2]]);
    const bassShape = rng.pick([[1, 0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 0, 1, 1], [1, 0, 0, 0, 1, 0, 0, 0]]);
    return { mood, deg, prog, motif, arpShape, bassShape, spb: 60 / mood.bpm / 4 };
}

export function startMusic(chapter) {
    song = compose(chapter);
    musicOn = true;
    if (ctx) { step = 0; nextT = ctx.currentTime + 0.1; }
}
export function stopMusic() { musicOn = false; }
export function setIntensity(v) { intensity = v; }

function schedule() {
    if (!ctx || !musicOn || !song || !enabled) { if (ctx) nextT = ctx.currentTime + 0.05; return; }
    while (nextT < ctx.currentTime + 0.12) {
        playStep(step, nextT);
        step++;
        nextT += song.spb;
    }
}

function playStep(s, t) {
    const { deg, prog, motif, arpShape, bassShape, spb } = song;
    const bar = Math.floor(s / 16) % 4, beat = s % 16;
    const chord = prog[bar];
    const o = { at: t, bus: musicBus };
    // Pad: whole-bar chord.
    if (beat === 0) {
        for (const k of [0, 2, 4]) {
            tone('triangle', midi(deg(chord + k, 0)), spb * 16, 0.035, { ...o, attack: 0.4, detune: -6 });
            tone('triangle', midi(deg(chord + k, 0)), spb * 16, 0.035, { ...o, attack: 0.4, detune: 7 });
        }
    }
    // Bass.
    if (bassShape[beat % 8]) tone('sawtooth', midi(deg(chord, -2)), spb * 1.8, 0.09, { ...o, filter: 500, filterTo: 180 });
    if (intensity >= 1) {
        // Drums.
        if (beat % 4 === 0) { tone('sine', 120, 0.18, 0.35, { ...o, to: 40 }); }
        if (beat === 4 || beat === 12) noise(0.14, 0.14, { ...o, f: 2600, type: 'bandpass', q: 0.7 });
        if (beat % 2 === 1 || intensity >= 2) noise(0.03, beat % 4 === 2 ? 0.06 : 0.035, { ...o, type: 'highpass', f: 7000 });
        // Arpeggio.
        if (beat % 2 === 0) tone('square', midi(deg(chord + arpShape[(beat / 2) % 4], 1)), spb * 0.9, 0.022, { ...o, filter: 2400 });
    }
    if (intensity >= 2 && beat % 2 === 0) {
        const m = motif[(beat / 2) % 8];
        if (m !== null) tone('triangle', midi(deg(m + (bar % 2 ? 2 : 0), 1)), spb * 1.8, 0.05, o);
    }
}
