/**
 * audio.js — every sound in Worldroot is synthesised with Web Audio.
 *
 * Effects: glassy chimes on touch (a pentatonic step that climbs while you keep
 * clicking), woody plucks for spirits, arpeggios for upgrades, a warm swell for
 * Nourish, a big bloom chord for a new stage, bells for wisps.
 * Music: a slow generative score — a pad on a four-chord loop, plucked
 * pentatonic notes through a long reverb, a soft bass, and night ambience
 * (crickets in summer, wind in winter). The key moves with the seasons.
 */

let ctx = null, master = null, sfxBus = null, musicBus = null, reverb = null, ambBus = null;
let soundOn = true, musicOn = true, volume = 0.7;
let started = false;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.4);
    const revGain = ctx.createGain(); revGain.gain.value = 0.55;
    reverb.connect(revGain).connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.9 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = musicOn ? 0.35 : 0; ambBus.connect(master);
    startMusic();
}

function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
}

export function setSound(on) { soundOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); }
export function setMusic(on) {
    musicOn = on;
    if (musicBus) { musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.3); ambBus.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.3); }
}
export function setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }

// ------------------------------------------------------------------ voices
function tone({ f, type = 'sine', t = 0, dur = 0.4, vol = 0.2, attack = 0.005, bus = sfxBus, rev = 0.4, glide = 0, detune = 0 }) {
    if (!ctx || !bus) return;
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glide), now + dur);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(bus);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s).connect(reverb); }
    o.start(now);
    o.stop(now + dur + 0.05);
}

/** A bell: a few inharmonic partials. */
function bell(f, t = 0, vol = 0.12, dur = 1.6, bus = sfxBus) {
    tone({ f, t, dur, vol, bus, rev: 0.6 });
    tone({ f: f * 2.76, t, dur: dur * 0.5, vol: vol * 0.35, bus, rev: 0.6 });
    tone({ f: f * 5.4, t, dur: dur * 0.25, vol: vol * 0.15, bus, rev: 0.6 });
}

function noise(dur, { t = 0, vol = 0.1, freq = 1200, q = 0.8, type = 'bandpass', bus = sfxBus, sweep = 0 } = {}) {
    if (!ctx) return;
    const now = ctx.currentTime + t;
    const n = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(freq, now); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(freq * sweep, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(fl).connect(g).connect(bus);
    const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s).connect(reverb);
    src.start(now);
    src.stop(now + dur + 0.05);
}

// pentatonic over the current season's root
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const ROOTS = [62, 65, 60, 57];   // spring D, summer F, autumn C, winter A
let season = 0;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function setSeason(s) { season = s; }

let clickStep = 0, lastClick = 0;
export const sfx = {
    click(big = false) {
        if (!ctx) return;
        const now = performance.now();
        clickStep = now - lastClick < 450 ? (clickStep + 1) % 8 : 0;
        lastClick = now;
        const m = ROOTS[season] + 12 + PENTA[clickStep + (big ? 2 : 0)];
        tone({ f: midi(m), type: 'triangle', dur: 0.35, vol: 0.09, rev: 0.5 });
        tone({ f: midi(m + 12), dur: 0.2, vol: 0.035, rev: 0.5, t: 0.01 });
    },
    buy(tier = 0) {
        const m = ROOTS[season] + PENTA[(tier % 6) + 2];
        tone({ f: midi(m), type: 'triangle', dur: 0.25, vol: 0.12, rev: 0.25, glide: 0.995 });
        tone({ f: midi(m + 7), type: 'sine', t: 0.05, dur: 0.3, vol: 0.06, rev: 0.4 });
        noise(0.05, { vol: 0.04, freq: 2200, q: 2 });
    },
    milestone() { [0, 4, 7, 12, 16].forEach((k, i) => bell(midi(ROOTS[season] + 12 + k), i * 0.07, 0.07, 1.4)); },
    upgrade() { [0, 4, 7, 11, 14].forEach((k, i) => tone({ f: midi(ROOTS[season] + 12 + k), type: 'triangle', t: i * 0.05, dur: 0.5, vol: 0.07, rev: 0.6 })); },
    nourish() {
        const r = ROOTS[season] - 12;
        tone({ f: midi(r), type: 'sine', dur: 1.2, vol: 0.16, attack: 0.08, rev: 0.5 });
        tone({ f: midi(r + 7), type: 'triangle', dur: 1.0, vol: 0.06, attack: 0.1, rev: 0.6 });
        bell(midi(r + 31), 0.12, 0.05, 1.2);
        noise(0.6, { vol: 0.04, freq: 500, sweep: 3, type: 'lowpass' });
    },
    stage() {
        const r = ROOTS[season];
        [0, 7, 12, 16, 19, 24].forEach((k, i) => tone({ f: midi(r - 12 + k), type: i < 2 ? 'sine' : 'triangle', t: i * 0.09, dur: 3.2, vol: 0.09, attack: 0.15, rev: 0.8 }));
        [24, 28, 31, 36].forEach((k, i) => bell(midi(r + k), 0.6 + i * 0.12, 0.06, 2.4));
        noise(2.4, { vol: 0.05, freq: 300, sweep: 8, type: 'lowpass' });
    },
    wispAppear() { [31, 36, 40].forEach((k, i) => bell(midi(ROOTS[season] + k), i * 0.12, 0.05, 1.2)); },
    wispCatch() {
        const r = ROOTS[season] + 12;
        [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => tone({ f: midi(r + k), type: 'triangle', t: i * 0.035, dur: 0.6, vol: 0.07, rev: 0.7 }));
        noise(0.5, { vol: 0.05, freq: 4000, sweep: 0.3 });
    },
    wispMiss() { [7, 4, 0].forEach((k, i) => tone({ f: midi(ROOTS[season] + 12 + k), t: i * 0.12, dur: 0.5, vol: 0.04, rev: 0.6 })); },
    spell() {
        noise(0.9, { vol: 0.08, freq: 400, sweep: 10 });
        [0, 7, 12, 19].forEach((k, i) => tone({ f: midi(ROOTS[season] + k), type: 'sawtooth', t: 0.1 + i * 0.03, dur: 1.2, vol: 0.025, attack: 0.1, rev: 0.8 }));
        bell(midi(ROOTS[season] + 24), 0.2, 0.06, 1.6);
    },
    achievement() { bell(midi(ROOTS[season] + 24), 0, 0.06, 1.2); bell(midi(ROOTS[season] + 31), 0.14, 0.06, 1.4); },
    rebirth() {
        noise(3, { vol: 0.09, freq: 120, sweep: 30, type: 'lowpass' });
        [0, 7, 12, 19, 24, 31].forEach((k, i) => tone({ f: midi(ROOTS[season] - 12 + k), type: 'sine', t: 0.4 + i * 0.15, dur: 4, vol: 0.08, attack: 0.4, rev: 0.9 }));
    },
    error() { tone({ f: 180, type: 'square', dur: 0.12, vol: 0.03, rev: 0 }); },
    ui() { tone({ f: midi(ROOTS[season] + 24), type: 'sine', dur: 0.08, vol: 0.04, rev: 0.1 }); },
};

// ------------------------------------------------------------------ music
const CHORDS = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]];   // I maj7, vi, IV, V
let barTimer = null, bar = 0, ambNodes = [];

function startMusic() {
    if (started) return;
    started = true;
    scheduleBar();
    startAmbience();
}

function scheduleBar() {
    if (!ctx) return;
    const barLen = 6.4;
    const r = ROOTS[season] - 12;
    const ch = CHORDS[bar % 4];
    // pad
    ch.forEach((k, i) => {
        tone({ f: midi(r + k), type: 'sawtooth', dur: barLen + 1.5, vol: 0.012, attack: 2.2, bus: musicBus, rev: 0.9, detune: (i % 2 ? 7 : -7) });
        tone({ f: midi(r + k + 12), type: 'sine', dur: barLen + 1.2, vol: 0.014, attack: 2.4, bus: musicBus, rev: 0.9 });
    });
    // bass
    tone({ f: midi(r - 12 + ch[0]), type: 'sine', dur: barLen * 0.9, vol: 0.05, attack: 0.5, bus: musicBus, rev: 0.3 });
    // plucked melody: a few pentatonic notes, sparse and random
    const notes = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
        const k = PENTA[Math.floor(Math.random() * 8)];
        const tt = Math.floor(Math.random() * 8) * (barLen / 8);
        tone({ f: midi(r + 24 + k), type: 'triangle', t: tt, dur: 1.4, vol: 0.03, bus: musicBus, rev: 0.85 });
        if (Math.random() < 0.3) bell(midi(r + 36 + k), tt + 0.4, 0.012, 2.2, musicBus);
    }
    bar++;
    barTimer = setTimeout(scheduleBar, barLen * 1000);
}

function startAmbience() {
    // soft wind: filtered noise loop
    const n = ctx.sampleRate * 4;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = b; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(lp.frequency);
    src.connect(lp).connect(g).connect(ambBus);
    src.start(); lfo.start();
    ambNodes.push(src, lfo);
    // crickets: short chirps, scheduled loosely
    const chirp = () => {
        if (!ctx) return;
        const loud = season === 1 ? 1 : season === 3 ? 0 : 0.5;
        if (loud > 0) {
            const f = 4200 + Math.random() * 600;
            for (let k = 0; k < 3; k++) tone({ f, type: 'sine', t: k * 0.06, dur: 0.04, vol: 0.006 * loud, bus: ambBus, rev: 0.3 });
        }
        setTimeout(chirp, 700 + Math.random() * 2600);
    };
    chirp();
}
