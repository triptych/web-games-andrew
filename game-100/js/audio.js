// Procedural sound, all Web Audio, no files. Two parts:
//
//  - the band: a look-ahead sequencer (a 25 ms timer schedules every 16th note that falls inside
//    the next 120 ms on the AudioContext clock, so timing never drifts with the frame rate) that
//    plays four-on-the-floor disco funk in A minor at 118 BPM: kick, claps, open hats, an octave
//    bass, a wah-guitar chop, electric piano, a string pad, a brass riff and a string run. Bass and
//    strings duck on every kick (the side-chain pump). Layers come in with intensity; Fever
//    modulates up a tone, the way the genre always did.
//  - the effects: every sim event has a voice (chimes that climb a pentatonic scale with the combo,
//    laser zaps for beams, a boom for bombs, a glitter run for Glitterballs...).
//
// The context is made on the first gesture (browsers block audio before one) and
// ../lib/page-audio.js suspends it while the tab is hidden. `beat()` gives the view the band's
// position so the dance floor pulses exactly on the kick.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const BPM = 118;
const SPB = 60 / BPM;
const STEP = SPB / 4;
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88];

// Am7 | Dm7 | G7 | Cmaj7, one bar each
const CHORDS = [
    { root: 45, tones: [0, 3, 7, 10] },
    { root: 50, tones: [0, 3, 7, 10] },
    { root: 43, tones: [0, 4, 7, 10] },
    { root: 48, tones: [0, 4, 7, 11] },
];
// the brass riff: [step, midi, length in steps] per bar
const RIFF = [
    [[0, 76, 2], [3, 76, 1], [5, 79, 2], [8, 76, 3], [12, 74, 2]],
    [[0, 74, 2], [3, 74, 1], [5, 77, 2], [8, 74, 3], [12, 72, 2]],
    [[0, 71, 2], [3, 71, 1], [5, 74, 2], [8, 79, 3], [12, 77, 2]],
    [[0, 76, 4], [6, 72, 2], [8, 74, 2], [10, 76, 2], [12, 79, 4]],
];
const RUN = [69, 72, 74, 76, 79, 81, 84, 88];
const CHOP = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0];
const CHOP_ACCENT = [1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.sfxScale = 1;              // the attract-mode demo plays quietly
        this.want = 'off';              // off | menu | play
        this.intensity = 2;
        this.keyShift = 0;
        this.lastSlot = {};
        this.t0 = 0;
        this.step = 0;
        this.nextTime = 0;
    }

    /**
     * Make or wake the context. Call it from every gesture until `running`: phones only unlock audio
     * on a touchend/click (not pointerdown) and a context made earlier stays suspended until resumed.
     */
    init() {
        this.unlockMedia();
        if (this.ctx) {
            if (this.ctx.state !== 'running') { this.ctx.resume?.(); this.wake(); }
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -15; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.analyser = ctx.createAnalyser();          // for the tests: is anything coming out, and is it clipping?
        this.analyser.fftSize = 2048;
        comp.connect(this.analyser);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        this.pump = ctx.createGain(); this.pump.connect(this.music);     // bass and strings go through this
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.28;
        this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(1.8, 2.8);
        this.verbIn.connect(this.verb); this.verb.connect(comp);
        this.noiseBuf = this.makeNoise(1.5);
        this.nextTime = ctx.currentTime + 0.1;
        this.t0 = this.nextTime;
        this.step = 0;
        this.timer = setInterval(() => this.schedule(), 25);
        ctx.addEventListener?.('statechange', () => { if (ctx.state === 'interrupted') ctx.resume?.(); });
        this.wake();
    }

    /** Play one silent sample: some browsers only start the clock once something has been played in a gesture. */
    wake() {
        try {
            const ctx = this.ctx, b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
            src.buffer = b; src.connect(ctx.destination); src.start(0);
        } catch { /* nothing to unlock yet */ }
    }

    /** iOS mutes Web Audio while the ringer switch is on silent unless a media element is playing: loop a silent one. */
    unlockMedia() {
        if (this.media) return;
        try {
            if (navigator.audioSession) navigator.audioSession.type = 'playback';
            const a = document.createElement('audio');
            a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0.01;
            a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
            const p = a.play();
            if (p && p.catch) p.catch(() => { this.media = null; });
            this.media = a;
        } catch { this.media = null; }
    }

    impulse(sec, decay) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = b.getChannelData(ch);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
        }
        return b;
    }
    makeNoise(sec) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx * this.sfxScale, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    get running() { return !!this.ctx && this.ctx.state === 'running'; }

    setSfxScale(k) {
        if (k === this.sfxScale) return;
        this.sfxScale = k;
        if (this.ctx) this.sfx.gain.setTargetAtTime(this.sfxVol * k, this.ctx.currentTime, 0.05);
    }

    /** The peak sample magnitude of the last 2048 samples going to the speakers (0 when silent). */
    level() {
        if (!this.analyser) return 0;
        const buf = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v));
        return peak;
    }

    // ------------------------------------------------------------------ the band
    /** 'off', 'menu' (a gentle groove) or 'play'. */
    play(track) { this.want = track; }
    setIntensity(n) { this.intensity = n; }
    setKey(semis) { this.keyShift = semis; }

    /** Where the band is, for the view: { phase: 0-1 within the beat, beat, bar, kick: 1 -> 0 after each kick }. */
    beat() {
        if (!this.ctx || this.ctx.state !== 'running' || this.want === 'off') return null;
        const s = (this.ctx.currentTime - this.t0) / STEP;
        const beat = s / 4;
        const phase = beat - Math.floor(beat);
        return { phase, beat, bar: Math.floor(beat / 4), step: s, kick: Math.exp(-phase * 5) };
    }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        if (this.nextTime < ctx.currentTime - 0.2) {              // the tab was hidden: skip ahead, don't cram
            const skip = Math.ceil((ctx.currentTime - this.nextTime) / STEP);
            this.step += skip; this.nextTime += skip * STEP;
        }
        while (this.nextTime < ctx.currentTime + 0.12) {
            if (this.want !== 'off') this.playStep(this.step, this.nextTime);
            this.nextTime += STEP;
            this.step++;
        }
    }

    playStep(n, t) {
        const s = n % 16, bar = Math.floor(n / 16) % 4, chord = CHORDS[bar];
        const lvl = this.want === 'menu' ? 1 : this.intensity;
        const ks = this.keyShift;
        const swing = (s % 2) ? 0.008 : 0;
        t += swing;

        // drums
        if (s % 4 === 0) { this.kick(t, lvl >= 1 ? 1 : 0); this.pump.gain.setValueAtTime(0.5, t); this.pump.gain.linearRampToValueAtTime(1, t + SPB * 0.8); }
        if (lvl >= 2 && (s === 4 || s === 12)) this.clap(t, 0.5);
        if (lvl >= 2 && bar === 3 && (s === 14 || s === 15)) this.clap(t, 0.3);
        if (s % 2 === 0 && s % 4 !== 0) this.hat(t, true, lvl >= 2 ? 0.1 : 0.06);              // open hat on the off-beat 8ths
        else if (s % 4 !== 0) this.hat(t, false, 0.05 + (s % 4 === 3 ? 0.02 : 0));            // closed hats on the 16ths between
        else this.hat(t, false, 0.035);
        if (this.hurry && s % 4 === 2) this.hat(t, false, 0.08);

        // bass: octaves on the 8ths, ghost notes between
        const bassHit = s % 2 === 0 || s === 3 || s === 11 || (lvl >= 3 && s === 15);
        if (bassHit) {
            const up = s % 4 === 2 || s === 14;
            let note = chord.root + ks + (up ? 12 : 0);
            if (s === 3) note += 7;                       // a fifth on the ghost note before beat 2
            else if (s === 11) note -= 2;                 // a step under the root before beat 4
            this.bass(t, note, s % 2 ? 0.55 : 1, s % 2 ? 0.07 : 0.14);
        }

        // electric piano stabs
        if (lvl >= 1 && (s === 0 || s === 6 || s === 10 || (lvl >= 3 && s === 13))) {
            const notes = chord.tones.map((x) => chord.root + 24 + x + ks);
            this.epiano(t, notes, s === 0 ? 0.5 : 0.3, s === 0 ? 0.5 : 0.2);
        }
        // wah guitar chops
        if (lvl >= 2 && CHOP[s]) {
            const wah = 700 + 1300 * (0.5 + 0.5 * Math.sin((n / 16) * Math.PI * 0.5 + s * 0.1));
            // the chop plays the upper structure of the chord: its third, fifth and seventh
            this.chop(t, [chord.root + 24 + chord.tones[1] + ks, chord.root + 31 + ks, chord.root + 24 + chord.tones[3] + ks], CHOP_ACCENT[s] ? 0.05 : 0.026, wah);
        }
        // strings: a pad every bar, the run at the end of every fourth bar
        if (lvl >= 2 && s === 0) this.strings(t, chord.tones.map((x) => chord.root + 12 + x + ks), STEP * 16, lvl >= 3 ? 0.05 : 0.035);
        if (lvl >= 3 && bar === 3 && s >= 8) this.pluck(t, RUN[s - 8] + ks, 0.07);
        // brass riff
        if (lvl >= 3) for (const [st, m, len] of RIFF[bar]) if (st === s) this.brass(t, m + ks, len * STEP, 0.07);
    }

    // ------------------------------------------------------------------ band voices
    kick(t, v) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.3);
    }
    clap(t, v) {
        for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.011, { dur: k === 2 ? 0.16 : 0.03, vol: 0.2 * v, bp: 1700, q: 0.9, bus: this.music, send: 0.5 });
    }
    hat(t, open, v) {
        this.noiseHit(t, { dur: open ? 0.13 : 0.035, vol: v, hp: 7000, bus: this.music });
    }
    noiseHit(t, { dur = 0.1, vol = 0.2, hp, lp, bp, q = 1, bus = this.sfx, send = 0, rate = 1 } = {}) {
        const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = this.noiseBuf; src.playbackRate.value = rate;
        let node = src;
        const f = (type, freq) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = freq; x.Q.value = q; node.connect(x); node = x; };
        if (hp) f('highpass', hp);
        if (lp) f('lowpass', lp);
        if (bp) f('bandpass', bp);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        node.connect(g); g.connect(bus);
        if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verbIn); }
        src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.02);
    }
    bass(t, note, v, dur) {
        const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o2.type = 'square';
        o.frequency.value = o2.frequency.value = mtof(note);
        f.type = 'lowpass'; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(260, t + dur + 0.05);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.pump);
        o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }
    epiano(t, notes, v, dur) {
        const ctx = this.ctx;
        for (const n of notes) {
            const fr = mtof(n), c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
            c.frequency.value = fr; m.frequency.value = fr * 1.002;
            mg.gain.setValueAtTime(fr * 1.4, t); mg.gain.exponentialRampToValueAtTime(fr * 0.05, t + dur + 0.2);
            m.connect(mg); mg.connect(c.frequency);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.055 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
            c.connect(g); g.connect(this.music);
            const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.verbIn);
            c.start(t); m.start(t); c.stop(t + dur + 0.55); m.stop(t + dur + 0.55);
        }
    }
    chop(t, notes, v, wah) {
        const ctx = this.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = wah; f.Q.value = 3.5;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
        f.connect(g); g.connect(this.music);
        for (const n of notes) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.connect(f); o.start(t); o.stop(t + 0.08); }
    }
    strings(t, notes, dur, v) {
        const ctx = this.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 2200;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
        f.connect(g); g.connect(this.pump);
        const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.verbIn);
        for (const n of notes) for (const d of [-8, 8]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = d;
            o.connect(f); o.start(t); o.stop(t + dur + 0.12);
        }
    }
    pluck(t, note, v) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(note);
        f.type = 'lowpass'; f.frequency.value = 3200;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 1.6);
        o.connect(f); f.connect(g); g.connect(this.music);
        const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.verbIn);
        o.start(t); o.stop(t + STEP * 1.7);
    }
    brass(t, note, dur, v) {
        const ctx = this.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.05); f.frequency.exponentialRampToValueAtTime(1400, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.setValueAtTime(v * 0.8, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
        f.connect(g); g.connect(this.music);
        const s = ctx.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(this.verbIn);
        for (const d of [-9, 9]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(note); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.08); }
    }

    // ------------------------------------------------------------------ effect voices
    now() { return this.ctx.currentTime; }
    /** Rate limit: one sound per `key` per `gap` seconds. */
    free(key, gap) {
        const t = this.ctx.currentTime;
        if (t - (this.lastSlot[key] || -9) < gap) return false;
        this.lastSlot[key] = t;
        return true;
    }
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, att = 0.008, send = 0, bus = this.sfx } = {}) {
        if (!this.running) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + att);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus);
        if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verbIn); }
        o.start(t); o.stop(t + dur + 0.03);
    }
    noise(o) { if (this.running) this.noiseHit(this.ctx.currentTime + (o.delay || 0), o); }
    bell(freq, vol = 0.12, delay = 0, dur = 0.7) {
        if (!this.running) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        c.frequency.value = freq; m.frequency.value = freq * 3.5;
        mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.6);
        m.connect(mg); mg.connect(c.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        c.connect(g); g.connect(this.sfx);
        const s = ctx.createGain(); s.gain.value = 0.55; g.connect(s); s.connect(this.verbIn);
        c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
    }
    stab(root, vol = 0.1, delay = 0, dur = 0.35) {
        for (const iv of [0, 4, 7, 11, 14]) this.brassFx(root + iv, vol, delay, dur);
    }
    brassFx(note, vol, delay, dur) {
        if (!this.running) return;
        const ctx = this.ctx, t = ctx.currentTime + delay, f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3600, t + 0.05); f.frequency.exponentialRampToValueAtTime(1200, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        f.connect(g); g.connect(this.sfx);
        const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.verbIn);
        for (const d of [-9, 9]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(note); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
    }

    ui(kind) {
        if (!this.running) return;
        if (kind === 'move') this.tone({ freq: 880, dur: 0.04, type: 'square', vol: 0.05 });
        else if (kind === 'select') { this.tone({ freq: 660, dur: 0.05, type: 'square', vol: 0.08 }); this.tone({ freq: 990, dur: 0.07, type: 'square', vol: 0.08, delay: 0.05 }); }
        else if (kind === 'back') this.tone({ freq: 520, to: 330, dur: 0.09, type: 'square', vol: 0.08 });
        else if (kind === 'coin') { this.tone({ freq: 988, dur: 0.08, type: 'square', vol: 0.1 }); this.tone({ freq: 1319, dur: 0.5, type: 'square', vol: 0.1, delay: 0.08, send: 0.2 }); }
        else if (kind === 'type') this.tone({ freq: 1500 + Math.random() * 300, dur: 0.02, type: 'square', vol: 0.04 });
        else if (kind === 'pause') this.tone({ freq: 440, to: 220, dur: 0.12, type: 'triangle', vol: 0.12 });
        else if (kind === 'tick') this.tone({ freq: 1760, dur: 0.03, type: 'square', vol: 0.05 });
        else if (kind === 'count') this.tone({ freq: 660, dur: 0.14, type: 'square', vol: 0.12, send: 0.2 });
        else if (kind === 'go') { this.tone({ freq: 1320, dur: 0.45, type: 'square', vol: 0.12, send: 0.3 }); this.stab(64, 0.09, 0, 0.5); }
    }

    /** The CRT coming on: a thump of degauss, a rising whine, a relay click. */
    powerOn() {
        if (!this.running) return;
        this.tone({ freq: 55, to: 40, dur: 0.5, type: 'sine', vol: 0.3 });
        this.tone({ freq: 400, to: 15700, dur: 0.6, type: 'sine', vol: 0.025, att: 0.2 });
        this.tone({ freq: 15700, dur: 1.0, type: 'sine', vol: 0.006, delay: 0.6 });
        this.noise({ dur: 0.08, vol: 0.2, lp: 900 });
    }

    /** The band's sting under the logo. */
    sting() {
        if (!this.running) return;
        this.stab(57, 0.12, 0, 0.5);
        this.stab(62, 0.12, 0.28, 0.6);
        this.noise({ dur: 0.6, vol: 0.05, hp: 6000, rate: 0.7, delay: 0.0 });
    }

    hurryUp(on) { this.hurry = on; }

    // ------------------------------------------------------------------ the game's events
    onEvents(G, events) {
        if (!this.running) return;
        for (const e of events) {
            switch (e.type) {
                case 'swap': this.tone({ freq: 500, to: 800, dur: 0.07, type: 'triangle', vol: 0.1 }); break;
                case 'badswap': this.tone({ freq: 130, to: 80, dur: 0.14, type: 'sawtooth', vol: 0.12 }); break;
                case 'land': if (this.free('land', 0.04)) this.tone({ freq: 190, to: 110, dur: 0.05, type: 'sine', vol: Math.min(0.1, 0.02 + e.v * 0.004) }); break;
                case 'clear': if (this.free('pop', 0.022)) this.noise({ dur: 0.07, vol: 0.06, bp: 2400 + Math.random() * 1200, q: 2, delay: e.delay }); break;
                case 'wave': {
                    const i = Math.min(Math.max(e.combo, 1) - 1, PENTA.length - 1);
                    this.bell(mtof(PENTA[i] + this.keyShift), 0.14, 0, 0.8);
                    if (e.n >= 5) this.bell(mtof(PENTA[i] + 12 + this.keyShift), 0.07, 0.06, 0.6);
                    if (e.combo >= 4) this.noise({ dur: 0.12, vol: 0.12, bp: 1700, q: 0.9, send: 0.4 });
                    break;
                }
                case 'make': { this.tone({ freq: 880, dur: 0.12, type: 'triangle', vol: 0.12, send: 0.3 }); this.tone({ freq: 1320, dur: 0.18, type: 'triangle', vol: 0.12, delay: 0.09, send: 0.3 }); this.tone({ freq: 1760, dur: 0.3, type: 'triangle', vol: 0.1, delay: 0.18, send: 0.4 }); break; }
                case 'morph': this.tone({ freq: 1200, to: 2400, dur: 0.15, type: 'triangle', vol: 0.06, delay: e.delay || 0 }); break;
                case 'beam': this.tone({ freq: 2200, to: 180, dur: 0.35, type: 'sawtooth', vol: 0.1, delay: e.delay || 0, send: 0.2 }); this.noise({ dur: 0.3, vol: 0.1, hp: 3000, delay: e.delay || 0 }); break;
                case 'blast': this.tone({ freq: 140, to: 32, dur: 0.5, type: 'sine', vol: 0.3, delay: e.delay || 0 }); this.noise({ dur: 0.45, vol: 0.25, lp: 1400, delay: e.delay || 0, send: 0.3 }); break;
                case 'mirror': for (let k = 0; k < 9; k++) this.tone({ freq: mtof(PENTA[(k * 2) % 12 + 3]), dur: 0.14, type: 'triangle', vol: 0.07, delay: (e.delay || 0) + k * 0.045, send: 0.5 }); this.noise({ dur: 0.6, vol: 0.06, hp: 8000, delay: e.delay || 0 }); break;
                case 'combo': this.stab(52, 0.12, 0, 0.7); this.noise({ dur: 0.7, vol: 0.12, hp: 2000, rate: 0.6 }); this.tone({ freq: 80, to: 30, dur: 0.7, type: 'sine', vol: 0.3 }); break;
                case 'bonus': if (e.amount > 0) this.tone({ freq: 1568, dur: 0.08, type: 'square', vol: 0.06, delay: 0.25 }); break;
                case 'fever':
                    this.noise({ dur: 0.9, vol: 0.22, bp: 800, q: 0.5, rate: 0.5 });
                    this.tone({ freq: 300, to: 1800, dur: 0.8, type: 'sawtooth', vol: 0.05, send: 0.4 });
                    this.stab(57, 0.14, 0.7, 0.8); this.stab(59, 0.12, 0.95, 0.8);
                    break;
                case 'feverEnd': this.tone({ freq: 800, to: 200, dur: 0.5, type: 'sawtooth', vol: 0.06 }); break;
                case 'level': this.stab(60, 0.12, 0, 0.3); this.stab(64, 0.12, 0.2, 0.3); this.stab(67, 0.14, 0.4, 0.7); break;
                case 'shuffle': this.noise({ dur: 0.5, vol: 0.12, bp: 1800, q: 0.7, rate: 1.4 }); for (let k = 0; k < 6; k++) this.tone({ freq: 700 + k * 180, dur: 0.07, type: 'triangle', vol: 0.05, delay: 0.1 + k * 0.05 }); break;
                case 'timeup': this.sadTrombone(); break;
                default: break;
            }
        }
    }

    sadTrombone() {
        const notes = [58, 57, 56, 55];
        notes.forEach((n, i) => {
            const d = i * 0.42, dur = i === 3 ? 1.1 : 0.4;
            this.tone({ freq: mtof(n), to: mtof(n) * (i === 3 ? 0.9 : 1), dur, type: 'sawtooth', vol: 0.09, delay: d, att: 0.05, send: 0.3 });
        });
    }
    fanfare() { this.stab(60, 0.12, 0, 0.25); this.stab(64, 0.12, 0.18, 0.25); this.stab(67, 0.12, 0.36, 0.25); this.stab(72, 0.14, 0.54, 0.9); }
    tick(on) { if (on && this.running) this.tone({ freq: 1400, dur: 0.04, type: 'square', vol: 0.07 }); }
}
