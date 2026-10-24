// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a small
// generative band (ukulele, marimba, bass, shaker...) that plays a different tune in each world.
// The context is made on the first user gesture; ../lib/page-audio.js suspends it in a hidden tab.

import { makeRng } from './rng.js';

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---------------------------------------------------------------- the songs, one per theme
// scale: semitones from the root; prog: chord roots as scale degrees (one per bar); bpm; feel flags choose the band.
const SONGS = {
    beach:  { root: 60, scale: [0, 2, 4, 7, 9, 12], bpm: 112, prog: [0, 5, 3, 4], seed: 11, band: ['uke', 'marimba', 'shaker', 'bass', 'kick'], swing: 0.12 },
    jungle: { root: 57, scale: [0, 3, 5, 7, 10, 12], bpm: 118, prog: [0, 3, 0, 4], seed: 23, band: ['toms', 'marimba', 'wood', 'bass', 'shaker'], swing: 0.08 },
    pier:   { root: 55, scale: [0, 2, 4, 5, 7, 9, 12], bpm: 104, prog: [0, 3, 4, 0], seed: 37, band: ['squeeze', 'pluck', 'bass', 'kick', 'snare'], swing: 0.2 },
    castle: { root: 62, scale: [0, 2, 4, 7, 9, 12], bpm: 108, prog: [0, 4, 5, 3], seed: 41, band: ['harp', 'bell', 'bass', 'snare', 'hat'], swing: 0.05 },
    storm:  { root: 57, scale: [0, 2, 3, 7, 8, 12], bpm: 132, prog: [0, 5, 3, 4], seed: 59, band: ['pulse', 'pad', 'toms', 'hat', 'kick', 'pluck'], swing: 0 },
    reef:   { root: 60, scale: [0, 2, 4, 5, 7, 9, 11, 12], bpm: 96, prog: [0, 3, 4, 0], seed: 71, band: ['pad', 'bell', 'uke', 'bass', 'shaker'], swing: 0.1 },
    title:  { root: 60, scale: [0, 2, 4, 7, 9, 12], bpm: 92, prog: [0, 3, 4, 3], seed: 5, band: ['uke', 'marimba', 'shaker', 'bass'], swing: 0.1 },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.6;
        this.song = null; this.songName = ''; this.intensity = 0;
        this.step = 0; this.nextT = 0; this.bar = 0;
        this.pearlCombo = { n: 0, t: -9 };
        this.loops = null;
        this.last = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // a short noise-made room for the music
        const len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.22;
        this.verb.connect(this.verbGain); this.verbGain.connect(this.music);
        const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = n.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = n;
        // two continuous beds: wind (gliding, falling) and a shield hum
        this.wind = this._loopNoise(700, 0.0);
        this.nextT = ctx.currentTime + 0.1;
        if (this.pending) { const s = this.pending; this.pending = null; this.playSong(s); }
    }

    _loopNoise(freq, gain) {
        const ctx = this.ctx, src = ctx.createBufferSource();
        src.buffer = this.noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.6;
        const g = ctx.createGain(); g.gain.value = gain;
        src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
        return { g, f };
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    get running() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, attack = 0.008, dest, vib = 0, filter = 0 } = {}) {
        if (!this.running) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 18; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let out = g;
        if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); f.connect(g); } else o.connect(g);
        g.connect(dest || this.sfx);
        o.start(t); o.stop(t + dur + 0.03);
    }

    noise({ dur = 0.2, vol = 0.2, delay = 0, freq = 1200, to = freq, type = 'bandpass', q = 0.8, dest, attack = 0.005 } = {}) {
        if (!this.running) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(freq, t); if (to !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest || this.sfx);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
    }

    // ------------------------------------------------------------ UI
    ui(kind) {
        switch (kind) {
            case 'click': this.tone({ freq: 660, to: 880, dur: 0.06, type: 'triangle', vol: 0.13 }); break;
            case 'open': this.tone({ freq: 440, to: 660, dur: 0.1, type: 'triangle', vol: 0.13 }); break;
            case 'close': this.tone({ freq: 660, to: 440, dur: 0.1, type: 'triangle', vol: 0.13 }); break;
            case 'no': this.tone({ freq: 200, to: 150, dur: 0.14, type: 'square', vol: 0.1 }); break;
            case 'type': this.tone({ freq: 520 + Math.random() * 200, dur: 0.03, type: 'square', vol: 0.035 }); break;
            case 'craft':
                for (let i = 0; i < 6; i++) this.tone({ freq: 300 + i * 90, dur: 0.08, type: 'square', vol: 0.09, delay: i * 0.07 });
                [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.16, delay: 0.5 + i * 0.09 }));
                this.noise({ dur: 0.4, vol: 0.06, freq: 4000, type: 'highpass', delay: 0.05 });
                break;
            case 'equip': this.tone({ freq: 520, to: 780, dur: 0.1, type: 'triangle', vol: 0.15 }); this.tone({ freq: 780, to: 1040, dur: 0.1, type: 'triangle', vol: 0.12, delay: 0.07 }); break;
            case 'tally': this.tone({ freq: 880 + Math.random() * 60, dur: 0.04, type: 'triangle', vol: 0.07 }); break;
            case 'star': [660, 880, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.15, delay: i * 0.07 })); break;
        }
    }

    // ------------------------------------------------------------ the world's sounds
    onEvents(G, events) {
        if (!this.running) return;
        const ctx = this.ctx;
        for (const e of events) {
            switch (e.type) {
                case 'jump': this.tone({ freq: 300, to: e.rolling ? 760 : 620, dur: 0.17, type: 'square', vol: 0.09, filter: 2400 }); break;
                case 'land': if (e.v > 6) { this.noise({ dur: 0.1, vol: Math.min(0.2, e.v * 0.012), freq: 260, type: 'lowpass' }); this.tone({ freq: 130, to: 70, dur: 0.1, type: 'sine', vol: 0.12 }); } break;
                case 'spin': this.noise({ dur: 0.3, vol: 0.12, freq: 500, to: 3000, q: 1.2 }); this.tone({ freq: 380, to: 760, dur: 0.25, type: 'sine', vol: 0.06 }); break;
                case 'roll': this.noise({ dur: 0.5, vol: 0.1, freq: 400, to: 900, q: 0.7 }); this.tone({ freq: 200, to: 420, dur: 0.4, type: 'sawtooth', vol: 0.05, filter: 900 }); break;
                case 'hop': this.tone({ freq: 220, to: 220 + 500 * e.k + 200, dur: 0.3, type: 'sine', vol: 0.18 }); this.tone({ freq: 440, to: 880, dur: 0.22, type: 'triangle', vol: 0.1, vib: 20 }); break;
                case 'glide': this.noise({ dur: 0.3, vol: 0.1, freq: 600, to: 1800 }); this.tone({ freq: 700, to: 1000, dur: 0.2, type: 'triangle', vol: 0.08 }); break;
                case 'slamStart': this.tone({ freq: 500, to: 120, dur: 0.18, type: 'sawtooth', vol: 0.08, filter: 1200 }); break;
                case 'slam': this.tone({ freq: 110, to: 38, dur: 0.45, type: 'sine', vol: 0.4 }); this.noise({ dur: 0.35, vol: 0.28, freq: 700, to: 90, type: 'lowpass' }); this.tone({ freq: 800, to: 300, dur: 0.12, type: 'square', vol: 0.06 }); break;
                case 'swap': this.tone({ freq: 400, to: 1200, dur: 0.12, type: 'triangle', vol: 0.15 }); this.tone({ freq: 1200, to: 600, dur: 0.1, type: 'sine', vol: 0.1, delay: 0.08 }); this.noise({ dur: 0.12, vol: 0.06, freq: 5000, type: 'highpass' }); break;
                case 'pearl': {
                    const now = ctx.currentTime;
                    this.pearlCombo.n = now - this.pearlCombo.t < 0.9 ? Math.min(12, this.pearlCombo.n + 1) : 0;
                    this.pearlCombo.t = now;
                    const base = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][this.pearlCombo.n];
                    this.tone({ freq: MIDI(79 + base), dur: 0.16, type: 'sine', vol: 0.13 });
                    this.tone({ freq: MIDI(91 + base), dur: 0.1, type: 'sine', vol: 0.05, delay: 0.02 });
                    if (e.n > 1) [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: MIDI(84 + s), dur: 0.2, type: 'triangle', vol: 0.1, delay: i * 0.05 }));
                    break;
                }
                case 'curio': [72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone({ freq: MIDI(n), dur: 0.35, type: 'triangle', vol: 0.15, delay: i * 0.07 })); this.tone({ freq: MIDI(96), dur: 0.8, type: 'sine', vol: 0.08, delay: 0.4 }); break;
                case 'heart': [67, 72, 76, 79].forEach((n, i) => this.tone({ freq: MIDI(n), dur: 0.22, type: 'triangle', vol: 0.14, delay: i * 0.06 })); break;
                case 'crate': this.noise({ dur: 0.18, vol: 0.22, freq: 1400, to: 300 }); this.tone({ freq: e.kind === 'iron' ? 180 : 320, to: 120, dur: 0.12, type: 'square', vol: 0.1 }); if (e.kind === 'iron') this.tone({ freq: 900, to: 400, dur: 0.2, type: 'square', vol: 0.06, delay: 0.02 }); break;
                case 'checkpoint': [60, 64, 67, 72].forEach((n, i) => this.tone({ freq: MIDI(n + 12), dur: 0.3, type: 'triangle', vol: 0.14, delay: i * 0.08 })); break;
                case 'bounce': this.tone({ freq: 160, to: 640, dur: 0.28, type: 'sine', vol: 0.22, vib: 24 }); this.tone({ freq: 320, to: 1100, dur: 0.2, type: 'triangle', vol: 0.06 }); break;
                case 'barrel': this.tone({ freq: 90, to: 50, dur: 0.2, type: 'sine', vol: 0.3 }); this.noise({ dur: 0.35, vol: 0.2, freq: 400, to: 2400, delay: 0.38 }); this.tone({ freq: 140, to: 520, dur: 0.4, type: 'sawtooth', vol: 0.08, delay: 0.4, filter: 1400 }); break;
                case 'hurt': this.tone({ freq: 480, to: 120, dur: 0.3, type: 'sawtooth', vol: e.god ? 0.04 : 0.17, filter: 1800 }); this.noise({ dur: 0.15, vol: 0.1 }); break;
                case 'oopsie': [392, 370, 349, 330].forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.15, delay: i * 0.22, vib: 6 })); break;
                case 'respawn': this.tone({ freq: 300, to: 900, dur: 0.25, type: 'sine', vol: 0.14 }); break;
                case 'rescue': this.tone({ freq: 500, to: 1500, dur: 0.4, type: 'sine', vol: 0.14, vib: 14 }); break;
                case 'splash': this.noise({ dur: 0.5, vol: 0.28, freq: 1800, to: 300 }); this.tone({ freq: 400, to: 90, dur: 0.3, type: 'sine', vol: 0.12 }); break;
                case 'kill': this.tone({ freq: 600, to: 1500, dur: 0.15, type: 'square', vol: 0.1 }); this.tone({ freq: 900, to: 200, dur: 0.2, type: 'triangle', vol: 0.1, delay: 0.1 }); break;
                case 'clink': this.tone({ freq: 1800, to: 1400, dur: 0.12, type: 'square', vol: 0.08 }); this.tone({ freq: 2400, dur: 0.1, type: 'square', vol: 0.05, delay: 0.02 }); break;
                case 'block': this.tone({ freq: 700, to: 500, dur: 0.18, type: 'square', vol: 0.12 }); this.tone({ freq: 1050, to: 700, dur: 0.16, type: 'square', vol: 0.07 }); this.tone({ freq: 260, to: 520, dur: 0.2, type: 'sine', vol: 0.15, delay: 0.03 }); break;
                case 'clank': this.tone({ freq: 600, to: 220, dur: 0.2, type: 'square', vol: 0.1 }); this.noise({ dur: 0.1, vol: 0.1, freq: 3000, type: 'highpass' }); break;
                case 'splat': this.noise({ dur: 0.12, vol: 0.18, freq: 500, to: 200 }); break;
                case 'smash': this.noise({ dur: 0.12, vol: 0.12, freq: 900, to: 300 }); break;
                case 'throw': e.kind === 'ball' ? (this.tone({ freq: 90, to: 40, dur: 0.3, type: 'sine', vol: 0.35 }), this.noise({ dur: 0.25, vol: 0.2, freq: 900, to: 150 })) : this.tone({ freq: 240, to: 480, dur: 0.08, type: 'sine', vol: 0.15 }); break;
                case 'windup': this.tone({ freq: 300, to: 520, dur: 0.4, type: 'triangle', vol: 0.05, vib: 10 }); break;
                case 'switch': this.tone({ freq: 140, to: 70, dur: 0.12, type: 'square', vol: 0.12 }); [60, 67, 72].forEach((n, i) => this.tone({ freq: MIDI(n + 12), dur: 0.2, type: 'triangle', vol: 0.12, delay: 0.12 + i * 0.07 })); this.noise({ dur: 0.7, vol: 0.12, freq: 200, to: 90, type: 'lowpass', delay: 0.2 }); break;
                case 'bossStart': this.tone({ freq: 80, to: 55, dur: 0.9, type: 'sawtooth', vol: 0.15, filter: 400 }); this.tone({ freq: 160, to: 110, dur: 0.8, type: 'sawtooth', vol: 0.07, filter: 500 }); break;
                case 'bossStomp': this.tone({ freq: 90, to: 30, dur: 0.5, type: 'sine', vol: 0.45 }); this.noise({ dur: 0.4, vol: 0.28, freq: 600, to: 80, type: 'lowpass' }); break;
                case 'bossSmash': this.tone({ freq: 80, to: 28, dur: 0.6, type: 'sine', vol: 0.5 }); this.noise({ dur: 0.5, vol: 0.32, freq: 800, to: 90, type: 'lowpass' }); break;
                case 'bossHit': [392, 494, 587, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.16, delay: i * 0.06 })); this.tone({ freq: 90, to: 40, dur: 0.4, type: 'sine', vol: 0.3 }); break;
                case 'bossDaze': this.tone({ freq: 700, to: 300, dur: 0.5, type: 'sine', vol: 0.1, vib: 30 }); break;
                case 'bossDefeat': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone({ freq: MIDI(n), dur: 0.5, type: 'triangle', vol: 0.15, delay: i * 0.1 })); break;
                case 'crumble': this.noise({ dur: 0.5, vol: 0.1, freq: 500, to: 150, type: 'lowpass' }); break;
                case 'vent': this.noise({ dur: 0.3, vol: 0.06, freq: 800, to: 2400 }); break;
                case 'swept': this.noise({ dur: 0.9, vol: 0.4, freq: 1400, to: 150 }); this.tone({ freq: 200, to: 60, dur: 0.6, type: 'sawtooth', vol: 0.15 }); break;
                case 'ring': this.tone({ freq: 160, to: 90, dur: 0.3, type: 'sine', vol: 0.2 }); break;
                case 'win': this.fanfare(); break;
            }
        }
    }

    fanfare() {
        const seq = [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.55], [84, 0.67], [88, 0.8], [91, 1.0]];
        seq.forEach(([n, d]) => { this.tone({ freq: MIDI(n), dur: 0.38, type: 'triangle', vol: 0.17, delay: d }); this.tone({ freq: MIDI(n - 12), dur: 0.38, type: 'sine', vol: 0.1, delay: d }); });
        this.tone({ freq: MIDI(96), dur: 1.1, type: 'sine', vol: 0.1, delay: 1.0 });
    }

    /** Per-frame beds: wind while gliding or falling fast, tied to the player's state. */
    update(G, dt) {
        if (!this.running || !this.wind) return;
        const p = G.p;
        const k = p.glide ? 0.12 : (!p.grounded && p.vy < -12 ? Math.min(0.12, (-p.vy - 12) * 0.01) : 0);
        this.wind.g.gain.setTargetAtTime(k * (G.status === 'play' ? 1 : 0), this.ctx.currentTime, 0.08);
        this.wind.f.frequency.setTargetAtTime(p.glide ? 900 : 500 + Math.max(0, -p.vy) * 25, this.ctx.currentTime, 0.1);
        // little scuttling steps, quicker the faster he runs
        const sp = Math.hypot(p.vx, p.vz);
        this.stepT = (this.stepT || 0) - dt;
        if (G.status === 'play' && p.grounded && sp > 2.5 && p.rollT <= 0 && !p.launch) {
            if (this.stepT <= 0) {
                this.stepT = 0.42 / Math.max(0.6, sp / 7);
                this.noise({ dur: 0.04, vol: 0.05, freq: 2600 + Math.random() * 1200, q: 2.5 });
                this.tone({ freq: 880 + Math.random() * 240, to: 600, dur: 0.03, type: 'square', vol: 0.014 });
            }
        } else if (this.stepT < 0) this.stepT = 0;
        this.tick();
    }

    // ------------------------------------------------------------ music
    playSong(name) {
        if (!SONGS[name]) name = 'beach';
        if (!this.ctx) { this.pending = name; return; }
        if (this.songName === name) return;
        this.songName = name; this.song = SONGS[name];
        this.step = 0; this.bar = 0; this.nextT = this.ctx.currentTime + 0.15;
        this.rng = makeRng(this.song.seed);
        this.motifs = [this._motif(), this._motif()];
    }
    stopSong() { this.song = null; this.songName = ''; }
    setIntensity(v) { this.intensity = v; }

    _motif() {
        const S = this.song, r = this.rng, n = 8, notes = [];
        let deg = Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { deg = Math.max(0, Math.min(S.scale.length - 1, deg + Math.floor(r() * 5) - 2)); notes.push(deg); }
        const rhythms = [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 4, 6, 8, 11, 12, 14], [0, 2, 3, 6, 8, 10, 11, 14], [0, 4, 6, 8, 12, 14, 15, 15]];
        return { notes, rhythm: rhythms[Math.floor(r() * rhythms.length)] };
    }

    /** Schedule the next stretch of music, a little ahead of the clock. */
    tick() {
        if (!this.running || !this.song) return;
        const ctx = this.ctx, S = this.song;
        const sixteenth = 60 / (S.bpm + this.intensity * 12) / 4;
        if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.05;
        while (this.nextT < ctx.currentTime + 0.25) {
            const st = this.step % 16, bar = Math.floor(this.step / 16);
            const swing = st % 2 ? S.swing * sixteenth : 0;
            this._playStep(S, st, bar, this.nextT + swing, sixteenth);
            this.nextT += sixteenth;
            this.step++;
        }
    }

    _playStep(S, st, bar, t, dt16) {
        const chordDeg = S.prog[bar % S.prog.length];
        const rootNote = S.root + S.scale[chordDeg % S.scale.length] - 12;
        const pc = new Set(S.scale.map((x) => x % 12)), rpc = (S.scale[chordDeg % S.scale.length]) % 12;
        const third = [4, 3].find((x) => pc.has((rpc + x) % 12)) ?? 4;
        const chord = [0, third, 7].map((x) => rootNote + 12 + x);
        const has = (b) => S.band.includes(b);
        const hi = this.intensity;
        const T = t - this.ctx.currentTime;
        const voice = (opts) => this._voice(opts, T);
        // bass
        if (has('bass')) {
            if (st === 0 || st === 8) voice({ kind: 'bass', note: rootNote, dur: dt16 * 3.2, vol: 0.2 });
            if (st === 6 || st === 14) voice({ kind: 'bass', note: rootNote + 7, dur: dt16 * 1.8, vol: 0.14 });
        }
        if (has('pulse') && st % 2 === 0) voice({ kind: 'bass', note: rootNote + (st % 8 === 6 ? 7 : 0), dur: dt16 * 1.4, vol: 0.16 });
        // chords
        if (has('uke') && (st === 2 || st === 6 || st === 10 || st === 14)) chord.forEach((n, i) => voice({ kind: 'pluck', note: n, dur: dt16 * 2, vol: 0.075, delay: i * 0.012 }));
        if (has('squeeze') && (st === 4 || st === 12)) chord.forEach((n) => voice({ kind: 'squeeze', note: n, dur: dt16 * 3, vol: 0.05 }));
        if (has('pad') && st === 0) chord.forEach((n) => voice({ kind: 'pad', note: n, dur: dt16 * 15, vol: 0.05 }));
        if (has('harp') && st % 2 === 0) voice({ kind: 'bellsoft', note: chord[(st / 2) % 3] + (st % 8 >= 4 ? 12 : 0), dur: dt16 * 2.5, vol: 0.07 });
        // melody (a motif that repeats and answers itself)
        const m = this.motifs[(bar >> 1) & 1], phase = bar % 4;
        const mi = m.rhythm.indexOf(st);
        const melodic = has('marimba') || has('pluck') || has('bell');
        if (melodic && mi >= 0 && !(phase === 3 && mi > 4) && (phase !== 1 || mi % 2 === 0 || hi > 0.2)) {
            const deg = m.notes[(mi + phase * 2) % m.notes.length];
            const note = S.root + S.scale[deg % S.scale.length] + (phase === 2 ? 12 : 0);
            voice({ kind: has('marimba') ? 'marimba' : has('bell') ? 'bell' : 'pluck', note, dur: dt16 * 2.2, vol: 0.11 });
        }
        // percussion
        if (has('kick') && (st === 0 || st === 8 || (hi > 0.3 && st === 10))) voice({ kind: 'kick', vol: 0.3 });
        if (has('snare') && (st === 4 || st === 12)) voice({ kind: 'snare', vol: 0.12 });
        if (has('shaker') && st % 2 === 0) voice({ kind: 'shaker', vol: st % 4 === 0 ? 0.08 : 0.05 });
        if (has('hat') && st % 2 === 0) voice({ kind: 'hat', vol: 0.05 });
        if (has('wood') && (st === 3 || st === 7 || st === 11 || st === 14)) voice({ kind: 'wood', vol: 0.1, note: st === 3 ? 84 : 79 });
        if (has('toms') && (st === 0 || st === 3 || st === 6 || st === 10 || st === 12)) voice({ kind: 'tom', vol: 0.18, note: st === 0 ? 43 : st === 12 ? 50 : 47 });
        if (hi > 0.5) { if (st % 4 === 2) voice({ kind: 'snare', vol: 0.08 }); if (st % 2 === 1) voice({ kind: 'hat', vol: 0.04 }); }
    }

    _voice(o, delay = 0) {
        const ctx = this.ctx, t = ctx.currentTime + Math.max(0, delay) + (o.delay || 0);
        const out = this.music;
        const env = (g, peak, dur, att = 0.006) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
        const send = (node, wet = 0.3) => { node.connect(out); const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.verb); };
        const osc = (type, f, dur, vol, att, wet = 0.3, detune = 0) => {
            const a = ctx.createOscillator(), g = ctx.createGain(); a.type = type; a.frequency.value = f; a.detune.value = detune;
            env(g, vol, dur, att); a.connect(g); send(g, wet); a.start(t); a.stop(t + dur + 0.05);
            return a;
        };
        const f = o.note != null ? MIDI(o.note) : 0, vol = o.vol || 0.1, dur = Math.max(0.05, o.dur || 0.2);
        switch (o.kind) {
            case 'pluck': {
                osc('triangle', f, dur + 0.15, vol, 0.004, 0.25); osc('sine', f * 2, dur * 0.6, vol * 0.3, 0.004, 0.2);
                break;
            }
            case 'marimba': osc('sine', f, dur + 0.1, vol, 0.003, 0.35); osc('sine', f * 4, 0.12, vol * 0.4, 0.002, 0.2); break;
            case 'bell': osc('sine', f, dur + 0.5, vol, 0.004, 0.55); osc('sine', f * 2.76, dur * 0.8, vol * 0.3, 0.004, 0.55); break;
            case 'bellsoft': osc('sine', f, dur + 0.3, vol, 0.01, 0.5); osc('triangle', f * 2, dur * 0.5, vol * 0.2, 0.01, 0.4); break;
            case 'bass': { const a = osc('triangle', f, dur + 0.05, vol, 0.01, 0.05); osc('sine', f / 2, dur, vol * 0.8, 0.01, 0); break; }
            case 'squeeze': osc('sawtooth', f, dur, vol, 0.04, 0.2, -6); osc('sawtooth', f, dur, vol, 0.04, 0.2, 7); break;
            case 'pad': osc('sawtooth', f, dur, vol * 0.7, 0.4, 0.6, -8); osc('sawtooth', f, dur, vol * 0.7, 0.4, 0.6, 9); break;
            case 'kick': { const a = ctx.createOscillator(), g = ctx.createGain(); a.frequency.setValueAtTime(150, t); a.frequency.exponentialRampToValueAtTime(42, t + 0.16); env(g, vol, 0.22, 0.003); a.connect(g); g.connect(out); a.start(t); a.stop(t + 0.25); break; }
            case 'tom': { const a = ctx.createOscillator(), g = ctx.createGain(); a.frequency.setValueAtTime(MIDI(o.note) * 1.6, t); a.frequency.exponentialRampToValueAtTime(MIDI(o.note), t + 0.12); env(g, vol, 0.28, 0.003); a.connect(g); send(g, 0.2); a.start(t); a.stop(t + 0.3); break; }
            case 'wood': osc('square', MIDI(o.note), 0.05, vol * 0.5, 0.001, 0.15); break;
            case 'snare': case 'hat': case 'shaker': {
                const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
                const fl = ctx.createBiquadFilter(); fl.type = o.kind === 'snare' ? 'bandpass' : 'highpass'; fl.frequency.value = o.kind === 'snare' ? 1800 : o.kind === 'hat' ? 8000 : 6000;
                const g = ctx.createGain(); env(g, vol, o.kind === 'snare' ? 0.16 : o.kind === 'hat' ? 0.05 : 0.07, 0.002);
                s.connect(fl); fl.connect(g); send(g, o.kind === 'snare' ? 0.3 : 0.05); s.start(t, Math.random()); s.stop(t + 0.22);
                if (o.kind === 'snare') osc('triangle', 190, 0.1, vol * 0.5, 0.002, 0.1);
                break;
            }
        }
    }
}
