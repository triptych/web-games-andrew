// Procedural sound: all Web Audio, no files. A look-ahead sequencer plays three cozy tunes
// (the museum, the dig, the night dig) on marimba, plucks, a pad, bass and brushes, through a
// small generated reverb. Effects answer the dig's events: chimes that climb with the chain,
// zaps, thumps, crunches, fanfares. The context is made on the first gesture, and
// ../lib/page-audio.js suspends it while the tab is hidden.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

const TRACKS = {
    museum: { bpm: 84, key: 65, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], swing: 0.06, inst: 'marimba', drums: 'shaker' },
    dig: { bpm: 104, key: 60, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], swing: 0.1, inst: 'pluck', drums: 'kit' },
    night: { bpm: 74, key: 57, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]], swing: 0.05, inst: 'musicbox', drums: 'shaker' },
    title: { bpm: 80, key: 65, chords: [[0, 4, 7], [-7, -3, 0], [-3, 0, 4], [-5, -1, 2]], swing: 0.05, inst: 'marimba', drums: null },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.track = null;
        this.want = null;
        this.lastFall = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.out = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // reverb send: a convolver fed by noise that decays
        this.verb = ctx.createConvolver();
        this.verb.buffer = this.impulse(2.2, 2.6);
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.3;
        this.verbIn.connect(this.verb); this.verb.connect(comp);
        this.noiseBuf = this.makeNoise(1.5);
        this.nextBeat = 0;
        this.step16 = 0;
        this.timer = setInterval(() => this.schedule(), 30);
        if (this.want) this.play(this.want);
    }

    impulse(sec, decay) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = b.getChannelData(ch);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
        }
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
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.05);
    }
    get ok() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ voices
    /** A tone with an envelope. dest defaults to the effects bus. */
    tone({ f = 440, to = null, dur = 0.15, type = 'sine', vol = 0.2, at = 0, attack = 0.005, dest = null, verb = 0.15, detune = 0 }) {
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime, at || ctx.currentTime);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        o.detune.value = detune;
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
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
        this.tone({ f: f * 5.4, dur: dur * 0.15, vol: vol * 0.15, at, dest, verb: 0.2 });
    }
    marimba(f, at, vol = 0.16, dest = this.music) {
        this.tone({ f, dur: 0.45, vol, at, dest, verb: 0.25, type: 'sine' });
        this.tone({ f: f * 4, dur: 0.08, vol: vol * 0.25, at, dest, verb: 0.1 });
    }
    pluck(f, at, vol = 0.12, dest = this.music) {
        this.tone({ f, dur: 0.32, vol, at, dest, verb: 0.2, type: 'triangle' });
        this.tone({ f: f * 2, dur: 0.12, vol: vol * 0.3, at, dest, verb: 0.1, type: 'sine' });
    }
    musicbox(f, at, vol = 0.1, dest = this.music) {
        this.tone({ f: f * 2, dur: 1.2, vol, at, dest, verb: 0.5 });
        this.tone({ f: f * 6, dur: 0.2, vol: vol * 0.2, at, dest, verb: 0.3 });
    }
    pad(freqs, at, dur, vol = 0.035) {
        const ctx = this.ctx;
        for (const f of freqs) {
            for (const det of [-7, 7]) {
                const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
                o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
                fl.type = 'lowpass'; fl.frequency.value = 900;
                g.gain.setValueAtTime(0.0001, at);
                g.gain.linearRampToValueAtTime(vol, at + dur * 0.3);
                g.gain.linearRampToValueAtTime(0.0001, at + dur);
                o.connect(fl); fl.connect(g); g.connect(this.music);
                const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.verbIn);
                o.start(at); o.stop(at + dur + 0.1);
            }
        }
    }

    // ------------------------------------------------------------------ music
    play(name) {
        this.want = name;
        if (!this.ctx) return;
        if (this.track === name) return;
        this.track = name;
        this.bar = 0;
        this.step16 = 0;
        this.nextBeat = this.ctx.currentTime + 0.12;
    }

    schedule() {
        if (!this.ok || !this.track) return;
        const T = TRACKS[this.track];
        const sixteenth = 60 / T.bpm / 4;
        while (this.nextBeat < this.ctx.currentTime + 0.15) {
            const s = this.step16 % 16;
            const bar = Math.floor(this.step16 / 16);
            const chord = T.chords[bar % T.chords.length];
            const swing = s % 2 ? sixteenth * T.swing * 2 : 0;
            const at = this.nextBeat + swing;
            const root = T.key + chord[0];
            if (s === 0) this.pad(chord.map((n) => mtof(T.key + n - 12)), at, sixteenth * 16, this.track === 'night' ? 0.045 : 0.03);
            // bass
            if (s === 0 || s === 8 || (T.drums === 'kit' && s === 11)) this.tone({ f: mtof(root - 24), dur: 0.5, vol: 0.2, at, dest: this.music, type: 'triangle', verb: 0 });
            // the chord instrument: arpeggios on eighths
            if (s % 2 === 0) {
                const idx = [0, 1, 2, 1, 0, 2, 1, 2][(s / 2) % 8];
                const n = T.key + chord[idx] + (s >= 8 ? 12 : 0);
                if (T.inst === 'marimba') this.marimba(mtof(n), at, 0.11);
                else if (T.inst === 'pluck') this.pluck(mtof(n), at, 0.09);
                else this.musicbox(mtof(n - 12), at, 0.05);
            }
            // a melody that repeats every eight bars with small changes
            const seed = (bar % 8) * 7 + s;
            const play = (seed * 2654435761 >>> 0) % 100 < (T.inst === 'musicbox' ? 22 : 30) && s % 2 === 0;
            if (play && bar % 2 === 1 || (s === 0 && bar % 4 === 0)) {
                const deg = PENTA[((seed * 40503) >>> 0) % 8] + 12;
                const n = T.key + deg + (chord[0] < -4 ? -2 : 0);
                if (T.inst === 'pluck') this.bellish(mtof(n), at); else this.marimba(mtof(n + 12), at, 0.08);
            }
            // drums
            if (T.drums === 'shaker' && s % 4 === 2) this.noise({ dur: 0.05, vol: 0.05, at, type: 'highpass', f: 6000, dest: this.music, verb: 0 });
            if (T.drums === 'kit') {
                if (s === 0 || s === 8) this.tone({ f: 120, to: 45, dur: 0.18, vol: 0.32, at, dest: this.music, verb: 0 });
                if (s === 4 || s === 12) this.noise({ dur: 0.09, vol: 0.12, at, type: 'bandpass', f: 1800, q: 0.8, dest: this.music, verb: 0.2 });
                if (s % 2 === 1) this.noise({ dur: 0.03, vol: 0.04, at, type: 'highpass', f: 7000, dest: this.music, verb: 0 });
            }
            this.nextBeat += sixteenth;
            this.step16++;
        }
    }
    bellish(f, at) { this.tone({ f, dur: 0.6, vol: 0.06, at, dest: this.music, verb: 0.4 }); this.tone({ f: f * 3, dur: 0.15, vol: 0.02, at, dest: this.music, verb: 0.2 }); }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (!this.ok) return;
        if (kind === 'click') this.tone({ f: 880, to: 1100, dur: 0.06, type: 'triangle', vol: 0.1, verb: 0.05 });
        else if (kind === 'open') { this.tone({ f: 520, to: 780, dur: 0.12, type: 'triangle', vol: 0.1 }); this.noise({ dur: 0.08, vol: 0.04, f: 3000, to: 6000 }); }
        else if (kind === 'close') this.tone({ f: 700, to: 460, dur: 0.1, type: 'triangle', vol: 0.09 });
        else if (kind === 'coin') [0, 0.06, 0.12].forEach((d, i) => this.bell(mtof(84 + i * 4), this.ctx.currentTime + d, 0.08, 0.4));
        else if (kind === 'task') [0, 4, 7, 12].forEach((n, i) => this.marimba(mtof(72 + n), this.ctx.currentTime + i * 0.07, 0.18, this.sfx));
        else if (kind === 'star') this.bell(mtof(88), 0, 0.12);
        else if (kind === 'page') this.noise({ dur: 0.18, vol: 0.06, type: 'bandpass', f: 2500, to: 1200, q: 0.6 });
        else if (kind === 'hire') [0, 4, 7, 11, 14].forEach((n, i) => this.pluck(mtof(67 + n), this.ctx.currentTime + i * 0.09, 0.16, this.sfx));
    }

    /** One soft blip per letter of dialogue, pitched by who is talking. */
    voice(who) {
        if (!this.ok) return;
        const base = { gus: 52, moss: 45, penny: 76, ledger: 40, kit: 79, rosa: 68, marigold: 72, you: 64 }[who] || 64;
        this.tone({ f: mtof(base + [0, 2, 4, 7][Math.floor(Math.random() * 4)]), dur: 0.05, vol: 0.05, type: 'triangle', verb: 0 });
    }

    stars(n) {
        if (!this.ok) return;
        for (let i = 0; i < n; i++) this.bell(mtof(76 + i * 5), this.ctx.currentTime + 0.35 + i * 0.32, 0.16, 1.2);
    }
    fanfare(win = true) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        if (win) {
            [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, i) => ch.forEach((n) => this.pluck(mtof(n), t + i * 0.16, 0.12, this.sfx)));
            this.bell(mtof(84), t + 0.66, 0.14, 1.6);
        } else {
            [67, 65, 62, 60].forEach((n, i) => this.tone({ f: mtof(n), dur: 0.35, vol: 0.12, at: t + i * 0.22, type: 'triangle', verb: 0.3 }));
        }
    }

    /** Effects for the dig, called by the board view as it plays each event. */
    play2(name, o = {}) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        switch (name) {
            case 'select': this.tone({ f: 1200, dur: 0.04, vol: 0.05, type: 'triangle', verb: 0 }); break;
            case 'swap': this.noise({ dur: 0.12, vol: 0.08, type: 'bandpass', f: 800, to: 2400, q: 1.2 }); break;
            case 'swapBad': this.tone({ f: 300, to: 220, dur: 0.14, vol: 0.12, type: 'square', verb: 0 }); this.tone({ f: 220, to: 300, dur: 0.14, vol: 0.1, at: t + 0.15, type: 'square', verb: 0 }); break;
            case 'nope': this.tone({ f: 180, dur: 0.12, vol: 0.12, type: 'square', verb: 0 }); break;
            case 'match': {
                const c = Math.min(o.chain || 1, 9);
                const base = 72 + PENTA[c - 1];
                for (let i = 0; i < 3; i++) this.bell(mtof(base + PENTA[i * 2]), t + i * 0.045, 0.09, 0.5);
                if (o.size >= 4) this.bell(mtof(base + 24), t + 0.14, 0.08, 0.8);
                break;
            }
            case 'special': {
                const n = o.kind === 'sun' ? 84 : o.kind === 'bomb' ? 72 : 79;
                for (let i = 0; i < 6; i++) this.bell(mtof(n + PENTA[i]), t + i * 0.035, 0.07, 0.6);
                this.noise({ dur: 0.4, vol: 0.05, type: 'highpass', f: 5000, to: 9000 });
                break;
            }
            case 'trowel': this.tone({ f: 300, to: 2400, dur: 0.22, vol: 0.12, type: 'sawtooth', verb: 0.2 }); this.noise({ dur: 0.25, vol: 0.1, type: 'bandpass', f: 1500, to: 6000, q: 0.7 }); break;
            case 'boom':
                this.tone({ f: o.big ? 90 : 110, to: 30, dur: o.big ? 0.7 : 0.45, vol: 0.45, verb: 0.2 });
                this.noise({ dur: o.big ? 0.8 : 0.5, vol: 0.28, type: 'lowpass', f: 1800, to: 120, verb: 0.3 });
                break;
            case 'sun': for (let i = 0; i < 10; i++) this.bell(mtof(72 + PENTA[i]), t + i * 0.03, 0.06, 0.7); this.noise({ dur: 0.6, vol: 0.1, type: 'highpass', f: 3000, to: 8000 }); break;
            case 'nova': this.play2('boom', { big: true }); for (let i = 0; i < 13; i++) this.bell(mtof(60 + PENTA[i]), t + i * 0.04, 0.07, 1); break;
            case 'scarab': case 'buzz': this.tone({ f: 140, to: 220, dur: 0.35, vol: 0.06, type: 'sawtooth', verb: 0.05 }); break;
            case 'thud': this.tone({ f: 160, to: 60, dur: 0.15, vol: 0.2, verb: 0.1 }); break;
            case 'dirt': if (t - (this.lastDirt || 0) > 0.05) { this.lastDirt = t; this.noise({ dur: 0.16, vol: 0.14, type: 'lowpass', f: 900, to: 200, verb: 0.05 }); } break;
            case 'rock': this.noise({ dur: 0.2, vol: 0.2, type: 'bandpass', f: o.left ? 1400 : 900, q: 2, verb: 0.15 }); this.tone({ f: 200, to: 80, dur: 0.12, vol: 0.15, verb: 0 }); break;
            case 'crust': this.noise({ dur: 0.22, vol: 0.13, type: 'highpass', f: 1800, to: 600, verb: 0.1 }); break;
            case 'fossil': [0, 4, 7, 12, 16].forEach((n, i) => this.bell(mtof(76 + n), t + i * 0.06, 0.09, 1.0)); break;
            case 'relic': [0, 4, 7, 12].forEach((n, i) => this.pluck(mtof(72 + n), t + i * 0.08, 0.16, this.sfx)); this.bell(mtof(96), t + 0.35, 0.08, 1.2); break;
            case 'fall': if (t - this.lastFall > 0.12) { this.lastFall = t; this.tone({ f: 600, to: 300, dur: 0.06, vol: 0.04, type: 'triangle', at: t + 0.12, verb: 0 }); } break;
            case 'shuffle': for (let i = 0; i < 8; i++) this.noise({ dur: 0.06, vol: 0.06, at: t + i * 0.06, type: 'bandpass', f: 1200 + i * 300, q: 2 }); break;
            case 'combo': this.tone({ f: 200, to: 1600, dur: 0.35, vol: 0.12, type: 'sawtooth', verb: 0.3 }); break;
            case 'convert': this.bell(mtof(88 + Math.floor(Math.random() * 3) * 2), 0, 0.06, 0.4); break;
            case 'rush': this.fanfare(true); break;
            case 'hammer': this.tone({ f: 900, to: 300, dur: 0.12, vol: 0.18, type: 'square', verb: 0.2 }); this.noise({ dur: 0.2, vol: 0.18, f: 3000, q: 3 }); break;
            default: break;
        }
    }

    /** Waves on the beach while the museum is on screen. */
    ambience(on) {
        if (!this.ctx) { this.wantAmb = on; return; }
        if (on && !this.amb) {
            const ctx = this.ctx;
            const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
            const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
            const g = ctx.createGain(); g.gain.value = 0.0;
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 0.12; lg.gain.value = 0.035;
            lfo.connect(lg); lg.connect(g.gain);
            const base = ctx.createConstantSource ? ctx.createConstantSource() : null;
            if (base) { base.offset.value = 0.05; base.connect(g.gain); base.start(); }
            s.connect(f); f.connect(g); g.connect(this.sfx);
            s.start(); lfo.start();
            this.amb = { s, lfo, base };
        } else if (!on && this.amb) {
            try { this.amb.s.stop(); this.amb.lfo.stop(); this.amb.base?.stop(); } catch { /* stopped */ }
            this.amb = null;
        }
    }
    gull() { if (this.ok && this.amb) { const t = this.ctx.currentTime; this.tone({ f: 1400, to: 900, dur: 0.25, vol: 0.03, type: 'sine', verb: 0.4 }); this.tone({ f: 1500, to: 1000, dur: 0.2, vol: 0.025, at: t + 0.3, verb: 0.4 }); } }
}
