// Procedural lo-fi, all Web Audio, no files.
//
// - A look-ahead sequencer (25 ms timer, 120 ms ahead, 16th notes at 74 BPM with swing) plays a
//   four-chord loop on a soft electric piano, a brushed kit, a round bass and a pad. Layers
//   follow the player's flow: chords only at first, drums at flow 1, bass at 2, the pad at 3.
// - Every chime the sim emits (one per so much glass wiped) is queued and played on the next
//   free eighth note as a bell from the current chord's pentatonic scale, so wiping plays a
//   melody that always sits on the beat and in key.
// - Tape wobble (an LFO on every oscillator's detune), a low-pass over the music, vinyl crackle,
//   and the rain: looped filtered noise and the odd drip on the glass, on its own volume.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the
// tab is hidden.

const BPM = 74;
const S16 = 60 / BPM / 4;
const NOTE = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const SHAPES = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], 7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14], 6: [0, 4, 7, 9] };
// four progressions, in keys whose major pentatonic fits every chord
const PROGS = [
    { key: 'C', chords: [['F', 'maj7'], ['E', 'm7'], ['D', 'm9'], ['C', 'maj9']] },
    { key: 'F', chords: [['D', 'm9'], ['G', 'm7'], ['C', '7'], ['F', 'maj7']] },
    { key: 'Bb', chords: [['Eb', 'maj7'], ['D', 'm7'], ['C', 'm9'], ['Bb', '6']] },
    { key: 'G', chords: [['C', 'maj7'], ['B', 'm7'], ['A', 'm9'], ['G', 'maj7']] },
];
const PENTA = [0, 2, 4, 7, 9];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.rainVol = 0.6;
        this.flow = 0;
        this.mode = 'title';
        this.prog = PROGS[0];
        this.shift = 0;
        this.chimes = 0;
        this.chimeI = 0;
        this.step = 0;
        this.nextT = 0;
        this.last = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        // a meter for the tests: proof that sound comes out, not just that code ran
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 2048;
        comp.connect(this.meter);
        this.sfx = ctx.createGain(); this.sfx.connect(comp);
        this.rainBus = ctx.createGain(); this.rainBus.connect(comp);
        this.music = ctx.createGain(); this.music.connect(comp);
        // the lo-fi bit: everything musical goes through a gentle low-pass
        this.tone = ctx.createBiquadFilter();
        this.tone.type = 'lowpass'; this.tone.frequency.value = 3400; this.tone.Q.value = 0.4;
        this.tone.connect(this.music);
        // a dotted-eighth echo for the bells
        this.delay = ctx.createDelay(1);
        this.delay.delayTime.value = S16 * 3;
        const fb = ctx.createGain(); fb.gain.value = 0.32;
        const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
        this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.tone);
        // tape wobble
        this.wob = ctx.createOscillator(); this.wob.frequency.value = 0.31;
        this.wobAmt = ctx.createGain(); this.wobAmt.gain.value = 7;
        this.wob.connect(this.wobAmt); this.wob.start();
        this.noise = this.makeNoise(2);
        this.startCrackle();
        this.startRain();
        this.setVolumes(this.sfxVol, this.musicVol, this.rainVol);
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 25);
    }

    /** Peak level of the last ~40 ms of output (0..1). */
    level() {
        if (!this.meter) return 0;
        const d = new Float32Array(this.meter.fftSize);
        this.meter.getFloatTimeDomainData(d);
        let m = 0;
        for (const v of d) m = Math.max(m, Math.abs(v));
        return m;
    }

    setVolumes(sfx, music, rain = this.rainVol) {
        this.sfxVol = sfx; this.musicVol = music; this.rainVol = rain;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx * 0.9, t, 0.03);
        this.music.gain.setTargetAtTime(music * 0.7, t, 0.03);
        this.rainBus.gain.setTargetAtTime(rain * 0.5, t, 0.08);
    }

    setStation(i, late) {
        const p = PROGS[i % PROGS.length];
        const shift = late ? -2 : 0;
        if (p !== this.prog || shift !== this.shift) { this.prog = p; this.shift = shift; }
    }
    setFlow(level) { this.flow = level; }
    setMode(m) { this.mode = m; }

    makeNoise(sec) {
        const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * sec), this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    loop(buf, ...nodes) {
        const s = this.ctx.createBufferSource();
        s.buffer = buf; s.loop = true;
        let n = s;
        for (const x of nodes) { n.connect(x); n = x; }
        s.start();
        return s;
    }

    startCrackle() {
        const ctx = this.ctx;
        const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
            d[i] = (Math.random() * 2 - 1) * 0.012;
            if (Math.random() < 0.0006) d[i] = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.7);
        }
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        const g = ctx.createGain(); g.gain.value = 0.22;
        this.loop(b, hp, g, this.music);
    }

    startRain() {
        const ctx = this.ctx;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
        const g = ctx.createGain(); g.gain.value = 0.35;
        this.loop(this.noise, lp, g, this.rainBus);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.5;
        const g2 = ctx.createGain(); g2.gain.value = 0.05;
        this.loop(this.noise, bp, g2, this.rainBus);
    }

    // ------------------------------------------------------------------ voices
    osc(type, f, t, dur, vol, dest, { to = 0, attack = 0.008, wobble = true } = {}) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        if (wobble) this.wobAmt.connect(o.detune);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
        o.onended = () => { try { this.wobAmt.disconnect(o.detune); } catch { /* already */ } };
        return o;
    }

    burst(t, dur, vol, type, freq, dest, q = 0.8) {
        const ctx = this.ctx;
        const s = ctx.createBufferSource(); s.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
    }

    keys(midi, t, vol, dur = 2.6) {
        const f = mtof(midi);
        this.osc('sine', f, t, dur, vol, this.tone);
        this.osc('triangle', f * 2, t, dur * 0.35, vol * 0.18, this.tone);
        this.osc('sine', f * 3.01, t, 0.25, vol * 0.06, this.tone);
    }

    bell(midi, t, vol) {
        const f = mtof(midi);
        const g = this.ctx.createGain(); g.gain.value = 1;
        g.connect(this.tone); g.connect(this.delay);
        this.osc('sine', f, t, 1.4, vol, g, { attack: 0.004 });
        this.osc('sine', f * 2.76, t, 0.4, vol * 0.18, g, { attack: 0.002 });
        this.osc('triangle', f * 2, t, 0.25, vol * 0.08, g, { attack: 0.002 });
    }

    chord(i) {
        const [root, shape] = this.prog.chords[i % 4];
        const r = 48 + NOTE[root] + this.shift;
        return { root: r, notes: SHAPES[shape].map((x) => r + x + (r + x < 53 ? 12 : 0)) };
    }

    // ------------------------------------------------------------------ sequencer
    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        if (this.nextT < ctx.currentTime - 0.2) {               // the tab slept: skip ahead, don't cram
            const skip = Math.ceil((ctx.currentTime - this.nextT) / S16);
            this.step += skip; this.nextT += skip * S16;
        }
        while (this.nextT < ctx.currentTime + 0.12) {
            const swing = this.step % 2 === 1 ? S16 * 0.22 : 0;
            this.playStep(this.step, this.nextT + swing);
            this.nextT += S16;
            this.step++;
        }
    }

    playStep(step, t) {
        const s = step % 16, bar = Math.floor(step / 16);
        const { root, notes } = this.chord(bar);
        const playing = this.mode === 'play';
        const lvl = playing ? this.flow : 0;
        if (s === 0) notes.forEach((m, i) => this.keys(m, t + i * 0.018, 0.075));
        if (s === 10 && lvl >= 1) notes.slice(1).forEach((m, i) => this.keys(m, t + i * 0.012, 0.04, 1.2));
        if (s === 0 && lvl >= 3) this.pad(notes, t);
        if (lvl >= 1) {
            if (s === 0 || s === 7 || (s === 10 && bar % 2)) this.kick(t);
            if (s === 4 || s === 12) this.snare(t);
            if (s % 2 === 0) this.burst(t, 0.035, s % 4 === 2 ? 0.05 : 0.03, 'highpass', 7000, this.tone);
        }
        if (lvl >= 2) {
            if (s === 0) this.osc('sine', mtof(root - 12), t, S16 * 7, 0.2, this.tone, { attack: 0.02 });
            if (s === 10) this.osc('sine', mtof(root - 12 + (bar % 2 ? 7 : 0)), t, S16 * 4, 0.16, this.tone, { attack: 0.02 });
        }
        // the player's own melody, one note per free eighth
        if (s % 2 === 0 && this.chimes > 0) {
            this.chimes--;
            this.bell(this.melody(this.chimeI++), t, 0.07 + 0.015 * this.flow);
        }
        // the odd drip on the glass
        if (s % 4 === 3 && Math.random() < 0.18) {
            const f = 1800 + Math.random() * 2400;
            this.osc('sine', f, t, 0.05, 0.03 + Math.random() * 0.03, this.rainBus, { to: f * 0.6, wobble: false });
        }
    }

    /** The i-th note of the wiping melody: a slow seeded contour over the key's pentatonic. */
    melody(i) {
        const k = 72 + NOTE[this.prog.key] + this.shift - 12;
        const c = 4 + Math.round(2.2 * Math.sin(i * 0.55) + 1.3 * Math.sin(i * 1.37 + 1) + 0.6 * Math.sin(i * 3.1));
        const deg = Math.max(0, Math.min(9, c));
        return k + PENTA[deg % 5] + 12 * Math.floor(deg / 5);
    }

    kick(t) {
        this.osc('sine', 120, t, 0.32, 0.4, this.tone, { to: 42, attack: 0.003, wobble: false });
    }
    snare(t) {
        this.burst(t, 0.2, 0.12, 'bandpass', 1700, this.tone, 0.6);
        this.osc('triangle', 190, t, 0.08, 0.05, this.tone, { to: 150, wobble: false });
    }
    pad(notes, t) {
        const ctx = this.ctx;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = ctx.createGain();
        const dur = S16 * 16;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        lp.connect(g); g.connect(this.tone);
        for (const m of notes.slice(0, 3)) for (const det of [-6, 6]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth';
            o.frequency.value = mtof(m + 12); o.detune.value = det;
            o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
        }
    }

    // ------------------------------------------------------------------ effects
    limit(name, gap) {
        const now = this.ctx.currentTime;
        if (this.last[name] && now - this.last[name] < gap) return false;
        this.last[name] = now;
        return true;
    }

    ui(kind) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime;
        if (kind === 'click') this.osc('sine', 880, t, 0.06, 0.06, this.sfx, { wobble: false });
        else if (kind === 'open') this.osc('sine', 520, t, 0.12, 0.06, this.sfx, { to: 780, wobble: false });
        else if (kind === 'close') this.osc('sine', 780, t, 0.12, 0.06, this.sfx, { to: 520, wobble: false });
        else if (kind === 'card') { this.burst(t, 0.12, 0.12, 'lowpass', 900, this.sfx); this.osc('sine', 160, t + 0.02, 0.15, 0.12, this.sfx, { to: 90, wobble: false }); }
    }

    onEvents(G, events) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime;
        for (const e of events) {
            switch (e.type) {
                case 'chime': if (this.chimes < 2) this.chimes++; break;
                case 'merge':
                    if (this.limit('merge', 0.05)) {
                        const f = 600 + Math.random() * 200;
                        this.osc('sine', f, t, 0.09, 0.07, this.sfx, { to: f * 1.5, wobble: false });
                    }
                    break;
                case 'drop': this.osc('sine', 1500, t, 0.07, 0.04, this.sfx, { to: 1900, wobble: false }); break;
                case 'dry': this.osc('sine', 700, t, 0.25, 0.04, this.sfx, { to: 320, wobble: false }); break;
                case 'runoff': {
                    const ctx = this.ctx;
                    const s = ctx.createBufferSource(); s.buffer = this.noise;
                    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
                    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.6);
                    const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
                    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + 0.65);
                    break;
                }
                case 'tap':
                    for (const dt of [0, 0.13]) { this.burst(t + dt, 0.07, 0.25, 'lowpass', 420, this.sfx); this.osc('sine', 150, t + dt, 0.1, 0.12, this.sfx, { to: 90, wobble: false }); }
                    break;
                case 'spot': {
                    const base = 79 + NOTE[this.prog.key] + this.shift - 12;
                    const v = e.self ? 0.09 : 0.05;
                    this.bell(base, t, v); this.bell(base + 7, t + 0.12, v);
                    if (e.rare) this.bell(base + 12, t + 0.26, v);
                    break;
                }
                case 'flow': this.flow = e.level; if (e.level >= 1) this.bell(84 + NOTE[this.prog.key] + this.shift - 12 + PENTA[e.level], t, 0.04); break;
                case 'complete': {
                    const { notes } = this.chord(Math.floor(this.step / 16));
                    [...notes, notes[0] + 12, notes[1] + 12].forEach((m, i) => this.bell(m + 12, t + i * 0.11, 0.07));
                    break;
                }
                case 'pane': this.setStation(e.station, e.late); break;
            }
        }
    }
}
