// Sound for the mine: iron wheels on rail, the clack of joints, timber creaking
// on the trestle, the squeal of the curves, the roar of lava (a low bed with
// crackling pops and steam), glass chimes in the gem halls, a slow choir where
// the walls glitter, the fountain at the Heartfire and the boom that rolls up
// out of it now and then. All synthesised on the garden's own audio graph, so
// mute, volume and tab-pause already apply.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class MineAudio {
    constructor(engine) {
        this.e = engine;
        this.ctx = engine.ctx;
        this.on = false;
        this.clackAcc = 0;
        this.nextChime = 0;
        this.nextPop = 0;
        this.nextBoom = 0;
        this.nextDrip = 0;
        this.nextCreak = 0;
        if (!this.ctx) return;
        const ctx = this.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(engine.master);
        const send = ctx.createGain();
        send.gain.value = 0.42;
        this.out.connect(send).connect(engine.reverb);
        const loop = (buf, type, freq, q = 0.7) => {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = type;
            f.frequency.value = freq;
            f.Q.value = q;
            const g = ctx.createGain();
            g.gain.value = 0;
            src.connect(f).connect(g).connect(this.out);
            src.start(0, Math.random() * 3);
            return { src, f, g };
        };
        const white = engine._noiseBuffer(4);
        const brown = engine._noiseBuffer(6, true);
        this.noise = white;
        this.rumble = loop(brown, 'lowpass', 150);        // wheels on rock
        this.rattle = loop(white, 'bandpass', 900, 0.6);   // iron on iron
        this.air = loop(white, 'bandpass', 380, 0.4);      // air through the tunnel
        this.squeal = loop(white, 'bandpass', 2900, 7);    // flanges in a curve
        this.lava = loop(brown, 'lowpass', 90);            // the deep bed under everything hot
        this.roar = loop(white, 'bandpass', 280, 0.5);     // lava falls, the fountain
        this.hiss = loop(white, 'highpass', 4200);         // steam
        // the choir: detuned sines on a minor-ninth cluster, swelling where the walls glitter and at the end
        this.choir = ctx.createGain();
        this.choir.gain.value = 0;
        const cf = ctx.createBiquadFilter();
        cf.type = 'lowpass';
        cf.frequency.value = 2200;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.09;
        const la = ctx.createGain();
        la.gain.value = 0.06;
        lfo.connect(la).connect(this.choir.gain);
        lfo.start();
        [38, 45, 50, 53, 57, 62, 65, 69, 74].forEach((n, i) => {
            for (const d of [-8, 6]) {
                const o = ctx.createOscillator();
                o.type = i % 3 === 0 ? 'triangle' : 'sine';
                o.frequency.value = midi(n);
                o.detune.value = d;
                const g = ctx.createGain();
                g.gain.value = 0.05 / (1 + i * 0.22);
                const vib = ctx.createOscillator();
                vib.frequency.value = 0.12 + i * 0.03;
                const va = ctx.createGain();
                va.gain.value = 6;
                vib.connect(va).connect(o.detune);
                vib.start();
                o.connect(g).connect(cf);
                o.start();
            }
        });
        cf.connect(this.choir).connect(this.out);
    }

    start() {
        if (!this.ctx) return;
        this.on = true;
        const t = this.ctx.currentTime;
        this.out.gain.setTargetAtTime(1, t, 0.4);
        this.nextChime = t + 2;
        this.nextPop = t + 1;
        this.nextBoom = t + 6;
        this.nextDrip = t + 3;
        this.nextCreak = t + 5;
    }

    stop() {
        if (!this.ctx) return;
        this.on = false;
        this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }

    /**
     * @param {object} s { v (m/s), speed (0..1), curve (0..1), lava (0..1), gems (0..1), heart (0..1: in the chamber),
     *                     fountain (0..1: how near the fountain), trestle (0..1), open (0..1: a big space), cart (bool) }
     */
    update(dt, s) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime, k = 0.2;
        const sp = s.speed;
        const cart = s.cart ? 1 : 0.4;
        this.rumble.g.gain.setTargetAtTime(sp * 1.5 * cart * (1 - s.trestle * 0.5) + 0.03, t, k);
        this.rumble.f.frequency.setTargetAtTime(100 + sp * 220, t, k);
        this.rattle.g.gain.setTargetAtTime(sp * sp * 0.34 * cart, t, k);
        this.rattle.f.frequency.setTargetAtTime(700 + sp * 900, t, k);
        this.air.g.gain.setTargetAtTime((0.04 + sp * 0.28) * (1 - s.open * 0.4), t, k);
        this.air.f.frequency.setTargetAtTime(260 + sp * 420, t, k);
        this.squeal.g.gain.setTargetAtTime(s.curve * sp * sp * 0.2 * cart, t, 0.1);
        this.squeal.f.frequency.setTargetAtTime(2400 + sp * 1200, t, 0.15);
        this.lava.g.gain.setTargetAtTime(s.lava * 1.1 + s.heart * 0.9, t, 0.6);
        this.roar.g.gain.setTargetAtTime(s.lava * 0.05 + s.fountain * 0.35, t, 0.4);
        this.roar.f.frequency.setTargetAtTime(220 + s.fountain * 260, t, 0.6);
        this.hiss.g.gain.setTargetAtTime(s.lava * 0.018 + s.fountain * 0.03, t, 0.5);
        this.choir.gain.setTargetAtTime(0.02 + s.gems * 0.5 + s.heart * 0.4, t, 1.4);
        // joints in the rail: a double knock every few metres
        this.clackAcc += s.v * dt;
        while (this.clackAcc > 3.6) {
            this.clackAcc -= 3.6;
            if (s.v > 1.5 && s.cart && s.trestle < 0.5) this.clack(Math.min(1, s.v / 15));
        }
        // glassy chimes among the gems
        if (s.gems > 0.05 && t > this.nextChime) {
            const pent = [62, 64, 67, 69, 71, 74, 76, 79, 81, 83];
            const n = pent[Math.floor(Math.random() * pent.length)];
            this.bell(midi(n), t, 0.06 + s.gems * 0.14);
            if (Math.random() < 0.4) this.bell(midi(n + 7), t + 0.18, 0.05 + s.gems * 0.08);
            this.nextChime = t + 0.35 + Math.random() * 1.6;
        }
        // lava popping and spitting
        if (s.lava + s.heart > 0.1 && t > this.nextPop) {
            const f = 180 + Math.random() * 500;
            this.burst(t, 0.12 + Math.random() * 0.2, f, 1.4, (0.05 + Math.random() * 0.12) * (s.lava + s.heart), 'bandpass', 0.003);
            if (Math.random() < 0.3) this.burst(t + 0.05, 0.4, 3000, 0.6, 0.04 * (s.lava + s.heart), 'highpass', 0.01);
            this.nextPop = t + 0.1 + Math.random() * 0.7 / (0.3 + s.lava + s.heart);
        }
        // timber complaining under the cart on the bridges
        if (s.trestle > 0.3 && t > this.nextCreak) {
            this.creak(t, 0.05 + s.trestle * 0.1);
            this.nextCreak = t + 0.6 + Math.random() * 1.8;
        }
        // the Heartfire's slow boom
        if (s.heart > 0.5 && t > this.nextBoom) {
            this.boom(0.6 + Math.random() * 0.4);
            this.nextBoom = t + 7 + Math.random() * 10;
        }
        if (s.gems < 0.2 && s.lava < 0.2 && s.heart < 0.2 && t > this.nextDrip) {
            this.drip(t, 0.05);
            this.nextDrip = t + 1.5 + Math.random() * 4;
        }
    }

    // ---- one-shots

    burst(t, dur, freq, q, vol, type = 'bandpass', attack = 0.004) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        src.connect(f).connect(g).connect(this.out);
        src.start(t, Math.random() * 2);
        src.stop(t + dur + 0.05);
    }

    tone(f, t, dur, vol, type = 'sine') {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    clack(vol) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime;
        this.burst(t, 0.07, 1100, 2.4, 0.2 * vol);
        this.burst(t + 0.055, 0.08, 800, 2.2, 0.16 * vol);
    }

    bell(f, t, vol) {
        const ctx = this.ctx;
        for (const [m, v, d] of [[1, 1, 3.2], [2.76, 0.35, 1.9], [5.4, 0.15, 1.1], [8.9, 0.06, 0.6]]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = f * m;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vol * v, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0005, t + d);
            o.connect(g).connect(this.out);
            o.start(t);
            o.stop(t + d + 0.1);
        }
    }

    drip(t, vol) {
        this.tone(1300 + Math.random() * 1000, t, 0.1, vol);
        this.tone(820, t + 0.14, 0.2, vol * 0.4);
    }

    creak(t, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f0 = 90 + Math.random() * 80;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.8), t + 0.5);
        const lp = ctx.createBiquadFilter();
        lp.type = 'bandpass';
        lp.frequency.value = 500 + Math.random() * 500;
        lp.Q.value = 5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 0.55);
        o.connect(lp).connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.6);
    }

    /** A bell struck on the cart as it sets off, and once more at the stop. */
    clang(n = 2) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + 0.05;
        for (let i = 0; i < n; i++) this.bell(midi(70), t + i * 0.32, 0.22);
    }

    /** A low boom from the lake, felt more than heard. */
    boom(v = 1) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(64, t);
        o.frequency.exponentialRampToValueAtTime(24, t + 2.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5 * v, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 2.9);
        this.burst(t, 2.4, 260, 0.6, 0.35 * v, 'lowpass', 0.05);
    }

    /** The brakes biting as the cart comes to its stop. */
    brake(vol = 1) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime;
        this.burst(t, 2.6, 3800, 3, 0.1 * vol, 'bandpass', 0.6);
        this.burst(t + 2.2, 1.2, 600, 0.8, 0.12 * vol, 'lowpass', 0.05);
    }
}
