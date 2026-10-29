// Sound for the Observatory tower: glassy arpeggios for the prism, bells for the
// clocks, a thunderclap in a jar, bubbling brews and their poof, mushrooms that
// ring like marimbas, a harp of light, teacups, a purring comet, the lift's hum
// and the telescope's ratchet and discovery chime. All synthesised on the
// garden's own audio graph, so mute, volume and tab-pause already apply.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// D major pentatonic over three octaves: every instrument in the tower agrees with the garden's score
export const PENTA = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];

export class TowerAudio {
    constructor(engine) {
        this.e = engine;
        this.ctx = engine.ctx;
        if (!this.ctx) return;
        const ctx = this.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0.9;
        this.out.connect(engine.sfx);
        // the lift: a soft choir of detuned sines that swells while it rides
        this.lift = ctx.createGain();
        this.lift.gain.value = 0;
        const lf = ctx.createBiquadFilter();
        lf.type = 'lowpass';
        lf.frequency.value = 1400;
        this.lift.connect(lf).connect(this.out);
        this.liftOsc = [];
        for (const [n, d] of [[50, -4], [57, 3], [62, -2], [66, 5], [69, 0]]) {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = midi(n);
            o.detune.value = d;
            const g = ctx.createGain();
            g.gain.value = 0.05;
            o.connect(g).connect(this.lift);
            o.start();
            this.liftOsc.push(o);
        }
        // a hush of air for the library stacks and the dome
        this.air = ctx.createGain();
        this.air.gain.value = 0;
        const src = ctx.createBufferSource();
        src.buffer = engine._noiseBuffer(4, true);
        src.loop = true;
        const af = ctx.createBiquadFilter();
        af.type = 'bandpass';
        af.frequency.value = 420;
        af.Q.value = 0.5;
        src.connect(af).connect(this.air).connect(this.out);
        src.start();
    }

    get ok() {
        return !!this.ctx && !this.e.muted;
    }

    get now() {
        return this.ctx.currentTime;
    }

    bell(n, at = 0, vol = 0.05) {
        if (!this.ctx) return;
        this.e._bell(midi(n), this.now + at, vol, this.out);
    }

    /** A plucked string or a struck bar: `bright` sets how much of a bell it has. */
    pluck(n, { at = 0, vol = 0.12, decay = 1.6, type = 'triangle', bright = 2400 } = {}) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = this.now + at;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midi(n);
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = midi(n + 12);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(bright, t);
        f.frequency.exponentialRampToValueAtTime(400, t + decay);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        const g2 = ctx.createGain();
        g2.gain.value = 0.3;
        o.connect(f);
        o2.connect(g2).connect(f);
        f.connect(g).connect(this.out);
        o.start(t);
        o2.start(t);
        o.stop(t + decay + 0.05);
        o2.stop(t + decay + 0.05);
    }

    noise(dur, freq, q, vol, at = 0, type = 'bandpass') {
        if (!this.ctx) return;
        this.e._noiseBurst(this.now + at, dur, freq, q, vol, type, this.out);
    }

    /** A rising run of bells. */
    arp(notes, step = 0.07, vol = 0.045, at = 0) {
        notes.forEach((n, i) => this.bell(n, at + i * step, vol));
    }

    // ------------------------------------------------------------ the rooms

    prism() {
        this.arp([74, 78, 81, 86, 90], 0.06, 0.03);
        this.noise(0.6, 6000, 1.5, 0.03);
    }

    tick(at = 0) {
        this.noise(0.03, 3600, 8, 0.07, at);
        this.noise(0.05, 1400, 10, 0.04, at + 0.01);
    }

    clockChime() {
        // a grandfather clock's Westminster-ish phrase, then twelve quick strokes from everything at once
        [69, 66, 67, 62, 62, 67, 69, 66].forEach((n, i) => this.bell(n - 12, i * 0.42, 0.07));
        for (let i = 0; i < 12; i++) {
            this.bell(PENTA[(i * 3) % PENTA.length] + 12, 3.6 + i * 0.16, 0.03);
            this.tick(3.6 + i * 0.16);
        }
    }

    cuckoo(at = 0) {
        for (let k = 0; k < 2; k++) {
            const t0 = at + k * 0.7;
            this.pluck(79, { at: t0, vol: 0.09, decay: 0.32, type: 'sine', bright: 1800 });
            this.pluck(75, { at: t0 + 0.24, vol: 0.09, decay: 0.42, type: 'sine', bright: 1800 });
        }
    }

    thunder(near = 1) {
        if (!this.ctx) return;
        this.noise(0.08, 3000, 0.7, 0.18 * near);
        this.noise(1.6, 120, 0.4, 0.4 * near, 0.04, 'lowpass');
        this.noise(1.1, 300, 0.5, 0.12 * near, 0.2, 'lowpass');
    }

    shimmer() {
        this.arp([86, 83, 90, 88, 93], 0.05, 0.02);
    }

    whirr(dur = 0.6) {
        for (let i = 0; i < dur * 22; i++) this.noise(0.02, 2400 + (i % 3) * 300, 9, 0.04, i / 22);
    }

    wake() {
        this.arp([62, 66, 69, 74, 78, 81, 86], 0.09, 0.04);
    }

    bubble(at = 0) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = this.now + at;
        const o = ctx.createOscillator();
        o.type = 'sine';
        const f0 = 300 + Math.random() * 500;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.07);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.1);
    }

    pour() {
        for (let i = 0; i < 14; i++) this.bubble(0.25 + i * 0.05 + Math.random() * 0.03);
        this.noise(0.9, 1500, 0.6, 0.05, 0.2);
    }

    poof() {
        this.noise(0.9, 700, 0.5, 0.25, 0, 'lowpass');
        this.noise(0.5, 2600, 0.8, 0.08, 0.05);
        this.arp([74, 79, 83, 86, 91], 0.06, 0.035, 0.25);
    }

    flutter() {
        for (let i = 0; i < 10; i++) this.noise(0.05, 1100 + Math.random() * 900, 1.5, 0.05, i * 0.045);
    }

    whistle() {
        if (!this.ctx) return;
        const ctx = this.ctx, t = this.now;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(1500, t);
        o.frequency.linearRampToValueAtTime(2300, t + 0.18);
        o.frequency.linearRampToValueAtTime(1900, t + 0.3);
        o.frequency.linearRampToValueAtTime(2600, t + 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.03);
        g.gain.setValueAtTime(0.06, t + 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.65);
    }

    marimba(n) {
        this.pluck(n, { vol: 0.16, decay: 0.9, type: 'sine', bright: 3000 });
        this.bell(n + 24, 0, 0.012);
    }

    harp(n) {
        this.pluck(n, { vol: 0.13, decay: 2.4, type: 'triangle', bright: 5200 });
        this.bell(n + 12, 0.01, 0.015);
    }

    scratch() {
        for (let i = 0; i < 16; i++) this.noise(0.04 + Math.random() * 0.05, 3000 + Math.random() * 2500, 2, 0.03, i * 0.09 + Math.random() * 0.04);
    }

    page() {
        this.noise(0.25, 2400, 0.6, 0.05);
        this.noise(0.15, 5200, 0.8, 0.025, 0.12);
    }

    murmur(pitch = 1) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const n = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
            const t = this.now + i * 0.085;
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(pitch * (160 + Math.random() * 90), t);
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = pitch * (700 + Math.random() * 900);
            f.Q.value = 5;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.05, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
            o.connect(f).connect(g).connect(this.out);
            o.start(t);
            o.stop(t + 0.1);
        }
    }

    clink(at = 0) {
        this.bell(93, at, 0.04);
        this.bell(98, at + 0.01, 0.02);
    }

    ratchet(n = 8) {
        for (let i = 0; i < n; i++) this.noise(0.03, 2200, 7, 0.08, i * 0.06);
    }

    purr() {
        if (!this.ctx) return;
        const ctx = this.ctx, t = this.now;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 48;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 24;
        const lg = ctx.createGain();
        lg.gain.value = 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + 1.8);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 300;
        const am = ctx.createGain();
        am.gain.value = 0.5;
        lfo.connect(lg).connect(am.gain);
        o.connect(lp).connect(am).connect(g).connect(this.out);
        o.start(t);
        lfo.start(t);
        o.stop(t + 1.9);
        lfo.stop(t + 1.9);
        this.arp([81, 86, 90], 0.12, 0.02, 0.2);
    }

    whoosh(at = 0) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = this.now + at;
        const s = ctx.createBufferSource();
        s.buffer = this.e.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2;
        f.frequency.setValueAtTime(400, t);
        f.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
        f.frequency.exponentialRampToValueAtTime(600, t + 0.8);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        s.connect(f).connect(g).connect(this.out);
        s.start(t, Math.random());
        s.stop(t + 1);
    }

    chord(notes, vol = 0.05) {
        notes.forEach((n, i) => this.pluck(n, { at: i * 0.02, vol, decay: 3.2, type: 'sine', bright: 1600 }));
    }

    // ------------------------------------------------------------ the tower itself

    liftRide(on) {
        if (!this.ctx) return;
        this.lift.gain.setTargetAtTime(on ? 0.9 : 0, this.now, on ? 0.25 : 0.4);
        if (on) this.arp([62, 69, 74, 78], 0.1, 0.03);
    }

    liftPitch(k) {
        if (!this.ctx) return;
        // the choir glides up a fifth as it rises
        for (const o of this.liftOsc) o.detune.setTargetAtTime(k * 700, this.now, 0.3);
    }

    setAir(v) {
        if (!this.ctx) return;
        this.air.gain.setTargetAtTime(v, this.now, 0.8);
    }

    focus() {
        this.ratchet(12);
        this.whirr(0.8);
    }

    /** A discovery through the telescope: longer and higher for the rarer things. */
    discover(rank) {
        const runs = [[69, 74, 78], [69, 74, 78, 81], [67, 71, 74, 79, 83, 86], [62, 66, 69, 74, 78, 81, 86, 90]];
        this.arp(runs[Math.min(rank, 3)], 0.09, 0.05);
        if (rank >= 2) this.chord([50, 57, 62, 66], 0.04);
    }
}
