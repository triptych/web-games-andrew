// Procedural sound, all Web Audio, no files. A theremin carries the score over an organ pad, a
// walking bass and bongos; effects answer simulation events as the view plays them back.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while hidden.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// four little tunes as [midi or null, beats]. A theremin wants long notes and slides between them.
const TUNES = {
    title: { bpm: 72, root: 50, chords: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [7, 11, 14]], mel: [[74, 2], [77, 1], [76, 1], [74, 3], [null, 1], [70, 2], [72, 1], [74, 1], [69, 4], [74, 2], [79, 2], [78, 3], [76, 1], [74, 6], [null, 2]] },
    map: { bpm: 92, root: 53, chords: [[0, 4, 7], [-3, 0, 4], [2, 5, 9], [-5, -1, 2]], mel: [[72, 1], [76, 1], [79, 2], [77, 1], [76, 1], [74, 2], [72, 1], [74, 1], [76, 2], [69, 4], [72, 1], [76, 1], [79, 2], [81, 2], [79, 4], [null, 2]] },
    battle: { bpm: 118, root: 45, chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-5, -1, 2]], mel: [[69, 1], [72, 1], [76, 2], [75, 1], [72, 1], [69, 2], [null, 1], [68, 1], [71, 1], [74, 1], [77, 3], [76, 1], [74, 2], [72, 2], [null, 2]] },
    boss: { bpm: 104, root: 41, chords: [[0, 3, 6], [1, 4, 8], [0, 3, 6], [-1, 3, 6]], mel: [[65, 2], [71, 2], [70, 1], [68, 1], [65, 2], [null, 1], [64, 1], [70, 2], [73, 2], [71, 4], [65, 1], [66, 1], [71, 2], [77, 4], [null, 2]] },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.mode = null;
        this.want = 'title';
        this.timer = null;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // reverb from a decaying noise impulse
        const len = Math.floor(ctx.sampleRate * 2.4);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.35;
        this.verbIn.connect(this.verb); this.verb.connect(this.music);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this._theremin();
        this.setMusic(this.want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }

    // ------------------------------------------------------------------ the score
    _theremin() {
        const ctx = this.ctx;
        const o = ctx.createOscillator(); o.type = 'sine';
        const o2 = ctx.createOscillator(); o2.type = 'triangle';
        const lfo = ctx.createOscillator(); lfo.frequency.value = 5.8;
        const depth = ctx.createGain(); depth.gain.value = 7;
        lfo.connect(depth); depth.connect(o.frequency); depth.connect(o2.frequency);
        const mix2 = ctx.createGain(); mix2.gain.value = 0.18;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        const g = ctx.createGain(); g.gain.value = 0;
        o.connect(lp); o2.connect(mix2); mix2.connect(lp); lp.connect(g);
        g.connect(this.music); g.connect(this.verbIn);
        o.frequency.value = 440; o2.frequency.value = 440;
        o.start(); o2.start(); lfo.start();
        this.th = { o, o2, g };
    }

    setMusic(mode) {
        this.want = mode;
        if (!this.ctx || this.mode === mode) return;
        this.mode = mode;
        clearInterval(this.timer);
        const tune = TUNES[mode] || TUNES.map;
        const spb = 60 / tune.bpm;
        let t = this.ctx.currentTime + 0.1;
        let mi = 0, beat = 0, noteEnd = t;
        const loopBeats = tune.mel.reduce((a, m) => a + m[1], 0);
        // the look-ahead scheduler: queue everything that starts in the next 0.3 s
        const tick = () => {
            if (!this.ctx || this.ctx.state !== 'running') return;
            const now = this.ctx.currentTime;
            if (t < now) { t = now + 0.05; noteEnd = t; }
            while (t < now + 0.3) {
                const bar = Math.floor(beat / 4) % tune.chords.length;
                const ch = tune.chords[bar];
                const bi = beat % 4;
                // walking bass and pad
                const bassN = tune.root - 12 + (bi === 2 ? ch[2] : bi === 3 ? ch[1] : ch[0]);
                this._pluck(NOTE(bassN), t, spb * 0.9, 0.22, 'triangle', this.music);
                if (bi === 0) for (const n of ch) this._pad(NOTE(tune.root + 12 + n), t, spb * 4);
                if (mode === 'battle' || mode === 'boss') {
                    this._bongo(t, bi % 2 ? 420 : 300, 0.12);
                    this._bongo(t + spb * 0.5, 520, 0.06);
                }
                // the theremin melody
                if (t >= noteEnd - 1e-6) {
                    const [n, len] = tune.mel[mi % tune.mel.length];
                    const g = this.th.g.gain;
                    if (n == null) g.setTargetAtTime(0.0, t, 0.12);
                    else {
                        this.th.o.frequency.setTargetAtTime(NOTE(n), t, 0.06);
                        this.th.o2.frequency.setTargetAtTime(NOTE(n), t, 0.06);
                        g.setTargetAtTime(0.16, t, 0.08);
                        g.setTargetAtTime(0.1, t + len * spb * 0.6, 0.2);
                    }
                    noteEnd = t + len * spb;
                    mi++;
                }
                t += spb;
                beat = (beat + 1) % (loopBeats * 4);
            }
        };
        tick();
        this.timer = setInterval(tick, 60);
    }

    _pluck(f, t, dur, vol, type, dest) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
    }
    _pad(f, t, dur) {
        const ctx = this.ctx;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        lp.connect(g); g.connect(this.music); g.connect(this.verbIn);
        for (const d of [-4, 4]) {
            const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.detune.value = d;
            o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
        }
    }
    _bongo(t, f, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + 0.16);
    }

    // ------------------------------------------------------------------ effects
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    noise({ dur = 0.2, vol = 0.2, from = 2000, to = 400, type = 'bandpass', delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
        f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'no') this.tone({ freq: 180, to: 140, dur: 0.14, type: 'square', vol: 0.08 });
        else if (kind === 'buy') { this.tone({ freq: 1320, dur: 0.07, type: 'square', vol: 0.08 }); this.tone({ freq: 1760, dur: 0.18, type: 'triangle', vol: 0.12, delay: 0.06 }); }
    }

    /** One event, as the view plays it. */
    event(e) {
        const PENTA = [0, 2, 4, 7, 9];
        switch (e.type) {
            case 'play': {
                const c = Math.min(e.chain - 1, 19);
                const n = 72 + Math.floor(c / 5) * 12 + PENTA[c % 5];
                this.tone({ freq: NOTE(n), dur: 0.09, type: 'square', vol: 0.09 });
                this.tone({ freq: NOTE(n + 12), dur: 0.12, type: 'triangle', vol: 0.06, delay: 0.02 });
                break;
            }
            case 'flip': this.tone({ freq: 1800, to: 1200, dur: 0.03, type: 'triangle', vol: 0.04 }); break;
            case 'draw': this.noise({ dur: 0.16, vol: 0.12, from: 800, to: 3000 }); break;
            case 'deal': for (let i = 0; i < 6; i++) this.noise({ dur: 0.04, vol: 0.06, from: 2500, to: 1800, delay: i * 0.05 }); break;
            case 'hit':
                if (e.who === 'enemy') {
                    if (e.src === 'rocket') { this.noise({ dur: 0.25, vol: 0.18, from: 600, to: 80, type: 'lowpass' }); }
                    else this.tone({ freq: 1400, to: 160, dur: 0.16, type: 'sawtooth', vol: 0.09 });
                    if (e.blocked && !e.n) this.tone({ freq: 300, dur: 0.08, type: 'square', vol: 0.08 });
                } else if (e.n > 0) {
                    this.noise({ dur: 0.3, vol: 0.3, from: 400, to: 60, type: 'lowpass' });
                    this.tone({ freq: 110, to: 50, dur: 0.25, type: 'sine', vol: 0.3 });
                } else this.tone({ freq: 520, to: 480, dur: 0.12, type: 'square', vol: 0.08 });
                break;
            case 'block': this.tone({ freq: e.who === 'enemy' ? 160 : 240, to: e.who === 'enemy' ? 150 : 360, dur: 0.18, type: 'sawtooth', vol: 0.05 }); break;
            case 'charge': this.tone({ freq: 500, to: 1000, dur: 0.1, type: 'sine', vol: 0.12 }); break;
            case 'heal': this.tone({ freq: 660, to: 990, dur: 0.25, type: 'sine', vol: 0.1 }); break;
            case 'gadget': this.tone({ freq: 2400, to: 300, dur: 0.22, type: 'sawtooth', vol: 0.09 }); this.tone({ freq: 1200, to: 200, dur: 0.2, type: 'square', vol: 0.05, delay: 0.03 }); break;
            case 'jam': this.noise({ dur: 0.5, vol: 0.14, from: 5000, to: 4000, type: 'highpass' }); break;
            case 'freeze': for (let i = 0; i < 4; i++) this.tone({ freq: 2000 + i * 400, dur: 0.12, type: 'triangle', vol: 0.05, delay: i * 0.05 }); break;
            case 'enemyMove': this.tone({ freq: 90, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.08 }); break;
            case 'sweep': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.08, delay: i * 0.06 })); break;
            case 'defeat': [392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.14, delay: i * 0.1 })); break;
            case 'dead': this.tone({ freq: 660, to: 110, dur: 1.6, type: 'sine', vol: 0.2 }); break;
            case 'reshuffle': this.noise({ dur: 0.3, vol: 0.1, from: 3000, to: 1500 }); break;
            case 'vaporize': this.noise({ dur: 0.3, vol: 0.14, from: 4000, to: 300 }); break;
            case 'status': if (e.what === 'stun') this.event({ type: 'freeze' }); else this.tone({ freq: 400, to: 800, dur: 0.15, type: 'triangle', vol: 0.07 }); break;
            case 'gain': this.ui('buy'); break;
            case 'travel': this.tone({ freq: 330, to: 440, dur: 0.12, type: 'triangle', vol: 0.1 }); break;
        }
    }
}
