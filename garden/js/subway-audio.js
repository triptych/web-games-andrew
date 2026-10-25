// Sound for the underground: the rumble, roar and motor whine of the train, the
// clack of rail joints, station hum and fluorescent buzz, a busker's violin,
// pneumatic doors and chimes, express trains rushing past, and in the round room
// a slow choir of glass and the sound of water. All synthesised on the garden's
// own audio graph, so mute, volume and tab-pause already apply.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class SubwayAudio {
    constructor(engine) {
        this.e = engine;
        this.ctx = engine.ctx;
        this.on = false;
        this.nextNote = 0;
        this.nextBell = 0;
        this.nextDrip = 0;
        this.clackAcc = 0;
        this.busker = { gain: 0, pan: 0 };
        if (!this.ctx) return;
        const ctx = this.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(engine.master);
        const send = ctx.createGain();
        send.gain.value = 0.35;
        this.out.connect(send).connect(engine.reverb);
        const loop = (buf, filterType, freq, q = 0.7) => {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = filterType;
            f.frequency.value = freq;
            f.Q.value = q;
            const g = ctx.createGain();
            g.gain.value = 0;
            src.connect(f).connect(g).connect(this.out);
            src.start();
            return { src, f, g };
        };
        const white = engine._noiseBuffer(4);
        const brown = engine._noiseBuffer(6, true);
        this.noise = white;
        this.rumble = loop(brown, 'lowpass', 160);        // the deep roll of the carriage
        this.roar = loop(white, 'bandpass', 520, 0.5);    // air and steel
        this.hiss = loop(white, 'highpass', 3500);        // tunnel air at speed
        this.hvac = loop(brown, 'lowpass', 420);          // hall ventilation
        this.water = loop(white, 'bandpass', 1500, 0.9);  // the pool
        // motor whine: two detuned saws through a lowpass, pitch follows speed
        this.whine = ctx.createGain();
        this.whine.gain.value = 0;
        const wf = ctx.createBiquadFilter();
        wf.type = 'lowpass';
        wf.frequency.value = 1400;
        wf.Q.value = 2;
        this.whineOsc = [0, 1, 2].map((i) => {
            const o = ctx.createOscillator();
            o.type = i === 2 ? 'square' : 'sawtooth';
            o.frequency.value = 120;
            o.detune.value = (i - 1) * 9;
            const g = ctx.createGain();
            g.gain.value = i === 2 ? 0.12 : 0.3;
            o.connect(g).connect(wf);
            o.start();
            return o;
        });
        wf.connect(this.whine).connect(this.out);
        // fluorescent buzz and a mains hum
        this.buzz = ctx.createGain();
        this.buzz.gain.value = 0;
        const bf = ctx.createBiquadFilter();
        bf.type = 'bandpass';
        bf.frequency.value = 1900;
        bf.Q.value = 3;
        for (const f of [100, 200, 300]) {
            const o = ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = 0.05 / (f / 100);
            o.connect(g).connect(bf);
            o.start();
        }
        bf.connect(this.buzz).connect(this.out);
        // the choir: a cluster of detuned sines that swells near the pool
        this.choir = ctx.createGain();
        this.choir.gain.value = 0;
        const cf = ctx.createBiquadFilter();
        cf.type = 'lowpass';
        cf.frequency.value = 2400;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.11;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 0.08;
        lfo.connect(lfoAmt).connect(this.choir.gain);
        lfo.start();
        [45, 52, 57, 59, 64, 69, 71, 76].forEach((n, i) => {
            for (const d of [-7, 5]) {
                const o = ctx.createOscillator();
                o.type = i % 3 === 0 ? 'triangle' : 'sine';
                o.frequency.value = midi(n);
                o.detune.value = d;
                const g = ctx.createGain();
                g.gain.value = 0.05 / (1 + i * 0.25);
                const vib = ctx.createOscillator();
                vib.frequency.value = 0.15 + i * 0.04;
                const va = ctx.createGain();
                va.gain.value = 5;
                vib.connect(va).connect(o.detune);
                vib.start();
                o.connect(g).connect(cf);
                o.start();
            }
        });
        cf.connect(this.choir).connect(this.out);
        // the busker's lines go through their own pan and gain
        this.buskerPan = ctx.createStereoPanner();
        this.buskerGain = ctx.createGain();
        this.buskerGain.gain.value = 0;
        this.buskerPan.connect(this.buskerGain).connect(this.out);
        // a pan/gain pair for the express trains
        this.passPan = ctx.createStereoPanner();
        this.passGain = ctx.createGain();
        this.passGain.gain.value = 0;
        this.passFilter = ctx.createBiquadFilter();
        this.passFilter.type = 'bandpass';
        this.passFilter.frequency.value = 400;
        this.passFilter.Q.value = 0.8;
        const ps = ctx.createBufferSource();
        ps.buffer = brown;
        ps.loop = true;
        ps.connect(this.passFilter).connect(this.passGain).connect(this.passPan).connect(this.out);
        ps.start();
        this.passTone = ctx.createOscillator();
        this.passTone.type = 'sawtooth';
        this.passTone.frequency.value = 110;
        const ptg = ctx.createGain();
        ptg.gain.value = 0.06;
        this.passTone.connect(ptg).connect(this.passFilter);
        this.passTone.start();
    }

    start() {
        if (!this.ctx) return;
        this.on = true;
        this.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
        this.nextNote = this.ctx.currentTime + 2;
        this.nextBell = this.ctx.currentTime + 3;
    }

    stop() {
        if (!this.ctx) return;
        this.on = false;
        this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    }

    /**
     * s: speed (0..1 of cruise), v (m/s), inTrain, hall (0..1), rot (0..1 near the pool), deep (0..1 how
     * far along the line, for the roar's colour), buskerGain/Pan, pass (0..1) / passPan / passDist
     */
    update(dt, s) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime, k = 0.18;
        const moving = s.speed;
        const hear = s.inTrain ? 1 : 0.55;
        this.rumble.g.gain.setTargetAtTime(moving * 1.35 * hear + 0.06 * (s.inTrain ? 1 : 0), t, k);
        this.rumble.f.frequency.setTargetAtTime(110 + moving * 150, t, k);
        this.roar.g.gain.setTargetAtTime(moving * moving * 0.5 * hear, t, k);
        this.roar.f.frequency.setTargetAtTime(380 + moving * 700 + (s.deep || 0) * 200, t, k);
        this.hiss.g.gain.setTargetAtTime(moving * 0.07 * hear, t, k);
        this.whine.gain.setTargetAtTime(s.inTrain ? (0.02 + moving * 0.09) : 0.0, t, k);
        const base = 70 + moving * 260;
        this.whineOsc.forEach((o, i) => o.frequency.setTargetAtTime(base * (i === 2 ? 0.5 : 1), t, 0.3));
        this.hvac.g.gain.setTargetAtTime(s.hall * 0.5, t, 0.5);
        this.buzz.gain.setTargetAtTime(s.hall * 0.5, t, 0.5);
        this.choir.gain.setTargetAtTime(0.09 + s.rot * 0.55 + (s.finale || 0) * 0.35, t, 1.2);
        this.water.g.gain.setTargetAtTime(s.rot * 0.1, t, 0.5);
        this.buskerGain.gain.setTargetAtTime(s.buskerGain || 0, t, 0.3);
        this.buskerPan.pan.setTargetAtTime(s.buskerPan || 0, t, 0.3);
        this.passGain.gain.setTargetAtTime(s.pass || 0, t, 0.08);
        this.passPan.pan.setTargetAtTime(s.passPan || 0, t, 0.08);
        this.passFilter.frequency.setTargetAtTime(240 + (s.pass || 0) * 700, t, 0.1);
        this.passTone.frequency.setTargetAtTime(90 + (s.pass || 0) * 70, t, 0.1);
        // rail clacks: every twelve metres of track, a double knock from the bogies
        this.clackAcc += s.v * dt;
        while (this.clackAcc > 12) {
            this.clackAcc -= 12;
            if (s.v > 2 && s.inTrain) this.clack(Math.min(1, s.v / 22));
        }
        // the busker plays a slow line while you are on the platform at Hearthside
        if (s.buskerGain > 0.01 && t > this.nextNote) this.violin(t);
        // glass bells and the odd drip
        if (t > this.nextBell && s.rot > 0.05) {
            const pent = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
            this.bell(midi(pent[Math.floor(Math.random() * pent.length)]), t, 0.1 + s.rot * 0.2);
            this.nextBell = t + 1.2 + Math.random() * 3.2;
        }
        if (t > this.nextDrip && s.hall > 0.3) {
            this.drip(t, 0.05 * s.hall);
            this.nextDrip = t + 2 + Math.random() * 6;
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

    clack(vol) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime;
        this.burst(t, 0.09, 900, 2.5, 0.28 * vol);
        this.burst(t + 0.065, 0.1, 700, 2.2, 0.22 * vol);
        this.burst(t + 0.62, 0.1, 880, 2.5, 0.2 * vol);
        this.burst(t + 0.69, 0.1, 680, 2.2, 0.16 * vol);
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

    bell(f, t, vol) {
        const ctx = this.ctx;
        for (const [m, v, d] of [[1, 1, 3.6], [2.76, 0.4, 2.2], [5.4, 0.18, 1.2]]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = f * m;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vol * v, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0005, t + d);
            o.connect(g).connect(this.out);
            o.start(t);
            o.stop(t + d + 0.1);
        }
    }

    drip(t, vol) {
        this.tone(1400 + Math.random() * 900, t, 0.12, vol);
        this.tone(900, t + 0.15, 0.2, vol * 0.4);
    }

    /** A wooden-bodied violin line: saw through a lowpass with vibrato, a few phrases then a rest. */
    violin(t) {
        const ctx = this.ctx;
        const scale = [57, 60, 62, 64, 67, 69, 72];
        this.phrase = (this.phrase || 0) + 1;
        const len = 3 + Math.floor(Math.random() * 3);
        let at = t + 0.1;
        let deg = Math.floor(Math.random() * scale.length);
        for (let i = 0; i < len; i++) {
            deg = Math.max(0, Math.min(scale.length - 1, deg + Math.floor(Math.random() * 5) - 2));
            const dur = 0.7 + Math.random() * 1.3;
            const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
            o.type = o2.type = 'sawtooth';
            o.frequency.value = midi(scale[deg]);
            o2.frequency.value = midi(scale[deg]);
            o2.detune.value = 8;
            f.type = 'lowpass';
            f.frequency.value = 1900;
            f.Q.value = 1.4;
            const vib = ctx.createOscillator(), va = ctx.createGain();
            vib.frequency.value = 5.2;
            va.gain.setValueAtTime(0, at);
            va.gain.linearRampToValueAtTime(14, at + dur * 0.6);
            vib.connect(va).connect(o.detune);
            vib.connect(va).connect(o2.detune);
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(0.1, at + 0.12);
            g.gain.setValueAtTime(0.1, at + dur - 0.2);
            g.gain.linearRampToValueAtTime(0, at + dur);
            o.connect(f);
            o2.connect(f);
            f.connect(g).connect(this.buskerPan);
            for (const x of [o, o2, vib]) {
                x.start(at);
                x.stop(at + dur + 0.1);
            }
            at += dur;
        }
        this.nextNote = at + 3 + Math.random() * 6;
    }

    /** The three-note station chime, with a small announcement-style tail. */
    chime(down = false) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime + 0.05;
        const notes = down ? [79, 76, 72] : [72, 76, 79];
        notes.forEach((n, i) => this.bell(midi(n), t + i * 0.45, 0.22));
    }

    beeps(n = 5) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime + 0.05;
        for (let i = 0; i < n; i++) this.tone(1480, t + i * 0.5, 0.22, 0.16, 'square');
    }

    doors(open) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime + 0.02;
        this.burst(t, 0.9, 5200, 0.6, 0.22, 'highpass', 0.01);
        this.burst(t + 0.25, 0.6, 600, 1, 0.2, 'bandpass', 0.05);
        if (open) {
            this.tone(880, t + 0.05, 0.3, 0.12);
            this.tone(660, t + 0.35, 0.4, 0.12);
        } else {
            this.burst(t + 1.1, 0.14, 300, 1.2, 0.35);
        }
    }

    brake(vol = 1) {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime;
        this.burst(t, 3.5, 4200, 3, 0.1 * vol, 'bandpass', 1.2);
        this.burst(t + 3.6, 1.6, 6000, 0.5, 0.2 * vol, 'highpass', 0.05);
    }

    /** A soft "dong" for the ticket in the hut and for stepping through into the underground. */
    arrive() {
        if (!this.ctx || !this.on) return;
        const t = this.ctx.currentTime + 0.1;
        this.bell(midi(60), t, 0.3);
        this.bell(midi(67), t + 0.25, 0.25);
    }

    /** The pool answers a touch: a chord whose root depends on where you touched. */
    poolTone(frac) {
        if (!this.ctx || !this.on) return;
        const pent = [57, 59, 62, 64, 66, 69, 71, 74, 76, 78];
        const i = Math.floor(frac * pent.length) % pent.length;
        const t = this.ctx.currentTime + 0.02;
        this.bell(midi(pent[i]), t, 0.3);
        this.bell(midi(pent[(i + 2) % pent.length] + 12), t + 0.12, 0.2);
        this.bell(midi(pent[(i + 4) % pent.length]), t + 0.26, 0.16);
        this.burst(t, 1.4, 2200, 1.4, 0.06, 'bandpass', 0.05);
    }
}
