// Procedural audio. A slow generative score (warm detuned pads, a plucked
// pentatonic melody through delay and reverb, FM bells and a soft bass) that
// moves to a darker progression at night, plus the island itself: surf that
// swells nearer the shore, wind, birds by day, crickets and owls by night,
// footsteps that know stone from grass, and chimes for the interface.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// D major / B minor. Each chord: bass root + voicing.
const DAY = [
    { root: 38, notes: [50, 57, 61, 64, 66] },     // Dmaj9
    { root: 43, notes: [55, 59, 62, 66, 69] },     // Gmaj7 (add 9 on top)
    { root: 47, notes: [50, 54, 57, 59, 61] },     // Bm9
    { root: 45, notes: [52, 57, 59, 61, 64] },     // Asus2/add
];
const NIGHT = [
    { root: 35, notes: [50, 54, 57, 61, 62] },     // Bm(add9)
    { root: 43, notes: [50, 55, 59, 62, 66] },     // Gmaj7
    { root: 40, notes: [52, 55, 59, 62, 66] },     // Em9
    { root: 42, notes: [49, 54, 57, 61, 64] },     // F#m7
];
const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]; // D major pentatonic

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.paused = false;
        this.musicVol = 0.55;
        this.sfxVol = 0.7;
        this.night = 0;
        this.shore = 50;
        this.chordIndex = 0;
        this.melodyDeg = 4;
        this.nextChordAt = 0;
        this.nextBeatAt = 0;
        this.nextAmbientAt = 0;
        this.beat = 60 / 68;
    }

    start() {
        if (this.ctx) {
            if (!this.paused) this.ctx.resume?.();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = (this.ctx = new AC());
        this.master = ctx.createGain();
        this.master.gain.value = this.muted || this.paused ? 0 : 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 3;
        this.master.connect(comp).connect(ctx.destination);

        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulse(4.5, 2.6);
        const revOut = ctx.createGain();
        revOut.gain.value = 0.55;
        this.reverb.connect(revOut).connect(this.master);

        this.music = ctx.createGain();
        this.music.gain.value = this.musicVol;
        this.music.connect(this.master);
        this.musicRev = ctx.createGain();
        this.musicRev.gain.value = 0.7;
        this.music.connect(this.musicRev).connect(this.reverb);

        // dotted-eighth echo for the melody
        this.delay = ctx.createDelay(2);
        this.delay.delayTime.value = this.beat * 0.75;
        const fb = ctx.createGain();
        fb.gain.value = 0.38;
        const dl = ctx.createBiquadFilter();
        dl.type = 'lowpass';
        dl.frequency.value = 2400;
        this.delay.connect(dl).connect(fb).connect(this.delay);
        const delayOut = ctx.createGain();
        delayOut.gain.value = 0.35;
        dl.connect(delayOut).connect(this.music);

        this.padFilter = ctx.createBiquadFilter();
        this.padFilter.type = 'lowpass';
        this.padFilter.frequency.value = 1100;
        this.padFilter.Q.value = 0.6;
        this.padBus = ctx.createGain();
        this.padBus.gain.value = 0.16;
        this.padFilter.connect(this.padBus).connect(this.music);
        // slow filter breathing
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 350;
        lfo.connect(lfoAmt).connect(this.padFilter.frequency);
        lfo.start();

        this.sfx = ctx.createGain();
        this.sfx.gain.value = this.sfxVol;
        this.sfx.connect(this.master);
        const sfxRev = ctx.createGain();
        sfxRev.gain.value = 0.4;
        this.sfx.connect(sfxRev).connect(this.reverb);

        this._ambience();
        const t = ctx.currentTime + 0.1;
        this.nextChordAt = t;
        this.nextBeatAt = t + this.beat * 2;
        this.nextAmbientAt = t + 2;
        this.timer = setInterval(() => this._schedule(), 120);
    }

    setMuted(m) {
        this.muted = m;
        if (this.ctx && !this.paused) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.15);
    }

    /** Fades out and suspends everything while the tab is in the background,
     *  so the garden doesn't play over a game it just opened. Suspending the
     *  context freezes currentTime, so the score picks up where it left off. */
    setPaused(p) {
        if (p === this.paused) return;
        this.paused = p;
        if (!this.ctx) return;
        clearTimeout(this.pauseTimer);
        const t = this.ctx.currentTime;
        if (p) {
            this.master.gain.setTargetAtTime(0, t, 0.08);
            this.pauseTimer = setTimeout(() => this.ctx.suspend?.(), 400);
        } else {
            this.ctx.resume?.();
            this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.3);
        }
    }

    setMusicVolume(v) {
        this.musicVol = v;
        if (this.ctx) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
    }

    /** Called every frame with the world state. */
    update(night, shoreDist) {
        this.night = night;
        this.shore = shoreDist;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.padFilter.frequency.setTargetAtTime(1300 - night * 650, t, 1.5);
        // surf louder near the water
        const near = Math.max(0, Math.min(1, 1 - (-shoreDist) / 45));
        this.surfGain.gain.setTargetAtTime(0.05 + near * 0.32, t, 0.5);
        this.windGain.gain.setTargetAtTime(0.025 + night * 0.01, t, 1);
        this.crickets.gain.setTargetAtTime(night * 0.045, t, 2);
    }

    _impulse(seconds, decay) {
        const ctx = this.ctx;
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
        return buf;
    }

    _noiseBuffer(seconds, brown = false) {
        const ctx = this.ctx;
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            if (brown) {
                last = (last + 0.02 * w) / 1.02;
                d[i] = last * 3.5;
            } else d[i] = w;
        }
        return buf;
    }

    _ambience() {
        const ctx = this.ctx;
        this.noise = this._noiseBuffer(3);
        // surf: brown noise, low-passed, swelling like waves
        const surf = ctx.createBufferSource();
        surf.buffer = this._noiseBuffer(6, true);
        surf.loop = true;
        const sf = ctx.createBiquadFilter();
        sf.type = 'lowpass';
        sf.frequency.value = 700;
        const swell = ctx.createGain();
        swell.gain.value = 0.6;
        const sl = ctx.createOscillator();
        sl.frequency.value = 0.11;
        const sla = ctx.createGain();
        sla.gain.value = 0.4;
        sl.connect(sla).connect(swell.gain);
        const sl2 = ctx.createOscillator();
        sl2.frequency.value = 0.07;
        const sla2 = ctx.createGain();
        sla2.gain.value = 250;
        sl2.connect(sla2).connect(sf.frequency);
        this.surfGain = ctx.createGain();
        this.surfGain.gain.value = 0.15;
        surf.connect(sf).connect(swell).connect(this.surfGain).connect(this.master);
        surf.start();
        sl.start();
        sl2.start();
        // wind: band-passed noise that wanders
        const wind = ctx.createBufferSource();
        wind.buffer = this.noise;
        wind.loop = true;
        const wf = ctx.createBiquadFilter();
        wf.type = 'bandpass';
        wf.frequency.value = 500;
        wf.Q.value = 0.8;
        const wl = ctx.createOscillator();
        wl.frequency.value = 0.04;
        const wla = ctx.createGain();
        wla.gain.value = 300;
        wl.connect(wla).connect(wf.frequency);
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0.03;
        wind.connect(wf).connect(this.windGain).connect(this.master);
        wind.start();
        wl.start();
        // crickets: a high tone chopped into chirps
        const cr = ctx.createOscillator();
        cr.frequency.value = 4300;
        const am = ctx.createGain();
        am.gain.value = 0;
        const chop = ctx.createOscillator();
        chop.type = 'square';
        chop.frequency.value = 28;
        const chopG = ctx.createGain();
        chopG.gain.value = 0.5;
        const pulse = ctx.createOscillator();
        pulse.frequency.value = 0.9;
        const pulseG = ctx.createGain();
        pulseG.gain.value = 0.5;
        chop.connect(chopG).connect(am.gain);
        pulse.connect(pulseG).connect(am.gain);
        this.crickets = ctx.createGain();
        this.crickets.gain.value = 0;
        const crPan = ctx.createStereoPanner();
        crPan.pan.value = 0.4;
        cr.connect(am).connect(this.crickets).connect(crPan).connect(this.master);
        cr.start();
        chop.start();
        pulse.start();
    }

    _schedule() {
        const ctx = this.ctx;
        const ahead = ctx.currentTime + 0.4;
        while (this.nextChordAt < ahead) {
            this._chord(this.nextChordAt);
            this.nextChordAt += this.beat * 8;
        }
        while (this.nextBeatAt < ahead) {
            this._melodyBeat(this.nextBeatAt);
            this.nextBeatAt += this.beat / 2;
        }
        while (this.nextAmbientAt < ahead) {
            this._creature(this.nextAmbientAt);
            this.nextAmbientAt += 1.5 + Math.random() * 4;
        }
    }

    _chord(t) {
        const prog = this.night > 0.5 ? NIGHT : DAY;
        const ch = prog[this.chordIndex % prog.length];
        this.chordIndex++;
        this.currentChord = ch;
        const dur = this.beat * 8;
        const ctx = this.ctx;
        for (const n of ch.notes) {
            for (const det of [-7, 6]) {
                const o = ctx.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = midi(n);
                o.detune.value = det + Math.random() * 3;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.11, t + 2.8);
                g.gain.setValueAtTime(0.11, t + dur - 0.5);
                g.gain.linearRampToValueAtTime(0, t + dur + 3.5);
                const pan = ctx.createStereoPanner();
                pan.pan.value = det < 0 ? -0.35 : 0.35;
                o.connect(g).connect(pan).connect(this.padFilter);
                o.start(t);
                o.stop(t + dur + 3.6);
            }
        }
        // bass
        const b = ctx.createOscillator();
        b.type = 'sine';
        b.frequency.value = midi(ch.root);
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0, t);
        bg.gain.linearRampToValueAtTime(0.16, t + 1.2);
        bg.gain.linearRampToValueAtTime(0.0, t + dur + 1);
        b.connect(bg).connect(this.music);
        b.start(t);
        b.stop(t + dur + 1.1);
        // a bell to mark the change, sometimes
        if (Math.random() < 0.5) this._bell(midi(ch.notes[ch.notes.length - 1] + 12), t + this.beat * 2, 0.05, this.music);
    }

    _melodyBeat(t) {
        const density = 0.32 - this.night * 0.14;
        if (Math.random() > density) return;
        // random walk on the scale, pulled toward the chord
        this.melodyDeg += Math.round((Math.random() - 0.5) * 3.2);
        if (this.melodyDeg < 0) this.melodyDeg = 1;
        if (this.melodyDeg >= SCALE.length) this.melodyDeg = SCALE.length - 2;
        const n = SCALE[this.melodyDeg] - (this.night > 0.5 ? 12 : 0);
        this._pluck(midi(n), t, 0.09 + Math.random() * 0.04);
        // occasional answering note an octave up, quieter
        if (Math.random() < 0.15) this._pluck(midi(n + 12), t + this.beat * 0.75, 0.035);
    }

    _pluck(f, t, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = f * 2.001;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(3200, t);
        lp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (Math.random() - 0.5) * 0.8;
        o.connect(g);
        o2.connect(g2).connect(g);
        g.connect(lp).connect(pan);
        pan.connect(this.music);
        pan.connect(this.delay);
        o.start(t);
        o2.start(t);
        o.stop(t + 2.3);
        o2.stop(t + 2.3);
    }

    _bell(f, t, vol, out) {
        const ctx = this.ctx;
        const car = ctx.createOscillator();
        car.frequency.value = f;
        const mod = ctx.createOscillator();
        mod.frequency.value = f * 3.5;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 2.2, t);
        mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 2.5);
        mod.connect(mg).connect(car.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        car.connect(g).connect(out || this.sfx);
        car.start(t);
        mod.start(t);
        car.stop(t + 3.6);
        mod.stop(t + 3.6);
    }

    _creature(t) {
        const ctx = this.ctx;
        if (this.night < 0.4) {
            if (Math.random() < 0.55) return;
            // a bird: a few quick falling/rising chirps
            const pan = ctx.createStereoPanner();
            pan.pan.value = Math.random() * 1.6 - 0.8;
            const g = ctx.createGain();
            g.gain.value = 0.035 * (1 - this.night);
            g.connect(pan).connect(this.master);
            const n = 2 + Math.floor(Math.random() * 4);
            const base = 2200 + Math.random() * 1800;
            for (let i = 0; i < n; i++) {
                const tt = t + i * (0.09 + Math.random() * 0.05);
                const o = ctx.createOscillator();
                o.frequency.setValueAtTime(base * (1.2 + Math.random() * 0.3), tt);
                o.frequency.exponentialRampToValueAtTime(base * (0.8 + Math.random() * 0.2), tt + 0.07);
                const e = ctx.createGain();
                e.gain.setValueAtTime(0, tt);
                e.gain.linearRampToValueAtTime(1, tt + 0.01);
                e.gain.exponentialRampToValueAtTime(0.001, tt + 0.08);
                o.connect(e).connect(g);
                o.start(tt);
                o.stop(tt + 0.1);
            }
        } else if (Math.random() < 0.12) {
            // an owl: two soft hoots
            const pan = ctx.createStereoPanner();
            pan.pan.value = Math.random() * 1.4 - 0.7;
            pan.connect(this.master);
            for (let i = 0; i < 2; i++) {
                const tt = t + i * 0.55;
                const o = ctx.createOscillator();
                o.frequency.setValueAtTime(390, tt);
                o.frequency.linearRampToValueAtTime(360, tt + 0.35);
                const e = ctx.createGain();
                e.gain.setValueAtTime(0, tt);
                e.gain.linearRampToValueAtTime(0.04, tt + 0.06);
                e.gain.exponentialRampToValueAtTime(0.001, tt + 0.45);
                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.frequency.value = 800;
                o.connect(lp).connect(e).connect(pan);
                o.start(tt);
                o.stop(tt + 0.5);
            }
        }
    }

    // ------------------------------------------------------------- effects

    _noiseBurst(t, dur, freq, q, vol, type = 'bandpass') {
        const ctx = this.ctx;
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(this.sfx);
        s.start(t, Math.random() * 2);
        s.stop(t + dur + 0.05);
    }

    step(surface) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        if (surface === 'stone') this._noiseBurst(t, 0.07, 1800 + Math.random() * 600, 1.5, 0.05);
        else if (surface === 'wood') {
            this._noiseBurst(t, 0.09, 500 + Math.random() * 100, 3, 0.09);
        } else this._noiseBurst(t, 0.12, 900 + Math.random() * 400, 0.7, 0.03, 'lowpass');
    }

    hover() {
        if (!this.ctx) return;
        const ch = this.currentChord || DAY[0];
        const n = ch.notes[Math.floor(Math.random() * ch.notes.length)] + 24;
        this._bell(midi(n), this.ctx.currentTime, 0.035);
    }

    click() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._noiseBurst(t, 0.05, 2500, 4, 0.12);
        this._bell(midi(74), t + 0.02, 0.05);
        this._bell(midi(81), t + 0.1, 0.04);
    }

    arrow() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // a brass clunk and a rising shimmer from the projector
        this._noiseBurst(t, 0.08, 600, 5, 0.18);
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g).connect(this.sfx);
        o.start(t);
        o.stop(t + 0.2);
        for (let i = 0; i < 4; i++) this._bell(midi(74 + [0, 4, 7, 12][i]), t + 0.05 + i * 0.05, 0.02);
    }

    link() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // the linking whoosh: noise sweeping up, then a chord of bells
        const s = this.ctx.createBufferSource();
        s.buffer = this.noise;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2;
        f.frequency.setValueAtTime(200, t);
        f.frequency.exponentialRampToValueAtTime(4000, t + 1.0);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        s.connect(f).connect(g).connect(this.sfx);
        s.start(t);
        s.stop(t + 1.7);
        [62, 69, 74, 78].forEach((n, i) => this._bell(midi(n + 12), t + 0.5 + i * 0.07, 0.04));
    }

    sparkle() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [86, 90, 93].forEach((n, i) => this._bell(midi(n), t + i * 0.09, 0.015));
    }
}
