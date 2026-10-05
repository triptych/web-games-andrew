/**
 * audio.js — everything you hear, synthesised with Web Audio (no files).
 *
 * SFX: short recipes of oscillators and filtered noise (punch thuds, slashes,
 * electric arcs, explosions, UI blips).
 * Music: a small step sequencer with lookahead scheduling. Each song is a
 * tempo, key, chord progression and style; bass, arpeggio, pad, lead and
 * drums are generated from a seed, so every stage gets its own theme without
 * any audio assets.
 */

let ctx = null, master = null, musicBus = null, sfxBus = null, comp = null, noiseBuf = null;
const vol = { master: 0.8, music: 0.55, sfx: 0.8 };
let muted = false;
let wanted = null;   // song requested before the AudioContext existed

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = vol.master;
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music;
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx;
    musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume(); });
    if (wanted) seq.play(wanted);
}

export function setVolumes(v) {
    Object.assign(vol, v);
    if (!ctx) return;
    master.gain.value = vol.master; musicBus.gain.value = vol.music; sfxBus.gain.value = vol.sfx;
}
export function audioReady() { return !!ctx; }

// ---------------------------------------------------------------- primitives
function env(g, t, a, peak, d, sustain = 0.0001) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
}
function osc(type, f0, f1, t, dur, peak, bus = sfxBus, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    let node = o;
    if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; f.Q.value = opts.q || 1; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    env(g, t, opts.a || 0.004, peak, dur);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
}
function noise(t, dur, peak, type = 'bandpass', freq = 1200, q = 1, bus = sfxBus, f1) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(bus);
    env(g, t, 0.003, peak, dur);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// ---------------------------------------------------------------- sfx
const lastPlayed = {};
const SFX = {
    hitL(t) { osc('triangle', 220, 70, t, 0.09, 0.5); noise(t, 0.06, 0.35, 'bandpass', 1800, 0.8); },
    hitH(t) { osc('sine', 160, 40, t, 0.18, 0.8); osc('square', 90, 40, t, 0.1, 0.18, sfxBus, { lp: 900 }); noise(t, 0.12, 0.5, 'lowpass', 2200, 0.7); },
    swish(t) { noise(t, 0.09, 0.16, 'bandpass', 3000, 2, sfxBus, 900); },
    swishH(t) { noise(t, 0.14, 0.22, 'bandpass', 2200, 1.5, sfxBus, 500); },
    thud(t) { osc('sine', 110, 35, t, 0.25, 0.75); noise(t, 0.15, 0.3, 'lowpass', 500, 0.7); },
    zap(t) { osc('sawtooth', 1200, 200, t, 0.12, 0.2, sfxBus, { lp: 3000 }); noise(t, 0.1, 0.2, 'highpass', 3000, 0.7); },
    arc(t) { for (let k = 0; k < 4; k++) osc('sawtooth', 300 + k * 220, 1800 + k * 300, t + k * 0.02, 0.25, 0.12, sfxBus, { lp: 4000 }); noise(t, 0.35, 0.3, 'bandpass', 4000, 0.6, sfxBus, 800); osc('sine', 80, 40, t, 0.4, 0.5); },
    rail(t) { osc('sawtooth', 200, 900, t, 0.3, 0.2, sfxBus, { lp: 2500 }); noise(t, 0.3, 0.25, 'bandpass', 1500, 1, sfxBus, 4000); },
    dive(t) { osc('square', 900, 120, t, 0.35, 0.12, sfxBus, { lp: 2000 }); noise(t, 0.35, 0.2, 'bandpass', 3000, 1, sfxBus, 500); },
    boom(t) { osc('sine', 120, 28, t, 0.6, 0.9); noise(t, 0.7, 0.6, 'lowpass', 1200, 0.6, sfxBus, 120); noise(t, 0.15, 0.35, 'highpass', 2000, 0.5); },
    pulse(t) { osc('square', 600, 1600, t, 0.12, 0.15, sfxBus, { lp: 3000 }); osc('sine', 300, 900, t, 0.2, 0.3); },
    odCharge(t) { osc('sawtooth', 110, 880, t, 0.35, 0.2, sfxBus, { lp: 3000 }); osc('sine', 55, 220, t, 0.35, 0.4); },
    odBlast(t) { SFX.boom(t); SFX.arc(t + 0.02); osc('square', 880, 1760, t, 0.4, 0.1, sfxBus, { lp: 5000 }); },
    jump(t) { osc('square', 300, 600, t, 0.08, 0.06, sfxBus, { lp: 2000 }); },
    grab(t) { noise(t, 0.08, 0.3, 'lowpass', 900, 0.8); osc('triangle', 180, 120, t, 0.08, 0.3); },
    throw(t) { noise(t, 0.22, 0.25, 'bandpass', 1200, 1.2, sfxBus, 400); osc('sine', 300, 120, t, 0.2, 0.2); },
    clang(t) { osc('square', 1400, 1300, t, 0.2, 0.12, sfxBus, { lp: 4000 }); osc('square', 2100, 2000, t, 0.15, 0.06, sfxBus, { lp: 5000 }); noise(t, 0.05, 0.3, 'highpass', 3000, 0.7); },
    wood(t) { osc('triangle', 300, 150, t, 0.1, 0.4); noise(t, 0.08, 0.35, 'bandpass', 900, 1.2); },
    slashHit(t) { noise(t, 0.12, 0.45, 'highpass', 2500, 0.8, sfxBus, 6000); osc('sawtooth', 900, 300, t, 0.1, 0.1, sfxBus, { lp: 3000 }); },
    gun(t) { noise(t, 0.12, 0.6, 'lowpass', 3000, 0.7, sfxBus, 400); osc('square', 200, 60, t, 0.08, 0.25); },
    laser(t) { osc('square', 1800, 400, t, 0.16, 0.12, sfxBus, { lp: 4000 }); },
    spit(t) { noise(t, 0.2, 0.35, 'bandpass', 600, 2, sfxBus, 1500); },
    beep(t) { osc('square', 1600, 1600, t, 0.06, 0.12, sfxBus, { lp: 4000 }); osc('square', 1600, 1600, t + 0.12, 0.06, 0.12, sfxBus, { lp: 4000 }); },
    sizzle(t) { noise(t, 0.15, 0.15, 'highpass', 4000, 0.5); },
    steam(t) { noise(t, 0.6, 0.3, 'highpass', 2000, 0.5, sfxBus, 6000); },
    alarm(t) { for (let k = 0; k < 3; k++) { osc('square', 880, 660, t + k * 0.28, 0.24, 0.1, sfxBus, { lp: 2400 }); } },
    launch(t) { for (let k = 0; k < 4; k++) noise(t + k * 0.1, 0.25, 0.2, 'bandpass', 800, 1, sfxBus, 3000); },
    flame(t) { noise(t, 1.2, 0.3, 'lowpass', 1600, 0.5); },
    charge(t) { osc('sawtooth', 120, 1200, t, 0.8, 0.12, sfxBus, { lp: 3000 }); },
    whoosh(t) { noise(t, 0.5, 0.3, 'bandpass', 400, 1, sfxBus, 2500); },
    blink(t) { osc('sine', 2000, 300, t, 0.15, 0.2); },
    sheath(t) { noise(t, 0.3, 0.2, 'bandpass', 5000, 3, sfxBus, 2000); osc('sine', 3000, 3200, t + 0.25, 0.3, 0.06); },
    coin(t) { osc('square', 988, 988, t, 0.06, 0.1, sfxBus, { lp: 5000 }); osc('square', 1319, 1319, t + 0.06, 0.18, 0.1, sfxBus, { lp: 5000 }); },
    pickup(t) { [523, 659, 784].forEach((f, k) => osc('triangle', f, f, t + k * 0.05, 0.12, 0.25)); },
    oneup(t) { [523, 659, 784, 1047, 784, 1047].forEach((f, k) => osc('square', f, f, t + k * 0.07, 0.12, 0.1, sfxBus, { lp: 4000 })); },
    equip(t) { SFX.clang(t); osc('triangle', 440, 880, t + 0.05, 0.15, 0.2); },
    denied(t) { osc('square', 200, 150, t, 0.15, 0.12, sfxBus, { lp: 1500 }); },
    ready(t) { [660, 880, 1320].forEach((f, k) => osc('square', f, f, t + k * 0.06, 0.1, 0.1, sfxBus, { lp: 5000 })); },
    waveIn(t) { osc('sawtooth', 220, 110, t, 0.3, 0.1, sfxBus, { lp: 1200 }); },
    go(t) { [784, 1047].forEach((f, k) => osc('square', f, f, t + k * 0.1, 0.15, 0.12, sfxBus, { lp: 4000 })); },
    ko(t) { osc('sawtooth', 400, 80, t, 0.4, 0.15, sfxBus, { lp: 1500 }); },
    bossIntro(t) { for (let k = 0; k < 3; k++) osc('sawtooth', 110, 104, t + k * 0.45, 0.4, 0.25, sfxBus, { lp: 900 }); SFX.boom(t + 1.3); },
    select(t) { osc('square', 880, 880, t, 0.04, 0.08, sfxBus, { lp: 4000 }); },
    confirm(t) { osc('square', 660, 660, t, 0.05, 0.1, sfxBus, { lp: 4000 }); osc('square', 990, 990, t + 0.06, 0.1, 0.1, sfxBus, { lp: 4000 }); },
    back(t) { osc('square', 440, 330, t, 0.08, 0.08, sfxBus, { lp: 3000 }); },
    blip(t) { osc('square', 1200 + Math.random() * 200, 1200, t, 0.02, 0.04, sfxBus, { lp: 3000 }); },
    pause(t) { osc('triangle', 660, 440, t, 0.15, 0.2); },
    hurtJ(t) { osc('triangle', 520, 300, t, 0.12, 0.2); },
    playerDown(t) { osc('sawtooth', 600, 60, t, 0.9, 0.18, sfxBus, { lp: 1800 }); },
    heal(t) { [523, 784, 1047].forEach((f, k) => osc('sine', f, f, t + k * 0.06, 0.2, 0.2)); },
    break(t) { noise(t, 0.3, 0.5, 'bandpass', 1500, 0.6, sfxBus, 300); osc('triangle', 200, 60, t, 0.2, 0.3); },
};

export function sfx(id, x) {
    if (!ctx || muted) return;
    const fn = SFX[id];
    if (!fn) return;
    const now = ctx.currentTime;
    if (lastPlayed[id] && now - lastPlayed[id] < 0.03) return;   // de-dupe stacked hits
    lastPlayed[id] = now;
    try { fn(now + 0.005); } catch { /* ignore */ }
    void x;
}

// ---------------------------------------------------------------- music
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], harm: [0, 2, 3, 5, 7, 8, 11] };
export const SONGS = {
    title: { bpm: 92, root: 45, scale: 'minor', prog: [0, 5, 3, 4], style: 'synth', seed: 3, lead: 'saw' },
    neon: { bpm: 128, root: 45, scale: 'minor', prog: [0, 0, 5, 6, 3, 3, 4, 4], style: 'drive', seed: 11, lead: 'square' },
    train: { bpm: 140, root: 43, scale: 'dorian', prog: [0, 3, 0, 4, 5, 3, 6, 4], style: 'run', seed: 21, lead: 'square' },
    market: { bpm: 118, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6, 5, 6, 1, 0], style: 'swing', seed: 31, lead: 'pulse' },
    docks: { bpm: 124, root: 40, scale: 'minor', prog: [0, 6, 5, 6, 0, 6, 3, 4], style: 'drive', seed: 41, lead: 'saw' },
    lab: { bpm: 112, root: 47, scale: 'harm', prog: [0, 0, 1, 1, 5, 5, 4, 4], style: 'tense', seed: 51, lead: 'pulse' },
    spire: { bpm: 136, root: 44, scale: 'minor', prog: [0, 5, 2, 6, 0, 5, 3, 4], style: 'run', seed: 61, lead: 'saw' },
    zenith: { bpm: 132, root: 46, scale: 'dorian', prog: [0, 3, 6, 4, 0, 3, 5, 4], style: 'drive', seed: 71, lead: 'square' },
    boss1: { bpm: 150, root: 40, scale: 'phrygian', prog: [0, 1, 0, 1, 6, 5, 6, 1], style: 'boss', seed: 101, lead: 'saw' },
    boss2: { bpm: 156, root: 42, scale: 'harm', prog: [0, 5, 4, 0, 0, 5, 6, 4], style: 'boss', seed: 102, lead: 'square' },
    boss3: { bpm: 144, root: 45, scale: 'phrygian', prog: [0, 1, 0, 6, 5, 1, 0, 0], style: 'boss', seed: 103, lead: 'pulse' },
    boss4: { bpm: 148, root: 38, scale: 'minor', prog: [0, 6, 5, 4, 0, 6, 5, 6], style: 'boss', seed: 104, lead: 'saw' },
    boss5: { bpm: 140, root: 41, scale: 'harm', prog: [0, 1, 5, 4, 0, 1, 5, 6], style: 'boss', seed: 105, lead: 'pulse' },
    boss6: { bpm: 152, root: 44, scale: 'minor', prog: [0, 5, 6, 4, 0, 5, 3, 4], style: 'boss', seed: 106, lead: 'square' },
    boss7: { bpm: 160, root: 39, scale: 'harm', prog: [0, 5, 1, 4, 0, 5, 6, 4], style: 'boss', seed: 107, lead: 'saw' },
    shop: { bpm: 96, root: 48, scale: 'dorian', prog: [0, 3, 4, 3], style: 'chill', seed: 201, lead: 'pulse' },
    ending: { bpm: 100, root: 48, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], style: 'synth', seed: 301, lead: 'saw' },
    results: { bpm: 120, root: 48, scale: 'major', prog: [0, 3, 4, 0], style: 'chill', seed: 401, lead: 'square' },
};

function srng(seed) { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; }
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const DRUMS = {
    drive: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', o: '..............x.' },
    run: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx', o: '' },
    swing: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.xx.xx.x.xx.xx.', o: '' },
    tense: { k: 'x.......x.x.....', s: '........x.......', h: '..x...x...x...x.', o: '......x.......x.' },
    boss: { k: 'x.x.x..xx.x.x..x', s: '....x.......x.xx', h: 'x.xxx.xxx.xxx.xx', o: '' },
    synth: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.', o: '' },
    chill: { k: 'x.....x.........', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '' },
};

class Sequencer {
    constructor() { this.song = null; this.step = 0; this.next = 0; this.timer = null; this.gain = null; }
    play(name) {
        if (!ctx) return;
        if (this.name === name) return;
        this.stop();
        const s = SONGS[name];
        if (!s) return;
        this.name = name; this.song = s;
        this.gain = ctx.createGain(); this.gain.gain.value = 0.0001; this.gain.connect(musicBus);
        this.gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6);
        this.build(s);
        this.step = 0; this.next = ctx.currentTime + 0.08;
        this.timer = setInterval(() => this.tick(), 25);
    }
    stop(fade = 0.4) {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        if (this.gain && ctx) { const g = this.gain; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade); setTimeout(() => g.disconnect(), fade * 1000 + 100); }
        this.gain = null; this.name = null;
    }
    build(s) {
        const r = srng(s.seed * 7919 + 1);
        const sc = SCALES[s.scale];
        const deg = (d, oct = 0) => s.root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
        this.chords = s.prog.map((d) => [deg(d), deg(d + 2), deg(d + 4)]);
        // motif: 16 steps of (degree offset | null), reused over every chord
        const motif = [];
        for (let i = 0; i < 16; i++) {
            const on = i % 4 === 0 ? r() < 0.9 : i % 2 === 0 ? r() < 0.55 : r() < 0.22;
            motif.push(on ? [0, 2, 4, 7, 5, 2, 4, 6][Math.floor(r() * 8)] : null);
        }
        const motifB = motif.map((m, i) => (m === null ? (i % 4 === 2 && r() < 0.4 ? 3 : null) : m + (r() < 0.3 ? 1 : 0)));
        this.motifs = [motif, motifB];
        this.bassPat = [
            'x.x.x.x.x.x.x.x.', 'x..xx..xx..xx.x.', 'x...x.x.x...x.xx', 'x.xxx.x.x.xxx.x.',
        ][Math.floor(r() * 4)];
        if (s.style === 'chill' || s.style === 'synth') this.bassPat = 'x.......x...x...';
        if (s.style === 'boss') this.bassPat = 'xxx.xxx.xxx.x.xx';
        this.arpPat = [0, 1, 2, 1, 0, 2, 1, 2];
        this.drums = DRUMS[s.style] || DRUMS.drive;
        this.leadType = s.lead;
        this.bars = 0;
    }
    tick() {
        if (!ctx || !this.song) return;
        const spb = 60 / this.song.bpm / 4;
        while (this.next < ctx.currentTime + 0.15) {
            this.schedule(this.step, this.next, spb);
            this.next += spb;
            this.step++;
        }
    }
    schedule(step, t, spb) {
        const s = this.song, i = step % 16, bar = Math.floor(step / 16);
        const chord = this.chords[bar % this.chords.length];
        const section = Math.floor(bar / this.chords.length) % 4;   // 0 intro-ish, 1-3 full
        const out = this.gain;
        // drums
        const D = this.drums;
        if (D.k[i] === 'x') { osc('sine', 150, 40, t, 0.16, 0.9, out); }
        if (D.s[i] === 'x' && section > 0) { noise(t, 0.12, 0.38, 'bandpass', 1800, 0.8, out); osc('triangle', 220, 160, t, 0.06, 0.25, out); }
        if (D.h[i] === 'x') noise(t, 0.03, 0.12, 'highpass', 7000, 0.6, out);
        if (D.o && D.o[i] === 'x') noise(t, 0.16, 0.12, 'highpass', 6000, 0.5, out);
        // bass
        if (this.bassPat[i] === 'x') {
            const n = chord[0] - 12 + (i % 8 === 6 && s.style !== 'chill' ? 12 : 0);
            osc('sawtooth', mtof(n), mtof(n), t, spb * 1.6, 0.28, out, { lp: 700 + (s.style === 'boss' ? 500 : 0), q: 4 });
        }
        // arp (square), kicks in after the first section
        if (section > 0 || s.style === 'synth' || s.style === 'chill') {
            if (i % 2 === 0) {
                const n = chord[this.arpPat[(i / 2) % 8]] + 12 + (bar % 2 && i > 8 ? 12 : 0);
                osc('square', mtof(n), mtof(n), t, spb * 1.2, 0.05, out, { lp: 2600 });
            }
        }
        // pad on bar starts
        if (i === 0) for (const n of chord) for (const dt of [-8, 8]) osc('sawtooth', mtof(n), mtof(n), t, spb * 15, 0.035, out, { lp: 1100, a: 0.3, detune: dt });
        // lead
        if (section >= 1 && section !== 2) {
            const motif = this.motifs[bar % 2];
            const m = motif[i];
            if (m !== null) {
                const sc = SCALES[s.scale];
                const rootDeg = sc.indexOf(((chord[0] - s.root) % 12 + 12) % 12);
                const d = (rootDeg < 0 ? 0 : rootDeg) + m;
                const n = s.root + 12 + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
                const type = this.leadType === 'saw' ? 'sawtooth' : 'square';
                const o = osc(type, mtof(n), mtof(n), t, spb * 2.2, 0.075, out, { lp: this.leadType === 'pulse' ? 1800 : 3200, detune: this.leadType === 'pulse' ? 6 : 0 });
                // vibrato
                const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + spb * 2.3);
            }
        }
    }
}
const seq = new Sequencer();
export function playMusic(name) { wanted = name; if (!ctx) return; seq.play(name); }
export function stopMusic(fade) { seq.stop(fade); }
export function currentSong() { return seq.name; }

/** Short jingles (stage clear, game over). */
export function jingle(kind) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    if (kind === 'clear') { seq.stop(0.2); [60, 64, 67, 72, 67, 72, 76].forEach((n, k) => osc('square', mtof(n + 12), mtof(n + 12), t + k * 0.11, 0.2, 0.12, musicBus, { lp: 4000 })); [48, 55, 60].forEach((n) => osc('sawtooth', mtof(n), mtof(n), t + 0.66, 1.2, 0.08, musicBus, { lp: 1500 })); }
    if (kind === 'over') { seq.stop(0.2); [64, 62, 60, 59, 55].forEach((n, k) => osc('square', mtof(n), mtof(n), t + k * 0.25, 0.3, 0.1, musicBus, { lp: 2000 })); }
    if (kind === 'boss') { SFX.bossIntro(t); }
}
