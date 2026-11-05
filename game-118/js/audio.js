// Procedural sound, all Web Audio, no files: effects that answer simulation events, and a warm little
// score (a pad, a walking bass and a pentatonic pluck) played by a look-ahead sequencer.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const PENT = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];   // C major pentatonic, tier by tier
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// four bars: C, Am, F, G (root midi, then chord tones)
const PROG = [
    { root: 48, chord: [60, 64, 67, 72] },
    { root: 45, chord: [57, 60, 64, 69] },
    { root: 41, chord: [57, 60, 65, 69] },
    { root: 43, chord: [59, 62, 67, 71] },
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const MELODY = [   // one note per bar-half, in scale degrees of the chord, 0 = rest
    [3, 0], [2, 3], [3, 2], [1, 0],
    [3, 0], [2, 1], [3, 2], [0, 1],
];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.music = false;
        this.step = 0;
        this.nextT = 0;
        this.timer = null;
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
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.42; this.musicBus.connect(comp);
        // a soft room for the music
        const conv = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 1.4), buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        conv.buffer = buf;
        this.verb = ctx.createGain(); this.verb.gain.value = 0.35;
        this.musicBus.connect(conv); conv.connect(this.verb); this.verb.connect(comp);
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        if (this.music) this.startMusic();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.musicBus.gain.setTargetAtTime(music * 0.42, this.ctx.currentTime, 0.05);
    }

    get running() { return !!this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator: a blip, a sweep, a bell or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, bus = this.sfx, attack = 0.008 } = {}) {
        if (!this.running) return;
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

    noise({ dur = 0.15, vol = 0.1, from = 2000, to = 400, delay = 0, q = 1 } = {}) {
        if (!this.running) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        s.buffer = this.noiseBuf;
        f.type = 'bandpass'; f.Q.value = q;
        f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(t); s.stop(t + dur + 0.02);
    }

    /** A little bell: a fundamental, a bright partial and a soft octave below. */
    bell(freq, { vol = 0.16, dur = 0.5, delay = 0 } = {}) {
        this.tone({ freq, dur, vol, delay });
        this.tone({ freq: freq * 2.01, dur: dur * 0.6, vol: vol * 0.35, delay });
        this.tone({ freq: freq / 2, dur: dur * 0.8, vol: vol * 0.4, type: 'triangle', delay });
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 620, to: 760, dur: 0.06, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 420, to: 640, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 640, to: 420, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'select') this.tone({ freq: 880, to: 990, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'pick') this.tone({ freq: 500, to: 700, dur: 0.07, type: 'triangle', vol: 0.1 });
        else if (kind === 'denied') { this.tone({ freq: 220, to: 170, dur: 0.12, type: 'square', vol: 0.07 }); this.tone({ freq: 190, to: 140, dur: 0.14, type: 'square', vol: 0.06, delay: 0.1 }); }
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'spawn': this.tone({ freq: 300, to: 720, dur: 0.11, vol: 0.16 }); this.noise({ dur: 0.06, vol: 0.05, from: 3000, to: 1500 }); break;
                case 'move': this.tone({ freq: 240, to: 170, dur: 0.07, type: 'triangle', vol: 0.14 }); break;
                case 'swap': this.tone({ freq: 300, to: 220, dur: 0.06, type: 'triangle', vol: 0.12 }); this.tone({ freq: 220, to: 300, dur: 0.06, type: 'triangle', vol: 0.12, delay: 0.06 }); break;
                case 'merge': {
                    const lift = e.combo >= 2 ? Math.min(e.combo - 1, 6) : 0;
                    const f = PENT[Math.min(PENT.length - 1, e.t - 1)] * Math.pow(2, lift / 12);
                    this.bell(f, { vol: 0.16 + e.t * 0.012, dur: 0.35 + e.t * 0.08, delay: 0.1 });
                    if (e.t >= 4) [1.25, 1.5, 2].forEach((m, i) => this.tone({ freq: f * m, dur: 0.25, vol: 0.08, delay: 0.16 + i * 0.07 }));
                    if (e.t >= 6) this.noise({ dur: 0.5, vol: 0.05, from: 6000, to: 2500, delay: 0.1, q: 3 });
                    break;
                }
                case 'compost': this.noise({ dur: 0.28, vol: 0.13, from: 1800, to: 250 }); break;
                case 'serve':
                    this.tone({ freq: 1318.5, dur: 0.1, type: 'square', vol: 0.07 });
                    this.tone({ freq: 1760, dur: 0.35, type: 'square', vol: 0.07, delay: 0.09 });
                    this.noise({ dur: 0.25, vol: 0.05, from: 7000, to: 4000, delay: 0.1, q: 4 });
                    [659, 784, 988].forEach((f, i) => this.bell(f, { vol: 0.08, dur: 0.4, delay: 0.2 + i * 0.08 }));
                    break;
                case 'guest': this.tone({ freq: 659, dur: 0.22, vol: 0.06 }); this.tone({ freq: 523, dur: 0.3, vol: 0.06, delay: 0.16 }); break;
                case 'goal': [523, 659, 784].forEach((f, i) => this.bell(f, { vol: 0.12, dur: 0.4, delay: i * 0.1 })); break;
                case 'chapter': [523, 659, 784, 1047, 1319].forEach((f, i) => this.bell(f, { vol: 0.13, dur: 0.6, delay: i * 0.11 })); break;
                case 'upgrade': [392, 523, 659, 784, 1047].forEach((f, i) => { this.bell(f, { vol: 0.12, dur: 0.6, delay: i * 0.09 }); }); this.noise({ dur: 0.6, vol: 0.05, from: 500, to: 3500 }); break;
                case 'win': [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.bell(f, { vol: 0.14, dur: 0.8, delay: i * 0.16 })); break;
                case 'refill': case 'basket': [660, 880, 1100, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.18, vol: 0.09, delay: i * 0.06 })); break;
                case 'locked': this.tone({ freq: 330, to: 200, dur: 0.5, type: 'triangle', vol: 0.12 }); break;
                case 'denied': this.ui('denied'); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ music

    startMusic() {
        this.music = true;
        if (!this.ctx || this.timer) return;
        this.step = 0;
        this.nextT = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this._schedule(), 60);
    }
    stopMusic() {
        this.music = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    _schedule() {
        if (!this.running) { if (this.ctx) this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.1); return; }
        const spb = 60 / 84 / 2;                           // an eighth note
        while (this.nextT < this.ctx.currentTime + 0.25) {
            const s = this.step % 64, bar = Math.floor(s / 8) % 4, k = s % 8, ch = PROG[bar];
            const t = this.nextT - this.ctx.currentTime;
            const bus = this.musicBus;
            // the arpeggio, a soft pluck
            this.tone({ freq: mtof(ch.chord[ARP[k]]), dur: 0.5, type: 'triangle', vol: 0.2, delay: t, bus, attack: 0.01 });
            if (k === 0 || k === 4) this.tone({ freq: mtof(ch.root), dur: 0.9, type: 'sine', vol: 0.34, delay: t, bus, attack: 0.02 });
            if (k === 0) ch.chord.slice(0, 3).forEach((m) => this.tone({ freq: mtof(m - 12), dur: spb * 8 * 0.98, type: 'sine', vol: 0.07, delay: t, bus, attack: 0.5 }));
            // a tune on top, every other four bars
            if (Math.floor(s / 32) % 2 === 1) {
                const n = MELODY[(bar + (s >= 32 ? 4 : 0)) % 8][k < 4 ? 0 : 1];
                if (n && (k === 0 || k === 4)) this.tone({ freq: mtof(ch.chord[n] + 12), dur: 0.7, type: 'sine', vol: 0.13, delay: t, bus, attack: 0.02 });
            }
            this.nextT += spb;
            this.step++;
        }
    }
}
