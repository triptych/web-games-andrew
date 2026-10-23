// Procedural sound, all Web Audio, no files: the clack of a keyboard, the PC speaker's square-wave
// beeps, the whirr and stepping chatter of a 5¼" floppy drive, and the low hum of a monitor.
// The context is made on the first user gesture; ../lib/page-audio.js suspends it in a hidden tab.

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.humVol = 0.3;
        this.lastKey = 0;
        this.noise = null;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.hum = ctx.createGain(); this.hum.gain.value = this.humVol * 0.05; this.hum.connect(comp);
        // one second of white noise, reused for every click, scrape and whirr
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let a = 12345;
        for (let i = 0; i < d.length; i++) { a = (a * 1664525 + 1013904223) | 0; d[i] = (a / 2147483648); }
        this.noise = buf;
        // the monitor's transformer: 60 Hz and its second harmonic
        for (const [f, g] of [[60, 1], [120, 0.5]]) {
            const o = ctx.createOscillator(), og = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f; og.gain.value = g;
            o.connect(og); og.connect(this.hum); o.start();
        }
    }

    setVolumes(sfx, hum) {
        this.sfxVol = sfx; this.humVol = hum;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.hum.gain.setTargetAtTime(hum * 0.05, this.ctx.currentTime, 0.05);
    }

    get live() { return !!this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ building blocks
    /** A burst of filtered noise. */
    burst({ t = 0, dur = 0.02, freq = 3000, q = 1, type = 'bandpass', vol = 0.1 } = {}) {
        const ctx = this.ctx, at = ctx.currentTime + t;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(at, Math.random() * 0.8, dur + 0.01);
    }

    /** One enveloped oscillator. */
    tone({ freq = 440, to = freq, dur = 0.1, type = 'square', vol = 0.08, t = 0, lp = 0 } = {}) {
        const ctx = this.ctx, at = ctx.currentTime + t;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, at);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(vol, at + 0.004);
        g.gain.setValueAtTime(vol, at + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        let out = o;
        if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
        out.connect(g); g.connect(this.sfx);
        o.start(at); o.stop(at + dur + 0.02);
    }

    // ------------------------------------------------------------------ the sounds
    /** One key of a keyboard: a bright click and a low thud. Called for each character typed. */
    key(ch = 'a') {
        if (!this.live) return;
        const now = this.ctx.currentTime;
        if (now - this.lastKey < 0.022) return;       // the typewriter can type faster than a person could
        this.lastKey = now;
        const big = ch === ' ' || ch === '\n';
        this.burst({ dur: 0.016, freq: (big ? 1800 : 2600) + Math.random() * 2800, q: 1.4, vol: big ? 0.07 : 0.085 });
        this.tone({ freq: big ? 110 : 170 + Math.random() * 40, to: 60, dur: 0.03, type: 'sine', vol: big ? 0.09 : 0.05 });
    }

    /** The PC speaker. */
    beep(freq = 880, dur = 0.06, t = 0) {
        if (!this.live) return;
        this.tone({ freq, dur, type: 'square', vol: 0.05, t, lp: 3500 });
    }

    ui(kind) {
        if (kind === 'click') this.beep(1250, 0.03);
        else if (kind === 'open') { this.beep(700, 0.04); this.beep(1000, 0.04, 0.05); }
        else if (kind === 'close') { this.beep(1000, 0.04); this.beep(700, 0.04, 0.05); }
        else if (kind === 'deny') this.beep(160, 0.12);
    }

    /**
     * A floppy drive. kind: 'boot' (a long seek and a thunk), 'read' (a short chatter when a new scene
     * loads), 'write' (a slower, heavier chatter when the game saves).
     */
    floppy(kind = 'read') {
        if (!this.live) return;
        const steps = kind === 'boot' ? 26 : kind === 'write' ? 11 : 5 + Math.floor(Math.random() * 4);
        const gap = kind === 'write' ? 0.062 : 0.044;
        const total = steps * gap + 0.25;
        const ctx = this.ctx, at = ctx.currentTime;
        // the spindle motor: a soft bandpassed rumble that spins up and down
        const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 0.9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.05, at + 0.08);
        g.gain.setValueAtTime(0.05, at + total - 0.1);
        g.gain.linearRampToValueAtTime(0.0001, at + total + 0.05);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(at); src.stop(at + total + 0.1);
        // the head stepping along the track: a square buzz and a click, a little irregular
        for (let i = 0; i < steps; i++) {
            const t = 0.08 + i * gap + Math.random() * 0.012;
            this.tone({ freq: 95 + Math.random() * 25, to: 70, dur: 0.022, type: 'square', vol: 0.11, t, lp: 900 });
            this.burst({ t, dur: 0.008, freq: 3500, q: 0.7, vol: 0.09 });
        }
        // the head settling
        this.tone({ freq: 80, to: 40, dur: 0.07, type: 'sine', vol: 0.14, t: total - 0.12 });
        this.burst({ t: total - 0.12, dur: 0.03, freq: 700, q: 0.8, vol: 0.12 });
    }

    dice() {
        if (!this.live) return;
        for (let i = 0; i < 5; i++) this.beep(300 + Math.random() * 500, 0.018, i * 0.045);
    }

    roll(ok) {
        if (!this.live) return;
        this.dice();
        if (ok) { this.beep(660, 0.07, 0.3); this.beep(990, 0.12, 0.38); }
        else { this.beep(220, 0.12, 0.3); this.beep(147, 0.2, 0.42); }
    }

    ending(id) {
        if (!this.live) return;
        const tunes = {
            signature: [392, 523, 659, 784, 1047],
            edit: [523, 659, 784, 1047, 1319, 1568],
            fire: [440, 330, 220, 165, 110],
            leave: [392, 392, 330, 294],
            quiet: [262, 220, 175, 131],
            chorus: [330, 392, 330, 392, 330],
            ardent: [440, 440, 349, 440],
        };
        (tunes[id] || tunes.leave).forEach((f, i) => this.beep(f, 0.22, 0.4 + i * 0.2));
    }

    /** React to the sim's events. */
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'scene' && !e.quiet) this.floppy('read');
            else if (e.type === 'roll') this.roll(e.ok);
            else if (e.type === 'item') { this.beep(e.gained ? 880 : 440, 0.05); this.beep(e.gained ? 1320 : 330, 0.07, 0.07); }
            else if (e.type === 'stat' && e.delta < 0) this.beep(e.which === 'health' ? 140 : 190, 0.14, 0.05);
            else if (e.type === 'stat') this.beep(990, 0.05);
            else if (e.type === 'und') this.beep(1320, 0.04);
            else if (e.type === 'codex') [660, 880, 1100].forEach((f, i) => this.beep(f, 0.07, 0.15 + i * 0.07));
            else if (e.type === 'end') this.ending(e.id);
        }
    }
}
