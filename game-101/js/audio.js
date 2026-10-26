// Procedural chiptune, all Web Audio, no files. A look-ahead sequencer (a 25 ms timer schedules every
// 16th note inside the next 120 ms on the AudioContext clock) plays one of five tunes, composed from a
// seed the moment it starts: town, dungeon (slow, sparse, in the floor's key), battle, boss and a
// calm one for menus. Sound effects are one-shot voices.
//
// The context is made on the first gesture; ../lib/page-audio.js suspends it in a hidden tab.

import { makeRng } from './rng.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], penta: [0, 3, 5, 7, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
};
const DUNGEON_KEYS = [
    { root: 45, scale: 'minor' }, { root: 43, scale: 'phrygian' }, { root: 48, scale: 'dorian' }, { root: 50, scale: 'penta' }, { root: 41, scale: 'phrygian' },
    { root: 46, scale: 'minor' }, { root: 44, scale: 'lydian' }, { root: 47, scale: 'dorian' }, { root: 42, scale: 'minor' }, { root: 40, scale: 'phrygian' },
];

function degree(scale, root, deg) {
    const s = SCALES[scale], n = s.length;
    const oct = Math.floor(deg / n), i = ((deg % n) + n) % n;
    return root + s[i] + 12 * oct;
}

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.mode = 'off';
        this.track = null;
        this.step = 0;
        this.nextT = 0;
        this.timer = null;
        this.noiseBuf = null;
        this.lastSfx = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 5;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        const len = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let s = 1;
        for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
        if (this.mode !== 'off') this.startSeq();
    }
    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }

    // ------------------------------------------------------------------ voices
    tone({ f = 440, to = f, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus = 'sfx', attack = 0.005 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this[bus]);
        o.start(t); o.stop(t + dur + 0.03);
    }
    noise({ dur = 0.1, vol = 0.15, delay = 0, freq = 3000, type = 'lowpass', to = freq, bus = 'sfx' } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const flt = this.ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(freq, t);
        if (to !== freq) flt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(flt); flt.connect(g); g.connect(this[bus]);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }
    arp(notes, { step = 0.07, type = 'square', vol = 0.15, dur = 0.12 } = {}) {
        notes.forEach((n, i) => this.tone({ f: mtof(n), dur, type, vol, delay: i * step }));
    }

    sfxPlay(name) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.lastSfx[name] && now - this.lastSfx[name] < 0.03) return;
        this.lastSfx[name] = now;
        const T = (o) => this.tone(o), N = (o) => this.noise(o);
        switch (name) {
            case 'step': N({ dur: 0.05, vol: 0.07, freq: 500 }); T({ f: 70, to: 50, dur: 0.06, type: 'triangle', vol: 0.12 }); break;
            case 'turn': N({ dur: 0.05, vol: 0.05, freq: 900, to: 300 }); break;
            case 'bump': T({ f: 90, to: 45, dur: 0.1, type: 'triangle', vol: 0.25 }); N({ dur: 0.06, vol: 0.12, freq: 400 }); break;
            case 'door': T({ f: 140, to: 260, dur: 0.28, type: 'sawtooth', vol: 0.07 }); N({ dur: 0.25, vol: 0.06, freq: 700, to: 200 }); break;
            case 'secret': this.arp([76, 79, 83, 88], { step: 0.06, type: 'triangle', vol: 0.12 }); break;
            case 'found': this.arp([72, 76, 79], { step: 0.05, type: 'triangle', vol: 0.12 }); break;
            case 'search': N({ dur: 0.18, vol: 0.05, freq: 1200, to: 2400, type: 'bandpass' }); break;
            case 'trap': T({ f: 200, to: 60, dur: 0.35, type: 'sawtooth', vol: 0.18 }); N({ dur: 0.3, vol: 0.14, freq: 2000, to: 300 }); break;
            case 'chest': this.arp([60, 64, 67, 72, 76], { step: 0.06, vol: 0.14 }); break;
            case 'item': this.arp([79, 84], { step: 0.07, type: 'square', vol: 0.12 }); break;
            case 'gold': T({ f: 1318, dur: 0.07, vol: 0.12 }); T({ f: 1760, dur: 0.14, vol: 0.12, delay: 0.07 }); break;
            case 'hit': N({ dur: 0.12, vol: 0.2, freq: 3000, to: 300 }); T({ f: 220, to: 70, dur: 0.12, type: 'square', vol: 0.16 }); break;
            case 'crit': N({ dur: 0.18, vol: 0.25, freq: 4000, to: 200 }); T({ f: 500, to: 80, dur: 0.2, type: 'sawtooth', vol: 0.18 }); T({ f: 1000, dur: 0.08, vol: 0.1, delay: 0.02 }); break;
            case 'miss': N({ dur: 0.14, vol: 0.07, freq: 2500, to: 600, type: 'bandpass' }); break;
            case 'hurt': N({ dur: 0.18, vol: 0.2, freq: 1500, to: 200 }); T({ f: 160, to: 55, dur: 0.2, type: 'sawtooth', vol: 0.2 }); break;
            case 'heal': this.arp([64, 67, 71, 76], { step: 0.07, type: 'triangle', vol: 0.15, dur: 0.16 }); break;
            case 'spell': T({ f: 300, to: 1400, dur: 0.3, type: 'square', vol: 0.1 }); break;
            case 'fire': N({ dur: 0.4, vol: 0.18, freq: 600, to: 3000 }); T({ f: 200, to: 600, dur: 0.35, type: 'sawtooth', vol: 0.1 }); break;
            case 'ice': T({ f: 2000, to: 500, dur: 0.3, type: 'triangle', vol: 0.12 }); T({ f: 3000, to: 900, dur: 0.25, type: 'square', vol: 0.05 }); break;
            case 'shock': T({ f: 900, to: 90, dur: 0.18, type: 'sawtooth', vol: 0.14 }); N({ dur: 0.16, vol: 0.15, freq: 5000, type: 'highpass' }); break;
            case 'holy': this.arp([76, 83, 88, 95], { step: 0.05, type: 'triangle', vol: 0.12, dur: 0.25 }); break;
            case 'dark': T({ f: 120, to: 60, dur: 0.4, type: 'sawtooth', vol: 0.15 }); T({ f: 123, to: 61, dur: 0.4, type: 'sawtooth', vol: 0.12 }); break;
            case 'buff': this.arp([60, 67, 72], { step: 0.05, vol: 0.12 }); break;
            case 'die': T({ f: 400, to: 40, dur: 0.5, type: 'sawtooth', vol: 0.14 }); N({ dur: 0.4, vol: 0.12, freq: 1500, to: 100 }); break;
            case 'levelup': this.arp([60, 64, 67, 72, 67, 72, 76, 79], { step: 0.09, vol: 0.14, dur: 0.16 }); break;
            case 'stairs': this.arp([72, 67, 64, 60, 55], { step: 0.08, type: 'triangle', vol: 0.14, dur: 0.2 }); break;
            case 'buy': T({ f: 880, dur: 0.05, vol: 0.12 }); T({ f: 1320, dur: 0.1, vol: 0.12, delay: 0.05 }); break;
            case 'sell': T({ f: 1320, dur: 0.05, vol: 0.12 }); T({ f: 880, dur: 0.1, vol: 0.12, delay: 0.05 }); break;
            case 'click': T({ f: 660, dur: 0.04, type: 'triangle', vol: 0.1 }); break;
            case 'open': T({ f: 440, to: 660, dur: 0.07, type: 'triangle', vol: 0.12 }); break;
            case 'close': T({ f: 660, to: 440, dur: 0.07, type: 'triangle', vol: 0.12 }); break;
            case 'error': T({ f: 130, dur: 0.12, type: 'square', vol: 0.12 }); T({ f: 110, dur: 0.16, type: 'square', vol: 0.12, delay: 0.08 }); break;
            case 'day': T({ f: 523, dur: 0.6, type: 'triangle', vol: 0.12 }); T({ f: 784, dur: 0.8, type: 'triangle', vol: 0.1, delay: 0.1 }); break;
            case 'rest': this.arp([64, 60, 55, 52], { step: 0.18, type: 'triangle', vol: 0.12, dur: 0.4 }); break;
            case 'invest': this.arp([60, 64, 67, 72, 76, 84], { step: 0.05, vol: 0.12 }); break;
            case 'curse': T({ f: 90, to: 45, dur: 0.6, type: 'sawtooth', vol: 0.2 }); T({ f: 95, to: 48, dur: 0.6, type: 'square', vol: 0.12 }); break;
            case 'tele': T({ f: 200, to: 2000, dur: 0.3, type: 'sine', vol: 0.12 }); T({ f: 2000, to: 200, dur: 0.3, type: 'sine', vol: 0.1, delay: 0.3 }); break;
            case 'bossIn': T({ f: 70, to: 35, dur: 1.0, type: 'sawtooth', vol: 0.22 }); N({ dur: 0.9, vol: 0.15, freq: 300, to: 100 }); break;
            case 'win': this.arp([67, 67, 67, 72, 71, 67, 72], { step: 0.11, vol: 0.14, dur: 0.14 }); break;
            case 'lose': this.arp([60, 59, 58, 57, 52], { step: 0.25, type: 'sawtooth', vol: 0.12, dur: 0.4 }); break;
            case 'encounter': T({ f: 300, to: 80, dur: 0.4, type: 'sawtooth', vol: 0.18 }); N({ dur: 0.3, vol: 0.12, freq: 2500, to: 200 }); T({ f: 600, to: 150, dur: 0.3, type: 'square', vol: 0.1, delay: 0.12 }); break;
            case 'flee': this.arp([72, 70, 67, 64, 60], { step: 0.04, type: 'triangle', vol: 0.1, dur: 0.08 }); break;
            default: break;
        }
    }

    // ------------------------------------------------------------------ music
    /** mode: off | town | dungeon | battle | boss | menu. seed makes the tune. */
    setMusic(mode, seed = 1) {
        const key = `${mode}:${seed}`;
        if (key === this.key) return;
        this.key = key;
        this.mode = mode;
        this.track = mode === 'off' ? null : this.compose(mode, seed);
        this.step = 0;
        if (this.ctx) {
            if (mode === 'off') this.stopSeq(); else { this.nextT = this.ctx.currentTime + 0.08; this.startSeq(); }
        }
    }
    startSeq() {
        if (this.timer || !this.ctx || !this.track) return;
        this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.05);
        this.timer = setInterval(() => this.tick(), 25);
    }
    stopSeq() { clearInterval(this.timer); this.timer = null; }

    compose(mode, seed) {
        const r = makeRng(seed * 7919 + mode.length * 31);
        const P = {
            town: { bpm: 108, scale: 'major', root: 55, prog: [0, 5, 3, 4], lead: 0.55, drums: 'light', waveL: 'square', bassOct: -1 },
            menu: { bpm: 76, scale: 'dorian', root: 50, prog: [0, 3, 5, 4], lead: 0.35, drums: 'none', waveL: 'triangle', bassOct: -1 },
            dungeon: { bpm: 52, scale: 'minor', root: 45, prog: [0, 0, 5, 3], lead: 0.1, drums: 'none', waveL: 'triangle', bassOct: -1 },
            battle: { bpm: 152, scale: 'minor', root: 52, prog: [0, 5, 3, 4], lead: 0.7, drums: 'full', waveL: 'square', bassOct: -1 },
            boss: { bpm: 164, scale: 'phrygian', root: 47, prog: [0, 1, 0, 6], lead: 0.8, drums: 'full', waveL: 'square', bassOct: -2 },
        }[mode];
        if (mode === 'dungeon') { const k = DUNGEON_KEYS[seed % DUNGEON_KEYS.length]; P.root = k.root; P.scale = k.scale; P.bpm = 48 + (seed % 5) * 3; }
        if (mode === 'battle') { P.root = 48 + (seed % 5); }
        // 4 bars × 16 steps of lead (scale degrees, -99 = rest), a motif then a variation
        const mot = [];
        for (let i = 0; i < 16; i++) mot.push(r() < P.lead ? (r.int(0, 7)) : -99);
        mot[0] = mot[0] === -99 ? 0 : mot[0];
        const lead = [];
        for (let bar = 0; bar < 4; bar++) for (let i = 0; i < 16; i++) {
            let d = mot[i];
            if (bar % 2 === 1 && d !== -99 && r() < 0.35) d += r.pick([-2, -1, 1, 2]);
            if (bar === 3 && i > 11) d = r() < 0.5 ? -99 : d;
            lead.push(d === -99 ? -99 : d + P.prog[bar]);
        }
        return { ...P, lead, mot };
    }

    tick() {
        if (!this.ctx || this.ctx.state !== 'running' || !this.track) return;
        const tr = this.track, sd = 60 / tr.bpm / 4;
        while (this.nextT < this.ctx.currentTime + 0.12) {
            this.playStep(this.step, this.nextT, tr, sd);
            this.step = (this.step + 1) % 64;
            this.nextT += sd;
        }
    }
    note(m, t, dur, type, vol) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = mtof(m);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + dur + 0.03);
    }
    drum(kind, t) {
        const c = this.ctx;
        if (kind === 'k') {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
            g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.18);
        } else {
            const src = c.createBufferSource(); src.buffer = this.noiseBuf;
            const f = c.createBiquadFilter(); f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
            const g = c.createGain(); g.gain.setValueAtTime(kind === 's' ? 0.3 : 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 's' ? 0.12 : 0.04));
            src.connect(f); f.connect(g); g.connect(this.music); src.start(t, 0.1); src.stop(t + 0.15);
        }
    }
    playStep(s, t, tr, sd) {
        const bar = (s >> 4) & 3, i = s & 15;
        const root = degree(tr.scale, tr.root, tr.prog[bar]);
        const dungeon = this.mode === 'dungeon';
        if (dungeon) {
            if (i === 0) { this.note(root - 12, t, sd * 14, 'triangle', 0.5); this.note(root - 5, t, sd * 14, 'triangle', 0.18); }
            if (tr.lead[s] !== -99 && (i === 4 || i === 10 || i === 13)) this.note(degree(tr.scale, tr.root + 12, tr.lead[s]), t, sd * 5, 'sine', 0.13);
            return;
        }
        // bass
        const bassPat = this.mode === 'battle' || this.mode === 'boss' ? [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0] : [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0];
        if (bassPat[i]) this.note(root + 12 * tr.bassOct + (i % 8 === 6 ? 7 : 0), t, sd * 1.8, 'triangle', 0.5);
        // lead
        const d = tr.lead[s];
        if (d !== -99) this.note(degree(tr.scale, tr.root + 12, d), t, sd * (i % 4 === 0 ? 3 : 1.6), tr.waveL, tr.waveL === 'square' ? 0.11 : 0.22);
        // pad / arpeggio
        if (this.mode !== 'battle' && this.mode !== 'boss' && i % 4 === 2) this.note(degree(tr.scale, tr.root + 12, tr.prog[bar] + [0, 2, 4, 2][(i >> 2) & 3]), t, sd * 2, 'triangle', 0.1);
        // drums
        if (tr.drums === 'full') {
            if (i % 4 === 0) this.drum('k', t);
            if (i === 4 || i === 12) this.drum('s', t);
            if (i % 2 === 0) this.drum('h', t);
        } else if (tr.drums === 'light') {
            if (i === 0 || i === 8) this.drum('k', t);
            if (i === 4 || i === 12) this.drum('h', t);
        }
    }
}
