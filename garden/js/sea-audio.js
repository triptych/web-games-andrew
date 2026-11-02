// Sounds inside the little submarine, on the garden's own audio graph: the
// deep hush of the sea against the hull, the engine's purr rising with the
// telegraph, bubbles, a soft sonar ping now and then, and whale song.

export class SeaAudio {
    /** @param {import('./music.js').AudioEngine} audio */
    constructor(audio) {
        this.audio = audio;
        this.on = false;
        this.built = false;
        this.nextBloop = 0;
        this.nextPing = 0;
    }

    _build() {
        const a = this.audio, ctx = a.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(a.master);
        this.wet = ctx.createGain();
        this.wet.gain.value = 0.6;
        this.out.connect(this.wet).connect(a.reverb);

        // the sea against the hull: brown noise through a low filter, slowly breathing
        const src = ctx.createBufferSource();
        src.buffer = a._noiseBuffer(6, true);
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        const g = ctx.createGain();
        g.gain.value = 0.55;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 0.18;
        lfo.connect(lfoAmt).connect(g.gain);
        src.connect(lp).connect(g).connect(this.out);
        src.start();
        lfo.start();

        // the engine: two detuned saws, filtered right down to a purr
        this.engine = ctx.createGain();
        this.engine.gain.value = 0;
        this.engineLp = ctx.createBiquadFilter();
        this.engineLp.type = 'lowpass';
        this.engineLp.frequency.value = 160;
        this.oscs = [44, 44.7].map((f) => {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            o.connect(this.engineLp);
            o.start();
            return o;
        });
        this.engineLp.connect(this.engine).connect(this.out);
        this.built = true;
    }

    start() {
        if (!this.audio.ctx) return;
        if (!this.built) this._build();
        this.on = true;
        const t = this.audio.ctx.currentTime;
        this.out.gain.setTargetAtTime(1, t, 0.6);
        this.nextBloop = t + 0.5;
        this.nextPing = t + 6 + Math.random() * 6;
        // the hatch closing and the tanks flooding
        this.audio._noiseBurst(t, 0.25, 900, 6, 0.12);
        for (let i = 0; i < 9; i++) this.bloop(t + 0.3 + i * 0.09 + Math.random() * 0.05, 0.8);
    }

    stop() {
        this.on = false;
        if (!this.built) return;
        const t = this.audio.ctx.currentTime;
        this.out.gain.setTargetAtTime(0, t, 0.3);
        this.engine.gain.setTargetAtTime(0, t, 0.3);
    }

    /** speed 0..1, climb -1..1, depth in metres. */
    update(speed, climb, depth) {
        if (!this.on || !this.built) return;
        const ctx = this.audio.ctx, t = ctx.currentTime;
        this.engine.gain.setTargetAtTime(0.025 + speed * 0.07, t, 0.4);
        for (const [i, o] of this.oscs.entries()) o.frequency.setTargetAtTime((38 + speed * 22) * (1 + i * 0.016), t, 0.6);
        this.engineLp.frequency.setTargetAtTime(120 + speed * 160, t, 0.5);
        if (t > this.nextBloop) {
            this.bloop(t, 0.5 + Math.abs(climb) * 0.5);
            this.nextBloop = t + (Math.abs(climb) > 0.2 ? 0.08 + Math.random() * 0.15 : 0.6 + Math.random() * 2.4);
        }
        if (t > this.nextPing) {
            this.ping(t, depth);
            this.nextPing = t + 16 + Math.random() * 18;
        }
    }

    /** One bubble: a quick rising blip. */
    bloop(t, vol = 0.6) {
        if (!this.built) return;
        const ctx = this.audio.ctx;
        const o = ctx.createOscillator();
        const f = 260 + Math.random() * 500;
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.07);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03 * vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.12);
    }

    /** The sonar: a soft ping, and its echo off the floor. */
    ping(t, depth = 10) {
        if (!this.built) return;
        const ctx = this.audio.ctx;
        for (const [dt, v] of [[0, 1], [0.25 + depth * 0.01, 0.35]]) {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = 1240;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t + dt);
            g.gain.linearRampToValueAtTime(0.03 * v, t + dt + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.2);
            o.connect(g).connect(this.out);
            o.start(t + dt);
            o.stop(t + dt + 1.3);
        }
    }

    /** A humpback singing somewhere out in the blue: a few long, sliding moans. */
    whale(near = 0.6) {
        if (!this.on || !this.built) return;
        const ctx = this.audio.ctx;
        let t = ctx.currentTime + 0.5;
        const phrases = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < phrases; i++) {
            const dur = 1.6 + Math.random() * 2.2;
            const f0 = 140 + Math.random() * 160, f1 = f0 * (1.4 + Math.random() * 1.2), f2 = f0 * (0.7 + Math.random() * 0.5);
            const o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(f0, t);
            o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
            o.frequency.exponentialRampToValueAtTime(f2, t + dur);
            const vib = ctx.createOscillator();
            vib.frequency.value = 5 + Math.random() * 2;
            const vibAmt = ctx.createGain();
            vibAmt.gain.value = 6;
            vib.connect(vibAmt).connect(o.frequency);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 700;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.05 * near, t + dur * 0.3);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            o.connect(lp).connect(g).connect(this.out);
            g.connect(this.audio.reverb);
            o.start(t);
            vib.start(t);
            o.stop(t + dur + 0.1);
            vib.stop(t + dur + 0.1);
            t += dur + 0.4 + Math.random() * 1.2;
        }
    }
}
