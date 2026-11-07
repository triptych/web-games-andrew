// Sounds of the glowing garden under the well, on the garden's own audio graph:
// still cave air, a faint low note, water dripping and trickling into the pool
// (louder near it), and soft glass chimes from plants that are ready to pick.
// And the sounds of doing things: the rope's hiss as you slide down it, the
// thump of landing, pouring, filling the can, picking.

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export class GrottoAudio {
    /** @param {import('./music.js').AudioEngine} audio */
    constructor(audio) {
        this.audio = audio;
        this.on = false;
        this.built = false;
        this.nextDrip = 0;
        this.nextChime = 0;
    }

    _build() {
        const a = this.audio, ctx = a.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(a.master);
        this.wet = ctx.createGain();
        this.wet.gain.value = 0.75;
        this.out.connect(this.wet).connect(a.reverb);

        // cave air: soft low noise that breathes
        const src = ctx.createBufferSource();
        src.buffer = a._noiseBuffer(6, true);
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320;
        this.air = ctx.createGain();
        this.air.gain.value = 0.07;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const la = ctx.createGain();
        la.gain.value = 0.03;
        lfo.connect(la).connect(this.air.gain);
        src.connect(lp).connect(this.air).connect(this.out);
        src.start();
        lfo.start();

        // a low, slow note under everything, two sines a fifth apart
        for (const [f, v] of [[55, 0.02], [82.4, 0.012], [110.2, 0.006]]) {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = v;
            const w = ctx.createOscillator();
            w.frequency.value = 0.05 + f / 3000;
            const wa = ctx.createGain();
            wa.gain.value = v * 0.6;
            w.connect(wa).connect(g.gain);
            o.connect(g).connect(this.out);
            o.start();
            w.start();
        }

        // water running into the pool: brighter noise, chopped by a quick wobble
        const ws = ctx.createBufferSource();
        ws.buffer = a._noiseBuffer(4, false);
        ws.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2300;
        bp.Q.value = 0.9;
        const chop = ctx.createGain();
        chop.gain.value = 0.55;
        const wl = ctx.createOscillator();
        wl.frequency.value = 3.1;
        const wla = ctx.createGain();
        wla.gain.value = 0.4;
        wl.connect(wla).connect(chop.gain);
        this.trickle = ctx.createGain();
        this.trickle.gain.value = 0;
        ws.connect(bp).connect(chop).connect(this.trickle).connect(this.out);
        ws.start();
        wl.start();
        this.built = true;
    }

    start() {
        if (!this.audio.ctx) return;
        if (!this.built) this._build();
        this.on = true;
        const t = this.audio.ctx.currentTime;
        this.out.gain.setTargetAtTime(1, t, 0.6);
        this.nextDrip = t + 1.2;
        this.nextChime = t + 5;
    }

    stop() {
        this.on = false;
        if (!this.built) return;
        this.out.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.25);
    }

    /** water 0..1: how near the pool; ripe: how many plants are ready to pick. Returns true when a drip fell. */
    update(water, ripe) {
        if (!this.on || !this.audio.ctx) return false;
        const t = this.audio.ctx.currentTime;
        this.trickle.gain.setTargetAtTime(0.012 + water * 0.07, t, 0.4);
        if (this.audio.muted || this.audio.paused) return false;
        let dripped = false;
        if (t > this.nextDrip) {
            this._drip(t + 0.02, water);
            dripped = true;
            this.nextDrip = t + 0.8 + Math.random() * 2.6;
        }
        if (t > this.nextChime) {
            if (ripe > 0) this._chime(t + 0.05, 0.016 + 0.004 * Math.min(ripe, 4));
            this.nextChime = t + 3.5 + Math.random() * 6;
        }
        return dripped;
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

    _note(out, t, f0, f1, dur, type = 'sine', peak = 1) {
        const ctx = this.audio.ctx;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(peak, t + Math.min(0.012, dur * 0.3));
        e.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(e).connect(out);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    /** One drop into water: a short falling sine, then its echo. */
    _drip(t, water) {
        const f = 900 + Math.random() * 1500;
        const g = this._voice(Math.random() * 1.6 - 0.8, 0.045 + water * 0.03);
        this._note(g, t, f * 1.25, f * 0.7, 0.11);
        this._note(g, t + 0.17, f * 1.1, f * 0.62, 0.1, 'sine', 0.35);
    }

    /** A soft glass chime from somewhere in the garden. */
    _chime(t, vol) {
        const g = this._voice(Math.random() * 1.2 - 0.6, vol);
        const f = PENTA[Math.floor(Math.random() * PENTA.length)];
        this._note(g, t, f, f * 0.998, 1.6, 'sine', 1);
        this._note(g, t, f * 2.01, f * 2.0, 0.9, 'sine', 0.25);
    }

    // ------------------------------------------------------------------ doing things

    /** Down the rope: air rushing past and the rope hissing through your hands. */
    slide(dur = 4) {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        const ctx = a.ctx, t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = a._noiseBuffer(Math.ceil(dur) + 1, false);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(600, t);
        hp.frequency.linearRampToValueAtTime(2600, t + dur * 0.5);
        hp.frequency.linearRampToValueAtTime(700, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.1, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.12, t + dur * 0.6);
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(hp).connect(g).connect(a.sfx);
        const send = ctx.createGain();
        send.gain.value = 0.5;
        g.connect(send).connect(a.reverb);
        src.start(t);
        src.stop(t + dur + 0.1);
        // the rope creaking on its beam
        for (let i = 0; i < 4; i++) this.creak(t + 0.2 + i * dur * 0.22);
    }

    creak(t = this.audio.ctx?.currentTime) {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        const ctx = a.ctx;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f = 150 + Math.random() * 80;
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * (0.7 + Math.random() * 0.5), t + 0.35);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 520;
        bp.Q.value = 6;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(0.035, t + 0.08);
        e.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(bp).connect(e).connect(a.sfx);
        o.start(t);
        o.stop(t + 0.45);
    }

    /** Boots on stone after the long slide. */
    thump() {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        const ctx = a.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(g).connect(a.sfx);
        o.start(t);
        o.stop(t + 0.45);
        a._noiseBurst(t, 0.18, 420, 1, 0.12, 'lowpass');
    }

    /** Tipping the can over a plant: a soft rain of water and a few drops after. */
    pour() {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        const t = a.ctx.currentTime;
        a._noiseBurst(t, 0.85, 1900, 0.8, 0.07, 'bandpass');
        a._noiseBurst(t + 0.1, 0.6, 3400, 0.6, 0.035, 'highpass');
        for (let i = 0; i < 4; i++) a._noiseBurst(t + 0.9 + i * 0.13 + Math.random() * 0.05, 0.05, 1800 + Math.random() * 800, 4, 0.04, 'bandpass');
    }

    /** Dipping the can in the pool: a gulp and bubbles. */
    fill() {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        const ctx = a.ctx, t = ctx.currentTime;
        a._noiseBurst(t, 0.35, 700, 1, 0.08, 'lowpass');
        for (let i = 0; i < 7; i++) {
            const tt = t + 0.25 + i * 0.09;
            const o = ctx.createOscillator();
            o.type = 'sine';
            const f = 300 + i * 90 + Math.random() * 60;
            o.frequency.setValueAtTime(f, tt);
            o.frequency.exponentialRampToValueAtTime(f * 1.8, tt + 0.07);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.05, tt);
            g.gain.exponentialRampToValueAtTime(0.001, tt + 0.09);
            o.connect(g).connect(a.sfx);
            o.start(tt);
            o.stop(tt + 0.1);
        }
    }

    /** Picking something: a soft pop and two rising chimes. */
    harvest(n = 1) {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        const ctx = a.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(620, t);
        o.frequency.exponentialRampToValueAtTime(240, t + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(a.sfx);
        o.start(t);
        o.stop(t + 0.14);
        const k = Math.min(n, 4);
        for (let i = 0; i < k; i++) a._bell(PENTA[(i * 2) % PENTA.length], t + 0.06 + i * 0.1, 0.03, a.sfx);
    }

    /** A plant has had its drink. */
    drink() {
        const a = this.audio;
        if (!a.ctx || a.muted) return;
        a._bell(PENTA[3], a.ctx.currentTime + 0.05, 0.02, a.sfx);
    }
}
