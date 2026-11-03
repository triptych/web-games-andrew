// Sounds of the Springwood, on the garden's own audio graph: a breeze in the
// new leaves, and by day a chorus of birds (a warbling robin, the two notes of
// a chiffchaff, a cuckoo far off, a wood pigeon, a blackbird's flute and now
// and then a woodpecker drumming). Near a pond the water laps, and after dusk
// the frogs start up. The garden's own crickets and owls carry on at night.

export class ForestAudio {
    /** @param {import('./music.js').AudioEngine} audio */
    constructor(audio) {
        this.audio = audio;
        this.on = false;
        this.built = false;
        this.nextBird = 0;
        this.nextFrog = 0;
        this.night = 0;
        this.water = 0;
    }

    _build() {
        const a = this.audio, ctx = a.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(a.master);
        this.wet = ctx.createGain();
        this.wet.gain.value = 0.45;
        this.out.connect(this.wet).connect(a.reverb);

        // the breeze in the leaves: noise through a band of rustle, breathing slowly
        const src = ctx.createBufferSource();
        src.buffer = a._noiseBuffer(6, false);
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1100;
        bp.Q.value = 0.6;
        this.breeze = ctx.createGain();
        this.breeze.gain.value = 0.035;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 0.022;
        lfo.connect(lfoAmt).connect(this.breeze.gain);
        src.connect(bp).connect(this.breeze).connect(this.out);
        src.start();
        lfo.start();

        // water lapping at a pond's edge: higher noise, chopped by a quick wobble
        const ws = ctx.createBufferSource();
        ws.buffer = a._noiseBuffer(4, false);
        ws.loop = true;
        const wbp = ctx.createBiquadFilter();
        wbp.type = 'bandpass';
        wbp.frequency.value = 1900;
        wbp.Q.value = 1.4;
        const chop = ctx.createGain();
        chop.gain.value = 0.5;
        const wl = ctx.createOscillator();
        wl.frequency.value = 2.3;
        const wla = ctx.createGain();
        wla.gain.value = 0.45;
        wl.connect(wla).connect(chop.gain);
        this.lap = ctx.createGain();
        this.lap.gain.value = 0;
        ws.connect(wbp).connect(chop).connect(this.lap).connect(this.out);
        ws.start();
        wl.start();
        this.built = true;
    }

    start() {
        if (!this.audio.ctx) return;
        if (!this.built) this._build();
        this.on = true;
        const t = this.audio.ctx.currentTime;
        this.out.gain.setTargetAtTime(1, t, 0.8);
        this.nextBird = t + 0.6;
        this.nextFrog = t + 2;
    }

    stop() {
        this.on = false;
        if (!this.built) return;
        const t = this.audio.ctx.currentTime;
        this.out.gain.setTargetAtTime(0, t, 0.3);
    }

    /** night 0..1, water 0..1 (how near a pond), wind 0..1. */
    update(night, water, wind = 0.5) {
        if (!this.on || !this.audio.ctx) return;
        const ctx = this.audio.ctx, t = ctx.currentTime;
        this.night = night;
        this.breeze.gain.setTargetAtTime(0.025 + wind * 0.03, t, 1);
        this.lap.gain.setTargetAtTime(water * 0.05, t, 0.4);
        if (this.audio.muted || this.audio.paused) return;
        if (t > this.nextBird) {
            const day = 1 - night;
            if (day > 0.35) this._bird(t + 0.05, day);
            this.nextBird = t + (day > 0.35 ? 1.2 + Math.random() * 3.2 : 4);
        }
        if (t > this.nextFrog) {
            if (night > 0.35 && water > 0.05) this._frog(t + 0.05, water);
            this.nextFrog = t + 1.5 + Math.random() * 3;
        }
    }

    _voice(pan, vol) {
        const ctx = this.audio.ctx;
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        const g = ctx.createGain();
        g.gain.value = vol;
        g.connect(p).connect(this.out);
        return g;
    }

    /** One short note: a sine sliding from f0 to f1. */
    _note(out, t, f0, f1, dur, type = 'sine', peak = 1) {
        const ctx = this.audio.ctx;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(peak, t + Math.min(0.02, dur * 0.3));
        e.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(e).connect(out);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    _bird(t, day) {
        const pan = Math.random() * 1.6 - 0.8;
        const k = Math.random();
        if (k < 0.3) {
            // a robin: a tumbling warble
            const g = this._voice(pan, 0.03 * day);
            let tt = t;
            const n = 6 + Math.floor(Math.random() * 7);
            for (let i = 0; i < n; i++) {
                const f = 2600 + Math.random() * 2200;
                const d = 0.05 + Math.random() * 0.09;
                this._note(g, tt, f, f * (0.8 + Math.random() * 0.45), d);
                tt += d + 0.02 + Math.random() * 0.05;
            }
        } else if (k < 0.48) {
            // a chiffchaff: its name, over and over
            const g = this._voice(pan, 0.026 * day);
            const n = 5 + Math.floor(Math.random() * 5);
            for (let i = 0; i < n; i++) {
                const f = i % 2 ? 4300 : 5400;
                this._note(g, t + i * 0.34, f * 1.05, f * 0.92, 0.08);
            }
        } else if (k < 0.6) {
            // a cuckoo, far off across the wood
            const g = this._voice(pan * 0.5, 0.05 * day);
            for (let rep = 0; rep < 2 + Math.floor(Math.random() * 2); rep++) {
                const tt = t + rep * 0.95;
                this._note(g, tt, 760, 740, 0.26, 'triangle');
                this._note(g, tt + 0.32, 610, 590, 0.38, 'triangle');
            }
        } else if (k < 0.72) {
            // a wood pigeon: coo-COO-coo, coo-coo
            const g = this._voice(pan, 0.05 * day);
            const pat = [[0, 0.3, 0.7], [0.36, 0.42, 1], [0.86, 0.3, 0.7], [1.3, 0.22, 0.6], [1.58, 0.22, 0.6]];
            for (const [dt, d, v] of pat) this._note(g, t + dt, 470, 400, d, 'sine', v);
        } else if (k < 0.92) {
            // a blackbird: a few slurred, fluting notes
            const g = this._voice(pan, 0.03 * day);
            let tt = t;
            const n = 3 + Math.floor(Math.random() * 4);
            let f = 1500 + Math.random() * 900;
            for (let i = 0; i < n; i++) {
                const f1 = f * (0.8 + Math.random() * 0.5);
                const d = 0.14 + Math.random() * 0.18;
                this._note(g, tt, f, f1, d, 'sine');
                tt += d + 0.04;
                f = Math.min(3200, Math.max(1200, f1 * (0.9 + Math.random() * 0.3)));
            }
        } else {
            // a woodpecker drumming somewhere
            const a = this.audio;
            const n = 14 + Math.floor(Math.random() * 8);
            const g = this._voice(pan, 1);
            for (let i = 0; i < n; i++) a._noiseBurst(t + i * 0.045, 0.03, 1300 + Math.random() * 200, 5, 0.06 * day * (1 - i / n * 0.6), 'bandpass', g);
        }
    }

    /** The fox: a short, bright yip (twice, sometimes). */
    yip() {
        if (!this.on || !this.audio.ctx || this.audio.muted) return;
        const t = this.audio.ctx.currentTime + 0.02;
        const g = this._voice(Math.random() * 0.6 - 0.3, 0.06);
        const n = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) {
            const tt = t + i * 0.2;
            this._note(g, tt, 1100, 1900, 0.05, 'triangle');
            this._note(g, tt + 0.05, 1900, 900, 0.09, 'triangle', 0.8);
        }
    }

    _frog(t, water) {
        const ctx = this.audio.ctx;
        const g = this._voice(Math.random() * 1.4 - 0.7, 0.05 * water * this.night);
        const croaks = 1 + Math.floor(Math.random() * 3);
        for (let c = 0; c < croaks; c++) {
            const tt = t + c * 0.32;
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(190 + Math.random() * 40, tt);
            o.frequency.linearRampToValueAtTime(150, tt + 0.16);
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 700;
            bp.Q.value = 3;
            // the croak's rattle: an amplitude wobble at 30 Hz
            const am = ctx.createGain();
            am.gain.value = 0.5;
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 30;
            const la = ctx.createGain();
            la.gain.value = 0.5;
            lfo.connect(la).connect(am.gain);
            const e = ctx.createGain();
            e.gain.setValueAtTime(0, tt);
            e.gain.linearRampToValueAtTime(1, tt + 0.02);
            e.gain.exponentialRampToValueAtTime(0.001, tt + 0.2);
            o.connect(bp).connect(am).connect(e).connect(g);
            o.start(tt);
            lfo.start(tt);
            o.stop(tt + 0.22);
            lfo.stop(tt + 0.22);
        }
    }
}
