// Procedural sound, all Web Audio, no files. A look-ahead sequencer plays seven original tunes
// (title, the island, towns, dungeons, battles, bosses and the dragon) from written-out melodies
// over chords, arpeggios, bass and drums, through a small generated reverb. Effects answer the
// sim's events: dice that rattle and thunk, steps, coins, slashes, spells by element, fanfares.
// The context is made on the first gesture; ../lib/page-audio.js suspends it in a hidden tab.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

const TRACKS = {
    board: {
        bpm: 112, key: 60, lead: 'flute', arp: 'pluck', drums: 'folk', swing: 0.08,
        chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-7, -3, 0], [-5, -1, 2]],
        mel: [[7, _, 9, 7, 4, _, 0, _], [2, _, 4, 5, 7, _, _, _], [9, _, 12, 11, 9, _, 7, _], [5, _, 4, _, 2, _, _, _], [7, _, 9, 7, 12, _, 11, 9], [7, _, 4, _, 2, _, 4, 5], [4, _, 2, _, 0, _, 2, _], [0, _, _, _, -1, _, 2, _]],
    },
    title: {
        bpm: 80, key: 55, lead: 'bell', arp: 'musicbox', drums: null, swing: 0,
        chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-7, -3, 0], [-5, -1, 2]],
        mel: [[7, _, 9, 7, 4, _, 0, _], [2, _, 4, 5, 7, _, _, _], [9, _, 12, 11, 9, _, 7, _], [5, _, 4, _, 2, _, _, _], [7, _, 9, 7, 12, _, 11, 9], [7, _, 4, _, 2, _, 4, 5], [4, _, 2, _, 0, _, 2, _], [0, _, _, _, _, _, _, _]],
    },
    town: {
        bpm: 92, key: 65, lead: 'bell', arp: 'musicbox', drums: 'shaker', swing: 0.1,
        chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
        mel: [[12, _, _, 9, 7, _, 9, _], [9, _, 7, _, 5, _, _, _], [5, _, 7, 9, 10, _, 9, _], [7, _, _, _, _, _, _, _], [12, _, 14, _, 12, 10, 9, _], [9, _, 7, 5, 4, _, 5, _], [2, _, 4, 5, 7, _, 9, _], [5, _, _, _, _, _, _, _]],
    },
    dungeon: {
        bpm: 96, key: 52, lead: 'bell', arp: 'musicbox', drums: 'soft', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-1, 3, 6]],
        mel: [[7, _, _, _, 10, _, 12, _], [11, _, _, _, 7, _, _, _], [9, _, _, _, 12, _, 14, _], [15, _, 14, _, 10, _, _, _], [7, _, _, 10, 12, _, 15, _], [14, _, 12, _, 8, _, _, _], [10, _, 12, _, 14, _, 17, _], [15, _, _, _, 11, _, _, _]],
    },
    battle: {
        bpm: 152, key: 57, lead: 'square', arp: 'pluck', drums: 'kit', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
        mel: [[12, _, 12, 15, _, 12, 10, 12], [8, _, _, 7, 8, _, 10, _], [7, _, 7, 10, _, 14, 12, 10], [12, _, _, _, 15, _, 14, _], [12, _, 12, 15, _, 17, 15, 14], [15, _, 12, _, 8, _, 12, _], [10, _, 14, _, 17, _, 14, _], [16, _, _, _, 11, _, 14, _]],
    },
    boss: {
        bpm: 138, key: 50, lead: 'brass', arp: 'pluck', drums: 'heavy', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
        mel: [[12, _, 15, _, 19, _, 20, 19], [20, _, 19, _, 15, _, _, _], [17, _, 19, _, 22, _, 24, 22], [19, _, _, _, 16, _, _, _], [24, _, 22, _, 20, _, 19, _], [20, _, 22, _, 24, _, 27, _], [26, _, 24, _, 22, _, 21, _], [19, _, _, _, 18, _, 16, _]],
    },
    dragon: {
        bpm: 128, key: 48, lead: 'brass', arp: 'pluck', drums: 'epic', swing: 0,
        chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]],
        mel: [[12, _, _, 15, 19, _, _, _], [20, _, 19, _, 15, _, 17, _], [19, _, _, 22, 26, _, 24, _], [23, _, _, _, 19, _, _, _], [24, _, _, 27, 31, _, 29, 27], [32, _, 31, _, 27, _, 24, _], [29, _, 27, _, 24, _, 20, _], [23, _, _, _, 26, _, 23, _]],
    },
};

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
        this.verb.buffer = this.impulse(2.0, 2.8);
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.32;
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
        else if (kind === 'square') { this.tone({ f, dur: dur + 0.05, vol: vol * 0.55, at, dest: d, verb: 0.15, type: 'square', attack: 0.01, filter: 3200 }); this.tone({ f: f * 0.5, dur: dur, vol: vol * 0.25, at, dest: d, verb: 0, type: 'triangle' }); }
        else if (kind === 'brass') { this.tone({ f, dur: dur + 0.1, vol: vol * 0.6, at, dest: d, verb: 0.3, type: 'sawtooth', attack: 0.03, filter: 2400, vib: 0.004 }); this.tone({ f: f * 1.005, dur: dur + 0.1, vol: vol * 0.4, at, dest: d, verb: 0.3, type: 'sawtooth', attack: 0.05, filter: 1800 }); }
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
    stop() { this.track = null; }

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
            if (s === 0) this.pad(chord.map((n) => mtof(T.key + n - 12)), at, sixteenth * 16, T.drums === 'epic' ? 0.04 : 0.026, T.drums === 'epic' ? 1400 : 900);
            // bass
            const heavy = T.drums === 'kit' || T.drums === 'heavy' || T.drums === 'epic';
            if (heavy ? s % 2 === 0 : (s === 0 || s === 8 || (T.drums === 'folk' && s === 12))) this.tone({ f: mtof(root - 24 + (heavy && s % 8 === 6 ? 7 : 0)), dur: heavy ? 0.16 : 0.42, vol: heavy ? 0.16 : 0.2, at, dest: this.music, type: heavy ? 'sawtooth' : 'triangle', verb: 0, filter: heavy ? 700 : 0 });
            // arpeggio on eighths
            if (s % 2 === 0 && T.arp) {
                const idx = [0, 1, 2, 1, 0, 2, 1, 2][(s / 2) % 8];
                const n = T.key + chord[idx] + (s >= 8 ? 12 : 0);
                if (T.arp === 'pluck') this.pluck(mtof(n), at, heavy ? 0.05 : 0.08);
                else this.musicbox(mtof(n - 12), at, 0.045);
            }
            // melody on eighths
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
            case 'shaker': if (s % 4 === 2) this.noise({ dur: 0.05, vol: 0.045, at, type: 'highpass', f: 6000, dest: d, verb: 0 }); break;
            case 'soft': if (s === 0) tom(90, 0.12); if (s === 10) tom(70, 0.08); break;
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
            case 'victory': {
                // an original little brass fanfare
                [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36]].forEach(([n, d]) => P(n, d, 0.13, 'square'));
                [[76, 0.6], [79, 0.72], [84, 0.84]].forEach(([n, d]) => this.lead('brass', mtof(n), t + d, 0.5, 0.18));
                [60, 64, 67, 72].forEach((n) => this.tone({ f: mtof(n), dur: 1.6, vol: 0.05, at: t + 0.84, type: 'sawtooth', verb: 0.4, filter: 2000 }));
                this.bell(mtof(96), t + 0.84, 0.08, 1.6);
                break;
            }
            case 'level': [72, 76, 79, 84, 88].forEach((n, i) => this.bell(mtof(n), t + i * 0.07, 0.12, 0.8)); break;
            case 'shard': [84, 88, 91, 96, 91, 96, 100].forEach((n, i) => this.bell(mtof(n), t + i * 0.09, 0.1, 1.2)); break;
            case 'lap': [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]].forEach(([n, d]) => this.pluck(mtof(n), t + d, 0.16, this.sfx)); break;
            case 'town': [67, 72, 76].forEach((n, i) => this.bell(mtof(n), t + i * 0.12, 0.09, 1)); break;
            case 'gameover': [67, 65, 63, 62, 60].forEach((n, i) => this.tone({ f: mtof(n), dur: 0.6, vol: 0.12, at: t + i * 0.32, type: 'triangle', verb: 0.4 })); break;
            case 'win': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.lead('brass', mtof(n), t + i * 0.1, 0.6, 0.12)); this.bell(mtof(96), t + 0.8, 0.12, 2.5); break;
        }
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (!this.ok) return;
        if (kind === 'click') this.tone({ f: 880, to: 1100, dur: 0.06, type: 'triangle', vol: 0.09, verb: 0.05 });
        else if (kind === 'open') { this.tone({ f: 520, to: 780, dur: 0.12, type: 'triangle', vol: 0.09 }); }
        else if (kind === 'close') this.tone({ f: 700, to: 460, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'error') { this.tone({ f: 220, dur: 0.1, type: 'square', vol: 0.06, verb: 0 }); this.tone({ f: 180, dur: 0.12, type: 'square', vol: 0.06, verb: 0, at: this.ctx.currentTime + 0.1 }); }
    }

    /** Effects for sim events as they play. */
    onEvent(e) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        switch (e.type) {
            case 'dice':
                for (let i = 0; i < (e.who === 'you' ? 7 : 4); i++) this.noise({ dur: 0.04, vol: 0.12, at: t + 0.35 + i * 0.07 + Math.random() * 0.03, type: 'bandpass', f: 2200 + Math.random() * 1500, q: 4, verb: 0.05 });
                this.tone({ f: 180, to: 90, dur: 0.12, vol: 0.2, at: t + (e.who === 'you' ? 0.7 : 0.45), verb: 0.05 });
                if (e.doubles) [79, 84, 88].forEach((n, i) => this.bell(mtof(n), t + 1.2 + i * 0.08, 0.1, 0.6));
                break;
            case 'step': if (e.who === 'you') this.tone({ f: mtof(67 + ((e.to * 5) % 12)), dur: 0.08, type: 'triangle', vol: 0.07, verb: 0.05 }); else this.tone({ f: 500, dur: 0.04, vol: 0.025, type: 'triangle', verb: 0 }); break;
            case 'land': if (e.who === 'you') this.noise({ dur: 0.08, vol: 0.08, type: 'lowpass', f: 600, verb: 0.05 }); break;
            case 'gold': [0, 0.06, 0.12].forEach((d, i) => this.bell(mtof(86 + i * 3), t + d, 0.06, 0.35)); break;
            case 'lap': this.jingle('lap'); break;
            case 'toll': for (let i = 0; i < 4; i++) this.bell(mtof(88 - i * 3), t + i * 0.08, 0.06, 0.3); break;
            case 'buy': case 'upgrade': if (e.who === 'you') { this.noise({ dur: 0.08, vol: 0.1, type: 'bandpass', f: 3000, q: 2 }); [76, 81, 88].forEach((n, i) => this.bell(mtof(n), t + 0.05 + i * 0.07, 0.1, 0.8)); } break;
            case 'warp': this.tone({ f: 200, to: 1600, dur: 0.5, vol: 0.1, type: 'sine', verb: 0.5 }); this.noise({ dur: 0.5, vol: 0.06, type: 'highpass', f: 2000, to: 8000 }); break;
            case 'fate': this.noise({ dur: 0.25, vol: 0.1, type: 'bandpass', f: 1500, to: 4000, q: 1 }); [72, 79].forEach((n, i) => this.bell(mtof(n), t + 0.15 + i * 0.1, 0.08, 0.7)); break;
            case 'treasure': this.noise({ dur: 0.3, vol: 0.08, type: 'lowpass', f: 400, to: 1200 }); [84, 88, 91, 96].forEach((n, i) => this.bell(mtof(n), t + 0.2 + i * 0.06, 0.07, 0.8)); break;
            case 'mimic': this.tone({ f: 150, to: 60, dur: 0.4, vol: 0.2, type: 'sawtooth', verb: 0.2, filter: 900 }); break;
            case 'heal': [72, 76, 79, 84].forEach((n, i) => this.bell(mtof(n), t + i * 0.05, 0.05, 0.6)); break;
            case 'blessing': [79, 83, 86, 91].forEach((n, i) => this.bell(mtof(n), t + i * 0.08, 0.07, 1.2)); break;
            case 'fountain': for (let i = 0; i < 8; i++) this.bell(mtof(84 + (i % 4) * 3), t + i * 0.05, 0.06, 0.4); break;
            case 'roamer': this.tone({ f: 300, to: 200, dur: 0.15, vol: 0.05, type: 'square', verb: 0.1, filter: 1500 }); break;
            case 'roamerFight': this.tone({ f: 120, to: 180, dur: 0.3, vol: 0.2, type: 'sawtooth', verb: 0.2, filter: 1200 }); break;
            case 'dragonWakes': this.roar(1.6); break;
            case 'levelup': this.jingle('level'); break;
            case 'shard': this.jingle('shard'); break;
            case 'town': this.jingle('town'); break;
            case 'craft': for (let i = 0; i < 3; i++) { this.noise({ dur: 0.08, vol: 0.16, at: t + i * 0.18, type: 'bandpass', f: 3500, q: 6 }); this.tone({ f: 1800, dur: 0.3, vol: 0.05, at: t + i * 0.18, verb: 0.3 }); } break;
            case 'inn': [60, 64, 67, 72].forEach((n, i) => this.bell(mtof(n + 12), t + i * 0.15, 0.06, 1.2)); break;
            case 'hire': [67, 71, 74, 79].forEach((n, i) => this.pluck(mtof(n), t + i * 0.08, 0.14, this.sfx)); break;
            case 'buyItem': case 'buyGear': this.noise({ dur: 0.06, vol: 0.08, type: 'bandpass', f: 2800, q: 3 }); this.bell(mtof(88), t + 0.05, 0.07, 0.4); break;
            // ---- battle
            case 'b_start': this.tone({ f: 1400, to: 120, dur: 0.6, vol: 0.12, type: 'sawtooth', verb: 0.4, filter: 4000 }); this.noise({ dur: 0.7, vol: 0.1, type: 'bandpass', f: 4000, to: 300, q: 0.8 }); break;
            case 'b_act': this.actSound(e); break;
            case 'b_hit': {
                const big = e.crit || e.weak;
                this.noise({ dur: big ? 0.18 : 0.1, vol: big ? 0.26 : 0.18, type: 'lowpass', f: big ? 2400 : 1500, to: 200, verb: 0.08 });
                this.tone({ f: big ? 160 : 200, to: 60, dur: 0.12, vol: big ? 0.28 : 0.18, verb: 0.05 });
                if (e.crit) this.bell(mtof(96), t, 0.08, 0.3);
                break;
            }
            case 'b_heal': if (!e.regen) [79, 84, 88, 91].forEach((n, i) => this.bell(mtof(n), t + i * 0.05, 0.06, 0.6)); break;
            case 'b_ko': this.tone({ f: 600, to: 80, dur: 0.45, vol: 0.12, type: 'square', verb: 0.2, filter: 2000 }); this.noise({ dur: 0.4, vol: 0.08, type: 'highpass', f: 2000, to: 6000 }); break;
            case 'b_revive': [72, 79, 84, 91].forEach((n, i) => this.bell(mtof(n), t + i * 0.08, 0.08, 1.2)); break;
            case 'b_status': if (e.on) this.tone({ f: e.st === 'poison' || e.st === 'burn' || e.st === 'slow' || e.st === 'stun' || e.st === 'weak' ? 300 : 700, to: e.st === 'poison' ? 200 : 1000, dur: 0.15, vol: 0.06, type: 'triangle', verb: 0.2 }); break;
            case 'b_summon': this.tone({ f: 200, to: 600, dur: 0.3, vol: 0.08, type: 'sawtooth', verb: 0.3, filter: 1500 }); break;
            case 'b_phase': this.roar(2.2); break;
            case 'b_end': if (e.result === 'fled') this.noise({ dur: 0.4, vol: 0.08, type: 'bandpass', f: 800, to: 3000, q: 1 }); break;
        }
    }

    actSound(e) {
        const t = this.ctx.currentTime;
        const fx = e.fx || '';
        if (e.burst) { this.tone({ f: 200, to: 1600, dur: 0.6, vol: 0.12, type: 'sawtooth', verb: 0.5, filter: 5000 }); [72, 79, 84, 91, 96].forEach((n, i) => this.bell(mtof(n), t + i * 0.05, 0.08, 1)); }
        if (['slash', 'slashBig', 'holySlash', 'claw', 'pinch', 'whirl'].includes(fx)) this.noise({ dur: 0.14, vol: 0.12, at: t + 0.25, type: 'bandpass', f: 3000, to: 900, q: 1.5, verb: 0.05 });
        else if (['smash', 'bash', 'bump', 'quake', 'rune', 'roots'].includes(fx)) this.noise({ dur: 0.16, vol: 0.12, at: t + 0.3, type: 'lowpass', f: 900, to: 200, verb: 0.05 });
        else if (fx === 'arrow' || fx === 'rain' || fx === 'burstStars') { this.tone({ f: 900, to: 300, dur: 0.12, vol: 0.08, type: 'triangle', verb: 0.05 }); this.noise({ dur: 0.18, vol: 0.06, at: t + 0.05, type: 'highpass', f: 3000, to: 6000 }); }
        else if (e.el === 'fire' || fx === 'fireball' || fx === 'breath' || fx === 'inferno' || fx === 'ember' || fx === 'cannon') { this.noise({ dur: fx === 'inferno' ? 1.0 : 0.5, vol: fx === 'inferno' ? 0.22 : 0.14, type: 'lowpass', f: 1200, to: 300, verb: 0.3 }); this.tone({ f: 90, to: 50, dur: 0.4, vol: 0.12, verb: 0.2 }); }
        else if (e.el === 'frost' || fx === 'nova' || fx === 'iceShard' || fx === 'blizzard') [96, 100, 103, 108].forEach((n, i) => this.bell(mtof(n), t + 0.2 + i * 0.04, 0.05, 0.5));
        else if (e.el === 'storm' || fx === 'bolt' || fx === 'zap' || fx === 'spark' || fx === 'gust') { this.noise({ dur: 0.3, vol: 0.2, at: t + 0.25, type: 'highpass', f: 1500, to: 400, verb: 0.3 }); this.tone({ f: 80, to: 40, dur: 0.4, vol: 0.16, at: t + 0.25, verb: 0.2 }); }
        else if (e.el === 'holy' || fx === 'holy' || fx === 'revive') [72, 76, 79, 84].forEach((n) => this.tone({ f: mtof(n), dur: 0.9, vol: 0.04, at: t + 0.1, type: 'sine', attack: 0.15, verb: 0.6 }));
        else if (['heal', 'healAll', 'burstHeal', 'rally', 'ward', 'shield', 'vines'].includes(fx)) [79, 83, 86].forEach((n, i) => this.bell(mtof(n), t + i * 0.06, 0.06, 0.7));
        else if (fx === 'roar') this.roar(1.0);
        else if (fx === 'item') this.tone({ f: 600, to: 900, dur: 0.15, vol: 0.06, type: 'triangle', verb: 0.2 });
        else if (fx === 'defend') this.tone({ f: 400, to: 600, dur: 0.15, vol: 0.06, type: 'square', verb: 0.1, filter: 1500 });
    }

    roar(len = 1.2) {
        const t = this.ctx.currentTime;
        this.tone({ f: 70, to: 45, dur: len, vol: 0.3, type: 'sawtooth', verb: 0.4, filter: 600, attack: 0.08 });
        this.tone({ f: 105, to: 60, dur: len * 0.9, vol: 0.18, type: 'sawtooth', verb: 0.4, filter: 900, attack: 0.1 });
        this.noise({ dur: len, vol: 0.2, type: 'lowpass', f: 900, to: 200, verb: 0.4, at: t });
    }
}
