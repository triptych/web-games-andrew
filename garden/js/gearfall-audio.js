// Sounds of Gearfall, on the garden's own audio graph: wind moaning through
// the empty streets (and a whistle in it when it gusts), metal groaning and
// creaking somewhere, now and then something giving way far off, the buzz of
// a dying light when you are near one, water dripping in the long corridor,
// and the crater's deep hum as you come near it. Plus the keypad's beeps, the
// vault door's klaxon and grind, and the robot's groan when it is touched.

export class GearfallAudio {
    /** @param {import('./music.js').AudioEngine} audio */
    constructor(audio) {
        this.audio = audio;
        this.on = false;
        this.built = false;
        this.next = { creak: 0, crash: 0, drip: 0 };
    }

    _build() {
        const a = this.audio, ctx = a.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(a.master);
        const wet = ctx.createGain();
        wet.gain.value = 0.6;
        this.out.connect(wet).connect(a.reverb);

        // the wind: a low moan, and a whistle that rises with the gusts
        const src = ctx.createBufferSource();
        src.buffer = a._noiseBuffer(7, true);
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 380;
        bp.Q.value = 0.7;
        this.wind = ctx.createGain();
        this.wind.gain.value = 0.08;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 0.045;
        lfo.connect(lfoAmt).connect(this.wind.gain);
        src.connect(bp).connect(this.wind).connect(this.out);
        const ws = ctx.createBufferSource();
        ws.buffer = a._noiseBuffer(5, false);
        ws.loop = true;
        this.whistleF = ctx.createBiquadFilter();
        this.whistleF.type = 'bandpass';
        this.whistleF.frequency.value = 900;
        this.whistleF.Q.value = 14;
        this.whistle = ctx.createGain();
        this.whistle.gain.value = 0;
        ws.connect(this.whistleF).connect(this.whistle).connect(this.out);
        src.start();
        ws.start();
        lfo.start();

        // a dying light's buzz: mains hum through a rattle
        const bz = ctx.createOscillator();
        bz.type = 'sawtooth';
        bz.frequency.value = 120;
        const bzf = ctx.createBiquadFilter();
        bzf.type = 'bandpass';
        bzf.frequency.value = 480;
        bzf.Q.value = 2;
        this.buzz = ctx.createGain();
        this.buzz.gain.value = 0;
        bz.connect(bzf).connect(this.buzz).connect(this.out);
        bz.start();

        // the crater's hum: two low tones beating, and a shimmer over them
        this.hum = ctx.createGain();
        this.hum.gain.value = 0;
        for (const [f, v] of [[55, 0.5], [55.7, 0.4], [82.6, 0.25], [110.3, 0.12]]) {
            const o = ctx.createOscillator();
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = v;
            o.connect(g).connect(this.hum);
            o.start();
        }
        const sh = ctx.createBufferSource();
        sh.buffer = a._noiseBuffer(4, false);
        sh.loop = true;
        const shf = ctx.createBiquadFilter();
        shf.type = 'bandpass';
        shf.frequency.value = 5200;
        shf.Q.value = 3;
        const shg = ctx.createGain();
        shg.gain.value = 0.15;
        sh.connect(shf).connect(shg).connect(this.hum);
        sh.start();
        this.hum.connect(this.out);

        // the corridor's hum of old machinery
        const ch = ctx.createOscillator();
        ch.type = 'triangle';
        ch.frequency.value = 49;
        const chf = ctx.createBiquadFilter();
        chf.type = 'lowpass';
        chf.frequency.value = 180;
        this.drone = ctx.createGain();
        this.drone.gain.value = 0;
        ch.connect(chf).connect(this.drone).connect(this.out);
        ch.start();
        this.built = true;
    }

    start() {
        if (!this.audio.ctx) return;
        if (!this.built) this._build();
        this.on = true;
        const t = this.audio.ctx.currentTime;
        this.out.gain.setTargetAtTime(1, t, 0.8);
        this.next = { creak: t + 3, crash: t + 20, drip: t + 1 };
    }

    stop() {
        this.on = false;
        if (!this.built) return;
        this.out.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.3);
    }

    /** indoor 0..1 (in the corridor), crater 0..1 (how near), buzz 0..1 (near a dying light), gust 0..1 */
    update(indoor, crater, buzz, gust) {
        if (!this.on || !this.audio.ctx) return;
        const ctx = this.audio.ctx, t = ctx.currentTime;
        const out = 1 - indoor;
        this.wind.gain.setTargetAtTime((0.05 + gust * 0.05) * (0.25 + out * 0.75), t, 0.8);
        this.whistle.gain.setTargetAtTime(Math.max(0, gust - 0.5) * 0.05 * out, t, 0.6);
        this.whistleF.frequency.setTargetAtTime(700 + gust * 700, t, 1.2);
        this.buzz.gain.setTargetAtTime(buzz * 0.025, t, 0.03);
        this.hum.gain.setTargetAtTime(crater * 0.11, t, 0.8);
        this.drone.gain.setTargetAtTime(indoor * 0.06, t, 0.8);
        if (this.audio.muted || this.audio.paused) return;
        if (t > this.next.creak) {
            this._groan(t + 0.05, 0.4 + Math.random() * 0.6, Math.random() * 1.6 - 0.8);
            this.next.creak = t + 5 + Math.random() * 9;
        }
        if (t > this.next.crash && indoor < 0.5) {
            this._crash(t + 0.05, 0.3 + Math.random() * 0.5);
            this.next.crash = t + 25 + Math.random() * 40;
        }
        if (t > this.next.drip) {
            if (indoor > 0.5) this._drip(t + 0.02);
            this.next.drip = t + 0.6 + Math.random() * 2.4;
        }
    }

    _panned(pan, vol) {
        const ctx = this.audio.ctx;
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        const g = ctx.createGain();
        g.gain.value = vol;
        g.connect(p).connect(this.out);
        return g;
    }

    /** Metal under strain: a slow, grinding glide and a ring. */
    _groan(t, vol, pan) {
        const ctx = this.audio.ctx;
        const out = this._panned(pan, vol);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f0 = 50 + Math.random() * 60;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.linearRampToValueAtTime(f0 * (0.6 + Math.random() * 0.3), t + 1.8);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 260 + Math.random() * 300;
        f.Q.value = 6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + 2.2);
        o.connect(f).connect(g).connect(out);
        o.start(t);
        o.stop(t + 2.3);
        if (Math.random() < 0.6) this.audio._bell(90 + Math.random() * 120, t + 1.2, 0.015, out);
    }

    /** Something heavy giving way, a long way off. */
    _crash(t, vol) {
        const a = this.audio;
        const out = this._panned(Math.random() * 1.6 - 0.8, vol);
        a._noiseBurst(t, 2.6, 160, 0.8, 0.25, 'lowpass', out);
        a._noiseBurst(t + 0.1, 1.2, 700, 1.5, 0.05, 'bandpass', out);
        for (let i = 0; i < 4; i++) a._noiseBurst(t + 0.4 + Math.random() * 1.5, 0.3, 300 + Math.random() * 400, 2, 0.04, 'bandpass', out);
    }

    _drip(t) {
        const ctx = this.audio.ctx;
        const out = this._panned(Math.random() * 1.4 - 0.7, 0.5);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(1400 + Math.random() * 800, t);
        o.frequency.exponentialRampToValueAtTime(600, t + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.15);
    }

    // ------------------------------------------------------------ the keypad and the door

    beep(k = 0) {
        const ctx = this.audio.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 1100 + k * 40;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.04, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g).connect(this.audio.sfx);
        o.start(t);
        o.stop(t + 0.1);
    }

    denied() {
        const ctx = this.audio.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        for (let i = 0; i < 2; i++) {
            const o = ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = 150;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t + i * 0.22);
            g.gain.linearRampToValueAtTime(0.06, t + i * 0.22 + 0.01);
            g.gain.setValueAtTime(0.06, t + i * 0.22 + 0.16);
            g.gain.linearRampToValueAtTime(0, t + i * 0.22 + 0.18);
            o.connect(g).connect(this.audio.sfx);
            o.start(t + i * 0.22);
            o.stop(t + i * 0.22 + 0.2);
        }
    }

    granted() {
        const ctx = this.audio.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        [880, 1175, 1568].forEach((f, i) => {
            const o = ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t + i * 0.1);
            g.gain.linearRampToValueAtTime(0.035, t + i * 0.1 + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.25);
            o.connect(g).connect(this.audio.sfx);
            o.start(t + i * 0.1);
            o.stop(t + i * 0.1 + 0.3);
        });
    }

    /** The whole opening: a klaxon, the gear's ratchet, the bolts, and the long grind of the leaves. */
    opening() {
        const a = this.audio, ctx = a.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        // klaxon, three whoops
        for (let i = 0; i < 3; i++) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            const s = t + 0.2 + i * 0.75;
            o.frequency.setValueAtTime(330, s);
            o.frequency.linearRampToValueAtTime(520, s + 0.55);
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 1800;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, s);
            g.gain.linearRampToValueAtTime(0.05, s + 0.05);
            g.gain.linearRampToValueAtTime(0, s + 0.6);
            o.connect(f).connect(g).connect(a.sfx);
            o.start(s);
            o.stop(s + 0.65);
        }
        // the gear's ratchet as it spins
        for (let i = 0; i < 26; i++) a._noiseBurst(t + 0.7 + i * 0.1 * (1 - i / 60), 0.04, 1600, 6, 0.06);
        // bolts drawing back
        for (let i = 0; i < 4; i++) a._noiseBurst(t + 2.3 + i * 0.25, 0.25, 420, 3, 0.18, 'bandpass');
        a._noiseBurst(t + 3.4, 0.5, 120, 1, 0.3, 'lowpass');
        // the leaves grinding apart
        const s = ctx.createBufferSource();
        s.buffer = a.noise;
        s.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(220, t + 4.6);
        f.frequency.linearRampToValueAtTime(380, t + 9.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + 4.6);
        g.gain.linearRampToValueAtTime(0.16, t + 5.2);
        g.gain.setValueAtTime(0.16, t + 9);
        g.gain.linearRampToValueAtTime(0, t + 9.6);
        s.connect(f).connect(g).connect(a.sfx);
        s.start(t + 4.6);
        s.stop(t + 9.8);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(38, t + 4.6);
        o.frequency.linearRampToValueAtTime(44, t + 9.5);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t + 4.6);
        og.gain.linearRampToValueAtTime(0.06, t + 5.4);
        og.gain.linearRampToValueAtTime(0, t + 9.6);
        o.connect(og).connect(a.sfx);
        o.start(t + 4.6);
        o.stop(t + 9.8);
        a._noiseBurst(t + 9.5, 1.2, 90, 1, 0.4, 'lowpass');
    }

    /** The giant, touched: a deep, slow groan of iron. */
    robot() {
        const a = this.audio, ctx = a.ctx;
        if (!ctx) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(42, t);
        o.frequency.linearRampToValueAtTime(30, t + 3);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.linearRampToValueAtTime(140, t + 3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.6);
        g.gain.linearRampToValueAtTime(0, t + 3.2);
        o.connect(f).connect(g).connect(a.sfx);
        o.start(t);
        o.stop(t + 3.3);
        for (let i = 0; i < 3; i++) this._groan(t + 0.3 + i * 0.8, 0.8, Math.random() - 0.5);
    }
}
