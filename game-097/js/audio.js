// Procedural sound, all Web Audio, no files: a cold cathedral pad and tolling bells for the music,
// stone, steel and chimes for the effects. The context is made on the first user gesture (browsers
// block audio before one), and ../lib/page-audio.js suspends it while the tab is hidden.

const A_MINOR = [0, 2, 3, 5, 7, 8, 11];                 // harmonic minor, degrees in semitones
const PROG = [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]];     // i  VI  iv  V as scale-degree triads
const hz = (semi) => 55 * Math.pow(2, semi / 12);          // A1 = 55

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.mood = 'none';
        this.nextBar = 0;
        this.bar = 0;
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // a stone-hall reverb from decaying noise
        const len = Math.floor(ctx.sampleRate * 2.6);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        this.wet = ctx.createGain(); this.wet.gain.value = 0.5;
        this.verb.connect(this.wet); this.wet.connect(comp);
        this.sfx.connect(this.verb); this.music.connect(this.verb);
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this.nextBar = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this._schedule(), 250);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    get live() { return !!this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, dest = null, attack = 0.01 } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest || this.sfx);
        o.start(t); o.stop(t + dur + 0.05);
    }

    /** A burst of filtered noise: steel, stone, wind. */
    noise({ dur = 0.15, vol = 0.2, freq = 1500, q = 1, type = 'bandpass', delay = 0, to = freq } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(t); s.stop(t + dur + 0.05);
    }

    /** An inharmonic bell: a few sine partials with long tails. */
    bell(freq, vol = 0.15, delay = 0, dest = null) {
        for (const [m, v, d] of [[1, 1, 3.2], [2.01, 0.5, 2.2], [2.76, 0.35, 1.6], [4.07, 0.2, 1.0], [5.4, 0.12, 0.7]]) {
            this.tone({ freq: freq * m, dur: d, type: 'sine', vol: vol * v, delay, dest, attack: 0.004 });
        }
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 520, to: 460, dur: 0.06, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 330, to: 520, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'deny') this.tone({ freq: 150, to: 110, dur: 0.12, type: 'sawtooth', vol: 0.1 });
        else if (kind === 'select') this.tone({ freq: 660, to: 880, dur: 0.07, type: 'triangle', vol: 0.1 });
    }
    step() { this.noise({ dur: 0.09, vol: 0.12, freq: 380, q: 0.8, type: 'lowpass' }); this.tone({ freq: 90, to: 55, dur: 0.1, type: 'sine', vol: 0.14 }); }
    swish() { this.noise({ dur: 0.18, vol: 0.12, freq: 600, to: 3200, q: 2 }); }
    hit(crit = false) {
        this.noise({ dur: 0.12, vol: crit ? 0.32 : 0.22, freq: 2400, to: 500, q: 1.2 });
        this.tone({ freq: crit ? 120 : 160, to: 45, dur: 0.22, type: 'sine', vol: crit ? 0.4 : 0.28 });
        if (crit) { this.bell(880, 0.1); this.noise({ dur: 0.5, vol: 0.12, freq: 5000, to: 1200, q: 0.5 }); }
    }
    miss() { this.swish(); }
    death() { this.tone({ freq: 220, to: 40, dur: 0.7, type: 'sawtooth', vol: 0.16 }); this.noise({ dur: 0.7, vol: 0.12, freq: 900, to: 120, q: 0.7 }); }
    cast(el) {
        const f = { ember: 220, tide: 330, thorn: 262, umbra: 175, lumen: 440 }[el] || 300;
        this.tone({ freq: f, to: f * 2.2, dur: 0.4, type: 'sawtooth', vol: 0.1 });
        this.tone({ freq: f * 1.5, to: f * 3, dur: 0.4, type: 'triangle', vol: 0.1, delay: 0.05 });
    }
    heal() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.35, type: 'sine', vol: 0.12, delay: i * 0.07 })); }
    boom() { this.tone({ freq: 140, to: 30, dur: 0.5, type: 'sine', vol: 0.4 }); this.noise({ dur: 0.5, vol: 0.28, freq: 1800, to: 150, q: 0.6 }); }
    levelup() { [392, 494, 587, 784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.13, delay: i * 0.09 })); this.bell(784, 0.1, 0.4); }
    toll(deep = false) { this.bell(deep ? 98 : 147, 0.2); }
    summon(star) {
        const root = star >= 5 ? 392 : star === 4 ? 330 : 262;
        this.bell(root, 0.12 + (star - 3) * 0.04);
        if (star >= 4) [1.25, 1.5, 2].forEach((m, i) => this.bell(root * m, 0.1, 0.12 * (i + 1)));
        if (star >= 5) this.noise({ dur: 1.4, vol: 0.14, freq: 600, to: 6000, q: 0.5 });
    }
    win() { [262, 330, 392, 523].forEach((f, i) => { this.bell(f, 0.12, i * 0.18); }); }
    lose() { [220, 208, 175, 110].forEach((f, i) => this.bell(f, 0.16, i * 0.4)); }

    /** Simulation events that are not drawn by the view's own animations. */
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'summon') e.pulls.slice().sort((a, b) => b.star - a.star).slice(0, 1).forEach((p) => this.summon(p.star));
        }
    }

    // ------------------------------------------------------------------ music
    setMood(mood) { this.mood = mood; }

    _schedule() {
        if (!this.live || this.mood === 'none') return;
        const ctx = this.ctx;
        if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.05;
        const barLen = this.mood === 'battle' ? 5 : 8;
        while (this.nextBar < ctx.currentTime + 1.5) {
            this._bar(this.nextBar, barLen, PROG[this.bar % PROG.length]);
            this.nextBar += barLen;
            this.bar++;
        }
    }

    _bar(t, len, triad) {
        const ctx = this.ctx;
        const battle = this.mood === 'battle';
        // the pad: three detuned saws through a slow low-pass, one octave below the tune
        for (const deg of triad) {
            const semi = A_MINOR[deg % 7] + (deg >= 7 ? 12 : 0);
            for (const det of [-6, 6]) {
                const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
                o.type = 'sawtooth'; o.frequency.value = hz(semi + 12); o.detune.value = det;
                f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(battle ? 900 : 650, t + len * 0.5); f.frequency.linearRampToValueAtTime(300, t + len);
                g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
                o.connect(f); f.connect(g); g.connect(this.music);
                o.start(t); o.stop(t + len + 0.1);
            }
        }
        // the root, low and steady
        const root = A_MINOR[triad[0] % 7];
        this._note(hz(root), t, len, 'sine', 0.12);
        // bells picking through the chord
        const n = battle ? 6 : 4;
        for (let i = 0; i < n; i++) {
            const deg = triad[Math.floor(Math.random() * 3)] + (Math.random() < 0.4 ? 7 : 0);
            const f = hz(A_MINOR[deg % 7] + 24 + (deg >= 7 ? 12 : 0));
            this.bell(f, 0.05, (t - ctx.currentTime) + (i + Math.random() * 0.4) * (len / n), this.music);
        }
        if (battle) {
            // a slow war-drum pulse
            for (let b = 0; b < len; b++) {
                const when = t + b - ctx.currentTime;
                this.tone({ freq: 90, to: 38, dur: 0.35, type: 'sine', vol: 0.16, delay: when, dest: this.music });
                if (b % 2 === 1) this.tone({ freq: 70, to: 30, dur: 0.3, type: 'sine', vol: 0.1, delay: when + 0.5, dest: this.music });
            }
        }
    }

    _note(freq, t, len, type, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + len + 0.1);
    }
}
