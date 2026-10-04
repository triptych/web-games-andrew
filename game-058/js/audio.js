/**
 * audio.js — Web Audio sound effects and a light generative tune.
 * Nothing loads from files. initAudio() must run from a user gesture.
 */

let ctx = null, master = null, sfxBus = null, musicBus = null, verb = null;
let soundOn = true, musicOn = true;
let buzz = null;
let musicTimer = null, nextBar = 0, bar = 0;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = soundOn ? 0.55 : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 0.22 : 0;
    musicBus.connect(master);
    // A short, soft reverb for plucks and chimes.
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    verb.connect(wet);
    wet.connect(master);
    startMusic();
}

/** Pause all audio while the tab is hidden. */
export function setHidden(hidden) {
    if (!ctx) return;
    if (hidden) ctx.suspend(); else ctx.resume();
}

export function setSound(on) {
    soundOn = on;
    if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
    if (!on) stopBuzz();
}
export function setMusic(on) {
    musicOn = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.2);
}

// ------------------------------------------------------------
// Primitives
// ------------------------------------------------------------

function tone({ type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.3, at = 0, attack = 0.005, bus = null, wet = false, detune = 0 }) {
    if (!ctx || (!soundOn && !bus)) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? sfxBus);
    if (wet && verb) g.connect(verb);
    o.start(t);
    o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.2, at = 0, freq = 1200, q = 0.8, type = 'bandpass', f2 = null, bus = null }) {
    if (!ctx || (!soundOn && !bus)) return;
    const t = ctx.currentTime + at;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(freq, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(bus ?? sfxBus);
    src.start(t);
}

/** Marimba-ish note: sine plus a quick high partial. */
function mallet(f, at = 0, vol = 0.25, bus = null) {
    tone({ f, dur: 0.45, vol, at, bus, wet: true });
    tone({ f: f * 4, dur: 0.06, vol: vol * 0.25, at, bus });
    tone({ type: 'triangle', f: f * 2, dur: 0.2, vol: vol * 0.2, at, bus });
}

const PENTA = [0, 2, 4, 7, 9];
function scaleNote(i, base = 523.25) {
    const oct = Math.floor(i / 5), deg = PENTA[((i % 5) + 5) % 5];
    return base * Math.pow(2, oct + deg / 12);
}

// ------------------------------------------------------------
// Effects
// ------------------------------------------------------------

export function sfxHop(i) { mallet(scaleNote(i, 392)); }
export function sfxUndo() { tone({ type: 'triangle', f: 330, f2: 220, dur: 0.12, vol: 0.15 }); }
export function sfxNope() { tone({ type: 'square', f: 150, f2: 110, dur: 0.12, vol: 0.06 }); noise({ dur: 0.08, vol: 0.05, freq: 400 }); }
export function sfxPop(i, n) {
    const f = 500 + Math.min(i, 20) * 45;
    tone({ f: f * 1.6, f2: f * 0.6, dur: 0.11, vol: 0.18 });
    if (i === n - 1 && n >= 5) mallet(scaleNote(Math.min(n, 14), 523), 0.05, 0.18);
}
export function sfxLand() { noise({ dur: 0.07, vol: 0.12, freq: 700, q: 1.5 }); tone({ f: 140, f2: 90, dur: 0.08, vol: 0.12 }); }
export function sfxDrop() { tone({ f: 900, f2: 1300, dur: 0.05, vol: 0.03 }); }
export function sfxJar() { [0, 2, 4, 7, 9, 12].forEach((d, i) => mallet(784 * Math.pow(2, d / 12), i * 0.06, 0.16)); }
export function sfxArm() { tone({ type: 'triangle', f: 660, f2: 990, dur: 0.15, vol: 0.15, wet: true }); }
export function sfxHoney() { tone({ type: 'sine', f: 300, f2: 120, dur: 0.5, vol: 0.25 }); noise({ dur: 0.4, vol: 0.12, freq: 600, f2: 200, type: 'lowpass' }); }
export function sfxPaint() { noise({ dur: 0.3, vol: 0.25, freq: 2500, f2: 500, q: 1.2 }); tone({ f: 600, f2: 1200, dur: 0.18, vol: 0.12, wet: true }); }
export function sfxBomb() { tone({ f: 160, f2: 40, dur: 0.5, vol: 0.45 }); noise({ dur: 0.45, vol: 0.3, freq: 900, f2: 120, type: 'lowpass' }); }
export function sfxRainbow() { for (let i = 0; i < 10; i++) mallet(scaleNote(i, 523), i * 0.04, 0.12); }
export function sfxGolden() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 1.0, vol: 0.12, at: i * 0.02, wet: true })); tone({ f: 2093, dur: 0.6, vol: 0.06, at: 0.1, wet: true }); }
export function sfxLeaf() { noise({ dur: 0.25, vol: 0.18, freq: 3000, f2: 1200, q: 0.6 }); }
export function sfxThaw() { [2400, 3100, 1900].forEach((f, i) => tone({ f, dur: 0.12, vol: 0.06, at: i * 0.04 })); noise({ dur: 0.18, vol: 0.12, freq: 5000, q: 0.7 }); }
export function sfxShuffle() { for (let i = 0; i < 6; i++) tone({ type: 'triangle', f: 400 + i * 80, dur: 0.08, vol: 0.08, at: i * 0.05 }); }
export function sfxClick() { tone({ type: 'triangle', f: 880, dur: 0.06, vol: 0.12 }); }
export function sfxStar(i) { mallet(scaleNote(5 + i * 2, 523), 0, 0.22); }
export function sfxWin() { [0, 2, 4, 5, 7, 9, 12].forEach((d, i) => mallet(523.25 * Math.pow(2, d / 12), i * 0.09, 0.2)); }
export function sfxLose() { [7, 4, 2, 0].forEach((d, i) => tone({ type: 'triangle', f: 392 * Math.pow(2, d / 12), dur: 0.35, vol: 0.15, at: i * 0.18 })); }
export function sfxBasket() { sfxJar(); }
export function sfxSense() { [0, 4, 7, 12, 16].forEach((d, i) => mallet(392 * Math.pow(2, d / 12), i * 0.1, 0.2)); }

/** Continuous buzz while a trail is being drawn. */
export function startBuzz() {
    if (!ctx || !soundOn || buzz) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 170;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 9;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 650;
    flt.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.045, ctx.currentTime, 0.05);
    o.connect(flt); flt.connect(g); g.connect(sfxBus);
    o.start(); lfo.start();
    buzz = { o, lfo, g, flt };
}
export function buzzPitch(n) {
    if (!buzz) return;
    buzz.o.frequency.setTargetAtTime(170 + Math.min(n, 16) * 12, ctx.currentTime, 0.05);
    buzz.flt.frequency.setTargetAtTime(650 + Math.min(n, 16) * 60, ctx.currentTime, 0.05);
}
export function stopBuzz() {
    if (!buzz) return;
    const b = buzz;
    buzz = null;
    b.g.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    b.o.stop(ctx.currentTime + 0.3);
    b.lfo.stop(ctx.currentTime + 0.3);
}

// ------------------------------------------------------------
// Music: plucked ukulele-ish chords over I–V–vi–IV, bass, shaker
// ------------------------------------------------------------

const BPM = 96;
const BEAT = 60 / BPM;
const PROG = [
    [0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12],
    [0, 4, 7], [7, 11, 14], [5, 9, 12], [7, 11, 14],
];
const ROOT = 261.63;

function pluck(f, at, vol = 0.12) {
    if (!ctx) return;
    const t = at;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sawtooth';
    o.frequency.value = f; o2.frequency.value = f * 1.002;
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(3200, t);
    flt.frequency.exponentialRampToValueAtTime(600, t + 0.3);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g); g.connect(musicBus);
    if (verb) g.connect(verb);
    o.start(t); o2.start(t); o.stop(t + 0.8); o2.stop(t + 0.8);
}

function scheduleBar(t0) {
    const chord = PROG[bar % PROG.length];
    // Strum pattern: down, down-up, up-down-up
    const strums = [0, 1, 1.5, 2.5, 3, 3.5];
    strums.forEach((b, si) => {
        const up = si % 2 === 1;
        const notes = up ? [...chord].reverse() : chord;
        notes.forEach((n, i) => pluck(ROOT * Math.pow(2, n / 12), t0 + b * BEAT + i * 0.012, si === 0 ? 0.11 : 0.07));
    });
    // Bass on 1 and 3
    const bassF = ROOT / 2 * Math.pow(2, chord[0] / 12);
    for (const b of [0, 2]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = bassF;
        const t = t0 + b * BEAT;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 1.6);
        o.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + BEAT * 1.7);
    }
    // Shaker on eighths
    for (let i = 0; i < 8; i++) noise({ dur: 0.05, vol: i % 2 ? 0.05 : 0.08, at: t0 - ctx.currentTime + i * BEAT / 2, freq: 7000, q: 1, type: 'highpass', bus: musicBus });
    // Little melody every other bar
    if (bar % 2 === 1) {
        const mel = [chord[2] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24];
        mel.forEach((n, i) => {
            if (Math.random() < 0.25) return;
            const t = t0 + (i * 0.75 + 0.5) * BEAT;
            const f = ROOT * Math.pow(2, n / 12);
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            o.connect(g); g.connect(musicBus); if (verb) g.connect(verb);
            o.start(t); o.stop(t + 0.55);
        });
    }
    bar++;
}

function startMusic() {
    if (!ctx || musicTimer) return;
    nextBar = ctx.currentTime + 0.3;
    musicTimer = setInterval(() => {
        if (!ctx || ctx.state !== 'running') return;
        if (!musicOn) { nextBar = ctx.currentTime + 0.2; return; }
        while (nextBar < ctx.currentTime + 0.6) {
            scheduleBar(nextBar);
            nextBar += BEAT * 4;
        }
    }, 120);
}
