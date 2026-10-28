// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a slow,
// generated noir score (pads, a bass, a lonely lead) under a bed of rain. The context is made on the
// first user gesture (browsers block audio before one), and ../lib/page-audio.js suspends it while
// the tab is hidden.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// D minor-ish progression (MIDI roots and chord tones), four bars each, then around again
const PROG = [
    { root: 38, tones: [50, 53, 57, 60], lead: [62, 65, 67, 69, 72] },        // Dm9
    { root: 34, tones: [46, 50, 53, 57], lead: [62, 65, 69, 70, 74] },        // Bbmaj7
    { root: 31, tones: [46, 50, 53, 55], lead: [62, 65, 67, 70, 74] },        // Gm9
    { root: 33, tones: [45, 52, 55, 59], lead: [61, 64, 67, 69, 73] },        // A7sus
];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.6;
        this.mood = 'title';
        this.beat = 0; this.nextT = 0; this.timer = null;
        this.lastTick = 0; this.sizzle = 0;
        this.runningSfx = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4; comp.knee.value = 12;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        this.amb = ctx.createGain(); this.amb.gain.value = this.musicVol * 0.9; this.amb.connect(comp);
        // reverb from a decaying noise impulse
        this.verb = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 2.6), imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb.buffer = imp;
        this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.55;
        this.verb.connect(this.verbOut); this.verbOut.connect(this.music);
        this.noiseBuf = this.makeNoise(2);
        this.startRain();
        this.startMusic();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, t, 0.02);
        this.amb.gain.setTargetAtTime(music * 0.9, t, 0.02);
    }

    makeNoise(sec, brown = false) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < n; i++) {
            const w = Math.random() * 2 - 1;
            if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
        }
        return buf;
    }

    ok() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ building blocks
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus = this.sfx, attack = 0.008 } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + dur + 0.03);
    }

    noise({ dur = 0.05, freq = 3000, q = 1, type = 'bandpass', vol = 0.2, delay = 0, to = null, bus = this.sfx } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
        s.loopStart = 0; s.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(bus);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') { this.tone({ freq: 440, to: 660, dur: 0.09, type: 'triangle', vol: 0.12 }); }
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'tool') { this.tone({ freq: 900, to: 500, dur: 0.06, type: 'square', vol: 0.06 }); this.noise({ dur: 0.04, freq: 4000, vol: 0.08 }); }
        else if (kind === 'bell') { [1318, 1760, 2093].forEach((f, i) => this.tone({ freq: f, dur: 1.2, type: 'sine', vol: 0.12, delay: i * 0.05 })); }
        else if (kind === 'coin') { this.tone({ freq: 1568, dur: 0.07, type: 'square', vol: 0.08 }); this.tone({ freq: 2093, dur: 0.22, type: 'square', vol: 0.08, delay: 0.07 }); }
        else if (kind === 'buy') { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.12, delay: i * 0.06 })); }
    }

    /** A little chirp per character while someone talks. */
    blip(hz = 330, i = 0) {
        if (!this.ok()) return;
        const f = hz * (1 + ((i * 7) % 5) * 0.09);
        this.tone({ freq: f, to: f * 0.92, dur: 0.045, type: hz > 400 ? 'square' : 'triangle', vol: 0.045 });
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        if (!this.ok()) return;
        const now = this.ctx.currentTime;
        for (const e of events) {
            switch (e.type) {
                case 'turn': {
                    if (now - this.lastTick < 0.045) break;
                    this.lastTick = now;
                    if (e.tool === 'ratchet') { this.noise({ dur: 0.03, freq: 2200, q: 3, vol: 0.2 }); this.tone({ freq: 340, dur: 0.03, type: 'square', vol: 0.05 }); this.noise({ dur: 0.02, freq: 4200, q: 3, vol: 0.12, delay: 0.035 }); }
                    else this.noise({ dur: 0.025, freq: 3800, q: 2, vol: 0.14 });
                    break;
                }
                case 'screw_out': this.tone({ freq: 2600, dur: 0.16, type: 'sine', vol: 0.1 }); this.tone({ freq: 3900, dur: 0.1, type: 'sine', vol: 0.06, delay: 0.02 }); this.noise({ dur: 0.06, freq: 5000, vol: 0.1, delay: 0.3 }); this.tone({ freq: 1800, dur: 0.08, type: 'sine', vol: 0.06, delay: 0.42 }); break;
                case 'screw_in': this.tone({ freq: 700, to: 420, dur: 0.1, type: 'triangle', vol: 0.12 }); this.noise({ dur: 0.04, freq: 3000, vol: 0.14 }); break;
                case 'lift': this.noise({ dur: 0.22, freq: 600, to: 2600, q: 0.8, vol: 0.16 }); this.tone({ freq: 220, to: 330, dur: 0.12, type: 'triangle', vol: 0.08 }); break;
                case 'pick': this.noise({ dur: 0.1, freq: 1800, vol: 0.1 }); break;
                case 'drop': this.tone({ freq: 140, to: 60, dur: 0.14, type: 'sine', vol: 0.22 }); this.noise({ dur: 0.05, freq: 900, vol: 0.14 }); break;
                case 'seat': this.tone({ freq: 110, to: 55, dur: 0.18, type: 'sine', vol: 0.3 }); this.noise({ dur: 0.04, freq: 3200, q: 2, vol: 0.2 }); this.tone({ freq: 880, to: 1760, dur: 0.1, type: 'triangle', vol: 0.1, delay: 0.05 }); break;
                case 'plug': this.noise({ dur: 0.03, freq: 2600, q: 4, vol: 0.2 }); this.tone({ freq: 1900, to: 500, dur: 0.07, type: 'square', vol: 0.08, delay: 0.015 }); break;
                case 'unplug': this.tone({ freq: 500, to: 1200, dur: 0.06, type: 'square', vol: 0.06 }); this.noise({ dur: 0.05, freq: 1500, vol: 0.1 }); break;
                case 'bonk': this.tone({ freq: 190, to: 120, dur: 0.18, type: 'triangle', vol: 0.3 }); this.tone({ freq: 95, dur: 0.22, type: 'sawtooth', vol: 0.1 }); break;
                case 'slip': this.noise({ dur: 0.1, freq: 6000, to: 1500, q: 1, vol: 0.18 }); break;
                case 'scrub': this.noise({ dur: 0.12, freq: 2600, to: 3600, q: 0.7, vol: 0.16 }); break;
                case 'drip': this.tone({ freq: 1100, to: 380, dur: 0.07, type: 'sine', vol: 0.09 }); break;
                case 'solder': this.noise({ dur: 0.12, freq: 6500, q: 0.5, type: 'highpass', vol: 0.12 }); if (Math.random() < 0.5) this.noise({ dur: 0.01, freq: 3000, vol: 0.2, delay: Math.random() * 0.1 }); break;
                case 'burn': this.noise({ dur: 0.5, freq: 5000, to: 800, type: 'highpass', vol: 0.3 }); this.tone({ freq: 150, to: 40, dur: 0.3, type: 'sawtooth', vol: 0.2 }); break;
                case 'fixed': [784, 988, 1319, 1760].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.11, delay: i * 0.055 })); break;
                case 'probe_ok': this.tone({ freq: 1320, dur: 0.08, type: 'sine', vol: 0.12 }); this.tone({ freq: 1760, dur: 0.12, type: 'sine', vol: 0.12, delay: 0.09 }); break;
                case 'probe_bad': this.tone({ freq: 220, dur: 0.12, type: 'sawtooth', vol: 0.14 }); this.tone({ freq: 196, dur: 0.22, type: 'sawtooth', vol: 0.14, delay: 0.12 }); break;
                case 'spare': this.noise({ dur: 0.2, freq: 400, to: 1000, vol: 0.14 }); this.tone({ freq: 160, to: 90, dur: 0.12, type: 'sine', vol: 0.2, delay: 0.14 }); break;
                case 'return': this.tone({ freq: 700, to: 500, dur: 0.1, type: 'triangle', vol: 0.1 }); break;
                case 'scrap': this.tone({ freq: 330, to: 170, dur: 0.4, type: 'square', vol: 0.06 }); this.noise({ dur: 0.35, freq: 1400, to: 300, vol: 0.2 }); [2200, 3100].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.05, delay: i * 0.03 })); break;
                case 'stash': [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.09, delay: i * 0.08, bus: this.music })); break;
                case 'clue': this.tone({ freq: 392, dur: 1.2, type: 'sine', vol: 0.12, bus: this.music }); this.tone({ freq: 587, dur: 1.2, type: 'sine', vol: 0.1, delay: 0.1, bus: this.music }); this.tone({ freq: 880, dur: 1.4, type: 'triangle', vol: 0.08, delay: 0.2, bus: this.music }); break;
                case 'tool': if (!e.auto) this.ui('tool'); else this.noise({ dur: 0.04, freq: 4000, vol: 0.07 }); break;
                case 'test_start': this.tone({ freq: 60, to: 260, dur: 1.4, type: 'sawtooth', vol: 0.12 }); break;
                case 'flow': this.tone({ freq: 440 * Math.pow(2, (e.n % 12) / 12), dur: 0.1, type: 'sine', vol: 0.1 }); this.noise({ dur: 0.04, freq: 5000, vol: 0.07 }); break;
                case 'test_pass': [523, 659, 784, 1046, 1319, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.6, type: 'triangle', vol: 0.12, delay: i * 0.09 })); this.tone({ freq: 131, dur: 1.4, type: 'sine', vol: 0.18 }); break;
                case 'test_fail': this.noise({ dur: 0.6, freq: 4000, to: 500, type: 'highpass', vol: 0.3 }); this.tone({ freq: 300, to: 60, dur: 0.7, type: 'sawtooth', vol: 0.22 }); this.tone({ freq: 196, dur: 0.4, type: 'triangle', vol: 0.12, delay: 0.7 }); this.tone({ freq: 165, dur: 0.6, type: 'triangle', vol: 0.12, delay: 1.0 }); break;
                case 'paid': this.ui('coin'); break;
                case 'buy': this.ui('buy'); break;
                case 'tip': this.tone({ freq: 784, dur: 0.08, type: 'sine', vol: 0.07 }); break;
                case 'ending': this.tone({ freq: 146, dur: 4, type: 'sine', vol: 0.2, bus: this.music }); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ ambience
    startRain() {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.makeNoise(3); src.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000;
        const g = ctx.createGain(); g.gain.value = 0.07;
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.amb);
        src.start();
        const low = ctx.createBufferSource(); low.buffer = this.makeNoise(4, true); low.loop = true;
        const lg = ctx.createGain(); lg.gain.value = 0.2;
        const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 160;
        low.connect(lf); lf.connect(lg); lg.connect(this.amb); low.start();
        this.rainGain = g;
        this.nextThunder = ctx.currentTime + 20 + Math.random() * 30;
    }

    thunder() {
        const ctx = this.ctx, t = ctx.currentTime;
        const s = ctx.createBufferSource(); s.buffer = this.makeNoise(4, true);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(60, t + 3);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
        s.connect(f); f.connect(g); g.connect(this.amb); s.start(t); s.stop(t + 4);
    }

    // ------------------------------------------------------------------ music
    setMood(m) { this.mood = m; }

    startMusic() {
        const ctx = this.ctx;
        this.nextT = ctx.currentTime + 0.2;
        this.timer = setInterval(() => this.schedule(), 120);
    }

    schedule() {
        if (!this.ok()) return;
        const ctx = this.ctx;
        if (ctx.currentTime > this.nextThunder) { this.thunder(); this.nextThunder = ctx.currentTime + 25 + Math.random() * 40; }
        const spb = 60 / 58;              // seconds per beat
        while (this.nextT < ctx.currentTime + 0.6) {
            this.playBeat(this.beat, this.nextT, spb);
            this.nextT += spb; this.beat++;
        }
    }

    pad(notes, t, dur, vol) {
        const ctx = this.ctx;
        for (const m of notes) {
            for (const det of [-6, 7]) {
                const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
                const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f.frequency.linearRampToValueAtTime(420, t + dur);
                const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
                o.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verb);
                o.start(t); o.stop(t + dur + 0.1);
            }
        }
    }

    playBeat(beat, t, spb) {
        const bar = Math.floor(beat / 4) % 16, inBar = beat % 4;
        const chord = PROG[Math.floor(bar / 4) % PROG.length];
        const quiet = this.mood === 'bench' ? 0.55 : 1;
        if (beat % 16 === 0) this.pad(chord.tones, t, spb * 16.5, 0.032 * quiet);
        if (inBar === 0) {                                  // bass on the bar
            const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(chord.root);
            const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * quiet, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 3.6);
            o.connect(g); g.connect(this.music); o.start(t); o.stop(t + spb * 3.8);
        }
        if (this.mood === 'bench') {                        // a slow, quiet pulse to work to
            if (inBar === 2) this.tone({ freq: mtof(chord.tones[1] + 12), dur: 1.4, type: 'sine', vol: 0.025, bus: this.verbIn() });
            return;
        }
        // the lonely lead: sparse, in the chord's scale
        const r = Math.random();
        if ((inBar === 0 && r < 0.55) || (inBar === 2 && r < 0.25) || (this.mood === 'title' && inBar === 1 && r < 0.3)) {
            const n = chord.lead[Math.floor(Math.random() * chord.lead.length)];
            const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(mtof(n - 12), t); o.frequency.exponentialRampToValueAtTime(mtof(n), t + 0.12);
            const vib = this.ctx.createOscillator(); vib.frequency.value = 5.2; const vg = this.ctx.createGain(); vg.gain.value = 5; vib.connect(vg); vg.connect(o.detune);
            const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 3);
            o.connect(g); g.connect(this.music); g.connect(this.verb);
            o.start(t); vib.start(t); o.stop(t + spb * 3.2); vib.stop(t + spb * 3.2);
        }
    }

    verbIn() { return this.verb; }
}
