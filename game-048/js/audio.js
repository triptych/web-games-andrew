/**
 * audio.js — every sound is synthesised. No audio files.
 *
 * master → compressor → out; an sfx bus and a music bus, a generated-noise
 * reverb. Music is generative synthwave: each chapter has a root and tempo
 * (story.js), and the arranger plays bass, pads, an arpeggiator and drums on
 * a look-ahead scheduler, with layers that come in for battle, bosses and
 * Overdrive.
 */

import { CHAPTER_INFO } from './sim/story.js';

let ctx = null;
let master, comp, sfx, music, verb, verbSend, musicFilter, noiseBuf;
const settings = { music: 0.55, sfx: 0.8, muted: false };

export function audioSettings() { return settings; }
export function audioReady() { return !!ctx; }

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    verb = ctx.createConvolver();
    verb.buffer = impulse(2.4, 3);
    const vOut = ctx.createGain(); vOut.gain.value = 0.4;
    verb.connect(vOut); vOut.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = settings.sfx; sfx.connect(master);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.22; sfx.connect(verbSend); verbSend.connect(verb);
    music = ctx.createGain(); music.gain.value = settings.music * 0.5;
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 9000;
    musicFilter.connect(music); music.connect(master);
    const mv = ctx.createGain(); mv.gain.value = 0.35; music.connect(mv); mv.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pending) { const p = pending; pending = null; setMusic(p.mode, p.chapter); }
}

function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
}

export function setVolumes(o = {}) {
    Object.assign(settings, o);
    if (!ctx) return;
    const t = ctx.currentTime;
    music.gain.setTargetAtTime(settings.music * 0.5, t, 0.05);
    sfx.gain.setTargetAtTime(settings.sfx, t, 0.05);
    master.gain.setTargetAtTime(settings.muted ? 0 : 0.8, t, 0.05);
}

const now = () => (ctx ? ctx.currentTime : 0);
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const last = new Map();
function limit(key, gap) {
    if (!ctx) return false;
    const t = ctx.currentTime;
    if ((last.get(key) ?? -1) > t - gap) return false;
    last.set(key, t);
    return true;
}

function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur));
}

function tone(type, f, dur, vol, o = {}) {
    if (!ctx) return;
    const t = o.t ?? now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide ?? dur));
    osc.detune.value = o.detune ?? 0;
    env(g, t, o.a ?? 0.005, vol, dur);
    let n = osc;
    if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); f2.Q.value = o.q ?? 1; osc.connect(f2); n = f2; }
    n.connect(g); g.connect(o.bus ?? sfx);
    osc.start(t); osc.stop(t + dur + 0.05);
}

function noise(dur, vol, o = {}) {
    if (!ctx) return;
    const t = o.t ?? now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f ?? 1500, t);
    if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    env(g, t, o.a ?? 0.002, vol, dur);
    src.connect(f); f.connect(g); g.connect(o.bus ?? sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ sfx

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];

export const sound = {
    click() { if (limit('click', 0.03)) { tone('square', 880, 0.04, 0.05, { lp: 3000 }); } },
    hover() { if (limit('hover', 0.05)) tone('sine', 1320, 0.03, 0.025); },
    open() { tone('triangle', 440, 0.12, 0.08, { to: 880 }); },
    deny() { tone('square', 140, 0.15, 0.08, { lp: 900 }); tone('square', 110, 0.15, 0.06, { lp: 900, t: now() + 0.08 }); },
    spinStart() {
        noise(0.35, 0.12, { f: 600, fTo: 3000, type: 'bandpass', q: 2 });
        tone('sawtooth', 110, 0.3, 0.06, { to: 330, lp: 1200 });
    },
    tick(i = 0) { if (limit('tick', 0.035)) tone('square', 1800 + (i % 3) * 200, 0.018, 0.025, { lp: 5000 }); },
    reelStop(i) {
        tone('sine', 160 - i * 8, 0.12, 0.22, { to: 60 });
        noise(0.05, 0.14, { f: 2500 + i * 300, q: 3 });
        tone('square', 600 + i * 90, 0.04, 0.04, { lp: 2500 });
    },
    antic(i) { tone('sawtooth', 220 + i * 60, 0.7, 0.05, { to: 880 + i * 120, lp: 2000, glide: 0.7 }); },
    nudge() { tone('triangle', 520, 0.06, 0.08, { to: 700 }); noise(0.04, 0.06, { f: 4000 }); },
    hold() { tone('square', 330, 0.08, 0.06, { lp: 1500 }); tone('square', 495, 0.1, 0.06, { lp: 1500, t: now() + 0.05 }); },
    line(chain, len) {
        const t = now();
        const base = 72 + (len - 3) * 2;
        for (let i = 0; i < 3; i++) tone('square', midi(base + PENTA[Math.min(PENTA.length - 1, chain - 1 + i * 2)]), 0.14, 0.05, { t: t + i * 0.045, lp: 4000 });
        tone('triangle', midi(base + 12 + PENTA[Math.min(PENTA.length - 1, chain)]), 0.3, 0.06, { t: t + 0.13 });
    },
    blade() { noise(0.16, 0.18, { f: 2500, fTo: 6000, q: 1.2, type: 'highpass' }); tone('sawtooth', 900, 0.1, 0.04, { to: 300, lp: 3000 }); },
    cannon() { if (!limit('cannon', 0.04)) return; tone('sine', 140, 0.25, 0.4, { to: 40 }); noise(0.18, 0.25, { f: 900, fTo: 200, type: 'lowpass' }); },
    missile() { if (!limit('missile', 0.05)) return; noise(0.4, 0.12, { f: 3000, fTo: 600, q: 0.6 }); tone('sawtooth', 300, 0.35, 0.04, { to: 900, lp: 1500 }); },
    arc() { if (!limit('arc', 0.04)) return; for (let i = 0; i < 5; i++) tone('square', 300 + Math.random() * 1600, 0.04, 0.05, { t: now() + i * 0.025, lp: 6000 }); noise(0.2, 0.1, { f: 5000, q: 4 }); },
    shield() { tone('sine', 660, 0.35, 0.08, { to: 990 }); tone('sine', 990, 0.35, 0.05, { t: now() + 0.05, to: 1320 }); },
    repair() { [0, 4, 7, 12].forEach((s, i) => tone('triangle', midi(79 + s), 0.18, 0.05, { t: now() + i * 0.05 })); },
    energy() { if (limit('energy', 0.05)) tone('square', 880, 0.08, 0.05, { to: 1760, lp: 4000 }); },
    coins(n = 4) { if (!limit('coins', 0.08)) return; for (let i = 0; i < Math.min(8, n); i++) tone('square', 1900 + Math.random() * 900, 0.05, 0.03, { t: now() + i * 0.04, lp: 7000 }); },
    hit(crit) {
        if (!limit('hit', 0.025)) return;
        noise(0.08, crit ? 0.3 : 0.18, { f: crit ? 3000 : 1600, q: 1 });
        tone('square', crit ? 220 : 160, 0.08, 0.08, { to: 60, lp: 1800 });
        if (crit) tone('triangle', 1760, 0.15, 0.06, { to: 2640 });
    },
    kill(boss) {
        tone('sine', 90, boss ? 1.2 : 0.5, 0.5, { to: 30 });
        noise(boss ? 1.4 : 0.6, 0.35, { f: 1200, fTo: 120, type: 'lowpass' });
        noise(0.12, 0.2, { f: 4000, q: 2 });
    },
    phit(absorbed) {
        if (!limit('phit', 0.05)) return;
        if (absorbed) { tone('sine', 520, 0.18, 0.12, { to: 260 }); noise(0.1, 0.12, { f: 3500, q: 3 }); }
        else { tone('square', 90, 0.2, 0.18, { to: 45, lp: 900 }); noise(0.2, 0.3, { f: 700, fTo: 200, type: 'lowpass' }); }
    },
    enemyFire(heavy) { if (limit('efire', 0.06)) tone('sawtooth', heavy ? 220 : 440, heavy ? 0.3 : 0.15, 0.06, { to: heavy ? 60 : 120, lp: 2400 }); },
    jam() { tone('square', 80, 0.25, 0.15, { lp: 700 }); noise(0.15, 0.2, { f: 1800, q: 5 }); tone('square', 60, 0.2, 0.12, { lp: 600, t: now() + 0.12 }); },
    glitch() { for (let i = 0; i < 8; i++) tone('square', 100 + Math.random() * 2000, 0.03, 0.05, { t: now() + i * 0.03 }); },
    drain() { tone('sawtooth', 880, 0.4, 0.07, { to: 110, lp: 2000 }); },
    overdrive() {
        noise(1.0, 0.15, { f: 400, fTo: 8000, q: 1.5, a: 0.6 });
        const t = now();
        [0, 3, 7, 10, 12, 15, 19].forEach((s, i) => tone('sawtooth', midi(57 + s), 0.5, 0.05, { t: t + 0.05 * i, lp: 3000 }));
        tone('sine', 55, 1.2, 0.35, { t: t + 0.4, to: 40 });
    },
    jackpot() {
        const t = now();
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { tone('square', midi(72 + s), 0.25, 0.06, { t: t + i * 0.07, lp: 5000 }); tone('triangle', midi(60 + s), 0.4, 0.06, { t: t + i * 0.07 }); });
        for (let i = 0; i < 16; i++) tone('square', 2000 + Math.random() * 1200, 0.05, 0.03, { t: t + 0.4 + i * 0.05, lp: 8000 });
    },
    bigWin(level) { const t = now(); [0, 7, 12, 16 + level].forEach((s, i) => tone('sawtooth', midi(60 + s), 0.6, 0.05, { t: t + i * 0.09, lp: 3500 })); },
    chainUp(n) { tone('triangle', midi(72 + Math.min(24, n * 2)), 0.12, 0.06); },
    levelUp() { const t = now(); [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone('square', midi(67 + s), 0.16, 0.06, { t: t + i * 0.08, lp: 4000 })); },
    quest() { const t = now(); [0, 5, 9, 12].forEach((s, i) => tone('triangle', midi(76 + s), 0.25, 0.07, { t: t + i * 0.1 })); },
    victory() { const t = now(); [0, 4, 7, 12, 16].forEach((s, i) => tone('sawtooth', midi(60 + s), 0.5, 0.05, { t: t + i * 0.1, lp: 3000 })); },
    defeat() { const t = now(); [12, 7, 3, 0].forEach((s, i) => tone('sawtooth', midi(48 + s), 0.6, 0.06, { t: t + i * 0.22, lp: 1200 })); },
    upgrade() { tone('square', 523, 0.08, 0.06, { lp: 3000 }); tone('square', 784, 0.12, 0.06, { lp: 3000, t: now() + 0.06 }); tone('triangle', 1046, 0.25, 0.05, { t: now() + 0.12 }); },
    type() { if (limit('type', 0.035)) tone('square', 1200 + Math.random() * 300, 0.015, 0.012, { lp: 4000 }); },
    phase() { tone('sawtooth', 55, 1.5, 0.2, { to: 110, lp: 600 }); noise(1.2, 0.12, { f: 200, fTo: 2000, q: 2 }); },
};

// ------------------------------------------------------------------ music

let pending = null;
let musicState = { mode: null, chapter: 0, step: 0, next: 0, timer: null, intensity: 0 };

export function setIntensity(v) {
    musicState.intensity = v;
    if (musicFilter) musicFilter.frequency.setTargetAtTime(v >= 2 ? 14000 : v >= 1 ? 9000 : 6000, now(), 0.3);
}

/** mode: title | hub | map | battle | boss | story | off */
export function setMusic(mode, chapter = 0) {
    if (!ctx) { pending = { mode, chapter }; return; }
    if (musicState.mode === mode && musicState.chapter === chapter) return;
    musicState.mode = mode;
    musicState.chapter = chapter;
    musicState.step = 0;
    musicState.next = now() + 0.1;
    if (musicState.timer) clearInterval(musicState.timer);
    musicState.timer = null;
    if (mode === 'off') return;
    musicState.timer = setInterval(schedule, 25);
}

const PROG = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];   // i – VI – III – VII

function schedule() {
    if (!ctx) return;
    const M = musicState;
    const info = CHAPTER_INFO[Math.min(6, M.chapter)];
    const fight = M.mode === 'battle' || M.mode === 'boss';
    const bpm = info.tempo * (fight ? 1 : M.mode === 'title' ? 0.85 : 0.8);
    const sixteenth = 60 / bpm / 4;
    const root = info.root + (M.mode === 'boss' ? -2 : 0);
    while (M.next < ctx.currentTime + 0.12) {
        const s = M.step;
        const t = M.next;
        const bar = Math.floor(s / 16);
        const chord = PROG[bar % 4];
        const inBar = s % 16;
        const bus = musicFilter;
        // bass: 8ths, octave bounce
        if (inBar % 2 === 0) {
            const n = root + chord[0] + (inBar % 4 === 2 ? 12 : 0);
            tone('sawtooth', midi(n), sixteenth * 1.8, fight ? 0.09 : 0.06, { t, lp: fight ? 900 : 600, q: 4, bus });
        }
        // pad on bar start
        if (inBar === 0) {
            for (const c of chord) {
                tone('sawtooth', midi(root + 24 + c), sixteenth * 16, 0.022, { t, a: 0.4, lp: 1800, bus, detune: -8 });
                tone('sawtooth', midi(root + 24 + c), sixteenth * 16, 0.022, { t, a: 0.4, lp: 1800, bus, detune: 8 });
            }
        }
        // arpeggio (battle, title)
        if (fight || M.mode === 'title' || M.intensity > 0) {
            const arp = [0, 1, 2, 1, 2, 0, 2, 1];
            if (fight || inBar % 2 === 0) {
                const n = root + 36 + chord[arp[s % 8]] + (M.intensity >= 2 && inBar >= 8 ? 12 : 0);
                tone('square', midi(n), sixteenth * 0.9, fight ? 0.03 : 0.022, { t, lp: 3500, bus });
            }
        }
        // drums
        if (fight || M.mode === 'title') {
            if (inBar % 4 === 0) { tone('sine', 120, 0.18, 0.32, { t, to: 40, bus }); }
            if (inBar === 4 || inBar === 12) noise(0.16, 0.11, { t, f: 1800, q: 0.7, bus });
            if (inBar % 2 === 1 || M.intensity >= 2) noise(0.03, 0.035, { t, f: 9000, type: 'highpass', bus });
        } else if (M.mode === 'hub' || M.mode === 'map') {
            if (inBar === 0 || inBar === 10) tone('sine', 90, 0.2, 0.15, { t, to: 40, bus });
            if (inBar % 4 === 2) noise(0.02, 0.02, { t, f: 9000, type: 'highpass', bus });
        }
        // a lead phrase every other bar in boss fights
        if (M.mode === 'boss' && bar % 2 === 1 && inBar % 4 === 0) {
            tone('sawtooth', midi(root + 48 + chord[(inBar / 4) % 3]), sixteenth * 3.5, 0.03, { t, lp: 2400, bus, detune: 5 });
        }
        M.step++;
        M.next += sixteenth;
    }
}
