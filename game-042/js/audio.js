// ============================================================
// Chiptune audio, all synthesised.
//
// * Two pulse channels (25% and 12.5% duty via PeriodicWave, like the
//   NES), a triangle bass and a noise channel.
// * A small COMPOSER writes an AABA song from a seed and a mood: a chord
//   progression from the mode's pool, a motif-based lead that lands on
//   chord tones on strong beats, an arpeggiated second pulse, a bass line
//   and a drum pattern chosen by the mood's "feel".
// * A look-ahead SEQUENCER schedules notes ~120ms ahead of the audio clock.
// Every function no-ops before initAudio() and under Node.
// ============================================================

import { RNG, hash32 } from './rng.js';

let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
let pulse25 = null, pulse12 = null;
let soundOn = true, musicOn = true;

export function initAudio() {
    if (ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch { return; }
    master = ctx.createGain(); master.gain.value = soundOn ? 0.5 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let r = 0x1234567;
    for (let i = 0; i < d.length; i++) { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; d[i] = ((r >>> 0) / 4294967296) * 2 - 1; }
    pulse25 = pulseWave(0.25);
    pulse12 = pulseWave(0.125);
}

function pulseWave(duty) {
    // Fourier series of a pulse that is high for `duty` of the period
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
        re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
        im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    return ctx.createPeriodicWave(re, im);
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export const isSoundOn = () => soundOn;
export const isMusicOn = () => musicOn;
export function setSound(on) {
    soundOn = on;
    if (master) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.02);
}
export function setMusic(on) {
    musicOn = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.05);
}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function osc(type, f0, f1, dur, vol, when = 0, bus = sfxBus) {
    if (!ctx || !soundOn) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (type === 'p25') o.setPeriodicWave(pulse25);
    else if (type === 'p12') o.setPeriodicWave(pulse12);
    else o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, when = 0, type = 'lowpass', freq = 2000, bus = sfxBus) {
    if (!ctx || !soundOn) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, (t * 7.13) % 0.8); s.stop(t + dur + 0.02);
}

const arp = (notes, step, type = 'p25', vol = 0.12, len = step) => notes.forEach((m, i) => osc(type, mtof(m), mtof(m), len, vol, i * step));

// ------------------------------------------------------------ sound effects
export const sfx = {
    jump() { osc('p25', 330, 760, 0.12, 0.12); },
    dj() { osc('p12', 520, 1200, 0.12, 0.12); osc('p25', 780, 1560, 0.08, 0.06, 0.03); },
    walljump() { osc('p25', 420, 900, 0.1, 0.12); noise(0.05, 0.08, 0, 'highpass', 3000); },
    land() { noise(0.04, 0.06, 0, 'lowpass', 600); },
    spring() { osc('p25', 200, 1400, 0.25, 0.14); osc('triangle', 100, 500, 0.2, 0.2); },
    poundstart() { osc('p12', 800, 400, 0.1, 0.1); },
    pound() { noise(0.18, 0.3, 0, 'lowpass', 500); osc('triangle', 160, 50, 0.18, 0.3); },
    stomp() { osc('p25', 600, 1200, 0.06, 0.14); osc('p25', 900, 1800, 0.06, 0.1, 0.05); },
    kick() { osc('p25', 300, 150, 0.08, 0.14); noise(0.05, 0.1, 0, 'bandpass', 1500); },
    coin() { osc('p25', mtof(83), mtof(83), 0.06, 0.1); osc('p25', mtof(88), mtof(88), 0.22, 0.1, 0.06); },
    bump() { osc('triangle', 180, 90, 0.08, 0.25); },
    brick() { noise(0.2, 0.25, 0, 'lowpass', 1800); osc('p12', 300, 80, 0.15, 0.1); },
    sprout() { arp([60, 64, 67, 72, 76, 79], 0.04, 'p25', 0.1); },
    powerup() { arp([72, 76, 79, 84, 79, 84, 88, 91], 0.045, 'p25', 0.11); },
    oneup() { arp([76, 79, 88, 84, 86, 91], 0.09, 'p25', 0.12, 0.09); },
    hurt() { osc('p25', 700, 180, 0.3, 0.16); osc('p12', 350, 90, 0.3, 0.08); },
    pit() { osc('p25', 900, 120, 0.35, 0.12); },
    shieldpop() { noise(0.12, 0.15, 0, 'highpass', 3000); osc('p12', 1200, 500, 0.12, 0.1); },
    shot_pea() { osc('p12', 1100, 500, 0.06, 0.06); },
    shot_spread() { osc('p12', 900, 400, 0.07, 0.06); noise(0.04, 0.04, 0, 'highpass', 5000); },
    shot_frost() { osc('sine', 1800, 2600, 0.1, 0.07); osc('p12', 2400, 1600, 0.08, 0.03); },
    shot_rocket() { noise(0.25, 0.14, 0, 'bandpass', 900); osc('p25', 180, 90, 0.2, 0.08); },
    hit() { osc('p12', 500, 300, 0.05, 0.08); },
    tink() { osc('p12', 2200, 1800, 0.03, 0.04); },
    pop() { noise(0.1, 0.18, 0, 'lowpass', 2500); osc('p25', 700, 1400, 0.08, 0.09); },
    shatter() { noise(0.25, 0.2, 0, 'highpass', 2500); osc('p12', 2000, 800, 0.2, 0.06); },
    freeze() { osc('sine', 2400, 900, 0.25, 0.08); noise(0.2, 0.06, 0, 'highpass', 6000); },
    wobble() { osc('sine', 900, 520, 0.14, 0.05); osc('sine', 1350, 780, 0.1, 0.025, 0.02); },
    boom() { noise(0.4, 0.4, 0, 'lowpass', 700); osc('triangle', 140, 40, 0.35, 0.3); },
    crumble() { noise(0.5, 0.3, 0, 'lowpass', 900); noise(0.3, 0.2, 0.15, 'lowpass', 500); },
    secret() { arp([79, 78, 75, 69, 68, 76, 80, 84], 0.07, 'p25', 0.1); },
    checkpoint() { arp([72, 79, 84, 88], 0.07, 'p25', 0.12); },
    swap() { osc('p12', 700, 1100, 0.06, 0.08); },
    sizzle() { noise(0.3, 0.2, 0, 'highpass', 2500); },
    thud() { noise(0.25, 0.35, 0, 'lowpass', 400); osc('triangle', 90, 40, 0.25, 0.3); },
    bat() { osc('p12', 1400, 900, 0.12, 0.05); },
    tick() { osc('p12', 1500, 1500, 0.02, 0.05); },
    appear() { arp([60, 67, 72, 79, 84, 91], 0.05, 'p25', 0.1); },
    door() { noise(0.4, 0.3, 0, 'lowpass', 300); osc('triangle', 80, 50, 0.4, 0.3); },
    bossjump() { osc('triangle', 120, 260, 0.2, 0.25); },
    bosshit() { osc('p25', 300, 150, 0.08, 0.12); noise(0.06, 0.12, 0, 'bandpass', 2000); },
    rumble() { noise(0.7, 0.25, 0, 'lowpass', 250); },
    splash() { noise(0.35, 0.25, 0, 'bandpass', 1200); },
    eye() { osc('p25', 400, 1200, 0.3, 0.1); },
    crystal() { osc('sine', 2600, 1800, 0.12, 0.08); osc('sine', 3300, 2400, 0.12, 0.05, 0.03); },
    charge() { osc('sawtooth', 200, 1600, 0.8, 0.06); },
    thunder() { noise(0.8, 0.45, 0, 'lowpass', 1100); osc('triangle', 70, 30, 0.6, 0.3); },
    fireball() { noise(0.2, 0.15, 0, 'bandpass', 700); },
    roar() { osc('sawtooth', 160, 80, 0.6, 0.15); noise(0.5, 0.2, 0, 'lowpass', 600); },
    menu() { osc('p12', 1200, 1200, 0.03, 0.07); },
    select() { osc('p25', 880, 880, 0.05, 0.1); osc('p25', 1320, 1320, 0.08, 0.1, 0.05); },
    pause() { arp([76, 72, 76, 72], 0.06, 'p25', 0.1); },
    deny() { osc('p25', 150, 130, 0.15, 0.12); },
};

export function play(name) { const f = sfx[name]; if (f) f(); }

// ------------------------------------------------------------ jingles (fixed)
export const jingle = {
    clear() { stopMusic(); const m = [67, 72, 76, 79, 84, 88, 91, 88, 0, 80, 84, 87, 92, 87, 0, 82, 86, 89, 94, 94, 94, 96]; m.forEach((n, i) => n && osc('p25', mtof(n), mtof(n), 0.12, 0.11, i * 0.09, musicBus)); [48, 55, 60, 56, 63, 68, 58, 65, 70].forEach((n, i) => osc('triangle', mtof(n), mtof(n), 0.25, 0.3, i * 0.22, musicBus)); },
    die() { stopMusic(); [71, 77, 0, 77, 77, 76, 74, 72, 64, 0, 64, 60].forEach((n, i) => n && osc('p25', mtof(n), mtof(n), 0.13, 0.12, 0.25 + i * 0.13, musicBus)); },
    gameover() { stopMusic(); [72, 67, 64, 69, 71, 69, 68, 70, 68, 67, 65, 67].forEach((n, i) => osc('triangle', mtof(n - 12), mtof(n - 12), 0.3, 0.3, i * 0.25, musicBus)); },
    gadget() { stopMusic(); const m = [60, 64, 67, 72, 0, 71, 72, 74, 76, 0, 79, 84]; m.forEach((n, i) => n && osc('p25', mtof(n), mtof(n), 0.18, 0.12, i * 0.16, musicBus)); m.forEach((n, i) => n && osc('p12', mtof(n - 5), mtof(n - 5), 0.18, 0.07, i * 0.16, musicBus)); [36, 43, 48, 43].forEach((n, i) => osc('triangle', mtof(n), mtof(n), 0.5, 0.3, i * 0.48, musicBus)); },
    shard() { [84, 88, 91, 96, 91, 96, 100].forEach((n, i) => osc('p25', mtof(n), mtof(n), 0.1, 0.1, i * 0.06)); },
    start() { [72, 76, 79, 76, 79, 84].forEach((n, i) => osc('p25', mtof(n), mtof(n), 0.1, 0.1, i * 0.08, musicBus)); },
};

// ------------------------------------------------------------ composer
const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygianDom: [0, 1, 4, 5, 7, 8, 10],
};
const PROGS = {
    major: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4], [0, 3, 0, 4], [5, 3, 0, 4]],
    minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 5, 6, 4]],
    dorian: [[0, 3, 0, 3], [0, 6, 3, 4], [0, 1, 3, 0]],
    lydian: [[0, 1, 0, 1], [0, 1, 4, 3], [0, 4, 1, 5]],
    mixolydian: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 4, 6, 3]],
    phrygianDom: [[0, 1, 0, 6], [0, 1, 6, 5], [0, 5, 1, 0]],
};
const RHYTHMS = [
    [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
    [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0],
];

/** Write a song. Returns { bpm, bars: [{ lead[16], arp[16], bass[16], drums[16] }] } (MIDI numbers, 0 = rest, -1 = hold). */
export function compose(seed, mood) {
    const r = new RNG(seed);
    const scale = MODES[mood.mode] || MODES.major;
    const root = mood.root + r.int(-1, 1);
    const deg = (d, oct = 0) => {
        const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
        return root + scale[i] + 12 * (o + oct);
    };
    const pool = PROGS[mood.mode] || PROGS.major;
    const progA = r.pick(pool);
    let progB = r.pick(pool);
    if (progB === progA) progB = [progA[2], progA[3], progA[0], progA[1]];

    const phrase = (chord, rhythm, start) => {
        const notes = new Array(16).fill(0);
        let d = start;
        for (let s = 0; s < 16; s++) {
            if (!rhythm[s]) { notes[s] = s > 0 && notes[s - 1] !== 0 && r.chance(0.6) ? -1 : 0; continue; }
            if (s % 4 === 0) {
                // strong beat: nearest chord tone
                const tones = [chord, chord + 2, chord + 4, chord + 7];
                let best = tones[0];
                for (const t of tones) if (Math.abs(t - d) < Math.abs(best - d)) best = t;
                d = best;
            } else {
                d += r.weighted([[1, 3], [-1, 3], [2, 2], [-2, 2], [0, 1], [3, 1], [-3, 1]]);
            }
            d = Math.max(5, Math.min(15, d));
            notes[s] = deg(d, 0);
        }
        return { notes, end: d };
    };

    const makeSection = (prog) => {
        const rhythm = r.pick(RHYTHMS);
        const rhythm2 = r.pick(RHYTHMS);
        const bars = [];
        const m1 = phrase(prog[0], rhythm, 7 + prog[0] % 3);
        bars.push(m1.notes);
        // bar 2: the same motif moved to the next chord
        const shift = prog[1] - prog[0];
        bars.push(m1.notes.map(n => (n > 0 ? n + (scale[((shift % 7) + 7) % 7] || 0) - (shift < 0 ? 12 : 0) : n)).map(n => (n > 0 && n > root + 28 ? n - 12 : n)));
        bars.push(phrase(prog[2], rhythm2, m1.end).notes);
        // cadence: hold the chord root
        const last = phrase(prog[3], [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], m1.end).notes;
        last[8] = deg(prog[3] + 7, 0); for (let s = 9; s < 16; s++) last[s] = s < 14 ? -1 : 0;
        bars.push(last);
        return bars.map((lead, i) => ({ lead, chord: prog[i] }));
    };
    const A = makeSection(progA), B = makeSection(progB);
    const form = [...A, ...A, ...B, ...A];

    const feel = mood.feel || 'bounce';
    const out = form.map(({ lead, chord }, bi) => {
        const triad = [deg(chord, 0), deg(chord + 2, 0), deg(chord + 4, 0)];
        const arpLine = new Array(16).fill(0), bass = new Array(16).fill(0), drums = new Array(16).fill(0);
        const b0 = deg(chord, -2), b5 = deg(chord + 4, -2);
        for (let s = 0; s < 16; s++) {
            if (feel === 'bounce') { arpLine[s] = s % 2 === 0 ? triad[(s >> 1) % 3] - 12 : 0; bass[s] = s % 4 === 0 ? b0 : s % 4 === 2 ? (s % 8 === 2 ? b5 : b0 + 12) : 0; }
            else if (feel === 'swing') { arpLine[s] = (s % 4 === 2) ? triad[(s >> 2) % 3] - 12 : 0; bass[s] = s % 4 === 0 ? (s % 8 === 0 ? b0 : b5) : s % 4 === 3 ? b0 : 0; }
            else if (feel === 'drive') { arpLine[s] = triad[s % 3] - 12; bass[s] = s % 2 === 0 ? (s % 8 === 6 ? b5 : b0) : 0; }
            else { arpLine[s] = s % 4 === 0 ? triad[(s >> 2) % 3] - 12 : 0; bass[s] = s % 8 === 0 ? b0 : s % 8 === 4 ? b5 : 0; }
            // drums: 1 kick, 2 snare, 3 hat
            if (s % 8 === 0 || (feel === 'drive' && s % 8 === 3) || (feel === 'bounce' && s === 10)) drums[s] = 1;
            else if (s % 8 === 4) drums[s] = 2;
            else if (s % 2 === 0 || feel === 'drive') drums[s] = 3;
        }
        if (bi % 4 === 3) { drums[14] = 2; drums[15] = 2; }
        return { lead, arp: arpLine, bass, drums };
    });
    return { bpm: mood.bpm, bars: out };
}

// ------------------------------------------------------------ sequencer
let song = null, songName = '', stepIdx = 0, nextT = 0, stepDur = 0.125;

export function playSong(name, s) {
    if (!ctx) return;
    if (songName === name && song) return;
    song = s; songName = name; stepIdx = 0;
    stepDur = 60 / s.bpm / 4;
    nextT = ctx.currentTime + 0.08;
}
export function stopMusic() { song = null; songName = ''; }
export const currentSong = () => songName;

function note(type, m, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (type === 'p25') o.setPeriodicWave(pulse25);
    else if (type === 'p12') o.setPeriodicWave(pulse12);
    else o.type = type;
    o.frequency.setValueAtTime(mtof(m), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.02, 0.05);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.92, 0.015);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.08);
}

function drum(kind, t) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === 1) { f.type = 'lowpass'; f.frequency.value = 300; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.1); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(og); og.connect(musicBus); o.start(t); o.stop(t + 0.14); }
    else if (kind === 2) { f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13); }
    else { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); }
    s.connect(f); f.connect(g); g.connect(musicBus);
    s.start(t, (stepIdx * 0.137) % 0.8); s.stop(t + 0.16);
}

/** Call every frame: schedules whatever falls inside the look-ahead window. */
export function musicTick() {
    if (!ctx || !song) return;
    if (ctx.currentTime - nextT > 0.3) nextT = ctx.currentTime + 0.05;   // resumed after a stall
    while (nextT < ctx.currentTime + 0.12) {
        if (musicOn && soundOn) {
            const bars = song.bars;
            const bar = bars[Math.floor(stepIdx / 16) % bars.length];
            const s = stepIdx % 16;
            const len = (line, i) => { let n = 1; while (i + n < 16 && line[i + n] === -1) n++; return n * stepDur; };
            if (bar.lead[s] > 0) note('p25', bar.lead[s], nextT, len(bar.lead, s), 0.13);
            if (bar.arp[s] > 0) note('p12', bar.arp[s], nextT, stepDur * 0.9, 0.05);
            if (bar.bass[s] > 0) note('triangle', bar.bass[s], nextT, stepDur * 1.8, 0.34);
            if (bar.drums[s]) drum(bar.drums[s], nextT);
        }
        nextT += stepDur;
        stepIdx++;
    }
}

// ------------------------------------------------------------ the game's songs
const cache = new Map();
export function songFor(name, mood, seed = 0) {
    const key = name + ':' + seed;
    if (!cache.has(key)) cache.set(key, compose(hash32(name, seed), mood));
    return cache.get(key);
}
export const MOODS = {
    title: { root: 60, mode: 'major', bpm: 132, feel: 'bounce' },
    map: { root: 65, mode: 'mixolydian', bpm: 108, feel: 'swing' },
    castle: { root: 57, mode: 'minor', bpm: 140, feel: 'drive' },
    boss: { root: 52, mode: 'phrygianDom', bpm: 164, feel: 'drive' },
    star: { root: 67, mode: 'major', bpm: 196, feel: 'drive' },
    ending: { root: 62, mode: 'lydian', bpm: 100, feel: 'straight' },
};
