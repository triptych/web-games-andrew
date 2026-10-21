// Procedural sound, all Web Audio, no files. A look-ahead sequencer plays twelve original tunes
// (title, the station, six zones, battle, boss, Meridian, recoding) over pads, bass, arpeggios and
// drums, through a small generated reverb. Effects answer the sim's events: blades, shots,
// spells by element, weaknesses, icons, recodes and splices. The context is made on the first
// gesture; ../lib/page-audio.js suspends it in a hidden tab.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

// chord arrays are semitone offsets from the key; mel is eight bars of eight eighth-notes, offsets above key+12
const TRACKS = {
    title: {
        bpm: 76, key: 57, lead: 'bell', arp: 'musicbox', drums: null, swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3], [-5, -1, 2], [-5, -1, 2]],
        mel: [[7, _, _, 5, 3, _, 0, _], [5, _, 3, _, 0, _, _, _], [3, _, 7, _, 10, _, 7, _], [5, _, 2, _, _, _, _, _], [7, _, 10, _, 12, _, 10, 7], [8, _, 5, _, 3, _, 0, _], [4, _, 2, _, -1, _, 2, _], [4, _, _, _, _, _, _, _]],
    },
    hub: {
        bpm: 92, key: 60, lead: 'flute', arp: 'pluck', drums: 'shaker', swing: 0.1,
        chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-10, -7, -3], [-5, -1, 2]],
        mel: [[4, _, 7, 9, 7, _, 4, _], [4, _, 2, 0, _, _, _, _], [5, _, 9, 12, 9, _, 5, _], [7, _, 5, 2, _, _, _, _], [4, _, 7, 9, 12, _, 9, 7], [9, _, 7, 4, 4, _, 2, _], [5, _, 2, 5, 9, _, 5, _], [7, _, 11, _, 7, _, _, _]],
    },
    tunnel: {
        bpm: 72, key: 50, lead: 'bell', arp: 'musicbox', drums: 'soft', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]],
        mel: [[7, _, _, _, 10, _, _, _], [12, _, _, 10, 7, _, _, _], [5, _, _, _, 7, _, _, _], [3, _, 2, _, _, _, _, _], [7, _, _, 10, 12, _, _, _], [15, _, _, 12, 10, _, _, _], [7, _, 5, _, 3, _, _, _], [2, _, _, _, _, _, _, _]],
    },
    hall: {
        bpm: 108, key: 55, lead: 'flute', arp: 'pluck', drums: 'folk', swing: 0.12,
        chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-7, -3, 0], [-5, -1, 2]],
        mel: [[7, _, 9, 7, 4, _, 0, _], [2, _, 4, 5, 7, _, _, _], [9, _, 12, 11, 9, _, 7, _], [5, _, 4, _, 2, _, _, _], [7, _, 9, 7, 12, _, 11, 9], [7, _, 4, _, 2, _, 4, 5], [4, _, 2, _, 0, _, 2, _], [0, _, _, _, -1, _, 2, _]],
    },
    racks: {
        bpm: 118, key: 52, lead: 'square', arp: 'pluck', drums: 'pulse', swing: 0,
        chords: [[0, 3, 7], [3, 7, 10], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [3, 7, 10], [-4, 0, 3], [-5, -1, 2]],
        mel: [[7, _, 10, _, 12, _, 10, _], [10, _, 14, _, 15, _, 14, 10], [12, _, 8, _, 7, _, 3, _], [5, _, 7, _, 10, _, _, _], [7, _, 10, _, 12, _, 15, _], [14, _, 12, _, 10, _, 14, _], [12, _, 8, _, 5, _, 8, _], [4, _, 7, _, 11, _, _, _]],
    },
    nave: {
        bpm: 62, key: 52, lead: 'choir', arp: 'musicbox', drums: 'soft', swing: 0,
        chords: [[0, 1, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2], [0, 1, 7], [3, 7, 10], [-4, 0, 3], [-5, -1, 2]],
        mel: [[7, _, _, _, 8, _, _, 7], [5, _, _, _, 7, _, _, _], [3, _, _, _, 7, _, _, _], [4, _, _, _, 2, _, _, _], [8, _, _, _, 7, _, _, 5], [10, _, _, _, 7, _, _, _], [8, _, _, _, 3, _, _, _], [4, _, _, _, _, _, _, _]],
    },
    rail: {
        bpm: 124, key: 60, lead: 'square', arp: 'pluck', drums: 'kit', swing: 0,
        chords: [[0, 4, 7], [2, 6, 9], [-3, 0, 4], [-5, -1, 2], [0, 4, 7], [2, 6, 9], [-7, -3, 0], [-5, -1, 2]],
        mel: [[12, _, 11, _, 9, _, 7, _], [9, _, 11, _, 14, _, _, _], [12, _, 9, _, 7, _, 4, _], [7, _, 5, _, 2, _, _, _], [12, _, 14, _, 16, _, 14, 12], [14, _, 11, _, 9, _, 11, _], [9, _, 7, _, 5, _, 4, _], [2, _, 5, _, 7, _, 11, _]],
    },
    spire: {
        bpm: 98, key: 49, lead: 'brass', arp: 'musicbox', drums: 'soft', swing: 0,
        chords: [[0, 3, 7], [-1, 2, 6], [-4, 0, 3], [-5, -1, 2], [0, 3, 7], [1, 4, 8], [-1, 2, 6], [-5, -1, 4]],
        mel: [[7, _, _, 10, _, 12, _, _], [11, _, _, 9, _, 6, _, _], [8, _, _, 7, _, 3, _, _], [4, _, _, 2, _, _, _, _], [7, _, 10, _, 12, _, 15, _], [13, _, 12, _, 8, _, 4, _], [11, _, 9, _, 6, _, 2, _], [4, _, _, _, 8, _, 11, _]],
    },
    battle: {
        bpm: 150, key: 50, lead: 'square', arp: 'pluck', drums: 'kit', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
        mel: [[12, _, 12, 15, _, 12, 10, 12], [8, _, _, 7, 8, _, 10, _], [7, _, 7, 10, _, 14, 12, 10], [12, _, _, _, 15, _, 14, _], [12, _, 12, 15, _, 17, 15, 14], [15, _, 12, _, 8, _, 12, _], [10, _, 14, _, 17, _, 14, _], [16, _, _, _, 11, _, 14, _]],
    },
    boss: {
        bpm: 140, key: 45, lead: 'brass', arp: 'pluck', drums: 'heavy', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
        mel: [[12, _, 15, _, 19, _, 20, 19], [20, _, 19, _, 15, _, _, _], [17, _, 19, _, 22, _, 24, 22], [19, _, _, _, 16, _, _, _], [24, _, 22, _, 20, _, 19, _], [20, _, 22, _, 24, _, 27, _], [26, _, 24, _, 22, _, 21, _], [19, _, _, _, 18, _, 16, _]],
    },
    final: {
        bpm: 130, key: 52, lead: 'brass', arp: 'pluck', drums: 'epic', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]],
        mel: [[12, _, _, 15, 19, _, _, _], [20, _, 19, _, 15, _, 17, _], [19, _, _, 22, 26, _, 24, _], [23, _, _, _, 19, _, _, _], [24, _, _, 27, 31, _, 29, 27], [32, _, 31, _, 27, _, 24, _], [29, _, 27, _, 24, _, 20, _], [23, _, _, _, 26, _, 23, _]],
    },
    recode: {
        bpm: 84, key: 57, lead: 'bell', arp: 'musicbox', drums: 'soft', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
        mel: [[_, _, 7, _, _, _, 10, _], [_, _, 8, _, 5, _, _, _], [_, _, 7, _, 3, _, _, _], [_, _, 4, _, 2, _, _, _], [_, _, 10, _, _, 12, _, _], [_, _, 8, _, 5, _, _, _], [_, _, 7, _, 5, _, 2, _], [4, _, _, _, _, _, _, _]],
    },
};
export const TRACK_FOR_THEME = { tunnel: 'tunnel', hall: 'hall', racks: 'racks', nave: 'nave', rail: 'rail', spire: 'spire', rift: 'spire' };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.track = null;
        this.want = null;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -15; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.42; this.music.connect(comp);
        this.verb = ctx.createConvolver();
        this.verb.buffer = this.impulse(2.2, 2.6);
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.34;
        this.verbIn.connect(this.verb); this.verb.connect(comp);
        this.noiseBuf = this.makeNoise(1.5);
        this.nextBeat = 0;
        this.step = 0;
        this.timer = setInterval(() => this.schedule(), 30);
        if (this.want) { const w = this.want; this.want = null; this.play(w); }
    }

    impulse(sec, decay) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
        return b;
    }
    makeNoise(sec) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }
    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.42, this.ctx.currentTime, 0.05);
    }
    get ok() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ voices
    tone({ f = 440, to = null, dur = 0.15, type = 'sine', vol = 0.2, at = 0, attack = 0.005, dest = null, verb = 0.15, vib = 0, filter = 0 }) {
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime, at || ctx.currentTime);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(filter, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, filter * 0.4), t + dur); o.connect(fl); node = fl; }
        node.connect(g);
        g.connect(dest || this.sfx);
        if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verbIn); }
        o.start(t); o.stop(t + dur + 0.05);
    }
    noise({ dur = 0.1, vol = 0.2, at = 0, type = 'bandpass', f = 1000, q = 1, to = null, dest = null, verb = 0.1 }) {
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime, at || ctx.currentTime);
        const s = ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const fl = ctx.createBiquadFilter();
        fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
        if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
        if (verb) { const v = ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verbIn); }
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }
    bell(f, at = 0, vol = 0.14, dur = 0.9, dest = null) {
        this.tone({ f, dur, vol, at, dest, verb: 0.35 });
        this.tone({ f: f * 2.76, dur: dur * 0.4, vol: vol * 0.35, at, dest, verb: 0.35 });
        this.tone({ f: f * 5.4, dur: dur * 0.15, vol: vol * 0.12, at, dest, verb: 0.2 });
    }
    pluck(f, at, vol = 0.12, dest = this.music) {
        this.tone({ f, dur: 0.34, vol, at, dest, verb: 0.2, type: 'triangle' });
        this.tone({ f: f * 2, dur: 0.12, vol: vol * 0.35, at, dest, verb: 0.1, type: 'sine' });
    }
    musicbox(f, at, vol = 0.08, dest = this.music) {
        this.tone({ f: f * 2, dur: 1.1, vol, at, dest, verb: 0.5 });
        this.tone({ f: f * 6, dur: 0.18, vol: vol * 0.2, at, dest, verb: 0.3 });
    }
    lead(kind, f, at, dur, vol = 0.1) {
        const d = this.music;
        if (kind === 'flute') this.tone({ f, dur: dur + 0.1, vol: vol * 0.9, at, dest: d, verb: 0.35, type: 'triangle', attack: 0.04, vib: 0.006 });
        else if (kind === 'bell') this.bell(f, at, vol * 0.9, Math.max(0.6, dur * 2), d);
        else if (kind === 'square') { this.tone({ f, dur: dur + 0.05, vol: vol * 0.55, at, dest: d, verb: 0.15, type: 'square', attack: 0.01, filter: 3200 }); this.tone({ f: f * 0.5, dur, vol: vol * 0.25, at, dest: d, verb: 0, type: 'triangle' }); }
        else if (kind === 'brass') { this.tone({ f, dur: dur + 0.1, vol: vol * 0.6, at, dest: d, verb: 0.3, type: 'sawtooth', attack: 0.03, filter: 2400, vib: 0.004 }); this.tone({ f: f * 1.005, dur: dur + 0.1, vol: vol * 0.4, at, dest: d, verb: 0.3, type: 'sawtooth', attack: 0.05, filter: 1800 }); }
        else if (kind === 'choir') { for (const det of [0.994, 1, 1.006]) this.tone({ f: f * det, dur: dur + 0.6, vol: vol * 0.38, at, dest: d, verb: 0.7, type: 'sawtooth', attack: 0.2, filter: 1300, vib: 0.005 }); }
    }
    pad(freqs, at, dur, vol = 0.03, cutoff = 900) {
        const ctx = this.ctx;
        for (const f of freqs) for (const det of [-7, 7]) {
            const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
            fl.type = 'lowpass'; fl.frequency.value = cutoff;
            g.gain.setValueAtTime(0.0001, at);
            g.gain.linearRampToValueAtTime(vol, at + dur * 0.25);
            g.gain.linearRampToValueAtTime(0.0001, at + dur);
            o.connect(fl); fl.connect(g); g.connect(this.music);
            const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.verbIn);
            o.start(at); o.stop(at + dur + 0.1);
        }
    }

    // ------------------------------------------------------------------ music
    play(name) {
        if (!this.ctx) { this.want = name; return; }
        if (this.track === name) return;
        this.track = name;
        this.step = 0;
        this.nextBeat = this.ctx.currentTime + 0.15;
    }
    stop() { this.track = null; this.want = null; }

    schedule() {
        if (!this.ok || !this.track) return;
        const T = TRACKS[this.track];
        if (!T) return;
        const sixteenth = 60 / T.bpm / 4;
        while (this.nextBeat < this.ctx.currentTime + 0.18) {
            const s = this.step % 16, bar = Math.floor(this.step / 16) % 8;
            const chord = T.chords[bar];
            const swing = s % 2 ? sixteenth * T.swing * 2 : 0;
            const at = this.nextBeat + swing;
            const root = T.key + chord[0];
            const heavy = T.drums === 'kit' || T.drums === 'heavy' || T.drums === 'epic' || T.drums === 'pulse';
            if (s === 0) this.pad(chord.map((n) => mtof(T.key + n - 12)), at, sixteenth * 16, T.drums === 'epic' ? 0.04 : T.lead === 'choir' ? 0.036 : 0.026, T.drums === 'epic' ? 1400 : 900);
            if (heavy ? s % 2 === 0 : (s === 0 || s === 8 || (T.drums === 'folk' && s === 12))) this.tone({ f: mtof(root - 24 + (heavy && s % 8 === 6 ? 7 : 0)), dur: heavy ? 0.16 : 0.42, vol: heavy ? 0.16 : 0.2, at, dest: this.music, type: heavy ? 'sawtooth' : 'triangle', verb: 0, filter: heavy ? 700 : 0 });
            if (s % 2 === 0 && T.arp) {
                const idx = [0, 1, 2, 1, 0, 2, 1, 2][(s / 2) % 8];
                const n = T.key + chord[idx] + (s >= 8 ? 12 : 0);
                if (T.arp === 'pluck') this.pluck(mtof(n), at, heavy ? 0.05 : 0.08);
                else this.musicbox(mtof(n - 12), at, 0.045);
            }
            if (s % 2 === 0) {
                const m = T.mel[bar][s / 2];
                if (m != null) {
                    let len = 1;
                    while (s / 2 + len < 8 && T.mel[bar][s / 2 + len] == null) len++;
                    this.lead(T.lead, mtof(T.key + 12 + m), at, len * sixteenth * 2 * 0.9, T.lead === 'bell' ? 0.1 : 0.11);
                }
            }
            this.drums(T.drums, s, bar, at);
            this.nextBeat += sixteenth;
            this.step++;
        }
    }

    drums(kind, s, bar, at) {
        const d = this.music;
        const kick = (v = 0.32) => this.tone({ f: 120, to: 42, dur: 0.18, vol: v, at, dest: d, verb: 0 });
        const snare = (v = 0.12) => { this.noise({ dur: 0.1, vol: v, at, type: 'bandpass', f: 1900, q: 0.8, dest: d, verb: 0.2 }); this.tone({ f: 220, to: 160, dur: 0.07, vol: v * 0.8, at, dest: d, verb: 0 }); };
        const hat = (v = 0.035) => this.noise({ dur: 0.03, vol: v, at, type: 'highpass', f: 7000, dest: d, verb: 0 });
        const tom = (f, v = 0.25) => this.tone({ f, to: f * 0.5, dur: 0.25, vol: v, at, dest: d, verb: 0.15 });
        switch (kind) {
            case 'folk': if (s === 0 || s === 8) kick(0.18); if (s === 4 || s === 12) this.noise({ dur: 0.05, vol: 0.06, at, type: 'highpass', f: 4000, dest: d, verb: 0.1 }); if (s % 2 === 1) hat(0.02); break;
            case 'shaker': if (s % 4 === 2) this.noise({ dur: 0.05, vol: 0.045, at, type: 'highpass', f: 6000, dest: d, verb: 0 }); if (s === 0) kick(0.1); break;
            case 'soft': if (s === 0) tom(90, 0.12); if (s === 10) tom(70, 0.08); break;
            case 'pulse': if (s % 4 === 0) kick(0.24); if (s % 4 === 2) hat(0.04); if (s === 12) snare(0.08); break;
            case 'kit': if (s === 0 || s === 8 || s === 10) kick(); if (s === 4 || s === 12) snare(); if (s % 2 === 1) hat(); if (bar === 7 && s >= 12) snare(0.08); break;
            case 'heavy': if (s % 4 === 0) kick(0.34); if (s === 4 || s === 12) snare(0.14); if (s % 2 === 1) hat(0.03); if (bar % 4 === 3 && s >= 8 && s % 2 === 0) tom(160 - s * 5); break;
            case 'epic': if (s === 0 || s === 6 || s === 8) kick(0.36); if (s === 4 || s === 12) snare(0.15); if (s % 4 === 2) tom(110, 0.18); if (bar % 2 === 1 && s >= 12) tom(180 - (s - 12) * 20, 0.22); hat(0.02); break;
        }
    }

    jingle(kind) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + 0.02;
        const P = (n, d, v = 0.14, type = 'triangle') => this.tone({ f: mtof(n), dur: 0.3, vol: v, at: t + d, type, verb: 0.3 });
        switch (kind) {
            case 'victory':
                [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36]].forEach(([n, d]) => P(n, d, 0.13, 'square'));
                [[76, 0.6], [79, 0.72], [84, 0.84]].forEach(([n, d]) => this.lead('brass', mtof(n), t + d, 0.5, 0.18));
                [60, 64, 67, 72].forEach((n) => this.tone({ f: mtof(n), dur: 1.6, vol: 0.05, at: t + 0.84, type: 'sawtooth', verb: 0.4, filter: 2000 }));
                this.bell(mtof(96), t + 0.84, 0.08, 1.6);
                break;
            case 'level': [72, 76, 79, 84, 88].forEach((n, i) => this.bell(mtof(n), t + i * 0.07, 0.12, 0.8)); break;
            case 'recoded': [67, 72, 76, 79, 84, 88, 91].forEach((n, i) => { this.bell(mtof(n), t + i * 0.08, 0.1, 1.0); }); this.tone({ f: 130, to: 520, dur: 0.7, vol: 0.08, at: t, type: 'sine', verb: 0.5 }); break;
            case 'splice': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.bell(mtof(n), t + i * 0.1, 0.1, 1.3)); this.noise({ dur: 0.9, vol: 0.06, type: 'bandpass', f: 400, to: 5000, q: 1 }); break;
            case 'gameover': [67, 65, 63, 62, 60].forEach((n, i) => this.tone({ f: mtof(n), dur: 0.6, vol: 0.12, at: t + i * 0.32, type: 'triangle', verb: 0.4 })); break;
            case 'win': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.lead('brass', mtof(n), t + i * 0.1, 0.6, 0.12)); this.bell(mtof(96), t + 0.8, 0.12, 2.5); break;
            case 'chest': [79, 84, 88, 91, 96].forEach((n, i) => this.bell(mtof(n), t + i * 0.06, 0.08, 0.9)); break;
            case 'weak': this.tone({ f: 1500, to: 2400, dur: 0.14, vol: 0.12, type: 'square', verb: 0.2, filter: 5000 }); this.bell(mtof(100), t, 0.08, 0.4); break;
            case 'allout': this.tone({ f: 90, to: 40, dur: 0.9, vol: 0.3, type: 'sawtooth', verb: 0.4, filter: 800 }); [60, 63, 67, 72, 75, 79].forEach((n, i) => this.lead('brass', mtof(n), t + 0.1 + i * 0.07, 0.5, 0.14)); this.noise({ dur: 0.6, vol: 0.18, type: 'highpass', f: 1500, to: 8000 }); break;
            case 'splashing': this.noise({ dur: 0.5, vol: 0.12, type: 'bandpass', f: 400, to: 4000, q: 0.8 }); break;
        }
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (!this.ok) return;
        if (kind === 'click') this.tone({ f: 880, to: 1100, dur: 0.06, type: 'triangle', vol: 0.09, verb: 0.05 });
        else if (kind === 'open') this.tone({ f: 520, to: 780, dur: 0.12, type: 'triangle', vol: 0.09 });
        else if (kind === 'close') this.tone({ f: 700, to: 460, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'text') this.tone({ f: 1500 + Math.random() * 300, dur: 0.02, type: 'square', vol: 0.018, verb: 0, filter: 3000 });
        else if (kind === 'error') { this.tone({ f: 220, dur: 0.1, type: 'square', vol: 0.06, verb: 0 }); this.tone({ f: 180, dur: 0.12, type: 'square', vol: 0.06, verb: 0, at: this.ctx.currentTime + 0.1 }); }
        else if (kind === 'buy') { this.noise({ dur: 0.06, vol: 0.08, type: 'bandpass', f: 2800, q: 3 }); this.bell(mtof(88), this.ctx.currentTime + 0.05, 0.07, 0.4); }
    }

    /** Effects for sim events as they play. */
    onEvent(e) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        switch (e.type) {
            case 'x_swing': this.noise({ dur: 0.16, vol: 0.12, type: 'bandpass', f: 3000, to: 800, q: 1.5, verb: 0.05 }); break;
            case 'x_step': this.noise({ dur: 0.04, vol: 0.03, type: 'lowpass', f: 700, verb: 0 }); break;
            case 'x_alert': this.tone({ f: 500, to: 1000, dur: 0.18, vol: 0.12, type: 'square', verb: 0.2, filter: 3000 }); this.tone({ f: 750, to: 1500, dur: 0.18, vol: 0.08, type: 'square', at: t + 0.1, verb: 0.2 }); break;
            case 'x_chest': this.jingle('chest'); break;
            case 'x_menu': this.ui('open'); break;
            case 'x_floor': this.tone({ f: 220, to: 120, dur: 0.4, vol: 0.12, type: 'triangle', verb: 0.4 }); this.noise({ dur: 0.4, vol: 0.05, type: 'lowpass', f: 600, to: 200 }); break;
            case 'x_anchor': if (e.healed) this.jingle('recoded'); break;
            case 'x_engage': this.noise({ dur: 0.3, vol: 0.14, type: 'bandpass', f: 1200, to: 300, q: 1 }); break;
            case 'x_boss': this.roar(1.4); break;
            case 'hub': break;
            case 'join': this.jingle('recoded'); break;
            case 'splice': this.jingle('splice'); break;
            case 'bond': [72, 76, 79, 84].forEach((n, i) => this.bell(mtof(n), t + i * 0.1, 0.1, 1.2)); break;
            // ---- battle
            case 'b_start': this.tone({ f: 1400, to: 120, dur: 0.6, vol: 0.12, type: 'sawtooth', verb: 0.4, filter: 4000 }); this.noise({ dur: 0.7, vol: 0.1, type: 'bandpass', f: 4000, to: 300, q: 0.8 }); break;
            case 'b_phase': this.tone({ f: e.side === 'p' ? 660 : 330, to: e.side === 'p' ? 990 : 220, dur: 0.14, vol: 0.09, type: 'triangle', verb: 0.2 }); break;
            case 'b_act': this.actSound(e); break;
            case 'b_hit': {
                if (e.res === 'miss' || e.res === 'null') { this.noise({ dur: 0.12, vol: 0.08, type: 'bandpass', f: 4000, to: 1500, q: 2 }); if (e.res === 'null') this.tone({ f: 300, dur: 0.18, vol: 0.06, type: 'square', filter: 1200 }); break; }
                if (e.res === 'repel') { this.tone({ f: 900, to: 200, dur: 0.25, vol: 0.12, type: 'sawtooth', verb: 0.3, filter: 3000 }); break; }
                if (e.res === 'drain') { [72, 79, 84].forEach((n, i) => this.bell(mtof(n), t + i * 0.05, 0.06, 0.5)); break; }
                const big = e.res === 'weak' || e.res === 'crit' || e.res === 'allout';
                this.noise({ dur: big ? 0.2 : 0.1, vol: big ? 0.28 : e.res === 'resist' ? 0.08 : 0.18, type: 'lowpass', f: big ? 2600 : 1500, to: 200, verb: 0.08 });
                this.tone({ f: big ? 170 : 200, to: 60, dur: 0.12, vol: big ? 0.3 : e.res === 'resist' ? 0.1 : 0.18, verb: 0.05 });
                if (e.res === 'weak') this.jingle('weak');
                if (e.res === 'crit') { this.bell(mtof(96), t, 0.09, 0.3); this.jingle('weak'); }
                break;
            }
            case 'b_heal': if (e.why !== 'regen') [79, 84, 88, 91].forEach((n, i) => this.bell(mtof(n), t + i * 0.05, 0.06, 0.6)); break;
            case 'b_down': this.tone({ f: 300, to: 100, dur: 0.2, vol: 0.12, type: 'triangle', verb: 0.2 }); break;
            case 'b_dead': this.tone({ f: 600, to: 80, dur: 0.45, vol: 0.12, type: 'square', verb: 0.2, filter: 2000 }); this.noise({ dur: 0.4, vol: 0.08, type: 'highpass', f: 2000, to: 6000 }); break;
            case 'b_revive': [72, 79, 84, 91].forEach((n, i) => this.bell(mtof(n), t + i * 0.08, 0.08, 1.2)); break;
            case 'b_buff': if (e.stage > 0) [72, 76, 79].forEach((n, i) => this.pluck(mtof(n + 12), t + i * 0.05, 0.09, this.sfx)); else if (e.stage < 0) [79, 74, 70].forEach((n, i) => this.pluck(mtof(n), t + i * 0.05, 0.09, this.sfx)); break;
            case 'b_ail': this.tone({ f: 500, to: 250, dur: 0.25, vol: 0.08, type: 'sawtooth', verb: 0.3, filter: 1500 }); break;
            case 'b_allout': this.jingle('allout'); break;
            case 'b_neg': if (e.neg.ended === 'success') break; if (e.neg.last > 0) [72, 76, 79].forEach((n, i) => this.bell(mtof(n + (e.neg.last > 1 ? 7 : 0)), t + i * 0.07, 0.07, 0.6)); else if (e.neg.last < 0) this.tone({ f: 200, to: 120, dur: 0.25, vol: 0.1, type: 'sawtooth', filter: 800 }); else if (e.neg.last === 0 && e.neg.tries) this.tone({ f: 400, dur: 0.08, vol: 0.05, type: 'triangle' }); else this.tone({ f: 700, to: 900, dur: 0.12, vol: 0.06, type: 'sine', verb: 0.4 }); break;
            case 'b_recoded': this.jingle('recoded'); break;
            case 'b_rage': this.roar(1.2); break;
            case 'b_charge': this.tone({ f: 200, to: 900, dur: 0.4, vol: 0.09, type: 'sawtooth', verb: 0.3, filter: 2500 }); break;
            case 'b_scan': [88, 91, 95].forEach((n, i) => this.pluck(mtof(n), t + i * 0.06, 0.07, this.sfx)); break;
            case 'b_guard': this.tone({ f: 400, to: 600, dur: 0.15, vol: 0.07, type: 'square', verb: 0.1, filter: 1500 }); break;
            case 'b_end': if (e.result === 'win') this.jingle('victory'); else if (e.result === 'lose') this.jingle('gameover'); else this.noise({ dur: 0.4, vol: 0.08, type: 'bandpass', f: 800, to: 3000, q: 1 }); break;
            case 'credits': this.jingle('win'); break;
        }
    }

    actSound(e) {
        const t = this.ctx.currentTime;
        const el = e.el;
        if (e.kind === 'atk') {
            if (el === 'strike') this.noise({ dur: 0.14, vol: 0.12, at: t + 0.15, type: 'bandpass', f: 3000, to: 900, q: 1.5, verb: 0.05 });
            else if (el === 'gun') { this.noise({ dur: 0.08, vol: 0.2, type: 'highpass', f: 1500, to: 5000, verb: 0.2 }); this.tone({ f: 200, to: 60, dur: 0.1, vol: 0.18, verb: 0.1 }); }
            else if (el === 'pyre') { this.noise({ dur: 0.5, vol: 0.14, type: 'lowpass', f: 1200, to: 300, verb: 0.3 }); this.tone({ f: 90, to: 50, dur: 0.4, vol: 0.12, verb: 0.2 }); }
            else if (el === 'rime') [96, 100, 103, 108].forEach((n, i) => this.bell(mtof(n), t + 0.1 + i * 0.04, 0.05, 0.5));
            else if (el === 'volt') { this.noise({ dur: 0.3, vol: 0.2, at: t + 0.1, type: 'highpass', f: 1500, to: 400, verb: 0.3 }); this.tone({ f: 80, to: 40, dur: 0.4, vol: 0.16, at: t + 0.1, verb: 0.2 }); }
            else if (el === 'gale') this.noise({ dur: 0.5, vol: 0.14, type: 'bandpass', f: 500, to: 3000, q: 0.8, verb: 0.3 });
            else if (el === 'lumen') [72, 76, 79, 84].forEach((n) => this.tone({ f: mtof(n), dur: 0.9, vol: 0.04, at: t + 0.05, type: 'sine', attack: 0.12, verb: 0.6 }));
            else if (el === 'hex') { this.tone({ f: 400, to: 90, dur: 0.5, vol: 0.12, type: 'sawtooth', verb: 0.4, filter: 1800 }); this.noise({ dur: 0.4, vol: 0.08, type: 'bandpass', f: 2500, to: 300, q: 4 }); }
            else this.tone({ f: 200, to: 1600, dur: 0.5, vol: 0.12, type: 'sawtooth', verb: 0.5, filter: 5000 });
        } else if (e.kind === 'heal' || e.kind === 'revive' || e.kind === 'cure') [79, 83, 86].forEach((n, i) => this.bell(mtof(n), t + i * 0.06, 0.06, 0.7));
        else if (e.kind === 'item') this.tone({ f: 600, to: 900, dur: 0.15, vol: 0.06, type: 'triangle', verb: 0.2 });
        else this.tone({ f: 400, to: 800, dur: 0.2, vol: 0.07, type: 'triangle', verb: 0.3 });
    }

    roar(len = 1.2) {
        const t = this.ctx.currentTime;
        this.tone({ f: 70, to: 45, dur: len, vol: 0.3, type: 'sawtooth', verb: 0.4, filter: 600, attack: 0.08 });
        this.tone({ f: 105, to: 60, dur: len * 0.9, vol: 0.18, type: 'sawtooth', verb: 0.4, filter: 900, attack: 0.1 });
        this.noise({ dur: len, vol: 0.2, type: 'lowpass', f: 900, to: 200, verb: 0.4, at: t });
    }
}
