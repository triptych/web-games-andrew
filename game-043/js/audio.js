// ============================================================
// Generated music and sound, all Web Audio.
// A seeded COMPOSER writes a 16-bar AABA tune per mood (chords from
// the mode's pool, a motif-based melody that lands on chord tones,
// bass, arpeggio/music-box counter-line, soft drums). A look-ahead
// SEQUENCER plays it; moods crossfade. Everything no-ops without
// an AudioContext (Node, or before the first tap).
// ============================================================

import { RNG, hash32 } from './core/rng.js';

const MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const PROGS = {
    bright: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 0, 4], [5, 3, 0, 4], [0, 1, 3, 4]],
    dark: [[0, 5, 6, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 5, 3, 6], [0, 1, 0, 6]],
};
export const MOODS = {
    title:    { mode: 'lydian', root: 53, bpm: 76, lead: 'box', arp: 'pad', drums: 0, prog: 'bright', density: 0.55 },
    glen:     { mode: 'ionian', root: 60, bpm: 88, lead: 'flute', arp: 'box', drums: 1, prog: 'bright', density: 0.7 },
    night:    { mode: 'lydian', root: 51, bpm: 64, lead: 'box', arp: 'pad', drums: 0, prog: 'bright', density: 0.4 },
    forest:   { mode: 'dorian', root: 62, bpm: 84, lead: 'flute', arp: 'pluck', drums: 1, prog: 'dark', density: 0.65 },
    downs:    { mode: 'mixolydian', root: 55, bpm: 98, lead: 'flute', arp: 'pluck', drums: 2, prog: 'bright', density: 0.75 },
    lake:     { mode: 'aeolian', root: 64, bpm: 72, lead: 'box', arp: 'pad', drums: 0, prog: 'dark', density: 0.5 },
    crags:    { mode: 'phrygian', root: 50, bpm: 92, lead: 'reed', arp: 'pluck', drums: 2, prog: 'dark', density: 0.6 },
    heights:  { mode: 'aeolian', root: 59, bpm: 70, lead: 'bell', arp: 'pad', drums: 0, prog: 'dark', density: 0.45 },
    dungeon:  { mode: 'phrygian', root: 49, bpm: 66, lead: 'box', arp: 'drone', drums: 0, prog: 'dark', density: 0.35 },
    cave:     { mode: 'dorian', root: 45, bpm: 60, lead: 'bell', arp: 'drone', drums: 0, prog: 'dark', density: 0.3 },
    battle:   { mode: 'aeolian', root: 52, bpm: 132, lead: 'reed', arp: 'bass8', drums: 3, prog: 'dark', density: 0.8 },
    boss:     { mode: 'harmonic', root: 50, bpm: 144, lead: 'reed', arp: 'bass8', drums: 3, prog: 'dark', density: 0.85 },
    festival: { mode: 'ionian', root: 60, bpm: 112, lead: 'bell', arp: 'box', drums: 2, prog: 'bright', density: 0.8 },
};
const BIOME_MOOD = { forest: 'forest', downs: 'downs', lake: 'lake', crags: 'crags', heights: 'heights' };
export const moodForBiome = b => BIOME_MOOD[b] ?? 'glen';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function compose(seed, moodName) {
    const M = MOODS[moodName] ?? MOODS.glen;
    const r = new RNG(hash32(seed, 'song', moodName));
    const scale = MODES[M.mode];
    const deg = (d, oct = 0) => M.root + scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
    const progA = r.pick(PROGS[M.prog]), progB = r.pick(PROGS[M.prog]);
    const motif = () => {
        const m = [];
        for (let k = 0; k < 8; k++) m.push(r.chance(M.density) || k === 0 ? r.pick([0, 2, 4, 4, 2, 1, 3, 5, 7]) : null);
        return m;
    };
    const mA = motif(), mB = motif();
    const bars = [];
    const sections = ['A', 'A', 'B', 'A'];
    for (const sec of sections) for (let b = 0; b < 4; b++) {
        const chord = (sec === 'B' ? progB : progA)[b];
        const mot = sec === 'B' ? mB : mA;
        const notes = mot.map((d, k) => {
            if (d === null) return null;
            // strong beats land on chord tones
            let deg2 = chord + d;
            if (k % 4 === 0) deg2 = chord + [0, 2, 4][((d / 2) | 0) % 3];
            if (b === 3 && sec !== 'B' && k >= 6) return k === 6 ? deg(chord + 7) : null;
            return deg(deg2 + 7);
        });
        bars.push({ chord, chordNotes: [deg(chord), deg(chord + 2), deg(chord + 4)], notes, sec });
    }
    return { mood: moodName, M, bars, spb: 60 / M.bpm / 2 };   // seconds per eighth
}

export class Audio {
    constructor() { this.ctx = null; this.musicVol = 0.6; this.sfxVol = 0.8; this.song = null; this.mood = null; this.seed = 1; this.step = 0; this.next = 0; this.rain = null; }
    init() {
        if (this.ctx || typeof window === 'undefined') return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol * 0.6; this.sfxBus.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol * 0.35;
        this.musicLP = c.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 5200;
        this.musicBus.connect(this.musicLP); this.musicLP.connect(this.master);
        // a soft echo for space
        const d = c.createDelay(1); d.delayTime.value = 0.28; const fb = c.createGain(); fb.gain.value = 0.28; const wet = c.createGain(); wet.gain.value = 0.22;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        this.musicLP.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(this.master);
        this.fade = c.createGain(); this.fade.gain.value = 1; this.fade.connect(this.musicBus);
        const n = c.createBuffer(1, c.sampleRate, c.sampleRate), ch = n.getChannelData(0);
        let s = 0x12345; for (let i = 0; i < ch.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; ch[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
        this.noiseBuf = n;
        this.timer = setInterval(() => this.tick(), 40);
    }
    resume() { if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {}); }
    suspend() { if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {}); }
    setVolumes(music, sfx) {
        this.musicVol = music; this.sfxVol = sfx;
        if (!this.ctx) return;
        this.musicBus.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.1);
        this.sfxBus.gain.setTargetAtTime(sfx * 0.6, this.ctx.currentTime, 0.05);
    }

    // ------------------------------------------------------------ music
    play(mood, seed = this.seed) {
        this.seed = seed;
        if (mood === this.mood) return;
        this.mood = mood;
        if (!this.ctx) return;
        const c = this.ctx, t = c.currentTime;
        this.fade.gain.cancelScheduledValues(t);
        this.fade.gain.setTargetAtTime(0, t, 0.25);
        clearTimeout(this.swap);
        this.swap = setTimeout(() => {
            this.song = mood ? compose(seed, mood) : null;
            this.step = 0; this.next = this.ctx.currentTime + 0.1;
            this.fade.gain.cancelScheduledValues(this.ctx.currentTime);
            this.fade.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
        }, 700);
    }
    tick() {
        const c = this.ctx; if (!c || !this.song || c.state !== 'running') return;
        while (this.next < c.currentTime + 0.18) { this.playStep(this.step, this.next); this.step++; this.next += this.song.spb; }
    }
    playStep(step, t) {
        const S = this.song, M = S.M;
        const bar = S.bars[Math.floor(step / 8) % S.bars.length], k = step % 8;
        const spb = S.spb;
        // pad / chord
        if (k === 0) {
            if (M.arp === 'pad' || M.arp === 'drone' || M.arp === 'box' || M.arp === 'pluck') this.pad(bar.chordNotes.map(n => n - 12), spb * 8, t, M.arp === 'drone' ? 0.05 : 0.035);
            if (M.arp !== 'bass8') this.bass(bar.chordNotes[0] - 24, spb * 3, t, 0.2);
        }
        if (k === 4 && M.arp !== 'bass8' && M.arp !== 'drone') this.bass(bar.chordNotes[k % 3 === 0 ? 0 : 2] - 24, spb * 2, t, 0.14);
        // counter-line
        if (M.arp === 'box' && k % 2 === 1) this.box(bar.chordNotes[(k >> 1) % 3] + 12, spb * 2, t, 0.05);
        if (M.arp === 'pluck' && k % 2 === 0) this.pluck(bar.chordNotes[(k >> 1) % 3], spb * 1.5, t, 0.07);
        if (M.arp === 'bass8') this.bass(bar.chordNotes[k === 6 ? 2 : 0] - 24 + (k % 2 ? 12 : 0), spb * 0.9, t, 0.2);
        // lead
        const n = bar.notes[k];
        if (n != null) {
            const hold = bar.notes[k + 1] == null ? 2 : 1;
            const v = 0.11;
            if (M.lead === 'flute') this.flute(n, spb * hold * 0.95, t, v);
            else if (M.lead === 'box') this.box(n, spb * 3, t, v * 0.9);
            else if (M.lead === 'bell') this.bell(n, spb * 4, t, v * 0.8);
            else this.reed(n, spb * hold * 0.9, t, v * 0.75);
        }
        // drums
        if (M.drums >= 1 && k % 2 === 1) this.shaker(t, 0.03);
        if (M.drums >= 2 && (k === 0 || k === 4)) this.kick(t, 0.25);
        if (M.drums >= 2 && (k === 2 || k === 6) && M.drums >= 3) this.snare(t, 0.12);
        if (M.drums === 2 && k === 4) this.snare(t, 0.06);
    }

    // ------------------------------------------------------------ instruments
    env(g, t, a, peak, dur, rel = 0.1) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur - rel), rel / 3);
    }
    osc(type, f, t, dur, vol, bus, a = 0.01, rel = 0.1, detune = 0) {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = f; o.detune.value = detune;
        this.env(g, t, a, vol, dur, rel);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + dur + rel * 2 + 0.05);
        return o;
    }
    pad(notes, dur, t, vol) {
        const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(this.fade);
        for (const n of notes) { this.osc('triangle', mtof(n), t, dur, vol, lp, 0.5, 0.6, -6); this.osc('triangle', mtof(n), t, dur, vol, lp, 0.5, 0.6, 7); }
    }
    bass(n, dur, t, vol) { this.osc('triangle', mtof(n), t, dur, vol, this.fade, 0.005, 0.12); }
    box(n, dur, t, vol) { this.osc('sine', mtof(n), t, dur, vol, this.fade, 0.004, dur * 0.8); this.osc('sine', mtof(n) * 3, t, dur * 0.4, vol * 0.18, this.fade, 0.003, 0.2); }
    bell(n, dur, t, vol) { this.osc('sine', mtof(n), t, dur, vol, this.fade, 0.003, dur); this.osc('sine', mtof(n) * 2.76, t, dur * 0.5, vol * 0.25, this.fade, 0.003, 0.4); this.osc('sine', mtof(n) * 5.4, t, dur * 0.3, vol * 0.1, this.fade, 0.002, 0.2); }
    pluck(n, dur, t, vol) { const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(400, t + dur); lp.connect(this.fade); this.osc('sawtooth', mtof(n), t, dur, vol * 0.6, lp, 0.003, 0.1); }
    flute(n, dur, t, vol) {
        const c = this.ctx, o = this.osc('sine', mtof(n), t, dur, vol, this.fade, 0.06, 0.12);
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = mtof(n) * 0.006;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.15); lfo.stop(t + dur + 0.3);
        this.osc('triangle', mtof(n) * 2, t, dur, vol * 0.12, this.fade, 0.05, 0.1);
    }
    reed(n, dur, t, vol) { const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(this.fade); this.osc('square', mtof(n), t, dur, vol * 0.5, lp, 0.02, 0.08); }
    noise(t, dur, vol, type, freq, bus = this.fade) {
        const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
        const g = c.createGain(); this.env(g, t, 0.002, vol, dur, dur * 0.8);
        s.connect(f); f.connect(g); g.connect(bus);
        s.start(t, (t * 13.1) % 0.9); s.stop(t + dur + 0.1);
    }
    shaker(t, v) { this.noise(t, 0.05, v, 'highpass', 6000); }
    snare(t, v) { this.noise(t, 0.12, v, 'bandpass', 1800); }
    kick(t, v) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15); this.env(g, t, 0.003, v, 0.18, 0.08); o.connect(g); g.connect(this.fade); o.start(t); o.stop(t + 0.3); }

    setRain(on, heavy) {
        if (!this.ctx) return;
        if (on && !this.rain) {
            const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
            const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = heavy ? 900 : 1400; f.Q.value = 0.6;
            const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(heavy ? 0.12 : 0.07, c.currentTime, 1);
            s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start();
            this.rain = { s, g };
        } else if (!on && this.rain) {
            const r = this.rain; this.rain = null;
            r.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
            setTimeout(() => { try { r.s.stop(); } catch { /* ignore */ } }, 2000);
        }
    }

    // ------------------------------------------------------------ sound effects
    sfx(name) {
        const c = this.ctx; if (!c || c.state !== 'running') return;
        const t = c.currentTime, B = this.sfxBus;
        const tone = (type, f0, f1, dur, vol, when = 0) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = type; o.frequency.setValueAtTime(f0, t + when);
            if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + when + dur);
            g.gain.setValueAtTime(vol, t + when); g.gain.exponentialRampToValueAtTime(0.0008, t + when + dur);
            o.connect(g); g.connect(B); o.start(t + when); o.stop(t + when + dur + 0.02);
        };
        const nz = (dur, vol, type, freq, when = 0) => this.noise(t + when, dur, vol, type, freq, B);
        const arp = (notes, step, type = 'sine', vol = 0.12, len = step * 1.5) => notes.forEach((m, i) => tone(type, mtof(m), mtof(m), len, vol, i * step));
        switch (name) {
            case 'swing': nz(0.08, 0.08, 'bandpass', 2200); break;
            case 'chop': tone('triangle', 220, 120, 0.08, 0.25); nz(0.06, 0.15, 'bandpass', 900); break;
            case 'pick': tone('square', 1400, 900, 0.05, 0.05); nz(0.05, 0.12, 'highpass', 3000); break;
            case 'clink': tone('square', 2200, 2000, 0.06, 0.04); break;
            case 'cut': nz(0.1, 0.1, 'highpass', 4000); break;
            case 'till': nz(0.12, 0.18, 'lowpass', 600); break;
            case 'plant': tone('sine', 500, 700, 0.08, 0.1); break;
            case 'water': nz(0.25, 0.08, 'bandpass', 2500); tone('sine', 900, 500, 0.15, 0.04); break;
            case 'harvest': arp([72, 76, 79], 0.05, 'triangle', 0.1); break;
            case 'pickup': tone('sine', 880, 1320, 0.08, 0.1); break;
            case 'eat': nz(0.05, 0.1, 'bandpass', 1200); nz(0.05, 0.1, 'bandpass', 1000, 0.1); break;
            case 'learn': case 'magic': arp([72, 76, 79, 84, 88], 0.06, 'sine', 0.1, 0.4); break;
            case 'faded': arp([84, 88], 0.12, 'sine', 0.04, 0.5); break;
            case 'sparkle': arp([88, 91, 96], 0.04, 'sine', 0.05); break;
            case 'fanfare': case 'victory': arp([67, 72, 76, 79, 84], 0.09, 'triangle', 0.13, 0.25); arp([60, 64, 67], 0.0, 'sine', 0.08, 0.9); break;
            case 'levelup': case 'chapter': arp([60, 64, 67, 72, 76, 79, 84], 0.07, 'triangle', 0.12, 0.3); break;
            case 'skill': case 'chime': arp([79, 84], 0.08, 'sine', 0.1, 0.4); break;
            case 'deny': tone('square', 200, 140, 0.12, 0.05); break;
            case 'smash': nz(0.35, 0.3, 'lowpass', 500); tone('triangle', 120, 40, 0.3, 0.3); break;
            case 'place': tone('triangle', 300, 200, 0.08, 0.15); break;
            case 'build': case 'anvil': tone('square', 900, 850, 0.05, 0.06); tone('square', 900, 850, 0.05, 0.06, 0.12); nz(0.1, 0.1, 'bandpass', 2000); break;
            case 'quest': arp([69, 74, 78], 0.07, 'triangle', 0.1); break;
            case 'heart': case 'pet': arp([76, 81], 0.08, 'sine', 0.1, 0.3); break;
            case 'gift': arp([72, 79, 84], 0.07, 'sine', 0.1); break;
            case 'buy': case 'sell': case 'ship': tone('square', 1800, 1800, 0.05, 0.05); tone('square', 2400, 2400, 0.08, 0.05, 0.05); break;
            case 'cook': nz(0.4, 0.08, 'bandpass', 3000); arp([67, 72], 0.1, 'triangle', 0.08); break;
            case 'craft': case 'refine': case 'equip': tone('triangle', 400, 600, 0.1, 0.12); break;
            case 'stairs': arp([64, 60, 57], 0.07, 'triangle', 0.1); break;
            case 'key': case 'unlock': arp([84, 88, 91], 0.05, 'square', 0.04); break;
            case 'chest': arp([67, 71, 74, 79], 0.06, 'triangle', 0.1); break;
            case 'secret': arp([67, 70, 74, 79], 0.1, 'sine', 0.1); break;
            case 'warp': tone('sine', 300, 1200, 0.5, 0.1); tone('sine', 450, 1800, 0.5, 0.05); break;
            case 'encounter': arp([64, 67, 70, 76], 0.05, 'square', 0.05); break;
            case 'boss': tone('sawtooth', 110, 55, 0.8, 0.12); arp([52, 55, 58], 0.2, 'square', 0.05, 0.3); break;
            case 'hit': nz(0.08, 0.2, 'bandpass', 1500); tone('square', 300, 150, 0.08, 0.05); break;
            case 'crit': nz(0.12, 0.3, 'bandpass', 1200); tone('square', 600, 200, 0.15, 0.08); break;
            case 'hurt': tone('square', 400, 160, 0.18, 0.08); nz(0.1, 0.15, 'lowpass', 900); break;
            case 'guard': tone('triangle', 500, 500, 0.1, 0.12); break;
            case 'charge': tone('sawtooth', 100, 300, 0.4, 0.06); break;
            case 'cast': tone('sine', 400, 1200, 0.3, 0.08); nz(0.3, 0.05, 'highpass', 5000); break;
            case 'heal': arp([72, 76, 79], 0.06, 'sine', 0.09, 0.3); break;
            case 'buff': arp([67, 72, 79], 0.05, 'triangle', 0.09); break;
            case 'debuff': arp([70, 66, 62], 0.07, 'square', 0.04); break;
            case 'defeat': tone('square', 500, 80, 0.3, 0.07); nz(0.2, 0.1, 'lowpass', 1200); break;
            case 'faint': arp([67, 63, 60, 55], 0.15, 'triangle', 0.1, 0.4); break;
            case 'summon': tone('sawtooth', 200, 600, 0.3, 0.05); break;
            case 'flee': nz(0.2, 0.1, 'bandpass', 2500); tone('sine', 600, 1200, 0.2, 0.05); break;
            case 'gem': arp([88, 93], 0.05, 'sine', 0.1); break;
            case 'text': tone('square', 900 + Math.random() * 200, 900, 0.02, 0.012); break;
            case 'ui': tone('sine', 700, 900, 0.04, 0.05); break;
            case 'open': tone('sine', 500, 800, 0.06, 0.06); break;
            case 'close': tone('sine', 800, 500, 0.06, 0.05); break;
        }
    }
}
