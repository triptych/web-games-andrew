// Procedural sound, all Web Audio, no files. Effects answer simulation events; a quiet pentatonic music box
// drifts underneath. The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const SCALE = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25];   // D minor pentatonic-ish

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.mood = 'title';                // title | work
        this.step = 0;
        this.nextAt = 0;
        this.note = 4;
        this.hum = null;
        this.humOn = false;
        this._peak = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        const meter = ctx.createAnalyser();
        meter.fftSize = 512;
        comp.connect(meter); meter.connect(ctx.destination);
        this.meter = meter; this._buf = new Float32Array(meter.fftSize);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);

        // the hum of a spell being focused: rises with the focus
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 180; g.gain.value = 0;
        o.connect(g); g.connect(this.sfx); o.start();
        this.hum = { o, g };

        // one second of noise, reused by every whoosh and rustle
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this.nextAt = ctx.currentTime + 0.2;
        this.timer = setInterval(() => this.schedule(), 120);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    /** Output level 0..1 since the last call, for tests that check the game is not silent. */
    level() {
        if (!this.meter) return 0;
        this.meter.getFloatTimeDomainData(this._buf);
        let p = 0;
        for (const v of this._buf) p = Math.max(p, Math.abs(v));
        this._peak = Math.max(this._peak * 0.9, p);
        return this._peak;
    }

    get running() { return !!this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus = this.sfx } = {}) {
        if (!this.running) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + dur + 0.02);
    }

    /** A burst of filtered noise: the scratch of a quill, the rustle of paper. */
    noise({ dur = 0.2, from = 1800, to = from, vol = 0.15, delay = 0, q = 0.8 } = {}) {
        if (!this.running) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        s.buffer = this.noiseBuf;
        f.type = 'bandpass'; f.Q.value = q;
        f.frequency.setValueAtTime(from, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(t, Math.random() * 0.5, dur + 0.05);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
    }

    /** The hum follows a spell being held: null when none is. */
    setChannel(focus) {
        if (!this.hum) return;
        const on = focus != null;
        if (!on && !this.humOn) return;
        this.humOn = on;
        const t = this.ctx.currentTime;
        this.hum.g.gain.setTargetAtTime(on ? 0.025 + 0.06 * focus : 0, t, 0.05);
        if (on) this.hum.o.frequency.setTargetAtTime(170 + 420 * focus, t, 0.05);
    }

    setMood(mood) { this.mood = mood; }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'channel') this.tone({ freq: 330, to: 440, dur: 0.06, type: 'triangle', vol: 0.08 });
            else if (e.type === 'scry') {
                const f = e.focus;
                this.noise({ dur: 0.25 + f * 0.25, from: 600 + f * 2400, to: 300, vol: 0.12 + f * 0.12 });
                if (f >= 0.35) this.tone({ freq: 260 + f * 500, to: 130, dur: 0.3, type: 'sine', vol: 0.12 + f * 0.1 });
                else this.tone({ freq: 150, to: 80, dur: 0.12, type: 'square', vol: 0.06 });     // a fizzle
            } else if (e.type === 'found') {
                this.tone({ freq: 880, dur: 0.18, type: 'triangle', vol: 0.15 });
                this.tone({ freq: 1320, dur: 0.3, type: 'triangle', vol: 0.13, delay: 0.1 });
            } else if (e.type === 'deliver') this.noise({ dur: 0.35, from: 3000, to: 900, vol: 0.12, q: 0.5 });
            else if (e.type === 'result') {
                if (e.stars === 0) [330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.15, delay: 0.2 + i * 0.18 }));
                else [523, 659, 784, 1047].slice(0, e.stars + 1).forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.16, delay: 0.2 + i * 0.14 }));
            } else if (e.type === 'over') [392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.6, type: 'triangle', vol: 0.14, delay: i * 0.15 }));
        }
    }

    // ---------------------------------------------------------------- music: a slow music box and a pad
    schedule() {
        if (!this.running || this.musicVol <= 0) { if (this.ctx) this.nextAt = Math.max(this.nextAt, this.ctx.currentTime); return; }
        const beat = 0.95;
        while (this.nextAt < this.ctx.currentTime + 0.4) {
            const n = this.step++;
            const play = this.mood === 'work' ? Math.random() < 0.75 : n % 2 === 0;
            if (play) {
                this.note = Math.max(0, Math.min(SCALE.length - 1, this.note + Math.round((Math.random() - 0.5) * 4)));
                const f = SCALE[this.note];
                const t = this.nextAt - this.ctx.currentTime;
                this.tone({ freq: f, dur: 1.4, type: 'triangle', vol: 0.09, delay: t, bus: this.music });
                this.tone({ freq: f * 2, dur: 0.5, type: 'sine', vol: 0.03, delay: t, bus: this.music });
            }
            if (n % 8 === 0) {
                const t = this.nextAt - this.ctx.currentTime, root = [73.42, 87.31, 98, 65.41][(n / 8) % 4 | 0];
                this.tone({ freq: root, dur: beat * 8, type: 'sine', vol: 0.07, delay: t, bus: this.music });
                this.tone({ freq: root * 1.5, dur: beat * 8, type: 'sine', vol: 0.035, delay: t, bus: this.music });
            }
            this.nextAt += beat;
        }
    }
}
