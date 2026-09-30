/**
 * audio.js — all sound is synthesised at runtime. No audio files.
 *
 *   master → compressor → out
 *   sfx bus, music bus (through a side-chain "pump"), a reverb send whose
 *   impulse response is generated noise with an exponential tail.
 *
 * Instruments: Karplus–Strong harp and FM bells and a taiko are rendered into
 * AudioBuffers on first use (cached per note); pads, strings, brass and a
 * formant "choir" are live oscillator voices.
 *
 * Music is generative. Each realm has a root, a mode and a tempo (worlds.js);
 * the composer derives a chord progression and a melodic motif from them and
 * plays one of three arrangements — map, battle, Warden — on a look-ahead
 * scheduler against the AudioContext clock (the game-045 "two clocks" pattern).
 */

import { WORLD_DEFS } from '../sim/worlds.js';
import { makeRng, hashSeed } from '../sim/rng.js';

let ctx = null;
let master, comp, sfxBus, musicBus, pump, verb, verbSend, musicVerbSend;
let noiseBuf = null;
const settings = { music: 0.7, sfx: 0.8, muted: false };

export function audioReady() { return !!ctx; }
export function audioSettings() { return settings; }

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : 0.85;
    master.connect(comp);
    comp.connect(ctx.destination);
    verb = ctx.createConvolver();
    verb.buffer = impulse(3.2, 2.6);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    verb.connect(verbOut); verbOut.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.25; sfxBus.connect(verbSend); verbSend.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = settings.music * 0.55; musicBus.connect(master);
    musicVerbSend = ctx.createGain(); musicVerbSend.gain.value = 0.5; musicBus.connect(musicVerbSend); musicVerbSend.connect(verb);
    pump = ctx.createGain(); pump.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingMusic) { const p = pendingMusic; pendingMusic = null; setMusic(p.world, p.mode); }
}

function impulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const b = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
        }
    }
    return b;
}

export function setVolumes({ music, sfx, muted } = {}) {
    if (music !== undefined) settings.music = music;
    if (sfx !== undefined) settings.sfx = sfx;
    if (muted !== undefined) settings.muted = muted;
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(settings.music * 0.55, t, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.05);
    master.gain.setTargetAtTime(settings.muted ? 0 : 0.85, t, 0.05);
}
export function toggleMute() { setVolumes({ muted: !settings.muted }); return settings.muted; }

// ------------------------------------------------------------------ primitives

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const now = () => (ctx ? ctx.currentTime : 0);
const lastPlay = new Map();
function limit(key, gap) {
    if (!ctx) return false;
    const t = ctx.currentTime;
    if ((lastPlay.get(key) ?? -1) > t - gap) return false;
    lastPlay.set(key, t);
    return true;
}

function env(g, t, a, peak, dur, rel = 0.05) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur) + rel);
}

function tone(type, freq, dur, vol, { t = now(), to = null, bus = sfxBus, attack = 0.005, filter = null, q = 1, detune = 0 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    env(g, t, attack, vol, dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type ?? 'lowpass'; f.frequency.value = filter.freq; f.Q.value = q; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.1);
}

function noise(dur, vol, { t = now(), type = 'lowpass', freq = 2000, to = null, q = 0.8, bus = sfxBus, attack = 0.002 } = {}) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    env(g, t, attack, vol, dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 1.5, dur + 0.2);
}

// ------------------------------------------------------------------ baked instruments

const baked = new Map();
function bake(key, seconds, fn) {
    if (baked.has(key)) return baked.get(key);
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const b = ctx.createBuffer(1, len, rate);
    fn(b.getChannelData(0), rate, len);
    baked.set(key, b);
    return b;
}

function harpBuf(n) {
    return bake(`harp${n}`, 2.2, (d, rate, len) => {
        const f = midi(n);
        const period = Math.max(2, Math.round(rate / f));
        const buf = new Float32Array(period);
        for (let i = 0; i < period; i++) buf[i] = Math.random() * 2 - 1;
        let idx = 0, prev = 0;
        const damp = 0.996 - Math.min(0.01, n * 0.00005);
        for (let i = 0; i < len; i++) {
            const cur = buf[idx];
            const nxt = buf[(idx + 1) % period];
            const v = (cur + nxt) * 0.5 * damp;
            buf[idx] = v;
            d[i] = cur * 0.6 + prev * 0.4;
            prev = cur;
            idx = (idx + 1) % period;
        }
    });
}

function bellBuf(n) {
    return bake(`bell${n}`, 3.5, (d, rate, len) => {
        const f = midi(n);
        for (let i = 0; i < len; i++) {
            const t = i / rate;
            const e = Math.exp(-t * 1.6);
            const idx = 3.2 * Math.exp(-t * 2.5);
            const mod = Math.sin(2 * Math.PI * f * 3.5 * t) * idx;
            d[i] = (Math.sin(2 * Math.PI * f * t + mod) * 0.7 + Math.sin(2 * Math.PI * f * 2.76 * t) * 0.18 * Math.exp(-t * 4)) * e * Math.min(1, t * 400);
        }
    });
}

function taikoBuf(big) {
    return bake(`taiko${big}`, 1.2, (d, rate, len) => {
        const f0 = big ? 110 : 190, f1 = big ? 48 : 90;
        let ph = 0;
        for (let i = 0; i < len; i++) {
            const t = i / rate;
            const f = f1 + (f0 - f1) * Math.exp(-t * 18);
            ph += (2 * Math.PI * f) / rate;
            const body = Math.sin(ph) * Math.exp(-t * (big ? 4.5 : 8));
            const slap = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.5;
            d[i] = (body + slap) * 0.9;
        }
    });
}

function playBuf(buf, { t = now(), vol = 0.5, bus = sfxBus, rate = 1, pan = 0 } = {}) {
    if (!ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    let node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    s.connect(g); node.connect(bus);
    s.start(t);
}

function voice(type, n, dur, vol, { t = now(), bus = pump, attack = 0.3, release = 0.6, cutoff = 1800, detune = [0], q = 0.7 } = {}) {
    if (!ctx) return;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = q;
    f.connect(g); g.connect(bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const dt of detune) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midi(n);
        o.detune.value = dt;
        o.connect(f);
        o.start(t); o.stop(t + dur + 0.05);
    }
}

const VOWELS = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [400, 1600, 2700] };
function choir(n, dur, vol, { t = now(), vowel = 'a', bus = pump } = {}) {
    if (!ctx) return;
    const src = ctx.createGain();
    for (const dt of [-8, 0, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = dt;
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 5 + Math.random(); lg.gain.value = 6;
        lfo.connect(lg); lg.connect(o.detune);
        o.connect(src); o.start(t); o.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    out.gain.linearRampToValueAtTime(0.0001, t + dur);
    VOWELS[vowel].forEach((fq, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 9;
        const bg = ctx.createGain(); bg.gain.value = [1, 0.5, 0.25][i];
        src.connect(bp); bp.connect(bg); bg.connect(out);
    });
    out.connect(bus);
}

// ------------------------------------------------------------------ music: composer

const MODES = {
    dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygianDom: [0, 1, 4, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11], locrianish: [0, 1, 3, 5, 6, 8, 10],
};
const PROGS = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 3, 4], [0, 5, 2, 6]];

function compose(w) {
    const wd = WORLD_DEFS[w] ?? WORLD_DEFS[0];
    const rng = makeRng(hashSeed(w, 4747));
    const scale = MODES[wd.music.mode];
    const prog = rng.pick(PROGS).slice();
    const degToMidi = (deg, oct = 0) => {
        const o = Math.floor(deg / 7);
        const i = ((deg % 7) + 7) % 7;
        return wd.music.root + scale[i] + 12 * (o + oct);
    };
    const chord = (deg) => [degToMidi(deg), degToMidi(deg + 2), degToMidi(deg + 4)];
    // motif: 16 sixteenth-steps of (degree offset | null), reused with variation
    const motif = [];
    let deg = rng.int(2, 4);
    for (let i = 0; i < 16; i++) {
        if (i % 4 === 0 || rng.chance(0.35)) { deg += rng.pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]); deg = Math.max(-1, Math.min(8, deg)); motif.push(deg); } else motif.push(null);
    }
    const answer = motif.map((d) => (d === null ? null : d + rng.pick([0, 0, 1, -1, 2])));
    const arp = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]]);
    const drum = rng.pick([
        [1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 0, 2, 0, 0, 1],
        [1, 0, 0, 1, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0],
        [1, 0, 1, 0, 2, 0, 0, 1, 1, 0, 0, 0, 2, 0, 1, 0],
    ]);
    return { wd, scale, prog, chord, degToMidi, motif, answer, arp, drum, bpm: wd.music.bpm };
}

const M = { world: -1, mode: 'silent', song: null, step: 0, next: 0, timer: null, target: null, intensity: 0, startT: 0 };
let pendingMusic = null;

/** mode: 'title' | 'map' | 'battle' | 'boss' | 'silent' | 'victory' | 'defeat' */
export function setMusic(world, mode) {
    if (!ctx) { pendingMusic = { world, mode }; return; }
    if (M.world === world && M.mode === mode) return;
    const changeSong = M.world !== world || !M.song;
    M.target = { world, mode, changeSong };
    if (!M.timer) {
        applyTarget();
        M.next = ctx.currentTime + 0.1;
        M.startT = M.next;
        M.timer = setInterval(scheduler, 25);
    }
}

function applyTarget() {
    const t = M.target;
    if (!t) return;
    M.target = null;
    if (t.changeSong || M.world !== t.world) { M.song = compose(t.world); M.step = 0; prewarm(M.song); }
    M.world = t.world;
    M.mode = t.mode;
}

/** Bake the song's harp and bell notes a few at a time so first use never stalls the scheduler. */
function prewarm(S) {
    const jobs = [];
    for (const deg of S.prog) {
        for (const n of S.chord(deg)) { jobs.push(() => harpBuf(n + 12)); jobs.push(() => harpBuf(n + 24)); }
        for (let d = -1; d <= 11; d++) jobs.push(() => bellBuf(S.degToMidi(deg + d, 1) + 12));
    }
    jobs.push(() => taikoBuf(true), () => taikoBuf(false));
    const tick = () => { for (let i = 0; i < 3 && jobs.length; i++) jobs.shift()(); if (jobs.length) setTimeout(tick, 16); };
    tick();
}

function stepDur() {
    const bpm = M.song.bpm * (M.mode === 'boss' ? 1.18 : M.mode === 'battle' ? 1.08 : M.mode === 'title' ? 0.9 : 1);
    return 60 / bpm / 4;
}

function scheduler() {
    if (!ctx || !M.song) return;
    const SD = stepDur();
    if (M.next < ctx.currentTime - 0.3) {
        const skip = Math.ceil((ctx.currentTime - M.next) / SD);
        M.step += skip; M.next += skip * SD;
    }
    while (M.next < ctx.currentTime + 0.14) {
        // mode changes land on bar lines so they never click
        if (M.target && M.step % 16 === 0) applyTarget();
        if (M.mode !== 'silent') playStep(M.step, M.next, SD);
        M.next += SD;
        M.step++;
    }
}

function playStep(step, t, SD) {
    const S = M.song;
    const mode = M.mode;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const deg = S.prog[bar % S.prog.length];
    const ch = S.chord(deg);
    const section = Math.floor(bar / 4) % 4; // A A' B A
    const barDur = SD * 16;
    const fight = mode === 'battle' || mode === 'boss';
    const boss = mode === 'boss';

    if (mode === 'victory' || mode === 'defeat') {
        if (s === 0 && bar % 2 === 0) {
            const c = mode === 'victory' ? S.chord(0) : S.chord(3);
            c.forEach((n) => voice('sawtooth', n, barDur * 2, 0.05, { t, attack: 0.5, release: 1.2, cutoff: 1400, detune: [-7, 7] }));
            voice('sine', ch[0] - 24, barDur * 2, 0.12, { t, attack: 0.3, release: 1 });
        }
        return;
    }

    // pad: every bar
    if (s === 0) {
        ch.forEach((n, i) => voice('sawtooth', n + (i === 0 ? 0 : 0), barDur * 1.02, fight ? 0.035 : 0.045, { t, attack: fight ? 0.15 : 0.6, release: 0.5, cutoff: fight ? 2200 : 1300, detune: [-9, 0, 8] }));
        voice('sine', ch[0] - 24, barDur, 0.16, { t, attack: 0.05, release: 0.3 });
        voice('triangle', ch[0] - 12, barDur, 0.06, { t, attack: 0.05, release: 0.3 });
        if (boss) ch.forEach((n, i) => choir(n + 12 - (i === 1 ? 12 : 0), barDur, 0.05, { t, vowel: section === 2 ? 'o' : 'a' }));
    }
    // harp arpeggio (8ths on map, 16ths in battle)
    const arpEvery = fight ? 1 : 2;
    if (s % arpEvery === 0) {
        const k = (s / arpEvery) % S.arp.length;
        const n = ch[S.arp[k] % 3] + 12 * (S.arp[k] >= 3 ? 1 : 0) + 12;
        playBuf(harpBuf(n), { t, vol: fight ? 0.1 : 0.14, bus: pump, pan: ((s % 4) - 1.5) * 0.25 });
    }
    // melody (bells), A A' B A
    const mot = section === 1 ? S.answer : section === 2 ? S.answer.map((d) => (d === null ? null : d + 2)) : S.motif;
    const md = mot[s];
    if (md !== null && (bar % 2 === 0 || section === 2 || fight)) {
        const n = S.degToMidi(deg + md, 1) + 12;
        playBuf(bellBuf(n), { t, vol: fight ? 0.09 : 0.12, bus: pump });
    }
    // strings ostinato in fights
    if (fight && s % 2 === 0) {
        const n = ch[(s / 2) % 3] + (s % 8 === 0 ? 0 : 12);
        voice('sawtooth', n, SD * 1.8, 0.03, { t, attack: 0.02, release: 0.08, cutoff: 2600, detune: [-6, 6], bus: pump });
    }
    // drums
    if (fight) {
        const d = S.drum[s];
        if (d === 1) { playBuf(taikoBuf(true), { t, vol: 0.55, bus: musicBus }); duck(t, SD * 3); }
        if (d === 2) { playBuf(taikoBuf(false), { t, vol: 0.4, bus: musicBus }); noise(0.12, 0.08, { t, type: 'bandpass', freq: 1800, bus: musicBus }); }
        if (s % 2 === 1) noise(0.04, 0.035, { t, type: 'highpass', freq: 7000, bus: musicBus });
        if (boss && s % 4 === 2) playBuf(taikoBuf(false), { t, vol: 0.25, rate: 1.3, bus: musicBus });
        if (boss && s === 0 && bar % 2 === 0) voice('sawtooth', ch[0] - 12, SD * 3, 0.07, { t, attack: 0.02, release: 0.2, cutoff: 1500, detune: [-10, 0, 10], bus: musicBus });
    } else if (s === 0 && bar % 4 === 0) {
        noise(2.5, 0.02, { t, type: 'bandpass', freq: 600, to: 3000, bus: musicBus, attack: 1.2 });
    }
}

function duck(t, dur) {
    pump.gain.cancelScheduledValues(t);
    pump.gain.setValueAtTime(0.5, t);
    pump.gain.linearRampToValueAtTime(1, t + dur);
}

/** 0..1 phase-based pulse on the music beat, for visuals. */
export function beatPulse() {
    if (!ctx || !M.song) return 0;
    const beat = stepDur() * 4;
    const ph = (((ctx.currentTime - M.startT) / beat) % 1 + 1) % 1;
    return Math.exp(-ph * 5);
}

// ------------------------------------------------------------------ sound effects

const PENTA = [0, 2, 4, 7, 9];

export const sfx = {
    click() { tone('triangle', 1200, 0.05, 0.12, { to: 1600 }); },
    hover() { if (limit('hover', 0.05)) tone('sine', 2200, 0.03, 0.03); },
    draw() { if (!limit('draw', 0.03)) return; noise(0.09, 0.14, { type: 'bandpass', freq: 3000, to: 6000, q: 1.5 }); },
    flip() { noise(0.06, 0.1, { type: 'bandpass', freq: 5000, q: 2 }); },
    place() {
        if (!limit('place', 0.03)) return;
        noise(0.07, 0.3, { type: 'lowpass', freq: 1400, to: 300 });
        tone('sine', 180, 0.12, 0.25, { to: 90 });
    },
    pickup() { noise(0.06, 0.12, { type: 'bandpass', freq: 4000, to: 2500, q: 2 }); },
    chip(i) { if (!ctx) return; tone('triangle', midi(72 + PENTA[i % 5] + 12 * Math.floor(i / 5)), 0.09, 0.07); },
    fire(tier) {
        if (!ctx) return;
        const base = 60;
        const n = Math.min(8, 2 + tier);
        for (let i = 0; i < n; i++) playBuf(bellBuf(base + PENTA[i % 5] + 12 * Math.floor(i / 5)), { t: now() + i * 0.045, vol: 0.18 });
        noise(0.4, 0.12 + tier * 0.02, { type: 'bandpass', freq: 800, to: 5000, q: 0.8 });
        if (tier >= 6) { choir(60 + 12, 1.4, 0.08, { vowel: 'a', bus: sfxBus }); choir(67 + 12, 1.4, 0.06, { vowel: 'a', bus: sfxBus }); }
    },
    handName(tier) { if (!ctx) return; tone('sawtooth', midi(48 + tier), 0.5, 0.06, { filter: { freq: 1400 }, attack: 0.02 }); },
    blades() { if (!limit('blades', 0.04)) return; noise(0.18, 0.3, { type: 'highpass', freq: 2000, to: 800 }); tone('sawtooth', 900, 0.15, 0.07, { to: 200, filter: { freq: 3000 } }); },
    staves() { if (!limit('staves', 0.05)) return; tone('sine', 300, 0.5, 0.15, { to: 1200 }); noise(0.5, 0.12, { type: 'bandpass', freq: 400, to: 3000, q: 3 }); },
    ward() { if (!limit('ward', 0.06)) return; [0, 4, 7].forEach((k, i) => tone('triangle', midi(79 + k), 0.4, 0.06, { t: now() + i * 0.03 })); noise(0.3, 0.05, { type: 'highpass', freq: 6000 }); },
    heal() { if (!limit('heal', 0.08)) return; [0, 4, 7, 12].forEach((k, i) => playBuf(bellBuf(76 + k), { t: now() + i * 0.06, vol: 0.12 })); },
    hitEnemy(big) {
        if (!limit('hitE', 0.03)) return;
        noise(0.12, big ? 0.5 : 0.32, { type: 'lowpass', freq: 2500, to: 200 });
        tone('square', big ? 90 : 140, 0.12, 0.1, { to: 50, filter: { freq: 800 } });
        if (big) playBuf(taikoBuf(true), { vol: 0.4 });
    },
    hitPlayer() { if (!limit('hitP', 0.04)) return; playBuf(taikoBuf(true), { vol: 0.6, rate: 0.8 }); noise(0.2, 0.3, { type: 'lowpass', freq: 900, to: 150 }); },
    blocked() { if (!limit('blk', 0.04)) return; tone('square', 1800, 0.08, 0.06, { to: 1200, filter: { freq: 4000 } }); noise(0.1, 0.15, { type: 'highpass', freq: 3000 }); },
    enemyAttack() { if (!limit('eatk', 0.08)) return; noise(0.25, 0.22, { type: 'bandpass', freq: 500, to: 2500, q: 1.2 }); },
    enemyCast() { if (!limit('ecast', 0.1)) return; tone('sawtooth', 200, 0.6, 0.08, { to: 80, filter: { freq: 900 } }); tone('sine', 660, 0.5, 0.06, { to: 330 }); },
    curse() { if (!limit('curse', 0.1)) return; tone('sawtooth', 110, 0.8, 0.1, { to: 70, filter: { freq: 600 } }); choir(47, 1.0, 0.05, { vowel: 'u', bus: sfxBus }); },
    death(boss) {
        noise(0.9, 0.25, { type: 'bandpass', freq: 3000, to: 200, q: 1 });
        tone('sine', 400, 0.8, 0.12, { to: 60 });
        if (boss) { choir(43, 2.5, 0.12, { vowel: 'o', bus: sfxBus }); playBuf(taikoBuf(true), { vol: 0.8, rate: 0.6 }); }
    },
    gold() { if (!limit('gold', 0.05)) return; [0, 7].forEach((k, i) => tone('triangle', midi(88 + k), 0.12, 0.07, { t: now() + i * 0.05 })); },
    relic() { [0, 4, 7, 11, 14].forEach((k, i) => playBuf(bellBuf(67 + k), { t: now() + i * 0.08, vol: 0.16 })); },
    arcana() { noise(0.5, 0.12, { type: 'bandpass', freq: 1200, to: 4000, q: 4 }); tone('sine', 520, 0.4, 0.08, { to: 1040 }); },
    elixir() { for (let i = 0; i < 5; i++) tone('sine', 400 + Math.random() * 600, 0.08, 0.05, { t: now() + i * 0.05 }); },
    seal() { tone('square', 150, 0.3, 0.08, { to: 100, filter: { freq: 700 } }); noise(0.2, 0.1, { type: 'lowpass', freq: 600 }); },
    frost() { noise(0.6, 0.12, { type: 'highpass', freq: 5000, to: 9000 }); tone('sine', 2400, 0.4, 0.03, { to: 1800 }); },
    shuffle() { for (let i = 0; i < 6; i++) noise(0.05, 0.08, { t: now() + i * 0.04, type: 'bandpass', freq: 4000 + i * 200, q: 2 }); },
    turn() { if (!ctx) return; playBuf(bellBuf(55), { vol: 0.12 }); },
    endTurn() { tone('triangle', 330, 0.15, 0.08, { to: 220 }); },
    redraw() { noise(0.1, 0.1, { type: 'bandpass', freq: 2500, to: 5000, q: 1.5 }); },
    phase() { playBuf(taikoBuf(true), { vol: 0.8, rate: 0.7 }); choir(38, 2, 0.12, { vowel: 'a', bus: sfxBus }); choir(45, 2, 0.09, { vowel: 'a', bus: sfxBus }); },
    victory() { if (!ctx) return; [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => playBuf(harpBuf(60 + k), { t: now() + i * 0.07, vol: 0.2 })); [0, 4, 7].forEach((k) => voice('sawtooth', 60 + k, 1.6, 0.04, { t: now() + 0.4, bus: sfxBus, attack: 0.1, release: 0.8, cutoff: 2500, detune: [-7, 7] })); },
    defeat() { if (!ctx) return; [0, -3, -7, -12].forEach((k, i) => voice('sawtooth', 57 + k, 0.9, 0.05, { t: now() + i * 0.35, bus: sfxBus, attack: 0.05, release: 0.6, cutoff: 1100, detune: [-8, 8] })); },
    step() { if (!ctx) return; noise(0.08, 0.12, { type: 'lowpass', freq: 700 }); },
    page() { noise(0.25, 0.1, { type: 'bandpass', freq: 2000, to: 800, q: 0.7 }); },
    chapter() { if (!ctx) return; playBuf(taikoBuf(true), { vol: 0.5, rate: 0.7 }); [0, 7, 12].forEach((k, i) => playBuf(bellBuf(55 + k), { t: now() + 0.2 + i * 0.25, vol: 0.18 })); },
};
