/**
 * audio.js — procedural Web Audio: every sound effect and a generative score.
 * No audio files. initAudio() must be called from a user gesture.
 *
 * Music: each world composes its own piece from a seed (mode, root, tempo,
 * progression, bass figure, arpeggio and a bell motif) played by a look-ahead
 * sequencer. Intensity layers: 0 explore (pad, bass, sparse bells),
 * 1 combat (+ drums, arpeggio), 2 Warden (+ lead, busier drums).
 */

import { makeRng } from './sim/rng.js';
import { WORLDS } from './sim/worlds.js';

let ctx = null, master, sfxBus, musicBus, verb, noiseBuf = null;
let enabled = true;
let musicOn = false;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = enabled ? 0.8 : 0;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.24; musicBus.connect(master);
    // A cheap cave reverb: a decaying noise impulse.
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.35;
    verb.connect(vg); vg.connect(master);
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
    if (o.verb) g.connect(verb);
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
    if (o.verb) g.connect(verb);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

export const sfx = {
    click() { tone('triangle', 880, 0.05, 0.08); },
    step() { if (limit('step', 0.08)) noise(0.05, 0.05, { f: 500 + Math.random() * 300, fTo: 200 }); },
    swing() { if (limit('swing', 0.04)) noise(0.12, 0.12, { type: 'bandpass', f: 900, fTo: 2600, q: 1.5 }); },
    hit(crit) {
        if (!limit('hit', 0.03)) return;
        noise(0.08, 0.22, { f: crit ? 3200 : 1500, fTo: 300 });
        tone('sine', crit ? 260 : 160, 0.1, 0.22, { to: 60 });
        if (crit) tone('square', 1500, 0.06, 0.06, { to: 900, filter: 3000 });
    },
    hurt() { tone('sawtooth', 170, 0.22, 0.2, { to: 70, filter: 900 }); noise(0.18, 0.2, { f: 900, fTo: 150 }); },
    miss() { if (limit('miss', 0.05)) noise(0.1, 0.07, { type: 'highpass', f: 3000, fTo: 6000 }); },
    kill(big) { if (!limit('kill', 0.04)) return; tone('square', big ? 260 : 440, 0.14, 0.1, { to: big ? 50 : 120, filter: 2200 }); noise(big ? 0.5 : 0.18, big ? 0.3 : 0.16, { f: 1800, fTo: 200, verb: big }); },
    bow() { if (limit('bow', 0.04)) { tone('triangle', 420, 0.08, 0.1, { to: 900 }); noise(0.1, 0.08, { type: 'highpass', f: 3000 }); } },
    fire() { noise(0.4, 0.2, { type: 'bandpass', f: 800, fTo: 300, q: 0.7, verb: true }); tone('sawtooth', 120, 0.3, 0.08, { to: 60, filter: 600 }); },
    frost() { [2637, 3136, 3951, 4699].forEach((f, i) => tone('sine', f, 0.2, 0.05, { delay: i * 0.03, verb: true })); noise(0.3, 0.08, { type: 'highpass', f: 5000 }); },
    magic() { if (limit('magic', 0.05)) tone('sine', 900, 0.25, 0.08, { to: 1600, verb: true }); },
    boom(big) { noise(big ? 0.8 : 0.45, big ? 0.45 : 0.32, { f: 1600, fTo: 70, verb: true }); tone('sine', big ? 70 : 110, big ? 0.7 : 0.4, 0.4, { to: 30 }); },
    telegraph() { if (limit('tele', 0.15)) { tone('sawtooth', 220, 0.3, 0.06, { to: 440, filter: 1400 }); tone('sine', 880, 0.2, 0.04, { delay: 0.1 }); } },
    door() { noise(0.35, 0.12, { f: 400, fTo: 120 }); tone('triangle', 140, 0.2, 0.06, { to: 90 }); },
    chest() { noise(0.3, 0.1, { f: 600, fTo: 200 }); [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, 0.3, 0.08, { delay: 0.15 + i * 0.06, verb: true })); },
    coin() { if (!limit('coin', 0.05)) return; tone('square', 1568, 0.06, 0.05, { filter: 5000 }); tone('square', 2093, 0.1, 0.05, { delay: 0.05, filter: 5000 }); },
    pickup() { if (limit('pick', 0.05)) [660, 990].forEach((f, i) => tone('triangle', f, 0.12, 0.08, { delay: i * 0.05 })); },
    rare() { [523, 784, 1047, 1568].forEach((f, i) => tone('triangle', f, 0.4, 0.09, { delay: i * 0.07, verb: true })); },
    potion() { [400, 500, 650].forEach((f, i) => tone('sine', f, 0.12, 0.08, { delay: i * 0.06, to: f * 1.3 })); noise(0.2, 0.05, { type: 'bandpass', f: 1500, q: 4 }); },
    heal() { [523, 659, 784].forEach((f, i) => tone('sine', f, 0.3, 0.07, { delay: i * 0.05, verb: true })); },
    oil() { noise(0.4, 0.08, { type: 'bandpass', f: 700, fTo: 1400, q: 2 }); tone('sine', 300, 0.4, 0.06, { to: 600 }); },
    levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0.2, 0.07, { delay: i * 0.07, filter: 4000, verb: true })); },
    quest() { [587, 740, 880, 1175].forEach((f, i) => tone('triangle', f, 0.35, 0.09, { delay: i * 0.09, verb: true })); },
    stairs() { [440, 392, 349, 294, 262].forEach((f, i) => tone('triangle', f, 0.25, 0.08, { delay: i * 0.07, verb: true })); noise(0.8, 0.06, { f: 600, fTo: 100, delay: 0.1 }); },
    trap() { noise(0.15, 0.2, { type: 'highpass', f: 2500 }); tone('square', 200, 0.15, 0.08, { to: 80 }); },
    tele() { tone('sine', 1600, 0.35, 0.08, { to: 200, verb: true }); },
    brazier() { noise(0.6, 0.18, { type: 'bandpass', f: 500, fTo: 1500, q: 0.6, verb: true }); },
    shrine() { [392, 494, 587, 784].forEach((f, i) => tone('sine', f, 0.8, 0.06, { delay: i * 0.12, verb: true })); },
    alert() { if (limit('alert', 0.4)) tone('triangle', 1200, 0.08, 0.05, { to: 1500 }); },
    roar() { tone('sawtooth', 80, 1.0, 0.3, { to: 45, filter: 700 }); noise(1.0, 0.25, { type: 'bandpass', f: 400, q: 1, verb: true }); },
    phase() { tone('sawtooth', 55, 1.2, 0.25, { filter: 400, filterTo: 1600, attack: 0.2 }); noise(1.2, 0.2, { f: 300, attack: 0.3, verb: true }); },
    victory() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, 0.4, 0.09, { delay: i * 0.12, verb: true })); },
    death() { [392, 330, 262, 196, 147].forEach((f, i) => tone('triangle', f, 0.6, 0.12, { delay: i * 0.2, verb: true })); },
    hush() { if (limit('hush', 1)) noise(1.5, 0.08, { type: 'bandpass', f: 200, fTo: 80, q: 2 }); },
};

// ------------------------------------------------------------------ Music

const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};

let song = null, intensity = 0, step = 0, nextT = 0, songWorld = 0;

function compose(world) {
    const W = WORLDS[world];
    const mood = W.music;
    const rng = makeRng(world * 7919 + 31);
    const scale = MODES[mood.mode];
    const deg = (d, oct = 0) => mood.root + scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
    const prog = rng.pick([[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 5, 4], [0, 5, 2, 6]]);
    const motif = [];
    let d = rng.int(2, 5);
    for (let i = 0; i < 8; i++) { motif.push(rng.chance(0.35) ? null : d); d += rng.pick([-2, -1, 1, 1, 2, 0, -3]); d = Math.max(0, Math.min(9, d)); }
    const arp = rng.pick([[0, 2, 4, 7], [0, 4, 2, 4], [0, 2, 4, 2], [4, 2, 0, 2], [0, 4, 7, 4]]);
    const bass = rng.pick([[1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 0, 0, 1]]);
    const pad = ['triangle', 'sine', 'sawtooth'][world % 3];
    return { deg, prog, motif, arp, bass, pad, spb: 60 / mood.bpm / 4, world };
}

export function startMusic(world) {
    if (songWorld === world && musicOn) return;
    songWorld = world;
    song = compose(world);
    musicOn = true;
    if (ctx) { step = 0; nextT = ctx.currentTime + 0.1; }
}
export function stopMusic() { musicOn = false; songWorld = 0; }
export function setIntensity(v) { intensity = v; }

function schedule() {
    if (!ctx || !musicOn || !song || !enabled) { if (ctx) nextT = ctx.currentTime + 0.05; return; }
    while (nextT < ctx.currentTime + 0.12) { playStep(step, nextT); step++; nextT += song.spb; }
}

function playStep(s, t) {
    const { deg, prog, motif, arp, bass, spb, pad } = song;
    const bar = Math.floor(s / 16) % 4, beat = s % 16;
    const chord = prog[bar];
    const o = { at: t, bus: musicBus };
    if (beat === 0) for (const k of [0, 2, 4]) {
        tone(pad, midi(deg(chord + k, 0)), spb * 16, pad === 'sawtooth' ? 0.012 : 0.03, { ...o, attack: 0.6, detune: -7, filter: 1200 });
        tone(pad, midi(deg(chord + k, 0)), spb * 16, pad === 'sawtooth' ? 0.012 : 0.03, { ...o, attack: 0.6, detune: 6, filter: 1200, verb: true });
    }
    if (bass[beat % 8] && (intensity > 0 || beat % 8 === 0)) tone('sawtooth', midi(deg(chord, -2)), spb * 2.4, 0.08, { ...o, filter: 420, filterTo: 160 });
    // Sparse bells while exploring: the motif, slow.
    if (intensity === 0 && beat % 4 === 0 && (s >> 4) % 2 === 1) {
        const m = motif[(beat / 4 + bar * 2) % 8];
        if (m !== null) { tone('sine', midi(deg(m, 1)), 1.4, 0.035, { ...o, verb: true }); tone('sine', midi(deg(m, 2)) * 1.002, 0.8, 0.012, { ...o, verb: true }); }
    }
    if (intensity >= 1) {
        if (beat % 8 === 0 || (intensity >= 2 && beat % 4 === 0)) tone('sine', 110, 0.22, 0.35, { ...o, to: 38 });
        if (beat === 4 || beat === 12) noise(0.16, 0.12, { ...o, f: 2200, type: 'bandpass', q: 0.7 });
        if (beat % 2 === 1 || intensity >= 2) noise(0.03, 0.03, { ...o, type: 'highpass', f: 7000 });
        if (beat % 2 === 0) tone('square', midi(deg(chord + arp[(beat / 2) % 4], 1)), spb * 0.9, 0.016, { ...o, filter: 2200 });
    }
    if (intensity >= 2 && beat % 2 === 0) {
        const m = motif[(beat / 2) % 8];
        if (m !== null) tone('sawtooth', midi(deg(m + (bar % 2 ? 2 : 0), 1)), spb * 1.8, 0.03, { ...o, filter: 1800 });
    }
}
