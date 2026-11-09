// Sounds of the crashed rocket and the worlds beyond its transporter, on the
// garden's own audio graph. Aboard: the low hum of what is left of the engine,
// the buzz of failing lights, crackles from the sparking wires, and now and
// then a groan from the hull. The transporter: a whine that climbs as it
// charges, a burst and a shimmer as you go, a chime as you arrive. On a planet:
// the wind (none at all on an airless moon), your breathing inside the suit
// (quicker as the air runs low), animals calling in the distance, the alarm
// when the air is nearly gone, and a faint radio ping if something out there
// is still sending.

export class RocketAudio {
    /** @param {import('./music.js').AudioEngine} audio */
    constructor(audio) {
        this.audio = audio;
        this.on = false;
        this.built = false;
        this.mode = 'ship';
        this.nextCreak = 0;
        this.nextCall = 0;
        this.nextBreath = 0;
        this.breathRate = 0.22;
    }

    get ctx() {
        return this.audio?.ctx;
    }

    _build() {
        const a = this.audio, ctx = a.ctx;
        this.noise = a._noiseBuffer(3, false);
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(a.master);
        const wet = ctx.createGain();
        wet.gain.value = 0.35;
        this.out.connect(wet).connect(a.reverb);

        // ---- aboard: the engine's hum and the lights' buzz
        this.shipBus = ctx.createGain();
        this.shipBus.gain.value = 0;
        this.shipBus.connect(this.out);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        lp.connect(this.shipBus);
        for (const [f, v] of [[46.2, 0.06], [46.9, 0.05], [92.5, 0.025]]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = v;
            o.connect(g).connect(lp);
            o.start();
        }
        const buzz = ctx.createOscillator();
        buzz.type = 'square';
        buzz.frequency.value = 120;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1900;
        bp.Q.value = 3;
        this.buzz = ctx.createGain();
        this.buzz.gain.value = 0.006;
        buzz.connect(bp).connect(this.buzz).connect(this.shipBus);
        buzz.start();

        // ---- outside: wind through a band-pass that wanders
        this.planetBus = ctx.createGain();
        this.planetBus.gain.value = 0;
        this.planetBus.connect(this.out);
        const ws = ctx.createBufferSource();
        ws.buffer = a._noiseBuffer(6, true);
        ws.loop = true;
        this.windF = ctx.createBiquadFilter();
        this.windF.type = 'bandpass';
        this.windF.frequency.value = 500;
        this.windF.Q.value = 0.7;
        this.wind = ctx.createGain();
        this.wind.gain.value = 0.2;
        const wl = ctx.createOscillator();
        wl.frequency.value = 0.09;
        const wla = ctx.createGain();
        wla.gain.value = 260;
        wl.connect(wla).connect(this.windF.frequency);
        ws.connect(this.windF).connect(this.wind).connect(this.planetBus);
        ws.start();
        wl.start();
        this.built = true;
    }

    start() {
        if (!this.ctx) return;
        if (!this.built) this._build();
        this.on = true;
        this.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
        this.setMode(this.mode);
    }

    stop() {
        if (!this.built) return;
        this.on = false;
        this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }

    /** 'ship' or 'planet' (with { wind: 0..1 }). */
    setMode(mode, opts = {}) {
        this.mode = mode;
        if (!this.built) return;
        const t = this.ctx.currentTime;
        this.shipBus.gain.setTargetAtTime(mode === 'ship' ? 1 : 0, t, 0.6);
        this.planetBus.gain.setTargetAtTime(mode === 'planet' ? 1 : 0, t, 0.6);
        if (mode === 'planet') {
            this.wind.gain.setTargetAtTime(0.05 + (opts.wind ?? 0.5) * 0.4, t, 0.5);
            this.windF.frequency.value = 300 + (opts.pitch ?? 0.5) * 700;
        }
    }

    _burst(t, dur, freq, q, vol, type = 'bandpass', dest = this.out) {
        const ctx = this.ctx;
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(dest);
        s.start(t, Math.random() * 2);
        s.stop(t + dur + 0.05);
    }

    _tone(t, f0, f1, dur, vol, type = 'sine', dest = this.out) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    /** The crackle of a shorting wire; `near` 0..1. */
    spark(near = 1) {
        if (!this.on || this.audio.muted) return;
        const t = this.ctx.currentTime;
        const n = 3 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) this._burst(t + i * (0.015 + Math.random() * 0.04), 0.02 + Math.random() * 0.05, 2500 + Math.random() * 5000, 1.5, 0.12 * near, 'highpass');
        this._burst(t, 0.18, 180, 2, 0.05 * near);
    }

    /** The lights catching and failing: a quick swell in the buzz. */
    flicker() {
        if (!this.built) return;
        const g = this.buzz.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.03, t);
        g.setTargetAtTime(0.006, t + 0.05, 0.08);
    }

    /** The transporter charging for `dur` seconds, then the burst. */
    energize(dur = 2.4) {
        if (!this.on || this.audio.muted) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(1600, t + dur);
        const trem = ctx.createOscillator();
        trem.frequency.setValueAtTime(6, t);
        trem.frequency.linearRampToValueAtTime(28, t + dur);
        const tg = ctx.createGain();
        tg.gain.value = 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + dur * 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
        trem.connect(tg).connect(g.gain);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.exponentialRampToValueAtTime(5000, t + dur);
        o.connect(f).connect(g).connect(this.out);
        o.start(t);
        trem.start(t);
        o.stop(t + dur + 0.4);
        trem.stop(t + dur + 0.4);
        // a shimmer of bells over it
        for (let i = 0; i < 10; i++) this._tone(t + (i / 10) * dur, 1200 + i * 180, 1400 + i * 200, 0.6, 0.012);
        // and the burst
        this._burst(t + dur, 1.2, 3000, 0.6, 0.25, 'bandpass');
        this._tone(t + dur, 1800, 300, 1.0, 0.05, 'triangle');
    }

    /** Arriving: a chime, falling into place. */
    arrive() {
        if (!this.on || this.audio.muted) return;
        const t = this.ctx.currentTime;
        [1318.5, 987.8, 783.99, 659.25].forEach((f, i) => this._tone(t + i * 0.09, f, f * 0.998, 1.4, 0.035, 'sine'));
        this._burst(t, 0.8, 1600, 0.5, 0.08, 'bandpass');
    }

    /** The oxygen alarm: `urgent` beeps faster and higher. */
    alarm(urgent) {
        if (!this.on || this.audio.muted) return;
        const t = this.ctx.currentTime;
        const f = urgent ? 1320 : 990;
        this._tone(t, f, f, 0.12, 0.05, 'square');
        this._tone(t + 0.18, f, f, 0.12, 0.05, 'square');
    }

    /** A faint radio ping, nearer is louder and brighter. */
    ping(near) {
        if (!this.on || this.audio.muted) return;
        const t = this.ctx.currentTime;
        this._tone(t, 1500 + near * 700, 1480 + near * 700, 0.35, 0.008 + near * 0.03, 'sine');
        this._burst(t, 0.25, 2400, 3, 0.006 + near * 0.01, 'bandpass');
    }

    /** Finding the pilot: a slow, low chord. */
    found() {
        if (!this.on || this.audio.muted) return;
        const t = this.ctx.currentTime;
        [220, 261.63, 329.63, 392].forEach((f, i) => this._tone(t + i * 0.25, f, f, 3.5, 0.03, 'triangle'));
    }

    /** Running out of air. */
    gasp() {
        if (!this.on || this.audio.muted) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.9, 700, 1.2, 0.18, 'bandpass');
        this._tone(t, 180, 90, 1.2, 0.05, 'sine');
    }

    /** Called every frame: the hull's groans aboard; breath, wind and animals outside. */
    update(dt, { airLeft = 1, calls = 0, airless = false } = {}) {
        if (!this.on || !this.built || this.audio.muted) return;
        const t = this.ctx.currentTime;
        if (this.mode === 'ship') {
            if (t > this.nextCreak) {
                this.nextCreak = t + 6 + Math.random() * 12;
                this._tone(t, 70 + Math.random() * 40, 50 + Math.random() * 20, 1.6, 0.04, 'sawtooth');
                this._burst(t, 1.2, 300, 6, 0.03);
            }
        } else if (this.mode === 'planet') {
            // breathing in the suit: in and out, quicker as the air runs low
            const period = airLeft < 0.15 ? 1.5 : airLeft < 0.35 ? 2.4 : 3.6;
            if (t > this.nextBreath) {
                this.nextBreath = t + period;
                this._burst(t, period * 0.38, 900, 0.8, 0.035, 'bandpass');
                this._burst(t + period * 0.45, period * 0.42, 600, 0.8, 0.03, 'bandpass');
            }
            if (calls && !airless && t > this.nextCall) {
                this.nextCall = t + 4 + Math.random() * 9;
                // a call from somewhere: a chirp, a whoop, or a long low note
                const k = Math.random();
                if (k < 0.4) for (let i = 0; i < 3; i++) this._tone(t + i * 0.12, 1800 + Math.random() * 800, 2600 + Math.random() * 600, 0.1, 0.014, 'sine');
                else if (k < 0.75) this._tone(t, 300 + Math.random() * 200, 700 + Math.random() * 300, 0.6, 0.018, 'triangle');
                else this._tone(t, 110 + Math.random() * 40, 80, 2.2, 0.025, 'sine');
            }
        }
    }
}
