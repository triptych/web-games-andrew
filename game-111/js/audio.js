// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a
// look-ahead sequencer in D minor (i – VI – III – VII) whose filter opens and whose layers come in
// as the arcana are rekindled, with an arpeggio that quickens with resonance.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the tab
// is hidden.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALE = [0, 2, 3, 5, 7, 8, 10];                 // D natural minor, from D
const CHORDS = [[62, 65, 69], [58, 62, 65], [65, 69, 72], [60, 64, 67]];   // Dm, B♭, F, C
const BPM = 84;

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.restore = 0;          // 0..1, how much of the world is back
        this.resonance = 0;
        this.intensity = 0;        // 0 on the title, 1 in play
        this.lastPitch = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(this.master);
        // a shared hall
        this.verb = ctx.createConvolver();
        this.verb.buffer = this.impulse(2.8);
        this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.5;
        this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
        this.sfxSend = ctx.createGain(); this.sfxSend.gain.value = 0.35; this.sfxSend.connect(this.verb);
        this.sfx.connect(this.sfxSend);
        this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.6; this.musicSend.connect(this.verb);
        this.music.connect(this.musicSend);
        // the pad's filter opens as the world is restored
        this.padFilter = ctx.createBiquadFilter();
        this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 500; this.padFilter.Q.value = 2;
        this.padFilter.connect(this.music);
        this.noiseBuf = this.noise(1.5);
        this.step = 0;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 25);
    }

    impulse(sec) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = b.getChannelData(c);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
        }
        return b;
    }
    noise(sec) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }
    setWorld(restore) { this.restore = restore; }
    setIntensity(v) { this.intensity = v; }

    get ok() { return this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, attack = 0.005, out = this.sfx, detune = 0 } = {}) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.detune.value = detune;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + dur + 0.05);
    }
    /** Filtered noise: whooshes, cracks, thunder. */
    hiss({ dur = 0.3, vol = 0.2, type = 'bandpass', f0 = 2000, f1 = f0, q = 1, delay = 0, attack = 0.01 } = {}) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }
    /** A struck bell: inharmonic partials. */
    bell(freq, { vol = 0.12, delay = 0, dur = 1.6 } = {}) {
        for (const [r, v] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]]) this.tone({ freq: freq * r, dur: dur / Math.sqrt(r), vol: vol * v, delay, attack: 0.003 });
    }
    note(deg, oct = 0) {
        const n = SCALE.length;
        const o = Math.floor(deg / n);
        return mtof(62 + 12 * (o + oct) + SCALE[((deg % n) + n) % n]);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.06, type: 'triangle', vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'pick') { this.tone({ freq: 520, to: 780, dur: 0.08, type: 'sine', vol: 0.1 }); this.hiss({ dur: 0.08, vol: 0.03, f0: 5000 }); }
        else if (kind === 'move') this.tone({ freq: 1200, dur: 0.03, type: 'sine', vol: 0.03 });
        else if (kind === 'deny') this.tone({ freq: 140, to: 110, dur: 0.18, type: 'square', vol: 0.06 });
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'place') {
                this.tone({ freq: 150, to: 60, dur: 0.16, vol: 0.28 });
                this.hiss({ dur: 0.05, vol: 0.08, f0: 3500, q: 0.8 });
                this.tone({ freq: this.note(e.color + 2, 1), dur: 0.25, type: 'triangle', vol: 0.06, delay: 0.01 });
            } else if (e.type === 'clear') {
                const L = e.rows.length + e.cols.length;
                const lift = Math.min(e.resonance, 8);
                const n = 3 + L;
                for (let k = 0; k < n; k++) {
                    const f = this.note(k * 2 + lift, 1);
                    this.tone({ freq: f, dur: 0.6, type: 'triangle', vol: 0.11, delay: k * 0.045 });
                    this.tone({ freq: f * 2, dur: 0.35, type: 'sine', vol: 0.05, delay: k * 0.045 + 0.02 });
                }
                this.hiss({ dur: 0.45 + L * 0.1, vol: 0.12 + L * 0.03, f0: 800, f1: 7000, q: 0.7 });
                this.tone({ freq: 90, to: 40, dur: 0.4, vol: 0.2 + L * 0.05 });
                if (e.sigils.length) this.bell(this.note(14 + lift), { vol: 0.14, delay: 0.12 });
                if (e.cracked.length) this.hiss({ dur: 0.12, vol: 0.12, f0: 1800, type: 'highpass', delay: 0.05 });
                if (e.broken.length) { this.hiss({ dur: 0.35, vol: 0.18, f0: 6000, f1: 2500, type: 'bandpass', q: 3 }); for (let k = 0; k < 4; k++) this.tone({ freq: 2000 + Math.random() * 2500, dur: 0.15, vol: 0.04, delay: k * 0.03 }); }
                if (e.empty) { for (let k = 0; k < 7; k++) this.bell(this.note(7 + k * 2), { vol: 0.08, delay: 0.3 + k * 0.08 }); }
            } else if (e.type === 'restore') {
                // a swell, then the card's bell
                for (const [k, m] of [62, 69, 74, 77, 81, 86].entries()) this.tone({ freq: mtof(m), dur: 3.2, type: 'sawtooth', vol: 0.03, attack: 0.9, delay: 0.1, detune: (k % 2 ? 6 : -6) });
                this.tone({ freq: 55, to: 36, dur: 1.6, vol: 0.35, delay: 0.75 });
                this.hiss({ dur: 1.4, vol: 0.12, f0: 300, f1: 9000, attack: 0.7 });
                for (let k = 0; k < 6; k++) this.bell(this.note(7 + k * 2 + (e.arc % 4)), { vol: 0.09, delay: 0.8 + k * 0.11 });
            } else if (e.type === 'ascend') {
                for (let k = 0; k < 4; k++) this.bell(this.note(7 + k * 2), { vol: 0.07, delay: k * 0.1 });
            } else if (e.type === 'arrive' && !e.fresh) {
                if (e.blight.length) this.tone({ freq: 70, to: 50, dur: 1.2, type: 'sawtooth', vol: 0.06, attack: 0.3, delay: 2.4 });
            } else if (e.type === 'creep') {
                this.tone({ freq: 80, to: 45, dur: 0.9, type: 'sawtooth', vol: 0.12 });
                this.hiss({ dur: 0.8, vol: 0.08, type: 'lowpass', f0: 600, f1: 100 });
            } else if (e.type === 'power') {
                if (e.p === 'transmute') { this.hiss({ dur: 0.6, vol: 0.14, f0: 300, f1: 6000, q: 2 }); this.tone({ freq: 200, to: 900, dur: 0.5, type: 'triangle', vol: 0.08 }); }
                else if (e.p === 'turn') this.tone({ freq: 500, to: 750, dur: 0.12, type: 'triangle', vol: 0.1 });
                else if (e.p === 'lantern') this.bell(this.note(11), { vol: 0.15 });
                else if (e.p === 'strike') { this.hiss({ dur: 1.6, vol: 0.4, type: 'lowpass', f0: 3000, f1: 80, attack: 0.002 }); this.tone({ freq: 70, to: 28, dur: 1.2, vol: 0.45 }); this.hiss({ dur: 0.08, vol: 0.3, f0: 6000, type: 'highpass' }); }
                else if (e.p === 'starfall') { for (let k = 0; k < 10; k++) this.tone({ freq: this.note(20 - k), dur: 0.4, vol: 0.06, delay: k * 0.05 }); }
            } else if (e.type === 'spark') {
                this.tone({ freq: 1760, to: 2640, dur: 0.18, vol: 0.06, delay: 0.25 });
            } else if (e.type === 'invalid') {
                this.ui('deny');
            } else if (e.type === 'stuck') {
                this.tone({ freq: 110, dur: 0.9, type: 'triangle', vol: 0.12, attack: 0.1 });
                this.tone({ freq: 116.5, dur: 0.9, type: 'triangle', vol: 0.1, attack: 0.1 });
            } else if (e.type === 'over') {
                [74, 70, 65, 62, 57].forEach((m, i) => this.tone({ freq: mtof(m), dur: 0.9, type: 'triangle', vol: 0.12, delay: i * 0.18 }));
                this.tone({ freq: 60, to: 30, dur: 2, vol: 0.2, delay: 0.6 });
            } else if (e.type === 'ending') {
                [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => this.bell(mtof(m), { vol: 0.12, delay: 1 + i * 0.22, dur: 3 }));
            }
        }
    }

    // ------------------------------------------------------------------ music

    schedule() {
        if (!this.ok) { if (this.ctx) this.nextT = this.ctx.currentTime + 0.1; return; }
        const spb = 60 / BPM / 4;                  // a sixteenth
        const r = this.restore, live = this.intensity;
        this.padFilter.frequency.setTargetAtTime(380 + r * 1900 + this.resonance * 120, this.ctx.currentTime, 0.5);
        while (this.nextT < this.ctx.currentTime + 0.15) {
            const s = this.step, t = this.nextT;
            const bar = Math.floor(s / 16), inBar = s % 16;
            const chord = CHORDS[Math.floor(bar / 2) % 4];
            if (s % 32 === 0) this.pad(chord, t, spb * 32);
            // bass: roots on the beat; eighths once the world is waking
            if (inBar % 8 === 0 || (r > 0.3 && inBar % 4 === 0 && live)) this.pluck(mtof(chord[0] - 24), t, 0.5, 0.16, 'triangle');
            // the arpeggio: chord tones climbing, denser with resonance and play
            const dens = (live ? 0.35 : 0.15) + r * 0.3 + Math.min(0.35, this.resonance * 0.06);
            if (inBar % 2 === 0 || Math.random() < dens * 0.5) {
                if (Math.random() < dens + 0.1) {
                    const k = (s * 3 + Math.floor(s / 4)) % 6;
                    const m = chord[k % 3] + 12 * (1 + Math.floor(k / 3));
                    this.pluck(mtof(m), t, 0.35, 0.05 + r * 0.02, r > 0.5 ? 'sine' : 'triangle');
                }
            }
            // high bells for a world nearly whole
            if (r > 0.55 && inBar === 12 && Math.random() < r) this.pluck(mtof(chord[1] + 36), t, 1.2, 0.025, 'sine');
            this.nextT += spb;
            this.step++;
        }
    }

    pad(chord, t, dur) {
        for (const m of chord) {
            for (const d of [-7, 7]) {
                const o = this.ctx.createOscillator(), g = this.ctx.createGain();
                o.type = 'sawtooth';
                o.frequency.value = mtof(m - 12);
                o.detune.value = d;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.035, t + 1.6);
                g.gain.setValueAtTime(0.035, t + dur - 1.2);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
                o.connect(g); g.connect(this.padFilter);
                o.start(t); o.stop(t + dur + 0.7);
            }
        }
    }

    pluck(freq, t, dur, vol, type) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + dur + 0.05);
    }
}
