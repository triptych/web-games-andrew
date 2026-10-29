// Procedural music: a look-ahead step sequencer on Web Audio. Each city has its own tempo, key,
// chord loop and a seeded melody; the layers (bass and drums, offbeat chords, marimba lead,
// arpeggio, brass stabs) fade in as the destruction mounts. Oompah-bass for a monster that is a
// bit of a clown.

import { makeRng } from './rng.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];

// one entry per city: tempo, root note (MIDI), scale, chord loop (scale degrees), swing, lead timbre
const SONGS = [
    { bpm: 126, root: 60, scale: MAJOR, prog: [0, 5, 3, 4], swing: 0.12, lead: 'marimba', name: 'Pastel Bay' },
    { bpm: 132, root: 65, scale: MIXO, prog: [0, 6, 3, 0], swing: 0.16, lead: 'vibes', name: 'Harbor Town' },
    { bpm: 118, root: 57, scale: DORIAN, prog: [0, 3, 6, 4], swing: 0.06, lead: 'synth', name: 'Neon Heights' },
    { bpm: 112, root: 62, scale: MAJOR, prog: [0, 2, 3, 4], swing: 0.0, lead: 'bell', name: 'Frostport' },
    { bpm: 140, root: 52, scale: MINOR, prog: [0, 5, 2, 6], swing: 0.0, lead: 'brass', name: 'Fort Fortissimo' },
];

const RHYTHMS = [
    [0, 3, 6, 8, 10, 12],
    [0, 2, 4, 6, 8, 11, 14],
    [0, 4, 6, 8, 12, 14],
    [0, 3, 8, 10, 11, 14],
    [2, 4, 8, 10, 12],
    [0, 6, 8, 12, 14, 15],
];

export class Music {
    constructor(audio) {
        this.audio = audio;
        this.ctx = null;
        this.playing = false;
        this.song = SONGS[0];
        this.level = 0;
        this.intensity = 0.2;
        this.target = 0.2;
        this.mode = 'play';
        this.step = 0;
        this.nextTime = 0;
        this.timer = null;
    }

    attach(ctx, bus) {
        this.ctx = ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 1;
        // a short echo makes the plucks sound like a room
        const delay = ctx.createDelay(0.5); delay.delayTime.value = 0.18;
        const fb = ctx.createGain(); fb.gain.value = 0.28;
        const wet = ctx.createGain(); wet.gain.value = 0.22;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        this.out.connect(bus);
        this.out.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(bus);
        this.nbuf = this.audio.noiseBuf;
    }

    /** Begin a city's tune. mode 'title' is calm and drumless. */
    start(level, mode = 'play') {
        if (!this.ctx) return;
        this.level = level;
        this.mode = mode;
        this.song = SONGS[level % SONGS.length];
        const rng = makeRng(0xC0FFEE + level * 977);
        this.melody = this.makeMelody(rng, this.song);
        this.step = 0;
        this.nextTime = this.ctx.currentTime + 0.1;
        this.intensity = mode === 'title' ? 0.35 : 0.2;
        this.target = this.intensity;
        if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
        this.playing = true;
    }

    stop() {
        this.playing = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    setIntensity(v) { this.target = Math.max(0, Math.min(1, v)); }
    setMode(mode) { this.mode = mode; }
    /** Duck the music (while the monster is dead or a menu is open). */
    duck(on) {
        if (!this.out || this._duck === on) return;
        this._duck = on;
        this.applyGain();
    }
    /** Pull the music back a little while a voice is speaking. */
    talk(on) {
        if (!this.out || this._talk === on) return;
        this._talk = on;
        this.applyGain();
    }
    applyGain() { this.out.gain.setTargetAtTime((this._duck ? 0.35 : 1) * (this._talk ? 0.5 : 1), this.ctx.currentTime, 0.2); }

    // ---------------------------------------------------------------- composition

    midi(deg, song = this.song, octave = 0) {
        const n = song.scale.length;
        const o = Math.floor(deg / n), i = ((deg % n) + n) % n;
        return song.root + 12 * (o + octave) + song.scale[i];
    }
    freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    /** 8 bars of lead notes (scale degrees, or null), built from a motif that answers itself. */
    makeMelody(rng, song) {
        const bars = [];
        const chordTones = (bar) => { const r = song.prog[bar % 4]; return [r, r + 2, r + 4]; };
        const motifA = RHYTHMS[rng.int(0, RHYTHMS.length - 1)], motifB = RHYTHMS[rng.int(0, RHYTHMS.length - 1)];
        let cur = 7 + rng.int(0, 2);
        const phrase = (rhythm, bar, resolve) => {
            const out = new Array(16).fill(null);
            const ct = chordTones(bar);
            rhythm.forEach((s, k) => {
                const strong = s % 8 === 0;
                if (strong || rng() < 0.3) {
                    // land on a chord tone near where the tune is now
                    let best = cur, bd = 99;
                    for (const t of ct) for (const o of [-7, 0, 7, 14]) { const d = Math.abs(t + o - cur); if (d < bd && t + o >= 5 && t + o <= 16) { bd = d; best = t + o; } }
                    cur = best;
                } else cur = Math.max(5, Math.min(16, cur + rng.pick([-2, -1, -1, 1, 1, 2])));
                out[s] = cur;
                void k;
            });
            if (resolve) { out[12] = song.prog[0] + 7; out[14] = null; }
            return out;
        };
        for (let b = 0; b < 8; b++) {
            const A = b < 4 ? motifA : (b % 2 ? motifB : motifA);
            bars.push(phrase(b % 4 === 3 ? motifB : A, b, b === 7));
        }
        return bars;
    }

    // ---------------------------------------------------------------- scheduling

    tick() {
        if (!this.playing || !this.ctx) return;
        if (this.ctx.state !== 'running') { this.nextTime = this.ctx.currentTime + 0.1; return; }
        this.intensity += (this.target - this.intensity) * 0.03;
        const stepDur = 60 / this.song.bpm / 4;
        while (this.nextTime < this.ctx.currentTime + 0.18) {
            this.playStep(this.step, this.nextTime, stepDur);
            this.nextTime += stepDur;
            this.step++;
        }
    }

    playStep(step, t0, sd) {
        const song = this.song;
        const s16 = step % 16, bar = Math.floor(step / 16);
        const barInLoop = bar % 4, bar8 = bar % 8;
        const I = this.intensity;
        // swing: the off 8th notes (steps 2, 6, 10, 14) are pushed late
        const t = t0 + (s16 % 4 === 2 ? song.swing * sd * 2 : 0);
        const root = song.prog[barInLoop];
        const title = this.mode === 'title';

        // ---- drums
        if (!title) {
            if (s16 === 0 || s16 === 8 || (s16 === 10 && I > 0.5) || (s16 === 14 && I > 0.7 && bar % 2)) this.kick(t, s16 === 0 ? 1 : 0.8);
            if (s16 === 4 || s16 === 12) this.snare(t, 1);
            if (I > 0.55 && (s16 === 7 || s16 === 15)) this.snare(t, 0.35);
            if (s16 % 2 === 0) this.hat(t, s16 % 4 === 2 ? 0.7 : 0.4);
            else if (I > 0.65) this.hat(t, 0.25);
            if (s16 === 0 && bar % 4 === 0 && bar > 0) this.crash(t);
        }

        // ---- oompah bass (a tuba): root on 1, fifth on 3, a walk into the next chord on the last beat
        const walk = this.midi(song.prog[(barInLoop + 1) % 4], song, -2);
        if (s16 === 0 || s16 === 2) this.bass(t, this.midi(root, song, -2), sd * (s16 === 0 ? 3 : 1.4), 0.9);
        if (s16 === 8) this.bass(t, this.midi(root + 4, song, -2), sd * 3, 0.7);
        if (s16 === 12 && !title) this.bass(t, this.midi(root + 4, song, -2), sd * 1.5, 0.45);
        if (s16 === 14 && !title) this.bass(t, walk + (bar % 2 ? 2 : -1), sd * 1.5, 0.6);
        if (title && (s16 === 6 || s16 === 14)) this.bass(t, this.midi(root + 7, song, -2), sd * 3, 0.4);

        // ---- the "pah": offbeat chord stabs
        if (I > 0.3 && !title && (s16 === 4 || s16 === 12 || (I > 0.6 && (s16 === 6 || s16 === 14)))) this.stab(t, [root, root + 2, root + 4], sd * 1.6, 0.5);
        if (title && s16 % 8 === 0) this.pad(t, [root, root + 2, root + 4], sd * 8, 0.5);

        // ---- the lead
        const note = this.melody[bar8][s16];
        const leadOn = title ? true : I > 0.28;
        if (note !== null && leadOn) {
            const m = this.midi(note, song);
            this.lead(t, m, sd * 2.2, title ? 0.6 : 0.8);
        }
        // ---- arpeggio shimmer when the city is really going
        if (I > 0.55 && !title && s16 % 2 === 1) {
            const arp = [root, root + 2, root + 4, root + 7][(s16 >> 1) % 4];
            this.pluck(t, this.midi(arp, song, 1), sd * 1.2, 0.35);
        }
        // ---- brass stabs when the army is out
        if (I > 0.75 && !title && (s16 === 0 || s16 === 10)) this.brass(t, [root, root + 4], sd * 2.4, 0.5);
    }

    // ---------------------------------------------------------------- voices

    env(node, t, a, d, vol) {
        node.gain.setValueAtTime(0.0001, t);
        node.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
        node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    osc(type, freq, t, dur, vol, { a = 0.005, lp = 0, detune = 0 } = {}) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq; o.detune.value = detune;
        this.env(g, t, a, dur, vol);
        let n = o;
        if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); n = f; }
        n.connect(g); g.connect(this.out);
        o.start(t); o.stop(t + a + dur + 0.05);
    }

    kick(t, v) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.24);
    }

    noiseHit(t, dur, vol, type, freq, q = 1) {
        const ctx = this.ctx, s = ctx.createBufferSource();
        s.buffer = this.nbuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        this.env(g, t, 0.002, dur, vol);
        s.connect(f); f.connect(g); g.connect(this.out);
        s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
    }

    snare(t, v) {
        this.noiseHit(t, 0.14, 0.3 * v, 'bandpass', 1800, 0.8);
        this.osc('triangle', 190, t, 0.1, 0.22 * v);
    }
    hat(t, v) { this.noiseHit(t, 0.04, 0.1 * v, 'highpass', 7500); }
    crash(t) { this.noiseHit(t, 0.9, 0.12, 'highpass', 5000); }

    bass(t, m, dur, v) {
        this.osc('triangle', this.freq(m), t, dur, 0.5 * v, { lp: 700 });
        this.osc('sine', this.freq(m - 12), t, dur, 0.3 * v);
    }

    stab(t, degs, dur, v) {
        for (const d of degs) this.osc('square', this.freq(this.midi(d, this.song, 0)), t, dur, 0.05 * v, { lp: 1500, a: 0.004 });
    }

    pad(t, degs, dur, v) {
        for (const d of degs) {
            this.osc('triangle', this.freq(this.midi(d, this.song, 0)), t, dur, 0.06 * v, { a: 0.4, lp: 1200 });
            this.osc('sine', this.freq(this.midi(d, this.song, 1)), t, dur, 0.03 * v, { a: 0.5 });
        }
    }

    brass(t, degs, dur, v) {
        for (const d of degs) this.osc('sawtooth', this.freq(this.midi(d, this.song, 0)), t, dur, 0.06 * v, { lp: 1800, a: 0.02, detune: 6 });
    }

    pluck(t, m, dur, v) { this.osc('triangle', this.freq(m), t, dur * 1.5, 0.14 * v, { a: 0.003 }); }

    lead(t, m, dur, v) {
        const f = this.freq(m);
        switch (this.song.lead) {
            case 'marimba':
                this.osc('sine', f, t, dur * 1.6, 0.26 * v, { a: 0.003 });
                this.osc('sine', f * 4, t, 0.08, 0.08 * v, { a: 0.002 });
                break;
            case 'vibes':
                this.osc('sine', f, t, dur * 2.4, 0.22 * v, { a: 0.004 });
                this.osc('sine', f * 2.01, t, dur * 1.2, 0.09 * v, { a: 0.004 });
                break;
            case 'bell':
                this.osc('sine', f * 2, t, dur * 3, 0.16 * v, { a: 0.002 });
                this.osc('sine', f * 3.01, t, dur * 2, 0.07 * v, { a: 0.002 });
                this.osc('sine', f * 5.4, t, dur, 0.04 * v, { a: 0.002 });
                break;
            case 'brass':
                this.osc('sawtooth', f, t, dur * 1.4, 0.1 * v, { a: 0.02, lp: 2200, detune: 5 });
                this.osc('square', f * 0.5, t, dur, 0.05 * v, { a: 0.02, lp: 900 });
                break;
            default:
                this.osc('sawtooth', f, t, dur * 1.2, 0.08 * v, { a: 0.01, lp: 2600, detune: 8 });
                this.osc('sawtooth', f, t, dur * 1.2, 0.06 * v, { a: 0.01, lp: 2600, detune: -8 });
        }
    }
}

export { SONGS };
