// audio.js — every sound is synthesised with Web Audio: surf and gulls, wooden
// creaks, cannon fire, a ship's bell for check, a stinger per sea event, and a
// jaunty original shanty in D dorian on a squeezebox, bass and tambourine.

let ctx = null, master, sfxBus, musicBus, ambBus, noiseBuf = null;
let soundOn = true, musicOn = true;
let musicTimer = null, nextNoteTime = 0, step = 0;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.9 : 0; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = soundOn ? 0.5 : 0; ambBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.22 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbience();
    if (musicOn) startMusic();
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });
}

export function setSound(on) {
    soundOn = on;
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
    ambBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.2);
}
export function setMusic(on) {
    musicOn = on;
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.2);
    if (on) startMusic();
}
export const soundEnabled = () => soundOn;
export const musicEnabled = () => musicOn;

// ------------------------------------------------------------------ building blocks
const now = () => (ctx ? ctx.currentTime : 0);

function env(g, t, a, peak, dec, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + dec);
}

function tone(type, f0, f1, dur, vol, { t = now(), bus = sfxBus, attack = 0.005, filter = null, detune = 0 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.detune.value = detune;
    env(g, t, attack, vol, dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; f.Q.value = filter.q ?? 0.7; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + attack + dur + 0.05);
}

function noise(dur, vol, { t = now(), bus = sfxBus, type = 'lowpass', f = 1000, f1 = f, q = 0.7, attack = 0.005 } = {}) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f1 !== f) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    env(g, t, attack, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
}

// ------------------------------------------------------------------ ambience
function startAmbience() {
    // Surf: noise through a slowly breathing low-pass.
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.16;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(f.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13;
    const lg2 = ctx.createGain(); lg2.gain.value = 0.08;
    lfo2.connect(lg2); lg2.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(ambBus);
    s.start(); lfo.start(); lfo2.start();
    const gull = () => {
        if (ctx && !document.hidden && soundOn) {
            const t = now();
            const n = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                tone('triangle', 1500 + Math.random() * 300, 900, 0.22, 0.03, { t: t + i * 0.26, bus: ambBus, attack: 0.02 });
                tone('sine', 2400, 1600, 0.16, 0.012, { t: t + i * 0.26, bus: ambBus, attack: 0.02 });
            }
        }
        setTimeout(gull, 7000 + Math.random() * 12000);
    };
    setTimeout(gull, 4000);
}

// ------------------------------------------------------------------ effects
const sfxRaw = {
    click() { tone('sine', 880, 660, 0.06, 0.12); },
    select() { tone('triangle', 520, 780, 0.08, 0.12); tone('sine', 1040, 1040, 0.08, 0.04, { t: now() + 0.03 }); },
    deny() { tone('square', 200, 150, 0.12, 0.05, { filter: { type: 'lowpass', f: 900 } }); },
    creak() {
        if (!ctx) return;
        const t = now();
        tone('sawtooth', 110 + Math.random() * 30, 80, 0.32, 0.05, { t, filter: { type: 'bandpass', f: 600, q: 6 }, attack: 0.05 });
        noise(0.25, 0.05, { t: t + 0.1, type: 'bandpass', f: 900, f1: 500, q: 1.5, attack: 0.05 });
    },
    splash() { noise(0.6, 0.22, { type: 'highpass', f: 1800, f1: 600, attack: 0.01 }); noise(0.4, 0.15, { type: 'lowpass', f: 600, attack: 0.01 }); },
    cannon() {
        if (!ctx) return;
        const t = now();
        tone('sine', 120, 32, 0.6, 0.6, { t });
        noise(0.5, 0.45, { t, type: 'lowpass', f: 2200, f1: 200 });
        noise(0.08, 0.3, { t, type: 'highpass', f: 3000 });
    },
    hit() { noise(0.5, 0.3, { type: 'lowpass', f: 1500, f1: 300 }); tone('triangle', 200, 60, 0.3, 0.2); this.splash(); },
    bell() {
        if (!ctx) return;
        const t = now();
        for (const [r, v] of [[1, 0.2], [2.76, 0.08], [5.4, 0.05], [8.9, 0.02]]) tone('sine', 660 * r, 660 * r, 1.8 / Math.sqrt(r), v, { t });
        for (const [r, v] of [[1, 0.14], [2.76, 0.05]]) tone('sine', 660 * r, 660 * r, 1.4, v, { t: t + 0.35 });
    },
    promote() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.25, 0.1, { t: now() + i * 0.07 })); },
    sting(good) {
        const notes = good === false ? [294, 277, 262, 220] : good === true ? [392, 494, 587, 784] : [294, 370, 440, 587];
        notes.forEach((f, i) => tone('square', f, f, 0.22, 0.05, { t: now() + i * 0.09, filter: { type: 'lowpass', f: 1800 } }));
    },
    kraken() {
        if (!ctx) return;
        const t = now();
        tone('sawtooth', 58, 42, 2.2, 0.32, { t, attack: 0.4, filter: { type: 'lowpass', f: 320, q: 4 } });
        tone('sawtooth', 87, 61, 2.0, 0.18, { t: t + 0.1, attack: 0.4, filter: { type: 'lowpass', f: 400, q: 3 }, detune: 12 });
        noise(2.2, 0.18, { t, type: 'lowpass', f: 300, f1: 900, attack: 0.5 });
    },
    mermaid() {
        if (!ctx) return;
        const t = now();
        const scale = [587, 659, 784, 880, 988, 1175, 1319, 1568];
        scale.forEach((f, i) => tone('triangle', f, f, 0.9, 0.07, { t: t + i * 0.07, attack: 0.003 }));
        [784, 988, 1175].forEach((f, i) => tone('sine', f, f, 1.6, 0.05, { t: t + 0.8 + i * 0.25, attack: 0.15 }));
    },
    storm() { noise(4.5, 0.22, { type: 'bandpass', f: 300, f1: 1400, q: 1.2, attack: 1.2 }); },
    thunder() {
        if (!ctx) return;
        const t = now();
        noise(0.15, 0.4, { t, type: 'highpass', f: 1500 });
        noise(2.6, 0.5, { t: t + 0.05, type: 'lowpass', f: 900, f1: 80, attack: 0.02 });
    },
    whirl() { noise(2.4, 0.25, { type: 'bandpass', f: 200, f1: 1600, q: 3, attack: 0.5 }); tone('sine', 90, 45, 2.4, 0.2, { attack: 0.5 }); },
    dolphin() {
        if (!ctx) return;
        const t = now();
        for (let i = 0; i < 6; i++) tone('sine', 1800 + Math.random() * 1500, 3500 + Math.random() * 1500, 0.09, 0.05, { t: t + i * 0.13 });
        for (let i = 0; i < 10; i++) noise(0.01, 0.12, { t: t + 0.9 + i * 0.03, type: 'highpass', f: 3000 });
    },
    ghost() {
        if (!ctx) return;
        const t = now();
        for (const f of [220, 261.6, 329.6, 207.7]) {
            const o = ctx.createOscillator(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f;
            v.frequency.value = 5 + Math.random(); vg.gain.value = f * 0.012;
            v.connect(vg); vg.connect(o.frequency);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
            o.connect(g); g.connect(sfxBus);
            o.start(t); v.start(t); o.stop(t + 3.7); v.stop(t + 3.7);
        }
        noise(3.2, 0.06, { t, type: 'bandpass', f: 800, f1: 400, q: 2, attack: 1 });
    },
    salvage() {
        if (!ctx) return;
        const t = now();
        for (let i = 0; i < 14; i++) tone('sine', 300 + Math.random() * 500, 900 + Math.random() * 600, 0.06, 0.06, { t: t + i * 0.07 + Math.random() * 0.04 });
        [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.5, 0.07, { t: t + 1.6 + i * 0.09 }));
    },
    serpent() { noise(1.4, 0.18, { type: 'highpass', f: 4000, f1: 2500, attack: 0.2 }); tone('sawtooth', 70, 110, 2.5, 0.12, { attack: 0.4, filter: { type: 'lowpass', f: 300 } }); },
    win() { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.28, 0.07, { t: now() + i * 0.14, filter: { type: 'lowpass', f: 2400 } })); },
    lose() { [392, 370, 349, 294].forEach((f, i) => tone('triangle', f, f * 0.98, 0.45, 0.1, { t: now() + i * 0.3 })); },
};

// Every effect is a no-op until the first gesture has created the AudioContext.
export const sfx = {};
for (const [k, fn] of Object.entries(sfxRaw)) {
    sfx[k] = (...a) => { if (!ctx) return; try { fn.apply(sfxRaw, a); } catch (e) { console.warn('[audio]', k, e); } };
}

// ------------------------------------------------------------------ the shanty
// An original tune, D dorian, 6/8. [midi, eighths]; 0 = rest.
const MEL = [
    [69, 2], [74, 1], [74, 2], [76, 1], [77, 2], [76, 1], [74, 2], [72, 1], [69, 2], [67, 1], [65, 2], [67, 1], [69, 2], [62, 1], [62, 3],
    [69, 2], [74, 1], [74, 2], [76, 1], [77, 2], [76, 1], [74, 2], [76, 1], [72, 2], [69, 1], [67, 2], [64, 1], [62, 5], [0, 1],
    [77, 2], [77, 1], [76, 2], [74, 1], [72, 2], [69, 1], [72, 3], [74, 2], [72, 1], [69, 2], [67, 1], [69, 6],
    [77, 2], [77, 1], [76, 2], [74, 1], [72, 2], [69, 1], [67, 2], [69, 1], [65, 2], [67, 1], [69, 2], [64, 1], [62, 6],
];
const BASS = [50, 50, 48, 50, 50, 50, 48, 50, 53, 48, 50, 45, 53, 48, 43, 50]; // one root per bar
const EIGHTH = 60 / 112 / 2 * 1.5 / 1.5; // ~112 dotted-quarter feel → eighth ≈ 0.27 s

const melSteps = [];
{
    let pos = 0;
    for (const [n, len] of MEL) { melSteps.push({ at: pos, n, len }); pos += len; }
}
const LOOP = 16 * 6;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function squeeze(m, t, len) {
    const f = mtof(m), dur = len * EIGHTH * 0.92;
    for (const det of [-7, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
        o.type = 'square'; o.frequency.value = f; o.detune.value = det;
        fl.type = 'lowpass'; fl.frequency.value = 1700; fl.Q.value = 1;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
        g.gain.setValueAtTime(0.08, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + dur + 0.02);
    }
}

function scheduleStep(i, t) {
    const pos = i % LOOP;
    const mel = melSteps.find((s) => s.at === pos);
    if (mel && mel.n) squeeze(mel.n, t, mel.len);
    const bar = Math.floor(pos / 6), beat = pos % 6;
    if (beat === 0 || beat === 3) {
        const root = BASS[bar] + (beat === 3 ? 7 : 0) - 12;
        tone('triangle', mtof(root), mtof(root), EIGHTH * 2.4, 0.22, { t, bus: musicBus, attack: 0.01 });
    }
    if (beat === 2 || beat === 5) noise(0.08, 0.05, { t, bus: musicBus, type: 'highpass', f: 6000 });
    if (beat === 0) noise(0.12, 0.06, { t, bus: musicBus, type: 'lowpass', f: 180 });
}

function startMusic() {
    if (!ctx || musicTimer) return;
    nextNoteTime = now() + 0.1;
    musicTimer = setInterval(() => {
        if (!musicOn || !ctx || ctx.state !== 'running') { nextNoteTime = Math.max(nextNoteTime, ctx ? now() + 0.05 : 0); return; }
        while (nextNoteTime < now() + 0.25) {
            scheduleStep(step++, nextNoteTime);
            nextNoteTime += EIGHTH;
        }
    }, 40);
}
