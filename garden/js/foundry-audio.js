// Sounds of the Foundry, on the garden's own audio graph: a huge low drone of
// machinery with a reverb tail as long as the hall, the lines clanking forward
// and stopping all together, arms whirring, welders crackling, the test rig's
// zaps, steam hissing as a unit is let go, robots' heavy feet on the deck, the
// rumble of the lava pit and the roar when something falls in, the press,
// and the lift's motor, gate and bell.

export class FoundryAudio {
    /** @param {import('./music.js').AudioEngine} audio */
    constructor(audio) {
        this.audio = audio;
        this.on = false;
        this.built = false;
        this.nextCrackle = 0;
    }

    get ctx() {
        return this.audio?.ctx;
    }

    get live() {
        return this.on && this.built && !this.audio.muted;
    }

    _build() {
        const a = this.audio, ctx = a.ctx;
        this.noise = a._noiseBuffer(3, false);
        this.brown = a._noiseBuffer(6, true);
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(a.master);
        const wet = ctx.createGain();
        wet.gain.value = 0.6;
        this.out.connect(wet).connect(a.reverb);

        // the drone: detuned saws through a low-pass, throbbing slowly
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 170;
        const throb = ctx.createGain();
        throb.gain.value = 0.8;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.31;
        const depth = ctx.createGain();
        depth.gain.value = 0.25;
        lfo.connect(depth).connect(throb.gain);
        lfo.start();
        for (const [f, v] of [[36.7, 0.07], [37.2, 0.06], [55.1, 0.035], [73.6, 0.02]]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = v;
            o.connect(g).connect(lp);
            o.start();
        }
        lp.connect(throb).connect(this.out);
        // the hall's roar: brown noise, band-passed
        const roar = ctx.createBufferSource();
        roar.buffer = this.brown;
        roar.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 320;
        bp.Q.value = 0.6;
        const rg = ctx.createGain();
        rg.gain.value = 0.05;
        roar.connect(bp).connect(rg).connect(this.out);
        roar.start();
        // the lava: a deep rumble, louder near the pit
        const lava = ctx.createBufferSource();
        lava.buffer = this.brown;
        lava.loop = true;
        const llp = ctx.createBiquadFilter();
        llp.type = 'lowpass';
        llp.frequency.value = 110;
        this.lava = ctx.createGain();
        this.lava.gain.value = 0;
        lava.connect(llp).connect(this.lava).connect(this.out);
        lava.start(0, 1.3);
        // the lift's motor
        const mo = ctx.createOscillator();
        mo.type = 'sawtooth';
        mo.frequency.value = 92;
        const mf = ctx.createBiquadFilter();
        mf.type = 'bandpass';
        mf.frequency.value = 400;
        mf.Q.value = 2;
        this.motor = ctx.createGain();
        this.motor.gain.value = 0;
        this.motorOsc = mo;
        mo.connect(mf).connect(this.motor).connect(this.out);
        mo.start();
        this.built = true;
    }

    start() {
        if (!this.ctx) return;
        if (!this.built) this._build();
        this.on = true;
        this.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.6);
    }

    stop() {
        if (!this.built) return;
        this.on = false;
        this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        this.motor.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }

    _burst(t, dur, freq, q, vol, type = 'bandpass') {
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
        s.connect(f).connect(g).connect(this.out);
        s.start(t, Math.random() * 2);
        s.stop(t + dur + 0.05);
    }

    _tone(t, f0, f1, dur, vol, type = 'sine', filter = 0) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + Math.min(0.04, dur * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (filter) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = filter;
            o.connect(f);
            node = f;
        }
        node.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    /** The whole line lurching forward one station. */
    index(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.25, 160, 1.5, 0.22 * near, 'lowpass');
        this._tone(t, 120, 70, 1.4, 0.04 * near, 'sawtooth', 500);
        this.audio._bell(55, t + 0.02, 0.03 * near);
    }

    /** ...and stopping. */
    stop1(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.18, 220, 2, 0.18 * near, 'lowpass');
        this._burst(t + 0.05, 0.08, 1800, 6, 0.05 * near);
        this.audio._bell(73.4, t, 0.025 * near);
    }

    /** An arm swinging round. */
    servo(near, big = false) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        const f = big ? 140 : 300 + Math.random() * 120;
        this._tone(t, f, f * 1.8, big ? 1.2 : 0.45, 0.035 * near, 'sawtooth', 1400);
        this._tone(t + 0.4, f * 1.8, f, big ? 1.0 : 0.35, 0.025 * near, 'sawtooth', 1400);
    }

    /** Welding: crackle, called every frame with how near the nearest torch is. */
    weld(near, dt) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        if (t < this.nextCrackle) return;
        this.nextCrackle = t + 0.025 + Math.random() * 0.05;
        this._burst(t, 0.02 + Math.random() * 0.05, 3000 + Math.random() * 5000, 1.2, 0.07 * near, 'highpass');
        if (Math.random() < 0.15) this._burst(t, 0.1, 900, 2, 0.04 * near);
    }

    zap(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 4; i++) this._burst(t + i * 0.03, 0.05, 2400 + Math.random() * 3000, 2, 0.1 * near, 'highpass');
        this._tone(t, 180, 60, 0.3, 0.06 * near, 'square', 900);
    }

    hiss(near) {
        if (!this.live || near <= 0.02) return;
        this._burst(this.ctx.currentTime, 1.4, 4200, 0.6, 0.1 * near, 'highpass');
    }

    /** A unit's eyes coming on: a rising two-note chirp. */
    boot(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._tone(t, 440, 880, 0.25, 0.05 * near, 'square', 2500);
        this._tone(t + 0.28, 660, 1320, 0.3, 0.05 * near, 'square', 2500);
    }

    step(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.12, 180 + Math.random() * 40, 2, 0.2 * near, 'lowpass');
        this._burst(t, 0.05, 1600, 8, 0.05 * near);
        this.audio._bell(98 + Math.random() * 10, t, 0.012 * near);
    }

    /** Into the lava: a whoomph, a roar and a long sizzle. */
    splash(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.6, 90, 1, 0.4 * near, 'lowpass');
        this._burst(t + 0.05, 2.6, 2500, 0.5, 0.06 * near, 'highpass');
        this._tone(t, 70, 35, 1.2, 0.08 * near, 'sine');
    }

    /** A unit going over the edge: a scrape and a falling whine. */
    fall(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.3, 700, 3, 0.08 * near);
        this._tone(t + 0.1, 900, 240, 1.8, 0.02 * near, 'sawtooth', 2000);
    }

    press(near) {
        if (!this.live || near <= 0.02) return;
        const t = this.ctx.currentTime;
        this._burst(t, 0.5, 120, 1, 0.4 * near, 'lowpass');
        this._burst(t, 0.12, 2400, 3, 0.08 * near);
        this.audio._bell(61.7, t, 0.04 * near);
        this._burst(t + 0.25, 0.8, 4000, 0.6, 0.03 * near, 'highpass');
    }

    /** The lift: 0 quiet, 1 running; `pitch` rises with speed. */
    liftMotor(run) {
        if (!this.built) return;
        const t = this.ctx.currentTime;
        this.motor.gain.setTargetAtTime(this.audio.muted ? 0 : run * 0.05, t, 0.2);
        this.motorOsc.frequency.setTargetAtTime(70 + run * 50, t, 0.3);
    }

    gate() {
        if (!this.live) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 7; i++) this._burst(t + i * 0.06, 0.05, 2200 + Math.random() * 900, 6, 0.06);
        this._burst(t + 0.45, 0.2, 300, 2, 0.12, 'lowpass');
    }

    ding() {
        if (!this.live) return;
        const t = this.ctx.currentTime;
        this.audio._bell(1046.5, t, 0.08);
        this.audio._bell(1318.5, t + 0.35, 0.07);
    }

    update(pitNear) {
        if (!this.built) return;
        this.lava.gain.setTargetAtTime(this.on && !this.audio.muted ? 0.05 + pitNear * 0.35 : 0, this.ctx.currentTime, 0.4);
    }
}
